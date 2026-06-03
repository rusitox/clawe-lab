// Archive view — lists archived tasks, supports filters + cursor pagination,
// allows restore via column-picker dialog, opens task drawer in read-only mode.

import { api } from "./api.js";
import { showToast } from "./toast.js";
import * as drawer from "./drawer.js";

const COLUMN_LABEL = {
  backlog: "Backlog",
  todo: "Todo",
  inprogress: "In progress",
  verification: "Verification",
  done: "Done",
};

const KIND_LETTER = { task: "T", bug: "B", proposal: "P" };

const main = document.getElementById("archive-main");
const projectId = main.dataset.projectId;
const projectSlug = main.dataset.projectSlug;

const listEl      = document.getElementById("archive-list");
const emptyEl     = document.getElementById("archive-empty");
const loadMoreBtn = document.getElementById("archive-load-more");
const errorEl     = document.getElementById("archive-error");
const searchEl    = document.getElementById("archive-search");
const kindEl      = document.getElementById("archive-kind");
const priorityEl  = document.getElementById("archive-priority");

const restoreDialog = document.getElementById("restore-task-dialog");
const restoreTaskTitleEl = document.getElementById("restore-task-title");
const restoreConfirmBtn  = document.getElementById("restore-confirm");
const restoreCancelBtn   = document.getElementById("restore-cancel");
const restoreErrorEl     = document.getElementById("restore-error");

let nextCursor = null;
let pendingRestoreTask = null;
let pendingRestoreBtn = null;   // the [Restore] button that triggered the dialog

// ---- Escape helper (no XSS via textContent; kept for aria-label strings) ----

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// ---- Date formatter ----

function fmtDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---- Render one archive row ----

function buildRow(task) {
  const row = document.createElement("div");
  row.className = "archive-row";
  row.setAttribute("role", "listitem");
  row.dataset.taskId = task.id;

  // Kind badge
  const badge = document.createElement("span");
  badge.className = `kind-badge kind-${escapeHtml(task.kind)}`;
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = KIND_LETTER[task.kind] || "?";
  row.appendChild(badge);

  // Title — a <button> so it's focusable and announced as a button
  const titleBtn = document.createElement("button");
  titleBtn.className = "archive-row__title";
  titleBtn.setAttribute("aria-label", `Open task: ${escapeHtml(task.title)}`);
  titleBtn.textContent = task.title;
  titleBtn.addEventListener("click", () => openArchiveDrawer(task, titleBtn));
  row.appendChild(titleBtn);

  // Meta group: column pill + date + restore button
  const meta = document.createElement("div");
  meta.className = "archive-row__meta";

  const pill = document.createElement("span");
  pill.className = "column-pill";
  pill.textContent = COLUMN_LABEL[task.column] || task.column;
  meta.appendChild(pill);

  const timeEl = document.createElement("time");
  timeEl.setAttribute("datetime", task.archived_at || "");
  timeEl.textContent = fmtDate(task.archived_at);
  meta.appendChild(timeEl);

  const restoreBtn = document.createElement("button");
  restoreBtn.className = "btn btn-ghost btn-sm";
  restoreBtn.textContent = "Restore";
  restoreBtn.setAttribute("aria-label", `Restore task: ${escapeHtml(task.title)}`);
  restoreBtn.addEventListener("click", () => openRestoreDialog(task, restoreBtn));
  meta.appendChild(restoreBtn);

  row.appendChild(meta);
  return row;
}

// ---- Fetch and render ----

async function loadArchived({ append = false } = {}) {
  errorEl.hidden = true;

  const params = {};
  const q = searchEl.value.trim();
  const kind = kindEl.value;
  const priority = priorityEl.value;
  if (q)        params.q = q;
  if (kind)     params.kind = kind;
  if (priority) params.priority = priority;
  if (append && nextCursor) params.cursor = nextCursor;

  try {
    const resp = await api.tasks.listArchived(projectId, params);
    const items = resp.items ?? [];

    if (!append) {
      listEl.replaceChildren();
      nextCursor = null;
    }

    for (const task of items) {
      listEl.appendChild(buildRow(task));
    }

    nextCursor = resp.next_cursor ?? null;
    loadMoreBtn.hidden = !nextCursor;

    const hasItems = listEl.children.length > 0;
    listEl.hidden = !hasItems;
    emptyEl.hidden = hasItems;
  } catch (err) {
    errorEl.textContent = err.message || "Failed to load archived tasks.";
    errorEl.hidden = false;
  }
}

// ---- Open task drawer in archive context ----

function openArchiveDrawer(task, triggerEl) {
  drawer.open({
    projectId,
    task,
    context: "archive",
    onChange: ({ restore }) => {
      if (restore) {
        openRestoreDialog(restore, null);
      }
    },
  });
  // Store trigger for focus return after drawer close.
  // drawer.js already handles prevFocus internally.
  void triggerEl;
}

// ---- Restore dialog ----

function openRestoreDialog(task, triggerBtn) {
  pendingRestoreTask = task;
  pendingRestoreBtn = triggerBtn;

  // Set task title in dialog (via textContent — XSS-safe).
  restoreTaskTitleEl.textContent = `"${task.title}"`;

  // Pre-select the column the task was in when archived.
  const col = task.column || "done";
  const radio = restoreDialog.querySelector(`input[value="${col}"]`);
  if (radio) radio.checked = true;

  restoreErrorEl.hidden = true;
  restoreDialog.showModal();

  // Focus the pre-selected radio.
  const checked = restoreDialog.querySelector('input[name="restore-column"]:checked');
  checked?.focus();
}

function closeRestoreDialog() {
  restoreDialog.close();
  // Return focus to the [Restore] button that opened the dialog.
  if (pendingRestoreBtn instanceof HTMLElement) {
    pendingRestoreBtn.focus();
  }
  pendingRestoreTask = null;
  pendingRestoreBtn = null;
}

restoreCancelBtn.addEventListener("click", closeRestoreDialog);

restoreConfirmBtn.addEventListener("click", async () => {
  if (!pendingRestoreTask) return;

  const selected = restoreDialog.querySelector('input[name="restore-column"]:checked');
  if (!selected) {
    restoreErrorEl.textContent = "Please select a column.";
    restoreErrorEl.hidden = false;
    return;
  }

  const column = selected.value;
  const task = pendingRestoreTask;

  restoreConfirmBtn.disabled = true;
  restoreErrorEl.hidden = true;

  try {
    await api.tasks.unarchive(projectId, task.id, column);

    // Remove the row from the archive list.
    const row = listEl.querySelector(`[data-task-id="${task.id}"]`);
    if (row) row.remove();

    // Show empty state if no rows remain.
    const hasItems = listEl.children.length > 0;
    listEl.hidden = !hasItems;
    emptyEl.hidden = hasItems;

    closeRestoreDialog();
    showToast(`Task restored to ${COLUMN_LABEL[column] || column}.`);
  } catch (err) {
    restoreErrorEl.textContent = err.message || "Could not restore task. Try again.";
    restoreErrorEl.hidden = false;
  } finally {
    restoreConfirmBtn.disabled = false;
  }
});

// Close dialog on Escape (native) — also restore focus.
restoreDialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeRestoreDialog();
});

// ---- Load more ----

loadMoreBtn.addEventListener("click", () => loadArchived({ append: true }));

// ---- Debounced filter re-fetch ----

let debounceTimer = null;
function onFilterChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadArchived(), 300);
}

searchEl.addEventListener("input", onFilterChange);
kindEl.addEventListener("change", onFilterChange);
priorityEl.addEventListener("change", onFilterChange);

// ---- Init ----

loadArchived();

// Archive view can be linked from within board drawer — handle restore
// event if drawer emits it while archive.js owns the page.
// (drawer.onChange is called from openArchiveDrawer; no additional wiring needed.)

// Update archive link in board topbar to point to the right page.
// (archive.html is a separate page; this module only runs on /p/{slug}/archive.)
void projectSlug;

// Task detail drawer (V2 Triage rápido — see SDD §3.10).
// Right-side 480px drawer; status + priority prominent in header; sticky
// "Move to In progress" primary action in footer; markdown body, attachment
// thumbnails, comments composer.

import { ApiError, api } from "./api.js";

const KIND_LETTER = { task: "T", bug: "B", proposal: "P" };
const NEXT_COLUMN = {
  backlog: "todo",
  todo: "inprogress",
  inprogress: "done",
  done: null,
};
const COLUMN_LABEL = {
  backlog: "Backlog",
  todo: "Todo",
  inprogress: "In progress",
  done: "Done",
};

const state = {
  projectId: null,
  task: null,
  onChange: null,
  prevFocus: null,
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function ensureRoot() {
  let scrim = document.getElementById("drawer-scrim");
  if (scrim) return scrim;
  scrim = document.createElement("div");
  scrim.id = "drawer-scrim";
  scrim.className = "drawer-scrim";
  scrim.hidden = true;
  scrim.addEventListener("click", close);
  document.body.appendChild(scrim);

  const aside = document.createElement("aside");
  aside.id = "task-drawer";
  aside.className = "drawer";
  aside.setAttribute("role", "dialog");
  aside.setAttribute("aria-modal", "true");
  aside.setAttribute("aria-labelledby", "drawer-title");
  aside.dataset.testid = "task-drawer";
  aside.hidden = true;
  document.body.appendChild(aside);

  document.addEventListener("keydown", (e) => {
    if (!aside.hidden && e.key === "Escape") close();
  });
  return scrim;
}

export async function open({ projectId, task, onChange }) {
  state.projectId = projectId;
  state.task = task;
  state.onChange = onChange;
  state.prevFocus = document.activeElement;

  ensureRoot();
  const scrim = document.getElementById("drawer-scrim");
  const aside = document.getElementById("task-drawer");
  scrim.hidden = false;
  aside.hidden = false;
  await render();
  // Focus the close button so the drawer is keyboard-navigable from the start.
  const closeBtn = aside.querySelector('[data-action="close"]');
  closeBtn?.focus();
}

export function close() {
  const scrim = document.getElementById("drawer-scrim");
  const aside = document.getElementById("task-drawer");
  if (scrim) scrim.hidden = true;
  if (aside) {
    aside.hidden = true;
    aside.replaceChildren();
  }
  state.task = null;
  if (state.prevFocus instanceof HTMLElement) state.prevFocus.focus();
  state.prevFocus = null;
}

async function render() {
  const aside = document.getElementById("task-drawer");
  const t = state.task;
  if (!t) return;

  const next = NEXT_COLUMN[t.column];
  const moveLabel = next ? `Move to ${COLUMN_LABEL[next]}` : "Already done";

  aside.innerHTML = `
    <header class="drawer-header" data-testid="drawer-header">
      <div class="drawer-header__meta">
        <span class="kind-badge kind-${escapeHtml(t.kind)}" aria-hidden="true">${KIND_LETTER[t.kind] || "?"}</span>
        ${t.priority && t.priority !== "P3"
          ? `<span class="priority-chip priority-${escapeHtml(t.priority)}">${escapeHtml(t.priority)}</span>`
          : ""}
        <span class="muted" style="font-size: var(--font-xs)">${COLUMN_LABEL[t.column] || t.column}</span>
      </div>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" data-action="close" aria-label="Close drawer (Esc)">✕</button>
    </header>
    <div class="drawer-body">
      <h2 id="drawer-title" data-testid="drawer-title" class="drawer-title">${escapeHtml(t.title)}</h2>

      <section class="drawer-section">
        <h3>Description</h3>
        <div class="markdown" data-testid="drawer-description">${t.description_html || '<p class="muted">No description yet.</p>'}</div>
      </section>

      <section class="drawer-section">
        <h3>Attachments <span class="muted" data-testid="att-count">(0)</span></h3>
        <div id="att-list" class="att-list" aria-live="polite"></div>
        <label class="att-upload" data-testid="att-upload">
          <input type="file" id="att-file" hidden accept="image/*,text/*,application/pdf,application/json,application/zip" />
          <span class="btn btn-sm">+ Attach file</span>
        </label>
        <p id="att-error" class="banner banner-error" role="alert" hidden></p>
      </section>

      <section class="drawer-section">
        <h3>Comments <span class="muted" data-testid="comment-count">(0)</span></h3>
        <div id="comment-list" class="comment-list" aria-live="polite"></div>
        <div class="comment-composer">
          <textarea id="comment-body" class="textarea" placeholder="Write a comment… (markdown supported)" rows="3"></textarea>
          <div class="comment-composer__footer">
            <span class="muted" style="font-size: var(--font-xs)">**bold** _italic_ \`code\` — supported</span>
            <button class="btn btn-primary btn-sm" id="comment-send" data-testid="comment-send">Send</button>
          </div>
          <p id="comment-error" class="banner banner-error" role="alert" hidden></p>
        </div>
      </section>
    </div>
    <footer class="drawer-footer">
      <button class="btn" data-action="delete" data-testid="task-delete">Delete</button>
      <span class="spacer"></span>
      ${next
        ? `<button class="btn btn-primary" id="move-next" data-testid="move-next">${escapeHtml(moveLabel)}</button>`
        : `<span class="muted" style="font-size: var(--font-sm)">${escapeHtml(moveLabel)}</span>`}
    </footer>
  `;

  aside.querySelector('[data-action="close"]').addEventListener("click", close);
  aside.querySelector('[data-action="delete"]')?.addEventListener("click", deleteTask);
  aside.querySelector("#move-next")?.addEventListener("click", () => moveTo(next));
  aside.querySelector("#att-file").addEventListener("change", uploadAttachment);
  aside.querySelector("#comment-send").addEventListener("click", postComment);

  await Promise.all([loadAttachments(), loadComments()]);
}

async function moveTo(column) {
  if (!column || !state.task) return;
  try {
    const updated = await api.tasks.move(state.projectId, state.task.id, { column });
    state.task = updated;
    state.onChange?.({ moved: updated });
    close();
  } catch (err) {
    console.error("move failed", err);
  }
}

async function deleteTask() {
  if (!state.task) return;
  if (!window.confirm(`Delete "${state.task.title}"? This cannot be undone.`)) return;
  try {
    await api.tasks.remove(state.projectId, state.task.id);
    state.onChange?.({ deleted: state.task.id });
    close();
  } catch (err) {
    console.error("delete failed", err);
  }
}

async function loadAttachments() {
  if (!state.task) return;
  try {
    const rows = await api.attachments.list(state.projectId, state.task.id);
    renderAttachments(rows);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) {
      console.error("attachments load failed", err);
    }
  }
}

function renderAttachments(rows) {
  const list = document.getElementById("att-list");
  document.querySelector('[data-testid="att-count"]').textContent = `(${rows.length})`;
  list.replaceChildren();
  for (const a of rows) {
    const item = document.createElement("div");
    item.className = "att-item";
    item.dataset.testid = "att-item";
    if (a.mime.startsWith("image/")) {
      const img = document.createElement("img");
      img.className = "att-thumb";
      img.src = api.attachments.rawUrl(a.id);
      img.alt = a.original_name;
      img.loading = "lazy";
      item.appendChild(img);
    } else {
      const dot = document.createElement("span");
      dot.className = "att-dot";
      dot.textContent = "📎";
      item.appendChild(dot);
    }
    const name = document.createElement("a");
    name.href = api.attachments.rawUrl(a.id);
    name.target = "_blank";
    name.rel = "noopener";
    name.textContent = a.original_name;
    name.className = "att-name";
    item.appendChild(name);
    const size = document.createElement("span");
    size.className = "muted att-size";
    size.textContent = formatBytes(a.size_bytes);
    item.appendChild(size);
    const del = document.createElement("button");
    del.className = "btn btn-sm btn-ghost";
    del.textContent = "✕";
    del.setAttribute("aria-label", `Delete ${a.original_name}`);
    del.addEventListener("click", () => removeAttachment(a.id));
    item.appendChild(del);
    list.appendChild(item);
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadAttachment(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const errEl = document.getElementById("att-error");
  errEl.hidden = true;
  try {
    await api.attachments.upload(state.projectId, state.task.id, file);
    e.target.value = "";
    await loadAttachments();
  } catch (err) {
    errEl.textContent = err.message || "Upload failed.";
    errEl.hidden = false;
  }
}

async function removeAttachment(id) {
  try {
    await api.attachments.remove(id);
    await loadAttachments();
  } catch (err) {
    console.error("delete attachment failed", err);
  }
}

async function loadComments() {
  if (!state.task) return;
  try {
    const rows = await api.comments.list(state.projectId, state.task.id);
    renderComments(rows);
  } catch (err) {
    console.error("comments load failed", err);
  }
}

function renderComments(rows) {
  const list = document.getElementById("comment-list");
  document.querySelector('[data-testid="comment-count"]').textContent = `(${rows.length})`;
  list.replaceChildren();
  for (const c of rows) {
    const item = document.createElement("article");
    item.className = "comment-item";
    item.dataset.testid = "comment-item";
    item.innerHTML = `
      <header class="comment-item__header">
        <span class="muted" style="font-size: var(--font-xs)">${new Date(c.created_at).toLocaleString()}</span>
      </header>
      <div class="markdown">${c.body_html}</div>
    `;
    list.appendChild(item);
  }
}

async function postComment() {
  if (!state.task) return;
  const ta = document.getElementById("comment-body");
  const errEl = document.getElementById("comment-error");
  errEl.hidden = true;
  const body_md = ta.value.trim();
  if (!body_md) {
    errEl.textContent = "Comment cannot be empty.";
    errEl.hidden = false;
    return;
  }
  try {
    await api.comments.create(state.projectId, state.task.id, body_md);
    ta.value = "";
    await loadComments();
  } catch (err) {
    errEl.textContent = err.message || "Couldn't post comment.";
    errEl.hidden = false;
  }
}

// Project board (V1 Priority-first — see SDD §3.10).
// Renders 4 columns, fetches tasks, opens task drawer + new-task dialog,
// drag & drop with keyboard fallback, and toggleable activity drawer.

import { ApiError, api } from "./api.js";
import * as activity from "./activity.js";
import * as dnd from "./dnd.js";
import * as drawer from "./drawer.js";

const COLUMNS = [
  { id: "backlog", name: "Backlog" },
  { id: "todo", name: "Todo" },
  { id: "inprogress", name: "In progress" },
  { id: "done", name: "Done" },
];

const KIND_LETTER = { task: "T", bug: "B", proposal: "P" };

const main = document.getElementById("board-main");
const projectId = main.dataset.projectId;
const ownInitials = main.dataset.currentUserInitials;
const liveRegion = document.getElementById("kbd-live");

const state = {
  tasks: [],
  filterMine: false,
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

function announce(msg) {
  liveRegion.textContent = msg;
}

function renderEmptyColumn(column) {
  const empty = document.createElement("p");
  empty.className = "muted column-empty";
  empty.textContent = column.id === "backlog" ? "No tasks yet." : "—";
  return empty;
}

function isP0(task) {
  return task.priority === "P0";
}

function renderTask(task) {
  const tpl = document.getElementById("task-card-template");
  const card = tpl.content.firstElementChild.cloneNode(true);
  card.dataset.taskId = task.id;
  card.dataset.kind = task.kind;
  if (task.priority) card.dataset.priority = task.priority;
  if (isP0(task) && task.kind === "bug") {
    card.classList.add("task-card--p0-bug");
  }

  const kind = card.querySelector(".kind-badge");
  kind.classList.add(`kind-${task.kind}`);
  kind.textContent = KIND_LETTER[task.kind] || "?";

  const prio = card.querySelector(".priority-chip");
  if (task.priority && task.priority !== "P3") {
    prio.textContent = task.priority;
    prio.classList.add(`priority-${task.priority}`);
    prio.removeAttribute("hidden");
  }

  const title = card.querySelector(".task-card__title");
  title.textContent = task.title;

  const assignees = card.querySelector(".task-card__assignees");
  if (task.assignees?.length) {
    const pile = document.createElement("span");
    pile.className = "avatar-pile";
    for (const userId of task.assignees.slice(0, 3)) {
      const a = document.createElement("span");
      a.className = "avatar avatar-sm";
      a.dataset.userId = userId;
      a.textContent = "?";  // initials TBD when project members lookup lands
      pile.appendChild(a);
    }
    if (task.assignees.length > 3) {
      const extra = document.createElement("span");
      extra.className = "avatar avatar-sm avatar-extra";
      extra.textContent = `+${task.assignees.length - 3}`;
      pile.appendChild(extra);
    }
    assignees.replaceChildren(pile);
  }

  card.setAttribute(
    "aria-label",
    `${task.kind} ${task.priority || ""} ${task.title}`.trim(),
  );
  dnd.decorateCard(card);
  card.addEventListener("click", () => openTaskDrawer(task));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      openTaskDrawer(task);
    }
  });

  return card;
}

function openTaskDrawer(task) {
  drawer.open({
    projectId,
    task,
    onChange: ({ moved, deleted }) => {
      if (deleted) state.tasks = state.tasks.filter((t) => t.id !== deleted);
      if (moved) state.tasks = state.tasks.map((t) => (t.id === moved.id ? moved : t));
      renderBoard();
    },
  });
}

function dimUnassigned(card, task) {
  // V1 Priority-first: when "Mine" is active, deemphasize cards I'm not on.
  const mine = task.assignees?.length === 0
    ? false
    : true; // placeholder: backend doesn't yet expose "is current user in assignees"
  // Because the API response only carries UUIDs and we don't pre-fetch /me here,
  // we treat "no assignees" as "definitely not mine". Refinement when /me is wired.
  card.classList.toggle("task-card--dim", state.filterMine && !mine);
  void ownInitials; // kept for the upcoming initials lookup
}

function renderBoard() {
  const board = document.getElementById("board");
  board.removeAttribute("aria-busy");
  const frag = document.createDocumentFragment();

  for (const column of COLUMNS) {
    const tpl = document.getElementById("column-template");
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.columnId = column.id;
    node.setAttribute("aria-label", `${column.name} column`);
    node.querySelector(".column-name").textContent = column.name;

    const tasksHere = state.tasks.filter((t) => t.column === column.id);
    node.querySelector(".column-count").textContent = String(tasksHere.length);

    const list = node.querySelector(".column-list");
    list.setAttribute("aria-label", `${column.name} tasks`);
    if (tasksHere.length === 0) {
      list.appendChild(renderEmptyColumn(column));
    } else {
      for (const task of tasksHere) {
        const card = renderTask(task);
        dimUnassigned(card, task);
        list.appendChild(card);
      }
    }

    node.querySelector(".column-add").addEventListener("click", () => {
      openCreateDialog(column.id);
    });

    frag.appendChild(node);
  }

  board.replaceChildren(frag);
}

async function loadTasks() {
  try {
    const resp = await api.request(`/projects/${projectId}/tasks`);
    state.tasks = resp.items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      window.location.href = "/login";
      return;
    }
    const board = document.getElementById("board");
    board.innerHTML = `<p class="banner banner-error" role="alert">Couldn&rsquo;t load board: ${escapeHtml(err.message)}</p>`;
    return;
  }
  renderBoard();
}

// ---------- New-task dialog ----------

function openCreateDialog(columnPreset) {
  const dlg = document.getElementById("new-task-dialog");
  document.getElementById("nt-error").hidden = true;
  document.getElementById("nt-title").value = "";
  document.getElementById("nt-column").value = columnPreset || "backlog";
  document.getElementById("nt-priority").value = "P2";
  document.getElementById("nt-task").checked = true;
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
  setTimeout(() => document.getElementById("nt-title").focus(), 10);
}

function closeCreateDialog() {
  const dlg = document.getElementById("new-task-dialog");
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

async function submitCreate() {
  const title = document.getElementById("nt-title").value.trim();
  const errEl = document.getElementById("nt-error");
  errEl.hidden = true;
  if (!title) {
    errEl.textContent = "Title is required.";
    errEl.hidden = false;
    return;
  }
  const kind = document.querySelector('input[name="nt-kind"]:checked').value;
  const column = document.getElementById("nt-column").value;
  const priority = document.getElementById("nt-priority").value || null;

  try {
    const created = await api.request(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: { title, kind, column, priority },
    });
    state.tasks = [...state.tasks, created];
    renderBoard();
    closeCreateDialog();
    announce(`Task "${created.title}" created in ${created.column}.`);
  } catch (err) {
    errEl.textContent = err.message || "Couldn't create task.";
    errEl.hidden = false;
  }
}

// ---------- Filters ----------

function toggleMine() {
  const btn = document.getElementById("filter-mine");
  state.filterMine = !state.filterMine;
  btn.setAttribute("aria-pressed", String(state.filterMine));
  btn.classList.toggle("btn-primary", state.filterMine);
  renderBoard();
}

// ---------- Init ----------

function init() {
  document.getElementById("new-task-btn").addEventListener("click", () => openCreateDialog());
  document.getElementById("nt-submit").addEventListener("click", submitCreate);
  document
    .querySelector('#new-task-dialog [data-action="close"]')
    .addEventListener("click", closeCreateDialog);
  document.getElementById("nt-title").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitCreate();
  });

  document.getElementById("filter-mine").addEventListener("click", toggleMine);
  document.getElementById("activity-toggle").addEventListener("click", activity.toggle);

  const board = document.getElementById("board");
  dnd.attach({
    projectId,
    boardEl: board,
    liveRegion,
    getTasks: () => state.tasks,
    onMove: (updated) => {
      state.tasks = state.tasks.map((t) => (t.id === updated.id ? updated : t));
      renderBoard();
    },
  });

  activity.start({ projectId });

  document.addEventListener("keydown", (e) => {
    // ⌘N / Ctrl+N opens the new-task dialog. Skip when typing in an input.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      openCreateDialog();
    }
  });

  loadTasks();
}

init();

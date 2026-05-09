// Drag & drop with keyboard fallback (SDD §3.7 a11y P0).
//
// Mouse: HTML5 native draggable.
// Keyboard: Space lifts the card; Arrow keys move; Space drops; Esc cancels.
// All position changes go through api.tasks.move; the caller's onMove callback
// is invoked with the updated task so the board can rerender.

import { api } from "./api.js";

const COLUMNS = ["backlog", "todo", "inprogress", "done"];

const state = {
  projectId: null,
  liveRegion: null,
  liftedCard: null,
  liftedTask: null,
  onMove: null,
};

function announce(msg) {
  if (state.liveRegion) state.liveRegion.textContent = msg;
}

function findCardAndTask(target, tasks) {
  const card = target?.closest?.(".task-card[data-task-id]");
  if (!card) return [null, null];
  const id = card.dataset.taskId;
  const task = tasks.find((t) => t.id === id) || null;
  return [card, task];
}

function neighbourTasks(tasks, column, taskId) {
  const inCol = tasks
    .filter((t) => t.column === column && t.id !== taskId)
    .sort((a, b) => a.position - b.position);
  return inCol;
}

async function moveTo({ tasks, taskId, column, idx }) {
  // idx = 0 → top; idx = N → bottom; otherwise insert between idx-1 and idx.
  const others = neighbourTasks(tasks, column, taskId);
  let after = null;
  let before = null;
  if (idx > 0) after = others[idx - 1]?.id ?? null;
  if (idx < others.length) before = others[idx]?.id ?? null;
  return api.tasks.move(state.projectId, taskId, {
    column,
    after_task_id: after,
    before_task_id: before,
  });
}

// ---------- mouse DnD ----------

function onDragStart(e) {
  const card = e.target.closest?.(".task-card[data-task-id]");
  if (!card) return;
  card.classList.add("task-card--dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", card.dataset.taskId);
}

function onDragEnd(e) {
  const card = e.target.closest?.(".task-card[data-task-id]");
  if (card) card.classList.remove("task-card--dragging");
  document.querySelectorAll(".column-list--over").forEach((el) =>
    el.classList.remove("column-list--over")
  );
}

function onDragOver(e) {
  const list = e.target.closest?.(".column-list");
  if (!list) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  list.classList.add("column-list--over");
}

function onDragLeave(e) {
  const list = e.target.closest?.(".column-list");
  list?.classList.remove("column-list--over");
}

async function onDrop(e, getTasks) {
  const list = e.target.closest?.(".column-list");
  if (!list) return;
  e.preventDefault();
  const taskId = e.dataTransfer.getData("text/plain");
  const column = list.closest(".column").dataset.columnId;
  if (!taskId || !column) return;

  // Compute insertion index by Y-coord against existing children.
  const others = [...list.querySelectorAll(".task-card[data-task-id]")].filter(
    (el) => el.dataset.taskId !== taskId
  );
  let idx = others.length;
  for (let i = 0; i < others.length; i++) {
    const r = others[i].getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) { idx = i; break; }
  }

  try {
    const updated = await moveTo({ tasks: getTasks(), taskId, column, idx });
    state.onMove?.(updated);
  } catch (err) {
    announce(`Couldn't move: ${err.message || "error"}`);
  } finally {
    document.querySelectorAll(".column-list--over").forEach((el) =>
      el.classList.remove("column-list--over")
    );
  }
}

// ---------- keyboard ----------

async function onKeydown(e, getTasks) {
  // ESC cancels lift
  if (state.liftedCard && e.key === "Escape") {
    e.preventDefault();
    state.liftedCard.classList.remove("task-card--lifted");
    state.liftedCard.setAttribute("aria-grabbed", "false");
    announce(`Cancelled. ${state.liftedTask.title} stays in ${state.liftedTask.column}.`);
    state.liftedCard = null;
    state.liftedTask = null;
    return;
  }

  // SPACE on a focused card: lift, or drop if already lifted
  if (e.key === " ") {
    const tasks = getTasks();
    if (!state.liftedCard) {
      const [card, task] = findCardAndTask(document.activeElement, tasks);
      if (!card) return;
      e.preventDefault();
      card.classList.add("task-card--lifted");
      card.setAttribute("aria-grabbed", "true");
      state.liftedCard = card;
      state.liftedTask = task;
      announce(`Lifted ${task.title}. Use arrow keys to move, space to drop, escape to cancel.`);
    } else {
      // Drop at current position (already moved by arrow keys).
      e.preventDefault();
      state.liftedCard.classList.remove("task-card--lifted");
      state.liftedCard.setAttribute("aria-grabbed", "false");
      announce(`Dropped ${state.liftedTask.title} in ${state.liftedTask.column}.`);
      state.liftedCard.focus();
      state.liftedCard = null;
      state.liftedTask = null;
    }
    return;
  }

  // While lifted, arrow keys move the card
  if (state.liftedCard && state.liftedTask) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      const tasks = getTasks();
      const t = state.liftedTask;
      let newColumn = t.column;
      let direction = 0;
      if (e.key === "ArrowLeft") {
        const i = COLUMNS.indexOf(t.column);
        if (i > 0) newColumn = COLUMNS[i - 1];
      } else if (e.key === "ArrowRight") {
        const i = COLUMNS.indexOf(t.column);
        if (i < COLUMNS.length - 1) newColumn = COLUMNS[i + 1];
      } else if (e.key === "ArrowUp") {
        direction = -1;
      } else if (e.key === "ArrowDown") {
        direction = +1;
      }

      let idx;
      if (newColumn !== t.column) {
        idx = 0; // top of new column
      } else {
        const others = neighbourTasks(tasks, t.column, t.id);
        const currentIdx = others.findIndex((o) => o.position > t.position);
        const cur = currentIdx === -1 ? others.length : currentIdx;
        idx = Math.max(0, Math.min(others.length, cur + direction));
      }
      try {
        const updated = await moveTo({ tasks, taskId: t.id, column: newColumn, idx });
        state.liftedTask = updated;
        announce(`Moved to ${updated.column}.`);
        state.onMove?.(updated);
        // Re-focus the (possibly recreated) card after the rerender finishes.
        requestAnimationFrame(() => {
          const newCard = document.querySelector(`.task-card[data-task-id="${updated.id}"]`);
          if (newCard) {
            newCard.classList.add("task-card--lifted");
            newCard.setAttribute("aria-grabbed", "true");
            newCard.focus();
            state.liftedCard = newCard;
          }
        });
      } catch (err) {
        announce(`Couldn't move: ${err.message || "error"}`);
      }
    }
  }
}

export function attach({ projectId, boardEl, liveRegion, getTasks, onMove }) {
  state.projectId = projectId;
  state.liveRegion = liveRegion;
  state.onMove = onMove;

  boardEl.addEventListener("dragstart", onDragStart);
  boardEl.addEventListener("dragend", onDragEnd);
  boardEl.addEventListener("dragover", onDragOver);
  boardEl.addEventListener("dragleave", onDragLeave);
  boardEl.addEventListener("drop", (e) => onDrop(e, getTasks));

  document.addEventListener("keydown", (e) => onKeydown(e, getTasks));
}

export function decorateCard(card) {
  card.draggable = true;
  card.setAttribute("aria-grabbed", "false");
}

// Activity drawer with polling (SDD §3.10 + §6).
// Right-side drawer toggleable from the topbar; polls every 8s and announces
// new events to a polite aria-live region.

import { api } from "./api.js";

const POLL_INTERVAL_MS = 8000;

const state = {
  projectId: null,
  open: false,
  events: [],
  timer: null,
  newest: null, // ISO timestamp of the most-recently-known event
};

function ensureRoot() {
  let aside = document.getElementById("activity-drawer");
  if (aside) return aside;
  aside = document.createElement("aside");
  aside.id = "activity-drawer";
  aside.className = "drawer drawer--right activity-drawer";
  aside.setAttribute("role", "complementary");
  aside.setAttribute("aria-label", "Activity feed");
  aside.dataset.testid = "activity-drawer";
  aside.hidden = true;
  aside.innerHTML = `
    <header class="drawer-header">
      <strong>Activity</strong>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" data-action="close" aria-label="Close activity drawer">✕</button>
    </header>
    <div class="drawer-body">
      <ol id="activity-list" class="activity-list" aria-live="polite" aria-relevant="additions"></ol>
    </div>
  `;
  document.body.appendChild(aside);
  aside.querySelector('[data-action="close"]').addEventListener("click", toggle);
  return aside;
}

function describe(event) {
  const kind = event.kind;
  const p = event.payload || {};
  switch (kind) {
    case "task.created": return `Created ${p.kind || "task"} "${p.title || ""}" in ${p.column || "?"}`;
    case "task.updated": return `Updated task`;
    case "task.moved": return `Moved task ${p.from?.column ?? "?"} → ${p.to?.column ?? "?"}`;
    case "task.deleted": return `Deleted a task`;
    case "comment.created": return `Commented on a task`;
    case "comment.updated": return `Edited a comment`;
    case "comment.deleted": return `Deleted a comment`;
    case "attachment.uploaded": return `Attached "${p.name || "file"}"`;
    case "attachment.deleted": return `Removed attachment "${p.name || ""}"`;
    case "member.added": return `Added member ${p.email || ""}`;
    case "member.role_changed": return `Changed member role to ${p.role || ""}`;
    case "member.removed": return p.self ? `Left the project` : `Removed a member`;
    case "team.created": return `Created team "${p.name || ""}"`;
    case "team.updated": return `Updated team`;
    case "team.deleted": return `Deleted a team`;
    case "project.created": return `Created project "${p.name || p.slug || ""}"`;
    case "project.updated": return `Updated project settings`;
    case "project.deleted": return `Deleted the project`;
    default: return kind;
  }
}

function renderEvents() {
  const list = document.getElementById("activity-list");
  if (!list) return;
  list.replaceChildren();
  for (const e of state.events) {
    const li = document.createElement("li");
    li.className = "activity-item";
    li.dataset.testid = "activity-item";
    li.innerHTML = `
      <span class="activity-dot" aria-hidden="true"></span>
      <div>
        <div class="activity-text">${describe(e)}</div>
        <time class="activity-time muted" datetime="${e.created_at}">${new Date(e.created_at).toLocaleString()}</time>
      </div>
    `;
    list.appendChild(li);
  }
}

async function poll() {
  if (!state.projectId) return;
  try {
    const resp = await api.activity.list(state.projectId, { limit: 50 });
    const newOnes = resp.items.filter((e) => !state.newest || e.created_at > state.newest);
    if (newOnes.length > 0) {
      state.events = resp.items;
      state.newest = resp.items[0]?.created_at || state.newest;
      if (state.open) renderEvents();
    }
  } catch (err) {
    // Silent — polling shouldn't surface UI errors.
    console.warn("activity poll failed", err);
  }
}

export function toggle() {
  ensureRoot();
  state.open = !state.open;
  const aside = document.getElementById("activity-drawer");
  aside.hidden = !state.open;
  if (state.open) renderEvents();
}

export function start({ projectId }) {
  state.projectId = projectId;
  poll();
  state.timer = setInterval(poll, POLL_INTERVAL_MS);
}

export function stop() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

// Members page (V1 Bulk admin — see SDD §3.10).
// Search + role filter + checkboxes + sticky bulk actions + last-owner protection.

import { ApiError, api } from "./api.js";

const main = document.getElementById("members-main");
const projectId = main.dataset.projectId;
const yourUserId = main.dataset.yourUserId;
const isOwner = main.dataset.yourRole === "owner";

const state = {
  members: [],
  selected: new Set(),
  query: "",
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function ownerCount() {
  return state.members.filter((m) => m.role === "owner").length;
}

function isLastOwner(m) {
  return m.role === "owner" && ownerCount() <= 1;
}

function filteredMembers() {
  const q = state.query.toLowerCase();
  if (!q) return state.members;
  return state.members.filter(
    (m) => (m.name || "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
  );
}

function renderRow(m) {
  const row = document.createElement("article");
  row.className = "list-row";
  row.dataset.testid = "member-row";
  row.dataset.userId = m.user_id;

  if (isOwner) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.selected.has(m.user_id);
    cb.disabled = isLastOwner(m);
    cb.setAttribute("aria-label", `Select ${m.name || m.email}`);
    cb.addEventListener("change", () => {
      if (cb.checked) state.selected.add(m.user_id);
      else state.selected.delete(m.user_id);
      renderBulk();
    });
    row.appendChild(cb);
  }

  const initials = (m.name || m.email).slice(0, 2).toUpperCase();
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = initials;
  avatar.setAttribute("aria-hidden", "true");
  row.appendChild(avatar);

  const grow = document.createElement("div");
  grow.className = "grow";
  const isYou = m.user_id === yourUserId;
  grow.innerHTML = `
    <div><strong>${escapeHtml(m.name || m.email)}</strong>${isYou ? ' <span class="muted">(you)</span>' : ""}</div>
    <div class="muted" style="font-size: var(--font-xs)">${escapeHtml(m.email)}</div>
  `;
  row.appendChild(grow);

  const tag = document.createElement("span");
  tag.className = `role-tag ${m.role === "owner" ? "owner" : m.role}`;
  tag.textContent = m.role;
  row.appendChild(tag);

  if (isOwner) {
    const sel = document.createElement("select");
    sel.className = "input input-sm";
    sel.setAttribute("aria-label", `Change role for ${m.name || m.email}`);
    for (const r of ["owner", "editor", "viewer"]) {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      if (r === m.role) opt.selected = true;
      // Last-owner protection at the dropdown level.
      if (m.role === "owner" && r !== "owner" && isLastOwner(m)) opt.disabled = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", async () => {
      try {
        await api.members.changeRole(projectId, m.user_id, sel.value);
        await load();
      } catch (err) {
        alert(err.message || "Couldn't change role.");
        sel.value = m.role;
      }
    });
    row.appendChild(sel);
  }

  if (isOwner || isYou) {
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-sm" + (isYou ? "" : " btn-danger");
    removeBtn.textContent = isYou ? "Leave" : "Remove";
    removeBtn.disabled = isLastOwner(m);
    if (removeBtn.disabled) {
      removeBtn.title = "Promote another member to owner first.";
    }
    removeBtn.addEventListener("click", async () => {
      if (!window.confirm(isYou ? "Leave this project?" : `Remove ${m.name || m.email}?`)) return;
      try {
        await api.members.remove(projectId, m.user_id);
        if (isYou) window.location.href = "/";
        else await load();
      } catch (err) {
        alert(err.message || "Couldn't remove.");
      }
    });
    row.appendChild(removeBtn);
  }

  return row;
}

function renderBulk() {
  const bar = document.getElementById("bulk-actions");
  bar.hidden = state.selected.size === 0;
  document.getElementById("bulk-count").textContent = String(state.selected.size);
}

function render() {
  const list = document.getElementById("member-list");
  list.removeAttribute("aria-busy");
  list.replaceChildren();
  const rows = filteredMembers();
  for (const m of rows) list.appendChild(renderRow(m));

  const summary = document.getElementById("member-summary");
  const totalOwners = ownerCount();
  const totalEditors = state.members.filter((m) => m.role === "editor").length;
  const totalViewers = state.members.filter((m) => m.role === "viewer").length;
  summary.textContent = `${state.members.length} members · ${totalOwners} owner${totalOwners !== 1 ? "s" : ""}, ${totalEditors} editor${totalEditors !== 1 ? "s" : ""}, ${totalViewers} viewer${totalViewers !== 1 ? "s" : ""}.`;

  renderBulk();
}

async function load() {
  try {
    state.members = await api.members.list(projectId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      window.location.href = "/login";
      return;
    }
    document.getElementById("member-list").innerHTML =
      `<p class="banner banner-error" role="alert">Couldn't load members: ${escapeHtml(err.message)}</p>`;
    return;
  }
  // Drop selections that no longer exist
  const ids = new Set(state.members.map((m) => m.user_id));
  for (const id of [...state.selected]) if (!ids.has(id)) state.selected.delete(id);
  render();
}

// ---------- Invite dialog ----------

function openInvite() {
  const dlg = document.getElementById("invite-dialog");
  document.getElementById("invite-error").hidden = true;
  document.getElementById("invite-email").value = "";
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
}
function closeInvite() {
  const dlg = document.getElementById("invite-dialog");
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}
async function submitInvite() {
  const email = document.getElementById("invite-email").value.trim();
  const role = document.getElementById("invite-role").value;
  const errEl = document.getElementById("invite-error");
  errEl.hidden = true;
  if (!email) {
    errEl.textContent = "Email is required.";
    errEl.hidden = false;
    return;
  }
  try {
    await api.members.invite(projectId, email, role);
    closeInvite();
    await load();
  } catch (err) {
    errEl.textContent = err.message || "Couldn't invite.";
    errEl.hidden = false;
  }
}

// ---------- Bulk actions ----------

async function bulkChangeRole(role) {
  for (const id of state.selected) {
    if (id === yourUserId && role !== "owner" && state.members.find((m) => m.user_id === id)?.role === "owner" && ownerCount() <= 1) continue;
    try { await api.members.changeRole(projectId, id, role); } catch { /* skip failures */ }
  }
  state.selected.clear();
  await load();
}

async function bulkRemove() {
  if (!window.confirm(`Remove ${state.selected.size} member(s)?`)) return;
  for (const id of state.selected) {
    try { await api.members.remove(projectId, id); } catch { /* skip failures */ }
  }
  state.selected.clear();
  await load();
}

function init() {
  document.getElementById("invite-btn").addEventListener("click", openInvite);
  document.getElementById("invite-submit").addEventListener("click", submitInvite);
  document.querySelector('#invite-dialog [data-action="close"]').addEventListener("click", closeInvite);
  document.getElementById("member-search").addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });
  if (isOwner) {
    document.getElementById("bulk-make-editor").addEventListener("click", () => bulkChangeRole("editor"));
    document.getElementById("bulk-make-viewer").addEventListener("click", () => bulkChangeRole("viewer"));
    document.getElementById("bulk-remove").addEventListener("click", bulkRemove);
  }
  load();
}

init();

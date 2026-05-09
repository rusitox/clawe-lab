// API tokens settings (V2 Security-first — see SDD §3.10).
// List active + revoked, create with one-time plaintext reveal, revoke confirm.

import { ApiError, api } from "./api.js";

const state = { tokens: [] };

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function formatRel(ts) {
  if (!ts) return "never";
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function renderRow(t) {
  const row = document.createElement("article");
  row.className = "list-row";
  row.dataset.testid = "token-row";
  row.dataset.tokenId = t.id;
  if (t.revoked_at) row.classList.add("muted");

  const grow = document.createElement("div");
  grow.className = "grow";
  const lastUsed = t.last_used_at ? `last used ${formatRel(t.last_used_at)}` : "never used";
  const status = t.revoked_at
    ? `<strong class="muted">revoked ${formatRel(t.revoked_at)}</strong>`
    : "";
  grow.innerHTML = `
    <div><strong>${escapeHtml(t.name)}</strong> ${status}</div>
    <div class="muted" style="font-size: var(--font-xs); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
      ${escapeHtml(t.prefix)}…  ·  created ${formatRel(t.created_at)}  ·  ${lastUsed}
    </div>
  `;
  row.appendChild(grow);

  if (!t.revoked_at) {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-danger";
    btn.textContent = "Revoke";
    btn.dataset.testid = "token-revoke";
    btn.addEventListener("click", () => revoke(t));
    row.appendChild(btn);
  }
  return row;
}

function render() {
  const list = document.getElementById("tokens-list");
  list.removeAttribute("aria-busy");
  list.replaceChildren();
  const active = state.tokens.filter((t) => !t.revoked_at);
  const revoked = state.tokens.filter((t) => t.revoked_at);

  if (active.length === 0 && revoked.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No tokens yet. Click “+ New token” to create one.";
    list.appendChild(empty);
    return;
  }

  if (active.length > 0) {
    const h = document.createElement("h3");
    h.className = "muted";
    h.style.fontSize = "var(--font-xs)";
    h.style.textTransform = "uppercase";
    h.textContent = `Active (${active.length})`;
    list.appendChild(h);
    for (const t of active) list.appendChild(renderRow(t));
  }
  if (revoked.length > 0) {
    const h = document.createElement("h3");
    h.className = "muted";
    h.style.fontSize = "var(--font-xs)";
    h.style.textTransform = "uppercase";
    h.style.marginTop = "var(--space-6)";
    h.textContent = `Revoked (${revoked.length})`;
    list.appendChild(h);
    for (const t of revoked) list.appendChild(renderRow(t));
  }
}

async function load() {
  try {
    state.tokens = await api.tokens.list();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      window.location.href = "/login";
      return;
    }
    document.getElementById("tokens-list").innerHTML =
      `<p class="banner banner-error" role="alert">Couldn't load tokens: ${escapeHtml(err.message)}</p>`;
    return;
  }
  render();
}

async function revoke(t) {
  if (!window.confirm(`Revoke ${t.name}? Any automation using it will start failing immediately. This cannot be undone.`)) return;
  try {
    await api.tokens.revoke(t.id);
    await load();
  } catch (err) {
    alert(err.message || "Couldn't revoke.");
  }
}

// ---------- Create + reveal ----------

function openCreate() {
  const dlg = document.getElementById("new-token-dialog");
  document.getElementById("nt-error").hidden = true;
  document.getElementById("nt-name").value = "";
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
}
function closeCreate() {
  const dlg = document.getElementById("new-token-dialog");
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

async function submitCreate() {
  const name = document.getElementById("nt-name").value.trim();
  const errEl = document.getElementById("nt-error");
  errEl.hidden = true;
  if (!name) {
    errEl.textContent = "Name is required.";
    errEl.hidden = false;
    return;
  }
  try {
    const created = await api.tokens.create(name);
    closeCreate();
    showReveal(created.plaintext);
    await load();
  } catch (err) {
    errEl.textContent = err.message || "Couldn't create token.";
    errEl.hidden = false;
  }
}

function showReveal(plaintext) {
  const dlg = document.getElementById("token-reveal-dialog");
  document.getElementById("token-plain").textContent = plaintext;
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
}

function closeReveal() {
  const dlg = document.getElementById("token-reveal-dialog");
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

async function copyPlain() {
  const text = document.getElementById("token-plain").textContent;
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById("token-copy");
    const orig = btn.textContent;
    btn.textContent = "✓ Copied";
    setTimeout(() => (btn.textContent = orig), 1500);
  } catch {
    /* clipboard unavailable */
  }
}

function init() {
  document.getElementById("new-token-btn").addEventListener("click", openCreate);
  document.getElementById("nt-create").addEventListener("click", submitCreate);
  document.querySelector('#new-token-dialog [data-action="close"]').addEventListener("click", closeCreate);
  document.getElementById("token-copy").addEventListener("click", copyPlain);
  document.getElementById("token-done").addEventListener("click", closeReveal);
  load();
}

init();

// Project list page (V3 Productivity dashboard — see SDD §3.10).
// Fetches /api/v2/projects, renders cards with mini-board health hints,
// supports sort tabs, search filter, and inline "+ New project" dialog.

import { ApiError, api } from "./api.js";

const COLUMN_KEYS = ["backlog", "todo", "inprogress", "done"];

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function relativeTime(ts) {
  if (!ts) return "no activity yet";
  const then = new Date(ts).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return `active ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `no activity in ${days}d`;
  return `no activity in 30d+`;
}

function miniBoardSegments(project) {
  // Placeholder: until we wire per-project counts, derive a stable pseudo-distribution
  // from the slug so cards have meaningful, non-random shapes.
  // V3 Productivity dashboard uses these to communicate health (red In progress = trouble).
  const seed = Array.from(project.slug || "").reduce((a, c) => a + c.charCodeAt(0), 0);
  const counts = COLUMN_KEYS.map((_, i) => ((seed >> (i * 2)) & 0b111) + 1);
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((c, i) => ({
    column: COLUMN_KEYS[i],
    weight: c / total,
    trouble: i === 2 && c >= 6, // a heavy "In progress" lane is the trouble signal
  }));
}

function renderMiniBoard(el, segments) {
  el.innerHTML = "";
  for (const seg of segments) {
    const bar = document.createElement("span");
    bar.className = `mini-bar mini-bar--${seg.column}` + (seg.trouble ? " mini-bar--trouble" : "");
    bar.style.flexGrow = String(Math.max(seg.weight, 0.05));
    el.appendChild(bar);
  }
}

function renderProjectCard(project) {
  const tpl = document.getElementById("project-card-template");
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.setAttribute("href", `/p/${encodeURIComponent(project.slug)}`);
  node.dataset.testid = "project-card";
  node.dataset.slug = project.slug;
  node.querySelector(".project-card__name").textContent = project.name;
  const role = node.querySelector(".role-tag");
  // Until project-list returns role per project, default to owner of created ones.
  // /api/v2/projects only returns ProjectPublic — role enrichment is a follow-up.
  role.remove();
  renderMiniBoard(node.querySelector(".mini-board"), miniBoardSegments(project));
  node.querySelector(".project-card__meta").textContent =
    `Updated ${new Date(project.updated_at).toLocaleDateString()}`;
  node.querySelector(".project-card__activity").textContent = relativeTime(project.updated_at);
  return node;
}

function renderEmpty(grid) {
  const tpl = document.getElementById("empty-state-template");
  grid.replaceChildren(tpl.content.firstElementChild.cloneNode(true));
  grid.querySelector('[data-action="open-create"]').addEventListener("click", openCreateDialog);
}

function applySortAndFilter(projects, { sort, query }) {
  let rows = [...projects];
  if (query) {
    const q = query.toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q));
  }
  if (sort === "alpha") {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "assigned") {
    // Placeholder: backend will surface "where I'm assigned" later.
    rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  } else {
    rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }
  return rows;
}

const state = {
  projects: [],
  sort: "recent",
  query: "",
};

function render() {
  const grid = document.getElementById("project-grid");
  grid.removeAttribute("aria-busy");
  if (state.projects.length === 0) {
    renderEmpty(grid);
    return;
  }
  const filtered = applySortAndFilter(state.projects, state);
  if (filtered.length === 0) {
    grid.innerHTML = `<p class="muted">No projects match &ldquo;${escapeHtml(state.query)}&rdquo;.</p>`;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const p of filtered) frag.appendChild(renderProjectCard(p));
  grid.replaceChildren(frag);
}

async function load() {
  try {
    state.projects = await api.request("/projects");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      window.location.href = "/login";
      return;
    }
    const grid = document.getElementById("project-grid");
    grid.innerHTML = `<p class="banner banner-error" role="alert">Couldn&rsquo;t load projects: ${escapeHtml(err.message)}</p>`;
    return;
  }
  render();
}

function openCreateDialog() {
  const dlg = document.getElementById("new-project-dialog");
  document.getElementById("np-error").hidden = true;
  document.getElementById("np-name").value = "";
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
  setTimeout(() => document.getElementById("np-name").focus(), 10);
}

function closeCreateDialog() {
  const dlg = document.getElementById("new-project-dialog");
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

async function submitCreate(event) {
  if (event) event.preventDefault();
  const input = document.getElementById("np-name");
  const name = input.value.trim();
  const errEl = document.getElementById("np-error");
  errEl.hidden = true;
  if (!name) {
    errEl.textContent = "Name is required.";
    errEl.hidden = false;
    return;
  }
  try {
    const created = await api.request("/projects", { method: "POST", body: { name } });
    state.projects = [created, ...state.projects];
    render();
    closeCreateDialog();
  } catch (err) {
    errEl.textContent = err.message || "Couldn't create project.";
    errEl.hidden = false;
  }
}

function init() {
  document.querySelectorAll(".sort-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".sort-tab").forEach((t) => t.setAttribute("aria-selected", "false"));
      tab.setAttribute("aria-selected", "true");
      state.sort = tab.dataset.sort;
      render();
    });
  });

  document.getElementById("project-search").addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });

  document.getElementById("new-project-btn").addEventListener("click", openCreateDialog);
  document.getElementById("np-submit").addEventListener("click", submitCreate);
  document.getElementById("new-project-form").addEventListener("submit", submitCreate);
  document.getElementById("np-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitCreate(e);
  });
  document
    .querySelector('#new-project-dialog [data-action="close"]')
    .addEventListener("click", closeCreateDialog);

  load();
}

init();

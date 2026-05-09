// Preview-only interactions. Production frontend lives in static/js (Phase 5).
(() => {
  const KEY = "kanban-preview-theme";
  const html = document.documentElement;

  const stored = localStorage.getItem(KEY);
  if (stored) html.dataset.theme = stored;

  const toggle = document.createElement("button");
  toggle.className = "theme-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Toggle theme");
  const render = () => {
    const dark = html.dataset.theme === "dark";
    toggle.textContent = dark ? "☾ dark" : "☀ light";
  };
  toggle.addEventListener("click", () => {
    const next = html.dataset.theme === "dark" ? "light" : "dark";
    html.dataset.theme = next;
    localStorage.setItem(KEY, next);
    render();
  });
  render();
  document.body.appendChild(toggle);
})();

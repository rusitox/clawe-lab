// Settings page — auto-archive configuration.
// Reads projectId from the page, validates input, calls PATCH /api/v2/projects/{id}.

import { api } from "./api.js";

const main       = document.getElementById("settings-main");
const projectId  = main.dataset.projectId;
const input      = document.getElementById("auto-archive-days");
const saveBtn    = document.getElementById("settings-save");
const successEl  = document.getElementById("settings-success");
const errorEl    = document.getElementById("settings-error");

let successTimer = null;

saveBtn.addEventListener("click", async () => {
  successEl.hidden = true;
  errorEl.hidden = true;

  const raw = input.value.trim();
  const val = parseInt(raw, 10);

  if (raw === "" || isNaN(val) || val < 0 || val > 365) {
    errorEl.textContent = "Enter a number between 0 and 365.";
    errorEl.hidden = false;
    input.focus();
    return;
  }

  saveBtn.setAttribute("aria-busy", "true");
  saveBtn.disabled = true;

  try {
    await api.projects.update(projectId, { auto_archive_days: val });
    input.dataset.original = String(val);

    if (successTimer !== null) clearTimeout(successTimer);
    successEl.hidden = false;
    successTimer = setTimeout(() => { successEl.hidden = true; }, 3000);
  } catch (err) {
    errorEl.textContent = err.message || "Could not save settings. Try again.";
    errorEl.hidden = false;
  } finally {
    saveBtn.removeAttribute("aria-busy");
    saveBtn.disabled = false;
  }
});

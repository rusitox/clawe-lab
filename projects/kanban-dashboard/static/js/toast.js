// Shared toast notification utility.
// Exports: showToast(message, { undoCallback, durationMs } = {})
//
// Creates (or reuses) a single .toast element in document.body.
// role="status" + aria-live="polite" announces to screen readers without
// interrupting the user's current reading flow.
//
// If undoCallback is provided, an "Undo" button appears; clicking it calls the
// callback and hides the toast immediately.
//
// Auto-dismisses after durationMs (default 8000 ms).
// Respects prefers-reduced-motion by skipping opacity transitions.

const DURATION_DEFAULT = 8000;

let toastEl = null;
let dismissTimer = null;

function getOrCreateToast() {
  if (toastEl) return toastEl;

  toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.setAttribute("role", "status");
  toastEl.setAttribute("aria-live", "polite");
  toastEl.hidden = true;
  document.body.appendChild(toastEl);
  return toastEl;
}

export function showToast(message, { undoCallback, durationMs = DURATION_DEFAULT } = {}) {
  const el = getOrCreateToast();

  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  // Build inner content using DOM nodes — no innerHTML with user data.
  const msgSpan = document.createElement("span");
  msgSpan.textContent = message;

  el.replaceChildren(msgSpan);

  if (undoCallback) {
    const undoBtn = document.createElement("button");
    undoBtn.className = "toast__undo";
    undoBtn.textContent = "Undo";
    undoBtn.addEventListener("click", () => {
      undoCallback();
      hideToast(el);
    });
    el.appendChild(undoBtn);
  }

  el.hidden = false;

  dismissTimer = setTimeout(() => hideToast(el), durationMs);
}

function hideToast(el) {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    el.hidden = true;
    return;
  }

  // Fade out via opacity, then hide.
  el.style.opacity = "0";
  el.addEventListener(
    "transitionend",
    () => {
      el.hidden = true;
      el.style.opacity = "";
    },
    { once: true },
  );
}

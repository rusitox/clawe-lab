#!/usr/bin/env python3
"""Lightweight Kanban reconciler for OpenClaw.

- Uses local kanban-dashboard/tasks.json as source of truth (URL may be unreachable from the agent).
- Detects changes since last run (sha256 snapshot).
- Produces a short text summary.
- Flags CRITICAL when the dashboard state is likely unusable (cannot read/parse tasks, or server port not listening).

Outputs a JSON object to stdout:
  { "level": "ok|info|critical", "summary": "...", "details": {...} }
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import time
from pathlib import Path

WORKSPACE = Path("/home/ubuntu/.openclaw/workspace")
TASKS_PATH = WORKSPACE / "kanban-dashboard" / "tasks.json"
STATE_PATH = WORKSPACE / "memory" / "kanban-reconcile-state.json"


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def check_port_8787_listening() -> bool:
    # Best-effort: if ss is available, check if something is listening on :8787.
    try:
        p = subprocess.run(["bash", "-lc", "ss -ltn | awk '{print $4}' | grep -q ':8787$'"], check=False)
        return p.returncode == 0
    except Exception:
        return False


def main() -> int:
    now_s = int(time.time())

    state = load_state()
    last_sha = state.get("tasksSha256")

    if not TASKS_PATH.exists():
        out = {
            "level": "critical",
            "summary": f"CRITICAL: tasks.json no existe en {TASKS_PATH}",
            "details": {"tasksPath": str(TASKS_PATH)},
        }
        print(json.dumps(out, ensure_ascii=False))
        return 2

    try:
        raw = TASKS_PATH.read_bytes()
        cur_sha = sha256_bytes(raw)
        data = json.loads(raw.decode("utf-8"))
        tasks = data.get("tasks", [])
    except Exception as e:
        out = {
            "level": "critical",
            "summary": f"CRITICAL: no pude leer/parsear tasks.json ({e})",
            "details": {"tasksPath": str(TASKS_PATH)},
        }
        print(json.dumps(out, ensure_ascii=False))
        return 2

    # Columns used by the dashboard UI
    # NOTE: the UI uses "inprogress" (not "inProgress").
    counts = {"backlog": 0, "todo": 0, "inprogress": 0, "review": 0, "done": 0, "blocked": 0}
    critical_open = []

    for t in tasks:
        c = t.get("col")
        if c in counts:
            counts[c] += 1

        # Critical convention: any non-done task whose title contains "[CRITICAL]" (case-insensitive)
        title = (t.get("title") or "").strip()
        if c != "done" and "[critical]" in title.lower():
            critical_open.append({"id": t.get("id"), "title": title, "col": c, "prio": t.get("prio")})

    changed = (last_sha is not None and cur_sha != last_sha)

    # Determine if the board is likely down (heuristic)
    listening = check_port_8787_listening()

    level = "ok"
    if changed:
        level = "info"

    # Escalate to CRITICAL if board health is broken or there are open critical tasks
    if not listening:
        # Not always critical (maybe not running intentionally), but per Rusitox rule:
        # if the board becomes unusable, treat as critical.
        level = "critical"
    if critical_open:
        level = "critical"

    summary_bits = []
    if not listening:
        summary_bits.append("CRITICAL: Kanban server no está escuchando en :8787")
    if critical_open:
        summary_bits.append(f"CRITICAL: hay {len(critical_open)} tarea(s) marcadas [CRITICAL] abiertas")
    if changed:
        summary_bits.append("Cambios detectados en tasks.json")

    summary_bits.append(
        f"Counts: Backlog {counts['backlog']} / To-do {counts['todo']} / In progress {counts['inprogress']} / Review {counts['review']} / Done {counts['done']} / Blocked {counts['blocked']}"
    )

    out = {
        "level": level,
        "summary": " | ".join(summary_bits),
        "details": {
            "tasksSha256": cur_sha,
            "changed": changed,
            "listening8787": listening,
            "counts": counts,
            "criticalOpen": critical_open,
            "ts": now_s,
        },
    }

    # Persist state
    state.update({"tasksSha256": cur_sha, "lastRun": now_s})
    save_state(state)

    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

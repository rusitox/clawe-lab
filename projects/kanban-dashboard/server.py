#!/usr/bin/env python3
"""Simple Kanban server

- Serves static files from this directory
- Persists tasks in tasks.json (server-side) so it works across devices
- API:
  - GET  /api/tasks
  - PUT  /api/tasks   (requires ?token=... or X-Kanban-Token header)
  - GET  /api/activity
  - POST /api/activity (requires token)

Security: do NOT expose this to the public internet without a strong token.
"""

from __future__ import annotations

import json
import os
import threading
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(HERE, "tasks.json")
ACTIVITY_PATH = os.path.join(HERE, "activity.json")
TEAMS_PATH = os.path.join(HERE, "teams.json")
LOCK = threading.Lock()

TOKEN = os.environ.get("KANBAN_TOKEN", "").strip()  # empty means read-only


def _read_tasks():
    if not os.path.exists(DATA_PATH):
        return {"version": 1, "tasks": []}
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_tasks(data):
    tmp = DATA_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_PATH)


def _read_activity():
    if not os.path.exists(ACTIVITY_PATH):
        return {"version": 1, "events": []}
    with open(ACTIVITY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_activity(data):
    tmp = ACTIVITY_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, ACTIVITY_PATH)


def _read_teams():
    if not os.path.exists(TEAMS_PATH):
        return {"version": 1, "teams": {"General": {"color": "#00d1ff"}, "Engineering": {"color": "#7c5cff"}}}
    with open(TEAMS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_teams(data):
    tmp = TEAMS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, TEAMS_PATH)


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # CORS so you can open from phones etc.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Kanban-Token")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/tasks"):
            with LOCK:
                data = _read_tasks()
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path.startswith("/api/activity"):
            with LOCK:
                data = _read_activity()
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path.startswith("/api/teams"):
            with LOCK:
                data = _read_teams()
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        return super().do_GET()

    def _get_token(self):
        # header wins, then query param
        h = self.headers.get("X-Kanban-Token", "").strip()
        if h:
            return h
        q = parse_qs(urlparse(self.path).query)
        return (q.get("token", [""])[0] or "").strip()

    def do_PUT(self):
        if self.path.startswith("/api/tasks"):
            return self._put_tasks()
        if self.path.startswith("/api/teams"):
            return self._put_teams()
        self.send_error(HTTPStatus.NOT_FOUND)
        return

    def _put_tasks(self):

        if not TOKEN:
            self.send_error(HTTPStatus.FORBIDDEN, "Server is read-only (KANBAN_TOKEN not set)")
            return

        if self._get_token() != TOKEN:
            self.send_error(HTTPStatus.UNAUTHORIZED, "Bad token")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return

        if not isinstance(data, dict) or "tasks" not in data or not isinstance(data.get("tasks"), list):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid schema")
            return

        data["version"] = 1

        with LOCK:
            _write_tasks(data)

        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def _put_teams(self):
        if not TOKEN:
            self.send_error(HTTPStatus.FORBIDDEN, "Server is read-only (KANBAN_TOKEN not set)")
            return

        if self._get_token() != TOKEN:
            self.send_error(HTTPStatus.UNAUTHORIZED, "Bad token")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return

        if not isinstance(data, dict) or not isinstance(data.get("teams"), dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid schema")
            return

        # sanitize: only allow known teams + color
        teams_in = data.get("teams", {})
        teams_out = {}
        for name in ("General", "Engineering"):
            t = teams_in.get(name) or {}
            color = str(t.get("color") or "").strip()
            if not color.startswith("#") or len(color) not in (4, 7):
                # default
                color = "#00d1ff" if name == "General" else "#7c5cff"
            teams_out[name] = {"color": color}

        out = {"version": 1, "teams": teams_out}

        with LOCK:
            _write_teams(out)

        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_POST(self):
        if not self.path.startswith("/api/activity"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        if not TOKEN:
            self.send_error(HTTPStatus.FORBIDDEN, "Server is read-only (KANBAN_TOKEN not set)")
            return

        if self._get_token() != TOKEN:
            self.send_error(HTTPStatus.UNAUTHORIZED, "Bad token")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            ev = json.loads(raw.decode("utf-8"))
        except Exception:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return

        if not isinstance(ev, dict) or not ev.get("text"):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid schema")
            return

        import time

        ev_out = {
            "ts": int(ev.get("ts") or 0) or int(time.time() * 1000),
            "agent": str(ev.get("agent") or "unknown"),
            "type": str(ev.get("type") or "info"),
            "text": str(ev.get("text") or "")[:4000],
        }

        with LOCK:
            data = _read_activity()
            if not isinstance(data, dict) or not isinstance(data.get("events"), list):
                data = {"version": 1, "events": []}
            data["version"] = 1
            data["events"].append(ev_out)
            data["events"] = data["events"][-500:]
            _write_activity(data)

        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()


def main():
    port = int(os.environ.get("PORT", "8787"))
    host = os.environ.get("HOST", "0.0.0.0")
    os.chdir(HERE)
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Kanban server on http://{host}:{port} (data: {DATA_PATH})")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

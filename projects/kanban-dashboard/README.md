# Clawe Kanban Dashboard (v1)

Dashboard web simple (tipo Kanban) para visualizar y gestionar tareas de Clawe por equipos/agentes.

## Features

- Columnas: Backlog / To‑do / In progress / Done
- Drag & drop entre columnas
- Persistencia **server-side**: `tasks.json`
- Activity feed **auto-update**: `/api/activity`
- Filtros globales: Equipo (General/Engineering) + Agente
  - Los filtros aplican al feed y al Kanban
- Colores por equipo configurables: `teams.json` (+ pickers en UI)
- Export/Import JSON (cliente)

## Run

```bash
cd projects/kanban-dashboard
export KANBAN_TOKEN='(token largo)'
python3 server.py
```

Abrí:

- `http://<host>:8787`

## API

- `GET /api/tasks` / `PUT /api/tasks` (requiere `X-Kanban-Token`)
- `GET /api/activity` / `POST /api/activity` (requiere `X-Kanban-Token`)
- `GET /api/teams` / `PUT /api/teams` (requiere `X-Kanban-Token`)

## Data files

- `tasks.json` — estado del kanban
- `activity.json` — feed de actividad (últimos ~500 eventos)
- `teams.json` — colores por equipo

> Nota: No commitear tokens/secretos. El token del server se pasa por env var `KANBAN_TOKEN`.

---

## v2 dev setup (work in progress)

v2 is the multi-tenant redesign. See `specs/sdd-kanban-v2.md` for the full spec.

### Prereqs

- Python ≥ 3.11
- Docker (for the Postgres dev container)

### Quick start

```bash
# 1. Install Python deps (creates an editable install with dev extras)
make install

# 2. Start Postgres (localhost:5433, db=kanban, user=kanban)
make db-up

# 3. Apply migrations
make migrate

# 4. Copy env defaults
cp .env.example .env

# 5. Run the dev server
make dev          # uvicorn on http://127.0.0.1:8787

# 6. Health check
curl http://127.0.0.1:8787/api/health
# {"ok": true, "version": "2.0.0a0", "db": "up"}
```

### Test suite

```bash
make test         # pytest, requires `make db-up` first
make lint         # ruff (+ eslint if node_modules present)
make typecheck    # mypy
```

The pytest suite creates a separate database (`kanban_test`) on first run.

### Migrations

```bash
make migrate                                  # apply all pending
make migrate-new msg="add tasks table"        # create a new revision
```

### v1 still works

The legacy `python3 server.py` flow (single-tenant JSON) continues to work for
OpenClaw scripts during the soft cut. v2 lives at `/api/v2/*` and reuses the same
host port behind the reverse proxy in production.

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

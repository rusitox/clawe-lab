#!/usr/bin/env python3
"""v1 → v2 migration — see SDD §5 Phase 6.

Reads tasks.json / activity.json / teams.json (v1 single-tenant JSON store)
and loads them into a single project named "Clawe HQ" (configurable). The
script is idempotent: re-runs match v1 records by their `legacy_id` (stored
in `task.labels` and `activity.payload`) and update them in place.

The owner of the imported project is the user whose email is passed via
`--owner-email`. The user must already exist (sign in via Google or
test-bypass first); we don't fabricate users from JSON.

Usage:
    python scripts/import_v1.py \\
      --tasks-json tasks.json \\
      --activity-json activity.json \\
      --teams-json teams.json \\
      --owner-email you@example.com \\
      --project-name "Clawe HQ"
"""
from __future__ import annotations

import argparse
import json
import logging
import re
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from server.db import SessionLocal
from server.markdown import render as render_markdown
from server.models.activity import ActivityEvent
from server.models.project import Project, ProjectMember
from server.models.task import (
    TASK_COLUMNS,
    TASK_KINDS,
    TASK_PRIORITIES,
    Task,
)
from server.models.team import Team
from server.models.user import User

logger = logging.getLogger("import_v1")

DEFAULT_PROJECT_NAME = "Clawe HQ"
LEGACY_LABEL_PREFIX = "legacy:"
LEGACY_ACTIVITY_KIND = "v1.imported"


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:120] or "project"


def _epoch_ms_to_dt(value: Any) -> datetime:
    if not value:
        return datetime.now(UTC)
    try:
        return datetime.fromtimestamp(int(value) / 1000, tz=UTC)
    except (TypeError, ValueError, OverflowError, OSError):
        return datetime.now(UTC)


def _normalize_kind(raw: str | None) -> str:
    if raw and raw.lower() in TASK_KINDS:
        return raw.lower()
    return "task"


def _normalize_column(raw: str | None) -> str:
    if not raw:
        return "backlog"
    raw = raw.lower().replace(" ", "")
    aliases = {"todo": "todo", "to-do": "todo", "in-progress": "inprogress", "inprogress": "inprogress"}
    raw = aliases.get(raw, raw)
    return raw if raw in TASK_COLUMNS else "backlog"


def _normalize_priority(raw: str | None) -> str | None:
    if raw and raw.upper() in TASK_PRIORITIES:
        return raw.upper()
    return None


def get_or_create_project(db: Session, name: str, owner: User) -> Project:
    slug = _slugify(name)
    project = db.execute(
        select(Project).where(Project.slug == slug, Project.deleted_at.is_(None))
    ).scalar_one_or_none()
    if project is None:
        project = Project(slug=slug, name=name, created_by=owner.id)
        db.add(project)
        db.flush()
        db.add(ProjectMember(project_id=project.id, user_id=owner.id, role="owner"))
        db.add(
            ActivityEvent(
                project_id=project.id,
                user_id=owner.id,
                kind="project.created",
                target_type="project",
                target_id=project.id,
                payload={"name": project.name, "slug": project.slug, "imported_from": "v1"},
            )
        )
        logger.info("created project %s (%s)", project.name, project.id)
    else:
        logger.info("reusing existing project %s (%s)", project.name, project.id)
    db.commit()
    return project


def upsert_teams(db: Session, project: Project, teams_json: dict[str, Any]) -> dict[str, UUID]:
    teams_map = teams_json.get("teams", {}) or {}
    by_name: dict[str, UUID] = {}
    for name, payload in teams_map.items():
        color = (payload or {}).get("color") or "#5b6477"
        existing = db.execute(
            select(Team).where(Team.project_id == project.id, Team.name == name)
        ).scalar_one_or_none()
        if existing is None:
            team = Team(project_id=project.id, name=name, color=color)
            db.add(team)
            db.flush()
            by_name[name] = team.id
            logger.info("imported team %r → %s", name, team.id)
        else:
            existing.color = color
            by_name[name] = existing.id
    db.commit()
    return by_name


def _legacy_label(legacy_id: str) -> str:
    return f"{LEGACY_LABEL_PREFIX}{legacy_id}"


def _find_existing_task_by_legacy(
    db: Session, project_id: UUID, legacy_id: str
) -> Task | None:
    return db.execute(
        select(Task)
        .where(Task.project_id == project_id, Task.deleted_at.is_(None))
        .where(Task.labels.contains([_legacy_label(legacy_id)]))
    ).scalar_one_or_none()


def _next_position(db: Session, project_id: UUID, column: str) -> float:
    from sqlalchemy import func
    current_max = db.execute(
        select(func.max(Task.position)).where(
            Task.project_id == project_id,
            Task.column == column,
            Task.deleted_at.is_(None),
        )
    ).scalar()
    return (current_max or 0.0) + 1.0


def upsert_tasks(
    db: Session,
    project: Project,
    owner: User,
    tasks_json: dict[str, Any],
    teams_by_name: dict[str, UUID],
) -> tuple[int, int]:
    """Returns (created, updated) counts."""
    rows = tasks_json.get("tasks", []) or []
    created = updated = 0
    for raw in rows:
        legacy_id = str(raw.get("id") or "").strip()
        if not legacy_id:
            continue
        title = (raw.get("title") or "").strip() or "Untitled"
        desc_md = (raw.get("desc") or "").strip()
        column = _normalize_column(raw.get("col"))
        priority = _normalize_priority(raw.get("prio"))
        team_name = (raw.get("team") or "").strip()
        team_id = teams_by_name.get(team_name) if team_name else None
        kind = _normalize_kind(raw.get("kind"))

        existing = _find_existing_task_by_legacy(db, project.id, legacy_id)
        if existing is None:
            labels = [_legacy_label(legacy_id)]
            agent = (raw.get("agent") or "").strip()
            if agent:
                labels.append(f"agent:{agent.lower()}")
            task = Task(
                project_id=project.id,
                kind=kind,
                column=column,
                position=_next_position(db, project.id, column),
                priority=priority,
                team_id=team_id,
                title=title[:255],
                description_md=desc_md,
                description_html=render_markdown(desc_md),
                labels=labels,
                created_by=owner.id,
                created_at=_epoch_ms_to_dt(raw.get("createdAt")),
                updated_at=_epoch_ms_to_dt(raw.get("updatedAt")),
            )
            db.add(task)
            db.flush()
            db.add(
                ActivityEvent(
                    project_id=project.id,
                    user_id=owner.id,
                    kind=LEGACY_ACTIVITY_KIND,
                    target_type="task",
                    target_id=task.id,
                    payload={"legacy_id": legacy_id, "title": title},
                    created_at=task.created_at,
                )
            )
            created += 1
        else:
            existing.title = title[:255]
            existing.description_md = desc_md
            existing.description_html = render_markdown(desc_md)
            existing.column = column
            existing.priority = priority
            existing.team_id = team_id
            existing.kind = kind
            existing.updated_at = _epoch_ms_to_dt(raw.get("updatedAt"))
            updated += 1
    db.commit()
    return created, updated


def upsert_activity(
    db: Session,
    project: Project,
    activity_json: dict[str, Any],
) -> int:
    events = activity_json.get("events", []) or []
    inserted = 0
    for raw in events:
        ts = _epoch_ms_to_dt(raw.get("ts"))
        agent = (raw.get("agent") or "system").strip()
        # Idempotency key for v1 events: (ts ISO) + agent + text hash.
        text = (raw.get("text") or "").strip()
        key = f"{ts.isoformat()}|{agent}|{text}"
        already = db.execute(
            select(ActivityEvent)
            .where(ActivityEvent.project_id == project.id)
            .where(ActivityEvent.kind == "v1.legacy_event")
            .where(ActivityEvent.payload["key"].astext == key)
        ).scalar_one_or_none()
        if already is not None:
            continue
        db.add(
            ActivityEvent(
                project_id=project.id,
                user_id=None,
                kind="v1.legacy_event",
                target_type="legacy",
                target_id=None,
                payload={
                    "ts_ms": raw.get("ts"),
                    "agent": agent,
                    "type": raw.get("type") or "info",
                    "text": text,
                    "key": key,
                },
                created_at=ts,
            )
        )
        inserted += 1
    db.commit()
    return inserted


def run(
    *,
    owner_email: str,
    project_name: str,
    tasks_path: Path | None,
    activity_path: Path | None,
    teams_path: Path | None,
    db_session_factory: Callable[[], Session] = SessionLocal,
) -> dict[str, int | str]:
    db = db_session_factory()
    try:
        owner = db.execute(select(User).where(User.email == owner_email)).scalar_one_or_none()
        if owner is None:
            raise SystemExit(
                f"Owner not found: {owner_email}. Sign in (Google or test-bypass) first."
            )

        project = get_or_create_project(db, project_name, owner)

        teams_json = json.loads(teams_path.read_text()) if teams_path else {}
        teams_by_name = upsert_teams(db, project, teams_json)

        tasks_json = json.loads(tasks_path.read_text()) if tasks_path else {}
        created, updated = upsert_tasks(db, project, owner, tasks_json, teams_by_name)

        activity_json = json.loads(activity_path.read_text()) if activity_path else {}
        activity_inserted = upsert_activity(db, project, activity_json)

        result: dict[str, int | str] = {
            "project_id": str(project.id),
            "project_slug": project.slug,
            "teams": len(teams_by_name),
            "tasks_created": created,
            "tasks_updated": updated,
            "activity_inserted": activity_inserted,
        }
        return result
    finally:
        db.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner-email", required=True)
    parser.add_argument("--project-name", default=DEFAULT_PROJECT_NAME)
    parser.add_argument("--tasks-json", type=Path, default=Path("tasks.json"))
    parser.add_argument("--activity-json", type=Path, default=Path("activity.json"))
    parser.add_argument("--teams-json", type=Path, default=Path("teams.json"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.dry_run:
        for label, p in [("tasks", args.tasks_json), ("activity", args.activity_json), ("teams", args.teams_json)]:
            if p and p.exists():
                content = json.loads(p.read_text())
                if label == "tasks":
                    n = len(content.get("tasks", []))
                elif label == "activity":
                    n = len(content.get("events", []))
                else:
                    n = len(content.get("teams", {}))
                logger.info("dry-run: %s would import %d records from %s", label, n, p)
            else:
                logger.info("dry-run: %s file %s missing", label, p)
        return 0

    result = run(
        owner_email=args.owner_email,
        project_name=args.project_name,
        tasks_path=args.tasks_json if args.tasks_json.exists() else None,
        activity_path=args.activity_json if args.activity_json.exists() else None,
        teams_path=args.teams_json if args.teams_json.exists() else None,
    )
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

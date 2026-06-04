"""board enhancements — verification column, archived_at, auto_archive_days

Revision ID: 0003_board_enhancements
Revises: 0002_initial_schema
Create Date: 2026-06-03
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_board_enhancements"
down_revision = "0002_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop the existing 4-value column CHECK constraint (brief ACCESS EXCLUSIVE lock).
    op.drop_constraint("ck_tasks_column", "tasks", type_="check")

    # 2. Recreate it with the 5-value set using NOT VALID to skip the full-table scan.
    op.create_check_constraint(
        "ck_tasks_column",
        "tasks",
        "\"column\" IN ('backlog','todo','inprogress','verification','done')",
        postgresql_not_valid=True,
    )

    # 3. Validate the constraint (fast — all existing rows have valid column values).
    op.execute("ALTER TABLE tasks VALIDATE CONSTRAINT ck_tasks_column")

    # 4. Add tasks.archived_at column.
    op.add_column(
        "tasks",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 5. Create partial index on (project_id, archived_at) for the archive view query.
    op.create_index(
        "ix_tasks_archived_at",
        "tasks",
        ["project_id", "archived_at"],
        postgresql_where=sa.text("archived_at IS NOT NULL"),
    )

    # 6. Add projects.auto_archive_days column.
    op.add_column(
        "projects",
        sa.Column("auto_archive_days", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    # Reverse steps 6 → 1.

    # 6. Drop projects.auto_archive_days.
    op.drop_column("projects", "auto_archive_days")

    # 5. Drop partial index.
    op.drop_index("ix_tasks_archived_at", table_name="tasks")

    # 4. Drop tasks.archived_at.
    op.drop_column("tasks", "archived_at")

    # 3+2. Drop the 5-value constraint and recreate the original 4-value one.
    op.drop_constraint("ck_tasks_column", "tasks", type_="check")

    op.create_check_constraint(
        "ck_tasks_column",
        "tasks",
        "\"column\" IN ('backlog','todo','inprogress','done')",
    )

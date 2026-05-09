.PHONY: help install db-up db-down dev test lint typecheck migrate migrate-new e2e e2e-update e2e-install image compose-up compose-down clean

PYTHON ?= python3
UVICORN_HOST ?= 127.0.0.1
UVICORN_PORT ?= 8787
IMAGE_TAG ?= openclaw-kanban-v2:local

help:
	@echo "Targets:"
	@echo "  install       Install Python deps (editable + dev extras) into local .venv"
	@echo "  db-up         Start Postgres in docker-compose.dev.yml (port 5433)"
	@echo "  db-down       Stop the dev Postgres"
	@echo "  migrate       Apply Alembic migrations against DATABASE_URL"
	@echo "  migrate-new   Create a new revision (msg=...)"
	@echo "  dev           Run uvicorn with reload (fast iteration loop)"
	@echo "  test          Run pytest"
	@echo "  lint          ruff + eslint"
	@echo "  typecheck     mypy"
	@echo "  e2e           Run Playwright e2e + visual"
	@echo "  e2e-install   First-time Playwright + chromium install"
	@echo "  e2e-update    Refresh Playwright golden screenshots (CI/Linux only)"
	@echo "  image         docker build the production image as $(IMAGE_TAG)"
	@echo "  compose-up    Bring up the prod-shape stack locally (docker-compose.prod.yml)"
	@echo "  compose-down  Tear it down + remove volumes"
	@echo "  clean         Remove caches and build output"

install:
	$(PYTHON) -m pip install -e ".[dev]"

db-up:
	docker compose -f docker-compose.dev.yml up -d
	@echo "Postgres on localhost:5433 (user=kanban, db=kanban)"

db-down:
	docker compose -f docker-compose.dev.yml down

migrate:
	alembic upgrade head

migrate-new:
	@if [ -z "$(msg)" ]; then echo 'Usage: make migrate-new msg="describe change"'; exit 1; fi
	alembic revision --autogenerate -m "$(msg)"

dev:
	uvicorn server.main:app --host $(UVICORN_HOST) --port $(UVICORN_PORT) --reload

test:
	pytest

lint:
	ruff check .
	@if [ -d node_modules ]; then npx eslint static/js 2>/dev/null || true; fi

typecheck:
	mypy server

e2e-install:
	npm install
	npx playwright install --with-deps chromium

e2e:
	npx playwright test

e2e-update:
	npx playwright test --update-snapshots

image:
	docker build --tag $(IMAGE_TAG) .

compose-up:
	docker compose -f docker-compose.prod.yml up -d
	@echo "App on http://127.0.0.1:8787 (when healthy: docker ps)"

compose-down:
	docker compose -f docker-compose.prod.yml down -v

clean:
	rm -rf .ruff_cache .mypy_cache .pytest_cache htmlcov coverage.xml dist build
	find . -type d -name __pycache__ -prune -exec rm -rf {} +

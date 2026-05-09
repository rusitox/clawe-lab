---
globs:
  - "**/*.py"
---

# Python Conventions

- Type hints for all function parameters and return types (mypy must pass).
- Use `dataclass` or `pydantic.BaseModel` for data structures.
- Prefer f-strings over `.format()` or `%` formatting.
- Use `pathlib.Path` instead of `os.path` for file operations.
- All exceptions must be specific — never bare `except:` or `except Exception:` without re-raising.
- Use the `logging` module, not `print()`, for any production code path.
- Async functions use `async/await`, not threading for I/O (current `server.py` uses
  threading because of `ThreadingHTTPServer` — keep that pattern unless an SDD migrates the stack).
- PEP 8 naming: `snake_case` functions/variables, `PascalCase` classes, `UPPER_SNAKE` constants.
- Use `__all__` in `__init__.py` to control public API.
- Parameterize all SQL — never `f"SELECT ... {user_input}"`.
- Multi-tenant scope (`project_id`) is mandatory on every tenant-owned query.

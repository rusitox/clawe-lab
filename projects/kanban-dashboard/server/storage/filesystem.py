"""Filesystem implementation of StorageBackend.

Files live under `<attachments_dir>/<aa>/<bb>/<storage_key>` where the first
4 chars of the key are used as a 2-level fan-out to keep directories small.
Storage keys are opaque random strings — never user-supplied.
"""
from __future__ import annotations

import secrets
from collections.abc import Iterator
from pathlib import Path
from typing import BinaryIO

from server.config import get_settings
from server.storage.base import FileTooLargeError, StoredFile

CHUNK = 64 * 1024


class FilesystemStorage:
    def __init__(self, root: Path) -> None:
        self._root = root
        self._root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, storage_key: str) -> Path:
        return self._root / storage_key[:2] / storage_key[2:4] / storage_key

    def store(self, *, fileobj: BinaryIO, max_bytes: int) -> StoredFile:
        key = secrets.token_urlsafe(32)
        path = self._path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        size = 0
        with path.open("wb") as out:
            while True:
                chunk = fileobj.read(CHUNK)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    out.close()
                    path.unlink(missing_ok=True)
                    raise FileTooLargeError(
                        f"Upload exceeds {max_bytes} bytes (read {size})."
                    )
                out.write(chunk)
        return StoredFile(storage_key=key, size_bytes=size)

    def open_stream(self, storage_key: str) -> Iterator[bytes]:
        path = self._path_for(storage_key)
        if not path.exists():
            return
        with path.open("rb") as fh:
            while True:
                chunk = fh.read(CHUNK)
                if not chunk:
                    return
                yield chunk

    def delete(self, storage_key: str) -> None:
        path = self._path_for(storage_key)
        path.unlink(missing_ok=True)


_default: FilesystemStorage | None = None


def get_default_storage() -> FilesystemStorage:
    global _default
    if _default is None:
        settings = get_settings()
        _default = FilesystemStorage(Path(settings.attachments_dir))
    return _default

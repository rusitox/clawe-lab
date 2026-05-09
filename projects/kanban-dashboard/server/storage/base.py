"""Storage backend Protocol — see SDD §4 A8.

Filesystem implementation in `filesystem.py`; S3-compatible can plug in later
without changing the API surface.
"""
from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import BinaryIO, Protocol


@dataclass(frozen=True, slots=True)
class StoredFile:
    storage_key: str
    size_bytes: int


class StorageBackend(Protocol):
    def store(self, *, fileobj: BinaryIO, max_bytes: int) -> StoredFile:
        """Read up to `max_bytes` from fileobj and persist. Return key + size.

        Raises:
            FileTooLargeError: if the upload exceeds `max_bytes`.
        """
        ...

    def open_stream(self, storage_key: str) -> Iterator[bytes]:
        """Yield bytes for streaming responses."""
        ...

    def delete(self, storage_key: str) -> None:
        """Remove the underlying object. Idempotent."""
        ...


class FileTooLargeError(Exception):
    pass

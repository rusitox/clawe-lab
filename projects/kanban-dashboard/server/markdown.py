"""Server-side markdown rendering — see SDD §3.7 / §4 A7.

API returns BOTH the raw markdown and a pre-sanitized HTML, so the frontend
never executes a markdown parser. The sanitizer allow-list is intentionally
small (no <script>, no javascript: URLs, no inline event handlers).
"""
from __future__ import annotations

import bleach
from markdown_it import MarkdownIt

_md = MarkdownIt("commonmark", {"html": False, "linkify": True, "typographer": False})
_md.enable(["table", "strikethrough"])

ALLOWED_TAGS = [
    "p", "br", "hr",
    "a", "em", "strong", "code", "kbd", "del", "s", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "pre",
    "table", "thead", "tbody", "tr", "th", "td",
    "img",
]
ALLOWED_ATTRS = {
    "a": ["href", "title", "rel"],
    "img": ["src", "alt", "title", "loading"],
    "code": ["class"],
    "th": ["align"],
    "td": ["align"],
}
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]

_cleaner = bleach.Cleaner(
    tags=ALLOWED_TAGS,
    attributes=ALLOWED_ATTRS,
    protocols=ALLOWED_PROTOCOLS,
    strip=True,
    strip_comments=True,
)
_linker = bleach.Linker(callbacks=[bleach.callbacks.nofollow], skip_tags=["pre", "code"])


def render(md_source: str | None) -> str:
    """Render markdown to safe HTML. Empty input returns empty string."""
    if not md_source:
        return ""
    raw = _md.render(md_source)
    safe = _cleaner.clean(raw)
    out: str = _linker.linkify(safe)
    return out

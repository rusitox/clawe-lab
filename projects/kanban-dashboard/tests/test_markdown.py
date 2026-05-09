"""Markdown rendering safety tests (SDD §4 A7 + §3.7 a11y)."""
from __future__ import annotations

import pytest

from server.markdown import render


def test_basic_markdown_renders() -> None:
    html = render("**bold** and `code`")
    assert "<strong>bold</strong>" in html
    assert "<code>code</code>" in html


def test_empty_input() -> None:
    assert render("") == ""
    assert render(None) == ""


def test_xss_script_tag_stripped() -> None:
    html = render("Hello <script>alert('xss')</script> world")
    assert "<script" not in html
    assert "alert" not in html or "&lt;script" in html


def test_xss_javascript_url_stripped() -> None:
    html = render("[click me](javascript:alert(1))")
    # markdown-it rejects the javascript: scheme — there must NOT be a clickable
    # <a href="javascript:..."> in the output. The literal text may remain visible.
    assert 'href="javascript:' not in html.lower()
    assert "<a " not in html.lower() or 'href="javascript' not in html.lower()


def test_xss_inline_event_handler_stripped() -> None:
    # CommonMark with html=False escapes raw HTML into text, so the resulting
    # markup shows the source as literal characters (harmless). What matters:
    # no actual <img> tag with an event-handler attribute makes it into the DOM.
    html = render('<img src=x onerror="alert(1)">')
    assert "<img" not in html.lower()
    # The string is HTML-escaped: `<` is `&lt;`, so any "onerror" you see is
    # inside a text node, not an attribute.
    assert "&lt;img" in html.lower()


def test_links_get_nofollow() -> None:
    html = render("[home](https://example.com)")
    assert 'href="https://example.com"' in html
    assert 'rel="nofollow"' in html


def test_lists_and_headings() -> None:
    html = render("# Title\n\n- one\n- two\n")
    assert "<h1>" in html and "Title" in html
    assert "<ul>" in html
    assert "<li>one</li>" in html


@pytest.mark.parametrize(
    "payload",
    [
        '<iframe src="https://evil"></iframe>',
        '<object data="x"></object>',
        '<style>body { display: none; }</style>',
    ],
)
def test_dangerous_tags_stripped(payload: str) -> None:
    html = render(payload)
    for tag in ("iframe", "object", "style"):
        assert f"<{tag}" not in html.lower()

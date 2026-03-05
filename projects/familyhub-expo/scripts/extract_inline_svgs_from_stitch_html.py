#!/usr/bin/env python3
"""Extract inline <svg>...</svg> blocks from a Stitch-exported HTML downloadUrl.

Usage:
  python3 scripts/extract_inline_svgs_from_stitch_html.py \
    --url '<htmlCode.downloadUrl>' \
    --out src/assets/stitch/loginInlineSvgs.ts \
    --prefix loginSvgXml

Notes:
- Adds simple retry/backoff to avoid Stitch 429 (Too Many Requests).
- Outputs TS constants with template literals (backticks escaped).
"""

import argparse
import os
import re
import sys
import time
import urllib.request


def fetch(url: str, retries: int = 10, base_sleep: float = 2.0) -> str:
    last_err = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            last_err = e
            time.sleep(base_sleep * (i + 1))
    raise RuntimeError(f"failed to fetch after {retries} retries: {last_err}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--prefix", required=True)
    args = ap.parse_args()

    # Stitch download URLs can intermittently rate-limit (HTTP 429) or serve an HTML interstitial.
    # If we fetch successfully but no SVGs are present, retry a few times with backoff.
    html = None
    for i in range(6):
        html = fetch(args.url)
        svgs = re.findall(r"(<svg\b[\s\S]*?</svg>)", html, flags=re.I)
        if svgs:
            break
        # Heuristic: detect rate-limit/interstitial content
        low = (html or "").lower()
        if "too many requests" in low or "429" in low or "captcha" in low:
            time.sleep(2 * (i + 1))
            continue
        # Not rate limit, genuinely no SVG
        break

    svgs = re.findall(r"(<svg\b[\s\S]*?</svg>)", html or "", flags=re.I)
    if not svgs:
        preview = (html or "").strip().replace("\n", " ")[:220]
        print(f"No inline SVG found. html preview: {preview}", file=sys.stderr)
        sys.exit(2)

    out_path = args.out
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("// Auto-extracted from Stitch HTML export\n")
        f.write(f"// Source: {args.url}\n")
        for idx, svg in enumerate(svgs, start=1):
            svg = svg.strip().replace("`", "\\`")
            f.write(f"export const {args.prefix}_{idx} = `" + svg + "`;\n")

    print(f"Extracted {len(svgs)} SVG(s) -> {out_path}")


if __name__ == "__main__":
    main()

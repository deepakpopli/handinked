#!/usr/bin/env python3
"""Render a handinked notes.md into handwritten pages.

Usage: python3 render.py notes.md [--theme notebook|night|chalkboard] [--out DIR] [--no-png]

Writes next to notes.md (or into --out):
  <name>.html      one self-contained file, opens offline in any browser
  <name>.pdf       one page per notebook page
  <name>-pages/    p01.png, p02.png ... (1080x1350, for a quick look or sharing)
Prints the lint report. Exit code 1 when the lint found an error.

Needs Python 3.8+ and Chrome, Chromium or Edge. Nothing else.
"""
import argparse
import base64
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"
THEMES = ("notebook", "night", "chalkboard")


def find_chrome():
    env = os.environ.get("HANDINKED_CHROME")
    if env:
        return env
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"):
        found = shutil.which(name)
        if found:
            return found
    places = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    for base in (os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")):
        if base:
            places.append(os.path.join(base, "Google", "Chrome", "Application", "chrome.exe"))
            places.append(os.path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"))
    for place in places:
        if os.path.exists(place):
            return place
    sys.exit("handinked: no Chrome, Chromium or Edge found. Install one, or set HANDINKED_CHROME to its path.")


def script(code):
    # A closing script tag inside inlined code would end the block early.
    return "<script>" + code.replace("</script", "<\\/script") + "</script>"


def build_html(md, theme, title):
    css = (ASSETS / "handinked.css").read_text()

    def font(match):
        data = base64.b64encode((ASSETS / match.group(1)).read_bytes()).decode()
        return f"url(data:font/ttf;base64,{data})"

    css = re.sub(r"url\('(fonts/[^']+)'\)", font, css)
    read = lambda name: (ASSETS / name).read_text()
    source = json.dumps({"md": md, "theme": theme}).replace("</", "<\\/")
    return "\n".join([
        "<!doctype html>",
        '<html><head><meta charset="utf-8">',
        f"<title>{title}</title>",
        f"<style>{css}</style>",
        "</head>",
        '<body data-seed="8">',
        '<div id="hk-pages"></div>',
        f'<script id="hk-src" type="application/json">{source}</script>',
        '<script id="hk-lint" type="application/json">null</script>',
        script(read("vendor/rough.js")),
        script(read("vendor/dagre.min.js")),
        # perfect-freehand's CommonJS build declares short top-level names: keep them private.
        script("var exports = {};(function () {" + read("vendor/perfect-freehand.js") + "\n})();"),
        script(read("diagram.js")),
        script(read("marks.js")),
        script(read("app.js")),
        "</body></html>",
    ])


def chrome(binary, args, url, timeout=180):
    """Run headless Chrome once. Returns stdout. Retries without the sandbox if needed."""
    for extra in ([], ["--no-sandbox"]):
        with tempfile.TemporaryDirectory(prefix="handinked-") as profile:
            cmd = [binary, "--headless=new", f"--user-data-dir={profile}", "--disable-gpu", "--hide-scrollbars",
                   "--no-first-run", "--virtual-time-budget=20000", *extra, *args, url]
            try:
                done = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            except subprocess.TimeoutExpired:
                continue
            if done.returncode == 0:
                return done.stdout
    sys.exit(f"handinked: Chrome failed to run ({binary}).\n{done.stderr[-800:] if 'done' in dir() else 'timed out'}")


def main():
    ap = argparse.ArgumentParser(description="Render handinked notes.md into handwritten pages.")
    ap.add_argument("notes")
    ap.add_argument("--theme", choices=THEMES, help="overrides the theme in the notes front matter")
    ap.add_argument("--out", help="output folder (default: next to the notes file)")
    ap.add_argument("--no-png", action="store_true", help="skip the per-page PNG files")
    ap.add_argument("--scale", type=int, default=1, choices=(1, 2), help="PNG scale (2 = 2160x2700)")
    args = ap.parse_args()

    notes = Path(args.notes).resolve()
    md = notes.read_text(encoding="utf-8")
    out = Path(args.out).resolve() if args.out else notes.parent
    out.mkdir(parents=True, exist_ok=True)
    name = notes.stem
    html = out / f"{name}.html"
    html.write_text(build_html(md, args.theme, name), encoding="utf-8")
    url = html.as_uri()
    binary = find_chrome()

    # 1. Lay out once and read the lint report back from the page.
    dom = chrome(binary, ["--dump-dom"], url)
    found = re.search(r'<script id="hk-lint" type="application/json">(.*?)</script>', dom, re.S)
    report = json.loads(found.group(1)) if found else None
    if not report:
        sys.exit("handinked: the page did not finish rendering (no lint report). Open the .html file in a browser to see why.")
    errors = [p for p in report["problems"] if p["level"] == "error"]
    warnings = [p for p in report["problems"] if p["level"] != "error"]
    for p in errors + warnings:
        where = f"{notes.name}:{p['line']}" if p.get("line") else notes.name
        page = f" (page {p['page']})" if p.get("page") else ""
        print(f"{p['level'].upper():5} {where}{page} [{p['check']}] {p['msg']}")
    pages = report["pages"]
    if not pages:
        sys.exit(1)

    # 2. PDF.
    pdf = out / f"{name}.pdf"
    chrome(binary, [f"--print-to-pdf={pdf}", "--no-pdf-header-footer"], url)

    # 3. One PNG per page.
    shots = out / f"{name}-pages"
    if not args.no_png:
        if shots.exists():
            shutil.rmtree(shots)
        shots.mkdir()

        def shot(n):
            target = shots / f"p{n:02d}.png"
            chrome(binary, [f"--screenshot={target}", "--window-size=1080,1350",
                            f"--force-device-scale-factor={args.scale}"], f"{url}#page={n}")
            return target

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(shot, range(1, pages + 1)))

    fill = " ".join(f"p{i + 1}:{n}" for i, n in enumerate(report.get("fill", [])))
    print(f"fill: {fill}  (ruled lines used per page, out of {report.get('lines', 21)})")
    print(f"lint: {pages} pages, theme {report['theme']}, {len(errors)} errors, {len(warnings)} warnings")
    print(f"pdf:  {pdf}")
    print(f"html: {html}")
    if not args.no_png:
        print(f"png:  {shots}/p01.png .. p{pages:02d}.png")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

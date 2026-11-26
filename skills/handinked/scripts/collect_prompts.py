#!/usr/bin/env python3
"""Collect what the user typed in past Claude Code sessions, for the handinked personal profile.

Usage: python3 collect_prompts.py [--days 90] [--max-chars 60000] [--project TEXT] [--list]

Reads ~/.claude/projects/*/*.jsonl on this machine and prints only the user's
own prompts (no tool output, no assistant text), grouped by project, newest
first. Likely secrets and contact details are replaced with [redacted].
Nothing is sent anywhere and nothing is written to disk.
"""
import argparse
import json
import re
import time
from collections import defaultdict
from pathlib import Path

REDACT = [
    re.compile(r"\b(sk|pk|rk|ghp|gho|ghu|ghs|xox[abprs])[-_][A-Za-z0-9_\-]{16,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bAIza[0-9A-Za-z_\-]{30,}"),
    re.compile(r"\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}"),
    re.compile(r"\b[A-Za-z0-9+/_\-]{40,}={0,2}"),
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    re.compile(r"(?<!\d)\+?\d[\d\s-]{9,}\d(?!\d)"),
    re.compile(r"(?i)\b(password|passwd|secret|token|api[_ -]?key)\b\s*[:=]\s*\S+"),
]


def clean(text):
    for pattern in REDACT:
        text = pattern.sub("[redacted]", text)
    return re.sub(r"\s+", " ", text).strip()


def prompts_in(path):
    """Yield (timestamp, text) for each prompt the user typed in one session file."""
    try:
        handle = path.open(encoding="utf-8", errors="replace")
    except OSError:
        return
    with handle:
        for line in handle:
            if '"type":"user"' not in line and '"type": "user"' not in line:
                continue
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if entry.get("type") != "user" or entry.get("isSidechain") or entry.get("isMeta") or "toolUseResult" in entry:
                continue
            content = entry.get("message", {}).get("content")
            if isinstance(content, list):
                content = " ".join(part.get("text", "") for part in content
                                   if isinstance(part, dict) and part.get("type") == "text")
            if not isinstance(content, str):
                continue
            # Drop harness text that rides along in user turns.
            content = re.sub(r"<(system-reminder|command-[\w-]+|local-command-[\w-]+|task-notification)>.*?</\1>", "", content, flags=re.S)
            content = content.strip()
            if len(content) < 15 or content.startswith(("<", "[Request interrupted", "Caveat:", "This session is being continued")):
                continue
            yield entry.get("timestamp", ""), content


def main():
    ap = argparse.ArgumentParser(description="Print the user's own past prompts, grouped by project.")
    ap.add_argument("--days", type=int, default=90, help="only sessions changed in the last N days")
    ap.add_argument("--max-chars", type=int, default=60000, help="total output budget")
    ap.add_argument("--per-prompt", type=int, default=500, help="cut each prompt to this many characters")
    ap.add_argument("--project", help="only projects whose folder name contains this text")
    ap.add_argument("--list", action="store_true", help="only list projects and prompt counts")
    args = ap.parse_args()

    root = Path.home() / ".claude" / "projects"
    cutoff = time.time() - args.days * 86400
    by_project = defaultdict(list)
    for path in root.glob("*/*.jsonl"):
        if path.stat().st_mtime < cutoff:
            continue
        name = path.parent.name
        if args.project and args.project.lower() not in name.lower():
            continue
        by_project[name].extend(prompts_in(path))

    if not by_project:
        print(f"No sessions found under {root} in the last {args.days} days.")
        return
    total = sum(len(v) for v in by_project.values())
    print(f"{total} prompts in {len(by_project)} projects, last {args.days} days\n")
    order = sorted(by_project, key=lambda n: -len(by_project[n]))
    for name in order:
        print(f"{len(by_project[name]):5}  {name}")
    if args.list:
        return

    # Share the budget between projects so one busy project does not crowd out the rest.
    share = max(1500, args.max_chars // len(order))
    for name in order:
        print(f"\n=== {name} ===")
        used, seen = 0, set()
        for stamp, text in sorted(by_project[name], reverse=True):
            text = clean(text)[: args.per_prompt]
            if text[:80] in seen:
                continue
            seen.add(text[:80])
            if used + len(text) > share:
                print("  ...")
                break
            used += len(text)
            print(f"- [{stamp[:10]}] {text}")


if __name__ == "__main__":
    main()

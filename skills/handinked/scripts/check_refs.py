#!/usr/bin/env python3
"""Spike: check every [`symbol`](path#L10-L20) citation in a notes file against a repo.

Usage: python3 check_refs.py notes.md --repo /path/to/repo
Exit code 0 when every citation is good, 1 otherwise.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

# [`editorRefreshScreen`](kilo.c#L882-L960)  or  [`main`](src/main.rs#L12)
CITATION = re.compile(r"\[`?([^\]`]+?)`?\]\(([^)#\s]+)#L(\d+)(?:-L(\d+))?\)")
SLACK = 3          # a symbol a few lines outside the range is a near miss, not a lie
MAX_SPAN = 120     # longer ranges are too vague to count as a citation


def tracked_files(repo):
    out = subprocess.run(["git", "-C", str(repo), "ls-files"], capture_output=True, text=True)
    return set(out.stdout.splitlines()) if out.returncode == 0 else None


def check(notes_path, repo):
    repo = Path(repo).resolve()
    tracked = tracked_files(repo)
    problems, total = [], 0
    for lineno, text in enumerate(Path(notes_path).read_text().splitlines(), 1):
        for symbol, path, start, end in CITATION.findall(text):
            total += 1
            start, end = int(start), int(end or start)
            where = f"{notes_path}:{lineno} {path}#L{start}"
            target = (repo / path).resolve()
            if repo not in target.parents or not target.is_file():
                problems.append(f"{where}: file not found")
                continue
            if tracked is not None and path not in tracked:
                problems.append(f"{where}: file exists but is not tracked by git")
                continue
            lines = target.read_text(errors="replace").splitlines()
            if end < start or end > len(lines):
                problems.append(f"{where}: range ends past the file ({len(lines)} lines)")
                continue
            if end - start > MAX_SPAN:
                problems.append(f"{where}: range is {end - start} lines, cite something narrower")
            name = re.split(r"[.:]+", symbol.strip("()"))[-1]   # Foo.bar() -> bar
            word = re.compile(rf"\b{re.escape(name)}\b")
            if any(word.search(l) for l in lines[start - 1:end]):
                continue
            near = [i + 1 for i, l in enumerate(lines) if word.search(l)]
            if near and min(abs(n - start) for n in near) <= SLACK:
                problems.append(f"{where}: `{name}` is at line {min(near, key=lambda n: abs(n - start))}, adjust the range")
            elif near:
                problems.append(f"{where}: `{name}` not in range; it appears at lines {near[:5]}")
            else:
                problems.append(f"{where}: `{name}` does not appear anywhere in {path}")
    return total, problems


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("notes")
    ap.add_argument("--repo", default=".")
    args = ap.parse_args()
    total, problems = check(args.notes, args.repo)
    print(f"refs: {total} checked, {total - len(problems)} ok, {len(problems)} bad")
    for p in problems:
        print("  " + p)
    sys.exit(1 if problems else 0)

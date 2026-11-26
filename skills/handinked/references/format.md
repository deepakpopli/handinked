# notes.md format

One Markdown file in, pages out. The renderer places everything: you never write
page numbers, positions or sizes.

## Contents
- Front matter
- Blocks
- Inline marks
- Diagrams
- What the lint reports

## Front matter

```
---
title: TCP handshake
theme: night
tag: interview prep
---
```

- `theme`: `notebook` (light paper), `night` (near black), `chalkboard` (dark green-grey).
  `--theme` on the command line wins over this.
- `tag`: small text in the top right corner of every page. Defaults to `title`.

## Blocks

Separate blocks with a blank line. The renderer adds one empty ruled line
between different kinds of block (paragraph, list, callout) and between two
`> test:` questions. A `> note:` sits right under the line before it. A line
with only `~` adds one more empty line anywhere.

**Page budget.** A page holds 21 ruled lines and the title takes the first.
A line of handwriting holds about 45 characters. Rough heights: code is its
line count plus 2, a `graph` going `LR` 4 to 6 lines, a `TB` graph or `tree`
about 4 lines per level, a `sequence` 3 lines plus 1.5 per message, a
`timeline` 6 lines. Add these up before you render: a page that runs over by
one line leaves that line stranded on the next page.

| Write | You get |
|-------|---------|
| `# What is a branch?` | Page title with a red pen underline. **Always starts a new page.** Keep it under 30 characters so it stays on one line. |
| `## Try it` | Sub heading |
| plain text | Handwritten paragraph |
| `1. header + content` | Step with a circled red number |
| `- a point` | Bullet |
| `> key: the name is the hash` | Circled KEY, then the line. One per page. |
| `> careful: it is += not =` | Red line that starts with "careful:" |
| `> note: ids are real` | Small pencil line (sources, asides) |
| `> test: why three, not two?` | Question with a red "Q:". Never put its answer on the same page. |
| `> say: P reacts now, I removes the leftover.` | "say it:" line: the answer to the page title as you would speak it. See learning.md |
| `> me: like a ROS topic, but ...` | Green "for you" line. Personal mode only, see personal.md |
| fenced code | Printed snippet taped to the page. Under 64 characters per line, under 12 lines |
| fenced `diagram` | Hand-drawn diagram from a JSON spec, see below |
| `---` | Force a page break |

Pages also break on their own when a block does not fit. Code and diagrams
never split. A `##` heading stays with the block after it.

In `sh` or unlabelled code, lines starting with `$ ` are commands and the rest
is dimmed as output. In other languages comment lines are dimmed.

## Inline marks

| Write | You get |
|-------|---------|
| `**word**` | Strong ink (black on paper, yellow on dark) |
| `==a phrase==` | Yellow highlighter. One per page. |
| `[[word]]` | Hand-drawn box around the term being defined |
| `__word__` | Red pen underline |
| `((word))` | Red pen circle |
| `~~word~~` | Struck out (for a wrong idea you are correcting) |
| `` `name` `` | Printed inline code. Use for identifiers and commands. |
| ``[`symbol`](path/file.py#L10-L20)`` | Citation, shown as `file.py#L10-L20`. Checked by `check_refs.py`. |

Write `->` for arrows and spell out Greek letters and maths symbols (`sigma`,
`sqrt`, `<=`). The handwriting font has no glyphs for them and the lint will
stop you.

## Diagrams

A fenced block with the language `diagram` holding one JSON object. You name
the boxes and the links. The renderer measures every label, does the layout
and draws it, so labels and boxes cannot collide.

Limits that keep diagrams readable: 7 boxes or fewer, labels of 1 to 4 words
(`\n` forces a line break), one highlighted box, at most 2 notes.

### graph: boxes and arrows

````
```diagram
{"kind": "graph", "direction": "LR",
 "nodes": [
  {"id": "client", "label": "Client", "shape": "pill"},
  {"id": "gw", "label": "API Gateway", "hl": true},
  {"id": "db", "label": "Postgres", "shape": "cylinder"}
 ],
 "edges": [["client", "gw", "HTTPS"], ["gw", "db"], ["db", "gw", "rows", "dashed"]],
 "notes": [{"to": "gw", "text": "auth and\nrate limits"}]}
```
````

- `direction`: `LR` (left to right) or `TB` (top to bottom). `LR` fits about
  3 boxes in a row with short labels. Edge labels and notes add width, so a
  row of 4 boxes with labelled edges is already too wide: use `TB`, or drop
  the edge labels and say it in the text.
- node `shape`: `box` (default), `pill`, `ellipse`, `cylinder` (storage),
  `queue`, `diamond` (decision).
- `"hl": true` highlights one node. `"color": "red"` draws a node or edge in red.
- edge: `[from, to]`, `[from, to, "label"]`, plus optional `"dashed"` and `"red"`.
- `notes`: a red handwritten note with a curved arrow to a node id.

### tree: a hierarchy

Same fields as `graph` with `"kind": "tree"`. Children keep the order you write
them. Use it for object trees, class hierarchies, directory layouts, recursion.

### sequence: who talks to whom, in order

````
```diagram
{"kind": "sequence",
 "participants": ["client", "server"],
 "messages": [
  ["client", "server", "SYN seq=100"],
  ["server", "client", "SYN-ACK seq=300 ack=101", "reply"],
  ["client", "server", "ACK ack=301"]
 ]}
```
````

`"reply"` draws a dashed arrow. Keep it to 5 participants and 8 messages.
Notes point at a participant name.

### stack: layers or memory layout

````
```diagram
{"kind": "stack", "title": "process memory",
 "cells": [
  {"label": "Stack", "grow": "down", "hl": true, "left": "high"},
  {"label": "free", "free": true, "size": 1.6},
  {"label": "Heap", "grow": "up"},
  {"label": "Text (code)", "left": "low"}
 ]}
```
````

`left` is a label in the left margin, `grow` draws a growth arrow, `free` draws
a dashed cell, `size` scales the cell height. Notes point at a cell label.

### timeline: events in order

````
```diagram
{"kind": "timeline",
 "events": [
  {"at": "t=0", "label": "leader dies"},
  {"at": "150 ms", "label": "follower times out"},
  {"at": "151 ms", "label": "asks for votes"}
 ]}
```
````

Up to 6 events. Labels alternate above and below the line. Notes point at
`e0`, `e1`, ... (the event index) and attach to that event's label.

## What the lint reports

`render.py` prints one line per problem with the notes.md line number, then a
`fill:` line with the ruled lines used on each page (out of 21). A page at 1
to 3 lines is the stranded tail of the page before it: cut that many lines there.

Errors (exit code 1, fix all of them):

| Check | Fix |
|-------|-----|
| `diagram-error` | The JSON did not parse, or an edge names an id that is not in `nodes` |
| `diagram-collision` | A label overflows its box or two things overlap: shorten the label |
| `too-wide` | A code line, long word or citation runs off the page |
| `too-tall` | One block is taller than a page: split it |
| `missing-glyph` | A character is not in the handwriting font: use ASCII or words |
| `unclosed-fence` | A code fence has no closing line |

Warnings (fix unless you have a reason):

| Check | Fix |
|-------|-----|
| `diagram-small` | Diagram had to be shrunk to fit the width, so labels are small: drop edge labels or notes, shorten labels, or use `TB` |
| `diagram-crowded` | More than 9 boxes |
| `too-many-words` | More than 150 words on a page: cut or split |
| `too-many-highlights` | More than one `==highlight==` on a page |
| `too-many-personal-links` | More than one `> me:` on a page |
| `page-mostly-empty` | Less than 40% used: usually the page before ran over by a line or two, so cut there. Otherwise merge with a neighbour |
| `no-visual` | A wordy page with no diagram or code (a page of `> test:` questions is exempt) |
| `title-too-long` | The `#` title wraps: shorten it |

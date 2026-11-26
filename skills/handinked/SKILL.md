---
name: handinked
description: Turns a topic, a paper, interview or exam prep material, or a codebase into handwritten notebook pages with hand-drawn diagrams, as a PDF, PNG pages and an offline HTML file, in a light, night or chalkboard theme. Use when the user asks for handwritten notes, study notes, revision or interview-prep notes, a cheat sheet, hand-drawn or sketch-style explanations, or notes that explain a repository with checked file and line citations. Has an optional personal mode that fits the notes to what the user already knows.
---

# handinked

You write a small Markdown file. A script turns it into handwritten pages and
tells you what is wrong with them. You fix it, then look at the pages.

Paths below are relative to this skill's folder.

## Steps

1. **Settle the brief.** Subject, reader, goal and theme. If the goal is an
   interview or an exam, read [references/learning.md](references/learning.md)
   now: it sets how the pages and the set are built and adds a study plan
   and a study guide. If the user did not name a theme, use their profile preference
   if `~/.claude/handinked/profile.md` exists, otherwise `notebook`. Ask only
   when the subject itself is unclear.
2. **Gather the facts before writing.** Read the sources the user gave. For a
   codebase follow "Codebase notes" below. For commands and outputs, run them
   and copy the real output. A claim you cannot check is either left out or
   marked `> note: not verified`.
3. **Plan the pages.** One question per page. List the page titles first, then
   pick the one visual for each page.
4. **Write `notes.md`.** The format, every block, mark and diagram kind is in
   [references/format.md](references/format.md). Read it before the first use.
5. **Render.**
   ```
   python3 scripts/render.py path/to/notes.md --theme night
   ```
   It writes `notes.pdf`, `notes.html` and `notes-pages/p01.png ...` next to
   the notes file and prints a lint report with notes.md line numbers and how
   full each page is.
6. **Fix every ERROR and re-render.** Fix warnings unless there is a reason
   not to. Stop after 3 rounds and tell the user what is left.
7. **Look at the pages.** Read each PNG and check it against "The look test".
   The lint cannot see a dull or confusing page. Fix and re-render.
8. **Report.** Give the PDF path, the page count, anything not verified and
   any lint warning you left in.

## What goes on a page

- The title is a short question the page answers (under 30 characters).
- One visual per page: a diagram, a taped code snippet or a numbered sequence.
  The closing page of test questions is the exception.
- 150 words or fewer. Short lines. If it needs more, it is two pages.
- A worked example with real numbers comes before the general rule.
- One `> key:` line that the reader should remember, and one `==highlight==`.
- Red ink (`> careful:`) is only for mistakes people actually make.
- End a set with 3 to 5 `> test:` questions on their own page, and the
  answers on a later page.
- An analogy says where it stops being true.
- Leave space. A page that is 60 to 80% full reads best.

Typical sizes: one concept 1 to 3 pages, a cheat sheet 1 page, interview prep
for one topic 4 to 8 pages, a codebase tour 4 to 8 pages.

## Codebase notes

1. Record the commit: `git rev-parse --short HEAD`. Put it in the `tag`.
2. Pick one real path through the code (one request, one command, one call)
   and read those files. Do not summarise the folder tree.
3. Cite every claim about the code as ``[`symbol`](path/file.py#L10-L20)``
   with a range that really contains the symbol. Quote code exactly.
4. Check the citations before rendering and fix every miss:
   ```
   python3 scripts/check_refs.py path/to/notes.md --repo path/to/repo
   ```

## Personal mode (optional, experimental)

Only when the user asks for notes fitted to them, or asks to compare plain and
personal notes. Follow [references/personal.md](references/personal.md): it
covers the learner profile, how to build it from past sessions and questions,
and the rules for when a personal link helps and when it is noise.

## The look test

Open the PNG pages and check each one:

1. Can you say what the page teaches after 3 seconds?
2. Does the diagram show the idea, or does it only repeat the text in boxes?
3. Is every diagram label readable, with no arrow guessing?
4. Is there one clear thing to remember?
5. Is anything cut off, cramped or stranded alone at the top of a page?
6. Would you be happy to hand this page to someone? If not, rewrite it.

## If something fails

- `no Chrome, Chromium or Edge found`: ask the user to install one, or set
  `HANDINKED_CHROME` to the browser path.
- `the page did not finish rendering`: open the `.html` file in a browser and
  read the console error. It is almost always a malformed diagram block.

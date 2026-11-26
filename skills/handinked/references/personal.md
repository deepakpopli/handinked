# Personal mode (experimental, optional)

Notes written for one reader: what they already know is skipped, their gaps
get the space, and a hard idea is tied to something they have built.

Use it only when the user asks for it ("for me", "with my context", "personal
notes") or asks to compare plain and personal notes. Otherwise write plain notes.

## Contents
- The profile file
- Building the profile
- Writing with the profile
- Comparing plain and personal notes

## The profile file

`~/.claude/handinked/profile.md`. It lives outside every repository, stays on
this machine and is plain text the user can edit. Read it if it exists. Build
it (next section) if it does not, or if the user asks to refresh it.

```markdown
# Learner profile
Updated: 2026-11-10. Sources: 212 prompts from 9 projects, 6 answers from the user.

## Knows well (skip or recap in one line)
- ROS 2 nodes, topics, launch files. Evidence: daily use in 3 projects. [seen]
- Python asyncio. Evidence: user said so. [said]

## Shaky or new (spend the page here)
- Kubernetes networking. Evidence: asked what a Service is twice in October. [seen]

## Home ground (where a bridge can come from)
- Rover navigation stack he built: Cartographer, Nav2, lidar.
- Voice loop: wake word, barge-in, TTS.

## How they like things explained
- Concrete example first, then the rule. [said]
- Asks "why not X?" often: include the rejected alternative. [seen]

## Preferences
- Theme: night. Short sentences. No filler.

## Goal right now
- Interview at <company> for <role> on <date>.

## Do not
- Do not explain basic Python or git.
```

Rules for the file:
- Every line under "Knows well" and "Shaky or new" carries its evidence and
  `[seen]` (found in prompts) or `[said]` (the user told you). A guess with no
  evidence does not go in.
- Describe what the user works on and how they ask. Do not claim to know how
  they think: prompts cannot show that.
- Never store secrets, keys, contact details, money, health or family matters,
  or anything about other people.

## Building the profile

1. Run `python3 scripts/collect_prompts.py --list` to see which projects have
   history, then `python3 scripts/collect_prompts.py` to read the user's own
   prompts (tool output and assistant text are left out, likely secrets are
   redacted). Add `--project TEXT` or `--days N` to narrow or widen it.
2. Read for four things: what they build (home ground), what they never ask
   about (knows well), what they ask about repeatedly or get corrected on
   (shaky), and how they phrase requests (explanation style).
3. Draft the profile. Keep it under 60 lines.
4. Ask the user what the prompts cannot show. Use the question tool if you
   have one, 4 to 7 questions, for example:
   - What is the goal and the date (interview, exam, new job)?
   - Which topics here do you already know cold, so the notes can skip them?
   - Which ones do you keep forgetting or find hard?
   - When something finally clicks, what usually did it: an example with
     numbers, a diagram, a comparison with something you built, or the code?
   - Which of your own projects should comparisons come from?
   - Theme, and how dense the pages should be.
5. Show the user the finished profile and ask for corrections. Save it only
   after that. Tell them where it is and that they can edit or delete it.

If there is no session history, skip steps 1 and 2 and build it from questions.

## Writing with the profile

First write the outline as if for a plain set of notes, following
[learning.md](learning.md) if the goal is an interview or exam. Then apply
these, in this order of value. The reasons are in learning.md: readers who
know a topic learn less from step-by-step examples on it, and a link to prior
knowledge only helps when that knowledge is solid.

1. **Cut what they know.** A topic under "Knows well" gets one recap line, or
   nothing. This is the biggest gain.
2. **Spend the space on the gaps.** Topics under "Shaky or new" get the worked
   example, the diagram and the `> test:` question.
3. **Answer their kind of question.** If they ask "why not X?", put the
   rejected alternative on the page. If they want numbers first, start with
   the worked example.
4. **Use their words.** Where an example is needed anyway, take it from their
   stack and use the names they use.
5. **Bridge only the hard ideas.** A `> me:` line ties one new idea to
   something on their home ground.

Rules for `> me:` lines:
- Use one only when the idea is hard and the link is real: the two things
  share a mechanism, not just a word. Ask: would a plain two-line explanation
  leave a gap that this link closes? If not, leave it out.
- Simple facts stay plain. A definition, a command, a list of steps or a
  number never gets dressed up in the user's domain.
- At most one per page, and most pages have none. A 10-page set usually has
  2 to 4.
- Each one says where the comparison stops working ("... but unlike a ROS
  topic, a Kafka topic keeps old messages"). A warning alone does not fully
  prevent a wrong idea, so follow it with the plain statement of the fact.
- Never sprinkle domain words through ordinary sentences for flavour.

The facts never change. The plain version and the personal version must agree
on every claim. The profile changes what is selected, the order and the
examples, never what is true.

## Comparing plain and personal notes

When the user wants to see what the profile adds:

1. Write `<name>.plain.md` first, with no profile loaded.
2. Write `<name>.personal.md` from the same sources and the same facts.
3. Render both with the same theme.
4. Report a short table of what changed and why, one row per change:
   what was cut (and the profile line that justified it), what got more room,
   each `> me:` line and the home-ground item it uses. Say plainly if the
   profile changed little.

The user judges which is better. Do not argue for the personal version.

# Notes that are built to be remembered

Read this when the notes are for learning something by a date: an interview,
an exam, a talk. It turns findings from memory research into page rules.
Reference notes that will only be looked things up in do not need it.

## Contents
- Pick the goal
- Interview goal: the page rules
- Interview goal: the set
- The study plan
- The study guide
- What the research says, and how sure it is
- Do not print these

## Pick the goal

Ask what the notes are for if it is not clear, then use one row.

| Goal | The test | What the notes optimise for |
|------|----------|------------------------------|
| `interview` | Spoken answers, days to weeks away, follow-up questions | Recall out loud, the "why", spaced review up to the date |
| `exam` | Written answers on a known date | Same rules as interview, with written recall instead of spoken |
| `long-term` | No date, should last months | Not built yet. Use the interview rules and say so. |
| `reference` | Looked up when needed | Skip this file. Dense cheat sheet is fine. |

## Interview goal: the page rules

Each rule names the finding behind it (see the last section).

1. **Open with the question, and let the reader guess.** The `#` title is the
   question an interviewer would ask. Do not answer it in the first line: put
   the worked example first. (Pretesting)
2. **At most 4 new ideas on a page.** Count terms the reader has not met.
   A fifth idea is a new page. (Working memory)
3. **One diagram that explains, never one that decorates.** If the diagram
   could be deleted without losing meaning, it is decoration: remove it or
   make it carry the idea. Do not repeat the same words in the diagram and
   the text. (Multimedia, seductive details)
4. **Worked example with real numbers before the rule** on topics new to the
   reader. On topics they know well, skip the example and go to the edge
   cases. (Worked examples, expertise reversal)
5. **Say the "why".** Every mechanism gets one line starting from "because"
   or "so". Interviewers ask why, and explaining why is what sticks.
   (Self-explanation)
6. **End each content page with one `> say:` line**: the answer to the page
   title as the reader would say it out loud, 2 sentences, under 35 words.
   It is a model, not a script: the guide tells them to say it in their own
   words first. (Practising in the form of the test)
7. **One `> key:` per page**, and one highlight. Highlighting everything
   helps nothing. (Low value of highlighting)
8. **No answers next to questions.** A `> test:` question and its answer
   never share a page. (Retrieval practice)

## Interview goal: the set

Build the set in this order:

1. **How to use these pages** (1 page). The routine from the study guide in
   5 steps, and the review dates from the study plan as a timeline diagram.
   Skip it if the user says they have read the guide.
2. **Content pages.** One question per page, most important first.
3. **Mixed questions** (1 or 2 pages). 5 to 8 `> test:` questions phrased as
   an interviewer would ask them. Order them so neighbours are from different
   pages, and include 2 that make the reader tell similar things apart
   ("when would you pick X over Y?"). Mostly "why", "what breaks if" and
   "compare", few "define". (Interleaving helps for telling similar things
   apart)
4. **Answers** (own page, after the questions). Short: the 2 or 3 points a
   good answer must hit, and the page to go back to. Checking the answer
   after trying is what makes a wrong attempt useful. (Feedback)
5. **One-page recap** (last page). The `> key:` lines of the set and nothing
   else. This is the page for the morning of the interview.

Tell the user in the report: questions first, answers covered, out loud.

## The study plan

Get the dates from the script, not from mental arithmetic:

```
python3 scripts/study_plan.py --date 2026-11-24
```

It prints the review days between today and the interview date. Put them on
the "How to use these pages" page as a `timeline` diagram, or as steps if
there are more than 6. If the user gave no date, ask for it. If they do not
have one, print the plan for 7 days and say so.

The spacing behind it: with about a week to go, a gap of 1 to 2 days between
recall sessions; with 2 to 3 weeks, 3 to 6 days. Each topic should be recalled
correctly in at least 3 separate sessions. The last session is the day before
and is a spoken run-through. The morning is the recap page only.

## The study guide

`assets/guides/how-to-study.md` is a ready set of pages that explains to the
reader how memory works and how to study from handinked pages. For an
interview or exam goal, render it once in the user's theme and give it to
them with the first set of notes:

```
cp assets/guides/how-to-study.md <output folder>/how-to-study.md
python3 scripts/render.py <output folder>/how-to-study.md --theme night
```

Do not rewrite it or add claims to it. Every statement in it was checked
against the sources listed below.

## What the research says, and how sure it is

Checked in November 2026 against papers, meta-analyses and reviews. Use the
careful wording. Effect sizes are moderate, not magic.

| Finding | Careful version | How sure | Source |
|---------|-----------------|----------|--------|
| Retrieval practice | Testing yourself gives better delayed memory than rereading for the same time. Also helps with technical text; gains on transfer are smaller. Rereading can win on a test minutes later. | Solid | Roediger & Karpicke 2006; Pan & Rickard 2018 |
| Spacing | Spread sessions beat one long session on a later test. The best gap grows as the test moves away. | Solid; the gap rule is approximate | Cepeda et al. 2008 |
| Forgetting curve | Forgetting is fastest soon after learning, then slows. No fixed percentage holds for meaningful material. | Shape solid, numbers not | Murre & Dros 2015 |
| Rereading, highlighting | Low value compared with the alternatives, and the familiar feeling inflates confidence. One spaced reread does help. | Mostly solid | Dunlosky et al. 2013; Koriat & Bjork 2005 |
| Working memory | About 4 (3 to 5) chunks at once. Experts fit more into a chunk. A design guide, not a constant. | Mostly solid | Cowan 2001 |
| Self-explanation | Explaining why and how improves learning. Works better the more the learner already knows. | Mostly solid | Bisra et al. 2018; Dunlosky et al. 2013 |
| Words plus diagram | A relevant, explanatory diagram with words beats words alone, most for novices. Decorative extras hurt. | Mostly solid | Mayer; Sundararajan & Adesope 2020 |
| Worked examples | Novices learn more from worked examples. The advantage fades and reverses with expertise, per topic. | Solid | Kalyuga et al. 2003; Tetzlaff et al. 2025 |
| Interleaving | Mixing helps when the task is telling similar problem types apart. Not for unrelated topics or prose. | Mostly solid, domain-dependent | Brunmair & Richter 2019 |
| Pretesting | Guessing before studying helps later learning, even when wrong, if the right answer follows. | Mostly solid | Kornell, Hays & Bjork 2009; Richland et al. 2009 |
| Feedback | Checking the answer after a test, most of all after errors, adds to the benefit. | Solid | Butler & Roediger 2008 |
| Successive relearning | Recall each item correctly, then do it again in about 3 spaced sessions. | Good, authors call the number tentative | Rawson & Dunlosky 2011 |
| Practising in the test's form | Memory is best when practice matches how it will be tested. This is the argument for answering out loud. | Solid as a principle | Morris, Bransford & Franks 1977 |
| Saying it aloud | Small memory benefit on its own. | Small | MacLeod et al. 2010; Fawcett 2013 |
| Mock interviews | Direct evidence that rehearsal improves interview results is thin: small effects in a few studies. | Weak | Maurer et al.; Tross & Maurer 2008 |
| Sleep | Losing a night's sleep hurts learning. Do not trade sleep for study hours. Benefits of sleep after learning are real but smaller than popular claims. | Sleep loss solid; size of the benefit contested | Newbury et al. 2021; Cordi & Rasch 2021 |
| Analogies | Help when the reader knows the base domain well and the mapping is spelled out. A single analogy causes predictable wrong ideas, and a warning alone does not fully prevent them. | Mostly solid | Gentner 1983; Spiro et al. 1989 |
| Learning styles | Matching teaching to a visual, auditory or kinesthetic "style" is not supported. People have preferences; matching does not pay. | Solid | Pashler et al. 2008 |
| Overlearning | Extra repetition in one sitting helps for about a week and is nearly gone by four. Fine for a test days away; spacing is better. | Solid | Rohrer et al. 2005 |

How this shapes personal mode: the expertise finding is why notes for one
reader skip worked examples on what they know. The self-explanation and
analogy findings are why a `> me:` link is only worth it on a hard idea, from
ground the reader knows well, with its limit stated.

## Do not print these

Popular, and not supportable. Never put them in notes or a guide:

- "You forget 70% (or 50%, or 80%) in 24 hours."
- The learning pyramid ("10% of what you read, 90% of what you teach").
- "Working memory holds 7 items."
- Advice to match a visual, auditory or kinesthetic learning style.
- "Sleep doubles retention", or claims about specific sleep stages.
- "Reading aloud makes you remember X% more."
- "Practice tests make memory stress-proof."
- An exact optimal review gap as a percentage.

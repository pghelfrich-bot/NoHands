# Plan: convert NotebookLM reading prompts into LectureFlow outlines

## Context

The user has a collection of PDFs, one per class reading, that were written as
prompts for NotebookLM's slide generator. Each PDF has two parts:

1. **Standing instructions** — a long, repeated block of NotebookLM-specific
   generation rules: exact colors/fonts, "max 5 bullets", forced asymmetric
   layouts, "no AI images", a quiz format, etc. This is boilerplate for a
   *different* tool and should **not** be carried into LectureFlow outlines —
   LectureFlow already has its own design system (palettes, layouts, dark vs.
   light themes) and its image panel is already licensed-sources-only, so the
   "no AI images / real HD photography" rules are satisfied for free.
2. **Slide-by-slide outline** — the actual content for that reading: a title
   slide, a roadmap, section headers, content slides (headline + bullets +
   a "TAKEAWAY" line + a `PHOTO:` description), one or two "challenge
   questions", and a closing "competency quiz" slide with 5 MCQs.

This is the *content* worth keeping. The task for a future session is:
take each reading's PDF and produce a LectureFlow outline (the plain-text
format the app's outline screen parses — see `OUTLINE_FORMAT_SPEC` in
`app.js` and the README's "The outline" section) that a teacher can paste in
and build a deck from in one click.

This document is the conversion spec + a fully worked example
(`docs/outlines/r2-what-defines-a-bird.txt`, converted from the attached
"Reading #2 — What Defines a Bird?" prompt). Use the worked example as the
template/tone reference for every other reading.

## Where files go

- **Input**: drop each reading's NotebookLM prompt PDF into
  `docs/readings/` (create the folder; not yet in the repo).
- **Output**: one LectureFlow outline `.txt` per reading in
  `docs/outlines/`, named after the reading (e.g. `r3-flight-and-locomotion.txt`).
  These are meant to be pasted into the **Outline** screen's textarea (or
  uploaded as a `.txt`/`.md` file via "upload outline") and built with one
  click — they are not committed decks, just the source text.

## LectureFlow outline format (recap)

```
# Deck title
Presenter: name (optional)
Design: free-text mood/colour notes (optional — picks the accent palette)

1. TYPE: title | roadmap | section | content | takeaway
   HEADLINE: the slide heading
   LAYOUT: (optional) annotated | comparison | timeline | quote | statement |
           gallery | cinematic | figure grid | ...
   POINTS:
   - one idea per bullet — short phrases; LectureFlow auto-compresses
     anything over ~8 words and moves the full sentence to speaker notes
   CALLOUT: a single highlighted stat or quote (optional)
   FIGURE: what the central image should show (optional but recommended)
   NOTES: speaker notes (optional)
```

Parsing is lenient (see `parseOutline` in `app.js`): field names are
case-insensitive, `## Heading` / `---` also start slides, bare `- ` lines
count as points, and `TYPE:`/`LAYOUT:` do fuzzy matching (e.g. `agenda` →
`roadmap`, `versus` → `comparison`, `figure grid`/`gallery`/`grid` →
`figureGrid`). `Design:` notes are matched against a handful of color words
(`ocean`→blue/sea, `forest`→green, `ember`→warm/orange, `plum`→purple,
`slate`→grey; anything else, including "navy"/"gold"/"indigo", defaults to
the `indigo` accent).

## Slide-type mapping

| NotebookLM slide                    | LectureFlow `TYPE`     | `LAYOUT`          | Notes |
|---|---|---|---|
| `TITLE SLIDE`                       | `title`                 | `quote` if there's an opening quote, else omit | put the framing quote in `CALLOUT` |
| `HOOK` / any plain content slide    | `content`               | omit (annotated default), or `figure grid` if the `PHOTO:` line describes a collage/multiple species | |
| `ROADMAP` (numbered ①–⑤ list)        | `roadmap`               | — | drop the circled numbers, roadmap auto-numbers; no `FIGURE:`/`CALLOUT:` needed — matches the source's "Typographic, no photo needed" note |
| `SECTION HEADER — N <name>`         | `section`               | — | keep minimal: HEADLINE + FIGURE + one CALLOUT line; move any bullets to NOTES |
| Content slide whose `PHOTO:` line says "collage" / "mosaic" / lists several species | `content` | `figure grid` | each point becomes a per-figure caption |
| `CHALLENGE QUESTION #N`             | `content`               | `statement` | headline = short framing title; the question itself goes in `CALLOUT`; the setup facts become `POINTS`; discussion guidance goes in `NOTES` |
| `COMPETENCY QUIZ + BIG PICTURE` (closing slide) | `takeaway`  | — | see below |

## Field-by-field rules

- **`PHOTO:` → `FIGURE:`** — strip all the NotebookLM photo-sourcing
  boilerplate ("Real HD photo", "Sources: Shutterstock/Getty/...", "ZERO
  AI-generated") and keep only the *subject description*, lightly rewritten
  as a search-friendly phrase (LectureFlow's Fill-figures / auto-suggest
  seeds its image search from this text against Openverse, Wikimedia,
  Unsplash and Pexels). When the PDF offers an "OR" choice between two
  species, pick the more specific/visually striking one for `FIGURE:` and
  optionally mention the alternative — LectureFlow's image panel shows
  "alternatively…" subjects as extra search chips automatically.
- **Bullets** — the NotebookLM bullets are already short punchy phrases
  (≤8 words), which is exactly what `POINTS:` wants. Carry them over near
  verbatim, just de-robotify stray ALL-CAPS/arrows (`→` → "becomes"/"leads
  to") and drop any bullet that's purely a restatement of the `TAKEAWAY`.
- **`TAKEAWAY:` → `CALLOUT:`** — for `content` slides, the takeaway line is
  almost always a perfect `CALLOUT:` (LectureFlow renders it as the wide
  highlighted banner). For `section` headers, also use it as `CALLOUT:` —
  it works as the section's tagline. For the final quiz slide, fold it into
  the `takeaway` slide's `CALLOUT:`.
- **Standing instructions (Part 1)** — discard, with two exceptions worth
  preserving as a one-line reminder in the deck's `Design:`/header or in
  the first slide's `NOTES:`:
  - *"Use the exact species names and data from the reading; when a species
    is named, find that exact species"* — keep this as guidance for whoever
    runs Fill-figures, since it affects which photo gets picked.
  - The overall color mood (dark navy + gold) → pick a `Design:` phrase.
    None of LectureFlow's keyword triggers match "navy"/"gold" so it lands
    on the default `indigo` accent, which is a reasonable match. If a
    reading's mood is more clearly blue/green/warm/purple/grey, use that
    word instead (`ocean`/`forest`/`ember`/`plum`/`slate`).
- **Challenge questions** — these are discussion prompts, not slide content
  to memorize, so `LAYOUT: statement` (a big headline + a few supporting
  points) fits better than the annotated-figure default. Put the actual
  question text in `CALLOUT:` (it'll render large), the given facts as
  `POINTS:`, and any "what to listen for" guidance in `NOTES:`.
- **Competency quiz (final slide)** — don't try to cram 5 MCQs × 4 options
  onto one slide; LectureFlow has no quiz widget and it would be unreadable.
  Instead:
  1. Turn the slide into `TYPE: takeaway` with a headline like "Every
     Feature Is an Adaptation" (or reuse the reading's own framing).
  2. Write 4-5 `POINTS:` that are *concept* recaps (one per quiz question's
     underlying idea, in LectureFlow's punchy phrase style) — these render
     as the bold numbered takeaway cards, which doubles as a nice visual
     recap.
  3. Move the full MCQ text (with the answer key, since LectureFlow never
     displays `NOTES:` to the audience) into `NOTES:` as a teacher-facing
     quiz bank for in-class or homework use.
  4. Use the original closing `TAKEAWAY:` line as `CALLOUT:`.

> **Parser gotcha:** never start a `NOTES:` (or any) line with `N.`/`N)`/`N:` —
> `parseOutline`'s slide-start regex matches that pattern even inside a notes
> block and will split it into a new (figure-less, callout-less) slide. Write
> quiz items as `Question 1 — ...`, not `1. ...`.

## Worked example

`docs/outlines/r2-what-defines-a-bird.txt` is the full 25-slide conversion of
the attached "Reading #2 — What Defines a Bird?" prompt, following every rule
above. To sanity-check a converted outline, paste it into LectureFlow's
**Outline** screen and click **Build deck** — it should produce a complete,
image-ready deck with no parse errors (every slide gets a `FIGURE:` so
Fill-figures has something to search for).

## Suggested process for a future session

For each new reading PDF in `docs/readings/`:

1. Read the PDF; skim Part 1 only to note the color mood (for `Design:`) and
   confirm there's nothing reading-specific buried in the "standing
   instructions" (there shouldn't be — it's meant to be reused verbatim
   across readings).
2. Walk Part 2 slide-by-slide, applying the mapping table and field rules
   above. Use `docs/outlines/r2-what-defines-a-bird.txt` as the formatting
   template.
3. Write the result to `docs/outlines/<short-name>.txt`.
4. Optionally smoke-test by pasting into the Outline screen in a running
   copy of the app (see the `/tmp/ui-*.js` Playwright tests for how to drive
   `#btn-outline-build` headlessly) and confirming the slide count and that
   every content/section slide ends up with a non-empty `FIGURE:`.
5. Commit the new outline file(s) — they're small text files, safe to keep
   in the repo as a library the teacher can re-open and tweak per class.

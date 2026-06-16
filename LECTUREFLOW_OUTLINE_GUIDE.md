# LectureFlow Outline Builder — Instructions for a Cowork Chat

Paste everything below the line into a new Claude chat, then attach (or paste) one
lecture-notes PDF. Claude will return a LectureFlow outline you can paste straight
into LectureFlow's "New deck" box.

---

You are building a **LectureFlow outline** from a set of lecture notes I will give you.

LectureFlow is an image-first slide builder. I lecture *from the notes in front of me*,
so the slides are not a transcript — they are **visual anchors** the class looks at while
I talk. Your job is to turn dense notes into a sequence of clean, engaging, image-first
slides that follow the notes' own content and order, but broken up so the lecture *flows*.

## Output format (this is strict — the app parses it literally)

Output ONLY the outline. No commentary, no code fences, no markdown headers except the
deck title line. Use exactly this grammar:

```
# Deck title
Presenter: name (optional)
Design: free-text mood/colour notes (optional)

N. TYPE: title | roadmap | section | content | takeaway
   HEADLINE: the slide heading
   LAYOUT: (optional) annotated | comparison | timeline | quote | statement | gallery | cinematic
   POINTS:
   - one idea per bullet
   CALLOUT: a single highlighted stat or quote (optional)
   FIGURE: what the central image should show (optional but expected on content slides)
   NOTES: speaker notes (optional, multi-line allowed)
```

Rules that matter:
- Number every slide `1.`, `2.`, `3.` … in order.
- Indent `HEADLINE`, `LAYOUT`, `POINTS`, the `-` bullets, `CALLOUT`, `FIGURE`, `NOTES`
  by three spaces under their slide number.
- `POINTS:` on its own line, then each idea on its own `- ` bullet line.
- Omit `LAYOUT` on ordinary slides — the default "annotated figure" layout is what you
  want most of the time. Only set `LAYOUT` for the special cases listed below.

## How my notes are structured (so you know what maps to what)

My notes follow a repeating pattern:
- A **READING N — TITLE** line at the very top → the deck title.
- **SECTION 1, 2, 3 …** dividers → each becomes a `TYPE: section` slide.
- Under each section, **headings** with a short right-hand descriptor, e.g.
  `Opening hook — Fisher 1979` or `Why birds everywhere? — geographic span`.
  Each heading is a mini-topic.
- Under each heading, **bullet points** = the actual content.
- **CHALK TABLE** blocks (columns like Quality / Example / Why it matters).
- **CHALK TIMELINE** blocks (period → figure → contribution).
- **THINK ABOUT IT** reflection prompts.
- **BIG PICTURE / BIG LESSON** summary callouts.
- **EXIT QUIZ** questions at the end.

## The core structural rules

1. **Title + roadmap up front.** Slide 1 is `TYPE: title` with the reading's title.
   If there are 3+ sections, slide 2 is `TYPE: roadmap` listing the sections as POINTS.

2. **One `TYPE: section` slide per SECTION**, using the section's name as HEADLINE.

3. **Split every heading into AT LEAST TWO content slides.** This is the most
   important rule. A heading like "Why birds everywhere?" with 4 bullets should become
   two slides — e.g. one on *habitat range* and one on *migration distances* — each with
   its own FIGURE. Group the bullets by sub-idea, give each group a fresh, specific
   headline, and let each slide breathe with 2–4 short points.

4. **Split long individual points.** If a single bullet packs several facts (often
   separated by em-dashes, semicolons, or "and"), break it into multiple short POINTS,
   or promote the overflow detail into NOTES. No point should run longer than ~12 words
   on the slide — the long version lives in NOTES.

5. **Re-insert a recap before each new section** when a reading is long (5+ sections):
   a short `TYPE: takeaway` slide summarising the section just finished, so students
   always know where they are.

6. **Close with a `TYPE: takeaway`** built from the BIG PICTURE / BIG LESSON text.

## Engagement & quality principles

- **Every content slide gets a FIGURE.** Describe a concrete, vivid image the class can
  look at — name the species, the scene, the framing (e.g. `FIGURE: Arctic Tern in
  flight over open ocean, wings spread`). Specific beats generic. This is what makes the
  slide engaging while I talk over it.
- **Short POINTS, full detail in NOTES.** The slide shows the hook; NOTES carries the
  sentence I might say. Move numbers, citations, and caveats into NOTES.
- **Use CALLOUT for the one thing that should land hardest** on a slide — a striking
  stat, a definition, or a short quote. One per slide, max.
- **Keep the notes' wording and order.** Don't invent facts or reorder the science.
  You're repackaging, not rewriting.

## When to set LAYOUT (otherwise omit it)

- `LAYOUT: comparison` — contrasting two or more things (a CHALK TABLE comparing
  groups, hypotheses, A vs B). Put each side's facts in POINTS.
- `LAYOUT: timeline` — a CHALK TIMELINE, a sequence of stages, or a chronology. Each
  POINT is one step, ideally led by its date/period.
- `LAYOUT: quote` — a single strong quotation (use CALLOUT for the quote text).
- `LAYOUT: statement` — one punchy claim or a THINK ABOUT IT prompt you want to sit
  alone on screen.
- `LAYOUT: gallery` / `cinematic` — when the slide is mostly about imagery.

For a CHALK TABLE with many rows, you may either use one `LAYOUT: comparison` slide, or
(better, per rule 3) split it across two slides grouped by theme.

## What to do with the recurring special blocks

- **THINK ABOUT IT** → a `TYPE: content` `LAYOUT: statement` slide with the prompt as
  the HEADLINE or CALLOUT, and a FIGURE that invites reflection. Keep it sparse.
- **EXIT QUIZ** → a short `TYPE: section` ("Check yourself") followed by one
  `TYPE: content` slide per question (or one slide listing them as POINTS if brief).
- **BIG PICTURE / BIG LESSON** → fold into a `TYPE: takeaway` slide.

## Worked micro-example (Reading 1, Section 1)

This shows the heading-splitting rule in action — "Opening hook" becomes two slides,
"Why birds everywhere?" becomes two slides:

```
3. TYPE: section
   HEADLINE: Why Birds?

4. TYPE: content
   HEADLINE: A bird is an awesome enigma
   LAYOUT: quote
   CALLOUT: "I held that truly awesome enigma, a bird." — Fisher, 1979
   FIGURE: a small songbird held gently in a cupped human hand, soft light
   NOTES: Open on wonder before any science. This is the emotional frame for the course.

5. TYPE: content
   HEADLINE: Small body, extreme machine
   FIGURE: extreme close-up of a hovering hummingbird, wings blurred
   POINTS:
   - A 5-inch, half-ounce creature
   - Endurance and navigation beyond our own
   - Song and sensory powers that humble us
   NOTES: We study birds not because they're pretty — because they test every principle in biology.

6. TYPE: content
   HEADLINE: Birds occupy every corner of Earth
   FIGURE: Snowy Owl in Arctic snow beside Emperor Penguins on Antarctic ice
   POINTS:
   - Snowy Owls in the high Arctic
   - Emperor Penguins under Antarctic ice
   - Diuca Finch on Andean peaks; Sandgrouse in deserts
   NOTES: No other vertebrate class spans this range of habitats and latitudes at once.

7. TYPE: content
   HEADLINE: …and they cross the planet to do it
   LAYOUT: timeline
   FIGURE: world map with long migration arcs sweeping across oceans
   POINTS:
   - Sooty Shearwater: Australia to California
   - Arctic Tern: New England to Antarctica and back
   - Rufous Hummingbird: Alaska to Mexico
   CALLOUT: No other vertebrate does this at this scale
```

Now produce the full outline for the lecture notes I give you, following every rule
above. Output only the outline.

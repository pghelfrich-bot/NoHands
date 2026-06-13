# LectureFlow

A presentation builder for teachers and presenters who want clean, **image-first, story-driven decks** instead of bullet-point dumps. Subject-agnostic: it works for any lecture or talk.

It solves two problems:

1. **Text gets dumped as bullet lists** instead of annotating a strong central image. LectureFlow's layout engine renders points as *short annotation labels placed around the central figure*, connected to it with thin curved lines — never a vertical wall of bullets. Long points are compressed to phrases; the detail moves to speaker notes.
2. **Finding usable, properly licensed images is slow** and results are often broken or low quality. The built-in image panel searches only royalty-free / openly-licensed providers through their official APIs, silently skips broken thumbnails, and carries license + attribution through to export.

## Quick start

No build step, no install, no server:

```
open index.html        # macOS — or just double-click it in any modern browser
```

Click **Load sample → Build deck** to see the whole flow in ten seconds.

## Workflow

**Paste an outline → get a formatted deck → drop in images → export.**

### 1. The outline

Plain text / markdown, via paste or file upload. A deck header (title, presenter, date, free-text design notes) followed by numbered slides:

```
# Deck title
Presenter: name
Date: any text
Design: ocean blues, calm        ← free text; color words pick the deck's palette

1. TYPE: title | roadmap | section | content | takeaway
   HEADLINE: slide heading
   POINTS:
   - a point (long ones are compressed; detail goes to speaker notes)
   CALLOUT: a highlighted stat or quote
   FIGURE: what the central image should show
   NOTES: speaker notes
```

Parsing is lenient: `## Headings` and `---` separators also start slides, field names are case-insensitive, bare bullets count as points, fuzzy types work (`agenda → roadmap`, `summary → takeaway`…), and a title slide is synthesized if the outline lacks one. The result appears instantly as editable slides.

### 2. The layout engine (the anti-bullet-dump part)

Every slide is auto-laid-out by type with a consistent design system — dark layouts for **title / roadmap / section / takeaway**, light for **content** (override per slide with the Theme selector):

- **content + figure** — points become short labels around the central image, linked by curved connector lines that re-route live as you drag things.
- **content, no figure** — a clean numbered multi-panel layout. Never an empty image box.
- **roadmap** — numbered stops with directional arrows (horizontal ≤ 5 stops, vertical above).
- **section** — giant part number + headline.
- **takeaway** — one big centered statement, points as a footer strip.

A shared motif (corner arcs, accent rules, a flow arrow in the bottom-right of every slide — a square on the last) keeps visual direction across the deck. The accent palette is picked from the outline's `Design:` notes (ocean, forest, ember, plum, slate, indigo).

### 3. The image panel (licensed sources only)

Tied to the selected slide; the query is auto-seeded from that slide's `FIGURE` text (the dashed "suggested figure" chip on the canvas also triggers a search).

- **Providers:** Openverse and Wikimedia Commons (keyless), plus Unsplash and Pexels with your own API keys (⚙ Settings; keys live only in your browser's localStorage). **No AI-generated images.**
- Every result shows its **author and license**; the attribution is stored with the image, shown as a small credit line on the slide, and carried into every export (plus an auto-generated *Image credits* slide).
- Thumbnails that fail to load are **silently skipped** — you only see images that work.
- Insert by **click or drag** onto the slide. Inserted images are embedded as data-URLs so exports are self-contained (Unsplash inserts also ping the official download endpoint per API guidelines).
- **Cutout** — toggle in the panel (applies on insert) or the ✂ button (selected image): removes the background so the subject floats over the slide. Uses remove.bg if you add a key in Settings, otherwise a built-in in-browser edge flood-fill remover. Toggle off restores the original.

### 4. Editing

Direct manipulation on the canvas: drag labels and images, resize images (corner handle), layer them (▲ ▼), click any text to edit in place (double-click for annotation labels), per-slide type & theme switches, ✦ Re-layout to reset to the automatic layout, ＋ Label to add annotations. Reorder slides by dragging in the left thumbnail rail; duplicate/delete from the toolbar. Speaker notes live under the canvas.

### 5. Export & present

- **PowerPoint (.pptx)** — real editable shapes/text/images via PptxGenJS (loaded from CDN on first use), including connector lines, panels, notes, per-slide credits, and the credits slide.
- **PDF** — one slide per page through the browser's print dialog.
- **Standalone HTML** — a single self-contained file with keyboard/click navigation.
- **Present mode** — fullscreen; `←`/`→` navigate, `S` toggles speaker notes, `Esc` exits.

Decks autosave to localStorage; the **Decks** button lists, reopens, and deletes them.

## Privacy

Everything runs client-side. Searches go directly from your browser to the image providers; the only data stored is in your browser's localStorage (decks, settings, API keys). Don't store keys you care about on a shared machine.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell: outline screen, editor, image panel, modals |
| `styles.css` | App chrome (slide visuals live in `SLIDE_CSS` inside `app.js` so editor, present mode, and exports render identically) |
| `app.js` | Everything: outline parser, layout engine, slide renderer, editor interactions, image providers, cutout, exports, present mode, persistence |

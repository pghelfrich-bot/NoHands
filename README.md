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

## Home & decks

The **Home** screen (the LectureFlow logo, or the Home button) is your deck library: every saved deck appears as a card with a live thumbnail and **Open / Copy / Download (.json) / Delete** actions. Organise decks into **folders** (e.g. one per class) from the sidebar — filter by folder, move a deck via its card menu, or drag a card onto a folder. You can **import** a previously downloaded `.json` deck too.

## Workflow

**Paste an outline → get a formatted deck → choose a layout → drop in images → export.**

Everything you place is editable by direct manipulation: select any text box or image to get **8-direction resize handles** (drag a side to resize, a corner to rescale, vertical drags rescale the font), drag to reposition, and delete (text boxes can be restored with **Undo**). Add free text boxes with **＋ Text**. Full **Undo/Redo** (toolbar buttons or Ctrl/Cmd+Z / Shift+Z / Y) covers every edit.

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

Every slide is auto-laid-out with a consistent design system — dark layouts for **title / roadmap / section / takeaway**, light for **content** (override per slide with the Theme selector). The **Layout tab** in the right sidebar offers pickable, schematic-previewed arrangements; switching one reflows the slide's text and images, and you can fine-tune by dragging afterwards.

Content slides have **12 layouts**:

- **Annotated figure** — points become short labels around a central image, linked by curved connector lines that re-route live as you drag.
- **Annotated cards** — points become discrete, bordered, numbered cards you can freely move and resize around a central image, linked by the same curved connectors.
- **Figure left / right**, **Spotlight** — image beside a list of points.
- **Image band** — a wide image with panels beneath.
- **Numbered panels** — clean cards (the default when there's no image; never an empty image box).
- **Two columns** — side-by-side comparison.
- **Timeline** — numbered steps with directional arrows.
- **Statement** — a large headline with a few supporting points.
- **Quote** — a big centred pull-quote.
- **Gallery** — a grid of images.

Title/section/takeaway add left / centered / quote variants; roadmap is numbered stops with arrows. A shared motif (corner arcs, accent rules, a flow arrow bottom-right of every slide — a square on the last) keeps visual direction across the deck. The accent palette is picked from the outline's `Design:` notes (ocean, forest, ember, plum, slate, indigo).

### 3. The image panel (licensed sources only)

Tied to the selected slide; the query is auto-seeded from that slide's `FIGURE` text (the dashed "suggested figure" chip on the canvas also triggers a search).

- **Providers:** Openverse and Wikimedia Commons (keyless), plus Unsplash and Pexels with your own API keys (⚙ Settings; keys live only in your browser's localStorage). **No AI-generated images.**
- **Auto-suggest:** opening a slide automatically shows the ~15 most relevant images (seeded from its FIGURE) so you can drop one in immediately — toggle with the **Auto** switch.
- Results are shown **one per row at full size** (never cropped or overlapping) with the **author and license** beneath each. Attribution is stored with the image, shown as a credit line on the slide, and carried into every export (plus an auto-generated *Image credits* slide).
- Thumbnails that fail to load are **silently skipped** — you only see images that work.
- Insert by **click or drag** onto the slide. Inserted images are embedded as data-URLs so exports are self-contained (Unsplash inserts also ping the official download endpoint per API guidelines).
- **Cutout** — toggle in the panel (applies on insert) or the ✂ button (selected image): removes the background so the subject floats over the slide. Uses remove.bg if you add a key in Settings, otherwise a built-in in-browser remover that **region-grows along colour gradients** with feathered edges, so it handles coloured and softly-varying backgrounds, not just flat white. Toggle off restores the original.

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

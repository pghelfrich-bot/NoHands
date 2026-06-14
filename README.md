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

Everything you place is editable by direct manipulation: select any text box or image to get **8-direction resize handles** (drag a side to resize, a corner to rescale, vertical drags rescale the font), drag to reposition, and delete (text boxes can be restored with **Undo**). Every text box — headlines, labels, callouts, free text — is double-click-to-edit and can be **aligned left / centre / right** with the **L / C / R** buttons that appear in the toolbar when a text element is selected (disabled for images), and its **text colour** and **background fill** can be set with the colour pickers next to them (⟲ resets the text colour, ⊘ clears the fill). Add free text boxes with **＋ Text** — they default to a large, legible size and **auto-fit their content** (the box hugs whatever you type and never clips a word, wrapping only past a sensible width), so you can just drag them into place rather than resizing; dragging a side handle switches a box to a fixed width when you do want one. **Shift-click** additional text boxes or labels to build a multi-selection: a shared bounding box with 8 handles appears, dragging it scales every selected element (and its font size) together proportionally, dragging any selected element moves the whole group, and **Esc** clears the selection.

**Recurring elements** (**↻ Recurring**) let you define a text block *once* and have it appear on every slide — perfect for a persistent etymology block, motto, or running label. Place, edit, recolour, or delete it on any slide and the change applies everywhere; a small **scope** selector chooses whether it shows on *all* slides or only one slide type (content / title / section / takeaway / roadmap). In the editor a recurring element carries a faint violet dashed marker so you know it's shared; that marker never appears in exports. Full **Undo/Redo** (toolbar buttons or Ctrl/Cmd+Z / Shift+Z / Y) covers every edit.

**Free arrows** (**→** in the toolbar) draw a straight arrow anywhere on the slide — handy for pointing between two figures, sketching a process flow, or annotating a relationship that the layout engine doesn't connect automatically. A new arrow drops onto the slide already selected, with a draggable dot on each end: drag a dot to re-aim that end, or drag anywhere along the shaft to move the whole arrow. Its colour can be set with the same colour picker used for text. Arrows carry into PPTX export as connector lines.

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

Content slides have **14 layouts** (**Annotated figure** is the default for image/figure slides):

- **Annotated figure** — points become filled "chip" labels, automatically sized to fit their full text (no clipping, no manual resizing needed), stacked in two columns beside a central image. Each chip can be toggled between two readable presets with the **◐** button in the toolbar: a dark fill with white lettering (default), or a beige fill with dark lettering. The slide's one big takeaway — its CALLOUT, or the last point if there's no callout — becomes a wide, larger banner across the bottom instead of competing with the other chips, driving home the slide's main point. Connector lines are off by default; turn on **black or white arrows** (Background tab) to point each chip at the figure (the takeaway banner is never connected). Select a chip and a draggable dot appears on the photo: drop it on a specific feature to **pin** that chip's arrow to that exact spot (double-click the dot to unpin). The pin is relative to the image, so it tracks as you move or resize the photo, and it carries into PPTX. Once the image is in place, just drag the chips and banner around it — the auto-layout aims to need no resizing at all.
- **Cinematic** — one photo runs edge-to-edge as the whole slide, with the headline and a few short points sitting low over an automatic dark-to-clear scrim that keeps the text legible. The most direct, image-forward layout; carries through to HTML/PDF/PPTX with the photo full-bleed beneath the text.
- **Annotated cards** — points become discrete, bordered, numbered cards you can freely move and resize around a central image, with the same optional arrows.
- **Figure left / right**, **Spotlight** — image beside a list of points.
- **Image band** — a wide image with panels beneath.
- **Numbered panels** — clean cards (the default when there's no image; never an empty image box).
- **Two columns** — side-by-side comparison.
- **Timeline** — numbered steps with directional arrows.
- **Statement** — a large headline with a few supporting points.
- **Quote** — a big centred pull-quote.
- **Gallery** — a grid of images.
- **Figure grid** — a multi-figure "scene": several photos side by side, each with its own caption overlaid at the bottom — ideal for comparing specimens, stages, or variants in one shot.

Title/section/takeaway add left / centered / quote variants; roadmap is numbered stops with arrows. The **takeaway** slide is specially highlighted: it carries a "Key takeaway" badge above the headline, and each takeaway point renders as a bold, numbered, bordered card — all editable, movable, and resizable like any other element. A shared motif (corner arcs, accent rules, a flow arrow bottom-right of every slide — a square on the last) keeps visual direction across the deck. The accent palette is picked from the outline's `Design:` notes (ocean, forest, ember, plum, slate, indigo).

**Roadmap recaps** — click **🗺 Recap slides** (left rail) to drop a copy of the roadmap slide in front of every section slide, with that section's stop filled in and tagged **NOW** (the rest dim) so the audience always knows where they are. Each recap is a normal, fully editable roadmap slide — move it, restyle it, or delete it like any other. Click the button again any time after reordering sections or editing the roadmap to drop the old recaps and rebuild them in the right places.

**Fill figures** — click **🖼 Fill figures** (left rail) to step through every slide that's still missing an image, one at a time. Each step auto-searches licensed sources from that slide's FIGURE/headline; click a result to insert it and move on, **Skip this slide →** to leave it for later, or **← Back** to revisit the previous one. Refine the search box and hit Search/Enter if the suggestions miss. **⚡ Rough draft (auto-fill all)** inserts the top working result on every remaining slide in one go and closes the modal — a fast way to get a fully-illustrated draft you can then swap images on individually. If every slide already has an image, the button just confirms there's nothing left to do.

### 3. The image panel (licensed sources only)

Tied to the selected slide; the query is auto-seeded from that slide's `FIGURE` text (the dashed "suggested figure" chip on the canvas also triggers a search).

- **Providers:** Openverse and Wikimedia Commons (keyless), plus Unsplash and Pexels with your own API keys (⚙ Settings; keys live only in your browser's localStorage). **No AI-generated images.**
- **Auto-suggest:** opening a slide automatically shows the ~15 most relevant images (seeded from its FIGURE) so you can drop one in immediately — toggle with the **Auto** switch.
- The search query is **simplified to the main subject** of the FIGURE text (dropping articles, age/gender modifiers, and "alternatively…" asides). If the FIGURE mentions alternates (e.g. "a peacock, alternatively a bird of paradise or a kingfisher"), those appear as **optional chips** above the results — check one to also search for that subject and merge its results in.
- Results are shown **one per row at full size** (never cropped or overlapping) with the **author and license** beneath each. Attribution is stored with the image, shown as a credit line on the slide, and carried into every export (plus an auto-generated *Image credits* slide).
- Thumbnails that fail to load are **silently skipped** — you only see images that work.
- Insert by **click or drag** onto the slide. Inserted images are embedded as data-URLs so exports are self-contained (Unsplash inserts also ping the official download endpoint per API guidelines).
- **Cutout** — toggle in the panel (applies on insert) or the ✂ button (selected image): removes the background so the subject floats over the slide. Uses remove.bg if you add a key in Settings, otherwise a built-in in-browser remover that **region-grows along colour gradients** with feathered edges, so it handles coloured and softly-varying backgrounds, not just flat white. Toggle off restores the original.

The **Background tab** lets you search the same licensed sources for an HD photo to use as a deck-wide background behind every slide, with a **blur slider** to soften it. The blurred photo shows through directly — there's no colour wash over it — and the slide text automatically switches between light and dark (with a legibility halo) to match the photo's brightness, so it stays readable on either a dark or a light background. The tab also has an optional **thin frame** just inside the slide edges and an **annotation arrows** option (off by default, or **black/white arrows** that point from each label to the figure on the Annotated layout). Applies across the editor, present mode, and every export.

### 4. Editing

Direct manipulation on the canvas: drag labels and images, resize images (corner handle), layer them (▲ ▼), click any text to edit in place (double-click for annotation labels), per-slide type & theme switches, ✦ Re-layout to reset to the automatic layout, ＋ Label to add annotations. Reorder slides by dragging in the left thumbnail rail; duplicate/delete from the toolbar. Speaker notes live under the canvas.

### 5. Export & present

- **PowerPoint (.pptx)** — real editable shapes/text/images via PptxGenJS (loaded from CDN on first use), including connector lines, panels, notes, per-slide credits, and the credits slide.
- **PDF** — one slide per page through the browser's print dialog.
- **Standalone HTML** — a single self-contained file with keyboard/click navigation.
- **Present mode** — fullscreen; `←`/`→` navigate, `S` toggles speaker notes, `Esc` exits.
- **Cinematic motion** (Background tab, deck-wide, opt-in) — in Present mode, full-slide photos and backgrounds get a slow Ken Burns drift, and points reveal one at a time as you press `→` (each `→` builds the next point, then advances the slide). The Ken Burns drift also carries into the exported standalone HTML; the step-by-step reveal is a presenter-mode feature.

Decks autosave to localStorage; the **Decks** button lists, reopens, and deletes them.

## Privacy

Everything runs client-side. Searches go directly from your browser to the image providers; the only data stored is in your browser's localStorage (decks, settings, API keys). Don't store keys you care about on a shared machine.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell: outline screen, editor, image panel, modals |
| `styles.css` | App chrome (slide visuals live in `SLIDE_CSS` inside `app.js` so editor, present mode, and exports render identically) |
| `app.js` | Everything: outline parser, layout engine, slide renderer, editor interactions, image providers, cutout, exports, present mode, persistence |

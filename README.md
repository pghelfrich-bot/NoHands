# SlideCraft

A NotebookLM-style **source-grounded presentation maker** — with one deliberate difference: **it never generates AI images**. Every visual slot on a slide is a placeholder with a suggested description, designed for you to fill with **your own** pictures.

## Quick start

No build step, no install, no server required:

```
open index.html        # macOS
# or just double-click index.html in any modern browser
```

(Optionally serve it — `python3 -m http.server` — but `file://` works too.)

## What it does

Everything you'd expect from NotebookLM's slide-deck generator:

1. **Add sources** — upload `.txt` / `.md` / text files or paste text. The deck is grounded in this material.
2. **Generate a deck** — click *Generate slide deck* and customize:
   - focus / special instructions, audience, tone, slide count, language
   - **Two engines:**
     - **Claude API** — high-quality generation grounded in your sources. Enter your own Anthropic API key under ⚙ Settings (stored only in your browser's localStorage; calls go directly from your browser to Anthropic).
     - **Built-in outliner** — no key, no network. Parses markdown headings / paragraphs from your sources into a deck.
3. **Edit** — click any text on the slide to edit in place. Reorder slides by dragging in the filmstrip, add / duplicate / delete, switch layouts (title, section, bullets, bullets + image, full image, quote) and themes (Paper, Midnight, Forest, Sunrise, Slate). Speaker notes per slide.
4. **Present** — fullscreen mode with arrow-key navigation, `S` toggles speaker notes, `Esc` exits.
5. **Export** —
   - **Standalone HTML**: a single self-contained file with built-in navigation (images embedded).
   - **PDF**: one slide per page via the browser's print dialog.
   - **Project JSON**: save/open complete projects (also autosaved to localStorage).

## Your images, not AI art

Where NotebookLM auto-inserts AI-generated illustrations, SlideCraft inserts an **image placeholder** carrying the generator's *suggested* image ("a photo of your team at the launch event") and gives you five frictionless ways to fill it:

- **Upload** — click the placeholder
- **Drag & drop** an image file onto the slide
- **Paste** an image from your clipboard (`Ctrl/Cmd+V`)
- **From URL** — fetched and embedded so exports stay self-contained (falls back to a link if the site blocks cross-origin fetches)
- **Image library** — a per-project gallery of your images; click any to place it on the current slide

Dropping an image on a text-only slide automatically switches it to an image layout.

## Privacy notes

- Projects autosave to your browser's localStorage and never leave your machine unless you use the Claude engine (which sends your sources to the Anthropic API with your key) or insert an image by URL.
- The API key is stored in localStorage only. Don't use this on a shared machine with a key you care about.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell, panels, modals |
| `styles.css` | App chrome + the slide-rendering rules (shared by editor, thumbnails, present mode, and HTML export) |
| `app.js` | All logic: state, editing, generation (Claude + offline), present mode, exports |

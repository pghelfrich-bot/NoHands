# Implementation plan — three deck-building friction reducers

This document specs three features for LectureFlow, written so they can be
implemented one PR at a time with minimal back-and-forth. Everything is vanilla
JS/HTML/CSS in `app.js` / `index.html` / `styles.css` — no build step. Slide
visuals live in `SLIDE_CSS` inside `app.js`; app chrome lives in `styles.css`.

Shared conventions to follow (already used throughout the codebase):

- IDs via `uid()`. Deep-clone with `JSON.parse(JSON.stringify(x))`.
- DOM build via `el(tag, cls, style, text)` and `$()` / `$$()`.
- Persist deck edits with `save()` (debounced) or `saveDeckNow()`; wrap
  user-visible mutations in `checkpoint()` for undo.
- `toast(msg)` for transient feedback.
- After mutating the current slide call `refreshAll()` (rail + canvas + panel).
- Tests live in `/tmp/ui-*.js` (Playwright). Run with:
  `export NODE_PATH=/opt/node22/lib/node_modules; export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers; node /tmp/ui-NAME.js`
  Stub PptxGenJS via `page.route('**/pptxgen.bundle.js', …)` using
  `/tmp/pptxgen.bundle.js`. Viewport 1700×1000. Always run the full suite
  (`ui-phase3`..`ui-phase9`, `ui-boxes`, `ui-cards`, `ui-layouts`, `ui-hotspot`,
  `ui-motion`, `ui-bg`, `ui-bg-export`) before committing.

Recommended PR order: **(1) Deck templates** → **(2) Batch fill-figures** →
**(3) Outline-from-prose**. (3) depends on a small parser addition (`LAYOUT:`
field) that is also independently useful; build that first within PR 3.

---

## Feature 1 — Deck templates ("Save as template" + "Start from template")

### Goal
Let a user turn any deck into a reusable skeleton (structure, slide types,
per-slide layouts, palette, recurring overlays, free-text/label positions) with
the *content* blanked to placeholders, then start a new deck from it. Ship 2–3
built-in starter templates so a first-time user isn't staring at a blank box.

### Data model
A template is a deck-shaped object with content stripped (so it stays small —
**no embedded image data**), plus `template: true` and a `name`.

Store all templates inline under one key (they're small without images):

```js
// add to the LS map near the top of app.js
LS.templates = 'lectureflow.templates';

function templates(){
  try { return JSON.parse(localStorage.getItem(LS.templates) || '[]'); }
  catch (e) { return []; }
}
function saveTemplates(arr){ localStorage.setItem(LS.templates, JSON.stringify(arr.slice(0, 50))); }
```

### Core functions (add near `copyDeck`, ~line 3607)

`deckToTemplate(deck, name)` — clone + strip. Keep structure & styling, blank
text to placeholders, drop images/backgrounds:

```js
const PH = { headline: 'Headline', point: 'Point', callout: 'Key stat or quote',
             text: 'Text', title: 'Deck title' };

function deckToTemplate(deck, name){
  const t = JSON.parse(JSON.stringify(deck));
  t.id = uid(); t.template = true; t.name = (name || deck.title || 'Template').trim();
  t.title = ''; t.presenter = ''; t.date = '';
  t.background = null;                 // never store image data in a template
  // keep: accent, designNotes, frame, motion, arrows
  (t.overlays || []).forEach(o => { o.id = uid(); o.text = o.text ? PH.text : o.text; });
  for (const s of t.slides){
    s.id = uid();
    s.headline = s.headline ? PH.headline : '';
    s.callout  = s.callout  ? PH.callout  : '';   // keep presence (layout depends on it)
    s.figure = ''; s.notes = '';
    s.images = [];
    (s.annotations || []).forEach((a, i) => {
      a.id = uid(); a.text = PH.point + ' ' + (i + 1); a.full = a.text;
      // keep a.x / a.y / a.chip / a.anchor / a.align so positioning survives
    });
    (s.texts || []).forEach(tx => { tx.id = uid(); tx.text = tx.text ? PH.text : tx.text; });
    // keep s.boxes (style overrides, no text), s.type, s.theme, s.layout
  }
  return t;
}
```

`templateToDeck(tpl)` — instantiate a fresh editable deck from a template
(regenerate every id so two decks from one template never collide):

```js
function templateToDeck(tpl){
  const d = JSON.parse(JSON.stringify(tpl));
  delete d.template; delete d.name;
  d.id = uid();
  (d.overlays || []).forEach(o => o.id = uid());
  for (const s of d.slides){
    s.id = uid();
    (s.annotations || []).forEach(a => a.id = uid());
    (s.texts || []).forEach(tx => tx.id = uid());
  }
  return migrateDeck(d);
}
```

`saveTemplate(deck, name)` / `deleteTemplate(id)`:

```js
function saveTemplate(deck, name){
  const arr = templates().filter(t => t.id !== (deck && deck.templateOf));
  arr.unshift(deckToTemplate(deck, name));
  saveTemplates(arr);
  toast('Saved as template');
}
function deleteTemplate(id){ saveTemplates(templates().filter(t => t.id !== id)); }
```

### Built-in starter templates
Define them as readable outline strings and build template objects at load time
by reusing `parseOutline` → `deckToTemplate`. This keeps them maintainable and
guarantees they're valid.

```js
const BUILTIN_TEMPLATE_OUTLINES = [
  { name: 'Taxon / topic overview', outline: `# Topic overview
Design: ocean, calm
1. TYPE: title
   HEADLINE: Topic
2. TYPE: roadmap
   HEADLINE: Today's journey
   POINTS:
   - First theme
   - Second theme
   - Third theme
3. TYPE: section
   HEADLINE: First theme
4. TYPE: content
   HEADLINE: Key idea
   POINTS:
   - Point one
   - Point two
   - Point three
   CALLOUT: A memorable stat or quote
   FIGURE: the central image for this idea
5. TYPE: takeaway
   HEADLINE: The one thing to remember
   POINTS:
   - recap a
   - recap b` },
  // add "Compare & contrast" (uses LAYOUT: comparison) and
  // "Process / lifecycle" (uses LAYOUT: timeline) — see Feature 3 for LAYOUT:
];

function builtinTemplates(){
  return BUILTIN_TEMPLATE_OUTLINES.map(b => {
    const t = deckToTemplate(parseOutline(b.outline), b.name);
    t.id = 'builtin:' + b.name; t.builtin = true;
    return t;
  });
}
function allTemplates(){ return [...builtinTemplates(), ...templates()]; }
```

### UI

**Save as template** — add an action to each deck card (`deckCard`, the
`actions` block ~line 3585) and keep it discoverable from the editor too:

```js
actions.appendChild(mkBtn('Template', 'ghost', 'Save this deck as a reusable template', () => {
  const d = loadDeck(entry.id); if (!d) return;
  const name = (prompt('Template name:', d.title || 'Template') || '').trim();
  if (name) saveTemplate(d, name);
}));
```

**Start from template** — add a button to the home header (`#home-head` in
index.html, next to `#btn-new-deck`):

```html
<button id="btn-from-template" class="btn ghost" title="Start a new deck from a saved skeleton">From template</button>
```

and a modal (mirror `#decks-modal` markup/styles):

```html
<dialog id="templates-modal" class="modal">
  <form method="dialog">
    <h2>Start from a template</h2>
    <p class="modal-sub">A template keeps the structure, layouts, palette, and recurring elements — the content is blanked for you to fill in.</p>
    <ul id="templates-list"></ul>
    <div class="modal-actions">
      <button value="cancel" class="btn primary" type="submit">Close</button>
    </div>
  </form>
</dialog>
```

`renderTemplatesModal()` (model after `renderDecksModal`, ~line 3675): list
`allTemplates()`; each row has a name, a slide-count meta, a **Use** action
(`openDeck(templateToDeck(tpl)); close modal`) and, for non-builtin templates, a
**✕** delete. Wire in `wireUI`:

```js
$('#btn-from-template').addEventListener('click', () => { renderTemplatesModal(); $('#templates-modal').showModal(); });
```

### Edge cases
- Empty template list: show "No saved templates yet — open a deck and click
  *Template* on its card" (built-ins always present, so list is never truly empty).
- A template whose source deck used recurring overlays: overlays are kept with
  placeholder text and fresh ids on instantiation (already handled above).
- Built-in template ids are stable strings (`builtin:NAME`); never write them to
  the user template store, and skip delete for `t.builtin`.

### Test — `/tmp/ui-templates.js`
1. Build sample deck. `saveTemplate(state.deck, 'T1')`.
2. Read `templates()`: assert one entry, `template===true`, every slide
   `images.length===0`, no string in the JSON contains `data:image` (regex over
   `JSON.stringify`), headline/annotation text are placeholders, but
   `slides.length`, each `type`, and each `layout` match the source.
3. `openDeck(templateToDeck(templates()[0]))`: assert editor shows, new deck id
   ≠ template id, annotation ids are all distinct from the template's, slide
   count preserved.
4. `builtinTemplates().length >= 1` and each parses to ≥3 slides.
5. PPTX export builds (>10 KB) from an instantiated template.

---

## Feature 2 — Batch "Fill figures" pass

### Goal
Collapse N per-slide trips to the image panel into one flow: walk every
image-less slide, show the top auto-suggested licensed images, accept/skip with
click or keyboard, plus a one-click "rough draft" that auto-inserts the top hit
on every remaining slide.

### Refactor first (keeps panel behavior identical)

**(a) Extract the provider fan-out** from `runImageSearch` (~line 2509). The
block that builds `merged` becomes a reusable function; `runImageSearch` then
calls it and keeps its own token/status/alt-chip logic.

```js
// fan out to every ready provider for the query (+ optional alt terms),
// interleave + de-dupe; returns { results, failed }
async function fetchImages(query, { limit = 24, alts = [] } = {}){
  const provs = Object.keys(PROVIDERS).filter(k => PROVIDERS[k].ready());
  const queries = [query, ...alts].filter(Boolean);
  const perTerm = await Promise.all(queries.map(async term => {
    const settled = await Promise.allSettled(provs.map(p => PROVIDERS[p].search(term)));
    return {
      lists: settled.map(s => s.status === 'fulfilled' ? s.value : []),
      failed: settled.map((s, i) => s.status === 'rejected' ? PROVIDERS[provs[i]].label : null).filter(Boolean),
    };
  }));
  const seen = new Set();
  const results = interleave(perTerm.map(t => interleave(t.lists)))
    .filter(r => { const k = r.provider + ':' + r.id; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, limit);
  return { results, failed: [...new Set(perTerm.flatMap(t => t.failed))] };
}
```
In `runImageSearch`, replace the inline fan-out/merge with
`const { results: merged, failed: failedProvs } = await fetchImages(q, { limit: auto ? 15 : 48, alts: altTerms });`
(keep the token check immediately after the await, and the existing status text).

**(b) Extract the insert core** from `insertImageFromResult` (~line 2716) so a
specific slide can receive an image without depending on `cur()`:

```js
// load + place + embed a search result onto a specific slide; returns the image
// object (or null on failure). No toasts / no global refresh — callers handle UI.
async function placeResultOnSlide(slide, r, at){
  let src = r.full, dim;
  try { dim = await loadImageDim(src); }
  catch (e) { try { src = r.thumb; dim = await loadImageDim(src); } catch (e2) { return null; } }
  const im = { id: uid(), src, x: 0, y: 0, w: 0, h: 0, cutout: false, cutSrc: null,
    attr: { title: r.title, author: r.author, authorUrl: r.authorUrl, license: r.license,
            licenseUrl: r.licenseUrl, pageUrl: r.pageUrl, sourceName: r.sourceName } };
  Object.assign(im, at
    ? (() => { const w = Math.min(380, dim.w), h = Math.round(w * dim.h / dim.w);
               return { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h }; })()
    : defaultImagePlacement(slide, dim.w, dim.h));
  slide.images.push(im);
  if (r.provider === 'unsplash' && r.downloadLocation && settings.unsplashKey)
    fetch(r.downloadLocation, { headers: { Authorization: 'Client-ID ' + settings.unsplashKey } }).catch(() => {});
  await embedImage(im);
  return im;
}
```
Rewrite `insertImageFromResult(r, at)` to: `checkpoint(); toast('Inserting…');`
`const im = await placeResultOnSlide(cur(), r, at);` then the existing
refresh/cutout/toast tail (guarding `if (!im) { toast('…failed'); return; }`).
This preserves current behavior exactly.

### Worklist
```js
function figureWorklist(){
  return state.deck.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.images.length && (s.figure || s.headline));
}
function slideSeed(s){ return splitFigureTerms(s.figure || s.headline || ''); }
```

### UI
Add a rail-foot button (index.html, in `.rail-foot`):
```html
<button id="btn-fill-figures" class="btn small wide" title="Find a licensed image for every slide that's missing one, in one pass">🖼 Fill figures</button>
```

Modal `#fill-modal`:
```html
<dialog id="fill-modal" class="modal fill-modal">
  <div class="fill-head">
    <h2 id="fill-title">Fill figures</h2>
    <span id="fill-progress" class="muted"></span>
    <span class="spacer"></span>
    <button id="fill-auto" class="btn ghost" title="Auto-insert the top result on every remaining slide">⚡ Rough draft (auto-fill all)</button>
    <button id="fill-close" class="btn ghost">Done</button>
  </div>
  <div id="fill-slidehead" class="fill-slidehead"></div>
  <input id="fill-query" type="search" placeholder="Refine the search…">
  <div id="fill-status" class="status" hidden></div>
  <div id="fill-grid" class="fill-grid"></div>
  <div class="fill-actions">
    <button id="fill-back" class="btn ghost">← Back</button>
    <button id="fill-skip" class="btn ghost">Skip this slide →</button>
  </div>
</dialog>
```
CSS (`styles.css`): `.fill-modal` wide (~720px); `.fill-grid` a 3-col grid of
result cells reusing `.ip-cell` styling; `.fill-slidehead` shows the slide
number + headline + the slide's mini thumbnail (optional: reuse the rail-thumb
renderer).

### Controller (new section in app.js)
State: `let fillList = [], fillPos = 0;`

```js
function openFillFigures(){
  if (!state.deck){ return; }
  fillList = figureWorklist();
  if (!fillList.length){ toast('Every slide already has an image'); return; }
  fillPos = 0;
  $('#fill-modal').showModal();
  fillShow();
}
function fillShow(){
  if (fillPos >= fillList.length){ closeFill(); toast('Done filling figures'); return; }
  const { s, i } = fillList[fillPos];
  $('#fill-progress').textContent = `Slide ${i + 1} · ${fillPos + 1} of ${fillList.length}`;
  $('#fill-slidehead').textContent = s.headline || `Slide ${i + 1}`;
  const seed = slideSeed(s);
  $('#fill-query').value = seed.primary;
  fillSearch(seed.alternates);
}
async function fillSearch(alts = []){
  const grid = $('#fill-grid'); grid.innerHTML = '';
  fillStatus('Searching…');
  const token = ++searchToken;
  const { results } = await fetchImages($('#fill-query').value.trim(), { limit: 9, alts });
  if (token !== searchToken) return;
  if (!results.length){ fillStatus('No results — Skip or refine the search.'); return; }
  const { shown, skipped } = await loadResultCells(grid, results, fillCell,
    n => fillStatus(`${n} image${n === 1 ? '' : 's'}`), () => token !== searchToken);
  if (token !== searchToken) return;
  fillStatus(`${shown} image${shown === 1 ? '' : 's'}${skipped ? ` · ${skipped} skipped` : ''}`);
}
function fillCell(r, imEl){           // like resultCell, but inserts into the worklist slide
  const cell = resultCell(r, imEl);
  cell.replaceWith;                    // (build fresh instead — resultCell binds cur())
  // simplest: clone resultCell's DOM but override the click handler:
  const c = cell.cloneNode(true);
  c.addEventListener('click', () => fillAccept(r));
  return c;
}
async function fillAccept(r){
  const { s, i } = fillList[fillPos];
  checkpoint();
  const im = await placeResultOnSlide(s, r);
  if (!im){ toast('That image failed — try another'); return; }
  refreshRailThumb(i); save();
  fillPos++; fillShow();
}
function fillSkip(){ fillPos++; fillShow(); }
function fillBack(){ if (fillPos > 0){ fillPos--; fillShow(); } }
function closeFill(){ $('#fill-modal').close(); refreshAll(); }

async function fillAuto(){            // rough draft: top working hit on each remaining slide
  $('#fill-auto').disabled = true;
  for (; fillPos < fillList.length; fillPos++){
    const { s, i } = fillList[fillPos];
    $('#fill-progress').textContent = `Auto-filling ${fillPos + 1} of ${fillList.length}…`;
    const seed = slideSeed(s);
    const { results } = await fetchImages(seed.primary, { limit: 6, alts: seed.alternates });
    for (const r of results){
      const im = await placeResultOnSlide(s, r);
      if (im){ refreshRailThumb(i); break; }
    }
  }
  $('#fill-auto').disabled = false;
  save(); closeFill(); toast('Rough draft filled — review and swap any you don\'t like');
}
```
Note on `fillCell`: cleaner than cloning is to factor `resultCell` to accept an
optional `onInsert` callback (`resultCell(r, imEl, onInsert)` defaulting to
`() => insertImageFromResult(r)`), then `fillCell = (r, im) => resultCell(r, im, () => fillAccept(r))`.
Prefer that.

Wire in `wireUI`:
```js
$('#btn-fill-figures').addEventListener('click', openFillFigures);
$('#fill-close').addEventListener('click', closeFill);
$('#fill-skip').addEventListener('click', fillSkip);
$('#fill-back').addEventListener('click', fillBack);
$('#fill-auto').addEventListener('click', fillAuto);
$('#fill-query').addEventListener('keydown', e => { if (e.key === 'Enter') fillSearch(); });
$('#fill-modal').addEventListener('keydown', e => {
  if (e.key === 'Escape') return;                 // dialog closes itself
  if (e.key.toLowerCase() === 's'){ fillSkip(); }
  if (/^[1-9]$/.test(e.key)){ const cells = $$('#fill-grid .ip-cell'); if (cells[+e.key - 1]) cells[+e.key - 1].click(); }
});
```

### Edge cases
- No ready providers needing keys is fine (Openverse + Wikimedia always ready).
- A slide that gets skipped stays in the deck untouched.
- `searchToken` is shared with the panel; reusing it is fine because the modal
  is the only active searcher while open, but reset `lastAutoQuery=null` on close
  so the side panel re-suggests cleanly.
- Network failures during auto-fill: the per-slide loop just leaves that slide
  empty and moves on (no throw).

### Test — `/tmp/ui-fillfigures.js`
Stub providers to avoid network: in the page, override one provider to return a
canned data-URL result, e.g.
```js
await page.evaluate(() => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mbut=';
  PROVIDERS.openverse.search = async () => ([{ provider:'openverse', id:'x'+Math.random(), thumb: png, full: png, title:'t', author:'A', authorUrl:'', pageUrl:'', license:'CC0', licenseUrl:'', sourceName:'OV' }]);
  PROVIDERS.wikimedia.ready = () => false;
});
```
(use a real 1×1 PNG data-URL). Then:
1. Build sample. Assert `figureWorklist().length` equals the count of image-less
   slides with a seed.
2. `openFillFigures()`; assert modal open, grid has cells.
3. Click first cell → assert the worklist slide now has `images.length===1` and
   `fillPos` advanced.
4. `fillSkip()` advances without inserting.
5. `fillAuto()` (after reopening) fills every remaining worklist slide; assert
   all targeted slides end with an image and the modal closes.
6. PPTX export still builds.

---

## Feature 3 — Outline-from-prose (heuristic + AI), format-aware

### Goal
Turn raw prose / lecture notes into a LectureFlow outline (the existing
`# title / N. TYPE / HEADLINE / POINTS / CALLOUT / FIGURE / NOTES` grammar),
biased toward the **annotated-figure** default but mixing in section/roadmap/
takeaway structure and comparison/timeline/quote/statement layouts where the
content fits. Two engines: a deterministic heuristic (no network) and an
AI-assisted one (Claude API from the browser). Output lands in `#outline-text`
for the user to review, then **Build deck →** as today.

### Prerequisite: add a `LAYOUT:` field to the parser
This lets both engines (and hand-written outlines) request a specific layout.

In `parseOutline`'s field map `F` (~line 494) add:
```js
layout: /^(?:layout|format)\s*[:\-]\s*(.+)$/i,
```
In `handleField` add a branch (before the `return false`):
```js
if ((m = line.match(F.layout))) { s.layout = normLayoutName(m[1]); mode = null; return true; }
```
Add the normalizer near `normType` (~line 450):
```js
function normLayoutName(s){
  s = (s || '').toLowerCase();
  if (/compar|versus|vs\b|two col|contrast/.test(s)) return 'comparison';
  if (/time|step|process|sequence|chronolog|stages?/.test(s)) return 'timeline';
  if (/quote|pull|epigraph/.test(s)) return 'quote';
  if (/statement|big idea|hero/.test(s)) return 'statement';
  if (/galler|grid|multi.?image|figure grid/.test(s)) return 'figureGrid';
  if (/cinematic|full.?bleed|edge/.test(s)) return 'cinematic';
  if (/cards?/.test(s)) return 'cards';
  if (/spotlight/.test(s)) return 'spotlight';
  if (/band/.test(s)) return 'bandTop';
  if (/panel/.test(s)) return 'panels';
  const valid = LAYOUTS.content.map(l => l.key);
  return valid.includes(s) ? s : null;     // unknown -> let effContentLayout decide
}
```
`blankSlide` already defaults `layout: null`; `effContentLayout` already ignores
invalid keys, so an unknown `LAYOUT:` is harmless. **Add a test assertion** in
`/tmp/ui-layouts.js` (or the new prose test) that `LAYOUT: timeline` in an
outline yields `slide.layout === 'timeline'`.

### Single source of truth for the format
Define one constant used by the UI hint *and* the AI prompt so they never drift:
```js
const OUTLINE_FORMAT_SPEC = `LectureFlow outline format:
# Deck title
Presenter: name (optional)
Design: free-text mood/colour notes (optional)

N. TYPE: title | roadmap | section | content | takeaway
   HEADLINE: the slide heading
   LAYOUT: (optional) annotated | comparison | timeline | quote | statement | gallery | cinematic
   POINTS:
   - one idea per bullet (long ones are auto-compressed; detail moves to notes)
   CALLOUT: a single highlighted stat or quote (optional)
   FIGURE: what the central image should show (optional but recommended on content slides)
   NOTES: speaker notes (optional)

Guidance: most content slides should be image-first — give them a vivid FIGURE
and 3–5 short POINTS (default annotated layout, so omit LAYOUT). Open with a
TYPE: title slide; add a TYPE: roadmap after it when there are 4+ themes; use
TYPE: section dividers between major parts; end with a TYPE: takeaway. Reach for
LAYOUT: comparison when contrasting two things, LAYOUT: timeline for a sequence
or chronology, LAYOUT: quote for a single strong quotation, LAYOUT: statement
for one punchy claim. Output ONLY the outline, no commentary or code fences.`;
```

### Heuristic engine `proseToOutline(text)`
Deterministic, no network. Returns an outline string.

Algorithm:
1. Normalize newlines. Split into blocks: if markdown headings exist
   (`/^#{1,6}\s+/m`), each heading + its following lines is a block; otherwise
   blocks are blank-line-separated paragraphs.
2. **Title:** first `# H1` if present, else first sentence of the first block
   (truncated ~8 words via the existing `shortenPoint`). Emit `# <title>`.
3. **Sentence split** helper: `text.split(/(?<<=[.!?])\s+(?=[A-Z“"])/)` (guard
   abbreviations minimally — good enough for a draft).
4. For each block → one or more content slides:
   - HEADLINE: the heading text if the block came from a heading; else derive
     from the block's first sentence (`shortenPoint(firstSentence)`), Title-cased.
   - POINTS: the block's sentences, trimmed, dropping fragments < 3 words. Cap at
     5 points/slide; overflow starts a continuation slide
     (`HEADLINE: <headline> (cont.)`).
   - CALLOUT: pick at most one "stat-like" sentence and pull it out of POINTS —
     `STAT = /(\b\d[\d.,]*\s*%?)|\b(first|only|most|largest|smallest|fastest|oldest|never|always)\b|"[^"]{8,}"/i`.
     Prefer the one with a number/percent.
   - FIGURE: `keywordize(headline)` (reuse existing helper) so image auto-search
     gets a seed.
   - LAYOUT (variety, optional):
     - `/\bvs\.?\b|versus|compared with|on the other hand|whereas|unlike/i` in
       the block → `LAYOUT: comparison`.
     - `/\bfirst\b.*\bthen\b|\bfinally\b|\bstage\b|\bstep\b|\b1[89]\d\d\b|\b20\d\d\b/i`
       or ≥3 year-like tokens → `LAYOUT: timeline`.
     - block is essentially one quoted sentence → `LAYOUT: quote` (HEADLINE = the
       quote, no POINTS).
     - very short block (1 strong sentence, no support) → `LAYOUT: statement`.
     - otherwise omit (defaults to annotated).
5. **Structure passes:**
   - Always prepend `1. TYPE: title / HEADLINE: <title>`.
   - If ≥4 content blocks, insert `TYPE: roadmap` as slide 2 whose POINTS are the
     content headlines.
   - If headings define top-level groups (e.g. `#` vs `##`), emit a
     `TYPE: section` slide at each top-level group boundary.
   - If a block starts with `/^(in (summary|conclusion)|overall|to sum up|key takeaway)/i`,
     make it `TYPE: takeaway` (and place it last).
6. Number slides sequentially and join with blank lines.

Keep it a pure function (string → string) for easy testing. ~120 lines.

### AI engine `proseToOutlineAI(text, { key, model })`
Browser → Anthropic Messages API. Requires a key (stored in settings).

```js
async function proseToOutlineAI(text, { key, model }){
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',   // enables browser CORS
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: OUTLINE_FORMAT_SPEC,
      messages: [{ role: 'user', content:
        'Turn the following source material into a LectureFlow outline following the format and guidance exactly. '
        + 'Favour image-first content slides with FIGURE lines; mix in section/roadmap/takeaway structure and '
        + 'comparison/timeline/quote/statement layouts where the content fits.\n\n--- SOURCE ---\n' + text }],
    }),
  });
  if (!res.ok) throw new Error('API ' + res.status + (res.status === 401 ? ' — check your key' : ''));
  const j = await res.json();
  const out = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return out.replace(/^```[\w]*\n?|\n?```$/g, '');     // strip any stray code fences
}
```
Notes:
- Model field is user-editable; default `claude-sonnet-4-6`. Keep it a plain
  string input so users can point at any compatible model.
- Store the key as `settings.anthropicKey`; add a field to the Settings modal
  (`#set-anthropic`) alongside the existing provider keys (wire in the existing
  `#set-save` handler and the `#btn-settings` populate block, ~lines 3753–3766).
- Surface API errors via `toast` and fall back to offering the heuristic.

### UI — prose modal
Add a button on the outline screen (`.outline-actions` in index.html):
```html
<button id="btn-outline-prose" class="btn ghost">✨ Draft from prose</button>
```
Modal:
```html
<dialog id="prose-modal" class="modal prose-modal">
  <form method="dialog">
    <h2>Draft an outline from prose</h2>
    <p class="modal-sub">Paste notes, a textbook passage, or a transcript. LectureFlow drafts a LectureFlow outline (image-first by default) that you can review and edit before building.</p>
    <textarea id="prose-text" spellcheck="false" placeholder="Paste your prose / notes here…"></textarea>
    <div class="row">
      <label class="check"><input type="radio" name="prose-mode" value="heuristic" checked> Quick (offline)</label>
      <label class="check"><input type="radio" name="prose-mode" value="ai"> AI (Claude API)</label>
      <span class="spacer"></span>
    </div>
    <div id="prose-ai-opts" hidden>
      <label class="field">Anthropic API key <input id="prose-key" type="password" placeholder="sk-ant-… (saved in this browser)"></label>
      <label class="field">Model <input id="prose-model" type="text" value="claude-sonnet-4-6"></label>
    </div>
    <div id="prose-status" class="status" hidden></div>
    <div class="modal-actions">
      <button value="cancel" class="btn ghost" type="submit">Cancel</button>
      <button id="prose-generate" class="btn primary" type="button">Generate outline</button>
    </div>
  </form>
</dialog>
```
Behavior (`wireUI`):
- `#btn-outline-prose` → populate `#prose-key` from `settings.anthropicKey`,
  `showModal()`.
- Radio toggles `#prose-ai-opts` visibility.
- `#prose-generate`:
  ```js
  const text = $('#prose-text').value.trim();
  if (!text){ proseStatus('Paste some prose first.', true); return; }
  const mode = document.querySelector('input[name="prose-mode"]:checked').value;
  try {
    let outline;
    if (mode === 'ai'){
      const key = $('#prose-key').value.trim();
      if (!key){ proseStatus('Add an API key (or use Quick mode).', true); return; }
      settings.anthropicKey = key; localStorage.setItem(LS.settings, JSON.stringify(settings));
      proseStatus('Asking Claude…');
      outline = await proseToOutlineAI(text, { key, model: $('#prose-model').value.trim() });
    } else {
      outline = proseToOutline(text);
    }
    $('#outline-text').value = outline;
    $('#prose-modal').close();
    toast('Drafted an outline — review it, then Build deck →');
  } catch (e){ proseStatus('Couldn\'t generate: ' + e.message + ' — try Quick mode.', true); }
  ```
- The user lands back on the outline screen with the textarea populated; the
  existing **Build deck →** path is unchanged.

CSS: `.prose-modal` wide (~640px) with a tall `#prose-text` textarea.

### Edge cases
- AI returns prose/commentary anyway: it still goes into the editable textarea;
  the lenient parser tolerates junk and the user can fix it. The code-fence strip
  covers the common wrapping case.
- Empty/garbage prose → heuristic still emits at least a title slide; guard
  `parseOutline` already synthesizes a title.
- CORS: the `anthropic-dangerous-direct-browser-access` header is required;
  document in README that AI mode calls the API directly from the browser and the
  key is stored only in localStorage (consistent with the existing image keys).

### Tests
- `/tmp/ui-prose.js` (heuristic, no network):
  1. Feed a fixed multi-paragraph prose blob including a sentence with a `%`
     stat and a "compared with" sentence. Call `proseToOutline(blob)` in-page.
  2. `parseOutline(result)` → assert ≥4 slides, slide 0 `type==='title'`, at
     least one slide has a non-empty `callout` (the stat), at least one slide has
     `layout==='comparison'`, every content slide has a `figure`.
  3. `openDeck(parseOutline(result))` works; PPTX builds.
- `LAYOUT:` parser assertion (add to `ui-layouts.js` or the prose test):
  `parseOutline('1. TYPE: content\n HEADLINE: x\n LAYOUT: timeline\n POINTS:\n - a')`
  → `slides.at(-1).layout === 'timeline'`.
- AI (network-stubbed) `/tmp/ui-prose-ai.js`:
  `page.route('https://api.anthropic.com/**', r => r.fulfill({ contentType:'application/json', body: JSON.stringify({ content:[{ type:'text', text:'# T\n1. TYPE: title\n HEADLINE: T' }] }) }))`,
  set a dummy key, run generate in AI mode, assert `#outline-text` is populated
  and Build works.

### README
Add bullets under "1. The outline": the `LAYOUT:` field; the **✨ Draft from
prose** button (Quick offline vs AI mode, key stored locally, image-first
bias). Under the relevant sections add **From template** (Home) and
**🖼 Fill figures** (rail) one-liners.

---

## Cross-cutting checklist for each PR
- [ ] Feature code in `app.js`; markup in `index.html`; chrome styles in
      `styles.css` (slide-visual styles only in `SLIDE_CSS`).
- [ ] New mutations wrapped in `checkpoint()`; persisted via `save()`/`saveDeckNow()`.
- [ ] New buttons have `title=` tooltips matching the app's voice.
- [ ] New `/tmp/ui-*.js` test added and passing; **full suite** re-run green.
- [ ] README updated.
- [ ] Watch the toolbar/`.rail-foot`/modal layouts for wrap regressions
      (precedent: adding toolbar buttons previously bumped `#canvas-toolbar`
      height and shifted the slide — verify heights are stable in a test).

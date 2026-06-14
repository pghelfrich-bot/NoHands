/* ============================================================
   LectureFlow — image-first presentation builder.
   Outline in → typed slides out. Content slides annotate a
   central figure with short labels + connector lines instead
   of bullet walls. Images come only from openly licensed
   providers, with attribution carried through to export.
   ============================================================ */
'use strict';

/* ================= constants ================= */

const SLIDE_W = 1280, SLIDE_H = 720;
const SVGNS = 'http://www.w3.org/2000/svg';

const LS = {
  settings: 'lectureflow.settings',
  index:    'lectureflow.decks',
  current:  'lectureflow.current',
  folders:  'lectureflow.folders',
  deck:   id => 'lectureflow.deck.' + id,
};

const PALETTES = {
  ocean:  { accent:'#38bdf8', accent2:'#5eead4', accentInk:'#0b7cae',
            darkSolid:'#0b1f2e', lightSolid:'#f7fafc',
            darkBg:'linear-gradient(140deg,#06131d 0%,#0b2230 55%,#0e2d40 100%)',
            lightBg:'linear-gradient(165deg,#fbfdfe 0%,#f1f6fa 100%)' },
  forest: { accent:'#4ade80', accent2:'#bef264', accentInk:'#15803d',
            darkSolid:'#0b2017', lightSolid:'#f7fbf8',
            darkBg:'linear-gradient(140deg,#06150e 0%,#0b2017 55%,#103225 100%)',
            lightBg:'linear-gradient(165deg,#fbfefc 0%,#f0f7f2 100%)' },
  ember:  { accent:'#fb923c', accent2:'#fbbf24', accentInk:'#c2570b',
            darkSolid:'#221310', lightSolid:'#fcf9f6',
            darkBg:'linear-gradient(140deg,#170c08 0%,#241410 55%,#33200f 100%)',
            lightBg:'linear-gradient(165deg,#fefcfa 0%,#faf4ec 100%)' },
  plum:   { accent:'#c084fc', accent2:'#f0abfc', accentInk:'#8a3ddb',
            darkSolid:'#1c1228', lightSolid:'#fbf9fd',
            darkBg:'linear-gradient(140deg,#120b1c 0%,#1d1229 55%,#2a1840 100%)',
            lightBg:'linear-gradient(165deg,#fdfcfe 0%,#f6f1fa 100%)' },
  slate:  { accent:'#94a3b8', accent2:'#cbd5e1', accentInk:'#46586c',
            darkSolid:'#151c25', lightSolid:'#f8fafb',
            darkBg:'linear-gradient(140deg,#0e141b 0%,#151c25 55%,#1d2733 100%)',
            lightBg:'linear-gradient(165deg,#fcfdfe 0%,#f2f5f7 100%)' },
  indigo: { accent:'#818cf8', accent2:'#67e8f9', accentInk:'#4f46e5',
            darkSolid:'#131a33', lightSolid:'#f8f9fd',
            darkBg:'linear-gradient(140deg,#0c1124 0%,#141b36 55%,#1c244b 100%)',
            lightBg:'linear-gradient(165deg,#fcfdff 0%,#f2f4fb 100%)' },
};

/* the figure zone on content slides (where the central image lives) */
const FIGZONE = { x:425, y:175, w:430, h:435 };

/* annotation slots around the figure zone (alternating left / right, then bottom, top) */
const ANN_SLOTS = [
  {x:64,  y:190}, {x:928, y:190},
  {x:64,  y:362}, {x:928, y:362},
  {x:64,  y:520}, {x:928, y:520},
  {x:496, y:622}, {x:706, y:80},
];
const ANN_W = 288;
// Free text boxes hug their content by default (so no word is ever clipped and
// you move rather than resize them); they only wrap once they hit this cap, and
// an explicit drag-resize switches them to a fixed pixel width.
const TEXT_AUTO_MAX = 620;

/* Slide visual styles — shared by editor, thumbnails, present mode, and exports */
const SLIDE_CSS = `
.slide{position:relative;overflow:hidden;width:1280px;height:720px;flex:none;
  font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.slide *{box-sizing:border-box;margin:0}
.slide .serif{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif}
.slide.dark{color:#edf3f9}
.slide.light{color:#17252f}
.slide .lf-motif{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}
.slide .lf-img{position:absolute}
.slide .lf-img img{display:block;width:100%;height:100%;-webkit-user-drag:none;user-select:none;pointer-events:none}
.slide .lf-img.photo img{object-fit:cover;border-radius:10px;box-shadow:0 16px 36px rgba(6,14,24,.35)}
.slide .lf-img.bleed img{object-fit:cover;border-radius:0;box-shadow:none}
.slide .lf-img.cut img{object-fit:contain;filter:drop-shadow(0 16px 24px rgba(6,14,24,.38))}
.slide .lf-cinescrim{position:absolute;inset:0;z-index:3;pointer-events:none;
  background:linear-gradient(to top, rgba(6,12,20,.86) 0%, rgba(6,12,20,.55) 24%, rgba(6,12,20,.12) 46%, rgba(6,12,20,0) 64%)}
.slide.cine{color:#fff}
.slide.cine .lf-box,.slide.cine .serif,.slide.cine .lf-ann{color:#fff}
.slide.cine .lf-box{text-shadow:0 2px 16px rgba(0,0,0,.6)}
.slide.cine .lf-ann{text-shadow:0 1px 10px rgba(0,0,0,.7)}
.slide .lf-conn{position:absolute;inset:0;width:100%;height:100%;z-index:20;pointer-events:none}
.slide .lf-arrows{position:absolute;inset:0;width:100%;height:100%;z-index:45;pointer-events:none}
.slide .lf-arrow-hit{stroke:transparent;stroke-width:18;pointer-events:stroke;cursor:grab}
.slide .lf-arrow-end{fill:#38bdf8;stroke:#fff;stroke-width:1.5;pointer-events:auto;cursor:pointer}
.slide .lf-arrow-line.selected{filter:drop-shadow(0 0 3px #38bdf8)}
.slide .lf-ann{position:absolute;z-index:30;width:${ANN_W}px;font-size:19px;line-height:1.32;font-weight:600;letter-spacing:.1px}
.slide .lf-ann::before{content:'';display:block;width:22px;height:3px;border-radius:2px;background:var(--lf-accent);margin-bottom:7px}
.slide.light .lf-ann{color:#1d3142}
/* filled "chip" labels (Annotated figure) — auto-fit to their text, two
   readable presets: dark fill/white text (default) or beige/dark text */
.slide .lf-ann.lf-chip{padding:12px 16px;border-radius:8px;border-left:4px solid var(--lf-accent);
  background:rgba(10,18,28,.72);color:#fff;box-shadow:0 10px 24px rgba(6,14,24,.18)}
.slide .lf-ann.lf-chip::before{display:none}
.slide .lf-ann.lf-chip.lf-chip-light{background:#f6efe2;color:#23303d;box-shadow:0 10px 24px rgba(15,30,45,.10)}
/* the slide's one big takeaway — a CALLOUT or the last point — as a wide bottom banner */
.slide .lf-ann.lf-takeaway-banner{font-size:22px;font-weight:700;line-height:1.42;
  padding:18px 26px;border-radius:8px;border-left:8px solid var(--lf-accent)}
.slide .lf-ann-full{font-size:0.8em;font-weight:500;line-height:1.42;opacity:.85;margin-top:6px;letter-spacing:0;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.slide .lf-anncard{border-radius:12px;padding:12px 16px}
.slide .lf-anncard::before{display:none}
.slide .lf-anncard .lf-ann-full{-webkit-line-clamp:3}
.slide .lf-ann-num{display:flex;align-items:center;justify-content:center;width:24px;height:24px;
  border-radius:50%;background:var(--lf-accent);color:#06222f;font-size:12.5px;font-weight:800;
  margin-bottom:8px;font-family:ui-sans-serif,system-ui,sans-serif}
.slide.light .lf-anncard{background:#ffffff;border:1.5px solid var(--lf-accent);box-shadow:0 8px 22px rgba(15,30,45,.08);color:#1d3142}
.slide.dark .lf-anncard{background:rgba(255,255,255,.06);border:1.5px solid var(--lf-accent)}
.slide .lf-take-chip{position:absolute;z-index:6;height:34px;border-radius:17px;display:flex;align-items:center;
  justify-content:center;font-size:13px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#06222f}
/* caption overlaid on its own figure in a multi-figure "scene" layout */
.slide .lf-ann.lf-figcap{background:rgba(8,16,26,.6);border-radius:8px;padding:9px 12px;
  text-align:center;line-height:1.3;backdrop-filter:blur(1px)}
.slide.light .lf-ann.lf-figcap,.slide.dark .lf-ann.lf-figcap{color:#fff}
.slide .lf-anncard.lf-take{border-width:2.5px;box-shadow:0 14px 30px rgba(15,30,45,.18)}
.slide .lf-anncard.lf-take .lf-ann-num{width:28px;height:28px;font-size:14px}
.slide .lf-anncard.lf-take .lf-ann-text{font-size:1.05em}
.slide .lf-footer{position:absolute;z-index:40;font-size:13px;opacity:.55;bottom:18px;left:26px;letter-spacing:.5px}
.slide .lf-credit{position:absolute;z-index:40;bottom:15px;left:84px;right:170px;font-size:11px;opacity:.55;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.slide .lf-flow{position:absolute;z-index:40;right:26px;bottom:20px;opacity:.85}
.slide .lf-panel{position:absolute;z-index:5;border-radius:14px;padding:18px 20px;overflow:hidden}
.slide.light .lf-panel{background:#ffffff;border:1px solid #e2e9ef;box-shadow:0 6px 18px rgba(15,30,45,.06)}
.slide.dark .lf-panel{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12)}
.slide .lf-callout{position:absolute;z-index:35;border-left:4px solid var(--lf-accent);padding:10px 16px;
  font-size:18px;line-height:1.45;font-style:italic;border-radius:0 10px 10px 0}
.slide.light .lf-callout{background:rgba(255,255,255,.88);color:#22323e;box-shadow:0 6px 16px rgba(15,30,45,.07)}
.slide.dark .lf-callout{background:rgba(255,255,255,.06)}
.slide .lf-fighint{position:absolute;z-index:6;border:2px dashed var(--lf-accent);border-radius:12px;
  padding:10px 14px;font-size:13.5px;line-height:1.4;opacity:.75}
.slide .lf-bg{position:absolute;left:-5%;top:-5%;width:110%;height:110%;object-fit:cover;z-index:0}
.slide .lf-bgscrim{position:absolute;inset:0;z-index:0}
@keyframes lf-kenburns{from{transform:scale(1.02)}to{transform:scale(1.13) translate(-1.4%,-1%)}}
.slide.lf-motion .lf-img.bleed img,.slide.lf-motion .lf-bg{animation:lf-kenburns 26s ease-out both;will-change:transform}
.slide.lf-motion .lf-ann,.slide.lf-motion .lf-panel{transition:opacity .55s ease,transform .55s ease}
.slide .lf-unrevealed{opacity:0;transform:translateY(12px);pointer-events:none}
.slide .lf-anchor{position:absolute;z-index:48;width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;
  border:2.5px solid #fff;background:var(--lf-accent);box-shadow:0 0 0 2px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.45);
  cursor:grab;touch-action:none;opacity:.6}
.slide .lf-anchor.pinned{opacity:1}
.slide .lf-anchor:hover{opacity:1;transform:scale(1.15)}
.slide .lf-anchor:active{cursor:grabbing}
.slide .lf-frame{position:absolute;inset:16px;border:2px solid rgba(20,32,44,.16);border-radius:8px;z-index:46;pointer-events:none}
.slide.dark .lf-frame{border-color:rgba(255,255,255,.4)}
.slide.has-bg .lf-frame{border-color:rgba(255,255,255,.6)}
/* with an HD background showing through (no wash), pick text colour to match the
   photo's brightness and add a legibility halo so it reads on any photo */
.slide.has-bg.bg-light:not(.cine),
.slide.has-bg.bg-light:not(.cine) .lf-box,.slide.has-bg.bg-light:not(.cine) .serif,.slide.has-bg.bg-light:not(.cine) .lf-ann{
  color:#16222c;text-shadow:0 1px 2px rgba(255,255,255,.92),0 0 18px rgba(255,255,255,.7)}
.slide.has-bg.bg-dark:not(.cine),
.slide.has-bg.bg-dark:not(.cine) .lf-box,.slide.has-bg.bg-dark:not(.cine) .serif,.slide.has-bg.bg-dark:not(.cine) .lf-ann{
  color:#f4f8fb;text-shadow:0 1px 4px rgba(0,0,0,.9),0 0 12px rgba(0,0,0,.65)}
`;

const SAMPLE_OUTLINE = `# How Rivers Shape the Land
Presenter: Dr. Maya Chen
Date: Spring term · Geomorphology 101
Design: ocean blues, calm, image-first

1. TYPE: title
   HEADLINE: How Rivers Shape the Land

2. TYPE: roadmap
   HEADLINE: Today's journey
   POINTS:
   - Where rivers begin
   - The power of moving water
   - Erosion and deposition
   - Deltas: where rivers end
   - Why it matters to people

3. TYPE: section
   HEADLINE: Where rivers begin
   FIGURE: mountain stream snowmelt source

4. TYPE: content
   HEADLINE: A river is born in the highlands
   POINTS:
   - Snowmelt and rainfall collect in steep V-shaped valleys
   - The gradient is steepest here, so the water moves fastest
   - Tributaries join and multiply the flow downstream
   - Headward erosion cuts backward into the mountain over millennia
   CALLOUT: Most of a river's energy is spent simply moving water — only a fraction reshapes the land.
   FIGURE: mountain headwater stream cutting through rock
   NOTES: Ask which local rivers students can trace to a source.

5. TYPE: content
   HEADLINE: Moving water is a conveyor belt
   POINTS:
   - Faster water carries larger particles, from silt up to boulders
   - Halve the speed and the largest load a river can move collapses
   - Sediment travels by bouncing, rolling, and floating in suspension
   - Most transport happens in a handful of flood days per year
   FIGURE: muddy sediment-laden river in flood, aerial

6. TYPE: content
   HEADLINE: Erode outside, deposit inside
   POINTS:
   - On a bend, the outside bank is cut away by faster flow
   - The inside of the bend collects a slip-off slope of sand
   - Meanders therefore migrate across the valley over time
   - An abandoned loop becomes an oxbow lake
   CALLOUT: A meander is a self-portrait of the river's past positions.
   FIGURE: aerial photo of winding river meanders and oxbow lake

7. TYPE: section
   HEADLINE: Where rivers end
   FIGURE: river delta from satellite

8. TYPE: content
   HEADLINE: Deltas: the river unloads
   POINTS:
   - Flow decelerates when the river meets standing water
   - Sediment drops in order of size and builds new land seaward
   - Distributary channels split and braid across the deposit
   - Deltas host some of the densest farmland on Earth
   FIGURE: satellite image of a river delta with distributaries

9. TYPE: takeaway
   HEADLINE: Rivers are the slowest sculptors — and the most patient.
   CALLOUT: Every floodplain, terrace, and delta is a memory of moving water.
   POINTS:
   - source
   - transport
   - erosion
   - deposition
`;

/* ================= tiny helpers ================= */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function el(tag, cls, style, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (style) n.style.cssText = style;
  if (text != null) n.textContent = text;
  return n;
}
function svgEl(inner, cls){
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('viewBox', `0 0 ${SLIDE_W} ${SLIDE_H}`);
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = inner;
  return s;
}
function uid(){ return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function escHTML(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function stripHTML(s){ const d = document.createElement('div'); d.innerHTML = s || ''; return d.textContent.trim(); }
function pad2(n){ return String(n).padStart(2, '0'); }

/* words that add no search value — articles, age/sex modifiers, and the
   "photo of / aerial view / detailed" descriptive filler that makes a FIGURE
   prompt too specific for stock image search to match */
const FIGURE_FILLER = new Set([
  'a', 'an', 'the', 'male', 'female', 'juvenile', 'adult', 'baby', 'young', 'old',
  'photo', 'photograph', 'image', 'picture', 'pic', 'illustration', 'diagram', 'render',
  'rendering', 'drawing', 'showing', 'depicting', 'featuring', 'illustrating', 'view',
  'closeup', 'close', 'up', 'detailed', 'high', 'resolution', 'hd', 'aerial', 'shot',
  'scene', 'across', 'through', 'between', 'among', 'amongst', 'comparison', 'versus', 'vs',
]);
/* reduce a phrase to a few concrete search keywords: take the part before any
   comma, split compounds, drop filler words, and cap the length */
function keywordize(text){
  return (text || '')
    .split(',')[0]
    .replace(/[-/]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w && !FIGURE_FILLER.has(w))
    .slice(0, 4)
    .join(' ');
}

/* break a FIGURE prompt like "peacock male, alternatively a bird of paradise
   or a kingfisher" into one simple primary search term plus optional
   alternates, so image search gets short keyword queries instead of one long one */
function splitFigureTerms(text){
  text = (text || '').trim();
  if (!text) return { primary: '', alternates: [] };
  const parts = text
    .split(/\s*,?\s*(?:or\s+)?alternatively\s*,?\s*|\s+or\s+|\s*\/\s*/i)
    .map(p => p.trim())
    .filter(Boolean);
  let [primary, ...rest] = parts;
  primary = keywordize(primary) || keywordize(text);
  const alternates = [...new Set(rest.map(keywordize).filter(Boolean))];
  return { primary, alternates };
}

/* 'rgb(r,g,b)' / 'rgba(r,g,b,a)' -> '#rrggbb' (falls back to black) */
function rgbToHex(rgb){
  const m = (rgb || '').match(/[\d.]+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0, 3).map(n => clamp(Math.round(+n), 0, 255).toString(16).padStart(2, '0')).join('');
}

/* '#rrggbb' + alpha (0-1) -> 'rgba(r,g,b,a)' */
function hexA(hex, alpha){
  const h = (hex || '#000000').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* annotation connector arrows are opt-in and either black or white (off by default) */
const ARROW_COLORS = { black: '#10161d', white: '#ffffff' };
function arrowColor(deck){ return (deck && ARROW_COLORS[deck.arrows]) || null; }

let toastTimer = null;
function toast(msg, ms = 2600){
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

async function getJSON(url, opts = {}, timeoutMs = 14000){
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

function loadImageDim(src, timeoutMs = 16000){
  return new Promise((resolve, reject) => {
    const im = new Image();
    const t = setTimeout(() => { im.src = ''; reject(new Error('timeout')); }, timeoutMs);
    im.onload = () => { clearTimeout(t); resolve({ w: im.naturalWidth || 800, h: im.naturalHeight || 600 }); };
    im.onerror = () => { clearTimeout(t); reject(new Error('load failed')); };
    im.src = src;
  });
}
function blobToDataURL(blob){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
const scriptCache = {};
function loadScript(url){
  if (!scriptCache[url]) scriptCache[url] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.onload = res; s.onerror = () => rej(new Error('script load failed'));
    document.head.appendChild(s);
  });
  return scriptCache[url];
}
function downloadText(filename, text, mime = 'text/html'){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function safeName(s){ return (s || 'deck').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'deck'; }

/* ================= state & storage ================= */

let settings = { unsplashKey:'', pexelsKey:'', removebgKey:'' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(LS.settings) || '{}')); } catch (e) {}

const state = {
  deck: null,        // current deck object
  cur: 0,            // current slide index
  sel: null,         // {kind:'img'|'ann', id}
  selMulti: [],      // sel strings forming a multi-selection (group), when length >= 2
};
let viewScale = 1;
let panelSeedFor = null;

function blankSlide(type = 'content'){
  return { id: uid(), type, headline:'', callout:'', figure:'', notes:'',
           theme:null, layout:null, annotations:[], images:[], boxes:{}, texts:[] };
}
/* fill in fields added in later versions so older saved decks keep working */
function migrateDeck(d){
  if (!d || !d.slides) return d;
  for (const s of d.slides){
    if (!s.boxes) s.boxes = {};
    if (!s.texts) s.texts = [];
    if (s.layout === undefined) s.layout = null;
    if (!Array.isArray(s.annotations)) s.annotations = [];
    if (!Array.isArray(s.images)) s.images = [];
  }
  if (d.background === undefined) d.background = null;
  if (!d.frame) d.frame = false;
  if (!d.motion) d.motion = false;
  if (!d.arrows) d.arrows = 'none';
  return d;
}
function newDeck(){
  return { id: uid(), title:'', presenter:'', date:'', designNotes:'', accent:'indigo', slides:[], background:null, frame:false, motion:false, arrows:'none' };
}
function cur(){ return state.deck ? state.deck.slides[state.cur] : null; }
function palette(deck){ return PALETTES[deck.accent] || PALETTES.indigo; }
function isDark(slide){ return slide.theme ? slide.theme === 'dark' : slide.type !== 'content'; }

function deckIndex(){
  try { return JSON.parse(localStorage.getItem(LS.index) || '[]'); } catch (e) { return []; }
}
function saveIndex(idx){ localStorage.setItem(LS.index, JSON.stringify(idx.slice(0, 100))); }
function folders(){
  try { return JSON.parse(localStorage.getItem(LS.folders) || '[]'); } catch (e) { return []; }
}
function saveFolders(f){ localStorage.setItem(LS.folders, JSON.stringify(f)); }

function saveDeckNow(){
  const d = state.deck;
  if (!d) return;
  try {
    localStorage.setItem(LS.deck(d.id), JSON.stringify(d));
    const all = deckIndex();
    const prev = all.find(e => e.id === d.id);
    const idx = all.filter(e => e.id !== d.id);
    idx.unshift({ id: d.id, title: d.title || 'Untitled deck', updated: Date.now(),
                  count: d.slides.length, folder: prev ? (prev.folder || null) : null });
    saveIndex(idx);
    localStorage.setItem(LS.current, d.id);
  } catch (e) {
    toast('Could not save (browser storage full?) — large images count against the quota');
  }
}
const save = debounce(saveDeckNow, 400);

function loadDeck(id){
  try { return migrateDeck(JSON.parse(localStorage.getItem(LS.deck(id)))); } catch (e) { return null; }
}
function deleteDeck(id){
  localStorage.removeItem(LS.deck(id));
  localStorage.setItem(LS.index, JSON.stringify(deckIndex().filter(e => e.id !== id)));
}

/* ================= outline parser ================= */

function normType(s){
  s = (s || '').toLowerCase();
  if (/title|cover|intro/.test(s))                                return 'title';
  if (/road|agenda|overview|outline|journey|map/.test(s))         return 'roadmap';
  if (/section|divider|chapter|part/.test(s))                     return 'section';
  if (/take|summar|recap|conclu|closing|key/.test(s))             return 'takeaway';
  return 'content';
}

function accentFromNotes(notes){
  const s = (notes || '').toLowerCase();
  if (/ocean|sea\b|blue|water|sky|marine|cool/.test(s))           return 'ocean';
  if (/forest|green|nature|bio|plant|eco/.test(s))                return 'forest';
  if (/warm|amber|orange|sunset|fire|energy|autumn/.test(s))      return 'ember';
  if (/plum|purple|violet|magenta|pink|creative/.test(s))         return 'plum';
  if (/slate|gr[ae]y|mono|minimal|neutral/.test(s))               return 'slate';
  return 'indigo';
}

/* compress a point to a short annotation phrase */
function shortenPoint(t){
  t = t.trim().replace(/\s+/g, ' ');
  let s = t.split(/\s+[—–]\s+|[;:]/)[0];
  const words = s.split(' ');
  if (words.length > 8){
    const clause = s.split(',')[0];
    const cw = clause.split(' ');
    s = (cw.length >= 3 && cw.length <= 8) ? clause : words.slice(0, 8).join(' ');
  }
  // don't end a label on a dangling connective
  const STOP = /^(a|an|the|of|to|in|on|at|by|for|and|or|with|from|into|over|under|as|is|are|was|were|that|which|their|its)$/i;
  const w2 = s.split(' ');
  while (w2.length > 2 && STOP.test(w2[w2.length - 1])) w2.pop();
  s = w2.join(' ').replace(/[.,]\s*$/, '');
  return s;
}

function parseOutline(text){
  const deck = newDeck();
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let s = null;            // current slide
  let mode = null;         // 'points' | 'notes' | null
  let inHeader = true;

  const F = {
    type:     /^type\s*[:\-]\s*(.+)$/i,
    headline: /^(?:headline|heading|title)\s*[:\-]\s*(.+)$/i,
    points:   /^(?:points|bullets|content)\s*[:\-]?\s*(.*)$/i,
    callout:  /^(?:callout|highlight|quote|stat)\s*[:\-]\s*(.+)$/i,
    figure:   /^(?:figure|image|visual|img|photo)\s*[:\-]\s*(.+)$/i,
    notes:    /^(?:speaker\s*notes?|notes?)\s*[:\-]\s*(.*)$/i,
  };
  const BULLET = /^[-*•·▪]\s+(.+)$/;
  const NUMPT  = /^\d+[\.\)]\s+(.+)$/;
  const SLIDE  = /^(?:slide\s*)?(\d+)\s*[\.\):]\s*(.*)$/i;
  const H2     = /^##+\s+(.+)$/;

  const startSlide = (headline) => {
    s = blankSlide();
    s.points = [];
    if (headline) s.headline = headline.trim();
    deck.slides.push(s);
    mode = null;
    inHeader = false;
  };
  const handleField = (line) => {
    let m;
    if ((m = line.match(F.type)))     { s.type = normType(m[1]); mode = null; return true; }
    if ((m = line.match(F.headline))) { s.headline = m[1].trim(); mode = null; return true; }
    if ((m = line.match(F.points)))   { mode = 'points'; const rest = m[1].trim();
                                        if (rest && !/^$/.test(rest)) { const b = rest.match(BULLET); s.points.push(b ? b[1] : rest); }
                                        return true; }
    if ((m = line.match(F.callout)))  { s.callout = m[1].trim(); mode = null; return true; }
    if ((m = line.match(F.figure)))   { s.figure = m[1].trim(); mode = null; return true; }
    if ((m = line.match(F.notes)))    { s.notes = (s.notes ? s.notes + '\n' : '') + m[1]; mode = 'notes'; return true; }
    return false;
  };

  for (const raw of lines){
    const line = raw.trim();
    if (!line){ if (mode === 'notes' && s) s.notes += '\n'; continue; }

    if (/^-{3,}$/.test(line)){ s = null; mode = null; inHeader = false; continue; }

    let m;
    if ((m = line.match(H2))){ startSlide(m[1]); continue; }
    if ((m = line.match(SLIDE))){
      const n = parseInt(m[1], 10);
      const isNext = n === deck.slides.length + 1;
      if (mode !== 'points' || isNext){
        const rest = (m[2] || '').trim();
        startSlide('');
        if (rest && !handleField(rest)) s.headline = rest;
        continue;
      }
      // otherwise: a numbered point inside POINTS
    }

    if (inHeader){
      if ((m = line.match(/^#\s+(.+)$/)))                                { deck.title = m[1].trim(); continue; }
      if ((m = line.match(/^title\s*[:\-]\s*(.+)$/i)))                   { deck.title = m[1].trim(); continue; }
      if ((m = line.match(/^(?:presenter|presented by|by|speaker|author|instructor|teacher)\s*[:\-]\s*(.+)$/i)))
                                                                         { deck.presenter = m[1].trim(); continue; }
      if ((m = line.match(/^date\s*[:\-]\s*(.+)$/i)))                    { deck.date = m[1].trim(); continue; }
      if ((m = line.match(/^(?:design(?:\s*notes?)?|style|look|theme|vibe|notes?)\s*[:\-]\s*(.+)$/i)))
                                                                         { deck.designNotes += (deck.designNotes ? ' ' : '') + m[1].trim(); continue; }
      if (!deck.title){ deck.title = line; continue; }
      deck.designNotes += (deck.designNotes ? ' ' : '') + line;
      continue;
    }

    if (!s) startSlide('');
    if (handleField(line)) continue;

    if ((m = line.match(BULLET)) || (mode === 'points' && (m = line.match(NUMPT)))){
      s.points.push(m[1].trim()); mode = 'points'; continue;
    }
    if (mode === 'notes'){ s.notes += '\n' + line; continue; }
    if (mode === 'points' && s.points.length){ s.points[s.points.length - 1] += ' ' + line; continue; }
    if (!s.headline){ s.headline = line; continue; }
    s.notes = (s.notes ? s.notes + '\n' : '') + line;
  }

  // post-process
  deck.title = deck.title || 'Untitled deck';
  deck.accent = accentFromNotes(deck.designNotes + ' ' + deck.title);
  for (const sl of deck.slides){
    sl.annotations = (sl.points || []).map(pt => {
      const short = shortenPoint(pt);
      return { id: uid(), text: short, full: pt, x: null, y: null };
    });
    const detail = sl.annotations.filter(a => a.full.trim() !== a.text.trim());
    if (detail.length && sl.type === 'content'){
      sl.notes = (sl.notes ? sl.notes.trim() + '\n\n' : '') +
        'Point details:\n' + detail.map(a => '• ' + a.full).join('\n');
    }
    delete sl.points;
  }
  if (deck.slides.length && !deck.slides.some(sl => sl.type === 'title')){
    const t = blankSlide('title');
    t.headline = deck.title;
    t.annotations = [];
    deck.slides.unshift(t);
  }
  return deck;
}

/* ================= layout geometry (shared by DOM renderer & PPTX export) ================= */

function estimateAnnH(text){
  const lines = Math.max(1, Math.ceil((text || ' ').length / 23));
  return 10 + lines * 25;
}
function figRectOf(slide){
  if (!slide.images.length) return { ...FIGZONE };
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
  for (const im of slide.images){
    x1 = Math.min(x1, im.x); y1 = Math.min(y1, im.y);
    x2 = Math.max(x2, im.x + im.w); y2 = Math.max(y2, im.y + im.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function rectEdgePoint(rect, from){
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const dx = from.x - cx, dy = from.y - cy;
  const sx = Math.abs(dx) / (rect.w / 2 || 1), sy = Math.abs(dy) / (rect.h / 2 || 1);
  const s = Math.max(sx, sy, 0.0001);
  return { x: cx + dx / s * 0.94, y: cy + dy / s * 0.94 };
}
/* connector anchor on the label + target on the figure */
function connectorFor(fig, pos, h){
  const cxL = pos.x + ANN_W / 2, cyL = pos.y + h / 2;
  let a;
  if (cxL < fig.x)                a = { x: pos.x + ANN_W + 10, y: cyL };
  else if (cxL > fig.x + fig.w)   a = { x: pos.x - 10,         y: cyL };
  else if (cyL < fig.y)           a = { x: cxL,                y: pos.y + h + 8 };
  else                            a = { x: cxL,                y: pos.y - 10 };
  return { a, t: rectEdgePoint(fig, a) };
}
/* where a leader line should exit a label box, given the point it aims at */
function leaderStart(pos, w, h, target){
  const cx = pos.x + w / 2, cy = pos.y + h / 2;
  const dx = target.x - cx, dy = target.y - cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? { x: pos.x + w + 10, y: cy } : { x: pos.x - 10, y: cy };
  return dy >= 0 ? { x: cx, y: pos.y + h + 8 } : { x: cx, y: pos.y - 10 };
}
/* leader endpoints for one annotation: a pinned hotspot (anchor, normalized
   within the figure box) wins over the default figure-edge target. Shared by
   the DOM renderer and the PPTX exporter so pins export faithfully. */
function annLeader(fig, ann, pos, w, h){
  if (ann && ann.anchor){
    const t = { x: fig.x + clamp(ann.anchor.x, 0, 1) * fig.w, y: fig.y + clamp(ann.anchor.y, 0, 1) * fig.h };
    return { a: leaderStart(pos, w, h, t), t };
  }
  return connectorFor(fig, pos, h);
}
function panelGrid(n, hasCallout){
  const x0 = 80, x1 = 1200, y0 = 168, y1 = hasCallout ? 596 : 652, gap = 20;
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(n / cols));
  const w = (x1 - x0 - (cols - 1) * gap) / cols;
  const h = (y1 - y0 - (rows - 1) * gap) / rows;
  const rects = [];
  for (let i = 0; i < n; i++){
    const c = i % cols, r = Math.floor(i / cols);
    rects.push({ x: x0 + c * (w + gap), y: y0 + r * (h + gap), w, h });
  }
  return rects;
}
/* stacked list of label positions inside a column */
function listPositions(n, x, y0, w, gap, bottom){
  n = Math.max(1, n); gap = gap || 18; bottom = bottom || 640;
  const avail = bottom - y0;
  const rowH = Math.min(110, Math.max(34, (avail - (n - 1) * gap) / n));
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x, y: y0 + i * (rowH + gap), w, h: rowH });
  return out;
}
/* a balanced grid of image zones for the gallery layout */
function galleryZones(n){
  n = Math.max(1, Math.min(n, 6));
  const x0 = 80, y0 = 150, W = 1120, H = 500, gap = 18;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const w = (W - (cols - 1) * gap) / cols, h = (H - (rows - 1) * gap) / rows;
  const z = [];
  for (let i = 0; i < n; i++) z.push({ x: x0 + (i % cols) * (w + gap), y: y0 + Math.floor(i / cols) * (h + gap), w, h });
  return z;
}

/* The set of layouts offered per slide type, with tiny schematic icons. */
const LAYOUTS = {
  content: [
    { key: 'annotated',  label: 'Annotated figure',  needs: 'image' },
    { key: 'cinematic',  label: 'Cinematic',        needs: 'image' },
    { key: 'cards',      label: 'Annotated cards',   needs: 'image' },
    { key: 'figureRight',label: 'Figure right' },
    { key: 'figureLeft', label: 'Figure left' },
    { key: 'spotlight',  label: 'Spotlight' },
    { key: 'bandTop',    label: 'Image band' },
    { key: 'panels',     label: 'Numbered panels' },
    { key: 'comparison', label: 'Two columns' },
    { key: 'timeline',   label: 'Timeline' },
    { key: 'statement',  label: 'Statement' },
    { key: 'quote',      label: 'Quote' },
    { key: 'gallery',    label: 'Gallery' },
    { key: 'figureGrid', label: 'Figure grid' },
  ],
  title:    [{ key: 'titleLeft', label: 'Left' }, { key: 'titleCenter', label: 'Centered' }],
  section:  [{ key: 'sectionLeft', label: 'Left' }, { key: 'sectionCenter', label: 'Centered' }],
  roadmap:  [{ key: 'roadmapAuto', label: 'Auto' }],
  takeaway: [{ key: 'takeawayCenter', label: 'Centered' }, { key: 'takeawayQuote', label: 'Quote' }],
};

function effContentLayout(slide){
  const valid = LAYOUTS.content.map(l => l.key);
  if (slide.layout && valid.includes(slide.layout)) return slide.layout;
  // annotated figure is the go-to for image-first slides; plain text slides fall back to panels
  return (slide.images.length || slide.figure) ? 'annotated' : 'panels';
}

/* Geometry for a content slide under its chosen layout. Consumed by both the
   DOM renderer and the PPTX exporter so every layout looks the same everywhere. */
function contentLayout(slide){
  const n = slide.annotations.length;
  const lay = effContentLayout(slide);
  const out = { lay, annStyle: 'label', anns: [], headline: { x: 80, y: 64, w: 1120, fs: 38 },
                callout: null, figZones: [{ ...FIGZONE }], wantFigure: true, connectors: false,
                bigQuote: false, annDetail: true };

  if (lay === 'cinematic'){
    // one photo runs edge-to-edge; headline + a few short points sit low-left over a scrim
    out.fullBleed = true; out.scrim = true;
    out.figZones = [{ x: 0, y: 0, w: 1280, h: 720 }];
    const head = slide.headline || '';
    out.headline = { x: 80, y: 486, w: 980, fs: head.length > 50 ? 44 : 58 };
    out.annStyle = 'list'; out.annDetail = false;
    out.anns = slide.annotations.slice(0, 3).map((a, i) => ({ x: 80, y: 372 + i * 34, w: 900, fs: 18 }));
    if (slide.callout) out.callout = { x: 80, y: 600, w: 940, fs: 21 };
  } else if (lay === 'panels'){
    out.wantFigure = false; out.annStyle = 'panel';
    out.anns = panelGrid(n, !!slide.callout).map(r => ({ ...r }));
    if (slide.callout){
      const maxY = out.anns.length ? Math.max(...out.anns.map(r => r.y + r.h)) : 600;
      out.callout = { x: 80, y: Math.min(maxY + 14, 632), w: 1120, fs: 18 };
    }
  } else if (lay === 'annotated'){
    // filled "chip" labels stacked in two columns beside the figure, sized to
    // fit their text (no clipping); the slide's one big takeaway — the
    // CALLOUT if there is one, else the last point — becomes a wide banner
    // across the bottom instead of competing with the other chips.
    out.annStyle = 'label'; out.connectors = true; out.annDetail = false;
    out.headline = { x: 80, y: 64, w: 620, fs: 38 };
    const pts = slide.annotations;
    const bannerIdx = (!slide.callout && pts.length > 1) ? pts.length - 1 : -1;
    const colY = [216, 216], colX = [64, 928];
    out.anns = pts.map((a, i) => {
      if (i === bannerIdx) return { x: 80, y: 596, w: 1120, fs: 22, banner: true };
      const col = colY[0] <= colY[1] ? 0 : 1;
      const pos = { x: colX[col], y: colY[col], w: ANN_W, fs: 20 };
      colY[col] += estimateAnnH(a.text) + 44;   // text height + chip padding + gap
      return pos;
    });
    if (slide.callout) out.callout = { x: 80, y: 596, w: 1120, fs: 22, banner: true };
  } else if (lay === 'cards'){
    // each point is its own bordered, draggable/resizable card around the figure
    out.annStyle = 'card'; out.connectors = true;
    out.headline = { x: 80, y: 64, w: 620, fs: 38 };
    out.anns = slide.annotations.map((a, i) => {
      const p = ANN_SLOTS[i % ANN_SLOTS.length], wrap = Math.floor(i / ANN_SLOTS.length) * 26;
      return { x: p.x + wrap, y: p.y + wrap, w: ANN_W, fs: 20 };
    });
    if (slide.callout) out.callout = { x: 80, y: 540, w: 380, fs: 18 };
  } else if (lay === 'figureLeft' || lay === 'figureRight'){
    const imgLeft = lay === 'figureLeft';
    out.figZones = [{ x: imgLeft ? 80 : 690, y: 168, w: 510, h: 472 }];
    const tx = imgLeft ? 700 : 80;
    out.headline = { x: tx, y: 70, w: 500, fs: 33 };
    out.annStyle = 'list';
    out.anns = listPositions(n, tx, 180, 500).map(r => ({ ...r, fs: 20 }));
    if (slide.callout) out.callout = { x: tx, y: 612, w: 500, fs: 17 };
  } else if (lay === 'spotlight'){
    out.figZones = [{ x: 80, y: 150, w: 620, h: 490 }];
    out.headline = { x: 742, y: 130, w: 458, fs: 40 };
    out.annStyle = 'list'; out.annDetail = false;
    out.anns = listPositions(Math.min(n, 3), 742, 270, 458, 18, slide.callout ? 540 : 640).map(r => ({ ...r, fs: 22 }));
    if (slide.callout) out.callout = { x: 742, y: 560, w: 458, fs: 18 };
  } else if (lay === 'bandTop'){
    out.figZones = [{ x: 80, y: 150, w: 1120, h: 286 }];
    out.headline = { x: 80, y: 56, w: 1120, fs: 33 };
    out.annStyle = 'panel';
    const cols = Math.min(Math.max(n, 1), 4), gap = 18, w = (1120 - (cols - 1) * gap) / cols;
    out.anns = slide.annotations.map((a, i) => ({ x: 80 + (i % cols) * (w + gap),
      y: 460 + Math.floor(i / cols) * 160, w, h: 150 }));
  } else if (lay === 'comparison'){
    out.wantFigure = false; out.annStyle = 'panel';
    out.headline = { x: 80, y: 64, w: 1120, fs: 33 };
    const half = Math.ceil(n / 2), gap = 20, w = 540;
    const rowsPer = Math.max(1, half), h = Math.min(150, (470 - (rowsPer - 1) * 14) / rowsPer);
    out.anns = slide.annotations.map((a, i) => {
      const col = i < half ? 0 : 1, row = i < half ? i : i - half;
      return { x: 80 + col * (w + gap), y: 168 + row * (h + 14), w, h };
    });
    if (slide.callout) out.callout = { x: 80, y: 650, w: 1120, fs: 16 };
  } else if (lay === 'timeline'){
    out.wantFigure = false; out.annStyle = 'step';
    out.headline = { x: 80, y: 60, w: 1120, fs: 33 };
    out.timelineGeom = roadmapGeom(n);
  } else if (lay === 'statement'){
    out.wantFigure = false; out.annStyle = 'list'; out.annDetail = false;
    out.headline = { x: 96, y: 150, w: 760, fs: 52 };
    const bottom = slide.callout ? 568 : 632;
    out.anns = listPositions(Math.min(n, 4), 96, 332, 700, 14, bottom).map(r => ({ ...r, fs: 19 }));
    if (slide.callout) out.callout = { x: 96, y: 590, w: 1000, fs: 19 };
  } else if (lay === 'quote'){
    out.wantFigure = false; out.annStyle = 'none'; out.bigQuote = true;
    out.headline = { x: 150, y: 470, w: 980, fs: 22 };  // used as attribution line
  } else if (lay === 'gallery'){
    out.annStyle = 'none';
    out.headline = { x: 80, y: 52, w: 1120, fs: 32 };
    out.galleryZones = galleryZones(Math.max(slide.images.length, 1));
    out.figZones = out.galleryZones;
  } else if (lay === 'figureGrid'){
    // a multi-figure "scene": several photos side by side, each with its own
    // caption label overlaid at the bottom — for comparing specimens, stages, etc.
    out.annStyle = 'caption';
    out.headline = { x: 80, y: 52, w: 1120, fs: 32 };
    const m = Math.max(slide.images.length, slide.annotations.length, 1);
    out.galleryZones = galleryZones(m);
    out.figZones = out.galleryZones;
    out.anns = out.galleryZones.map(z => ({ x: z.x + 10, y: z.y + z.h - 54, w: z.w - 20, fs: 17 }));
  }
  return out;
}

function roadmapGeom(n){
  if (n <= 1) return { horizontal: true, stops: [{ cx: 640, cy: 410 }] };
  if (n <= 5){
    const x0 = 170, x1 = 1110, cy = 410;
    return { horizontal: true,
      stops: Array.from({ length: n }, (_, i) => ({ cx: x0 + i * ((x1 - x0) / (n - 1)), cy })) };
  }
  const y0 = 185, y1 = 655, x = 185;
  return { horizontal: false,
    stops: Array.from({ length: n }, (_, i) => ({ cx: x, cy: y0 + i * ((y1 - y0) / (n - 1)) })) };
}

/* ================= slide renderer ================= */

function renderSlide(slide, deck, opts = {}){
  const pal = palette(deck);
  const dark = isDark(slide);
  const accLine = dark ? pal.accent : pal.accentInk;
  const bg = deck.background;
  const bgCls = (bg && bg.src) ? ' has-bg ' + (bg.dark ? 'bg-dark' : 'bg-light') : '';
  const cine = slide.type === 'content' && slide.images.length && effContentLayout(slide) === 'cinematic';
  const root = el('div', 'slide ' + (dark ? 'dark' : 'light') + bgCls + (cine ? ' cine' : ''));
  root.dataset.type = slide.type;
  root.style.background = dark ? pal.darkBg : pal.lightBg;
  root.style.setProperty('--lf-accent', cine ? pal.accent : accLine);

  if (bg && bg.src){
    // no colour wash — let the blurred HD photo show; text gets a legibility halo (.has-bg) instead
    const img = el('img', 'lf-bg');
    img.src = bg.src; img.alt = '';
    img.style.filter = `blur(${bg.blur || 0}px)`;
    root.appendChild(img);
  }

  root.appendChild(motifSVG(pal, dark));

  switch (slide.type){
    case 'title':    renderTitle(root, slide, deck, pal, dark, opts); break;
    case 'roadmap':  renderRoadmap(root, slide, deck, pal, dark, opts); break;
    case 'section':  renderSection(root, slide, deck, pal, dark, opts); break;
    case 'takeaway': renderTakeaway(root, slide, deck, pal, dark, opts); break;
    default:         renderContent(root, slide, deck, pal, dark, opts); break;
  }

  renderImages(root, slide, opts);
  if (cine) root.appendChild(el('div', 'lf-cinescrim'));
  if (slide.type === 'content' && root.dataset.conn && slide.images.length && slide.annotations.length){
    drawConnectors(root, slide, arrowColor(deck));
  }
  renderArrows(root, slide, deck, opts);
  renderTexts(root, slide, opts);
  renderOverlays(root, slide, deck, opts);
  renderFooter(root, slide, deck, pal, dark, opts);
  if (deck.frame) root.appendChild(el('div', 'lf-frame'));
  return root;
}

function motifSVG(pal, dark){
  const op = dark ? 0.15 : 0.10;
  return svgEl(`
    <circle cx="1330" cy="-60" r="215" fill="none" stroke="${pal.accent}" stroke-width="1.6" opacity="${op}"/>
    <circle cx="1330" cy="-60" r="300" fill="none" stroke="${pal.accent2}" stroke-width="1.2" opacity="${op * 0.6}"/>
    <circle cx="-50" cy="775" r="150" fill="none" stroke="${pal.accent}" stroke-width="1.4" opacity="${op * 0.7}"/>
  `, 'lf-motif');
}

function editable(node, key, opts){
  if (!opts.editor) return node;
  node.dataset.edit = key;
  node.dataset.editable = '1';
  return node;
}

/* A positioned text box whose geometry (x, y, width, font-size) and
   visibility can be overridden per slide and edited on the canvas.
   `def` supplies the layout default; slide.boxes[key] supplies overrides.
   Returns null when the user has deleted (hidden) the box. */
function mkBox(slide, key, def, content, css, opts){
  const o = (slide.boxes && slide.boxes[key]) || {};
  if (o.hidden) return null;
  const x = o.x != null ? o.x : def.x;
  const y = o.y != null ? o.y : def.y;
  const w = o.w != null ? o.w : def.w;
  const fs = o.fs != null ? o.fs : def.fs;
  const node = el('div', 'lf-box', `position:absolute;left:${x}px;top:${y}px;width:${w}px;`
    + (fs != null ? `font-size:${fs}px;` : '') + `z-index:${def.z || 5};` + (css || '')
    + (o.align ? `text-align:${o.align};` : '')
    + (o.color ? `color:${o.color};` : '')
    + (o.bg ? `background-color:${o.bg};padding:6px 10px;border-radius:8px;` : ''));
  node.dataset.box = key;
  node.dataset.sel = 'box:' + key;
  if (content != null) node.textContent = content;
  if (opts && opts.editor){
    node.dataset.edit = (opts.editKey || key);
    node.dataset.editable = '1';
  }
  return node;
}

function renderTitle(root, slide, deck, pal, dark, opts){
  const centered = slide.layout === 'titleCenter';
  const kicker = deck.date || 'Lecture';
  const kx = centered ? 140 : 96, kw = centered ? 1000 : 1010;
  const ta = centered ? 'text-align:center;' : '';
  appendBox(root, mkBox(slide, 'kicker', { x: kx, y: 232, w: kw, fs: 16, z: 5 }, kicker,
    `letter-spacing:3.5px;text-transform:uppercase;opacity:.8;color:${pal.accent2};font-weight:600;${ta}`,
    { ...opts, editKey: 'date' }));
  root.appendChild(el('div', '', `position:absolute;left:${centered ? 608 : 96}px;top:272px;width:64px;height:5px;
    border-radius:3px;background:${pal.accent};z-index:5;`));
  const txt = slide.headline || deck.title;
  appendBox(root, withSerif(mkBox(slide, 'headline',
    { x: centered ? 140 : 96, y: 292, w: 1000, fs: txt.length > 48 ? 56 : 74, z: 5 },
    txt, `line-height:1.06;font-weight:600;${ta}`, opts)));
  if (deck.presenter || opts.editor){
    appendBox(root, mkBox(slide, 'presenter', { x: centered ? 140 : 96, y: 470, w: centered ? 1000 : 900, fs: 22, z: 5 },
      deck.presenter || 'Presenter name', `opacity:.78;${ta}`, { ...opts, editKey: 'presenter' }));
  }
}
function withSerif(node){ if (node) node.classList.add('serif'); return node; }
function appendBox(root, node){ if (node) root.appendChild(node); return node; }

function renderRoadmap(root, slide, deck, pal, dark, opts){
  root.appendChild(editable(el('div', 'serif',
    'position:absolute;left:96px;top:64px;width:1000px;font-size:46px;font-weight:600;z-index:5;',
    slide.headline || 'Roadmap'), 'headline', opts));
  const anns = slide.annotations;
  if (!anns.length){
    if (opts.editor) root.appendChild(el('div', '',
      'position:absolute;left:96px;top:330px;font-size:20px;opacity:.5;z-index:5;',
      'Add POINTS in the outline (or ＋ Label) to build the roadmap.'));
    return;
  }
  const g = roadmapGeom(anns.length);
  const mid = `lfarrow-${slide.id}`;
  let lines = `<defs><marker id="${mid}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
    <path d="M1 1 L8 4.5 L1 8" fill="none" stroke="${pal.accent}" stroke-width="1.6"/></marker></defs>`;
  for (let i = 0; i < g.stops.length - 1; i++){
    const a = g.stops[i], b = g.stops[i + 1];
    if (g.horizontal)
      lines += `<line x1="${a.cx + 53}" y1="${a.cy}" x2="${b.cx - 56}" y2="${a.cy}"
        stroke="${pal.accent}" stroke-width="2" opacity=".8" marker-end="url(#${mid})"/>`;
    else
      lines += `<line x1="${a.cx}" y1="${a.cy + 36}" x2="${a.cx}" y2="${b.cy - 40}"
        stroke="${pal.accent}" stroke-width="2" opacity=".8" marker-end="url(#${mid})"/>`;
  }
  root.appendChild(svgEl(lines, 'lf-conn'));
  const hi = slide.recapHighlight;
  anns.forEach((a, i) => {
    const st = g.stops[i];
    const r = g.horizontal ? 38 : 27;
    const here = hi != null && i === hi;
    const fade = hi != null && !here ? 'opacity:.45;' : '';
    const circStyle = here
      ? `background:${pal.accent};border:2.5px solid ${pal.accent};color:#0b1220;`
      : `border:2.5px solid ${pal.accent};color:${pal.accent2};${fade}`;
    const circ = el('div', 'serif', `position:absolute;z-index:6;left:${st.cx - r}px;top:${st.cy - r}px;
      width:${r * 2}px;height:${r * 2}px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:${g.horizontal ? 30 : 22}px;${circStyle}`, String(i + 1));
    root.appendChild(circ);
    if (here){
      const tag = g.horizontal
        ? el('div', '', `position:absolute;z-index:6;left:${st.cx - 100}px;top:${st.cy - r - 30}px;width:200px;
            text-align:center;font-size:12px;font-weight:700;letter-spacing:3px;color:${pal.accent2};`, 'NOW')
        : el('div', '', `position:absolute;z-index:6;left:${st.cx + 58}px;top:${st.cy - r - 24}px;width:300px;
            font-size:12px;font-weight:700;letter-spacing:3px;color:${pal.accent2};`, 'NOW');
      root.appendChild(tag);
    }
    const lbl = g.horizontal
      ? el('div', '', `position:absolute;z-index:6;left:${st.cx - 100}px;top:${st.cy + 58}px;width:200px;
          text-align:center;font-size:18px;font-weight:600;line-height:1.3;${fade}`, a.text)
      : el('div', '', `position:absolute;z-index:6;left:${st.cx + 58}px;top:${st.cy - 16}px;width:900px;
          font-size:21px;font-weight:600;line-height:1.3;${fade}`, a.text);
    root.appendChild(editable(lbl, 'ann:' + a.id, opts));
  });
}

function renderSection(root, slide, deck, pal, dark, opts){
  const partNo = deck.slides.filter(s => s.type === 'section')
    .findIndex(s => s.id === slide.id) + 1;
  root.appendChild(el('div', 'serif', `position:absolute;right:46px;bottom:-72px;font-size:330px;
    font-weight:700;line-height:1;z-index:2;opacity:${dark ? '.10' : '.07'};`, pad2(partNo)));
  const centered = slide.layout === 'sectionCenter';
  const ta = centered ? 'text-align:center;' : '';
  root.appendChild(el('div', '', `position:absolute;left:${centered ? 140 : 96}px;top:266px;width:${centered ? 1000 : 600}px;
    font-size:15px;letter-spacing:4px;text-transform:uppercase;font-weight:650;z-index:5;${ta}
    color:${dark ? pal.accent2 : pal.accentInk};`, 'Part ' + pad2(partNo)));
  appendBox(root, withSerif(mkBox(slide, 'headline', { x: centered ? 140 : 96, y: 298, w: centered ? 1000 : 820, fs: 62, z: 5 },
    slide.headline || 'Section', `font-weight:600;line-height:1.1;${ta}`, opts)));
  if (opts.editor && slide.figure && !slide.images.length && !centered)
    addFigHint(root, slide, { x: 900, y: 80, w: 300 });
}

function renderTakeawayChip(root, pal){
  root.appendChild(el('div', 'lf-take-chip', `left:${640 - 84}px;top:118px;width:168px;
    background:${pal.accent};`, 'Key takeaway'));
}

function renderTakeaway(root, slide, deck, pal, dark, opts){
  renderTakeawayChip(root, pal);
  if (slide.layout === 'takeawayQuote'){
    appendBox(root, withSerif(mkBox(slide, 'callout', { x: 150, y: 210, w: 980, fs: 44, z: 6 },
      slide.callout || slide.headline || 'A memorable line',
      'font-weight:600;line-height:1.22;text-align:center;font-style:italic;', { ...opts, editKey: 'callout' })));
    appendBox(root, mkBox(slide, 'headline', { x: 200, y: 470, w: 880, fs: 22, z: 6 },
      slide.headline || '', 'text-align:center;opacity:.7;', opts));
    return;
  }
  root.appendChild(el('div', '', `position:absolute;left:608px;top:188px;width:64px;height:5px;
    border-radius:3px;background:${pal.accent};z-index:5;`));
  const txt = slide.headline || 'The one thing to remember';
  appendBox(root, withSerif(mkBox(slide, 'headline', { x: 150, y: 232, w: 980, fs: txt.length > 90 ? 42 : 54, z: 5 },
    txt, 'font-weight:600;line-height:1.18;text-align:center;', opts)));
  if (slide.callout || opts.editor){
    appendBox(root, mkBox(slide, 'callout', { x: 200, y: 470, w: 880, fs: 22, z: 5 },
      slide.callout || (opts.editor ? 'Optional supporting line (CALLOUT)' : ''),
      'opacity:.78;font-style:italic;text-align:center;', opts));
  }
  if (slide.annotations.length){
    const n = slide.annotations.length, gap = 24, w = Math.min(320, (1120 - (n - 1) * gap) / n);
    const startX = (1280 - (n * w + (n - 1) * gap)) / 2;
    const fs = n > 4 ? 17 : (n > 3 ? 18 : 19);
    const y = n > 3 ? 532 : 552;
    slide.annotations.forEach((a, i) => {
      const def = { x: startX + i * (w + gap), y, w, fs };
      renderAnnBox(root, slide, a, i, def, opts, false, i + 1, 'lf-take');
    });
  }
}

function renderContent(root, slide, deck, pal, dark, opts){
  const accLine = dark ? pal.accent : pal.accentInk;
  const L = contentLayout(slide);
  root.dataset.conn = L.connectors ? '1' : '';

  // big centred quote layout
  if (L.bigQuote){
    appendBox(root, withSerif(mkBox(slide, 'callout',
      { x: 150, y: 200, w: 980, fs: 44, z: 6 }, slide.callout || slide.headline || 'A memorable line',
      'font-weight:600;line-height:1.22;text-align:center;font-style:italic;', { ...opts, editKey: 'callout' })));
    appendBox(root, mkBox(slide, 'headline', { ...L.headline, z: 6 },
      slide.headline || '', 'text-align:center;opacity:.7;', opts));
    return;
  }

  // accent rule + headline
  root.appendChild(el('div', '', `position:absolute;left:${L.headline.x}px;top:${L.headline.y - 14}px;
    width:54px;height:5px;border-radius:3px;background:${pal.accent};z-index:5;`));
  appendBox(root, withSerif(mkBox(slide, 'headline', { ...L.headline, z: 5 },
    slide.headline || 'Slide headline', 'font-weight:650;line-height:1.14;', opts)));

  // annotations, by style
  slide.annotations.forEach((a, i) => {
    const def = L.anns[i];
    if (L.annStyle === 'none' || !def) return;
    if (L.annStyle === 'panel'){
      const p = el('div', 'lf-panel', `left:${def.x}px;top:${def.y}px;width:${def.w}px;height:${def.h}px;`);
      p.appendChild(el('div', 'serif', `font-size:22px;font-weight:700;color:${accLine};margin-bottom:6px;`, pad2(i + 1)));
      p.appendChild(editable(el('div', '', 'font-size:19px;font-weight:650;line-height:1.3;', a.text), 'ann:' + a.id, opts));
      if (a.full && a.full.trim() !== a.text.trim())
        p.appendChild(editable(el('div', '', 'font-size:13.5px;opacity:.72;margin-top:6px;line-height:1.4;', a.full), 'annfull:' + a.id, opts));
      root.appendChild(p);
    } else if (L.annStyle === 'step'){
      // timeline rendered separately below
    } else if (L.annStyle === 'card'){
      renderAnnBox(root, slide, a, i, def, opts, true, i + 1);
    } else if (L.annStyle === 'caption'){
      // a label overlaid on the bottom of its own figure in a multi-figure scene
      renderAnnBox(root, slide, a, i, def, opts, false, 0, 'lf-figcap');
    } else if (L.annStyle === 'label'){
      // filled "chip" label — dark fill/white text by default, or a beige/dark
      // pairing when the label's chip is set to 'light'; the slide's one big
      // takeaway point (if any) gets the wide bottom-banner variant
      const extra = 'lf-chip' + (a.chip === 'light' ? ' lf-chip-light' : '') + (def.banner ? ' lf-takeaway-banner' : '');
      renderAnnBox(root, slide, a, i, def, opts, L.annDetail, 0, extra);
    } else {
      // 'list' → movable annotation box, no chip background
      renderAnnBox(root, slide, a, i, def, opts, L.annDetail);
    }
  });

  if (L.annStyle === 'step' && L.timelineGeom) renderTimeline(root, slide, pal, dark, L.timelineGeom, opts);

  // callout
  if (slide.callout && L.callout){
    if (L.lay === 'cinematic'){
      // plain subtitle line over the scrim, not a boxed callout
      appendBox(root, mkBox(slide, 'callout', { ...L.callout, z: 36 }, slide.callout,
        'font-style:italic;line-height:1.4;opacity:.92;', { ...opts, editKey: 'callout' }));
    } else if (L.callout.banner){
      // annotated layout: the callout IS the slide's big takeaway banner
      const boxObj = (slide.boxes && slide.boxes.callout) || {};
      const cb = mkBox(slide, 'callout', { ...L.callout, z: 35 }, slide.callout, '', opts);
      if (cb) cb.classList.add('lf-ann', 'lf-chip', 'lf-takeaway-banner', ...(boxObj.chip === 'light' ? ['lf-chip-light'] : []));
      appendBox(root, cb);
    } else {
      const cb = mkBox(slide, 'callout', { ...L.callout, z: 35 }, slide.callout,
        'border-left:4px solid var(--lf-accent);padding:10px 16px;line-height:1.45;font-style:italic;'
        + 'border-radius:0 10px 10px 0;' + calloutBg(dark), opts);
      if (cb) cb.classList.add('lf-callout');
      appendBox(root, cb);
    }
  }

  // suggested-figure hint when no image is placed yet
  if (opts.editor && slide.figure && !slide.images.length && L.annStyle !== 'step' && !L.bigQuote && L.lay !== 'gallery' && L.lay !== 'figureGrid'){
    if (L.wantFigure){
      const z = L.figZones[0];
      addFigHint(root, slide, { x: z.x + Math.max(0, (z.w - 360) / 2), y: z.y + Math.max(0, (z.h - 80) / 2), w: Math.min(360, z.w) });
    } else if (L.lay === 'panels'){
      addFigHint(root, slide, { x: 870, y: 50, w: 330 });   // tucked top-right above the cards
    }
  }
}

/* one annotation as a movable/resizable label box (merges per-annotation overrides).
   `cardNum` truthy → render as a discrete bordered card with a numbered badge. */
function renderAnnBox(root, slide, a, i, def, opts, showDetail = true, cardNum = 0, extraCls = ''){
  const x = a.x != null ? a.x : def.x;
  const y = a.y != null ? a.y : def.y;
  const w = a.w != null ? a.w : def.w;
  const fs = a.fs != null ? a.fs : (def.fs || 19);
  const cls = (cardNum ? 'lf-ann lf-anncard lf-box' : 'lf-ann lf-box') + (extraCls ? ' ' + extraCls : '');
  const node = el('div', cls, `left:${x}px;top:${y}px;width:${w}px;font-size:${fs}px;`
    + (a.align ? `text-align:${a.align};` : '')
    + (a.color ? `color:${a.color};` : '')
    + (a.bg ? `background-color:${a.bg};` + (cardNum ? '' : 'padding:10px 14px;border-radius:10px;') : ''));
  node.dataset.id = a.id;
  node.dataset.sel = 'ann:' + a.id;
  if (cardNum) node.appendChild(el('div', 'lf-ann-num', '', String(cardNum)));
  node.appendChild(editable(el('div', 'lf-ann-text', '', a.text), 'ann:' + a.id, opts));
  if (showDetail && a.full && a.full.trim() !== a.text.trim())
    node.appendChild(editable(el('div', 'lf-ann-full', '', a.full), 'annfull:' + a.id, opts));
  root.appendChild(node);
}

function renderTimeline(root, slide, pal, dark, g, opts){
  const mid = `lftl-${slide.id}`;
  let lines = `<defs><marker id="${mid}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
    <path d="M1 1 L8 4.5 L1 8" fill="none" stroke="${pal.accent}" stroke-width="1.6"/></marker></defs>`;
  for (let i = 0; i < g.stops.length - 1; i++){
    const a = g.stops[i], b = g.stops[i + 1];
    if (g.horizontal) lines += `<line x1="${a.cx + 50}" y1="${a.cy}" x2="${b.cx - 54}" y2="${a.cy}" stroke="${pal.accent}" stroke-width="2" opacity=".8" marker-end="url(#${mid})"/>`;
    else lines += `<line x1="${a.cx}" y1="${a.cy + 34}" x2="${a.cx}" y2="${b.cy - 38}" stroke="${pal.accent}" stroke-width="2" opacity=".8" marker-end="url(#${mid})"/>`;
  }
  root.appendChild(svgEl(lines, 'lf-conn'));
  slide.annotations.forEach((a, i) => {
    const st = g.stops[i]; if (!st) return;
    const r = g.horizontal ? 36 : 26;
    root.appendChild(el('div', 'serif', `position:absolute;z-index:6;left:${st.cx - r}px;top:${st.cy - r}px;
      width:${r * 2}px;height:${r * 2}px;border:2.5px solid ${pal.accent};border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-size:${g.horizontal ? 28 : 20}px;color:${pal.accent2};`, String(i + 1)));
    const lbl = g.horizontal
      ? el('div', '', `position:absolute;z-index:6;left:${st.cx - 100}px;top:${st.cy + 54}px;width:200px;text-align:center;font-size:17px;font-weight:600;line-height:1.3;`, a.text)
      : el('div', '', `position:absolute;z-index:6;left:${st.cx + 54}px;top:${st.cy - 14}px;width:900px;font-size:20px;font-weight:600;line-height:1.3;`, a.text);
    root.appendChild(editable(lbl, 'ann:' + a.id, opts));
  });
}
function calloutBg(dark){
  return dark ? 'background:rgba(255,255,255,.06);'
              : 'background:rgba(255,255,255,.88);color:#22323e;box-shadow:0 6px 16px rgba(15,30,45,.07);';
}

function addFigHint(root, slide, def){
  const o = (slide.boxes && slide.boxes.fig) || {};
  if (o.hidden) return;
  const x = o.x != null ? o.x : def.x, y = o.y != null ? o.y : def.y, w = o.w != null ? o.w : def.w;
  const hint = el('div', 'lf-fighint lf-box', `position:absolute;left:${x}px;top:${y}px;width:${w}px;z-index:6;`);
  hint.dataset.box = 'fig';
  hint.dataset.sel = 'box:fig';
  hint.dataset.fighint = '1';
  hint.appendChild(el('div', '', 'font-weight:650;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8;', 'Suggested figure — click to search'));
  hint.appendChild(el('div', '', 'margin-top:4px;', slide.figure));
  root.appendChild(hint);
}

function renderImages(root, slide, opts){
  const fullBleed = slide.type === 'content' && contentLayout(slide).fullBleed;
  slide.images.forEach((im, i) => {
    const bleed = fullBleed && i === 0;
    const z = bleed ? 1 : (im.z != null ? im.z : 10 + i);
    const node = el('div', 'lf-img ' + (bleed ? 'bleed ' : '') + (im.cutout ? 'cut' : 'photo'),
      `left:${im.x}px;top:${im.y}px;width:${im.w}px;height:${im.h}px;z-index:${z};`);
    node.dataset.id = im.id;
    node.dataset.sel = 'img:' + im.id;
    const img = document.createElement('img');
    img.src = (im.cutout && im.cutSrc) ? im.cutSrc : im.src;
    img.alt = (im.attr && im.attr.title) || '';
    img.draggable = false;
    node.appendChild(img);
    root.appendChild(node);
  });
}

/* connector lines from labels to the figure — reads live DOM positions so it stays correct mid-drag */
function drawConnectors(root, slide, color){
  root.querySelector('.lf-conn[data-role="ann"]')?.remove();
  if (!color) return;                       // arrows turned off
  const annNodes = Array.from(root.querySelectorAll('.lf-ann')).filter(n => !n.classList.contains('lf-unrevealed') && !n.classList.contains('lf-takeaway-banner'));
  if (!annNodes.length) return;
  const imgNodes = Array.from(root.querySelectorAll('.lf-img'));
  let fig;
  if (imgNodes.length){
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    for (const n of imgNodes){
      const x = parseFloat(n.style.left), y = parseFloat(n.style.top);
      const w = parseFloat(n.style.width), h = parseFloat(n.style.height);
      x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x + w); y2 = Math.max(y2, y + h);
    }
    fig = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  } else fig = { ...FIGZONE };

  const isWhite = color.toLowerCase() === '#ffffff';
  const halo = isWhite ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.7)';   // opposite-colour underlay keeps the arrow legible on busy photos
  const mid = 'lfarr-' + slide.id;
  let inner = `<defs><marker id="${mid}" markerWidth="11" markerHeight="11" refX="7.5" refY="4.5" orient="auto">`
    + `<path d="M1 1 L8.6 4.5 L1 8" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>`;
  annNodes.forEach((n, i) => {
    const pos = { x: parseFloat(n.style.left), y: parseFloat(n.style.top) };
    const w = n.offsetWidth || ANN_W;
    const h = n.offsetHeight || estimateAnnH(n.textContent);
    const ann = slide.annotations.find(a => a.id === n.dataset.id);
    const { a, t } = annLeader(fig, ann, pos, w, h);
    const dx = t.x - a.x, dy = t.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(34, len * 0.18) * (i % 2 ? 1 : -1);
    const cx = (a.x + t.x) / 2 - dy / len * bow;
    const cy = (a.y + t.y) / 2 + dx / len * bow;
    const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`;
    inner += `<path d="${d}" fill="none" stroke="${halo}" stroke-width="4.5" stroke-linecap="round" opacity=".55"/>`
      + `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" marker-end="url(#${mid})"/>`;
  });
  const svg = svgEl(inner, 'lf-conn');
  svg.dataset.role = 'ann';
  root.appendChild(svg);
}

function renderTexts(root, slide, opts){
  (slide.texts || []).forEach(t => {
    // auto-fit to content until the user drags a side handle (which sets t.w)
    const sizing = t.w != null ? `width:${t.w}px;` : `width:max-content;max-width:${TEXT_AUTO_MAX}px;`;
    const node = el('div', 'lf-box', `position:absolute;left:${t.x}px;top:${t.y}px;${sizing}`
      + `font-size:${t.fs || 32}px;font-weight:600;line-height:1.3;z-index:60;`
      + (t.italic ? 'font-style:italic;' : '') + (t.align ? `text-align:${t.align};` : '')
      + (t.color ? `color:${t.color};` : '')
      + (t.bg ? `background-color:${t.bg};padding:8px 12px;border-radius:8px;` : ''));
    node.dataset.sel = 'text:' + t.id;
    node.textContent = t.text;
    if (opts.editor){ node.dataset.edit = 'text:' + t.id; node.dataset.editable = '1'; }
    root.appendChild(node);
  });
}

/* Recurring "motif" overlays defined once on the deck and shown on every slide
   (or every slide of a chosen type) — e.g. an etymology block or a footer line.
   Editing, moving, recolouring or deleting one on any slide updates the shared
   deck element, so it stays consistent everywhere with no copy-paste. */
function renderOverlays(root, slide, deck, opts){
  (deck.overlays || []).forEach(o => {
    if (o.type && o.type !== 'text') return;                 // v1: text overlays only
    if (o.scope && o.scope !== 'all' && o.scope !== slide.type) return;
    const sizing = o.w != null ? `width:${o.w}px;` : `width:max-content;max-width:${TEXT_AUTO_MAX}px;`;
    const cls = 'lf-box lf-overlay' + (opts.editor ? ' lf-overlay-edit' : '');
    const node = el('div', cls, `position:absolute;left:${o.x}px;top:${o.y}px;${sizing}`
      + `font-size:${o.fs || 20}px;font-weight:600;line-height:1.3;z-index:62;`
      + (o.italic ? 'font-style:italic;' : '') + (o.align ? `text-align:${o.align};` : '')
      + (o.color ? `color:${o.color};` : '')
      + (o.bg ? `background-color:${o.bg};padding:8px 12px;border-radius:8px;` : ''));
    node.dataset.sel = 'overlay:' + o.id;
    node.textContent = o.text;
    if (opts.editor){ node.dataset.edit = 'overlay:' + o.id; node.dataset.editable = '1'; }
    root.appendChild(node);
  });
}

/* Free arrows the user can draw between any two points (great for process /
   concept diagrams — flow, cycles, cause→effect). Endpoints are absolute slide
   coordinates; in the editor each arrow gets a fat transparent hit-line (drag to
   move the whole arrow) and two endpoint handles (drag to re-aim an end). */
function arrowDefaultColor(slide){ return isDark(slide) ? '#e9f1f8' : '#1f2d3a'; }

function renderArrows(root, slide, deck, opts){
  const arrows = slide.arrows || [];
  if (!arrows.length) return;
  const def = arrowDefaultColor(slide);
  let defs = '', body = '', overlay = '';
  arrows.forEach((a, i) => {
    const col = a.color || def;
    const w = a.width || 3;
    const mk = `lfarw-${slide.id}-${i}`;
    defs += `<marker id="${mk}" markerWidth="11" markerHeight="11" refX="7.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">`
      + `<path d="M1 1 L9.5 4.5 L1 8 Z" fill="${col}"/></marker>`;
    body += `<line class="lf-arrow-line" data-arid="${a.id}" x1="${a.from.x}" y1="${a.from.y}" x2="${a.to.x}" y2="${a.to.y}" `
      + `stroke="${col}" stroke-width="${w}" stroke-linecap="round" marker-end="url(#${mk})"/>`;
    if (opts.editor){
      overlay += `<line class="lf-arrow-hit" data-sel="arrow:${a.id}" data-arid="${a.id}" x1="${a.from.x}" y1="${a.from.y}" x2="${a.to.x}" y2="${a.to.y}"/>`
        + `<circle class="lf-arrow-end" data-arid="${a.id}" data-end="from" cx="${a.from.x}" cy="${a.from.y}" r="6"/>`
        + `<circle class="lf-arrow-end" data-arid="${a.id}" data-end="to" cx="${a.to.x}" cy="${a.to.y}" r="6"/>`;
    }
  });
  root.appendChild(svgEl(`<defs>${defs}</defs>${body}${overlay}`, 'lf-arrows'));
}

/* update an arrow's line/hit/handle geometry in place during a drag */
function setArrowGeom(svg, a){
  svg.querySelectorAll(`[data-arid="${a.id}"]`).forEach(node => {
    if (node.tagName === 'circle'){
      const p = node.dataset.end === 'from' ? a.from : a.to;
      node.setAttribute('cx', p.x); node.setAttribute('cy', p.y);
    } else {
      node.setAttribute('x1', a.from.x); node.setAttribute('y1', a.from.y);
      node.setAttribute('x2', a.to.x);   node.setAttribute('y2', a.to.y);
    }
  });
}

function renderFooter(root, slide, deck, pal, dark, opts){
  const i = opts.index ?? deck.slides.indexOf(slide);
  const n = opts.total ?? deck.slides.length;
  root.appendChild(el('div', 'lf-footer', '', `${i + 1} / ${n}`));

  const attrs = [];
  for (const im of slide.images){
    if (im.attr && im.attr.author){
      const line = `${im.attr.author} / ${im.attr.sourceName}` + (im.attr.license ? ` (${im.attr.license})` : '');
      if (!attrs.includes(line)) attrs.push(line);
    }
  }
  if (attrs.length){
    root.appendChild(el('div', 'lf-credit', '',
      (attrs.length > 1 ? 'Photos: ' : 'Photo: ') + attrs.join(' · ')));
  }

  const acc = dark ? pal.accent : pal.accentInk;
  const flow = (i === n - 1)
    ? svgFlow(`<rect x="34" y="3" width="9" height="9" fill="${acc}"/>`)
    : svgFlow(`<path d="M2 7.5 H36 M28 1.5 L37 7.5 L28 13.5" fill="none" stroke="${acc}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
  root.appendChild(flow);
}
function svgFlow(inner){
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('viewBox', '0 0 46 15');
  s.setAttribute('width', '46'); s.setAttribute('height', '15');
  s.setAttribute('class', 'lf-flow');
  s.innerHTML = inner;
  return s;
}

/* credits pseudo-slide for exports */
function collectAttributions(deck){
  const lines = [];
  deck.slides.forEach((s, i) => {
    for (const im of s.images){
      if (im.attr && im.attr.author){
        lines.push({ slide: i + 1, ...im.attr });
      }
    }
  });
  return lines;
}
function renderCreditsSlide(deck){
  const attrs = collectAttributions(deck);
  if (!attrs.length) return null;
  const pal = palette(deck);
  const bg = deck.background;
  const root = el('div', 'slide dark' + (bg && bg.src ? ' has-bg' : ''));
  root.style.background = pal.darkBg;
  root.style.setProperty('--lf-accent', pal.accent);
  if (bg && bg.src){
    const img = el('img', 'lf-bg');
    img.src = bg.src; img.alt = '';
    img.style.filter = `blur(${bg.blur || 0}px)`;
    root.appendChild(img);
    root.appendChild(el('div', 'lf-bgscrim', `background:${hexA(pal.darkSolid, 0.55)};`));
  }
  root.appendChild(motifSVG(pal, true));
  root.appendChild(el('div', '', `position:absolute;left:96px;top:74px;width:54px;height:5px;border-radius:3px;background:${pal.accent};z-index:5;`));
  root.appendChild(el('div', 'serif', 'position:absolute;left:96px;top:90px;font-size:44px;font-weight:600;z-index:5;', 'Image credits'));
  const list = el('div', '', 'position:absolute;left:96px;top:180px;right:96px;bottom:60px;overflow:hidden;z-index:5;font-size:16px;line-height:1.5;opacity:.88;');
  for (const a of attrs.slice(0, 16)){
    list.appendChild(el('div', '', 'margin-bottom:10px;',
      `Slide ${a.slide} — ${a.author} · ${a.sourceName} · ${a.license}` + (a.pageUrl ? ` · ${a.pageUrl}` : '')));
  }
  if (attrs.length > 16) list.appendChild(el('div', '', 'opacity:.6;', `…and ${attrs.length - 16} more`));
  root.appendChild(list);
  if (deck.frame) root.appendChild(el('div', 'lf-frame'));
  return root;
}

/* ================= editor: canvas, selection, drag ================= */

function fitCanvas(){
  const wrap = $('#canvas-wrap');
  if (!wrap) return;
  const availW = wrap.clientWidth - 36, availH = wrap.clientHeight - 36;
  viewScale = Math.max(0.1, Math.min(availW / SLIDE_W, availH / SLIDE_H));
  const sc = $('#canvas-scale');
  sc.style.width = (SLIDE_W * viewScale) + 'px';
  sc.style.height = (SLIDE_H * viewScale) + 'px';
  $('#canvas').style.transform = `scale(${viewScale})`;
}

function renderEditor(){
  const c = $('#canvas');
  c.innerHTML = '';
  const s = cur();
  if (!s) return;
  const node = renderSlide(s, state.deck, { editor: true, index: state.cur, total: state.deck.slides.length });
  c.appendChild(node);
  wireSlideEditing(node, s);
  applySelection(node);
}

/* resolve the current selection (a string like 'img:ID' / 'ann:ID' / 'box:KEY')
   to the object whose geometry we read & write */
function selInfo(slide, sel){
  if (!sel) return null;
  if (sel.startsWith('img:')){
    const obj = slide.images.find(x => x.id === sel.slice(4));
    return obj && { type: 'img', obj, isImg: true };
  }
  if (sel.startsWith('ann:')){
    const obj = slide.annotations.find(x => x.id === sel.slice(4));
    return obj && { type: 'ann', obj, isText: true };
  }
  if (sel.startsWith('text:')){
    const obj = (slide.texts || []).find(x => x.id === sel.slice(5));
    return obj && { type: 'text', obj, isText: true };
  }
  if (sel.startsWith('overlay:')){
    const obj = (state.deck && state.deck.overlays || []).find(x => x.id === sel.slice(8));
    return obj && { type: 'overlay', obj, isText: true };
  }
  if (sel.startsWith('arrow:')){
    const obj = (slide.arrows || []).find(x => x.id === sel.slice(6));
    return obj && { type: 'arrow', obj, isArrow: true };
  }
  if (sel.startsWith('box:')){
    slide.boxes = slide.boxes || {};
    const key = sel.slice(4);
    const obj = slide.boxes[key] || (slide.boxes[key] = {});
    return { type: 'box', key, obj, isText: true, isFig: key === 'fig' };
  }
  return null;
}

const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
function addHandles(node){
  if (node.querySelector('.lf-h')) return;
  for (const dir of HANDLE_DIRS){
    const h = el('div', 'lf-h lf-h-' + dir);
    h.dataset.dir = dir;
    node.appendChild(h);
  }
}

function applySelection(root){
  root.querySelectorAll('.lf-box.selected,.lf-img.selected,.group-sel').forEach(n => {
    n.classList.remove('selected', 'group-sel');
    n.querySelectorAll('.lf-h').forEach(h => h.remove());
  });
  root.querySelectorAll('.lf-arrow-line.selected').forEach(n => n.classList.remove('selected'));
  root.querySelector('.lf-group-box')?.remove();

  let info = null, selNode = null, group = null;
  if (state.selMulti.length >= 2){
    group = state.selMulti.map(sel => {
      const n = root.querySelector(`[data-sel="${sel}"]`);
      const i = selInfo(cur(), sel);
      return (n && i) ? { sel, node: n, info: i } : null;
    }).filter(Boolean);
    if (group.length >= 2){
      group.forEach(g => g.node.classList.add('selected', 'group-sel'));
      renderGroupBox(root, group);
    } else {
      group = null;
      state.selMulti = [];
    }
  }
  if (!group && state.sel){
    selNode = root.querySelector(`[data-sel="${state.sel}"]`);
    if (selNode){
      info = selInfo(cur(), state.sel);
      if (info && info.type === 'arrow'){
        // arrows highlight their visible line; their endpoint dots are the handles
        const ln = root.querySelector(`.lf-arrow-line[data-arid="${info.obj.id}"]`);
        if (ln) ln.classList.add('selected');
      } else {
        selNode.classList.add('selected');
        addHandles(selNode);
      }
    }
    else state.sel = null;
  }

  const tools = $('#sel-tools');
  tools.hidden = !(group || info);
  const isImg = !group && info && info.isImg;
  const isArrow = !group && info && info.type === 'arrow';
  const isText = group ? group.every(g => g.info.isText) : !!(info && info.isText);
  $('#sel-cutout').disabled = !isImg;
  $('#sel-front').disabled = $('#sel-back').disabled = !isImg;
  const align = (!group && isText) ? (info.obj.align || 'left') : null;
  ['left', 'center', 'right'].forEach(a => {
    const btn = $('#sel-align-' + a);
    btn.disabled = !isText;
    btn.classList.toggle('active', align === a);
  });

  const colorInput = $('#sel-color'), colorReset = $('#sel-color-reset');
  const bgInput = $('#sel-bg'), bgClear = $('#sel-bg-clear');
  // text colour applies to text & arrows; background fill only to text
  colorInput.disabled = colorReset.disabled = !(isText || isArrow);
  bgInput.disabled = bgClear.disabled = !isText;
  if (isText){
    const refObj = group ? group[0].info.obj : info.obj;
    const refNode = group ? group[0].node : selNode;
    if (document.activeElement !== colorInput)
      colorInput.value = refObj.color || rgbToHex(getComputedStyle(refNode).color);
    if (document.activeElement !== bgInput)
      bgInput.value = refObj.bg || '#ffffff';
  } else if (isArrow){
    if (document.activeElement !== colorInput)
      colorInput.value = info.obj.color || arrowDefaultColor(cur());
  }

  // recurring-overlay scope selector (which slides the element appears on)
  const scopeSel = $('#sel-scope');
  const isOverlay = !group && info && info.type === 'overlay';
  scopeSel.hidden = !isOverlay;
  if (isOverlay) scopeSel.value = info.obj.scope || 'all';

  // chip toggle (Annotated figure labels & takeaway banner: dark/beige fill)
  const s2 = cur();
  const L2 = (!group && info && s2 && s2.type === 'content') ? contentLayout(s2) : null;
  const isChippable = !group && info && L2 && L2.annStyle === 'label'
    && (info.type === 'ann' || (info.type === 'box' && info.key === 'callout' && L2.callout && L2.callout.banner));
  $('#sel-chip').disabled = !isChippable;
  $('#sel-chip').classList.toggle('active', isChippable && info.obj.chip === 'light');

  updateAnchorHandle(root, cur());
}

/* bounding box + 8 scale handles around every member of a multi-selection;
   dragging a member moves the whole group, dragging a handle scales it */
function renderGroupBox(root, group){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  group.forEach(g => {
    const n = g.node;
    x0 = Math.min(x0, n.offsetLeft); y0 = Math.min(y0, n.offsetTop);
    x1 = Math.max(x1, n.offsetLeft + n.offsetWidth); y1 = Math.max(y1, n.offsetTop + n.offsetHeight);
  });
  const box = el('div', 'lf-group-box', `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px;`);
  addHandles(box);
  root.appendChild(box);
}

/* toggle membership of `sel` in the current selection set (shift-click) */
function toggleMultiSel(sel){
  const set = state.selMulti.length ? state.selMulti.slice() : (state.sel ? [state.sel] : []);
  const idx = set.indexOf(sel);
  if (idx >= 0) set.splice(idx, 1);
  else set.push(sel);
  if (set.length >= 2){ state.sel = null; state.selMulti = set; }
  else if (set.length === 1){ state.sel = set[0]; state.selMulti = []; }
  else { state.sel = null; state.selMulti = []; }
  const root = $('#canvas .slide');
  if (root) applySelection(root);
}

/* resolved selection info for the current single or group selection */
function selectedInfos(slide){
  if (state.selMulti.length >= 2) return state.selMulti.map(sel => selInfo(slide, sel)).filter(Boolean);
  if (state.sel){ const i = selInfo(slide, state.sel); return i ? [i] : []; }
  return [];
}

/* When an annotation is selected on a connector layout that has an image,
   show a draggable dot on the photo. Dragging pins the label's leader line to
   that exact feature (a.anchor, normalized to the figure box); double-click
   clears it back to the automatic figure-edge target. */
function updateAnchorHandle(root, slide){
  root.querySelector('.lf-anchor')?.remove();
  if (!slide || !state.sel || !state.sel.startsWith('ann:')) return;
  if (!slide.images.length) return;
  const L = contentLayout(slide);
  if (!L.connectors || !arrowColor(state.deck)) return;   // pins only matter when arrows are on
  const ann = slide.annotations.find(a => ('ann:' + a.id) === state.sel);
  if (!ann) return;
  const node = root.querySelector(`[data-sel="${state.sel}"]`);
  if (!node) return;

  const fig = figRectOf(slide);
  const pos = { x: parseFloat(node.style.left), y: parseFloat(node.style.top) };
  const { t } = annLeader(fig, ann, pos, node.offsetWidth || ANN_W, node.offsetHeight || 40);

  const dot = el('div', 'lf-anchor' + (ann.anchor ? ' pinned' : ''));
  dot.style.left = t.x + 'px';
  dot.style.top = t.y + 'px';
  dot.title = ann.anchor ? 'Drag to move the pin · double-click to unpin' : 'Drag onto the part of the image this label points to';
  dot.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    checkpoint();
    dot.setPointerCapture(e.pointerId);
    const f = figRectOf(slide);
    const move = ev => {
      const r = root.getBoundingClientRect();
      const px = (ev.clientX - r.left) / viewScale, py = (ev.clientY - r.top) / viewScale;
      ann.anchor = {
        x: clamp((px - f.x) / (f.w || 1), 0, 1),
        y: clamp((py - f.y) / (f.h || 1), 0, 1),
      };
      dot.classList.add('pinned');
      dot.style.left = clamp(px, f.x, f.x + f.w) + 'px';
      dot.style.top = clamp(py, f.y, f.y + f.h) + 'px';
      drawConnectors(root, slide, arrowColor(state.deck));
    };
    const up = () => {
      dot.removeEventListener('pointermove', move);
      dot.removeEventListener('pointerup', up);
      commitChange();
    };
    dot.addEventListener('pointermove', move);
    dot.addEventListener('pointerup', up);
  });
  dot.addEventListener('dblclick', e => {
    e.stopPropagation();
    if (!ann.anchor) return;
    checkpoint();
    delete ann.anchor;
    drawConnectors(root, slide, arrowColor(state.deck));
    updateAnchorHandle(root, slide);
    commitChange();
  });
  root.appendChild(dot);
}

function setSel(sel){
  state.sel = sel;
  state.selMulti = [];
  const root = $('#canvas .slide');
  if (root) applySelection(root);
}

function wireSlideEditing(root, slide){
  const pal = palette(state.deck);
  const accLine = isDark(slide) ? pal.accent : pal.accentInk;

  root.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.lf-h');
    if (handle){
      const groupBox = handle.closest('.lf-group-box');
      if (groupBox && state.selMulti.length >= 2){
        startGroupResize(e, handle.dataset.dir, slide, root, accLine);
        return;
      }
      const node = handle.closest('[data-sel]');
      const info = selInfo(slide, node && node.dataset.sel);
      if (info) startResize(e, handle.dataset.dir, node, slide, info, root, accLine);
      return;
    }
    // free arrows: endpoint dot re-aims one end; body drag moves the whole arrow
    const arEnd = e.target.closest('.lf-arrow-end');
    if (arEnd){
      const a = (slide.arrows || []).find(x => x.id === arEnd.dataset.arid);
      if (a){ setSel('arrow:' + a.id); startArrowEndDrag(e, slide, a, arEnd.dataset.end, root); }
      return;
    }
    const arHit = e.target.closest('.lf-arrow-hit');
    if (arHit){
      const a = (slide.arrows || []).find(x => x.id === arHit.dataset.arid);
      if (a){ setSel('arrow:' + a.id); startArrowMove(e, slide, a, root); }
      return;
    }
    const node = e.target.closest('[data-sel]');
    if (!node){
      if (!e.target.closest('[contenteditable="true"],[contenteditable="plaintext-only"]')) setSel(null);
      return;
    }
    // already editing this element's text → let the caret work
    if (document.activeElement && node.contains(document.activeElement) && document.activeElement.isContentEditable) return;
    e.preventDefault();
    if (e.shiftKey){ toggleMultiSel(node.dataset.sel); return; }
    if (state.selMulti.length >= 2 && state.selMulti.includes(node.dataset.sel)){
      startGroupMove(e, slide, root, accLine);
      return;
    }
    setSel(node.dataset.sel);
    const info = selInfo(slide, node.dataset.sel);
    if (info) startMove(e, node, slide, info, root, accLine);
  });

  // double-click any editable text to edit in place
  root.addEventListener('dblclick', e => {
    // pointer capture from the preceding selection click can retarget the
    // synthetic dblclick to the outer movable box rather than the text node
    // under the cursor, so resolve the real element at this point first
    const real = document.elementFromPoint(e.clientX, e.clientY) || e.target;
    const ed = real.closest('[data-edit]');
    if (!ed) return;
    try { ed.contentEditable = 'plaintext-only'; } catch (err) { ed.contentEditable = 'true'; }
    ed.focus();
    const r = document.createRange(); r.selectNodeContents(ed);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  });

  root.addEventListener('focusin', e => {
    const ed = e.target.closest ? e.target.closest('[data-edit]') : null;
    if (ed && ed.isContentEditable) checkpoint();
  });
  root.addEventListener('focusout', e => {
    const ed = e.target.closest ? e.target.closest('[data-edit]') : null;
    if (!ed || !ed.isContentEditable) return;
    applyEdit(slide, ed.dataset.edit, ed.textContent.trim());
    ed.contentEditable = 'false';
    drawConnectors(root, slide, arrowColor(state.deck));
    updateAnchorHandle(root, slide);
    refreshRailThumb(state.cur);
    save();
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.isContentEditable){
      e.preventDefault(); e.target.blur();
    }
  });
}

function startMove(e, node, slide, info, root, accLine){
  const sx = e.clientX, sy = e.clientY;
  const ox = node.offsetLeft, oy = node.offsetTop;
  let moved = false;
  node.setPointerCapture(e.pointerId);
  const move = ev => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
    if (!moved){ checkpoint(); moved = true; }
    const nx = Math.round(clamp(ox + (ev.clientX - sx) / viewScale, -300, SLIDE_W - 30));
    const ny = Math.round(clamp(oy + (ev.clientY - sy) / viewScale, -200, SLIDE_H - 20));
    node.style.left = nx + 'px'; node.style.top = ny + 'px';
    Object.assign(info.obj, { x: nx, y: ny });
    drawConnectors(root, slide, arrowColor(state.deck));
    updateAnchorHandle(root, slide);
  };
  const up = () => {
    node.removeEventListener('pointermove', move);
    node.removeEventListener('pointerup', up);
    if (moved) commitChange();
    else if (info.isFig){ seedQueryFromText(slide.figure || slide.headline || ''); lastAutoQuery = null; runImageSearch(); }
  };
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
}

function startResize(e, dir, node, slide, info, root, accLine){
  e.stopPropagation(); e.preventDefault();
  checkpoint();
  const sx = e.clientX, sy = e.clientY;
  const x0 = node.offsetLeft, y0 = node.offsetTop, w0 = node.offsetWidth, h0 = node.offsetHeight;
  const fs0 = parseFloat(getComputedStyle(node).fontSize) || 20;
  const ratio = w0 / Math.max(1, h0);
  node.setPointerCapture(e.pointerId);
  const move = ev => {
    const dx = (ev.clientX - sx) / viewScale, dy = (ev.clientY - sy) / viewScale;
    let nx = x0, ny = y0, nw = w0, nh = h0;
    if (dir.includes('e')) nw = w0 + dx;
    if (dir.includes('w')){ nw = w0 - dx; nx = x0 + dx; }
    if (dir.includes('s')) nh = h0 + dy;
    if (dir.includes('n')){ nh = h0 - dy; ny = y0 + dy; }
    nw = Math.max(40, nw); nh = Math.max(22, nh);
    if (info.isImg){
      if (dir.length === 2){ nh = nw / ratio; if (dir.includes('n')) ny = y0 + (h0 - nh); }
      node.style.left = Math.round(nx) + 'px'; node.style.top = Math.round(ny) + 'px';
      node.style.width = Math.round(nw) + 'px'; node.style.height = Math.round(nh) + 'px';
      Object.assign(info.obj, { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) });
    } else {
      const patch = { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw) };
      node.style.left = patch.x + 'px'; node.style.top = patch.y + 'px'; node.style.width = patch.w + 'px';
      // vertical / corner drags rescale the text
      if (dir.includes('n') || dir.includes('s')){
        const nfs = clamp(Math.round(fs0 * nh / h0), 8, 200);
        node.style.fontSize = nfs + 'px';
        patch.fs = nfs;
      }
      Object.assign(info.obj, patch);
    }
    drawConnectors(root, slide, arrowColor(state.deck));
  };
  const up = () => {
    node.removeEventListener('pointermove', move);
    node.removeEventListener('pointerup', up);
    commitChange();
  };
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
}

/* drag any member of a multi-selection to move the whole group together */
function startGroupMove(e, slide, root, accLine){
  const sx = e.clientX, sy = e.clientY;
  const groupBox = root.querySelector('.lf-group-box');
  const gx0 = groupBox ? groupBox.offsetLeft : 0, gy0 = groupBox ? groupBox.offsetTop : 0;
  const members = state.selMulti.map(sel => {
    const node = root.querySelector(`[data-sel="${sel}"]`);
    const info = selInfo(slide, sel);
    return (node && info) ? { node, info, ox: node.offsetLeft, oy: node.offsetTop } : null;
  }).filter(Boolean);
  let moved = false;
  const target = e.target;
  target.setPointerCapture(e.pointerId);
  const move = ev => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
    if (!moved){ checkpoint(); moved = true; }
    const dx = (ev.clientX - sx) / viewScale, dy = (ev.clientY - sy) / viewScale;
    members.forEach(m => {
      const nx = Math.round(clamp(m.ox + dx, -300, SLIDE_W - 30));
      const ny = Math.round(clamp(m.oy + dy, -200, SLIDE_H - 20));
      m.node.style.left = nx + 'px'; m.node.style.top = ny + 'px';
      Object.assign(m.info.obj, { x: nx, y: ny });
    });
    if (groupBox){ groupBox.style.left = Math.round(gx0 + dx) + 'px'; groupBox.style.top = Math.round(gy0 + dy) + 'px'; }
    drawConnectors(root, slide, arrowColor(state.deck));
    updateAnchorHandle(root, slide);
  };
  const up = () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    if (moved) commitChange();
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
}

/* drag a handle on the group bounding box to scale every selected element
   together (uniform proportional scale for corners, single-axis for edges);
   text elements rescale their font size along with their box */
function startGroupResize(e, dir, slide, root, accLine){
  e.stopPropagation(); e.preventDefault();
  checkpoint();
  const groupBox = root.querySelector('.lf-group-box');
  const sx = e.clientX, sy = e.clientY;
  const x0 = groupBox.offsetLeft, y0 = groupBox.offsetTop, w0 = groupBox.offsetWidth, h0 = groupBox.offsetHeight;
  const ratio = w0 / Math.max(1, h0);
  const members = state.selMulti.map(sel => {
    const node = root.querySelector(`[data-sel="${sel}"]`);
    const info = selInfo(slide, sel);
    if (!node || !info) return null;
    return {
      node, info,
      ox: node.offsetLeft, oy: node.offsetTop, ow: node.offsetWidth, oh: node.offsetHeight,
      fs0: parseFloat(getComputedStyle(node).fontSize) || 20,
    };
  }).filter(Boolean);
  groupBox.setPointerCapture(e.pointerId);
  const move = ev => {
    const dx = (ev.clientX - sx) / viewScale, dy = (ev.clientY - sy) / viewScale;
    let nx = x0, ny = y0, nw = w0, nh = h0;
    if (dir.includes('e')) nw = w0 + dx;
    if (dir.includes('w')){ nw = w0 - dx; nx = x0 + dx; }
    if (dir.includes('s')) nh = h0 + dy;
    if (dir.includes('n')){ nh = h0 - dy; ny = y0 + dy; }
    nw = Math.max(60, nw); nh = Math.max(40, nh);
    if (dir.length === 2){ nh = nw / ratio; if (dir.includes('n')) ny = y0 + (h0 - nh); }
    const scaleX = nw / w0, scaleY = nh / h0;
    members.forEach(m => {
      const relX = (m.ox - x0) / w0, relY = (m.oy - y0) / h0;
      const mx = Math.round(nx + relX * nw), my = Math.round(ny + relY * nh);
      m.node.style.left = mx + 'px'; m.node.style.top = my + 'px';
      const patch = { x: mx, y: my };
      if (m.info.isImg){
        const mw = Math.max(20, Math.round(m.ow * scaleX)), mh = Math.max(20, Math.round(m.oh * scaleY));
        m.node.style.width = mw + 'px'; m.node.style.height = mh + 'px';
        patch.w = mw; patch.h = mh;
      } else {
        const mw = Math.max(20, Math.round(m.ow * scaleX));
        m.node.style.width = mw + 'px'; patch.w = mw;
        if (dir.includes('n') || dir.includes('s') || dir.length === 2){
          const nfs = clamp(Math.round(m.fs0 * scaleY), 8, 200);
          m.node.style.fontSize = nfs + 'px';
          patch.fs = nfs;
        }
      }
      Object.assign(m.info.obj, patch);
    });
    groupBox.style.left = Math.round(nx) + 'px'; groupBox.style.top = Math.round(ny) + 'px';
    groupBox.style.width = Math.round(nw) + 'px'; groupBox.style.height = Math.round(nh) + 'px';
    drawConnectors(root, slide, arrowColor(state.deck));
  };
  const up = () => {
    groupBox.removeEventListener('pointermove', move);
    groupBox.removeEventListener('pointerup', up);
    commitChange();
  };
  groupBox.addEventListener('pointermove', move);
  groupBox.addEventListener('pointerup', up);
}

/* drag one endpoint of an arrow to re-aim it */
function startArrowEndDrag(e, slide, a, end, root){
  e.stopPropagation(); e.preventDefault();
  checkpoint();
  const svg = root.querySelector('.lf-arrows');
  const rect = root.getBoundingClientRect();
  const move = ev => {
    a[end] = {
      x: Math.round(clamp((ev.clientX - rect.left) / viewScale, 0, SLIDE_W)),
      y: Math.round(clamp((ev.clientY - rect.top) / viewScale, 0, SLIDE_H)),
    };
    if (svg) setArrowGeom(svg, a);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    commitChange();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/* drag the body of an arrow to move both endpoints together */
function startArrowMove(e, slide, a, root){
  e.stopPropagation(); e.preventDefault();
  const svg = root.querySelector('.lf-arrows');
  const sx = e.clientX, sy = e.clientY;
  const f0 = { ...a.from }, t0 = { ...a.to };
  let moved = false;
  const move = ev => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
    if (!moved){ checkpoint(); moved = true; }
    const dx = (ev.clientX - sx) / viewScale, dy = (ev.clientY - sy) / viewScale;
    a.from = { x: Math.round(clamp(f0.x + dx, 0, SLIDE_W)), y: Math.round(clamp(f0.y + dy, 0, SLIDE_H)) };
    a.to   = { x: Math.round(clamp(t0.x + dx, 0, SLIDE_W)), y: Math.round(clamp(t0.y + dy, 0, SLIDE_H)) };
    if (svg) setArrowGeom(svg, a);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (moved) commitChange();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function applyEdit(slide, key, val){
  if (key === 'headline')       slide.headline = val;
  else if (key === 'callout')   slide.callout = val;
  else if (key === 'presenter') state.deck.presenter = val;
  else if (key === 'date')      state.deck.date = val;
  else if (key.startsWith('text:')){
    const t = (slide.texts || []).find(x => x.id === key.slice(5));
    if (t) t.text = val;
  } else if (key.startsWith('overlay:')){
    const o = (state.deck.overlays || []).find(x => x.id === key.slice(8));
    if (o) o.text = val;
  } else if (key.startsWith('ann:')){
    const a = slide.annotations.find(x => x.id === key.slice(4));
    if (a) a.text = val;
  } else if (key.startsWith('annfull:')){
    const a = slide.annotations.find(x => x.id === key.slice(8));
    if (a) a.full = val;
  }
}

function commitChange(){
  save();
  refreshRailThumb(state.cur);
}

function deleteOne(s, sel){
  const info = selInfo(s, sel);
  if (!info) return;
  if (info.type === 'img')       s.images = s.images.filter(i => ('img:' + i.id) !== sel);
  else if (info.type === 'ann')  s.annotations = s.annotations.filter(a => ('ann:' + a.id) !== sel);
  else if (info.type === 'text') s.texts = (s.texts || []).filter(t => ('text:' + t.id) !== sel);
  else if (info.type === 'overlay') state.deck.overlays = (state.deck.overlays || []).filter(o => ('overlay:' + o.id) !== sel);
  else if (info.type === 'arrow') s.arrows = (s.arrows || []).filter(a => ('arrow:' + a.id) !== sel);
  else if (info.type === 'box')  { s.boxes[info.key] = s.boxes[info.key] || {}; s.boxes[info.key].hidden = true; }
}

function deleteSelected(){
  const s = cur();
  if (!s) return;
  if (state.selMulti.length >= 2){
    state.selMulti.forEach(sel => deleteOne(s, sel));
    state.selMulti = [];
  } else if (state.sel){
    deleteOne(s, state.sel);
  } else return;
  state.sel = null;
  refreshAll();
}

function reorderImage(dir){
  const s = cur();
  if (!s || !state.sel || !state.sel.startsWith('img:')) return;
  const i = s.images.findIndex(x => ('img:' + x.id) === state.sel);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.images.length) return;
  [s.images[i], s.images[j]] = [s.images[j], s.images[i]];
  refreshAll();
}

/* add a free-floating text box the user can place anywhere */
function addTextBox(){
  const s = cur();
  if (!s) return;
  checkpoint();
  s.texts = s.texts || [];
  const t = { id: uid(), text: 'Text', x: 480, y: 320, fs: 32 };   // w omitted → auto-fit to content
  s.texts.push(t);
  state.sel = 'text:' + t.id;
  refreshAll();
}

/* add a recurring deck-level overlay (shown on every slide, editable once) */
function addOverlay(){
  const d = state.deck;
  if (!d) return;
  checkpoint();
  d.overlays = d.overlays || [];
  const o = { id: uid(), type: 'text', text: 'Recurring text', x: 70, y: 110, fs: 20, italic: true, scope: 'all' };
  d.overlays.push(o);
  state.sel = 'overlay:' + o.id;
  refreshAll();
}

/* add a free arrow the user can aim between any two points */
function addArrow(){
  const s = cur();
  if (!s) return;
  checkpoint();
  s.arrows = s.arrows || [];
  const a = { id: uid(), from: { x: 520, y: 360 }, to: { x: 760, y: 360 } };
  s.arrows.push(a);
  state.sel = 'arrow:' + a.id;
  refreshAll();
}

/* Roadmap recaps: clone the deck's roadmap slide once before every section
   slide, highlighting the stop that matches that section's position. Re-runs
   are idempotent — existing recap slides are dropped and rebuilt in place,
   so this also re-syncs them after the roadmap or section order changes. */
function addRoadmapRecaps(){
  const d = state.deck;
  if (!d) return;
  const roadmap = d.slides.find(s => s.type === 'roadmap' && !s.recap);
  if (!roadmap || !roadmap.annotations.length){
    toast('Add a roadmap slide with points first');
    return;
  }
  const sections = d.slides.filter(s => s.type === 'section' && !s.recap);
  if (!sections.length){
    toast('No section slides to recap before');
    return;
  }
  checkpoint();
  const curId = (cur() || {}).id;
  d.slides = d.slides.filter(s => !s.recap);
  sections.forEach((sec, i) => {
    const recap = JSON.parse(JSON.stringify(roadmap));
    recap.id = uid();
    recap.recap = true;
    recap.recapFor = sec.id;
    recap.recapHighlight = Math.min(i, roadmap.annotations.length - 1);
    recap.annotations.forEach(a => a.id = uid());
    recap.images = [];
    recap.texts = [];
    recap.boxes = {};
    recap.layout = null;
    const idx = d.slides.findIndex(s => s.id === sec.id);
    d.slides.splice(idx, 0, recap);
  });
  if (curId){
    const newIdx = d.slides.findIndex(s => s.id === curId);
    if (newIdx >= 0) state.cur = newIdx;
  }
  state.cur = clamp(state.cur, 0, d.slides.length - 1);
  renderRail();
  selectSlide(state.cur);
  save();
  toast('Added a recap slide before each section');
}

/* ================= slide rail ================= */

function thumbNode(slide, i){
  const box = el('div', 'thumb-box');
  const scaleWrap = el('div', '', `transform:scale(${156 / SLIDE_W});transform-origin:top left;width:${SLIDE_W}px;height:${SLIDE_H}px;pointer-events:none;`);
  scaleWrap.appendChild(renderSlide(slide, state.deck, { index: i, total: state.deck.slides.length }));
  box.appendChild(scaleWrap);
  return box;
}

function renderRail(){
  const list = $('#rail-list');
  list.innerHTML = '';
  if (!state.deck) return;
  state.deck.slides.forEach((s, i) => {
    const li = el('li', 'rail-item' + (i === state.cur ? ' current' : ''));
    li.draggable = true;
    li.dataset.index = i;
    li.appendChild(thumbNode(s, i));
    const meta = el('div', 'thumb-meta');
    meta.appendChild(el('span', '', '', String(i + 1)));
    meta.appendChild(el('span', 'type-tag', '', s.type));
    li.appendChild(meta);
    li.addEventListener('click', () => selectSlide(i));
    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/lf-slide', String(i));
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragover', e => {
      if (e.dataTransfer.types.includes('text/lf-slide')){ e.preventDefault(); li.classList.add('drag-over'); }
    });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', e => {
      e.preventDefault(); li.classList.remove('drag-over');
      const from = parseInt(e.dataTransfer.getData('text/lf-slide'), 10);
      const to = i;
      if (isNaN(from) || from === to) return;
      checkpoint();
      const [moved] = state.deck.slides.splice(from, 1);
      state.deck.slides.splice(to, 0, moved);
      state.cur = to;
      refreshAll();
    });
    list.appendChild(li);
  });
}

function refreshRailThumb(i){
  const li = $(`#rail-list .rail-item[data-index="${i}"]`);
  if (!li || !state.deck) return;
  const fresh = thumbNode(state.deck.slides[i], i);
  li.querySelector('.thumb-box').replaceWith(fresh);
}

/* ================= slide selection & toolbar ================= */

function selectSlide(i){
  if (!state.deck) return;
  state.cur = clamp(i, 0, state.deck.slides.length - 1);
  state.sel = null;
  state.selMulti = [];
  renderEditor();
  $$('#rail-list .rail-item').forEach((li, k) => li.classList.toggle('current', k === state.cur));
  updateToolbar();
  seedImagePanel();
  if (!$('#tab-layout').hidden) renderLayoutPanel();
  if (!$('#tab-background').hidden) showBgCurrent();
}

function updateToolbar(){
  const s = cur();
  if (!s) return;
  $('#type-select').value = s.type;
  $('#theme-select').value = s.theme || '';
  $('#slide-pos').textContent = `${state.cur + 1} / ${state.deck.slides.length}`;
  $('#speaker-notes').value = s.notes || '';
}

function refreshAll(){
  renderEditor();
  renderRail();
  updateToolbar();
  save();
}

/* ================= undo / redo ================= */

const undoStack = [], redoStack = [];
const HISTORY_MAX = 60;

function snapshotDeck(){ return JSON.parse(JSON.stringify(state.deck)); }

/* Call BEFORE a mutation to record the state you can return to. */
function checkpoint(){
  if (!state.deck) return;
  undoStack.push({ deck: snapshotDeck(), cur: state.cur });
  if (undoStack.length > HISTORY_MAX) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}
function restore(snap){
  state.deck = snap.deck;
  state.cur = clamp(snap.cur, 0, state.deck.slides.length - 1);
  state.sel = null;
  $('#deck-title').value = state.deck.title || '';
  renderRail();
  selectSlide(state.cur);
  saveDeckNow();
  updateUndoButtons();
}
function undo(){
  if (!undoStack.length){ toast('Nothing to undo'); return; }
  redoStack.push({ deck: snapshotDeck(), cur: state.cur });
  restore(undoStack.pop());
}
function redo(){
  if (!redoStack.length){ toast('Nothing to redo'); return; }
  undoStack.push({ deck: snapshotDeck(), cur: state.cur });
  restore(redoStack.pop());
}
function updateUndoButtons(){
  const u = $('#btn-undo'), r = $('#btn-redo');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
}

/* ================= layout panel ================= */

function showPanelTab(which){
  $$('.ip-tab').forEach(t => t.classList.toggle('current', t.dataset.tab === which));
  $('#tab-images').hidden = which !== 'images';
  $('#tab-layout').hidden = which !== 'layout';
  $('#tab-background').hidden = which !== 'background';
  if (which === 'layout') renderLayoutPanel();
  if (which === 'background') showBgCurrent();
}

/* small schematic preview for each layout option */
function layoutIcon(key){
  const A = '#38bdf8', T = '#8090a2', P = '#33404f', IMG = '#22303e';
  const open = 'data:', svg = inner =>
    `<svg viewBox="0 0 120 68" preserveAspectRatio="none">${inner}</svg>`;
  const bar = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c}"/>`;
  const head = (x = 8, y = 8, w = 60) => bar(x, y, w, 6, A);
  const tline = (x, y, w) => bar(x, y, w, 3, T);
  const img = (x, y, w, h) => bar(x, y, w, h, IMG);
  const panel = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${P}"/>`;
  const dot = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="4" fill="none" stroke="${A}" stroke-width="1.5"/>`;
  switch (key){
    case 'cinematic': return svg(img(0, 0, 120, 68)
      + `<rect x="0" y="40" width="120" height="28" fill="rgba(6,12,20,.55)"/>`
      + bar(8, 48, 64, 8, A) + tline(8, 60, 40));
    case 'annotated': return svg(img(44, 18, 32, 36) + tline(10, 22, 26) + tline(10, 30, 22) + tline(84, 22, 26) + tline(84, 30, 20)
      + `<line x1="38" y1="28" x2="44" y2="30" stroke="${A}" stroke-width="1"/><line x1="76" y1="30" x2="82" y2="28" stroke="${A}" stroke-width="1"/>`);
    case 'cards': return svg(img(44, 18, 32, 36)
      + `<rect x="6" y="8" width="32" height="18" rx="3" fill="none" stroke="${A}" stroke-width="1.5"/>` + tline(11, 20, 20)
      + `<rect x="82" y="12" width="32" height="18" rx="3" fill="none" stroke="${A}" stroke-width="1.5"/>` + tline(87, 24, 20)
      + `<rect x="6" y="42" width="32" height="18" rx="3" fill="none" stroke="${A}" stroke-width="1.5"/>` + tline(11, 54, 20)
      + `<line x1="38" y1="20" x2="44" y2="28" stroke="${A}" stroke-width="1"/><line x1="82" y1="24" x2="76" y2="30" stroke="${A}" stroke-width="1"/><line x1="38" y1="50" x2="44" y2="44" stroke="${A}" stroke-width="1"/>`);
    case 'figureRight': return svg(head(8, 10, 44) + tline(8, 26, 40) + tline(8, 34, 36) + tline(8, 42, 38) + img(66, 14, 46, 44));
    case 'figureLeft': return svg(img(8, 14, 46, 44) + head(64, 10, 44) + tline(64, 26, 40) + tline(64, 34, 36) + tline(64, 42, 38));
    case 'spotlight': return svg(img(8, 12, 56, 46) + head(72, 16, 40) + tline(72, 32, 36) + tline(72, 40, 30));
    case 'bandTop': return svg(head(8, 8, 50) + img(8, 18, 104, 22) + panel(8, 46, 30, 16) + panel(45, 46, 30, 16) + panel(82, 46, 30, 16));
    case 'panels': return svg(head(8, 8, 50) + panel(8, 20, 50, 18) + panel(62, 20, 50, 18) + panel(8, 42, 50, 18) + panel(62, 42, 50, 18));
    case 'comparison': return svg(head(8, 8, 50) + panel(8, 20, 50, 40) + panel(62, 20, 50, 40) + tline(14, 28, 38) + tline(68, 28, 38));
    case 'timeline': return svg(head(8, 8, 50) + dot(20, 38) + dot(50, 38) + dot(80, 38) + dot(110, 38)
      + `<line x1="24" y1="38" x2="46" y2="38" stroke="${A}" stroke-width="1.2"/><line x1="54" y1="38" x2="76" y2="38" stroke="${A}" stroke-width="1.2"/><line x1="84" y1="38" x2="106" y2="38" stroke="${A}" stroke-width="1.2"/>`);
    case 'statement': return svg(bar(10, 18, 70, 9, A) + bar(10, 30, 50, 9, A) + tline(10, 48, 40) + tline(10, 55, 34));
    case 'quote': return svg(`<text x="16" y="30" font-size="22" fill="${A}">“</text>` + bar(24, 24, 72, 6, T) + bar(30, 36, 60, 6, T) + tline(40, 50, 40));
    case 'gallery': return svg(head(8, 8, 50) + img(8, 20, 50, 18) + img(62, 20, 50, 18) + img(8, 42, 50, 18) + img(62, 42, 50, 18));
    case 'figureGrid': return svg(head(8, 8, 50)
      + img(8, 20, 50, 40) + bar(8, 50, 50, 7, P)
      + img(62, 20, 50, 40) + bar(62, 50, 50, 7, P));
    case 'titleCenter': return svg(bar(30, 26, 60, 8, A) + bar(40, 40, 40, 4, T));
    case 'titleLeft': return svg(bar(10, 24, 70, 8, A) + bar(10, 38, 40, 4, T));
    case 'sectionCenter': return svg(`<text x="46" y="44" font-size="22" fill="${P}">01</text>` + bar(34, 30, 52, 7, A));
    case 'sectionLeft': return svg(`<text x="86" y="46" font-size="22" fill="${P}">01</text>` + bar(10, 30, 52, 7, A));
    case 'takeawayCenter': return svg(bar(20, 28, 80, 7, A) + bar(34, 40, 52, 4, T));
    case 'takeawayQuote': return svg(`<text x="14" y="32" font-size="22" fill="${A}">“</text>` + bar(24, 26, 74, 7, T) + bar(32, 38, 58, 5, T));
    case 'roadmapAuto': return svg(dot(24, 34) + dot(60, 34) + dot(96, 34) + `<line x1="28" y1="34" x2="56" y2="34" stroke="${A}" stroke-width="1.2"/><line x1="64" y1="34" x2="92" y2="34" stroke="${A}" stroke-width="1.2"/>`);
    default: return svg(head() + tline(8, 24, 80));
  }
}

function renderLayoutPanel(){
  const list = $('#layout-list');
  if (!list) return;
  list.innerHTML = '';
  const s = cur();
  if (!s) return;
  const opts = LAYOUTS[s.type] || [];
  const curLay = s.type === 'content' ? effContentLayout(s) : (s.layout || (opts[0] && opts[0].key));
  for (const o of opts){
    const card = el('div', 'layout-card' + (o.key === curLay ? ' current' : ''));
    card.title = o.label + (o.needs === 'image' ? ' — works best with an image' : '');
    card.innerHTML = layoutIcon(o.key);
    card.appendChild(el('div', 'lc-name', '', o.label));
    card.addEventListener('click', () => applyLayout(o.key));
    list.appendChild(card);
  }
  if (s.type !== 'content')
    list.appendChild(el('div', 'layout-note', '',
      'Switch the slide Type to “Content” for the full set of 14 content layouts.'));
}

function applyLayout(key){
  const s = cur();
  if (!s) return;
  checkpoint();
  s.layout = key;
  // clear manual geometry so the new layout's defaults apply cleanly
  s.boxes = {};
  s.annotations.forEach(a => { delete a.x; delete a.y; delete a.w; delete a.fs; });
  // reflow images into the layout's zones
  if (s.type === 'content'){
    const L = contentLayout(s);
    const zones = L.galleryZones || L.figZones || [];
    s.images.forEach((im, i) => {
      if (L.fullBleed && i === 0){ Object.assign(im, { x: 0, y: 0, w: 1280, h: 720 }); return; }
      const z = zones[i] || zones[0];
      if (z) Object.assign(im, fitRect(im.w, im.h, z));
    });
  }
  state.sel = null;
  refreshAll();
  renderLayoutPanel();
}

/* ================= image panel ================= */

const LIC_FMT = l => (l === 'cc0' ? 'CC0' : 'CC ' + l.toUpperCase());

const PROVIDERS = {
  openverse: {
    label: 'Openverse',
    ready: () => true,
    async search(q){
      const j = await getJSON(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20`);
      return (j.results || []).map(r => ({
        provider:'openverse', id:'ov-' + r.id,
        thumb: r.thumbnail, full: r.url || r.thumbnail,
        title: r.title || '', author: r.creator || 'Unknown',
        authorUrl: r.creator_url || '', pageUrl: r.foreign_landing_url || '',
        license: r.license ? LIC_FMT(r.license) + (r.license_version ? ' ' + r.license_version : '') : 'Open license',
        licenseUrl: r.license_url || '', sourceName:'Openverse',
      }));
    },
  },
  wikimedia: {
    label: 'Wikimedia Commons',
    ready: () => true,
    async search(q){
      const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
        + '&generator=search&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + q)
        + '&gsrlimit=20&gsrnamespace=6&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&iiurlwidth=480';
      const j = await getJSON(u);
      const pages = Object.values((j.query && j.query.pages) || {});
      return pages.map(p => {
        const ii = p.imageinfo && p.imageinfo[0];
        if (!ii) return null;
        const md = ii.extmetadata || {};
        let full = ii.url;
        if (ii.width > 1600 && ii.thumburl) full = ii.thumburl.replace(/\/(\d+)px-/, '/1280px-');
        return {
          provider:'wikimedia', id:'wm-' + p.pageid,
          thumb: ii.thumburl || ii.url, full,
          title: (p.title || '').replace(/^File:/, ''),
          author: stripHTML(md.Artist && md.Artist.value) || 'Unknown',
          authorUrl: '', pageUrl: ii.descriptionurl || '',
          license: (md.LicenseShortName && md.LicenseShortName.value) || 'See file page',
          licenseUrl: (md.LicenseUrl && md.LicenseUrl.value) || '', sourceName:'Wikimedia',
        };
      }).filter(Boolean);
    },
  },
  unsplash: {
    label: 'Unsplash',
    ready: () => !!settings.unsplashKey,
    async search(q){
      const j = await getJSON(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=20&client_id=${settings.unsplashKey}`);
      return (j.results || []).map(r => ({
        provider:'unsplash', id:'us-' + r.id,
        thumb: r.urls.small, full: r.urls.regular,
        title: r.alt_description || '', author: r.user.name,
        authorUrl: r.user.links.html + '?utm_source=lectureflow&utm_medium=referral',
        pageUrl: r.links.html, license:'Unsplash License',
        licenseUrl:'https://unsplash.com/license',
        downloadLocation: r.links.download_location, sourceName:'Unsplash',
      }));
    },
  },
  pexels: {
    label: 'Pexels',
    ready: () => !!settings.pexelsKey,
    async search(q){
      const j = await getJSON(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20`,
        { headers: { Authorization: settings.pexelsKey } });
      return (j.photos || []).map(r => ({
        provider:'pexels', id:'px-' + r.id,
        thumb: r.src.medium, full: r.src.large2x || r.src.large,
        title: r.alt || '', author: r.photographer,
        authorUrl: r.photographer_url, pageUrl: r.url,
        license:'Pexels License', licenseUrl:'https://www.pexels.com/license/',
        sourceName:'Pexels',
      }));
    },
  },
};

function ipStatus(msg, isErr){
  const st = $('#ip-status');
  if (!msg){ st.hidden = true; return; }
  st.hidden = false;
  st.textContent = msg;
  st.classList.toggle('err', !!isErr);
}

let autoImages = settings.autoImages !== false;
const autoSearchSoon = debounce(() => {
  if (!autoImages || !state.deck || $('#screen-editor').hidden) return;
  const q = $('#ip-query').value.trim();
  if (!q || q === lastAutoQuery) return;
  // don't clobber results the user is actively browsing for the same query
  runImageSearch({ auto: true });
}, 500);

/* fill the search box with a simplified primary term and show any
   alternate subjects (from "alternatively"/"or") as optional chips */
function seedQueryFromText(text){
  const { primary, alternates } = splitFigureTerms(text);
  $('#ip-query').value = primary;
  renderAltChips(alternates);
  return primary;
}

function renderAltChips(alternates){
  const box = $('#ip-alts');
  if (!box) return;
  box.innerHTML = '';
  box.hidden = !alternates.length;
  alternates.forEach(term => {
    const label = el('label', 'ip-alt-chip', '', null);
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.term = term;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(term));
    cb.addEventListener('change', () => {
      label.classList.toggle('active', cb.checked);
      runImageSearch();
    });
    box.appendChild(label);
  });
}

function seedImagePanel(){
  const s = cur();
  if (!s) return;
  if (panelSeedFor !== s.id){
    panelSeedFor = s.id;
    seedQueryFromText(s.figure || s.headline || state.deck.title || '');
  }
  autoSearchSoon();
}

function interleave(lists){
  const out = [];
  const max = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < max; i++)
    for (const l of lists)
      if (i < l.length) out.push(l[i]);
  return out;
}

let searchToken = 0;
let lastAutoQuery = null;
async function runImageSearch(opts = {}){
  const auto = !!opts.auto;
  const q = $('#ip-query').value.trim();
  if (!q){ if (!auto) ipStatus('Type a search query first.'); return; }
  const sel = $('#ip-provider').value;
  let provs;
  if (sel === 'all' || auto){
    provs = Object.keys(PROVIDERS).filter(k => PROVIDERS[k].ready());
  } else {
    if (!PROVIDERS[sel].ready()){
      ipStatus(`${PROVIDERS[sel].label} needs an API key — add it in Settings (⚙).`, true);
      return;
    }
    provs = [sel];
  }
  if (auto) lastAutoQuery = q;
  const token = ++searchToken;
  $('#ip-results').innerHTML = '';
  ipStatus((auto ? 'Suggestions for this slide — searching ' : 'Searching ')
    + provs.map(p => PROVIDERS[p].label).join(', ') + '…');

  // also search any checked alternate subjects, alongside the main query
  const altTerms = $$('#ip-alts input:checked').map(cb => cb.dataset.term);
  const queries = [q, ...altTerms];

  const perTerm = await Promise.all(queries.map(async term => {
    const settled = await Promise.allSettled(provs.map(p => PROVIDERS[p].search(term)));
    return {
      lists: settled.map(s2 => s2.status === 'fulfilled' ? s2.value : []),
      failed: settled.map((s2, i) => s2.status === 'rejected' ? PROVIDERS[provs[i]].label : null).filter(Boolean),
    };
  }));
  if (token !== searchToken) return;
  const failedProvs = [...new Set(perTerm.flatMap(t => t.failed))];
  const seen = new Set();
  const merged = interleave(perTerm.map(t => interleave(t.lists)))
    .filter(r => { const k = r.provider + ':' + r.id; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, auto ? 15 : 48);

  if (!merged.length){
    ipStatus('No results.' + (failedProvs.length ? ` (${failedProvs.join(', ')} failed)` : ''), !!failedProvs.length);
    return;
  }

  // load thumbnails; silently skip any that fail so only working images appear
  const grid = $('#ip-results');
  const { shown, skipped } = await loadResultCells(grid, merged, resultCell,
    n => ipStatus(`${n} image${n === 1 ? '' : 's'}…`), () => token !== searchToken);
  if (token !== searchToken) return;
  ipStatus(`${shown} image${shown === 1 ? '' : 's'}`
    + (skipped ? ` · ${skipped} broken skipped` : '')
    + (failedProvs.length ? ` · ${failedProvs.join(', ')} failed` : ''));
}

/* load thumbnails for search results, appending a cell for each that loads OK;
   silently skip any that fail so only working images appear */
async function loadResultCells(grid, results, cellFn, onProgress, isStale){
  let shown = 0, skipped = 0;
  await Promise.allSettled(results.map(r => new Promise(resolve => {
    const im = new Image();
    const t = setTimeout(() => { im.src = ''; skipped++; resolve(); }, 14000);
    im.onload = () => {
      clearTimeout(t);
      if (isStale()) return resolve();
      grid.appendChild(cellFn(r, im));
      shown++;
      onProgress(shown);
      resolve();
    };
    im.onerror = () => { clearTimeout(t); skipped++; resolve(); };
    im.src = r.thumb;
  })));
  return { shown, skipped };
}

function resultCell(r, imEl){
  const cell = el('div', 'ip-cell');
  cell.title = `${r.title || 'Untitled'}\n${r.author} — ${r.sourceName}\n${r.license}\nClick to insert · drag onto the slide`;
  imEl.alt = r.title || '';
  const wrap = el('div', 'ip-imgwrap');
  wrap.appendChild(imEl);
  cell.appendChild(wrap);
  cell.appendChild(el('span', 'ip-src', '', r.sourceName));
  cell.appendChild(el('span', 'ip-add', '', '＋ Insert'));
  const meta = el('div', 'ip-meta');
  meta.innerHTML = `${escHTML(r.author)} · <span class="lic">${escHTML(r.license)}</span>`;
  cell.appendChild(meta);
  cell.addEventListener('click', () => insertImageFromResult(r));
  cell.draggable = true;
  cell.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/lf-image', JSON.stringify(r));
    e.dataTransfer.effectAllowed = 'copy';
  });
  return cell;
}

function bgResultCell(r, imEl){
  const cell = el('div', 'ip-cell');
  cell.title = `${r.title || 'Untitled'}\n${r.author} — ${r.sourceName}\n${r.license}\nClick to use as the deck background`;
  imEl.alt = r.title || '';
  const wrap = el('div', 'ip-imgwrap');
  wrap.appendChild(imEl);
  cell.appendChild(wrap);
  cell.appendChild(el('span', 'ip-src', '', r.sourceName));
  cell.appendChild(el('span', 'ip-add', '', '🖼 Use'));
  const meta = el('div', 'ip-meta');
  meta.innerHTML = `${escHTML(r.author)} · <span class="lic">${escHTML(r.license)}</span>`;
  cell.appendChild(meta);
  cell.addEventListener('click', () => setBackgroundFromResult(r));
  return cell;
}

let bgSearchToken = 0;
async function runBgSearch(){
  if (!guardDeck()) return;
  const q = $('#bg-query').value.trim();
  if (!q){ bgStatus('Type a search query first.'); return; }
  const provs = Object.keys(PROVIDERS).filter(k => PROVIDERS[k].ready());
  const token = ++bgSearchToken;
  $('#bg-results').innerHTML = '';
  bgStatus('Searching ' + provs.map(p => PROVIDERS[p].label).join(', ') + '…');

  const settled = await Promise.allSettled(provs.map(p => PROVIDERS[p].search(q)));
  if (token !== bgSearchToken) return;
  const lists = settled.map(s2 => s2.status === 'fulfilled' ? s2.value : []);
  const failedProvs = settled.map((s2, i) => s2.status === 'rejected' ? PROVIDERS[provs[i]].label : null).filter(Boolean);
  const merged = interleave(lists).slice(0, 48);

  if (!merged.length){
    bgStatus('No results.' + (failedProvs.length ? ` (${failedProvs.join(', ')} failed)` : ''), !!failedProvs.length);
    return;
  }

  const grid = $('#bg-results');
  const { shown, skipped } = await loadResultCells(grid, merged, bgResultCell,
    n => bgStatus(`${n} image${n === 1 ? '' : 's'}…`), () => token !== bgSearchToken);
  if (token !== bgSearchToken) return;
  bgStatus(`${shown} image${shown === 1 ? '' : 's'}`
    + (skipped ? ` · ${skipped} broken skipped` : '')
    + (failedProvs.length ? ` · ${failedProvs.join(', ')} failed` : ''));
}

function bgStatus(msg, isErr){
  const st = $('#bg-status');
  if (!msg){ st.hidden = true; return; }
  st.hidden = false;
  st.textContent = msg;
  st.classList.toggle('err', !!isErr);
}

async function setBackgroundFromResult(r){
  if (!guardDeck()) return;
  checkpoint();
  toast('Setting background…', 6000);
  let src = r.full;
  try { await loadImageDim(src); }
  catch (e) {
    src = r.thumb;
    try { await loadImageDim(src); }
    catch (e2) { toast('That image failed to load — skipped'); return; }
  }
  state.deck.background = {
    src, blur: +$('#bg-blur').value || 0,
    dark: (await imageAvgLum(src)) < 0.5,    // pick light vs dark text to match the photo
    attr: { title: r.title, author: r.author, authorUrl: r.authorUrl, license: r.license,
            licenseUrl: r.licenseUrl, pageUrl: r.pageUrl, sourceName: r.sourceName },
  };
  showBgCurrent();
  refreshAll();
  toast('Background set' + (r.author ? ` — ${r.author} / ${r.sourceName}` : ''));

  // Unsplash API guidelines: report the download
  if (r.provider === 'unsplash' && r.downloadLocation && settings.unsplashKey){
    fetch(r.downloadLocation, { headers: { Authorization: 'Client-ID ' + settings.unsplashKey } }).catch(() => {});
  }
  // embed as data-URL so exports are self-contained
  await embedImage(state.deck.background);
  showBgCurrent();
  refreshAll();
}

/* reflect deck.background / deck.frame in the Background tab controls */
function showBgCurrent(){
  const bg = state.deck && state.deck.background;
  const box = $('#bg-current');
  if (!bg || !bg.src){ box.hidden = true; }
  else {
    box.hidden = false;
    $('#bg-current-img').src = bg.src;
    const a = bg.attr || {};
    $('#bg-current-attr').innerHTML = a.author
      ? `${escHTML(a.author)} · <span class="lic">${escHTML(a.license || '')}</span>` : '';
  }
  const blur = bg ? (bg.blur || 0) : 8;
  $('#bg-blur').value = blur;
  $('#bg-blur-val').textContent = blur + 'px';
  $('#bg-frame').checked = !!(state.deck && state.deck.frame);
  $('#bg-motion').checked = !!(state.deck && state.deck.motion);
  $('#bg-arrows').value = (state.deck && state.deck.arrows) || 'none';
}

function fitRect(natW, natH, zone){
  const sc = Math.min(zone.w / natW, zone.h / natH);
  const w = Math.round(natW * sc), h = Math.round(natH * sc);
  return { x: Math.round(zone.x + (zone.w - w) / 2), y: Math.round(zone.y + (zone.h - h) / 2), w, h };
}

async function insertImageFromResult(r, at){
  const s = cur();
  if (!s){ toast('Open a deck first'); return; }
  checkpoint();
  toast('Inserting image…', 6000);
  let src = r.full, dim;
  try { dim = await loadImageDim(src); }
  catch (e) {
    try { src = r.thumb; dim = await loadImageDim(src); }
    catch (e2) { toast('That image failed to load — skipped'); return; }
  }
  const im = {
    id: uid(), src, x: 0, y: 0, w: 0, h: 0, cutout: false, cutSrc: null,
    attr: { title: r.title, author: r.author, authorUrl: r.authorUrl, license: r.license,
            licenseUrl: r.licenseUrl, pageUrl: r.pageUrl, sourceName: r.sourceName },
  };
  let place;
  if (at){
    const w = Math.min(380, dim.w);
    const h = Math.round(w * dim.h / dim.w);
    place = { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h };
  } else {
    place = defaultImagePlacement(s, dim.w, dim.h);
  }
  Object.assign(im, place);
  s.images.push(im);
  refreshAll();
  toast('Image inserted' + (im.attr.author ? ` — ${im.attr.author} / ${im.attr.sourceName}` : ''));

  // Unsplash API guidelines: report the download
  if (r.provider === 'unsplash' && r.downloadLocation && settings.unsplashKey){
    fetch(r.downloadLocation, { headers: { Authorization: 'Client-ID ' + settings.unsplashKey } }).catch(() => {});
  }
  // embed as data-URL so exports are self-contained
  embedImage(im).then(() => {
    if ($('#ip-cutout').checked) return applyCutout(im);
  }).then(() => { if (cur() === s) renderEditor(); refreshRailThumb(state.deck.slides.indexOf(s)); save(); });
}

function defaultImagePlacement(slide, natW, natH){
  const i = slide.images.length;
  if (slide.type === 'content'){
    const L = contentLayout(slide);
    if (L.fullBleed && i === 0) return { x: 0, y: 0, w: 1280, h: 720 };
    const zones = L.galleryZones || L.figZones || [{ ...FIGZONE }];
    if (i < zones.length) return fitRect(natW, natH, zones[i]);
    const w = 300, h = Math.round(w * natH / natW);
    return { x: 460 + (i % 4) * 34, y: 190 + (i % 4) * 30, w, h };
  }
  if (i === 0){
    if (slide.type === 'section')  return fitRect(natW, natH, { x: 770, y: 130, w: 420, h: 440 });
    if (slide.type === 'title')    return fitRect(natW, natH, { x: 880, y: 170, w: 330, h: 380 });
    return fitRect(natW, natH, { x: 800, y: 150, w: 400, h: 420 });
  }
  const w = 320, h = Math.round(w * natH / natW);
  return { x: 460 + (i % 4) * 34, y: 190 + (i % 4) * 30, w, h };
}

async function embedImage(im){
  if (im.src.startsWith('data:')) return;
  try {
    const res = await fetch(im.src);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    if (blob.size > 7 * 1024 * 1024) return;        // too big for localStorage — keep the URL
    im.src = await blobToDataURL(blob);
  } catch (e) { /* CORS-blocked: keep remote URL; export will retry */ }
}

// Average perceived luminance (0-1) of an image — used to choose light vs dark
// text over a deck background photo so it stays readable on any photo.
function imageAvgLum(src){
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 24; c.height = 24;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4){ sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++; }
        resolve(n ? sum / n : 0.5);
      } catch (e) { resolve(0.5); }
    };
    img.onerror = () => resolve(0.5);
    img.src = src;
  });
}

// Pre-bake a CSS-style blur(blurPx) for export formats that can't filter live.
// blurPx is expressed in the 1280px-wide slide coordinate space (refW).
function blurImageDataURL(src, blurPx, refW = 1280){
  if (!blurPx) return Promise.resolve(src);
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || refW, h = img.naturalHeight || Math.round(refW * 9 / 16);
        const scaledBlur = blurPx * (w / refW);
        // blur an oversized copy, then crop the inset center so the soft
        // edges of the blur fall outside the cropped frame (matches the
        // overflow-hidden trick used for the live CSS background).
        const big = document.createElement('canvas');
        big.width = Math.round(w * 1.1); big.height = Math.round(h * 1.1);
        const bctx = big.getContext('2d');
        bctx.filter = `blur(${scaledBlur}px)`;
        bctx.drawImage(img, 0, 0, big.width, big.height);
        const out = document.createElement('canvas');
        out.width = w; out.height = h;
        out.getContext('2d').drawImage(big, Math.round(w * 0.05), Math.round(h * 0.05), w, h, 0, 0, w, h);
        resolve(out.toDataURL('image/jpeg', 0.88));
      } catch (e) { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

/* ================= cutout (background removal) ================= */

async function applyCutout(im){
  if (im.cutout){ im.cutout = false; return; }
  if (im.cutSrc){ im.cutout = true; return; }
  toast('Removing background…', 10000);
  try {
    if (settings.removebgKey){
      try { im.cutSrc = await cutoutRemoveBg(im); }
      catch (e) { im.cutSrc = await cutoutLocal(im); toast('remove.bg failed — used the built-in remover'); }
    } else {
      im.cutSrc = await cutoutLocal(im);
    }
    im.cutout = true;
    toast('Background removed');
  } catch (e) {
    toast('Could not remove the background for this image' + (im.src.startsWith('data:') ? '' : ' (image is cross-origin and not embeddable)'));
  }
}

async function cutoutRemoveBg(im){
  const fd = new FormData();
  if (im.src.startsWith('data:')) fd.append('image_file_b64', im.src.split(',')[1]);
  else fd.append('image_url', im.src);
  fd.append('size', 'auto');
  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST', headers: { 'X-Api-Key': settings.removebgKey }, body: fd,
  });
  if (!res.ok) throw new Error('remove.bg HTTP ' + res.status);
  return blobToDataURL(await res.blob());
}

/* built-in fallback background remover.
   Region-grows from the image border. A pixel joins the background when it is
   close to a neighbouring background pixel (local test → follows smooth
   gradients) AND not too far from the nearest border seed colour (global guard
   → stops the fill leaking into the subject through soft edges). This handles
   coloured and gently-varying backgrounds, not just flat white. The boundary
   is feathered for a clean edge. */
function cutoutLocal(im, opts = {}){
  const localTol = opts.localTol != null ? opts.localTol : 26;   // step-to-step similarity
  const globalTol = opts.globalTol != null ? opts.globalTol : 72; // distance from a seed colour
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxSide = 1400;
        const sc = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * sc));
        const h = Math.max(1, Math.round(img.naturalHeight * sc));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h);
        const d = id.data;

        // Seed colours: average each of the four corner patches separately,
        // so multi-coloured / two-tone borders are all captured.
        const patch = Math.max(4, Math.round(Math.min(w, h) * 0.06));
        const seeds = [];
        const cornerAvg = (x0, y0) => {
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = y0; y < y0 + patch && y < h; y++)
            for (let x = x0; x < x0 + patch && x < w; x++){
              const k = (y * w + x) * 4; r += d[k]; g += d[k+1]; b += d[k+2]; n++;
            }
          if (n) seeds.push([r / n, g / n, b / n]);
        };
        cornerAvg(0, 0); cornerAvg(w - patch, 0); cornerAvg(0, h - patch); cornerAvg(w - patch, h - patch);
        const nearSeed = (r, g, b) => {
          let best = 1e9;
          for (const s of seeds){
            const dr = r - s[0], dg = g - s[1], db = b - s[2];
            best = Math.min(best, dr * dr + dg * dg + db * db);
          }
          return best;
        };
        const gTolSq = globalTol * globalTol;
        const lTolSq = localTol * localTol;

        const state = new Uint8Array(w * h);   // 0 unknown, 1 background
        const queue = [];
        const seed = p => { if (!state[p]){ state[p] = 1; queue.push(p); } };
        const px = p => { const k = p * 4; return [d[k], d[k + 1], d[k + 2]]; };

        // start from every border pixel that is close to a seed colour
        for (let x = 0; x < w; x++){
          for (const p of [x, (h - 1) * w + x]){ const c = px(p); if (nearSeed(c[0], c[1], c[2]) <= gTolSq) seed(p); }
        }
        for (let y = 0; y < h; y++){
          for (const p of [y * w, y * w + w - 1]){ const c = px(p); if (nearSeed(c[0], c[1], c[2]) <= gTolSq) seed(p); }
        }
        while (queue.length){
          const p = queue.pop();
          const x = p % w, y = (p / w) | 0;
          const c = px(p);
          const consider = q => {
            if (state[q]) return;
            const cc = px(q);
            const dr = cc[0] - c[0], dg = cc[1] - c[1], db = cc[2] - c[2];
            if (dr * dr + dg * dg + db * db > lTolSq) return;          // local gradient step
            if (nearSeed(cc[0], cc[1], cc[2]) > gTolSq) return;        // global guard
            state[q] = 1; queue.push(q);
          };
          if (x + 1 < w) consider(p + 1);
          if (x - 1 >= 0) consider(p - 1);
          if (y + 1 < h) consider(p + w);
          if (y - 1 >= 0) consider(p - w);
        }

        // apply transparency, feathering pixels that border the kept subject
        for (let y = 0; y < h; y++){
          for (let x = 0; x < w; x++){
            const p = y * w + x;
            if (!state[p]) continue;
            let edge = false;
            if (x + 1 < w && !state[p + 1]) edge = true;
            else if (x - 1 >= 0 && !state[p - 1]) edge = true;
            else if (y + 1 < h && !state[p + w]) edge = true;
            else if (y - 1 >= 0 && !state[p - w]) edge = true;
            d[p * 4 + 3] = edge ? 90 : 0;   // soft halo on the boundary, fully clear inside
          }
        }
        ctx.putImageData(id, 0, 0);
        resolve(cv.toDataURL('image/png'));
      } catch (e) { reject(e); }   // canvas tainted (cross-origin, not embedded)
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = im.src;
  });
}

/* ================= exports ================= */

function slidesHTML(deck){
  const n = deck.slides.length;
  let html = deck.slides.map((s, i) => renderSlide(s, deck, { index: i, total: n }).outerHTML).join('\n');
  const credits = renderCreditsSlide(deck);
  if (credits) html += '\n' + credits.outerHTML;
  return html;
}

async function ensureEmbedded(deck){
  const jobs = [];
  for (const s of deck.slides)
    for (const im of s.images)
      if (!im.src.startsWith('data:')) jobs.push(embedImage(im));
  if (deck.background && deck.background.src && !deck.background.src.startsWith('data:'))
    jobs.push(embedImage(deck.background));
  if (jobs.length) await Promise.allSettled(jobs);
}

async function exportHTML(){
  if (!guardDeck()) return;
  toast('Building standalone HTML…');
  await ensureEmbedded(state.deck);
  const deck = state.deck;
  const doc = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${escHTML(deck.title)}</title>
<style>
${SLIDE_CSS}
html,body{margin:0;height:100%;background:#000;overflow:hidden}
body>.slide{position:fixed;top:50%;left:50%;display:none;transform-origin:center}
body>.slide.on{display:block}
#hud{position:fixed;bottom:10px;left:0;right:0;display:flex;justify-content:space-between;
  padding:0 16px;font:12px ui-sans-serif,system-ui,sans-serif;color:#5c6c7e;z-index:99}
</style></head><body>
${slidesHTML(deck)}
<div id="hud"><span id="ctr"></span><span>← → / click to navigate · made with LectureFlow</span></div>
<script>
var i=0,M=${deck.motion ? 'true' : 'false'},S=Array.prototype.slice.call(document.querySelectorAll('body>.slide'));
function fit(){var s=Math.min(innerWidth/1280,innerHeight/720);
  S.forEach(function(x){x.style.transform='translate(-50%,-50%) scale('+s+')'})}
function show(n){i=Math.max(0,Math.min(S.length-1,n));
  S.forEach(function(x,k){x.classList.toggle('on',k===i);if(M)x.classList.toggle('lf-motion',k===i)});
  document.getElementById('ctr').textContent=(i+1)+' / '+S.length}
addEventListener('resize',fit);
addEventListener('keydown',function(e){
  if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown')show(i+1);
  if(e.key==='ArrowLeft'||e.key==='PageUp')show(i-1);
  if(e.key==='Home')show(0); if(e.key==='End')show(S.length-1)});
addEventListener('click',function(){show(i+1)});
fit();show(0);
<\/script></body></html>`;
  downloadText(safeName(deck.title) + '.html', doc);
  toast('HTML deck downloaded');
}

async function exportPDF(){
  if (!guardDeck()) return;
  await ensureEmbedded(state.deck);
  const deck = state.deck;
  const w = window.open('', '_blank');
  if (!w){ toast('Pop-up blocked — allow pop-ups to export PDF'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${escHTML(deck.title)}</title>
<style>${SLIDE_CSS}
@page{size:1280px 720px;margin:0}
html,body{margin:0;padding:0}
.slide{page-break-after:always;break-after:page}
</style></head><body>${slidesHTML(deck)}</body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 600);
  toast('Use the print dialog → “Save as PDF”');
}

async function exportPPTX(){
  if (!guardDeck()) return;
  toast('Preparing PowerPoint…', 8000);
  try { await loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'); }
  catch (e) { toast('Could not load the PPTX library — check your network'); return; }
  await ensureEmbedded(state.deck);

  const deck = state.deck, pal = palette(deck);
  const p = new window.PptxGenJS();
  p.defineLayout({ name: 'LF', width: 13.333, height: 7.5 });
  p.layout = 'LF';
  const I = px => +(px / 96).toFixed(3);                  // 1280px / 13.333in = 96 px/in
  const C = c => (c || '#000000').replace('#', '');
  const SERIF = 'Georgia', SANS = 'Arial';

  const bg = deck.background;
  const bgData = (bg && bg.src && bg.src.startsWith('data:'))
    ? await blurImageDataURL(bg.src, bg.blur || 0) : null;
  // no colour wash — let the photo show; text colour follows the photo brightness
  // with a contrasting drop shadow for legibility
  const bgTextLight = !!(bgData && bg.dark);
  const txtShadow = bgData
    ? { type: 'outer', color: bgTextLight ? '000000' : 'FFFFFF', blur: 4, offset: 2, angle: 90, opacity: 0.6 }
    : undefined;
  const addBackground = (sl) => {
    if (!bgData) return;
    sl.addImage({ data: bgData, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', w: 13.333, h: 7.5 } });
  };
  const addFrame = (sl, dark) => {
    if (!deck.frame) return;
    const onBg = !!bgData;
    sl.addShape('rect', { x: I(16), y: I(16), w: I(1280 - 32), h: I(720 - 32),
      fill: { type: 'none' },
      line: { color: (onBg || dark) ? 'FFFFFF' : '141C2C', width: 1.5,
              transparency: onBg ? 30 : (dark ? 55 : 80) } });
  };
  const arrowC = arrowColor(deck);
  // height of a filled "chip" label box that fits its text at the given width/font-size
  const chipBoxH = (text, w, fs, padY) => {
    const charsPerLine = Math.max(4, Math.floor(w / (fs * 0.56)));
    const lines = Math.max(1, Math.ceil((text || ' ').length / charsPerLine));
    return lines * fs * 1.42 + padY * 2;
  };

  const addLine = (sl, x1, y1, x2, y2, opt = {}) => {
    const dx = x2 - x1, dy = y2 - y1;
    sl.addShape('line', {
      x: I(Math.min(x1, x2)), y: I(Math.min(y1, y2)),
      w: Math.max(I(Math.abs(dx)), 0.01), h: Math.max(I(Math.abs(dy)), 0.01),
      flipH: (dx < 0) !== (dy < 0),
      line: { color: C(opt.color || pal.accent), width: opt.width || 1.5,
              endArrowType: opt.arrow ? 'triangle' : 'none' },
    });
  };

  deck.slides.forEach((s, idx) => {
    const dark = isDark(s);
    const sl = p.addSlide();
    sl.background = { color: C(dark ? pal.darkSolid : pal.lightSolid) };
    addBackground(sl, dark);
    let ink = dark ? 'EDF3F9' : '17252F';
    if (bgData) ink = bgTextLight ? 'F4F8FB' : '16222C';
    const acc = C(dark ? pal.accent : pal.accentInk);
    const accBar = C(pal.accent);

    const rule = (x, y, w) => sl.addShape('rect', { x: I(x), y: I(y), w: I(w), h: I(5), fill: { color: accBar } });
    const T = (text, o) => sl.addText(text, { fontFace: SANS, color: ink, shadow: txtShadow, ...o });
    const boxAlign = key => (s.boxes && s.boxes[key] && s.boxes[key].align) || undefined;
    const boxObj = key => (s.boxes && s.boxes[key]) || {};
    // custom text colour / background fill carried over from the editor
    const textColor = obj => (obj && obj.color) ? { color: C(obj.color) } : {};
    const colorOpts = obj => Object.assign({}, textColor(obj),
      (obj && obj.bg) ? { fill: { color: C(obj.bg) } } : {});
    const bgFill = (obj, fallback) => ({ color: (obj && obj.bg) ? C(obj.bg) : fallback });
    const pt = px => Math.max(8, Math.round(px * 0.62));   // slide px → PPT points

    if (s.type === 'title'){
      T((deck.date || 'Lecture').toUpperCase(), { x: I(96), y: I(212), w: I(1000), h: I(36), fontSize: 12, charSpacing: 4, color: C(pal.accent2), align: boxAlign('kicker') });
      rule(96, 268, 64);
      T(s.headline || deck.title, { x: I(96), y: I(292), w: I(1010), h: I(210), fontFace: SERIF, fontSize: (s.headline || deck.title).length > 48 ? 34 : 44, bold: true, align: boxAlign('headline'), ...colorOpts(boxObj('headline')) });
      if (deck.presenter) T(deck.presenter, { x: I(96), y: I(516), w: I(900), h: I(40), fontSize: 16, color: dark ? '9FB2C4' : '5B6B7C', align: boxAlign('presenter') });
    }
    else if (s.type === 'roadmap'){
      T(s.headline || 'Roadmap', { x: I(96), y: I(60), w: I(1000), h: I(70), fontFace: SERIF, fontSize: 28, bold: true });
      const g = roadmapGeom(s.annotations.length);
      const hi = s.recapHighlight;
      s.annotations.forEach((a, i) => {
        const st = g.stops[i], r = g.horizontal ? 38 : 27;
        const here = hi != null && i === hi;
        sl.addText(String(i + 1), { shape: 'ellipse', x: I(st.cx - r), y: I(st.cy - r), w: I(r * 2), h: I(r * 2),
          align: 'center', fontFace: SERIF, fontSize: g.horizontal ? 20 : 15,
          color: here ? '0B1220' : C(pal.accent2),
          line: { color: accBar, width: 2 },
          fill: { color: here ? C(pal.accent) : C(dark ? pal.darkSolid : pal.lightSolid) } });
        if (here)
          T('NOW', g.horizontal
            ? { x: I(st.cx - 100), y: I(st.cy - r - 30), w: I(200), h: I(22), align: 'center', fontSize: 9, bold: true, charSpacing: 3, color: C(pal.accent2) }
            : { x: I(st.cx + 56), y: I(st.cy - r - 24), w: I(300), h: I(22), fontSize: 9, bold: true, charSpacing: 3, color: C(pal.accent2) });
        const lblOpts = (hi != null && !here) ? { transparency: 55 } : {};
        if (g.horizontal)
          T(a.text, { x: I(st.cx - 100), y: I(st.cy + 56), w: I(200), h: I(110), align: 'center', fontSize: 12.5, bold: true, ...lblOpts });
        else
          T(a.text, { x: I(st.cx + 56), y: I(st.cy - 18), w: I(920), h: I(44), fontSize: 14.5, bold: true, ...lblOpts });
        if (i < g.stops.length - 1){
          const b = g.stops[i + 1];
          if (g.horizontal) addLine(sl, st.cx + 50, st.cy, b.cx - 54, st.cy, { arrow: true, color: pal.accent });
          else addLine(sl, st.cx, st.cy + 34, st.cx, b.cy - 38, { arrow: true, color: pal.accent });
        }
      });
    }
    else if (s.type === 'section'){
      const partNo = deck.slides.filter(x => x.type === 'section').findIndex(x => x.id === s.id) + 1;
      T(pad2(partNo), { x: I(880), y: I(380), w: I(360), h: I(320), fontFace: SERIF, fontSize: 160, bold: true,
        color: dark ? '24384A' : 'E1E8EE', align: 'right' });
      T('PART ' + pad2(partNo), { x: I(96), y: I(262), w: I(400), h: I(30), fontSize: 11, charSpacing: 4, color: C(pal.accent2) });
      T(s.headline || 'Section', { x: I(96), y: I(296), w: I(840), h: I(170), fontFace: SERIF, fontSize: 38, bold: true, align: boxAlign('headline'), ...colorOpts(boxObj('headline')) });
    }
    else if (s.type === 'takeaway'){
      if (s.layout === 'takeawayQuote'){
        T(s.callout || s.headline || '', { x: I(150), y: I(210), w: I(980), h: I(220), align: boxAlign('callout') || 'center',
          fontFace: SERIF, fontSize: 26, italic: true, bold: true, ...colorOpts(boxObj('callout')) });
        T(s.headline || '', { x: I(200), y: I(470), w: I(880), h: I(40), align: boxAlign('headline') || 'center', fontSize: 13, color: dark ? '9FB2C4' : '5B6B7C', ...colorOpts(boxObj('headline')) });
      } else {
        const chipW = 168;
        sl.addShape('roundRect', { x: I(640 - chipW / 2), y: I(150), w: I(chipW), h: I(34), rectRadius: 0.5, fill: { color: accBar } });
        T('KEY TAKEAWAY', { x: I(640 - chipW / 2), y: I(150), w: I(chipW), h: I(34), align: 'center', valign: 'middle',
          fontSize: 11, charSpacing: 3, bold: true, color: '06222F' });
        rule(608, 218, 64);
        T(s.headline || '', { x: I(150), y: I(258), w: I(980), h: I(220), align: boxAlign('headline') || 'center', fontFace: SERIF,
          fontSize: (s.headline || '').length > 90 ? 24 : 30, bold: true, ...colorOpts(boxObj('headline')) });
        if (s.callout) T(s.callout, { x: I(190), y: I(488), w: I(900), h: I(64), align: boxAlign('callout') || 'center', italic: true, fontSize: 14, color: dark ? 'B9C8D6' : '5B6B7C', ...colorOpts(boxObj('callout')) });
        if (s.annotations.length){
          const n = s.annotations.length, gap = 24, w = Math.min(320, (1120 - (n - 1) * gap) / n);
          const startX = (1280 - (n * w + (n - 1) * gap)) / 2;
          s.annotations.forEach((a, i) => {
            const x = a.x != null ? a.x : (startX + i * (w + gap)), y = a.y != null ? a.y : 552, aw = a.w != null ? a.w : w;
            const fs = a.fs != null ? a.fs : 16;
            const textH = estimateAnnH(a.text) * 0.75;
            const cardH = Math.max(70, textH + 36);
            sl.addShape('roundRect', { x: I(x), y: I(y), w: I(aw), h: I(cardH), rectRadius: 0.07,
              fill: bgFill(a, dark ? '263747' : 'FFFFFF'), line: { color: accBar, width: 1.5 } });
            const badgeD = 22;
            sl.addShape('ellipse', { x: I(x + 14), y: I(y + 12), w: I(badgeD), h: I(badgeD), fill: { color: accBar } });
            sl.addText(String(i + 1), { x: I(x + 14), y: I(y + 12), w: I(badgeD), h: I(badgeD),
              align: 'center', valign: 'middle', fontFace: SERIF, fontSize: 11, bold: true, color: '06222F' });
            T(a.text, { x: I(x + 14 + badgeD + 8), y: I(y + 12), w: I(aw - 28 - badgeD), h: I(cardH - 20),
              fontSize: pt(fs), bold: true, valign: 'middle', align: a.align, ...textColor(a) });
          });
        }
      }
    }
    else { // content — driven by the same layout geometry as the editor
      const L = contentLayout(s);

      // cinematic: full-bleed photo + dark scrim drawn first, white text on top
      const cine = L.fullBleed && s.images.length;
      if (cine){
        const im0 = s.images[0];
        const data0 = (im0.cutout && im0.cutSrc) ? im0.cutSrc : im0.src;
        if (data0.startsWith('data:')){
          sl.addImage({ data: data0, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', w: 13.333, h: 7.5 } });
          sl.addShape('rect', { x: 0, y: I(300), w: 13.333, h: I(420), fill: { color: '060C14', transparency: 15 }, line: { type: 'none' } });
          sl.addShape('rect', { x: 0, y: I(150), w: 13.333, h: I(150), fill: { color: '060C14', transparency: 55 }, line: { type: 'none' } });
          ink = 'FFFFFF';
        }
      }

      if (L.bigQuote){
        T(s.callout || s.headline || '', { x: I(150), y: I(210), w: I(980), h: I(220), align: boxAlign('callout') || 'center',
          fontFace: SERIF, fontSize: 26, italic: true, bold: true, ...colorOpts(boxObj('callout')) });
        T(s.headline || '', { x: I(150), y: I(470), w: I(980), h: I(40), align: boxAlign('headline') || 'center', fontSize: 13, color: dark ? '9FB2C4' : '5B6B7C', ...colorOpts(boxObj('headline')) });
      } else {
        rule(L.headline.x, L.headline.y - 14, 54);
        T(s.headline || '', { x: I(L.headline.x), y: I(L.headline.y), w: I(L.headline.w), h: I(110),
          fontFace: SERIF, fontSize: pt(L.headline.fs), bold: true, valign: 'top', align: boxAlign('headline'), ...colorOpts(boxObj('headline')) });

        if (L.annStyle === 'step' && L.timelineGeom){
          const g = L.timelineGeom;
          s.annotations.forEach((a, i) => {
            const st = g.stops[i]; if (!st) return;
            const r = g.horizontal ? 36 : 26;
            sl.addText(String(i + 1), { shape: 'ellipse', x: I(st.cx - r), y: I(st.cy - r), w: I(r * 2), h: I(r * 2),
              align: 'center', fontFace: SERIF, fontSize: g.horizontal ? 18 : 13, color: C(pal.accent2),
              line: { color: accBar, width: 2 }, fill: { color: C(dark ? pal.darkSolid : pal.lightSolid) } });
            if (g.horizontal) T(a.text, { x: I(st.cx - 100), y: I(st.cy + 52), w: I(200), h: I(90), align: 'center', fontSize: 11, bold: true });
            else T(a.text, { x: I(st.cx + 54), y: I(st.cy - 16), w: I(900), h: I(40), fontSize: 13, bold: true });
            if (i < g.stops.length - 1){
              const b = g.stops[i + 1];
              if (g.horizontal) addLine(sl, st.cx + 48, st.cy, b.cx - 52, st.cy, { arrow: true, color: pal.accent });
              else addLine(sl, st.cx, st.cy + 32, st.cx, b.cy - 36, { arrow: true, color: pal.accent });
            }
          });
        } else {
          s.annotations.forEach((a, i) => {
            const def = L.anns[i];
            if (L.annStyle === 'none' || L.annStyle === 'caption' || !def) return;
            const x = a.x != null ? a.x : def.x, y = a.y != null ? a.y : def.y;
            const w = a.w != null ? a.w : def.w, fs = a.fs != null ? a.fs : (def.fs || 19);
            if (L.annStyle === 'panel'){
              sl.addShape('roundRect', { x: I(x), y: I(y), w: I(w), h: I(def.h || 120), rectRadius: 0.06,
                fill: bgFill(a, dark ? '22303E' : 'FFFFFF'), line: { color: dark ? '3A4A5C' : 'E2E9EF', width: 0.75 } });
              T(pad2(i + 1), { x: I(x + 16), y: I(y + 10), w: I(70), h: I(30), fontFace: SERIF, fontSize: 14, bold: true, color: acc });
              T(a.text, { x: I(x + 16), y: I(y + 40), w: I(w - 32), h: I(36), fontSize: 12.5, bold: true, align: a.align, ...textColor(a) });
              if (a.full && a.full.trim() !== a.text.trim())
                T(a.full, { x: I(x + 16), y: I(y + 76), w: I(w - 32), h: I(Math.max(24, (def.h || 120) - 86)), fontSize: 10, color: dark ? 'AABBCB' : '5B6B7C', align: a.align, ...textColor(a) });
            } else if (L.annStyle === 'card'){
              // discrete bordered card with a numbered badge, like .lf-anncard
              const badgeD = 26;
              const textH = estimateAnnH(a.text);
              const hasFull = a.full && a.full.trim() !== a.text.trim();
              const fullH = hasFull ? estimateAnnH(a.full) * 0.75 : 0;
              const cardH = badgeD + 18 + textH + fullH;
              sl.addShape('roundRect', { x: I(x), y: I(y), w: I(w), h: I(cardH), rectRadius: 0.07,
                fill: bgFill(a, dark ? '263747' : 'FFFFFF'), line: { color: acc, width: 1.25 } });
              sl.addShape('ellipse', { x: I(x + 16), y: I(y + 12), w: I(badgeD), h: I(badgeD), fill: { color: accBar } });
              sl.addText(String(i + 1), { x: I(x + 16), y: I(y + 12), w: I(badgeD), h: I(badgeD),
                align: 'center', valign: 'middle', fontFace: SERIF, fontSize: 11, bold: true, color: '06222F' });
              T(a.text, { x: I(x + 16), y: I(y + 12 + badgeD + 8), w: I(w - 32), h: I(textH), fontSize: pt(fs), bold: true, valign: 'top', align: a.align, ...textColor(a) });
              if (hasFull)
                T(a.full, { x: I(x + 16), y: I(y + 12 + badgeD + 8 + textH), w: I(w - 32), h: I(fullH),
                  fontSize: Math.max(8, pt(fs) - 4), color: dark ? 'AABBCB' : '5B6B7C', italic: true, valign: 'top', align: a.align, ...textColor(a) });
              if (L.connectors && arrowC){
                const fig = figRectOf(s);
                const { a: A, t: Tg } = annLeader(fig, a, { x, y }, w, cardH);
                addLine(sl, A.x, A.y, Tg.x, Tg.y, { color: arrowC, width: 2, arrow: true });
              }
            } else if (L.annStyle === 'label'){
              // filled "chip" label — dark fill/white text by default, or a
              // beige/dark pairing when chip is set to 'light'; the slide's one
              // big takeaway (CALLOUT or last point) gets the bottom-banner variant
              const isLight = a.chip === 'light';
              const padY = def.banner ? 18 : 12;
              const boxH = chipBoxH(a.text, w, fs, padY);
              sl.addShape('roundRect', { x: I(x), y: I(y), w: I(w), h: I(boxH), rectRadius: 0.05,
                fill: { color: a.bg ? C(a.bg) : (isLight ? 'F6EFE2' : '0A121C'), transparency: a.bg ? 0 : (isLight ? 0 : 28) },
                line: { type: 'none' } });
              sl.addShape('rect', { x: I(x), y: I(y), w: I(def.banner ? 6 : 4), h: I(boxH), fill: { color: accBar } });
              T(a.text, { x: I(x + 14), y: I(y), w: I(w - 22), h: I(boxH), fontSize: pt(fs), bold: true,
                valign: 'middle', align: a.align, color: a.color ? C(a.color) : (isLight ? '23303D' : 'FFFFFF') });
              if (L.connectors && !def.banner && arrowC){
                const fig = figRectOf(s);
                const { a: A, t: Tg } = annLeader(fig, a, { x, y }, w, boxH);
                addLine(sl, A.x, A.y, Tg.x, Tg.y, { color: arrowC, width: 2, arrow: true });
              }
            } else {
              // list — accent bar + text
              sl.addShape('rect', { x: I(x), y: I(y), w: I(22), h: I(3), fill: { color: acc } });
              const labelH = estimateAnnH(a.text);
              T(a.text, { x: I(x - 2), y: I(y + 8), w: I(w + 6), h: I(labelH), fontSize: pt(fs), bold: true, valign: 'top', align: a.align, ...colorOpts(a) });
              if (L.annDetail && a.full && a.full.trim() !== a.text.trim())
                T(a.full, { x: I(x - 2), y: I(y + 8 + labelH), w: I(w + 6), h: I(estimateAnnH(a.full) * 0.75),
                  fontSize: Math.max(8, pt(fs) - 4), color: dark ? 'AABBCB' : '5B6B7C', italic: true, valign: 'top', align: a.align, ...textColor(a) });
              if (L.connectors && arrowC){
                const fig = figRectOf(s);
                const { a: A, t: Tg } = annLeader(fig, a, { x, y }, w, estimateAnnH(a.text));
                addLine(sl, A.x, A.y, Tg.x, Tg.y, { color: arrowC, width: 2, arrow: true });
              }
            }
          });
        }
        if (s.callout && L.callout){
          if (L.callout.banner){
            const cobj = boxObj('callout');
            const isLight = cobj.chip === 'light';
            const padY = 18;
            const boxH = chipBoxH(s.callout, L.callout.w, L.callout.fs || 22, padY);
            sl.addShape('roundRect', { x: I(L.callout.x), y: I(L.callout.y), w: I(L.callout.w), h: I(boxH), rectRadius: 0.05,
              fill: { color: cobj.bg ? C(cobj.bg) : (isLight ? 'F6EFE2' : '0A121C'), transparency: cobj.bg ? 0 : (isLight ? 0 : 28) },
              line: { type: 'none' } });
            sl.addShape('rect', { x: I(L.callout.x), y: I(L.callout.y), w: I(6), h: I(boxH), fill: { color: accBar } });
            T(s.callout, { x: I(L.callout.x + 14), y: I(L.callout.y), w: I(L.callout.w - 22), h: I(boxH), fontSize: pt(L.callout.fs || 22), bold: true,
              valign: 'middle', align: boxAlign('callout'), color: cobj.color ? C(cobj.color) : (isLight ? '23303D' : 'FFFFFF') });
          } else {
            sl.addShape('rect', { x: I(L.callout.x), y: I(L.callout.y), w: I(4), h: I(70), fill: { color: accBar } });
            T(s.callout, { x: I(L.callout.x + 12), y: I(L.callout.y), w: I(L.callout.w - 16), h: I(70), italic: true, fontSize: pt(L.callout.fs || 18), align: boxAlign('callout'), ...colorOpts(boxObj('callout')) });
          }
        }
      }
    }

    // free-floating text boxes
    (s.texts || []).forEach(t => {
      const fs = t.fs || 32;
      // auto-fit boxes have no stored width — estimate one from the text so the
      // PPTX box hugs the content the same way the editor does
      const autoW = Math.min(TEXT_AUTO_MAX, Math.max(40, Math.round((t.text || ' ').length * fs * 0.56)));
      const w = t.w != null ? t.w : autoW;
      const charsPerLine = Math.max(4, Math.floor(w / (fs * 0.56)));
      const lines = Math.max(1, Math.ceil((t.text || ' ').length / charsPerLine));
      T(t.text, { x: I(t.x), y: I(t.y), w: I(w), h: I(lines * fs * 1.3 + 10),
        fontSize: pt(fs), bold: true, italic: !!t.italic, valign: 'top', align: t.align, ...colorOpts(t) });
    });

    // recurring deck overlays (rendered on every matching slide)
    (deck.overlays || []).forEach(o => {
      if (o.type && o.type !== 'text') return;
      if (o.scope && o.scope !== 'all' && o.scope !== s.type) return;
      const fs = o.fs || 20;
      const autoW = Math.min(TEXT_AUTO_MAX, Math.max(40, Math.round((o.text || ' ').length * fs * 0.56)));
      const w = o.w != null ? o.w : autoW;
      const charsPerLine = Math.max(4, Math.floor(w / (fs * 0.56)));
      const lines = Math.max(1, Math.ceil((o.text || ' ').length / charsPerLine));
      T(o.text, { x: I(o.x), y: I(o.y), w: I(w), h: I(lines * fs * 1.3 + 10),
        fontSize: pt(fs), bold: true, italic: !!o.italic, valign: 'top', align: o.align, ...colorOpts(o) });
    });

    // free arrows
    (s.arrows || []).forEach(a => {
      const col = a.color || (dark ? '#E9F1F8' : '#1F2D3A');
      addLine(sl, a.from.x, a.from.y, a.to.x, a.to.y, { color: col, width: a.width || 3, arrow: true });
    });

    // images (only embeddable ones survive into PPTX)
    const cl = contentLayout(s);
    const cineFirst = (cl.fullBleed && s.images.length) ? s.images[0] : null;
    for (const im of s.images){
      if (im === cineFirst) continue;   // already drawn full-bleed beneath the text
      const data = (im.cutout && im.cutSrc) ? im.cutSrc : im.src;
      if (!data.startsWith('data:')) continue;
      sl.addImage({ data, x: I(im.x), y: I(im.y), w: I(im.w), h: I(im.h),
        sizing: { type: im.cutout ? 'contain' : 'cover', w: I(im.w), h: I(im.h) } });
    }

    // figure-grid captions, drawn on top of their own photo
    if (cl.annStyle === 'caption'){
      s.annotations.forEach((a, i) => {
        const def = cl.anns[i];
        if (!def) return;
        const x = a.x != null ? a.x : def.x, y = a.y != null ? a.y : def.y;
        const w = a.w != null ? a.w : def.w, fs = a.fs != null ? a.fs : (def.fs || 17);
        const h = def.h || 44;
        sl.addShape('roundRect', { x: I(x), y: I(y), w: I(w), h: I(h), rectRadius: 0.05,
          fill: { color: (a.bg ? C(a.bg) : '0A121C'), transparency: a.bg ? 0 : 35 }, line: { type: 'none' } });
        T(a.text, { x: I(x + 10), y: I(y), w: I(w - 20), h: I(h), align: a.align || 'center', valign: 'middle',
          fontSize: pt(fs), bold: true, color: a.color ? C(a.color) : 'FFFFFF' });
      });
    }

    // footer + attribution
    sl.addText(`${idx + 1} / ${deck.slides.length}`, { x: I(20), y: I(688), w: I(80), h: I(24), fontSize: 8, color: dark ? '7E8FA0' : '8A98A6' });
    const attrs = s.images.filter(im => im.attr && im.attr.author)
      .map(im => `${im.attr.author} / ${im.attr.sourceName} (${im.attr.license})`);
    if (attrs.length)
      sl.addText('Photo: ' + [...new Set(attrs)].join(' · '), { x: I(84), y: I(688), w: I(1000), h: I(24), fontSize: 7.5, color: dark ? '7E8FA0' : '8A98A6' });
    if (s.notes) sl.addNotes(s.notes);
    addFrame(sl, dark);
  });

  // credits slide
  const attrs = collectAttributions(deck);
  if (attrs.length){
    const sl = p.addSlide();
    sl.background = { color: C(pal.darkSolid) };
    addBackground(sl, true);
    sl.addShape('rect', { x: I(96), y: I(74), w: I(54), h: I(5), fill: { color: C(pal.accent) } });
    sl.addText('Image credits', { x: I(96), y: I(88), w: I(800), h: I(70), fontFace: SERIF, fontSize: 28, bold: true, color: 'EDF3F9' });
    sl.addText(attrs.map(a => `Slide ${a.slide} — ${a.author} · ${a.sourceName} · ${a.license}${a.pageUrl ? ' · ' + a.pageUrl : ''}`).join('\n'),
      { x: I(96), y: I(180), w: I(1090), h: I(480), fontSize: 10.5, color: 'C6D3DF', valign: 'top' });
    addFrame(sl, true);
  }

  await p.writeFile({ fileName: safeName(deck.title) + '.pptx' });
  toast('PowerPoint downloaded');
}

function guardDeck(){
  if (!state.deck || !state.deck.slides.length){ toast('Build a deck from an outline first'); return false; }
  return true;
}

/* ================= present mode ================= */

let presenting = false, presentIdx = 0, presentNotesOn = false;
let presentNode = null, presentSteps = [], presentReveal = 0;

function startPresent(){
  if (!guardDeck()) return;
  presenting = true;
  presentIdx = state.cur;
  presentReveal = 0;
  $('#present-overlay').hidden = false;
  document.documentElement.requestFullscreen?.().catch(() => {});
  renderPresent();
}
function stopPresent(){
  presenting = false;
  $('#present-overlay').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function renderPresent(){
  const deck = state.deck;
  presentIdx = clamp(presentIdx, 0, deck.slides.length - 1);
  const stage = $('#present-stage');
  stage.innerHTML = '';
  const sc = Math.min(innerWidth / SLIDE_W, (innerHeight - 10) / SLIDE_H);
  stage.style.width = (SLIDE_W * sc) + 'px';
  stage.style.height = (SLIDE_H * sc) + 'px';
  const slide = deck.slides[presentIdx];
  const node = renderSlide(slide, deck, { index: presentIdx, total: deck.slides.length });
  if (deck.motion) node.classList.add('lf-motion');
  node.style.transform = `scale(${sc})`;
  node.style.transformOrigin = 'top left';
  stage.appendChild(node);
  presentNode = node;
  // sequential reveal: each annotation / panel is a build step you advance into
  // the takeaway banner (Annotated figure) is always shown, not a build step
  presentSteps = deck.motion ? Array.from(node.querySelectorAll('.lf-ann, .lf-panel')).filter(n => !n.classList.contains('lf-takeaway-banner')) : [];
  applyPresentReveal();
  $('#present-counter').textContent = `${presentIdx + 1} / ${deck.slides.length}`;
  const notes = $('#present-notes');
  notes.hidden = !presentNotesOn;
  notes.textContent = slide.notes || '(no notes)';
}

/* hide build steps beyond presentReveal; redraw connectors for what's shown */
function applyPresentReveal(){
  if (!presentNode) return;
  presentSteps.forEach((eln, i) => eln.classList.toggle('lf-unrevealed', i >= presentReveal));
  if (presentNode.dataset.conn)
    drawConnectors(presentNode, state.deck.slides[presentIdx], arrowColor(state.deck));
}

/* ================= screens & UI wiring ================= */

function showScreen(which){
  $('#screen-home').hidden = which !== 'home';
  $('#screen-outline').hidden = which !== 'outline';
  $('#screen-editor').hidden = which !== 'editor';
  document.body.dataset.screen = which;
  // editor-only topbar controls
  const editorOnly = ['#deck-title', '#btn-undo', '#btn-redo', '#btn-outline', '#btn-present'];
  editorOnly.forEach(s => { const n = $(s); if (n) n.style.display = which === 'editor' ? '' : 'none'; });
  const exp = $('#btn-export').closest('.dropdown');
  if (exp) exp.style.display = which === 'editor' ? '' : 'none';
  if (which === 'editor') fitCanvas();
  if (which === 'home') renderHome();
}

/* ================= home screen (decks + folders) ================= */

let homeFolder = 'all';   // 'all' | folder id

function renderHome(){
  renderFolderList();
  renderDeckGrid();
}

function renderFolderList(){
  const list = $('#folder-list');
  list.innerHTML = '';
  const idx = deckIndex();
  const fs = folders();
  const mk = (id, name, count) => {
    const li = el('li', homeFolder === id ? 'current' : '');
    li.appendChild(el('span', '', '', name));
    li.appendChild(el('span', 'fl-count', '', String(count)));
    if (id !== 'all'){
      const del = el('span', 'fl-del', '', '✕');
      del.title = 'Delete folder (decks are kept, just unfiled)';
      del.addEventListener('click', ev => {
        ev.stopPropagation();
        if (!confirm(`Delete folder “${name}”? The decks inside are kept and moved to All decks.`)) return;
        saveFolders(folders().filter(f => f.id !== id));
        const all = deckIndex();
        all.forEach(e => { if (e.folder === id) e.folder = null; });
        saveIndex(all);
        if (homeFolder === id) homeFolder = 'all';
        renderHome();
      });
      li.appendChild(del);
    }
    li.addEventListener('click', () => { homeFolder = id; renderHome(); });
    // accept decks dragged onto a folder
    li.addEventListener('dragover', ev => { if (ev.dataTransfer.types.includes('text/lf-deck')){ ev.preventDefault(); li.classList.add('drop-target'); } });
    li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
    li.addEventListener('drop', ev => {
      ev.preventDefault(); li.classList.remove('drop-target');
      const deckId = ev.dataTransfer.getData('text/lf-deck');
      if (deckId) moveDeckToFolder(deckId, id === 'all' ? null : id);
    });
    list.appendChild(li);
  };
  mk('all', 'All decks', idx.length);
  for (const f of fs) mk(f.id, f.name, idx.filter(e => e.folder === f.id).length);
}

function folderName(id){ const f = folders().find(x => x.id === id); return f ? f.name : null; }

function moveDeckToFolder(deckId, folderId){
  const idx = deckIndex();
  const e = idx.find(x => x.id === deckId);
  if (!e) return;
  e.folder = folderId;
  saveIndex(idx);
  renderHome();
  toast(folderId ? `Moved to “${folderName(folderId)}”` : 'Moved to All decks');
}

function renderDeckGrid(){
  const grid = $('#home-grid');
  grid.innerHTML = '';
  $('#home-title').textContent = homeFolder === 'all' ? 'All decks' : (folderName(homeFolder) || 'Folder');
  let idx = deckIndex();
  if (homeFolder !== 'all') idx = idx.filter(e => e.folder === homeFolder);
  if (!idx.length){
    grid.appendChild(el('div', 'home-empty', '',
      homeFolder === 'all' ? 'No decks yet. Click “＋ New deck” to paste an outline.'
                           : 'This folder is empty. Drag a deck here, or use a card’s folder menu.'));
    return;
  }
  for (const e of idx) grid.appendChild(deckCard(e));
}

function deckCard(entry){
  const card = el('div', 'deck-card');
  card.draggable = true;
  card.addEventListener('dragstart', ev => {
    ev.dataTransfer.setData('text/lf-deck', entry.id);
    ev.dataTransfer.effectAllowed = 'move';
  });
  const thumb = el('div', 'dc-thumb');
  const d = loadDeck(entry.id);
  if (d && d.slides && d.slides.length){
    const scaleWrap = el('div', '', `transform:scale(${260 / SLIDE_W});transform-origin:top left;width:${SLIDE_W}px;height:${SLIDE_H}px;pointer-events:none;`);
    scaleWrap.appendChild(renderSlide(d.slides[0], d, { index: 0, total: d.slides.length }));
    thumb.appendChild(scaleWrap);
  }
  card.appendChild(thumb);
  const body = el('div', 'dc-body');
  body.appendChild(el('div', 'dc-title', '', entry.title || 'Untitled deck'));
  body.appendChild(el('div', 'dc-meta', '',
    `${entry.count} slide${entry.count === 1 ? '' : 's'} · ${new Date(entry.updated).toLocaleDateString()}`));
  card.appendChild(body);
  const open = () => { const dk = loadDeck(entry.id); if (dk) openDeck(dk); else toast('Could not load that deck'); };
  thumb.addEventListener('click', open);
  body.addEventListener('click', open);

  const actions = el('div', 'dc-actions');
  const mkBtn = (label, cls, title, fn) => {
    const b = el('button', 'btn ' + cls, '', label); b.type = 'button'; b.title = title;
    b.addEventListener('click', ev => { ev.stopPropagation(); fn(); });
    return b;
  };
  actions.appendChild(mkBtn('Open', 'primary', 'Open this deck', open));
  actions.appendChild(mkBtn('Copy', 'ghost', 'Duplicate this deck', () => copyDeck(entry.id)));
  actions.appendChild(mkBtn('Download', 'ghost', 'Download as a .json project', () => downloadDeck(entry.id)));
  actions.appendChild(mkBtn('✕', 'ghost danger', 'Delete this deck', () => {
    if (!confirm(`Delete “${entry.title}”? This cannot be undone.`)) return;
    deleteDeck(entry.id);
    if (state.deck && state.deck.id === entry.id) state.deck = null;
    renderHome();
  }));
  // move-to-folder select
  const sel = document.createElement('select');
  sel.title = 'Move to folder';
  sel.appendChild(new Option('No folder', ''));
  for (const f of folders()) sel.appendChild(new Option(f.name, f.id));
  sel.value = entry.folder || '';
  sel.addEventListener('click', ev => ev.stopPropagation());
  sel.addEventListener('change', () => moveDeckToFolder(entry.id, sel.value || null));
  actions.appendChild(sel);
  card.appendChild(actions);
  return card;
}

function copyDeck(id){
  const d = loadDeck(id);
  if (!d) return;
  const copy = JSON.parse(JSON.stringify(d));
  copy.id = uid();
  copy.title = (d.title || 'Untitled deck') + ' (copy)';
  localStorage.setItem(LS.deck(copy.id), JSON.stringify(copy));
  const idx = deckIndex();
  const src = idx.find(e => e.id === id);
  idx.unshift({ id: copy.id, title: copy.title, updated: Date.now(), count: copy.slides.length,
                folder: src ? (src.folder || null) : null });
  saveIndex(idx);
  renderHome();
  toast('Deck copied');
}

function downloadDeck(id){
  const d = loadDeck(id);
  if (!d) return;
  downloadText(safeName(d.title) + '.lectureflow.json', JSON.stringify(d, null, 2), 'application/json');
}

function newFolder(){
  const name = (prompt('Folder name (e.g. “Biology 101”):') || '').trim();
  if (!name) return;
  const fs = folders();
  const f = { id: uid(), name };
  fs.push(f);
  saveFolders(fs);
  homeFolder = f.id;
  renderHome();
}

function importDeckFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = migrateDeck(JSON.parse(reader.result));
      if (!d || !Array.isArray(d.slides)) throw new Error('not a deck');
      d.id = uid();
      openDeck(d);
      toast('Deck imported');
    } catch (e) { toast('That file is not a LectureFlow deck'); }
  };
  reader.readAsText(file);
}

function openDeck(deck){
  state.deck = deck;
  state.cur = 0;
  state.sel = null;
  panelSeedFor = null;
  $('#deck-title').value = deck.title || '';
  showScreen('editor');
  renderRail();
  selectSlide(0);
  showBgCurrent();
  saveDeckNow();
  // backfill the light/dark text choice for decks saved before brightness sampling existed
  if (deck.background && deck.background.src && deck.background.dark === undefined){
    imageAvgLum(deck.background.src).then(lum => {
      if (state.deck !== deck) return;
      deck.background.dark = lum < 0.5;
      refreshAll();
    });
  }
}

function renderDecksModal(){
  const list = $('#decks-list');
  list.innerHTML = '';
  const idx = deckIndex();
  if (!idx.length){
    list.appendChild(el('li', '', 'border:none;color:#93a4b8;', 'No saved decks yet.'));
    return;
  }
  for (const e of idx){
    const li = el('li', state.deck && e.id === state.deck.id ? 'current' : '');
    const name = el('span', 'dk-name', '', e.title || 'Untitled deck');
    name.addEventListener('click', () => {
      const d = loadDeck(e.id);
      if (!d){ toast('That deck could not be loaded'); return; }
      $('#decks-modal').close();
      openDeck(d);
    });
    li.appendChild(name);
    li.appendChild(el('span', 'dk-meta', '', `${e.count} slides · ${new Date(e.updated).toLocaleDateString()}`));
    const del = el('button', 'btn small danger', '', '✕');
    del.type = 'button';
    del.title = 'Delete deck';
    del.addEventListener('click', () => {
      if (!confirm(`Delete “${e.title}”? This cannot be undone.`)) return;
      deleteDeck(e.id);
      if (state.deck && state.deck.id === e.id){ state.deck = null; showScreen('outline'); }
      renderDecksModal();
    });
    li.appendChild(del);
    list.appendChild(li);
  }
}

function wireUI(){
  // outline screen
  $('#btn-outline-sample').addEventListener('click', () => { $('#outline-text').value = SAMPLE_OUTLINE; });
  $('#btn-outline-file').addEventListener('click', () => $('#file-outline').click());
  $('#file-outline').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (f) $('#outline-text').value = await f.text();
    e.target.value = '';
  });
  $('#btn-outline-build').addEventListener('click', () => {
    const text = $('#outline-text').value;
    if (!text.trim()){ toast('Paste an outline first (or “Load sample”)'); return; }
    const deck = parseOutline(text);
    if (!deck.slides.length){ toast('No slides found — check the format guide on the right'); return; }
    openDeck(deck);
    toast(`Parsed ${deck.slides.length} slides — drop in images from the panel on the right`);
  });

  // topbar
  $('#deck-title').addEventListener('input', e => {
    if (state.deck){ state.deck.title = e.target.value; save(); }
  });
  $('#btn-outline').addEventListener('click', () => showScreen('outline'));
  $('#btn-decks').addEventListener('click', () => showScreen('home'));
  const brand = $('#brand');
  if (brand){ brand.style.cursor = 'pointer'; brand.addEventListener('click', () => showScreen('home')); }
  $('#btn-present').addEventListener('click', startPresent);

  // home screen
  $('#btn-new-deck').addEventListener('click', () => showScreen('outline'));
  $('#btn-new-folder').addEventListener('click', newFolder);
  $('#btn-import-deck').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', e => {
    const f = e.target.files[0]; if (f) importDeckFile(f); e.target.value = '';
  });

  // export dropdown
  const dd = $('#btn-export').closest('.dropdown');
  $('#btn-export').addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
  document.addEventListener('click', () => dd.classList.remove('open'));
  $('#export-pptx').addEventListener('click', () => { dd.classList.remove('open'); exportPPTX(); });
  $('#export-pdf').addEventListener('click', () => { dd.classList.remove('open'); exportPDF(); });
  $('#export-html').addEventListener('click', () => { dd.classList.remove('open'); exportHTML(); });

  // settings
  $('#btn-settings').addEventListener('click', () => {
    $('#set-unsplash').value = settings.unsplashKey || '';
    $('#set-pexels').value = settings.pexelsKey || '';
    $('#set-removebg').value = settings.removebgKey || '';
    $('#settings-modal').showModal();
  });
  $('#set-save').addEventListener('click', () => {
    settings.unsplashKey = $('#set-unsplash').value.trim();
    settings.pexelsKey = $('#set-pexels').value.trim();
    settings.removebgKey = $('#set-removebg').value.trim();
    localStorage.setItem(LS.settings, JSON.stringify(settings));
    $('#settings-modal').close();
    toast('Settings saved');
  });

  // canvas toolbar
  $('#type-select').addEventListener('change', e => {
    const s = cur(); if (!s) return;
    checkpoint();
    s.type = e.target.value;
    refreshAll();
  });
  $('#theme-select').addEventListener('change', e => {
    const s = cur(); if (!s) return;
    checkpoint();
    s.theme = e.target.value || null;
    refreshAll();
  });
  $('#btn-relayout').addEventListener('click', () => {
    const s = cur(); if (!s) return;
    checkpoint();
    s.annotations.forEach(a => { a.x = a.y = null; });
    const imgs = s.images;
    s.images = [];
    for (const im of imgs){
      Object.assign(im, (() => {
        const nat = { w: im.w, h: im.h };
        return defaultImagePlacement(s, nat.w, nat.h);
      })());
      s.images.push(im);
    }
    refreshAll();
    toast('Layout reset');
  });
  $('#btn-add-label').addEventListener('click', () => {
    const s = cur(); if (!s) return;
    checkpoint();
    s.annotations.push({ id: uid(), text: 'New label', full: '', x: null, y: null });
    refreshAll();
  });
  $('#sel-front').addEventListener('click', () => { checkpoint(); reorderImage(+1); });
  $('#sel-back').addEventListener('click', () => { checkpoint(); reorderImage(-1); });
  $('#sel-delete').addEventListener('click', () => { checkpoint(); deleteSelected(); });
  ['left', 'center', 'right'].forEach(a => {
    $('#sel-align-' + a).addEventListener('click', () => {
      const s = cur();
      const infos = s && selectedInfos(s);
      if (!infos || !infos.length || !infos.every(i => i.isText)) return;
      checkpoint();
      infos.forEach(i => i.obj.align = a);
      commitChange();
      refreshAll();
    });
  });
  // text colour applies to text elements and to arrows
  const colorable = i => i.isText || i.isArrow;
  let colorCheckpointed = false;
  $('#sel-color').addEventListener('pointerdown', () => { colorCheckpointed = false; });
  $('#sel-color').addEventListener('input', () => {
    const s = cur();
    const infos = s && selectedInfos(s);
    if (!infos || !infos.length || !infos.every(colorable)) return;
    if (!colorCheckpointed){ checkpoint(); colorCheckpointed = true; }
    infos.forEach(i => i.obj.color = $('#sel-color').value);
    renderEditor();
    renderRail();
  });
  $('#sel-color').addEventListener('change', () => {
    const s = cur();
    const infos = s && selectedInfos(s);
    if (!infos || !infos.length) return;
    commitChange();
  });
  $('#sel-color-reset').addEventListener('click', () => {
    const s = cur();
    const infos = s && selectedInfos(s);
    if (!infos || !infos.length || !infos.every(colorable)) return;
    checkpoint();
    infos.forEach(i => delete i.obj.color);
    commitChange();
    refreshAll();
  });
  let bgCheckpointed = false;
  $('#sel-bg').addEventListener('pointerdown', () => { bgCheckpointed = false; });
  $('#sel-bg').addEventListener('input', () => {
    const s = cur();
    const infos = s && selectedInfos(s);
    if (!infos || !infos.length || !infos.every(i => i.isText)) return;
    if (!bgCheckpointed){ checkpoint(); bgCheckpointed = true; }
    infos.forEach(i => i.obj.bg = $('#sel-bg').value);
    renderEditor();
    renderRail();
  });
  $('#sel-bg').addEventListener('change', () => {
    const s = cur();
    const infos = s && selectedInfos(s);
    if (!infos || !infos.length) return;
    commitChange();
  });
  $('#sel-bg-clear').addEventListener('click', () => {
    const s = cur();
    const infos = s && selectedInfos(s);
    if (!infos || !infos.length || !infos.every(i => i.isText)) return;
    checkpoint();
    infos.forEach(i => delete i.obj.bg);
    commitChange();
    refreshAll();
  });
  $('#sel-chip').addEventListener('click', () => {
    const s = cur();
    if (!s || $('#sel-chip').disabled) return;
    const info = selInfo(s, state.sel);
    if (!info) return;
    checkpoint();
    if (info.obj.chip === 'light') delete info.obj.chip;
    else info.obj.chip = 'light';
    commitChange();
    refreshAll();
  });
  $('#sel-cutout').addEventListener('click', async () => {
    const s = cur();
    if (!s || !state.sel || !state.sel.startsWith('img:')) return;
    const im = s.images.find(x => ('img:' + x.id) === state.sel);
    if (!im) return;
    checkpoint();
    await applyCutout(im);
    refreshAll();
  });
  const addTextBtn = $('#btn-add-text');
  if (addTextBtn) addTextBtn.addEventListener('click', addTextBox);
  const addOverlayBtn = $('#btn-add-overlay');
  if (addOverlayBtn) addOverlayBtn.addEventListener('click', addOverlay);
  const addArrowBtn = $('#btn-add-arrow');
  if (addArrowBtn) addArrowBtn.addEventListener('click', addArrow);
  $('#btn-add-recaps').addEventListener('click', addRoadmapRecaps);
  $('#sel-scope').addEventListener('change', () => {
    const s = cur();
    const info = s && selInfo(s, state.sel);
    if (!info || info.type !== 'overlay') return;
    checkpoint();
    info.obj.scope = $('#sel-scope').value;
    refreshAll();
  });

  // undo / redo
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);

  // slide management
  $('#btn-add-slide').addEventListener('click', () => {
    if (!state.deck) return;
    checkpoint();
    const s = blankSlide('content');
    s.headline = 'New slide';
    state.deck.slides.splice(state.cur + 1, 0, s);
    state.cur++;
    renderRail();
    selectSlide(state.cur);
    save();
  });
  $('#btn-dup-slide').addEventListener('click', () => {
    const s = cur(); if (!s) return;
    checkpoint();
    const copy = JSON.parse(JSON.stringify(s));
    copy.id = uid();
    copy.annotations.forEach(a => a.id = uid());
    copy.images.forEach(im => im.id = uid());
    state.deck.slides.splice(state.cur + 1, 0, copy);
    state.cur++;
    renderRail();
    selectSlide(state.cur);
    save();
  });
  $('#btn-del-slide').addEventListener('click', () => {
    if (!state.deck || state.deck.slides.length <= 1){ toast('A deck needs at least one slide'); return; }
    checkpoint();
    state.deck.slides.splice(state.cur, 1);
    state.cur = clamp(state.cur, 0, state.deck.slides.length - 1);
    renderRail();
    selectSlide(state.cur);
    save();
  });

  // speaker notes
  $('#speaker-notes').addEventListener('focus', () => { if (cur()) checkpoint(); });
  $('#speaker-notes').addEventListener('input', e => {
    const s = cur();
    if (s){ s.notes = e.target.value; save(); }
  });

  // image panel
  $('#ip-go').addEventListener('click', () => runImageSearch());
  $('#ip-query').addEventListener('keydown', e => { if (e.key === 'Enter') runImageSearch(); });
  $$('.ip-tab').forEach(t => t.addEventListener('click', () => showPanelTab(t.dataset.tab)));
  const autoBox = $('#ip-auto');
  if (autoBox){
    autoBox.checked = autoImages;
    autoBox.addEventListener('change', () => {
      autoImages = autoBox.checked;
      settings.autoImages = autoImages;
      localStorage.setItem(LS.settings, JSON.stringify(settings));
      if (autoImages){ lastAutoQuery = null; autoSearchSoon(); }
    });
  }

  // background panel
  $('#bg-go').addEventListener('click', () => runBgSearch());
  $('#bg-query').addEventListener('keydown', e => { if (e.key === 'Enter') runBgSearch(); });
  $('#bg-remove').addEventListener('click', () => {
    if (!guardDeck()) return;
    checkpoint();
    state.deck.background = null;
    showBgCurrent();
    refreshAll();
  });
  let blurCheckpointed = false;
  $('#bg-blur').addEventListener('pointerdown', () => { blurCheckpointed = false; });
  $('#bg-blur').addEventListener('input', () => {
    $('#bg-blur-val').textContent = $('#bg-blur').value + 'px';
    if (state.deck && state.deck.background){
      if (!blurCheckpointed){ checkpoint(); blurCheckpointed = true; }
      state.deck.background.blur = +$('#bg-blur').value;
      renderEditor();
      renderRail();
    }
  });
  $('#bg-blur').addEventListener('change', () => {
    if (state.deck && state.deck.background) save();
  });
  $('#bg-frame').addEventListener('change', () => {
    if (!guardDeck()) return;
    checkpoint();
    state.deck.frame = $('#bg-frame').checked;
    refreshAll();
  });
  $('#bg-motion').addEventListener('change', () => {
    if (!guardDeck()) return;
    checkpoint();
    state.deck.motion = $('#bg-motion').checked;
    save();
  });
  $('#bg-arrows').addEventListener('change', () => {
    if (!guardDeck()) return;
    checkpoint();
    state.deck.arrows = $('#bg-arrows').value;
    refreshAll();
  });

  // drop images onto the canvas
  const wrap = $('#canvas-wrap');
  wrap.addEventListener('dragover', e => {
    if (e.dataTransfer.types.includes('text/lf-image')) e.preventDefault();
  });
  wrap.addEventListener('drop', e => {
    const data = e.dataTransfer.getData('text/lf-image');
    if (!data) return;
    e.preventDefault();
    let r;
    try { r = JSON.parse(data); } catch (err) { return; }
    const rect = $('#canvas-scale').getBoundingClientRect();
    const at = {
      x: clamp((e.clientX - rect.left) / viewScale, 0, SLIDE_W),
      y: clamp((e.clientY - rect.top) / viewScale, 0, SLIDE_H),
    };
    insertImageFromResult(r, at);
  });

  // keyboard
  document.addEventListener('keydown', e => {
    if (presenting){
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown'){
        e.preventDefault();
        if (presentReveal < presentSteps.length){ presentReveal++; applyPresentReveal(); }  // reveal next build step
        else { presentIdx++; presentReveal = 0; renderPresent(); }                          // then advance the slide
      }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp'){
        e.preventDefault();
        if (presentReveal > 0){ presentReveal--; applyPresentReveal(); }                     // step the build back
        else { presentIdx--; presentReveal = 1e9; renderPresent(); }                         // prior slide shown fully built
      }
      else if (e.key.toLowerCase() === 's'){ e.preventDefault(); presentNotesOn = !presentNotesOn; renderPresent(); }
      else if (e.key === 'Escape'){ stopPresent(); }
      return;
    }
    const t = e.target;
    const editing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z') && !editing && state.deck && !$('#screen-editor').hidden){
      e.preventDefault(); e.shiftKey ? redo() : undo(); return;
    }
    if (mod && (e.key === 'y' || e.key === 'Y') && !editing && state.deck && !$('#screen-editor').hidden){
      e.preventDefault(); redo(); return;
    }
    if (editing) return;
    if (!state.deck || $('#screen-editor').hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown'){ e.preventDefault(); selectSlide(state.cur + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp'){ e.preventDefault(); selectSlide(state.cur - 1); }
    else if (e.key === 'Delete' || e.key === 'Backspace'){ if (state.sel || state.selMulti.length >= 2){ e.preventDefault(); checkpoint(); deleteSelected(); } }
    else if (e.key === 'Escape'){ if (state.sel || state.selMulti.length){ e.preventDefault(); setSel(null); } }
  });
  $('#present-overlay').addEventListener('click', e => {
    if (e.target.closest('#present-notes')) return;
    presentIdx++;
    if (presentIdx >= state.deck.slides.length){ stopPresent(); presentIdx = state.deck.slides.length - 1; }
    else renderPresent();
  });

  window.addEventListener('resize', () => {
    fitCanvas();
    if (state.deck && !$('#screen-editor').hidden) renderEditor();
    if (presenting) renderPresent();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveDeckNow(); });
}

/* ================= init ================= */

function init(){
  // shared slide styles, injected once (also embedded into exports)
  const st = document.createElement('style');
  st.textContent = SLIDE_CSS;
  document.head.appendChild(st);

  wireUI();

  const curId = localStorage.getItem(LS.current);
  const d = curId && loadDeck(curId);
  if (d && d.slides && d.slides.length){
    openDeck(d);
  } else if (deckIndex().length){
    showScreen('home');
  } else {
    showScreen('outline');
  }
}

init();

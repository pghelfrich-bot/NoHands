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
  {x:85,  y:195}, {x:945, y:195},
  {x:85,  y:360}, {x:945, y:360},
  {x:85,  y:515}, {x:945, y:515},
  {x:520, y:622}, {x:730, y:88},
];
const ANN_W = 250;

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
.slide .lf-img.cut img{object-fit:contain;filter:drop-shadow(0 16px 24px rgba(6,14,24,.38))}
.slide .lf-conn{position:absolute;inset:0;width:100%;height:100%;z-index:20;pointer-events:none}
.slide .lf-ann{position:absolute;z-index:30;width:${ANN_W}px;font-size:19px;line-height:1.32;font-weight:600;letter-spacing:.1px}
.slide .lf-ann::before{content:'';display:block;width:22px;height:3px;border-radius:2px;background:var(--lf-accent);margin-bottom:7px}
.slide.light .lf-ann{color:#1d3142}
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
};
let viewScale = 1;
let panelSeedFor = null;

function blankSlide(type = 'content'){
  return { id: uid(), type, headline:'', callout:'', figure:'', notes:'',
           theme:null, annotations:[], images:[] };
}
function newDeck(){
  return { id: uid(), title:'', presenter:'', date:'', designNotes:'', accent:'indigo', slides:[] };
}
function cur(){ return state.deck ? state.deck.slides[state.cur] : null; }
function palette(deck){ return PALETTES[deck.accent] || PALETTES.indigo; }
function isDark(slide){ return slide.theme ? slide.theme === 'dark' : slide.type !== 'content'; }

function deckIndex(){
  try { return JSON.parse(localStorage.getItem(LS.index) || '[]'); } catch (e) { return []; }
}
function saveDeckNow(){
  const d = state.deck;
  if (!d) return;
  try {
    localStorage.setItem(LS.deck(d.id), JSON.stringify(d));
    const idx = deckIndex().filter(e => e.id !== d.id);
    idx.unshift({ id: d.id, title: d.title || 'Untitled deck', updated: Date.now(), count: d.slides.length });
    localStorage.setItem(LS.index, JSON.stringify(idx.slice(0, 50)));
    localStorage.setItem(LS.current, d.id);
  } catch (e) {
    toast('Could not save (browser storage full?) — large images count against the quota');
  }
}
const save = debounce(saveDeckNow, 400);

function loadDeck(id){
  try { return JSON.parse(localStorage.getItem(LS.deck(id))); } catch (e) { return null; }
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

function annPos(slide, i){
  const a = slide.annotations[i];
  if (a.x != null && a.y != null) return { x: a.x, y: a.y };
  const base = ANN_SLOTS[i % ANN_SLOTS.length];
  const wrap = Math.floor(i / ANN_SLOTS.length) * 26;
  return { x: base.x + wrap, y: base.y + wrap };
}
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
  const root = el('div', 'slide ' + (dark ? 'dark' : 'light'));
  root.dataset.type = slide.type;
  root.style.background = dark ? pal.darkBg : pal.lightBg;
  root.style.setProperty('--lf-accent', accLine);

  root.appendChild(motifSVG(pal, dark));

  switch (slide.type){
    case 'title':    renderTitle(root, slide, deck, pal, dark, opts); break;
    case 'roadmap':  renderRoadmap(root, slide, deck, pal, dark, opts); break;
    case 'section':  renderSection(root, slide, deck, pal, dark, opts); break;
    case 'takeaway': renderTakeaway(root, slide, deck, pal, dark, opts); break;
    default:         renderContent(root, slide, deck, pal, dark, opts); break;
  }

  renderImages(root, slide, opts);
  if (slide.type === 'content' && slide.images.length && slide.annotations.length){
    renderAnnotations(root, slide, opts);
    drawConnectors(root, slide, accLine);
  }
  renderFooter(root, slide, deck, pal, dark, opts);
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
  try { node.contentEditable = 'plaintext-only'; }
  catch (e) { node.contentEditable = 'true'; }
  node.spellcheck = false;
  return node;
}

function renderTitle(root, slide, deck, pal, dark, opts){
  const wrap = el('div', '', `position:absolute;left:96px;top:0;bottom:40px;width:1010px;
    display:flex;flex-direction:column;justify-content:center;gap:26px;z-index:5;`);
  const kicker = deck.date || 'Lecture';
  wrap.appendChild(el('div', '', `font-size:16px;letter-spacing:3.5px;text-transform:uppercase;
    opacity:.8;color:${pal.accent2};font-weight:600;`, kicker));
  wrap.appendChild(el('div', '', `width:64px;height:5px;border-radius:3px;background:${pal.accent};`));
  const txt = slide.headline || deck.title;
  const size = txt.length > 48 ? 56 : 74;
  wrap.appendChild(editable(el('div', 'serif',
    `font-size:${size}px;line-height:1.06;font-weight:600;max-width:980px;`, txt), 'headline', opts));
  if (deck.presenter || opts.editor){
    wrap.appendChild(editable(el('div', '', 'font-size:22px;opacity:.78;',
      deck.presenter || 'Presenter name'), 'presenter', opts));
  }
  root.appendChild(wrap);
}

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
  anns.forEach((a, i) => {
    const st = g.stops[i];
    const r = g.horizontal ? 38 : 27;
    const circ = el('div', 'serif', `position:absolute;z-index:6;left:${st.cx - r}px;top:${st.cy - r}px;
      width:${r * 2}px;height:${r * 2}px;border:2.5px solid ${pal.accent};border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:${g.horizontal ? 30 : 22}px;color:${pal.accent2};`, String(i + 1));
    root.appendChild(circ);
    const lbl = g.horizontal
      ? el('div', '', `position:absolute;z-index:6;left:${st.cx - 100}px;top:${st.cy + 58}px;width:200px;
          text-align:center;font-size:18px;font-weight:600;line-height:1.3;`, a.text)
      : el('div', '', `position:absolute;z-index:6;left:${st.cx + 58}px;top:${st.cy - 16}px;width:900px;
          font-size:21px;font-weight:600;line-height:1.3;`, a.text);
    root.appendChild(editable(lbl, 'ann:' + a.id, opts));
  });
}

function renderSection(root, slide, deck, pal, dark, opts){
  const partNo = deck.slides.filter(s => s.type === 'section')
    .findIndex(s => s.id === slide.id) + 1;
  root.appendChild(el('div', 'serif', `position:absolute;right:46px;bottom:-72px;font-size:330px;
    font-weight:700;line-height:1;z-index:2;opacity:${dark ? '.10' : '.07'};`, pad2(partNo)));
  root.appendChild(el('div', '', `position:absolute;left:96px;top:266px;font-size:15px;letter-spacing:4px;
    text-transform:uppercase;font-weight:650;z-index:5;color:${dark ? pal.accent2 : pal.accentInk};`,
    'Part ' + pad2(partNo)));
  root.appendChild(editable(el('div', 'serif',
    'position:absolute;left:96px;top:298px;width:820px;font-size:62px;font-weight:600;line-height:1.1;z-index:5;',
    slide.headline || 'Section'), 'headline', opts));
  if (opts.editor && slide.figure && !slide.images.length) addFigHint(root, slide, 'right:80px;top:80px;width:300px;');
}

function renderTakeaway(root, slide, deck, pal, dark, opts){
  const wrap = el('div', '', `position:absolute;inset:0 150px 90px 150px;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:28px;z-index:5;text-align:center;`);
  wrap.appendChild(el('div', '', `width:64px;height:5px;border-radius:3px;background:${pal.accent};`));
  const txt = slide.headline || 'The one thing to remember';
  wrap.appendChild(editable(el('div', 'serif',
    `font-size:${txt.length > 90 ? 42 : 54}px;font-weight:600;line-height:1.18;`, txt), 'headline', opts));
  if (slide.callout || opts.editor){
    wrap.appendChild(editable(el('div', '', 'font-size:22px;opacity:.78;font-style:italic;max-width:880px;',
      slide.callout || (opts.editor ? 'Optional supporting line (CALLOUT)' : '')), 'callout', opts));
  }
  root.appendChild(wrap);
  if (slide.annotations.length){
    root.appendChild(el('div', '', `position:absolute;left:0;right:0;bottom:54px;text-align:center;
      font-size:16px;letter-spacing:.6px;opacity:.72;z-index:5;`,
      slide.annotations.map(a => a.text).join('    ·    ')));
  }
}

function renderContent(root, slide, deck, pal, dark, opts){
  const accLine = dark ? pal.accent : pal.accentInk;
  const annotated = slide.images.length && slide.annotations.length;
  root.appendChild(el('div', '', `position:absolute;left:80px;top:50px;width:54px;height:5px;
    border-radius:3px;background:${pal.accent};z-index:5;`));
  root.appendChild(editable(el('div', 'serif', `position:absolute;left:80px;top:64px;
    width:${annotated ? 620 : 1120}px;font-size:38px;font-weight:650;line-height:1.14;z-index:5;`,
    slide.headline || 'Slide headline'), 'headline', opts));

  if (!slide.images.length && slide.annotations.length){
    // no figure → clean multi-panel layout (never an empty image box)
    const rects = panelGrid(slide.annotations.length, !!slide.callout);
    slide.annotations.forEach((a, i) => {
      const r = rects[i];
      const p = el('div', 'lf-panel', `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;`);
      p.appendChild(el('div', 'serif', `font-size:23px;font-weight:700;color:${accLine};margin-bottom:6px;`,
        pad2(i + 1)));
      p.appendChild(editable(el('div', '', 'font-size:20px;font-weight:650;line-height:1.3;', a.text),
        'ann:' + a.id, opts));
      if (a.full && a.full.trim() !== a.text.trim()){
        p.appendChild(editable(el('div', '', 'font-size:14.5px;opacity:.72;margin-top:7px;line-height:1.45;', a.full),
          'annfull:' + a.id, opts));
      }
      root.appendChild(p);
    });
  }

  if (slide.callout){
    const w = annotated ? 380 : 800;
    root.appendChild(editable(el('div', 'lf-callout',
      `left:80px;bottom:${annotated ? 88 : 48}px;max-width:${w}px;`, slide.callout), 'callout', opts));
  }
  if (opts.editor && slide.figure && !slide.images.length){
    addFigHint(root, slide, slide.annotations.length
      ? 'right:80px;top:58px;width:330px;' : 'left:425px;top:300px;width:430px;');
  }
}

function addFigHint(root, slide, pos){
  const hint = el('div', 'lf-fighint', pos);
  hint.appendChild(el('div', '', 'font-weight:650;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8;', 'Suggested figure — click to search'));
  hint.appendChild(el('div', '', 'margin-top:4px;', slide.figure));
  root.appendChild(hint);
}

function renderImages(root, slide, opts){
  slide.images.forEach((im, i) => {
    const node = el('div', 'lf-img ' + (im.cutout ? 'cut' : 'photo'),
      `left:${im.x}px;top:${im.y}px;width:${im.w}px;height:${im.h}px;z-index:${10 + i};`);
    node.dataset.id = im.id;
    const img = document.createElement('img');
    img.src = (im.cutout && im.cutSrc) ? im.cutSrc : im.src;
    img.alt = (im.attr && im.attr.title) || '';
    img.draggable = false;
    node.appendChild(img);
    if (opts.editor) node.appendChild(el('div', 'lf-resize'));
    root.appendChild(node);
  });
}

function renderAnnotations(root, slide, opts){
  slide.annotations.forEach((a, i) => {
    const p = annPos(slide, i);
    const node = el('div', 'lf-ann', `left:${p.x}px;top:${p.y}px;`);
    node.dataset.id = a.id;
    const inner = el('div', 'lf-ann-text', '', a.text);
    inner.dataset.edit = 'ann:' + a.id;   // editing enabled on dblclick
    node.appendChild(inner);
    node.title = a.full && a.full !== a.text ? a.full : '';
    root.appendChild(node);
  });
}

/* connector lines from labels to the figure — reads live DOM positions so it stays correct mid-drag */
function drawConnectors(root, slide, color){
  root.querySelector('.lf-conn[data-role="ann"]')?.remove();
  const annNodes = Array.from(root.querySelectorAll('.lf-ann'));
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

  let inner = '';
  annNodes.forEach((n, i) => {
    const pos = { x: parseFloat(n.style.left), y: parseFloat(n.style.top) };
    const h = n.offsetHeight || estimateAnnH(n.textContent);
    const { a, t } = connectorFor(fig, pos, h);
    const dx = t.x - a.x, dy = t.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(34, len * 0.18) * (i % 2 ? 1 : -1);
    const cx = (a.x + t.x) / 2 - dy / len * bow;
    const cy = (a.y + t.y) / 2 + dx / len * bow;
    inner += `<path d="M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}"
      fill="none" stroke="${color}" stroke-width="2" opacity=".85"/>
      <circle cx="${t.x.toFixed(1)}" cy="${t.y.toFixed(1)}" r="4.5" fill="${color}"/>`;
  });
  const svg = svgEl(inner, 'lf-conn');
  svg.dataset.role = 'ann';
  root.appendChild(svg);
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
  const root = el('div', 'slide dark');
  root.style.background = pal.darkBg;
  root.style.setProperty('--lf-accent', pal.accent);
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

function applySelection(root){
  root.querySelectorAll('.selected').forEach(n => n.classList.remove('selected'));
  if (state.sel){
    const n = root.querySelector(`[data-id="${state.sel.id}"]`);
    if (n) n.classList.add('selected');
    else state.sel = null;
  }
  const tools = $('#sel-tools');
  tools.hidden = !state.sel;
  $('#sel-cutout').disabled = !state.sel || state.sel.kind !== 'img';
  $('#sel-front').disabled = $('#sel-back').disabled = !state.sel || state.sel.kind !== 'img';
}

function setSel(sel){
  state.sel = sel;
  const root = $('#canvas .slide');
  if (root) applySelection(root);
}

function wireSlideEditing(root, slide){
  const pal = palette(state.deck);
  const accLine = isDark(slide) ? pal.accent : pal.accentInk;

  root.addEventListener('pointerdown', e => {
    if (e.target.closest('.lf-resize')) return;
    const imgEl = e.target.closest('.lf-img');
    const annEl = e.target.closest('.lf-ann');
    const node = imgEl || annEl;
    if (!node){
      if (!e.target.closest('[contenteditable="true"],[contenteditable="plaintext-only"]')) setSel(null);
      return;
    }
    if (document.activeElement && node.contains(document.activeElement) && document.activeElement.isContentEditable) return;
    e.preventDefault();
    setSel({ kind: imgEl ? 'img' : 'ann', id: node.dataset.id });
    beginDrag(e, node, slide, accLine, root);
  });

  // resize handles
  root.querySelectorAll('.lf-img .lf-resize').forEach(h => {
    h.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      const node = h.closest('.lf-img');
      const im = slide.images.find(x => x.id === node.dataset.id);
      if (!im) return;
      checkpoint();
      const sx = e.clientX, ow = im.w, ratio = im.h / im.w;
      h.setPointerCapture(e.pointerId);
      const move = ev => {
        const nw = clamp(ow + (ev.clientX - sx) / viewScale, 50, 1500);
        im.w = Math.round(nw); im.h = Math.round(nw * ratio);
        node.style.width = im.w + 'px'; node.style.height = im.h + 'px';
        drawConnectors(root, slide, accLine);
      };
      const up = () => {
        h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up);
        commitChange();
      };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
    });
  });

  // dblclick = edit annotation label text
  root.querySelectorAll('.lf-ann').forEach(n => {
    n.addEventListener('dblclick', () => {
      const inner = n.querySelector('.lf-ann-text');
      if (!inner) return;
      try { inner.contentEditable = 'plaintext-only'; } catch (e) { inner.contentEditable = 'true'; }
      inner.focus();
      const r = document.createRange(); r.selectNodeContents(inner);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    });
  });

  // text edits — snapshot once when an edit begins
  root.addEventListener('focusin', e => {
    const ed = e.target.closest ? e.target.closest('[data-edit]') : null;
    if (ed && ed.isContentEditable) checkpoint();
  });
  root.addEventListener('focusout', e => {
    const ed = e.target.closest ? e.target.closest('[data-edit]') : null;
    if (!ed || !ed.isContentEditable) return;
    applyEdit(slide, ed.dataset.edit, ed.textContent.trim());
    if (ed.classList.contains('lf-ann-text')) ed.contentEditable = 'false';
    drawConnectors(root, slide, accLine);
    refreshRailThumb(state.cur);
    save();
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.isContentEditable){
      e.preventDefault(); e.target.blur();
    }
  });

  // figure hint → seed + run the image search
  const hint = root.querySelector('.lf-fighint');
  if (hint) hint.addEventListener('click', () => {
    $('#ip-query').value = slide.figure || slide.headline;
    runImageSearch();
  });
}

function beginDrag(e, node, slide, accLine, root){
  const id = node.dataset.id;
  const isImg = node.classList.contains('lf-img');
  const obj = isImg ? slide.images.find(x => x.id === id)
                    : slide.annotations.find(x => x.id === id);
  if (!obj) return;
  const sx = e.clientX, sy = e.clientY;
  const ox = parseFloat(node.style.left), oy = parseFloat(node.style.top);
  let moved = false;
  node.setPointerCapture(e.pointerId);
  const move = ev => {
    const nx = ox + (ev.clientX - sx) / viewScale;
    const ny = oy + (ev.clientY - sy) / viewScale;
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
    if (!moved) checkpoint();
    moved = true;
    obj.x = Math.round(clamp(nx, -200, SLIDE_W - 40));
    obj.y = Math.round(clamp(ny, -120, SLIDE_H - 30));
    node.style.left = obj.x + 'px'; node.style.top = obj.y + 'px';
    if (slide.type === 'content') drawConnectors(root, slide, accLine);
  };
  const up = () => {
    node.removeEventListener('pointermove', move);
    node.removeEventListener('pointerup', up);
    if (moved) commitChange();
  };
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
}

function applyEdit(slide, key, val){
  if (key === 'headline')      slide.headline = val;
  else if (key === 'callout')  slide.callout = val;
  else if (key === 'presenter') state.deck.presenter = val;
  else if (key.startsWith('ann:')){
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

function deleteSelected(){
  const s = cur();
  if (!s || !state.sel) return;
  if (state.sel.kind === 'img') s.images = s.images.filter(i => i.id !== state.sel.id);
  else s.annotations = s.annotations.filter(a => a.id !== state.sel.id);
  state.sel = null;
  refreshAll();
}

function reorderImage(dir){
  const s = cur();
  if (!s || !state.sel || state.sel.kind !== 'img') return;
  const i = s.images.findIndex(x => x.id === state.sel.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= s.images.length) return;
  [s.images[i], s.images[j]] = [s.images[j], s.images[i]];
  refreshAll();
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
  renderEditor();
  $$('#rail-list .rail-item').forEach((li, k) => li.classList.toggle('current', k === state.cur));
  updateToolbar();
  seedImagePanel();
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

function seedImagePanel(){
  const s = cur();
  if (!s) return;
  if (panelSeedFor !== s.id){
    panelSeedFor = s.id;
    $('#ip-query').value = s.figure || s.headline || state.deck.title || '';
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

  const settled = await Promise.allSettled(provs.map(p => PROVIDERS[p].search(q)));
  if (token !== searchToken) return;
  const lists = settled.map(s2 => s2.status === 'fulfilled' ? s2.value : []);
  const failedProvs = settled.map((s2, i) => s2.status === 'rejected' ? PROVIDERS[provs[i]].label : null).filter(Boolean);
  const merged = interleave(lists).slice(0, auto ? 15 : 48);

  if (!merged.length){
    ipStatus('No results.' + (failedProvs.length ? ` (${failedProvs.join(', ')} failed)` : ''), !!failedProvs.length);
    return;
  }

  // load thumbnails; silently skip any that fail so only working images appear
  let shown = 0, skipped = 0;
  const grid = $('#ip-results');
  await Promise.allSettled(merged.map(r => new Promise(resolve => {
    const im = new Image();
    const t = setTimeout(() => { im.src = ''; skipped++; resolve(); }, 14000);
    im.onload = () => {
      clearTimeout(t);
      if (token !== searchToken) return resolve();
      grid.appendChild(resultCell(r, im));
      shown++;
      ipStatus(`${shown} image${shown === 1 ? '' : 's'}…`);
      resolve();
    };
    im.onerror = () => { clearTimeout(t); skipped++; resolve(); };
    im.src = r.thumb;
  })));
  if (token !== searchToken) return;
  ipStatus(`${shown} image${shown === 1 ? '' : 's'}`
    + (skipped ? ` · ${skipped} broken skipped` : '')
    + (failedProvs.length ? ` · ${failedProvs.join(', ')} failed` : ''));
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
  if (i === 0){
    if (slide.type === 'content')  return fitRect(natW, natH, FIGZONE);
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
var i=0,S=Array.prototype.slice.call(document.querySelectorAll('body>.slide'));
function fit(){var s=Math.min(innerWidth/1280,innerHeight/720);
  S.forEach(function(x){x.style.transform='translate(-50%,-50%) scale('+s+')'})}
function show(n){i=Math.max(0,Math.min(S.length-1,n));
  S.forEach(function(x,k){x.classList.toggle('on',k===i)});
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
    const ink = dark ? 'EDF3F9' : '17252F';
    const acc = C(dark ? pal.accent : pal.accentInk);
    const accBar = C(pal.accent);

    const rule = (x, y, w) => sl.addShape('rect', { x: I(x), y: I(y), w: I(w), h: I(5), fill: { color: accBar } });
    const T = (text, o) => sl.addText(text, { fontFace: SANS, color: ink, ...o });

    if (s.type === 'title'){
      T((deck.date || 'Lecture').toUpperCase(), { x: I(96), y: I(212), w: I(1000), h: I(36), fontSize: 12, charSpacing: 4, color: C(pal.accent2) });
      rule(96, 268, 64);
      T(s.headline || deck.title, { x: I(96), y: I(292), w: I(1010), h: I(210), fontFace: SERIF, fontSize: (s.headline || deck.title).length > 48 ? 34 : 44, bold: true });
      if (deck.presenter) T(deck.presenter, { x: I(96), y: I(516), w: I(900), h: I(40), fontSize: 16, color: dark ? '9FB2C4' : '5B6B7C' });
    }
    else if (s.type === 'roadmap'){
      T(s.headline || 'Roadmap', { x: I(96), y: I(60), w: I(1000), h: I(70), fontFace: SERIF, fontSize: 28, bold: true });
      const g = roadmapGeom(s.annotations.length);
      s.annotations.forEach((a, i) => {
        const st = g.stops[i], r = g.horizontal ? 38 : 27;
        sl.addText(String(i + 1), { shape: 'ellipse', x: I(st.cx - r), y: I(st.cy - r), w: I(r * 2), h: I(r * 2),
          align: 'center', fontFace: SERIF, fontSize: g.horizontal ? 20 : 15, color: C(pal.accent2),
          line: { color: accBar, width: 2 }, fill: { color: C(dark ? pal.darkSolid : pal.lightSolid) } });
        if (g.horizontal)
          T(a.text, { x: I(st.cx - 100), y: I(st.cy + 56), w: I(200), h: I(110), align: 'center', fontSize: 12.5, bold: true });
        else
          T(a.text, { x: I(st.cx + 56), y: I(st.cy - 18), w: I(920), h: I(44), fontSize: 14.5, bold: true });
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
      T(s.headline || 'Section', { x: I(96), y: I(296), w: I(840), h: I(170), fontFace: SERIF, fontSize: 38, bold: true });
    }
    else if (s.type === 'takeaway'){
      rule(608, 218, 64);
      T(s.headline || '', { x: I(150), y: I(258), w: I(980), h: I(220), align: 'center', fontFace: SERIF,
        fontSize: (s.headline || '').length > 90 ? 24 : 30, bold: true });
      if (s.callout) T(s.callout, { x: I(190), y: I(488), w: I(900), h: I(64), align: 'center', italic: true, fontSize: 14, color: dark ? 'B9C8D6' : '5B6B7C' });
      if (s.annotations.length)
        T(s.annotations.map(a => a.text).join('    ·    '), { x: I(40), y: I(636), w: I(1200), h: I(34), align: 'center', fontSize: 11.5, color: dark ? '9FB2C4' : '5B6B7C' });
    }
    else { // content
      rule(80, 50, 54);
      const annotated = s.images.length && s.annotations.length;
      T(s.headline || '', { x: I(80), y: I(62), w: I(annotated ? 620 : 1120), h: I(100), fontFace: SERIF, fontSize: 24, bold: true });

      if (annotated){
        const fig = figRectOf(s);
        s.annotations.forEach((a, i) => {
          const pos = annPos(s, i);
          const h = estimateAnnH(a.text);
          sl.addShape('rect', { x: I(pos.x), y: I(pos.y), w: I(22), h: I(3), fill: { color: acc } });
          T(a.text, { x: I(pos.x - 4), y: I(pos.y + 8), w: I(ANN_W + 8), h: I(h), fontSize: 12.5, bold: true, valign: 'top' });
          const { a: A, t: Tg } = connectorFor(fig, pos, h);
          addLine(sl, A.x, A.y, Tg.x, Tg.y, { color: dark ? pal.accent : pal.accentInk, width: 1.25 });
          sl.addShape('ellipse', { x: I(Tg.x - 4), y: I(Tg.y - 4), w: I(8), h: I(8), fill: { color: acc } });
        });
      } else if (s.annotations.length){
        const rects = panelGrid(s.annotations.length, !!s.callout);
        s.annotations.forEach((a, i) => {
          const r = rects[i];
          sl.addShape('roundRect', { x: I(r.x), y: I(r.y), w: I(r.w), h: I(r.h), rectRadius: 0.08,
            fill: { color: dark ? '22303E' : 'FFFFFF' }, line: { color: dark ? '3A4A5C' : 'E2E9EF', width: 0.75 } });
          T(pad2(i + 1), { x: I(r.x + 18), y: I(r.y + 12), w: I(70), h: I(34), fontFace: SERIF, fontSize: 15, bold: true, color: acc });
          T(a.text, { x: I(r.x + 18), y: I(r.y + 46), w: I(r.w - 36), h: I(40), fontSize: 13.5, bold: true });
          if (a.full && a.full.trim() !== a.text.trim())
            T(a.full, { x: I(r.x + 18), y: I(r.y + 88), w: I(r.w - 36), h: I(Math.max(30, r.h - 100)), fontSize: 10.5, color: dark ? 'AABBCB' : '5B6B7C' });
        });
      }
      if (s.callout){
        const annotated2 = s.images.length && s.annotations.length;
        const cw = annotated2 ? 380 : 800, cy = annotated2 ? 540 : 600;
        sl.addShape('rect', { x: I(80), y: I(cy), w: I(4), h: I(72), fill: { color: accBar } });
        T(s.callout, { x: I(92), y: I(cy), w: I(cw), h: I(72), italic: true, fontSize: 12.5 });
      }
    }

    // images (only embeddable ones survive into PPTX)
    for (const im of s.images){
      const data = (im.cutout && im.cutSrc) ? im.cutSrc : im.src;
      if (!data.startsWith('data:')) continue;
      sl.addImage({ data, x: I(im.x), y: I(im.y), w: I(im.w), h: I(im.h),
        sizing: { type: im.cutout ? 'contain' : 'cover', w: I(im.w), h: I(im.h) } });
    }

    // footer + attribution
    sl.addText(`${idx + 1} / ${deck.slides.length}`, { x: I(20), y: I(688), w: I(80), h: I(24), fontSize: 8, color: dark ? '7E8FA0' : '8A98A6' });
    const attrs = s.images.filter(im => im.attr && im.attr.author)
      .map(im => `${im.attr.author} / ${im.attr.sourceName} (${im.attr.license})`);
    if (attrs.length)
      sl.addText('Photo: ' + [...new Set(attrs)].join(' · '), { x: I(84), y: I(688), w: I(1000), h: I(24), fontSize: 7.5, color: dark ? '7E8FA0' : '8A98A6' });
    if (s.notes) sl.addNotes(s.notes);
  });

  // credits slide
  const attrs = collectAttributions(deck);
  if (attrs.length){
    const sl = p.addSlide();
    sl.background = { color: C(pal.darkSolid) };
    sl.addShape('rect', { x: I(96), y: I(74), w: I(54), h: I(5), fill: { color: C(pal.accent) } });
    sl.addText('Image credits', { x: I(96), y: I(88), w: I(800), h: I(70), fontFace: SERIF, fontSize: 28, bold: true, color: 'EDF3F9' });
    sl.addText(attrs.map(a => `Slide ${a.slide} — ${a.author} · ${a.sourceName} · ${a.license}${a.pageUrl ? ' · ' + a.pageUrl : ''}`).join('\n'),
      { x: I(96), y: I(180), w: I(1090), h: I(480), fontSize: 10.5, color: 'C6D3DF', valign: 'top' });
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

function startPresent(){
  if (!guardDeck()) return;
  presenting = true;
  presentIdx = state.cur;
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
  const node = renderSlide(deck.slides[presentIdx], deck, { index: presentIdx, total: deck.slides.length });
  node.style.transform = `scale(${sc})`;
  node.style.transformOrigin = 'top left';
  stage.appendChild(node);
  $('#present-counter').textContent = `${presentIdx + 1} / ${deck.slides.length}`;
  const notes = $('#present-notes');
  notes.hidden = !presentNotesOn;
  notes.textContent = deck.slides[presentIdx].notes || '(no notes)';
}

/* ================= screens & UI wiring ================= */

function showScreen(which){
  $('#screen-outline').hidden = which !== 'outline';
  $('#screen-editor').hidden = which !== 'editor';
  if (which === 'editor'){ fitCanvas(); }
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
  saveDeckNow();
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
  $('#btn-decks').addEventListener('click', () => { renderDecksModal(); $('#decks-modal').showModal(); });
  $('#decks-new').addEventListener('click', () => { $('#decks-modal').close(); showScreen('outline'); });
  $('#btn-present').addEventListener('click', startPresent);

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
  $('#sel-cutout').addEventListener('click', async () => {
    const s = cur();
    if (!s || !state.sel || state.sel.kind !== 'img') return;
    const im = s.images.find(x => x.id === state.sel.id);
    if (!im) return;
    checkpoint();
    await applyCutout(im);
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
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown'){ e.preventDefault(); presentIdx++; renderPresent(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp'){ e.preventDefault(); presentIdx--; renderPresent(); }
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
    else if (e.key === 'Delete' || e.key === 'Backspace'){ if (state.sel){ e.preventDefault(); checkpoint(); deleteSelected(); } }
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
  } else {
    showScreen('outline');
  }
}

init();

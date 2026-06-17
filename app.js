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
  templates: 'lectureflow.templates',
  deck:   id => 'lectureflow.deck.' + id,
  taste:  'lectureflow.taste',
};

/* IndexedDB for deck content — no 5MB cap, survives large image decks */
const IDB = (() => {
  let _db = null;
  function openDb(){
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('LectureFlowDecks', 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore('decks');
      r.onsuccess = e => { _db = e.target.result; res(_db); };
      r.onerror = () => rej(r.error);
    });
  }
  async function get(key){
    const db = await openDb();
    return new Promise((res, rej) => {
      const r = db.transaction('decks','readonly').objectStore('decks').get(key);
      r.onsuccess = () => res(r.result ?? null);
      r.onerror = () => rej(r.error);
    });
  }
  async function set(key, val){
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction('decks','readwrite');
      tx.objectStore('decks').put(val, key);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }
  async function del(key){
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction('decks','readwrite');
      tx.objectStore('decks').delete(key);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }
  return { get, set, del };
})();

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
.slide .lf-img.bordered img{border:7px solid #fff;box-sizing:border-box;background:#fff}
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
.slide .lf-ann.lf-chip:not(.lf-takeaway-banner){width:fit-content;min-width:80px}
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
/* keep the footer/credit/flow-arrow clear of the frame's border */
.slide.framed .lf-footer{bottom:32px}
.slide.framed .lf-credit{bottom:29px}
.slide.framed .lf-flow{bottom:34px}
/* with an HD background showing through (no wash), pick text colour to match the
   photo's brightness and add a legibility halo so it reads on any photo */
.slide.has-bg.bg-light:not(.cine),
.slide.has-bg.bg-light:not(.cine) .lf-box,.slide.has-bg.bg-light:not(.cine) .serif,.slide.has-bg.bg-light:not(.cine) .lf-ann{
  color:#16222c;text-shadow:0 1px 2px rgba(255,255,255,.92),0 0 18px rgba(255,255,255,.7)}
.slide.has-bg.bg-dark:not(.cine),
.slide.has-bg.bg-dark:not(.cine) .lf-box,.slide.has-bg.bg-dark:not(.cine) .serif,.slide.has-bg.bg-dark:not(.cine) .lf-ann{
  color:#f4f8fb;text-shadow:0 1px 4px rgba(0,0,0,.9),0 0 12px rgba(0,0,0,.65)}
/* inline / display math (KaTeX), typeset from $...$ and $$...$$ in slide text */
.lf-math{color:inherit}
.lf-math-display{display:block;margin:.35em 0;text-align:center;overflow-x:auto}
.lf-math .katex,.lf-math-display .katex{color:inherit;font-size:1.08em}
#present-notes .lf-math-display{text-align:left}
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
function debounce(fn, ms){
  let t;
  const wrapped = (...a) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...a); }, ms); };
  // run fn immediately and cancel any pending call — used before navigating
  // away so the in-progress edit isn't lost to a timer that never fires
  wrapped.flush = (...a) => { if (t != null){ clearTimeout(t); t = null; fn(...a); } };
  return wrapped;
}
function escHTML(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function stripHTML(s){ const d = document.createElement('div'); d.innerHTML = s || ''; return d.textContent.trim(); }
function pad2(n){ return String(n).padStart(2, '0'); }

/* ================= inline math (KaTeX) ================= */

/* Split text into alternating plain-text and math segments, recognizing
   $$...$$ (display) and $...$ (inline). Uses Pandoc-style delimiter rules so
   ordinary prose like "funding ranges from $5 to $10 million" isn't mistaken
   for an equation: an opening $ must be followed by a non-space character
   and the closing $ must be preceded by a non-space character and not
   immediately followed by a digit. */
function splitMathSegments(text){
  const re = /\$\$([\s\S]+?)\$\$|\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\\)(?<!\s)\$(?!\d)/g;
  const segs = [];
  let last = 0, m;
  while ((m = re.exec(text))){
    if (m.index > last) segs.push({ math: false, text: text.slice(last, m.index) });
    if (m[1] != null) segs.push({ math: true, display: true, tex: m[1].trim() });
    else segs.push({ math: true, display: false, tex: m[2].replace(/\\\$/g, '$') });
    last = re.lastIndex;
  }
  if (last < text.length) segs.push({ math: false, text: text.slice(last) });
  return segs;
}

/* KaTeX is loaded from a CDN on first use (mirrors the pptxgenjs export
   dependency) so decks without equations never pay for it. */
let katexReady = false, katexLoading = null;
function ensureKatex(){
  if (katexReady) return Promise.resolve();
  if (!katexLoading){
    const css = new Promise((res, rej) => {
      if (document.querySelector('link[data-katex]')) return res();
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.dataset.katex = '1';
      l.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      l.onload = res; l.onerror = () => rej(new Error('katex css load failed'));
      document.head.appendChild(l);
    });
    katexLoading = Promise.all([loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js'), css])
      .then(() => { katexReady = true; });
  }
  return katexLoading;
}

/* re-render whatever's currently on screen once KaTeX finishes loading, so
   equations that were shown as raw $...$ source pop into typeset notation */
function rerenderMath(){
  try {
    if (presenting) renderPresent(0);
    else if (state.deck) refreshAll();
  } catch (e) {}
}

/* Set `node`'s content to `text`, typesetting any $...$ / $$...$$ segments
   with KaTeX. Falls back to the raw source (delimiters included) until KaTeX
   has loaded, or if a segment doesn't parse as valid TeX. Plain text with no
   math is set via textContent exactly as before (cheap, common case). */
function setMathContent(node, text){
  text = text == null ? '' : String(text);
  const segs = splitMathSegments(text);
  if (segs.length === 1 && !segs[0].math){ node.textContent = text; delete node.dataset.mathRaw; return; }
  node.dataset.mathRaw = text;
  node.textContent = '';
  for (const seg of segs){
    if (!seg.math){ if (seg.text) node.appendChild(document.createTextNode(seg.text)); continue; }
    const span = el(seg.display ? 'div' : 'span', 'lf-math' + (seg.display ? ' lf-math-display' : ''));
    const src = (seg.display ? '$$' : '$') + seg.tex + (seg.display ? '$$' : '$');
    if (katexReady){
      try { katex.render(seg.tex, span, { throwOnError: false, displayMode: seg.display }); }
      catch (e) { span.textContent = src; }
    } else {
      span.textContent = src;
      ensureKatex().then(rerenderMath).catch(() => {});
    }
    node.appendChild(span);
  }
}

/* like el(), but typesets $...$ / $$...$$ math in `text` instead of setting
   it as plain textContent — for slide-authored content (headlines, points,
   callouts, …) so equations render smoothly */
function elMath(tag, cls, style, text){
  const n = el(tag, cls, style, null);
  setMathContent(n, text);
  return n;
}

/* ---------- best-effort LaTeX -> plain text, for PPTX export ---------- */

const MATH_GREEK = { alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', varepsilon:'ε',
  zeta:'ζ', eta:'η', theta:'θ', vartheta:'ϑ', iota:'ι', kappa:'κ', lambda:'λ', mu:'μ', nu:'ν',
  xi:'ξ', pi:'π', varpi:'ϖ', rho:'ρ', varrho:'ϱ', sigma:'σ', varsigma:'ς', tau:'τ',
  upsilon:'υ', phi:'φ', varphi:'φ', chi:'χ', psi:'ψ', omega:'ω',
  Alpha:'Α', Beta:'Β', Gamma:'Γ', Delta:'Δ', Epsilon:'Ε', Zeta:'Ζ', Eta:'Η', Theta:'Θ',
  Iota:'Ι', Kappa:'Κ', Lambda:'Λ', Mu:'Μ', Nu:'Ν', Xi:'Ξ', Pi:'Π', Rho:'Ρ', Sigma:'Σ',
  Tau:'Τ', Upsilon:'Υ', Phi:'Φ', Chi:'Χ', Psi:'Ψ', Omega:'Ω' };
const MATH_SYM = { times:'×', cdot:'·', div:'÷', pm:'±', mp:'∓', leq:'≤', le:'≤', geq:'≥', ge:'≥',
  neq:'≠', ne:'≠', approx:'≈', sim:'∼', simeq:'≃', equiv:'≡', propto:'∝', infty:'∞',
  partial:'∂', nabla:'∇', rightarrow:'→', to:'→', longrightarrow:'→', leftarrow:'←',
  leftrightarrow:'↔', Rightarrow:'⇒', Leftarrow:'⇐', sum:'Σ', prod:'Π', int:'∫', oint:'∮',
  forall:'∀', exists:'∃', in:'∈', notin:'∉', subset:'⊂', subseteq:'⊆', cup:'∪', cap:'∩',
  emptyset:'∅', varnothing:'∅', cdots:'⋯', ldots:'…', dots:'…', circ:'°', degree:'°',
  perp:'⊥', parallel:'∥', therefore:'∴', because:'∵', angle:'∠', prime:'′' };
const MATH_SUP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ' };
const MATH_SUB = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎','a':'ₐ','e':'ₑ','h':'ₕ','i':'ᵢ','j':'ⱼ','k':'ₖ',
  'l':'ₗ','m':'ₘ','n':'ₙ','o':'ₒ','p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','x':'ₓ' };

function texSupSub(content, map, prefix){
  const chars = [...content].map(c => map[c]);
  return chars.every(Boolean) ? chars.join('') : prefix + '(' + content + ')';
}

/* Best-effort LaTeX -> plain text for contexts that can't typeset math
   (PPTX export): handles \frac, \sqrt, Greek letters, common operators, and
   sub/superscripts via unicode where a matching character exists. */
function texToPlain(tex){
  let s = tex;
  s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a, b) => `(${texToPlain(a)})/(${texToPlain(b)})`);
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, a) => `√(${texToPlain(a)})`);
  s = s.replace(/\\(?:text|mathrm|mathbf|boldsymbol|mathit|operatorname)\s*\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\([a-zA-Z]+)/g, (m, name) => MATH_GREEK[name] || MATH_SYM[name] || name);
  s = s.replace(/\^\{([^{}]*)\}|\^(.)/g, (m, b, c) => texSupSub(b != null ? b : c, MATH_SUP, '^'));
  s = s.replace(/_\{([^{}]*)\}|_(.)/g, (m, b, c) => texSupSub(b != null ? b : c, MATH_SUB, '_'));
  s = s.replace(/[{}]/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

/* PPTX text boxes can't typeset TeX — flatten $...$ / $$...$$ segments to a
   readable plain-text approximation, leaving ordinary text untouched. */
function mathToPlainText(text){
  if (typeof text !== 'string' || !text.includes('$')) return text;
  return splitMathSegments(text).map(seg => seg.math ? texToPlain(seg.tex) : seg.text).join('');
}

/* true if any slide-authored text in the deck contains $...$ / $$...$$ math */
function deckHasMath(deck){
  const fields = [];
  for (const s of deck.slides){
    fields.push(s.headline, s.callout, s.notes);
    for (const a of (s.annotations || [])) fields.push(a.text, a.full);
    for (const t of (s.texts || [])) fields.push(t.text);
  }
  for (const o of (deck.overlays || [])) fields.push(o.text);
  return fields.some(f => typeof f === 'string' && splitMathSegments(f).some(seg => seg.math));
}

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

/* Resize an image to maxSide px on its longest side and re-encode.
   PNG inputs are scanned for transparency; if found they stay PNG (preserving
   cutout alpha); otherwise the output is JPEG at the given quality.
   Both significantly reduce storage size vs. the raw blob or canvas export. */
function shrinkImage(src, maxSide = 1200, quality = 0.84){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight, 1));
        const w = Math.max(1, Math.round(img.naturalWidth * ratio));
        const h = Math.max(1, Math.round(img.naturalHeight * ratio));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // Only PNG inputs can have transparency; scan alpha channel to decide format
        let hasAlpha = false;
        if (src.startsWith('data:image/png') || src.startsWith('data:image/webp')){
          const d = ctx.getImageData(0, 0, w, h).data;
          for (let i = 3; i < d.length; i += 4) if (d[i] < 250){ hasAlpha = true; break; }
        }
        resolve(hasAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', quality));
      } catch (e){ reject(e); }
    };
    img.onerror = () => reject(new Error('shrink: load failed'));
    img.src = src;
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

let settings = { unsplashKey:'', pexelsKey:'', pixabayKey:'', removebgKey:'', photoroomKey:'', anthropicKey:'', googleKey:'', googleCx:'', serperKey:'', bingKey:'', braveKey:'', driveClientId:'' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(LS.settings) || '{}')); } catch (e) {}

const state = {
  deck: null,        // current deck object
  cur: 0,            // current slide index
  sel: null,         // {kind:'img'|'ann', id}
  selMulti: [],      // sel strings forming a multi-selection (group), when length >= 2
};
let viewScale = 1;
let userZoom = 1;   // multiplicative zoom on top of fit-to-window scale
let panelSeedFor = null;
let textScale = 1;   // deck.textScale, applied to default (non-overridden) font sizes while rendering
let truncateMode = false;  // editor-only: chip labels render as clickable words for click-to-cut truncation

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
  if (!d.textScale) d.textScale = 1;
  return d;
}
function newDeck(){
  return { id: uid(), title:'', presenter:'', date:'', designNotes:'', accent:'indigo', slides:[], background:null, frame:false, motion:false, arrows:'none', textScale:1 };
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

let saveStatus = 'ok';   // 'pending' | 'ok' | 'failed'

function updateSaveBtn(){
  const btn = $('#btn-save');
  if (!btn) return;
  if (!state.deck){ btn.hidden = true; return; }
  btn.hidden = false;
  if (saveStatus === 'failed'){
    btn.textContent = '⚠ Save failed'; btn.title = 'Storage may be full — click to retry';
    btn.classList.add('save-failed'); btn.classList.remove('save-pending');
  } else if (saveStatus === 'pending'){
    btn.textContent = '● Saving…'; btn.title = 'Saving…';
    btn.classList.add('save-pending'); btn.classList.remove('save-failed');
  } else {
    btn.textContent = '✓ Saved'; btn.title = 'All changes saved';
    btn.classList.remove('save-pending', 'save-failed');
  }
}

async function saveDeckNow(){
  const d = state.deck;
  if (!d) return;
  try {
    await IDB.set(LS.deck(d.id), JSON.stringify(d));
    const all = deckIndex();
    const prev = all.find(e => e.id === d.id);
    const idx = all.filter(e => e.id !== d.id);
    idx.unshift({ id: d.id, title: d.title || 'Untitled deck', updated: Date.now(),
                  count: d.slides.length, folder: prev ? (prev.folder || null) : null,
                  starred: prev ? !!prev.starred : false });
    saveIndex(idx);
    localStorage.setItem(LS.current, d.id);
    saveStatus = 'ok';
    // auto-sync to Drive if already authenticated (silent, no popup)
    if (settings.driveClientId && _driveToken && Date.now() < _driveTokenExpiry) _driveAutoSave();
  } catch (e) {
    saveStatus = 'failed';
    toast('Could not save — please try exporting your deck');
  }
  updateSaveBtn();
}
const save = debounce(saveDeckNow, 400);

/* persist a brand-new deck (not the currently open one) to storage and the
   deck index — used by batch outline import, which creates several decks
   without switching the editor away from the home screen */
async function saveNewDeck(d, folder = null){
  await IDB.set(LS.deck(d.id), JSON.stringify(d));
  const idx = deckIndex();
  idx.unshift({ id: d.id, title: d.title || 'Untitled deck', updated: Date.now(),
                count: d.slides.length, folder });
  saveIndex(idx);
}

async function loadDeck(id){
  try {
    let raw = await IDB.get(LS.deck(id));
    // fall back to localStorage for decks saved before IDB migration
    if (!raw) raw = localStorage.getItem(LS.deck(id));
    return raw ? migrateDeck(JSON.parse(raw)) : null;
  } catch (e) { return null; }
}
async function deleteDeck(id){
  await IDB.del(LS.deck(id));
  localStorage.removeItem(LS.deck(id)); // remove legacy copy too
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

/* map a free-text LAYOUT: hint to a content-layout key (or null if unrecognized,
   in which case effContentLayout() picks the default) */
function normLayoutName(s){
  s = (s || '').toLowerCase().trim();
  if (/compar|versus|vs\b|two col|contrast/.test(s)) return 'comparison';
  if (/time|step|process|sequence|chronolog|stages?/.test(s)) return 'timeline';
  if (/quote|pull|epigraph/.test(s)) return 'quote';
  if (/statement|big idea|hero/.test(s)) return 'statement';
  if (/figure left/.test(s)) return 'figureLeft';
  if (/figure right/.test(s)) return 'figureRight';
  if (/galler|grid|multi.?image|figure grid/.test(s)) return 'figureGrid';
  if (/cinematic|full.?bleed|edge/.test(s)) return 'cinematic';
  if (/cards?/.test(s)) return 'cards';
  if (/spotlight/.test(s)) return 'spotlight';
  if (/band/.test(s)) return 'bandTop';
  if (/panel/.test(s)) return 'panels';
  const valid = LAYOUTS.content.map(l => l.key);
  return valid.includes(s) ? s : null;
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
    layout:   /^(?:layout|format)\s*[:\-]\s*(.+)$/i,
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
    if ((m = line.match(F.layout)))   { s.layout = normLayoutName(m[1]); mode = null; return true; }
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
      return { id: uid(), text: short, full: pt, orig: pt, x: null, y: null };
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

/* ================= deck → outline (export) ================= */

// reverse of normLayoutName: content-layout key -> LAYOUT: text that
// normLayoutName maps back to the same key, for round-tripping
const LAYOUT_TO_OUTLINE = {
  cinematic: 'cinematic', cards: 'cards', figureLeft: 'figure left', figureRight: 'figure right',
  spotlight: 'spotlight', bandTop: 'band', panels: 'panels', comparison: 'comparison',
  timeline: 'timeline', statement: 'statement', quote: 'quote', gallery: 'gallery', figureGrid: 'figure grid',
};

// drop the auto-generated "Point details:" block — it's regenerated from
// POINTS on re-parse, so exporting it too would duplicate it
function stripPointDetails(notes){
  return (notes || '').replace(/\n*Point details:\n(?:[•\-]\s.*(?:\n|$))*$/, '').trim();
}

// avoid lines parseOutline's slide-start regex would mistake for "N. <new slide>"
function safeNotesLine(line){
  return line.replace(/^(\d+)\s*([.):])\s*/, '$1 — ');
}

/* turn the current deck back into the plain-text outline format, for
   bulk-editing wording across many slides and rebuilding. Rebuilding from
   this text replaces the deck, so placed images and manual positions/sizes
   are not preserved — only headlines, points, callouts, figure/notes text,
   layout choices and deck-level title/presenter/date/design notes. */
function deckToOutline(deck){
  const out = [`# ${deck.title || 'Untitled deck'}`];
  if (deck.presenter) out.push(`Presenter: ${deck.presenter}`);
  if (deck.date) out.push(`Date: ${deck.date}`);
  if (deck.designNotes) out.push(`Design: ${deck.designNotes}`);
  out.push('');

  deck.slides.forEach((s, i) => {
    out.push(`${i + 1}. TYPE: ${s.type}`);
    if (s.headline) out.push(`   HEADLINE: ${s.headline}`);
    const lay = LAYOUT_TO_OUTLINE[s.layout];
    if (lay) out.push(`   LAYOUT: ${lay}`);
    if (s.annotations && s.annotations.length){
      out.push('   POINTS:');
      s.annotations.forEach(a => out.push(`   - ${(a.full && a.full.trim()) || a.text}`));
    }
    if (s.callout) out.push(`   CALLOUT: ${s.callout}`);
    if (s.figure) out.push(`   FIGURE: ${s.figure}`);
    const notes = stripPointDetails(s.notes);
    if (notes){
      const [first, ...rest] = notes.split('\n');
      out.push(`   NOTES: ${first}`);
      rest.forEach(line => out.push(`   ${safeNotesLine(line)}`));
    }
    out.push('');
  });

  return out.join('\n').trim() + '\n';
}

/* ================= outline-from-prose ================= */

/* single source of truth for the outline grammar: shown in the UI hint and
   sent to the AI engine, so the two never drift apart */
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
for one punchy claim. Math: write equations as LaTeX, inline with $...$ or on
their own as $$...$$ (e.g. "Population growth follows $\\frac{dN}{dt} = rN(1-N/K)$"
or its own POINT "$$p^2 + 2pq + q^2 = 1$$") — these render as typeset notation,
so define each symbol in the surrounding POINTS or NOTES. Output ONLY the
outline, no commentary or code fences.`;

/* deterministic, no-network draft: turns raw prose into a LectureFlow outline
   string, biased toward image-first annotated content slides but mixing in
   roadmap/section/takeaway structure and comparison/timeline/quote/statement
   layouts where the prose suggests them */
function proseToOutline(text){
  text = (text || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '# Untitled deck\n\n1. TYPE: title\n   HEADLINE: Untitled deck\n';

  const splitSentences = t => (t || '')
    .replace(/\s+/g, ' ').trim()
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map(s => s.trim()).filter(Boolean);
  const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());

  // ---- split into blocks: heading + following lines, or blank-line paragraphs
  const hasHeadings = /^#{1,6}\s+/m.test(text);
  let blocks = [];
  if (hasHeadings){
    let b = null;
    for (const line of text.split('\n')){
      const m = line.match(/^(#{1,6})\s+(.+)$/);
      if (m){
        if (b) blocks.push(b);
        b = { heading: m[2].trim(), level: m[1].length, lines: [] };
      } else if (b){
        b.lines.push(line);
      } else {
        b = { heading: null, level: 0, lines: [line] };
      }
    }
    if (b) blocks.push(b);
  } else {
    blocks = text.split(/\n\s*\n+/).map(t => t.trim()).filter(Boolean)
      .map(t => ({ heading: null, level: 0, lines: t.split('\n') }));
  }
  blocks = blocks.map(b => ({ ...b, text: b.lines.join(' ').replace(/\s+/g, ' ').trim() }))
    .filter(b => b.heading || b.text);

  // ---- title: first H1, else a short version of the opening sentence
  const h1 = blocks.find(b => b.heading && b.level === 1);
  let title;
  if (h1) title = h1.heading;
  else {
    const first = splitSentences(blocks[0] ? (blocks[0].heading || blocks[0].text) : '')[0];
    title = shortenPoint(first || 'Untitled deck');
  }
  const bodyBlocks = blocks.filter(b => b !== h1 || b.text);

  // ---- section dividers: the shallowest heading level, only if >1 level is used
  const levels = [...new Set(bodyBlocks.filter(b => b.heading).map(b => b.level))].sort((a, b) => a - b);
  const sectionLevel = levels.length > 1 ? levels[0] : null;

  const STAT       = /(\b\d[\d.,]*\s*%?)|\b(first|only|most|largest|smallest|fastest|oldest|never|always)\b|"[^"]{8,}"/i;
  const COMPARISON = /\bvs\.?\b|versus|compared with|on the other hand|whereas|unlike/i;
  const TIMELINE   = /\bfirst\b.*\bthen\b|\bfinally\b|\bstage\b|\bstep\b|\b1[89]\d\d\b|\b20\d\d\b/i;
  const TAKEAWAY   = /^(?:in (?:summary|conclusion)|overall|to sum up|key takeaway)/i;
  const QUOTE      = /^["“](.{8,})["”]\.?$/;

  // ---- one "unit" per block: a content/section slide's worth of material
  const units = [];
  for (const b of bodyBlocks){
    const sentences = splitSentences(b.text);
    const isSection = !!(b.heading && sectionLevel != null && b.level === sectionLevel);
    const headline = b.heading ? b.heading : titleCase(shortenPoint(sentences[0] || b.text || 'More'));
    const figure = keywordize(headline) || keywordize(title) || 'concept illustration';

    if (isSection){
      units.push({ type: 'section', headline, figure });
      continue;
    }

    const qm = sentences.length === 1 && sentences[0].match(QUOTE);
    if (qm){
      units.push({ type: 'content', headline: qm[1], points: [], callout: '', figure, layout: 'quote', takeaway: false });
      continue;
    }

    const isTakeaway = TAKEAWAY.test(b.text);
    let points = sentences.filter(s => s.split(/\s+/).length >= 3);

    let callout = '';
    let ci = points.findIndex(p => /\d/.test(p) && STAT.test(p));
    if (ci < 0) ci = points.findIndex(p => STAT.test(p));
    if (ci >= 0){ callout = points[ci]; points = points.filter((_, i) => i !== ci); }

    let layout = null;
    if (COMPARISON.test(b.text)) layout = 'comparison';
    else if (TIMELINE.test(b.text)) layout = 'timeline';
    else if (!b.heading && sentences.length === 1 && points.length <= 1) layout = 'statement';
    if (layout === 'statement') points = [];

    units.push({ type: isTakeaway ? 'takeaway' : 'content', headline, points, callout, figure, layout, takeaway: isTakeaway });
  }

  // ---- assemble slides: title, optional roadmap, then units (takeaways last,
  // long point lists split into "(cont.)" continuation slides)
  const takeawayUnits = units.filter(u => u.type === 'takeaway');
  const otherUnits = units.filter(u => u.type !== 'takeaway');

  const slides = [];
  for (const u of otherUnits){
    if (u.type === 'section'){ slides.push({ type: 'section', headline: u.headline, figure: u.figure }); continue; }
    if (!u.points.length){
      slides.push({ type: 'content', headline: u.headline, points: [], callout: u.callout, figure: u.figure, layout: u.layout });
      continue;
    }
    for (let i = 0; i < u.points.length; i += 5){
      slides.push({
        type: 'content',
        headline: i === 0 ? u.headline : u.headline + ' (cont.)',
        points: u.points.slice(i, i + 5),
        callout: i === 0 ? u.callout : '',
        figure: u.figure,
        layout: i === 0 ? u.layout : null,
      });
    }
  }
  for (const u of takeawayUnits){
    slides.push({ type: 'takeaway', headline: u.headline, points: u.points.slice(0, 4), callout: u.callout, figure: '' });
  }

  const contentHeadlines = slides.filter(s => s.type === 'content').map(s => s.headline);
  const out = [{ type: 'title', headline: title }];
  if (contentHeadlines.length >= 4){
    out.push({ type: 'roadmap', headline: "Today's journey", points: contentHeadlines.slice(0, 8) });
  }
  out.push(...slides);

  // ---- render
  const lines = [`# ${title}`, ''];
  out.forEach((sp, i) => {
    lines.push(`${i + 1}. TYPE: ${sp.type}`);
    if (sp.headline) lines.push(`   HEADLINE: ${sp.headline}`);
    if (sp.layout) lines.push(`   LAYOUT: ${sp.layout}`);
    if (sp.points && sp.points.length){
      lines.push('   POINTS:');
      for (const p of sp.points) lines.push(`   - ${p}`);
    }
    if (sp.callout) lines.push(`   CALLOUT: ${sp.callout}`);
    if (sp.figure) lines.push(`   FIGURE: ${sp.figure}`);
    lines.push('');
  });
  return lines.join('\n');
}

/* AI-assisted draft: same output shape as proseToOutline, via the Anthropic
   Messages API called directly from the browser */
async function proseToOutlineAI(text, { key, model } = {}){
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
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
  return out.replace(/^```[\w]*\n?|\n?```$/g, '');
}

/* ================= lecture "taste" (Phase 1) =================
   Two signals capture the user's taste: (1) how they reshape a generated
   outline into the final deck structure, and (2) how they arrange labels.
   Fingerprints are computed locally (no images sent); Claude only synthesizes. */

function wordsOf(s){ return (s || '').trim().split(/\s+/).filter(Boolean); }

/* structural shape of a deck — used both as the at-creation baseline and the
   final-state measurement, so the two can be diffed */
function structureFingerprint(deck){
  const t = { title:0, roadmap:0, section:0, content:0, takeaway:0 };
  const layouts = {};
  let sections = 0;
  for (const s of deck.slides){
    t[s.type] = (t[s.type] || 0) + 1;
    if (s.type === 'section') sections++;
    if (s.type === 'content'){
      const lay = effContentLayout(s) || 'annotated';
      layouts[lay] = (layouts[lay] || 0) + 1;
    }
  }
  return {
    slides: deck.slides.length, byType: t, sections,
    contentPerSection: sections ? +(t.content / sections).toFixed(2) : t.content,
    layouts, hasRoadmap: t.roadmap > 0,
    endsTakeaway: deck.slides.length > 0 && deck.slides[deck.slides.length - 1].type === 'takeaway',
  };
}

/* how labels are worded and arranged — the second taste pillar. Works on any
   deck (the baseline is trivially "all full text, auto-placed"). */
function labelFingerprint(deck){
  const content = deck.slides.filter(s => s.type === 'content');
  let slidesWithLabels = 0, totLabels = 0, truncated = 0, split = 0, manualPos = 0;
  const wordCounts = [], truncRatios = [], widths = [];
  const pos = { left:0, center:0, right:0 };
  for (const s of content){
    const anns = s.annotations || [];
    if (anns.length) slidesWithLabels++;
    for (const a of anns){
      totLabels++;
      const fullW = wordsOf(a.full || a.text || '').length;
      const origW = wordsOf(a.orig || a.full || a.text || '').length;
      wordCounts.push(fullW);
      if (origW > 0){ truncRatios.push(fullW / origW); if (fullW < origW) truncated++; }
      if (a.splitOf) split++;
      if (a.x != null || a.y != null) manualPos++;
      if (a.w != null) widths.push(a.w);
      if (a.x != null) pos[a.x < SLIDE_W * 0.38 ? 'left' : a.x > SLIDE_W * 0.62 ? 'right' : 'center']++;
    }
  }
  const avg = arr => arr.length ? +(arr.reduce((x, y) => x + y, 0) / arr.length).toFixed(2) : null;
  const pct = n => totLabels ? +(100 * n / totLabels).toFixed(0) : 0;
  return {
    contentSlides: content.length, slidesWithLabels, totalLabels: totLabels,
    avgLabelsPerLabeledSlide: slidesWithLabels ? +(totLabels / slidesWithLabels).toFixed(2) : 0,
    labelWordCount: { avg: avg(wordCounts), min: wordCounts.length ? Math.min(...wordCounts) : null,
                      max: wordCounts.length ? Math.max(...wordCounts) : null },
    avgTruncationRatio: avg(truncRatios),   // 1 = untouched, lower = trimmed harder
    pctTruncated: pct(truncated), pctSplit: pct(split), pctManualPositioned: pct(manualPos),
    positionBias: pos, avgChipWidth: avg(widths),
  };
}

/* the outline→deck structural delta, when a baseline was captured at creation */
function deckDelta(deck){
  if (!deck.origin || !deck.origin.fp) return null;
  const base = deck.origin.fp, cur = structureFingerprint(deck);
  const layoutChanges = {};
  new Set([...Object.keys(base.layouts || {}), ...Object.keys(cur.layouts || {})]).forEach(k => {
    const d = (cur.layouts[k] || 0) - (base.layouts[k] || 0); if (d) layoutChanges[k] = d;
  });
  return {
    baselineSlides: base.slides, finalSlides: cur.slides, slidesAdded: cur.slides - base.slides,
    contentPerSection: { from: base.contentPerSection, to: cur.contentPerSection },
    layoutChanges,
  };
}

function deckTasteSample(deck){
  return {
    title: deck.title || 'Untitled', accent: deck.accent,
    background: !!(deck.background && deck.background.src), motion: !!deck.motion,
    structure: structureFingerprint(deck),
    outlineToDeck: deckDelta(deck),     // null = no baseline recorded for this deck
    labels: labelFingerprint(deck),
  };
}

function loadTaste(){ try { return JSON.parse(localStorage.getItem(LS.taste) || 'null'); } catch (e){ return null; } }

/* thin wrapper over the Anthropic Messages API (same browser-direct pattern as
   proseToOutlineAI), used for taste synthesis */
async function anthropicMessage({ system, user, maxTokens = 1500, model }){
  const key = settings.anthropicKey;
  if (!key) throw new Error('Add your Anthropic API key in Settings');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key,
      'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: model || 'claude-sonnet-4-6', max_tokens: maxTokens,
      system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error('API ' + res.status + (res.status === 401 ? ' — check your key' : ''));
  const j = await res.json();
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

const TASTE_SYS = `You are building an evolving "lecture-design taste profile" for one teacher who builds image-first slide decks in an app called LectureFlow.

You receive compact JSON fingerprints of the decks they consider their best work. Two signals matter most:
1. outlineToDeck — how they transform a generated starting outline into the final deck structure (how many slides they add, how they split headings across slides, which content layouts they switch to). null means no baseline was recorded for that deck — rely on its final "structure" instead.
2. labels — how they word and arrange the annotation labels around figures: how many per slide, how hard they trim them (avgTruncationRatio: 1.0 = untouched, lower = trimmed harder; labelWordCount in words), how often they split a label into a follow-up, how often they hand-place them, and where they sit (positionBias).

Write a concise, concrete, REUSABLE taste profile the app can later use to make implementable suggestions. Prefer specific numbers and rules ("splits most headings into 2 slides", "trims labels to ~45% of source, ~4 words", "keeps 3–4 labels per slide, hand-placed left and right of the figure") over vague praise. Note consistent patterns AND flag where the decks disagree (low-confidence areas). If a PREVIOUS PROFILE is supplied, refine and update it rather than starting over. Output plain text with a few short bullet sections, under ~350 words.`;

async function analyzeTaste(){
  const starred = deckIndex().filter(e => e.starred);
  if (starred.length < 2){ toast('Star at least 2 finished decks first'); return null; }
  const samples = [];
  for (const e of starred){ const d = await loadDeck(e.id); if (d) samples.push(deckTasteSample(d)); }
  if (!samples.length){ toast('Could not load the starred decks'); return null; }
  const prev = loadTaste();
  const user = (prev && prev.profile ? 'PREVIOUS PROFILE (refine this):\n' + prev.profile + '\n\n' : '')
    + 'STARRED DECK FINGERPRINTS:\n' + JSON.stringify(samples, null, 1);
  const profile = await anthropicMessage({ system: TASTE_SYS, user, maxTokens: 1200 });
  const rec = { profile, decks: starred.map(e => e.id), at: Date.now(), count: samples.length };
  localStorage.setItem(LS.taste, JSON.stringify(rec));
  return rec;
}

function toggleStar(id){
  const idx = deckIndex();
  const e = idx.find(x => x.id === id);
  if (!e) return;
  e.starred = !e.starred;
  saveIndex(idx);
  renderHome();
  toast(e.starred ? 'Starred — this deck now shapes your taste profile' : 'Unstarred');
}

/* ================= layout geometry (shared by DOM renderer & PPTX export) ================= */

// text-length estimators below use the plain-text rendering of any $...$ /
// $$...$$ math (compact TeX source like "\frac{dN}{dt}" reads much shorter
// than it typesets) so layout stays close for equation-bearing slides
function estimateAnnH(text){
  const lines = Math.max(1, Math.ceil((mathToPlainText(text) || ' ').length / 23));
  return 10 + lines * 25;
}
// the full original point if there is one, else the (already short) text —
// used by the Annotated figure chips, which auto-size to show the whole point
function annDisplayText(a){
  return (a.full && a.full.trim()) ? a.full : a.text;
}
// height of a filled "chip" label box that fits its text at the given width/font-size
function chipBoxH(text, w, fs, padY){
  const charsPerLine = Math.max(4, Math.floor(w / (fs * 0.56)));
  const lines = Math.max(1, Math.ceil((mathToPlainText(text) || ' ').length / charsPerLine));
  return lines * fs * 1.42 + padY * 2;
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

/* Pick a headline font size (between minFs and maxFs) that keeps `text`
   on one line within width `w`, so titles don't wrap onto a second line.
   Shrinks smoothly from maxFs toward minFs as the text gets longer, using
   a rough average-character-width estimate for bold headline text. */
function fitHeadlineFS(text, w, maxFs, minFs){
  minFs = minFs || Math.round(maxFs * 0.6);
  const CHAR_W = 0.5; // average glyph width as a fraction of font size
  const len = (text || '').length || 1;
  const maxChars = w / (maxFs * CHAR_W);
  if (len <= maxChars) return maxFs;
  const minChars = w / (minFs * CHAR_W);
  if (len >= minChars) return minFs;
  const t = (len - maxChars) / (minChars - maxChars);
  return Math.round(maxFs - t * (maxFs - minFs));
}

/* Geometry for a content slide under its chosen layout. Consumed by both the
   DOM renderer and the PPTX exporter so every layout looks the same everywhere. */
function contentLayout(slide){
  const n = slide.annotations.length;
  const lay = effContentLayout(slide);
  const head = slide.headline || 'Slide headline';
  const out = { lay, annStyle: 'label', anns: [], headline: { x: 80, y: 64, w: 1120, fs: fitHeadlineFS(head, 1120, 38, 24) },
                callout: null, figZones: [{ ...FIGZONE }], wantFigure: true, connectors: false,
                bigQuote: false, annDetail: true };

  if (lay === 'cinematic'){
    // one photo runs edge-to-edge; headline + a few short points sit low-left over a scrim
    out.fullBleed = true; out.scrim = true;
    out.figZones = [{ x: 0, y: 0, w: 1280, h: 720 }];
    out.headline = { x: 80, y: 486, w: 980, fs: fitHeadlineFS(head, 980, 58, 36) };
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
    // filled "chip" labels stacked in two columns beside the figure, showing
    // each point's full text (sized to fit, no clipping); the slide's one big
    // takeaway — the CALLOUT if there is one, else the last point — becomes a
    // wide banner across the bottom instead of competing with the other chips.
    out.annStyle = 'label'; out.connectors = true; out.annDetail = false;
    out.headline = { x: 80, y: 64, w: 620, fs: fitHeadlineFS(head, 620, 38, 24) };
    const pts = slide.annotations;
    const bannerIdx = (!slide.callout && pts.length > 1) ? pts.length - 1 : -1;
    const chipPts = pts.filter((a, i) => i !== bannerIdx);
    const colTop = 216, colBottom = 596, gap = 20;
    // pick the largest chip font size whose two-column stack fits above the banner
    let fs = 22;
    for (; fs > 14; fs -= 2){
      const colY = [colTop, colTop];
      for (const a of chipPts){
        const col = colY[0] <= colY[1] ? 0 : 1;
        colY[col] += chipBoxH(annDisplayText(a), ANN_W, fs, 12) + gap;
      }
      if (Math.max(colY[0], colY[1]) - gap <= colBottom) break;
    }
    const colY = [colTop, colTop], colX = [64, 928];
    out.anns = pts.map((a, i) => {
      if (i === bannerIdx) return { x: 80, y: 596, w: 1120, fs: 24, banner: true };
      const col = colY[0] <= colY[1] ? 0 : 1;
      const pos = { x: colX[col], y: colY[col], w: ANN_W, fs };
      colY[col] += chipBoxH(annDisplayText(a), ANN_W, fs, 12) + gap;
      return pos;
    });
    if (slide.callout) out.callout = { x: 80, y: 596, w: 1120, fs: 24, banner: true };
  } else if (lay === 'cards'){
    // each point is its own bordered, draggable/resizable card around the figure
    out.annStyle = 'card'; out.connectors = true;
    out.headline = { x: 80, y: 64, w: 620, fs: fitHeadlineFS(head, 620, 38, 24) };
    out.anns = slide.annotations.map((a, i) => {
      const p = ANN_SLOTS[i % ANN_SLOTS.length], wrap = Math.floor(i / ANN_SLOTS.length) * 26;
      return { x: p.x + wrap, y: p.y + wrap, w: ANN_W, fs: 20 };
    });
    if (slide.callout) out.callout = { x: 80, y: 540, w: 380, fs: 18 };
  } else if (lay === 'figureLeft' || lay === 'figureRight'){
    const imgLeft = lay === 'figureLeft';
    out.figZones = [{ x: imgLeft ? 80 : 690, y: 168, w: 510, h: 472 }];
    const tx = imgLeft ? 700 : 80;
    out.headline = { x: tx, y: 70, w: 500, fs: fitHeadlineFS(head, 500, 33, 20) };
    out.annStyle = 'list';
    out.anns = listPositions(n, tx, 180, 500).map(r => ({ ...r, fs: 20 }));
    if (slide.callout) out.callout = { x: tx, y: 612, w: 500, fs: 17 };
  } else if (lay === 'spotlight'){
    out.figZones = [{ x: 80, y: 150, w: 620, h: 490 }];
    out.headline = { x: 742, y: 130, w: 458, fs: fitHeadlineFS(head, 458, 40, 24) };
    out.annStyle = 'list'; out.annDetail = false;
    out.anns = listPositions(Math.min(n, 3), 742, 270, 458, 18, slide.callout ? 540 : 640).map(r => ({ ...r, fs: 22 }));
    if (slide.callout) out.callout = { x: 742, y: 560, w: 458, fs: 18 };
  } else if (lay === 'bandTop'){
    out.figZones = [{ x: 80, y: 150, w: 1120, h: 286 }];
    out.headline = { x: 80, y: 56, w: 1120, fs: fitHeadlineFS(head, 1120, 33, 20) };
    out.annStyle = 'panel';
    const cols = Math.min(Math.max(n, 1), 4), gap = 18, w = (1120 - (cols - 1) * gap) / cols;
    out.anns = slide.annotations.map((a, i) => ({ x: 80 + (i % cols) * (w + gap),
      y: 460 + Math.floor(i / cols) * 160, w, h: 150 }));
  } else if (lay === 'comparison'){
    out.wantFigure = false; out.annStyle = 'panel';
    out.headline = { x: 80, y: 64, w: 1120, fs: fitHeadlineFS(head, 1120, 33, 20) };
    const half = Math.ceil(n / 2), gap = 20, w = 540;
    const rowsPer = Math.max(1, half), h = Math.min(150, (470 - (rowsPer - 1) * 14) / rowsPer);
    out.anns = slide.annotations.map((a, i) => {
      const col = i < half ? 0 : 1, row = i < half ? i : i - half;
      return { x: 80 + col * (w + gap), y: 168 + row * (h + 14), w, h };
    });
    if (slide.callout) out.callout = { x: 80, y: 650, w: 1120, fs: 16 };
  } else if (lay === 'timeline'){
    out.wantFigure = false; out.annStyle = 'step';
    out.headline = { x: 80, y: 60, w: 1120, fs: fitHeadlineFS(head, 1120, 33, 20) };
    out.timelineGeom = roadmapGeom(n);
  } else if (lay === 'statement'){
    out.wantFigure = false; out.annStyle = 'list'; out.annDetail = false;
    out.headline = { x: 96, y: 150, w: 760, fs: fitHeadlineFS(head, 760, 52, 32) };
    const bottom = slide.callout ? 568 : 632;
    out.anns = listPositions(Math.min(n, 4), 96, 332, 700, 14, bottom).map(r => ({ ...r, fs: 19 }));
    if (slide.callout) out.callout = { x: 96, y: 590, w: 1000, fs: 19 };
  } else if (lay === 'quote'){
    out.wantFigure = false; out.annStyle = 'none'; out.bigQuote = true;
    out.headline = { x: 150, y: 470, w: 980, fs: 22 };  // used as attribution line
  } else if (lay === 'gallery'){
    out.annStyle = 'none';
    out.headline = { x: 80, y: 52, w: 1120, fs: fitHeadlineFS(head, 1120, 32, 20) };
    out.galleryZones = galleryZones(Math.max(slide.images.length, 1));
    out.figZones = out.galleryZones;
  } else if (lay === 'figureGrid'){
    // a multi-figure "scene": several photos side by side, each with its own
    // caption label overlaid at the bottom — for comparing specimens, stages, etc.
    out.annStyle = 'caption';
    out.headline = { x: 80, y: 52, w: 1120, fs: fitHeadlineFS(head, 1120, 32, 20) };
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
  textScale = deck.textScale || 1;
  const pal = palette(deck);
  const dark = isDark(slide);
  const accLine = dark ? pal.accent : pal.accentInk;
  const bg = deck.background;
  const bgCls = (bg && bg.src) ? ' has-bg ' + (bg.dark ? 'bg-dark' : 'bg-light') : '';
  const cine = slide.type === 'content' && slide.images.length && effContentLayout(slide) === 'cinematic';
  const root = el('div', 'slide ' + (dark ? 'dark' : 'light') + bgCls + (cine ? ' cine' : '') + (deck.frame ? ' framed' : ''));
  root.dataset.type = slide.type;
  root.style.background = dark ? pal.darkBg : pal.lightBg;
  root.style.setProperty('--lf-accent', cine ? pal.accent : accLine);

  if (bg && bg.src){
    // no colour wash — let the blurred HD photo show; text gets a legibility halo (.has-bg) instead
    const img = el('img', 'lf-bg');
    img.src = bg.src; img.alt = '';
    const blurPx = (deck.bgSharpFirst && opts.index === 0) ? 0 : (bg.blur || 0);
    img.style.filter = `blur(${blurPx}px)`;
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
  const fs = o.fs != null ? o.fs : (def.fs != null ? def.fs * textScale : null);
  const node = el('div', 'lf-box', `position:absolute;left:${x}px;top:${y}px;width:${w}px;`
    + (fs != null ? `font-size:${fs}px;` : '') + `z-index:${def.z || 5};` + (css || '')
    + (o.align ? `text-align:${o.align};` : '')
    + (o.color ? `color:${o.color};` : '')
    + (o.bg ? `background-color:${o.bg};padding:6px 10px;border-radius:8px;` : ''));
  node.dataset.box = key;
  node.dataset.sel = 'box:' + key;
  if (content != null) setMathContent(node, content);
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
    { x: centered ? 140 : 96, y: 292, w: 1000, fs: fitHeadlineFS(txt, 1000, 74, 44), z: 5 },
    txt, `line-height:1.06;font-weight:600;${ta}`, opts)));
  if (deck.presenter || opts.editor){
    appendBox(root, mkBox(slide, 'presenter', { x: centered ? 140 : 96, y: 470, w: centered ? 1000 : 900, fs: 22, z: 5 },
      deck.presenter || 'Presenter name', `opacity:.78;${ta}`, { ...opts, editKey: 'presenter' }));
  }
}
function withSerif(node){ if (node) node.classList.add('serif'); return node; }
function appendBox(root, node){ if (node) root.appendChild(node); return node; }

function renderRoadmap(root, slide, deck, pal, dark, opts){
  const roadmapTxt = slide.headline || 'Roadmap';
  root.appendChild(editable(elMath('div', 'serif',
    `position:absolute;left:96px;top:64px;width:1000px;font-size:${fitHeadlineFS(roadmapTxt, 1000, 46, 30)}px;font-weight:600;z-index:5;`,
    roadmapTxt), 'headline', opts));
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
      ? elMath('div', '', `position:absolute;z-index:6;left:${st.cx - 100}px;top:${st.cy + 58}px;width:200px;
          text-align:center;font-size:18px;font-weight:600;line-height:1.3;${fade}`, a.text)
      : elMath('div', '', `position:absolute;z-index:6;left:${st.cx + 58}px;top:${st.cy - 16}px;width:900px;
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
  const sectionW = centered ? 1000 : 820;
  appendBox(root, withSerif(mkBox(slide, 'headline', { x: centered ? 140 : 96, y: 298, w: sectionW, fs: fitHeadlineFS(slide.headline || 'Section', sectionW, 62, 38), z: 5 },
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
  appendBox(root, withSerif(mkBox(slide, 'headline', { x: 150, y: 232, w: 980, fs: fitHeadlineFS(txt, 980, 54, 32), z: 5 },
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
      p.appendChild(editable(elMath('div', '', 'font-size:19px;font-weight:650;line-height:1.3;', a.text), 'ann:' + a.id, opts));
      if (a.full && a.full.trim() !== a.text.trim())
        p.appendChild(editable(elMath('div', '', 'font-size:13.5px;opacity:.72;margin-top:6px;line-height:1.4;', a.full), 'annfull:' + a.id, opts));
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
      // takeaway point (if any) gets the wide bottom-banner variant. Chips show
      // the full point (not the short label) since they auto-size to fit it.
      const extra = 'lf-chip' + (a.chip === 'light' ? ' lf-chip-light' : '') + (def.banner ? ' lf-takeaway-banner' : '');
      renderAnnBox(root, slide, a, i, def, opts, L.annDetail, 0, extra, true);
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
function renderAnnBox(root, slide, a, i, def, opts, showDetail = true, cardNum = 0, extraCls = '', useFull = false){
  const x = a.x != null ? a.x : def.x;
  const y = a.y != null ? a.y : def.y;
  const w = a.w != null ? a.w : def.w;
  const fs = a.fs != null ? a.fs : (def.fs || 19) * textScale;
  const cls = (cardNum ? 'lf-ann lf-anncard lf-box' : 'lf-ann lf-box') + (extraCls ? ' ' + extraCls : '');
  // Non-banner chips use fit-content+max-width via CSS by default.
  // When the user has explicitly dragged to a custom width (a.w != null), honour it with an inline width.
  const isAutoChip = extraCls.includes('lf-chip') && !extraCls.includes('lf-takeaway-banner');
  let widthStyle;
  if (isAutoChip){
    if (a.w != null){
      widthStyle = `width:${a.w}px;max-width:none;`;
    } else {
      // Aim for ~2 lines: set width to ~half the estimated single-line text width
      const dispLen = annDisplayText(a).length || 4;
      const autoW = Math.max(80, Math.min(300, Math.round(dispLen * fs * 0.28 + 16)));
      widthStyle = `width:${autoW}px;`;
    }
  } else {
    widthStyle = `width:${w}px;`;
  }
  const node = el('div', cls, `left:${x}px;top:${y}px;${widthStyle}font-size:${fs}px;`
    + (a.align ? `text-align:${a.align};` : '')
    + (a.color ? `color:${a.color};` : '')
    + (a.bg ? `background-color:${a.bg};` + (cardNum ? '' : 'padding:10px 14px;border-radius:10px;') : ''));
  node.dataset.id = a.id;
  node.dataset.sel = 'ann:' + a.id;
  if (cardNum) node.appendChild(el('div', 'lf-ann-num', '', String(cardNum)));
  // truncate mode: render the chip label as clickable words for click-to-cut
  if (opts && opts.editor && truncateMode && useFull && isAutoChip){
    node.appendChild(buildCutWords(a));
    root.appendChild(node);
    return;
  }
  const hasFull = a.full && a.full.trim() && a.full.trim() !== a.text.trim();
  const mainText = (useFull && hasFull) ? a.full : a.text;
  const mainKey = (useFull && hasFull) ? 'annfull:' + a.id : 'ann:' + a.id;
  node.appendChild(editable(elMath('div', 'lf-ann-text', '', mainText), mainKey, opts));
  if (showDetail && hasFull)
    node.appendChild(editable(elMath('div', 'lf-ann-full', '', a.full), 'annfull:' + a.id, opts));
  root.appendChild(node);
}

/* the pristine, recoverable original for a label — falls back to the current
   full text for decks created before truncation existed */
function annTruncSource(a){
  return (a.orig && a.orig.trim()) ? a.orig : (a.full || a.text || '');
}
/* which word indices of the original are currently shown — derived from a.full,
   where a gap (cut-out middle) is marked by an ellipsis between kept runs */
function annKeptSet(a, words){
  const full = (a.full || '').trim();
  const kept = new Set();
  if (!full) return kept;
  const segs = full.split(/\s*(?:…|\.\.\.)\s*/).map(s => s.trim()).filter(Boolean);
  let pos = 0;
  for (const seg of segs){
    const sw = seg.split(/\s+/).filter(Boolean);
    let found = -1;
    for (let i = pos; i + sw.length <= words.length; i++){
      let ok = true;
      for (let j = 0; j < sw.length; j++) if (words[i + j] !== sw[j]){ ok = false; break; }
      if (ok){ found = i; break; }
    }
    if (found < 0) continue;            // manual edit that no longer matches — skip
    for (let j = 0; j < sw.length; j++) kept.add(found + j);
    pos = found + sw.length;
  }
  if (!kept.size) for (let i = 0; i < words.length; i++) kept.add(i);  // unmatched → treat all as kept
  return kept;
}
/* rebuild the visible label from a set of kept word indices, marking each
   cut-out gap with an ellipsis */
function keptToFull(words, kept){
  const runs = [];
  let cur = null;
  for (let i = 0; i < words.length; i++){
    if (kept.has(i)){ if (!cur){ cur = []; runs.push(cur); } cur.push(words[i]); }
    else cur = null;
  }
  return runs.map(r => r.join(' ')).join(' … ');
}
function buildCutWords(a){
  const words = annTruncSource(a).split(/\s+/).filter(Boolean);
  const kept = annKeptSet(a, words);
  const wrap = el('div', 'lf-ann-text lf-cut-wrap');
  words.forEach((w, wi) => {
    const sp = el('span', 'lf-cut-word' + (kept.has(wi) ? '' : ' cut'), '', w);
    sp.dataset.cut = wi;
    wrap.appendChild(sp);
    if (wi < words.length - 1) wrap.appendChild(document.createTextNode(' '));
  });
  return wrap;
}
/* commit a new kept-word set as the visible label; the original is snapshotted
   to a.orig the first time so every cut stays reversible */
function applyAnnKept(slide, a, kept){
  const words = annTruncSource(a).split(/\s+/).filter(Boolean);
  if (!words.length) return;
  if (!kept.size) kept = new Set([0]);     // never let a label become empty
  if (!a.orig) a.orig = annTruncSource(a);
  checkpoint();
  a.full = keptToFull(words, kept);
  save();
  renderEditor();
}
/* click a word = clean prefix to there (or restore a cut word); drag across a
   span = cut it out (or restore it if already cut) */
function startWordDrag(e, slide, a, annNode, startIdx){
  const words = annTruncSource(a).split(/\s+/).filter(Boolean);
  const wordEls = Array.from(annNode.querySelectorAll('.lf-cut-word'));
  let curIdx = startIdx, dragged = false;
  const sx = e.clientX, sy = e.clientY;
  const idxAt = (x, y) => {
    const t = document.elementFromPoint(x, y);
    const w = t && t.closest && t.closest('.lf-cut-word');
    if (w && w.closest('[data-sel^="ann:"]') === annNode) return +w.dataset.cut;
    return curIdx;
  };
  const paint = () => {
    const lo = Math.min(startIdx, curIdx), hi = Math.max(startIdx, curIdx);
    wordEls.forEach((w, i) => w.classList.toggle('pending', i >= lo && i <= hi));
  };
  const move = ev => {
    if (!dragged && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
    dragged = true;
    curIdx = idxAt(ev.clientX, ev.clientY);
    paint();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const kept = annKeptSet(a, words);
    if (!dragged){
      if (kept.has(startIdx)){                       // click kept word → clean prefix
        const k2 = new Set(); for (let i = 0; i <= startIdx; i++) k2.add(i);
        applyAnnKept(slide, a, k2);
      } else {                                        // click cut word → restore it
        kept.add(startIdx); applyAnnKept(slide, a, kept);
      }
    } else {
      const lo = Math.min(startIdx, curIdx), hi = Math.max(startIdx, curIdx);
      let allKept = true;
      for (let i = lo; i <= hi; i++) if (!kept.has(i)){ allKept = false; break; }
      for (let i = lo; i <= hi; i++){ if (allKept) kept.delete(i); else kept.add(i); }
      applyAnnKept(slide, a, kept);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
/* promote the truncated-off tail into a new follow-up label, inserted right
   after this one so it reveals on the next click in present mode */
function splitAnnTail(slide, a){
  const words = annTruncSource(a).split(/\s+/).filter(Boolean);
  const kept = annKeptSet(a, words);
  let last = -1; kept.forEach(i => { if (i > last) last = i; });
  const tail = words.slice(last + 1);
  if (!tail.length) return;
  const tailText = tail.join(' ');
  const node = $(`#canvas [data-sel="ann:${a.id}"]`);
  checkpoint();
  const child = {
    id: uid(), text: shortenPoint(tailText), full: tailText, orig: tailText,
    x: a.x, y: a.y, w: a.w, fs: a.fs, align: a.align, color: a.color, bg: a.bg,
    chip: a.chip, splitOf: a.id,
  };
  if (node){
    // pin the parent where it currently sits so adding the child can't reflow it
    if (a.x == null) a.x = Math.round(node.offsetLeft);
    if (a.y == null) a.y = Math.round(node.offsetTop);
    child.x = Math.round(node.offsetLeft);
    child.y = Math.min(Math.round(node.offsetTop + node.offsetHeight + 10), SLIDE_H - 40);
  }
  a.orig = a.full;     // parent is now "complete" at its kept text
  const idx = slide.annotations.findIndex(x => x.id === a.id);
  slide.annotations.splice(idx + 1, 0, child);
  save();
  truncateMode = false;
  state.sel = 'ann:' + child.id;
  renderEditor();
  toast('Split into a follow-up label — it reveals right after this one in present mode');
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
      ? elMath('div', '', `position:absolute;z-index:6;left:${st.cx - 100}px;top:${st.cy + 54}px;width:200px;text-align:center;font-size:17px;font-weight:600;line-height:1.3;`, a.text)
      : elMath('div', '', `position:absolute;z-index:6;left:${st.cx + 54}px;top:${st.cy - 14}px;width:900px;font-size:20px;font-weight:600;line-height:1.3;`, a.text);
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
    const node = el('div', 'lf-img ' + (bleed ? 'bleed ' : '') + (im.cutout ? 'cut' : 'photo') + (im.border && !bleed ? ' bordered' : ''),
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
    setMathContent(node, t.text);
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
    setMathContent(node, o.text);
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
  const baseScale = Math.max(0.1, Math.min(availW / SLIDE_W, availH / SLIDE_H));
  viewScale = baseScale * userZoom;
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

  // truncate: available when a single annotation on a label-style layout is selected
  const isTrunc = !group && info && info.type === 'ann' && L2 && L2.annStyle === 'label';
  $('#sel-truncate').disabled = !isTrunc;
  $('#sel-truncate').classList.toggle('active', truncateMode);

  // split: available when a truncated label still has a hidden tail to promote
  let canSplit = false;
  if (isTrunc){
    const w = annTruncSource(info.obj).split(/\s+/).filter(Boolean);
    const k = annKeptSet(info.obj, w);
    let last = -1; k.forEach(i => { if (i > last) last = i; });
    canSplit = last < w.length - 1;
  }
  $('#sel-split').disabled = !canSplit;

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
  if (!sel && truncateMode){ truncateMode = false; state.sel = null; state.selMulti = []; renderEditor(); return; }
  state.sel = sel;
  state.selMulti = [];
  const root = $('#canvas .slide');
  if (root) applySelection(root);
}

function wireSlideEditing(root, slide){
  const pal = palette(state.deck);
  const accLine = isDark(slide) ? pal.accent : pal.accentInk;

  root.addEventListener('pointerdown', e => {
    // truncate mode: click a word = truncate tail there; drag across words = cut/restore that span
    if (truncateMode){
      const cw = e.target.closest('.lf-cut-word');
      if (cw){
        e.preventDefault(); e.stopPropagation();
        const annNode = cw.closest('[data-sel^="ann:"]');
        const a = annNode && slide.annotations.find(x => ('ann:' + x.id) === annNode.dataset.sel);
        if (a) startWordDrag(e, slide, a, annNode, +cw.dataset.cut);
        return;
      }
    }
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
    // under the cursor, so resolve the real element at this point first —
    // but fall back to e.target if that point lands in a gap between inline
    // text/math nodes (e.g. a tightly-fit single-line headline)
    const real = document.elementFromPoint(e.clientX, e.clientY) || e.target;
    const ed = real.closest('[data-edit]') || e.target.closest('[data-edit]');
    if (!ed) return;
    // a field showing typeset math displays rendered KaTeX markup, not the
    // $...$ source — swap back to the raw source so it's what gets edited
    if (ed.dataset.mathRaw != null) ed.textContent = ed.dataset.mathRaw;
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
    const val = ed.textContent.trim();
    applyEdit(slide, ed.dataset.edit, val);
    ed.contentEditable = 'false';
    setMathContent(ed, val);
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
      node.style.maxWidth = 'none'; // let user override CSS max-width on chips
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
  truncateMode = false;
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
  saveStatus = 'pending';
  updateSaveBtn();
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
  $('#tab-pdf').hidden = which !== 'pdf';
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
    async search(q, opts = {}){
      let url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20`;
      // bias toward PNGs/SVGs, which are the formats that can carry transparency
      if (opts.transparent) url += '&extension=png,svg';
      const j = await getJSON(url);
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
    async search(q, opts = {}){
      // PNG/SVG/GIF can carry an alpha channel; plain "bitmap" pulls in JPEGs too
      const filetype = opts.transparent ? 'filetype:png OR filetype:svg OR filetype:gif' : 'filetype:bitmap';
      const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
        + '&generator=search&gsrsearch=' + encodeURIComponent(filetype + ' ' + q)
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
    async search(q, opts = {}){
      // Unsplash serves photos only (no transparency), so steer the query
      // toward illustration-style results that are more likely to be cut out
      const term = opts.transparent ? `${q} transparent png` : q;
      const j = await getJSON(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&per_page=20&client_id=${settings.unsplashKey}`);
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
    async search(q, opts = {}){
      // Pexels has no transparency filter either; nudge the query the same way
      const term = opts.transparent ? `${q} transparent png` : q;
      const j = await getJSON(`https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=20`,
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
  google: {
    label: 'Google Images',
    ready: () => !!settings.googleKey && !!settings.googleCx,
    async search(q, opts = {}){
      // Custom Search API caps results at 10 per request (vs. 20 for the
      // other providers above)
      let url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(settings.googleKey)}`
        + `&cx=${encodeURIComponent(settings.googleCx)}&searchType=image&num=10&q=${encodeURIComponent(q)}`;
      if (opts.transparent) url += '&fileType=png';
      const j = await getJSON(url);
      return (j.items || []).map(r => ({
        provider:'google', id:'gg-' + r.link,
        thumb: (r.image && r.image.thumbnailLink) || r.link, full: r.link,
        title: r.title || '', author: r.displayLink || 'Unknown site',
        authorUrl: '', pageUrl: (r.image && r.image.contextLink) || '',
        // general web results — unlike the other providers, these aren't
        // pre-cleared for reuse, so flag that plainly in the attribution
        license: 'Unknown — verify rights before reuse', licenseUrl: '',
        sourceName: 'Google Images',
      }));
    },
  },
  serper: {
    label: 'Google Images (Serper)',
    ready: () => !!settings.serperKey,
    async search(q, opts = {}){
      const term = opts.transparent ? `${q} transparent png` : q;
      const j = await getJSON('https://google.serper.dev/images', {
        method: 'POST',
        headers: { 'X-API-KEY': settings.serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: term, num: opts.limit || 30 }),
      });
      return (j.images || []).map((r, i) => ({
        provider: 'serper', id: 'sp-' + i + '-' + (r.imageUrl || '').slice(-24),
        thumb: r.thumbnailUrl || r.imageUrl, full: r.imageUrl,
        title: r.title || '', author: r.source || r.domain || 'Unknown site',
        authorUrl: r.link || '', pageUrl: r.link || '',
        // raw web results — not pre-cleared for reuse like the open-license providers
        license: 'Unknown — verify rights before reuse', licenseUrl: '',
        sourceName: 'Google Images',
      }));
    },
  },
  bing: {
    label: 'Bing Images',
    ready: () => !!settings.bingKey,
    async search(q, opts = {}){
      const params = new URLSearchParams({
        q, count: opts.limit || 20,
        safeSearch: 'Moderate',
      });
      if (opts.transparent) params.set('imageType', 'Transparent');
      const j = await getJSON(
        `https://api.bing.microsoft.com/v7.0/images/search?${params}`,
        { headers: { 'Ocp-Apim-Subscription-Key': settings.bingKey } }
      );
      return (j.value || []).map(r => ({
        provider: 'bing', id: 'bing-' + encodeURIComponent(r.contentUrl).slice(0, 40),
        thumb: r.thumbnailUrl, full: r.contentUrl,
        title: r.name || '', author: r.hostPageDisplayUrl || '',
        authorUrl: r.hostPageUrl || '', pageUrl: r.hostPageUrl || '',
        license: (r.license && r.license.name) || 'Verify before reuse',
        licenseUrl: (r.license && r.license.url) || '',
        sourceName: 'Bing Images',
      }));
    },
  },
  pixabay: {
    label: 'Pixabay',
    ready: () => !!settings.pixabayKey,
    async search(q, opts = {}){
      let url = `https://pixabay.com/api/?key=${settings.pixabayKey}&q=${encodeURIComponent(q)}&per_page=20&safesearch=true&image_type=all`;
      if (opts.transparent) url += '&colors=transparent';
      const j = await getJSON(url);
      return (j.hits || []).map(r => ({
        provider: 'pixabay', id: 'pbx-' + r.id,
        thumb: r.webformatURL, full: r.largeImageURL || r.webformatURL,
        title: r.tags || '', author: r.user,
        authorUrl: `https://pixabay.com/users/${r.user}-${r.user_id}/`,
        pageUrl: r.pageURL, license: 'Pixabay License',
        licenseUrl: 'https://pixabay.com/service/license-summary/', sourceName: 'Pixabay',
      }));
    },
  },
  brave: {
    label: 'Brave Images',
    ready: () => !!settings.braveKey,
    async search(q, opts = {}){
      const params = new URLSearchParams({ q, count: opts.limit || 20, safesearch: 'moderate' });
      if (opts.transparent) params.set('image_type', 'transparent');
      const j = await getJSON(
        `https://api.search.brave.com/res/v1/images/search?${params}`,
        { headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': settings.braveKey } }
      );
      return (j.results || []).map(r => ({
        provider: 'brave', id: 'brave-' + encodeURIComponent(r.properties?.url || r.url || '').slice(0, 40),
        thumb: r.thumbnail?.src || '', full: r.properties?.url || r.thumbnail?.original || '',
        title: r.title || '', author: r.source || '',
        authorUrl: r.url || '', pageUrl: r.url || '',
        license: 'Unknown — verify rights before reuse', licenseUrl: '',
        sourceName: 'Brave Images',
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

/* fan out to the given (or every ready) provider for a query plus optional
   alternate terms, interleave + de-dupe the results. Shared by the side panel
   search and the batch "Fill figures" pass. */
async function fetchImages(query, { limit = 24, alts = [], provs, transparent = false } = {}){
  provs = provs || Object.keys(PROVIDERS).filter(k => PROVIDERS[k].ready());
  const queries = [query, ...alts].filter(Boolean);
  const perTerm = await Promise.all(queries.map(async term => {
    const settled = await Promise.allSettled(provs.map(p => PROVIDERS[p].search(term, { transparent })));
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
  const transparent = $('#ip-transparent').checked;
  const { results: merged, failed: failedProvs } = await fetchImages(q, { limit: auto ? 15 : 48, alts: altTerms, provs, transparent });
  if (token !== searchToken) return;

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

function resultCell(r, imEl, onInsert){
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
  cell.addEventListener('click', () => (onInsert || insertImageFromResult)(r));
  cell.draggable = true;
  cell.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/lf-image', JSON.stringify(r));
    e.dataTransfer.effectAllowed = 'copy';
  });
  return cell;
}

/* ---------- "your images" (drag-and-drop / browse from computer) ----------
   session-only — never written to localStorage; once an image is inserted
   onto a slide it's embedded as a data-URL on that slide like any other. */
let localImages = [];

async function addLocalFiles(files){
  const imgFiles = [...files].filter(f => f.type.startsWith('image/'));
  if (!imgFiles.length) return;
  for (const f of imgFiles){
    try {
      const src = await blobToDataURL(f);
      localImages.unshift({
        provider: 'local', id: 'local-' + uid(),
        thumb: src, full: src,
        title: f.name, author: '', authorUrl: '', license: '', licenseUrl: '', pageUrl: '',
        sourceName: 'Your device',
      });
    } catch (e) { /* unreadable file — skip */ }
  }
  renderLocalImages();
  toast(`${imgFiles.length} image${imgFiles.length === 1 ? '' : 's'} added — click or drag onto the slide`);
}

function removeLocalImage(id){
  localImages = localImages.filter(r => r.id !== id);
  renderLocalImages();
}

function renderLocalImages(){
  const grid = $('#ip-local-results');
  if (!grid) return;
  grid.innerHTML = '';
  grid.hidden = !localImages.length;
  localImages.forEach(r => grid.appendChild(localResultCell(r)));
}

function localResultCell(r){
  const cell = el('div', 'ip-cell');
  cell.title = `${r.title}\nClick to insert · drag onto the slide`;
  const imEl = new Image();
  imEl.src = r.thumb;
  imEl.alt = r.title || '';
  const wrap = el('div', 'ip-imgwrap');
  wrap.appendChild(imEl);
  cell.appendChild(wrap);
  cell.appendChild(el('span', 'ip-src', '', 'Your image'));
  cell.appendChild(el('span', 'ip-add', '', '＋ Insert'));
  const meta = el('div', 'ip-meta');
  meta.appendChild(document.createTextNode(r.title || 'Untitled'));
  const rm = el('span', 'ip-local-rm', '', '✕ remove');
  rm.addEventListener('click', e => { e.stopPropagation(); removeLocalImage(r.id); });
  meta.appendChild(rm);
  cell.appendChild(meta);
  cell.addEventListener('click', () => insertImageFromResult(r));
  cell.draggable = true;
  cell.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/lf-image', JSON.stringify(r));
    e.dataTransfer.effectAllowed = 'copy';
  });
  return cell;
}

/* ---------- PDF readings: upload a PDF, extract figures (auto or manual crop) ----------
   session-only — the PDF itself is never written to localStorage; once a figure is
   inserted onto a slide it's embedded as a data-URL like any other image. */
let pdfState = null; // { doc, file, numPages, pageNum, page, viewport, figures, cropMode }

let pdfjsReady = false, pdfjsLoading = null;
function ensurePdfJs(){
  if (pdfjsReady) return Promise.resolve();
  if (!pdfjsLoading){
    pdfjsLoading = loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js')
      .then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        pdfjsReady = true;
      });
  }
  return pdfjsLoading;
}

function pdfStatus(msg, isErr){
  const st = $('#pdf-status');
  if (!msg){ st.hidden = true; return; }
  st.hidden = false;
  st.textContent = msg;
  st.classList.toggle('err', !!isErr);
}

async function loadPdfFile(file){
  if (!file || file.type !== 'application/pdf'){ pdfStatus('That file is not a PDF', true); return; }
  pdfStatus('Loading PDF…');
  try {
    await ensurePdfJs();
    const buf = await file.arrayBuffer();
    const doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
    pdfState = { doc, file, numPages: doc.numPages, pageNum: 1, page: null, viewport: null, figures: [], cropMode: false, highResCanvas: null };
    $('#pdf-doc-name').textContent = `${file.name} · ${doc.numPages} page${doc.numPages === 1 ? '' : 's'}`;
    $('#pdf-doc').hidden = false;
    setCropMode(false);
    renderPdfFigures();
    pdfStatus('');
    await renderPdfPage();
  } catch (e) {
    pdfState = null;
    $('#pdf-doc').hidden = true;
    pdfStatus('Could not read that PDF (' + e.message + ')', true);
  }
}

function clearPdf(){
  pdfState = null;
  $('#pdf-doc').hidden = true;
  $('#pdf-upload').value = '';
  pdfStatus('');
  renderPdfFigures();
}

async function renderPdfPage(){
  if (!pdfState) return;
  const page = await pdfState.doc.getPage(pdfState.pageNum);
  const viewport = page.getViewport({ scale: 1.4 });
  pdfState.page = page;
  pdfState.viewport = viewport;
  const canvas = $('#pdf-page-canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  $('#pdf-page-indicator').textContent = `Page ${pdfState.pageNum} / ${pdfState.numPages}`;
  $('#pdf-prev').disabled = pdfState.pageNum <= 1;
  $('#pdf-next').disabled = pdfState.pageNum >= pdfState.numPages;
}

async function gotoPdfPage(delta){
  if (!pdfState) return;
  const n = clamp(pdfState.pageNum + delta, 1, pdfState.numPages);
  if (n === pdfState.pageNum) return;
  pdfState.pageNum = n;
  pdfState.highResCanvas = null;
  setCropMode(false);
  await renderPdfPage();
}

function setCropMode(on){
  if (!pdfState) on = false;
  if (pdfState) pdfState.cropMode = on;
  $('#pdf-crop-mode').classList.toggle('primary', on);
  $('#pdf-page-wrap').classList.toggle('crop-mode', on);
  $('#pdf-crop-box').hidden = true;
}

/* matrix helpers for tracking the content-stream transform (CTM) while scanning
   a page's operator list, so an image XObject's unit-square footprint can be
   mapped onto the rendered page canvas */
function mat2mul(m1, m2){
  return [
    m1[0]*m2[0] + m1[1]*m2[2],
    m1[0]*m2[1] + m1[1]*m2[3],
    m1[2]*m2[0] + m1[3]*m2[2],
    m1[2]*m2[1] + m1[3]*m2[3],
    m1[4]*m2[0] + m1[5]*m2[2] + m2[4],
    m1[4]*m2[1] + m1[5]*m2[3] + m2[5],
  ];
}
function mat2apply(m, x, y){
  return [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];
}

/* find the on-canvas bounding boxes of every image XObject painted on a page,
   by replaying its operator list and tracking the transform stack */
function findImageBoxes(opList, viewport){
  const OPS = window.pdfjsLib.OPS;
  const boxes = [];
  let ctm = viewport.transform.slice();
  const stack = [];
  for (let i = 0; i < opList.fnArray.length; i++){
    const fn = opList.fnArray[i], args = opList.argsArray[i];
    switch (fn){
      case OPS.save: stack.push(ctm.slice()); break;
      case OPS.restore: ctm = stack.pop() || ctm; break;
      case OPS.transform: ctm = mat2mul(args, ctm); break;
      case OPS.paintImageXObject:
      case OPS.paintImageMaskXObject:
      case OPS.paintInlineImageXObject: {
        const pts = [[0,0],[1,0],[0,1],[1,1]].map(([x,y]) => mat2apply(ctm, x, y));
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        boxes.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
        break;
      }
    }
  }
  return boxes;
}

/* crop a region of a rendered page canvas into a standalone figure, capping its
   resolution so the resulting data URL stays a reasonable size */
function cropCanvasRegion(srcCanvas, box, pageNum, maxDim = 1600){
  const x = Math.max(0, Math.round(box.x)), y = Math.max(0, Math.round(box.y));
  const w = Math.min(srcCanvas.width - x, Math.round(box.w));
  const h = Math.min(srcCanvas.height - y, Math.round(box.h));
  if (w < 24 || h < 24) return null;
  const sc = maxDim > 0 ? Math.min(1, maxDim / Math.max(w, h)) : 1;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * sc));
  cv.height = Math.max(1, Math.round(h * sc));
  cv.getContext('2d').drawImage(srcCanvas, x, y, w, h, 0, 0, cv.width, cv.height);
  return { id: 'pdffig-' + uid(), src: cv.toDataURL('image/png'), title: `Page ${pageNum} figure`,
           page: pageNum, w: cv.width, h: cv.height, cutout: false, cutSrc: null };
}

async function autoExtractFigures(allPages){
  if (!pdfState) return;
  await ensurePdfJs();
  const pages = allPages ? Array.from({ length: pdfState.numPages }, (_, i) => i + 1) : [pdfState.pageNum];
  pdfStatus('Scanning for figures…');
  let found = 0;
  for (const pageNum of pages){
    const page = pageNum === pdfState.pageNum && pdfState.page ? pdfState.page : await pdfState.doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const cv = document.createElement('canvas');
    cv.width = Math.round(viewport.width); cv.height = Math.round(viewport.height);
    await page.render({ canvasContext: cv.getContext('2d'), viewport }).promise;
    const opList = await page.getOperatorList();
    for (const box of findImageBoxes(opList, viewport)){
      const fig = cropCanvasRegion(cv, box, pageNum);
      if (fig){ pdfState.figures.push(fig); found++; }
    }
  }
  renderPdfFigures();
  pdfStatus(found ? `Found ${found} figure${found === 1 ? '' : 's'}`
    : `No embedded images found on ${allPages ? 'this PDF' : 'this page'} — try "Crop a region" to select one yourself.`, !found);
}

/* ---------- manual crop: drag a rectangle over the rendered page ---------- */
function pdfCropPointerDown(e){
  if (!pdfState || !pdfState.cropMode) return;
  const canvas = $('#pdf-page-canvas');
  const wrap = $('#pdf-page-wrap');
  const rect = canvas.getBoundingClientRect();
  const start = { x: clamp(e.clientX - rect.left, 0, canvas.clientWidth), y: clamp(e.clientY - rect.top, 0, canvas.clientHeight) };
  const box = $('#pdf-crop-box');
  box.hidden = false;
  const update = (x, y) => {
    const cx = clamp(x - rect.left, 0, canvas.clientWidth), cy = clamp(y - rect.top, 0, canvas.clientHeight);
    const left = Math.min(start.x, cx), top = Math.min(start.y, cy);
    box.style.left = (left + canvas.offsetLeft) + 'px';
    box.style.top = (top + canvas.offsetTop) + 'px';
    box.style.width = Math.abs(cx - start.x) + 'px';
    box.style.height = Math.abs(cy - start.y) + 'px';
    return { left, top, w: Math.abs(cx - start.x), h: Math.abs(cy - start.y) };
  };
  update(e.clientX, e.clientY);
  const onMove = ev => update(ev.clientX, ev.clientY);
  const onUp = async ev => {
    wrap.removeEventListener('pointermove', onMove);
    wrap.removeEventListener('pointerup', onUp);
    const { left, top, w, h } = update(ev.clientX, ev.clientY);
    box.hidden = true;
    if (w < 8 || h < 8) return;
    // crop from the high-res canvas if available (scale 3), otherwise fall back to display canvas
    const src = pdfState.highResCanvas || canvas;
    const sx = src.width / canvas.clientWidth, sy = src.height / canvas.clientHeight;
    const fig = cropCanvasRegion(src, { x: left * sx, y: top * sy, w: w * sx, h: h * sy }, pdfState.pageNum, 0);
    if (!fig) return;
    pdfState.figures.push(fig);
    setCropMode(false);
    renderPdfFigures();
    if ($('#pdf-auto-cutout').checked){
      pdfStatus('Removing background…');
      await togglePdfFigureCutout(fig);
    }
    if ($('#pdf-auto-insert').checked){
      insertPdfFigure(fig);
    } else {
      pdfStatus('Figure added — click "Insert onto slide" below.');
      document.querySelector('#pdf-figures').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerup', onUp);
}

function renderPdfFigures(){
  const grid = $('#pdf-figures');
  grid.innerHTML = '';
  const figs = pdfState ? pdfState.figures : [];
  figs.forEach(fig => grid.appendChild(pdfFigureCell(fig)));
}

function pdfFigureToResult(fig){
  const src = (fig.cutout && fig.cutSrc) ? fig.cutSrc : fig.src;
  return { provider: 'local', id: fig.id, thumb: src, full: src, title: fig.title,
           author: '', authorUrl: '', license: '', licenseUrl: '', pageUrl: '', sourceName: 'PDF reading' };
}

function insertPdfFigure(fig){ insertImageFromResult(pdfFigureToResult(fig)); }

function removePdfFigure(id){
  if (!pdfState) return;
  pdfState.figures = pdfState.figures.filter(f => f.id !== id);
  renderPdfFigures();
}

async function togglePdfFigureCutout(fig){
  if (fig.cutout){ fig.cutout = false; renderPdfFigures(); return; }
  if (fig.cutSrc){ fig.cutout = true; renderPdfFigures(); return; }
  toast('Removing background…', 4000);
  try {
    fig.cutSrc = await cutoutWhiteBg(fig.src);
    fig.cutout = true;
    toast('Background removed');
  } catch (e) {
    toast('Could not remove the background for this figure');
  }
  renderPdfFigures();
}

function pdfFigureCell(fig){
  const cell = el('div', 'ip-cell');
  cell.title = `Page ${fig.page} figure — click "Insert" to add to the slide`;
  const imEl = new Image();
  imEl.src = (fig.cutout && fig.cutSrc) ? fig.cutSrc : fig.src;
  imEl.alt = fig.title;
  const wrap = el('div', 'ip-imgwrap');
  wrap.appendChild(imEl);
  cell.appendChild(wrap);
  cell.appendChild(el('span', 'ip-src', '', `Page ${fig.page}`));
  const meta = el('div', 'ip-meta');
  const insBtn = el('button', 'pdf-fig-insert btn small primary', '', '＋ Insert onto slide');
  insBtn.addEventListener('click', e => { e.stopPropagation(); insertPdfFigure(fig); });
  meta.appendChild(insBtn);
  const cut = el('span', 'pdf-fig-cut', '', fig.cutout ? '↺ original' : '✂ cutout');
  cut.addEventListener('click', e => { e.stopPropagation(); togglePdfFigureCutout(fig); });
  meta.appendChild(cut);
  const rm = el('span', 'ip-local-rm', '', '✕');
  rm.title = 'Remove from list';
  rm.addEventListener('click', e => { e.stopPropagation(); removePdfFigure(fig.id); });
  meta.appendChild(rm);
  cell.appendChild(meta);
  cell.draggable = true;
  cell.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/lf-image', JSON.stringify(pdfFigureToResult(fig)));
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
  $('#bg-sharp-first').checked = !!(state.deck && state.deck.bgSharpFirst);
  $('#bg-motion').checked = !!(state.deck && state.deck.motion);
  $('#bg-arrows').value = (state.deck && state.deck.arrows) || 'none';
  const textScaleVal = (state.deck && state.deck.textScale) || 1;
  $('#bg-textscale').value = textScaleVal;
  $('#bg-textscale-val').textContent = Math.round(textScaleVal * 100) + '%';
}

function fitRect(natW, natH, zone){
  const sc = Math.min(zone.w / natW, zone.h / natH);
  const w = Math.round(natW * sc), h = Math.round(natH * sc);
  return { x: Math.round(zone.x + (zone.w - w) / 2), y: Math.round(zone.y + (zone.h - h) / 2), w, h };
}

/* load + place + embed a search result onto a specific slide, as a
   self-contained data-URL. Returns the image object, or null if the image
   couldn't be loaded. No toasts, checkpoints, or rendering — callers handle UI. */
async function placeResultOnSlide(slide, r, at){
  let src = r.full, dim;
  try { dim = await loadImageDim(src); }
  catch (e) {
    try { src = r.thumb; dim = await loadImageDim(src); }
    catch (e2) { return null; }
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
    place = defaultImagePlacement(slide, dim.w, dim.h);
  }
  Object.assign(im, place);
  slide.images.push(im);

  // Unsplash API guidelines: report the download
  if (r.provider === 'unsplash' && r.downloadLocation && settings.unsplashKey){
    fetch(r.downloadLocation, { headers: { Authorization: 'Client-ID ' + settings.unsplashKey } }).catch(() => {});
  }
  await embedImage(im);
  return im;
}

async function insertImageFromResult(r, at){
  const s = cur();
  if (!s){ toast('Open a deck first'); return; }
  checkpoint();
  toast('Inserting image…', 6000);
  const im = await placeResultOnSlide(s, r, at);
  if (!im){ toast('That image failed to load — skipped'); return; }
  im.border = $('#ip-border').checked;
  refreshAll();
  toast('Image inserted' + (im.attr.author ? ` — ${im.attr.author} / ${im.attr.sourceName}` : ''));
  if ($('#ip-cutout').checked) await applyCutout(im);
  if (cur() === s) renderEditor();
  refreshRailThumb(state.deck.slides.indexOf(s));
  save();
}

/* ================= batch "Fill figures" pass ================= */

function figureWorklist(){
  return state.deck.slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.images.length && (s.figure || s.headline));
}
function slideSeed(s){ return splitFigureTerms(s.figure || s.headline || ''); }

let fillList = [], fillPos = 0;

function openFillFigures(){
  if (!state.deck) return;
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

let fillToken = 0;
async function fillSearch(alts = []){
  const grid = $('#fill-grid'); grid.innerHTML = '';
  fillStatus('Searching…');
  const token = ++fillToken;
  const q = $('#fill-query').value.trim();
  if (!q){ fillStatus('Type a search term, or Skip this slide.'); return; }
  const { results, failed } = await fetchImages(q, { limit: 9, alts });
  if (token !== fillToken) return;
  if (!results.length){
    fillStatus('No results.' + (failed.length ? ` (${failed.join(', ')} failed)` : '') + ' Try refining the search, or Skip.');
    return;
  }
  const { shown, skipped } = await loadResultCells(grid, results, fillCell,
    n => fillStatus(`${n} image${n === 1 ? '' : 's'}…`), () => token !== fillToken);
  if (token !== fillToken) return;
  fillStatus(`${shown} image${shown === 1 ? '' : 's'}${skipped ? ` · ${skipped} broken skipped` : ''}`);
}
function fillStatus(msg, isErr){
  const st = $('#fill-status');
  if (!msg){ st.hidden = true; return; }
  st.hidden = false;
  st.textContent = msg;
  st.classList.toggle('err', !!isErr);
}
function proseStatus(msg, isErr){
  const st = $('#prose-status');
  if (!msg){ st.hidden = true; return; }
  st.hidden = false;
  st.textContent = msg;
  st.classList.toggle('err', !!isErr);
}
function fillCell(r, imEl){
  return resultCell(r, imEl, () => fillAccept(r));
}
async function fillAccept(r){
  const { s, i } = fillList[fillPos];
  checkpoint();
  const im = await placeResultOnSlide(s, r);
  if (!im){ toast('That image failed to load — try another'); return; }
  refreshRailThumb(i); save();
  fillPos++; fillShow();
}
function fillSkip(){ fillPos++; fillShow(); }
function fillBack(){ if (fillPos > 0){ fillPos--; fillShow(); } }
function closeFill(){
  fillCancelled = true;
  $('#fill-modal').close();
  refreshAll();
}

/* one-click rough draft: top working hit on every remaining slide */
let fillCancelled = false;
async function fillAuto(){
  $('#fill-auto').disabled = true;
  fillCancelled = false;
  checkpoint();
  try {
    for (; fillPos < fillList.length; fillPos++){
      if (fillCancelled) return;
      const { s, i } = fillList[fillPos];
      $('#fill-progress').textContent = `Auto-filling ${fillPos + 1} of ${fillList.length}…`;
      const seed = slideSeed(s);
      const { results } = await fetchImages(seed.primary, { limit: 6, alts: seed.alternates });
      if (fillCancelled) return;
      for (const r of results){
        const im = await placeResultOnSlide(s, r);
        if (im){ refreshRailThumb(i); break; }
      }
    }
    if (fillCancelled) return;
    save();
    closeFill();
    toast('Rough draft filled — review and swap any you don’t like');
  } finally {
    $('#fill-auto').disabled = false;
  }
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
  if (im.src.startsWith('data:')){
    // Already embedded — compress it so it doesn't blow the storage quota
    try { im.src = await shrinkImage(im.src); } catch (e) {}
    return;
  }
  try {
    const res = await fetch(im.src);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    if (blob.size > 20 * 1024 * 1024) return;  // absurdly large — keep URL
    const raw = await blobToDataURL(blob);
    try { im.src = await shrinkImage(raw); }
    catch (e) { im.src = raw; }
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
    const raw = await cutoutBestAvailable(im);
    try { im.cutSrc = await shrinkImage(raw, 1200, 0.88); } catch (e) { im.cutSrc = raw; }
    im.cutout = true;
    toast('Background removed');
  } catch (e) {
    const crossOrigin = !im.src.startsWith('data:');
    toast(crossOrigin
      ? 'Could not remove the background (image is cross-origin — insert it onto the slide first to embed it)'
      : 'The built-in remover works best for solid/white backgrounds — add a remove.bg or PhotoRoom API key for photos');
  }
}

/* try each configured background-removal service in order, falling back to
   the next if one fails (e.g. monthly limit hit), then to the free in-browser ML model */
async function cutoutBestAvailable(im){
  if (settings.removebgKey){
    try { return await cutoutRemoveBg(im); } catch (e) { /* try next */ }
  }
  if (settings.photoroomKey){
    try { return await cutoutPhotoRoom(im); } catch (e) { /* try next */ }
  }
  return await cutoutImgly(im);
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

async function cutoutPhotoRoom(im){
  let blob;
  if (im.src.startsWith('data:')){
    blob = await (await fetch(im.src)).blob();
  } else {
    const res = await fetch(im.src);
    if (!res.ok) throw new Error('Could not fetch image for PhotoRoom');
    blob = await res.blob();
  }
  const fd = new FormData();
  fd.append('image_file', blob, 'image.png');
  const res = await fetch('https://sdk.photoroom.com/v1/segment', {
    method: 'POST', headers: { 'x-api-key': settings.photoroomKey }, body: fd,
  });
  if (!res.ok) throw new Error('PhotoRoom HTTP ' + res.status);
  return blobToDataURL(await res.blob());
}

let _imglyMod = null;
async function cutoutImgly(im){
  if (!_imglyMod){
    _imglyMod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal/dist/index.browser.js');
  }
  const publicPath = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal/dist/';
  let input;
  if (im.src.startsWith('data:')){
    input = await (await fetch(im.src)).blob();
  } else {
    input = im.src;
  }
  const blob = await _imglyMod.removeBackground(input, { publicPath });
  return blobToDataURL(blob);
}

/* fast white-background remover for PDF figures.
   Unlike the region-grower below, this works per-pixel: any pixel that is
   near-white with low saturation becomes transparent, with a short feather
   band for smooth edges. Perfect for textbook/paper pages where the background
   is reliably white and uses no API credits. */
function cutoutWhiteBg(src, thresh = 238){
  return new Promise((resolve, reject) => {
    const img = new Image();
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
        const feather = 22;
        for (let i = 0; i < d.length; i += 4){
          const r = d[i], g = d[i+1], b = d[i+2];
          const mn = Math.min(r, g, b), sat = Math.max(r, g, b) - mn;
          if (mn >= thresh && sat < 22){
            d[i+3] = 0;
          } else if (mn >= thresh - feather && sat < 28){
            d[i+3] = Math.round(d[i+3] * (thresh - mn) / feather);
          }
        }
        ctx.putImageData(id, 0, 0);
        resolve(cv.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
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

        // sanity-check: if >80% of pixels were marked background the fill
        // has leaked into the subject — reject instead of returning garbage
        let bgCount = 0;
        for (let i = 0; i < state.length; i++) bgCount += state[i];
        if (bgCount > w * h * 0.80) throw new Error('fill leaked — background too complex for built-in remover');

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
  // pre-typeset any $...$ / $$...$$ math so the export captures static KaTeX
  // markup; the exported page just needs KaTeX's CSS (+ webfonts) to display it
  const hasMath = deckHasMath(deck);
  if (hasMath) await ensureKatex().catch(() => {});
  const katexLink = hasMath
    ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">\n' : '';
  const doc = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${escHTML(deck.title)}</title>
${katexLink}<style>
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
  const hasMath = deckHasMath(deck);
  if (hasMath) await ensureKatex().catch(() => {});
  const katexLink = hasMath
    ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">\n' : '';
  const w = window.open('', '_blank');
  if (!w){ toast('Pop-up blocked — allow pop-ups to export PDF'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${escHTML(deck.title)}</title>
${katexLink}<style>${SLIDE_CSS}
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
  toast('Preparing PowerPoint…', 15000);
  try { await loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'); }
  catch (e) { toast('Could not load the PPTX library — check your network'); return; }
  await ensureEmbedded(state.deck);

  const deck = state.deck, pal = palette(deck);
  const TS = deck.textScale || 1;
  const p = new window.PptxGenJS();
  p.defineLayout({ name: 'LF', width: 13.333, height: 7.5 });
  p.layout = 'LF';
  const I = px => +(px / 96).toFixed(3);                  // 1280px / 13.333in = 96 px/in
  const C = c => (c || '#000000').replace('#', '');
  const SERIF = 'Georgia', SANS = 'Arial';

  const bg = deck.background;
  const bgData = (bg && bg.src && bg.src.startsWith('data:'))
    ? await blurImageDataURL(bg.src, bg.blur || 0) : null;
  // sharp (unblurred) variant for the first slide, when that option is set
  const bgDataSharp = (deck.bgSharpFirst && bg && bg.src && bg.src.startsWith('data:')) ? bg.src : null;
  // no colour wash — let the photo show; text colour follows the photo brightness
  // with a contrasting drop shadow for legibility
  const bgTextLight = !!(bgData && bg.dark);
  const txtShadow = bgData
    ? { type: 'outer', color: bgTextLight ? '000000' : 'FFFFFF', blur: 4, offset: 2, angle: 90, opacity: 0.6 }
    : undefined;
  const addBackground = (sl, idx) => {
    const data = (deck.bgSharpFirst && idx === 0) ? bgDataSharp : bgData;
    if (!data) return;
    sl.addImage({ data, x: 0, y: 0, w: 13.333, h: 7.5, sizing: { type: 'cover', w: 13.333, h: 7.5 } });
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

  for (const [idx, s] of deck.slides.entries()) {
    const dark = isDark(s);
    // cinematic reveal: for content slides create one PPTX slide per reveal step
    const isContentBranch = s.type !== 'title' && s.type !== 'roadmap' && s.type !== 'section' && s.type !== 'takeaway';
    const revealAnns = deck.motion && isContentBranch && s.annotations && s.annotations.length > 0;
    const revSteps = revealAnns ? s.annotations.length + 1 : 1;
    for (let revStep = 0; revStep < revSteps; revStep++) {
    const maxAnns = revealAnns ? revStep : Infinity;
    const sl = p.addSlide();
    sl.background = { color: C(dark ? pal.darkSolid : pal.lightSolid) };
    addBackground(sl, idx);
    let ink = dark ? 'EDF3F9' : '17252F';
    if (bgData) ink = bgTextLight ? 'F4F8FB' : '16222C';
    const acc = C(dark ? pal.accent : pal.accentInk);
    const accBar = C(pal.accent);

    const rule = (x, y, w) => sl.addShape('rect', { x: I(x), y: I(y), w: I(w), h: I(5), fill: { color: accBar } });
    // PPTX text boxes can't typeset $...$ / $$...$$ TeX, so flatten it to readable plain text
    const T = (text, o) => sl.addText(mathToPlainText(text), { fontFace: SANS, color: ink, shadow: txtShadow, ...o });
    const boxAlign = key => (s.boxes && s.boxes[key] && s.boxes[key].align) || undefined;
    const boxObj = key => (s.boxes && s.boxes[key]) || {};
    // custom text colour / background fill carried over from the editor
    const textColor = obj => (obj && obj.color) ? { color: C(obj.color) } : {};
    const colorOpts = obj => Object.assign({}, textColor(obj),
      (obj && obj.bg) ? { fill: { color: C(obj.bg) } } : {});
    const bgFill = (obj, fallback) => ({ color: (obj && obj.bg) ? C(obj.bg) : fallback });
    const pt = px => Math.max(8, Math.round(px * 0.62));   // slide px → PPT points

    if (s.type === 'title'){
      T((deck.date || 'Lecture').toUpperCase(), { x: I(96), y: I(212), w: I(1000), h: I(36), fontSize: 12 * TS, charSpacing: 4, color: C(pal.accent2), align: boxAlign('kicker') });
      rule(96, 268, 64);
      T(s.headline || deck.title, { x: I(96), y: I(292), w: I(1010), h: I(210), fontFace: SERIF, fontSize: pt(fitHeadlineFS(s.headline || deck.title, 1000, 74, 44) * TS), bold: true, align: boxAlign('headline'), ...colorOpts(boxObj('headline')) });
      if (deck.presenter) T(deck.presenter, { x: I(96), y: I(516), w: I(900), h: I(40), fontSize: 16 * TS, color: dark ? '9FB2C4' : '5B6B7C', align: boxAlign('presenter') });
    }
    else if (s.type === 'roadmap'){
      T(s.headline || 'Roadmap', { x: I(96), y: I(60), w: I(1000), h: I(70), fontFace: SERIF, fontSize: pt(fitHeadlineFS(s.headline || 'Roadmap', 1000, 46, 30)), bold: true });
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
      T(s.headline || 'Section', { x: I(96), y: I(296), w: I(840), h: I(170), fontFace: SERIF, fontSize: pt(fitHeadlineFS(s.headline || 'Section', 840, 62, 38) * TS), bold: true, align: boxAlign('headline'), ...colorOpts(boxObj('headline')) });
    }
    else if (s.type === 'takeaway'){
      if (s.layout === 'takeawayQuote'){
        T(s.callout || s.headline || '', { x: I(150), y: I(210), w: I(980), h: I(220), align: boxAlign('callout') || 'center',
          fontFace: SERIF, fontSize: 26 * TS, italic: true, bold: true, ...colorOpts(boxObj('callout')) });
        T(s.headline || '', { x: I(200), y: I(470), w: I(880), h: I(40), align: boxAlign('headline') || 'center', fontSize: 13 * TS, color: dark ? '9FB2C4' : '5B6B7C', ...colorOpts(boxObj('headline')) });
      } else {
        const chipW = 168;
        sl.addShape('roundRect', { x: I(640 - chipW / 2), y: I(150), w: I(chipW), h: I(34), rectRadius: 0.5, fill: { color: accBar } });
        T('KEY TAKEAWAY', { x: I(640 - chipW / 2), y: I(150), w: I(chipW), h: I(34), align: 'center', valign: 'middle',
          fontSize: 11, charSpacing: 3, bold: true, color: '06222F' });
        rule(608, 218, 64);
        T(s.headline || '', { x: I(150), y: I(258), w: I(980), h: I(220), align: boxAlign('headline') || 'center', fontFace: SERIF,
          fontSize: pt(fitHeadlineFS(s.headline || 'The one thing to remember', 980, 54, 32) * TS), bold: true, ...colorOpts(boxObj('headline')) });
        if (s.callout) T(s.callout, { x: I(190), y: I(488), w: I(900), h: I(64), align: boxAlign('callout') || 'center', italic: true, fontSize: 14 * TS, color: dark ? 'B9C8D6' : '5B6B7C', ...colorOpts(boxObj('callout')) });
        if (s.annotations.length){
          const n = s.annotations.length, gap = 24, w = Math.min(320, (1120 - (n - 1) * gap) / n);
          const startX = (1280 - (n * w + (n - 1) * gap)) / 2;
          s.annotations.forEach((a, i) => {
            const x = a.x != null ? a.x : (startX + i * (w + gap)), y = a.y != null ? a.y : 552, aw = a.w != null ? a.w : w;
            const fs = a.fs != null ? a.fs : 16 * TS;
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
          fontFace: SERIF, fontSize: 26 * TS, italic: true, bold: true, ...colorOpts(boxObj('callout')) });
        T(s.headline || '', { x: I(150), y: I(470), w: I(980), h: I(40), align: boxAlign('headline') || 'center', fontSize: 13 * TS, color: dark ? '9FB2C4' : '5B6B7C', ...colorOpts(boxObj('headline')) });
      } else {
        rule(L.headline.x, L.headline.y - 14, 54);
        T(s.headline || '', { x: I(L.headline.x), y: I(L.headline.y), w: I(L.headline.w), h: I(110),
          fontFace: SERIF, fontSize: pt(L.headline.fs * TS), bold: true, valign: 'top', align: boxAlign('headline'), ...colorOpts(boxObj('headline')) });

        if (L.annStyle === 'step' && L.timelineGeom){
          const g = L.timelineGeom;
          s.annotations.forEach((a, i) => {
            if (i >= maxAnns) return;
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
            if (i >= maxAnns) return;
            const def = L.anns[i];
            if (L.annStyle === 'none' || L.annStyle === 'caption' || !def) return;
            const x = a.x != null ? a.x : def.x, y = a.y != null ? a.y : def.y;
            const w = a.w != null ? a.w : def.w, fs = a.fs != null ? a.fs : (def.fs || 19) * TS;
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
              const dispText = annDisplayText(a);
              const boxH = chipBoxH(dispText, w, fs, padY);
              sl.addShape('roundRect', { x: I(x), y: I(y), w: I(w), h: I(boxH), rectRadius: 0.05,
                fill: { color: a.bg ? C(a.bg) : (isLight ? 'F6EFE2' : '0A121C'), transparency: a.bg ? 0 : (isLight ? 0 : 28) },
                line: { type: 'none' } });
              sl.addShape('rect', { x: I(x), y: I(y), w: I(def.banner ? 6 : 4), h: I(boxH), fill: { color: accBar } });
              T(dispText, { x: I(x + 14), y: I(y), w: I(w - 22), h: I(boxH), fontSize: pt(fs), bold: true,
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
            const calloutFs = (L.callout.fs || 22) * TS;
            const boxH = chipBoxH(s.callout, L.callout.w, calloutFs, padY);
            sl.addShape('roundRect', { x: I(L.callout.x), y: I(L.callout.y), w: I(L.callout.w), h: I(boxH), rectRadius: 0.05,
              fill: { color: cobj.bg ? C(cobj.bg) : (isLight ? 'F6EFE2' : '0A121C'), transparency: cobj.bg ? 0 : (isLight ? 0 : 28) },
              line: { type: 'none' } });
            sl.addShape('rect', { x: I(L.callout.x), y: I(L.callout.y), w: I(6), h: I(boxH), fill: { color: accBar } });
            T(s.callout, { x: I(L.callout.x + 14), y: I(L.callout.y), w: I(L.callout.w - 22), h: I(boxH), fontSize: pt(calloutFs), bold: true,
              valign: 'middle', align: boxAlign('callout'), color: cobj.color ? C(cobj.color) : (isLight ? '23303D' : 'FFFFFF') });
          } else {
            sl.addShape('rect', { x: I(L.callout.x), y: I(L.callout.y), w: I(4), h: I(70), fill: { color: accBar } });
            T(s.callout, { x: I(L.callout.x + 12), y: I(L.callout.y), w: I(L.callout.w - 16), h: I(70), italic: true, fontSize: pt((L.callout.fs || 18) * TS), align: boxAlign('callout'), ...colorOpts(boxObj('callout')) });
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
      if (im.border && !im.cutout){
        // white frame drawn behind, photo inset by the border width (matches the editor)
        const b = 7;
        sl.addShape('roundRect', { x: I(im.x), y: I(im.y), w: I(im.w), h: I(im.h), rectRadius: 0.03,
          fill: { color: 'FFFFFF' }, line: { type: 'none' },
          shadow: { type: 'outer', color: '060E18', blur: 9, offset: 3, angle: 90, opacity: 0.34 } });
        sl.addImage({ data, x: I(im.x + b), y: I(im.y + b), w: I(im.w - 2 * b), h: I(im.h - 2 * b),
          sizing: { type: 'cover', w: I(im.w - 2 * b), h: I(im.h - 2 * b) } });
      } else {
        sl.addImage({ data, x: I(im.x), y: I(im.y), w: I(im.w), h: I(im.h),
          sizing: { type: im.cutout ? 'contain' : 'cover', w: I(im.w), h: I(im.h) } });
      }
    }

    // figure-grid captions, drawn on top of their own photo
    if (cl.annStyle === 'caption'){
      s.annotations.forEach((a, i) => {
        if (i >= maxAnns) return;
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

    // footer + attribution — pulled up clear of the frame border when present
    const footY = deck.frame ? 672 : 688;
    sl.addText(`${idx + 1} / ${deck.slides.length}`, { x: I(20), y: I(footY), w: I(80), h: I(24), fontSize: 8, color: dark ? '7E8FA0' : '8A98A6' });
    const attrs = s.images.filter(im => im.attr && im.attr.author)
      .map(im => `${im.attr.author} / ${im.attr.sourceName} (${im.attr.license})`);
    if (attrs.length)
      sl.addText('Photo: ' + [...new Set(attrs)].join(' · '), { x: I(84), y: I(footY), w: I(1000), h: I(24), fontSize: 7.5, color: dark ? '7E8FA0' : '8A98A6' });
    if (s.notes) sl.addNotes(s.notes);
    addFrame(sl, dark);
    } // end revStep inner loop (cinematic reveal)
  } // end deck.slides for-of

  // credits slide
  const attrs = collectAttributions(deck);
  if (attrs.length){
    const sl = p.addSlide();
    sl.background = { color: C(pal.darkSolid) };
    addBackground(sl, -1);
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
/* dir: 0 = no transition (initial open / resize), +1 = advancing to the
   next slide, -1 = going back to the previous slide. The outgoing and
   incoming slides cross-fade with a directional push so navigating
   backwards feels like the mirror image of going forwards. */
function renderPresent(dir = 0){
  const deck = state.deck;
  presentIdx = clamp(presentIdx, 0, deck.slides.length - 1);
  const stage = $('#present-stage');
  const sc = Math.min(innerWidth / SLIDE_W, (innerHeight - 10) / SLIDE_H);
  stage.style.width = (SLIDE_W * sc) + 'px';
  stage.style.height = (SLIDE_H * sc) + 'px';
  const slide = deck.slides[presentIdx];
  const node = renderSlide(slide, deck, { index: presentIdx, total: deck.slides.length });
  if (deck.motion) node.classList.add('lf-motion');
  node.style.transformOrigin = 'top left';

  const prevNode = presentNode;
  const animate = dir !== 0 && prevNode && prevNode.parentNode === stage;

  if (animate){
    // place the incoming slide off to the side it's entering from, then
    // transition both slides toward their resting positions next frame
    const offscreen = dir > 0 ? '100%' : '-100%';
    node.style.transition = 'none';
    node.style.transform = `scale(${sc}) translateX(${offscreen})`;
    stage.appendChild(node);
    prevNode.style.transition = 'none';
    prevNode.style.transform = `scale(${sc}) translateX(0)`;
    // force layout so the "no transition" starting positions are committed
    // before we switch transitions on and move toward the resting positions
    void node.offsetWidth;
    requestAnimationFrame(() => {
      prevNode.style.transition = node.style.transition = 'transform .38s ease, opacity .38s ease';
      prevNode.style.transform = `scale(${sc}) translateX(${dir > 0 ? '-100%' : '100%'})`;
      prevNode.style.opacity = '0';
      node.style.transform = `scale(${sc}) translateX(0)`;
    });
    prevNode.addEventListener('transitionend', () => prevNode.remove(), { once: true });
  } else {
    stage.innerHTML = '';
    node.style.transform = `scale(${sc})`;
    stage.appendChild(node);
  }
  presentNode = node;
  // sequential reveal: each annotation / panel is a build step you advance into
  // the takeaway banner (Annotated figure) is always shown, not a build step
  presentSteps = deck.motion ? Array.from(node.querySelectorAll('.lf-ann, .lf-panel')).filter(n => !n.classList.contains('lf-takeaway-banner')) : [];
  // "show fully built" (presentReveal = 1e9, set when stepping to the prior
  // slide) only means something relative to *this* slide's step count — clamp
  // it now so the very next ArrowLeft steps the build back instead of just
  // counting down from a billion
  presentReveal = Math.min(presentReveal, presentSteps.length);
  applyPresentReveal();
  $('#present-counter').textContent = `${presentIdx + 1} / ${deck.slides.length}`;
  const notes = $('#present-notes');
  notes.hidden = !presentNotesOn;
  setMathContent(notes, slide.notes || '(no notes)');
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
  if (which === 'home'){
    // make sure the deck we're leaving is fully persisted before its card
    // (and any others) are loaded from storage for the home grid
    save.flush();
    renderHome();
  }
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
  if (entry.starred) card.classList.add('starred');
  const thumb = el('div', 'dc-thumb');
  loadDeck(entry.id).then(d => {
    if (d && d.slides && d.slides.length){
      const scaleWrap = el('div', '', `transform:scale(${260 / SLIDE_W});transform-origin:top left;width:${SLIDE_W}px;height:${SLIDE_H}px;pointer-events:none;`);
      scaleWrap.appendChild(renderSlide(d.slides[0], d, { index: 0, total: d.slides.length }));
      thumb.appendChild(scaleWrap);
    }
  });
  const star = el('button', 'dc-star' + (entry.starred ? ' on' : ''), '', entry.starred ? '★' : '☆');
  star.type = 'button';
  star.title = entry.starred
    ? 'Starred — this deck feeds your taste profile. Click to unstar.'
    : 'Star this finished deck to teach your evolving taste profile';
  star.addEventListener('click', ev => { ev.stopPropagation(); toggleStar(entry.id); });
  thumb.appendChild(star);
  card.appendChild(thumb);
  const body = el('div', 'dc-body');
  body.appendChild(el('div', 'dc-title', '', entry.title || 'Untitled deck'));
  body.appendChild(el('div', 'dc-meta', '',
    `${entry.count} slide${entry.count === 1 ? '' : 's'} · ${new Date(entry.updated).toLocaleDateString()}`));
  card.appendChild(body);
  const open = async () => { const dk = await loadDeck(entry.id); if (dk) openDeck(dk); else toast('Could not load that deck'); };
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
  actions.appendChild(mkBtn('Template', 'ghost', 'Save this deck as a reusable template (structure + layouts, content blanked)', async () => {
    const d = await loadDeck(entry.id);
    if (!d) return;
    const name = (prompt('Template name:', d.title || 'Template') || '').trim();
    if (name) saveTemplate(d, name);
  }));
  actions.appendChild(mkBtn('✕', 'ghost danger', 'Delete this deck', async () => {
    if (!confirm(`Delete “${entry.title}”? This cannot be undone.`)) return;
    await deleteDeck(entry.id);
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

async function copyDeck(id){
  const d = await loadDeck(id);
  if (!d) return;
  const copy = JSON.parse(JSON.stringify(d));
  copy.id = uid();
  copy.title = (d.title || 'Untitled deck') + ' (copy)';
  delete copy.driveFileId;
  await IDB.set(LS.deck(copy.id), JSON.stringify(copy));
  const idx = deckIndex();
  const src = idx.find(e => e.id === id);
  idx.unshift({ id: copy.id, title: copy.title, updated: Date.now(), count: copy.slides.length,
                folder: src ? (src.folder || null) : null });
  saveIndex(idx);
  renderHome();
  toast('Deck copied');
}

async function downloadDeck(id){
  const d = await loadDeck(id);
  if (!d) return;
  downloadText(safeName(d.title) + '.lectureflow.json', JSON.stringify(d, null, 2), 'application/json');
}

/* ================= deck templates ================= */

function templates(){
  try { return JSON.parse(localStorage.getItem(LS.templates) || '[]'); }
  catch (e) { return []; }
}
function saveTemplates(arr){ localStorage.setItem(LS.templates, JSON.stringify(arr.slice(0, 50))); }

const TPL_PH = { headline: 'Headline', point: 'Point', callout: 'Key stat or quote', text: 'Text' };

/* clone a deck into a reusable skeleton: keep structure, slide types, layouts,
   palette, and recurring elements, but blank the content to placeholders and
   drop images/backgrounds so templates stay small */
function deckToTemplate(deck, name){
  const t = JSON.parse(JSON.stringify(deck));
  t.id = uid();
  t.template = true;
  t.name = (name || deck.title || 'Template').trim();
  t.title = ''; t.presenter = ''; t.date = '';
  t.background = null;
  (t.overlays || []).forEach(o => { o.id = uid(); if (o.text) o.text = TPL_PH.text; });
  for (const s of t.slides){
    s.id = uid();
    s.headline = s.headline ? TPL_PH.headline : '';
    s.callout  = s.callout  ? TPL_PH.callout  : '';
    s.figure = ''; s.notes = '';
    s.images = [];
    (s.annotations || []).forEach((a, i) => {
      a.id = uid(); a.text = TPL_PH.point + ' ' + (i + 1); a.full = a.text;
    });
    (s.texts || []).forEach(tx => { tx.id = uid(); if (tx.text) tx.text = TPL_PH.text; });
  }
  return t;
}

/* instantiate a fresh editable deck from a template, regenerating every id so
   two decks started from the same template never collide */
function templateToDeck(tpl){
  const d = JSON.parse(JSON.stringify(tpl));
  delete d.template; delete d.name;
  d.id = uid();
  (d.overlays || []).forEach(o => { o.id = uid(); });
  for (const s of d.slides){
    s.id = uid();
    (s.annotations || []).forEach(a => { a.id = uid(); });
    (s.texts || []).forEach(tx => { tx.id = uid(); });
  }
  return migrateDeck(d);
}

function saveTemplate(deck, name){
  const arr = templates();
  arr.unshift(deckToTemplate(deck, name));
  saveTemplates(arr);
  toast('Saved as template');
}
function deleteTemplate(id){ saveTemplates(templates().filter(t => t.id !== id)); }

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
  { name: 'Compare & contrast', outline: `# A vs B
Design: slate, minimal
1. TYPE: title
   HEADLINE: A vs B

2. TYPE: content
   HEADLINE: Two ways to look at it
   LAYOUT: comparison
   POINTS:
   - First side, point one
   - First side, point two
   - Second side, point one
   - Second side, point two
   FIGURE: an image that frames the comparison

3. TYPE: content
   HEADLINE: Why it matters
   POINTS:
   - Point one
   - Point two
   - Point three
   CALLOUT: A memorable stat or quote
   FIGURE: the central image for this idea

4. TYPE: takeaway
   HEADLINE: The one thing to remember
   POINTS:
   - recap a
   - recap b` },
  { name: 'Process / lifecycle', outline: `# How it happens, step by step
Design: forest, calm
1. TYPE: title
   HEADLINE: How it happens, step by step

2. TYPE: content
   HEADLINE: The stages
   LAYOUT: timeline
   POINTS:
   - Stage one
   - Stage two
   - Stage three
   - Stage four
   FIGURE: an image that frames the whole process

3. TYPE: content
   HEADLINE: A closer look
   POINTS:
   - Point one
   - Point two
   - Point three
   CALLOUT: A memorable stat or quote
   FIGURE: the central image for this idea

4. TYPE: takeaway
   HEADLINE: The one thing to remember
   POINTS:
   - recap a
   - recap b` },
];

function builtinTemplates(){
  return BUILTIN_TEMPLATE_OUTLINES.map(b => {
    const t = deckToTemplate(parseOutline(b.outline), b.name);
    t.id = 'builtin:' + b.name;
    t.builtin = true;
    return t;
  });
}
function allTemplates(){ return [...builtinTemplates(), ...templates()]; }

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
  // flush any pending debounced save of the deck we're leaving — otherwise a
  // save scheduled just before switching decks would land on `deck` instead
  // and the previous deck's last edit would never reach storage
  if (state.deck && state.deck !== deck) save.flush();
  state.deck = deck;
  state.cur = 0;
  state.sel = null;
  panelSeedFor = null;
  saveStatus = 'ok';
  $('#deck-title').value = deck.title || '';
  showScreen('editor');
  updateSaveBtn();
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

function renderTemplatesModal(){
  const list = $('#templates-list');
  list.innerHTML = '';
  for (const t of allTemplates()){
    const li = el('li');
    const name = el('span', 'dk-name', '', t.name || 'Template');
    name.addEventListener('click', () => {
      $('#templates-modal').close();
      openDeck(templateToDeck(t));
      toast(`Started a deck from “${t.name}”`);
    });
    li.appendChild(name);
    li.appendChild(el('span', 'dk-meta', '', `${t.slides.length} slide${t.slides.length === 1 ? '' : 's'}${t.builtin ? ' · built-in' : ''}`));
    const use = el('button', 'btn small primary', '', 'Use');
    use.type = 'button';
    use.addEventListener('click', () => {
      $('#templates-modal').close();
      openDeck(templateToDeck(t));
      toast(`Started a deck from “${t.name}”`);
    });
    li.appendChild(use);
    if (!t.builtin){
      const del = el('button', 'btn small danger', '', '✕');
      del.type = 'button';
      del.title = 'Delete template';
      del.addEventListener('click', () => {
        if (!confirm(`Delete template “${t.name}”? This cannot be undone.`)) return;
        deleteTemplate(t.id);
        renderTemplatesModal();
      });
      li.appendChild(del);
    }
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
    // snapshot the as-generated structure so we can later learn from how it's edited
    deck.origin = { outline: text, fp: structureFingerprint(deck), at: Date.now() };
    openDeck(deck);
    toast(`Parsed ${deck.slides.length} slides — drop in images from the panel on the right`);
  });

  // draft from prose
  $('#btn-outline-prose').addEventListener('click', () => {
    $('#prose-key').value = settings.anthropicKey || '';
    proseStatus('');
    $('#prose-modal').showModal();
  });
  $$('input[name="prose-mode"]').forEach(r => r.addEventListener('change', () => {
    $('#prose-ai-opts').hidden = document.querySelector('input[name="prose-mode"]:checked').value !== 'ai';
  }));
  $('#prose-generate').addEventListener('click', async () => {
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
    } catch (e){ proseStatus("Couldn't generate: " + e.message + ' — try Quick mode.', true); }
  });

  // topbar
  $('#deck-title').addEventListener('input', e => {
    if (state.deck){ state.deck.title = e.target.value; save(); }
  });
  $('#btn-outline').addEventListener('click', () => {
    if (state.deck && state.deck.slides.length) $('#outline-text').value = deckToOutline(state.deck);
    showScreen('outline');
  });
  async function goHome(){
    if (state.deck){
      await saveDeckNow();
      if (saveStatus === 'failed'){
        if (!confirm('Could not save your deck.\n\nExport the deck first to keep a copy.\n\nLeave anyway?')) return;
      }
    }
    showScreen('home');
  }
  $('#btn-decks').addEventListener('click', goHome);
  const brand = $('#brand');
  if (brand){ brand.style.cursor = 'pointer'; brand.addEventListener('click', goHome); }

  // Warn before closing/refreshing the tab if the last save failed
  window.addEventListener('beforeunload', e => {
    if (state.deck && saveStatus === 'failed'){
      e.preventDefault();
      e.returnValue = '';
    }
  });
  $('#btn-present').addEventListener('click', startPresent);
  $('#btn-save').addEventListener('click', async () => {
    await saveDeckNow();
    if (saveStatus === 'ok') toast('Saved');
  });

  // home screen
  $('#btn-new-deck').addEventListener('click', () => showScreen('outline'));
  $('#btn-new-folder').addEventListener('click', newFolder);
  $('#btn-drive').addEventListener('click', openDriveModal);
  $('#btn-taste').addEventListener('click', openTasteModal);
  $('#taste-refresh').addEventListener('click', refreshTaste);
  $('#btn-import-deck').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', e => {
    const f = e.target.files[0]; if (f) importDeckFile(f); e.target.value = '';
  });
  $('#btn-batch-outline').addEventListener('click', () => $('#file-outline-batch').click());
  $('#file-outline-batch').addEventListener('change', async e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const folder = homeFolder !== 'all' ? homeFolder : null;
    let made = 0;
    const failed = [];
    for (const f of files){
      const text = await f.text();
      const deck = parseOutline(text);
      if (!deck.slides.length){ failed.push(f.name); continue; }
      if (deck.title === 'Untitled deck') deck.title = f.name.replace(/\.[^.]+$/, '');
      await saveNewDeck(deck, folder);
      made++;
    }
    renderHome();
    if (made) toast(`Built ${made} deck${made === 1 ? '' : 's'} from ${files.length} outline${files.length === 1 ? '' : 's'}`
      + (failed.length ? ` — couldn't parse: ${failed.join(', ')}` : ''));
    else toast(`Couldn't find any slides in ${failed.join(', ')}`);
  });
  $('#btn-from-template').addEventListener('click', () => {
    renderTemplatesModal();
    $('#templates-modal').showModal();
  });

  // export dropdown
  const dd = $('#btn-export').closest('.dropdown');
  $('#btn-export').addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
  document.addEventListener('click', () => dd.classList.remove('open'));
  $('#export-drive').addEventListener('click', () => { dd.classList.remove('open'); driveSaveDeck(); });
  $('#export-pptx').addEventListener('click', () => { dd.classList.remove('open'); exportPPTX(); });
  $('#export-pdf').addEventListener('click', () => { dd.classList.remove('open'); exportPDF(); });
  $('#export-html').addEventListener('click', () => { dd.classList.remove('open'); exportHTML(); });
  $('#export-outline').addEventListener('click', () => {
    dd.classList.remove('open');
    if (!guardDeck()) return;
    downloadText(safeName(state.deck.title) + '.outline.txt', deckToOutline(state.deck), 'text/plain');
  });

  // settings
  $('#btn-settings').addEventListener('click', () => {
    $('#set-unsplash').value = settings.unsplashKey || '';
    $('#set-pexels').value = settings.pexelsKey || '';
    $('#set-pixabay').value = settings.pixabayKey || '';
    $('#set-removebg').value = settings.removebgKey || '';
    $('#set-photoroom').value = settings.photoroomKey || '';
    $('#set-anthropic').value = settings.anthropicKey || '';
    $('#set-google-key').value = settings.googleKey || '';
    $('#set-google-cx').value = settings.googleCx || '';
    $('#set-serper').value = settings.serperKey || '';
    $('#set-bing').value = settings.bingKey || '';
    $('#set-brave').value = settings.braveKey || '';
    $('#set-drive-client-id').value = settings.driveClientId || '';
    $('#settings-modal').showModal();
  });
  $('#set-save').addEventListener('click', () => {
    settings.unsplashKey = $('#set-unsplash').value.trim();
    settings.pexelsKey = $('#set-pexels').value.trim();
    settings.pixabayKey = $('#set-pixabay').value.trim();
    settings.removebgKey = $('#set-removebg').value.trim();
    settings.photoroomKey = $('#set-photoroom').value.trim();
    settings.anthropicKey = $('#set-anthropic').value.trim();
    settings.googleKey = $('#set-google-key').value.trim();
    settings.googleCx = $('#set-google-cx').value.trim();
    settings.serperKey = $('#set-serper').value.trim();
    settings.bingKey = $('#set-bing').value.trim();
    settings.braveKey = $('#set-brave').value.trim();
    const prevDriveId = settings.driveClientId;
    settings.driveClientId = $('#set-drive-client-id').value.trim();
    if (settings.driveClientId !== prevDriveId){ _driveToken = null; _driveTokenClient = null; _driveFolderId = null; }
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
    const newAnn = { id: uid(), text: 'Label', full: '', x: null, y: null };
    s.annotations.push(newAnn);
    refreshAll();
    requestAnimationFrame(() => {
      const ed = document.querySelector(`[data-edit="ann:${newAnn.id}"]`);
      if (!ed) return;
      try { ed.contentEditable = 'plaintext-only'; } catch (err) { ed.contentEditable = 'true'; }
      ed.focus();
      const r = document.createRange(); r.selectNodeContents(ed);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    });
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
  $('#sel-truncate').addEventListener('click', () => {
    if ($('#sel-truncate').disabled) return;
    truncateMode = !truncateMode;
    renderEditor();
    if (truncateMode) toast('Truncate: click a word to cut the tail there; drag across words to cut a middle piece; click a struck word to restore. Esc when done.', 5200);
  });
  $('#sel-split').addEventListener('click', () => {
    if ($('#sel-split').disabled) return;
    const s = cur(); const info = selInfo(s, state.sel);
    if (info && info.type === 'ann') splitAnnTail(s, info.obj);
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
  $('#btn-fill-figures').addEventListener('click', openFillFigures);
  $('#fill-close').addEventListener('click', closeFill);
  $('#fill-skip').addEventListener('click', fillSkip);
  $('#fill-back').addEventListener('click', fillBack);
  $('#fill-auto').addEventListener('click', fillAuto);
  $('#fill-go').addEventListener('click', () => fillSearch());
  $('#fill-query').addEventListener('keydown', e => { if (e.key === 'Enter') fillSearch(); });
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
  $('#ip-transparent').addEventListener('change', () => {
    if ($('#ip-query').value.trim()) runImageSearch();
  });
  $$('.ip-tab').forEach(t => t.addEventListener('click', () => showPanelTab(t.dataset.tab)));

  // "your images" — drag-and-drop or browse from computer, kept for this session only
  const dz = $('#ip-upload-zone');
  $('#ip-upload-btn').addEventListener('click', () => $('#ip-upload').click());
  $('#ip-upload').addEventListener('change', e => {
    addLocalFiles(e.target.files);
    e.target.value = '';
  });
  dz.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dz.classList.add('drag-over');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dz.classList.remove('drag-over');
    addLocalFiles(e.dataTransfer.files);
  });

  // PDF readings panel — upload a PDF, extract or crop figures from its pages
  const pdfDz = $('#pdf-upload-zone');
  $('#pdf-upload-btn').addEventListener('click', () => $('#pdf-upload').click());
  $('#pdf-upload').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) loadPdfFile(f);
    e.target.value = '';
  });
  pdfDz.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    pdfDz.classList.add('drag-over');
  });
  pdfDz.addEventListener('dragleave', () => pdfDz.classList.remove('drag-over'));
  pdfDz.addEventListener('drop', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    pdfDz.classList.remove('drag-over');
    const f = [...e.dataTransfer.files].find(f => f.type === 'application/pdf');
    if (f) loadPdfFile(f);
    else pdfStatus('That file is not a PDF', true);
  });
  $('#pdf-remove').addEventListener('click', clearPdf);
  $('#pdf-prev').addEventListener('click', () => gotoPdfPage(-1));
  $('#pdf-next').addEventListener('click', () => gotoPdfPage(1));
  $('#pdf-extract-page').addEventListener('click', () => autoExtractFigures(false));
  $('#pdf-extract-all').addEventListener('click', () => autoExtractFigures(true));
  $('#pdf-crop-mode').addEventListener('click', async () => {
    const on = !!(pdfState && !pdfState.cropMode);
    setCropMode(on);
    if (on){
      await renderPdfPage();
      // render a high-res canvas (scale 3) in the background for crop quality
      const page = pdfState.page;
      const vp = page.getViewport({ scale: 3 });
      const hrc = document.createElement('canvas');
      hrc.width = Math.round(vp.width); hrc.height = Math.round(vp.height);
      await page.render({ canvasContext: hrc.getContext('2d'), viewport: vp }).promise;
      if (pdfState) pdfState.highResCanvas = hrc;
    }
  });
  $('#pdf-page-wrap').addEventListener('pointerdown', pdfCropPointerDown);

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
  $('#bg-sharp-first').addEventListener('change', () => {
    if (!guardDeck()) return;
    checkpoint();
    state.deck.bgSharpFirst = $('#bg-sharp-first').checked;
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
  let textScaleCheckpointed = false;
  $('#bg-textscale').addEventListener('pointerdown', () => { textScaleCheckpointed = false; });
  $('#bg-textscale').addEventListener('input', () => {
    if (!guardDeck()) return;
    if (!textScaleCheckpointed){ checkpoint(); textScaleCheckpointed = true; }
    state.deck.textScale = +$('#bg-textscale').value;
    $('#bg-textscale-val').textContent = Math.round(state.deck.textScale * 100) + '%';
    renderEditor();
    renderRail();
  });
  $('#bg-textscale').addEventListener('change', () => {
    if (!guardDeck()) return;
    save();
  });

  // drop images onto the canvas
  const wrap = $('#canvas-wrap');

  // trackpad pinch or ctrl+scroll → zoom the slide canvas
  wrap.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const factor = Math.pow(0.998, e.deltaY);
    userZoom = Math.max(0.4, Math.min(3, userZoom * factor));
    fitCanvas();
  }, { passive: false });

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

  // paste an image from the clipboard (e.g. a screenshot or a copied web
  // image) straight onto the current slide. If the clipboard holds no
  // image, fall through to the browser's normal text-paste behavior.
  document.addEventListener('paste', e => {
    if (!state.deck || $('#screen-editor').hidden || presenting) return;
    if (document.querySelector('dialog[open]')) return;
    const items = [...(e.clipboardData ? e.clipboardData.items : [])];
    const item = items.find(it => it.type && it.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    blobToDataURL(file).then(async src => {
      try { src = await shrinkImage(src); } catch (e) {}
      insertImageFromResult({
        provider: 'local', title: 'Pasted image', author: '', authorUrl: '',
        license: '', licenseUrl: '', pageUrl: '', sourceName: 'Pasted image',
        full: src, thumb: src,
      });
    });
  });

  // keyboard
  document.addEventListener('keydown', e => {
    if (presenting){
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown'){
        e.preventDefault();
        if (presentReveal < presentSteps.length){ presentReveal++; applyPresentReveal(); }  // reveal next build step
        else if (presentIdx < state.deck.slides.length - 1){ presentIdx++; presentReveal = 0; renderPresent(1); }  // then advance the slide
      }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp'){
        e.preventDefault();
        if (presentReveal > 0){ presentReveal--; applyPresentReveal(); }                     // step the build back
        else if (presentIdx > 0){ presentIdx--; presentReveal = 1e9; renderPresent(-1); }     // prior slide shown fully built
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
    else if (e.key === 'Escape'){ if (state.sel || state.selMulti.length || truncateMode){ e.preventDefault(); setSel(null); } }
  });
  $('#present-overlay').addEventListener('click', e => {
    if (e.target.closest('#present-notes') || e.target.closest('#present-exit')) return;
    if (presentReveal < presentSteps.length){ presentReveal++; applyPresentReveal(); return; }
    if (presentIdx >= state.deck.slides.length - 1){ stopPresent(); return; }
    presentIdx++; presentReveal = 0; renderPresent(1);
  });
  $('#present-exit').addEventListener('click', e => { e.stopPropagation(); stopPresent(); });
  // some browsers (e.g. Chrome) exit fullscreen on Esc without delivering that
  // keydown to the page — without this, the overlay would be stranded on top
  // of a no-longer-fullscreen window with no way back
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && presenting) stopPresent();
  });

  window.addEventListener('resize', () => {
    fitCanvas();
    if (state.deck && !$('#screen-editor').hidden) renderEditor();
    if (presenting) renderPresent();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveDeckNow(); });
  // belt-and-suspenders: pagehide fires when navigating away or closing the tab
  window.addEventListener('pagehide', () => saveDeckNow());
}

/* ================= Google Drive sync ================= */

let _driveToken = null, _driveTokenExpiry = 0, _driveTokenClient = null, _driveFolderId = null;

// Silent auto-save to Drive (fires 60s after last edit, only if already authenticated)
const _driveAutoSave = debounce(async () => {
  if (!state.deck || !settings.driveClientId || !_driveToken || Date.now() >= _driveTokenExpiry) return;
  try {
    const folderId = await driveEnsureFolder();
    if (!folderId) return;
    const d = state.deck;
    const fileName = safeName(d.title || 'Untitled') + '.lectureflow.json';
    const content = JSON.stringify(d);
    const result = await driveUpload(
      d.driveFileId || null,
      d.driveFileId ? { name: fileName } : { name: fileName, parents: [folderId] },
      content);
    if (result && !d.driveFileId){
      d.driveFileId = result.id;
      // persist the new driveFileId without re-triggering auto-save
      await IDB.set(LS.deck(d.id), JSON.stringify(d));
    }
  } catch(e) { /* silent — user isn't expecting this */ }
}, 60000);

async function driveAuth(){
  if (!settings.driveClientId){
    toast('Add a Google OAuth Client ID in Settings → Google Drive sync to enable this feature');
    return null;
  }
  if (_driveToken && Date.now() < _driveTokenExpiry) return _driveToken;
  if (!window.google?.accounts?.oauth2){
    try { await loadScript('https://accounts.google.com/gsi/client'); }
    catch(e){ toast('Could not load Google Sign-In library — check your network'); return null; }
  }
  return new Promise(resolve => {
    if (!_driveTokenClient || _driveTokenClient._cid !== settings.driveClientId){
      _driveTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: settings.driveClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: resp => {
          if (resp.error){ resolve(null); return; }
          _driveToken = resp.access_token;
          _driveTokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000 - 60000;
          _driveFolderId = null;
          resolve(_driveToken);
        },
        error_callback: () => resolve(null),
      });
      _driveTokenClient._cid = settings.driveClientId;
    }
    _driveTokenClient.requestAccessToken();
  });
}

async function driveUpload(fileId, meta, content){
  const token = await driveAuth();
  if (!token) return null;
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=resumable&fields=id`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id';
  const initRes = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
  if (!initRes.ok){ if (initRes.status === 401) _driveToken = null; throw new Error('Drive API ' + initRes.status); }
  const uploadUrl = initRes.headers.get('Location');
  const uploadRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: content });
  if (!uploadRes.ok) throw new Error('Drive upload ' + uploadRes.status);
  return uploadRes.json();
}

async function driveEnsureFolder(){
  if (_driveFolderId) return _driveFolderId;
  const token = await driveAuth();
  if (!token) return null;
  const q = encodeURIComponent("name='LectureFlow' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { 'Authorization': 'Bearer ' + token } });
  const d = await r.json();
  if (d.files?.length){ _driveFolderId = d.files[0].id; return _driveFolderId; }
  const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'LectureFlow', mimeType: 'application/vnd.google-apps.folder' }),
  });
  const folder = await cr.json();
  _driveFolderId = folder.id;
  return _driveFolderId;
}

async function driveSaveDeck(d){
  d = d || state.deck;
  if (!d){ toast('Open a deck first, then use Export → Save to Drive'); return; }
  if (!settings.driveClientId){ toast('Add a Google OAuth Client ID in Settings → Google Drive sync'); return; }
  toast('Saving to Google Drive…', 12000);
  try {
    const folderId = await driveEnsureFolder();
    if (!folderId) return;
    const fileName = safeName(d.title || 'Untitled') + '.lectureflow.json';
    const content = JSON.stringify(d);
    const result = await driveUpload(
      d.driveFileId || null,
      d.driveFileId ? { name: fileName } : { name: fileName, parents: [folderId] },
      content);
    if (!result) return;
    if (!d.driveFileId){
      d.driveFileId = result.id;
      await IDB.set(LS.deck(d.id), JSON.stringify(d)); // persist driveFileId without re-triggering auto-save
    }
    toast('Saved to Google Drive ✓');
  } catch(e){
    console.error('Drive save:', e);
    toast('Drive save failed — ' + (e.message || 'unknown error'));
  }
}

async function driveListFiles(){
  const folderId = await driveEnsureFolder();
  if (!folderId) return [];
  const token = await driveAuth();
  if (!token) return [];
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime+desc`,
    { headers: { 'Authorization': 'Bearer ' + token } });
  if (!r.ok) return [];
  return (await r.json()).files || [];
}

async function driveDeleteFile(fileId){
  const token = await driveAuth();
  if (!token) return;
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`,
    { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
}

async function driveOpenDeck(fileId){
  try {
    const token = await driveAuth();
    if (!token) return;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { 'Authorization': 'Bearer ' + token } });
    if (!r.ok) throw new Error('download ' + r.status);
    const d = migrateDeck(await r.json());
    if (!d || !Array.isArray(d.slides)) throw new Error('invalid deck');
    d.id = d.id || uid();
    d.driveFileId = fileId;
    openDeck(d);
    $('#drive-modal')?.close();
    toast(`Opened "${d.title || 'Untitled'}" from Drive`);
  } catch(e){
    console.error('Drive open:', e);
    toast('Could not open deck from Drive — ' + e.message);
  }
}

function renderTasteModal(){
  const starred = deckIndex().filter(e => e.starred);
  const rec = loadTaste();
  const meta = $('#taste-meta');
  const body = $('#taste-profile');
  meta.textContent = `${starred.length} deck${starred.length === 1 ? '' : 's'} starred`
    + (rec ? ` · profile last built ${new Date(rec.at).toLocaleDateString()} from ${rec.count} deck${rec.count === 1 ? '' : 's'}` : ' · no profile yet');
  if (rec && rec.profile){
    body.textContent = rec.profile;
  } else if (starred.length < 2){
    body.textContent = 'Star at least 2 finished decks (the ★ on each deck card), then click "Analyze / refresh" to learn your taste. The more you star, the sharper it gets.';
  } else {
    body.textContent = 'Click "Analyze / refresh" to build your taste profile from the decks you\'ve starred.';
  }
}

function openTasteModal(){
  renderTasteModal();
  $('#taste-status').hidden = true;
  $('#taste-modal').showModal();
}

async function refreshTaste(){
  if (!settings.anthropicKey){
    toast('Add your Anthropic API key in Settings to analyze your taste');
    return;
  }
  const st = $('#taste-status');
  st.hidden = false; st.classList.remove('err'); st.textContent = 'Analyzing your starred decks…';
  $('#taste-refresh').disabled = true;
  try {
    const rec = await analyzeTaste();
    if (rec){ renderTasteModal(); st.hidden = true; }
    else { st.textContent = 'Star at least 2 finished decks first.'; }
  } catch (e){
    st.classList.add('err'); st.textContent = "Couldn't analyze: " + e.message;
  } finally {
    $('#taste-refresh').disabled = false;
  }
}

async function openDriveModal(){
  if (!settings.driveClientId){
    toast('Add a Google OAuth Client ID in Settings → Google Drive sync first');
    $('#btn-settings').click();
    return;
  }
  const dlg = $('#drive-modal');
  const list = $('#drive-list');
  list.innerHTML = '';
  const loading = el('p', 'muted'); loading.style.padding = '16px 0';
  loading.textContent = 'Connecting to Google Drive…';
  list.appendChild(loading);
  dlg.showModal();
  try {
    const files = await driveListFiles();
    list.innerHTML = '';
    if (!files.length){
      const msg = el('p', 'muted'); msg.style.padding = '16px 0';
      msg.textContent = 'No LectureFlow decks in Drive yet. Open a deck in the editor and use Export → Save to Drive to back it up.';
      list.appendChild(msg);
      return;
    }
    files.forEach(f => {
      const li = el('li', 'drive-item');
      const info = el('div', 'drive-item-info');
      const name = el('div', 'drive-item-name');
      name.textContent = f.name.replace(/\.lectureflow\.json$/i, '');
      const meta = el('div', 'drive-item-meta');
      const sz = f.size ? ' · ' + (f.size / 1048576).toFixed(1) + ' MB' : '';
      meta.textContent = new Date(f.modifiedTime).toLocaleDateString() + sz;
      info.append(name, meta);
      const btns = el('div', 'drive-item-btns');
      const openBtn = el('button', 'btn small ghost'); openBtn.textContent = 'Open';
      openBtn.onclick = () => driveOpenDeck(f.id);
      const delBtn = el('button', 'btn small ghost'); delBtn.textContent = '✕';
      delBtn.title = 'Delete from Drive (your local copy is unaffected)';
      delBtn.style.color = '#f87171';
      delBtn.onclick = async () => {
        if (!confirm(`Delete "${name.textContent}" from Google Drive?\n\nThis only removes the Drive backup — your local copy in this browser is unaffected.`)) return;
        await driveDeleteFile(f.id);
        li.remove();
        if (!$('#drive-list li')){ const msg = el('p','muted'); msg.style.padding='16px 0'; msg.textContent='No decks in Drive.'; list.appendChild(msg); }
        toast('Deleted from Drive');
      };
      btns.append(openBtn, delBtn);
      li.append(info, btns);
      list.appendChild(li);
    });
  } catch(e){
    list.innerHTML = '';
    const err = el('p'); err.style.cssText = 'color:#f87171;padding:16px 0';
    err.textContent = 'Could not load Drive files — ' + (e.message || 'check your Client ID and try again');
    list.appendChild(err);
  }
}

/* ================= IDB migration ================= */

async function idbMigrate(){
  const idx = deckIndex();
  for (const entry of idx){
    const key = LS.deck(entry.id);
    const raw = localStorage.getItem(key);
    if (raw){
      try { await IDB.set(key, raw); localStorage.removeItem(key); } catch(e) {}
    }
  }
}

/* ================= init ================= */

async function init(){
  // shared slide styles, injected once (also embedded into exports)
  const st = document.createElement('style');
  st.textContent = SLIDE_CSS;
  document.head.appendChild(st);

  wireUI();

  // migrate any decks still in localStorage → IndexedDB (one-time, safe to re-run)
  await idbMigrate();

  const curId = localStorage.getItem(LS.current);
  const d = curId && await loadDeck(curId);
  if (d && d.slides && d.slides.length){
    openDeck(d);
  } else if (deckIndex().length){
    showScreen('home');
  } else {
    showScreen('outline');
  }
}

init();

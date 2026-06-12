/* ============================================================
   SlideCraft — source-grounded presentation maker.
   Like NotebookLM's slide generator, but images are always
   user-supplied: every visual slot is a placeholder the user
   fills via upload, drag-drop, paste, URL, or the library.
   ============================================================ */

"use strict";

/* ----------------------- state ----------------------- */

const STORAGE_KEY = "slidecraft.project.v1";
const SETTINGS_KEY = "slidecraft.settings.v1";

let project = newProject();
let current = 0; // index of selected slide
let settings = loadSettings();
let presenting = false;
let presentIndex = 0;

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function newProject() {
  return {
    title: "",
    theme: "oceanic",                                  // dark serif lecture look by default
    background: { preset: "oceanic", image: null },    // deck-wide full-bleed fill
    frame: true,                                        // thin inset border on every slide
    sources: [],
    slides: [newSlide("title")],
    library: [], // {id, name, src}
  };
}

function newSlide(layout = "bullets") {
  return {
    id: uid(),
    layout,
    title: "",
    subtitle: "",
    kicker: "",      // small eyebrow text under the title
    takeaway: "",    // big takeaway line anchored to the bottom
    bullets: [],
    notes: "",
    image: null,     // {src, alt} — the single-image layouts
    imageSuggestion: "",
    placed: [],      // free-placement images: {id, src|null, alt, caption, suggestion, x, y, w}
  };
}

function loadSettings() {
  try {
    return Object.assign({ apiKey: "", model: "claude-opus-4-8" },
      JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"));
  } catch { return { apiKey: "", model: "claude-opus-4-8" }; }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch (e) {
    // Most likely quota (large embedded images). App keeps working; user can Save to file.
    console.warn("Autosave failed:", e);
  }
}

// Fill in fields added in later versions so old projects keep working.
function normalizeProject(p) {
  p = Object.assign(newProject(), p);
  if (!p.background) p.background = { preset: "none", image: null };
  p.slides = (p.slides || []).map(s => Object.assign(newSlide(s.layout), s));
  return p;
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.slides) && p.slides.length) project = normalizeProject(p);
  } catch { /* ignore corrupt autosave */ }
}

/* ----------------------- DOM refs ----------------------- */

const $ = (sel) => document.querySelector(sel);
const deckTitleEl = $("#deck-title");
const sourceListEl = $("#source-list");
const sourceCountEl = $("#source-count");
const filmstripEl = $("#filmstrip");
const canvasEl = $("#slide-canvas");
const canvasWrapEl = $("#canvas-wrap");
const notesEl = $("#speaker-notes");
const layoutSelect = $("#layout-select");
const themeSelect = $("#theme-select");
const slidePosEl = $("#slide-position");
const libraryEl = $("#image-library");

/* ----------------------- helpers ----------------------- */

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, ms);
}

function slide() { return project.slides[current]; }

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file);
  });
}

/* ============================================================
   RENDERING
   ============================================================ */

// Deck-wide background presets (full-bleed). DARK ones force light text.
const BG_PRESETS = {
  none:     null,
  oceanic:  "radial-gradient(125% 110% at 50% -10%, #1b5286 0%, #0c2c4a 48%, #06182e 100%)",
  abyss:    "linear-gradient(165deg,#0f2027 0%,#203a43 55%,#2c5364 100%)",
  charcoal: "radial-gradient(120% 120% at 30% 15%, #3b4350 0%, #1a1d23 72%)",
  plum:     "radial-gradient(120% 120% at 70% 10%, #3b2154 0%, #160e26 75%)",
  sand:     "linear-gradient(165deg,#f7f1e3 0%,#ece0c8 100%)",
  mist:     "linear-gradient(165deg,#f4f7fb 0%,#dfe7f1 100%)",
};
const DARK_PRESETS = new Set(["oceanic", "abyss", "charcoal", "plum"]);

function applyBackground(el) {
  const bg = project.background || { preset: "none" };
  el.classList.toggle("framed", !!project.frame);
  if (bg.image) {
    el.style.background = `#0c2c4a url("${bg.image}") center / cover no-repeat`;
    el.classList.add("bg-dark");
  } else if (bg.preset && bg.preset !== "none" && BG_PRESETS[bg.preset]) {
    el.style.background = BG_PRESETS[bg.preset];
    el.classList.toggle("bg-dark", DARK_PRESETS.has(bg.preset));
  } else {
    el.style.background = "";           // fall back to the theme's --slide-bg
    el.classList.remove("bg-dark");
  }
}

function placedImageHTML(p, mode) {
  const editable = mode === "edit";
  const style = `left:${p.x}%;top:${p.y}%;width:${p.w}%`;
  const cap = `<figcaption class="placed-cap" ${editable ? `contenteditable="true" data-pid="${p.id}"` : ""} data-ph="caption…">${esc(p.caption || "")}</figcaption>`;
  if (p.src) {
    return `<figure class="placed${editable ? " editable" : ""}" data-pid="${p.id}" style="${style}">
      <img src="${esc(p.src)}" alt="${esc(p.alt || "")}" draggable="false">
      ${editable ? `<div class="placed-tools">
        <button data-pact="bg" title="Remove background">✂</button>
        <button data-pact="del" title="Remove image">✕</button>
      </div><div class="placed-resize" data-pact="resize"></div>` : ""}
      ${(p.caption || editable) ? cap : ""}
    </figure>`;
  }
  // unfilled placeholder
  return `<figure class="placed placeholder${editable ? " editable" : ""}" data-pid="${p.id}" style="${style}">
    <div class="placed-ph" ${editable ? 'data-pact="fill"' : ""}>
      <div class="ph-icon">🖼</div>
      <div class="placed-ph-text">${esc(p.suggestion || "Add image")}</div>
      ${editable ? '<div class="placed-ph-hint">click to fill</div>' : ""}
    </div>
    ${editable ? `<div class="placed-tools"><button data-pact="del" title="Remove">✕</button></div><div class="placed-resize" data-pact="resize"></div>` : ""}
    ${(p.caption || editable) ? cap : ""}
  </figure>`;
}

function freeLayerHTML(s, mode) {
  const items = (s.placed || []).map(p => placedImageHTML(p, mode)).join("");
  const addBtn = mode === "edit" ? `<button class="free-add" data-act="free-add">＋ Add image</button>` : "";
  return `<div class="s-free-layer">${items}${addBtn}</div>`;
}

// Builds the inner HTML of a slide. `mode`: "edit" | "static".
function slideHTML(s, mode) {
  const editable = mode === "edit" ? 'contenteditable="true"' : "";
  const titlePh = s.layout === "quote" ? "Quote text…" : "Slide title…";
  const title = `<div class="s-title" ${editable} data-field="title" data-ph="${titlePh}">${esc(s.title)}</div>`;
  const subPh = s.layout === "quote" ? "Attribution…" : "Subtitle…";
  const subtitle = `<div class="s-subtitle" ${editable} data-field="subtitle" data-ph="${subPh}">${esc(s.subtitle)}</div>`;
  const bullets = `<ul class="s-bullets" ${editable} data-field="bullets" data-ph="Add bullet points…">${
    s.bullets.map(b => `<li>${esc(b)}</li>`).join("")
  }</ul>`;

  // kicker (eyebrow) — shown on content layouts; editable always in edit mode
  const kickerShown = s.layout !== "title" && (mode === "edit" || s.kicker);
  const kicker = kickerShown
    ? `<div class="s-kicker" ${editable} data-field="kicker" data-ph="Kicker / note…">${esc(s.kicker)}</div>`
    : "";

  // takeaway — big bottom line; editable on content layouts
  const takeawayShown = s.layout !== "title" && (mode === "edit" || s.takeaway);
  const takeaway = takeawayShown
    ? `<div class="s-takeaway" ${editable} data-field="takeaway" data-ph="Key takeaway…">${esc(s.takeaway)}</div>`
    : "";

  let imgzone = "";
  if (s.layout === "bullets-image" || s.layout === "image") {
    if (s.image && s.image.src) {
      imgzone = `<div class="s-imgzone">
        <img class="s-img" src="${esc(s.image.src)}" alt="${esc(s.image.alt || "")}">
        ${mode === "edit" ? `<div class="img-tools">
          <button data-act="img-bg" title="Remove the image's background">✂ Background</button>
          <button data-act="img-remove" title="Remove image">✕ Remove</button>
        </div>` : ""}
      </div>`;
    } else {
      imgzone = `<div class="s-imgzone"><div class="img-placeholder" data-act="img-pick">
        <div class="ph-icon">🖼</div>
        ${s.imageSuggestion ? `<div class="ph-suggest">Suggested image: ${esc(s.imageSuggestion)}</div>` : `<div class="ph-suggest">Add your own image here</div>`}
        ${mode === "edit" ? `<div class="ph-actions">
            <button type="button" data-act="img-web">🔍 Find on the web</button>
            <button type="button" data-act="img-upload">Upload</button>
            <button type="button" data-act="img-url">URL</button>
          </div>
          <div class="ph-hint">…or drag &amp; drop / paste an image, or pick one from the library →</div>` : ""}
      </div></div>`;
    }
  }

  if (s.layout === "free") {
    // freeform "poster" slide: title top-left, scattered captioned images, takeaway bottom
    return freeLayerHTML(s, mode)
      + `<div class="s-free-head">${title}${kicker}</div>`
      + takeaway;
  }

  let body;
  switch (s.layout) {
    case "title":   body = title + subtitle; break;
    case "section": body = title + kicker; break;
    case "quote":   body = title + subtitle; break;
    case "bullets": body = title + kicker + bullets; break;
    case "bullets-image":
      body = title + kicker + `<div class="s-body">${bullets}${imgzone}</div>`; break;
    case "image":   body = title + kicker + imgzone; break;
    default:        body = title + kicker + bullets;
  }
  return body + takeaway;
}

function renderSlideInto(el, s, mode) {
  el.className = "slide l-" + s.layout + (mode === "static" ? " static" : "");
  el.dataset.theme = project.theme;
  el.innerHTML = slideHTML(s, mode);
  applyBackground(el);
  if (mode === "edit") wireFreeLayer(el, s);
}

/* ----------------------- free image placement ----------------------- */

// Loose scatter slots (in % of slide) used when auto-placing images.
const SCATTER = [
  { x: 58, y: 12 }, { x: 77, y: 38 }, { x: 56, y: 56 }, { x: 8, y: 44 },
  { x: 30, y: 60 }, { x: 80, y: 12 }, { x: 38, y: 26 }, { x: 14, y: 24 },
];
let placeTarget = null; // id of a placeholder awaiting a source, or null = append new

function findPlaced(s, id) { return (s.placed || []).find(p => p.id === id); }

function nextSlot(s) { return SCATTER[(s.placed || []).length % SCATTER.length]; }

function addPlaced(s, fields) {
  const slot = nextSlot(s);
  const p = Object.assign({ id: uid(), src: null, alt: "", caption: "", suggestion: "", x: slot.x, y: slot.y, w: 22 }, fields);
  s.placed.push(p);
  return p;
}

// Route an incoming image onto a free-layout slide.
function placeOnFree(s, src, name) {
  if (placeTarget) {
    const p = findPlaced(s, placeTarget);
    placeTarget = null;
    if (p) { p.src = src; if (!p.alt) p.alt = name || ""; return; }
  }
  addPlaced(s, { src, alt: name || "" });
}

function openFillPlaced(s, p) {
  placeTarget = p.id;
  openWebSidebar(p.suggestion || p.caption || "");
}

function wireFreeLayer(el, s) {
  const layer = el.querySelector(".s-free-layer");
  if (!layer) return;

  layer.querySelectorAll(".placed").forEach((fig) => {
    const id = fig.dataset.pid;
    const p = findPlaced(s, id);
    if (!p) return;

    // tool buttons (delete / background)
    fig.querySelectorAll(".placed-tools [data-pact]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const act = btn.dataset.pact;
        if (act === "del") {
          s.placed = s.placed.filter(q => q.id !== id);
          renderCanvas(); renderFilmstrip(); persist();
        } else if (act === "bg" && p.src) {
          openBgRemover(p.src, (cut) => {
            p.src = cut; renderCanvas(); renderFilmstrip(); persist();
            toast("Background removed.");
          });
        }
      });
    });

    // drag to move, or drag the corner to resize; a click (no drag) on an
    // empty placeholder opens the fill flow.
    fig.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".placed-cap, .placed-tools")) return;
      const isResize = !!e.target.closest(".placed-resize");
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY;
      const x0 = p.x, y0 = p.y, w0 = p.w;
      let moved = false;
      try { fig.setPointerCapture(e.pointerId); } catch { /* ignore */ }

      const move = (ev) => {
        const ddx = ev.clientX - sx, ddy = ev.clientY - sy;
        if (Math.abs(ddx) + Math.abs(ddy) > 3) moved = true;
        if (isResize) {
          p.w = Math.max(6, Math.min(80, w0 + ddx / rect.width * 100));
          fig.style.width = p.w + "%";
        } else {
          p.x = Math.max(-6, Math.min(96, x0 + ddx / rect.width * 100));
          p.y = Math.max(-6, Math.min(94, y0 + ddy / rect.height * 100));
          fig.style.left = p.x + "%";
          fig.style.top = p.y + "%";
        }
      };
      const up = () => {
        fig.removeEventListener("pointermove", move);
        fig.removeEventListener("pointerup", up);
        try { fig.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        if (moved) { persist(); renderFilmstrip(); }
        else if (!p.src) openFillPlaced(s, p);
      };
      fig.addEventListener("pointermove", move);
      fig.addEventListener("pointerup", up);
    });
  });
}

function fitCanvas() {
  const pad = 24;
  const w = canvasWrapEl.clientWidth - pad * 2;
  const h = canvasWrapEl.clientHeight - pad;
  const scale = Math.max(0.1, Math.min(w / 960, h / 540, 1.15));
  canvasEl.style.transform = `scale(${scale})`;
  canvasEl.style.transformOrigin = "center center";
  canvasEl.style.flexShrink = "0";
}

function renderCanvas() {
  const s = slide();
  renderSlideInto(canvasEl, s, "edit");
  notesEl.value = s.notes || "";
  layoutSelect.value = s.layout;
  themeSelect.value = project.theme;
  syncBgControls();
  slidePosEl.textContent = `Slide ${current + 1} of ${project.slides.length}`;
  fitCanvas();
}

function renderFilmstrip() {
  filmstripEl.innerHTML = "";
  project.slides.forEach((s, i) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.index = i;
    if (i === current) li.classList.add("active");

    const num = document.createElement("span");
    num.className = "thumb-num";
    num.textContent = i + 1;

    const box = document.createElement("div");
    box.className = "thumb-box";
    const mini = document.createElement("div");
    renderSlideInto(mini, s, "static");
    box.appendChild(mini);
    li.append(num, box);
    filmstripEl.appendChild(li);

    // scale thumb to its box width
    requestAnimationFrame(() => {
      const scale = box.clientWidth / 960;
      mini.style.transform = `scale(${scale})`;
    });

    li.addEventListener("click", () => selectSlide(i));

    // drag to reorder
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/slide-index", String(i));
      e.dataTransfer.effectAllowed = "move";
    });
    li.addEventListener("dragover", (e) => {
      if (e.dataTransfer.types.includes("text/slide-index")) {
        e.preventDefault();
        li.classList.add("dragover");
      }
    });
    li.addEventListener("dragleave", () => li.classList.remove("dragover"));
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("dragover");
      const from = Number(e.dataTransfer.getData("text/slide-index"));
      const to = i;
      if (Number.isNaN(from) || from === to) return;
      const [moved] = project.slides.splice(from, 1);
      project.slides.splice(to, 0, moved);
      current = to;
      renderAll();
      persist();
    });
  });
}

function renderSources() {
  sourceCountEl.textContent = project.sources.length;
  sourceListEl.innerHTML = "";
  if (!project.sources.length) {
    const d = document.createElement("li");
    d.className = "empty-note";
    d.style.listStyle = "none";
    d.textContent = "No sources yet. Upload files or paste text, then generate a deck.";
    sourceListEl.appendChild(d);
    return;
  }
  project.sources.forEach((src) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>📄</span>
      <span class="src-name" title="${esc(src.name)}">${esc(src.name)}
        <div class="src-meta">${src.content.split(/\s+/).filter(Boolean).length.toLocaleString()} words</div>
      </span>
      <button class="src-del" title="Remove source">✕</button>`;
    li.querySelector(".src-del").addEventListener("click", () => {
      project.sources = project.sources.filter(x => x.id !== src.id);
      renderSources();
      persist();
    });
    sourceListEl.appendChild(li);
  });
}

function renderLibrary() {
  libraryEl.innerHTML = "";
  if (!project.library.length) {
    const d = document.createElement("div");
    d.className = "empty-note";
    d.textContent = "No images yet. Add some — they're yours, never AI-generated.";
    libraryEl.appendChild(d);
    d.style.gridColumn = "1 / -1";
    return;
  }
  project.library.forEach((img) => {
    const item = document.createElement("div");
    item.className = "lib-item";
    item.title = img.name + " — click to place on current slide";
    item.innerHTML = `<img src="${esc(img.src)}" alt="${esc(img.name)}">
      <button class="lib-cut" title="Remove background (saves as a copy)">✂</button>
      <button class="lib-del" title="Remove from library">✕</button>`;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".lib-del, .lib-cut")) return;
      setSlideImage(img.src, img.name, false);
    });
    item.querySelector(".lib-del").addEventListener("click", () => {
      project.library = project.library.filter(x => x.id !== img.id);
      renderLibrary();
      persist();
    });
    item.querySelector(".lib-cut").addEventListener("click", () => {
      openBgRemover(img.src, (cut) => {
        project.library.push({ id: uid(), name: img.name + " (cut-out)", src: cut });
        renderLibrary(); persist();
        toast("Cut-out added to your library — click it to place it on the slide.");
      });
    });
    libraryEl.appendChild(item);
  });
}

function renderAll() {
  deckTitleEl.value = project.title;
  renderSources();
  renderFilmstrip();
  renderCanvas();
  renderLibrary();
}

function selectSlide(i) {
  current = Math.max(0, Math.min(i, project.slides.length - 1));
  renderFilmstrip();
  renderCanvas();
}

/* ============================================================
   IN-CANVAS EDITING
   ============================================================ */

function commitEditable(el) {
  const s = slide();
  // placed-image caption
  if (el.dataset.pid) {
    const p = findPlaced(s, el.dataset.pid);
    if (p) { p.caption = el.innerText.replace(/\n+/g, " ").trim(); persist(); renderFilmstrip(); }
    return;
  }
  const field = el.dataset.field;
  if (!field) return;
  if (field === "bullets") {
    const items = [...el.querySelectorAll("li")].map(li => li.textContent.trim());
    // contenteditable may flatten to plain text lines if the user deletes the list
    const fallback = el.innerText.split("\n").map(t => t.trim());
    s.bullets = (items.length ? items : fallback).filter(Boolean);
  } else if (field === "kicker") {
    s.kicker = el.innerText.replace(/\n{3,}/g, "\n").trim(); // allow short line breaks
  } else {
    s[field] = el.innerText.replace(/\n+/g, " ").trim();
  }
  persist();
  // refresh thumbnail only (avoid re-rendering canvas mid-edit)
  renderFilmstrip();
}

canvasEl.addEventListener("blur", (e) => {
  if (e.target.matches("[contenteditable]")) commitEditable(e.target);
}, true);

canvasEl.addEventListener("keydown", (e) => {
  // keep Enter inside single-line fields from inserting newlines
  if (e.key === "Enter" && e.target.matches('[data-field="title"],[data-field="subtitle"],[data-field="takeaway"],.placed-cap')) {
    e.preventDefault();
    e.target.blur();
  }
});

canvasEl.addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  if (act === "free-add") {
    placeTarget = null;
    openWebSidebar();
  } else if (act === "img-pick" || act === "img-web") {
    openWebSidebar();
  } else if (act === "img-upload") {
    $("#file-image").click();
  } else if (act === "img-url") {
    $("#imgurl-input").value = "";
    $("#imgurl-modal").showModal();
  } else if (act === "img-remove") {
    slide().image = null;
    renderCanvas(); renderFilmstrip(); persist();
  } else if (act === "img-bg") {
    const img = slide().image;
    if (!img) return;
    openBgRemover(img.src, (cut) => {
      slide().image = { src: cut, alt: img.alt || "" };
      renderCanvas(); renderFilmstrip(); persist();
      toast("Background removed.");
    });
  }
});

// drag & drop an image file straight onto the placeholder / canvas
canvasEl.addEventListener("dragover", (e) => {
  if ([...e.dataTransfer.items].some(i => i.kind === "file" && i.type.startsWith("image/"))) {
    e.preventDefault();
    canvasEl.querySelector(".img-placeholder")?.classList.add("dragover");
  }
});
canvasEl.addEventListener("dragleave", () => {
  canvasEl.querySelector(".img-placeholder")?.classList.remove("dragover");
});
canvasEl.addEventListener("drop", async (e) => {
  const file = [...e.dataTransfer.files].find(f => f.type.startsWith("image/"));
  if (!file) return;
  e.preventDefault();
  canvasEl.querySelector(".img-placeholder")?.classList.remove("dragover");
  await insertImageFile(file);
});

// paste an image anywhere (when not typing in a text field)
document.addEventListener("paste", async (e) => {
  const inText = e.target.closest?.("input, textarea, [contenteditable]");
  if (inText) return;
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
  if (!item) return;
  e.preventDefault();
  const file = item.getAsFile();
  if (file) await insertImageFile(file, "Pasted image");
});

notesEl.addEventListener("input", () => {
  slide().notes = notesEl.value;
  persist();
});

layoutSelect.addEventListener("change", () => {
  const s = slide();
  const next = layoutSelect.value;
  // carry an existing single image into the free layer so it isn't lost
  if (next === "free" && s.image && s.image.src && !(s.placed || []).some(p => p.src === s.image.src)) {
    addPlaced(s, { src: s.image.src, alt: s.image.alt || "" });
    s.image = null;
  }
  s.layout = next;
  renderCanvas(); renderFilmstrip(); persist();
});

themeSelect.addEventListener("change", () => {
  project.theme = themeSelect.value;
  renderCanvas(); renderFilmstrip(); persist();
});

$("#bg-select").addEventListener("change", (e) => {
  const v = e.target.value;
  if (v === "__image") {
    $("#bg-select").value = project.background?.image ? "__image" : (project.background?.preset || "none");
    $("#file-bg").click();
    return;
  }
  project.background = { preset: v, image: null };
  renderCanvas(); renderFilmstrip(); persist();
});

$("#file-bg").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      const src = await fileToDataURL(file);
      project.background = { preset: "none", image: src };
      project.frame = project.frame; // unchanged
      renderCanvas(); renderFilmstrip(); persist();
      toast("Background image applied to every slide.");
    } catch { toast("Couldn't read that image."); }
  }
  e.target.value = "";
  syncBgControls();
});

$("#frame-toggle").addEventListener("change", (e) => {
  project.frame = e.target.checked;
  renderCanvas(); renderFilmstrip(); persist();
});

$("#btn-oceanic").addEventListener("click", () => {
  // One-click "polished dark serif lecture" look.
  project.theme = "oceanic";
  project.background = { preset: "oceanic", image: null };
  project.frame = true;
  renderAll(); persist();
  toast("Applied the Oceanic style to the whole deck.");
});

function syncBgControls() {
  const bg = project.background || { preset: "none" };
  $("#bg-select").value = bg.image ? "__image" : (bg.preset || "none");
  $("#frame-toggle").checked = !!project.frame;
}

deckTitleEl.addEventListener("input", () => {
  project.title = deckTitleEl.value;
  persist();
});

window.addEventListener("resize", fitCanvas);

/* ----------------------- image insertion ----------------------- */

async function insertImageFile(file, fallbackName) {
  try {
    const src = await fileToDataURL(file);
    setSlideImage(src, fallbackName || file.name || "image", true);
  } catch {
    toast("Couldn't read that image file.");
  }
}

function libAdd(src, name) {
  if (!project.library.some(x => x.src === src)) {
    project.library.push({ id: uid(), name: name || "image", src });
  }
}

function setSlideImage(src, name, addToLibrary) {
  const s = slide();
  // On a free (poster) slide, images are scattered cut-outs, not a single zone.
  if (s.layout === "free") {
    placeOnFree(s, src, name);
    if (addToLibrary) libAdd(src, name);
    renderCanvas(); renderFilmstrip(); renderLibrary(); persist();
    return;
  }
  // image only renders on image layouts — switch automatically if needed
  if (s.layout !== "image" && s.layout !== "bullets-image") {
    s.layout = s.bullets.length ? "bullets-image" : "image";
  }
  s.image = { src, alt: name || "" };
  if (addToLibrary) libAdd(src, name);
  renderCanvas(); renderFilmstrip(); renderLibrary(); persist();
}

$("#file-image").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) await insertImageFile(file);
  e.target.value = "";
});

$("#btn-lib-add").addEventListener("click", () => $("#file-lib-image").click());
$("#file-lib-image").addEventListener("change", async (e) => {
  for (const file of e.target.files) {
    try {
      const src = await fileToDataURL(file);
      project.library.push({ id: uid(), name: file.name, src });
    } catch { /* skip unreadable file */ }
  }
  renderLibrary(); persist();
  e.target.value = "";
});

$("#imgurl-add").addEventListener("click", async () => {
  const url = $("#imgurl-input").value.trim();
  if (!url) return;
  $("#imgurl-modal").close();
  // Try to embed for self-contained exports; fall back to hot-linking on CORS failure.
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("not an image");
    const src = await fileToDataURL(blob);
    setSlideImage(src, url.split("/").pop() || "web image", true);
  } catch {
    setSlideImage(url, url.split("/").pop() || "web image", true);
    toast("Couldn't embed the image (blocked by the site) — linked it instead.");
  }
});

/* ============================================================
   SLIDES: add / duplicate / delete
   ============================================================ */

$("#btn-add-slide").addEventListener("click", () => {
  project.slides.splice(current + 1, 0, newSlide("bullets"));
  selectSlide(current + 1);
  persist();
});

$("#btn-dup-slide").addEventListener("click", () => {
  const copy = JSON.parse(JSON.stringify(slide()));
  copy.id = uid();
  project.slides.splice(current + 1, 0, copy);
  selectSlide(current + 1);
  persist();
});

$("#btn-del-slide").addEventListener("click", () => {
  if (project.slides.length === 1) {
    project.slides = [newSlide("title")];
    current = 0;
  } else {
    project.slides.splice(current, 1);
    current = Math.min(current, project.slides.length - 1);
  }
  renderAll(); persist();
});

/* ============================================================
   SOURCES
   ============================================================ */

$("#btn-add-source-file").addEventListener("click", () => $("#file-source").click());
$("#file-source").addEventListener("change", async (e) => {
  for (const file of e.target.files) {
    try {
      const text = await readFileText(file);
      project.sources.push({ id: uid(), name: file.name, content: text });
    } catch {
      toast(`Couldn't read ${file.name}`);
    }
  }
  renderSources(); persist();
  e.target.value = "";
});

$("#btn-add-source-paste").addEventListener("click", () => {
  $("#paste-title").value = "";
  $("#paste-content").value = "";
  $("#paste-modal").showModal();
});

$("#paste-add").addEventListener("click", () => {
  const content = $("#paste-content").value.trim();
  if (!content) { toast("Paste some text first."); return; }
  const name = $("#paste-title").value.trim() || `Pasted text ${project.sources.length + 1}`;
  project.sources.push({ id: uid(), name, content });
  $("#paste-modal").close();
  renderSources(); persist();
});

/* ============================================================
   GENERATION
   ============================================================ */

$("#btn-generate").addEventListener("click", () => {
  $("#gen-status").hidden = true;
  $("#gen-engine").value = settings.apiKey ? "claude" : "offline";
  $("#generate-modal").showModal();
});

$("#gen-go").addEventListener("click", async () => {
  const opts = {
    focus: $("#gen-focus").value.trim(),
    audience: $("#gen-audience").value.trim(),
    tone: $("#gen-tone").value,
    count: Math.max(3, Math.min(30, Number($("#gen-count").value) || 10)),
    language: $("#gen-language").value.trim() || "English",
    engine: $("#gen-engine").value,
  };

  if (!project.sources.length && !opts.focus) {
    showGenStatus("Add at least one source (or a focus prompt) first.", true);
    return;
  }
  if (opts.engine === "claude" && !settings.apiKey) {
    showGenStatus("No API key set. Add one in Settings, or switch to the built-in outliner.", true);
    return;
  }

  const btn = $("#gen-go");
  btn.disabled = true;
  showGenStatus(opts.engine === "claude"
    ? "Generating with Claude… this can take a minute."
    : "Building outline from your sources…");

  try {
    const deck = opts.engine === "claude"
      ? await generateWithClaude(opts)
      : generateOffline(opts);
    applyGeneratedDeck(deck);
    $("#generate-modal").close();
    toast(`Generated ${project.slides.length} slides — now drop in your own images.`);
  } catch (err) {
    showGenStatus("Generation failed: " + (err?.message || err), true);
  } finally {
    btn.disabled = false;
  }
});

function showGenStatus(msg, isError) {
  const el = $("#gen-status");
  el.hidden = false;
  el.textContent = msg;
  el.classList.toggle("error", !!isError);
}

function combinedSources(maxChars = 150000) {
  let out = "";
  for (const s of project.sources) {
    out += `\n\n===== SOURCE: ${s.name} =====\n${s.content}`;
    if (out.length > maxChars) { out = out.slice(0, maxChars) + "\n[truncated]"; break; }
  }
  return out.trim();
}

// Normalized deck shape -> project slides
function applyGeneratedDeck(deck) {
  project.title = deck.title || project.title || "Untitled presentation";
  const slides = [];

  slides.push(Object.assign(newSlide("title"), {
    title: deck.title || "Untitled presentation",
    subtitle: deck.subtitle || "",
    notes: deck.titleNotes || "",
  }));

  for (const d of deck.slides) {
    const s = newSlide(d.layout || "bullets");
    s.title = d.title || "";
    s.subtitle = d.subtitle || "";
    s.kicker = d.kicker || "";
    s.bullets = (d.bullets || []).slice(0, 7);
    s.takeaway = d.takeaway || "";
    s.notes = d.notes || "";
    s.imageSuggestion = d.imageSuggestion || "";
    // free (poster) layout: turn each suggested image into a scattered placeholder
    if (s.layout === "free" && Array.isArray(d.images)) {
      d.images.slice(0, 6).forEach((im) => {
        addPlaced(s, { suggestion: im.suggestion || "", caption: im.caption || "" });
      });
    }
    slides.push(s);
  }

  project.slides = slides;
  current = 0;
  renderAll();
  persist();
}

/* ---------- engine 1: Claude API ---------- */
// Raw fetch (not the SDK) because this is a zero-build static page with no
// bundler; the key is the user's own and the call goes browser -> Anthropic.

const DECK_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Deck title" },
    subtitle: { type: "string", description: "Deck subtitle or tagline" },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          layout: { type: "string", enum: ["section", "bullets", "bullets-image", "image", "quote", "free"] },
          title: { type: "string" },
          subtitle: { type: "string", description: "Only for quote slides: the attribution" },
          kicker: { type: "string", description: "A short eyebrow note shown under the title (e.g. a definition, date, or sub-point). Use line breaks for 1-3 short lines. Empty if not needed." },
          bullets: { type: "array", items: { type: "string" } },
          takeaway: { type: "string", description: "A single punchy takeaway line anchored to the bottom of the slide. Empty if not needed." },
          notes: { type: "string", description: "Speaker notes for this slide" },
          imageSuggestion: { type: "string", description: "For 'bullets-image' / 'image' layouts: a short description of ONE image the USER could supply. Empty string otherwise." },
          images: {
            type: "array",
            description: "For the 'free' (poster) layout ONLY: 2-5 images the user should supply, scattered around the slide. Each is a placeholder — the user inserts their own picture.",
            items: {
              type: "object",
              properties: {
                suggestion: { type: "string", description: "What image to find/supply (a search-friendly phrase)." },
                caption: { type: "string", description: "Short caption shown under the image. Empty for none." }
              },
              required: ["suggestion", "caption"],
              additionalProperties: false
            }
          }
        },
        required: ["layout", "title", "subtitle", "kicker", "bullets", "takeaway", "notes", "imageSuggestion", "images"],
        additionalProperties: false
      }
    }
  },
  required: ["title", "subtitle", "slides"],
  additionalProperties: false
};

async function generateWithClaude(opts) {
  const system = [
    "You are a presentation designer. Build a clear, visually rich slide deck strictly grounded in the user's source material.",
    "Rules:",
    "- Slides must be concise: max ~6 bullets per slide, each under 12 words.",
    "- Use a short 'kicker' on most content slides — an eyebrow note under the title (a definition, key term, date, or sub-point).",
    "- Use a punchy 'takeaway' line on slides that have a clear single message; it anchors to the bottom of the slide.",
    "- Use 'section' slides to break the deck into chapters when it helps.",
    "- Prefer the 'free' (poster) layout for visually-driven slides: a title, a kicker, a bottom takeaway, and 2-5 scattered images. For each image fill 'images' with a search-friendly suggestion and a short caption. This mirrors a polished lecture-style deck.",
    "- Use 'bullets-image' / 'image' for a single dominant visual; set imageSuggestion.",
    "- EVERY image is a placeholder for the USER's OWN picture. NEVER assume images are generated.",
    "- Use a 'quote' slide if the sources contain a strong quotable line (subtitle = attribution).",
    "- Write helpful speaker notes (2-4 sentences) for every slide.",
    "- Do not invent facts that are not in the sources.",
  ].join("\n");

  const user = [
    `Create a slide deck of about ${opts.count} slides (excluding the title slide) in ${opts.language}.`,
    `Tone: ${opts.tone}.`,
    opts.audience ? `Audience: ${opts.audience}.` : "",
    opts.focus ? `Focus / special instructions: ${opts.focus}` : "",
    "",
    project.sources.length ? "SOURCE MATERIAL:\n" + combinedSources() : "(No sources provided — build the deck from the focus instructions alone.)",
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.model || "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: DECK_SCHEMA } },
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).error?.message || detail; } catch { /* keep statusText */ }
    throw new Error(`API error ${res.status}: ${detail}`);
  }

  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("The model declined this request" +
      (data.stop_details?.explanation ? ": " + data.stop_details.explanation : "."));
  }
  const text = (data.content || []).find(b => b.type === "text")?.text;
  if (!text) throw new Error("Empty response from the model.");
  return JSON.parse(text);
}

/* ---------- engine 2: offline outliner (no AI, no network) ---------- */

function generateOffline(opts) {
  const text = project.sources.map(s => s.content).join("\n\n");
  const title = project.title
    || project.sources[0]?.name.replace(/\.[a-z]+$/i, "")
    || opts.focus.slice(0, 60)
    || "Untitled presentation";

  const slides = [];
  const lines = text.split("\n");

  // Pass 1: markdown headings define structure
  let sec = null;
  const flush = () => { if (sec && (sec.title || sec.body.length)) slides.push(sec); sec = null; };
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      flush();
      sec = { title: h[2].trim(), level: h[1].length, body: [] };
    } else if (line && sec) {
      sec.body.push(line.replace(/^[-*+•]\s*/, ""));
    }
  }
  flush();

  let deckSlides;
  if (slides.length >= 2) {
    deckSlides = slides.map(s => {
      const body = s.body.slice(0, 6).map(b => clip(b, 90));
      return {
        layout: body.length ? "bullets" : "section",
        title: clip(s.title, 80),
        subtitle: "", kicker: "", takeaway: "",
        bullets: body,
        notes: s.body.slice(6).join(" "),
        imageSuggestion: "", images: [],
      };
    });
  } else {
    // Pass 2: no headings — paragraphs become slides
    const paras = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, " ").trim()).filter(p => p.length > 40);
    deckSlides = paras.map(p => {
      const sentences = p.match(/[^.!?]+[.!?]?/g) || [p];
      return {
        layout: "bullets",
        title: clip(sentences[0], 70),
        subtitle: "", kicker: "", takeaway: "",
        bullets: sentences.slice(1, 6).map(t => clip(t.trim(), 90)).filter(Boolean),
        notes: sentences.slice(6).join(" ").trim(),
        imageSuggestion: "", images: [],
      };
    });
  }

  if (!deckSlides.length) {
    throw new Error("Couldn't find enough text in the sources to outline. Try the Claude engine or add richer sources.");
  }

  deckSlides = deckSlides.slice(0, opts.count);

  // Turn some content-heavy slides into image-rich "poster" slides with
  // scattered placeholders + a takeaway, mirroring a polished lecture deck.
  deckSlides.forEach((s, i) => {
    if (s.layout !== "bullets" || s.bullets.length < 2) return;
    if (i % 3 === 1) {
      // poster slide: move a couple of bullets into a bottom takeaway + images
      s.layout = "free";
      s.takeaway = s.bullets[s.bullets.length - 1] || "";
      s.bullets = [];
      const n = 2 + (i % 2); // 2 or 3 images
      s.images = Array.from({ length: n }, (_, k) => ({
        suggestion: `${s.title} — image ${k + 1}`,
        caption: "",
      }));
    } else if (i % 3 === 2) {
      s.layout = "bullets-image";
      s.imageSuggestion = `Your own photo, chart, or diagram illustrating “${s.title}”`;
      s.takeaway = "";
    }
  });

  deckSlides.push({
    layout: "section",
    title: "Thank you",
    subtitle: "", kicker: "", takeaway: "Questions?",
    bullets: [],
    notes: "Wrap up and invite questions.",
    imageSuggestion: "", images: [],
  });

  return { title: clip(title, 80), subtitle: opts.audience ? `For ${opts.audience}` : "", slides: deckSlides };
}

function clip(s, n) {
  s = (s || "").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/* ============================================================
   WEB IMAGE SIDEBAR
   Search keyless, CORS-friendly, openly-licensed image APIs
   (Openverse, Wikimedia Commons) and insert your picks. These
   are real photos/illustrations from the web — never AI art.
   ============================================================ */

const webSidebar = $("#web-sidebar");
const wsResultsEl = $("#ws-results");
const wsQueryEl = $("#ws-query");
let wsResults = [];          // [{id, thumb, full, title, credit}]
const wsSelected = new Set(); // ids, in no particular order; insert uses result order

function openWebSidebar(queryHint) {
  webSidebar.hidden = false;
  const s = slide();
  const suggestion = (queryHint || s.imageSuggestion || s.title || project.title || "").trim();
  if (queryHint !== undefined || (!wsQueryEl.value && suggestion)) {
    // strip our own boilerplate from offline-engine suggestions
    wsQueryEl.value = (queryHint || suggestion)
      .replace(/^Your own photo, chart, or diagram illustrating\s*/i, "")
      .replace(/[“”"]/g, "").slice(0, 80);
  }
  wsQueryEl.focus();
  if (wsQueryEl.value && (!wsResults.length || queryHint)) runWebSearch();
}

function closeWebSidebar() {
  webSidebar.hidden = true;
  placeTarget = null; // drop any pending placeholder target
}

$("#ws-close").addEventListener("click", closeWebSidebar);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !webSidebar.hidden && !presenting && !document.querySelector("dialog[open]")) {
    closeWebSidebar();
  }
});
$("#ws-go").addEventListener("click", runWebSearch);
wsQueryEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); runWebSearch(); }
});

function wsStatus(msg, isError) {
  const el = $("#ws-status");
  if (!msg) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = msg;
  el.classList.toggle("error", !!isError);
}

function stripHTML(s) {
  const d = document.createElement("div");
  d.innerHTML = s || "";
  return d.textContent.trim();
}

async function searchOpenverse(q) {
  const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=24&mature=false`);
  if (!res.ok) throw new Error(`Openverse error ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(r => ({
    id: "ov-" + r.id,
    thumb: r.thumbnail,
    full: r.url,
    title: r.title || "Untitled",
    credit: [r.creator, (r.license || "").toUpperCase()].filter(Boolean).join(" · "),
  }));
}

async function searchWikimedia(q) {
  const u = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrnamespace=6&gsrlimit=24" +
    "&gsrsearch=" + encodeURIComponent("filetype:bitmap " + q) +
    "&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1024";
  const res = await fetch(u);
  if (!res.ok) throw new Error(`Wikimedia error ${res.status}`);
  const data = await res.json();
  return Object.values(data.query?.pages || {}).map(p => {
    const ii = p.imageinfo?.[0];
    if (!ii) return null;
    const md = ii.extmetadata || {};
    return {
      id: "wm-" + p.pageid,
      thumb: ii.thumburl || ii.url,
      full: ii.url,
      title: (p.title || "").replace(/^File:/, "").replace(/\.[^.]+$/, ""),
      credit: [stripHTML(md.Artist?.value), md.LicenseShortName?.value].filter(Boolean).join(" · "),
    };
  }).filter(Boolean);
}

async function runWebSearch() {
  const q = wsQueryEl.value.trim();
  if (!q) { wsStatus("Type something to search for.", true); return; }
  wsSelected.clear();
  updateWsFooter();
  wsResultsEl.innerHTML = "";
  wsStatus("Searching…");
  try {
    const provider = $("#ws-provider").value;
    wsResults = provider === "wikimedia" ? await searchWikimedia(q) : await searchOpenverse(q);
    wsStatus(wsResults.length ? "" : "No results — try different words or the other source.", !wsResults.length);
    renderWsResults();
  } catch (err) {
    wsStatus("Search failed: " + (err?.message || err) + " (are you online?)", true);
  }
}

function renderWsResults() {
  wsResultsEl.innerHTML = "";
  wsResults.forEach((r) => {
    const item = document.createElement("div");
    item.className = "ws-item" + (wsSelected.has(r.id) ? " sel" : "");
    item.title = r.title + (r.credit ? "\n" + r.credit : "");
    item.innerHTML = `<img src="${esc(r.thumb)}" alt="${esc(r.title)}" loading="lazy">
      <div class="ws-check">✓</div>
      <div class="ws-credit">${esc(r.credit || r.title)}</div>`;
    item.addEventListener("click", () => {
      if (wsSelected.has(r.id)) wsSelected.delete(r.id);
      else wsSelected.add(r.id);
      item.classList.toggle("sel", wsSelected.has(r.id));
      updateWsFooter();
    });
    wsResultsEl.appendChild(item);
  });
}

function updateWsFooter() {
  $("#ws-count").textContent = `${wsSelected.size} selected`;
  $("#ws-insert").disabled = !wsSelected.size;
  $("#ws-add-lib").disabled = !wsSelected.size;
}

// Embed for self-contained exports; fall back to the (CORS-friendly)
// thumbnail, then to hot-linking, if the original host blocks us.
async function resultToSrc(r) {
  for (const url of [r.full, r.thumb]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) continue;
      return await fileToDataURL(blob);
    } catch { /* try next */ }
  }
  return r.thumb || r.full;
}

function selectedResults() {
  return wsResults.filter(r => wsSelected.has(r.id));
}

async function withWsBusy(btn, label, fn) {
  const insertBtn = $("#ws-insert"), libBtn = $("#ws-add-lib");
  const old = btn.textContent;
  insertBtn.disabled = libBtn.disabled = true;
  btn.textContent = label;
  try { await fn(); }
  finally {
    btn.textContent = old;
    updateWsFooter();
  }
}

$("#ws-insert").addEventListener("click", () => {
  const picks = selectedResults();
  if (!picks.length) return;
  withWsBusy($("#ws-insert"), "Inserting…", async () => {
    const s = slide();
    const onFree = s.layout === "free";
    let placedCount = 0;
    let first = true;
    for (const r of picks) {
      const src = await resultToSrc(r);
      const name = [r.title, r.credit].filter(Boolean).join(" — ");
      if (onFree) {
        // On a poster slide, scatter every pick as its own captioned cut-out.
        placeOnFree(s, src, r.title || name);
        if (r.title) { const p = s.placed[s.placed.length - 1]; if (p && !p.caption) p.caption = r.title; }
        libAdd(src, name);
        placedCount++;
      } else if (first) {
        setSlideImage(src, name, true);
        first = false;
      } else {
        libAdd(src, name);
      }
    }
    renderCanvas(); renderLibrary(); renderFilmstrip(); persist();
    wsSelected.clear();
    renderWsResults(); updateWsFooter();
    closeWebSidebar();
    if (onFree) {
      toast(`Placed ${placedCount} image${placedCount > 1 ? "s" : ""} on the slide — drag to arrange.`);
    } else {
      toast(picks.length === 1
        ? "Image placed on the slide."
        : `First image placed on the slide — the other ${picks.length - 1} are in your library.`);
    }
  });
});

$("#ws-add-lib").addEventListener("click", () => {
  const picks = selectedResults();
  if (!picks.length) return;
  withWsBusy($("#ws-add-lib"), "Adding…", async () => {
    for (const r of picks) {
      const src = await resultToSrc(r);
      if (!project.library.some(x => x.src === src)) {
        project.library.push({ id: uid(), name: [r.title, r.credit].filter(Boolean).join(" — "), src });
      }
    }
    renderLibrary(); persist();
    wsSelected.clear();
    renderWsResults(); updateWsFooter();
    toast(`${picks.length} image${picks.length > 1 ? "s" : ""} added to your library.`);
  });
});

/* ============================================================
   BACKGROUND REMOVER
   Flood-fills similar colors in from the image edges (plus any
   spots the user clicks) and makes them transparent. Pure
   canvas — runs entirely in the browser, no model downloads.
   ============================================================ */

const bgModal = $("#bg-modal");
const bgCanvas = $("#bg-canvas");
const bgCtx = bgCanvas.getContext("2d", { willReadFrequently: true });
let bgState = null; // {orig: ImageData, seeds: [{x,y}], onApply}

async function openBgRemover(src, onApply) {
  // Canvas pixel access needs a non-tainted image. data:/blob: are safe;
  // for http(s) sources, try refetching into a data URL first.
  let safeSrc = src;
  if (/^https?:/i.test(src)) {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) throw new Error("not an image");
      safeSrc = await fileToDataURL(blob);
    } catch {
      toast("Can't edit this image: its host blocks cross-site access. Download it and re-upload instead.");
      return;
    }
  }

  const img = new Image();
  img.onload = () => {
    const MAX = 1400;
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    bgCanvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    bgCanvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
    bgState = {
      orig: bgCtx.getImageData(0, 0, bgCanvas.width, bgCanvas.height),
      seeds: [],
      onApply,
    };
    bgRecompute();
    bgModal.showModal();
  };
  img.onerror = () => toast("Couldn't load that image for editing.");
  img.src = safeSrc;
}

// Pure mask computation: returns Uint8Array (1 = background, remove).
// Flood-fills from every border pixel plus user seeds; each region grows
// from its own seed's color, so multi-colored backgrounds just need clicks.
function computeBgMask(src, w, h, seeds, tol2) {
  const removed = new Uint8Array(w * h);
  const queue = []; // flat: [pixelIndex, seedR, seedG, seedB, ...]
  const push = (x, y) => {
    const i = y * w + x;
    if (removed[i]) return;
    const p = i * 4;
    queue.push(i, src[p], src[p + 1], src[p + 2]);
    removed[i] = 1;
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  for (const s of seeds) {
    const x = Math.min(w - 1, Math.max(0, s.x));
    const y = Math.min(h - 1, Math.max(0, s.y));
    removed[y * w + x] = 0; // allow re-seeding a pixel already claimed
    push(x, y);
  }

  let head = 0;
  while (head < queue.length) {
    const i = queue[head], sr = queue[head + 1], sg = queue[head + 2], sb = queue[head + 3];
    head += 4;
    const x = i % w, y = (i / w) | 0;
    const tryGrow = (j) => {
      if (removed[j]) return;
      const p = j * 4;
      const dr = src[p] - sr, dg = src[p + 1] - sg, db = src[p + 2] - sb;
      if (dr * dr + dg * dg + db * db <= tol2) {
        removed[j] = 1;
        queue.push(j, sr, sg, sb);
      }
    };
    if (x > 0) tryGrow(i - 1);
    if (x < w - 1) tryGrow(i + 1);
    if (y > 0) tryGrow(i - w);
    if (y < h - 1) tryGrow(i + w);
  }
  return removed;
}

function bgRecompute() {
  if (!bgState) return;
  const { orig, seeds } = bgState;
  const w = orig.width, h = orig.height;
  const src = orig.data;
  const out = new Uint8ClampedArray(src); // copy
  const tol = Number($("#bg-tolerance").value);
  const removed = computeBgMask(src, w, h, seeds, (tol * 2.2) ** 2);

  // apply mask + soften the cut edge a touch
  let count = 0;
  for (let i = 0; i < removed.length; i++) {
    if (removed[i]) { out[i * 4 + 3] = 0; count++; }
  }
  for (let i = 0; i < removed.length; i++) {
    if (removed[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if ((x > 0 && removed[i - 1]) || (x < w - 1 && removed[i + 1]) ||
        (y > 0 && removed[i - w]) || (y < h - 1 && removed[i + w])) {
      out[i * 4 + 3] = Math.min(out[i * 4 + 3], 128);
    }
  }

  bgCtx.putImageData(new ImageData(out, w, h), 0, 0);
  $("#bg-status").textContent = `${Math.round(100 * count / removed.length)}% removed` +
    (bgState.seeds.length ? ` · ${bgState.seeds.length} extra spot${bgState.seeds.length > 1 ? "s" : ""}` : "");
}

let bgDebounce;
$("#bg-tolerance").addEventListener("input", () => {
  clearTimeout(bgDebounce);
  bgDebounce = setTimeout(bgRecompute, 120);
});

bgCanvas.addEventListener("click", (e) => {
  if (!bgState) return;
  const rect = bgCanvas.getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left) * (bgCanvas.width / rect.width));
  const y = Math.round((e.clientY - rect.top) * (bgCanvas.height / rect.height));
  bgState.seeds.push({ x, y });
  bgRecompute();
});

$("#bg-reset").addEventListener("click", () => {
  if (!bgState) return;
  bgState.seeds = [];
  bgRecompute();
});

$("#bg-apply").addEventListener("click", () => {
  if (!bgState) return;
  const dataUrl = bgCanvas.toDataURL("image/png");
  const cb = bgState.onApply;
  bgState = null;
  bgModal.close();
  cb(dataUrl);
});

bgModal.addEventListener("close", () => { bgState = null; });

/* ============================================================
   PRESENT MODE
   ============================================================ */

const presentOverlay = $("#present-overlay");
const presentSlideEl = $("#present-slide");
const presentNotesEl = $("#present-notes");

$("#btn-present").addEventListener("click", startPresenting);

function startPresenting() {
  presenting = true;
  presentIndex = current;
  presentOverlay.hidden = false;
  document.documentElement.requestFullscreen?.().catch(() => {});
  renderPresent();
}

function stopPresenting() {
  presenting = false;
  presentOverlay.hidden = true;
  presentNotesEl.hidden = true;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

function renderPresent() {
  const s = project.slides[presentIndex];
  renderSlideInto(presentSlideEl, s, "static");
  const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540) * 0.96;
  presentSlideEl.style.transform = `scale(${scale})`;
  presentNotesEl.textContent = s.notes || "(no notes for this slide)";
  $("#present-counter").textContent = `${presentIndex + 1} / ${project.slides.length}`;
}

presentOverlay.addEventListener("click", () => {
  if (presentIndex < project.slides.length - 1) { presentIndex++; renderPresent(); }
});

document.addEventListener("keydown", (e) => {
  if (!presenting) return;
  if (e.key === "Escape") { stopPresenting(); }
  else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
    if (presentIndex < project.slides.length - 1) { presentIndex++; renderPresent(); }
  } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
    if (presentIndex > 0) { presentIndex--; renderPresent(); }
  } else if (e.key.toLowerCase() === "s") {
    presentNotesEl.hidden = !presentNotesEl.hidden;
  } else if (e.key === "Home") { presentIndex = 0; renderPresent(); }
  else if (e.key === "End") { presentIndex = project.slides.length - 1; renderPresent(); }
});

window.addEventListener("resize", () => { if (presenting) renderPresent(); });
document.addEventListener("fullscreenchange", () => {
  if (presenting && !document.fullscreenElement) stopPresenting();
});

/* ============================================================
   SAVE / OPEN / NEW / EXPORT
   ============================================================ */

function download(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function safeName() {
  return (project.title || "presentation").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "presentation";
}

$("#btn-new").addEventListener("click", () => {
  if (!confirm("Start a new project? Unsaved changes in the current one will be replaced (it stays in this browser until then).")) return;
  project = newProject();
  current = 0;
  renderAll(); persist();
});

$("#btn-save").addEventListener("click", () => {
  download(safeName() + ".slidecraft.json", JSON.stringify(project, null, 2), "application/json");
});

$("#btn-open").addEventListener("click", () => $("#file-project").click());
$("#file-project").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const p = JSON.parse(await readFileText(file));
    if (!p || !Array.isArray(p.slides)) throw new Error("bad shape");
    project = normalizeProject(p);
    current = 0;
    renderAll(); persist();
    toast("Project loaded.");
  } catch {
    toast("That file doesn't look like a SlideCraft project.");
  }
  e.target.value = "";
});

/* ---------- export menu ---------- */

const exportDropdown = $("#btn-export").parentElement;
$("#btn-export").addEventListener("click", (e) => {
  e.stopPropagation();
  exportDropdown.classList.toggle("open");
});
document.addEventListener("click", () => exportDropdown.classList.remove("open"));

$("#export-json").addEventListener("click", () => {
  download(safeName() + ".slidecraft.json", JSON.stringify(project, null, 2), "application/json");
});

$("#export-pdf").addEventListener("click", () => {
  const area = $("#print-area");
  area.innerHTML = "";
  project.slides.forEach((s) => {
    const page = document.createElement("div");
    page.className = "print-page";
    const sl = document.createElement("div");
    renderSlideInto(sl, s, "static");
    page.appendChild(sl);
    area.appendChild(page);
  });
  window.print();
});

$("#export-html").addEventListener("click", () => {
  download(safeName() + ".html", buildStandaloneHTML(), "text/html");
  toast("Exported. Open the file anywhere — arrow keys to navigate.");
});

function buildStandaloneHTML() {
  // Reuse the live slide markup + the slide-rendering portion of our CSS.
  const slidesHTML = project.slides.map((s) => {
    const el = document.createElement("div");
    renderSlideInto(el, s, "static");
    return `<div class="deck-slide" data-notes="${esc(s.notes || "")}">${el.outerHTML}</div>`;
  }).join("\n");

  const css = extractSlideCSS();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(project.title || "Presentation")}</title>
<style>
${css}
html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif}
.deck-slide{position:fixed;inset:0;display:none;align-items:center;justify-content:center}
.deck-slide.on{display:flex}
.slide{box-shadow:none;border-radius:0;flex-shrink:0}
#hud{position:fixed;bottom:10px;width:100%;text-align:center;color:#94a3b8;font-size:13px;z-index:5}
#notes{position:fixed;bottom:40px;left:50%;transform:translateX(-50%);max-width:720px;width:90vw;max-height:30vh;overflow:auto;background:rgba(15,23,42,.92);color:#e2e8f0;border-radius:10px;padding:12px 16px;font-size:15px;white-space:pre-wrap;display:none;z-index:6}
</style>
</head>
<body>
${slidesHTML}
<div id="notes"></div>
<div id="hud"><span id="ctr"></span> · ← → navigate · S notes</div>
<script>
var i=0,slides=document.querySelectorAll('.deck-slide'),notes=document.getElementById('notes');
function fit(){var sc=Math.min(innerWidth/960,innerHeight/540)*0.97;slides.forEach(function(d){d.querySelector('.slide').style.transform='scale('+sc+')';});}
function show(){slides.forEach(function(d,j){d.classList.toggle('on',j===i);});document.getElementById('ctr').textContent=(i+1)+' / '+slides.length;notes.textContent=slides[i].dataset.notes||'(no notes)';}
addEventListener('keydown',function(e){
if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){i=Math.min(i+1,slides.length-1);show();}
else if(e.key==='ArrowLeft'||e.key==='PageUp'){i=Math.max(i-1,0);show();}
else if(e.key.toLowerCase()==='s'){notes.style.display=notes.style.display==='block'?'none':'block';}
else if(e.key==='Home'){i=0;show();}else if(e.key==='End'){i=slides.length-1;show();}});
addEventListener('click',function(){i=Math.min(i+1,slides.length-1);show();});
addEventListener('resize',fit);fit();show();
<\/script>
</body>
</html>`;
}

// Pull the slide-rendering rules out of our stylesheet so exports match the editor.
function extractSlideCSS() {
  let out = "";
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      const sel = rule.selectorText || "";
      if (/\.slide|\.s-|\.placed|\.img-|\.free-add|\[contenteditable\]/.test(sel)) {
        out += rule.cssText + "\n";
      }
    }
  }
  return out;
}

/* ============================================================
   SETTINGS
   ============================================================ */

$("#btn-settings").addEventListener("click", () => {
  $("#set-apikey").value = settings.apiKey;
  $("#set-model").value = settings.model;
  $("#settings-modal").showModal();
});

$("#set-save").addEventListener("click", () => {
  settings.apiKey = $("#set-apikey").value.trim();
  settings.model = $("#set-model").value;
  saveSettings();
  $("#settings-modal").close();
  toast("Settings saved.");
});

/* ============================================================
   INIT
   ============================================================ */

restore();
renderAll();

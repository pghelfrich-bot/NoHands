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
    theme: "paper",
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
    bullets: [],
    notes: "",
    image: null, // {src, alt}
    imageSuggestion: "",
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

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p && Array.isArray(p.slides) && p.slides.length) project = p;
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

// Builds the inner HTML of a slide. `mode`: "edit" | "static".
function slideHTML(s, mode) {
  const editable = mode === "edit" ? 'contenteditable="true"' : "";
  const title = `<div class="s-title" ${editable} data-field="title" data-ph="${s.layout === "quote" ? "Quote text…" : "Slide title…"}">${esc(s.title)}</div>`;
  const subPh = s.layout === "quote" ? "Attribution…" : "Subtitle…";
  const subtitle = `<div class="s-subtitle" ${editable} data-field="subtitle" data-ph="${subPh}">${esc(s.subtitle)}</div>`;
  const bullets = `<ul class="s-bullets" ${editable} data-field="bullets" data-ph="Add bullet points…">${
    s.bullets.map(b => `<li>${esc(b)}</li>`).join("")
  }</ul>`;

  let imgzone = "";
  if (s.layout === "bullets-image" || s.layout === "image") {
    if (s.image && s.image.src) {
      imgzone = `<div class="s-imgzone">
        <img class="s-img" src="${esc(s.image.src)}" alt="${esc(s.image.alt || "")}">
        ${mode === "edit" ? '<button class="img-remove" data-act="img-remove" title="Remove image">✕ Remove</button>' : ""}
      </div>`;
    } else {
      imgzone = `<div class="s-imgzone"><div class="img-placeholder" data-act="img-pick">
        <div class="ph-icon">🖼</div>
        ${s.imageSuggestion ? `<div class="ph-suggest">Suggested image: ${esc(s.imageSuggestion)}</div>` : `<div class="ph-suggest">Add your own image here</div>`}
        ${mode === "edit" ? `<div class="ph-actions">
            <button type="button" data-act="img-upload">Upload</button>
            <button type="button" data-act="img-url">From URL</button>
          </div>
          <div class="ph-hint">…or drag &amp; drop / paste an image, or pick one from the library →</div>` : ""}
      </div></div>`;
    }
  }

  switch (s.layout) {
    case "title":   return title + subtitle;
    case "section": return title;
    case "quote":   return title + subtitle;
    case "bullets": return title + bullets;
    case "bullets-image":
      return title + `<div class="s-body">${bullets}${imgzone}</div>`;
    case "image":   return title + imgzone;
    default:        return title + bullets;
  }
}

function renderSlideInto(el, s, mode) {
  el.className = "slide l-" + s.layout + (mode === "static" ? " static" : "");
  el.dataset.theme = project.theme;
  el.innerHTML = slideHTML(s, mode);
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
      <button class="lib-del" title="Remove from library">✕</button>`;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".lib-del")) return;
      setSlideImage(img.src, img.name, false);
    });
    item.querySelector(".lib-del").addEventListener("click", () => {
      project.library = project.library.filter(x => x.id !== img.id);
      renderLibrary();
      persist();
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
  const field = el.dataset.field;
  if (!field) return;
  if (field === "bullets") {
    const items = [...el.querySelectorAll("li")].map(li => li.textContent.trim());
    // contenteditable may flatten to plain text lines if the user deletes the list
    const fallback = el.innerText.split("\n").map(t => t.trim());
    s.bullets = (items.length ? items : fallback).filter(Boolean);
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
  if (e.key === "Enter" && e.target.matches('[data-field="title"],[data-field="subtitle"]')) {
    e.preventDefault();
    e.target.blur();
  }
});

canvasEl.addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  if (act === "img-upload" || act === "img-pick") {
    if (act === "img-pick" && e.target.closest(".ph-actions")) return;
    $("#file-image").click();
  } else if (act === "img-url") {
    $("#imgurl-input").value = "";
    $("#imgurl-modal").showModal();
  } else if (act === "img-remove") {
    slide().image = null;
    renderCanvas(); renderFilmstrip(); persist();
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
  slide().layout = layoutSelect.value;
  renderCanvas(); renderFilmstrip(); persist();
});

themeSelect.addEventListener("change", () => {
  project.theme = themeSelect.value;
  renderCanvas(); renderFilmstrip(); persist();
});

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

function setSlideImage(src, name, addToLibrary) {
  const s = slide();
  // image only renders on image layouts — switch automatically if needed
  if (s.layout !== "image" && s.layout !== "bullets-image") {
    s.layout = s.bullets.length ? "bullets-image" : "image";
  }
  s.image = { src, alt: name || "" };
  if (addToLibrary && !project.library.some(x => x.src === src)) {
    project.library.push({ id: uid(), name: name || "image", src });
  }
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
    s.bullets = (d.bullets || []).slice(0, 7);
    s.notes = d.notes || "";
    s.imageSuggestion = d.imageSuggestion || "";
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
          layout: { type: "string", enum: ["section", "bullets", "bullets-image", "image", "quote"] },
          title: { type: "string" },
          subtitle: { type: "string", description: "Only for quote slides: the attribution" },
          bullets: { type: "array", items: { type: "string" } },
          notes: { type: "string", description: "Speaker notes for this slide" },
          imageSuggestion: { type: "string", description: "A short description of an image the USER could supply for this slide (e.g. 'a photo of your team at the launch event'). Empty string if the slide needs no image." }
        },
        required: ["layout", "title", "subtitle", "bullets", "notes", "imageSuggestion"],
        additionalProperties: false
      }
    }
  },
  required: ["title", "subtitle", "slides"],
  additionalProperties: false
};

async function generateWithClaude(opts) {
  const system = [
    "You are a presentation designer. Build a clear, well-structured slide deck strictly grounded in the user's source material.",
    "Rules:",
    "- Slides must be concise: max ~6 bullets per slide, each under 12 words.",
    "- Use 'section' slides to break the deck into chapters when it helps.",
    "- Use 'bullets-image' or 'image' layouts where a visual would genuinely help, and write imageSuggestion as a concrete description of a photo/diagram the presenter could supply themselves. NEVER assume images will be generated — they are placeholders for the user's own pictures.",
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
    deckSlides = slides.map(s => ({
      layout: s.body.length ? "bullets" : "section",
      title: clip(s.title, 80),
      subtitle: "",
      bullets: s.body.slice(0, 6).map(b => clip(b, 90)),
      notes: s.body.slice(6).join(" "),
      imageSuggestion: "",
    }));
  } else {
    // Pass 2: no headings — paragraphs become slides
    const paras = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, " ").trim()).filter(p => p.length > 40);
    deckSlides = paras.map(p => {
      const sentences = p.match(/[^.!?]+[.!?]?/g) || [p];
      return {
        layout: "bullets",
        title: clip(sentences[0], 70),
        subtitle: "",
        bullets: sentences.slice(1, 6).map(t => clip(t.trim(), 90)).filter(Boolean),
        notes: sentences.slice(6).join(" ").trim(),
        imageSuggestion: "",
      };
    });
  }

  if (!deckSlides.length) {
    throw new Error("Couldn't find enough text in the sources to outline. Try the Claude engine or add richer sources.");
  }

  deckSlides = deckSlides.slice(0, opts.count);

  // suggest user images on a few content-heavy slides
  deckSlides.forEach((s, i) => {
    if (s.layout === "bullets" && s.bullets.length >= 2 && i % 3 === 1) {
      s.layout = "bullets-image";
      s.imageSuggestion = `Your own photo, chart, or diagram illustrating “${s.title}”`;
    }
  });

  deckSlides.push({
    layout: "section",
    title: "Thank you",
    subtitle: "",
    bullets: [],
    notes: "Wrap up and invite questions.",
    imageSuggestion: "",
  });

  return { title: clip(title, 80), subtitle: opts.audience ? `For ${opts.audience}` : "", slides: deckSlides };
}

function clip(s, n) {
  s = (s || "").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

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
    project = Object.assign(newProject(), p);
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
      if (/^\.slide|^\s*\.slide|\.s-imgzone|\.img-placeholder|\[contenteditable\]/.test(sel)
        || sel.includes(".slide")) {
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

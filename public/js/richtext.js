// Formázott szöveg (a szerkesztő Word-szerű mezői) – a szerkesztő és a honlap is ezt használja.
// Csak a megengedett formázás marad meg: félkövér, dőlt, aláhúzott, áthúzott, felső/alsó index,
// bekezdés (igazítással), sortörés, tabulátor, felsorolás, számozott lista, link.
// Minden más (betűtípus, méret, szín, szkript, Word belső jelölései) kimarad.

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const INLINE = { B: "b", STRONG: "b", I: "i", EM: "i", U: "u", INS: "u", S: "s", STRIKE: "s", DEL: "s", SUP: "sup", SUB: "sub" };
const BLOCK = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "SECTION", "ARTICLE", "HEADER", "FOOTER", "TABLE", "TR", "FIGURE"]);
const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "IFRAME", "OBJECT", "EMBED", "NOSCRIPT", "HEAD", "TITLE", "META", "LINK", "SVG", "MATH", "IMG", "VIDEO", "AUDIO", "CANVAS", "INPUT", "BUTTON", "SELECT", "TEXTAREA"]);
const ALIGN = new Set(["center", "right", "justify"]);

function styleOf(el) {
  const st = (el.getAttribute && el.getAttribute("style")) || "";
  const get = (p) => { const m = st.match(new RegExp("(?:^|;)\\s*" + p + "\\s*:\\s*([^;]+)", "i")); return m ? m[1].trim().toLowerCase() : ""; };
  const fw = get("font-weight");
  return {
    bold: fw === "bold" || fw === "bolder" || +fw >= 600,
    italic: get("font-style") === "italic",
    underline: /underline/.test(get("text-decoration") + get("text-decoration-line")),
    strike: /line-through/.test(get("text-decoration") + get("text-decoration-line")),
    sup: get("vertical-align") === "super", sub: get("vertical-align") === "sub",
    align: get("text-align") || (el.getAttribute && (el.getAttribute("align") || "").toLowerCase()) || "",
    tabs: +((st.match(/mso-tab-count\s*:\s*(\d+)/i) || [])[1] || 0),
  };
}
const wrapStyle = (st, html) => {
  if (!html) return html;
  if (st.sub) html = `<sub>${html}</sub>`;
  if (st.sup) html = `<sup>${html}</sup>`;
  if (st.strike) html = `<s>${html}</s>`;
  if (st.underline) html = `<u>${html}</u>`;
  if (st.italic) html = `<i>${html}</i>`;
  if (st.bold) html = `<b>${html}</b>`;
  return html;
};
const safeHref = (h) => { h = String(h || "").trim(); return /^(https?:|mailto:)/i.test(h) ? h : ""; };

function inlineOf(node) {
  let out = "";
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { out += esc(c.nodeValue.replace(/[\r\n]+/g, " ")); continue; }
    if (c.nodeType !== 1) continue;
    const tag = c.tagName.toUpperCase();
    if (SKIP.has(tag)) continue;
    const st = styleOf(c);
    if (st.tabs) { out += "\t".repeat(st.tabs); continue; }   // Word tabulátor
    if (tag === "BR") { out += "<br>"; continue; }
    if (BLOCK.has(tag) || tag === "LI" || tag === "UL" || tag === "OL") { const inner = inlineOf(c); if (inner) out += (out && !out.endsWith("<br>") ? "<br>" : "") + inner; continue; }
    const inner = inlineOf(c);
    if (tag === "A") { const href = safeHref(c.getAttribute("href")); out += href && inner ? `<a href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : inner; continue; }
    const t = INLINE[tag];
    out += t ? `<${t}>${wrapStyle({ ...st, bold: st.bold && t !== "b", italic: st.italic && t !== "i" }, inner)}</${t}>` : wrapStyle(st, inner);
  }
  return out;
}

// a teljes szöveg: bekezdések és listák sorozata
export function sanitize(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  const out = [];
  let run = null;   // bekezdésen kívüli szöveg
  const flushRun = () => { if (run !== null) { out.push(`<p>${run || "<br>"}</p>`); run = null; } };
  const para = (el) => {
    const st = styleOf(el);
    const inner = inlineOf(el);
    const a = ALIGN.has(st.align) ? ` style="text-align:${st.align}"` : "";
    out.push(`<p${a}>${wrapStyle({ ...st, align: "" }, inner) || "<br>"}</p>`);
  };
  const list = (el) => {
    const tag = el.tagName.toUpperCase() === "OL" ? "ol" : "ul";
    const items = [...el.children].filter((c) => c.tagName.toUpperCase() === "LI").map((li) => `<li>${inlineOf(li) || "<br>"}</li>`);
    if (items.length) out.push(`<${tag}>${items.join("")}</${tag}>`);
  };
  const walk = (node) => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { if (c.nodeValue.trim() || run !== null) run = (run || "") + esc(c.nodeValue.replace(/[\r\n]+/g, " ")); continue; }
      if (c.nodeType !== 1) continue;
      const tag = c.tagName.toUpperCase();
      if (SKIP.has(tag)) continue;
      if (tag === "UL" || tag === "OL") { flushRun(); list(c); continue; }
      if (BLOCK.has(tag)) {
        flushRun();
        // a Word gyakran blokkokat ágyaz egymásba: a belső blokkok külön bekezdések
        if ([...c.children].some((k) => BLOCK.has(k.tagName.toUpperCase()) || /^(UL|OL)$/i.test(k.tagName))) walk(c); else para(c);
        continue;
      }
      if (tag === "BR") { run = (run || "") + "<br>"; continue; }
      const wrap = document.createElement("div");
      wrap.append(c.cloneNode(true));
      run = (run || "") + inlineOf(wrap);
    }
  };
  walk(doc.body);
  flushRun();
  // a záró üres bekezdések elhagyása
  while (out.length && out[out.length - 1] === "<p><br></p>") out.pop();
  return out.join("");
}

// sima szöveg → formázott: minden sor egy bekezdés (versnél), vagy üres sorral elválasztott bekezdések (prózánál)
export function plainToHtml(text, { verse = false } = {}) {
  const t = String(text ?? "").replace(/\r\n?/g, "\n");
  if (!t.trim()) return "";
  if (verse) return t.split("\n").map((l) => `<p>${esc(l) || "<br>"}</p>`).join("");
  return t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

// formázott → sima szöveg (pl. kereséshez, előnézethez)
export function htmlToPlain(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  doc.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
  doc.querySelectorAll("p, li").forEach((p) => p.append("\n"));
  return doc.body.textContent.replace(/\n+$/, "");
}

// The collector: measures a page as the browser drew it, in the page itself. Plain browser script, no imports:
// the same file runs in CI (Playwright, any engine) and, later, on a real device (the site opened with a flag).
//   window.__dsCollect(cfg) → { text, colours, radii, borders, shadows, effects, layers, icons, images, ratios,
//                               edges, typo, components, interact, overflow }
//   window.__dsHead()       → the page's head and outline (title, metas, headings, anchors, links)
// cfg (from design/checks/site.config.mjs): { skip, align, cards, typeObjects }
// Everything is read from computed styles and boxes; nothing on the page is changed.
(() => {
  const r2 = (v) => Math.round(v * 100) / 100;
  const cls = (e) => (typeof e.className === "string" ? e.className : e.className?.baseVal || "").trim().split(/\s+/).filter(Boolean);
  // a short, stable name for an element: tag.firstClass, prefixed by the nearest classed ancestor when it has none
  const nm = (e) => { const c = cls(e)[0]; return e.tagName.toLowerCase() + (c ? "." + c : ""); };
  const name = (e) => {
    if (cls(e).length) return nm(e);
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) if (cls(a).length) return nm(a) + " " + nm(e);
    return nm(e);
  };
  const styles = new Map();
  const cs = (e) => { let s = styles.get(e); if (!s) { s = getComputedStyle(e); styles.set(e, s); } return s; };
  const shownCache = new Map();
  const shown = (e) => {
    if (shownCache.has(e)) return shownCache.get(e);
    let ok = true;
    if (!e.getClientRects().length) ok = false;
    else { const s = cs(e); if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) ok = false; else if (e.parentElement && e.parentElement !== document.documentElement) ok = shown(e.parentElement); }
    shownCache.set(e, ok); return ok;
  };
  const rgba = (v) => { const m = String(v).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? r2(p[3]) : 1]; };
  const key = (c) => c.join(",");
  const add = (map, k, sel, extra) => { let x = map.get(k); if (!x) { x = { n: 0, where: [], ...extra }; map.set(k, x); } x.n++; if (x.where.length < 6 && !x.where.includes(sel)) x.where.push(sel); return x; };

  window.__dsCollect = async (cfg = {}) => {
    styles.clear(); shownCache.clear();
    const skip = cfg.skip ? (e) => !!e.closest(cfg.skip) : () => false;
    const all = [...document.body.querySelectorAll("*")].filter((e) => !/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|BR|WBR)$/.test(e.tagName) && shown(e));
    const page = all.filter((e) => !skip(e));
    const vw = document.documentElement.clientWidth, vh = innerHeight, sy = scrollY;
    const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const texts = page.filter((e) => ownText(e) && !(e.closest("svg")));

    // ── type: every text holder's size, family, weight, line height
    const text = new Map(), objects = cfg.typeObjects ? (e) => !!e.closest(cfg.typeObjects) : () => false;
    for (const e of texts) {
      const s = cs(e), px = r2(parseFloat(s.fontSize));
      add(text, `${px}|${s.fontFamily.split(",")[0].replace(/['"]/g, "")}|${s.fontWeight}|${s.lineHeight === "normal" ? "normal" : r2(parseFloat(s.lineHeight) / parseFloat(s.fontSize))}`, name(e), { px, family: s.fontFamily.split(",")[0].replace(/['"]/g, ""), weight: +s.fontWeight || s.fontWeight, lh: s.lineHeight === "normal" ? "normal" : r2(parseFloat(s.lineHeight) / parseFloat(s.fontSize)), object: objects(e) });
    }

    // ── colours: text, backgrounds, borders, outlines, the paint of icons
    const colours = new Map();
    const paint = (v, prop, e) => { const c = rgba(v); if (!c || c[3] === 0) return; add(colours, key(c), name(e), { rgba: c, props: {} }).props[prop] = (colours.get(key(c)).props[prop] || 0) + 1; };
    for (const e of page) {
      const s = cs(e);
      if (ownText(e)) paint(s.color, "text", e);
      paint(s.backgroundColor, "background", e);
      for (const side of ["Top", "Right", "Bottom", "Left"]) if (parseFloat(s["border" + side + "Width"]) > 0 && s["border" + side + "Style"] !== "none") { paint(s["border" + side + "Color"], "border", e); break; }
      if (e instanceof SVGElement && !(e instanceof SVGSVGElement)) { if (s.fill !== "none") paint(s.fill, "icon fill", e); if (s.stroke !== "none") paint(s.stroke, "icon stroke", e); }
    }
    // ── fills: which kinds of background each block has (solid, alpha, gradient, picture)
    const fills = new Map();
    for (const e of page) {
      const s = cs(e), img = s.backgroundImage, c = rgba(s.backgroundColor);
      const kind = /gradient\(/.test(img) ? "gradient" : /url\(/.test(img) ? "picture" : c && c[3] > 0 ? (c[3] < 1 ? "alpha" : "solid") : null;
      if (kind) add(fills, kind, name(e), { kind });
    }

    // ── shape: radii and borders
    const radii = new Map(), borders = new Map();
    for (const e of page) {
      const s = cs(e), r = parseFloat(s.borderTopLeftRadius);
      if (r > 0) { const b = e.getBoundingClientRect(); add(radii, name(e) + "|" + r2(r), name(e), { sel: name(e), px: r2(r), pill: r >= Math.min(b.width, b.height) / 2 - 0.5, w: r2(b.width), h: r2(b.height) }); }
      for (const side of ["Top", "Left"]) { const w = parseFloat(s["border" + side + "Width"]); if (w > 0 && s["border" + side + "Style"] !== "none") { add(borders, String(r2(w)), name(e), { px: r2(w) }); break; } }
    }

    // ── effects: shadows, blur and glass, blend modes, see-through boxes, canvases, video
    const shadows = new Map(), effects = [];
    for (const e of all) {
      const s = cs(e);
      if (s.boxShadow !== "none") add(shadows, s.boxShadow, name(e), { value: s.boxShadow, prop: "box-shadow" });
      if (s.textShadow !== "none") add(shadows, s.textShadow, name(e), { value: s.textShadow, prop: "text-shadow" });
      const bd = s.backdropFilter || s.webkitBackdropFilter;
      const f = [];
      if (bd && bd !== "none") f.push(["backdrop-filter", bd]);
      if (s.filter !== "none") f.push(["filter", s.filter]);
      if (s.mixBlendMode !== "normal") f.push(["mix-blend-mode", s.mixBlendMode]);
      if (+s.opacity < 1 && +s.opacity > 0) f.push(["opacity", s.opacity]);
      if (e.tagName === "CANVAS" || e.tagName === "VIDEO") { const b = e.getBoundingClientRect(); f.push([e.tagName.toLowerCase(), `${Math.round(b.width)}×${Math.round(b.height)}`]); }
      for (const [prop, value] of f) effects.push({ sel: name(e), prop, value: String(value).slice(0, 90) });
    }

    // ── layers: fixed and sticky things, z-indexes, how many stacking contexts
    const layers = [], zs = new Map(); let contexts = 0;
    for (const e of page) {
      const s = cs(e), pos = s.position, z = s.zIndex;
      const ctx = (pos !== "static" && z !== "auto") || pos === "fixed" || pos === "sticky" || +s.opacity < 1 || s.transform !== "none" || s.filter !== "none" || s.isolation === "isolate" || /transform|opacity/.test(s.willChange) || s.mixBlendMode !== "normal" || /paint|strict|content/.test(s.contain);
      if (ctx) contexts++;
      if (pos === "fixed" || pos === "sticky" || (pos !== "static" && z !== "auto")) {
        if (z !== "auto") add(zs, z, name(e), { z: +z });
        if (pos === "fixed" || pos === "sticky") layers.push({ sel: name(e), pos, z });
      }
    }

    // ── icons: inline svg outside the drawings: size, stroke as drawn, whether it takes the text's colour, line-up
    const icons = [];
    for (const svg of document.querySelectorAll("svg")) {
      if (!shown(svg) || skip(svg) || svg.closest(cfg.notIcons || ".art")) continue;
      const b = svg.getBoundingClientRect(); if (b.width < 4 || b.width > 96) continue;
      const vb = svg.viewBox?.baseVal, k = vb && vb.width ? b.width / vb.width : 1;
      const own = rgba(cs(svg).color), shapes = [...svg.querySelectorAll("path, circle, rect, line, polyline, polygon, ellipse")];
      let inherits = true, stroke = null;
      for (const p of shapes) {
        const s = cs(p);
        for (const v of [s.fill, s.stroke]) { const c = rgba(v); if (c && c[3] > 0 && own && key(c) !== key(own)) inherits = false; }
        if (s.stroke !== "none" && parseFloat(s.strokeWidth) > 0) stroke = r2(parseFloat(s.strokeWidth) * k);
      }
      // the line-up with the text next to it (a button or a link with a label): centre of the icon vs the text's line
      let off = null;
      const host = svg.parentElement, label = host && [...host.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()) || host?.querySelector(":scope > span");
      if (label) { const rg = document.createRange(); rg.selectNodeContents(label); const t = rg.getClientRects()[0]; if (t && Math.abs((t.top + t.bottom) / 2 - (b.top + b.bottom) / 2) < t.height) off = r2((b.top + b.bottom) / 2 - (t.top + t.bottom) / 2); }
      icons.push({ sel: name(svg.closest("[class]") || svg) + (svg.dataset.icon ? ` [${svg.dataset.icon}]` : ""), w: r2(b.width), h: r2(b.height), stroke, inherits, off });
    }

    // ── images: what was delivered against what is drawn (× the screen's pixel ratio), format, loading, alt. With a
    // srcset, naturalWidth is in CSS px (the file's width ÷ the density it was picked for), so the file itself is opened
    // again (from the cache) to read its real size.
    const dpr = devicePixelRatio || 1, images = [], real = new Map();
    const size = (src) => real.get(src) || real.set(src, new Promise((ok) => { const im = new Image(); const done = () => ok([im.naturalWidth, im.naturalHeight]); im.onload = done; im.onerror = () => ok(null); setTimeout(() => ok(null), 4000); im.src = src; })).get(src);
    for (const img of document.querySelectorAll("img")) {
      if (!img.getClientRects().length) continue;
      const b = img.getBoundingClientRect(), src = img.currentSrc || img.src || "";
      const data = src.startsWith("data:"), vector = data ? /svg/.test(src.slice(0, 30)) : /\.svg(\?|$)/i.test(src);
      const file = data || vector ? null : await size(src);
      const fit = cs(img).objectFit, need = b.width * dpr, needH = b.height * dpr;
      // object-fit: cover crops: the file must cover the larger of the two demands
      const k = file && need ? r2(fit === "cover" ? Math.min(file[0] / need, file[1] / Math.max(needH, 1)) : file[0] / need) : null;
      images.push({ sel: name(img), src: data ? "(inline)" : src.split("/").pop().split("?")[0], format: vector ? "svg" : (src.match(/\.(avif|webp|png|jpe?g|gif)(\?|$)/i) || [, "?"])[1].toLowerCase(),
        w: r2(b.width), h: r2(b.height), file, k, alt: img.hasAttribute("alt") ? img.alt : null, art: !!img.closest(cfg.notIcons || ".art"),
        loading: img.getAttribute("loading") || "eager", priority: img.getAttribute("fetchpriority") || "auto", first: b.top + sy < vh, shown: shown(img) });
    }

    // ── ratios: of pictures, canvases, videos and cards
    const ratios = [];
    const media = page.filter((e) => /^(IMG|VIDEO|CANVAS|PICTURE)$/.test(e.tagName) || (cfg.cards && e.matches(cfg.cards)));
    for (const e of [...media, ...[...document.querySelectorAll("canvas")].filter(shown)]) {
      const b = e.getBoundingClientRect(); if (b.width < 24 || b.height < 24) continue;
      ratios.push({ sel: name(e), w: r2(b.width), h: r2(b.height), k: r2(b.width / b.height), css: cs(e).aspectRatio !== "auto" ? cs(e).aspectRatio : null });
    }

    // ── alignment: the left and right edges of the page's blocks, lines they share, and the near misses
    const moving = (e) => { for (let a = e; a && a !== document.body; a = a.parentElement) { const s = cs(a); if (s.transform !== "none" || s.position === "sticky" || s.position === "fixed") return true; } return false; };
    const edgeEls = cfg.align ? page.filter((e) => e.matches(cfg.align) && !moving(e)) : [];
    const lefts = [], rights = [];
    for (const e of edgeEls) {
      const b = e.getBoundingClientRect(), s = cs(e);
      // a text block's own text may be narrower (centred, right-aligned): its box is what lines up
      if (b.width < 8) continue;
      lefts.push({ x: r2(b.left), sel: name(e) }); rights.push({ x: r2(b.right), sel: name(e) });
    }
    const near = [];
    const cluster = (pts, side) => {
      const xs = pts.map((p) => p.x).sort((a, b) => a - b), lines = [];
      for (const x of xs) { const l = lines.at(-1); if (l && x - l.at(-1) <= 0.5) l.push(x); else lines.push([x]); }
      const real = lines.filter((l) => l.length >= 3).map((l) => ({ x: r2(l.reduce((a, b) => a + b, 0) / l.length), n: l.length }));
      for (const p of pts) {
        if (real.some((l) => Math.abs(l.x - p.x) <= 0.5)) continue;
        const l = real.filter((l) => Math.abs(l.x - p.x) > 0.5 && Math.abs(l.x - p.x) <= 3).sort((a, b) => b.n - a.n)[0];
        if (l) near.push({ sel: p.sel, side, x: p.x, line: l.x, d: r2(p.x - l.x), shared: l.n });
      }
      return real;
    };
    const edges = { lines: { left: cluster(lefts, "left"), right: cluster(rights, "right") }, near: [], n: edgeEls.length };
    const seen = new Set();
    for (const x of near) { const k = x.sel + x.side + x.line; if (!seen.has(k)) { seen.add(k); edges.near.push(x); } }

    // ── typography: lines of paragraphs, characters per line, the last line
    const typo = [];
    for (const e of page.filter((e) => e.matches(cfg.paragraphs || "p, li") && ownText(e) && !objects(e))) {
      const rows = new Map(); let lastTop = null;
      const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n; (n = walker.nextNode()); ) {
        const t = n.textContent; let i = 0;
        for (const word of t.split(/(\s+)/)) {
          if (word.trim()) {
            const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + word.length);
            const r = rg.getClientRects()[0];
            if (r) { const top = Math.round(r.top); const row = [...rows.keys()].find((k) => Math.abs(k - top) < 4) ?? top; const x = rows.get(row) || { chars: 0, words: [] }; x.chars += word.length + 1; x.words.push(word); rows.set(row, x); lastTop = row; }
          }
          i += word.length;
        }
      }
      if (rows.size < 2) continue;
      const lines = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
      const last = lines.at(-1);
      typo.push({ sel: name(e), lines: lines.length, cpl: lines.map((l) => l.chars - 1), last: { chars: last.chars - 1, words: last.words.length, text: last.words.join(" ").slice(0, 40) }, lang: e.closest("[lang]")?.lang || "" });
    }

    // ── components: blocks named the BEM way (a class with __parts): how many, which variants, do copies differ?
    const blocks = new Map();
    for (const e of page) for (const c of cls(e)) {
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(c) || !e.querySelector(`[class*="${c}__"]`)) continue;
      const mods = cls(e).filter((m) => m.startsWith(c + "--")).sort().join(" ");
      const s = cs(e), b = e.getBoundingClientRect();
      const sig = [s.paddingTop, s.paddingLeft, s.borderTopLeftRadius, s.backgroundColor, s.fontSize, s.display].join("|");
      let x = blocks.get(c); if (!x) { x = { name: c, n: 0, variants: {}, }; blocks.set(c, x); }
      x.n++;
      const v = (x.variants[mods || "—"] ||= { n: 0, sigs: {} }); v.n++; v.sigs[sig] = (v.sigs[sig] || 0) + 1;
    }
    const components = [...blocks.values()].map((b) => ({ name: b.name, n: b.n, variants: Object.entries(b.variants).map(([m, v]) => ({ mods: m, n: v.n, looks: Object.keys(v.sigs).length, sigs: Object.keys(v.sigs).slice(0, 4) })) }));

    // ── interaction: the transitions of links and buttons (one hover timing), and their tap size
    const interact = new Map();
    for (const e of page.filter((e) => e.matches("a[href], button, [role=button], summary"))) {
      const s = cs(e), d = s.transitionDuration.split(",").map((x) => parseFloat(x) * (x.includes("ms") ? 1 : 1000)), p = s.transitionProperty.split(",").map((x) => x.trim());
      const hover = p.map((x, i) => [x, d[i % d.length]]).filter(([x, t]) => t > 0 && /all|color|background|border|opacity|box-shadow/.test(x)).map(([, t]) => t);
      add(interact, hover.length ? String(Math.max(...hover)) : "none", name(e), { ms: hover.length ? Math.max(...hover) : 0 });
    }

    return {
      vw, vh, dpr, n: page.length,
      text: [...text.values()], colours: [...colours.values()], fills: [...fills.values()], radii: [...radii.values()], borders: [...borders.values()],
      shadows: [...shadows.values()], effects, layers, z: [...zs.values()], contexts, icons, images, ratios, edges, typo, components,
      interact: [...interact.values()], overflow: Math.max(0, document.documentElement.scrollWidth - vw),
    };
  };

  window.__dsHead = () => {
    const meta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.content ?? null;
    const link = (r) => document.querySelector(`link[rel~="${r}"]`)?.getAttribute("href") ?? null;
    const heads = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => ({ level: +h.tagName[1], text: (h.getAttribute("aria-label") || h.textContent).trim().replace(/\s+/g, " ").slice(0, 60), shown: shown(h) }));
    const anchors = [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")).filter((h) => h.length > 1);
    const links = [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))];
    return {
      title: document.title, lang: document.documentElement.lang, description: meta("description"), robots: meta("robots"), viewport: meta("viewport"),
      themeColor: meta("theme-color"), canonical: link("canonical"), icon: link("icon"), appleIcon: link("apple-touch-icon"), manifest: link("manifest"),
      og: { title: meta("og:title"), description: meta("og:description"), image: meta("og:image"), url: meta("og:url"), type: meta("og:type") },
      twitter: meta("twitter:card"), headings: heads,
      anchors: anchors.map((h) => ({ href: h, ok: !!document.getElementById(decodeURIComponent(h.slice(1))) })), links,
      landmarks: { main: document.querySelectorAll("main").length, nav: document.querySelectorAll("nav").length, header: document.querySelectorAll("header").length, footer: document.querySelectorAll("footer").length },
      imagesNoAlt: [...document.querySelectorAll("img:not([alt])")].length,
    };
  };
})();

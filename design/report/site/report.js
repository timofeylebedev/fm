/* The review page of the Flow Medium system: everything shown comes from window.REPORT (data.js, written by
   design/report/build-site.mjs from the repo). Pages, by the address's hash:
     #needs          what needs Tim: failing rules, decisions whose value moved, questions (with answer buttons that
                     copy a line for a chat with Claude), warnings, what fixed itself; from the checks (design/checks)
     #history        every deploy of main, measured: failures, shares, weight
     #system/<tab>   the system as it is now, in tabs (colour, type, space, layout, effects, motion, icons &
                     pictures, components, behaviour, page health, responsive, blocks, grammar, decisions), each with
                     the checks of its areas; things new since the baseline round are marked "new"
     #typesetter     what build/typeset does, with a demo running the real code (window.Typeset, typeset.js)
     #round-<n>      one review round: its findings, its changes, its pictures
   No module scripts and no fetch, so the page also opens straight from the folder (file://). */
(() => {
"use strict";
const D = window.REPORT, S = D.system, TS = window.Typeset;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const PAL = ["#38bdf8", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#facc15", "#fb7185", "#22d3ee", "#a3e635", "#fb923c", "#c084fc", "#2dd4bf", "#e879f9", "#93c5fd", "#fcd34d", "#86efac"];
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem("fm-report:" + k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fm-report:" + k, JSON.stringify(v)); } catch (e) {} },
};
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const SINCE = `since ${D.meta.sinceLabel}`;
const newPill = (it, title) => it && (it.isNew || it.was || it.changed)
  ? `<span class="pill new" title="${esc(title || (it.isNew ? "new " + SINCE : "changed " + SINCE))}">${it.isNew ? "new" : "changed"}</span>` : "";

/* ── the tooltip ── */
const tip = $("#tip");
const showTip = (e, html) => {
  tip.innerHTML = html; tip.hidden = false;
  const pad = 14, r = tip.getBoundingClientRect();
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
  tip.style.left = Math.max(4, x) + "px"; tip.style.top = Math.max(4, y) + "px";
};
const hideTip = () => { tip.hidden = true; };

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Blocks: the typed blocks of data.json (the rounds and the measured parts of the system)
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const B = {};
const PILL = { done: "done", good: "done", checked: "done", differently: "x", written: "x", new: "x", decision: "x", check: "q", open: "q", implicit: "q", exception: "q", answered: "x", bad: "bad", failed: "bad" };
const pill = (t) => t ? `<span class="pill ${PILL[t] || "q"}">${esc(t)}</span>` : "";
B.stats = (b) => el("div", "grid3", b.items.map((h) => `<div class="box"><div class="stat">${esc(h.n)}<small>${esc(h.unit || "")}</small></div><p>${h.text || ""}</p></div>`).join(""));
B.list = (b) => el("ul", "plain", b.items.map((x) => `<li>${x}</li>`).join(""));
B.html = (b) => el("div", "prose", b.html);
B.pre = (b) => el("details", "", `<summary>${esc(b.summary || "Output")}</summary><pre class="out">${esc(b.text || "")}</pre>`);
B.grid = (b) => { const g = el("div", b.cols === 2 ? "grid2 two" : "grid2"); b.blocks.forEach((x) => g.appendChild(render(x))); return g; };
B.box = (b) => { const box = el("div", "box"); if (b.title) box.appendChild(el("h3", "", b.title)); if (b.html) box.appendChild(el("div", "prose", b.html)); (b.blocks || []).forEach((x) => box.appendChild(render(x))); return box; };
B.cards = (b) => el("div", b.cols === 2 ? "grid2 two" : "grid2", b.items.map((g) => `<div class="box"><h3>${esc(g.title)}</h3><p>${g.html || ""}</p></div>`).join(""));
B.rules = (b) => el("div", "rules", b.items.map((r) => `<div class="rule"><span class="${r.ok ? "ok" : "no"}">${r.ok ? "✓" : "✗"}</span><div><b>${esc(r.title)}</b><p>${esc(r.how || "")}</p></div><span class="n">${r.n != null ? r.n + " checked" : ""}</span></div>`).join(""));
B.table = (b) => {
  const t = el("div", "tbl");
  const head = `<thead><tr>${b.columns.map((c) => `<th${c.num ? ' class="num"' : ""}>${esc(c.label)}</th>`).join("")}</tr></thead>`;
  const body = b.rows.map((row) => row.group != null ? `<tr><td class="group" colspan="${b.columns.length}">${esc(row.group)}</td></tr>`
    : `<tr>${row.map((cell, i) => { const c = b.columns[i] || {}; const v = c.pill ? pill(cell) : cell == null ? "" : cell; return `<td class="${c.num ? "num" : ""} ${c.muted ? "what" : ""}">${v}</td>`; }).join("")}</tr>`).join("");
  t.innerHTML = `<table class="${b.stack ? "stack-sm" : ""}">${head}<tbody>${body}</tbody></table>`;
  return t;
};
B.changes = (b) => B.table({ stack: true, columns: [{ label: b.head ? b.head[0] : "Your comment", muted: true }, { label: b.head ? b.head[1] : "What was done" }, { label: "", pill: true }],
  rows: b.groups.flatMap((g) => [{ group: g.section }, ...g.items.map((c) => [esc(c.ask), c.done, c.tag])]) });
B.decisions = (b) => B.table({ stack: true, columns: [{ label: "Decision" }, { label: "What", muted: true }, { label: "Why", muted: true }],
  rows: b.items.map((d) => [`<code>${esc(d.id)}</code><br>${pill(d.kind)}${d.isNew ? " " + pill("new") : ""}`, esc(d.what), `${esc(d.why || "")}<br><span class="note">${esc(d.decided || "")}</span>`]) });

/* pictures: a sideways row; each opens in the viewer */
const LB = { items: [], at: 0, from: null };
B.shots = (b) => {
  const wrap = el("div");
  wrap.innerHTML = `<div class="controls">${b.label ? `<h3 style="margin:0">${esc(b.label)}</h3>` : "<span></span>"}<div class="rowbtns"><button type="button" data-d="-1" aria-label="Previous pictures">←</button><button type="button" data-d="1" aria-label="Next pictures">→</button></div></div>${b.note ? `<p class="sub" style="margin-bottom:12px">${b.note}</p>` : ""}<div class="shots"></div>`;
  const row = $(".shots", wrap), base = LB.items.length;
  LB.items.push(...b.items);
  row.innerHTML = b.items.map((s, i) => `<figure class="shot"><button type="button" class="img" data-i="${base + i}" aria-label="Open: ${esc(s.title)}"><img src="${esc(s.src)}" alt="${esc(s.title)}" loading="lazy"></button><figcaption class="cap"><b>${esc(s.title)}</b><span>${s.text || ""}</span></figcaption></figure>`).join("");
  row.addEventListener("click", (e) => { const x = e.target.closest("button.img"); if (x) lbOpen(+x.dataset.i, x); });
  $$(".rowbtns button", wrap).forEach((x) => x.addEventListener("click", () => row.scrollBy({ left: +x.dataset.d * Math.min(row.clientWidth * 0.9, 620), behavior: calm() ? "auto" : "smooth" })));
  return wrap;
};
const lb = $("#lb");
const lbShow = (i) => { LB.at = (i + LB.items.length) % LB.items.length; const s = LB.items[LB.at]; $("#lb-img").src = s.src; $("#lb-img").alt = s.title; $("#lb-cap").innerHTML = `<b>${esc(s.title)}</b>${s.text || ""}`; };
const behind = (on) => ["#main", "#side", ".mbar", ".skip"].forEach((q) => { const n = $(q); if (n) n.inert = on; });
const lbOpen = (i, from) => { LB.from = from; lbShow(i); lb.hidden = false; behind(true); document.body.style.overflow = "hidden"; $("#lb-close").focus(); };
const lbClose = (quiet) => { lb.hidden = true; behind(false); syncSide(); document.body.style.overflow = ""; if (LB.from && !quiet) LB.from.focus(); };
$("#lb-close").addEventListener("click", lbClose);
$("#lb-prev").addEventListener("click", () => lbShow(LB.at - 1));
$("#lb-next").addEventListener("click", () => lbShow(LB.at + 1));
lb.addEventListener("click", (e) => { if (e.target === lb) lbClose(); });
addEventListener("keydown", (e) => { if (lb.hidden) return; if (e.key === "Escape") lbClose(); else if (e.key === "ArrowLeft") lbShow(LB.at - 1); else if (e.key === "ArrowRight") lbShow(LB.at + 1); });

/* relations: paired bars (the ratio of two levels at both ends of the range) */
B.relations = (b) => {
  const rows = b.rows, W = 460, rowH = 30, H = rows.length * rowH + 28, x0 = 150, top = b.max || 1.7, x = (k) => x0 + ((k - 1) / (top - 1)) * (W - x0 - 10);
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Ratios">`;
  s += `<line x1="${x(b.min)}" x2="${x(b.min)}" y1="4" y2="${H - 20}" stroke="${css("--warn")}" stroke-dasharray="3 3"/><text x="${x(b.min)}" y="${H - 6}" fill="${css("--warn")}" font-size="10.5" text-anchor="middle">×${b.min} least</text>`;
  rows.forEach((r, i) => {
    const y = 6 + i * rowH;
    s += `<text x="0" y="${y + 15}" fill="${css("--muted")}" font-size="11.5">${esc(r.label)}</text>`;
    s += `<rect x="${x0}" y="${y + 3}" width="${Math.max(1, x(r.k0) - x0)}" height="8" rx="2" fill="${css("--accent")}" opacity="0.55"/>`;
    s += `<rect x="${x0}" y="${y + 13}" width="${Math.max(1, x(r.k1) - x0)}" height="8" rx="2" fill="${css("--accent")}"/>`;
    s += `<text x="${Math.max(x(r.k0), x(r.k1)) + 6}" y="${y + 16}" fill="${css("--faint")}" font-size="10.5">${r.k0.toFixed(2)} · ${r.k1.toFixed(2)}</text>`;
  });
  return el("div", "", s + `</svg><p class="note" style="margin-top:6px">${esc(b.note || "Lighter bar: at the start of the range. Darker: at the end.")}</p>`);
};

/* heightLine: how a screen's height maps to the size it counts as */
B.heightLine = (b) => {
  const W = 460, H = 200, l = 40, bm = 26, t = 10, r = 12, [h0, h1] = b.range || [300, 1100], vmin = b.from.v - 120, vmax = b.to.v + 60;
  const hx = (h) => l + ((h - h0) / (h1 - h0)) * (W - l - r), vy = (v) => H - bm - ((v - vmin) / (vmax - vmin)) * (H - bm - t);
  const k = (b.to.v - b.from.v) / (b.to.h - b.from.h), f = (h) => Math.min(b.to.v, Math.max(b.from.v, b.from.v + (h - b.from.h) * k));
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Screen size by height">`;
  (b.hTicks || [400, 600, 800, 1000]).forEach((h) => { s += `<line x1="${hx(h)}" x2="${hx(h)}" y1="${t}" y2="${H - bm}" stroke="${css("--line")}"/><text x="${hx(h)}" y="${H - 8}" fill="${css("--faint")}" font-size="10.5" text-anchor="middle">${h} tall</text>`; });
  (b.vTicks || [b.from.v, b.to.v]).forEach((v) => { s += `<line x1="${l}" x2="${W - r}" y1="${vy(v)}" y2="${vy(v)}" stroke="${css("--line")}"/><text x="${l - 6}" y="${vy(v) + 4}" fill="${css("--faint")}" font-size="10.5" text-anchor="end">${v}</text>`; });
  let p = ""; for (let h = h0; h <= h1; h += 5) p += (p ? "L" : "M") + hx(h).toFixed(1) + "," + vy(f(h)).toFixed(1) + " ";
  s += `<path d="${p}" fill="none" stroke="${css("--accent")}" stroke-width="2.5"/>`;
  [b.from, b.to].forEach((pt) => { s += `<circle cx="${hx(pt.h)}" cy="${vy(pt.v)}" r="4.5" fill="${css("--accent")}"/>${pt.label ? `<text x="${hx(pt.h) + 8}" y="${vy(pt.v) + (pt === b.from ? -8 : 14)}" fill="${css("--accent-2")}" font-size="10.5">${esc(pt.label)}</text>` : ""}`; });
  (b.examples || []).forEach((e) => { s += `<circle cx="${hx(e.h)}" cy="${vy(f(e.h))}" r="3.5" fill="${css("--fg")}"/><text x="${hx(e.h) + 8}" y="${vy(f(e.h)) + 4}" fill="${css("--muted")}" font-size="10.5">${esc(e.label)}</text>`; });
  return el("div", "", s + `</svg>${b.note ? `<p class="note" style="margin-top:6px">${esc(b.note)}</p>` : ""}`);
};

/* map: rows of segments by screen width, with step lines (and the width the type/space slider is at) */
B.map = (b) => {
  const box = el("div", "map"), rows = b.rows, W = 1100, l = 150, rr = 16, top = 36, rowH = 40, H = top + rows.length * rowH + 30;
  const [x0, x1] = b.range || [320, 1920], X = (v) => l + ((v - x0) / (x1 - x0)) * (W - l - rr);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Responsive map">`;
  (b.ticks || [320, 768, 1024, 1440, 1920]).forEach((v) => { s += `<text x="${X(v)}" y="${H - 10}" fill="${css("--faint")}" font-size="11" text-anchor="middle">${v}</text>`; });
  (b.page || []).forEach((p) => { s += `<line x1="${X(p.w)}" x2="${X(p.w)}" y1="${top - 8}" y2="${H - 24}" stroke="${css("--faint")}" stroke-dasharray="2 3"/><text x="${X(p.w) + 4}" y="${top - 12}" fill="${css("--faint")}" font-size="10.5">${esc(p.label)}</text>`; });
  (b.steps || []).forEach((p) => { s += `<line x1="${X(p.w)}" x2="${X(p.w)}" y1="${top - 22}" y2="${H - 24}" stroke="${css("--accent")}" stroke-width="1.5"/><text x="${X(p.w) + 4}" y="${top - 26}" fill="${css("--accent-2")}" font-size="11" font-weight="600">${esc(p.label)}</text>`; });
  rows.forEach((row, i) => {
    const y = top + i * rowH, hue = row.hue != null ? row.hue : i;
    s += `<text x="0" y="${y + 17}" fill="${css("--fg")}" font-size="12.5" font-weight="500">${esc(row.label)}</text>`;
    row.now.forEach((g, j) => {
      const a = X(Math.max(x0, g.from)), c = X(Math.min(x1, g.to));
      s += `<rect x="${a + 1}" y="${y + 2}" width="${Math.max(1, c - a - 2)}" height="22" rx="4" fill="${PAL[(hue + j) % PAL.length]}" opacity="0.85"><title>${esc(row.label)}: ${esc(g.label)} (${g.from}–${g.to >= x1 ? "…" : g.to})</title></rect>`;
      if (c - a > 44) s += `<text x="${a + 7}" y="${y + 17}" fill="#0b0b0b" font-size="11" font-weight="600">${esc(g.label)}</text>`;
      else if (c - a > 14) s += `<text x="${(a + c) / 2}" y="${y + 17}" fill="#0b0b0b" font-size="11" font-weight="600" text-anchor="middle">${esc(String(g.label).split(" ")[0])}</text>`;
    });
  });
  box.innerHTML = s + "</svg>";
  return box;
};

/* curves: easing graphs; each card plays its curve on a track when pressed or hovered */
const bezier = ([x1, y1, x2, y2]) => (t) => {
  let lo = 0, hi = 1, u = t;
  for (let i = 0; i < 40; i++) { u = (lo + hi) / 2; const x = 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3; if (x < t) lo = u; else hi = u; }
  return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3;
};
const solve = (t, f) => { let lo = 0, hi = 1, u = t; for (let i = 0; i < 40; i++) { u = (lo + hi) / 2; if (f(u) < t) lo = u; else hi = u; } return u; };
const curveFn = (c) => {
  if (c.bez) return bezier(c.bez);
  if (c.fn === "power1.out") return (t) => 1 - (1 - t) ** 2;
  if (c.fn === "power2.out") return (t) => 1 - (1 - t) ** 3;
  if (c.fn === "power2.in") return (t) => t ** 3;
  if (c.fn === "power2.inOut") return (t) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  if (c.fn === "linear") return (t) => t;
  if (c.linear) { const pts = c.linear; return (t) => { for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [bb, vb] = pts[i]; return va + (vb - va) * (t - a) / (bb - a || 1); } return 1; }; }
  if (c.path) return (t) => { for (const g of c.path) if (t <= g[6]) { const u = solve(t, (u) => (1 - u) ** 3 * g[0] + 3 * (1 - u) ** 2 * u * g[2] + 3 * (1 - u) * u * u * g[4] + u ** 3 * g[6]); return (1 - u) ** 3 * g[1] + 3 * (1 - u) ** 2 * u * g[3] + 3 * (1 - u) * u * u * g[5] + u ** 3 * g[7]; } return 1; };
  if (c.wave) return (t) => { for (let i = 1; i < c.wave.length; i++) if (t <= c.wave[i][0]) { const [a, va] = c.wave[i - 1], [bb, vb] = c.wave[i]; const k = (t - a) / (bb - a); return va + (vb - va) * (3 * k * k - 2 * k * k * k); } return 1; };
  return (t) => t;
};
B.curves = (b) => {
  const S0 = 150, pad = 18;
  const box = el("div", "curves");
  b.items.forEach((c) => {
    const f = curveFn(c), ys = []; for (let i = 0; i <= 120; i++) ys.push(f(i / 120));
    const yMin = Math.min(0, ...ys) - 0.05, yMax = Math.max(1, ...ys) + 0.05, peak = Math.max(...ys);
    const X = (t) => pad + t * (S0 - 2 * pad), Y = (v) => S0 - pad - ((v - yMin) / (yMax - yMin)) * (S0 - 2 * pad);
    let p = ""; ys.forEach((v, i) => { p += (i ? "L" : "M") + X(i / 120).toFixed(1) + "," + Y(v).toFixed(1); });
    const card = el("button", "curve");
    card.type = "button";
    card.setAttribute("aria-label", `${c.name}: play the curve`);
    card.innerHTML = `<svg viewBox="0 0 ${S0} ${S0}" aria-hidden="true"><rect x="${pad}" y="${pad}" width="${S0 - 2 * pad}" height="${S0 - 2 * pad}" fill="none" stroke="${css("--line")}"/><line x1="${pad}" x2="${S0 - pad}" y1="${Y(1)}" y2="${Y(1)}" stroke="${css("--faint")}" stroke-dasharray="3 3"/><line x1="${pad}" x2="${S0 - pad}" y1="${Y(0)}" y2="${Y(0)}" stroke="${css("--faint")}" stroke-dasharray="3 3"/><path d="${p}" fill="none" stroke="${css("--accent")}" stroke-width="2.4" stroke-linejoin="round"/>${peak > 1.02 ? `<text x="${S0 - pad}" y="${Y(peak) - 4}" fill="${css("--accent-2")}" font-size="10" text-anchor="end">peak ${peak.toFixed(2)}</text>` : ""}<circle class="pt" r="3.5" cx="${X(0)}" cy="${Y(0)}" fill="${css("--fg")}" opacity="0"/></svg><div class="track"><i></i></div><b>${esc(c.name)} ${newPill(c)}</b><span>${esc(c.use || "")}</span>${c.code ? `<span style="margin-top:4px"><code>${esc(c.code)}</code></span>` : ""}`;
    let raf = 0;
    const play = () => {
      if (calm()) return;
      cancelAnimationFrame(raf);
      const dot = $(".track i", card), pt = $(".pt", card), w = $(".track", card).clientWidth - 18, t0 = performance.now(), T = 1100;
      pt.setAttribute("opacity", "1");
      const step = (now) => {
        const t = clamp((now - t0) / T, 0, 1), v = f(t);
        dot.style.translate = `${v * w}px 0`;
        pt.setAttribute("cx", X(t)); pt.setAttribute("cy", Y(v));
        if (t < 1) raf = requestAnimationFrame(step); else setTimeout(() => pt.setAttribute("opacity", "0"), 500);
      };
      raf = requestAnimationFrame(step);
    };
    card.addEventListener("click", play);
    card.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") play(); });
    box.appendChild(card);
  });
  return box;
};

/* durations: horizontal bars on one scale */
B.durations = (b) => {
  const box = el("div", "chart"), rows = b.rows, W = 1000, l = 300, rr = 30, rowH = 24, H = rows.length * rowH + 40, max = b.max || 2;
  const X = (v) => l + (Math.min(v, max) / max) * (W - l - rr);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Durations">`;
  for (let v = 0; v <= max + 1e-9; v += max / 8) s += `<line x1="${X(v)}" x2="${X(v)}" y1="4" y2="${H - 26}" stroke="${css("--line")}"/><text x="${X(v)}" y="${H - 10}" fill="${css("--faint")}" font-size="11" text-anchor="middle">${r2(v)}s</text>`;
  let last = "";
  rows.forEach((r, i) => {
    const y = 6 + i * rowH, c = r.kind === "loop" ? css("--warn") : r.kind === "scroll" ? css("--faint") : css("--accent");
    s += `<text x="0" y="${y + 14}" fill="${r.group !== last ? css("--fg") : css("--muted")}" font-size="12">${esc(r.name)}${r.changed ? ` <tspan fill="${css("--new")}" font-weight="600">· changed<title>${esc(r.what || "changed " + SINCE)}</title></tspan>` : ""}</text>`; last = r.group;
    s += `<rect x="${X(0)}" y="${y + 3}" width="${Math.max(2, X(r.s) - X(0))}" height="14" rx="3" fill="${c}"><title>${esc(r.name)}: ${r.s}s</title></rect>`;
    if (r.stagger) s += `<rect x="${X(r.s)}" y="${y + 3}" width="${X(r.s + 4 * r.stagger) - X(r.s)}" height="14" rx="3" fill="${c}" opacity="0.35"/>`;
    if (r.s > max) s += `<text x="${X(max) - 8}" y="${y + 14}" fill="#1a1405" font-size="11" font-weight="600" text-anchor="end">${esc(r.label || r.s + "s")}</text>`;
    else s += `<text x="${X(r.s + (r.stagger || 0) * 4) + 6}" y="${y + 14}" fill="${css("--faint")}" font-size="11">${esc(r.label || r.s + "s")}</text>`;
  });
  box.innerHTML = s + `</svg><div class="legend"><span><i style="background:var(--accent)"></i>a transition or an entrance</span><span><i style="background:var(--warn)"></i>a loop (one cycle, cut at ${max}s)</span><span><i style="background:var(--faint)"></i>follows the scroll or the pointer (smoothing)</span></div>`;
  return box;
};

/* picture: the measured sizes, drawn with the zoomable chart */
B.picture = (b) => {
  const wrap = el("div"), groups = Object.assign({ all: { label: "All", keys: [...new Set(Object.values(b.groups).flatMap((g) => g.keys))] } }, b.groups);
  const order = [...(b.order || Object.keys(b.groups)), "all"];
  const axes = b.axes;
  const st = Object.assign({ tab: order[0], axis: Object.keys(axes)[0] }, store.get("picture", {}));
  if (!groups[st.tab]) st.tab = order[0];
  if (!axes[st.axis]) st.axis = Object.keys(axes)[0];
  wrap.innerHTML = `<div class="controls"><div class="seg" role="group" aria-label="Group">${order.map((k) => `<button type="button" data-tab="${k}">${esc(groups[k].label)}</button>`).join("")}</div>
    <div class="seg" role="group" aria-label="Axis">${Object.entries(axes).map(([k, a]) => `<button type="button" data-ax="${k}">${esc(a.label)}</button>`).join("")}</div></div><div class="out"></div>`;
  const out = $(".out", wrap);
  const label = (k) => (b.labels || {})[k] || k;
  const allKeys = groups.all.keys;
  const draw = () => {
    $$("[data-tab]", wrap).forEach((x) => x.setAttribute("aria-pressed", x.dataset.tab === st.tab));
    $$("[data-ax]", wrap).forEach((x) => x.setAttribute("aria-pressed", x.dataset.ax === st.axis));
    const ax = axes[st.axis], xk = ax.x || (st.axis === "width" ? "w" : "h"), rows = b.sweep.after[st.axis] || [];
    const series = groups[st.tab].keys.map((k) => ({ key: k, label: label(k), color: PAL[allKeys.indexOf(k) % PAL.length],
      pts: rows.filter((r) => r[k] != null).map((r) => [r[xk], r[k]]) })).filter((s) => s.pts.length);
    out.innerHTML = "";
    out.appendChild(zchart({ id: "picture-" + st.tab + "-" + st.axis, series, log: st.tab === "all", xNote: ax.note, xTip: ax.tip || "{x}", ticks: ax.ticks, solid: ax.solid }));
  };
  wrap.addEventListener("click", (e) => {
    const tb = e.target.closest("[data-tab]"); if (tb) { st.tab = tb.dataset.tab; store.set("picture", st); draw(); }
    const ab = e.target.closest("[data-ax]"); if (ab) { st.axis = ab.dataset.ax; store.set("picture", st); draw(); }
  });
  draw();
  return wrap;
};

function render(b) {
  const f = B[b.type]; if (!f) return el("div");
  const node = f(b);
  if (b.type === "box" || (!b.title && !b.sub)) return node;
  const wrap = el("div", "block");
  if (b.title) wrap.appendChild(el(b.level === 2 ? "h2" : "h3", "", b.title));
  if (b.sub) wrap.appendChild(el("p", "sub", b.sub));
  wrap.appendChild(node);
  return wrap;
}
const section = (sec, { h = "h2" } = {}) => {
  const s = el("section", "sec"); s.id = sec.id;
  s.appendChild(el(h, "", sec.title));
  if (sec.sub) s.appendChild(el("p", "sub", sec.sub));
  sec.blocks.forEach((b) => s.appendChild(render(b)));
  return s;
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The zoomable chart: many lines over the screen's width (or height). A scale slider and zoom (Ctrl/⌘ + scroll, a
   trackpad pinch, two fingers on a touch screen) magnify both axes around the pointer; drag to move; double-click to
   fit. Every line is named at its right end with its least and greatest value.
   o: { id, series: [{ key, label, color, pts: [[x, y]] }], log, logToggle, xNote, xTip, ticks, solid, marker, unit, height }
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function zchart(o) {
  const root = el("div", "zchart");
  const saved = store.get("chart:" + o.id, {});
  const st = { k: 1, cu: 0.5, cv: 0.5, log: saved.log != null ? saved.log : !!o.log, off: new Set(saved.off || []), hi: null };
  root.innerHTML = `<div class="ctl">
    <label class="zoom">Scale <input type="range" min="1" max="16" step="0.05" value="1" aria-label="Scale of the chart"><output>1×</output></label>
    ${o.logToggle === false ? "" : `<label class="switch"><input type="checkbox" class="log"${st.log ? " checked" : ""}><span></span>Log scale</label>`}
    <button type="button" class="btn fit">Fit</button>
    <span class="hint">${esc(o.xNote ? o.xNote + " · " : "")}Ctrl/⌘ + scroll or pinch to zoom · drag to move · double-click to fit</span></div>
    <div class="plot"><svg role="img" aria-label="${esc(o.series.map((s) => s.label).join(", "))}"></svg></div>
    <div class="legend"></div>`;
  const plot = $(".plot", root), svg = $("svg", plot), slider = $(".zoom input", root), outK = $(".zoom output", root), legend = $(".legend", root);
  const series = o.series.map((s) => { const ys = s.pts.map((p) => p[1]); return { ...s, mn: Math.min(...ys), mx: Math.max(...ys) }; });
  const allX = series.flatMap((s) => s.pts.map((p) => p[0]));
  const fx0 = Math.min(...allX), fx1 = Math.max(...allX);
  let logFloor = 1;                                                      // a value ≤ 0 lies on the floor of a log scale
  const ty = (y) => st.log ? Math.log2(Math.max(y, logFloor)) : y;
  const yExt = () => {
    const vis = series.filter((s) => !st.off.has(s.key)), ys = (vis.length ? vis : series).flatMap((s) => s.pts.map((p) => p[1]));
    if (st.log) { const pos = ys.filter((v) => v > 0); logFloor = 2 ** Math.floor(Math.log2(Math.max(1, Math.min(...pos)))); return [Math.log2(logFloor), Math.log2(Math.max(...ys) * 1.12)]; }
    return [0, Math.max(...ys) * 1.06 || 1];
  };
  let fy = yExt();
  const save = () => store.set("chart:" + o.id, { log: st.log, off: [...st.off] });
  const view = () => {
    const half = 0.5 / st.k;
    st.cu = clamp(st.cu, half, 1 - half); st.cv = clamp(st.cv, half, 1 - half);
    return { u0: st.cu - half, u1: st.cu + half, v0: st.cv - half, v1: st.cv + half };
  };
  let G = null;                                                           // the geometry of the last drawing
  const nice = (span, n) => { const raw = span / n, p = 10 ** Math.floor(Math.log10(raw || 1)), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  const valueAt = (s, x) => {
    const p = s.pts; if (!p.length) return null;
    if (x <= p[0][0]) return p[0][0] === x ? p[0][1] : null;
    for (let i = 1; i < p.length; i++) if (x <= p[i][0]) { const [a, va] = p[i - 1], [b2, vb] = p[i]; return va + (vb - va) * (x - a) / (b2 - a || 1); }
    return null;
  };
  function draw() {
    const W = Math.max(320, plot.clientWidth || 800);
    const labW = W < 640 ? Math.round(Math.min(190, W * 0.46)) : 230, L = 46, Rt = W - labW, T = 12;
    const vis = series.filter((s) => !st.off.has(s.key));
    const H = Math.max(o.height || 460, Math.min(1400, vis.length * 14 + 60));
    const Bt = H - 30;
    const { u0, u1, v0, v1 } = view();
    const xa = fx0 + u0 * (fx1 - fx0), xb = fx0 + u1 * (fx1 - fx0);
    const ya = fy[0] + v0 * (fy[1] - fy[0]), yb = fy[0] + v1 * (fy[1] - fy[0]);     // in the transformed space
    const X = (x) => L + ((x - xa) / (xb - xa || 1)) * (Rt - L);
    const Y = (y) => Bt - ((ty(y) - ya) / (yb - ya || 1)) * (Bt - T);
    const ix = (px) => xa + ((px - L) / (Rt - L)) * (xb - xa);
    G = { W, H, L, Rt, T, Bt, X, Y, ix, xa, xb };
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.height = H + "px";
    const line = css("--line"), faint = css("--faint"), muted = css("--muted");
    let s = `<defs><clipPath id="cl-${o.id}"><rect x="${L}" y="${T - 2}" width="${Rt - L}" height="${Bt - T + 4}"/></clipPath></defs>`;
    // y grid
    const yt = [];
    if (st.log) { for (let e = Math.floor(ya); e <= Math.ceil(yb); e++) { yt.push(2 ** e); if (yb - ya < 3) yt.push(2 ** e * 1.5); } }
    else { const sy = nice(yb - ya, 6); for (let v = Math.ceil(ya / sy) * sy; v <= yb + 1e-9; v += sy) yt.push(v); }
    yt.filter((v) => ty(v) >= ya - 1e-9 && ty(v) <= yb + 1e-9).forEach((v) => { s += `<line x1="${L}" x2="${Rt}" y1="${Y(v)}" y2="${Y(v)}" stroke="${line}"/><text x="${L - 6}" y="${Y(v) + 4}" fill="${faint}" font-size="11" text-anchor="end">${r1(v)}</text>`; });
    // x grid: nice steps, and the named widths solid
    const sx = nice(xb - xa, W < 640 ? 4 : 8), xt = new Set();
    for (let v = Math.ceil(xa / sx) * sx; v <= xb + 1e-9; v += sx) xt.add(Math.round(v));
    (o.ticks || []).forEach((v) => { if (v >= xa && v <= xb) xt.add(v); });
    const solid = new Set(o.solid || []), named = new Set(o.ticks || []);
    // the named widths are always labelled; a plain step only where it does not crowd one
    const namedPx = [...named].filter((v) => v >= xa && v <= xb).map(X);
    let lastX = -99;
    [...xt].sort((a, b) => a - b).forEach((v) => {
      const px = X(v), isNamed = named.has(v);
      s += `<line x1="${px}" x2="${px}" y1="${T}" y2="${Bt}" stroke="${line}" stroke-dasharray="${solid.has(v) ? "0" : "2 4"}"/>`;
      if ((isNamed && px - lastX > 26) || (px - lastX > 36 && namedPx.every((q) => Math.abs(q - px) > 36))) { s += `<text x="${px}" y="${Bt + 18}" fill="${isNamed ? muted : faint}" font-size="11" text-anchor="middle">${v}</text>`; lastX = px; }
    });
    if (o.marker != null && o.marker >= xa && o.marker <= xb) s += `<line x1="${X(o.marker)}" x2="${X(o.marker)}" y1="${T}" y2="${Bt}" stroke="${css("--fg")}" stroke-width="1.5"/><text x="${X(o.marker) + 4}" y="${T + 10}" fill="${css("--fg")}" font-size="11" font-weight="600">${o.marker}</text>`;
    // the lines
    s += `<g clip-path="url(#cl-${o.id})">`;
    vis.forEach((se) => { s += `<path class="ln" data-k="${esc(se.key)}" d="${se.pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join("")}" fill="none" stroke="${se.color}" stroke-width="2.2" stroke-linejoin="round"/>`; });
    // least and greatest of each line (shown when it is picked out)
    vis.forEach((se) => {
      const iMin = se.pts.findIndex((p) => p[1] === se.mn), iMax = se.pts.findIndex((p) => p[1] === se.mx);
      [[iMin, "least"], [iMax, "greatest"]].forEach(([i, w], n) => { if (i < 0 || (n && se.mn === se.mx)) return; const p = se.pts[i];
        s += `<g class="mm" data-k="${esc(se.key)}"><circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4" fill="${se.color}" stroke="${css("--bg")}" stroke-width="1.5"/><text x="${X(p[0]) + 6}" y="${Y(p[1]) + (n ? -8 : 15)}" fill="${se.color}" font-size="11" font-weight="600">${w} ${r1(p[1])} at ${p[0]}</text></g>`; });
    });
    s += "</g>";
    // names at the right end of what is in view, with the least and greatest value of the whole line
    const labs = [];
    vis.forEach((se) => {
      for (let i = se.pts.length - 1; i >= 0; i--) {
        const px = X(se.pts[i][0]), py = Y(se.pts[i][1]);
        if (px >= L - 0.5 && px <= Rt + 0.5 && py >= T - 0.5 && py <= Bt + 0.5) { labs.push({ se, ax: px, ay: py, y: py }); break; }
      }
    });
    labs.sort((a, b) => a.y - b.y);
    const gap = 14;
    for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + gap);
    if (labs.length && labs.at(-1).y > Bt) { labs.at(-1).y = Bt; for (let i = labs.length - 2; i >= 0; i--) labs[i].y = Math.min(labs[i].y, labs[i + 1].y - gap); }
    if (labs.length && labs[0].y < T) { labs[0].y = T; for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + gap); }
    const maxCh = Math.floor((labW - 20) / 6.3);
    labs.forEach((l) => {
      const range = l.se.mn === l.se.mx ? r1(l.se.mn) : `${r1(l.se.mn)}–${r1(l.se.mx)}`;
      let name = l.se.label; const room = maxCh - range.length - 1;
      if (name.length > room) name = name.slice(0, Math.max(3, room - 1)) + "…";
      s += `<g class="lab" data-k="${esc(l.se.key)}"><title>${esc(l.se.label)}: least ${r1(l.se.mn)}, greatest ${r1(l.se.mx)}${o.unit ? " " + o.unit : ""}</title>`;
      s += `<path d="M${l.ax},${l.ay} L${Rt + 4},${l.ay} L${Rt + 10},${l.y}" fill="none" stroke="${l.se.color}" stroke-width="1" opacity="0.6"/>`;
      s += `<text x="${Rt + 14}" y="${l.y + 4}" font-size="11.5"><tspan fill="${l.se.color}" font-weight="600">${esc(name)}</tspan><tspan fill="${faint}"> ${range}</tspan></text></g>`;
    });
    s += `<line class="hair" x1="0" x2="0" y1="${T}" y2="${Bt}" stroke="${muted}" visibility="hidden"/><rect class="hit" x="${L}" y="${T}" width="${Rt - L}" height="${Bt - T}" fill="transparent"/>`;
    svg.innerHTML = s;
    plot.classList.toggle("zoomed", st.k > 1.001);
    slider.value = st.k; outK.textContent = (st.k < 10 ? st.k.toFixed(1) : Math.round(st.k)) + "×";
    if (st.hi) focus(st.hi);
  }
  function drawLegend() {
    legend.innerHTML = series.map((s) => `<button type="button" data-k="${esc(s.key)}" aria-pressed="${!st.off.has(s.key)}"><i style="background:${s.color}"></i>${esc(s.label)}</button>`).join("");
  }
  const focus = (k) => {
    st.hi = k;
    svg.classList.toggle("dim", !!k); legend.classList.toggle("dim", !!k);
    $$(".ln, .lab, .mm", svg).forEach((p) => p.classList.toggle("hi", p.dataset.k === k));
    $$("button", legend).forEach((x) => x.classList.toggle("hi", x.dataset.k === k));
  };
  legend.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const k = b.dataset.k; st.off.has(k) ? st.off.delete(k) : st.off.add(k); fy = yExt(); save(); drawLegend(); draw(); });
  legend.addEventListener("pointerover", (e) => { const b = e.target.closest("button"); focus(b ? b.dataset.k : null); });
  legend.addEventListener("pointerleave", () => focus(null));
  legend.addEventListener("focusin", (e) => { const b = e.target.closest("button"); if (b) focus(b.dataset.k); });
  legend.addEventListener("focusout", () => focus(null));
  svg.addEventListener("pointerover", (e) => { const g = e.target.closest(".lab"); if (g) focus(g.dataset.k); });
  svg.addEventListener("pointerout", (e) => { if (e.target.closest(".lab")) focus(null); });

  // zoom about a point of the plot (px), to the scale k
  const zoomAt = (k, px, py) => {
    k = clamp(k, 1, 16);
    if (!G) return;
    const { u0, u1, v0, v1 } = view();
    const pu = u0 + clamp((px - G.L) / (G.Rt - G.L), 0, 1) * (u1 - u0), pv = v0 + clamp((G.Bt - py) / (G.Bt - G.T), 0, 1) * (v1 - v0);
    st.cu = pu + (st.cu - pu) * st.k / k; st.cv = pv + (st.cv - pv) * st.k / k; st.k = k;
    draw();
  };
  const local = (e) => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * (G.W / r.width), (e.clientY - r.top) * (G.H / r.height)]; };
  slider.addEventListener("input", () => { if (G) zoomAt(+slider.value, (G.L + G.Rt) / 2, (G.T + G.Bt) / 2); });
  $(".fit", root).addEventListener("click", () => { st.k = 1; st.cu = st.cv = 0.5; draw(); });
  svg.addEventListener("dblclick", () => { st.k = 1; st.cu = st.cv = 0.5; draw(); });
  const logIn = $(".log", root);
  if (logIn) logIn.addEventListener("change", () => { st.log = logIn.checked; fy = yExt(); st.k = 1; st.cu = st.cv = 0.5; save(); draw(); });
  // Safari on a Mac sends a trackpad pinch as gesture events, not as a wheel with Ctrl
  let g0 = 1;
  svg.addEventListener("gesturestart", (e) => { e.preventDefault(); g0 = st.k; });
  svg.addEventListener("gesturechange", (e) => { e.preventDefault(); const [px, py] = local(e); zoomAt(g0 * e.scale, px, py); });
  svg.addEventListener("gestureend", (e) => e.preventDefault());
  svg.addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;                             // a plain scroll scrolls the page
    e.preventDefault();
    const [px, py] = local(e);
    const d = clamp(e.deltaY * (e.deltaMode === 1 ? 16 : 1), -50, 50);    // a pinch sends small steps, a wheel big ones
    zoomAt(st.k * Math.exp(-d * 0.012), px, py);
  }, { passive: false });
  // drag to move, two fingers to pinch
  const ptrs = new Map();
  let drag = null, pinch = null;
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    ptrs.set(e.pointerId, local(e));
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, k: st.k }; drag = null;
      svg.setPointerCapture(e.pointerId);
    } else if (st.k > 1.001) {
      drag = { x: local(e)[0], y: local(e)[1], cu: st.cu, cv: st.cv }; plot.classList.add("dragging");
      svg.setPointerCapture(e.pointerId);
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, local(e));
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt(pinch.k * d / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); hideTip(); return;
    }
    if (drag) {
      const [x, y] = local(e), span = 1 / st.k;
      st.cu = drag.cu - ((x - drag.x) / (G.Rt - G.L)) * span; st.cv = drag.cv + ((y - drag.y) / (G.Bt - G.T)) * span;
      draw(); hideTip(); return;
    }
    hover(e);
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) { drag = null; plot.classList.remove("dragging"); } };
  svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
  svg.addEventListener("pointerleave", () => { const h = $(".hair", svg); if (h) h.setAttribute("visibility", "hidden"); hideTip(); });
  function hover(e) {
    if (!G || e.pointerType === "touch") return;
    const [px, py] = local(e), hair = $(".hair", svg);
    if (px < G.L || px > G.Rt || py < G.T || py > G.Bt) { hair.setAttribute("visibility", "hidden"); hideTip(); return; }
    const xs = [...new Set(series.flatMap((s) => s.pts.map((p) => p[0])))].sort((a, b) => a - b);
    const x0 = G.ix(px); let best = xs[0]; xs.forEach((x) => { if (Math.abs(x - x0) < Math.abs(best - x0)) best = x; });
    hair.setAttribute("x1", G.X(best)); hair.setAttribute("x2", G.X(best)); hair.setAttribute("visibility", "visible");
    const vals = series.filter((s) => !st.off.has(s.key)).map((s) => [s, valueAt(s, best)]).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
    const shown = st.hi ? vals.filter(([s]) => s.key === st.hi) : vals.slice(0, 16);
    showTip(e, `<b>${esc((o.xTip || "{x}").replace("{x}", best))}</b>` + shown.map(([s, v]) => `<div><span><i style="background:${s.color}"></i>${esc(s.label)}</span><span>${r1(v)}</span></div>`).join("") + (vals.length > shown.length && !st.hi ? `<div><span>+${vals.length - shown.length} more</span></div>` : ""));
  }
  drawLegend();
  root._draw = draw;
  root._set = (patch) => { Object.assign(o, patch); if (patch.series) { /* not used */ } draw(); };
  const ro = new ResizeObserver(() => draw()); ro.observe(plot);
  root._dispose = () => ro.disconnect(); onLeave(root._dispose);
  requestAnimationFrame(draw);
  return root;
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The scale: a size at a screen (design/scale.json, the same sums as build/tokens.mjs)
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const RG = S.scale.range;
const vpOf = (w, h) => Math.min(w, RG.from + (h - RG.height.from) * (RG.to - RG.from) / (RG.height.to - RG.height.from));
const lerp = (px, x) => px[0] + (px[1] - px[0]) * clamp((x - RG.from) / (RG.to - RG.from), 0, 1);
const gutterRole = S.space.find((r) => r.name === "section/pad-x");
const roleAt = (r, w, h) => {
  if (r.per) {                                                            // by the card's own width: the column
    const card = Math.min(1024, w - 2 * lerp(gutterRole.px, vpOf(w, h)));
    return r.px[0] + (r.px[1] - r.px[0]) * clamp((card - r.per.from) / (r.per.to - r.per.from), 0, 1);
  }
  return lerp(r.px, r.by === "width" ? w : vpOf(w, h));
};
const LADDER = (() => { const out = [0]; let v = 0; S.scale.ladder.steps.forEach(([st, to]) => { while (v < to) { v += st; out.push(v); } }); return out; })();
const screen = { w: store.get("w", 1440), h: store.get("h", 920) };
const screenBar = (onChange) => {
  const bar = el("div", "screen");
  bar.innerHTML = `<label class="slider"><span>Screen width</span><input type="range" min="${RG.from}" max="${RG.to}" step="1" value="${screen.w}" data-k="w"><output></output></label>
    <label class="slider"><span>Screen height</span><input type="range" min="${RG.height.from}" max="${RG.height.to}" step="1" value="${screen.h}" data-k="h"><output></output></label>
    <div class="sum"></div>`;
  const slope = (RG.to - RG.from) / (RG.height.to - RG.height.from), icpt = RG.from - slope * RG.height.from;
  const upd = () => {
    $$("input", bar).forEach((i) => { i.nextElementSibling.textContent = i.value + "px"; });
    const vp = vpOf(screen.w, screen.h);
    $(".sum", bar).innerHTML = `This screen counts as <b>${r1(vp)}</b> (${vp < screen.w ? "its height holds it back: " : ""}size = min(width, ${slope} × height ${icpt < 0 ? "−" : "+"} ${Math.abs(icpt)})). The range runs from ${RG.from} to ${RG.to}; ${RG.height.from} tall counts as ${RG.from}, ${RG.height.to} tall as ${RG.to}.`;
  };
  bar.addEventListener("input", (e) => { const i = e.target; if (!i.dataset.k) return; screen[i.dataset.k] = +i.value; store.set(i.dataset.k, +i.value); upd(); onChange(); });
  upd();
  return bar;
};
// a ladder with one row per role: its two ends, the steps of the ladder, and where the slider puts it
function ladderRows(roles, { min = 0, max, at }) {
  const W = 1000, l = 168, rr = 16, rowH = 26, top = 30, H = top + roles.length * rowH + 26;
  const X = (v) => l + ((clamp(v, min, max) - min) / (max - min)) * (W - l - rr);
  const box = el("div", "ladder chart");
  const draw = () => {
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="The ladder with each role's two ends">`;
    const ends = new Set(roles.flatMap((r) => r.px)); let lastX = -99;
    LADDER.filter((v) => v >= min && v <= max).forEach((v) => {
      const big = v % 8 === 0, used = ends.has(v);
      s += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 6}" y2="${H - 22}" stroke="${used ? css("--line-2") : css("--line")}" stroke-width="${big || used ? 1 : 0.5}"/>`;
      if ((used || v % 16 === 0) && X(v) - lastX > 16) { s += `<text x="${X(v)}" y="${H - 8}" fill="${used ? css("--muted") : css("--faint")}" font-size="10.5" text-anchor="middle">${v}</text>`; lastX = X(v); }
    });
    S.scale.ladder.steps.reduce((a0, [st, to]) => { const a = Math.max(a0, min); if (a < max && to > min) s += `<text x="${(X(a) + X(Math.min(to, max))) / 2}" y="14" fill="${css("--faint")}" font-size="10.5" text-anchor="middle">steps of ${st}</text><line x1="${X(a) + 3}" x2="${X(Math.min(to, max)) - 3}" y1="20" y2="20" stroke="${css("--line-2")}"/>`; return to; }, 0);
    roles.forEach((r, i) => {
      const y = top + i * rowH + 12, [a, b] = r.px, v = at(r), c = PAL[i % PAL.length];
      s += `<text x="0" y="${y + 4}" fill="${css("--muted")}" font-size="12">${esc(r.name)}</text>`;
      s += `<line x1="${X(Math.min(a, b))}" x2="${X(Math.max(a, b))}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity="0.45"/>`;
      [a, b].forEach((e) => { s += `<circle cx="${X(e)}" cy="${y}" r="4" fill="${css("--bg")}" stroke="${c}" stroke-width="2"><title>${esc(r.name)}: ${e} ${a === b ? "at every width" : e === a ? "at " + RG.from : "at " + RG.to}${LADDER.includes(e) ? " (on the ladder)" : ""}</title></circle>`; });
      s += `<circle cx="${X(v)}" cy="${y}" r="5.5" fill="${c}"><title>${esc(r.name)}: ${r1(v)} on this screen</title></circle>`;
      if (b > max || a > max) s += `<text x="${W - rr}" y="${y + 4}" fill="${css("--faint")}" font-size="10.5" text-anchor="end">→ ${Math.max(a, b)}</text>`;
    });
    box.innerHTML = s + "</svg>";
  };
  box._draw = draw; draw();
  return box;
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The system page
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const hex = (v) => { const m = String(v).match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i); return m ? { rgb: m[1], a: m[2] ? parseInt(m[2], 16) / 255 : 1 } : null; };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const over = (rgb, a, bg) => rgb.map((c, i) => c * a + bg[i] * (1 - a));
const rgbOf = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));

const TABS = [
  ["colour", "Colour", colourTab], ["type", "Type", typeTab], ["space", "Space", spaceTab], ["layout", "Layout", layoutTab],
  ["shadows", "Effects", shadowsTab], ["motion", "Motion", motionTab], ["icons", "Icons & pictures", iconsTab], ["components", "Components", componentsTab],
  ["behaviour", "Behaviour", behaviourTab], ["health", "Page health", healthTab], ["responsive", "Responsive", responsiveTab],
  ["blocks", "Blocks", blocksTab], ["grammar", "Grammar", grammarTab], ["decisions", "Decisions", decisionsTab],
];
const tabHasNew = {
  colour: S.colour.some((g) => g.tokens.some((t) => t.isNew || t.was)),
  type: S.type.some((r) => r.isNew || r.was), space: S.space.some((r) => r.isNew || r.was),
  layout: S.containers.some((c) => c.isNew) || S.pageSteps.some((p) => p.isNew), shadows: S.shadows.some((s) => s.isNew),
  motion: S.motion.blocks.some((b) => (b.items || b.rows || []).some((x) => x.isNew || x.changed)),
  decisions: S.decisions.some((d) => d.isNew || d.changed),
};

function systemPage(tab) {
  const page = el("div", "page");
  const head = el("header", "head");
  head.innerHTML = `<div class="eyebrow">The system · ${esc(D.meta.ref || "main")} at <a href="https://github.com/timofeylebedev/fm/commit/${esc(D.meta.head)}">${esc(D.meta.head)}</a></div>
    <h1>The system as it is now</h1>
    <p class="lede">Every colour, size, step, shadow, curve and decision of the site, read from the repo's own files when this page was built (${esc(D.meta.built)}). Things that are new or changed ${esc(SINCE)} carry a <span class="pill new">new</span> mark; the rounds that changed them are in the sidebar.</p>`;
  page.appendChild(head);
  const bar = el("div", "tabs"); bar.setAttribute("role", "tablist"); bar.setAttribute("aria-label", "Parts of the system");
  TABS.forEach(([k, label]) => {
    const ts = tabState(k);
    const b = el("button", "", `${esc(label)}${ts ? `<span class="dot ${ts}" title="a check ${ts === "fail" ? "fails" : "warns"} here"></span>` : tabHasNew[k] ? '<span class="dot" title="something new ' + esc(SINCE) + '"></span>' : ""}`);
    b.type = "button"; b.setAttribute("role", "tab"); b.id = "tab-" + k; b.dataset.k = k;
    b.setAttribute("aria-selected", k === tab); b.tabIndex = k === tab ? 0 : -1; b.setAttribute("aria-controls", "panel");
    bar.appendChild(b);
  });
  bar.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) go(`#system/${b.dataset.k}`, { keepScroll: true }); });
  bar.addEventListener("keydown", (e) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (j == null) return; e.preventDefault();
    const k = TABS[(j + TABS.length) % TABS.length][0]; go(`#system/${k}`, { keepScroll: true, focusTab: k });
  });
  page.appendChild(bar);
  const panel = el("div", "panel"); panel.id = "panel"; panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", "tab-" + tab);
  (TABS.find(([k]) => k === tab) || TABS[0])[2](panel);
  checksBlock(panel, tab);
  if (["icons", "components", "behaviour", "health"].includes(tab) && !C) panel.appendChild(el("p", "note", "The checks of this tab have not run yet: they run on every deploy (design/checks/)."));
  page.appendChild(panel);
  return page;
}
const panelHead = (panel, title, sub) => { panel.appendChild(el("h2", "", title)); if (sub) panel.appendChild(el("p", "sub", sub)); };

function colourTab(panel) {
  panelHead(panel, "Colour", "The colour tokens of design/tokens.json as tiles: the colour over white, as on the page (the band along the bottom shows it over checks, so its alpha shows), its token, the CSS variable and what it is for. «on white» is the contrast of that colour as text on the white page; on the brand colours, of white text on them.");
  S.colour.forEach((g) => {
    const blk = el("div", "block");
    blk.innerHTML = `<h3>${esc(g.label)}</h3><p class="sub">${esc(g.about)}</p>`;
    const grid = el("div", "swatches");
    g.tokens.forEach((t) => {
      const hx = hex(t.value);
      let on = "", onColour = "#000";
      if (hx) {
        const rgb = rgbOf(hx.rgb), shown = over(rgb, hx.a, [255, 255, 255]);
        const light = lum(shown) > 0.45; onColour = light ? "#000" : "#fff";
        if (g.key === "brand" || g.key === "idcard") on = `white on it ${r1(ratio([255, 255, 255], shown))} : 1`;
        else if (g.key === "ink") on = `on white ${r1(ratio(shown, [255, 255, 255]))} : 1`;
      }
      const alpha = hx && hx.a < 1 ? ` · ${Math.round(hx.a * 100)}%` : "";
      const tile = el("div", "swatch");
      tile.innerHTML = `<div class="chip" style="--c:${esc(t.value)}">${on ? `<span class="on" style="color:${onColour}">${esc(on)}</span>` : ""}<span class="new-tag">${newPill(t, t.was ? "changed " + SINCE + ": was " + t.was : "")}</span></div>
        <div class="meta"><b>${esc(t.name)}</b><span class="hex">${esc(hx ? "#" + hx.rgb.toUpperCase() + alpha : t.value)}${t.web ? " · " + esc(t.web.replace(/^var\((.*)\)$/, "$1")) : ""}</span>${t.was ? `<span class="was">was ${esc(t.was)}</span>` : ""}${t.description ? `<p>${esc(t.description)}</p>` : ""}</div>`;
      grid.appendChild(tile);
    });
    blk.appendChild(grid);
    panel.appendChild(blk);
  });
  if (S.colourWhere) { const w = clone(S.colourWhere); w.title = "Where they are used"; w.sub = "The colour roles of the page, from the analysis of round 6."; panel.appendChild(render(w)); }
}
const clone = (o) => JSON.parse(JSON.stringify(o));

function typeTab(panel) {
  panelHead(panel, "Type", "Every text role of design/scale.json: its two ends on the ladder (at 320 and 1440), the size it has on the screen set below, and a text from the site drawn at that size in the site's own font. The roles keep their distance at both ends (×" + S.scale.relations.min + " at least), so at every size between.");
  const roles = S.type;
  let lad, cards = [], relBox, chart = null, chartH = 0;
  const at = (r) => roleAt(r, screen.w, screen.h);
  const update = () => {
    lad._draw();
    cards.forEach(({ r, node }) => {
      const v = at(r), lh = typeof r.lh === "number" ? r.lh : S.scale.lineHeight[r.lh] || 1.3;
      $(".role__now", node).textContent = r2(v) + "px";
      const smp = $(".role__sample", node); smp.style.fontSize = v + "px";
      $(".role__meta", node).textContent = `${r.font === "display" ? "Pragmatica Ext" : "Golos"} ${r.weight} · line ${lh} = ${r1(v * lh)}px`;
    });
    drawRel();
    if (!chart) return;
    if (screen.h !== chartH) { const n = makeChart(); chart._dispose?.(); chart.replaceWith(n); chart = n; } else chart._set({ marker: screen.w });
  };
  panel.appendChild(screenBar(() => update()));
  const lb = el("div", "block"); lb.innerHTML = `<h3>On the ladder</h3><p class="sub">Steps of 2 up to 24, of 4 up to 64, of 8 up to 128. Each role runs from its size at 320 to its size at 1440 (both on the ladder); the filled dot is the size on this screen.</p>`;
  lad = ladderRows(roles, { min: 10, max: 64, at });
  lb.appendChild(lad); panel.appendChild(lb);
  const spec = el("div", "block"); spec.innerHTML = `<h3>The roles</h3>`;
  const list = el("div", "spec");
  roles.forEach((r) => {
    const node = el("div", "role");
    const color = r.color ? (r.color === "ink-60" ? "rgb(0 0 0 / 0.6)" : "rgb(0 0 0 / 0.7)") : "#000";
    const lh = typeof r.lh === "number" ? r.lh : S.scale.lineHeight[r.lh] || 1.3;
    node.innerHTML = `<div class="role__top"><code>${esc(r.name)}</code>${newPill(r, r.was ? `changed ${SINCE}: was ${r.was.px.join(" → ")}` : "")}<span class="role__ends">${r.px[0]} → ${r.px[1]}${r.label ? " · a label" : ""}</span><span class="role__now"></span><span class="role__meta"></span></div>
      <div class="role__sample" lang="ru" style="font-family:${r.font === "display" ? "'Pragmatica Ext', sans-serif" : "'Golos', sans-serif"};font-weight:${r.weight || 400};line-height:${lh};color:${color};${r.upper ? "text-transform:uppercase;" : ""}${r.track ? "letter-spacing:" + r.track + ";" : ""}">${esc(TS ? TS.typeset(r.text || "Весь лейбл — на одной волне", { lang: "ru", heading: r.font === "display" }) : r.text)}</div>
      <p class="role__use">${esc(r.use || "")}${r.where ? ` · <span class="note">${esc(r.where)}</span>` : ""}</p>`;
    list.appendChild(node); cards.push({ r, node });
  });
  spec.appendChild(list); panel.appendChild(spec);
  // relations at this screen
  relBox = el("div", "block"); relBox.innerHTML = `<h3>Distance between levels</h3><p class="sub">The pairs of type.relations at this screen: the bar is the ratio of the two sizes, the dashed line the least allowed (×${S.scale.relations.min}). ${esc(S.scale.relations.$about || "")}</p><div class="rel box"></div>`;
  panel.appendChild(relBox);
  const drawRel = () => {
    const top = 1.8, min = S.scale.relations.min;
    $(".rel", relBox).innerHTML = S.scale.relations.pairs.map(([a, b]) => {
      const ra = roles.find((r) => r.name === a), rb = roles.find((r) => r.name === b), k = at(ra) / at(rb);
      return `<div class="rel__row"><span>${esc(a.replace("type/", ""))} / ${esc(b.replace("type/", ""))}</span><div class="rel__bar"><i style="width:${clamp((k - 1) / (top - 1), 0, 1) * 100}%"></i><s style="left:${((min - 1) / (top - 1)) * 100}%"></s></div><span class="k ${k < min - 1e-9 ? "no" : ""}">×${k.toFixed(3)}</span></div>`;
    }).join("");
  };
  // the roles across every width
  const cb = el("div", "block"); cb.innerHTML = `<h3>Across the range</h3><p class="sub">Each role's size at every width from 320 to 1920 on a screen as tall as set above (flat outside 320–1440; screens that are short for their width count as narrower). The white line is the width set above.</p>`;
  // the height changes the lines themselves: the chart is made again when it moves
  const makeChart = () => { chartH = screen.h; return zchart({ id: "type-roles", series: roles.map((r, i) => ({ key: r.name, label: r.name.replace("type/", ""), color: PAL[i % PAL.length], pts: range(320, 1920, 10).map((w) => [w, r2(roleAt(r, w, screen.h))]) })),
    log: false, xNote: "Screen width (px)", xTip: "{x}px wide", ticks: [320, 390, 768, 1024, 1440, 1920], solid: [320, 1440], marker: screen.w, unit: "px", height: 420 }); };
  chart = makeChart();
  cb.appendChild(chart); panel.appendChild(cb);
  const extra = el("div", "grid2");
  extra.innerHTML = `<div class="box"><h3>Line heights</h3><p>${Object.entries(S.scale.lineHeight).map(([k, v]) => `<b>${esc(k)}</b> ${v}`).join(" · ")}: tighter as text gets bigger. Labels are tracked ${esc(S.scale.tracking.label)}.</p></div><div class="box"><h3>Figma aliases</h3><p>${Object.entries(S.scale.aliases).filter(([k]) => k !== "$about").map(([k, v]) => `<code>${esc(k)}</code> = <code>${esc(v)}</code>`).join(" · ")}</p></div>`;
  panel.appendChild(extra);
  update();
}
const range = (a, b, st) => { const out = []; for (let v = a; v <= b + 1e-9; v += st) out.push(v); return out; };

function spaceTab(panel) {
  panelHead(panel, "Space", "Every spacing and radius role of design/scale.json, its two ends and its size on the screen set below. Roles marked «a measure» size a block (they need not be on the ladder); «by the card» follow their own card's width; «by width» the screen's width alone.");
  const roles = S.space, radii = roles.filter((r) => r.name.startsWith("radius/")), rest = roles.filter((r) => !r.name.startsWith("radius/"));
  const at = (r) => roleAt(r, screen.w, screen.h);
  let lad, rows = [], rads = [];
  const upd = () => {
    lad._draw();
    const max = 140;
    rows.forEach(({ r, node }) => { const v = at(r); $(".num", node).textContent = r1(v); $(".bar", node).style.width = clamp(v / max, 0, 1) * 100 + "%"; });
    rads.forEach(({ r, node }) => { const v = at(r); $(".shape", node).style.borderRadius = v + "px"; $(".num", node).textContent = r1(v) + "px"; });
  };
  panel.appendChild(screenBar(upd));
  const lb = el("div", "block"); lb.innerHTML = `<h3>On the ladder</h3><p class="sub">Each role from its size at 320 to its size at 1440; the filled dot is the size on this screen. Measures (a block's size, marked below) are not on the ladder and are left out here.</p>`;
  lad = ladderRows(roles.filter((r) => !r.size), { max: 128, at }); lb.appendChild(lad); panel.appendChild(lb);
  const rb = el("div", "block"); rb.innerHTML = `<h3>Radii</h3><p class="sub">Tiles take s, half-column cards m, full-column cards l; padding = radius, inner radius = outer − inset.</p>`;
  const rg = el("div", "radii");
  radii.forEach((r) => { const node = el("div", "radius"); node.innerHTML = `<div class="shape ${r.name === "radius/s" ? "tint" : ""}"></div><div><code>${esc(r.name)}</code> ${newPill(r)}</div><div class="role__ends">${r.px[0]} → ${r.px[1]} · now <b class="num"></b></div><p class="note" style="margin:0">${esc(r.use || "")}</p>`; rg.appendChild(node); rads.push({ r, node }); });
  rb.appendChild(rg); panel.appendChild(rb);
  const sb = el("div", "block"); sb.innerHTML = `<h3>Spacing and measures</h3><p class="sub">The bar is the size on this screen (to scale; the full width is 140px).</p>`;
  const list = el("div", "space-list");
  rest.forEach((r) => {
    const node = el("div", "srow");
    const tags = [r.size ? "a measure" : "", r.per ? `by the card, ${r.per.from} → ${r.per.to}px wide` : "", r.by === "width" ? "by width" : ""].filter(Boolean).join(" · ");
    node.innerHTML = `<div><code>${esc(r.name)}</code> ${newPill(r, r.was ? `changed ${SINCE}: was ${r.was.px.join(" → ")}${r.was.per ? " by a card " + r.was.per.from + " → " + r.was.per.to : ""}` : "")}</div><div class="num"></div><div><div class="bar"></div></div>
      <div class="what"><span class="ends">${r.px[0]} → ${r.px[1]}</span>${r.css ? `<code>${esc(r.css)}</code> ` : ""}${tags ? `<span class="pill x">${esc(tags)}</span> ` : ""}${esc(r.use || "")}${r.was ? ` <span class="was">was ${esc(r.was.px.join(" → "))}${r.was.per ? ` by a ${r.was.per.from} → ${r.was.per.to} card` : ""}</span>` : ""}</div>`;
    list.appendChild(node); rows.push({ r, node });
  });
  sb.appendChild(list); panel.appendChild(sb);
  if (S.removed.space.length || S.removed.type.length) panel.appendChild(el("p", "note", `Removed ${esc(SINCE)}: ${[...S.removed.type, ...S.removed.space].map(esc).join(", ")}`));
  upd();
}

function layoutTab(panel) {
  panelHead(panel, "Layout", "One centred column (at most 1024), blocks that change at three shared steps of the column (S, M, L) and a few written own steps, and the page's own steps in media.css. The steps are read from the stylesheets.");
  const t = el("div", "block");
  t.innerHTML = `<h3>Container steps</h3><p class="sub">Every <code>@container</code> query in the stylesheets. Shared steps are the column's S 22rem, M 43rem, L 58rem; any other is an own step (CLAUDE.md lists them).</p>`;
  t.appendChild(B.table({ stack: true, columns: [{ label: "Container" }, { label: "When" }, { label: "Step" }, { label: "What changes", muted: true }, { label: "Where", muted: true }],
    rows: S.containers.map((c) => [`<code>${esc(c.container)}</code>`, `<code>${esc(c.cond)}</code>${c.px ? ` <span class="note">${r1(c.px)}px</span>` : c.em ? ` <span class="note">em of its own text</span>` : ""} ${newPill(c, c.was ? `new ${SINCE}: was ${c.was}` : "")}${c.was ? ` <span class="was">was ${esc(c.was)}</span>` : ""}`,
      c.step === "own" ? '<span class="pill q">own</span>' : `<span class="pill x">${c.step}</span>`, c.first ? `<code>${esc(c.first)}</code>` : "—", `${esc(c.file)}:${c.line}`]) }));
  panel.appendChild(t);
  const m = el("div", "block");
  m.innerHTML = `<h3>Page steps</h3><p class="sub">The custom media of src/styles/base/media.css, in em (so bigger browser text gets the layout of a narrower screen).</p>`;
  m.appendChild(B.table({ stack: true, columns: [{ label: "Name" }, { label: "Condition" }, { label: "What", muted: true }],
    rows: S.pageSteps.map((p) => [`<code>${esc(p.name)}</code> ${newPill(p)}`, `<code>${esc(p.cond)}</code>`, esc(p.note)]) }));
  panel.appendChild(m);
  if (S.map) { const mp = clone(S.map); panel.appendChild(render(Object.assign(mp, { title: "Responsive map", sub: `Where each block changes its layout, measured every 10px of width (${mp.measured ? `${mp.measured.commit.slice(0, 7)}, ${mp.measured.when.slice(0, 10)}, again on every deploy` : "round 6, Oct 24"}; overlay scrollbars). Blue lines: the shared steps of the column, at the screen width they fall on.` }))); }
  if (S.heightLine) { const g = el("div", "grid2"); g.appendChild(render(S.heightLine)); panel.appendChild(g); }
}

function shadowsTab(panel) {
  panelHead(panel, "Shadows", "Every shadow in the stylesheets, drawn with its own value on the ground it sits on, with the places that use it. There are no shadow tokens yet (round 6, G4: --shadow-float, --shadow-object, --shadow-chip proposed). Not listed: the ID card\'s shadow in the air, which scripts/motion.js derives from the object shadow while the card falls (M.DROP).");
  const vars = Object.entries(S.cssVars || {}).map(([k, v]) => `--${k}:${v}`).join(";");
  const grid = el("div", "shadows"); grid.setAttribute("style", vars);
  S.shadows.forEach((s) => {
    const card = el("div", "shadow");
    const isId = /face/.test(s.value), isChip = /chip/.test(s.uses.map((u) => u.sel).join());
    const obj = s.painter ? `<div class="obj" style="background:#004de5;color:#fff;box-shadow:0 0 0 22px #fff, 0 0 0 23px #d4d4d4">a card</div>` : `<div class="obj ${isId ? "card" : isChip ? "pill" : /menu|cookies|book/.test(s.uses.map((u) => u.sel).join()) ? "pill" : ""}" style="${s.prop}:${esc(s.value)};${isChip ? "background:rgb(255 255 255 / 0.7)" : ""}">${isId ? "" : isChip ? "Last seen" : "Меню"}</div>`;
    card.innerHTML = `<div class="stage ${s.ground === "sand" ? "sand" : ""}">${obj}</div>
      <div class="meta"><b>${esc(s.name)} ${newPill(s)}</b><code>${esc(s.prop)}: ${esc(s.value)}</code>${s.painter ? `<p class="note" style="margin:0">Not a shadow: a spread in the page's colour that paints the strips round a stack card (here drawn as a white ring).</p>` : ""}<ul>${s.uses.map((u) => `<li><code>${esc(u.sel)}</code> ${u.media ? `<span class="note">${esc(u.media)}</span> ` : ""}<span class="note">${esc(u.file)}:${u.line}</span> ${u.isNew ? '<span class="pill new">new</span>' : ""}</li>`).join("")}</ul></div>`;
    grid.appendChild(card);
  });
  panel.appendChild(grid);
}

function motionTab(panel) {
  panelHead(panel, "Motion", "The curves (time across, progress up; press or hover one to see it move) and every duration on one scale, from the code (round 6's reading of scripts/motion.js and the stylesheets). Curves are compared with round 5\'s reading; the durations marked changed are the ones round 6 found changed.");
  S.motion.blocks.forEach((b) => panel.appendChild(render(b)));
  if (S.motionCards) panel.appendChild(render(S.motionCards));
}
function responsiveTab(panel) {
  const m = S.picture.measured;
  panelHead(panel, "Responsive", `Every size of the page, measured in a browser at every 10px of width (1100 tall) and every 25px of height (1440 wide), ${m ? `on ${m.commit.slice(0, 7)} (${m.engine}, ${m.when.slice(0, 10)}; measured again on every deploy)` : "on main as round 6 measured it (bd0566f, Oct 24)"}. Pick a group; zoom with the slider or Ctrl/⌘ + scroll (a pinch on a trackpad or a touch screen), drag to move; each line is named at its right end with its least and greatest value. Hover a name to pick its line out.`);
  panel.appendChild(render(S.picture));
}
function blocksTab(panel) {
  panelHead(panel, "Blocks", "The sections of the page that have rules of their own, as measured in round 6 (Oct 24).");
  const toc = el("nav", "toc"); toc.setAttribute("aria-label", "Blocks");
  S.blocks.forEach((s) => { const a = el("a", "", esc(s.nav || s.title)); a.href = "#sys-" + s.id; toc.appendChild(a); });
  toc.addEventListener("click", (e) => { const a = e.target.closest("a"); if (!a) return; e.preventDefault(); document.getElementById(a.getAttribute("href").slice(1))?.scrollIntoView({ behavior: calm() ? "auto" : "smooth" }); });
  panel.appendChild(toc);
  S.blocks.forEach((s) => { const n = section(s, { h: "h2" }); n.id = "sys-" + s.id; panel.appendChild(n); });
}
function grammarTab(panel) {
  panelHead(panel, "Grammar", "How the parts are put together: the rules the page follows everywhere, written down or not.");
  S.grammar.blocks.forEach((b) => panel.appendChild(render(b)));
}
function decisionsTab(panel) {
  const all = S.decisions;
  panelHead(panel, "Decisions", `design/decisions.json: ${all.length} entries — exceptions (a rule left on purpose, printed by the audit with this run's values) and decisions (how something is meant to be). ${all.filter((d) => d.isNew).length} new and ${all.filter((d) => d.changed).length} changed ${SINCE}.`);
  const st = { kind: "all", q: "" };
  const ctl = el("div", "controls");
  ctl.innerHTML = `<div class="seg" role="group" aria-label="Kind">${[["all", "All"], ["exception", "Exceptions"], ["decision", "Decisions"], ["new", "New or changed"]].map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join("")}</div><input type="search" placeholder="Search" aria-label="Search the decisions">`;
  panel.appendChild(ctl);
  const list = el("div", "dlist"); panel.appendChild(list);
  const draw = () => {
    $$("[data-k]", ctl).forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === st.kind));
    const q = st.q.toLowerCase();
    const items = all.filter((d) => (st.kind === "all" || (st.kind === "new" ? d.isNew || d.changed : d.kind === st.kind)) && (!q || JSON.stringify(d).toLowerCase().includes(q)));
    list.innerHTML = items.map((d) => `<article class="dec"><div class="dec__top"><code>${esc(d.id)}</code>${pill(d.kind)}${newPill(d)}</div>
      <p>${esc(d.what)}</p>${d.rule ? `<p><b>Rule:</b> ${esc(d.rule)}</p>` : ""}${d.measured ? `<p><b>Measured:</b> ${esc(d.measured)}</p>` : ""}${d.why ? `<p><b>Why:</b> ${esc(d.why)}</p>` : ""}${d.fix ? `<p><b>If it changes:</b> ${esc(d.fix)}</p>` : ""}<div class="who">${esc(d.decided || "")}</div></article>`).join("") || `<p class="note">Nothing matches.</p>`;
  };
  ctl.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) { st.kind = b.dataset.k; draw(); } });
  $("input", ctl).addEventListener("input", (e) => { st.q = e.target.value; draw(); });
  draw();
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The typesetter page
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const SAMPLE = {
  ru: "Весь лейбл — на одной волне\n\nПланируйте релизы наперёд, чтобы они не накладывались и выходили в срок, а не в последний момент.\n\nСозвонитесь с нами на 30 минут: покажем, как ваш лейбл может работать слаженнее и расти. С 1 января 2026 г. отчёты по ст. 6 приходят в т. ч. по e-mail hello@flowmedium.pro, а договоры за 2022–2025 годы — в личный кабинет.",
  en: "Dr. Smith wrote to us on October 19 about the 5 GB of reports.\n\nI think a label should see what it is owed in one place, not in a dozen of spreadsheets and e-mails from 2022–2025.",
};
function typesetPage() {
  const page = el("div", "page");
  const dec = D.typeset.decision;
  page.innerHTML = `<header class="head"><div class="eyebrow">build/typeset · since PR #17 (Oct 24)</div><h1>The typesetter</h1>
    <p class="lede">A browser breaks a line at any space and after any hyphen or dash. The typesetter decides which of those places a reader should never see a line end at — «в | доме», «10 | км», «Dr. | Smith», a dash starting a line, «e- | mail» — and holds them together. It runs on every page when the site is built, by each text's language (Russian and English rules, plus rules for any language), and <b>never changes a letter you can see</b>: it writes only no-break spaces, invisible word joiners and line-break hints in long links.</p></header>`;
  // ── the demo ──
  const demo = el("section", "sec"); demo.id = "try";
  const st = Object.assign({ lang: "ru", heading: false, width: 300, size: 18, marks: true }, store.get("ts", {}));
  demo.innerHTML = `<h2>Try it</h2><p class="sub">The same text twice at the same width: on the left as the browser breaks it, on the right with the typesetter's holds (the real code, build/typeset/core.js). A line that ends where the typesetter would hold — after «в», before a dash, between a number and its word, inside «e-mail» — is marked red. Drag the width to watch the lines move; edit the text, or switch the language.</p>
    <div class="ts-controls"><div class="seg" role="group" aria-label="Language"><button type="button" data-lang="ru">Русский</button><button type="button" data-lang="en">English</button></div>
      <label class="switch"><input type="checkbox" class="hd"${st.heading ? " checked" : ""}><span></span>Heading (Pragmatica)</label>
      <label class="switch"><input type="checkbox" class="mk"${st.marks ? " checked" : ""}><span></span>Show the holds</label>
      <label class="slider"><span>Width</span><input type="range" class="wd" min="140" max="640" step="1" value="${st.width}"><output></output></label>
      <label class="slider"><span>Size</span><input type="range" class="sz" min="12" max="48" step="1" value="${st.size}"><output></output></label></div>
    <textarea class="ts-input" aria-label="The text" spellcheck="false"></textarea>
    <div class="ts-pair"><div class="ts-side"><h3>The browser alone <span class="c0"></span></h3><div class="ts-paper"><div class="ts-col c-plain"></div></div></div>
      <div class="ts-side"><h3>With the typesetter <span class="c1"></span></h3><div class="ts-paper"><div class="ts-col c-set"></div></div></div></div>
    <div class="block"><h3>How this text was read</h3><p class="sub">The first paragraph cut into tokens (word, number, space, punctuation, dash, hyphen, sign, link), and the answer for each space: <span class="pill new">held</span> by a rule, or free to break. Hover a hold below to find it in the text.</p><div class="tokens"></div></div>
    <div class="block"><h3>Holds in this text</h3><div class="holds"></div></div>`;
  page.appendChild(demo);
  const ta = $("textarea", demo), plain = $(".c-plain", demo), set = $(".c-set", demo), toks = $(".tokens", demo), holdsBox = $(".holds", demo);
  ta.value = store.get("ts-text-" + st.lang, null) || SAMPLE[st.lang];
  const save = () => store.set("ts", st);
  // a paragraph as HTML: each run of letters a span that knows where it is in the text (data-s, data-e), so the lines
  // can be found; with the typesetter, its no-break spaces, word joiners and link breaks written in (and marked)
  const holdsOf = (text) => {
    const r = TS.decide(text, { lang: st.lang, heading: st.heading }), at = new Map();
    r.holds.forEach((h) => { const t = r.toks[h.k]; at.set(h.kind === "join" ? t.j : t.i, h); });
    TS.edits(text, { lang: st.lang, heading: st.heading }).forEach((e) => { if (e.rule === "phone") at.set(e.i, { rule: "phone", strength: 3, kind: e.to === TS.WJ ? "join" : "nbsp" }); });
    return at;                                                             // text index → the hold there
  };
  const para = (text, useTs, pi) => {
    const edits = useTs && TS ? TS.edits(text, { lang: st.lang, heading: st.heading }) : [];
    const holds = TS ? holdsOf(text) : new Map();
    const byAt = new Map(edits.map((e) => [e.i, e]));
    let out = "", i = 0;
    while (i < text.length) {
      const sp = /\s/.test(text[i]);
      let j = i; while (j < text.length && /\s/.test(text[j]) === sp) j++;
      if (sp) {
        const e = byAt.get(i), h = holds.get(i);
        const typed = new RegExp("\\u00A0").test(text.slice(i, j));
        if (e && e.to === " ") out += " ";                                 // a no-break space the typesetter lets go (next to a link)
        else if ((e && e.to === "\u00A0") || (useTs && typed && h)) out += `<span class="hold" data-key="${pi}:${i}" title="${esc(h ? h.rule + " · " + strengthName(h.strength) : e.rule)}">\u00A0</span>`;
        else out += typed ? "\u00A0" : " ";
      } else {
        let w = "";
        for (let k = i; k < j; k++) {
          const e = byAt.get(k);
          if (e && e.wbr) w += `<span class="wbr" title="a long link may break here"></span><wbr>`;
          if (e && e.to === "\u2060") w += `<span class="join" title="${esc(e.rule)}: no break after this hyphen or dash">\u2060</span>`;
          w += esc(text[k]);
        }
        const e = byAt.get(j); if (e && e.to === "\u2060") w += `<span class="join">\u2060</span>`;
        out += `<span class="w" data-s="${i}" data-e="${j}">${w}</span>`;
      }
      i = j;
    }
    return out;
  };
  const strengthName = (n) => ({ 9: "author", 3: "must", 2: "should", 1: "nice" }[n] || n);
  // the lines: a line that ends where the typesetter holds (a space it keeps, or a hyphen it joins) is a bad one; the
  // word before it is marked. The same test on both sides, so the right one shows what the holds did.
  const flagLines = (col, paras) => {
    let bad = 0;
    $$("p", col).forEach((p, pi) => {
      const held = TS ? holdsOf(paras[pi]) : new Map();
      const ws = $$(".w", p);
      ws.forEach((w) => w.classList.remove("bad"));
      ws.forEach((w, n) => {
        const rs = w.getClientRects(); if (!rs.length) return;
        const s0 = +w.dataset.s, e0 = +w.dataset.e;
        // broken inside the word: at a hyphen it joins?
        if (rs.length > 1 && Math.round(rs[rs.length - 1].top) > Math.round(rs[0].top) + 2) {
          for (let k = s0 + 1; k < e0; k++) if (held.get(k)?.kind === "join") { w.classList.add("bad"); bad++; break; }
        }
        const next = ws[n + 1]; if (!next) return;
        const nr = next.getClientRects(); if (!nr.length) return;
        if (Math.round(nr[0].top) > Math.round(rs[rs.length - 1].top) + 2) {
          for (let k = e0; k < +next.dataset.s; k++) { const h = held.get(k); if (h && h.kind !== "join") { w.classList.add("bad"); w.title = "a line ends here, where «" + h.rule + "» holds"; bad++; break; } }
        }
      });
    });
    return bad;
  };
  const draw = () => {
    $$("[data-lang]", demo).forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === st.lang));
    $(".wd + output", demo).textContent = st.width + "px"; $(".sz + output", demo).textContent = st.size + "px";
    demo.classList.toggle("ts-marks", st.marks);
    const paras = ta.value.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
    [plain, set].forEach((c) => { c.lang = st.lang; c.classList.toggle("head", st.heading); c.style.width = st.width + "px"; c.style.fontSize = st.size + "px"; });
    plain.innerHTML = paras.map((p) => `<p>${para(p, false)}</p>`).join("");
    set.innerHTML = paras.map((p, i) => `<p>${para(p, true, i)}</p>`).join("");
    requestAnimationFrame(() => {
      const a = flagLines(plain, paras), b = flagLines(set, paras);
      $(".c0", demo).textContent = `${a} bad line end${a === 1 ? "" : "s"}`; $(".c1", demo).textContent = `${b} bad line end${b === 1 ? "" : "s"}`;
    });
    // the tokens of the first paragraph, and every hold
    if (!TS) return;
    const opts = { lang: st.lang, heading: st.heading };
    const first = paras[0] || "";
    const r = TS.decide(first, opts), held = new Map(r.holds.map((h) => [h.k, h]));
    toks.innerHTML = r.toks.map((k, n) => {
      const h = held.get(n);
      if (k.t === "s") return `<span class="tok s ${h ? "hold" : "free"}" title="${h ? esc(h.rule + " · " + strengthName(h.strength)) : "may break"}"><b>${h ? "⍽" : "·"}</b><small>${h ? esc(h.rule) : "break"}</small></span>`;
      return `<span class="tok ${k.t}"><b>${esc(k.s)}</b><small>${{ w: "word", n: "number", p: "punct.", d: "dash", h: "hyphen", x: "sign", a: k.kind, o: "object" }[k.t] || k.t}${h ? " ⁀ " + esc(h.rule) : ""}</small></span>`;
    }).join("");
    const rows = [];
    paras.forEach((p, pi) => {
      const d = TS.decide(p, opts);
      d.holds.forEach((h) => {
        const L = d.toks[h.k - 1], R = d.toks[h.k + 1];
        if (h.kind === "join") rows.push([`<span class="ex">${esc(L ? L.s : "")}${esc(d.toks[h.k].s)}<span class="m">⁀</span>${esc(R ? R.s : "")}</span>`, `<code>${esc(h.rule)}</code>`, strengthName(h.strength), "word joiner"]);
        else rows.push([`<span class="ex" data-key="${pi}:${d.toks[h.k].i}">${esc(L ? L.s : "")}<span class="m">⍽</span>${esc(R ? R.s : "")}</span>`, `<code>${esc(h.rule)}</code>`, strengthName(h.strength), "no-break space"]);
      });
      TS.edits(p, opts).filter((e) => e.wbr || e.rule === "phone").forEach((e) => rows.push([`<span class="ex">${esc(p.slice(Math.max(0, e.i - 8), e.i))}<span class="m">${e.wbr ? "¦" : e.to === "\u2060" ? "⁀" : "⍽"}</span>${esc(p.slice(e.j, e.j + 8))}</span>`, `<code>${esc(e.rule)}</code>`, e.wbr ? "—" : "must", e.wbr ? "a break hint in a link" : e.to === TS.WJ ? "word joiner" : "no-break space"]));
    });
    holdsBox.innerHTML = "";
    holdsBox.appendChild(rows.length ? B.table({ stack: true, columns: [{ label: "Where" }, { label: "Rule" }, { label: "Strength" }, { label: "Written as", muted: true }], rows }) : el("p", "note", "No holds in this text."));
  };
  demo.addEventListener("click", (e) => { const b = e.target.closest("[data-lang]"); if (!b) return; store.set("ts-text-" + st.lang, ta.value === SAMPLE[st.lang] ? null : ta.value); st.lang = b.dataset.lang; ta.value = store.get("ts-text-" + st.lang, null) || SAMPLE[st.lang]; save(); draw(); });
  $(".hd", demo).addEventListener("change", (e) => { st.heading = e.target.checked; save(); draw(); });
  $(".mk", demo).addEventListener("change", (e) => { st.marks = e.target.checked; save(); draw(); });
  $(".wd", demo).addEventListener("input", (e) => { st.width = +e.target.value; save(); draw(); });
  $(".sz", demo).addEventListener("input", (e) => { st.size = +e.target.value; save(); draw(); });
  let tmo = 0;
  ta.addEventListener("input", () => { clearTimeout(tmo); tmo = setTimeout(() => { store.set("ts-text-" + st.lang, ta.value === SAMPLE[st.lang] ? null : ta.value); draw(); }, 120); });
  holdsBox.addEventListener("pointerover", (e) => { $$(".hold.hi", set).forEach((h) => h.classList.remove("hi")); const k = e.target.closest("tr")?.querySelector("[data-key]")?.dataset.key; if (k) set.querySelector(`.hold[data-key="${k}"]`)?.classList.add("hi"); });
  holdsBox.addEventListener("pointerleave", () => $$(".hold.hi", set).forEach((h) => h.classList.remove("hi")));
  if (document.fonts) document.fonts.ready.then(draw);
  draw();
  const onResize = () => requestAnimationFrame(draw);
  addEventListener("resize", onResize); onLeave(() => removeEventListener("resize", onResize));

  // ── how it works ──
  const how = el("section", "sec"); how.id = "how";
  how.innerHTML = `<h2>How it works</h2><div class="steps">
    <div><p><b>Blocks.</b> <code>html.js</code> reads each page with a real HTML parser (parse5) and takes the text of every block — a paragraph, a heading, a list item, a cell. Inline tags are part of the block: «в <code>&lt;a&gt;</code>доме<code>&lt;/a&gt;</code>» is one text. Scripts, styles, code, attributes and anything marked <code>data-typeset="off"</code> are left alone.</p></div>
    <div><p><b>Language.</b> Each block takes the nearest <code>lang</code>: <code>ru</code> and <code>en</code> have rules of their own; any other language gets only the rules for every language.</p></div>
    <div><p><b>Tokens.</b> The text is cut into words, numbers, spaces, punctuation, dashes, hyphens, signs — and whole pieces for links, e-mails and phone numbers (as in the demo above).</p></div>
    <div><p><b>One answer per space.</b> For every space the rules are asked in order, looking at the words on both sides; the first that has a view answers: <i>hold</i> (with a strength), <i>break</i>, or no view (the next rule is asked). No passes, so a chain like «а⍽не⍽в⍽последний» is held word by word.</p></div>
    <div><p><b>Joins.</b> Where two parts touch with no space but a browser may still break — after a hyphen or a dash — a hold is a word joiner (U+2060): invisible, and the real hyphen stays, so copying and searching still find «e-mail».</p></div>
    <div><p><b>No length limit.</b> A hold is never let go because the piece it makes is long (Tim, Oct 24). The longest pieces on the site are 19 letters on the home page and 18 in a heading of the privacy policy; no page scrolls sideways at 320–390.</p></div>
    <div><p><b>In place.</b> Only the characters the rules decide on change, at their place in the source; entities and everything else stay as written. Visible fixes (quotes, dashes, look-alike letters) are only reported: <code>npm run typeset -- --lint src/*.html</code>.</p></div></div>
    <div class="grid2"><div class="box"><h3>Strengths</h3><p><b>author</b> 9 — a no-break space you typed (kept, except next to a link) · <b>must</b> 3 · <b>should</b> 2 · <b>nice</b> 1. Recorded for each hold and printed by <code>npm run typeset</code>.</p></div>
    <div class="box"><h3>Marks</h3><p><span class="ex">в<span class="m">⍽</span>доме</span> a no-break space · <span class="ex">e-<span class="m">⁀</span>mail</span> a word joiner · <span class="ex">hello@<span class="m">¦</span>flowmedium<span class="m">¦</span>.pro</span> a place a long link may break (<code>&lt;wbr&gt;</code>).</p></div>
    <div class="box"><h3>With the animations</h3><p>GSAP's SplitText keeps every no-break space. Inside headings split letter by letter (<code>data-reveal="chars"</code>) no word joiners are written (they would become empty letters); a hold at the edge of an inline tag is lost when a heading is split, so links stay out of split headings.</p></div></div>`;
  page.appendChild(how);
  // ── the rules ──
  const rules = el("section", "sec"); rules.id = "rules";
  rules.innerHTML = `<h2>The rules</h2><p class="sub">As build/typeset/README.md writes them (with their sources there). The order of the table is the order the rules are asked in.</p>`;
  const mark = (s) => esc(s).replace(/`([^`]+)`/g, (m, c) => `<span class="ex">${c.replace(/⍽|⁀|¦/g, (x) => `<span class="m">${x}</span>`)}</span>`);
  [["*", "Any language"], ["ru", "Russian"], ["en", "English"]].forEach(([k, label]) => {
    const list = D.typeset.rules[k] || [];
    if (!list.length) return;
    const b = el("div", "block"); b.appendChild(el("h3", "", label));
    b.appendChild(B.table({ stack: true, columns: [{ label: "Rule" }, { label: "Strength" }, { label: "Example", muted: true }],
      rows: list.map((r) => [`<code>${esc(r.name)}</code>${r.join ? ' <span class="pill x">join</span>' : ""}`, esc(r.strength), mark(r.example)]) }));
    rules.appendChild(b);
  });
  page.appendChild(rules);
  if (dec) {
    const m = el("section", "sec"); m.id = "measured";
    m.innerHTML = `<h2>Measured</h2><p class="sub">Decision <code>typeset</code> in design/decisions.json.</p><div class="dec"><p>${esc(dec.what)}</p>${dec.measured ? `<p><b>Measured:</b> ${esc(dec.measured)}</p>` : ""}${dec.why ? `<p><b>Why:</b> ${esc(dec.why)}</p>` : ""}<div class="who">${esc(dec.decided || "")}</div></div>
      <div class="box" style="margin-top:14px"><h3>Commands</h3><pre class="out">npm run typeset -- src/index.html        every text of the page with its holds and [its longest piece]
npm run typeset -- --lint src/*.html     what a proofreader would change (never changed by the build)
npm run typeset -- --text "Dr. Smith on page 12" --lang en [--heading]
npm run test:typeset                     every rule as examples</pre></div>`;
    page.appendChild(m);
  }
  return page;
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   Rounds
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
function roundPage(n) {
  const r = D.rounds.find((x) => String(x.n) === String(n)) || D.rounds[0];
  const page = el("div", "page");
  const latest = r === D.rounds[0];
  const head = el("header", "head");
  head.innerHTML = `<div class="eyebrow">Round ${r.n} · ${esc(r.date)}${latest ? " · the latest" : ""}</div><h1>${esc(latest && D.meta.title ? D.meta.title : r.title)}</h1><p class="lede">${latest && D.meta.lede ? D.meta.lede : esc(r.about)}</p>`;
  if (r.sections.length > 1) {
    const toc = el("nav", "toc"); toc.setAttribute("aria-label", "On this page");
    r.sections.forEach((s) => { const a = el("a", "", esc(s.nav || s.title)); a.href = `#round-${r.n}/${s.id}`; toc.appendChild(a); });
    head.appendChild(toc);
  }
  page.appendChild(head);
  r.sections.forEach((s) => { const n2 = section(s); n2.id = `r${r.n}-${s.id}`; page.appendChild(n2); });
  if (latest && D.meta.footer) page.appendChild(el("p", "note", D.meta.footer));
  return page;
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The checks (design/checks/): «What needs you», the checks on each tab of the system, the history
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const C = D.checks;                                        // null until the checks have run once
const RULES = C ? C.rules : [];
const STATUS_PILL = { fail: "bad", warn: "q", pass: "done", info: "x", ask: "q" };
const STATUS_WORD = { fail: "fails", warn: "warns", pass: "holds", info: "inventory", ask: "question" };
const spill = (s, word) => `<span class="pill ${STATUS_PILL[s] || "x"}">${esc(word || STATUS_WORD[s] || s)}</span>`;
// which tab of the system shows the checks of an area
const AREA_TAB = { Type: "type", Colour: "colour", Fills: "colour", Space: "space", Shape: "space", Layout: "layout", Alignment: "layout", Ratios: "layout", Layers: "layout",
  Effects: "shadows", Motion: "motion", States: "components", Components: "components", Icons: "icons", Images: "icons", Logic: "behaviour", Fallbacks: "behaviour", Privacy: "behaviour",
  "Page health": "health", Weight: "health", Code: "grammar", Decisions: "decisions" };
const rulesOf = (tab) => RULES.filter((r) => AREA_TAB[r.area] === tab);
const tabState = (tab) => { const rs = rulesOf(tab); return rs.some((r) => r.status === "fail") ? "fail" : rs.some((r) => r.status === "warn") ? "warn" : null; };
const measuredLine = () => C ? `measured on <a href="https://github.com/timofeylebedev/fm/commit/${esc(C.commit)}">${esc(C.commit.slice(0, 7))}</a> (${esc(C.from || "")}${C.from === "the last deploy of main" && C.commit.slice(0, 7) !== D.meta.head ? ", not this build" : ""}) on ${esc(C.generated.slice(0, 16).replace("T", " "))} UTC · ${Object.entries(C.engines).map(([e, v]) => `${esc(e)} ${esc(v.version)}${v.quick ? " (sizes only)" : ""}`).join(" · ")}` : "";

// copying an answer: the line goes to a chat with Claude, who records it (design/checks/answer.mjs)
const toast = el("div", "toast"); toast.setAttribute("role", "status"); document.body.appendChild(toast);
let toastT = 0;
const say = (t) => { toast.textContent = t; toast.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove("on"), 2600); };
async function copyLine(text) {
  try { await navigator.clipboard.writeText(text); say("Copied: paste it into a chat with Claude"); return; } catch (e) {}
  const t = el("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;opacity:0;left:0;top:0"; document.body.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch (e) {} t.remove();
  if (ok) say("Copied: paste it into a chat with Claude"); else prompt("Copy this line into a chat with Claude:", text);
}

// one rule: verdict, kind, value, how it is measured, and its items (accepted ones marked with their decision)
function ruleCard(r, { open = false, max = 8 } = {}) {
  const card = el("article", "check s-" + r.status);
  const val = r.value != null ? `<span class="check__v">${esc(r.value)}${r.unit ? (String(r.unit).startsWith("%") ? "" : " ") + esc(r.unit) : ""}${r.was && r.was.value != null && r.was.value !== r.value ? ` <span class="was">was ${esc(r.was.value)}</span>` : ""}</span>` : "";
  const wk = r.webkit ? ` <span class="note" title="Playwright's WebKit, the engine of Safari">WebKit: ${esc(STATUS_WORD[r.webkit.status] || r.webkit.status)}${r.webkit.value != null && r.webkit.value !== r.value ? " · " + esc(r.webkit.value) : ""}</span>` : "";
  const band = r.kind === "share" ? ` <span class="note">wanted ≥ ${esc(r.pass)}%, fails under ${esc(r.warn)}%</span>` : r.kind === "convention" && r.warn != null ? ` <span class="note">at most ${esc(r.warn)}</span>` : "";
  const items = r.items || [];
  const rows = items.map((i) => `<tr${i.accepted ? ' class="acc"' : ""}><td>${esc(i.where)}</td><td>${esc(i.what)}${i.note ? ` <span class="note">${esc(i.note)}</span>` : ""}${i.engine ? ' <span class="pill x">WebKit</span>' : ""}</td><td class="note">${esc(i.at || "")}</td><td>${i.accepted ? `<a href="#system/decisions" class="pill x" title="covered by a decision">${esc(i.accepted)}</a>` : ""}</td></tr>`);
  const table = items.length ? `<div class="tbl"><table class="stack-sm"><thead><tr><th>Where</th><th>What</th><th>At</th><th></th></tr></thead><tbody>${rows.slice(0, max).join("")}</tbody></table></div>${items.length > max ? `<details><summary>${items.length - max} more</summary><div class="tbl"><table class="stack-sm"><tbody>${rows.slice(max).join("")}</tbody></table></div></details>` : ""}` : "";
  card.innerHTML = `<div class="check__top">${spill(r.status)} <b>${esc(r.title)}</b> <span class="check__kind" title="${esc((C.kinds || {})[r.kind] || "")}">${esc(r.kind)}</span>${val}${band}${wk}</div>
    <p class="check__how">${esc(r.how)}${r.note ? ` <b>${esc(r.note)}</b>` : ""}</p>${r.scenario ? `<div class="scn"><span><i>Given</i> ${esc(r.scenario.given)}</span><span><i>When</i> ${esc(r.scenario.when)}</span><span><i>Then</i> ${esc(r.scenario.then)}</span></div>` : ""}
    ${table ? (open || r.status === "fail" || r.status === "warn" || r.kind === "inventory" ? table : `<details><summary>${items.length} measured</summary>${table}</details>`) : ""}`;
  return card;
}
// the checks of a tab, put under its title
function checksBlock(panel, tab) {
  const rs = rulesOf(tab); if (!rs.length) return;
  const blk = el("div", "block checks");
  const n = (s) => rs.filter((r) => r.status === s).length;
  blk.innerHTML = `<h3>Checks</h3><p class="sub">${[["fail", "fail"], ["warn", "warn"], ["pass", "hold"], ["info", "inventory"]].filter(([s]) => n(s)).map(([s, w]) => `${n(s)} ${w}`).join(" · ")} — ${measuredLine()}. Every rule is measured on every deploy; <a href="#needs">what needs you</a> lists the failures across the system.</p>`;
  const list = el("div", "checks__list");
  rs.slice().sort((a, b) => ({ fail: 0, warn: 1, pass: 2, info: 3 }[a.status] - { fail: 0, warn: 1, pass: 2, info: 3 }[b.status])).forEach((r) => list.appendChild(ruleCard(r)));
  blk.appendChild(list);
  const at = panel.querySelector(":scope > .sub") || panel.querySelector(":scope > h2");
  at ? at.after(blk) : panel.appendChild(blk);
}

// the questions (open ones from the checks' state; as written when the checks have not run yet)
const QUESTIONS = (C ? C.questions : D.questions.map((q) => ({ ...q, state: q.status === "answered" ? "answered" : q.status === "dropped" ? "dropped" : "open" })));
const NEED_LABEL = { iphone: "iPhone", "mac-safari": "Mac · Safari", eye: "a look", choice: "a choice" };
function questionCard(q) {
  const card = el("article", "ask" + (q.state === "reopened" ? " re" : ""));
  card.innerHTML = `<div class="ask__top">${(q.needs || []).map((n) => `<span class="pill ${n === "choice" ? "x" : "q"}">${esc(NEED_LABEL[n] || n)}</span>`).join(" ")}${q.state === "reopened" ? ' <span class="pill bad">changed since your answer</span>' : ""}<span class="note">since ${esc(q.since)}${q.from ? " · " + esc(q.from) : ""}</span></div>
    <p class="ask__q">${esc(q.ask)}</p>${q.state === "reopened" && q.answer ? `<p class="note">You answered «${esc(q.answer.choice)}» on ${esc(q.answer.when)}; since then ${esc((q.changed || []).join(", "))} changed.</p>` : ""}
    <div class="ask__do">${q.link ? `<a class="btn-ghost" href="${esc(q.link)}" target="_blank" rel="noopener">Open ↗</a>` : ""}${(q.options || []).map((o, i) => `<button type="button" class="btn-ans" data-i="${i}">${esc(o)}</button>`).join("")}</div>
    <label class="ask__note"><span>Note (optional)</span><input type="text" placeholder="what you saw, on which device"></label>`;
  card.addEventListener("click", (e) => { const b = e.target.closest(".btn-ans"); if (!b) return; const note = $(".ask__note input", card).value.trim(); copyLine(`FM answer · ${q.id}: ${q.options[+b.dataset.i]}${note ? " — " + note : ""}`); });
  return card;
}
function needCard(n) {
  const r = RULES.find((x) => x.id === n.id), card = el("article", "need s-" + n.severity);
  const tab = r ? AREA_TAB[r.area] : n.type === "decision" ? "decisions" : null;
  const acts = n.type === "rule" ? [["Fix it", "fix it"], ["Keep it as designed", "keep it as designed (a decision)"], ["Not a problem: change the rule", "the rule is wrong, change it"]] : [["Still right", "still right"], ["Reconsider", "reconsider it"]];
  card.innerHTML = `<div class="need__top">${spill(n.severity)} <b>${esc(n.title)}</b> <span class="note">${esc(n.area)}${n.fresh ? ` · <span class="pill new">${n.fresh} new</span>` : ""}</span></div>
    <p class="need__why">${esc(n.why)}</p>${(n.sample || []).length ? `<ul class="need__s">${n.sample.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="ask__do">${tab ? `<a class="btn-ghost" href="#system/${tab}">See all</a>` : ""}${acts.map(([l, t]) => `<button type="button" class="btn-ans" data-t="${esc(t)}">${esc(l)}</button>`).join("")}</div>`;
  card.addEventListener("click", (e) => { const b = e.target.closest(".btn-ans"); if (b) copyLine(`FM ${n.type} · ${n.id}: ${b.dataset.t}`); });
  return card;
}
function needsPage() {
  const page = el("div", "page");
  const head = el("header", "head");
  const s = C && C.summary;
  head.innerHTML = `<div class="eyebrow">What needs you</div><h1>${C ? (s.fail ? `${s.fail} ${s.fail === 1 ? "rule fails" : "rules fail"}, ${QUESTIONS.filter((q) => q.state === "open" || q.state === "reopened").length} questions wait for you` : `Every hard rule holds; ${QUESTIONS.filter((q) => q.state === "open" || q.state === "reopened").length} questions wait for you`) : "The checks have not run yet"}</h1>
    <p class="lede">${C ? `${s.rules} rules of the system, measured in a browser on every deploy: ${s.pass} hold, ${s.warn} warn, ${s.fail} fail, ${s.info} are inventories. ${s.findings} places to look at${C.base ? ` (${s.new} new and ${s.fixed} fixed since the last deploy of main)` : ""}; ${s.accepted} covered by decisions. Each answer button copies a line for a chat with Claude, who records it.` : "They run on every deploy (design/checks/): this page fills once the first deploy after them has run. The questions below are as written."}</p>
    ${C ? `<p class="note">${measuredLine()}</p>` : ""}`;
  page.appendChild(head);
  const sec = (title, sub, nodes) => { if (!nodes.length) return; const s2 = el("section", "sec"); s2.innerHTML = `<h2>${esc(title)}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}`; const g = el("div", "needs"); nodes.forEach((n) => g.appendChild(n)); s2.appendChild(g); page.appendChild(s2); };
  const needs = C ? C.needs : [];
  sec("Failing", "Hard rules that break, and shares under their floor. Fix, keep as designed (a decision), or change the rule.", needs.filter((n) => n.type === "rule" && n.severity === "fail").map(needCard));
  sec("Decisions to look at", "A decision whose measured value left its band, that has expired, or that no longer covers anything.", needs.filter((n) => n.type === "decision").map(needCard));
  sec("Questions for you", "What a check cannot answer: a look on your iPhone or in Safari on your Mac, or a choice. An answer stays valid until the files it is about change; then the question comes back here.", QUESTIONS.filter((q) => q.state === "open" || q.state === "reopened").sort((a, b) => (b.state === "reopened") - (a.state === "reopened") || a.since.localeCompare(b.since)).map(questionCard));
  sec("Warnings", "Soft rules: tolerances, conventions and shares above their floor but under their aim.", needs.filter((n) => n.type === "rule" && n.severity === "warn").map(needCard));
  if (C && C.fixed.length) sec("Fixed since the last deploy of main", "Places that failed or warned then and are gone now (they closed themselves).", [el("ul", "plain", C.fixed.slice(0, 40).map((f) => `<li><code>${esc(f.rule)}</code> ${esc(f.where)}: ${esc(f.what)}</li>`).join(""))]);
  const answered = QUESTIONS.filter((q) => q.state === "answered");
  if (answered.length) sec("Answered", "", [el("ul", "plain", answered.map((q) => `<li>${esc(q.ask)} — <b>${esc(q.answer.choice)}</b>${q.answer.note ? ` (${esc(q.answer.note)})` : ""} <span class="note">${esc(q.answer.when)}</span></li>`).join(""))]);
  if (C) { const k = el("section", "sec"); k.innerHTML = `<h2>How strict each rule is</h2><p class="sub">Every rule has a kind; a decision can cover what a rule finds (it is then shown with its value on every run, and comes back here when that value moves).</p><div class="kinds">${Object.entries(C.kinds).map(([kk, v]) => `<div><b>${esc(kk)}</b><span>${esc(v)}</span></div>`).join("")}</div>`; page.appendChild(k); }
  return page;
}
// the history of main's deploys: how the main numbers moved
function historyPage() {
  const page = el("div", "page"), H = D.history || [];
  const head = el("header", "head");
  head.innerHTML = `<div class="eyebrow">History</div><h1>The system, deploy by deploy</h1><p class="lede">${H.length ? `${H.length} deploys of main measured since ${esc(H[0].day)}: what failed and warned, the shares of the system's rules, the weight of a first visit. Kept on the <a href="https://github.com/timofeylebedev/fm/tree/report-data">report-data</a> branch (a record per deploy, the state and the full measurements).` : "Nothing yet: the history starts with the first deploy of main after the checks were added."}</p>`;
  page.appendChild(head);
  if (!H.length) return page;
  const series = (label, f, unit, color) => ({ key: label, label, color, pts: H.map((x, i) => [i + 1, f(x)]).filter((p) => p[1] != null) });
  const box = (title, sub, ss, unit) => { const b = el("div", "block"); b.innerHTML = `<h3>${esc(title)}</h3><p class="sub">${esc(sub)}</p>`; b.appendChild(zchart({ id: "hist-" + title, series: ss, log: false, xNote: "Deploy of main (1 = the first measured)", xTip: "deploy {x}", ticks: H.map((_, i) => i + 1).filter((i, _, a) => a.length < 12 || i % Math.ceil(a.length / 10) === 1), unit, height: 260 })); page.appendChild(b); };
  box("Failures and warnings", "Rules that fail or warn, and places to look at.", [series("rules failing", (x) => x.summary.fail, "", PAL[6]), series("rules warning", (x) => x.summary.warn, "", PAL[1]), series("places", (x) => x.summary.findings, "", PAL[0])], "");
  const share = (id) => (x) => x.rules[id] ? x.rules[id][1] : null;
  box("Shares", "How much of the page follows the scale.", [series("text on a role %", share("type.roles"), "%", PAL[0]), series("colours from tokens %", share("colour.palette"), "%", PAL[2]), series("corners on a role %", share("shape.radii"), "%", PAL[3])], "%");
  box("Weight of a first visit", "KB sent (Brotli for text), scrolled top to bottom at 1440×900.", [series("total KB", (x) => x.weight && Math.round(x.weight.total / 1024), "KB", PAL[0]), series("scripts KB", (x) => x.weight && Math.round(x.weight.js / 1024), "KB", PAL[1]), series("pictures KB", (x) => x.weight && Math.round(x.weight.images / 1024), "KB", PAL[2])], "KB");
  const t = el("div", "block"); t.innerHTML = "<h3>Every deploy</h3>";
  t.appendChild(B.table({ stack: true, columns: [{ label: "#" , num: true }, { label: "Commit" }, { label: "Day" }, { label: "Fail", num: true }, { label: "Warn", num: true }, { label: "Places", num: true }, { label: "New", num: true }, { label: "Fixed", num: true }],
    rows: H.map((x, i) => [i + 1, `<a href="https://github.com/timofeylebedev/fm/commit/${esc(x.commit)}"><code>${esc(x.sha)}</code></a>`, esc(x.day), x.summary.fail, x.summary.warn, x.summary.findings, x.summary.new, x.summary.fixed]).reverse() }));
  page.appendChild(t);
  return page;
}
// new tabs of the system: areas measured on the page that had no tab before
function iconsTab(panel) { panelHead(panel, "Icons and pictures", "The inline icons (size, the stroke as drawn, colour from the text, line-up with their label) and every picture: the file against the device pixels it covers, format, loading, alt. Measured at the 8 screen sizes of the checks; the drawings are left out (they are pictures of the product)."); }
function componentsTab(panel) { panelHead(panel, "Components and states", "The page's components (classes with __parts, the BEM way), their variants and whether copies look alike; the hover timing of links and buttons."); }
function behaviourTab(panel) { panelHead(panel, "Behaviour", "The logic of the page as a table of scenarios (given, when, then), each played in a browser on every deploy; how the page holds up without scripts, WebGL or its fonts, in forced colours and with reduced motion; and what it calls before and after the cookie consent."); }
function healthTab(panel) { panelHead(panel, "Page health", "Every page of the site: titles, descriptions, the outline, links, files a browser or a search engine asks for, sideways scroll, script errors, and the weight of a first visit against the last deploy. Also the code's own rules (no CSS swallowed by a comment, every token used) are under Grammar."); }

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
   The sidebar and the routes
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
const nav = $("#side-nav"), main = $("#main");
const openN = QUESTIONS.filter((q) => q.state === "open" || q.state === "reopened").length + (C ? C.needs.filter((n) => n.type !== "question" && n.severity === "fail").length : 0);
nav.innerHTML = `<a href="#needs" data-page="needs"><span>What needs you${openN ? ` <span class="side__n" title="failing rules and open questions">${openN}</span>` : ""}</span><small>failures, questions, decisions to look at</small></a>
  <a href="#system/colour" data-page="system">The system<small>as it is now, in tabs, with its checks</small></a>
  <a href="#typesetter" data-page="typesetter">The typesetter<small>how lines may break</small></a>
  <a href="#history" data-page="history">History<small>every deploy of main, measured</small></a>
  <div class="side__group" id="rounds-h">Rounds</div>
  ${D.rounds.map((r) => `<a href="#round-${r.n}" data-page="round-${r.n}">Round ${r.n} · ${esc(r.date)}<small>${esc(r.title.replace(/^Round \d+:\s*/, ""))}</small></a>`).join("")}`;
$("#side-foot").innerHTML = `Built ${esc(D.meta.built)} from ${esc(D.meta.ref || "main")} at <a href="https://github.com/timofeylebedev/fm/commit/${esc(D.meta.head)}">${esc(D.meta.head)}</a>.${C ? `<br>Checks of <a href="https://github.com/timofeylebedev/fm/commit/${esc(C.commit)}">${esc(C.commit.slice(0, 7))}</a> · <a href="state.json">state.json</a>` : ""}<br>Source: <a href="https://github.com/timofeylebedev/fm/tree/main/design/report">design/report</a>, <a href="https://github.com/timofeylebedev/fm/tree/main/design/checks">design/checks</a>`;
const side = $("#side"), scrim = $("#scrim"), menuBtn = $("#menu-open");
const narrow = matchMedia("(width < 900px)");
const openMenu = (on) => {
  side.classList.toggle("open", on); scrim.hidden = !on; menuBtn.setAttribute("aria-expanded", on);
  syncSide();
  if (on) $("a[aria-current]", nav)?.focus(); else if (document.activeElement && side.contains(document.activeElement)) menuBtn.focus();
};
function syncSide() {
  const open = side.classList.contains("open");
  side.inert = narrow.matches && !open;
  main.inert = narrow.matches && open; $(".mbar").inert = narrow.matches && open; $(".skip").inert = narrow.matches && open;
}
narrow.addEventListener("change", () => { if (!narrow.matches) openMenu(false); syncSide(); });
syncSide();
menuBtn.addEventListener("click", () => openMenu(true));
$("#menu-close").addEventListener("click", () => openMenu(false));
scrim.addEventListener("click", () => openMenu(false));
addEventListener("keydown", (e) => { if (e.key === "Escape" && side.classList.contains("open")) openMenu(false); });
nav.addEventListener("click", (e) => { if (e.target.closest("a")) openMenu(false); });

let current = "";
function go(hash, opt = {}) { if (location.hash !== hash) history.pushState(null, "", hash); route(opt); }
// what a page set up outside itself (listeners on the window, observers) is undone when the next page is built
const LEAVE = [];
const onLeave = (fn) => LEAVE.push(fn);
function route(opt = {}) {
  const prevItems = LB.items; LB.items = [];               // the pictures of the page about to be built
  if (!lb.hidden) lbClose(true);
  const h = decodeURIComponent(location.hash.slice(1)) || "needs";
  let pageKey, title, anchor = null, shown;
  const m = h.match(/^round-(\d+)(?:\/(.+))?$/);
  if (h === "system" || h.startsWith("system/")) {
    const want = h.split("/")[1], tab = TABS.some(([k]) => k === want) ? want : store.get("tab", "colour");
    store.set("tab", tab);
    pageKey = "system"; title = "The system · " + TABS.find(([k]) => k === tab)[1]; shown = "system/" + tab;
    const keep = opt.keepScroll && current === "system" ? scrollY : null;
    swap(systemPage(tab), title);
    // a new tab starts at its top, under the tabs, without the page jumping up to its head
    if (keep != null) { const bar = $(".tabs", main), mb = $(".mbar"); scrollTo(0, Math.min(keep, bar.offsetTop - (mb.offsetHeight || 0))); }
    else scrollTo(0, 0);
    const sel = $("#tab-" + tab), bar = $(".tabs", main);
    if (bar) document.documentElement.style.setProperty("--tabs-h", bar.offsetHeight + "px");   // the screen bar sits right under the tabs                // the chosen tab in view in its strip
    if (sel && bar) bar.scrollLeft = Math.max(0, sel.offsetLeft - (bar.clientWidth - sel.offsetWidth) / 2);
    if (opt.focusTab) $("#tab-" + opt.focusTab)?.focus();
  } else if (h === "needs" || h === "history") {
    pageKey = h; title = h === "needs" ? "What needs you" : "History"; shown = h; swap(h === "needs" ? needsPage() : historyPage(), title); scrollTo(0, 0);
  } else if (h === "typesetter") {
    pageKey = "typesetter"; title = "The typesetter"; shown = h; swap(typesetPage(), title); scrollTo(0, 0);
  } else {
    const r = (m && D.rounds.find((x) => String(x.n) === m[1])) || D.rounds[0];
    anchor = m && String(r.n) === m[1] ? m[2] : null;
    pageKey = "round-" + r.n; title = "Round " + r.n; shown = pageKey + (anchor ? "/" + anchor : "");
    if (current !== pageKey) { swap(roundPage(r.n), title); scrollTo(0, 0); } else LB.items = prevItems;
    if (anchor) { const t = document.getElementById(`r${r.n}-${anchor}`); if (t) t.scrollIntoView({ behavior: opt.smooth && !calm() ? "smooth" : "auto" }); }
  }
  // an address that names nothing (an old tab, a round that is not there) is put right
  if (location.hash && location.hash.slice(1) !== shown) history.replaceState(null, "", "#" + shown);
  current = pageKey;
  $$("a", nav).forEach((a) => { if (a.dataset.page === pageKey) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  $("#mbar-title").textContent = title || "";
}
function swap(node, title) {
  hideTip();
  LEAVE.splice(0).forEach((fn) => { try { fn(); } catch (e) {} });
  main.innerHTML = "";
  main.appendChild(node);
  document.title = (title ? title + " · " : "") + "Flow Medium";
}
// back and forward fire both popstate and hashchange for a hash: one is enough
addEventListener("hashchange", () => route({ smooth: true }));
// the skip link goes to the page itself, not to an address
$(".skip").addEventListener("click", (e) => { e.preventDefault(); main.focus(); });
route();
})();

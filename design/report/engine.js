/* Design report engine: renders the whole page from the JSON in <script id="data">. Everything shown comes from the
   data: meta (name, eyebrow, title, lede, footer) and an ordered list of sections, each a list of typed blocks.
   Block types: stats, shots, changes, list, html, table, ladder, relations, heightLine, grid, box, picture, map,
   curves, durations, cards, rules, decisions, pre. See the data schema in the design-system-report skill. */
(() => {
const D = JSON.parse(document.getElementById('data').textContent);
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const r1 = (v) => Math.round(v * 10) / 10;
const PAL = ['#38bdf8', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#facc15', '#fb7185', '#22d3ee', '#a3e635', '#fb923c', '#c084fc', '#2dd4bf', '#e879f9', '#93c5fd', '#fcd34d', '#86efac'];
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const uid = (() => { let i = 0; return (p) => p + '-' + (++i); })();
const tip = $('#tip');
const showTip = (e, html) => { tip.innerHTML = html; tip.hidden = false; const pad = 14; let x = e.clientX + pad, y = e.clientY + pad; const r = tip.getBoundingClientRect(); if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad; tip.style.left = x + 'px'; tip.style.top = y + 'px'; };
const hideTip = () => { tip.hidden = true; };
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const KEY = 'design-report:' + (D.meta.key || D.meta.title || '');

/* ── head ── */
document.title = D.meta.title_tag || document.title;
$('#bar-name').innerHTML = D.meta.name || '';
$('#eyebrow').innerHTML = D.meta.eyebrow || '';
$('#title').innerHTML = D.meta.title || '';
$('#lede').innerHTML = D.meta.lede || '';
$('#foot').innerHTML = D.meta.footer || '';

/* ── blocks ── */
const B = {};
const heading = (b, wrap) => { if (b.title) wrap.appendChild(el(b.level === 2 ? 'h2' : 'h3', '', b.title)); if (b.sub) wrap.appendChild(el('p', 'sub', b.sub)); };

B.stats = (b) => el('div', 'grid3', b.items.map((h) => `<div class="box"><div class="stat">${esc(h.n)}<small>${esc(h.unit || '')}</small></div><p>${h.text || ''}</p></div>`).join(''));
B.list = (b) => el('ul', 'plain', b.items.map((x) => `<li>${x}</li>`).join(''));
B.html = (b) => el('div', 'prose', b.html);
B.pre = (b) => el('details', '', `<summary>${esc(b.summary || 'Output')}</summary><pre class="out">${esc(b.text || '')}</pre>`);
B.grid = (b) => { const g = el('div', b.cols === 2 ? 'grid2 two' : 'grid2'); b.blocks.forEach((x) => g.appendChild(render(x))); return g; };
B.box = (b) => { const box = el('div', 'box'); if (b.title) box.appendChild(el('h3', '', b.title)); if (b.html) box.appendChild(el('div', 'prose', b.html)); (b.blocks || []).forEach((x) => box.appendChild(render(x))); return box; };
B.cards = (b) => el('div', b.cols === 2 ? 'grid2 two' : 'grid2', b.items.map((g) => `<div class="box"><h3>${esc(g.title)}</h3><p>${g.html || ''}</p></div>`).join(''));
B.rules = (b) => el('div', 'rules', b.items.map((r) => `<div class="rule"><span class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✓' : '✗'}</span><div><b>${esc(r.title)}</b><p>${esc(r.how || '')}</p></div><span class="n">${r.n != null ? r.n + ' checked' : ''}</span></div>`).join(''));
const PILL = { done: 'done', good: 'done', checked: 'done', differently: 'x', written: 'x', new: 'x', decision: 'x', check: 'q', open: 'q', implicit: 'q', exception: 'q', answered: 'x', bad: 'bad', failed: 'bad' };
const pill = (t) => t ? `<span class="pill ${PILL[t] || 'q'}">${esc(t)}</span>` : '';
B.table = (b) => {
  const t = el('div', 'tbl');
  const head = `<thead><tr>${b.columns.map((c) => `<th${c.num ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>`;
  const body = b.rows.map((row) => row.group != null ? `<tr><td class="group" colspan="${b.columns.length}">${esc(row.group)}</td></tr>` : `<tr>${row.map((cell, i) => { const c = b.columns[i] || {}; const v = c.pill ? pill(cell) : cell == null ? '' : cell; return `<td class="${c.num ? 'num' : ''} ${c.muted ? 'what' : ''}">${v}</td>`; }).join('')}</tr>`).join('');
  t.innerHTML = `<table class="${b.stack ? 'stack-sm' : ''}">${head}<tbody>${body}</tbody></table>`;
  return t;
};
B.changes = (b) => B.table({ stack: true, columns: [{ label: b.head ? b.head[0] : 'Your comment', muted: true }, { label: b.head ? b.head[1] : 'What was done' }, { label: '', pill: true }],
  rows: b.groups.flatMap((g) => [{ group: g.section }, ...g.items.map((c) => [esc(c.ask), c.done, c.tag])]) });
B.decisions = (b) => B.table({ stack: true, columns: [{ label: 'Decision' }, { label: 'What', muted: true }, { label: 'Why', muted: true }],
  rows: b.items.map((d) => [`<code>${esc(d.id)}</code><br>${pill(d.kind)}${d.isNew ? ' ' + pill('new') : ''}`, esc(d.what), `${esc(d.why || '')}<br><span style="color:var(--faint)">${esc(d.decided || '')}</span>`]) });

/* shots: a sideways row, each opens in the viewer */
const LB = { items: [], at: 0, from: null };
B.shots = (b) => {
  const wrap = el('div');
  const id = uid('shots');
  wrap.innerHTML = `<div class="controls">${b.label ? `<h3 style="margin:0">${esc(b.label)}</h3>` : '<span></span>'}<div class="rowbtns"><button type="button" data-d="-1" aria-label="Previous pictures">←</button><button type="button" data-d="1" aria-label="Next pictures">→</button></div></div>${b.note ? `<p class="sub" style="margin-bottom:12px">${b.note}</p>` : ''}<div class="shots" id="${id}"></div>`;
  const row = $('.shots', wrap), base = LB.items.length;
  LB.items.push(...b.items);
  row.innerHTML = b.items.map((s, i) => `<figure class="shot" style="margin:0"><button type="button" class="img" data-i="${base + i}" aria-label="Open: ${esc(s.title)}"><img src="${s.src}" alt="${esc(s.title)}" loading="lazy"></button><figcaption class="cap"><b>${esc(s.title)}</b><span>${s.text || ''}</span></figcaption></figure>`).join('');
  row.addEventListener('click', (e) => { const x = e.target.closest('button.img'); if (x) lbOpen(+x.dataset.i, x); });
  wrap.querySelectorAll('.rowbtns button').forEach((x) => x.addEventListener('click', () => row.scrollBy({ left: +x.dataset.d * Math.min(row.clientWidth * 0.9, 660), behavior: 'smooth' })));
  return wrap;
};
const lb = $('#lb');
const lbShow = (i) => { LB.at = (i + LB.items.length) % LB.items.length; const s = LB.items[LB.at]; $('#lb-img').src = s.src; $('#lb-img').alt = s.title; $('#lb-cap').innerHTML = `<b>${esc(s.title)}</b>${s.text || ''}`; };
const lbOpen = (i, from) => { LB.from = from; lbShow(i); lb.hidden = false; document.body.style.overflow = 'hidden'; $('#lb-close').focus(); };
const lbClose = () => { lb.hidden = true; document.body.style.overflow = ''; if (LB.from) LB.from.focus(); };
$('#lb-close').addEventListener('click', lbClose);
$('#lb-prev').addEventListener('click', () => lbShow(LB.at - 1));
$('#lb-next').addEventListener('click', () => lbShow(LB.at + 1));
lb.addEventListener('click', (e) => { if (e.target === lb) lbClose(); });
addEventListener('keydown', (e) => { if (lb.hidden) return; if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbShow(LB.at - 1); else if (e.key === 'ArrowRight') lbShow(LB.at + 1); });

/* ladder: a number line with marks */
B.ladder = (b) => {
  const box = el('div', 'ladder'), L = b.values, max = L[L.length - 1], W = 1000, H = 92, x = (v) => 14 + (v / max) * (W - 28);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(b.aria || 'Ladder')}">`;
  s += `<line x1="${x(0)}" x2="${x(max)}" y1="46" y2="46" stroke="${css('--line')}" stroke-width="2"/>`;
  (b.bands || []).forEach(([a, c, lab]) => { s += `<text x="${(x(a) + x(c)) / 2}" y="86" fill="${css('--faint')}" font-size="11" text-anchor="middle">${esc(lab)}</text><line x1="${x(a) + 2}" x2="${x(c) - 2}" y1="72" y2="72" stroke="${css('--line')}"/>`; });
  const labelled = new Set(b.labelled || L.filter((v) => v % 16 === 0));
  L.forEach((v) => { const big = v % 8 === 0; s += `<line x1="${x(v)}" x2="${x(v)}" y1="${big ? 38 : 41}" y2="${big ? 54 : 51}" stroke="${css('--muted')}"/>`; if (labelled.has(v)) s += `<text x="${x(v)}" y="66" fill="${css('--muted')}" font-size="11" text-anchor="middle">${v}</text>`; });
  const used = {}; (b.marks || []).forEach((m) => (used[m.v] ||= []).push(m.label));
  Object.entries(used).forEach(([v, names]) => { s += `<circle cx="${x(+v)}" cy="46" r="5" fill="${css('--accent')}"><title>${v}: ${esc(names.join(', '))}</title></circle>`; });
  (b.callouts || []).forEach((c, i) => { s += `<text x="${x(c.v)}" y="${i % 2 ? 18 : 28}" fill="${css('--accent-2')}" font-size="11" text-anchor="middle">${esc(c.label)}</text>`; });
  box.innerHTML = s + '</svg>';
  return box;
};

/* relations: paired bars (the ratio of two levels at both ends of the range) */
B.relations = (b) => {
  const rows = b.rows, W = 460, rowH = 30, H = rows.length * rowH + 28, x0 = 150, top = b.max || 1.7, x = (k) => x0 + ((k - 1) / (top - 1)) * (W - x0 - 10);
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Ratios">`;
  s += `<line x1="${x(b.min)}" x2="${x(b.min)}" y1="4" y2="${H - 20}" stroke="${css('--warn')}" stroke-dasharray="3 3"/><text x="${x(b.min)}" y="${H - 6}" fill="${css('--warn')}" font-size="10.5" text-anchor="middle">×${b.min} least</text>`;
  [1, 1.2, 1.4, 1.6].filter((k) => k <= top).forEach((k) => { s += `<text x="${x(k)}" y="${H - 6}" fill="${css('--faint')}" font-size="10.5" text-anchor="middle">×${k}</text>`; });
  rows.forEach((r, i) => {
    const y = 6 + i * rowH;
    s += `<text x="0" y="${y + 15}" fill="${css('--muted')}" font-size="11.5">${esc(r.label)}</text>`;
    s += `<rect x="${x0}" y="${y + 3}" width="${Math.max(1, x(r.k0) - x0)}" height="8" rx="2" fill="${css('--accent')}" opacity="0.55"><title>${esc(b.ends ? b.ends[0] : 'start')}: ×${r.k0.toFixed(3)}</title></rect>`;
    s += `<rect x="${x0}" y="${y + 13}" width="${Math.max(1, x(r.k1) - x0)}" height="8" rx="2" fill="${css('--accent')}"><title>${esc(b.ends ? b.ends[1] : 'end')}: ×${r.k1.toFixed(3)}</title></rect>`;
    s += `<text x="${Math.max(x(r.k0), x(r.k1)) + 6}" y="${y + 16}" fill="${css('--faint')}" font-size="10.5">${r.k0.toFixed(2)} · ${r.k1.toFixed(2)}</text>`;
  });
  return el('div', '', s + `</svg><p style="font-size:12px;margin-top:6px;color:var(--muted)">${esc(b.note || 'Lighter bar: at the start of the range. Darker: at the end.')}</p>`);
};

/* heightLine: how a screen's height maps to the size it counts as (a line through two points, capped) */
B.heightLine = (b) => {
  const W = 460, H = 200, l = 40, bm = 26, t = 10, r = 12, [h0, h1] = b.range || [300, 1100], vmin = b.from.v - 120, vmax = b.to.v + 60;
  const hx = (h) => l + ((h - h0) / (h1 - h0)) * (W - l - r), vy = (v) => H - bm - ((v - vmin) / (vmax - vmin)) * (H - bm - t);
  const k = (b.to.v - b.from.v) / (b.to.h - b.from.h), f = (h) => Math.min(b.to.v, Math.max(b.from.v, b.from.v + (h - b.from.h) * k));
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Screen size by height">`;
  (b.hTicks || [400, 600, 800, 1000]).forEach((h) => { s += `<line x1="${hx(h)}" x2="${hx(h)}" y1="${t}" y2="${H - bm}" stroke="${css('--line')}"/><text x="${hx(h)}" y="${H - 8}" fill="${css('--faint')}" font-size="10.5" text-anchor="middle">${h} tall</text>`; });
  (b.vTicks || [b.from.v, b.to.v]).forEach((v) => { s += `<line x1="${l}" x2="${W - r}" y1="${vy(v)}" y2="${vy(v)}" stroke="${css('--line')}"/><text x="${l - 6}" y="${vy(v) + 4}" fill="${css('--faint')}" font-size="10.5" text-anchor="end">${v}</text>`; });
  let p = ''; for (let h = h0; h <= h1; h += 5) p += (p ? 'L' : 'M') + hx(h).toFixed(1) + ',' + vy(f(h)).toFixed(1) + ' ';
  s += `<path d="${p}" fill="none" stroke="${css('--accent')}" stroke-width="2.5"/>`;
  [b.from, b.to].forEach((pt) => { s += `<circle cx="${hx(pt.h)}" cy="${vy(pt.v)}" r="4.5" fill="${css('--accent')}"/>${pt.label ? `<text x="${hx(pt.h) + 8}" y="${vy(pt.v) + (pt === b.from ? -8 : 14)}" fill="${css('--accent-2')}" font-size="10.5">${esc(pt.label)}</text>` : ''}`; });
  (b.examples || []).forEach((e) => { s += `<circle cx="${hx(e.h)}" cy="${vy(f(e.h))}" r="3.5" fill="${css('--fg')}"/><text x="${hx(e.h) + 8}" y="${vy(f(e.h)) + 4}" fill="${css('--muted')}" font-size="10.5">${esc(e.label)}</text>`; });
  return el('div', '', s + `</svg>${b.note ? `<p style="font-size:12px;margin-top:6px;color:var(--muted)">${esc(b.note)}</p>` : ''}`);
};

/* picture: measured values across screen sizes; one overlay chart per group (All first, log scale), or small
   multiples with before and after; legend hover dims the other lines */
B.picture = (b) => {
  const wrap = el('div'), groups = Object.assign({}, b.groups);
  const allKeys = [...new Set(Object.values(b.groups).flatMap((g) => g.keys))];
  groups.all = { label: 'All', keys: allKeys };
  const order = ['all', ...(b.order || Object.keys(b.groups))];
  const axes = b.axes || { width: { label: 'By width', note: 'Screen width (px)' } };
  const saved = store.get(KEY + ':picture') || {};
  const state = { tab: order.includes(saved.tab) ? saved.tab : 'all', axis: axes[saved.axis] ? saved.axis : Object.keys(axes)[0], overlay: saved.overlay !== false, off: new Set() };
  const save = () => store.set(KEY + ':picture', { tab: state.tab, axis: state.axis, overlay: state.overlay });
  const hasBefore = !!(b.sweep.before);
  wrap.innerHTML = `<div class="controls"><div class="seg" role="group" aria-label="Group">${order.map((k) => `<button type="button" data-tab="${k}">${esc(groups[k].label)}</button>`).join('')}</div>
    <div class="right">${Object.keys(axes).length > 1 ? `<div class="seg" role="group" aria-label="Axis">${Object.entries(axes).map(([k, a]) => `<button type="button" data-ax="${k}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    ${hasBefore ? `<label class="switch"><input type="checkbox" checked><span></span>Overlay</label>` : ''}</div></div><p class="key"></p><div class="out"></div>`;
  const out = $('.out', wrap), note = $('.key', wrap), colorOf = (k) => PAL[allKeys.indexOf(k) % PAL.length];
  const xKey = () => axes[state.axis].x || (state.axis === 'width' ? 'w' : 'h');
  const series = (tag, key) => ((b.sweep[tag] || {})[state.axis] || []).filter((r) => r[key] != null).map((r) => [r[xKey()], r[key]]);
  const label = (k) => (b.labels || {})[k] || k;
  function chart(keys, { w = 1000, h = 420, multi = false } = {}) {
    const l = multi ? 34 : 46, rr = 12, t = 12, bm = multi ? 22 : 30;
    const all = keys.flatMap((k) => [...series('after', k), ...(multi ? series('before', k) : [])]);
    if (!all.length) return { svg: '<svg></svg>', X: () => 0, x0: 0, x1: 1, l, rr, w };
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs); let y0 = 0, y1 = Math.max(...ys) * 1.06;
    if (multi) { y0 = Math.max(0, Math.min(...ys) * 0.85); y1 = Math.max(...ys) * 1.06; if (y1 - y0 < 4) { y1 += 2; y0 = Math.max(0, y0 - 2); } }
    const log = !multi && state.tab === 'all' && b.allLog !== false && Math.max(...ys) / Math.max(1, Math.min(...ys.filter((v) => v > 0))) > 20;
    if (log) { y0 = 2 ** Math.floor(Math.log2(Math.max(1, Math.min(...ys.filter((v) => v > 0))))); y1 = Math.max(...ys) * 1.12; }
    const X = (v) => l + ((v - x0) / (x1 - x0 || 1)) * (w - l - rr);
    const Y = log ? (v) => h - bm - ((Math.log2(Math.max(v, y0)) - Math.log2(y0)) / (Math.log2(y1) - Math.log2(y0))) * (h - t - bm) : (v) => h - bm - ((v - y0) / (y1 - y0 || 1)) * (h - t - bm);
    let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(keys.map(label).join(', '))}">`;
    const nice = (span) => { const raw = span / (multi ? 3 : 6), p = 10 ** Math.floor(Math.log10(raw || 1)), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
    const yT = []; if (log) { for (let v = y0; v <= y1; v *= 2) yT.push(v); } else { const sy = nice(y1 - y0); for (let v = Math.ceil(y0 / sy) * sy; v <= y1; v += sy) yT.push(v); }
    yT.forEach((v) => { s += `<line x1="${l}" x2="${w - rr}" y1="${Y(v)}" y2="${Y(v)}" stroke="${css('--line')}"/><text x="${l - 6}" y="${Y(v) + 4}" fill="${css('--faint')}" font-size="${multi ? 10 : 11}" text-anchor="end">${r1(v)}</text>`; });
    const ticks = (multi ? axes[state.axis].ticksSmall : null) || axes[state.axis].ticks || [];
    const solid = new Set(axes[state.axis].solid || []);
    ticks.filter((v) => v >= x0 && v <= x1).forEach((v) => { s += `<line x1="${X(v)}" x2="${X(v)}" y1="${t}" y2="${h - bm}" stroke="${css('--line')}" stroke-dasharray="${solid.has(v) ? '0' : '2 4'}"/><text x="${X(v)}" y="${h - bm + (multi ? 14 : 18)}" fill="${css('--faint')}" font-size="${multi ? 10 : 11}" text-anchor="middle">${v}</text>`; });
    const path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join('');
    keys.forEach((k) => {
      if (!multi && state.off.has(k)) return;
      if (multi && hasBefore) s += `<path d="${path(series('before', k))}" fill="none" stroke="${css('--before')}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
      s += `<path class="ln" data-k="${k}" d="${path(series('after', k))}" fill="none" stroke="${multi ? css('--accent') : colorOf(k)}" stroke-width="${multi ? 2 : 2.2}" stroke-linejoin="round"/>`;
    });
    s += `<line class="hair" x1="0" x2="0" y1="${t}" y2="${h - bm}" stroke="${css('--muted')}" visibility="hidden"/><rect class="hit" x="${l}" y="${t}" width="${w - l - rr}" height="${h - t - bm}" fill="transparent"/></svg>`;
    return { svg: s, X, x0, x1, l, rr, w, log };
  }
  function wire(host, info, keys, multi) {
    const svg = $('svg', host), hair = $('.hair', svg), hit = $('.hit', svg);
    if (!hit) return;
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect(), vx = ((e.clientX - r.left) / r.width) * info.w;
      const v = info.x0 + ((vx - info.l) / (info.w - info.l - info.rr)) * (info.x1 - info.x0);
      const rows = b.sweep.after[state.axis], k = xKey();
      let best = rows[0]; rows.forEach((row) => { if (Math.abs(row[k] - v) < Math.abs(best[k] - v)) best = row; });
      const before = hasBefore ? ((b.sweep.before[state.axis] || []).find((row) => row[k] === best[k]) || {}) : {};
      hair.setAttribute('x1', info.X(best[k])); hair.setAttribute('x2', info.X(best[k])); hair.setAttribute('visibility', 'visible');
      const vis = keys.filter((kk) => multi || !state.off.has(kk));
      showTip(e, `<b>${esc((axes[state.axis].tip || '{x}').replace('{x}', best[k]))}</b>` + vis.slice(0, 14).map((kk) => `<div><span>${esc(label(kk))}</span><span>${before[kk] != null && before[kk] !== best[kk] ? `<s style="color:var(--faint)">${r1(before[kk])}</s> ` : ''}${r1(best[kk])}</span></div>`).join('') + (vis.length > 14 ? `<div><span>+${vis.length - 14} more</span></div>` : ''));
    });
    hit.addEventListener('pointerleave', () => { hair.setAttribute('visibility', 'hidden'); hideTip(); });
  }
  function draw() {
    wrap.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.tab === state.tab));
    wrap.querySelectorAll('[data-ax]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.ax === state.axis));
    const keys = groups[state.tab].keys, ax = axes[state.axis];
    if (state.overlay || !hasBefore) {
      const info = chart(keys, { h: state.tab === 'all' ? 640 : 420 });
      note.innerHTML = `<span>${esc(ax.note || '')} · now${info.log ? ' · values on a log scale (each line up is double)' : ''} · hover a name below to pick its line out</span>`;
      out.innerHTML = `<div class="chart">${info.svg}<div class="legend">${keys.map((k) => `<button type="button" data-k="${k}" aria-pressed="${!state.off.has(k)}"><i style="background:${colorOf(k)}"></i>${esc(label(k))}</button>`).join('')}</div></div>`;
      wire($('.chart', out), info, keys, false);
      const svg = $('svg', out), legend = $('.legend', out);
      const focusOn = (k) => { svg.classList.toggle('dim', !!k); legend.classList.toggle('dim', !!k); svg.querySelectorAll('.ln').forEach((p) => p.classList.toggle('hi', p.dataset.k === k)); legend.querySelectorAll('button').forEach((x) => x.classList.toggle('hi', x.dataset.k === k)); };
      legend.querySelectorAll('button').forEach((x) => {
        x.addEventListener('click', () => { const k = x.dataset.k; state.off.has(k) ? state.off.delete(k) : state.off.add(k); draw(); });
        x.addEventListener('pointerenter', () => focusOn(x.dataset.k)); x.addEventListener('focus', () => focusOn(x.dataset.k));
        x.addEventListener('pointerleave', () => focusOn(null)); x.addEventListener('blur', () => focusOn(null));
      });
    } else {
      note.innerHTML = `<span><i></i>now</span><span><i class="b"></i>before</span><span>${esc(ax.note || '')}</span>`;
      out.innerHTML = `<div class="multiples">${keys.map((k) => { const a = series('after', k), bb = series('before', k); const end = (p) => (p.length ? r1(p[0][1]) + ' → ' + r1(p[p.length - 1][1]) : '—'); return `<div class="m" data-k="${k}"><h4>${esc(label(k))}<span>${end(bb)} · <b style="color:var(--accent-2)">${end(a)}</b></span></h4></div>`; }).join('')}</div>`;
      out.querySelectorAll('.m').forEach((m) => { const k = m.dataset.k, info = chart([k], { w: 320, h: 150, multi: true }); m.insertAdjacentHTML('beforeend', info.svg); wire(m, info, [k], true); });
    }
  }
  wrap.addEventListener('click', (e) => {
    const tb = e.target.closest('[data-tab]'); if (tb) { state.tab = tb.dataset.tab; state.off.clear(); save(); draw(); }
    const ab = e.target.closest('[data-ax]'); if (ab) { state.axis = ab.dataset.ax; save(); draw(); }
  });
  const sw = $('.switch input', wrap); if (sw) { sw.checked = state.overlay; sw.addEventListener('change', () => { state.overlay = sw.checked; save(); draw(); }); }
  draw();
  return wrap;
};

/* map: rows of segments by screen width, with step lines */
B.map = (b) => {
  const box = el('div', 'map'), rows = b.rows, W = 1100, l = 150, rr = 16, top = 36, rowH = 40, H = top + rows.length * rowH + 30;
  const [x0, x1] = b.range || [320, 1920], X = (v) => l + ((v - x0) / (x1 - x0)) * (W - l - rr);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Responsive map">`;
  (b.ticks || [320, 768, 1024, 1440, 1920]).forEach((v) => { s += `<text x="${X(v)}" y="${H - 10}" fill="${css('--faint')}" font-size="11" text-anchor="middle">${v}</text>`; });
  (b.page || []).forEach((p) => { s += `<line x1="${X(p.w)}" x2="${X(p.w)}" y1="${top - 8}" y2="${H - 24}" stroke="${css('--faint')}" stroke-dasharray="2 3"/><text x="${X(p.w) + 4}" y="${top - 12}" fill="${css('--faint')}" font-size="10.5">${esc(p.label)}</text>`; });
  (b.steps || []).forEach((p) => { s += `<line x1="${X(p.w)}" x2="${X(p.w)}" y1="${top - 22}" y2="${H - 24}" stroke="${css('--accent')}" stroke-width="1.5"/><text x="${X(p.w) + 4}" y="${top - 26}" fill="${css('--accent-2')}" font-size="11" font-weight="600">${esc(p.label)}</text>`; });
  rows.forEach((row, i) => {
    const y = top + i * rowH, hue = row.hue != null ? row.hue : i;
    s += `<text x="0" y="${y + 17}" fill="${css('--fg')}" font-size="12.5" font-weight="500">${esc(row.label)}</text>`;
    const draw = (segs, yy, hh, dim) => segs.forEach((g, j) => { const a = X(Math.max(x0, g.from)), c = X(Math.min(x1, g.to)); s += `<rect x="${a + 1}" y="${yy}" width="${Math.max(1, c - a - 2)}" height="${hh}" rx="4" fill="${PAL[(hue + j) % PAL.length]}" opacity="${dim ? 0.35 : 0.85}"><title>${esc(row.label)}: ${esc(g.label)} (${g.from}–${g.to >= x1 ? '…' : g.to})${dim ? ' — before' : ''}</title></rect>`; if (!dim && c - a > 44) s += `<text x="${a + 7}" y="${yy + 15}" fill="#0b0b0b" font-size="11" font-weight="600">${esc(g.label)}</text>`; else if (!dim && c - a > 14) s += `<text x="${(a + c) / 2}" y="${yy + 15}" fill="#0b0b0b" font-size="11" font-weight="600" text-anchor="middle">${esc(String(g.label).split(' ')[0])}</text>`; });
    draw(row.now, y + 2, 21, false);
    if (row.before) draw(row.before, y + 26, 5, true);
  });
  box.innerHTML = s + '</svg>';
  return box;
};

/* curves: easing graphs */
B.curves = (b) => {
  const S = 150, pad = 18, box = (yMin, yMax) => ({ X: (t) => pad + t * (S - 2 * pad), Y: (v) => S - pad - ((v - yMin) / (yMax - yMin)) * (S - 2 * pad) });
  const solve = (t, f) => { let lo = 0, hi = 1, u = t; for (let i = 0; i < 40; i++) { u = (lo + hi) / 2; if (f(u) < t) lo = u; else hi = u; } return u; };
  const fnOf = (c) => {
    if (c.bez) { const [x1, y1, x2, y2] = c.bez; return (t) => { const u = solve(t, (u) => 3 * (1 - u) ** 2 * u * x1 + 3 * (1 - u) * u * u * x2 + u ** 3); return 3 * (1 - u) ** 2 * u * y1 + 3 * (1 - u) * u * u * y2 + u ** 3; }; }
    if (c.fn === 'power1.out') return (t) => 1 - (1 - t) ** 2;
    if (c.fn === 'power2.out') return (t) => 1 - (1 - t) ** 3;
    if (c.fn === 'linear') return (t) => t;
    if (c.linear) { const pts = c.linear; return (t) => { for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [bb, vb] = pts[i]; return va + (vb - va) * (t - a) / (bb - a || 1); } return 1; }; }
    if (c.path) return (t) => { for (const g of c.path) if (t <= g[6]) { const u = solve(t, (u) => (1 - u) ** 3 * g[0] + 3 * (1 - u) ** 2 * u * g[2] + 3 * (1 - u) * u * u * g[4] + u ** 3 * g[6]); return (1 - u) ** 3 * g[1] + 3 * (1 - u) ** 2 * u * g[3] + 3 * (1 - u) * u * u * g[5] + u ** 3 * g[7]; } return 1; };
    if (c.wave) return (t) => { for (let i = 1; i < c.wave.length; i++) if (t <= c.wave[i][0]) { const [a, va] = c.wave[i - 1], [bb, vb] = c.wave[i]; const k = (t - a) / (bb - a); return va + (vb - va) * (3 * k * k - 2 * k * k * k); } return 1; };
    return (t) => t;
  };
  return el('div', 'curves', b.items.map((c) => {
    const f = fnOf(c), ys = []; for (let i = 0; i <= 120; i++) ys.push(f(i / 120));
    const yMin = Math.min(0, ...ys) - 0.05, yMax = Math.max(1, ...ys) + 0.05, { X, Y } = box(yMin, yMax), peak = Math.max(...ys);
    let p = ''; ys.forEach((v, i) => { p += (i ? 'L' : 'M') + X(i / 120).toFixed(1) + ',' + Y(v).toFixed(1); });
    return `<div class="curve"><svg viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(c.name)} curve"><rect x="${pad}" y="${pad}" width="${S - 2 * pad}" height="${S - 2 * pad}" fill="none" stroke="${css('--line')}"/><line x1="${pad}" x2="${S - pad}" y1="${Y(1)}" y2="${Y(1)}" stroke="${css('--faint')}" stroke-dasharray="3 3"/><line x1="${pad}" x2="${S - pad}" y1="${Y(0)}" y2="${Y(0)}" stroke="${css('--faint')}" stroke-dasharray="3 3"/><path d="${p}" fill="none" stroke="${css('--accent')}" stroke-width="2.4" stroke-linejoin="round"/>${peak > 1.02 ? `<text x="${S - pad}" y="${Y(peak) - 4}" fill="${css('--accent-2')}" font-size="10" text-anchor="end">peak ${peak.toFixed(2)}</text>` : ''}</svg><b>${esc(c.name)}</b><span>${esc(c.use || '')}</span>${c.code ? `<span style="margin-top:4px"><code>${esc(c.code)}</code></span>` : ''}</div>`;
  }).join(''));
};

/* durations: horizontal bars on one scale */
B.durations = (b) => {
  const box = el('div', 'chart'), rows = b.rows, W = 1000, l = 300, rr = 30, rowH = 24, H = rows.length * rowH + 40, max = b.max || 2;
  const X = (v) => l + (Math.min(v, max) / max) * (W - l - rr);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Durations">`;
  for (let v = 0; v <= max + 1e-9; v += max / 8) s += `<line x1="${X(v)}" x2="${X(v)}" y1="4" y2="${H - 26}" stroke="${css('--line')}"/><text x="${X(v)}" y="${H - 10}" fill="${css('--faint')}" font-size="11" text-anchor="middle">${r1(v * 100) / 100}s</text>`;
  let last = '';
  rows.forEach((r, i) => {
    const y = 6 + i * rowH, c = r.kind === 'loop' ? css('--warn') : r.kind === 'scroll' ? css('--faint') : css('--accent');
    s += `<text x="0" y="${y + 14}" fill="${r.group !== last ? css('--fg') : css('--muted')}" font-size="12">${esc(r.name)}</text>`; last = r.group;
    s += `<rect x="${X(0)}" y="${y + 3}" width="${Math.max(2, X(r.s) - X(0))}" height="14" rx="3" fill="${c}"><title>${esc(r.name)}: ${r.s}s</title></rect>`;
    if (r.stagger) s += `<rect x="${X(r.s)}" y="${y + 3}" width="${X(r.s + 4 * r.stagger) - X(r.s)}" height="14" rx="3" fill="${c}" opacity="0.35"/>`;
    if (r.s > max) s += `<text x="${X(max) - 8}" y="${y + 14}" fill="#1a1405" font-size="11" font-weight="600" text-anchor="end">${esc(r.label || r.s + 's')}</text>`;
    else s += `<text x="${X(r.s + (r.stagger || 0) * 4) + 6}" y="${y + 14}" fill="${css('--faint')}" font-size="11">${esc(r.label || r.s + 's')}</text>`;
  });
  box.innerHTML = s + `</svg><div class="legend"><span><i style="background:var(--accent)"></i>a transition or an entrance</span><span><i style="background:var(--warn)"></i>a loop (one cycle, cut at ${max}s)</span><span><i style="background:var(--faint)"></i>follows the scroll or the pointer (smoothing)</span></div>`;
  return box;
};

function render(b) {
  const f = B[b.type]; if (!f) return el('div', '', '');
  const node = f(b);
  if (b.type === 'box' || (!b.title && !b.sub)) return node;                 // a box shows its own title
  const wrap = el('div', 'block'); heading(b, wrap); wrap.appendChild(node); return wrap;
}

/* ── sections and the bar ── */
const main = $('#main'), nav = $('#nav');
D.sections.forEach((sec) => {
  const s = el('section'); s.id = sec.id;
  const w = el('div', 'wrap'); s.appendChild(w);
  w.appendChild(el('h2', '', sec.title));
  if (sec.sub) w.appendChild(el('p', 'sub', sec.sub));
  sec.blocks.forEach((b) => w.appendChild(render(b)));
  main.appendChild(s);
  const a = el('a', '', esc(sec.nav || sec.title)); a.href = '#' + sec.id; nav.appendChild(a);
});

/* the bar scrolls to its section (plain #links do not move an artifact's frame) and marks the section being read */
const links = [...nav.querySelectorAll('a')], sections = links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
const barH = () => $('.bar').getBoundingClientRect().height;
let lockUntil = 0;
links.forEach((a, i) => a.addEventListener('click', (e) => {
  e.preventDefault(); lockUntil = performance.now() + 900; mark(i);
  scrollTo({ top: sections[i].getBoundingClientRect().top + scrollY - barH() + 1, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}));
function mark(i) {
  links.forEach((a, j) => { a.classList.toggle('on', j === i); if (j === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  const a = links[i]; if (!a) return;
  const l = a.offsetLeft, r = l + a.offsetWidth;
  if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: l - 12, behavior: 'smooth' });
}
const current = () => { const line = barH() + 24; let at = -1; sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) at = i; }); if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) at = sections.length - 1; return at; };
let raf = 0;
addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (performance.now() < lockUntil) return; mark(current()); }); }, { passive: true });
mark(current());
})();

# Round 5 (Oct 23, 2026): the audit of the whole system, code only. Rebuilds design/report/data.json from round 4's
# data and this round's measurements:  python3 -I r5_data.py <dir with the measurements> <review.json>
#   fs-before.json / fs-now.json      fullsweep.py on the round-4 build (:8001) and on main (:8002)
#   areas-before.json / areas-now.json   areas.py at 22 screen sizes
#   rules.json                        node rules.mjs --json
#   audit.log                         npm run audit
#   scale-r4.json / decisions-r4.json   design/scale.json and design/decisions.json at 7a1ef87 (round 4 merged)
#   data-r4.json                      this file as round 4 left it (git show edeb745:design/report/data.json)
# review.json: the independent review's verdicts and new findings (written by hand from its report)
import json, sys, os, re, html
HERE = os.path.dirname(os.path.abspath(__file__)); REPORT = os.path.dirname(HERE); ROOT = os.path.dirname(os.path.dirname(REPORT))
M = sys.argv[1]; REVIEW = json.load(open(sys.argv[2]))
J = lambda f: json.load(open(os.path.join(M, f)))
old = json.load(open(os.path.join(M, "data-r4.json")))   # round 4's data (git show 7a1ef87..: design/report/data.json before round 5), never the output
OLD = {s["id"]: s for s in old["sections"]}
scale = json.load(open(os.path.join(ROOT, "design/scale.json"))); scale4 = J("scale-r4.json")
decisions = json.load(open(os.path.join(ROOT, "design/decisions.json")))["decisions"]
dec4 = {d["id"] for d in J("decisions-r4.json")["decisions"]}
FB, FN = J("fs-before.json"), J("fs-now.json")
AB, AN = J("areas-before.json"), J("areas-now.json")
rules = J("rules.json")
audit = open(os.path.join(M, "audit.log")).read()
esc = html.escape
was = lambda a, b: f"<span class='was'>{a}</span>{b}" if a != b else f"{b}"
def r1(v): return ("%.1f" % v).rstrip("0").rstrip(".") if isinstance(v, float) else str(v)

# ── 1. Round 5: the audit ─────────────────────────────────────────────────────────────────────────────────────────
F = REVIEW["findings"]          # the findings after the independent review: [{id, sev, conf, area, what, evidence, fix, verdict}]
sevn = {s: sum(1 for f in F if f["sev"] == s) for s in ["major", "moderate", "minor", "note"]}
shots = [
  {"title": "ID cards at 640 wide: the same, and small", "text": "640×900. The row is at 0.79 here (0.74–0.92 from 620 to 765px): its 13px rows are drawn at 10.2px, the names at 18.8px. Not new: round 4 drew them the same.", "src": "shots/r5-idcards-640.jpg"},
  {"title": "The hero title, 64 → 60", "text": "1440×900. Tim, Oct 22: 60 at most. The team and its airs moved by 1–6px with it.", "src": "shots/r5-hero-1440.jpg"},
  {"title": "Feature tiles: radius and padding 24 → 32", "text": "1440×900. radius/s now ends at 32 (Oct 22) and a tile's padding is its radius, so the text column went 199 → 183px; the texts now start right under the icons. (The dark shape at the top right is a cover of the ring reaching into the gap, as decided.)", "src": "shots/r5-features-1440.jpg"},
  {"title": "Feature tiles on a phone", "text": "390×844 at ×2. Two columns; the descriptions run 3–5 lines of about 12 characters.", "src": "shots/r5-features-390.jpg"},
  {"title": "ID cards: corners of their own", "text": "1440×900. 40px corners (radius/m) → 24px of the card's 240, scaled with the card (Oct 20: 16, Oct 22: 24).", "src": "shots/r5-idcards-1440.jpg"},
  {"title": "Tools: more air", "text": "1440×900. section/air-l (56 → 112) above the heading and between the heading and the cards (was 80 and 64).", "src": "shots/r5-tools-1440.jpg"},
  {"title": "Royalty titles: four lines", "text": "760×900. Two cards side by side, titles at about 16 characters a line: four lines, while the decision says three.", "src": "shots/r5-royalty-760.jpg"},
  {"title": "«Показать больше»", "text": "390×844 at ×2. Four publications, then a line button --section-gap below them (Oct 20).", "src": "shots/r5-pubs-390.jpg"},
]
merged = [
 {"section": "Oct 20 (PRs #19–#22)", "items": [
  {"ask": "No pinned pill: a closed card goes on with the page.", "done": "The pause and its code are gone (stack__hold, the last card's copy, SET.hold). Measured: card positions unchanged px for px; the stack is 1/5 screen per card shorter to scroll.", "tag": "done"},
  {"ask": "No focus ring anywhere.", "done": "Outline none on every focus; forced-colours modes keep the system's ring. Recorded as the exception <code>no-focus-ring</code>. Measured this round: 25 of 25 focusable elements show no change on Tab at 1440.", "tag": "done"},
  {"ask": "Titles come from 60% of a line, no blur.", "done": "<code>M.title</code>: 0.9s, 0.07s between lines, rise 60% (was 18% out of a 0.22em blur). Used by the stack titles and the tools and publications headings.", "tag": "done"},
  {"ask": "«Показать больше»: a line button, coming in as a block.", "done": "<code>.btn--line</code>: ink 70% on an ink 16% border, ink on ink 25% under the mouse (two new tokens); --section-gap (32 → 64) below the cards.", "tag": "done"},
  {"ask": "ID cards: corners of their own, scaled with the card.", "done": "16px of 240 (Oct 20), then 24px (Oct 22). Measured: 24px at every size (was 24 → 40 with the screen).", "tag": "done"},
  {"ask": "Tools and publications: more air.", "done": "New role <code>section/air-l</code> 56 → 112 above, below and under their headings; the CTA's bottom padding uses it too (it was section-y × 1.4, the same numbers).", "tag": "done"},
  {"ask": "The hero picture must not jump at the end of its fade.", "done": "A sand cover fades over the picture instead of the picture fading (one changed frame after the fade before, none now).", "tag": "done"},
 ]},
 {"section": "Oct 22 (Tim's changes, booking window, Safari, Telegram)", "items": [
  {"ask": "Hero title 60 at most.", "done": "<code>type/hero</code> 36 → 60 (was 64). hero / h2 at 1440: ×1.154 (was ×1.231), still above the ×1.125 floor.", "tag": "done"},
  {"ask": "Tile radius 32 at most.", "done": "<code>radius/s</code> 16 → 32 (was 24). Feature padding follows (padding = radius): 32 at 1440, text column 199 → 183px.", "tag": "done"},
  {"ask": "Royalty titles as wide as the card.", "done": "At most 14em, filled lines (pretty). Measured: 3 lines on phones and computers, 4 lines of about 16 characters between 640 and 880 (see the findings).", "tag": "check"},
  {"ask": "Clients: the same padding as every other section.", "done": "The 6vh cut only under --sideways. 1440×900: 80 / 64 (was 54).", "tag": "done"},
  {"ask": "Safari's bottom bar without colour.", "done": "<code>.bar-guard</code>: an empty fixed block over the bottom edge (decision <code>safari-bottom-bar</code>). Only Safari on an iPhone can show it.", "tag": "check"},
  {"ask": "The booking window, Telegram's top strip.", "done": "Planerka in a dialog of the site (book.js, book.css); the white cap behind Telegram's buttons (nav.js initCap), its flicker recorded as a known limit.", "tag": "done"},
 ]},
 {"section": "Oct 22–23 (ID cards, royalty drawings)", "items": [
  {"ask": "ID cards: rise on phones, tip and light on computers.", "done": "<code>M.RISE</code> (80px, 0.7s, 0.12s apart, the stack fading in as one), <code>M.DROP.tip</code> −20°, <code>M.LIGHT</code> from the top at 75°, a 0.5px hairline under the shadow.", "tag": "done"},
  {"ask": "Royalty drawings build up faster.", "done": "play 2.6 → 1.8s, wait 0.3 → 0s, seen 0.35 → 0.15.", "tag": "done"},
 ]},
]
findings_rows = []
for f in F:
    findings_rows.append([f"<b>{esc(f['id'])}</b>", f"<b>{f['what']}</b><br><span style='color:var(--muted)'>{f['evidence']}</span>", f["sev"],
                          f"{esc(f['conf'])}" + (f"<br><span style='color:var(--faint)'>review: {esc(f['verdict'])}</span>" if f.get("verdict") else ""), f["fix"]])
broke = [
 "<b>The audit no longer measures what phones see at its desktop sizes.</b> <code>html { scrollbar-gutter: stable }</code> (book.css, Oct 19) makes headless Chromium keep 15px for a scrollbar it hides, so at 1366 and 1920 the audit lays the page out 15px narrower, as a Windows browser with a classic scrollbar would. Fine as a test, but this round's sweeps switch the gutter off to compare like with like.",
 "<b>hero and h2 are closer.</b> 60 / 52 = ×1.154 on a computer (was ×1.231): the hero title now reads less than one step above the section headings; the floor is ×1.125.",
 "<b>Tiles and half-column cards are closer.</b> radius/s 32 against radius/m 40 on a computer: ×0.8 apart (×0.67 on a phone, ×0.6 before).",
 "<b>The feature texts lost 8% of their width</b> on computers (199 → 183px): 3 lines of about 16 characters.",
 "<b>Nothing else moved.</b> Every other key of the picture (161 widths, 29 heights) is within 0.6px of round 4; no layout step moved (the shift of 10px seen at first was the gutter, above).",
]
sec_changes = {"id": "changes", "nav": "Round 5", "title": "Round 5: the audit",
 "sub": "No new comments this round: an analysis of the whole system as it is on main after PRs #19–#38, measured against the round-4 build (7a1ef87), code only (Figma not opened, as you asked). Findings first, then what the merged rounds of Oct 20–23 did, measured.",
 "blocks": [
  {"type": "stats", "items": [
    {"n": str(len(F)), "unit": "findings", "text": f"{sevn['major']} major, {sevn['moderate']} moderate, {sevn['minor']} minor, {sevn['note']} notes, each re-checked by an independent review"},
    {"n": "0", "unit": "px", "text": "sideways scroll at 161 widths (320–1920); the audit passes at its 9 sizes"},
    {"n": f"{sum(1 for r in rules['rules'] if r['ok'])} / {len(rules['rules'])}", "unit": "rules", "text": "hold in the new rules check (rules.mjs); 2 hard ones break, the rest are lists of candidates"},
    {"n": "9.6", "unit": "px", "text": "the smallest text drawn on the page: the ID cards' rows at 620px wide (10.9 on a 667×375 phone sideways)"}]},
  {"type": "shots", "label": "What it looks like", "note": "Round 4 on the left, main now on the right. Click a picture to open it full size.", "items": shots},
  {"type": "table", "title": "Findings", "sub": "Severity = impact × reach; confidence = how sure the measure is × how likely it was not meant. Ordered by severity. A low-confidence finding is a question, not a defect.", "stack": True,
   "columns": [{"label": "#"}, {"label": "Finding and evidence"}, {"label": "", "pill": True}, {"label": "Confidence", "muted": True}, {"label": "Fix (if you want it)", "muted": True}], "rows": findings_rows},
  {"type": "changes", "title": "Merged since round 4, measured", "head": ["What was asked", "What it is now"], "groups": merged},
  {"type": "list", "title": "What it changed that you might not expect", "items": broke},
 ]}

# ── 2. The system ─────────────────────────────────────────────────────────────────────────────────────────────────
T, T4 = scale["type"]["roles"], scale4["type"]["roles"]
ladder = OLD["system"]["blocks"][0]; ladder = dict(ladder)
ladder["marks"] = [m for k, r in T.items() if not r.get("label") or True for m in ({"v": r["px"][0], "label": k.split("/")[1] + " ↓"}, {"v": r["px"][1], "label": k.split("/")[1] + " ↑"}) if k != "type/note"]
ladder["callouts"] = [{"v": 16, "label": "body 16"}, {"v": 14, "label": "ui 14"}, {"v": 28, "label": "h2 28"}, {"v": 36, "label": "hero 36"}, {"v": 52, "label": "h2 52"}, {"v": 60, "label": "hero 60"}]
type_rows = [[f"<code>{k}</code>", f"<span style='color:var(--faint)'>{T4[k]['px'][0]} → {T4[k]['px'][1]}</span>" if k in T4 else "—",
              (f"<b>{r['px'][0]} → {r['px'][1]}</b>" + (" <span class='pill x'>changed</span>" if k in T4 and T4[k]["px"] != r["px"] else "")), esc(r["use"])] for k, r in T.items()]
rels = [{"label": f"{a.split('/')[1]} / {b.split('/')[1]}", "k0": T[a]["px"][0] / T[b]["px"][0], "k1": T[a]["px"][1] / T[b]["px"][1]} for a, b in scale["type"]["relations"]["pairs"]]
grid = json.loads(json.dumps(OLD["system"]["blocks"][2]))
grid["blocks"][0]["blocks"][0]["rows"] = rels
grid["blocks"][0]["html"] = "<p>Round values cannot keep a ratio, so the levels that must stay apart are listed and checked at both ends (at least ×1.125), by the build and now by <code>rules.mjs</code>. Bars: the ratio at 320 and at 1440. Since Oct 22 hero / h2 is ×1.154 on a computer (was ×1.231), the closest pair there after body / ui.</p>"
S4 = scale4["space"]["roles"]; SP = scale["space"]["roles"]
def sp(k, r):
    v = f"{r['px'][0]} → {r['px'][1]}" + (f" <span style='color:var(--faint)'>by card {r['per']['from']} → {r['per']['to']}</span>" if r.get("per") else "") + (" <span style='color:var(--faint)'>size</span>" if r.get("size") else "")
    if k not in S4: v += " <span class='pill x'>new</span>"
    elif S4[k]["px"] != r["px"]: v = f"<span class='was'>{S4[k]['px'][0]} → {S4[k]['px'][1]}</span> " + v + " <span class='pill x'>changed</span>"
    return [f"<code>{k}</code>" + (f"<br><span style='color:var(--faint)'>{r['css']}</span>" if r.get("css") else ""), v, esc(r.get("use", ""))]
space_rows = [sp(k, r) for k, r in SP.items()]
hidden = [["<code>.stack</code> <code>--card-r</code>", "42.4 → 64.8", "the stack card's radius: half its label's height + its padding (a perfect pill when closed). A fourth radius tier above radius/l; off the ladder by design (stack.css)"],
          ["<code>.feature</code> bottom padding", "21.3 → 42.6", "radius/s × 1.33: the tile's extra air at the bottom; off the ladder"],
          ["<code>.royalty</code> top padding", "64 → 128", "section/pad-y × 1.6: the air after the stack (on the ladder, but no role)"],
          ["<code>.cta__card</code> bottom padding", "air + 65", "the strip of words (65px tall) under the content: structure, not a role"],
          ["<code>.not-found</code> (404.css) bottom padding", "80 → 160", "section/pad-y × 2: past the ladder's 128 (F8)"],
          ["<code>.hero__title</code> <code>--hero-title</code>", "≤ (100vw − gutters) / 7.2", "the hero title shrinks below type/hero only where «На одной волне» would not fit"],
          ["<code>.card__title</code> <code>--card-title</code>", "≤ (card − padding) / 9.8", "the stack titles shrink below h2 only where «без уточнений —» would not fit: 24.6 at 320"],
          ["<code>.idcard</code>", "13 / 24 / 16px × its scale", "an object of a fixed size (decision id-card-object): every size inside it scales with the row or the deck"]]
sec_system = {"id": "system", "nav": "The system", "title": "The system", "sub": "As it is on main (edeb745): design/scale.json, its ladder, roles and relations. Changed since round 4: type/hero, radius/s, and the new section/air-l.",
 "blocks": [ladder,
  {"type": "table", "title": "Text roles", "columns": [{"label": "Role"}, {"label": "Round 4 · 320 → 1440", "num": True}, {"label": "Now · 320 → 1440", "num": True}, {"label": "Used by", "muted": True}], "rows": type_rows},
  grid,
  {"type": "table", "title": "Spacing and radius roles", "sub": f"{len(SP)} roles in scale.json, every end on the ladder except the ones marked size or per.", "stack": True, "columns": [{"label": "Role"}, {"label": "320 → 1440", "num": True}, {"label": "Used by", "muted": True}], "rows": space_rows},
  {"type": "table", "title": "Sizes that are not roles", "sub": "Derived in the styles from a role or from the block itself. Each is deliberate; the multiplied paddings could become roles in scale.json the way section/air-l did (F8).", "stack": True,
   "columns": [{"label": "Where"}, {"label": "320 → 1440", "num": True}, {"label": "What it is", "muted": True}], "rows": hidden},
 ]}

# ── 3. The areas that moved ───────────────────────────────────────────────────────────────────────────────────────
def size(d): return f"{d['W']}×{d['H']}"
area_rows = []
for b, n in zip(AB, AN):
    note = []
    if n["idRow"] < 11.95: note.append(f"ID text {r1(n['idRow'])}px")
    if n["royLines"] >= 4: note.append(f"royalty {n['royLines']} lines")
    area_rows.append([size(n), f"{'deck' if n['deck'] else 'row'} ×{n['idK']}", was(r1(b['idRow']), r1(n['idRow'])), was(r1(b['rTile']), r1(n['rTile'])),
                      was(b['featText'], n['featText']) + f" · {n['featLines']} lines", f"{n['royLines']} lines", was(r1(b['air']), r1(n['air'])), ", ".join(note)])
hero_rows = []
for b, n in zip(AB, AN):
    past = n["hero"] + 0 - n["H"]
    hero_rows.append([size(n), was(round(b["hero"]), round(n["hero"])), was(r1(b["title"]), r1(n["title"])), was(round(b["airTop"]), round(n["airTop"])), was(round(b["pic"]), round(n["pic"])), ""])
sec_areas = {"id": "areas", "nav": "Moved parts", "title": "The parts that moved since round 4", "sub": "Measured at 22 real screen sizes on both builds (phones upright and sideways, tablets, short and tall laptops, 1920, 2560×1440). Round 4 struck through.",
 "blocks": [
  {"type": "cards", "cols": 2, "items": [
    {"title": "ID cards", "html": "An object of 240×345 with its own corners (24px). A row from a 35rem column, scaled by min(1, column / 757); a deck below, scaled by min(1, column / 300). So between 620 and 765px the row is at 0.74–0.92 and its 13px text is drawn at 9.6–12px; 667×375, a phone sideways, at 10.9 (F1)."},
    {"title": "Feature tiles", "html": "radius/s 16 → 32 is also their padding, so the text column is the tile less 2 × radius: 183px at 1440 (was 199). Four in a row from L (58rem), two from S (22rem)."},
    {"title": "Royalty titles", "html": "As wide as the card, at most 14em, lines filled (<code>text-wrap: pretty</code>). Three lines on phones and computers; four between 640 and 880, where the card is beside its drawing (620–730) or two cards share the row (740–880)."},
    {"title": "Tools, publications, CTA", "html": "<code>section/air-l</code> 56 → 112 above and below the tools and the publications and from their headings to their cards; under the CTA card. «Показать больше» stays --section-gap below the cards."}]},
  {"type": "table", "title": "At 22 screen sizes", "stack": True, "columns": [{"label": "Screen"}, {"label": "ID cards"}, {"label": "ID text drawn", "num": True}, {"label": "Tile radius", "num": True}, {"label": "Feature text (px)", "num": True}, {"label": "Royalty title"}, {"label": "Tools air", "num": True}, {"label": "", "muted": True}], "rows": area_rows},
 ]}
hero = json.loads(json.dumps(OLD["hero"]))
hero["sub"] = "Four parts in a column, each with a least and a greatest size (round 4). Re-measured this round: the title is 60 at most since Oct 22, which moves the airs and the team by a few px."
hero["blocks"][1] = {"type": "table", "title": "At 22 screen sizes", "sub": "Round 4 struck through.", "columns": [{"label": "Screen"}, {"label": "Hero", "num": True}, {"label": "Title", "num": True}, {"label": "Air above", "num": True}, {"label": "Team", "num": True}, {"label": "", "muted": True}], "rows": hero_rows}

# ── 4. The whole responsive picture ───────────────────────────────────────────────────────────────────────────────
pic = json.loads(json.dumps(OLD["picture"]["blocks"][0]))
strip = lambda rows: [{k: v for k, v in r.items() if k != "st"} for r in rows]
pic["sweep"] = {"before": {ax: strip(FB[ax]) for ax in ("width", "height")}, "after": {ax: strip(FN[ax]) for ax in ("width", "height")}}
pic["groups"]["space"]["keys"] += ["sectionAirL", "toolsPadY", "royaltyTop", "pubsMoreGap"]
pic["groups"]["cards"]["keys"] += ["padFeatureBottom", "ctaPadBottom"]
pic["groups"]["id"] = {"label": "ID cards & tiles", "keys": ["idRowDrawn", "idNameDrawn", "rId", "statNumber", "statLabel", "logoName", "featureTextW"]}
pic["order"] = ["type", "space", "cards", "id", "blocks", "hero"]
pic["labels"].update({"sectionAirL": "section air L (tools, pubs)", "toolsPadY": "tools: padding above", "royaltyTop": "royalty: padding above", "pubsMoreGap": "cards → «Показать больше»",
  "padFeatureBottom": "features: padding below", "ctaPadBottom": "CTA: padding below", "idRowDrawn": "ID card row text, drawn", "idNameDrawn": "ID card name, drawn",
  "statNumber": "stat number", "statLabel": "stat label", "logoName": "logo name", "featureTextW": "feature text width"})
sec_picture = {"id": "picture", "nav": "Responsive picture", "title": "The whole responsive picture", "sub": "Every size of the page at every 10px of width (1100 tall) and every 25px of height (1440 wide), round 4 dashed, main now in colour; swept again on both builds this round. Lines that moved: hero (64 → 60), radius and padding of the tiles (24 → 32), ID card radius (fixed 24), section air L, the features' bottom padding and text width, the tools' padding; the ID-card tab is new.", "blocks": [pic]}

# ── 5. Responsive map ─────────────────────────────────────────────────────────────────────────────────────────────
def segs(rows, key, labels):
    out, cur = [], None
    for r in rows:
        v = r["st"][key]
        if cur and cur["v"] == v: cur["to"] = r["w"] + 10
        else:
            if cur: out.append(cur)
            cur = {"from": r["w"], "to": r["w"] + 10, "v": v}
    out.append(cur)
    for s in out: s["to"] = min(s["to"], 1920); s["label"] = labels(s.pop("v"))
    return out
roy = lambda w: (1 if 620 <= w <= 730 else 0)
for d in (FB, FN):
    for r in d["width"]: r["st"]["royaltyWide"] = roy(r["w"])
MAPROWS = [("Navbar", "burger", lambda v: "burger" if v else "links"), ("Navbar button", "navCta", lambda v: "button" if v else "none"),
  ("Hero title", "heroNarrow", lambda v: "3 lines" if v else "2 lines"), ("Stack card (1100 tall)", "stackWide", lambda v: "horizontal" if v else "vertical"),
  ("Royalty grid", "royalty", lambda v: f"{v} col"), ("Royalty card", "royaltyWide", lambda v: "beside" if v else "drawing on top"),
  ("ID cards", "deck", lambda v: "deck" if v else "row"), ("Features", "features", lambda v: f"{v} col"), ("Logos", "logos", lambda v: f"{v} col"),
  ("Tools", "tools", lambda v: "side by side" if v == 2 else "stacked"), ("Publications", "pubs", lambda v: f"{v} col"), ("Video card logo", "videoMark", lambda v: "mark" if v else "full")]
map_rows = [{"label": lab, "hue": i, "now": segs(FN["width"], k, f), "before": segs(FB["width"], k, f)} for i, (lab, k, f) in enumerate(MAPROWS)]
map_rows.insert(9, {"label": "ID text drawn", "hue": 6, "now": [{"from": 320, "to": 620, "label": "≥ 12"}, {"from": 620, "to": 765, "label": "9.6–12"}, {"from": 765, "to": 1920, "label": "≥ 12"}], "before": [{"from": 320, "to": 610, "label": "≥ 12"}, {"from": 610, "to": 755, "label": "9.7–12"}, {"from": 755, "to": 1920, "label": "≥ 12"}]})
map_rows.append({"label": "Footer", "hue": 8, "now": [{"from": 320, "to": 768, "label": "button above"}, {"from": 768, "to": 1920, "label": "row"}], "before": [{"from": 320, "to": 768, "label": "button above"}, {"from": 768, "to": 1920, "label": "row"}]})
sec_map = {"id": "map", "nav": "Responsive map", "title": "Responsive map", "sub": "Every block's layout across widths (1100 tall), measured on both builds: no step moved since round 4. Accent lines: the shared column steps (at the screen widths where they fall). Dashed: the page steps of media.css, and the booking window's own 62em.",
 "blocks": [{"type": "map", "range": [320, 1920], "ticks": [320, 390, 610, 768, 1024, 1440, 1920], "steps": [{"w": 390, "label": "S 22rem"}, {"w": 740, "label": "M 43rem"}, {"w": 990, "label": "L 58rem"}, {"w": 610, "label": "ID 35rem"}],
   "page": [{"w": 768, "label": "--phone"}, {"w": 992, "label": "62em"}, {"w": 1024, "label": "--tablet"}], "rows": map_rows}]}

# ── 6. Motion ─────────────────────────────────────────────────────────────────────────────────────────────────────
mo = json.loads(json.dumps(OLD["motion"]))
curves = mo["blocks"][0]["items"]
curves.insert(6, {"name": "reveal (= wave)", "bez": [0.5, 0, 0.5, 1], "use": "The ID cards fading in, slow at both ends (Oct 23). The same numbers as wave: two names for one curve (F5).", "code": "M.curve.reveal"})
curves += [{"name": "deck swipe (outside the table)", "bez": [0.455, 0.03, 0.515, 0.955], "use": "deck.js: power2.inOut for the hint, power2.in for a card thrown away, power1.out after a fast flick. Not in M.curve (F5).", "code": "power2.inOut (GSAP)"},
           {"name": "cookie checkmark (outside the table)", "bez": [0.65, 0, 0.35, 1], "use": "cookies.js DRAW_EASE: «a hand drawing a line». Close to move (0.65, 0, 0.25, 1) but not it (F5).", "code": "cubic-bezier(0.65, 0, 0.35, 1)"}]
rows = [r for r in mo["blocks"][1]["rows"] if r["name"] not in ("Pill pinned, next card waiting", "Drawing follows the open card", "Stack title in", "Stack title out")]
rows[rows.index(next(r for r in rows if r["name"] == "Hero picture fade"))] = {"group": "enter", "name": "Hero picture: a sand cover fades off it", "s": 0.9}
rows += [{"group": "stack", "name": "Title in (stack, tools, publications)", "s": 0.9, "stagger": 0.07, "label": "0.9s + 0.07s per line, from 60% of a line, no blur"},
         {"group": "stack", "name": "Stack title out", "s": 0.3, "label": "0.3s, lifts 12% (leave)"},
         {"group": "enter", "name": "ID cards rise (phones)", "s": 0.7, "stagger": 0.12, "label": "0.7s + 0.12s per card; the stack fades 0.55s"},
         {"group": "enter", "name": "ID card tips flat (computers)", "s": 0.55, "label": "−20° → 0 over the fall, even"},
         {"group": "enter", "name": "«Показать больше» cards", "s": 1.0, "label": "as blocks: 1.0s"},
         {"group": "enter", "name": "Royalty drawing builds up", "s": 1.8, "label": "1.8s, from 0.15 seen (was 2.6s)"},
         {"group": "loop", "name": "Booking loader dots", "s": 1.2, "kind": "loop", "label": "1.2s, ease-in-out, endless while it loads"}]
mo["blocks"][1]["rows"] = rows
mo["blocks"][2]["items"] = [c for c in mo["blocks"][2]["items"] if not c["title"].startswith("Round 4")] + [
  {"title": "Round 5: one table, almost", "html": "Every block of the page takes its curve from <code>M.curve</code> or <code>--ease-*</code>. Three UI parts do not: the deck swipe (power2), the cookie checkmark and the booking loader; and <code>reveal</code> repeats <code>wave</code>. CLAUDE.md lists 7 curves, the table has 8."},
  {"title": "Round 5: no pause in the stack", "html": "Since Oct 20 the stack scrolls evenly: no pinned pill, no last pill's copy, the drawings at their own size (no transform while a card opens). Titles rise 60% of a line, no blur."},
  {"title": "Round 5: ID cards", "html": "Computers: they fall tipped −20° and land flat, lit from the top (M.LIGHT). Phones: they rise into a deck, 0.12s apart, the deck fading in as one picture."}]
mo["sub"] = "From the code (motion.js, tokens.css, the scripts). Round 5: the stack's pause and blur are gone, the ID cards rise and tip, and three curves sit outside the table."

# ── 7. Grammar ────────────────────────────────────────────────────────────────────────────────────────────────────
gr = json.loads(json.dumps(OLD["grammar"]))
cards = gr["blocks"][0]["items"]
for c in cards:
    if c["title"] == "Shape": c["html"] = "Three radii by card size: s (16 → 32) for tiles, m (24 → 40) for half-column cards, l (32 → 56) for full-width cards; the stack cards have their own (half the label + the padding, 42 → 65), the ID cards theirs (24 of 240, scaled with the card). A card's padding is its radius; inner corners are concentric. Exceptions: tool cards padded by their width, the CTA's centred text with generous air."
    if c["title"] == "Colour": c["html"] += " Since Oct 20 also ink 16 and 25 (the line button) and a stronger tint (7%); ink 40 and purple-light are now set but unused."
    if c["title"] == "Motion": c["html"] = "Things arrive with out or settle, travel with move, leave with leave; the ID cards fade on reveal and fall on fall. Hovers 0.2s in, 0.45s out. Nothing pauses the scroll. With “reduce motion” everything is simply shown."
    if c["title"] == "Layout": c["html"] += " One more page step lives outside media.css: the booking window's 62em."
irows = gr["blocks"][1]["rows"]
irows = [r for r in irows if not r[0].startswith("Cards keep the gap")]
upd = {"Every size ends on the ladder": "checked", "Layouts change together": "checked", "Secondary text is ink-60, never a grey hex": "checked"}
irows += [["Nothing pauses the scroll", "the stack (no pinned pill since Oct 20), the logos and the ring follow the scroll itself", "written"],
          ["An object keeps its own sizes", "the ID cards (240×345, corners 24, text 13/24) and the logo tiles (sizes in --u) scale as a whole", "written"],
          ["A title shrinks below its role only to fit its longest unbreakable run", "hero /7.2 of the column, stack titles /9.8 of the card", "implicit"],
          ["Scrolling goes through scroller.js", "every script but nav.js's Telegram cap (deliberate, unrecorded)", "checked"],
          ["Every curve comes from one table", "every block; not the deck swipe, the cookie checkmark, the booking loader", "checked"]]
gr["blocks"][1]["rows"] = irows
gr["blocks"][1]["sub"] = "Status: implicit (followed, never named), written (in a comment, CLAUDE.md or decisions.json), checked (the build, the audit or, new this round, rules.mjs)."
gr["sub"] = "The rules the site follows, in plain words, as of main after Oct 23."

# ── 8. Checks ─────────────────────────────────────────────────────────────────────────────────────────────────────
TITLE = {"every-size-on-the-ladder": "Every size ends on the ladder", "levels-apart": "Text levels keep their distance", "sizes-from-the-scale": "Spacing, radii and type come from the scale",
  "colours-from-tokens": "Colours come from tokens", "colours-from-tokens (shadows)": "Shadows with literal greys", "type-from-the-scale": "Text sizes come from the type scale",
  "spacing-literals": "Spacing literals (candidates for roles)", "multiplied-roles": "No role times a factor", "every-var-defined": "Every var() is set", "every-token-used": "Every token is used",
  "layout-steps-shared": "Layouts change at the shared steps", "no-css-in-comments": "No CSS hidden in a comment", "curves-from-the-table": "Every curve from the table",
  "scroll-through-scroller": "Scrolling through scroller.js", "departures-written-down": "Every departure is written down"}
ritems = []
for r in rules["rules"]:
    hits = "; ".join(f"{h['at']} {h['text'][:80].strip()}" for h in r["hits"][:3]) + (f"; … {len(r['hits']) - 3} more" if len(r["hits"]) > 3 else "")
    ritems.append({"title": TITLE.get(r["id"], r["id"]) + ("" if r["hard"] else " (a list)"), "how": f"{r['how']} — round 5: rules.mjs" + (f". Found: {hits}" if hits else ""),
                   "ok": r["ok"] or not r["hard"], "n": r["n"] if r["n"] else None, "unit": "found" if r["hard"] else "listed"})
ritems.append({"title": "Nothing scrolls sideways", "how": "the page's width against the screen's at 161 widths, 320–1920 (extract_dom.cjs) and at the audit's 9 sizes", "ok": True, "n": 170})
ritems.append({"title": "No text under 12px as drawn", "how": "the audit's 9 sizes pass (768 by 0.1px); the sweep finds the ID cards at 9.6–12px between 620 and 765 wide and 10.9px at 667×375, sizes the audit does not visit (F1)", "ok": False, "n": 15, "unit": "widths"})
dec_items = [{"id": d["id"], "kind": d["kind"], "what": d["what"], "why": d.get("why", ""), "decided": d.get("decided", ""), "isNew": d["id"] not in dec4} for d in decisions]
kept = audit[audit.index("Kept as designed"):].strip()
sec_checks = {"id": "checks", "nav": "Checks", "title": "Checks", "sub": "Everything that was run this round, on main (edeb745).",
 "blocks": [
  {"type": "stats", "items": [{"n": "9", "unit": "sizes", "text": "audit (npm run audit): all checks passed, 6 exceptions kept as designed"},
    {"n": f"{sum(1 for r in rules['rules'] if r['ok'])} / {len(rules['rules'])}", "unit": "rules", "text": "hold in rules.mjs; broken: " + ", ".join(TITLE[r['id']] for r in rules['rules'] if r['hard'] and not r['ok'])},
    {"n": "0", "unit": "overflow", "text": "sideways scroll at 161 widths"},
    {"n": str(len(decisions)), "unit": "decisions", "text": f"in the register, {sum(1 for d in dec_items if d['isNew'])} new since round 4"}]},
  {"type": "rules", "items": ritems},
  {"type": "decisions", "title": "Decisions register", "sub": f"design/decisions.json: {len(decisions)} entries; the ones added since round 4 marked new.", "items": dec_items},
  {"type": "list", "title": "The independent review", "sub": REVIEW["sub"], "items": REVIEW["items"]},
  {"type": "pre", "summary": "Audit output: kept as designed (6 exceptions)", "text": kept},
 ]}

# ── 9. Next ───────────────────────────────────────────────────────────────────────────────────────────────────────
sec_next = {"id": "next", "nav": "Next", "title": "Next", "blocks": [{"type": "list", "items": REVIEW["next"]}]}

# ── 10. Earlier rounds ────────────────────────────────────────────────────────────────────────────────────────────
r4 = json.loads(json.dumps(OLD["changes"])); r4["id"] = "round4"; r4["nav"] = "Round 4"; r4["title"] = "Round 4: what changed (PR #13, merged)"
r4["sub"] = (r4.get("sub") or "") + " Since then (Oct 20) the pinned pill and its pause were taken out again (decision pinned-pill)."
stack = json.loads(json.dumps(OLD["stack"]))
stack["title"] = "How the stack moves"; stack["sub"] = "Everything that moves with the scroll is moved by the browser (sticky); the script only decides which title and drawing are shown. Updated for Oct 20: no pause, drawings at their own size, titles without blur."
stack["blocks"][0]["items"] = [c for c in stack["blocks"][0]["items"] if c["title"] not in ("The pinned pill", "The last pill", "The drawing follows the open part")]
for c in stack["blocks"][0]["items"]:
    if c["title"] == "Titles": c["html"] = "In: 0.9s, rising from 60% of a line, lines 0.07s apart, the arrive curve, no blur. Out: 0.3s, lifting 12%, the leave curve."
stack["blocks"][0]["items"].append({"title": "The drawing stays put", "html": "While a card opens and closes the drawing keeps its size and place with the card open: the card's moving edge covers and uncovers it (Tim, Oct 20)."})

old["meta"].update({
  "eyebrow": "Round 5 · an audit of the whole system · main at edeb745 (PRs #19–#38) · code only",
  "title": "The whole system, audited: what holds, what drifted, what to decide",
  "lede": "Everything about the site's sizes, layouts and motion in one place, measured again on main after the merged rounds of Oct 20–23: the ladder and roles, every size at every width and height, the responsive map, the curves, the grammar and the checks. Round 5 had no comments; it is an audit, so its findings come first, each re-checked by an independent review. Rounds 4 and 3 are kept at the end.",
  "footer": "Measured on the built site in headless Chromium 141 (software rendering), October 23, 2026. Before = the round-4 build (7a1ef87, PR #13 merged); now = main (edeb745). The stable scrollbar gutter of main is switched off in the sweeps, as on phones (see Round 5). Figma not opened this round."})
old["sections"] = [sec_changes, sec_system, sec_areas, hero, sec_picture, sec_map, stack, OLD["navbar"], mo, gr, sec_checks, sec_next, r4, OLD["round3"]]
json.dump(old, open(os.path.join(REPORT, "data.json"), "w"), ensure_ascii=False, indent=1)
print("sections:", [s["id"] for s in old["sections"]])

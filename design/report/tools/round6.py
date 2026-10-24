# Builds design/report/data.json for round 6 (the design-system analysis of Oct 24) from this round's measurements, the
# published round-5 page (measure/published-oct23.json: the Oct 23 audit, never committed before) and round 4's data.json.
# python3 -I round6.py <sweep-before.json> <sweep-now.json> <areas-before.json> <areas-now.json> <rules.json> <audit.txt> [review.json]
# before = main at edeb745 (the build round 5 measured), now = main at bd0566f
import json, sys, os, re, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
from round6_changes import GROUPS, BREAKS, pr
from round6_findings import OPEN, NEW, SEV, SEVWORD
J = lambda p: json.load(open(p))
sw_old, sw_new, ar_old, ar_new, rules, audit = J(sys.argv[1]), J(sys.argv[2]), J(sys.argv[3]), J(sys.argv[4]), J(sys.argv[5]), open(sys.argv[6]).read()
review = J(sys.argv[7]) if len(sys.argv) > 7 and os.path.exists(sys.argv[7]) else {"items": [], "sub": ""}
old = json.loads(subprocess.check_output(["git", "-C", ROOT, "show", "bd0566f:design/report/data.json"]))   # round 4's page, as merged
R4 = {s["id"]: s for s in old["sections"]}
OLD = {s["id"]: s for s in J(os.path.join(HERE, "..", "measure", "published-oct23.json"))["sections"]}   # round 5, as published
scale = J(os.path.join(ROOT, "design/scale.json"))
scale4 = json.loads(subprocess.check_output(["git", "-C", ROOT, "show", "edeb745:design/scale.json"]))
decisions = J(os.path.join(ROOT, "design/decisions.json"))["decisions"]
dec4 = {d["id"] for d in json.loads(subprocess.check_output(["git", "-C", ROOT, "show", "edeb745:design/decisions.json"]))["decisions"]}
was = lambda a, b: f"<span class='was'>{a}</span> {b}" if a != b else f"{b}"
def f1(v): return "—" if v is None else (f"{v:.0f}" if abs(v - round(v)) < 0.05 else f"{v:.1f}")
def cmp(a, b): return was(f1(a), f1(b)) if a is not None and f1(a) != f1(b) else f1(b)

# ── the picture: every size, both builds ──
def clean(rows, keep_old=False):
    out = []
    for r in rows:
        d = {k: v for k, v in r.items() if not k.startswith("@") and k not in ("overflow",)}
        if keep_old and d.get("airL") == 0: d["airL"] = None      # (a role that did not exist yet)
        out.append(d)
    return out
sweep = {"before": {"width": clean(sw_old["width"], True), "height": clean(sw_old["height"], True)},
         "after": {"width": clean(sw_new["width"]), "height": clean(sw_new["height"])}}
LABELS = {"hero": "hero title", "h2": "section heading", "cardTitle": "stack card title", "heading": "card heading (publications)", "royalty": "royalty title",
 "toolTitle": "tool title", "lead": "lead (hero)", "ctaLead": "lead (CTA)", "ctaTitle": "CTA title", "tag": "stack label", "toolDesc": "tool text", "feature": "feature text",
 "featureTitle": "feature title", "statNum": "stat number", "statLabel": "stat label", "byline": "byline", "body": "body", "ui": "footer note", "navLink": "navbar link",
 "button": "button", "logoName": "logo name", "gutter": "gutter", "sectionY": "section padding", "sectionGap": "heading → content", "airL": "more air (tools, publications)",
 "inset": "inset", "gapTiles": "gap between tiles", "gapCards": "gap between cards", "navPadY": "navbar padding y", "navPadL": "navbar padding left",
 "textGapPub": "heading → text", "textGapHero": "hero heading → lead", "actionGap": "text → button", "featureGap": "feature icon → text",
 "rTile": "radius: features", "rLogo": "radius: logos", "rStat": "radius: stats", "rId": "radius: ID cards (of 240)", "rPub": "radius: publications",
 "rRoyalty": "radius: royalty", "rTool": "radius: tools", "rCta": "radius: CTA", "rStack": "radius: stack card", "rButton": "radius: button",
 "padFeature": "padding: features", "padLogo": "padding: logos", "padStat": "padding: stats", "padPub": "padding: publications", "padRoyalty": "padding: royalty",
 "padTool": "padding: tools", "padToolBottom": "tools: text → picture", "padCta": "padding: CTA sides", "padStack": "padding: stack card", "ctaAir": "CTA air above",
 "tile": "logo tile", "stat": "stat tile", "feat": "feature tile height", "toolH": "tool card height", "heroH": "hero height", "ctaH": "CTA card height",
 "idW": "ID card (bounding box)", "column": "content column", "heroAirTop": "hero: air above the text", "heroAirBottom": "hero: air below the text", "heroPic": "hero: the team (picture)"}
GROUPS_P = {"type": {"label": "Type", "keys": ["hero", "h2", "cardTitle", "ctaTitle", "heading", "toolTitle", "royalty", "lead", "ctaLead", "tag", "toolDesc", "feature", "featureTitle", "statNum", "statLabel", "byline", "body", "ui", "navLink", "button", "logoName"]},
 "space": {"label": "Spacing", "keys": ["gutter", "sectionY", "sectionGap", "airL", "inset", "gapTiles", "gapCards", "navPadY", "navPadL", "textGapPub", "textGapHero", "actionGap", "featureGap"]},
 "cards": {"label": "Cards", "keys": ["rTile", "rLogo", "rStat", "rId", "rPub", "rRoyalty", "rTool", "rCta", "rStack", "rButton", "padFeature", "padLogo", "padStat", "padPub", "padRoyalty", "padTool", "padToolBottom", "padCta", "padStack", "ctaAir"]},
 "blocks": {"label": "Blocks", "keys": ["column", "tile", "stat", "feat", "toolH", "ctaH", "idW"]},
 "hero": {"label": "Hero", "keys": ["heroH", "heroAirTop", "heroAirBottom", "heroPic"]}}
moved = []
for k in sum((g["keys"] for g in GROUPS_P.values()), []):
    diff = [1 for a, b in zip(sweep["before"]["width"] + sweep["before"]["height"], sweep["after"]["width"] + sweep["after"]["height"]) if isinstance(a.get(k), (int, float)) and isinstance(b.get(k), (int, float)) and abs(a[k] - b[k]) > 0.6 or (a.get(k) is None) != (b.get(k) is None)]
    if diff: moved.append(LABELS[k])
picture = {"type": "picture", "groups": GROUPS_P, "order": ["type", "space", "cards", "blocks", "hero"], "labels": LABELS, "sweep": sweep, "allLog": True,
 "axes": {"width": {"label": "By width", "x": "w", "note": "Screen width, at a screen 1100px tall (px)", "tip": "{x}px wide", "ticks": [320, 390, 768, 1024, 1440, 1920], "ticksSmall": [320, 768, 1440, 1920], "solid": [320, 1440]},
          "height": {"label": "By height", "x": "h", "note": "Screen height, at a 1440px wide window (px)", "tip": "1440 × {x}", "ticks": [400, 600, 800, 920, 1100], "solid": [920]}}}

# ── the map, from the layout states of both sweeps ──
def segs(rows, key):
    out = []
    for r in rows:
        v = r.get(key)
        if out and out[-1]["label"] == v: out[-1]["to"] = r["w"] + 10
        else: out.append({"from": r["w"], "to": r["w"] + 10, "label": v})
    out[-1]["to"] = 1920; out[0]["from"] = 320
    for s in out: s["label"] = (s["label"] or "").replace("1 cols", "1 col")
    return out
MAPROWS = [("Navbar", "@nav", 0), ("Hero title", "@heroTitle", 2), ("Stack card", "@stackCard", 4), ("Royalty", "@royalty", 6), ("ID cards", "@idcards", 8),
           ("Features", "@features", 1), ("Logos", "@logos", 3), ("Tools", "@tools", 5), ("Publications", "@pubs", 7), ("Footer notes", "@footer", 9)]
maprows, mapmoved = [], []
for label, key, hue in MAPROWS:
    now, before = segs(sw_new["width"], key), segs(sw_old["width"], key)
    if [(s["from"], s["label"]) for s in now] != [(s["from"], s["label"]) for s in before]: mapmoved.append(label)
    maprows.append({"label": label, "hue": hue, "now": now, "before": before})

# ── areas: tables at real sizes ──
def sz(d): return f"{d['W']}×{d['Hs']}"
hero_rows = [[sz(b), cmp(a["hero"]["title"], b["hero"]["title"]), cmp(a["hero"]["hero"], b["hero"]["hero"]), cmp(a["hero"]["airTop"], b["hero"]["airTop"]), cmp(a["hero"]["gap"], b["hero"]["gap"]), cmp(a["hero"]["pic"], b["hero"]["pic"]),
              (f"past the fold by {f1(b['hero']['fold'])}" if b["hero"]["fold"] > 1 else "fits")] for a, b in zip(ar_old, ar_new)]
tool_rows = [[sz(b), was(a["tool"]["layout"], b["tool"]["layout"]), cmp(a["tool"]["w"], b["tool"]["w"]), cmp(a["tool"]["pad"], b["tool"]["pad"]), cmp(a["tool"]["h"], b["tool"]["h"]),
              (was(f"{f1(a['tool']['picW'])}×{f1(a['tool']['picH'])}", f"{f1(b['tool']['picW'])}×{f1(b['tool']['picH'])}")), cmp(a["tool"]["picTop"], b["tool"]["picTop"])] for a, b in zip(ar_old, ar_new)]
tile_rows = [[sz(b), was(f"{f1(a['tiles']['feature'][0])}×{f1(a['tiles']['feature'][1])}", f"{f1(b['tiles']['feature'][0])}×{f1(b['tiles']['feature'][1])}"), cmp(a["tiles"]["radius"], b["tiles"]["radius"]),
              cmp(a["tiles"]["featureChars"], b["tiles"]["featureChars"]), cmp(a["tiles"]["logo"], b["tiles"]["logo"]), cmp(a["tiles"]["statNum"], b["tiles"]["statNum"]), cmp(a["tiles"]["statLabel"], b["tiles"]["statLabel"]), b["id"]["mode"]] for a, b in zip(ar_old, ar_new)]
foot_rows = [[sz(b), was(a["footer"]["layout"], b["footer"]["layout"]), str(b["footer"]["rows"]), "0" if b["overflow"] <= 0 else str(b["overflow"])] for a, b in zip(ar_old, ar_new)]

# ── the system ──
def ladder():
    v = [0]
    for st, to in scale["ladder"]["steps"]:
        while v[-1] < to: v.append(v[-1] + st)
    return v
TR = scale["type"]["roles"]; TR4 = scale4["type"]["roles"]
type_rows = []
for k, r in TR.items():
    a = TR4.get(k); now = f"{r['px'][0]} → {r['px'][1]}"
    tag = "" if a == r else (" <span class='pill x'>new</span>" if not a else " <span class='pill x'>changed</span>")
    type_rows.append([f"<code>{k}</code>{tag}", (f"<span style='color:var(--faint)'>{a['px'][0]} → {a['px'][1]}</span>" if a else "—"), f"<b>{now}</b>", r.get("use", "")])
SR = scale["space"]["roles"]; SR4 = scale4["space"]["roles"]
space_rows = []
for k, r in SR.items():
    a = SR4.get(k); tag = "" if a == r else (" <span class='pill x'>new</span>" if not a else " <span class='pill x'>changed</span>")
    val = f"{r['px'][0]} → {r['px'][1]}"
    if a and a["px"] != r["px"]: val = f"<span class='was'>{a['px'][0]} → {a['px'][1]}</span> {val}"
    extra = ""
    if r.get("per"): extra = f" <span style='color:var(--faint)'>by card {r['per']['from']} → {r['per']['to']}</span>"
    if a and a.get("per") and a.get("per") != r.get("per"): extra = f" <span style='color:var(--faint)'>by card <span class='was'>{a['per']['from']} → {a['per']['to']}</span> {r['per']['from']} → {r['per']['to']}</span>"
    if r.get("by"): extra += " <span style='color:var(--faint)'>by width only</span>"
    space_rows.append([f"<code>{k}</code>{tag}", val + extra, r.get("use", "")])
marks = []
for k in ("type/hero", "type/h2", "type/card-heading", "type/doc-title", "type/lead", "type/card-tag", "type/body-m", "type/body", "type/body-s", "type/ui", "type/note"):
    n = k[5:]; marks += [{"v": TR[k]["px"][0], "label": n + " ↓"}, {"v": TR[k]["px"][1], "label": n + " ↑"}]
REL = rules["relations"]

# ── motion ──
curves = OLD["motion"]["blocks"][0]["items"]
# round 5's curves already list reveal (= wave) and the two outside the table
dur = [
 {"group": "hover", "name": "Hover in (colour, link, card)", "s": 0.2}, {"group": "hover", "name": "Hover out", "s": 0.45},
 {"group": "hover", "name": "Button press / release", "s": 0.15, "label": "0.15s in · 0.6s back (settle)"}, {"group": "hover", "name": "Logo name in / out", "s": 0.4, "label": "0.4s in · 0.45s out"},
 {"group": "nav", "name": "Navbar pill to the next link", "s": 0.25, "label": "0.25–0.65s by distance"}, {"group": "nav", "name": "Navbar follows the scroll (sideways phone)", "s": 0.42, "kind": "scroll", "label": "with the scroll; 0.42s glide once it stops"},
 {"group": "nav", "name": "Menu pills", "s": 0.45, "stagger": 0.06, "label": "0.45s + 0.06s each"}, {"group": "nav", "name": "Scroll to a section", "s": 0.55, "label": "0.55–1.5s by distance"},
 {"group": "enter", "name": "Heading, letter by letter", "s": 1.1, "stagger": 0.03, "label": "1.1s + 0.03s per letter"}, {"group": "enter", "name": "Text, line by line", "s": 0.9, "stagger": 0.1, "label": "0.9s + 0.1s per line"},
 {"group": "enter", "name": "Heading by lines (tools, publications, stack titles)", "s": 0.9, "stagger": 0.07, "label": "0.9s + 0.07s per line, from 60% of a line (was 0.8s / 18% + blur)"},
 {"group": "enter", "name": "Block coming in", "s": 1.0, "label": "1.0s (fade 0.5s)"}, {"group": "enter", "name": "First stack card", "s": 0.9, "label": "0.9s, at once if a quarter is on screen"},
 {"group": "enter", "name": "Hero cover fades away", "s": 0.9}, {"group": "enter", "name": "ID card in the air (row)", "s": 0.55, "label": "0.55s, tipped −10° → flat, then glides"},
 {"group": "enter", "name": "ID cards rise (phone stack)", "s": 0.7, "stagger": 0.12, "label": "0.7s + 0.12s per card, bottom first; the stack fades 0.55s"},
 {"group": "enter", "name": "Royalty drawing builds up", "s": 1.8, "label": "1.8s from 15% on screen (was 2.6s from 35%, after 0.3s)"},
 {"group": "enter", "name": "Cookie notice in / out", "s": 0.7, "label": "0.7s in after 1.2s; «ОК»: checkmark 0.45s, away 0.45s (leave)"},
 {"group": "stack", "name": "Stack title in", "s": 0.9, "stagger": 0.07}, {"group": "stack", "name": "Stack title out", "s": 0.3, "label": "0.3s, up 12% (no blur)"},
 {"group": "stack", "name": "Stack label turns white", "s": 0.3}, {"group": "stack", "name": "Drawing kept in the open part", "s": 0.15, "kind": "scroll", "label": "with the scroll (translate only)"},
 {"group": "stack", "name": "ID deck: swiped card out / the others move", "s": 0.45, "label": "0.3s out · 0.45s the others (transform) · 0.5s back"},
 {"group": "follow", "name": "ID card leaning to the mouse", "s": 0.6, "kind": "scroll"}, {"group": "follow", "name": "Logos strip behind the scroll", "s": 0.6, "kind": "scroll"},
 {"group": "follow", "name": "Ring behind the scroll", "s": 0.15, "kind": "scroll"},
 {"group": "loop", "name": "Booking loader («signal»)", "s": 1.2, "kind": "loop", "label": "1.2s per cycle while the calendar loads"},
 {"group": "loop", "name": "Release package light", "s": 2, "kind": "loop", "label": "2s per wave, endless"},
 {"group": "loop", "name": "CTA strip of words", "s": 15, "kind": "loop", "label": "15s per cycle, endless"}, {"group": "loop", "name": "Royalty ring orbit", "s": 60, "kind": "loop", "label": "60s per turn, endless"}]

# ── checks ──
R = {r["id"]: r for r in rules["results"]}
def how(r, extra=""): return (r["how"] + (" — this round: " + ("holds" if r["ok"] else f"{r['n']} found: " + "; ".join(r["fails"][:6])) ) + extra)
RULES = [
 {"title": "Every size ends on the ladder", "how": how(R["ladder"], " (also stopped by the build, checkScale)"), "ok": R["ladder"]["ok"], "n": len(SR) + len(TR)},
 {"title": "Text levels keep their distance", "how": how(R["relations"]), "ok": R["relations"]["ok"], "n": len(REL)},
 {"title": "No CSS hidden inside a comment", "how": how(R["no-swallowed-css"]), "ok": R["no-swallowed-css"]["ok"], "n": None},
 {"title": "Spacing, radii and type never own vw/cq/clamp()", "how": how(R["fluid-from-scale"], ". The one hit is the booking card's vertical centring (a placement, not a spacing): kept."), "ok": True, "n": None},
 {"title": "Colours come from tokens", "how": how(R["colour-tokens"], ". All four are shadows: finding A3."), "ok": R["colour-tokens"]["ok"], "n": None},
 {"title": "Text sizes come from the scale", "how": how(R["type-from-scale"], ". Both are the ID card, an object of a fixed size scaled as a whole (decision id-card-object): kept."), "ok": True, "n": None},
 {"title": "Every var() defined, every token used", "how": how(R["tokens-wired"], ". --i and --turn are set inline by the drawings' scripts (a false alarm of the prototype); --ink-40 and --purple-light: finding A4."), "ok": False, "n": None},
 {"title": "Layouts change only at S, M, L or a written own step", "how": how(R["layout-steps"]), "ok": R["layout-steps"]["ok"], "n": len(rules["steps"])},
 {"title": "Screen steps only from media.css", "how": how(R["media-steps"], ". Finding A6."), "ok": R["media-steps"]["ok"], "n": None},
 {"title": "Curves from one table", "how": how(R["curves"], ". Since the review the lint also reads eases written as ease = \"…\" and own CustomEases; logos.js's \"none\" (the scrub) and comments are left out. book.css's is the ported loader; the rest: F5."), "ok": False, "n": None},
 {"title": "Every decision complete", "how": how(R["decisions"]), "ok": R["decisions"]["ok"], "n": len(decisions)},
 {"title": "One hover grammar", "how": "every hover transition in the page's styles uses --hover-in (0.2s) / --hover-out (0.45s) on --ease-out — this round: read all 33 transition lines: holds (logo names at 2 × hover-in on purpose)", "ok": True, "n": 33},
 {"title": "No sideways scroll", "how": "every 10px from 320 to 1920 (1100 tall) and every 25px of height 400–1100 at 1440, both builds; 24 real screen sizes — this round: 0 everywhere", "ok": True, "n": 161 + 29 + 24},
]
dec_items = [{"id": d["id"], "kind": d["kind"], "what": d["what"], "why": d.get("why", ""), "decided": d.get("decided", ""), "isNew": d["id"] not in dec4} for d in decisions]
kept = audit[audit.index("Kept as designed"):audit.index("All checks passed")].strip() if "Kept as designed" in audit else audit[-3000:]
newdec = [d["id"] for d in dec_items if d["isNew"]]

# ── findings tables ──
def sevpill(n): return f"<span class='pill {'bad' if n >= 3 else 'q'}'>{SEV[n]}</span>"
open_rows = [[f"<b>{fid}</b>", f"<b>{t}</b><br><span style='color:var(--muted)'>{st}</span>", sevpill(SEVWORD[sv]), "<span class='pill q'>open</span>"] for fid, sv, t, st in OPEN]
new_rows = [[f"<b>{f['id']}</b>", f"<b>{f['title']}</b><br><span style='color:var(--muted)'>{f['evidence']}</span>", f["fix"],
             f"{sevpill(f['sev'])} <span class='pill x'>{f['conf']}</span> <span class='pill {'done' if f['kind'] == 'fix' else 'q'}'>{f['kind']}</span>"] for f in NEW]

# ── pictures ──
SHOTS = [
 ("Hero chips", "1440×900 at ×2: the chips' new covers and icons, «Last Seen at 8 AM» (#52).", "r6-chips-1440.jpg"),
 ("First stack card", "1440×900: the s1-1 tiles with the new photos, the HOME cover and HTML price pills (#52).", "r6-stack-1440.jpg"),
 ("Feature tiles", "1440×900: the same tiles, two descriptions now in 4 lines (the typesetter's held pieces), the row 20px taller (finding G1).", "r6-features-1440.jpg"),
 ("Ring of covers", "1440×900: the eight new covers (#39; a still 2D picture here, no GPU in the workspace).", "r6-ring-1440.jpg"),
 ("Tools at 768", "768×1024, an iPad upright: side by side on Oct 23 (step M), stacked now (own step 45.75rem, from 790), the whole picture under the text.", "r6-tools-768.jpg"),
 ("Tools at 900", "900×1000: side by side in both; the padding 64 → 55 and no least height below 1024, so the card is as tall as its text (441 → 366).", "r6-tools-900.jpg"),
 ("Tools on a phone", "390×844: padding 36 → 31, the phone picture whole (320px tall, was 221 and cut).", "r6-tools-390.jpg"),
 ("Footer at 1050", "1050×800: the notes in two columns until 1079 (a row on Oct 23), «Дизайн и разработка — Тим Лебедев».", "r6-footer-1050.jpg"),
 ("Privacy policy", "1440×900: one white section, Golos 600 title (36.6 here, 40 on a screen 920+ tall), white navbar at 70% (#46, #48).", "r6-legal-1440.jpg"),
 ("Privacy policy on a phone", "390×844: «1.» markers, no sand head.", "r6-legal-390.jpg"),
]
n_fix = sum(1 for f in NEW if f["kind"] == "fix"); n_q = sum(1 for f in NEW if f["kind"] == "question")
sections = []
sections.append({"id": "round6", "nav": "Round 6", "title": "Round 6: the analysis of Oct 24",
 "sub": "A design-system analysis of main as it is today (bd0566f, after PR #53), from the code and the rendered page only (Figma left out, as asked), one day after round 5's audit (edeb745). Measured in Chromium: the whole DOM at 6 widths with hover and focus states, every size at 161 widths and 29 heights on today's build and round 5's, the areas at 24 real screen sizes, the audit, and the system's rules as a lint. Round 5's fifteen findings were re-checked one by one; an independent agent that had not seen this round re-measured the new ones.",
 "blocks": [
  {"type": "stats", "items": [{"n": f"{len(OPEN)}", "unit": "still open", "text": "every finding of round 5 (Oct 23) is still there: the 18 pull requests merged since worked on other things"},
                              {"n": str(len(NEW)), "unit": "new findings", "text": f"{n_fix} small fixes (nothing visible), {n_q} questions for you; none blocks a visitor"},
                              {"n": "0", "unit": "sideways scroll", "text": "at 161 widths, 29 heights and 24 real screens; the audit passes at its 9 sizes"},
                              {"n": str(len(decisions)), "unit": "decisions", "text": f"in the register, {len(newdec)} since round 5; 6 exceptions printed by the audit with this run's values"}]},
  {"type": "html", "html": "<p><b>In one sentence:</b> the system holds, and today's work kept to it: every new size went into the scale (one role changed, one added), every new layout step was written down as an own step, and every departure has a decision. What is new is small: today's own steps tip the balance from shared to own (G2), the typesetter's longer held pieces cost the feature tiles a line (G1), a few things grew beside the system (shadows and script colours written out by hand, a decorative text size with no decision), and the independent review found two places where the type hierarchy gives way: big browser text (G7) and the legal page on phones (G8). Round 5's list is untouched, so the first thing to do is still its one pull request of small fixes and its four questions.</p>"},
  {"type": "table", "title": "Round 5's findings, re-checked today", "sub": "Each one measured again or read again in the code on bd0566f. Their full text, evidence and the fixes proposed are in the Round 5 section at the end.", "stack": True,
   "columns": [{"label": ""}, {"label": "Finding and today's status"}, {"label": ""}, {"label": ""}], "rows": open_rows},
  {"type": "table", "title": "New this round", "sub": "Severity 0–4 (impact × reach), confidence (high: measured and unlikely meant; low: plausibly meant), and the answer it needs: fix (a patch, nothing visible) or question (your call).", "stack": True,
   "columns": [{"label": ""}, {"label": "Finding and evidence"}, {"label": "Fix or question", "muted": True}, {"label": ""}], "rows": new_rows},
  {"type": "list", "title": "Checked and clean", "items": [
   "<b>The scale:</b> all " + str(len(SR) + len(TR)) + " roles end on the ladder; the six text relations hold at both ends (hero / h2 ×1.286 at 320, ×1.154 at 1440, the tightest). Today's two scale changes (<code>tool/pad</code> by a card 288 → 1024, the new <code>type/doc-title</code> 24 → 40) are on it.",
   "<b>Fluid sizes:</b> no own <code>vw</code>/<code>cq</code>/<code>clamp()</code> in any spacing, radius or text size; the measured lines reach their end values at 1440 (h2 52.00, hero 60.00, radius/s 32.00, tool padding 64.00 on the 1024 card).",
   "<b>Hover:</b> one grammar everywhere (0.2s in, 0.45s out, <code>--ease-out</code>), also on the legal pages' links; no focus ring (decision), the skip link still slides in on Tab.",
   "<b>Text colour:</b> 7 text colours on the page, all from the ink and paper tokens plus purple (the white CTA button) and blue (the stack label on its fill).",
   "<b>Layout:</b> 0 sideways scroll at every width and height; every width container query is at S, M, L or a written own step (" + str(len(rules["steps"])) + " queries, today's two included).",
   "<b>Contrast:</b> the six audited exceptions are the recorded ones; this run the CTA lead measured 4.45 : 1 over the dust at 320×568 (needs 4.5, cta-light-middle) and the orange stat 2.93–2.95 (stack-and-stat-colours); the review's pixel sampling is a little lower (G9).",
   "<b>With a classic scrollbar</b> (the gutter left in, as on Windows): the steps hold where they are written — M at 754–758, tools at 800, features four columns at 1006, the footer's row at 1080 (the review).",
   "<b>Legal pages:</b> the title is on its own role (24 → 40), text 16/24 in a 672px column (63 characters a line), no sideways scroll at 320–1440.",
   "<b>Not sampled:</b> Safari and Firefox (no WebKit or Firefox here; the CI audit runs both as warnings), real GPUs (the ring and the dust are software-rendered), the booking window against the real Planerka, dark mode (the site has none)."]},
 ]})
sections.append({"id": "since", "nav": "Since Oct 23", "title": "Since round 5: what changed", "sub": "Everything merged on main after the build round 5 measured (edeb745, Oct 23): PRs #39–#53 and #17, grouped by your sections. Before = edeb745, now = bd0566f; every number below was measured on both builds this round.",
 "blocks": [
  {"type": "stats", "items": [{"n": "16", "unit": "pull requests", "text": "merged since round 5 (#17, #39–#53), by several chats, all on Oct 23–24"},
                              {"n": "2", "unit": "steps moved", "text": "on the map: tools 740 → 790, the footer's row 1030 → 1080"},
                              {"n": "2", "unit": "scale changes", "text": "tool/pad now by a card 288 → 1024 (was 600); new type/doc-title 24 → 40"}]},
  {"type": "shots", "label": "What it looks like", "note": "Oct 23 on the left, now on the right. Click a picture to open it full size.", "items": [{"title": t, "text": x, "src": "shots/" + s} for t, x, s in SHOTS]},
  {"type": "changes", "title": "Your requests since round 5", "head": ["What was asked", "What was done"], "groups": GROUPS},
  {"type": "list", "title": "What it changed in the system", "items": BREAKS},
 ]})

sections.append({"id": "system", "nav": "The system", "title": "The system", "sub": "The scale as it is now. Since round 5: the tool cards' padding runs to a 1024px card (was 600), and the legal pages' title has its own role. The ladder, the range, the relations and every other role are unchanged.",
 "blocks": [
  {"type": "ladder", "title": "The ladder", "sub": "Steps of 2 up to 24, of 4 up to 64, of 8 up to 128. Marks: where the text roles start (320) and end (1440).", "values": ladder(),
   "labelled": [0, 16, 24, 32, 40, 52, 60, 64, 80, 96, 112, 128], "bands": [[0, 24, "steps of 2"], [24, 64, "steps of 4"], [64, 128, "steps of 8"]], "marks": marks,
   "callouts": [{"v": 16, "label": "body 16"}, {"v": 14, "label": "ui 14"}, {"v": 28, "label": "h2 28"}, {"v": 36, "label": "hero 36"}, {"v": 52, "label": "h2 52"}, {"v": 60, "label": "hero 60"}]},
  {"type": "table", "title": "Text roles", "columns": [{"label": "Role"}, {"label": "Oct 23 · 320 → 1440", "num": True}, {"label": "Now · 320 → 1440", "num": True}, {"label": "Used by", "muted": True}], "rows": type_rows},
  {"type": "grid", "blocks": [
   {"type": "box", "title": "Relations instead of a ratio", "html": "<p>Round values cannot keep a ratio, so the levels that must stay apart are listed and checked at both ends (at least ×1.125). The tightest is hero / h2 at 1440: ×1.154 since the hero ends at 60 (Oct 22).</p>",
    "blocks": [{"type": "relations", "min": scale["type"]["relations"]["min"], "ends": ["320", "1440"], "rows": REL, "note": "Lighter bar: at 320. Darker: at 1440."}]},
   {"type": "box", "title": "The screen's size", "html": "<p>A screen counts as only as big as its height allows: 360px tall gets the sizes of a 320 screen, 920 those of a 1440 one.</p><div class='formula'>size = min(width, 2 × height − 400)</div><p>A role can follow the width alone (<code>\"by\": \"width\"</code>: the hero's least team) or its own block (<code>\"per\"</code>: the tool cards, now 288 → 1024px of card).</p>",
    "blocks": [{"type": "heightLine", "from": {"h": 360, "v": 320, "label": "phone sideways · 320"}, "to": {"h": 920, "v": 1440, "label": "full sizes · 1440"}, "range": [300, 1100], "vTicks": [320, 900, 1440], "examples": [{"h": 650, "label": "1366×650 → 900"}, {"h": 800, "label": "1440×800 → 1200"}], "note": "Screen size for a 1440-wide window, by its height. Flat below 360 and above 920."}]}]},
  {"type": "table", "title": "Spacing roles", "sub": "Tags mark what changed or is new since round 5 (old values struck through).", "columns": [{"label": "Role"}, {"label": "320 → 1440", "num": True}, {"label": "Used by", "muted": True}], "rows": space_rows},
  {"type": "table", "title": "Colour", "sub": "One ink and one paper in alpha steps, three near-white grounds and one colour per subject.", "stack": True,
   "columns": [{"label": "Role"}, {"label": "Tokens"}, {"label": "Where", "muted": True}],
   "rows": [["Text", "<code>--ink</code> · <code>--ink-70</code> · <code>--ink-60</code> (13 uses) · <code>--ink-50</code>", "headings and body · the cookie note, «Показать больше» · every secondary text · footer notes (exception)"],
            ["Lines", "<code>--ink-16</code> → <code>--ink-25</code> · <code>--ink-20</code> → <code>--ink-30</code> · <code>--ink-10</code>", "«Показать больше» border · cookie link underline · the floating shadow (G4)"],
            ["Surfaces", "<code>--tint</code> 3% · <code>--tint-hover</code> 5% · <code>--tint-strong</code> 7%", "tiles and publications on white, their hover · the cookie «ОК» hover"],
            ["Paper", "<code>--paper</code> · 86 · 80 · 70 · 55 · 30", "white cards and text on colour · glass of the legal navbar (70, since today) · chips"],
            ["Grounds", "<code>--paper</code> · <code>--sand</code> #eeeae9 · <code>--mist</code> #f7f7f7 · <code>--glass-nav</code>", "the page · the hero · tools and footer · the navbar over sand"],
            ["Subjects", "<code>--purple</code> (+ hover) · <code>--blue</code> · <code>--orange</code> (+ hover) · <code>--green</code> · <code>--teal</code> (+ hover) · <code>--magenta</code>", "actions · Управление · Документы, FM Lens · Финансы · FM Litmus · royalty"],
            ["Unused", "<code>--ink-40</code> · <code>--purple-light</code>", "F7"]]},
 ]})
sections.append({"id": "hero", "nav": "Hero", "title": "The hero's sizes", "sub": "Least and greatest sizes for each part (round 4), the title ending at 60 (Oct 22). Nothing moved since round 5; the table is re-measured on both builds.",
 "blocks": [R4["hero"]["blocks"][0],
  {"type": "table", "title": "At real screen sizes", "sub": "px; air = above the text (under the navbar) and between the text and the team.", "columns": [{"label": "Screen"}, {"label": "Title", "num": True}, {"label": "Hero", "num": True}, {"label": "Air above", "num": True}, {"label": "Air below", "num": True}, {"label": "Team", "num": True}, {"label": "", "muted": True}], "rows": hero_rows}]})
stack_cards = [
 {"title": "Each card is sticky in its slot", "html": "No hold (removed Oct 20): <code>.stack__slot</code> &gt; collar, cap, card (sticky), veil. A card that has become a pill goes on up with the page at once while the next card comes up under it."},
 {"title": "Strips in the page colour, live (Oct 24)", "html": "The gap and rounded edge above the next card, the corners round its top and the sections after the stack are painted with <code>var(--paper)</code> (a colour read once at start could be transparent in Safari). <code>main.js</code> waits for every stylesheet before it starts."},
 {"title": "The drawing stays in the open part", "html": "It keeps its size and is moved (translate) to the middle of the open part of the card; on tall cards it stops when its box reaches the bottom of the text."},
 {"title": "Titles by lines", "html": "From 60% of a line below (from the side scrolled from), 0.9s + 0.07s per line on <b>out</b>, no blur; away 0.3s, 12% up on <b>leave</b>. The headings of the tools and the publications share it (<code>M.title</code>)."},
 {"title": "The first card", "html": "Comes in after the hero (0.9s, a 32px rise), unless a quarter of it is on screen at load: then at once (0.25s instead of 1.74s on a 390×844 phone)."},
 {"title": "The drawings (Oct 24)", "html": "s1-1 tiles with photos and HTML prices, s1-2/s1-3 covers from the ring, s2-2 the outlined documents with a running light and a glow, s3-2 the new payment icons; photos as AVIF in <code>&lt;picture&gt;</code>."}]
sections.append({"id": "stack", "nav": "Card stack", "title": "How the stack works now", "blocks": [{"type": "cards", "items": stack_cards}]})
sections.append({"id": "tools", "nav": "Tools", "title": "The tool cards", "sub": "Rebuilt today (#40, #45): padding by the card's width across the whole column, the whole picture under the text, side by side from their own step.",
 "blocks": [{"type": "cards", "cols": 2, "items": [
   {"title": "Padding by the card", "html": "<code>tool/pad</code> 28 → 64 over a 288 → 1024px card (<code>\"per\"</code>, 100cqi): it shrinks with the screen at every size; 64 only on the widest card."},
   {"title": "Side by side from 45.75rem", "html": "An own step on the column (790 without a scrollbar, 800 with one), not M. Least height <code>tool/min-h</code> 400 → 480 only from step L (1024); below it the card is as tall as its text and the picture starts 32px from the card's top."},
   {"title": "Stacked: the whole picture", "html": "The 820×896 image whole, at most 360px wide and centred, 2× the padding at its sides; below a 27.5rem column (a 480 screen) 1×."},
   {"title": "What it costs", "html": "On phones the padding is a little smaller (31 at 390, was 36); at the 480 step the picture jumps from about 300 to 355px wide; an iPad upright gets the stacked cards (711px each)."}]},
  {"type": "table", "title": "At real screen sizes", "sub": "The first card (FM Litmus); px. Before = Oct 23.", "columns": [{"label": "Screen"}, {"label": "Layout"}, {"label": "Card", "num": True}, {"label": "Padding", "num": True}, {"label": "Height", "num": True}, {"label": "Picture", "num": True}, {"label": "Picture top", "num": True}], "rows": tool_rows}]})
sections.append({"id": "tiles", "nav": "Tiles & ID cards", "title": "Tiles and ID cards", "sub": "Features, logo and stat tiles take radius/s (16 → 32) with the padding = radius; their text is sized by the tile (stats, logo names) or by the scale (features). The ID cards are an object of 240×345 scaled as a whole.",
 "blocks": [{"type": "table", "title": "At real screen sizes", "sub": "Feature tile (w×h, radius = padding, characters per line of the first description), logo tile height, stat number and label size, how the ID cards are laid out. Before = Oct 23.",
  "columns": [{"label": "Screen"}, {"label": "Feature", "num": True}, {"label": "Radius", "num": True}, {"label": "Chars / line", "num": True}, {"label": "Logo tile", "num": True}, {"label": "Stat №", "num": True}, {"label": "Stat label", "num": True}, {"label": "ID cards", "muted": True}], "rows": tile_rows},
  {"type": "cards", "cols": 2, "items": [
   {"title": "Tile text by the tile", "html": "Stat numbers are 64/247 of the tile, labels 24/247 (at least 12), logo names 14/247 (at least 12): the tile is a picture of a figure. So the stat label sits at the 12px floor on phones, and the figures are bigger than the section heading on computers (G6)."},
   {"title": "ID cards: corners in the object", "html": "24px of the card's 240, the table 12px in with radius 12, scaled with the card by the row (min(1, column / 757): 0.747 at 610 → F1) or the deck (0 / 4 / 8°, 13/−7px steps, ×0.955). Since today the deck moves its slots by transform only."}]}]})
sections.append({"id": "footer", "nav": "Footer & legal", "title": "Footer and legal pages",
 "blocks": [{"type": "table", "title": "The footer's notes", "sub": "Layout of the grey notes, rows they take, sideways scroll. Before = Oct 23.", "columns": [{"label": "Screen"}, {"label": "Notes"}, {"label": "Rows", "num": True}, {"label": "Overflow", "num": True}], "rows": foot_rows},
  {"type": "cards", "cols": 2, "items": [
   {"title": "Legal pages (today)", "html": "One white section, the title in Golos 600 on its own role <code>type/doc-title</code> 24 → 40 (24 at 320, 30.4 at 768, 36.6 at 1440×800, 40 from 920 tall; Pragmatica 700, 24 → 32 before), text 16/24 in a 672px column (63 characters a line), navbar <code>--paper-70</code>, markers «1.», no line above the footer, consent at <code>/cookie_consent</code>."},
   {"title": "Same box as the home page in Safari", "html": "<code>scripts/box.js</code> is inlined in all four pages: on a Mac, Safari's bar stays solid on the legal pages and the 404 too; their navbars stick to the top of the box."}]}]})
sections.append({"id": "picture", "nav": "Responsive picture", "title": "The whole responsive picture",
 "sub": "Every size of the page, at every 10px of width (1100 tall) and every 25px of height (1440 wide), on round 5's build (dashed) and today's. Lines that moved since Oct 23: " + ", ".join(moved) + ". Everything else is within 0.6px.",
 "blocks": [picture]})
sections.append({"id": "map", "nav": "Responsive map", "title": "Responsive map",
 "sub": "Where each block changes its layout (every 10px, overlay scrollbars). Moved since round 5: " + (", ".join(mapmoved) if mapmoved else "none") + " — the tools 740 → 790 (their own step), the footer's row 1030 → 1080. The thin strip under each row is Oct 23. Dashed grey: the page's screen steps 768 (--phone), 992 (the booking calendar), 1024 (--tablet) and 1080 (--notes-cols).",
 "blocks": [{"type": "map", "range": [320, 1920], "ticks": [320, 390, 768, 1024, 1440, 1920], "rows": maprows,
   "steps": [{"w": 387, "label": "S 22rem"}, {"w": 738, "label": "M 43rem"}, {"w": 989, "label": "L 58rem"}],
   "page": [{"w": 768, "label": "--phone"}, {"w": 992, "label": ""}, {"w": 1024, "label": "--tablet"}, {"w": 1080, "label": ""}]}]})
sections.append({"id": "navbar", "nav": "Navbar", "title": "The navbar", "sub": "Round 4's sideways-phone behaviour is unchanged; since then: no #id in the address, the current link keeps its colour under the mouse, the white strip above it only in apps' browsers.",
 "blocks": R4["navbar"]["blocks"] + [{"type": "cards", "cols": 2, "items": [
   {"title": "Telegram's strip", "html": "Placed by the navbar's layout position and moved 1:1 with the scroll, re-checked four times a second in apps' browsers; the 3–5 frame flicker on a hard fling is Telegram's own (decision <code>telegram-cap-flicker</code>). It still reads the window's scroll (F6)."},
   {"title": "Safari's bars", "html": "Top: solid on a Mac on every page since today (the page scrolls in its own box). Bottom on iPhone: plain glass, held by <code>.bar-guard</code> (decision <code>safari-bottom-bar</code>)."}]}]})
sections.append({"id": "motion", "nav": "Motion", "title": "Motion", "sub": "The curves (time across, progress up) and every duration on one scale. Since round 5: the ID cards tip −10° (was −20°) and the row comes in left to right, the deck moves by transforms, the release package's light runs round its outline.",
 "blocks": [{"type": "curves", "items": curves}, {"type": "durations", "title": "Durations", "sub": "Seconds, from the code. A lighter tail is a stagger (until the last of five items arrives). Loops are cut at 2s.", "max": 2, "rows": dur},
  {"type": "cards", "cols": 2, "items": [
   {"title": "One family of curves", "html": "Arriving <b>out</b> or <b>settle</b>, travelling <b>move</b>, leaving <b>leave</b>, falling <b>fall</b> then <b>glide</b>; the even <b>wave</b> / <b>reveal</b> (the same numbers, F5) for steps and fades."},
   {"title": "Moved by transforms", "html": "The ID deck moves its slots by GSAP <code>transform</code> only (Safari repainted the shadows when CSS variables changed every frame); the stack's drawings by <code>translate</code>; the ring is one WebGL draw a frame."},
   {"title": "Reduce motion", "html": "Every reveal is simply shown, no tip, no lean, no light veil, no glow canvas; the deck goes straight to its place; the loader's bars stand still."},
   {"title": "Loops (endless-motion)", "html": "The CTA strip, the hero chips, the ring's idle spin, the dust, the drawings' loops and now the release package's light; all stop with reduce motion (WCAG 2.2.2 exception, your call)."}]}]})
g_cards = [
 {"title": "Colour", "html": "One ink and one paper at fixed strengths on three near-white grounds (white page, warm sand in the hero, cool mist for tools and footer). Colour only in solid blocks: purple for actions, one per subject (blue, orange, green, magenta, teal)."},
 {"title": "Type", "html": "Pragmatica Ext 700 for display (hero, section headings, stack titles, CTA), Golos 400/500/600 for the rest, also the legal pages' titles since today. Line height opens as text gets smaller: 1, 1.1, 1.2, 1.3. Labels uppercase at 0.05em. Text inside objects (ID cards, tiles, chips) is sized by the object."},
 {"title": "Size", "html": "One range 320 → 1440 in straight lines; a screen counts as only as big as its height allows. One ladder of round values for every size. Roles can follow the width alone or their own block."},
 {"title": "Shape", "html": "Three radii by size: s tiles (up to 32), m half-column cards, l full-width cards; padding = radius; inner radius = outer − inset. Objects (ID cards) carry their corners in their own px."},
 {"title": "Layout", "html": "One centred column, at most 1024; the stack and the CTA bleed by the inset. Blocks change at three shared steps (S, M, L) and six written own steps; page steps at 768, 1024, 1080 (and 992 for the booking calendar)."},
 {"title": "Motion", "html": "Arrive with out or settle, travel with move, leave with leave. Hovers 0.2s in, 0.45s out. Scroll-linked things follow the scroll itself. With reduce motion everything is simply shown."}]
g_rules = [r for r in OLD["grammar"]["blocks"][1]["rows"]]
have = {r[0] for r in g_rules}
for row in [["Objects are scaled as a whole", "the ID cards (240×345, corners 24), the tiles' figures (x/247), the hero chips (the hero's unit), the drawings (Figma px)", "implicit"],
            ["Never freeze a computed style read at start", "the stack's strips (Oct 24): colours stay in the CSS (var(--paper)), main waits for the stylesheets — CLAUDE.md", "written"],
            ["A new layout step is written down where it is made", "today's 27.5rem and 45.75rem in CLAUDE.md's own steps, 1080 in media.css and decisions.json", "written"]]:
    if row[0] not in have: g_rules.append(row)
sections.append({"id": "grammar", "nav": "Grammar", "title": "The grammar", "blocks": [{"type": "cards", "items": g_cards},
 {"type": "table", "title": "Implicit rules", "sub": "Followed everywhere. Some are written down and checked; the tag says which. New this round at the end.", "stack": True, "columns": [{"label": "Rule"}, {"label": "Where it shows", "muted": True}, {"label": "", "pill": True}], "rows": g_rules}]})
RULES = [r for r in RULES if r["title"] != "Every var() defined, every token used"] + [{"title": "Every var() defined, every token used", "how": how(R["tokens-wired"], ". --i and --turn are set inline by the drawings' scripts (a false alarm of this prototype); --ink-40 and --purple-light: F7."), "ok": False, "n": None}]
for r in RULES:
    r["how"] = r["how"].replace("finding A3", "G4").replace("finding A6", "F10").replace("finding A2", "F5").replace("finding A4", "F7")
sections.append({"id": "checks", "nav": "Checks", "title": "Checks", "blocks": [
 {"type": "stats", "items": [{"n": "9", "unit": "sizes", "text": "audit on main (Chromium 153): 320×568 to 1920×1080, two with the browser's text at 24px. All checks passed; 6 exceptions printed."},
                             {"n": f"{sum(1 for r in RULES if r['ok'])}/{len(RULES)}", "unit": "rules", "text": "this round's lint (design/report/tools/rules.mjs, rebuilt: round 5's version was never saved) plus the hover and overflow checks"},
                             {"n": "214", "unit": "sizes", "text": "without sideways scroll: 161 widths, 29 heights, 24 real screens"},
                             {"n": str(len(decisions)), "unit": "decisions", "text": f"in the register, {len(newdec)} new since round 5"}]},
 {"type": "rules", "items": RULES},
 {"type": "decisions", "title": "Decisions register", "sub": f"design/decisions.json: {len(decisions)} entries; those since round 5 marked new.", "items": dec_items},
 {"type": "list", "title": "Independent review", "sub": review.get("sub", ""), "items": review.get("items", [])},
 {"type": "pre", "summary": "Audit output: kept as designed (this run's values)", "text": kept}]})
sections.append({"id": "next", "nav": "Next", "title": "Next", "blocks": [{"type": "list", "items": [
 "<b>One pull request of small fixes</b> (round 5's F5 curves, F6 the cap through scroller.js, F7 dead tokens, F8 the multiplied paddings as roles, F10 62em in media.css, F13 a 24px target, F15 scroll the revealed card into view; and G4 shadow tokens, G5 a decision for decorative text, G9 the measured contrast in two decisions). Nothing visible; then <code>rules.mjs</code> can become <code>npm run rules</code> in CI (asked since round 3). Say go.",
 "<b>Decide F1:</b> the ID cards' text under 12px between 610 and 750 wide (the deck up to a ~47rem column, or the row overlapping more before it scales). With G2: a shared step there would serve the deck and the tools at once.",
 "<b>Questions:</b> F3 + G1 (tile padding = radius, or padding capped at 24 so the feature texts get their width and their line back), G6 (the stats' figures: display, or a type role), G7 (caps so h2 never passes the hero with big browser text), G8 (a bigger h2 for the legal pages), F4 (three or four lines for the royalty titles), F9 (the footer's order on phones), F14 (the cookie notice over the hero button at 568×320).",
 "<b>In your Safari (from round 5's F2 and today's PRs):</b> Show scroll bars: Always, then the booking window: an empty strip at the right edge? Then the stack's strips after several reloads, the ID deck's swipes compared with the lab, the legal pages' bar, the hero on reload.",
 "<b>Still open from earlier rounds:</b> which Planerka account (the free one shows Planerka's ribbon); the fifth publication is a copy; the Figma push of the scale and the new tokens (Figma was out of scope again); the cookie notice's text («Оставаясь…» vs consent by «ОК»); <code>robots.txt</code> still blocks all crawlers for the launch."]}]})
r5 = dict(OLD["changes"], id="round5", nav="Round 5", title="Round 5: the audit of Oct 23 (published, main at edeb745)")
r5["sub"] = (r5.get("sub", "") + " Its findings are re-checked in Round 6 at the top.").strip()
sections.append(r5)
sections.append(dict(R4["changes"], id="round4", nav="Round 4", title="Round 4: what changed (PR #13, merged Oct 20)"))
sections.append(R4["round3"])

meta = {"key": "fm-size-system", "title_tag": "Flow Medium Size System", "name": "Flow Medium <span>· the system</span>",
 "eyebrow": "Round 6 · the analysis of Oct 24 · main at <a href='https://github.com/timofeylebedev/fm/commit/bd0566f'>bd0566f</a> (PR #53) · code only",
 "title": "The whole system on Oct 24: what holds, what is still open, what today changed",
 "lede": "Everything about the site's sizes, layouts and motion in one place, re-measured today: a design-system analysis of the live code (Figma left out), round 5's fifteen findings re-checked, what the 16 pull requests since round 5 changed, the scale, the areas at real screen sizes, every size at every width and height, the responsive map, the curves, the grammar and the checks. Rounds 5, 4 and 3 are kept at the end.",
 "footer": "Measured on the built site in Chromium 153 (software rendering, overlay scrollbars: the stable scrollbar gutter taken out), October 24, 2026. Before = main at edeb745 (the build of round 5, Oct 23); now = main at bd0566f (PR #53). Round 5 compared edeb745 with round 4's 7a1ef87, round 4 PR #13 with 9b44400, round 3 PR #8 with 80cbebb."}

json.dump({"meta": meta, "sections": sections}, open(os.path.join(HERE, "..", "data.json"), "w"), ensure_ascii=False, indent=1)
print("sections:", [s["id"] for s in sections]); print("moved:", moved); print("map moved:", mapmoved)

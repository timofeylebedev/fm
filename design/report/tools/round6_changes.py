# Round 6's "since the Oct 23 audit" content: every change merged on main after edeb745 (the build round 5 measured),
# by area, with numbers measured this round on both builds (edeb745 vs bd0566f). Imported by round6.py.
PR = "https://github.com/timofeylebedev/fm/pull/"
def pr(*ns): return " ".join(f"<a href='{PR}{n}'>#{n}</a>" for n in ns)

GROUPS = [
 {"section": "Hero", "items": [
  {"ask": "New chip icons and covers (Oct 24).", "done": f"The chips use the ring's covers (HOME, Last Seen at 8 AM, ЛЮБОВЬ, lazy friday) and the s3-2 round icons; two titles changed («Last Seen at 8 AM», EP «lazy friday»). The strip is AVIF q96 (34.5 KB) with a near-lossless WebP fallback. No size of the hero moved (picture block: within 0.6px). {pr(52)}", "tag": "done"},
 ]},
 {"section": "Card stack", "items": [
  {"ask": "In Safari the strips between the cards sometimes vanish (Oct 24).", "done": f"Cause: Safari can run the module script before the stylesheet applies (WebKit bug 261655), and the strips' colour was read once at start. Now <code>main.js</code> waits for every stylesheet and the strips use <code>var(--paper)</code> live. With a stylesheet held back 300 ms: 67/67 wrong frames → 0 (1000×600). {pr(43)}", "tag": "check"},
  {"ask": "New tiles, covers and payment icons in the drawings (Oct 24).", "done": f"s1-1 «Любые проекты…» shows Tim's four photos and HOME with HTML price pills (Figma 974:35745); s1-2 and s1-3 use the ring's covers; s3-2 the new icons on Figma's circle colours. Photos are AVIF in a <code>&lt;picture&gt;</code> (q76–90, 10–35 KB each). {pr(52)}", "tag": "done"},
  {"ask": "The release package drawing: outlined documents, tuned light, a white glow (Oct 24).", "done": f"s2-2: an orange panel with one rounded outline whose light runs clockwise in step with the lines (period 2 s, wave 400px); a half-resolution glow canvas, blurred 3 Figma px and screened over; none with reduce motion. {pr(41)}", "tag": "done"},
 ]},
 {"section": "ID cards", "items": [
  {"ask": "Tipped 10° at the start; the row comes in 1, 2, 3 (Oct 24).", "done": f"<code>M.DROP.tip</code> −20 → −10°. The row came 1, 3, 2 (a turned card reaches higher); it now plays left to right: 0 / 175 / 365 ms. The phone stack still rises bottom first. {pr(42)}", "tag": "done"},
  {"ask": "On the iPhone the cards under a swiped one jump instead of moving (Oct 24).", "done": f"Safari did not run the slots' CSS transition; then changing CSS variables each frame made it repaint the heavy shadows. Every slot now moves by its GSAP <code>transform</code> alone (0.45 s on <code>fm-out</code>), the depth's steps kept as CSS variables. {pr(44, 47)}", "tag": "check"},
 ]},
 {"section": "Releases", "items": [
  {"ask": "The ring with the new covers (Oct 23).", "done": f"Eight new covers, each at the lowest setting with SSIMULACRA2 ≥ 90 against the 640px texture (7 AVIF + 1 near-lossless WebP, ≈ 374 KB; WebP alone ≈ 900). Home stays third, the same pose. {pr(39)}", "tag": "done"},
  {"ask": "Where lines may break: Russian and English, no length limits (merged Oct 24).", "done": f"<code>build/typeset/</code>: 108 → 0 lines ending in a short Russian word. Measured this round, a side effect: two feature descriptions hold longer pieces («а⍽не⍽в⍽последний», «что⍽в⍽работе») and take 4 lines instead of 3, so the feature row grew 258 → 278px at 1440 and 199 → 216 at 420 (finding G1). {pr(17)}", "tag": "check"},
 ]},
 {"section": "Tools", "items": [
  {"ask": "The padding should shrink at every size; the picture under the text never cut (Oct 24).", "done": f"<code>tool/pad</code> 28 → 64 now runs by the card's width 288 → <b>1024</b> (was → 600): 55 on a 900 window (was 64), 31 on a 390 phone (was 36). The stacked picture is the whole 820×896 image, at most 360px wide, 2× padding at its sides down to a 480 screen (own step 27.5rem): 320px tall at 390 (was 221 and cut). {pr(40)}", "tag": "done"},
  {"ask": "Side by side from 800, least height from 1024 (Oct 24).", "done": f"Side by side at an own step 45.75rem (790 without a scrollbar, 800 with one; was step M, 740); <code>--tool-min-h</code> only from step L. 768×1024 (an iPad upright): stacked now, 711px a card (was 432 side by side); 900 wide: 366px (was 441), the picture 32px from the top. {pr(45)}", "tag": "done"},
 ]},
 {"section": "Footer and legal pages", "items": [
  {"ask": "«Дизайн и разработка — Тим Лебедев»; the notes in a row only from 1080 (Oct 24).", "done": f"Two columns up to a 1079 window, one row from 1080 (a footer-only screen step <code>--notes-cols</code> 67.5em; decision <code>footer-notes-1080</code>). {pr(50)}", "tag": "done"},
  {"ask": "Legal pages: one white section, Golos, a 24–40 title, a white navbar, «1.» markers, the consent at /cookie_consent, no design credit (Oct 24).", "done": f"New role <code>type/doc-title</code> 24 → 40 (Golos 600: 24 at 320, 30.4 at 768, 36.6 at 1440×800, 40 from 920 tall; was Pragmatica 700, 24 → 32); navbar <code>--paper-70</code> (was sand 70%); underline offset 5px; no line above the footer; <code>/soglasie_cookie</code> redirects. {pr(46, 48, 49)}", "tag": "done"},
  {"ask": "Solid Safari bar on every page (Oct 24).", "done": f"<code>scripts/box.js</code> inlined in all four pages: the legal pages and the 404 scroll in the same box as the home page on a Mac; their navbars stick to the box's top. {pr(51)}", "tag": "check"},
 ]},
 {"section": "Whole site", "items": [
  {"ask": "Icons and the link picture from Tim's files (Oct 24).", "done": f"Every icon lossless from Tim's 512 (the iPhone icon an opaque square), the 32px ICO cut to a circle, og.png 12.7 → 5.3 KB pixel-identical. {pr(53)}", "tag": "done"},
 ]},
]

BREAKS = [
 "<b>Tools change at their own width now.</b> From 740 to 790 royalty and publications are two columns while the tools are still stacked; on an iPad upright (768×1024) the tools section is about 560px taller (two stacked cards of 711px instead of 432).",
 "<b>Tool cards lost a little padding on phones</b> (31 at 390, was 36): the cost of one straight line from a 288 to a 1024px card.",
 "<b>The typesetter costs the features a line.</b> With no length limits, «а не в последний момент» and «что в работе» stay whole, so two descriptions take 4 lines: every feature tile is 20px taller at 1440 (finding G1).",
 "<b>The footer's notes are two columns between 1024 and 1079</b>, while the navbar already shows its links: the page now has a screen step at 1080.",
 "<b>Main waits for every stylesheet before it starts</b> (the Safari race): on a slow stylesheet the reveals start later rather than wrong.",
 "<b>Nothing else moved.</b> Every other key of the picture (161 widths, 29 heights) is within 0.6px of Oct 23; the map moved in two places (tools 740 → 790, footer row 1030 → 1080).",
]

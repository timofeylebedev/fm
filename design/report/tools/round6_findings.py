# Round 6 (Oct 24): the design-system analysis of main bd0566f.
# OPEN: round 5's findings (the Oct 23 audit), each re-checked today. NEW: what this round found, after the review.
SEV = {0: "0 note", 1: "1 minor", 2: "2 moderate", 3: "3 major", 4: "4 critical"}
SEVWORD = {"note": 0, "minor": 1, "moderate": 2, "major": 3}
OPEN = [
 ("F1", "moderate", "ID cards: text drawn under 12px between 610 and 750", "still open: the row scale min(1, column / 757) gives 0.747 at 610 (rows 9.7px), 0.861 at 700 (11.2), 12px only from about 750; unchanged since Oct 23 (the Oct 24 work moved the cards, not their size)."),
 ("F2", "moderate", "The stable scrollbar gutter takes 15px from fixed layers", "still open (book.css:63 unchanged). This round's sweeps take it out to measure as on a Mac or a phone; with it, every layout step showed up 15–20px late in headless Chromium."),
 ("F13", "moderate", "The booking window's way out is a 21px target", "still open: <code>.book__fail a</code> has no padding (book.css:171)."),
 ("F14", "moderate", "The cookie notice covers the hero's button at 568×320", "still open: 101×18px of «Запланировать демо» under the notice (8–284 × 248–312) until «ОК»; 667×375 clear (52px side by side, no vertical overlap)."),
 ("F3", "minor", "Tiles and half-column cards drift together; feature texts got narrower", "still open, and one line longer since the typesetter (G1)."),
 ("F4", "minor", "Royalty titles take four lines at 320 and 620–880", "still open: 4 lines at 320 and from 620 to 880, 3 at 390–610 and from 920 (decision royalty-by-shape says three)."),
 ("F5", "minor", "Curves outside the one table; reveal = wave", "still open: cookies.js's checkmark cubic-bezier(0.65, 0, 0.35, 1), deck.js's power2.inOut hint, book.css's ease-in-out loader, <code>reveal</code> = <code>wave</code>."),
 ("F6", "minor", "The Telegram cap reads the window's scroll directly", "still open: nav.js:79–109 reads <code>scrollY</code> and listens to the window's scroll."),
 ("F7", "minor", "Two dead colour tokens", "still open: <code>--ink-40</code>, <code>--purple-light</code> read by nothing."),
 ("F8", "minor", "Two sizes off the ladder through a factor", "still open: sections.css:223 radius/s × 1.33 (the features' bottom padding, 42.6 at 1440), 404.css section-y × 2 (160)."),
 ("F15", "minor", "After «Показать больше» the focused card can be off-screen", "still open: pubs.js:25 focuses with preventScroll and does not scroll."),
 ("F9", "minor", "Footer on phones: drawn order and Tab order differ", "still open: footer.css:13 column-reverse below 768."),
 ("F10", "note", "A page step outside media.css (62em)", "still open: book.css's <code>@media (width >= 62em)</code>; the rules check finds it."),
 ("F12", "note", "The stack's label is the heading, its titles subheadings", "unchanged (h2 label, h3 titles)."),
 ("F11", "note", "The stack card's radius is derived", "unchanged, nothing to do."),
]
NEW = [
 dict(id="G1", kind="question", sev=1, conf="high", title="The typesetter costs the feature tiles a line",
  evidence="With no length limits (#17, merged today), «а⍽не⍽в⍽последний момент» and «что⍽в⍽работе» are held whole; in a 184px text column two of the four descriptions now take 4 lines instead of 3 (1440×1100 and 420 wide). The row aligns, so every feature tile grew 258 → 278px at 1440 and 199 → 216 at 420. Other blocks: no size moved by more than 0.6px.",
  fix="Goes with F3. Tested: the tiles' side padding capped at 24 while the radius stays 32 gives the text 199px (was 183) and the lines are back to 3/2/3/3 with a 258px row at 1440 and at 1280×800 (245px); phones do not change (their padding is under 24 already). Or accept the line. The typesetter itself is right to hold the pieces."),
 dict(id="G2", kind="question", sev=1, conf="medium", title="Own layout steps now outnumber the shared ones",
  evidence="Two own container steps and one page step came in today: the tool picture's 27.5rem, the tools side by side at 45.75rem (#40, #45) and the footer notes at 1080 (#50). CLAUDE.md now lists 6 own steps next to the 3 shared (S, M, L), and the page changes layout at 11 widths (390, 420, 610, 620, 740, 770, 790, 990, 1024, 1080, 1380; 9 on Oct 23). Between 740 and 790 royalty and publications are two columns while the tools are still stacked.",
  fix="Each step was your call and is written down. If you want fewer moments of change: a fourth shared step (M+ ≈ 46rem) that the tools and the ID deck (F1 suggests moving it to ~47rem) share."),
 dict(id="G3", kind="question", sev=1, conf="medium", title="In tool cards the title is as close to the logo as to its text",
  evidence="<code>.tool__copy</code> is one flex column with one gap, <code>--text-gap</code> 12 → 16: brand logo → title 16, title → text 16 at 1440 (12/12 on phones). Elsewhere (hero, CTA, publications) the heading → text gap is the closest one around a heading.",
  fix="Logo → title one step more (e.g. 20 → 24), title → text stays <code>--text-gap</code>. Visible: look at it first."),
 dict(id="G4", kind="fix", sev=1, conf="high", title="Shadows have no tokens",
  evidence="The floating shadow <code>0 4px 16px var(--ink-10)</code> is written out 3 times (menu pills, cookie notice, booking close button). The ID card's four-layer shadow and the hero chips' warm shadow are the only literal colours left in the page's stylesheets (round 5 listed them as allowed).",
  fix="<code>--shadow-float</code> (3 uses) and <code>--shadow-object</code> (ID cards) in tokens.css; the chips' warm one as <code>--shadow-chip</code>. Patch, nothing visible."),
 dict(id="G5", kind="fix", sev=0, conf="high", title="Decorative text under 12px has no decision",
  evidence="The hero chips' text is drawn at 8.1px on phones and 12.2px on computers (13–15 × the hero's own unit, 0.62 → 1.2); they are a picture (<code>aria-hidden</code>), and the audit skips <code>.hero-chips</code> and the drawings without printing why.",
  fix="A decision <code>decorative-small-text</code>, so the audit prints it with its sizes each run (like the six exceptions). Patch."),
 dict(id="G6", kind="question", sev=1, conf="low", title="The stats' figures are bigger than their section heading",
  evidence="Stat numbers are 64/247 of a tile: 64px at 1440, above «Три года музыки» (h2, 52); 48.6 vs 48.4 at 1366×650; 29 vs 29.5 on a 390 phone. Their labels sit at the 12px floor on phones and sideways phones.",
  fix="Probably meant (figures as display); then nothing, and the grammar says so."),
]

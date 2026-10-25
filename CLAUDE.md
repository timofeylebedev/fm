# CLAUDE.md — working on the Flow Medium site

Read this before changing anything. `README.md` is the human how-to (commands, where things are); this file is the
rules Claude follows. The site's history, open PRs and open questions live in the claude.ai project "FM"
(doc `claude/website-setup.md`). Claude Code cannot read that doc, so everything needed to work is here.

## The project

- The landing page of Flow Medium, a custom static Vite site (rebuilt from Taptop, same design and motion).
- `main` is the live site: every push to `main` builds and publishes to https://timofeylebedev.github.io/fm/
  (`.github/workflows/deploy.yml`). The real host (flowmedium.pro) is not decided; settings for it are in `deploy/`.
- **Every pull request gets a preview:** the same workflow publishes it to
  `https://timofeylebedev.github.io/fm/pr-preview/pr-<number>/`, posts the link as a comment on the PR, updates it
  on every push and removes it when the PR is closed (`rossjrw/pr-preview-action`). Pages serves the `gh-pages`
  branch: the site at its root, the previews in `pr-preview/` (main's publish keeps them). Give Tim the preview link
  in the PR description; it needs no other branch.
- **The review page of the design system** (every colour, size, step, shadow, curve and decision, and each review round):
  `design/report/site/index.html` (opens from the clone), published at https://timofeylebedev.github.io/fm/report/.
  Its data is read from the repo by `node design/report/build-site.mjs` (`design/report/README.md`).
- Owner and reviewer: Tim (timofeylebedev). The site's language is Russian; talk to Tim in the language he writes in.
- The design lives in Figma: https://www.figma.com/design/JTfxQeW8liN3knCO3GWtns/website-2.0 (Figma Pro plan:
  no Variables REST API, so variables go through the Figma MCP tool `use_figma`).

## How to work

- **Never commit to `main` directly.** Work on a branch, open a pull request, Tim reviews and merges.
  One topic per PR; say in the description what changed, what was measured and what Tim should look at.
- Commit as `timofeylebedev <49580438+timofeylebedev@users.noreply.github.com>`.
- Before a PR: `npm run build && npm run check && npm run audit`. The audit also runs on every PR in CI
  (`.github/workflows/audit.yml`: Chromium fails on problems, Firefox and WebKit only warn).
- Rebase open branches on `main` before they merge; several PRs often touch the same modules (nav.js, main.js).
- For larger rounds Tim asks for an independent review: a separate agent that has not seen the work re-checks it,
  and its findings are fixed in a commit "Fixes from the independent review".
- Measure, don't guess. Numbers in PRs come from a browser (Playwright), not from reading the CSS.
- When something is decided on purpose (an exception, a trade-off Tim chose), add it to `design/decisions.json`
  (who, when, why). `npm run audit` prints the exceptions with measured values.

## Commands

```sh
npm install           # once, Node 22+
npm run dev           # localhost:5173 (runs `npm run tokens` first)
npm run build         # dist/ (not committed)
npm run preview       # dist/ at localhost:4173
npm run check         # html-validate on the four built pages
npm run audit         # sideways scroll, cut text, text < 12px, tap targets < 24px, axe; 9 sizes
                      # FM_ENGINE=firefox|webkit for other engines (npx playwright install <engine> once)
npm run tokens        # design/scale.json + tokens.json -> src/styles/base/tokens.gen.css
npm run tokens:sync   # three-way merge with a fresh Figma export (design/README.md)
npm run images        # assets-src/img -> src/assets/img (AVIF/WebP; commit the outputs)
npm run fonts         # assets-src/fonts -> subsets (pip install fonttools brotli)
node design/report/build-site.mjs   # the review page of the system (design/report/site/, README there)
```

## Rules in the code

- **Scrolling:** never read `window.scrollY` or listen to the window's `scroll` in new code. Use
  `src/scripts/scroller.js` (`y()`, `to()`, `max()`, `onScroll()`, `watchSize()`, `ioRoot`). In Safari on a Mac (every page: `scripts/box.js`, inlined in each `<head>`)
  the page scrolls inside its own box (`html.boxed`, `.page`) so Safari's bar stays solid; `?fmbox=1` / `?fmbox=0`
  turns the box on or off in any browser. See the comment at the top of scroller.js.
  On iPhone, Safari's bottom bar takes the background of anything fixed or sticky at the bottom edge (even clipped);
  `.bar-guard` (base.css: an empty fixed block that takes taps) keeps it plain glass (decision `safari-bottom-bar`);
  never give it a background or a backdrop filter (Safari then paints the bar white).
- **Styles before scripts:** Safari can run the module script before the stylesheet has applied (WebKit bug 261655),
  so `main.js` waits for every stylesheet before it starts anything. Even so, never read a computed colour or size once
  and write it inline for good: put it in the CSS (`var(--paper)`), or measure again on refresh. The card stack's
  strips vanished "sometimes" for exactly this (Oct 24).
- **Start-up cost (phones):** ScrollTrigger does not measure on DOMContentLoaded or load by itself (`gsap.js`): the page
  is measured by `refreshSoon()` after the deferred start in `main.js`, and after the load only if its height changed.
  Never `gsap.set` freshly split lines one text at a time (each set reads styles back, so the page is re-styled once per
  text): batch them (`hideAll` in motion.js) or write their style directly (`settle` in cards.js). Split a text once,
  not again until its width or its own font changes. Heavy work goes in tasks of its own (`inTurn` in main.js,
  `pause()` in art/mount.js). Measure with Lighthouse mobile, 3 runs, median TBT (PR #54: 758 → 476 ms).
  The first frame is drawn before main.js starts its work (the `await` near its top; not when the address names a
  section, whose jump needs the full page): keep anything a script must do before that frame above it, and keep it
  tiny. So the page's `load` may already have fired when a module starts: use `whenLoaded(fn)` (scripts/loaded.js),
  never a bare `addEventListener("load", …)`. Drawings far from the screen are built only after the visitor's first own
  move and a quiet second (art/mount.js), never just because the page has loaded. The home page's stylesheet is put
  inside the page by the build (`inlineCss` in build/plugins.js; the build stops if an address in it is not rewritten
  or names a missing file). For PageSpeed numbers in the cloud, serve dist/ with ~60 ms of delay per response: with
  none, the page paints before the scripts run and the numbers look better than on GitHub Pages (Oct 25, 2026, PR #61:
  mobile 79 → 91.5, TBT 474 → 234 ms, SI 3.8 → 2.8 s; PageSpeed on the preview 99).
- **Motion curves:** one table, `M.curve` in `scripts/motion.js` (`out`, `move`, `leave`, `wave`, `settle`, `fall`,
  `glide`). GSAP uses `"fm-<name>"`; WAAPI/CSS imports `css.out` / `css.move` / `css.leave` from motion.js.
  Never copy the numbers. Every animation respects reduced motion.
- **Sizes:** every fluid size comes from `design/scale.json` (a value at 320 and at 1440, straight line between;
  screen height counts through `--vp`). No local `vw`/`cqw` `clamp()` in the styles. The build stops if a size is off
  the ladder 0 2 … 24 28 … 64 72 … 128, or if two type roles in `type.relations` are closer than ×1.125.
- **Colours:** from tokens only (`design/tokens.json` → `tokens.gen.css`), one ink in alpha steps (`--ink-20` …).
- **Layout steps:** container queries on the column at S 22rem, M 43rem, L 58rem; any other step must be a written
  "own step" (ID deck 35rem, royalty card 32rem, hero title 10em, video card 400px, tool picture 27.5rem, tool cards side by side 45.75rem).
- **Design grammar (keep it):** tiles radius-s; half-column cards radius-m = padding; full-column cards (CTA, tools)
  radius-l; the ID cards 24px of their 240 (scaled with them); inner radius = outer − inset; colour on a card is a
  subject, never a state; one hover timing. No focus ring (Tim, Oct 20: decision `no-focus-ring`).
- **Media in lazy CSS:** a lazily loaded stylesheet must `@import "../base/media.css"` itself, or Lightning CSS fails
  on the custom media (`--mouse`, `--sideways` …).
- **Texts:** write them normally in the HTML; `build/typeset/` decides where lines may break (no-break spaces, word
  joiners, `<wbr>` in links) by each text's `lang` (Russian and English rules; README there). It never changes a
  visible letter: `npm run typeset -- --lint src/*.html` lists what a proofreader would fix. No length limit on held
  pieces (Tim). Keep links and other inline tags out of headings split by GSAP: SplitText loses a hold at a tag's edge.
  `npm run test:typeset` after changing a rule.
- **Third-party scripts:** add the domain to `POLICY` in `build/plugins.js` (the build writes a strict CSP with script
  hashes). Anything optional (analytics, Planerka preload) starts only from `onConsent()` in `scripts/consent.js`:
  only the «ОК» of the cookie notice is consent. Raise `VERSION` in consent.js when the purposes change.
- **Icons:** `<svg data-icon="name">` in the HTML is replaced with `src/assets/icons/name.svg` at build time.
- Console tuning objects for trying values live: `fmMotion`, `fmHero`, `fmCards`, `fmStipple`, `fmRoyalty`, `fmPace`,
  `fmDeck`, `fmAnchor`, `fmCookies`, `fmConsent`. Debug: `?fmcards=debug`, `?fmcap=debug`, `?fmhero=debug` (every change of the hero's layout in its first 5 s:
  `fmHero.log`). The booking window: `copy(JSON.stringify(fmBook.report()))` gives every height Planerka sent and what
  was done with it.
- **The ring of covers** (`scripts/ring.js` + `scripts/ring-gl.js`): one WebGL canvas, drawn only on a real GPU. In a
  browser without one (headless Chromium here, CI) it is a still 2D picture; add `?fmring=gl` to test the WebGL path
  there. `document.querySelector(".ring").roundCarousel` has `config`, `state()` (with `draws`, `webgl`) and `update()`.

## Testing tips

- Scroll the page top to bottom once before measuring: drawings, dots and reveals mount lazily.
- Hide `.art, canvas, .dots` for wide size sweeps (WebGL makes each resize slow); the pinned logos re-measure
  ~300ms after a resize.
- axe and the audit cannot see text over the stipple/WebGL backgrounds (stats, CTA card): check that contrast from
  pixels (hide the text, screenshot, sample behind it), in reduced and normal motion.
- The dust of the stats and the CTA (`scripts/stipple.js`): with software WebGL it keeps only 6 000 specks per card so
  the page stays usable; add `?fmdust=full` for its real look (slow), and step it in tests with `fmStipple.advance(sec)`
  (`fmStipple.replay()` pushes it in again, `fmStipple.level(n | "auto")` sets the engine's ladder).
- The CSP blocks injected scripts: use `bypassCSP: true` in Playwright contexts.
- `npm run audit` finds Chromium by `PLAYWRIGHT_CHROMIUM` (in the cloud: `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`
  as of Oct 24, 2026; the folder name changes with Playwright updates: `ls /opt/pw-browsers`).
- `html { scrollbar-gutter: stable }` (book.css) is filled like a classic 15px scrollbar in headless Chromium, even with
  `--hide-scrollbars`: a page measured at 390 is 375 wide and layout steps show up 15–20px late. To measure as on a Mac
  or a phone, take it out of the served CSS (`prep()` in `design/report/tools/lib.py`); the audit keeps it.
- Headless Chromium without a GPU: launch with `--use-gl=swiftshader --enable-unsafe-swiftshader` (as
  `build/audit.mjs` does), at most 2 browser contexts at a time, and judge motion by its curves, not by frame timing.
- Telegram's browser: `?fmcap=debug` (the white strip above the navbar turns red, a box shows what the browser says;
  without it the strip exists only in apps' browsers, never in Safari, where it drifted under the navbar). A
  3–5 frame flicker on a hard fling past the end is Telegram's own (decision `telegram-cap-flicker`): don't chase it.
- Bigger browser text: DevTools `Page.setFontSizes`. iOS bar changes: `visualViewport.dispatchEvent(new Event("resize"))`.
- **Safari is the truth for Safari.** Articles about Safari 26 bar tinting were wrong on macOS 27. Tim tests in his
  own Safari and on his iPhone; ask him to, and give him a link.

## Figma sync

`design/README.md` is the how-to. Values (variables) sync both ways through `design/tokens.json`,
`design/tokens.lock.json` (the merge base, don't edit) and `npm run tokens:sync`; a variable reaches the CSS when its
Web code syntax is `var(--name)`. Pull: run `design/figma/pull.js` with `use_figma`, save to
`design/figma/export.json`, sync, build, PR. Push: sync, run the generated `design/figma/push.gen.js` with
`use_figma`, pull again, sync. Measured values, font stacks and motion are not synced on purpose.

## Where Claude runs

- **Claude Code on Tim's Mac** (the local copy, `~/Documents/work/FM/website/flowmedium-site`): the normal setup.
  `npm run dev` and Tim watches it in his own Safari. `gh pr create` works. Don't delete branches, reset `main` or
  force-push without asking.
- **Claude in the cloud (claude.ai project "FM")**: same repo, but the shell can't reach figma.com or planerka.app,
  `gh pr create` fails (open PRs with `gh api repos/timofeylebedev/fm/pulls`), branches can't be deleted, and
  there is no Firefox/WebKit. To show Tim a build, open the PR: its preview link (see "The project") is the build,
  pictures included. The old way (`dist/` pushed to a throwaway branch and served through raw.githack.com) is not
  needed any more: githack puts a notice page in front and the page's pictures do not load there.
- Whichever side changes a rule here, update this file in the same PR, so both read the same thing.

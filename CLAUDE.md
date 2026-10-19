# CLAUDE.md — working on the Flow Medium site

Read this before changing anything. `README.md` is the human how-to (commands, where things are); this file is the
rules Claude follows. The site's history, open PRs and open questions live in the claude.ai project "FM"
(doc `claude/website-setup.md`). Claude Code cannot read that doc, so everything needed to work is here.

## The project

- The landing page of Flow Medium, a custom static Vite site (rebuilt from Taptop, same design and motion).
- `main` is the live site: every push to `main` builds and publishes to https://timofeylebedev.github.io/fm-website/
  (`.github/workflows/deploy.yml`). The real host (flowmedium.pro) is not decided; settings for it are in `deploy/`.
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
```

## Rules in the code

- **Scrolling:** never read `window.scrollY` or listen to the window's `scroll` in new code. Use
  `src/scripts/scroller.js` (`y()`, `to()`, `max()`, `onScroll()`, `watchSize()`, `ioRoot`). In Safari on a Mac
  the page scrolls inside its own box (`html.boxed`, `.page`) so Safari's bar stays solid; `?fmbox=1` / `?fmbox=0`
  turns the box on or off in any browser. See the comment at the top of scroller.js.
- **Motion curves:** one table, `M.curve` in `scripts/motion.js` (`out`, `move`, `leave`, `wave`, `settle`, `fall`,
  `glide`). GSAP uses `"fm-<name>"`; WAAPI/CSS imports `css.out` / `css.move` / `css.leave` from motion.js.
  Never copy the numbers. Every animation respects reduced motion.
- **Sizes:** every fluid size comes from `design/scale.json` (a value at 320 and at 1440, straight line between;
  screen height counts through `--vp`). No local `vw`/`cqw` `clamp()` in the styles. The build stops if a size is off
  the ladder 0 2 … 24 28 … 64 72 … 128, or if two type roles in `type.relations` are closer than ×1.125.
- **Colours:** from tokens only (`design/tokens.json` → `tokens.gen.css`), one ink in alpha steps (`--ink-20` …).
- **Layout steps:** container queries on the column at S 22rem, M 43rem, L 58rem; any other step must be a written
  "own step" (ID deck 35rem, royalty card 32rem, hero title 10em, video card 400px).
- **Design grammar (keep it):** tiles radius-s; half-column cards and ID cards radius-m = padding; full-column cards
  (CTA, tools) radius-l; inner radius = outer − inset; colour on a card is a subject, never a state; one hover timing.
- **Media in lazy CSS:** a lazily loaded stylesheet must `@import "../base/media.css"` itself, or Lightning CSS fails
  on the custom media (`--mouse`, `--sideways` …).
- **Texts:** write Russian normally in the HTML; `build/typograph.js` adds the non-breaking spaces.
- **Third-party scripts:** add the domain to `POLICY` in `build/plugins.js` (the build writes a strict CSP with script
  hashes). Anything optional (analytics, Planerka preload) starts only from `onConsent()` in `scripts/consent.js`:
  only the «ОК» of the cookie notice is consent. Raise `VERSION` in consent.js when the purposes change.
- **Icons:** `<svg data-icon="name">` in the HTML is replaced with `src/assets/icons/name.svg` at build time.
- Console tuning objects for trying values live: `fmMotion`, `fmHero`, `fmCards`, `fmStipple`, `fmRoyalty`, `fmPace`,
  `fmDeck`, `fmAnchor`, `fmCookies`, `fmConsent`. Debug: `?fmcards=debug`, `?fmcap=debug`.

## Testing tips

- Scroll the page top to bottom once before measuring: drawings, dots and reveals mount lazily.
- Hide `.art, canvas, .dots` for wide size sweeps (WebGL makes each resize slow); the pinned logos re-measure
  ~300ms after a resize.
- axe and the audit cannot see text over the stipple/WebGL backgrounds (stats, CTA card): check that contrast from
  pixels (hide the text, screenshot, sample behind it), in reduced and normal motion.
- The CSP blocks injected scripts: use `bypassCSP: true` in Playwright contexts.
- Headless Chromium without a GPU: launch with `--use-gl=swiftshader --enable-unsafe-swiftshader` (as
  `build/audit.mjs` does), at most 2 browser contexts at a time, and judge motion by its curves, not by frame timing.
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
  `gh pr create` fails (open PRs with `gh api repos/timofeylebedev/fm-website/pulls`), branches can't be deleted, and
  there is no Firefox/WebKit. To show Tim a build there, push `dist/` (without `.br`/`.gz`) to a throwaway branch and
  link `https://raw.githack.com/timofeylebedev/fm-website/<branch>/index.html`.
- Whichever side changes a rule here, update this file in the same PR, so both read the same thing.

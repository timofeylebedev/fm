// The adapter of Flow Medium for site-kit (https://github.com/timofeylebedev/site-kit, SPEC.md there): everything the
// kit's checks, report, rules and tools need to know about this site. The kit's code never names a site.
export default {
  name: "Flow Medium",
  tag: "FM",
  owner: "Tim",
  repo: "timofeylebedev/fm",
  live: "https://timofeylebedev.github.io/fm/",
  lang: "ru",

  paths: {
    dist: "dist",
    scale: "design/scale.json",
    decisions: "design/decisions.json",
    questions: "design/questions.json",
    styles: "src/styles",
    scripts: "src/scripts",
    fonts: "src/assets/fonts",
    out: "design/checks/out",
    report: "design/report/site",
    rounds: "design/report/data.json",
    shots: "design/report/shots",
  },

  // the palette: design/tokens.json (Figma's variables), the Color collection, in groups
  colours: {
    file: "design/tokens.json",
    read: (tokens) => Object.entries(tokens.tokens?.Color || {}).map(([name, t]) => ({ name, value: t.value, css: (t.web || "").replace(/^var\((--[\w-]+)\)$/, "$1") || null, group: name.split("/")[0], use: t.description || "" })),
    // [key, label, about, contrast]: the report shows each colour's contrast as text on white ("on-white") or of white
    // text on it ("white-on")
    groups: [
      ["ink", "Ink", "One ink (black) in alpha steps: text, lines, shadows.", "on-white"],
      ["surface", "Surfaces", "The page, the two grounds (sand: the hero; mist: tools and footer) and the tints of cards on white."],
      ["brand", "Brand", "Purple for actions; one colour per subject (blue, orange, green, magenta, teal).", "white-on"],
      ["white", "Paper in alpha", "White over colour and over pictures."],
      ["glass", "Glass", "The navbar's ground."],
      ["idcard", "ID cards", "The three shades of the ID card object.", "white-on"],
      ["status", "Status dots", "The hero chips' dots (hero.js): a part of the picture."],
    ],
  },
  css: { tokens: ["src/styles/base/tokens.gen.css", "src/styles/base/tokens.css"], media: "src/styles/base/media.css" },

  checks: {
    // Safari on a Mac scrolls the page in its own box (box.js): Playwright's WebKit says it is that Safari, and then the
    // window never scrolls. The checks measure the page as the window scrolls it.
    query: "?fmbox=0",
    // html has scrollbar-gutter: stable (book.css): headless Chromium fills it like a classic 15px scrollbar. The checks
    // measure as on a Mac or a phone (overlay scrollbars), in the served CSS and in the pages (the home page's CSS is inline)
    unstyle: [[/scrollbar-gutter:\s*stable/g, "scrollbar-gutter:auto"]],
    // lighter checks: a pull request runs them only when one of these changed (or it has the label `checks`)
    designPaths: ["design/**", "src/**", "public/**", "build/**", "vite.config.js", "package.json", "package-lock.json", "site-kit.config.mjs"],
    // the pages of the site (paths in dist/, served as on GitHub Pages: without ".html")
    pages: [
      { path: "", title: "Home", main: true },
      { path: "privacy_policy_ru", title: "Privacy policy" },
      { path: "soglasie_cookie", title: "Cookie consent" },
      { path: "no-such-page", title: "Not found (404)", status: 404 },
    ],

    // screen sizes measured in full (phones get their pixel ratio, for the pictures)
    sizes: [
      { w: 320, h: 568, dpr: 2, touch: true }, { w: 390, h: 844, dpr: 3, touch: true }, { w: 844, h: 390, dpr: 3, touch: true },
      { w: 768, h: 1024, dpr: 2, touch: true }, { w: 1024, h: 768, dpr: 2, touch: true }, { w: 1366, h: 650, dpr: 1 },
      { w: 1440, h: 900, dpr: 2 }, { w: 1920, h: 1080, dpr: 1 },
    ],

    // left out of every design check: the drawings and the canvases (pictures, with their own sizes and colours), the
    // hero's chips and the sliding strip of logos (moving pictures of the product)
    skip: ".art, canvas, .fm-stage, .sprite, .hero-chips, .ring, .dots",
    notIcons: ".art, .fm-stage, .sprite",
    // text that is part of an object scaled as a whole, or sized to fit its box (not a role of the scale): the hero and
    // CTA titles (fit), the stack titles (fit), the ID cards (a 240×345 object), the tiles' --u, the cookie notice (rem)
    typeObjects: ".hero__title, .cta__title, .card__title, .idcard, .stat, .logo-card, .hero-chips",
    // what lines up: headings, texts, buttons and cards of the sections
    align: "main section h2, main section h3, main section p, main section .btn, .feature, .pub, .tool, .royalty__card, .stat, .logo-card, .cta__card, .head, footer p, footer a",
    cards: ".card, .pub, .tool, .royalty__card, .stat, .feature, .logo-card, .idcard, .cta__card, .tool__media, .pub__media",
    paragraphs: "p, li, dd",
    // the texts compared with the fallback font (fonts that never arrive), and the pictures left out of them
    boxes: "main h1, main h2, main h3, main p, .btn",
    boxSkip: ".art, .fm-stage, .hero-chips",
    // the sweep (every 10px of width) hides the drawings and canvases: WebGL makes each resize slow
    sweepStyle: ".art{visibility:hidden!important} canvas,.dots{display:none!important}",
    // the files a browser or a search engine asks for (og.png: the link preview)
    files: ["robots.txt", "sitemap.xml", "site.webmanifest", "favicon.ico", "apple-touch-icon.png", "og.png"],
    // the site's own words added to a rule's «how» on the report
    notes: { "layers.z": "The order: page (−1…2), cookie notice, navbar, skip link.", "privacy.before": "152-ФЗ; CLAUDE.md." },

    // the consent: nothing optional may run before this button is pressed (only the «ОК» of the cookie notice is
    // consent); a pointer over a demo button would preload Planerka, so the visit points at one (hover)
    consent: { button: ".cookies__ok", label: "«ОК»", storage: "fm-consent", hover: "[data-demo]", version: (io) => +((io.read("src/scripts/consent.js").match(/VERSION\s*=\s*(\d+)/) || [, 1])[1]) },

    // measured at every width and height (the report's responsive picture and map): returns { key: value }; keys
    // starting with "@" are layout states (they make the map). Runs in the page.
    probes: () => {
      const shown = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
      const vis = (sel) => [...document.querySelectorAll(sel)].find(shown) || document.querySelector(sel);
      const all = (sel) => [...document.querySelectorAll(sel)].filter(shown);
      const cs = (sel) => { const e = vis(sel); return e ? getComputedStyle(e) : null; };
      const r2 = (v) => Math.round(v * 100) / 100;
      const f = (sel) => { const s = cs(sel); return s ? r2(parseFloat(s.fontSize)) : null; };
      const p = (sel, k) => { const s = cs(sel); return s ? r2(parseFloat(s[k])) : null; };
      const h = (sel) => { const e = vis(sel); return e ? r2(e.getBoundingClientRect().height) : null; };
      const w = (sel) => { const e = vis(sel); return e ? r2(e.getBoundingClientRect().width) : null; };
      const tok = (v) => { const d = document.createElement("div"); d.style.cssText = "position:absolute;visibility:hidden;width:" + v; document.body.appendChild(d); const x = d.getBoundingClientRect().width; d.remove(); return r2(x); };
      const gap = (sel) => { const s = cs(sel); return s ? r2(parseFloat(s.rowGap || s.gap)) : null; };
      const cols = (sel) => { const k = all(sel); if (!k.length) return null; const xs = []; for (const e of k) { const x = e.getBoundingClientRect().left; if (!xs.some((v) => Math.abs(v - x) < 4)) xs.push(x); } return xs.length; };
      const lines = (sel) => { const e = vis(sel); if (!e) return null; const lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize); return Math.round(e.getBoundingClientRect().height / lh); };
      const beside = (a, b) => { const x = vis(a), y = vis(b); if (!x || !y) return null; const A = x.getBoundingClientRect(), B = y.getBoundingClientRect(); return B.left >= A.right - 4 ? "side by side" : "stacked"; };
      const R = (sel) => { const e = vis(sel); return e ? e.getBoundingClientRect() : null; };
      return {
        hero: f(".hero__title"), h2: f(".head__title"), cardTitle: f(".card__title"), heading: f(".pub__title"), royalty: f(".royalty__text"),
        toolTitle: f(".tool__title"), lead: f(".hero__lead"), ctaLead: f(".cta__lead"), ctaTitle: f(".cta__title"), tag: f(".card__tag-label"),
        toolDesc: f(".tool__desc"), feature: f(".feature__desc"), featureTitle: f(".feature__title"), statNum: f(".stat__number"), statLabel: f(".stat__label"),
        byline: f(".pub__author"), body: f(".pub__desc"), ui: f(".footer__note"), navLink: f(".nav__link"), button: f(".hero .btn"), logoName: f(".logo-card__name"),
        gutter: tok("var(--gutter)"), sectionY: tok("var(--section-y)"), sectionGap: tok("var(--section-gap)"), airL: tok("var(--section-air-l)"), inset: tok("var(--inset)"),
        gapTiles: tok("var(--gap-tiles)"), gapCards: tok("var(--gap-cards)"), navPadY: p(".nav", "paddingTop"), navPadL: p(".nav", "paddingLeft"),
        textGapPub: tok("var(--text-gap)"), textGapHero: gap(".hero__copy"), actionGap: tok("var(--action-gap)"), featureGap: tok("var(--feature-gap)"),
        rTile: p(".feature", "borderTopLeftRadius"), rLogo: p(".logo-card", "borderTopLeftRadius"), rStat: p(".stat", "borderTopLeftRadius"),
        rId: p(".idcard__face", "borderTopLeftRadius") || p(".idcard", "borderTopLeftRadius"), rPub: p(".pub", "borderTopLeftRadius"),
        rRoyalty: p(".royalty__card", "borderTopLeftRadius"), rTool: p(".tool", "borderTopLeftRadius"), rCta: p(".cta__card", "borderTopLeftRadius"),
        rStack: p(".card", "borderTopLeftRadius"), rButton: p(".hero .btn", "borderTopLeftRadius"),
        padFeature: p(".feature", "paddingLeft"), padLogo: p(".logo-card", "paddingLeft"), padStat: p(".stat", "paddingLeft"), padPub: p(".pub__body", "paddingLeft") || p(".pub", "paddingLeft"),
        padRoyalty: p(".royalty__card", "paddingLeft"), padTool: p(".tool__body", "paddingLeft") || p(".tool", "paddingLeft"), padToolBottom: p(".tool__body", "paddingBottom"),
        padCta: p(".cta__card", "paddingLeft"), padStack: tok("var(--card-pad)"), ctaAir: p(".cta__card", "paddingTop"),
        tile: h(".logo-card"), stat: h(".stat"), feat: h(".feature"), toolH: h(".tool"), heroH: h(".hero"), ctaH: h(".cta__card"), idW: w(".idcard"),
        heroAirTop: (() => { const t = R(".hero__text"), n = R(".nav"); return t && n ? r2(t.top - n.bottom) : null; })(),
        heroAirBottom: (() => { const t = R(".hero__text"), s = R(".hero__stage"), i = R(".hero__table"); return t && s && i ? r2(s.bottom - i.height - t.bottom) : null; })(),
        heroPic: h(".hero__table"), column: w(".releases .head") || w(".features"),
        "@nav": (() => { const b = vis(".nav__burger"); return b && getComputedStyle(b).display !== "none" && b.getBoundingClientRect().width > 0 ? "burger" : "links"; })(),
        "@heroTitle": (() => { const t = vis(".hero__title"); if (!t) return null; return lines(".hero__title") + " lines"; })(),
        "@stackCard": beside(".card__text", ".card__art") === "side by side" ? "horizontal" : "vertical",
        "@royalty": (() => { const c = cols(".royalty__card"); const k = vis(".royalty__card"); const t = k && k.querySelector(".royalty__text"), a = k && k.querySelector(".art"); let wide = null; if (t && a) wide = a.getBoundingClientRect().left >= t.getBoundingClientRect().right - 4; return c + (c > 1 ? " cols" : " col") + (wide ? ", wide card" : ""); })(),
        "@idcards": (() => { const k = all(".access__slot"); if (k.length < 2) return null; const xs = k.map((e) => e.getBoundingClientRect().left); return Math.max(...xs) - Math.min(...xs) > k[0].getBoundingClientRect().width * 0.6 ? "row" : "stack"; })(),
        "@features": cols(".feature") + " cols", "@logos": (() => { const t = vis(".logos__track"); return t ? getComputedStyle(t).getPropertyValue("--cols").trim() + " cols" : null; })(),
        "@tools": beside(".tool__body", ".tool__media"), "@pubs": cols(".pub") + " cols",
        "@footer": (() => { const e = vis(".footer__legal-row"); if (!e) return null; const s = getComputedStyle(e); if (s.display.includes("flex")) return s.flexDirection.startsWith("column") ? "column" : "row"; if (s.display.includes("grid")) { const n = s.gridTemplateColumns.split(" ").filter(Boolean).length; return n > 1 ? n + " cols" : "column"; } return s.display; })(),
        overflow: document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth - innerWidth : 0,
      };
    },
    // the names of the map's rows (layout states) and of the probes' groups (for the report)
    mapRows: { "@nav": "Navbar", "@heroTitle": "Hero title", "@stackCard": "Stack card", "@royalty": "Royalty", "@idcards": "ID cards", "@features": "Features", "@logos": "Logos", "@tools": "Tools", "@pubs": "Publications", "@footer": "Footer" },

    // how the page behaves: each scenario is a row of the logic table (given, when, then), played in a fresh page.
    // run(page, h) → true, or a string saying what went wrong. h: { url, wait(ms), vis(sel) }.
    scenarios: [
      { id: "cookie-notice", area: "Consent", given: "a first visit (nothing stored)", when: "the page has loaded, then «ОК» is pressed", then: "the notice shows; after «ОК» it leaves, the answer is stored, and a reload does not show it again", size: [390, 844],
        run: async (page, h) => {
          await page.goto(h.url); await h.wait(4500);
          if (!(await h.vis(".cookies"))) return "no notice 4.5 s after load";
          await page.click(".cookies__ok"); await h.wait(1600);
          if (await h.vis(".cookies")) return "the notice is still there 1.6 s after «ОК»";
          if (!(await page.evaluate(() => localStorage.getItem("fm-consent")))) return "«ОК» stored nothing";
          await page.reload(); await h.wait(4500);
          return (await h.vis(".cookies")) ? "shown again after a reload" : true;
        } },
      { id: "pubs-more", area: "Publications", given: "more than two publications", when: "«Показать больше» is pressed", then: "the hidden cards show, and the button goes once none are left", size: [1440, 900],
        run: async (page, h) => {
          await page.goto(h.url); await h.wait(1500);
          const state = () => page.evaluate(() => { const k = [...(document.querySelector("[data-pubs]")?.children || [])]; return { cards: k.length, hidden: k.filter((c) => c.hidden).length, button: !document.querySelector("[data-pubs-more]")?.hidden }; });
          const before = await state(), first = 2;   // PUBS in scripts/pubs.js
          if (before.cards <= first) return before.button ? `the button shows with ${before.cards} cards` : true;
          if (before.hidden !== before.cards - first || !before.button) return `with ${before.cards} cards: ${before.hidden} hidden, button ${before.button ? "shown" : "hidden"}`;
          await page.locator("[data-pubs-more]").scrollIntoViewIfNeeded(); await h.wait(900); await page.click("[data-pubs-more]"); await h.wait(1200);
          const after = await state();
          return after.hidden === Math.max(0, before.hidden - 4) && after.button === after.hidden > 0 ? true : `after the press: ${after.hidden} still hidden, button ${after.button ? "still there" : "gone"}`;
        } },
      { id: "menu", area: "Navbar", given: "a phone (the burger)", when: "the burger is pressed, then Escape", then: "the menu opens (aria-expanded true) and closes again", size: [390, 844],
        run: async (page, h) => {
          await page.goto(h.url); await h.wait(1500);
          await page.click("[data-menu-button]"); await h.wait(900);
          if ((await page.getAttribute("[data-menu-button]", "aria-expanded")) !== "true") return "the burger did not open the menu";
          await page.keyboard.press("Escape"); await h.wait(900);
          return (await page.getAttribute("[data-menu-button]", "aria-expanded")) === "false" ? true : "Escape did not close the menu";
        } },
      { id: "section-link", area: "Navbar", given: "a computer (navbar links)", when: "a section link is clicked", then: "the page scrolls to the section and the address keeps no #id", size: [1440, 900],
        run: async (page, h) => {
          await page.goto(h.url); await h.wait(1500);
          const link = page.locator('.nav a[href="#clients"]').first();
          if (!(await link.count())) return "no navbar link to #clients";
          await link.click(); await h.wait(2200);
          const r = await page.evaluate(() => ({ hash: location.hash, top: document.getElementById("clients")?.getBoundingClientRect().top }));
          if (r.hash) return `the address got ${r.hash}`;
          return Math.abs(r.top) < 200 ? true : `the section is ${Math.round(r.top)}px from the top`;
        } },
      { id: "demo-window", area: "Booking", given: "consent given (Planerka faked: it cannot be reached from the checks)", when: "a «Запланировать демо» button is clicked, then the window is closed", then: "the booking window opens over the page without changing the address, and closes", size: [1440, 900], consent: true,
        run: async (page, h) => {
          await page.route("https://planerka.app/**", (r) => r.fulfill({ contentType: "text/html", body: "<body style='margin:0;height:668px;background:#fff'><script>parent.postMessage(JSON.stringify({type:'planerka:resize',height:668}),'*')</script></body>" }));
          await page.goto(h.url); await h.wait(1500);
          const url0 = page.url();
          await page.locator(".hero [data-demo]").first().click(); await h.wait(1500);
          const open = await page.evaluate(() => !!document.querySelector("dialog[open]"));
          if (!open) return "no window opened";
          if (page.url() !== url0) return `the address changed to ${page.url()}`;
          await page.keyboard.press("Escape"); await h.wait(1200);
          return (await page.evaluate(() => !!document.querySelector("dialog[open]"))) ? "Escape did not close the window" : true;
        } },
    ],
  },

  rules: {
    // the site's own code rules (beside the kit's generic ones and the lessons): none so far, every FM rule is a kit
    // rule set up by the fields below
    code: null,
    // the drawings: pictures with their own palettes, px unit (--fm-px) and curves, not page UI
    drawings: ["src/styles/art/", "src/scripts/art/"],
    // text sized as a part of an object (the fit titles of the hero, CTA and stack; the tiles' --u; the drawings' --fm-px)
    objectType: ["--hero-title", "--cta-title", "--card-title", "--u", "--fm-px"],
    // container queries on the column at S, M, L; any other step must be a written «own step» in CLAUDE.md
    steps: {
      shared: ["22rem", "43rem", "58rem"],
      own: (io) => {
        const claude = io.read("CLAUDE.md");
        const own = [...claude.matchAll(/\(([^)]*own step[^)]*)\)/g)].map((m) => m[1]).join(" ") + " " + (claude.match(/any other step must be a written\s*"own step" \(([^)]*)\)/) || [, ""])[1];
        return [...new Set([...own.matchAll(/(\d+(?:\.\d+)?(?:rem|px|em))/g)].map((m) => m[1]))];
      },
    },
    // one table of curves: M.curve in motion.js (GSAP "fm-<name>", css.* for WAAPI/CSS), and the --ease tokens
    curves: { modules: ["src/scripts/motion.js"], tokens: "--ease" },
    // what every decision must say (who decided, when, why) and what an exception says besides
    decisionFields: { "*": ["id", "kind", "what", "decided", "why"], exception: ["rule", "fix"] },
    notes: {
      "type-from-scale": "Objects scaled as a whole (the ID cards' 24/13px, the tiles' --u, the hero chips' --u, the drawings' --fm-px) are pictures of UI, not page text.",
    },
    // the lessons (site-kit rules/README.md): which file plays which part. boot.js is the head script's twin of scroller.js
    // (inlined before anything is drawn, it cannot import it, and asks the box itself)
    learnings: {
      scrollModule: ["src/scripts/scroller.js", "src/scripts/boot.js"],
      loadedModule: "src/scripts/loaded.js",
      boxScript: "src/scripts/box.js",
      entry: "src/scripts/main.js",
      consent: { module: "src/scripts/consent.js", gate: "onConsent" },
    },
  },

  report: {
    title: "Flow Medium · the system",
    accent: "#884dff",
    // the page's own text is the site's text face; the type specimens use both faces (files in paths.fonts)
    fonts: {
      text: { family: "Golos", files: { 400: "golos-400.woff2", 500: "golos-500.woff2", 600: "golos-600.woff2" } },
      display: { family: "Pragmatica Ext", files: { 700: "pragmatica-ext-700.woff2" } },
    },
    // the column the cards' own sizes («per») are measured against: at most 1024, inside the gutter role
    column: { max: 1024, gutter: "section/pad-x" },
    // the shared container steps of the column (any other is an own step)
    steps: { "22rem": "S", "43rem": "M", "58rem": "L" },
    // how each text role is drawn on the site: font (text | display), weight, line height, a text from the page, where
    typeRoles: {
      "type/hero": { font: "display", weight: 700, lh: "display", text: "Весь лейбл — на одной волне", where: ".hero__title (capped by fit: the width / 7.2)" },
      "type/h2": { font: "display", weight: 700, lh: "display", text: "Роялти без споров о цифрах", where: ".head, .cta__title, stack card titles (capped by the card: its width / 9.8)" },
      "type/card-heading": { font: "text", weight: 600, lh: "heading", text: "Как разобраться в отчетах по роялти", where: ".tool__title, .pub__title, royalty titles, the 404 title" },
      "type/doc-title": { font: "text", weight: 600, lh: "heading", text: "Политика обработки персональных данных", where: ".doc-title (the legal pages)" },
      "type/lead": { font: "text", weight: 400, lh: "text", text: "Порядок в релизах и проектах, правах и документах, роялти и платежах", where: ".hero__lead, .cta__lead, .doc-h2", color: "ink-60" },
      "type/card-tag": { font: "text", weight: 500, lh: 1.2, text: "Управление", upper: true, track: "0.05em", where: ".card__tag (a label: case, weight and its pill set it apart)" },
      "type/body-m": { font: "text", weight: 400, lh: "text", text: "Убедитесь в соответствии закону до того, как это станет проблемой", where: ".tool__desc", color: "ink-60" },
      "type/body": { font: "text", weight: 400, lh: "text", text: "Что должно быть в роялти-отчетах, как проверить их корректность", where: "body, .pub__desc, buttons, the footer, the legal pages' text" },
      "type/body-s": { font: "text", weight: 500, lh: "compact", text: "Планируйте наперёд, чтобы релизы не накладывались", where: ".feature__title, .feature__desc, bylines" },
      "type/ui": { font: "text", weight: 400, lh: "text", text: "Продукт · Клиенты · Публикации · © 2026, Все права защищены", where: "navbar links, menu, skip link, footer notes", color: "ink-60" },
      "type/note": { font: "text", weight: 400, lh: "text", text: "Используем куки, чтобы делать сайт лучше", where: ".cookies__text", color: "ink-70" },
    },
    // the colours the shadow tiles are drawn with, beside the stylesheets' own (the ID card's shadow names --face)
    cssVars: { face: "var(--idcard-face-1)" },
    // the shadows by what they look like: a name, the ground they sit on, and the object the report draws them on.
    // A "painter" is a box-shadow used to paint (the stack's strips), not a shadow.
    grounds: { paper: "#fff", sand: "#eeeae9" },
    shadow: (s) => {
      const sels = s.uses.map((u) => u.sel).join(), id = /face/.test(s.value), chip = /chip/.test(sels);
      const painter = /calc\(|var\(--stack-page/.test(s.value) && !/rgb|ink/.test(s.value.split(",")[0]);
      return {
        painter,
        name: s.value === "0 4px 16px var(--ink-10)" ? "Floating" : /0 24px 56px/.test(s.value) ? "Object (ID cards)" : /90 60 30/.test(s.value) ? "Chip (warm)" : painter ? "Painter (the stack's strips)" : s.uses[0].sel,
        ground: painter ? "paper" : /chip|hero/.test(sels) ? "sand" : "paper",
        shape: id ? "card" : chip || /menu|cookies|book/.test(sels) ? "pill" : "",
        text: painter ? "a card" : id ? "" : chip ? "Last seen" : "Меню",
        bg: painter ? "#004de5" : id ? "var(--idcard-face-1)" : chip ? "rgb(255 255 255 / 0.7)" : null,
      };
    },
    // the rounds' measured sections shown on the system's Blocks tab, with the line under each title
    roundBlocks: {
      hero: "Least and greatest sizes for each part, measured at real screen sizes.",
      stack: "How the card stack is built and moves.",
      tools: "Padding by the card's own width, the picture under the text, side by side from their own step.",
      tiles: "Features, logo and stat tiles take radius/s with the padding = radius; the ID cards are a 240×345 object scaled as a whole.",
      footer: "The footer's notes, and the legal pages.",
      navbar: "How the navbar behaves on sideways phones and in apps' browsers.",
    },
    // the round before the latest, as published: its motion reading marks the curves that changed
    motionBase: "design/report/measure/published-oct23.json",
    // texts of the system page that only this site can say
    notes: {
      layout: "One centred column (at most 1024), blocks that change at three shared steps of the column (S, M, L) and a few written own steps, and the page's own steps in media.css. The steps are read from the stylesheets.",
      steps: "Shared steps are the column's S 22rem, M 43rem, L 58rem; any other is an own step (CLAUDE.md lists them).",
      radii: "Tiles take s, half-column cards m, full-column cards l; padding = radius, inner radius = outer − inset.",
      shadows: "There are no shadow tokens yet (round 6, G4: --shadow-float, --shadow-object, --shadow-chip proposed). Not listed: the ID card's shadow in the air, which scripts/motion.js derives from the object shadow while the card falls (M.DROP).",
      typeset: "No length limit: a hold is never let go because the piece it makes is long (Tim, Oct 24). The longest pieces on the site are 19 letters on the home page and 18 in a heading of the privacy policy; no page scrolls sideways at 320–390. GSAP's SplitText keeps every no-break space; inside headings split letter by letter (data-reveal=\"chars\") no word joiners are written, and links stay out of split headings.",
    },
    // the typesetter's demo
    typesetSamples: [
      { lang: "ru", text: "Весь лейбл — на одной волне\n\nПланируйте релизы наперёд, чтобы они не накладывались и выходили в срок, а не в последний момент.\n\nСозвонитесь с нами на 30 минут: покажем, как ваш лейбл может работать слаженнее и расти. С 1 января 2026 г. отчёты по ст. 6 приходят в т. ч. по e-mail hello@flowmedium.pro, а договоры за 2022–2025 годы — в личный кабинет." },
      { lang: "en", text: "Dr. Smith wrote to us on October 19 about the 5 GB of reports.\n\nI think a label should see what it is owed in one place, not in a dozen of spreadsheets and e-mails from 2022–2025." },
    ],
    // the blocks of the page (layer 3: pictures, and the live site in a frame at `#anchor` when the block has an id)
    blocks: [
      { id: "nav", title: "Navbar", selector: ".nav", files: ["src/styles/sections/nav.css", "src/scripts/nav.js", "src/scripts/nav-pill.js", "src/scripts/menu.js"] },
      { id: "hero", title: "Hero", anchor: "product", selector: ".hero", files: ["src/styles/sections/hero.css", "src/scripts/hero.js"] },
      // the stack is played by the scroll (a pinned stage, three cards one after another): a screen per card, at the
      // middle of the scroll where it fills the stage (measured: card 1 until 0.25, card 2 0.4–0.6, card 3 from 0.75)
      { id: "stack", title: "Card stack", selector: ".stack", frames: [0.1, 0.5, 0.85], files: ["src/styles/sections/stack.css", "src/scripts/cards.js", "src/styles/art/art.css", "src/scripts/art/s1.js", "src/scripts/art/s2.js", "src/scripts/art/s3.js", "src/scripts/art/shared.js"] },
      { id: "royalty", title: "Royalty", selector: ".royalty", files: ["src/styles/sections/sections.css", "src/styles/art/art.css", "src/scripts/art/royalty.js", "src/scripts/art/royalty-settings.js"] },
      { id: "access", title: "ID cards", selector: ".access", files: ["src/styles/sections/sections.css", "src/scripts/deck.js"] },
      { id: "releases", title: "Releases", selector: ".releases", files: ["src/styles/sections/sections.css", "src/styles/components/ring.css", "src/scripts/ring.js", "src/scripts/ring-gl.js"] },
      { id: "clients", title: "Clients", anchor: "clients", selector: ".clients", files: ["src/styles/sections/sections.css", "src/scripts/logos.js", "src/scripts/stipple.js"] },
      { id: "cta", title: "CTA", selector: ".cta", files: ["src/styles/sections/sections.css", "src/scripts/stipple.js", "src/scripts/link-cards.js"] },
      { id: "tools", title: "Tools", anchor: "tools", selector: ".tools", files: ["src/styles/sections/sections.css", "src/scripts/link-cards.js"] },
      { id: "pubs", title: "Publications", anchor: "publications", selector: ".pubs", files: ["src/styles/sections/sections.css", "src/scripts/pubs.js"] },
      { id: "footer", title: "Footer", selector: "footer", files: ["src/styles/sections/footer.css"] },
      { id: "cookies", title: "Cookie notice", selector: ".cookies", files: ["src/styles/components/cookies.css", "src/scripts/cookies.js"] },
    ],
  },

  // the typesetter (site-kit/typeset/README.md): headings motion.js splits letter by letter get no-break spaces only
  typeset: {
    spacesOnly: ["data-reveal=chars"],
  },

  // the pictures (site-kit/images/README.md; was build/images.mjs): what is made from each original in assets-src/img.
  // Widths are in image pixels; each one is made in every format listed. Files are named <name>-<width>.<format>, or
  // <name>.<format> when there is only one width. Every setting is the lowest that scores SSIMULACRA2 90 or more
  // (`site-kit images search`), with its score and size in the comment next to it.
  images: (() => {
    // The hero's settings: [AVIF quality, WebP quality] per width, in two sets (index.html picks one by the screen's density):
    //   HERO_1X for screens under 2× (desktops, laptops at 1.25 and 1.5): the lowest setting at which the file scores
    //     SSIMULACRA2 90 or more against the original at that width, on the hero's sand. Up to 2120 a 1× screen can get the
    //     file, so it is held to that at 1:1; 2650 and 3200 are only ever asked for at 1.25× and 1.5× (a 1× screen needs at
    //     most 2120), so they are scored as seen there (both pictures scaled down by the density), and 80 or more at 1:1.
    //   HERO_2X for screens of 2× and more (phones, tablets, retina laptops): scored as seen at 2×, and 80 or more at 1:1.
    //     No 1400 here: held to that it needs AVIF 79 (44 KB), more than the 1800 (39 KB), which those screens get instead.
    // The files before scored 75–79 at 1:1. Measured Oct 24, 2026; scores of the AVIF: as seen / at 1:1.
    const HERO_1X = {
      900: [86, 95],    // 90.3                  29 KB
      1200: [86, 96],   // 90.0                  45 KB (Oct 25: for 1.5–1.9× phones, which needed 1100–1200 and got the 1400)
      1400: [86, 96],   // 90.0                  55 KB
      1800: [86, 97],   // 90.0                  81 KB
      2120: [86, 97],   // 90.1                 104 KB
      2650: [80, 93],   // 1.25×: 90.2 / 88.3   115 KB
      3200: [75, 92]    // 1.5×: 90.2 / 86.9    126 KB
    };
    const HERO_2X = {
      1800: [62, 89],   // 90.0 / 81.7           39 KB
      2120: [62, 86],   // 90.1 / 82.2           49 KB
      2650: [63, 89],   // 90.1 / 83.0           69 KB
      3200: [63, 89],   // 90.1 / 83.4           88 KB
      4096: [64, 89]    // 90.0 / 83.3          135 KB
    };
    const heroQ = (set) => (w) => ({ avif: { quality: set[w][0], chromaSubsampling: "4:4:4" }, webp: { quality: set[w][1], smartSubsample: true } });
    // an AVIF setting: a quality, or [quality, bit depth] (10-bit keeps fine grain at a smaller size than 8-bit)
    const avif = (q) => Array.isArray(q) ? { quality: q[0], bitdepth: q[1] } : { quality: q };
    return {
      from: "assets-src/img",
      to: "src/assets/img",
      // `site-kit images search` and `score`: the lowest setting whose SSIMULACRA2 is at least this
      search: { target: 90 },
      jobs: [
        // the hero: a wide picture whose width follows the screen's height (see hero.css), shown at most
        // min(160vw, 2120px, max(196.2vh, 660px)) wide (the sizes in index.html). The original (Tim's, Oct 24, 2026) is
        // 4096 × 1141, cut at the bottom to the old frame 3.92333 : 1 (4096 × 1044, lossless): the edge of the table and the
        // people are where they were in the 3531 × 900 one, so hero.css and the chips' places stay. What screens got (browser
        // windows, Oct 24, 2026): under 2×: 1400 a 1366 × 768 laptop, an 800 px window · 1800 1536 × 864 @ 1.25 ·
        // 2120 1920 × 1080, 2560 × 1440, 1280 × 800 @ 1.5 · 2× and up: 1800 iPhone SE, Android 412 · 2120 iPhones 390–440 ·
        // 2650 iPad 820 · 3200 MacBook Air 1440 × 900 · 4096 MacBook Pro 1512 × 982.
        // Settings: HERO_1X and HERO_2X above (2650 and 3200 of the 1× set are seen at 1.25× and 1.5×).
        { src: "hero-table.webp", widths: [900, 1200, 1400, 1800, 2120, 2650, 3200], formats: ["avif", "webp"], options: heroQ(HERO_1X),
          seen: { 2650: 1.25, 3200: 1.5 } },
        { src: "hero-table.webp", name: "hero-table-2x", widths: [1800, 2120, 2650, 3200, 4096], formats: ["avif", "webp"], options: heroQ(HERO_2X), seen: 2 },
        // the two tool cards (Tim's pictures of Oct 28, 2026, 1230 × 1344). Drawn at most 360 CSS px wide on phones and
        // tablets (about 88vw − 50px) and 383–410 when the cards stand side by side (the sizes in index.html); in device px
        // that is 381–410 at 1×, 464–720 at 2× phones and tablets, 815–820 on 2× laptops, 800–1007 on 3× phones. Each width at
        // the lowest setting whose SSIMULACRA2 against the original at that width (on the card's white) is 90 or more
        // (Oct 28, 2026). Both need full colour (4:4:4): halved colour never gets to 90 (the bot's teal and red marks, the
        // orange of Lens). The Lens scans are fine grain, so 10-bit (a little smaller there); Litmus is flat UI, 8-bit.
        // The WebP (browsers without AVIF): lossy at the lowest quality that gets to 90; Lens at 420 never does, so near-lossless.
        // Scores of the AVIF / sizes: Litmus 90.1 16 KB · 90.0 24 KB · 90.1 31 KB · 90.3 39 KB;
        //                             Lens   90.2 29 KB · 90.5 58 KB · 90.2 84 KB · 90.2 116 KB
        { src: "fm-litmus.png", widths: [420, 640, 820, 1024], formats: ["avif", "webp"], background: "#ffffff", options: (w) => ({
          avif: { quality: { 420: 76, 640: 72, 820: 70, 1024: 70 }[w], bitdepth: 8, chromaSubsampling: "4:4:4" },
          webp: { quality: { 420: 94, 640: 93, 820: 92, 1024: 91 }[w], smartSubsample: true } }) },
        { src: "fm-lens.png", widths: [420, 640, 820, 1024], formats: ["avif", "webp"], background: "#ffffff", options: (w) => ({
          avif: { quality: { 420: 78, 640: 78, 820: 76, 1024: 76 }[w], bitdepth: 10, chromaSubsampling: "4:4:4" },
          webp: w === 420 ? { nearLossless: true, quality: 40 } : { quality: { 640: 97, 820: 97, 1024: 100 }[w], smartSubsample: true } }) },
        // photos on the ID cards (80 CSS px) and the author of the publications (24 CSS px): 2× and 3×
        ...["petr", "nazar", "maria"].map((n) => ({ src: n + ".png", name: "face-" + n, widths: [160, 240], formats: ["webp"] })),
        { src: "maxim-poplavsky.png", name: "author", widths: [48, 72], formats: ["webp"] },
        // the logo of the Institute of Music Initiatives on the publications (154×24 and 76×24 CSS px)
        { src: "institute-logo.png", widths: [411], formats: ["webp"], lossless: true },
        { src: "institute-mark.png", widths: [152], formats: ["webp"], lossless: true },
        { src: "vk-video.png", widths: [64], formats: ["webp"], lossless: true },
        { src: "youtube.png", widths: [64], formats: ["webp"], lossless: true },
        // the strip of 12 icons of the hero chips (made from the covers of the ring and the icons of the drawings, Oct 24, 2026).
        // Settings as for the covers below: the lowest at SSIMULACRA2 90 or more. Lossy WebP never gets there (it halves the
        // colour), so the WebP for browsers without AVIF is near-lossless.
        // Oct 24, 2026, the new Home cover in the first cell: 10-bit AVIF at 92 (31 KB) instead of 8-bit at 96 (34 KB); every
        // cell scores the same or better than before, the worst 82.6 against 81.9 (cell by cell, at 1:1). Only the Home icon
        // is below 90 (83: the film grain at 96 px, 82 before with the old cover too); 90 would take 60 KB.
        { src: "hero-chips.png", widths: [1152], formats: ["avif", "webp"], options: { avif: { quality: 92, bitdepth: 10 }, webp: { nearLossless: true, quality: 60 } } },
        // the covers of the ring (shown at about 300 CSS px at most; the ring's texture is 640 at most). Each cover at the
        // lowest setting whose SSIMULACRA2 against the 640 px original is 90 or more (no visible loss at 1:1), measured
        // Oct 23, 2026. AVIF first; the WebP is for browsers without AVIF. First steps is flat colour: near-lossless WebP is
        // smaller than any AVIF that keeps its letters (14 KB at 92.8 against 31 KB at 91.3), so it has no AVIF.
        // The Home cover was replaced on Oct 24, 2026 (a photo with film grain): 10-bit AVIF keeps grain better for its size,
        // so it is 10-bit at 86 (100 KB, 90.6); the best 8-bit was 92 (136 KB, 90.5).
        ...Object.entries({ "home": [86, 10], "last-seen": 91, "reminiscence": 58, "love": 75, "rebirth": 87, "m": 64, "lazy-friday": 63 })
          .map(([n, q]) => ({ src: `cover-${n}.png`, widths: [640], formats: ["avif", "webp"], options: { avif: avif(q) } })),
        { src: "cover-first-steps.png", widths: [640], formats: ["webp"], options: { webp: { nearLossless: true, quality: 40 } } },
        // pictures used inside the drawings (art/*.js), at the size they are drawn at 2×
        ...["face-anna", "face-elvira", "face-mark", "face-petr", "cube", "cube-bg"].map((n) => ({ src: `art-${n}.png`, widths: [null], formats: ["webp"], quality: 88 })),
        // the photos of the tiles of s1-1 and the covers in s1-2 and s1-3 (from the ring's covers). A tile is 160 px of the
        // drawing's 1000, about 180 CSS px on a 1440×900 screen and up to about 200 on big ones: 400 px is 2× of that; the covers
        // are 3× of their 45 and 26 px. Each at the lowest AVIF setting with SSIMULACRA2 90 or more against the original at that
        // size (Oct 24, 2026); the WebP next to it, at the usual setting, is for browsers without AVIF (art/shared.js offers
        // both). The Last Seen cover is so small that no AVIF gets there: near-lossless WebP only.
        ...Object.entries({ video: 86, hoodie: 76, cap: 88, concert: 90 })
          .map(([n, q]) => ({ src: `art-card-${n}.png`, widths: [400], formats: ["avif", "webp"], options: { avif: { quality: q } } })),
        // the Home cover (new on Oct 24, 2026) in 10-bit, as in the ring: tile 86 (39 KB, 90.6; 8-bit needed 92, 53 KB),
        // thumbnail 88 (4.9 KB, 90.2; 8-bit 91, 5.0 KB)
        { src: "cover-home.png", name: "art-card-home", widths: [400], formats: ["avif", "webp"], options: { avif: avif([86, 10]) } },
        { src: "cover-home.png", name: "art-thumb-home", widths: [134], formats: ["avif", "webp"], options: { avif: avif([88, 10]) } },
        { src: "cover-last-seen.png", name: "art-thumb-lastseen", widths: [79], formats: ["webp"], options: { webp: { nearLossless: true, quality: 80 } } },
        // shown only if a royalty drawing cannot be drawn (very old browsers)
        { src: "royalty-1.png", widths: [1012], formats: ["webp"] },
        { src: "royalty-2.png", widths: [1012], formats: ["webp"] },
      ],
      // SVG files cleaned up and minified into `to`
      svg: /^(logo-|art-icon-|art-logo-)/,
      // The site's icons and the picture for links shared in messengers (Tim's files, Oct 24, 2026). They keep fixed
      // addresses: public/ for the PNGs and the ICO, src/assets/icons/favicon.svg for the SVG (linked from every page).
      //   icon.png         512 × 512, the mark on a full white square: the iPhone and Android icons
      //   og.png           1200 × 630, the picture for links shared in messengers: public/og.png at its own size
      //   favicon-32.png   32 × 32, drawn for that size (more air than icon.png): favicon.ico, cut to a circle (Tim)
      //   fm-logo.svg      the mark alone: favicon.svg, which turns white in dark mode
      icons: { src: "icon.png", background: "#ffffff", out: [
        { out: "public/apple-touch-icon.png", width: 180 },   // iPhone and iPad home screen: opaque, iOS rounds the corners itself
        { out: "public/icon-192.png", width: 192 },           // site.webmanifest
        { out: "public/icon-512.png", width: 512 },           // site.webmanifest
      ] },
      og: { src: "og.png", out: "public/og.png", width: 1200, height: 630 },   // og:image width and height in the pages say the same
      ico: { src: "favicon-32.png", out: "public/favicon.ico", sizes: [16, 32], circle: true },   // 16 made from the 32
      favicon: { src: "fm-logo.svg", out: "src/assets/icons/favicon.svg", light: "#000", dark: "#fff" },
    };
  })(),

  // the responsive audit (site-kit/audit/README.md): today's npm run audit, the home page at the kit's nine sizes
  audit: {
    pages: [""],
    // left out of «text cut off»: the drawings, the hero's chips, the sliding strip of logos, the ID cards' deck and the
    // card stack (cut off on purpose), the navbar and the menu (they slide out of sight)
    skip: ".fm-stage, .hero-chips, .sprite, .logos__track, .access__cards, .stack, .nav, .menu",
    // left out of «text under 12px»: the drawings and the hero's chips (pictures with their own sizes)
    skipSmall: ".fm-stage, .hero-chips, .sprite",
    // the skip link is off screen until the Tab key brings it
    skipTargets: ".skip",
    // looked at one by one (the card stack is many screens tall and pinned: its cards are seen in the scroll-through)
    sections: ["main > section:not(.stack)", "body > footer"],
    // the sand above the top of the page (body::before, base.css) is decoration outside the page; while it is there,
    // axe cannot work out any background and checks the contrast of no text at all, so it is hidden for the check
    axeStyle: "body::before { display: none !important; }",
  },
};

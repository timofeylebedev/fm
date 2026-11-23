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
      { id: "stack", title: "Card stack", selector: ".stack", files: ["src/styles/sections/stack.css", "src/scripts/cards.js", "src/styles/art/art.css", "src/scripts/art/s1.js", "src/scripts/art/s2.js", "src/scripts/art/s3.js", "src/scripts/art/shared.js"] },
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

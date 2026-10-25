// The adapter for this site: everything the checks need to know about Flow Medium. The collector (collect.js), the
// runner (measure.mjs) and the checks (checks.mjs) are generic; another site gets its own copy of this file.
export default {
  name: "Flow Medium",
  repo: "timofeylebedev/fm",
  live: "https://timofeylebedev.github.io/fm/",

  // the pages of the site (paths in dist/, served as on GitHub Pages: without ".html")
  pages: [
    { path: "", title: "Home", main: true },
    { path: "privacy_policy_ru", title: "Privacy policy" },
    { path: "soglasie_cookie", title: "Consent" },
    { path: "cookie_consent", title: "Cookie consent" },
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

  // the consent: nothing optional may run before this button is pressed
  consent: { button: ".cookies__ok", storage: "fm-consent" },

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
    { id: "pubs-more", area: "Publications", given: "more than four publications", when: "«Показать больше» is pressed", then: "the hidden cards show, and the button goes once none are left", size: [1440, 900],
      run: async (page, h) => {
        await page.goto(h.url); await h.wait(1500);
        const state = () => page.evaluate(() => { const k = [...(document.querySelector("[data-pubs]")?.children || [])]; return { cards: k.length, hidden: k.filter((c) => c.hidden).length, button: !document.querySelector("[data-pubs-more]")?.hidden }; });
        const before = await state();
        if (before.cards <= 4) return before.button ? `the button shows with ${before.cards} cards` : true;
        if (before.hidden !== before.cards - 4 || !before.button) return `with ${before.cards} cards: ${before.hidden} hidden, button ${before.button ? "shown" : "hidden"}`;
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
};

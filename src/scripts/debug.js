/* Test boxes for phones, loaded only with ?fmcap=debug or ?fmcards=debug at the end of the address. */
const box = (css) => {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;z-index:2147483600;max-width:calc(100% - 16px);padding:6px 8px;border-radius:6px;"
    + "background:rgba(0,0,0,.82);color:#fff;font:11px/1.35 monospace;white-space:pre;pointer-events:none;text-align:left;" + css;
  document.body.appendChild(el);
  return el;
};

// ?fmcap=debug: the strip above the navbar turns red (nav.js), a yellow line marks the top edge of the page, and a box
// shows what the browser reports
export function capDebug(touch) {
  const line = box("left:0;right:0;top:0;height:3px;padding:0;border-radius:0;background:#ffd400");
  line.textContent = "";
  const info = box("left:8px;top:60px");
  let most = 0, least = 0;                               // the furthest the page was reported down / up
  const show = () => {
    const vv = window.visualViewport, nav = document.querySelector("[data-nav]");
    most = Math.max(most, scrollY); least = Math.min(least, scrollY);
    const cap = document.querySelector(".nav-cap"), r = cap && cap.getBoundingClientRect();
    info.textContent = [
      "fmcap debug",
      "touch: " + touch + "   scroll-driven: " + CSS.supports("animation-timeline: scroll()"),
      "inner: " + innerWidth + "×" + innerHeight + "   scrollY: " + Math.round(scrollY),
      "cap: " + (r ? Math.round(r.top) + "…" + Math.round(r.bottom) + " (should end at 1)" : "none"),
      "can scroll: " + (document.documentElement.scrollHeight - document.documentElement.clientHeight) + "   cap travel: " + (cap ? cap.style.getPropertyValue("--cap-max") : "none"),
      "correction: " + (cap ? cap.style.translate || "0" : "none") + "   height: " + (cap ? cap.style.height : "none"),
      "in an app: " + !!(window.webkit && window.webkit.messageHandlers) + "   Safari/ in UA: " + /Safari\//.test(navigator.userAgent)
        + "   bounce off: " + (document.documentElement.style.overscrollBehaviorY === "none"),
      "vv: " + (vv ? Math.round(vv.width) + "×" + Math.round(vv.height) + " +" + Math.round(vv.offsetTop) + "  page +" + Math.round(vv.pageTop) : "-")
        + "   nav top: " + (nav ? Math.round(nav.getBoundingClientRect().top) : "-"),
      "scrollY seen: " + Math.round(least) + "…" + Math.round(most) + "   overscroll: " + getComputedStyle(document.documentElement).overscrollBehaviorY,
      "nav place (offsetTop) used: " + (window.fmCap ? window.fmCap.state.navTop : "-"),
      navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 90)
    ].join("\n");
  };
  setTimeout(show, 0);
  setInterval(show, 500);                                // the cap is corrected after the scroll too: the box keeps up
  addEventListener("scroll", show, { passive: true });
  addEventListener("resize", show);
  if (window.visualViewport) { visualViewport.addEventListener("resize", show); visualViewport.addEventListener("scroll", show); }
}

// ?fmcards=debug: what the card stack measures, to compare with what is seen on a phone. "card" is where the top of the
// biggest card that is seen is, against where it should be; "smallest" is the smallest card of each, and whether its
// corners make it a perfect pill (radius = half its height). Returns the function the stack calls after every drawing.
export function cardsDebug(s) {
  const info = box("right:8px;bottom:96px");
  const ua = navigator.userAgent, ios = (ua.match(/OS (\d+)_(\d+)/) || []).slice(1).join("."), ver = (ua.match(/Version\/([\d.]+)/) || [])[1];
  const n2 = (v) => +(+v).toFixed(2);
  let last = 0, queued = 0;
  const show = () => {
    queued = 0;
    const p = last, vv = window.visualViewport, rect = s.stage.getBoundingClientRect();
    const seen = s.cards.map((c, i) => ({ c, st: s.state(c, i, p) })).filter((o) => o.st.g.seen).sort((a, b) => b.st.g.h - a.st.g.h)[0];
    info.textContent = [
      "fmcards debug",
      "iOS " + (ios || "-") + "  Safari " + (ver || "-"),
      "nav " + s.navBottom() + " (on screen " + (s.nav ? Math.round(s.nav.getBoundingClientRect().bottom) : "-") + ")  --stack-nav " + s.section.style.getPropertyValue("--stack-nav"),
      "stage " + Math.round(rect.top) + "  h " + s.V + "  inner " + innerHeight + "  vv " + (vv ? Math.round(vv.height) + " +" + Math.round(vv.offsetTop) : "-"),
      "card " + (seen ? Math.round(seen.c.el.getBoundingClientRect().top) : "none") + "  p " + Math.round(p),
      "smallest " + s.cards.map((c, i) => (i + 1) + ": " + n2(c.m.ph) + "px r " + n2(c.m.R) + (c.m.R + 0.5 >= c.m.ph / 2 ? " pill" : " (pill: r " + n2(c.m.ph / 2) + ")")).join("  ")
    ].join("\n");
  };
  addEventListener("resize", () => { if (!queued) queued = requestAnimationFrame(show); });
  return (p) => { last = p; if (!queued) queued = requestAnimationFrame(show); };
}

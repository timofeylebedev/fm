/* The first script of the page, put into <head> as it is (the build minifies it): it runs before anything is drawn.
   Keep it small and free of imports. The rest of the scripts start from main.js. */
(function () {
  var root = document.documentElement;
  // the page has scripts: what comes in on scroll starts hidden (see motion.css)
  root.classList.add("js");

  // Safari on a Mac: the page scrolls in its own box (box.js, which runs before this, gives <html> the class)
  // what scrolls: the page's box once it is there (the body is read later than this script), else the window
  var scroller = function () { return (root.classList.contains("boxed") && document.querySelector("[data-page]")) || null; };
  var scrollY_ = function () { var b = scroller(); return b ? b.scrollTop : scrollY; };
  var scrollTo_ = function (top) { (scroller() || window).scrollTo({ top: top, behavior: "instant" }); };

  /* ── Reload: back to where the visitor was, without a flash of the top of the page ──
     Safari puts a reloaded page back in place only after everything has loaded, so for a moment it shows the top. Here
     the browser is told not to do it (scrollRestoration = "manual"). The position is remembered here and scrolled to
     once the page's scripts have built it (the card stack and the pinned logos add height), right before the first
     frame is shown. Until then the page is hidden under a white cover (base.css): on a reload that looks like the usual
     blank moment. */
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
    var KEY = "fm-scroll:" + location.pathname;
    var save = function () { try { sessionStorage.setItem(KEY, String(Math.round(scrollY_()))); } catch {} };
    addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") save(); });
    // only a reload or Back / Forward goes back to the old place; a visit by a link starts at the top
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    var type = nav && nav.type, y = 0;
    try { y = parseInt(sessionStorage.getItem(KEY), 10) || 0; } catch {}
    if ((type === "reload" || type === "back_forward") && y > 0) {
      // a section link (#…) left in the address bar would make the browser jump to that section instead
      if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
      root.classList.add("restoring");
      var done = false;
      var show = function () { root.classList.remove("restoring"); };
      var restore = function () {
        if (done) return;
        done = true;
        scrollTo_(y);
        if (window.fmRefresh) window.fmRefresh();          // pins and scroll animations measured for this place
        requestAnimationFrame(show);                        // one more frame, so everything that follows the scroll has caught up
      };
      // once the page's own scripts have laid it out (main.js says so: "fm:ready") and the fonts have arrived (they change
      // the height of the text)
      document.addEventListener("fm:ready", function () {
        var go = function () { requestAnimationFrame(restore); };
        document.fonts.ready.then(go);
        setTimeout(go, 400);
      });
      setTimeout(function () { restore(); show(); }, 3000); // safety net: the page is never kept hidden longer than this
    }
  }

  /* ── Steady screen height on phones and tablets ──
     In Safari 100vh stays the same while its bars hide and show. In the browsers built into apps (Telegram, Instagram,
     VK…) it does not: there 100vh is the visible height, and that changes when the app's bars collapse on the first
     scroll and come back on the way up. The card stack is many screens tall, so everything below it would move by many
     times that change, and the pinned logos and the ring would keep the places they had measured.
     So on phones and tablets the screen's height is read here and written as --fm-vh (one hundredth of it, in px), and
     the styles size the card stack by it. It changes only
       · when the screen gets wider or narrower (the phone was turned): it is read again;
       · when the screen gets taller than it has been at this width (the app's bars collapsed): it grows to that.
     It never shrinks when the bars come back, so nothing moves on the way up. On computers it is not set (vh is used).
     The same for --fm-svh (the hero, see hero.css), which is read again only when the phone is turned.
     To check it on a phone: fmSteady.state() in the console. */
  if (matchMedia("(hover: none) and (pointer: coarse)").matches) {
    var probe = null, svhProbe = null, width = 0, unit = 0, timer = 0, changes = 0, svhWidth = -1;
    var read = function () { return probe.getBoundingClientRect().height / 100; };    // 1vh in px, as the browser has it now
    var set = function (v) { unit = v; root.style.setProperty("--fm-vh", v.toFixed(3) + "px"); };
    var readSvh = function () {
      if (!svhProbe || innerWidth === svhWidth) return;
      svhWidth = innerWidth;
      var v = svhProbe.getBoundingClientRect().height / 100;
      if (v > 0) root.style.setProperty("--fm-svh", v.toFixed(3) + "px");
    };
    var check = function () {
      readSvh();
      var now = read(), w = innerWidth;
      if (!(now > 0) || (w === width && now <= unit + 0.01)) return;              // not taller, same width: nothing to do
      width = w;
      // the block in the middle of the screen stays where it is: the sections above it may have just grown
      var at = document.elementFromPoint(w / 2, innerHeight / 2);
      var keep = at && at.closest && (at.closest(".pin-spacer") || at.closest("section"));
      var before = keep ? keep.getBoundingClientRect().top : 0;
      set(now);
      changes++;
      if (keep) { var moved = keep.getBoundingClientRect().top - before; if (Math.abs(moved) > 1) scrollTo_(scrollY_() + moved); }
      clearTimeout(timer);
      // the scroll animations measure again once the scrolling has stopped, so a flick of the finger is not cut short
      timer = setTimeout(function () { if (window.fmRefresh) window.fmRefresh(true); }, 100);
    };
    var make = function (height) {
      var el = document.createElement("div");
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = "position:fixed;left:0;top:0;width:0;height:" + height + ";visibility:hidden;pointer-events:none";
      document.body.appendChild(el);
      return el;
    };
    var start = function () {
      if (probe) return;
      probe = make("100vh");
      if (CSS.supports("height", "1svh")) svhProbe = make("100svh");
      width = innerWidth;
      set(read());
      readSvh();
      addEventListener("resize", check);
      if (window.visualViewport) visualViewport.addEventListener("resize", check);
    };
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
    window.fmSteady = { state: function () { return { vh: probe && read(), steady: unit, width: width, changes: changes }; } };
  }

  /* ── The hero picture fades in once it has loaded (see hero.css), even before the other scripts have arrived ── */
  document.addEventListener("load", function (e) {
    if (e.target.classList && e.target.classList.contains("hero__img")) root.classList.add("hero-loaded");
  }, true);
})();

/* Safari on a Mac: the page scrolls in its own box (scroller.js says why). Put into <head> of every page as it is (the
   build minifies it), before anything is drawn and before boot.js; free of imports. base.css makes the box, .page
   (data-page), fill the screen and scroll, on every page that has one.
   Safari 26 and later (Version/26…), on a Mac (no touch: an iPad says "Macintosh" too, but has touch points), and not
   another browser that names Safari in its address (Chrome, Edge, Firefox, Opera). ?fmbox=1 / ?fmbox=0 force it. */
(function () {
  var root = document.documentElement;
  var force = /[?&]fmbox=([01])/.exec(location.search);
  var ua = navigator.userAgent, ver = /Version\/(\d+)[\d.]* (Mobile\/\S+ )?Safari\//.exec(ua);
  var macSafari = /Macintosh/.test(ua) && !navigator.maxTouchPoints && !!ver && +ver[1] >= 26
    && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Firefox/.test(ua);
  if (!(force ? force[1] === "1" : macSafari)) return;
  root.classList.add("boxed");
  // the keys that scroll (space, the arrows, Page Down…) scroll what holds the focus, and at first nothing does. The box
  // takes the focus (not drawn, base.css), so they scroll the page from the start; the first Tab still goes to the skip
  // link, the box's first child
  document.addEventListener("DOMContentLoaded", function () {
    var box = document.querySelector("[data-page]");
    if (!box) return;
    box.tabIndex = -1;
    box.focus({ preventScroll: true });
  });
})();

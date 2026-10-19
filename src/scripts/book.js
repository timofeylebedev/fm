/* The booking of a demo: every «Запланировать демо» button ([data-demo]) opens a window of the site's own
   (styles/components/book.css) with the calendar of Planerka in it, instead of Planerka's popup.

   Why our own: Planerka's script (embed.js) builds its popup and starts loading the calendar only when the button is
   clicked, and throws both away when the popup is closed. The calendar is a whole web app (its page is made on the
   server, ~0.55 s; then its scripts; then two requests for the free days and times, ~1.3 s more), so every click
   waited 2–4 seconds behind three blinking dots. Here the calendar is loaded before it is asked for and kept:
     · when the visitor pauses (after the first move of their own on the page: the mouse, a key, a finger, the wheel;
       once the page has not been scrolled for a moment and the browser is idle); not at all on Save-Data or a 2G
       connection, and never for a visitor who does nothing (a robot, a speed test), so Planerka is not loaded for nobody;
     · at once when a pointer comes over a demo button (or a card that opens one), a finger touches it, or the
       keyboard reaches it: the 0.1–0.5 s before the click are a head start;
     · it stays loaded after the window is closed, so a second click is instant too. If the tab has been away for a
       long time (BOOK.stale) and the window was never opened, the calendar is loaded again, so its free times are fresh.
   No script of Planerka runs on the page: the frame speaks to the page by the same messages embed.js understands
   ("planerka:init" to it, "planerka:resize" from it), and only messages from Planerka's own frame are listened to.
   The calendar counts as there once its frame has said something (its height, or its counter saying hello): a frame
   that loaded but is silent is an error page (no network, Planerka down, blocked), and the window then offers the
   page of Planerka in a new tab instead.

   The window: a card in the middle of the screen on computers, a sheet from the bottom on phones (its bar can be
   pulled down). It closes with the cross, Escape, a click outside, or Back (the window is a step in the history, so a
   phone's Back button closes it instead of leaving the site). A link to the page with #demo opens it straight away.
   Without scripts, in a browser without <dialog> (Safari before 15.4), or with Ctrl/⌘/Shift or the middle button,
   a demo button opens the page of Planerka in a new tab, as before. UTM tags in the address are handed to Planerka,
   so a booking keeps its source. */
import { css, calm } from "./motion.js";

const BOOK = {
  url: "https://planerka.app",
  user: "flow-medium-8nzjz3",
  event: "demo",
  look: { embed: "1", embed_bg: "transparent", embed_shadow: "none", embed_hide_branding: "1" },
  wide: 1024,            // px: from this width of its frame the calendar puts its three columns side by side…
  heights: [668, 1040],  // …and is about this tall (wide, narrow) until it says how tall it is
  idle: true,            // load the calendar when the visitor pauses (false: only when a demo button is pointed at)
  rest: 1200,            // ms without scrolling that count as a pause
  stale: 20 * 60e3,      // ms: a calendar older than this, never opened, is loaded again when the tab comes back
  silent: 4000,          // ms: a frame loaded but silent this long is not the calendar (an error page)
  wait: 12000,           // ms: no calendar this long after the window opened → offer Planerka's page in a new tab
  hash: "#demo"
};
const ORIGIN = new URL(BOOK.url).origin;
const PAGE = `${BOOK.url}/${BOOK.user}/${BOOK.event}`;
const ID = "fm-book";
const root = document.documentElement;
const narrow = matchMedia("(max-width: 47.999em)");     // --phone of media.css: the sheet

let dlg, card, bar, body, frame, fail;
let ready = false, failed = false, heard = false, isOpen = false, opened = false, warmedAt = 0, from = null;
let waitTimer = 0, silentTimer = 0, grow = null;
// the history: the step the window added (and how long the history was then), and a Back of ours on its way
let pushedAt = 0, backing = false, pushAfterBack = false;
const messages = [];

// the address of the calendar: its look, and the UTM tags and the prefilled fields (planerka_name…) of this page
function address(base, look) {
  const q = new URLSearchParams(look || {});
  for (const [k, v] of new URLSearchParams(location.search)) {
    if (/^utm_/.test(k)) q.set(k, v);
    else if (/^planerka_(name|email|phone|telegram|notes|guest)$/.test(k)) q.set(k.slice(9), v);
  }
  const s = q.toString();
  return s ? base + "?" + s : base;
}

function build() {
  dlg = document.createElement("dialog");
  dlg.className = "book";
  dlg.setAttribute("aria-labelledby", ID + "-title");
  dlg.tabIndex = -1;               // the window itself takes the focus when it opens (Tab then goes to the cross)
  dlg.innerHTML =
    '<div class="book__card">' +
      '<div class="book__bar">' +
        `<p class="book__title" id="${ID}-title">Запись на демо</p>` +
        '<button class="book__close" type="button" aria-label="Закрыть"><i></i><i></i></button>' +
      "</div>" +
      '<div class="book__body">' +
        '<div class="book__wait" aria-hidden="true"><i></i><i></i><i></i></div>' +
        '<p class="book__fail" hidden>Календарь не загрузился. ' +
          `<a href="${address(PAGE)}" target="_blank" rel="noopener">Открыть запись на сайте Планёрки</a></p>` +
      "</div>" +
    "</div>";
  card = dlg.querySelector(".book__card");
  bar = dlg.querySelector(".book__bar");
  body = dlg.querySelector(".book__body");
  fail = dlg.querySelector(".book__fail");
  document.body.appendChild(dlg);

  dlg.querySelector(".book__close").addEventListener("click", () => close());
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });      // Escape: closed our way, eased
  // closed by the browser itself (not by close()): the page is let go all the same
  dlg.addEventListener("close", () => { if (isOpen) { isOpen = false; dropStep(); settle(); } });
  // a click on the frosted glass around the card (pressed and let go there, not a selection dragged out of the card)
  let downOutside = false;
  dlg.addEventListener("pointerdown", (e) => { downOutside = e.target === dlg; });
  dlg.addEventListener("click", (e) => { if (downOutside && e.target === dlg) close(); downOutside = false; });
  fail.querySelector("a").addEventListener("click", () => close());
  initPull();
}

// the animations this script started (not the CSS ones: the dots, the hover): stopped before the next move
const mine = () => dlg.getAnimations({ subtree: true }).filter((a) =>
  !(window.CSSAnimation && a instanceof CSSAnimation) && !(window.CSSTransition && a instanceof CSSTransition));

// ── the calendar: put in place once, kept ──
function warm(reason) {
  if (frame) return;
  if (!dlg) build();
  frame = document.createElement("iframe");
  frame.className = "book__frame";
  frame.title = "Календарь записи на демо (Планёрка)";
  frame.setAttribute("scrolling", "no");                 // as tall as its content: the window scrolls, not the frame
  frame.style.height = (body.clientWidth >= BOOK.wide ? BOOK.heights[0] : BOOK.heights[1]) + "px";
  frame.addEventListener("load", onLoad);
  frame.src = address(PAGE, BOOK.look);
  body.prepend(frame);
  warmedAt = Date.now();
  window.fmBook.warmed = { reason, at: Math.round(performance.now()) };
}

function onLoad() {
  // tell the calendar it is embedded and how it is called (it answers with its height)
  try { frame.contentWindow.postMessage({ type: "planerka:init", frameId: ID }, ORIGIN); } catch {}
  // loaded, and nothing said: an error page (if it has spoken already, its own timer is running)
  if (!ready && !heard) { clearTimeout(silentTimer); silentTimer = setTimeout(() => setFailed(), BOOK.silent); }
}

function setReady() {
  clearTimeout(silentTimer); clearTimeout(waitTimer);
  failed = false;
  fail.hidden = true;
  dlg.classList.remove("is-failed");
  if (ready) return;
  ready = true;
  dlg.classList.add("is-ready");
  window.fmBook.ready = Math.round(performance.now());
}

function setFailed() {
  if (ready) return;
  failed = true;
  fail.hidden = false;
  dlg.classList.add("is-failed");
}

function setHeight(h) {
  const old = frame.offsetHeight;
  if (Math.abs(h - old) < 1) return;
  // while the window is on screen the room of the frame follows smoothly (from where it is now, even halfway through
  // the last change); the calendar itself is in place at once
  const shown = isOpen && ready && !calm && Math.abs(h - old) > 4 ? body.getBoundingClientRect().height : 0;
  frame.style.height = h + "px";
  if (grow) { grow.cancel(); grow = null; }
  if (shown) grow = body.animate([{ height: shown + "px" }, { height: body.offsetHeight + "px" }], { duration: 350, easing: css.out });
}

addEventListener("message", (e) => {
  if (!frame || e.origin !== ORIGIN || e.source !== frame.contentWindow) return;
  let d = e.data;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
  if (!d || typeof d !== "object") return;
  messages.push([Math.round(performance.now()), d.type || (d.data && d.data.type) || "?", d]);
  if (messages.length > 50) messages.shift();
  if (d.type === "planerka:resize" && d.height > 0) {
    setHeight(Math.max(400, Math.round(d.height)));
    setReady();
  } else if (d.type === "planerka:enable_scroll") {
    // the calendar wants to scroll by itself (a long form): it gets the height of the screen and its own scroll
    frame.setAttribute("scrolling", "yes");
    setHeight(Math.max(400, dlg.clientHeight - bar.offsetHeight - 2 * card.offsetTop));
  } else if (!ready && !heard) {
    // its page said hello (its counter speaks first): it is Planerka; its height follows, or it is shown shortly anyway
    clearTimeout(silentTimer);
    silentTimer = setTimeout(() => setReady(), 1500);
  }
  heard = true;
});

// ── the history: the open window is one step of it ──
const clean = () => location.pathname + location.search;
function pushStep() {
  history.pushState({ fmBook: 1 }, "", BOOK.hash);
  pushedAt = history.length;
}
function dropStep() {
  if (!(history.state && history.state.fmBook)) return;
  // our step is the last one (the calendar added none of its own): go back over it, as Back would. Otherwise (the
  // calendar went from page to page inside its frame, which adds steps to the same history) a Back would only take
  // the calendar back a page: the step is just renamed to the page without the window.
  if (history.length === pushedAt) {
    backing = true;
    history.back();
    setTimeout(() => {                                   // the Back never arrived here: fall back to renaming
      if (backing && history.state && history.state.fmBook) { backing = false; history.replaceState(null, "", clean()); }
    }, 400);
  } else {
    history.replaceState(null, "", clean());
  }
}

// ── the window ──
const sheet = () => narrow.matches;

function open(opts = {}) {
  if (isOpen) return;
  warm("click");
  mine().forEach((a) => a.cancel());                     // a close still on its way: stopped
  isOpen = true; opened = true;
  if (!dlg.open) dlg.showModal();
  dlg.focus({ preventScroll: true });
  root.classList.add("book-open");
  dlg.scrollTop = 0;
  card.style.transform = "";
  if (failed) { fail.hidden = false; }
  else if (!ready) {
    clearTimeout(waitTimer);
    waitTimer = setTimeout(() => setFailed(), BOOK.wait);
  }
  if (opts.push !== false) {
    if (backing) pushAfterBack = true;                   // closed and opened again before our Back has arrived
    else if (!(history.state && history.state.fmBook)) pushStep();
  }
  if (calm) {
    dlg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: css.out });
  } else {
    dlg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: css.out });
    card.animate(sheet()
      ? [{ transform: "translateY(100%)" }, { transform: "none" }]
      : [{ transform: "translateY(24px) scale(0.98)" }, { transform: "none" }],
      { duration: sheet() ? 450 : 500, easing: css.out });
  }
}

// the window gone: the page is let go, the focus goes back to the button that opened it (or to the burger, if the
// button was a pill of the menu, which has closed meanwhile)
function settle() {
  root.classList.remove("book-open");
  card.style.transform = "";
  const back = from && from.isConnected && from.getClientRects().length ? from : document.querySelector("[data-menu-button]");
  if (back && back.getClientRects().length) back.focus({ preventScroll: true });
  from = null;
}

function close(opts = {}) {
  if (!isOpen) return;
  isOpen = false;
  clearTimeout(waitTimer);
  if (!opts.fromHistory) dropStep();                     // Back after closing must not open it again
  const pulled = card.style.transform || (sheet() ? "translateY(0)" : "none");
  mine().forEach((a) => a.cancel());
  const fade = dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: calm ? 150 : 250, easing: css.out, fill: "forwards" });
  if (!calm) {
    card.animate(sheet()
      ? [{ transform: pulled }, { transform: "translateY(100%)" }]
      : [{ transform: "none" }, { transform: "translateY(12px) scale(0.98)" }],
      { duration: sheet() ? 300 : 250, easing: css.leave, fill: "forwards" });
  }
  fade.finished.then(() => {
    if (isOpen) return;                                  // opened again meanwhile
    mine().forEach((a) => a.cancel());
    dlg.close();
    settle();
  }, () => {});
}

// phones: the sheet can be pulled down by its bar (when it is scrolled to its top); far enough or fast enough, it closes
function initPull() {
  let y0 = 0, t0 = 0, dy = 0, id = null;
  bar.addEventListener("pointerdown", (e) => {
    if (!sheet() || !isOpen || e.target.closest("button") || dlg.scrollTop > 0) return;
    id = e.pointerId; y0 = e.clientY; t0 = performance.now(); dy = 0;
    bar.setPointerCapture(id);
  });
  bar.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    dy = Math.max(0, e.clientY - y0);
    card.style.transform = `translateY(${dy}px)`;
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    const speed = dy / Math.max(1, performance.now() - t0);            // px per ms
    if (dy > 96 || (speed > 0.6 && dy > 24)) { close(); return; }
    if (dy > 0) card.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 300, easing: css.out });
    card.style.transform = "";
  };
  bar.addEventListener("pointerup", end);
  bar.addEventListener("pointercancel", end);
}

// ── when to load the calendar before it is asked for ──
const demoOf = (t) => {
  if (!t || !t.closest) return null;
  const card = t.closest("[data-linkcard]");
  return t.closest("[data-demo]") || (card && card.querySelector("[data-demo]"));
};

function initWarm() {
  const intent = (e) => { if (!frame && demoOf(e.target)) warm(e.type); };
  ["pointerover", "pointerdown", "focusin"].forEach((t) => document.addEventListener(t, intent, { passive: true }));
  document.addEventListener("touchstart", intent, { passive: true });

  // a calendar loaded long ago and never opened: loaded again when the tab is looked at again (in place of the old
  // page, so the history gets no step of its own)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !frame || opened || Date.now() - warmedAt < BOOK.stale) return;
    ready = false; failed = false; heard = false;
    dlg.classList.remove("is-ready", "is-failed");
    warmedAt = Date.now();
    try { frame.contentWindow.location.replace(address(PAGE, BOOK.look)); } catch {}
  });

  const c = navigator.connection;
  if (!BOOK.idle || (c && (c.saveData || /2g/.test(c.effectiveType || "")))) return;
  // the visitor's own moves only: a scroll alone may be the page's own (back to the old place after a reload)
  const moves = ["pointermove", "keydown", "touchstart", "wheel"];
  let timer = 0;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
  const rest = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { removeEventListener("scroll", rest); idle(() => warm("idle"), { timeout: 3000 }); }, BOOK.rest);
  };
  const first = () => {
    moves.forEach((t) => removeEventListener(t, first));
    addEventListener("scroll", rest, { passive: true });
    rest();
  };
  const start = () => moves.forEach((t) => addEventListener(t, first, { passive: true }));
  if (document.readyState === "complete") start(); else addEventListener("load", start, { once: true });
}

export function initBook() {
  const links = document.querySelectorAll("[data-demo]");
  // without <dialog> (Safari before 15.4) the buttons stay links to the page of Planerka, in a new tab
  if (!links.length || !(window.HTMLDialogElement && HTMLDialogElement.prototype.showModal)) return;
  window.fmBook = { BOOK, messages, warm: () => warm("console"), open: () => open(), close: () => close(),
    get state() { return { warmed: !!frame, ready, failed, open: isOpen, height: frame && frame.offsetHeight }; } };

  // the links themselves, for a new tab: with the UTM tags of this page
  links.forEach((a) => { a.href = address(PAGE); });

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("[data-demo]");
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    from = a;
    open();
  });

  addEventListener("popstate", () => {
    if (backing) {                                       // our own Back, over the window's step
      backing = false;
      if (pushAfterBack) { pushAfterBack = false; if (isOpen) pushStep(); }
      return;
    }
    const ours = history.state && history.state.fmBook;
    if (isOpen && !ours) close({ fromHistory: true });
    else if (!isOpen && ours) { pushedAt = history.length; open({ push: false }); }   // Forward, to the open window
  });
  addEventListener("hashchange", () => {
    if (location.hash !== BOOK.hash || isOpen) return;
    history.replaceState({ fmBook: 1 }, "", BOOK.hash);  // a link to #demo on the page: that step is the window's
    pushedAt = history.length;
    open({ push: false });
  });
  if (location.hash === BOOK.hash) {
    // a link from outside to …/#demo: the window opens at once (Back then closes it and stays on the site)
    history.replaceState(null, "", clean());
    open();
  } else if (history.state && history.state.fmBook) {
    // a reload while the window was open (boot.js has taken the #demo away to scroll back): no window, no step
    history.replaceState(null, "", clean());
  }

  initWarm();
}

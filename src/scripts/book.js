/* The booking of a demo: every «Запланировать демо» button ([data-demo]) opens a window of the site's own
   (styles/components/book.css) with the calendar of Planerka in it, instead of Planerka's popup.

   Why our own: Planerka's script (embed.js) builds its popup and starts loading the calendar only when the button is
   clicked, and throws both away when the popup is closed. The calendar is a whole web app (its page is made on the
   server, ~0.55 s; then its scripts; then two requests for the free days and times, ~1.3 s more), so every click
   waited 2–4 seconds behind three blinking dots. Here the calendar is loaded before it is asked for and kept, once the
   visitor has pressed «ОК» on the cookie notice (consent.js: Planerka's page brings Yandex Metrica, Google Analytics
   and reCAPTCHA with it, so loading it ahead is optional, and waits for consent; a click always loads it):
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

   The window: Planerka's own card on the frosted glass, cropped out of its frame (book.css says how), with nothing of
   ours but a close button over its corner; three columns on computers, one on phones and tablets. It closes with the
   cross, Escape, a click on the glass, or Back (the window is a step in the history, so a
   phone's Back button closes it instead of leaving the site; the step keeps the page's own address: no #demo in the
   address bar, Tim, Oct 20). A link to the page with #demo opens it straight away, and the #demo is taken away.
   Without scripts, in a browser without <dialog> (Safari before 15.4), or with Ctrl/⌘/Shift or the middle button,
   a demo button opens the page of Planerka in a new tab, as before. UTM tags in the address are handed to Planerka,
   so a booking keeps its source. */
import { css, calm } from "./motion.js";
import { onScroll, offScroll } from "./scroller.js";
import { onConsent } from "./consent.js";

const BOOK = {
  url: "https://planerka.app",
  user: "flow-medium-8nzjz3",
  event: "demo",
  look: { embed: "1", embed_bg: "transparent", embed_shadow: "none", embed_hide_branding: "1" },
  idle: true,            // load the calendar when the visitor pauses (false: only when a demo button is pointed at)
  rest: 1200,            // ms without scrolling that count as a pause
  stale: 20 * 60e3,      // ms: a calendar older than this, never opened, is loaded again when the tab comes back
  silent: 4000,          // ms: a frame loaded but silent this long is not the calendar (an error page)
  wait: 12000,           // ms: no calendar this long after the window opened → offer Planerka's page in a new tab
  grow: 300,             // ms: once settled, a taller calendar is believed only after it has stayed so this long (see setHeight)
  skeleton: 3000,        // ms: a calendar that never changes from its first height is shown after this long anyway (see setHeight)
  trust: 1500,           // ms: taller than this month's calendar should be, before the visitor has used it: believed after this long
  hash: "#demo"
};
const ORIGIN = new URL(BOOK.url).origin;
const PAGE = `${BOOK.url}/${BOOK.user}/${BOOK.event}`;
const ID = "fm-book";
const root = document.documentElement;
const narrow = matchMedia("(max-width: 47.999em)");     // --phone of media.css: the card comes up from below
const wide = matchMedia("(min-width: 62em)");           // book.css: the three columns, whose height does not depend on the window
const SEEN = "fm-book-h";                               // localStorage: the calendar's settled height, three columns

let dlg, box, card, frame, fail;
let ready = false, failed = false, heard = false, isOpen = false, opened = false, warmedAt = 0, from = null;
let waitTimer = 0, silentTimer = 0, settleTimer = 0, stillTimer = 0, growTimer = 0, firstHeight = 0, shown = 0, byKeys = false;
let used = false, probe;   // the visitor has used the calendar (the focus went into its frame); probe: an element --h0 tall
let firstH = 0, changed = false, latest = 0;   // latest: the last height the calendar reported   // the first height the calendar reported (its skeleton), and whether it has changed since
let seenAt = 0;            // when the calendar was first seen: the window open with the calendar in it (performance.now())
const heights = [];        // what setHeight decided, for fmBook.report(): [ms, height, wait, used, h0]
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
  dlg.setAttribute("aria-label", "Запись на демо");      // no title on screen: the calendar says what it is
  dlg.tabIndex = -1;               // the window itself takes the focus when it opens (Tab then goes to the cross)
  dlg.innerHTML =
    '<div class="book__box">' +
      '<div class="book__top"><button class="book__close" type="button" aria-label="Закрыть"><i></i><i></i></button></div>' +
      '<div class="book__card">' +
        '<div class="book__wait" aria-hidden="true"><span><i></i><i></i><i></i><i></i><i></i></span></div>' +
        '<i class="book__h0" aria-hidden="true"></i>' +
        '<p class="book__fail" hidden>Календарь не загрузился. ' +
          `<a href="${address(PAGE)}" target="_blank" rel="noopener">Открыть запись на сайте Планёрки</a></p>` +
      "</div>" +
    "</div>";
  dlg.style.setProperty("--rows", weeks());              // the height it will have (book.css: --h0)
  // the height the calendar had the last time, on this device, for a month of as many weeks (book.css: --h0-seen)
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN) || "null");
    if (seen && seen.rows === weeks() && seen.h > 400 && seen.h < 1000) dlg.style.setProperty("--h0-seen", seen.h + "px");
  } catch {}
  box = dlg.querySelector(".book__box");
  card = dlg.querySelector(".book__card");
  fail = dlg.querySelector(".book__fail");
  probe = dlg.querySelector(".book__h0");
  document.body.appendChild(dlg);

  dlg.querySelector(".book__close").addEventListener("click", () => close());
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });      // Escape: closed our way, eased
  // closed by the browser itself (not by close()): the page is let go all the same
  dlg.addEventListener("close", () => { if (isOpen) { isOpen = false; dropStep(); settle(); } });
  // a click on the frosted glass beside the card (pressed and let go there, not a selection dragged out of the card)
  const glass = (e) => !e.target.closest(".book__card, .book__close");
  let downOutside = false;
  dlg.addEventListener("pointerdown", (e) => { downOutside = glass(e); });
  dlg.addEventListener("click", (e) => { if (downOutside && glass(e)) close(); downOutside = false; });
  fail.querySelector("a").addEventListener("click", () => close());
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
  frame.addEventListener("load", onLoad);
  // a click or a tap in the calendar (or Tab into it) takes the focus into the frame: the page loses it. Only while
  // the window is open and the calendar has been seen for a moment: a calendar may take the focus by itself while it
  // loads, which is not the visitor (then a click later sends no new blur: its taller pages wait BOOK.trust)
  addEventListener("blur", () => setTimeout(() => {
    if (document.activeElement === frame && isOpen && seenAt && performance.now() - seenAt > 600) used = true;
  }));
  frame.src = address(PAGE, BOOK.look);
  card.prepend(frame);
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
  clearTimeout(silentTimer); clearTimeout(waitTimer); clearTimeout(settleTimer);
  failed = false;
  fail.hidden = true;
  dlg.classList.remove("is-failed");
  if (ready) return;
  ready = true;
  if (isOpen && !seenAt) seenAt = performance.now();
  dlg.classList.add("is-ready");
  if (latest) apply(latest);                             // its height, set as it fades in (not while the dots were shown)
  window.fmBook.ready = Math.round(performance.now());
}

function setFailed() {
  if (ready) return;
  failed = true;
  fail.hidden = false;
  dlg.classList.add("is-failed");
}

// the rows of days the calendar opens with: the weeks of this month (Monday first), 4 to 6
function weeks(d = new Date()) {
  const first = (new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.ceil((first + days) / 7);
}

// the height of the calendar's page: the frame is that tall, the crop that less the page above the card. Once it has
// settled, at once, not eased: the calendar's own card has already changed, and a crop catching up with it would trail
// behind it (book.css eases it only while the calendar fills in). But a taller page is not always believed at once:
//   · taller than this month's calendar should be (--h0, book.css), before the visitor has used it: only once it has
//     stayed so for BOOK.trust. Nothing the visitor has not done makes the calendar grow past that, yet Planerka
//     reports such heights for a moment while it fills in: about 220px more for about a second when the times of the
//     first free day slide in (Tim's video «planerka-jump 2», Oct 22: the card grew past the bottom of the screen and
//     snapped back), and the next month drawn under this one for a frame or two (Tim's video, Oct 22);
//   · any taller page once settled: only once it has stayed so for BOOK.grow (the same next month, later);
//   · after the visitor has used the calendar (a time chosen, the form opened), BOOK.grow: it does grow then.
// The crop keeps its height meanwhile, so the moments that are not believed never show. A shorter page: at once.
function apply(h) {
  clearTimeout(growTimer);
  const h0 = (probe && probe.offsetHeight) || Infinity, expected = h0 + 24;   // a few px more than --h0 is no surprise
  const wait = h <= shown ? 0
    : h > Math.max(shown, expected) && !used ? BOOK.trust
    : dlg.classList.contains("is-still") || h > Math.max(shown, expected) ? BOOK.grow : 0;
  heights.push([Math.round(performance.now()), h, wait, used, h0]);
  if (heights.length > 80) heights.shift();
  if (wait) growTimer = setTimeout(() => crop(h), wait);
  else crop(h);
}

function setHeight(h) {
  latest = h;
  // until the calendar is shown, the white card keeps its height (--h0) under the dots: a calendar a few px taller or
  // shorter is set as it fades in (Tim's video, Oct 23: the card grew 6px under the dots, 649 against 643)
  if (ready) apply(h);
  else heights.push([Math.round(performance.now()), h, "hidden", used, probe && probe.offsetHeight]);
  // the white card under it stays until its height has not changed for a second: while the calendar fills in (days,
  // then times) it follows its height smoothly (book.css, .is-still)
  if (!dlg.classList.contains("is-still")) {
    clearTimeout(stillTimer);
    stillTimer = setTimeout(() => dlg.classList.add("is-still"), 1000);
  }
  // shown only once it has filled in. The calendar first reports the height of its skeleton (grey days, as tall as the
  // real ones), then waits ~1.3 s for its free days; when they come it draws the next month under this one for two
  // frames and reports that height (Tim's video, Oct 23: the grey skeleton was shown, then November flashed inside the
  // card). So it is shown once a height different from the first has come and nothing new for 250 ms after it (the
  // days are in, the flash is over); one that never changes, BOOK.skeleton after its first height
  if (ready) return;
  const now = performance.now();
  if (!firstHeight) { firstHeight = now; firstH = h; }
  if (Math.abs(h - firstH) > 2) changed = true;
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => setReady(), changed ? 250 : Math.max(250, firstHeight + BOOK.skeleton - now));
}

// the settled height of the three columns, for the next time the window opens (before the visitor has used it: a form
// or a chosen time is not the calendar's own height). Only a number, no data about the visitor.
function remember() {
  if (!ready || used || !wide.matches || !shown) return;
  try { localStorage.setItem(SEEN, JSON.stringify({ rows: weeks(), h: shown })); } catch {}
}

let keepTimer = 0;
function crop(h) {
  shown = h;
  card.style.setProperty("--h", h + "px");
  // far from this month's calendar (another page of Planerka: the form): the card is centred for its own height.
  // Only once the visitor has used the calendar: while it loads, Planerka reports a page ~220px taller than its card
  // for a second or more (the times sliding in), whose extra is see-through, and the card moved up and back down for
  // it (Tim's video, Oct 23, 02:34)
  const h0 = probe && probe.offsetHeight;
  if (ready && used && h0 && Math.abs(h - h0) > 24) dlg.style.setProperty("--h-center", h + "px");
  else dlg.style.removeProperty("--h-center");
  clearTimeout(keepTimer);
  keepTimer = setTimeout(remember, 1000);                // kept once it has stood for a second
}

addEventListener("message", (e) => {
  if (!frame || e.origin !== ORIGIN || e.source !== frame.contentWindow) return;
  let d = e.data;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
  if (!d || typeof d !== "object") return;
  messages.push([Math.round(performance.now()), d.type || (d.data && d.data.type) || "?", d]);
  if (messages.length > 50) messages.shift();
  if (d.type === "planerka:resize" && d.height > 0) {
    clearTimeout(silentTimer);
    setHeight(Math.max(400, Math.round(d.height)));
  } else if (d.type === "planerka:enable_scroll") {
    // the calendar wants to scroll by itself (a long form): it gets the height of the screen and its own scroll
    frame.setAttribute("scrolling", "yes");
    setHeight(Math.max(400, dlg.clientHeight - card.offsetTop));
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
  history.pushState({ fmBook: 1 }, "", clean());         // the address stays as it is
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
  if (ready && !seenAt) seenAt = performance.now();
  if (!dlg.open) dlg.showModal();
  dlg.focus({ preventScroll: true });
  root.classList.add("book-open");
  dlg.scrollTop = 0;
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
    box.animate(sheet()
      ? [{ transform: "translateY(100vh)" }, { transform: "none" }]
      : [{ transform: "translateY(24px) scale(0.98)" }, { transform: "none" }],
      { duration: sheet() ? 450 : 500, easing: css.out });
  }
}

// the window gone: the page is let go. Opened from the keyboard, the focus goes back to the button that opened it (or
// to the burger, if the button was a pill of the menu, which has closed meanwhile), with its ring: that is where Tab
// goes on from. Opened with a mouse or a finger, nothing is focused (the browser would put the focus back on the
// button by itself, and show its ring after Escape, which is a key).
function settle() {
  root.classList.remove("book-open");
  const back = from && from.isConnected && from.getClientRects().length ? from : document.querySelector("[data-menu-button]");
  if (byKeys) { if (back && back.getClientRects().length) back.focus({ preventScroll: true }); }
  else if (document.activeElement && document.activeElement !== document.body && !dlg.contains(document.activeElement)) document.activeElement.blur();
  from = null;
}

function close(opts = {}) {
  if (!isOpen) return;
  isOpen = false;
  clearTimeout(waitTimer);
  if (!opts.fromHistory) dropStep();                     // Back after closing must not open it again
  mine().forEach((a) => a.cancel());
  const fade = dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: calm ? 150 : 250, easing: css.out, fill: "forwards" });
  if (!calm) {
    box.animate(sheet()
      ? [{ transform: "none" }, { transform: "translateY(50vh)" }]
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

// ── when to load the calendar before it is asked for ──
const demoOf = (t) => {
  if (!t || !t.closest) return null;
  const card = t.closest("[data-linkcard]");
  return t.closest("[data-demo]") || (card && card.querySelector("[data-demo]"));
};

function initWarm() {  // runs once the visitor has agreed to the cookies (initBook)
  const intent = (e) => { if (!frame && demoOf(e.target)) warm(e.type); };
  ["pointerover", "pointerdown", "focusin"].forEach((t) => document.addEventListener(t, intent, { passive: true }));
  document.addEventListener("touchstart", intent, { passive: true });

  // a calendar loaded long ago and never opened: loaded again when the tab is looked at again (in place of the old
  // page, so the history gets no step of its own)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !frame || opened || Date.now() - warmedAt < BOOK.stale) return;
    ready = false; failed = false; heard = false; firstHeight = 0; firstH = 0; changed = false; latest = 0; used = false; seenAt = 0;
    dlg.classList.remove("is-ready", "is-failed", "is-still");
    dlg.style.removeProperty("--h-center");
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
    timer = setTimeout(() => { offScroll(rest); idle(() => warm("idle"), { timeout: 3000 }); }, BOOK.rest);
  };
  const first = () => {
    moves.forEach((t) => removeEventListener(t, first));
    onScroll(rest);                                      // the page's scroll: the window's, or its box's (scroller.js)
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
    // for Tim's console when the card jumps: copy(JSON.stringify(fmBook.report())) and paste it to Claude
    report: () => ({ ua: navigator.userAgent, now: Math.round(performance.now()), seenAt: Math.round(seenAt), heights,
      messages: messages.map(([t, type, d]) => [t, type, d && d.height]), card: card && Math.round(card.getBoundingClientRect().height) }),
    get state() { return { warmed: !!frame, ready, failed, open: isOpen, used, height: frame && frame.offsetHeight, shown, h0: probe && probe.offsetHeight }; } };

  // the links themselves, for a new tab: with the UTM tags of this page
  links.forEach((a) => { a.href = address(PAGE); });

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("[data-demo]");
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    from = a;
    byKeys = e.detail === 0;                             // Enter on a focused link: a click with no pointer
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
    history.replaceState({ fmBook: 1 }, "", clean());    // a link to #demo on the page: that step is the window's (without the #demo)
    pushedAt = history.length;
    open({ push: false });
  });
  if (location.hash === BOOK.hash) {
    // a link from outside to …/#demo: the window opens at once (Back then closes it and stays on the site)
    history.replaceState(null, "", clean());
    open();
  } else if (history.state && history.state.fmBook) {
    // a reload while the window was open: no window, no step
    history.replaceState(null, "", clean());
  }

  onConsent(initWarm);                                   // loading ahead only with consent (at once if given earlier)
}

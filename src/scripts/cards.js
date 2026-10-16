/* The card stack: «Управление», «Документы», «Финансы». The three cards take turns on one screen while the page
   scrolls by.
     · the smallest a card gets is as wide as the card and as tall as its label with the card's top padding above and
       below it. Nothing in the card moves or changes its size: the label stays where it is, and the corners are always
       the card's own. With a radius of half that height and the same padding on the left as on the top, the smallest
       card is a perfect pill;
     · every edge moves with the scroll, px for px, with no easing and no fading;
     · the first card comes up with the page from under the hero, as the smallest card. Once all of it is on screen its
       bottom edge stays at the bottom of the stage and its top keeps coming up with the page: it grows until it fills
       the stage;
     · while it fills the stage it goes through its steps: one title and one drawing per step; the label fills from the
       left (the progress);
     · then the next card comes up from the bottom in the same way, the gap of the stage under the old one. The old card
       gives it room: its top stays, its bottom edge goes up as fast as the new card comes. Its label turns white. Once
       it is the smallest card it goes on up with the page and leaves the screen under the navbar;
     · the last card does the same for the section after the stack.
   A title is shown while the open part of its card reaches below it (with the card's padding under it); a drawing
   once the card is SET.artAt of its full height.

   How it moves, so that it stays smooth on phones: the browser moves the cards itself, with the page, like any other
   block (see stack.css): nothing is moved by the script, so nothing can lag behind the page or shake. The script sets
   the sizes of the blocks the browser moves (on every measuring of the page), and on scroll only decides what is shown:
   which title (with its own timed animation, by lines), whose turn it is among the drawings, the white label, the
   progress in the label, and which drawings can be put to sleep.
   To try values in the console: fmCards.settings.step = 0.5, then fmCards.update(). ?fmcards=debug shows what the
   script measures (see debug.js). */
import { gsap, ScrollTrigger, SplitText, refreshSoon } from "./gsap.js";
import { calm, tidy } from "./motion.js";

const SET = {
  step: 0.7,             // scroll for one step of a card (a title and its drawing), in screen heights
  artAt: 0.5,            // a card shows its drawing once it is this tall (0…1 of its full height)
  artWake: 0.3,          // a card that leaves lets its drawing go below this height (0…1); one that comes is made ready at once
  title: { in: 0.75, out: 0.35, stagger: 0.08, rise: 70, lift: 45 }  // the titles: seconds, and how far the lines travel (% of a line)
};
const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const n2 = (v) => +(+v).toFixed(2);
const px = (v) => n2(v) + "px";

export function initCards() {
  const section = document.querySelector("[data-stack]");
  const stage = section && section.querySelector(".stack__stage");
  if (!stage) return;
  const nav = document.querySelector("[data-nav]");
  const div = (cls) => { const n = document.createElement("div"); n.className = cls; n.setAttribute("aria-hidden", "true"); return n; };

  // ── the cards, and the blocks the browser moves (see stack.css) ──
  //   frame   one screen tall, sticky at the top of the screen; it holds mask, the strip at the bottom of the screen
  //   slot    one per card, around it: the card is sticky in it, so the slot's height is how long the card stays
  //   collar  above every card but the first: the gap over it and the rounded bottom corners of the card it covers;
  //           the last one (end) is at the bottom of the section, above the section after the stack
  //   cap     under every card but the first, sticky with it: the page colour around its top corners
  const cards = [...stage.querySelectorAll(".card")].map((el, i) => {
    const tag = el.querySelector(".card__tag");
    const titles = [...el.querySelectorAll(".card__title")].map((title) => ({ el: title, lines: [title], on: false, size: null }));
    const arts = [...el.querySelectorAll(".card__art > .art")];
    const c = { el, tag, titles, arts, steps: Math.max(1, titles.length, arts.length), m: {}, title: -1, turn: -1, off: null, asleep: null, white: null, pill: null };
    // two layers in the label: the progress (fills it from the left) and the white label (fades in when the card is done)
    c.fill = document.createElement("span");
    c.fill.className = "card__tag-fill";
    c.done = document.createElement("span");
    c.done.className = "card__tag-done";
    c.done.appendChild(tag.querySelector(".card__tag-label").cloneNode(true));
    [c.fill, c.done].forEach((n) => n.setAttribute("aria-hidden", "true"));
    tag.prepend(c.fill);
    tag.appendChild(c.done);
    c.slot = document.createElement("div");
    c.slot.className = "stack__slot";
    el.before(c.slot);
    c.slot.appendChild(el);
    if (i) {
      c.cap = div("stack__cap");
      c.collar = div("stack__collar");
      c.slot.prepend(c.collar, c.cap);
    }
    return c;
  });
  if (!cards.length) return;
  const frame = div("stack__frame"), mask = div("stack__collar stack__mask"), end = div("stack__collar stack__collar-end");
  frame.appendChild(mask);
  stage.prepend(frame);
  stage.appendChild(end);
  section.classList.add("stack-on");
  // the colour of the page (the strips are painted in it); the section after the stack comes up over the last card,
  // which stays whole under it: it needs a background of its own, and must be drawn above the section of the cards
  const page = getComputedStyle(document.body).backgroundColor || "#fff";
  section.style.setProperty("--stack-page", page);
  const after = section.nextElementSibling;
  if (after) {
    const b = getComputedStyle(after).backgroundColor;
    if (!b || b === "transparent" || /rgba\(.*,\s*0\)$/.test(b)) after.style.backgroundColor = page;
    if (getComputedStyle(after).position === "static") after.style.position = "relative";
  }

  // ── the titles: split into lines, which come and go one after another ──
  // a title's lines where they belong right now, without animation (after a split, and at the start)
  const settle = (title) => {
    title.size = null;                                       // measured again (see sizeOf)
    gsap.set(title.lines, { yPercent: 0, opacity: title.on ? 1 : 0 });
    title.el.style.visibility = "visible";
  };
  cards.forEach((c) => c.titles.forEach((title) => {
    tidy(title.el);
    // split again by refresh() below (when the width or the fonts change, with every card at its full size), not by SplitText itself
    title.split = SplitText.create(title.el, {
      type: "lines", linesClass: "fm-line", reduceWhiteSpace: false,
      onSplit(self) { title.lines = self.lines; settle(title); }
    });
  }));

  function showTitle(c, k, dir) {
    if (k === c.title) return;
    const was = c.titles[c.title], now = c.titles[k], T = SET.title, d = calm ? 0 : 1;
    c.title = k;
    if (was) {
      was.on = false;
      gsap.to(was.lines, { yPercent: -T.lift * dir, opacity: 0, duration: T.out * d, ease: "fm-leave", stagger: 0.03 * d, overwrite: true });
    }
    if (now) {
      now.on = true;
      if (!(gsap.getProperty(now.lines[0], "opacity") > 0.05)) gsap.set(now.lines, { yPercent: T.rise * dir });   // gone: it comes from the side it is scrolled from
      gsap.to(now.lines, { yPercent: 0, opacity: 1, duration: T.in * d, ease: "fm-out", stagger: T.stagger * d, delay: was ? T.out * 0.6 * d : 0, overwrite: true });
    }
  }

  // the cards start right under the navbar: its own height and its "top", not where the browser shows it right now
  // (on iPhones that can be off by the part of the screen Safari's bars cover while they collapse or come back)
  const navBottom = () => {
    if (!nav) return 0;
    const s = getComputedStyle(nav);
    if (s.position !== "fixed" && s.position !== "sticky") return Math.max(0, Math.round(nav.getBoundingClientRect().bottom));
    return Math.max(0, Math.round((parseFloat(s.top) || 0) + nav.offsetHeight));
  };

  // ── measuring (whenever ScrollTrigger measures the page) ──
  let V = 0, gap = 0, navH = 0, fontsDone = 0;
  const offsetIn = (el, root) => {                           // where el is inside root, as laid out (transforms do not count)
    let x = 0, y = 0;
    for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y };
  };
  // where a title is in its card and how much room its text takes (its lines together, not the block)
  function sizeOf(c, title) {
    if (title.size) return title.size;
    const at = offsetIn(title.el, c.el), range = document.createRange();
    let top = 0, bottom = 0;
    title.lines.forEach((line, i) => {
      const lineTop = line === title.el ? 0 : offsetIn(line, title.el).y;
      if (!i) top = lineTop;
      if (line === title.el) range.selectNodeContents(line);
      bottom = Math.max(bottom, lineTop + (line === title.el ? range.getBoundingClientRect().height : line.offsetHeight));
    });
    return (title.size = { y: at.y + top, h: bottom - top });
  }
  function measure() {
    navH = navBottom();
    section.style.setProperty("--stack-nav", navH + "px");
    gap = parseFloat(getComputedStyle(stage).paddingBottom) || 0;   // between two cards while they trade places
    section.style.setProperty("--stack-gap", gap + "px");
    V = frame.offsetHeight;
    cards.forEach((c) => {
      const el = c.el, m = c.m;
      m.A = el.offsetHeight;
      m.R = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const at = offsetIn(c.tag, el);
      m.tagH = c.tag.offsetHeight; m.padX = at.x; m.padY = at.y;
      m.ph = Math.min(m.tagH + 2 * m.padY, m.A);             // the smallest card: the label with the card's top padding above and below it
      c.titles.forEach((title) => { title.size = null; });
    });
    // where each card fills the stage: positions in px of scroll since the stage was pinned
    let at = V;                                              // the first card fills it once the section above has gone (one screen)
    cards.forEach((c, i) => {
      if (i) at += V - navH;                                 // the new card's top comes up from the bottom to the top
      c.from = at;
      at += c.steps * SET.step * V;
      c.to = at;
    });
    layOut();
  }

  // The sizes of the slots, the strips and the section, so that the browser moves every card exactly as state()
  // below describes it (A: the height of a card, --stack-a in stack.css; ph: its smallest height):
  //   · a slot is A (the card) + the scroll of its steps + A - ph: the card stays until only ph of it is left uncovered,
  //     then its slot ends and it goes on up with the page;
  //   · every slot but the first is pulled up by A - ph, less the gap: the next card comes up under the old one's
  //     smallest size, the gap between them. The section after the stack is pulled up the same way under the last card.
  // In --fm-vh, like the cards, so all of it follows the steady screen height without being measured again.
  let laid = false;
  function layOut() {
    const place = (strip, c, top, height) => {               // as wide as the card (1px more on each side), its corners
      const box = strip.offsetParent;
      const x = c.el.getBoundingClientRect().left - (box ? box.getBoundingClientRect().left + box.clientLeft : 0);
      strip.style.left = px(x - 1);
      strip.style.width = px(c.el.offsetWidth + 2);
      strip.style.setProperty("--r", px(c.m.R));
      if (top !== null) strip.style.top = top;
      if (height !== null) strip.style.height = height;
    };
    cards.forEach((c, i) => {
      const prev = cards[i - 1];
      c.slot.style.height = "calc(2 * var(--stack-a) + " + (c.steps * SET.step * 100).toFixed(3) + " * var(--fm-vh, 1vh) - " + px(c.m.ph) + ")";
      c.slot.style.marginTop = prev ? "calc(" + px(gap + prev.m.ph) + " - var(--stack-a))" : "";
      // from the old card's corners down under the new card's: the new card is drawn over it, its corners are not
      if (c.collar) place(c.collar, prev, px(-(gap + prev.m.R)), px(gap + prev.m.R + c.m.R));
      if (c.cap) {                                           // in the flow, centred like the card, 1px wider on each side
        c.cap.style.width = px(c.el.offsetWidth + 2);
        c.cap.style.marginLeft = px(c.el.offsetLeft - 1);
        c.cap.style.height = px(c.m.R);
        c.cap.style.marginBottom = px(-c.m.R);
        c.cap.style.setProperty("--r", px(c.m.R));
      }
      // the smallest card, as a cut of the card (see is-pill in draw), with its corners
      c.el.style.setProperty("--stack-pill", "inset(0px 0px calc(var(--stack-a) - " + px(c.m.ph) + ") 0px round " + px(Math.min(c.m.R, c.m.ph / 2)) + ")");
    });
    const last = cards[cards.length - 1];
    place(mask, cards[0], null, null);
    place(end, last, "auto", px(gap + last.m.R));            // (the section after the stack has no corners to fill)
    end.style.bottom = "calc(var(--stack-a) - " + px(last.m.ph) + ")";
    section.style.marginBottom = "calc(" + px(last.m.ph) + " - var(--stack-a))";
    // the first time, the section has just taken its new height: everything on the page is measured again (once)
    if (!laid) { laid = true; refreshSoon(); }
  }

  // ── one moment: where a card is, at p px of scroll since the stage was pinned ──
  // y: where its top is (from the top of its own box, which starts under the navbar), h: how tall it is open. Its bottom
  // edge never goes below the bottom of the stage (A) unless it is coming in, and it is never smaller than the smallest
  // card (ph): one that goes on moving up is scrolled away.
  function shapeOf(c, y, h, leaving) {
    const m = c.m;
    y = Math.max(y, -navH - m.ph - 2);                       // gone above the screen: it stays there
    return { seen: y < m.A + gap - 0.5 && y + h > -navH, leaving, y, h };
  }
  // a card whose top is at y, coming up: the smallest card until all of it is on screen, then its bottom stays at the bottom
  const rising = (c, y) => shapeOf(c, y, Math.max(c.m.ph, c.m.A - y), false);
  function state(c, i, p) {
    const m = c.m, A = m.A, ph = m.ph, prev = cards[i - 1];
    let g, step = 0, fill = 0, white = false;
    if (p < c.from) {                                        // coming
      if (!prev) g = rising(c, V - Math.max(0, p));          // the first one comes up with the page
      else g = rising(c, A + gap - Math.max(0, p - prev.to));   // under the card that gives it room, the gap between them
    } else if (p <= c.to) {                                  // filling the stage: going through its steps
      g = shapeOf(c, 0, A, false);
      step = Math.min(c.steps - 1, Math.floor((p - c.from) / (SET.step * V)));
      fill = clamp((p - c.from) / (c.to - c.from));
    } else {                                                 // giving room to the next one (or to the section after the stack)
      const bottom = A - (p - c.to);
      step = c.steps - 1; fill = 1; white = true;
      g = shapeOf(c, Math.min(0, bottom - ph), Math.max(ph, bottom), true);   // then the smallest card is scrolled away
    }
    return { g, step, fill, white };
  }

  // ── on scroll: what is shown ──
  const flag = (c, key, cls, on, el) => { if (c[key] !== on) { c[key] = on; (el || c.el).classList.toggle(cls, on); } };
  let dir = 1, pillOn = null, fills = new Map(), onDraw = null;
  // p = 0 when the section's top is one screen below the top of the screen
  const target = () => V - section.getBoundingClientRect().top;
  function draw(p) {
    if (onDraw) onDraw(p);
    let pill = false;
    cards.forEach((c, i) => {
      const s = state(c, i, p), g = s.g, m = c.m;
      const fill = "inset(0 " + n2(100 - s.fill * 100) + "% 0 0)";
      if (fills.get(c) !== fill) { fills.set(c, fill); c.fill.style.clipPath = fill; }
      flag(c, "off", "is-off", !g.seen);                     // nothing of it is seen
      // a card that comes up and is still the smallest card is cut to that size itself (is-pill), and the strip at the
      // bottom of the screen is hidden meanwhile (stack-rising), so it comes up whole instead of being cut by the strip
      const isPill = g.seen && !g.leaving && p < c.from && g.y > m.A - m.ph + 0.5;
      flag(c, "pill", "is-pill", isPill);
      if (isPill) pill = true;
      flag(c, "white", "is-done", s.white, c.tag);           // the colour change itself is a transition in stack.css
      // a title is shown while the open part of the card reaches below it (and the card's padding under it)
      const now = c.titles[s.step];
      let fits = false;
      if (now && g.seen) { const b = sizeOf(c, now); fits = b.y + b.h + m.padY <= g.h + 0.5; }
      showTitle(c, fits ? s.step : -1, dir);
      // the drawing whose turn it is (art/mount.js fades it in)
      const turn = g.seen && g.h >= SET.artAt * m.A ? s.step : -1;
      if (turn !== c.turn) { c.turn = turn; c.arts.forEach((art, k) => art.classList.toggle("fm-turn", k === turn)); }
      // not seen, or leaving and small: hidden, so its drawings let go of their memory
      flag(c, "asleep", "is-asleep", !g.seen || (g.leaving && g.h < SET.artWake * m.A));
    });
    if (pill !== pillOn) { pillOn = pill; section.classList.toggle("stack-rising", pill); }
  }

  // measured with every card at its full size (nothing is drawn in between). The titles are split into lines again
  // when it is needed: the cards have another width, or a font has arrived since the last split.
  let splitFor = "";
  function refresh() {
    section.classList.add("stack-instant");                  // no transitions while everything is put in place
    measure();
    const key = cards.map((c) => c.el.offsetWidth).join() + "/" + fontsDone;
    const resplit = key !== splitFor;
    splitFor = key;
    cards.forEach((c) => c.titles.forEach((title) => { if (resplit) title.split.split(); sizeOf(c, title); }));
    if (V) draw(target());
    void section.offsetWidth;
    requestAnimationFrame(() => section.classList.remove("stack-instant"));
  }
  ScrollTrigger.create({
    trigger: section, start: "top bottom", end: "bottom top",
    onUpdate: (self) => { dir = self.direction < 0 ? -1 : 1; if (V) draw(target()); },
    onRefresh: refresh
  });
  refresh();
  // the label and the titles are measured in the font that shows: once a font has arrived, measure again
  document.fonts.addEventListener("loadingdone", () => { fontsDone++; refresh(); });

  window.fmCards = { settings: SET, cards, update() { ScrollTrigger.refresh(); } };
  if (/[?&]fmcards=debug\b/.test(location.search)) {
    import("./debug.js").then((m) => { onDraw = m.cardsDebug({ cards, stage, section, nav, state, navBottom, get V() { return V; } }); });
  }
}

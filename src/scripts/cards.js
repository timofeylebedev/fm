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
       it is the smallest card it goes on up with the page and leaves the screen under the navbar (see «The pill» below);
     · the last card does the same for the section after the stack.
   A title is shown while the open part of its card reaches below it (with the card's padding under it); while the card
   closes (going away, or scrolled back as it came), a little earlier: SET.titleLead of the card's height before the
   edge reaches it, so the title has gone before the edge could cut it. The titles fade in rising and fade out lifting (no blur).
   A drawing is shown once the card is SET.artAt of its full height. It never changes its size while the card opens and
   closes (Tim, Oct 20: the drawings do not scale with the scroll): it is always as big as with the card open, but it
   stays centred in the part of the card that is open (Tim, Oct 20), moving with the card's edge by half as much. On a
   wide card the drawing is beside the text, so it simply follows the middle of the open part (its top and bottom go past
   the card's edges, which cut them); on a tall card it is under the text, and it goes up only until its box reaches the
   bottom of the text: never over the title. Set by the script on each card's .card__art, px for px with the scroll.
   The pill: it does not wait: once a card has become the smallest card, it goes on up with the page at once and leaves the
   screen under the navbar, while the next card comes up to the top (Tim, Oct 20: no pinned pill, and no code for one).

   How it moves, so that it stays smooth on phones: the browser moves the cards itself, with the page, like any other
   block (see stack.css): nothing is moved by the script, so nothing can lag behind the page or shake. Even the sizes
   of the blocks the browser moves are written in the styles (from the tokens and the screen's height), so they follow
   a change of the window's size in the same frame. The script makes those blocks, measures the cards (for its own
   sums), and on scroll only decides what is shown: which title (with its own timed animation, by lines), whose turn it
   is among the drawings, the white label, the progress in the label, and which drawings can be put to sleep.
   The first card comes in once the hero has come in (it takes its turn in the hero's group of motion.js), fading in
   and rising a little, without a bounce.
   To try values in the console: fmCards.settings.step = 0.5, then fmCards.update(). ?fmcards=debug shows what the
   script measures (see debug.js). */
import { gsap, ScrollTrigger, SplitText, refreshSoon } from "./gsap.js";
import { paper } from "./scroller.js";
import { M, calm, tidy, cue } from "./motion.js";

const SET = {
  step: 0.7,             // scroll for one step of a card (a title and its drawing), in screen heights
  artAt: 0.5,            // a card shows its drawing once it is this tall (0…1 of its full height)
  artWake: 0.3,          // a card that leaves lets its drawing go below this height (0…1); one that comes is made ready at once
  // the titles: seconds and how far the lines travel (% of a line). Their way in is M.title of motion.js, which the
  // headings after the CTA share (data-reveal="title")
  title: { in: M.title.time, out: 0.3, stagger: M.title.stagger, rise: M.title.rise, lift: 12 },
  titleLead: 0.12,       // a title shows once the open part reaches this much (0…1 of the card's height) below it; it hides at half that
  enter: { time: 0.9, rise: 32 }                         // the first card's way in: seconds, px it rises (no bounce: fm-out)
};
const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const n2 = (v) => +(+v).toFixed(2);

export function initCards() {
  const section = document.querySelector("[data-stack]");
  const stage = section && section.querySelector(".stack__stage");
  if (!stage) return;
  const nav = document.querySelector("[data-nav]");
  const div = (cls) => { const n = document.createElement("div"); n.className = cls; n.setAttribute("aria-hidden", "true"); return n; };

  // ── the cards, and the blocks the browser moves (see stack.css) ──
  //   slot    one per card, around it: the card is sticky in it, so its height is how long the card stays (see stack.css)
  //   collar  above every card but the first: the gap over it and the rounded bottom corners of the card it covers;
  //           the last one (end) is at the bottom of the section, above the section after the stack
  //   veil    in every slot, drawn over its card: the card's bottom edge while it comes up (sticky at the bottom)
  //   cap     under every card but the first, sticky with it: the page colour around its top corners
  const cards = [...stage.querySelectorAll(".card")].map((el, i) => {
    const tag = el.querySelector(".card__tag");
    const titles = [...el.querySelectorAll(".card__title")].map((title) => ({ el: title, lines: [title], on: false, size: null }));
    const arts = [...el.querySelectorAll(".card__art > .art")];
    const c = { el, tag, titles, arts, artBox: el.querySelector(".card__art"), fit: null, shift: 0, steps: Math.max(1, titles.length, arts.length), m: {}, title: -1, turn: -1, off: null, asleep: null, white: null };
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
    c.slot.style.setProperty("--steps", c.steps);
    el.before(c.slot);
    c.slot.appendChild(el);
    if (i) c.slot.prepend(div("stack__collar"), div("stack__cap"));
    c.slot.appendChild(div("stack__veil"));                 // over its own card: it shapes the card's bottom edge
    return c;
  });
  if (!cards.length) return;
  stage.appendChild(div("stack__collar stack__collar-end"));
  section.classList.add("stack-on");
  // the colour of the page (the strips are painted in it); the section after the stack comes up over the last card,
  // which stays whole under it: it needs a background of its own, and must be drawn above the section of the cards
  const page = paper() || "#fff";
  section.style.setProperty("--stack-page", page);
  // every section after the stack, not only the next one: the last card stays whole under them while it gives room,
  // so a section shorter than a card (two royalty cards side by side, say) would let the card show below it
  for (let after = section.nextElementSibling; after; after = after.nextElementSibling) {
    const b = getComputedStyle(after).backgroundColor;
    if (!b || b === "transparent" || /rgba\(.*,\s*0\)$/.test(b)) after.style.backgroundColor = page;
    if (getComputedStyle(after).position === "static") after.style.position = "relative";
  }
  // the scroll of one step (stack.css uses it for the slots' heights)
  const setStep = () => section.style.setProperty("--stack-step", SET.step);
  setStep();

  // ── the titles: split into lines, which come and go one after another ──
  // a title's lines where they belong right now, without animation (after a split, and at the start)
  const settle = (title) => {
    title.size = null;                                       // measured again (see sizeOf)
    gsap.set(title.lines, { yPercent: 0, opacity: title.on ? 1 : 0 });
    title.el.classList.add("is-split");                     // shown (stack.css): as visible as its card, no more
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
      // gone: it comes from the side it is scrolled from
      if (!(gsap.getProperty(now.lines[0], "opacity") > 0.05)) gsap.set(now.lines, { yPercent: T.rise * dir });
      gsap.to(now.lines, {
        yPercent: 0, opacity: 1, duration: T.in * d, ease: "fm-out", stagger: T.stagger * d,
        delay: was ? T.out * 0.6 * d : 0, overwrite: true
      });
    }
  }

  // where the cards stick (--stack-nav in stack.css: under the navbar, or a gap under the top of the screen where the
  // navbar hides), as the styles have it
  // (read from a card's "top", which the browser gives in px)
  const navBottom = () => parseFloat(getComputedStyle(stage.querySelector(".card")).top) || 0;

  // ── measuring (whenever ScrollTrigger measures the page) ──
  let V = 0, gap = 0, navH = 0, padTop = 0, fontsDone = 0;
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
    gap = parseFloat(getComputedStyle(stage).paddingBottom) || 0;   // between two cards while they trade places
    padTop = parseFloat(getComputedStyle(stage).paddingTop) || 0;   // the first card comes up this far under the hero
    navH = navBottom();                                      // where the cards stick
    cards.forEach((c) => {
      const el = c.el, m = c.m;
      m.A = el.getBoundingClientRect().height;               // fractional px, as the styles lay them out (whole px would drift)
      m.R = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const at = offsetIn(c.tag, el);
      m.tagH = c.tag.getBoundingClientRect().height; m.padX = at.x; m.padY = at.y;
      // the smallest card: the label with the card's top padding above and below it, which is twice the radius (stack.css)
      m.ph = Math.min(m.R ? 2 * m.R : m.tagH + 2 * m.padY, m.A);
      c.titles.forEach((title) => { title.size = null; });
      c.fit = null;                                          // the drawing's room: measured again when it is needed (fitOf)
    });
    V = cards[0].m.A + navH + gap;                           // the screen (a card is the screen less those two)
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

  // The sizes of the slots, the strips and the section are in stack.css (they follow the screen by themselves). They
  // make the browser move every card exactly as state() below describes it (A: the height of a card, ph: its smallest):
  //   · a slot is P (where its card starts in it: 0 for the first, ph + gap for the others) + A (the card) + the scroll
  //     of its steps + A - ph: the card stays until only ph of it is left uncovered, then its slot ends and it goes on
  //     up with the page;
  //   · every slot but the first is pulled up by A: the next card comes up the gap under the old one's pill. The section
  //     after the stack is pulled up by A - ph under the last card.
  // The first time, the section has just taken its new height: everything on the page is measured again (once).
  let laid = false;
  function layOut() { if (!laid) { laid = true; refreshSoon(); } }

  // the drawing's room in its card, with the card open (layout offsets: the script's own shift does not count): wide, its
  // room beside the text (no limit going up), or tall, how far up it may go before its box reaches the text (≤ 0)
  function fitOf(c) {
    if (c.fit) return c.fit;
    const box = c.artBox, art = c.arts.find((a) => a.offsetHeight) || null;
    if (!box || !art) return null;                           // nothing laid out to measure (asleep)
    const wide = getComputedStyle(box).position === "absolute";
    const top = art.offsetTop - art.offsetHeight / 2;       // its box's top in the room (it is centred by a -50% translate)
    return (c.fit = { wide, up: wide ? -Infinity : Math.min(0, -top) });
  }
  // how far the drawing is moved from its place, for a card open h px of A: half what is closed, so it stays in the middle
  // of the open part, up to where the text begins on a tall card
  function shiftOf(c, h) {
    const f = h < c.m.A - 0.5 ? fitOf(c) : null;
    return f ? Math.max((h - c.m.A) / 2, f.up) : 0;
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
    let g, step = 0, fill = 0, white = false, phase = 0;   // phase: -1 coming, 0 filling the stage, 1 giving room
    if (p < c.from) {                                        // coming
      phase = -1;
      if (!prev) g = rising(c, V - Math.max(0, p));          // the first one comes up with the page
      else {                                                 // under the card that gives it room, the gap between them
        const d = Math.max(0, p - prev.to), P = ph + gap, go = A - ph;
        g = rising(c, d <= go ? A + gap - d : Math.max(0, P - (d - go)));
      }
    } else if (p <= c.to) {                                  // filling the stage: going through its steps
      g = shapeOf(c, 0, A, false);
      step = Math.min(c.steps - 1, Math.floor((p - c.from) / (SET.step * V)));
      fill = clamp((p - c.from) / (c.to - c.from));
    } else {                                                 // giving room to the next one (or to the section after the stack)
      phase = 1;
      const q = p - c.to, bottom = A - q;                    // then the smallest card is scrolled away
      step = c.steps - 1; fill = 1; white = true;
      g = shapeOf(c, -Math.max(0, q - (A - ph)), Math.max(ph, bottom), true);
    }
    return { g, step, fill, white, phase };
  }

  // ── on scroll: what is shown ──
  const flag = (c, key, cls, on, el) => { if (c[key] !== on) { c[key] = on; (el || c.el).classList.toggle(cls, on); } };
  let dir = 1, fills = new Map(), onDraw = null;
  // p = V when the first card has come up to where it sticks (its top padding above it: padTop)
  const target = () => V - section.getBoundingClientRect().top - (padTop - navH);
  function draw(p) {
    if (onDraw) onDraw(p);
    cards.forEach((c, i) => {
      const s = state(c, i, p), g = s.g, m = c.m;
      const fill = "inset(0 " + n2(100 - s.fill * 100) + "% 0 0)";
      if (fills.get(c) !== fill) { fills.set(c, fill); c.fill.style.clipPath = fill; }
      flag(c, "off", "is-off", !g.seen);                     // nothing of it is seen
      flag(c, "white", "is-done", s.white, c.tag);           // the colour change itself is a transition in stack.css
      // a title is shown once the open part of the card reaches SET.titleLead of the card's height below it (with the
      // card's padding under it), and hidden again when it is only half that: so a closing card hides its title before
      // its edge could cut through it, and a finger that wobbles near the point does not make the title come and go
      // (the two points are apart, whichever way the page goes)
      const now = c.titles[s.step];
      let fits = false;
      if (now && g.seen) {
        const b = sizeOf(c, now), lead = SET.titleLead * m.A * (c.title === s.step ? 0.5 : 1);
        fits = b.y + b.h + m.padY + lead <= g.h + 0.5;
      }
      showTitle(c, fits ? s.step : -1, dir);
      // the drawing whose turn it is (art/mount.js fades it in), at its own size, centred in its room (stack.css)
      const turn = g.seen && g.h >= SET.artAt * m.A ? s.step : -1;
      if (turn !== c.turn) { c.turn = turn; c.arts.forEach((art, k) => art.classList.toggle("fm-turn", k === turn)); }
      // …kept in the middle of the open part (see the top)
      const shift = turn < 0 ? c.shift : n2(shiftOf(c, g.h));
      if (shift !== c.shift && c.artBox) {
        c.shift = shift;
        c.artBox.style.translate = shift ? "0 " + shift + "px" : "";
        c.artBox.style.willChange = shift ? "translate" : "";
      }
      // not seen, or leaving and small: hidden, so its drawings let go of their memory
      flag(c, "asleep", "is-asleep", !g.seen || (g.leaving && g.h < SET.artWake * m.A));
    });
  }

  // measured with every card at its full size (nothing is drawn in between). The titles are split into lines again
  // when it is needed: the cards or their titles have another width (a title's width also depends on the card's
  // height: wide and tall cards lay out their text differently), or a font has arrived since the last split.
  let splitFor = "";
  function refresh() {
    section.classList.add("stack-instant");                  // no transitions while everything is put in place
    measure();
    const key = cards.map((c) => c.el.offsetWidth + ":" + c.titles[0].el.offsetWidth).join() + "/" + fontsDone;
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
  addEventListener("resize", () => { if (V) { measure(); draw(target()); } });   // at once, not only at the next measuring
  // the label and the titles are measured in the font that shows: once a font has arrived, measure again
  document.fonts.addEventListener("loadingdone", () => { fontsDone++; refresh(); });

  // the first card comes in after the hero (see the top): it waits, hidden, for its turn in the hero's group
  const hero = section.previousElementSibling, first = cards[0].slot;
  if (hero && !calm) {
    gsap.set(first, { opacity: 0 });
    cue(first, {
      group: hero,
      line: 0.999,                                         // as soon as any of it shows below the hero
      whenReady: (done) => done(),
      play(instant) {
        if (instant) gsap.set(first, { clearProps: "opacity,transform" });
        else gsap.fromTo(first, { opacity: 0, y: SET.enter.rise }, { opacity: 1, y: 0, duration: SET.enter.time, ease: "fm-out", clearProps: "opacity,transform" });
      }
    });
  }

  window.fmCards = { settings: SET, cards, update() { setStep(); ScrollTrigger.refresh(); } };
  if (/[?&]fmcards=debug\b/.test(location.search)) {
    import("./debug.js").then((m) => { onDraw = m.cardsDebug({ cards, stage, section, nav, state, navBottom, get V() { return V; } }); });
  }
}

/* The ID cards of «Гибкая настройка прав доступа» as a deck, where the room is too narrow for a row (sections.css:
   a column below 35rem, 560px: phones held upright). The cards lie one on top of the other, whole and at their own size; the
   one on top is read, the two under it show their edges (and show through its slot).

     · swipe the top card to either side (or flick it: a short quick move counts too) and it follows the finger, goes
       off to that side, then slides back in at the bottom of the deck; the next card is on top. Both ways work the
       same, mirrored. A swipe that is not far or fast enough springs back;
     · the page still scrolls up and down under a finger: a move that starts more up-and-down than sideways is the
       page's (touch-action: pan-y in the styles), one that starts sideways is the deck's;
     · with the keyboard (the deck takes the focus): the right arrow sends the top card off to the left, the left arrow
       brings the bottom card back on top from the left;
     · the first time the deck comes on screen, the top card nudges to the left and back once, to show it can be swiped.
   Where the cards stand in a row again (a wider screen, a phone turned), the deck lets go of them.
   How deep each card lies is --d on its slot (0 on top, 1, 2), and which one is in front --z. Where a depth lies, how it
   is turned and how big it is are in the styles (--deck-x, --deck-y, --deck-turn, --deck-shrink: the top card straight,
   each one under it 4° further round); this script moves each slot there by its transform alone (GSAP x, y, rotation,
   scale; a swipe adds to them), so the graphics chip moves the cards without painting them again (CSS variables changed
   on every frame repainted each card, its shadow and its masked face: not smooth on an iPhone). */
import { gsap, CustomEase } from "./gsap.js";
import { calm, settleTilts } from "./motion.js";

const SET = {
  far: 0.28,        // a swipe this far (a share of the card's width) changes the card
  flick: 0.3,       // or this fast at the end (px per ms; about what phones themselves count as a flick)
  lean: 0.045,      // degrees the card turns per px it is pulled
  out: 0.3,         // seconds to leave
  back: 0.5,        // seconds to settle into its new place
  move: 0.45        // seconds the other cards take to move to their new places (place, turn and size: their depth)
};

export function initDeck() {
  const stage = document.querySelector("[data-deck]");
  if (!stage) return;
  const slots = [...stage.querySelectorAll(".access__slot")];
  if (slots.length < 2) return;
  const order = slots.map((_, i) => i);                     // order[0]: the card on top
  let on = false, busy = Promise.resolve(), touched = false;
  let flight = null;                                        // the card change under way (a GSAP tween), if any

  const width = () => slots[order[0]].offsetWidth || 270;
  // where a depth lies, how turned and how big (from the styles, read each time: they are the one place for them)
  const pose = (d) => {
    const cs = getComputedStyle(stage), v = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
    return { x: d * v("--deck-x"), y: d * v("--deck-y"), rotation: d * v("--deck-turn"), scale: 1 - d * v("--deck-shrink"), force3D: true };
  };
  // each card's depth: which one is in front (--z) changes at once; the card moves to its depth's place (but the one
  // given in skip, which the swipe moves itself)
  const paint = (move = true, skip = null) => order.forEach((slot, d) => {
    const s = slots[slot];
    s.style.setProperty("--d", d);
    s.style.setProperty("--z", d);
    if (s === skip) return;
    if (move && !calm) gsap.to(s, Object.assign({ duration: SET.move, ease: "fm-out", overwrite: "auto" }, pose(d)));
    else { gsap.killTweensOf(s); gsap.set(s, pose(d)); }
  });
  // the swipe moves the top card from its place (depth 0: x 0, turned 0)
  const at = (x, turn) => ({ x, rotation: turn, force3D: true });
  const xOf = (slot) => +gsap.getProperty(slot, "x") || 0;
  const home = () => pose(0);

  // one card changes: the top one leaves (way 1) to the left (side -1) or the right (side 1); or the bottom one comes in
  // from the left (way -1). speed: how fast the finger was moving when it let go (px per ms, 0 for the keyboard): the
  // card leaves at that speed, as a thrown card does, instead of stopping under the finger and setting off again.
  function step(way, side = -1, speed = 0) {
    busy = busy.then(() => new Promise((done) => {
      const k = 1, goneX = side * width() * 1.15, gone = at(goneX, side * 12);
      if (calm) {
        if (way > 0) order.push(order.shift()); else order.unshift(order.pop());
        paint(false); done(); return;
      }
      // a tween that is killed (the visitor grabbed the deck again) ends the change as if it had played out, so the
      // queue never waits for it forever
      let ended = false;
      const end = (fn) => () => { if (ended) return; ended = true; flight = null; fn(); done(); };
      if (way > 0) {
        const top = slots[order[0]];
        const D = Math.max(1, Math.abs(goneX - xOf(top)));
        let ms = SET.out * 1000 * k, ease = "power2.in";
        if (speed > 0) {
          if (2 * D / speed <= ms) { ms = Math.max(120, 2 * D / speed); ease = "power1.out"; }
          else ease = CustomEase.create("deckOut", "M0,0 C0.3," + (0.3 * Math.min(2, speed * ms / D)).toFixed(4) + " 0.7,1 1,1");
        }
        const landed = end(() => {
          order.push(order.shift()); paint(true, top);     // now at the bottom (its z-index drops at once): it slides back under
          gsap.to(top, Object.assign({ duration: SET.back * k, ease: "fm-out" }, pose(order.length - 1)));
        });
        flight = gsap.to(top, Object.assign({ duration: ms / 1000, ease, overwrite: true, onComplete: landed, onInterrupt: landed }, gone));
      } else {
        const top = slots[order[order.length - 1]];
        order.unshift(order.pop()); paint(true, top);      // the bottom card is on top now, still off to the left
        const landed = end(() => {});
        flight = gsap.fromTo(top, Object.assign({ y: 0, scale: 1 }, gone), Object.assign({ duration: SET.back * k, ease: "fm-out", overwrite: true, onComplete: landed, onInterrupt: landed }, home()));
      }
    }));
    return busy;
  }

  // ── the finger ──
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    if (!on || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (flight) flight.progress(1);                          // a card still on its way: put it where it was going, so the finger takes the new top card
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, side: null, track: [[e.timeStamp, e.clientX]], top: slots[order[0]] };
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.side === null) {                                // the first few px decide whose move it is
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.side = Math.abs(dx) > Math.abs(dy);
      if (!drag.side) { drag = null; return; }               // up and down: the page scrolls
      touched = true;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("is-dragging");
      gsap.killTweensOf(drag.top);
    }
    drag.dx = dx;
    drag.track.push([e.timeStamp, e.clientX]);
    if (drag.track.length > 6) drag.track.shift();
    gsap.set(drag.top, at(dx, dx * SET.lean));
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    stage.classList.remove("is-dragging");
    if (!d.side) return;
    const [t0, x0] = d.track[0], v = (e.clientX - x0) / Math.max(1, e.timeStamp - t0);   // px per ms, over the last moves
    const w = width();
    if (d.dx < -w * SET.far || v < -SET.flick) step(1, -1, Math.max(0, -v));
    else if (d.dx > w * SET.far || v > SET.flick) step(1, 1, Math.max(0, v));
    else gsap.to(d.top, Object.assign({ duration: 0.5, ease: "fm-settle" }, home()));
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("keydown", (e) => {
    if (!on) return;
    if (e.key === "ArrowRight") { e.preventDefault(); touched = true; step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); touched = true; step(-1); }
  });

  // ── a deck only where the styles say so (--deck: 1, a narrow column) ──
  function check() {
    const deck = getComputedStyle(stage).getPropertyValue("--deck").trim() === "1";
    if (deck === on) return;
    on = deck;
    stage.classList.toggle("is-deck", on);
    if (on) { stage.tabIndex = 0; paint(false); }
    else {
      stage.removeAttribute("tabindex");
      slots.forEach((s) => { gsap.killTweensOf(s); gsap.set(s, { clearProps: "transform" }); ["--d", "--z"].forEach((v) => s.style.removeProperty(v)); });
    }
    settleTilts();                                          // the cards already there: straight in a slot, or their own angle in a row
  }
  new ResizeObserver(check).observe(stage);
  check();

  // ── the nudge: once, when the deck is first well on screen and its cards have landed ──
  if (!calm) {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      io.disconnect();
      setTimeout(() => {
        if (!on || touched) return;
        const top = slots[order[0]];
        gsap.timeline()
          .to(top, Object.assign({ duration: 0.45, ease: "power2.inOut" }, at(-width() * 0.16, -3)))
          .to(top, Object.assign({ duration: 0.6, ease: "fm-settle" }, home()));
      }, 1900);
    }, { threshold: 0.7 });
    io.observe(stage);
  }

  window.fmDeck = { settings: SET, next: () => step(1), back: () => step(-1), get order() { return order.slice(); } };
}

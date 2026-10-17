/* The ID cards of «Гибкая настройка прав доступа» as a deck, where the room is too narrow for a row (sections.css:
   a column below 728px: every phone, and tablets up to 768px held upright). The cards lie one on top of the other, whole and at
   their own size; the one on top is read, the two under it show their edges.

     · swipe the top card to the left (or flick it: a short quick move counts too) and it goes off to the left, then
       slides back in at the bottom of the deck; the next card is on top. Swipe to the right and the card at the bottom
       comes in from the left, back on top. A swipe that is not far or fast enough springs back;
     · the page still scrolls up and down under a finger: a move that starts more up-and-down than sideways is the
       page's (touch-action: pan-y in the styles), one that starts sideways is the deck's;
     · the dots under the deck say which card is on top, and a tap on one brings that card up; the arrow keys do the
       same when the deck has the keyboard's focus;
     · the first time the deck comes on screen, the top card nudges to the left and back once, to show it can be swiped.
   Where the cards stand in a row again (a wider screen, a phone turned), the deck lets go of them.
   How deep each card lies is --d on its slot (0 on top); the styles place and size it by that, with a transition. */
import { gsap } from "./gsap.js";
import { calm } from "./motion.js";

const SET = {
  far: 0.28,        // a swipe this far (a share of the card's width) changes the card
  flick: 0.3,       // or this fast at the end (px per ms; about what phones themselves count as a flick)
  lean: 0.045,      // degrees the card turns per px it is pulled
  out: 0.3,         // seconds to leave
  back: 0.5         // seconds to settle into its new place
};

export function initDeck() {
  const stage = document.querySelector("[data-deck]");
  const dotsBox = document.querySelector("[data-deck-dots]");
  if (!stage) return;
  const slots = [...stage.querySelectorAll(".access__slot")];
  if (slots.length < 2) return;
  const order = slots.map((_, i) => i);                     // order[0]: the card on top
  let on = false, busy = Promise.resolve(), touched = false;

  const dots = slots.map((slot, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "access__dot";
    const name = slot.querySelector(".idcard__name");
    b.setAttribute("aria-label", "Показать карточку: " + (name ? name.textContent.replace(/\s+/g, " ").trim() : i + 1));
    b.addEventListener("click", () => { touched = true; bringUp(i); });
    if (dotsBox) dotsBox.appendChild(b);
    return b;
  });

  const width = () => slots[order[0]].offsetWidth || 270;
  function paint() {
    order.forEach((slot, d) => slots[slot].style.setProperty("--d", d));
    dots.forEach((b, i) => b.setAttribute("aria-current", String(order[0] === i)));
  }

  // one card changes: the top one leaves to the left (way 1) or the bottom one comes in from the left (way -1)
  function step(way, quick) {
    busy = busy.then(() => new Promise((done) => {
      const k = quick ? 0.55 : 1, gone = { x: -width() * 1.15, rotation: -12 };
      if (calm) {
        if (way > 0) order.push(order.shift()); else order.unshift(order.pop());
        paint(); slots.forEach((s) => gsap.set(s, { x: 0, rotation: 0 })); done(); return;
      }
      if (way > 0) {
        const top = slots[order[0]];
        gsap.to(top, Object.assign({ duration: SET.out * k, ease: "power2.in", overwrite: true, onComplete() {
          order.push(order.shift()); paint();                // now at the bottom (its z-index drops at once): it slides back under
          gsap.to(top, { x: 0, rotation: 0, duration: SET.back * k, ease: "fm-out" });
          done();
        } }, gone));
      } else {
        order.unshift(order.pop()); paint();                 // the bottom card is on top now, still off to the left
        const top = slots[order[0]];
        gsap.fromTo(top, gone, { x: 0, rotation: 0, duration: SET.back * k, ease: "fm-out", overwrite: true, onComplete: done });
      }
    }));
    return busy;
  }
  function bringUp(i) {
    const n = (order.indexOf(i) + slots.length) % slots.length;
    for (let s = 0; s < n; s++) step(1, n > 1);
  }

  // ── the finger ──
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    if (!on || (e.pointerType === "mouse" && e.button !== 0)) return;
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
    gsap.set(drag.top, { x: dx, rotation: dx * SET.lean });
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    stage.classList.remove("is-dragging");
    if (!d.side) return;
    const [t0, x0] = d.track[0], v = (e.clientX - x0) / Math.max(1, e.timeStamp - t0);   // px per ms, over the last moves
    const w = width();
    if (d.dx < -w * SET.far || v < -SET.flick) step(1);
    else if (d.dx > w * SET.far || v > SET.flick) {
      gsap.to(d.top, { x: 0, rotation: 0, duration: 0.25, ease: "fm-out" });
      step(-1);
    } else gsap.to(d.top, { x: 0, rotation: 0, duration: 0.5, ease: "fm-settle" });
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
    if (dotsBox) dotsBox.hidden = !on;
    if (on) { stage.tabIndex = 0; paint(); }
    else {
      stage.removeAttribute("tabindex");
      slots.forEach((s) => { s.style.removeProperty("--d"); gsap.set(s, { clearProps: "transform" }); });
    }
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
          .to(top, { x: -width() * 0.16, rotation: -3, duration: 0.45, ease: "power2.inOut" })
          .to(top, { x: 0, rotation: 0, duration: 0.6, ease: "fm-settle" });
      }, 1900);
    }, { threshold: 0.7 });
    io.observe(stage);
  }

  window.fmDeck = { settings: SET, next: () => step(1), back: () => step(-1), get order() { return order.slice(); } };
}

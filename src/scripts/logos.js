/* The clients: when the section is centred on screen it is pinned, and the strip of logos slides from left-aligned to
   right-aligned as the page scrolls (1px of scroll = 1px of movement, with a little smoothing; none with "reduce
   motion"). Measured again on every resize, before everything else (it adds height to the page).
   A tap on a logo shows its name (as hovering does with a mouse); another tap, or a tap elsewhere, hides it.
   In the page's own box (Safari on a Mac, scroller.js) the section is held by the browser itself (position: sticky in
   a spacer as tall as the section and the strip's way), not by GSAP: GSAP can only move it against the scroll there,
   a frame behind Safari's scrolling, and the block shook up and down. The strip's slide is the same in both. */
import { gsap, ScrollTrigger } from "./gsap.js";
import { calm } from "./motion.js";
import { box } from "./scroller.js";

export function initLogos() {
  const frame = document.querySelector("[data-logos]");
  const track = frame && frame.querySelector(".logos__track");
  if (!track) return;
  const named = (card) => track.querySelectorAll(".logo-card.is-named").forEach((c) => { if (c !== card) c.classList.remove("is-named"); });
  track.addEventListener("click", (e) => {
    const card = e.target.closest(".logo-card");
    named(card);
    if (card) card.classList.toggle("is-named");
  });
  document.addEventListener("click", (e) => { if (!track.contains(e.target)) named(null); });
  // how far the strip slides: as far as it is wider than its window (on a short, wide screen it can fit whole: then
  // it stands still, centred by the styles, and the section is not pinned)
  const distance = () => Math.min(0, frame.clientWidth - track.offsetWidth);
  const section = frame.closest("section");
  if (box) { stick(section, track, distance); return; }
  gsap.to(track, {
    x: distance,
    ease: "none",
    scrollTrigger: {
      trigger: frame.closest("section"),
      start: "center center",
      end: () => "+=" + Math.abs(distance()),
      pin: true,
      scrub: calm ? true : 0.6,             // with "reduce motion": exactly with the scroll, no glide after it
      invalidateOnRefresh: true,
      refreshPriority: 1
    }
  });
}

// the box: the section sticks in the middle of the screen (where GSAP's pin would hold it: its centre at the screen's
// centre) for as long as the strip slides, inside a spacer that gives it that much room. The spacer is called
// "pin-spacer" like GSAP's, so the rest of the page (scroll.js, anchor.js, boot.js) treats it the same way.
function stick(section, track, distance) {
  const spacer = document.createElement("div");
  spacer.className = "pin-spacer";
  section.before(spacer);
  spacer.append(section);
  section.style.position = "sticky";
  const top = () => (innerHeight - section.getBoundingClientRect().height) / 2;   // unrounded, as GSAP holds it
  const layout = () => {
    section.style.top = top() + "px";
    spacer.style.height = section.offsetHeight + Math.abs(distance()) + "px";          // whole px, as GSAP's spacer
  };
  layout();
  ScrollTrigger.addEventListener("refreshInit", layout);     // before every measuring: the screen or the tiles changed
  const tween = gsap.to(track, {
    x: distance,
    ease: "none",
    scrollTrigger: {
      trigger: spacer,
      start: () => "top " + top() + "px",                    // the moment the section starts to stick
      end: () => "+=" + Math.abs(distance()),
      scrub: calm ? true : 0.6,
      invalidateOnRefresh: true,
      refreshPriority: 1
    }
  });
  section.fmPin = tween.scrollTrigger;                       // where its holding starts (scroll.js lands there)
}

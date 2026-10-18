/* The clients: when the section is centred on screen it is pinned, and the strip of logos slides from left-aligned to
   right-aligned as the page scrolls (1px of scroll = 1px of movement, with a little smoothing; none with "reduce
   motion"). Measured again on every resize, before everything else (it adds height to the page).
   A tap on a logo shows its name (as hovering does with a mouse); another tap, or a tap elsewhere, hides it. */
import { gsap } from "./gsap.js";
import { calm } from "./motion.js";

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

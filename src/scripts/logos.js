/* The clients: when the section is centred on screen it is pinned, and the strip of logos slides from left-aligned to
   right-aligned as the page scrolls (1px of scroll = 1px of movement, with a little smoothing). Measured again on every
   resize, before everything else (it adds height to the page). */
import { gsap } from "./gsap.js";

export function initLogos() {
  const frame = document.querySelector("[data-logos]");
  const track = frame && frame.querySelector(".logos__track");
  if (!track) return;
  const distance = () => frame.clientWidth - track.offsetWidth;
  gsap.to(track, {
    x: distance,
    ease: "none",
    scrollTrigger: {
      trigger: frame.closest("section"),
      start: "center center",
      end: () => "+=" + Math.abs(distance()),
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      refreshPriority: 1
    }
  });
}

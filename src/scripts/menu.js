/* The menu of phones and tablets (below 1024px, where the styles show the burger): the burger turns into a cross, and
   the pills of the menu pop in from its corner one after another, lower ones starting smaller. Closing is a little
   faster than opening. It closes after a tap on a link, a tap outside it, or Escape; and at once if the screen grows
   so wide that the burger is gone (the width lives in the styles only: media.css). */
import { gsap, CustomEase } from "./gsap.js";
import { calm } from "./motion.js";

export function initMenu() {
  const btn = document.querySelector("[data-menu-button]");
  const menu = document.querySelector("[data-menu]");
  if (!btn || !menu) return;

  const items = gsap.utils.toArray(menu.children);
  const [barTop, barBottom] = btn.children;          // the two lines of the burger
  let isOpen = false;

  gsap.set(items, { transformOrigin: "100% 0%" });
  CustomEase.create("menuIn", "0.42, 0, 1, 1");
  CustomEase.create("menuOut", "0, 0, 0.58, 1");

  // How far each line moves to meet the other in the middle: half the distance between their centres, measured from
  // the layout (lines 1px tall with a 5px gap are 6px apart, so each moves 3px; 3 while the button cannot be measured).
  const meet = () => {
    const centre = (bar) => bar.offsetTop + bar.offsetHeight / 2;
    const half = (centre(barBottom) - centre(barTop)) / 2;
    return half > 0 ? half : 3;
  };

  const tl = gsap.timeline({ paused: true, onReverseComplete: () => menu.classList.remove("is-open") });
  tl
    // burger → cross: the lines meet in the middle, then turn
    .to(barTop, { y: () => meet(), duration: 0.12, ease: "menuIn" }, 0)
    .to(barBottom, { y: () => -meet(), duration: 0.12, ease: "menuIn" }, 0)
    .to(barTop, { rotation: 45, scaleX: 1.15, duration: 0.12, ease: "menuOut" }, 0.12)
    .to(barBottom, { rotation: -45, scaleX: 1.15, duration: 0.12, ease: "menuOut" }, 0.12)
    // the pills pop in one after another; lower ones start smaller
    .fromTo(items,
      { opacity: 0, y: -12, scale: (i) => Math.max(0.2, 0.8 - i * 0.2) },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "fm-settle", stagger: 0.06 },
      0.05);

  function openMenu() {
    isOpen = true;
    menu.classList.add("is-open");
    if (tl.progress() === 0) tl.invalidate();      // fully closed: measure the lines again (the screen may have changed)
    if (calm) tl.progress(1); else tl.timeScale(1).play();
    btn.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    isOpen = false;
    if (calm) { tl.progress(0); menu.classList.remove("is-open"); } else tl.timeScale(1.6).reverse();
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", () => (isOpen ? closeMenu() : openMenu()));
  items.forEach((item) => item.addEventListener("click", () => { if (isOpen) closeMenu(); }));
  document.addEventListener("click", (e) => { if (isOpen && !menu.contains(e.target) && !btn.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen) { closeMenu(); btn.focus(); } });
  addEventListener("resize", () => {
    if (isOpen && getComputedStyle(btn).display === "none") {
      isOpen = false;
      tl.pause(0);
      menu.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

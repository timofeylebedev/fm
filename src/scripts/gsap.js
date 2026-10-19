/* GSAP and the three plugins the site uses, registered once. Every script takes them from here. */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { box } from "./scroller.js";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

// Safari on a Mac: the page scrolls in its own box (scroller.js), so every ScrollTrigger watches the box. A pinned block
// (the logos) is held in place by moving it against the scroll, GSAP's way for a box ("transform"): fixed to the screen
// instead, the wheel and the trackpad over it would go to the window, which does not scroll, and the page would stick.
if (box) ScrollTrigger.defaults({ scroller: box });

// Several parts of the page ask for the page to be measured again at about the same moment (a block got its height):
// the requests of one frame are made into one measuring of everything, which is the expensive part.
let asked = 0;
export function refreshSoon() {
  if (asked) return;
  asked = requestAnimationFrame(() => { asked = 0; ScrollTrigger.refresh(); });
}

export { gsap, ScrollTrigger, SplitText, CustomEase };

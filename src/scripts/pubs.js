/* The publications: at most PUBS.first cards are shown. With more of them, the button «Показать больше»
   under the cards shows the next PUBS.more each time; the cards come in as blocks do (motion.js arrive), and the button
   goes away when none are left. The focus goes to the first card that came, so the keyboard carries on from there.
   Without scripts every card is shown and the button stays hidden (hidden in the HTML).
   Runs before the motion (main.js): the hidden cards are left out of the way in, as anything not on the page is. */
import { arrive } from "./motion.js";
import { refreshSoon } from "./gsap.js";

const PUBS = { first: 2, more: 4 };

export function initPubs() {
  const grid = document.querySelector("[data-pubs]");
  const button = document.querySelector("[data-pubs-more]");
  if (!grid || !button) return;
  const cards = [...grid.children];
  if (cards.length <= PUBS.first) return;
  cards.slice(PUBS.first).forEach((card) => { card.hidden = true; });
  button.hidden = false;
  button.addEventListener("click", () => {
    const next = cards.filter((card) => card.hidden).slice(0, PUBS.more);
    next.forEach((card) => { card.hidden = false; });
    if (!cards.some((card) => card.hidden)) button.hidden = true;
    arrive(next);
    const first = next[0] && (next[0].matches("a[href]") ? next[0] : next[0].querySelector("a[href]"));
    if (first) first.focus({ preventScroll: true });
    refreshSoon();                                       // the page is longer: what is measured by the scroll, again
  });
}

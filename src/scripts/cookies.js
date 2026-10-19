/* The cookie notice: loaded by main.js only for a visitor who has not pressed «ОК» yet (consent.js), once the page has
   loaded and its first screen has come in. Looks: styles/components/cookies.css (Figma: section "cookies").

   What it does:
     · DELAY ms after it is loaded it fades in from 0 (FADE_IN ms): not during the entrance of the first screen, which
       is what the visitor should see first;
     · its colour follows the section behind it, as the navbar's does (tint.js), for as long as it is on the screen;
     · «ОК»: consent is given (consent.js), the text and the «ОК» fade out (TEXT_OUT ms), the checkmark is drawn
       (DRAW ms, starting DRAW_AT ms after the press), stays a moment (HOLD ms), and the notice fades out (FADE_OUT ms)
       and is removed;
     · an «ОК» pressed in another tab: here it simply fades out;
     · while it is shown, the page keeps its height clear above the bottom of the screen (scroll-padding-bottom), so a
       link reached with the Tab key is never scrolled to under the notice (WCAG 2.4.11);
     · reduce motion: the checkmark is not drawn but shown, and every fade is quick (at most 250 ms).
   Tuning in the console: fmCookies (the timings, in ms; replay() puts the notice back on the page for a look). */
import "../styles/components/cookies.css";
import { grant, hasConsent } from "./consent.js";
import { followTint } from "./tint.js";

const T = {
  DELAY: 1200, FADE_IN: 700,
  TEXT_OUT: 250, DRAW_AT: 150, DRAW: 450, HOLD: 550, FADE_OUT: 400,
};
const OUT = "cubic-bezier(0.22, 1, 0.36, 1)";        // --ease-out of tokens.css
const DRAW_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";  // a hand drawing a line: sets off, then slows to a stop
const calm = matchMedia("(prefers-reduced-motion: reduce)");

let box = null, said = null;
const calmFade = (ms) => (calm.matches ? Math.min(ms, 250) : ms);

// force: shown even to a visitor who has agreed (fmCookies.replay(), for a look; the answer is kept as it was)
export function showCookies({ delay = T.DELAY, force = false } = {}) {
  const tpl = document.getElementById("cookies");
  if (!tpl || box || (!force && hasConsent())) return;
  setTimeout(() => {
    if (box || (!force && hasConsent())) return;
    box = tpl.content.firstElementChild.cloneNode(true);
    document.body.append(box);
    // what a screen reader hears after «ОК»: a status line of the page, not of the card, so it is still there when the
    // card has gone and the focus has moved (a line removed with its card may never be read out)
    if (!said) { said = box.querySelector(".cookies__said"); document.body.append(said); }
    else box.querySelector(".cookies__said")?.remove();
    said.textContent = "";
    const tint = followTint(box, 0.8);
    const root = document.documentElement;
    const clear = () => { root.style.scrollPaddingBottom = box ? (innerHeight - box.getBoundingClientRect().top + 8) + "px" : ""; };
    clear();
    addEventListener("resize", clear);
    box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: calmFade(T.FADE_IN), easing: OUT, fill: "forwards" });

    const ok = box.querySelector(".cookies__ok");
    const text = box.querySelector(".cookies__text");
    const label = box.querySelector(".cookies__label");
    const check = box.querySelector(".cookies__check path");

    let leaving = false;
    const leave = async (drawn) => {
      if (leaving) return;
      leaving = true;
      const el = box;
      el.style.pointerEvents = "none";
      if (drawn) {
        said.textContent = "Готово, спасибо";
        const quick = calm.matches;
        const fade = { duration: quick ? 150 : T.TEXT_OUT, easing: OUT, fill: "forwards" };
        text.animate([{ opacity: 1 }, { opacity: 0 }], fade);
        label.animate([{ opacity: 1 }, { opacity: 0 }], fade);
        await check.animate(quick
          ? [{ strokeDashoffset: 0, opacity: 0 }, { strokeDashoffset: 0, opacity: 1 }]
          : [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
          { duration: quick ? 150 : T.DRAW, delay: quick ? 0 : T.DRAW_AT, easing: quick ? OUT : DRAW_EASE, fill: "forwards" }).finished;
        await new Promise((r) => setTimeout(r, T.HOLD));
      }
      const current = Number(getComputedStyle(el).opacity);
      await el.animate([{ opacity: current }, { opacity: 0 }], { duration: calmFade(T.FADE_OUT), easing: OUT, fill: "forwards" }).finished;
      tint.stop();
      removeEventListener("resize", clear);
      document.removeEventListener("fm:consent", elsewhere);
      // the focus still on «ОК» (not moved on by the visitor meanwhile): it goes to the content, see below
      const hadFocus = el.contains(document.activeElement);
      el.remove();
      box = null;
      clear();
      // the focus was on «ОК»: it goes to the content (the Tab key goes on from its top), without scrolling
      const main = hadFocus && document.getElementById("main");
      if (main) {
        if (!main.hasAttribute("tabindex")) {
          main.setAttribute("tabindex", "-1");
          main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
        }
        main.focus({ preventScroll: true });
      }
    };
    // consent given by anything but this card's «ОК» (another tab, fmConsent.grant()): the card just fades out
    const elsewhere = () => leave(false);
    document.addEventListener("fm:consent", elsewhere);
    // leave() first: it marks the card as leaving at once, so the fm:consent that grant() sends does not end it plainly
    ok.addEventListener("click", () => { if (leaving) return; leave(true); if (!force || !hasConsent()) grant(); });
  }, delay);
}

window.fmCookies = Object.assign(T, { replay: () => showCookies({ delay: 0, force: true }) });

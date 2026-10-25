/* Runs fn once the page has loaded: at once if it already has. A script that starts late (main.js lets the browser
   draw a frame first) may come after the page's load event, and a plain addEventListener("load", fn) would then never
   run (the independent review of Oct 25 found four). */
export function whenLoaded(fn) {
  if (document.readyState === "complete") fn();
  else addEventListener("load", fn, { once: true });
}

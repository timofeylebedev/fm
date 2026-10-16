/* The two royalty drawings: one sum split into three shares (royalty-1) and four reports, one from each platform
   (royalty-2). They build themselves up once, when their card has come in, and then stay as they are.
   The settings of that build-up are in royalty-settings.js. See art/mount.js for how a drawing is put on the page. */
import { gsap, CustomEase } from "../gsap.js";
import { at, pic, unit, TAU, clamp01, STILL } from "./shared.js";
import { ROYALTY } from "./royalty-settings.js";

// Reads the text of an ease the way it may have been pasted: the whole CustomEase.create("name", "M0,0 C…") line from the
// ease visualizer, with or without "ease:" in front and a comma behind, a cubic-bezier(…) from CSS, or a name in quotes.
// What is left is a name ("power3.out") or a curve ("M0,0 C…", or four numbers).
export function easeText(text) {
  let t = String(text == null ? "" : text).trim();
  const made = t.match(/CustomEase\s*\.\s*create\s*\(\s*(?:(["'`])[^"'`]*\1\s*,\s*)?(["'`])([^"'`]*)\2/);
  if (made) return made[3].trim();
  t = t.replace(/^ease\s*:\s*/, "").replace(/[,;]\s*$/, "").trim().replace(/^(["'`])([\s\S]*)\1$/, "$2").trim();
  const css = t.match(/^cubic-bezier\s*\(([^)]*)\)$/);
  return css ? css[1].trim() : t;
}
const isCurve = (text) => /^(M|-?[\d.]+\s*,)/.test(text);
// Turns the text of an ease into the function that does it. If the text is not an ease, a plain slowing-down is used
// instead, so the drawings still build up. (fmRoyalty.checkEase tells which of the two happened.)
export const plainEase = (t) => 1 - Math.pow(1 - t, 3);
const made = {};                                           // the curves that have been made already, by their text
export function easing(text) {
  const named = easeText(text);
  const t = Object.prototype.hasOwnProperty.call(ROYALTY.curves, named) ? easeText(ROYALTY.curves[named]) : named;   // one of your own curves, by its name
  try {
    if (isCurve(t)) {                                      // a CustomEase curve
      if (made[t]) return made[t];
      const curve = CustomEase.create("fmCurve" + Object.keys(made).length, t);
      return typeof curve === "function" && isFinite(curve(0.5)) ? (made[t] = curve) : plainEase;
    }
    return gsap.parseEase(t) || plainEase;
  } catch { return plainEase; }
}

export default {
  // Royalty · 1 — one sum split into three shares
  "royalty-1"() {
    const FRAME = 506;                                   // this drawing's Figma frame is 506×506 (the card at its full size), not 1000×1000
    const BOX = [117, 40, 272];                          // the square the ring is drawn in: left, top, side
    const CX = 253, CY = 176;                            // centre of the ring
    const LINE = 40, R = 116;                            // width of the ring's line, and the radius of its middle
    const SUM = 865947;                                  // the sum in the middle, in roubles
    // The shares, in the order they lie on the ring: clockwise from the top. (That is also their order as layers, bottom first.)
    //   part:    the share in percent. It is used for both things: the number in the label, and the length of its piece of
    //            the ring (30 = 30% of the circle), so the two can never disagree. The three add up to 100.
    //   turn:    its turn in the animation: 0 appears first, then 1, then 2. Its label follows it.
    //   name:    the text of its label; numberFirst: is the number in front of the name?
    //   place:   where the label is fixed ("left:…" or "right:…", then "top:…")
    //   middle:  the middle of the label in Figma (the animation turns the label around the ring's centre from there)
    const SHARES = [
      { part: 30, turn: 1, name: "Артист 2", numberFirst: true,  place: "right:40px;top:60.668px", middle: [382.5, 85.7] },
      { part: 25, turn: 2, name: "Лейбл",    numberFirst: true,  place: "right:70px;top:262px",    middle: [364, 287] },
      { part: 45, turn: 0, name: "Артист 1", numberFirst: false, place: "left:51px;top:89px",      middle: [134.5, 114] }
    ];
    if (!CanvasRenderingContext2D.prototype.createConicGradient)
      throw new Error("this browser cannot paint a gradient that goes round a circle");   // a very old browser: the PNG stays

    // Places on the ring are parts of the full circle: 0 is the top, 0.25 the right, 0.5 the bottom, and so on clockwise.
    // A share is a piece of the ring with round ends, from the end of the share behind it (from) to its own end (to).
    // It is white at its own end. Towards its start the white fades, and it is gone completely a little before the white
    // end of the share behind it is reached (how far before: "clear" in the settings). The round end of that share
    // reaches CAP into this one.
    const CAP = Math.asin(LINE / 2 / R) / TAU;
    let reached = 0;
    SHARES.forEach((share) => { share.from = reached / 100; share.to = (reached += share.part) / 100; });

    const S = ROYALTY;                                   // the settings of the animation: see the top of this part of the file
    const angle = (place) => place * TAU - Math.PI / 2;  // a place on the ring as an angle for the canvas
    let ease = {}, labelTime = 0, end = 1;               // the eases as functions, how long a label takes, and when the last part has arrived
    let canvas = null, ctx = null, labels = [], sum = null, sumText = "";
    function setup() {
      ease = { share: easing(S.shareEase), shareFade: easing(S.shareFadeEase), label: easing(S.labelEase), labelFade: easing(S.labelFadeEase), sum: easing(S.sumEase) };
      labelTime = Math.max(0.02, 1 - S.shareGap * (SHARES.length - 1) - S.labelAfter);
      end = Math.max(1, S.shareGap * (SHARES.length - 1) + Math.max(S.shareTime, S.labelAfter + labelTime));
    }

    // Draws the moment `now` of the animation: 0 = nothing is there yet, 1 = the time is over (at `end`, which is 1 or a
    // little later, everything has arrived).
    function pose(now) {
      if (ctx) {
        ctx.clearRect(BOX[0], BOX[1], BOX[2], BOX[2]);
        SHARES.forEach((share, i) => {
          const way = clamp01((now - share.turn * S.shareGap) / S.shareTime), done = way >= 1 ? 1 : ease.share(way);
          if (way <= 0) return;
          const head = share.to - S.shareTurn * (1 - done);                         // where its white end is right now
          const grown = S.shareGrow + (1 - S.shareGrow) * done;                     // how much of its length it has
          const on = (place) => head - (share.to - place) * grown;                  // a place of the finished share, on the share as it is right now
          const faded = S.whiteGrow + (1 - S.whiteGrow) * done;                     // how much of its length the fade from clear to white has
          const clear = Math.min(head - (share.to - share.from - CAP - S.clear) * faded, head - 0.002);   // from here on (clockwise) the white comes in
          const white = Math.min(0.9, head - clear);                                // …and it is full this far further on, at the share's end
          const paint = ctx.createConicGradient(angle(clear), CX, CY);
          paint.addColorStop(0, "rgba(255,255,255,0)");
          paint.addColorStop(white, "#fff");
          paint.addColorStop(Math.min(0.97, white + CAP * 1.4), "#fff");            // the round end is white all over…
          paint.addColorStop(Math.min(0.98, white + CAP * 1.4 + 0.003), "rgba(255,255,255,0)");   // …and behind the start there is nothing
          ctx.globalAlpha = way >= 1 ? 1 : clamp01(ease.shareFade(clamp01(way / S.shareFade)));
          ctx.strokeStyle = paint;
          ctx.beginPath();
          ctx.arc(CX, CY, R, angle(on(share.from)), angle(head));
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
      labels.forEach((label, i) => {
        const way = clamp01((now - SHARES[i].turn * S.shareGap - S.labelAfter) / labelTime);
        const back = way >= 1 ? 0 : -S.labelTurn * TAU * (1 - ease.label(way)), cos = Math.cos(back), sin = Math.sin(back);   // how far it still has to go round the ring
        const x = SHARES[i].middle[0] - CX, y = SHARES[i].middle[1] - CY;                                // its place, seen from the centre of the ring
        label.style.opacity = way >= 1 ? "" : way <= 0 ? "0" : clamp01(ease.labelFade(clamp01(way / S.labelFade))).toFixed(3);
        label.style.transform = back ? "translate(" + unit((x * cos - y * sin - x).toFixed(2)) + "," + unit((x * sin + y * cos - y).toFixed(2)) + ")" : "";
      });
      if (sum) {
        const counted = now >= 1 ? SUM : Math.max(0, Math.round(SUM * ease.sum(now)));
        const text = counted.toString().replace(/\B(?=(\d{3})+$)/g, " ") + " ₽";                         // 865947 → "865 947 ₽"
        if (text !== sumText) sum.textContent = sumText = text;
        sum.style.opacity = now >= 1 ? "" : clamp01(now / S.sumShows).toFixed(3);
      }
    }

    const number = (text) => "<b>" + text + "</b>", name = (text) => '<span class="fm-num">' + text + "</span>";
    setup();
    return { size: FRAME, once: true, setup, html:
      '<canvas class="fm-split"></canvas>'
      + SHARES.map((share) => '<div class="fm-share" style="' + share.place + '">'
        + (share.numberFirst ? number(share.part + "%") + name(share.name) : name(share.name) + number(share.part + "%")) + "</div>").join("")
      + '<div class="fm-total fm-num"></div>',
      init(stage) {
        canvas = stage.querySelector(".fm-split"); labels = Array.from(stage.querySelectorAll(".fm-share")); sum = stage.querySelector(".fm-total");
        pose(STILL ? end : 0);                                 // nothing is shown until the animation starts (with "reduce motion": the finished drawing at once)
      },
      // The canvas gets as many pixels as the ring has on screen, and is drawn on in the px of the Figma frame.
      // (pixels: the side of the whole drawing in screen pixels.)
      resize(pixels) {
        const k = pixels / FRAME;
        canvas.width = canvas.height = Math.round(BOX[2] * k);
        ctx = canvas.getContext("2d");
        ctx.setTransform(k, 0, 0, k, -BOX[0] * k, -BOX[1] * k);
        ctx.lineWidth = LINE; ctx.lineCap = "round";
      },
      // time: seconds since the animation started. When it is over, the drawing asks not to be called any more (false).
      tick(time) {
        const now = STILL ? end : Math.min(end, Math.max(0, time / S.play));
        pose(now);
        return now < end;
      }
    };
  },

  // Royalty · 2 — four reports, one from each platform
  "royalty-2"() {
    const FRAME = 506;                                   // this drawing's Figma frame is 506×506 as well
    // how see-through the rows of a report are, from the top row down: the last ones fade away
    const FULL = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05];
    const SHORT = FULL.slice(6);                         // the six rows of the report in front: they lie on the same lines as the last six rows of the others
    const turns = [], lines = [];                        // filled while the drawing is put together: the turn of every report, and the line and look of every row
    const rows = (list) => "<span>" + list.map((alpha, i) => {
      lines.push({ line: FULL.length - list.length + i, alpha });          // which line it lies on: 0 = the top one. Rows on one line appear together
      return '<i style="opacity:' + alpha + '"></i>';
    }).join("") + "</span>";
    // a report: its turn in the animation (0 = first), position, the logo file, the rows, and the gap between the logo and the rows.
    // A logo file is the whole 168×32 line of the report: the logo sits in it where it sits in Figma, so no sizes are needed here.
    const report = (turn, x, y, logo, list, gap) => {
      turns.push(turn);
      return '<div class="fm-report" style="' + at(x, y) + (gap ? ";gap:" + gap + "px" : "") + '">' + pic(logo, "width:168px;height:32px", "fm-in")
        + (list ? rows(list) : "") + "</div>";
    };
    // bottom layer first: the report at the back has no rows (they would be hidden by the others anyway)
    const html = report(0, 153, 40, "art-logo-spotify.svg")
      + report(2, 266, 108, "art-logo-apple-music.svg", FULL)
      + report(1, 40, 108, "art-logo-vk-music.svg", FULL)
      + report(3, 153, 176, "art-logo-yandex-music.svg", SHORT, 24);

    const S = ROYALTY;                                   // the settings of the animation: see the top of this part of the file
    let ease = {}, lineGap = 0, end = 1;                 // the eases as functions, how long after the line above a line starts, and when the last part has arrived
    let sheets = [], bars = [], shown = [];              // the reports, the rows, and what was last written to each of them
    function setup() {
      ease = { sheet: easing(S.sheetEase), sheetFade: easing(S.sheetFadeEase), row: easing(S.rowEase), rowFade: easing(S.rowFadeEase) };
      lineGap = Math.max(0, 1 - S.rowsAt - S.rowTime) / (FULL.length - 1);
      end = Math.max(1, Math.max.apply(null, turns) * S.sheetGap + S.sheetTime, S.rowsAt + (FULL.length - 1) * lineGap + S.rowTime);
    }
    // moves one part: how see-through it is ("" = as in the finished drawing) and how far below its place it is, in Figma px
    function put(el, n, opacity, below) {
      const state = opacity + "|" + below;
      if (shown[n] === state) return;                      // nothing new for this part: leave it alone
      shown[n] = state;
      el.style.opacity = opacity;
      el.style.transform = below ? "translateY(" + unit(below) + ")" : "";
    }
    // Shows the moment `now` of the animation: 0 = nothing is there yet, 1 = the time is over (at `end`, which is 1 or a
    // little later, everything has arrived).
    function pose(now) {
      sheets.forEach((sheet, i) => {
        const way = clamp01((now - turns[i] * S.sheetGap) / S.sheetTime);
        if (way >= 1) put(sheet, i, "", 0);
        else if (way <= 0) put(sheet, i, "0", 0);
        else put(sheet, i, clamp01(ease.sheetFade(clamp01(way / S.sheetFade))).toFixed(3), +(S.sheetRise * (1 - ease.sheet(way))).toFixed(2));
      });
      bars.forEach((bar, i) => {
        const way = clamp01((now - S.rowsAt - lines[i].line * lineGap) / S.rowTime), n = sheets.length + i;
        if (way >= 1) put(bar, n, lines[i].alpha, 0);
        else if (way <= 0) put(bar, n, "0", 0);
        else put(bar, n, (lines[i].alpha * clamp01(ease.rowFade(way))).toFixed(3), +(S.rowRise * (1 - ease.row(way))).toFixed(2));
      });
    }

    setup();
    return { size: FRAME, once: true, setup, html,
      init(stage) {
        sheets = Array.from(stage.querySelectorAll(".fm-report")); bars = Array.from(stage.querySelectorAll(".fm-report > span > i"));
        pose(STILL ? end : 0);                                 // nothing is shown until the animation starts (with "reduce motion": the finished drawing at once)
      },
      // time: seconds since the animation started. When it is over, the drawing asks not to be called any more (false).
      tick(time) {
        const now = STILL ? end : Math.min(end, Math.max(0, time / S.play));
        pose(now);
        return now < end;
      }
    };
  }
};

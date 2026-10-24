/* The drawings of «Управление»: the grid of project tiles (s1-1), the project fields on wobbly rings (s1-2) and the
   activity feed (s1-3). See art/mount.js for how a drawing is put on the page and moved. */
import { SIZE, at, pic, stageCanvas, ARROW, seeded, TAU, clamp01, noise3, flatten, STILL } from "./shared.js";

export default {
  // S1 · 1 — grid of tiles: video, merch, cover, concert
  "s1-1"() {
    // ── settings of the animation ──
    // The white tiles shimmer: each one keeps getting brighter and dimmer, without ever stopping.
    // A tile is moved by two things at once, both in the styles: a quick flicker (fm-shimmer) and a slower swell
    // that dims the flicker and lets it out again (fm-dim). Every tile has its own pair of speeds and its own start,
    // so no two tiles ever keep in step.
    const FAST = 0.5, FAST_STEP = 0.04;   // seconds one way for the quickest flicker, and how much slower each next "pace" is
    const SLOW = 1.15, SLOW_STEP = 0.08;  // the same for the swell
    const rnd = seeded(7);
    // a white tile: its position, its opacity in the design (visitors who turned on "reduce motion" see that one),
    // and its two paces, 0…10. Tiles next to each other have paces far apart.
    const tile = (x, y, alpha, quick, slow) => {
      const flicker = FAST + quick * FAST_STEP, swell = SLOW + slow * SLOW_STEP;
      return '<div class="fm-tile fm-blink" style="' + at(x, y) + ";opacity:" + alpha + ";animation-duration:" + swell.toFixed(2) + "s;animation-delay:" + (-rnd() * 2 * swell - 1).toFixed(2) + 's">'
        + '<i style="animation-duration:' + flicker.toFixed(2) + "s;animation-delay:" + (-rnd() * 2 * flicker - 1).toFixed(2) + 's"></i></div>';
    };
    // a tile with content: the photo, and on it a play button, a price or a date (Figma: s1-image-1). The price is text.
    const card = (x, y, name, over) => '<div class="fm-tile fm-card" style="' + at(x, y) + '">' + pic(name, "left:0;top:0;width:100%;height:100%") + (over || "") + "</div>";
    const price = (sum) => '<span class="fm-price">' + sum + "</span>";
    return { html:
      tile(420, 68, 0.2, 5, 2) + tile(772, 245, 0.2, 8, 6) + tile(68, 421, 0.2, 0, 7) + tile(772, 421, 0.3, 3, 0)
      + tile(68, 597, 0.1, 6, 3) + tile(244, 772, 0.2, 10, 1) + tile(772, 772, 0.2, 7, 5)
      + tile(420, 245, 0.3, 1, 9) + tile(596, 421, 0.1, 9, 4) + tile(244, 597, 0.3, 2, 8) + tile(596, 597, 0.3, 4, 10)
      + card(244, 244, "art-card-video.png", pic("art-icon-play.svg", "left:15.38px;bottom:13.16px;width:34.41px;height:33.568px"))
      + card(596, 244, "art-card-hoodie.png", price("3200 ₽"))
      + card(244, 420, "art-card-cap.png", price("1590 ₽"))
      + card(420, 420, "art-card-home.png")
      + card(420, 596, "art-card-concert.png", pic("art-icon-day.svg", "left:13.16px;bottom:13.16px;width:42.105px;height:42.105px"))
    };
  },

  // S1 · 2 — project fields on wobbly rings
  "s1-2"() {
    // The four rings drawn in Figma, from the inside out: base curve, its position, opacity,
    // and the "dynamic stroke" settings (frequency, wiggle). The second one is the main ring the fields sit on.
    // A dynamic stroke is a smooth curve whose outline is pushed sideways by a random amount every `line width × frequency` px.
    const LINE = 4.13;       // width of the rings' line
    const KEYS = [
      ["M198.97.07C169.78 1.09 40.26 19.23 23.5 74.87 2.55 144.42-23.64 191.66 40.52 217.25 104.69 242.84 100.11 308.45 158.38 320.26 216.65 332.07 329.93 217.9 281.47 135.23 233.02 52.56 263.76-2.2 198.97.07", 323.512, 320.939, 0.1, 3.2, 2.7],
      ["M313.77.11C267.73 1.71 63.49 30.26 37.06 117.81 4.02 227.26-37.28 301.6 63.9 341.87 165.09 382.13 157.86 485.38 249.75 503.97 341.64 522.55 520.27 342.9 443.86 212.8 367.46 82.71 415.92-3.46 313.77.11", 238.961, 228.937, 0.5, 1.9, 2],
      ["M436.27 0C638.64 0 551.91 161.51 626.25 182.75 767.31 223.06 702.65 357.24 626.25 388.22 540.81 422.86 607.66 670.09 375.35 670.09 143.04 670.09 245.02 515.43 101.74 487.34-56.24 456.36 20.28 368.6 7.78 282.9-4.72 197.21 8.81 157.97 54.24 125.96 104.29 90.71 158.52 105.31 236.99 76.4 315.46 47.49 323.72 0 436.27 0", 138.144, 152.636, 0.1, 3, 2.2],
      ["M610.26 0C888.84 0 769.45 222.24 871.79 251.46 1065.97 306.92 976.97 491.56 871.79 534.17 754.18 581.83 875.68 920.99 555.88 920.99 236.07 920.99 301.58 814.6 174.43 726.37 47.94 638.61 13.16 496.13 2.46 422.81-8.24 349.49 15.81 204.08 78.35 160.04 147.24 111.52 227.91 144.91 335.93 105.13 443.96 65.35 455.33 0 610.26 0", -5.218, 26.671, 0.05, 5, 3]
    ];
    // ── settings of the animation ──
    const BEAT = 0.6;        // seconds per beat: the main ring is struck on every beat
    const HIT = 0.4;         // how much stronger the wobble gets on a beat (0 = no pulse)
    const DRIFT = 0.55;      // how fast the wobble changes shape by itself
    const OUT = 2.5, OUT_BEATS = 8;     // a wave going outwards travels this far (2 = the outermost drawn ring) in this many beats
    const IN = -1.6, IN_BEATS = 4;      // a wave going inwards (-1 = the inner drawn ring)
    const GAIN = 1.1;        // matches the strength of the wobble to Figma's
    const SHAPE = 15;        // how far the outline of the main ring is pushed out and pulled in by the waves below, px (its size stays the same)
    const SHAPE_SPEED = 1;   // how fast those waves run (2 = twice as fast)
    const FLOAT = 5;         // how far a field floats by itself, on top of riding the waves, px
    // The outline moves like a wave: a few sets of crests run around the ring, each at its own speed, and add up.
    // Each one is [number of crests, speed (negative = the other way round), where they start, share of SHAPE]
    const WAVES = [[2, 1.1, 1.1, 0.45], [3, -0.8, 4, 0.35], [5, 1.7, 2.3, 0.2]];
    const drift = (angle, time) => {
      let d = 0;
      for (let j = 0; j < WAVES.length; j++) d += WAVES[j][3] * Math.sin(WAVES[j][0] * angle - time * WAVES[j][1] * SHAPE_SPEED + WAVES[j][2]);
      const rise = clamp01(time / 2);                    // the waves grow from nothing in the first two seconds: the drawing starts from its shape in Figma
      return d * SHAPE * rise * rise * (3 - 2 * rise);
    };

    // Every ring is kept as a distance from one centre for N directions, so one ring can turn into another smoothly
    const CX = 467.35, CY = 469.44, N = 420;
    const cos = new Float32Array(N), sin = new Float32Array(N), X = new Float32Array(N), Y = new Float32Array(N), PX = new Float32Array(N), PY = new Float32Array(N);
    const bend = new Float32Array(N);    // how far the waves push the main ring's outline at this moment, for every direction
    for (let k = 0; k < N; k++) { cos[k] = Math.cos((k / N) * TAU); sin[k] = Math.sin((k / N) * TAU); }
    const radii = KEYS.map(([curve, x, y]) => {
      const polar = flatten(curve, x, y).map(([px, py]) => [(Math.atan2(py - CY, px - CX) + TAU) % TAU, Math.hypot(px - CX, py - CY)]).sort((a, b) => a[0] - b[0]);
      const out = new Float32Array(N), count = polar.length;
      for (let k = 0, i = 0; k < N; k++) {
        const a = (k / N) * TAU;
        while (i < count && polar[i][0] < a) i++;
        const p = polar[(i + count - 1) % count], q = polar[i % count];
        const span = (q[0] - p[0] + TAU) % TAU || 1, f = ((a - p[0] + TAU) % TAU) / span;
        out[k] = p[1] + (q[1] - p[1]) * f;
      }
      return out;
    });

    // s says where a ring is between the drawn ones: -1 the inner ring, 0 the main ring, 1 and 2 the outer rings.
    // Its shape, opacity and stroke settings are blended from the two drawn rings it is between.
    const between = (s) => { const i = Math.min(2, Math.max(0, Math.floor(s + 1))); return [i, s + 1 - i]; };
    const setting = (j, s) => { const [i, f] = between(s); return KEYS[i][j] + (KEYS[i + 1][j] - KEYS[i][j]) * clamp01(f); };
    const opacity = (s) => s < -1 ? 0.1 * clamp01((s - IN) / (-1 - IN)) : s > 2 ? 0.05 * clamp01((OUT - s) / (OUT - 2)) : setting(3, s);

    function drawRing(s, z, strength) {
      const [i, f] = between(s), A = radii[i], B = radii[i + 1];      // f may run past 0…1: the ring keeps travelling
      const hold = clamp01(1 - Math.abs(s));                          // a ring leaves the main ring with its shape and loses it on the way
      let total = 0;
      for (let k = 0; k < N; k++) {
        const r = A[k] + (B[k] - A[k]) * f + bend[k] * hold;
        X[k] = CX + r * cos[k]; Y[k] = CY + r * sin[k];
        if (k) total += Math.hypot(X[k] - X[k - 1], Y[k] - Y[k - 1]);
      }
      total += Math.hypot(X[0] - X[N - 1], Y[0] - Y[N - 1]);
      const amount = 0.875 * LINE * setting(5, s) * strength * GAIN, R = total / (LINE * setting(4, s)) / TAU;
      for (let k = 0, len = 0; k < N; k++) {                           // push every point sideways, off the smooth ring
        const p = (k + N - 1) % N, n = (k + 1) % N, tx = X[n] - X[p], ty = Y[n] - Y[p], tl = Math.hypot(tx, ty) || 1;
        if (k) len += Math.hypot(X[k] - X[p], Y[k] - Y[p]);
        const a = (len / total) * TAU, off = (noise3(R * Math.cos(a) + 40, R * Math.sin(a) + 40, z) * 2 - 1) * amount;
        PX[k] = X[k] + (ty / tl) * off; PY[k] = Y[k] - (tx / tl) * off;
      }
      // a smooth line through the points
      ctx.beginPath();
      ctx.moveTo((PX[N - 1] + PX[0]) / 2, (PY[N - 1] + PY[0]) / 2);
      for (let k = 0; k < N; k++) {
        const n = (k + 1) % N;
        ctx.quadraticCurveTo(PX[k], PY[k], (PX[k] + PX[n]) / 2, (PY[k] + PY[n]) / 2);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // the fields: position, width, left padding, the picture or icon, and the two lines of text
    const face = (name) => pic(name, "width:44.738px;height:44.738px", "fm-in fm-face");
    const FIELDS = [
      [196.514, 293.061, 179.656, 18.585, pic("art-thumb-home.png", "width:44.742px;height:44.742px;border-radius:5.434px", "fm-in"), "Релиз", "HOME"],
      [530.455, 394.247, 307.686, 12.39, face("art-face-mark.png"), "Менеджер проекта", "Марк Новиков"],
      [177.929, 511.948, 268.451, 12.39, face("art-face-petr.png"), "Ответственный", "Петр Кузнецов"],
      [379.267, 683.344, 242.638, 18.585, pic("art-icon-calendar.svg", "width:53.69px;height:53.69px", "fm-in"), "Дата релиза", "17 сентября"],
      [464.965, 197.038, 261.224, 12.39, '<i style="width:28.635px;height:28.635px;border-radius:50%;background:#16d947"></i>', "Статус", "Готов к релизу"]
    ];
    const pill = ([x, y, w, pad, icon, label, value]) =>
      '<div class="fm-pill" style="' + at(x, y) + ";padding-left:" + pad + 'px"><i>' + icon + '</i><span><span class="fm-dim">' + label + "</span><span>" + value + "</span></span></div>";
    const angles = FIELDS.map(([x, y, w]) => Math.atan2(y + 39.235 - CY, x + w / 2 - CX));   // where every field sits on the ring, seen from its centre
    let canvas = null, ctx = null, fields = [];

    // animation: the main ring wobbles, and waves run along its outline, pushing it out and in; on every beat a ring leaves it,
    // outwards and inwards in turn, fading from 50% to 0% while its stroke turns into that of the distant rings.
    // The fields float: each one rides the outline of the ring where it sits, and drifts a little by itself.
    // The rings are drawn on a canvas: redrawing them there takes far less work than rewriting SVG lines 60 times a second.
    function tick(time, dt, px) {                          // px: how long one Figma px is on the page right now
      if (!ctx) return;
      for (let k = 0; k < N; k++) bend[k] = drift((k / N) * TAU, time);
      if (!STILL) fields.forEach((el, i) => {
        const out = drift(angles[i], time);
        const dx = out * Math.cos(angles[i]) + FLOAT * Math.sin(time * 0.9 + i * 2.1), dy = out * Math.sin(angles[i]) + FLOAT * Math.cos(time * 0.7 + i * 1.3);
        el.style.transform = "translate(" + (dx * px).toFixed(2) + "px," + (dy * px).toFixed(2) + "px)";
      });
      const beat = time / BEAT + 1.3, phase = beat % 1;
      const hit = HIT * (phase < 0.12 ? phase / 0.12 : Math.exp(-(phase - 0.12) * 3.2));
      const z = time * DRIFT;
      const draw = (s) => {
        const alpha = opacity(s);
        if (alpha <= 0.003) return;
        ctx.globalAlpha = alpha;
        drawRing(s, z + Math.abs(s) * 0.9, 1 + hit * (1 - clamp01(Math.abs(s))));
      };
      ctx.clearRect(0, 0, SIZE, SIZE);
      draw(0);
      for (let born = Math.floor(beat / 2) * 2; born > beat - OUT_BEATS; born -= 2) {          // outwards: on even beats
        const age = (beat - born) / OUT_BEATS;
        draw(OUT * (1 - (1 - age) * (1 - age)));                                               // fast at first, then slower
      }
      for (let born = Math.floor((beat - 1) / 2) * 2 + 1; born > beat - IN_BEATS; born -= 2) {  // inwards: on the beats between
        const age = (beat - born) / IN_BEATS;
        draw(IN * (1 - (1 - age) * (1 - age)));
      }
    }

    return { html:
      '<canvas class="fm-rings"></canvas>' + FIELDS.map(pill).join(""),
      init(stage) { canvas = stage.querySelector(".fm-rings"); fields = Array.from(stage.querySelectorAll(".fm-pill")); },
      // called when the drawing gets its size on screen, and again whenever that size changes
      resize(pixels) { ctx = stageCanvas(canvas, pixels); ctx.strokeStyle = "#fff"; ctx.lineWidth = LINE; ctx.lineJoin = "round"; },
      tick
    };
  },

  // S1 · 3 — activity feed
  "s1-3"() {
    // an empty line: a row as wide as the feed, with the visible bar centred in it. The animation changes only the width of that bar,
    // as a share of the feed's 500px (w / 5 is that share in %)
    const bar = (w, h, alpha, z) => '<i class="fm-bar" style="height:' + h + "px;z-index:" + z + '"><b style="width:' + (w / 5).toFixed(3) + "%;background:rgba(255,255,255," + alpha + ')"></b></i>';
    const chip = (inner, style) => '<span class="fm-chip" style="' + style + '">' + inner + "</span>";
    const status = (color, text) => chip('<i style="background:' + color + '"></i>' + text, "gap:7.762px;padding:6.579px 12.5px 6.579px 9.868px;border-radius:1000px");
    // a photo: it moves up and down (see fm-hover in the styles); "behind" is how many seconds it is behind the others
    const face = (name, x, y, behind) => pic(name, at(x, y) + ";animation-delay:" + (behind - 8) + "s", "fm-ava fm-face");
    // a message: width, layer, gap between its two lines, the lines, the photo
    const msg = (w, z, gap, line1, line2, photo) =>
      '<span class="fm-msg" style="width:' + w + "px;z-index:" + z + ";gap:" + gap + 'px"><span>' + line1 + "</span><span>" + line2 + "</span>" + photo + "</span>";
    const who = (name, did, alpha) => '<span class="fm-med">' + name + '&nbsp;</span><span style="color:rgba(0,0,0,' + alpha + ')">' + did + "</span>";
    const date = (text, pad, z) => '<span class="fm-date" style="padding:0 ' + pad + "px;z-index:" + z + '">' + text + "</span>";
    let bars = [];
    return { html: '<div class="fm-feed">'
      + bar(296.053, 6.579, 0.1, 17) + bar(197.368, 9.868, 0.2, 16) + bar(98.684, 13.158, 0.4, 15)
      + bar(197.368, 19.737, 0.5, 14) + bar(394.737, 23.026, 0.6, 13) + bar(263.158, 26.316, 0.8, 12)
      + msg(476.974, 11, 6.579, who("Анна Смирнова", "создала проект:", 0.7),
          chip("<b>" + pic("art-thumb-lastseen.png", "width:26.316px;height:26.316px;border-radius:4.934px", "fm-in") + "</b>Last Seen at 8 AM", "gap:4.934px;padding:3.289px 9.868px 3.289px 3.289px;border-radius:9.868px"),
          face("art-face-anna.png", 437.63, -45.92, 0))
      + date("8 авг", 39.474, 10)
      + msg(532.895, 9, 6.579, who("Марк Новиков", "изменил статус:", 0.6),
          '<span style="display:flex;align-items:center;gap:3.289px">' + status("#ffbf00", "Входящие") + ARROW + status("#e366ff", "Согласование") + "</span>",
          face("art-face-mark.png", -88.69, -24.54, 1.7))
      + date("Сегодня", 52.632, 8)
      + msg(394.737, 7, 3.456, '<span class="fm-med">Эльвира Краснова:</span>', '<span style="color:rgba(0,0,0,.6)">Вот новая обложка...</span>', face("art-face-elvira.png", 347.3, 20.06, 3.3))
      + bar(100, 26.316, 0.8, 6) + bar(197.368, 23.026, 0.6, 5) + bar(394.737, 19.737, 0.5, 4)
      + bar(263.158, 13.158, 0.4, 3) + bar(131.579, 9.868, 0.2, 2) + bar(197.368, 6.579, 0.1, 1)
      + "</div>",
      init(stage) { bars = Array.from(stage.querySelectorAll(".fm-bar > b")); },
      // animation: the empty lines change width together, as one sound wave running down the feed
      // (the photos are moved up and down by the styles)
      tick(time) {
        const loud = 0.75 + 0.25 * Math.sin(time * 0.9);                  // the whole wave gets louder and quieter
        bars.forEach((bar, i) => {
          const row = i < 6 ? i : i + 5;                                  // the messages sit between the two groups of lines
          const wave = 0.62 * Math.sin(row * 0.8 - time * 3.4) + 0.38 * Math.sin(row * 1.9 - time * 6.1 + 1);
          bar.style.width = (48.75 + 31.25 * loud * wave).toFixed(2) + "%";   // 17.5…80% of the feed's width
        });
      }
    };
  }
};

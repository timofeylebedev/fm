/* The drawings of «Документы»: the stack of documents from request to signed (s2-1) and six documents tied together by
   one button (s2-2). See art/mount.js for how a drawing is put on the page and moved. */
import { SIZE, at, pic, stageCanvas, flatten, erf, nextId, STILL } from "./shared.js";

// The soft wedge under each document of s2-1 that fades the document behind into the background.
// In Figma: a four-cornered shape, transparent on the left, blurred more and more towards the right.
// It is the same for all four documents, so it is drawn once and copied onto a small canvas under each one.
// (It used to be turned into a PNG picture first. On phones that meant reading the canvas back from the graphics chip
// and encoding it, the slowest single step of the whole start of the page.)
const FADE = { w: 366.316, h: 304.737, corner: 157.895, pad: 60, block: 2.4, blur: 25.2, color: [245, 110, 0] };
let fadeCanvas = null;
function fadePicture() {
  if (fadeCanvas) return fadeCanvas;
  const F = FADE, w = Math.ceil((F.w + 2 * F.pad) / F.block), h = Math.ceil((F.h + 2 * F.pad) / F.block);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d"), image = ctx.createImageData(w, h), px = image.data;
  for (let cx = 0; cx < w; cx++) {
    const x = (cx + 0.5) * F.block - F.pad, along = Math.min(1, Math.max(0, x / F.w));
    const sigma = Math.max(0.9, F.blur * along) * 1.4142;
    const bottom = F.corner + (F.h - F.corner) * along;                 // the slanted lower edge
    const right = 0.5 * (1 - erf((x - F.w) / (F.blur * 1.4142)));
    for (let cy = 0; cy < h; cy++) {
      const y = (cy + 0.5) * F.block - F.pad, i = (cy * w + cx) * 4;
      px[i] = F.color[0]; px[i + 1] = F.color[1]; px[i + 2] = F.color[2];
      px[i + 3] = 255 * along * right * 0.5 * (erf(y / sigma) - erf((y - bottom) / sigma));
    }
  }
  ctx.putImageData(image, 0, 0);
  return (fadeCanvas = canvas);
}

export default {
  // S2 · 1 — stack of documents, from request to signed
  "s2-1"() {
    const id = nextId();
    const status = (x, y, bg, dot, text) => '<div class="fm-status" style="' + at(x, y) + ";background:" + bg + '"><i style="background:' + dot + '"></i>' + text + "</div>";
    const lines = (count, lastShort) => {
      let s = "";
      for (let i = 0; i < count; i++) s += "<i" + (lastShort && i === count - 1 ? ' style="width:153.158px"' : "") + "></i>";
      return count ? '<span class="fm-lines">' + s + "</span>" : "";
    };
    // a document: position, strength of the light on it, its tint, title, number of text lines, and what only the front one has
    const doc = (x, y, glow, tint, title, lineCount, extra, front) =>
      '<div class="fm-doc' + (front ? " fm-doc-front" : "") + '" style="' + at(x, y) + ";background:linear-gradient(143.13deg,rgba(255,255,255," + glow + "),rgba(255,255,255,0)),linear-gradient(90deg," + tint + ',#f56e00)">'
      + '<b class="fm-num">' + title + "</b>" + lines(lineCount, !!extra) + (extra || "") + "</div>";
    const fade = (x, y) => '<canvas class="fm-fade" style="' + at(x - FADE.pad, y - FADE.pad) + '"></canvas>';   // fades the document behind into the background
    // Every document in Figma has a folded corner. Only the front one can be seen: the corner of every other document
    // stays behind the next one, also while they move (neighbours never get further than about 17px from their places
    // next to each other). So only the front one is built: its corner is cut away in the styles (.fm-doc-front),
    // and here are the signature, the soft shadow of the flap and the flap itself.
    const fold = pic("art-icon-signature.svg", "width:33.996px;height:31.579px", "fm-in")
      + '<div style="left:225.6px;top:15.13px;width:124.8px;height:172.03px;filter:blur(23.4px)"><i style="height:100%;clip-path:polygon(0 0,99.78% 0,100% 100%,0 27.42%);background:linear-gradient(180deg,rgba(245,110,0,.6) 27.69%,rgba(245,110,0,.2) 63.73%)"></i></div>'
      + '<svg width="62.4" height="62.4" viewBox="0 0 62.4 62.4" style="right:0;top:0"><defs><linearGradient id="' + id + '" x1="0" y1="62.4" x2="44.48" y2="44.02" gradientUnits="userSpaceOnUse">'
      + '<stop stop-color="#f56e00" stop-opacity=".1"/><stop offset="1" stop-color="#f56e00" stop-opacity=".7"/></linearGradient></defs>'
      + '<path d="M0 0l62.4 62.4H0Z" fill="#fff"/><path d="M0 0l62.4 62.4H0Z" fill="url(#' + id + ')"/></svg>';
    // A status, and its document (with the fade under it). They are moved by the styles (see fm-sway and fm-bob there):
    // the front status leads, and every other one repeats its path a little later, like a tail. A document follows its own status
    // with a small delay (the class fm-late), as if it were pulled by it. i: 0 for the last document … 4 for the front one.
    const moved = (i, late, inner) => '<div class="fm-step' + (late ? " fm-late" : "") + '" style="left:0;top:0;--i:' + i + '"><div class="fm-lift" style="left:0;top:0">' + inner + "</div></div>";
    const step = (i, label, sheet) => moved(i, false, label) + moved(i, true, sheet);
    return { html: '<div style="left:159.2px;top:125.6px;width:681.6px;height:748.8px">'
      + step(0, status(0, 307.2, "#fcd6b7", "#ff8019", "Заявка"),
        doc(0, 364.8, 0.6, "#f8994d", "Лицензионный<br>договор<br>№ К-025", 0))
      + step(1, status(98.4, 230.4, "#fde9d8", "#ffbf00", "В разработке"),
        fade(97.64, 514.65) + doc(98.4, 288, 0.7, "#fab680", "Акт к Договору<br>оказания услуг<br>№ У-067", 2))
      + step(2, status(196.8, 153.6, "#fef6ef", "#e366ff", "Согласование с контрагентом"),
        fade(197.12, 437.28) + doc(196.8, 211.2, 0.8, "#fcd3b2", "Договор<br>оказания услуг<br>№ У-086", 4))
      + step(3, status(295.2, 76.8, "#fffdfc", "#33a0ff", "Контрагент думает"),
        fade(295.01, 361.49) + doc(295.2, 134.4, 0.9, "#fef0e5", "ДС к Лиценз.<br>договору<br>№ Л-216", 6))
      + step(4, status(393.6, 0, "#fff", "#16d947", "Подписан"),
        fade(392.9, 284.12) + doc(393.6, 58.35, 1, "#fff", "Лицензионный<br>договор<br>№ К-011", 8, fold, true))
      + "</div>",
      init(stage) {
        const picture = fadePicture();
        stage.querySelectorAll(".fm-fade").forEach((copy) => { copy.width = picture.width; copy.height = picture.height; copy.getContext("2d").drawImage(picture, 0, 0); });
      }
    };
  },

  // S2 · 2 — six documents tied together by one button
  "s2-2"() {
    const lines = '<span class="fm-lines">' + "<i></i>".repeat(9) + '<i style="width:116.431px"></i></span>';
    const sheet = (x, y, title) => '<div class="fm-sheet" style="' + at(x, y) + '"><b class="fm-num">' + title + "</b>" + lines + "</div>";
    // The lines around the documents: position, path, and where the colour runs.
    // Each path starts at the edge of a document. The six big ones end under the button, and their colour runs from the
    // button outwards (true = the colour starts at the end of the path). The four small ones go from one edge of the
    // documents to another, and their colour runs clockwise around the documents.
    const loops = [
      [335.6, 161.6, "M1.2 49.03C1.2 25.12 7.2 1.2 28.2 1.2 49.2 1.2 55.2 25.12 55.2 49.03V288", true],
      [608, 161.6, "M55.2 49.2C55.2 25.2 49.2 1.2 28.2 1.2 7.2 1.2 1.2 25.2 1.2 49.2V292", true],
      [335.6, 551.4, "M1.2 237.8C1.2 261.8 7.2 285.8 28.2 285.8 49.2 285.8 55.2 261.8 55.2 237.8V0", true],
      [608, 551.4, "M55.2 237.8C55.2 261.8 49.2 285.8 28.2 285.8 7.2 285.8 1.2 261.8 1.2 237.8V0", true],
      [124.4, 444.8, "M49.2 1.2C25.2 1.2 1.2 7.2 1.2 28.2 1.2 49.2 25.2 55.2 49.2 55.2H196.8", true],
      [680, 444.8, "M146.4 1.2C170.4 1.2 194.4 7.2 194.4 28.2 194.4 49.2 170.4 55.2 146.4 55.2H0", true],
      [153.95, 191.99, "M19.64 118.82C-52.35 118.82 109.65-53.18 109.65 18.81", false],   // top left: from the left edge up to the top edge
      [735.2, 191.99, "M91.2 118.82C163.2 118.82 1.2-53.18 1.2 18.81", true],             // top right: from the top edge down to the right edge
      [153.95, 687.98, "M19.64 1.2C-52.35 1.2 109.65 173.2 109.65 101.2", true],          // bottom left: from the bottom edge up to the left edge
      [735.2, 687.98, "M91.2 1.2C163.2 1.2 1.2 173.2 1.2 101.2", false]                   // bottom right: from the right edge down to the bottom edge
    ];
    // animation: light runs along the lines: they are white, turn light orange and come back.
    // A line cannot have a colour that changes along its length, so every line is cut into short pieces;
    // each piece goes white → light orange → white, a little later than the piece nearer to where the light starts.
    // All the pieces are drawn on one canvas. (As ~300 separately animated SVG lines they kept phones busy on every frame.)
    const PIECE = 9.12;      // length of a piece, px
    const WAVE = 364.8;      // distance between two white crests, px
    const PERIOD = 2.6;      // seconds for a crest to travel that distance
    const FROM = [255, 255, 255], TO = [248, 153, 77];   // white, and the colour at the dimmest point: #F8994D (what 30% white looks like on the orange of the card)
    // the "ease-in-out" curve of CSS, so the colour changes exactly as it did when the styles animated it
    const easeInOut = (x) => {
      let lo = 0, hi = 1;
      for (let i = 0; i < 20; i++) {
        const t = (lo + hi) / 2, r = 1 - t;
        if (3 * r * r * t * 0.42 + 3 * r * t * t * 0.58 + t * t * t < x) lo = t; else hi = t;
      }
      const t = (lo + hi) / 2;
      return 3 * (1 - t) * t * t + t * t * t;
    };
    const TONES = 128;       // the colours of one full white → light orange → white change, prepared once
    const tones = Array.from({ length: TONES }, (unused, i) => {
      const p = (i + 0.5) / TONES, fade = easeInOut(p < 0.5 ? p * 2 : (1 - p) * 2);
      return "rgb(" + FROM.map((c, j) => Math.round(c + (TO[j] - c) * fade)).join(",") + ")";
    });
    const pieces = [];       // every piece: its shape, and how far it is from where the colour starts on its line (in waves)
    loops.forEach(([x, y, d, fromEnd]) => {
      const pts = flatten(d, x, y), cuts = [];
      let piece = [pts[0]], run = 0;
      for (let i = 1; i < pts.length; i++) {
        let a = pts[i - 1], length = Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
        while (run + length > PIECE) {                                   // the piece is full: end it here and start the next one
          const f = (PIECE - run) / length, c = [a[0] + (pts[i][0] - a[0]) * f, a[1] + (pts[i][1] - a[1]) * f];
          piece.push(c); cuts.push(piece);
          piece = [c]; run = 0; a = c; length = Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
        }
        piece.push(pts[i]); run += length;
      }
      if (run > 0.25) cuts.push(piece); else run = PIECE;
      const total = (cuts.length - 1) * PIECE + run;                     // length of the whole line
      cuts.forEach((points, n) => {
        const path = new Path2D();
        path.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) path.lineTo(points[i][0], points[i][1]);
        pieces.push({ path, at: (fromEnd ? total - n * PIECE : n * PIECE) / WAVE });
      });
    });
    let canvas = null, ctx = null;
    function tick(time) {
      if (!ctx) return;
      const turn = time / PERIOD;
      ctx.clearRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < pieces.length; i++) {
        const p = turn - pieces[i].at;
        ctx.strokeStyle = STILL ? "#fff" : tones[((p - Math.floor(p)) * TONES) & (TONES - 1)];   // with "reduce motion" the lines stay white
        ctx.stroke(pieces[i].path);
      }
    }
    return { html:
      '<div style="left:173.513px;top:210.723px;width:652.974px;height:578.554px;background:linear-gradient(153.509deg,rgba(255,255,255,.9),rgba(255,255,255,.1)),#f56e00"></div>'
      + sheet(173.513, 210.723, "Приложение №3<br>к лицензионному<br>договору<br>№ ФМ-011")
      + sheet(173.513, 501.2, "Лицензионный<br>договор<br>№ ФМ-012")
      + sheet(610.429, 210.723, "Договор об<br>отчуждении<br>исключительных<br>прав № ИП-045")
      + sheet(610.429, 501.2, "Приложение № 2<br>к Лицензионному<br>договору<br>№ ФМ-012")
      + sheet(391.971, 210.723, "Лицензионный<br>договор<br>№ ФМ-011")
      + sheet(391.971, 501.2, "Договор об<br>отчуждении<br>исключительных<br>прав № ФЗ-102")
      + '<canvas class="fm-flow"></canvas>'                    // the lines lie over the documents and under the button
      + '<div class="fm-cta">Оформить права</div>',
      init(stage) { canvas = stage.querySelector(".fm-flow"); },
      // The ends of the lines are cut straight, so they stop exactly at the edge of a document.
      // "lighter": where two pieces meet, their colours are added up exactly, so the joint shows neither a gap nor a bead.
      resize(pixels) { ctx = stageCanvas(canvas, pixels); ctx.lineWidth = 2.4; ctx.lineCap = "butt"; ctx.globalCompositeOperation = "lighter"; },
      tick
    };
  }
};

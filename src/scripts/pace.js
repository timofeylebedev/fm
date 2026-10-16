/* A lighter mode for weak devices.
   Every animation loop reports here when its frames come. When the middle (median) one of 90 frames in a row takes
   longer than 22 ms (fewer than about 45 frames a second), the device cannot keep up, and the page switches to a
   lighter mode for the rest of the visit:
     · the loops drawn by the scripts (the hero chips, the ring of covers, the dots, the drawings) draw on every second
       frame only, 30 times a second. Their motions are slow: at 30 frames they look the same, while a device that keeps
       missing frames looks jerky;
     · the hero chips lose their frosted glass;
     · the canvases of the drawings get at most 2 pixels per CSS px (3 on the sharpest phone screens otherwise).
   The animations done by the styles and by GSAP (headings, cards, the logos strip) are not touched.
   To see the lighter mode on a fast computer: fmPace.slow = true in the console (fmPace.slow = false to go back). */

const SAMPLE = 90;      // frames looked at, in a row
const SLOW_MS = 22;     // a median frame longer than this switches the lighter mode on
const STEP_MS = 28;     // in the lighter mode a loop draws only when this much time has passed since it last drew

let times = [], prev = 0, slow = false;
const listeners = [];

export const pace = {
  get slow() { return slow; },
  set slow(v) { v = !!v; if (v !== slow) { slow = v; listeners.forEach((fn) => fn(v)); } },
  onChange(fn) { listeners.push(fn); },
  // called by the loops on every frame with the frame's time; several loops in one frame count once
  frame(now) {
    if (now === prev) return;
    if (prev && now - prev < 250) times.push(now - prev);   // a longer gap is a hidden tab or a pause, not the pace
    prev = now;
    if (times.length < SAMPLE) return;
    const median = times.sort((a, b) => a - b)[SAMPLE >> 1];
    times = [];
    if (!slow && median > SLOW_MS) {
      console.info("fm: the lighter mode for weak devices is on (median frame " + median.toFixed(1) + " ms)");
      this.slow = true;
    }
  },
  // should a loop draw on this frame? last: when it drew before (0 = never)
  due(last, now) { return !slow || !last || now - last >= STEP_MS; }
};

window.fmPace = pace;

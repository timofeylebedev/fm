/* A movement from one value to another that can be sent somewhere else while it is under way, without a jolt.
   An ordinary tween (or a CSS transition) that is given a new end mid-way starts again from rest: the thing stops
   dead and sets off anew. Here the new movement starts from where the thing is AND at the speed it has at that moment,
   so a change of mind looks like a curve, not a corner.

   How: the position is the usual eased way from a to b, plus a term that carries the speed it had when it set off
   (v0) and fades out by the end: p(s) = a + (b - a)·E(s) + v0·T·s·(1 - s)². At the start that term moves at exactly
   v0 and E (an ease that starts at rest) adds nothing, so the speed is continuous; at the end both have stopped.
   A movement that starts from rest uses the given ease (the site's curve). One that starts on the move uses the plain
   cubic (3s² - 2s³, the smooth step) and is made short enough not to run past its end: the cubic is free of a turn back
   as long as v0·T is at most 3 times the way (it would otherwise overshoot and come back, which for a scroll of the
   page is the worst thing it could do). Going on the other way, it turns round smoothly.
   Used by the scroll of section links (scroll.js) and the outline of the navbar's current link (nav-pill.js). */

// an ease as CSS draws cubic-bezier(x1, y1, x2, y2): x is time, y progress
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const Y = (t) => ((ay * t + by) * t + cy) * t, dY = (t) => (3 * ay * t + 2 * by) * t + cy;
  const solve = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const d = dX(t); if (Math.abs(d) < 1e-6) break; const e = X(t) - x; if (Math.abs(e) < 1e-6) return t; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 30; i++) { const e = X(t); if (Math.abs(e - x) < 1e-6) break; if (e < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return t;
  };
  const f = (s) => (s <= 0 ? 0 : s >= 1 ? 1 : Y(solve(s)));
  f.slope = (s) => { if (s <= 0 || s >= 1) return 0; const t = solve(s), d = dX(t); return d ? dY(t) / d : 0; };   // dE/ds
  return f;
}

// the smooth step, for movements that start on the move (see above)
const step = (s) => s * s * (3 - 2 * s);
step.slope = (s) => 6 * s * (1 - s);

// One value (or several together, as an array) moving with glides. glide.to(target, seconds) starts a movement from
// where it is now, at its present speed; glide.at(now) says where it is at that moment (seconds, performance.now()/1000).
export function glider(ease, start) {
  let a = [].concat(start), b = a.slice(), v = a.map(() => 0), t0 = 0, T = 0, E = ease;
  const get = (now) => {
    const s = T > 0 ? Math.min(1, Math.max(0, (now - t0) / T)) : 1;
    if (s >= 1) return { p: b.slice(), v: b.map(() => 0), done: true };
    const e = E(s), de = E.slope(s) / T, h = s * (1 - s) * (1 - s), dh = (1 - s) * (1 - 3 * s);
    return {
      p: a.map((ai, i) => ai + (b[i] - ai) * e + v[i] * T * h),
      v: a.map((ai, i) => (b[i] - ai) * de + v[i] * dh),
      done: false
    };
  };
  return {
    to(target, seconds, now) {
      const here = get(now);
      a = here.p; v = here.v; b = [].concat(target); t0 = now; T = Math.max(0.001, seconds); E = ease;
      if (v.some((x) => Math.abs(x) > 1)) {
        E = step;
        // short enough not to overshoot, wherever it is already heading the right way (at least one frame)
        a.forEach((ai, i) => { const d = b[i] - ai; if (d * v[i] > 0) T = Math.min(T, Math.max(1 / 60, 2.6 * Math.abs(d / v[i]))); });
      }
    },
    jump(target) { a = [].concat(target); b = a.slice(); v = a.map(() => 0); T = 0; },
    retarget(target) { b = [].concat(target); },           // the end moves (the page changed under it), the timing stays
    at: get,
    get target() { return b.slice(); }
  };
}

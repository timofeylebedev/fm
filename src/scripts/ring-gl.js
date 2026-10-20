/* The picture of the ring of covers (scripts/ring.js decides where it stands and how it turns; this file only draws it).
   Loaded only when the block comes within a screen of the visible part of the page, together with the covers.

   One canvas and one WebGL 2 draw call a frame, with no vertex data at all: the vertex shader works out every corner of
   every cover from its number (gl_VertexID), the turn and the tilt, with the same 3D maths and perspective as the CSS
   ring it replaced (rotateY · translateZ in a rotateX about the ring's centre, seen from `perspective` px away). Per
   frame the page only sends two numbers (turn, tilt) and asks for one draw; nothing is laid out, styled, painted or
   layered again, so the browser's main thread has almost nothing to do.
     · The rounded corners: a distance to the card's edge in the fragment shader, smoothed over one device pixel.
     · The backs of the covers: the same picture faded towards the page colour (CONFIG.backFade), in the shader.
     · Which side is seen, and what covers what: the ring is a convex shape, so the backs never cover each other, nor
       do the fronts, and a front is always nearer than any back it overlaps. Drawing all backs first, then all fronts,
       with the faces turned away from the eye left out by the GPU (cull), gives the right picture with no sorting and
       no depth buffer.
     · The covers: one texture array, a layer per cover, at the size the screen really shows them (never more than the
       640 px files), with mipmaps so covers seen edge-on do not shimmer. Each cover is laid on the card colour (mist)
       as it uploads, one cover per frame, so a cover with see-through parts looks as before and the upload never adds
       up to one long frame. Until a cover arrives its card is mist, as before.
   Without WebGL 2 (a GPU the browser has turned off, very old Safari), a still picture of the ring is drawn once with
   the 2D canvas instead (each cover as a flat parallelogram, close enough for a still). */

const DPR_MAX = 2;          // device pixels per CSS px at most: the 640 px covers show about 350 CSS px at most
const TILE_MAX = 640;       // the covers' own size
const TILE_STEP = 64;       // the covers' texture grows in these steps (never shrinks), so small resizes do not reload

const VS = `#version 300 es
uniform int u_n;                 // covers
uniform vec2 u_pose;             // turn, tilt (radians)
uniform vec4 u_ring;             // half the cover's width, half its height, the ring's radius, the perspective (CSS px)
uniform vec4 u_view;             // the ring's centre on the canvas (x, y), the canvas size (w, h), CSS px
uniform int u_have;              // which covers have arrived (bit per cover)
out vec2 v_uv;
out vec2 v_p;                    // the point on the card, CSS px from its centre
flat out int v_tile;
flat out float v_back;
flat out float v_have;
void main() {
  int quad = gl_VertexID / 6, k = gl_VertexID - quad * 6;
  bool back = quad < u_n;                                  // the backs first, then the fronts
  int tile = back ? quad : quad - u_n;
  int c = k < 3 ? k : (k == 3 ? 0 : k - 2);                // two triangles: corners 0 1 2, 0 2 3
  vec2 s = vec2((c == 1 || c == 2) ? 1.0 : -1.0, c >= 2 ? 1.0 : -1.0);
  vec2 p = s * u_ring.xy;                                  // y down, as in CSS
  float x = back ? -p.x : p.x;                             // a back is its front turned half round (rotateY(180deg))
  float a = u_pose.x + float(tile) * 6.28318530718 / float(u_n);
  float ca = cos(a), sa = sin(a), ct = cos(u_pose.y), st = sin(u_pose.y), r = u_ring.z;
  float X = x * ca + r * sa, Z = -x * sa + r * ca;         // rotateY(turn + its place) translateZ(radius)
  float Y = p.y * ct - Z * st;                             // rotateX(tilt) about the ring's centre
  Z = p.y * st + Z * ct - r;
  float w = (u_ring.w - Z) / u_ring.w;                     // perspective: things nearer by Z look bigger
  gl_Position = vec4((u_view.x * w + X) * 2.0 / u_view.z - w, w - (u_view.y * w + Y) * 2.0 / u_view.w, 0.0, w);
  v_uv = s * 0.5 + 0.5;
  v_p = p;
  v_tile = tile;
  v_back = back ? 1.0 : 0.0;
  v_have = float((u_have >> tile) & 1);
}`;

const FS = `#version 300 es
precision highp float;
uniform mediump sampler2DArray u_tex;
uniform vec4 u_ring;
uniform float u_corner;          // CSS px
uniform vec3 u_mist;             // the card colour until its cover arrives
uniform vec4 u_fade;             // the backs: colour, how much
in vec2 v_uv;
in vec2 v_p;
flat in int v_tile;
flat in float v_back;
flat in float v_have;
out vec4 o;
void main() {
  vec3 col = mix(u_mist, texture(u_tex, vec3(v_uv, float(v_tile)), -0.5).rgb, v_have);
  col = mix(col, u_fade.rgb, u_fade.a * v_back);
  vec2 q = abs(v_p) - u_ring.xy + u_corner;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_corner;   // CSS px from the rounded edge, < 0 inside
  float cover = clamp(0.5 - d / max(fwidth(d), 1e-4), 0.0, 1.0);      // smoothed over one device pixel
  if (cover <= 0.0) discard;
  o = vec4(col * cover, cover);                                        // premultiplied
}`;

// "rgb(…)" / "#…" / a CSS variable → [r, g, b] in 0…1, as the page resolves it
function rgbOf(css, host) {
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;visibility:hidden;color:" + css;
  host.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0];
  probe.remove();
  return [m[0] / 255, m[1] / 255, m[2] / 255];
}

const loadImage = (src) => new Promise((done) => {
  const img = new Image();
  img.decoding = "async";
  img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => done(img));
  img.onerror = () => done(null);
  img.src = src;
});

export function createRingView(root, c) {
  const canvas = document.createElement("canvas");
  canvas.className = "rc-canvas";
  root.appendChild(canvas);

  let g = null;                  // the geometry from ring.js (CSS px)
  let dpr = 1, ox = 0, tile = 0, have = 0, pose = [0, 0], lost = false, gen = 0;
  let images = [];               // the decoded covers waiting to be uploaded (or kept for the still picture)
  let mist = [0.9, 0.9, 0.9], fade = [1, 1, 1];

  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
  const flat = gl ? null : canvas.getContext("2d");
  let prog, tex, U = {};

  function colours() {
    mist = rgbOf("var(--mist)", root);
    fade = rgbOf(c.backFadeColor, root);
  }

  function setup() {
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    const vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("fm ring:", gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);
    for (const n of ["u_n", "u_pose", "u_ring", "u_view", "u_have", "u_tex", "u_corner", "u_mist", "u_fade"]) U[n] = gl.getUniformLocation(prog, n);
    gl.bindVertexArray(gl.createVertexArray());           // no vertex data: everything comes from gl_VertexID
    gl.enable(gl.CULL_FACE);                               // the faces turned away from the eye are not drawn:
    gl.frontFace(gl.CW);                                   // a card's corners go clockwise when it faces the eye
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.uniform1i(U.u_tex, 0);
    tex = null; tile = 0; have = 0;
    return true;
  }

  // the covers' texture: one layer per cover, `size` px square, with mipmaps
  function makeTexture(size) {
    if (tex) gl.deleteTexture(tex);
    tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    const levels = Math.floor(Math.log2(size)) + 1;
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, size, size, c.images.length);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // covers seen nearly edge-on are squeezed sideways only: anisotropic filtering keeps them as sharp as the CSS ring
    // was (plain mipmaps would blur them in both directions)
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    if (aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    tile = size; have = 0;
    gl.uniform1i(U.u_have, 0);
  }

  // Downloads the covers (once per texture size; the browser's cache serves the later times) and queues them.
  function fetchCovers() {
    const my = ++gen;
    c.images.forEach((src, i) => src && loadImage(src).then((img) => {
      if (my !== gen || !img) return;
      images.push({ i, img });
      flat ? still() : queue();
    }));
  }

  // One cover per frame: laid on the card colour at the texture's size (a 2D canvas does the smooth downscale), uploaded,
  // then the mipmaps are rebuilt (on the GPU).
  let pending = 0, scratch = null;
  function queue() { if (!pending) pending = requestAnimationFrame(uploadOne); }
  function uploadOne() {
    pending = 0;
    if (lost || !tile) return;
    const next = images.shift();
    if (!next) return;
    scratch = scratch || document.createElement("canvas");
    scratch.width = scratch.height = tile;
    const x = scratch.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.fillStyle = "rgb(" + mist.map((v) => Math.round(v * 255)).join() + ")";
    x.fillRect(0, 0, tile, tile);
    x.drawImage(next.img, 0, 0, tile, tile);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, next.i, tile, tile, 1, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    have |= 1 << next.i;
    gl.uniform1i(U.u_have, have);
    paint();
    if (images.length) queue();
    else { scratch.width = scratch.height = 0; scratch = null; }   // let the scratch canvas go
  }

  // ── the still picture without WebGL 2 ──
  function project(x, y, a, t) {
    const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(t), st = Math.sin(t), r = g.radius;
    const X = x * ca + r * sa, Z0 = -x * sa + r * ca;
    const Y = y * ct - Z0 * st, Z = y * st + Z0 * ct - r, k = g.perspective / (g.perspective - Z);
    return [ox + X * k, g.oy + Y * k];
  }
  function still() {
    if (!g) return;
    const ctx = flat, n = c.images.length, hw = g.halfW, hh = g.halfH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const byTile = {};
    images.forEach((e) => { byTile[e.i] = e.img; });
    for (const back of [true, false]) for (let i = 0; i < n; i++) {
      const a = pose[0] + i * 2 * Math.PI / n, m = back ? -1 : 1;
      const p0 = project(-hw * m, -hh, a, pose[1]), p1 = project(hw * m, -hh, a, pose[1]), p3 = project(-hw * m, hh, a, pose[1]);
      const ux = (p1[0] - p0[0]) / (2 * hw), uy = (p1[1] - p0[1]) / (2 * hw), vx = (p3[0] - p0[0]) / (2 * hh), vy = (p3[1] - p0[1]) / (2 * hh);
      if (ux * vy - uy * vx <= 0) continue;                           // turned away from the eye
      ctx.setTransform(ux * dpr, uy * dpr, vx * dpr, vy * dpr, p0[0] * dpr, p0[1] * dpr);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(0, 0, 2 * hw, 2 * hh, g.corner) : ctx.rect(0, 0, 2 * hw, 2 * hh);
      ctx.clip();
      ctx.fillStyle = "rgb(" + mist.map((v) => Math.round(v * 255)).join() + ")";
      ctx.fillRect(0, 0, 2 * hw, 2 * hh);
      if (byTile[i]) ctx.drawImage(byTile[i], 0, 0, 2 * hw, 2 * hh);
      if (back) { ctx.globalAlpha = g.fade; ctx.fillStyle = "rgb(" + fade.map((v) => Math.round(v * 255)).join() + ")"; ctx.fillRect(0, 0, 2 * hw, 2 * hh); }
      ctx.restore();
    }
  }

  function paint() {
    if (!g || lost) return;
    if (flat) return still();
    gl.uniform2f(U.u_pose, pose[0], pose[1]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 12 * c.images.length);
  }

  const view = {
    get webgl() { return !!gl; },
    // the geometry changed (ring.js layout): CSS px
    resize(geom) {
      g = geom;
      dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      // the canvas starts on a whole device pixel across (the block itself often starts between two), so its pixels are
      // drawn 1:1 and not resampled by the browser; the ring is moved back by the same fraction
      const left = root.getBoundingClientRect().left * dpr, shift = (left - Math.floor(left)) / dpr;
      ox = g.ox + shift;
      canvas.style.cssText = "left:" + (-shift) + "px;top:" + (-g.above) + "px;width:" + g.width + "px;height:" + g.height + "px";
      const w = Math.max(1, Math.round(g.width * dpr)), h = Math.max(1, Math.round(g.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      dpr = canvas.width / g.width;
      if (flat || lost) return paint();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1i(U.u_n, c.images.length);
      gl.uniform4f(U.u_ring, g.halfW, g.halfH, g.radius, g.perspective);
      gl.uniform4f(U.u_view, ox, g.oy, g.width, g.height);
      gl.uniform1f(U.u_corner, Math.min(g.corner, g.halfW, g.halfH));
      gl.uniform3f(U.u_mist, mist[0], mist[1], mist[2]);
      gl.uniform4f(U.u_fade, fade[0], fade[1], fade[2], g.fade);
      // the covers' texture: as many pixels as the nearest cover shows, never more than the files have
      const need = Math.min(TILE_MAX, Math.ceil(2 * g.halfW * dpr * 1 / TILE_STEP) * TILE_STEP);
      if (need > tile) { makeTexture(need); images = []; fetchCovers(); }
      paint();
    },
    // the pose: turn and tilt in degrees
    draw(turn, tilt) {
      pose[0] = turn * Math.PI / 180;
      pose[1] = tilt * Math.PI / 180;
      paint();
    },
    // the settings changed (the console's update()): colours, fade, images
    refresh(imagesChanged) {
      colours();
      if (imagesChanged) {
        images = [];
        if (gl) tile = 0;                                   // resize() below makes the texture again and downloads them
        else fetchCovers();
      }
      if (g) view.resize(g);
    }
  };

  colours();
  if (gl) {
    if (!setup()) { canvas.remove(); return null; }
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; gen++; cancelAnimationFrame(pending); pending = 0; images = []; });
    canvas.addEventListener("webglcontextrestored", () => { lost = false; if (setup() && g) view.resize(g); });
  } else if (flat) {
    fetchCovers();
  } else {
    canvas.remove();
    return null;
  }
  return view;
}

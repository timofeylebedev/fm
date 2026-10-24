/* The picture of the ring of covers (scripts/ring.js decides where it stands, how it turns and when it is drawn; this
   file only draws it). Loaded only when the block comes within a screen of the visible part of the page, with the covers.

   One canvas and one WebGL 2 draw call a frame, with no vertex data at all: the vertex shader works out every corner of
   every cover from its number (gl_VertexID), the turn and the tilt, with the same 3D maths and perspective as the CSS
   ring it replaced (rotateY · translateZ in a rotateX about the ring's centre, seen from `perspective` px away). Per
   frame the page sends two numbers (turn, tilt) and asks for one draw; nothing on the page is laid out, styled, painted
   or layered again.
     · The rounded corners: a distance to the card's edge in the fragment shader, smoothed over one device pixel.
     · The backs of the covers: the same picture faded towards the page colour (CONFIG.backFade), in the shader.
     · Which side is seen, and what covers what: the cards lie on the sides of a convex prism (spacing ≥ 0, ring.js), so
       the backs never cover each other, nor do the fronts, and a front is always nearer than any back it overlaps.
       Drawing all backs first, then all fronts, with the faces turned away from the eye left out by the GPU (cull),
       gives the right picture with no sorting and no depth buffer.
     · The covers: one texture array, a layer per cover, at the size the screen shows the nearest one (never more than
       the 640 px files), with mipmaps and anisotropic filtering so covers seen edge-on neither shimmer nor smear. Each
       layer starts as the card colour (mist), and each cover is laid on that colour as it uploads, one cover per frame,
       so a cover with see-through parts looks as before and the upload never adds up to one long frame. When the
       texture has to grow (a wider window, a phone turned sideways), the old one keeps being drawn until the new one
       holds every cover, so nothing flashes grey.
   WebGL only when the browser draws it on a real GPU. Without one (a GPU the browser has turned off, a virtual machine,
   a remote desktop), Chrome copies a WebGL canvas back to the processor on every frame, which costs far more than the
   ring is worth (measured in Chromium without a GPU: ≈ 12 ms a frame). Then, and without WebGL 2 at all, a still
   picture of the ring is drawn with the 2D canvas instead (each cover as a flat parallelogram, close enough for a
   still). ?fmring=gl forces WebGL anyway (for tests in a browser without a GPU). */

const TILE_MAX = 640;       // the covers' own size
const TILE_STEP = 32;       // the covers' texture grows in these steps (never shrinks), so small resizes do not reload
const FORCE_GL = /[?&]fmring=gl/.test(location.search);

const VS = `#version 300 es
uniform int u_n;                 // covers
uniform vec2 u_pose;             // turn, tilt (radians)
uniform vec4 u_ring;             // half the cover's width, half its height, the ring's radius, the perspective (CSS px)
uniform vec4 u_view;             // the ring's centre on the canvas (x, y), the canvas size (w, h), CSS px
out vec2 v_uv;
out vec2 v_p;                    // the point on the card, CSS px from its centre
flat out int v_tile;
flat out float v_back;
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
}`;

const FS = `#version 300 es
precision highp float;
uniform mediump sampler2DArray u_tex;
uniform vec4 u_ring;
uniform float u_corner;          // CSS px
uniform vec4 u_fade;             // the backs: colour, how much
in vec2 v_uv;
in vec2 v_p;
flat in int v_tile;
flat in float v_back;
out vec4 o;
void main() {
  vec3 col = mix(texture(u_tex, vec3(v_uv, float(v_tile))).rgb, u_fade.rgb, u_fade.a * v_back);
  vec2 q = abs(v_p) - u_ring.xy + u_corner;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_corner;   // CSS px from the rounded edge, < 0 inside
  float cover = clamp(0.5 - d / max(fwidth(d), 1e-4), 0.0, 1.0);      // smoothed over one device pixel
  if (cover <= 0.0) discard;
  o = vec4(col * cover, cover);                                        // premultiplied
}`;

// any CSS colour (a variable, oklch(), …) → [r, g, b] in 0…1, as the page draws it
function rgbOf(css, host) {
  const probe = document.createElement("i");
  probe.style.cssText = "position:absolute;visibility:hidden;color:" + css;
  host.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  const x = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  x.fillStyle = resolved;
  x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}
const css = (rgb) => "rgb(" + rgb.map((v) => Math.round(v * 255)).join() + ")";

const loadOne = (src) => new Promise((done) => {
  const img = new Image();
  img.decoding = "async";
  img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => done(img));
  img.onerror = () => done(null);
  img.src = src;
});
// a cover is a file or a list of files to try in turn (an AVIF, then a WebP for browsers without AVIF)
const loadImage = (src) => [].concat(src).reduce((got, s) => got.then((img) => img || loadOne(s)), Promise.resolve(null));

// onDirty: the picture changed by itself (a cover arrived, the GPU came back): ring.js draws it again
export function createRingView(root, c, onDirty) {
  let canvas = null, gl = null, flat = null;
  let g = null, dpr = 1, pose = [0, 0], lost = false, gen = 0;
  let mist = [0.9, 0.9, 0.9], fade = [1, 1, 1];
  let prog = null, U = {}, fb = null;
  let tex = null, tile = 0;                 // the texture being drawn, and its size
  let next = null, nextTile = 0;            // a bigger texture being filled (drawn once it holds every cover)
  let queue = [], settled = 0, pending = 0, scratch = null;
  let stills = [];                          // the covers of the still picture

  const newCanvas = () => {
    if (canvas) canvas.remove();
    canvas = document.createElement("canvas");
    canvas.className = "rc-canvas";
    root.appendChild(canvas);
    if (g) place();
  };

  // WebGL 2 on a real GPU, or nothing
  function tryGL() {
    newCanvas();
    const ctx = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: !FORCE_GL });
    if (!ctx) return false;
    const dbg = ctx.getExtension("WEBGL_debug_renderer_info");
    if (!FORCE_GL && /SwiftShader|llvmpipe|softpipe|Software/i.test(String(ctx.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : ctx.RENDERER)))) return false;
    gl = ctx;
    if (!setup()) { gl = null; return false; }
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; gen++; cancelAnimationFrame(pending); pending = 0; queue = []; });
    canvas.addEventListener("webglcontextrestored", () => {
      lost = false;
      if (setup()) { if (g) view.resize(g); }
      else { gl = null; toFlat(); }
      onDirty();
    });
    return true;
  }

  function setup() {
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    const vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (!gl.isContextLost()) console.warn("fm ring:", gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);
    for (const n of ["u_n", "u_pose", "u_ring", "u_view", "u_tex", "u_corner", "u_fade"]) U[n] = gl.getUniformLocation(prog, n);
    gl.bindVertexArray(gl.createVertexArray());           // no vertex data: everything comes from gl_VertexID
    gl.enable(gl.CULL_FACE);                               // the faces turned away from the eye are not drawn:
    gl.frontFace(gl.CW);                                   // a card's corners go clockwise when it faces the eye
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(U.u_tex, 0);
    fb = gl.createFramebuffer();
    tex = next = null; tile = nextTile = 0;
    return true;
  }

  // the still picture, on a fresh canvas (a canvas once asked for WebGL cannot draw 2D)
  function toFlat() {
    newCanvas();
    flat = canvas.getContext("2d");
    if (!flat) { canvas.remove(); return; }
    stills = [];
    fetchCovers();
  }

  // A texture of `size` px squares, one layer per cover, every layer the card colour to start with.
  function makeTexture(size) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.floor(Math.log2(size)) + 1, gl.RGBA8, size, size, c.images.length);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // covers seen nearly edge-on are squeezed sideways only: anisotropic filtering keeps them as sharp as the CSS ring
    // was (plain mipmaps would blur them in both directions)
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    if (aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    for (let i = 0; i < c.images.length; i++) {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, t, 0, i);
      gl.clearBufferfv(gl.COLOR, 0, [mist[0], mist[1], mist[2], 1]);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    return t;
  }

  // Downloads the covers (the browser's cache serves them when the texture grows) and queues them for upload.
  function fetchCovers() {
    const my = ++gen;
    settled = 0;
    c.images.forEach((src, i) => (src ? loadImage(src) : Promise.resolve(null)).then((img) => {
      if (my !== gen) return;
      settled++;
      if (flat) { if (img) stills[i] = img; onDirty(); return; }
      if (img) queue.push({ i, img });
      upload();
    }));
  }

  // One cover per frame: laid on the card colour at the texture's size (a 2D canvas does the smooth downscale), uploaded,
  // and the mipmaps rebuilt (on the GPU). Into the texture being drawn the first time; into the new one when it grows.
  function upload() { if (!pending) pending = requestAnimationFrame(uploadOne); }
  function uploadOne() {
    pending = 0;
    if (lost || !gl) return;
    const job = queue.shift();
    const into = next || tex, size = next ? nextTile : tile;
    if (job && into) {
      scratch = scratch || document.createElement("canvas");
      scratch.width = scratch.height = size;
      const x = scratch.getContext("2d");
      x.imageSmoothingQuality = "high";
      x.fillStyle = css(mist);
      x.fillRect(0, 0, size, size);
      x.drawImage(job.img, 0, 0, size, size);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, into);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, job.i, size, size, 1, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
      if (!next) { gl.generateMipmap(gl.TEXTURE_2D_ARRAY); onDirty(); }
      else gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    }
    if (queue.length) return upload();
    if (settled < c.images.length) return;                 // more covers still on their way
    if (scratch) { scratch.width = scratch.height = 0; scratch = null; }   // let the scratch canvas go
    if (next) {                                            // the bigger texture holds every cover: draw it from now on
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, next);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      gl.deleteTexture(tex);
      tex = next; tile = nextTile; next = null; nextTile = 0;
      onDirty();
    }
  }

  // ── the still picture ──
  function project(x, y, a, t) {
    const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(t), st = Math.sin(t), r = g.radius;
    const X = x * ca + r * sa, Z0 = -x * sa + r * ca;
    const Y = y * ct - Z0 * st, Z = y * st + Z0 * ct - r, k = g.perspective / (g.perspective - Z);
    return [g.ox + X * k, g.oy + Y * k];
  }
  function still() {
    const ctx = flat, n = c.images.length, hw = g.halfW, hh = g.halfH;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      ctx.fillStyle = css(mist);
      ctx.fillRect(0, 0, 2 * hw, 2 * hh);
      if (stills[i]) ctx.drawImage(stills[i], 0, 0, 2 * hw, 2 * hh);
      if (back) { ctx.globalAlpha = g.fade; ctx.fillStyle = css(fade); ctx.fillRect(0, 0, 2 * hw, 2 * hh); }
      ctx.restore();
    }
  }

  // the canvas: as wide as the block, as tall as the whole tilt needs (ring.js), at the screen's density up to dprMax
  function place() {
    dpr = Math.min(window.devicePixelRatio || 1, g.dprMax);
    canvas.style.cssText = "top:" + (-g.above) + "px;width:" + g.width + "px;height:" + g.height + "px";
    const w = Math.max(1, Math.round(g.width * dpr)), h = Math.max(1, Math.round(g.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    dpr = canvas.width / g.width;
  }

  const view = {
    get webgl() { return !!gl; },
    // the geometry changed (ring.js layout), CSS px; ring.js draws afterwards
    resize(geom) {
      g = geom;
      if (!canvas) return;
      place();
      if (!gl || lost) return;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1i(U.u_n, c.images.length);
      gl.uniform4f(U.u_ring, g.halfW, g.halfH, g.radius, g.perspective);
      gl.uniform4f(U.u_view, g.ox, g.oy, g.width, g.height);
      gl.uniform1f(U.u_corner, Math.min(g.corner, g.halfW, g.halfH));
      gl.uniform4f(U.u_fade, fade[0], fade[1], fade[2], g.fade);
      // the covers' texture: as many pixels as the nearest cover shows, never more than the files have
      const need = Math.min(TILE_MAX, Math.ceil(2 * g.halfW * dpr / TILE_STEP) * TILE_STEP);
      if (!tex) { tex = makeTexture(need); tile = need; queue = []; fetchCovers(); }
      else if (need > Math.max(tile, nextTile)) {
        if (next) gl.deleteTexture(next);
        next = makeTexture(need); nextTile = need; queue = []; fetchCovers();
      }
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    },
    // the pose: turn and tilt in degrees
    draw(turn, tilt) {
      pose[0] = turn * Math.PI / 180;
      pose[1] = tilt * Math.PI / 180;
      if (!g || lost || !canvas) return;
      if (flat) return still();
      if (!gl || !tex) return;
      gl.uniform2f(U.u_pose, pose[0], pose[1]);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 12 * c.images.length);
    },
    // the settings changed (the console's update()): colours, fade, covers; ring.js calls resize() next
    refresh() {
      mist = rgbOf("var(--mist)", root);
      fade = rgbOf(c.backFadeColor, root);
      if (gl && !lost) {                                    // the texture is made again with the new colours or covers
        if (next) gl.deleteTexture(next);
        if (tex) gl.deleteTexture(tex);
        tex = next = null; tile = nextTile = 0;
      }
      if (flat) { stills = []; fetchCovers(); }
    }
  };

  mist = rgbOf("var(--mist)", root);
  fade = rgbOf(c.backFadeColor, root);
  if (!tryGL()) toFlat();
  return canvas && canvas.isConnected ? view : null;
}

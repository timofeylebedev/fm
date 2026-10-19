import{r as e,t}from"./index-RkDTed6O.js";var n={background:`var(--mist)`,density:0,scale:45,dotTop:10,speed:100,tide:20,seed:7,cellPx:2,jitter:30,dotBottom:151,sizeJitter:0,topDensity:0,peakDensity:150,curveStart:11,curveEnd:93,curveExp:76,growWidth:0,edgeSoft:60,colorVar:0,rimDarken:0,glint:0,shimmerTop:0,shimmerBottom:0,tidePeriod:6400,waveLength:259,waveMix:100,crest:0,bpm:116,bands:48,stepped:0,lift:70,kick:8,attack:35,release:15,hold:20,holdFade:20,maxDpr:2},r={background:`var(--purple-light)`,color:`var(--purple)`,accent:`var(--paper)`,reach:36,invert:0,density:0,scale:45,dotTop:119,speed:100,tide:20,seed:7,cellPx:2,jitter:30,dotBottom:151,sizeJitter:0,topDensity:0,peakDensity:110,curveStart:11,curveEnd:120,curveExp:140,growWidth:0,edgeSoft:60,colorVar:0,rimDarken:0,glint:12,shimmerTop:10,shimmerBottom:0,tidePeriod:6400,waveLength:120,waveMix:100,crest:0,bpm:86,bands:40,stepped:0,lift:55,kick:6,attack:35,release:15,spin:8,hold:0,holdFade:20,maxDpr:2},i={cards:{settings:n,shape:`bottom`,hosts:`[data-dots='cards']`},cta:{settings:r,shape:`edge`,hosts:`[data-dots='cta']`}},a=64,o=e=>{let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)},s=e=>{let t=Math.floor(e),n=e-t,r=n*n*(3-2*n);return o(t)*(1-r)+o(t+1)*r},c=(e,t,n)=>Math.min(n,Math.max(t,e)),l=(e,t,n,r)=>c(typeof e==`number`&&isFinite(e)?e:r,t,n);function u(e,t,n,r){let i=l(e.bpm,20,300,116),o=Math.round(l(e.bands,1,a,48)),u=Math.exp(-(r*i/60%1)*5),d=s(n*.12*128/o+t+r*.35),f=s(n*1.7+t*2+r*2.4);return c(-.18+d*.5+f*.7+u*.3*s(n*.3+r+t),0,1)}function d(e,t){e=(e||``).trim();let n=/^var\((--[\w-]+)\)$/.exec(e);n&&(e=getComputedStyle(document.documentElement).getPropertyValue(n[1]).trim());let r=/^#([\da-f]{3}|[\da-f]{6})$/i.exec(e);if(r){let e=r[1];return e.length===3&&(e=e.replace(/./g,`$&$&`)),[0,2,4].map(t=>parseInt(e.slice(t,t+2),16)/255)}if(r=/^rgba?\(([^)]+)\)$/i.exec(e),r){let e=r[1].split(/[\s,/]+/).map(parseFloat);if(e.length>=3)return e.slice(0,3).map(e=>c(e/255,0,1))}return t}var f=e=>e.map(e=>e+(1-e)*.35),p=`#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`,m=`
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 h22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec4 h42(vec2 p) { vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }

// the order in which the dots of the grid appear as the density grows: a shuffled ordered dither
float rankAt(vec2 c) {
ivec2 ic = ivec2(c) + ivec2(4096);
float r = 0.0, w = 0.25;
for (int k = 0; k < 6; k++) {
  int bx = (ic.x >> k) & 1, by = (ic.y >> k) & 1;
  ivec2 blk = ic >> (k + 1);
  int sym = int(h12(vec2(blk) + vec2(float(k) * 17.31, uSeed * 3.7)) * 8.0);
  if ((sym & 1) == 1) bx = 1 - bx;
  if ((sym & 2) == 2) by = 1 - by;
  if ((sym & 4) == 4) { int t = bx; bx = by; by = t; }
  int idx = (bx == by) ? bx : (bx == 1 ? 2 : 3);
  r += float(idx) * w; w *= 0.25;
}
return r + h12(c * 1.37 + uSeed) * w * 4.0;
}`,h=`
uniform vec2 uRes;
uniform float uEdge;     // 0 = dense at the bottom, 1 = dense along the rounded border
uniform float uReach;    // edge: how far in the dots go, px
uniform float uRadius;   // edge: corner radius of the block, px
uniform float uInvert;   // edge: 1 = dense in the middle instead
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec2 place(vec2 p) {
if (uEdge < 0.5) return vec2(clamp(1.0 - p.y / max(uRes.y, 1.0), 0.0, 1.0), p.x / max(uRes.x, 1.0));
vec2 c = uRes * 0.5, d = p - c;
float inside = -sdRoundBox(d, c, min(uRadius, min(c.x, c.y)));       // px from the border, inwards
float f = inside / max(uReach, 1.0);
float y = uInvert > 0.5 ? f : 1.0 - f;                                // goes below 0 deep inside: no dots there
return vec2(y, atan(d.y, d.x) / 6.2831853 + 0.5);
}`,g=`#version 300 es
precision highp float;
precision highp int;
uniform float uSeed; uniform float uCell; uniform float uJit;
layout(location = 0) out vec4 outA;
layout(location = 1) out vec4 outB;
layout(location = 2) out vec4 outC;
${m}
${h}
vec2 bytes(float v) { v = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5); return vec2(floor(v / 256.0), mod(v, 256.0)) / 255.0; }
void main() {
vec2 c = floor(gl_FragCoord.xy) - 1.0, h = h22(c + uSeed * 13.1);
outA = vec4(bytes(rankAt(c)), h);
outB = h42(c + uSeed * 1.7);
vec2 at = place((c + 0.5 + (h - 0.5) * uJit) * uCell);
outC = vec4(bytes((at.x + 2.0) / 4.0), bytes(at.y));               // the first value is kept between -2 (deep inside) and 2
}`,_=e=>`#version 300 es
${e?`#define BAKED`:``}
precision highp float;
precision highp int;
uniform float uTime; uniform float uBeat;
uniform vec3 uBg; uniform vec3 uBase; uniform vec3 uAccent;
uniform float uCell; uniform float uJit; uniform float uDotTop; uniform float uDotBot; uniform float uSizeJit;
uniform float uFloor; uniform float uPeak; uniform float uLo; uniform float uHi; uniform float uExp;
uniform float uGrow; uniform float uSoft; uniform float uPeriod; uniform float uWaveLen; uniform float uWaveMix;
uniform float uCrest; uniform float uShTop; uniform float uShBot; uniform float uGlint; uniform float uColVar; uniform float uRim;
uniform float uSeed; uniform float uDensOff; uniform float uTide;
uniform float uLevels[${a}]; uniform float uBands; uniform float uStepped; uniform float uLift; uniform float uKick;
uniform float uHold; uniform float uHoldFade;
uniform float uSpin;     // edge: how far the columns have travelled round the block, 0…1
uniform vec2 uWaveN;     // edge: whole numbers of waves round the block (so they meet without a seam)
#ifdef BAKED
uniform highp sampler2D uDotsA;   // picture A of the BAKE program above
uniform highp sampler2D uDotsB;   // picture B
uniform highp sampler2D uDotsC;   // picture C
#endif
out vec4 outColor;
${h}

#ifdef BAKED
vec4 dotA(vec2 c) { return texelFetch(uDotsA, ivec2(c) + 1, 0); }
vec4 dotB(vec2 c) { return texelFetch(uDotsB, ivec2(c) + 1, 0); }
vec2 dotPlace(vec2 c, vec2 ctr) {
vec4 k = texelFetch(uDotsC, ivec2(c) + 1, 0);
return vec2((k.x * 65280.0 + k.y * 255.0) / 65535.0 * 4.0 - 2.0, (k.z * 65280.0 + k.w * 255.0) / 65535.0);
}
#else
${m}
vec4 dotA(vec2 c) { return vec4(0.0, 0.0, h22(c + uSeed * 13.1)); }
vec4 dotB(vec2 c) { return h42(c + uSeed * 1.7); }
vec2 dotPlace(vec2 c, vec2 ctr) { return place(ctr); }
#endif

float densityAt(float y) {
float t = smoothstep(uLo, max(uHi, uLo + 1e-3), y);
return uFloor + (uPeak - uFloor) * pow(t, max(uExp, 0.1));
}

float band(float i) {                                        // one column of the track; round the block they wrap
i = uEdge > 0.5 ? mod(i, uBands) : clamp(i, 0.0, uBands - 1.0);
return uLevels[int(i)];
}
// loudness of the track at a point across the block (0…1): sharp columns, or columns melted into each other
float levelAt(float x) {
float f = (uEdge > 0.5 ? fract(x) : clamp(x, 0.0, 0.99999)) * uBands;
float g = f - 0.5, i0 = floor(g);
return mix(mix(band(i0), band(i0 + 1.0), smoothstep(0.0, 1.0, g - i0)), band(floor(f)), uStepped);
}

void main() {
vec2 q = gl_FragCoord.xy;
float soft = uSoft, cell = uCell;
float per = max(uPeriod, 0.1), T = uTime / per;
float swell = sin(6.2831853 * T);

// a pixel far inside the block, where no dot can reach even at the loudest moment: background at once
if (uEdge > 0.5 && uInvert < 0.5) {
  float most = place(q).x + (2.0 * cell + soft) / max(uReach, 1.0) + uDensOff + uTide + uLift + uKick;
  if (densityAt(most) < 0.004) { outColor = vec4(uBg, 1.0); return; }
}

vec2 gi = floor(q / cell);
float kx = 6.2831853 / max(uWaveLen * uRes.y, 1.0);
float maxR = 0.5 * cell * max(uDotTop, uDotBot) * (1.0 + uSizeJit) + soft + 0.5;

vec3 col = uBg;
for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
  vec2 c = gi + vec2(float(i), float(j));
  vec4 ka = dotA(c);
  vec2 h = ka.zw;
  vec2 ctr = (c + 0.5 + (h - 0.5) * uJit) * cell;
  float dist = length(q - ctr);
  if (dist > maxR) continue;

  vec2 at = dotPlace(c, ctr);
  float yT = at.x, ySize = clamp(yT, 0.0, 1.0);
  vec2 xw = uEdge > 0.5 ? 6.2831853 * at.y * uWaveN : vec2(ctr.x * kx, ctr.x * kx * 1.73);
  float roll = 0.65 * sin(xw.x - 6.2831853 * T) + 0.35 * sin(xw.y + 12.5663706 * T + 1.3);
  float wave = mix(swell, roll, uWaveMix);

  float music = uLift * levelAt(at.y + uSpin) + uKick * uBeat;        // the track pushes the dots on
  float d = densityAt(yT + uDensOff + uTide * wave + music);
  if (uHold > 0.0) d = mix(d, max(d, 1.05), smoothstep(1.0 - uHold - uHoldFade, 1.0 - uHold, yT));   // keeps the dense end filled
  if (d < 0.004) continue;

#ifdef BAKED
  float r = (ka.x * 65280.0 + ka.y * 255.0) / 65535.0;                 // the two bytes of picture A: hi * 255 * 256 + lo * 255
#else
  float r = rankAt(c);
#endif
  float w = uGrow * r + 0.004;
  float s = smoothstep(r - w, r + w, d);
  if (s < 0.02) continue;

  vec4 h2 = dotB(c);
  float rad = 0.5 * cell * mix(uDotTop, uDotBot, ySize) * (1.0 + uSizeJit * (h2.x * 2.0 - 1.0)) * s;
  float a = 1.0 - smoothstep(rad - soft, rad + soft, dist);
  if (a <= 0.0) continue;

  float pick = floor(h2.y * 3.0);
  float sp = per * (pick < 1.0 ? 0.25 : (pick < 2.0 ? 0.33333333 : 0.5));
  float sv = sin(6.2831853 * (uTime / max(sp, 0.05) + h2.z));
  float amp = mix(uShTop, uShBot, smoothstep(0.4, 0.9, ySize));
  float qd = clamp(dist / max(rad, 1e-3), 0.0, 1.0);
  vec3 dc = uBase * (1.0 + uColVar * (h2.w * 2.0 - 1.0)) * (1.0 - uRim * qd * qd) * (1.0 + amp * sv);
  dc = mix(dc, uAccent, uGlint * pow(max(sv, 0.0), 6.0));
  float bandLit = smoothstep(0.05, 0.4, d) * (1.0 - smoothstep(0.65, 1.1, d));
  float lit = uCrest * smoothstep(0.3, 1.0, wave) * bandLit;
  dc = mix(dc, uAccent * 1.3, lit) * (1.0 + 0.4 * lit);
  col = mix(col, dc, a);
}
outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,v=[],y={paused:!1};function b(e){let t=(t,n)=>{let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(e.getShaderInfoLog(r));return r},n=n=>{let r=e.createProgram();if(e.attachShader(r,t(e.VERTEX_SHADER,p)),e.attachShader(r,t(e.FRAGMENT_SHADER,n)),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw Error(e.getProgramInfoLog(r));let i={};return{prog:r,u:t=>t in i?i[t]:i[t]=e.getUniformLocation(r,t)}},r={baked:null,plain:null,bake:null,main:null,tex:[],fb:null,key:``};e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);try{r.bake=n(g),r.baked=n(_(!0)),r.tex=[e.createTexture(),e.createTexture(),e.createTexture()],r.tex.forEach(t=>{e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}),r.fb=e.createFramebuffer(),r.main=r.baked}catch(e){console.warn(`stipple: the dots are worked out on every frame instead`,e),r.baked=null}return r.usePlain=()=>{r.plain||=n(_(!1)),r.main=r.plain,r.baked=null},r.main||r.usePlain(),e.useProgram(r.main.prog),r}function x(e,t){if(e.fmStipple)return;let n=document.createElement(`canvas`);n.className=`dots`,n.setAttribute(`aria-hidden`,`true`),e.prepend(n);let r=n.getContext(`webgl2`,{alpha:!1,antialias:!1,depth:!1,premultipliedAlpha:!1}),i=t=>{t&&console.warn(`stipple:`,t),n.remove(),e.classList.add(`no-dots`)};if(!r)return i();let o=getComputedStyle(e),s=t.settings,c=d(o.getPropertyValue(`--dots`),null),p={host:e,canvas:n,gl:r,set:t,base:d(s.color,c||[.96,.43,0]),accent:d(s.accent,f(c||[.96,.43,0])),seed:v.length*37.3,levels:new Float32Array(a),visible:!1,dpr:1,radius:0,cell:2,music:3,tide:0,spin:0};for(let e=0;e<a;e++)p.levels[e]=u(s,p.seed,e,0);try{p.g=b(r)}catch(e){return i(e)}p.resize=()=>{p.dpr=Math.min(window.devicePixelRatio||1,l(p.set.settings.maxDpr,.5,3,2));let t=Math.max(1,Math.round(e.clientWidth*p.dpr)),r=Math.max(1,Math.round(e.clientHeight*p.dpr));(n.width!==t||n.height!==r)&&(n.width=t,n.height=r),p.radius=(parseFloat(getComputedStyle(e).borderTopLeftRadius)||0)*p.dpr},p.bake=()=>{let e=p.g;if(!e.baked)return;let t=l(p.set.settings.seed,0,999,7),i=Math.ceil(n.width/p.cell)+3,a=Math.ceil(n.height/p.cell)+3,o=p.set.settings,s=p.set.shape===`edge`,c=l(o.reach,1,100,34)/100*Math.min(n.width,n.height),u=l(o.jitter,0,100,30)/100,d=[n.width,n.height,p.cell,t,u,s,c,p.radius,!!o.invert].join(`/`);if(d===e.key)return;let f=r.getParameter(r.MAX_TEXTURE_SIZE);if(i>f||a>f){e.usePlain();return}if(e.tex.forEach(e=>{r.bindTexture(r.TEXTURE_2D,e),r.texImage2D(r.TEXTURE_2D,0,r.RGBA8,i,a,0,r.RGBA,r.UNSIGNED_BYTE,null)}),r.bindFramebuffer(r.FRAMEBUFFER,e.fb),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,e.tex[0],0),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT1,r.TEXTURE_2D,e.tex[1],0),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT2,r.TEXTURE_2D,e.tex[2],0),r.drawBuffers([r.COLOR_ATTACHMENT0,r.COLOR_ATTACHMENT1,r.COLOR_ATTACHMENT2]),r.checkFramebufferStatus(r.FRAMEBUFFER)!==r.FRAMEBUFFER_COMPLETE){r.bindFramebuffer(r.FRAMEBUFFER,null),e.usePlain();return}let m=e.bake.u;r.useProgram(e.bake.prog),r.uniform1f(m(`uSeed`),t),r.uniform1f(m(`uCell`),p.cell),r.uniform1f(m(`uJit`),u),r.uniform2f(m(`uRes`),n.width,n.height),r.uniform1f(m(`uEdge`),+!!s),r.uniform1f(m(`uReach`),c),r.uniform1f(m(`uRadius`),p.radius),r.uniform1f(m(`uInvert`),+!!o.invert),r.viewport(0,0,i,a),r.drawArrays(r.TRIANGLES,0,3),r.bindFramebuffer(r.FRAMEBUFFER,null),r.useProgram(e.main.prog),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,e.tex[0]),r.activeTexture(r.TEXTURE1),r.bindTexture(r.TEXTURE_2D,e.tex[1]),r.activeTexture(r.TEXTURE2),r.bindTexture(r.TEXTURE_2D,e.tex[2]),e.key=d},p.setup=()=>{let e=p.set.settings,t=n.width,i=n.height,o=p.set.shape===`edge`;p.cell=Math.max(l(e.cellPx,.5,40,2)*l(e.scale,10,300,100)/100*p.dpr,1.5),p.bake();let s=p.g,c=s.main.u;r.useProgram(s.main.prog);let u=Math.min(t,i),f=l(e.waveLength,20,400,100)/100,m=2*(t+i)-(8-2*Math.PI)*Math.min(p.radius,u/2),h=Math.max(1,Math.round(m/(f*u)));s.baked&&(r.uniform1i(c(`uDotsA`),0),r.uniform1i(c(`uDotsB`),1),r.uniform1i(c(`uDotsC`),2)),r.uniform2f(c(`uRes`),t,i),r.uniform3fv(c(`uBg`),d(e.background,[.97,.97,.97])),r.uniform3fv(c(`uBase`),e.color?d(e.color,p.base):p.base),r.uniform3fv(c(`uAccent`),e.accent?d(e.accent,p.accent):p.accent),r.uniform1f(c(`uCell`),p.cell),r.uniform1f(c(`uJit`),l(e.jitter,0,100,30)/100),r.uniform1f(c(`uDotTop`),l(e.dotTop,10,200,33)/100),r.uniform1f(c(`uDotBot`),l(e.dotBottom,10,200,145)/100),r.uniform1f(c(`uSizeJit`),l(e.sizeJitter,0,50,0)/100),r.uniform1f(c(`uFloor`),l(e.topDensity,0,300,0)/1e3),r.uniform1f(c(`uPeak`),l(e.peakDensity,50,150,150)/100),r.uniform1f(c(`uLo`),l(e.curveStart,-50,100,-50)/100),r.uniform1f(c(`uHi`),l(e.curveEnd,0,150,150)/100),r.uniform1f(c(`uExp`),l(e.curveExp,20,400,84)/100),r.uniform1f(c(`uGrow`),l(e.growWidth,0,50,0)/100),r.uniform1f(c(`uSoft`),l(e.edgeSoft,10,300,60)/100),r.uniform1f(c(`uPeriod`),l(e.tidePeriod,1e3,3e4,6400)/1e3),r.uniform1f(c(`uWaveLen`),f),r.uniform1f(c(`uWaveMix`),l(e.waveMix,0,100,100)/100),r.uniform1f(c(`uCrest`),l(e.crest,0,100,0)/100),r.uniform1f(c(`uShTop`),l(e.shimmerTop,0,50,0)/100),r.uniform1f(c(`uShBot`),l(e.shimmerBottom,0,50,0)/100),r.uniform1f(c(`uGlint`),l(e.glint,0,100,0)/100),r.uniform1f(c(`uColVar`),l(e.colorVar,0,50,0)/100),r.uniform1f(c(`uRim`),l(e.rimDarken,0,80,0)/100),r.uniform1f(c(`uSeed`),l(e.seed,0,999,7)),r.uniform1f(c(`uDensOff`),(l(e.density,0,100,0)-50)/100*.5),r.uniform1f(c(`uTide`),l(e.tide,0,20,20)/100),r.uniform1f(c(`uBands`),Math.round(l(e.bands,1,a,48))),r.uniform1f(c(`uStepped`),l(e.stepped,0,100,0)/100),r.uniform1f(c(`uLift`),l(e.lift,0,200,50)/100),r.uniform1f(c(`uKick`),l(e.kick,0,100,6)/100),r.uniform1f(c(`uHold`),l(e.hold,0,100,0)/100),r.uniform1f(c(`uHoldFade`),l(e.holdFade,1,100,20)/100),r.uniform1f(c(`uEdge`),+!!o),r.uniform1f(c(`uReach`),l(e.reach,1,100,34)/100*u),r.uniform1f(c(`uRadius`),p.radius),r.uniform1f(c(`uInvert`),+!!e.invert),r.uniform2f(c(`uWaveN`),h,Math.max(1,Math.round(h*1.73)))},p.draw=()=>{let e=p.set.settings,t=p.g.main.u,i=p.music*l(e.bpm,20,300,116)/60%1;r.viewport(0,0,n.width,n.height),r.uniform1f(t(`uTime`),p.tide),r.uniform1f(t(`uBeat`),Math.exp(-i*6)),r.uniform1fv(t(`uLevels`),p.levels),r.uniform1f(t(`uSpin`),p.spin),r.drawArrays(r.TRIANGLES,0,3)},p.step=e=>{let t=p.set.settings,n=Math.round(l(t.bands,1,a,48));p.music+=e,p.tide=(p.tide+e*l(t.speed,0,100,100)/50)%3600,p.spin=(p.spin+e*l(t.spin,-360,360,0)/360)%1;let r=1-(1-l(t.attack,1,100,35)/100)**(e*60),i=1-(1-l(t.release,1,100,15)/100)**(e*60);for(let e=0;e<n;e++){let n=u(t,p.seed,e,p.music);p.levels[e]+=(n-p.levels[e])*(n>p.levels[e]?r:i)}},p.redraw=()=>{p.lost||(p.resize(),p.setup(),p.draw())},n.addEventListener(`webglcontextlost`,t=>{t.preventDefault(),p.lost=!0,e.classList.add(`no-dots`)}),n.addEventListener(`webglcontextrestored`,()=>{try{p.g=b(r)}catch(e){console.warn(`stipple:`,e);return}p.lost=!1,e.classList.remove(`no-dots`),p.redraw(),T()}),new ResizeObserver(p.redraw).observe(e),new IntersectionObserver(e=>{p.visible=e[e.length-1].isIntersecting,T()},{rootMargin:`100px 0px`}).observe(e),e.fmStipple=p,v.push(p),p.redraw()}var S=0,C=0;function w(e){if(t.frame(e),!t.due(C,e)){S=requestAnimationFrame(w);return}let n=C?Math.min((e-C)/1e3,.1):.016;C=e;let r=!1;v.forEach(e=>{e.visible&&!e.lost&&(r=!0,e.step(n),e.draw())}),S=r&&!document.hidden&&!y.paused?requestAnimationFrame(w):0}function T(){S||e||document.hidden||y.paused||v.some(e=>e.visible&&!e.lost)&&(C=0,S=requestAnimationFrame(w))}document.addEventListener(`visibilitychange`,T);function E(e){document.querySelectorAll(i[e].hosts).forEach(t=>{try{x(t,i[e])}catch(e){console.warn(`stipple:`,e)}})}window.fmStipple=Object.assign(y,{settings:n,cta:r,sets:i,update(){v.forEach(e=>e.redraw()),T()},instances:v});export{E as initDots};
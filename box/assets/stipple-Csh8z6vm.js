import{i as e,r as t,t as n}from"./index-DOLDcjL7.js";var r={background:`var(--mist)`,density:0,scale:45,dotTop:10,speed:100,tide:20,seed:7,cellPx:2,jitter:30,dotBottom:151,sizeJitter:0,topDensity:0,peakDensity:150,curveStart:11,curveEnd:93,curveExp:76,growWidth:0,edgeSoft:60,colorVar:0,rimDarken:0,glint:0,shimmerTop:0,shimmerBottom:0,tidePeriod:6400,waveLength:259,waveMix:100,crest:0,bpm:116,bands:48,stepped:0,lift:70,kick:8,attack:35,release:15,hold:20,holdFade:20,maxDpr:2},i={background:`var(--purple-light)`,color:`var(--purple)`,accent:`var(--paper)`,reach:36,invert:0,density:0,scale:45,dotTop:119,speed:100,tide:20,seed:7,cellPx:2,jitter:30,dotBottom:151,sizeJitter:0,topDensity:0,peakDensity:110,curveStart:11,curveEnd:120,curveExp:140,growWidth:0,edgeSoft:60,colorVar:0,rimDarken:0,glint:12,shimmerTop:10,shimmerBottom:0,tidePeriod:6400,waveLength:120,waveMix:100,crest:0,bpm:86,bands:40,stepped:0,lift:55,kick:6,attack:35,release:15,spin:8,hold:0,holdFade:20,maxDpr:2},a={cards:{settings:r,shape:`bottom`,hosts:`[data-dots='cards']`},cta:{settings:i,shape:`edge`,hosts:`[data-dots='cta']`}},o=64,s=e=>{let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)},c=e=>{let t=Math.floor(e),n=e-t,r=n*n*(3-2*n);return s(t)*(1-r)+s(t+1)*r},l=(e,t,n)=>Math.min(n,Math.max(t,e)),u=(e,t,n,r)=>l(typeof e==`number`&&isFinite(e)?e:r,t,n);function d(e,t,n,r){let i=u(e.bpm,20,300,116),a=Math.round(u(e.bands,1,o,48)),s=Math.exp(-(r*i/60%1)*5),d=c(n*.12*128/a+t+r*.35),f=c(n*1.7+t*2+r*2.4);return l(-.18+d*.5+f*.7+s*.3*c(n*.3+r+t),0,1)}function f(e,t){e=(e||``).trim();let n=/^var\((--[\w-]+)\)$/.exec(e);n&&(e=getComputedStyle(document.documentElement).getPropertyValue(n[1]).trim());let r=/^#([\da-f]{3}|[\da-f]{6})$/i.exec(e);if(r){let e=r[1];return e.length===3&&(e=e.replace(/./g,`$&$&`)),[0,2,4].map(t=>parseInt(e.slice(t,t+2),16)/255)}if(r=/^rgba?\(([^)]+)\)$/i.exec(e),r){let e=r[1].split(/[\s,/]+/).map(parseFloat);if(e.length>=3)return e.slice(0,3).map(e=>l(e/255,0,1))}return t}var p=e=>e.map(e=>e+(1-e)*.35),m=`#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`,h=`
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
}`,g=`
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
}`,_=`#version 300 es
precision highp float;
precision highp int;
uniform float uSeed; uniform float uCell; uniform float uJit;
layout(location = 0) out vec4 outA;
layout(location = 1) out vec4 outB;
layout(location = 2) out vec4 outC;
${h}
${g}
vec2 bytes(float v) { v = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5); return vec2(floor(v / 256.0), mod(v, 256.0)) / 255.0; }
void main() {
vec2 c = floor(gl_FragCoord.xy) - 1.0, h = h22(c + uSeed * 13.1);
outA = vec4(bytes(rankAt(c)), h);
outB = h42(c + uSeed * 1.7);
vec2 at = place((c + 0.5 + (h - 0.5) * uJit) * uCell);
outC = vec4(bytes((at.x + 2.0) / 4.0), bytes(at.y));               // the first value is kept between -2 (deep inside) and 2
}`,v=e=>`#version 300 es
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
uniform float uLevels[${o}]; uniform float uBands; uniform float uStepped; uniform float uLift; uniform float uKick;
uniform float uHold; uniform float uHoldFade;
uniform float uSpin;     // edge: how far the columns have travelled round the block, 0…1
uniform vec2 uWaveN;     // edge: whole numbers of waves round the block (so they meet without a seam)
#ifdef BAKED
uniform highp sampler2D uDotsA;   // picture A of the BAKE program above
uniform highp sampler2D uDotsB;   // picture B
uniform highp sampler2D uDotsC;   // picture C
#endif
out vec4 outColor;
${g}

#ifdef BAKED
vec4 dotA(vec2 c) { return texelFetch(uDotsA, ivec2(c) + 1, 0); }
vec4 dotB(vec2 c) { return texelFetch(uDotsB, ivec2(c) + 1, 0); }
vec2 dotPlace(vec2 c, vec2 ctr) {
vec4 k = texelFetch(uDotsC, ivec2(c) + 1, 0);
return vec2((k.x * 65280.0 + k.y * 255.0) / 65535.0 * 4.0 - 2.0, (k.z * 65280.0 + k.w * 255.0) / 65535.0);
}
#else
${h}
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
}`,y=[],b={paused:!1};function x(e){let t=(t,n)=>{let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(e.getShaderInfoLog(r));return r},n=n=>{let r=e.createProgram();if(e.attachShader(r,t(e.VERTEX_SHADER,m)),e.attachShader(r,t(e.FRAGMENT_SHADER,n)),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))throw Error(e.getProgramInfoLog(r));let i={};return{prog:r,u:t=>t in i?i[t]:i[t]=e.getUniformLocation(r,t)}},r={baked:null,plain:null,bake:null,main:null,tex:[],fb:null,key:``};e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);try{r.bake=n(_),r.baked=n(v(!0)),r.tex=[e.createTexture(),e.createTexture(),e.createTexture()],r.tex.forEach(t=>{e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}),r.fb=e.createFramebuffer(),r.main=r.baked}catch(e){console.warn(`stipple: the dots are worked out on every frame instead`,e),r.baked=null}return r.usePlain=()=>{r.plain||=n(v(!1)),r.main=r.plain,r.baked=null},r.main||r.usePlain(),e.useProgram(r.main.prog),r}function S(t,n){if(t.fmStipple)return;let r=document.createElement(`canvas`);r.className=`dots`,r.setAttribute(`aria-hidden`,`true`),t.prepend(r);let i=r.getContext(`webgl2`,{alpha:!1,antialias:!1,depth:!1,premultipliedAlpha:!1}),a=e=>{e&&console.warn(`stipple:`,e),r.remove(),t.classList.add(`no-dots`)};if(!i)return a();let s=getComputedStyle(t),c=n.settings,l=f(s.getPropertyValue(`--dots`),null),m={host:t,canvas:r,gl:i,set:n,base:f(c.color,l||[.96,.43,0]),accent:f(c.accent,p(l||[.96,.43,0])),seed:y.length*37.3,levels:new Float32Array(o),visible:!1,dpr:1,radius:0,cell:2,music:3,tide:0,spin:0};for(let e=0;e<o;e++)m.levels[e]=d(c,m.seed,e,0);try{m.g=x(i)}catch(e){return a(e)}m.resize=()=>{m.dpr=Math.min(window.devicePixelRatio||1,u(m.set.settings.maxDpr,.5,3,2));let e=Math.max(1,Math.round(t.clientWidth*m.dpr)),n=Math.max(1,Math.round(t.clientHeight*m.dpr));(r.width!==e||r.height!==n)&&(r.width=e,r.height=n),m.radius=(parseFloat(getComputedStyle(t).borderTopLeftRadius)||0)*m.dpr},m.bake=()=>{let e=m.g;if(!e.baked)return;let t=u(m.set.settings.seed,0,999,7),n=Math.ceil(r.width/m.cell)+3,a=Math.ceil(r.height/m.cell)+3,o=m.set.settings,s=m.set.shape===`edge`,c=u(o.reach,1,100,34)/100*Math.min(r.width,r.height),l=u(o.jitter,0,100,30)/100,d=[r.width,r.height,m.cell,t,l,s,c,m.radius,!!o.invert].join(`/`);if(d===e.key)return;let f=i.getParameter(i.MAX_TEXTURE_SIZE);if(n>f||a>f){e.usePlain();return}if(e.tex.forEach(e=>{i.bindTexture(i.TEXTURE_2D,e),i.texImage2D(i.TEXTURE_2D,0,i.RGBA8,n,a,0,i.RGBA,i.UNSIGNED_BYTE,null)}),i.bindFramebuffer(i.FRAMEBUFFER,e.fb),i.framebufferTexture2D(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,e.tex[0],0),i.framebufferTexture2D(i.FRAMEBUFFER,i.COLOR_ATTACHMENT1,i.TEXTURE_2D,e.tex[1],0),i.framebufferTexture2D(i.FRAMEBUFFER,i.COLOR_ATTACHMENT2,i.TEXTURE_2D,e.tex[2],0),i.drawBuffers([i.COLOR_ATTACHMENT0,i.COLOR_ATTACHMENT1,i.COLOR_ATTACHMENT2]),i.checkFramebufferStatus(i.FRAMEBUFFER)!==i.FRAMEBUFFER_COMPLETE){i.bindFramebuffer(i.FRAMEBUFFER,null),e.usePlain();return}let p=e.bake.u;i.useProgram(e.bake.prog),i.uniform1f(p(`uSeed`),t),i.uniform1f(p(`uCell`),m.cell),i.uniform1f(p(`uJit`),l),i.uniform2f(p(`uRes`),r.width,r.height),i.uniform1f(p(`uEdge`),+!!s),i.uniform1f(p(`uReach`),c),i.uniform1f(p(`uRadius`),m.radius),i.uniform1f(p(`uInvert`),+!!o.invert),i.viewport(0,0,n,a),i.drawArrays(i.TRIANGLES,0,3),i.bindFramebuffer(i.FRAMEBUFFER,null),i.useProgram(e.main.prog),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,e.tex[0]),i.activeTexture(i.TEXTURE1),i.bindTexture(i.TEXTURE_2D,e.tex[1]),i.activeTexture(i.TEXTURE2),i.bindTexture(i.TEXTURE_2D,e.tex[2]),e.key=d},m.setup=()=>{let e=m.set.settings,t=r.width,n=r.height,a=m.set.shape===`edge`;m.cell=Math.max(u(e.cellPx,.5,40,2)*u(e.scale,10,300,100)/100*m.dpr,1.5),m.bake();let s=m.g,c=s.main.u;i.useProgram(s.main.prog);let l=Math.min(t,n),d=u(e.waveLength,20,400,100)/100,p=2*(t+n)-(8-2*Math.PI)*Math.min(m.radius,l/2),h=Math.max(1,Math.round(p/(d*l)));s.baked&&(i.uniform1i(c(`uDotsA`),0),i.uniform1i(c(`uDotsB`),1),i.uniform1i(c(`uDotsC`),2)),i.uniform2f(c(`uRes`),t,n),i.uniform3fv(c(`uBg`),f(e.background,[.97,.97,.97])),i.uniform3fv(c(`uBase`),e.color?f(e.color,m.base):m.base),i.uniform3fv(c(`uAccent`),e.accent?f(e.accent,m.accent):m.accent),i.uniform1f(c(`uCell`),m.cell),i.uniform1f(c(`uJit`),u(e.jitter,0,100,30)/100),i.uniform1f(c(`uDotTop`),u(e.dotTop,10,200,33)/100),i.uniform1f(c(`uDotBot`),u(e.dotBottom,10,200,145)/100),i.uniform1f(c(`uSizeJit`),u(e.sizeJitter,0,50,0)/100),i.uniform1f(c(`uFloor`),u(e.topDensity,0,300,0)/1e3),i.uniform1f(c(`uPeak`),u(e.peakDensity,50,150,150)/100),i.uniform1f(c(`uLo`),u(e.curveStart,-50,100,-50)/100),i.uniform1f(c(`uHi`),u(e.curveEnd,0,150,150)/100),i.uniform1f(c(`uExp`),u(e.curveExp,20,400,84)/100),i.uniform1f(c(`uGrow`),u(e.growWidth,0,50,0)/100),i.uniform1f(c(`uSoft`),u(e.edgeSoft,10,300,60)/100),i.uniform1f(c(`uPeriod`),u(e.tidePeriod,1e3,3e4,6400)/1e3),i.uniform1f(c(`uWaveLen`),d),i.uniform1f(c(`uWaveMix`),u(e.waveMix,0,100,100)/100),i.uniform1f(c(`uCrest`),u(e.crest,0,100,0)/100),i.uniform1f(c(`uShTop`),u(e.shimmerTop,0,50,0)/100),i.uniform1f(c(`uShBot`),u(e.shimmerBottom,0,50,0)/100),i.uniform1f(c(`uGlint`),u(e.glint,0,100,0)/100),i.uniform1f(c(`uColVar`),u(e.colorVar,0,50,0)/100),i.uniform1f(c(`uRim`),u(e.rimDarken,0,80,0)/100),i.uniform1f(c(`uSeed`),u(e.seed,0,999,7)),i.uniform1f(c(`uDensOff`),(u(e.density,0,100,0)-50)/100*.5),i.uniform1f(c(`uTide`),u(e.tide,0,20,20)/100),i.uniform1f(c(`uBands`),Math.round(u(e.bands,1,o,48))),i.uniform1f(c(`uStepped`),u(e.stepped,0,100,0)/100),i.uniform1f(c(`uLift`),u(e.lift,0,200,50)/100),i.uniform1f(c(`uKick`),u(e.kick,0,100,6)/100),i.uniform1f(c(`uHold`),u(e.hold,0,100,0)/100),i.uniform1f(c(`uHoldFade`),u(e.holdFade,1,100,20)/100),i.uniform1f(c(`uEdge`),+!!a),i.uniform1f(c(`uReach`),u(e.reach,1,100,34)/100*l),i.uniform1f(c(`uRadius`),m.radius),i.uniform1f(c(`uInvert`),+!!e.invert),i.uniform2f(c(`uWaveN`),h,Math.max(1,Math.round(h*1.73)))},m.draw=()=>{let e=m.set.settings,t=m.g.main.u,n=m.music*u(e.bpm,20,300,116)/60%1;i.viewport(0,0,r.width,r.height),i.uniform1f(t(`uTime`),m.tide),i.uniform1f(t(`uBeat`),Math.exp(-n*6)),i.uniform1fv(t(`uLevels`),m.levels),i.uniform1f(t(`uSpin`),m.spin),i.drawArrays(i.TRIANGLES,0,3)},m.step=e=>{let t=m.set.settings,n=Math.round(u(t.bands,1,o,48));m.music+=e,m.tide=(m.tide+e*u(t.speed,0,100,100)/50)%3600,m.spin=(m.spin+e*u(t.spin,-360,360,0)/360)%1;let r=1-(1-u(t.attack,1,100,35)/100)**(e*60),i=1-(1-u(t.release,1,100,15)/100)**(e*60);for(let e=0;e<n;e++){let n=d(t,m.seed,e,m.music);m.levels[e]+=(n-m.levels[e])*(n>m.levels[e]?r:i)}},m.redraw=()=>{m.lost||(m.resize(),m.setup(),m.draw())},r.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),m.lost=!0,t.classList.add(`no-dots`)}),r.addEventListener(`webglcontextrestored`,()=>{try{m.g=x(i)}catch(e){console.warn(`stipple:`,e);return}m.lost=!1,t.classList.remove(`no-dots`),m.redraw(),E()}),new ResizeObserver(m.redraw).observe(t),new IntersectionObserver(e=>{m.visible=e[e.length-1].isIntersecting,E()},{root:e,rootMargin:`100px 0px`}).observe(t),t.fmStipple=m,y.push(m),m.redraw()}var C=0,w=0;function T(e){if(n.frame(e),!n.due(w,e)){C=requestAnimationFrame(T);return}let t=w?Math.min((e-w)/1e3,.1):.016;w=e;let r=!1;y.forEach(e=>{e.visible&&!e.lost&&(r=!0,e.step(t),e.draw())}),C=r&&!document.hidden&&!b.paused?requestAnimationFrame(T):0}function E(){C||t||document.hidden||b.paused||y.some(e=>e.visible&&!e.lost)&&(w=0,C=requestAnimationFrame(T))}document.addEventListener(`visibilitychange`,E);function D(e){document.querySelectorAll(a[e].hosts).forEach(t=>{try{S(t,a[e])}catch(e){console.warn(`stipple:`,e)}})}window.fmStipple=Object.assign(b,{settings:r,cta:i,sets:a,update(){y.forEach(e=>e.redraw()),E()},instances:y});export{D as initDots};
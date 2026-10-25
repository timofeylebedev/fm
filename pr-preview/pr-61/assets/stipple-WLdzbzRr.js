import{g as e,p as t,r as n}from"./motion-B2ebSGG4.js";import{t as r}from"./pace-Dybq7kZ_.js";var i={puff:580,puffs:2,puffW:5,curl:5,calm:195,follow:470,whip:400,gravity:1500,fallDrag:80,fallVar:100,cushion:4,settle:210,thermals:99,amount:14e3,core:48,coreShare:100,reach:60,falloff:900,clumps:40,clumpScale:670,ragged:102,ragScale:100,ragKick:400,wave:35,waveScale:240,waveSpeed:200,waveTravel:12,waveIrreg:100,sway:0,swayScale:100,churn:13,life:2,sizeMin:.6,sizeMax:1,skew:260,sizeEdge:120,stars:0,starSize:260,streak:16,thin:500,opacity:100,twinkle:10,flash:0,glint:0,lens:100,dof:0,bpm:83,bar:4,accent:245,groove:83,bands:50,lift:30,attack:80,release:64,cascade:28,arrH:30,arrSpeed:100,arrSpread:0,arrLump:170,arrLumpSize:100,touch:1,touchR:100,sweep:10,tap:800,invAmount:50,invOpacity:45,invClear:100,dust:`var(--paper)`,maxDpr:2},a=Object.assign({},i,{unit:36.5,core:70,reach:150,bands:4,spin:6,srcW:40,srcH:30,taper:0,srcY:0,arrLump:100,invAmount:100,invOpacity:25,invClear:75,quietPad:60,dim:1,dimColor:`var(--purple)`,dimAmount:89,dimW:80,dimH:80,dimSoft:100,dimY:0,background:`var(--purple)`});delete a.cascade;var o={cards:{settings:i,shape:`bottom`,hosts:`[data-dots='cards']`},cta:{settings:a,shape:`middle`,hosts:`[data-dots='cta']`}},s={level:/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||navigator.maxTouchPoints>1&&/Mac/.test(navigator.platform||``)?2:1,auto:!0,scale4:.75,keep3:.75,budget3:12e4,stepAt:0,lastWork:0},c=1024,l=1/60,u=3e5,d=`
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec2 uRes;
uniform float uTime, uShape, uRadius, uRef, uEdgeLen, uSeed, uPx;
uniform vec4 uInner;   // the middle body (uShape 1): centre x, y (px), width / height, pointedness (2 = oval, 1 = lens)
uniform float uColPx, uCols, uSpin;
uniform sampler2D uLevelTex;
uniform float uReach, uFalloff, uClumps, uClumpScale, uChurn;
uniform float uWave, uWaveScale, uWaveSpeed, uWaveTravel, uWaveIrreg, uLift, uCore, uCoreShare;
uniform float uRagged, uRagScale, uRagKick, uBeatT, uBeatN, uLens;

// PCG hash (Jarzynski & Olano, JCGT 2020, MIT): bit-exact on every GPU
uvec4 pcg4d(uvec4 v){
  v = v*1664525u + 1013904223u;
  v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z;
  v ^= v >> 16u;
  v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z;
  return v;
}
vec4 rand4(float id, float gen, float salt){
  return vec4(pcg4d(uvec4(uint(id), uint(max(gen, 0.0)), uint(salt), uint(uSeed))) >> 8u)*(1.0/16777216.0);
}

// 3D simplex noise: Ashima Arts / Stefan Gustavson (MIT)
vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0) + 1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_*D.wyz - D.xzx;
  vec4 j = p - 49.0*floor(p*ns.z*ns.z);
  vec4 x_ = floor(j*ns.z);
  vec4 y_ = floor(j - 7.0*x_);
  vec4 x = x_*ns.x + ns.yyyy;
  vec4 y = y_*ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m*m;
  return 42.0*dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
// px from the card's rounded border, inwards
float insideAt(vec2 p){ vec2 c = uRes*0.5; return -sdRoundBox(p - c, c, min(uRadius, min(c.x, c.y))); }
// from the middle: how far the body reaches in the direction d, compared with straight up (1)
float shapeS(vec2 d){
  float p = uInner.w;
  return 1.0/pow(pow(abs(d.x)/uInner.z, p) + pow(abs(d.y), p), 1.0/p);
}
// a speck's own place on the dense side (u: px along it): the point b it rises from and the way d it rises
void homeAt(float u, out vec2 b, out vec2 d){
  if (uShape < 0.5) { b = vec2(u, 0.0); d = vec2(0.0, 1.0); }
  else { float th = u/uEdgeLen*6.2831853; b = uInner.xy; d = vec2(cos(th), sin(th)); }   // from the middle, outwards
}
// the music: columns of a fixed width along the dense side (all the way round the middle body)
float colAt(float i){ i = uShape > 0.5 ? mod(i, uCols) : clamp(i, 0.0, uCols - 1.0); return texelFetch(uLevelTex, ivec2(int(i), 0), 0).r; }
float levelAt(float u){
  float f = u/uColPx + (uShape > 0.5 ? uSpin*uCols : 0.0);
  float g = f - 0.5, i0 = floor(g);
  return mix(colAt(i0), colAt(i0 + 1.0), smoothstep(0.0, 1.0, g - i0));
}
// a noise along the dense side: round the middle body sampled on a circle, so it closes without a seam
float edgeNoise(float u, float scale, float travel, float t, float salt){
  if (uShape < 0.5) {
    float x = u/uRef*scale - travel;
    return 0.65*snoise(vec3(x, salt, t)) + 0.35*snoise(vec3(x*2.3, salt + 5.1, t*1.4));
  }
  float R = uEdgeLen/uRef*scale/6.2831853;
  float th = u/uEdgeLen*6.2831853 - travel/max(R, 0.01);
  vec2 c = vec2(cos(th), sin(th))*R;
  return 0.65*snoise(vec3(c + salt, t)) + 0.35*snoise(vec3(c*2.3 + salt + 5.1, t*1.4));
}
// one octave along the edge; shift moves it sideways (in its own noise units)
float edge1(float u, float scale, float shift, float t, float salt){
  if (uShape < 0.5) return snoise(vec3(u/uRef*scale - shift, salt, t));
  float R = uEdgeLen/uRef*scale/6.2831853;
  float th = u/uEdgeLen*6.2831853 - shift/max(R, 0.01);
  return snoise(vec3(vec2(cos(th), sin(th))*R + salt, t));
}
// the slow wave. Irregular: three octaves at uneven ratios, each travelling at its own speed (one against the others),
// a slow warp that stretches and squeezes them, a slow envelope that leaves calm stretches between tall ones, and
// crests sharper than the troughs, so the shape never visibly repeats
float waveNoise(float u){
  float t = uTime*uWaveSpeed, tr = uTime*uWaveTravel, q = uWaveIrreg;
  float warp = edge1(u, uWaveScale*0.31, tr*0.4, t*0.35, 31.0)*1.4*q;
  float a = edge1(u, uWaveScale, tr + warp, t, 1.7);
  float b = edge1(u, uWaveScale*2.37, -tr*0.55 + warp*1.6, t*1.41, 9.1);
  float c = edge1(u, uWaveScale*5.13, tr*1.7, t*2.03, 17.3);
  float n = 0.62*a + mix(0.3, 0.38, q)*b + mix(0.0, 0.17, q)*c;
  float env = 0.5 + 0.5*edge1(u, uWaveScale*0.17, tr*0.2, t*0.21, 44.0);
  n *= mix(1.0, 0.2 + 1.6*env, q);
  return n > 0.0 ? n*(1.0 + 0.7*q*n) : n*(1.0 - 0.35*q);
}
// the ragged top of the body: fine spikes that flicker and flare up after each beat
float erosionNoise(float u){ return edgeNoise(u, uRagScale, 0.0, uTime*0.45 + uBeatN*0.23, 13.3); }
// both are baked once per step along the edge (uEdgeTex), so a speck reads them instead of working them out
uniform sampler2D uEdgeTex;
vec2 edgeAt(float u){ return texture(uEdgeTex, vec2(u/uEdgeLen, 0.5)).rg*2.0 - 1.0; }
float clumpAt(vec2 p){
  vec2 q = p/uRef*uClumpScale; float t = uTime*uChurn*0.6;
  return 0.5 + 0.5*(0.65*snoise(vec3(q, t)) + 0.35*snoise(vec3(q*2.3 + 7.7, t*1.3)));
}
// the height (units) at which a speck of the layer hH rests right now
float restH(float u, float hH){
  float f = clamp(hH/max(uReach, 1e-3), 0.0, 1.0);
  vec2 e = edgeAt(u);                                   // wave and spikes, one texture read
  float sh = max(1.0 + uWave*e.x, 0.05);
  float k = 1.0 + uLift*levelAt(u)*1.5;
  float rag = 1.0 + uRagged*e.y*(0.45 + uRagKick*exp(-uBeatT*5.0))*f*f;
  float tap = 1.0;
  if (uShape > 0.5) { vec2 bb, dd; homeAt(u, bb, dd); tap = shapeS(dd); }
  return hH*sh*k*max(rag, 0.08)*tap;
}
// a new home: three candidates from the density profile, the one deepest in a cloud wins
void spawn(float id, float gen, out float u, out float h){
  float best = -1.0; u = 0.0; h = 0.0;
  for (int k = 0; k < 3; k++) {
    vec4 r = rand4(id, gen, 20.0 + float(k));
    float uk = r.x*uEdgeLen;
    // (from the middle the rays spread apart, so the spread is evened out over the area: denser centre, no hot spot)
    float ry = uShape > 0.5 ? pow(r.y, 0.62) : r.y;
    float hk = r.w < uCoreShare ? uCore*ry*(0.8 + 0.4*r.z) : pow(r.y, uFalloff)*uReach;
    vec2 b, d; homeAt(uk, b, d);
    float s = mix(r.z, clumpAt(b + d*hk*uRef), uClumps);
    if (s > best) { best = s; u = uk; h = hk; }
  }
}
vec2 curl2(vec2 q, float t){
  float e = 0.05;
  float n1 = snoise(vec3(q + vec2(0.0, e), t)), n2 = snoise(vec3(q - vec2(0.0, e), t));
  float n3 = snoise(vec3(q + vec2(e, 0.0), t)), n4 = snoise(vec3(q - vec2(e, 0.0), t));
  return vec2(n1 - n2, n4 - n3)/(2.0*e);
}
`,f=`#version 300 es
${d}
uniform float uEdgeW;
out vec4 o;
void main(){
  float u = (gl_FragCoord.x - 0.5)/(uEdgeW - 1.0)*uEdgeLen;
  if (uShape > 0.5) u = gl_FragCoord.x/uEdgeW*uEdgeLen;   // round the middle body the texture repeats
  o = vec4(clamp(vec2(waveNoise(u), erosionNoise(u))*0.5 + 0.5, 0.0, 1.0), 0.0, 1.0);
}`,p=`#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p*2.0 - 1.0, 0.0, 1.0); }`,m=`#version 300 es
${d}
uniform float uArrive, uArrT, uArrH, uArrG, uArrSpread, uArrLump, uArrSeed, uArrLumpSize;
uniform float uDt, uSway, uSwayScale, uOmega, uRescale;
uniform float uFollow, uHasFluid, uGrav, uFallDrag, uFallVar, uCushion, uWhip; uniform vec2 uCell; uniform sampler2D uVel;
layout(location = 0) in vec4 aA;
layout(location = 1) in vec4 aB;
layout(location = 2) in vec4 aC;
out vec4 vA; out vec4 vB; out vec4 vC;
out vec4 vD1; out vec4 vD2;

uniform float uSizeMin, uSizeMax, uSkew, uSizeEdge, uStars, uStarSize, uStreak, uTwinkle, uGlint, uThin, uDof, uLife, uFlash, uClear;
uniform vec4 uQuiet[16]; uniform float uQuietN, uQuietPad;
vec2 projP(vec3 P, out float s){ s = uLens/max(uLens - P.z, 0.05); return uRes*0.5 + (P.xy - uRes*0.5)*s; }
void drawParams(vec4 A, vec4 B, vec4 C, float id, out vec4 D1, out vec4 D2){
  D1 = vec4(0.0); D2 = vec4(0.0);
  if (B.w < 0.0) return;
  vec4 r = rand4(id, B.w, 3.0), r2 = rand4(id, B.w, 5.0);
  float s, s2;
  vec2 head = projP(A.xyz, s);
  vec2 tail = projP(A.xyz - vec3(B.xy, B.z)*uStreak, s2);
  vec2 ax = head - tail; float len = length(ax);
  float maxLen = 0.6*uRef;
  if (len > maxLen) { ax *= maxLen/len; len = maxLen; }
  tail = head - ax;

  float u = C.x, f = clamp(C.y/max(uReach, 1e-3), 0.0, 1.0);
  vec2 b, d; homeAt(u, b, d);
  float star = step(1.0 - uStars, r2.y);
  float sz = mix(uSizeMin, uSizeMax, pow(r2.x, uSkew))*mix(uSizeEdge, 1.0, f)*mix(1.0, uStarSize, star);
  float rad = 0.5*sz*uPx*s;
  float coc = abs(A.z)*uDof*uPx*3.0;                    // out of focus: the disc grows and its light spreads
  float a = (rad*rad + 0.25*uPx*uPx)/((rad + coc)*(rad + coc) + 0.25*uPx*uPx);
  rad += coc;
  float L = uLife*(0.6 + 0.8*r.w);
  a *= smoothstep(0.0, 0.5, A.w)*(1.0 - smoothstep(L - 0.7, L, A.w));
  a *= 1.0 - uTwinkle*(0.5 + 0.5*sin(uTime*(1.3 + 2.0*r2.z) + r2.w*40.0));
  float he = dot(A.xy - b, d)/uRef;                      // dust flying far from the body thins out
  if (uShape > 0.5) he /= shapeS(d);
  a *= exp(-max(he - uReach*1.15, 0.0)*uThin);
  if (uShape > 0.5) {
    // the middle body: the dust thins out round each text line (uQuiet) when uClear is set
    float q = 1e9;
    for (int i = 0; i < 16; i++) {
      if (float(i) >= uQuietN) break;
      vec4 R = uQuiet[i]; vec2 c = 0.5*(R.xy + R.zw), hb = 0.5*(R.zw - R.xy);
      vec2 o = abs(head - c) - hb;
      q = min(q, length(max(o, 0.0)) + min(max(o.x, o.y), 0.0));
    }
    a *= 1.0 - uClear*(1.0 - smoothstep(0.0, uQuietPad, q));
    if (insideAt(head) < 0.0) a = 0.0;
  } else a *= 1.0 - uClear*(1.0 - smoothstep(0.0, max(uCore, 0.15)*1.1, he));   // the stat cards: clear low down, behind the text
  a *= 1.0 - smoothstep(uLens*0.55, uLens*0.85, A.z);    // nothing hits the eye
  if (rad < 0.5*uPx) { a *= rad/(0.5*uPx); rad = 0.5*uPx; }
  a *= (2.0*rad + uPx)/(2.0*rad + uPx + len*0.55);
  float gl = uGlint*pow(0.5 + 0.5*sin(uTime*(1.2 + 2.0*r2.z) + r2.w*60.0), 12.0)*(0.3 + 0.7*star) + star*0.35
      + uFlash*smoothstep(0.4, 2.5, length(vec3(B.xy/uRef, B.z)));
  D1 = vec4(tail, ax); D2 = vec4(rad, 0.6*uPx + coc*0.8, a, gl);
}


float lifeOf(vec4 r){ return uLife*(0.6 + 0.8*r.w); }
// where a speck waits before it is pushed in (units from its point, along its way in): just under the bottom edge of a
// stat card (unseen), or in the middle of the purple card
float arrStartH(float id, vec2 d){
  vec4 ra = rand4(id, 0.0, 43.0);
  return uShape > 0.5 ? 0.06*ra.y*shapeS(d) : -0.015 - 0.025*ra.y;
}
void born(float id, float gen, float age){
  float u, h; spawn(id, gen, u, h);
  vec2 b, d; homeAt(u, b, d);
  vec3 P = vec3(b + d*restH(u, h)*uRef, 0.0);
  float flag = 0.0;
  if (uArrive < 1.0 && gen < 0.5) { P = vec3(b + d*arrStartH(id, d)*uRef, 0.0); flag = 1.0; }
  vA = vec4(P, age); vB = vec4(0.0, 0.0, 0.0, gen); vC = vec4(u, h, flag, 0.0);
}
void sim(){
  vec4 A = aA, B = aB, C = aC;
  if (uRescale != 1.0) { A.xy *= uRescale; B.xy *= uRescale; C.x *= uRescale; }   // the canvas changed resolution
  float id = float(gl_VertexID);
  float gen = B.w;
  if (gen < 0.0) { vec4 r0 = rand4(id, 0.0, 3.0); born(id, 0.0, r0.x*lifeOf(r0)); return; }
  vec4 r = rand4(id, gen, 3.0);
  float age = A.w + uDt;
  if (age > lifeOf(r)) { born(id, gen + 1.0, 0.0); return; }

  float u = C.x, hH = C.y;
  vec2 b, d; homeAt(u, b, d);
  vec3 P = vec3(A.xy/uRef, A.z), V = vec3(B.xy/uRef, B.z);
  float f = clamp(hH/max(uReach, 1e-3), 0.0, 1.0);
  float hr = restH(u, hH);
  // ARRIVING: pushed from its start along its way in, slowing like a throw (against uArrG, units/s²) to a stop above its
  // place; there the physics below takes over and it falls back in. Every speck leaves at once (unless uArrSpread);
  // the lumps of a noise along the edge are thrown highest and fastest, the low parts slower (past 100% of uArrLump
  // up to 2.4 times slower, and not above their place at all)
  if (C.z > 0.5) {
    vec4 ra = rand4(id, 0.0, 43.0);
    float ls = 1.7/max(uArrLumpSize, 0.05);
    float lump = clamp(0.5 + 0.42*edge1(u, ls, 0.0, uArrSeed, 5.3) + 0.24*edge1(u, ls*2.9, 0.0, uArrSeed*1.3, 8.9), 0.0, 1.0);
    float lk = max(1.0 + 1.4*uArrLump*(lump - 0.5), 0.0);
    float spike = max(uArrLump - 1.0, 0.0)*1.6*pow(ra.y, 7.0)*smoothstep(0.35, 0.8, lump);
    float tl = uArrSpread*(0.55*ra.x + 0.45*(1.0 - lump*min(uArrLump, 1.0)));
    float h0 = arrStartH(id, d);
    float over = uArrH*((0.35 + 0.65*ra.z)*lk + spike)*(uShape > 0.5 ? shapeS(d) : 1.0);
    float Hh = max(hr + over - h0, 0.01);
    float Tr = sqrt(2.0*Hh/max(uArrG, 0.1))*(1.0 + 1.4*max(uArrLump - 1.0, 0.0)*pow(1.0 - lump, 1.5)*(0.7 + 0.6*ra.x));
    float sa = (uArrT - tl)/Tr;
    vec2 tg = vec2(-d.y, d.x);
    float lat = (ra.w - 0.5)*0.3*over;
    if (uArrive >= 1.0) sa = 1.0;
    if (sa < 1.0) {
      vec3 Pa, Va;
      if (sa < 0.0) { Pa = vec3(b/uRef + d*h0, 0.0); Va = vec3(0.0); }
      else {
        float e = 1.0 - (1.0 - sa)*(1.0 - sa);
        Pa = vec3(b/uRef + d*(h0 + Hh*e) + tg*lat*sa, 0.0);
        Va = vec3(d*(2.0*Hh*(1.0 - sa)/Tr) + tg*lat/Tr, 0.0);
      }
      // (in flight fully shown; in the middle of the purple card it fades in over the first 0.1 s)
      vA = vec4(Pa.xy*uRef, 0.0, uShape > 0.5 ? clamp(uArrT*5.0, 0.0, 0.5) : 0.5); vB = vec4(Va.xy*uRef, 0.0, gen); vC = vec4(u, hH, 1.0, 0.0);
      return;
    }
    P = vec3(b/uRef + d*(hr + over) + tg*lat, 0.0); V = vec3(tg*lat/Tr, 0.0);   // at its peak: the physics from here
    age = 0.5 + ra.y*max(lifeOf(r) - 1.2, 0.0);                                 // ages spread out, so they renew unevenly
  }
  float t = uTime*uChurn;
  // its place in the body, swaying on slow air currents (further out sways more)
  vec3 T = vec3(b/uRef + d*hr, 0.0);
  if (uSway > 0.0) T.xy += curl2(T.xy*uSwayScale, t)*uSway*(0.25 + f);
  vec3 acc = vec3(0.0);
  vec4 rb = rand4(id, gen, 100.0 + mod(uBeatN, 4096.0));
  // carried by the air (the fluid simulation) and sinking back into its layer
  vec2 air = uHasFluid > 0.5 ? texture(uVel, A.xy/uRes).xy*uCell/uRef : curl2(P.xy*uSwayScale, t)*0.15;
  // the air grips a grain harder the faster it moves past it: a gust whips grains up at once, calm air barely holds
  // them, so they fall freely again. The deep, packed dust is heavier: it lags the air
  vec2 slip = air - V.xy;
  float held = uCore > 1e-3 ? smoothstep(uCore*0.55, uCore + 0.12, hH) : 1.0;   // the dense layer behind the text stays put
  acc.xy += slip*uFollow*mix(0.35, 1.0, f)*mix(0.08, 1.0, held)*(1.0 + uWhip*length(slip)*held);
  vec2 tg = vec2(-d.y, d.x);
  vec2 rel = P.xy - b/uRef, relT = T.xy - b/uRef;
  float hn = dot(rel, d) - dot(relT, d), ot = dot(rel, tg) - dot(relT, tg);
  float vn = dot(V.xy, d);
  // above its layer a grain falls: gravity, slowed by the air to a steady speed (lighter grains fall slower), easing
  // off in the last stretch so it lands softly. Thrown up, it slows down, hangs and falls faster and faster.
  // Inside its layer it is held up firmly without bouncing, so a rising layer lifts it at once.
  float grain = 1.0 + uFallVar*(r.y - 0.5)*1.4;
  float above = smoothstep(0.0, uCushion + 1e-3, hn);
  float an = -uGrav*above/grain - uFallDrag*vn*grain*mix(0.15, 1.0, above);
  float k = uOmega*uOmega;
  if (hn < 0.0) an += -k*hn - 2.0*uOmega*vn;
  else an += -2.0*uOmega*vn*(1.0 - above);
  acc.xy += d*an - tg*(k*0.06*ot + 1.5*dot(V.xy - air, tg)*(1.0 - above));
  acc.z += -k*P.z - 4.0*V.z;
  V += acc*uDt;
  V = clamp(V, vec3(-60.0), vec3(60.0));
  P += V*uDt;
  P.z = min(P.z, uLens*0.92);
  // never through the bottom edge of a stat card: mirrored back in, bouncing a little (not onto the line, or the edge
  // draws an outline). In the middle of the purple card there is no wall: the layer's spring brings it back
  if (uShape < 0.5) {
    float he = dot(P.xy - b/uRef, d);
    if (he < 0.0) { P.xy -= d*he*(1.0 + rb.w); float vn2 = dot(V.xy, d); if (vn2 < 0.0) V.xy -= d*vn2*1.4; }
  }
  if (any(isnan(P)) || any(isnan(V))) { born(id, gen + 1.0, 0.0); return; }
  vA = vec4(P.xy*uRef, P.z, age); vB = vec4(V.xy*uRef, V.z, gen); vC = vec4(u, hH, 0.0, 0.0);
}
void main(){
  sim();
  drawParams(vA, vB, vC, float(gl_VertexID), vD1, vD2);
}`,h=`#version 300 es
precision highp float; out vec4 o; void main(){ o = vec4(0.0); }`,g=`#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uOpacity, uShift;
layout(location = 0) in vec4 aD1;
layout(location = 1) in vec4 aD2;
out vec2 vL; out float vLen; out float vRad; out float vSoft; out float vA; out float vGl;
void main(){
  float a = aD2.z*uOpacity;
  if (a <= 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 tail = aD1.xy + aD1.zw*uShift, ax = aD1.zw; float len = length(ax);
  vec2 dir = len > 1e-3 ? ax/len : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
  vec2 cuv = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  float rad = aD2.x, soft = aD2.y, pad = rad + soft;
  float x = mix(-pad, len + pad, cuv.x), y = mix(-pad, pad, cuv.y);
  vec2 Q = tail + dir*x + nrm*y;
  vL = vec2(x, y); vLen = len; vRad = rad; vSoft = soft; vA = a; vGl = aD2.w;
  gl_Position = vec4(Q/uRes*2.0 - 1.0, 0.0, 1.0);
}`,_=`#version 300 es
precision highp float;
uniform vec3 uCol, uAcc;
in vec2 vL; in float vLen; in float vRad; in float vSoft; in float vA; in float vGl;
out vec4 o;
void main(){
  float x = clamp(vL.x, 0.0, vLen);
  float dd = length(vec2(vL.x - x, vL.y));
  float a = (1.0 - smoothstep(vRad - vSoft, vRad + vSoft, dd))*vA;
  o = vec4(mix(uCol, uAcc, clamp(vGl, 0.0, 1.0)), a);
}`,v=`#version 300 es
precision highp float;
uniform vec2 uC, uHalf; uniform float uSoft, uAmt; uniform vec3 uCol;
out vec4 o;
void main(){
  float r = length((gl_FragCoord.xy - uC)/max(uHalf, vec2(1.0)));
  o = vec4(uCol, uAmt*(1.0 - smoothstep(1.0 - max(uSoft, 0.002), 1.0, r)));
}`,y=e=>`#version 300 es
precision highp float;
precision highp sampler2D;
uniform vec2 uTexel;
out vec4 o;
${e}`,b=y(`uniform sampler2D uV; uniform float uDt, uDiss;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel; vec2 v = texture(uV, uv).xy;
  o = vec4(texture(uV, uv - uDt*v*uTexel).xy/(1.0 + uDiss*uDt), 0.0, 1.0); }`),x=y(`uniform sampler2D uV; uniform vec4 uSp[8]; uniform float uSr[8]; uniform int uN; uniform vec2 uCellPx;
void main(){ vec2 p = gl_FragCoord.xy*uCellPx; vec2 v = texture(uV, gl_FragCoord.xy*uTexel).xy;
  for (int i = 0; i < 8; i++) { if (i >= uN) break; vec2 q = p - uSp[i].xy; v += exp(-dot(q, q)/(uSr[i]*uSr[i]))*uSp[i].zw; }
  o = vec4(v, 0.0, 1.0); }`),ee=y(`uniform sampler2D uV;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  float c = 0.5*(texture(uV, uv + vec2(uTexel.x, 0.0)).y - texture(uV, uv - vec2(uTexel.x, 0.0)).y
               - texture(uV, uv + vec2(0.0, uTexel.y)).x + texture(uV, uv - vec2(0.0, uTexel.y)).x);
  o = vec4(c, 0.0, 0.0, 1.0); }`),te=y(`uniform sampler2D uV; uniform sampler2D uC; uniform float uCurl, uDt;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  float L = texture(uC, uv - vec2(uTexel.x, 0.0)).x, R = texture(uC, uv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uC, uv + vec2(0.0, uTexel.y)).x, B = texture(uC, uv - vec2(0.0, uTexel.y)).x, C = texture(uC, uv).x;
  vec2 force = 0.5*vec2(abs(T) - abs(B), abs(R) - abs(L));
  force = force/(length(force) + 1e-4)*uCurl*C; force.y = -force.y;
  o = vec4(clamp(texture(uV, uv).xy + force*uDt, -2000.0, 2000.0), 0.0, 1.0); }`),S=y(`uniform sampler2D uV;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  vec2 vl = uv - vec2(uTexel.x, 0.0), vr = uv + vec2(uTexel.x, 0.0), vt = uv + vec2(0.0, uTexel.y), vb = uv - vec2(0.0, uTexel.y);
  float L = texture(uV, vl).x, R = texture(uV, vr).x, T = texture(uV, vt).y, B = texture(uV, vb).y;
  vec2 C = texture(uV, uv).xy;
  if (vl.x < 0.0) L = -C.x; if (vr.x > 1.0) R = -C.x; if (vt.y > 1.0) T = -C.y; if (vb.y < 0.0) B = -C.y;
  o = vec4(0.5*(R - L + T - B), 0.0, 0.0, 1.0); }`),C=y(`uniform sampler2D uP; uniform sampler2D uD; uniform float uKeep;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  float p = (texture(uP, uv - vec2(uTexel.x, 0.0)).x + texture(uP, uv + vec2(uTexel.x, 0.0)).x
           + texture(uP, uv + vec2(0.0, uTexel.y)).x + texture(uP, uv - vec2(0.0, uTexel.y)).x)*uKeep - texture(uD, uv).x;
  o = vec4(p*0.25, 0.0, 0.0, 1.0); }`),w=y(`uniform sampler2D uP; uniform sampler2D uV;
void main(){ vec2 uv = gl_FragCoord.xy*uTexel;
  vec2 g = 0.5*vec2(texture(uP, uv + vec2(uTexel.x, 0.0)).x - texture(uP, uv - vec2(uTexel.x, 0.0)).x,
                    texture(uP, uv + vec2(0.0, uTexel.y)).x - texture(uP, uv - vec2(0.0, uTexel.y)).x);
  o = vec4(texture(uV, uv).xy - g, 0.0, 1.0); }`),T=e=>{let t=Math.sin(e*127.1+311.7)*43758.5453;return t-Math.floor(t)},E=e=>{let t=Math.floor(e),n=e-t,r=n*n*(3-2*n);return T(t)*(1-r)+T(t+1)*r},D=(e,t,n)=>Math.min(n,Math.max(t,e));function O(e,t,n,r,i){let a=Math.exp(-(i*e/60%1)*5),o=E(r*.12*128/t+n+i*.35),s=E(r*1.7+n*2+i*2.4);return D(-.18+o*.5+s*.7+a*.3*E(r*.3+i+n),0,1)}var k=e=>()=>{e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296};function A(e,t){e=(e||``).trim();let n=/^var\((--[\w-]+)\)$/.exec(e);n&&(e=getComputedStyle(document.documentElement).getPropertyValue(n[1]).trim());let r=/^#([\da-f]{3}|[\da-f]{6})$/i.exec(e);if(r){let e=r[1];return e.length===3&&(e=e.replace(/./g,`$&$&`)),[0,2,4].map(t=>parseInt(e.slice(t,t+2),16)/255)}if(r=/^rgba?\(([^)]+)\)$/i.exec(e),r){let e=r[1].split(/[\s,/]+/).map(parseFloat);if(e.length>=3)return e.slice(0,3).map(e=>D(e/255,0,1))}return t}function j(e,t,n,r){let i=Math.max(.2,e.srcW*t/Math.max(1,e.srcH*n)),a=2-e.taper/100,o=i*e.core/100*r,s=e.core/100*r,c=Math.max(r,Math.PI*(3*(o+s)-Math.sqrt((3*o+s)*(o+3*s))));return{cx:t/2,cy:n/2+e.srcY/100*n/2,asp:i,p:a,len:c}}var M={unit:150,statW:307},N=document.querySelector(`.stat`),P=()=>{N&&N.clientHeight>0&&(M.unit=N.clientHeight,M.statW=N.clientWidth)};P();var F=[],I={cards:0,cta:0},L=0,ne=class{constructor(e,r,i){this.host=e,this.name=r,this.set=i,this.middle=i.shape===`middle`,this.idx=this.middle?3:L++,this.canvas=document.createElement(`canvas`),this.canvas.className=`dots`,this.canvas.setAttribute(`aria-hidden`,`true`),e.prepend(this.canvas),this.seed=11+this.idx*37,this.rng=k(this.seed*977),this.levels=new Float32Array(c),this.visible=!1,this.shown=!1,this.waiting=!n,this.arrive=1,this.beatN=-1,this.impulse=0,this.splats=[],this.spin=0,this.simN=0,this.drawnN=-1,this.dirty=!0,this.ptr={x:0,y:0,vx:0,vy:0,on:0,target:0,burst:0,t:0},this.canvas.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),this.failed=!0,this.host.classList.add(`no-dots`)}),this.canvas.addEventListener(`webglcontextrestored`,()=>{this.failed=!1,this.init(),!this.failed&&(this.host.classList.remove(`no-dots`),this.arrived&&(this.arrive=1,this.waiting=!1),n?this.still():Q())}),this.init(),!this.failed&&(new ResizeObserver(()=>{this.resize()&&(Q(),n&&(this.stillDue=!0,clearTimeout(this.stillT),this.stillT=setTimeout(()=>{this.visible&&this.still()},200)))}).observe(e),new IntersectionObserver(e=>{let t=e[e.length-1];this.visible=t.isIntersecting,this.waiting&&t.intersectionRatio>=.33&&(this.waiting=!1,this.arrived=!0,this.reset(),this.arrive=0),n&&this.visible&&this.stillDue&&this.still(),Q()},{root:t,threshold:[0,.33]}).observe(e),n||this.bindPointer())}init(){let e=this.canvas.getContext(`webgl2`,{alpha:!1,antialias:!1,depth:!1,premultipliedAlpha:!1,powerPreference:`high-performance`});if(!e){this.failed=!0,this.host.classList.add(`no-dots`);return}this.gl=e;let t=e.getExtension(`WEBGL_debug_renderer_info`);/SwiftShader|llvmpipe|softpipe|Software/i.test(String(e.getParameter(t?t.UNMASKED_RENDERER_WEBGL:e.RENDERER)))&&!/[?&]fmdust=full/.test(location.search)&&(u=6e3,s.auto=!1,s.level=2);try{this.progs={edge:this.link(p,f),upd:this.link(m,h,[`vA`,`vB`,`vC`,`vD1`,`vD2`]),draw:this.link(g,_),dim:this.middle?this.link(p,v):null}}catch(e){console.warn(`stipple:`,e),this.failed=!0,this.host.classList.add(`no-dots`);return}this.vao0=e.createVertexArray(),this.levelTex=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.levelTex),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texImage2D(e.TEXTURE_2D,0,e.R32F,c,1,0,e.RED,e.FLOAT,null),this.edgeW=this.middle?1024:512,this.edgeTex=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.edgeTex),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,this.middle?e.REPEAT:e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,this.edgeW,1,0,e.RGBA,e.UNSIGNED_BYTE,null),this.edgeFb=e.createFramebuffer(),e.bindFramebuffer(e.FRAMEBUFFER,this.edgeFb),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.edgeTex,0),e.bindFramebuffer(e.FRAMEBUFFER,null),this.fbuf=null,this.flowKey=null,this.fluid=null,this.restart=!1,this.fluidOk=!!(e.getExtension(`EXT_color_buffer_float`)||e.getExtension(`EXT_color_buffer_half_float`));let n=this.set.settings;for(let e=0;e<c;e++)this.levels[e]=O(n.bpm,n.bands,this.seed,e,0);this.colors(),this.resize()}link(e,t,n){let r=this.gl,i=(e,t)=>{let n=r.createShader(e);if(r.shaderSource(n,t),r.compileShader(n),!r.getShaderParameter(n,r.COMPILE_STATUS))throw Error(r.getShaderInfoLog(n));return n},a=r.createProgram();if(r.attachShader(a,i(r.VERTEX_SHADER,e)),r.attachShader(a,i(r.FRAGMENT_SHADER,t)),n&&r.transformFeedbackVaryings(a,n,r.INTERLEAVED_ATTRIBS),r.linkProgram(a),!r.getProgramParameter(a,r.LINK_STATUS))throw Error(r.getProgramInfoLog(a));let o={};return{p:a,loc:e=>e in o?o[e]:o[e]=r.getUniformLocation(a,e)}}colors(){let e=this.set.settings;this.bg=A(e.background||getComputedStyle(this.host).getPropertyValue(`--dots`),[.53,.3,1]),this.dust=A(e.dust,[1,1,1]),this.dimCol=A(e.dimColor,this.bg),this.dirty=!0}ruler(){let e=this.set.settings;if(!e.unit)return M;let t=Math.max(1,this.host.clientHeight*e.unit/100);return{unit:t,statW:t*2.05}}resize(){if(this.failed)return!1;let e=Math.min(window.devicePixelRatio||1,this.set.settings.maxDpr||2);this.dpr=s.level>=4?Math.max(Math.min(e,1),e*s.scale4):e;let t=Math.max(1,Math.round(this.host.clientWidth*this.dpr)),n=Math.max(1,Math.round(this.host.clientHeight*this.dpr)),r=this.canvas.width!==t||this.canvas.height!==n;return r&&(this.canvas.width=t,this.canvas.height=n),this.radius=(parseFloat(getComputedStyle(this.host).borderTopLeftRadius)||0)*this.dpr,this.quietAt=0,this.dirty=!0,r&&this.progs&&this.refresh(),r}measureText(){let e=this.host.getBoundingClientRect(),t=[],n=this.dpr,r=this.canvas.height,i=i=>{i.width>1&&i.height>1&&t.length<16&&t.push([(i.left-e.left)*n,r-(i.bottom-e.top)*n,(i.right-e.left)*n,r-(i.top-e.top)*n])};this.host.querySelectorAll(`.btn`).forEach(e=>i(e.getBoundingClientRect())),this.host.querySelectorAll(`.cta__title, .cta__lead`).forEach(e=>{let t=document.createRange();t.selectNodeContents(e);let n=[];for(let e of t.getClientRects()){if(e.width<=1||e.height<=1)continue;let t=n.find(t=>Math.min(t.bottom,e.bottom)-Math.max(t.top,e.top)>.5*Math.min(t.bottom-t.top,e.height));t?(t.left=Math.min(t.left,e.left),t.right=Math.max(t.right,e.right),t.top=Math.min(t.top,e.top),t.bottom=Math.max(t.bottom,e.bottom)):n.push({left:e.left,right:e.right,top:e.top,bottom:e.bottom})}n.forEach(e=>i({left:e.left,right:e.right,top:e.top,bottom:e.bottom,width:e.right-e.left,height:e.bottom-e.top}))}),this.quiet=t,this.quietAt=performance.now()}geom(e){let t=this.canvas.width,n=this.canvas.height,r=this.ruler(),i=r.unit*this.dpr,a=r.statW*this.dpr,o=this.middle?j(e,t,n,i):null,s=o?o.len:t,l=Math.max(1,Math.round(e.bands)),u=this.middle?Math.max(1,Math.min(c,Math.round(s/(a/l)))):Math.min(c,l);return{W:t,H:n,len:s,cols:u,colPx:s/u,unit:i,statW:a,inner:o}}ensureFlow(e,t){let n=this.gl,r=e.amount*e.invAmount/100*(t.len/this.dpr)*(t.unit/this.dpr)/1e4,i=Math.max(1,Math.min(u,Math.round(r)));this.boost=Math.max(1,r/i);let a=i+`/`+t.W+`x`+t.H+`/`+Math.round(t.unit/this.dpr);if(a===this.flowKey)return;if(this.fbuf&&Math.abs(this.N-i)<=Math.max(2,this.N*.005)&&this.flowW&&Math.abs(t.W/t.H-this.flowW/this.flowH)<.01&&!this.restart){this.rescale=(this.rescale||1)*t.W/this.flowW,this.flowW=t.W,this.flowH=t.H,this.flowKey=a;return}if(this.restart=!1,this.keptN=null,this.flowKey=a,this.N=i,this.cur=0,this.flowW=t.W,this.flowH=t.H,this.rescale=1,!this.fbuf){this.fbuf=[n.createBuffer(),n.createBuffer()],this.uvao=[n.createVertexArray(),n.createVertexArray()],this.dvao=[n.createVertexArray(),n.createVertexArray()],this.tf=n.createTransformFeedback();for(let e=0;e<2;e++)for(let[t,r]of[[this.uvao[e],0],[this.dvao[e],1]])if(n.bindVertexArray(t),n.bindBuffer(n.ARRAY_BUFFER,this.fbuf[e]),r)for(let e=0;e<2;e++)n.enableVertexAttribArray(e),n.vertexAttribPointer(e,4,n.FLOAT,!1,80,48+e*16),n.vertexAttribDivisor(e,1);else for(let e=0;e<3;e++)n.enableVertexAttribArray(e),n.vertexAttribPointer(e,4,n.FLOAT,!1,80,e*16),n.vertexAttribDivisor(e,0);n.bindVertexArray(null)}let o=new Float32Array(i*20).fill(-1);for(let e=0;e<2;e++)n.bindBuffer(n.ARRAY_BUFFER,this.fbuf[e]),n.bufferData(n.ARRAY_BUFFER,o,n.DYNAMIC_COPY);n.bindBuffer(n.ARRAY_BUFFER,null)}keep(){return s.level>=3?D(s.budget3/(this.N||1),.4,s.keep3):1}reset(){this.arrSeed=Math.random()*50,this.arrGust=1,this.restart=!0,this.flowKey=null,this.fluid&&this.fluid.clear(),this.rng=k(this.seed*977),this.splats=[],this.dirty=!0}makeFluid(e){let t=this.gl,n=Math.max(e.statW/160,Math.max(e.W,e.H)/512)*(s.level>=2?1.6:1),r=Math.max(8,Math.round(e.W/n)),i=Math.max(8,Math.round(e.H/n)),a=r+`x`+i;if(this.fluid&&this.fluid.key===a)return this.fluid.cellX=e.W/r,this.fluid.cellY=e.H/i,this.fluid;if(this.fluid&&this.fluid.free(),!this.fluidOk)return this.fluid=null;let o=(e,n)=>{let a=t.createTexture();t.bindTexture(t.TEXTURE_2D,a),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texImage2D(t.TEXTURE_2D,0,e,r,i,0,n,t.HALF_FLOAT,null);let o=t.createFramebuffer();t.bindFramebuffer(t.FRAMEBUFFER,o),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,a,0);let s=t.checkFramebufferStatus(t.FRAMEBUFFER)===t.FRAMEBUFFER_COMPLETE;return t.bindFramebuffer(t.FRAMEBUFFER,null),{t:a,fb:o,ok:s}},c={key:a,gw:r,gh:i,cellX:e.W/r,cellY:e.H/i,vel:[o(t.RG16F,t.RG),o(t.RG16F,t.RG)],prs:[o(t.R16F,t.RED),o(t.R16F,t.RED)],div:o(t.R16F,t.RED),curl:o(t.R16F,t.RED),v:0,p:0},l=[...c.vel,...c.prs,c.div,c.curl];if(l.some(e=>!e.ok))return l.forEach(e=>{t.deleteTexture(e.t),t.deleteFramebuffer(e.fb)}),this.fluidOk=!1,this.fluid=null;if(!this.progs.fl)try{this.progs.fl={adv:this.link(p,b),splat:this.link(p,x),curl:this.link(p,ee),vort:this.link(p,te),div:this.link(p,S),jac:this.link(p,C),grad:this.link(p,w)}}catch(e){return console.warn(`stipple: no air`,e),l.forEach(e=>{t.deleteTexture(e.t),t.deleteFramebuffer(e.fb)}),this.fluidOk=!1,this.fluid=null}return c.free=()=>l.forEach(e=>{t.deleteTexture(e.t),t.deleteFramebuffer(e.fb)}),c.clear=()=>{t.clearColor(0,0,0,1),l.forEach(e=>{t.bindFramebuffer(t.FRAMEBUFFER,e.fb),t.clear(t.COLOR_BUFFER_BIT)}),t.bindFramebuffer(t.FRAMEBUFFER,null)},c.clear(),this.fluid=c}stepFluid(e,t,n){let r=this.gl,i=this.progs.fl;r.viewport(0,0,e.gw,e.gh),r.bindVertexArray(this.vao0);let a=(t,n,i,a)=>{r.useProgram(t.p),r.uniform2f(t.loc(`uTexel`),1/e.gw,1/e.gh);let o=0;for(let[e,n]of Object.entries(a))r.activeTexture(r.TEXTURE0+o),r.bindTexture(r.TEXTURE_2D,n),r.uniform1i(t.loc(e),o++);for(let[e,n]of Object.entries(i)){let i=t.loc(e);i!==null&&r.uniform1f(i,n)}r.bindFramebuffer(r.FRAMEBUFFER,n.fb),r.drawArrays(r.TRIANGLES,0,3)},o=()=>e.vel[e.v],c=()=>e.vel[1-e.v],l=()=>{e.v=1-e.v};for(;this.splats.length;){r.useProgram(i.splat.p);let t=Math.min(8,this.splats.length),n=new Float32Array(32),s=new Float32Array(8);for(let r=0;r<t;r++){let t=this.splats[r];n.set([t.x,t.y,t.vx/e.cellX,t.vy/e.cellY],r*4),s[r]=t.r}r.uniform4fv(i.splat.loc(`uSp[0]`),n),r.uniform1fv(i.splat.loc(`uSr[0]`),s),r.uniform1i(i.splat.loc(`uN`),t),r.uniform2f(i.splat.loc(`uCellPx`),e.cellX,e.cellY),a(i.splat,c(),{},{uV:o().t}),l(),this.splats=this.splats.slice(t)}a(i.curl,e.curl,{},{uV:o().t}),a(i.vort,c(),{uCurl:t.curl,uDt:n},{uV:o().t,uC:e.curl.t}),l(),a(i.div,e.div,{},{uV:o().t});let u=s.level>=2?12:20;for(let t=0;t<u;t++)a(i.jac,e.prs[1-e.p],{uKeep:t===0?.8:1},{uP:e.prs[e.p].t,uD:e.div.t}),e.p=1-e.p;a(i.grad,c(),{},{uP:e.prs[e.p].t,uV:o().t}),l(),a(i.adv,c(),{uDt:n,uDiss:t.calm/100},{uV:o().t}),l(),r.bindFramebuffer(r.FRAMEBUFFER,null)}gusts(e,t,n,r){let i=(n,r,i)=>{let a,o,s,c;if(t.inner){let e=n*Math.PI*2;s=Math.cos(e),c=Math.sin(e),a=t.inner.cx,o=t.inner.cy}else a=n*t.W,o=0,s=0,c=1;let l=Math.cos(i),u=Math.sin(i),d=s*l-c*u,f=s*u+c*l,p=r*t.unit;this.splats.push({x:a+s*t.unit*.05,y:o+c*t.unit*.05,vx:d*p,vy:f*p,r:e.puffW/100*t.unit})},a=t.len/t.statW,o=e=>{let t=Math.floor(e);return t+ +(this.rng()<e-t)};if(this.arrGust&&this.arrive<1&&this.arrive*2.2>e.arrSpread/2e3){this.arrGust=0;let t=Math.max(3,Math.round(4*a));for(let n=0;n<t;n++)i((n+.3+this.rng()*.4)/t,e.puff/100*.9*(.6+.8*this.rng()),(this.rng()-.5)*.6)}if(r){let n=o(e.puffs*a);for(let a=0;a<n;a++){let n=0,a=-1;for(let e=0;e<4;e++){let e=this.rng(),r=this.levels[Math.min(t.cols-1,Math.floor(e*t.cols))];r>a&&(a=r,n=e)}i(n,e.puff/100*r*(.45+a),(this.rng()-.5)*.7)}}for(let t=o(e.thermals/100*n*4*a);t>0;t--)i(this.rng(),e.puff/100*.25,(this.rng()-.5)*1.2);let s=this.ptr;if(s.on>.05&&e.touch&&Math.hypot(s.vx,s.vy)>1&&this.splats.push({x:s.x,y:s.y,vx:s.vx*e.sweep/100*.8,vy:s.vy*e.sweep/100*.8,r:e.touchR/100*t.unit*.6}),s.burst>0&&e.touch)for(let n=0;n<6;n++){let r=n/6*Math.PI*2,i=e.tap/100*t.unit*1.5;this.splats.push({x:s.x+Math.cos(r)*t.unit*.08,y:s.y+Math.sin(r)*t.unit*.08,vx:Math.cos(r)*i,vy:Math.sin(r)*i,r:e.touchR/100*t.unit*.4})}this.splats.length>96&&this.splats.splice(0,this.splats.length-96)}bindPointer(){let e=this.host,t=this.ptr,n=n=>{let r=e.getBoundingClientRect(),i=(n.clientX-r.left)*this.dpr,a=(r.bottom-n.clientY)*this.dpr,o=performance.now();if(t.t&&o>t.t){let e=1-Math.exp(-(o-t.t)/40);t.vx+=((i-t.x)/((o-t.t)/1e3)-t.vx)*e,t.vy+=((a-t.y)/((o-t.t)/1e3)-t.vy)*e}t.x=i,t.y=a,t.t=o,t.target=1};e.addEventListener(`pointermove`,n,{passive:!0}),e.addEventListener(`pointerenter`,e=>{t.t=0,n(e),t.vx=t.vy=0},{passive:!0}),e.addEventListener(`pointerleave`,()=>{t.target=0,t.t=0},{passive:!0}),e.addEventListener(`pointerdown`,e=>{n(e),t.burst=1},{passive:!0})}step(e,t){if(this.failed)return;let n=this.set.settings,r=this.geom(n);this.g=r;let i=60/n.bpm,a=t-(this.middle?0:this.idx*(n.cascade||0)/100*i)+4*i;this.music=a;let o=Math.floor(a/i);if(this.impulse=0,this.beatN>=0&&o!==this.beatN){let e=Math.max(1,Math.round(n.bar)),t=(o%e+e)%e===0;this.impulse=(t?n.accent/100:1)*(1-n.groove/100*.5+n.groove/100*T(o*1.31+this.seed))}this.beatN=o,this.beatT=a-o*i;let s=1-(1-n.attack/100)**(e*60),c=1-(1-n.release/100)**(e*60);for(let e=0;e<r.cols;e++){let t=O(n.bpm,n.bands,this.seed,e,a);this.levels[e]+=(t-this.levels[e])*(t>this.levels[e]?s:c)}this.spin=(this.spin+e*(this.middle&&n.spin||0)/360+1)%1;let l=this.ptr;l.on+=((n.touch?l.target:0)-l.on)*(1-Math.exp(-e*10)),performance.now()-l.t>60&&(l.vx*=Math.exp(-e*12),l.vy*=Math.exp(-e*12)),this.arrive<1&&(this.arrive=Math.min(1,this.arrive+e/2.2)),this.simulate(n,r,e),l.burst=0}apply(e,t){let n=this.gl;n.useProgram(e.p);for(let r in t){let i=e.loc(r);if(i===null)continue;let a=t[r];typeof a==`number`?n.uniform1f(i,a):a.length===2?n.uniform2fv(i,a):a.length===3?n.uniform3fv(i,a):a.length===4&&n.uniform4fv(i,a)}let r=e.loc(`uLevelTex`);r!==null&&n.uniform1i(r,0);let i=e.loc(`uEdgeTex`);i!==null&&n.uniform1i(i,2)}simulate(e,t,n){let r=this.gl;this.ensureFlow(e,t);let i=this.fluid;n>0&&(i=this.makeFluid(t),this.calmRun||this.gusts(e,t,n,this.impulse),i&&this.stepFluid(i,e,n)),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,this.levelTex),r.texSubImage2D(r.TEXTURE_2D,0,0,0,t.cols,1,r.RED,r.FLOAT,this.levels);let a={uRes:[t.W,t.H],uTime:(this.music||0)%3600,uShape:+!!this.middle,uRadius:this.radius,uInner:t.inner?[t.inner.cx,t.inner.cy,t.inner.asp,t.inner.p]:[0,0,1,2],uRef:t.unit,uEdgeLen:t.len,uSeed:this.seed,uPx:this.dpr,uColPx:t.colPx,uCols:t.cols,uSpin:this.spin,uReach:e.reach/100,uFalloff:e.falloff/100,uClumps:e.clumps/100,uClumpScale:e.clumpScale/100,uChurn:e.churn/100,uWave:e.wave/100,uWaveScale:e.waveScale/100,uWaveSpeed:e.waveSpeed/100,uWaveTravel:e.waveTravel/100,uWaveIrreg:e.waveIrreg/100,uLift:e.lift/100,uCore:e.core/100,uCoreShare:e.coreShare/100,uRagged:e.ragged/100,uRagScale:e.ragScale/100,uRagKick:e.ragKick/100,uBeatT:this.beatT||0,uBeatN:this.beatN,uLens:e.lens/100};r.bindFramebuffer(r.FRAMEBUFFER,this.edgeFb),r.viewport(0,0,this.edgeW,1),r.bindVertexArray(this.vao0),this.apply(this.progs.edge,Object.assign({},a,{uEdgeW:this.edgeW})),r.drawArrays(r.TRIANGLES,0,3),r.bindFramebuffer(r.FRAMEBUFFER,null),r.activeTexture(r.TEXTURE2),r.bindTexture(r.TEXTURE_2D,this.edgeTex),this.middle&&e.invClear>0&&(!this.quietAt||performance.now()-this.quietAt>500)&&this.measureText(),Object.assign(a,{uDt:n,uArrive:this.arrive,uLife:e.life,uArrT:this.arrive*2.2,uArrH:e.arrH/100,uArrG:10*e.arrSpeed/100,uArrSpread:e.arrSpread/1e3,uArrLump:e.arrLump/100,uArrLumpSize:e.arrLumpSize/100,uArrSeed:this.arrSeed||0,uSway:e.sway/100,uSwayScale:e.swayScale/100,uOmega:2*Math.PI*e.settle/100,uFollow:e.follow/100,uHasFluid:+!!i,uGrav:e.gravity/100,uFallDrag:e.fallDrag/100,uFallVar:e.fallVar/100,uCushion:e.cushion/100,uWhip:e.whip/100,uCell:i?[i.cellX,i.cellY]:[1,1],uRescale:this.rescale||1,uSizeMin:e.sizeMin,uSizeMax:Math.max(e.sizeMax,e.sizeMin),uSkew:e.skew/100,uSizeEdge:e.sizeEdge/100,uStars:e.stars/100,uStarSize:e.starSize/100,uStreak:e.streak/1e3,uTwinkle:e.twinkle/100,uGlint:e.glint/100,uThin:e.thin/100,uDof:e.dof/100,uFlash:e.flash/100,uClear:e.invClear/100,uQuietN:this.middle&&this.quiet?this.quiet.length:0,uQuietPad:(e.quietPad||0)/100*t.unit}),this.rescale=1;let o=this.progs.upd;if(this.apply(o,a),this.middle&&this.quiet&&this.quiet.length){let e=o.loc(`uQuiet[0]`);e!==null&&r.uniform4fv(e,new Float32Array(this.quiet.flat()))}r.activeTexture(r.TEXTURE1),r.bindTexture(r.TEXTURE_2D,i?i.vel[i.v].t:this.levelTex),r.uniform1i(o.loc(`uVel`),1);let s=Math.max(1,Math.round(this.N*this.keep()));if(this.keptN!=null&&s>this.keptN){let e=new Float32Array((s-this.keptN)*20).fill(-1);for(let t=0;t<2;t++)r.bindBuffer(r.ARRAY_BUFFER,this.fbuf[t]),r.bufferSubData(r.ARRAY_BUFFER,this.keptN*80,e);r.bindBuffer(r.ARRAY_BUFFER,null)}this.keptN=s,r.bindVertexArray(this.uvao[this.cur]),r.bindTransformFeedback(r.TRANSFORM_FEEDBACK,this.tf),r.bindBufferBase(r.TRANSFORM_FEEDBACK_BUFFER,0,this.fbuf[1-this.cur]),r.enable(r.RASTERIZER_DISCARD),r.beginTransformFeedback(r.POINTS),r.drawArrays(r.POINTS,0,s),r.endTransformFeedback(),r.disable(r.RASTERIZER_DISCARD),r.bindBufferBase(r.TRANSFORM_FEEDBACK_BUFFER,0,null),r.bindTransformFeedback(r.TRANSFORM_FEEDBACK,null),r.bindVertexArray(null),this.cur=1-this.cur,this.impulse=0,this.simN++}refresh(){if(!this.failed){if(this.fbuf&&this.g&&!this.waiting){let e=this.simN,t=this.set.settings;this.simulate(t,this.g=this.geom(t),0),this.simN=e}this.draw()}}draw(e=0){if(this.failed)return;let t=this.gl,n=this.bg;if(t.bindFramebuffer(t.FRAMEBUFFER,null),t.viewport(0,0,this.canvas.width,this.canvas.height),t.clearColor(n[0],n[1],n[2],1),t.clear(t.COLOR_BUFFER_BIT),this.dirty=!1,this.drawnN=this.simN,!this.fbuf||!this.g||this.waiting)return;let r=this.set.settings,i=this.keep();if(this.apply(this.progs.draw,{uShift:e,uRes:[this.canvas.width,this.canvas.height],uOpacity:r.invOpacity/100*r.opacity/100*(this.boost||1)/i,uCol:this.dust,uAcc:this.dust}),t.bindVertexArray(this.dvao[this.cur]),t.enable(t.BLEND),t.blendFuncSeparate(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA,t.ONE,t.ONE),t.drawArraysInstanced(t.TRIANGLE_STRIP,0,4,Math.max(1,Math.round(this.N*i))),this.progs.dim&&r.dim&&r.dimAmount>0){let e=this.canvas.width,n=this.canvas.height;t.bindVertexArray(this.vao0),this.apply(this.progs.dim,{uC:[e/2,n/2*(1+(r.dimY||0)/100)],uHalf:[r.dimW/100*e/2,r.dimH/100*n/2],uSoft:r.dimSoft/100,uAmt:r.dimAmount/100,uCol:this.dimCol}),t.blendFuncSeparate(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA,t.ZERO,t.ONE),t.drawArrays(t.TRIANGLES,0,3)}t.disable(t.BLEND),t.bindVertexArray(null)}still(){if(this.failed)return;clearTimeout(this.stillT),this.stillDue=!1,this.arrive=1,this.waiting=!1,this.reset(),this.beatN=-1,this.calmRun=!0;let e=this.set.settings,t=60/e.bpm,n=this.middle?0:this.idx*(e.cascade||0)/100*t,r=n+(Math.ceil((1.5-n)/t)+.75)*t;for(let e=59;e>=0;e--)this.step(l,r-e*l);this.calmRun=!1,this.draw()}},R=0,z=0,B=0,V=[],H=e=>{if(!e.length)return 0;let t=[...e].sort((e,t)=>e-t);return t[t.length>>1]},U=e=>e.visible&&!e.failed&&!e.waiting;function W(e){if(e=D(Math.round(e),0,5),e===s.level)return;let t=s.level;s.level=e,t>=4!=e>=4&&F.forEach(e=>e.resize()),V.length=0}var G={start:0,since:0,good:0,hold:3e3,probe:0,busy:0,settle:0,down:null,noDown:0,bad:0},K=()=>{G.busy=performance.now(),G.since=0};e(K),[`touchstart`,`touchmove`,`wheel`].forEach(e=>addEventListener(e,K,{passive:!0,capture:!0}));function q(e,t){W(e),G.settle=t+1e3,G.since=0,G.bad=0}function J(e){if(!s.auto||document.hidden){G.since=0;return}if(G.start||=e,e-G.start<5e3)return;if(e-G.busy<1e3||e<G.settle){G.since=0;return}if(!G.since){G.since=e,V.length=0;return}if(e-G.since<750||V.length<30)return;G.since=e;let t=H(V.slice(-45))*1e3,n=s.level>=5?1e3/30:1e3/60,r=t>n*1.2,i=t<n*1.08;if(G.bad=r?G.bad+1:0,G.down&&G.bad>=2&&t>G.down.f*.9){let t=G.down.level;G.down=null,G.noDown=e+2e4,G.good=0,q(t,e)}else G.down&&!r&&(G.down=null),r&&G.bad>=2&&s.level<5&&e>G.noDown?(G.probe&&e-G.probe<2500&&(G.hold=Math.min(G.hold*2,3e4)),G.probe=0,G.good=0,G.down={level:s.level,f:t},q(s.level+1,e)):i&&s.level>1?(G.good||=e,e-G.good>G.hold&&(G.good=0,G.probe=e,q(s.level-1,e))):G.good=0}function Y(e){let t=F.filter(U);[`cards`,`cta`].forEach(n=>{t.some(e=>e.name===n)&&(I[n]+=e)}),t.forEach(t=>t.step(e,I[t.name])),s.stepAt=performance.now()}function X(e){if(s.level>=1){if(B=Math.min(B+e,1/30),B>=l*.65){let e=B;B=0,Y(e)}}else for(B=Math.min(B+e,l*4);B>=.016665666666666665;)B-=l,Y(l)}function Z(e){R=0,r.frame(e);let t=z?Math.min((e-z)/1e3,.1):l;if(z=e,s.level>=5&&s.lastWork&&e-s.lastWork<1e3/30-4){R=requestAnimationFrame(Z);return}let n=s.lastWork?Math.min((e-s.lastWork)/1e3,.1):t;s.lastWork=e,V.push(n),V.length>120&&V.shift(),X(n),F.forEach(e=>{if(e.visible&&!e.failed){if(e.simN!==e.drawnN||e.dirty)e.draw();else if(s.level<=1&&U(e)&&s.stepAt){let t=Math.min((performance.now()-s.stepAt)/1e3,1/30);e.set.settings.streak>0&&t>.002&&e.draw(t/(e.set.settings.streak/1e3))}}}),J(e),Q()}function Q(){R||n||document.hidden||(F.some(e=>e.visible&&!e.failed&&(U(e)||e.dirty))?R=requestAnimationFrame(Z):(z=0,s.lastWork=0))}document.addEventListener(`visibilitychange`,()=>{z=0,s.lastWork=0,Q()});function $(e){P(),N&&!$.watching&&($.watching=!0,new ResizeObserver(P).observe(N)),document.querySelectorAll(o[e].hosts).forEach(t=>{if(!t.fmStipple)try{let r=new ne(t,e,o[e]);if(t.fmStipple=r,r.failed)return;F.push(r),n?r.still():r.draw()}catch(e){console.warn(`stipple:`,e),t.classList.add(`no-dots`)}}),Q()}window.fmStipple={settings:i,cta:a,sets:o,engine:s,instances:F,update(){F.forEach(e=>{e.colors(),e.flowKey=null,e.resize(),n&&e.still()}),Q()},replay(){n||(F.forEach(e=>{e.waiting=!1,e.reset(),e.arrive=0}),Q())},advance(e){for(let t=Math.round(e/l);t>0;t--)Y(l);F.forEach(e=>{e.visible&&!e.failed&&e.draw()})},level(e){return s.auto=e===`auto`,s.auto||W(+e),s.level}};export{$ as initDots};
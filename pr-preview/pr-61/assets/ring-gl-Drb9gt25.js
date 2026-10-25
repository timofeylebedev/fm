var e=/[?&]fmring=gl/.test(location.search),t=`#version 300 es
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
}`,n=`#version 300 es
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
}`;function r(e,t){let n=document.createElement(`i`);n.style.cssText=`position:absolute;visibility:hidden;color:`+e,t.appendChild(n);let r=getComputedStyle(n).color;n.remove();let i=Object.assign(document.createElement(`canvas`),{width:1,height:1}).getContext(`2d`,{willReadFrequently:!0});i.fillStyle=r,i.fillRect(0,0,1,1);let a=i.getImageData(0,0,1,1).data;return[a[0]/255,a[1]/255,a[2]/255]}var i=e=>`rgb(`+e.map(e=>Math.round(e*255)).join()+`)`,a=e=>new Promise(t=>{let n=new Image;n.decoding=`async`,n.onload=()=>(n.decode?n.decode().catch(()=>{}):Promise.resolve()).then(()=>t(n)),n.onerror=()=>t(null),n.src=e}),o=e=>[].concat(e).reduce((e,t)=>e.then(e=>e||a(t)),Promise.resolve(null));function s(a,s,c){let l=null,u=null,d=null,f=null,p=1,m=[0,0],h=!1,g=0,_=[.9,.9,.9],v=[1,1,1],y=null,b={},x=null,S=null,C=0,w=null,T=0,E=[],D=0,O=0,k=null,A=[],j=()=>{l&&l.remove(),l=document.createElement(`canvas`),l.className=`rc-canvas`,a.appendChild(l),f&&V()};function M(){j();let t=l.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1,powerPreference:`low-power`,failIfMajorPerformanceCaveat:!e});if(!t)return!1;let n=t.getExtension(`WEBGL_debug_renderer_info`);return!e&&/SwiftShader|llvmpipe|softpipe|Software/i.test(String(t.getParameter(n?n.UNMASKED_RENDERER_WEBGL:t.RENDERER)))?!1:(u=t,N()?(l.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),h=!0,g++,cancelAnimationFrame(O),O=0,E=[]}),l.addEventListener(`webglcontextrestored`,()=>{h=!1,N()?f&&H.resize(f):(u=null,P()),c()}),!0):(u=null,!1))}function N(){let e=(e,t)=>{let n=u.createShader(e);return u.shaderSource(n,t),u.compileShader(n),n};y=u.createProgram();let r=e(u.VERTEX_SHADER,t),i=e(u.FRAGMENT_SHADER,n);if(u.attachShader(y,r),u.attachShader(y,i),u.linkProgram(y),!u.getProgramParameter(y,u.LINK_STATUS))return u.isContextLost()||console.warn(`fm ring:`,u.getShaderInfoLog(r)||u.getShaderInfoLog(i)||u.getProgramInfoLog(y)),!1;u.useProgram(y);for(let e of[`u_n`,`u_pose`,`u_ring`,`u_view`,`u_tex`,`u_corner`,`u_fade`])b[e]=u.getUniformLocation(y,e);return u.bindVertexArray(u.createVertexArray()),u.enable(u.CULL_FACE),u.frontFace(u.CW),u.enable(u.BLEND),u.blendFunc(u.ONE,u.ONE_MINUS_SRC_ALPHA),u.clearColor(0,0,0,0),u.activeTexture(u.TEXTURE0),u.uniform1i(b.u_tex,0),x=u.createFramebuffer(),S=w=null,C=T=0,!0}function P(){j(),d=l.getContext(`2d`),d?(A=[],I()):l.remove()}function F(e){let t=u.createTexture();u.bindTexture(u.TEXTURE_2D_ARRAY,t),u.texStorage3D(u.TEXTURE_2D_ARRAY,Math.floor(Math.log2(e))+1,u.RGBA8,e,e,s.images.length),u.texParameteri(u.TEXTURE_2D_ARRAY,u.TEXTURE_MIN_FILTER,u.LINEAR_MIPMAP_LINEAR),u.texParameteri(u.TEXTURE_2D_ARRAY,u.TEXTURE_MAG_FILTER,u.LINEAR),u.texParameteri(u.TEXTURE_2D_ARRAY,u.TEXTURE_WRAP_S,u.CLAMP_TO_EDGE),u.texParameteri(u.TEXTURE_2D_ARRAY,u.TEXTURE_WRAP_T,u.CLAMP_TO_EDGE);let n=u.getExtension(`EXT_texture_filter_anisotropic`);n&&u.texParameterf(u.TEXTURE_2D_ARRAY,n.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,u.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT))),u.bindFramebuffer(u.FRAMEBUFFER,x);for(let e=0;e<s.images.length;e++)u.framebufferTextureLayer(u.FRAMEBUFFER,u.COLOR_ATTACHMENT0,t,0,e),u.clearBufferfv(u.COLOR,0,[_[0],_[1],_[2],1]);return u.bindFramebuffer(u.FRAMEBUFFER,null),u.generateMipmap(u.TEXTURE_2D_ARRAY),t}function I(){let e=++g;D=0,s.images.forEach((t,n)=>(t?o(t):Promise.resolve(null)).then(t=>{e===g&&(D++,d?(t&&(A[n]=t),c()):(t&&E.push({i:n,img:t}),L()))}))}function L(){O||=requestAnimationFrame(R)}function R(){if(O=0,h||!u)return;let e=E.shift(),t=w||S,n=w?T:C;if(e&&t){k||=document.createElement(`canvas`),k.width=k.height=n;let r=k.getContext(`2d`);r.imageSmoothingQuality=`high`,r.fillStyle=i(_),r.fillRect(0,0,n,n),r.drawImage(e.img,0,0,n,n),u.bindTexture(u.TEXTURE_2D_ARRAY,t),u.texSubImage3D(u.TEXTURE_2D_ARRAY,0,0,0,e.i,n,n,1,u.RGBA,u.UNSIGNED_BYTE,k),w?u.bindTexture(u.TEXTURE_2D_ARRAY,S):(u.generateMipmap(u.TEXTURE_2D_ARRAY),c())}if(E.length)return L();D<s.images.length||(k&&=(k.width=k.height=0,null),w&&(u.bindTexture(u.TEXTURE_2D_ARRAY,w),u.generateMipmap(u.TEXTURE_2D_ARRAY),u.deleteTexture(S),S=w,C=T,w=null,T=0,c()))}function z(e,t,n,r){let i=Math.cos(n),a=Math.sin(n),o=Math.cos(r),s=Math.sin(r),c=f.radius,l=e*i+c*a,u=-e*a+c*i,d=t*o-u*s,p=t*s+u*o-c,m=f.perspective/(f.perspective-p);return[f.ox+l*m,f.oy+d*m]}function B(){let e=d,t=s.images.length,n=f.halfW,r=f.halfH;e.setTransform(1,0,0,1,0,0),e.clearRect(0,0,l.width,l.height);for(let a of[!0,!1])for(let o=0;o<t;o++){let s=m[0]+o*2*Math.PI/t,c=a?-1:1,l=z(-n*c,-r,s,m[1]),u=z(n*c,-r,s,m[1]),d=z(-n*c,r,s,m[1]),h=(u[0]-l[0])/(2*n),g=(u[1]-l[1])/(2*n),y=(d[0]-l[0])/(2*r),b=(d[1]-l[1])/(2*r);h*b-g*y<=0||(e.setTransform(h*p,g*p,y*p,b*p,l[0]*p,l[1]*p),e.save(),e.beginPath(),e.roundRect?e.roundRect(0,0,2*n,2*r,f.corner):e.rect(0,0,2*n,2*r),e.clip(),e.fillStyle=i(_),e.fillRect(0,0,2*n,2*r),A[o]&&e.drawImage(A[o],0,0,2*n,2*r),a&&(e.globalAlpha=f.fade,e.fillStyle=i(v),e.fillRect(0,0,2*n,2*r)),e.restore())}}function V(){p=Math.min(window.devicePixelRatio||1,f.dprMax),l.style.cssText=`top:`+-f.above+`px;width:`+f.width+`px;height:`+f.height+`px`;let e=Math.max(1,Math.round(f.width*p)),t=Math.max(1,Math.round(f.height*p));(l.width!==e||l.height!==t)&&(l.width=e,l.height=t),p=l.width/f.width}let H={get webgl(){return!!u},resize(e){if(f=e,!l||(V(),!u||h))return;u.viewport(0,0,u.drawingBufferWidth,u.drawingBufferHeight),u.uniform1i(b.u_n,s.images.length),u.uniform4f(b.u_ring,f.halfW,f.halfH,f.radius,f.perspective),u.uniform4f(b.u_view,f.ox,f.oy,f.width,f.height),u.uniform1f(b.u_corner,Math.min(f.corner,f.halfW,f.halfH)),u.uniform4f(b.u_fade,v[0],v[1],v[2],f.fade);let t=Math.min(640,Math.ceil(2*f.halfW*p/32)*32);S?t>Math.max(C,T)&&(w&&u.deleteTexture(w),w=F(t),T=t,E=[],I()):(S=F(t),C=t,E=[],I()),u.bindTexture(u.TEXTURE_2D_ARRAY,S)},draw(e,t){if(m[0]=e*Math.PI/180,m[1]=t*Math.PI/180,f&&!h&&l){if(d)return B();u&&S&&(u.uniform2f(b.u_pose,m[0],m[1]),u.clear(u.COLOR_BUFFER_BIT),u.drawArrays(u.TRIANGLES,0,12*s.images.length))}},refresh(){_=r(`var(--mist)`,a),v=r(s.backFadeColor,a),u&&!h&&(w&&u.deleteTexture(w),S&&u.deleteTexture(S),S=w=null,C=T=0),d&&(A=[],I())}};return _=r(`var(--mist)`,a),v=r(s.backFadeColor,a),M()||P(),l&&l.isConnected?H:null}export{s as createRingView};
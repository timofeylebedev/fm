function e(e,t){let n=document.createElement(`i`);n.style.cssText=`position:absolute;visibility:hidden;color:`+e,t.appendChild(n);let r=getComputedStyle(n).color.match(/[\d.]+/g)||[0,0,0];return n.remove(),[r[0]/255,r[1]/255,r[2]/255]}var t=e=>new Promise(t=>{let n=new Image;n.decoding=`async`,n.onload=()=>(n.decode?n.decode().catch(()=>{}):Promise.resolve()).then(()=>t(n)),n.onerror=()=>t(null),n.src=e});function n(n,r){let i=document.createElement(`canvas`);i.className=`rc-canvas`,n.appendChild(i);let a=null,o=1,s=0,c=0,l=0,u=[0,0],d=!1,f=0,p=[],m=[.9,.9,.9],h=[1,1,1],g=i.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1,powerPreference:`low-power`}),_=g?null:i.getContext(`2d`),v,y,b={};function x(){m=e(`var(--mist)`,n),h=e(r.backFadeColor,n)}function S(){let e=(e,t)=>{let n=g.createShader(e);return g.shaderSource(n,t),g.compileShader(n),n};v=g.createProgram();let t=e(g.VERTEX_SHADER,`#version 300 es
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
}`),n=e(g.FRAGMENT_SHADER,`#version 300 es
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
}`);if(g.attachShader(v,t),g.attachShader(v,n),g.linkProgram(v),!g.getProgramParameter(v,g.LINK_STATUS))return console.warn(`fm ring:`,g.getShaderInfoLog(t)||g.getShaderInfoLog(n)||g.getProgramInfoLog(v)),!1;g.useProgram(v);for(let e of[`u_n`,`u_pose`,`u_ring`,`u_view`,`u_have`,`u_tex`,`u_corner`,`u_mist`,`u_fade`])b[e]=g.getUniformLocation(v,e);return g.bindVertexArray(g.createVertexArray()),g.enable(g.CULL_FACE),g.frontFace(g.CW),g.enable(g.BLEND),g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA),g.clearColor(0,0,0,0),g.uniform1i(b.u_tex,0),y=null,c=0,l=0,!0}function C(e){y&&g.deleteTexture(y),y=g.createTexture(),g.activeTexture(g.TEXTURE0),g.bindTexture(g.TEXTURE_2D_ARRAY,y);let t=Math.floor(Math.log2(e))+1;g.texStorage3D(g.TEXTURE_2D_ARRAY,t,g.RGBA8,e,e,r.images.length),g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR),g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_MAG_FILTER,g.LINEAR),g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE),g.texParameteri(g.TEXTURE_2D_ARRAY,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);let n=g.getExtension(`EXT_texture_filter_anisotropic`);n&&g.texParameterf(g.TEXTURE_2D_ARRAY,n.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,g.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT))),c=e,l=0,g.uniform1i(b.u_have,0)}function w(){let e=++f;r.images.forEach((n,r)=>n&&t(n).then(t=>{e===f&&t&&(p.push({i:r,img:t}),_?A():D())}))}let T=0,E=null;function D(){T||=requestAnimationFrame(O)}function O(){if(T=0,d||!c)return;let e=p.shift();if(!e)return;E||=document.createElement(`canvas`),E.width=E.height=c;let t=E.getContext(`2d`);t.imageSmoothingQuality=`high`,t.fillStyle=`rgb(`+m.map(e=>Math.round(e*255)).join()+`)`,t.fillRect(0,0,c,c),t.drawImage(e.img,0,0,c,c),g.bindTexture(g.TEXTURE_2D_ARRAY,y),g.texSubImage3D(g.TEXTURE_2D_ARRAY,0,0,0,e.i,c,c,1,g.RGBA,g.UNSIGNED_BYTE,E),g.generateMipmap(g.TEXTURE_2D_ARRAY),l|=1<<e.i,g.uniform1i(b.u_have,l),j(),p.length?D():(E.width=E.height=0,E=null)}function k(e,t,n,r){let i=Math.cos(n),o=Math.sin(n),c=Math.cos(r),l=Math.sin(r),u=a.radius,d=e*i+u*o,f=-e*o+u*i,p=t*c-f*l,m=t*l+f*c-u,h=a.perspective/(a.perspective-m);return[s+d*h,a.oy+p*h]}function A(){if(!a)return;let e=_,t=r.images.length,n=a.halfW,s=a.halfH;e.setTransform(1,0,0,1,0,0),e.clearRect(0,0,i.width,i.height);let c={};p.forEach(e=>{c[e.i]=e.img});for(let r of[!0,!1])for(let i=0;i<t;i++){let l=u[0]+i*2*Math.PI/t,d=r?-1:1,f=k(-n*d,-s,l,u[1]),p=k(n*d,-s,l,u[1]),g=k(-n*d,s,l,u[1]),_=(p[0]-f[0])/(2*n),v=(p[1]-f[1])/(2*n),y=(g[0]-f[0])/(2*s),b=(g[1]-f[1])/(2*s);_*b-v*y<=0||(e.setTransform(_*o,v*o,y*o,b*o,f[0]*o,f[1]*o),e.save(),e.beginPath(),e.roundRect?e.roundRect(0,0,2*n,2*s,a.corner):e.rect(0,0,2*n,2*s),e.clip(),e.fillStyle=`rgb(`+m.map(e=>Math.round(e*255)).join()+`)`,e.fillRect(0,0,2*n,2*s),c[i]&&e.drawImage(c[i],0,0,2*n,2*s),r&&(e.globalAlpha=a.fade,e.fillStyle=`rgb(`+h.map(e=>Math.round(e*255)).join()+`)`,e.fillRect(0,0,2*n,2*s)),e.restore())}}function j(){if(a&&!d){if(_)return A();g.uniform2f(b.u_pose,u[0],u[1]),g.clear(g.COLOR_BUFFER_BIT),g.drawArrays(g.TRIANGLES,0,12*r.images.length)}}let M={get webgl(){return!!g},resize(e){a=e,o=Math.min(window.devicePixelRatio||1,2);let t=n.getBoundingClientRect().left*o,l=(t-Math.floor(t))/o;s=a.ox+l,i.style.cssText=`left:`+-l+`px;top:`+-a.above+`px;width:`+a.width+`px;height:`+a.height+`px`;let u=Math.max(1,Math.round(a.width*o)),f=Math.max(1,Math.round(a.height*o));if((i.width!==u||i.height!==f)&&(i.width=u,i.height=f),o=i.width/a.width,_||d)return j();g.viewport(0,0,i.width,i.height),g.uniform1i(b.u_n,r.images.length),g.uniform4f(b.u_ring,a.halfW,a.halfH,a.radius,a.perspective),g.uniform4f(b.u_view,s,a.oy,a.width,a.height),g.uniform1f(b.u_corner,Math.min(a.corner,a.halfW,a.halfH)),g.uniform3f(b.u_mist,m[0],m[1],m[2]),g.uniform4f(b.u_fade,h[0],h[1],h[2],a.fade);let v=Math.min(640,Math.ceil(2*a.halfW*o*1/64)*64);v>c&&(C(v),p=[],w()),j()},draw(e,t){u[0]=e*Math.PI/180,u[1]=t*Math.PI/180,j()},refresh(e){x(),e&&(p=[],g?c=0:w()),a&&M.resize(a)}};if(x(),g){if(!S())return i.remove(),null;i.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),d=!0,f++,cancelAnimationFrame(T),T=0,p=[]}),i.addEventListener(`webglcontextrestored`,()=>{d=!1,S()&&a&&M.resize(a)})}else if(_)w();else return i.remove(),null;return M}export{n as createRingView};
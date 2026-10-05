// 《兰亭序》书写节奏：按显示列表逐帧渲染（WebGL 墨迹显影 + 2D 叠加层）
import * as THREE from 'three';
const SW = 1920, SH = 1080, BT = 138, BB = 942;
const film = await (await fetch('film.json')).json(); const M = film.meta;
const txt = film.frames.flatMap(f => f.o.filter(o => o.k === 't').map(o => o.s)).join('') + '0123456789.s×第行';
const fams = ['Ma Shan Zheng', 'LXGW WenKai', 'Noto Serif SC'];
await Promise.all(fams.map(f => document.fonts.load(`40px "${f}"`, [...new Set(txt)].join(''))));
await document.fonts.ready;

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SW, SH, false); renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setClearColor(0x000000, 1);
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(0, SW, SH, 0, -10, 10);
const L = new THREE.TextureLoader();
const tex = (f) => new Promise(r => L.load(f, t => { t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; r(t); }));
const [tS, tB] = await Promise.all([tex('scroll.jpg'), tex('blank.jpg')]);
const buf = await (await fetch('tmap.f32')).arrayBuffer();
const tT = new THREE.DataTexture(new Float32Array(buf), M.W, M.H, THREE.RedFormat, THREE.FloatType);
tT.flipY = false; tT.minFilter = tT.magFilter = THREE.NearestFilter; tT.needsUpdate = true;

const VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FS = `precision highp float; uniform sampler2D tS,tB,tT; uniform vec4 uR; uniform vec2 uSz;
uniform float uT,uA,uMode,uGhost,uWet,uDim,uPaper,uSharp; uniform vec2 uTR; varying vec2 vUv;
void main(){
  vec2 px=mix(uR.xy,uR.zw,vec2(vUv.x,1.-vUv.y)); vec2 uv=px/uSz;
  vec3 sc=texture2D(tS,uv).rgb; vec3 bl=texture2D(tB,uv).rgb; float tm=texture2D(tT,uv).r;
  if(uSharp>0.){ vec2 d=1./uSz; vec3 av=(texture2D(tS,uv+vec2(d.x,0.)).rgb+texture2D(tS,uv-vec2(d.x,0.)).rgb+texture2D(tS,uv+vec2(0.,d.y)).rgb+texture2D(tS,uv-vec2(0.,d.y)).rgb)*.25; sc=clamp(sc+(sc-av)*uSharp,0.,1.); }
  float vis = tm<0. ? 1. : smoothstep(-0.012,0.012,uT-tm);
  if(uMode>.5){ float lum=dot(sc,vec3(.3,.59,.11)); float ink=clamp((0.44-lum)/0.26,0.,1.)*vis*step(uTR.x,tm)*step(tm,uTR.y); gl_FragColor=vec4(vec3(.06,.05,.045),ink*uA); return; }
  vec3 col=mix(bl,sc,max(vis,uGhost*step(0.,tm)));
  float age=uT-tm; if(tm>=0. && uWet>0. && age>0. && age<uWet){ float k=1.-age/uWet; col*=1.-.22*k*k; }
  float pl=dot(bl,vec3(.3,.59,.11)); vec3 paper=vec3(.86,.78,.63)*(.94+.12*(pl-.6));
  col=mix(col,paper,uPaper);
  col=mix(col,col*.22,uDim);
  gl_FragColor=vec4(col,uA);
}`;
const quads = {};
function quad(id) {
  if (quads[id]) return quads[id];
  const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { tS: { value: tS }, tB: { value: tB }, tT: { value: tT }, uR: { value: new THREE.Vector4() }, uSz: { value: new THREE.Vector2(M.W, M.H) },
      uT: { value: 0 }, uA: { value: 1 }, uMode: { value: 0 }, uGhost: { value: 0 }, uWet: { value: 0 }, uDim: { value: 0 }, uPaper: { value: 0 }, uSharp: { value: 0 }, uTR: { value: new THREE.Vector2(-1e9, 1e9) } } });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); q.frustumCulled = false; scene.add(q); quads[id] = q; return q;
}

// 叠加层
const ov = document.getElementById('ov'), g = ov.getContext('2d');
const FONT = { ma: '"Ma Shan Zheng"', wk: '"LXGW WenKai"', serif: '"Noto Serif SC"' };
function drawStrip(N, a) {
  const x0 = 120, x1 = 1800, yb = 1062, S = M.strip, n = S.length, bw = (x1 - x0) / n;
  g.globalAlpha = a; g.fillStyle = '#5a5040'; g.fillRect(x0, yb, x1 - x0, 1);
  for (let i = 0; i < n; i++) { const [t0, d, line, zhi] = S[i]; if (N < t0) break;
    const h = Math.min(40, 6 + d * 13); g.fillStyle = zhi ? '#e9c27a' : (line % 2 ? '#d8cbb0' : '#a8987a');
    g.fillRect(x0 + i * bw, yb - h, Math.max(1, bw - 1), h); }
  g.globalAlpha = 1;
}
function overlay(list) {
  g.clearRect(0, 0, SW, SH);
  g.fillStyle = '#000'; g.fillRect(0, 0, SW, BT); g.fillRect(0, BB, SW, SH - BB);
  // 画面暗角
  const vg = g.createRadialGradient(SW / 2, (BT + BB) / 2, 300, SW / 2, (BT + BB) / 2, 1150);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,2,.38)'); g.fillStyle = vg; g.fillRect(0, BT, SW, BB - BT);
  for (const o of list) {
    if (o.k === 'strip') { drawStrip(o.N, o.a); continue; }
    g.globalAlpha = o.a;
    if (o.k === 'r') { if (o.fl) { g.fillStyle = o.c; g.fillRect(o.x, o.y, o.w, o.h); } else { g.strokeStyle = o.c; g.lineWidth = o.st; g.strokeRect(o.x, o.y, o.w, o.h); } }
    else if (o.k === 't') { g.font = `${o.z}px ${FONT[o.f]}`; g.textAlign = o.al; g.textBaseline = 'middle'; g.fillStyle = o.c;
      if (o.c.startsWith('#e') || o.c.startsWith('#c') || o.c.startsWith('#d')) { g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; }
      g.fillText(o.s, o.x, o.y); g.shadowBlur = 0; }
  }
  g.globalAlpha = 1;
}

window.renderFrame = (fi) => {
  const fr = film.frames[fi];
  for (const k in quads) quads[k].visible = false;
  let order = 0;
  for (const qq of fr.q) {
    const [id, x, y, w, h, u0, v0, u1, v1, t, a, mode, ghost, wet, dim, paper, tr0, tr1] = qq;
    const q = quad(id); q.visible = true; q.renderOrder = order++;
    q.position.set(x + w / 2, SH - (y + h / 2), 0); q.scale.set(w, h, 1);
    const U = q.material.uniforms; U.uR.value.set(u0, v0, u1, v1); U.uT.value = t; U.uA.value = a; U.uMode.value = mode;
    U.uGhost.value = ghost; U.uWet.value = wet; U.uDim.value = dim; U.uPaper.value = paper || 0; U.uTR.value.set(tr0 ?? -1e9, tr1 ?? 1e9);
    U.uSharp.value = id === 'scroll' ? 0 : Math.min(.9, Math.max(0, (w / (u1 - u0) - 1) * .45));
  }
  renderer.render(scene, cam);
  overlay(fr.o);
  return fr.q.length;
};
const outC = document.createElement('canvas'); outC.width = SW; outC.height = SH; const outG = outC.getContext('2d');
window.grab = (fi, q = .94) => { window.renderFrame(fi); outG.drawImage(canvas, 0, 0); outG.drawImage(ov, 0, 0); return outC.toDataURL('image/jpeg', q); };
window.N = M.n; window.ready = true;

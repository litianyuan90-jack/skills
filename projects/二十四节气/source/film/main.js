// 总控：时间轴 → 两个世界 → 水墨转场合成 → 泛光 → 调色 → 叠加层
import * as THREE from 'three';
import { EffectComposer } from './node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import { ShaderPass } from './node_modules/three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitWorld } from './orbit.js';
import { LandWorld } from './land.js';
import { Overlay } from './overlay.js';
import { GLSL_NOISE, clamp, smooth } from './util.js';

const W = 1080, H = 1920, TR = .6;
const grid = await (await fetch('beat_grid.json')).json();
const FPS = grid.fps, shots = grid.shots, TOTAL = grid.total;

// 字体预载（含全片所有用字）
const allText = shots.map(s => [s.narr, s.caption, s.term, (s.poem || []).join(''), (s.hou || []).join(''), s.src, s.ch, s.big, s.sub, s.date, s.lamcn].filter(Boolean).join('')).join('')
  + '二十四节气序章卷一二三四春夏秋冬尾声太阳黄经直射北纬南纬赤道公历回归线点°0123456789/度人类非遗淮南子西汉刘安主持编撰天文训黄帝内经素问四气调神大论中国人通过观察周年运动而形成的时间知识体系及其实践画面旁白配乐音效混音全部由代码生成立清明谷雨小满芒种暑处白露寒霜降雪大';
const fams = ['Zhi Mang Xing', 'Ma Shan Zheng', 'Liu Jian Mao Cao', 'LXGW WenKai', 'Noto Serif SC'];
await Promise.all(fams.flatMap(f => [document.fonts.load(`64px "${f}"`, allText), document.fonts.load(`600 64px "${f}"`, '0123456789°/'), document.fonts.load(`200 64px "${f}"`, '0123456789°/')]));
await document.fonts.ready;

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const RS = window.RS ?? .8334; const mkRT = () => new THREE.WebGLRenderTarget(Math.round(W * RS), Math.round(H * RS), { type: THREE.HalfFloatType, samples: (window.MSAA ?? 4) });
const rtA = mkRT(), rtB = mkRT();

const orbit = new OrbitWorld(renderer, W, H);
const land = new LandWorld(renderer, W, H);
const overlay = new Overlay(document.getElementById('ov'), W, H);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.setPixelRatio(1); composer.setSize(W, H);
const comp = new ShaderPass({ uniforms: { tDiffuse: { value: null }, tA: { value: rtA.texture }, tB: { value: rtB.texture }, uP: { value: 2 }, uSeed: { value: 0 }, uHeat: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: GLSL_NOISE + `uniform sampler2D tA,tB; uniform float uP,uSeed,uHeat,uTime; varying vec2 vUv;
    void main(){ vec2 uv=vUv; uv.x+=uHeat*.0025*sin(uv.y*90.+uTime*3.)*smoothstep(.75,.3,uv.y);
      vec3 b=texture2D(tB,uv).rgb; if(uP>1.5){ gl_FragColor=vec4(b,1.); return; }
      vec3 a=texture2D(tA,vUv).rgb;
      vec2 q=(vUv-.5)*vec2(1.,1.78); float m=fbm(vUv*vec2(2.6,4.6)+uSeed)*.62+(1.-length(q)*1.1)*.38+ fbm(vUv*vec2(14.,25.)+uSeed)*.08;
      float p=uP*1.25-.12; float k=smoothstep(m-.06,m+.02,p);
      vec3 c=mix(a,b,k); float edge=smoothstep(.0,.07,abs(p-m)); c*=mix(.35,1.,edge);
      gl_FragColor=vec4(c,1.); }` });
comp.uniforms.tA.value = rtA.texture; comp.uniforms.tB.value = rtB.texture; comp.needsSwap = true; composer.addPass(comp);
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 3, H / 3), .5, .55, .92); composer.addPass(bloom);
const fin = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uExp: { value: 1 }, uSat: { value: 1 }, uTime: { value: 0 }, uFade: { value: 1 }, uWarm: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: GLSL_NOISE + `uniform sampler2D tDiffuse; uniform float uExp,uSat,uTime,uFade,uWarm; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
    void main(){ vec2 q=vUv-.5; float r2=dot(q*vec2(1.,1.6),q*vec2(1.,1.6));
      vec3 c; c.r=texture2D(tDiffuse,vUv-q*.0035*r2).r; c.g=texture2D(tDiffuse,vUv).g; c.b=texture2D(tDiffuse,vUv+q*.0035*r2).b;
      c=aces(c*uExp); c=pow(c,vec3(1./2.2));
      float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,uSat);
      c+=vec3(.03,.012,-.02)*smoothstep(.45,1.,l)*(1.+uWarm)+vec3(-.022,.004,.02)*smoothstep(.5,.0,l);
      c*=1.-.42*smoothstep(.12,.75,r2);
      c+=(hash12(vUv*vec2(1080.,1920.)+fract(uTime*7.3)*100.)-.5)*.045;
      gl_FragColor=vec4(clamp(c,0.,1.)*uFade,1.); }` });
composer.addPass(fin);

const GRADE = { orbit: [1.05, 1.0], land: { dawn: [1.0, 1.05], overcast: [1.05, .9], storm: [1.15, .95], misty: [1.0, .92], soft: [1.0, 1.0], noon: [.95, 1.08], sunset: [1.0, 1.1],
  haze: [.95, .95], night: [1.45, 1.05], clear: [.95, 1.08], dusk: [1.2, 1.0], snowday: [1.0, .85], coldclear: [.95, 1.0] } };

function shotAt(T) { let i = shots.findIndex(s => T >= s.start && T < s.start + s.dur); if (i < 0) i = shots.length - 1; return i; }
function renderShot(s, lt, rt, T) {
  let ann = {};
  if (s.kind === 'land') { land.update(s, lt, T); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(land.scene, land.cam); }
  else { ann = orbit.update(s, lt, T); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(orbit.scene, orbit.cam); }
  return ann;
}
window.renderFrame = (f) => {
  const t0 = performance.now();
  const T = f / FPS; const i = shotAt(T), s = shots[i], lt = T - s.start;
  const ann = renderShot(s, lt, rtB, T);
  if (lt < TR && i > 0) { const p = shots[i - 1]; renderShot(p, p.dur + lt, rtA, T); comp.uniforms.uP.value = lt / TR; comp.uniforms.uSeed.value = i * 3.7; }
  else comp.uniforms.uP.value = 2;
  comp.uniforms.uHeat.value = s.kind === 'land' && s.scene.heat ? 1 : 0; comp.uniforms.uTime.value = T;
  const g = s.kind === 'land' ? GRADE.land[s.scene.tod] : GRADE.orbit;
  bloom.threshold = s.kind === 'land' ? 1.7 : .92; bloom.strength = s.kind === 'land' ? .6 : .5;
  fin.uniforms.uExp.value = g[0]; fin.uniforms.uSat.value = g[1]; fin.uniforms.uTime.value = T;
  fin.uniforms.uFade.value = smooth(0, 1.4, T) * (1 - smooth(TOTAL - 1.8, TOTAL - .05, T));
  renderer.setRenderTarget(null); composer.render();
  const t1 = performance.now(); const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t2 = performance.now(); overlay.draw(T, s, lt, ann, TOTAL); const t3 = performance.now(); window.lastTiming = [t2 - t0, t3 - t2];
  const ov = document.getElementById('ov'); ov.style.opacity = smooth(0, 1.4, T) * (1 - smooth(TOTAL - 1.8, TOTAL - .05, T));
  return { shot: s.id, boxes: overlay.boxes };
};
const outC = document.createElement('canvas'); outC.width = W; outC.height = H; const outG = outC.getContext('2d');
window.grab = (f, q = .94) => {
  const r = window.renderFrame(f); outG.globalAlpha = 1; outG.drawImage(canvas, 0, 0);
  outG.globalAlpha = +document.getElementById('ov').style.opacity; outG.drawImage(document.getElementById('ov'), 0, 0); outG.globalAlpha = 1;
  r.jpg = outC.toDataURL('image/jpeg', q); r.t = window.lastTiming; return r;
};
window.layout = (f) => {
  const T = f / FPS; const i = shotAt(T), s = shots[i], lt = T - s.start; let ann = {};
  if (s.kind !== 'land') ann = orbit.update(s, lt, T);
  overlay.rec = []; overlay.draw(T, s, lt, ann, TOTAL); const r = overlay.rec; overlay.rec = null; return { shot: s.id, boxes: r };
};
window.dbg = { land, orbit, renderer, bloom, composer, rtA, rtB, fin, comp };
window.ready = true;

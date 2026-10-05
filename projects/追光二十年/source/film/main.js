// 《追光二十年》总控：时间轴 → 场景 → 转场合成 → 泛光 → 调色；2D 叠加层负责字幕、数据与图表
import * as THREE from 'three';
import { EffectComposer } from './node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import { ShaderPass } from './node_modules/three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GLSL_NOISE, clamp, lerp, smooth, easeIO, D2R } from './util.js';
import { Earth } from './earth.js';
import { MapScene, xz } from './mapscene.js';
import { Desert } from './desert.js';
import { City } from './city.js';
import { Overlay } from './overlay.js';

const W = 1920, H = 804, FPS = 24, TOTAL = 122;
const D = await (await fetch('data.json')).json();
const pts = await (await fetch('terrain_pts.json')).json();
await document.fonts.load('64px "Noto Serif SC"', D.allText); await document.fonts.load('600 64px "Noto Serif SC"', D.allText);
await document.fonts.load('64px "LXGW WenKai"', D.allText); await document.fonts.load('200 64px "Noto Serif SC"', '0123456789.%—'); await document.fonts.ready;

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
const RS = .82, mk = () => new THREE.WebGLRenderTarget(Math.round(W * RS), Math.round(H * RS), { type: THREE.HalfFloatType, samples: 4 });
const rtA = mk(), rtB = mk();
const earth = new Earth(W, H), map = new MapScene(W, H, pts, D.WIND, D.SOLAR), desert = new Desert(W, H), city = new City(W, H);
const ov = new Overlay(document.getElementById('ov'), D);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType })); composer.setPixelRatio(1); composer.setSize(W, H);
const comp = new ShaderPass({ uniforms: { tDiffuse: { value: null }, tA: { value: null }, tB: { value: null }, uP: { value: 2 }, uT: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: GLSL_NOISE + `uniform sampler2D tA,tB; uniform float uP,uT; varying vec2 vUv;
    void main(){ vec3 b=texture2D(tB,vUv).rgb; if(uP>1.5){ gl_FragColor=vec4(b,1.); return; }
      vec3 a=texture2D(tA,vUv).rgb; float m=vUv.x*.85+vUv.y*.15+(fbm(vUv*vec2(3.,2.))-.5)*.18; float p=uP*1.3-.15;
      float k=smoothstep(m-.08,m+.08,p); float band=exp(-pow((p-m)*9.,2.));
      vec3 c=mix(a,b,k)+vec3(1.,.82,.55)*band*.7; gl_FragColor=vec4(c,1.); }` });
comp.uniforms.tA.value = rtA.texture; comp.uniforms.tB.value = rtB.texture; composer.addPass(comp);
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 3, H / 3), .75, .6, .82); composer.addPass(bloom);
const fin = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uExp: { value: 1 }, uFade: { value: 1 }, uWarm: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: GLSL_NOISE + `uniform sampler2D tDiffuse; uniform float uT,uExp,uFade,uWarm; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
    void main(){ vec2 q=vUv-.5; float r2=dot(q*vec2(1.,.42),q*vec2(1.,.42))*3.2;
      vec3 c; c.r=texture2D(tDiffuse,vUv-q*.004*r2).r; c.g=texture2D(tDiffuse,vUv).g; c.b=texture2D(tDiffuse,vUv+q*.004*r2).b;
      c=aces(c*uExp); c=pow(c,vec3(1./2.2)); float l=dot(c,vec3(.299,.587,.114));
      c+=vec3(.035,.012,-.02)*smoothstep(.45,1.,l)*(1.+uWarm)+vec3(-.02,.005,.03)*smoothstep(.45,0.,l);
      c=mix(vec3(l),c,1.06); c*=1.-.35*smoothstep(.15,.85,r2);
      c+=(hash12(vUv*vec2(1920.,804.)+fract(uT*7.1)*100.)-.5)*.04;
      gl_FragColor=vec4(clamp(c,0.,1.)*uFade,1.); }` });
composer.addPass(fin);

// ---------------- 时间轴 ----------------
const e = (a, b, t) => easeIO(clamp((t - a) / (b - a), 0, 1));
const yr = (s, t) => { const ys = Object.keys(s).map(Number).sort((a, b) => a - b); if (t <= ys[0]) return s[ys[0]]; for (let i = 1; i < ys.length; i++) if (t <= ys[i]) return lerp(s[ys[i - 1]], s[ys[i]], t - ys[i - 1]); return s[ys[ys.length - 1]]; };
export const SHOTS = [
  { id: 'A', t0: 0, t1: 15.6, scene: 'earth' }, { id: 'B', t0: 14.4, t1: 45.6, scene: 'map' }, { id: 'C', t0: 44.4, t1: 65.9, scene: 'desert' },
  { id: 'D', t0: 64.7, t1: 101.2, scene: 'city' }, { id: 'F', t0: 100.0, t1: TOTAL, scene: 'earth' }];
export function state(t) {
  const s = { t };
  // 年份
  if (t < 15) s.year = 2005; else if (t < 45) s.year = 2005 + 15 * e(16, 36.25, t); else if (t < 65.3) s.year = 2020 + 5 * e(46, 60, t);
  else if (t < 80.5) s.year = 2015 + 10 * e(66, 77, t); else if (t < 100.6) s.year = 2026 + 4 * e(82, 98, t); else s.year = 2025;
  s.wind = yr(D.WIND, Math.min(s.year, 2025)); s.solar = yr(D.SOLAR, Math.min(s.year, 2025));
  s.pen = t >= 64 && t < 101 ? yr(D.NEV_PEN_FULL, Math.min(s.year, 2025)) : 0;
  return s;
}
function shotParams(sh, t) {
  const S = state(t); const k = (a, b) => e(a, b, t);
  if (sh.id === 'A') return { kind: 'earth', p: { lon: lerp(100, 106, k(0, 15)), lat: lerp(26, 33, k(0, 15)), dist: lerp(44, 22, k(0, 15.6)), tilt: lerp(6, 26, k(0, 15.6)), yaw: lerp(-4, 2, k(0, 15)),
    sunLon: -50, sunLat: 8, glow: .1 + .15 * k(8, 15), fov: 30, arcs: 0, night: 1.2, lookN: lerp(0, 3, k(0, 15)) } };
  if (sh.id === 'B') {
    const lonC = lerp(lerp(90, 112, k(15, 33)), 104, k(37, 44)); const [cx] = xz(lonC, 35);
    return { kind: 'map', p: { year: S.year, cx, cz: lerp(-1, 1.5, k(15, 44)), dist: lerp(lerp(38, 44, k(15, 33)), 66, k(36, 44.5)), tilt: lerp(lerp(52, 38, k(15, 33)), 58, k(36, 44.5)),
      yaw: lerp(-14, 8, k(15, 44)), fov: 34 } };
  }
  if (sh.id === 'C') { const u = k(44.4, 65.9); return { kind: 'desert', p: { px: lerp(10, -60, u), py: lerp(14, 120, Math.pow(u, 1.3)), pz: lerp(90, 20, u), tx: lerp(-20, -120, u), ty: lerp(2, -20, u), tz: lerp(-160, -520, u),
    fov: lerp(46, 40, u), grow: .55 + .45 * k(46, 60) } }; }
  if (sh.id === 'D') {
    const u = k(64.7, 80.5), v = k(80.5, 101.2); const ang = lerp(-35, -5, u) * D2R + lerp(0, 25, v) * D2R; const rad = lerp(lerp(430, 360, u), 420, v);
    return { kind: 'city', p: { px: Math.sin(ang) * rad, py: lerp(lerp(230, 170, u), 120, v), pz: Math.cos(ang) * rad, tx: lerp(0, 260, v), ty: lerp(20, 70, v), tz: lerp(0, -700, v), fov: 38,
      pen: t < 80.5 ? S.pen / 100 : lerp(.479, .85, v), dawn: k(81, 92), solar: k(84, 96), v2g: k(89, 98) } };
  }
  if (sh.id === 'F') return { kind: 'earth', p: { lon: lerp(104, 80, k(100, 122)), lat: lerp(30, 18, k(100, 122)), dist: lerp(24, 44, k(100, 113)) + 8 * k(113, 122), tilt: lerp(28, 12, k(100, 113)), yaw: lerp(4, 9, k(100, 113)),
    sunLon: 40, sunLat: 10, glow: 1, fov: 30, arcs: k(102.5, 111.5), night: 1, lookN: 0 } };
}
function renderShot(sh, t, rt) {
  const { kind, p } = shotParams(sh, t); const s = { earth, map, desert, city }[kind];
  s.update(p, t, W, H); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(s.scene, s.cam);
}
window.renderFrame = (f) => {
  const t = f / FPS; const act = SHOTS.filter(s => t >= s.t0 && t < s.t1);
  const cur = act[act.length - 1] || SHOTS[SHOTS.length - 1]; renderShot(cur, t, rtB);
  if (act.length > 1) { renderShot(act[0], t, rtA); comp.uniforms.uP.value = (t - cur.t0) / (act[0].t1 - cur.t0); } else comp.uniforms.uP.value = 2;
  comp.uniforms.uT.value = t; fin.uniforms.uT.value = t;
  fin.uniforms.uFade.value = smooth(0, 1.5, t) * (1 - smooth(TOTAL - 2.2, TOTAL - .1, t));
  fin.uniforms.uExp.value = cur.id === 'C' ? .82 : cur.id === 'D' ? (t > 81 ? lerp(1.1, .85, smooth(81, 88, t)) : 1.1) : (cur.id === 'F' ? lerp(1.05, .6, smooth(114.4, 116.2, t)) : 1.05);
  renderer.setRenderTarget(null); composer.render();
  ov.draw(t, state(t), cur.id);
};
const outC = document.createElement('canvas'); outC.width = 1920; outC.height = 1080; const og = outC.getContext('2d');
window.grab = (f, q = .94) => { window.renderFrame(f); og.fillStyle = '#000'; og.fillRect(0, 0, 1920, 1080); og.drawImage(canvas, 0, 138); og.drawImage(document.getElementById('ov'), 0, 0); return outC.toDataURL('image/jpeg', q); };
window.N = Math.round(TOTAL * FPS); window.ready = true;

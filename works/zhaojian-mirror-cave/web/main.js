// 照見 · The Mirror Cave
// Two facing mirrors are built as exact planar reflections: mirrored copies of the
// cave placed behind each niche (z' = 8k + (-1)^k z). That gives a true infinite
// regress in a single pass, and lets every copy carry its own depth:
//   - deeper reflections lag behind in time (uLag * depth)  -> 镜中是过去
//   - every other reflection swaps form and emptiness        -> 色即是空，空即是色
import * as THREE from 'three';

const FILM = new URLSearchParams(location.search).has('film');
const $ = (s) => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
let _seed = 20261006;
const rand = () => { _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0; let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ------------------------------------------------------------------ renderer
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: FILM, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // shaders work directly in display space
renderer.setPixelRatio(FILM ? 1 : Math.min(devicePixelRatio, 1.75));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050403);
const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 400);

const COPIES = FILM ? 6 : 5;
const ROOM = 8, HALF = 4, WALL_H = 4, APEX_Y = 6.3, APEX = 1.05;
const LAMP_LOCAL = new THREE.Vector3(1.35, 1.02, -2.55);

// ------------------------------------------------------------------ state
export const S = {
  phase: 0.24, empty: 0, alt: 1, lag: 0.03,
  dust: 0.22, still: 0, open: 1, voidA: 0, glow: 0,
  exterior: true, lampI: 1, amb: 0.14, exposure: 1,
  camPos: new THREE.Vector3(0, 1.7, 16), yaw: 0, pitch: 0.02, fov: 62, target: null, cliffGlow: 0,
};

const G = {
  uTime: { value: 0 }, uPhase: { value: S.phase }, uEmpty: { value: 0 }, uAlt: { value: 1 },
  uLag: { value: S.lag }, uLampI: { value: 1 }, uAmb: { value: S.amb }, uDoor: { value: 1 },
  uGlow: { value: 0 }, uExp: { value: 1 }, uVoid: { value: 0 }, uDust: { value: S.dust },
  uStill: { value: 0 }, uOpen: { value: 1 }, uLamp: { value: LAMP_LOCAL }, uCliffGlow: { value: 0 },
};

// ------------------------------------------------------------------ GLSL
const NOISE = /* glsl */`
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
`;
const LIGHT = /* glsl */`
uniform vec3 uLamp; uniform float uLampI, uAmb, uDoor, uExp, uTime;
vec3 lightAt(vec3 p, vec3 n){
  vec3 L = uLamp - p; float d = length(L);
  float ndl = abs(dot(normalize(n), L/d));
  vec3 lamp = vec3(1.0,0.64,0.34) * uLampI * (0.3+0.7*ndl) * 3.2 / (1.0 + 0.2*d*d);
  vec3 D = vec3(0.,1.4,4.2) - p; float dd = length(D);
  vec3 door = vec3(0.95,0.72,0.55) * uDoor * (0.35+0.65*abs(dot(normalize(n),D/dd))) * 2.2 / (1.0+0.05*dd*dd);
  return lamp + door + uAmb*vec3(0.46,0.42,0.42);
}
vec3 grade(vec3 c, float dist){
  c *= uExp;
  c = c * (1.0 + c*0.18) / (1.0 + c);          // soft shoulder
  c *= 1.35;
  float fog = 1.0 - exp(-dist*0.017);
  return mix(c, vec3(0.035,0.025,0.02), fog);
}
`;
const VS = /* glsl */`
uniform mat4 uUnitInv;
varying vec2 vUv; varying vec3 vL; varying vec3 vN; varying vec3 vW;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
  vL = (uUnitInv * w).xyz;                       // room space: lighting is identical in every reflection
  vN = normalize(mat3(uUnitInv * modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Murals: 起稿 → 敷彩 → aging (lead red darkens) → flaking → bare → 空 ; then again.
const MURAL_FS = /* glsl */`
uniform sampler2D mapC, mapL; uniform vec2 uRep; uniform float uPhase, uEmpty, uAlt, uLag, uDepth, uParity, uBand, uGlow;
varying vec2 vUv; varying vec3 vL; varying vec3 vN; varying vec3 vW;
${NOISE}
${LIGHT}
void main(){
  vec3 C = texture2D(mapC, vUv).rgb;
  vec3 L = texture2D(mapL, vUv).rgb;
  vec2 q = vUv * uRep;
  float n  = clamp((fbm(q*1.3 + 11.0) - 0.22) / 0.56, 0., 1.);
  float n2 = clamp((fbm(q*7.0 + 3.7) - 0.22) / 0.56, 0., 1.);
  float ph = fract(uPhase - uDepth * uLag + 1.0);

  float lineA  = smoothstep(0.0, 0.05, ph - n2*0.04);
  float colA   = smoothstep(0.0, 0.035, ph - (0.07 + n*0.11));
  float age    = smoothstep(0.18, 0.85, ph);
  float nf = n*0.72 + n2*0.28;
  float flake  = smoothstep(0.0, 0.02, ph - (0.56 + nf*0.30));
  float deep   = smoothstep(0.0, 0.03, ph - (0.70 + nf*0.22));
  float lineLost = smoothstep(0.0, 0.05, ph - (0.84 + n2*0.10));
  float renew  = smoothstep(0.985, 1.0, ph);

  vec3 plaster = vec3(0.80,0.74,0.62) * (0.92 + 0.08*n2);
  vec3 earth   = vec3(0.47,0.33,0.22) * (0.85 + 0.2*n);

  float red = clamp(C.r - (C.g + C.b)*0.5, 0., 1.);
  vec3 Ca = C * (1.0 - age * red * 1.25 * smoothstep(0.25, 0.75, n2 + 0.15)); // 铅丹变黑
  float lum = dot(Ca, vec3(0.3,0.59,0.11));
  Ca = mix(Ca, vec3(lum)*vec3(1.02,0.96,0.86), age*0.3) * (1.0 - age*0.12);

  float ink = 1.0 - smoothstep(0.55, 0.9, dot(L, vec3(0.33)));
  vec3 sketch = mix(plaster, vec3(0.45,0.22,0.14), ink * lineA * (1.0 - lineLost));
  vec3 col = mix(sketch, Ca, colA * (1.0 - flake));
  vec3 bare = mix(plaster*0.94, earth, deep);
  col = mix(col, mix(bare, sketch, (1.0-lineLost)*0.5*(1.0-deep)), flake);
  col = mix(col, plaster*0.9, renew);

  // 色 / 空 : the mirror shows the other one, alternating with every reflection.
  float e = mix(uEmpty, uParity > 0.5 ? 1.0 - uEmpty : uEmpty, uAlt);
  vec3 emptyV = mix(vec3(0.88,0.84,0.76), vec3(0.42,0.24,0.16), ink * lineA * (1.0 - lineLost));
  col = mix(col, emptyV, e);

  vec3 lit = col * lightAt(vL, vN);
  float band = uBand > 1.5 ? 1.0 : (uBand > 0.5 ? smoothstep(0.76, 0.78, vUv.y) : 0.0);
  lit += vec3(1.0,0.72,0.32) * uGlow * band * (0.25 + 0.5*lum) * (1.0 - e*0.5);
  gl_FragColor = vec4(grade(lit, distance(vW, cameraPosition)), 1.0);
}`;

const FLOOR_FS = /* glsl */`
varying vec2 vUv; varying vec3 vL; varying vec3 vN; varying vec3 vW;
${NOISE}
${LIGHT}
void main(){
  float n = fbm(vL.xz*1.7), m = fbm(vL.xz*9.0+4.0);
  vec3 c = mix(vec3(0.30,0.22,0.16), vec3(0.42,0.32,0.22), n) * (0.85+0.3*m);
  gl_FragColor = vec4(grade(c * lightAt(vL, vec3(0.,1.,0.)), distance(vW, cameraPosition)), 1.0);
}`;

const FRAME_FS = /* glsl */`
varying vec2 vUv; varying vec3 vL; varying vec3 vN; varying vec3 vW;
uniform float uVoid;
${NOISE}
${LIGHT}
void main(){
  float a = atan(vL.y - 1.35, vL.x);
  float s = vL.y > 1.35 ? a * 7.0 : vL.y * 3.0;
  float k = mod(floor(s), 3.0);
  vec3 c = k < 0.5 ? vec3(0.27,0.52,0.45) : (k < 1.5 ? vec3(0.56,0.22,0.15) : vec3(0.78,0.58,0.30));
  float flame = smoothstep(0.4, 0.6, fract(s) + 0.25*sin(fract(s)*6.28));
  c = mix(c, vec3(0.86,0.72,0.45), flame*0.35);
  float dissolve = fbm(vL.xy*6.0);
  if (dissolve < uVoid*1.15 - 0.05) discard;
  vec3 lit = c * lightAt(vL, vN);
  lit += vec3(1.0,0.7,0.35) * smoothstep(0.06,0.0,abs(dissolve - (uVoid*1.15-0.05))) * step(0.001,uVoid) * 1.5;
  gl_FragColor = vec4(grade(lit, distance(vW, cameraPosition)), 1.0);
}`;

// Bronze mirror: a multiply layer (each reflection loses a little light and warms),
// plus dust and breath-mist that the visitor wipes away.
const TINT_FS = /* glsl */`
uniform float uVoid, uOpenEff;
varying vec2 vUv;
void main(){
  float on = (1.0 - uVoid) * (1.0 - uOpenEff);
  vec3 bronze = vec3(0.95,0.83,0.66);
  float edge = smoothstep(0.0, 0.08, min(min(vUv.x, 1.0-vUv.x), vUv.y));
  vec3 t = mix(vec3(1.0), bronze * mix(0.78, 0.92, edge), on);
  gl_FragColor = vec4(t, 1.0);
}`;
const DUST_FS = /* glsl */`
uniform sampler2D tWipe; uniform float uDust, uStill, uVoid, uOpenEff, uParityM;
varying vec2 vUv; varying vec3 vL; varying vec3 vN; varying vec3 vW;
${NOISE}
${LIGHT}
void main(){
  float on = (1.0 - uVoid) * (1.0 - uOpenEff);
  float wipe = texture2D(tWipe, vUv).r;
  float grain = fbm(vUv*vec2(26.0,30.0)) * 0.7 + hash(vUv*900.0) * 0.3;
  float streak = fbm(vec2(vUv.x*3.0, vUv.y*40.0));
  float dust = clamp(uDust * (0.55 + grain*0.8) - wipe*1.1, 0.0, 1.0);
  float edge = 1.0 - smoothstep(0.0, 0.12, min(min(vUv.x, 1.0-vUv.x), vUv.y));
  float mist = (1.0 - uStill) * 0.1 * (0.6 + 0.4*fbm(vUv*3.0 + uTime*0.05));
  float a = clamp(dust*0.62 + mist + edge*0.2*uDust, 0.0, 0.9) * on;
  vec3 c = mix(vec3(0.66,0.58,0.46), vec3(0.78,0.70,0.56), streak) * lightAt(vL, vec3(0.,0.,1.));
  gl_FragColor = vec4(grade(c, distance(vW, cameraPosition)), a);
}`;
// The open doorway: dusk light that crystallises into a mirror.
const DOOR_FS = /* glsl */`
uniform float uOpenEff;
varying vec2 vUv; varying vec3 vL;
${NOISE}
void main(){
  float n = fbm(vL.xy*3.2);
  float cut = (1.0 - uOpenEff) * 1.25;
  if (n < cut - 0.12) discard;
  vec3 sky = mix(vec3(0.98,0.70,0.40), vec3(0.32,0.30,0.48), smoothstep(0.05, 1.0, vUv.y));
  sky += vec3(1.0,0.82,0.55) * exp(-12.0*length(vUv - vec2(0.5,0.18))) * 1.4;
  float rim = smoothstep(0.12, 0.0, abs(n - (cut - 0.12)));
  vec3 c = sky * 1.15 + vec3(1.0,0.8,0.5) * rim * 2.0 * step(0.01, 1.0 - uOpenEff);
  gl_FragColor = vec4(c / (1.0 + 0.25*c), 1.0);
}`;

// ------------------------------------------------------------------ textures
const loader = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const T = {};
const texNames = ['wall_n', 'wall_s', 'wall_w', 'wall_e', 'slope0', 'slope1', 'slope2', 'slope3', 'caisson'];
function loadTex(url) {
  return new Promise((res, rej) => loader.load(url, (t) => {
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = Math.min(8, maxAniso);
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; res(t);
  }, undefined, rej));
}
async function loadAll(onProgress) {
  const list = texNames.flatMap((n) => [`${n}_c`, `${n}_l`]);
  let done = 0;
  await Promise.all(list.map(async (n) => { T[n] = await loadTex(`tex/${n}.jpg`); onProgress?.(++done / list.length); }));
}

// ------------------------------------------------------------------ geometry
function nichePath(P, grow = 0) {
  const w = 1.4 + grow, h = 1.35;
  P.moveTo(-w, 0); P.lineTo(w, 0); P.lineTo(w, h); P.absarc(0, h, w, 0, Math.PI, false); P.lineTo(-w, 0);
  return P;
}
function wallWithNiche() {
  const s = new THREE.Shape();
  s.moveTo(-HALF, 0); s.lineTo(HALF, 0); s.lineTo(HALF, WALL_H); s.lineTo(-HALF, WALL_H); s.lineTo(-HALF, 0);
  s.holes.push(nichePath(new THREE.Path()));
  const g = new THREE.ShapeGeometry(s, 48);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + HALF) / ROOM, p.getY(i) / WALL_H);
  return g;
}
function nicheGeo() {
  const g = new THREE.ShapeGeometry(nichePath(new THREE.Shape()), 48);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.4) / 2.8, p.getY(i) / 2.75);
  return g;
}
function frameGeo() {
  const s = nichePath(new THREE.Shape(), 0.16);
  s.holes.push(nichePath(new THREE.Path(), 0));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false, curveSegments: 48 });
  return g;
}
// bilinear grid between four corners -> clean texture mapping on the trapezoid slopes
function quadGrid(p00, p10, p01, p11, seg = 24) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
    const u = i / seg, v = j / seg;
    const a = p00.clone().lerp(p10, u), b = p01.clone().lerp(p11, u);
    const p = a.lerp(b, v);
    pos.push(p.x, p.y, p.z); uv.push(u, v);
  }
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const GEO = {};
function buildGeo() {
  GEO.niched = wallWithNiche();
  GEO.side = new THREE.PlaneGeometry(ROOM, WALL_H, 1, 1);
  GEO.niche = nicheGeo();
  GEO.frame = frameGeo();
  GEO.floor = new THREE.PlaneGeometry(ROOM, ROOM, 1, 1);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // slopes: bottom edge along the wall top, top edge at the apex square; v=1 toward apex
  GEO.slopes = [
    quadGrid(V(-HALF, WALL_H, -HALF), V(HALF, WALL_H, -HALF), V(-APEX, APEX_Y, -APEX), V(APEX, APEX_Y, -APEX)), // west
    quadGrid(V(HALF, WALL_H, -HALF), V(HALF, WALL_H, HALF), V(APEX, APEX_Y, -APEX), V(APEX, APEX_Y, APEX)),     // north
    quadGrid(V(HALF, WALL_H, HALF), V(-HALF, WALL_H, HALF), V(APEX, APEX_Y, APEX), V(-APEX, APEX_Y, APEX)),     // east
    quadGrid(V(-HALF, WALL_H, HALF), V(-HALF, WALL_H, -HALF), V(-APEX, APEX_Y, APEX), V(-APEX, APEX_Y, -APEX)), // south
  ];
  GEO.caisson = new THREE.PlaneGeometry(APEX * 2, APEX * 2);
}

// ------------------------------------------------------------------ materials
function muralMat(name, rep, depth, parity, band = 0, side = THREE.FrontSide, U = CUR) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...G, mapC: { value: T[`${name}_c`] }, mapL: { value: T[`${name}_l`] },
      uRep: { value: new THREE.Vector2(rep[0], rep[1]) }, uDepth: { value: depth },
      uParity: { value: parity }, uBand: { value: band }, uUnitInv: U.uUnitInv,
    },
    vertexShader: VS, fragmentShader: MURAL_FS, side,
  });
}
const CUR = { uUnitInv: null };
const plainMat = (fs, extra = {}, opts = {}) => new THREE.ShaderMaterial({ uniforms: { ...G, uUnitInv: CUR.uUnitInv, ...extra }, vertexShader: VS, fragmentShader: fs, ...opts });

// flame sprite texture
function flameTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,248,220,1)'); g.addColorStop(0.18, 'rgba(255,200,110,.9)');
  g.addColorStop(0.45, 'rgba(255,130,40,.28)'); g.addColorStop(1, 'rgba(255,90,20,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

// wipe canvases (where the visitor has wiped the dust)
function wipeLayer() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
  return { c, x, t };
}
const WIPE = { west: null, east: null };

// ------------------------------------------------------------------ cave unit
const units = [];
let realUnit = null;
const lampFlames = [];

function buildUnit(k) {
  const depth = Math.abs(k), parity = depth % 2;
  const g = new THREE.Group();
  g.position.z = ROOM * k;
  g.scale.z = parity ? -1 : 1;
  g.userData = { k, depth };
  g.updateMatrixWorld(true);
  CUR.uUnitInv = { value: g.matrixWorld.clone().invert() };

  const add = (geo, mat, setup) => { const m = new THREE.Mesh(geo, mat); setup?.(m); g.add(m); return m; };

  add(GEO.niched, muralMat('wall_w', [8, 4], depth, parity, 1), (m) => { m.position.z = -HALF; });
  add(GEO.niched, muralMat('wall_e', [8, 4], depth, parity, 1), (m) => { m.position.z = HALF; m.rotation.y = Math.PI; });
  add(GEO.side, muralMat('wall_s', [8, 4], depth, parity, 1), (m) => { m.position.set(-HALF, WALL_H / 2, 0); m.rotation.y = Math.PI / 2; });
  add(GEO.side, muralMat('wall_n', [8, 4], depth, parity, 1), (m) => { m.position.set(HALF, WALL_H / 2, 0); m.rotation.y = -Math.PI / 2; });
  GEO.slopes.forEach((geo, i) => add(geo, muralMat(`slope${i}`, [6, 3], depth, parity, 2, THREE.DoubleSide)));
  add(GEO.caisson, muralMat('caisson', [2, 2], depth, parity, 0, THREE.DoubleSide), (m) => { m.position.y = APEX_Y; m.rotation.x = Math.PI / 2; });
  add(GEO.floor, plainMat(FLOOR_FS), (m) => { m.rotation.x = -Math.PI / 2; });

  const frameMat = plainMat(FRAME_FS);
  add(GEO.frame, frameMat, (m) => { m.position.z = -HALF; });
  add(GEO.frame, frameMat, (m) => { m.position.z = HALF; m.rotation.y = Math.PI; });

  // mirrors: tint (multiply) + dust (alpha) on both niches; doorway light in the east niche
  const mirrors = {};
  for (const side of ['west', 'east']) {
    const isEast = side === 'east';
    const z = isEast ? HALF - 0.003 : -HALF + 0.003;
    const uOpenEff = { value: 0 };
    const tint = new THREE.ShaderMaterial({
      uniforms: { uVoid: G.uVoid, uOpenEff, uUnitInv: CUR.uUnitInv }, vertexShader: VS, fragmentShader: TINT_FS,
      transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false,
    });
    const dust = plainMat(DUST_FS, { tWipe: { value: WIPE[side].t }, uOpenEff, uParityM: { value: parity } }, { transparent: true, depthWrite: false });
    const tm = add(GEO.niche, tint, (m) => { m.position.z = z; if (isEast) m.rotation.y = Math.PI; m.renderOrder = 2; });
    const dm = add(GEO.niche, dust, (m) => { m.position.z = z + (isEast ? -0.002 : 0.002); if (isEast) m.rotation.y = Math.PI; m.renderOrder = 3; });
    mirrors[side] = { tint: tm, dust: dm, uOpenEff };
  }
  const doorMat = new THREE.ShaderMaterial({ uniforms: { uOpenEff: mirrors.east.uOpenEff, uUnitInv: CUR.uUnitInv }, vertexShader: VS, fragmentShader: DOOR_FS });
  const door = add(GEO.niche, doorMat, (m) => { m.position.z = HALF - 0.001; m.rotation.y = Math.PI; m.renderOrder = 1; });

  // the lamp
  const lamp = new THREE.Group();
  lamp.position.copy(LAMP_LOCAL).setY(0);
  const wood = new THREE.MeshBasicMaterial({ color: 0x2a1a12 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.06, 0.94, 10), wood); stand.position.y = 0.47; lamp.add(stand);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 20), wood); base.position.y = 0.025; lamp.add(base);
  const bowlPts = [[0, 0], [0.05, 0.005], [0.085, 0.03], [0.095, 0.06], [0.09, 0.065]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 24), new THREE.MeshBasicMaterial({ color: 0x8a5a2b, side: THREE.DoubleSide }));
  bowl.position.y = 0.94; lamp.add(bowl);
  const ftex = flameTexture();
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flame.scale.set(0.085, 0.19, 1); flame.position.y = 1.04; lamp.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  halo.scale.set(0.9, 0.9, 1); halo.position.y = 1.04; lamp.add(halo);
  lampFlames.push({ flame, halo, depth });
  g.add(lamp);

  // motes of dust in the lamp light
  const N = FILM ? 700 : 500, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rand() * 2 - 1) * 3.6; pos[i * 3 + 1] = rand() * 5.2; pos[i * 3 + 2] = (rand() * 2 - 1) * 3.6; seed[i] = rand();
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const motes = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uLamp: G.uLamp, uLampI: G.uLampI, uStill: G.uStill, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */`
      attribute float seed; uniform float uTime, uLampI, uStill, uPx; uniform vec3 uLamp; varying float vA;
      void main(){
        vec3 p = position;
        float t = uTime * (0.03 + seed*0.04) * (1.0 - uStill*0.8);
        p.x += sin(t*3.0 + seed*40.0) * 0.4; p.z += cos(t*2.3 + seed*17.0) * 0.4;
        p.y = mod(p.y + t*1.6, 5.2);
        float d = distance(p, uLamp);
        vA = uLampI * (0.12 + 0.9 / (1.0 + d*d*1.4)) * (0.5 + 0.5*sin(uTime*1.3 + seed*30.0));
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = uPx * (1.2 + seed*2.2) * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vec3(1.0,0.78,0.5) * vA * (1.0 - r*2.0), 1.0); }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  g.add(motes);

  g.userData.mirrors = mirrors; g.userData.door = door; g.userData.lamp = lamp;
  return g;
}

// ------------------------------------------------------------------ exterior (Mogao cliff at dusk)
let exterior;
function buildExterior() {
  exterior = new THREE.Group();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: /* glsl */`varying vec3 vD;
      void main(){ float h = vD.y;
        vec3 c = mix(vec3(0.95,0.62,0.36), vec3(0.20,0.20,0.36), smoothstep(-0.02,0.45,h));
        c = mix(c, vec3(0.05,0.05,0.10), smoothstep(0.45,1.0,h));
        vec3 sun = normalize(vec3(-0.35,0.06,1.0));
        c += vec3(1.0,0.7,0.4) * pow(max(dot(vD,sun),0.0), 60.0) * 1.2;
        gl_FragColor = vec4(c,1.0); }`,
  }));
  exterior.add(sky);

  const s = new THREE.Shape();
  s.moveTo(-70, 0); s.lineTo(70, 0); s.lineTo(70, 34); s.lineTo(-70, 34); s.lineTo(-70, 0);
  s.holes.push(nichePath(new THREE.Path()));
  const cliff = new THREE.Mesh(new THREE.ShapeGeometry(s, 48), new THREE.ShaderMaterial({
    uniforms: { uTime: G.uTime, uCliffGlow: G.uCliffGlow },
    vertexShader: 'varying vec3 vP; varying vec3 vW; void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: /* glsl */`varying vec3 vP; varying vec3 vW; uniform float uTime, uCliffGlow; ${NOISE}
      // Mogao: several tiers of small cave mouths cut into a conglomerate cliff
      float caveMask(vec2 p, out float id){
        vec2 cell = vec2(2.7, 3.1); vec2 c = floor(p/cell); vec2 f = fract(p/cell);
        id = hash(c);
        if (c.y < 0.0 || c.y > 2.0) return 0.0;
        if (abs(p.x) < 5.0 && c.y < 1.0) return 0.0;
        if (id < 0.45) return 0.0;
        float w = 0.09 + 0.05*hash(c+7.0), h = 0.15 + 0.06*hash(c+3.0);
        vec2 q = (f - vec2(0.5 + (hash(c+1.3)-0.5)*0.3, 0.42)) / vec2(w, h);
        float d = q.y > 0.0 ? length(vec2(q.x, q.y*1.4)) : max(abs(q.x), -q.y*0.9);
        return 1.0 - smoothstep(0.92, 1.0, d);
      }
      void main(){
        float ridge = 10.5 + 4.0*fbm(vec2(vP.x*0.05, 1.0)) + 1.5*fbm(vec2(vP.x*0.4, 2.0));
        if (vP.y > ridge) discard;
        float strata = fbm(vec2(vP.x*0.04, vP.y*1.3));
        float n = fbm(vP.xy*0.7), g = fbm(vP.xy*6.0);
        vec3 c = mix(vec3(0.55,0.39,0.27), vec3(0.80,0.61,0.43), strata) * (0.78 + 0.32*n) * (0.9 + 0.2*g);
        c *= mix(0.62, 1.08, smoothstep(0.0, ridge, vP.y));           // dusk light grazing the top
        c = mix(c, vec3(0.95,0.72,0.5), smoothstep(ridge-1.2, ridge, vP.y)*0.4);
        float id; float cm = caveMask(vP.xy - vec2(0.0, 0.6), id);
        vec3 hole = vec3(0.06,0.04,0.035);
        c = mix(c, hole, cm);
        // 金光，状若千佛: rows of haloes of light spread over the cliff, like the thousand-Buddha grid
        vec2 gq = vP.xy / vec2(1.25, 1.45); vec2 gid = floor(gq); vec2 gf = fract(gq) - 0.5;
        float on = smoothstep(0.0, 0.25, uCliffGlow*1.4 - hash(gid)*0.55 - abs(vP.x)*0.028) * step(0.3, hash(gid+9.0));
        float band = smoothstep(1.5, 3.0, vP.y) * smoothstep(ridge - 0.4, ridge - 2.0, vP.y);
        float ring = smoothstep(0.05, 0.0, abs(length(gf*vec2(1.0,0.86)) - 0.24));
        float core = smoothstep(0.15, 0.0, length((gf - vec2(0.0,-0.05))*vec2(1.6,1.0)));
        float tw = 0.75 + 0.25*sin(uTime*2.0 + hash(gid+5.0)*30.0);
        c += vec3(1.0,0.76,0.36) * on * band * (ring*0.7 + core*0.6) * tw;
        c += vec3(1.0,0.7,0.35) * uCliffGlow * band * 0.18;
        float d = distance(vW, cameraPosition);
        c = mix(c, vec3(0.74,0.55,0.44), 1.0 - exp(-d*0.01));
        gl_FragColor = vec4(c,1.0);
      }`,
  }));
  cliff.position.z = HALF;
  exterior.add(cliff);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1), new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: /* glsl */`varying vec3 vW; ${NOISE}
      void main(){ float r = fbm(vec2(vW.x*0.08 + sin(vW.z*0.3)*0.6, vW.z*0.9));
        float dune = 0.5 + 0.5*sin(vW.x*0.06 + fbm(vW.xz*0.02)*6.0 + vW.z*0.02);
        vec3 c = mix(vec3(0.56,0.39,0.26), vec3(0.86,0.66,0.46), r*0.6 + dune*0.4);
        float d = distance(vW, cameraPosition);
        c = mix(c, vec3(0.80,0.58,0.42), 1.0 - exp(-d*0.02));
        gl_FragColor = vec4(c,1.0); }`,
  }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.002, HALF + 200);
  exterior.add(sand);
  scene.add(exterior);
}

// ------------------------------------------------------------------ build
function build() {
  buildGeo();
  WIPE.west = wipeLayer(); WIPE.east = wipeLayer();
  for (let k = -COPIES; k <= COPIES; k++) {
    const u = buildUnit(k); units.push(u); scene.add(u);
    if (k === 0) realUnit = u;
  }
  buildExterior();
}

// ------------------------------------------------------------------ per-frame state -> scene
function applyState(time) {
  G.uTime.value = time;
  G.uPhase.value = S.phase; G.uEmpty.value = S.empty; G.uAlt.value = S.alt; G.uLag.value = S.lag;
  G.uDust.value = S.dust; G.uStill.value = S.still; G.uVoid.value = S.voidA; G.uGlow.value = S.glow;
  G.uAmb.value = S.amb; G.uExp.value = S.exposure;
  const flick = 0.86 + 0.08 * Math.sin(time * 7.3) + 0.05 * Math.sin(time * 13.1 + 1.3) + 0.03 * Math.sin(time * 23.7);
  G.uLampI.value = S.lampI * flick;
  G.uDoor.value = S.open * 0.9;

  const camInside = S.camPos.z < HALF - 0.05;
  for (const u of units) {
    const k = u.userData.k;
    // east copies exist only once the doorway has become a mirror
    u.visible = k <= 0 || S.open < 0.999;
    // the local east niche of every copy is the door or one of its reflections
    u.userData.mirrors.east.uOpenEff.value = S.open;
    u.userData.door.visible = S.open > 0.001;
  }
  exterior.visible = S.exterior && (S.open > 0.001 || !camInside);
  for (const f of lampFlames) {
    const s = flick * S.lampI;
    f.flame.scale.set(0.085 * s, (0.19 + 0.025 * Math.sin(time * 9.0)) * s, 1);
    f.halo.material.opacity = 0.5 * s;
  }
  WIPE.west.t.needsUpdate = true; WIPE.east.t.needsUpdate = true;

  camera.position.copy(S.camPos);
  camera.fov = S.fov; camera.updateProjectionMatrix();
  camera.rotation.order = 'YXZ';
  if (S.target) camera.lookAt(S.target); else camera.rotation.set(S.pitch, S.yaw, 0);
  G.uCliffGlow.value = S.cliffGlow;
}

function resize() {
  const w = FILM ? 1920 : innerWidth, h = FILM ? 1080 : innerHeight;
  renderer.setSize(w, h, !FILM);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ verses & UI text
export const VERSES = {
  door: { zh: '来路\n成镜', src: '', en: 'The way in has become a mirror.' },
  noself: { zh: '镜中\n无我', src: '', en: 'Everything is in the mirror except you.' },
  arise: { zh: '诸行无常\n是生灭法', src: '《大般涅槃经》', en: 'All conditioned things are impermanent; theirs is the law of arising and ceasing.' },
  cease: { zh: '生灭灭已\n寂灭为乐', src: '《大般涅槃经》', en: 'When arising and ceasing have ceased, that stillness is joy.' },
  form: { zh: '色不异空\n空不异色', src: '《般若波罗蜜多心经》', en: 'Form is not other than emptiness; emptiness is not other than form.' },
  past: { zh: '镜深一层\n时早一步', src: '', en: 'One layer deeper in the mirror, one step earlier in time.' },
  one: { zh: '一即一切\n一切即一', src: '华严', en: 'One is all; all is one.' },
  shenxiu: { zh: '身是菩提树\n心如明镜台\n时时勤拂拭\n莫使有尘埃', src: '神秀 · 敦煌本《坛经》', en: 'The body is the bodhi tree, the mind a bright mirror on its stand. Wipe it with care, always — let no dust gather.' },
  huineng: { zh: '菩提本无树\n明镜亦无台\n佛性常清净\n何处有尘埃', src: '惠能 · 敦煌本《坛经》', en: 'Bodhi has no tree; the bright mirror has no stand. Buddha-nature is forever pure — where would dust find a place?' },
  diamond: { zh: '凡所有相\n皆是虚妄\n若见诸相非相\n即见如来', src: '《金刚经》', en: 'All that has form is illusion. See forms as no-form, and you see the Tathāgata.' },
};
const ERAS = [
  [0.00, '窟成 · 未画', '366 CE · the cave is cut, still bare'],
  [0.035, '起稿', 'the line is drawn'],
  [0.09, '敷彩 · 北朝', 'colour is laid · the Northern dynasties'],
  [0.2, '盛唐', 'the High Tang · 8th century'],
  [0.32, '五代 · 宋 · 元', 'Five Dynasties · Song · Yuan'],
  [0.42, '1900 · 藏经洞开', '1900 · the Library Cave is opened'],
  [0.5, '今', 'now'],
  [0.6, '百年之后', 'a hundred years on'],
  [0.74, '千年之后', 'a thousand years on'],
  [0.88, '沙', 'sand'],
  [0.95, '空', 'emptiness'],
];
export function eraOf(p) { let e = ERAS[0]; for (const r of ERAS) if (p >= r[0]) e = r; return e; }

let verseTimer = 0;
function showVerse(key, ms = 9000) {
  const v = VERSES[key]; const el = $('#verse');
  el.querySelector('.v-zh').innerHTML = v.zh.replace(/\n/g, '<br>');
  el.querySelector('.v-src').textContent = v.src;
  el.querySelector('.v-en').textContent = v.en;
  el.classList.add('on');
  clearTimeout(verseTimer); verseTimer = setTimeout(() => el.classList.remove('on'), ms);
}

// ------------------------------------------------------------------ sound (generated, no files)
class Sound {
  constructor() { this.on = true; this.ctx = null; }
  start() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 4);
    // reverb
    const len = ctx.sampleRate * 5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55; this.verb.connect(wet); wet.connect(this.master);
    // drone
    this.drone = ctx.createGain(); this.drone.gain.value = 0.11; this.drone.connect(this.master); this.drone.connect(this.verb);
    for (const [f, g] of [[55, 0.5], [82.6, 0.32], [110.3, 0.14], [164.8, 0.06]]) {
      const o = ctx.createOscillator(), a = ctx.createGain(); o.frequency.value = f; a.gain.value = g;
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.05 + Math.random() * 0.07; lg.gain.value = g * 0.5;
      l.connect(lg); lg.connect(a.gain); o.connect(a); a.connect(this.drone); o.start(); l.start();
    }
    // wind
    const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
    this.wind = ctx.createGain(); this.wind.gain.value = 0.05;
    const wl = ctx.createOscillator(), wg = ctx.createGain(); wl.frequency.value = 0.07; wg.gain.value = 260; wl.connect(wg); wg.connect(bp.frequency); wl.start();
    ns.connect(bp); bp.connect(this.wind); this.wind.connect(this.master); this.wind.connect(this.verb); ns.start();
    this.brushBuf = nb;
  }
  bowl(f0 = 196, vol = 0.25) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [r, a, d] of [[1, 1, 9], [2.71, 0.45, 6], [5.12, 0.22, 4], [8.2, 0.08, 2.5]]) {
      for (const det of [-0.6, 0.6]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f0 * r + det * r;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a * 0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(this.master); g.connect(this.verb); o.start(t); o.stop(t + d + 0.1);
      }
    }
  }
  brush(v = 0.05) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.brushBuf; f.type = 'highpass'; f.frequency.value = 2400;
    g.gain.setValueAtTime(v, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(ctx.currentTime, Math.random() * 3, 0.3);
  }
  toggle() { this.on = !this.on; if (this.master) this.master.gain.linearRampToValueAtTime(this.on ? 0.9 : 0, this.ctx.currentTime + 0.6); return this.on; }
}

// ------------------------------------------------------------------ prelude sand
function preludeSand() {
  const c = $('#sand'), x = c.getContext('2d'); let w, h; const P = [];
  const rs = () => { w = c.width = innerWidth; h = c.height = innerHeight; };
  rs(); addEventListener('resize', rs);
  for (let i = 0; i < 420; i++) P.push({ x: Math.random(), y: Math.random(), s: Math.random(), v: 0.2 + Math.random() });
  let alive = true;
  (function loop(t) {
    if (!alive) return;
    x.clearRect(0, 0, w, h);
    for (const p of P) {
      p.x += 0.00025 * p.v + Math.sin(t * 0.0003 + p.s * 9) * 0.0001; p.y += Math.sin(t * 0.0005 + p.s * 20) * 0.00008;
      if (p.x > 1) p.x -= 1;
      const a = 0.15 + 0.5 * p.s * (0.5 + 0.5 * Math.sin(t * 0.002 + p.s * 50));
      x.fillStyle = `rgba(217,169,91,${a * 0.6})`; x.fillRect(p.x * w, p.y * h, 1 + p.s * 1.4, 1 + p.s * 1.4);
    }
    requestAnimationFrame(loop);
  })(0);
  return () => { alive = false; };
}

// ------------------------------------------------------------------ interactive mode
function interactive() {
  const sound = new Sound();
  const stopSand = preludeSand();
  const enter = $('#enter');
  enter.disabled = true; enter.style.opacity = 0.4;
  const loading = enter.querySelector('.en'); const label = loading.textContent;
  let ready = false;
  loadAll((p) => { loading.textContent = `${Math.round(p * 100)}%`; }).then(() => {
    build(); resize(); ready = true; enter.disabled = false; enter.style.opacity = 1; loading.textContent = label;
    renderer.compile(scene, camera);
  });

  const look = { yaw: 0, pitch: 0.02, z: 16, ty: 0, tp: 0.02, tz: 16 };
  let phaseTarget = S.phase, phaseVel = 0;
  let entered = false, entryT = 0, doorT = -1, lastInput = performance.now(), stillSince = 0;
  let wipedFlag = false, huinengDone = false, sawNoSelf = false, sawArise = false, sawCease = false, sawPast = false, sawOne = false;
  const hints = [
    ['拖动 · 环顾四壁', 'Drag to look around the walls'],
    ['滚动 · 转动时间', 'Scroll (or use the rail) to turn time'],
    ['在镜上拖动 · 拂去尘埃', 'Drag across the mirror to wipe away the dust'],
    ['静止不动 · 镜自明', 'Now keep still — the mirror clears itself'],
    ['那盏灯 · 轻触', 'Touch the lamp'],
  ];
  let hintIdx = -1;
  const setHint = (i) => {
    if (i === hintIdx) return; hintIdx = i; const el = $('#hint');
    el.style.opacity = 0;
    setTimeout(() => { el.querySelector('.zh').textContent = hints[i][0]; el.querySelector('.en').textContent = hints[i][1]; el.style.opacity = 1; }, 700);
  };

  enter.addEventListener('click', () => {
    if (!ready) return;
    sound.start(); sound.bowl(147, 0.22);
    $('#prelude').classList.add('gone'); setTimeout(stopSand, 2600);
    entered = true; entryT = performance.now();
  });

  // pointer
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let mode = null, px = 0, py = 0, lastBrush = 0;
  function pick(e) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const m = realUnit.userData.mirrors;
    const targets = [m.west.dust]; if (S.open < 0.02) targets.push(m.east.dust);
    const hit = S.voidA < 0.5 ? ray.intersectObjects(targets, false)[0] : null;
    const lampHit = ray.intersectObject(realUnit.userData.lamp, true)[0] || lampProximity();
    return { hit, lampHit };
  }
  const lampWorld = new THREE.Vector3();
  function lampProximity() {
    realUnit.userData.lamp.getWorldPosition(lampWorld); lampWorld.y += 0.9;
    const d = ray.ray.distanceToPoint(lampWorld);
    return d < 0.22 ? { object: realUnit.userData.lamp } : null;
  }
  function wipeAt(hit) {
    const side = hit.object === realUnit.userData.mirrors.west.dust ? 'west' : 'east';
    const W = WIPE[side]; const u = hit.uv.x * 256, v = (1 - hit.uv.y) * 256;
    const g = W.x.createRadialGradient(u, v, 0, u, v, 26);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    W.x.fillStyle = g; W.x.fillRect(u - 28, v - 28, 56, 56);
    const now = performance.now(); if (now - lastBrush > 90) { sound.brush(0.035); lastBrush = now; }
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!entered) return;
    lastInput = performance.now();
    const { hit, lampHit } = pick(e);
    if (lampHit && (!hit || lampHit.distance === undefined || lampHit.distance < hit.distance)) { openLamp(); return; }
    mode = hit ? 'wipe' : 'look';
    if (hit) wipeAt(hit);
    px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId);
    canvas.classList.toggle('dragging', mode === 'look');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!entered) return;
    lastInput = performance.now();
    if (mode === 'look') {
      look.ty += (e.clientX - px) * 0.0042; look.tp += (e.clientY - py) * 0.0034;
      look.tp = clamp(look.tp, -0.55, 1.05); px = e.clientX; py = e.clientY;
    } else if (mode === 'wipe') {
      const { hit } = pick(e); if (hit) wipeAt(hit);
    } else {
      const { hit, lampHit } = pick(e);
      canvas.classList.toggle('wiping', !!hit); canvas.style.cursor = lampHit ? 'pointer' : '';
    }
  });
  const up = () => { mode = null; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  addEventListener('wheel', (e) => { if (!entered) return; lastInput = performance.now(); phaseVel += e.deltaY * 0.000012; }, { passive: true });
  addEventListener('keydown', (e) => {
    if (!entered) return; lastInput = performance.now();
    if (['w', 'W', 'ArrowUp'].includes(e.key)) look.tz = clamp(look.tz - 0.6, -2.4, 3.2);
    if (['s', 'S', 'ArrowDown'].includes(e.key)) look.tz = clamp(look.tz + 0.6, -2.4, 3.2);
    if (['a', 'A', 'ArrowLeft'].includes(e.key)) look.ty += 0.25;
    if (['d', 'D', 'ArrowRight'].includes(e.key)) look.ty -= 0.25;
    if (e.key === 'Escape') { closeLamp(); $('#info').classList.remove('on'); }
  });

  // rail
  const track = $('#track'), knob = $('#knob'), era = $('#era');
  let railDrag = false;
  const railSet = (e) => { const r = track.getBoundingClientRect(); phaseTarget = clamp((e.clientY - r.top) / r.height, 0, 0.999); phaseVel = 0; lastInput = performance.now(); };
  track.addEventListener('pointerdown', (e) => { railDrag = true; track.setPointerCapture(e.pointerId); railSet(e); });
  track.addEventListener('pointermove', (e) => { if (railDrag) railSet(e); });
  track.addEventListener('pointerup', () => { railDrag = false; });
  knob.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') phaseTarget = clamp(phaseTarget + 0.02, 0, 0.999); if (e.key === 'ArrowUp') phaseTarget = clamp(phaseTarget - 0.02, 0, 0.999); e.stopPropagation(); });
  for (const [p] of ERAS) { const t = document.createElement('span'); t.className = 'tick'; t.style.top = `${p * 100}%`; track.appendChild(t); }

  // tools
  let emptyTarget = 0, sawForm = false;
  $('#formEmpty').addEventListener('click', () => {
    emptyTarget = emptyTarget > 0.5 ? 0 : 1; sound.bowl(220, 0.16);
    $('#feA').style.color = emptyTarget ? 'var(--ink-faint)' : ''; $('#feB').style.color = emptyTarget ? '' : 'var(--ink-faint)';
    if (!sawForm) { showVerse('form'); sawForm = true; }
  });
  $('#feB').style.color = 'var(--ink-faint)';
  $('#sound').addEventListener('click', () => { const on = sound.toggle(); $('#soundEn').textContent = on ? 'sound on' : 'sound off'; });
  $('#about').addEventListener('click', () => $('#info').classList.add('on'));
  $('#infoClose').addEventListener('click', () => $('#info').classList.remove('on'));
  function openLamp() { $('#lamp').classList.add('on'); sound.bowl(294, 0.14); }
  function closeLamp() { $('#lamp').classList.remove('on'); }
  $('#lampClose').addEventListener('click', closeLamp);

  addEventListener('resize', resize);
  let prev = performance.now(), lastFrac = 0, fracT = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!ready) return;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    const time = now / 1000;

    if (entered) {
      const te = (now - entryT) / 1000;
      if (te < 8.5) {
        const k = smooth(0, 8.5, te);
        look.tz = lerp(16, 2.6, k); look.z = look.tz;
        look.tp = lerp(0.02, -0.02, k);
        $('#hud').classList.toggle('on', te > 6);
      } else if (doorT < 0) {
        doorT = now; sound.bowl(110, 0.3); showVerse('door', 7000);
      }
      if (doorT > 0) {
        S.open = 1 - smooth(0, 4.5, (now - doorT) / 1000);
        if (S.open < 0.01) S.exterior = false;
      }
      const idle = (now - lastInput) / 1000;
      S.still = smooth(3, 8, idle);
      // hints
      const since = doorT > 0 ? (now - doorT) / 1000 : 0;
      if (doorT > 0) {
        if (since < 9) setHint(0);
        else if (since < 18) setHint(1);
        else if (!wipedFlag) setHint(2);
        else if (!huinengDone) setHint(3);
        else setHint(4);
      }
      if (doorT > 0 && since > 11 && !sawNoSelf) { sawNoSelf = true; showVerse('noself', 7000); }
    }

    // time: inertia from the wheel, or glide to the rail target
    if (Math.abs(phaseVel) > 1e-6) { phaseTarget = (phaseTarget + phaseVel + 1) % 1; phaseVel *= 0.9; }
    let d = phaseTarget - S.phase; if (d > 0.5) d -= 1; if (d < -0.5) d += 1;
    S.phase = (S.phase + d * Math.min(1, dt * 5) + 1) % 1;
    if (S.phase > 0.6 && S.phase < 0.8 && !sawArise) { sawArise = true; showVerse('arise'); }
    if (S.phase > 0.93 && !sawCease) { sawCease = true; showVerse('cease'); }
    if (sawArise && sawCease && !sawPast && S.phase < 0.3 && S.phase > 0.1) { sawPast = true; showVerse('past', 8000); }
    const r = track.getBoundingClientRect();
    knob.style.top = `${S.phase * 100}%`; era.style.top = `${S.phase * 100}%`;
    const e = eraOf(S.phase); era.querySelector('.zh').textContent = e[1]; era.querySelector('.en').textContent = e[2];
    knob.setAttribute('aria-valuenow', Math.round(S.phase * 100)); void r;

    S.empty = lerp(S.empty, emptyTarget, Math.min(1, dt * 1.6));

    // dust slowly returns; wiping is never finished (Shenxiu) — until stillness (Huineng)
    if (!huinengDone) {
      S.dust = Math.min(0.85, S.dust + dt * 0.006);
      for (const W of [WIPE.west, WIPE.east]) { W.x.fillStyle = 'rgba(0,0,0,0.006)'; W.x.fillRect(0, 0, 256, 256); }
      fracT += dt;
      if (fracT > 0.5) {
        fracT = 0;
        const data = WIPE.west.x.getImageData(32, 40, 192, 200).data; let s = 0;
        for (let i = 0; i < data.length; i += 16) s += data[i]; lastFrac = s / (data.length / 16) / 255;
        if (lastFrac > 0.32 && !wipedFlag) { wipedFlag = true; showVerse('shenxiu', 12000); sound.bowl(174, 0.2); }
      }
      if (wipedFlag && S.still > 0.98) { stillSince += dt; } else stillSince = 0;
      if (stillSince > 4.5) { huinengDone = true; voidStart = now; showVerse('huineng', 14000); sound.bowl(98, 0.32); }
    } else {
      const k = smooth(0, 7, (now - voidStart) / 1000);
      S.voidA = k; S.dust = lerp(S.dust, 0, dt * 0.5);
      if (k > 0.99 && !sawOne) { sawOne = true; setTimeout(() => showVerse('one', 9000), 6000); setTimeout(() => showVerse('diamond', 12000), 22000); }
    }
    S.glow = lerp(S.glow, S.still * (huinengDone ? 1.0 : 0.55), Math.min(1, dt * 0.8));
    S.amb = 0.14 + 0.05 * S.still;

    look.yaw += (look.ty - look.yaw) * Math.min(1, dt * 6);
    look.pitch += (look.tp - look.pitch) * Math.min(1, dt * 6);
    look.z += (look.tz - look.z) * Math.min(1, dt * 3);
    S.yaw = look.yaw; S.pitch = look.pitch;
    S.camPos.set(Math.sin(time * 0.21) * 0.03, 1.62 + Math.sin(time * 0.37) * 0.012, look.z);
    applyState(time);
    renderer.render(scene, camera);
  }
  let voidStart = 0;
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ boot
if (FILM) {
  document.documentElement.classList.add('film');
  window.__zj = { S, G, THREE, camera, renderer, scene, WIPE, applyState, VERSES, eraOf, ready: false };
  loadAll().then(async () => {
    build(); resize(); renderer.compile(scene, camera);
    window.__zj.render = (time) => { applyState(time); renderer.render(scene, camera); };
    const durations = await fetch('../video/durations.json').then((r) => r.json()).catch(() => ({}));
    const film = await import('./film.js');
    film.init(window.__zj, durations);
    window.__zj.ready = true;
  });
} else {
  interactive();
}

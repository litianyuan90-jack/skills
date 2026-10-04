// 地：一座程序化山水（湖、山、田、亭、舟、树），每个节气调成不同的天光、植被、粒子与生灵
import * as THREE from 'three';
import { Reflector } from './node_modules/three/examples/jsm/objects/Reflector.js';
import { mergeGeometries, mergeVertices } from './node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLSL_NOISE, D2R, lerp, clamp, smooth, easeIO, easeSine, rng, fbm2, ridged2, noise2 } from './util.js';

// ------------------------------------------------------------------ 地形
const LAKE = { x: 0, z: -15, rx: 76, rz: 48 };
const FIELD = { x: -98, z: 38, rx: 52, rz: 36 };
export const HERO = new THREE.Vector3(22, 0, 52);
const PAV = new THREE.Vector3(66, 0, 4);
const BOAT = new THREE.Vector3(-8, 0, 2);
const PADDY_X = -98;

export function terrainH(x, z) {
  const lx = (x - LAKE.x) / LAKE.rx, lz = (z - LAKE.z) / LAKE.rz, ld = Math.sqrt(lx * lx + lz * lz);
  const r = Math.hypot(x * .9, (z + 60) * 1.1);
  let h = 7 * fbm2(x * .011, z * .011, 4) + 4.5;
  const back = smooth(70, 300, r) * Math.max(smooth(30, -80, z), smooth(150, 280, Math.abs(x)) * .85, smooth(260, 420, z));
  h += back * (35 + 190 * ridged2(x * .0042 + 3.1, z * .0042 + 1.7, 5));
  h += smooth(180, 90, Math.abs(x - 120)) * smooth(110, 30, Math.abs(z + 20)) * 30 * (.6 + .4 * noise2(x * .02, z * .02)); // 右侧小山
  const south = smooth(-10, 20, z) * (1 - smooth(115, 160, Math.abs(x))) * (1 - smooth(170, 230, z));
  h = lerp(h, 1.4 + 3.2 * (fbm2(x * .018 + 4, z * .018, 3) + .45) + smooth(60, 160, z) * 4, south);
  h = Math.min(h, lerp(.8 + 2 * (ld - .9), h, smooth(1.05, 1.7, ld)));
  const lake = 1 - smooth(.78, 1.12, ld + .08 * noise2(x * .03, z * .03));
  h = lerp(h, -5.5, lake);
  const fd = Math.hypot((x - FIELD.x) / FIELD.rx, (z - FIELD.z) / FIELD.rz); const fm = 1 - smooth(.85, 1.15, fd);
  h = lerp(h, 1.5, fm * (1 - lake));
  const hd = Math.hypot(x - HERO.x, z - HERO.z); h = lerp(h, 3.2, (1 - smooth(6, 26, hd)) * .8);
  const pd = Math.hypot(x - PAV.x, z - PAV.z); h = lerp(h, 1.6, 1 - smooth(5, 12, pd));
  return h;
}

const ENV = /* glsl */`
uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol, uFogCol; uniform float uFogDen, uMist, uTime, uFlash;
vec3 shade(vec3 N, vec3 alb, float ao){ float d=max(dot(N,uSunDir),0.); vec3 hemi=mix(uGndCol,uSkyCol,N.y*.5+.5);
  return alb*(uSunCol*d*ao + hemi*ao) + alb*uFlash*vec3(1.6,1.7,2.); }
vec3 fogit(vec3 c, vec3 wp){ float d=length(wp-cameraPosition); float f=1.-exp(-pow(d*uFogDen,1.25));
  float hn=.55+.9*fbm3o(wp.xz*.012+vec2(uTime*.03,0.));
  float h=exp(-max(wp.y+1.,0.)*.06)*uMist*smoothstep(10.,140.,d)*hn; f=clamp(f+h*.85,0.,1.);
  vec3 v=normalize(wp-cameraPosition); float s=pow(max(dot(v,uSunDir),0.),6.); vec3 fc=uFogCol+uSunCol*s*.18;
  return mix(c,fc,f); }
`;

function makeU() {
  const v3 = (x, y, z) => ({ value: new THREE.Vector3(x, y, z) }), f = (x) => ({ value: x });
  return { uSunDir: v3(0, 1, 0), uSunCol: v3(1, 1, 1), uSkyCol: v3(.5, .5, .5), uGndCol: v3(.2, .2, .2), uFogCol: v3(.7, .7, .7),
    uFogDen: f(.002), uMist: f(.3), uTime: f(0), uFlash: f(0),
    uGreen: f(1), uSummer: f(0), uAutumn: f(0), uSnow: f(0), uFrost: f(0), uWheat: f(0), uPaddy: f(0), uBlossom: f(0),
    uBloomCol: v3(1, .6, .7), uBare: f(0), uWind: f(.3), uIce: f(0), uRain: f(0), uWaterCol: v3(.05, .1, .12), uRidge: v3(.3, .35, .4),
    uZen: v3(.2, .3, .6), uHor: v3(.7, .7, .7), uCloud: f(.3), uCloudCol: v3(1, 1, 1), uMoonDir: v3(0, .4, -1), uMoon: f(0), uStars: f(0), uSunDisc: f(1),
    uPx: f(1) };
}

const TOD = {
  dawn:     { zen: [.16, .24, .46], hor: [1.0, .64, .5], el: 5, az: -28, sun: [2.6, 1.45, .8], sky: [.36, .40, .56], gnd: [.22, .17, .15], fog: [.92, .66, .56], den: .0017, cloud: .4, ccol: [1.1, .66, .58], water: [.08, .09, .14], ridge: [.36, .3, .4] },
  overcast: { zen: [.42, .47, .52], hor: [.70, .72, .72], el: 40, az: -10, sun: [.55, .57, .6], sky: [.72, .75, .8], gnd: [.25, .25, .22], fog: [.68, .70, .71], den: .003, cloud: 1, ccol: [.62, .64, .67], water: [.1, .12, .13], ridge: [.42, .45, .48], disc: 0 },
  storm:    { zen: [.09, .10, .15], hor: [.28, .28, .35], el: 30, az: 0, sun: [.3, .28, .36], sky: [.32, .34, .44], gnd: [.12, .12, .12], fog: [.27, .28, .34], den: .0026, cloud: 1, ccol: [.22, .22, .28], water: [.04, .05, .07], ridge: [.18, .19, .25], disc: 0 },
  misty:    { zen: [.56, .63, .63], hor: [.80, .84, .82], el: 35, az: 10, sun: [.85, .9, .85], sky: [.72, .78, .76], gnd: [.3, .32, .26], fog: [.78, .82, .8], den: .0042, cloud: .9, ccol: [.78, .82, .8], water: [.18, .22, .22], ridge: [.6, .66, .65], disc: 0 },
  soft:     { zen: [.40, .54, .62], hor: [.84, .86, .82], el: 38, az: -25, sun: [1.4, 1.32, 1.15], sky: [.6, .66, .7], gnd: [.28, .3, .22], fog: [.8, .82, .8], den: .0026, cloud: .75, ccol: [.9, .9, .9], water: [.12, .17, .18], ridge: [.52, .6, .62], disc: .3 },
  noon:     { zen: [.14, .34, .78], hor: [.70, .80, .92], el: 58, az: -20, sun: [2.7, 2.5, 2.2], sky: [.42, .52, .74], gnd: [.25, .24, .18], fog: [.72, .80, .9], den: .0011, cloud: .4, ccol: [1.25, 1.25, 1.25], water: [.04, .1, .14], ridge: [.42, .52, .66] },
  sunset:   { zen: [.22, .24, .46], hor: [1.25, .64, .32], el: 4, az: 18, sun: [2.8, 1.35, .5], sky: [.44, .40, .48], gnd: [.25, .16, .12], fog: [1.0, .62, .42], den: .0017, cloud: .5, ccol: [1.15, .58, .4], water: [.08, .06, .08], ridge: [.45, .3, .35] },
  haze:     { zen: [.48, .56, .7], hor: [.96, .9, .78], el: 55, az: -15, sun: [2.6, 2.3, 1.8], sky: [.6, .6, .62], gnd: [.3, .28, .2], fog: [.9, .87, .78], den: .0026, cloud: .3, ccol: [1.1, 1.05, 1], water: [.08, .12, .12], ridge: [.66, .66, .64] },
  night:    { zen: [.012, .022, .055], hor: [.07, .10, .17], el: -20, az: 0, sun: [.22, .30, .52], sky: [.07, .09, .16], gnd: [.03, .03, .045], fog: [.07, .1, .17], den: .0019, cloud: .25, ccol: [.1, .12, .18], water: [.01, .02, .04], ridge: [.05, .07, .12], moon: 1, stars: 1, moonEl: 24, moonAz: 14 },
  clear:    { zen: [.10, .30, .76], hor: [.64, .76, .9], el: 30, az: -38, sun: [2.6, 2.25, 1.8], sky: [.42, .54, .76], gnd: [.25, .22, .16], fog: [.66, .76, .88], den: .0011, cloud: .25, ccol: [1.2, 1.2, 1.2], water: [.03, .09, .16], ridge: [.4, .5, .66] },
  dusk:     { zen: [.10, .12, .26], hor: [.52, .43, .52], el: -3, az: 10, sun: [.55, .48, .62], sky: [.3, .3, .44], gnd: [.15, .14, .16], fog: [.44, .41, .5], den: .0026, cloud: .7, ccol: [.42, .4, .5], water: [.06, .06, .1], ridge: [.3, .3, .4], disc: 0 },
  snowday:  { zen: [.56, .60, .66], hor: [.78, .80, .84], el: 35, az: 0, sun: [.7, .72, .78], sky: [.8, .83, .9], gnd: [.45, .46, .5], fog: [.78, .80, .84], den: .0028, cloud: 1, ccol: [.7, .72, .76], water: [.05, .06, .08], ridge: [.42, .45, .5], disc: 0 },
  coldclear:{ zen: [.18, .36, .68], hor: [.80, .86, .94], el: 14, az: -22, sun: [2.3, 2.0, 1.7], sky: [.55, .65, .86], gnd: [.4, .42, .48], fog: [.8, .86, .94], den: .0015, cloud: .3, ccol: [1.15, 1.1, 1.1], water: [.05, .1, .16], ridge: [.6, .68, .8] },
};

// 镜头：pos0→pos1, tgt0→tgt1
const CAMS = {
  '立春': [[0, 15, 108], [0, 12, 94], [0, 4, 0], [0, 6, -12], 44],
  '雨水': [[-22, 4.2, 62], [-12, 4.6, 50], [0, 3, 0], [10, 5, -24], 46],
  '惊蛰': [[44, 8.5, 92], [40, 9.5, 86], [20, 9, 50], [8, 12, 8], 46],
  '清明': [[18, 5, 72], [28, 6, 60], [62, 5, 6], [55, 6, 0], 44],
  '谷雨': [[-10, 11, 92], [4, 9.5, 82], [16, 8, 44], [2, 7, 0], 48],
  '立夏': [[-34, 30, 142], [8, 27, 128], [0, 12, 0], [0, 12, -24], 46],
  '小满': [[-58, 3.6, 84], [-70, 3.4, 74], [-98, 2.5, 32], [-110, 2.5, 24], 46],
  '芒种': [[-60, 11, 86], [-68, 9, 78], [-100, 1, 32], [-108, 1, 26], 46],
  '小暑': [[-6, 3.2, 56], [5, 3.2, 50], [-10, 1.5, 22], [0, 2, 10], 48],
  '大暑': [[12, 3.4, 58], [2, 3, 52], [-4, 1.8, 22], [-10, 2.2, 14], 48],
  '立秋': [[40, 12, 96], [26, 11, 90], [0, 6, -30], [-10, 6, -40], 46],
  '处暑': [[-40, 18, 112], [-34, 22, 116], [-62, 22, 0], [-52, 40, -24], 50],
  '白露': [[-20, 2.4, 76], [-24, 2.7, 68], [-5, 4, 30], [0, 6, 0], 48],
  '寒露': [[-15, 3.2, 80], [-12, 4.2, 73], [0, 12, 20], [0, 20, 0], 50],
  '霜降': [[12, 5, 80], [6, 4.6, 73], [-8, 2, 2], [-10, 2, -6], 46],
  '立冬': [[-22, 16, 102], [0, 14, 96], [0, 3, 0], [10, 3, -12], 44],
  '小雪': [[38, 6, 58], [47, 7, 47], [64, 4.5, 6], [64, 4.5, 4], 44],
  '大雪': [[6, 12, 56], [1, 9.5, 46], [-8, 0, 2], [-8, .5, -6], 42],
  '小寒': [[47, 6, 100], [42, 6.5, 93], [21, 12, 51], [12, 13, 28], 44],
  '大寒': [[41, 5, 93], [38, 5.5, 88], [21, 12, 51], [17, 13, 42], 44],
};

// ------------------------------------------------------------------ 构件
function cylBetween(a, b, r0, r1, seg = 6) {
  const len = a.distanceTo(b); const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  g.translate(0, len / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q); g.translate(a.x, a.y, a.z); return g.toNonIndexed();
}
function buildTree(seed, depth, len0, rad0, crownEvery, crownR) {
  const r = rng(seed); const br = [], crowns = [], tips = [], twigs = [];
  const up = new THREE.Vector3(0, 1, 0);
  function branch(p, dir, len, rad, d) {
    const end = p.clone().addScaledVector(dir, len);
    br.push(cylBetween(p, end, rad, rad * .66, d > 2 ? 6 : 4));
    if (d <= 1) twigs.push([p.clone(), end.clone()]);
    if (d === 0) { tips.push(end); return; }
    const n = d >= depth - 1 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const perp = new THREE.Vector3(r() - .5, 0, r() - .5).normalize(); if (perp.lengthSq() < .01) perp.set(1, 0, 0);
      const nd = dir.clone().applyAxisAngle(perp, .45 + r() * .55).applyAxisAngle(dir, i * 2.4 + r());
      nd.y += .22; nd.normalize();
      branch(end, nd, len * (.66 + r() * .16), rad * .64, d - 1);
    }
  }
  branch(new THREE.Vector3(0, -.3, 0), up.clone(), len0, rad0, depth);
  tips.forEach((t, i) => { if (i % crownEvery === 0) { let g = new THREE.IcosahedronGeometry(crownR * (.75 + r() * .5), 1); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); { const a = g.attributes.position.array; for (let j = 0; j < a.length; j += 3) { const k = 1 + .22 * noise2(a[j] * 1.7 + seed, a[j + 1] * 1.7 + a[j + 2]); a[j] *= k; a[j + 1] *= k; a[j + 2] *= k; } } g.computeVertexNormals(); g = g.toNonIndexed(); g.scale(1, .78, 1); g.translate(t.x, t.y + .2, t.z); crowns.push(g); } });
  return { branches: mergeGeometries(br), crown: crowns.length ? mergeGeometries(crowns) : null, tips, twigs };
}

export class LandWorld {
  constructor(renderer, W, H) {
    this.W = W; this.H = H; this.renderer = renderer;
    const S = this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(46, W / H, .3, 6000);
    const U = this.U = makeU();
    U.uPx.value = H / (2 * Math.tan(23 * D2R));

    // 天空
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
      fragmentShader: GLSL_NOISE + `uniform vec3 uZen,uHor,uSunDir,uSunCol,uMoonDir,uCloudCol; uniform float uCloud,uMoon,uStars,uTime,uFlash,uSunDisc; varying vec3 vDir;
        void main(){ vec3 d=normalize(vDir); float y=d.y;
          vec3 c=mix(uHor,uZen,pow(smoothstep(-.02,.65,y),.75)); c=mix(c,uHor*.85,smoothstep(0.,-.25,y));
          float sd=max(dot(d,uSunDir),0.); c+=uSunCol*(pow(sd,6.)*.22+pow(sd,90.)*.5)*uSunDisc;
          c+=uSunCol*smoothstep(.99955,.99975,sd)*5.*uSunDisc;
          if(y>-.02){ vec2 cp=d.xz/(max(y,0.)+.12)*.7+vec2(uTime*.012,uTime*.004); float cl=fbm4(cp*1.2); cl=smoothstep(.62-uCloud*.32,.95-uCloud*.15,cl)*min(uCloud*1.4,1.);
            vec3 cc=uCloudCol*(.75+.5*vnoise(cp*3.1))+uSunCol*pow(sd,5.)*.6*uSunDisc; c=mix(c,cc,cl*smoothstep(-.02,.12,y)); }
          float md=dot(d,normalize(uMoonDir)); c+=vec3(1.,.96,.86)*smoothstep(.99965,.9998,md)*uMoon*4.+vec3(.45,.55,.8)*pow(max(md,0.),40.)*uMoon*.5;
          if(uStars>0.){ vec3 q=d*420.; float s=hash13(floor(q)); vec3 fq=fract(q)-.5; c+=vec3(.9,.95,1.)*step(.9975,s)*smoothstep(.35,.0,length(fq))*uStars*smoothstep(.02,.3,y)*2.5; }
          c+=uFlash*vec3(.8,.85,1.1);
          gl_FragColor=vec4(c,1.); }` }));
    this.sky.frustumCulled = false; this.sky.renderOrder = 999; S.add(this.sky);

    // 地形
    const SZ = 1400, SEG = 220;
    const tg = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG); tg.rotateX(-Math.PI / 2);
    const pa = tg.attributes.position.array;
    for (let i = 0; i < pa.length; i += 3) { const x = pa[i], z = pa[i + 2] - 200; pa[i + 2] = z; pa[i + 1] = terrainH(x, z); }
    tg.computeVertexNormals();
    this.terrainMat = new THREE.ShaderMaterial({ uniforms: U,
      vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normal; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: GLSL_NOISE + ENV + `uniform float uGreen,uSummer,uAutumn,uSnow,uFrost,uWheat,uPaddy; uniform vec3 uZen,uHor,uWaterCol; varying vec3 vW; varying vec3 vN;
        void main(){ vec3 N=normalize(vN); vec3 wp=vW; float n1=fbm4(wp.xz*.045), n2=vnoise(wp.xz*.7), n3=fbm3o(wp.xz*.008);
          vec3 sprG=vec3(.30,.48,.13), sumG=vec3(.11,.27,.07), dry=vec3(.36,.31,.2), au1=vec3(.62,.42,.12), au2=vec3(.52,.18,.06);
          vec3 grass=mix(dry,mix(sprG,sumG,uSummer),uGreen*(.75+.5*n3));
          grass=mix(grass,mix(au1,au2,smoothstep(.35,.65,n1)),uAutumn*(.55+.45*n3));
          grass*=.75+.5*n2;
          float slope=1.-N.y; vec3 rock=vec3(.27,.26,.25)*(.7+.6*n1);
          vec3 alb=mix(grass,rock,smoothstep(.32,.62,slope+(n1-.5)*.35));
          alb=mix(alb,rock*.9,smoothstep(70.,170.,wp.y+n1*60.)*.75);
          alb=mix(alb,vec3(.30,.27,.22),smoothstep(1.6,-.2,wp.y)*.85);
          // 田
          float fd=length((wp.xz-vec2(${FIELD.x.toFixed(1)},${FIELD.z.toFixed(1)}))/vec2(${FIELD.rx.toFixed(1)},${FIELD.rz.toFixed(1)}));
          float fm=(1.-smoothstep(.8,.92,fd))*smoothstep(.0,.1,uWheat+uPaddy);
          float rows=.5+.5*sin(wp.x*2.2+wp.z*.4+n2*1.5);
          vec3 wcol=mix(vec3(.25,.42,.12),vec3(.86,.64,.24),uWheat)*(.78+.3*rows)*(.85+.3*n1);
          float pm=uPaddy*step(${PADDY_X.toFixed(1)},wp.x)*fm;
          vec3 V=normalize(cameraPosition-wp); vec3 R=reflect(-V,vec3(0,1,0));
          vec3 pcol=mix(uHor,uZen,.45)*.42+uWaterCol+uSunCol*pow(max(dot(R,uSunDir),0.),60.)*.5;
          float seed=step(.82,fract(wp.x*1.6))*step(.65,fract(wp.z*1.6+.3)); pcol=mix(pcol,vec3(.25,.45,.12),seed*.9);
          alb=mix(alb,wcol,fm*(1.-step(${PADDY_X.toFixed(1)},wp.x)*uPaddy));
          // 雪与霜
          float sn=uSnow*1.3-slope*1.25+(n1-.5)*.7+smoothstep(0.,100.,wp.y)*.35; sn=smoothstep(.25,.55,sn);
          vec3 snowc=vec3(.93,.95,1.)*(.92+.1*n2);
          alb=mix(alb,snowc,sn); alb=mix(alb,vec3(.78,.82,.88),uFrost*.4*(1.-slope));
          float ao=.75+.25*smoothstep(-.2,.6,n1);
          vec3 col=shade(N,alb,ao);
          col=mix(col,pcol,pm*(1.-seed*.9)*(1.-uSnow));
          float rim=pow(1.-max(dot(N,V),0.),3.); col*=1.-.35*rim*smoothstep(15.,120.,wp.y);
          gl_FragColor=vec4(fogit(col,wp),1.); }` });
    this.terrain = new THREE.Mesh(tg, this.terrainMat); S.add(this.terrain);

    // 远山（水墨层叠）
    this.ridges = [];
    for (let k = 0; k < 4; k++) {
      const rg = new THREE.PlaneGeometry(5200, 600, 400, 1); const a = rg.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { if (a[i + 1] > 0) { const x = a[i]; a[i + 1] = 40 + 300 * Math.pow(ridged2(x * .0016 + k * 7.1, k * 3.3, 5), 1.25) + 80 * fbm2(x * .004, k, 3) + k * 40; } else a[i + 1] = -150; }
      const m = new THREE.ShaderMaterial({ uniforms: { ...U, uK: { value: k } }, transparent: true, depthWrite: false,
        vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: GLSL_NOISE + `uniform vec3 uRidge,uFogCol,uSunCol,uSunDir; uniform float uK,uSnow,uFlash; varying vec3 vW;
          void main(){ float t=uK/3.; vec3 c=mix(uRidge*.75,uFogCol,.25+t*.55);
            float base=smoothstep(-40.,160.+uK*40.,vW.y); c=mix(uFogCol,c,base);
            float tex=fbm(vW.xy*vec2(.004,.012)+uK); c*=.9+.2*tex; c=mix(c,vec3(.92,.94,.98)*(uFogCol*.4+.6),uSnow*smoothstep(150.,320.,vW.y+tex*120.)*(1.-t*.5));
            c+=uFlash*vec3(.5,.55,.7)*(1.-t);
            gl_FragColor=vec4(c,1.); }` });
      const mesh = new THREE.Mesh(rg, m); mesh.position.set(0, 0, -720 - k * 420); mesh.renderOrder = -10 + k; mesh.scale.set(1 + k * .3, 1 + k * .25, 1);
      mesh.frustumCulled = false; S.add(mesh); this.ridges.push(mesh);
    }
    this.ridges.forEach(m => m.renderOrder = -20 - m.material.uniforms.uK.value);

    // 水面（平面反射 + 涟漪 + 雨点 + 冰）
    const wshader = { name: 'water', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
      vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW; void main(){ vUv=textureMatrix*vec4(position,1.); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: GLSL_NOISE + ENV + `uniform sampler2D tDiffuse; uniform vec3 color; uniform float uIce,uRain,uSnow,uFrost; uniform vec3 uWaterCol; varying vec4 vUv; varying vec3 vW;
        vec2 rip(vec2 p,float t){ vec2 acc=vec2(0.); for(int k=0;k<3;k++){ vec2 q=p*1.3+float(k)*7.31; vec2 i=floor(q), f=fract(q); vec2 h=hash22(i+float(k)*13.1);
          float ph=fract(t*1.1+h.x*7.); vec2 c=.2+.6*hash22(i+3.7+floor(t*1.1+h.x*7.)); vec2 d=f-c; float r=length(d); float R=ph*.45;
          float ring=sin((r-R)*55.)*smoothstep(.07,.0,abs(r-R))*(1.-ph); acc+=d/(r+.001)*ring; } return acc; }
        void main(){ vec2 p=vW.xz; vec3 V=normalize(cameraPosition-vW);
          vec2 w=vec2(fbm(p*.11+uTime*.18),fbm(p*.11-uTime*.14+7.))-.5; vec2 w2=vec2(vnoise(p*.9+uTime*.6),vnoise(p*.9-uTime*.5+3.))-.5;
          vec2 off=w*.05+w2*.012+rip(p*.55,uTime)*uRain*.05;
          vec4 uv=vUv; uv.xy+=off*uv.w*1.2; vec3 refl=texture2DProj(tDiffuse,uv).rgb;
          float fr=.08+.92*pow(1.-max(V.y,0.),5.); fr=max(fr,.55);
          vec3 c=mix(uWaterCol,refl,fr);
          vec3 N=normalize(vec3(-off.x*7.,1.,-off.y*7.)); vec3 H=normalize(uSunDir+V); c+=uSunCol*pow(max(dot(N,H),0.),260.)*3.;
          // 冰
          float im=smoothstep(-.03,.03,uIce*1.12-fbm(p*.022+3.)-(1.-uIce)*.15);
          float cr=voronoiEdge(p*.33+fbm3o(p*.2)*.8); float cr2=voronoiEdge(p*1.1+5.);
          vec3 ice=mix(vec3(.62,.72,.8),vec3(.86,.9,.94),fbm(p*.25))*(uSkyCol*.7+uSunCol*.25+.15);
          ice=mix(ice,refl*.9+.05,.35); ice=mix(ice,vec3(.12,.18,.24),smoothstep(.035,.0,cr)*.38*smoothstep(.3,.7,fbm3o(p*.07))+smoothstep(.025,.0,cr2)*.12);
          ice=mix(ice,vec3(.9,.92,.96)*(uSkyCol*.5+.5),uSnow*smoothstep(.3,.7,fbm(p*.05))*.85);
          float edge=smoothstep(.0,.06,abs(im-.5)*2.); c=mix(c,ice,im); c=mix(c*1.15,c,edge);
          gl_FragColor=vec4(fogit(c,vW),1.); }` };
    this.water = new Reflector(new THREE.PlaneGeometry(420, 300), { shader: wshader, textureWidth: Math.round(W * .25), textureHeight: Math.round(H * .25), clipBias: .02 });
    for (const k of ['uSunDir', 'uSunCol', 'uSkyCol', 'uGndCol', 'uFogCol', 'uFogDen', 'uMist', 'uTime', 'uFlash', 'uIce', 'uRain', 'uSnow', 'uFrost', 'uWaterCol']) this.water.material.uniforms[k] = U[k];
    { const ob = this.water.onBeforeRender; this.water.onBeforeRender = (...a) => { const hid = [this.rain, this.snow, this.petals, this.flies, this.dew, this.motes, this.chrys, this.wheat, this.birds, this.bloomPts, this.pineT, this.pine, this.trunkA, this.trunkB, this.pads, this.lotus].filter(o => o && o.visible); hid.forEach(o => o.visible = false); ob.apply(this.water, a); hid.forEach(o => o.visible = true); }; }
    this.water.rotation.x = -Math.PI / 2; this.water.position.set(LAKE.x, 0, LAKE.z + 10); S.add(this.water);

    // 植被材质
    const vegVS = `attribute float aRand; varying vec3 vW; varying vec3 vN; varying float vR; uniform float uTime,uWind,uBare; uniform float uCrown;
      void main(){ vR=aRand; vec3 p=position; mat4 im=instanceMatrix;
        if(uCrown>.5 && aRand<uBare) p*=0.;
        vec4 w=modelMatrix*im*vec4(p,1.); float sway=uWind*.35*max(p.y,0.)*.12*sin(uTime*1.7+aRand*30.+w.x*.05); w.x+=sway; w.z+=sway*.4;
        vW=w.xyz; vN=normalize(mat3(modelMatrix*im)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`;
    const vegMat = (crown, kind) => new THREE.ShaderMaterial({ uniforms: { ...U, uCrown: { value: crown ? 1 : 0 }, uKind: { value: kind } },
      vertexShader: vegVS,
      fragmentShader: GLSL_NOISE + ENV + `uniform float uGreen,uSummer,uAutumn,uSnow,uBlossom,uCrown,uKind,uFrost; uniform vec3 uBloomCol; varying vec3 vW; varying vec3 vN; varying float vR;
        void main(){ vec3 N=normalize(vN); vec3 alb; float n=vnoise(vW.xz*1.3+vW.y);
          if(uCrown>.5){
            if(uKind>.5){ alb=vec3(.07,.17,.09)*(.8+.4*n); }
            else { vec3 g=mix(vec3(.36,.55,.16),vec3(.12,.3,.08),uSummer); g=mix(vec3(.4,.38,.25),g,uGreen);
              vec3 a=mix(vec3(.85,.55,.1),vec3(.7,.16,.05),fract(vR*7.3)); g=mix(g,a,uAutumn*smoothstep(.2,.9,fract(vR*3.1)+uAutumn*.6));
              g=mix(g,uBloomCol,uBlossom*step(.35,fract(vR*5.7))*(.6+.4*n)); alb=g*(.75+.5*n)*(.85+.3*fract(vR*11.)); }
          } else alb=vec3(.12,.09,.07)*(.8+.4*n);
          float sn=smoothstep(.3,.8,N.y+n*.4-.2)*uSnow; alb=mix(alb,vec3(.92,.94,.98),sn); alb=mix(alb,vec3(.8,.84,.9),uFrost*.3*N.y);
          float ao=uCrown>.5?(.55+.45*smoothstep(-.6,.8,N.y)):1.;
          vec3 c=shade(N,alb,ao); vec3 V=normalize(cameraPosition-vW); c+=uSunCol*alb*pow(max(dot(-V,uSunDir),0.),6.)*.6*uCrown;
          gl_FragColor=vec4(fogit(c,vW),1.); }` });

    // 落叶树（实例化）
    const T1 = buildTree(11, 4, 2.3, .26, 3, 1.15), T2 = buildTree(23, 4, 2.6, .3, 3, 1.05);
    const placeTrees = (count, seed, filt) => { const r = rng(seed), out = [];
      let guard = 0; while (out.length < count && guard++ < count * 60) {
        const x = (r() - .5) * 700, z = -330 + r() * 520; const h = terrainH(x, z);
        if (!filt(x, z, h, r)) continue; out.push([x, h, z, .8 + r() * .9, r() * 6.28, r()]); }
      return out; };
    const camPts = Object.values(CAMS).flatMap(c => [c[0], c[1]]); const nearCam = (x, z, rad) => camPts.some(p => Math.hypot(p[0] - x, p[2] - z) < rad);
    const nearOK = (x, z, h, r) => { if (h < 1.1 || h > 60 || nearCam(x, z, 26)) return false;
      const fd = Math.hypot((x - FIELD.x) / FIELD.rx, (z - FIELD.z) / FIELD.rz); if (fd < 1.05) return false;
      if (Math.hypot(x - HERO.x, z - HERO.z) < 14 || Math.hypot(x - PAV.x, z - PAV.z) < 12) return false;
      const d = fbm2(x * .02, z * .02, 3); return d > -.05 + Math.hypot(x, z + 20) * .0006 && Math.hypot(x, z) < 330; };
    const dec = placeTrees(260, 5, nearOK);
    const mkInst = (geo, list, mat, sc = 1, yoff = 0) => { const m = new THREE.InstancedMesh(geo, mat, list.length); const d = new THREE.Object3D(); const ar = new Float32Array(list.length);
      list.forEach((t, i) => { d.position.set(t[0], t[1] + yoff, t[2]); d.rotation.set(0, t[4], 0); d.scale.setScalar(t[3] * sc); d.updateMatrix(); m.setMatrixAt(i, d.matrix); ar[i] = t[5]; });
      geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(ar, 1)); m.frustumCulled = false; S.add(m); return m; };
    const decA = dec.filter((_, i) => i % 2 === 0), decB = dec.filter((_, i) => i % 2 === 1);
    this.trunkA = mkInst(T1.branches.clone(), decA, vegMat(false, 0), 1.6); this.crownA = mkInst(T1.crown.clone(), decA, vegMat(true, 0), 1.6);
    this.trunkB = mkInst(T2.branches.clone(), decB, vegMat(false, 0), 1.6); this.crownB = mkInst(T2.crown.clone(), decB, vegMat(true, 0), 1.6);
    // 松（常绿）
    const pineGeo = (() => { const gs = []; for (let i = 0; i < 4; i++) { const g = new THREE.ConeGeometry(2.4 - i * .5, 3.2, 7, 1, false); g.translate(0, 2.2 + i * 1.7, 0); gs.push(g.toNonIndexed()); } return mergeGeometries(gs); })();
    const pineTrunk = new THREE.CylinderGeometry(.18, .28, 3, 5, 1, true).translate(0, 1.2, 0).toNonIndexed();
    const pines = placeTrees(340, 9, (x, z, h, r) => h > 6 && h < 140 && !nearCam(x, z, 46) && Math.hypot(x - HERO.x, z - HERO.z) > 24 && Math.hypot(x, z + 20) > 90 && fbm2(x * .015 + 9, z * .015, 3) > -.02 && Math.hypot(x, z) < 520);
    this.pineT = mkInst(pineTrunk, pines, vegMat(false, 0), 1.7); this.pine = mkInst(pineGeo, pines, vegMat(true, 1), 1.7);
    this.pine.material.uniforms.uBare = { value: 0 };

    // 主树（桃 / 桐 / 枫 / 梅）
    const HT = buildTree(77, 6, 3.0, .5, 1, 1.4);
    HERO.y = terrainH(HERO.x, HERO.z);
    this.heroBr = new THREE.Mesh(HT.branches, new THREE.ShaderMaterial({ uniforms: U, vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: GLSL_NOISE + ENV + `uniform float uSnow; varying vec3 vW; varying vec3 vN; void main(){ vec3 N=normalize(vN); float n=vnoise(vW.xy*4.+vW.z); vec3 alb=vec3(.09,.065,.05)*(.7+.6*n);
        alb=mix(alb,vec3(.95,.96,1.),smoothstep(.35,.75,N.y+n*.3-.1)*uSnow); gl_FragColor=vec4(fogit(shade(N,alb,1.),vW),1.); }` }));
    this.heroBr.position.copy(HERO); this.heroBr.scale.setScalar(1.25); this.heroBr.rotation.y = .6; S.add(this.heroBr);
    { // 花点云
      const r = rng(31), N = 16000, pos = new Float32Array(N * 3), rnd = new Float32Array(N);
      const m = new THREE.Matrix4().compose(HERO, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .6, 0)), new THREE.Vector3(1.25, 1.25, 1.25));
      const segs = HT.twigs;
      for (let i = 0; i < N; i++) { const s = segs[Math.floor(r() * segs.length)]; const t = r(); const p = s[0].clone().lerp(s[1], t);
        p.add(new THREE.Vector3((r() - .5) * .9, (r() - .3) * .7, (r() - .5) * .9)); p.applyMatrix4(m); pos.set([p.x, p.y, p.z], i * 3); rnd[i] = r(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
      this.bloomPts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { ...U, uHeroBloom: { value: 0 }, uHeroCol: { value: new THREE.Vector3(1, .6, .7) }, uHeroCol2: { value: new THREE.Vector3(1, .85, .9) }, uSize: { value: .32 } },
        transparent: true, depthWrite: true,
        vertexShader: `attribute float aRand; uniform float uPx,uSize,uHeroBloom,uTime,uWind; varying float vR; varying vec3 vW;
          void main(){ vR=aRand; vec3 p=position; p.x+=uWind*.06*sin(uTime*2.+aRand*20.); vec4 mv=modelViewMatrix*vec4(p,1.); vW=(modelMatrix*vec4(p,1.)).xyz;
            float on=step(aRand,uHeroBloom); gl_Position=projectionMatrix*mv; gl_PointSize=on*uSize*(.6+.8*fract(aRand*13.))*uPx/-mv.z; }`,
        fragmentShader: GLSL_NOISE + ENV + `uniform vec3 uHeroCol,uHeroCol2; varying float vR; varying vec3 vW; void main(){ vec2 d=gl_PointCoord-.5; float a=atan(d.y,d.x); float r=length(d);
          float pet=.36+.12*cos(a*5.+vR*6.); if(r>pet) discard; vec3 c=mix(uHeroCol,uHeroCol2,smoothstep(.0,pet,r)*.8+fract(vR*7.)*.3);
          c=mix(c*1.25,c,smoothstep(.0,.12,r)); vec3 lit=c*(uSunCol*.55+uSkyCol*.9+.15)+c*uFlash; gl_FragColor=vec4(fogit(lit,vW),1.); }` }));
      this.bloomPts.frustumCulled = false; S.add(this.bloomPts);
    }

    // 麦田（近处实例化麦穗）
    { const r = rng(41), N = 36000, list = [];
      for (let i = 0; i < N; i++) { let x, z; if (i < 26000) { const a = r() * 6.28, rr = Math.sqrt(r()) * 34; x = -78 + Math.cos(a) * rr * 1.2; z = 60 + Math.sin(a) * rr * .8; }
        else { x = FIELD.x + (r() - .5) * 2 * FIELD.rx; z = FIELD.z + (r() - .5) * 2 * FIELD.rz; }
        if (Math.hypot((x - FIELD.x) / FIELD.rx, (z - FIELD.z) / FIELD.rz) > .86) continue; list.push([x, 1.5, z, .7 + r() * .6, r() * 6.28, r()]); }
      const g = new THREE.BufferGeometry(); const v = [-.035, 0, 0, .035, 0, 0, 0, 1.15, 0, 0, 1.0, 0, -.06, 1.18, 0, 0, 1.42, 0, 0, 1.0, 0, .06, 1.18, 0, 0, 1.42, 0];
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(9).fill([0, 0, 1]).flat(), 3));
      const mat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide,
        vertexShader: `attribute float aRand; uniform float uTime,uWind,uPaddy; varying vec3 vW; varying float vR; varying float vH;
          void main(){ vR=aRand; vec3 p=position; vH=p.y; vec4 w=modelMatrix*instanceMatrix*vec4(p,1.);
            if(uPaddy>.5 && w.x>${PADDY_X.toFixed(1)}) w.y-=50.;
            float ph=uTime*1.6+w.x*.18+w.z*.07; float s=(.35+uWind)*.28*p.y*p.y*(sin(ph)+.5*sin(ph*2.3+aRand*6.)); w.x+=s; w.z+=s*.5;
            vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: GLSL_NOISE + ENV + `uniform float uWheat; varying vec3 vW; varying float vR; varying float vH;
          void main(){ vec3 a=mix(vec3(.26,.46,.12),vec3(.92,.68,.26),clamp(uWheat*1.1-.05+vR*.15,0.,1.)); a*=(.6+.5*vH)*.72; vec3 c=shade(vec3(0.,1.,0.),a,1.);
            vec3 V=normalize(cameraPosition-vW); c+=uSunCol*a*pow(max(dot(-V,uSunDir),0.),6.)*.2;
            gl_FragColor=vec4(fogit(c,vW),1.); }` });
      this.wheat = mkInst(g, list, mat, 1); }

    // 荷塘
    { const r = rng(51), pads = [], fl = [];
      for (let i = 0; i < 520; i++) { const x = -48 + r() * 70, z = 14 + r() * 16; const ld = Math.hypot((x - LAKE.x) / LAKE.rx, (z - LAKE.z) / LAKE.rz); if (ld > .8 || fbm2(x * .05, z * .05, 2) < -.1) continue; pads.push([x, .06 + r() * .05, z, .6 + r() * .9, r() * 6.28, r()]); }
      for (let i = 0; i < 70; i++) { const p = pads[Math.floor(r() * pads.length)]; fl.push([p[0] + (r() - .5), .1, p[2] + (r() - .5), .6 + r() * .5, r() * 6.28, r()]); }
      const pg = new THREE.CircleGeometry(1, 20, .25, 6.03); pg.rotateX(-Math.PI / 2); const pp = pg.attributes.position.array; for (let i = 0; i < pp.length; i += 3) pp[i + 1] = .12 * Math.hypot(pp[i], pp[i + 2]);
      pg.computeVertexNormals();
      this.pads = mkInst(pg, pads, new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide, vertexShader: `attribute float aRand; varying vec3 vW; varying float vR; void main(){ vR=aRand; vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: GLSL_NOISE + ENV + `varying vec3 vW; varying float vR; void main(){ float n=vnoise(vW.xz*3.); vec3 a=mix(vec3(.12,.32,.1),vec3(.25,.45,.14),n)*(.8+.4*vR);
          vec3 c=shade(vec3(0,1,0),a,1.); vec3 V=normalize(cameraPosition-vW); vec3 H=normalize(uSunDir+V); c+=uSunCol*pow(max(H.y,0.),40.)*.15; gl_FragColor=vec4(fogit(c,vW),1.); }` }), 1);
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(.05 + .55 * Math.sin(t * 1.9) * (1 - t * .25), t * .7)); }
      const fg = new THREE.LatheGeometry(pts, 10); fg.translate(0, .45, 0); const stem = new THREE.CylinderGeometry(.03, .03, .6, 4, 1, true).translate(0, .25, 0);
      this.lotus = mkInst(mergeGeometries([fg.toNonIndexed(), stem.toNonIndexed()]), fl, new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide,
        vertexShader: `attribute float aRand; varying vec3 vW; varying float vY; void main(){ vY=position.y; vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: GLSL_NOISE + ENV + `varying vec3 vW; varying float vY; void main(){ vec3 a=mix(vec3(.95,.82,.85),vec3(.95,.35,.55),smoothstep(.5,1.15,vY)); if(vY<.45) a=vec3(.15,.35,.12);
          vec3 c=shade(vec3(0,1,0),a*.55,1.); gl_FragColor=vec4(fogit(c,vW),1.); }` }), .85);
    }

    // 亭
    { PAV.y = terrainH(PAV.x, PAV.z); const g = new THREE.Group();
      const dark = new THREE.ShaderMaterial({ uniforms: { ...U, uC: { value: new THREE.Vector3(.1, .07, .06) } }, vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: GLSL_NOISE + ENV + `uniform vec3 uC; uniform float uSnow; varying vec3 vW; varying vec3 vN; void main(){ vec3 N=normalize(vN); vec3 a=mix(uC,vec3(.93,.95,1.),smoothstep(.4,.8,N.y)*uSnow); gl_FragColor=vec4(fogit(shade(N,a,1.),vW),1.); }` });
      const red = dark.clone(); red.uniforms = { ...U, uC: { value: new THREE.Vector3(.32, .07, .05) } };
      const base = new THREE.Mesh(new THREE.BoxGeometry(7, .8, 7), dark); base.position.y = .4; g.add(base);
      for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.18, .2, 4.2, 8), red); p.position.set(x, 2.9, z); g.add(p); }
      const rg = new THREE.ConeGeometry(5.6, 3.4, 4, 6, true); rg.rotateY(Math.PI / 4); const ra = rg.attributes.position.array;
      for (let i = 0; i < ra.length; i += 3) { const h01 = (ra[i + 1] + 1.7) / 3.4; const rr = Math.hypot(ra[i], ra[i + 2]); const ang = Math.atan2(ra[i + 2], ra[i]);
        const corner = Math.pow(Math.abs(Math.cos(2 * ang)), 6); const k = Math.pow(1 - h01, 1.7) / Math.max(1 - h01, 1e-3); ra[i] *= h01 < 1 ? k : 1; ra[i + 2] *= h01 < 1 ? k : 1;
        ra[i + 1] += Math.pow(1 - h01, 3) * corner * 1.1; }
      rg.computeVertexNormals(); const roof = new THREE.Mesh(rg, dark); roof.material = dark.clone(); roof.material.side = THREE.DoubleSide; roof.material.uniforms = dark.uniforms; roof.position.y = 6.5; g.add(roof);
      const fin = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), dark); fin.position.y = 8.3; g.add(fin);
      this.lamp = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3, 1.1) })); this.lamp.position.set(0, 3.6, 0); g.add(this.lamp);
      g.position.copy(PAV); g.rotation.y = .4; S.add(g); this.pav = g; }

    // 舟 + 蓑笠翁 + 渔火
    { const g = new THREE.Group(); const hull = new THREE.BoxGeometry(6, .7, 1.5, 12, 1, 2); const a = hull.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { const t = a[i] / 3; a[i + 2] *= 1 - Math.pow(Math.abs(t), 2.2) * .85; a[i + 1] += Math.pow(Math.abs(t), 2) * .55 * (a[i + 1] > 0 ? 1 : .4); }
      hull.computeVertexNormals();
      const m = new THREE.ShaderMaterial({ uniforms: U, vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: GLSL_NOISE + ENV + `uniform float uSnow; varying vec3 vW; varying vec3 vN; void main(){ vec3 N=normalize(vN); vec3 a=mix(vec3(.05,.04,.035),vec3(.9,.92,.96),smoothstep(.75,.95,N.y)*uSnow*.6); gl_FragColor=vec4(fogit(shade(N,a,1.),vW),1.); }` });
      g.add(new THREE.Mesh(hull, m)); const can = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, 1.8, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), m);
      can.rotation.set(0, 0, 0); can.position.set(-.6, .55, 0); can.rotation.x = 0; g.add(can);
      this.fisher = new THREE.Group(); const body = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.1, 8), m); body.position.y = .9; const hat = new THREE.Mesh(new THREE.ConeGeometry(.55, .32, 12), m); hat.position.y = 1.55;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(.015, .02, 4.5, 4), m); rod.position.set(1.6, 1.9, 0); rod.rotation.z = -1.05;
      this.fisher.add(body, hat, rod); this.fisher.position.set(1.3, 0, 0); g.add(this.fisher);
      const lineG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(3.55, 3.05, 0), new THREE.Vector3(3.7, 0, 0)]); this.fisher.add(new THREE.Line(lineG, new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: .5 })));
      this.boatLamp = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 4, 1.2) })); this.boatLamp.position.set(-2.6, 1.5, 0); g.add(this.boatLamp);
      g.position.copy(BOAT); g.rotation.y = .5; S.add(g); this.boat = g; }

    // 鸟（实例化，扇翅在顶点着色器）
    { const g = new THREE.BufferGeometry(); const v = [0, 0, -.9, 0, 0, .7, 0, .08, 0, /*L*/ 0, 0, -.25, -2.2, 0, .25, 0, 0, .35, /*R*/ 0, 0, -.25, 2.2, 0, .25, 0, 0, .35, /*tail*/0, 0, .5, -.3, 0, 1.1, .3, 0, 1.1];
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      this.birdN = 24; const ar = new Float32Array(this.birdN).map((_, i) => i / 24); g.setAttribute('aRand', new THREE.InstancedBufferAttribute(ar, 1));
      this.birds = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({ uniforms: { ...U, uFlapF: { value: 7 } }, side: THREE.DoubleSide,
        vertexShader: `attribute float aRand; uniform float uTime,uFlapF; varying vec3 vW; void main(){ vec3 p=position; float s=sin(uTime*uFlapF+aRand*12.);
          p.y+=abs(p.x)*s*.55; p.x*=1.-abs(s)*.12; vec4 w=modelMatrix*instanceMatrix*vec4(p,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: GLSL_NOISE + ENV + `varying vec3 vW; void main(){ vec3 c=vec3(.03,.03,.035)+uSkyCol*.04; gl_FragColor=vec4(fogit(c,vW),1.); }` }), this.birdN);
      this.birds.frustumCulled = false; S.add(this.birds); }

    // 粒子系统
    const box = (n, seed, attrs) => { const r = rng(seed); const g = new THREE.BufferGeometry(); const s = new Float32Array(n * 4); for (let i = 0; i < n * 4; i++) s[i] = r();
      g.setAttribute('aSeed', new THREE.BufferAttribute(s, 4)); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); return g; };
    const PSHARED = `uniform vec3 uBoxC, uBoxS; uniform float uTime,uPx,uWind; attribute vec4 aSeed;`;
    // 雨（线段）
    { const n = 9000; const g = new THREE.BufferGeometry(); const s = new Float32Array(n * 2 * 4), e = new Float32Array(n * 2); const r = rng(61);
      for (let i = 0; i < n; i++) { const a = [r(), r(), r(), r()]; s.set(a, i * 8); s.set(a, i * 8 + 4); e[i * 2] = 0; e[i * 2 + 1] = 1; }
      g.setAttribute('aSeed', new THREE.BufferAttribute(s, 4)); g.setAttribute('aEnd', new THREE.BufferAttribute(e, 1)); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
      this.rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms: { ...U, uBoxC: { value: new THREE.Vector3() }, uBoxS: { value: new THREE.Vector3(70, 45, 70) }, uAmt: { value: 0 } }, transparent: true, depthWrite: false,
        vertexShader: PSHARED + `attribute float aEnd; uniform float uAmt; varying float vA; varying vec3 vW;
          void main(){ vec3 vel=vec3(uWind*6.,-30.,0.); vec3 p=uBoxC-uBoxS*.5+fract(aSeed.xyz+vel*uTime/uBoxS)*uBoxS; p-=vel*.03*aEnd;
            vA=step(aSeed.w,uAmt); vW=p; gl_Position=projectionMatrix*viewMatrix*vec4(p,1.); }`,
        fragmentShader: GLSL_NOISE + ENV + `varying float vA; varying vec3 vW; void main(){ if(vA<.5) discard; float d=length(vW-cameraPosition); gl_FragColor=vec4((uSkyCol*.9+uFogCol*.5+uFlash),.38*smoothstep(80.,5.,d)); }` }));
      this.rain.frustumCulled = false; S.add(this.rain); }
    const ptsMat = (frag, extraVS, uniforms = {}, additive = false) => new THREE.ShaderMaterial({ uniforms: { ...U, uBoxC: { value: new THREE.Vector3() }, uBoxS: { value: new THREE.Vector3(80, 45, 80) }, uAmt: { value: 0 }, ...uniforms },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: PSHARED + `uniform float uAmt; varying float vA; varying vec4 vS; varying vec3 vW;` + extraVS, fragmentShader: GLSL_NOISE + ENV + `varying float vA; varying vec4 vS; varying vec3 vW;` + frag });
    // 雪
    this.snow = new THREE.Points(box(16000, 71), ptsMat(`void main(){ if(vA<.5) discard; float r=length(gl_PointCoord-.5); float a=smoothstep(.5,.15,r); vec3 c=vec3(.95,.97,1.)*(uSkyCol*.5+.55);
        gl_FragColor=vec4(fogit(c,vW),a*.92); }`,
      `void main(){ vS=aSeed; vec3 vel=vec3(uWind*3.5,-2.6-aSeed.w*1.4,uWind*.8); vec3 p=uBoxC-uBoxS*.5+fract(aSeed.xyz+vel*uTime/uBoxS)*uBoxS;
        p.x+=sin(uTime*1.3+aSeed.w*20.)*.6; p.z+=cos(uTime*1.1+aSeed.x*20.)*.6; vA=step(aSeed.w,uAmt); vW=p; vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(.07+.09*aSeed.y)*uPx/-mv.z; }`));
    // 花瓣 / 落叶
    this.petals = new THREE.Points(box(3000, 81), ptsMat(`uniform vec3 uPCol,uPCol2; void main(){ if(vA<.5) discard; vec2 d=gl_PointCoord-.5; float an=vS.x*6.28+uTime*(1.+vS.y*2.); mat2 R=mat2(cos(an),-sin(an),sin(an),cos(an)); d=R*d; d.x*=1.9;
        float a=smoothstep(.5,.4,length(d)); if(a<.05) discard; vec3 c=mix(uPCol,uPCol2,vS.z); c=c*(uSunCol*.5+uSkyCol*.9+.12); gl_FragColor=vec4(fogit(c,vW),a); }`,
      `void main(){ vS=aSeed; vec3 vel=vec3(uWind*4.+1.,-1.1-aSeed.w*.6,.6); vec3 p=uBoxC-uBoxS*.5+fract(aSeed.xyz+vel*uTime/uBoxS)*uBoxS; p.y+=sin(uTime*2.+aSeed.x*30.)*.5; p.x+=sin(uTime*1.5+aSeed.z*30.);
        vA=step(aSeed.w,uAmt); vW=p; vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(.22+.18*aSeed.y)*uPx/-mv.z; }`, { uPCol: { value: new THREE.Vector3(1, .62, .7) }, uPCol2: { value: new THREE.Vector3(1, .85, .88) } }));
    // 萤火 / 露珠闪光 / 尘埃
    this.flies = new THREE.Points(box(700, 91), ptsMat(`void main(){ if(vA<.5) discard; float r=length(gl_PointCoord-.5); float a=exp(-r*r*40.); float b=pow(.5+.5*sin(uTime*(2.+vS.y*3.)+vS.x*40.),3.);
        gl_FragColor=vec4(vec3(1.4,2.2,.6)*a*b,1.); }`,
      `void main(){ vS=aSeed; vec3 p=uBoxC+vec3((aSeed.x-.5)*uBoxS.x,aSeed.y*4.+.3,(aSeed.z-.5)*uBoxS.z); p+=vec3(sin(uTime*.4+aSeed.w*30.)*1.6,sin(uTime*.7+aSeed.x*20.)*.6,cos(uTime*.35+aSeed.y*25.)*1.6);
        vA=step(aSeed.w,uAmt); vW=p; vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=.28*uPx/-mv.z; }`, {}, true));
    this.dew = new THREE.Points(box(9000, 101), ptsMat(`void main(){ if(vA<.5) discard; vec2 d=gl_PointCoord-.5; float a=exp(-dot(d,d)*60.)+exp(-abs(d.x)*60.-abs(d.y)*9.)*.5+exp(-abs(d.y)*60.-abs(d.x)*9.)*.5;
        float tw=pow(.5+.5*sin(uTime*3.+vS.x*60.),6.); gl_FragColor=vec4(vec3(1.,1.,1.1)*a*tw*.9,1.); }`,
      `uniform float uDewH; void main(){ vS=aSeed; vec3 p=uBoxC+vec3((aSeed.x-.5)*uBoxS.x,0.,(aSeed.z-.5)*uBoxS.z); p.y=aSeed.y*.35+uDewH; vA=step(aSeed.w,uAmt); vW=p; vec4 mv=viewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv; gl_PointSize=.07*uPx/-mv.z; }`, { uDewH: { value: 0 } }, true));
    this.motes = new THREE.Points(box(2400, 111), ptsMat(`void main(){ if(vA<.5) discard; float r=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,r); gl_FragColor=vec4(uSunCol*.35*a,1.); }`,
      `void main(){ vS=aSeed; vec3 vel=vec3(1.5+uWind*5.,.15,.3); vec3 p=uBoxC-uBoxS*.5+fract(aSeed.xyz+vel*uTime/uBoxS)*uBoxS; vA=step(aSeed.w,uAmt); vW=p; vec4 mv=viewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv; gl_PointSize=.06*uPx/-mv.z; }`, {}, true));
    for (const p of [this.snow, this.petals, this.flies, this.dew, this.motes]) { p.frustumCulled = false; S.add(p); }
    // 菊（前景金黄花丛）
    { const r = rng(121), N = 2600, pos = new Float32Array(N * 3), rr = new Float32Array(N);
      for (let i = 0; i < N; i++) { const cx = -14 + (Math.floor(i / 260) % 5) * 3.2 + (r() - .5) * 6, cz = 66 - Math.floor(i / 1300) * 4 + (r() - .5) * 5; pos.set([cx, terrainH(cx, cz) + .3 + r() * .5, cz], i * 3); rr[i] = r(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRand', new THREE.BufferAttribute(rr, 1));
      this.chrys = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: U, transparent: false,
        vertexShader: `attribute float aRand; uniform float uPx,uTime,uWind; varying float vR; varying vec3 vW; void main(){ vR=aRand; vec3 p=position; p.x+=sin(uTime*1.5+aRand*9.)*.05; vW=p; vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(.22+.12*aRand)*uPx/-mv.z; }`,
        fragmentShader: GLSL_NOISE + ENV + `varying float vR; varying vec3 vW; void main(){ vec2 d=gl_PointCoord-.5; float a=atan(d.y,d.x), r=length(d); float pet=.32+.16*pow(abs(cos(a*7.+vR*5.)),.6); if(r>pet) discard;
          vec3 c=mix(vec3(1.,.62,.08),vec3(1.,.85,.25),r/pet); c=mix(vec3(.5,.25,.03),c,smoothstep(.05,.12,r)); gl_FragColor=vec4(fogit(c*(uSunCol*.6+uSkyCol*.8),vW),1.); }` }));
      this.chrys.frustumCulled = false; S.add(this.chrys); }
    // 闪电
    { const r = rng(131); const pts = []; let p = new THREE.Vector3(-120, 420, -650); pts.push(p.clone());
      for (let i = 0; i < 26; i++) { p = p.clone().add(new THREE.Vector3((r() - .5) * 38, -16 - r() * 8, (r() - .5) * 10)); pts.push(p.clone()); }
      const segs = []; for (let i = 0; i < pts.length - 1; i++) segs.push(pts[i], pts[i + 1]);
      let q = pts[9].clone(); for (let i = 0; i < 9; i++) { const n = q.clone().add(new THREE.Vector3(14 + r() * 14, -12 - r() * 10, 0)); segs.push(q, n); q = n; }
      this.bolt = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), new THREE.LineBasicMaterial({ color: new THREE.Color(12, 12, 16), transparent: true, opacity: 0, fog: false }));
      this.bolt.frustumCulled = false; S.add(this.bolt); }
    this.cfgKey = null;
  }

  apply(shot) {
    const sc = shot.scene, U = this.U, T = TOD[sc.tod];
    const v = (k, a) => U[k].value.set(a[0], a[1], a[2]);
    v('uZen', T.zen); v('uHor', T.hor); v('uSunCol', T.sun); v('uSkyCol', T.sky); v('uGndCol', T.gnd); v('uFogCol', T.fog); v('uWaterCol', T.water); v('uRidge', T.ridge); v('uCloudCol', T.ccol);
    U.uFogDen.value = T.den * .78; U.uCloud.value = T.cloud; U.uSunDisc.value = T.disc ?? 1; U.uStars.value = T.stars || 0; U.uMoon.value = sc.moon ? 1 : 0;
    const el = (T.el < 0 && T.moon ? (T.moonEl) : T.el) * D2R, az = (T.el < 0 && T.moon ? T.moonAz : T.az) * D2R;
    U.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    if (T.el < 0 && !T.moon) U.uSunDir.value.set(Math.sin(az) * .9, .25, -.9).normalize();
    U.uMoonDir.value.set(Math.sin((T.moonAz || 0) * D2R) * Math.cos((T.moonEl || 30) * D2R), Math.sin((T.moonEl || 30) * D2R), -Math.cos((T.moonAz || 0) * D2R) * Math.cos((T.moonEl || 30) * D2R));
    const s = shot.season;
    U.uGreen.value = sc.green ?? 0; U.uSummer.value = s === 'summer' ? 1 : s === 'autumn' ? .7 : 0; U.uAutumn.value = sc.autumn || 0; U.uSnow.value = sc.snow || 0; U.uFrost.value = sc.frost || 0;
    U.uWheat.value = sc.wheat || 0; U.uPaddy.value = sc.paddy || 0; U.uBlossom.value = (sc.blossom || 0) * .5; U.uBare.value = sc.bare || 0; U.uWind.value = .3 + (sc.wind || 0) * .9;
    U.uIce.value = sc.ice || 0; U.uRain.value = sc.rain || 0; U.uMist.value = (sc.mist || 0) * .55;
    const bc = { peach: [1.0, .45, .58], white: [.95, .88, .95], plum: [.85, .08, .16] }[sc.bloomcol || 'peach'];
    v('uBloomCol', bc);
    // 主树
    const hb = this.bloomPts.material.uniforms; let hero = 0;
    if (sc.blossom && (sc.bloomcol === 'peach' || sc.bloomcol === 'white')) { hero = sc.blossom; hb.uHeroCol.value.set(...(sc.bloomcol === 'white' ? [.92, .82, .95] : [1., .42, .58])); hb.uHeroCol2.value.set(...(sc.bloomcol === 'white' ? [1, .97, 1] : [1, .82, .88])); hb.uSize.value = .3; }
    if (sc.maple) { hero = 1; hb.uHeroCol.value.set(.85, .12, .04); hb.uHeroCol2.value.set(1., .45, .08); hb.uSize.value = .42; }
    if (sc.plum) { hero = .55 * sc.plum + .15; hb.uHeroCol.value.set(.7, .02, .06); hb.uHeroCol2.value.set(.95, .14, .2); hb.uSize.value = .3; }
    if (s === 'summer' || (s === 'autumn' && !sc.maple)) { hero = .9; hb.uHeroCol.value.set(.1, .28, .07); hb.uHeroCol2.value.set(.25, .42, .12); if (s === 'autumn') { hb.uHeroCol.value.set(.55, .4, .1); hb.uHeroCol2.value.set(.3, .38, .1); } hb.uSize.value = .5; }
    if (shot.term === '谷雨') { hero = .5; hb.uHeroCol.value.set(.2, .4, .1); hb.uHeroCol2.value.set(1, .7, .78); hb.uSize.value = .4; }
    hb.uHeroBloom.value = hero;
    this.wheat.visible = !!(sc.wheat || sc.paddy);
    this.pads.visible = this.lotus.visible = !!sc.lotus;
    this.chrys.visible = !!sc.chrys;
    this.boatLamp.visible = !!(sc.boat && sc.tod === 'night'); this.boat.visible = !!sc.boat || shot.term === '立秋' || shot.term === '雨水';
    this.fisher.visible = !!sc.fisher || shot.term === '雨水';
    this.lamp.visible = !!(sc.lamp || sc.tod === 'night');
    this.lamp.material.color.setRGB(...(sc.lamp ? [7, 3.4, 1.2] : [3, 1.5, .5]));
    const cA = this.crownA.material.uniforms, cB = this.crownB.material.uniforms;
    // 粒子
    const amt = (p, a) => { p.visible = a > 0; p.material.uniforms.uAmt.value = a; };
    amt(this.rain, sc.rain || 0); amt(this.snow, sc.snowfall || 0);
    amt(this.petals, sc.petals ? .9 : sc.leaves ? sc.leaves : (shot.term === '惊蛰' ? .25 : 0));
    if (sc.leaves) { this.petals.material.uniforms.uPCol.value.set(.85, .3, .06); this.petals.material.uniforms.uPCol2.value.set(.95, .62, .12); }
    else { this.petals.material.uniforms.uPCol.value.set(1, .55, .66); this.petals.material.uniforms.uPCol2.value.set(1, .86, .9); }
    if (shot.term === '大寒') { amt(this.petals, .25); this.petals.material.uniforms.uPCol.value.set(.8, .05, .1); this.petals.material.uniforms.uPCol2.value.set(1, .3, .35); }
    amt(this.flies, sc.fireflies ? 1 : 0); amt(this.dew, sc.dew ? .55 : sc.frost ? .35 : 0); amt(this.motes, sc.wind || sc.heat ? .8 : (sc.tod === 'noon' || sc.tod === 'clear' ? .35 : 0));
    this.dew.material.uniforms.uDewH.value = sc.dew ? 2.2 : 1.5;
    this.bolt.visible = !!sc.lightning;
    this.birdKind = sc.geese ? 'geese' : sc.swallows ? 'swallow' : sc.eagle ? 'eagle' : sc.magpie ? 'magpie' : null;
    this.birds.visible = !!this.birdKind;
    this.birds.material.uniforms.uFlapF.value = { geese: 5, swallow: 14, eagle: 1.2, magpie: 9 }[this.birdKind] || 6;
    this.cfgKey = shot.id;
  }

  update(shot, lt, T) {
    if (this.cfgKey !== shot.id) this.apply(shot);
    const U = this.U, sc = shot.scene, dur = shot.dur, k = clamp(lt / dur, 0, 1), e = easeSine(k);
    U.uTime.value = T;
    // 立春冰融 / 立冬结冰
    if (sc.thaw) U.uIce.value = lerp(sc.ice, sc.ice - .45, smooth(.1, .95, k));
    if (shot.term === '立冬') U.uIce.value = lerp(.12, .42, k);
    // 大寒：末尾天光转暖，预示立春
    if (sc.dawnlight) { const w = smooth(.55, 1, k); U.uSunCol.value.set(lerp(.75, 2.2, w), lerp(.77, 1.5, w), lerp(.82, .9, w)); U.uSunDisc.value = w * .8; U.uFogCol.value.set(lerp(.82, .95, w), lerp(.84, .84, w), lerp(.88, .82, w)); }
    // 闪电
    let fl = 0; if (sc.lightning) { for (const t0 of [1.45, 1.6, 4.45]) fl = Math.max(fl, Math.exp(-Math.max(lt - t0, 0) * 9) * (lt >= t0 ? 1 : 0)); }
    U.uFlash.value = fl * .9; this.bolt.material.opacity = fl > .25 ? 1 : 0;
    // 镜头
    const c = CAMS[shot.term]; const cam = this.cam;
    const P = new THREE.Vector3().lerpVectors(new THREE.Vector3(...c[0]), new THREE.Vector3(...c[1]), e);
    const Tg = new THREE.Vector3().lerpVectors(new THREE.Vector3(...c[2]), new THREE.Vector3(...c[3]), e);
    P.y += Math.sin(T * .7) * .08; P.y = Math.max(P.y, terrainH(P.x, P.z) + 2.2); cam.position.copy(P); cam.lookAt(Tg); cam.fov = c[4]; cam.aspect = this.W / this.H; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    U.uPx.value = this.H / (2 * Math.tan(cam.fov * D2R / 2));
    // 粒子盒跟随镜头
    const fwd = new THREE.Vector3().subVectors(Tg, P).normalize();
    const bc = P.clone().addScaledVector(fwd, 30);
    for (const p of [this.rain, this.snow, this.petals, this.motes]) p.material.uniforms.uBoxC.value.copy(bc);
    this.flies.material.uniforms.uBoxC.value.set(P.x + fwd.x * 22, .2, P.z + fwd.z * 22); this.flies.material.uniforms.uBoxS.value.set(40, 6, 34);
    const dc = P.clone().addScaledVector(fwd, 9); this.dew.material.uniforms.uBoxC.value.set(dc.x, terrainH(dc.x, dc.z), dc.z); this.dew.material.uniforms.uBoxS.value.set(16, 1, 14);
    this.dew.material.uniforms.uDewH.value = terrainH(dc.x, dc.z) + .05;
    // 舟漂
    this.boat.position.set(BOAT.x + Math.sin(T * .2) * .4, Math.sin(T * 1.1) * .05 - .1, BOAT.z); this.boat.rotation.z = Math.sin(T * .9) * .025;
    // 鸟
    if (this.birdKind) this.updateBirds(lt, dur, P, fwd);
    return { };
  }

  updateBirds(lt, dur, P, fwd) {
    const d = new THREE.Object3D(); const n = this.birdN; const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    for (let i = 0; i < n; i++) {
      let pos, dir, s = 1, show = true;
      if (this.birdKind === 'geese') { // 人字雁阵
        if (i >= 13) { show = false; } else {
          const row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? 1 : -1);
          const dirv = right.clone().multiplyScalar(-1).addScaledVector(fwd, -.35).normalize();
          const c0 = P.clone().addScaledVector(fwd, 120).addScaledVector(right, 110).add(new THREE.Vector3(0, 42, 0));
          const head = c0.clone().addScaledVector(dirv, lt * 30);
          const back = dirv.clone().multiplyScalar(-1);
          const perp = new THREE.Vector3().crossVectors(dirv, new THREE.Vector3(0, 1, 0)).normalize();
          pos = head.clone().addScaledVector(back, row * 4.2).addScaledVector(perp, side * row * 3.4); pos.y += Math.sin(lt * 1.3 + i) * .3; dir = dirv; s = 1.25; }
      } else if (this.birdKind === 'swallow') {
        if (i >= 6) show = false; else { const ph = i * 1.1; const t = lt * 1.1 + ph;
          pos = P.clone().addScaledVector(fwd, 18 + i * 4 + Math.sin(t * 1.3) * 6).addScaledVector(right, Math.sin(t * 1.7 + i) * 14).add(new THREE.Vector3(0, 1.2 + Math.abs(Math.sin(t * 2.1)) * 4 - P.y * .5, 0));
          const t2 = t + .02; const p2 = P.clone().addScaledVector(fwd, 18 + i * 4 + Math.sin(t2 * 1.3) * 6).addScaledVector(right, Math.sin(t2 * 1.7 + i) * 14).add(new THREE.Vector3(0, 1.2 + Math.abs(Math.sin(t2 * 2.1)) * 4 - P.y * .5, 0));
          dir = p2.sub(pos).normalize(); s = .35; }
      } else if (this.birdKind === 'eagle') {
        if (i >= 1) show = false; else { const a = lt * .35; const c0 = P.clone().addScaledVector(fwd, 70).add(new THREE.Vector3(0, 30, 0));
          pos = c0.clone().addScaledVector(right, Math.cos(a) * 16).addScaledVector(fwd, Math.sin(a) * 16); dir = right.clone().multiplyScalar(-Math.sin(a)).addScaledVector(fwd, Math.cos(a)).normalize(); s = 1.6; }
      } else if (this.birdKind === 'magpie') {
        if (i >= 3) show = false; else { const t = clamp(lt / dur, 0, 1); const a = HERO.clone().add(new THREE.Vector3(-30 + i * 3, 22 + i * 2, -30));
          const b = HERO.clone().add(new THREE.Vector3(-1 + i * .8, 9 + i * .7, 0)); pos = a.lerp(b, easeIO(clamp(t * 1.3 - i * .1, 0, 1))); dir = b.clone().sub(a).normalize(); s = .5; }
      }
      if (!show) { d.scale.setScalar(0); d.updateMatrix(); this.birds.setMatrixAt(i, d.matrix); continue; }
      d.position.copy(pos); d.lookAt(pos.clone().sub(dir)); d.scale.setScalar(s); d.updateMatrix(); this.birds.setMatrixAt(i, d.matrix);
    }
    this.birds.instanceMatrix.needsUpdate = true;
  }
}

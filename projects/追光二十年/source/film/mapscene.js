// 数据地形：点阵地形（真实高程），风电（青）与光伏（金）光柱按累计装机逐年生长，特高压光弧西电东送
import * as THREE from 'three';
import { GLSL_NOISE, D2R, clamp, lerp, smooth, rng } from './util.js';

export const LON0 = 104, LAT0 = 35, K = 1.0;            // 1 单位 = 1 经度
export const xz = (lon, lat) => [(lon - LON0) * K * Math.cos(LAT0 * D2R) * 1.25, -(lat - LAT0) * K];
// 基地：经度、纬度、类型（w 风 / s 光）、权重、起始年份、扩散半径
const BASES = [
  [97.5, 40.3, 'w', 1.2, 2007, 1.2], [116.1, 43.9, 'w', 1.0, 2008, 1.6], [113.1, 41.0, 'w', 1.0, 2008, 1.2], [114.9, 41.0, 'w', .8, 2008, .8],
  [93.5, 42.8, 'w', 1.0, 2010, 1.3], [88.3, 43.4, 'w', .6, 2006, .8], [122.8, 45.6, 'w', .7, 2009, 1.0], [106.2, 37.5, 'w', .6, 2010, .8],
  [121.6, 32.4, 'w', .6, 2016, .5], [119.9, 25.5, 'w', .4, 2018, .4], [111.9, 21.6, 'w', .5, 2019, .5], [121.5, 37.3, 'w', .4, 2021, .5], [110.0, 39.0, 'w', .7, 2012, 1.4],
  [100.6, 36.2, 's', 1.2, 2011, 1.0], [94.9, 36.4, 's', .9, 2011, 1.0], [108.5, 40.2, 's', 1.0, 2016, 1.2], [105.0, 37.5, 's', .8, 2013, .8],
  [93.0, 42.6, 's', .7, 2014, 1.0], [94.7, 40.1, 's', .6, 2013, .8], [113.3, 40.1, 's', .5, 2016, .7], [87.5, 44.0, 's', .5, 2016, .9],
  [117.0, 36.6, 's', 1.0, 2017, 1.3], [115.5, 38.0, 's', .9, 2017, 1.3], [119.5, 32.5, 's', .9, 2017, 1.2], [120.2, 29.2, 's', .8, 2017, 1.0],
  [113.6, 34.7, 's', .9, 2018, 1.3], [117.2, 31.8, 's', .7, 2018, 1.0], [113.3, 23.1, 's', .6, 2019, .9], [104.1, 30.7, 's', .4, 2020, .9], [110.0, 30.0, 's', .5, 2020, 1.6]];
export const CITIES = [[116.4, 39.9], [121.5, 31.2], [113.3, 23.1], [114.1, 22.5], [114.3, 30.6], [104.1, 30.7], [106.5, 29.6], [108.9, 34.3], [113.6, 34.7],
  [118.8, 32.1], [120.2, 30.3], [117.2, 39.1], [123.4, 41.8], [113.0, 28.2], [126.6, 45.8], [102.7, 25.0], [119.3, 26.1], [117.0, 36.7]];
// 特高压直流（起点 → 落点，投运年份）
const UHV = [[101.5, 25.0, 113.3, 23.1, 2010], [104.6, 28.8, 121.5, 31.2, 2010], [102.3, 27.9, 120.6, 31.3, 2012], [93.5, 42.8, 113.6, 34.7, 2014],
  [97.5, 40.3, 112.9, 27.8, 2017], [116.1, 43.9, 119.9, 32.5, 2017], [120.9, 44.6, 118.5, 36.7, 2017], [87.3, 44.0, 118.8, 30.9, 2019],
  [100.6, 36.2, 114.0, 33.0, 2020], [109.7, 38.3, 114.3, 30.6, 2021], [102.9, 27.2, 119.9, 31.8, 2022], [106.3, 38.0, 112.6, 26.9, 2025]];

export class MapScene {
  constructor(W, H, pts, WIND, SOLAR) {
    const S = this.scene = new THREE.Scene(); S.background = new THREE.Color(0x02040b); S.fog = new THREE.FogExp2(0x02040b, .012);
    this.cam = new THREE.PerspectiveCamera(32, W / H, .1, 2000);
    this.WIND = WIND; this.SOLAR = SOLAR;
    const U = this.U = { uTime: { value: 0 }, uYear: { value: 2005 }, uFocus: { value: new THREE.Vector2(0, 0) } };
    // 点阵地形：六棱柱，高 = 高程
    const geo = new THREE.CylinderGeometry(.13, .13, 1, 6, 1); geo.translate(0, .5, 0);
    const n = pts.length; const m = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: `attribute vec3 aInfo; varying vec3 vI; varying vec3 vW; varying vec3 vN;
        void main(){ vI=aInfo; vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix*instanceMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: GLSL_NOISE + `uniform float uTime; varying vec3 vI; varying vec3 vW; varying vec3 vN;
        void main(){ float h=vI.x, edge=vI.y; vec3 base=mix(vec3(.05,.08,.13),vec3(.16,.2,.27),smoothstep(0.,.8,h)); base=mix(base,vec3(.32,.34,.38),smoothstep(.55,.9,h));
          float l=.55+.45*max(dot(normalize(vN),normalize(vec3(-.4,.9,.3))),0.); vec3 c=base*l; c*=1.-.25*step(.5,abs(vN.y));
          c+=vec3(.15,.3,.5)*pow(1.-abs(vN.y),3.)*.2; c*=edge; gl_FragColor=vec4(c,1.); }` }), n);
    const d = new THREE.Object3D(); const info = new Float32Array(n * 3);
    pts.forEach(([lo, la, h], i) => { const [x, z] = xz(lo, la); d.position.set(x, 0, z); d.scale.set(1, .05 + h * 2.4, 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      const dist = Math.hypot((lo - 104) / 34, (la - 35) / 20); info.set([h, clamp(1.25 - dist * .9, 0, 1), 0], i * 3); });
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 3)); m.frustumCulled = false; S.add(m);
    this.heightAt = (lo, la) => { let best = 0, bd = 1e9; for (let i = 0; i < n; i += 3) { const p = pts[i]; const dd = (p[0] - lo) ** 2 + (p[1] - la) ** 2; if (dd < bd) { bd = dd; best = p[2]; } } return .05 + best * 2.4; };
    // 装机光柱：每根约 0.5 GW
    const r = rng(17); const lights = []; const tot = (t) => BASES.filter(b => b[2] === t).reduce((a, b) => a + b[3], 0);
    for (const t of ['w', 's']) {
      const total = t === 'w' ? WIND[2025] : SOLAR[2025]; const cnt = Math.round(total / .5); const bs = BASES.filter(b => b[2] === t); const tw = tot(t);
      for (let k = 0; k < cnt; k++) {
        const thr = (k + r()) / cnt * total;                    // 累计容量超过阈值时出现
        const year = this.yearOf(t === 'w' ? WIND : SOLAR, thr);
        // 选基地：按权重，但只在基地启用年份之后
        const elig = bs.filter(b => b[4] <= Math.max(year, 2006)); const pool = elig.length ? elig : bs; const sw = pool.reduce((a, b) => a + b[3], 0);
        let q = r() * sw, b = pool[0]; for (const bb of pool) { q -= bb[3]; if (q <= 0) { b = bb; break; } }
        const ang = r() * 6.283, rad = Math.sqrt(r()) * b[5]; const lo = b[0] + Math.cos(ang) * rad * 1.2, la = b[1] + Math.sin(ang) * rad * .8;
        lights.push([lo, la, t === 'w' ? 0 : 1, year, r()]);
      }
    }
    const lgeo = new THREE.CylinderGeometry(.035, .035, 1, 5, 1, true); lgeo.translate(0, .5, 0);
    const lm = new THREE.InstancedMesh(lgeo, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 aL; uniform float uYear,uTime; varying float vy; varying float vk; varying float va;
        void main(){ float age=uYear-aL.y; float on=smoothstep(0.,.35,age); vk=aL.x; vy=position.y; va=on;
          vec3 p=position; p.y*= (.5+aL.z*.9)*on*(1.+.25*exp(-max(age,0.)*6.)); vec4 w=modelMatrix*instanceMatrix*vec4(p,1.); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `varying float vy; varying float vk; varying float va; void main(){ vec3 c=mix(vec3(.25,.85,1.),vec3(1.,.72,.25),vk); float a=pow(1.-vy,1.6)*va; gl_FragColor=vec4(c*a*1.6,1.); }` }), lights.length);
    const li = new Float32Array(lights.length * 4);
    lights.forEach(([lo, la, k, y, rr], i) => { const [x, z] = xz(lo, la); d.position.set(x, this.heightAt(lo, la), z); d.scale.set(1, 1, 1); d.updateMatrix(); lm.setMatrixAt(i, d.matrix); li.set([k, y, rr, 0], i * 4); });
    lgeo.setAttribute('aL', new THREE.InstancedBufferAttribute(li, 4)); lm.frustumCulled = false; S.add(lm);
    // 光柱顶部的辉点
    const pg = new THREE.BufferGeometry(); const pp = [], pa = [];
    lights.forEach(([lo, la, k, y, rr]) => { const [x, z] = xz(lo, la); pp.push(x, this.heightAt(lo, la) + .5 + rr * .9, z); pa.push(k, y, rr, 0); });
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute('aL', new THREE.Float32BufferAttribute(pa, 4));
    this.tops = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: { ...U, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 aL; uniform float uYear,uPx,uTime; varying float vk; varying float va; void main(){ float age=uYear-aL.y; va=smoothstep(0.,.35,age)*(1.+1.5*exp(-max(age,0.)*5.)); vk=aL.x;
        vec3 p=position; p.y=p.y-(1.-smoothstep(0.,.35,age))*(.5+aL.z*.9); vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*.16/-mv.z*(.8+.5*sin(uTime*3.+aL.z*40.)); }`,
      fragmentShader: `varying float vk; varying float va; void main(){ float d=length(gl_PointCoord-.5); vec3 c=mix(vec3(.4,.92,1.),vec3(1.,.8,.4),vk); gl_FragColor=vec4(c*exp(-d*d*22.)*va*1.6,1.); }` }));
    this.tops.frustumCulled = false; S.add(this.tops);
    // 城市辉光
    const cg = new THREE.BufferGeometry(); const cp = [];
    CITIES.forEach(([lo, la]) => { for (let k = 0; k < 18; k++) { const [x, z] = xz(lo + (r() - .5) * 1.4, la + (r() - .5) * 1.0); cp.push(x, this.heightAt(lo, la) + .1, z); } });
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    this.cityPts = new THREE.Points(cg, new THREE.ShaderMaterial({ uniforms: { ...U, uPx: { value: 1 }, uC: { value: .3 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uPx; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*.35/-mv.z; }`,
      fragmentShader: `uniform float uC; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(1.,.82,.55)*exp(-d*d*14.)*uC,1.); }` }));
    S.add(this.cityPts);
    // 特高压光弧
    this.uhv = UHV.map(([a, b, c, dd, y], i) => {
      const [x0, z0] = xz(a, b), [x1, z1] = xz(c, dd); const h0 = this.heightAt(a, b), h1 = this.heightAt(c, dd); const len = Math.hypot(x1 - x0, z1 - z0);
      const pts2 = []; for (let k = 0; k <= 120; k++) { const t = k / 120; pts2.push(new THREE.Vector3(lerp(x0, x1, t), lerp(h0, h1, t) + .6 + len * .12 * Math.sin(Math.PI * t), lerp(z0, z1, t))); }
      const g = new THREE.BufferGeometry().setFromPoints(pts2); g.setAttribute('u', new THREE.BufferAttribute(new Float32Array(121).map((_, k) => k / 120), 1));
      const mat = new THREE.ShaderMaterial({ uniforms: { uP: { value: 0 }, uTime: U.uTime, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute float u; varying float vu; void main(){ vu=u; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `varying float vu; uniform float uP,uTime,uA; void main(){ if(vu>uP) discard; float pulse=pow(.5+.5*sin((vu*8.-uTime*2.2)*6.283),8.);
          vec3 c=mix(vec3(.35,.8,1.),vec3(1.,.85,.5),vu); gl_FragColor=vec4(c*(.35+1.3*pulse)*uA,1.); }` });
      const line = new THREE.Line(g, mat); line.frustumCulled = false; S.add(line); return { mat, y };
    });
  }
  yearOf(series, cap) {
    const ys = Object.keys(series).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) { const a = series[ys[i - 1]], b = series[ys[i]]; if (cap <= b) return ys[i - 1] + (cap - a) / Math.max(b - a, 1e-6); }
    return ys[ys.length - 1];
  }
  // p: { year, cx, cz, dist, tilt, yaw, fov }
  update(p, T, W, H) {
    this.U.uTime.value = T; this.U.uYear.value = p.year;
    const c = this.cam; const tgt = new THREE.Vector3(p.cx, p.ty ?? .6, p.cz);
    const yaw = (p.yaw ?? 0) * D2R, tilt = p.tilt * D2R;
    c.position.set(tgt.x + Math.sin(yaw) * Math.cos(tilt) * p.dist, tgt.y + Math.sin(tilt) * p.dist, tgt.z + Math.cos(yaw) * Math.cos(tilt) * p.dist);
    c.lookAt(tgt); c.fov = p.fov ?? 32; c.aspect = W / H; c.updateProjectionMatrix();
    const px = H / (2 * Math.tan(c.fov * D2R / 2)); this.tops.material.uniforms.uPx.value = px; this.cityPts.material.uniforms.uPx.value = px;
    this.cityPts.material.uniforms.uC.value = .25 + .75 * smooth(2005, 2025, p.year);
    for (const u of this.uhv) u.mat.uniforms.uP.value = smooth(u.y, u.y + .9, p.year);
  }
}

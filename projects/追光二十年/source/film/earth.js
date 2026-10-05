// 地球：昼夜、城市夜光、大气；中国的光随年份增长；出口光弧照向世界
import * as THREE from 'three';
import { GLSL_NOISE, D2R, clamp, lerp, smooth, rng } from './util.js';

export const R = 10;
export function ll2v(lon, lat, r = R) {
  const la = lat * D2R, lo = lon * D2R;   // 与 SphereGeometry 的 uv 约定一致
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).multiplyScalar(r);
}
const DEST = [[-47, -15], [28, -26], [70, 30], [46, 24], [107, -6], [10, 51], [-70, -33], [31, 30], [37, -1], [134, -25], [-99, 19], [-1, 52],
  [-3, 40], [106, 16], [101, 14], [78, 22], [35, 39], [8, 10], [70, 48], [64, 41], [-58, -34], [55, 25], [3, 36], [-77, -12], [121, 14], [151, -33]];
export const CN_LIGHTS = [[116.4, 39.9, 1], [121.5, 31.2, 1], [113.3, 23.1, 1], [114.1, 22.5, .9], [114.3, 30.6, .8], [104.1, 30.7, .8], [106.5, 29.6, .7],
  [108.9, 34.3, .6], [113.6, 34.7, .7], [118.8, 32.1, .7], [120.2, 30.3, .8], [117.2, 39.1, .7], [123.4, 41.8, .5], [113, 28.2, .6], [97.5, 40.3, .5],
  [100.6, 36.2, .6], [93.5, 42.8, .5], [108.5, 40.2, .5], [116.1, 43.9, .5], [121.6, 32.4, .5], [105.0, 37.5, .5], [119.9, 25.5, .5], [87.6, 43.8, .5]];

export class Earth {
  constructor(W, H) {
    const S = this.scene = new THREE.Scene(); S.background = new THREE.Color(0x01020a);
    this.cam = new THREE.PerspectiveCamera(30, W / H, .1, 5000);
    const L = new THREE.TextureLoader(); const tl = (f, srgb = true) => { const t = L.load('tex/' + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    // 星空
    const r = rng(3), N = 7000, pos = new Float32Array(N * 3), col = new Float32Array(N);
    for (let i = 0; i < N; i++) { const u = r() * 2 - 1, th = r() * 6.283, s = Math.sqrt(1 - u * u); pos.set([s * Math.cos(th) * 2000, u * 2000, s * Math.sin(th) * 2000], i * 3); col[i] = Math.pow(r(), 5) * 1.6 + .08; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('b', new THREE.BufferAttribute(col, 1));
    S.add(new THREE.Points(sg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float b; varying float vb; void main(){ vb=b; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=1.4+b; }`,
      fragmentShader: `varying float vb; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(.85,.9,1.)*vb*smoothstep(.5,0.,d),1.); }` })));
    this.U = { uSun: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 }, uGlow: { value: 0 }, uNight: { value: 1 },
      day: { value: tl('earth-day.jpg') }, night: { value: tl('earth-night.jpg') }, water: { value: tl('earth-water.png', false) }, clouds: { value: tl('clouds.png', false) } };
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(R, 192, 128), new THREE.ShaderMaterial({ uniforms: this.U,
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D day,night,water,clouds; uniform vec3 uSun; uniform float uTime,uGlow,uNight; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 N=normalize(vN), V=normalize(cameraPosition-vW); float ndl=dot(N,uSun);
          vec3 d=pow(texture2D(day,vUv).rgb,vec3(1.15))*.62; float wat=texture2D(water,vUv).r; float cl=smoothstep(.2,.9,texture2D(clouds,vUv+vec2(uTime*.0012,0.)).r);
          d=mix(d,vec3(.7,.72,.76),cl*.45);
          float lit=smoothstep(-.1,.3,ndl); vec3 c=d*lit*(.08+.95*max(ndl,0.));
          c+=vec3(1.,.5,.25)*smoothstep(.12,0.,abs(ndl+.02))*.08;
          vec3 H=normalize(uSun+V); c+=vec3(1.,.9,.75)*pow(max(dot(N,H),0.),80.)*wat*(1.-cl)*lit*1.2;
          vec3 nl=max(texture2D(night,vUv).rgb-vec3(.06),0.); nl=pow(nl,vec3(1.6))*3.;
          // 中国区域的光随年份增强（经度 73–135，纬度 18–54）
          float lon=vUv.x*360.-180., lat=vUv.y*180.-90.;
          float cn=smoothstep(72.,80.,lon)*smoothstep(136.,128.,lon)*smoothstep(17.,22.,lat)*smoothstep(55.,50.,lat);
          float g=mix(uNight, uNight*(.35+uGlow*2.2), cn);
          c+=nl*vec3(1.,.74,.42)*g*smoothstep(.05,-.25,ndl)*(1.-cl*.6);
          float fr=pow(1.-max(dot(N,V),0.),3.); c+=vec3(.25,.5,1.)*fr*smoothstep(-.4,.4,ndl)*.8;
          gl_FragColor=vec4(c,1.); }` }));
    S.add(this.earth);
    this.atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 96, 64), new THREE.ShaderMaterial({ uniforms: this.U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){ vec3 N=normalize(vN), V=normalize(cameraPosition-vW);
        float rim=pow(clamp(1.+dot(V,N),0.,1.),3.); float l=smoothstep(-.35,.5,dot(N,uSun)); gl_FragColor=vec4(vec3(.3,.55,1.)*rim*(l*1.4+.06),1.); }` }));
    S.add(this.atm);
    // 中国光点（新能源基地与城市）
    const lg = new THREE.BufferGeometry(); const lp = [], lw = [];
    const r2 = rng(9);
    for (const [lo, la, w] of CN_LIGHTS) for (let k = 0; k < 14; k++) { const v = ll2v(lo + (r2() - .5) * 2.2, la + (r2() - .5) * 1.6, R * 1.003); lp.push(v.x, v.y, v.z); lw.push(w * (.4 + r2() * .6)); }
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('w', new THREE.Float32BufferAttribute(lw, 1));
    this.cnLights = new THREE.Points(lg, new THREE.ShaderMaterial({ uniforms: { uG: { value: 0 }, uSun: this.U.uSun, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float w; uniform float uG,uPx; varying float vw; varying vec3 vN; void main(){ vw=w; vN=normalize(position); vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*(.06+.1*w)*uG/-mv.z; }`,
      fragmentShader: `varying float vw; varying vec3 vN; uniform float uG; void main(){ float d=length(gl_PointCoord-.5); float a=exp(-d*d*18.); gl_FragColor=vec4(mix(vec3(1.,.75,.35),vec3(.4,.9,1.),fract(vw*7.))*a*uG*1.8,1.); }` }));
    this.cnLights.frustumCulled = false; S.add(this.cnLights);
    // 出口光弧
    this.arcs = []; const src = ll2v(112, 31, R);
    DEST.forEach(([lo, la], i) => {
      const dst = ll2v(lo, la, R); const ang = src.angleTo(dst); const pts = [];
      for (let k = 0; k <= 96; k++) { const t = k / 96; const v = new THREE.Vector3().copy(src).lerp(dst, t).normalize().multiplyScalar(R * (1.005 + .22 * ang / Math.PI * 4 * t * (1 - t))); pts.push(v); }
      const g = new THREE.BufferGeometry().setFromPoints(pts); const u = new Float32Array(97).map((_, k) => k / 96); g.setAttribute('u', new THREE.BufferAttribute(u, 1));
      const m = new THREE.ShaderMaterial({ uniforms: { uP: { value: 0 }, uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute float u; varying float vu; void main(){ vu=u; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `varying float vu; uniform float uP,uA; void main(){ if(vu>uP) discard; float head=exp(-pow((uP-vu)*14.,2.)); vec3 c=mix(vec3(1.,.72,.3),vec3(.5,.95,1.),vu);
          gl_FragColor=vec4(c*(.35+2.5*head)*uA,1.); }` });
      const line = new THREE.Line(g, m); line.frustumCulled = false; S.add(line);
      const pm = new THREE.ShaderMaterial({ uniforms: { uP: m.uniforms.uP, uA: m.uniforms.uA, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute float u; uniform float uP,uPx; varying float vu; void main(){ vu=u; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*.05/-mv.z*(1.+3.*exp(-pow((uP-u)*14.,2.))); }`,
        fragmentShader: `varying float vu; uniform float uP,uA; void main(){ if(vu>uP) discard; float d=length(gl_PointCoord-.5); vec3 c=mix(vec3(1.,.72,.3),vec3(.5,.95,1.),vu); gl_FragColor=vec4(c*exp(-d*d*16.)*uA*(.5+2.*exp(-pow((uP-vu)*14.,2.))),1.); }` });
      const pts3 = new THREE.Points(g, pm); pts3.frustumCulled = false; S.add(pts3);
      this.arcs.push({ line, m, pm, d: i * .11 });
      const dot = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2), transparent: true, opacity: 0 }));
      dot.position.copy(ll2v(lo, la, R * 1.004)); S.add(dot); this.arcs[i].dot = dot;
    });
  }
  // p: { lon, lat, dist, tilt, yaw, sunLon, sunLat, glow, arcs(0..1), night }
  update(p, T, W, H) {
    this.U.uTime.value = T; this.U.uGlow.value = p.glow; this.U.uNight.value = p.night ?? 1;
    this.U.uSun.value.copy(ll2v(p.sunLon, p.sunLat, 1)).normalize();
    const c = this.cam; const tgt = ll2v(p.lon, p.lat, R * (p.tgtR ?? 1));
    const up = new THREE.Vector3(0, 1, 0); const n = tgt.clone().normalize();
    const east = new THREE.Vector3().crossVectors(up, n).normalize(); const north = new THREE.Vector3().crossVectors(n, east).normalize();
    const pos = tgt.clone().add(n.clone().multiplyScalar(p.dist * Math.cos(p.tilt * D2R))).add(north.clone().multiplyScalar(-p.dist * Math.sin(p.tilt * D2R)))
      .add(east.clone().multiplyScalar(p.yaw ?? 0));
    c.position.copy(pos); c.up.copy(north); c.lookAt(tgt.clone().add(north.clone().multiplyScalar(p.lookN ?? 0))); c.fov = p.fov ?? 30; c.aspect = W / H; c.updateProjectionMatrix();
    this.cnLights.material.uniforms.uG.value = p.glow * 1.1; this.cnLights.material.uniforms.uPx.value = H / (2 * Math.tan(c.fov * D2R / 2));
    for (const a of this.arcs) { a.pm.uniforms.uPx.value = H / (2 * Math.tan(c.fov * D2R / 2)); const q = clamp(p.arcs * 1.6 - a.d, 0, 1); a.m.uniforms.uP.value = q; a.m.uniforms.uA.value = (p.arcA ?? 1) * (q > 0 ? 1 : 0); a.dot.material.opacity = smooth(.95, 1, q) * (p.arcA ?? 1); }
  }
}

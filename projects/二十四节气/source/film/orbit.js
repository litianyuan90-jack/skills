// 天：日地系统。黄道每 15° 一节气；地轴倾角 23.44° 固定指向，太阳直射点随黄经南北移动。
import * as THREE from 'three';
import { GLSL_NOISE, D2R, lerp, clamp, smooth, easeIO, easeSine, rng } from './util.js';

export const R_ORB = 60, R_E = 3.2, EPS = 23.44 * D2R;
const TERMS = ['春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露',
               '秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒','立春','雨水','惊蛰'];

export function earthPos(lam, out = new THREE.Vector3()) {
  const L = (lam + 180) * D2R; return out.set(R_ORB * Math.cos(L), 0, -R_ORB * Math.sin(L));
}
export const AXIS = new THREE.Vector3(0, Math.cos(EPS), -Math.sin(EPS));

function labelTexture(text, color = '#fff', font = 'Ma Shan Zheng', px = 120) {
  const c = document.createElement('canvas'); c.width = px * text.length + 40; c.height = px + 40;
  const g = c.getContext('2d'); g.font = `${px}px "${font}"`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12; g.fillStyle = color; g.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { tex: t, aspect: c.width / c.height };
}

export class OrbitWorld {
  constructor(renderer, W, H) {
    this.W = W; this.H = H;
    const S = this.scene = new THREE.Scene();
    S.background = new THREE.Color(0x010103);
    this.cam = new THREE.PerspectiveCamera(42, W / H, .1, 8000);
    const L = new THREE.TextureLoader();
    const tl = (f, srgb = true) => { const t = L.load('tex/' + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

    // ---- 星空 ----
    const r = rng(7), N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos.set([3000 * s * Math.cos(th), 3000 * u, 3000 * s * Math.sin(th)], i * 3);
      const k = r(); const c = k < .2 ? [1, .8, .6] : k < .45 ? [.75, .85, 1] : [1, 1, 1];
      const b = Math.pow(r(), 6) * 2.2 + .12; col.set(c.map(x => x * b), i * 3); sz[i] = 1.2 + Math.pow(r(), 4) * 3.4;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3)); sg.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    this.starMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uFade: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float uTime;
        void main(){ vC=color*(0.8+0.2*sin(uTime*2.+position.x*.01+position.y*.013)); vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=size; }`,
      fragmentShader: `varying vec3 vC; uniform float uFade; void main(){ vec2 d=gl_PointCoord-.5; float a=smoothstep(.5,.0,length(d)); gl_FragColor=vec4(vC*a*uFade,1.); }` });
    S.add(new THREE.Points(sg, this.starMat));
    const mw = new THREE.Mesh(new THREE.SphereGeometry(3500, 64, 32), new THREE.MeshBasicMaterial({ map: tl('night-sky.png'), side: THREE.BackSide, color: new THREE.Color(.22, .22, .26), depthWrite: false }));
    mw.rotation.set(1.1, .3, .4); S.add(mw);

    // ---- 太阳 ----
    this.sunMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: GLSL_NOISE + `varying vec3 vN; varying vec3 vP; varying vec3 vV; uniform float uTime;
        void main(){ float mu=max(dot(normalize(vN),vV),0.); float g=fbm3(vP*1.1+vec3(0.,uTime*.25,0.)); float g2=fbm3(vP*3.2-vec3(uTime*.4));
          vec3 c=mix(vec3(3.2,1.25,.35),vec3(6.,3.9,1.9),g*.7+g2*.5); c*=.45+.55*pow(mu,.45); gl_FragColor=vec4(c,1.); }` });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(7, 96, 48), this.sunMat); S.add(this.sun);
    const glowMat = (inten, col, rays) => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uI: { value: inten } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*(modelViewMatrix*vec4(0.,0.,0.,1.)+vec4(position.xy,0.,0.)); }`,
      fragmentShader: GLSL_NOISE + `varying vec2 vUv; uniform float uTime; uniform float uI;
        void main(){ vec2 p=vUv-.5; float r=length(p)*2.; float a=atan(p.y,p.x);
          float g=exp(-r*${rays ? '5.5' : '3.2'}) ; ${rays ? 'g*=0.65+0.7*pow(vnoise(vec2(a*9.,uTime*.3)),3.)*smoothstep(.0,.3,r);' : ''}
          g*=smoothstep(1.,.6,r); gl_FragColor=vec4(vec3(${col})*g*uI,1.); }` });
    this.glowA = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), glowMat(.75, '1.,.62,.28', true));
    this.glowB = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), glowMat(1.3, '1.,.8,.5', false));
    this.glowA.frustumCulled = this.glowB.frustumCulled = false; S.add(this.glowA, this.glowB);

    // ---- 地球 ----
    this.earth = new THREE.Group(); S.add(this.earth);
    this.tilt = new THREE.Group(); this.tilt.rotation.x = -EPS; this.earth.add(this.tilt);
    this.spin = new THREE.Group(); this.tilt.add(this.spin);
    this.earthMat = new THREE.ShaderMaterial({
      uniforms: { dayMap: { value: tl('earth-day.jpg') }, nightMap: { value: tl('earth-night.jpg') }, waterMap: { value: tl('earth-water.png', false) },
        cloudMap: { value: tl('clouds.png', false) }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D dayMap,nightMap,waterMap,cloudMap; uniform vec3 uSun; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW); float ndl=dot(N,uSun);
          vec3 day=texture2D(dayMap,vUv).rgb; vec3 night=texture2D(nightMap,vUv).rgb; float water=texture2D(waterMap,vUv).r;
          float cl=texture2D(cloudMap,vUv+vec2(uTime*.0015,0.)).r; cl=smoothstep(.15,.9,cl);
          float lit=smoothstep(-.12,.35,ndl);
          vec3 c=day*.9; c=mix(c,vec3(.86,.88,.92),cl*.7);
          vec3 tw=vec3(1.,.45,.2)*smoothstep(.07,0.,abs(ndl+.01))*.08;
          vec3 col=c*(lit*(.12+.85*max(ndl,0.)))+tw*(1.-cl*.5);
          vec3 H=normalize(uSun+V); float sp=pow(max(dot(N,H),0.),70.)*water*(1.-cl)*lit; col+=vec3(1.,.9,.75)*sp*1.6;
          vec3 nl=max(night-vec3(.12),0.); nl=nl*nl*6.; col+=nl*vec3(1.,.72,.38)*smoothstep(.02,-.2,ndl)*(1.-cl*.7);
          float fr=pow(1.-max(dot(N,V),0.),3.); col+=vec3(.3,.55,1.)*fr*smoothstep(-.3,.4,ndl)*.9;
          gl_FragColor=vec4(col,1.); }` });
    this.earthMesh = new THREE.Mesh(new THREE.SphereGeometry(R_E, 160, 96), this.earthMat); this.spin.add(this.earthMesh);
    this.atmMat = new THREE.ShaderMaterial({ uniforms: { uSun: { value: new THREE.Vector3(1, 0, 0) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){ vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vW);
        float rim=pow(clamp(1.+dot(V,N)*1.0,0.,1.),2.2); float lit=smoothstep(-.45,.5,dot(-N,uSun)*-1.);
        float fw=pow(max(dot(-V,uSun),0.),6.)*1.8; vec3 c=mix(vec3(.25,.5,1.),vec3(1.,.55,.3),fw*.4)*rim*(lit*1.3+fw);
        gl_FragColor=vec4(c,1.); }` });
    this.atm = new THREE.Mesh(new THREE.SphereGeometry(R_E * 1.09, 96, 48), this.atmMat); this.earth.add(this.atm);

    // 纬线：赤道、回归线、直射纬线、地轴
    const ring = (lat, color, op, dashed) => {
      const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(lat) * Math.cos(a), Math.sin(lat), -Math.cos(lat) * Math.sin(a)).multiplyScalar(R_E * 1.012)); }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = dashed ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: op, dashSize: .18, gapSize: .12 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity: op });
      const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances(); this.tilt.add(l); return l;
    };
    this.eqRing = ring(0, 0xffffff, .55, false);
    this.tropN = ring(EPS, 0xffc870, .8, true); this.tropS = ring(-EPS, 0xffc870, .8, true);
    this.declRingGeo = new THREE.BufferGeometry(); this.declRingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(257 * 3), 3));
    this.declRing = new THREE.Line(this.declRingGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(3, 2, .8) })); this.tilt.add(this.declRing);
    const ax = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -R_E * 1.6, 0), new THREE.Vector3(0, R_E * 1.6, 0)]);
    this.axis = new THREE.Line(ax, new THREE.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: .55 })); this.tilt.add(this.axis);
    this.ssDot = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), glowMat(3.5, '1.,.85,.5', false)); this.ssDot.frustumCulled = false; S.add(this.ssDot);

    // 光柱（太阳 → 直射点）
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 1, 16, 1, true).translate(0, .5, 0).rotateX(Math.PI / 2),
      new THREE.ShaderMaterial({ uniforms: { uO: { value: .0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: `varying float vZ; void main(){ vZ=position.z; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `varying float vZ; uniform float uO; void main(){ float a=smoothstep(0.,.25,vZ)*smoothstep(1.,.85,vZ); gl_FragColor=vec4(vec3(1.,.75,.35)*a*uO,1.); }` }));
    this.beam.frustumCulled = false; S.add(this.beam);

    // ---- 黄道 ----
    const ep = []; for (let i = 0; i <= 720; i++) { const a = i / 720 * Math.PI * 2; ep.push(new THREE.Vector3(R_ORB * Math.cos(a), 0, -R_ORB * Math.sin(a))); }
    this.ecl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ep), new THREE.LineBasicMaterial({ color: 0xd9b26a, transparent: true, opacity: .4 })); S.add(this.ecl);
    this.trailGeo = new THREE.BufferGeometry(); this.trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(1441 * 3), 3));
    this.trail = new THREE.Line(this.trailGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(2.6, 1.7, .7) })); this.trail.frustumCulled = false; S.add(this.trail);
    this.ticks = []; this.spokes = []; this.labels = [];
    for (let k = 0; k < 24; k++) {
      const lamk = k * 15, L = (lamk + 180) * D2R, major = k % 3 === 0;
      const dir = new THREE.Vector3(Math.cos(L), 0, -Math.sin(L));
      const tg = new THREE.BufferGeometry().setFromPoints([dir.clone().multiplyScalar(R_ORB - (major ? 4 : 2.4)), dir.clone().multiplyScalar(R_ORB + (major ? 4 : 2.4))]);
      const t = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(2.2, 1.6, .8), transparent: true, opacity: 0 })); S.add(t); this.ticks.push(t);
      const sg2 = new THREE.BufferGeometry().setFromPoints([dir.clone().multiplyScalar(8), dir.clone().multiplyScalar(R_ORB)]);
      const sp = new THREE.Line(sg2, new THREE.LineBasicMaterial({ color: new THREE.Color(1.6, 1.1, .5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending })); S.add(sp); this.spokes.push(sp);
      const lt = labelTexture(TERMS[k]);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: lt.tex, transparent: true, opacity: 0, depthWrite: false }));
      spr.position.copy(dir.clone().multiplyScalar(R_ORB + 10)); spr.scale.set(5.2 * lt.aspect, 5.2, 1); spr.userData = { lam: lamk }; S.add(spr); this.labels.push(spr);
    }
    this._v = new THREE.Vector3(); this.renderer = renderer;
  }

  setTrail(lamA, lamB) {
    const a = this.trailGeo.attributes.position.array; let n = 0;
    if (lamB < lamA) lamB += 360; const steps = Math.max(2, Math.min(1440, Math.round((lamB - lamA) * 4)));
    for (let i = 0; i <= steps; i++) { const lam = lamA + (lamB - lamA) * i / steps; const L = (lam + 180) * D2R; a[n++] = R_ORB * Math.cos(L); a[n++] = .02; a[n++] = -R_ORB * Math.sin(L); }
    this.trailGeo.attributes.position.needsUpdate = true; this.trailGeo.setDrawRange(0, steps + 1);
  }

  // 返回给 2D 叠加层的注释（屏幕坐标）
  update(shot, lt, T) {
    const dur = shot.dur, k = clamp(lt / dur, 0, 1), e = easeIO(k);
    this.sunMat.uniforms.uTime.value = T; this.starMat.uniforms.uTime.value = T;
    this.glowA.material.uniforms.uTime.value = T;
    const lam = lerp(shot.lam0 ?? shot.lam ?? 0, shot.lam1 ?? shot.lam ?? 0, shot.kind === 'season' ? easeIO(k) : k);
    const ep = earthPos(lam, new THREE.Vector3()); this.earth.position.copy(ep);
    const Sd = ep.clone().negate().normalize();
    this.earthMat.uniforms.uSun.value.copy(Sd); this.earthMat.uniforms.uTime.value = T; this.atmMat.uniforms.uSun.value.copy(Sd);
    // 直射纬度
    const dec = Math.asin(clamp(Sd.dot(AXIS), -1, 1));
    const a = this.declRingGeo.attributes.position.array;
    for (let i = 0; i <= 256; i++) { const q = i / 256 * Math.PI * 2; a.set([Math.cos(dec) * Math.cos(q) * R_E * 1.016, Math.sin(dec) * R_E * 1.016, -Math.cos(dec) * Math.sin(q) * R_E * 1.016], i * 3); }
    this.declRingGeo.attributes.position.needsUpdate = true;
    // 自转：让中国（约 110°E, 30°N）在镜头中段正午朝阳
    const Sl = Sd.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), EPS);
    const azS = Math.atan2(-Sl.z, Sl.x);
    this.spin.rotation.y = azS - 110 * D2R + (lt - dur * .5) * .06 + (shot.kind === 'title' ? -0.9 : 0);
    this.ssDot.position.copy(ep).addScaledVector(Sd, R_E * 1.02);

    const kind = shot.kind; const cam = this.cam; const cfg = shot.cam || {};
    let showDetail = 0, beam = 0;
    if (kind === 'orbit' || kind === 'end' || (kind === 'title' && false)) {
      const az = lerp(cfg.a0, cfg.a1, e) * D2R, el = lerp(cfg.el0, cfg.el1, e) * D2R, d = lerp(cfg.d0, cfg.d1, e) * 1.9;
      const tgt = new THREE.Vector3().lerpVectors(new THREE.Vector3(), ep, .18);
      cam.position.set(tgt.x + d * Math.cos(el) * Math.sin(az), d * Math.sin(el), tgt.z + d * Math.cos(el) * Math.cos(az)); cam.up.set(0, 1, 0); cam.lookAt(tgt); cam.fov = 40;
      beam = .5; showDetail = 0;
    } else if (kind === 'season') {
      // 追随镜头：在地球后方、稍高，前方是地球与太阳
      const back = earthPos(lam - 9, new THREE.Vector3()); const up = new THREE.Vector3(0, 1, 0);
      cam.position.copy(back).addScaledVector(Sd, -6).addScaledVector(up, 5.5 - 2 * e);
      cam.up.set(0, 1, 0); cam.lookAt(new THREE.Vector3().lerpVectors(ep, new THREE.Vector3(), .25)); cam.fov = 50; beam = .35; showDetail = .4;
    } else { // title / orbit_term：贴近地球
      const side = new THREE.Vector3().crossVectors(Sd, new THREE.Vector3(0, 1, 0)).normalize();
      let phi, dist, h;
      if (kind === 'title') { phi = lerp(150, 165, e) * D2R; dist = lerp(15, 12.5, e); h = lerp(3, 1.5, e); }
      else { phi = lerp(66, 80, e) * D2R; dist = lerp(25, 22, e); h = lerp(1.5, 2.6, e) * (shot.lam === 270 ? -1 : 1); }
      const dir = Sd.clone().multiplyScalar(Math.cos(phi)).addScaledVector(side, Math.sin(phi)).normalize();
      cam.position.copy(ep).addScaledVector(dir, dist).add(new THREE.Vector3(0, h, 0));
      cam.up.set(0, 1, 0);
      const look = ep.clone().addScaledVector(side, kind === 'title' ? 0 : -0.6).add(new THREE.Vector3(0, kind === 'title' ? 1.0 : 0, 0));
      cam.lookAt(look); cam.fov = kind === 'title' ? 46 : 40; showDetail = kind === 'title' ? 0 : 1; beam = kind === 'title' ? 0 : 1;
    }
    cam.aspect = this.W / this.H; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    // 光柱
    const sunEdge = Sd.clone().multiplyScalar(-1); // 从地球指向太阳的反向
    const from = new THREE.Vector3().addScaledVector(Sd.clone().negate(), -7.5); // 太阳表面
    const to = this.ssDot.position; const len = from.distanceTo(to);
    this.beam.position.copy(from); this.beam.lookAt(to); this.beam.scale.set(kind === 'orbit_term' ? 1.1 : .9, kind === 'orbit_term' ? 1.1 : .9, len);
    this.beam.material.uniforms.uO.value = beam * (kind === 'orbit_term' ? smooth(.3, 1.6, lt) : 1);
    // 细节显隐
    const det = showDetail;
    this.eqRing.material.opacity = .55 * det; this.tropN.material.opacity = .85 * det; this.tropS.material.opacity = .85 * det;
    this.declRing.visible = det > .5 && lt > .8; this.axis.material.opacity = .6 * Math.max(det, kind === 'season' ? .5 : 0);
    this.ssDot.visible = kind !== 'title'; this.ssDot.scale.setScalar(kind === 'orbit_term' ? .45 : 1.3);
    // 黄道刻度 / 标签
    const st = shot.show_ticks ?? (kind === 'orbit' ? 2 : kind === 'end' ? 2 : 1);
    for (let i = 0; i < 24; i++) {
      let op = 0, sop = 0, lop = 0;
      if (st >= 1) {
        if (shot.fx === 'cut') { const ti = .4 + i * ((dur - 1.6) / 24); op = smooth(ti, ti + .25, lt); sop = smooth(ti, ti + .12, lt) * (1 - .75 * smooth(ti + .15, ti + .9, lt)); }
        else op = 1;
      }
      if (st >= 2) { lop = shot.fx === 'labels' ? smooth(.6 + i * .09, 1.1 + i * .09, lt) : 1; sop = shot.fx === 'labels' ? .25 : .12; }
      if (kind === 'season') { op = 1; lop = smooth(75, 50, this.labels[i].position.distanceTo(cam.position)); sop = 0; } if (kind === 'orbit_term' || kind === 'title') { op = 1; lop = 0; sop = 0; }
      this.ticks[i].material.opacity = op; this.spokes[i].material.opacity = sop * .9;
      const cur = Math.abs(((this.labels[i].userData.lam - (shot.lam ?? lam)) % 360 + 540) % 360 - 180) < 7.5;
      this.labels[i].material.opacity = lop * (cur ? 1 : .62);
      this.labels[i].material.color.setRGB(cur ? 1.8 : 1, cur ? 1.35 : 1, cur ? .7 : 1);
      const sc = (cur ? 1.25 : 1) * (kind === 'orbit' || kind === 'end' ? 1.25 : 1);
      this.labels[i].scale.set(5.2 * sc * this.labels[i].material.map.image.width / this.labels[i].material.map.image.height, 5.2 * sc, 1);
    }
    if (kind === 'orbit' || kind === 'end') for (const lb of this.labels) { const v = lb.position.clone().project(cam); const y = (-v.y * .5 + .5) * this.H; const d = cam.position.distanceTo(lb.position);
      lb.material.opacity *= smooth(1420, 1330, y) * smooth(230, 300, y); const s = clamp(150 / d, .55, 1.15); lb.scale.multiplyScalar(s); }
    const tStart = shot.trail0 ?? (kind === 'orbit' || kind === 'end' ? (shot.id === 'p1' ? shot.lam0 : 315) : lam - 40);
    this.setTrail(tStart, lam);
    // 太阳辉光朝向相机
    for (const g of [this.glowA, this.glowB, this.ssDot]) g.quaternion.copy(cam.quaternion);

    // 注释（屏幕坐标）
    const ann = { lam: ((lam % 360) + 360) % 360, dec: dec / D2R, items: [] };
    const proj = (p) => { const v = p.clone().project(cam); return { x: (v.x * .5 + .5) * this.W, y: (-v.y * .5 + .5) * this.H, z: v.z }; };
    if (kind === 'orbit_term') {
      const q = new THREE.Quaternion().setFromEuler(this.tilt.rotation);
      const labelAt = (latR, text, cls) => {
        let best = null; const camDir = new THREE.Vector3();
        for (let i = 0; i < 180; i++) { const lo = i / 180 * Math.PI * 2; const n = new THREE.Vector3(Math.cos(latR) * Math.cos(lo), Math.sin(latR), -Math.cos(latR) * Math.sin(lo)).applyQuaternion(q);
          const p = ep.clone().addScaledVector(n, R_E * 1.012); camDir.subVectors(cam.position, p).normalize(); if (camDir.dot(n) < .25) continue;
          const s = proj(p); if (!best || Math.abs(s.x - 330) < Math.abs(best.x - 330)) best = s; }
        if (best) ann.items.push({ ...best, text, cls });
      };
      labelAt(0, '赤道 0°', 'eq'); labelAt(EPS, '北回归线 23°26′N', 'trop'); labelAt(-EPS, '南回归线 23°26′S', 'trop');
      const s = proj(this.ssDot.position); ann.items.push({ ...s, text: '太阳直射点', cls: 'ss' });
    }
    if (kind === 'orbit' && shot.fx === 'cut') { const s0 = proj(new THREE.Vector3(0, 0, 0)); ann.items.push({ ...s0, text: '', cls: 'sun' }); }
    ann.earth = proj(ep); ann.sun = proj(new THREE.Vector3());
    return ann;
  }
}

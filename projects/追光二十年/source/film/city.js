// 城市：夜色车流（燃油暖橙 / 电动青蓝，按当年渗透率）；未来：黎明、屋顶光伏、车网互动、储能、远方风机
import * as THREE from 'three';
import { GLSL_NOISE, D2R, clamp, lerp, smooth, rng } from './util.js';

const BLK = 24, ROAD = 8, NB = 22;       // 街区尺寸、道路宽、街区数（每边）
const EXT = NB * (BLK + ROAD);
export class City {
  constructor(W, H) {
    const S = this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(38, W / H, .5, 6000);
    const U = this.U = { uTime: { value: 0 }, uPen: { value: 0 }, uDawn: { value: 0 }, uSolar: { value: 0 }, uV2G: { value: 0 }, uSun: { value: new THREE.Vector3(.6, .15, -.78).normalize() } };
    const ENV = `uniform float uDawn; vec3 skyc(float y){ vec3 n=mix(vec3(.02,.03,.07),vec3(.05,.07,.14),y); vec3 d=mix(vec3(.62,.34,.22),vec3(.14,.22,.44),pow(clamp(y,0.,1.),.45)); return mix(n,d,uDawn); }
      vec3 fogit(vec3 c, vec3 wp){ float dd=length(wp-cameraPosition); float f=1.-exp(-pow(dd*.0016,1.25)); return mix(c,skyc(.03)*mix(.85,.55,uDawn),clamp(f,0.,1.)*(1.-.45*uDawn)); }`;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
      fragmentShader: GLSL_NOISE + ENV + `uniform vec3 uSun; varying vec3 vD; void main(){ vec3 d=normalize(vD); vec3 c=skyc(max(d.y,0.)); float s=max(dot(d,uSun),0.);
        c+=vec3(2.4,1.3,.6)*(pow(s,8.)*.22+smoothstep(.9993,.9997,s)*4.)*uDawn; c+=vec3(.9,.95,1.)*step(.9985,hash13(floor(d*500.)))*(1.-uDawn)*smoothstep(.05,.3,d.y)*.8;
        gl_FragColor=vec4(c,1.); }` }));
    sky.renderOrder = 999; sky.frustumCulled = false; S.add(sky);
    // 地面与道路
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(EXT * 3, EXT * 3).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: U,
      vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: GLSL_NOISE + ENV + `varying vec3 vW; void main(){ vec2 g=mod(vW.xz+${EXT / 2}.,${BLK + ROAD}.); float road=step(${BLK}.,g.x)+step(${BLK}.,g.y);
        vec3 c=mix(vec3(.03,.035,.045),vec3(.015,.016,.02),clamp(road,0.,1.)); c+=vec3(.25,.3,.35)*uDawn*.25;
        gl_FragColor=vec4(fogit(c,vW),1.); }` }));
    S.add(gnd);
    // 楼宇
    const r = rng(11); const bl = [];
    for (let i = 0; i < NB; i++) for (let j = 0; j < NB; j++) {
      const cx = -EXT / 2 + i * (BLK + ROAD) + BLK / 2, cz = -EXT / 2 + j * (BLK + ROAD) + BLK / 2; const dc = Math.hypot(cx, cz + 60) / (EXT / 2);
      const nsub = r() < .5 ? 1 : 4;
      for (let k = 0; k < nsub; k++) { const sw = nsub === 1 ? BLK * .8 : BLK * .42; const ox = nsub === 1 ? 0 : (k % 2 - .5) * BLK * .5, oz = nsub === 1 ? 0 : (Math.floor(k / 2) - .5) * BLK * .5;
        const h = (8 + Math.pow(r(), 2.2) * 120) * (1.25 - dc * .9) + 6; bl.push([cx + ox, cz + oz, sw * (.8 + r() * .2), h, sw * (.8 + r() * .2), r()]); }
    }
    const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, .5, 0);
    const bm = new THREE.InstancedMesh(bg, new THREE.ShaderMaterial({ uniforms: U,
      vertexShader: `attribute vec4 aB; varying vec3 vW; varying vec3 vN; varying vec4 vB; varying vec3 vL; void main(){ vB=aB; vL=position; vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz;
        vN=normalize(mat3(modelMatrix*instanceMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: GLSL_NOISE + ENV + `uniform float uSolar,uTime; uniform vec3 uSun; varying vec3 vW; varying vec3 vN; varying vec4 vB; varying vec3 vL;
        void main(){ vec3 N=normalize(vN); vec3 c;
          if(N.y>.5){ // 屋顶：未来铺满光伏
            vec3 roof=vec3(.05,.05,.06)+vec3(.2)*uDawn*.3; float on=step(vB.w,uSolar);
            vec2 g=fract(vL.xz*6.); float cell=step(.08,g.x)*step(.08,g.y);
            vec3 pv=mix(vec3(.02,.05,.14),vec3(.08,.2,.45),cell)+vec3(.3,.6,1.)*.08*(1.-uDawn)+vec3(1.,.7,.4)*pow(max(dot(reflect(normalize(vW-cameraPosition),N),uSun),0.),20.)*uDawn;
            c=mix(roof,pv,on);
          } else { // 立面：窗格灯光
            vec2 fu=vec2(abs(N.x)>.5?vW.z:vW.x, vW.y); vec2 cellId=floor(fu/vec2(2.2,3.2)); vec2 f=fract(fu/vec2(2.2,3.2));
            float win=step(.18,f.x)*step(f.x,.82)*step(.2,f.y)*step(f.y,.8); float lit=step(.55-uDawn*.25,hash12(cellId+vB.w*91.));
            vec3 wc=mix(vec3(1.,.75,.45),vec3(.75,.88,1.),hash12(cellId*1.7+3.))*1.5;
            vec3 wall=mix(vec3(.025,.03,.04),vec3(.05,.055,.07)+vec3(.55,.36,.22)*pow(max(dot(N,uSun),0.),1.5)*.7,uDawn);
            c=wall+wc*win*lit*(1.-uDawn*.88)*.9; c+=vec3(.08,.1,.14)*win*uDawn;
          }
          gl_FragColor=vec4(fogit(c,vW),1.); }` }), bl.length);
    const d = new THREE.Object3D(); const ab = new Float32Array(bl.length * 4);
    bl.forEach(([x, z, w, h, dd, rr], i) => { d.position.set(x, 0, z); d.scale.set(w, h, dd); d.updateMatrix(); bm.setMatrixAt(i, d.matrix); ab.set([w, h, dd, clamp(Math.hypot(x, z) / (EXT * .7) + rr * .25, 0, 1)], i * 4); });
    bg.setAttribute('aB', new THREE.InstancedBufferAttribute(ab, 4)); bm.frustumCulled = false; S.add(bm);
    // 车流：沿道路的光粒
    const NC = 26000; const cp = new Float32Array(NC * 3), ca = new Float32Array(NC * 4);
    for (let i = 0; i < NC; i++) { const axis = r() < .5 ? 0 : 1; const lane = Math.floor(r() * (NB + 1)); const off = -EXT / 2 + lane * (BLK + ROAD) - ROAD / 2 + (r() < .5 ? -1.6 : 1.6);
      const dir = (r() < .5 ? -1 : 1); ca.set([axis, off, dir * (8 + r() * 10), r()], i * 4); cp.set([r(), 0, 0], i * 3); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('aC', new THREE.BufferAttribute(ca, 4));
    this.cars = new THREE.Points(cg, new THREE.ShaderMaterial({ uniforms: { ...U, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 aC; uniform float uTime,uPx,uPen,uV2G; varying vec3 vc; varying float va;
        void main(){ float L=${EXT}.; float s=mod(position.x*L+aC.z*uTime,L)-L*.5; vec3 p=aC.x<.5?vec3(s,.8,aC.y):vec3(aC.y,.8,s);
          float ev=step(aC.w,uPen); vc=mix(vec3(1.,.42,.12),vec3(.25,.85,1.),ev); va=1.;
          // 车网互动：部分电动车停驻并向上送电（亮度脉动）
          float park=ev*step(fract(aC.w*13.),.35)*uV2G; vc=mix(vc,vec3(.4,1.,.7),park); va+=park*1.5*(.5+.5*sin(uTime*4.+aC.w*50.));
          vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*1.6/-mv.z; }`,
      fragmentShader: `varying vec3 vc; varying float va; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vc*exp(-d*d*14.)*va*2.2,1.); }` }));
    this.cars.frustumCulled = false; S.add(this.cars);
    // 车网互动：向上的能量光线（从街道升向储能站上方的光环）
    const NV = 900; const vp = new Float32Array(NV * 3), vr = new Float32Array(NV);
    for (let i = 0; i < NV; i++) { vp.set([(r() - .5) * EXT * .8, 0, (r() - .5) * EXT * .8], i * 3); vr[i] = r(); }
    const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.BufferAttribute(vp, 3)); vg.setAttribute('r', new THREE.BufferAttribute(vr, 1));
    this.v2g = new THREE.Points(vg, new THREE.ShaderMaterial({ uniforms: { ...U, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float r; uniform float uTime,uPx,uV2G; varying float va; void main(){ float ph=fract(uTime*.35+r); vec3 p=position; p.y=2.+ph*90.; va=uV2G*sin(ph*3.1416)*step(r,uV2G);
        vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*.9/-mv.z; }`,
      fragmentShader: `varying float va; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(.45,1.,.8)*exp(-d*d*14.)*va,1.); }` }));
    this.v2g.frustumCulled = false; S.add(this.v2g);
    // 储能站：成排的集装箱，青色灯带
    const st = []; for (let i = 0; i < 14; i++) for (let j = 0; j < 4; j++) st.push([EXT / 2 + 40 + i * 9, -120 + j * 7]);
    const sg = new THREE.BoxGeometry(7.5, 3, 3); sg.translate(0, 1.5, 0);
    this.store = new THREE.InstancedMesh(sg, new THREE.ShaderMaterial({ uniforms: U, vertexShader: `varying vec3 vL; varying vec3 vW; void main(){ vL=position; vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: ENV + `uniform float uV2G,uTime; varying vec3 vL; varying vec3 vW; void main(){ vec3 c=vec3(.75,.78,.82)*(.15+.6*uDawn); float strip=smoothstep(.12,0.,abs(vL.y-2.4));
        c+=vec3(.2,1.,.85)*strip*uV2G*(1.2+.4*sin(uTime*3.+vW.x)); gl_FragColor=vec4(fogit(c,vW),1.); }` }), st.length);
    st.forEach(([x, z], i) => { d.position.set(x, 0, z); d.scale.set(1, 1, 1); d.rotation.set(0, 0, 0); d.updateMatrix(); this.store.setMatrixAt(i, d.matrix); });
    this.store.frustumCulled = false; S.add(this.store);
    // 远方风机剪影
    const tw = new THREE.Group(); const tm = new THREE.MeshBasicMaterial({ color: 0x0a0d14 });
    this.rotors = [];
    for (let i = 0; i < 16; i++) { const x = -800 + i * 110 + (r() - .5) * 30, z = -1500 - r() * 200;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, 120, 8), tm); t.position.set(x, 60, z); tw.add(t);
      const rot = new THREE.Group(); rot.position.set(x, 120, z + 3); for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.5, 62, .6), tm); b.position.y = 31; const p = new THREE.Group(); p.rotation.z = k * 2.094; p.add(b); rot.add(p); }
      tw.add(rot); this.rotors.push([rot, r()]); }
    this.windfarm = tw; S.add(tw);
  }
  // p: { px,py,pz,tx,ty,tz,fov, pen, dawn, solar, v2g }
  update(p, T, W, H) {
    const U = this.U; U.uTime.value = T; U.uPen.value = p.pen; U.uDawn.value = p.dawn; U.uSolar.value = p.solar; U.uV2G.value = p.v2g;
    for (const [rot, ph] of this.rotors) rot.rotation.z = T * 1.1 + ph * 6;
    const c = this.cam; c.position.set(p.px, p.py, p.pz); c.lookAt(p.tx, p.ty, p.tz); c.fov = p.fov ?? 38; c.aspect = W / H; c.updateProjectionMatrix();
    const px = H / (2 * Math.tan(c.fov * D2R / 2)); this.cars.material.uniforms.uPx.value = px; this.v2g.material.uniforms.uPx.value = px;
  }
}

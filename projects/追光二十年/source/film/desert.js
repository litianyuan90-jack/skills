// 荒漠光伏海 + 山脊风机，晨光
import * as THREE from 'three';
import { GLSL_NOISE, D2R, clamp, lerp, smooth, rng, fbm2, noise2 } from './util.js';

export function duneH(x, z) {
  return 4.2 * Math.sin(x * .021 + z * .009 + 1.3 * Math.sin(z * .012)) + 2.6 * fbm2(x * .012, z * .012, 4) * 3 + 1.2 * noise2(x * .06, z * .05)
    + Math.max(0, -z - 380) * .22 * (0.6 + .4 * fbm2(x * .01, 1, 3));   // 远处山脊
}
const ENV = `uniform vec3 uSun,uSunCol,uSky,uFog; uniform float uFogD;
vec3 fogit(vec3 c, vec3 wp){ float d=length(wp-cameraPosition); float f=1.-exp(-pow(d*uFogD,1.3)); vec3 v=normalize(wp-cameraPosition);
  vec3 fc=uFog+uSunCol*pow(max(dot(v,uSun),0.),8.)*.35; return mix(c,fc,clamp(f,0.,1.)); }`;

export class Desert {
  constructor(W, H) {
    const S = this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(40, W / H, .3, 4000);
    const U = this.U = { uSun: { value: new THREE.Vector3(-.82, .2, -.35).normalize() }, uSunCol: { value: new THREE.Vector3(1.75, 1.08, .6) },
      uSky: { value: new THREE.Vector3(.35, .45, .62) }, uFog: { value: new THREE.Vector3(.5, .36, .27) }, uFogD: { value: .00052 }, uTime: { value: 0 }, uGrow: { value: 1 } };
    // 天空
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
      fragmentShader: `uniform vec3 uSun,uSunCol,uFog; varying vec3 vD; void main(){ vec3 d=normalize(vD); float y=d.y;
        vec3 zen=vec3(.08,.15,.34), hor=uFog*1.1; vec3 c=mix(hor,zen,pow(smoothstep(-.02,.6,y),.6)); float s=max(dot(d,uSun),0.);
        c+=uSunCol*(pow(s,6.)*.3+pow(s,60.)*.6)+uSunCol*smoothstep(.9994,.9997,s)*4.; c=mix(c,hor*.8,smoothstep(0.,-.2,y)); gl_FragColor=vec4(c,1.); }` }));
    sky.renderOrder = 999; sky.frustumCulled = false; S.add(sky);
    // 沙丘地形
    const tg = new THREE.PlaneGeometry(2400, 2400, 260, 260); tg.rotateX(-Math.PI / 2); const a = tg.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) a[i + 1] = duneH(a[i], a[i + 2]);
    tg.computeVertexNormals();
    S.add(new THREE.Mesh(tg, new THREE.ShaderMaterial({ uniforms: U, vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normal; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: GLSL_NOISE + ENV + `varying vec3 vW; varying vec3 vN; void main(){ vec3 N=normalize(vN); float n=fbm4(vW.xz*.08), r=vnoise(vW.xz*vec2(.9,2.4));
        vec3 alb=mix(vec3(.62,.42,.25),vec3(.78,.56,.33),n)*(.9+.12*r); float dl=max(dot(N,uSun),0.); vec3 c=alb*(uSunCol*dl*.9+uSky*.55*(N.y*.5+.5));
        c*=.85+.15*smoothstep(-.2,.3,dot(N,uSun)); gl_FragColor=vec4(fogit(c,vW),1.); }` })));
    // 光伏阵列：沿地形铺开的行
    const r = rng(5); const panels = [];
    for (let row = 0; row < 150; row++) {
      const z = 60 - row * 6.2;
      for (let col = 0; col < 230; col++) {
        const x = -620 + col * 5.4 + (row % 2) * 1.2; if (Math.hypot(x / 1.6, z + 250) > 560) continue;
        if (fbm2(x * .004 + 7, z * .004, 2) < -.32) continue;   // 留出道路与空地
        panels.push([x, z, r()]);
      }
    }
    const pg = new THREE.PlaneGeometry(5, 2.2); pg.rotateX(-Math.PI / 2 + 32 * D2R);   // 朝南（+z）倾斜 32°
    const pm = new THREE.InstancedMesh(pg, new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide,
      vertexShader: `attribute float aR; varying vec2 vUv; varying vec3 vW; varying float vR; uniform float uGrow; void main(){ vUv=uv; vR=aR;
        vec3 p=position*step(aR,uGrow); vec4 w=modelMatrix*instanceMatrix*vec4(p,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: GLSL_NOISE + ENV + `varying vec2 vUv; varying vec3 vW; varying float vR; void main(){ vec3 N=normalize(vec3(0.,cos(.558),sin(.558)));
        vec3 V=normalize(cameraPosition-vW); vec3 Rf=reflect(-V,N);
        vec3 sky=mix(uFog*1.05,vec3(.16,.26,.48),pow(clamp(Rf.y,0.,1.),.6))+uSunCol*pow(max(dot(Rf,uSun),0.),300.)*6.+uSunCol*pow(max(dot(Rf,uSun),0.),12.)*.25;
        vec2 g=fract(vUv*vec2(12.,6.)); float grid=step(.06,g.x)*step(.08,g.y); float frame=step(.02,vUv.x)*step(vUv.x,.98)*step(.04,vUv.y)*step(vUv.y,.96);
        vec3 cell=vec3(.03,.06,.13)*(1.+.2*vR); float fr=.12+.88*pow(1.-max(dot(N,V),0.),5.);
        vec3 c=mix(cell,sky*.8,fr*.6)*mix(.45,1.,grid); c=mix(vec3(.55,.56,.58)*(uSky*.5+uSunCol*.25),c,frame);
        gl_FragColor=vec4(fogit(c,vW),1.); }` }), panels.length);
    const d = new THREE.Object3D(); const ar = new Float32Array(panels.length);
    panels.forEach(([x, z, rr], i) => { d.position.set(x, duneH(x, z) + 1.3, z); d.rotation.set(0, 0, 0); d.updateMatrix(); pm.setMatrixAt(i, d.matrix);
      ar[i] = clamp((-z + 60) / 960 * .85 + rr * .15, 0, 1); });
    pg.setAttribute('aR', new THREE.InstancedBufferAttribute(ar, 1)); pm.frustumCulled = false; S.add(pm);
    // 支架（简化为细柱）
    const lg = new THREE.CylinderGeometry(.06, .06, 1.6, 4, 1, true); lg.translate(0, -.5, 0);
    const legs = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0x2a2520 }), panels.length);
    panels.forEach(([x, z], i) => { d.position.set(x, duneH(x, z) + 1.3, z); d.updateMatrix(); legs.setMatrixAt(i, d.matrix); }); legs.frustumCulled = false; S.add(legs);
    // 风机：山脊上
    const tw = []; for (let i = 0; i < 46; i++) { const x = -900 + i * 40 + (r() - .5) * 18, z = -520 - r() * 160; tw.push([x, z, r()]); }
    const towerG = new THREE.CylinderGeometry(.9, 1.6, 80, 10, 1); towerG.translate(0, 40, 0);
    const nacG = new THREE.BoxGeometry(3, 3, 9); nacG.translate(0, 81, -1);
    const turbMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix*instanceMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: ENV + `varying vec3 vW; varying vec3 vN; void main(){ vec3 N=normalize(vN); vec3 c=vec3(.88,.88,.9)*(uSunCol*max(dot(N,uSun),0.)*.8+uSky*.7); gl_FragColor=vec4(fogit(c,vW),1.); }` });
    const towers = new THREE.InstancedMesh(towerG, turbMat, tw.length), nacs = new THREE.InstancedMesh(nacG, turbMat, tw.length);
    tw.forEach(([x, z], i) => { d.position.set(x, duneH(x, z) - 1, z); d.rotation.set(0, .3, 0); d.updateMatrix(); towers.setMatrixAt(i, d.matrix); nacs.setMatrixAt(i, d.matrix); });
    towers.frustumCulled = nacs.frustumCulled = false; S.add(towers, nacs);
    // 叶片：三片细长三角，绕轮毂转动
    const bg = new THREE.BufferGeometry(); const bv = [];
    for (let k = 0; k < 3; k++) { const a0 = k * 2.0944; const tip = [Math.cos(a0) * 42, Math.sin(a0) * 42], s1 = [Math.cos(a0 + .06) * 4, Math.sin(a0 + .06) * 4], s2 = [Math.cos(a0 - .08) * 4, Math.sin(a0 - .08) * 4];
      bv.push(0, 0, 0, s1[0], s1[1], 0, tip[0], tip[1], 0, 0, 0, 0, tip[0], tip[1], 0, s2[0], s2[1], 0); }
    bg.setAttribute('position', new THREE.Float32BufferAttribute(bv, 3)); bg.computeVertexNormals();
    const blades = new THREE.InstancedMesh(bg, new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide,
      vertexShader: `attribute float aPh; uniform float uTime; varying vec3 vW; void main(){ float a=uTime*1.3+aPh*6.283; mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a)); vec3 p=position; p.xy=R*p.xy;
        vec4 w=modelMatrix*instanceMatrix*vec4(p,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: ENV + `varying vec3 vW; void main(){ vec3 c=vec3(.9)*(uSunCol*.45+uSky*.7); gl_FragColor=vec4(fogit(c,vW),1.); }` }), tw.length);
    const ph = new Float32Array(tw.length);
    tw.forEach(([x, z, rr], i) => { d.position.set(x, duneH(x, z) + 80, z + 4.6); d.rotation.set(0, .3, 0); d.updateMatrix(); blades.setMatrixAt(i, d.matrix); ph[i] = rr; });
    bg.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1)); blades.frustumCulled = false; S.add(blades);
    // 光尘
    const N = 2500, pp = new Float32Array(N * 3); for (let i = 0; i < N; i++) pp.set([(r() - .5) * 300, r() * 40, -r() * 400], i * 3);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    this.dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: { ...U, uPx: { value: 1 }, uC: { value: new THREE.Vector3() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime,uPx; uniform vec3 uC; void main(){ vec3 p=position+uC+vec3(sin(uTime*.3+position.z)*2.,sin(uTime*.2+position.x)*.6,0.); vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPx*.05/-mv.z; }`,
      fragmentShader: `uniform vec3 uSunCol; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(uSunCol*.18*exp(-d*d*20.),1.); }` }));
    this.dust.frustumCulled = false; S.add(this.dust);
  }
  // p: { px,py,pz, tx,ty,tz, fov, grow }
  update(p, T, W, H) {
    this.U.uTime.value = T; this.U.uGrow.value = p.grow ?? 1;
    const c = this.cam; c.position.set(p.px, Math.max(p.py, duneH(p.px, p.pz) + 3), p.pz); c.lookAt(p.tx, p.ty, p.tz); c.fov = p.fov ?? 40; c.aspect = W / H; c.updateProjectionMatrix();
    this.dust.material.uniforms.uPx.value = H / (2 * Math.tan(c.fov * D2R / 2)); this.dust.material.uniforms.uC.value.set(p.px, duneH(p.px, p.pz), p.pz - 20);
  }
}

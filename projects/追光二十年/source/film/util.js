// 通用：缓动、随机、噪声（JS 与 GLSL 两套，保证逐帧确定性）
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const easeIO = (t) => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
export const easeSine = (t) => { t = clamp(t, 0, 1); return .5 - .5 * Math.cos(Math.PI * t); };
export const D2R = Math.PI / 180;

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const P = new Uint8Array(512);
{ const r = rng(1234); const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
function g2(h, x, y) { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
  case 4: return x; case 5: return -x; case 6: return y; default: return -y; } }
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y); const X = xi & 255, Y = yi & 255; x -= xi; y -= yi;
  const u = fade(x), v = fade(y); const a = P[X] + Y, b = P[X + 1] + Y;
  return lerp(lerp(g2(P[a], x, y), g2(P[b], x - 1, y), u), lerp(g2(P[a + 1], x, y - 1), g2(P[b + 1], x - 1, y - 1), u), v);
}
export function fbm2(x, y, o = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= .5; } return s; }
export function ridged2(x, y, o = 5) {
  let s = 0, a = .5, f = 1, w = 1;
  for (let i = 0; i < o; i++) { let n = 1 - Math.abs(noise2(x * f, y * f)); n *= n; n *= w; w = clamp(n * 1.6, 0, 1); s += n * a; f *= 2.1; a *= .5; }
  return s;
}

// GLSL 公共函数
export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p3){ p3=fract(p3*.1031); p3+=dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y); }
float vnoise3(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.-2.*f);
  float a=mix(mix(hash13(i),hash13(i+vec3(1,0,0)),u.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),u.x),u.y);
  float b=mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),u.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),u.x),u.y);
  return mix(a,b,u.z); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
float fbm4(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s*1.07; }
float fbm3o(vec2 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s*1.14; }
float fbm3(vec3 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vnoise3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
float voronoiEdge(vec2 p){ vec2 n=floor(p), f=fract(p); float md=8., md2=8.;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(i,j); vec2 o=hash22(n+g); vec2 r=g+o-f; float d=dot(r,r);
    if(d<md){ md2=md; md=d; } else if(d<md2){ md2=d; } }
  return sqrt(md2)-sqrt(md); }
`;

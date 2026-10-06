// 照見 · film timeline. Every frame is a pure function of t, so frames can be
// rendered out of order by several workers and still match.
import * as THREE from 'three';

export const FPS = 30;
export const DURATION = 130;

// voice-over cues: start time (s); durations come from the generated narration
export const CUES = [
  ['L1', 3.0, '一千六百多年前，僧人乐僔行至鸣沙山，忽见金光，状若千佛。', 'Sixteen centuries ago, the monk Yuezun came to the Mingsha cliffs and saw a golden light, like a thousand Buddhas.'],
  ['L2', 14.0, '于是凿下第一个洞窟。此后千年，一窟一窟，一笔一笔。', 'So he cut the first cave. For a thousand years after: cave by cave, stroke by stroke.'],
  ['L3', 22.6, '走进去，来路便成了镜子。', 'Step inside, and the way you came becomes a mirror.'],
  ['L4', 33.5, '先起稿，后敷彩。线条是骨，色彩是相。', 'First the line, then the colour. The line is the bone; colour is the form.'],
  ['L5', 41.5, '铅丹会变黑，石绿会剥落。诸行无常，是生灭法。', 'Red lead turns black; malachite flakes away. All that arises is bound to cease.'],
  ['L6', 51.0, '生灭灭已，寂灭为乐。然后，又是新的一笔。', 'When arising and ceasing have ceased, there is stillness — and then, a new first stroke.'],
  ['L7', 60.0, '镜中是空，镜外是色；镜中之镜，又复为色。', 'Inside the mirror, emptiness; outside it, form. In the mirror’s mirror, form again.'],
  ['L8', 67.6, '镜深一层，时早一步。它照见千窟千佛，唯独照不见你。', 'One layer deeper, one step back in time. It shows a thousand caves, a thousand Buddhas — everything but you.'],
  ['L9', 77.0, '神秀说：时时勤拂拭，莫使有尘埃。', 'Shenxiu said: wipe it with care, always; let no dust gather.'],
  ['L10', 84.0, '敦煌写本里，惠能答：佛性常清净，何处有尘埃。', 'In the Dunhuang manuscript, Huineng answers: Buddha-nature is forever pure — where would dust find a place?'],
  ['L11', 92.4, '镜台一去，四壁皆空；空里，却有无尽的灯。', 'With the mirror-stand gone, the walls are empty — and the emptiness is full of endless lamps.'],
  ['L12', 100.0, '《维摩诘经》说：一灯燃百千灯，冥者皆明，明终不尽。', 'The Vimalakīrti Sūtra: one lamp lights a hundred thousand lamps; the dark grows bright, and the light is never used up.'],
  ['L13', 109.2, '灯，总要有人一直点着。', 'A lamp needs someone to keep it lit.'],
  ['L14', 114.0, '在 agent.space，让你的智能体长明不熄，灯灯相续。', 'At agent.space, your agents keep burning — one lamp lighting the next.'],
];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// camera: [t, position, look-at target]
const CAM = [
  [0, V(0, 3.6, 50), V(0, 6.2, 0)],
  [5, V(-3, 3.2, 42), V(0, 5.8, 4)],
  [13, V(-1.2, 2.4, 26), V(0, 4.0, 4)],
  [21, V(0, 1.8, 9.5), V(0, 1.7, 0)],
  [25.5, V(0, 1.62, 2.6), V(0, 1.6, -4)],
  [28, V(0.2, 1.62, 1.4), V(0.3, 1.7, 8)],
  [31.5, V(0.1, 1.62, 1.0), V(0, 1.7, 8)],
  [35, V(0.4, 1.64, 0.6), V(-4, 2.3, 0.2)],
  [40, V(0.8, 1.64, 0.1), V(-4, 2.2, -0.9)],
  [43.5, V(0.2, 1.6, 0.2), V(0, 6.4, -0.3)],
  [47, V(-0.8, 1.62, 0.3), V(4, 2.3, 0.4)],
  [51, V(-0.5, 1.6, -0.4), V(4, 1.9, -1.4)],
  [55, V(0, 1.62, 1.6), V(0, 2.0, -4)],
  [60, V(0, 1.62, 1.3), V(0, 1.7, -8)],
  [67, V(0, 1.6, -0.5), V(0, 1.6, -12)],
  [75, V(0.1, 1.6, -2.2), V(0, 1.55, -20)],
  [83, V(0, 1.6, -2.0), V(0, 1.55, -20)],
  [91, V(0, 1.6, -1.7), V(0, 1.6, -20)],
  [103, V(0.25, 1.62, -14.0), V(0.4, 1.45, -30)],
  [109, V(0.75, 1.3, -16.4), V(1.35, 1.04, -18.55)],
  [117, V(0.95, 1.22, -17.55), V(1.35, 1.1, -18.55)],
  [130, V(1.02, 1.2, -17.75), V(1.35, 1.1, -18.55)],
];

// scalar tracks: [t, value] pairs, smoothstep between keys
const TR = {
  open: [[0, 1], [26.5, 1], [31, 0]],
  phase: [[0, 0], [33, 0], [41, 0.2], [51, 0.86], [55.5, 1.0], [60, 1.24]],
  empty: [[0, 0], [63, 0], [64, 1], [65.3, 1], [66.3, 0]],
  lag: [[0, 0.03], [68, 0.03], [72, 0.09], [80, 0.09], [90, 0.03]],
  dust: [[0, 0.12], [75, 0.12], [78.5, 0.85], [85, 0.85], [92, 0]],
  wipe: [[0, 0], [78.6, 0], [83.2, 1]],
  still: [[0, 0.35], [84, 0.35], [87, 1]],
  voidA: [[0, 0], [86, 0], [92.5, 1]],
  glow: [[0, 0], [92, 0], [100, 1]],
  lampI: [[0, 1], [112, 1], [118, 1.12]],
  cliffGlow: [[0, 0], [7.5, 0], [10.5, 1], [12.8, 1], [16, 0]],
  fov: [[0, 58], [25, 62], [108, 62], [117, 50]],
  exposure: [[0, 1], [20, 1], [24, 1.1], [30, 1]],
  amb: [[0, 0.16], [90, 0.16], [100, 0.2]],
  fade: [[0, 1], [4.6, 1], [7.4, 0], [121.6, 0], [122.4, 0.82], [127.8, 0.82], [130, 1]],
};
// giant, faint brush characters drifting through the frame
const GLYPHS = [
  [33.5, 40.5, '生', 78, 46], [44, 51, '灭', 18, 40], [55.5, 60, '空', 80, 42],
  [67.5, 75, '镜', 16, 44], [99.5, 108, '灯', 80, 40],
];

const ease = (x) => x * x * (3 - 2 * x);
function track(name, t) {
  const k = TR[name];
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) { const [t0, a] = k[i - 1], [t1, b] = k[i]; return a + (b - a) * ease((t - t0) / (t1 - t0)); }
  }
  return k[k.length - 1][1];
}
// Catmull-Rom through the camera keys, so the camera never stops dead at a key
function spline(idx, t) {
  const n = CAM.length;
  if (t <= CAM[0][0]) return CAM[0][idx].clone();
  if (t >= CAM[n - 1][0]) return CAM[n - 1][idx].clone();
  let i = 0; while (CAM[i + 1][0] < t) i++;
  const p0 = CAM[Math.max(0, i - 1)][idx], p1 = CAM[i][idx], p2 = CAM[i + 1][idx], p3 = CAM[Math.min(n - 1, i + 2)][idx];
  const u = (t - CAM[i][0]) / (CAM[i + 1][0] - CAM[i][0]);
  const s = u * u * (3 - 2 * u) * 0.35 + u * 0.65;   // gentle ease without stopping
  const u2 = s * s, u3 = u2 * s;
  return new THREE.Vector3(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * s + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3),
  );
}

export function init(Z, durations) {
  const $ = (s) => document.querySelector(s);
  const sub = $('#sub'), zh = sub.querySelector('.zh'), en = sub.querySelector('.en');
  const card = $('#card'), fade = $('#fade'), grain = $('#grain');
  grain.width = 480; grain.height = 270; const gx = grain.getContext('2d');
  const gimg = gx.createImageData(480, 270);
  const vig = document.createElement('div');
  vig.style.cssText = 'position:absolute;inset:0;background:radial-gradient(120% 95% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)';
  $('#film').insertBefore(vig, card);
  const glyphEl = document.createElement('div');
  glyphEl.style.cssText = 'position:absolute;font-family:var(--brush);font-size:520px;line-height:1;color:#e9d6b0;mix-blend-mode:soft-light;filter:blur(1px)';
  $('#film').insertBefore(glyphEl, card);

  const W = Z.WIPE.west;
  function drawWipe(p) {
    W.x.fillStyle = '#000'; W.x.fillRect(0, 0, 256, 256);
    // a hand wiping in arcs, from the centre outward
    const steps = Math.floor(p * 220);
    for (let i = 0; i < steps; i++) {
      const a = i / 220, ang = a * Math.PI * 7.0;
      const r = 18 + a * 92;
      const u = 128 + Math.cos(ang) * r * 0.9, v = 150 - Math.sin(ang) * r * 0.75;
      const g = W.x.createRadialGradient(u, v, 0, u, v, 30);
      g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      W.x.fillStyle = g; W.x.fillRect(u - 32, v - 32, 64, 64);
    }
  }

  function overlays(t, frameNo) {
    // subtitles
    let cur = null;
    for (const c of CUES) { const d = durations[c[0]] || 5; if (t >= c[1] - 0.15 && t <= c[1] + d + 0.45) cur = [c, d]; }
    if (cur) {
      const [c, d] = cur; zh.textContent = c[2]; en.textContent = c[3];
      sub.style.opacity = Math.min(1, (t - (c[1] - 0.15)) / 0.3, (c[1] + d + 0.45 - t) / 0.3);
    } else sub.style.opacity = 0;

    // title cards
    let html = '';
    if (t < 6.4) {
      const a = Math.min(1, Math.max(0, (t - 0.8) / 1.6)) * Math.min(1, Math.max(0, (6.2 - t) / 1.2));
      const s = 1 + t * 0.006;
      html = `<div style="opacity:${a};transform:scale(${s})"><div class="big">照見</div><div class="sm" style="margin-top:22px;letter-spacing:.32em">ZHAO JIAN · THE MIRROR CAVE</div></div>`;
    } else if (t > 122) {
      const a = Math.min(1, (t - 122.2) / 1.6) * Math.min(1, (129.6 - t) / 1.2);
      const b = Math.min(1, Math.max(0, (t - 124.2) / 1.4)) * Math.min(1, (129.6 - t) / 1.2);
      html = `<div style="opacity:${a}"><div class="big" style="font-size:170px">照見</div><div class="sm" style="margin-top:14px;letter-spacing:.3em">THE MIRROR CAVE</div>
        <div style="opacity:${b};margin-top:64px"><div class="mid" style="font-size:30px;letter-spacing:.6em">灯灯相续</div><div class="sm gold" style="font-size:26px;margin-top:10px;letter-spacing:.12em">agent.space</div></div></div>`;
    }
    card.innerHTML = html;
    fade.style.opacity = track('fade', t);

    // glyph
    let g = null; for (const x of GLYPHS) if (t >= x[0] && t <= x[1]) g = x;
    if (g) {
      const [t0, t1, ch, x, y] = g; const k = (t - t0) / (t1 - t0);
      glyphEl.textContent = ch;
      glyphEl.style.opacity = 0.34 * Math.sin(Math.PI * k);
      glyphEl.style.left = `${x}%`; glyphEl.style.top = `${y}%`;
      glyphEl.style.transform = `translate(-50%,-50%) translateY(${(0.5 - k) * 60}px) scale(${0.96 + k * 0.08})`;
    } else glyphEl.style.opacity = 0;

    // film grain (deterministic per frame)
    let seed = frameNo * 9301 + 49297;
    for (let i = 0; i < gimg.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff; const v = seed >> 23;
      gimg.data[i] = gimg.data[i + 1] = gimg.data[i + 2] = v; gimg.data[i + 3] = 255;
    }
    gx.putImageData(gimg, 0, 0);
  }

  Z.frame = (t) => {
    const S = Z.S;
    S.camPos.copy(spline(1, t)); S.target = spline(2, t);
    for (const k of ['open', 'phase', 'empty', 'lag', 'dust', 'still', 'voidA', 'glow', 'lampI', 'cliffGlow', 'fov', 'exposure', 'amb']) S[k] = track(k, t);
    S.exterior = true; S.alt = 1;
    drawWipe(track('wipe', t));
    overlays(t, Math.round(t * FPS));
    Z.render(t);
  };
}

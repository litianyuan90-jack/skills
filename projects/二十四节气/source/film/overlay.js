// 叠加层：书法、印章、物候、诗句、字幕、黄道表盘
import { clamp, smooth, easeOut, easeIO, lerp } from './util.js';

const F = { brush: '"Zhi Mang Xing"', kai: '"Ma Shan Zheng"', cao: '"Liu Jian Mao Cao"', wk: '"LXGW WenKai"', serif: '"Noto Serif SC"' };
const GOLD = '#e9c27a', PAPER = '#f3ede1', INK = '#16130f', SEAL = '#b8322a';
const BRIGHT = new Set(['dawn', 'misty', 'soft', 'overcast', 'snowday', 'haze', 'coldclear']);
const ORDER = ['立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒'];

export class Overlay {
  constructor(canvas, W, H) { this.c = canvas; this.g = canvas.getContext('2d'); this.W = W; this.H = H; this.tmp = document.createElement('canvas'); this.tmp.width = W; this.tmp.height = H; }

  // 竖排文字；alphaFn(i) -> [alpha, dy]
  vtext(str, x, y, size, font, color, step, alphaFn, shadow, tag) {
    const g = this.g; if (tag && this.rec) this.rec.push({ tag, x: x - size / 2, y: y - size / 2, w: size, h: [...str].length * step }); g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...str].forEach((ch, i) => { const [a, dy] = alphaFn ? alphaFn(i) : [1, 0]; if (a <= .001) return; g.globalAlpha = a;
      if (shadow) { g.shadowColor = shadow[0]; g.shadowBlur = shadow[1]; } g.fillStyle = color; g.fillText(ch, x, y + i * step + (dy || 0)); });
    g.globalAlpha = 1; g.shadowBlur = 0;
  }
  // 笔势显影：自上而下擦出 + 由虚到实
  brush(str, x, y, size, font, color, p, vertical = true, shadow = null, step = null) {
    if (p <= 0) return; { step = step || size * .98; const n = [...str].length; if (this.rec) this.rec.push(vertical ? { tag: 'brush:' + str, x: x - size / 2, y: y - size / 2, w: size, h: n * step } : { tag: 'brush:' + str, x: x - n * step / 2, y: y - size / 2, w: n * step, h: size }); }
    const t = this.tmp, tg = t.getContext('2d'); tg.clearRect(0, 0, this.W, this.H);
    tg.font = `${size}px ${font}`; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillStyle = color;
    step = step || size * .98; const n = [...str].length; const len = vertical ? n * step : size;
    [...str].forEach((ch, i) => vertical ? tg.fillText(ch, x, y + i * step) : tg.fillText(ch, x + (i - (n - 1) / 2) * step, y));
    tg.globalCompositeOperation = 'destination-in';
    const y0 = y - size * .6, y1 = y0 + len + size * .3, yr = lerp(y0 - 120, y1 + 120, easeOut(p));
    const gr = tg.createLinearGradient(0, yr - 120, 0, yr + 10); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    tg.fillStyle = gr; tg.fillRect(0, 0, this.W, this.H); tg.globalCompositeOperation = 'source-over';
    const g = this.g; g.save(); if (shadow) { g.shadowColor = shadow[0]; g.shadowBlur = shadow[1]; }
    g.globalAlpha = clamp(p * 1.6, 0, 1); g.filter = `blur(${(1 - clamp(p * 1.4, 0, 1)) * 6}px)`; g.drawImage(t, 0, 0); g.restore();
  }
  seal(x, y, s, lines, a) {
    if (a <= 0) return; if (this.rec) this.rec.push({ tag: 'seal', x, y, w: s, h: s * (lines.length > 1 ? 1 : .62) }); const g = this.g; g.save(); g.globalAlpha = a * .92; g.fillStyle = SEAL;
    const r = 8; g.beginPath(); g.roundRect(x, y, s, s * (lines.length > 1 ? 1 : .62), r); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.font = `${s * .3}px ${F.kai}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, x + s / 2, y + s * (lines.length > 1 ? (.3 + i * .4) : .31)));
    g.restore();
  }
  caption(text, a) {
    if (a <= 0 || !text) return; const g = this.g; g.save(); g.globalAlpha = a; g.font = `46px ${F.wk}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 14; g.fillStyle = '#fbf7ef';
    let lines = [text]; if ([...text].length > 17) { const idx = Math.max(text.lastIndexOf('，', 17), text.indexOf('，')); if (idx > 3) lines = [text.slice(0, idx + 1), text.slice(idx + 1)]; }
    const y0 = 1508 - (lines.length - 1) * 30; if (this.rec) lines.forEach((l, i) => { const w = g.measureText(l).width; this.rec.push({ tag: 'caption', x: this.W / 2 - w / 2, y: y0 + i * 62 - 26, w, h: 52 }); }); lines.forEach((l, i) => g.fillText(l, this.W / 2, y0 + i * 62)); g.restore();
    return { x: this.W / 2 - 400, y: y0 - 30, w: 800, h: lines.length * 62 };
  }
  dial(cx, cy, R, lam, lamTrail0, a, labels = true) {
    if (a <= 0) return; if (this.rec) this.rec.push({ tag: 'dial', x: cx - R - 50, y: cy - R - 40, w: 2 * R + 100, h: 2 * R + 80 }); const g = this.g; g.save(); g.globalAlpha = a;
    const ang = l => (l + 180) * Math.PI / 180, P = (l, r) => [cx + r * Math.cos(ang(l)), cy - r * Math.sin(ang(l))];
    g.strokeStyle = 'rgba(243,237,225,.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 24; k++) { const l = k * 15, cur = Math.abs(((l - lam) % 360 + 540) % 360 - 180) < 7.5; const r0 = R - (k % 6 === 0 ? 11 : 6), r1 = R + (k % 6 === 0 ? 11 : 6);
      const [x0, y0] = P(l, r0), [x1, y1] = P(l, r1); g.strokeStyle = cur ? GOLD : 'rgba(243,237,225,.55)'; g.lineWidth = cur ? 3 : 1.5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    let l0 = lamTrail0, l1 = lam; if (l1 < l0) l1 += 360;
    g.strokeStyle = GOLD; g.lineWidth = 3.2; g.shadowColor = 'rgba(233,194,122,.8)'; g.shadowBlur = 10; g.beginPath();
    for (let l = l0; l <= l1 + .01; l += 1) { const [x, y] = P(l, R); l === l0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); g.shadowBlur = 0;
    const sg = g.createRadialGradient(cx, cy, 0, cx, cy, 26); sg.addColorStop(0, 'rgba(255,230,170,1)'); sg.addColorStop(.35, 'rgba(255,190,90,.9)'); sg.addColorStop(1, 'rgba(255,150,50,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.fill();
    const [ex, ey] = P(lam, R); g.fillStyle = '#9cc8ff'; g.shadowColor = 'rgba(140,190,255,.9)'; g.shadowBlur = 14; g.beginPath(); g.arc(ex, ey, 8, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    if (labels) { g.font = `22px ${F.wk}`; g.fillStyle = 'rgba(243,237,225,.75)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const [n, l] of [['春分', 0], ['夏至', 90], ['秋分', 180], ['冬至', 270]]) { const [x, y] = P(l, R + 34); g.fillText(n, x, y); } }
    g.restore();
  }
  hudText(x, y, lam, dec, date, a) {
    if (a <= 0) return; if (this.rec) this.rec.push({ tag: 'hud', x, y: y - 26, w: 470, h: 150 }); const g = this.g; g.save(); g.globalAlpha = a; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = `26px ${F.wk}`; g.fillStyle = 'rgba(243,237,225,.6)'; g.fillText('太阳黄经', x, y);
    g.font = `600 54px ${F.serif}`; g.fillStyle = GOLD; g.fillText(`${Math.round(lam) % 360}°`, x, y + 60);
    g.font = `26px ${F.wk}`; g.fillStyle = 'rgba(243,237,225,.6)'; g.fillText('太阳直射', x + 230, y);
    const d = Math.abs(dec) < .05 ? '赤道' : `${dec > 0 ? '北纬' : '南纬'} ${Math.abs(dec).toFixed(1)}°`;
    g.font = `40px ${F.wk}`; g.fillStyle = PAPER; g.fillText(d, x + 230, y + 56);
    if (date) { g.font = `28px ${F.wk}`; g.fillStyle = 'rgba(243,237,225,.62)'; g.fillText(`公历 ${date}`, x, y + 112); }
    g.restore();
  }
  bands(top = .55, bot = .72) {
    const g = this.g; let gr = g.createLinearGradient(0, 0, 0, 330); gr.addColorStop(0, `rgba(0,0,0,${top})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, this.W, 330);
    gr = g.createLinearGradient(0, 1300, 0, this.H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.45, `rgba(0,0,0,${bot * .7})`); gr.addColorStop(1, `rgba(0,0,0,${bot})`); g.fillStyle = gr; g.fillRect(0, 1300, this.W, this.H - 1300);
  }
  header(ch, idx, a) {
    if (a <= 0) return; const g = this.g; g.save(); g.globalAlpha = a; g.textBaseline = 'alphabetic';
    g.font = `44px ${F.kai}`; g.fillStyle = PAPER; g.textAlign = 'left'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 10; g.fillText('二十四节气', 64, 118);
    if (ch) { g.font = `30px ${F.wk}`; g.fillStyle = 'rgba(243,237,225,.75)'; g.fillText(ch, 66, 166); }
    if (idx) { g.textAlign = 'right'; g.font = `600 52px ${F.serif}`; g.fillStyle = GOLD; g.fillText(String(idx).padStart(2, '0'), 950, 118);
      g.font = `30px ${F.serif}`; g.fillStyle = 'rgba(243,237,225,.6)'; g.fillText('/ 24', 1016, 118); }
    g.restore();
  }

  draw(T, shot, lt, ann, total) {
    const g = this.g, W = this.W, H = this.H; g.clearRect(0, 0, W, H);
    const dur = shot.dur, out = 1 - smooth(dur - .35, dur - .02, lt), boxes = [];
    const kind = shot.kind;
    const bright = kind === 'land' && BRIGHT.has(shot.scene.tod);
    if (kind !== 'title' && kind !== 'end') this.bands(kind === 'season' ? .35 : .5, kind === 'season' ? .5 : .72);
    else this.bands(.3, .55);
    const capA = shot.narr ? smooth(shot.vo_start - shot.start - .12, shot.vo_start - shot.start + .12, lt) * out : 0;
    // 页眉
    const hdrA = kind === 'title' || kind === 'end' ? 0 : 1;
    this.header(kind === 'season' ? '' : shot.ch, shot.idx, hdrA);

    if (kind === 'land' || kind === 'orbit_term') {
      const ink = bright ? INK : PAPER, sh = bright ? ['rgba(255,255,255,.65)', 26] : ['rgba(0,0,0,.6)', 26];
      // 节气名
      this.brush(shot.term, 880, 360, 190, F.kai, ink, smooth(.15, 1.0, lt) * out, true, sh, 200);
      this.seal(832, 676, 96, [shot.lamcn.length > 2 ? shot.lamcn : shot.lamcn, '度'], smooth(.8, 1.1, lt) * out);
      // 三候
      shot.hou.forEach((h, i) => { const a0 = 1.0 + i * .35; this.vtext(h, 750, 300 + (i > 0 ? [...shot.hou.slice(0, i).join('')].length * 44 + i * 30 : 0), 36, F.wk, ink, 44,
        j => [smooth(a0 + j * .05, a0 + j * .05 + .3, lt) * out * .92, 0], sh, 'hou' + i); });
      // 诗
      const [l1, l2] = shot.poem; const ps = 58, pst = 66, x1 = 182, x2 = 108, py = 300, c0 = 1.35, cps = .11;
      const n1 = [...l1].length;
      const pa = (i) => [smooth(c0 + i * cps, c0 + i * cps + .35, lt) * out, (1 - smooth(c0 + i * cps, c0 + i * cps + .35, lt)) * -8];
      this.vtext(l1, x1, py, ps, F.kai, ink, pst, i => pa(i), sh, 'poem1');
      this.vtext(l2, x2, py, ps, F.kai, ink, pst, i => pa(i + n1 + 2), sh, 'poem2'); if (this.rec) { g.font = `26px ${F.wk}`; this.rec.push({ tag: 'src', x: 70, y: py + Math.max(n1, [...l2].length) * pst + 2, w: g.measureText(shot.src).width, h: 30 }); }
      const nmax = Math.max(n1, [...l2].length);
      g.save(); g.globalAlpha = smooth(c0 + (n1 + [...l2].length) * cps, c0 + (n1 + [...l2].length) * cps + .5, lt) * out * .85; g.font = `26px ${F.wk}`; g.fillStyle = ink; g.textAlign = 'left';
      g.shadowColor = sh[0]; g.shadowBlur = 10; g.fillText(shot.src, 70, py + nmax * pst + 20); g.restore();
      // HUD
      this.dial(176, 1758, 92, ann.lam ?? shot.lam, (shot.lam - 15 * ((shot.idx - 1) % 6) + 360) % 360, 1);
      this.hudText(330, 1700, shot.lam, shot.decl, shot.date, 1);
      boxes.push(this.caption(shot.caption, capA));
      if (kind === 'orbit_term' && ann.items) for (const it of ann.items) this.annot(it, smooth(1.0, 1.6, lt) * out);
    } else if (kind === 'orbit') {
      this.dial(176, 1758, 92, ann.lam, shot.id === 'p1' ? shot.lam0 : 315, smooth(.2, .8, lt + (shot.id === 'p1' ? 0 : 1)), true);
      this.hudText(330, 1700, ann.lam, ann.dec, null, smooth(.2, .8, lt + (shot.id === 'p1' ? 0 : 1)));
      boxes.push(this.caption(shot.caption, capA));
      const big = { p1: ['360°', 2.0], p2: ['15°', 1.9] }[shot.id];
      if (big) { const a = smooth(big[1], big[1] + .4, lt) * out; g.save(); g.globalAlpha = a; g.font = `200 ${big[0] === '24' ? 230 : 190}px ${F.serif}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = GOLD; g.shadowColor = 'rgba(233,170,80,.75)'; g.shadowBlur = 40; g.fillText(big[0], W / 2, 430 - (1 - easeOut(clamp((lt - big[1]) / .6, 0, 1))) * 30); g.restore(); }
      if (shot.id === 'e3') { const a = smooth(1.0, 1.6, lt) * out; this.seal(W / 2 - 70, 330, 140, ['人类', '非遗'], a); }
      if (shot.id === 'e2') { const a = smooth(.9, 1.6, lt) * out; this.brush('淮南子', W / 2, 330, 96, F.kai, PAPER, a, false, ['rgba(0,0,0,.6)', 20], 104);
        g.save(); g.globalAlpha = a * .8; g.font = `30px ${F.wk}`; g.fillStyle = PAPER; g.textAlign = 'center'; g.fillText('西汉 · 刘安 主持编撰 · 《天文训》', W / 2, 430); g.restore(); }
    } else if (kind === 'season') {
      const p = smooth(.05, 1.0, lt) * out;
      this.brush(shot.big, W / 2, 820, 500, F.kai, PAPER, p, true, ['rgba(0,0,0,.55)', 40]);
      const a = smooth(.5, 1.0, lt) * out; g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.font = `56px ${F.kai}`; g.fillStyle = GOLD; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 16;
      g.fillText(shot.ch.split(' · ')[0], W / 2, 400); g.font = `40px ${F.wk}`; g.fillStyle = PAPER; g.fillText(shot.sub, W / 2, 1240);
      g.font = `26px ${F.wk}`; g.fillStyle = 'rgba(243,237,225,.6)'; g.fillText('《黄帝内经 · 素问 · 四气调神大论》', W / 2, 1292); g.restore();
    } else if (kind === 'title') {
      const p = smooth(.3, 1.8, lt) * out;
      this.brush('二十四', W / 2, 520, 210, F.brush, PAPER, p, true, ['rgba(0,0,0,.5)', 30], 212);
      this.brush('节气', W / 2, 1150, 210, F.brush, PAPER, smooth(1.0, 2.4, lt) * out, true, ['rgba(0,0,0,.5)', 30], 212);
      this.seal(W / 2 + 140, 1290, 92, ['节', '气'], smooth(2.2, 2.6, lt) * out);
      const a = smooth(2.6, 3.4, lt) * out; g.save(); g.globalAlpha = a * .9; g.textAlign = 'center'; g.font = `34px ${F.wk}`; g.fillStyle = PAPER; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 12;
      g.fillText('中国人通过观察太阳周年运动', W / 2, 1640); g.fillText('而形成的时间知识体系及其实践', W / 2, 1692); g.restore();
    } else if (kind === 'end') {
      const p = smooth(.2, 1.4, lt);
      this.brush('二十四节气', W / 2, 330, 120, F.brush, PAPER, p, false, ['rgba(0,0,0,.6)', 24], 128);
      const a = smooth(2.6, 3.3, lt); g.save(); g.globalAlpha = a * .8; g.textAlign = 'center'; g.font = `28px ${F.wk}`; g.fillStyle = PAPER;
      g.fillText('3D 画面 · 旁白 · 配乐 · 音效 · 混音', W / 2, 1640); g.fillText('全部由代码生成', W / 2, 1688); g.restore();
    }
    this.boxes = boxes.filter(Boolean);
  }
  annot(it, a) {
    if (a <= 0 || !it.text) return; const g = this.g; g.save(); g.globalAlpha = a;
    const col = it.cls === 'trop' ? GOLD : it.cls === 'ss' ? '#ffd9a0' : PAPER;
    let tx = it.x + 60, ty = it.y + (it.cls === 'ss' ? -60 : -34);
    g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); g.moveTo(it.x, it.y); g.lineTo(tx, ty); g.stroke();
    g.fillStyle = col; g.beginPath(); g.arc(it.x, it.y, 4, 0, Math.PI * 2); g.fill();
    g.font = `30px ${F.wk}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 10;
    g.fillText(it.text, tx + 8, ty); g.restore();
  }
}

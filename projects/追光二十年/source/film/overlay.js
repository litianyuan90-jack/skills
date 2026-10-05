// 叠加层（1920×1080，含上下黑边）：字幕、计数器、图表、字卡
import { clamp, lerp, smooth, easeIO, easeOut } from './util.js';
const BT = 138, BB = 942, GOLD = '#f2c46d', CYAN = '#6fe3ff', PAPER = '#eef1f5', DIM = 'rgba(238,241,245,.62)';
const F = { serif: '"Noto Serif SC"', wk: '"LXGW WenKai"' };
const fmt = (x, d = 1) => x.toFixed(d);
const cap = (gw) => gw < 100 ? `${Math.round(gw * 100).toLocaleString('zh-CN')} 万千瓦` : `${(gw / 100).toFixed(2)} 亿千瓦`;
export class Overlay {
  constructor(c, D) { this.c = c; this.g = c.getContext('2d'); this.D = D; }
  txt(s, x, y, size, color, a = 1, align = 'left', font = F.serif, weight = '', glow = 0) {
    if (a <= .003) return; const g = this.g; g.save(); g.globalAlpha = a; g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color;
    if (glow) { g.shadowColor = color; g.shadowBlur = glow; } else { g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 10; }
    g.fillText(s, x, y); g.restore();
  }
  draw(t, S, shot) {
    const g = this.g, D = this.D; g.clearRect(0, 0, 1920, 1080);
    g.fillStyle = '#000'; g.fillRect(0, 0, 1920, BT); g.fillRect(0, BB, 1920, 1080 - BB);
    const fade = smooth(0, 1.5, t) * (1 - smooth(120, 122, t));
    // 页眉
    const chap = t < 15 ? '序 · 2005' : t < 45 ? '起步与爆发 · 2005—2020' : t < 65.3 ? '跃迁 · 2021—2025' : t < 80.5 ? '出行 · 新能源汽车' : t < 100.6 ? '未来五年 · 2026—2030' : '世界 · 今天';
    this.txt('追光二十年', 72, 80, 30, PAPER, fade * smooth(9, 11, t) * (1 - smooth(116, 117, t)), 'left', F.serif, '600');
    this.txt(chap, 1848, 80, 24, DIM, fade * smooth(9, 11, t) * (1 - smooth(116, 117, t)), 'right', F.wk);
    // 字幕
    for (const n of D.narr) { const a = smooth(n.t - .15, n.t + .2, t) * (1 - smooth(n.t + n.d + .25, n.t + n.d + .6, t)); this.txt(n.cap, 960, 1010, 34, PAPER, a * fade, 'center', F.wk); }
    // 片头
    const a0 = smooth(2.8, 4.2, t) * (1 - smooth(7.8, 8.8, t));
    this.txt('追光二十年', 960, 470, 104, PAPER, a0, 'center', F.serif, '600', 0);
    this.txt('中国新能源  2005 — 2030', 960, 560, 30, GOLD, a0 * smooth(3.6, 5, t), 'center', F.serif, '200');
    // 年份 + 装机计数（地形、荒漠）
    if (t >= 15 && t < 65.3) {
      const a = smooth(15.6, 17, t) * (1 - smooth(64.4, 65.2, t)) * fade; const x = 96, y = BB - 210;
      this.txt(String(Math.ceil(S.year - 1e-4)), x, y, 96, PAPER, a, 'left', F.serif, '200');
      this.txt('风电', x + 4, y + 82, 22, CYAN, a, 'left', F.wk); this.txt(cap(S.wind), x + 60, y + 82, 30, CYAN, a, 'left', F.serif, '600');
      this.txt('光伏', x + 4, y + 124, 22, GOLD, a, 'left', F.wk); this.txt(cap(S.solar), x + 60, y + 124, 30, GOLD, a, 'left', F.serif, '600');
      this.txt('累计装机', x + 330, y + 103, 18, DIM, a, 'left', F.wk);
    }
    // 2020 · 双碳
    const ac = smooth(37, 38.2, t) * (1 - smooth(43.6, 44.6, t)) * fade;
    this.txt('2030 年前碳达峰', 1500, 420, 44, PAPER, ac, 'center', F.serif, '600'); this.txt('2060 年前碳中和', 1500, 488, 44, GOLD, ac * smooth(37.8, 39, t), 'center', F.serif, '600');
    this.txt('2020 年 9 月 · 第七十五届联合国大会', 1500, 548, 20, DIM, ac * smooth(38.5, 39.6, t), 'center', F.wk);
    // 风光 vs 火电（荒漠段）
    if (t >= 49 && t < 65.3) this.chart(t, smooth(49, 50.2, t) * (1 - smooth(63.8, 64.8, t)) * fade);
    // 新能源汽车渗透率环
    if (t >= 65 && t < 81) this.ring(t, S, smooth(66, 67.2, t) * (1 - smooth(79.6, 80.6, t)) * fade);
    // 2030 目标卡片
    if (t >= 81 && t < 101) this.cards(t, smooth(82, 83, t) * (1 - smooth(99.6, 100.6, t)) * fade);
    // 世界
    if (t >= 101 && t < 114) { const a = smooth(103, 104.2, t) * (1 - smooth(112.6, 113.6, t)) * fade;
      this.stat(1430, 380, '近 60%', '全球新增可再生能源装机来自中国', 'IEA', a * smooth(103, 104, t));
      this.stat(1430, 520, '80% 以上', '全球光伏组件在中国制造', 'IEA / 行业统计', a * smooth(104.4, 105.4, t));
      this.stat(1430, 660, '约 1.3 万亿元', '2025 年"新三样"出口额', '海关统计', a * smooth(105.8, 106.8, t)); }
    // 片尾
    const ae = smooth(114.6, 116, t) * (1 - smooth(120.4, 121.8, t));
    if (ae > .003) { g.save(); const rg = g.createRadialGradient(960, 510, 0, 960, 510, 560); rg.addColorStop(0, `rgba(0,0,0,${.6 * ae})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.setTransform(1, 0, 0, .42, 0, 510 * .58); g.fillStyle = rg; g.fillRect(0, 0, 1920, 1080 / .42); g.restore(); }
    this.txt('从追光，到造光', 960, 470, 92, PAPER, ae, 'center', F.serif, '600', 0);
    this.txt('2005 — 2030', 960, 560, 30, GOLD, ae * smooth(115.4, 116.8, t), 'center', F.serif, '200');
    this.txt('数据：国家能源局 · 中国汽车工业协会 · 公安部 · 国家发展改革委 · 生态环境部 · IEA　2026—2030 为规划目标', 960, 1058, 17, DIM, ae * smooth(116, 117.2, t), 'center', F.wk);
  }
  stat(x, y, big, small, src, a) { this.txt(big, x, y, 56, GOLD, a, 'left', F.serif, '600'); this.txt(small, x + 2, y + 50, 22, PAPER, a, 'left', F.wk); this.txt(src, x + 2, y + 80, 15, DIM, a * .8, 'left', F.wk); }
  chart(t, a) {
    if (a <= .003) return; const g = this.g; const X0 = 1240, Y0 = 820, Wd = 560, Hd = 300;
    g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(4,6,12,.55)'; g.fillRect(X0 - 40, Y0 - Hd - 70, Wd + 80, Hd + 120);
    this.txt('风电 + 光伏  vs  火电（亿千瓦）', X0 - 16, Y0 - Hd - 40, 22, PAPER, a, 'left', F.wk);
    const ys = [2020, 2021, 2022, 2023, 2024, 2025], WS = this.D.WS, TH = this.D.THERMAL; const mx = 20; const px = i => X0 + i / 5 * Wd, py = v => Y0 - v / mx * Hd;
    g.strokeStyle = 'rgba(238,241,245,.18)'; g.lineWidth = 1; for (const v of [5, 10, 15, 20]) { g.beginPath(); g.moveTo(X0, py(v)); g.lineTo(X0 + Wd, py(v)); g.stroke(); this.txt(String(v), X0 - 10, py(v), 14, DIM, a, 'right', F.serif); }
    ys.forEach((y, i) => this.txt(String(y), px(i), Y0 + 22, 15, DIM, a, 'center', F.serif));
    const prog = clamp((t - 50.2) / 9.5, 0, 1) * 5;
    const line = (arr, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = 0; i <= Math.floor(prog); i++) { const x = px(i), y = py(arr[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      const fi = Math.floor(prog), fr = prog - fi; if (fi < 5) g.lineTo(px(fi + fr), py(lerp(arr[fi], arr[fi + 1], fr))); g.stroke(); };
    line(TH, 'rgba(180,186,196,.9)', 3); const gr = g.createLinearGradient(X0, 0, X0 + Wd, 0); gr.addColorStop(0, CYAN); gr.addColorStop(1, GOLD); line(WS, gr, 5);
    if (prog >= 4.6) { const b = smooth(4.6, 5, prog); const cx = px(4 + (TH[4] - WS[4]) / ((WS[5] - WS[4]) - (TH[5] - TH[4]))), cy = py(TH[4] + (TH[5] - TH[4]) * (cx - px(4)) / (px(5) - px(4)));
      g.fillStyle = GOLD; g.beginPath(); g.arc(cx, cy, 7 * b, 0, 6.283); g.fill(); this.txt('2025 · 历史性超过火电', cx - 12, cy - 34, 20, GOLD, a * b, 'right', F.wk, '', 12);
      this.txt(`${fmt(WS[5], 1)}`, px(5) + 10, py(WS[5]), 20, GOLD, a * b, 'left', F.serif, '600'); this.txt(`约 ${fmt(TH[5], 1)}`, px(5) + 10, py(TH[5]) + 6, 16, DIM, a * b, 'left', F.serif); }
    this.txt('风电光伏', X0 + 4, Y0 - Hd + 4, 16, GOLD, a, 'left', F.wk); this.txt('火电', X0 + 84, Y0 - Hd + 4, 16, 'rgb(180,186,196)', a, 'left', F.wk);
    g.restore();
  }
  ring(t, S, a) {
    if (a <= .003) return; const g = this.g; const cx = 1560, cy = 540, R = 150; const p = S.pen / 100;
    g.save(); g.globalAlpha = a; g.lineWidth = 16; g.strokeStyle = 'rgba(255,140,60,.35)'; g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.stroke();
    g.strokeStyle = CYAN; g.shadowColor = CYAN; g.shadowBlur = 20; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + 6.283 * p); g.stroke(); g.restore();
    this.txt(`${fmt(S.pen, 1)}%`, cx, cy - 10, 64, CYAN, a, 'center', F.serif, '600');
    this.txt('新车中的新能源汽车', cx, cy + 50, 20, PAPER, a, 'center', F.wk);
    this.txt(String(Math.ceil(S.year - 1e-4)), cx, cy - R - 46, 34, PAPER, a, 'center', F.serif, '200');
    const sales = S.year >= 2025 ? 1649 : null; if (sales) this.txt('2025 年销量 1649 万辆 · 保有量 4397 万辆', cx, cy + R + 52, 20, DIM, a * smooth(76, 77, t), 'center', F.wk);
    this.txt('● 燃油车流', 120, BB - 70, 18, 'rgb(255,140,60)', a, 'left', F.wk); this.txt('● 新能源车流', 260, BB - 70, 18, CYAN, a, 'left', F.wk);
  }
  cards(t, a) {
    if (a <= .003) return; const items = [['50%+', '风电光伏占电力装机', '成为装机主体'], ['50%', '非化石能源发电量占比', '成为电量主体'], ['3 亿千瓦', '新型储能装机', '2025 年底 1.36 亿千瓦'], ['25%', '非化石能源消费比重', '2025 年 21.7%']];
    items.forEach(([big, s1, s2], i) => { const b = a * smooth(83 + i * 2.2, 84 + i * 2.2, t); const x = 1300, y = 300 + i * 150; const g = this.g;
      g.save(); g.globalAlpha = b; g.fillStyle = 'rgba(4,8,16,.72)'; g.fillRect(x - 24, y - 52, 560, 124); g.fillStyle = GOLD; g.fillRect(x - 24, y - 52, 4, 124); g.restore();
      this.txt(big, x, y - 6, 52, GOLD, b, 'left', F.serif, '600'); this.txt(s1, x + 250, y - 16, 22, PAPER, b, 'left', F.wk); this.txt(s2, x + 250, y + 22, 17, DIM, b, 'left', F.wk); });
    this.txt('2030 年目标（《新型能源体系建设"十五五"规划》）', 1276, 210, 20, DIM, a, 'left', F.wk);
  }
}

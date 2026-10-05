# 分镜：逐帧算出时间映射、镜头、四边形（卷/之字块）与叠加层显示列表 → film/film.json
import json, math, numpy as np
FPS = 24; SW, SH = 1920, 1080; BT, BB = 138, 942; IMH = BB - BT; CX, CY = 960, (BT + BB) / 2
J = json.load(open('timeline.json')); W, H = J['W'], J['H']; C = J['chars']; NT = J['total']
Z = [c for c in C if c['ch'] == '之']
_t = np.fromfile('tmap.f32', np.float32).reshape(H, W)
for z in Z:
    m = _t[z['y0']:z['y1'], z['x0']:z['x1']]; m = (m >= z['t0'] - .01) & (m <= z['t1'] + .05)
    yy, xx = np.where(m); z['gx'] = z['x0'] + xx.mean(); z['gy'] = z['y0'] + yy.mean(); z['ih'] = yy.max() - yy.min() + 1
CTX = ['暮春之初', '山陰之蘭亭', '管弦之盛', '宇宙之大', '品類之盛', '視聽之娛', '夫人之相與', '一室之內', '形骸之外', '老之將至',
       '所之既惓', '係之矣', '向之所欣', '俛仰之間', '以之興懷', '興感之由', '喻之於懷', '後之視今', '今之視昔', '後之攬者']
NOTE = {12: '涂改處', 4: '筆斷意連', 8: '筆斷意連', 17: '五處斷筆'}

def ss(a, b, x):
    t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def lerp(a, b, t): return a + (b - a) * t
def eio(t): t = min(1, max(0, t)); return 4 * t ** 3 if t < .5 else 1 - (-2 * t + 2) ** 3 / 2

# ---- 时间段 ----
L1 = [c for c in C if c['line'] == 1]; l1a, l1b = L1[0]['t0'] - .3, L1[-1]['t1'] + .2
R1 = 1.4; F1a = 7.6; F1b = F1a + (l1b - l1a) / R1
F2b = 55.0; n2a, n2b = l1b, NT
a2 = R1 * (F2b - F1b) / (n2b - n2a)
F3 = 55.0; F4 = 59.5; F5 = 63.5
zst = []; f = F5 + .3
for z in Z: zst.append(f); f += (z['t1'] - z['t0']) + .38
F6 = f + .6; F7 = F6 + 7.5; FEND = F7 + 8.5
print('sections', round(F1b, 2), F2b, F5, round(F6, 2), round(F7, 2), 'END', round(FEND, 2))

def nat(F):
    if F < F1a: return -1.0
    if F < F1b: return l1a + (F - F1a) * R1
    if F < F2b:
        u = (F - F1b) / (F2b - F1b); return n2a + (n2b - n2a) * (a2 * u + (1 - a2) * (3 * u * u - 2 * u ** 3))
    return NT + 10
def rate(F, d=1 / 48): return (nat(F + d) - nat(F - d)) / (2 * d)

def cur_char(N):
    for c in C:
        if c['t0'] <= N <= c['t1'] + .15: return c
    prev = [c for c in C if c['t1'] < N]; return prev[-1] if prev else C[0]

FIT = SW / W; FULL = (FIT, W / 2, 740.0)
col_cx = {}
for c in C: col_cx.setdefault(c['line'], (c['cx0'] + c['cx1']) / 2)

frames = []; ema = None; NF = int(FEND * FPS)
for fi in range(NF):
    F = fi / FPS; N = nat(F); q = []; o = []
    # ---------- 镜头 ----------
    if F < F1a:
        k = eio((F - 2.6) / 4.6); s = lerp(FIT, 1.3, k)
        tx, ty = col_cx[1], L1[0]['y0'] + 360
        cx = lerp(W / 2, tx, k); cy = lerp(740, ty, k)
        cam = (s, cx, cy)
    elif F < F2b:
        c = cur_char(N); tx, ty = col_cx[c['line']], (c['y0'] + c['y1']) / 2
        if F < F1b: s = 1.3 + .1 * (F - F1a) / (F1b - F1a)
        else: s = lerp(1.4, FIT, eio((F - F1b) / ((F2b - F1b) * .62)))
        kz = (1.4 - s) / (1.4 - FIT)
        tgt = np.array([lerp(tx, W / 2, kz ** 1.6), lerp(ty, 740, kz)])
        ema = tgt if ema is None else ema + (tgt - ema) * (1 - math.exp(-(1 / FPS) / (.35 if F < F1b else .5)))
        cx, cy = ema; half_h = IMH / 2 / s; cy = min(max(cy, half_h - 10), H - half_h + 10)
        half_w = SW / 2 / s; cx = min(max(cx, half_w), W - half_w) if half_w < W / 2 else W / 2
        cam = (s, cx, cy)
    else:
        cam = (FIT * (1 + .01 * math.sin(F * .2)), W / 2, 740)
    s, cx, cy = cam
    sx, sy = CX - cx * s, CY - cy * s          # 卷左上角在屏幕的位置
    def proj(x, y): return sx + x * s, sy + y * s
    # ---------- 卷 ----------
    dim = .88 * ss(F4, F4 + 1.5, F) * (1 - ss(F6, F6 + 1.5, F)) + .6 * ss(F7 + 1.5, F7 + 3, F) * (1 - ss(FEND - 2.5, FEND - .5, F))
    paper = ss(F6, F6 + 1.5, F) * (1 - ss(F7, F7 + 2, F))
    wet = max(.25, .25 * rate(F)) if F1a <= F < F2b else .0
    q.append(['scroll', sx, sy, W * s, H * s, 0, 0, W, H, N if F < F3 else NT + 10, 1.0, 0, 0, wet, dim, paper, -1e9, 1e9])
    # ---------- 之：高亮、飞入网格、重写、叠影 ----------
    GX0, GY0, CW, CHh = 70, BT + 40, 236, 182          # 5×4 网格（左）
    SPX, SPY, SPW, SPH = 1310, BT + 60, 520, 470       # 右侧特写
    if F >= F4 - .01 and F < F7 + 2.5:
        for k, z in enumerate(Z):
            pad = 6; u0, v0, u1, v1 = z['x0'] - pad, z['y0'] - pad, z['x1'] + pad, z['y1'] + pad
            bw, bh = u1 - u0, v1 - v0
            a_x, a_y = proj(u0, v0); a_w, a_h = bw * s, bh * s           # 在卷上的位置
            r, cc = divmod(k, 5); sc = min((CW - 26) / bw, (CHh - 44) / bh)
            g_w, g_h = bw * sc, bh * sc; g_x = GX0 + cc * CW + (CW - g_w) / 2; g_y = GY0 + r * CHh + (CHh - 40 - g_h) / 2
            # 叠影目标：统一高度居中
            so = 330 / z['ih']; o_w, o_h = bw * so, bh * so; o_x = CX - (z['gx'] - u0) * so; o_y = CY - 30 - (z['gy'] - v0) * so
            kf = eio((F - F4 - .05 * k) / 2.4)
            ko = eio((F - F6 - .03 * k) / 2.6)
            x = lerp(lerp(a_x, g_x, kf), o_x, ko); y = lerp(lerp(a_y, g_y, kf), o_y, ko)
            w_ = lerp(lerp(a_w, g_w, kf), o_w, ko); h_ = lerp(lerp(a_h, g_h, kf), o_h, ko)
            if F < F5: tz = NT + 10; ghost = 0
            else:
                st = zst[k]; tz = z['t0'] - .05 + max(0, F - st) if F < F6 else NT + 10; ghost = .12
            mode = 1 if F >= F6 else 0
            alpha = (1 - ss(F7 + .5, F7 + 2.3, F)) * (lerp(1, .13, ss(F6, F6 + 1.2, F)) if mode else 1)
            q.append([f'z{k}', x, y, w_, h_, u0, v0, u1, v1, tz, alpha, mode, ghost, .35, 0, 0, z['t0'] - .02, z['t1'] + .12])
        # 右侧特写：当前在写的之
        if F5 <= F < F6:
            k = max(i for i in range(20) if zst[i] <= F + .2) if F + .2 >= zst[0] else 0
            z = Z[k]; pad = 8; u0, v0, u1, v1 = z['x0'] - pad, z['y0'] - pad, z['x1'] + pad, z['y1'] + pad
            bw, bh = u1 - u0, v1 - v0; sc = min(SPW / bw, SPH / bh) * .92
            w_, h_ = bw * sc, bh * sc; x = SPX + (SPW - w_) / 2; y = SPY + (SPH - h_) / 2
            a = ss(F5 - .2, F5 + .4, F) * (1 - ss(F6 - .3, F6 + .2, F))
            q.append(['spot', x, y, w_, h_, u0, v0, u1, v1, z['t0'] - .05 + max(0, F - zst[k]), a, 0, .1, .35, 0, 0, -1e9, 1e9])
    # ---------- 叠加层 ----------
    def T(text, x, y, size, font='wk', color='#efe6d2', alpha=1., align='left', **kw):
        if alpha > .003: o.append(dict(k='t', s=text, x=x, y=y, z=size, f=font, c=color, a=round(alpha, 3), al=align, **kw))
    def R(x, y, w, h, color, alpha=1., stroke=0, fill=True):
        if alpha > .003: o.append(dict(k='r', x=x, y=y, w=w, h=h, c=color, a=round(alpha, 3), st=stroke, fl=fill))
    fade_all = ss(0, 1.2, F) * (1 - ss(FEND - 1.6, FEND - .1, F))
    # 页眉
    hdr = fade_all
    T('蘭亭序', 70, 92, 48, 'ma', '#efe6d2', hdr * ss(.6, 2, F))
    T('書寫節奏', 236, 92, 26, 'wk', '#c9b48a', hdr * ss(.9, 2.3, F))
    if F1a <= F < F2b:
        c = cur_char(N); T(f'第 {c["line"]} 行', 1850, 82, 30, 'wk', '#efe6d2', hdr * ss(F1a, F1a + 1, F), 'right')
        T(f'×{max(rate(F), R1):.1f}', 1850, 116, 22, 'serif', '#c9b48a', hdr * ss(F1a, F1a + 1, F) * (1 - ss(F2b - 1, F2b, F)), 'right')
        T(c['ch'], 1640, 104, 54, 'ma', '#e9c27a', hdr * ss(F1a, F1a + 1, F) * (1 - ss(F2b - 1, F2b, F)), 'center')
    if F3 <= F < F7:
        T('二十個「之」', 1850, 98, 32, 'ma', '#e9c27a', hdr * ss(F3, F3 + 1, F) * (1 - ss(F7 - .5, F7, F)), 'right')
    # 开场标题（卷面中央，墨色）
    a0 = ss(1.0, 2.4, F) * (1 - ss(5.2, 6.6, F))
    T('蘭亭序', CX, CY - 40, 132, 'ma', '#1c1610', a0, 'center')
    T('永和九年（353）三月初三 · 會稽山陰 · 王羲之', CX, CY + 70, 30, 'wk', '#3a2f22', a0 * ss(1.6, 3, F), 'center')
    T('唐 · 馮承素摹本（神龍本） · 故宮博物院藏', CX, CY + 118, 24, 'wk', '#5a4a36', a0 * ss(2.2, 3.4, F), 'center')
    # 底栏：说明 + 节奏条
    caps = [(3.0, 7.4, '原跡已佚。這是唐人雙鉤填墨的神龍本，二十八行，三百二十四字'),
            (8.0, 15.5, '按墨跡寬度推算運筆速度：牽絲快，重按慢——由此還原書寫過程'),
            (16, 25, '字與字之間提筆、換氣；每一行是一個樂句'),
            (26, 36, '加速：一行一呼吸，行氣就是節拍'),
            (36.5, 47, '大小、輕重、疾徐，一字一拍，全卷約十分鐘寫成（推算）'),
            (47.5, 54.8, '末行「者亦將有感於斯文」，節奏收慢，如樂曲終了'),
            (F3 + .2, F4 + .3, '全文「之」字二十個——無一相同'),
            (F5 - .2, F6 - .4, '依次重寫：每個「之」按推算的運筆速度原速再現'),
            (F6 + .2, F7 - .2, '「就中『之』字最多，乃有二十許個，變轉悉異，遂無同者。」——唐 · 何延之《蘭亭記》'),
            (F7 + .2, FEND - 1, '一千六百七十多年前的一次書寫，至今仍能聽見它的節拍')]
    for a, b, tx in caps:
        al = ss(a, a + .6, F) * (1 - ss(b - .5, b, F))
        T(tx, CX, 985, 30, 'wk', '#efe6d2', al * fade_all, 'center')
    # 节奏条：每字一根，高 ∝ 推算用时
    if F1a - 1 <= F < F3 + 1:
        al = ss(F1a - 1, F1a, F) * (1 - ss(F3, F3 + 1, F)) * fade_all
        if al > .003: o.append(dict(k='strip', N=round(N, 3), a=round(al, 3)))
    # 之：高亮框与编号
    if F3 <= F < F4 + .6:
        for k, z in enumerate(Z):
            ap = ss(F3 + .3 + .17 * k, F3 + .5 + .17 * k, F) * (1 - ss(F4, F4 + .6, F))
            x0, y0 = proj(z['x0'] - 5, z['y0'] - 5); x1, y1 = proj(z['x1'] + 5, z['y1'] + 5)
            R(x0, y0, x1 - x0, y1 - y0, '#d9a441', ap, 2.5, False)
            T(str(k + 1), x1 + 2, y0 + 12, 16, 'serif', '#b8322a', ap)
    # 网格标签 + 特写信息
    if F4 + 1.5 <= F < F6 + .3:
        al = ss(F4 + 1.5, F4 + 2.5, F) * (1 - ss(F6 - .2, F6 + .3, F))
        for k, z in enumerate(Z):
            r, cc = divmod(k, 5); lx = GX0 + cc * CW + CW / 2; ly = GY0 + r * CHh + CHh - 22
            written = F >= zst[k] + (z['t1'] - z['t0'])
            T(f'{k + 1}  {CTX[k]}', lx, ly, 19, 'wk', '#efe6d2', al * (1 if F < F5 or written or F >= zst[k] else .55), 'center')
            if F >= F5 and written:
                T(f'{z["t1"] - z["t0"]:.2f} s', lx, ly + 20, 15, 'serif', '#c9b48a', al, 'center')
            if F5 <= F < F6 and zst[k] <= F < zst[k] + (z['t1'] - z['t0']) + .38:
                R(GX0 + cc * CW + 6, GY0 + r * CHh + 2, CW - 12, CHh - 6, '#d9a441', al * .9, 2, False)
    if F5 <= F < F6:
        al = ss(F5, F5 + .5, F) * (1 - ss(F6 - .4, F6, F))
        k = max([i for i in range(20) if zst[i] <= F + .2] or [0]); z = Z[k]
        T(f'第 {k + 1} 個「之」', SPX + SPW / 2, SPY + SPH + 50, 30, 'ma', '#e9c27a', al, 'center')
        T(f'第 {z["line"]} 行 · 「{CTX[k]}」', SPX + SPW / 2, SPY + SPH + 92, 26, 'wk', '#efe6d2', al, 'center')
        T(f'推算用時 {z["t1"] - z["t0"]:.2f} 秒' + (f' · {NOTE[k]}' if k in NOTE else ''), SPX + SPW / 2, SPY + SPH + 130, 22, 'wk', '#c9b48a', al, 'center')
        # 底栏：二十个之的用时柱
        x0b, yb = 560, 1066; bw = 38
        for i in range(20):
            if F < zst[i]: continue
            d = Z[i]['t1'] - Z[i]['t0']; prog = min(1, (F - zst[i]) / max(d, .01)); h = min(46, 10 + d * 22) * prog
            R(x0b + i * (bw + 4), yb - h, bw, h, '#e9c27a' if i == k else '#a8987a', al)
    # 结尾
    ae = ss(F7 + .8, F7 + 2.4, F) * (1 - ss(FEND - 2, FEND - .3, F))
    T('行氣即節拍', CX, CY - 10, 120, 'ma', '#f3ead6', ae * ss(F7 + 2, F7 + 3.2, F), 'center')
    T('運筆過程依墨跡寬度推算，為算法復原，並非真實記錄 · 圖像：馮承素摹本（神龍本）', CX, 1050, 20, 'wk', '#8f8068', ae, 'center')
    frames.append(dict(q=[[x if isinstance(x, str) else round(float(x), 2) for x in qq] for qq in q], o=o))

meta = dict(strip=[[round(c['t0'], 3), round(c['t1'] - c['t0'], 3), c['line'], c['ch'] == '之'] for c in C], fps=FPS, n=NF, W=W, H=H, total=FEND, sections=dict(F1a=F1a, F1b=F1b, F2b=F2b, F3=F3, F4=F4, F5=F5, F6=F6, F7=F7, zst=zst))
json.dump(dict(meta=meta, frames=frames), open('film/film.json', 'w'), ensure_ascii=False, separators=(',', ':'))
# 给配乐用的事件：每字在成片里的起笔时刻
ev = []
fs = np.arange(0, F2b, 1 / 240); ns = np.array([nat(x) for x in fs])
for i, c in enumerate(C):
    j = np.searchsorted(ns, c['t0']);
    if j < len(fs): ev.append(dict(i=i, ch=c['ch'], line=c['line'], F=float(fs[j]), d=c['t1'] - c['t0'], area=c['area'], rate=float(rate(fs[j]))))
json.dump(dict(chars=ev, zst=zst, zd=[z['t1'] - z['t0'] for z in Z], meta=meta), open('events.json', 'w'), ensure_ascii=False)
print('frames', NF)

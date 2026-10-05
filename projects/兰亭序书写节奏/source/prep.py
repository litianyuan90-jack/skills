# 《兰亭序》书写复原：墨迹 → 运笔速度场 → 到达时间图 → 全卷时间轴
# 运笔速度按笔画宽度推算：细笔、牵丝快，粗笔、重按慢。这是算法推演，不是真实记录。
import json, cv2, numpy as np, skfmm
from scipy import ndimage as ndi
from lines import LINES
from trace import trace_component

im = cv2.imread('scroll.jpg'); H, W = im.shape[:2]
B = json.load(open('boxes.json'))
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
b_, g_, r_ = [im[..., i].astype(int) for i in range(3)]
red = (r_ - g_ > 38) & (r_ > 85)
V = hsv[..., 2].astype(np.float32)
# 墨量：0..1，暗处为墨；去掉朱印
inkv = np.clip((150 - V) / 90, 0, 1); inkv[red] = 0
ink = (V < 105) & ~red
ink = ndi.binary_opening(ink, iterations=1)
lab, n = ndi.label(ink); sizes = ndi.sum(ink, lab, range(1, n + 1))
ink = np.isin(lab, np.where(sizes >= 25)[0] + 1)
# 软掩膜（用于显示）：墨迹附近的墨量
soft = np.where(ndi.binary_dilation(ink, iterations=2), inkv, 0).astype(np.float32)

# 每个墨点归属哪个字：先按字框填 id，框外墨点取最近的框
idmap = np.full((H, W), -1, np.int32)
for i, b in enumerate(B):
    idmap[b['y0']:b['y1'], b['x0']:b['x1']] = np.where(idmap[b['y0']:b['y1'], b['x0']:b['x1']] < 0, i, idmap[b['y0']:b['y1'], b['x0']:b['x1']])
has = idmap >= 0
_, (iy, ix) = ndi.distance_transform_edt(~has, return_indices=True)
near = idmap[iy, ix]
dist_out = ndi.distance_transform_edt(~has)
owner = np.where(ink & (dist_out < 60), near, -1)
# 只在文字区（第 1 行右界到第 28 行左界）
cols = np.load('cols.npy'); owner[:, :cols[0] - 5] = -1; owner[:, cols[-1] + 5:] = -1
print('ink px', ink.sum(), 'owned', (owner >= 0).sum())

# 笔画宽度：距离变换的局部最大值（≈半宽）
dt = ndi.distance_transform_edt(ink).astype(np.float32)
width = ndi.grey_dilation(dt, size=(9, 9)); width = np.where(ink, width, 0)

PX_PER_CM = H / 24.5            # 卷高约 24.5 cm
def speed_of(w):                # cm/s：牵丝约 16 cm/s，重按约 4 cm/s
    return np.clip(30.0 / (1.0 + 0.35 * w), 4.0, 16.0)

tmap = np.full((H, W), -1.0, np.float32)
chars = []; T = 0.6
for i, b in enumerate(B):
    ys, xs = np.where(owner == i)
    if len(ys) == 0:
        chars.append(dict(**b, t0=T, t1=T + .2, comps=0, area=0)); T += .3; continue
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    m = (owner[y0:y1, x0:x1] == i)
    cl, nc = ndi.label(ndi.binary_dilation(m, iterations=2) & ndi.binary_dilation(ink[y0:y1, x0:x1], iterations=0))
    cl = cl * m
    comps = []
    for c in range(1, nc + 1):
        cm = cl == c; a = cm.sum()
        if a < 20: continue
        cy, cx = np.where(cm)
        comps.append((cy.min() * 1.0 + cx.mean() * -0.15, c, a))   # 先上后下，同高者右先（行书多自左上起笔，此处折中）
    comps.sort()
    t_char0 = T; local = np.full(m.shape, -1.0, np.float32); last_end = None
    for k, (_, c, a) in enumerate(comps):
        cm = cl == c
        lt, dur, endp, stp = trace_component(cm, width[y0:y1, x0:x1], PX_PER_CM, speed_of)
        if last_end is not None:   # 提笔移动
            d = np.hypot(stp[0] - last_end[0], stp[1] - last_end[1]); T += 0.06 + min(d, 160) / PX_PER_CM / 18
        local[cm] = T + lt[cm]; T += dur
        last_end = endp
    sub = tmap[y0:y1, x0:x1]; sub[local >= 0] = local[local >= 0]
    nxt_connected = False
    if i + 1 < len(B) and B[i + 1]['line'] == b['line']:
        gap = B[i + 1]['y0'] - b['y1']
        nxt_connected = gap < 4
    chars.append(dict(**b, t0=round(t_char0, 3), t1=round(T, 3), comps=len(comps), area=int(m.sum()),
                      inkmass=float(soft[y0:y1, x0:x1][m].sum())))
    T += 0.05 if nxt_connected else 0.16
    if i + 1 < len(B) and B[i + 1]['line'] != b['line']:
        T += 1.4   # 换行、蘸墨
print('natural total %.1f s' % T)

# 无墨的纸面：修补掉墨迹（印章保留）
mask = (ndi.binary_dilation(ink | (soft > .25), iterations=3) & ~red).astype(np.uint8) * 255
small = cv2.resize(im, (W // 2, H // 2)); msmall = cv2.resize(mask, (W // 2, H // 2)) > 0
blank_s = cv2.inpaint(small, msmall.astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
blank = cv2.resize(blank_s, (W, H), interpolation=cv2.INTER_CUBIC)
noise = cv2.GaussianBlur(np.random.default_rng(3).normal(0, 4, (H, W)).astype(np.float32), (0, 0), .8)
blank = np.where(mask[..., None] > 0, np.clip(blank + noise[..., None], 0, 255), im).astype(np.uint8)
cv2.imwrite('blank.jpg', blank, [cv2.IMWRITE_JPEG_QUALITY, 95])

tmap.tofile('tmap.f32'); soft.astype(np.float32).tofile('soft.f32')
json.dump(dict(W=W, H=H, total=T, chars=chars, cols=[int(c) for c in cols]), open('timeline.json', 'w'), ensure_ascii=False)
# 预览：时间图着色
vis = np.zeros((H, W, 3), np.uint8); m = tmap >= 0
hue = ((tmap[m] / T) * 170).astype(np.uint8)
vis[m] = cv2.cvtColor(np.stack([hue, np.full_like(hue, 255), np.full_like(hue, 255)], 1)[None], cv2.COLOR_HSV2BGR)[0]
cv2.imwrite('tmap_vis.jpg', cv2.resize(vis, (W // 2, H // 2)))

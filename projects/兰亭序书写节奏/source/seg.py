import numpy as np, cv2, json
from scipy.ndimage import uniform_filter1d
from lines import LINES
ink = cv2.imread('ink.png', 0) > 0; H, W = ink.shape
cols = np.load('cols.npy')
bounds = list(zip(cols[1:][::-1], cols[:-1][::-1]))  # 右→左：第1行在最右
boxes = []
for li, (x1, x0) in enumerate(bounds):
    n = len(LINES[li]); band = ink[:, x0:x1]
    pr = uniform_filter1d(band.sum(1).astype(float), 7)
    rows = np.where(pr > 2)[0]; top, bot = rows[0], rows[-1]
    # DP 切 n 个字：cut 位于低墨行，每字高 35..260
    ys = np.arange(top, bot + 1); P = pr[top:bot + 1]; L = len(ys)
    INF = 1e18; cost = np.full((n + 1, L), INF); arg = np.zeros((n + 1, L), int); cost[0, 0] = 0
    avg = L / n
    for k in range(1, n + 1):
        for j in range(L):
            lo, hi = max(0, j - 260), j - 35
            if hi < 0: continue
            seg = cost[k - 1, lo:hi + 1]
            if not np.isfinite(seg).any(): continue
            hs = j - np.arange(lo, hi + 1)
            c = seg + (P[j] if k < n else 0) * 3 + 0.002 * (hs - avg) ** 2
            i = np.argmin(c); cost[k, j] = c[i]; arg[k, j] = lo + i
    j = L - 1; cuts = [j]
    for k in range(n, 0, -1): j = arg[k, j]; cuts.append(j)
    cuts = sorted(ys[c] for c in cuts)
    for ci in range(n):
        y0, y1 = int(cuts[ci]), int(cuts[ci + 1])
        sub = ink[y0:y1, x0:x1]; xs_ = np.where(sub.any(0))[0]
        bx0, bx1 = (x0 + xs_[0], x0 + xs_[-1]) if len(xs_) else (x0, x1)
        boxes.append(dict(line=li + 1, pos=ci + 1, ch=LINES[li][ci], x0=int(bx0), x1=int(bx1) + 1, y0=y0, y1=y1, cx0=int(x0), cx1=int(x1)))
json.dump(boxes, open('boxes.json', 'w'), ensure_ascii=False, indent=0)
im = cv2.imread('scroll.jpg')
for b in boxes:
    col = (0, 0, 255) if b['ch'] == '之' else (255, 120, 0)
    cv2.rectangle(im, (b['x0'], b['y0']), (b['x1'], b['y1']), col, 3 if b['ch'] == '之' else 1)
cv2.imwrite('boxes_vis.jpg', im)
print(len(boxes))

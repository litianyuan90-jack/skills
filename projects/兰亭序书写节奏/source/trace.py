# 骨架方向追踪：给一个连通笔画（可能是连笔的多画）推出单笔运行顺序与到达时间
import numpy as np
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

def prune(sk, n=6):
    sk = sk.copy()
    for _ in range(n):
        deg = ndi.convolve(sk.astype(np.uint8), np.ones((3, 3), np.uint8), mode='constant') - 1
        ends = sk & (deg <= 1)
        # 只剪掉短刺：保留时若该端点所在分支长于 n 则恢复（简化：迭代 n 次剥一层，再生长回去）
        sk = sk & ~ends
    return sk

def trace_component(cm, width, px_per_cm, speed_fn):
    """cm: bool mask（单个连通块）；返回 (每个墨点的到达时间 local 秒, 总时长, 终点坐标, 起点坐标)"""
    sk = skeletonize(cm)
    if sk.sum() < 3:
        ys, xs = np.where(cm); t = np.zeros(cm.shape, np.float32); return t, .08, (ys[-1], xs[-1]), (ys[0], xs[0])
    ys, xs = np.where(sk); pts = set(zip(ys.tolist(), xs.tolist()))
    def nbrs(p):
        return [(p[0] + dy, p[1] + dx) for dy, dx in NB if (p[0] + dy, p[1] + dx) in pts]
    deg = {p: len(nbrs(p)) for p in pts}
    ends = [p for p in pts if deg[p] == 1]
    key = lambda p: p[0] + 0.6 * (p[1] - xs.min())
    start = min(ends, key=key) if ends else min(pts, key=key)
    tsk = {}; t = 0.0; visited = set(); cur = start; d = np.array([1.0, 0.3]); d /= np.linalg.norm(d)
    hist = [cur]; first = True
    w_at = lambda p: width[p]
    while True:
        visited.add(cur); tsk.setdefault(cur, t)
        cand = [q for q in nbrs(cur) if q not in visited]
        nxt = None
        if cand:
            best = None
            for q in cand:
                # 沿该方向看几步
                v = np.array([q[0] - cur[0], q[1] - cur[1]], float); v /= np.linalg.norm(v)
                sc = -float(v @ d)
                if best is None or sc < best[0]: best = (sc, q, v)
            nxt = best[1]; turn = best[2] @ d
        else:
            # 穿过交叉口：在骨架上找最近的未访问点，偏好当前方向
            from collections import deque
            seen = {cur: 0}; dq = deque([cur]); found = []
            while dq:
                p = dq.popleft(); L = seen[p]
                if L > 18: continue
                for q in nbrs(p):
                    if q in seen: continue
                    seen[q] = L + 1
                    if q not in visited: found.append((q, L + 1))
                    else: dq.append(q)
            if found:
                def score(f):
                    q, L = f; v = np.array([q[0] - cur[0], q[1] - cur[1]], float); n = np.linalg.norm(v) + 1e-6
                    return L + 10 * (1 - (v / n) @ d)
                q, L = min(found, key=score)
                v = np.array([q[0] - cur[0], q[1] - cur[1]], float); v /= (np.linalg.norm(v) + 1e-6)
                t += L / (speed_fn(w_at(cur)) * px_per_cm); nxt = q; turn = v @ d
            else:
                rem = pts - visited
                if not rem: break
                # 同一连通块内另起一笔（笔断意连）：取最近的未访问端点，否则最近点
                rem_ends = [p for p in rem if deg[p] <= 1] or list(rem)
                q = min(rem_ends, key=lambda p: (p[0] - cur[0]) ** 2 + (p[1] - cur[1]) ** 2)
                dist = np.hypot(q[0] - cur[0], q[1] - cur[1])
                t += 0.05 + dist / px_per_cm / 16; nxt = q; turn = 1.0; first = True
        step = np.hypot(nxt[0] - cur[0], nxt[1] - cur[1])
        sp = speed_fn(w_at(nxt)) * (0.5 + 0.5 * max(turn, -0.2) ** 2 if turn < .9 else 1.0)
        if first and len(hist) < 8: sp *= .55     # 起笔顿
        t += step / (sp * px_per_cm)
        hist.append(nxt); first = False
        if len(hist) > 7:
            dv = np.array([nxt[0] - hist[-7][0], nxt[1] - hist[-7][1]], float); n = np.linalg.norm(dv)
            if n > 0: d = 0.5 * d + 0.5 * dv / n; d /= np.linalg.norm(d)
        cur = nxt
    # 骨架时间 → 墨点
    skm = np.zeros(cm.shape, bool); tv = np.zeros(cm.shape, np.float32)
    for p, tt in tsk.items(): skm[p] = True; tv[p] = tt
    dist, (iy, ix) = ndi.distance_transform_edt(~skm, return_indices=True)
    local = tv[iy, ix] + dist / (6.0 * px_per_cm)
    local = np.where(cm, local, 0).astype(np.float32)
    end = max(tsk, key=tsk.get)
    return local, float(local[cm].max()), end, start

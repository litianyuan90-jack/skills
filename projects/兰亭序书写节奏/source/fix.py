import json, cv2, numpy as np
ink = cv2.imread('ink.png', 0) > 0
B = json.load(open('boxes.json'))
MAN = {17: [(30,160),(165,300),(320,470),(470,600),(610,710),(735,865),(868,960),(1030,1125),(1125,1240),(1240,1322),(1325,1430)],
       24: [(45,165),(175,305),(315,435),(440,565),(590,725),(740,855),(865,990),(990,1108),(1108,1195),(1195,1300),(1300,1410)]}
for ln, rng in MAN.items():
    bb = [b for b in B if b['line'] == ln]
    for b, (y0, y1) in zip(bb, rng):
        sub = ink[y0:y1, b['cx0']:b['cx1']]; xs = np.where(sub.any(0))[0]
        b.update(y0=y0, y1=y1, x0=int(b['cx0'] + xs[0]), x1=int(b['cx0'] + xs[-1] + 1))
json.dump(B, open('boxes.json', 'w'), ensure_ascii=False, indent=0)
# 20 个之
im = cv2.imread('scroll.jpg'); Z = [b for b in B if b['ch'] == '之']
tiles = []
for i, b in enumerate(Z):
    p = 8; c = im[max(0,b['y0']-p):b['y1']+p, max(0,b['x0']-p):b['x1']+p]
    c = cv2.resize(c, (int(c.shape[1] * 160 / c.shape[0]), 160)); t = np.full((200, 220, 3), 255, np.uint8)
    w = min(c.shape[1], 220); t[:160, (220-w)//2:(220-w)//2+w] = c[:, :w]
    cv2.putText(t, f"{i+1} L{b['line']}", (6, 190), cv2.FONT_HERSHEY_SIMPLEX, .6, (0,0,200), 2); tiles.append(t)
rows = [np.hstack(tiles[r*5:(r+1)*5]) for r in range(4)]; cv2.imwrite('zhi20.jpg', np.vstack(rows))
print(len(Z))

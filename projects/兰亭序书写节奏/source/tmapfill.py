# 时间图扩展：把修补过的墨晕、零星墨块并入最近一笔的书写时刻（prep.py → blank2.py 之后运行）
import cv2, numpy as np, json, shutil
from scipy import ndimage as ndi
J = json.load(open('timeline.json')); W, H = J['W'], J['H']
shutil.copy('tmap.f32', 'tmap_core.f32')
t = np.fromfile('tmap_core.f32', np.float32).reshape(H, W)
mask = np.abs(cv2.imread('scroll.jpg').astype(int) - cv2.imread('blank.jpg').astype(int)).sum(2) > 0
has = t >= 0; d, (iy, ix) = ndi.distance_transform_edt(~has, return_indices=True)
f = mask & ~has; t[f] = t[iy[f], ix[f]] + np.minimum(d[f], 200) / 400.
t.tofile('tmap.f32'); t.tofile('film/tmap.f32')

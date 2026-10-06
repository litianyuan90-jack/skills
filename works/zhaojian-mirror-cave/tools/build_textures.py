"""Compose cave-wall texture atlases from real Dunhuang mural sources.

Every wall is produced twice with an identical layout:
  *_c.jpg  -> 色 (form): the mural photographs
  *_l.jpg  -> 空 (emptiness): the line drawings of the same murals
The shader cross-fades between the two, so the layout must match pixel for pixel.

Usage: python3 -I build_textures.py <raw_dir> <out_dir>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

RAW = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

PLASTER = (214, 196, 160)      # 白粉地
EARTH = (122, 52, 34)          # 土红
GREEN = (58, 128, 112)         # 石绿
LAPIS = (44, 72, 120)          # 青金
OCHRE = (176, 120, 58)
LINE_BG = (232, 222, 200)      # pale ground of the 空 layer
LINE_INK = (120, 70, 45)


def load(name):
    return Image.open(RAW / name).convert("RGB")


def crop(img, box):
    return img.crop(box)


def xdog(img, sigma=1.2, k=1.6, p=22, eps=-0.012, phi=60):
    """Extended difference-of-gaussians line extraction -> white ground, dark lines."""
    g = np.asarray(ImageOps.grayscale(img)).astype(np.float32) / 255.0
    a = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sigma))).astype(np.float32) / 255
    b = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sigma * k))).astype(np.float32) / 255
    d = (1 + p) * a - p * b
    e = np.where(d >= eps, 1.0, 1.0 + np.tanh(phi * (d - eps)))
    return Image.fromarray(np.clip(e * 255, 0, 255).astype(np.uint8)).convert("RGB")


def lineify(line_img):
    """Map a black-on-white drawing to sepia ink on pale plaster."""
    g = np.asarray(ImageOps.grayscale(line_img)).astype(np.float32) / 255.0
    g = np.clip((g - 0.15) / 0.7, 0, 1)[..., None]
    bg = np.array(LINE_BG, np.float32)
    ink = np.array(LINE_INK, np.float32)
    out = ink + (bg - ink) * g
    return Image.fromarray(out.astype(np.uint8))


# ---------------------------------------------------------------- sources
ex = load("examples.jpg")
ex_cols = [(4, 692), (707, 1395), (1409, 2097), (2112, 2800), (2814, 3503)]
EX = {}
for i, (x0, x1) in enumerate(ex_cols):
    EX[i] = (crop(ex, (x0 + 4, 11, x1 - 4, 691)), crop(ex, (x0 + 4, 714, x1 - 4, 1392)))

rs = load("results.jpg")
rs_cols = [(7, 528), (579, 1102), (1155, 1678), (1728, 2250), (2300, 2821), (2870, 3391)]
RS = {}
for i, (x0, x1) in enumerate(rs_cols):
    RS[i] = (crop(rs, (x0 + 3, 1336, x1 - 3, 1853)), crop(rs, (x0 + 3, 671, x1 - 3, 1188)))

INP = {}
for n in ["000740", "real-167", "real-322"]:
    INP[n] = (load(f"inp_{n}.jpg"), ImageOps.invert(load(f"edge_{n}.jpg")))

c217 = load("c217.png")
C217 = (c217, xdog(c217, sigma=0.9, p=18))
buddha = crop(c217, (372, 178, 498, 340))          # central preaching Buddha, Cave 217
SUTRA = load("28_Dunhuang_0004.jpg")                  # Diamond Sutra frontispiece, 868 CE


def pair(c, l):
    return (c, lineify(l))


PAIRS = {f"ex{i}": pair(*EX[i]) for i in EX}
PAIRS.update({f"rs{i}": pair(*RS[i]) for i in RS})
PAIRS.update({f"inp_{k}": pair(*v) for k, v in INP.items()})
PAIRS["c217"] = pair(*C217)
PAIRS["buddha"] = pair(buddha, xdog(buddha, sigma=0.7, p=14))


# ---------------------------------------------------------------- composer
class Wall:
    def __init__(self, w, h, ground=EARTH):
        self.c = Image.new("RGB", (w, h), ground)
        self.l = Image.new("RGB", (w, h), LINE_BG)
        self.dc = ImageDraw.Draw(self.c)
        self.dl = ImageDraw.Draw(self.l)

    def rect(self, box, col, line_col=None):
        self.dc.rectangle(box, fill=col)
        self.dl.rectangle(box, fill=line_col or LINE_BG)

    def frame(self, box, col=GREEN, w=14):
        x0, y0, x1, y1 = box
        for d in (self.dc,):
            d.rectangle((x0 - w, y0 - w, x1 + w, y1 + w), outline=col, width=w)
            d.rectangle((x0 - w - 6, y0 - w - 6, x1 + w + 6, y1 + w + 6), outline=PLASTER, width=4)
        self.dl.rectangle((x0 - w, y0 - w, x1 + w, y1 + w), outline=LINE_INK, width=3)

    def place(self, key, box, fit="cover", frame=True):
        c, l = PAIRS[key]
        x0, y0, x1, y1 = box
        size = (x1 - x0, y1 - y0)
        if fit == "cover":
            cc, ll = ImageOps.fit(c, size, Image.LANCZOS), ImageOps.fit(l, size, Image.LANCZOS)
        else:
            cc, ll = c.resize(size, Image.LANCZOS), l.resize(size, Image.LANCZOS)
        self.c.paste(cc, (x0, y0))
        self.l.paste(ll, (x0, y0))
        if frame:
            self.frame(box)

    def thousand_buddhas(self, box, cell_h=150):
        """千佛: rows of the same seated Buddha, halo colours rotating diagonally as in Mogao."""
        x0, y0, x1, y1 = box
        bc, bl = PAIRS["buddha"]
        cw = int(cell_h * bc.width / bc.height)
        halos = [GREEN, EARTH, LAPIS, OCHRE]
        rows = (y1 - y0) // cell_h
        cols = (x1 - x0) // cw
        ox = x0 + ((x1 - x0) - cols * cw) // 2
        self.rect(box, PLASTER)
        for r in range(rows):
            for k in range(cols):
                px, py = ox + k * cw, y0 + r * cell_h
                tint = halos[(k + r) % 4]
                cell = bc.resize((cw, cell_h), Image.LANCZOS)
                arr = np.asarray(cell).astype(np.float32)
                arr = arr * 0.78 + np.array(tint, np.float32) * 0.22
                self.c.paste(Image.fromarray(arr.astype(np.uint8)), (px, py))
                self.l.paste(bl.resize((cw, cell_h), Image.LANCZOS), (px, py))
                self.dc.rectangle((px, py, px + cw - 1, py + cell_h - 1), outline=(70, 40, 28), width=2)

    def band(self, y0, y1, cols=(GREEN, EARTH, LAPIS, PLASTER), step=64):
        w = self.c.width
        for i, x in enumerate(range(0, w, step)):
            self.dc.rectangle((x, y0, x + step, y1), fill=cols[i % len(cols)])
            self.dl.rectangle((x, y0, x + step, y1), outline=LINE_INK, width=2)

    def hanging_triangles(self, y, h=70, step=90):
        w = self.c.width
        for i, x in enumerate(range(0, w, step)):
            col = (GREEN, LAPIS, EARTH)[i % 3]
            tri = [(x, y), (x + step, y), (x + step // 2, y + h)]
            self.dc.polygon(tri, fill=col, outline=PLASTER)
            self.dl.polygon(tri, outline=LINE_INK)

    def save(self, name, q=86):
        self.c.save(OUT / f"{name}_c.jpg", quality=q, optimize=True)
        self.l.save(OUT / f"{name}_l.jpg", quality=q, optimize=True)


W, H = 4096, 2048

# South wall: Cave 217 Lotus Sutra tableau (public domain) flanked by apsaras and bodhisattvas
s = Wall(W, H)
s.thousand_buddhas((40, 40, W - 40, 470), cell_h=143)
s.band(480, 520)
s.hanging_triangles(520)
s.place("c217", (980, 640, 3116, 1966 - 0), fit="cover")
s.place("rs3", (90, 660, 860, 1300))
s.place("rs5", (90, 1360, 860, 1960))
s.place("rs0", (3236, 660, 4006, 1300))
s.place("ex2", (3236, 1360, 4006, 1960))
s.save("wall_s")

# North wall: assembly of bodhisattvas, guardians and donors
n = Wall(W, H)
n.thousand_buddhas((40, 40, W - 40, 470), cell_h=143)
n.band(480, 520)
n.hanging_triangles(520)
n.place("ex4", (1180, 640, 2916, 1720))
n.place("rs4", (90, 660, 1060, 1300))
n.place("rs1", (90, 1360, 1060, 1960))
n.place("inp_real-322", (3036, 660, 4006, 1300))
n.place("ex1", (3036, 1360, 4006, 1960))
n.place("rs2", (1180, 1790, 2916, 1990), fit="cover")
n.save("wall_n")

# West wall: the niche becomes the mirror (cut out in 3D); flying apsaras attend it
w_ = Wall(W, H)
w_.thousand_buddhas((40, 40, W - 40, 470), cell_h=143)
w_.band(480, 520)
w_.hanging_triangles(520)
w_.place("inp_000740", (120, 700, 1180, 1760))
w_.place("ex3", (2916, 700, 3976, 1760))
w_.rect((1300, 620, 2796, 2048), EARTH)   # cut out by the mirror niche
w_.save("wall_w")

# East wall: the door you came through (it will turn into a mirror)
e = Wall(W, H)
e.thousand_buddhas((40, 40, W - 40, 470), cell_h=143)
e.band(480, 520)
e.hanging_triangles(520)
e.place("inp_real-167", (120, 700, 1180, 1760))
e.place("rs3", (2916, 700, 3976, 1760))
e.rect((1300, 620, 2796, 2048), EARTH)
e.save("wall_e")

# Ceiling slopes (覆斗顶): thousand Buddhas with apsaras
for i, key in enumerate(["ex1", "ex3", "inp_000740", "inp_real-167"]):
    sl = Wall(2048, 1024, LAPIS)
    sl.thousand_buddhas((0, 0, 2048, 1024), cell_h=128)
    sl.place(key, (724, 212, 1324, 812))
    sl.save(f"slope{i}")

# Caisson (藻井) at the apex
cz = Wall(1024, 1024, EARTH)
cz.place("ex0", (64, 64, 960, 960), frame=False)
cz.save("caisson")

# Diamond Sutra frontispiece for the threshold (sepia scan, kept as is)
SUTRA.save(OUT / "sutra.jpg", quality=86)

print("done", sorted(p.name for p in OUT.iterdir()))

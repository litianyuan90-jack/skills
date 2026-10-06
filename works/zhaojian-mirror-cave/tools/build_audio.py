"""Generate the film's score and mix it with the narration.

Usage: python3 -I build_audio.py <vo_dir> <film.js> <out.wav>
Everything is synthesised here (no sample libraries): drone, singing bowls,
desert wind, mural flaking, the wiping of the mirror, the shimmer of the lamps.
"""
import json
import re
import sys

import numpy as np
import soundfile as sf

VO, FILM, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
SR = 48000
DUR = 130.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
t = np.arange(N) / SR


def env(points):
    """piecewise-linear envelope from [(time, value), ...]"""
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def onepole(x, cutoff):
    # fast one-pole low-pass using FFT-domain response (good enough for noise beds)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = 1 / np.sqrt(1 + (f / cutoff) ** 2)
    return np.fft.irfft(X * H, n=len(x))


def bandpass(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = np.exp(-0.5 * ((np.log(np.maximum(f, 1)) - np.log(np.sqrt(lo * hi))) / (np.log(hi / lo) / 2)) ** 2)
    return np.fft.irfft(X * H, n=len(x))


def reverb(x, seconds=4.5, wet=0.35):
    L = int(SR * seconds)
    ir = rng.standard_normal(L) * np.exp(-np.linspace(0, 7, L))
    ir = onepole(ir, 5000)
    ir /= np.sqrt((ir ** 2).sum())
    n = len(x) + L
    nfft = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return x * (1 - wet) + y * wet


L = np.zeros(N)
R = np.zeros(N)


def add(sig, start=0.0, pan=0.0, gain=1.0):
    i = int(start * SR)
    j = min(N, i + len(sig))
    if j <= i:
        return
    s = sig[: j - i] * gain
    L[i:j] += s * np.sqrt((1 - pan) / 2)
    R[i:j] += s * np.sqrt((1 + pan) / 2)


# ---------------------------------------------------------------- drone (D)
dr = np.zeros(N)
for f, a in [(36.7, 0.5), (73.4, 0.42), (110.0, 0.22), (146.8, 0.12), (220.0, 0.05)]:
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * (0.03 + f * 0.0004) * t + f)
    dr += a * np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.07 * t)) * lfo
dr *= env([(0, 0), (6, 0.25), (22, 0.3), (27, 0.55), (60, 0.6), (86, 0.45), (92, 0.7), (118, 0.75), (126, 0.5), (130, 0)])
add(dr * 0.16, pan=-0.1)
add(np.roll(dr, 900) * 0.16, pan=0.1)

# ---------------------------------------------------------------- desert wind
wn = rng.standard_normal(N)
wind = bandpass(wn, 250, 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.09 * t) * np.sin(2 * np.pi * 0.023 * t + 1))
wind *= env([(0, 0), (3, 0.5), (20, 0.6), (25, 0.35), (31, 0.1), (130, 0.06)])
add(wind * 0.11, pan=-0.3)
add(np.roll(wind, 24000) * 0.11, pan=0.3)


# ---------------------------------------------------------------- singing bowls
def bowl(f0, dur=10.0, vol=0.3):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for r, a, d in [(1, 1, 1.0), (2.71, 0.45, 0.7), (5.12, 0.22, 0.45), (8.2, 0.08, 0.3)]:
        for det in (-0.7, 0.7):
            s += a * 0.5 * np.sin(2 * np.pi * (f0 * r + det * r) * tt) * np.exp(-tt / (dur * d * 0.33))
    s *= np.minimum(1, tt / 0.004)
    return s * vol


for when, f0, v, p in [(0.9, 146.8, 0.22, 0), (26.4, 110, 0.3, -0.2), (33.3, 220, 0.16, 0.3), (55.4, 98, 0.26, -0.2),
                       (60.0, 293.7, 0.1, 0.4), (86.0, 73.4, 0.34, 0), (92.4, 146.8, 0.18, 0.2), (114.0, 196, 0.22, 0),
                       (122.3, 146.8, 0.24, 0)]:
    add(bowl(f0, 12, v), when, pan=p)

# ---------------------------------------------------------------- golden light (Yuezun's vision)
gl = np.zeros(N)
for f in [880, 1108.7, 1318.5, 1760, 2217.5]:
    gl += np.sin(2 * np.pi * f * t + f) * (0.5 + 0.5 * np.sin(2 * np.pi * (0.7 + f / 3000) * t))
gl *= env([(0, 0), (7.4, 0), (10.5, 0.05), (13, 0.05), (17, 0)])
add(gl * 0.5, pan=0.2)

# lamps multiplying (walking through the mirror) — a slowly rising shimmer
sh = np.zeros(N)
for k, f in enumerate([587.3, 880, 1174.7, 1318.5, 1760]):
    sh += np.sin(2 * np.pi * f * t) * (0.5 + 0.5 * np.sin(2 * np.pi * (0.31 + k * 0.17) * t + k))
sh *= env([(0, 0), (91, 0), (100, 0.035), (112, 0.045), (121, 0.03), (128, 0)])
add(sh, pan=-0.15)

# ---------------------------------------------------------------- flaking (sparse crackles)
cr = np.zeros(N)
for _ in range(260):
    c = rng.uniform(43, 55)
    i = int(c * SR)
    n = int(SR * rng.uniform(0.004, 0.02))
    burst = rng.standard_normal(n) * np.exp(-np.linspace(0, 6, n)) * rng.uniform(0.2, 1)
    cr[i:i + n] += burst
cr = bandpass(cr, 1500, 7000)
add(cr * 0.18, pan=0.25)

# ---------------------------------------------------------------- wiping the mirror (cloth on bronze)
wp = np.zeros(N)
for k in range(9):
    c = 78.7 + k * 0.5
    n = int(SR * 0.45)
    i = int(c * SR)
    sw = rng.standard_normal(n) * np.sin(np.linspace(0, np.pi, n)) ** 2
    wp[i:i + n] += sw
wp = bandpass(wp, 1800, 6000)
add(wp * 0.07, pan=0.1)

# ---------------------------------------------------------------- lamp crackle near the end
lc = np.zeros(N)
for _ in range(90):
    c = rng.uniform(108, 128)
    i = int(c * SR)
    n = int(SR * 0.006)
    lc[i:i + n] += rng.standard_normal(n) * np.exp(-np.linspace(0, 5, n)) * rng.uniform(0.2, 1)
add(bandpass(lc, 800, 5000) * 0.12)

music_L, music_R = reverb(L, 5.5, 0.42), reverb(R, 5.3, 0.42)

# ---------------------------------------------------------------- narration
src = open(FILM, encoding="utf-8").read()
cues = re.findall(r"\['(L\d+)', ([\d.]+),", src)
vo = np.zeros(N)
duck = np.zeros(N)
for cid, start in cues:
    x, sr = sf.read(f"{VO}/{cid}.wav", dtype="float64")
    if x.ndim > 1:
        x = x.mean(1)
    x = np.interp(np.linspace(0, len(x) - 1, int(len(x) * SR / sr)), np.arange(len(x)), x)
    x /= np.max(np.abs(x)) + 1e-9
    i = int(float(start) * SR)
    j = min(N, i + len(x))
    vo[i:j] += x[: j - i]
    a, b = max(0, i - SR // 3), min(N, j + SR // 2)
    duck[a:b] = 1
duck = onepole(duck, 2.0).clip(0, 1)
vo = reverb(vo, 2.2, 0.12)
gain = 1 - 0.45 * duck
mixL = music_L * gain + vo * 0.62
mixR = music_R * gain + vo * 0.62
fade = env([(0, 0), (0.4, 1), (128.5, 1), (130, 0)])
mix = np.stack([mixL * fade, mixR * fade], 1)
mix /= np.max(np.abs(mix)) / 0.89
sf.write(OUT, mix.astype(np.float32), SR)
print("wrote", OUT, mix.shape)

# 音效合成 + 人声链 + 自适应侧链 + 母带
import json, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, resample_poly
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from pedalboard import Pedalboard, HighpassFilter, LowShelfFilter, PeakFilter, Compressor, Reverb, PitchShift, LowpassFilter, HighShelfFilter, Gain

SR = 48000
TOTAL = 122.0; N = int((TOTAL + .5) * SR)
NARR = json.load(open('/tmp/ne/film/data.json'))['narr']
rng = np.random.default_rng(24)
meter = pyln.Meter(SR)

def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def white(n): return rng.standard_normal(n).astype(np.float64)
def brown(n): y = np.cumsum(white(n)); y = hp(y, 20); return y / (np.abs(y).max() + 1e-9)
def pink(n):
    f = np.fft.rfft(white(n)); k = np.arange(len(f)); k[0] = 1; y = np.fft.irfft(f / np.sqrt(k), n); return y / (np.abs(y).max() + 1e-9)
def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e
def lfo(n, f, depth, ph=0.): t = np.arange(n) / SR; return 1 - depth * (.5 + .5 * np.sin(2 * np.pi * f * t + ph))
def norm(x, peak=1.): return x / (np.abs(x).max() + 1e-9) * peak

# ---------------- 音效生成器 ----------------
def wind(d, k=1.):
    n = int(d * SR); b = brown(n); a = bp(b, 180, 900) * lfo(n, .13, .6) + bp(b, 600, 2200) * lfo(n, .21, .7, 1.3) * .6
    return norm(a) * .5 * k
def rain(d, k=1.):
    n = int(d * SR); x = hp(pink(n), 900) * .35
    m = int(d * 140 * k); idx = rng.integers(0, n - 2400, m)
    for i in idx:
        L = int(SR * .012); t = np.arange(L) / SR; x[i:i + L] += np.sin(2 * np.pi * rng.uniform(2000, 6000) * t) * np.exp(-t * 400) * rng.uniform(.05, .25)
    return norm(lp(x, 9000)) * .5 * k
def thunder(d=4.):
    n = int(d * SR); r = lp(brown(n), 160, 4) * np.exp(-np.arange(n) / SR * 1.1) * (1 + .5 * np.sin(np.arange(n) / SR * 9))
    c = hp(white(int(.25 * SR)), 1500) * np.exp(-np.arange(int(.25 * SR)) / SR * 22); r[:len(c)] += c * .5
    return norm(r) * .9
def birds(d, k=1., seed=0):
    n = int(d * SR); x = np.zeros(n); r = np.random.default_rng(seed)
    t = r.uniform(.2, 1.)
    while t < d - .5:
        base = r.uniform(2600, 4200); cnt = r.integers(2, 6)
        for j in range(cnt):
            L = int(r.uniform(.05, .11) * SR); tt = np.arange(L) / SR; f = base * (1 + .5 * np.sin(np.pi * tt / tt[-1])) * r.uniform(.9, 1.15)
            ph = 2 * np.pi * np.cumsum(f) / SR; s = np.sin(ph) * np.sin(np.pi * tt / tt[-1]) ** 2
            i = int((t + j * .13) * SR); x[i:i + L] += s[:max(0, min(L, n - i))] * r.uniform(.3, .8)
        t += r.uniform(.6, 1.8) / k
    return x * .35 * k
def geese(d, k=1.):
    n = int(d * SR); x = np.zeros(n); t = .3
    while t < d - .4:
        L = int(.17 * SR); tt = np.arange(L) / SR; f0 = rng.uniform(330, 420) * (1 - .15 * tt / tt[-1])
        ph = 2 * np.pi * np.cumsum(f0) / SR; saw = 2 * (ph / (2 * np.pi) % 1) - 1
        s = (bp(saw, 700, 1500) + .5 * bp(saw, 2200, 3200)) * np.sin(np.pi * tt / tt[-1]) ** .7
        i = int(t * SR); x[i:i + L] += s[:max(0, min(L, n - i))] * rng.uniform(.4, 1)
        t += rng.uniform(.25, .9)
    return norm(x) * .3 * k
def cicada(d, k=1.):
    n = int(d * SR); t = np.arange(n) / SR; a = bp(white(n), 4200, 6500) * (.5 + .5 * np.sin(2 * np.pi * 48 * t)) ** 2
    return norm(a * (.5 + .5 * np.sin(2 * np.pi * .23 * t)) ** 1.5) * .22 * k
def crickets(d, k=1., f=4600):
    n = int(d * SR); x = np.zeros(n); t = rng.uniform(0, .3)
    while t < d - .2:
        for p in range(3):
            L = int(.022 * SR); tt = np.arange(L) / SR; s = np.sin(2 * np.pi * f * tt) * np.sin(np.pi * tt / tt[-1])
            i = int((t + p * .035) * SR); x[i:i + L] += s[:max(0, min(L, n - i))]
        t += rng.uniform(.35, .55)
    return x * .12 * k
def water(d, k=1.):
    n = int(d * SR); return norm(lp(brown(n), 500) * lfo(n, .4, .7) + bp(white(n), 800, 2500) * .05 * lfo(n, .7, .9)) * .25 * k
def crackle(d, k=1.):
    n = int(d * SR); x = lp(brown(n), 400) * .15
    for i in rng.integers(0, n - 500, int(d * 25)): x[i:i + 200] += hp(white(200), 2000) * np.exp(-np.arange(200) / 30) * rng.uniform(.2, 1)
    return x * .3 * k
def icecrack(d, times):
    n = int(d * SR); x = np.zeros(n)
    for tc in times:
        L = int(.5 * SR); tt = np.arange(L) / SR; f = 2400 * np.exp(-tt * 6) + 300
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * .5 + hp(white(L), 3000) * np.exp(-tt * 60)
        i = int(tc * SR); x[i:i + L] += s[:max(0, min(L, n - i))]
    return x * .45
def rustle(d, k=1.):
    n = int(d * SR); return norm(bp(white(n), 1800, 7000) * lfo(n, .35, .85) ** 2) * .22 * k
def whoosh(d=.7):
    n = int(d * SR); t = np.arange(n) / SR; x = white(n); out = np.zeros(n); seg = int(.05 * SR)
    for i in range(0, n, seg):
        f = 400 + 3500 * (i / n) ** 1.5; out[i:i + seg] = bp(x[i:i + seg + 0], f, min(f * 2.2, 20000))[:len(out[i:i + seg])]
    e = np.sin(np.pi * t / d) ** 2; return lp(out * e, 8000) * .35
def drone(d, k=1.):
    n = int(d * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 55 * t) * .5 + np.sin(2 * np.pi * 55.4 * t) * .4 + np.sin(2 * np.pi * 82.4 * t) * .25 + lp(brown(n), 120) * .4
    return x * .3 * k
def sub_impact(d=3.):
    n = int(d * SR); t = np.arange(n) / SR; f = 70 * np.exp(-t * 1.2) + 32
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.4) * .9
def riser(d=1.5):
    n = int(d * SR); t = np.arange(n) / SR; x = white(n); out = np.zeros(n); seg = int(.04 * SR)
    for i in range(0, n, seg):
        f = 300 * (12 ** (i / n)); out[i:i + seg] = bp(x[i:i + seg], f, min(f * 1.8, 20000))[:len(out[i:i + seg])]
    return out * (t / d) ** 2 * .45


# ---------------- 音效 ----------------
def hum(d, f0=100.):
    n = int(d * SR); t = np.arange(n) / SR; x = sum(np.sin(2 * np.pi * f0 * k * t) / k ** 1.3 for k in range(1, 8)) * (1 + .3 * np.sin(2 * np.pi * .7 * t))
    return norm(bp(x, 80, 1600) + bp(white(n), 2000, 6000) * .04 * lfo(n, 2.3, .9)) * .25
def turbine(d, period=2.2):
    n = int(d * SR); t = np.arange(n) / SR; m = (.5 + .5 * np.cos(2 * np.pi * t / period)) ** 3
    return norm(bp(pink(n), 250, 1400) * (.25 + m)) * .35
def city_amb(d):
    n = int(d * SR); x = lp(brown(n), 300) * .6 + bp(pink(n), 400, 2500) * .25 * lfo(n, .17, .5)
    return norm(x) * .35
def space(d):
    n = int(d * SR); t = np.arange(n) / SR; x = lp(brown(n), 200) * .5 + np.sin(2 * np.pi * 41.2 * t) * .2 + bp(white(n), 3000, 9000) * .02 * lfo(n, .05, .9)
    return norm(x) * .3
def spark(d, rate=6.):
    n = int(d * SR); x = np.zeros(n)
    for i in rng.integers(0, max(1, n - 3000), int(d * rate)):
        L = 2400; tt = np.arange(L) / SR; x[i:i + L] += np.sin(2 * np.pi * rng.uniform(1800, 4200) * tt) * np.exp(-tt * 60) * rng.uniform(.2, 1)
    return x * .15
bg_sfx = np.zeros(N)
def put(x, t, g=1.):
    i = int(t * SR); j = min(N, i + len(x))
    if j > i: bg_sfx[i:j] += x[:j - i] * g
def amb(fn, t0, t1, g, a=1., r=1.5, **kw): d = t1 - t0; put(fn(d, **kw) * env(int(d * SR), a, r), t0, g)
amb(space, 0, 16.5, .55, a=2.5); amb(space, 99.5, 122, .5)
amb(hum, 22, 45.8, .35, a=3, f0=100.); amb(spark, 24, 45, .5)
amb(wind, 44, 66.2, .7, a=1.); amb(turbine, 46, 66, .55, period=2.4)
amb(city_amb, 64.5, 101.3, .55); amb(spark, 89, 99, .6, rate=10.); amb(hum, 84, 100, .2, f0=120.)
for t in (14.4, 44.4, 64.7, 80.5, 100.0): put(whoosh(1.2), t - .3, .8)
for t in (36.25, 60.0, 100.0): put(riser(1.5), t - 1.5, .6); put(sub_impact(3.), t, .9)
for t in (45.0, 80.0, 115.0): put(sub_impact(3.), t, .5)

# ---------------- 音乐 ----------------
def load(p):
    x, sr = sf.read(p, always_2d=True); x = x.mean(1)
    if sr != SR: x = resample_poly(x, SR, sr)
    y = np.zeros(N); y[:min(N, len(x))] = x[:N]; return y
gains = dict(pad=.7, strings=1.0, piano=.85, pulse=.6, bass=.75, brass=.75, choir=.5, perc=.95, bells=.55)
mus = sum(load(f'stems/{k}.wav') * g for k, g in gains.items())
mus2 = np.stack([mus, mus])
board = Pedalboard([HighpassFilter(35), LowShelfFilter(120, 1.5), PeakFilter(450, -1.5, .8), Compressor(-20, 2, 20, 200), Reverb(room_size=.82, damping=.5, wet_level=.28, dry_level=.8, width=1.)])
mus2 = board(mus2.astype(np.float32), SR)
sfx2 = Pedalboard([Reverb(room_size=.5, wet_level=.15, dry_level=.9)])(np.stack([bg_sfx, bg_sfx]).astype(np.float32), SR)
# 轻微立体声分离
sfx2[0] = sfx2[0] * .95; sfx2[1] = np.roll(sfx2[1], 240)
bg = mus2 / (np.abs(mus2).max() + 1e-9) * .5 + sfx2 * .55

# ---------------- 人声 ----------------
vchain = Pedalboard([HighpassFilter(90), PitchShift(-1.2), LowShelfFilter(180, 1.0), PeakFilter(3200, 2.5, 1.0), PeakFilter(7200, -3.0, 2.0),
                     Compressor(-20, 3, 5, 80), Reverb(room_size=.18, wet_level=.07, dry_level=1.)])
vo = np.zeros(N); vmask = np.zeros(N)
for s in NARR:
    x, sr = sf.read(f'/tmp/ne/vo/{s["k"]}.wav'); x = resample_poly(x, SR, sr)
    y = vchain(x[None].astype(np.float32), SR)[0].astype(np.float64)
    y = pyln.normalize.loudness(y, meter.integrated_loudness(y), -17.0)
    i = int(s['t'] * SR); j = min(N, i + len(y)); vo[i:j] += y[:j - i]; vmask[i:j] = 1

# ---------------- 自适应侧链 ----------------
W = int(.1 * SR); nw = N // W
def band_db(x):
    b = bp(x, 300, 4000); e = (b[:nw * W] ** 2).reshape(nw, W).mean(1); return 10 * np.log10(e + 1e-12)
ev = band_db(vo); eb = band_db(bg.mean(0)); act = vmask[:nw * W].reshape(nw, W).max(1) > 0
# 每个旁白段的中位电平作为参考
ref = np.full(nw, -200.)
for s in NARR:
    a, b = int(s['t'] / .1), int((s['t'] + s['d']) / .1) + 1
    seg = ev[a:b]; ref[a:b] = np.median(seg[seg > -80]) if (seg > -80).any() else -200
gdb = np.where(act, np.clip(ref - 13 - eb, -22, 0), 0.)
gdb = np.minimum(gdb, 0); gdb = minimum_filter1d(gdb, 5); gdb = uniform_filter1d(gdb, 3)
g = 10 ** (np.interp(np.arange(N), np.arange(nw) * W + W / 2, gdb) / 20)
notch = Pedalboard([PeakFilter(3000, -3.5, 1.2)])(bg.astype(np.float32), SR)
am = uniform_filter1d(np.interp(np.arange(N), np.arange(nw) * W + W / 2, act.astype(float)), int(.2 * SR))
bgd = (bg * (1 - am) + notch * am) * g
sf.write('qa_bg.wav', bgd.T.astype(np.float32), SR); sf.write('qa_vo.wav', vo.astype(np.float32), SR)

# ---------------- 母带 ----------------
mix = bgd + np.stack([vo, vo])
fade = np.ones(N); fo = int(1.8 * SR); end = int(TOTAL * SR); fade[end - fo:end] = np.linspace(1, 0, fo) ** 1.5; fade[end:] = 0
fi = int(.6 * SR); fade[:fi] *= np.linspace(0, 1, fi)
mix *= fade
mix = mix.T
mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -14.0)
def limiter(x, thr_db=-1.5, look=.005, rel=.08):
    thr = 10 ** (thr_db / 20); pk = np.abs(x).max(1); B = 48; nb = len(pk) // B + 1
    pkb = np.zeros(nb * B); pkb[:len(pk)] = pk; pkb = pkb.reshape(nb, B).max(1)
    need = np.minimum(1, thr / np.maximum(pkb, 1e-9)); need = minimum_filter1d(need, 2 * int(look * SR / B) + 3)
    gg = np.empty_like(need); a = np.exp(-B / (rel * SR)); cur = 1.
    for i in range(nb):
        cur = need[i] if need[i] < cur else a * cur + (1 - a) * need[i]; gg[i] = cur
    gs = np.interp(np.arange(len(pk)), np.arange(nb) * B + B / 2, gg)
    gs = np.minimum(gs, np.minimum(1, thr / np.maximum(pk, 1e-9)))
    return x * gs[:, None]
for _ in range(3):
    mix = limiter(mix)
    mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -14.0)
mix = limiter(mix)
sf.write('mix.wav', mix[:int(TOTAL * SR)].astype(np.float32), SR, subtype='PCM_24')
print('LUFS %.2f  peak %.2f dBFS' % (meter.integrated_loudness(mix), 20 * np.log10(np.abs(mix).max())))

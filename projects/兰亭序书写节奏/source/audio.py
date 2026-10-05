# 声音：笔声（由墨迹时间图推出）+ 配乐（每字起笔即一拍）+ 混音母带
import json, subprocess, numpy as np, soundfile as sf, mido, pyloudnorm as pyln
from scipy import ndimage as ndi
from scipy.signal import butter, sosfilt
from pedalboard import Pedalboard, Reverb, HighpassFilter, LowShelfFilter, PeakFilter, Compressor, HighShelfFilter

SR = 48000
E = json.load(open('events.json')); M = E['meta']; S = M['sections']; FEND = M['total']; N = int(FEND * SR) + SR
J = json.load(open('timeline.json')); W, H = J['W'], J['H']; NT = J['total']; C = J['chars']
Z = [c for c in C if c['ch'] == '之']
rng = np.random.default_rng(7)

# ---------- 笔声：每 5 ms 自然时间的落墨面积与平均笔宽 ----------
tm = np.fromfile('tmap_core.f32', np.float32).reshape(H, W); ink = tm >= 0
dt = ndi.distance_transform_edt(ink); wid = ndi.grey_dilation(dt, size=(9, 9))
BIN = .005; nb = int(NT / BIN) + 2
area = np.bincount((tm[ink] / BIN).astype(int), minlength=nb).astype(float)
wsum = np.bincount((tm[ink] / BIN).astype(int), weights=wid[ink], minlength=nb)
mw = np.where(area > 0, wsum / np.maximum(area, 1), 0)
area_rate = area / BIN    # 像素/自然秒

# 成片时间 → 自然时间的映射（复刻 plan.py）
from importlib import util
spec = util.spec_from_file_location('plan_nat', 'plan_nat.py'); pn = util.module_from_spec(spec); spec.loader.exec_module(pn)

def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)

blk = int(.005 * SR); nblk = N // blk + 1
amp = np.zeros(nblk); bright = np.zeros(nblk)
for b in range(nblk):
    F = b * blk / SR
    segs = []
    if S['F1a'] <= F < S['F2b']:
        n0, n1 = pn.nat(F), pn.nat(F + blk / SR); segs.append((n0, n1, 1.0))
    if S['F5'] <= F < S['F6']:
        for k, z in enumerate(Z):
            st = E['zst'][k]
            if st <= F <= st + (z['t1'] - z['t0']) + .02:
                n0 = z['t0'] + (F - st); segs.append((n0, n0 + blk / SR, 1.0))
    a = 0; wv = 0; rr = 1
    for n0, n1, g in segs:
        i0, i1 = int(max(n0, 0) / BIN), int(max(n1, 0) / BIN) + 1
        if i1 <= i0 or n1 <= n0: continue
        ar = area[i0:i1].sum(); rr = max(rr, (n1 - n0) / (blk / SR))
        a += ar / (n1 - n0) * g; wv += (mw[i0:i1] * area[i0:i1]).sum()
    amp[b] = a / (1 + .06 * (rr - 1)); bright[b] = wv / (ar_ := max(1e-9, sum(area[int(max(n0,0)/BIN):int(max(n1,0)/BIN)+1].sum() for n0, n1, g in segs))) if segs else 0
# 压缩动态：快放时不能吵
a_db = np.where(amp > 0, 20 * np.log10(amp + 1), -120)
env = np.clip((a_db - 50) / 28, 0, 1) ** 1.2
env = ndi.uniform_filter1d(env, 3)
envs = np.repeat(env, blk)[:N]; brs = np.repeat(np.clip(bright / 10, 0, 1), blk)[:N]
noise = rng.standard_normal(N)
hiss = bp(noise, 1800, 7500) * (1 - .6 * brs)            # 细笔：沙沙
rub = bp(noise, 350, 1600) * (.4 + .9 * brs)              # 重按：闷
grain = (rng.random(N) < .002) * rng.standard_normal(N)   # 纸纤维颗粒
grain = bp(grain, 2500, 9000) * 3
brush = (hiss * .6 + rub * .8 + grain * .35) * envs
brush = lp(brush, 9000) * .5

# ---------- 配乐 MIDI ----------
BEAT = .75; TPB = 480
ROOT = 50  # D3
SCALE = [0, 3, 5, 7, 10]   # 羽调五声
def pent(i): o, k = divmod(i, 5); return ROOT + 12 * o + SCALE[k]
tracks = {k: [] for k in ['koto', 'pad', 'bell', 'choir', 'low']}
def note(tr, t, d, n, v, ch, prog): tracks[tr].append((t, d, n, max(1, min(127, int(v))), ch, prog))

# 垫底：低音长音与和声，随段落变化
chords = [(0, [0, 7, 12, 15]), (S['F1a'], [0, 7, 12, 17]), (S['F1b'], [-2, 5, 10, 14]), (37, [-4, 3, 8, 12]), (46, [-5, 2, 7, 10]),
          (S['F3'], [0, 7, 12, 15]), (S['F5'], [-4, 3, 10, 15]), (S['F6'], [-2, 5, 12, 17]), (S['F7'], [0, 7, 12, 19])]
for i, (t0, ch) in enumerate(chords):
    t1 = chords[i + 1][0] if i + 1 < len(chords) else FEND - .5
    for n in ch: note('pad', t0 + .05, t1 - t0 + .4, ROOT - 12 + n, 46, 0, 49)
    note('low', t0 + .05, t1 - t0 + .4, ROOT - 24 + ch[0], 50, 1, 42)

# 书写段：每字起笔一声拨弦（加速后按最小间隔限流），之字配钟
last = -9
areas = np.array([c['area'] for c in C]); rk = areas.argsort().argsort() / len(areas)
for e in E['chars']:
    F = e['F']
    if F < S['F1a'] or F >= S['F2b']: continue
    rate = max(e['rate'], 1)
    gap = .11 if rate < 4 else .16
    deg = int(9 - rk[e['i']] * 8)                       # 墨重 → 低音
    if F - last >= gap:
        v = 92 - min(40, (rate - 1) * 1.6)
        note('koto', F, .9, pent(deg + 5), v, 2, 107); last = F
    if e['ch'] == '之': note('bell', F, 1.2, pent(deg + 10), 70 if rate < 4 else 55, 3, 8)
    prev = E['chars'][e['i'] - 1] if e['i'] > 0 else None
    if prev is None or prev['line'] != e['line']:       # 每行起头：低音
        note('koto', F, 1.6, pent(deg), 84, 2, 107)
# 二十个之：高亮钟声（上行）
for k in range(20): note('bell', S['F3'] + .3 + .17 * k, 1.0, pent(10 + k % 8), 64, 3, 9)
# 重写：每个之一拍，音高由用时决定
zd = np.array(E['zd']); zr = zd.argsort().argsort()
for k, st in enumerate(E['zst']):
    note('koto', st, 1.4, pent(5 + int(12 - zr[k] * 0.55)), 90, 2, 107)
    note('bell', st + .02, 1.6, pent(13 + int(12 - zr[k] * 0.55)), 48, 3, 8)
# 叠影：人声和弦；结尾：琶音
for n in [0, 7, 12, 15, 19]: note('choir', S['F6'] + .2, S['F7'] - S['F6'] + 1.5, ROOT + n, 52, 4, 52)
for i, d in enumerate([0, 2, 4, 5, 7, 9, 10]): note('koto', S['F7'] + 2.4 + i * .28, 3.5, pent(d + 3), 80 - i * 3, 2, 107)
note('koto', S['F7'] + 5.0, 5, pent(0), 88, 2, 107); note('bell', S['F7'] + 5.05, 5, pent(10), 60, 3, 8)

def write_mid(name, evs):
    mf = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mf.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo', tempo=int(BEAT * 1e6)))
    msgs = []; progs = {}
    for t, d, n, v, ch, p in evs:
        if progs.get(ch) != p: msgs.append((max(0, t - .01), 0, mido.Message('program_change', channel=ch, program=p))); progs[ch] = p
        msgs.append((t, 2, mido.Message('note_on', channel=ch, note=n, velocity=v))); msgs.append((t + d, 1, mido.Message('note_off', channel=ch, note=n, velocity=0)))
    msgs.sort(key=lambda x: (x[0], x[1])); last = 0
    for t, _, m in msgs:
        tk = int(round(t / BEAT * TPB)); m.time = max(0, tk - last); last = max(last, tk); tr.append(m)
    mf.save(f'stems/{name}.mid')
    subprocess.run(['fluidsynth', '-ni', '-q', '-r', str(SR), '-R', '0', '-C', '0', '-g', '0.5', '-F', f'stems/{name}.wav',
                    '/usr/share/sounds/sf2/FluidR3_GM.sf2', f'stems/{name}.mid'], check=True, capture_output=True)
import os; os.makedirs('stems', exist_ok=True)
def load(p):
    x, sr = sf.read(p, always_2d=True); x = x.mean(1); y = np.zeros(N); y[:min(N, len(x))] = x[:N]; return y
mus = np.zeros(N)
for k, g in dict(koto=1.0, pad=.55, bell=.5, choir=.45, low=.5).items():
    write_mid(k, tracks[k]); mus += load(f'stems/{k}.wav') * g

# 音效：网格飞入、叠影的呼吸声
def whoosh(d):
    n = int(d * SR); t = np.arange(n) / SR; x = rng.standard_normal(n); out = np.zeros(n); seg = int(.04 * SR)
    for i in range(0, n, seg):
        f = 300 + 3000 * (i / n); out[i:i + seg] = bp(x[i:i + seg], f, min(f * 2.4, 20000))[:len(out[i:i + seg])]
    return out * np.sin(np.pi * t / d) ** 2 * .3
sfx = np.zeros(N)
def put(x, t, g=1.):
    i = int(t * SR); j = min(N, i + len(x)); sfx[i:j] += x[:j - i] * g
put(whoosh(2.2), S['F4'] - .1, .8); put(whoosh(2.6), S['F6'] - .1, .6)
room = lp(rng.standard_normal(N), 900) * .012                 # 纸面室内底噪

mus2 = Pedalboard([HighpassFilter(40), Reverb(room_size=.85, damping=.45, wet_level=.32, dry_level=.75, width=1.)])(np.stack([mus, mus]).astype(np.float32), SR)
br2 = Pedalboard([HighpassFilter(150), PeakFilter(3500, 2, 1), Reverb(room_size=.22, wet_level=.08, dry_level=1.)])(np.stack([brush, np.roll(brush, 30)]).astype(np.float32), SR)
fx2 = Pedalboard([Reverb(room_size=.6, wet_level=.2, dry_level=.9)])(np.stack([sfx + room, sfx + room]).astype(np.float32), SR)
mix = (mus2 / (np.abs(mus2).max() + 1e-9) * .55 + br2 / (np.abs(br2).max() + 1e-9) * .5 + fx2 * .8).T.astype(np.float64)
fade = np.ones(N); fi = int(.8 * SR); fade[:fi] = np.linspace(0, 1, fi); fo = int(2.0 * SR); e = int(FEND * SR); fade[e - fo:e] = np.linspace(1, 0, fo) ** 1.5; fade[e:] = 0
mix *= fade[:, None]
meter = pyln.Meter(SR)
mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -14.0)
def limiter(x, thr_db=-1.5):
    thr = 10 ** (thr_db / 20); pk = np.abs(x).max(1); B = 48; nb = len(pk) // B + 1
    pkb = np.zeros(nb * B); pkb[:len(pk)] = pk; pkb = pkb.reshape(nb, B).max(1)
    need = np.minimum(1, thr / np.maximum(pkb, 1e-9)); need = ndi.minimum_filter1d(need, 7)
    gg = np.empty_like(need); a = np.exp(-B / (.08 * SR)); cur = 1.
    for i in range(nb): cur = need[i] if need[i] < cur else a * cur + (1 - a) * need[i]; gg[i] = cur
    gs = np.interp(np.arange(len(pk)), np.arange(nb) * B + B / 2, gg); gs = np.minimum(gs, np.minimum(1, thr / np.maximum(pk, 1e-9)))
    return x * gs[:, None]
for _ in range(3): mix = limiter(mix); mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -14.0)
mix = limiter(mix)[:int(FEND * SR)]
sf.write('mix.wav', mix.astype(np.float32), SR, subtype='PCM_24')
sf.write('qa_brush.wav', br2.T[:int(FEND * SR)], SR)
print('LUFS %.2f peak %.2f' % (meter.integrated_loudness(mix), 20 * np.log10(np.abs(mix).max())))

# 配乐：按拍点网格写 MIDI（mido），分轨用 FluidSynth 渲染
import json, subprocess, os, random
import mido

G = json.load(open('beat_grid.json')); BEAT = G['beat']; TOTAL = G['total']
TPB = 480
SF = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
random.seed(24)

KEYS = {  # 根音, 五声音阶(半音), 大/小
    'prologue': (62, [0, 2, 4, 7, 9], 'maj'), 'spring': (62, [0, 2, 4, 7, 9], 'maj'),
    'summer': (67, [0, 2, 4, 7, 9], 'maj'), 'autumn': (64, [0, 3, 5, 7, 10], 'min'),
    'winter': (59, [0, 3, 5, 7, 10], 'min'), 'epilogue': (62, [0, 2, 4, 7, 9], 'maj')}
INST = {  # 旋律, 拨弦, 垫底
    'prologue': (73, 8, 49), 'spring': (73, 107, 49), 'summer': (75, 46, 48),
    'autumn': (110, 107, 49), 'winter': (77, 8, 49), 'epilogue': (73, 46, 48)}
PROG = {'maj': [0, 9, 5, 7, 0, 4, 5, 7], 'min': [0, 8, 3, 10, 0, 5, 8, 7]}
PHRASES = [
    [(2, 1), (4, 1), (5, 1.5), (4, .5), (3, 1), (2, 1), (1, 2)],
    [(5, 1), (6, .5), (5, .5), (4, 1), (2, 1), (3, 1.5), (2, .5), (0, 2)],
    [(0, .5), (1, .5), (2, 1), (4, 2), (3, .5), (2, .5), (1, 1), (2, 2)],
    [(4, 1.5), (3, .5), (2, 1), (1, 1), (2, .5), (1, .5), (0, 1), (-1, 2)],
]

def pent(root, scale, i):
    o, k = divmod(i, 5); return root + 12 * o + scale[k]

class Track:
    def __init__(self): self.ev = []
    def note(self, t, dur, n, v, ch, prog=None):
        if prog is not None: self.ev.append((t - .001, 'pc', ch, prog))
        self.ev.append((t, 'on', ch, n, max(1, min(127, int(v))))); self.ev.append((t + dur, 'off', ch, n))
    def cc(self, t, ch, c, v): self.ev.append((t, 'cc', ch, c, int(v)))
    def save(self, path):
        mf = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mf.tracks.append(tr)
        tr.append(mido.MetaMessage('set_tempo', tempo=int(BEAT * 1e6)))
        order = {'pc': 0, 'cc': 1, 'off': 2, 'on': 3}
        evs = sorted(self.ev, key=lambda e: (e[0], order[e[1]])); last = 0
        for e in evs:
            tk = max(0, int(round(e[0] / BEAT * TPB))); dt = max(0, tk - last); last = max(last, tk)
            if e[1] == 'pc': tr.append(mido.Message('program_change', channel=e[2], program=e[3], time=dt))
            elif e[1] == 'cc': tr.append(mido.Message('control_change', channel=e[2], control=e[3], value=e[4], time=dt))
            elif e[1] == 'on': tr.append(mido.Message('note_on', channel=e[2], note=e[3], velocity=e[4], time=dt))
            else: tr.append(mido.Message('note_off', channel=e[2], note=e[3], velocity=0, time=dt))
        tr.append(mido.MetaMessage('end_of_track', time=TPB * 8)); mf.save(path)

S = {k: Track() for k in ['strings', 'melody', 'pluck', 'choir', 'brass', 'perc', 'bells']}
cues = []  # 给混音的事件

def section_of(s):
    if s['id'].startswith('p') or s['id'] == 'title': return 'prologue'
    if s['id'].startswith('e') or s['id'] == 'end': return 'epilogue'
    return s['season']

pc_set = {}
def prog(track, ch, p, t):
    if pc_set.get((track, ch)) != p: S[track].ev.append((t - .002, 'pc', ch, p)); pc_set[(track, ch)] = p

bar_i = 0
for si, s in enumerate(G['shots']):
    sec = section_of(s); root, scale, mode = KEYS[sec]; mel, plk, pad = INST[sec]
    t0, nb = s['start'], s['bars']; kind = s['kind']
    prog('strings', 0, pad, t0); prog('strings', 1, 43, t0); prog('melody', 2, mel, t0); prog('pluck', 3, plk, t0)
    prog('choir', 4, 52, t0); prog('bells', 7, 14, t0); prog('bells', 8, 9, t0)
    dyn = {'prologue': .8, 'spring': .85, 'summer': 1., 'autumn': .85, 'winter': .7, 'epilogue': .95}[sec]
    for b in range(nb):
        tb = t0 + b * 2 * BEAT; deg = PROG[mode][bar_i % 8]; bar_i += 1
        r = root - 12 + deg
        third = 4 if mode == 'maj' and deg in (0, 5, 7) else 3
        voicing = [r, r + 7, r + 14, r + 12 + third] if kind != 'season' else [r, r + 7, r + 12]
        if kind in ('title',) and b == 0: voicing = [root - 12, root - 5, root, root + 4 if mode == 'maj' else root + 3]
        for n in voicing: S['strings'].note(tb, 2 * BEAT + .05, n, 52 * dyn, 0)
        S['strings'].note(tb, 2 * BEAT, r - 12, 60 * dyn, 1)
        if sec in ('prologue', 'winter', 'epilogue') or kind in ('orbit_term',):
            for n in (r + 12, r + 19): S['choir'].note(tb, 2 * BEAT + .1, n, 40 * dyn, 4)
        # 拨弦琶音
        if kind in ('land', 'orbit_term', 'orbit') and sec != 'prologue':
            step = {'spring': .5, 'summer': .5, 'autumn': 1, 'winter': 2, 'epilogue': 1}[sec]
            arp = [r + 12, r + 19, r + 24, r + 12 + third + 12, r + 26]
            k = 0; tt = 0.
            while tt < 2 - 1e-6:
                S['pluck'].note(tb + tt * BEAT, step * BEAT * 1.6, arp[k % len(arp)], (58 if k % 2 == 0 else 46) * dyn + random.randint(-5, 5), 3)
                k += 1; tt += step
    # 旋律
    if kind in ('land', 'orbit_term'):
        ph = PHRASES[(s['idx'] - 1) % 4]; tt = t0 + 2 * BEAT
        for (d, du) in ph:
            if tt + du * BEAT > t0 + s['dur'] - .2: break
            S['melody'].note(tt, du * BEAT * .95, pent(root + 12 if sec in ('winter', 'autumn') else root, scale, d + 5 if sec == 'winter' else d), 74 * dyn + random.randint(-6, 6), 2); tt += du * BEAT
        # 节气起点：一记拨弦 + 钟
        S['bells'].note(t0 + .2, 3.0, root + 12, 64, 7)
        S['pluck'].note(t0 + .2, 1.5, root, 96, 3); S['pluck'].note(t0 + .23, 1.5, root + 7, 80, 3)
        cues.append(dict(t=t0, kind='term', id=s['id']))
    if kind == 'orbit' and s['id'] in ('p1', 'e1', 'e2', 'e3', 'e4'):
        ph = PHRASES[{'p1': 2, 'e1': 0, 'e2': 1, 'e3': 2, 'e4': 3}[s['id']]]; tt = t0 + 2 * BEAT
        for (d, du) in ph:
            if tt + du * BEAT > t0 + s['dur'] - .2: break
            S['melody'].note(tt, du * BEAT * .95, pent(root, scale, d), (60 if s['id'] == 'p1' else 72), 2); tt += du * BEAT
    # 序章 p2：24 刻度逐一点亮 → 24 声钟琴
    if s['id'] == 'p2':
        for i in range(24):
            ti = t0 + .4 + i * ((s['dur'] - 1.6) / 24)
            S['bells'].note(ti, .8, pent(root, scale, 5 + (i % 10)), 58 + i, 8)
    if s['id'] == 'p3':
        for i in range(24): S['pluck'].note(t0 + .6 + i * .09, 1.2, pent(root, scale, 3 + i % 12), 70, 3)
    # 卷首 / 片名：太鼓 + 铜管 braam + 镲；前一镜尾部上行音
    if kind in ('season', 'title'):
        prog('brass', 5, 61, t0); prog('perc', 6, 116, t0); prog('brass', 6, 57, t0)
        for n in (root - 24, root - 17, root - 12): S['brass'].note(t0, 2.6, n, 96, 5)
        for n in (root - 24, root - 12): S['brass'].note(t0, 2.6, n, 90, 6)
        for k, (dt, v) in enumerate([(0, 120), (.75, 80), (1.125, 70), (1.5, 100)]): S['perc'].note(t0 + dt, .6, 50 if k else 45, v, 6)
        S['perc'].note(t0, 3, 49, 110, 9); S['perc'].note(t0 + .02, 2, 35, 120, 9)
        S['perc'].note(t0, 3, 47, 90, 10)  # 定音鼓
        cues.append(dict(t=t0, kind='impact', id=s['id']))
        # 上行音：前一镜最后 1.5s 震音弦乐渐强
        ts = t0 - 1.5; prog('strings', 11, 44, ts)
        for n in (root - 12, root - 5, root): S['strings'].note(ts, 1.5, n, 70, 11)
        for i in range(16): S['strings'].cc(ts + i * 1.5 / 16, 11, 11, 30 + i * 6)
        S['strings'].cc(t0 + .01, 11, 11, 110)
        cues.append(dict(t=ts, kind='riser', id=s['id']))
    if kind == 'end':
        for n in (root - 24, root - 12, root - 5, root, root + 4, root + 9): S['strings'].note(t0, s['dur'], n, 60, 0)
        S['bells'].note(t0 + .5, 5, root + 12, 70, 7); S['bells'].note(t0 + .5, 5, root + 19, 55, 7)

# 定音鼓通道 / 乐器
S['perc'].ev.append((0, 'pc', 10, 47))
os.makedirs('stems', exist_ok=True)
for k, tr in S.items():
    tr.save(f'stems/{k}.mid')
    subprocess.run(['fluidsynth', '-ni', '-q', '-r', '48000', '-R', '0', '-C', '0', '-g', '0.45', '-F', f'stems/{k}.wav', SF, f'stems/{k}.mid'], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('rendered', k)
json.dump(cues, open('stems/cues.json', 'w'), ensure_ascii=False, indent=1)

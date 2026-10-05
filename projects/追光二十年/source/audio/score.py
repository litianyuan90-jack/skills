# 《追光二十年》配乐：96 BPM，D 大调；按章节写 MIDI → FluidSynth 分轨
import subprocess, os, random, mido
random.seed(20)
BPM = 96; BEAT = 60 / BPM; BAR = 4 * BEAT; TPB = 480; TOTAL = 122
SF = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
class Track:
    def __init__(s): s.ev = []
    def pc(s, t, ch, p): s.ev.append((max(0, t - .002), 'pc', ch, p))
    def cc(s, t, ch, c, v): s.ev.append((t, 'cc', ch, c, int(max(0, min(127, v)))))
    def note(s, t, d, n, v, ch): s.ev.append((t, 'on', ch, n, int(max(1, min(127, v))))); s.ev.append((t + d, 'off', ch, n))
    def save(s, p):
        mf = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mf.tracks.append(tr); tr.append(mido.MetaMessage('set_tempo', tempo=int(BEAT * 1e6)))
        o = {'pc': 0, 'cc': 1, 'off': 2, 'on': 3}; last = 0
        for e in sorted(s.ev, key=lambda e: (e[0], o[e[1]])):
            tk = int(round(e[0] / BEAT * TPB)); dt = max(0, tk - last); last = max(last, tk)
            if e[1] == 'pc': tr.append(mido.Message('program_change', channel=e[2], program=e[3], time=dt))
            elif e[1] == 'cc': tr.append(mido.Message('control_change', channel=e[2], control=e[3], value=e[4], time=dt))
            elif e[1] == 'on': tr.append(mido.Message('note_on', channel=e[2], note=e[3], velocity=e[4], time=dt))
            else: tr.append(mido.Message('note_off', channel=e[2], note=e[3], velocity=0, time=dt))
        tr.append(mido.MetaMessage('end_of_track', time=TPB * 8)); mf.save(p)
S = {k: Track() for k in ['pad', 'strings', 'piano', 'pulse', 'bass', 'brass', 'choir', 'perc', 'bells']}
S['pad'].pc(0, 0, 89); S['strings'].pc(0, 1, 49); S['strings'].pc(0, 2, 48); S['piano'].pc(0, 3, 0); S['pulse'].pc(0, 4, 46); S['pulse'].pc(0, 12, 81)
S['bass'].pc(0, 5, 38); S['brass'].pc(0, 6, 61); S['brass'].pc(0, 7, 60); S['choir'].pc(0, 8, 52); S['perc'].pc(0, 10, 47); S['perc'].pc(0, 11, 116); S['bells'].pc(0, 13, 14); S['bells'].pc(0, 14, 8)
D = 62
CH = {'D': (0, 'M'), 'Bm': (-3, 'm'), 'G': (-7, 'M'), 'A': (-5, 'M'), 'Em': (2, 'm'), 'F#m': (4, 'm')}
def triad(name, base=D):
    r, q = CH[name]; r = base + r; return [r, r + (4 if q == 'M' else 3), r + 7]
# 章节（以小节计，1 小节 = 2.5 s）：intro 0-6, map 6-18, desert 18-26, city 26-32, future 32-40, world 40-46, end 46-49
def sec(b): return 'intro' if b < 6 else 'map' if b < 18 else 'desert' if b < 26 else 'city' if b < 32 else 'future' if b < 40 else 'world' if b < 46 else 'end'
PROG = {'intro': ['Bm', 'Bm', 'G', 'G', 'D', 'A'], 'map': ['Bm', 'G', 'D', 'A'], 'desert': ['Bm', 'G', 'D', 'A'], 'city': ['G', 'A', 'Bm', 'D'],
        'future': ['D', 'A', 'Bm', 'G'], 'world': ['G', 'D', 'A', 'Bm', 'G', 'A'], 'end': ['G', 'A', 'D']}
DYN = {'intro': .55, 'map': .7, 'desert': .9, 'city': .78, 'future': .85, 'world': 1., 'end': .6}
start = {}
for b in range(49): start.setdefault(sec(b), b)
MEL = {  # (音阶级数 in D 大调, 拍数)
    'map': [(4, 2), (2, 1), (1, 1), (2, 3), (4, 1), (5, 2), (4, 2), (2, 4)],
    'desert': [(7, 1.5), (6, .5), (4, 2), (5, 1.5), (4, .5), (2, 2), (4, 1.5), (5, .5), (7, 2), (8, 4)],
    'future': [(4, 1), (5, 1), (7, 2), (8, 1), (7, 1), (5, 2), (4, 1), (2, 1), (4, 2), (5, 4)],
    'world': [(7, 2), (8, 1), (9, 1), (8, 2), (7, 2), (5, 1), (7, 1), (8, 2), (11, 4), (9, 2), (8, 2)],
}
SCALE = [0, 2, 4, 5, 7, 9, 11]
def deg(i, base=D): o, k = divmod(i, 7); return base + 12 * o + SCALE[k]
for b in range(49):
    s = sec(b); t = b * BAR; dy = DYN[s]; pr = PROG[s]; c = pr[(b - start[s]) % len(pr)]; tri = triad(c)
    if t >= TOTAL - .3: break
    # 渐强：map 内部随进度增加
    if s == 'map': dy = .55 + .35 * (b - 6) / 12
    # pad
    for n in tri: S['pad'].note(t, BAR + .1, n - 12, 50 * dy + 10, 0)
    # 弦乐长音（低音 + 和弦）
    if s != 'intro' or b >= 3:
        S['strings'].note(t, BAR + .05, tri[0] - 24, 70 * dy, 2)
        for n in tri: S['strings'].note(t, BAR + .05, n, 58 * dy, 1)
        if s in ('desert', 'world', 'future'): S['strings'].note(t, BAR + .05, tri[2] + 12, 54 * dy, 1)
    # 钢琴：intro/end 稀疏分解，其余八分琶音
    arp = [tri[0], tri[1], tri[2], tri[0] + 12, tri[2], tri[1] + 12, tri[0] + 12, tri[2]]
    if s in ('intro', 'end'):
        for i, n in enumerate([tri[0], tri[2], tri[1] + 12, tri[2] + 12]):
            S['piano'].note(t + i * BEAT, BEAT * 3, n, 52 + random.randint(-5, 5), 3)
    elif s in ('map', 'future', 'city'):
        for i, n in enumerate(arp): S['piano'].note(t + i * BEAT / 2, BEAT, n + 12, (56 if i % 2 == 0 else 44) * (.7 + .4 * dy) + random.randint(-4, 4), 3)
    # 脉冲：十六分竖琴 / 合成拨弦
    if s in ('map', 'desert', 'world') and not (s == 'map' and b < 8):
        for i in range(16):
            n = [tri[0] + 12, tri[2] + 12, tri[1] + 24, tri[2] + 12][i % 4]; S['pulse'].note(t + i * BEAT / 4, BEAT / 3, n, (60 if i % 4 == 0 else 42) * dy, 4)
    if s == 'city':
        for i in range(8): S['pulse'].note(t + i * BEAT / 2, BEAT * .4, tri[0] + (12 if i % 2 else 0), 58, 12)
    # 合成贝斯
    if s in ('desert', 'city', 'world'):
        for i in range(8): S['bass'].note(t + i * BEAT / 2, BEAT * .45, tri[0] - 24, (88 if i % 2 == 0 else 68) * dy, 5)
    elif s in ('map', 'future') and b >= 9:
        for i in range(4): S['bass'].note(t + i * BEAT, BEAT * .8, tri[0] - 24, 70 * dy, 5)
    # 合唱
    if s in ('intro', 'future', 'world', 'end'):
        for n in (tri[0], tri[2]): S['choir'].note(t, BAR + .1, n, (44 if s != 'world' else 66), 8)
    # 铜管：desert 与 world 的强拍
    if s in ('desert', 'world'):
        for n in (tri[0] - 12, tri[0], tri[2]): S['brass'].note(t, BAR * .95, n, 70 * dy, 6)
        if s == 'world':
            for n in (tri[0] - 12, tri[1]): S['brass'].note(t, BAR * .95, n, 72, 7)
    # 打击：desert/world 定音鼓 + 鼓组
    if s in ('desert', 'world') or (s == 'map' and b >= 12):
        S['perc'].note(t, .8, 36, 100 * dy, 9); S['perc'].note(t + 2 * BEAT, .8, 36, 80 * dy, 9)
        if s != 'map':
            S['perc'].note(t + BEAT, .5, 38, 60 * dy, 9); S['perc'].note(t + 3 * BEAT, .5, 38, 70 * dy, 9)
            for i in range(8): S['perc'].note(t + i * BEAT / 2, .1, 42, 40 + 10 * (i % 2 == 0), 9)
        S['perc'].note(t, 1.5, tri[0] - 26 if tri[0] - 26 >= 41 else tri[0] - 14, 80 * dy, 10)
    if s == 'city':
        for i in range(4): S['perc'].note(t + i * BEAT, .3, 36, 92, 9)
        for i in range(8): S['perc'].note(t + i * BEAT / 2 + BEAT / 4, .1, 42, 45, 9)
        S['perc'].note(t + BEAT, .4, 39, 70, 9); S['perc'].note(t + 3 * BEAT, .4, 39, 70, 9)
# 旋律（弦乐高音 + 钢琴叠写）
for s, ph in MEL.items():
    t = start[s] * BAR + (BAR if s == 'map' else 0); base = D + (0 if s == 'map' else 12) - 12 * (s == 'desert')
    for rep in range(2 if s in ('map', 'future') else 1):
        for (d, du) in ph:
            if sec(int(t / BAR)) != s: break
            S['strings'].note(t, du * BEAT * .97, deg(d, base) + 12, 80 * DYN[s], 1)
            if s in ('future', 'map'): S['piano'].note(t, du * BEAT, deg(d, base) + 12, 66, 3)
            if s == 'world': S['brass'].note(t, du * BEAT * .95, deg(d, base), 84, 7)
            t += du * BEAT
# 里程碑冲击：taiko + 吊镲 + 钟
HITS = [36.25, 45.0, 60.0, 80.0, 100.0, 115.0]
for h in HITS:
    for k, (dt, v) in enumerate([(0, 124), (.47, 76), (.7, 70), (.94, 104)] if h in (36.25, 60.0, 100.0) else [(0, 110)]): S['perc'].note(h + dt, .7, 50 if k else 45, v, 11)
    S['perc'].note(h, 3, 49, 104, 9); S['perc'].note(h + .01, 2, 35, 120, 9)
    S['bells'].note(h + .02, 4, D + 12, 70, 13)
    # 上行：吊镲滚奏 1.5 s
    for i in range(12): S['perc'].note(h - 1.5 + i * .125, .2, 51 if i < 11 else 49, 30 + i * 6, 9)
# 未来段：钟琴点缀
for b in range(32, 40):
    for i, d in enumerate([7, 9, 11, 12]): S['bells'].note(b * BAR + (i * 2 + 1) * BEAT / 2, 1.2, deg(d), 44 + random.randint(-6, 6), 14)
# 结尾：D 大和弦长音
te = 117.5
for n in (D - 36, D - 24, D - 12, D - 5, D, D + 4, D + 9): S['strings'].note(te, 4.5, n, 66, 1 if n >= D - 12 else 2)
S['bells'].note(te, 5, D + 12, 66, 13); S['bells'].note(te + .3, 5, D + 19, 54, 13); S['piano'].note(te, 4.5, D + 16, 60, 3)
os.makedirs('stems', exist_ok=True)
for k, tr in S.items():
    tr.save(f'stems/{k}.mid')
    subprocess.run(['fluidsynth', '-ni', '-q', '-r', '48000', '-R', '0', '-C', '0', '-g', '0.5', '-F', f'stems/{k}.wav', SF, f'stems/{k}.mid'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('rendered', k)

# 拍点网格：镜头长 = 1 拍 + 旁白 + 2 拍，向上取整到小节（2 拍），且 ≥ min_bars
import json, math, csv
from data import build_shots
BPM = 80; BEAT = 60 / BPM; BAR = 2 * BEAT; FPS = 24
dur = json.load(open('vo/durations.json'))
shots = build_shots(); t = 0.0; out = []
for s in shots:
    if s['narr']:
        need = BEAT + dur[s['id']] + 2 * BEAT
        bars = max(s['min_bars'], math.ceil(need / BAR - 1e-6))
        s['vo_start'] = round(t + BEAT, 4); s['vo_dur'] = round(dur[s['id']], 4)
        # 字幕逐字时刻（按字数比例，标点不计时）
        chars = [c for c in s['caption']]
        s['caption_t0'] = s['vo_start']
    else:
        bars = s['min_bars']
    s['start'] = round(t, 4); s['bars'] = bars; s['dur'] = round(bars * BAR, 4)
    s['f0'] = round(s['start'] * FPS); s['f1'] = round((s['start'] + s['dur']) * FPS)
    t += bars * BAR
    out.append(s)
total = t
json.dump(dict(bpm=BPM, beat=BEAT, bar=BAR, fps=FPS, total=total, shots=out),
          open('beat_grid.json', 'w'), ensure_ascii=False, indent=1)
with open('storyboard.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['id', 'kind', 'chapter', 'start', 'dur', 'bars', 'term', 'narration'])
    for s in out: w.writerow([s['id'], s['kind'], s['ch'], s['start'], s['dur'], s['bars'], s.get('term', ''), s['narr']])
print('total %.1fs = %d:%02d, frames %d' % (total, total // 60, total % 60, round(total * FPS)))

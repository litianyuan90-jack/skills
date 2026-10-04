# 旁白合成：zhtts FastSpeech2(speed_ratio) + MB-MelGAN；逐句打印音素核对多音字
import sys, json, os, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from data import build_shots, PRON
import zhtts
from zhtts.tts import split_sens
from scipy.io import wavfile
SPEED = 1.07
class T(zhtts.TTS):
    def prepare_input(self, ids):
        ids = np.expand_dims(np.array(ids, np.int32), 0)
        return (ids, np.array([0], np.int32), np.array([SPEED], np.float32),
                np.array([1.0], np.float32), np.array([1.0], np.float32))
tts = T()
os.makedirs('vo', exist_ok=True)
meta = {}
for s in build_shots():
    if not s['narr']: continue
    txt = s['narr']
    for a, b in PRON.items(): txt = txt.replace(a, b)
    parts = []
    for seg in split_sens(txt):
        ph = tts.frontend(seg)[1]
        print('PH', s['id'], seg, '|', ph, file=sys.stderr)
        a = tts.mel2audio(tts.text2mel(seg))
        parts.append(a)
        gap = 0.16 if seg.endswith(('，','、')) else 0.3
        parts.append(np.zeros(int(gap * 24000), np.float32))
    a = np.concatenate(parts[:-1])
    # trim
    nz = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, nz[0] - 240): nz[-1] + 1200]
    wavfile.write(f'vo/{s["id"]}.wav', 24000, a.astype(np.float32))
    meta[s['id']] = len(a) / 24000
json.dump(meta, open('vo/durations.json', 'w'), ensure_ascii=False, indent=1)
print(meta)

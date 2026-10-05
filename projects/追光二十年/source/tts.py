import sys, os, json, numpy as np
sys.path.insert(0, '.')
from data import NARR, PRON
import zhtts
from zhtts.tts import split_sens
from scipy.io import wavfile
class T(zhtts.TTS):
    def prepare_input(self, ids):
        ids = np.expand_dims(np.array(ids, np.int32), 0)
        return (ids, np.array([0], np.int32), np.array([1.05], np.float32), np.array([1.0], np.float32), np.array([1.0], np.float32))
tts = T(); os.makedirs('vo', exist_ok=True); meta = {}
for k, txt in NARR:
    for a, b in PRON.items(): txt = txt.replace(a, b)
    parts = []
    for seg in split_sens(txt):
        print('PH', k, seg, '|', tts.frontend(seg)[1], file=sys.stderr)
        parts.append(tts.mel2audio(tts.text2mel(seg))); parts.append(np.zeros(int((.14 if seg.endswith(('，','、','；','：')) else .28) * 24000), np.float32))
    a = np.concatenate(parts[:-1]); nz = np.where(np.abs(a) > .01)[0]; a = a[max(0, nz[0] - 240): nz[-1] + 1200]
    wavfile.write(f'vo/{k}.wav', 24000, a.astype(np.float32)); meta[k] = len(a) / 24000
json.dump(meta, open('vo/durations.json', 'w'), indent=1); print(meta, sum(meta.values()))

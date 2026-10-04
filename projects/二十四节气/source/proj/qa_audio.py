import json, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, resample_poly
SR=48000; G=json.load(open('beat_grid.json'))
vo,_=sf.read('qa_vo.wav'); bg,_=sf.read('qa_bg.wav'); bg=bg.mean(1); mix,_=sf.read('mix.wav')
sos=butter(2,[300,4000],'band',fs=SR,output='sos'); W=int(.1*SR)
def e(x): b=sosfilt(sos,x); n=len(b)//W; return 10*np.log10((b[:n*W]**2).reshape(n,W).mean(1)+1e-12)
ev,eb=e(vo),e(bg); n=min(len(ev),len(eb))
snr=[]
for s in G['shots']:
    if not s['narr']: continue
    a,b=int(s['vo_start']/.1),int((s['vo_start']+s['vo_dur'])/.1)
    m=ev[a:b]>ev[a:b].max()-20
    snr+=list((ev[a:b]-eb[a:b])[m])
snr=np.array(snr)
tp=20*np.log10(np.abs(resample_poly(mix,4,1,axis=0)).max())
L=pyln.Meter(SR).integrated_loudness(mix)
print(f'speech/bg p10 = {np.percentile(snr,10):.1f} dB (need >= 8)  median {np.median(snr):.1f}')
print(f'LUFS {L:.2f} (need -14±0.5)  truepeak {tp:.2f} dBTP (need <= -1)')

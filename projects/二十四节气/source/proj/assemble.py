# 合成：分段 concat（流复制）→ 母版 → 完整版 + 上/下篇（两遍编码，各 < 30MB）
import json, subprocess, os
G = json.load(open('beat_grid.json')); TOTAL = G['total']
OUT = 'out'; os.makedirs(OUT, exist_ok=True)
def run(*a): subprocess.run(list(a), check=True)
with open('concat.txt', 'w') as f:
    for s in G['shots']: f.write(f"file '../film/segs/{s['id']}.mp4'\n")
run('ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'video_master.mp4')
run('ffmpeg', '-y', '-loglevel', 'error', '-i', 'mix.wav', '-c:a', 'aac', '-b:a', '256k', f'{OUT}/二十四节气_原声.m4a')
split = next(s['start'] for s in G['shots'] if s['id'] == 'card_autumn')
def enc(name, ss, to, mib, ab=96):
    dur = to - ss; vb = int(mib * 1024 * 1024 * 8 / dur / 1000 - ab)
    common = ['-ss', f'{ss}', '-t', f'{dur}', '-i', 'video_master.mp4', '-ss', f'{ss}', '-t', f'{dur}', '-i', 'mix.wav',
              '-map', '0:v', '-map', '1:a', '-vf', 'hqdn3d=4:3:6:4.5', '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'film',
              '-b:v', f'{vb}k', '-maxrate', f'{int(vb*1.6)}k', '-bufsize', f'{vb*3}k', '-pix_fmt', 'yuv420p']
    run('ffmpeg', '-y', '-loglevel', 'error', *common, '-pass', '1', '-passlogfile', f'/tmp/pl_{name}', '-an', '-f', 'mp4', '/dev/null')
    run('ffmpeg', '-y', '-loglevel', 'error', *common, '-pass', '2', '-passlogfile', f'/tmp/pl_{name}', '-c:a', 'aac', '-b:a', f'{ab}k', '-movflags', '+faststart', f'{OUT}/{name}.mp4')
    print(name, vb, 'kbps', os.path.getsize(f'{OUT}/{name}.mp4') / 2**20, 'MiB')
enc('二十四节气_上篇', 0, split, 28.6)
enc('二十四节气_下篇', split, TOTAL, 28.6)
enc('二十四节气_完整版', 0, TOTAL, 86, ab=160)

# 自检：拍点、字幕阅读时长、文字框重叠（浏览器内只跑排版）
import json, asyncio, re
from playwright.async_api import async_playwright
G = json.load(open('../film/beat_grid.json')); FPS = G['fps']; BEAT = G['beat']
rep = []
# 1 拍点
err = []
for s in G['shots']:
    err.append(abs(s['start'] / BEAT - round(s['start'] / BEAT)) * BEAT)
    if s['narr']: err.append(abs(s['vo_start'] / BEAT - round(s['vo_start'] / BEAT)) * BEAT)
rep.append(f"1. 拍点误差最大 {max(err)*1000:.2f} ms（≤ 1 帧 = {1000/FPS:.1f} ms）：{'通过' if max(err) <= 1/FPS else '不通过'}")
# 4 阅读时长
worst = []
for s in G['shots']:
    if not s['narr']: continue
    shown = s['start'] + s['dur'] - .2 - s['vo_start']; n = len(re.sub(r'[，。、《》“”—\s]', '', s['caption']))
    worst.append((shown / n, s['id']))
w = min(worst); rep.append(f"4. 字幕阅读时长最短 {w[0]:.2f} s/字（{w[1]}，要求 ≥ 0.13）：{'通过' if w[0] >= .13 else '不通过'}")
# 5 文字框重叠
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
def inter(a, b):
    return max(0, min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x'])) * max(0, min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y']))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=ARGS)
        pg = await b.new_page(viewport={'width': 1080, 'height': 1920})
        await pg.goto('http://127.0.0.1:8766/index.html'); await pg.wait_for_function('window.ready', timeout=300000)
        bad = []; nf = 0
        for s in G['shots']:
            for k in (.3, .6, .92):
                f = int((s['start'] + s['dur'] * k) * FPS); r = await pg.evaluate(f'layout({f})'); nf += 1
                bx = r['boxes']
                for i in range(len(bx)):
                    for j in range(i + 1, len(bx)):
                        a, c = bx[i], bx[j]; o = inter(a, c)
                        if o > 0.04 * min(a['w'] * a['h'], c['w'] * c['h']): bad.append((s['id'], k, a['tag'], c['tag'], int(o)))
        await b.close(); return nf, bad
nf, bad = asyncio.run(main())
rep.append(f"5. 抽 {nf} 帧检查文字框重叠：{'通过' if not bad else '发现 %d 处' % len(bad)}")
for x in bad[:40]: rep.append(f"   - {x}")
print('\n'.join(rep)); open('qa_visual.txt', 'w').write('\n'.join(rep))

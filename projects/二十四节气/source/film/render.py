# 按镜头并行渲染：python3 render.py [workers] [shot ids...]  -> segs/<id>.mp4
import asyncio, sys, json, time, base64, subprocess, os
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
G=json.load(open('beat_grid.json')); FPS=G['fps']
os.makedirs('segs',exist_ok=True)
NW=int(sys.argv[1]) if len(sys.argv)>1 else 2
want=sys.argv[2:]
shots=[s for s in G['shots'] if not want or s['id'] in want]
# 代价大的先渲
shots.sort(key=lambda s:-(s['f1']-s['f0'])*(3 if s['kind']=='land' else 1))
q=asyncio.Queue()
for s in shots: q.put_nowait(s)
async def worker(p,wi):
    b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=ARGS)
    pg=await b.new_page(viewport={'width':1080,'height':1920})
    pg.on('pageerror',lambda e: print('PAGEERR',e,flush=True))
    await pg.goto('http://127.0.0.1:8766/index.html'); await pg.wait_for_function('window.ready',timeout=300000)
    while not q.empty():
        s=await q.get(); t0=time.time(); out=f"segs/{s['id']}.mp4"
        ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate',str(FPS),'-c:v','mjpeg','-i','-',
            '-c:v','libx264','-preset','slow','-crf','13','-pix_fmt','yuv420p','-tune','film',out+'.tmp.mp4'],stdin=subprocess.PIPE)
        for f in range(s['f0'],s['f1']):
            r=await pg.evaluate(f'grab({f})')
            ff.stdin.write(base64.b64decode(r['jpg'].split(',',1)[1]))
        ff.stdin.close(); ff.wait(); os.replace(out+'.tmp.mp4',out)
        n=s['f1']-s['f0']; print(f"[w{wi}] {s['id']} {n}f {(time.time()-t0)/n:.2f}s/f  remaining {q.qsize()}",flush=True)
    await b.close()
async def main():
    async with async_playwright() as p:
        await asyncio.gather(*[worker(p,i) for i in range(NW)])
t=time.time(); asyncio.run(main()); print('done %.1f min'%((time.time()-t)/60))

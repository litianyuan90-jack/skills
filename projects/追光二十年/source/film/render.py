# 分段渲染（可续跑）：python3 render.py  -> segs/s###.mp4，每段 240 帧
import asyncio, time, base64, subprocess, os
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
FPS=24; CH=240; os.makedirs('segs',exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=ARGS)
        pg=await b.new_page(viewport={'width':1920,'height':1080}); pg.on('pageerror',lambda e: print('PAGEERR',e,flush=True))
        await pg.goto('http://127.0.0.1:8780/index.html'); await pg.wait_for_function('window.ready',timeout=300000)
        N=await pg.evaluate('window.N')
        for k,f0 in enumerate(range(0,N,CH)):
            out=f'segs/s{k:03d}.mp4'
            if os.path.exists(out): continue
            t0=time.time(); f1=min(N,f0+CH)
            ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate',str(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','12','-pix_fmt','yuv420p','-tune','film',out+'.tmp.mp4'],stdin=subprocess.PIPE)
            for f in range(f0,f1): ff.stdin.write(base64.b64decode((await pg.evaluate(f'grab({f})')).split(',',1)[1]))
            ff.stdin.close(); ff.wait(); os.replace(out+'.tmp.mp4',out)
            print(f's{k:03d} {f0}-{f1} {(time.time()-t0)/(f1-f0):.2f}s/f',flush=True)
        await b.close(); print('ALLDONE',flush=True)
asyncio.run(main())

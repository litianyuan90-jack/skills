import asyncio, base64, subprocess, time, json
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=ARGS)
        pg=await b.new_page(viewport={'width':1920,'height':1080})
        pg.on('pageerror',lambda e: print('PAGEERR',e,flush=True))
        await pg.goto('http://127.0.0.1:8770/index.html'); await pg.wait_for_function('window.ready',timeout=300000)
        n=await pg.evaluate('window.N'); t=time.time()
        ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate','24','-c:v','mjpeg','-i','-',
            '-c:v','libx264','-preset','slow','-crf','14','-pix_fmt','yuv420p','-tune','film','video.mp4'],stdin=subprocess.PIPE)
        for f in range(n):
            d=await pg.evaluate(f'grab({f})'); ff.stdin.write(base64.b64decode(d.split(',',1)[1]))
            if f%240==0: print(f,'/',n,'%.2fs/f'%((time.time()-t)/(f+1)),flush=True)
        ff.stdin.close(); ff.wait(); await b.close(); print('done',n,'%.1f min'%((time.time()-t)/60),flush=True)
asyncio.run(main())

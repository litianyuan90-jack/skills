# 抽帧预览：python3 still.py t1 t2 ... (秒) -> stills/*.jpg
import asyncio, sys, time, json
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-sandbox']
async def main(ts):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=ARGS)
        pg=await b.new_page(viewport={'width':1080,'height':1920})
        pg.on('console',lambda m: print('CONSOLE',m.text) if m.type in('error','warning') else None)
        pg.on('pageerror',lambda e: print('PAGEERR',e))
        await pg.goto('http://127.0.0.1:8766/index.html'); await pg.wait_for_function('window.ready',timeout=180000)
        for t in ts:
            t0=time.time(); f=round(float(t)*24); r=await pg.evaluate(f'renderFrame({f})')
            await pg.screenshot(path=f'stills/{float(t):06.2f}.jpg',type='jpeg',quality=88)
            print(t, r['shot'], '%.2fs'%(time.time()-t0))
        await b.close()
import os; os.makedirs('stills',exist_ok=True); asyncio.run(main(sys.argv[1:]))

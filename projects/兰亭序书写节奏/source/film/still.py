import asyncio, sys, base64, time
from playwright.async_api import async_playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main(ts):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args=ARGS)
        pg=await b.new_page(viewport={'width':1920,'height':1080})
        pg.on('pageerror',lambda e: print('PAGEERR',e)); pg.on('console',lambda m: print('CON',m.text) if m.type=='error' else None)
        await pg.goto('http://127.0.0.1:8770/index.html'); await pg.wait_for_function('window.ready',timeout=300000)
        for t in ts:
            t0=time.time(); d=await pg.evaluate(f'grab({round(float(t)*24)})')
            open(f'st_{float(t):06.2f}.jpg','wb').write(base64.b64decode(d.split(',')[1])); print(t,'%.2fs'%(time.time()-t0))
        await b.close()
asyncio.run(main(sys.argv[1:]))

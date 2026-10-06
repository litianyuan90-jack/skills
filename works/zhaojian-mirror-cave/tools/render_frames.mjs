// Render film frames with headless Chromium (software GL).
// Usage: node render_frames.mjs <playwright-core dir> <outdir> <t0> <t1> <fps> <worker> <workers> [times...]
// With explicit times, only those stills are rendered (for previews).
import fs from 'fs';

const [, , pwDir, out, t0s, t1s, fpss, ws, nws, ...only] = process.argv;
const { chromium } = await import(`${pwDir}/index.mjs`);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:8765/web/?film=1');
await p.waitForFunction(() => window.__zj && window.__zj.ready, null, { timeout: 180000 });
await p.evaluate(() => document.fonts.ready);

const fps = +fpss, w = +ws, nw = +nws;
let frames = [];
if (only.length) frames = only.map((t) => Math.round(+t * fps));
else for (let f = Math.round(+t0s * fps); f < Math.round(+t1s * fps); f++) if (f % nw === w) frames.push(f);

const t0 = Date.now();
for (const f of frames) {
  const file = `${out}/${String(f).padStart(5, '0')}.jpg`;
  if (!only.length && fs.existsSync(file)) continue;
  await p.evaluate((t) => window.__zj.frame(t), f / fps);
  await p.screenshot({ path: file, type: 'jpeg', quality: 92 });
}
console.log(`worker ${w}: ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await b.close();

import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const [out, opp, t0, t1, step] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5], +(process.argv[6] || 1)];
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('file://' + process.cwd() + '/index.html');
await pg.evaluate((v) => { const el = document.querySelector('#opponent'); el.value = v; window.__demo.start(); window.__demo.stop(); }, opp);
await pg.evaluate((t) => window.__demo.seek(t), t0 - 2);
let n = 0, next = t0;
for (let t = t0 - 2; t <= t1; t += 1 / 30) {
  await pg.evaluate((t) => window.__demo.seekPlay(t), t);
  if (t >= next) { await pg.screenshot({ path: `${out}/f${String(n++).padStart(2, '0')}.png` }); next += step; }
}
console.log('shots', n, 'errors', errs);
await b.close();

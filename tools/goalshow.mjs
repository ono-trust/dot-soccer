import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const out = process.argv[2], opp = process.argv[3] || 'バランス型', n = +(process.argv[4] || 18), gap = +(process.argv[5] || 1000);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('file://' + process.cwd() + '/index.html');
await pg.evaluate((v) => { document.querySelector('#opponent').value = v; window.__demo.start(); }, opp);
if (process.argv[6] !== 'intro') {
  const gt = await pg.evaluate(() => window.__demo.match.events.find((e) => e.type === 'goal').t);
  console.log('goal at', gt);
  await pg.evaluate((t) => { window.__demo.stop(); window.__demo.seek(t - 1.5); window.__demo.play(); }, gt);
}
for (let i = 0; i < n; i++) { await pg.waitForTimeout(gap); await pg.screenshot({ path: `${out}/g${String(i).padStart(2, '0')}.png` }); }
console.log('errors', errs);
await b.close();

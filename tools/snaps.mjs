import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('file://' + process.cwd() + '/index.html');
const opps = await pg.$$eval('#opponent option', (o) => o.map((x) => x.value));
const want = { penalty: 1.2, card: 0.4, divecatch: 0.25, diveparry: 0.2, punch: 0.1, kick2: 0 };
const got = {};
for (const opp of opps) {
  await pg.evaluate((v) => { const el = document.querySelector('#opponent'); el.value = v; el.dispatchEvent(new Event('change')); }, opp);
  await pg.evaluate(() => window.__demo.start());
  await pg.evaluate(() => window.__demo.stop());
  const evs = await pg.evaluate(() => window.__demo.match.events.map((e) => ({ type: e.type, act: e.act, t: e.t, color: e.color })));
  for (const e of evs) {
    const key = e.type === 'penalty' ? 'penalty' : e.type === 'card' ? 'card' : e.act === 'divecatch' ? 'divecatch' : e.act === 'diveparry' ? 'diveparry' : e.act === 'punch' ? 'punch' : null;
    if (!key || got[key]) continue;
    got[key] = 1;
    await pg.evaluate((t) => window.__demo.seek(t), e.t - 1.2);
    // play forward through the event so banners fire
    for (let k = 0; k <= Math.round((1.2 + want[key]) / 0.05); k++) await pg.evaluate((t) => { window.__demo.seekPlay(t); }, e.t - 1.2 + k * 0.05);
    await pg.screenshot({ path: `${out}/${key}.png` });
    console.log(key, opp, e.t, e.color || '');
  }
  if (!got.kick2) { got.kick2 = 1; await pg.evaluate(() => window.__demo.seek(232)); await pg.screenshot({ path: `${out}/second_half.png` }); }
  if (Object.keys(got).length >= 6) break;
}
console.log('errors', errs);
await b.close();

import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const want = JSON.parse(process.argv[3] || '{"head":0.25,"slide":0.2,"feint":0.25,"fall":0.4,"jump":0.25}');
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('file://' + process.cwd() + '/index.html');
const opps = await pg.$$eval('#opponent option', (o) => o.map((x) => x.value));
const got = {};
for (const opp of opps) {
  await pg.evaluate((v) => { const el = document.querySelector('#opponent'); el.value = v; window.__demo.start(); window.__demo.stop(); }, opp);
  const acts = await pg.evaluate(() => window.__demo.match.actions.map((a) => ({ a: a.a, t: a.t, i: a.i })));
  for (const a of acts) {
    if (want[a.a] == null || got[a.a] || a.t < 15) continue;
    got[a.a] = 1;
    const t0 = a.t - 1, t1 = a.t + want[a.a];
    await pg.evaluate((t) => window.__demo.seek(t), t0);
    for (let t = t0; t <= t1; t += 1 / 20) await pg.evaluate((t) => window.__demo.seekPlay(t), t);
    await pg.evaluate((i) => window.__demo.select(i), a.i);
    await pg.evaluate((t) => window.__demo.seekPlay(t), t1);
    await pg.screenshot({ path: `${out}/${a.a}.png` });
    const pos = await pg.evaluate(() => window.__demo.selPos());
    console.log(a.a, opp, a.t, JSON.stringify(pos));
  }
  if (Object.keys(got).length >= Object.keys(want).length) break;
}
console.log('errors', errs);
await b.close();

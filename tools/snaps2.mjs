import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const want = JSON.parse(process.argv[3] || '{"goalkick":2,"corner":2,"throw":1.5,"offside":1,"card":1.5}');
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('file://' + process.cwd() + '/index.html');
const opps = await pg.$$eval('#opponent option', (o) => o.map((x) => x.value));
const got = {};
for (const opp of opps) {
  await pg.evaluate((v) => { const el = document.querySelector('#opponent'); el.value = v; window.__demo.start(); window.__demo.stop(); }, opp);
  const evs = await pg.evaluate(() => window.__demo.match.events.map((e) => ({ type: e.type, act: e.act, t: e.t })));
  for (const e of evs) {
    const key = e.act && want[e.act] != null ? e.act : e.type;
    if (want[key] == null || got[key] || e.t < 20) continue;
    got[key] = 1;
    const t0 = e.t - 1.5, t1 = e.t + want[key];
    await pg.evaluate((t) => window.__demo.seek(t), t0);
    for (let t = t0; t <= t1; t += 1 / 20) await pg.evaluate((t) => window.__demo.seekPlay(t), t);
    await pg.screenshot({ path: `${out}/${key}.png` });
    console.log(key, opp, e.t);
  }
  if (Object.keys(got).length >= Object.keys(want).length) break;
}
console.log('errors', errs);
await b.close();

import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('file://' + process.cwd() + '/index.html');
await pg.evaluate(() => { document.querySelector('#opponent').value = '走力型'; window.__demo.start(); window.__demo.stop(); });
const r = await pg.evaluate(() => { const res = []; for (let t = 0; t < 450; t += 1 / 48) { const a = window.__demo.camPos(t); res.push([t, a]); } let best = [0, 0]; for (let i = 1; i < res.length; i++) { const d = Math.hypot(res[i][1][0] - res[i - 1][1][0], res[i][1][1] - res[i - 1][1][1]); if (d > best[1] && Math.abs(res[i][0] - 225) > 1) best = [res[i][0], d]; } return best; });
console.log(r);
const evs = await pg.evaluate((t) => window.__demo.match.events.filter((e) => Math.abs(e.t - t) < 3), r[0]);
console.log(evs);
await b.close();

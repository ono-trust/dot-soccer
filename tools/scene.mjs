// 使い方: node tools/scene.mjs out.png 開始秒 終了秒 [間隔] [level] [opp] [seed]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const [out, t0, t1, st, lv, opp, seed] = [process.argv[2], +process.argv[3], +process.argv[4], +(process.argv[5] || 0.4), process.argv[6] || 's', process.argv[7] || 'バランス型', process.argv[8] || '1'];
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 960, height: 600 } });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('file://' + process.cwd() + '/index.html');
await pg.evaluate(([lv, opp, seed]) => { document.querySelector('#level').value = lv; document.querySelector('#opponent').value = opp; document.querySelector('#seed').value = seed; window.__demo.start(); window.__demo.stop(); }, [lv, opp, seed]);
await pg.evaluate((t) => window.__demo.seek(t), t0 - 1.5);
const shots = []; let next = t0;
for (let t = t0 - 1.5; t <= t1; t += 1 / 20) { await pg.evaluate((t) => window.__demo.seekPlay(t), t); if (t >= next) { shots.push(await pg.screenshot({ type: 'png' })); next += st; } }
const fs = await import('fs'); fs.mkdirSync('/tmp/claude-0/scn', { recursive: true });
shots.forEach((s, i) => fs.writeFileSync(`/tmp/claude-0/scn/s${String(i).padStart(2, '0')}.png`, s));
console.log('frames', shots.length, errs);
await b.close();

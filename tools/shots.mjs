import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const out = process.argv[2] || '/tmp/claude-0/-home-claude/f3fef121-91a9-5442-8ca5-954cee1692dc/scratchpad/shots';
const times = (process.argv[3]||'5,20,60,120').split(',').map(Number);
const opp = process.argv[4] || 'バランス型';
import fs from 'fs'; fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs=[]; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await pg.goto('file://' + process.cwd() + '/index.html');
await pg.selectOption('#opponent', opp);
await pg.click('#start');
await pg.waitForTimeout(300);
await pg.evaluate(()=>window.__demo.stop());
for (const t of times) {
  await pg.evaluate((t)=>window.__demo.seek(t), t);
  await pg.screenshot({ path: `${out}/t${String(t).padStart(3,'0')}.png` });
}
console.log('errors', errs);
await b.close();

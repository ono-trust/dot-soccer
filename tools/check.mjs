import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const out='/tmp/claude-0/-home-claude/f3fef121-91a9-5442-8ca5-954cee1692dc/scratchpad/check'; import fs from 'fs'; fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch();
for (const [vw,vh,tag] of [[1440,900,'pc'],[390,844,'sp']]) {
const pg = await b.newPage({ viewport: { width: vw, height: vh } });
const errs=[]; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('file://' + process.cwd() + '/index.html');
await pg.screenshot({path:`${out}/${tag}-0setup.png`});
await pg.selectOption('#opponent','走力型'); await pg.click('#start'); await pg.waitForTimeout(500);
const m = await pg.evaluate(()=>{const e=window.__demo.match.events.find(x=>x.type==='goal'); return e?e.t:null});
if (m) { await pg.evaluate((t)=>{window.__demo.stop();window.__demo.seek(t-0.1)}, m); await pg.evaluate(()=>{document.querySelector('#pause').click()}); await pg.waitForTimeout(400); await pg.screenshot({path:`${out}/${tag}-1goal.png`}); }
await pg.evaluate(()=>{window.__demo.stop();window.__demo.seek(224.5)}); await pg.click('#pause'); await pg.waitForTimeout(800); await pg.screenshot({path:`${out}/${tag}-2half.png`});
await pg.click('#second'); await pg.click('#skip'); await pg.waitForTimeout(200); await pg.screenshot({path:`${out}/${tag}-3result.png`, fullPage:true});
console.log(tag,'goal at',m,'errors',errs);
}
await b.close();

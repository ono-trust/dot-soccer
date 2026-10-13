import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto('file://' + process.cwd() + '/index.html');
for (const opp of (process.argv[2]||'走力型,裏抜け型,パス型').split(',')) {
  await pg.selectOption('#opponent', opp); await pg.click('#start'); await pg.waitForTimeout(200);
  await pg.evaluate(()=>window.__demo.stop());
  console.log(opp, await pg.evaluate(()=>window.__demo.camCheck()), JSON.stringify(await pg.evaluate(()=>window.__outs)));
  await pg.goto('file://' + process.cwd() + '/index.html');
}
await b.close();

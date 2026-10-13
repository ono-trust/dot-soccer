// 2026-10-10：CPUのスキル数をそろえる。国内屈指は5個ちょうど、エース・中心選手は4〜5個（タイプに合うスキルから、名前で決まる順に足す。多い分は減らさない）
//   node tools/add_skills_20261010.cjs   （一度だけ実行。rosters.js を書き換える）
'use strict';
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
require('../engine/engine.js'); require('../teams.js'); require('../rosters.js');
const SK = window.DotSoccer.SKILLS, R = window.DOT_ROSTERS;
const POOL = {
  'ゴールキーパー': ['superReflex', 'punching', 'oneOnOne', 'pkStopper', 'coaching', 'calm'],
  'スイーパーキーパー': ['rushOut', 'lowThrow', 'oneOnOne', 'superReflex', 'coaching', 'calm'],
  'スイーパー': ['cover', 'intercept', 'longFeed', 'aerial', 'calm', 'captaincy', 'recovery'],
  'ストッパー': ['shoulder', 'aerial', 'slide', 'shotBlock', 'fighting', 'ironMan'],
  'マンマーカー': ['manMark', 'intercept', 'slide', 'recovery', 'lateGrit', 'shoulder'],
  'ラインコントローラー': ['cover', 'captaincy', 'intercept', 'longFeed', 'calm', 'aerial'],
  'ビルドアップ型': ['longFeed', 'switchPlay', 'oneTouchPass', 'calm', 'throughPass', 'cover'],
  'レジスタ': ['switchPlay', 'longFeed', 'throughPass', 'oneTouchPass', 'calm', 'curve'],
  'ダイナモ': ['pressMonster', 'ironMan', 'recovery', 'lateGrit', 'intercept', 'powerMid'],
  'ゲームメイカー': ['throughPass', 'noLook', 'oneTouchPass', 'oneTwo', 'curve', 'fk'],
  'パサー': ['throughPass', 'loftedThrough', 'pinpointCross', 'curve', 'noLook', 'earlyCross'],
  'ファンタジスタ': ['noLook', 'heelPass', 'controlShot', 'roulette', 'nutmeg', 'elastico', 'cutIn', 'fk'],
  'シャドー': ['behindRun', 'controlShot', 'looseBall', 'oneTwo', 'nearRun', 'dribbleShot'],
  'アンカー': ['intercept', 'cover', 'slide', 'recovery', 'longFeed', 'calm'],
  'ストライカー': ['nearPost', 'volley', 'driveShot', 'controlShot', 'bigStage', 'clutch', 'divingHeader'],
  'アタッカー': ['cutIn', 'speedDribble', 'dribbleShot', 'bodyFeint', 'controlShot', 'elastico'],
  '偽9番': ['postPlay', 'oneTwo', 'heelPass', 'controlShot', 'throughPass', 'noLook'],
  'デコイラン': ['behindRun', 'nearRun', 'farWait', 'looseBall', 'oneTwo', 'volley'],
  'バランス': ['curve', 'intercept', 'oneTouchPass', 'calm'],
};
const hsh = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const log = [];
for (const [id, ro] of Object.entries(R)) {
  const d1 = (ro.lvl || 0) >= 70;
  for (const p of ro.players) {
    let target;
    if (p.top) target = 5;
    else if (p.role === 'ace' || p.role === 'core') target = Math.max((p.skills || []).length, 4 + (hsh(p.name + id) % 2));
    else continue;
    if (p.skills.length > 5 && p.top) p.skills = p.skills.slice(0, 5);
    const pool = (POOL[p.type] || POOL['バランス']).filter((k) => SK[k] && !(p.skills || []).includes(k));
    pool.sort((a, b) => hsh(p.name + a) - hsh(p.name + b));
    const add = [];
    while ((p.skills.length + add.length) < target && pool.length) add.push(pool.shift());
    if (add.length) { p.skills = [...p.skills, ...add]; log.push(`${id} ${p.name}（${p.type}）+${add.join(',')}`); }
  }
}
const file = path.join(__dirname, '..', 'rosters.js');
const src = fs.readFileSync(file, 'utf8');
const head = src.slice(0, src.indexOf('root.DOT_ROSTERS = ') + 'root.DOT_ROSTERS = '.length);
const rest = src.slice(src.indexOf('root.DOT_ROSTERS = ') + 'root.DOT_ROSTERS = '.length);
// JSON の終わり（; の前）を見つける
let depth = 0, end = -1; for (let i = 0; i < rest.length; i++) { const c = rest[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } } else if (c === '"') { i++; while (rest[i] !== '"') { if (rest[i] === '\\') i++; i++; } } }
fs.writeFileSync(file, head + JSON.stringify(R) + rest.slice(end));
console.log(log.length + ' players'); console.log(log.filter((l) => /国内|かまた|かとう|にしの/.test(l) || true).slice(0, 30).join('\n'));

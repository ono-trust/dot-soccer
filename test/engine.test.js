import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../engine/engine.js';

const D = globalThis.DotSoccer;
const play = (opp, seed) => D.simulateMatch(D.beginningTeam(), D.presetTeam(opp), seed);

test('同じシードなら同じ試合になる', () => {
  const a = play('プレス型', 77), b = play('プレス型', 77);
  assert.deepEqual(a.score, b.score);
  assert.deepEqual(a.events, b.events);
});

test('ボールは実際に転がり、選手から選手へ動く（瞬間移動しない）', () => {
  const r = play('バランス型', 3);
  let travelled = 0, maxJump = 0;
  for (let i = 1; i < r.frames.length; i++) {
    const a = r.frames[i - 1], b = r.frames[i];
    const d = Math.hypot(b[1] - a[1], b[2] - a[2]);
    // キックオフ・再開のときだけは置き直しがある
    const restart = r.events.some((e) => ['goal', 'half', 'offside', 'goalkick', 'corner', 'foul'].includes(e.type) && Math.abs(e.t - b[0]) < 4);
    if (!restart) maxJump = Math.max(maxJump, d);
    travelled += d;
  }
  assert.ok(travelled > 2000, `ボールの移動距離 ${travelled.toFixed(0)}m`);
  assert.ok(maxJump < 8, `0.2秒で${maxJump.toFixed(1)}m動いた`);
});

test('スコアはゴールの出来事の数と一致する（得点はボールがゴールに入った時だけ）', () => {
  for (let s = 1; s <= 10; s++) {
    const r = play('裏抜け型', s);
    const g = [0, 1].map((t) => r.events.filter((e) => e.type === 'goal' && e.team === t).length);
    assert.deepEqual(r.score, g);
  }
});

test('チーム名で勝敗を決めていない（同じ中身なら名前を変えても結果は同じ）', () => {
  const t = D.presetTeam('パス型');
  const renamed = { ...t, name: 'なまえだけ違う', short: 'X' };
  const a = D.simulateMatch(D.beginningTeam(), t, 5, { frames: false });
  const b = D.simulateMatch(D.beginningTeam(), renamed, 5, { frames: false });
  assert.deepEqual(a.score, b.score);
});

test('隠しパラメーターで動きが変わる（実際の位置から集計）', () => {
  const agg = {};
  for (let s = 1; s <= 6; s++) {
    for (const opp of D.PRESET_NAMES) {
      const r = D.simulateMatch(D.beginningTeam(), D.presetTeam(opp), s * 11, { frames: false });
      for (const g of Object.values(r.typeLog)) {
        if (g.team !== 0) continue;
        const a = (agg[g.type] ??= { atkX: 0, atkN: 0, defX: 0, defN: 0, box: 0, pressSum: 0, distOwner: 0, nOwner: 0 });
        for (const k in a) a[k] += g[k];
      }
    }
  }
  const def = (t) => agg[t].defX / agg[t].defN, atk = (t) => agg[t].atkX / agg[t].atkN;
  const box = (t) => agg[t].box / agg[t].atkN, press = (t) => agg[t].pressSum / agg[t].defN;
  const near = (t) => agg[t].distOwner / agg[t].nOwner;
  assert.ok(def('ストッパー') - def('スイーパー') > 2, 'スイーパーはストッパーより深く守る');
  assert.ok(press('ストッパー') > press('スイーパー') * 2, 'ストッパーはスイーパーより相手に寄せる');
  assert.ok(atk('ダイナモ') > atk('レジスタ'), 'ダイナモはレジスタより前に出る');
  assert.ok(near('レジスタ') < near('スイーパー'), 'レジスタはボールの近くにいる');
  assert.ok(box('ストライカー') > box('レジスタ') * 3, 'ストライカーはゴール前にいる');
});

test('試合の数字がサッカーとしておかしくない範囲にある', () => {
  let goals = 0, shots = 0, n = 0;
  for (let s = 1; s <= 4; s++) for (const opp of D.PRESET_NAMES) {
    const r = D.simulateMatch(D.beginningTeam(), D.presetTeam(opp), s, { frames: false });
    goals += r.score[0] + r.score[1]; shots += r.stats[0].shots + r.stats[1].shots; n++;
  }
  assert.ok(goals / n > 0.8 && goals / n < 6, `1試合の得点 ${(goals / n).toFixed(2)}`);
  assert.ok(shots / n > 4 && shots / n < 40, `1試合のシュート ${(shots / n).toFixed(1)}`);
});

test('エンジンにチーム名を使った分岐がない', async () => {
  const src = await readFile(new URL('../engine/engine.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function simulateMatch'));
  for (const name of D.PRESET_NAMES) assert.ok(!body.includes(`'${name}'`), `${name} が試合処理の中にある`);
});

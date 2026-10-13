// CPU選手のタイプを19種類で振り直す（2026-10-08、太賀さんの許可で1回だけ実行）
// 変えるのは type と、新しい7タイプの国内屈指（top）だけ。名前・能力・背番号・スキル・見た目は変えない
//   node tools/retype_rosters.cjs        → rosters.js を書きかえる
global.window = global;
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..');
require(path.join(DIR, 'engine/engine.js')); require(path.join(DIR, 'teams.js')); require(path.join(DIR, 'rosters.js'));
const R = global.DOT_ROSTERS, TEAMS = global.DOT_TEAMS, LG = Object.fromEntries(TEAMS.map((t) => [t.id, t.lg]));
const K12 = ['kick', 'technique', 'dribble', 'pass', 'speed', 'dash', 'stamina', 'physical', 'jump', 'defense', 'vision', 'mental'];
const BY_POS = {
  GK: ['ゴールキーパー', 'スイーパーキーパー'],
  DF: ['スイーパー', 'ストッパー', 'マンマーカー', 'ラインコントローラー', 'ビルドアップ型'],
  MF: ['レジスタ', 'ダイナモ', 'ゲームメイカー', 'パサー', 'ファンタジスタ', 'シャドー', 'アンカー'],
  FW: ['ストライカー', 'アタッカー', '偽9番', 'デコイラン'],
};
// タイプらしさ：そのタイプに大事な能力（S=2, A=1, B=0, C=-1）と、選手の能力の「その人の平均からの差」の積
const KEYS = {
  'ストライカー': 'SSAASSASSCSS', 'アタッカー': 'ASSASSABBCAS', 'ゲームメイカー': 'ASSSBAACCCSS', 'パサー': 'SSASAAABBBSA', 'レジスタ': 'ASASBBABBASS',
  'ダイナモ': 'AAAAASSABAAS', 'スイーパー': 'CABAAAASSSSS', 'ストッパー': 'CBCBAAASSSAS', 'マンマーカー': 'CABBSSSAASAA', 'ラインコントローラー': 'CABSAAAASSSS', 'ゴールキーパー': 'BBCABSAASASS',
  '偽9番': 'ASASBBABCCSS', 'デコイラン': 'BAABSSSABCAS', 'ファンタジスタ': 'ASSSAABCCCSA', 'シャドー': 'SAABSSABACAS', 'アンカー': 'BACABASSASSS', 'ビルドアップ型': 'AABSBBAAASSS', 'スイーパーキーパー': 'ABCASSAASASS',
};
const W = { S: 2, A: 1, B: 0, C: -1 };
const fit = (q, t) => { const m = K12.reduce((a, k) => a + q[k], 0) / 12; return [...KEYS[t]].reduce((a, ch, j) => a + W[ch] * (q[K12[j]] - m), 0); };
const topScore = (t, q) => [...KEYS[t]].reduce((a, ch, j) => a + (ch === 'S' ? q[K12[j]] : ch === 'A' ? q[K12[j]] * 0.3 : 0), 0);
const isJP = (n) => /^[ぁ-ゖー]+$/.test(n);
const NEW = ['偽9番', 'デコイラン', 'ファンタジスタ', 'シャドー', 'アンカー', 'ビルドアップ型', 'スイーパーキーパー'];

// 1) 新しい7タイプの国内屈指：D1の日本人のエース・中心選手から、そのタイプにいちばん合う人（ポジションが合うこと）
const taken = new Set(), nTop = {};
for (const id in R) for (const q of R[id].players) if (q.top) { taken.add(id + '|' + q.no); nTop[id] = (nTop[id] || 0) + 1; }
const tops = {};
for (const t of NEW) {
  const pos = Object.keys(BY_POS).find((p) => BY_POS[p].includes(t));
  let best = null;
  for (const id in R) { if (LG[id] !== 'd1' || (nTop[id] || 0) >= 2) continue;   // 1チームに国内屈指は2人まで
    for (const q of R[id].players) {
    if (q.pos !== pos || !isJP(q.name) || !(q.role === 'ace' || q.role === 'core') || taken.has(id + '|' + q.no)) continue;
    const sc = topScore(t, q); if (!best || sc > best.sc) best = { id, q, sc };
  } }
  taken.add(best.id + '|' + best.q.no); nTop[best.id] = (nTop[best.id] || 0) + 1; best.q.top = t; best.q.type = t; tops[t] = best.id + ' ' + best.q.name;
}
// 2) そのほかの選手：ポジションごとに、タイプの人数がだいたい同じになるよう割り振る（GKは7:3）
//    各タイプの「らしさ」をポジションの中で標準化し、らしさの高い組み合わせから順に、空きのあるタイプへ入れる。今のタイプは少し優先
const SHARE = { GK: { 'ゴールキーパー': 0.7, 'スイーパーキーパー': 0.3 } };
for (const pos in BY_POS) {
  const list = BY_POS[pos], ps = [];
  for (const id in R) for (const q of R[id].players) if (q.pos === pos && !q.top) ps.push(q);
  const z = {};
  for (const t of list) { const v = ps.map((q) => fit(q, t)), m = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; z[t] = v.map((x) => (x - m) / sd); }
  const quota = {}; for (const t of list) quota[t] = Math.ceil(ps.length * ((SHARE[pos] || {})[t] || 1 / list.length));
  const pairs = []; ps.forEach((q, i) => list.forEach((t) => pairs.push([z[t][i] + (t === q.type ? 0.5 : 0), i, t])));
  pairs.sort((a, b) => b[0] - a[0]);
  const done = new Set();
  for (const [, i, t] of pairs) { if (done.has(i) || quota[t] <= 0) continue; ps[i].type = t; quota[t]--; done.add(i); }
}
const cnt = {}; for (const id in R) for (const q of R[id].players) cnt[q.type] = (cnt[q.type] || 0) + 1;
const src = fs.readFileSync(path.join(DIR, 'rosters.js'), 'utf8');
const head = src.slice(0, src.indexOf('root.DOT_ROSTERS = ') + 'root.DOT_ROSTERS = '.length), tail = src.slice(src.lastIndexOf('; })('));
if (process.argv[2] !== '--dry') fs.writeFileSync(path.join(DIR, 'rosters.js'), head + JSON.stringify(R) + tail);
console.log('新しい国内屈指', tops);
console.log('タイプの人数', cnt);

// CPUの65チームの固定選手（25人ずつ）・監督・方針・ユニフォームを作って、rosters.js に書き出す
//   node tools/make_rosters.cjs
// 一度作ったら固定（同じ入力なら同じ結果）。名前や能力を直したいときは、この台本を直して作り直す
'use strict';
// ★ 選手は固定（2026-10-08）。誰が始めても同じ選手がいるように、rosters.js はもう作り直さない。
//   どうしても作り直すときだけ： node tools/make_rosters.cjs --force
if (!process.argv.includes('--force') && require('fs').existsSync(require('path').join(__dirname, '..', 'rosters.js'))) { console.log('rosters.js は固定です（作り直すときは --force）'); process.exit(0); }
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
require('../engine/engine.js'); require('../teams.js');
const D = window.DotSoccer, TEAMS = window.DOT_TEAMS, SK = D.SKILLS;
let seed = 20261007;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; let x = seed ^ (seed >>> 15); x = Math.imul(x, 0x2c1b3c6d) >>> 0; return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------- 名前 ----------
const SURNAMES = ('あいかわ あいざわ あおき あおやま あかい あかぎ あきやま あさい あさの あさひ あずま あだち あべ あまの あらい あらき あらた ありま いいだ いがらし いけだ いけの いしい いしかわ いしだ いしばし いしはら いずみ いそべ いだ いちかわ いちの いとう いなば いのうえ いまい いまむら いりえ いわさき いわた いわもと うえだ うえの うえむら うしお うすい うちだ うの うめだ うめはら うらた えがわ えぐち えだ えのもと えんどう おいかわ おおいし おおうち おおかわ おおくぼ おおさわ おおしま おおた おおつか おおの おおはし おおや おか おかざき おかだ おがた おかの おかべ おかもと おぎの おくだ おくむら おぐら おざき おざわ おだ おちあい おの おのでら かい かがわ かきた かくた かさい かじ かしわぎ かたおか かとう かない かなざわ かねこ かのう かまた かみお かみや かめい かやの かわい かわかみ かわぐち かわしま かわの かわばた かわむら かんだ きくち きしだ きしもと きただ きたの きたむら きど きのした きむら きよた くが くさの くどう くの くぼ くぼた くまがい くもい くらた くりた くりはら くろかわ くろさき くろだ こいけ こうの こが こじま こだま ことう こばやし こまつ こみや こやま こんどう さいき さいとう さえき さかい さかぐち さかもと さがら さくま さくらい ささき ささの さとう さなだ さの さわだ さわむら しいな しおた しおの しげた しの しのだ しばた しま しまだ しみず しもだ しらいし しらかわ しんどう すぎた すぎの すぎもと すずき すだ すどう すなが すみた せき せきね せの せら そうま そえだ そね そのだ たいら たか たかぎ たかしま たかだ たかの たかはし たかやま たき たきざわ たくま たけうち たけだ たけなか たけの たけむら たじま たちばな たなか たにぐち たにの たむら たるい ちば ちかだ つかだ つかもと つじ つじむら つだ つちや つつみ つのだ つぼい てらだ てらにし とおやま とがし とくなが とだ となみ とみた ともだ とよだ ないとう ながい なかがわ ながさわ なかじま なかた ながの なかむら なかやま なぐも なつめ なみき なりた なんぶ にいの にしい にしかわ にしだ にしの にしむら にった ぬまた ねぎし のぐち のざき のだ のなか のむら はがわ はしだ はしもと はせ はた はたの はっとり はなだ はまだ はまの はやかわ はやし はやの はら はらだ ひうら ひがし ひぐち ひさの ひの ひらい ひらた ひらの ひろせ ひろた ふかい ふかさわ ふくだ ふくち ふじい ふじおか ふじた ふじの ふじわら ふせ ふなき ふるかわ ふるた ほうじょう ほしの ほそだ ほった ほんだ まえだ まきの まさき ますだ まちだ まつい まつお まつだ まつの まつもと まなべ まるやま みうら みかみ みずの みずはら みぞぐち みたに みなみ みね みやうち みやざき みやた みやの みやもと むかい むらい むらおか むらた もちづき もとき もとやま もりおか もりた もりの もりや やぎ やすだ やなぎ やなせ やの やまうち やまおか やまぎし やまぐち やまさき やました やまだ やまの やまべ やまもと ゆあさ ゆうき ゆき よこい よこた よこやま よしい よしかわ よしだ よしの よしむら よねだ よもぎ わかばやし わかまつ わだ わたなべ わたぬき あきもと いくた いせ うるま えなみ おきた おとわ かざま かすが かみじょう きりたに くすのき こいずみ こうさか さいじょう さかき しまむら すがわら そらい たかつき つきしま ときた なぎさ はるな ひびの ふゆき みかど みずき やましろ ゆずき れんの').split(' ');
const FOREIGN = ('アルベルト ブルーノ カルロス ディエゴ エミリオ ファビオ ガブリエル ウーゴ イバン ハビエル ケビン ルーカス マルコ ニコ オスカル パブロ ラファエル セルジオ ティアゴ ウォルター ビクトル アドリアン ベルント クラウス デニス エリック フェリペ ゴメス ハンス イゴール ヨナス カルロ レアンドロ マテオ ネイマ オルガ? ペドロ キケ ロベルト シモン トマス ウーリ バレンテ ビルツ ザビエル アンドレ ボリス セサル ダニエル エンツォ フランコ ジャン ヘンリー イサーク ジュリオ カイオ ロレンツォ ミゲル ノア オットー パトリス クインシー ルベン ステファン テオ ウーゴ ベニート ワグナー ジエゴ ヤン ゼノ アレックス ベルナト クリス ドミンゴ エドゥ フリオ ギジェルモ ホルヘ イシドロ ホアキン カリム ルイス マキシ ナウエル オリバー ピエール ラウル サンティ トニ ウマル バスコ ウェズリー シャビ ユーリ ザック アラン ブラス チコ ダビド エルナン ファン ジルベルト ハイメ イニゴ ジョエル クルト レオ モイセス ネストル オビ ポール ラミロ サウル ティモ ヴィニ ウィレム ヨアン'.replace(/\?/g, '')).split(' ').filter(Boolean);
const usedByLeague = {};
function nameFor(lg, foreignRate) {
  const used = (usedByLeague[lg] = usedByLeague[lg] || new Set());
  for (let k = 0; k < 400; k++) { const n = rnd() < foreignRate ? pick(FOREIGN) : pick(SURNAMES); if (!used.has(n)) { used.add(n); return n; } }
  return pick(SURNAMES) + ri(2, 9);
}

// ---------- 監督の方針 ----------
const STYLE = {
  uwajima: 'balance', muroto: 'counter', onomichi: 'highpress', izumo: 'possession', beppu: 'wing',
  sado: 'wing', hida: 'possession', suwa: 'counter', otaru: 'possession', ishinomaki: 'highpress', hitachi: 'counter',
  imabari: 'balance', marugame: 'counter', niihama: 'highpress', naruto: 'possession', kurashiki: 'balance', shunan: 'wing', tottori: 'highpress', kure: 'counter',
  aomori: 'wing', morioka: 'wing', akita: 'highpress', yamagata: 'balance', aizu: 'counter', takasaki: 'balance', kofu: 'possession', nagaoka: 'highpress',
  takamatsu: 'balance', tokushima: 'wing', saga: 'wing', nagasaki: 'possession', miyazaki: 'highpress', himeji: 'possession', mito: 'counter', utsunomiya: 'balance', kawagoe: 'counter', fujisawa: 'wing', toyama: 'counter', toyohashi: 'possession',
  okayama: 'balance', matsuyama: 'counter', shimonoseki: 'counter', kokura: 'highpress', kumamoto: 'counter', naha: 'balance', nara: 'possession', wakayama: 'balance', hakodate: 'possession', asahikawa: 'counter', kanazawa: 'possession', matsumoto: 'highpress', fukui: 'balance', ise: 'wing',
  hakata: 'highpress', hiroshima: 'counter', naniwa: 'wing', kobe: 'possession', kyoto: 'possession', satsuma: 'highpress', sapporo: 'wing', sendai: 'counter', tokyo: 'balance', yokohama: 'possession', nagoya: 'wing', niigata: 'balance',
};
const POLICY = {
  possession: ['パスをつなぐ', '短いパスでボールを持ち続けて、相手を動かして崩す'],
  counter: ['堅守速攻', '深く守ってボールを奪い、足の速いFWへ一気に縦パス'],
  highpress: ['ハイプレス', '前から全員で追いかけて、相手陣地でボールを奪う'],
  wing: ['サイド攻撃', 'サイドを広く使って、クロスとヘディングで勝負'],
  balance: ['バランス', '攻守のバランスを大事にする、基本に忠実なサッカー'],
};
const FORMS = { balance: ['4-4-2', '4-2-3-1', '4-4-1-1'], counter: ['4-5-1', '5-3-2', '4-1-4-1'], possession: ['4-3-3', '4-2-3-1', '3-4-3'], highpress: ['4-4-2', '4-3-3', '3-4-2-1'], wing: ['4-3-3', '3-5-2', '4-4-2'] };
const TYPES = {
  possession: { DF: ['スイーパー', 'ラインコントローラー', 'スイーパー', 'ストッパー'], MF: ['レジスタ', 'ゲームメイカー', 'パサー', 'レジスタ', 'ダイナモ'], FW: ['ストライカー', 'アタッカー', 'ストライカー'] },
  counter: { DF: ['ストッパー', 'マンマーカー', 'ストッパー', 'スイーパー'], MF: ['ダイナモ', 'マンマーカー', 'パサー', 'ダイナモ'], FW: ['アタッカー', 'アタッカー', 'ストライカー'] },
  highpress: { DF: ['ストッパー', 'マンマーカー', 'ラインコントローラー'], MF: ['ダイナモ', 'ダイナモ', 'マンマーカー', 'レジスタ'], FW: ['アタッカー', 'ストライカー'] },
  wing: { DF: ['スイーパー', 'ストッパー', 'マンマーカー'], MF: ['ダイナモ', 'パサー', 'ダイナモ', 'レジスタ'], FW: ['ストライカー', 'アタッカー', 'ストライカー'] },
  balance: { DF: ['スイーパー', 'ストッパー', 'マンマーカー'], MF: ['バランス', 'ダイナモ', 'レジスタ', 'パサー'], FW: ['ストライカー', 'アタッカー', 'バランス'] },
};
// 能力のくせ（12個：キック・テクニック・ドリブル・パス・スピード・瞬発力・スタミナ・フィジカル・ジャンプ・守備・判断・メンタル）
const K12 = ['kick', 'technique', 'dribble', 'pass', 'speed', 'dash', 'stamina', 'physical', 'jump', 'defense', 'vision', 'mental'];
const PROF = {
  'ゴールキーパー': [-6, -8, -18, -6, -6, 2, -4, 4, 10, 4, 2, 6],
  'スイーパー': [-6, -2, -8, 2, 0, 0, 0, 4, 4, 10, 6, 2],
  'ストッパー': [-6, -6, -10, -4, 0, 2, 2, 10, 8, 12, -4, 2],
  'マンマーカー': [-8, -4, -8, -4, 4, 6, 6, 4, 2, 12, -2, 0],
  'ラインコントローラー': [-6, 0, -8, 4, -2, 0, 2, 2, 4, 10, 10, 4],
  'レジスタ': [2, 6, 0, 10, -4, -2, 2, -4, -6, 2, 10, 2],
  'ダイナモ': [0, 0, 0, 2, 4, 6, 12, 2, -2, 4, 0, 2],
  'ゲームメイカー': [4, 10, 6, 10, -2, 0, -4, -8, -8, -8, 12, 2],
  'パサー': [4, 4, 2, 12, 0, 0, 2, -4, -4, -6, 8, 0],
  'ストライカー': [12, 2, 0, -6, 2, 4, -4, 6, 8, -14, -2, 6],
  'アタッカー': [6, 4, 10, -2, 10, 10, 0, -4, -6, -12, 0, 2],
  'バランス': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const SBIAS = {
  possession: { pass: 3, technique: 3, vision: 3, speed: -2, physical: -2 },
  counter: { speed: 3, dash: 3, defense: 2, pass: -2, technique: -2 },
  highpress: { stamina: 5, defense: 2, dash: 2, technique: -2, vision: -1 },
  wing: { speed: 3, pass: 2, dribble: 1, jump: 1, vision: -1 },
  balance: {},
};
const SKILL_BASE = { FW: ['bodyFeint', 'scissors', 'cutIn', 'volley', 'nearPost', 'knuckle', 'speedDribble', 'behindRun', 'looseBall', 'powerMid', 'driveShot', 'lob', 'dribbleShot', 'controlShot'], MF: ['curve', 'throughPass', 'doubleTouch', 'controlShot', 'switchPlay', 'earlyCross', 'oneTouchPass', 'pressMonster', 'fk', 'noLook', 'intercept'], DF: ['slide', 'intercept', 'cover', 'aerial', 'shotBlock', 'manMark', 'longFeed', 'recovery', 'overlap', 'shoulder'], GK: ['punching', 'superReflex', 'oneOnOne', 'coaching', 'lowThrow', 'rushOut', 'pkStopper'] };
const SKILL_STYLE = {
  possession: { FW: ['oneTwo', 'postPlay', 'controlShot'], MF: ['throughPass', 'oneTouchPass', 'noLook', 'switchPlay', 'oneTwo', 'roulette'], DF: ['longFeed', 'cover'], GK: ['lowThrow'] },
  counter: { FW: ['behindRun', 'speedDribble', 'looseBall'], MF: ['intercept', 'loftedThrough', 'recovery'], DF: ['slide', 'shotBlock', 'aerial', 'manMark'], GK: ['superReflex', 'lowPunt'] },
  highpress: { FW: ['pressMonster', 'looseBall'], MF: ['pressMonster', 'slide', 'ironMan', 'lateGrit'], DF: ['slide', 'shoulder', 'fighting'], GK: ['rushOut'] },
  wing: { FW: ['nearRun', 'farWait', 'divingHeader', 'aerial'], MF: ['earlyCross', 'pinpointCross', 'overlap', 'speedDribble', 'cutIn'], DF: ['overlap', 'earlyCross'], GK: ['punching'] },
  balance: { FW: ['nearPost'], MF: ['curve'], DF: ['cover'], GK: ['punching'] },
};
const ACE_SIG = { FW: ['knuckle', 'elastico', 'driveShot', 'nearPost', 'bicycle', 'clutch', 'bigStage'], MF: ['fk', 'controlShot', 'roulette', 'throughPass', 'noLook', 'captaincy'], DF: ['captaincy', 'aerial', 'longFeed'], GK: ['superReflex', 'pkStopper', 'oneOnOne'] };
// リーグごとのレギュラーの強さ（能力の平均）：地域2部 E〜D／地域1部 D〜C／D3 C〜B／D2 B〜A／D1 B〜S
const LGINFO = { regW2: [41, 46, [0, 1], 0.02], regE2: [41, 46, [0, 1], 0.02], regW1: [48, 53, [0, 1], 0.04], regE1: [48, 53, [0, 1], 0.04], d3: [55, 61, [1, 2], 0.08], d2: [62, 68, [1, 2], 0.12], d1: [67, 73, [2, 3], 0.18] };
// リーグの中の立ち位置：上位常連（いつも上のほう）・下位常連（いつも下のほう）。それ以外は中堅
const TIER = {
  top: ['tokyo', 'yokohama', 'hakata', 'kanazawa', 'okayama', 'hakodate', 'nagasaki', 'fujisawa', 'kurashiki', 'imabari', 'aomori', 'kofu', 'beppu', 'hitachi'],
  low: ['niigata', 'satsuma', 'wakayama', 'fukui', 'toyohashi', 'kawagoe', 'tottori', 'kure', 'takasaki', 'aizu', 'uwajima', 'izumo', 'suwa', 'otaru'],
};
const TIER_LV = {
  regW2: { low: [37], mid: [41, 44], top: [46] }, regE2: { low: [37], mid: [41, 44], top: [46] },
  regW1: { low: [46], mid: [49, 53], top: [55] }, regE1: { low: [46], mid: [49, 53], top: [55] },
  d3: { low: [55], mid: [57, 61], top: [63] }, d2: { low: [63], mid: [65, 68], top: [70] }, d1: { low: [70], mid: [72, 74], top: [76] },
};
const PATS = ['solid', 'solid', 'solid', 'vstripe', 'hstripe', 'band', 'sash'];
const valid = (k) => SK[k] != null;

const out = {};
for (const t of TEAMS) {
  seed = [...t.id].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 777);
  const style = STYLE[t.id] || 'balance', [lo, hi, skr, fr] = LGINFO[t.lg];
  const tier = TIER.top.includes(t.id) ? 'top' : TIER.low.includes(t.id) ? 'low' : 'mid';
  // 上位常連は1つ上のリーグの下位常連と同じくらい、下位常連は1つ下のリーグの上位常連と同じくらい
  const u = rnd(), LV = TIER_LV[t.lg];
  const T = tier === 'top' ? LV.top[0] + ri(0, 1) : tier === 'low' ? LV.low[0] + ri(0, 1) : Math.round(LV.mid[0] + u * (LV.mid[1] - LV.mid[0]));
  const formation = pick(FORMS[style]);
  const coach = { name: nameFor('coach', t.lg === 'd1' ? 0.25 : 0.05), policy: POLICY[style][0], desc: POLICY[style][1] };
  // 25人：GK3・DF8・MF8・FW6
  const slots = [...Array(3).fill('GK'), ...Array(8).fill('DF'), ...Array(8).fill('MF'), ...Array(6).fill('FW')];
  // エース（FWかMF）、中心選手（D1・D2は2人、それ以外は1人）
  const acePos = rnd() < 0.62 ? 'FW' : 'MF';
  const players = slots.map((pos, k) => ({ pos, k }));
  const firstOf = (pos, n) => players.filter((p) => p.pos === pos).slice(0, n);
  const ace = firstOf(acePos, 1)[0]; ace.role = 'ace';
  const coreN = t.lg === 'd1' || t.lg === 'd2' ? 2 : 1;
  const corePool = [firstOf('DF', 1)[0], firstOf(acePos === 'FW' ? 'MF' : 'FW', 1)[0], firstOf('GK', 1)[0], firstOf('MF', 2)[1]].filter((p) => !p.role);
  for (let c = 0; c < coreN; c++) { const p = corePool.splice(Math.floor(rnd() * corePool.length), 1)[0]; if (p) p.role = 'core'; }
  // レギュラー（フォーメーションの人数）と控え
  const need = { GK: 1, DF: +formation.split('-')[0], FW: +formation.split('-').slice(-1)[0] }; need.MF = 10 - need.DF - need.FW;
  const cnt = { GK: 0, DF: 0, MF: 0, FW: 0 };
  const tps = TYPES[style];
  for (const p of players) {
    const i = cnt[p.pos]++;
    const starter = i < need[p.pos] || (p.pos !== 'GK' && i < need[p.pos] + 0);
    p.starter = i < need[p.pos];
    p.type = p.pos === 'GK' ? 'ゴールキーパー' : tps[p.pos][i % tps[p.pos].length];
    if (p.role === 'ace' && p.pos === 'FW') p.type = rnd() < 0.5 ? 'ストライカー' : 'アタッカー';
    if (p.role === 'ace' && p.pos === 'MF') p.type = style === 'possession' || rnd() < 0.5 ? 'ゲームメイカー' : 'パサー';
    const L = p.role === 'ace' ? T + ri(8, 9) : p.role === 'core' ? T + ri(3, 5) : p.starter ? T + ri(-3, 3) : i < need[p.pos] + 2 ? T - ri(3, 6) : T - ri(7, 12);
    p.lv = L;
    p.age = p.role === 'ace' ? ri(23, 29) : p.starter ? ri(21, 32) : rnd() < 0.5 ? ri(18, 21) : ri(24, 34);
  }
  // 能力（12個）
  const sb = SBIAS[style];
  for (const p of players) {
    const pr = PROF[p.type] || PROF['バランス'];
    p.par = {};
    K12.forEach((k, j) => { p.par[k] = clamp(Math.round(p.lv + pr[j] + (sb[k] || 0) + ri(-4, 4)), 25, 95); });
    // 平均がレベルになるように少し寄せる（型のくせで全体が上下しすぎないように）
    const avg = K12.reduce((a, k) => a + p.par[k], 0) / 12, d = Math.round(p.lv - avg);
    K12.forEach((k) => { p.par[k] = clamp(p.par[k] + d, 25, 95); });
  }
  // スキル
  for (const p of players) {
    const base = SKILL_BASE[p.pos], sty = (SKILL_STYLE[style][p.pos] || []).filter(valid);
    let n = p.role === 'ace' ? skr[1] + 2 : p.role === 'core' ? skr[1] + 1 : p.starter ? ri(skr[0], skr[1]) : ri(0, skr[0]);
    const sk = new Set();
    if (p.role === 'ace') sk.add(pick(ACE_SIG[p.pos].filter(valid)));
    for (let g = 0; g < 20 && sk.size < n; g++) sk.add(rnd() < 0.55 && sty.length ? pick(sty) : pick(base.filter(valid)));
    p.skills = [...sk].filter(valid);
  }
  // 背番号：GK 1、レギュラーは2〜11、エースは10（FWなら9）、ほかは12〜
  const used = new Set(), num = (n) => { used.add(n); return n; };
  const free = () => { for (let n = 12; n < 50; n++) if (!used.has(n) && rnd() < 0.55) return num(n); for (let n = 12; n < 99; n++) if (!used.has(n)) return num(n); };
  ace.no = num(ace.pos === 'FW' ? 9 : 10);
  const order = { GK: [1], DF: [2, 3, 4, 5, 6], MF: [7, 8, 10, 6, 14], FW: [11, 9, 7, 20] };
  for (const p of players) if (!p.no && p.starter) { const c = order[p.pos].find((n) => !used.has(n)); p.no = c ? num(c) : free(); }
  for (const p of players) if (!p.no) p.no = free();
  // 名前・見た目
  for (const p of players) { p.name = nameFor(t.lg, p.role === 'ace' ? fr * 2 : fr); p.looks = [ri(0, 5), ri(0, 4), rnd() < 0.8 ? ri(0, 1) : 2]; }
  // ユニフォーム：シャツ＝メインカラー、パンツ・ソックスはサブカラーか白、柄はチームごと
  const pat = pick(PATS);
  const kit = { pat, shirt: t.c1, sub: t.c2, shorts: rnd() < 0.5 ? t.c2 : (t.c1.toLowerCase() === '#ffffff' || t.c1.toLowerCase() === '#f4f4f0' || t.c1.toLowerCase() === '#f2f2f2' ? t.c2 : '#ffffff'), socks: rnd() < 0.6 ? t.c1 : t.c2 };
  out[t.id] = {
    style, formation, lvl: T, tier, coach, kit,
    players: players.map((p) => ({ no: p.no, name: p.name, pos: p.pos, type: p.type, role: p.role || '', starter: !!p.starter, age: p.age, ...p.par, skills: p.skills, looks: p.looks })),
  };
}
// ---------- タイプ別の「国内屈指」：国内でいちばんの選手を、タイプごとに1人。そのタイプに必要な能力が軒並み高い ----------
const TOP = {   // キック テクニック ドリブル パス スピード 瞬発力 スタミナ フィジカル ジャンプ 守備 判断 メンタル
  'ストライカー': 'SSAASSASSCSS', 'アタッカー': 'ASSASSABBCAS', 'ゲームメイカー': 'ASSSBAACCCSS', 'パサー': 'SSASAAABBBSA', 'レジスタ': 'ASASBBABBASS',
  'ダイナモ': 'AAAAASSABAAS', 'スイーパー': 'CABAAAASSSSS', 'ストッパー': 'CBCBAAASSSAS', 'マンマーカー': 'CABBSSSAASAA', 'ラインコントローラー': 'CABSAAAASSSS', 'ゴールキーパー': 'BBCABSAASASS',
};
const GV = { S: [86, 91], A: [76, 82], B: [66, 72], C: [57, 62] };
const FORCE_TOP = { 'ストライカー': ['tokyo', 'ace'] };   // 国内屈指のストライカーは東京エドフィールズのエース
const usedTeam = new Set();
for (const type of Object.keys(TOP)) {
  let cand = null;
  const f = FORCE_TOP[type];
  if (f) cand = { tid: f[0], p: out[f[0]].players.find((q) => q.role === f[1]) };
  if (!cand) for (const lg of ['d1']) {
    const list = [];
    for (const t of TEAMS.filter((x) => x.lg === lg && !usedTeam.has(x.id))) for (const q of out[t.id].players) if (q.starter && q.type === type) list.push({ tid: t.id, p: q });
    list.sort((a, b) => (b.p.role === 'ace') - (a.p.role === 'ace') || (b.p.role === 'core') - (a.p.role === 'core'));
    if (list.length) { const top = list.filter((x) => x.p.role === list[0].p.role); cand = top[Math.floor(rnd() * top.length)]; break; }
  }
  if (!cand) continue;
  usedTeam.add(cand.tid);
  [...TOP[type]].forEach((ch, j) => { const [a, b] = GV[ch]; cand.p[K12[j]] = ri(a, b); });
  cand.p.top = type;
  // 国内屈指は日本人（カタカナの名前なら、D1で使っていないひらがなの名前に）
  if (type === 'ストライカー' && cand.tid === 'tokyo') { const used = new Set(TEAMS.filter((x) => x.lg === 'd1').flatMap((x) => out[x.id].players.map((q) => q.name))); for (const x of TEAMS.filter((y) => y.lg === 'd1')) for (const q of out[x.id].players) if (q.name === 'かとう' && q !== cand.p) q.name = SURNAMES.find((n) => !used.has(n) && n !== 'かとう'); cand.p.name = 'かとう'; }
  if (!/^[ぁ-ゖー]+$/.test(cand.p.name)) { const used = new Set(TEAMS.filter((x) => x.lg === 'd1').flatMap((x) => out[x.id].players.map((q) => q.name))); cand.p.name = SURNAMES.find((n) => !used.has(n)); }
  if (!cand.p.role) cand.p.role = 'core';
  console.log('国内屈指', type, cand.tid, cand.p.name);
}
const js = `// CPUの65チームの監督・方針・ユニフォーム・選手25人（2026-10-08に固定。誰が始めても同じ選手。能力もずっと変わらない）\n(function (root) { root.DOT_ROSTERS = ${JSON.stringify(out)}; })(typeof window !== 'undefined' ? window : globalThis);\n`;
fs.writeFileSync(path.join(__dirname, '..', 'rosters.js'), js);
// 確認用の集計
const g = (v) => (v >= 84 ? 'S' : v >= 74 ? 'A' : v >= 64 ? 'B' : v >= 55 ? 'C' : v >= 45 ? 'D' : 'E');
// リーグごとの、レギュラーの能力ランクの分布
for (const lg of ['regW2', 'regW1', 'd3', 'd2', 'd1']) { const cnt = {}; for (const t of TEAMS.filter((x) => x.lg === lg)) for (const p of out[t.id].players.filter((q) => q.starter)) for (const k of K12) { const gg = g(p[k]); cnt[gg] = (cnt[gg] || 0) + 1; } console.log(lg, JSON.stringify(cnt)); }
for (const id of ['uwajima', 'kurashiki', 'nagasaki', 'okayama', 'tokyo']) { const r = out[id], avg = (p) => Math.round(K12.reduce((a, k) => a + p[k], 0) / 12); console.log(id, r.style, r.formation, 'lvl', r.lvl, 'coach', r.coach.name, r.players.filter((p) => p.starter).map((p) => p.pos + ':' + p.name + ':' + g(avg(p)) + (p.role ? '*' + p.role : '')).join(' ')); }
console.log('bytes', js.length);

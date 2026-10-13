// 育成モードの画面（ホームの街 → クラブハウス → 選手データ／特訓 → スタジアムで試合）
(() => {
  'use strict';
  const D = window.DotSoccer, C = window.DotCareer, A = () => window.__app;
  const $ = (s) => document.querySelector(s);
  const KEY = 'dotsoccer.career.v1';
  const COIN = '<img class="coin-ico" src="icons/coin.png" alt="コイン" draggable="false">';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let save = null, view = 'home', raf = 0, selIdx = 9, cardTab = 'normal';

  // ---------- セーブ ----------
  function load() { try { const s = localStorage.getItem(KEY); if (s) { const o = JSON.parse(s); if (o && o.version === 1) return o; } } catch (e) { /* 保存できない環境 */ } return null; }
  function store() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 無視 */ } }
  function ensure() {
    if (!save) save = load();
    if (!save) { save = C.newCareer(); store(); }
    save.plan = save.plan || { team: 'base', cards: {} };
    save.plan.cards = save.plan.cards || {};
    save.cards = save.cards || { shoot: 3, dribble: 2, pass: 2, tech: 2, dash: 2, run: 2, muscle: 2, defend: 2, tactic: 2, massage: 1 };
    save.spFound = save.spFound || [];
    C.migrate(save);
    save.phase = 'train';
    warm();
  }
  // 画像の先読み：カード・能力マーク・スタッフ・顔を、使う前に読み込んで作っておく（出てくるのが遅れないように）
  let warmed = false; const warmKeep = [];
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   /* 版469：iPhoneは画像のメモリが少ないので、ほかのチームの顔をまとめて先読みしない（足りなくなると絵が「？」になる） */
  function warm() {
    if (warmed) return; warmed = true;
    faceLoad();
    const pre = (u) => { const im = new Image(); im.decoding = 'async'; im.src = u; warmKeep.push(im); };
    const CARD_IDS = Object.keys(C.CARDS || {});
    CARD_IDS.forEach((c) => pre(`cards/${c}.jpg`));
    ['btn_players', 'btn_status', 'btn_change', 'off_kit', 'off_emblem', 'off_name', 'off_retire', 'off_setting', 'off_biz', 'off_team', 'ui_back', 'ui_change', 'ui_next', 'pc_number', 'pc_pos', 'pc_name', 'coin', 'dash', 'defense', 'dribble', 'jump', 'kick', 'mental', 'pass', 'physical', 'speed', 'stamina', 'technique', 'top_mark', 'vision'].forEach((k) => pre(`icons/${k}.png`));
    ['d1', 'd2', 'd3', 'reg1', 'reg2', 'regE1', 'regE2', 'regW1', 'regW2'].forEach((k) => pre(`icons/lg/${k}.png`));
    ['coach', 'secretary'].forEach((k) => pre(`staff/${k}.png`));
    // 自分のチームの顔は、顔の元絵が読めたら少しずつ作っておく
    const t0 = Date.now();
    const mk = () => {
      if (!(faceTotal && faceLoaded >= faceTotal)) { if (Date.now() - t0 < 20000) setTimeout(mk, 120); return; }
      const ps = (save && save.team && save.team.players) || []; let i = 0;
      const step = () => { const end = Math.min(ps.length, i + 3); for (; i < end; i++) { try { facePic(ps[i], ''); facePic(ps[i], '', true); } catch (_) {} } if (i < ps.length) setTimeout(step, 16); };
      step();
      // スター選手の元絵（ほかのチーム）も読み込んでおく
      if (!IOS) setTimeout(() => Object.keys(window.STAR_FACES || {}).forEach((k) => { if (!starImgs[k]) { const L = starImgs[k] = { img: new Image(), n: 0 }; L.img.onload = L.img.onerror = () => { L.n = 1; starFill(); }; L.img.src = `faces/star/${k}.png`; } }), 1500);
    };
    setTimeout(mk, 300);
  }
  // 週 → 月・週（3月から始まり、4週で1か月）
  const cal = (w) => ({ m: ((2 + Math.floor((w - 1) / 4)) % 12) + 1, w: ((w - 1) % 4) + 1 });

  // ---------- 画面の切り替え ----------
  function go(v) {
    if (v === 'assoc') { go('home'); openAssoc({ tab: 'sched' }); return; }   // サッカー協会は全画面
    if (v === 'lineup' && view !== 'lineup') sqFromHome = view === 'home';   // クラブ事務所から来た時だけ、クラブ設定のボタンを出す
    view = v; try { window.DotSound && (DotSound.crowd(false), DotSound.bgm(v === 'home' ? 'home' : liveBack ? 'prematch' : 'club')); } catch (_) {}   /* 版559：試合前（LIVE）から開いたスタメン・戦術は、試合前の曲のまま */   /* 版532：ホームに来たら試合の音を止める */   // 版499：BGM
    try { const cl = C.ensureClub(save); A().applyKits([{ ...cl.kit }, { ...cl.kit2 }]); } catch (_) {}   // 版536：観戦（D1）などで変わったユニフォームを、自分のクラブのものに戻す
    $('#cv-home').hidden = v !== 'home';
    $('#cv-club').hidden = v === 'home';
    $('#cvBack').hidden = v === 'home';
    $('#clubLayer').innerHTML = '';
    $('#clubLayer').className = 'club-layer' + (v === 'club' ? '' : ' on');
    document.querySelector('#cv-club .rbtns').hidden = v !== 'club';
    if (v === 'club') pickDrill();
    if (v === 'club') { const l = document.getElementById('rbLineup'), tt = document.getElementById('rbTac'); if (l) l.innerHTML = rbLineupSVG(); if (tt) tt.innerHTML = RB_TAC_SVG; rbLast = -1; }
    if (v === 'home') renderHome();
    if (v === 'data') renderData();
    if (v === 'train') renderTrain();
    if (v === 'lineup') renderLineup();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    if (window.__tut) window.__tut.onView(v);   // チュートリアル：画面が変わったら次の説明へ
  }
  let liveBack = null, liveSnap = null;   // 試合前の画面（LIVE）からスタメン・戦術を開いたとき、もどる先と、後ろに見せる会場の絵
  $('#cvBack').onclick = () => { if (liveBack) { const f = liveBack; liveBack = null; f(); return; } go(view === 'club' || view === 'assoc' ? 'home' : 'club'); };
  document.querySelectorAll('#cv-club .rbtns button').forEach((b) => b.onclick = () => { const g = b.dataset.go; if (g === 'tactic') { sqTab = 'tac'; go('lineup'); } else { if (g === 'lineup') sqTab = 'pos'; go(g); } });

  // 日付のドット数字（カルチョビットAのような、白くて太い四角い数字に黒いふち）
  const DOT_FONT = { 0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '001', '010', '010'], 8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'] };
  function dotNum(n) {
    const ds = String(n).split(''), cw = 3, gap = 1, W = ds.length * cw + (ds.length - 1) * gap;
    let black = '', white = '';
    ds.forEach((d, i) => DOT_FONT[d].forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') { const X = i * (cw + gap) + x; black += `<rect x="${X - 0.38}" y="${y - 0.38}" width="1.76" height="1.76"/>`; white += `<rect x="${X}" y="${y}" width="1.02" height="1.02"/>`; } })));
    return `<svg class="dotnum" viewBox="-0.6 -0.6 ${W + 1.2} 6.2" style="width:${(W + 1.2) * 8}px"><g fill="#111">${black}</g><g fill="#fff">${white}</g></svg>`;
  }
  // ================= ホーム：街の見下ろし図（カルチョビットAの街に寄せる） =================
  const hc = $('#homeCv'), hx = hc.getContext('2d');
  const TW = 56, TH = 28, TZ = 26, OX = 640, OY = -140;
  const iso = (gx, gy, z = 0) => [OX + (gx - gy) * TW / 2, OY + (gx + gy) * TH / 2 - z * TZ];
  function poly(ctx, pts, fill, stroke, lw) { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); ctx.lineWidth = 1; } }
  const quad = (gx, gy, w, d, z = 0) => [iso(gx, gy, z), iso(gx + w, gy, z), iso(gx + w, gy + d, z), iso(gx, gy + d, z)];
  function box(ctx, gx, gy, w, d, h, top, left, right, z0 = 0, edge) {
    const A0 = iso(gx, gy, z0), B0 = iso(gx + w, gy, z0), C0 = iso(gx + w, gy + d, z0), D0 = iso(gx, gy + d, z0);
    const A1 = iso(gx, gy, z0 + h), B1 = iso(gx + w, gy, z0 + h), C1 = iso(gx + w, gy + d, z0 + h), D1 = iso(gx, gy + d, z0 + h);
    poly(ctx, [D0, C0, C1, D1], left, edge); poly(ctx, [C0, B0, B1, C1], right, edge); poly(ctx, [A1, B1, C1, D1], top, edge);
    return { A1, B1, C1, D1, C0, D0, B0 };
  }
  // 窓の帯（左の面＝手前左、右の面＝手前右）
  function bands(ctx, gx, gy, w, d, h, col, step = 0.42, hgt = 0.16, z0 = 0) {
    for (let z = z0 + 0.25; z < z0 + h - 0.15; z += step) {
      poly(ctx, [iso(gx + 0.08, gy + d, z), iso(gx + w - 0.08, gy + d, z), iso(gx + w - 0.08, gy + d, z + hgt), iso(gx + 0.08, gy + d, z + hgt)], col);
      poly(ctx, [iso(gx + w, gy + d - 0.08, z), iso(gx + w, gy + 0.08, z), iso(gx + w, gy + 0.08, z + hgt), iso(gx + w, gy + d - 0.08, z + hgt)], col);
    }
  }
  // 木：丸い樹冠（カルチョビットAの、ころんとした木）
  // 版478：季節（3〜5月＝春、6〜8月＝夏、9〜11月＝秋、12〜2月＝冬）で街の色が変わる
  const SEASON_PAL = {
    spring: { ground: '#4cc63a', road: '#72e05e', lot: '#42b832', lot2: '#3fb42e', park: '#62d052', park2: '#58cc48', bld: ['#a4f0b2', '#62d27e', '#50c46c'], trees: [['#f7a8c8', '#ffd0e2'], ['#f39abd', '#ffc6dc'], ['#1f8f30', '#34ab44']], field: '#8ee278' },
    summer: { ground: '#2fb526', road: '#5ad646', lot: '#2aa820', lot2: '#27a41e', park: '#4cc63c', park2: '#42c232', bld: ['#93eda4', '#55cf73', '#44bf62'], trees: [['#0f7a22', '#1f9a32'], ['#13822a', '#24a238']], field: '#7cdc62' },
    autumn: { ground: '#9fbf3a', road: '#c8d872', lot: '#93b434', lot2: '#8eae30', park: '#b0c85a', park2: '#a8c250', bld: ['#f0e2b0', '#d2b070', '#c09a5a'], trees: [['#e2541e', '#f47a3a'], ['#f0a020', '#ffc04a'], ['#c8321e', '#e45a3a'], ['#d8b020', '#f0d04a']], field: '#a8d070' },
    winter: { ground: '#e6eef2', road: '#c4d0d8', lot: '#dce6ec', lot2: '#d6e2e8', park: '#cfdae2', park2: '#c8d4dc', bld: ['#ffffff', '#aebdcc', '#c2cfdc'], trees: [['#e8f0f2', '#ffffff'], ['#dbe6ea', '#f6fafb']], field: '#dfe9ee', snow: true },
  };
  const seasonOfMonth = (m) => (m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter');
  const SEASON_JP = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  let seasonNow = 'spring';
  const SP = () => SEASON_PAL[seasonNow] || SEASON_PAL.spring;
  function tree(ctx, gx, gy, s = 1) {
    const [x, y] = iso(gx, gy), P = SP(), tc = P.trees[Math.abs(Math.round(gx * 7 + gy * 13)) % P.trees.length];
    ctx.fillStyle = P.snow ? 'rgba(80,100,120,0.18)' : 'rgba(0,60,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y, 11 * s, 5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6b4a24'; ctx.fillRect(x - 2, y - 10 * s, 4, 10 * s);
    if (P.snow) { ctx.strokeStyle = '#6b4a24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 9 * s); ctx.lineTo(x - 8 * s, y - 30 * s); ctx.moveTo(x, y - 14 * s); ctx.lineTo(x + 9 * s, y - 34 * s); ctx.moveTo(x, y - 9 * s); ctx.lineTo(x + 1 * s, y - 40 * s); ctx.stroke(); ctx.lineWidth = 1; }
    ctx.fillStyle = tc[0]; ctx.beginPath(); ctx.ellipse(x, y - 25 * s, 11 * s, 19 * s, 0, 0, 7); if (P.snow) { ctx.globalAlpha = 0.85; ctx.ellipse(x, y - 25 * s, 11 * s, 19 * s, 0, 0, 7); } ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = tc[1]; ctx.beginPath(); ctx.ellipse(x - 3.5 * s, y - 28 * s, 6 * s, 13 * s, 0, 0, 7); ctx.fill();
  }
  // 車（白い小さな車）
  function car(ctx, gx, gy, rot) {
    const w = rot ? 0.3 : 0.55, d = rot ? 0.55 : 0.3;
    box(ctx, gx, gy, w, d, 0.18, '#ffffff', '#d4d8dc', '#e6e9ec');
    box(ctx, gx + w * 0.2, gy + d * 0.2, w * 0.6, d * 0.6, 0.12, '#cfe0f0', '#8aa2b8', '#a8bccd', 0.18);
  }
  function label(ctx, x, y, a, b) {
    ctx.font = '900 17px "Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif';
    ctx.textAlign = 'center';
    const w = Math.max(ctx.measureText(a).width, b ? ctx.measureText(b).width * 0.92 : 0) + 16, h = b ? 46 : 28;
    ctx.fillStyle = '#121212'; roundRect(ctx, x - w / 2, y - h, w, h, 5); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; roundRect(ctx, x - w / 2 + 3, y - h + 3, w - 6, h - 6, 3); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#fff'; ctx.fillText(a, x, y - h + 21);
    if (b) { ctx.font = '800 15px "Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif'; ctx.fillText(b, x, y - 9); }
    return { x: x - w / 2, y: y - h, w, h };
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  let hot = [];   // クリックできる建物
  function seeded(n) { let s = n; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  // 動かない街並みは一度だけ描いて取っておく（毎フレーム描くのは旗だけ）
  let townCv = null, townHot = [];
  // 建物の絵が占める範囲（クリックできる場所）：底面と高さの8つの角を囲む四角
  function areaOf(gx, gy, w, d, h) {
    const pts = []; for (const [a, b] of [[0, 0], [w, 0], [w, d], [0, d]]) for (const z of [0, h]) pts.push(iso(gx + a, gy + b, z));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  const ST = { gx: 14.6, gy: 25.0, w: 9.2, d: 6.4 };   // スタジアムの位置
  function buildTown(view) {
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
    const c = cv.getContext('2d');
    if (view) c.setTransform(view.s, 0, 0, view.s, -view.x * view.s, -view.y * view.s);   // 一部分を大きく描く（秘書の場面の背景）
    // 地面と道（道は少し明るい緑の帯）
    const PS = SP(); c.fillStyle = PS.ground; c.fillRect(0, 0, 1280, 720);
    const G0 = -8, G1 = 44;
    const roadX = (gx, w) => { poly(c, [iso(gx, G0), iso(gx + w, G0), iso(gx + w, G1), iso(gx, G1)], PS.road); poly(c, [iso(gx + 0.08, G0), iso(gx + w - 0.08, G0), iso(gx + w - 0.08, G1), iso(gx + 0.08, G1)], null, 'rgba(255,255,255,0.12)'); };
    const roadY = (gy, w) => { poly(c, [iso(G0, gy), iso(G1, gy), iso(G1, gy + w), iso(G0, gy + w)], PS.road); poly(c, [iso(G0, gy + 0.08), iso(G1, gy + 0.08), iso(G1, gy + w - 0.08), iso(G0, gy + w - 0.08)], null, 'rgba(255,255,255,0.12)'); };
    // 区画（少し濃い緑の敷地）
    const lot = (gx, gy, w, d, col) => poly(c, quad(gx, gy, w, d), col || PS.lot);
    lot(13, 6.5, 7.5, 6.8); lot(23.8, 9.2, 6.4, 5.2); lot(27.6, 18.6, 5, 4.4); lot(9.2, 24.6, 15.8, 8, PS.lot2);
    roadX(12.0, 1.0); roadX(22.6, 1.0); roadX(33.2, 1.0); roadY(4.8, 1.0); roadY(15.6, 1.1); roadY(23.4, 1.0);
    // 駐車場（スタジアムの左）
    poly(c, quad(9.6, 25.0, 4.6, 6.8), PS.park);
    for (let k = 0; k < 6; k++) poly(c, [iso(9.9, 25.7 + k * 1.05), iso(13.9, 25.7 + k * 1.05)], null, 'rgba(255,255,255,0.6)', 1.5);
    poly(c, quad(26.8, 22.2, 4.4, 1.0), PS.park2);
    const objs = [], labels = [];
    const add = (k, f) => objs.push({ k, f });
    // 街のビル（淡い緑の小さなビルが集まった街区）
    const r = seeded(11);
    const clusters = [[5.5, 3.5, 5, 3], [8, 8.5, 3.5, 5], [14, -1.5, 6, 5], [24, -0.5, 7, 4], [29.5, 6, 3.5, 4], [35, 9, 4, 6], [35.5, 18, 4, 5], [28, 26, 5, 3], [4, 17, 6, 5], [17.2, 17.4, 4.5, 4.5], [3, 25, 4, 4], [24.5, 33.5, 6, 4]];
    for (const [bx, by, cw, cd] of clusters) {
      for (let i = 0; i < cw; i += 1.25) for (let j = 0; j < cd; j += 1.25) {
        if (r() < 0.18) continue;
        const w = 0.8 + r() * 0.4, d = 0.8 + r() * 0.4, h = 0.5 + r() * 1.3, gx = bx + i + r() * 0.15, gy = by + j + r() * 0.15;
        const onRoad = [12, 22.6, 33.2].some((x) => gx < x + 1.05 && gx + w > x - 0.05) || [4.8, 15.6, 23.4].some((y) => gy < y + 1.1 && gy + d > y - 0.05);
        if (onRoad) continue;
        add(gx + w + gy + d, () => { box(c, gx, gy, w, d, h, PS.bld[0], PS.bld[1], PS.bld[2]); bands(c, gx, gy, w, d, h, 'rgba(255,255,255,0.22)', 0.34, 0.1); });
      }
    }
    // 木（道ぞいと街区のまわり）
    const trees = [[11.6, 2], [11.6, 6.5], [11.6, 11], [11.6, 14.5], [12.2, 18.5], [13.5, 22.6], [9, 22.8], [7, 13.5], [21.8, 6], [22.2, 9.5], [21.6, 13.5], [24.5, 15], [27.5, 15], [30.5, 14.8], [33, 16.4], [24, 17.5], [24.2, 20.5], [24, 24.5], [26.2, 24.6], [31.5, 23.8], [33, 22], [28, 8.3], [31.6, 9.5], [32.8, 13], [19.5, 4.2], [16, 4.2], [9.4, 18.8], [20.2, 15.2], [17.5, 15.2], [14.6, 14.9], [6.5, 21.6], [8.7, 25.4], [15.2, 31.8], [21.5, 31.6], [26, 29.5], [34.5, 26], [29.5, 28.5], [13, 33]];
    for (const [tx, ty] of trees) add(tx + ty + 0.4, () => tree(c, tx, ty, 0.85 + ((tx * 7 + ty * 3) % 5) * 0.06));
    // ---------- スタジアム（左下）：四方のスタンド、青い屋根、大きなスコアボード ----------
    const { gx: sx, gy: sy, w: sw, d: sd } = ST, sh = 1.4, t0 = 1.15;
    add(sx + sy + sw + sd - 2, () => {
      const G = ['#d2d2d2', '#9c9c9c', '#b8b8b8'];
      // ピッチ
      poly(c, quad(sx, sy, sw, sd, 0.02), '#6c6c6c');
      poly(c, quad(sx + t0, sy + t0, sw - 2 * t0, sd - 2 * t0, 0.05), '#62d24e');
      for (let k = 0; k < 6; k++) if (k % 2) poly(c, quad(sx + t0 + k * (sw - 2 * t0) / 6, sy + t0, (sw - 2 * t0) / 6, sd - 2 * t0, 0.05), '#6fdb5a');
      const px = sx + t0 + 0.2, py = sy + t0 + 0.2, pw = sw - 2 * t0 - 0.4, pd = sd - 2 * t0 - 0.4, W = 'rgba(255,255,255,0.9)';
      poly(c, quad(px, py, pw, pd, 0.06), null, W, 1.6);
      c.strokeStyle = W; c.lineWidth = 1.6; c.beginPath(); c.moveTo(...iso(px + pw / 2, py, 0.06)); c.lineTo(...iso(px + pw / 2, py + pd, 0.06)); c.stroke();
      c.beginPath(); for (let a = 0; a <= 32; a++) { const [x, y] = iso(px + pw / 2 + Math.cos(a / 32 * 6.283) * 0.55, py + pd / 2 + Math.sin(a / 32 * 6.283) * 0.55, 0.06); a ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      poly(c, quad(px, py + pd / 2 - 0.9, 0.75, 1.8, 0.06), null, W, 1.6); poly(c, quad(px + pw - 0.75, py + pd / 2 - 0.9, 0.75, 1.8, 0.06), null, W, 1.6);
      c.lineWidth = 1;
      // 奥のスタンド（長い側）と左右のスタンド
      const stand = (gx, gy, w, d) => { box(c, gx, gy, w, d, sh, G[0], G[1], G[2]); };
      stand(sx, sy, sw, t0);                      // 奥
      stand(sx, sy, t0, sd);                      // 左（スコアボード側）
      // 出入り口（スタンドの上の黒い四角）
      const hole = (gx, gy, w, d) => poly(c, quad(gx, gy, w, d, sh + 0.001), '#2a2a2a');
      for (let k = 0; k < 5; k++) hole(sx + 1.5 + k * 1.5, sy + 0.4, 0.5, 0.32);
      for (let k = 0; k < 2; k++) hole(sx + 0.4, sy + 1.9 + k * 2.0, 0.32, 0.5);
      // 大きなスコアボード（左奥）
      box(c, sx + 0.15, sy + 1.3, 0.4, 3.2, 2.5, '#3a3a3a', '#1a1a1a', '#2c2c2c', sh);
      poly(c, [iso(sx + 0.55, sy + 1.45, sh + 0.35), iso(sx + 0.55, sy + 4.35, sh + 0.35), iso(sx + 0.55, sy + 4.35, sh + 2.3), iso(sx + 0.55, sy + 1.45, sh + 2.3)], '#202a22');
      stand(sx + sw - t0, sy, t0, sd);            // 右
      for (let k = 0; k < 2; k++) hole(sx + sw - t0 + 0.45, sy + 1.9 + k * 2.0, 0.32, 0.5);
      // 手前のスタンド（青い屋根つき）
      stand(sx, sy + sd - t0, sw, t0);
      for (let k = 0; k < 5; k++) hole(sx + 1.5 + k * 1.5, sy + sd - t0 + 0.42, 0.5, 0.32);
      // 屋根：手前（外）が低く、ピッチ側が高い。柱で支える
      const rz0 = sh + 0.8, rz1 = sh + 1.25, ry0 = sy + sd + 0.25, ry1 = sy + sd - t0 + 0.45;
      for (let k = 0; k <= 6; k++) { const gx = sx + 0.4 + k * (sw - 0.8) / 6; c.fillStyle = '#7d7d7d'; const [x0, y0] = iso(gx, ry0, 0), [, y1] = iso(gx, ry0, rz0); c.fillRect(x0 - 2, y1, 4, y0 - y1); }
      poly(c, [iso(sx - 0.1, ry1, rz1), iso(sx + sw + 0.1, ry1, rz1), iso(sx + sw + 0.1, ry0, rz0), iso(sx - 0.1, ry0, rz0)], '#4f97d2', 'rgba(20,60,110,0.6)');
      for (let k = 1; k < 10; k++) { const gx = sx - 0.1 + k * (sw + 0.2) / 10; c.strokeStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(...iso(gx, ry1, rz1)); c.lineTo(...iso(gx, ry0, rz0)); c.stroke(); }
      poly(c, [iso(sx + sw + 0.1, ry1, rz1), iso(sx + sw + 0.1, ry0, rz0), iso(sx + sw + 0.1, ry0, rz0 - 0.12), iso(sx + sw + 0.1, ry1, rz1 - 0.12)], '#2f6ea6');
      poly(c, [iso(sx - 0.1, ry0, rz0), iso(sx + sw + 0.1, ry0, rz0), iso(sx + sw + 0.1, ry0, rz0 - 0.12), iso(sx - 0.1, ry0, rz0 - 0.12)], '#3a80bd');
      const [lx, ly] = iso(sx + 1.2, sy + sd + 1.6);
      labels.push(() => townHot.push({ go: 'stadium', r: label(c, lx - 20, ly + 18, 'スタジアム', '試合会場') }));
      townHot.push({ go: 'stadium', area: true, r: areaOf(sx, sy, sw, sd + 0.3, 3.9) });
    });
    // 駐車場の車
    const pr = seeded(5);
    for (let k = 0; k < 6; k++) for (let j = 0; j < 6; j++) if (pr() < 0.62) { const gx = 10.1 + j * 0.62, gy = 25.8 + k * 1.05; add(gx + gy, () => car(c, gx, gy, false)); }
    // ---------- クラブハウス（上）：練習グラウンド・照明・赤い屋根の建物 ----------
    add(13.6 + 7.6, () => {
      poly(c, quad(13.6, 7.4, 5.2, 3.6, 0.02), PS.field);
      poly(c, quad(13.9, 7.7, 4.6, 3.0, 0.03), null, 'rgba(255,255,255,0.9)', 1.6);
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(...iso(16.2, 7.7, 0.03)); c.lineTo(...iso(16.2, 10.7, 0.03)); c.stroke(); c.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const [x, y] = iso(14.6 + k * 0.55, 8.6 + (k % 2) * 0.9, 0.03); c.fillStyle = '#e23b2b'; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 4, y); c.lineTo(x - 4, y); c.closePath(); c.fill(); }
    });
    const pole = (gx, gy) => add(gx + gy + 0.01, () => { const [x, y] = iso(gx, gy), [, yt] = iso(gx, gy, 3.1); c.fillStyle = '#c8c8c8'; c.fillRect(x - 1.5, yt, 3, y - yt); c.fillStyle = '#f2f2f2'; c.fillRect(x - 8, yt - 9, 16, 10); c.fillStyle = '#9aa'; for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) c.fillRect(x - 7 + a * 5, yt - 8 + b * 5, 4, 3); });
    pole(13.5, 7.3); pole(18.9, 7.3); pole(13.5, 11.1); pole(18.9, 11.1);
    add(17.4 + 10.6 + 3, () => {
      box(c, 17.2, 10.4, 2.2, 1.4, 0.75, '#f4f4f4', '#d9d9d9', '#ffffff');
      bands(c, 17.2, 10.4, 2.2, 1.4, 0.75, 'rgba(90,120,170,0.55)', 0.4, 0.14);
      // 切妻の赤い屋根
      const a = iso(17.1, 10.3, 0.75), b = iso(19.5, 10.3, 0.75), cc2 = iso(19.5, 11.9, 0.75), d = iso(17.1, 11.9, 0.75), m1 = iso(17.1, 11.1, 1.25), m2 = iso(19.5, 11.1, 1.25);
      poly(c, [a, b, m2, m1], '#c8392d'); poly(c, [m1, m2, cc2, d], '#e8503f'); poly(c, [b, cc2, m2], '#f0f0f0');
      labels.push(() => { const [x, y] = iso(15.8, 6.6, 2.2); townHot.push({ go: 'club', r: label(c, x + 30, y, 'クラブハウス', '選手データ・特訓') }); });
      townHot.push({ go: 'club', area: true, r: areaOf(13.4, 7.2, 6.1, 5.0, 1.4) });
    });
    for (let k = 0; k < 5; k++) { const gx = 17.4 + k * 0.45; add(gx + 12.4, () => car(c, gx, 12.3, true)); }
    // ---------- サッカー協会（右）：ガラスのタワー（屋上にボール）＋白い低層棟＋丸い玄関 ----------
    add(25 + 10.4 + 2.6, () => {
      const tx0 = 25.0, ty0 = 10.4, tw = 1.3, td = 1.3, th = 4.3;
      box(c, tx0, ty0, tw, td, th, '#eef3f8', '#4f77b8', '#7fa2d6');
      // ガラスの横じま（窓）と、白い縦の柱
      bands(c, tx0, ty0, tw, td, th, 'rgba(25,50,100,0.55)', 0.3, 0.13);
      for (let u = 0; u <= 3; u++) {
        const g = tx0 + u * tw / 3; c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(...iso(g, ty0 + td, 0)); c.lineTo(...iso(g, ty0 + td, th)); c.stroke();
        const h2 = ty0 + u * td / 3; c.beginPath(); c.moveTo(...iso(tx0 + tw, h2, 0)); c.lineTo(...iso(tx0 + tw, h2, th)); c.stroke(); c.lineWidth = 1;
      }
      // 屋上の台とサッカーボール
      box(c, tx0 + 0.45, ty0 + 0.45, 0.4, 0.4, 0.25, '#ffffff', '#cfd6de', '#e3e8ee', th);
      const [bx, by] = iso(tx0 + 0.65, ty0 + 0.65, th + 0.25);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by - 13, 14, 0, 7); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 2; c.stroke(); c.lineWidth = 1;
      c.fillStyle = '#222'; c.beginPath(); for (let a = 0; a < 5; a++) { const an = -Math.PI / 2 + a * 1.2566; c.lineTo(bx + Math.cos(an) * 5, by - 13 + Math.sin(an) * 5); } c.closePath(); c.fill();
      for (let a = 0; a < 5; a++) { const an = -Math.PI / 2 + a * 1.2566; c.beginPath(); c.arc(bx + Math.cos(an) * 11.5, by - 13 + Math.sin(an) * 11.5, 2.5, 0, 7); c.fill(); }
      // 丸い玄関（タワーの手前左の足もと）
      const [ex, ey] = iso(25.45, 12.05, 0), [, eyt] = iso(25.45, 12.05, 0.75), rx = 18, ry = 9;
      c.fillStyle = '#3a78c2'; c.beginPath(); c.ellipse(ex, ey, rx, ry, 0, 0, Math.PI); c.lineTo(ex - rx, eyt); c.ellipse(ex, eyt, rx, ry, 0, Math.PI, 0, true); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(ex - rx, eyt + 6, rx * 2, 4); c.fillRect(ex - rx, eyt + 14, rx * 2, 3);
      c.fillStyle = '#a9cff2'; c.beginPath(); c.ellipse(ex, eyt, rx, ry, 0, 0, 7); c.fill();
      c.strokeStyle = '#2b5f9e'; c.beginPath(); c.ellipse(ex, eyt, rx, ry, 0, 0, 7); c.stroke();
      // 白い低層棟（タワーの右手前）：あとから描いて手前に
      box(c, 26.3, 10.9, 2.5, 1.7, 1.45, '#f4f7fa', '#d3dbe4', '#e6ecf2');
      bands(c, 26.3, 10.9, 2.5, 1.7, 1.45, 'rgba(50,100,175,0.85)', 0.34, 0.16);
      labels.push(() => { const [x, y] = iso(24.2, 13.4, 1.4); townHot.push({ go: 'assoc', r: label(c, x - 80, y + 46, 'サッカー協会', '日程・順位') }); });
      townHot.push({ go: 'assoc', area: true, r: areaOf(24.8, 10.3, 4.2, 2.5, 5.2) });
    });
    for (let k = 0; k < 5; k++) { const gx = 27 + k * 0.7; add(gx + 13.4, () => car(c, gx, 13.3, false)); }
    // ---------- クラブ事務所（右下）：茶色いビル ----------
    add(28.4 + 19.5 + 4, () => {
      box(c, 28.4, 19.4, 2.4, 1.7, 1.75, '#dedede', '#b06a3a', '#c98250');
      bands(c, 28.4, 19.4, 2.4, 1.7, 1.75, 'rgba(50,80,140,0.75)', 0.42, 0.16);
      box(c, 29.1, 19.9, 0.6, 0.5, 0.18, '#f0f0f0', '#c8c8c8', '#dcdcdc', 1.75);
      box(c, 30.0, 20.2, 0.5, 0.5, 0.14, '#f0f0f0', '#c8c8c8', '#dcdcdc', 1.75);
      labels.push(() => { const [x, y] = iso(31.6, 21.6, 0); townHot.push({ go: 'lineup', r: label(c, x + 70, y + 6, 'クラブ事務所', 'チーム編成') }); });
      townHot.push({ go: 'lineup', area: true, r: areaOf(28.3, 19.3, 2.6, 1.9, 2.0) });
    });
    for (let k = 0; k < 5; k++) { const gx = 27 + k * 0.75; add(gx + 22.5, () => car(c, gx, 22.4, false)); }
    // ---------- ショップ（カード・コイン）：赤白のひさしの小さなお店 ----------
    add(25.6 + 24.6 + 3, () => {
      box(c, 25.6, 24.8, 1.6, 1.3, 0.85, '#fff4cc', '#e9c46a', '#f3d27a');
      for (let k = 0; k < 6; k++) poly(c, [iso(25.6 + k * 0.267, 26.1, 0.85), iso(25.6 + (k + 1) * 0.267, 26.1, 0.85), iso(25.6 + (k + 1) * 0.267, 26.45, 0.55), iso(25.6 + k * 0.267, 26.45, 0.55)], k % 2 ? '#fff' : '#e8463a');
      box(c, 25.5, 24.7, 1.8, 1.5, 0.12, '#e8463a', '#c0362c', '#d23e33', 0.85);
      labels.push(() => { const [x, y] = iso(26.4, 25.2, 1.2); townHot.push({ go: 'shop', r: label(c, x + 20, y - 18, 'ショップ', 'カード・コイン') }); });
      townHot.push({ go: 'shop', area: true, r: areaOf(25.4, 24.6, 2.0, 1.9, 1.1) });
    });
    const keepHot = townHot;
    townHot = [];
    objs.sort((a, b) => a.k - b.k).forEach((o) => o.f());
    if (view) { townHot = keepHot; return cv; }
    labels.forEach((f) => f());   // 名前の札は最後に、いちばん手前へ
    townCv = cv;
  }
  // ---------- エンブレム（盾・丸・紋章の形に、チームの色・模様・頭文字・マーク） ----------
  function emblemPath(ctx, x, y, s, shape) {
    ctx.beginPath();
    if (shape === 1) { ctx.arc(x, y, s * 0.5, 0, 7); return; }
    if (shape === 3) { ctx.moveTo(x, y - s * 0.52); ctx.lineTo(x + s * 0.46, y); ctx.lineTo(x, y + s * 0.52); ctx.lineTo(x - s * 0.46, y); ctx.closePath(); return; }   // ひし形
    if (shape === 4) { for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * s * 0.52, y + Math.sin(a) * s * 0.52); } ctx.closePath(); return; }   // 六角形
    if (shape === 5) { ctx.moveTo(x - s * 0.42, y - s * 0.48); ctx.lineTo(x + s * 0.42, y - s * 0.48); ctx.lineTo(x + s * 0.42, y + s * 0.2); ctx.lineTo(x, y + s * 0.52); ctx.lineTo(x - s * 0.42, y + s * 0.2); ctx.closePath(); return; }   // 旗（ペナント）形
    if (shape === 2) { ctx.moveTo(x - s * 0.46, y - s * 0.42); ctx.lineTo(x - s * 0.16, y - s * 0.5); ctx.lineTo(x, y - s * 0.4); ctx.lineTo(x + s * 0.16, y - s * 0.5); ctx.lineTo(x + s * 0.46, y - s * 0.42); ctx.lineTo(x + s * 0.44, y + s * 0.08); ctx.quadraticCurveTo(x + s * 0.36, y + s * 0.38, x, y + s * 0.52); ctx.quadraticCurveTo(x - s * 0.36, y + s * 0.38, x - s * 0.44, y + s * 0.08); ctx.closePath(); return; }
    ctx.moveTo(x - s * 0.44, y - s * 0.48); ctx.lineTo(x + s * 0.44, y - s * 0.48); ctx.lineTo(x + s * 0.44, y + s * 0.05); ctx.quadraticCurveTo(x + s * 0.4, y + s * 0.36, x, y + s * 0.52); ctx.quadraticCurveTo(x - s * 0.4, y + s * 0.36, x - s * 0.44, y + s * 0.05); ctx.closePath();
  }
  function drawIcon(ctx, x, y, r, icon, col) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = r * 0.18;
    if (icon === 'ball') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = r * 0.12; ctx.stroke(); ctx.fillStyle = '#222'; ctx.beginPath(); for (let a = 0; a < 5; a++) { const an = -Math.PI / 2 + a * 1.2566; ctx.lineTo(Math.cos(an) * r * 0.38, Math.sin(an) * r * 0.38); } ctx.fill(); for (let a = 0; a < 5; a++) { const an = -Math.PI / 2 + a * 1.2566; ctx.beginPath(); ctx.arc(Math.cos(an) * r * 0.86, Math.sin(an) * r * 0.86, r * 0.2, 0, 7); ctx.fill(); } }
    else if (icon === 'star') { ctx.beginPath(); for (let a = 0; a < 10; a++) { const an = -Math.PI / 2 + a * Math.PI / 5, rr = a % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); }
    else if (icon === 'wave') { for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(-r, k * r * 0.6 - r * 0.2); for (let u = 0; u <= 8; u++) ctx.lineTo(-r + u * r / 4, k * r * 0.6 - r * 0.2 + Math.sin(u * 1.6) * r * 0.25); ctx.stroke(); } }
    else if (icon === 'crown') { ctx.beginPath(); ctx.moveTo(-r, r * 0.5); ctx.lineTo(-r, -r * 0.3); ctx.lineTo(-r * 0.5, r * 0.1); ctx.lineTo(0, -r * 0.6); ctx.lineTo(r * 0.5, r * 0.1); ctx.lineTo(r, -r * 0.3); ctx.lineTo(r, r * 0.5); ctx.closePath(); ctx.fill(); }
    else if (icon === 'bolt') { ctx.beginPath(); ctx.moveTo(r * 0.2, -r); ctx.lineTo(-r * 0.55, r * 0.15); ctx.lineTo(-r * 0.05, r * 0.15); ctx.lineTo(-r * 0.25, r); ctx.lineTo(r * 0.55, -r * 0.2); ctx.lineTo(r * 0.05, -r * 0.2); ctx.closePath(); ctx.fill(); }
    else if (icon === 'sun') { ctx.beginPath(); ctx.arc(0, 0, r * 0.48, 0, 7); ctx.fill(); for (let a = 0; a < 8; a++) { const an = a * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * 0.62, Math.sin(an) * r * 0.62); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); ctx.stroke(); } }
    else if (icon === 'mountain') { ctx.beginPath(); ctx.moveTo(-r, r * 0.6); ctx.lineTo(-r * 0.25, -r * 0.7); ctx.lineTo(r * 0.15, 0); ctx.lineTo(r * 0.45, -r * 0.35); ctx.lineTo(r, r * 0.6); ctx.closePath(); ctx.fill(); }
    else if (icon === 'flame') { ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.9, -r * 0.1, r * 0.55, r * 0.55); ctx.quadraticCurveTo(r * 0.3, r, 0, r); ctx.quadraticCurveTo(-r * 0.3, r, -r * 0.55, r * 0.55); ctx.quadraticCurveTo(-r * 0.75, 0, -r * 0.2, -r * 0.35); ctx.quadraticCurveTo(-r * 0.1, -r * 0.7, 0, -r); ctx.fill(); }
    else if (icon === 'leaf') { ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.8); ctx.quadraticCurveTo(-r * 0.9, -r * 0.6, r * 0.85, -r * 0.85); ctx.quadraticCurveTo(r * 0.6, r * 0.9, -r * 0.8, r * 0.8); ctx.fill(); }
    else if (icon === 'castle') { ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.7); ctx.lineTo(-r * 0.8, -r * 0.5); ctx.lineTo(-r * 0.5, -r * 0.5); ctx.lineTo(-r * 0.5, -r * 0.25); ctx.lineTo(-r * 0.15, -r * 0.25); ctx.lineTo(-r * 0.15, -r * 0.8); ctx.lineTo(r * 0.15, -r * 0.8); ctx.lineTo(r * 0.15, -r * 0.25); ctx.lineTo(r * 0.5, -r * 0.25); ctx.lineTo(r * 0.5, -r * 0.5); ctx.lineTo(r * 0.8, -r * 0.5); ctx.lineTo(r * 0.8, r * 0.7); ctx.closePath(); ctx.fill(); }
    else if (icon === 'heart') { ctx.beginPath(); ctx.moveTo(0, r * 0.85); ctx.bezierCurveTo(-r * 1.2, 0, -r * 0.6, -r * 1.0, 0, -r * 0.35); ctx.bezierCurveTo(r * 0.6, -r * 1.0, r * 1.2, 0, 0, r * 0.85); ctx.fill(); }
    else if (icon === 'none') { /* マークなし */ }
    else { ctx.beginPath(); ctx.moveTo(-r, r * 0.3); ctx.quadraticCurveTo(-r * 0.2, -r * 1.1, r, -r * 0.6); ctx.quadraticCurveTo(r * 0.1, -r * 0.2, r * 0.5, r * 0.1); ctx.quadraticCurveTo(-r * 0.1, r * 0.05, -r, r * 0.3); ctx.fill(); }
    ctx.restore();
  }
  function drawEmblem(ctx, x, y, s, lk) {
    ctx.save();
    emblemPath(ctx, x, y, s, lk.shape); ctx.fillStyle = lk.c1; ctx.fill();
    ctx.clip();
    ctx.fillStyle = lk.c2;
    if (lk.pat === 0) for (let k = -2; k <= 2; k += 2) ctx.fillRect(x + k * s * 0.11 - s * 0.055, y - s * 0.6, s * 0.11, s * 1.2);   // 縦じま
    else if (lk.pat === 1) ctx.fillRect(x, y - s * 0.6, s * 0.6, s * 1.2);                                                             // 左右で2色
    else if (lk.pat === 2) { ctx.beginPath(); ctx.moveTo(x - s * 0.6, y + s * 0.3); ctx.lineTo(x + s * 0.6, y - s * 0.5); ctx.lineTo(x + s * 0.6, y - s * 0.2); ctx.lineTo(x - s * 0.6, y + s * 0.6); ctx.fill(); }   // ななめの帯
    else if (lk.pat === 4) { /* 無地 */ }
    else if (lk.pat === 5) { ctx.fillRect(x - s * 0.09, y - s * 0.6, s * 0.18, s * 1.2); ctx.fillRect(x - s * 0.6, y - s * 0.02, s * 1.2, s * 0.18); }   // 十字
    else ctx.fillRect(x - s * 0.6, y + s * 0.02, s * 1.2, s * 0.16);                                                                    // 横の帯
    // 上の帯と頭文字
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - s * 0.6, y - s * 0.6, s * 1.2, s * 0.3);
    ctx.restore();
    const c3 = lk.c3 || '#fff';
    ctx.fillStyle = c3; ctx.font = `900 ${Math.round(s * (String(lk.ch || '').length > 1 ? 0.15 : 0.2))}px "Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lk.ch || '', x, y - s * 0.33 + (lk.shape === 1 || lk.shape === 3 || lk.shape === 4 ? s * 0.07 : 0)); ctx.textBaseline = 'alphabetic';
    drawIcon(ctx, x, y + s * 0.12, s * 0.2, lk.icon, c3);
    emblemPath(ctx, x, y, s, lk.shape); ctx.lineWidth = Math.max(2, s * 0.05); ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = Math.max(1, s * 0.02); ctx.strokeStyle = '#1a1a1a'; ctx.stroke(); ctx.lineWidth = 1;
  }
  // 試合当日の大きな旗（カルチョビットAのように、透けた布に両チームのエンブレム）
  const bannerCache = new Map();
  function bannerTex(lk, key) {
    if (bannerCache.has(key)) return bannerCache.get(key);
    const cv = document.createElement('canvas'); cv.width = 150; cv.height = 140; const c = cv.getContext('2d');
    c.fillStyle = 'rgba(255,255,255,0.62)'; c.fillRect(0, 0, 150, 140);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, 0, 150, 8);
    const im = lk && !lk.me && lk.id ? embImg(lk.id) : null;
    if (im && !im.complete) { drawEmblem(c, 75, 72, 108, lk); return cv; }   // 画像の読み込み中は仮の絵（キャッシュしない）
    if (im && im.naturalWidth) c.drawImage(im, 75 - 56, 72 - 56, 112, 112); else drawEmblem(c, 75, 72, 108, lk);
    bannerCache.set(key, cv); return cv;
  }
  function bigBanner(ctx, tex, x, y, t, ph) {
    // 縦に細く切って、少しずつずらして「なびく」
    const W = tex.width, H = tex.height;
    for (let i = 0; i < W; i += 3) { const dy = Math.sin(t * 2.4 + ph + i / 22) * 5 + Math.sin(t * 1.3 + ph * 2 + i / 50) * 3; ctx.drawImage(tex, i, 0, 3, H, x + i, y + dy, 3, H); }   // 風にあおられて、布全体がゆれる
  }
  // 試合の週：スタジアムに旗が立つ（風になびく）
  function flag(ctx, x, y, t, col, ph, big) {
    const L = big ? 30 : 18, H = big ? 18 : 11, hp = big ? 46 : 28;
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x - 1, y - hp, 2, hp);
    ctx.beginPath(); ctx.moveTo(x + 1, y - hp);
    for (let k = 0; k <= 6; k++) { const u = k / 6; ctx.lineTo(x + 1 + u * L, y - hp + Math.sin(t * 5 + ph + u * 4) * 2.5 * u); }
    for (let k = 6; k >= 0; k--) { const u = k / 6; ctx.lineTo(x + 1 + u * L, y - hp + H + Math.sin(t * 5 + ph + u * 4) * 2.5 * u); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  function isMatchWeek() { if (!save) return false; const fx = C.nextFixture(save); return !!(fx && fx.week <= save.week && !C.campState(save)); }
  // 季節の舞うもの：春＝桜の花びら、夏＝日ざし、秋＝落ち葉、冬＝雪
  function seasonFx(c, t) {
    const sn = seasonNow;
    if (sn === 'summer') { const g = c.createRadialGradient(1180, -40, 20, 1180, -40, 520); g.addColorStop(0, 'rgba(255,250,200,0.55)'); g.addColorStop(1, 'rgba(255,240,160,0)'); c.fillStyle = g; c.fillRect(600, 0, 680, 560); c.fillStyle = 'rgba(255,200,80,0.05)'; c.fillRect(0, 0, 1280, 720); return; }
    if (sn === 'winter') c.fillStyle = 'rgba(220,235,255,0.08)', c.fillRect(0, 0, 1280, 720);
    const N = sn === 'winter' ? 90 : 34;
    for (let k = 0; k < N; k++) {
      const sp = sn === 'winter' ? 28 + (k % 7) * 5 : 36 + (k % 5) * 8, x0 = (k * 137.5) % 1340 - 30, y = ((t * sp + k * 97) % 780) - 30, x = x0 + Math.sin(t * 1.3 + k) * 26 - y * 0.25;
      const xx = ((x % 1340) + 1340) % 1340 - 30;
      if (sn === 'winter') { c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(xx, y, 1.6 + (k % 3), 0, 7); c.fill(); continue; }
      c.save(); c.translate(xx, y); c.rotate(t * 2 + k); c.scale(1, Math.abs(Math.sin(t * 3 + k)) * 0.7 + 0.3);
      c.fillStyle = sn === 'spring' ? (k % 2 ? '#ffc8dc' : '#ffb0cc') : ['#e8641e', '#f0a020', '#c8321e', '#d8b020'][k % 4];
      c.beginPath(); c.ellipse(0, 0, sn === 'spring' ? 4 : 5.5, sn === 'spring' ? 2.6 : 3.4, 0, 0, 7); c.fill(); c.restore();
    }
  }
  let townSeason = null;
  function drawHome(t) {
    { const sn = save ? seasonOfMonth(cal(save.week || 1).m) : 'spring'; if (sn !== seasonNow) { seasonNow = sn; townCv = null; } }
    if (!townCv || townSeason !== seasonNow) { buildTown(); townSeason = seasonNow; }
    const c = hx; t = (t || 0) / 1000;
    c.drawImage(townCv, 0, 0);
    hot = townHot;
    seasonFx(c, t);   /* 版478 */
    if (isMatchWeek()) {
      const { gx: sx, gy: sy, w: sw, d: sd } = ST, z = 1.05;
      // 両チームのエンブレムの大きな旗（ホームが左）
      const fx2 = C.nextFixture(save);
      if (fx2 && fx2.opp) {
        const meL = C.teamLook(save, save.team.name), opL = C.teamLook(save, fx2.opp.name);
        const L = fx2.home ? [meL, opL] : [opL, meL], meK = 'me:' + JSON.stringify(meL), keys = fx2.home ? [meK, fx2.opp.name] : [fx2.opp.name, meK];
        const [ax, ay] = iso(sx + 0.8, sy + 2.6, 1.4);
        bigBanner(c, bannerTex(L[0], keys[0]), ax - 30, ay - 112, t, 0);
        bigBanner(c, bannerTex(L[1], keys[1]), ax + 136, ay - 112, t, 1.7);
      }
      return;
      const cols = ['#e23b2b', '#ffffff', '#2f6fe0', '#ffd23a'];
      // スタンドの上にずらりと旗
      for (let k = 0; k < 7; k++) { const [x, y] = iso(sx + 0.6 + k * 1.15, sy + 0.5, z); flag(c, x, y, t, cols[k % 4], k * 0.9); }
      for (let k = 0; k < 4; k++) { const [x, y] = iso(sx + sw - 0.5, sy + 0.8 + k * 1.3, z); flag(c, x, y, t, cols[(k + 1) % 4], k * 1.3 + 2); }
      // 四すみの大きな旗
      for (const [gx, gy] of [[sx, sy], [sx + sw, sy], [sx + sw, sy + sd]]) { const [x, y] = iso(gx, gy, z); flag(c, x, y, t, '#e23b2b', gx + gy, true); }
    }
  }
  // タップした所の建物：名前の札 → 建物の絵（手前にあるものから）
  function hitAt(e) {
    const rc = hc.getBoundingClientRect(), sc = Math.max(rc.width / 1280, rc.height / 720), x = (e.clientX - rc.left - (rc.width - 1280 * sc) / 2) / sc, y = (e.clientY - rc.top - (rc.height - 720 * sc) / 2) / sc;  // object-fit: cover の切り取りを考える
    for (const h of hot) if (!h.area && x >= h.r.x - 6 && x <= h.r.x + h.r.w + 6 && y >= h.r.y - 6 && y <= h.r.y + h.r.h + 6) return h;
    const areas = hot.filter((h) => h.area).sort((a, b) => (b.r.y + b.r.h) - (a.r.y + a.r.h));
    for (const h of areas) if (x >= h.r.x && x <= h.r.x + h.r.w && y >= h.r.y && y <= h.r.y + h.r.h) return h;
    return null;
  }
  hc.addEventListener('click', (e) => { const h = hitAt(e); if (!h) return; if (h.go === 'stadium') stadium(); else if (h.go === 'shop') shop(); else if (h.go === 'lineup') openOffice(); else go(h.go); });
  hc.addEventListener('mousemove', (e) => { hc.style.cursor = hitAt(e) ? 'pointer' : 'default'; });
  const TIPS = ['選手は試合に出るほど「判断」が伸びます。', 'スペシャル（スキル）の特訓は、関係する能力が高いほど成功しやすい。', '同じスキルを持つ先輩がいると、スキルを覚えやすくなります。', '疲れたまま特訓すると伸びが落ち、ケガをすることも。休養も大事。', 'スキル枠は、能力が上がると増えていきます。', '特訓で動きのくせ（裏パラ）が変わり、選手タイプが変わることがあります。'];
  function renderHome() {
    ensure();
    const k = cal(save.week);
    $('#hmMonth').innerHTML = dotNum(k.m); $('#hmWeek').innerHTML = dotNum(k.w);
    const fx = C.nextFixture(save), st = C.standings(save), rank = (t) => st.findIndex((s) => s.name === t.name) + 1;
    const cs = C.campState(save);
    if (cs) { $('#hmNextMatch').innerHTML = `<div class="nm-card"><p class="hd">${k.m}月${k.w}週　<b class="lg camp">⛺ ${esc(cs.name)}</b>　${cs.week}/${cs.weeks}週目</p><p class="vs">${cs.name === '夏合宿' ? 'リーグ中断期間' : 'オフシーズン'}<br><small>${cs.name === '夏合宿' ? '後半戦まで' : '新シーズン開幕まで'} あと${cs.weeks - cs.week + 1}週</small></p></div><p class="cnt">特訓は<b>週${cs.trains}回</b>・効果<b>${cs.mult}倍</b>　終わったら ▶ で次の週へ</p><p class="coin">${COIN}${(save.coins || 0).toLocaleString()} コイン</p>`; $('#hmTicker').textContent = TIPS.join('　　　'); return; }
    const coin = `<p class="coin">${COIN}${(save.coins || 0).toLocaleString()} コイン</p>`;
    if (fx) {
      const fk = cal(fx.week);
      const when = fx.weeksLeft <= 0 ? '' : `<p class="cnt wait">次の試合まであと <b class="wk">${fx.weeksLeft}</b> 週</p>`;
      const oppTxt = fx.kind === 'league' ? `${esc(fx.opp.name)}（${rank(fx.opp)}位）` : `${esc(fx.opp.name)}<small class="opplg">（${esc((C.LG[fx.opp.lg] || {}).name || '')}）</small>`;
      const meTxt = fx.kind === 'league' ? `${esc(save.team.name)}（${rank(save.league.teams.find((t) => t.me))}位）` : esc(save.team.name);
      $('#hmNextMatch').innerHTML = `<div class="nm-card"><p class="hd">${fk.m}月${fk.w}週　<b class="lg${fx.kind !== 'league' ? ' cuplg' : ''}">${esc(fx.comp)}</b>　${esc(fx.label)}</p><p class="vs">${fx.home ? `<em>${meTxt}</em>` : oppTxt}<br><span class="vsm">VS</span><br>${fx.home ? oppTxt : `<em>${meTxt}</em>`}</p></div>${when}${coin}`;
    } else {
      const left = C.SEASON_WEEKS - save.week + 1, pos = rank(save.league.teams.find((t) => t.me));
      if (cs) { $('#hmNextMatch').innerHTML = `<div class="nm-card"><p class="hd">${k.m}月${k.w}週　<b class="lg camp">⛺ ${esc(cs.name)}</b>　${cs.week}/${cs.weeks}週目</p><p class="vs">オフシーズン<br><small>新シーズン開幕まで あと${left}週</small></p></div><p class="cnt">特訓は<b>週${cs.trains}回</b>・効果<b>${cs.mult}倍</b></p>${coin}`; $('#hmTicker').textContent = TIPS.join('　　　'); return; }
      $('#hmNextMatch').innerHTML = `<div class="nm-card"><p class="hd">${k.m}月${k.w}週　<b class="lg">${esc(save.league.name)}</b></p><p class="vs">リーグ戦終了　<em>${pos}位</em><br><small>オフシーズン</small></p></div><p class="cnt wait">新シーズン開幕まであと <b class="wk">${left}</b> 週</p>${coin}`;
    }
    $('#hmTicker').textContent = TIPS.join('　　　');
  }

  // ================= クラブハウス：練習グラウンド（カルチョビットAのように、ななめのグラウンドで色んな練習） =================
  const cc = $('#clubCv'), cx = cc.getContext('2d');
  const runners = [];
  // グラウンドの座標（u：サイドラインに沿って右上へ、v：サイドラインから手前へ）→ 画面
  const GO = [0, 590], GU = [15.5, -7.6], GV = [9.2, 6.2];
  const gp = (u, v) => [GO[0] + u * GU[0] + v * GV[0], GO[1] + u * GU[1] + v * GV[1]];
  let fieldCv = null;
  function buildField() {
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const c = cv.getContext('2d');
    c.fillStyle = '#3fcf34'; c.fillRect(0, 0, 1280, 720);
    // 芝のざらざら
    const r = seeded(3); for (let k = 0; k < 2600; k++) { c.fillStyle = r() < 0.5 ? 'rgba(0,80,0,0.07)' : 'rgba(255,255,255,0.05)'; c.fillRect(r() * 1280, r() * 720, 2, 2); }
    // 奥：木々・道・フェンス（左上の三角）
    const fy = (x) => 512 - 0.49 * x;   // フェンスの根もと（サイドラインの少し奥）
    c.fillStyle = '#2f8a2a'; c.beginPath(); c.moveTo(0, 0); c.lineTo(1280, 0); c.lineTo(1280, fy(1280) - 4); c.lineTo(0, fy(0) - 4); c.closePath(); c.fill();
    // 奥の森（道の向こう）
    for (let row = 0; row < 4; row++) for (let k = -3; k < 26; k++) { const x = k * 70 + (row % 2) * 35, y = fy(x) - 190 - row * 46; c.fillStyle = '#1b5e1d'; c.beginPath(); c.arc(x, y, 34, 0, 7); c.fill(); c.fillStyle = '#2a7d28'; c.beginPath(); c.arc(x - 10, y - 10, 22, 0, 7); c.fill(); c.fillStyle = '#3f9a36'; c.beginPath(); c.arc(x - 14, y - 15, 9, 0, 7); c.fill(); }
    // 道（灰色）と縁石
    c.fillStyle = '#9a9c9a'; c.beginPath(); c.moveTo(0, fy(0) - 150); c.lineTo(1280, fy(1280) - 150); c.lineTo(1280, fy(1280) - 105); c.lineTo(0, fy(0) - 105); c.closePath(); c.fill();
    c.strokeStyle = '#f2f2f2'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, fy(0) - 104); c.lineTo(1280, fy(1280) - 104); c.stroke(); c.lineWidth = 1;
    // 生け垣と木（道の手前）
    c.fillStyle = '#257a24'; c.beginPath(); c.moveTo(0, fy(0) - 96); c.lineTo(1280, fy(1280) - 96); c.lineTo(1280, fy(1280) - 8); c.lineTo(0, fy(0) - 8); c.closePath(); c.fill();
    for (let k = -2; k < 30; k++) { const x = k * 62 + (k % 2) * 18, y = fy(x) - 70 - (k % 3) * 8; c.fillStyle = '#5a3a1e'; c.fillRect(x - 3, y + 6, 6, 24); c.fillStyle = '#1d6e1e'; c.beginPath(); c.arc(x, y, 30, 0, 7); c.fill(); c.fillStyle = '#2f9a2c'; c.beginPath(); c.arc(x - 9, y - 9, 18, 0, 7); c.fill(); c.fillStyle = '#4ab83e'; c.beginPath(); c.arc(x - 13, y - 14, 8, 0, 7); c.fill(); }
    for (let k = 0; k < 44; k++) { const x = k * 30, y = fy(x) - 14; c.fillStyle = k % 2 ? '#226e22' : '#2a7e28'; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill(); }
    // フェンス（網と柱）
    c.strokeStyle = 'rgba(30,70,30,0.55)';
    for (let x = -20; x < 1300; x += 9) { c.beginPath(); c.moveTo(x, fy(x)); c.lineTo(x + 40, fy(x + 40) - 90); c.stroke(); c.beginPath(); c.moveTo(x + 40, fy(x + 40)); c.lineTo(x, fy(x) - 90); c.stroke(); }
    c.strokeStyle = '#6d6f6d'; c.lineWidth = 2; for (const h of [0, 45, 90]) { c.beginPath(); c.moveTo(0, fy(0) - h); c.lineTo(1280, fy(1280) - h); c.stroke(); } c.lineWidth = 1;
    for (let x = 30; x < 1300; x += 150) { const y = fy(x); c.fillStyle = '#8d908d'; c.fillRect(x - 4, y - 150, 8, 150); c.fillStyle = '#c4c6c4'; c.fillRect(x - 4, y - 150, 3, 150); c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(x + 6, y, 10, 3, 0, 0, 7); c.fill(); }
    // サイドライン
    c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(...gp(-6, 0)); c.lineTo(...gp(90, 0)); c.stroke(); c.lineWidth = 1;
    fieldCv = cv;
  }
  // コーチ：3人とも見た目が違う（監督は黒いスーツにサングラス、コーチはグレーのジャケット、もう1人は白いジャンパー）
  const COACH_LOOK = [
    [{ hair: 0, hairColor: 0, skin: 1 }, '#26282c', '#3d4046', '#151618', '#26282c', true],
    [{ hair: 2, hairColor: 3, skin: 0 }, '#6a6e74', '#8a8f96', '#4a4e54', '#2a2c30', false],
    [{ hair: 1, hairColor: 1, skin: 0 }, '#efe6d2', '#ffffff', '#c9bea6', '#2a2c30', false],
  ];
  const coachCache = new Map();
  function coachImg(k, view, frame, run) {
    const key = [k, view, frame, run ? 1 : 0].join('|');
    if (coachCache.has(key)) return coachCache.get(key);
    const [info, shirt, light, dark, pants, shades] = COACH_LOOK[k];
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const src = A().spriteCanvas(info, 0, view, frame, run, false);
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), px = d.data;
    const MAP = [['#2f6fd6', shirt], ['#6ea2f2', light], ['#1d4796', dark], ['#ffffff', pants]].map(([a2, b2]) => [hex(a2), hex(b2)]);
    for (let i = 0; i < px.length; i += 4) for (const [f, t] of MAP) if (px[i] === f[0] && px[i + 1] === f[1] && px[i + 2] === f[2]) { px[i] = t[0]; px[i + 1] = t[1]; px[i + 2] = t[2]; }
    x.putImageData(d, 0, 0);
    if (shades && view !== 'back' && view !== 'b34') { x.fillStyle = '#111'; for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) { const q = (yy * c.width + xx) * 4; if (px[q] === 0x23 && px[q + 1] === 0x1c && px[q + 2] === 0x1c) x.fillRect(xx - 1, yy, 3, 1); } }
    coachCache.set(key, c); return c;
  }
  // コーチの動き：メモを取る・笛を吹く・バインダーを見る・腕を組む・歩きながら見る
  const coachSt = [0, 1, 2].map((k) => ({ u: 9 + k * 2.6, v: -1.6 + k * 0.4, hu: 9 + k * 2.6, hv: -1.6 + k * 0.4, act: 'look', until: 0, face: 1, tu: null }));
  const COACH_ACTS = [['note', 'whistle', 'look', 'binder'], ['binder', 'note', 'look', 'walk'], ['whistle', 'look', 'note', 'walk']];
  function drawCoach(c, k, t, S) {
    const st = coachSt[k];
    if (t > st.until) {
      const list = COACH_ACTS[k]; st.act = list[Math.floor(Math.random() * list.length)]; st.until = t + 2500 + Math.random() * 3000;
      st.tu = st.act === 'walk' ? { u: st.hu + (Math.random() * 6 - 3), v: st.hv + Math.random() * 1.2 } : { u: st.hu, v: st.hv };
      st.face = Math.random() < 0.5 ? 1 : -1;
    }
    const du = st.tu.u - st.u, dv = st.tu.v - st.v, d = Math.hypot(du, dv), moving = d > 0.05;
    if (moving) { st.u += du / d * Math.min(0.05, d); st.v += dv / d * Math.min(0.05, d); }
    const [x, y] = gp(st.u, st.v), sc = 2.1;
    const flip = moving ? du * GU[0] + dv * GV[0] < 0 : st.face < 0;
    const view = moving ? 'f34' : st.act === 'whistle' || st.act === 'note' ? 'front' : 'f34';
    const img = coachImg(k, view, moving ? Math.floor(t / 140) % 4 : 0, moving);
    c.fillStyle = 'rgba(0,50,0,0.32)'; c.beginPath(); c.ellipse(x, y, 8 * sc, 2.6 * sc, 0, 0, 7); c.fill();
    c.save(); c.imageSmoothingEnabled = false; c.translate(x, 0); if (flip && view !== 'front') c.scale(-1, 1);
    c.drawImage(img, -S.W * sc / 2, y - (S.H - 2) * sc, S.W * sc, S.H * sc); c.restore();
    // 小道具（体のまえ）
    const hx = x + (flip ? -6 : 6), hy = y - 17;
    if (st.act === 'note' && !moving) {
      // ノートを持って、ペンを動かす
      c.fillStyle = '#f4f0e0'; c.fillRect(x - 9, hy - 5, 18, 12); c.strokeStyle = '#555'; c.lineWidth = 1; c.strokeRect(x - 9, hy - 5, 18, 12);
      c.fillStyle = '#9ab'; for (let l = 0; l < 3; l++) c.fillRect(x - 7, hy - 2 + l * 3, 14, 1);
      const px2 = x - 6 + ((t / 90) % 12), py2 = hy - 2 + Math.floor((t / 1080) % 3) * 3;
      c.strokeStyle = '#2a4ab0'; c.lineWidth = 2; c.beginPath(); c.moveTo(px2, py2); c.lineTo(px2 + 4, py2 - 6); c.stroke(); c.lineWidth = 1;
    } else if (st.act === 'binder' && !moving) {
      // バインダー（クリップボード）をのぞきこむ
      c.fillStyle = '#7a4e26'; c.fillRect(hx - 8, hy - 7, 16, 15); c.fillStyle = '#fff'; c.fillRect(hx - 6, hy - 5, 12, 11); c.fillStyle = '#bbb'; c.fillRect(hx - 3, hy - 9, 6, 3);
      c.fillStyle = '#e33'; c.fillRect(hx - 4, hy - 2, 2, 2); c.fillStyle = '#23c'; c.fillRect(hx + 1, hy + 1, 2, 2);
    } else if (st.act === 'whistle' && !moving) {
      // 笛を吹く（ときどき「ピッ！」）
      c.fillStyle = '#d8dde2'; c.fillRect(x - 3, y - 27, 7, 4); c.fillStyle = '#8a9096'; c.fillRect(x + 3, y - 27, 2, 3);
      if (Math.floor(t / 600) % 3 === 0) { c.font = '900 13px sans-serif'; c.lineWidth = 3; c.strokeStyle = '#123'; c.fillStyle = '#fff'; c.strokeText('ピッ！', x + 10, y - 44); c.fillText('ピッ！', x + 10, y - 44); c.strokeStyle = '#fff'; c.lineWidth = 2; for (const a of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(x + 8 + Math.cos(a) * 4, y - 27 + Math.sin(a) * 4); c.lineTo(x + 8 + Math.cos(a) * 9, y - 27 + Math.sin(a) * 9); c.stroke(); } c.lineWidth = 1; }
    }
    return y;
  }
  // 試合と同じボール（白に黒い五角形、転がると回る）
  const BALL_P = [[0, 1, 0], [0, -1, 0], [0.894, 0.447, 0], [0.276, 0.447, 0.851], [-0.724, 0.447, 0.526], [-0.724, 0.447, -0.526], [0.276, 0.447, -0.851], [0.724, -0.447, 0.526], [-0.276, -0.447, 0.851], [-0.894, -0.447, 0], [-0.276, -0.447, -0.851], [0.724, -0.447, -0.526]];
  function drawBall(c, x, y, r, rot, h) {
    h = h || 0;
    c.fillStyle = 'rgba(0,40,0,0.38)'; c.beginPath(); c.ellipse(x, y, r * 1.05, r * 0.42, 0, 0, 7); c.fill();
    const cy2 = y - r * 0.8 - h;
    c.fillStyle = '#fff'; c.strokeStyle = '#222'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, cy2, r, 0, 7); c.fill(); c.stroke();
    c.save(); c.beginPath(); c.arc(x, cy2, r - 0.5, 0, 7); c.clip(); c.fillStyle = '#222';
    const ca = Math.cos(rot), sa = Math.sin(rot);
    for (const [px3, py3, pz3] of BALL_P) {
      const yy = py3 * ca - pz3 * sa, zz = py3 * sa + pz3 * ca;   // 横の軸で回す（前に転がる）
      if (zz < -0.1) continue;
      const sq = Math.max(0.25, zz), ang = Math.atan2(yy, px3);
      c.beginPath(); c.ellipse(x + px3 * r * 0.85, cy2 - yy * r * 0.85, r * 0.3 * sq, r * 0.3, ang + Math.PI / 2, 0, 7); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x - r * 0.35, cy2 - r * 0.38, r * 0.28, 0, 7); c.fill();
    c.restore(); c.lineWidth = 1;
  }
  const BALL_R = 10;
  // 練習の道具（そのメニューのときだけ置く）
  function cone(c, u, v) { const [x, y] = gp(u, v); c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x + 2, y, 6, 2.5, 0, 0, 7); c.fill(); c.fillStyle = '#e8402e'; c.beginPath(); c.moveTo(x, y - 13); c.lineTo(x + 6, y); c.lineTo(x - 6, y); c.closePath(); c.fill(); c.fillStyle = '#ff8a7a'; c.fillRect(x - 1, y - 11, 2, 9); }
  function miniGoal(c, u, v, dir) {
    // 小さなゴール（幅は v 方向に6、奥行きは u 方向）：ポスト2本＋クロスバー＋ネット
    const H = 30, dep = 1.6 * dir;
    const f0 = gp(u, v - 3), f1 = gp(u, v + 3), b0 = gp(u + dep, v - 3), b1 = gp(u + dep, v + 3);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath(); c.moveTo(f0[0], f0[1] - H); c.lineTo(f1[0], f1[1] - H); c.lineTo(b1[0], b1[1] - H * 0.55); c.lineTo(b0[0], b0[1] - H * 0.55); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(b0[0], b0[1]); c.lineTo(b1[0], b1[1]); c.lineTo(b1[0], b1[1] - H * 0.55); c.lineTo(b0[0], b0[1] - H * 0.55); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1;
    for (let k = 0; k <= 8; k++) { const a = k / 8, fx2 = f0[0] + (f1[0] - f0[0]) * a, fy2 = f0[1] + (f1[1] - f0[1]) * a, bx2 = b0[0] + (b1[0] - b0[0]) * a, by2 = b0[1] + (b1[1] - b0[1]) * a; c.beginPath(); c.moveTo(fx2, fy2 - H); c.lineTo(bx2, by2 - H * 0.55); c.lineTo(bx2, by2); c.stroke(); }
    for (let k = 1; k < 4; k++) { const hh = H * 0.55 * k / 4; c.beginPath(); c.moveTo(b0[0], b0[1] - hh); c.lineTo(b1[0], b1[1] - hh); c.stroke(); }
    c.strokeStyle = '#fff'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(f0[0], f0[1]); c.lineTo(f0[0], f0[1] - H); c.lineTo(f1[0], f1[1] - H); c.lineTo(f1[0], f1[1]); c.stroke(); c.lineWidth = 1;
  }
  function drawProps(c, kind) {
    if (kind === 'ladder') for (const v of [11, 19]) {
      const u0 = 24, u1 = 58, w = 1.6;
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(...gp(u0, v)); c.lineTo(...gp(u1, v)); c.stroke();
      c.beginPath(); c.moveTo(...gp(u0, v + w)); c.lineTo(...gp(u1, v + w)); c.stroke();
      c.lineWidth = 1.6; for (let u = u0; u <= u1 + 0.01; u += 1.7) { c.beginPath(); c.moveTo(...gp(u, v)); c.lineTo(...gp(u, v + w)); c.stroke(); }
      c.lineWidth = 1;
      for (let k = 0; k < 7; k++) cone(c, 15 + k * 1.4, 4);
    }
    if (kind === 'duel') for (const [u0, v0] of DUEL_SPOTS) { cone(c, u0 + 9, v0 - 1.6); cone(c, u0 + 9, v0 + 1.6); cone(c, u0 - 0.5, v0 - 1); cone(c, u0 - 0.5, v0 + 1); }
    if (kind === 'game') { miniGoal(c, 21, 15, -1); miniGoal(c, 57, 15, 1); for (const [u, v] of [[22, 6], [56, 6], [22, 24], [56, 24]]) cone(c, u, v); }
    if (kind === 'pass') for (let pr = 0; pr < 8; pr++) { const cu = 20 + (pr % 4) * 11, cv = 9 + Math.floor(pr / 4) * 12; cone(c, cu - 0.8, cv - 1.2); cone(c, cu - 0.8, cv + 7.2); }
  }
  // 練習メニュー：クラブハウスを開くたびに1つ選ばれる（開いている間は同じ）
  const DRILLS = ['ladder', 'jog', 'pass', 'game', 'duel'];
  const DUEL_SPOTS = [[20, 7], [38, 7], [20, 19], [38, 19]];
  let clubDrill = 'ladder', drillT0 = 0, drillSnap = true;
  function pickDrill() { const opts = DRILLS.filter((d) => d !== clubDrill); clubDrill = opts[Math.floor(Math.random() * opts.length)]; drillT0 = -1; drillSnap = true; clubBall.rot = 0; }
  const clubBall = { u: 39, v: 15, tu: 39, tv: 15, rot: 0 };
  function drillTarget(kind, k, n, t) {
    if (kind === 'ladder') {
      // 2列に並んで、ラダーを駆け抜け、外側を戻る
      const lane = k % 2, v = lane ? 19.8 : 11.8, per = 6.5, ph = ((t / 1000 + (k >> 1) * per / Math.ceil(n / 2)) % per) / per;
      if (ph < 0.45) return { u: 23 + (ph / 0.45) * 36, v, fast: true };
      if (ph < 0.55) return { u: 59, v: v + ((ph - 0.45) / 0.1) * 3.5 };
      return { u: 59 - ((ph - 0.55) / 0.45) * 38, v: v + 3.5 };
    }
    if (kind === 'jog') {
      // 4列のかたまりでゆっくり走る（右上へ流れて、また左下から）
      const cu = 14 + ((t / 1000) * 3.0) % 42, row = Math.floor(k / 4), col = k % 4;
      return { u: cu - row * 3.4 + (col % 2) * 0.9, v: 8 + col * 3.4 + Math.sin(t / 700 + k) * 0.15, fast: false };
    }
    if (kind === 'pass') { const pr = k >> 1, side = k & 1; return { u: 20 + (pr % 4) * 11, v: 9 + Math.floor(pr / 4) * 12 + (side ? 6 : 0) }; }
    if (kind === 'duel') {
      // 4人1組：ボールを持った1人が、前の1人をドリブルでかわしてコーンの門を通る。終わったら順番を交代
      const g = Math.min(3, Math.floor(k / 4)), m = k - g * 4, [u0, v0] = DUEL_SPOTS[g], per = 4.2, tt = t / 1000 + g * 1.1, rnd = Math.floor(tt / per), ph = (tt % per) / per;
      const size = Math.min(4, n - g * 4) + (g === 3 ? Math.max(0, n - 16) : 0), role = ((m - rnd) % size + size) % size;
      const fe = Math.sin(ph * Math.PI * 3 + g) * 1.6 * Math.sin(ph * Math.PI);   // 左右のフェイント
      if (role === 0) return { u: u0 + ph * 11, v: v0 + fe, fast: ph > 0.35, ball: true };
      if (role === 1) return { u: u0 + 5.8 - Math.max(0, ph - 0.6) * 2, v: v0 + fe * 0.8 * (ph < 0.55 ? 1 : 0.4), def: true };
      return { u: u0 - 2 - (role - 2) * 1.5, v: v0 + 0.3 };
    }
    // ミニゲーム：紅白の2チームで、ミニゴールに向かって実際にパス・ドリブル・シュート（mgStep で動かす）
    return MG.tg[k] || { u: 39, v: 15 };
  }
  // ---- ミニゲーム（版460）：2チーム（ビブス）・GK・パスとドリブルとシュート。ゴールが決まったら真ん中から再開 ----
  const MG = { n: -1, team: [], gk: [], spot: [], owner: -1, hold: 0, hT: 1, ball: { u: 39, v: 15, tu: 39, tv: 15, sp: 0, rot: 0 }, fly: null, pause: 0, kickTeam: 0, press: {}, tg: [] };
  const MG_U0 = 22.5, MG_U1 = 55.5, MG_GV = 15;
  function mgInit(ps) {
    const n = ps.length; MG.n = n; MG.team = []; MG.gk = [-1, -1]; MG.spot = [];
    const gks = ps.map((p, k) => (p.position === 'GK' ? k : -1)).filter((k) => k >= 0);
    gks.slice(0, 2).forEach((k, t) => { MG.gk[t] = k; });
    let tt = 0; for (let k = 0; k < n; k++) { if (MG.gk[0] === k) MG.team[k] = 0; else if (MG.gk[1] === k) MG.team[k] = 1; else { MG.team[k] = tt; tt ^= 1; } }
    for (const t of [0, 1]) {
      const field = []; for (let k = 0; k < n; k++) if (MG.team[k] === t && MG.gk[t] !== k) field.push(k);
      const m = field.length, cols = Math.max(2, Math.ceil(m / 3));
      field.forEach((k, i) => { const col = i % cols, row = Math.floor(i / cols), rows = Math.ceil(m / cols);
        const depth = (col + 0.5) / cols;   // 0＝自陣のゴール寄り、1＝相手ゴール寄り
        const u = t === 0 ? 25 + depth * 13 : 53 - depth * 13, v = 7 + ((row + 0.5) / rows) * 16 + (col % 2 ? 1.2 : -1.2);
        MG.spot[k] = { u, v }; });
      if (MG.gk[t] >= 0) MG.spot[MG.gk[t]] = { u: t === 0 ? MG_U0 + 0.6 : MG_U1 - 0.6, v: MG_GV };
    }
    MG.owner = -1; MG.fly = null; MG.pause = 1.2; MG.kickTeam = 0; MG.ball.u = 39; MG.ball.v = 15;
  }
  function mgStep(dt, ps) {
    if (MG.n !== ps.length) mgInit(ps);
    const B = MG.ball, R = runners, n = ps.length, rnd = Math.random;
    const goalU = (t) => (t === 0 ? MG_U1 : MG_U0);   // そのチームが攻めるゴール
    const near = (u, v, t, not) => { let bk = -1, bd = 1e9; for (let k = 0; k < n; k++) { if (k === not || (t != null && MG.team[k] !== t)) continue; const d = Math.hypot(R[k].u - u, R[k].v - v); if (d < bd) { bd = d; bk = k; } } return [bk, bd]; };
    if (MG.pause > 0) {
      MG.pause -= dt; MG.owner = -1; MG.fly = null; B.u += (39 - B.u) * 0.08; B.v += (15 - B.v) * 0.08;
      for (let k = 0; k < n; k++) MG.tg[k] = { u: MG.spot[k].u + (MG.team[k] === MG.kickTeam && MG.gk[MG.team[k]] !== k ? 2 : 0), v: MG.spot[k].v };
      if (MG.pause <= 0) { let bk = -1, bd = 1e9; for (let k = 0; k < n; k++) if (MG.team[k] === MG.kickTeam && MG.gk[MG.kickTeam] !== k) { const d = Math.hypot(MG.spot[k].u - 39, MG.spot[k].v - 15); if (d < bd) { bd = d; bk = k; } } MG.owner = bk; MG.hold = 0; MG.hT = 0.8 + rnd(); }
      return;
    }
    // ボールの動き
    if (MG.fly) {
      const f = MG.fly, du = f.u - B.u, dv = f.v - B.v, d = Math.hypot(du, dv), st = Math.min(d, f.sp * dt);
      if (d > 0.01) { B.u += du / d * st; B.v += dv / d * st; B.rot += st * 1.5; }
      // 途中で相手が触る（カット）
      const [ok, od] = near(B.u, B.v, 1 - f.team);
      if (od < 0.7 && f.kind === 'pass' && rnd() < 0.08) { MG.fly = null; MG.owner = ok; MG.hold = 0; MG.hT = 0.6 + rnd(); }
      else if (f.kind === 'pass' && Math.hypot(R[f.to].u - B.u, R[f.to].v - B.v) < 0.9) { MG.fly = null; MG.owner = f.to; MG.hold = 0; MG.hT = 0.7 + rnd() * 1.2; }
      else if (d < 0.2) {
        if (f.kind === 'shot') { const gk = MG.gk[1 - f.team];
          if (gk >= 0 && Math.abs(R[gk].v - B.v) < 1.6 && rnd() < 0.55) { MG.fly = null; MG.owner = gk; MG.hold = 0; MG.hT = 1.1; }
          else { MG.fly = null; MG.kickTeam = 1 - f.team; MG.pause = 2.2; }   // ゴール！ 決められた方のボールで再開
        } else { MG.fly = null; const [k2] = near(B.u, B.v, null); MG.owner = k2; MG.hold = 0; MG.hT = 0.6 + rnd(); }
      }
    } else if (MG.owner >= 0) {
      const o = MG.owner, t = MG.team[o], dir = t === 0 ? 1 : -1, r = R[o];
      B.u = r.u + dir * 0.7; B.v = r.v + 0.2; B.rot += Math.hypot(r.vu, r.vv) * 1.5;
      MG.hold += dt;
      // 相手に寄せられ続けると取られる
      const [ok, od] = near(r.u, r.v, 1 - t);
      MG.press[o] = od < 0.85 ? (MG.press[o] || 0) + dt : 0;
      if (MG.press[o] > 0.55 && rnd() < 0.05) { MG.owner = ok; MG.hold = 0; MG.hT = 0.5 + rnd(); MG.press[o] = 0; }
      else if (MG.hold > MG.hT) {
        const gu = goalU(t), dG = Math.abs(gu - r.u);
        if (MG.gk[t] !== o && dG < 10 && rnd() < 0.55) { MG.fly = { kind: 'shot', team: t, u: gu + dir * 0.6, v: MG_GV + (rnd() - 0.5) * 3.4, sp: 22 }; MG.owner = -1; }
        else {
          // パス：前にいて、相手が近くにいない味方を選ぶ
          let best = -1, bs = -1e9;
          for (let k = 0; k < n; k++) { if (k === o || MG.team[k] !== t || MG.gk[t] === k) continue; const q = R[k], fwd = (q.u - r.u) * dir, dd = Math.hypot(q.u - r.u, q.v - r.v); if (dd < 2.5 || dd > 16) continue; const [, md] = near(q.u, q.v, 1 - t); const sc = fwd * 0.35 + Math.min(md, 4) - dd * 0.08 + rnd() * 1.5; if (sc > bs) { bs = sc; best = k; } }
          if (best >= 0) { const q = R[best]; MG.fly = { kind: 'pass', team: t, to: best, u: q.u + q.vu * 12, v: q.v + q.vv * 12, sp: 13 }; MG.owner = -1; }
          else { MG.hold = 0; MG.hT = 0.5 + rnd(); }
        }
      }
    }
    B.u = Math.max(MG_U0 - 0.4, Math.min(MG_U1 + 0.4, B.u)); B.v = Math.max(5.5, Math.min(24.5, B.v));
    // それぞれの動き先
    const ownT = MG.owner >= 0 ? MG.team[MG.owner] : MG.fly ? MG.fly.team : -1;
    const presser = [-1, -1]; for (const t of [0, 1]) if (ownT === 1 - t) { let bk = -1, bd = 1e9; for (let k = 0; k < n; k++) if (MG.team[k] === t && MG.gk[t] !== k) { const d = Math.hypot(R[k].u - B.u, R[k].v - B.v); if (d < bd) { bd = d; bk = k; } } presser[t] = bk; }
    for (let k = 0; k < n; k++) {
      const t = MG.team[k], dir = t === 0 ? 1 : -1, sp = MG.spot[k];
      if (MG.gk[t] === k) { MG.tg[k] = { u: sp.u, v: Math.max(12.6, Math.min(17.4, MG_GV + (B.v - MG_GV) * 0.45)) }; continue; }
      if (k === MG.owner) { MG.tg[k] = { u: r2(R[k].u + dir * 2.2), v: R[k].v + (MG_GV - R[k].v) * 0.15, fast: false, ball: true }; continue; }
      if (MG.fly && MG.fly.kind === 'pass' && MG.fly.to === k) { MG.tg[k] = { u: MG.fly.u, v: MG.fly.v, fast: true }; continue; }
      if (presser[t] === k) { MG.tg[k] = { u: B.u - dir * 0.4, v: B.v, fast: true }; continue; }
      // 陣形のまま、ボールの方へ少し寄る（攻めている時は前へ）
      const push = ownT === t ? 4 * dir : ownT === 1 - t ? -2.5 * dir : 0;
      MG.tg[k] = { u: sp.u + (B.u - 39) * 0.45 + push, v: sp.v + (B.v - 15) * 0.18 };
    }
    function r2(x) { return Math.max(MG_U0 + 0.5, Math.min(MG_U1 - 0.5, x)); }
  }
  let clubLastT = 0;
  function drawClub(tAbs) {
    const c = cx;
    if (!fieldCv) buildField();
    c.drawImage(fieldCv, 0, 0);
    if (view !== 'club') return;
    if (drillT0 < 0) drillT0 = tAbs;
    const t = tAbs - drillT0, dt = Math.min(0.05, Math.max(0, (tAbs - clubLastT) / 1000)); clubLastT = tAbs;
    const ps = save.team.players.filter((p) => !(p.injury > 0));
    const n = ps.length, kind = clubDrill;
    if (runners.length !== n) { runners.length = 0; ps.forEach((p, k) => runners.push({ u: 10 + (k % 4) * 3, v: 6 + Math.floor(k / 4) * 3, vu: 0, vv: 0, sp: 0.85 + (p.speed - 40) * 0.006, rot: 0, fa: Math.PI / 4, ph: k * 0.37, mv: 0 })); drillSnap = true; MG.n = -1; }
    drawProps(c, kind);
    if (kind === 'game') mgStep(dt, ps);
    const S = A().SPR, objs = [];
    const tgs = runners.map((r, k) => drillTarget(kind, k, n, t));
    // 重ならないように、近すぎる人どうしは少し離す（ドリブル中・GKは動かさない）
    if (kind !== 'pass' && kind !== 'ladder') for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { const A2 = tgs[a], B2 = tgs[b], du = B2.u - A2.u, dv = B2.v - A2.v, d = Math.hypot(du, dv); if (d < 1.3) { const m = (1.3 - d) / 2, nu = d > 0.01 ? du / d : 1, nv = d > 0.01 ? dv / d : 0; if (!A2.ball) tgs[a] = { ...A2, u: A2.u - nu * m, v: A2.v - nv * m }; if (!B2.ball) tgs[b] = { ...B2, u: B2.u + nu * m, v: B2.v + nv * m }; } }
    const bpos = kind === 'game' ? MG.ball : null;
    runners.forEach((r, k) => {
      const tg = tgs[k];
      if (drillSnap) { r.u = tg.u; r.v = tg.v; }
      const du = tg.u - r.u, dv = tg.v - r.v, d = Math.hypot(du, dv);
      const vmax = (tg.fast ? 0.3 : tg.ball ? 0.13 : 0.16) * r.sp, fs = Math.max(0.2, Math.min(3, dt * 60));   // 1コマ（60分の1秒）あたりの速さ。コマ落ちしても同じ速さで動く
      if (d > 0.03) { const m = Math.min(vmax, d * 0.5 + 0.01); r.vu += (du / d * m - r.vu) * 0.35; r.vv += (dv / d * m - r.vv) * 0.35; } else { r.vu *= 0.6; r.vv *= 0.6; }
      r.u += r.vu * fs; r.v += r.vv * fs;
      const spd = Math.hypot(r.vu, r.vv);
      // 走っている・止まっているは、少し余裕をもって切りかえる（ガタガタしないように）
      r.mv = spd > 0.05 ? Math.min(1, r.mv + 0.25) : spd < 0.025 ? Math.max(0, r.mv - 0.2) : r.mv;
      const moving = r.mv > 0.5;
      r.ph += spd * fs / 1.9;   // 走った距離ぶんだけ足を動かす（すべらない）
      const [x, y] = gp(r.u, r.v), sx2 = r.vu * GU[0] + r.vv * GV[0], sy2 = r.vu * GU[1] + r.vv * GV[1];
      // 向き：走っている時は進む方、止まっている時はボール（パスの相手・ゴール）の方。少しずつ回る
      let want = null;
      if (moving && spd > 0.03) want = Math.atan2(sy2 * 1.7, sx2);
      else if (bpos) { const [bx, by] = gp(bpos.u, bpos.v); want = Math.atan2((by - y) * 1.7, bx - x); }
      else if (kind === 'pass') want = k & 1 ? -Math.PI * 0.75 : Math.PI / 4;
      else if (tg.def) want = Math.PI * 0.75;
      else if (!moving) want = Math.PI / 4;
      if (want != null) { let dA = Math.atan2(Math.sin(want - r.fa), Math.cos(want - r.fa)); r.fa += dA * 0.25; }
      const isGK = ps[k].position === 'GK';
      const team = kind === 'game' ? MG.team[k] || 0 : 0;
      objs.push({ y, f: () => {
        const p = ps[k], sc = 2.1, ar = A().artSprite ? A().artSprite(p, team, r.fa, r.ph, moving, isGK) : null;
        c.fillStyle = 'rgba(0,50,0,0.32)'; c.beginPath(); c.ellipse(x, y, 8 * sc, 2.6 * sc, 0, 0, 7); c.fill();
        c.save(); c.imageSmoothingEnabled = false;
        if (ar) { const F = ar.F, px = sc * ar.k; c.drawImage(F.cv, Math.round(x - F.px * px), Math.round(y - F.py * px), F.cv.width * px, F.cv.height * px); }
        else { const img = A().spriteCanvas(p, team, 'f34', 0, false, isGK); c.drawImage(img, x - S.W * sc / 2, y - (S.H - 2) * sc, S.W * sc, S.H * sc); }
        c.restore();
      } });
      // ドリブルするボール（足もとの少し前）
      if (tg.ball && kind !== 'game') { r.rot += d * 1.4; const [bx, by] = gp(r.u + 0.9, r.v + (r.vv * 2)); objs.push({ y: by + 0.1, f: () => drawBall(c, bx, by, BALL_R, r.rot) }); }
    });
    drillSnap = false;
    // 対面パスのボール：ペアの間を行き来する
    if (kind === 'pass') for (let pr = 0; pr * 2 + 1 < n; pr++) { const a = runners[pr * 2], b = runners[pr * 2 + 1], ph = ((t / 1000 + pr * 0.37) % 1.6) / 1.6, u = ph < 0.5 ? ph * 2 : 2 - ph * 2; const bu = a.u + 0.6 + (b.u - a.u) * u, bv = a.v + 0.6 + (b.v - a.v - 1.2) * u, [x, y] = gp(bu, bv); objs.push({ y: y + 0.1, f: () => drawBall(c, x, y, BALL_R, t / 90) }); }
    if (kind === 'game') { const [x, y] = gp(MG.ball.u, MG.ball.v); objs.push({ y: y + 0.1, f: () => drawBall(c, x, y, BALL_R, MG.ball.rot) }); }
    // コーチ3人（サイドラインのそばで、メモ・笛・バインダー）
    for (let k = 0; k < 3; k++) { const [, y] = gp(coachSt[k].u, coachSt[k].v); objs.push({ y, f: () => drawCoach(c, k, tAbs, S) }); }
    objs.sort((a, b) => a.y - b.y).forEach((o) => o.f());
    drawClubButtons(tAbs);
  }
  // 右のボタンのドット絵（選手データ：選手と能力のランクが順に入れかわる／特訓：走る選手）
  let rbLast = -1;
  function drawClubButtons(t) {
    const S = A().SPR, ps = save.team.players;
    const dc = document.getElementById('rbData'), tc = document.getElementById('rbTrain');
    const slot = Math.floor(t / 1400);
    if (dc && slot !== rbLast) {
      rbLast = slot;
      const p = ps[slot % ps.length], q = D.PARAMS[(slot * 5) % D.PARAMS.length];
      C.ensurePts(p); const g = C.rankInfo(p.pts[q.k]).g;
      const x = dc.getContext('2d'); x.clearRect(0, 0, dc.width, dc.height); x.imageSmoothingEnabled = false;
      x.drawImage(A().spriteCanvas(p, 0, 'front', 0, false, p.position === 'GK'), 2, 4, S.W * 1.6, S.H * 1.6);
      const im = icoImg(q.k); if (im.complete) x.drawImage(im, 34, 2, 22, 20);
      x.font = 'italic 900 20px "Arial Black",sans-serif'; x.lineWidth = 3; x.strokeStyle = '#111'; x.fillStyle = { S: '#ffa21f', A: '#ff3a2a', B: '#2fb0f0', C: '#ffe02a', D: '#f2f2f2', E: '#9aa0a0' }[g];
      x.strokeText(g, 37, 41); x.fillText(g, 37, 41);
    }
    if (tc) {
      const x = tc.getContext('2d'); x.clearRect(0, 0, tc.width, tc.height); x.imageSmoothingEnabled = false;
      const p = ps[9] || ps[0];
      x.drawImage(A().spriteCanvas(p, 0, 'side', Math.floor(t / 120) % 4, true, false), 10, 0, S.W * 2, S.H * 2);
    }
  }
  const icoCache = {};
  function icoImg(k) { if (!icoCache[k]) { const im = new Image(); im.src = `icons/${k}.png`; icoCache[k] = im; } return icoCache[k]; }
  // スタメンのミニ図（今のフォーメーションの点）
  function rbLineupSVG() {
    const tac = C.ensureTactics(save), cells = tac.cells || [];
    const dots = cells.slice(1, 11).map((c2) => c2 ? `<circle cx="${6 + c2.c * 3.4}" cy="${44 - c2.r * 3.6}" r="2.3" fill="#fff"/>` : '').join('');
    return `<svg viewBox="0 0 60 56" class="rb-svg"><rect x="2" y="2" width="56" height="52" fill="#3aa83a"/><rect x="2" y="2" width="56" height="12" fill="#2a7a8a"/>${[16, 26, 36].map((y) => `<rect x="2" y="${y}" width="56" height="5" fill="#46b846"/>`).join('')}<rect x="2" y="2" width="56" height="52" fill="none" stroke="#fff" stroke-width="1.5"/><rect x="18" y="44" width="24" height="10" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="30" cy="51" r="2.3" fill="#ffe66a"/>${dots}</svg>`;
  }
  const RB_TAC_SVG = '<svg viewBox="0 0 60 56" class="rb-svg"><rect x="2" y="4" width="56" height="48" rx="2" fill="#fff" stroke="#bbb"/><rect x="34" y="8" width="20" height="40" fill="#cfeedd" stroke="#8c8" stroke-width=".8"/><line x1="44" y1="8" x2="44" y2="48" stroke="#8c8" stroke-width=".8"/><rect x="6" y="18" width="7" height="18" fill="none" stroke="#888"/><circle cx="20" cy="14" r="2" fill="#e33"/><circle cx="22" cy="26" r="2" fill="#e33"/><circle cx="20" cy="38" r="2" fill="#e33"/><circle cx="28" cy="20" r="2" fill="#e33"/><circle cx="28" cy="32" r="2" fill="#e33"/><circle cx="38" cy="16" r="2" fill="#23c"/><circle cx="40" cy="28" r="2" fill="#23c"/><circle cx="38" cy="40" r="2" fill="#23c"/><circle cx="31" cy="44" r="2" fill="#f2c21c"/><path d="M14 46 q6-6 12-2" stroke="#e33" fill="none" stroke-width="1.2"/></svg>';
  function tick(t) {
    if (!document.getElementById('career') || $('#career').hidden) return;
    if (view === 'home') drawHome(t); else if (liveBack && liveSnap) { cx.drawImage(liveSnap, 0, 0); } else drawClub(t);   // 版559：試合前から開いた時は、後ろも試合会場のまま
    raf = requestAnimationFrame(tick);
  }

  // タイプのバッジ：タイプごとに色分け（カルチョビットAのようにカラフルに）
  const TYPE_CLS = { 'バランス': 'ty-bal', 'アタッカー': 'ty-att', 'ストライカー': 'ty-str', 'ストッパー': 'ty-stp', 'スイーパー': 'ty-swp', 'マンマーカー': 'ty-man', 'ダイナモ': 'ty-dyn', 'レジスタ': 'ty-reg', 'ゲームメイカー': 'ty-gm', 'ラインコントローラー': 'ty-lc', 'パサー': 'ty-pa', '偽9番': 'ty-f9', 'デコイラン': 'ty-dec', 'ファンタジスタ': 'ty-fan', 'シャドー': 'ty-sha', 'アンカー': 'ty-anc', 'ビルドアップ型': 'ty-bu', 'スイーパーキーパー': 'ty-skp', 'ゴールキーパー': 'ty-gk' };
  // 能力のアイコン（文字だけだと分かりにくいので、絵で見分けられるように）
  const ico = (k, cls) => `<img class="pico ${cls || ''}" src="icons/${k}.png" alt="" draggable="false">`;
  // ☆（レア度）の表示：★の数＋凸の印。cap＝育てられる上限のランク
  const starHTML = (n, totsu, cls) => { const t = Math.min(totsu || 0, 3); let h = ''; for (let k = 0; k < n; k++) h += `<i class="tz tz${t}">★</i>`;   /* 版476：無凸＝白、1凸＝銀、2凸＝金、完凸＝虹 */   /* 版467：凸の数で星全部の色が変わる（無凸＝黄、1凸＝青、2凸＝紫、完凸＝虹） */ return `<span class="stars s${n}${t ? ' t' + t : ''} ${cls || ''}" title="☆${n}${t >= 3 ? '・凸MAX' : t ? '・' + t + '凸' : ''}">${h}</span>`; };   // 版456：凸した分だけ、星に色がつく（1凸＝青、2凸＝紫、3凸＝虹）
  const capBadge = (g) => `<span class="capb">上限<b class="rk rk-${g}">${g}</b></span>`;
  const typeBadge = (t, cls) => `<span class="tbadge ${TYPE_CLS[t] || 'ty-bal'} ${cls || ''}">${esc(t)}</span>`;
  // 版514：調子（ポテンシャルの代わり）：本家と同じ5段階の矢印（↑絶好調・↗好調・→普通・↘不調・↓絶不調）
  const COND_UI = { 2: ['絶好調', -90, '#ff3d2e'], 1: ['好調', -45, '#ff9a1a'], 0: ['普通', 0, '#e8c21a'], '-1': ['不調', 45, '#3a9cff'], '-2': ['絶不調', 90, '#7a5cff'] };
  function condArrow(p, size) { const [, deg, col] = COND_UI[C.condOf(p)]; const z = size || 22;
    return `<svg class="cnd-a" viewBox="0 0 24 24" width="${z}" height="${z}" style="transform:rotate(${deg}deg)"><path d="M3 9h10V3l9 9-9 9v-6H3z" fill="${col}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`; }
  function condGauge(p, cls) { const [nm] = COND_UI[C.condOf(p)]; return `<span class="cnd ${cls || ''}" title="調子">${condArrow(p, cls === 'sm' ? 20 : 26)}<b>${nm}</b></span>`; }
  // ================= 選手データ =================
  const POSC = { GK: 'pos-gk', DF: 'pos-df', MF: 'pos-mf', FW: 'pos-fw' };
  const condDot = (p) => (p.injury > 0 ? 'cd-inj' : p.fatigue > 70 ? 'cd-red' : p.fatigue > 45 ? 'cd-yel' : 'cd-blue');
  // エンブレムを画像に（一覧表・選手カードで使う）
  const embURL = new Map();
  const ART = window.DOT_ART || { emblems: [], leagues: [] };
  const artImgs = {};
  // 版544：エンブレム・リーグのマーク・お店やスカウトの絵を、起動した時に先に読みこんでおく（チームの画面を開いた時に遅れて出ないように）
  const preImgs = [];
  function preloadArt() {
    const urls = ART.emblems.map((id) => `emblems/${id}.png`).concat(ART.leagues.map((k) => `icons/lg/${k}.png`), ['img/gacha_bg.jpg', 'img/shop_rec.jpg', 'img/shop_cards.jpg', 'img/shop_prem.jpg', 'icons/btn_ok.png', 'icons/btn_no.png', 'icons/btn_blue.png', 'icons/btn_white.png']);
    let i = 0; const next = () => { const batch = urls.slice(i, i + 8); i += 8; if (!batch.length) return; Promise.all(batch.map((u) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = () => { try { im.decode && im.decode().catch(() => {}); } catch (_) {} ok(); }; im.src = u; preImgs.push(im); }))).then(() => setTimeout(next, 30)); };
    setTimeout(next, 300);
    // 選手の顔の絵（スター・モブ）も、少しあとから少しずつ読みこむ
    setTimeout(() => { const keys = Object.keys(window.STAR_FACES || {}); let j = 0; const step = () => { for (let k = 0; k < 6 && j < keys.length; k++, j++) { try { starFace(keys[j], '#ffffff', false); } catch (_) {} } if (j < keys.length) setTimeout(step, 120); }; step(); }, 2500);
  }
  setTimeout(preloadArt, 0);
  function embImg(id) { if (!ART.emblems.includes(id)) return null; if (!artImgs[id]) { const im = new Image(); im.src = `emblems/${id}.png`; artImgs[id] = im; } return artImgs[id]; }
  function emblemURL(name, size = 64) {
    const lk = C.teamLook(save, name), id = lk.me ? 'hajimari' : lk.id;
    if (id && ART.emblems.includes(id)) return `emblems/${id}.png`;   // GPTで作ったエンブレム
    const key = name + ':' + size + (lk.me ? ':' + JSON.stringify(lk) : '');
    if (!embURL.has(key)) { const cv = document.createElement('canvas'); cv.width = size; cv.height = size; drawEmblem(cv.getContext('2d'), size / 2, size / 2, size * 0.92, lk); embURL.set(key, cv.toDataURL()); }
    return embURL.get(key);
  }
  // 通常スキルの説明（選手カードの習得スキルで、タップすると出る）
  const SKILL_DESC = {"knuckle": "回転のないシュート。ボールが揺れながら飛ぶので、GKが取りにくい", "curve": "曲がるボールを蹴る。シュートはGKの届かない隅へ、パス・クロスは相手をよけて通る", "fk": "直接FKがうまい。持っているシュート技（無回転・ドライブ・コントロール）をFKでも使える", "ckMaster": "CKの精度が高い。ゴール前の味方へ正確に合わせる", "longThrow": "スローインでゴール前まで投げ込める", "pkMaster": "PKを決めやすい", "wallPass": "近くの味方に当てて、自分はすぐ前へ走る（壁パス）", "slide": "少し離れた所から滑り込んでボールを奪う。後ろからだと反則になりやすい", "feint": "体の動きで逆を取って抜く", "dribbleShot": "縦回転のシュート。バーを越えると見せて急に落ちる", "scissors": "ボールをまたいで相手を揺さぶって抜く", "roulette": "回転して相手をかわす。正面から来た相手に強い", "elastico": "足の外側と内側で素早く切り返して抜く", "doubleTouch": "左右の足で素早くボールを動かして抜く", "bodyFeint": "体の動きで逆を取って抜く", "nutmeg": "相手の股の間にボールを通して抜く", "speedDribble": "スピードに乗ったドリブルで一気に運ぶ", "cutIn": "サイドから中へ切れ込んで、シュートを打ちやすい角度を作る", "heelLift": "かかとでボールを浮かせて、相手の頭上を越して抜く", "kickFeint": "シュートやパスを打つふりをして、相手が止まった瞬間にかわす", "volley": "浮いたボールをそのまま蹴ってシュートする", "lob": "前に出たGKの頭上をふわっと越すシュート", "direct": "パスをトラップせずに、そのままシュートする", "bicycle": "高いボールを後ろ向きのまま、オーバーヘッドで蹴る", "divingHeader": "低いクロスに飛び込んで頭で合わせる", "toeKick": "つま先で素早く打つ。囲まれて踏み込めない所でも打てる", "nearPost": "GKのニア上を強いシュートでぶち抜く", "driveShot": "縦回転のシュート。バーを越えると見せて急に落ちる", "powerMid": "ミドルレンジから思い切った強烈なシュートを打つ", "controlShot": "強さより正確さ。GKの届かない隅へ置きに行く。PAの角付近が得意", "superLong": "センターライン付近からでも、GKが前に出ていれば狙う", "throughPass": "DFラインの裏へ走る味方の足もとへパスを通す", "loftedThrough": "DFの頭上を越えて裏へ落ちるスルーパス", "noLook": "見ている方向と別の方へパスを出す。相手に読まれにくい", "oneTouchPass": "ボールを止めずに、そのまま味方へはたく", "heelPass": "かかとで後ろの味方へパスを出す。相手の意表をつく", "longFeed": "遠くの味方へ正確なロングパスを送る", "earlyCross": "深くえぐる前に、早めのタイミングでゴール前へクロスを入れる", "pinpointCross": "ゴール前の味方の頭や足もとへ、正確にクロスを合わせる", "switchPlay": "逆サイドの空いた味方へ大きく展開する", "intercept": "パスコースを読んで、パスを途中で奪う", "manMark": "決められた相手にぴったり付いて離れない", "cover": "味方が抜かれた時に備えて、2人目として後ろをカバーする", "shoulder": "並走している相手に肩から当たって、体を入れてボールを奪う", "aerial": "空中での競り合いに強い", "shotBlock": "シュートコースに体を投げ出して止める", "pressMonster": "ボールを持った相手へ、しつこく寄せ続ける", "recovery": "ボールより前に残っていたら、全力で守備に戻る", "superReflex": "打たれてから反応するまでが速い", "punching": "取れないボールは、こぶしで遠くへはじき出す", "rushOut": "裏へのボールを、前に出て先に処理する", "pkStopper": "PKを止めやすい", "oneOnOne": "1対1で、体を投げ出してシュートに当てる", "lowThrow": "低く速いスローで、すばやく味方へつなぐ", "lowPunt": "低い弾道のキックで、前線へ速く届ける", "coaching": "声でDFを動かし、シュートコースを切らせる", "behindRun": "最終ラインぎりぎりで待ち、裏へ抜け出す一歩目が速い", "postPlay": "相手を背負ってキープし、上がってきた味方へ落とす", "nearRun": "クロスに、ニアへ飛び込んで合わせる", "farWait": "クロスに、ファーで待って合わせる", "overlap": "サイドの後ろから、積極的に前線へ上がっていく", "looseBall": "シュートのこぼれ球に、いち早く詰める", "oneTwo": "ワンツーがうまい。壁パスの効果があり、走り込みも速い", "captaincy": "まわりの味方を落ち着かせ、チームのプレーを安定させる", "bigStage": "接戦の後半に力を発揮する", "lateGrit": "疲れてもプレーの質が落ちにくい", "clutch": "追いかける終盤やPKなど、大事な場面で決める", "moodMaker": "失点してもチームを盛り上げる", "fighting": "負けている時ほど、競り合いに強くなる", "calm": "ゴール前やPKでも慌てない", "ironMan": "スタミナが減りにくく、試合の最後まで走れる"};
  // 利き足のマーク（本家のように、利き足のほうが光る）
  const footSVG = (foot) => { const sole = (x, on, mir) => `<g transform="translate(${x},0)${mir ? ' scale(-1,1) translate(-14,0)' : ''}"><path d="M7 1c3 0 5 3 5 7 0 3-1 5-1 8 0 3 1 5-1 7-2 1-5 1-6-1-1-2 0-4 0-6 0-3-2-5-2-8C2 4 4 1 7 1z" fill="${on ? '#c8f03a' : '#222'}" stroke="#111" stroke-width="1"/>${on ? `<text x="7" y="12" font-size="8" font-weight="900" text-anchor="middle" fill="#2a4a00">${mir ? 'R' : 'L'}</text>` : ''}</g>`; return `<svg class="footsvg" viewBox="0 0 32 25">${sole(1, foot === 'L', false)}${sole(17, foot === 'R', true)}</svg>`; };
  const lgKey = (id) => id;   // 地域リーグは東西で別のマーク
  const lgBadge = (id) => { const k = lgKey(id); if (ART.leagues.includes(k)) return `<img class="lgi" src="icons/lg/${k}.png" alt="">`; const b = LG_BADGE[id] || ['?', 'b-r2']; return `<i class="lgb ${b[1]}">${b[0]}</i>`; };
  // ================= 選手データ（カルチョビットAの一覧表のように、詰めて見やすく） =================
  function renderData() {
    const head = D.PARAMS.map((q) => `<th title="${q.name}" class="th-ico">${ico(q.k)}</th>`).join('');
    const rows = save.team.players.map((p, i) => { C.ensurePts(p); return `<tr data-i="${i}" class="${i >= 11 ? 'sub' : ''}"><td><span class="pos ${POSC[p.position]}">${p.position}</span></td><td class="no">${p.number}</td><td class="s-nm">${esc(p.name)}${starHTML(C.ensureStar(p), p.totsu, 'sm')}</td><td><i class="cdot ${condDot(p)}"></i></td>${D.PARAMS.map((q) => { const ri = C.rankInfo(p.pts[q.k]); return `<td class="gd" title="${q.name} ${Math.floor(p.pts[q.k])}（次のランクまであと${Math.max(0, Math.ceil(ri.next - p.pts[q.k]))}）"><b class="rk rk-${ri.g}">${ri.g}</b></td>`; }).join('')}<td>${typeBadge(p.type)}</td><td>${condGauge(p, 'sm')}</td></tr>`; }).join('');
    $('#clubLayer').innerHTML = `<div class="dpanel dp2"><h2><img class="emb" src="${emblemURL(save.team.name, 48)}" alt="">${esc(save.team.name)}　［${lgBadge(save.league.id)}］</h2><div class="dscroll"><table class="dtbl dtbl2"><thead><tr><th>Pos.</th><th>No.</th><th colspan="2">所属選手</th>${head}<th>タイプ</th><th>調子</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    $('#clubLayer').querySelectorAll('tr[data-i]').forEach((tr) => tr.onclick = () => playerDetail(+tr.dataset.i));
  }
  // ================= 選手カード（カルチョビットAの選手カードに寄せる）：タップでページ切り替え・◀▶で前後の選手 =================
  // 選手データからは大きな窓で、特訓画面では左上にそのまま埋め込んで使う（ups：特訓で伸びる予定の分）
  let pcPage = 0;
  function playerCardHTML(i, ups, embed) {
    const ps = save.team.players, p = ps[i];
    C.ensurePts(p);
    const grades = D.PARAMS.map((q) => {
      const v = p.pts[q.k], a = C.rankInfo(v), add = Math.round((ups && ups[q.k]) || 0), b = C.rankInfo(Math.min(C.PMAX - 1, Math.max(v, Math.min(C.capPts(p), v + Math.max(0, add)))));
      const tag = add > 0 ? `<em class="${b.g !== a.g ? 'rkup' : ''}">${b.g !== a.g ? `→${b.g}` : `+${add}`}</em>` : add < 0 ? `<em class="dn">${add}</em>` : (ups ? '<em></em>' : '');
      return `<div><b class="rk rk-${a.g}">${a.g}</b>${tag}</div>`;
    }).join('');
    const icons = D.PARAMS.map((q) => ico(q.k)).join('');
    const pages = ['状態・記録', '詳しい能力値', '習得スキル'];
    let body = '';
    if (pcPage === 0) {
      const recs = Object.entries(p.rec || {}).sort((a, b) => +b[0] - +a[0]).slice(0, 5);
      const fat = Math.round(p.fatigue || 0);
      const hist = [0, 1, 2, 3].map((k) => { const c = (p.trainHist || [])[k]; return c && C.CARDS[c] ? `<img class="hc" src="cards/${c}.jpg" title="${esc(C.CARDS[c].name)}" alt="">` : '<i class="hc empty"></i>'; }).join('<s>›</s>');
      body = `<div class="pc-st"><span class="pc-chip">疲労度<i class="cdot ${condDot(p)}"></i><small>${fat}%</small></span><span class="pc-chip">利き足${footSVG(p.foot)}<small>${p.foot === 'L' ? '左' : '右'}</small></span><span class="pc-chip">${p.injury > 0 ? `<b class="inj">ケガ　あと${p.injury}週</b>` : '<b class="ok">ケガなし</b>'}</span><span class="pc-chip hist">特訓履歴 ${hist}</span></div>
        <div class="pc-car"><span>キャリア</span><b>${save.season}年目</b><span>出場</span><b>${p.games || 0}</b><span>得点</span><b>${recs.reduce((a, [, r]) => a + r.G, 0)}</b><span>アシスト</span><b>${recs.reduce((a, [, r]) => a + r.A, 0)}</b></div>
        <table class="pc-rec"><tr><th>シーズン</th><th>所属クラブ</th><th>P</th><th>G</th><th>A</th><th><i class="ycd"></i></th><th><i class="rcd"></i></th></tr>${recs.length ? recs.map(([sn, r]) => `<tr><td>${sn}年目</td><td>${esc(r.club)}</td><td>${r.P}</td><td>${r.G}</td><td>${r.A}</td><td>${r.Y}</td><td>${r.R}</td></tr>`).join('') : '<tr><td colspan="7" class="none">まだ公式戦の記録はありません</td></tr>'}</table>`;
    } else if (pcPage === 1) {
      body = `<div class="pc-bars">${D.PARAMS.map((q) => { const v = p.pts[q.k], ri = C.rankInfo(v); return `<div class="pc-bar" title="${q.name}"><i class="bar"><i style="height:${Math.round(ri.pct * 100)}%"></i></i><b>${Math.floor(v)}</b><small>あと${Math.max(0, Math.ceil(ri.next - v))}</small></div>`; }).join('')}</div>`;
    } else {
      const n = C.slots(p), sk = p.skills || [], si = C.slotInfo(p);
      const cells = Array.from({ length: Math.max(n, sk.length) }, (_, k) => sk[k] ? `<button class="has pc-skb" data-sk="${sk[k]}">${esc(D.SKILLS[sk[k]].name)}<i>説明</i></button>` : '<span>？</span>');
      const u = p.uniq && D.UNIQ[p.uniq], uq = u ? `<details class="pc-uq"><summary><span class="pc-uqh">固有スキル${p.uniqLv >= 2 ? '・覚醒' : ''}</span><b>${esc(u.name)}</b><i class="pc-uqi">説明</i></summary><div class="pc-uqd"><p><span>発動</span>${esc(u.sw || u.when)}</p><p><span>効果</span>${esc(u.se || u.what)}</p>${u.st ? `<p><span>凸</span>${esc(u.st)}</p>` : ''}</div></details>` : '';
      body = `${uq}<div class="pc-sk"><div class="pc-skh">習得スキル　${sk.length}/${n}</div><div class="pc-skg">${cells.join('')}</div><div class="pc-skd" hidden></div></div><p class="pc-note">${si.nextAvg ? `能力の平均が ${si.nextAvg} になると、スキル枠がもう1つ増えます（今 ${Math.floor(si.avg)}）` : 'スキル枠はMAXです'}</p>`;
    }
    return `<div class="pc-card${embed ? ' pc-embed' : ''}"><img class="pc-emb" src="${emblemURL(save.team.name, 80)}" alt="">
      <div class="pc-head"><i class="pos ${POSC[p.position]}">${p.position}</i><b>${esc(p.name)}</b><span>${esc(save.team.name)}</span></div>
      <div class="pc-main">
        <div class="pc-left">
          <div class="pc-photo">${facePic(p, '', i >= 11)}<div class="pc-rare">${starHTML(C.ensureStar(p), p.totsu)}${capBadge(C.capGrade(p))}</div></div>
          <b class="pc-num">${p.number}</b>
          <div class="pc-meta"><span>タイプ</span>${typeBadge(p.type)}</div>
          <div class="pc-meta"><span>調子</span>${condGauge(p)}</div>
        </div>
        <div class="pc-right">
          <div class="pc-icons">${icons}</div>
          <div class="pc-grades${ups ? ' wd' : ''}">${grades}</div>
          <div class="pc-page">${body}</div>
          <div class="pc-dots"><button class="pc-nav prev ui-img" title="前の選手"><img src="icons/ui_next.png" alt="前へ" style="transform:scaleX(-1)"></button>${pages.map((nm, k) => `<button data-pg="${k}" class="${k === pcPage ? 'on' : ''}">${nm}</button>`).join('')}<button class="pc-nav next ui-img" title="次の選手"><img src="icons/ui_next.png" alt="次へ"></button></div>
        </div>
      </div>
      ${embed ? '' : '<button class="sb-round pc-close" title="もどる"><i class="bk-ico" aria-hidden="true"></i></button>'}
    </div>`;
  }
  // カードの中のボタン（ページ切り替え・前後の選手）をつなぐ。go(i) で別の選手へ
  function bindCard(root, i, go, redraw) {
    const n = save.team.players.length;
    bindSkillDesc(root);   // ページの中をタップしてもページは切り替えない（利き足・スキルの説明などを押せるように）
    root.querySelectorAll('[data-pg]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); pcPage = +b.dataset.pg; redraw(); });
    root.querySelector('.pc-nav.prev').onclick = (e) => { e.stopPropagation(); go((i + n - 1) % n); };
    root.querySelector('.pc-nav.next').onclick = (e) => { e.stopPropagation(); go((i + 1) % n); };
  }
  // 習得スキルの「説明」：押したスキルの説明を下に出す（もう一度押すと閉じる）
  function bindSkillDesc(root) {
    const box = root.querySelector('.pc-skd'); if (!box) return;
    root.querySelectorAll('.pc-skb').forEach((b) => b.onclick = (e) => { e.stopPropagation(); const k = b.dataset.sk, on = b.classList.contains('on');
      root.querySelectorAll('.pc-skb.on').forEach((x) => x.classList.remove('on'));
      if (on) { box.hidden = true; return; }
      b.classList.add('on'); box.innerHTML = `<b>${esc((D.SKILLS[k] || {}).name || k)}</b>${esc(SKILL_DESC[k] || '試合の中で、この技を使えるようになる')}`; box.hidden = false; });
    root.querySelectorAll('.pc-uq').forEach((d) => d.addEventListener('click', (e) => e.stopPropagation()));
  }
  function playerDetail(i, o = {}) {
    let el = document.getElementById('pcModal');
    if (!el) { el = document.createElement('div'); el.id = 'pcModal'; el.className = 'modal pc-wrap'; $('#career').appendChild(el); }
    el.innerHTML = playerCardHTML(i, null, false);
    { const ov = [...document.querySelectorAll('.lk-wrap')].some((w) => !w.hidden && w.id !== 'pcModal'); const host = ov ? document.getElementById('app') : $('#career'); if (el.parentElement !== host) host.appendChild(el); el.style.zIndex = ov ? 60 : ''; }   /* 版477：クラブ事務所（z 45）より前に */
    el.hidden = false;
    bindCard(el, i, (k) => playerDetail(k, o), () => playerDetail(i, o));
    el.classList.toggle('pc-office', !!o.office);
    if (o.office) officeSide(el, i, o);   /* 版480：クラブ事務所のチーム編成から開いた時は、右に「背番号・登録ポジション・登録名」 */
    if (o.noNav) el.querySelectorAll('.pc-nav').forEach((b) => b.remove());   /* 版470：ランキングから開いた時は、前後の選手への矢印なし */
    el.querySelector('.pc-close').onclick = () => { el.hidden = true; };
    el.onclick = (e) => { if (e.target === el) el.hidden = true; };
  }

  // 版480：選手カードの右の3つ（カルチョビットAのクラブ事務所 → チーム編成 → 選手と同じ）
  // 版512：チームの選手を放出（ほかのクラブへ移籍・覚醒のカケラになる）。スタメンが抜けたら控えから埋める
  async function releasePlayer(i, after) {
    const ps = save.team.players, p = ps[i]; if (!p) return;
    const MIN = 16;
    if (ps.length <= MIN) { coachAsk(`チームの選手が${MIN}人より少なくなるので、放出できません。`, [{ label: 'OK', value: true }]); return; }
    if (p.position === 'GK' && ps.filter((q) => q.position === 'GK').length <= 1) { coachAsk('GKがいなくなるので、放出できません。', [{ label: 'OK', value: true }]); return; }
    const kk = (C.KAKERA_OF[C.ensureStar(p)] || 1) * (1 + (p.totsu || 0));
    if (!(await coachAsk(`${esc(p.name)}を放出しますか？<br><small>ほかのクラブへ移籍します（戻ってきません）。<br>覚醒のカケラ <b>${kk}</b> をもらえます。</small>`))) return;
    if (i < 11) {   // スタメン：同じポジションの控え（いなければ先頭の控え）と入れかえてから抜く
      let j = -1; for (let k = 11; k < ps.length; k++) if (ps[k].position === (i === 0 ? 'GK' : p.position)) { j = k; break; }
      if (j < 0 && i === 0) for (let k = 11; k < ps.length; k++) if (ps[k].position === 'GK') { j = k; break; }
      if (j < 0) j = 11;
      ps[i] = ps[j]; ps[j] = p; { const pc = save.plan && save.plan.cards; if (pc) { const a = pc[i], b = pc[j]; if (b) pc[i] = b; else delete pc[i]; if (a) pc[j] = a; else delete pc[j]; } } i = j;
    }
    ps.splice(i, 1);
    { const pc = save.plan && save.plan.cards; if (pc) { const nc = {}; for (const k in pc) { const n = +k; if (n < i) nc[n] = pc[k]; else if (n > i) nc[n - 1] = pc[k]; } save.plan.cards = nc; } }
    { const tac = C.ensureTactics(save); for (const k in (tac.roles || {})) if (tac.roles[k] === p.name) tac.roles[k] = null; }
    save.kakera = (save.kakera || 0) + kk; store();
    if (window.DotSound) try { DotSound.play('tap'); } catch (_) {}
    if (after) after();
  }
  function officeSide(el, i, o) {
    const p = save.team.players[i];
    const side = document.createElement('div'); side.className = 'pc-side';
    side.innerHTML = [['num', 'pc_number', '背番号'], ['pos', 'pc_pos', '登録ポジション'], ['name', 'pc_name', '登録名'], ['rel', 'pc_release', '放出']].map(([a, f, l]) => `<button data-ed="${a}" title="${l}"><img src="icons/${f}.png" alt="${l}"></button>`).join('');
    el.appendChild(side);
    // 版506：カードは画面に収まる大きさに縮めて、右のボタンと重ならない所へ（スマホで見切れないように）
    { const card = el.querySelector('.pc-card'); if (card) { card.style.transform = ''; const W = el.clientWidth, H = el.clientHeight, cw = card.offsetWidth, ch = card.offsetHeight, avail = W - 96 - 12 - 24 - 16; const k = Math.min(1, avail / cw, (H - 16) / ch); card.style.position = 'absolute'; card.style.left = Math.max(12, (avail - cw * k) / 2 + 12) + 'px'; card.style.top = ((H - ch * k) / 2) + 'px'; card.style.transform = `scale(${k.toFixed(3)})`; card.style.transformOrigin = '0 0'; } }
    const done = () => { store(); playerDetail(i, o); if (o.onChange) o.onChange(); };
    const dlg = (title, body, bind) => {
      const d = document.createElement('div'); d.className = 'pc-edit'; d.innerHTML = `<div class="pe-in"><h3>${title}</h3>${body}<div class="pe-btns"><button class="pe-no ib ib-no ib-img">やめる</button></div></div>`;
      el.appendChild(d); d.onclick = (e) => { e.stopPropagation(); if (e.target === d) d.remove(); }; { const okb = d.querySelector('.pe-ok'), nob = d.querySelector('.pe-no'); if (okb && nob) { okb.parentElement.appendChild(nob); } }   /* 版528：決定とやめるを横に並べる */ d.querySelector('.pe-no').onclick = () => d.remove(); bind(d);
    };
    side.querySelectorAll('[data-ed]').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); const a = b.dataset.ed;
      if (a === 'rel') { releasePlayer(i, () => { el.hidden = true; if (o.onChange) o.onChange(); }); return; }   // 版512：放出
      if (a === 'num') {
        const used = new Map(save.team.players.map((q) => [q.number, q]));
        let h = '<div class="pe-nums">'; for (let n = 1; n <= 99; n++) { const q = used.get(n); h += `<button data-n="${n}" class="${q === p ? 'me' : q ? 'used' : ''}" title="${q ? esc(q.name) : ''}">${n}${q && q !== p ? `<small>${esc(q.name)}</small>` : ''}</button>`; } h += '</div><p class="pe-note">ほかの選手の番号を選ぶと、その選手と番号を入れかえます。</p>';
        dlg(`${esc(p.name)}の背番号`, h, (d) => d.querySelectorAll('[data-n]').forEach((x) => x.onclick = () => { const n = +x.dataset.n, q = used.get(n); if (q === p) { d.remove(); return; } if (q) q.number = p.number; p.number = n; done(); }));
      } else if (a === 'pos') {
        const POS = [['GK', 'ゴールキーパー'], ['DF', 'ディフェンダー'], ['MF', 'ミッドフィルダー'], ['FW', 'フォワード']];
        dlg(`${esc(p.name)}の登録ポジション`, `<div class="pe-pos">${POS.map(([k, l]) => `<button data-p="${k}" class="${p.position === k ? 'me' : ''}"><i class="pos ${POSC[k]}">${k}</i><span>${l}</span></button>`).join('')}</div><p class="pe-note">試合で出るポジションは、スタメン画面のマスで決まります。</p>`, (d) => d.querySelectorAll('[data-p]').forEach((x) => x.onclick = () => { p.position = x.dataset.p; done(); }));
      } else {
        dlg(`${esc(p.name)}の登録名`, `<input class="pe-name" maxlength="6" value="${esc(p.name)}"><p class="pe-note">6文字まで。チームのほかの選手と同じ名前は使えません。</p><p class="pe-err" hidden></p><div class="pe-btns"><button class="pe-ok primary ib ib-ok ib-img">決定</button></div>`, (d) => {
          const inp = d.querySelector('.pe-name'); setTimeout(() => inp.focus(), 50);
          d.querySelector('.pe-ok').onclick = () => { const v = inp.value.trim(), er = d.querySelector('.pe-err');
            if (!v) { er.textContent = '名前を入れてください。'; er.hidden = false; return; }
            if (save.team.players.some((q) => q !== p && q.name === v)) { er.textContent = '同じ名前の選手がいます。'; er.hidden = false; return; }
            const old = p.name; p.name = v; try { const tac = C.ensureTactics(save); for (const k in (tac.roles || {})) if (tac.roles[k] === old) tac.roles[k] = v; } catch (_) {} done(); };   // 役割（キッカーなど）の名前も合わせる
        });
      }
    });
  }

  // ================= 特訓 =================
  const sprURL = new Map();
  function portrait(p, big) {
    const key = p.name + (p.position === 'GK' ? 'g' : '') + p.hair + p.hairColor + p.skin;
    if (!sprURL.has(key)) sprURL.set(key, A().spriteCanvas(p, 0, 'front', 0, false, p.position === 'GK').toDataURL());
    return `<img class="pt${big ? ' big' : ''}" src="${sprURL.get(key)}" alt="">`;
  }

  // ================= 顔（会話・選手カード用）：1枚絵の顔を、選手ごとに髪・肌・ユニフォームの色を塗り替えて使う =================
  // 顔の絵は faces/faces.js（window.FACE_SET）。どの絵を使うかは選手ごとに p.face に記録（同じ番号なら必ず同じ顔）
  const FACE_SKIN = ['#f3c49a', '#dca06c', '#9e6844'], FACE_HAIR = ['#2a2420', '#5e3e26', '#d4ad58', '#3e2c22', '#a4452e'];
  const faceImg = []; let faceLoaded = 0, faceTotal = 0;
  const faceCache = new Map(), facePending = new Map();
  function faceLoad() {
    if (faceTotal) return;
    const set = window.FACE_SET || [];
    set.forEach((f, i) => {
      faceImg[i] = {};
      for (const k of ['img', 'mask']) { faceTotal++; const im = new Image(); im.onload = im.onerror = () => { faceLoaded++; if (faceLoaded === faceTotal) faceFill(); }; im.src = f[k]; faceImg[i][k] = im; }
    });
  }
  // 画像が読み込めたら、待っていた顔をまとめて差し替える
  function faceFill() { document.querySelectorAll('img[data-face]').forEach((im) => { const fp = facePending.get(im.dataset.face); const u = fp && faceURL(fp.p, fp.bib); if (u) { im.src = u; im.removeAttribute('data-face'); } }); }
  // 瞳の色（茶のまま・黒・青灰・緑・琥珀）
  const FACE_IRIS = [null, '#2a1a12', '#4f6f8f', '#4f7a4a', '#9a6a2a'];   // そのまま（茶）・黒・青灰・緑・琥珀
  // 顔は1枚絵のまま使う（貼り替え・変形はしない）。同じチームの中では全員ちがう顔になるように選ぶ
  function faceGenes(p) {
    const set = window.FACE_SET || [], n = set.length || 1;
    const team = save && save.team && save.team.players.includes(p) ? save.team.players : null;
    const used = new Set(team ? team.filter((q) => q !== p && q.face && q.face.v === 6).map((q) => q.face.id) : []);
    if (p.face && p.face.v === 6 && p.face.id < n && p.face.hs === p.face.id && !used.has(p.face.id)) return p.face;
    let h = 2166136261; for (const ch of (p.name || '') + '|' + (p.number || 0) + '|' + (p.hair || 0)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const r = () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return h / 4294967296; };
    let id = Math.floor(r() * n);
    for (let k = 0; k < n && used.has(id); k++) id = (id + 1) % n;
    // 髪型：半分くらいの選手は、ほかの顔の髪型にかえる
    // （前髪が眉まで下りている顔は、髪を外すと前髪の跡が残るので入れかえない）
    const hs = id;   // 髪型の入れ替えはしない（顔は1枚絵のまま、色だけ変える）
    p.face = { v: 6, id, hs, iris: r() < 0.6 ? 0 : 1 + Math.floor(r() * (FACE_IRIS.length - 1)) };
    return p.face;
  }
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const faceData = [];
  function faceDataOf(i) {
    if (faceData[i]) return faceData[i];
    const im = faceImg[i].img, mk = faceImg[i].mask, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
    x.drawImage(im, 0, 0); const img = x.getImageData(0, 0, c.width, c.height).data;
    x.clearRect(0, 0, c.width, c.height); x.drawImage(mk, 0, 0); const msk = x.getImageData(0, 0, c.width, c.height).data;
    return (faceData[i] = { img, msk, W: c.width, H: c.height });
  }
  // 顔の絵（dataURL）。まだ読み込めていなければ null
  // bib：控え選手はユニフォームの上にビブス（肩から下の胴の部分だけ、蛍光色のメッシュ）
  function faceURL(p, bib) {
    if (p.faceKey && window.STAR_FACES && p.faceKey in window.STAR_FACES) return starFace(p.faceKey, (C.ensureClub(save).kit || {}).shirt || '#2f6fd6', p.position === 'GK', STAR_FIT);   // 版505：スカウトで来た選手は、元の顔
    faceLoad();
    if (!faceTotal || faceLoaded < faceTotal) return null;
    const g = faceGenes(p), set = window.FACE_SET, F = set[g.id], skin = FACE_SKIN[p.skin || 0] || FACE_SKIN[0], hair = FACE_HAIR[p.hairColor || 0] || FACE_HAIR[0], gk = p.position === 'GK';
    const key = [g.id, g.hs, g.iris, skin, hair, gk ? 1 : 0, bib ? 1 : 0].join('|');
    if (faceCache.has(key)) return faceCache.get(key);
    const B = faceDataOf(g.id), W = B.W, H = B.H;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const d = x.createImageData(W, H), px = d.data; px.set(B.img); const md = new Uint8ClampedArray(B.msk);
    // 瞳の色
    const iris = FACE_IRIS[g.iris];
    if (iris) {
      const ti = hexRgb(iris), rx = F.d * 0.24, ry = F.d * 0.2;
      for (const ex2 of [F.ex - F.d / 2, F.ex + F.d / 2]) for (let y = Math.floor(F.ey - ry); y <= F.ey + ry; y++) for (let x2 = Math.floor(ex2 - rx); x2 <= ex2 + rx; x2++) {
        const i = (y * W + x2) * 4, r = px[i], gg = px[i + 1], b = px[i + 2], l = r * 0.3 + gg * 0.59 + b * 0.11, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        if (md[i + 1] > 128 || md[i] > 128) continue;
        if (r >= gg && gg >= b - 6 && (mx - mn) > 22 && l > 30 && l < 170) { const k = l / 95; px[i] = Math.min(255, ti[0] * k * 1.25); px[i + 1] = Math.min(255, ti[1] * k * 1.25); px[i + 2] = Math.min(255, ti[2] * k * 1.25); }
      }
    }
    const ts = hexRgb(skin), th = hexRgb(hair), bs = F.skin;
    const thL = th[0] * 0.3 + th[1] * 0.59 + th[2] * 0.11, hairK = (thL > 90 ? 1.08 : 1) / set[g.hs].hairL;   // 明るい髪は少し持ち上げる
    const tg = [242, 200, 30];
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      if (md[i] > 200) { const l = (r * 0.3 + gg * 0.59 + b * 0.11) * hairK; px[i] = Math.min(255, th[0] * l + (l > 1 ? (l - 1) * 30 : 0)); px[i + 1] = Math.min(255, th[1] * l + (l > 1 ? (l - 1) * 26 : 0)); px[i + 2] = Math.min(255, th[2] * l + (l > 1 ? (l - 1) * 22 : 0)); }
      else if (md[i + 1] > 128) { px[i] = Math.min(255, r * ts[0] / bs[0]); px[i + 1] = Math.min(255, gg * ts[1] / bs[1]); px[i + 2] = Math.min(255, b * ts[2] / bs[2]); }
      else if (gk && md[i + 2] > 250) { const l = (r * 0.3 + gg * 0.59 + b * 0.11) / F.shirtL; px[i] = Math.min(255, tg[0] * l); px[i + 1] = Math.min(255, tg[1] * l); px[i + 2] = Math.min(255, tg[2] * l); }
    }
    if (bib) {
      // 胴の真ん中（両肩の内側）だけを塗る。えりぐりは元のユニフォームのまま残す
      let top = H; for (let y = 0; y < H && top === H; y++) for (let x2 = 0; x2 < W; x2++) if (md[(y * W + x2) * 4 + 2] > 250) { top = y; break; }
      const half = F.d * 1.55, neck = top + F.d * 0.35;
      const o = B.img;   // 元の絵（塗り替える前）の明るさでしわ・影を残す
      const inBib = (x2, y) => { if (x2 < 0 || x2 >= W || y < top || y >= H) return false; const i = (y * W + x2) * 4; if (md[i + 2] <= 250) return false;
        const dx = Math.abs(x2 - F.ex), sh = half - Math.max(0, (top + F.d * 0.9 - y)) * 0.9;   // 肩はなで肩に細く
        return dx <= sh && !(y < neck + F.d * 0.25 && dx < F.d * 0.42); };   // えりぐりは残す
      for (let y = top; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
        const i = (y * W + x2) * 4; if (!px[i + 3] || !inBib(x2, y)) continue;
        const edge = !inBib(x2 - 3, y) || !inBib(x2 + 3, y) || !inBib(x2, y - 3);
        const l = (o[i] * 0.3 + o[i + 1] * 0.59 + o[i + 2] * 0.11) / F.shirtL, mesh = ((x2 >> 1) + (y >> 1)) % 2 ? 0.93 : 1, k = l * mesh * (edge ? 0.62 : 1);
        px[i] = Math.min(255, 196 * k); px[i + 1] = Math.min(255, 236 * k); px[i + 2] = Math.min(255, 52 * k);
      }
    }
    x.putImageData(d, 0, 0);
    const url = c.toDataURL(); faceCache.set(key, url); return url;
  }
  // 顔の<img>（読み込み前はドット絵を出しておき、読み込めたら差し替え）
  let faceRetryT = 0, faceRetryN = 0;
  function faceRetry() { if (faceRetryT) return; faceRetryN = 0; const tick = () => { faceRetryT = 0; try { faceFill(); } catch (_) {} if (document.querySelector('img[data-face]') && ++faceRetryN < 20) faceRetryT = setTimeout(tick, 400); }; faceRetryT = setTimeout(tick, 300); }
  function facePic(p, cls, bib) {
    const url = faceURL(p, bib);
    if (url) return `<img class="fc ${cls || ''}" src="${url}" alt="" draggable="false">`;
    const id = 'f' + (p.name || '') + (p.number || '') + (bib ? 'b' : ''); facePending.set(id, { p, bib });
    faceRetry();   // 版513：読み込みが終わったのに入れ替わらない顔が残らないよう、少し待って入れ直す
    return `<img class="fc ${cls || ''}" data-face="${esc(id)}" src="${sprURL.get(p.name + (p.position === 'GK' ? 'g' : '') + p.hair + p.hairColor + p.skin) || BLANK}" alt="" draggable="false">`;
  }
  // コーチのドット絵：選手の絵の服を黒いジャージに塗り替える
  let coachURL = null;
  function coachFace() {
    if (!coachURL) {
      const src = A().spriteCanvas({ name: 'coach', hair: 1, hairColor: 0, skin: 2 }, 0, 'front', 0, false, false);
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const x = c.getContext('2d'); x.drawImage(src, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), px = d.data;
      const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const MAP = [['#2f6fd6', '#2a2d31'], ['#6ea2f2', '#4b5056'], ['#1d4796', '#16181b']].map(([a2, b2]) => [hex(a2), hex(b2)]);
      for (let i = 0; i < px.length; i += 4) for (const [f, t] of MAP) if (px[i] === f[0] && px[i + 1] === f[1] && px[i + 2] === f[2]) { px[i] = t[0]; px[i + 1] = t[1]; px[i + 2] = t[2]; }
      x.putImageData(d, 0, 0); coachURL = c.toDataURL();
    }
    if (staffImg.coach) return `<img class="pt big art" src="${staffImg.coach}" alt="コーチ">`;   // コーチの顔イラストがあればそれ
    return `<img class="pt big" src="${coachURL}" alt="コーチ">`;
  }
  const GROUP_NAME = { dribble: 'ドリブル', shot: 'シュート', pass: 'パス', set: 'セットプレー', def: '守備', gk: 'GK', offball: 'オフザボール', mental: 'メンタル', undefined: 'キック' };
  function menuLabel(id, p) {
    if (!id) return p.position === 'GK' ? 'セービング' : 'ミニゲーム';
    const [k, key] = id.split(':');
    if (k === 'n') return C.MENUS[key].name; if (k === 's') return C.SPECIAL[key].name; return D.SKILLS[key].name + '特訓';
  }
  // カードの残り枚数（ほかの選手にセット済みの分を引く）
  function cardLeft(c) { let used = 0; for (const k in save.plan.cards) used += save.plan.cards[k].filter((x) => x === c).length; return (save.cards[c] || 0) - used; }
  const CATC = { tact: 'cat-tact', tech: 'cat-tech', phys: 'cat-phys', sup: 'cat-sup' };
  function cardTile(c, extra, cls) { const cd = C.CARDS[c]; return `<button class="tcard2 ${CATC[cd.cat]} ${cls || ''}" data-c="${c}"><b>${esc(cd.name)}</b><span>${Object.entries(cd.up).map(([k, v]) => `<i class="cu">${ico(k, 'sm')}+${v}</i>`).join('') || (cd.rand ? '疲労回復・ランダム' : cd.all ? '全能力+1' : cd.fat < 0 ? '疲労回復' : '')}${cd.fat < 0 && Object.keys(cd.up).length ? ' 回復' : ''}</span><em class="fat">疲労${cd.fat > 0 ? '+' : ''}${cd.fat}</em>${extra || ''}</button>`; }
  function gauge(v, add) {
    const a = C.rankInfo(v), b = C.rankInfo(Math.min(C.PMAX - 1, v + (add || 0)));
    const up = b.g !== a.g;
    return `<span class="gw"><span class="rk gr-${a.g}">${a.g}</span><span class="gbar"><i style="width:${a.pct * 100}%"></i>${add > 0 ? `<em style="left:${a.pct * 100}%;width:${up ? (1 - a.pct) * 100 : (b.pct - a.pct) * 100}%"></em>` : ''}</span>${up ? `<span class="rkup">→ <b class="rk gr-${b.g}">${b.g}</b></span>` : ''}</span>`;
  }
  // 能力の一覧：上に名前、大きなランク、下に次のランクまでのゲージ（セット中のカードで伸びる分は黄色）
  const G = { phys: 'pg-phys', tech: 'pg-tech', mind: 'pg-mind' };
  const PSHORT = { speed: 'スピード', dash: '瞬発力', stamina: 'スタミナ', physical: 'フィジカル', jump: 'ジャンプ', kick: 'キック', technique: 'テクニック', dribble: 'ドリブル', pass: 'パス', defense: '守備', vision: '判断', mental: 'メンタル' };
  function paramGrid(p, ups) {
    C.ensurePts(p);
    return `<div class="pgrid">${D.PARAMS.map((q) => { const v = p.pts[q.k], a = C.rankInfo(v), add = (ups && ups[q.k]) || 0, b = C.rankInfo(Math.min(C.PMAX - 1, Math.max(v, Math.min(C.capPts(p), v + Math.max(0, add)))));
      return `<div class="pg ${G[q.g]}${add > 0 ? ' up' : ''}" title="${q.name} ${Math.floor(v)}（次のランクまであと${Math.max(0, Math.ceil(a.next - v))}）"><i>${ico(q.k, 'sm')}${PSHORT[q.k] || q.name}</i><b class="big gr-${a.g}">${a.g}</b>${b.g !== a.g ? `<em class="pg-up gr-${b.g}">→${b.g}</em>` : ''}<span class="mg2"><s style="width:${a.pct * 100}%"></s>${add > 0 ? `<u style="left:${a.pct * 100}%;width:${(b.g !== a.g ? 1 - a.pct : b.pct - a.pct) * 100}%"></u>` : ''}</span></div>`; }).join('')}</div>`;
  }
  // 特訓カード（絵柄つき）：手札・セット枠・ショップで共通
  function upsHTML(cd) {
    return Object.entries(cd.up).map(([k, v]) => `<i class="cu">${ico(k, 'sm')}+${v}</i>`).join('') || `<i class="cu tx">${cd.rand ? '疲労回復・ランダム' : cd.all ? '全能力+1' : cd.fat < 0 ? '疲労回復' : ''}</i>`;
  }
  function artCard(c, opt) {
    opt = opt || {}; const cd = C.CARDS[c];
    const tip = `${cd.name}：${Object.entries(cd.up).map(([k, v]) => `${C.PNAME[k]}+${v}`).join(' ')}${cd.fat ? `　疲労${cd.fat > 0 ? '+' : ''}${cd.fat}` : ''}`;
    return `<button class="acard ${CATC[cd.cat]} ${opt.cls || ''}" data-c="${c}" title="${esc(tip)}"><img src="cards/${c}.jpg" alt="${esc(cd.name)}" draggable="false">${opt.ups ? `<span class="ac-up">${upsHTML(cd)}<em>疲労${cd.fat > 0 ? '+' : ''}${cd.fat}</em></span>` : ''}${opt.cnt != null ? `<i class="ac-cnt">×${opt.cnt}</i>` : ''}${opt.extra || ''}</button>`;
  }
  // 特訓画面：いつも同じ大きさの「ボード」に組んで、画面に合わせて拡大縮小（スクロールなしで全部のカードが見える）
  const TRB_W = 1120, TRB_H = 620;
  function fitBoard() {
    const b = document.querySelector('#clubLayer .trb'); if (!b) return;
    const L = $('#clubLayer'), w = L.clientWidth, h = L.clientHeight, s = Math.min(w / TRB_W, h / TRB_H);
    b.style.transform = `scale(${s})`; b.style.left = Math.max(0, (w - TRB_W * s) / 2) + 'px'; b.style.top = Math.max(0, (h - TRB_H * s) / 2) + 'px';
  }
  addEventListener('stagefit', fitBoard); addEventListener('resize', fitBoard);
  let trbScroll = null;
  function renderTrain() {
    { const old = document.querySelector('#clubLayer .trb-line'); if (old) trbScroll = old.scrollLeft; }   // 版538：選手を選んでも、横の位置をそのままに
    setTimeout(() => { const ln = document.querySelector('#clubLayer .trb-line'); if (!ln) return; if (trbScroll != null) ln.scrollLeft = trbScroll; const se = ln.querySelector('.tl2.sel'); if (se && (se.offsetLeft < ln.scrollLeft || se.offsetLeft + se.offsetWidth > ln.scrollLeft + ln.clientWidth)) ln.scrollLeft = se.offsetLeft - ln.clientWidth / 2 + se.offsetWidth / 2; }, 0);
    const ps = save.team.players, p = ps[selIdx];
    save.plan.cards = save.plan.cards || {};
    const done = C.trainedThisWeek(save, p);
    const mine = done ? [] : (save.plan.cards[selIdx] || []);
    const pv = C.previewCards(p, mine, C.trainMult(save));
    const camp = C.campState(save), nDone = C.trainsDone(save, p), lim = C.trainLimit(save);
    const found = new Set(save.spFound || []);
    // 選手の列（顔と背番号）
    const line = ps.map((q, i) => `<button class="tl2${i === selIdx ? ' sel' : ''}${q.injury > 0 ? ' inj' : ''}${i >= 11 ? ' sub' : ''}${i >= 11 + C.BENCH_N ? ' out' : ''}${i === 11 || i === 11 + C.BENCH_N ? ' gap' : ''}" data-i="${i}">${facePic(q, 'tl2f', i >= 11)}<b><i class="pos ${POSC[q.position]}">${q.position}</i>${q.number}</b><small class="tl2n">${esc(q.name)}</small>${C.trainedThisWeek(save, q) ? '<em class="dn">済</em>' : C.trainsDone(save, q) ? `<em class="hf">あと${lim - C.trainsDone(save, q)}</em>` : (save.plan.cards[i] || []).length ? `<em class="pl">${(save.plan.cards[i] || []).length}枚</em>` : ''}</button>`).join('');
    // セット枠
    const slots = [0, 1, 2].map((k) => mine[k] ? artCard(mine[k], { cls: 'slot', extra: '<i class="x">×</i>' }) : '<div class="tslot2">カード</div>').join('');
    const sp = pv.sp ? (found.has(pv.sp.id) ? `<div class="spban">スペシャルメニュー「${esc(pv.sp.name)}」${pv.sp.skill ? `<small>${(p.skills || []).includes(pv.sp.skill) ? `${esc(D.SKILLS[pv.sp.skill].name)}は習得ずみ（能力だけ上がる）` : `${esc(D.SKILLS[pv.sp.skill].name)}を覚えるチャンス（${Math.round(C.skillRate(p, pv.sp.skill) * 100)}%）`}</small>` : pv.sp.type ? `<small>タイプが${esc(pv.sp.type)}に近づく</small>` : ''}</div>` : '<div class="spban new">！？ スペシャルメニューの予感…</div>') : '';
    const msg = p.injury > 0 ? 'ケガで今週は休みです' : done ? `今週の特訓（${lim}回）は終わりました` : camp && nDone ? `合宿中なので、もう1回特訓できます（${nDone}/${lim}回目終了）` : mine.length ? '' : '下のカードを最大3枚えらぼう（3枚の組み合わせでスペシャルメニュー）';
    // 手札（全種類を並べる。持っていないカードは暗く）
    const cats = ['tact', 'tech', 'phys', 'sup'];
    const hand = cats.map((cat) => `<div class="hg ${CATC[cat]}"><span class="hg-l">${C.CAT_NAME[cat]}</span><div class="hg-c">${Object.keys(C.CARDS).filter((c) => C.CARDS[c].cat === cat).map((c) => { const n = cardLeft(c); return artCard(c, { cnt: n, cls: n <= 0 || p.injury > 0 || done ? 'none' : '' }); }).join('')}</div></div>`).join('');
    $('#clubLayer').innerHTML = `<div class="trb" style="width:${TRB_W}px;height:${TRB_H}px">
      <div class="trb-card">${playerCardHTML(selIdx, pv.ups, true)}</div>
      <div class="trb-set">
        <div class="ts-h">${camp ? `<span class="tauto camp">⛺ ${esc(camp.name)}（${camp.week}/${camp.weeks}週目）特訓は週${camp.trains}回・効果${camp.mult}倍</span>` : '<span class="tauto">全体練習は毎週自動</span>'}<button id="spList" class="splist">SPリスト</button></div>
        <div class="tslots2">${slots}</div>${sp}${msg ? `<p class="ts-msg">${msg}</p>` : ''}
        ${mine.length && !done && !(p.injury > 0) ? '<button id="doTrain" class="dotrain">特訓する！</button>' : ''}
      </div>
      <div class="trb-line">${line}</div>
      <div class="trb-hand">${hand}</div>
    </div>`;
    fitBoard();
    const L = $('#clubLayer');
    bindCard(L.querySelector('.trb-card'), selIdx, (j) => { selIdx = j; renderTrain(); }, renderTrain);
    L.querySelectorAll('.tl2').forEach((el) => el.onclick = () => { selIdx = +el.dataset.i; renderTrain(); });
    L.querySelectorAll('.tslots2 .acard').forEach((el, k) => el.onclick = () => { mine.splice(k, 1); save.plan.cards[selIdx] = mine; store(); renderTrain(); });
    L.querySelectorAll('.trb-hand .acard').forEach((el) => el.onclick = () => {
      const c = el.dataset.c; if (p.injury > 0 || done || mine.length >= 3 || cardLeft(c) <= 0) return;
      mine.push(c); save.plan.cards[selIdx] = mine; store(); renderTrain();
    });
    $('#spList').onclick = () => spList();
    const bt = $('#doTrain'); if (bt) bt.onclick = () => doTrain(selIdx);
  }
  // SPリスト（版467・作り直し）：スペシャルメニューの図鑑。見つけたメニューはカードの絵・効果・覚えるスキルまで見られ、選手を選んでそのまま特訓できる
  let spSel = -1, spFilter = 'all';
  function spList(pi) {
    const ps = save.team.players;
    if (pi == null) pi = selIdx;
    const found = new Set(save.spFound || []);
    const el = fullScreen('spScreen', 'std-wrap sp-wrap'), box = el.querySelector('.lk-box');
    const J = { kick: 'キック', technique: 'テクニック', dribble: 'ドリブル', pass: 'パス', speed: 'スピード', dash: '瞬発力', stamina: 'スタミナ', physical: 'フィジカル', jump: 'ジャンプ', defense: '守備', vision: '判断', mental: 'メンタル' };
    const kindOf = (m) => (m.skill ? 'skill' : m.type ? 'type' : 'up');
    const all = C.SP.map((m, idx) => ({ m, idx })).filter((o) => spFilter === 'all' || kindOf(o.m) === spFilter);
    if (spSel < 0 || !C.SP[spSel]) { const f = all.find((o) => found.has(o.m.id)); spSel = f ? f.idx : (all[0] || { idx: 0 }).idx; }
    const cardImg = (c, known, cls) => known ? `<span class="spc ${CATC[C.CARDS[c].cat]} ${cls || ''}${(save.cards[c] || 0) < 1 ? ' lack' : ''}"><img src="cards/${c}.jpg" alt="" draggable="false"><em>×${save.cards[c] || 0}</em></span>` : `<span class="spc unk ${CATC[C.CARDS[c].cat]} ${cls || ''}"><i>？</i></span>`;
    const tiles = all.map(({ m, idx }) => { const k = found.has(m.id), kd = kindOf(m);
      return `<button class="spt${k ? ' k' : ''}${idx === spSel ? ' sel' : ''} kd-${kd}" data-sp="${idx}"><div class="spt-c">${m.cards.map((c) => cardImg(c, k)).join('')}</div><b>${k ? esc(m.name) : '？？？'}</b><small>${k ? (m.skill ? 'スキル：' + esc(D.SKILLS[m.skill].name) : m.type ? 'タイプ：' + esc(m.type) : '能力アップ') : (kd === 'skill' ? 'スキルを覚えるメニュー' : kd === 'type' ? 'タイプが変わるメニュー' : '能力が伸びるメニュー')}</small>${m.gk ? '<i class="spt-gk">GK</i>' : ''}</button>`; }).join('');
    const m = C.SP[spSel], known = found.has(m.id), p = ps[pi];
    const canP = !(p.injury > 0) && !C.trainedThisWeek(save, p), lack = m.cards.filter((c) => (save.cards[c] || 0) < 1), gkNg = m.gk && p.position !== 'GK';
    const ok = known && canP && !lack.length && !gkNg;
    const why = !known ? 'まだ見つけていないメニューです' : !canP ? (p.injury > 0 ? `${esc(p.name)}はケガ中です` : `${esc(p.name)}は今週もう特訓しました`) : gkNg ? 'GK専用のメニューです' : lack.length ? `${lack.map((c) => esc(C.CARDS[c].name)).join('・')}のカードが足りません` : '';
    const ups = known ? [...(m.all ? [`<span class="spu all">全能力<b>+${m.all}</b></span>`] : []), ...D.PARAM_KEYS.filter((k) => (m.up || {})[k]).map((k) => `<span class="spu">${ico(k)}${J[k]}<b>${m.up[k] > 0 ? '+' : ''}${m.up[k]}</b></span>`)].join('') : '<p class="sp-q">特訓で、このカードの組み合わせを試すと見つかります。<br>（色はカードの種類のヒント）</p>';
    const rate = known && m.skill ? Math.round(C.skillRate(p, m.skill) * 100) : null;
    const who = ps.map((q, i) => `<button class="spw${i === pi ? ' on' : ''}${q.injury > 0 || C.trainedThisWeek(save, q) ? ' done' : ''}" data-pi="${i}">${portrait(q)}<b>${esc(q.name)}</b><i class="pos ${POSC[q.position]}">${q.position}</i>${q.injury > 0 ? '<em>ケガ</em>' : C.trainedThisWeek(save, q) ? '<em>済</em>' : ''}</button>`).join('');
    const nF = C.SP.filter((x) => found.has(x.id)).length;
    box.innerHTML = `<div class="sp2"><div class="sp2-h"><b>スペシャルメニュー</b><div class="sp2-bar"><i style="width:${(nF / C.SP.length * 100).toFixed(1)}%"></i></div><span>発見 ${nF} / ${C.SP.length}</span><button class="std-back sp2-back" title="もどる"><i class="bk-ico" aria-hidden="true"></i></button></div>
      <div class="sp2-tabs">${[['all', 'すべて'], ['skill', 'スキル'], ['type', 'タイプ'], ['up', '能力']].map(([k, l]) => `<button data-f="${k}" class="${spFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="sp2-grid">${tiles}</div>
      <div class="sp2-d"><div class="sp2-dc">${m.cards.map((c) => cardImg(c, known, 'big')).join('<i class="sp2-plus">＋</i>')}</div>
        <h3>${known ? esc(m.name) : '？？？'}</h3>
        ${known && m.skill ? `<div class="sp2-sk"><span>覚えるスキル</span><b>${esc(D.SKILLS[m.skill].name)}</b><div class="sp2-rate"><i style="width:${rate}%"></i><em>${esc(p.name)}の成功率 ${rate}%</em></div></div>` : ''}
        ${known && m.type ? `<div class="sp2-sk ty"><span>近づくタイプ</span><b>${esc(m.type)}</b></div>` : ''}
        <div class="sp2-ups">${ups}</div>
        <div class="sp2-who"><span>特訓する選手</span><div class="sp2-ws">${who}</div></div>
        <button class="sp2-go dotrain"${ok ? '' : ' disabled'}>${ok ? `${esc(p.name)}で特訓する！` : why}</button></div></div>`;
    el.hidden = false; el._fit();
    box.querySelector('.sp2-back').onclick = () => { el.hidden = true; renderTrain(); };
    box.querySelectorAll('[data-sp]').forEach((b) => b.onclick = () => { spSel = +b.dataset.sp; spList(pi); });
    box.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { spFilter = b.dataset.f; spSel = -1; spList(pi); });
    box.querySelectorAll('[data-pi]').forEach((b) => b.onclick = () => spList(+b.dataset.pi));
    { const g = box.querySelector('.sp2-grid .sel'); if (g) g.scrollIntoView({ block: 'nearest' }); const w = box.querySelector('.spw.on'); if (w) w.scrollIntoView({ block: 'nearest', inline: 'center' }); }
    const go = box.querySelector('.sp2-go:not([disabled])');
    if (go) go.onclick = () => { el.hidden = true; selIdx = pi; save.plan.cards = save.plan.cards || {}; save.plan.cards[pi] = m.cards.slice(); store(); doTrain(pi); };
  }

  // ================= スタメン・戦術（スカッド） =================
  let pick = -1, sqTab = 'pos';
  function swapPlayers(i, j) {
    const ps = save.team.players, a = ps[i], b = ps[j];
    if ((i === 0 || j === 0) && (a.position === 'GK') !== (b.position === 'GK')) return false;   // GKの位置はGKだけ
    ps[i] = b; ps[j] = a;
    const pc = save.plan.cards || (save.plan.cards = {}); const ea = pc[i], eb = pc[j]; if (eb) pc[i] = eb; else delete pc[i]; if (ea) pc[j] = ea; else delete pc[j];
    return true;
  }
  const ROLE_NAME = { captain: 'キャプテン', pk: 'PKキッカー', fk: 'FKキッカー', ck: 'CKキッカー' }, ROLE_TAG = { captain: 'C', pk: 'PK', fk: 'FK', ck: 'CK' };
  // ================= スタメン（カルチョビットAのボード）：マス目のピッチに顔を並べ、ドラッグで動かす・入れ替える =================
  let sqShow = 'cond', sqDrag = null, sqPop = -1, sqNote = false, sqFromHome = false, sqRes = -1, sqResOpen = false;
  // 顔の白い背景を抜く（ふちから続く白だけ透明に）。小さく描いてもにじまないよう、ほどよい大きさで作っておく
  const cutCache = new Map();
  function cutFace(img) {
    const src = img.currentSrc || img.src; if (!src || src.length < 64 || img.dataset.cut === src) return;
    if (cutCache.has(src)) { const u = cutCache.get(src); img.dataset.cut = u; img.src = u; return; }
    if (!img.complete || !img.naturalWidth) return;
    try {
      const S = 160, W0 = img.naturalWidth, H0 = img.naturalHeight, k = Math.min(1, S / Math.max(W0, H0)), W = Math.round(W0 * k), H = Math.round(H0 * k);
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H), px = d.data, seen = new Uint8Array(W * H), st = [];
      const white = (i) => px[i * 4 + 3] < 20 || (px[i * 4] > 225 && px[i * 4 + 1] > 225 && px[i * 4 + 2] > 225);
      for (let xx = 0; xx < W; xx++) st.push(xx, (H - 1) * W + xx); for (let yy = 0; yy < H; yy++) st.push(yy * W, yy * W + W - 1);
      while (st.length) { const i = st.pop(); if (seen[i] || !white(i)) continue; seen[i] = 1; px[i * 4 + 3] = 0; const xx = i % W, yy = (i - xx) / W; if (xx > 0) st.push(i - 1); if (xx < W - 1) st.push(i + 1); if (yy > 0) st.push(i - W); if (yy < H - 1) st.push(i + W); }
      x.putImageData(d, 0, 0); const u = c.toDataURL(); cutCache.set(src, u); img.dataset.cut = u; img.src = u;
    } catch (e) { /* 読めない時はそのまま */ }
  }

  // 版512：選手どうしが重ならないように（となりのマス＝縦横ななめ1マス以内には置かない）
  function unpile(cells) {
    const near = (a, b) => a && b && Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1;
    let moved = false;
    for (let i = 2; i < 11; i++) {
      if (!cells[i]) continue;
      if (![...Array(i).keys()].some((j) => j > 0 && near(cells[i], cells[j]))) continue;
      let best = null, bd = 1e9;
      for (let r = 0; r < C.GRID_R; r++) for (let c = 0; c < C.GRID_C; c++) {
        if (C.zoneOf(r) !== C.zoneOf(cells[i].r)) continue;
        const cand = { r, c }; if ([...Array(11).keys()].some((j) => j > 0 && j !== i && near(cand, cells[j]))) continue;
        const dd = Math.abs(r - cells[i].r) * 3 + Math.abs(c - cells[i].c); if (dd < bd) { bd = dd; best = cand; }
      }
      if (best) { cells[i] = best; moved = true; }
    }
    return moved;
  }
  // 版512：スマホ（画面の高さが低い）では、スタメン画面（1280×720で作ってある）を丸ごと縮めて収める
  function fitSq2() {   // 版513：選手カード（ポップ）が板からはみ出さないように寄せる
    const L = $('#clubLayer'), bd = L && L.querySelector('.s2board'), pp = bd && bd.querySelector('.s2pop'); if (!pp) return;
    const W = bd.clientWidth, H = bd.clientHeight, x = parseFloat(pp.style.left) || 0, y = parseFloat(pp.style.top) || 0;
    pp.style.left = Math.max(6, Math.min(W - pp.offsetWidth - 6, x)) + 'px'; pp.style.top = Math.max(6, Math.min(H - pp.offsetHeight - 6, y)) + 'px';
  }
  addEventListener('stagefit', () => { const L = $('#clubLayer'); if (L && L.querySelector('.sq2') && !$('#cv-club').hidden && !sqDrag && !document.querySelector('.s2drag')) renderLineup2(); });   // 版531：ドラッグ中は組み直さない
  // 版516：名前の札の中身を、表示の切りかえ（名前・調子／タイプ／星）で変える。長いタイプ名は横に縮めて1行に
  const SQ_SHOW = ['cond', 'type', 'star'], SQ_SHOW_NAME = { cond: '名前・調子', type: 'タイプ', star: 'レア度（星）' };
  function sqTag(q) {
    if (sqShow === 'type') { const t = q.type || 'バランス', k = Math.min(1, 6 / Math.max(1, t.length)); return `<b class="s2n s2n-ty tbadge ${TYPE_CLS[t] || 'ty-bal'}" style="--sx:${k.toFixed(2)}">${esc(t)}</b>`; }
    if (sqShow === 'star') return `<b class="s2n s2n-st">${starHTML(C.ensureStar(q), q.totsu)}</b>`;
    return `<b class="s2n ${POSC[q.position]}">${esc(q.name)}</b>`;
  }
  function renderLineup2() {
    const keepRes = (document.querySelector('#clubLayer .s2st-l') || {}).scrollTop || 0;   // 版561：リザーブを選んでも、一覧の位置をそのままに
    const ps = save.team.players, tac = C.ensureTactics(save), cells = tac.cells, roles = C.slotRoles(cells);
    const R = C.GRID_R, COLS = C.GRID_C;
    // 版513：スマホ（高さの低い画面）は、縮めずに画面の大きさに合わせて組み直す（顔と文字を大きく）
    const PHN = document.documentElement.classList.contains('short');
    let PX0 = 20, PY0 = 64, CW = 46, CH = 46, BX1 = 776, BX2 = 882, BY0 = 116, BDY = 77, boardCss = '', benchCss = ['', ''];
    if (PHN) {
      const Lw = $('#clubLayer').clientWidth || 1040, Lh = $('#clubLayer').clientHeight || 520;
      // 版530：左は104（フォーメーション・リザーブ）、右は104（もどる・切りかえ・戦術）を必ず空けて、その間に板を収める
      const GL = 104, GR = 104, BW = Lw < 1060 ? 84 : 96, bh = Lh - 12;
      CH = Math.floor((bh - 54) / (R + 2)); CW = Math.max(28, Math.min(50, CH + 6, Math.floor((Lw - GL - GR - BW * 2 - 40) / COLS)));
      PX0 = 12; PY0 = 44;
      const bw = PX0 + CW * COLS + 12 + BW * 2 + 6 + 10, bl = Math.max(GL, Math.round(GL + (Lw - GL - GR - bw) / 2));
      boardCss = ` style="left:${bl}px;top:6px;width:${bw}px;height:${bh}px"`;
      const bx = PX0 + CW * COLS + 12, btop = 38, bH = bh - btop - 10;
      benchCss = [` style="left:${bx}px;top:${btop}px;width:${BW}px;height:${bH}px"`, ` style="left:${bx + BW + 6}px;top:${btop}px;width:${BW}px;height:${bH}px"`];
      BX1 = bx + BW / 2; BX2 = bx + BW + 6 + BW / 2; BY0 = btop + 46; BDY = Math.floor((bH - 46 - 44) / (C.BENCH_N - 1));
    }
    const PW = CW * COLS, PH = CH * (R + 2);
    const cx = (c) => PX0 + c * CW + CW / 2, cy = (r) => PY0 + (R - 1 - r) * CH + CH / 2;
    if (unpile(cells)) store();   // 版512：となりのマスに重なった選手は、すき間のあるマスへ
    const occ = {}; for (let i = 1; i < 11; i++) if (cells[i]) occ[cells[i].r + ':' + cells[i].c] = i;
    let grid = '';
    for (let r = 0; r < R; r++) for (let c = 0; c < COLS; c++) grid += `<i class="s2c z-${C.zoneOf(r)}" data-r="${r}" data-c="${c}" style="left:${PX0 + c * CW}px;top:${PY0 + (R - 1 - r) * CH}px;width:${CW}px;height:${CH}px"></i>`;
    const zl = [['FW', 8], ['MF', 4.5], ['DF', 1]].map(([z, r]) => `<b class="s2zl" style="left:${PX0 + 8}px;top:${cy(r) - 18}px">${z}</b><b class="s2zl" style="left:${PX0 + PW - 70}px;top:${cy(r) - 18}px">${z}</b>`).join('');
    const tagsOf = (q) => Object.keys(ROLE_TAG).filter((k) => k !== 'captain' && tac.roles[k] === q.name).map((k) => `<i class="s2rt rt-${k}">${ROLE_TAG[k]}</i>`).join('') + (tac.roles.captain === q.name ? '<i class="s2rt rt-captain">C</i>' : '');
    const PK = D.PARAMS.map((q) => q.k);
    const badge = (q) => {
      if (q.injury > 0) return '<i class="s2b inj">＋</i>';
      if (q.suspend > 0) return '<i class="s2b sus"></i>';
      if (sqShow !== 'cond') return `<i class="s2b cdot ${condDot(q)}"></i>`;
      return `<i class="s2b cdot ${condDot(q)}"></i><span class="s2ca">${condArrow(q, 22)}</span>`;
    };
    const chip = (q, i, x, y, cls) => `<div class="s2p ${cls || ''}${i === pick ? ' sel' : ''}${q.injury > 0 ? ' inj' : ''}" data-i="${i}" style="left:${x}px;top:${y}px">${sqTag(q)}<span class="s2tags">${tagsOf(q)}</span>${facePic(q, 's2f', i >= 11)}${badge(q)}${i > 0 && i < 11 && q.position !== roles[i] && q.position !== 'GK' ? '<em class="s2mis" title="本来のポジションとちがう">!</em>' : ''}</div>`;
    let dots = chip(ps[0], 0, PX0 + PW / 2, PY0 + R * CH + CH * 1.05, 'gk');
    for (let i = 1; i < 11; i++) { const c = cells[i]; if (c) dots += chip(ps[i], i, cx(c.c), cy(c.r)); }
    // 控え：1列目（ベンチ入り）・2列目（灰色）
    const bench = ps.slice(11);
    const col = (arr, k0, x, grey) => arr.map((q, k) => chip(q, k0 + k, x, BY0 + k * BDY, 'bn' + (grey ? ' grey' : ''))).join('');
    const b1 = bench.slice(0, C.BENCH_N), b2 = bench.slice(C.BENCH_N);
    
    const label = C.formationLabel(cells);
    const forms = sqNote ? `<div class="s2note">${C.FORMATIONS.map((f) => `<button class="s2f${f === tac.formation ? ' on' : ''}" data-f="${f}"><b>${f}</b>${formMini(f)}</button>`).join('')}</div>` : '';
    const sel = sqPop >= 0 ? ps[sqPop] : null;
    let pop = '';
    if (sel) { C.ensurePts(sel); const rk = PK.map((k) => C.rankInfo(sel.pts[k]).g);
      pop = `<div class="s2pop" style="${sqPop < 11 && sqPop > 0 && cells[sqPop] ? `left:${Math.min(560, Math.max(30, cx(cells[sqPop].c) - 170))}px;top:${Math.max(70, cy(cells[sqPop].r) - 150)}px` : sqPop === 0 ? `left:${PX0 + PW / 2 - 170}px;top:${PY0 + R * CH - 120}px` : (PHN ? `left:${BX1 - 400}px;top:${BY0 - 60 + ((sqPop - 11) % C.BENCH_N) * BDY}px` : `left:560px;top:${Math.min(470, 60 + (sqPop - 11) * 75)}px`)}"><div class="s2ph"><i class="pos ${POSC[sel.position]}">${sel.position}</i><b>${sel.number}</b><span>${esc(sel.name)}</span>${starHTML(C.ensureStar(sel), sel.totsu)}<button class="s2px">×</button></div>
        <div class="s2pr">${PK.map((k, j) => `<span title="${esc(D.PARAMS[j].name)}">${ico(k)}<i class="rk2 g-${rk[j]}">${rk[j]}</i></span>`).join('')}</div>
        <div class="s2pt"><span class="tbadge ${TYPE_CLS[sel.type] || 'ty-bal'}">${esc(sel.type || '')}</span><i class="cdot ${condDot(sel)}"></i><small>疲労 ${Math.round(sel.fatigue || 0)}%</small></div>
        <div class="s2rl">${Object.keys(ROLE_NAME).map((k) => `<button data-role="${k}" class="${tac.roles[k] === sel.name ? 'on' : ''}"><i class="s2rt rt-${k}">${ROLE_TAG[k]}</i>${ROLE_NAME[k]}</button>`).join('')}</div>
        <button class="s2pd" data-pd="${sqPop}">選手データを見る</button></div>`; }
    // 版517：リザーブの選手を選んだら、その選手の能力も見せる（下に重ねても、その下の選手はタップできる）
    if (!sel && sqResOpen && sqRes >= 0 && save.reserve[sqRes]) { const q = save.reserve[sqRes]; C.ensurePts(q); const rk = PK.map((k) => C.rankInfo(q.pts[k]).g);
      pop = `<div class="s2pop s2rpop" style="left:${PX0 + 4}px;top:9999px"><div class="s2ph"><i class="pos ${POSC[q.position]}">${q.position}</i><span>${esc(q.name)}</span>${starHTML(C.ensureStar(q), q.totsu)}<small class="s2rp-tag">リザーブ</small></div>
        <div class="s2pr">${PK.map((k, j) => `<span title="${esc(D.PARAMS[j].name)}">${ico(k)}<i class="rk2 g-${rk[j]}">${rk[j]}</i></span>`).join('')}</div>
        <div class="s2pt"><span class="tbadge ${TYPE_CLS[q.type] || 'ty-bal'}">${esc(q.type || '')}</span>${condGauge(q, 'sm')}<small>疲労 ${Math.round(q.fatigue || 0)}%</small></div></div>`; }
    $('#clubLayer').innerHTML = `<div class="sq2${PHN ? ' ph' : ''}${sqResOpen && (save.reserve || []).length ? ' resopen' : ''}"><div class="s2board"${boardCss}>
        <div class="s2head"><img src="${emblemURL(save.team.name, 40)}" alt=""><b>${esc(save.team.name)}</b><em>［${esc(label)}］</em></div>
        <div class="s2pitch" style="left:${PX0}px;top:${PY0}px;width:${PW}px;height:${PH}px"><i class="s2gk" style="top:${R * CH}px;height:${CH * 2}px"></i><i class="s2box" style="left:${PW * 0.22}px;width:${PW * 0.56}px;top:${R * CH - CH * 0.15}px;height:${CH * 2.15}px"></i><i class="s2box2" style="left:${PW * 0.34}px;width:${PW * 0.32}px;top:${R * CH + CH * 0.85}px;height:${CH * 1.15}px"></i></div>
        ${grid}${zl}
        <div class="s2bench"${benchCss[0]}><b class="s2bh">ベンチ入り</b></div><div class="s2bench g"${benchCss[1]}><b class="s2bh">ベンチ外</b></div>
        ${Array.from({ length: C.BENCH_N }, (_, k) => `<i class="s2e" style="left:${BX1}px;top:${BY0 + k * BDY}px"></i><i class="s2e" style="left:${BX2}px;top:${BY0 + k * BDY}px"></i>`).join('')}${dots}${col(b1, 11, BX1, false)}${col(b2, 11 + C.BENCH_N, BX2, true)}
        ${pop}</div>
      <button class="s2btn s2nb" data-a="note"><span>${formMini(tac.formation === 'custom' ? '4-4-2' : tac.formation)}</span><b>フォーメーション</b></button>
      <button class="s2btn s2db" data-a="show" title="表示の切りかえ（名前・調子／タイプ／星）"><span><img class="s2chg" src="icons/ui_change.png" alt="切りかえ"></span></button>
      <button class="s2btn s2tb" data-a="tac"><span>${RB_TAC_SVG}</span><b>戦術</b></button>
      ${(save.reserve || []).length ? `<button class="s2btn s2rb" data-a="res"><span>${(save.reserve || []).length}</span><b>リザーブ</b></button>` : ''}
      ${sqResOpen && (save.reserve || []).length ? `<div class="s2strip"><div class="s2st-h"><b>リザーブ</b><button class="s2res-x" title="とじる">×</button></div><div class="s2st-l">${save.reserve.map((q, k) => `<div class="s2sc${k === sqRes ? ' on' : ''}" data-r="${k}">${facePic(q, 's2sf')}${sqTag(q)}</div>`).join('')}</div>${sqRes >= 0 ? `<button class="s2rel s2rel2" data-rel="${sqRes}" title="放出"><img src="icons/pc_release.png" alt="放出"></button>` : '<p class="s2st-hint">タップ→チームの選手をタップ／横に引っぱって置く</p>'}</div>` : ''}
      ${forms}
      <p class="s2hint">選手をドラッグして、マスに置く・ほかの選手（控えとも）と入れ替える。タップでくわしく。</p></div>`;
    const L = $('#clubLayer'), board = L.querySelector('.s2board'); fitSq2();
    { const rl = L.querySelector('.s2st-l'); if (rl && keepRes) rl.scrollTop = keepRes; }
    board.querySelectorAll('img.fc').forEach((im) => { const f = () => cutFace(im); im.addEventListener('load', f); if (im.complete) f(); });
    const done = () => { store(); renderLineup2(); };
    L.querySelectorAll('.s2btn').forEach((b) => b.onclick = () => { const a = b.dataset.a;
      if (a === 'note') { sqNote = !sqNote; renderLineup2(); }
      else if (a === 'show') { sqShow = SQ_SHOW[(SQ_SHOW.indexOf(sqShow) + 1) % SQ_SHOW.length]; renderLineup2(); const bd = $('#clubLayer .s2board'); if (bd) { const t = document.createElement('div'); t.className = 's2toast'; t.textContent = '表示：' + SQ_SHOW_NAME[sqShow]; bd.appendChild(t); setTimeout(() => t.remove(), 1300); } }
      else if (a === 'tac') { sqTab = 'tac'; renderLineup(); }
      else if (a === 'res') { sqResOpen = !sqResOpen; sqRes = -1; renderLineup2(); }
      else if (a === 'club') openClub({ onDone: () => renderLineup() }); });
    { const rb = L.querySelector('.s2res-back'); if (rb) rb.onclick = () => { sqRes = -1; renderLineup2(); }; }
    { const rx = L.querySelector('.s2res-x'); if (rx) rx.onclick = () => { sqResOpen = false; sqRes = -1; renderLineup2(); }; }
    // 版517：リザーブとチームの入れかえ（タップでもドラッグでも）
    function swapRes(k, i) {
      const ps = save.team.players, r = save.reserve[k]; if (!r || !ps[i]) return;
      if (i === 0 && r.position !== 'GK') { coachAsk('GKの所には、GKの選手しか入れられません。', [{ label: 'OK', value: true }]); return; }
      const out = ps[i]; ps[i] = r; save.reserve[k] = out; { const pc = save.plan && save.plan.cards; if (pc) delete pc[i]; }
      { const tac = C.ensureTactics(save); for (const key in (tac.roles || {})) if (tac.roles[key] === out.name) tac.roles[key] = null; }
      sqRes = -1; pick = -1; sqPop = -1; done();
    }
    // リザーブの帯から、横に引っぱるとドラッグ（縦はスクロール）
    L.querySelectorAll('.s2sc').forEach((c) => {
      let dg = null;
      c.addEventListener('pointerdown', (e) => { if (e.target.closest('.s2rel')) return; dg = { x0: e.clientX, y0: e.clientY, on: false, ghost: null, id: e.pointerId };
        const fin = (ev) => { if (ev.pointerId !== e.pointerId) return; removeEventListener('pointerup', fin, true); removeEventListener('pointercancel', fin, true); if (dg && dg.on) end(ev.type === 'pointercancel' && dg.lx != null ? { clientX: dg.lx, clientY: dg.ly } : ev, false); };   // 版531：指を離した合図を画面全体でも受け取る
        addEventListener('pointerup', fin, true); addEventListener('pointercancel', fin, true); });
      c.addEventListener('pointermove', (e) => {
        if (!dg) return; dg.lx = e.clientX; dg.ly = e.clientY; const dx = e.clientX - dg.x0, dy = e.clientY - dg.y0;
        if (!dg.on) { if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { dg.on = true; try { c.setPointerCapture(dg.id); } catch (_) {} const sq = L.querySelector('.sq2'); dg.sq = sq; dg.ghost = document.createElement('div'); dg.ghost.className = 's2drag'; const im = c.querySelector('img'); if (im) dg.ghost.appendChild(im.cloneNode(true)); sq.appendChild(dg.ghost); c.classList.add('lift'); } else if (Math.abs(dy) > 10) { dg = null; return; } }
        if (dg && dg.on) { e.preventDefault(); const r = dg.sq.getBoundingClientRect(), k = r.width / dg.sq.offsetWidth; dg.ghost.style.left = (e.clientX - r.left) / k + 'px'; dg.ghost.style.top = (e.clientY - r.top) / k + 'px';
          L.querySelectorAll('.hov').forEach((h) => h.classList.remove('hov')); const t = document.elementsFromPoint(e.clientX, e.clientY).map((x) => x.closest && x.closest('.s2p:not(.ghost)')).find(Boolean); if (t) t.classList.add('hov'); }
      });
      const end = (e, cancel) => { const d = dg; dg = null; if (!d || !d.on) return; d.ghost.remove(); c.classList.remove('lift'); c.dataset.drag = '1'; setTimeout(() => { delete c.dataset.drag; }, 50);
        if (cancel) { renderLineup2(); return; }
        const t = document.elementsFromPoint(e.clientX, e.clientY).map((x) => x.closest && x.closest('.s2p:not(.ghost)')).find(Boolean);
        if (t) swapRes(+c.dataset.r, +t.dataset.i); else renderLineup2(); };
      c.addEventListener('pointerup', (e) => end(e, false)); c.addEventListener('pointercancel', (e) => end(e, true));
    });
    L.querySelectorAll('.s2sc').forEach((c) => c.onclick = (e) => { if (c.dataset.drag) return; if (e.target.closest('.s2rel')) return; const k = +c.dataset.r; sqRes = sqRes === k ? -1 : k; pick = -1; sqPop = -1; renderLineup2(); });
    L.querySelectorAll('.s2rel').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); const k = +b.dataset.rel, q = save.reserve[k]; const kk = (C.KAKERA_OF[C.ensureStar(q)] || 1) * (1 + (q.totsu || 0));
      if (!(await coachAsk(`${esc(q.name)}を放出しますか？<br><small>ほかのクラブへ移籍します（戻ってきません）。<br>覚醒のカケラ <b>${kk}</b> をもらえます。</small>`))) return;
      save.reserve.splice(k, 1); save.kakera = (save.kakera || 0) + kk; sqRes = -1; if (!save.reserve.length) sqResOpen = false; done(); });   // 版508：放出（覚醒のカケラになる）
    L.querySelectorAll('.s2f').forEach((b) => b.onclick = () => { tac.formation = b.dataset.f; tac.cells = C.cellsFor(b.dataset.f); sqNote = false; pick = -1; done(); });
    { const x = L.querySelector('.s2px'); if (x) x.onclick = (e) => { e.stopPropagation(); sqPop = -1; renderLineup2(); }; }
    { const pd = L.querySelector('.s2pd'); if (pd) pd.onclick = () => { const i = +pd.dataset.pd; sqPop = -1; playerDetail(i); }; }
    L.querySelectorAll('.s2rl [data-role]').forEach((bt) => bt.onclick = () => { const k = bt.dataset.role; tac.roles[k] = tac.roles[k] === sel.name ? null : sel.name; done(); });
    // ドラッグ（指でもマウスでも）：少し動かしたらドラッグ、動かさずに離したらタップ
    const scaleOf = () => { const r = board.getBoundingClientRect(); return { r, k: r.width / board.offsetWidth }; };
    L.querySelectorAll('.s2p').forEach((el) => {
      el.onpointerdown = (e) => {
        e.preventDefault(); const i = +el.dataset.i, { r, k } = scaleOf();
        sqDrag = { i, el, x0: e.clientX, y0: e.clientY, on: false, ghost: null, r, k, id: e.pointerId };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        // 版531：iPhoneで指を離した合図が選手に届かず、持ち上げたまま止まることがあった → 画面全体でも離した・キャンセルを受け取る
        const mv = (ev) => { if (sqDrag && sqDrag.el === el && ev.pointerId === sqDrag.id && ev.target !== el) el.onpointermove(ev); };
        const fin = (ev) => { if (ev.pointerId !== e.pointerId) return; removeEventListener('pointermove', mv, true); removeEventListener('pointerup', fin, true); removeEventListener('pointercancel', fin, true);
          if (sqDrag && sqDrag.el === el) { if (ev.type === 'pointercancel') { const d = sqDrag; if (d.on && d.lx != null) el.onpointerup({ clientX: d.lx, clientY: d.ly, pointerId: d.id }); else el.onpointercancel(ev); } else el.onpointerup(ev); } };
        addEventListener('pointermove', mv, true); addEventListener('pointerup', fin, true); addEventListener('pointercancel', fin, true);
      };
      el.onpointermove = (e) => {
        const d = sqDrag; if (!d || d.el !== el) return; d.lx = e.clientX; d.ly = e.clientY;
        if (!d.on && sqRes < 0 && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 12) { d.on = true; d.ghost = el.cloneNode(true); d.ghost.classList.add('ghost'); board.appendChild(d.ghost); el.classList.add('lift'); }
        if (d.on) { d.ghost.style.left = (e.clientX - d.r.left) / d.k + 'px'; d.ghost.style.top = (e.clientY - d.r.top) / d.k + 18 + 'px';
          board.querySelectorAll('.hov').forEach((h) => h.classList.remove('hov')); const tgt = dropAt(e.clientX, e.clientY); if (tgt) tgt.classList.add('hov'); }
      };
      el.onpointerup = (e) => {
        const d = sqDrag; sqDrag = null; if (!d || d.el !== el) return;
        if (!d.on) {   // タップ：くわしく（2回目のタップ・別の選手のタップで入れ替えもできる）
          const i = d.i;
          if (sqRes >= 0) { swapRes(sqRes, i); return; }   // 版508：リザーブの選手とチームの選手を入れかえ（版516：帯は開いたまま）
          if (pick >= 0 && pick !== i) { swapPlayers(pick, i); pick = -1; sqPop = -1; done(); return; }
          if (sqPop === i) { sqPop = -1; pick = -1; } else { sqPop = i; pick = i; }
          renderLineup2(); return;
        }
        if (d.ghost) d.ghost.remove();
        const tgt = dropAt(e.clientX, e.clientY);
        pick = -1; sqPop = -1;
        if (tgt && tgt.classList.contains('s2sc')) { swapRes(+tgt.dataset.r, d.i); return; }   // 版517：チームの選手をリザーブの帯へ
        if (tgt && tgt.classList.contains('s2p')) { const j = +tgt.dataset.i; if (j !== d.i) swapPlayers(d.i, j); }
        else if (tgt && tgt.classList.contains('s2c') && d.i > 0 && d.i < 11) {
          const rr = +tgt.dataset.r, cc = +tgt.dataset.c; let who = occ[rr + ':' + cc];
          if (!who) for (let k = 1; k < 11; k++) if (k !== d.i && cells[k] && Math.abs(cells[k].r - rr) <= 1 && Math.abs(cells[k].c - cc) <= 1) { who = k; break; }   // 版512：となりに置くと重なるので、その選手と入れかえ
          if (who && who !== d.i) { const t2 = cells[who]; cells[who] = cells[d.i]; cells[d.i] = t2; } else cells[d.i] = { r: rr, c: cc };
          tac.formation = 'custom';
        }
        done();
      };
      el.onpointercancel = () => { const d = sqDrag; if (d && d.el === el && d.on && d.lx != null) { el.onpointerup({ clientX: d.lx, clientY: d.ly, pointerId: d.id }); return; } sqDrag = null; if (d && d.ghost) d.ghost.remove(); renderLineup2(); };
    });
    function dropAt(x, y) {
      const els = document.elementsFromPoint(x, y);
      for (const e2 of els) { if (e2.classList && e2.classList.contains('ghost')) continue; const p2 = e2.closest && e2.closest('.s2p:not(.ghost)'); if (p2 && p2 !== (sqDrag && sqDrag.el)) return p2; const sc = e2.closest && e2.closest('.s2sc'); if (sc) return sc; if (e2.classList && e2.classList.contains('s2c')) return e2; }
      return null;
    }
  }
  // フォーメーションの小さな図（ノートの中・ボタン）
  function formMini(f, club) {
    if (club) return `<svg viewBox="0 0 40 40" class="s2mini"><path d="M20 4l14 5v10c0 9-6 15-14 18C12 34 6 28 6 19V9z" fill="#2f8a4e" stroke="#fff" stroke-width="2.5"/><circle cx="20" cy="20" r="6" fill="#fff"/></svg>`;
    const cs = C.cellsFor(f || '4-4-2'), dots = cs.slice(1, 11).map((c2) => c2 ? `<circle cx="${3 + c2.c * 2.4}" cy="${33 - c2.r * 3}" r="2" fill="#fff"/>` : '').join('');
    return `<svg viewBox="0 0 40 40" class="s2mini"><rect x="1" y="1" width="38" height="38" rx="3" fill="#2f8a4e"/><rect x="1" y="1" width="38" height="9" fill="#2f6fd6" opacity=".6"/><rect x="1" y="10" width="38" height="12" fill="#e0b020" opacity=".55"/><rect x="1" y="22" width="38" height="9" fill="#d83a3a" opacity=".55"/>${dots}<circle cx="20" cy="36" r="2" fill="#ffe23a"/></svg>`;
  }
  function renderLineup() {
    if (sqTab === 'pos') { renderLineup2(); return; }
    const ps = save.team.players, tac = C.ensureTactics(save), cells = tac.cells;
    const TOP = 20, CW = 28, CH = 35, COLS = C.GRID_C, ROWS = C.GRID_R + 2, PW = CW * COLS, PH = CH * ROWS + TOP;
    const cx = (c) => c * CW + CW / 2, cy = (r) => TOP + (C.GRID_R - 1 - r) * CH + CH / 2;   // 行0が下（自陣）。上は選手の頭が切れないよう少しあける
    const roles = C.slotRoles(cells);
    const tagsOf = (q) => Object.keys(ROLE_TAG).filter((k) => tac.roles[k] === q.name).map((k) => `<i class="rt rt-${k}">${ROLE_TAG[k]}</i>`).join('');
    const occ = {}; for (let i = 1; i < 11; i++) if (cells[i]) occ[cells[i].r + ':' + cells[i].c] = i;
    // マス目（ゾーンの色）
    let grid = '';
    for (let r = 0; r < C.GRID_R; r++) for (let c = 0; c < COLS; c++) grid += `<i class="gc z-${C.zoneOf(r)}${occ[r + ':' + c] ? '' : ' free'}" data-r="${r}" data-c="${c}" style="left:${c * CW}px;top:${cy(r) - CH / 2}px;width:${CW}px;height:${CH}px"></i>`;
    const zl = [['FW', 8], ['MF', 4.5], ['DF', 1]].map(([z, r]) => `<b class="zl" style="top:${cy(r) - 10}px">${z}</b><b class="zl r" style="top:${cy(r) - 10}px">${z}</b>`).join('');
    const pl = (q, i, x, y) => `<div class="sq-slot${i === pick ? ' sel' : ''}${q.injury > 0 ? ' inj' : ''}" data-i="${i}" style="left:${x}px;top:${y}px">${portrait(q)}<b><i class="pos ${POSC[roles[i]]}">${roles[i]}</i>${esc(q.name)}</b><span class="rts">${tagsOf(q)}</span>${q.position !== roles[i] ? `<em class="sq-mis">本来${q.position}</em>` : ''}</div>`;
    let dots = pl(ps[0], 0, PW / 2, TOP + C.GRID_R * CH + CH);
    for (let i = 1; i < 11; i++) { const c = cells[i]; dots += pl(ps[i], i, cx(c.c), cy(c.r)); }
    const pitch = `<div class="sq-pitch grid" style="width:${PW}px;height:${PH}px">${grid}<i class="gk-area"></i><i class="gk-box"></i>${zl}${dots}</div>`;
    const bench = ps.slice(11).map((q, k) => { const i = k + 11; return `<div class="sq-bench${i === pick ? ' sel' : ''}${q.injury > 0 ? ' inj' : ''}" data-i="${i}">${portrait(q)}<span><b><i class="pos ${POSC[q.position]}">${q.position}</i>${q.number} ${esc(q.name)}${tagsOf(q)}</b><small>${esc(q.type)}　<i class="cdot ${condDot(q)}"></i>${q.injury > 0 ? ` ケガ あと${q.injury}週` : ''}</small></span></div>`; }).join('');
    const sel = pick >= 0 ? ps[pick] : null;
    const roleBox = sel ? `<div class="sq-adj"><span>${esc(sel.name)}を</span>${Object.keys(ROLE_NAME).map((k) => `<button data-role="${k}" class="${tac.roles[k] === sel.name ? 'on' : ''}">${ROLE_NAME[k]}${tac.roles[k] === sel.name ? '✓' : ''}</button>`).join('')}<small>${pick > 0 && pick < 11 ? 'ピッチの空いているマスをタップすると移動します' : pick === 0 ? 'GKはゴール前から動かせません' : 'ピッチの選手をタップすると入れ替わります'}</small></div>`
      : '<p class="hintp">選手をタップして、空いているマスをタップすると移動。選手どうしをタップすると入れ替わります（控えとも）。マスの色（FW・MF・DF）で役割が決まるので、0-10のような形も自由に組めます。</p>';
    const label = C.formationLabel(cells);
    const posTab = `<h4>代表的なフォーメーション <small>（ここから自由に動かしてOK）</small></h4><div class="sq-forms">${C.FORMATIONS.map((f) => `<button class="sq-f${f === tac.formation ? ' on' : ''}" data-f="${f}">${f}</button>`).join('')}</div>${roleBox}
      <h4>役割</h4><p class="sq-roles">${Object.keys(ROLE_NAME).map((k) => `<span><i class="rt rt-${k}">${ROLE_TAG[k]}</i>${ROLE_NAME[k]}：${tac.roles[k] ? esc(tac.roles[k]) : '<em>おまかせ</em>'}</span>`).join('')}</p>
      <h4>控え</h4><div class="sq-benches">${bench}</div>`;
    const styleNow = C.STYLES.find((x) => x.id === tac.style);
    const tacTab = `<h4>戦い方　<small>${styleNow ? '' : '（カスタム）'}</small></h4><div class="sq-styles">${C.STYLES.map((st) => `<button class="sq-st${st.id === tac.style ? ' on' : ''}" data-st="${st.id}"><b>${esc(st.name)}</b><small>${esc(st.desc)}</small></button>`).join('')}</div>
      <p class="hintp">戦い方を選ぶと、下の項目がそろいます（選手の配置は変わりません）。そこから好きに変えてもOK。</p>
      <div class="sq-items">${C.TACTIC_ITEMS.map((it) => `<div class="sq-it"><span class="sq-in">${esc(it.name)}</span><span class="sq-seg">${it.opts.map(([v, nm]) => `<button data-k="${it.key}" data-v="${v}" class="${String(tac[it.key]) === String(v) ? 'on' : ''}">${esc(nm)}</button>`).join('')}</span><small>${esc(it.desc)}</small></div>`).join('')}</div>`;
    $('#clubLayer').innerHTML = `<div class="dpanel sq"><h2>スタメン・戦術　<small>${esc(label)}・${esc(styleNow ? styleNow.name : 'カスタム')}</small></h2><div class="sq-grid">${pitch}<div class="sq-side"><div class="sq-tabs"><button data-t="pos" class="${sqTab === 'pos' ? 'on' : ''}">配置・役割</button><button data-t="tac" class="${sqTab === 'tac' ? 'on' : ''}">チーム戦術</button><button data-t="sit" class="${sqTab === 'sit' ? 'on' : ''}">試合中の作戦</button></div>${sqTab === 'pos' ? posTab : sqTab === 'tac' ? tacTab : situHtml(tac.situ)}</div></div></div>`;
    const L = $('#clubLayer');
    L.querySelectorAll('.sq-tabs button').forEach((bt) => bt.onclick = () => { sqTab = bt.dataset.t; renderLineup(); });
    { const cb = L.querySelector('.sq-club'); if (cb) cb.onclick = () => openClub({ onDone: () => renderLineup() }); }
    L.querySelectorAll('.sq-slot, .sq-bench').forEach((el) => el.onclick = (e) => {
      e.stopPropagation();
      const i = +el.dataset.i;
      if (pick < 0) { pick = i; renderLineup(); return; }
      if (pick !== i) { swapPlayers(pick, i); store(); pick = -1; } else pick = -1;
      renderLineup();
    });
    L.querySelectorAll('.gc.free').forEach((el) => el.onclick = () => {
      if (!(pick > 0 && pick < 11)) return;
      cells[pick] = { r: +el.dataset.r, c: +el.dataset.c }; tac.formation = 'custom'; pick = -1; store(); renderLineup();
    });
    L.querySelectorAll('.sq-f').forEach((bt) => bt.onclick = () => { tac.formation = bt.dataset.f; tac.cells = C.cellsFor(bt.dataset.f); store(); pick = -1; renderLineup(); });
    L.querySelectorAll('[data-role]').forEach((bt) => bt.onclick = () => { const k = bt.dataset.role; tac.roles[k] = tac.roles[k] === sel.name ? null : sel.name; store(); renderLineup(); });
    L.querySelectorAll('.sq-st').forEach((bt) => bt.onclick = () => { const st = C.STYLES.find((x) => x.id === bt.dataset.st); Object.assign(tac, st.t, { style: st.id }); store(); renderLineup(); });
    L.querySelectorAll('.sq-seg button[data-k]').forEach((bt) => bt.onclick = () => { const k = bt.dataset.k, v = bt.dataset.v; tac[k] = isNaN(+v) ? v : +v; tac.style = 'custom'; store(); renderLineup(); });
    bindSitu(L, tac.situ, () => { store(); renderLineup(); });
  }
  // 状況別の作戦（スタメン画面とハーフタイムで共通）
  function situHtml(situ) {
    const desc = C.SITU_ACTS.map(([, nm, d]) => `<span><b>${esc(nm)}</b>：${esc(d)}</span>`).join('');
    return `<h4>状況別の作戦 <small>（試合中、自動で切りかわります）</small></h4>
      <div class="sq-items">
        <div class="sq-it"><span class="sq-in">いつから</span><span class="sq-seg">${C.SITU_FROM.map(([v, nm]) => `<button data-sf="${v}" class="${situ.from === v ? 'on' : ''}">${esc(nm)}</button>`).join('')}</span></div>
        ${C.SITU_ROWS.map(([key, nm]) => `<div class="sq-it"><span class="sq-in">${esc(nm)}</span><span class="sq-seg">${C.SITU_ACTS.map(([v, an]) => `<button data-sk="${key}" data-sv="${v}" class="${situ[key] === v ? 'on' : ''} sv-${v}">${esc(an)}</button>`).join('')}</span></div>`).join('')}
      </div>
      <p class="sit-desc">${desc}</p>
      <p class="hintp">決めた時間になると、点差を見て作戦が切りかわります。それまではいつもの戦い方です。</p>`;
  }
  function bindSitu(root, situ, after) {
    root.querySelectorAll('[data-sf]').forEach((bt) => bt.onclick = () => { situ.from = +bt.dataset.sf; after(); });
    root.querySelectorAll('[data-sk]').forEach((bt) => bt.onclick = () => { situ[bt.dataset.sk] = bt.dataset.sv; after(); });
  }
  // ================= 選手交代（試合中いつでも／ハーフタイム）：カルチョビットAのように、ボードで選んで「はい」 =================
  // ms：この試合の記録（ピッチの選手・使った控え・配置・作戦）。交代は1試合3人まで
  const battery = (st) => { const n = Math.max(0, Math.min(5, Math.ceil(st / 20))); return `<i class="bat ${st < 35 ? 'low' : st < 60 ? 'mid' : ''}">${'<b></b>'.repeat(n)}${'<b class="e"></b>'.repeat(5 - n)}</i>`; };
  function subSheet(mt, info, ms) {
    const ps = mt.team.players, base = C.ensureTactics(save);
    if (!ms.on) { ms.on = [...Array(11).keys()]; ms.used = []; ms.out = []; ms.changes = []; ms.cells = (mt.team.cells || C.cellsFor(mt.team.formation)).map((c) => c && { ...c }); ms.att = base.attitude || 'balanced'; ms.cur = {}; }
    // 今回の変更（「戻る」で試合に伝える）
    const plan = { subs: [], cells: ms.cells.map((c) => c && { ...c }), att: ms.att };
    let page = 'board';
    let el = document.getElementById('htModal');
    if (!el) { el = document.createElement('div'); el.id = 'htModal'; document.getElementById('app').appendChild(el); }
    el.className = 'modal sb-wrap sb2-wrap';
    const left = () => 3 - ms.used.length - plan.subs.length;
    const onPitch = () => { const a = ms.on.slice(); for (const x of plan.subs) a[x.slot] = x.bench; return a; };
    const stamOf = (k) => { const x = plan.subs.find((y) => y.slot === k); return x ? Math.round(100 - (ps[x.bench].fatigue || 0) * 0.5) : Math.round(info.stamina[k]); };
    // ボードの寸法（1080×600の箱で組んで、画面に合わせて拡大縮小）
    const COLS = C.GRID_C, ROWS = C.GRID_R, CW = 40, CH = 33, PW = CW * COLS, PH = CH * (ROWS + 2.3);
    const cx = (c) => c * CW + CW / 2, cy = (r) => (ROWS - 1 - r) * CH + CH / 2;
    const ZC = { FW: 'pv-fw', MF: 'pv-mf', DF: 'pv-df', GK: 'pv-gk' };
    const fitBox = () => { const box = el.querySelector('.sb2-box'); if (!box) return; const ap = document.getElementById('app'); const k = Math.min(ap.clientWidth / 1080, ap.clientHeight / 600); box.style.transform = `translate(-50%,-50%) scale(${k.toFixed(4)})`; };
    if (!el.__fit) {
      el.__fit = true; addEventListener('resize', () => { if (!el.hidden) fitBox(); });
      // カードが出ているときは、カードの外をタップすると閉じるだけ（下の選手は動かさない）
      el.addEventListener('pointerdown', (e) => { const ov = el.querySelector('.sb2-cov'); if (ov && !e.target.closest('.pc-card')) { ov.remove(); e.preventDefault(); e.stopPropagation(); } }, true);
    }
    const idxOf = (q) => { let i = save.team.players.indexOf(q); if (i < 0) i = save.team.players.findIndex((x) => x.name === q.name); return i; };
    // 選手カード（タップで表示・もう一度タップか外側で閉じる）
    const showCard = (q) => {
      const i = idxOf(q); if (i < 0) return;
      const box = el.querySelector('.sb2-box');
      let ov = box.querySelector('.sb2-cov');
      if (!ov) { ov = document.createElement('div'); ov.className = 'sb2-cov'; box.appendChild(ov); }
      const render = (j) => {
        ov.innerHTML = playerCardHTML(j, null, false);
        bindCard(ov, j, render, () => render(j));
        ov.querySelector('.pc-close').onclick = (e) => { e.stopPropagation(); ov.remove(); };
      };
      render(i);
    };
    const draw = () => {
      if (page === 'white') return drawWhite();
      const on = onPitch(), cells = plan.cells;
      const occ = {}; for (let i = 1; i < 11; i++) if (cells[i]) occ[cells[i].r + ':' + cells[i].c] = i;
      let grid = '';
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid += `<i class="sb2-gc z-${C.zoneOf(r)}${occ[r + ':' + c] ? '' : ' free'}" data-r="${r}" data-c="${c}" style="left:${c * CW}px;top:${cy(r) - CH / 2}px;width:${CW}px;height:${CH}px"></i>`;
      const zl = [['FW', 8], ['MF', 4.5], ['DF', 1]].map(([z, r]) => `<b class="sb2-zl l" style="top:${cy(r) - 22}px">${z}</b><b class="sb2-zl r" style="top:${cy(r) - 22}px">${z}</b>`).join('');
      const pl = (k, x, y, zone) => { const q = ps[on[k]], isNew = plan.subs.some((t) => t.slot === k); return `<div class="sb2-p${isNew ? ' new' : ''}" data-k="${k}" style="left:${x}px;top:${y}px"><b class="sb2-tag ${ZC[zone]}">${esc(q.name)}</b><span class="sb2-face">${facePic(q, 'sb2-fci', false)}</span>${battery(stamOf(k))}</div>`; };
      let dots = pl(0, PW / 2, ROWS * CH + CH * 1.2, 'GK');
      for (let k = 1; k < 11; k++) dots += pl(k, cx(cells[k].c), cy(cells[k].r), C.zoneOf(cells[k].r));
      const onSet = new Set(on);
      const bench = ps.slice(11, 18).map((q, i) => { const j = i + 11, gone = ms.out.includes(q.name) || q.injury > 0, playing = onSet.has(j); return `<div class="sb2-b${gone || playing ? ' off' : ''}" data-j="${j}"><b class="sb2-tag ${ZC[q.position]}">${esc(q.name)}</b><span class="sb2-face">${facePic(q, 'sb2-fci', false)}</span>${playing ? '<em>出場中</em>' : gone ? `<em>${q.injury > 0 ? 'ケガ' : '交代済'}</em>` : ''}</div>`; }).join('');
      el.innerHTML = `<div class="sb2-box">
          <div class="sb2-board">
            <div class="sb2-head"><img src="${emblemURL(save.team.name, 48)}" alt=""><b>${esc(save.team.name)}</b><em>［${esc(C.formationLabel(cells))}］</em></div>
            <div class="sb2-pitch" style="width:${PW}px;height:${PH}px">${grid}<i class="sb2-pa"></i><i class="sb2-ga"></i>${zl}${dots}
              <div class="sb2-left">交代枠残り<b>${Math.max(0, left())}</b></div></div>
            <div class="sb2-bench">${bench}</div>
            <div class="sb2-slots">${'<i></i>'.repeat(7)}</div>
            <p class="sb2-tip">${left() > 0 ? '控えの選手を、代えたい選手へドラッグ' : '交代枠はもうありません'}　／　タップで選手カード</p>
          </div>
          <button class="sb2-round sb2-back sb2-img" title="もどる"><img src="icons/ui_back.png" alt="もどる"></button>
          <button class="sb2-round sb2-rot sb2-img" title="作戦ボード"><img src="icons/ui_change.png" alt="作戦ボード"></button>
        </div>`;
      el.hidden = false;
      fitBox();
      el.querySelector('.sb2-back').onclick = () => { if (info.atHalf) finish(); else { page = 'white'; draw(); } };   // ハーフタイムは戦術がロッカールームの別ボタンなので、そのまま戻る
      el.querySelector('.sb2-rot').onclick = () => { page = 'white'; draw(); };
      bindDrag();
    };
    // ドラッグ：控え→ピッチの選手で交代、ピッチの選手→空いているマスで移動（選手どうしなら入れ替え）。動かさずに離したらカード
    const bindDrag = () => {
      const box = el.querySelector('.sb2-box');
      const start = (ev, kind, id, q) => {
        if (ev.button > 0) return;
        ev.preventDefault();
        const sx = ev.clientX, sy = ev.clientY; let ghost = null, over = null;
        const toBox = (x, y) => { const r = box.getBoundingClientRect(), k = r.width / 1080; return [(x - r.left) / k, (y - r.top) / k]; };
        const targetAt = (x, y) => { const hit = document.elementsFromPoint(x, y); for (const h of hit) { if (h.classList && (h.classList.contains('sb2-p') || h.classList.contains('sb2-gc'))) return h; const pp = h.closest && h.closest('.sb2-p'); if (pp) return pp; } return null; };
        const move = (e) => {
          if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
          if (!ghost) {
            if (kind === 'b' && (left() <= 0 || ev.currentTarget && false)) { /* 枠がないときは動かさない */ }
            ghost = document.createElement('div'); ghost.className = 'sb2-ghost'; ghost.innerHTML = `<b class="sb2-tag ${ZC[q.position]}">${esc(q.name)}</b>${facePic(q, 'sb2-fci', false)}`; box.appendChild(ghost);
          }
          const [x, y] = toBox(e.clientX, e.clientY); ghost.style.left = x + 'px'; ghost.style.top = y + 'px';
          const t = targetAt(e.clientX, e.clientY);
          if (over !== t) { if (over) over.classList.remove('hov'); over = t; if (over && !(kind === 'b' && !over.classList.contains('sb2-p'))) over.classList.add('hov'); }
        };
        const up = async (e) => {
          removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
          if (over) over.classList.remove('hov');
          if (!ghost) { showCard(q); return; }
          ghost.remove();
          const t = targetAt(e.clientX, e.clientY);
          if (!t) return;
          if (kind === 'b') {
            if (!t.classList.contains('sb2-p') || left() <= 0) return;
            const k = +t.dataset.k, out = ps[onPitch()[k]];
            if ((k === 0) !== (q.position === 'GK')) return;
            const ok = await ask(`${esc(out.name)}に代えて<br>${esc(q.name)}を起用しますか？`);
            if (ok) { const old = plan.subs.findIndex((x) => x.slot === k); if (old >= 0) plan.subs.splice(old, 1); plan.subs.push({ slot: k, bench: id }); }
            draw(); return;
          }
          const k = id; if (k === 0) return;
          if (t.classList.contains('sb2-gc') && t.classList.contains('free')) { plan.cells[k] = { r: +t.dataset.r, c: +t.dataset.c }; draw(); return; }
          if (t.classList.contains('sb2-p')) { const k2 = +t.dataset.k; if (k2 > 0 && k2 !== k) { const tmp = plan.cells[k]; plan.cells[k] = plan.cells[k2]; plan.cells[k2] = tmp; draw(); } }
        };
        addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
      };
      el.querySelectorAll('.sb2-p').forEach((d) => d.onpointerdown = (ev) => { const k = +d.dataset.k; start(ev, 'p', k, ps[onPitch()[k]]); });
      el.querySelectorAll('.sb2-b').forEach((d) => d.onpointerdown = (ev) => { const j = +d.dataset.j, q = ps[j]; if (d.classList.contains('off')) { ev.preventDefault(); showCard(q); return; } start(ev, 'b', j, q); });
    };
    // 作戦ボード（カルチョビットAのホワイトボード）：攻守の意識だけ
    const drawWhite = () => {
      const opt = [['attacking', '攻撃的'], ['balanced', 'バランス'], ['defensive', '守備的']];
      el.innerHTML = `<div class="sb-room"><div class="wb">
          <div class="wb-pitch">${plan.cells.map((c, i) => { if (!i) return '<i class="wb-dot z-GK" style="left:6px;top:50%"></i>'; const z = C.zoneOf(c.r); return `<i class="wb-dot z-${z}" style="left:${30 + c.r * 40}px;top:${18 + c.c * 18}px"></i>`; }).join('')}<i class="wb-half"></i><i class="wb-circle"></i><i class="wb-box l"></i><i class="wb-box r"></i><span class="wb-dir">攻撃方向 →</span><span class="wb-vs">${esc(mt.opp || '')}戦</span></div>
          <div class="wb-side"><p class="wb-title">攻守の意識</p>${opt.map(([v, nm]) => `<button class="wb-btn${plan.att === v ? ' on' : ''}" data-v="${v}">${plan.att === v ? '<i class="wb-ball">⚽</i>' : ''}${nm}</button>`).join('')}</div>
        </div><button class="sb-round sb-back" title="試合にもどる"><i class="bk-ico" aria-hidden="true"></i></button></div>`;
      el.querySelectorAll('.wb-btn').forEach((b) => b.onclick = () => { plan.att = b.dataset.v; draw(); });
      el.querySelector('.sb-back').onclick = finish;
    };
    // 「はい／いいえ」の確認
    const ask = (html) => new Promise((res) => {
      const d = document.createElement('div'); d.className = 'sb-ask';
      d.innerHTML = `<div class="sb-askbox"><p>${html}</p><div class="sb-askbtns"><button class="primary ib ib-ok" data-v="1">は　い</button><button class="ib ib-no" data-v="0">いいえ</button></div></div>`;
      el.appendChild(d);
      d.querySelectorAll('button').forEach((b) => b.onclick = () => { d.remove(); res(b.dataset.v === '1'); });
    });
    // 戻る：変わったところだけ試合に伝えて、続きから
    const finish = () => {
      const moved = JSON.stringify(plan.cells) !== JSON.stringify(ms.cells), attCh = plan.att !== ms.att;
      if (!plan.subs.length && !moved && !attCh) { el.hidden = true; if (info.cancel) info.cancel(); return; }
      { const bb = el.querySelector('.sb2-back') || el.querySelector('.sb-back'); if (bb) bb.disabled = true; }   // 版556：ボタンが見つからずに止まって、もどれなくなっていた
      const t = base;
      const ch = { team: 0, at: info.atHalf ? null : info.t, subs: plan.subs.map((x) => ({ slot: x.slot, player: ps[x.bench] })), tac: { attitude: plan.att, press: t.press, pass_style: t.pass, attack_side: t.side, line_height: t.line, zone_width: t.width, compact: t.compact, situ: { ...t.situ } } };
      if (moved) ch.tac.cells = plan.cells.map((c) => c && { ...c });
      setTimeout(() => {
        ms.changes.push(ch);
        info.apply(ms.changes, () => {
          for (const x of plan.subs) { ms.out.push(ps[ms.on[x.slot]].name); ms.on[x.slot] = x.bench; ms.used.push(x.bench); ms.subsIn.push(ps[x.bench].name); }
          ms.cells = plan.cells; ms.att = plan.att;
          el.hidden = true;
        });
      }, 30);
    };
    draw();
  }

  // ================= サッカー協会：日程・順位 =================
  function renderAssoc() {
    const lg = save.league, st = C.standings(save);
    const table = `<table class="cr-tbl"><tr><th></th><th>チーム</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得失</th><th>点</th></tr>${st.map((t, k) => `<tr class="${t.me ? 'me' : ''}"><td>${k + 1}</td><td>${esc(t.name)}</td><td>${t.stats.P}</td><td>${t.stats.W}</td><td>${t.stats.D}</td><td>${t.stats.L}</td><td>${t.stats.GF - t.stats.GA}</td><td><b>${t.stats.Pts}</b></td></tr>`).join('')}</table>`;
    const me = lg.teams.findIndex((t) => t.me);
    const rows = [];
    const resB = (sc) => (sc ? `<b class="${sc[0] > sc[1] ? 'w' : sc[0] < sc[1] ? 'l' : 'd'}">${sc[0]}-${sc[1]}</b>` : '―');
    lg.rounds.forEach((pairs, r) => { const pr = pairs.find(([a2, b2]) => a2 === me || b2 === me); if (!pr) return; const res = lg.results[r] && lg.results[r].find((x) => x.a === pr[0] && x.b === pr[1]); const opp = lg.teams[pr[0] === me ? pr[1] : pr[0]]; const sc = res ? (pr[0] === me ? res.s : [res.s[1], res.s[0]]) : null; rows.push({ w: lg.weeks[r], now: r === lg.round, c: `第${r + 1}節`, ha: pr[0] === me ? 'ホーム' : 'アウェイ', opp: opp.name, res: resB(sc) }); });
    const cup = save.cup;
    if (cup) {
      cup.log.forEach((g, k) => rows.push({ w: g.week || C.CUP_WEEKS[k], cup: true, c: `国内カップ ${g.label}`, ha: '', opp: g.opp, res: resB(g.s) + (g.pk ? `<small>PK${g.win ? '勝' : '負'}</small>` : '') }));
      const nf = C.nextFixture(save);
      if (nf && nf.kind === 'cup') rows.push({ w: nf.week, cup: true, c: `国内カップ ${nf.label}`, ha: nf.home ? 'ホーム' : 'アウェイ', opp: nf.opp.name, res: '―' });
    }
    if (save.post) for (const m of save.post.matches) if (m.a === save.team.name || m.b === save.team.name) { const mine = m.a === save.team.name; rows.push({ w: m.week, cup: true, c: `${m.comp} ${m.label}`, ha: '', opp: (mine ? m.b : m.a) || '未定', res: m.done ? resB(mine ? m.s : [m.s[1], m.s[0]]) : '―' }); }
    rows.sort((x, y) => x.w - y.w);
    const sched = rows.map((x) => { const k = cal(x.w); return `<tr class="${x.now ? 'now' : ''}${x.cup ? ' cupr' : ''}"><td>${esc(x.c)}</td><td>${k.m}月${k.w}週</td><td>${x.ha}</td><td>${esc(x.opp)}</td><td>${x.res}</td></tr>`; }).join('');
    const cupInfo = cup ? (cup.champion ? `国内カップ優勝：<b>${esc(cup.champion)}</b>` : (cup.waiting || []).includes(save.team.name) ? '国内カップ：<b>3回戦から登場</b>（D1・D2のチーム）' : cup.alive.includes(save.team.name) ? `国内カップ：<b>勝ち残り中</b>（残り${cup.alive.length}チーム）` : `国内カップ：敗退（残り${cup.alive.length}チーム）`) : '';
    const hist = save.history.length ? save.history.map((h) => `<p>シーズン${h.season}　${esc(h.league)}　${esc(h.msg)}</p>`).join('') : '<p>まだありません</p>';
    $('#clubLayer').innerHTML = `<div class="dpanel assoc"><h2>${esc(lg.name)}　<small>シーズン${save.season}</small></h2><div class="as-grid"><div><h4>順位表</h4>${table}<h4>これまでの戦績</h4>${hist}<button id="crReset" class="quiet">最初からやり直す</button></div><div><h4>日程</h4><p class="cupinfo">${cupInfo}</p><table class="sched">${sched}</table></div></div></div>`;
    $('#crReset').onclick = async () => {
      const ok = await modal('<h2>最初からやり直しますか？</h2><p>育てた選手・順位はすべて消えます。</p>', [{ label: 'やり直す', value: true }, { label: 'やめる', value: false, primary: true }]);
      if (ok) { save = C.newCareer(); store(); runners.length = 0; go('home'); }
    };
  }

  // ---------- モーダル ----------
  function modal(html, buttons) {
    $('#crModalBody').innerHTML = html + `<div class="cr-mbtns">${buttons.map((b, k) => `<button data-k="${k}" class="${b.primary ? 'primary ' : ''}${ibCls(b.label, !!b.primary || buttons.length === 1)}">${esc(b.label)}</button>`).join('')}</div>`;
    $('#crModal').hidden = false;
    return new Promise((res) => { $('#crModalBody').querySelectorAll('.cr-mbtns button').forEach((el) => el.onclick = () => { $('#crModal').hidden = true; res(buttons[+el.dataset.k].value); }); });
  }
  const pname = (k) => C.PNAME[k] || k;

  // ---------- 週をすすめる：練習 → 結果 → 試合 ----------
  // 1人の特訓結果カード
  function resultCard(o) {
    const p = save.team.players[o.i], spm = o.sp != null ? C.SP[o.sp] : null;
    const rows = Object.entries(o.ups).filter(([, v]) => v >= 1 || v < 0).sort((x, y) => y[1] - x[1]).map(([k, v]) => `<div class="pv"><span>${ico(k, 'sm')}${esc(C.PNAME[k])}</span>${gauge(o.before[k], v)}<b class="plus${v < 0 ? ' minus' : ''}">${v > 0 ? '+' : ''}${Math.round(v)}</b></div>`).join('');
    const notes = [];
    if (spm) notes.push(`<div class="spban${o.spNew ? ' new' : ''}">${o.spNew ? 'NEW！ ' : ''}スペシャルメニュー「${esc(spm.name)}」</div>`);
    if (o.learned && o.got) notes.push(`<b class="cr-learn">★ スキル「${esc(D.SKILLS[o.learned].name)}」を覚えた！</b>${o.forgot ? `（${esc(D.SKILLS[o.forgot].name)}を忘れた）` : ''}`);
    if (o.skillMiss) notes.push(`<b class="cr-miss">スキル「${esc(D.SKILLS[o.skillMiss].name)}」は覚えられなかった…（${Math.round((o.rate || C.SKILL_RATE) * 100)}%）　次は${Math.round((o.nextRate || 0) * 100)}%</b>`);
    if (o.learned && o.skipped) notes.push(`「${esc(D.SKILLS[o.learned].name)}」は覚えなかった`);
    if (o.typeTo) notes.push(`<b class="cr-type">タイプが ${esc(o.typeFrom)} → ${esc(o.typeTo)} に変わった！</b>`);
    if (o.injured) notes.push('<b class="cr-inj">ケガをしてしまった…</b>');
    return `<div class="rcard"><div class="rc-h">${portrait(p)}<div><b>${p.number} ${esc(o.name)}</b><span>${o.cards.map((c) => `<i class="mini ${CATC[C.CARDS[c].cat]}">${esc(C.CARDS[c].name)}</i>`).join('')}</span></div></div>${notes.join('')}<div class="rc-p">${rows || '<p class="hintp">―</p>'}</div></div>`;
  }
  // 「特訓する！」：その場でこの選手だけ特訓して結果を見せる
  async function doTrain(i) {
    const o = C.trainOne(save, i, (save.plan.cards || {})[i] || []);
    if (!o) return;
    store();
    if (o.learned) {
      const p = save.team.players[i];
      if (C.learnSkill(p, o.learned)) o.got = true;
      else {
        const nm = D.SKILLS[o.learned].name;
        const pk = await modal(`<h2>${esc(p.name)}が「${esc(nm)}」を覚えようとしている！</h2><p>スキル枠（${C.slots(p)}つ）がいっぱいです。忘れるスキルを1つ選んでください。</p>`,
          [...p.skills.map((k) => ({ label: `${D.SKILLS[k].name}を忘れる`, value: k })), { label: `${nm}を覚えない`, value: null }]);
        if (pk) { C.learnSkill(p, o.learned, pk); o.got = true; o.forgot = pk; } else o.skipped = true;
      }
      store();
    }
    await modal(`<h2>特訓の結果${C.campState(save) ? '<small>（合宿ボーナス ×' + C.CAMP.mult + '）</small>' : ''}</h2><div class="rgrid one">${resultCard(o)}</div>`, [{ label: 'OK', primary: true }]);
    // 次の未特訓の選手へ自動で移る
    const ps = save.team.players;
    for (let k = 1; k <= ps.length; k++) { const j = (i + k) % ps.length; if (!(ps[j].injury > 0) && !C.trainedThisWeek(save, ps[j])) { selIdx = j; break; } }
    renderTrain();
  }

  // ---------- 週をすすめる：全体練習（自動） → 試合 ----------
  // セットしたまま特訓していないカードがあれば確認
  async function confirmLeft(next) {
    const ps = save.team.players;
    const left = ps.filter((q, i) => !(q.injury > 0) && !C.trainedThisWeek(save, q) && ((save.plan.cards || {})[i] || []).length).length;
    if (!left) return true;
    return coachAsk(`監督、カードをセットしたまま特訓していない選手が${left}人います。<br>このまま${({ '試合に進む': '試合に進みますか？', '週をすすめる': '週をすすめますか？', '練習試合をする': '練習試合をしますか？' })[next] || next + 'ますか？'}`);
  }
  // ▶：試合の週ならスタジアムへ。試合がない週は、そのまま1週間すすむ
  async function advance() {
    const fx = C.nextFixture(save);
    const matchWeek = fx && fx.week <= save.week && !C.campState(save);
    if (matchWeek && !(await coachAsk('監督、今週は公式戦があります。<br>スタジアムに移動しますか？'))) return;
    if (!(await confirmLeft(matchWeek ? '試合に進む' : '週をすすめる'))) return;
    if (matchWeek) { stadium(true); return; }
    await endWeek();
  }
  // コーチからの報告（ケガ）
  const WHERE = { practice: 'クラブハウスでの練習中に', match: '試合中に', train: '特訓中に' };
  async function coachNews(list) {
    for (const n of list) await modal(`<div class="cnews"><div class="cn-face">${coachFace()}</div><div class="cn-say"><b class="cn-name">コーチ</b><p>監督！${WHERE[n.where] || ''}${esc(n.name)}がケガをしてしまいました。<br>${esc(n.kind)}で、回復には<b>${n.weeks}週間</b>必要です。</p></div></div>`, [{ label: '▶', primary: true }]);
  }
  // 1週間を終える（全体練習・疲労回復・ケガの経過 → 次の週）
  // 版478：週が変わる時、画面が一瞬うす暗くなって、新しい週を見せて、また明るくなる
  function weekFx(phase, label, sub) {
    let el = document.getElementById('weekFx');
    if (!el) { el = document.createElement('div'); el.id = 'weekFx'; el.innerHTML = '<div class="wf-in"><b></b><small></small></div>'; (document.getElementById('app') || document.body).appendChild(el); }
    if (phase === 'dark') { el.querySelector('b').textContent = ''; el.querySelector('small').textContent = ''; el.className = 'wf-dark'; return new Promise((r) => setTimeout(r, 420)); }
    if (phase === 'show') { try { window.DotSound && DotSound.play('week'); } catch (_) {} el.querySelector('b').textContent = label; el.querySelector('small').textContent = sub || ''; el.className = 'wf-dark wf-show'; return new Promise((r) => setTimeout(r, sub ? 1250 : 850)); }
    el.className = 'wf-light'; return new Promise((r) => setTimeout(r, 450));
  }
  async function endWeek() {
    const sn0 = seasonOfMonth(cal(save.week || 1).m);
    await weekFx('dark');
    const res = C.endWeek(save); store();
    { const k = cal(save.week || 1), sn1 = seasonOfMonth(k.m); if (view === 'home') renderHome(); await weekFx('show', `${k.m}月 ${k.w}週`, sn1 !== sn0 ? `${SEASON_JP[sn1]}になりました` : ''); await weekFx('light'); }
    await coachNews(res.news);
    const tc = res.rep.filter((o) => o.typeTo).map((o) => `<p><b class="cr-type">${esc(o.name)}：タイプが ${esc(o.typeFrom)} → ${esc(o.typeTo)} に変わった！</b></p>`).join('');
    if (res.camp) await modal(res.campDone ? `<h2>⛺ ${res.camp.name}終了！</h2><p>4週間の合宿で、全員がひとまわり成長しました。</p>${tc}<p>${res.camp.name === '夏合宿' ? '9月から<b>リーグ後半戦</b>です。' : '3月から<b>新シーズン</b>です！'}</p>` : `<h2>⛺ ${res.camp.name} ${res.camp.week}週目 終了</h2><p>全体練習で、全員が少しずつ成長しました。</p>${tc}<p class="hintp">あと${res.camp.weeks - res.camp.week}週。特訓は週${C.CAMP.trains}回・カードの効果${C.CAMP.mult}倍です。</p>`, [{ label: 'OK', primary: true }]);
    else if (tc) await modal(`<h2>今週の練習</h2>${tc}`, [{ label: 'OK', primary: true }]);
    if (res.leagueDone) await modal(`<h2>リーグ戦終了！</h2><p class="cr-score">${esc(save.league.name)}　${res.pos}位</p><p>昇格・降格はシーズンの終わり（2月）に決まります。それまでは特訓でチームを鍛えよう。</p>`, [{ label: 'OK', primary: true }]);
    if (res.season) await venueTalk(res.season);
    if (res.season) await modal(`<h2>シーズン${save.season - 1} 終了</h2><p>${esc(res.season.from)}　${res.season.pos}位</p><h2>${esc(res.season.msg)}</h2><p>新しいシーズン：${esc(res.season.to)}</p>${(res.season.titles || []).map((x) => x.mine ? `<p class="cr-learn">★ ${esc(x.name)}が「国内屈指の${esc(x.type)}」になった！</p>` : x.lost ? `<p>${esc(x.lost)}は「国内屈指の${esc(x.type)}」ではなくなった…（${esc(x.team)}の${esc(x.name)}へ）</p>` : `<p class="sn-t">国内屈指の${esc(x.type)}：${esc(x.team)}の${esc(x.name)}</p>`).join('')}${(res.season.retired || []).length ? `<p class="sn-r"><b>引退</b>${res.season.retired.slice(0, 8).map((x) => `${esc(x.team)}の${esc(x.name)}${x.title ? '（国内屈指）' : ''}`).join('、')}${res.season.retired.length > 8 ? ` ほか${res.season.retired.length - 8}人` : ''}</p>` : ''}`, [{ label: '新シーズンへ', primary: true }]);
    const cs = C.campState(save);
    if (res.campStart && cs) await modal(`<h2>⛺ ${cs.name === '夏合宿' ? '8月は夏合宿！' : '2月は春季キャンプ！'}</h2><p>${cs.name === '夏合宿' ? 'リーグは中断期間に入ります。' : '新シーズンに向けた合宿です。'}合宿中は公式戦がありません（練習試合はできます）。</p><ul class="campul"><li>特訓は<b>1週に${cs.trains}回</b>までできる</li><li>カードの効果が<b>${cs.mult}倍</b></li><li>全体練習が<b>いつもより充実</b>（全員が少しずつ伸びる）</li><li>そのぶん疲れやすいので、ケガに注意</li></ul>`, [{ label: '合宿スタート！', primary: true }]);
    store();
    if (view === 'home') renderHome(); else go(view);
  }

  $('#hmNext').onclick = advance;
  // ================= コーチの声かけ（カルチョビットAのように、コーチが出てきて はい／いいえ） =================
  // 版528：監督の作った「決定／やめる」ボタン（青＝進む・白＝もどる）。文字が「決定」「やめる」の時はその絵、ほかは同じ形の無地に文字
  const ibCls = (label, go) => { const t = String(label).replace(/\s|　/g, ''); return go ? (t === '決定' ? 'ib ib-ok ib-img' : 'ib ib-ok') : (t === 'やめる' ? 'ib ib-no ib-img' : 'ib ib-no'); };
  function coachAsk(html, buttons, who) {
    const sec = who === 'sec';
    buttons = buttons || [{ label: 'は　い', value: true }, { label: 'いいえ', value: false }];
    coachFace();
    let el = document.getElementById('coachTalk');
    if (!el) { el = document.createElement('div'); el.id = 'coachTalk'; (document.getElementById('app') || $('#career')).appendChild(el); }
    el.innerHTML = `<div class="ct-bust">${sec ? `<img class="art" src="${staffFace('sec')}" alt="秘書">` : staffImg.coach ? `<img class="art" src="${staffImg.coach}" alt="コーチ">` : `<img src="${coachURL}" alt="コーチ">`}</div><div class="ct-btns">${buttons.map((b, k) => `<button data-k="${k}" class="${ibCls(String(b.label).replace(/<[^>]*>/g, ''), b.value !== false)}">${b.label}</button>`).join('')}</div><div class="ct-box"><b class="ct-name">${sec ? '秘書' : 'コーチ'}</b><p>${html}</p></div>`;
    el.hidden = false; { const im = el.querySelector('.ct-bust img'); const go = () => requestAnimationFrame(() => el.classList.add('on')); if (im && !im.complete) { im.style.visibility = 'hidden'; const ok = () => { im.style.visibility = ''; go(); }; im.onload = ok; im.onerror = ok; } else go(); }   /* 版559：絵が読めてから出す（一瞬四角が見えないように） */
    { const bx = el.querySelector('.ct-box'), bt = el.querySelector('.ct-btns'); if (bx && bt) bt.style.bottom = (bx.offsetHeight + 30 + 6) + 'px'; }   /* 版536：本家と同じく、文の枠のすぐ上の右に */   // 版510：文が長い時も、ボタンが文の上に出る（押せるように）
    return new Promise((res) => el.querySelectorAll('.ct-btns button').forEach((b) => b.onclick = () => { el.classList.remove('on'); el.hidden = true; res(buttons[+b.dataset.k].value); }));
  }
  // ================= 試合前：入場口（LIVE）→ 対戦カード → キックオフ =================
  const STADIUM_SUF = ['スタジアム', '陸上競技場', 'フットボールパーク', '総合運動公園'];
  function stadiumName(op, meta) {
    if (meta.practice) return `${save.team.name}　練習場`;
    const homeTown = meta.home ? (save.team.short || save.team.name) : (op.short || op.name), sd = meta.home ? 3 : (C.findTeam(save, op.name) || { seed: 1 }).seed || 1;
    const tier = venueOf(op, meta);
    if (tier <= 1) return homeTown + ['市民グラウンド', '運動公園'][tier];   // 地域リーグは小さな会場
    return homeTown + (tier === 4 ? ['スタジアム', 'フットボールパーク'][sd % 2] : STADIUM_SUF[sd % STADIUM_SUF.length]);
  }
  function rankOf(name) { const st = C.standings(save), i = st.findIndex((t) => t.name === name); return i >= 0 ? i + 1 : 0; }
  function lgOf(name) { if (name === save.team.name) return save.league.id; const t = C.findTeam(save, name); return t && t.lg ? t.lg : (Object.keys(save.world.leagues).find((id) => save.world.leagues[id].some((x) => x.name === name)) || save.league.id); }
  // 勝敗の予想（TOTO）：チームの強さの差から
  function totoOf(op, meta) {
    const me = C.teamLevel(save), ot = (C.findTeam(save, op.name) || { lvl: me }).lvl, d = (me - ot + (meta.home ? 1.5 : -1.5)) / 8;
    const pw = 1 / (1 + Math.exp(-d)), dr = 0.24 * Math.exp(-Math.abs(d) * 0.45) + 0.06, win = (1 - dr) * pw, lose = (1 - dr) * (1 - pw);
    const r = [win, dr, lose].map((v) => Math.round(v * 100)); r[1] = 100 - r[0] - r[2];
    return meta.home ? r : [r[2], r[1], r[0]];   // 上のチーム（ホーム）から
  }
  let liveRaf = 0;
  function preMatch(op, meta) {
    let el = document.getElementById('liveScr');
    if (!el) { el = document.createElement('div'); el.id = 'liveScr'; $('#career').appendChild(el); }
    const home = meta.home ? { name: save.team.name, me: true } : { name: op.name }, away = meta.home ? { name: op.name } : { name: save.team.name, me: true };
    const lgH = lgOf(home.name), lgA = lgOf(away.name), stad = stadiumName(op, meta);
    const title = `${esc(meta.comp)}${meta.label ? '　' + esc(meta.label) : ''}`;
    return new Promise((resolve) => {
      const showLive = () => { try { window.DotSound && DotSound.bgm('prematch'); } catch (_) {}
        el.innerHTML = `<canvas width="1280" height="720"></canvas>
          <div class="lv-head"><div class="lv-t"><b>LIVE</b><span>${title}</span></div>
            <div class="lv-m"><img src="${emblemURL(home.name, 40)}" alt="">${esc((C.findTeam(save, home.name) || {}).short || home.name.replace(/FC$/, ''))}${lgBadge(lgH)}<em>×</em><img src="${emblemURL(away.name, 40)}" alt="">${esc((C.findTeam(save, away.name) || {}).short || away.name.replace(/FC$/, ''))}${lgBadge(lgA)}</div>
            <div class="lv-s">${esc(stad)}</div></div>
          <div class="rbtns lv-btns"><button data-a="lineup"><span>${rbLineupSVG()}</span><b>スタメン</b></button><button data-a="tac"><span>${RB_TAC_SVG}</span><b>戦術</b></button><button data-a="kit" class="lv-kit lv-kitimg" title="ユニフォーム"><img src="icons/off_kit.png" alt="ユニフォーム"></button><button data-a="ko" class="lv-ko lv-koimg" title="試合開始"><img src="icons/btn_kickoff.png" alt="試合開始"></button></div>`;
        el.hidden = false;
        try { A().applyKits(C.kitsFor(save, op.name, meta.kitSel, meta.oppSel)); } catch (_) {}   // 版482：並んでいる選手も、この試合のユニフォームで
        const cv = el.querySelector('canvas'), ctx2 = cv.getContext('2d');
        const myL = save.team.players.slice(0, 11), opT = C.opponentTeam(save, op).players.slice(0, 11);
        const rows = meta.home ? [{ ps: myL, team: 0 }, { ps: opT, team: 1 }] : [{ ps: opT, team: 1 }, { ps: myL, team: 0 }];
        cancelAnimationFrame(liveRaf);
        const loop = (t) => { drawTunnel(ctx2, rows, t); liveRaf = requestAnimationFrame(loop); };
        liveRaf = requestAnimationFrame(loop);
        el.querySelectorAll('.lv-btns button').forEach((b) => b.onclick = () => {
          const a = b.dataset.a;
          if (a === 'lineup' || a === 'tac') { cancelAnimationFrame(liveRaf); { const sc = el.querySelector('canvas'); liveSnap = document.createElement('canvas'); liveSnap.width = 1280; liveSnap.height = 720; try { liveSnap.getContext('2d').drawImage(sc, 0, 0, 1280, 720); } catch (_) { liveSnap = null; } } el.hidden = true; sqTab = a === 'tac' ? 'tac' : 'pos'; liveBack = () => { showLive(); }; go('lineup'); return; }
          if (a === 'kit') { kitPick(el, op, meta, () => showLive()); return; }
          cancelAnimationFrame(liveRaf); showVs();
        });
        if (window.__tut) window.__tut.onLive(el, meta);   // チュートリアル：試合前の画面の説明
      };
      // 本家の流れ：暗転 → 動くスタンドに両チームの帯とTOTO → 帯がはけて入場 → サポーターの旗とコール → （試合画面で）入場とズーム → キックオフ
      const showVs = () => {
        const tt = totoOf(op, meta);
        const sub = (nm, side, lg) => { const rk = rankOf(nm); return `<div class="vs-sub">${side}${lgBadge(lg)}${rk ? `<b>${rk}位</b>` : ''}</div>`; };
        el.innerHTML = `<canvas width="1280" height="720"></canvas><div class="vs2">
          <div class="vs-top">${title}</div>
          <div class="vs-row h"><div class="vs-ban"><img src="${emblemURL(home.name, 96)}" alt=""><b>${esc(home.name)}</b></div>${sub(home.name, 'HOME', lgH)}</div>
          <div class="vs-vs">VS</div>
          <div class="vs-row a"><div class="vs-ban"><img src="${emblemURL(away.name, 96)}" alt=""><b>${esc(away.name)}</b></div>${sub(away.name, 'AWAY', lgA)}</div>
          <div class="vs-toto"><h5>TOTO</h5><div><small>WIN</small><b>${tt[0]}%</b></div><div><small>DRAW</small><b>${tt[1]}%</b></div><div><small>WIN</small><b>${tt[2]}%</b></div><h5>DOT</h5></div>
          <div class="vs-bot">${esc(stad)}</div></div><div class="ko-fade"></div><button class="vs-go ui-img" title="とばす"><img src="icons/ui_next.png" alt="次へ"></button>`;
        const cv = el.querySelector('canvas'), cx3 = cv.getContext('2d'), vs = el.querySelector('.vs2'), fade = el.querySelector('.ko-fade');
        const homeRow = meta.home ? save.team.players.slice(0, 11) : C.opponentTeam(save, op).players.slice(0, 11), awayRow = meta.home ? C.opponentTeam(save, op).players.slice(0, 11) : save.team.players.slice(0, 11);
        const hT = meta.home ? 0 : 1, aT = 1 - hT;
        const steps = [[0, 'v0'], [700, 'v1'], [1100, 'v2'], [1500, 'v3'], [2000, 'v4'], [7600, 'v5'], [10400, 'v6']];
        const timers = steps.map(([ms, cls]) => setTimeout(() => vs.classList.add(cls), ms));
        let t0 = 0, done = false, holdAt = 0;
        const finish = () => { if (done) return; done = true; timers.forEach(clearTimeout); cancelAnimationFrame(liveRaf); el.hidden = true; resolve('watch'); };
        if (window.__tut) window.__tut.onVs(el, meta);   // チュートリアル：TOTOの説明（説明の間は、絵を止める）
        const loop = (now) => {
          if (!t0) t0 = now;
          if (window.__tutHold) { if (!holdAt) holdAt = now; liveRaf = requestAnimationFrame(loop); return; } if (holdAt) { t0 += now - holdAt; holdAt = 0; }
          const t = (now - t0) / 1000;
          if (t < 10.6) drawStandsPan(cx3, t, homeRow, awayRow, hT, aT);
          else drawFlagsScene(cx3, t - 10.6, home.name);
          // 暗転：はじめ・入場のあと・コールのあと
          const f = t < 0.6 ? 1 - t / 0.6 : t > 10.1 && t < 10.6 ? (t - 10.1) / 0.5 : t >= 10.6 && t < 11 ? 1 - (t - 10.6) / 0.4 : t > 15.9 ? Math.min(1, (t - 15.9) / 0.5) : 0;
          fade.style.opacity = f;
          if (t > 16.5) { finish(); return; }
          liveRaf = requestAnimationFrame(loop);
        };
        liveRaf = requestAnimationFrame(loop);
        el.querySelector('.vs-go').onclick = finish;
      };
      showLive();
    });
  }
  // 入場口（カルチョビットAの画面を写したレイアウト）：実況席のガラス・奥へ続く通路・ピッチへ出る帯と手すり・カメラマン・運営スタッフ・審判・記録係の机
  // 座標は元の画面（幅892×高さ541）の位置で書いて、1280×720に写す
  const LVS = 1.331, LVX = 46;
  const LT = (x, y) => [(x - 158) * LVS + LVX, y * LVS];
  let tunnelBg = null;
  const peopleCache = new Map();
  // 服の色を塗り替えた人（スーツのスタッフ・審判・カメラマン・実況）
  function dressed(key, info, view, frame, cols) {
    const k = key + '|' + view + '|' + frame;
    if (peopleCache.has(k)) return peopleCache.get(k);
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const src = A().spriteCanvas(info, 0, view, frame, false, false);
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), px = d.data;
    const MAP = [['#2f6fd6', cols[0]], ['#6ea2f2', cols[1]], ['#1d4796', cols[2]], ['#ffffff', cols[3]]].map(([a2, b2]) => [hex(a2), hex(b2)]);
    for (let i = 0; i < px.length; i += 4) for (const [f, t] of MAP) if (px[i] === f[0] && px[i + 1] === f[1] && px[i + 2] === f[2]) { px[i] = t[0]; px[i + 1] = t[1]; px[i + 2] = t[2]; }
    x.putImageData(d, 0, 0);
    // スーツは胸元に白いシャツとネクタイ
    if (cols[4] === 'suit') { for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) { const q = (yy * c.width + xx) * 4; } x.fillStyle = '#f2f2f2'; x.fillRect(8, 13, 2, 3); x.fillStyle = '#c03030'; x.fillRect(8, 14, 1, 2); }
    // 審判はたてじま
    if (cols[4] === 'stripe') { const im = x.getImageData(0, 0, c.width, c.height), p2 = im.data, sh = hex(cols[0]); for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) { const q = (yy * c.width + xx) * 4; if (xx % 3 === 0 && p2[q] === sh[0] && p2[q + 1] === sh[1] && p2[q + 2] === sh[2]) { p2[q] = 140; p2[q + 1] = 90; p2[q + 2] = 130; } } x.putImageData(im, 0, 0); }
    peopleCache.set(k, c); return c;
  }
  const SUIT_NAVY = ['#2c3566', '#3d4880', '#1c2244', '#252c55', 'suit'], SUIT_GRAY = ['#6c6e74', '#8a8d93', '#4e5055', '#55575c', 'suit'], SHIRT = ['#f4f4f2', '#ffffff', '#cfcfcc', '#2a2f45', ''], REF = ['#5a3450', '#74486a', '#3a2034', '#3a2a36', 'stripe'], CAMMAN = ['#f2962a', '#ffb44e', '#c26c12', '#2a3a6e', ''];
  function panelFace(c, q, cols, rows, base, line) {
    // q：[左下, 右下, 右上, 左上]
    const P = q.map(([x, y]) => LT(x, y));
    c.fillStyle = base; c.beginPath(); P.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fill();
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    c.save(); c.beginPath(); P.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.clip();
    c.strokeStyle = line; c.lineWidth = 2;
    for (let i = 0; i <= cols; i++) { const a = lerp(P[0], P[1], i / cols), b = lerp(P[3], P[2], i / cols); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
    for (let j = 0; j <= rows; j++) { const a = lerp(P[0], P[3], j / rows), b = lerp(P[1], P[2], j / rows); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
    // 光の当たるふち・ボルト
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const p0 = lerp(lerp(P[0], P[1], (i + 0.06) / cols), lerp(P[3], P[2], (i + 0.06) / cols), (j + 0.08) / rows);
      const p1 = lerp(lerp(P[0], P[1], (i + 0.94) / cols), lerp(P[3], P[2], (i + 0.94) / cols), (j + 0.08) / rows);
      c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.stroke();
      c.fillStyle = 'rgba(60,60,60,0.45)';
      for (const [u, v] of [[0.12, 0.15], [0.88, 0.15], [0.12, 0.85], [0.88, 0.85]]) { const b = lerp(lerp(P[0], P[1], (i + u) / cols), lerp(P[3], P[2], (i + u) / cols), (j + v) / rows); c.fillRect(b[0] - 1, b[1] - 1, 2, 2); }
    }
    c.restore();
  }
  function noisePoly(c, pts, base, dark, light, n) {
    const P = pts.map(([x, y]) => LT(x, y));
    c.save(); c.beginPath(); P.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fillStyle = base; c.fill(); c.clip();
    const r = seeded(n || 5); for (let k = 0; k < 2600; k++) { c.fillStyle = r() < 0.5 ? dark : light; c.fillRect(r() * 1280, r() * 720, 2, 2); }
    c.restore();
  }
  function railing(c, a, b) {
    const A2 = LT(...a), B2 = LT(...b), H = 24;
    c.strokeStyle = '#f6f09a'; c.lineWidth = 3;
    for (const h of [H, H * 0.45]) { c.beginPath(); c.moveTo(A2[0], A2[1] - h); c.lineTo(B2[0], B2[1] - h); c.stroke(); }
    c.strokeStyle = '#ffffff'; c.lineWidth = 3;
    const n = Math.round(Math.hypot(B2[0] - A2[0], B2[1] - A2[1]) / 52);
    for (let k = 0; k <= n; k++) { const x = A2[0] + (B2[0] - A2[0]) * k / n, y = A2[1] + (B2[1] - A2[1]) * k / n; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x, y - H); c.stroke(); }
    c.lineWidth = 1;
  }
  function buildTunnelBg() {
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const c = cv.getContext('2d');
    // 通路の床（青緑）
    noisePoly(c, [[100, -10], [1100, -10], [1100, 560], [100, 560]], '#2b6a84', 'rgba(0,0,0,0.08)', 'rgba(255,255,255,0.05)', 3);
    // 床：奥（右上）ほど暗く、天井の照明が床に落ちる
    { const g = c.createLinearGradient(...LT(400, 520), ...LT(1100, 40)); g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,10,20,0.32)'); c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
      for (let k = 0; k < 5; k++) { const [x, y] = LT(560 + k * 150, 300 - k * 52); const r = c.createRadialGradient(x, y, 6, x, y, 150); r.addColorStop(0, 'rgba(210,240,255,0.16)'); r.addColorStop(1, 'rgba(210,240,255,0)'); c.fillStyle = r; c.beginPath(); c.ellipse(x, y, 190, 80, -0.32, 0, 7); c.fill(); }
      // 床の目地（通路の向きにそって）
      c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 2; for (let k = -6; k < 14; k++) { c.beginPath(); c.moveTo(...LT(160 + k * 90, 600)); c.lineTo(...LT(160 + k * 90 + 520, 600 - 520 * 1.2)); c.stroke(); } }
    // 左下：茶色の地面・緑のピッチ・茶色の地面（手すりで区切られた帯）
    noisePoly(c, [[90, 170], [300, 278], [393, 310], [158, 435], [90, 472]], '#6e4a22', 'rgba(0,0,0,0.1)', 'rgba(255,255,255,0.04)', 7);
    noisePoly(c, [[90, 472], [393, 310], [594, 430], [320, 560], [90, 560]], '#2f7a2a', 'rgba(0,0,0,0.1)', 'rgba(255,255,255,0.04)', 8);
    noisePoly(c, [[320, 560], [594, 430], [800, 560]], '#6e4a22', 'rgba(0,0,0,0.1)', 'rgba(255,255,255,0.04)', 9);
    // 床と地面のさかいめ（少し暗い）
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(...LT(300, 278)); c.lineTo(...LT(800, 560)); c.stroke(); c.lineWidth = 1;
    // 奥の壁（通路の左側・コンクリート）と、角から奥へ続く通路
    // 通路は1本道：左の壁が、そのまま奥（右上）までまっすぐ続く
    panelFace(c, [[300, 278], [1180, -17], [1180, -320], [300, -20]], 14, 6, '#c3c2bc', 'rgba(90,90,86,0.55)');
    // 実況席の建物（左上のかど）
    panelFace(c, [[90, 172], [300, 278], [300, -40], [90, -150]], 4, 7, '#cdccc6', 'rgba(90,90,86,0.55)');
    // 壁のつけ根の影
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.moveTo(...LT(300, 278)); c.lineTo(...LT(1180, -17)); c.lineTo(...LT(1180, -5)); c.lineTo(...LT(300, 290)); c.closePath(); c.fill();
    // 壁の飾り：幅木・クラブカラーの帯・バナー・照明（安っぽく見えないように、奥行きと光を足す）
    { const yb = (x) => 278 - (x - 300) * 0.33523;
      const wq = (x1, x2, h1, h2) => [[x1, yb(x1) - h1], [x2, yb(x2) - h1], [x2, yb(x2) - h2], [x1, yb(x1) - h2]].map(([x, y]) => LT(x, y));
      const fillQ = (P, col) => { c.fillStyle = col; c.beginPath(); P.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fill(); };
      fillQ(wq(300, 1180, 0, 12), '#55575a');
      fillQ(wq(300, 1180, 12, 15), '#8d8f92');
      fillQ(wq(420, 1180, 22, 32), '#1f8a44'); fillQ(wq(420, 1180, 32, 36), '#f2c21c');
      const banners = [[450, '#123a2a', '#e7ff62', 'DOT SOCCER'], [620, '#f4f2ea', '#1f8a44', 'FAIR PLAY']];
      for (const [x, bg, fg, tx] of banners) {
        const P = wq(x, x + 130, 50, 112); fillQ(P, 'rgba(0,0,0,0.2)'); const Q = wq(x + 4, x + 126, 54, 108); fillQ(Q, bg);
        c.save(); const [ax, ay] = Q[3], [bx, by] = Q[2]; c.translate((Q[0][0] + Q[2][0]) / 2, (Q[0][1] + Q[2][1]) / 2); c.transform(1, (by - ay) / (bx - ax), 0, 1, 0, 0);
        c.fillStyle = fg; c.font = '900 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tx, 0, 0); c.restore();
      }
      for (let x = 380; x < 760; x += 170) { const L = wq(x, x + 46, 140, 148); fillQ(L, '#fffbe6'); const [lx, ly] = L[0];
        const g = c.createRadialGradient(lx + 30, ly + 10, 4, lx + 30, ly + 10, 120); g.addColorStop(0, 'rgba(255,248,215,0.35)'); g.addColorStop(1, 'rgba(255,248,215,0)'); c.fillStyle = g; c.fillRect(lx - 100, ly - 110, 260, 240); }
    }
    // 実況席のガラス（かどをはさんで2面）
    const glass = (q, tone) => { const P = q.map(([x, y]) => LT(x, y)); c.beginPath(); P.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fillStyle = tone; c.fill(); c.strokeStyle = '#8a8c88'; c.lineWidth = 4; c.stroke(); c.lineWidth = 1; };
    glass([[215, 182], [300, 225], [300, 140], [215, 140]], '#8fb2b8');
    glass([[300, 225], [420, 182], [420, 140], [300, 140]], '#7ea2aa');
    // 実況の2人（ガラスの向こう）
    const ann = [[{ hair: 1, hairColor: 1, skin: 0 }, SUIT_GRAY, 312, 222, false], [{ hair: 2, hairColor: 1, skin: 0 }, SUIT_NAVY, 392, 196, true]];
    for (const [info, cols, x, y, fl] of ann) {
      const img = dressed('ann' + x, info, 'f34', 0, cols), [X, Y] = LT(x, y), sc = 2.5, S = A().SPR;
      c.save(); const G = [[215, 182], [300, 225], [420, 182], [420, 140], [215, 140]].map(([gx, gy]) => LT(gx, gy)); c.beginPath(); G.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.clip();
      c.imageSmoothingEnabled = false; c.translate(X, 0); if (fl) c.scale(-1, 1); c.globalAlpha = 0.85; c.drawImage(img, -S.W * sc / 2, Y - (S.H - 2) * sc, S.W * sc, S.H * sc); c.restore();
    }
    // ガラスの映りこみ
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(...LT(230, 142)); c.lineTo(...LT(262, 142)); c.lineTo(...LT(240, 190)); c.lineTo(...LT(222, 186)); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(...LT(360, 142)); c.lineTo(...LT(386, 142)); c.lineTo(...LT(372, 190)); c.lineTo(...LT(350, 197)); c.closePath(); c.fill();
    // 手すり（ピッチの両側）
    railing(c, [158, 435], [383, 316]);
    railing(c, [323, 540], [586, 434]);
    tunnelBg = cv;
  }
  function drawTunnel(c, rows, t) {
    if (!tunnelBg) buildTunnelBg();
    c.drawImage(tunnelBg, 0, 0);
    const S = A().SPR, sc = 2.5, objs = [];
    const put = (img, x, y, flip, extra) => { const [X, Y] = LT(x, y); objs.push({ y: Y, f: () => { c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(X, Y, 9 * sc, 3 * sc, 0, 0, 7); c.fill(); c.save(); c.imageSmoothingEnabled = false; c.translate(X, 0); if (flip) c.scale(-1, 1); c.drawImage(img, -S.W * sc / 2, Y - (S.H - 2) * sc, S.W * sc, S.H * sc); c.restore(); if (extra) extra(X, Y); } }); };
    const bob = (k) => (Math.floor(t / 460 + k * 0.63) % 2 ? 1 : 0);
    // 2列に並んだ両チーム（ホームが壁側）。先頭はGK、ピッチ（左下）を向いている
    // 2列はまっすぐ・等間隔に。となりの列とは横並び
    const ROW1 = Array.from({ length: 11 }, (_, k) => [494 + 44 * k, 322 - 22 * k]);
    const ROW2 = ROW1.map(([x, y]) => [x + 62, y + 38]);
    [ROW1, ROW2].forEach((pos, ri) => { const row = rows[ri]; const gkI = row.ps.findIndex((p) => p.position === 'GK'); const order = [gkI >= 0 ? gkI : 0, ...row.ps.map((_, i) => i).filter((i) => i !== (gkI >= 0 ? gkI : 0))];
      order.slice(0, 11).forEach((pi, k) => { const p = row.ps[pi]; put(A().spriteCanvas(p, row.team, 'f34', bob(k + ri), false, k === 0), pos[k][0], pos[k][1], true); }); });
    // 審判3人（列の先頭・ピッチの入口）
    [[403, 365], [433, 412], [513, 425]].forEach(([x, y], k) => put(dressed('ref' + k, { hair: k % 3, hairColor: 0, skin: k % 2 }, 'f34', bob(k + 5), REF), x, y, true));
    // 運営スタッフ（スーツ・白シャツ）
    const STAFF = [[420, 262, SUIT_NAVY, 0, false], [470, 236, SUIT_GRAY, 1, true], [560, 212, SHIRT, 2, true], [760, 150, SHIRT, 3, true], [905, 300, SUIT_NAVY, 1, true], [800, 342, SHIRT, 0, false], [890, 392, SHIRT, 2, true]];
    STAFF.forEach(([x, y, cols, h, fl], k) => put(dressed('st' + k, { hair: h, hairColor: k % 2 ? 1 : 0, skin: 0 }, k === 5 ? 'b34' : 'f34', 0, cols), x, y, fl));
    // 記録係の机（黄土色の長机と書類）
    const TB = [[723, 367], [760, 353], [883, 413], [847, 430]].map(([x, y]) => LT(x, y));
    objs.push({ y: LT(800, 395)[1], f: () => {
      c.fillStyle = '#7a7a7a'; for (const [x, y] of [TB[0], TB[1], TB[2], TB[3]]) c.fillRect(x - 2, y, 4, 26);
      c.fillStyle = '#9a8628'; c.beginPath(); c.moveTo(TB[3][0], TB[3][1]); c.lineTo(TB[2][0], TB[2][1]); c.lineTo(TB[2][0], TB[2][1] + 7); c.lineTo(TB[3][0], TB[3][1] + 7); c.closePath(); c.fill();
      c.fillStyle = '#c9ad3c'; c.beginPath(); TB.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fill();
      c.fillStyle = '#f4f4f0'; for (const [x, y] of [[795, 388], [818, 400]]) { const [X, Y] = LT(x, y); c.beginPath(); c.moveTo(X - 9, Y); c.lineTo(X, Y - 5); c.lineTo(X + 10, Y); c.lineTo(X + 1, Y + 5); c.closePath(); c.fill(); }
    } });
    // カメラマン（手すりの外から選手を撮る。ときどきフラッシュ）
    const CAM = [[195, 400, false], [223, 360, false], [295, 365, false], [318, 300, false], [368, 335, false], [520, 515, true], [585, 470, true], [640, 505, true], [700, 478, true], [740, 522, true]];
    CAM.forEach(([x, y, back], k) => put(dressed('cam' + k, { hair: k % 4, hairColor: (k * 3) % 5, skin: k % 3 }, back ? 'b34' : 'f34', 0, CAMMAN), x, y, back, (X, Y) => {
      const dir = back ? -1 : 1, cx2 = X + dir * 8, cy2 = Y - 44;
      c.fillStyle = '#2a2a2a'; c.fillRect(cx2 - 7, cy2 - 5, 16, 11); c.fillStyle = '#4a4a4a'; c.fillRect(cx2 + dir * 8 - 3, cy2 - 3, 7, 7); c.fillStyle = '#888'; c.fillRect(cx2 - 4, cy2 - 8, 6, 3);
      if ((Math.floor(t / 210) + k * 5) % 26 === 0) { c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.arc(cx2 + dir * 14, cy2, 15, 0, 7); c.fill(); }
    }));
    objs.sort((a, b) => a.y - b.y).forEach((o) => o.f());
  }
  // ---------- 対戦カード〜入場の背景：屋根つきの大きなスタンド（カメラがゆっくり横へ・下へ動く） ----------
  let standPano = null, standTier = -1, venueNow = 4;
  const standPanos = {};
  function buildStandPano() {
    if (standPanos[venueNow]) { standPano = standPanos[venueNow]; standTier = venueNow; return; }
    const W = 2600, H = 1180, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), r = seeded(21);
    if (venueNow <= 1) {   // 地域リーグ：空と木立、土手（地域1部は小さなスタンド）、金網の向こうのグラウンド
      const bot = 840;
      const sky = c.createLinearGradient(0, 0, 0, 640); sky.addColorStop(0, '#5fb3ff'); sky.addColorStop(1, '#cdebff'); c.fillStyle = sky; c.fillRect(0, 0, W, 660);
      c.fillStyle = '#fff'; for (let k = 0; k < 9; k++) { const x = r() * W, y = 60 + r() * 300; for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(x + j * 46, y + (j % 2) * 10, 60, 30, 0, 0, 7); c.fill(); } }
      for (let x = -40; x < W + 60; x += 46) { const h = 120 + r() * 90; c.fillStyle = ['#2f6b2a', '#3a7d31', '#2a5f26'][Math.floor(r() * 3)]; c.beginPath(); c.ellipse(x, 640 - h * 0.35, 48, h * 0.55, 0, 0, 7); c.fill(); }
      c.fillStyle = '#5d9a33'; c.fillRect(0, 610, W, bot - 610);   // 土手
      c.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 620; y < bot; y += 14) c.fillRect(0, y, W, 3);
      if (venueNow === 1) {   // 小さな仮設スタンド
        const sx0 = 520, sx1 = 1500, st = 650;
        c.fillStyle = '#8c8f96'; c.fillRect(sx0 - 10, st - 20, sx1 - sx0 + 20, bot - st + 20);
        for (let y = st; y < bot - 10; y += 15) { c.fillStyle = ((y - st) / 15) % 2 ? '#3d5a8c' : '#35507e'; c.fillRect(sx0, y, sx1 - sx0, 13); }
        for (let y = st + 6; y < bot - 16; y += 15) for (let x = sx0 + 4; x < sx1 - 8; x += 9) { if (r() < 0.62) continue; c.fillStyle = ['#e8e2d2', '#3a5ad0', '#d94a3a', '#2a2a2a', '#f2c21c', '#3aa84a'][Math.floor(r() * 6)]; c.fillRect(x, y + 2, 6, 7); c.fillStyle = ['#f2c99c', '#d9a46e', '#9a6a44'][Math.floor(r() * 3)]; c.fillRect(x + 1, y - 3, 4, 4); }
      } else for (let k = 0; k < 40; k++) { const x = 100 + r() * (W - 200), y = 700 + r() * 120; c.fillStyle = ['#e8e2d2', '#3a5ad0', '#d94a3a', '#2a2a2a', '#f2c21c'][Math.floor(r() * 5)]; c.fillRect(x, y, 7, 9); c.fillStyle = '#f2c99c'; c.fillRect(x + 1, y - 5, 5, 5); }   // 土手で見ている人
      // 金網と、クラブハウスの入り口
      c.fillStyle = '#b7a888'; c.fillRect(0, bot, W, 128);   // 土の通路
      for (let k = 0; k * 160 < W; k++) { c.fillStyle = venueNow === 1 ? (k % 2 ? '#4c9f26' : '#55a72c') : '#5b9a2e'; c.fillRect(k * 160, bot + 128, 160, H - bot - 128); }
      c.fillStyle = '#fff'; c.fillRect(0, bot + 150, W, 4);
      c.strokeStyle = 'rgba(220,225,225,0.7)'; c.lineWidth = 2; for (let x = 0; x < W; x += 14) { c.beginPath(); c.moveTo(x, bot - 40); c.lineTo(x + 14, bot + 4); c.moveTo(x + 14, bot - 40); c.lineTo(x, bot + 4); c.stroke(); }
      c.fillStyle = '#8f969a'; for (let x = 0; x < W; x += 180) c.fillRect(x, bot - 46, 6, 52); c.fillRect(0, bot - 46, W, 4);
      { const gx0 = 760, gx1 = 880, gy0 = 772, gyB = bot + 82; c.fillStyle = '#c9b48a'; c.fillRect(gx0 - 40, gy0 - 60, gx1 - gx0 + 80, gyB - gy0 + 60); c.fillStyle = '#a2471e'; c.fillRect(gx0 - 50, gy0 - 76, gx1 - gx0 + 100, 22); c.fillStyle = '#3a2a1a'; c.fillRect(gx0, gy0, gx1 - gx0, gyB - gy0); c.fillStyle = '#1a8a3a'; c.fillRect(gx0 + 6, gy0 - 40, gx1 - gx0 - 12, 24); c.fillStyle = '#fff'; c.font = '900 15px sans-serif'; c.textAlign = 'center'; c.fillText('PLAYERS', (gx0 + gx1) / 2, gy0 - 22); }
      standPano = cv; standPanos[venueNow] = cv; standTier = venueNow; return;
    }
    // 屋根（鉄骨）
    c.fillStyle = '#d7d9de'; c.fillRect(0, 0, W, 210);
    c.fillStyle = '#b9bcc4'; for (let x = 0; x < W; x += 180) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 90, 210); c.lineTo(x + 110, 210); c.lineTo(x + 20, 0); c.fill(); }
    c.fillStyle = '#9da1aa'; c.fillRect(0, 196, W, 22); c.fillStyle = '#6f737c'; c.fillRect(0, 214, W, 8);
    // スタンド（段ごとに少し暗く・赤い座席）
    const top = 222, bot = 840;
    for (let y = top; y < bot; y += 15) { c.fillStyle = ((y - top) / 15) % 2 ? '#5a2a2c' : '#4c2224'; c.fillRect(0, y, W, 15); }
    // 観客（小さな人がぎっしり）
    for (let y = top + 6; y < bot - 6; y += 15) for (let x = 0; x < W; x += 9) {
      if (r() < [0.93, 0.72, 0.42, 0.16, 0.08][venueNow]) continue;   // 会場が小さいほど、空いている席が多い
      const col = ['#e8e2d2', '#3a5ad0', '#d94a3a', '#2a2a2a', '#f2c21c', '#3aa84a', '#8a6ad0', '#f2f2f2', '#c8204a'][Math.floor(r() * 9)];
      c.fillStyle = col; c.fillRect(x + r() * 2, y + 2, 6, 7); c.fillStyle = ['#f2c99c', '#d9a46e', '#9a6a44'][Math.floor(r() * 3)]; c.fillRect(x + 1, y - 3, 4, 4);
    }
    // 通路（階段）と、段の間の通路
    for (let x = 140; x < W; x += 420) { c.fillStyle = '#9a9ca2'; c.beginPath(); c.moveTo(x, top); c.lineTo(x + 34, top); c.lineTo(x + 60, bot); c.lineTo(x + 10, bot); c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,0.15)'; for (let y = top; y < bot; y += 15) c.fillRect(x + (y - top) * 0.04, y, 46, 2); }
    c.fillStyle = '#8c8f96'; c.fillRect(0, 520, W, 26); c.fillStyle = '#6e7178'; c.fillRect(0, 544, W, 6);
    for (let x = 300; x < W; x += 520) { c.fillStyle = '#5a5d63'; c.fillRect(x, 470, 70, 50); c.fillStyle = '#2a2c30'; c.fillRect(x + 8, 480, 54, 40); }
    // スタンドの前の壁と看板
    c.fillStyle = '#7f828a'; c.fillRect(0, bot, W, 40);
    const ads = [['DOT SOCCER', '#ffffff', '#1a8a3a'], ['はじまり商店', '#f2c21c', '#1a1a1a'], ['GOAL!!', '#c8202a', '#ffffff'], ['ドット牛乳', '#ffffff', '#2a5ad0'], ['SHOOT', '#1a1a1a', '#f2c21c']];
    for (let k = 0; k * 260 < W; k++) { const [tx, bg, fg] = ads[k % ads.length]; c.fillStyle = bg; c.fillRect(k * 260 + 6, bot + 44, 248, 34); c.fillStyle = fg; c.font = '900 20px sans-serif'; c.textAlign = 'center'; c.fillText(tx, k * 260 + 130, bot + 68); }
    // 陸上トラックとピッチ
    c.fillStyle = '#b8562a'; c.fillRect(0, bot + 82, W, 46); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(0, bot + 82 + k * 11.5); c.lineTo(W, bot + 82 + k * 11.5); c.stroke(); }
    for (let k = 0; k * 160 < W; k++) { c.fillStyle = k % 2 ? '#3fae38' : '#48ba40'; c.fillRect(k * 160, bot + 128, 160, H - bot - 128); }
    c.fillStyle = '#fff'; c.fillRect(0, bot + 150, W, 4);
    // 選手の入場ゲート（スタンド下の壁をくりぬいた通路）
    { const gx0 = 760, gx1 = 880, gy0 = 772, gyB = bot + 82;
      c.fillStyle = '#6e7178'; c.fillRect(gx0 - 16, gy0 - 14, gx1 - gx0 + 32, gyB - gy0 + 14);
      c.fillStyle = '#9a9da4'; c.fillRect(gx0 - 12, gy0 - 10, gx1 - gx0 + 24, 10); c.fillRect(gx0 - 12, gy0, 10, gyB - gy0); c.fillRect(gx1 + 2, gy0, 10, gyB - gy0);
      const g = c.createLinearGradient(0, gy0, 0, gyB); g.addColorStop(0, '#050506'); g.addColorStop(0.55, '#14151a'); g.addColorStop(1, '#34363e');
      c.fillStyle = g; c.fillRect(gx0, gy0, gx1 - gx0, gyB - gy0);
      c.fillStyle = 'rgba(255,240,190,0.18)'; c.fillRect(gx0 + 34, gy0 + 18, gx1 - gx0 - 68, 26);
      c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 2; for (let k = 1; k < 5; k++) { const y = gy0 + 44 + k * k * 4.5; c.beginPath(); c.moveTo(gx0, y); c.lineTo(gx1, y); c.stroke(); }
      c.fillStyle = '#1a8a3a'; c.fillRect(gx0 + 6, gy0 - 40, gx1 - gx0 - 12, 24); c.fillStyle = '#fff'; c.font = '900 15px sans-serif'; c.textAlign = 'center'; c.fillText('PLAYERS', (gx0 + gx1) / 2, gy0 - 22);
      // 足もとの黄色と黒の縁取り
      for (let x = gx0 - 12; x < gx1 + 12; x += 12) { c.fillStyle = ((x - gx0) / 12) % 2 ? '#1a1a1a' : '#f2c21c'; c.fillRect(x, gyB - 4, 12, 4); }
    }
    standPano = cv; standPanos[venueNow] = cv; standTier = venueNow;
  }
  function drawStandsPan(c, t, homeRow, awayRow, hT, aT) {
    if (!standPano || standTier !== venueNow) buildStandPano();
    // カメラ：はじめはスタンド、だんだん下へ（ピッチの端が見える）、入場の場面では選手を追って横へ
    const ty = Math.min(1, Math.max(0, (t - 1.5) / 6)), sy = ty * ty * (3 - 2 * ty);
    const camY = 150 + sy * 300, camX = 300 + t * 46;
    c.drawImage(standPano, -camX, -camY);
    // 入場：スタンド下のゲートから2列で出てきて、トラックを越えてピッチの中（センターサークルのある手前側）へ斜めに走っていく
    if (t > 5.4) {
      const S = A().SPR, d = (t - 5.4) * 115, list = [];
      const GX = 820, GY = 852, OUT = 950, dx = 0.93, dy = 0.37, L1 = OUT - GY;
      [[homeRow, hT, 0], [awayRow, aT, 1]].forEach(([row, team, li]) => row.forEach((p, k) => {
        const sd = d - k * 46; if (sd < 0) return;
        const off = li ? 15 : -15;
        let wx, wy, view;
        if (sd < L1) { wx = GX + off; wy = GY + sd; view = 'front'; }
        else { const e = sd - L1; wx = GX + off * (1 - Math.min(1, e / 60)) + e * dx - (li ? 1 : 0) * 22 * dy * Math.min(1, e / 60); wy = OUT + e * dy + (li ? 22 * dx : 0) * Math.min(1, e / 60); view = e < 30 ? 'front' : 'f34'; }
        list.push({ p, team, k, x: wx - camX, y: wy - camY, wy, view });
      }));
      c.save();
      // ゲートの中にいる間は入口の枠の内側だけ見える
      c.beginPath(); c.rect(760 - camX, 772 - camY, 120, 200); c.rect(-50, 922 - camY, 1400, 900); c.clip();
      list.sort((a2, b2) => a2.y - b2.y).forEach(({ p, team, k, x, y, wy, view }) => {
        const sc = wy < 950 ? 1.6 + (wy - 852) / 98 * 0.5 : 2.1 + Math.max(0, (wy - 950) / 180) * 0.8;
        const img = A().spriteCanvas(p, team, view, Math.floor(t * 10 + k) % 4, true, k === 0);
        c.imageSmoothingEnabled = false;
        if (wy > 922) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y, 7 * sc, 2 * sc, 0, 0, 7); c.fill(); }
        if (wy < 922) c.filter = `brightness(${0.35 + (wy - 852) / 70 * 0.65})`;
        c.drawImage(img, x - S.W * sc / 2, y - (S.H - 2) * sc, S.W * sc, S.H * sc);
        c.filter = 'none';
      });
      c.restore();
    }
  }
  // サポーター席：エンブレムの白い旗がたくさん振られ、チーム名のコール
  let flagBg = null, flagTier = -1;
  function buildFlagBg() {
    const W = 1600, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), r = seeded(33);
    c.fillStyle = '#9da1aa'; c.fillRect(0, 0, W, 40);
    for (let y = 40; y < 470; y += 26) { c.fillStyle = ((y - 40) / 26) % 2 ? '#5a2a2c' : '#4c2224'; c.fillRect(0, y, W, 26); }
    for (let y = 48; y < 466; y += 26) for (let x = 0; x < W; x += 15) { if (r() < [0.86, 0.66, 0.4, 0.18, 0.08][venueNow ?? 4]) continue;   /* 版469：会場が小さいほど空席が多い */ c.fillStyle = ['#e8e2d2', '#3a5ad0', '#d94a3a', '#2a2a2a', '#f2c21c', '#f2f2f2', '#2a5ad0'][Math.floor(r() * 7)]; c.fillRect(x, y + 4, 11, 12); c.fillStyle = ['#f2c99c', '#d9a46e', '#9a6a44'][Math.floor(r() * 3)]; c.fillRect(x + 2, y - 4, 8, 8); c.fillStyle = '#3a2a1a'; c.fillRect(x + 2, y - 5, 8, 3); }
    c.fillStyle = '#8c8f96'; c.fillRect(0, 470, W, 36);
    const ads = [['DOT SOCCER', '#ffffff', '#1a8a3a'], ['はじまり商店', '#f2c21c', '#1a1a1a'], ['GOAL!!', '#c8202a', '#ffffff'], ['ドット牛乳', '#ffffff', '#2a5ad0'], ['SHOOT', '#1a1a1a', '#f2c21c'], ['カルチョ堂', '#2a8a3a', '#ffffff']];
    for (let k = 0; k * 220 < W; k++) { const [tx, bg, fg] = ads[k % ads.length]; c.fillStyle = bg; c.fillRect(k * 220 + 4, 508, 212, 44); c.fillStyle = fg; c.font = '900 24px sans-serif'; c.textAlign = 'center'; c.fillText(tx, k * 220 + 110, 539); }
    for (let k = 0; k * 140 < W; k++) { c.fillStyle = k % 2 ? '#3fae38' : '#48ba40'; c.beginPath(); c.moveTo(k * 140, 552); c.lineTo(k * 140 + 140, 552); c.lineTo(k * 140 + 100, H); c.lineTo(k * 140 - 40, H); c.closePath(); c.fill(); }
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 600); c.lineTo(W, 600); c.stroke(); c.beginPath(); c.moveTo(860, 600); c.lineTo(790, H); c.stroke();
    // ゴール（ピッチ側から見た正面。奥にネット、手前に白い枠）
    const gx0 = 1010, gx1 = 1250, gy = 600, gh = 84, bk = 16;
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(gx0 + 6, gy - gh - bk + 4, gx1 - gx0 - 12, gh + 2);
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.5;
    for (let x = gx0 + 6; x <= gx1 - 6; x += 10) { c.beginPath(); c.moveTo(x, gy - gh - bk + 4); c.lineTo(x, gy - bk + 6); c.stroke(); }
    for (let y = gy - gh - bk + 4; y <= gy - bk + 6; y += 10) { c.beginPath(); c.moveTo(gx0 + 6, y); c.lineTo(gx1 - 6, y); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    for (let k = 0; k <= 4; k++) { const u = k / 4; c.beginPath(); c.moveTo(gx0, gy - gh * u); c.lineTo(gx0 + 6, gy - bk + 6 - (gh + 2) * u); c.stroke(); c.beginPath(); c.moveTo(gx1, gy - gh * u); c.lineTo(gx1 - 6, gy - bk + 6 - (gh + 2) * u); c.stroke(); }
    for (let x = gx0; x <= gx1; x += 20) { c.beginPath(); c.moveTo(x, gy - gh); c.lineTo(gx0 + 6 + (x - gx0) * (gx1 - gx0 - 12) / (gx1 - gx0), gy - gh - bk + 4); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(gx0 - 4, gy - 2, gx1 - gx0 + 8, 6);
    c.fillStyle = '#9a9ca6'; c.fillRect(gx0 - 3, gy - gh - 3, 9, gh + 3); c.fillRect(gx1 - 6, gy - gh - 3, 9, gh + 3); c.fillRect(gx0 - 3, gy - gh - 3, gx1 - gx0 + 6, 9);
    c.fillStyle = '#ffffff'; c.fillRect(gx0 - 3, gy - gh - 3, 6, gh + 1); c.fillRect(gx1 - 6, gy - gh - 3, 6, gh + 1); c.fillRect(gx0 - 3, gy - gh - 3, gx1 - gx0 + 6, 6);
    // ゴールエリアとペナルティエリアの線
    c.strokeStyle = '#fff'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(960, gy); c.lineTo(935, 660); c.lineTo(1335, 660); c.lineTo(1300, gy); c.stroke();
    flagBg = cv; flagTier = venueNow;
  }
  function drawFlagsScene(c, t, teamName) {
    if (!flagBg || flagTier !== venueNow) buildFlagBg();
    const camX = 120 + t * 30;
    c.drawImage(flagBg, -camX, 0);
    const emb = embImgFor(teamName);
    const N = [3, 5, 8, 11, 14][venueNow ?? 4] ?? 14, FK = [1, 7, 3, 11, 5, 9, 0, 13, 2, 12, 4, 10, 6, 8];   /* 版469：地域リーグは旗も少ない */
    for (let k0 = 0; k0 < N; k0++) { const k = FK[k0];
      const bx = 60 + k * 100 - camX * 0.9 + (k % 2) * 30, by = 300 + (k % 3) * 60;
      const ang = Math.sin(t * 3.4 + k * 1.7) * 0.75 - 0.15, L = 190;
      const px = bx + Math.sin(ang) * L, py = by - Math.cos(ang) * L;
      c.strokeStyle = '#d0d2d6'; c.lineWidth = 4; c.beginPath(); c.moveTo(bx, by); c.lineTo(px, py); c.stroke();
      // 布（波打つ白い旗にエンブレム）
      const W2 = 96, H2 = 70, dir = Math.cos(ang) >= 0 ? 1 : -1;
      c.fillStyle = '#e9ebef'; c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i <= 8; i++) { const u = i / 8; c.lineTo(px + u * W2 * dir, py + Math.sin(t * 9 + u * 5 + k) * 9 * u); }
      for (let i = 8; i >= 0; i--) { const u = i / 8; c.lineTo(px + u * W2 * dir, py + H2 + Math.sin(t * 9 + u * 5 + k) * 9 * u); }
      c.closePath(); c.fill(); c.stroke();
      if (emb.complete) c.drawImage(emb, px + dir * W2 * 0.5 - 24, py + H2 / 2 - 24 + Math.sin(t * 9 + 2.5 + k) * 4, 48, 48);
    }
    // チーム名のコール（黄色い札が場所を変えて浮かぶ）
    const slot = Math.floor(t / 1.2), pos = [[0.25, 0.32], [0.62, 0.45], [0.38, 0.28], [0.7, 0.3], [0.5, 0.55]][slot % 5];
    c.font = '900 30px "Hiragino Kaku Gothic ProN",sans-serif'; c.textAlign = 'center';
    const w = c.measureText(teamName).width + 44;
    const x = Math.max(w / 2 + 12, Math.min(1268 - w / 2, 1280 * pos[0])), y = 720 * pos[1] - Math.abs(Math.sin(t * 6)) * 6;   // 札が画面からはみ出さないように
    c.fillStyle = '#ffe23a'; c.strokeStyle = '#1a1a1a'; c.lineWidth = 3; roundRect(c, x - w / 2, y - 26, w, 48, 12); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 10, y + 22); c.lineTo(x, y + 36); c.lineTo(x + 10, y + 22); c.fill();
    c.fillStyle = '#1a1a1a'; c.fillText(teamName, x, y + 9);
  }
  const embImgs = new Map();
  function embImgFor(name) { if (!embImgs.has(name)) { const im = new Image(); im.src = emblemURL(name, 96); embImgs.set(name, im); } return embImgs.get(name); }
  // 試合を行う（観る／結果だけ）→ done(score, events, played)
  // ハーフタイムの「途中経過」：同じ節のほかの試合（前半の点数）と、暫定の順位
  function halfOthers(my, minute) {
    const lg = save.league, pk = C.peekRound ? C.peekRound(save) : null;
    if (!lg || !pk || C.nextFixture(save)?.kind !== 'league') return null;
    const nm = (i) => lg.teams[i].short || lg.teams[i].name;
    const atMin = minute == null ? 45 : minute;   // その時間までに入った点（ハーフタイムは前半の分）
    for (const g of pk) if (!g.me) g.half = g.mins ? g.mins.map((l) => l.filter((m) => m <= atMin).length) : g.half;
    const games = pk.filter((g) => !g.me).map((g) => ({ home: nm(g.a), away: nm(g.b), s: g.half, homeFull: lg.teams[g.a].name, awayFull: lg.teams[g.b].name }));
    // 暫定順位：今の勝ち点に、前半の点数で終わったとした分を足す
    const tb = lg.teams.map((t, i) => ({ name: t.name, me: t.me, Pts: t.stats.Pts, GF: t.stats.GF, GA: t.stats.GA, i }));
    for (const g of pk) if (g.me && my) g.half = lg.teams[g.a].me ? [my[0], my[1]] : [my[1], my[0]];
    for (const g of pk) if (g.half) { const [x, y] = g.half, A = tb[g.a], B = tb[g.b]; A.GF += x; A.GA += y; B.GF += y; B.GA += x; if (x > y) A.Pts += 3; else if (x < y) B.Pts += 3; else { A.Pts++; B.Pts++; } }
    tb.sort((x, y) => y.Pts - x.Pts || (y.GF - y.GA) - (x.GF - x.GA) || y.GF - x.GF);
    return { league: lg.name, round: lg.round + 1, games, table: tb };
  }
  // 会場の格：ホームのチームのリーグ（0＝地域2部 … 4＝D1）。練習試合はクラブの練習場
  function venueOf(op, meta) {
    meta = meta || {};
    const tierOf = (name) => ((C.LG[lgOf(name)] || {}).tier ?? 2);
    if (meta.practice) return Math.min(1, tierOf(save.team.name));
    return tierOf(meta.home ? save.team.name : op.name);
  }
  // 試合のユニフォームを選ぶ（カルチョビットAの、ホーム・アウェー・キーパーが並ぶ画面）
  function kitPick(el, op, meta, back) {
    const cl = C.ensureClub(save), cur = meta.kitSel || 'auto', curO = meta.oppSel || 'auto', ps = save.team.players, ok = C.oppKits(save, op.name), opPs = C.opponentTeam(save, op).players;
    const now = C.kitsFor(save, op.name, cur, curO);
    const same = (a, b) => a.shirt === b.shirt && a.pat === b.pat;
    const onMine = (k) => same(now[0], k === 'home' ? cl.kit : cl.kit2), onOpp = (k) => same(now[1], ok[k]);
    const card = (side, k, label, on) => `<button class="kp-c${on ? ' on' : ''}" data-side="${side}" data-k="${k}"><b>${label}</b><div class="kp-cv" data-kit="${side}-${k}"></div></button>`;
    let ov = el.querySelector('.kp'); if (!ov) { ov = document.createElement('div'); ov.className = 'kp'; el.appendChild(ov); }
    ov.innerHTML = `<div class="kp-in kp2"><h3>この試合のユニフォーム</h3><div class="kp-teams">
        <div class="kp-team"><div class="kp-tn"><img src="${emblemURL(save.team.name, 32)}" alt="">${esc(save.team.name)}</div><div class="kp-row">${card('me', 'home', 'ホーム', onMine('home'))}${card('me', 'away', 'アウェー', onMine('away'))}</div></div>
        <div class="kp-team"><div class="kp-tn"><img src="${emblemURL(op.name, 32)}" alt="">${esc(op.name)}</div><div class="kp-row">${card('op', 'home', 'ホーム', onOpp('home'))}${card('op', 'away', 'アウェー', onOpp('away'))}</div></div></div>
      <p class="kp-note">${cur === 'auto' && curO === 'auto' ? 'おまかせ：色がかぶらないように選びます' : '色がかぶって見にくい時は、どちらかをアウェーに'}</p><div class="kp-btns"><button data-auto="1" class="${cur === 'auto' && curO === 'auto' ? 'on' : ''}">おまかせ</button><button class="kp-ok primary">決定</button></div></div>`;
    const draw1 = (key, kit, pl) => { const host = ov.querySelector(`[data-kit="${key}"]`); for (const [view, p] of [['front', pl[9]], ['f34', pl[5]]]) { const cv = A().kitSprite(kit, p || {}, view); if (cv) { const c2 = document.createElement('canvas'); c2.width = cv.width * 4; c2.height = cv.height * 4; const x = c2.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(cv, 0, 0, c2.width, c2.height); host.appendChild(c2); } } };
    draw1('me-home', cl.kit, ps); draw1('me-away', cl.kit2, ps); draw1('op-home', ok.home, opPs); draw1('op-away', ok.away, opPs);
    const apply = () => { try { A().applyKits(C.kitsFor(save, op.name, meta.kitSel, meta.oppSel)); } catch (_) {} };
    ov.querySelectorAll('[data-side]').forEach((b) => b.onclick = () => { if (b.dataset.side === 'me') { meta.kitSel = b.dataset.k; if (!meta.oppSel || meta.oppSel === 'auto') meta.oppSel = onOpp('away') ? 'away' : 'home'; } else { meta.oppSel = b.dataset.k; if (!meta.kitSel || meta.kitSel === 'auto') meta.kitSel = onMine('away') ? 'away' : 'home'; } apply(); kitPick(el, op, meta, back); });
    ov.querySelector('[data-auto]').onclick = () => { meta.kitSel = 'auto'; meta.oppSel = 'auto'; apply(); kitPick(el, op, meta, back); };
    ov.querySelector('.kp-ok').onclick = () => { ov.remove(); apply(); back(); };
  }
  async function runMatch(title, sub, opTeamInfo, done, meta) {
    venueNow = venueOf(opTeamInfo, meta);
    const how = meta && meta.skipPre ? 'watch' : await preMatch(opTeamInfo, meta || { comp: title, label: '', home: true });
    const mt = C.matchTeam(save), opp = C.opponentTeam(save, opTeamInfo), seed = 1 + Math.floor(Math.random() * 999999);
    if (how === 'watch') {
      cancelAnimationFrame(raf);
      const ms = { subsIn: [] }, subsIn = ms.subsIn;
      mt.opp = opTeamInfo.short;
      A().startWith(mt.team, opp, seed, save.team.short, opTeamInfo.short, (score) => {
        const played = mt.played.slice();
        for (const nm of subsIn) { const i = save.team.players.findIndex((q) => q.name === nm); if (i >= 0 && !played.includes(i)) played.push(i); }
        done(score, (A().match || {}).events || [], played);
      }, { venue: venueNow, kits: C.kitsFor(save, opTeamInfo.name, (meta || {}).kitSel, (meta || {}).oppSel), tut: window.__tut ? window.__tut.matchOpts(meta || {}) : null, onSub: (info) => subSheet(mt, info, ms), noIntro: true, comp: (meta || {}).comp || title, label: (meta || {}).label || '', absent: save.team.players.filter((q) => q.injury > 0 || q.suspend > 0).map((q) => ({ name: q.name, pos: q.position, number: q.number, weeks: q.injury, why: q.suspend > 0 ? '出場停止' : `ケガ（あと${q.injury}週）` })), homeName: save.team.name, awayName: opTeamInfo.name, halfOthers: (meta || {}).practice ? null : (my, minute) => halfOthers(my, minute), oneHalf: !!((meta || {}).practice && !(meta || {}).tut), embH: emblemURL(save.team.name, 48), embA: emblemURL(opTeamInfo.name, 48), grade: (q, k, tm) => { const sp = tm ? null : save.team.players.find((x) => x.name === q.name); if (sp) { C.ensurePts(sp); return C.rankInfo(sp.pts[k]).g; } return C.rankInfo(C.toPts((q.params || q)[k])).g; } });
      return;
    }
    const r = D.simulateMatch(mt.team, opp, seed, { frames: false });
    const goals = r.events.filter((e) => e.type === 'goal').map((e) => `${Math.ceil((e.t * r.clockScale) / 60)}分 ${esc(e.player)}`).join('　') || '得点なし';
    await modal(`<h2>試合結果</h2><p class="cr-score">${esc(save.team.short)} ${r.score[0]} − ${r.score[1]} ${esc(opTeamInfo.short)}</p><p>${goals}</p>`, [{ label: 'OK', primary: true }]);
    done(r.score.slice(), r.events, mt.played);
  }
  async function stadium(afterTrain) {
    const fx = C.nextFixture(save);
    const official = fx && fx.week <= save.week && !C.campState(save);
    if (!official) {
      // 公式戦のない週：練習試合（カードを少しかせげる）
      const fk = fx ? cal(fx.week) : null;
      const info = fx ? `次の公式戦は <b>${fk.m}月${fk.w}週</b>（あと${fx.weeksLeft}週）です。` : '今シーズンの公式戦は終わりました。';
      const op = await practiceBoard(info);
      if (!op || !(await confirmLeft('練習試合をする'))) return;
      runMatch('練習試合', `${esc((C.LG[op.lg] || {}).name || '')}の${esc(op.name)}と練習試合`, op, (score, ev, played) => { const got = C.playPractice(save, score, played); afterRound(got, { practice: true }); }, { comp: '練習試合', label: '', home: true, practice: true });
      return;
    }
    if (!afterTrain) { advance(); return; }
    runMatch('試合の日！', `${esc(fx.comp)}　${esc(fx.label)}（${fx.home ? 'ホーム' : 'アウェイ'}）`, fx.opp, (score, ev, played) => officialDone(fx, score, ev, played), { comp: fx.comp, label: fx.label, home: !!fx.home });
  }
  // 練習試合申し込み（カルチョビットAの黒板）：相手を選ぶ
  const LG_BADGE = { regE2: ['東2', 'b-e2'], regW2: ['西2', 'b-w2'], regE1: ['東1', 'b-e1'], regW1: ['西1', 'b-w1'], d3: ['D3', 'b-d3'], d2: ['D2', 'b-d2'], d1: ['D1', 'b-d1'] };
  function practiceBoard(info) {
    const list = C.practiceOptions(save);
    const slots = [...list, ...Array(Math.max(0, 8 - list.length)).fill(null)].slice(0, 8);
    let el = document.getElementById('pbModal');
    if (!el) { el = document.createElement('div'); el.id = 'pbModal'; el.className = 'modal pb-wrap'; $('#career').appendChild(el); }
    return new Promise((res) => {
      el.innerHTML = `<div class="pb-board"><button class="sb-round pb-back" title="もどる"><i class="bk-ico" aria-hidden="true"></i></button>
        <h2>練習試合申し込み</h2>
        <div class="pb-grid">${slots.map((t, k) => t ? `<button class="pb-slot" data-k="${k}"><span class="pb-top"><i class="lgb ${LG_BADGE[t.lg][1]}">${LG_BADGE[t.lg][0]}</i>${t.rank ? `${t.rank}位` : ''}${t.strong ? '<em>格上</em>' : ''}</span><b>${esc(t.name)}</b></button>` : '<div class="pb-slot empty"><span class="pb-top"></span><b></b></div>').join('')}</div>
        <p class="pb-info">${info}　練習試合をすると、今週はそれで終わりです。</p></div>`;
      el.hidden = false;
      const close = (v) => { el.hidden = true; res(v); };
      el.querySelector('.pb-back').onclick = () => close(null);
      el.querySelectorAll('.pb-slot[data-k]').forEach((b) => b.onclick = async () => {
        const t = slots[+b.dataset.k];
        el.hidden = true;
        const ok = await coachAsk(`監督、${esc(t.name)}（${esc((C.LG[t.lg] || {}).name || '')}）と<br>練習試合をしますか？`);
        if (ok) res({ ...C.findTeam(save, t.name), lg: t.lg }); else { el.hidden = false; }
      });
    });
  }
  // 公式戦の結果を記録して、試合のあとの流れへ（ロッカールームの会話 → 順位表／トーナメント表 → 秘書 → ホーム）
  function officialDone(fx, score, ev, played) {
    const before = save.league ? C.standings(save).map((t) => t.name) : null;
    const injBefore = new Set(save.team.players.filter((q) => q.injury > 0).map((q) => q.name));
    const res = C.playFixture(save, fx, score, played);
    C.recordStats(save, ev, played);
    C.recordGoals(save, fx, ev);
    const got = C.rewardCards(save, score, ev);
    if (res.coins) { save.coins = (save.coins || 0) + res.coins; got.coins = (got.coins || 0) + res.coins; }
    const off = C.afterOfficial(save, ev, score, res, played);
    const newInj = save.team.players.filter((q) => q.injury > 0 && !injBefore.has(q.name));
    afterRound(got, res, { fx, score, ev, off, newInj, before });
  }
  async function afterRound(got, res, info) {
    res = res || {};
    if (info) {
      await postLocker(got, res, info);
      store(); open();
      await postComp(res, info);
      store(); open();
      await blackClear(350);   // 版561：順位表のあとの暗転を明ける（前は秘書の画面が明けていたが、支持率をなくしたので真っ暗のまま止まっていた）
      await endWeek();
      return;
    }
    if (res.kind === 'cup' || res.kind === 'post') {
      const pk = res.pk ? '（PK戦）' : '';
      const head = res.champion ? `🏆 ${esc(res.comp)} 優勝！！` : res.win === true ? `${esc(res.comp)} ${esc(res.label)} 勝利${pk}！` : res.win === false ? `${esc(res.comp)} ${esc(res.label)} 敗退${pk}…` : `${esc(res.comp)} ${esc(res.label)}`;
      store(); open();
      await modal(`<h2>${head}</h2>${res.coins ? `<p class="coin big">${COIN}+${res.coins} コイン（カップ戦の賞金）</p>` : ''}`, [{ label: 'OK', primary: true }]);
    }
    if (got && got.length) {
      store(); open();
      await modal(`<h2>トレーニングカードを獲得！</h2>${got.coins ? `<p class="coin big">${COIN}+${got.coins} コイン</p>` : ''}<div class="hrow rw">${got.map((c) => artCard(c, { ups: true })).join('')}</div><p class="hintp">クラブハウスの「特訓」で、選手に最大3枚セットできます。</p>`, [{ label: 'OK', primary: true }]);
    }
    store(); open();
    await endWeek();
  }

  // ---------- 試合のあと：ロッカールームで、コーチ・選手が話す ----------
  const STAFF = { coach: { name: 'コーチ', number: 0, hair: 2, hairColor: 0, skin: 2, position: 'MF' }, sec: { name: '秘書', number: 0, hair: 7, hairColor: 2, skin: 0, position: 'MF' } };
  const faceOf = (p) => { try { return faceURL(p) || ''; } catch (e) { return ''; } };
  const facesReady = () => { faceLoad(); return new Promise((ok) => { const t0 = Date.now(); const chk = () => ((faceTotal && faceLoaded >= faceTotal) || Date.now() - t0 > 4000 ? ok() : setTimeout(chk, 60)); chk(); }); };
  async function postLocker(got, res, info) {
    await facesReady();
    const [a, b] = info.score, w = a > b, d = a === b;
    const lines = [];
    let t1 = w ? `監督、${a}−${b}で勝利です！` : d ? `監督、${a}−${b}の引き分けでした。` : `監督、${a}−${b}で負けてしまいました…。`;
    if (res.champion) t1 = `監督、優勝です！！\n${a}−${b}、本当におめでとうございます！`;
    else if (res.kind === 'cup' || res.kind === 'post') t1 += res.win ? `\n${res.label}突破です！` : '\nここで敗退です…。';
    const iss = (info.ev || []).some((e) => e.type === 'issue' && e.team === 0);
    const t2 = iss ? '新しい課題も見つかりましたね。効率良く練習しましょう。' : w ? 'この調子でいきましょう！' : d ? '次は勝ち点3をとりにいきましょう。' : '切りかえて、次の試合に向けて練習しましょう。';
    lines.push({ name: 'コーチ', face: staffFace('coach'), art: !!staffImg.coach, text: `${t1}\n${t2}` });
    if (got && got.length) lines.push({ name: 'コーチ', face: staffFace('coach'), art: !!staffImg.coach, text: `${got.issueN && got.issueN < got.length ? `見つかった課題のカード${got.issueN}枚と、試合のごほうび${got.length - got.issueN}枚。\n合わせて` : ''}トレーニングカードを${got.length}枚手に入れました。${got.coins ? `（コイン+${got.coins}）` : ''}`, cards: got.map((c) => ({ id: c, name: C.CARDS[c] ? C.CARDS[c].name : c })) });
    if ((info.off.condUp || []).length) { const L = info.off.condUp; lines.push({ name: 'コーチ', face: staffFace('coach'), art: !!staffImg.coach, text: `勝ったので、試合に出た選手の調子が上がりました！\n${L.slice(0, 5).join('・')}${L.length > 5 ? ` ほか${L.length - 5}人` : ''}` }); }   // 版515
    for (const nm of info.off.reds) { const p = save.team.players.find((q) => q.name === nm); if (p) lines.push({ name: p.name, face: faceOf(p), text: '今日のレッドカードで\n次の公式戦は出場停止になってしまいました。\n監督、すみませんでした…。' }); }
    // 試合中のケガ：ここで本人が報告する（週の終わりのコーチの報告では、もう言わない）
    const told = new Set();
    for (const p of info.newInj) {
      const n = (save.news || []).find((x) => x.name === p.name && x.where === 'match');
      lines.push({ name: p.name, face: faceOf(p), text: `ケガをしてしまいました…。\n${n ? `${n.kind}で、` : ''}全治${p.injury}週だそうです。監督、すみません。` });
      told.add(p.name);
    }
    if (told.size) save.news = (save.news || []).filter((x) => !(x.where === 'match' && told.has(x.name)));
    return new Promise((res2) => A().lockerTalk(lines, res2));
  }
  // ---------- 試合後の全画面（1280×720 を画面に合わせて拡大縮小）：順位表・秘書 ----------
  function fullScreen(id, cls) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div'); el.id = id; el.className = 'lk-wrap ' + cls; el.hidden = true;
      el.innerHTML = '<div class="lk-box"></div>';
      (document.getElementById('app') || document.body).appendChild(el);
      const fit = () => { const bx = el.querySelector('.lk-box');
        if (id === 'assocScreen' && (document.documentElement.classList.contains('short') || document.documentElement.classList.contains('phone'))) { bx.style.width = (el.clientWidth || innerWidth) + 'px'; bx.style.height = (el.clientHeight || innerHeight) + 'px'; bx.style.transform = 'translate(-50%,-50%)'; return; }   // 版486：スマホでは協会の画面を縮めずに、画面の大きさのまま作る（文字が大きくなる）
        bx.style.width = ''; bx.style.height = '';
        const A = document.getElementById('app'); const k = Math.min((el.clientWidth || (A && A.clientWidth) || innerWidth) / 1280, (el.clientHeight || (A && A.clientHeight) || innerHeight) / 720); bx.style.transform = `translate(-50%,-50%) scale(${k.toFixed(4)})`; };
      addEventListener('resize', fit); el._fit = fit;
    }
    return el;
  }
  // 画面の切り替え：黒へ暗転 → 中身を入れかえ → 明ける
  const blackFade = (ms) => new Promise((ok) => {
    let f = document.getElementById('blkFade');
    if (!f) { f = document.createElement('div'); f.id = 'blkFade'; (document.getElementById('app') || document.body).appendChild(f); }
    f.style.transition = `opacity ${ms}ms`; f.style.display = 'block'; requestAnimationFrame(() => { f.style.opacity = '1'; setTimeout(ok, ms + 20); });
  });
  // 版561：念のため、真っ暗のまま6秒以上たったら明ける（画面が黒いまま固まらないように）
  { let blkSince = 0; setInterval(() => { const f = document.getElementById('blkFade'); const on = f && f.style.display === 'block' && f.style.opacity === '1'; if (!on) { blkSince = 0; return; } if (!blkSince) blkSince = Date.now(); else if (Date.now() - blkSince > 6000) { blkSince = 0; blackClear(300); } }, 1000); }
  const blackClear = (ms) => new Promise((ok) => { const f = document.getElementById('blkFade'); if (!f) return ok(); f.style.transition = `opacity ${ms}ms`; f.style.opacity = '0'; setTimeout(() => { f.style.display = 'none'; ok(); }, ms + 20); });
  // リーグを表す4つのアイコン（仮）と、リーグのロゴ
  const LG_ICONS = '<div class="std-ic"><i class="i1">D1</i><i class="i2">D2</i><i class="i3">D3</i><i class="i4">地域</i></div>';
  const ARW = {
    s: '<svg viewBox="0 0 20 16" class="ar"><path d="M1 5h9V1l9 7-9 7v-4H1z" fill="#111"/></svg>',
    u: '<svg viewBox="0 0 20 20" class="ar"><path d="M3 13l7-7-3-3h10v10l-3-3-7 7z" fill="#1d6fe0" stroke="#0b3a80" stroke-width=".8"/></svg>',
    d: '<svg viewBox="0 0 20 20" class="ar"><path d="M3 7l7 7-3 3h10V7l-3 3-7-7z" fill="#e0261d" stroke="#7a0e0a" stroke-width=".8"/></svg>',
  };
  function postComp(res, info) {
    const isLg = res.kind === 'league' && save.league, isCup = (res.kind === 'cup' || res.kind === 'post') && save.cup;
    if (!isLg && !isCup) return Promise.resolve();
    return new Promise(async (done) => {
      await blackFade(250);
      openAssoc({ tab: 'stats', sub: isLg ? { kind: 'table', id: save.league.id, before: info.before } : res.kind === 'post' ? { kind: 'post' } : { kind: 'cup' }, direct: true, onClose: async () => { await blackFade(300); done(); } });
      await blackClear(300);
    });
  }

  // ---- D1観戦：次の節のD1の試合を見る（見た試合の結果は、そのまま順位に入る）----
  function watchHTML() {
    const R = C.d1Round(save);
    if (!R) return `<div class="std-body"><div class="std-h"><span>D1観戦</span></div><p class="std-soon">今シーズンのD1の試合は、すべて終わりました。</p></div>`;
    const k = cal(R.week), sh = (n) => { const t = C.findTeam(save, n); return esc((t && t.short) || n); };
    const row = (f, i) => `<div class="wt-row"><span class="wt-t">${sh(f.A)}<img src="${emblemURL(f.A, 48)}" alt=""></span>${f.done ? `<b class="wt-s">${f.done.s[0]} − ${f.done.s[1]}</b>` : '<b class="wt-vs">VS</b>'}<span class="wt-t r"><img src="${emblemURL(f.B, 48)}" alt="">${sh(f.B)}</span>${f.done ? '<em class="wt-dn">観戦済み</em>' : `<button class="wt-go" data-watch="${i}">観戦する</button>`}</div>`;
    const last = R.last.length ? `<div class="wt-h2">前の節の結果</div>${R.last.map((x) => `<div class="wt-row past"><span class="wt-t">${sh(x.A)}<img src="${emblemURL(x.A, 48)}" alt=""></span><b class="wt-s">${x.s[0]} − ${x.s[1]}</b><span class="wt-t r"><img src="${emblemURL(x.B, 48)}" alt="">${sh(x.B)}</span>${x.w ? '<em class="wt-dn">観戦</em>' : '<em></em>'}</div>`).join('')}` : '';
    return `<div class="std-body"><div class="std-h"><span>D1観戦</span><em>第${R.round + 1}節　${k.m}月${k.w}週</em></div><div class="wt"><p class="wt-note">D1リーグの次の節の試合を、試合の画面で観戦できます。観戦した試合の結果は、そのまま記録に残ります。</p>${R.list.map(row).join('')}${last}</div></div>`;
  }
  function watchD1(i, el) {
    const R = C.d1Round(save), f = R && R.list[i]; if (!f || f.done) return;
    const ta = C.opponentTeam(save, { name: f.A }), tb = C.opponentTeam(save, { name: f.B });
    const shA = (C.findTeam(save, f.A) || {}).short || f.A, shB = (C.findTeam(save, f.B) || {}).short || f.B, seed = 1 + Math.floor(Math.random() * 999999);
    el.hidden = true; assocState = null; cancelAnimationFrame(raf);
    A().startWith(ta, tb, seed, shA, shB, (score) => {
      C.pinWatch(save, R.id, R.round, f.a, f.b, score, (A().match || {}).events || []); store();
      open(); openAssoc({ tab: 'watch' });
    }, { confirmQuit: () => coachAsk('観戦をやめますか？'), onQuit: () => { open(); openAssoc({ tab: 'watch' }); }, venue: 4, kits: C.kitsPair(save, f.A, f.B), watch: true, noIntro: true, comp: 'D1観戦', label: `第${R.round + 1}節`, homeName: f.A, awayName: f.B, embH: emblemURL(f.A, 48), embA: emblemURL(f.B, 48), grade: (q, k) => C.rankInfo(C.toPts((q.params || q)[k])).g });
  }
  // ================= サッカー協会（本家の N.LEAGUE の画面）：試合日程・成績・監督成績・移籍情報 =================
  const LG_ORDER = ['d1', 'd2', 'd3', 'regE1', 'regW1', 'regE2', 'regW2'];
  const LG_LABEL = { d1: 'D1リーグ', d2: 'D2リーグ', d3: 'D3リーグ', regE1: '地域1部 東', regW1: '地域1部 西', regE2: '地域2部 東', regW2: '地域2部 西' };
  // 順位表の色分け（シーズンの終わりにどうなるか）
  function zoneOf(id, k, n) {
    if (id === 'd1') return k === 0 ? ['champ', '優勝'] : k >= n - 2 ? ['ex', 'D1昇格リーグ（残留をかけて）'] : null;
    if (id === 'd2') return k < 2 ? ['up', 'D1昇格リーグ'] : k === n - 2 ? ['ex', '入れ替え戦'] : k === n - 1 ? ['dn', '降格'] : null;
    if (id === 'd3') return k === 0 ? ['up', '昇格'] : k === 1 ? ['ex', '入れ替え戦'] : k >= n - 2 ? ['dn', '降格'] : null;
    if (id === 'regE1' || id === 'regW1') return k < 2 ? ['up', 'D3昇格トーナメント'] : k === n - 1 ? ['dn', '降格'] : null;
    return k === 0 ? ['up', '昇格'] : null;
  }
  const ZONE_COL = { champ: '優勝', up: '昇格', ex: '入れ替え', dn: '降格' };
  // リーグの4〜5つのアイコン（仮）：GPTの絵ができたら icons/lg/all.png に置きかわる
  function lgIconsHTML() {
    if (ART.leagues.includes('all')) return '<img class="std-icall" src="icons/lg/all.png" alt="">';
    // 5つの盾を、本家のような長方形にまとめる：左に大きくD1、右に2×2でD2・D3・地域1部・地域2部
    if (false && ['d1', 'd2', 'd3', 'reg1', 'reg2'].every((k) => ART.leagues.includes(k))) return `<div class="std-icr"><img class="big" src="icons/lg/d1.png" alt="D1"><div><img src="icons/lg/d2.png" alt="D2"><img src="icons/lg/d3.png" alt="D3"><img src="icons/lg/reg1.png" alt="地1"><img src="icons/lg/reg2.png" alt="地2"></div></div>`;
    // 本家（N1・N2・S・葉っぱの4マス）のように、シンプルな色の四角を3×2に：D1 D2 D3 ／ 地1 地2 ボール
    const top = ['d1', 'd2', 'd3'].map((k) => ART.leagues.includes(k) ? `<img class="t-img" src="icons/lg/${k}.png" alt="${k.toUpperCase()}">` : `<i class="t-${k}">D<b>${k[1]}</b></i>`).join('');
    const reg = [['regE1', 'e1', '東', 1], ['regE2', 'e2', '東', 2], ['regW1', 'w1', '西', 1], ['regW2', 'w2', '西', 2]].map(([k, c, r, n]) => ART.leagues.includes(k) ? `<img class="t-img t-${c}i" src="icons/lg/${k}.png" alt="${r}${n}">` : `<i class="t-${c}">${r}<b>${n}</b></i>`).join('');
    return `<div class="std-tiles">${top}${reg}</div>`;
  }
  let assocState = null;
  // 版515：相手チームの情報（チーム・スタメン）を、はみ出さない大きさに縮めて1画面に収める
  function tvFit(box) {
    const tv = box.querySelector('.tv'), ti = tv && tv.querySelector('.tv-in');
    if (ti) { ti.style.zoom = 1; const k = Math.min(1, (tv.clientHeight - 20) / ti.scrollHeight, (tv.clientWidth - 20) / ti.scrollWidth); ti.style.zoom = k.toFixed(3); }
    const tx = box.querySelector('.tx'), xi = tx && tx.querySelector('.tx-in');
    if (xi) { const W = tx.clientWidth, H = tx.clientHeight, k = Math.min(W / 1000, H / 490); xi.style.transform = `scale(${k.toFixed(4)})`; xi.style.left = Math.max(0, (W - 1000 * k) / 2) + 'px'; }
  }
  function openAssoc(opt) {
    opt = opt || {};
    const el = fullScreen('assocScreen', 'std-wrap'), box = el.querySelector('.lk-box');
    assocState = { tab: opt.tab || 'sched', sub: opt.sub || null, direct: !!opt.direct, onClose: opt.onClose || null, cupRound: null };
    const draw = () => {
      const S = assocState, myLg = save.league.id;
      const names = save.league.teams.map((t) => t.name);
      const head = `<div class="std-top">${lgIconsHTML()}<div class="std-logo"><b>D.LEAGUE</b><small>Professional Football League</small></div><div class="std-embs">${names.map((n) => `<img src="${emblemURL(n, 48)}" alt="" title="${esc(n)}">`).join('')}</div><button class="std-back" title="もどる"><i class="bk-ico" aria-hidden="true"></i></button></div>
        <div class="std-tabs">${[['sched', '試合日程'], ['stats', '成績'], ['mgr', '監督成績'], ['watch', 'D1観戦']].map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      let body = '';
      if (S.tab === 'sched') body = schedHTML();
      else if (S.tab === 'stats') body = S.sub ? statSubHTML(S.sub) : statMenuHTML(myLg);
      else if (S.tab === 'mgr') body = mgrHTML();
      else body = watchHTML();
      const tvm = S.tab === 'stats' && S.sub && S.sub.kind === 'team';
      box.innerHTML = `<div class="std${tvm ? ' tvm' : ''}">${head}${body}</div>`;
      if (tvm) requestAnimationFrame(() => tvFit(box));   // 版515：相手チームの情報は1画面に収める
      { const m = box.querySelector('.sm-menu'), bd = box.querySelector('.std-body'), H = document.documentElement;   // 版489：成績のメニューは、画面に少し余裕をもって収まる大きさに
        if (m && bd && (H.classList.contains('short') || H.classList.contains('phone'))) { m.style.zoom = 1; requestAnimationFrame(() => { const z0 = parseFloat(getComputedStyle(m.parentElement).zoom) || 1, avail = bd.clientHeight / z0 - 24, need = m.offsetHeight + 12; m.style.zoom = Math.max(0.6, Math.min(1.5, avail / need)).toFixed(3); }); } }
      box.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; S.sub = null; S.direct = false; draw(); });
      box.querySelectorAll('[data-sub]').forEach((b) => b.onclick = () => { const [kind, id] = b.dataset.sub.split(':'); S.sub = { kind, id }; draw(); });
      box.querySelectorAll('[data-cupr]').forEach((b) => b.onclick = () => { S.cupRound = +b.dataset.cupr; draw(); });
      box.querySelectorAll('[data-cupv]').forEach((b) => b.onclick = () => { S.cupView = b.dataset.cupv; draw(); });
      box.querySelectorAll('[data-team]').forEach((b) => b.onclick = () => { S.sub = { kind: 'team', id: b.dataset.team, back: S.sub, backTab: S.tab, view: 'info' }; S.tab = 'stats'; draw(); });
      box.querySelectorAll('[data-tmv]').forEach((b) => b.onclick = () => { S.sub.view = b.dataset.tmv; draw(); });
      box.querySelectorAll('.tm-row[data-pi]').forEach((r) => r.onclick = () => cpuCard(r.dataset.tid, +r.dataset.pi, el));
      box.querySelectorAll('.tx-p[data-pi],.tv-ace[data-pi]').forEach((r) => r.onclick = () => { if (+r.dataset.pi >= 0) cpuCard(r.dataset.tid, +r.dataset.pi, el); });
      box.querySelectorAll('.tm-star[data-spi]').forEach((r) => r.onclick = () => cpuCard(r.dataset.tid, +r.dataset.spi, el));
      box.querySelectorAll('.rk-row[data-rkp]').forEach((r) => r.onclick = () => {   // ランキングの選手をタップ：選手情報
        const tn = r.dataset.rkt, pn = r.dataset.rkp;
        if (tn === save.team.name) { const i = save.team.players.findIndex((q) => q.name === pn); if (i >= 0) playerDetail(i, { noNav: true }); return; }
        const t = C.findTeam(save, tn); if (!t) return; const pi = cpuList(t.id).findIndex((q) => q.name === pn); if (pi >= 0) cpuCard(t.id, pi, el, { noNav: true });
      });
      box.querySelectorAll('[data-watch]').forEach((b) => b.onclick = () => watchD1(+b.dataset.watch, el));
      const rs = box.querySelector('#crReset2');
      if (rs) rs.onclick = async () => {
        const ok = await coachAsk('監督、最初からやり直しますか？<br>育てた選手・順位は、すべて消えます。');
        if (ok) { el.hidden = true; save = C.newCareer(); store(); runners.length = 0; go('home'); }
      };
      box.querySelector('.std-back').onclick = () => {
        if (S.tab === 'stats' && S.sub && S.sub.kind === 'team') { S.tab = S.sub.backTab || 'stats'; S.sub = S.sub.back || null; draw(); return; }
        if (S.tab === 'stats' && S.sub && !S.direct) { S.sub = null; draw(); return; }
        if (S.onClose) { const f = S.onClose; el.hidden = true; assocState = null; f(); return; }
        el.hidden = true; assocState = null; go('home');
      };
      const cur = box.querySelector('.sc-row.now'); if (cur) cur.scrollIntoView({ block: 'center' });
    };
    draw(); el.hidden = false; el._fit();
    { const cur = box.querySelector('.sc-row.now'); if (cur) cur.scrollIntoView({ block: 'center' }); }
  }
  // ---- 試合日程・結果：1年（3月1週〜翌2月4週）の全部の週。試合・カップ・合宿・シーズン終盤の予定。何もない週は空欄 ----
  function schedHTML() {
    const lg = save.league, me = lg.teams.findIndex((t) => t.me), myName = save.team.name, byW = {};
    const add = (w, x) => { (byW[w] = byW[w] || []).push(x); };
    lg.rounds.forEach((pairs, r) => {
      const pr = pairs.find(([a, b]) => a === me || b === me); if (!pr) return;
      const res = lg.results[r] && lg.results[r].find((x) => x.a === pr[0] && x.b === pr[1]), home = pr[0] === me;
      add(lg.weeks[r], { badge: `<i class="sc-b">第${r + 1}節</i>`, opp: lg.teams[home ? pr[1] : pr[0]].name, ha: home ? 'H' : 'A', s: res ? (home ? res.s : [res.s[1], res.s[0]]) : null, played: !!res, match: true, note: r === lg.rounds.length - 1 ? '最終節' : '' });
    });
    const cup = save.cup;
    if (cup) {
      for (const g of cup.log) add(g.week, { badge: '<i class="sc-b cup">CUP</i>', opp: g.opp, s: g.s, played: true, match: true, note: (g.label || '') + (g.pk ? (g.win ? '・PK勝' : '・PK負') : '') });
      const inCup = C.cupIn(cup, myName), inPre = (cup.pre || []).some((x) => x.includes(myName));
      if (inCup) {
        const nf = C.nextFixture(save);
        C.CUP_WEEKS.forEach((w, k) => {
          if (k < cup.round || byW[w] && byW[w].some((x) => x.badge.includes('CUP'))) return;
          if (k === 0 && !inPre) return;   // 出場決定戦は地域2部の4チームだけ
          const lbl = C.CUP_LABELS[k] || `${k}回戦`;
          if (nf && nf.kind === 'cup' && nf.week === w) add(w, { badge: '<i class="sc-b cup">CUP</i>', opp: nf.opp.name, ha: nf.home ? 'H' : 'A', s: null, match: true, note: nf.label });
          else add(w, { badge: '<i class="sc-b cup">CUP</i>', label: `国内カップ ${lbl}（勝ち進んだら）`, plan: true });
        });
      }
    }
    // シーズン終盤：組み合わせが決まっていれば自分の試合、まだなら自分のリーグの予定（順位しだい）
    const PW = C.POST_WEEKS;
    if (save.post) { for (const m of save.post.matches) if (m.a === myName || m.b === myName) { const mine = m.a === myName; add(m.week, { badge: `<i class="sc-b post">${esc(m.label)}</i>`, opp: (mine ? m.b : m.a) || '', label: m.comp, ha: mine ? 'H' : 'A', s: m.done ? (mine ? m.s : [m.s[1], m.s[0]]) : null, played: !!m.done, match: true, note: m.comp }); } }
    else {
      const id = lg.id, P = (w, b, l) => add(w, { badge: `<i class="sc-b post">${b}</i>`, label: l, plan: true });
      if (/^reg.2$/.test(id)) { P(PW[0], '準決勝', '地域2部カップ（1・2位）'); P(PW[1], '決勝', '地域2部カップ'); }
      else if (/^reg.1$/.test(id)) { P(PW[0], '準決勝', 'D3昇格トーナメント（1・2位）'); P(PW[1], '決勝', 'D3昇格トーナメント（勝てばD3へ）'); }
      else if (id === 'd3') P(PW[0], '入れ替え戦', 'D3/D2入れ替え戦（2位）');
      else if (id === 'd2') { P(PW[0], '第1戦', 'D1昇格リーグ（1・2位）／入れ替え戦（13位）'); P(PW[1], '第2戦', 'D1昇格リーグ'); P(PW[2], '第3戦', 'D1昇格リーグ'); }
      else if (id === 'd1') { P(PW[0], '第1戦', 'D1昇格リーグ（11・12位は残留をかけて）'); P(PW[1], '第2戦', 'D1昇格リーグ'); P(PW[2], '第3戦', 'D1昇格リーグ'); }
    }
    for (const cp of C.CAMPS) for (let w = cp.from; w <= cp.to; w++) add(w, { badge: '<i class="sc-b camp">合宿</i>', label: `${cp.name}（${w - cp.from + 1}/${cp.to - cp.from + 1}週目）`, plan: true });
    add(C.SEASON_WEEKS, { badge: '<i class="sc-b end">終了</i>', label: 'シーズン終了（昇格・降格が決まる）', plan: true });
    const others = (w) => {
      let h = '';
      for (const id of LG_ORDER) { if (id === lg.id) continue; const o = save.lgs && save.lgs[id]; if (o && o.weeks.includes(w)) h += lgBadge(id); }
      if (C.CUP_WEEKS.includes(w)) h += '<i class="lgb b-cup">杯</i>';
      return h;
    };
    const nextW = Math.max(1, save.week);
    let lastM = 0, html = '';
    for (let w = 1; w <= C.SEASON_WEEKS; w++) {
      const k = cal(w), d = k.m !== lastM ? `${k.m}/${k.w}` : `／${k.w}`; lastM = k.m;
      const list = byW[w] || [{}];
      list.forEach((x, j) => {
        const res = x.s ? `<b class="${x.s[0] > x.s[1] ? 'w' : x.s[0] < x.s[1] ? 'l' : 'd'}">${x.s[0]}−${x.s[1]}</b>` : '';
        const what = x.opp ? `<img src="${emblemURL(x.opp, 32)}" alt="">${esc(x.opp)}${x.ha ? ` [${x.ha}]` : ''}${x.note ? `<small>${esc(x.note)}</small>` : ''}` : x.label ? `<span class="${x.plan ? 'sc-plan' : ''}">${esc(x.label)}</span>` : '';
        const tapT = x.opp && x.opp !== myName && C.findTeam(save, x.opp) ? ` data-team="${esc(x.opp)}"` : '';   // 版511：相手をタップでチーム情報
        html += `<div class="sc-row${tapT ? ' tap' : ''}${w === nextW && j === 0 ? ' now' : ''}${w < save.week ? ' past' : ''}"${tapT}><span class="sc-d">${j === 0 ? d : ''}</span>${x.badge || '<i class="sc-b none"></i>'}<span class="sc-o">${what}</span><span class="sc-x">${j === 0 ? others(w) : ''}</span><span class="sc-r">${res}</span></div>`;
      });
    }
    return `<div class="std-body"><div class="std-h"><span>年間の予定・結果</span><em>シーズン${save.season}　試合結果</em></div><div class="std-list">${html}</div></div>`;
  }
  // ---- 成績のメニュー ----
  function statMenuHTML(myLg) {
    const rows = LG_ORDER.map((id) => `<div class="sm-row${id === myLg ? ' mine' : ''}"><span class="sm-n">${lgBadge(id)}${LG_LABEL[id]}</span><button data-sub="table:${id}">順位表</button><button data-sub="goal:${id}">ゴール</button><button data-sub="assist:${id}">アシスト</button></div>`).join('');
    const cup = `<div class="sm-row"><span class="sm-n"><i class="lgb b-cup">杯</i>国内カップ</span><button data-sub="cup">組み合わせ</button><button data-sub="goal:cup">ゴール</button><button data-sub="assist:cup">アシスト</button></div>`;
    const post = save.post ? `<div class="sm-row"><span class="sm-n"><i class="lgb b-post">決</i>昇格・入れ替え戦</span><button data-sub="post">結果</button></div>` : '';
    return `<div class="std-body"><div class="sm-menu">${rows}${cup}${post}</div></div>`;
  }
  function statSubHTML(sub) {
    if (sub.kind === 'table') return tableHTML(sub.id, sub.before);
    if (sub.kind === 'goal' || sub.kind === 'assist') return rankHTML(sub.id, sub.kind);
    if (sub.kind === 'cup') return cupHTML();
    if (sub.kind === 'post') return postHTML();
    if (sub.kind === 'team') return teamHTML(sub.id, sub.view);
    return '';
  }
  const lgName = (id) => (id === 'cup' ? '国内カップ' : id === 'post' ? '昇格・入れ替え戦' : LG_LABEL[id] || '');
  function tableHTML(id, before) {
    const t = C.leagueTable(save, id); if (!t) return '';
    const n = t.rows.length; before = t.round <= 1 ? [] : before && before.length ? before : C.prevOrder(save, id);   // 第1節が終わっただけなら、矢印は全部→
    const arrow = (row, k) => { const b = before.indexOf(row.name); return b < 0 || b === k ? ARW.s : b > k ? ARW.u : ARW.d; };
    const rowH = Math.min(38, Math.floor((720 - 136 - 36 - 40) / n));
    const used = new Set();
    const body = t.rows.map((r, k) => { const z = zoneOf(id, k, n); if (z) used.add(z[0] + ':' + z[1]); const gd = r.stats.GF - r.stats.GA;
      return `<tr class="${z ? 'z-' + z[0] : ''}${r.me ? ' me' : ''}"${r.me ? '' : ` data-team="${esc(r.name)}"`}><td class="s-rk">${k + 1}</td><td class="s-aw">${arrow(r, k)}</td><td class="s-em"><img src="${emblemURL(r.name, 40)}" alt=""></td><td class="s-nm">${esc(r.name)}</td><td>${r.stats.Pts}</td><td>${r.stats.P}</td><td>${r.stats.W}</td><td>${r.stats.D}</td><td>${r.stats.L}</td><td>${r.stats.GF}</td><td>${r.stats.GA}</td><td>${gd > 0 ? '+' : ''}${gd}</td></tr>`; }).join('');   // 版559：失点も
    const legend = [...used].map((u) => { const [k, l] = u.split(':'); return `<span><i class="z-${k}"></i>${esc(l)}</span>`; }).join('');
    return `<div class="std-body"><table class="std-tbl" style="--rh:${rowH}px"><tr class="std-h"><th colspan="4"><span>${esc(LG_LABEL[id])} 順位表</span><small>第${t.round}節まで（全${t.rounds}節）</small></th><th>勝点</th><th>試合</th><th>勝</th><th>分</th><th>負</th><th>得点</th><th>失点</th><th>得失</th></tr>${body}</table><div class="std-legend">${legend}</div></div>`;
  }
  function rankHTML(id, kind) {
    const k = kind === 'goal' ? 'g' : 'a', list = C.goalRank(save, id).filter((x) => x[k] > 0).sort((x, y) => y[k] - x[k] || (y[kind === 'goal' ? 'a' : 'g'] - x[kind === 'goal' ? 'a' : 'g']));
    let rank = 0, prev = -1;
    const rows = list.slice(0, 60).map((x, i) => { const show = x[k] !== prev; if (show) { rank = i + 1; prev = x[k]; } return `<div class="rk-row${x.me ? ' me' : ''}" data-rkt="${esc(x.team)}" data-rkp="${esc(x.player)}"><span class="rk-n">${show ? rank : ''}</span><span class="rk-p">${esc(x.player)}</span><span class="rk-t"><img src="${emblemURL(x.team, 32)}" alt="">${esc(x.team)}</span><span class="rk-v">${x[k]}</span></div>`; }).join('');
    return `<div class="std-body"><div class="std-h"><span>${esc(lgName(id))} ${kind === 'goal' ? 'ゴール' : 'アシスト'}ランキング</span><em>${kind === 'goal' ? 'ゴール数' : 'アシスト数'}</em></div><div class="std-list">${rows || '<p class="std-soon">まだ記録がありません</p>'}</div></div>`;
  }
  // ---- 国内カップ：トーナメント表（64チームを16チームずつ4ブロック＋ベスト8からの決勝トーナメント、出場決定戦）----
  const LGT = { d1: ['D1', '#d8202a'], d2: ['D2', '#1f5fd0'], d3: ['D3', '#2f9e44'], regE1: ['東1', '#f2c200'], regW1: ['西1', '#8b46c8'], regE2: ['東2', '#f2c200'], regW2: ['西2', '#8b46c8'] };
  function cupHTML() {
    const cup = save.cup; if (!cup || !cup.bracket) return `<div class="std-body"><div class="std-h"><span>国内カップ</span></div><p class="std-soon">まだ始まっていません</p></div>`;
    const me = save.team.name, H = (r) => (cup.hist || []).find((h) => h.round === r);
    const myIdx = cup.bracket.indexOf(me);
    let view = assocState.cupView || (cup.round >= 4 ? 'final' : myIdx >= 0 ? 'ABCD'[Math.floor(myIdx / 16)] : (cup.pre || []).some((x) => x.includes(me)) && cup.round === 0 ? 'pre' : 'A');
    const esc2 = (x) => esc(String(x));
    const nameOf = (n) => (n === '#pre0' || n === '#pre1' ? '出場決定戦の勝者' : n);
    const lgOf = (n) => (n === me ? save.league.id : (C.findTeam(save, n) || {}).lg);
    // チーム名（エンブレム＋リーグの札＋名前）
    const label = (n, x, y, right) => {
      if (!n) return '';
      const nm = nameOf(n), real = nm === n, t = real ? LGT[lgOf(n)] : null, col = n === me ? '#c8102e' : '#111';
      const img = real ? `<image href="${emblemURL(n, 32)}" x="${right ? x - 26 : x}" y="${y - 13}" width="26" height="26"/>` : '';
      const bx = right ? x - 60 : x + 30, badge = t ? `<rect x="${bx}" y="${y - 9}" width="28" height="18" rx="3" fill="${t[1]}"/><text x="${bx + 14}" y="${y + 5}" font-size="12" font-weight="900" fill="#fff" text-anchor="middle">${t[0]}</text>` : '';
      const tx = right ? x - 66 : x + (t ? 64 : real ? 30 : 0);
      return `${img}${badge}<text x="${tx}" y="${y + 6}" font-size="17" font-weight="${n === me ? 900 : 700}" fill="${real ? col : '#888'}" text-anchor="${right ? 'end' : 'start'}">${esc2(nm)}</text>`;
    };
    const RED = '#e0261d', GRAY = '#9a9a9a';
    // ひとつの試合の線：2つの入口(y1,y2)を x0→x で受けて、勝った方を赤くし、xから先へ出す
    const match = (x0, x, y1, y2, g, dir) => {
      const ym = (y1 + y2) / 2, w = g && g.w, aWin = w && w === g.a, bWin = w && w === g.b, d = dir || 1;
      let o = `<path d="M${x0} ${y1}H${x}" stroke="${aWin ? RED : GRAY}" stroke-width="${aWin ? 4 : 2}" fill="none"/><path d="M${x0} ${y2}H${x}" stroke="${bWin ? RED : GRAY}" stroke-width="${bWin ? 4 : 2}" fill="none"/>`;
      o += `<path d="M${x} ${y1}V${ym}" stroke="${aWin ? RED : GRAY}" stroke-width="${aWin ? 4 : 2}"/><path d="M${x} ${ym}V${y2}" stroke="${bWin ? RED : GRAY}" stroke-width="${bWin ? 4 : 2}"/>`;
      if (g && g.s) o += `<text x="${x - 6 * d}" y="${ym + 5}" font-size="13" font-weight="800" fill="#333" text-anchor="${d > 0 ? 'end' : 'start'}">${g.s[0]}-${g.s[1]}${g.pk ? 'PK' : ''}</text>`;
      return { svg: o, ym, out: w ? RED : GRAY, outW: w ? 4 : 2 };
    };
    let svg = '', W = 1256, Hh = 540;
    if (view === 'pre') {
      const g = H(0); W = 640; Hh = 252;   // 版490：出場決定戦は2試合だけなので、表示を大きく（見る範囲をせまく）
      svg = (cup.pre || []).map(([a, b], k) => { const gg = g && g.games[k]; const y = 30 + k * 128; const m = match(330, 470, y, y + 52, gg); return label(a, 20, y) + label(b, 20, y + 52) + m.svg + `<path d="M470 ${m.ym}H560" stroke="${m.out}" stroke-width="${m.outW}"/>` + (gg ? label(gg.w, 570, m.ym) : `<text x="570" y="${m.ym + 6}" font-size="16" fill="#888">1回戦へ</text>`); }).join('');
    } else if (view === 'final') {
      const r3 = H(3), qf = H(4), sf = H(5), fn = H(6);
      const ent = [...Array(8)].map((_, k) => (r3 ? r3.games[k].w : null));
      const ph = (k) => `ブロック${'ABCD'[Math.floor(k / 2)]}の勝者`;
      const ys = [70, 190, 310, 430];
      // 左：0〜3、右：4〜7
      for (const side of [0, 1]) {
        const R = side === 1, xN = R ? 1236 : 20, x0 = R ? 930 : 326, x1 = R ? 840 : 416, x2 = R ? 750 : 506;
        for (let k = 0; k < 4; k++) { const i = side * 4 + k, n = ent[i]; svg += n ? label(n, R ? xN : xN, ys[k], R) : `<text x="${R ? xN : xN}" y="${ys[k] + 6}" font-size="16" fill="#888" text-anchor="${R ? 'end' : 'start'}">${ph(i)}</text>`; svg += `<path d="M${R ? 1236 - 300 : 320} ${ys[k]}H${x0}" stroke="${GRAY}" stroke-width="2"/>`; }
        const m1 = match(x0, x1, ys[0], ys[1], qf && qf.games[side * 2], R ? -1 : 1), m2 = match(x0, x1, ys[2], ys[3], qf && qf.games[side * 2 + 1], R ? -1 : 1);
        const m3 = match(x1, x2, m1.ym, m2.ym, sf && sf.games[side], R ? -1 : 1);
        svg += m1.svg + m2.svg + m3.svg + `<path d="M${x2} ${m3.ym}H628" stroke="${m3.out}" stroke-width="${m3.outW}"/>`;
      }
      const champ = fn && fn.games[0].w;
      svg += `<circle cx="628" cy="250" r="44" fill="#ffd23a" stroke="#b08a12" stroke-width="4"/><text x="628" y="262" font-size="36" text-anchor="middle">🏆</text>`;
      svg += `<text x="628" y="${champ ? 330 : 330}" font-size="20" font-weight="900" text-anchor="middle" fill="#c8102e">${champ ? '優勝　' + esc2(champ) : '決勝　12月3週'}</text>`;
      if (fn && fn.games[0].s) svg += `<text x="628" y="356" font-size="16" font-weight="800" text-anchor="middle" fill="#333">${esc2(fn.games[0].a)} ${fn.games[0].s[0]}-${fn.games[0].s[1]} ${esc2(fn.games[0].b)}</text>`;
    } else {
      const b = 'ABCD'.indexOf(view), base = b * 16, rowY = (i) => 30 + i * 31.5;
      let ys = [...Array(16)].map((_, i) => rowY(i));
      for (let i = 0; i < 16; i++) svg += label(cup.bracket[base + i], 14, ys[i]);
      let names = cup.bracket.slice(base, base + 16), x0 = 360;
      const xs = [400, 520, 640];
      for (let r = 1; r <= 3; r++) {
        const h = H(r), n = names.length / 2, off = base / 2 ** r, nys = [], nnames = [];
        for (let m = 0; m < n; m++) {
          const g = h && h.games[off + m]; const mm = match(r === 1 ? 330 : x0, xs[r - 1], ys[2 * m], ys[2 * m + 1], g);
          svg += mm.svg; nys.push(mm.ym); nnames.push(g ? g.w : null);
          if (r === 3) svg += `<path d="M${xs[2]} ${mm.ym}H${xs[2] + 70}" stroke="${mm.out}" stroke-width="${mm.outW}"/>` + (g ? label(g.w, xs[2] + 80, mm.ym) : `<text x="${xs[2] + 80}" y="${mm.ym + 6}" font-size="16" fill="#888">準々決勝へ</text>`);
        }
        ys = nys; names = nnames; x0 = xs[r - 1];
      }
      // 自分の名前の行のしるし
      const mi = cup.bracket.slice(base, base + 16).indexOf(me); if (mi >= 0) svg = `<rect x="6" y="${rowY(mi) - 14}" width="318" height="28" rx="4" fill="#fff3c4"/>` + svg;
      Hh = 540;
    }
    const tabs = [['pre', '出場決定戦'], ['A', 'ブロックA'], ['B', 'ブロックB'], ['C', 'ブロックC'], ['D', 'ブロックD'], ['final', '準々決勝から']].map(([k, l]) => `<button data-cupv="${k}" class="${view === k ? 'on' : ''}">${l}${k !== 'final' && k !== 'pre' && myIdx >= 0 && 'ABCD'[Math.floor(myIdx / 16)] === k ? '<small>★</small>' : ''}</button>`).join('');
    const now = cup.champion ? `優勝：${esc(cup.champion)}` : `次は ${esc(C.CUP_LABELS[cup.round] || '')}`;
    return `<div class="std-body"><div class="std-h"><span>国内カップ トーナメント表</span><em>${now}</em></div><div class="cg-tabs">${tabs}</div><div class="cup-svg"><svg viewBox="0 0 ${W} ${Hh}" font-family="Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif">${svg}</svg></div></div>`;
  }
  function postHTML() {
    const post = save.post; if (!post) return '';
    const me = save.team.name, comps = [...new Set(post.matches.map((m) => m.comp))];
    const tm = (n) => (n ? `<span class="cg-t${n === me ? ' me' : ''}"><img src="${emblemURL(n, 32)}" alt="">${esc(n)}</span>` : '<span class="cg-t">未定</span>');
    const blocks = comps.map((c) => `<div class="pm-h">${esc(c)}</div>${post.matches.filter((m) => m.comp === c).map((m) => { const k = cal(m.week); return `<div class="cg${m.a === me || m.b === me ? ' mine' : ''}"><small class="pm-w">${k.m}/${k.w} ${esc(m.label)}</small>${tm(m.a)}<b class="cg-s">${m.done ? `${m.s[0]}−${m.s[1]}` : 'vs'}</b>${tm(m.b)}</div>`; }).join('')}`).join('');
    return `<div class="std-body"><div class="std-h"><span>昇格・入れ替え戦</span></div><div class="std-list pm">${blocks}</div></div>`;
  }
  // ---- スター選手の専用の顔（シャツをチームの色に塗り替える。GKは黄色）----
  const starImgs = {}, starURLs = new Map();
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  function starKey(tid, q) { const F = window.STAR_FACES; if (F && q && q.face && !q.face.startsWith('mob_') && q.face in F) return q.face; if (F && q && q.face) return null; return F && q && !q.gen && (tid + '_' + q.no) in F ? tid + '_' + q.no : null; }   /* 移籍してきた選手は、元の顔のまま（版455） */
  // 版513：自分のチームに来た選手の顔は、ほかの選手と同じ大きさに見えるよう縮めて下にそろえる
  const STAR_FIT = 0.8;
  function starFace(key, shirt, gk, fit) {
    const ck = key + '|' + shirt + '|' + (gk ? 1 : 0) + '|' + (fit || 1); if (starURLs.has(ck)) return starURLs.get(ck);
    let L = starImgs[key];
    if (!L) { L = starImgs[key] = { img: new Image(), n: 0 }; L.img.onload = L.img.onerror = () => { L.n = 1; starFill(); try { faceFill(); } catch (_) {} }; L.img.src = `faces/star/${key}.png`; }
    if (!L.n) return null;
    let url = `faces/star/${key}.png`;
    try {
      const W = L.img.naturalWidth, H = L.img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.drawImage(L.img, 0, 0); const d = x.getImageData(0, 0, W, H), px = d.data;
      // シャツ：画像の下半分の「青」で、いちばん下の行とつながっている所（髪の青メッシュは塗らない）
      const blue = (i) => px[i + 3] > 100 && px[i + 2] > px[i] + 45 && px[i + 2] > px[i + 1] + 25 && px[i + 2] > 70;
      const y0 = Math.floor(H * 0.5), mask = new Uint8Array(W * H), st = [];
      for (let xx = 0; xx < W; xx++) for (let yy = H - 3; yy < H; yy++) { const k = yy * W + xx; if (blue(k * 4)) { mask[k] = 1; st.push(k); } }
      while (st.length) { const k = st.pop(), xx = k % W, yy = (k - xx) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = xx + dx, ny = yy + dy; if (nx < 0 || nx >= W || ny < y0 || ny >= H) continue; const n = ny * W + nx; if (!mask[n] && blue(n * 4)) { mask[n] = 1; st.push(n); } } }
      // 線の内側のすき間（しわの線など）も塗る：上下左右が青の画素
      for (let yy = y0 + 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) { const k = yy * W + xx; if (!mask[k] && px[k * 4 + 3] > 0 && mask[k - 1] && mask[k + 1] && mask[k - W] && mask[k + W]) mask[k] = 2; }
      const t = gk ? [242, 200, 30] : hexRgb(shirt || '#2f6fd6'), base = window.STAR_FACES[key] || 80;
      for (let k = 0; k < W * H; k++) if (mask[k]) { const i = k * 4, l = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / base; px[i] = Math.min(255, t[0] * l); px[i + 1] = Math.min(255, t[1] * l); px[i + 2] = Math.min(255, t[2] * l); }
      x.putImageData(d, 0, 0);
      if (fit && fit < 1) { const c2 = document.createElement('canvas'), H2 = Math.round(W * 308 / 320); c2.width = W; c2.height = H2; c2.getContext('2d').drawImage(c, (W - W * fit) / 2, H2 - H * fit, W * fit, H * fit); url = c2.toDataURL(); /* ほかの選手の顔（320×308）と同じ形・同じ頭の大きさに */ } else url = c.toDataURL();
    } catch (e) { /* 読み込めない環境では、元の青いシャツのまま */ }
    starURLs.set(ck, url); return url;
  }
  function starFill() { document.querySelectorAll('img[data-star]').forEach((im) => { const [k, sh, g] = im.dataset.star.split('|'); const u = starFace(k, sh, g === '1'); if (u) { im.src = u; im.removeAttribute('data-star'); } }); }
  function starPic(key, shirt, gk, cls) { const u = starFace(key, shirt, gk); return u ? `<img class="${cls}" src="${u}" alt="">` : `<img class="${cls}" data-star="${key}|${shirt}|${gk ? 1 : 0}" src="${BLANK}" alt="">`; }
  // ---- CPUチームの選手カード（チームのページで選手をタップ）：顔・能力・スキルを全部見せる。◀▶で同じチームの前後の選手 ----
  const cpuFaceP = new Map();
  function cpuList(tid) {
    const ro = C.rosterOfTeam(tid, save.season); if (!ro) return [];
    const KS = D.PARAM_KEYS, ovr = (q) => KS.reduce((a, k) => a + q[k], 0) / KS.length, order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    return ro.players.slice().sort((a, b) => (b.starter - a.starter) || order[a.pos] - order[b.pos] || ovr(b) - ovr(a));
  }
  function cpuFace(tid, q, shirt) {
    const sk = starKey(tid, q);
    if (sk) return starPic(sk, shirt, q.pos === 'GK', 'fc sf');
    const mk = mobKey(tid, q);
    if (mk) return starPic(mk, shirt, q.pos === 'GK', 'fc sf');
    const id = tid + '_' + q.no;
    if (!cpuFaceP.has(id)) cpuFaceP.set(id, { name: q.name, number: q.no, hair: q.looks[0], hairColor: q.looks[1], skin: q.looks[2], position: q.pos });
    return facePic(cpuFaceP.get(id), '');
  }
  // そのほかの選手の顔：54人分のモブの顔から、チームの中でかぶらないように選ぶ（チームと背番号で決まるので、いつも同じ顔）
  const mobMaps = {};
  function mobKey(tid, q) {
    const F = window.STAR_FACES; if (!F || !('mob_1' in F)) return null;
    { const rp = q.face ? q : C.rosterOfTeam(tid, 1).players.find((p) => p.no === q.no); if (rp && rp.face) return rp.face.startsWith('mob_') ? rp.face : null; }   /* 移籍してきた選手は、元の顔のまま（版455） */
    if (!mobMaps[tid]) {
      const ro = C.rosterOfTeam(tid, 1), used = new Set(), map = {}, N = Object.keys(F).filter((k) => k.startsWith('mob_')).length;
      for (const p of ro.players.slice().sort((a, b) => a.no - b.no)) {
        if (starKey(tid, p) || p.face) continue;
        let h = 7; for (const ch of tid + '|' + p.no + '|' + p.name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
        let i = h % N; for (let k = 0; k < N && used.has(i); k++) i = (i + 1) % N;
        used.add(i); map[p.no] = 'mob_' + (i + 1);
      }
      mobMaps[tid] = map;
    }
    return mobMaps[tid][q.no] || null;
  }
  // CPUの選手の利き足（データには無いので、チームと背番号から決める。右6割・左4割。いつも同じ）
  const cpuFoot = (tid, q) => { let h = 7; for (const ch of tid + '|' + q.no + '|' + q.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 10 < 6 ? 'R' : 'L'; };
  let ccPage = 0;
  // 見た目は自分の選手のカード（playerCardHTML）と同じ。ページは「選手情報」「習得スキル」の2つ
  function cpuCardHTML(tid, pi) {
    const list = cpuList(tid), q = list[pi], ro = C.rosterOfTeam(tid, save.season), tm = C.TEAM_BY_ID[tid] || {}, t = C.findTeam(save, tm.name) || {};
    const tt = C.titleOf(save, tid, q.name), G = (v) => D.grade(v), foot = cpuFoot(tid, q);
    const grades = D.PARAMS.map((pp) => `<div><b class="rk rk-${G(q[pp.k])}">${G(q[pp.k])}</b></div>`).join('');
    const icons = D.PARAMS.map((pp) => ico(pp.k)).join('');
    const role = tt ? `国内屈指の${tt}` : q.role === 'ace' ? 'エース' : q.role === 'core' ? '中心選手' : '';
    const pages = ['選手情報', '習得スキル'];
    let body;
    if (ccPage === 0) {
      body = `<div class="pc-st"><span class="pc-chip">利き足${footSVG(foot)}<small>${foot === 'L' ? '左' : '右'}</small></span><span class="pc-chip">${q.starter ? 'スタメン' : '控え'}</span></div>
        <div class="pc-car"><span>所属</span><b>${esc(tm.name || '')}</b><span>リーグ</span><b>${esc((C.LG[t.lg] || {}).name || '')}</b></div>`;
    } else {
      const sk = C.noSkillLg(t.lg) ? [] : q.skills || [];   // 版559：地域リーグのCPUはスキルなし
      const cells = sk.length ? sk.map((k) => `<button class="has pc-skb" data-sk="${k}">${esc((D.SKILLS[k] || {}).name || k)}<i>説明</i></button>`) : ['<span>なし</span>'];
      const uk = q.top && D.UNIQ_BY_TOP ? D.UNIQ_BY_TOP[q.top] : null, u = uk && D.UNIQ[uk];   // 国内屈指：その選手だけの固有スキル
      // 固有スキル：名前だけ出しておき、タップすると発動の条件と効果が開く
      const uq = u ? `<details class="pc-uq"><summary><span class="pc-uqh">固有スキル</span><b>${esc(u.name)}</b><i class="pc-uqi">説明</i></summary><div class="pc-uqd"><p><span>発動</span>${esc(u.sw || u.when)}</p><p><span>効果</span>${esc(u.se || u.what)}</p>${u.st ? `<p><span>凸</span>${esc(u.st)}</p>` : ''}</div></details>` : '';
      body = `${uq}<div class="pc-sk"><div class="pc-skh">習得スキル　${sk.length}</div><div class="pc-skg">${cells.join('')}</div><div class="pc-skd" hidden></div></div>`;
    }
    return `<div class="pc-card"><img class="pc-emb" src="${emblemURL(tm.name, 80)}" alt="">
      <div class="pc-head"><i class="pos ${POSC[q.pos]}">${q.pos}</i><b>${esc(q.name)}</b><span>${esc(tm.name || '')}</span></div>
      <div class="pc-main">
        <div class="pc-left">
          <div class="pc-photo">${cpuFace(tid, q, ro.kit.shirt)}<div class="pc-rare">${starHTML(C.starOf(tid, q), C.totsuOf(tid, q))}${capBadge(C.GRADES[C.capIdx(C.starOf(tid, q), C.totsuOf(tid, q))])}</div></div>
          <b class="pc-num">${q.no}</b>
          <div class="pc-meta"><span>タイプ</span>${typeBadge(q.type)}</div>
          ${role ? `<div class="pc-ttl${tt ? ' top' : q.role === 'ace' ? ' ace' : ''}"><i>${tt ? '♛' : q.role === 'ace' ? '★' : '◆'}</i><span>称号</span><b>${esc(role)}</b></div>` : ''}   <!-- 版470：役割ではなく「称号」 -->
        </div>
        <div class="pc-right">
          <div class="pc-icons">${icons}</div>
          <div class="pc-grades">${grades}</div>
          <div class="pc-page">${body}</div>
          <div class="pc-dots"><button class="pc-nav prev ui-img" title="前の選手"><img src="icons/ui_next.png" alt="前へ" style="transform:scaleX(-1)"></button>${pages.map((nm, k) => `<button data-pg="${k}" class="${k === ccPage ? 'on' : ''}">${nm}</button>`).join('')}<button class="pc-nav next ui-img" title="次の選手"><img src="icons/ui_next.png" alt="次へ"></button></div>
        </div>
      </div>
      <button class="sb-round pc-close" title="もどる"><i class="bk-ico" aria-hidden="true"></i></button>
    </div>`;
  }
  function cpuCard(tid, pi, host, o = {}) {
    let el = document.getElementById('ccModal');
    if (!el) { el = document.createElement('div'); el.id = 'ccModal'; el.className = 'modal pc-wrap'; }
    if (el.parentNode !== host) host.appendChild(el);
    const n = cpuList(tid).length, go = (k) => cpuCard(tid, (k + n) % n, host), redraw = () => cpuCard(tid, pi, host, o);
    el.innerHTML = cpuCardHTML(tid, pi); el.hidden = false;
    bindSkillDesc(el);
    el.querySelectorAll('[data-pg]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); ccPage = +b.dataset.pg; redraw(); });
    el.querySelector('.pc-nav.prev').onclick = (e) => { e.stopPropagation(); go(pi - 1); };
    el.querySelector('.pc-nav.next').onclick = (e) => { e.stopPropagation(); go(pi + 1); };
    el.querySelector('.pc-close').onclick = () => { el.hidden = true; };
    el.onclick = (e) => { if (e.target === el) el.hidden = true; };
    if (o.noNav) el.querySelectorAll('.pc-nav').forEach((b) => b.remove());   /* 版470 */
  }
  // ---- チームの情報：監督・方針・フォーメーションと、固定の25人 ----
  function teamHTML(name, view) {
    view = view || 'info';
    const tabs = `<div class="cg-tabs tm-tabs">${[['info', 'チーム'], ['list', '選手データ'], ['xi', 'スタメン']].map(([k, l]) => `<button data-tmv="${k}" class="${view === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    if (view !== 'list') { const h = teamViewHTML(name, view); if (h) return h.replace('<!--tabs-->', tabs); }
    const t = C.findTeam(save, name), ro = t && C.rosterOfTeam(t.id, save.season);
    if (!ro) return `<div class="std-body"><div class="std-h"><span>${esc(name)}</span></div><p class="std-soon">選手の情報がありません</p></div>`;
    const KS = D.PARAM_KEYS, ovr = (q) => Math.round(KS.reduce((a, k) => a + q[k], 0) / KS.length), G = (v) => D.grade(v);
    const order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    const ps = cpuList(t.id);   // 選手カードと同じ並び（番号で選手を取り違えないように）
    const sk = (q) => C.noSkillLg(t.lg) ? '' : q.skills.slice(0, 3).map((k) => ((D.SKILLS[k] || {}).name || k)).join('・') + (q.skills.length > 3 ? ` ほか${q.skills.length - 3}` : '');
    const rows = ps.map((q, pi) => `<div class="tm-row${q.starter ? ' st' : ''}" data-pi="${pi}" data-tid="${t.id}"><span class="tm-no">${q.no}</span><i class="pos ${POSC[q.pos]}">${q.pos}</i><span class="tm-nm">${esc(q.name)}${starHTML(C.starOf(t.id, q), C.totsuOf(t.id, q), 'sm')}${C.titleOf(save, t.id, q.name) ? `<b class="tm-top" title="国内屈指の${esc(C.titleOf(save, t.id, q.name))}">国内屈指</b>` : ''}${C.titleOf(save, t.id, q.name) ? '' : q.role === 'ace' ? '<b class="tm-ace">エース</b>' : q.role === 'core' && !q.top ? '<b class="tm-core">中心</b>' : ''}</span><span class="tm-ty">${typeBadge(q.type, 'sm')}</span>${KS.map((k) => `<span class="tm-g"><b class="rk rk-${G(q[k])}">${G(q[k])}</b></span>`).join('')}<span class="tm-sk" title="${esc(q.skills.map((k) => (D.SKILLS[k] || {}).name || k).join('・'))}">${esc(sk(q))}</span></div>`).join('');
    const lg = (C.LG[t.lg] || {}).name || '';
    const rank = (q) => (C.titleOf(save, t.id, q.name) ? 0 : q.role === 'ace' ? 1 : 2);
    const stars = ro.players.filter((q) => starKey(t.id, q)).sort((a, b) => rank(a) - rank(b));
    const strip = stars.length ? `<div class="tm-stars">${stars.map((q) => { const tt = C.titleOf(save, t.id, q.name); return `<div class="tm-star r${rank(q)}" data-spi="${ps.indexOf(q)}" data-tid="${t.id}">${starPic(starKey(t.id, q), ro.kit.shirt, q.pos === 'GK', 'tm-sf')}<b>${esc(q.name)}</b><small>${tt ? '国内屈指' : q.role === 'ace' ? 'エース' : '中心選手'}・${q.pos}</small></div>`; }).join('')}</div>` : '';
    return `<div class="std-body"><div class="std-h"><span><img class="tv-emb" src="${emblemURL(name, 40)}" alt="">${esc(name)}</span>${tabs}<em>${lgBadge(t.lg)} ${esc(lg)}</em></div><div class="tm-head"><img src="${emblemURL(name, 96)}" alt=""><div><b>${esc(name)}</b><p>監督：${esc(ro.coach.name)}　方針：<em>${esc(ro.coach.policy)}</em>　フォーメーション：${esc(ro.formation)}</p><small>${esc(ro.coach.desc)}</small></div>${strip}</div><div class="tm-cols"><span>No.</span><span>Pos.</span><span>選手</span><span>タイプ</span>${D.PARAMS.map((pp) => `<span class="tm-pk">${esc(pp.name.slice(0, 2))}</span>`).join('')}<span>スキル</span></div><div class="std-list">${rows}</div></div>`;
  }

  // 版511：相手チームの情報（カルチョビットAの、試合日程から相手を選んだ画面）：チーム（スタイル・対戦）／選手データ／スタメン
  const STYLE_SL = { balance: [0.5, 0.5, 0.5], possession: [0.65, 0.2, 0.45], counter: [0.3, 0.85, 0.3], highpress: [0.8, 0.5, 0.95], wing: [0.7, 0.6, 0.55] };
  function teamViewHTML(name, view) {
    const t = C.findTeam(save, name), ro = t && C.rosterOfTeam(t.id, save.season); if (!ro) return null;
    const lgN = (C.LG[t.lg] || {}).name || '', shirt = (ro.kit || {}).shirt || '#e2453a';
    const head = `<div class="std-h"><span><img class="tv-emb" src="${emblemURL(name, 40)}" alt="">${esc(name)}</span><!--tabs--><em>${lgBadge(t.lg)} ${esc(lgN)}</em></div>`;
    if (view === 'xi') {
      let st = ro.players.filter((q) => q.starter); const bench = ro.players.filter((q) => !q.starter).slice(0, 7);
      // 版520：並びは、試合で実際に立つ場所（入れ替え・真ん中の指定をした後）と同じにする
      try { const ct = C.cpuTeam(t.id), byName = new Map(st.map((q) => [q.name, q])), ord = ct.players.slice(0, 11).map((p) => byName.get(p.name)).filter(Boolean); if (ord.length === st.length) st = ord; } catch (_) {}
      const line = (pos) => st.filter((q) => q.pos === pos);
      const form = String(ro.formation || '4-4-2').split('-').map(Number), W = 760, H = 470;
      const rows = [['GK', line('GK')], ...[['DF', line('DF')], ['MF', line('MF')], ['FW', line('FW')]]];
      // MFが2列のフォーメーション（4-2-3-1など）は、MFを前と後ろに分ける
      const mfRows = form.length > 3 ? form.slice(1, -1) : [line('MF').length];
      const out = []; let mfs = line('MF').slice(), y = H - 50;
      const put = (arr, yy) => arr.forEach((q, k) => out.push({ q, x: 60 + (W - 120) * (k + 1) / (arr.length + 1), y: yy }));
      put(line('GK'), H - 40); put(line('DF'), H - 150);
      const nRow = mfRows.length; mfRows.forEach((n, k) => { const arr = mfs.splice(0, n); put(arr, H - 150 - (k + 1) * (230 / (nRow + 1)) - 10); });
      if (mfs.length) put(mfs, 200); put(line('FW'), 70);
      const chip = (q, x, y, cls) => `<div class="tx-p ${cls || ''}" style="left:${x}px;top:${y}px" data-pi="${cpuList(t.id).indexOf(q)}" data-tid="${t.id}">${(C.faceKeyOf(t.id, q) ? starPic(C.faceKeyOf(t.id, q), shirt, q.pos === 'GK', 'tx-f') : '<i class="tx-f"></i>')}<b class="${POSC[q.pos]}">${esc(q.name)}</b></div>`;
      return `<div class="std-body">${head}<div class="tx"><div class="tx-in"><div class="tx-pitch">${['FW', 'MF', 'DF'].map((z, k) => `<i class="tx-z z${k}">${z}</i>`).join('')}<i class="tx-box"></i>${out.map((o) => chip(o.q, o.x, o.y)).join('')}</div><div class="tx-bench"><b>控え</b>${bench.map((q, k) => chip(q, 60, 66 + k * 60, 'bn')).join('')}</div><p class="tx-note">${esc(ro.formation)}<small>いつもの先発。試合の日は疲れやケガで変わることもあります</small></p></div></div></div>`;
    }
    // チーム（スタイル・対戦）
    const sl = STYLE_SL[ro.style] || STYLE_SL.balance, tblRank = (() => { try { const stn = C.standings(save); const k = stn.findIndex((x) => x.name === name); return k >= 0 ? `${k + 1}位` : ''; } catch (_) { return ''; } })();
    const slider = (l, r, v) => `<div class="tv-sl"><span>${l}</span><i><b style="left:${Math.round(v * 100)}%"></b></i><span>${r}</span></div>`;
    const lg = save.league, me = lg.teams.findIndex((x) => x.me), them = lg.teams.findIndex((x) => x.name === name), games = [];
    if (them >= 0) lg.rounds.forEach((pairs, r) => { const pr = pairs.find(([a, b]) => (a === me && b === them) || (a === them && b === me)); if (!pr) return; const res = lg.results[r] && lg.results[r].find((x) => x.a === pr[0] && x.b === pr[1]), home = pr[0] === me; games.push(`<div class="tv-g"><i class="tv-ha ${home ? 'h' : 'a'}">${home ? 'H' : 'A'}</i><span>第${r + 1}節</span>${res ? (() => { const sc = home ? res.s : [res.s[1], res.s[0]]; return `<b class="${sc[0] > sc[1] ? 'w' : sc[0] < sc[1] ? 'l' : 'd'}">${sc[0]}−${sc[1]}</b>`; })() : '<em>これから</em>'}</div>`); });
    const ace = ro.players.filter((q) => q.top || q.role === 'ace').slice(0, 3);
    return `<div class="std-body">${head}<div class="tv"><div class="tv-in">
      <div class="tv-l"><div class="tv-hd"><img src="${emblemURL(name, 96)}" alt=""><div><b>${esc(name)}</b><small>（${esc(stadiumName({ name, short: t.short }, {}))}）</small><p>${lgBadge(t.lg)} ${esc(lgN)}　<em>${esc(tblRank)}</em></p></div></div>
        <div class="tv-co"><b>監督　${esc(ro.coach.name)}</b><span>方針：${esc(ro.coach.policy)}　／　${esc(ro.formation)}</span><small>${esc(ro.coach.desc)}</small></div>
        <div class="tv-st"><div class="tv-sh">スタイル</div>${slider('守備的', '攻撃的', sl[0])}<div class="tv-sh">攻め方</div>${slider('パスでつなぐ', 'すばやく縦へ', sl[1])}<div class="tv-sh">守り方</div>${slider('引いて守る', '前から奪う', sl[2])}</div></div>
      <div class="tv-r"><div class="tv-rh">対戦</div>${games.join('') || '<p class="std-soon">今シーズンのリーグ戦では当たりません</p>'}
        ${ace.length ? `<div class="tv-rh">注目の選手</div>${ace.map((q) => `<div class="tv-ace" data-pi="${cpuList(t.id).indexOf(q)}" data-tid="${t.id}">${(C.faceKeyOf(t.id, q) ? starPic(C.faceKeyOf(t.id, q), shirt, q.pos === 'GK', 'tv-af') : '')}<div><b>${esc(q.name)}</b><small>${esc(q.pos)}・${esc(q.type)}</small>${starHTML(C.starOf(t.id, q), C.totsuOf(t.id, q), 'sm')}</div></div>`).join('')}` : ''}</div>
    </div></div></div>`;
  }
  function mgrHTML() {
    const lg = save.league, st = C.standings(save), pos = st.findIndex((t) => t.me) + 1, me = st.find((t) => t.me);
    const hist = save.history.length ? save.history.map((h) => `<div class="mg-row"><span>シーズン${h.season}</span><span>${esc(h.league)}</span><span>${esc(h.msg)}</span><span>${esc(h.cup || '')}</span></div>`).join('') : '<p class="std-soon">まだありません</p>';
    return `<div class="std-body"><div class="std-h"><span>監督成績</span></div><div class="mgr">${save.manager ? `<div class="mg-name">監督　<b>${esc(save.manager)}</b></div>` : ''}<div class="mg-now"><b>シーズン${save.season}</b>　${esc(lg.name)}　<b>${pos}位</b>（${me.stats.W}勝 ${me.stats.D}分 ${me.stats.L}敗）</div><div class="mg-h">これまでのシーズン</div>${hist}<p class="std-soon">監督成績は、これから作り込みます。</p></div></div>`;
  }
  let assocBefore = null;   // 試合の前の順位（順位表の矢印）

  // ================= クラブ設定：名前・ユニフォーム・エンブレム =================
  const PALETTE = ['#d8202a', '#e2453a', '#f28a1a', '#f2c41a', '#ffd23a', '#7fbf3a', '#2f9e44', '#0e5e6e', '#1a8fd0', '#7fd0ff', '#2f6fd6', '#1f3a8a', '#14205a', '#6a1fb0', '#5a2a8a', '#d84a7a', '#f2a3b0', '#8a5a2a', '#e0c27a', '#ffffff', '#c0c8d0', '#6e7480', '#2a2a2a', '#b8642a'];
  const KIT_PATS = [['solid', '無地'], ['vstripe', '縦じま'], ['hstripe', '横じま'], ['band', '胸ライン'], ['sash', 'たすき'], ['half', 'ハーフ']];
  const EMB_SHAPES = [[0, '盾'], [1, '丸'], [2, '紋章'], [3, 'ひし形'], [4, '六角形'], [5, 'ペナント']];
  const EMB_PATS = [[1, '2色'], [0, '縦じま'], [2, 'ななめ帯'], [3, '横帯'], [5, '十字'], [4, '無地']];
  const EMB_ICONS = [['ball', 'ボール'], ['star', '星'], ['crown', '王冠'], ['bolt', 'いなずま'], ['wing', 'つばさ'], ['wave', '波'], ['sun', '太陽'], ['mountain', '山'], ['flame', 'ほのお'], ['leaf', '葉'], ['castle', 'お城'], ['heart', 'ハート'], ['none', 'なし']];
  let clubTab = 'name';
  function openClub(opt) {
    opt = opt || {};
    const el = fullScreen('clubScreen', 'std-wrap club-wrap'), box = el.querySelector('.lk-box');
    const club = C.ensureClub(save);
    const st = { name: save.team.name, short: save.team.short || '', kit: null, kits: { home: { ...club.kit }, away: { ...club.kit2 } }, kside: 'home', emb: { ...club.emb }, err: '' }; st.kit = st.kits.home;
    clubTab = opt.first ? 'name' : clubTab;
    const embOf = () => ({ ...st.emb, ch: st.emb.ch || (st.short || st.name || 'H')[0] });
    const embCanvas = (lk, size) => { const cv = document.createElement('canvas'); cv.width = size; cv.height = size; drawEmblem(cv.getContext('2d'), size / 2, size / 2, size * 0.92, lk); return cv.toDataURL(); };
    const sw = (key, cur) => `<div class="cl-sw">${PALETTE.map((c) => `<button data-col="${key}" data-v="${c}" class="${cur.toLowerCase() === c ? 'on' : ''}" style="background:${c}" title="${c}"></button>`).join('')}<label class="cl-pick" title="好きな色"><input type="color" data-colin="${key}" value="${cur}"><span>他の色</span></label></div>`;
    const draw = () => {
      const lk = embOf(), ps = save.team.players;
      const preview = `<div class="cl-prev"><img class="cl-emb" src="${embCanvas(lk, 240)}" alt=""><div class="cl-name"><b>${esc(st.name || 'クラブ名')}</b><small>略称：${esc(st.short || '―')}</small></div><div class="cl-kits" id="clKits"></div></div>`;
      let body = '';
      if (clubTab === 'name') body = `<div class="cl-form"><label>クラブ名<input id="clName" maxlength="12" value="${esc(st.name)}" placeholder="例：宿毛サンライズFC"></label><p class="cl-note">12文字まで。ほかのチームと同じ名前は使えません。</p><label>略称（試合の点数の横に出る名前）<input id="clShort" maxlength="6" value="${esc(st.short)}" placeholder="例：宿毛"></label><p class="cl-note">6文字まで。空にすると、クラブ名から自動で作ります。</p>${st.err ? `<p class="cl-err">${esc(st.err)}</p>` : ''}</div>`;   /* 版474：やり直し（初期化）はクラブ事務所の「退任」だけ */
      else if (clubTab === 'kit') body = `<div class="cl-form"><div class="cl-kside">${[['home', 'ホーム'], ['away', 'アウェー']].map(([k, l]) => `<button data-kside="${k}" class="${st.kside === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="cl-h">柄</div><div class="cl-opts">${KIT_PATS.map(([k, l]) => `<button data-kpat="${k}" class="${st.kit.pat === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="cl-h">シャツの色</div>${sw('shirt', st.kit.shirt)}<div class="cl-h">シャツの柄の色${st.kit.pat === 'solid' ? '<small>（無地のときは使いません）</small>' : ''}</div>${sw('sub', st.kit.sub)}<div class="cl-h">パンツの色</div>${sw('shorts', st.kit.shorts)}<div class="cl-h">ソックスの色</div>${sw('socks', st.kit.socks)}</div>`;
      else body = `<div class="cl-form"><div class="cl-h">形</div><div class="cl-opts img">${EMB_SHAPES.map(([k, l]) => `<button data-eshape="${k}" class="${st.emb.shape === k ? 'on' : ''}"><img src="${embCanvas({ ...lk, shape: k }, 56)}" alt="">${l}</button>`).join('')}</div>
        <div class="cl-h">模様</div><div class="cl-opts img">${EMB_PATS.map(([k, l]) => `<button data-epat="${k}" class="${st.emb.pat === k ? 'on' : ''}"><img src="${embCanvas({ ...lk, pat: k }, 56)}" alt="">${l}</button>`).join('')}</div>
        <div class="cl-h">マーク</div><div class="cl-opts img">${EMB_ICONS.map(([k, l]) => `<button data-eicon="${k}" class="${st.emb.icon === k ? 'on' : ''}"><img src="${embCanvas({ ...lk, icon: k }, 56)}" alt="">${l}</button>`).join('')}</div>
        <div class="cl-h">上の文字<small>（1〜2文字。空なら略称の1文字目）</small></div><input id="clCh" class="cl-ch" maxlength="2" value="${esc(st.emb.ch || '')}">
        <div class="cl-h">土台の色</div>${sw('c1', st.emb.c1)}<div class="cl-h">模様の色</div>${sw('c2', st.emb.c2)}<div class="cl-h">マークと文字の色</div>${sw('c3', st.emb.c3)}</div>`;
      const scKeep = (() => { const b0 = box.querySelector('.cl-body'), s0 = box.querySelector('.cl-side'); return [b0 ? b0.scrollTop : 0, s0 ? s0.scrollTop : 0, box._clTab]; })(); box._clTab = clubTab;   /* 版473：色などを選んでも、スクロールの位置をそのままに */
      box.innerHTML = `<div class="std cl"><div class="cl-top"><b>${opt.only ? { name: 'チーム名変更', kit: 'ユニフォーム', emb: 'エンブレム' }[opt.only] : 'クラブ設定'}</b><span>${opt.first ? 'あなたのクラブを作りましょう' : opt.only ? { name: 'クラブ名と略称', kit: 'ホーム・アウェーのユニフォーム', emb: 'クラブのエンブレム' }[opt.only] : '名前・ユニフォーム・エンブレム'}</span>${opt.first ? '' : '<button class="std-back" title="もどる（変えない）"><i class="bk-ico" aria-hidden="true"></i></button>'}</div>
        ${preview}<div class="cl-side"><div class="std-tabs cl-tabs"${opt.only ? ' hidden' : ''}>${[['name', '名前'], ['kit', 'ユニフォーム'], ['emb', 'エンブレム']].map(([k, l]) => `<button data-ctab="${k}" class="${clubTab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="cl-body">${body}</div><button class="cl-ok">決定</button></div></div>`;
      if (scKeep[2] === clubTab) requestAnimationFrame(() => { const b1 = box.querySelector('.cl-body'), s1 = box.querySelector('.cl-side'); if (b1) b1.scrollTop = scKeep[0]; if (s1) s1.scrollTop = scKeep[1]; });
      // ユニフォームの見本（正面・ななめ・GKなしの3人）
      const kits = box.querySelector('#clKits');
      for (const [view, p] of [['front', ps[9]], ['f34', ps[5]], ['side', ps[2]]]) { const cv = A().kitSprite(st.kit, p || {}, view); if (cv) { const im = document.createElement('canvas'); im.width = cv.width * 6; im.height = cv.height * 6; const c = im.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(cv, 0, 0, im.width, im.height); kits.appendChild(im); } }
      const keep = () => { const n = box.querySelector('#clName'), sh = box.querySelector('#clShort'), ch = box.querySelector('#clCh'); if (n) st.name = n.value; if (sh) st.short = sh.value; if (ch) st.emb.ch = ch.value; };
      box.querySelectorAll('[data-ctab]').forEach((b) => b.onclick = () => { keep(); clubTab = b.dataset.ctab; draw(); });
      box.querySelectorAll('[data-kside]').forEach((b) => b.onclick = () => { st.kside = b.dataset.kside; st.kit = st.kits[st.kside]; draw(); });
      box.querySelectorAll('[data-kpat]').forEach((b) => b.onclick = () => { st.kit.pat = b.dataset.kpat; draw(); });
      box.querySelectorAll('[data-eshape]').forEach((b) => b.onclick = () => { keep(); st.emb.shape = +b.dataset.eshape; draw(); });
      box.querySelectorAll('[data-epat]').forEach((b) => b.onclick = () => { keep(); st.emb.pat = +b.dataset.epat; draw(); });
      box.querySelectorAll('[data-eicon]').forEach((b) => b.onclick = () => { keep(); st.emb.icon = b.dataset.eicon; draw(); });
      const setCol = (key, v) => { if (key in st.kit) st.kit[key] = v; else st.emb[key] = v; };
      box.querySelectorAll('[data-col]').forEach((b) => b.onclick = () => { keep(); setCol(b.dataset.col, b.dataset.v); draw(); });
      box.querySelectorAll('[data-colin]').forEach((inp) => inp.onchange = () => { keep(); setCol(inp.dataset.colin, inp.value); draw(); });
      ['#clName', '#clShort', '#clCh'].forEach((q) => { const i = box.querySelector(q); if (i) i.oninput = () => { keep(); const pv = box.querySelector('.cl-name b'), ps2 = box.querySelector('.cl-name small'), em = box.querySelector('.cl-emb'); if (pv) pv.textContent = st.name || 'クラブ名'; if (ps2) ps2.textContent = '略称：' + (st.short || '―'); if (em) em.src = embCanvas(embOf(), 240); }; });
      const rz = box.querySelector('#clReset');
      if (rz) rz.onclick = async () => { const ok = await coachAsk('監督、最初からやり直しますか？<br>育てた選手・順位は、すべて消えます。'); if (ok) { el.hidden = true; save = C.newCareer(); store(); runners.length = 0; go('home'); open(); } };
      const back = box.querySelector('.std-back'); if (back) back.onclick = () => { el.hidden = true; if (opt.onDone) opt.onDone(false); };
      box.querySelector('.cl-ok').onclick = () => {
        keep();
        if (!String(st.name).trim()) { st.err = 'クラブ名を入れてください'; clubTab = 'name'; draw(); return; }
        if (!C.renameClub(save, st.name, st.short)) { st.err = 'その名前は使えません（ほかのチームと同じ名前です）'; clubTab = 'name'; draw(); return; }
        save.club.kit = { ...st.kits.home }; save.club.kit2 = { ...st.kits.away }; save.club.emb = { ...st.emb }; save.clubSet = true;
        embURL.clear(); bannerCache.clear(); store();
        el.hidden = true; if (opt.onDone) opt.onDone(true); else if (view === 'home') renderHome();
      };
    };
    draw(); el.hidden = false; el._fit();
  }


  // ---------- 秘書：クラブハウスに戻ったところで、サポーターの支持率 ----------
  // コーチ・秘書の絵：staff/coach.png・staff/secretary.png があればそれを使う（ないあいだは仮の顔）
  const STAFF_ART = { coach: 'staff/coach.png', sec: 'staff/secretary.png' }, staffImg = {};
  for (const k in STAFF_ART) { const im = new Image(); im.onload = () => { staffImg[k] = STAFF_ART[k]; }; im.src = STAFF_ART[k]; }
  const staffFace = (k) => staffImg[k] || faceOf(STAFF[k]);
  let clubBg = null;
  function clubhouseBg() {
    if (clubBg) return clubBg;
    // ホームの街の絵を、クラブハウスに寄せて描き直す（夕方の暗さ）
    const [cx, cy] = iso(18.0, 10.9, 0.6), s = 3.2;
    const cv = buildTown({ s, x: cx - 760 / s, y: cy - 400 / s });
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = 'rgba(24,22,40,0.42)'; c.fillRect(0, 0, 1280, 720);
    const g = c.createRadialGradient(780, 380, 80, 780, 380, 760); g.addColorStop(0, 'rgba(255,220,150,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    return (clubBg = cv.toDataURL());
  }
  async function postSecretary(info) {
    await facesReady();
    const v = info.off.support, nm = save.team.name;
    const lines = v >= 90 ? [`サポーターの一番の心配事は、監督が${nm}からいなくなることだそうです。`, '愛されてますね！'] :
      v >= 70 ? ['サポーターの期待が、どんどん高まっていますよ。', 'この調子でいきましょう！'] :
      v >= 45 ? ['サポーターは、もう少し結果を見たいようです。', '次の試合が大事ですね。'] : ['サポーターから、厳しい声が上がっています…。', 'なんとか巻き返しましょう。'];
    const el = fullScreen('secScreen', 'sec-wrap2'), box = el.querySelector('.lk-box');
    const old = document.getElementById('stdScreen');
    return new Promise(async (res) => {
      let k = 0;
      const draw = () => { box.innerHTML = `<img class="sec-bg" src="${clubhouseBg()}" alt=""><div class="sec-rate"><span>支持率</span><b>${v}%</b>${info.off.delta ? `<em class="${info.off.delta > 0 ? 'u' : 'd'}">${info.off.delta > 0 ? '▲' : '▼'}${Math.abs(info.off.delta)}</em>` : ''}</div><img class="sec-face${staffImg.sec ? ' art' : ''}" src="${staffFace('sec')}" alt=""><div class="sec-band"><b class="sec-name">秘書</b><p>${esc(lines[k])}</p><i class="lk-more">▶</i></div>`; };
      draw(); el.hidden = false; el._fit(); if (old) old.hidden = true;
      await blackClear(350);
      el.onclick = async () => { k++; if (k >= lines.length) { el.onclick = null; await blackFade(300); el.hidden = true; res(); blackClear(350); } else draw(); };
    });
  }

  // ---- 昇格・降格：予算が変わって、ホームの会場が変わる（秘書が案内） ----
  const VENUE_TALK = {
    1: ['地域1部にふさわしい会場として、小さなスタンドのある「運動公園」が使えるようになりました。', 'お客さんも、少しずつ来てくれるはずです！'],
    2: ['D3からは、屋根つきのメインスタンドがあるスタジアムで戦えます。', '看板も出て、すっかりプロのクラブらしくなりましたね！'],
    3: ['D2のスタジアムは、四方をスタンドが囲み、照明の塔も立っています。', '夜の試合も映えますよ。お客さんもたくさん入ります！'],
    4: ['ついにD1です！大型ビジョンのある、大きなスタジアムがホームになります。', '満員のお客さんの前で戦えますよ。夢の二冠まで、あと少しです！'],
  };
  async function venueTalk(se) {
    const from = (C.LEAGUES.find((l) => l.name === se.from) || {}).tier, to = (C.LG[save.league.id] || {}).tier;
    if (from == null || to == null || from === to) return;
    const up = to > from;
    venueNow = to; buildStandPano();
    let pic = '';
    try { const c = document.createElement('canvas'); c.width = 560; c.height = 300; const x = c.getContext('2d'); x.drawImage(standPano, -560, to <= 1 ? -470 : -330); pic = c.toDataURL('image/jpeg', 0.85); } catch (e) {}
    const nm = stadiumName({ name: save.team.name }, { home: true });
    const lines = up ? [`監督、${esc(save.league.name)}への昇格、おめでとうございます！`, '昇格して、クラブの予算が増えました。', ...VENUE_TALK[to], `新しいホームは「${esc(nm)}」です。`]
      : [`${esc(save.league.name)}に降格して、クラブの予算が減ってしまいました…。`, `ホームの会場は「${esc(nm)}」に変わります。`, 'また昇格して、大きなスタジアムを取り戻しましょう！'];
    await facesReady();
    const el = fullScreen('secScreen', 'sec-wrap2'), box = el.querySelector('.lk-box');
    return new Promise(async (res) => {
      let k = 0;
      const draw = () => { box.innerHTML = `<img class="sec-bg" src="${clubhouseBg()}" alt="">${pic ? `<div class="vn-pic"><img src="${pic}" alt=""><b>${esc(nm)}</b></div>` : ''}<img class="sec-face${staffImg.sec ? ' art' : ''}" src="${staffFace('sec')}" alt=""><div class="sec-band"><b class="sec-name">秘書</b><p>${lines[k]}</p><i class="lk-more">▶</i></div>`; };
      draw(); el.hidden = false; el._fit();
      await blackClear(350);
      el.onclick = async () => { k++; if (k >= lines.length) { el.onclick = null; await blackFade(300); el.hidden = true; res(); blackClear(350); } else draw(); };
    });
  }

  // ================= クラブ事務所（カルチョビットAの事務所）：会議室の部屋。左＝ユニフォーム・エンブレム・クラブ名・退任、右＝経営状況・チーム編成 =================
  // 版475：クラブ事務所を作り込み。ななめ見下ろし（2:1）の部屋に、テレビ・ロッカー・会議机・監督の机・作戦ボード・トロフィー棚・窓
  let officeBg = null;
  const OFX = 640, OFY = 262, OK = 0.78;
  const OP = (u, v, z = 0) => [OFX + (u - v) * OK, OFY + ((u + v) / 2 - z) * OK];
  function ofPoly(c, pts, col, st, lw) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); if (col) { c.fillStyle = col; c.fill(); } if (st) { c.strokeStyle = st; c.lineWidth = lw || 1.5; c.stroke(); } }
  // 箱：上面・手前左の面（v＝v+dv）・手前右の面（u＝u+du）
  function ofBox(c, u, v, z, du, dv, dz, top, fl, fr, st) {
    ofPoly(c, [OP(u, v + dv, z), OP(u + du, v + dv, z), OP(u + du, v + dv, z + dz), OP(u, v + dv, z + dz)], fl, st);
    ofPoly(c, [OP(u + du, v, z), OP(u + du, v + dv, z), OP(u + du, v + dv, z + dz), OP(u + du, v, z + dz)], fr, st);
    ofPoly(c, [OP(u, v, z + dz), OP(u + du, v, z + dz), OP(u + du, v + dv, z + dz), OP(u, v + dv, z + dz)], top, st);
  }
  const wR = (u0, z0, u1, z1, v = 0) => [OP(u0, v, z0), OP(u1, v, z0), OP(u1, v, z1), OP(u0, v, z1)];   // 右の壁（v＝0）の上の四角
  const wL = (v0, z0, v1, z1, u = 0) => [OP(u, v0, z0), OP(u, v1, z0), OP(u, v1, z1), OP(u, v0, z1)];   // 左の壁（u＝0）の上の四角
  function buildOfficeBg() {
    const W = 1280, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const HW = 1100;
    // ---- 床（木の床）と会議スペースのじゅうたん ----
    ofPoly(c, [OP(0, 0), OP(1500, 0), OP(1500, 1500), OP(0, 1500)], '#a8794a');
    c.strokeStyle = 'rgba(70,40,15,0.22)'; c.lineWidth = 1.5;
    for (let v = 0; v < 1500; v += 34) { const [x0, y0] = OP(0, v), [x1, y1] = OP(1500, v); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    for (let v = 0; v < 1500; v += 34) for (let u = ((v / 34) % 3) * 70; u < 1500; u += 210) { const [x0, y0] = OP(u, v), [x1, y1] = OP(u, v + 34); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    ofPoly(c, [OP(150, 210), OP(560, 210), OP(560, 470), OP(150, 470)], '#2f5a3e');
    ofPoly(c, [OP(162, 222), OP(548, 222), OP(548, 458), OP(162, 458)], null, 'rgba(240,220,120,0.55)', 3);
    // ---- 左の壁（u＝0）：腰の高さまで木の板、上はクリーム色 ----
    ofPoly(c, wL(0, 0, 1500, HW), '#e6dcc4');
    ofPoly(c, wL(0, 0, 1500, 95), '#8a5a2c');
    c.strokeStyle = 'rgba(40,20,5,0.35)'; c.lineWidth = 2; for (let v = 0; v < 900; v += 40) { const [x0, y0] = OP(0, v, 0), [x1, y1] = OP(0, v, 95); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    ofPoly(c, wL(0, 95, 1500, 103), '#5e3a18');
    // ---- 右の壁（v＝0）：明るい壁 ----
    ofPoly(c, wR(0, 0, 1500, HW), '#f1ece0');
    ofPoly(c, wR(0, 0, 1500, 95), '#9a6a38');
    c.strokeStyle = 'rgba(40,20,5,0.3)'; for (let u = 0; u < 900; u += 40) { const [x0, y0] = OP(u, 0, 0), [x1, y1] = OP(u, 0, 95); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    ofPoly(c, wR(0, 95, 1500, 103), '#6e4520');
    // 壁の角の影
    { const g = c.createLinearGradient(OFX - 40, 0, OFX + 40, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(OFX - 40, 0, 80, OFY + 10); }
    // ---- 右の壁：窓3つ（空と街）・ブラインド ----
    for (const u0 of [250, 400, 550]) {
      const q = wR(u0, 130, u0 + 120, 300);
      ofPoly(c, wR(u0 - 8, 122, u0 + 128, 308), '#c9c3b4');
      c.save(); ofPoly(c, q, null); c.clip();
      const [ax, ay] = OP(u0, 0, 300); const g = c.createLinearGradient(0, ay - 20, 0, ay + 200); g.addColorStop(0, '#6fb6ef'); g.addColorStop(1, '#cfeaf8'); c.fillStyle = g; c.fillRect(ax - 10, ay - 40, 160, 320);
      for (let k = 0; k < 6; k++) { const bu = u0 + k * 22, bh = 30 + ((k * 37 + u0) % 50); ofPoly(c, wR(bu, 130, bu + 18, 130 + bh), k % 2 ? '#8fa3b5' : '#a5b6c4'); for (let j = 0; j < 3; j++) ofPoly(c, wR(bu + 4, 140 + j * 12, bu + 8, 146 + j * 12), 'rgba(255,255,200,0.7)'); }
      c.fillStyle = 'rgba(255,255,255,0.35)'; ofPoly(c, [OP(u0 + 10, 0, 290), OP(u0 + 40, 0, 290), OP(u0 + 20, 0, 150), OP(u0 + 6, 0, 160)], 'rgba(255,255,255,0.3)');
      for (let z = 300; z > 266; z -= 7) ofPoly(c, wR(u0, z - 3, u0 + 120, z), 'rgba(235,235,225,0.95)');   // 上がったブラインド
      c.restore();
      ofPoly(c, wR(u0 + 58, 130, u0 + 62, 300), '#c9c3b4');
      ofBox(c, u0 - 10, 0, 118, 140, 10, 6, '#ddd6c6', '#bdb5a3', '#cfc8b8');   // 窓の下の台
    }
    // 時計
    { const [x, y] = OP(470, 0, 335); c.save(); c.translate(x, y); c.transform(1, 0.5, 0, 1, 0, 0); c.scale(OK, OK); c.fillStyle = '#fff'; c.strokeStyle = '#333'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 17, 0, 7); c.fill(); c.stroke(); c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -11); c.moveTo(0, 0); c.lineTo(8, 3); c.stroke(); c.restore(); }
    // 作戦ボード（ホワイトボード）
    { ofPoly(c, wR(40, 130, 200, 290), '#9aa0a8'); ofPoly(c, wR(46, 136, 194, 284), '#fbfbf8');
      const [x, y] = OP(46, 0, 284); c.save(); c.translate(x, y); c.transform(1, 0.5, 0, 1, 0, 0); c.scale(OK, OK);
      c.strokeStyle = '#2a7a3a'; c.lineWidth = 2; c.strokeRect(10, 10, 128, 128); c.beginPath(); c.moveTo(10, 74); c.lineTo(138, 74); c.stroke(); c.beginPath(); c.arc(74, 74, 14, 0, 7); c.stroke();
      const dots = [[74, 126], [30, 108], [58, 112], [90, 112], [118, 108], [40, 84], [74, 88], [108, 84], [50, 52], [98, 52], [74, 34]];
      dots.forEach(([dx, dy], i) => { c.fillStyle = i ? '#2f6fd6' : '#e8a020'; c.beginPath(); c.arc(dx, dy, 4.5, 0, 7); c.fill(); });
      c.strokeStyle = '#d83a3a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(98, 52); c.quadraticCurveTo(122, 34, 112, 18); c.stroke(); c.beginPath(); c.moveTo(106, 22); c.lineTo(112, 18); c.lineTo(116, 25); c.stroke();
      c.beginPath(); c.moveTo(40, 84); c.lineTo(28, 46); c.stroke();
      c.restore(); ofBox(c, 40, 0, 120, 160, 8, 6, '#c8ccd2', '#8a9098', '#a4aab2'); }
    // トロフィーの飾り棚（窓の下の低い棚）
    ofBox(c, 250, 0, 0, 290, 44, 92, '#7a4a22', '#5a3416', '#6a3e1c');
    for (let k = 0; k < 4; k++) ofPoly(c, [OP(258 + k * 70, 44, 12), OP(318 + k * 70, 44, 12), OP(318 + k * 70, 44, 80), OP(258 + k * 70, 44, 80)], 'rgba(180,220,240,0.35)', '#3a2410', 2);
    [[272, '#e8c34a', 1.2], [310, '#c0c4cc', 1], [350, '#e8c34a', 1.4], [395, '#cd8a4a', 1], [435, '#e8c34a', 1.1], [480, '#c0c4cc', 1], [515, '#e8c34a', 1.25]].forEach(([u, col, h]) => { const [x, y] = OP(u, 22, 92); c.fillStyle = '#3a2a1a'; c.fillRect(x - 7, y - 5, 14, 5); c.fillStyle = col; c.fillRect(x - 3, y - 5 - 10 * h, 6, 10 * h); c.beginPath(); c.moveTo(x - 9, y - 5 - 22 * h); c.lineTo(x + 9, y - 5 - 22 * h); c.lineTo(x + 5, y - 5 - 10 * h); c.lineTo(x - 5, y - 5 - 10 * h); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x - 6, y - 3 - 22 * h, 3, 8); });
    // ペナント（左の壁、奥の角の近く）
    [[20, '#d83a3a'], [70, '#2f6fd6']].forEach(([v, col]) => ofPoly(c, [OP(0, v, 300), OP(0, v + 44, 300), OP(0, v + 22, 236)], col, '#fff', 2));
    // ---- 左の壁：ONE TEAM の横断幕 ----
    { const [x, y] = OP(0, 590, 320); c.save(); c.translate(x, y); c.transform(1, -0.5, 0, 1, 0, 0); c.scale(OK, OK); c.fillStyle = '#fbfaf4'; c.fillRect(0, 0, 250, 82); c.strokeStyle = '#2a6e3a'; c.lineWidth = 6; c.strokeRect(0, 0, 250, 82);
      c.fillStyle = '#1b2a20'; c.font = 'italic 900 42px "Arial Black",Arial'; c.textAlign = 'center'; c.fillText('ONE TEAM', 125, 46); c.font = '800 15px "Hiragino Kaku Gothic ProN",sans-serif'; c.fillText('〜 全員で、一つのゴールへ 〜', 125, 70); c.restore(); }
    // 左の壁：大きなテレビ（試合の映像）とテレビ台
    { const v0 = 130, v1 = 290; ofPoly(c, wL(v0 - 6, 136, v1 + 6, 238), '#111418'); ofPoly(c, wL(v0, 142, v1, 232), '#3e8f3a');
      const [x, y] = OP(0, v1, 232); c.save(); c.translate(x, y); c.transform(1, -0.5, 0, 1, 0, 0); c.scale(OK, OK);
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.strokeRect(8, 8, 144, 74); c.beginPath(); c.moveTo(80, 8); c.lineTo(80, 82); c.stroke(); c.beginPath(); c.arc(80, 45, 12, 0, 7); c.stroke();
      [[40, 30, '#2f6fd6'], [56, 58, '#2f6fd6'], [92, 40, '#d83a3a'], [110, 62, '#d83a3a'], [70, 50, '#2f6fd6'], [124, 30, '#d83a3a']].forEach(([px, py, col]) => { c.fillStyle = col; c.fillRect(px, py, 4, 7); });
      c.fillStyle = '#fff'; c.fillRect(84, 46, 3, 3); c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(8, 8, 52, 12); c.fillStyle = '#fff'; c.font = '800 9px sans-serif'; c.fillText('LIVE 1-0', 12, 17);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.moveTo(8, 8); c.lineTo(60, 8); c.lineTo(20, 82); c.lineTo(8, 82); c.fill(); c.restore();
      ofBox(c, 0, v0 - 10, 0, 44, v1 - v0 + 20, 52, '#4a3020', '#2e1c10', '#3a2416');
      ofPoly(c, [OP(44, v0 + 10, 12), OP(44, v0 + 70, 12), OP(44, v0 + 70, 40), OP(44, v0 + 10, 40)], '#1e120a'); ofPoly(c, [OP(44, v0 + 90, 12), OP(44, v0 + 150, 12), OP(44, v0 + 150, 40), OP(44, v0 + 90, 40)], '#1e120a');
      { const [sx, sy] = OP(22, v0 + 40, 52); c.fillStyle = '#222'; c.fillRect(sx - 14, sy - 10, 28, 10); c.fillStyle = '#4ae04a'; c.fillRect(sx + 8, sy - 7, 3, 2); }   // レコーダー
    }
    // ウォーターサーバー（左の壁ぎわ）
    ofBox(c, 0, 330, 0, 36, 36, 95, '#f2f2f2', '#c8c8c8', '#dedede'); { const [x, y] = OP(18, 348, 95); c.fillStyle = 'rgba(120,190,240,0.85)'; c.fillRect(x - 11, y - 34, 22, 30); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x - 8, y - 32, 4, 24); }
    // 左の壁：ロッカー（番号つき）とベンチ
    for (let k = 0; k < 5; k++) { const v = 400 + k * 56;
      ofBox(c, 0, v, 0, 48, 54, 200, '#7d8590', '#5f6670', '#8d96a2', 'rgba(30,35,40,0.6)');
      ofPoly(c, [OP(48, v + 6, 14), OP(48, v + 48, 14), OP(48, v + 48, 190), OP(48, v + 6, 190)], '#9aa3ae', 'rgba(30,35,40,0.5)');
      for (let j = 0; j < 4; j++) ofPoly(c, [OP(48, v + 14, 160 - j * 7), OP(48, v + 40, 160 - j * 7), OP(48, v + 40, 163 - j * 7), OP(48, v + 14, 163 - j * 7)], '#4e555e');
      ofPoly(c, [OP(48, v + 16, 120), OP(48, v + 38, 120), OP(48, v + 38, 132), OP(48, v + 16, 132)], '#f4f2ea');
      const [tx, ty] = OP(48, v + 27, 122); c.fillStyle = '#222'; c.font = '900 10px sans-serif'; c.textAlign = 'center'; c.fillText(String([7, 9, 10, 11, 14][k]), tx, ty);
      ofPoly(c, [OP(48, v + 40, 90), OP(48, v + 44, 90), OP(48, v + 44, 110), OP(48, v + 40, 110)], '#d8dde3');
    }
    [[76, 420], [76, 668], [108, 420], [108, 668]].forEach(([u, v]) => ofBox(c, u, v, 0, 6, 6, 26, '#555', '#333', '#444')); ofBox(c, 70, 410, 26, 46, 270, 10, '#b88a52', '#8a6236', '#9a703f');   // 脚を先に、座面をあとに
    // 奥の角：大きな観葉植物とクラブの旗
    { ofBox(c, 20, 20, 0, 50, 50, 46, '#c8a070', '#9a7448', '#b08858'); const [x, y] = OP(45, 45, 46); c.fillStyle = '#245f2a'; for (let k = 0; k < 14; k++) { c.beginPath(); c.ellipse(x + Math.sin(k * 2.1) * 22, y - 20 - k * 6, 10, 22, Math.sin(k * 1.3) * 0.9, 0, 7); c.fill(); } c.fillStyle = '#3a9a3e'; for (let k = 0; k < 10; k++) { c.beginPath(); c.ellipse(x + Math.cos(k * 1.7) * 18, y - 28 - k * 7, 6, 16, Math.cos(k) * 0.8, 0, 7); c.fill(); } }
    officeBg = cv;
  }
  // 人：u・v（床の位置）、向き（view）、左右反転、服
  const OFF_PEOPLE = [
    // 会議机の奥の列（手前を向く）
    { u: 225, v: 226, view: 'f34', fl: true, cl: 'navy' }, { u: 300, v: 226, view: 'f34', fl: true, cl: 'gray' }, { u: 375, v: 226, view: 'f34', fl: true, cl: 'shirt' }, { u: 450, v: 226, view: 'f34', fl: true, cl: 'navy' },
    // 机のはし（議長）
    { u: 150, v: 318, view: 'f34', fl: false, cl: 'navy' },
    // 手前の列（奥を向く）
    { u: 262, v: 414, view: 'b34', fl: false, cl: 'gray' }, { u: 340, v: 414, view: 'b34', fl: false, cl: 'navy' }, { u: 418, v: 414, view: 'b34', fl: false, cl: 'shirt' },
  ];
  const officeEmb = new Map(); let officeRedraw = null;
  const OFF_CL = () => ({ navy: SUIT_NAVY, gray: SUIT_GRAY, shirt: SHIRT });
  function drawOfficeRoom(c) {
    c.drawImage(officeBg, 0, 0);
    const S = A().SPR, sc = 2.7, CL = OFF_CL();
    // 版479：テレビの上に、クラブのエンブレム（エンブレムを変えたら、ここも変わる）
    { const url = emblemURL(save.team.name, 128); let im = officeEmb.get(url); if (!im) { im = new Image(); im.onload = () => { if (officeRedraw) officeRedraw(); }; im.src = url; officeEmb.set(url, im); }
      if (im.complete && im.naturalWidth) { const [x, y] = OP(0, 256, 352); c.save(); c.translate(x, y); c.transform(1, -0.5, 0, 1, 0, 0); c.scale(OK, OK); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowOffsetX = 3; c.shadowOffsetY = 4; c.drawImage(im, 4, 2, 90, 90); c.restore(); } }
    const person = (o, k) => { const img = dressed('of' + k, { hair: k % 4, hairColor: (k * 2) % 3, skin: k % 3 }, o.view, 0, CL[o.cl]); const [x, y] = OP(o.u, o.v); c.save(); c.imageSmoothingEnabled = false; c.translate(x, 0); if (o.fl) c.scale(-1, 1); c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(0, y, 15, 5, 0, 0, 7); c.fill(); c.drawImage(img, -S.W * sc / 2, y - (S.H - 3) * sc, S.W * sc, S.H * sc); c.restore(); };
    const chair = (u, v, backSide) => { // backSide：'v-'＝奥に背もたれ、'v+'＝手前に背もたれ、'u-'＝左奥に背もたれ
      ofBox(c, u - 15, v - 15, 20, 30, 30, 6, '#2a2e36', '#16181d', '#1f2228');
      ofBox(c, u - 3, v - 3, 0, 6, 6, 20, '#444', '#222', '#333');
      if (backSide === 'v-') ofBox(c, u - 15, v - 19, 20, 30, 6, 40, '#30343c', '#1b1e24', '#262a31');
      if (backSide === 'u-') ofBox(c, u - 19, v - 15, 20, 6, 30, 40, '#30343c', '#1b1e24', '#262a31');
      if (backSide === 'v+') ofBox(c, u - 15, v + 13, 20, 30, 6, 22, '#30343c', '#1b1e24', '#262a31');
    };
    // 監督の机（窓ぎわ）：秘書がこちらに背中を向けてパソコンで仕事（画面に表とグラフ）
    ofBox(c, 540, 70, 0, 130, 62, 50, '#7a5232', '#4e3218', '#5e3c1e');
    ofBox(c, 544, 74, 50, 122, 54, 4, '#8a6240', '#5a3a20', '#6a4626');
    { ofBox(c, 598, 84, 54, 10, 8, 10, '#2a2c30', '#1a1c20', '#22252a');   // モニターの足
      ofBox(c, 572, 80, 64, 62, 6, 40, '#2a2c30', '#16181c', '#1e2024');   // モニター
      const q = [OP(576, 86, 68), OP(630, 86, 68), OP(630, 86, 100), OP(576, 86, 100)]; ofPoly(c, q, '#f4f8fc');
      for (let k = 0; k < 4; k++) ofPoly(c, [OP(580, 86, 94 - k * 6), OP(600, 86, 94 - k * 6), OP(600, 86, 96 - k * 6), OP(580, 86, 96 - k * 6)], '#9aa8b8');
      [[606, 8, '#2f6fd6'], [613, 14, '#e8a020'], [620, 20, '#2a8a3a']].forEach(([u, h, col]) => ofPoly(c, [OP(u, 86, 72), OP(u + 5, 86, 72), OP(u + 5, 86, 72 + h), OP(u, 86, 72 + h)], col));
      ofPoly(c, [OP(576, 86, 98), OP(630, 86, 98), OP(630, 86, 100), OP(576, 86, 100)], '#3a7ad8'); }
    ofBox(c, 580, 104, 54, 44, 14, 3, '#e8e8ea', '#b8b8bc', '#cfcfd2');   // キーボード
    ofBox(c, 640, 100, 54, 22, 26, 6, '#f8f8f4', '#ddd', '#e8e8e4'); ofBox(c, 642, 102, 60, 22, 26, 3, '#fff8d8', '#ddd', '#e8e8e4');   // 書類の山
    ofBox(c, 548, 96, 54, 22, 18, 8, '#2a2a2e', '#18181b', '#202024'); ofBox(c, 551, 98, 62, 6, 14, 4, '#3a3a40', '#222', '#2c2c30');   // 電話
    { const [x, y] = OP(662, 86, 54); c.fillStyle = '#fff'; c.fillRect(x - 5, y - 12, 10, 12); c.fillStyle = '#c8392d'; c.fillRect(x - 5, y - 9, 10, 3); }   // マグカップ
    { ofBox(c, 640, 130, 54, 30, 3, 12, '#f4f2ea', '#c8c4b4', '#dedacb'); const [x, y] = OP(655, 133, 60); c.save(); c.translate(x, y); c.transform(1, -0.5, 0, 1, 0, 0); c.scale(OK, OK); c.fillStyle = '#333'; c.font = '900 10px sans-serif'; c.textAlign = 'center'; c.fillText('秘書', 0, 4); c.restore(); }   // 名札
    person({ u: 606, v: 150, view: 'b34', fl: false, cl: 'shirt' }, 9);
    chair(606, 156, 'v+');
    // 会議机：奥のいす → 奥の人 → 机 → 手前の人 → 手前のいす
    [225, 300, 375, 450].forEach((u) => chair(u, 222, 'v-'));
    chair(150, 318, 'u-');
    OFF_PEOPLE.slice(0, 5).forEach((o, k) => person(o, k));
    // 机（脚4本と天板）
    [[186, 262], [486, 262], [186, 376], [486, 376]].forEach(([u, v]) => ofBox(c, u, v, 0, 8, 8, 32, '#3a2414', '#24160a', '#2e1c0e'));
    ofBox(c, 180, 255, 32, 316, 132, 9, '#7a4f2a', '#4e3018', '#5e3a1e');
    ofPoly(c, [OP(196, 270, 41), OP(480, 270, 41), OP(480, 372, 41), OP(196, 372, 41)], null, 'rgba(255,230,190,0.25)', 2);
    // 机の上：書類・ノートPC・ペットボトル
    [[230, 290], [305, 290], [380, 290], [455, 290], [270, 350], [345, 350], [420, 350]].forEach(([u, v], i) => { ofBox(c, u - 12, v - 9, 41, 24, 18, 1.5, i % 3 === 1 ? '#fff8d8' : '#fbfbf8', '#ccc', '#ddd'); });
    ofBox(c, 200, 300, 41, 30, 22, 2, '#9aa0a8', '#6a7078', '#80868e'); ofPoly(c, [OP(200, 300, 43), OP(230, 300, 43), OP(230, 300, 64), OP(200, 300, 64)], '#2a2e34');
    [[330, 318], [410, 322]].forEach(([u, v]) => { const [x, y] = OP(u, v, 41); c.fillStyle = 'rgba(150,210,250,0.85)'; c.fillRect(x - 3, y - 16, 6, 16); c.fillStyle = '#3a8ad8'; c.fillRect(x - 3, y - 19, 6, 3); });
    OFF_PEOPLE.slice(5).forEach((o, k) => person(o, k + 5));
    [262, 340, 418].forEach((u) => chair(u, 418, 'v+'));
    // 手前右：ソファとローテーブル（お客さん用）
    ofBox(c, 640, 380, 0, 60, 150, 28, '#3a5aa0', '#243a70', '#2e4a88');
    ofBox(c, 690, 380, 28, 14, 150, 34, '#4466b0', '#284480', '#30508f');
    ofBox(c, 560, 410, 0, 50, 90, 24, '#c8a070', '#8a6236', '#9a703f');
    { const [x, y] = OP(585, 450, 24); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - 4, 7, 4, 0, 0, 7); c.fill(); c.fillStyle = '#7a4a22'; c.fillRect(x - 5, y - 10, 10, 6); }
    // 手前左：植木鉢
    { ofBox(c, 150, 600, 0, 34, 34, 34, '#c8a070', '#9a7448', '#b08858'); const [x, y] = OP(167, 617, 34); c.fillStyle = '#2f8a3a'; for (let k = 0; k < 9; k++) { c.beginPath(); c.ellipse(x + Math.sin(k * 2.3) * 14, y - 10 - k * 5, 7, 15, Math.sin(k) * 0.8, 0, 7); c.fill(); } }
  }
  function openOffice() {
    const el = fullScreen('officeScreen', 'std-wrap off-wrap'), box = el.querySelector('.lk-box');
    if (!officeBg) buildOfficeBg();
    let panel = null, sortK = 'order', sortDir = 1, mode = 'st';   // 版518：最初はスタメン順→ベンチ順→ベンチ外順
    const cvs = document.createElement('canvas'); cvs.width = 1280; cvs.height = 720;
    const drawRoom = () => { const c = cvs.getContext('2d'); drawOfficeRoom(c); };
    officeRedraw = drawRoom;
    const BTN = (a, ico, label) => `<button class="of-b" data-a="${a}"><span>${ico}</span><b>${label}</b></button>`;
    const PIC = (a, f, label) => `<button class="of-b of-pic" data-a="${a}" title="${label}"><img src="icons/${f}.png" alt="${label}"></button>`;   /* 版470：送ってもらったアイコンの絵 */
    const I = {
      kit: '<svg viewBox="0 0 40 40"><path d="M12 6l-9 6 4 8 4-2v16h18V18l4 2 4-8-9-6c-1 3-4 5-8 5s-7-2-8-5z" fill="#2f6fd6" stroke="#fff" stroke-width="2"/></svg>',
      emb: `<svg viewBox="0 0 40 40"><path d="M20 3l14 5v11c0 9-6 15-14 18C12 34 6 28 6 19V8z" fill="#d83a3a" stroke="#fff" stroke-width="2.5"/><text x="20" y="25" font-size="14" font-weight="900" text-anchor="middle" fill="#fff">A</text></svg>`,
      name: '<svg viewBox="0 0 40 40"><rect x="4" y="10" width="32" height="20" rx="3" fill="#fff" stroke="#333" stroke-width="2"/><path d="M9 16h22M9 21h16" stroke="#333" stroke-width="2.5"/></svg>',
      bye: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#e8e2d0" stroke="#333" stroke-width="2"/><path d="M13 13l14 14M27 13L13 27" stroke="#d83a3a" stroke-width="4"/></svg>',
      biz: '<svg viewBox="0 0 40 40"><rect x="5" y="22" width="7" height="12" fill="#2f8a4e"/><rect x="16" y="14" width="7" height="20" fill="#f2c21c"/><rect x="27" y="7" width="7" height="27" fill="#d83a3a"/></svg>',
      team: '<svg viewBox="0 0 40 40"><rect x="5" y="6" width="30" height="28" rx="3" fill="#2a5a32" stroke="#fff" stroke-width="2"/><path d="M9 13h22M9 19h22M9 25h22" stroke="#e7ff62" stroke-width="2.5"/></svg>',
    };
    const BUDGET = ['500万円', '1,500万円', '5,000万円', '1億5,000万円', '4億円'];
    const bizHTML = () => { const tier = (C.LG[save.league.id] || {}).tier || 0, tr = (save.history || []).filter((h) => /優勝/.test(h.msg) || h.cup).length;
      return `<div class="of-p of-biz"><div class="ob-h"><img src="${emblemURL(save.team.name, 64)}" alt=""><div><b>${esc(save.team.name)}</b><small>（${esc(stadiumName({ name: save.team.name }, { home: true }))}）</small><em>${esc(save.manager || '')}${save.manager ? '監督' : ''}</em></div></div>
        <table class="ob-t"><tr><th>所属</th><td>${lgBadge(save.league.id)} ${esc(save.league.name)}</td></tr><tr><th>予算</th><td>${BUDGET[tier]}<small>（リーグが上がると増えます）</small></td></tr><tr><th>シーズン</th><td>${save.season}年目</td></tr><tr><th>獲得タイトル</th><td>${tr}</td></tr></table></div>`; };
    const PK = D.PARAMS.map((q) => q.k);
    const teamHTML = () => {
      const ps = save.team.players.map((p, i) => ({ p, i })), key = String(save.season);
      const rec = (p) => (p.rec && p.rec[key]) || { P: 0, G: 0, A: 0, Y: 0, R: 0 };
      const val = { order: (o) => o.i, no: (o) => o.p.number, pos: (o) => ({ GK: 0, DF: 1, MF: 2, FW: 3 })[o.p.position], P: (o) => -rec(o.p).P, G: (o) => -rec(o.p).G, A: (o) => -rec(o.p).A, Y: (o) => -(rec(o.p).Y + rec(o.p).R * 2), X: (o) => -(o.p.injury || 0), star: (o) => -C.ensureStar(o.p), fat: (o) => -(o.p.fatigue || 0) };
      PK.forEach((k) => { val[k] = (o) => { C.ensurePts(o.p); return -o.p.pts[k]; }; });
      const f = val[sortK] || val.order; ps.sort((a, b) => (f(a) - f(b)) * sortDir || a.i - b.i);
      const th = (k, label, cls) => `<th class="${cls || ''}${sortK === k ? ' on' : ''}" data-s="${k}">${label}</th>`;
      let head, row;
      if (mode === 'st') { head = th('P', '試合') + th('G', '得点') + th('A', 'アシスト') + th('Y', '<i class="ob-y"></i>') + th('X', '<i class="ob-x">×</i>'); row = (o) => { const r = rec(o.p); return `<td>${r.P}</td><td>${r.G}</td><td>${r.A}</td><td>${r.Y + r.R}</td><td>${o.p.injury > 0 ? o.p.injury + '週' : '0'}</td>`; }; }
      else if (mode === 'ab') { head = PK.map((k, j) => th(k, ico(k), 'ic')).join('') + '<th>タイプ</th>'; row = (o) => { C.ensurePts(o.p); return PK.map((k) => { const g = C.rankInfo(o.p.pts[k]).g; return `<td><i class="rk2 g-${g}">${g}</i></td>`; }).join('') + `<td><span class="tbadge ${TYPE_CLS[o.p.type] || 'ty-bal'}">${esc(o.p.type || '')}</span></td>`; }; }
      else { head = th('star', 'レア度') + '<th>上限</th>' + th('fat', '疲労'); row = (o) => `<td>${starHTML(C.ensureStar(o.p), o.p.totsu)}</td><td>${capBadge(C.capGrade(o.p))}</td><td><i class="cdot ${condDot(o.p)}"></i> ${Math.round(o.p.fatigue || 0)}%</td>`; }
      return `<div class="of-p of-team"><div class="ot-h">${esc(save.team.name)}　チーム編成<span>${['成績', '能力', '状態'][['st', 'ab', 'cd'].indexOf(mode)]}</span></div><div class="ot-sc"><table class="ot"><tr>${th('pos', 'Pos.')}${th('no', 'No.')}<th class="nm${sortK === 'order' ? ' on' : ''}" data-s="order" title="スタメン順にもどす">選手</th><th></th>${head}</tr>
        ${ps.map((o) => `<tr data-i="${o.i}" class="${o.i < 11 ? '' : o.i < 11 + C.BENCH_N ? 'sub' : 'sub out'}${sortK === 'order' && (o.i === 11 || o.i === 11 + C.BENCH_N) ? ' sep' : ''}"><td><i class="pos ${POSC[o.p.position]}">${o.p.position}</i></td><td class="no">${o.p.number}</td><td class="nm">${esc(o.p.name)}</td><td><i class="cdot ${condDot(o.p)}"></i></td>${row(o)}</tr>`).join('')}</table></div>
        <button class="ot-mode ui-img" title="表示を切りかえる"><img src="icons/ui_change.png" alt="切りかえ"></button><p class="ot-hint">見出しをタップで並べかえ。右下のボタンで「成績・能力・状態」を切りかえ</p></div>`;
    };
    const draw = () => {
      box.innerHTML = `<div class="off"><div class="of-room"></div>
        <div class="of-l">${PIC('kit', 'off_kit', 'ユニフォーム')}${PIC('emb', 'off_emblem', 'エンブレム')}${PIC('name', 'off_name', 'チーム名変更')}${PIC('bye', 'off_retire', '退任')}${PIC('set', 'off_setting', '設定')}</div>
        <div class="of-r">${PIC('biz', 'off_biz', '経営状況')}${PIC('team', 'off_team', 'チーム編成')}</div>
        <button class="std-back of-back" title="もどる"><i class="bk-ico" aria-hidden="true"></i></button>
        ${panel === 'biz' ? bizHTML() : panel === 'team' ? teamHTML() : ''}</div>`;
      box.querySelector('.of-room').appendChild(cvs); drawRoom();
      box.querySelectorAll('.of-b').forEach((b) => b.onclick = async () => { const a = b.dataset.a;
        if (a === 'biz' || a === 'team') { panel = panel === a ? null : a; draw(); return; }
        if (a === 'set') { if (window.__openMenu) window.__openMenu(); return; }   /* 版470：設定（チュートリアル・全画面など。右上のメニューの代わり） */
        if (a === 'kit' || a === 'emb' || a === 'name') { clubTab = a; el.hidden = true; openClub({ only: a, onDone: () => { el.hidden = false; draw(); } }); return; }
        if (a === 'bye') {
          const ok = await coachAsk('え、退任…？<br>このクラブの監督をやめる、ということでしょうか？<br><small>（育てた選手・順位など、セーブデータがすべて消えます）</small>', null, 'sec');
          if (ok) { el.hidden = true; save = C.newCareer(); store(); runners.length = 0; go('home'); open(); }
          else await coachAsk('やっぱり冗談ですよね。<br>これからもよろしくお願いします、監督！', [{ label: 'OK', value: true }], 'sec');
        } });
      box.querySelector('.of-back').onclick = () => { if (panel) { panel = null; draw(); return; } el.hidden = true; go('home'); };
      box.querySelectorAll('[data-s]').forEach((t) => t.onclick = () => { const k = t.dataset.s; if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = 1; } draw(); });
      { const m = box.querySelector('.ot-mode'); if (m) m.onclick = () => { mode = mode === 'st' ? 'ab' : mode === 'ab' ? 'cd' : 'st'; draw(); }; }
      box.querySelectorAll('.ot tr[data-i]').forEach((tr) => tr.onclick = () => playerDetail(+tr.dataset.i, { office: true, onChange: () => draw() }));
    };
    draw(); el.hidden = false; el._fit();
  }


  // ================= 版505：スカウト（選手ガチャ）=================
  const SND2 = (n) => { try { window.DotSound && DotSound.play(n); } catch (_) {} };
  function gcTeamShort(tid) { const t = (C.TEAMS || []).find((x) => x.id === tid); return t ? t.short || t.name : ''; }
  function gcFace(tid, q, cls) { const k = C.faceKeyOf(tid, q); return k ? starPic(k, '#ffffff', q.pos === 'GK', cls) : `<img class="${cls}" alt="">`; }
  // 版521：スカウトの背景（監督の絵）。赤い斜めの演出だけを、ピックアップ選手の色に塗りかえる（スタジアムはそのまま）
  const gcBgCache = new Map(); let gcBgImg = null;
  function gcBgFor(chip, cb) {
    const toHsl = (h) => { const n = parseInt(h.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
      let hh = 0; if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(hh * 60 + 360) % 360, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l]; };
    const cs = (chip || ['#c8141e']).map(toHsl), ok = (c) => c[1] > 0.45 && c[2] > 0.25 && c[2] < 0.7, best = cs.find(ok) || cs.slice().sort((a, b) => b[1] - a[1])[0];   // 選手の色（1つ目が濃すぎる・白い時は2つ目）
    const H = best[0], Sk = Math.min(1, best[1] / 0.6), key = Math.round(H) + '|' + Sk.toFixed(2);
    if (gcBgCache.has(key)) { cb(gcBgCache.get(key)); return; }
    const go = () => { try {
      const im = gcBgImg, W = im.naturalWidth, Hh = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      if (!(H < 12 || H > 350) || Sk < 0.9) {
        const d = x.getImageData(0, 0, W, Hh), px = d.data;
        for (let i = 0; i < px.length; i += 4) { const r = px[i], g = px[i + 1], b = px[i + 2], w = Math.max(0, Math.min(1, (r - Math.max(g, b) - 25) / 70)); if (!w) continue;
          // 赤の明るさ（陰影）はそのまま、色あいだけを選手の色へ
          const mx = r / 255, mn = Math.min(g, b) / 255, l = (mx + mn) / 2, sat = (mx - mn) / (1 - Math.abs(2 * l - 1) || 1) * Sk;
          const C2 = (1 - Math.abs(2 * l - 1)) * sat, X = C2 * (1 - Math.abs(((H / 60) % 2) - 1)), m = l - C2 / 2;
          const [r1, g1, b1] = H < 60 ? [C2, X, 0] : H < 120 ? [X, C2, 0] : H < 180 ? [0, C2, X] : H < 240 ? [0, X, C2] : H < 300 ? [X, 0, C2] : [C2, 0, X];
          px[i] = r * (1 - w) + (r1 + m) * 255 * w; px[i + 1] = g * (1 - w) + (g1 + m) * 255 * w; px[i + 2] = b * (1 - w) + (b1 + m) * 255 * w; }
        x.putImageData(d, 0, 0); }
      const u = c.toDataURL('image/jpeg', 0.88); gcBgCache.set(key, u); cb(u); } catch (e) { cb('img/gacha_bg.jpg'); } };
    if (gcBgImg && gcBgImg.complete && gcBgImg.naturalWidth) go(); else { if (!gcBgImg) { gcBgImg = new Image(); gcBgImg.src = 'img/gacha_bg.jpg'; } gcBgImg.addEventListener('load', go, { once: true }); }
  }
  function openGacha() {
    const el = fullScreen('gachaScreen', 'std-wrap gc-wrap'), box = el.querySelector('.lk-box');
    const g = C.ensureGacha(save);
    if (!g.gift) { g.gift = 1; save.coins = (save.coins || 0) + 2000; store(); setTimeout(() => coachAsk('スカウトがオープンしました！<br>記念に <b>2,000コイン</b> をプレゼントします。<br>さっそく選手をスカウトしてみましょう！', [{ label: 'OK', value: true }], 'sec'), 300); }
    const draw = () => {
      const bn = C.gachaBanner(), U = bn.uniq, q = C.rosterAt(bn.tid, 1).players.find((x) => x.no === bn.no), left = C.GACHA_PITY - (g.pity[bn.id] || 0);
      const cc = U.chip || ['#c8141e', '#ffd23a', '#ffe45a'];
      const tp = U.type || q.type || '';
      // 版519：監督の作ったスカウト画面（夜のスタジアム・大きな選手・右に操作パネル）に合わせた
      // 版523：監督のデザイン案（1672×940）を、1280×720の画面にそのままの位置・大きさで写した
      box.innerHTML = `<div class="gc gc2 gc3" style="--c0:${cc[0]};--c1:${cc[1]};--c2:${cc[2]}">
        <div class="gc2-bg"></div>
        ${SCOUT_ART[bn.key] ? `<img class="gc3-art" src="${SCOUT_ART[bn.key]}" alt="">` : `<div class="gc3-fc">${gcFace(bn.tid, q, 'gc3-face')}</div>`}
        <div class="gc3-ttl"><b>スカウト</b></div>
        <div class="gc3-pills"><span class="gc3-coin">${COIN}<b>${(save.coins || 0).toLocaleString()}</b></span>
        <span class="gc3-kk"><i>◆</i>覚醒のカケラ<b>${(save.kakera || 0).toLocaleString()}</b></span></div>
        <button class="std-back gc-back gc3-back" title="もどる"><i class="bk-ico" aria-hidden="true"></i></button>
        <div class="gc3-rib"><span>今月のピックアップ</span><span>${esc(bn.until)}まで</span></div>
        <div class="gc3-star">${'<i>★</i>'.repeat(5)}</div>
        <div class="gc3-nm"><i class="gc3-brush"></i><b>${esc(U.who)}</b></div>
        <div class="gc3-pos"><i>${esc(q.pos)}</i><span>${esc(gcTeamShort(bn.tid))}</span><s></s><span>${esc(tp)}</span></div>
        <div class="gc3-line"></div>
        <p class="gc3-title">国内屈指の${esc(tp)}</p>
        <div class="gc3-un"><i class="gc3-lbl">固有スキル</i><i class="gc3-brush2"></i><b>${esc(U.name)}</b><small>${esc(U.se || '')}</small></div>
        <div class="gc3-side">
          <div class="gc3-pity"><span>ピックアップ確定まで</span><b>あと<em>${left}</em>回</b><i><s style="width:${Math.max(4, Math.round((1 - left / C.GACHA_PITY) * 100))}%"></s></i></div>
          <button class="gc2-btn gc3-btn ten" data-n="10"><b>10回スカウト</b><span>${COIN}${C.GACHA_COST.ten.toLocaleString()}</span><small>★3以上 1人確定</small></button>
          <button class="gc2-btn gc3-btn one" data-n="1"><b>1回スカウト</b><span>${COIN}${C.GACHA_COST.one}</span></button>
          <button class="gc-rate gc3-sb s1">出る確率<em>›</em></button><button class="gc-rule gc3-sb s2">獲得ルール<em>›</em></button><button class="gc-auto gc3-sb s3${g.auto ? ' on' : ''}"><span>自動放出<small>${['しない', '★1', '★2以下'][g.auto || 0]}</small></span><i class="gc2-sw"></i></button>
        </div></div>`;
      { const bgEl = box.querySelector('.gc2-bg'); gcBgFor(U.chip, (u) => { bgEl.style.backgroundImage = `url(${u})`; bgEl.classList.add('on'); }); }
      box.querySelector('.gc-rule').onclick = () => coachAsk('<b>獲得ルール</b><br><small>同じ選手が出たら凸（最大3凸）。完凸のあとは覚醒のカケラになります。<br>自動放出をオンにすると、はじめて出た選手のうち、その★以下はカケラになります（持っている選手は凸）。<br>チームが25人の時は、リザーブ（控え室）に入ります。</small>', [{ label: 'とじる', value: true }], 'sec');
      box.querySelector('.gc-back').onclick = () => { el.hidden = true; go('home'); };
      box.querySelector('.gc-auto').onclick = () => { g.auto = ((g.auto || 0) + 1) % 3; store(); draw(); };
      box.querySelector('.gc-rate').onclick = () => coachAsk(`<b>出る確率</b><br>${C.GACHA_RATE.map(([st, pc]) => `☆${st}：${pc}%`).join('　')}<br><small>☆5は今月のピックアップの${esc(U.who)}だけ。<br>このスカウトで${C.GACHA_PITY}回引くと、${esc(U.who)}が確定（出たら数え直し）。<br>10回スカウトは、☆3以上が1人確定。</small>`, [{ label: 'とじる', value: true }], 'sec');
      box.querySelectorAll('.gc2-btn').forEach((b) => b.onclick = async () => {
        const n = +b.dataset.n, res = C.gachaPull(save, n);
        if (!res) { coachAsk('コインが足りません。<br>カップ戦で勝つと、コインがもらえますよ。', [{ label: 'OK', value: true }], 'sec'); return; }
        store(); await gachaShow(el, res); draw();
      });
    };
    draw(); el.hidden = false; el._fit();
  }
  // 引いた時の演出：光の玉が落ちてきて（いちばん良い☆の色）→ カードが1枚ずつめくれる → 凸の選手は☆の色が変わる
  // 版554：スカウトの演出（抽選はもう終わっている。結果に合わせて見せるだけ）
  //  ☆1〜3＝青いカード／☆4＝金色に光って粒が広がる／☆5＝暗転→赤い稲妻→カットイン→登場
  //  昇格：青いカードが開く直前に割れて、金色（☆4）か赤色（☆5）に変わる
  //  10回：ふつうの選手はテンポよくめくり、☆4・☆5だけ真ん中で大きく見せる。最後に10人の一覧。いつでも「スキップ」
  function gachaShow(el, res) {
    return new Promise((done) => {
      const rs = res.results, one = rs.length === 1, box = el.querySelector('.lk-box');
      const ov = document.createElement('div'); ov.className = 'gcs gx'; box.appendChild(ov);
      let skip = false, finished = false; const timers = new Set();
      const wait = (ms) => new Promise((ok) => { if (skip) { ok(); return; } const t = setTimeout(() => { timers.delete(t); ok(); }, ms); timers.add(t); waiters.add(ok); });
      const waiters = new Set();
      const doSkip = () => { if (skip) return; skip = true; timers.forEach(clearTimeout); timers.clear(); waiters.forEach((f) => f()); waiters.clear(); };
      const tierOf = (r) => (r.star >= 5 ? 'red' : r.star >= 4 ? 'gold' : 'blue');
      // 昇格するか：☆5は半分、☆4は3枚に1枚くらい（結果は変わらない。見せ方だけ）
      const promo = rs.map((r) => (r.star >= 5 ? Math.random() < 0.5 : r.star >= 4 ? Math.random() < 0.35 : false));
      const badgeOf = (r) => (r.kind === 'new' ? (r.reserve ? '<em class="b-res">NEW・リザーブへ</em>' : '<em class="b-new">NEW</em>') : r.kind === 'totsu' ? `<em class="b-tz">凸UP ${r.from}→${r.to}</em>` : r.kind === 'auto' ? `<em class="b-auto">放出・カケラ +${r.kakera}</em>` : `<em class="b-kk">カケラ +${r.kakera}</em>`);
      const faceHTML = (r) => { const tz = r.kind === 'totsu' ? r.to : r.p ? r.p.totsu || 0 : 0; return `${gcFace(r.tid, r.q, 'gcc-face')}<div class="gcc-st">${starHTML(r.star, tz)}</div><b>${esc(r.q.name)}</b><small>${esc(gcTeamShort(r.tid))}・${esc(r.q.pos)}</small>${badgeOf(r)}`; };
      const cardHTML = (r, i, back) => `<div class="gx-c s${r.star}" data-i="${i}"><div class="gx-in"><div class="gx-b ${back}"><i class="gx-crk"></i></div><div class="gx-f">${faceHTML(r)}</div></div></div>`;
      const burst = (host, n, col) => { const w = document.createElement('div'); w.className = 'gx-burst'; w.style.setProperty('--pc', col); let h = ''; for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260; h += `<i style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;--s:${(0.5 + Math.random()).toFixed(2)};animation-delay:${(Math.random() * 0.12).toFixed(2)}s"></i>`; } w.innerHTML = h; host.appendChild(w); setTimeout(() => w.remove(), 1400); };
      const skipBtn = () => { const b = document.createElement('button'); b.className = 'gx-skip'; b.textContent = 'スキップ ▶▶'; b.onclick = (e) => { e.stopPropagation(); doSkip(); }; ov.appendChild(b); };
      // 1枚を大きく見せる（☆4・☆5・1回スカウト）
      async function feature(r, i) {
        const tier = tierOf(r), pr = promo[i];
        const st = document.createElement('div'); st.className = 'gx-stage'; ov.appendChild(st);
        st.innerHTML = cardHTML(r, i, pr || tier === 'blue' ? 'blue' : tier);
        const c = st.querySelector('.gx-c'); requestAnimationFrame(() => c.classList.add('in'));
        await wait(650);
        if (pr) {   // 昇格：割れて色が変わる
          c.classList.add('shake'); await wait(420);
          c.classList.add('crack'); SND2('reveal'); await wait(380);
          const b = c.querySelector('.gx-b'); b.className = 'gx-b ' + tier + ' up'; c.classList.remove('shake', 'crack'); SND2(tier === 'red' ? 'gachaRare' : 'reveal5');
          st.classList.add('flash-' + tier); await wait(700);
        } else if (tier !== 'blue') { await wait(250); }
        if (tier === 'red') {   // 最強：暗転→赤い稲妻→カットイン
          const fx = document.createElement('div'); fx.className = 'gx-dark'; fx.innerHTML = `<svg class="gx-bolt" viewBox="0 0 1280 720" preserveAspectRatio="none"><polyline points="760,-10 640,250 720,260 560,520 650,530 500,740"/><polyline class="b2" points="980,-10 900,180 950,190 840,420"/><polyline class="b2" points="300,-10 380,200 330,210 420,460"/></svg>`;
          ov.appendChild(fx); await wait(500); fx.classList.add('hit'); SND2('gachaRare'); await wait(900);
          const U = (C.gachaBanner().key && r.q.uniq && window.DotSoccer.UNIQ[r.q.uniq]) || null;
          const ci = document.createElement('div'); ci.className = 'gx-cut'; ci.innerHTML = `<div class="gx-cut-band"></div><div class="gx-cut-fc">${gcFace(r.tid, r.q, 'gx-cut-face')}</div><div class="gx-cut-tx"><i>★★★★★</i><b>${esc(r.q.name)}</b>${U ? `<em>${esc(U.name)}</em>` : ''}</div>`;
          ov.appendChild(ci); await wait(1700); ci.classList.add('out'); fx.classList.add('out'); await wait(350); ci.remove(); fx.remove();
        }
        c.classList.add('open'); SND2(tier === 'blue' ? 'reveal' : 'reveal5');
        if (tier !== 'blue') { await wait(260); burst(st, tier === 'red' ? 46 : 32, tier === 'red' ? '#ff5a3a' : '#ffd23a'); st.classList.add('glow-' + tier); }
        await wait(tier === 'blue' ? 700 : 1500);
        st.classList.add('out'); await wait(250); st.remove();
      }
      function finalList() {
        if (finished) return; finished = true; timers.forEach(clearTimeout);
        ov.innerHTML = `<div class="gcs-grid${one ? ' one' : ''}">${rs.map((r, i) => `<div class="gcc s${r.star}" style="--d:0s"><div class="gcc-in done"><div class="gcc-b"></div><div class="gcc-f">${faceHTML(r)}</div></div></div>`).join('')}</div><p class="gx-ttl">${one ? '' : `獲得した${rs.length}人`}</p><button class="gcs-ok primary">OK</button>`;
        ov.onclick = null; ov.querySelector('.gcs-ok').onclick = (e) => { e.stopPropagation(); totsuShow(0); };
      }
      // 凸の演出（今まで通り）
      const ups = rs.filter((r) => r.kind === 'totsu');
      const totsuShow = (k) => {
        if (k >= ups.length) { ov.remove(); done(); return; }
        const r = ups[k];
        ov.innerHTML = `<div class="gct"><div class="gct-card s${r.star}">${gcFace(r.tid, r.q, 'gct-face')}<b>${esc(r.q.name)}</b><div class="gct-st">${starHTML(r.star, r.from)}</div><p>凸UP！　${r.from}凸 → <span class="tz${r.to}">${r.to}凸</span>${r.to >= 3 ? '　<b class="gct-max">完凸</b>' : ''}</p></div><p class="gcs-tap">タップで次へ</p></div>`;
        const tl = []; [...ov.querySelectorAll('.gct-st .tz')].forEach((stz, i) => tl.push(setTimeout(() => { stz.className = 'tz tz' + r.to + ' pop'; SND2('reveal'); }, 500 + i * 220)));
        ov.onclick = () => { tl.forEach(clearTimeout); totsuShow(k + 1); };
      };
      (async () => {
        // 光の玉：いちばん良い色で落ちる（昇格がある時は青のまま＝わからない）
        const bestTier = rs.some((r, i) => r.star >= 5 && !promo[i]) ? 'r5' : rs.some((r, i) => r.star >= 4 && !promo[i]) ? 'r4' : 'r1';
        ov.innerHTML = `<div class="gcs-orb ${bestTier}"><i></i></div>`; skipBtn();
        SND2(bestTier !== 'r1' ? 'gachaRare' : 'gachaOrb');
        await wait(1500);
        if (one) { ov.querySelector('.gcs-orb') && ov.querySelector('.gcs-orb').remove(); await feature(rs[0], 0); }
        else {
          ov.insertAdjacentHTML('beforeend', `<div class="gx-grid">${rs.map((r, i) => cardHTML(r, i, 'blue')).join('')}</div>`);
          const orb = ov.querySelector('.gcs-orb'); if (orb) orb.remove();
          const cs = [...ov.querySelectorAll('.gx-grid .gx-c')];
          cs.forEach((c, i) => setTimeout(() => c.classList.add('in'), i * 40)); await wait(500);
          for (let i = 0; i < rs.length && !skip; i++) {
            const r = rs[i];
            if (r.star >= 4) { cs[i].classList.add('wait'); await feature(r, i); cs[i].querySelector('.gx-b').className = 'gx-b ' + tierOf(r); cs[i].classList.add('open', 'glow-' + tierOf(r)); }
            else { cs[i].classList.add('open'); SND2('reveal'); await wait(160); }
          }
          await wait(600);
        }
        finalList();
      })();
    });
  }
  // ================= ショップ =================
  // 版526：ショップ（監督のデザイン案3枚：おすすめ／特訓カード／プレミアムパス）。案の絵を下地にして、数字・ピックアップ・カードは中身に合わせて描く
  const SH_CATS = [['all', 'すべて'], ['tact', '戦術'], ['tech', 'テクニック'], ['phys', 'フィジカル'], ['sup', 'サポート']];
  const SCOUT_ART = {};   // 版543：スカウト画面の大きな絵（監督の素材）。ない選手は顔の絵
  const SH_PICK_ART = { guren: 'img/pick_guren_542.jpg' };   // 版542：ピックアップの絵がある選手は、その絵を使う（ない選手は顔の絵）
  const SH_CATCOL = { tact: '#1f9a45', tech: '#d81e1e', phys: '#2f6fd6', sup: '#d4a017' };
  let shopSt = { tab: 'rec', cat: 'tact', sel: null, qty: 1 };
  // 版564：カードパックを開ける演出 — パックが落ちてくる → タップで破れて光る → カードが飛び出して並ぶ → 1枚ずつめくる → まとめ
  function openPack(got, before, big) {
    const el = fullScreen('packScreen', 'pk-wrap'), box = el.querySelector('.lk-box');
    box.classList.remove('opened', 'spread', 'wait');   // 版565：前に開けた時の状態が残っていて、2回目からパックが出なかった
    const n = got.length, cols = big ? 6 : 5, rows = Math.ceil(n / cols), CW = big ? 150 : 176, CH = Math.round(CW * 1.33), GX = big ? 22 : 26, GY = 20;
    const x0 = 640 - (cols * CW + (cols - 1) * GX) / 2, y0 = (big ? 330 : 360) - (rows * CH + (rows - 1) * GY) / 2;
    const seen = {}, items = got.map((k, i) => { const isNew = !(before[k] > 0) && !seen[k]; seen[k] = 1; return { k, i, isNew, x: x0 + (i % cols) * (CW + GX), y: y0 + Math.floor(i / cols) * (CH + GY) }; });
    const grp = {}; got.forEach((k) => grp[k] = (grp[k] || 0) + 1);
    const sum = Object.entries(grp).map(([k, c]) => `<span style="--cc:${SH_CATCOL[C.CARDS[k].cat]}"><b>${esc(C.CARDS[k].name)}</b>×${c}<small>所持 ${before[k] || 0}→${save.cards[k]}</small></span>`).join('');
    box.innerHTML = `<div class="pk-bg"><i class="pk-rays"></i></div>
      <p class="pk-ttl">${big ? 'カードパック（大）' : 'カードパック'}</p>
      <div class="pk-pack${big ? ' gold' : ''}"><div class="pk-top"></div><div class="pk-body"><b>CARD<br>PACK</b><i class="pk-ball">⚽</i><em>${n}枚入り</em></div><i class="pk-shine"></i></div>
      <p class="pk-tap">タップして開ける</p><div class="pk-flash"></div>
      <div class="pk-cards">${items.map((it) => `<div class="pk-c" data-i="${it.i}" style="--x:${it.x}px;--y:${it.y}px;width:${CW}px;height:${CH}px;--cc:${SH_CATCOL[C.CARDS[it.k].cat]}"><div class="pk-in"><div class="pk-back"><i>D</i></div><div class="pk-front"><img src="cards/${it.k}.jpg" alt="${esc(C.CARDS[it.k].name)}">${it.isNew ? '<em>NEW</em>' : ''}</div></div></div>`).join('')}</div>
      <div class="pk-sum" hidden><div class="pk-sl">${sum}</div><button class="pk-ok ib ib-ok ib-img">OK</button></div>
      <button class="pk-skip">スキップ ▶▶</button>`;
    // カードの絵を先に読んでおく
    got.forEach((k) => { const im = new Image(); im.src = `cards/${k}.jpg`; });
    el.hidden = false; el._fit();
    const S = (nm) => { try { DotSound.play(nm); } catch (_) {} };
    const cs = [...box.querySelectorAll('.pk-c')], timers = [];
    const later = (ms, f) => timers.push(setTimeout(f, ms));
    return new Promise((done) => {
      let stage = 0;   // 0：パック 1：開けている 2：まとめ
      const finish = () => { if (stage === 2) return; stage = 2; timers.forEach(clearTimeout); box.classList.add('opened', 'spread'); cs.forEach((c) => c.classList.add('out', 'flip')); box.querySelector('.pk-sum').hidden = false; box.querySelector('.pk-skip').hidden = true; box.querySelector('.pk-ttl').textContent = `手に入れたカード（${n}枚）`; S('ok'); };
      const open = () => {
        if (stage) return; stage = 1; S('tap');
        box.classList.add('opened'); S('gachaOrb');
        later(450, () => { box.classList.add('spread'); cs.forEach((c, i) => later(i * 55, () => c.classList.add('out'))); });
        const t0 = 450 + n * 55 + 450;
        cs.forEach((c, i) => later(t0 + i * (big ? 150 : 210), () => { c.classList.add('flip'); S(c.querySelector('.pk-front em') ? 'reveal5' : 'reveal'); }));
        later(t0 + n * (big ? 150 : 210) + 500, finish);
      };
      box.onclick = () => { if (!stage) open(); };   // 版566：画面のどこをさわっても開ける
      box.querySelector('.pk-skip').onclick = (e) => { e.stopPropagation(); if (!stage) { stage = 1; box.classList.add('opened'); } finish(); };
      box.querySelector('.pk-ok').onclick = (e) => { e.stopPropagation(); box.onclick = null; el.hidden = true; box.innerHTML = ''; done(); };
      later(1300, () => { if (!stage) box.classList.add('wait'); });
    });
  }
  function shop(tab) {
    const el = fullScreen('shopScreen', 'std-wrap sh3-wrap'), box = el.querySelector('.lk-box');
    if (tab) shopSt.tab = tab;
    const toast = (msg) => { const t = document.createElement('p'); t.className = 'sh3-toast'; t.innerHTML = msg; box.appendChild(t); setTimeout(() => t.classList.add('out'), 1600); setTimeout(() => t.remove(), 2200); };
    const coins = () => (save.coins || 0).toLocaleString();
    const hit = (cls, x, y, w, h, attr, title) => `<button class="sh3-hit ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" ${attr || ''} title="${title || ''}"></button>`;
    const price = (c) => (C.CARDS[c].cat === 'sup' ? C.PRICE.sup : C.PRICE.card);
    const effText = (c) => { const cd = C.CARDS[c]; return `${Object.entries(cd.up).map(([k, v]) => `${C.PNAME[k]}+${v}`).join('・')}${cd.fat ? `（疲労${cd.fat > 0 ? '+' : ''}${cd.fat}）` : ''}`; };
    const draw = () => {
      const S = shopSt; let h = '';
      // 版527：3つの画面で、上の帯（もどる・ショップ・コイン）とタブを同じ形に（監督の4枚目の絵）
      const head = `<span class="sh3-coin">${coins()}<small>コイン</small></span>${hit('', 34, 12, 72, 70, 'data-go="back"', 'もどる')}
        <div class="sh3-tabs">${[['rec', 'おすすめ'], ['cards', '特訓カード'], ['prem', 'プレミアムパス']].map(([k, l]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      if (S.tab === 'rec') {
        const bn = C.gachaBanner(), U = bn.uniq, q = C.rosterAt(bn.tid, 1).players.find((x) => x.no === bn.no), cc = U.chip || ['#c8141e', '#ffd23a', '#ffe45a'];
        h = `<div class="sh3 sh3-rec"><img class="sh3-bgimg" src="img/shop_rec.jpg" alt="">${head}
          <button class="sh3-ban" data-go="scout" style="--c0:${cc[0]}"><div class="sh3-ban-bg"></div>${SH_PICK_ART[bn.key] ? `<img class="sh3-ban-art" src="${SH_PICK_ART[bn.key]}" alt="">` : ''}<div class="sh3-ban-fc"${SH_PICK_ART[bn.key] ? ' hidden' : ''}><i class="sh3-ban-glow"></i>${(() => { const k = C.faceKeyOf(bn.tid, q), sh = ((C.ROSTERS[bn.tid] || {}).kit || {}).shirt || '#2f6fd6'; return k ? starPic(k, sh, q.pos === 'GK', 'sh3-ban-face') : ''; })()}</div>
            <i class="sh3-ban-rib">今月のピックアップ</i><b class="sh3-ban-nm" style="font-size:${Math.min(96, Math.round(360 / Math.max(3, U.who.length)))}px">${esc(U.who)}</b><em class="sh3-ban-sk">${esc(U.name)}</em>
            <span class="sh3-ban-go">スカウトを見る<span>›</span></span></button>
          ${hit('', 843, 142, 391, 270, 'data-tab="prem"', 'プレミアムパス')}
          ${hit('sh3-area', 46, 419, 586, 206, 'data-ask="5"', 'カードパック')}${hit('sh3-area', 640, 419, 594, 206, 'data-ask="12"', 'カードパック（大）')}
          ${hit('', 63, 571, 198, 42, 'data-info="5"', 'パック内容を見る')}${hit('sh3-buy', 351, 553, 262, 64, 'data-pack="5"', 'カードパックを買う')}
          ${hit('', 646, 571, 196, 42, 'data-info="12"', 'パック内容を見る')}${hit('sh3-buy', 977, 553, 236, 64, 'data-pack="12"', 'カードパック（大）を買う')}
          ${hit('', 46, 631, 1188, 66, 'data-tab="cards"', '特訓カードを1枚ずつ選ぶ')}</div>`;
      } else if (S.tab === 'prem') {
        h = `<div class="sh3 sh3-prem"><img class="sh3-bgimg" src="img/shop_prem.jpg" alt="">${head}${hit('', 44, 140, 1192, 560, 'data-soon="1"', 'プレミアムパス（近日公開）')}</div>`;
      } else {
        const list = Object.keys(C.CARDS).filter((c) => S.cat === 'all' || C.CARDS[c].cat === S.cat);
        if (!S.sel || !list.includes(S.sel)) { S.sel = list[0]; S.qty = 1; }
        const room = Math.max(0, C.CARD_MAX - ((save.cards || {})[S.sel] || 0)); if (S.qty > Math.max(1, room)) S.qty = Math.max(1, room);   // 版562：持てるのは99枚まで
        const c = S.sel, cd = C.CARDS[c], pr = price(c), tot = pr * S.qty, lack = Math.max(0, tot - (save.coins || 0));
        h = `<div class="sh3 sh3-cards"><img class="sh3-bgimg" src="img/shop_cards.jpg" alt="">${head}
          <div class="sh3-sub">${SH_CATS.map(([k, l]) => `<button data-cat="${k}" class="${S.cat === k ? 'on' : ''}" style="--cc:${SH_CATCOL[k] || '#ee5a12'}">${l}</button>`).join('')}</div>
          <div class="sh3-grid">${list.map((k) => { const d = C.CARDS[k]; return `<button class="sh3-card${k === c ? ' on' : ''}" data-c="${k}" style="--cc:${SH_CATCOL[d.cat]}"><img src="cards/${k}.jpg" alt="${esc(d.name)}" draggable="false"><span class="sh3-cf"><small>所持 ${save.cards[k] || 0}枚</small><em>${COIN}${price(k)}</em></span></button>`; }).join('')}</div>
          <div class="sh3-det"><h3>${esc(cd.name)}</h3><div class="sh3-dr"><img src="cards/${c}.jpg" alt="" style="border-color:${SH_CATCOL[cd.cat]}"><p class="sh3-eff">${esc(effText(c))}</p></div>
            <div class="sh3-one">1枚 ${COIN}<b>${pr}</b><small>コイン</small></div>
            <div class="sh3-qty"><button data-q="-1" class="m"${S.qty <= 1 ? ' disabled' : ''}>−</button><span>${S.qty}</span><button data-q="1" class="p"${S.qty >= Math.min(99, room) ? ' disabled' : ''}>＋</button></div>
            <div class="sh3-tot">合計<span>${COIN}<b>${tot}</b><small>コイン</small></span></div>
            <button class="sh3-go"${lack || !room ? ' disabled' : ''}>${room ? '購入する' : '上限（99枚）'}</button><p class="sh3-lack">${!room ? 'もう99枚持っているので買えません' : lack ? `あと <b>${lack}</b> コイン必要` : ''}</p>
            <button class="sh3-pk" data-tab="rec">まとめ買いならカードパックへ <span>→</span></button></div></div>`;
      }
      box.innerHTML = h;
      box.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { shopSt.tab = b.dataset.tab; draw(); });
      box.querySelectorAll('[data-go="back"]').forEach((b) => b.onclick = () => { el.hidden = true; renderHome(); });
      box.querySelectorAll('[data-go="scout"]').forEach((b) => b.onclick = () => { el.hidden = true; openGacha(); });
      box.querySelectorAll('[data-soon]').forEach((b) => b.onclick = () => toast('プレミアムパスは近日公開です'));
      box.querySelectorAll('[data-info]').forEach((b) => b.onclick = () => coachAsk(`<b>カードパック${b.dataset.info === '12' ? '（大）' : ''}</b><br>特訓カード（戦術・テクニック・フィジカル・サポート）から<br>ランダムで <b>${b.dataset.info}枚</b> 入っています。<br><small>1枚ずつ買うより、1枚あたりがお得です。</small>`, [{ label: 'とじる', value: true }], 'sec'));
      // 版564：カードパックは、必ず確認してから買う → 開ける演出 → 手に入れたカードを全部見せる（黄色いボタンでも、すぐには買わない）
      const packFlow = async (n) => { const big = n >= 12, pr = big ? C.PRICE.pack12 : C.PRICE.pack5;
        if ((save.coins || 0) < pr) { coachAsk(`コインが足りません。<br><small>カードパック${big ? '（大）' : ''}は <b>${pr}</b> コインです（いま ${coins()} コイン）。</small>`, [{ label: 'OK', value: true }]); return; }
        if (!(await coachAsk(`<b>カードパック${big ? '（大）' : ''}</b>（特訓カード ${n}枚）を<br><b>${pr}</b> コインで買いますか？<br><small>いま ${coins()} コイン → 買ったあと ${((save.coins || 0) - pr).toLocaleString()} コイン</small>`, [{ label: '買う', value: true }, { label: 'やめる', value: false }]))) return;
        const before = { ...(save.cards || {}) }, got = C.buyPack(save, n); if (!got) return; store(); draw();
        await openPack(got, before, big); draw(); };
      box.querySelectorAll('[data-ask]').forEach((b) => b.onclick = () => packFlow(+b.dataset.ask));
      box.querySelectorAll('[data-pack]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); packFlow(+b.dataset.pack); });
      box.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => { shopSt.cat = b.dataset.cat; shopSt.sel = null; draw(); });
      box.querySelectorAll('.sh3-card').forEach((b) => b.onclick = () => { if (shopSt.sel !== b.dataset.c) shopSt.qty = 1; shopSt.sel = b.dataset.c; const g = box.querySelector('.sh3-grid'), st = g ? g.scrollTop : 0; draw(); const g2 = box.querySelector('.sh3-grid'); if (g2) g2.scrollTop = st; });
      box.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { shopSt.qty = Math.max(1, Math.min(99, shopSt.qty + +b.dataset.q)); const g = box.querySelector('.sh3-grid'), st = g ? g.scrollTop : 0; draw(); const g2 = box.querySelector('.sh3-grid'); if (g2) g2.scrollTop = st; });
      { const go = box.querySelector('.sh3-go'); if (go) go.onclick = () => { const c = shopSt.sel, had = (save.cards || {})[c] || 0, coin0 = save.coins || 0; let n = 0; for (let k = 0; k < shopSt.qty; k++) { if (C.buyCard(save, c)) n++; else break; } store(); const g = box.querySelector('.sh3-grid'), st = g ? g.scrollTop : 0; shopSt.qty = 1; draw(); const g2 = box.querySelector('.sh3-grid'); if (g2) g2.scrollTop = st; try { DotSound.play(n ? 'ok' : 'back'); } catch (_) {} toast(n ? `<img class="sh3-tc" src="cards/${c}.jpg" alt=""><span><b>${esc(C.CARDS[c].name)}</b> を ${n}枚 買いました！<br><small>所持 ${had}枚 → <em>${save.cards[c]}枚</em>　／　コイン ${coin0.toLocaleString()} → ${(save.coins || 0).toLocaleString()}</small></span>` : had >= C.CARD_MAX ? 'もう99枚持っているので買えません' : 'コインが足りません'); }; }   // 版562：買えたことが分かるように、枚数とコインの変化を見せる
      { const bg = box.querySelector('.sh3-ban-bg'); if (bg) { const bn = C.gachaBanner(); gcBgFor(bn.uniq.chip, (u) => { bg.style.backgroundImage = `url(${u})`; }); } }
    };
    draw(); el.hidden = false; el._fit();
  }

  let clubAsked = false;
  function open() {
    ensure(); A().stop(); A().showScreen('career'); go('home');
    if (window.__tut && window.__tut.boot(save)) return;   // はじめて遊ぶ人：チュートリアル（クラブ作りもその中で）
    if (!save.clubSet && !clubAsked && (save.week || 1) <= 1 && save.season === 1) { clubAsked = true; openClub({ first: true, onDone: () => go('home') }); }   // はじめて：クラブを作る
    if (save.migratedWorld) { delete save.migratedWorld; store(); modal('<h2>リーグが新しくなりました</h2><p>地域2部（東・西）→ 地域1部（東・西）→ D3 → D2 → D1 の7リーグになりました。選手はそのままで、<b>地域2部リーグ西</b>の開幕（3月1週）からのスタートです。</p>', [{ label: 'OK', primary: true }]); }
  }
  $('#goCareer').onclick = open;
  // 確認画面用：次の公式戦を、試合前の画面を飛ばしてそのまま観る（結果は記録しない）
  function labMatch(full) { const fx = C.nextFixture(save); if (!fx) return false; runMatch('試合の日！', '', fx.opp, full ? (score, ev, played) => officialDone(fx, score, ev, played) : () => {}, { comp: fx.comp, label: fx.label, home: !!fx.home, skipPre: true }); return true; }
  // 試合中のパネル（得点・交代・カード）に出す顔写真：CPUの選手は専用・モブの顔、自分のクラブの選手はその選手の顔
  function matchFace(info, shirt) {
    if (!info) return null;
    if (info.faceKey) return starFace(info.faceKey, shirt, !!info.gk || info.position === 'GK');
    if (info.cpuTid && info.cpuNo != null) { const mk = mobKey(info.cpuTid, { no: info.cpuNo }); if (mk) return starFace(mk, shirt, !!info.gk || info.position === 'GK'); }   // CPUのモブ選手：共有の顔（ユニフォームの色を塗り替え）
    const mine = save && save.team && save.team.players.find((q) => q.name === info.name && (q.number == null || info.number == null || q.number === info.number));
    return mine ? faceURL(mine) : null;
  }
  function townRect(key) {   // ホームの建物（名前の札と建物の絵）が画面のどこにあるか（チュートリアルで光らせる）
    const hs = (hot && hot.length ? hot : townHot).filter((h) => h.go === key); if (!hs.length) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const h of hs) { x0 = Math.min(x0, h.r.x); y0 = Math.min(y0, h.r.y); x1 = Math.max(x1, h.r.x + h.r.w); y1 = Math.max(y1, h.r.y + h.r.h); }
    const rc = hc.getBoundingClientRect(), sc = Math.max(rc.width / 1280, rc.height / 720), ox = rc.left + (rc.width - 1280 * sc) / 2, oy = rc.top + (rc.height - 720 * sc) / 2;
    return { left: ox + x0 * sc, top: oy + y0 * sc, width: (x1 - x0) * sc, height: (y1 - y0) * sc };
  }
  function tutPractice(onDone) {   // チュートリアルの練習試合：同じ地域リーグの相手と（練習試合と同じ扱い）
    const list = C.practiceOptions(save), t = list.find((x) => !x.strong) || list[0]; if (!t) return false;
    const op = { ...C.findTeam(save, t.name), lg: t.lg };
    runMatch('練習試合', '', op, (score, ev, played) => { const got = C.playPractice(save, score, played); afterRound(got, { practice: true }); if (onDone) onDone(); }, { comp: '練習試合', label: '', home: true, practice: true, tut: 'practice' });
    return true;
  }
  window.__career = { faceFill: () => faceFill(), openGacha, venueTalk: (se) => venueTalk(se), matchFace, openOffice, cpuCard, openClub, openAssoc, open, go, stadium, advance, subSheet, labMatch, townRect, tutPractice, shop, store: () => store(), renderHome: () => renderHome(), clubhouseBg: () => clubhouseBg(), isMatchWeek: () => isMatchWeek(), get view() { return view; }, staffFace: (k) => staffFace(k), get save() { return save; }, get drill() { return clubDrill; }, faceURL, starFace, setDrill(d) { clubDrill = d; drillT0 = -1; drillSnap = true; } };
})();

// ===== 画面の器：論理サイズで組んで、端末に合わせて拡大縮小（PC・スマホ横画面共通） =====
(function () {
  const $ = (q) => document.querySelector(q);
  const html = document.documentElement, app = $('#app');
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (touch) html.classList.add('touch');
  html.classList.add('stage');
  // 端の切り欠き（iPhoneのノッチ）ぶんを避ける
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  // スマホのアプリの中（Claudeの画面の中）で開くと、画面の上の帯がアプリのボタンに重なってさわれない：
  // その分だけ上を空けて、ゲームを下にずらす（メニューで切り替え可）
  const inFrame = (() => { try { return window.self !== window.top; } catch (_) { return true; } })();
  let topGap = 0;
  try { const v = localStorage.getItem('dotTopGap'); topGap = v == null ? (touch && inFrame ? 1 : 0) : +v; } catch (_) { topGap = touch && inFrame ? 1 : 0; }
  function fit() {
    const vv = window.visualViewport;
    const standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches));
    const vw = Math.round(vv ? vv.width : innerWidth), vh = Math.round(standalone ? Math.max(innerHeight, vv ? vv.height : 0, document.documentElement.clientHeight || 0) : (vv ? vv.height : innerHeight));   // 版484：ホーム画面アプリでは、iPhoneが高さを小さく返すことがある（下が白く空く）ので大きい方を使う
    const portrait = touch && vh > vw;
    html.classList.toggle('portrait', portrait);
    if (portrait) return;
    const cs = getComputedStyle(probe);
    const sl = parseFloat(cs.paddingLeft) || 0, sr = parseFloat(cs.paddingRight) || 0, sb = parseFloat(cs.paddingBottom) || 0, st = parseFloat(cs.paddingTop) || 0;
    const tg = document.fullscreenElement ? 0 : topGap ? Math.max(st, 52) : 0;   // 上を空ける分（全画面の時は空けない）
    const aw = vw - sl - sr, ah = vh - tg;   // 版495：上下には余白を作らない（緑の帯は左右だけ）
    const small = Math.min(vw, vh) <= 600;
    // スマホは高さ520相当、PCは720相当で組む（PCは大きな画面でも1.35倍まで）
    let s = small ? Math.min(ah / 520, aw / 960) : Math.min(ah / 720, aw / 1100, 1.35);
    s = Math.max(0.3, s);
    // 横に長すぎる画面（ブラウザのバーで高さが減ったときなど）は、本家のように左右に帯を出して、絵が切れないようにする
    const lh = ah / s, lw = Math.min(aw / s, lh * 2.0);
    app.style.width = lw + 'px'; app.style.height = lh + 'px';
    app.style.left = (sl + (aw - lw * s) / 2) + 'px'; app.style.top = tg + 'px'; app.style.transform = `scale(${s})`;
    html.style.setProperty('--lh', lh + 'px');
    html.classList.toggle('short', lh < 640);
    html.classList.toggle('phone', touch && Math.min(screen.width || 9999, screen.height || 9999) <= 540);   // 版487：スマホ（画面の短い辺が540以下）
  }
  let raf = 0;
  let synth = false;
  const refit = () => { if (synth) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { fit(); window.dispatchEvent(new Event('stagefit')); }); };
  fit();
  [200, 700, 1500].forEach((ms) => setTimeout(refit, ms)); addEventListener('pageshow', refit);   // 版484：起動直後に高さが変わることがあるので、少しあとにも合わせ直す
  addEventListener('resize', refit); addEventListener('orientationchange', () => setTimeout(refit, 250));
  if (window.visualViewport) visualViewport.addEventListener('resize', refit);
  // 試合画面のキャンバスは器の大きさが変わったら描き直す
  addEventListener('stagefit', () => { synth = true; window.dispatchEvent(new Event('resize')); synth = false; });
  // ヘッダーの代わりの「メニュー」
  const sheet = $('#mSheet');
  const fsOk = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  if (!fsOk) $('#mFull').hidden = true;
  if (!inFrame && $('#mTab')) $('#mTab').hidden = true;
  window.__openMenu = () => $('#mMenu').onclick();
  const sndLabel = () => { const P = window.DotSound ? DotSound.pref : { sfx: true, bgm: true }; if ($('#mSfx')) $('#mSfx').textContent = '効果音：' + (P.sfx ? 'オン' : 'オフ'); if ($('#mBgm')) $('#mBgm').textContent = 'BGM：' + (P.bgm ? 'オン' : 'オフ'); };
  $('#mMenu').onclick = () => { sndLabel(); $('#mFull').textContent = document.fullscreenElement ? '全画面をやめる' : '全画面にする'; if ($('#mGap')) $('#mGap').textContent = topGap ? '画面の上を空けない（上までゲームを広げる）' : '画面の上を空ける（上がさわれない時）'; sheet.hidden = false; };
  addEventListener('fullscreenchange', refit); addEventListener('webkitfullscreenchange', refit);
  sheet.addEventListener('click', async (e) => {
    const m = e.target.dataset && e.target.dataset.m;
    if (e.target === sheet) { sheet.hidden = true; return; }
    if (!m) return;
    sheet.hidden = true;
    if (m === 'career') window.__career.open();
    else if (m === 'free') $('#newGame').click();
    else if (m === 'testcoin') { const sv = window.__career.save; sv.coins = (sv.coins || 0) + 10000; window.__career.store(); sheet.hidden = true; try { window.__career.renderHome(); } catch (_) {} return; }   // 版552：演出のテスト用
    else if (m === 'tut') { if (window.__tut) { const of = $('#officeScreen'); if (of) { of.hidden = true; go('home'); } if ($('#career').hidden) window.__career.open(); setTimeout(() => window.__tut.replay(), 300); } }
    else if (m === 'sfx' || m === 'bgm') { if (window.DotSound) DotSound.set(m, !DotSound.pref[m]); sndLabel(); sheet.hidden = false; return; }
    else if (m === 'gap') { topGap = topGap ? 0 : 1; try { localStorage.setItem('dotTopGap', String(topGap)); } catch (_) {} refit(); }
    else if (m === 'tab') { try { window.open(location.href, '_blank'); } catch (_) {} }
    else if (m === 'fs') {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else { const el = document.documentElement; await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen());
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }
      } catch (_) { /* 使えない端末では何もしない */ }
    }
  });
  // 試合中はメニューを隠す（結果画面や育成で出す）
  // メニューはホーム・フリー試合の設定・結果画面だけに出す（試合中やクラブハウスの中では出さない）
  const mm = $('#mMenu'), mt = $('#match'), club = $('#cv-club'), car = $('#career');
  const upd = () => { mm.hidden = true; };   /* 版470：右上のメニューはなし（クラブ事務所の「設定」から） */
  const mo = new MutationObserver(upd);
  for (const el of [mt, club, car]) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] });
  // 開いたらいきなり育成ホーム
  window.__career.open(); upd();
})();

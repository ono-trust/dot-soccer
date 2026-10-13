// はじめて遊ぶ人のためのチュートリアル（本家カルチョビットAの最初の流れを参考に、このゲームの仕組みで案内する）
// 秘書とコーチが話しかけ、押してほしい所だけを光らせる。進み具合はセーブ（save.tut）に残す
(() => {
  'use strict';
  const $ = (q) => document.querySelector(q);
  const K = () => window.__career, A = () => window.__app;
  const LAB = /lab\.html/.test(location.pathname);   // 確認ページでは出さない
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const WHO = { sec: { name: '秘書', img: 'staff/secretary.png' }, coach: { name: 'コーチ', img: 'staff/coach.png' } };

  // ---------- 画面の上にかぶせる層 ----------
  let root = null;
  function ensureRoot() {
    if (root && root.isConnected) return root;
    root = document.createElement('div'); root.id = 'tut'; root.hidden = true;
    root.innerHTML = `<div class="tt-shade"></div><div class="tt-hole"></div>
      <svg class="tt-arrow" viewBox="0 0 64 64" aria-hidden="true"><path d="M22 4h20v26h14L32 60 8 30h14z" fill="#ffe23a" stroke="#3a2a00" stroke-width="4" stroke-linejoin="round"/></svg>
      <div class="tt-big"></div>
      <div class="tt-box"><div class="tt-face"><img alt=""></div><div class="tt-win"><div class="tt-name"></div><div class="tt-text"></div><div class="tt-ui"></div><i class="tt-next"></i></div></div>`;
    (document.getElementById('app') || document.body).appendChild(root);
    return root;
  }
  const appEl = () => document.getElementById('app');
  const scale = () => { const a = appEl(); return a.getBoundingClientRect().width / (a.offsetWidth || 1); };
  function local(r) { const a = appEl().getBoundingClientRect(), s = scale(); return { x: (r.left - a.left) / s, y: (r.top - a.top) / s, w: r.width / s, h: r.height / s, sx: r.left, sy: r.top, sw: r.width, sh: r.height }; }
  function rectOf(spot) {
    if (!spot) return null;
    if (typeof spot === 'function') spot = spot();
    if (!spot) return null;
    if (spot.left != null && spot.width != null && !(spot instanceof Element)) return local(spot);
    const els = typeof spot === 'string' ? [...document.querySelectorAll(spot)].filter((e) => e.offsetParent !== null || e.getClientRects().length) : Array.isArray(spot) ? spot : [spot];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const e of els) { if (!e) continue; const r = e.getBoundingClientRect(); if (!r.width && !r.height) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    if (x1 < x0) return null;
    return local({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 });
  }

  // 1つの吹き出し：話す人・文・光らせる所。tap＝光った所を押すまで進まない
  let typing = null;
  function say(who, text, o = {}) {
    const r = ensureRoot(); r.hidden = false; r.className = 'tt-on' + (o.cls ? ' ' + o.cls : '');
    const box = r.querySelector('.tt-box'), face = r.querySelector('.tt-face'), name = r.querySelector('.tt-name'), tx = r.querySelector('.tt-text'), ui = r.querySelector('.tt-ui'), nx = r.querySelector('.tt-next');
    const hole = r.querySelector('.tt-hole'), shade = r.querySelector('.tt-shade'), arrow = r.querySelector('.tt-arrow'), big = r.querySelector('.tt-big');
    const w = WHO[who];
    face.hidden = !w; if (w) face.querySelector('img').src = w.img;
    name.hidden = !w; name.textContent = w ? w.name : '';
    box.classList.toggle('narr', !w);
    ui.innerHTML = ''; big.innerHTML = o.big || ''; big.hidden = !o.big; big.className = 'tt-big' + (o.bigCls ? ' ' + o.bigCls : '');
    // 光らせる所
    const place = () => {
      const R = rectOf(o.spot), pad = o.pad ?? 8;
      if (R) {
        hole.hidden = false; shade.hidden = true;
        Object.assign(hole.style, { left: R.x - pad + 'px', top: R.y - pad + 'px', width: R.w + pad * 2 + 'px', height: R.h + pad * 2 + 'px', borderRadius: (o.round ? '50%' : '14px') });
        const H = appEl().offsetHeight, W = appEl().offsetWidth, below = R.y + R.h / 2 < H * 0.55;
        // 吹き出しは光った所と重ならない側へ
        box.classList.toggle('top', !below && !o.boxBottom);
        if (o.tap || o.arrow) { arrow.removeAttribute('hidden'); const ax = Math.min(W - 70, Math.max(10, R.x + R.w / 2 - 30)), up = R.y > 90; arrow.style.left = ax + 'px'; arrow.style.top = (up ? R.y - pad - 66 : R.y + R.h + pad + 6) + 'px'; arrow.classList.toggle('up', !up); }
        else arrow.setAttribute('hidden', '');
        r._hole = R; r._pad = pad;
      } else { hole.hidden = true; shade.hidden = !!(o.noShade || document.getElementById('ttScene')); arrow.setAttribute('hidden', ''); r._hole = null; box.classList.toggle('top', !!o.boxTop); }
    };
    place();
    const re = () => place(); window.addEventListener('stagefit', re);
    // 文字送り
    const html = text; let n = 0; const plain = html.replace(/<[^>]+>/g, '');
    clearInterval(typing); tx.innerHTML = ''; nx.hidden = true;
    const show = (k) => { let c = 0, out = '', inTag = false; for (const ch of html) { if (ch === '<') inTag = true; if (inTag) { out += ch; if (ch === '>') inTag = false; continue; } if (c >= k) break; out += ch; c++; } tx.innerHTML = out; };
    typing = setInterval(() => { n += 1; show(n); if (n >= plain.length) { clearInterval(typing); typing = null; nx.hidden = !!(o.tap || o.choices || o.input); } }, o.fast ? 10 : 34);
    const finishType = () => { if (typing) { clearInterval(typing); typing = null; show(1e9); nx.hidden = !!(o.tap || o.choices || o.input); return true; } return false; };
    return new Promise((res) => {
      const done = (v) => { window.removeEventListener('stagefit', re); r.onclick = null; r.onpointerdown = null; res(v); };
      if (o.choices) {
        ui.innerHTML = `<div class="tt-ch">${o.choices.map((c, k) => `<button data-k="${k}" class="${k === 0 ? 'pri' : ''}">${esc(c)}</button>`).join('')}</div>`;
        ui.querySelectorAll('button').forEach((b) => b.onclick = (e) => { e.stopPropagation(); finishType(); done(+b.dataset.k); });
      }
      if (o.input) {
        ui.innerHTML = `<div class="tt-in"><input maxlength="${o.input.max || 10}" placeholder="${esc(o.input.ph || '')}" value="${esc(o.input.value || '')}"><button class="pri">決定</button></div><p class="tt-err"></p>`;
        const inp = ui.querySelector('input'), err = ui.querySelector('.tt-err');
        const ok = (e) => { if (e) e.stopPropagation(); const v = inp.value.trim(); if (!v) { err.textContent = '名前を入れてください'; return; } done(v); };
        ui.querySelector('button').onclick = ok; inp.onkeydown = (e) => { if (e.key === 'Enter') ok(e); }; inp.onclick = (e) => e.stopPropagation();
        setTimeout(() => { try { inp.focus(); } catch (_) {} }, 300);
      }
      r.onclick = (e) => {
        if (o.choices || o.input) { finishType(); return; }
        if (o.tap) {
          const R = r._hole; if (!R) { if (finishType()) return; hide(); if (typeof o.tap === 'function') setTimeout(o.tap, 0); done(true); return; }
          const a = appEl().getBoundingClientRect(), s = scale(), x = (e.clientX - a.left) / s, y = (e.clientY - a.top) / s, p = r._pad;
          if (x < R.x - p || x > R.x + R.w + p || y < R.y - p || y > R.y + R.h + p) { finishType(); hole.classList.remove('blink'); void hole.offsetWidth; hole.classList.add('blink'); return; }
          finishType(); hide();
          const cx = e.clientX, cy = e.clientY; setTimeout(() => { if (typeof o.tap === 'function') o.tap(); else forward(cx, cy); }, 0);
          done(true); return;
        }
        if (finishType()) return;
        done(true);
      };
    });
  }
  // 光った所を押した：その下にあるボタン・建物へ、そのままクリックを渡す
  function forward(cx, cy) {
    const r = ensureRoot(); r.hidden = true;
    const el = document.elementFromPoint(cx, cy); if (!el) return;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window }));
  }
  function hide() { const r = ensureRoot(); r.hidden = true; r.onclick = null; clearInterval(typing); typing = null; }

  // ---------- タイトル画面 ----------
  function title() {
    return new Promise((res) => {
      const el = document.createElement('div'); el.id = 'ttTitle';
      const runners = Array.from({ length: 6 }, (_, k) => `<i class="tt-run r${k}" style="animation-delay:${-k * 1.3}s"></i>`).join('');
      el.innerHTML = `<div class="ttl-sky"></div><div class="ttl-pitch"></div><div class="ttl-runs">${runners}</div>
        <div class="ttl-logo"><small>サッカークラブ育成シミュレーション</small><b>ドット<span>サッカー</span></b><em>DOT SOCCER</em></div>
        <p class="ttl-tap">画面をタップしてはじめる</p><p class="ttl-ver">${esc((document.querySelector('script[src*="engine.js"]') || {}).src?.split('v=')[1] || '')}</p>`;
      (appEl() || document.body).appendChild(el);
      // 走る選手：試合と同じドット絵
      try { el.querySelectorAll('.tt-run').forEach((sp, k) => { const cv = A().spriteCanvas({ name: '', number: 1 + k, hair: k % 4, hairColor: k % 3, skin: k % 3, position: 'MF' }, k % 2, 'side', k % 4, true, false); if (cv) { cv.className = 'tt-runcv'; sp.appendChild(cv); } }); } catch (_) {}
      el.onclick = () => { el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 450); };
    });
  }
  // 背景（クラブハウス）と秘書の立ち絵だけの場面
  function scene(on) {
    let el = document.getElementById('ttScene');
    if (!on) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'ttScene'; (appEl() || document.body).appendChild(el); }
    let bg = ''; try { bg = K().clubhouseBg(); } catch (_) {}
    el.innerHTML = (bg ? `<img class="sc-bg" src="${bg}" alt="">` : '') + `<img class="sc-sec" src="${WHO.sec.img}" alt="">`;
    { const im = el.querySelector('.sc-sec'); im.decoding = 'sync'; im.onerror = () => { setTimeout(() => { im.src = WHO.sec.img + '?r=' + Date.now(); }, 300); }; }   /* 版469：読み込みに失敗したら、もう一度 */
  }

  // ---------- 進み具合 ----------
  let save = null, busy = false;
  const st = () => (save && save.tut) || null;
  const store = () => { try { K().store(); } catch (_) {} };
  function setStep(s) { if (!save) return; save.tut = save.tut || {}; save.tut.s = s; store(); }
  const step = () => (st() ? st().s : null);
  const active = () => !!(st() && st().s && st().s !== 'done');
  // ほかの画面（結果・順位表・秘書・モーダル）が出ている間は待つ
  const blocking = () => ['#crModal', '#secScreen', '#assocScreen', '#clubScreen', '#liveScr', '#pbModal', '#mresult', '#lkScreen', '#ttTitle', '#match:not([hidden])'].some((q) => { const e = document.querySelector(q); return e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; }) || [...document.querySelectorAll('.lk-wrap')].some((e) => !e.hidden && e.id !== 'ttScene');
  async function idleHome(maxMs = 60000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) { if (K().view === 'home' && !$('#cv-home').hidden && !$('#career').hidden && !blocking()) { await sleep(250); if (!blocking()) return true; } await sleep(250); }
    return false;
  }
  const runQ = async (fn) => { for (let k = 0; busy && k < 200; k++) await sleep(50); return run(fn); };   // 前の案内が終わるのを待ってから
  const run = async (fn) => { if (busy) return; busy = true; try { await fn(); } catch (e) { console.error(e); hide(); } busy = false; if (active()) setTimeout(() => kickHome(), 60); };

  // ---------- 台本 ----------
  const team = () => (save && save.team && save.team.name) || 'はじまりFC';
  const mgr = () => (save && save.manager) || '';
  const MGR = () => (mgr() ? `${esc(mgr())}監督` : '監督');

  // 1. はじめて開いた：タイトル → 秘書のあいさつ → ホームタウン
  async function opening() {
    await title();
    scene(true);
    await say('sec', '監督、はじめまして！<br>「ドットサッカー」をはじめていただき、ありがとうございます！');
    await say('sec', `私が秘書を務めさせていただきます。<br>この小さなサッカークラブ「${esc(team())}」を、どうぞよろしくお願いします！`);
    const k = await say('sec', 'まずは、このクラブでの監督のお仕事を、ひととおりご案内しますね。', { choices: ['案内してもらう', '自分で遊ぶ（説明をとばす）'] });
    scene(false);
    if (k === 1) { setStep('done'); hide(); if (!save.clubSet) K().openClub({ first: true, onDone: () => K().go('home') }); return; }
    setStep('town'); hide(); K().go('home');
  }
  // 2. ホームタウンの案内 → スタジアムで練習試合
  async function town() {
    await say('sec', `ここが、我らが「${esc(team())}」のホームタウンです。`);
    await say('sec', 'ホームタウンの建物を選ぶと、監督としていろいろなお仕事ができます。');
    await say('sec', '「クラブハウス」では、選手の様子を見たり、特訓をしたりします。', { spot: () => K().townRect('club') });
    await say('sec', '「サッカー協会」では、試合の日程や順位がわかります。', { spot: () => K().townRect('assoc') });
    await say('sec', '「クラブ事務所」では、チーム編成やクラブの名前・ユニフォームを決めます。', { spot: () => K().townRect('lineup') });
    await say('sec', '「ショップ」では、コインで特訓カードを買えます。', { spot: () => K().townRect('shop') });
    await say('sec', 'さっそくですが、これから練習試合があります。<br>「スタジアム」に行ってみましょう！', { spot: () => K().townRect('stadium'), tap: () => { setStep('pre'); K().tutPractice(); } });
  }
  // 3. 試合前の画面（コーチ）
  async function live(el, meta) {
    if (meta.tut === 'practice' && step() === 'pre') {
      await sleep(500);
      await say('coach', `${MGR()}、はじめての試合ですね。<br>コーチです。よろしくお願いします！`);
      await say('coach', '試合の前に、「スタメン」で先発メンバーとポジション、<br>「戦術」で攻め方・守り方を決めておけます。', { spot: () => [el.querySelector('[data-a="lineup"]'), el.querySelector('[data-a="tac"]')] });
      await say('coach', '「ユニフォーム」では、この試合で着るユニフォーム（ホーム・アウェー）を選べます。', { spot: () => el.querySelector('[data-a="kit"]') });
      await say('coach', '今日はひとまず、「試合開始」で試合を見てみましょう！', { spot: () => el.querySelector('[data-a="ko"]'), tap: true });
      setStep('match');
      return;
    }
    if (step() === 'official' && !meta.practice) {
      await sleep(500);
      await say('coach', `${MGR()}、いよいよ公式戦ですね！<br>練習試合と同じように、「スタメン」と「戦術」はここでも変えられます。`, { spot: () => [el.querySelector('[data-a="lineup"]'), el.querySelector('[data-a="tac"]')] });
      await say('coach', 'ここで変えた戦術は、この試合だけの指示になります。<br>準備ができたら「試合開始」です！', { spot: () => el.querySelector('[data-a="ko"]'), tap: true });
      setStep('officialVs');
    }
  }
  // 4. 対戦カード（TOTO）
  async function vs(el, meta) {
    const practice = meta.tut === 'practice' && step() === 'match', official = step() === 'officialVs' && !meta.practice;
    if (!practice && !official) return;
    await sleep(2300);
    window.__tutHold = true;
    if (practice) {
      await say(null, '試合の前には、対戦カードが出ます。<br>右の「TOTO」は試合の予想。上から「ホーム勝ち」「引き分け」「アウェー勝ち」の確率です。', { spot: () => el.querySelector('.vs-toto') });
      await say(null, 'チーム力の目安になるので、相手が強いか弱いかを確かめておきましょう。');
    } else {
      await say(null, 'いよいよ公式戦です。<br>TOTOで、相手との力の差を確かめておきましょう。', { spot: () => el.querySelector('.vs-toto') });
      setStep('officialMatch');
    }
    hide(); window.__tutHold = false;
  }
  // 5. 試合の中（練習試合：攻める向き・ボタン・課題カード → 途中で結果へ／公式戦：ハーフタイム）
  function matchOpts(meta) {
    if (!save || !active()) return null;
    if (meta.tut === 'practice' && (step() === 'match' || step() === 'pre')) {
      let introDone = false, issueDone = false, ending = false;
      const endEarly = async (api) => {
        if (ending) return; ending = true; api.pause();
        await say('sec', 'さすが監督、早くも課題が見えてきたみたいですね。<br>今日の観戦はここまでにして、結果を見てみましょう。');
        hide(); setStep('result'); api.skip();
      };
      return {
        tick: async (t, api) => {
          if (!introDone && t > 2.5) {
            introDone = true; api.pause();
            const d = api.dir();
            await say(null, `${d > 0 ? '左から右' : '右から左'}に攻めるのが、${MGR()}のチーム「${esc(team())}」です。`, { big: `<div class="tt-dir ${d > 0 ? 'r' : 'l'}"></div>`, boxTop: true, noShade: true });
            await say('coach', '試合が始まったら、選手は自分で考えて動きます。<br>監督は試合の流れを見て、チームの課題を見つけましょう。', { boxTop: true, noShade: true });
            await say('coach', '右のボタンで「選手交代」「選手」の様子、「状況」（スコアや途中経過）が見られます。', { spot: '#match aside', boxTop: false });
            await say('coach', '選手をタップすると、その選手を追いかけて見られますよ。', { boxTop: true });
            hide(); api.resume();
            return;
          }
          if (introDone && !issueDone && !ending && t > 120) endEarly(api);   // 課題が出なかった時も、ここで切り上げる
        },
        onIssue: async (e, api) => {
          if (issueDone || !introDone || ending) return; issueDone = true;
          await sleep(700); api.pause();
          await say('coach', '試合の中でチームの課題が見つかると、こうしてカードで教えてくれます。', { spot: '#coach', boxTop: true });
          await say('coach', '見つかった課題のカードは、試合のあとにもらえます。<br>特訓で使って、選手を伸ばしましょう！', { spot: '#coach', boxTop: true });
          endEarly(api);
        },
        onResult: async (el) => {
          await sleep(600);
          const sec = el.querySelector('.lk-sec[data-k="c"]'); if (sec) sec.classList.add('open');
          await say('coach', '試合の結果です。<br>「見つかった課題」に、この試合で見つかった課題が並びます。', { spot: () => el.querySelector('.lk-sec[data-k="c"]') || el.querySelector('.lk-stat'), boxTop: true });
          await say('coach', '確認したら、右上の戻るボタンで終わりです。', { spot: () => el.querySelector('.lk-back'), tap: true, round: true });
          setStep('afterPractice');
        },
      };
    }
    if (!meta.practice && (step() === 'officialMatch' || step() === 'officialVs' || step() === 'official')) {
      let introDone = false;
      return {
        tick: async (t, api) => { if (!introDone && t > 2) { introDone = true; setStep('officialMatch'); } },
        onHalf: async () => {
          window.__tutHold = true;   // 説明の間は、ロッカーの残り時間を止める
          await sleep(900);
          const lkOn = () => { const e = document.getElementById('locker'); return e && !e.hidden; };
          if (!lkOn()) { window.__tutHold = false; return; }
          await say('coach', 'ハーフタイムです。<br>ここで、後半に向けた指示を出せます。', { boxTop: true });
          await say('coach', '「選手交代」で疲れた選手を入れ替えたり、「戦術」で攻め方・守り方を変えたりできます。', { spot: '#locker .lk-btns', boxTop: true });
          await say('coach', '左下の数字は、ハーフタイムの残り時間です。', { spot: '#locker .lk-count', boxTop: true });
          await say('coach', '0になるか、「後半開始」を押すと後半が始まります。', { spot: '#locker .lk-go', boxTop: true });
          hide(); window.__tutHold = false; setStep('afterOfficial');
        },
        onResult: async () => { if (step() !== 'afterOfficial') setStep('afterOfficial'); },
      };
    }
    return null;
  }
  // 6. 練習試合のあと：監督名 → クラブ事務所（クラブ名・略称・ユニフォーム・エンブレム）
  async function afterPractice() {
    await say('sec', '練習試合、お疲れさまでした！<br>試合をすると、カレンダーが1週間すすみます。');
    await say('sec', 'そういえば…私としたことが、監督のお名前をうかがっていませんでした。');
    let nm = '';
    for (;;) {
      nm = await say('sec', '監督のお名前を教えてください。<br><small>（8文字まで）</small>', { input: { max: 8, ph: '監督名', value: nm } });
      const k = await say('sec', `「${esc(nm)}監督」、でよろしいですか？`, { choices: ['はい', 'いいえ'] });
      if (k === 0) break;
    }
    save.manager = nm; store();
    await say('sec', `${esc(nm)}監督、あらためてよろしくお願いします！<br>今はまだ無名のクラブですが、いつか強豪クラブの仲間入りができるよう、がんばりましょう！`);
    await say('sec', '地域リーグから勝ち上がって、目指すは「D1リーグ」の優勝と「国内カップ」の制覇。<br>夢の二冠を目指しましょう！');
    await say('sec', 'まずは、私たちのクラブの名前を決めましょう。<br>「クラブ事務所」をタップしてください。', { spot: () => K().townRect('lineup'), tap: () => {} });
    hide(); setStep('club');
    const closed = new Promise((res) => K().openClub({ first: true, onDone: () => { res(); } }));
    await sleep(500);
    await say('sec', 'ここで、クラブの名前を決めます。<br>「クラブ名」は12文字まで、「略称」は試合の点数の横に出る短い名前です。', { spot: '.cl-form', boxBottom: true });
    await say('sec', '「ユニフォーム」と「エンブレム」のタブで、色や形も選べます。<br>左の絵で、できあがりを確かめられますよ。', { spot: '.cl-tabs', boxBottom: true });
    await say('sec', '決まったら、下の「決定」を押してください。', { spot: '.cl-ok', boxTop: true });
    hide();
    await closed;
    K().go('home');
    await idleHome();
    await say('sec', `「${esc(team())}」、とても素敵な名前ですね！`);
    await say('sec', '「クラブ事務所」では、ほかにもスタメンやポジションなどの「チーム編成」ができます。<br>名前やユニフォームは、いつでも変えられますよ。', { spot: () => K().townRect('lineup') });
    setStep('clubhouse');
    await clubhouse();
  }
  // 7. クラブハウス：選手データ・スタメン・戦術・特訓
  async function clubhouse() {
    await say('sec', '次は「クラブハウス」です。<br>試合で見つけた課題をもとに、選手を特訓しましょう！', { spot: () => K().townRect('club'), tap: () => { setStep('clubIn'); K().go('club'); } });
  }
  async function clubIn() {
    await sleep(500);
    const b = (g) => document.querySelector(`#cv-club .rbtns button[data-go="${g}"]`);
    await say('coach', `${MGR()}、ここはクラブハウスの練習グラウンドです。<br>全体練習は毎週、自動で行われます。`);
    await say('coach', '「選手データ」では、選手の能力やタイプ、調子が見られます。', { spot: () => b('data') });
    await say('coach', '「スタメン」では、先発メンバーとポジションを決めます。<br>選手をドラッグして入れ替えられます。', { spot: () => b('lineup') });
    await say('coach', '「戦術」では、攻め方・守り方の指示を出せます。', { spot: () => b('tactic') });
    await say('coach', 'それでは「特訓」を見てみましょう。', { spot: () => b('train'), tap: true });
    setStep('train');
  }
  async function train() {
    await sleep(600);
    await say('coach', '特訓では、選手を1人選んで、カードを3枚までセットします。', { spot: '.trb-line', boxTop: false });
    await say('coach', '下に並んでいるのが、持っている特訓カードです。<br>試合で見つかった課題のカードも、ここに入ります。', { spot: '.trb-hand', boxTop: true });
    await say('coach', 'カードの組み合わせで、伸びる能力が変わります。<br>うまく組み合わせると「スペシャルメニュー」で技を覚えることも！', { spot: '.tslots2', boxTop: true });
    await say('coach', 'セットしたら「特訓する！」。特訓は、1人につき1週間に1回です。<br>カードを選んで、さっそく誰かを特訓してみてください。', { boxTop: true });
    await say('coach', '終わったら、右上の戻るボタンを押していくと、ホームタウンへ戻れます。', { spot: '#cvBack', round: true, boxTop: true });
    hide(); setStep('assoc');
  }
  // 8. サッカー協会・週送り・ドットガイド
  async function assoc() {
    await say('sec', 'お疲れさまです！<br>最後に「サッカー協会」をご案内しますね。', { spot: () => K().townRect('assoc'), tap: () => { setStep('assocIn'); K().openAssoc({ tab: 'sched' }); } });
    await sleep(700);
    await say('sec', '「サッカー協会」では、リーグ戦の日程や順位、カップ戦の組み合わせが見られます。', { spot: '#assocScreen .std-tabs', boxTop: false });
    await say('sec', '得点・アシストのランキング、監督成績もわかりますよ。', { spot: '#assocScreen .std-tabs', boxTop: false });
    hide();
    await say('sec', '見終わったら、右上の戻るボタンで戻ってくださいね。', { spot: '#assocScreen .std-back', round: true, tap: true });
    setStep('week');
  }
  async function week() {
    await say('sec', '左上の日付の「▶」をタップすると、次の週に進みます。', { spot: '.hm-date', boxTop: false });
    await say('sec', 'ここには、次の試合とその日付が出ます。<br>週が進むと、公式戦が近付いてきますよ！', { spot: '#hmNextMatch', boxTop: false });
    await say('sec', '画面の下では、「ドットガイド」が役に立つ情報を教えてくれます。', { spot: '.hm-ticker', boxTop: true });
    if (K().isMatchWeek()) { setStep('waitOfficial'); await officialWeek(); return; }
    await say('sec', '特訓が終わったら、日付の「▶」で週を進めて、公式戦に向かいましょう！');
    hide(); setStep('waitOfficial');
  }
  async function officialWeek() {
    await say('sec', '今週は公式戦です！<br>準備ができたら「スタジアム」をタップして、試合会場に向かいましょう。', { spot: () => K().townRect('stadium'), tap: () => { setStep('official'); K().stadium(); } });
    hide();
  }
  async function afterOfficial() {
    await say('coach', `${MGR()}、お疲れさまでした。<br>選手には、試合や特訓のたびに疲労がたまっていきます。`);
    await say('coach', '疲労がたまると、ケガをしやすくなります。<br>「選手データ」の疲労度の丸（青→黄→赤）で、疲れ具合に気をつけてください。');
    await say('sec', `これで、ひととおりのご案内は終わりです。<br>あとは${MGR()}の思うように、チームを育ててください！`);
    await say('sec', '説明をもう一度見たい時は、メニューの「チュートリアルを見る」からどうぞ。<br>一緒に頂点を目指しましょう！');
    hide(); setStep('done');
  }

  // ---------- きっかけ ----------
  async function onHomeIdle() {
    const s = step();
    if (s === 'town') await town();
    else if (s === 'afterPractice') await afterPractice();
    else if (s === 'club' && save.clubSet) { setStep('clubhouse'); await clubhouse(); }
    else if (s === 'clubhouse') await clubhouse();
    else if (s === 'train' || s === 'clubIn') { setStep('assoc'); await assoc(); }
    else if (s === 'assoc') await assoc();
    else if (s === 'assocIn' || s === 'week') { setStep('week'); await week(); }
    else if (s === 'waitOfficial' && K().isMatchWeek()) await officialWeek();
    else if (s === 'afterOfficial') await afterOfficial();
  }
  let homeWait = false;
  async function kickHome() {
    if (homeWait || busy || !active()) return; homeWait = true;
    const ok = await idleHome(); homeWait = false;
    if (ok && active()) run(onHomeIdle);
  }
  const T = {
    // 育成モードを開いた時：はじめての人ならチュートリアルを始める（true＝こちらで面倒を見る）
    boot(sv) {
      save = sv; if (LAB) return false;
      if (!save.tut) save.tut = { s: (!save.clubSet && (save.week || 1) <= 1 && save.season === 1 && !(save.history || []).length) ? 'start' : 'done' };
      if (step() === 'start') { run(opening); return true; }
      if (active()) kickHome();
      return active();
    },
    onView(v) {
      if (!save || !active()) return;
      if (v === 'home') kickHome();
      if (v === 'club' && step() === 'clubIn') runQ(clubIn);
      if (v === 'train' && step() === 'train') runQ(train);
    },
    onLive(el, meta) { if (save && active()) runQ(() => live(el, meta)); },
    onVs(el, meta) { if (save && active()) runQ(() => vs(el, meta)); },
    matchOpts(meta) { const o = matchOpts(meta); if (!o) return null; const wrap = {}; for (const k of Object.keys(o)) wrap[k] = (...a) => { if (k === 'tick') { if (!busy) run(() => o[k](...a)); return; } runQ(() => o[k](...a)); }; return wrap; },
    // メニューから：今のデータのまま、案内だけもう一度（練習試合と名前入れはとばす）
    replay() { save = K().save; if (!save) return; save.tut = { s: 'clubhouse' }; store(); K().go('home'); scene(false); run(async () => { await say('sec', 'では、もう一度ご案内しますね。'); await town0(); }); },
    get step() { return step(); },
  };
  async function town0() {
    await say('sec', 'ホームタウンの建物を選ぶと、監督としていろいろなお仕事ができます。');
    await say('sec', '「スタジアム」では、試合をします。公式戦のない週は、練習試合ができます。', { spot: () => K().townRect('stadium') });
    await say('sec', '「クラブ事務所」では、チーム編成やクラブの名前・ユニフォームを決めます。', { spot: () => K().townRect('lineup') });
    await say('sec', '「ショップ」では、コインで特訓カードを買えます。', { spot: () => K().townRect('shop') });
    await clubhouse();
  }
  window.__tut = T;
})();

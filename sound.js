// 版499：サウンド（効果音とBGM）。音のファイルは使わず、ファミコン風の音をその場で作る
(function () {
  let AC = null, master = null, sfxG = null, bgmG = null, crowdNode = null, crowdGain = null;
  const pref = { sfx: true, bgm: true, vol: 0.8 };
  try { const v = JSON.parse(localStorage.getItem('dotSound') || '{}'); Object.assign(pref, v); } catch (_) {}
  const save = () => { try { localStorage.setItem('dotSound', JSON.stringify(pref)); } catch (_) {} };
  function ctx() {
    if (AC) return AC;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    AC = new C(); master = AC.createGain(); master.gain.value = pref.vol; master.connect(AC.destination);
    sfxG = AC.createGain(); sfxG.gain.value = pref.sfx ? 1 : 0; sfxG.connect(master);
    bgmG = AC.createGain(); bgmG.gain.value = pref.bgm ? 0.55 : 0; bgmG.connect(master);
    return AC;
  }
  // iPhoneは、画面にさわった時でないと音が出せない：最初のタッチで音を使えるようにする
  const unlock = () => { const a = ctx(); if (!a) return; if (a.state === 'suspended') a.resume(); if (want && !cur) bgm(want); };
  ['pointerdown', 'touchstart', 'keydown'].forEach((e) => addEventListener(e, unlock, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!AC) return; if (document.hidden) AC.suspend(); else AC.resume(); });

  // ---- 音の部品 ----
  function tone(f, d, type = 'square', vol = 0.2, t0 = 0, slide = null, out = null) {
    const a = ctx(); if (!a) return; const t = a.currentTime + t0;
    const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(out || sfxG); o.start(t); o.stop(t + d + 0.02);
  }
  let noiseBuf = null;
  function noiseBuffer() { const a = ctx(); if (noiseBuf) return noiseBuf; noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return noiseBuf; }
  function noise(d, vol = 0.2, fType = 'lowpass', fq = 1200, t0 = 0, out = null, attack = 0.005) {
    const a = ctx(); if (!a) return; const t = a.currentTime + t0;
    const s = a.createBufferSource(); s.buffer = noiseBuffer(); const f = a.createBiquadFilter(); f.type = fType; f.frequency.value = fq; const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(out || sfxG); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  // 長くのびる雑音（立ち上がり→そのまま→消える）
  function noiseHold(d, vol, fq, q, t0 = 0, att = 0.6, rel = 1.0) {
    const a = ctx(); if (!a) return; const t = a.currentTime + t0;
    const s = a.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = q; const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.setValueAtTime(vol, t + d - rel); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(sfxG); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  // 版558：本家の笛を測って合わせた：約3000Hz、鳴り始めは2600Hzから0.04秒で上がる、玉が転がる「ビリビリ」（毎秒93回のふるえ）
  function whistle(d = 0.28, t0 = 0, vol = 0.18) {
    const a = ctx(); if (!a) return; const t = a.currentTime + t0;
    const o = a.createOscillator(), lfo = a.createOscillator(), lg = a.createGain(), g = a.createGain(), am = a.createGain(), alfo = a.createOscillator(), ag = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(2620, t); o.frequency.exponentialRampToValueAtTime(3010, t + 0.04);
    lfo.frequency.value = 93; lg.gain.value = 95; lfo.connect(lg); lg.connect(o.frequency);
    alfo.frequency.value = 93; ag.gain.value = 0.28; alfo.connect(ag); am.gain.value = 0.72; ag.connect(am.gain);   // 音の大きさもビリビリ
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(vol * 0.62, t + Math.min(0.25, d * 0.6)); g.gain.setValueAtTime(vol * 0.62, t + Math.max(0.02, d - 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(am); am.connect(g); g.connect(sfxG); [o, lfo, alfo].forEach((x) => { x.start(t); x.stop(t + d + 0.02); });
    noise(d, vol * 0.08, 'bandpass', 3000, t0, null, 0.01);   // 息の音
  }
  // 指笛（観客の「ヒューッ」）：低いところから一気に上がる
  function fanWhistle(t0 = 0, f0 = 400, f1 = 2000, d = 0.2, vol = 0.05) {
    const a = ctx(); if (!a) return; const t = a.currentTime + t0;
    const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + d * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.04);
    o.connect(g); g.connect(sfxG); o.start(t); o.stop(t + d + 0.06);
  }
  // 観客の「おぉー」：たくさんの人の声（少しずつ高さのずれた声）を、口の形（オの響き）に通す
  function voices(d, vol, t0 = 0, base = 150, up = 1.0) {
    const a = ctx(); if (!a) return; const t = a.currentTime + t0;
    const out = a.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(vol, t + 0.35); out.gain.setValueAtTime(vol, t + d * 0.55); out.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const f1 = a.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 2.2;
    const f2 = a.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 800; f2.Q.value = 3;
    const f3 = a.createBiquadFilter(); f3.type = 'lowpass'; f3.frequency.value = 320;
    [f1, f2, f3].forEach((f) => { f.connect(out); }); out.connect(sfxG);
    for (let i = 0; i < 9; i++) {
      const o = a.createOscillator(); o.type = 'sawtooth'; const f = base * (0.8 + Math.random() * 0.5);
      o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * up, t + d * 0.5); o.frequency.linearRampToValueAtTime(f * up * 0.88, t + d);
      const g = a.createGain(); g.gain.value = 0.11; o.connect(g); [f1, f2, f3].forEach((x) => g.connect(x)); o.start(t + Math.random() * 0.12); o.stop(t + d + 0.05);
    }
    noise(d, vol * 0.5, 'bandpass', 650, t0, null, 0.3);
  }
  const N = (s) => { const m = /^([A-G])(#?)(\d)$/.exec(s); if (!m) return 0; const k = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0) + (+m[3] - 4) * 12; return 440 * Math.pow(2, k / 12); };

  // ---- 効果音 ----
  const SFX = {
    // 版558：本家のタップ音は「カチッ」と短く高い音（5300Hzあたり、0.015秒）
    tap() { noise(0.018, 0.22, 'bandpass', 5300, 0, null, 0.001); tone(5300, 0.012, 'sine', 0.05); },
    ok() { tone(784, 0.07, 'square', 0.09); tone(1175, 0.1, 'square', 0.09, 0.07); },
    back() { noise(0.018, 0.22, 'bandpass', 3600, 0, null, 0.001); tone(3600, 0.012, 'sine', 0.05); },
    pop() { tone(1060, 0.07, 'sine', 0.2, 0, 690); },   // 本家：お知らせが出る時の「ポッ」（1060→690Hz、0.07秒）
    touch() { noise(0.035, 0.12, 'lowpass', 900); tone(110, 0.05, 'sine', 0.16, 0, 70); },
    header() { noise(0.07, 0.25, 'bandpass', 700); tone(260, 0.1, 'sine', 0.3, 0, 120); },   // ボン（頭）
    catch() { noise(0.12, 0.3, 'lowpass', 500); tone(95, 0.14, 'sine', 0.4, 0, 60); noise(0.04, 0.1, 'highpass', 3000, 0.01); },   // バシッ（両手で抱える）
    parry() { noise(0.06, 0.32, 'bandpass', 1800); tone(320, 0.07, 'square', 0.08, 0, 160); },   // パンッ（はじく）
    // 版558：本家のキックは低く短い「ドッ」（210Hzから130Hzへ、0.04秒）。高い音はほとんどない
    kick() { tone(210, 0.05, 'sine', 0.6, 0, 125); tone(105, 0.045, 'triangle', 0.26, 0, 70); noise(0.012, 0.06, 'highpass', 5000); },
    shot() { tone(230, 0.08, 'sine', 0.45, 0, 105); tone(115, 0.07, 'triangle', 0.2, 0, 60); noise(0.03, 0.09, 'lowpass', 600); noise(0.012, 0.05, 'highpass', 5000); },
    // 版558：本家の吹き方 — キックオフ「ピーーー」1.45秒／ファール「ピッピッ」／前半終了「ピッ、ピーーー」／試合終了「ピッ、ピッ、ピーーー」
    whistle() { whistle(1.45); },
    foul() { whistle(0.09); whistle(0.085, 0.12); },
    whistle2() { whistle(0.19); whistle(1.48, 0.6); },
    whistle3() { whistle(0.19); whistle(0.19, 0.52); whistle(1.48, 1.03); },
    // 版558：本家のゴール：1秒で観客が「ワーッ」と明るく大きくなり（高めの声が+10dB）、5秒ほど続いて1秒で戻る。低い地鳴りはない。指笛がまじる
    cheer() {
      [[700, 1.4, 0.2], [1100, 1.2, 0.2], [1700, 1.4, 0.15], [2600, 2, 0.06]].forEach(([fq, q, v], k) => noiseHold(6.4, v, fq, q, k * 0.04, 0.8, 1.2));
      voices(5.8, 0.12, 0.2, 210, 1.15);
      [[1.2, 500, 2400], [1.6, 700, 2800], [2.9, 450, 2200], [3.4, 2900, 3700], [4.3, 600, 2500]].forEach(([t, a, b]) => fanWhistle(t, a, b, a > 2000 ? 0.35 : 0.22, 0.045));
      if (crowdGain && AC) { const t = AC.currentTime; try { crowdGain.gain.cancelScheduledValues(t); crowdGain.gain.setValueAtTime(crowdGain.gain.value, t); crowdGain.gain.linearRampToValueAtTime(1.3, t + 0.8); crowdGain.gain.setValueAtTime(1.3, t + 5.4); crowdGain.gain.linearRampToValueAtTime(0.9, t + 6.6); } catch (_) {} }
    },
    // 点数が変わる時のファンファーレ
    scoreUp() {
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(N(n), 0.16, 'square', 0.14, i * 0.1));
      tone(N('G5'), 0.12, 'square', 0.14, 0.45); tone(N('C6'), 0.6, 'square', 0.15, 0.57);
      tone(N('C4'), 0.7, 'triangle', 0.28, 0.57); tone(N('E4'), 0.7, 'triangle', 0.2, 0.57); tone(N('G4'), 0.7, 'triangle', 0.16, 0.57);
    },
    goal() { SFX.cheer(); },
    // 版558：おしいシュートの「おぉー」と指笛（本家：声のかたまり＋「ヒュイッ、ヒュイーッ」）
    ooh() { voices(1.7, 0.75, 0, 150, 1.12); fanWhistle(0.75, 400, 1800, 0.17, 0.12); fanWhistle(0.98, 400, 2200, 0.24, 0.12); },
    skill() { [880, 1320, 1760, 2349].forEach((f, i) => tone(f, 0.09, 'triangle', 0.12, i * 0.045)); },
    uniq() { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.08, i * 0.05)); noise(0.5, 0.06, 'highpass', 4000, 0.05); },
    card() { whistle(0.09); whistle(0.085, 0.12); },
    gachaOrb() { tone(220, 1.4, 'triangle', 0.12, 0, 880); noise(1.5, 0.06, 'highpass', 3000, 0.2, null, 0.6); },
    gachaRare() { tone(220, 1.4, 'square', 0.08, 0, 1760); [0.6, 0.8, 1.0, 1.2].forEach((t, i) => tone(N(['C6', 'E6', 'G6', 'C7'][i]), 0.3, 'triangle', 0.1, t)); noise(1.6, 0.08, 'highpass', 4000, 0.2, null, 0.6); },
    reveal() { tone(1318, 0.06, 'square', 0.06); tone(1760, 0.08, 'square', 0.05, 0.05); },
    reveal5() { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, i * 0.06)); },
    week() { tone(N('E5'), 0.12, 'triangle', 0.16); tone(N('A5'), 0.12, 'triangle', 0.16, 0.1); tone(N('E6'), 0.35, 'triangle', 0.14, 0.2); },
    win() { [['C5', 0], ['C5', 0.12], ['C5', 0.24], ['G5', 0.4], ['E5', 0.6], ['G5', 0.75], ['C6', 0.9]].forEach(([n, t]) => tone(N(n), t === 0.9 ? 0.7 : 0.12, 'square', 0.12, t)); tone(N('C4'), 1.4, 'triangle', 0.22, 0.2); },
    lose() { [['E5', 0], ['D#5', 0.25], ['D5', 0.5], ['C#5', 0.75]].forEach(([n, t]) => tone(N(n), t === 0.75 ? 0.8 : 0.22, 'square', 0.1, t)); tone(N('A3'), 1.4, 'triangle', 0.2, 0.2); },
    draw() { [['E5', 0], ['G5', 0.18], ['E5', 0.36], ['D5', 0.54]].forEach(([n, t]) => tone(N(n), t === 0.54 ? 0.5 : 0.15, 'square', 0.1, t)); },
  };
  let lastAt = {};
  function play(name) {
    if (!pref.sfx) return; const a = ctx(); if (!a || a.state !== 'running') return;
    const now = performance.now(); if (lastAt[name] && now - lastAt[name] < (name === 'kick' ? 70 : name === 'ooh' ? 2500 : 40)) return; lastAt[name] = now; if (window.__sndLog) window.__sndLog.push([name, Math.round(now)]);   // 同じ音が重なりすぎないように
    try { (SFX[name] || (() => {}))(); } catch (_) {}
  }

  // ---- 観客の声（試合中ずっと）：版558 本家を測って合わせた — 600〜750Hzに山（ほかより+6dB）、100〜500Hzは平ら、1000Hzから上はなだらかに下がる ----
  // mode：true＝ピッチ（ふつう）、'far'＝入場前の画面（遠くに聞こえる：低い音が細く、9dB小さい）、'duck'＝ロッカールーム（ほぼ聞こえない）
  let crowdParts = [], crowdHp = null, crowdMix = null; const CROWD = 3.1;   // 本家は観客の声が大きい（キックより6dBほど小さいだけ）
  function crowdMode(m) {
    if (!crowdMix || !AC) return; const t = AC.currentTime;
    const [g, hp] = m === 'far' ? [CROWD * 0.36, 420] : m === 'duck' ? [CROWD * 0.08, 600] : [CROWD, 40];
    try { crowdMix.gain.cancelScheduledValues(t); crowdMix.gain.setValueAtTime(crowdMix.gain.value, t); crowdMix.gain.linearRampToValueAtTime(g, t + 0.8); crowdHp.frequency.cancelScheduledValues(t); crowdHp.frequency.setValueAtTime(crowdHp.frequency.value, t); crowdHp.frequency.linearRampToValueAtTime(hp, t + 0.8); } catch (_) {}
  }
  function crowd(on) {
    const a = ctx(); if (!a) return;
    if (on && crowdParts.length) { crowdMode(on); return; }
    if (on && !crowdParts.length) {
      const out = a.createGain(); out.gain.value = 0.0001; out.gain.exponentialRampToValueAtTime(0.9, a.currentTime + 1.5);
      const mix = a.createGain(); mix.gain.value = CROWD * (on === 'far' ? 0.36 : on === 'duck' ? 0.08 : 1);
      const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = on === 'far' ? 420 : 40; hp.Q.value = 0.5;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(hp); hp.connect(out); out.connect(mix); mix.connect(sfxG);
      // 声の響き：[高さ, 幅（大きいほど細い）, 大きさ]
      [[680, 2.4, 0.085], [300, 0.9, 0.055], [1050, 2.2, 0.03], [1600, 2, 0.016], [150, 1.2, 0.05]].forEach(([fq, q, vol], k) => {
        const s = a.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true; s.playbackRate.value = 0.9 + k * 0.05;
        const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
        const g = a.createGain(); g.gain.value = vol;
        // 大きさを、ゆっくり・速くの2つの波でゆらす（ざわざわ）
        [[0.17 + k * 0.05, vol * 0.35], [1.3 + k * 0.7, vol * 0.25]].forEach(([fr, dep]) => { const l = a.createOscillator(); l.frequency.value = fr; const lg = a.createGain(); lg.gain.value = dep; l.connect(lg); lg.connect(g.gain); l.start(); crowdParts.push(l); });
        { const l = a.createOscillator(); l.frequency.value = 0.4 + k * 0.13; const lg = a.createGain(); lg.gain.value = fq * 0.06; l.connect(lg); lg.connect(bp.frequency); l.start(); crowdParts.push(l); }
        s.connect(bp); bp.connect(g); g.connect(lp); s.start(0, Math.random()); crowdParts.push(s);
      });
      crowdParts.push({ stop() {}, out });
      crowdGain = out; crowdHp = hp; crowdMix = mix;
    } else if (!on && crowdParts.length) { const parts = crowdParts, g = crowdGain, mx = crowdMix; crowdParts = []; crowdGain = null; crowdHp = null; crowdMix = null; try { const t = a.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); } catch (_) {} try { setTimeout(() => { try { mx.disconnect(); } catch (_) {} }, 700); } catch (_) {} setTimeout(() => parts.forEach((p) => { try { p.stop(); } catch (_) {} }), 800); }
  }

  // ---- BGM：小さな曲を繰り返す（メロディ・ベース・リズム） ----
  // 1拍を4つに分けたマス。'-'は前の音をのばす、'.'は休み
  const SONGS = {
    home: { bpm: 112, mel: 'E5 - G5 - A5 - G5 E5 | C5 - D5 - E5 - . . | D5 - E5 - G5 - E5 D5 | C5 - - - . . . . | E5 - G5 - A5 - C6 A5 | G5 - E5 - D5 - . . | C5 - D5 - E5 - D5 C5 | C5 - - - . . . .',
      bass: 'C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . G2 . D3 . | C3 . G3 . C3 . . .', drum: 'k.h.s.h.' },
    club: { bpm: 96, mel: 'G4 - B4 - D5 - B4 - | C5 - B4 - A4 - . . | A4 - C5 - E5 - C5 - | D5 - - - . . . . | G4 - B4 - D5 - G5 - | F#5 - E5 - D5 - . . | C5 - B4 - A4 - B4 - | G4 - - - . . . .',
      bass: 'G2 . D3 . G2 . D3 . | C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | D3 . A3 . D3 . F#3 . | G2 . D3 . G2 . D3 . | D3 . A3 . D3 . A3 . | C3 . G3 . D3 . A3 . | G2 . D3 . G2 . . .', drum: 'k...s...' },
    prematch: { bpm: 132, mel: 'A4 . A4 . E5 - - . | D5 . C5 . B4 - - . | A4 . A4 . E5 - - . | G5 - F#5 - E5 - . . | C5 . C5 . G5 - - . | F5 . E5 . D5 - - . | E5 . E5 . A5 - G5 - | E5 - - - . . . .',
      bass: 'A2 A2 A3 A2 A2 A2 A3 A2 | G2 G2 G3 G2 G2 G2 G3 G2 | F2 F2 F3 F2 F2 F2 F3 F2 | E2 E2 E3 E2 E2 E2 E3 E2 | C3 C3 C4 C3 C3 C3 C4 C3 | D3 D3 D4 D3 D3 D3 D4 D3 | A2 A2 A3 A2 E2 E2 E3 E2 | A2 A2 A3 A2 A2 . . .', drum: 'k.hsk.hs' },
    // 版558：ハーフタイム（ロッカールーム）。本家はテンポ約130の明るいバンドの曲なので、明るく速い曲にした（曲は自作）
    half: { bpm: 128, mel: 'C5 . F5 . A5 - G5 F5 | G5 - - . . . E5 F5 | G5 . A5 . A#5 - A5 G5 | A5 - - - . . . . | A5 . G5 . F5 - D5 F5 | G5 - - . C5 . E5 G5 | F5 . A5 . G5 - E5 . | F5 - - - . . . .',
      bass: 'F2 . F3 . F2 . F3 . | C3 . C3 . C3 . E3 . | A#2 . A#2 . A#2 . A#3 . | F2 . F3 . A2 . C3 . | D3 . D3 . D3 . A2 . | C3 . C3 . C3 . E3 . | A#2 . A#2 . C3 . C3 . | F2 . C3 . F2 . . .', drum: 'khshkhsh' },
  };
  let cur = null, want = null, timer = null, step = 0, nextT = 0, parsed = null;
  const parse = (s) => s.replace(/\|/g, ' ').trim().split(/\s+/);
  function bgm(name) {
    want = name || null;
    if (cur === want) return;
    clearInterval(timer); timer = null; cur = null;
    if (!want || !SONGS[want]) return;
    const a = ctx(); if (!a || a.state !== 'running') return;
    const S = SONGS[want]; parsed = { mel: parse(S.mel), bass: parse(S.bass), drum: S.drum, sp: 60 / S.bpm / 2 };
    cur = want; step = 0; nextT = a.currentTime + 0.08;
    timer = setInterval(sched, 60); sched();
  }
  function lead(f, d, t0) {
    const a = AC; const t = a.currentTime + t0; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(1500, t + Math.min(d, 0.4)); lp.Q.value = 1;
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.012); g.gain.exponentialRampToValueAtTime(0.04, t + Math.min(d, 0.15)); g.gain.setValueAtTime(0.04, t + Math.max(0.02, d - 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    [-7, 7].forEach((c) => { const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = c; o.connect(lp); o.start(t); o.stop(t + d + 0.02); });
    { const o = a.createOscillator(); o.type = 'square'; o.frequency.value = f; const g2 = a.createGain(); g2.gain.value = 0.35; o.connect(g2); g2.connect(lp); o.start(t); o.stop(t + d + 0.02); }
    lp.connect(g); g.connect(bgmG);
  }
  function bassV(f, d, t0) {
    const a = AC; const t = a.currentTime + t0; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 2;
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.01); g.gain.exponentialRampToValueAtTime(0.08, t + Math.min(d, 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const o2 = a.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f;
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(bgmG); [o, o2].forEach((x) => { x.start(t); x.stop(t + d + 0.02); });
  }
  function noteAt(arr, i) { const n = arr[i % arr.length]; if (n === '-' || n === '.') return null; let len = 1; while (arr[(i + len) % arr.length] === '-' && len < 16) len++; return { f: N(n), len }; }
  function sched() {
    const a = AC; if (!a || !cur) return;
    while (nextT < a.currentTime + 0.25) {
      const t0 = nextT - a.currentTime, sp = parsed.sp;
      // 版558：本家の曲はバンドの音（ピコピコではない）。メロディは2本のギザギザ波を少しずらして柔らかく、ベースは太く、ドラムはキック・スネア・ハイハット
      const m = noteAt(parsed.mel, step); if (m) lead(m.f, m.len * sp * 0.92, t0);
      const b = noteAt(parsed.bass, step); if (b) bassV(b.f, b.len * sp * 0.9, t0);
      if (parsed.drum) { const d = parsed.drum[step % parsed.drum.length]; if (d === 'k') { tone(150, 0.12, 'sine', 0.32, t0, 48, bgmG); noise(0.01, 0.04, 'highpass', 3000, t0, bgmG); } else if (d === 's') { noise(0.13, 0.11, 'bandpass', 1900, t0, bgmG, 0.002); tone(190, 0.07, 'triangle', 0.08, t0, 150, bgmG); } else if (d === 'h') noise(0.035, 0.03, 'highpass', 7000, t0, bgmG, 0.001); }
      step++; nextT += sp;
    }
  }

  // 確認用：音を画面の外で作って、波の形を返す（スピーカーは使わない）
  async function __render(fn, secs = 3) {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; const keep = { AC, master, sfxG, bgmG, noiseBuf, crowdParts, crowdGain, crowdHp, crowdMix };
    const oc = new OC(1, Math.ceil(secs * 22050), 22050); AC = oc; master = oc.createGain(); master.gain.value = 1; master.connect(oc.destination); sfxG = oc.createGain(); sfxG.connect(master); bgmG = oc.createGain(); bgmG.gain.value = 0.55; bgmG.connect(master); noiseBuf = null; crowdParts = []; crowdGain = null;
    const song = (name) => { const kp = [cur, parsed, step, nextT]; const S = SONGS[name]; parsed = { mel: parse(S.mel), bass: parse(S.bass), drum: S.drum, sp: 60 / S.bpm / 2 }; cur = '__r'; step = 0; nextT = 0.05; const end = secs - 0.3; while (nextT < end) sched2(); [cur, parsed, step, nextT] = kp; };
    const sched2 = () => { const sp = parsed.sp, t0 = nextT; const m = noteAt(parsed.mel, step); if (m) lead(m.f, m.len * sp * 0.92, t0); const b = noteAt(parsed.bass, step); if (b) bassV(b.f, b.len * sp * 0.9, t0); if (parsed.drum) { const d = parsed.drum[step % parsed.drum.length]; if (d === 'k') { tone(150, 0.12, 'sine', 0.32, t0, 48, bgmG); noise(0.01, 0.04, 'highpass', 3000, t0, bgmG); } else if (d === 's') { noise(0.13, 0.11, 'bandpass', 1900, t0, bgmG, 0.002); tone(190, 0.07, 'triangle', 0.08, t0, 150, bgmG); } else if (d === 'h') noise(0.035, 0.03, 'highpass', 7000, t0, bgmG, 0.001); } step++; nextT += sp; };
    let buf; try { fn({ SFX, crowd, tone, noise, whistle, song, oc }); buf = await oc.startRendering(); } finally { ({ AC, master, sfxG, bgmG, noiseBuf, crowdParts, crowdGain, crowdHp, crowdMix } = keep); }
    return Array.from(buf.getChannelData(0));
  }
  function set(k, v) {
    pref[k] = v; save(); const a = ctx(); if (!a) return;
    if (k === 'sfx') sfxG.gain.value = v ? 1 : 0;
    if (k === 'bgm') { bgmG.gain.value = v ? 0.55 : 0; }
    if (k === 'vol') master.gain.value = v;
  }
  window.DotSound = { play, bgm, crowd, set, __render, get state() { return { bgm: cur, want, crowd: crowdMix ? +crowdMix.gain.value.toFixed(2) : 0, hp: crowdHp ? Math.round(crowdHp.frequency.value) : 0 }; }, get pref() { return { ...pref }; } };
})();
// ボタンを押した時の音（戻るボタンは別の音）
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled || !window.DotSound) return;
  const back = b.querySelector('.bk-ico') || /もどる|戻る/.test(b.title || '') || b.id === 'wStop';
  DotSound.play(back ? 'back' : 'tap');
}, true);

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
  function whistle(d = 0.28, t0 = 0) {
    const a = ctx(); if (!a) return; const t = a.currentTime + t0;
    const o = a.createOscillator(), lfo = a.createOscillator(), lg = a.createGain(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 38; lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.02); g.gain.setValueAtTime(0.16, t + d - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(sfxG); o.start(t); lfo.start(t); o.stop(t + d + 0.02); lfo.stop(t + d + 0.02);
  }
  const N = (s) => { const m = /^([A-G])(#?)(\d)$/.exec(s); if (!m) return 0; const k = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0) + (+m[3] - 4) * 12; return 440 * Math.pow(2, k / 12); };

  // ---- 効果音 ----
  const SFX = {
    tap() { tone(1046, 0.05, 'square', 0.07); },
    ok() { tone(784, 0.07, 'square', 0.09); tone(1175, 0.1, 'square', 0.09, 0.07); },
    back() { tone(660, 0.06, 'square', 0.07); tone(440, 0.08, 'square', 0.07, 0.06); },
    kick() { noise(0.06, 0.32, 'lowpass', 1400); tone(150, 0.09, 'sine', 0.35, 0, 55); },
    whistle() { whistle(0.26); },
    whistle2() { whistle(0.18); whistle(0.42, 0.24); },
    whistle3() { whistle(0.2); whistle(0.2, 0.32); whistle(0.7, 0.64); },
    goal() {
      noise(2.8, 0.22, 'bandpass', 900, 0, null, 0.25); noise(2.4, 0.12, 'bandpass', 2200, 0.1, null, 0.3);
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(N(n), 0.16, 'square', 0.12, 0.05 + i * 0.1));
      tone(N('G5'), 0.12, 'square', 0.12, 0.5); tone(N('C6'), 0.5, 'square', 0.13, 0.62);
      tone(N('C4'), 0.6, 'triangle', 0.25, 0.62); tone(N('E4'), 0.6, 'triangle', 0.18, 0.62);
    },
    ooh() { noise(1.2, 0.12, 'bandpass', 700, 0, null, 0.15); tone(330, 0.9, 'sine', 0.05, 0, 220); },
    skill() { [880, 1320, 1760, 2349].forEach((f, i) => tone(f, 0.09, 'triangle', 0.12, i * 0.045)); },
    uniq() { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.08, i * 0.05)); noise(0.5, 0.06, 'highpass', 4000, 0.05); },
    card() { whistle(0.3); tone(220, 0.25, 'square', 0.06, 0.32); },
    week() { tone(N('E5'), 0.12, 'triangle', 0.16); tone(N('A5'), 0.12, 'triangle', 0.16, 0.1); tone(N('E6'), 0.35, 'triangle', 0.14, 0.2); },
    win() { [['C5', 0], ['C5', 0.12], ['C5', 0.24], ['G5', 0.4], ['E5', 0.6], ['G5', 0.75], ['C6', 0.9]].forEach(([n, t]) => tone(N(n), t === 0.9 ? 0.7 : 0.12, 'square', 0.12, t)); tone(N('C4'), 1.4, 'triangle', 0.22, 0.2); },
    lose() { [['E5', 0], ['D#5', 0.25], ['D5', 0.5], ['C#5', 0.75]].forEach(([n, t]) => tone(N(n), t === 0.75 ? 0.8 : 0.22, 'square', 0.1, t)); tone(N('A3'), 1.4, 'triangle', 0.2, 0.2); },
    draw() { [['E5', 0], ['G5', 0.18], ['E5', 0.36], ['D5', 0.54]].forEach(([n, t]) => tone(N(n), t === 0.54 ? 0.5 : 0.15, 'square', 0.1, t)); },
  };
  let lastAt = {};
  function play(name) {
    if (!pref.sfx) return; const a = ctx(); if (!a || a.state !== 'running') return;
    const now = performance.now(); if (lastAt[name] && now - lastAt[name] < (name === 'kick' ? 70 : 40)) return; lastAt[name] = now;   // 同じ音が重なりすぎないように
    try { (SFX[name] || (() => {}))(); } catch (_) {}
  }

  // ---- 観客の声（試合中ずっと） ----
  function crowd(on) {
    const a = ctx(); if (!a) return;
    if (on && !crowdNode) {
      const s = a.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true;
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.6;
      crowdGain = a.createGain(); crowdGain.gain.value = 0.0001; crowdGain.gain.exponentialRampToValueAtTime(0.05, a.currentTime + 1.2);
      s.connect(f); f.connect(crowdGain); crowdGain.connect(sfxG); s.start(); crowdNode = s;
    } else if (!on && crowdNode) { const n = crowdNode, g = crowdGain; crowdNode = null; try { g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.6); n.stop(a.currentTime + 0.7); } catch (_) {} }
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
    half: { bpm: 84, mel: 'E5 - - - D5 - C5 - | D5 - - - . . . . | C5 - - - B4 - A4 - | B4 - - - . . . . | A4 - C5 - E5 - D5 - | C5 - B4 - A4 - G4 - | A4 - - - . . . . | . . . . . . . .',
      bass: 'A2 - - - E3 - - - | G2 - - - D3 - - - | F2 - - - C3 - - - | E2 - - - B2 - - - | A2 - - - E3 - - - | F2 - - - G2 - - - | A2 - - - E3 - - - | A2 - - - . . . .', drum: '' },
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
  function noteAt(arr, i) { const n = arr[i % arr.length]; if (n === '-' || n === '.') return null; let len = 1; while (arr[(i + len) % arr.length] === '-' && len < 16) len++; return { f: N(n), len }; }
  function sched() {
    const a = AC; if (!a || !cur) return;
    while (nextT < a.currentTime + 0.25) {
      const t0 = nextT - a.currentTime, sp = parsed.sp;
      const m = noteAt(parsed.mel, step); if (m) tone(m.f, m.len * sp * 0.92, 'square', 0.07, t0, null, bgmG);
      const b = noteAt(parsed.bass, step); if (b) tone(b.f, b.len * sp * 0.9, 'triangle', 0.16, t0, null, bgmG);
      if (parsed.drum) { const d = parsed.drum[step % parsed.drum.length]; if (d === 'k') { tone(130, 0.08, 'sine', 0.22, t0, 45, bgmG); } else if (d === 's') noise(0.08, 0.06, 'highpass', 1800, t0, bgmG); else if (d === 'h') noise(0.03, 0.025, 'highpass', 6000, t0, bgmG); }
      step++; nextT += sp;
    }
  }

  function set(k, v) {
    pref[k] = v; save(); const a = ctx(); if (!a) return;
    if (k === 'sfx') sfxG.gain.value = v ? 1 : 0;
    if (k === 'bgm') { bgmG.gain.value = v ? 0.55 : 0; }
    if (k === 'vol') master.gain.value = v;
  }
  window.DotSound = { play, bgm, crowd, set, get pref() { return { ...pref }; } };
})();
// ボタンを押した時の音（戻るボタンは別の音）
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled || !window.DotSound) return;
  const back = b.querySelector('.bk-ico') || /もどる|戻る/.test(b.title || '') || b.id === 'wStop';
  DotSound.play(back ? 'back' : 'tap');
}, true);

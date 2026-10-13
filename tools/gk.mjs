import '../engine/engine.js';
const D = globalThis.DotSoccer;
let on = 0, goals = 0, saves = 0, g = 0, gkgk = 0, gk = 0, chips = 0, n = 0, shots = 0;
for (const o of D.PRESET_NAMES) for (let i = 0; i < 12; i++) {
  const r = D.simulateMatch(D.beginningTeam(), D.presetTeam(o), i + 1, { frames: false });
  n++; g += r.score[0] + r.score[1];
  for (const s of r.stats) { on += s.shots_on_target; saves += s.saves; shots += s.shots; }
  const ev = r.events;
  for (let k = 0; k < ev.length; k++) { if (ev[k].type === 'shot' && ev[k].chip) chips++; if (ev[k].type === 'goalkick') { gk++; const nx = ev.slice(k + 1).find((e) => ['goalkick', 'corner', 'throw', 'goal', 'shot', 'tackle', 'foul', 'offside', 'save', 'gk'].includes(e.type)); if (nx && nx.type === 'goalkick' && nx.team !== ev[k].team && nx.t - ev[k].t < 14) gkgk++; } }
}
console.log({ goalsPerGame: (g / n).toFixed(2), shotsPerGame: (shots / n).toFixed(1), onTarget: (on / n).toFixed(1), saveRate: (saves / on).toFixed(2), goalkicks: gk, gk_to_oppGK: gkgk, chips });

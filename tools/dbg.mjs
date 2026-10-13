import '../engine/engine.js';
const D = globalThis.DotSoccer;
const r = D.simulateMatch(D.beginningTeam(), D.presetTeam('バランス型'), 3);
const f=r.frames; const P=22;
// ball x histogram, owner team share, z
let hist=new Array(7).fill(0), own=0, loose=0;
for(const fr of f){hist[Math.min(6,Math.floor(fr[1]/15))]++; if(fr[4]>=0)own++; else loose++;}
console.log('ball x hist',hist.join(' '),'owned',own,'free',loose);
const ty={}; for(const e of r.events){ty[e.type]=(ty[e.type]||0)+1}
console.log(ty);
console.log(r.stats.map(s=>({p:s.passes,pc:s.passes_completed,tw:s.tackles_won,tl:s.tackles_lost,dp:s.dribbles_past,sh:s.shots})));
// sample positions every 30s
for(let i=0;i<f.length;i+=150){const fr=f[i];let xs0=[],xs1=[];for(let k=0;k<22;k++){(k<11?xs0:xs1).push(fr[7+k*3].toFixed(0))}console.log(fr[0].toFixed(0),'ball',fr[1].toFixed(0),fr[2].toFixed(0),'own',fr[4],'| A',xs0.join(','),'| B',xs1.join(','))}

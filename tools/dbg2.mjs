import '../engine/engine.js';
const D = globalThis.DotSoccer;
const r = D.simulateMatch(D.beginningTeam(), D.presetTeam('バランス型'), 3);
const f=r.frames; const names=r.roster[0].map(p=>p.type);
let cnt=0, own={};
for(let i=0;i<f.length;i+=1){const fr=f[i]; const o=fr[4]; if(o>=0){own[o]=(own[o]||0)+1}
 if(o>=0&&o<11&&i%40===0&&cnt<12){cnt++; const ox=fr[7+o*3], oy=fr[8+o*3]; console.log('t',fr[0].toFixed(0),'owner',o,names[o],ox.toFixed(0),oy.toFixed(0),'| reg5',fr[7+15].toFixed(0),fr[8+15].toFixed(0),'reg8',fr[7+24].toFixed(0),fr[8+24].toFixed(0),'dyn6',fr[7+18].toFixed(0),fr[8+18].toFixed(0))}}
console.log('owner frames',own);

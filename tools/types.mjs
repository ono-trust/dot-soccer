import '../engine/engine.js';
const D = globalThis.DotSoccer;
const n=+(process.argv[2]||20); const agg={};
for (let i=0;i<n;i++){ for (const o of D.PRESET_NAMES){ const r=D.simulateMatch(D.beginningTeam(),D.presetTeam(o),i*7+1,{frames:false});
 for (const g of Object.values(r.typeLog)){ if(g.team!==0) continue; const a=agg[g.type]??={atkX:0,atkN:0,defX:0,defN:0,distOwner:0,nOwner:0,box:0,beyondLine:0,pressSum:0}; for(const k in a) a[k]+=g[k]; } } }
console.log('type        攻撃時平均x 守備時平均x 保持者との距離 PA内% 最終ライン付近% 寄せ%');
for (const [t,a] of Object.entries(agg)) console.log(t.padEnd(8,'　'), (a.atkX/a.atkN).toFixed(1).padStart(8), (a.defX/a.defN).toFixed(1).padStart(8), (a.distOwner/a.nOwner).toFixed(1).padStart(8), (100*a.box/a.atkN).toFixed(0).padStart(6), (100*a.beyondLine/a.atkN).toFixed(0).padStart(6), (100*a.pressSum/a.defN).toFixed(0).padStart(6));

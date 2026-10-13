import '../engine/engine.js';
const D = globalThis.DotSoccer;
const n = +(process.argv[2]||20);
const opps = process.argv[3] ? [process.argv[3]] : D.PRESET_NAMES;
let agg = {g:0,sh:0,on:0,pass:0,pc:0,off:0,cor:0,foul:0,tk:0,draw:0,games:0,ms:0};
const t0=Date.now();
for (const o of opps) {
  let w=0,d=0,l=0,gf=0,ga=0;
  for (let i=0;i<n;i++){
    const r = D.simulateMatch(D.beginningTeam(), D.presetTeam(o), i+1, {frames:false});
    const [a,b]=r.score; gf+=a; ga+=b; if(a>b)w++; else if(a<b)l++; else d++;
    agg.games++; agg.g+=a+b; if(a===b)agg.draw++;
    for(const s of r.stats){agg.sh+=s.shots;agg.on+=s.shots_on_target;agg.pass+=s.passes;agg.pc+=s.passes_completed;agg.off+=s.offsides;agg.cor+=s.corners;agg.foul+=s.fouls;agg.tk+=s.tackles_won;}
  }
  console.log(o.padEnd(6), `W${w} D${d} L${l}  GF ${(gf/n).toFixed(2)} GA ${(ga/n).toFixed(2)}`);
}
const G=agg.games, S=G*2;
console.log(`goals/g ${(agg.g/G).toFixed(2)} draw ${(100*agg.draw/G).toFixed(0)}% shots/t ${(agg.sh/S).toFixed(1)} on ${(agg.on/S).toFixed(1)} pass/t ${(agg.pass/S).toFixed(0)} pass% ${(100*agg.pc/agg.pass).toFixed(0)} off ${(agg.off/S).toFixed(1)} cor ${(agg.cor/S).toFixed(1)} foul ${(agg.foul/S).toFixed(1)} tackles ${(agg.tk/S).toFixed(1)}  ${(Date.now()-t0)/G|0}ms/game`);

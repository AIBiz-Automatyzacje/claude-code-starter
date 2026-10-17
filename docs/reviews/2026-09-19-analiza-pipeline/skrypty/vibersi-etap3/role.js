const runs={e1:"wf_b60193c7-987",e2:"wf_97e2f216-487",e3:"wf_f17e9b2e-8d4"};const m=new Map();
for(const l of require("fs").readFileSync(require("os").homedir()+"/.claude/telemetry/pipeline.jsonl","utf8").split("\n")){if(!l)continue;const r=JSON.parse(l);if(r.typ==="agent"&&Object.values(runs).includes(r.run))m.set(r.klucz,r)}
const roles=["build","fix","fix:poprawka","fix:kontrola","domkniecie","review:test-coverage","review:correctness","review:code-quality","verify-batch","planner","scribe"];
const med=a=>{a=[...a].sort((x,y)=>x-y);return a.length?a[a.length>>1]:0};
for(const ro of roles){for(const [k,id] of Object.entries(runs)){const a=[...m.values()].filter(r=>r.run===id&&r.rola===ro);if(!a.length)continue;const s=f=>a.reduce((x,r)=>x+(r[f]||0),0);
console.log(ro.padEnd(22),k,"n",a.length,"koszt",(s("koszt_jedn")/1e6).toFixed(2),"tury śr",(s("tury")/a.length).toFixed(0),"ctx_start p50",Math.round(med(a.map(r=>r.ctx_start))/1000)+"k","ctx_sr p50",Math.round(med(a.map(r=>r.ctx_sr||0))/1000)+"k","ctx_max p50",Math.round(med(a.map(r=>r.ctx_max||0))/1000)+"k","out śr",Math.round(s("out")/a.length/1000)+"k","koszt/agent",(s("koszt_jedn")/a.length/1e6).toFixed(2))}}

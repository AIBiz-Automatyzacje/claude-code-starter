import json,subprocess,os,sys,time,collections
SP=sys.argv[1]; WT=SP+'/oo-wt'; os.chdir(WT)
def sh(cmd,timeout=900,cwd=None):
    t=time.time(); p=subprocess.run(cmd,shell=True,capture_output=True,text=True,timeout=timeout,cwd=cwd or WT); return time.time()-t,p
log=open(SP+'/pomiar2.log','w')
def L(*a): print(*a,file=log,flush=True); print(*a,flush=True)
# --- size-limit
t,p=sh('npx size-limit --json'); L('size-limit',round(t,1),'s', p.stdout[:600], p.stderr[-300:])
# --- stryker (dashboard, 3 pliki z commitu fixa 417a9fd)
t,p=sh('npx stryker run', timeout=1800, cwd=WT+'/apps/dashboard'); L('stryker',round(t,1),'s'); open(SP+'/stryker.out','w').write(p.stdout+'\n---STDERR---\n'+p.stderr)
try:
    m=json.load(open(WT+'/apps/dashboard/reports/mutation.json')); tot=collections.Counter()
    for f,v in m['files'].items():
        st=collections.Counter(x['status'] for x in v['mutants']); tot+=st; L('  ',f.split('src/')[-1],dict(st))
    L('  RAZEM',dict(tot))
except Exception as e: L('  stryker report brak',e)
# --- per PR lint
uw=json.load(open(SP+'/uwagi-B-per-pr.json'))
heads={int(l.split('\t')[0]):l.split('\t')[1] for l in open(SP+'/pr-heads.tsv') if l.strip()}
RULES_OK=None
wyn=[]
for pr in sorted(uw,key=int):
    sha=heads.get(int(pr)); 
    if not sha: L('PR',pr,'brak sha'); continue
    t,p=sh(f'git checkout -q --detach {sha} && git checkout -q HEAD -- . 2>/dev/null; true')
    if p.returncode: L('PR',pr,'checkout FAIL',p.stderr[:200]); continue
    # przywroc nasze pliki konfiguracyjne (checkout je nadpisze? sa untracked -> zostaja)
    sh('pnpm --filter @oferty/shared run build >/dev/null 2>&1; true')
    pliki=sorted(set(u['plik'] for u in uw[pr] if os.path.exists(WT+'/'+u['plik']) and u['plik'].endswith(('.ts','.tsx'))))
    brak=[u['plik'] for u in uw[pr] if not os.path.exists(WT+'/'+u['plik'])]
    if not pliki: L('PR',pr,'brak plikow ts', brak[:3]); wyn.append({'pr':int(pr),'uwag':len(uw[pr]),'plikow':0,'brak':brak}); continue
    t,p=sh('npx eslint --no-cache -f json '+' '.join(pliki), timeout=600)
    try: res=json.loads(p.stdout)
    except Exception: L('PR',pr,'eslint parse fail',p.stdout[:200],p.stderr[:300]); continue
    msgs=[]
    for f in res:
        rel=f['filePath'].split('oo-wt/')[-1]
        for m in f['messages']:
            if m.get('ruleId') and not m['ruleId'].startswith('@typescript-eslint/no-unsafe'): msgs.append({'plik':rel,'linia':m['line'],'rule':m['ruleId'],'sev':m['severity'],'msg':m['message'][:120]})
    trafienia=[]
    for u in uw[pr]:
        hits=[m for m in msgs if m['plik']==u['plik'] and u['linia'] is not None and abs(m['linia']-u['linia'])<=3]
        hits_err=[m for m in hits if m['sev']==2]
        trafienia.append({**u,'lint_trafienia':[(m['rule'],m['linia']) for m in hits_err][:6],'lint_warn':[(m['rule'],m['linia']) for m in hits if m['sev']==1][:4]})
    n_hit=sum(1 for x in trafienia if x['lint_trafienia'])
    L(f'PR {pr}: uwag B {len(uw[pr])}, plikow ts {len(pliki)} (brak {len(brak)}), lint {round(t,1)}s, komunikatow {len(msgs)}, uwag B z trafieniem ERROR ±3 linie: {n_hit}')
    wyn.append({'pr':int(pr),'uwag':len(uw[pr]),'plikow':len(pliki),'brak':brak,'lint_s':round(t,1),'komunikaty':len(msgs),'trafien':n_hit,'uwagi':trafienia,'reguly_w_plikach':dict(collections.Counter(m['rule'] for m in msgs if m['sev']==2))})
    json.dump(wyn,open(SP+'/pomiar2-wyniki.json','w'),ensure_ascii=False,indent=1)
sh('git checkout -q --detach e8f9b97')
L('DONE')

import json,sys,os,collections
F=os.path.expanduser('~/.claude/telemetry/pipeline.jsonl')
last={}
for l in open(F):
    r=json.loads(l)
    key=(r.get('typ'),r.get('run'),r.get('agent') or r.get('id') or r.get('faza'))
    last[key]=r
runs=[r for (t,_,_),r in last.items() if t=='run' and r.get('projekt')=='vibersi' and r.get('start','')>='2026-10-17']
for r in sorted(runs,key=lambda r:r['start']):
    print(r['start'][:16],r['run'],r['workflow'],r['zadanie'][:30],r['status'],r.get('stop_kategoria'),round(r['koszt']['jedn']/1e6,2),'M ag',r['koszt']['agentow'],'s',r.get('sekundy'),'e2e',r.get('e2eSrodowisko'),'man',r.get('manual_razem'),'pr',r.get('pr'))

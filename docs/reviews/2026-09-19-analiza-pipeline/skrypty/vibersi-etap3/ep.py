import json,sys,os,collections
P=os.path.expanduser('~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-vibersi/')
eps=[('e1a','81e81c7f-3d00-4652-a6bc-ec77d0130bd9','2026-10-09T19:53:44','2026-10-09T20:38:31'),
('e1b','6a039663-28ae-4938-821d-ecf095577c52','2026-10-09T20:41:47','2026-10-09T21:07:47'),
('e2','d4ba5a5a-0728-4c9e-8203-39080380062f','2026-10-11T17:34:40','2026-10-11T23:12:34'),
('e2p','ece73440-3a0a-43c6-a3a7-32d4f34e45c1','2026-10-12T11:11:20','2026-10-12T13:02:11'),
('e3','8b09672c-e099-48a0-b5e3-6b2e8e2adc18','2026-10-14T20:17:20','2026-10-15T05:56:47')]
mode=sys.argv[1] if len(sys.argv)>1 else 'sum'
for name,s,a,b in eps:
    f=P+s+'.jsonl'
    if not os.path.exists(f): print(name,'brak',f); continue
    rows=[json.loads(l) for l in open(f)]
    # session start ctx
    seen=set(); turns=[]; reads=collections.Counter(); tools=collections.Counter(); bigres=[]; idmap={}
    allturns=[]
    for r in rows:
        ts=r.get('timestamp','')
        m=r.get('message') or {}
        if r.get('type')=='assistant' and m.get('usage'):
            mid=m.get('id')
            u=m['usage']; ctx=u.get('input_tokens',0)+u.get('cache_read_input_tokens',0)+u.get('cache_creation_input_tokens',0)
            if mid not in seen:
                seen.add(mid); allturns.append((ts,ctx))
                if a<=ts[:19]<=b: turns.append((ts,ctx,u.get('cache_creation_input_tokens',0),u.get('output_tokens',0)))
        if not (a<=ts[:19]<=b): continue
        c=m.get('content')
        if isinstance(c,list):
            for x in c:
                if x.get('type')=='tool_use':
                    nm=x['name']; inp=x.get('input',{})
                    key=nm
                    if nm=='Read': key='Read '+inp.get('file_path','').replace('/Users/kacper_trzepiecinski/Documents/Kodowanie/vibersi/','')
                    elif nm=='Bash': key='Bash '+inp.get('command','')[:90].replace('\n',' ')
                    elif nm=='Agent': key='Agent '+str(inp.get('subagent_type'))+' | '+inp.get('description','')
                    elif nm.startswith('mcp__'): key=nm
                    elif nm=='Skill': key='Skill '+inp.get('skill','')
                    tools[key]+=1; idmap[x['id']]=key
                if x.get('type')=='tool_result':
                    t=x.get('content'); t=t if isinstance(t,str) else json.dumps(t)
                    bigres.append((len(t),idmap.get(x.get('tool_use_id'),'?')))
        elif isinstance(c,str) and r.get('type')=='user' and a<=ts[:19]:
            pass
    pre=[c for t,c in allturns if t[:19]<a]
    print('=====',name,s[:8],'tury w oknie',len(turns),'ctx przed epizodem',pre[-1] if pre else 0,'ctx start',turns[0][1] if turns else None,'ctx koniec',turns[-1][1] if turns else None,'max',max(t[1] for t in turns) if turns else None, 'sr',int(sum(t[1] for t in turns)/max(1,len(turns))), 'cache_w suma',sum(t[2] for t in turns))
    if mode=='full':
        print(' tools:'); [print('  ',n,k[:160]) for k,n in tools.most_common(40)]
        print(' najwieksze wyniki (zn):'); [print('  ',n,k[:140]) for n,k in sorted(bigres,reverse=True)[:15]]
        print(' zn wynikow suma',sum(n for n,k in bigres))

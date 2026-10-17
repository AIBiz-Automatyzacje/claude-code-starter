import json,os,glob,sys
P=os.path.expanduser('~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-vibersi/')
for s,a,b in [('81e81c7f-3d00-4652-a6bc-ec77d0130bd9','2026-10-09T19:53','2026-10-09T20:39'),('d4ba5a5a-0728-4c9e-8203-39080380062f','2026-10-11T17:34','2026-10-11T23:13'),('8b09672c-e099-48a0-b5e3-6b2e8e2adc18','2026-10-14T20:17','2026-10-15T05:57')]:
    print('==',s[:8])
    for f in sorted(glob.glob(P+s+'/subagents/agent-*.jsonl')):
        rows=[json.loads(l) for l in open(f)]
        t0=rows[0].get('timestamp','')[:16]
        if not(a<=t0<=b): continue
        meta=f.replace('.jsonl','.meta.json'); d=json.load(open(meta)) if os.path.exists(meta) else {}
        seen=set();cost=0;n=0;ctx0=None;ctxm=0;model=None;tools={}
        for r in rows:
            m=r.get('message') or {}
            if r.get('type')=='assistant' and m.get('usage') and m['id'] not in seen:
                seen.add(m['id']);u=m['usage'];n+=1;model=m.get('model')
                c=u.get('input_tokens',0)+u.get('cache_read_input_tokens',0)+u.get('cache_creation_input_tokens',0)
                ctx0=ctx0 or c; ctxm=max(ctxm,c)
                mult=1 if 'opus' in (model or '') else (0.6 if 'sonnet' in (model or '') else 0.2)
                cost+=(u.get('cache_read_input_tokens',0)*0.1+u.get('cache_creation_input_tokens',0)*1.25+u.get('output_tokens',0)*5+u.get('input_tokens',0))
            c=m.get('content')
            if isinstance(c,list):
                for x in c:
                    if x.get('type')=='tool_use': tools[x['name']]=tools.get(x['name'],0)+1
        print(' ',d.get('agentType'),'|',d.get('description'),'| model',model,'| tury',n,'| ctx0',ctx0,'max',ctxm,'| koszt(opus-jedn) %.2f M'%(cost/1e6),'|',dict(sorted(tools.items(),key=lambda x:-x[1])[:6]))

import json,sys,os
P=os.path.expanduser('~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-vibersi/')
s,a,b=sys.argv[1:4]
rows=[json.loads(l) for l in open(P+s+'.jsonl')]
seen=set();prev=None;last_tools=[]
for r in rows:
    ts=r.get('timestamp','')[:19]; m=r.get('message') or {}
    c=m.get('content')
    if r.get('type')=='user' and isinstance(c,list):
        for x in c:
            if x.get('type')=='tool_result':
                t=x.get('content'); t=t if isinstance(t,str) else json.dumps(t); last_tools.append(len(t))
    if r.get('type')=='user' and isinstance(c,str): last_tools.append(('U',len(c)))
    if r.get('type')=='assistant' and m.get('usage') and m.get('id') not in seen:
        seen.add(m['id']); u=m['usage']; ctx=u.get('input_tokens',0)+u.get('cache_read_input_tokens',0)+u.get('cache_creation_input_tokens',0)
        if a<=ts<=b:
            kinds=[x.get('type')+(':'+x.get('name','') if x.get('type')=='tool_use' else '') for x in (c or []) if isinstance(x,dict)]
            print(ts[11:],ctx,'+'+str(ctx-prev) if prev else '',u.get('output_tokens'),kinds,last_tools[-4:])
        prev=ctx; last_tools=[]

import json,os,glob,sys,collections,re
S=os.path.expanduser('~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-vibersi/')
def find(sess,wf,desc):
    d=S+sess+'/subagents/workflows/'+wf
    for m in glob.glob(d+'/*.meta.json'):
        if json.load(open(m)).get('description')==desc: return m.replace('.meta.json','.jsonl')
def cat(key):
    k=key
    if k.startswith('Read'): 
        if re.search(r'\.(png|jpg)',k): return 'Read obraz'
        if 'test' in k: return 'Read test'
        if '/tmp/' in k: return 'Read /tmp (dossier/diff/log)'
        if 'docs/' in k: return 'Read docs/plan'
        if '.claude' in k: return 'Read .claude'
        return 'Read kod'
    if k.startswith('Bash'):
        c=k[5:]
        if re.search(r'vitest|pnpm test|pnpm exec vitest',c): return 'Bash vitest'
        if re.search(r'tsc|typecheck',c): return 'Bash tsc'
        if re.search(r'eslint|lint',c): return 'Bash eslint'
        if 'bramki' in c or 'stryker' in c: return 'Bash bramki/stryker'
        if re.search(r'git (diff|show|log)',c): return 'Bash git diff/show'
        if re.search(r'\b(sed|cat|head|tail|awk)\b',c): return 'Bash odczyt pliku'
        if re.search(r'grep|rg |find|ls',c): return 'Bash szukanie'
        if 'figma' in c.lower(): return 'Bash figma'
        return 'Bash inne'
    if k.startswith('mcp__plugin_figma'): return k
    return k.split(' ')[0]
def an(f,show=False):
    rows=[json.loads(l) for l in open(f)]
    seen=set();idmap={};res=collections.Counter();resn=collections.Counter();turns=[];toolsByTurn=[]
    for r in rows:
        m=r.get('message') or {}; c=m.get('content')
        if r.get('type')=='assistant' and m.get('usage') and m['id'] not in seen:
            seen.add(m['id']);u=m['usage'];turns.append(u.get('input_tokens',0)+u.get('cache_read_input_tokens',0)+u.get('cache_creation_input_tokens',0))
        if isinstance(c,list):
            for x in c:
                if x.get('type')=='tool_use':
                    inp=x.get('input',{});nm=x['name']
                    key=nm+' '+(inp.get('file_path') or inp.get('command') or '')
                    idmap[x['id']]=(cat(key),key[:120])
                    if nm in('Edit','Write'):
                        res['wejscie '+nm]+=len(json.dumps(inp));resn['wejscie '+nm]+=1
                if x.get('type')=='tool_result':
                    t=x.get('content');
                    if isinstance(t,list):
                        n=sum(len(y.get('text','')) if y.get('type')=='text' else 6000 for y in t)  # obraz ~ liczony osobno
                    else: n=len(t or '')
                    k=idmap.get(x.get('tool_use_id'),('?',''))[0]; res[k]+=n; resn[k]+=1
    tot=sum(res.values())
    return turns,res,resn,tot
if __name__=='__main__':
    sess,wf=sys.argv[1],sys.argv[2]
    for desc in sys.argv[3:]:
        f=find(sess,wf,desc)
        if not f: print(desc,'brak'); continue
        turns,res,resn,tot=an(f)
        print('==',desc,'tury',len(turns),'ctx start',turns[0],'koniec',turns[-1],'max',max(turns),'zn wynikow/wejsc',tot)
        for k,n in res.most_common(12): print('   %-32s %4d× %7d zn (%2d%%)'%(k,resn[k],n,100*n//max(1,tot)))

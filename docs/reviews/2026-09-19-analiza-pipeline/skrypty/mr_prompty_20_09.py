#!/usr/bin/env python3
"""Mini-run seria E: prawdziwe prompty z runu 20.09 (wf_e5c34cd8-66c) — per komorka (klasa roli x model x plik agenta)
agent z medianowym ctx_start. rola()/klasa() jak w d4r_dzwignia_kontekstu.py. Wyjscie: dane/mr-prompty/e-prompty.json + e-*.txt"""
import glob, json, os, re, statistics
RUN = os.path.expanduser('~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-oferty-online/fe75c12a-5921-437c-bfc2-d54cf480a228/subagents/workflows/wf_e5c34cd8-66c')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dane', 'mr-prompty')
OMIT = {'stan:zapis', 'telemetria', 'dedup:semantyczny', 'e2e:precheck', 'kontekst:diff', 'zwin-do-poprawy', 'e2e:env-down', 'fix:pre-skan', 'stop:commit-artefaktow'}
SCEPT = {'verify', 'verify-batch', 'verify-fix'}; NAPR = {'fix', 'fix:poprawka'}
PREF = '[Workflow harness — computed task]'

def rola(d):
    d = d or '?'
    d = re.sub(r'^(verify-batch|verify-fix|verify):.*$', r'\1', d)
    d = re.sub(r':faza-\d+$|:IU-\d+(\.\d+)?$|:\d+$', '', d)
    d = re.sub(r'^(fix:pre-skan|fix:kontrola|fix:poprawka|build|smoke-operatora|complete|compound|telemetria|stop|planner|domkniecie|'
               r'scribe|fix|zwin-do-poprawy|e2e:db-sync|kontekst:diff|stan:zapis):.*$', r'\1', d)
    return d

def klasa(r):
    if r in OMIT: return 'mechaniczny'
    if r in SCEPT: return 'sceptyk'
    if r.startswith('review:'): return 'reviewer'
    if r == 'build': return 'builder'
    if r in NAPR: return 'naprawiacz'
    return 'orkiestracyjny'

rows = []
for mf in glob.glob(os.path.join(RUN, 'agent-*.meta.json')):
    meta = json.load(open(mf)); jf = mf[:-10] + '.jsonl'
    prompt = None; ctx = None; model = None
    for line in open(jf):
        o = json.loads(line)
        if o.get('type') == 'user' and prompt is None:
            c = o['message']['content']
            c = c if isinstance(c, str) else ''.join(b.get('text', '') for b in c if isinstance(b, dict))
            if c.startswith(PREF):
                body = c.split('The computed task text follows:\n', 1)[1]
                prompt = '\n'.join(l[2:] if l.startswith('  ') else l for l in body.split('\n'))
        if o.get('type') == 'assistant':
            u = o['message'].get('usage') or {}; model = o['message'].get('model')
            ctx = u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0)
            break
    if not prompt or ctx is None: continue
    r = rola(meta.get('description')); k = klasa(r)
    m = 'haiku' if 'haiku' in (model or '') else 'opus'
    at = meta.get('agentType')
    kom = k + '-' + m
    if k == 'reviewer': kom += '-plik' if at != 'workflow-subagent' else '-bezpliku'
    rows.append(dict(komorka=kom, klasa=k, model=m, rola=r, label=meta.get('description'), agentType=at, ctx_start=ctx, prompt=prompt, agent=os.path.basename(jf)))

wynik = {}
for kom in sorted(set(r['komorka'] for r in rows)):
    g = sorted((r for r in rows if r['komorka'] == kom), key=lambda r: r['ctx_start'])
    med = g[(len(g) - 1) // 2]
    wynik[kom] = dict((k, v) for k, v in med.items()) | {'n': len(g), 'ctx_p50': statistics.median(r['ctx_start'] for r in g)}
    open(os.path.join(OUT, 'e-' + kom + '.txt'), 'w').write(med['prompt'])
json.dump(wynik, open(os.path.join(OUT, 'e-prompty.json'), 'w'), ensure_ascii=False, indent=1)
for k, v in wynik.items():
    print('%-28s n=%3d wybrany %-40s agentType=%-22s ctx=%6d p50=%6d prompt_zn=%d' % (k, v['n'], v['label'][:40], v['agentType'], v['ctx_start'], v['ctx_p50'], len(v['prompt'])))

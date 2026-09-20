#!/usr/bin/env python3
"""Model kosztu per agent dla wszystkich runow workflowow (dev-autopilot, dev-pr, compound...).
Zrodlo: ~/.claude/projects/<proj>/<sesja>/subagents/workflows/wf_*/agent-*.{meta.json,jsonl}
Wynik: agents.csv + tabele podsumowan na stdout.
Cennik wzgledny (input=1): cache_write 1.25, cache_read 0.1, output 5.
"""
import csv, glob, json, os, re, sys, collections, datetime

ROOT = os.path.expanduser('~/.claude/projects')
PROJS = ['oferty-online', 'akademia-automatyzacji-dashboard', 'claude-cron', 'Nawykometr', 'symulator-poczekalni']
OUT = sys.argv[1] if len(sys.argv) > 1 else 'agents.csv'
W_IN, W_CW, W_CR, W_OUT = 1.0, 1.25, 0.1, 5.0

def rola(desc):
    d = desc or '?'
    d = re.sub(r'^(verify-batch|verify-fix|verify):.*$', r'\1', d)
    d = re.sub(r':faza-\d+$|:IU-\d+(\.\d+)?$|:\d+$', '', d)
    d = re.sub(r'^(build|smoke-operatora|complete|compound|telemetria|stop|planner|domkniecie|scribe|fix|fix:pre-skan|fix:kontrola|fix:poprawka|zwin-do-poprawy|e2e:db-sync|kontekst:diff|stan:zapis):.*$', r'\1', d)
    return d

def ts(s):
    try: return datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except Exception: return None

OSIE = [
    (r'auth, RLS', 'review:security'), (r'zgodnosc implementacji ze spec', 'review:spec-compliance'),
    (r'N\+1 queries', 'review:performance'), (r'YAGNI', 'review:simplicity'), (r'SOLID, wzorce', 'review:architecture'),
    (r'type safety', 'review:typescript'), (r'POPRAWNOSC WYKONANIA', 'review:correctness'), (r'jakosc wewnetrzna kodu', 'review:code-quality'),
]
KLASY = [
    (r'^Jestes plannerem', 'planner'), (r'^Jestes domknieciem', 'domkniecie'), (r'^Dopisz JEDNA linie telemetrii', 'telemetria'),
    (r'^Jestes precheck-agentem E2E', 'e2e:precheck'), (r'^Jestes bootstrapem', 'bootstrap'),
    (r'^Adwersaryjnie OBAL ten finding', 'verify'), (r'^Adwersaryjnie OBAL ponizsze findingi', 'verify-batch'),
    (r'^Jestes agentem srodowiska E2E', 'e2e:env-up'), (r'^Zapisz plik stanu', 'stan:zapis'),
    (r'^Jestes specjalista ds\. zamykania', 'complete'), (r'Utrzymujesz baze wiedzy PO zapisie', 'compound-refresh'),
    (r'Dokumentujesz rozwiazane problemy', 'compound'), (r'To JEDYNA tura poprawek po kontroli', 'fix:poprawka'),
    (r'Naprawiasz problemy z review fazy', 'fix'), (r'^Sprzatanie srodowiska E2E', 'e2e:env-down'),
    (r'^Pipeline dev-autopilot zatrzymuje sie', 'stop'), (r'^Jestes agentem synchronizacji bazy e2e', 'e2e:db-sync'),
    (r'^Ponizej ponumerowana lista findingow', 'dedup:semantyczny'), (r'^Jestes scribe review', 'scribe'),
    (r'^Zwin ZAMKNIETE pozycje', 'zwin-do-poprawy'), (r'^Jestes testerem E2E w przegladarce', 'review:e2e'),
    (r'^Jestes testerem scenariuszy/coverage', 'review:test-coverage'), (r'^Mechaniczny skan commitow fix', 'fix:pre-skan'),
    (r'^Jestes NIEZALEZNYM kontrolerem commitow fix', 'fix:kontrola'), (r'^Jestes context-packagerem', 'kontekst:diff'),
    (r'^Jestes rozgrzewka cache', 'warmup:vitest'), (r'^Wykonaj pelna walidacje calego projektu', 'walidacja-koncowa'),
    (r'^Jestes autorem checklisty smoke', 'smoke-operatora'), (r'^Jesteś SCEPTYKIEM', 'inne:verify'),
    (r'^\s*KONTEKST', 'inne:custom-wf'), (r'Weryfikujesz poprawke findingu|verify-fix', 'verify-fix'),
    (r'(Ścieżka zadania|Ścieżka dokumentacji zadania|^Zadanie: docs/active/|Implementation Unit|Numer IU)', 'build'),
]
def klasyfikuj(prompt):
    f = re.sub(r'\s+', ' ', prompt or '')
    if f.startswith('Jestes reviewerem'):
        for rx, r in OSIE:
            if re.search(rx, f): return r
        return 'review:??'
    for rx, r in KLASY:
        if re.search(rx, f[:700]): return r
    return '?'

# etykiety z journala (nowszy harness): agentId -> label
def etykiety_journala(run_dir):
    m = {}
    jp = os.path.join(run_dir, 'journal.jsonl')
    if not os.path.exists(jp): return m
    for line in open(jp, errors='ignore'):
        try: o = json.loads(line)
        except Exception: continue
        if o.get('type') == 'started' and o.get('agentId') and o.get('label'): m[o['agentId']] = o['label']
    return m

rows = []
_jcache = {}
for p in PROJS:
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + p)
    for mf in glob.glob(os.path.join(base, '*', 'subagents', 'workflows', 'wf_*', 'agent-*.meta.json')):
        try: meta = json.load(open(mf))
        except Exception: continue
        jf = mf[:-len('.meta.json')] + '.jsonl'
        if not os.path.exists(jf): continue
        run = mf.split('/subagents/workflows/')[1].split('/')[0]
        run_dir = os.path.dirname(mf)
        if run_dir not in _jcache: _jcache[run_dir] = etykiety_journala(run_dir)
        sesja = mf.split('/')[-5]
        agent_id = os.path.basename(jf)[6:-6]
        desc = meta.get('description') or _jcache[run_dir].get(agent_id) or ''
        r = dict(projekt=p, sesja=sesja[:8], run=run, agent=agent_id, agentType=meta.get('agentType', ''),
                 opis=desc, rola=rola(desc) if desc else '?', workflow=meta.get('workflowPhase', ''), model='',
                 tury=0, in_tok=0, cache_w=0, cache_r=0, out_tok=0, thinking=0, tool_calls=0, bash=0, read=0, grep=0, edit=0, write=0,
                 start='', koniec='', sekundy=0, ctx_max=0, ctx_sr=0, structured=0)
        first = last = None; ctxs = []; prompt = None; widziane = set()
        with open(jf, errors='ignore') as fh:
            for line in fh:
                try: o = json.loads(line)
                except Exception: continue
                t = o.get('timestamp')
                if t:
                    dt = ts(t)
                    if dt: first = first or dt; last = dt
                msg = o.get('message') or {}
                if prompt is None and o.get('type') == 'user':
                    c = msg.get('content')
                    if isinstance(c, str): prompt = c
                    elif isinstance(c, list):
                        for b in c:
                            if isinstance(b, dict) and b.get('type') == 'text': prompt = b.get('text'); break
                    if prompt is None: prompt = ''
                if o.get('type') == 'assistant':
                    u = msg.get('usage')
                    # jedna odpowiedz API = kilka wpisow (thinking/text/tool_use) z TYM SAMYM usage — licz raz per message.id
                    mid = msg.get('id') or (o.get('timestamp'), json.dumps(u, sort_keys=True) if u else None)
                    if u and mid in widziane: u = None
                    if u: widziane.add(mid)
                    if u:
                        r['tury'] += 1
                        i, cw, cr, ou = u.get('input_tokens', 0), u.get('cache_creation_input_tokens', 0), u.get('cache_read_input_tokens', 0), u.get('output_tokens', 0)
                        r['in_tok'] += i; r['cache_w'] += cw; r['cache_r'] += cr; r['out_tok'] += ou
                        r['thinking'] += (u.get('output_tokens_details') or {}).get('thinking_tokens', 0)
                        ctxs.append(i + cw + cr)
                    if not r['model'] and msg.get('model'): r['model'] = msg['model']
                    c = msg.get('content')
                    if isinstance(c, list):
                        for b in c:
                            if isinstance(b, dict) and b.get('type') == 'tool_use':
                                r['tool_calls'] += 1
                                n = (b.get('name') or '').lower()
                                if n == 'bash': r['bash'] += 1
                                elif n == 'read': r['read'] += 1
                                elif n in ('grep', 'glob'): r['grep'] += 1
                                elif n in ('edit', 'multiedit'): r['edit'] += 1
                                elif n == 'write': r['write'] += 1
                                elif n == 'structuredoutput': r['structured'] += 1
        if r['rola'] == '?': r['rola'] = klasyfikuj(prompt)
        if first and last:
            r['start'] = first.isoformat(); r['koniec'] = last.isoformat(); r['sekundy'] = int((last - first).total_seconds())
        if ctxs: r['ctx_max'] = max(ctxs); r['ctx_sr'] = int(sum(ctxs) / len(ctxs))
        r['koszt'] = round(r['in_tok'] * W_IN + r['cache_w'] * W_CW + r['cache_r'] * W_CR + r['out_tok'] * W_OUT)
        rows.append(r)

rows = [r for r in rows if r['tury'] > 0]
with open(OUT, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

def tabela(tytul, klucz, top=40, filtr=None):
    agg = collections.defaultdict(lambda: dict(n=0, tury=0, out=0, cr=0, cw=0, inn=0, koszt=0, sek=0, tools=0))
    for r in rows:
        if filtr and not filtr(r): continue
        a = agg[klucz(r)]; a['n'] += 1; a['tury'] += r['tury']; a['out'] += r['out_tok']; a['cr'] += r['cache_r']; a['cw'] += r['cache_w']; a['inn'] += r['in_tok']; a['koszt'] += r['koszt']; a['sek'] += r['sekundy']; a['tools'] += r['tool_calls']
    tot = sum(a['koszt'] for a in agg.values()) or 1
    print(f"\n=== {tytul} === (koszt = jednostki wzgledne; udzial = % sumy)")
    print(f"{'klucz':34} {'n':>4} {'tury':>6} {'tools':>6} {'out k':>7} {'cacheR M':>9} {'cacheW k':>9} {'in k':>6} {'udzial':>7} {'koszt/agent':>12} {'min/agent':>9}")
    for k, a in sorted(agg.items(), key=lambda kv: -kv[1]['koszt'])[:top]:
        print(f"{str(k)[:34]:34} {a['n']:4} {a['tury']:6} {a['tools']:6} {a['out']//1000:7} {a['cr']/1e6:9.1f} {a['cw']//1000:9} {a['inn']//1000:6} {a['koszt']/tot*100:6.1f}% {a['koszt']//a['n']//1000:11}k {a['sek']/a['n']/60:8.1f}")
    print(f"SUMA: agentow={sum(a['n'] for a in agg.values())} tur={sum(a['tury'] for a in agg.values())} out={sum(a['out'] for a in agg.values())//1000}k cacheR={sum(a['cr'] for a in agg.values())/1e6:.1f}M koszt={tot/1e6:.1f}M jedn.")

print("agentow lacznie:", len(rows))
tabela('PER PROJEKT', lambda r: r['projekt'])
tabela('PER WORKFLOW (workflowPhase)', lambda r: re.sub(r' #\d+', '', r['workflow']) or '(dev-autopilot main)')
tabela('PER ROLA — wszystkie runy', lambda r: r['rola'], top=45)
tabela('PER ROLA — tylko oferty-online po 2026-09-06', lambda r: r['rola'], top=45, filtr=lambda r: r['projekt'] == 'oferty-online' and r['start'] >= '2026-09-06')
tabela('PER MODEL', lambda r: r['model'])
tabela('PER RUN', lambda r: f"{r['projekt'][:14]} {r['run']} {r['start'][:10]}", top=40)

# rozklad kontekstu i tur dla builderow i reviewerow
def kwantyle(v):
    v = sorted(v); n = len(v)
    if not n: return 'brak'
    q = lambda p: v[min(n - 1, int(p * n))]
    return f"n={n} p50={q(.5)} p90={q(.9)} max={v[-1]}"
print("\n=== ROZKLADY ===")
for grp, f in [('build', lambda r: r['rola'] == 'build'), ('review:*', lambda r: r['rola'].startswith('review:') and r['rola'] != 'review:e2e'), ('fix', lambda r: r['rola'] == 'fix'), ('verify-batch', lambda r: r['rola'] == 'verify-batch')]:
    sel = [r for r in rows if f(r)]
    print(f"{grp:14} tury: {kwantyle([r['tury'] for r in sel])} | ctx_sr(k): {kwantyle([r['ctx_sr']//1000 for r in sel])} | ctx_max(k): {kwantyle([r['ctx_max']//1000 for r in sel])} | min: {kwantyle([r['sekundy']//60 for r in sel])} | tool_calls: {kwantyle([r['tool_calls'] for r in sel])}")

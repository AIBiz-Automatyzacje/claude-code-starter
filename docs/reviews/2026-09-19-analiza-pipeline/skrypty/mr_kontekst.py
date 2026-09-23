#!/usr/bin/env python3
"""Mini-run seria E: kontekst startowy per klasa roli i wariant (dzis / T / TOL) + przeliczenie dzwigni na agentach runu 20.09.
Uzycie: mr_kontekst.py <katalog runu E1> <katalog runu E2> [etykieta]   Wyjscie: dane/mr-kontekst[-etykieta].{txt,json}
Skladniki jak sklad() w d4r_dzwignia_kontekstu.py (znaki z zalacznikow transkryptu); stawki zn/tok z d4r §1 tylko do rozbicia."""
import glob, json, os, re, statistics, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R_T, R_DEF, R_I = 3.61, 1.85, 1.97          # d4r §1 (kalibracja pomiar 1b)
MN = {'opus': 1.016, 'haiku': 0.742}         # d4r §1 mnoznik per model
RUN2009 = os.path.expanduser('~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-oferty-online/fe75c12a-5921-437c-bfc2-d54cf480a228/subagents/workflows/wf_e5c34cd8-66c')
D4R = {'mechaniczny-haiku': (89.2, 9.5), 'mechaniczny-opus': (122.4, 9.1), 'orkiestracyjny-opus': (121.2, 24.8), 'reviewer-opus': (125.2, 28.8),
       'sceptyk-opus': (122.7, 26.3), 'naprawiacz-haiku': (88.3, 20.9), 'naprawiacz-opus': (122.6, 26.2), 'builder-opus': (134.4, 38.1)}  # d4r §2 run 20.09: dzis -> po [k tok]

def sklad(jf):
    z = {}; ctx = None; model = None; ntools = 0; tools_zn = 0; instr = []; env = {}; user_n = 0; first_user = None
    for l in open(jf):
        o = json.loads(l); t = o.get('type')
        env.setdefault('entrypoint', o.get('entrypoint')); env.setdefault('version', o.get('version')); env.setdefault('cwd', o.get('cwd'))
        if t == 'attachment' and (o.get('attachment') or {}).get('type') == 'prompt_snapshot':  # snapshot bywa zapisany po 1. odpowiedzi (jak d4r)
            a = o['attachment']
            if a.get('tools') and not ntools: ntools = len(a['tools']); tools_zn = sum(len(json.dumps(x, ensure_ascii=False)) for x in a['tools'])
            if a.get('systemPrompt') and 'sys' not in z: z['sys'] = sum(len(x) if isinstance(x, str) else len(json.dumps(x, ensure_ascii=False)) for x in a['systemPrompt'])
        elif t == 'attachment' and ctx is None:
            a = o.get('attachment') or {}; at = a.get('type')
            if at == 'instructions':
                for f in a.get('files') or []:
                    instr.append((f.get('path', '').replace(os.path.expanduser('~'), '~'), len(f.get('content', ''))))
            elif at == 'deferred_tools_delta':
                z['odroczone'] = z.get('odroczone', 0) + len('\n'.join(a.get('addedLines') or [])); z['odroczone_n'] = z.get('odroczone_n', 0) + len(a.get('addedLines') or [])
            elif at == 'skill_listing': z['skille'] = z.get('skille', 0) + len(a.get('content') or '')
            elif at == 'agent_listing_delta': z['agenci'] = z.get('agenci', 0) + len(json.dumps(a, ensure_ascii=False))
            else: z['zal_inne'] = z.get('zal_inne', 0) + len(json.dumps(a, ensure_ascii=False))
        elif t == 'user' and ctx is None:
            c = o['message']['content']; c = c if isinstance(c, str) else ''.join(b.get('text', '') for b in c if isinstance(b, dict))
            user_n += 1
            if c.startswith('[Workflow harness — user request]'): z['prosba_operatora'] = len(c)
            else: z['prompt'] = z.get('prompt', 0) + len(c)
        elif t == 'assistant' and ctx is None:
            m = o['message']; u = m.get('usage') or {}; model = m.get('model')
            ctx = u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0)
    z['tools_zn'] = tools_zn; z['instr'] = sum(n for _, n in instr)
    return dict(ctx=ctx, model=model, narzedzia_n=ntools, zn=z, instrukcje=instr, env=env)

def run(katalog):
    out = {}
    for mf in glob.glob(os.path.join(katalog, 'agent-*.meta.json')):
        d = json.load(open(mf)).get('description') or ''
        m = re.match(r'mr-e\d:(.+):(dzis|T|TOL)$', d)
        if m: out[(m.group(1), m.group(2))] = sklad(mf[:-10] + '.jsonl')
    return out

E = {}; 
for k in sys.argv[1:3]: E.update(run(k))
ETYK = ('-' + sys.argv[3]) if len(sys.argv) > 3 else ''
L = []; J = {'komorki': {}}
KOM = ['mechaniczny-haiku', 'orkiestracyjny-opus', 'reviewer-opus-plik', 'reviewer-opus-bezpliku', 'sceptyk-opus', 'naprawiacz-opus', 'naprawiacz-haiku', 'builder-opus']
sr = next(iter(E.values()))['env']
L.append('Srodowisko: entrypoint=%s, Claude Code %s, cwd=%s' % (sr['entrypoint'], sr['version'], sr['cwd']))
L.append('\n=== 1. ctx_start [tok] per komorka: dzis / T (sama allowlista) / TOL (allowlista + omitClaudeMd u mechanicznych + learned-patterns poza eager) vs D4 (run 20.09) ===')
for k in KOM:
    d, t, tol = (E.get((k, v)) for v in ('dzis', 'T', 'TOL'))
    klucz = 'reviewer-opus' if k.startswith('reviewer') else k
    d4 = D4R[klucz]
    f = lambda x: '%6s' % (x['ctx'] if x else '-')
    L.append('%-24s dzis %s | T %s | TOL %s || D4: dzis %.1fk -> po %.1fk | TOL/cel D4 = %s' % (k, f(d), f(t), f(tol), d4[0], d4[1], ('%.2f' % (tol['ctx'] / 1000 / d4[1])) if tol else '-'))
    J['komorki'][k] = {v: (E[(k, v)] if (k, v) in E else None) for v in ('dzis', 'T', 'TOL')}
L.append('\n=== 2. Sklad startu (znaki) per wariant; narzedzia = liczba schematow w tablicy tools ===')
for k in KOM:
    for v in ('dzis', 'T', 'TOL'):
        x = E.get((k, v))
        if not x: continue
        z = x['zn']
        L.append('%-24s %-4s %-26s ctx %6d | narzedzia %3d (%6d zn) | odroczone %4d nazw (%6d zn) | skille %6d | agenci %5d | instrukcje %6d zn %s | prompt %6d | prosba operatora %4d | sys %5d | inne zal. %5d' % (
            k, v, x['model'], x['ctx'], x['narzedzia_n'], z['tools_zn'], z.get('odroczone_n', 0), z.get('odroczone', 0), z.get('skille', 0), z.get('agenci', 0),
            z['instr'], [os.path.basename(p) for p, _ in x['instrukcje']], z.get('prompt', 0), z.get('prosba_operatora', 0), z.get('sys', 0), z.get('zal_inne', 0)))

# --- 3. dzwignia na agentach runu 20.09 (wagi wywolan jak d4r, uproszczone: 1. tura 1,25, kolejne 0,1) ---
OMIT = {'stan:zapis', 'telemetria', 'dedup:semantyczny', 'e2e:precheck', 'kontekst:diff', 'zwin-do-poprawy', 'e2e:env-down', 'fix:pre-skan', 'stop:commit-artefaktow'}
def rola(d):  # jak mr_prompty_20_09.py / d4r (ta sama klasyfikacja co wybor promptow E)
    d = d or '?'
    d = re.sub(r'^(verify-batch|verify-fix|verify):.*$', r'\1', d)
    d = re.sub(r':faza-\d+$|:IU-\d+(\.\d+)?$|:\d+$', '', d)
    return re.sub(r'^(fix:pre-skan|fix:kontrola|fix:poprawka|build|smoke-operatora|complete|compound|telemetria|stop|planner|domkniecie|'
                  r'scribe|fix|zwin-do-poprawy|e2e:db-sync|kontekst:diff|stan:zapis):.*$', r'\1', d)
def rola_klasa(desc, at, model):
    r = rola(desc)
    k = ('mechaniczny' if r in OMIT else 'sceptyk' if r in {'verify', 'verify-batch', 'verify-fix'} else 'reviewer' if r.startswith('review:')
         else 'builder' if r == 'build' else 'naprawiacz' if r in {'fix', 'fix:poprawka'} else 'orkiestracyjny')
    kom = k + '-' + ('haiku' if 'haiku' in (model or '') else 'opus')
    if k == 'reviewer': kom += '-plik' if at != 'workflow-subagent' else '-bezpliku'
    return kom
DZ = {}
for k in KOM:
    d, t, tol = (E.get((k, v)) for v in ('dzis', 'T', 'TOL'))
    if d and t: DZ.setdefault(k, {})['T'] = d['ctx'] - t['ctx']
    if d and tol: DZ.setdefault(k, {})['TOL'] = d['ctx'] - tol['ctx']
koszt = 0.0; osz = {'T': 0.0, 'TOL': 0.0, 'D4': 0.0}; brak = set()
for mf in glob.glob(os.path.join(RUN2009, 'agent-*.meta.json')):
    meta = json.load(open(mf)); ids = {}; model = None
    for l in open(mf[:-10] + '.jsonl'):
        o = json.loads(l)
        if o.get('type') == 'assistant':
            m = o['message']; model = model or m.get('model'); ids[m.get('id')] = m.get('usage') or {}
    if not ids: continue
    kosz = sum(u.get('input_tokens', 0) + 1.25 * u.get('cache_creation_input_tokens', 0) + 0.1 * u.get('cache_read_input_tokens', 0) + 5 * u.get('output_tokens', 0) for u in ids.values())
    koszt += kosz; n = len(ids); w = 1.25 + 0.1 * (n - 1)
    kom = rola_klasa(meta.get('description'), meta.get('agentType'), model)
    src = kom if kom in DZ else ('mechaniczny-haiku' if kom == 'mechaniczny-opus' else None)
    skala = (1 / 0.759) if kom == 'mechaniczny-opus' else 1.0   # haiku -> opus, stosunek zmierzony w kroku 0
    if src is None: brak.add(kom); continue
    for v in ('T', 'TOL'):
        if v in DZ[src]: osz[v] += DZ[src][v] * skala * w
    d4 = D4R['reviewer-opus' if kom.startswith('reviewer') else kom]
    osz['D4'] += (d4[0] - d4[1]) * 1000 * w
L.append('\n=== 3. Dzwignia: zmierzone Δ startu per komorka podstawione do agentow runu 20.09 (koszt %.1f M jedn.; wagi: 1. wywolanie 1,25, kolejne 0,1) ===' % (koszt / 1e6))
L.append('Δ zmierzone [tok]: %s' % {k: v for k, v in DZ.items()})
if brak: L.append('komorki bez pomiaru (pominiete): %s' % sorted(brak))
for v, opis in (('T', 'sama allowlista (D4: 27–38%, run 20.09: 37,8%)'), ('TOL', 'allowlista + omitClaudeMd + learned-patterns poza eager (D4: 40–50%, run 20.09: 51,4%)'),
                ('D4', 'kontrola metody: Δ p50 z D4 tymi samymi uproszczonymi wagami (d4r pelna metoda: 51,4%)')):
    L.append('  %-4s %5.1f%%  — %s' % (v, 100 * osz[v] / koszt, opis))
J['dzwignia'] = {v: 100 * osz[v] / koszt for v in osz}; J['delta'] = DZ; J['koszt_20_09'] = koszt
open(os.path.join(BASE, 'dane', 'mr-kontekst%s.txt' % ETYK), 'w').write('\n'.join(L) + '\n')
json.dump(J, open(os.path.join(BASE, 'dane', 'mr-kontekst%s.json' % ETYK), 'w'), ensure_ascii=False, indent=1, default=str)
print('\n'.join(L))

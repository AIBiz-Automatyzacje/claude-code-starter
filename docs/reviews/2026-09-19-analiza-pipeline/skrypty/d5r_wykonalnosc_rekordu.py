#!/usr/bin/env python3
"""Przeglad D5 (2026-09-23): wykonalnosc rekordu telemetrii (dane/d5-telemetria-rekord.txt) na WSZYSTKICH runach na dysku.
Pytania: czy kazde pole ma zrodlo w kazdym formacie journala; skad status/powod runu; idempotencja klucza run|typ|id
przy wznowieniach; skad wersja szablonu; czy pola dopisane po D2/D3 maja producenta; czy run.pr da sie zsumowac po PR.
Czyta tylko: ~/.claude/projects (transkrypty, journale, pliki workflows/<run>.json harnessu), repo projektow (git, odczyt),
historie git szablonu. Wynik: dane/d5r-wykonalnosc-rekordu.txt + .json. Zero agentow."""
import collections, datetime, glob, json, os, re, subprocess

ROOT = os.path.expanduser('~/.claude/projects')
KOD = os.path.expanduser('~/Documents/Kodowanie')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZABLON = os.path.dirname(os.path.dirname(os.path.dirname(BASE)))
out, J = [], {}
P = out.append


def jl(path):
    for line in open(path, errors='ignore'):
        try: yield json.loads(line)
        except Exception: continue


def plik_harnessu(run_dir):
    run = os.path.basename(run_dir)
    sesja = os.path.dirname(os.path.dirname(os.path.dirname(run_dir)))
    f = os.path.join(sesja, 'workflows', run + '.json')
    return json.load(open(f)) if os.path.exists(f) else None


runy = []
for d in sorted(glob.glob(os.path.join(ROOT, '*', '*', 'subagents', 'workflows', 'wf_*'))):
    j = list(jl(os.path.join(d, 'journal.jsonl'))) if os.path.exists(os.path.join(d, 'journal.jsonl')) else []
    started = [e for e in j if e.get('type') == 'started']
    runy.append(dict(dir=d, run=os.path.basename(d), projekt=d.split('/')[5].replace('-Users-kacper-trzepiecinski-Documents-Kodowanie-', ''),
                     journal=j, started=started, nowy=any(e.get('label') for e in started), w=plik_harnessu(d)))

# ---------------------------------------------------------------- 1. inwentarz
P('D5r — wykonalnosc rekordu telemetrii na wszystkich runach na dysku (przeglad D5, 2026-09-23)')
P('')
P('=== 1. Inwentarz ===')
wn = collections.Counter((r['w'] or {}).get('workflowName', 'BRAK-PLIKU') for r in runy)
P('Runy (katalogi wf_): %d; journal nowego formatu (label+phase w started): %d, starego: %d' % (
    len(runy), sum(r['nowy'] for r in runy), sum(not r['nowy'] for r in runy)))
P('Wg workflowName z pliku harnessu: dev-autopilot-wf %d, dev-pr-wf %d, inne (analityczne, jednorazowe) %d' % (
    wn['dev-autopilot-wf'], wn['dev-pr-wf'], len(runy) - wn['dev-autopilot-wf'] - wn['dev-pr-wf']))
auto = [r for r in runy if (r['w'] or {}).get('workflowName') == 'dev-autopilot-wf']
P('dev-autopilot-wf: nowy format %d, stary %d' % (sum(r['nowy'] for r in auto), sum(not r['nowy'] for r in auto)))
J['inwentarz'] = dict(runy=len(runy), nowy=sum(r['nowy'] for r in runy), workflow=dict(wn))

# ---------------------------------------------------------------- 2. plik harnessu
P('')
P('=== 2. Status i powod runu — plik harnessu <sesja>/workflows/<run>.json ===')
jest = sum(1 for r in runy if r['w'])
klucze = collections.Counter(k for r in runy if r['w'] for k in r['w'])
P('Plik istnieje: %d/%d runow (oba formaty journala). Klucze: %s' % (jest, len(runy), ', '.join('%s %d' % kv for kv in sorted(klucze.items()))))
st = collections.Counter()
for r in runy:
    w = r['w'] or {}
    if w.get('workflowName') not in ('dev-autopilot-wf', 'dev-pr-wf'): continue
    res = w.get('result')
    st[(w['workflowName'], w.get('status'), res.get('status') if isinstance(res, dict) else None,
        bool(isinstance(res, dict) and res.get('powod')))] += 1
P('workflowName | status harnessu | result.status | ma powod -> liczba runow:')
for k, v in sorted(st.items(), key=lambda x: -x[1]): P('  %-16s %-9s %-18s %-5s %d' % (k[0], k[1], k[2], k[3], v))
P('Wniosek: status runu (OK/STOP + powod, killed/failed + error) jest na dysku dla KAZDEGO runu — nie tylko w sesji glownej.')
J['plik_harnessu'] = dict(jest=jest, statusy={' | '.join(map(str, k)): v for k, v in st.items()})


def etykiety(r):
    """agentId -> (label, phaseTitle, phaseIndex, attempt, state): journal (nowy format) + workflowProgress (oba) + key (proby)."""
    m = {}
    wp = [a for a in (r['w'] or {}).get('workflowProgress', []) if a.get('type') == 'workflow_agent']
    for a in wp: m[a.get('agentId')] = dict(label=a.get('label'), grupa=a.get('phaseTitle'), idx=a.get('phaseIndex'),
                                            proba=a.get('attempt'), stan=a.get('state'), zrodlo='workflowProgress')
    po_kluczu = {}
    for e in r['started']:
        if e['agentId'] in m: po_kluczu[e.get('key')] = m[e['agentId']]
    for e in r['started']:
        a = e['agentId']
        if e.get('label'):
            m.setdefault(a, dict(label=e['label'], grupa=e.get('phase'), idx=None, proba=None, stan=None, zrodlo='journal'))
        elif a not in m and e.get('key') in po_kluczu:
            x = dict(po_kluczu[e['key']]); x['zrodlo'] = 'key (wczesniejsza proba)'; m[a] = x
    return m


# ---------------------------------------------------------------- 3. heurystyka skanu D5
P('')
P('=== 3. Heurystyka skanu z D5 §3 (ostatnia etykieta: complete/compound-refresh -> OK, stop:commit-artefaktow -> STOP, inaczej NIEZNANY) ===')
mac = collections.Counter(); ostatnie = collections.Counter()
for r in auto:
    m = etykiety(r)
    # agent telemetrii znika po D5 — heurystyke oceniamy na ostatnim agencie PRZED nim
    ost = [m.get(e['agentId'], {}).get('label') or '' for e in r['started']]
    ost = [x for x in ost if not x.startswith('telemetria')]
    last = ost[-1] if ost else None
    h = 'OK' if last and re.match(r'^(complete|compound-refresh)', last) else 'STOP' if last and last.startswith('stop:commit') else 'NIEZNANY'
    res = r['w'].get('result')
    prawda = res.get('status') if isinstance(res, dict) else r['w'].get('status')
    mac[(str(prawda), h)] += 1
    ostatnie[(str(prawda), re.sub(r':.*', '', last or '-'))] += 1
P('prawdziwy status | heurystyka -> runy (ostatni agent przed agentem telemetrii):')
for k, v in sorted(mac.items()): P('  %-8s -> %-9s %d' % (k[0], k[1], v))
traf = sum(v for k, v in mac.items() if k[0] == k[1])
P('Heurystyka trafia %d/%d runow autopilota; STOP rozpoznany %d/%d.' % (
    traf, len(auto), mac[('STOP', 'STOP')], sum(v for k, v in mac.items() if k[0] == 'STOP')))
P('Rodzaj ostatniego agenta -> runy: %s' % ', '.join('%s/%s %d' % (k[0], k[1], v) for k, v in sorted(ostatnie.items(), key=lambda x: -x[1])))
J['heurystyka_skanu'] = {'%s->%s' % k: v for k, v in mac.items()}

# ---------------------------------------------------------------- 4. „run w toku”
P('')
P('=== 4. Regula D5 „pomijaj run w toku (ostatni started bez result)” ===')
wtoku = collections.Counter()
for r in runy:
    wyn = {e['agentId'] for e in r['journal'] if e.get('type') in ('result', 'failed')}
    if r['started'] and r['started'][-1]['agentId'] not in wyn:
        wtoku[(r['w'] or {}).get('status', 'BRAK')] += 1
P('Runy zakonczone, ktore regula uznalaby za „w toku” NA ZAWSZE (nigdy nie trafilyby do pliku): %s' % dict(wtoku))
J['w_toku_na_zawsze'] = dict(wtoku)

# ---------------------------------------------------------------- 5. etykieta / grupa / faza
P('')
P('=== 5. Etykieta, grupa i numer fazy per agent ===')
pok = collections.Counter(); faza_pok = collections.Counter()
for r in runy:
    m = etykiety(r)
    for e in r['started']:
        a = m.get(e['agentId'])
        pok[('nowy' if r['nowy'] else 'stary', a['zrodlo'] if a else 'BRAK')] += 1
    if r not in auto: continue
    grupy = sorted({(a['idx'], a['grupa']) for a in m.values() if a['idx'] is not None})
    for e in r['started']:
        a = m.get(e['agentId']) or {}
        lab, gr, idx = a.get('label') or '', a.get('grupa') or '', a.get('idx')
        if re.search(r'faza-\d+', lab): zr = 'etykieta :faza-N'
        elif re.match(r'Faza \d+$', gr): zr = 'grupa „Faza N”'
        elif gr.startswith('▸ dev-docs-') and idx is not None and any(re.match(r'Faza \d+$', t) for i, t in grupy if i < idx): zr = 'najblizsza wczesniejsza grupa „Faza N”'
        elif gr in ('Bootstrap', 'Zakonczenie') or gr.startswith('▸ dev-compound') or gr.startswith('▸ dev-docs-complete'): zr = 'poziom runu (bez fazy z definicji)'
        else: zr = 'BRAK'
        faza_pok[zr] += 1
P('Etykieta/grupa per agent (format journala, zrodlo) -> agenci:')
for k, v in sorted(pok.items()): P('  %-6s %-28s %d' % (k[0], k[1], v))
P('Numer fazy u agentow dev-autopilot-wf (oba formaty) -> agenci:')
for k, v in sorted(faza_pok.items(), key=lambda x: -x[1]): P('  %-42s %d' % (k, v))
P('Uwaga: „#N” w nazwie grupy-dziecka to numer WYWOLANIA, nie fazy (run zaczynajacy od fazy 2 ma review #1 = faza 2).')
J['etykiety'] = {' | '.join(k): v for k, v in pok.items()}; J['faza'] = dict(faza_pok)

# ---------------------------------------------------------------- 6. wznowienia i idempotencja
P('')
P('=== 6. Wznowienia (resumeFromRunId) i idempotencja klucza run|typ|id ===')
wz = []
for f in glob.glob(os.path.join(ROOT, '*', '*.jsonl')):
    wyw = {}
    for e in jl(f):
        c = (e.get('message') or {}).get('content')
        if not isinstance(c, list): continue
        for b in c:
            if b.get('type') == 'tool_use' and b.get('name') == 'Workflow': wyw[b['id']] = b.get('input') or {}
            if b.get('type') == 'tool_result' and (wyw.get(b.get('tool_use_id')) or {}).get('resumeFromRunId'):
                ids = sorted(set(re.findall(r'wf_[0-9a-f]{8}-[0-9a-f]{3}', json.dumps(b.get('content')))))
                wz.append((os.path.basename(f)[:8], wyw[b['tool_use_id']]['resumeFromRunId'], ids))
takie_same = sum(1 for s, a, ids in wz if ids == [a])
P('Wywolania Workflow z resumeFromRunId: %d; wynik ma TEN SAM runId: %d; rozne runy wznawiane: %d; wznowione w INNEJ sesji niz start: %d' % (
    len(wz), takie_same, len({a for _, a, _ in wz}), sum(1 for a in {a for _, a, _ in wz} if len({s for s, b, _ in wz if b == a}) > 1)))
dup_key = sum(1 for r in runy for v in collections.Counter(e.get('key') for e in r['started']).values() if v > 1)
poza_wp = sum(1 for r in runy for e in r['started'] if e['agentId'] not in
              {a.get('agentId') for a in (r['w'] or {}).get('workflowProgress', []) if a.get('type') == 'workflow_agent'})
ids = collections.Counter(e['agentId'] for r in runy for e in r['started'])
P('Klucze agentow powtorzone w journalu (ponowna proba tego samego wywolania): %d; agenci spoza workflowProgress (wczesniejsze proby): %d' % (dup_key, poza_wp))
P('agentId wystepujacy w wiecej niz jednym runie: %d -> klucz run|agent|agentId jest unikalny' % sum(1 for v in ids.values() if v > 1))
P('Wniosek: wznowienie dopisuje do TEGO SAMEGO runu nowych agentow i zmienia status/wynik runu i faz. Rekordy run/faza zapisane skanem')
P('po awarii sa nieaktualne, a regula „nie dopisuj, jesli klucz istnieje” zablokowalaby wersje koncowa.')
J['wznowienia'] = dict(wywolania=len(wz), ten_sam_run=takie_same, dup_key=dup_key, poza_workflowProgress=poza_wp)

# ---------------------------------------------------------------- 7. wersja szablonu
P('')
P('=== 7. Wersja szablonu: skrypt z pliku harnessu vs historia szablonu; marker .template-version w repo projektow ===')
bloby = {}
for plik in ('dev-autopilot-wf.js', 'dev-pr-wf.js'):
    for c in subprocess.run(['git', '-C', SZABLON, 'log', '--format=%H', '--', '.claude/workflows/' + plik], capture_output=True, text=True).stdout.split():
        b = subprocess.run(['git', '-C', SZABLON, 'rev-parse', c + ':.claude/workflows/' + plik], capture_output=True, text=True).stdout.strip()
        if b: bloby.setdefault(b, c[:7])
wer = collections.Counter(); lok = collections.Counter()
for r in runy:
    w = r['w'] or {}
    if w.get('workflowName') not in ('dev-autopilot-wf', 'dev-pr-wf'): continue
    h = subprocess.run(['git', 'hash-object', '--stdin'], input=w['script'].encode(), capture_output=True).stdout.decode().strip()
    zg = h in bloby
    wer[(w['workflowName'], 'zgodny z commitem szablonu' if zg else 'NIE MA go w historii szablonu')] += 1
    if not zg: lok[(r['projekt'], w['workflowName'])] += 1
for k, v in sorted(wer.items()): P('  %-16s %-30s %d' % (k[0], k[1], v))
P('  runy ze skryptem spoza historii szablonu per projekt: %s' % dict(lok))
repo = sorted({os.path.dirname(os.path.dirname(os.path.dirname(p))) for p in glob.glob(os.path.join(KOD, '*', '.claude', 'workflows', 'dev-autopilot-wf.js'))})
P('Repo z workflowem autopilota: %d' % len(repo))
bez_markera = bez_gita = 0
for rp in repo:
    mk = os.path.join(rp, '.claude', '.template-version')
    marker = open(mk).read().strip()[:7] if os.path.exists(mk) else None
    git = subprocess.run(['git', '-C', rp, 'rev-parse', '--is-inside-work-tree'], capture_output=True, text=True).returncode == 0
    bez_markera += marker is None; bez_gita += not git
    P('  %-34s marker=%-8s git=%s' % (os.path.basename(rp), marker or 'BRAK', 'tak' if git else 'NIE'))
P('Marker brak w %d/%d repo, gita brak w %d. Manifest .template-manifest ma tylko sciezki (bez hashy) — nie wykryje lokalnej zmiany.' % (bez_markera, len(repo), bez_gita))
P('Plik harnessu przechowuje skrypt GLOWNEGO workflowu (workflows/scripts/, pole script); skryptow workflowow-dzieci (execute/review/compound/complete) nie.')
J['wersja'] = {' | '.join(k): v for k, v in wer.items()}; J['repo'] = dict(razem=len(repo), bez_markera=bez_markera, bez_gita=bez_gita)

# ---------------------------------------------------------------- 8. transkrypty agentow
P('')
P('=== 8. Transkrypty agentow: wersja Claude Code, zalaczniki kontekstu, thinking ===')
dzien = collections.defaultdict(collections.Counter)
for r in runy:
    for f in glob.glob(os.path.join(r['dir'], 'agent-*.jsonl')):
        ts = ver = None; inst = False; th = False
        for i, e in enumerate(jl(f)):
            ts = ts or (e.get('timestamp') or '')[:10] or None
            ver = ver or e.get('version')
            a = e.get('attachment') or {}
            if a.get('type') == 'instructions' and a.get('files'): inst = True
            u = (e.get('message') or {}).get('usage') or {}
            if 'thinking_tokens' in json.dumps(u): th = True
        k = (ts or '?')[:7] + (' do 09-05' if (ts or '') < '2026-09-06' else ' od 09-06')
        dzien[k]['agenci'] += 1; dzien[k]['wersja CC'] += bool(ver); dzien[k]['zalacznik instructions z plikami'] += inst; dzien[k]['thinking_tokens'] += th
for k in sorted(dzien): P('  %-17s %s' % (k, dict(dzien[k])))
P('Zalacznik `instructions` (lista plikow CLAUDE.md/rules/learned-patterns z trescia, jak widzi je agent) jest od ~09-06 (CC ~2.1.263);')
P('`deferred_tools_delta` i `skill_listing` sa od poczatku danych. Pole `version` (wersja CC) jest w kazdym wpisie.')
J['transkrypty'] = {k: dict(v) for k, v in dzien.items()}

# ---------------------------------------------------------------- 9. dev-pr: run.pr
P('')
P('=== 9. dev-pr-wf: jeden run = jeden ETAP jednej tury; watki bota powtarzaja sie miedzy turami ===')
etapy = collections.Counter(); numer = collections.Counter(); per_z = collections.defaultdict(lambda: [0, set(), 0])
for r in runy:
    w = r['w'] or {}
    if w.get('workflowName') != 'dev-pr-wf': continue
    a = w.get('args') if isinstance(w.get('args'), dict) else {}
    res = w.get('result') if isinstance(w.get('result'), dict) else {}
    etapy[a.get('etap')] += 1; numer[bool(res.get('prNumer'))] += 1
    if a.get('etap') != 'zbierz': continue
    wyn = [e.get('result') for e in r['journal'] if e.get('type') == 'result']
    watki = (wyn[0] or {}).get('watki') if wyn and isinstance(wyn[0], dict) else None
    z = per_z[a.get('zadanie')]; z[2] += 1
    for x in watki or []:
        if isinstance(x, dict) and x.get('id'): z[0] += 1; z[1].add(x['id'])
P('Runy dev-pr-wf wg etapu: %s; numer PR w wyniku ma %d/%d (tylko etap start) — laczenie po args.zadanie' % (dict(etapy), numer[True], sum(numer.values())))
suma = sum(z[0] for z in per_z.values()); unik = sum(len(z[1]) for z in per_z.values())
P('Watki w wynikach pr:zbierz: suma po runach %d, unikalne id per zadanie %d -> suma po runach zawyza o %.0f%%' % (suma, unik, 100 * (suma - unik) / unik))
for z, (s, u, n) in sorted(per_z.items(), key=lambda x: -x[1][0]):
    P('  %-40s runow zbierz %d  watkow %3d  unikalnych %3d' % (z, n, s, len(u)))
J['dev_pr'] = dict(etapy=dict(etapy), watki_suma=suma, watki_unikalne=unik)

# ---------------------------------------------------------------- 10. wyscig przy dopisywaniu
P('')
P('=== 10. Wyscig: jak czesto dwie sesje koncza odpowiedz naraz (wariant C = hook Stop ze skanem w kazdej sesji) ===')
ev = []
for f in glob.glob(os.path.join(ROOT, '*', '*.jsonl')):
    s = os.path.basename(f)
    for line in open(f, errors='ignore'):
        if '"end_turn"' not in line: continue
        try: e = json.loads(line)
        except Exception: continue
        if e.get('type') == 'assistant' and (e.get('message') or {}).get('stop_reason') == 'end_turn' and e.get('timestamp'):
            ev.append((datetime.datetime.fromisoformat(e['timestamp'].replace('Z', '+00:00')).timestamp(), s))
ev.sort()
P('Konce odpowiedzi w sesjach glownych (zdarzenia hooka Stop): %d w %d sesjach' % (len(ev), len({s for _, s in ev})))
for okno in (2, 10):
    n = 0
    for i, (t, s) in enumerate(ev):
        j = i + 1
        while j < len(ev) and ev[j][0] - t <= okno:
            if ev[j][1] != s: n += 1; break
            j += 1
    P('  w oknie %2d s konczy tez INNA sesja: %d (%.1f%%)' % (okno, n, 100 * n / len(ev)))
P('Wniosek: przy skanie w hooku Stop dwa procesy czytajace „jakie klucze juz sa” i dopisujace brakujace to realny przypadek, nie teoria.')
J['wyscig'] = dict(zdarzenia=len(ev))

# ---------------------------------------------------------------- 11. CLAUDE.md widziany przez agenta vs git; epoka po scieciu (D3)
P('')
P('=== 11. CLAUDE.md oferty-online: rozmiar widziany przez agenta (zalacznik instructions) vs git gałęzi main; epoka po scieciu ===')
MECH = {'stan:zapis', 'telemetria', 'e2e:precheck', 'fix:pre-skan', 'e2e:env-down', 'zwin-do-poprawy', 'dedup:semantyczny', 'stop:commit-artefaktow'}


def rola(desc):  # jak rola() w koszt_agentow.py
    d = re.sub(r'^(verify-batch|verify-fix|verify):.*$', r'\1', desc or '?')
    d = re.sub(r':faza-\d+$|:IU-\d+(\.\d+)?$|:\d+$', '', d)
    return re.sub(r'^(build|smoke-operatora|complete|compound|telemetria|stop|planner|domkniecie|scribe|fix|fix:pre-skan|fix:kontrola|fix:poprawka|zwin-do-poprawy|e2e:db-sync|kontekst:diff|stan:zapis):.*$', r'\1', d)


def klasa(r):  # jak klasa() w d3r_kontekst_per_klasa.py
    if r in MECH: return 'mechaniczny'
    if r in ('verify', 'verify-batch'): return 'sceptyk'
    if r.startswith('review:'): return 'reviewer'
    if r == 'build': return 'builder'
    if r in ('fix', 'fix:poprawka'): return 'naprawiacz'
    return None if r in ('?', '') else 'orkiestracyjny'


REPO_OO = os.path.join(KOD, 'oferty-online')
rozjazd = collections.Counter(); po = collections.defaultdict(list); runy_po = collections.Counter(); widziane = collections.defaultdict(set); nz = collections.defaultdict(list)
for r in runy:
    if r['projekt'] != 'oferty-online': continue
    m = etykiety(r)
    for e in r['started']:
        f = os.path.join(r['dir'], 'agent-%s.jsonl' % e['agentId'])
        if not os.path.exists(f): continue
        widzi = ctx = ts = model = None; nn = sn = None
        for i, x in enumerate(jl(f)):
            ts = ts or x.get('timestamp')
            a = x.get('attachment') or {}
            if a.get('type') == 'deferred_tools_delta' and nn is None and a.get('addedNames'): nn = len(a['addedNames'])
            if a.get('type') == 'skill_listing' and sn is None: sn = a.get('skillCount')
            if a.get('type') == 'instructions':
                for p in a.get('files') or []:
                    if p.get('path', '').endswith('oferty-online/CLAUDE.md'): widzi = len(p.get('content') or '')
            u = (x.get('message') or {}).get('usage') if x.get('type') == 'assistant' else None
            if u and ctx is None:
                ctx = u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0)
                model = (x.get('message') or {}).get('model', '')
                break
        if widzi is None or not ts: continue
        g = subprocess.run(['git', '-C', REPO_OO, 'log', '-1', '--format=%h', '--before=' + ts, 'main', '--', 'CLAUDE.md'], capture_output=True, text=True).stdout.strip()
        gz = len(subprocess.run(['git', '-C', REPO_OO, 'show', g + ':CLAUDE.md'], capture_output=True, text=True).stdout) if g else None
        rozjazd['zgodny z main (±1 zn)' if gz is not None and abs(gz - widzi) <= 1 else 'INNY niz main w chwili startu'] += 1
        if widzi <= 25000:
            k = klasa(rola((m.get(e['agentId']) or {}).get('label')))
            runy_po[(r['run'], (r['w'] or {}).get('workflowName'), (ts or '')[:10])] += 1
            widziane[r['run']].add(widzi)
            if nn: nz['narzedzia'].append(nn)
            if sn: nz['skille'].append(sn)
            if k and ctx: po[(k, 'haiku' if 'haiku' in (model or '') else 'opus')].append(ctx)
P('Agenci z zalacznikiem instructions (od 09-06): rozmiar CLAUDE.md widziany vs main w chwili startu -> %s' % dict(rozjazd))
P('Runy, w ktorych agent widzial CLAUDE.md <= 25k zn (po scieciu): %s' % ', '.join('%s %s %s (%d agentow)' % (k[0], k[1], k[2], v) for k, v in sorted(runy_po.items())))
P('Kontekst pierwszej tury (p50, k tok) w tej epoce per klasa i model — D3r dla 09-13..09-17: mech 101k, orkiestr. 139k, sceptyk 144k, reviewer 145k, napr. 129k, builder 160k:')
for k in sorted(po): P('  %-15s %-5s n=%3d p50=%4.0fk' % (k[0], k[1], len(po[k]), sorted(po[k])[len(po[k]) // 2] / 1e3))
P('Rozmiar CLAUDE.md widziany w tych runach (zn): %s' % {k: sorted(v) for k, v in widziane.items()})
P('Liczba narzedzi (deferred_tools_delta.addedNames) i skilli (skill_listing.skillCount) u tych agentow, p50: narzedzia %s, skille %s' % (
    sorted(nz['narzedzia'])[len(nz['narzedzia']) // 2] if nz['narzedzia'] else None, sorted(nz['skille'])[len(nz['skille']) // 2] if nz['skille'] else None))
J['epoka_po_scieciu'] = {'%s|%s' % k: dict(n=len(v), p50=sorted(v)[len(v) // 2]) for k, v in po.items()}

open(os.path.join(BASE, 'dane', 'd5r-wykonalnosc-rekordu.txt'), 'w').write('\n'.join(out) + '\n')
json.dump(J, open(os.path.join(BASE, 'dane', 'd5r-wykonalnosc-rekordu.json'), 'w'), ensure_ascii=False, indent=1)
print('\n'.join(out))

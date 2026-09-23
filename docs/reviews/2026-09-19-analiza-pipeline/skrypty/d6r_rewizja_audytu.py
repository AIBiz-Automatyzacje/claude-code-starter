#!/usr/bin/env python3
"""D6r — przeglad audytu skilli (D6) na Opus 5.5, 2026-09-23. Zero agentow, sam odczyt z dysku.

Sprawdza cztery rzeczy, na ktorych stoja wnioski D6:
  1. retencje i zasieg zrodel (transkrypty ~7 tyg.; ~/.claude/history.jsonl = polecenia wpisane w CLI od 2025-10);
  2. uzycie skilli szablonu w CALEJ historii (history.jsonl) — czy „0 w oknie” znaczy „nigdy”;
  3. workflowy-dzieci i etapy dev-pr z pliku harnessu <sesja>/workflows/<run>.json (wszystkie 156 runow, oba formaty journala);
  4. heurystyke epizodu skilla z koszt_skilli.py (zrodlo A = skille.csv): czym konczy sie epizod, ile kosztu nie liczy,
     duplikaty z kopii sesji, subagenci powolani w epizodzie, srednia vs mediana minut; udzial skilli w koszcie zadania.
Plus fakty o kandydatach do usuniecia: odwolania w repo szablonu (poza docs/reviews), kopie w szablonie mobile, lista skilli agenta.
Wynik: dane/d6r-rewizja-audytu.txt + dane/d6r-rewizja-audytu.json."""
import collections, csv, datetime, glob, hashlib, json, os, re, statistics, subprocess

TU = os.path.dirname(os.path.abspath(__file__))
ANALIZA = os.path.dirname(TU)
DANE = os.path.join(ANALIZA, 'dane')
SZABLON = os.path.abspath(os.path.join(ANALIZA, '..', '..', '..'))
MOBILE = os.path.join(os.path.dirname(SZABLON), 'workspace-template-mobile')
HOME = os.path.expanduser('~')
PROJECTS = os.path.join(HOME, '.claude', 'projects')
HISTORY = os.path.join(HOME, '.claude', 'history.jsonl')
ETAP0 = ['oferty-online', 'claude-cron', 'Nawykometr', 'akademia-automatyzacji-dashboard', 'symulator-poczekalni']
PREF = '-Users-kacper-trzepiecinski-Documents-Kodowanie-'
OKNO_OD = datetime.date(2026, 8, 3)
W_IN, W_CW, W_CR, W_OUT = 1.0, 1.25, 0.1, 5.0
KANDYDACI_D = ['code-review', 'code-quality', 'gemini', 'dev-docs-update', 'bugfix']
DO_DECYZJI_E = ['dev-ideate', 'freshness-audit', 'freshness-audit-wf', 'dev-docs-execute', 'dev-docs-review']
PRZED_AUTOPILOTEM = ('dev-prep', 'dev-plan', 'dev-docs')

out = []
P = out.append
wynik = {}


def ts(s):
    try:
        return datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except Exception:
        return None


def tekst(c):
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return ' '.join(b.get('text', '') for b in c if isinstance(b, dict) and b.get('type') == 'text')
    return ''


def czy_tool_result(c):
    return isinstance(c, list) and any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in c)


def koszt(u):
    return (u.get('input_tokens', 0) * W_IN + u.get('cache_creation_input_tokens', 0) * W_CW
            + u.get('cache_read_input_tokens', 0) * W_CR + u.get('output_tokens', 0) * W_OUT)


def czytaj(jf):
    wyn = []
    for line in open(jf, errors='ignore'):
        try:
            wyn.append(json.loads(line))
        except Exception:
            pass
    return wyn


def mediana(xs):
    return statistics.median(xs) if xs else 0


skille = sorted(os.path.basename(d) for d in glob.glob(os.path.join(SZABLON, '.claude', 'skills', '*')) if os.path.isfile(os.path.join(d, 'SKILL.md')))
workflowy = sorted(os.path.basename(f)[:-3] for f in glob.glob(os.path.join(SZABLON, '.claude', 'workflows', '*.js')))
NAZWY = skille + workflowy
csv_rows = list(csv.DictReader(open(os.path.join(DANE, 'skille.csv'))))
NAZWY_SKILLI = set(NAZWY) | {r['skill'] for r in csv_rows}  # granica epizodu: wywolanie dowolnego skilla (szablonu lub konta)

# =====================================================================================================================
# 1. RETENCJA I ZASIEG ZRODEL
# =====================================================================================================================
P('D6r — PRZEGLAD AUDYTU SKILLI (D6), 2026-09-23. Skrypt: skrypty/d6r_rewizja_audytu.py. Zero agentow, odczyt z dysku.')
P('')
P('=== 1. Retencja transkryptow i zasieg history.jsonl ===')
glowne = glob.glob(os.path.join(PROJECTS, '*', '*.jsonl'))
mt = sorted(datetime.date.fromtimestamp(os.path.getmtime(f)) for f in glowne)
pierwsze_wpisy = []
for f in glowne:
    for line in open(f, errors='ignore'):
        m = re.search(r'"timestamp":"(\d{4}-\d\d-\d\d)', line)
        if m:
            pierwsze_wpisy.append(m.group(1))
            break
P(f'Sesje glowne na dysku: {len(glowne)} plikow; najstarszy mtime {mt[0]}, najstarszy pierwszy wpis {min(pierwsze_wpisy)}.')
per_tydz = collections.Counter((d - datetime.timedelta(days=d.weekday())).isoformat() for d in mt)
P('Pliki sesji glownych wg tygodnia ostatniej modyfikacji: ' + ', '.join(f'{k}:{v}' for k, v in sorted(per_tydz.items())))
naj_proj = {}
for p in ETAP0 + ['workspace-template']:
    fs = glob.glob(os.path.join(PROJECTS, PREF + p, '*.jsonl'))
    if fs:
        naj_proj[p] = (str(min(datetime.date.fromtimestamp(os.path.getmtime(f)) for f in fs)), len(fs))
P('Najstarszy plik sesji per projekt (mtime, liczba plikow) — okno zalezy od aktywnosci projektu: '
  + ', '.join(f'{p} {d} ({n})' for p, (d, n) in naj_proj.items()))
wynik['najstarszy_per_projekt'] = naj_proj
ustaw = {}
for sp in (os.path.join(HOME, '.claude', 'settings.json'), os.path.join(HOME, '.claude', 'settings.local.json')):
    if os.path.isfile(sp):
        ustaw[os.path.basename(sp)] = json.load(open(sp)).get('cleanupPeriodDays')
P(f'cleanupPeriodDays w ustawieniach konta: {ustaw} (None = nieustawione, dziala wartosc domyslna narzedzia).')

hist = [json.loads(l) for l in open(HISTORY, errors='ignore') if l.strip()]
hd = lambda r: datetime.date.fromtimestamp(r['timestamp'] / 1000)
P(f'history.jsonl: {len(hist)} wpisow, {hd(hist[0])}..{hd(hist[-1])} — wpisuje go tylko CLI (polecenia wpisane w terminalu), nie aplikacja desktop.')
mies_hist = collections.Counter(hd(r).strftime('%Y-%m') for r in hist)
P('  wpisy history per miesiac: ' + ', '.join(f'{k}:{v}' for k, v in sorted(mies_hist.items())))

# entrypoint wiadomosci operatora w transkryptach (cli vs desktop), per miesiac — gdzie history przestaje widziec slash
entry = collections.defaultdict(collections.Counter)
slash_trans = collections.defaultdict(collections.Counter)  # skill -> Counter(entrypoint) w oknie, dedup po uuid
widz = set()
RE_CMD = re.compile(r'<command-name>/?([\w:-]+)</command-name>')
for f in glowne:
    for line in open(f, errors='ignore'):
        if '"type":"user"' not in line:
            continue
        try:
            o = json.loads(line)
        except Exception:
            continue
        c = (o.get('message') or {}).get('content')
        if o.get('isMeta') or czy_tool_result(c) or o.get('uuid') in widz:
            continue
        widz.add(o.get('uuid'))
        ep = o.get('entrypoint', '?')
        entry[(o.get('timestamp') or '')[:7]][ep] += 1
        for m in RE_CMD.finditer(tekst(c)):
            if m.group(1) in NAZWY:
                slash_trans[m.group(1)][ep] += 1
P('Wiadomosci operatora w sesjach glownych wg entrypoint (dedup po uuid): ' + '; '.join(f'{k}: ' + ', '.join(f'{e}={v}' for e, v in sorted(c.items())) for k, c in sorted(entry.items()) if k))

# =====================================================================================================================
# 2. UZYCIE SKILLI SZABLONU W CALEJ HISTORII (slash w CLI)
# =====================================================================================================================
P('')
P('=== 2. Slash-komendy skilli szablonu w history.jsonl (CLI, od 2025-10-05) vs okno transkryptow ===')
P('kolumny: hist_razem / hist_przed_oknem / hist_w_oknie | trans_okno = slash w transkryptach okna (wg entrypoint) | pierwsze..ostatnie w history | projekty history')
hist_skill = collections.defaultdict(list)
for r in hist:
    m = re.match(r'\s*/([\w:-]+)(\s|$)', r.get('display', ''))
    if m and m.group(1) in NAZWY:
        hist_skill[m.group(1)].append((hd(r), os.path.basename(r.get('project', '').rstrip('/'))))
wynik['history'] = {}
for n in NAZWY:
    v = hist_skill.get(n, [])
    przed = [x for x in v if x[0] < OKNO_OD]
    tr = slash_trans.get(n, collections.Counter())
    wynik['history'][n] = dict(razem=len(v), przed_oknem=len(przed), pierwsze=str(v[0][0]) if v else None, ostatnie=str(v[-1][0]) if v else None,
                               projekty=dict(collections.Counter(p for _, p in v)), trans_okno=dict(tr))
    znacznik = ' <- D' if n in KANDYDACI_D else (' <- E' if n in DO_DECYZJI_E else '')
    P(f"{n:24} {len(v):4} / {len(przed):4} / {len(v)-len(przed):3} | trans_okno {dict(tr)!s:34} | {(str(v[0][0]) + '..' + str(v[-1][0])) if v else '-':22} | "
      + ', '.join(f'{p}:{k}' for p, k in collections.Counter(p for _, p in v).most_common(4)) + znacznik)

# =====================================================================================================================
# 3. PLIK HARNESSU: WORKFLOWY-DZIECI I ETAPY DEV-PR
# =====================================================================================================================
P('')
P('=== 3. Workflowy-dzieci autopilota i etapy dev-pr — z pliku harnessu (wszystkie runy, oba formaty journala) ===')
harness = []
for f in glob.glob(os.path.join(PROJECTS, '*', '*', 'workflows', 'wf_*.json')):
    o = json.load(open(f))
    o['_projekt'] = f.split(os.sep)[-4].replace(PREF, '')
    harness.append(o)
per_wf = collections.Counter(o.get('workflowName') for o in harness)
P(f'Pliki harnessu: {len(harness)}; wg workflowName: {dict(per_wf.most_common())}')
DZIECI = ['dev-docs-execute-wf', 'dev-docs-review-wf', 'dev-compound-wf', 'dev-docs-complete-wf']
dz = {d: collections.Counter() for d in DZIECI}
dz_runy = {d: set() for d in DZIECI}
refresh_runy = set(); complete_runy = set()
auto = [o for o in harness if o.get('workflowName') == 'dev-autopilot-wf']
for o in auto:
    for e in o.get('workflowProgress') or []:
        if e.get('type') == 'workflow_phase':
            m = re.match(r'▸ ([a-z-]+)', e.get('title', ''))
            if m and m.group(1) in dz:
                dz[m.group(1)][o['_projekt']] += 1
                dz_runy[m.group(1)].add(o['runId'])
        elif e.get('type') == 'workflow_agent':
            if e.get('label') == 'compound-refresh':
                refresh_runy.add(o['runId'])
            if str(e.get('label', '')).startswith('complete:'):
                complete_runy.add(o['runId'])
stat_auto = collections.Counter((o.get('status'), (o.get('result') or {}).get('status') if isinstance(o.get('result'), dict) else None) for o in auto)
P(f'Runy dev-autopilot-wf: {len(auto)} w projektach {dict(collections.Counter(o["_projekt"] for o in auto))}; status (harness, wynik): {dict(stat_auto)}')
wynik['dzieci'] = {}
D6_DZIECI = {'dev-docs-execute-wf': 15, 'dev-docs-review-wf': 18, 'dev-compound-wf': 5, 'dev-docs-complete-wf': 5}
for d in DZIECI:
    wynik['dzieci'][d] = dict(wywolania=sum(dz[d].values()), runy=len(dz_runy[d]), projekty=dict(dz[d]))
    P(f'  {d:22} wywolan {sum(dz[d].values()):3} w {len(dz_runy[d]):2} runach (D6: {D6_DZIECI[d]}) — ' + ', '.join(f'{p}:{v}' for p, v in dz[d].most_common()))
P(f'  agent compound-refresh w {len(refresh_runy)}/{len(auto)} runach, agent complete w {len(complete_runy)}/{len(auto)} runach '
  f'(D6: „SKILL.md czytany w kazdym runie autopilota”) — tylko runy dochodzace do Zakonczenia.')
wynik['refresh_runy'] = len(refresh_runy); wynik['complete_runy'] = len(complete_runy); wynik['auto_runy'] = len(auto)

pr = [o for o in harness if o.get('workflowName') == 'dev-pr-wf']
etapy = collections.Counter((o.get('args') or {}).get('etap', '?') if isinstance(o.get('args'), dict) else '?' for o in pr)
zad = collections.defaultdict(set)
for o in pr:
    a = o.get('args') if isinstance(o.get('args'), dict) else {}
    zad[o['_projekt']].add(a.get('zadanie') or '?')
n_zad = sum(len(v) for v in zad.values())
P(f'Runy dev-pr-wf: {len(pr)}; etapy {dict(etapy)}; zadania (PR) unikalne: {n_zad} — ' + '; '.join(f'{p}: {len(v)}' for p, v in zad.items()))
wynik['dev_pr'] = dict(runy=len(pr), etapy=dict(etapy), zadania=n_zad, per_projekt={p: sorted(v) for p, v in zad.items()})

# =====================================================================================================================
# 4. HEURYSTYKA EPIZODU SKILLA (zrodlo A = skille.csv)
# =====================================================================================================================
P('')
P('=== 4. Epizod skilla: co liczy koszt_skilli.py, czego nie liczy ===')
P('Warianty granicy epizodu (start = <command-name> skilla albo narzedzie Skill, jak w koszt_skilli.py):')
P('  E0 = jak koszt_skilli.py: konczy go KAZDA wiadomosc typu user, ktora nie jest tool_result ani isMeta — takze <task-notification>')
P('       (powrot subagenta w tle), „[Request interrupted…]” i wyjscie komendy lokalnej (/model);')
P('  E1 = konczy go dopiero TEKST operatora albo wywolanie kolejnego skilla (powiadomienia, przerwania, /model nie koncza);')
P('  E2 = konczy go dopiero wywolanie kolejnego skilla albo koniec pliku sesji — z cala rozmowa operatora po drodze (gorna granica).')
P('  +sub = koszt subagentow powolanych narzedziem Agent w oknie E2 (meta.json toolUseId; ostatni wpis usage per odpowiedz API).')
P('Duplikaty: sesja wznowiona kopiuje wpisy do nowego pliku — epizod identyfikuje uuid wiadomosci otwierajacej (albo id wywolania Skill).')


def lokalna(t):
    return t.startswith('<local-command') or bool(re.match(r'\s*<command-name>/?(model|clear|compact|context|cost|mcp|effort|fast|config|status|resume|rename|login|permissions|hooks|memory|agents|ide|doctor|help|add-dir|export|release-notes|usage|plugin|reload-plugins|skills|statusline|output-style|terminal-setup|vim|init)</command-name>', t))


epizody = {}  # klucz -> dict
for p in ETAP0:
    base = os.path.join(PROJECTS, PREF + p)
    for jf in sorted(glob.glob(os.path.join(base, '*.jsonl'))):
        sesja = os.path.basename(jf)[:-6]
        L = czytaj(jf)
        otwarte = []  # lista [epizod, wariant-aktywny{E0,E1,E2}]
        for o in L:
            t = o.get('type'); msg = o.get('message') or {}; c = msg.get('content'); stamp = o.get('timestamp', '')
            nowy = None
            if t == 'user' and not o.get('isMeta') and not czy_tool_result(c):
                tx = tekst(c)
                m = RE_CMD.search(tx)
                czy_skill = bool(m and m.group(1) in NAZWY_SKILLI)
                czlowiek = not (tx.lstrip().startswith('<task-notification>') or tx.startswith('[Request interrupted') or lokalna(tx)) or czy_skill
                for e in otwarte:
                    r = e['_ref']
                    if 'E0' in e['aktywne'] and not r.get('powod_E0'):  # pierwsza kopia wygrywa
                        r['powod_E0'] = ('skill' if czy_skill else 'task-notification' if tx.lstrip().startswith('<task-notification>')
                                         else 'przerwanie' if tx.startswith('[Request interrupted') else 'komenda lokalna' if lokalna(tx) else 'tekst operatora')
                    if czlowiek and not czy_skill and 'E2' in e['aktywne']:
                        r['operator'].add(o.get('uuid'))
                    e['aktywne'].discard('E0')
                    if czlowiek:
                        e['aktywne'].discard('E1')
                    if czy_skill:
                        e['aktywne'].discard('E2')
                otwarte = [e for e in otwarte if e['aktywne']]
                if m:  # koszt_skilli.py otwiera epizod na KAZDEJ komendzie; epizody bez tur i tak odpadaja
                    nowy = dict(klucz=o.get('uuid'), skill=m.group(1), zrodlo='slash')
            elif t == 'assistant' and isinstance(c, list):
                if not any('E0' in e['aktywne'] for e in otwarte):
                    for b in c:
                        if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('name') == 'Skill':
                            nowy = dict(klucz=b.get('id'), skill=str((b.get('input') or {}).get('skill', '?')), zrodlo='Skill-tool')
                            for e in otwarte:  # kolejny skill zamyka E1/E2 poprzedniego
                                e['aktywne'] -= {'E1', 'E2'}
                            otwarte = [e for e in otwarte if e['aktywne']]
                            break
            if nowy:
                e = epizody.get(nowy['klucz'])
                if not e:
                    e = dict(projekt=p, skill=nowy['skill'], zrodlo=nowy['zrodlo'], start=stamp, kopie=0, mid={'E0': {}, 'E1': {}, 'E2': {}},
                             kon={'E0': stamp, 'E1': stamp, 'E2': stamp}, agenty=set(), sesje=set(), powod_E0=None, operator=set())
                    epizody[nowy['klucz']] = e
                e['kopie'] += 1; e['sesje'].add(sesja)
                e = dict(e)  # widok aktywnosci per plik; slowniki mid/kon/agenty/operator wspoldzielone z rekordem
                e['aktywne'] = {'E0', 'E1', 'E2'}
                e['_ref'] = epizody[nowy['klucz']]
                otwarte.append(e)
                if t == 'user':
                    continue
            if t == 'assistant':
                u = msg.get('usage'); mid = msg.get('id')
                for e in otwarte:
                    for w in e['aktywne']:
                        if u and mid:
                            e['mid'][w][mid] = u  # ostatni wpis wygrywa
                        if stamp:
                            e['kon'][w] = max(e['kon'][w], stamp)
                    if isinstance(c, list):
                        for b in c:
                            if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('name') == 'Agent':
                                e['agenty'].add((sesja, b.get('id')))
        # epizody, ktore dobiegly konca pliku: E2 konczy koniec sesji
        for e in otwarte:
            r = e['_ref']
            if 'E0' in e['aktywne'] and not r.get('powod_E0'):
                r['powod_E0'] = 'koniec pliku'

# koszt subagentow powolanych w oknie E2
meta_idx = {}
for p in ETAP0:
    for mj in glob.glob(os.path.join(PROJECTS, PREF + p, '*', 'subagents', 'agent-*.meta.json')):
        try:
            tu = json.load(open(mj)).get('toolUseId')
        except Exception:
            continue
        meta_idx[(mj.split(os.sep)[-3], tu)] = mj[:-len('.meta.json')] + '.jsonl'


def koszt_agenta(jf):
    ids = {}
    for line in open(jf, errors='ignore'):
        if '"usage"' not in line:
            continue
        try:
            o = json.loads(line)
        except Exception:
            continue
        msg = o.get('message') or {}
        if msg.get('usage') and msg.get('id'):
            ids[msg['id']] = msg['usage']
    return sum(koszt(u) for u in ids.values())


rows = []
for k, e in epizody.items():
    k0 = sum(koszt(u) for u in e['mid']['E0'].values())
    if not e['mid']['E0']:
        continue  # jak koszt_skilli.py: epizody bez tur odpadaja
    sub = sum(koszt_agenta(meta_idx[a]) for a in e['agenty'] if a in meta_idx)
    a, b0, b1, b2 = ts(e['start']), ts(e['kon']['E0']), ts(e['kon']['E1']), ts(e['kon']['E2'])
    rows.append(dict(skill=e['skill'], projekt=e['projekt'], start=e['start'], kopie=e['kopie'], powod_E0=e.get('powod_E0'),
                     E0=k0, E1=sum(koszt(u) for u in e['mid']['E1'].values()), E2=sum(koszt(u) for u in e['mid']['E2'].values()), sub=sub,
                     agenty=len(e['agenty']), operator=len(e['operator']), min_E0=(b0 - a).total_seconds() / 60 if a and b0 else 0,
                     min_E1=(b1 - a).total_seconds() / 60 if a and b1 else 0, min_E2=(b2 - a).total_seconds() / 60 if a and b2 else 0))

# kontrola: odtworzenie skille.csv (bez deduplikacji kopii)
csv_n = len(csv_rows); csv_k = sum(int(r['koszt']) for r in csv_rows)
dup_csv = collections.Counter((r['projekt'], r['skill'], r['start']) for r in csv_rows)
n_dup = sum(v - 1 for v in dup_csv.values() if v > 1)
k_dup = sum(int(r['koszt']) for r in csv_rows) - sum(int(next(x for x in csv_rows if (x['projekt'], x['skill'], x['start']) == key)['koszt']) for key in dup_csv)
do_csv = [r for r in rows if r['start'] <= max(x['start'] for x in csv_rows)]
P(f'Kontrola (ten sam zakres dat co skille.csv): skille.csv {csv_n} epizodow, {csv_k/1e6:.1f} M; E0 po deduplikacji kopii sesji {len(do_csv)} epizodow, '
  f'{sum(r["E0"] for r in do_csv)/1e6:.1f} M. Duplikaty w skille.csv (ten sam projekt, skill, start): {n_dup} epizody, {k_dup/1e6:.1f} M '
  f'({csv_n} − {n_dup} = {csv_n - n_dup}). Po zakresie skille.csv doszlo {len(rows) - len(do_csv)} epizodow (09-19..09-23); tabele nizej licza wszystkie.')

P('')
P('Czym konczy sie epizod E0 (pierwsze zdarzenie po otwarciu), per skill przed autopilotem:')
for s in PRZED_AUTOPILOTEM:
    rr = [r for r in rows if r['skill'] == s]
    P(f'  {s:9} n={len(rr):2}: ' + ', '.join(f'{k}={v}' for k, v in collections.Counter(r['powod_E0'] for r in rr).most_common()))
P('')
P('Koszt na epizod (k jedn., mediana / srednia) i minuty (mediana / srednia), per wariant:')
wynik['epizody'] = {}
for s in PRZED_AUTOPILOTEM + ('dev-brainstorm', 'dev-compound', 'dev-pr'):
    rr = [r for r in rows if r['skill'] == s]
    if not rr:
        continue
    w = {}
    for v in ('E0', 'E1', 'E2'):
        w[v] = (mediana([r[v] for r in rr]) / 1e3, statistics.mean(r[v] for r in rr) / 1e3)
    wsub = (mediana([r['E2'] + r['sub'] for r in rr]) / 1e3, statistics.mean(r['E2'] + r['sub'] for r in rr) / 1e3)
    mins = {v: (mediana([r['min_' + v] for r in rr]), statistics.mean(r['min_' + v] for r in rr)) for v in ('E0', 'E1')}
    wynik['epizody'][s] = dict(n=len(rr), **{v: dict(mediana_k=round(w[v][0]), srednia_k=round(w[v][1])) for v in w},
                               E2_sub=dict(mediana_k=round(wsub[0]), srednia_k=round(wsub[1])),
                               min_E0=dict(mediana=round(mins['E0'][0], 1), srednia=round(mins['E0'][1], 1)),
                               min_E1=dict(mediana=round(mins['E1'][0], 1), srednia=round(mins['E1'][1], 1)),
                               subagenci=sum(r['agenty'] for r in rr), wiadomosci_operatora_E2_mediana=mediana([r['operator'] for r in rr]))
    P(f"  {s:14} n={len(rr):2} | E0 {w['E0'][0]:5.0f} / {w['E0'][1]:5.0f} | E1 {w['E1'][0]:5.0f} / {w['E1'][1]:5.0f} | E2 {w['E2'][0]:5.0f} / {w['E2'][1]:5.0f} "
      f"| E2+sub {wsub[0]:5.0f} / {wsub[1]:5.0f} | subagenci {sum(r['agenty'] for r in rr):3} | min E0 {mins['E0'][0]:5.1f} / {mins['E0'][1]:6.1f}, "
      f"E1 {mins['E1'][0]:5.1f} / {mins['E1'][1]:6.1f} | wiad. operatora w E2 (mediana) {mediana([r['operator'] for r in rr]):4.1f}")
trio = [r for r in do_csv if r['skill'] in PRZED_AUTOPILOTEM]
P(f"  prep+plan+docs w zakresie skille.csv (D6: 52 epizody, 39,6 M z duplikatem): {len(trio)} epizodow, E0 {sum(r['E0'] for r in trio)/1e6:.1f} M, "
  f"E2 {sum(r['E2'] for r in trio)/1e6:.1f} M, E2+sub {sum(r['E2'] + r['sub'] for r in trio)/1e6:.1f} M.")
wynik['trio_zakres_csv'] = dict(n=len(trio), E0_M=round(sum(r['E0'] for r in trio) / 1e6, 1), E2sub_M=round(sum(r['E2'] + r['sub'] for r in trio) / 1e6, 1))
dp = [r for r in rows if r['skill'] == 'dev-plan']
P(f"  dev-plan: suma E0 {sum(r['E0'] for r in dp)/1e6:.1f} M, E1 {sum(r['E1'] for r in dp)/1e6:.1f} M, E2 {sum(r['E2'] for r in dp)/1e6:.1f} M, "
  f"subagenci {sum(r['sub'] for r in dp)/1e6:.1f} M ({sum(r['agenty'] for r in dp)} agentow).")

# udzial skilli przed autopilotem w koszcie zadania — przypisanie jak koszt_zadan.py (epizod przed pierwszym runem zadania, <= 7 dni)
agents = list(csv.DictReader(open(os.path.join(DANE, 'agents.csv'))))
run_task = {}
for p in set(a['projekt'] for a in agents):
    for jp in glob.glob(os.path.join(PROJECTS, PREF + p, '*', 'subagents', 'workflows', 'wf_*', 'journal.jsonl')):
        run = jp.split('/subagents/workflows/')[1].split('/')[0]
        for line in open(jp, errors='ignore'):
            try:
                o = json.loads(line)
            except Exception:
                continue
            if o.get('type') == 'result' and isinstance(o.get('result'), dict) and o['result'].get('nazwaZadania'):
                run_task[(p, run)] = o['result']['nazwaZadania']
                break
koszt_zad = collections.Counter(); start_zad = {}
for a in agents:
    t = run_task.get((a['projekt'], a['run']))
    if not t:
        continue
    key = (a['projekt'], t)
    koszt_zad[key] += float(a['koszt'])
    if a['start']:
        start_zad[key] = min(start_zad.get(key, a['start']), a['start'])
sk_zad = collections.defaultdict(collections.Counter)
for r in rows:
    if r['skill'] not in PRZED_AUTOPILOTEM + ('dev-brainstorm', 'dev-ideate'):
        continue
    st = ts(r['start'])
    kand = [(k, ts(s)) for k, s in start_zad.items() if k[0] == r['projekt'] and ts(s) and ts(s) > st and (ts(s) - st).days <= 7]
    if kand:
        k = min(kand, key=lambda x: x[1])[0]
        for v in ('E0', 'E2'):
            sk_zad[k][v] += r[v]
        sk_zad[k]['E2sub'] += r['E2'] + r['sub']
udz = {v: [] for v in ('E0', 'E2', 'E2sub')}
for k in sk_zad:
    for v in udz:
        udz[v].append(100 * sk_zad[k][v] / (koszt_zad[k] + sk_zad[k][v]))
P('')
P(f'Udzial skilli przed autopilotem (prep/brainstorm/plan/docs/ideate) w koszcie zadania, {len(sk_zad)} zadan (przypisanie jak koszt_zadan.py; koszt runow z agents.csv, '
  f'ktory zaniza output — po korekcie D5 udzialy ×~0,9):')
for v in udz:
    xs = sorted(udz[v])
    P(f'  {v:6} min {xs[0]:4.1f}%  mediana {mediana(xs):4.1f}%  max {xs[-1]:4.1f}%')
wynik['udzial_skilli_w_zadaniu'] = {v: dict(min=round(min(x), 1), mediana=round(mediana(x), 1), max=round(max(x), 1)) for v, x in udz.items()}
P('Uwaga: E2 bierze cala rozmowe do nastepnego skilla — czesc to watki poboczne (np. sprawdzanie srodowiska po dev-docs). To gorna granica.')
dlugie = [r for r in rows if r['skill'] in PRZED_AUTOPILOTEM and r['min_E2'] > 12 * 60]
P(f'Epizody prep/plan/docs, w ktorych okno E2 trwa > 12 h (sesja zostawiona otwarta): {len(dlugie)} z {len([r for r in rows if r["skill"] in PRZED_AUTOPILOTEM])}.')

# =====================================================================================================================
# 5. KANDYDACI DO USUNIECIA (D) — odwolania, szablon mobile, lista skilli agenta
# =====================================================================================================================
P('')
P('=== 5. Kandydaci D i E: odwolania w repo szablonu (git grep, bez docs/reviews i bez wlasnego katalogu), kopie w szablonie mobile ===')


def git_grep(nazwa):
    wz = r'(^|[^a-zA-Z0-9_-])/?' + re.escape(nazwa) + r'([^a-zA-Z0-9_-]|$)'
    r = subprocess.run(['git', '-C', SZABLON, 'grep', '-lE', wz, '--', '.', ':!docs/reviews', ':!.claude/skills/' + nazwa],
                       capture_output=True, text=True)
    return r.stdout.split()


def skrot_katalogu(d):
    if not os.path.isdir(d):
        return None
    h = hashlib.sha1()
    for root, _, files in sorted(os.walk(d)):
        for f in sorted(files):
            h.update(open(os.path.join(root, f), 'rb').read())
    return h.hexdigest()[:8]


wynik['kandydaci'] = {}
for n in KANDYDACI_D + DO_DECYZJI_E:
    odw = git_grep(n)
    main_h = skrot_katalogu(os.path.join(SZABLON, '.claude', 'skills', n))
    mob_h = skrot_katalogu(os.path.join(MOBILE, '.claude', 'skills', n))
    mob = 'brak' if mob_h is None else ('identyczna' if mob_h == main_h else 'zmieniona')
    wynik['kandydaci'][n] = dict(odwolania=odw, mobile=mob)
    P(f'  {n:20} mobile: {mob:10} | odwolania: {", ".join(odw) or "-"}')
P('  Szablon mobile: pierwszy commit „skopiowane z workspace-template (web)”, brak markera i manifestu — osobna linia, usuniecie w web go nie dotyczy.')

# lista skilli w kontekscie agenta (zalacznik skill_listing najnowszego agenta oferty-online)
lst = None
for f in sorted(glob.glob(os.path.join(PROJECTS, PREF + 'oferty-online', '*', 'subagents', 'workflows', 'wf_*', 'agent-*.jsonl')), key=os.path.getmtime, reverse=True)[:5]:
    for line in open(f, errors='ignore'):
        if '"skill_listing"' in line:
            lst = json.loads(line)['attachment']
            break
    if lst:
        break
if lst:
    c = lst['content']
    razem = 0; opis = []
    for n in KANDYDACI_D:
        i = c.find('- ' + n + ':')
        if i < 0:
            i = c.find('- ' + n + '\n')
        j = c.find('\n- ', i + 1) if i >= 0 else -1
        dl = (j - i) if i >= 0 and j > 0 else 0
        razem += dl
        opis.append(f'{n} {dl} zn' if i >= 0 else f'{n} nieobecny')
    bez_opisu = [n for n in NAZWY if re.search(r'^- ' + re.escape(n) + r'$', c, re.M)]
    P(f'Lista skilli agenta (skillCount {lst.get("skillCount")}, {len(c)} zn): kandydaci D {razem} zn — ' + ', '.join(opis) + '.')
    P(f'  Przy ~4 zn/tok (digest §3) to ~{razem / 4:.0f} tok, czyli {100 * razem / 4 / 107000:.2f}% kontekstu startowego ~107k tok (HANDOFF §3 pkt 2).')
    P('  Skille szablonu na liscie BEZ opisu (model nie wie, kiedy ich uzyc; zostaje slash): ' + ', '.join(bez_opisu) + '.')
    wynik['lista_skilli'] = dict(skillCount=lst.get('skillCount'), zn=len(c), kandydaci_d_zn=razem, bez_opisu=bez_opisu)

txt = '\n'.join(out) + '\n'
open(os.path.join(DANE, 'd6r-rewizja-audytu.txt'), 'w').write(txt)
json.dump(wynik, open(os.path.join(DANE, 'd6r-rewizja-audytu.json'), 'w'), ensure_ascii=False, indent=1, default=str)
print(txt)

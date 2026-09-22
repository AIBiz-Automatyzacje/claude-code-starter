#!/usr/bin/env python3
"""D6 — audyt uzycia skilli szablonu (HANDOFF 6a pkt 19). Zero agentow, sam skrypt.

Trzy zrodla, kazde z innym zasiegiem:
  A. dane/skille.csv (etap 0, 149 epizodow, 5 projektow, sesje glowne, 2026-08-05..09-18) — jedyne zrodlo KOSZTU per epizod.
  B. skan WSZYSTKICH transkryptow ~/.claude/projects/ (sesje glowne + subagenci) — LICZBA wywolan, projekty, daty, kanal
     (slash <command-name>, narzedzie Skill, narzedzie Workflow) + wstrzykniecia `skills:` liczone po agentType z meta.json.
  C. artefakty w repozytoriach z szablonem (~/Documents/Kodowanie/*/ z .claude/skills/dev-plan) — slad uzycia z CALEGO zycia
     szablonu (transkrypty siegaja tylko ~7 tygodni wstecz), np. docs/solutions = dev-compound, docs/brainstorms = dev-brainstorm.
Wynik: dane/d6-audyt-skilli.txt (raport) + dane/d6-audyt-skilli.json (surowe liczby)."""
import collections, csv, datetime, glob, json, os, re, subprocess, sys

TU = os.path.dirname(os.path.abspath(__file__))
ANALIZA = os.path.dirname(TU)
SZABLON = os.path.abspath(os.path.join(ANALIZA, '..', '..', '..'))
PROJECTS = os.path.expanduser('~/.claude/projects')
KODOWANIE = os.path.expanduser('~/Documents/Kodowanie')
ETAP0 = ['oferty-online', 'claude-cron', 'Nawykometr', 'akademia-automatyzacji-dashboard', 'symulator-poczekalni']
SZABLON_DIRS = {'workspace-template', 'workspace-template-mobile'}
DZIS = datetime.date(2026, 9, 22)

# ---------- 1. inwentarz szablonu ----------
skille = sorted(os.path.basename(d) for d in glob.glob(os.path.join(SZABLON, '.claude', 'skills', '*')) if os.path.isfile(os.path.join(d, 'SKILL.md')))
workflowy = sorted(os.path.basename(f)[:-3] for f in glob.glob(os.path.join(SZABLON, '.claude', 'workflows', '*.js')))
wszystkie = skille + workflowy

def git(*args):
    return subprocess.run(['git', '-C', SZABLON] + list(args), capture_output=True, text=True).stdout.strip()

def daty_git(sciezka):
    dodany = git('log', '--diff-filter=A', '--format=%as', '--follow', '--', sciezka).splitlines()
    zmiana = git('log', '-1', '--format=%as', '--', sciezka)
    return (dodany[-1] if dodany else '?'), (zmiana or '?')

def linie(sciezka):
    try:
        return sum(1 for _ in open(sciezka, errors='ignore'))
    except OSError:
        return 0

meta = {}
for s in skille:
    d = os.path.join(SZABLON, '.claude', 'skills', s)
    dodany, zmiana = daty_git(os.path.join(d, 'SKILL.md'))
    meta[s] = dict(typ='skill', dodany=dodany, zmiana=zmiana, linie=linie(os.path.join(d, 'SKILL.md')),
                   pliki=sum(len(f) for _, _, f in os.walk(d)))
for w in workflowy:
    p = os.path.join(SZABLON, '.claude', 'workflows', w + '.js')
    dodany, zmiana = daty_git(p)
    meta[w] = dict(typ='workflow', dodany=dodany, zmiana=zmiana, linie=linie(p), pliki=1)

# `skills:` w frontmatterze agentow -> ktory skill jest wstrzykiwany do ktorego agentType
wstrzyk = collections.defaultdict(list)  # skill -> [agentType]
for a in glob.glob(os.path.join(SZABLON, '.claude', 'agents', '*.md')):
    fm = open(a, errors='ignore').read().split('---')[1] if open(a, errors='ignore').read().startswith('---') else ''
    m = re.search(r'^skills:\s*\[(.*?)\]', fm, re.M)
    if m:
        for sk in [x.strip() for x in m.group(1).split(',') if x.strip()]:
            wstrzyk[sk].append(os.path.basename(a)[:-3])

# odwolania wewnetrzne: kto wola/wspomina skill (poza jego wlasnym katalogiem i testami)
def odwolania(nazwa):
    wyn = []
    for root, _, files in os.walk(os.path.join(SZABLON, '.claude')):
        if '__tests__' in root or os.sep + 'skills' + os.sep + nazwa in root:
            continue
        for f in files:
            if not f.endswith(('.md', '.js', '.sh', '.json')):
                continue
            p = os.path.join(root, f)
            try:
                t = open(p, errors='ignore').read()
            except OSError:
                continue
            if nazwa not in t:
                continue
            # tylko formy "wywolania": `/nazwa` jako komenda (nie fragment sciezki), `skills/nazwa`, 'nazwa' jako klucz/argument w JS
            if re.search(r'(?<![\w./-])/' + re.escape(nazwa) + r'(?![\w-])|skills/' + re.escape(nazwa) + r'(?![\w-])|[\'"]' + re.escape(nazwa) + r'[\'"]', t):
                wyn.append(os.path.relpath(p, SZABLON))
    return wyn

odw = {n: odwolania(n) for n in wszystkie}
# SKILL.md czytany przez agenta WEWNATRZ runu workflowu (prompt "Wykonaj skill .claude/skills/X/SKILL.md") — uzycie posrednie w kazdym runie
skill_w_runie = collections.defaultdict(list)
for wfp in glob.glob(os.path.join(SZABLON, '.claude', 'workflows', '*.js')):
    t = open(wfp, errors='ignore').read()
    for m in set(re.findall(r'skills/([a-z-]+)', t)):
        if m in skille:
            skill_w_runie[m].append(os.path.basename(wfp)[:-3])

# ---------- 2. zrodlo A: skille.csv (koszt) ----------
A = collections.defaultdict(lambda: dict(n=0, koszt=0, minuty=0.0, projekty=set(), ostatnie='', koszty=[]))
csv_rows = list(csv.DictReader(open(os.path.join(ANALIZA, 'dane', 'skille.csv'))))
for r in csv_rows:
    a = A[r['skill']]
    a['n'] += 1; a['koszt'] += int(r['koszt']); a['minuty'] += float(r['minuty']); a['projekty'].add(r['projekt'])
    a['ostatnie'] = max(a['ostatnie'], r['start'][:10]); a['koszty'].append(int(r['koszt']))
A_zakres = (min(r['start'][:10] for r in csv_rows), max(r['start'][:10] for r in csv_rows))

# ---------- 3. zrodlo B: skan transkryptow ----------
def nazwa_projektu(slug):
    for pref in ('-Users-kacper-trzepiecinski-Documents-Kodowanie-', '-Users-kacper-trzepiecinski-Documents-', '-Users-kacper-trzepiecinski-'):
        if slug.startswith(pref):
            return slug[len(pref):]
    if 'workspace-template' in slug:
        return 'workspace-template(scratch)'
    return slug

def kategoria(proj):
    if proj in ETAP0: return 'etap0'
    if proj.startswith('workspace-template'): return 'szablon'
    return 'inne'

zdarzenia = []      # (skill, projekt, data, kanal, glebokosc)
widziane = set()    # uuid / tool_use id
typy_agentow = collections.Counter()  # (projekt, agentType)
RE_CMD = re.compile(r'<command-name>/?([\w:-]+)</command-name>')
nazwy_set = set(wszystkie)

def dodaj(skill, proj, ts, kanal, gleb):
    if skill not in nazwy_set:
        return
    if gleb == 'subagent' and kanal == 'slash':
        # <command-name> w transkrypcie agenta = kontekst wstrzykniety (skills: agenta albo odziedziczony kontekst sesji), NIE wywolanie
        kanal = 'wstrzyk'
    zdarzenia.append((skill, proj, (ts or '')[:10], kanal, gleb))

pliki_skan = 0
dzieci = collections.defaultdict(lambda: dict(runy=set(), wywolania=0, projekty=collections.Counter()))  # wf -> uzycie jako dziecko (journal)
for slug in sorted(os.listdir(PROJECTS)):
    base = os.path.join(PROJECTS, slug)
    if not os.path.isdir(base):
        continue
    proj = nazwa_projektu(slug)
    for mj in glob.glob(os.path.join(base, '**', 'agent-*.meta.json'), recursive=True):
        try:
            typy_agentow[(proj, json.load(open(mj)).get('agentType', '?'))] += 1
        except Exception:
            pass
    for jl in glob.glob(os.path.join(base, '**', 'journal.jsonl'), recursive=True):
        fazy = set()
        for line in open(jl, errors='ignore'):
            m = re.search(r'"phase":"▸ ([a-z-]+)( #\d+)?"', line)
            if m:
                fazy.add((m.group(1), m.group(2) or ''))
        for wfn, nr in fazy:
            if wfn in nazwy_set:
                d = dzieci[wfn]; d['runy'].add(jl); d['wywolania'] += 1; d['projekty'][proj] += 1
    pliki = glob.glob(os.path.join(base, '*.jsonl')) + glob.glob(os.path.join(base, '**', 'agent-*.jsonl'), recursive=True)
    for jf in pliki:
        gleb = 'subagent' if os.sep + 'subagents' + os.sep in jf else 'sesja'
        pliki_skan += 1
        try:
            fh = open(jf, errors='ignore')
        except OSError:
            continue
        for line in fh:
            if '<command-name>' not in line and '"name":"Skill"' not in line and '"name":"Workflow"' not in line:
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            t = o.get('type'); msg = o.get('message') or {}; c = msg.get('content'); ts = o.get('timestamp', '')
            if t == 'user':
                if o.get('uuid') in widziane:
                    continue
                widziane.add(o.get('uuid'))
                txt = c if isinstance(c, str) else ' '.join(b.get('text', '') for b in c if isinstance(b, dict) and b.get('type') == 'text') if isinstance(c, list) else ''
                for m in RE_CMD.finditer(txt):
                    dodaj(m.group(1), proj, ts, 'slash', gleb)
            elif t == 'assistant' and isinstance(c, list):
                for b in c:
                    if not (isinstance(b, dict) and b.get('type') == 'tool_use'):
                        continue
                    if b.get('id') in widziane:
                        continue
                    widziane.add(b.get('id'))
                    inp = b.get('input') or {}
                    if b.get('name') == 'Skill':
                        dodaj(str(inp.get('skill', '')), proj, ts, 'Skill', gleb)
                    elif b.get('name') == 'Workflow':
                        n = inp.get('name') or os.path.basename(str(inp.get('scriptPath', '')))[:-3]
                        dodaj(n, proj, ts, 'Workflow' + ('(resume)' if inp.get('resumeFromRunId') else ''), gleb)

B = collections.defaultdict(lambda: dict(n=0, kanaly=collections.Counter(), projekty=collections.Counter(), pierwsze='9999', ostatnie='', subagent=0))
for skill, proj, data, kanal, gleb in zdarzenia:
    b = B[skill]; b['n'] += 1; b['kanaly'][kanal] += 1; b['projekty'][proj] += 1
    b['pierwsze'] = min(b['pierwsze'], data or '9999'); b['ostatnie'] = max(b['ostatnie'], data)
    if gleb == 'subagent': b['subagent'] += 1

# wstrzykniecia `skills:` — ile agentow danego typu powstalo (po meta.json), per skill
wstrzyk_n = {}
for sk, typy in wstrzyk.items():
    wstrzyk_n[sk] = dict(agenci=sum(v for (p, t), v in typy_agentow.items() if t in typy),
                         projekty=sorted({p for (p, t), v in typy_agentow.items() if t in typy}),
                         typy=typy)

# ---------- 4. zrodlo C: artefakty w repozytoriach z szablonem ----------
ARTEFAKTY = {  # skill -> (opis, funkcja liczaca w katalogu repo)
    'dev-compound': ('docs/solutions/**/*.md', lambda d: len([f for f in glob.glob(os.path.join(d, 'docs', 'solutions', '**', '*.md'), recursive=True) if '_archived' not in f and os.path.basename(f) not in ('README.md', 'INDEX.md')])),
    'dev-compound-refresh': ('docs/solutions/_archived/*', lambda d: len(glob.glob(os.path.join(d, 'docs', 'solutions', '_archived', '*')))),
    'dev-brainstorm': ('docs/brainstorms/*.md', lambda d: len(glob.glob(os.path.join(d, 'docs', 'brainstorms', '*.md')))),
    'dev-ideate': ('docs/ideation/*.md', lambda d: len(glob.glob(os.path.join(d, 'docs', 'ideation', '*.md')))),
    'dev-plan': ('docs/plans/*.md', lambda d: len(glob.glob(os.path.join(d, 'docs', 'plans', '*.md')))),
    'dev-docs-complete': ('docs/completed/*', lambda d: len(glob.glob(os.path.join(d, 'docs', 'completed', '*')))),
    'coderabbit-setup': ('.coderabbit.yaml z naglowkiem generatora', lambda d: int(os.path.isfile(os.path.join(d, '.coderabbit.yaml')) and 'Konfiguracja CodeRabbit' in open(os.path.join(d, '.coderabbit.yaml'), errors='ignore').read(300))),
    'freshness-audit': ('docs/reviews/freshness-*.md', lambda d: len(glob.glob(os.path.join(d, 'docs', 'reviews', 'freshness-*.md')))),
}
repa = sorted(d for d in glob.glob(os.path.join(KODOWANIE, '*')) if os.path.isdir(os.path.join(d, '.claude', 'skills', 'dev-plan')))
C = {sk: {os.path.basename(d): fn(d) for d in repa} for sk, (_, fn) in ARTEFAKTY.items()}

# ---------- 5. klasyfikacja ----------
def klasa(n):
    b = B.get(n)
    bezposr = sum(v for k, v in (b['kanaly'].items() if b else []) if k != 'wstrzyk')
    poza_szablonem = sum(v for p, v in (b['projekty'].items() if b else []) if kategoria(p) != 'szablon')
    art = sum(v for v in C.get(n, {}).values() if v)
    wst = wstrzyk_n.get(n, {}).get('agenci', 0)
    dz = dzieci[n]['wywolania'] if n in dzieci else 0
    if bezposr > 0 and poza_szablonem > 0:
        return 'UZYWANY BEZPOSREDNIO'
    if wst > 0 or dz > 0 or skill_w_runie.get(n):
        return 'UZYWANY POSREDNIO (skills: / dziecko autopilota / SKILL.md czytany w runie)'
    if art > 0 or bezposr > 0:
        return 'SLAD (artefakty sprzed okna albo uzycie tylko w repo szablonu)'
    return 'NIEUZYWANY'

klasy = {n: klasa(n) for n in wszystkie}

# ---------- 6. raport ----------
out = []
P = out.append
P('D6 — AUDYT UZYCIA SKILLI SZABLONU (2026-09-22; HANDOFF 6a pkt 19). Skrypt: skrypty/d6_audyt_skilli.py. Zero agentow.')
P('')
P('ZASIEG I OGRANICZENIA (czytaj przed liczbami):')
P(f'- Inwentarz: {len(skille)} skilli w .claude/skills/ + {len(workflowy)} workflowow w .claude/workflows/ (wystawiane jako skille *-wf).')
P(f'- Zrodlo A (koszt): dane/skille.csv — {len(csv_rows)} epizodow, 5 projektow etapu 0, sesje glowne, {A_zakres[0]}..{A_zakres[1]}. Koszt = jednostki cennika')
P('  (in 1 / cache_w 1,25 / cache_r 0,1 / out 5) sumowane w epizodzie od wywolania do nastepnej wiadomosci czlowieka — obejmuje wszystko, co sesja zrobila')
P('  w tym czasie (rowniez rozmowe z operatorem), wiec to koszt "obslugi skilla w sesji", nie samego pliku SKILL.md.')
najstarszy = min((datetime.datetime.fromtimestamp(os.path.getmtime(f)).date() for f in glob.glob(os.path.join(PROJECTS, '*', '*.jsonl'))), default=None)
P(f'- Zrodlo B (liczba wywolan): skan {pliki_skan} plikow transkryptow we WSZYSTKICH katalogach ~/.claude/projects/ (sesje glowne + subagenci);')
P(f'  najstarszy transkrypt na dysku: {najstarszy} — retencja transkryptow to ~7 tygodni, wiec "0 wywolan" znaczy "0 w oknie {najstarszy}..{DZIS}",')
P('  NIE "nigdy". Dlatego zrodlo C. Kanaly: slash = <command-name> w sesji glownej (operator wpisal /x); Skill = narzedzie Skill wywolane przez')
P('  model; Workflow = narzedzie Workflow (dla *-wf; /x-wf i Workflow x-wf to to samo uruchomienie liczone dwa razy — patrz kolumny); wstrzyk =')
P('  <command-name> w transkrypcie AGENTA (skills: z frontmatteru albo kontekst odziedziczony) — NIE wywolanie; dziecko = workflow wywolany z')
P('  dev-autopilot-wf przez workflow() (widoczny tylko w journal.jsonl jako faza "▸ x-wf #N", nie jako tool_use) — tylko journale nowego formatu')
P('  (z polem phase; 8 runow autopilota); ~100 starszych journali nie ma pol phase/label, wiec dla nich liczby "dziecko" sa zanizone.')
P('  Dedup po uuid wpisu i id tool_use (sesje wznawiane kopiuja wpisy).')
P(f'- Zrodlo C (slad z calego zycia): artefakty w {len(repa)} repozytoriach z zainstalowanym szablonem (.claude/skills/dev-plan): ' + ', '.join(os.path.basename(d) for d in repa) + '.')
P('  Artefakt moze tez powstac recznie lub innym narzedziem — to slad, nie dowod. Skille bez artefaktu wyjsciowego (code-review, security, gemini...) nie maja zrodla C.')
P('- Wstrzykniecia `skills:` (7 skilli-wytycznych) NIE sa wywolaniami: liczone po liczbie agentow danego agentType (meta.json) we wszystkich transkryptach.')
P('- Skille konta (figma:*, frontend-design, coolify-manager z konta, artifact-design...) sa POZA audytem (6a pkt 19: etap higieny konta).')
P('')
P('=== 1. TABELA: wszystkie skille i workflowy szablonu ===')
P('kolumny: A_n/A_koszt/A_min = epizody, laczny koszt (k jedn.) i laczne minuty ze skille.csv; A_proj = projekty w A; B_n = wywolania w skanie (wszystkie projekty),')
P('B_kanaly = slash/Skill/Workflow/wstrzyk; B_proj = liczba projektow (bez repo szablonu / razem); ostatnie = ostatnie zdarzenie B; dziecko = wywolania')
P('z autopilota wg journali (liczba / w ilu runach); wstrzyk = agenci z tym skillem w `skills:` (meta.json); art = artefakty w repozytoriach (C);')
P('dodany/zmiana = git; klasa = wynik. Wiersze posortowane po koszcie A, potem po B_n.')
P('')
hdr = f"{'skill':26} {'A_n':>4} {'A_koszt':>8} {'A_min':>6} {'A_proj':>6} {'B_n':>4} {'B_kanaly':>30} {'B_proj':>7} {'ostatnie':>10} {'dziecko':>8} {'wstrzyk':>7} {'art':>4} {'dodany':>10} {'zmiana':>10}  klasa"
P(hdr)
wiersze_json = {}
def wiersz(n):
    a = A.get(n); b = B.get(n); dz = dzieci.get(n)
    kan = '/'.join(f"{k}:{v}" for k, v in sorted(b['kanaly'].items())) if b else '-'
    proj_bez = len([p for p in b['projekty'] if kategoria(p) != 'szablon']) if b else 0
    proj_all = len(b['projekty']) if b else 0
    art = sum(v for v in C.get(n, {}).values() if v) if n in C else None
    w = dict(typ=meta[n]['typ'], A_n=a['n'] if a else 0, A_koszt_k=round(a['koszt'] / 1000) if a else 0, A_min=round(a['minuty']) if a else 0,
             A_koszt_mediana_k=round(sorted(a['koszty'])[len(a['koszty']) // 2] / 1000) if a else 0,
             A_projekty=sorted(a['projekty']) if a else [], B_n=b['n'] if b else 0, B_kanaly=dict(b['kanaly']) if b else {},
             B_projekty=dict(b['projekty']) if b else {}, B_pierwsze=b['pierwsze'] if b else None,
             B_ostatnie=b['ostatnie'] if b else None, dziecko=(dict(wywolania=dz['wywolania'], runy=len(dz['runy']), projekty=dict(dz['projekty'])) if dz else None),
             wstrzyk=wstrzyk_n.get(n), skill_w_runie=skill_w_runie.get(n, []), artefakty=C.get(n), odwolania=odw[n],
             dodany=meta[n]['dodany'], zmiana=meta[n]['zmiana'], linie=meta[n]['linie'], klasa=klasy[n])
    wiersze_json[n] = w
    dzs = f"{dz['wywolania']}/{len(dz['runy'])}" if dz else '-'
    P(f"{n:26} {w['A_n']:4} {w['A_koszt_k']:7}k {w['A_min']:6} {len(w['A_projekty']):6} {w['B_n']:4} {kan:>30} {proj_bez:3}/{proj_all:<3} {(w['B_ostatnie'] or '-'):>10} {dzs:>8} {(w['wstrzyk'] or {}).get('agenci', 0):7} {('-' if art is None else art):>4} {w['dodany']:>10} {w['zmiana']:>10}  {w['klasa']}")

kolej = sorted(wszystkie, key=lambda n: (-(A[n]['koszt'] if n in A else 0), -(B[n]['n'] if n in B else 0), n))
for n in kolej: wiersz(n)
P('')
P('=== 2. LISTY (kryteria: BEZPOSREDNIO = >=1 wywolanie slash/Skill/Workflow poza repo szablonu w oknie B; POSREDNIO = 0 takich wywolan, ale')
P('wstrzykiwany `skills:` do agentow, ktore powstaly, ALBO wolany jako dziecko autopilota, ALBO jego SKILL.md jest czytany przez agenta w runie;')
P('SLAD = 0 wywolan poza szablonem, ale artefakty z wczesniej albo uzycie tylko w repo szablonu; NIEUZYWANY = nic z powyzszego) ===')
for k in ('UZYWANY BEZPOSREDNIO', 'UZYWANY POSREDNIO (skills: / dziecko autopilota / SKILL.md czytany w runie)', 'SLAD (artefakty sprzed okna albo uzycie tylko w repo szablonu)', 'NIEUZYWANY'):
    P(f'[{k}]')
    for n in kolej:
        if klasy[n] != k: continue
        w = wiersze_json[n]; b = B.get(n)
        szcz = []
        if w['A_n']: szcz.append(f"koszt A: {w['A_n']} ep., {w['A_koszt_k']}k (mediana {w['A_koszt_mediana_k']}k), {w['A_min']} min")
        if b: szcz.append('projekty B: ' + ', '.join(f"{p}:{v}" for p, v in b['projekty'].most_common()) + ' | kanaly: ' + ', '.join(f"{k2}:{v}" for k2, v in b['kanaly'].most_common()))
        if w['dziecko']: szcz.append(f"dziecko autopilota: {w['dziecko']['wywolania']} wywolan w {w['dziecko']['runy']} runach: " + ', '.join(f"{p}:{v}" for p, v in sorted(w['dziecko']['projekty'].items(), key=lambda x: -x[1])))
        if w['skill_w_runie']: szcz.append('SKILL.md czytany przez agenta w runie: ' + ', '.join(w['skill_w_runie']))
        if w['wstrzyk']: szcz.append(f"wstrzyk: {w['wstrzyk']['agenci']} agentow ({', '.join(w['wstrzyk']['typy'])}) w {len(w['wstrzyk']['projekty'])} projektach")
        if w['artefakty'] is not None: szcz.append('artefakty C: ' + ', '.join(f"{p}:{v}" for p, v in w['artefakty'].items() if v) + f" [{ARTEFAKTY[n][0]}]")
        if w['odwolania']: szcz.append(f"wolany/wspominany z: {', '.join(sorted(w['odwolania']))}")
        P(f"  - {n} ({w['typ']}, {w['linie']} l, dodany {w['dodany']}, zmiana {w['zmiana']})")
        for s in szcz: P('      ' + s)
P('')
P('=== 3. AGENCI (meta.json) — ile razy powstal agent z `skills:` per projekt (zrodlo wstrzykniec) ===')
for (p, t), v in sorted(typy_agentow.items(), key=lambda kv: (-kv[1], kv[0])):
    if any(t in typy for typy in wstrzyk.values()):
        P(f'  {p:40} {t:28} {v}')
P('')
P('=== 4. ARTEFAKTY per repozytorium (zrodlo C) ===')
P(f"{'repo':36} " + ' '.join(f'{k[:14]:>14}' for k in ARTEFAKTY))
for d in repa:
    nm = os.path.basename(d)
    P(f"{nm:36} " + ' '.join(f'{C[k][nm]:>14}' for k in ARTEFAKTY))
P('')
P('=== 5. OCENA — propozycja do decyzji operatora i panelu (PANEL-WEJSCIE §7); liczby z tabeli 1, ocena reczna sesji glownej ===')
OCENA = [
    ('A. RDZEN PIPELINE\'U — uzywany w kazdym zadaniu; nie do usuwania, tylko do przeprojektowania w panelu',
     ['dev-prep', 'dev-plan', 'dev-docs', 'dev-autopilot-wf', 'dev-docs-execute-wf', 'dev-docs-review-wf', 'dev-compound-wf', 'dev-docs-complete-wf', 'dev-pr', 'dev-pr-wf', 'dev-compound', 'dev-docs-complete', 'dev-compound-refresh'],
     'dev-prep/dev-plan/dev-docs = 52 epizodow w 5 projektach (A); dev-docs → scalony z dev-plan (§2 pkt 12). Workflowy-dzieci nie maja wlasnych wywolan: '
     'wola je dev-autopilot-wf przez workflow() (widoczne w journalach nowego formatu: execute 15, review 18, compound 5, complete 5 w 5–8 runach; '
     'ok. 100 starszych journali nie ma pola phase, ale etap 0 pokazal te same role we wszystkich 105 runach). dev-docs-complete i dev-compound-refresh: '
     'SKILL.md czytany przez agenta w kazdym runie autopilota (workflow wstawia "Wykonaj skill .claude/skills/X/SKILL.md"), plus 1 reczne uzycie refresh.'),
    ('B. SKILLE-WYTYCZNE wstrzykiwane przez `skills:` — zero wywolan, za to w kazdym builderze/testerze; zostaja (6a pkt 15), dzielone na warstwe stala/referencyjna (§2 pkt 3)',
     ['supabase-dev-guidelines', 'security', 'sentry-integration', 'tailwind-react-guidelines', 'ux-ui-guidelines', 'figma-design-to-code', 'agent-browser'],
     'security+sentry+supabase: 148 agentow (feature-builder-data 125 + fullstack 23) w 4 projektach; tailwind/ux/figma: 53 agentow (ui 30 + fullstack 23); '
     'agent-browser: 59 testerow E2E. Jedyne reczne wywolanie: security 1x (chatbot-cloudnest-widget), supabase-dev-guidelines 1x. '
     'Czy wstrzyknieta tresc jest STOSOWANA — nie wiadomo, to sprawdza mini-run (c), PANEL-WEJSCIE §11.'),
    ('C. UZYWANE RZADKO, ALE CELOWO — poza pipeline\'em, zostaja bez decyzji panelu',
     ['coolify-manager', 'sync-template', 'zroastuj-mnie', 'dev-brainstorm', 'coderabbit-setup'],
     'coolify-manager 8 epizodow / 3 projekty (deploy, nie pipeline); sync-template 8 / 4 projekty (dystrybucja szablonu); zroastuj-mnie 7 / 4; '
     'dev-brainstorm 7 / 4 + 8 artefaktow docs/brainstorms w 6 repo; coderabbit-setup 1 epizod, ale 5 repo z wygenerowanym .coderabbit.yaml = uzywany raz '
     'na projekt, z natury (i tak do poprawy generatora — L19).'),
    ('D. KANDYDACI DO USUNIECIA — 0 wywolan w oknie, 0 artefaktow, zadna czesc maszynerii ich nie wola',
     ['code-review', 'code-quality', 'gemini', 'dev-docs-update', 'bugfix'],
     'code-review: drugi, niezalezny roster review poza pipeline\'em (§7 juz go ma), ostatnia zmiana 2026-03-20. code-quality: jedyne "odwolanie" to nazwa '
     'OSI review w dev-docs-review-wf.js (klucz routingu), nie skill — kolizja nazw. gemini: ostatnia zmiana 2026-03-20, skill nie pojawia sie nawet na '
     'liscie skilli biezacej sesji. dev-docs-update: 0 odwolan, naklada sie na bootstrap stanu autopilota (§7). bugfix: 1 wywolanie w 7 tygodni na ~30 '
     'projektow (gramywpadla 2026-09-10) + 4 solutions z 05–06.2026 w gramywpadla — potwierdza L13 (kandydat do usuniecia, poza miara jakosci).'),
    ('E. DO DECYZJI — malo uzyc, ale nie zero; panel albo operator mowi, czy zostaje',
     ['dev-ideate', 'freshness-audit', 'freshness-audit-wf', 'dev-docs-execute', 'dev-docs-review'],
     'dev-ideate: 1 wywolanie (claude-cron 2026-09-02, koszt 0 = przerwane) + 1 artefakt docs/ideation; 403 linie (§7: "0 wystapien w rozstrzygnieciach"). '
     'freshness-audit (+wf): 2 uruchomienia i 3 raporty — wszystkie z 2026-08-23, tylko w repo szablonu (+ symulator-poczekalni tego samego dnia); '
     'od tego czasu nic (§7: "nieuzyty i nieoceniony" — potwierdzone). dev-docs-execute / dev-docs-review jako SKILLE = tryb reczny pipeline\'u: 0 wywolan '
     'w oknie (wszystko idzie autopilotem), ale ich SKILL.md czyta agent w runie (execute-wf, review-wf) — panel decyduje, czy tryb reczny zostaje, '
     'czy skill redukuje sie do samego workflowu.'),
]
for tytul, lista, uzas in OCENA:
    P(tytul)
    for n in lista:
        w = wiersze_json[n]; kan = w['B_kanaly']
        bezp = ' '.join(f"{k}:{v}" for k, v in sorted(kan.items()) if k != 'wstrzyk') or '0'
        P(f"  - {n:26} {w['typ']:8} {w['linie']:5} l  A: {w['A_n']} ep. {w['A_koszt_k']}k  B bezposr.: {bezp:>22}  proj.(B): {len([p for p in w['B_projekty'] if kategoria(p) != 'szablon'])}  "
          f"dziecko: {(w['dziecko'] or {}).get('wywolania', 0)}  wstrzyk: {(w['wstrzyk'] or {}).get('agenci', 0)}  art: {'-' if w['artefakty'] is None else sum(v for v in w['artefakty'].values() if v)}  ostatnie: {w['B_ostatnie'] or '-'}  zmiana: {w['zmiana']}")
    P('  ' + uzas)
razem_D = sum(meta[n]['linie'] for n in OCENA[3][1]); pliki_D = sum(meta[n]['pliki'] for n in OCENA[3][1])
P(f'Kategoria D razem: {razem_D} linii SKILL.md w {pliki_D} plikach (z zasobami). Usuniecie nie zmienia kosztu runow (skille nie sa ladowane do agentow),')
P('zmienia tylko liste skilli w sesji glownej operatora i utrzymanie szablonu.')
konto = sorted({r['skill'] for r in csv_rows} - nazwy_set)
P('')
P('Skille KONTA widoczne w skille.csv, poza audytem (6a pkt 19: etap higieny konta): ' + ', '.join(f"{k} ({A[k]['n']})" for k in konto) + '.')

txt = '\n'.join(out) + '\n'
open(os.path.join(ANALIZA, 'dane', 'd6-audyt-skilli.txt'), 'w').write(txt)
json.dump(dict(zakres_A=A_zakres, najstarszy_transkrypt=str(najstarszy), pliki_skan=pliki_skan, repozytoria=[os.path.basename(d) for d in repa],
               agenci_typy={f'{p}|{t}': v for (p, t), v in typy_agentow.items()}, skille=wiersze_json),
          open(os.path.join(ANALIZA, 'dane', 'd6-audyt-skilli.json'), 'w'), ensure_ascii=False, indent=1)
print(txt)

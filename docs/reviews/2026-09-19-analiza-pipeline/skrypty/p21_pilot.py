#!/usr/bin/env python3
"""Pilot P21 (HANDOFF 6a pkt 86 e, 89): ślepy test stary vs nowy fix (B1 + B4) na stanie fazy 4 etapu 3 vibersi + smoke P20 u agentów
workflowu. Workflowy idą WYŁĄCZNIE na kopiach vibersi w katalogu pilota (klon lokalny bez .env*, przyszłe commity usunięte).

Użycie (katalog = scratchpad sesji pilota, np. $CLAUDE_JOB_DIR/tmp/p21):
  p21_pilot.py przygotuj <katalog> [--stary main] [--nowy popr/P21-koszt]   zero agentów: baza (71b409e + raport review fazy 4 odtworzony
                                                                            z komend scribe'a), kopie stary/nowy/smoke z nakładką .claude,
                                                                            skrypty Workflow, findingi, kontrola przyszłości i .env*
  p21_pilot.py suchy <katalog>                                             zero agentów: bieg skryptów na atrapie agent(), scenariusz A1,
                                                                            ustawienia sesji, plan kosztu
  p21_pilot.py koszt-planu <katalog>                                        koszt planu z telemetrii runu etapu 3 (fix fazy 4) → plan-kosztu.json
  p21_pilot.py start <katalog> <krok>                                       krok: fix-stary | fix-nowy | smoke | sedzia — sesja headless
                                                                            `claude -p` w katalogu kroku (AGENCI: po zgodzie operatora)
  p21_pilot.py zbierz <katalog> <krok>                                      wynik runu + koszt agentów z transkryptów
  p21_pilot.py walidacja <katalog> <wariant>                                typecheck + vitest w kopii wariantu (bez agentów)
  p21_pilot.py sedzia-przygotuj <katalog>                                   katalog sędziego: A/B (kolejność z hasha), diffy, pliki przed/po
  p21_pilot.py skan <katalog> <krok>                                        przeciek: odczyty spoza kopii (Documents, inne kopie, projekty)
  p21_pilot.py wynik <katalog>                                              tabela: koszt, naprawione, regresje K, walidacja, smoke P20
  p21_pilot.py zapisz <katalog> <plik.json>                                 wynik pilota do pliku (werdykty per finding, A9, skan, koszt)

Miary pilota (6a pkt 86 e): koszt etapu fix (fix + kontrola + poprawka), naprawione (sędzia: NAPRAWIONY / CZĘŚCIOWO / NIENAPRAWIONY
per finding), regresje K (pozycje kontroli diffu naprawczego + regresje wg sędziego). Kryterium: spadek jakości = B1 odpada, reszta P21 zostaje.
"""
import glob, hashlib, json, os, re, shutil, subprocess, sys, time, uuid

TU = os.path.dirname(os.path.abspath(__file__))
REPO = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, cwd=TU).stdout.strip()
VIBERSI = os.path.expanduser('~/Documents/Kodowanie/vibersi')
PROJ = os.path.expanduser('~/.claude/projects')
RUN_E3 = 'wf_f17e9b2e-8d4'
BAZA_SHA = '71b409e'                       # feat fazy 4 (przed fixem 793be1a); raport review i „Do poprawy” nie były commitowane
PRZYSZLOSC = ['793be1a', '7c9c87c', '419ad75', 'fd27b4f', '08e5584']   # fix, kontrola, E2E fazy 4, czubek przed rebase'em, archiwum
ZADANIE = 'docs/active/etap-3-konto-i-auth'
MODEL = 'claude-opus-5-5'
USD_M = 5.0
WARIANTY = ('stary', 'nowy')
N1 = 'Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.'
SEKRET_SMOKE = 'fikcyjna-wartosc-smoke-p20'


def sh(cmd, cwd=None, check=True, **kw):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, **kw)
    if check and r.returncode != 0:
        raise SystemExit('BŁĄD %s: %s' % (' '.join(cmd) if isinstance(cmd, list) else cmd, (r.stderr or r.stdout)[-800:]))
    return r.stdout.strip()


def slug(sciezka):
    return re.sub(r'[^A-Za-z0-9]', '-', sciezka)


def kat(k, *czesci):
    return os.path.join(os.path.abspath(k), *czesci)


def id_sesji(k, krok):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'p21-pilot/%s/%s' % (os.path.abspath(k), krok)))


def katalog_runu_e3():
    d = glob.glob(os.path.join(PROJ, slug(VIBERSI), '*', 'subagents', 'workflows', RUN_E3))
    if not d: raise SystemExit('brak transkryptów runu %s' % RUN_E3)
    return d[0]


def agenci_e3(etykieta):
    pliki = [m[:-len('.meta.json')] + '.jsonl' for m in sorted(glob.glob(os.path.join(katalog_runu_e3(), '*.meta.json')))
             if json.load(open(m)).get('description') == etykieta]
    if not pliki: raise SystemExit('brak agenta %s w runie %s' % (etykieta, RUN_E3))
    return pliki


def agent_e3(etykieta):
    pliki = agenci_e3(etykieta)
    if len(pliki) != 1: raise SystemExit('etykieta %s niejednoznaczna w runie %s (%d agentów)' % (etykieta, RUN_E3, len(pliki)))
    return pliki[0]


# ── Koszt z transkryptu (jednostki jak w telemetrii: cache_r × 0,1 + cache_w × 1,25 + out × 5 + in; jedna wiadomość = jedno id) ──

def koszt_agenta(jf):
    s = {'in': 0, 'cr': 0, 'cw': 0, 'out': 0}; ids = set(); ctx = 0
    for l in open(jf, errors='ignore'):
        try: o = json.loads(l)
        except ValueError: continue
        m = o.get('message') or {}
        if o.get('type') != 'assistant' or not m.get('usage') or m.get('id') in ids: continue
        ids.add(m.get('id')); u = m['usage']
        s['in'] += u.get('input_tokens', 0); s['cr'] += u.get('cache_read_input_tokens', 0)
        s['cw'] += u.get('cache_creation_input_tokens', 0); s['out'] += u.get('output_tokens', 0)
        ctx = max(ctx, u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0) + u.get('cache_creation_input_tokens', 0))
    return {'jedn': round((s['cr'] * 0.1 + s['cw'] * 1.25 + s['out'] * 5 + s['in']) / 1e6, 3), 'tury': len(ids), 'ctx_max': ctx}


def pierwsze_polecenie(jf):
    """Polecenie agenta workflowu: druga wiadomość użytkownika („computed task”), wcięta przez harness o 2 spacje."""
    users = []
    for l in open(jf, errors='ignore'):
        o = json.loads(l)
        if o.get('type') != 'user': continue
        c = o['message'].get('content')
        if isinstance(c, str): users.append(c)
        elif isinstance(c, list) and c and c[0].get('type') == 'text': users.append(c[0]['text'])
        if len(users) >= 2: break
    return '\n'.join(x[2:] if x.startswith('  ') else x for x in users[-1].split('\n'))


def findingi_e3():
    p = pierwsze_polecenie(agent_e3('fix:faza-4'))
    m = re.search(r'OTWARTE FINDINGI DO NAPRAWY \(lista autorytatywna[^\n]*\n(\[.*?\n\])\n', p, re.S)
    if not m: raise SystemExit('brak listy findingów w poleceniu fix:faza-4')
    return json.loads(m.group(1))


def komendy_scribea():
    """Komendy Bash scribe'a fazy 4, które zapisały stan po review: księgowanie [E2E], lista findingów, raport + „Do poprawy” + P3."""
    cmds = []
    for l in open(agent_e3('scribe:faza-4')):
        o = json.loads(l)
        if o.get('type') != 'assistant': continue
        for c in o['message'].get('content', []):
            if c.get('type') == 'tool_use' and c['name'] == 'Bash': cmds.append(c['input']['command'])
    wybrane = [c for c in cmds if 'e2e.mjs ksieguj' in c or "cat > /tmp/scribe4/f.json" in c or "open('/tmp/scribe4/r.md','w')" in c]
    if len(wybrane) != 3: raise SystemExit('komendy scribe’a: oczekiwane 3 (ksieguj, f.json, raport), są %d' % len(wybrane))
    return wybrane


def przepisz_komende(cmd, baza, tmp):
    return cmd.replace(VIBERSI, baza).replace('/tmp/scribe4', tmp)


# ── Przygotowanie ──────────────────────────────────────────────────────────

def baza(k):
    d = kat(k, 'baza')
    if os.path.exists(d): raise SystemExit('%s istnieje — katalog pilota ma być pusty (nowy przebieg: nowy katalog)' % d)
    os.makedirs(kat(k), exist_ok=True)
    sh(['git', 'clone', '-q', '--no-checkout', '--no-hardlinks', VIBERSI, d])
    sh(['git', 'checkout', '-q', '-b', 'pilot-p21', BAZA_SHA], cwd=d)
    sh(['git', 'remote', 'remove', 'origin'], cwd=d)
    for ref in sh(['git', 'for-each-ref', '--format=%(refname)'], cwd=d).split('\n'):
        if ref and ref != 'refs/heads/pilot-p21': sh(['git', 'update-ref', '-d', ref], cwd=d)
    sh(['git', 'reflog', 'expire', '--expire=now', '--all'], cwd=d)
    sh(['git', 'gc', '-q', '--prune=now'], cwd=d)
    przyszle = [s for s in PRZYSZLOSC if subprocess.run(['git', 'cat-file', '-e', s + '^{commit}'], cwd=d, capture_output=True).returncode == 0]
    if przyszle: raise SystemExit('kopia zna przyszłe commity: %s' % przyszle)
    env = [p for p in sh(['git', 'ls-files', '-co', '--exclude-standard'], cwd=d).split('\n') + os.listdir(d)
           if re.search(r'(^|/)\.env(\.|$)', p) and not re.search(r'\.(example|sample|template)$', p)]
    if env: raise SystemExit('kopia ma pliki .env*: %s' % env)
    # known-issues sprzed fixa: P3 faz 1–3 (fix 793be1a dopisał „## Faza 4”, scribe — „## P3 faza 4”, który odtworzy komenda scribe’a)
    ki = sh(['git', '-C', VIBERSI, 'show', '793be1a:%s/known-issues.md' % ZADANIE])
    ki = ki[:ki.index('\n## P3 faza 4')].rstrip('\n') + '\n'
    open(os.path.join(d, ZADANIE, 'known-issues.md'), 'w').write(ki)
    tmp = kat(k, 'scribe4'); os.makedirs(tmp, exist_ok=True)
    for c in komendy_scribea():
        r = subprocess.run(['bash', '-c', przepisz_komende(c, d, tmp)], cwd=d, capture_output=True, text=True)
        if r.returncode != 0: raise SystemExit('komenda scribe’a padła: %s' % (r.stderr or r.stdout)[-600:])
    zad = open(os.path.join(d, ZADANIE, 'etap-3-konto-i-auth-zadania.md')).read()
    sekcja = zad[zad.index('## Do poprawy po review fazy 4'):zad.index('## Operator checklist faza 4')]
    if sekcja.count('- [ ] 🟠 [P2]') != 16: raise SystemExit('„Do poprawy po review fazy 4”: oczekiwane 16 pozycji P2')
    raport = os.path.join(d, ZADANIE, 'review-faza-4.md')
    archiwum = sh(['git', '-C', VIBERSI, 'show', '08e5584:docs/completed/etap-3-konto-i-auth/review-faza-4.md'])
    zgodny = os.path.exists(raport) and open(raport).read().strip() == archiwum.strip()
    print('baza: %s, raport review fazy 4 %s archiwum, Do poprawy: 16 × P2' % (BAZA_SHA, '=' if zgodny else '≠ (różnica — sprawdź)'))
    sh(['pnpm', 'install', '--frozen-lockfile', '--offline', '--silent'], cwd=d)
    sh(['git', 'add', '-A'], cwd=d)
    sh(['git', '-c', 'user.name=pilot', '-c', 'user.email=pilot@p21', 'commit', '-qm', 'pilot P21: stan po review fazy 4 (raport, Do poprawy i P3 ze scribe’a)'], cwd=d)
    return d


def nakladka(k, nazwa, ref):
    """Kopia APFS bazy + .claude szablonu z ref (bez kasowania plików projektu, np. skill weryfikacji); commit nakładki = baza diffu fixa."""
    d = kat(k, nazwa)
    sh(['cp', '-c', '-R', kat(k, 'baza'), d])
    tmp = kat(k, 'claude-' + nazwa); os.makedirs(tmp, exist_ok=True)
    sh(['bash', '-c', 'git -C "%s" archive "%s" .claude | tar -x -C "%s"' % (REPO, ref, tmp)])
    sh(['rsync', '-a', tmp + '/.claude/', d + '/.claude/'])
    sh(['git', 'add', '-A', '.claude'], cwd=d)
    sh(['git', '-c', 'user.name=pilot', '-c', 'user.email=pilot@p21', 'commit', '-qm', 'pilot P21: nakładka .claude (%s)' % ref], cwd=d)
    return {'kopia': d, 'ref': ref, 'ref_sha': sh(['git', '-C', REPO, 'rev-parse', ref]), 'baza': sh(['git', 'rev-parse', 'HEAD'], cwd=d)}


def atrapa_agent_browser(znacznik, prawdziwy, sekund):
    """Pierwszy `screenshot` po `open` strony innej niz about:blank wisi `sekund` (jak zrzut 2026-10-15 w fazie 4 etapu 3); reszta — CLI."""
    return ('#!/bin/bash\n'
            'poprz=""; for a in "$@"; do [[ "$poprz" == "open" ]] && echo "$a" > "%(z)s.url"; poprz="$a"; done\n'
            'if [[ " $* " == *" screenshot "* && ! -e "%(z)s" && -s "%(z)s.url" && "$(cat "%(z)s.url")" != "about:blank" ]]; then\n'
            '  touch "%(z)s"; sleep %(s)d; exit 1\nfi\n'
            'exec "%(p)s" "$@"\n' % {'z': znacznik, 'p': prawdziwy, 's': sekund})


def smoke_pliki(k, d):
    """Smoke P20: plik z fikcyjną wartością (A10), zadanie A1 z jednym scenariuszem [E2E] na stronie statycznej, .env.e2e bez sekretów,
    atrapa agent-browser (pierwszy zrzut strony scenariusza wisi 90 s, kolejne idą do prawdziwego CLI)."""
    open(os.path.join(d, '.env.smoke-p20'), 'w').write('SMOKE_P20_SEKRET=%s\n' % SEKRET_SMOKE)
    port = 5199
    open(os.path.join(d, '.env.e2e'), 'w').write('E2E_URL="http://127.0.0.1:%d"\nE2E_TEST_EMAIL="smoke@example.invalid"\nE2E_TEST_PASSWORD="nieistotne"\n' % port)
    strona = kat(k, 'smoke-strona'); os.makedirs(strona, exist_ok=True)
    open(os.path.join(strona, 'smoke-a1.html'), 'w').write('<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Smoke A1</title></head>'
                                                           '<body><h1>Smoke A1</h1><p id="stan">gotowe</p></body></html>\n')
    z = os.path.join(d, 'docs/active/smoke-a1'); os.makedirs(z, exist_ok=True)
    open(os.path.join(z, 'smoke-a1-zadania.md'), 'w').write(
        '# Zadania — smoke-a1\n\n## Faza 1 — Strona statyczna\n\n### IU-1: Strona (feature-builder-ui)\n\n'
        '- [x] Stwórz: `public/smoke-a1.html`\n'
        '- [ ] Test: [E2E] `strona-smoke-a1` — otwórz /smoke-a1.html, sprawdź nagłówek „Smoke A1” i tekst „gotowe” w #stan, zrób screenshot → nagłówek i tekst widoczne\n\n'
        '## Operator checklist faza 1\n\n')
    atrapy = kat(k, 'smoke-bin'); os.makedirs(atrapy, exist_ok=True)
    prawdziwy = shutil.which('agent-browser') or 'agent-browser'
    znacznik = kat(k, 'smoke-bin', 'zawieszony')
    open(os.path.join(atrapy, 'agent-browser'), 'w').write(atrapa_agent_browser(znacznik, prawdziwy, 90))
    os.chmod(os.path.join(atrapy, 'agent-browser'), 0o755)
    return {'port': port, 'strona': strona, 'atrapy': atrapy}


def przygotuj(k, stary, nowy):
    d = baza(k)
    f = findingi_e3()
    json.dump(f, open(kat(k, 'findingi.json'), 'w'), ensure_ascii=False, indent=1)
    meta = {'baza_sha': sh(['git', 'rev-parse', 'HEAD'], cwd=d), 'findingi': len(f), 'warianty': {}}
    for w, ref in (('stary', stary), ('nowy', nowy)):
        meta['warianty'][w] = nakladka(k, w, ref)
        pl = kat(k, w + '-pliki'); os.makedirs(pl, exist_ok=True)
        sh(['node', os.path.join(TU, 'p21_pilot_generuj.mjs'), 'fix', os.path.join(kat(k, 'claude-' + w), '.claude/workflows/dev-autopilot-wf.js'),
            kat(k, 'findingi.json'), w, os.path.join(pl, 'wariant-fix.js')])
    meta['smoke'] = nakladka(k, 'smoke', nowy)
    meta['smoke'].update(smoke_pliki(k, meta['smoke']['kopia']))
    os.makedirs(kat(k, 'smoke-pliki'), exist_ok=True)
    sh(['node', os.path.join(TU, 'p21_pilot_generuj.mjs'), 'smoke', os.path.join(kat(k, 'claude-nowy'), '.claude/workflows/dev-docs-review-wf.js'),
        kat(k, 'findingi.json'), kat(k, 'smoke-pliki', 'smoke-p20.js')])
    json.dump(meta, open(kat(k, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    print('przygotowane: %s (findingi %d, stary %s, nowy %s)' % (k, len(f), meta['warianty']['stary']['ref_sha'][:7], meta['warianty']['nowy']['ref_sha'][:7]))


# ── Sesje ────────────────────────────────────────────────────────────────

def skrypt_kroku(k, krok):
    if krok.startswith('fix-'): return kat(k, krok[4:] + '-pliki', 'wariant-fix.js')
    return {'smoke': kat(k, 'smoke-pliki', 'smoke-p20.js'), 'sedzia': kat(k, 'sedzia-pliki', 'sedzia.js')}[krok]


def katalog_kroku(k, krok):
    if krok.startswith('fix-'): return kat(k, krok[4:])
    return {'smoke': kat(k, 'smoke'), 'sedzia': kat(k, 'sedzia')}[krok]


def ustawienia(k, krok):
    """deny: Documents (vibersi z przyszłością, szablon), transkrypty projektów, inne kopie i pliki harnessu (wyniki, sędzia, drugi
    wariant). Hooki zostają włączone (A10, środowisko jak w runie). Bash omija deny Read — przeciek liczy `skan` z transkryptów."""
    wlasne = {katalog_kroku(k, krok), os.path.dirname(skrypt_kroku(k, krok))}
    inne = [p for p in glob.glob(kat(k, '*')) if os.path.isdir(p) and p not in wlasne]
    deny = ['Read(//Users/kacper_trzepiecinski/Documents/**)', 'Read(~/.claude/projects/**)'] + ['Read(/%s/**)' % p for p in sorted(inne)]
    deny += ['WebFetch', 'WebSearch', 'Bash(gh:*)', 'Bash(git push:*)', 'Bash(git fetch:*)', 'Bash(git pull:*)', 'Bash(git remote:*)']
    if krok != 'smoke': deny += ['Bash(curl:*)', 'Bash(wget:*)']
    if krok == 'sedzia': deny += ['Edit', 'Write', 'NotebookEdit']
    return {'permissions': {'deny': deny}}


def budzet(krok):
    """Bezpiecznik --max-budget-usd = 2 × górna granica kroku [M] × 5 USD; fix: 4 M (stary fix fazy 4 = 3,48 M), smoke 1 M, sędzia 1,5 M."""
    return round(2 * {'smoke': 1.0, 'sedzia': 1.5}.get(krok, 4.0) * USD_M, 2)


def start(k, krok):
    skrypt, d = skrypt_kroku(k, krok), katalog_kroku(k, krok)
    if not os.path.exists(skrypt): raise SystemExit('brak skryptu %s — najpierw przygotuj / sedzia-przygotuj' % skrypt)
    sid = id_sesji(k, krok)
    log_d = kat(k, 'sesje'); os.makedirs(log_d, exist_ok=True)
    ust = os.path.join(log_d, krok + '.ustawienia.json')
    json.dump(ustawienia(k, krok), open(ust, 'w'), ensure_ascii=False, indent=1)
    wiad = ('Uruchom narzędzie Workflow z parametrem scriptPath="%s" i args={} — to jest moje wyraźne polecenie uruchomienia tego workflow '
            '(pilot P21). Nie wykonuj żadnych innych działań: nie czytaj plików, nie uruchamiaj poleceń, nie oceniaj wyniku. Poczekaj na '
            'zakończenie workflow i odpowiedz jednym wierszem: RUN <identyfikator runu> <status>.\n%s' % (skrypt, N1))
    env = dict(os.environ, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS='0')
    serwer = None
    if krok == 'smoke':
        meta = json.load(open(kat(k, 'meta.json')))['smoke']
        env['PATH'] = meta['atrapy'] + ':' + env['PATH']
        serwer = subprocess.Popen(['python3', '-m', 'http.server', str(meta['port']), '--bind', '127.0.0.1', '--directory', meta['strona']],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cmd = ['claude', '-p', wiad, '--model', MODEL, '--effort', 'high', '--permission-mode', 'bypassPermissions', '--settings', ust,
           '--session-id', sid, '--output-format', 'json', '--max-budget-usd', str(budzet(krok))]
    if krok != 'smoke': cmd.append('--strict-mcp-config')
    try:
        with open(os.path.join(log_d, krok + '.out.json'), 'w') as fo, open(os.path.join(log_d, krok + '.err.txt'), 'w') as fe:
            kod = subprocess.run(cmd, cwd=d, stdin=subprocess.DEVNULL, stdout=fo, stderr=fe, env=env).returncode
    finally:
        if serwer: serwer.terminate()
    print('%s: sesja %s zakończona kodem %s' % (krok, sid, kod))
    return kod


def katalog_sesji(k, krok):
    return os.path.join(PROJ, slug(katalog_kroku(k, krok)), id_sesji(k, krok))


def agenci_runu(k, krok):
    runy = sorted(glob.glob(os.path.join(katalog_sesji(k, krok), 'workflows', '*.json')), key=os.path.getmtime)
    if not runy: raise SystemExit('%s: brak pliku runu w sesji' % krok)
    r = json.load(open(runy[-1]))
    d = os.path.join(katalog_sesji(k, krok), 'subagents', 'workflows', r.get('runId', ''))
    agenci = []
    for jf in sorted(glob.glob(os.path.join(d, 'agent-*.jsonl'))):
        m = jf[:-len('.jsonl')] + '.meta.json'
        etykieta = json.load(open(m)).get('description') if os.path.exists(m) else '?'
        agenci.append(dict(etykieta=etykieta, plik=jf, **koszt_agenta(jf)))
    return r, agenci


def zbierz(k, krok):
    r, agenci = agenci_runu(k, krok)
    wynik = r.get('result')
    if isinstance(wynik, str):
        try: wynik = json.loads(wynik)
        except ValueError: pass
    dane = {'wynik': wynik, 'run': {'runId': r.get('runId'), 'status': r.get('status'), 'ms': r.get('durationMs'), 'logi': r.get('logs')},
            'agenci': [{x: a[x] for x in ('etykieta', 'jedn', 'tury', 'ctx_max')} for a in agenci],
            'koszt_jedn': round(sum(a['jedn'] for a in agenci), 3)}
    os.makedirs(kat(k, 'wyniki'), exist_ok=True)
    json.dump(dane, open(kat(k, 'wyniki', krok + '.json'), 'w'), ensure_ascii=False, indent=1)
    print('%s: run %s %s, agentów %d, koszt %.2f M' % (krok, r.get('runId'), r.get('status'), len(agenci), dane['koszt_jedn']))


def walidacja(k, w):
    d = kat(k, w)
    tc = subprocess.run(['pnpm', 'typecheck'], cwd=d, capture_output=True, text=True)
    vt = subprocess.run(['pnpm', 'vitest', 'run', '--reporter=dot'], cwd=d, capture_output=True, text=True)
    m = re.search(r'Tests\s+(?:(\d+) failed \| )?(\d+) passed', vt.stdout + vt.stderr)
    wynik = {'typecheck': tc.returncode == 0, 'testy_kod': vt.returncode, 'testy_padly': int(m.group(1) or 0) if m else None,
             'testy_przeszly': int(m.group(2)) if m else None,
             'commity': sh(['git', 'log', '--format=%h %s', json.load(open(kat(k, 'meta.json')))['warianty'][w]['baza'] + '..HEAD'], cwd=d).split('\n')}
    os.makedirs(kat(k, 'wyniki'), exist_ok=True)
    json.dump(wynik, open(kat(k, 'wyniki', 'walidacja-%s.json' % w), 'w'), ensure_ascii=False, indent=1)
    print(w, json.dumps(wynik, ensure_ascii=False)[:400])


# ── Sędzia ─────────────────────────────────────────────────────────────────

def kolejnosc(k):
    """A/B z hasha katalogu pilota — sędzia nie wie, który wariant jest który; mapowanie tylko w sedzia-pliki/mapa.json."""
    h = int(hashlib.sha256(os.path.abspath(k).encode()).hexdigest(), 16)
    return ('stary', 'nowy') if h % 2 == 0 else ('nowy', 'stary')


def porcje_sedziego(findingi, maks=4):
    return [findingi[i:i + maks] for i in range(0, len(findingi), maks)]


def sedzia_przygotuj(k):
    meta = json.load(open(kat(k, 'meta.json')))
    f = json.load(open(kat(k, 'findingi.json')))
    d = kat(k, 'sedzia'); pl = kat(k, 'sedzia-pliki')
    if os.path.exists(d): shutil.rmtree(d)
    os.makedirs(d); os.makedirs(pl, exist_ok=True)
    mapa = dict(zip('AB', kolejnosc(k)))
    zmienione = set()
    for lit, w in mapa.items():
        kp, b = meta['warianty'][w]['kopia'], meta['warianty'][w]['baza']
        wyk = [':(exclude)docs', ':(exclude).claude', ':(exclude)pnpm-lock.yaml']
        diff = sh(['git', 'diff', b, 'HEAD', '--', '.'] + wyk, cwd=kp)
        os.makedirs(os.path.join(d, lit, 'po'), exist_ok=True)
        open(os.path.join(d, lit, 'zmiany.diff'), 'w').write(diff + '\n')
        for p in sh(['git', 'diff', '--name-only', '--diff-filter=AM', b, 'HEAD', '--', '.'] + wyk, cwd=kp).split('\n'):
            if not p: continue
            zmienione.add(p)
            os.makedirs(os.path.dirname(os.path.join(d, lit, 'po', p)), exist_ok=True)
            shutil.copyfile(os.path.join(kp, p), os.path.join(d, lit, 'po', p))
    baza_k = kat(k, 'baza')
    for p in sorted(zmienione):
        if os.path.exists(os.path.join(baza_k, p)):
            os.makedirs(os.path.dirname(os.path.join(d, 'przed', p)), exist_ok=True)
            shutil.copyfile(os.path.join(baza_k, p), os.path.join(d, 'przed', p))
    neutralne = [{'id': 'F%d' % (i + 1), 'waga': x['severity'], 'typ': x['typ'], 'plik': x['plik'], 'opis': x['opis']} for i, x in enumerate(f)]
    json.dump(neutralne, open(os.path.join(d, 'findingi.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump({'mapa': mapa}, open(os.path.join(pl, 'mapa.json'), 'w'))
    szablon = open(os.path.join(TU, 'p21_sedzia_szablon.js')).read()
    if szablon.count('__PORCJE__') != 1: raise SystemExit('szablon sędziego bez znacznika __PORCJE__')
    open(os.path.join(pl, 'sedzia.js'), 'w').write(szablon.replace('__PORCJE__', json.dumps([[x['id'] for x in p] for p in porcje_sedziego(neutralne)])))
    print('sędzia: %d findingów w %d porcjach, plików zmienionych %d (mapa w sedzia-pliki/mapa.json)' % (len(f), len(porcje_sedziego(f)), len(zmienione)))


# ── Skan przecieku i wynik ──────────────────────────────────────────────────

def skan(k, krok):
    """Odczyt spoza własnego katalogu: vibersi w Documents (przyszłość), inne kopie i pliki harnessu, transkrypty projektów, sekret smoke'u."""
    wlasny = katalog_kroku(k, krok)
    _, agenci = agenci_runu(k, krok)
    obce = [VIBERSI + '/', VIBERSI + '"', VIBERSI + "'", PROJ] + [p for p in glob.glob(kat(k, '*')) if os.path.isdir(p) and p != wlasny
                                                                  and not (krok == 'smoke' and p.endswith(('smoke-bin', 'smoke-strona')))]
    trafienia = []
    for a in agenci:
        for l in open(a['plik'], errors='ignore'):
            o = json.loads(l)
            if o.get('type') != 'assistant': continue
            for c in o['message'].get('content', []):
                if c.get('type') != 'tool_use': continue
                # własny katalog transkryptów sesji kroku (przetrwałe wyniki narzędzi `tool-results`) to nie przeciek
                t = json.dumps(c.get('input'), ensure_ascii=False).replace(os.path.join(PROJ, slug(wlasny)) + '/', '')
                trafienia += ['%s: %s' % (a['etykieta'], x) for x in obce if x in t and not (x == wlasny)]
        if SEKRET_SMOKE in open(a['plik'], errors='ignore').read(): trafienia.append('%s: WARTOŚĆ .env.smoke-p20 w transkrypcie' % a['etykieta'])
    os.makedirs(kat(k, 'wyniki'), exist_ok=True)
    json.dump(trafienia, open(kat(k, 'wyniki', 'skan-%s.json' % krok), 'w'), ensure_ascii=False, indent=1)
    print('%s: przeciek %d%s' % (krok, len(trafienia), ''.join('\n  ' + t for t in trafienia[:10])))
    return 1 if trafienia else 0


def etap_fixa(agenci):
    rola = lambda e: 'kontrola' if e.startswith('fix:kontrola') else 'poprawka' if e.startswith('fix:poprawka') else 'fix'
    s = {}
    for a in agenci:
        r = rola(a['etykieta']); x = s.setdefault(r, {'agentow': 0, 'jedn': 0.0, 'ctx_max': 0, 'tury': 0})
        x['agentow'] += 1; x['jedn'] = round(x['jedn'] + a['jedn'], 3); x['ctx_max'] = max(x['ctx_max'], a['ctx_max']); x['tury'] += a['tury']
    return s


def pozycje_k(wynik):
    k = (wynik or {}).get('kontrolaFixa') or {}
    return k.get('pozycje')


def wynik(k):
    w = {x: json.load(open(kat(k, 'wyniki', 'fix-%s.json' % x))) for x in WARIANTY if os.path.exists(kat(k, 'wyniki', 'fix-%s.json' % x))}
    print('| wariant | koszt etapu fix [M] | fix (agentów, ctx max) | kontrola | poprawka | pozycje K | walidacja | naprawione / częściowo / nie | regresje sędziego |')
    print('|---|---|---|---|---|---|---|---|---|')
    sedzia = json.load(open(kat(k, 'wyniki', 'sedzia.json'))) if os.path.exists(kat(k, 'wyniki', 'sedzia.json')) else None
    mapa = json.load(open(kat(k, 'sedzia-pliki', 'mapa.json')))['mapa'] if sedzia else {}
    for x, d in w.items():
        e = etap_fixa(d['agenci'])
        wal = json.load(open(kat(k, 'wyniki', 'walidacja-%s.json' % x))) if os.path.exists(kat(k, 'wyniki', 'walidacja-%s.json' % x)) else {}
        ocena = '—'; reg = '—'
        if sedzia:
            lit = [l for l, v in mapa.items() if v == x][0]
            werdykty = [p[lit] for p in ((sedzia.get('wynik') or {}).get('oceny') or [])]
            ocena = '%d / %d / %d' % tuple(werdykty.count(v) for v in ('NAPRAWIONY', 'CZESCIOWO', 'NIENAPRAWIONY'))
            reg = str(len(((sedzia.get('wynik') or {}).get('regresje') or {}).get(lit) or []))
        f = e.get('fix', {}); kk = e.get('kontrola', {}); pp = e.get('poprawka', {})
        print('| %s | %.2f | %.2f (%d, %dk) | %.2f | %.2f | %s | tc %s, testy %s/%s | %s | %s |' % (
            x, sum(v['jedn'] for v in e.values()), f.get('jedn', 0), f.get('agentow', 0), f.get('ctx_max', 0) // 1000, kk.get('jedn', 0),
            pp.get('jedn', 0), pozycje_k(d['wynik']), wal.get('typecheck'), wal.get('testy_padly'), wal.get('testy_przeszly'), ocena, reg))
    if os.path.exists(kat(k, 'wyniki', 'smoke.json')):
        s = json.load(open(kat(k, 'wyniki', 'smoke.json')))
        print('smoke P20:', json.dumps({x: (s.get('wynik') or {}).get(x) for x in ('hook', 'verify')}, ensure_ascii=False))
        e2e = (s.get('wynik') or {}).get('e2e') or {}
        print('A1 przebiegi:', json.dumps(e2e.get('przebiegi'), ensure_ascii=False)[:600])


def a9(k, krok):
    """P20 A9: polecenie fix:poprawka ma `git diff <x>^ -- '<plik>' …` (diff tylko plików pozycji K). Szuka w całym transkrypcie
    wiadomości użytkownika, bo polecenie bywa pierwszą wiadomością (bez osobnego wstępu)."""
    _, agenci = agenci_runu(k, krok)
    for a in agenci:
        if not a['etykieta'].startswith('fix:poprawka'): continue
        for l in open(a['plik'], errors='ignore'):
            o = json.loads(l)
            c = (o.get('message') or {}).get('content') if o.get('type') == 'user' else None
            t = c if isinstance(c, str) else (c[0].get('text', '') if isinstance(c, list) and c and c[0].get('type') == 'text' else '')
            m = re.search(r"git diff <najstarszy>\^ -- ((?:'[^']+' ?)+)", t)
            if m: return re.findall(r"'([^']+)'", m.group(1))
    return None


def zapisz(k, cel):
    """dane/p21-pilot-wynik.json: koszt per rola i krok, werdykty sędziego per finding (odkodowane A/B), regresje, walidacja, smoke, A9."""
    mapa = json.load(open(kat(k, 'sedzia-pliki', 'mapa.json')))['mapa']
    s = json.load(open(kat(k, 'wyniki', 'sedzia.json')))
    out = {'katalog': os.path.abspath(k), 'mapa_ab': mapa, 'warianty': {}, 'koszt_krokow': {}}
    for krok in ('fix-stary', 'fix-nowy', 'sedzia', 'smoke'):
        d = json.load(open(kat(k, 'wyniki', krok + '.json')))
        out['koszt_krokow'][krok] = {'run': d['run']['runId'], 'status': d['run']['status'], 'ms': d['run']['ms'], 'jedn': d['koszt_jedn'], 'agenci': d['agenci']}
    out['koszt_razem'] = round(sum(v['jedn'] for v in out['koszt_krokow'].values()), 2)
    for w in WARIANTY:
        d = json.load(open(kat(k, 'wyniki', 'fix-%s.json' % w)))
        lit = [l for l, v in mapa.items() if v == w][0]
        oc = {o['id']: o[lit] for o in s['wynik']['oceny']}
        e = etap_fixa(d['agenci'])
        out['warianty'][w] = {'etap_fix': e, 'etap_fix_jedn': round(sum(v['jedn'] for v in e.values()), 3), 'wynik_runu': d['wynik'],
                              'logi': d['run']['logi'], 'walidacja': json.load(open(kat(k, 'wyniki', 'walidacja-%s.json' % w))),
                              'sedzia': {'oceny': oc, 'licznik': {v: list(oc.values()).count(v) for v in ('NAPRAWIONY', 'CZESCIOWO', 'NIENAPRAWIONY')},
                                         'regresje': s['wynik']['regresje'].get(lit) or []},
                              'a9_pliki_diffu_poprawki': a9(k, 'fix-' + w)}
    out['sedzia_uzasadnienia'] = {o['id']: o['uzasadnienie'] for o in s['wynik']['oceny']}
    out['roznice_sedziego'] = [i for i in out['sedzia_uzasadnienia'] if out['warianty']['stary']['sedzia']['oceny'][i] != out['warianty']['nowy']['sedzia']['oceny'][i]]
    sm = json.load(open(kat(k, 'wyniki', 'smoke.json')))
    out['smoke'] = {'wynik': sm['wynik'], 'logi': sm['run']['logi']}
    out['skan'] = {x: len(json.load(open(kat(k, 'wyniki', 'skan-%s.json' % x)))) for x in ('fix-stary', 'fix-nowy', 'sedzia', 'smoke')}
    json.dump(out, open(cel, 'w'), ensure_ascii=False, indent=1)
    st, nw = out['warianty']['stary'], out['warianty']['nowy']
    print('koszt pilota %.2f M; etap fix stary %.2f / nowy %.2f (%+.0f%%); naprawione %d / %d; różnice sędziego %s; regresje %d / %d; A9 %d / %d plików; skan %s'
          % (out['koszt_razem'], st['etap_fix_jedn'], nw['etap_fix_jedn'], 100 * (nw['etap_fix_jedn'] / st['etap_fix_jedn'] - 1),
             st['sedzia']['licznik']['NAPRAWIONY'], nw['sedzia']['licznik']['NAPRAWIONY'], out['roznice_sedziego'],
             len(st['sedzia']['regresje']), len(nw['sedzia']['regresje']), len(st['a9_pliki_diffu_poprawki'] or []),
             len(nw['a9_pliki_diffu_poprawki'] or []), out['skan']))


# ── Plan kosztu i suchy bieg ───────────────────────────────────────────────

def koszt_planu(k):
    """Górna granica z runu etapu 3 (fix fazy 4 = stary wariant 1:1): stary = fix + kontrola + poprawka; nowy ≤ stary (cel −35…45%
    etapu fix, 6a pkt 86 h — do granicy bierzemy stary); sędzia 6 agentów ≈ kontrola fixa × 6 + zapas; smoke: haiku + 4 sceptyków P2
    (verify-batch etapu 3: 0,03 M, z zapasem 0,05) + tester (najdroższy review:e2e etapu 3)."""
    e3 = {e: koszt_agenta(agent_e3(e)) for e in ('fix:faza-4', 'fix:kontrola:faza-4', 'fix:poprawka:faza-4')}
    testerzy = [koszt_agenta(p)['jedn'] for p in agenci_e3('review:e2e')]
    e3['review:e2e (średnia z %d faz)' % len(testerzy)] = {'jedn': round(sum(testerzy) / len(testerzy), 3)}
    stary = round(sum(e3[e]['jedn'] for e in ('fix:faza-4', 'fix:kontrola:faza-4', 'fix:poprawka:faza-4')), 2)
    plan = {
        'zrodlo': 'run %s, agenci fazy 4 (koszt z transkryptów, jednostki telemetrii)' % RUN_E3,
        'e3_faza4': {e: v for e, v in e3.items()},
        'fix_stary': stary,
        'fix_nowy_oczekiwany': round(stary * 0.6, 2),
        'fix_nowy_granica': stary,
        'sedzia': round(e3['fix:kontrola:faza-4']['jedn'] * 6 + 0.3, 2),
        'smoke': round(0.05 + 4 * 0.05 + max(testerzy), 2),
        'sesje_i_zapas': 0.5,
    }
    plan['razem_oczekiwany'] = round(plan['fix_stary'] + plan['fix_nowy_oczekiwany'] + plan['sedzia'] + plan['smoke'] + plan['sesje_i_zapas'], 2)
    plan['razem_granica'] = round(plan['fix_stary'] + plan['fix_nowy_granica'] + plan['sedzia'] + plan['smoke'] + plan['sesje_i_zapas'], 2)
    plan['bezpieczniki_usd'] = {x: budzet(x) for x in ('fix-stary', 'fix-nowy', 'smoke', 'sedzia')}
    os.makedirs(kat(k), exist_ok=True)
    json.dump(plan, open(kat(k, 'plan-kosztu.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(plan, ensure_ascii=False, indent=1))
    return plan


def suchy(k):
    meta = json.load(open(kat(k, 'meta.json')))
    os.makedirs(kat(k, 'sesje'), exist_ok=True)
    for krok in ('fix-stary', 'fix-nowy', 'smoke'):
        out = sh(['node', os.path.join(TU, 'p21_pilot_generuj.mjs'), 'suchy', skrypt_kroku(k, krok), kat(k, 'sesje', 'zrzut-%s.txt' % krok)])
        d = json.loads(out)
        print('%s: agentów %d — %s' % (krok, len(d['agenci']), ', '.join(a['label'] for a in d['agenci'])))
        print('  ustawienia: deny %d, budżet %.0f USD' % (len(ustawienia(k, krok)['permissions']['deny']), budzet(krok)))
    sc = sh(['node', '.claude/scripts/e2e/e2e.mjs', 'scenariusze', '--zadanie', 'docs/active/smoke-a1', '--faza', '1'], cwd=meta['smoke']['kopia'], check=False)
    print('A1: scenariusze skryptu e2e.mjs w kopii smoke:', sc[-300:])
    koszt_planu(k)


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    tryb, k = a[0], a[1]
    opcje = dict(zip(a[2::2], a[3::2]))
    if tryb == 'przygotuj': przygotuj(k, opcje.get('--stary', 'main'), opcje.get('--nowy', 'popr/P21-koszt'))
    elif tryb == 'suchy': suchy(k)
    elif tryb == 'koszt-planu': koszt_planu(k)
    elif tryb == 'start': sys.exit(start(k, a[2]))
    elif tryb == 'zbierz': zbierz(k, a[2])
    elif tryb == 'walidacja': walidacja(k, a[2])
    elif tryb == 'sedzia-przygotuj': sedzia_przygotuj(k)
    elif tryb == 'skan': sys.exit(skan(k, a[2]))
    elif tryb == 'wynik': wynik(k)
    elif tryb == 'zapisz': zapisz(k, a[2])
    else: sys.exit(__doc__)

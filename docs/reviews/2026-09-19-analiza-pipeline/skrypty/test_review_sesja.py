#!/usr/bin/env python3
"""Test review (TEST-REVIEW-PLAN §4, §12) — jedna sesja headless na (kopia, krok, wariant): ustawienia, start, zbiór wyniku runu Workflow.

Użycie:
  python3 skrypty/test_review_sesja.py start <etykieta> <krok> <wariant>   krok: review | sceptycy | sedzia-p<N> ; wariant: 0 A B C (sędzia: S)
  python3 skrypty/test_review_sesja.py zbierz <etykieta> <krok> <wariant>
  python3 skrypty/test_review_sesja.py gotowy <etykieta> <krok> <wariant>   kod 0 = krok zrobiony (run completed, sesja bez błędu, zero błędów API)
  python3 skrypty/test_review_sesja.py odrzuc <etykieta> <krok> <wariant>   niedokończoną próbę przenosi do ~/test-review/odrzucone/ (przed ponownym startem)
Start: `claude -p` z katalogu kopii, --model claude-opus-5-5, --effort high (wariant 0 dziedziczy go u reviewerów i sceptyków P1; A/B/C i sędzia
mają efort per rola w skrypcie), --strict-mcp-config (zero serwerów MCP), --permission-mode bypassPermissions + --settings z deny (odczyt spoza kopii
fazy, zapis plików, sieć, gh; hooki wyłączone — jednakowo dla wszystkich wariantów), --session-id (deterministyczny uuid5), --max-budget-usd
(2 × górna granica kosztu fazy-wariantu z dane/test-review-plan.json × 5 USD/M jedn. — bezpiecznik; limit właściwy liczy test_review_wynik.py).
Wiadomość startowa: uruchom Workflow z podanym skryptem i args (N1: zdanie „Do agentów…”). Wynik: ~/test-review/wyniki/<et>/<plik>.json z pola
`result` pliku runu ~/.claude/projects/<slug kopii>/<sesja>/workflows/<run>.json (+ status, model domyślny, czas)."""
import glob, json, os, re, shutil, subprocess, sys, time, uuid

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = os.path.expanduser('~/test-review')
PROJ = os.path.expanduser('~/.claude/projects')
MODEL = 'claude-opus-5-5'
USD_M = 5.0
N1 = 'Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.'


def slug(sciezka):
    return re.sub(r'[^A-Za-z0-9]', '-', sciezka)


def id_sesji(et, krok, w):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'test-review/%s/%s/%s' % (et, krok, w)))


def nazwa_wyniku(krok, w):
    return {'review': 'wariant%s.json' % w, 'sceptycy': 'sceptycy%s.json' % w}.get(krok, '%s.json' % krok)


def pliki_proby(et, krok, w):
    """Wszystko, co zostawia jedna próba kroku: wynik, logi sesji, transkrypt sesji (z runami Workflow i agentami) i jej scratchpad."""
    kopia = json.load(open(os.path.join(TR, 'meta', et + '.json')))['kopia']
    sid, log = id_sesji(et, krok, w), os.path.join(TR, 'sesje', et, '%s-%s' % (krok, w))
    return [os.path.join(TR, 'wyniki', et, nazwa_wyniku(krok, w)), log + '.out.json', log + '.err.txt', log + '.ustawienia.json',
            os.path.join(PROJ, slug(kopia), sid + '.jsonl'), os.path.join(PROJ, slug(kopia), sid),
            os.path.join('/private/tmp', 'claude-%d' % os.getuid(), slug(kopia), sid)]


def blad_api(jf):
    """Agent dostał błąd API zamiast odpowiedzi modelu (harness wpisuje wtedy model <synthetic>, np. przy wyczerpanym limicie konta)."""
    for line in open(jf, errors='ignore'):
        if '<synthetic>' not in line: continue
        try: o = json.loads(line)
        except ValueError: continue
        if (o.get('message') or {}).get('model') == '<synthetic>': return True
    return False


def gotowy(et, krok, w):
    """Krok zrobiony = run Workflow completed, sesja bez błędu (is_error false) i żaden agent nie dostał błędu API."""
    wynik, out, _, _, _, katalog, _ = pliki_proby(et, krok, w)
    try:
        if (json.load(open(wynik)).get('_run') or {}).get('status') != 'completed': return False
        if json.load(open(out)).get('is_error') is not False: return False
    except (OSError, ValueError): return False
    return not any(blad_api(jf) for jf in glob.glob(os.path.join(katalog, 'subagents', 'workflows', '*', 'agent-*.jsonl')))


def odrzuc(et, krok, w):
    """Niedokończona próba kroku → ~/test-review/odrzucone/<et>/<krok>-<w>-<czas>/ (przeniesienie, nie kasowanie): ponowny start z tym samym
    deterministycznym id sesji jest wtedy czysty, a skan i koszt nie mieszają prób (koszt odrzuconych prób liczy test_review_wynik.py koszt)."""
    if gotowy(et, krok, w): return 0
    pliki = [p for p in pliki_proby(et, krok, w) if os.path.exists(p)]
    if not pliki: return 0
    cel = os.path.join(TR, 'odrzucone', et, '%s-%s-%s' % (krok, w, time.strftime('%Y%m%d-%H%M%S')))
    os.makedirs(cel)
    for i, p in enumerate(pliki): shutil.move(p, os.path.join(cel, '%d-%s' % (i, os.path.basename(p))))
    print('%s %s %s: niedokończona próba przeniesiona do %s (%d pozycji)' % (et, krok, w, cel, len(pliki)))
    return 0


def sesje_fazy(et):
    """Id wszystkich sesji, które test może uruchomić dla fazy (warianty review/sceptyków + sędzia p1, p2 jak w test_review_uruchom.sh).
    Skan i koszt liczą tylko je — inne sesje w katalogu kopii (np. próba harnessu z kopii f-b26128d) nie należą do fazy."""
    kroki = [(k, w) for k in ('review', 'sceptycy') for w in '0ABC'] + [('sedzia-p%d' % p, 'S') for p in (1, 2)]
    return {id_sesji(et, k, w) for k, w in kroki}


def skrypt_i_args(et, krok, w):
    meta = json.load(open(os.path.join(TR, 'meta', et + '.json')))
    d = os.path.join(TR, 'skrypty', et)
    fix = et.startswith('x-')
    if krok == 'review':
        if w == '0':
            nazwa = 'test-review-wariant0-fix.js' if fix else 'test-review-wariant0.js'
            cel = os.path.join(TR, 'skrypty', nazwa)
            shutil.copyfile(os.path.join(BASE, 'skrypty', nazwa), cel)   # poza Documents: deny odczytu Documents obejmuje sesję
            war = json.load(open(os.path.join(BASE, 'dane', 'test-review', 'warianty-%s.json' % et)))
            a = {'sciezka': 'docs/active/' + meta['zadanie'], 'faza': war['faza']}
            if not fix: a['srodowiskoE2E'] = 'pominieto'
            return cel, a
        return os.path.join(d, 'wariant%s.js' % w), {}
    if krok == 'sceptycy':
        if w == '0':
            cel = os.path.join(TR, 'skrypty', 'test-review-wariant0-verify.js')
            shutil.copyfile(os.path.join(BASE, 'skrypty', 'test-review-wariant0-verify.js'), cel)
            return cel, json.load(open(os.path.join(d, 'sceptycy0.args.json')))
        return os.path.join(d, 'sceptycy%s.js' % w), {}
    if krok.startswith('sedzia-p'):
        return os.path.join(d, 'sedzia-%s.js' % krok[7:]), {}
    raise SystemExit('nieznany krok ' + krok)


def ustawienia(et):
    """deny: wszystko spoza kopii fazy, co może zdradzić przyszłość albo wynik (inne kopie, lustro, dossier innych faz, wyniki, mapowania)."""
    inne = [os.path.basename(p) for p in glob.glob(os.path.join(TR, 'kopie', '*')) if os.path.basename(p) != et]
    tr = '/' + TR
    deny = ['Read(//Users/kacper_trzepiecinski/Documents/**)', 'Read(~/.claude/projects/**)', 'Read(%s/_mirror/**)' % tr,
            'Read(%s/wyniki/**)' % tr, 'Read(%s/sedzia/**)' % tr, 'Read(%s/prompty/**)' % tr, 'Read(%s/meta/**)' % tr,
            'Read(%s/robocze/**)' % tr, 'Read(//tmp/tr-*/**)']
    deny += ['Read(%s/kopie/%s/**)' % (tr, o) for o in inne] + ['Read(%s/dossier/%s/**)' % (tr, o) for o in inne]
    deny += ['Read(%s/skrypty/%s/**)' % (tr, o) for o in inne]
    fz = json.load(open(os.path.join(BASE, 'dane', 'test-review-fazy.json')))['fazy']
    numer = lambda mo: [v['numer'] for s, v in fz.items() if mo['sha'].startswith(s)][0]
    wlasna = json.load(open(os.path.join(TR, 'meta', et + '.json')))
    wl = (wlasna['zadanie'], numer(wlasna)) if et.startswith('f-') else None
    for o in inne:   # zrzuty packagera wariantu 0 innych faz (/tmp/review-diff|ctx-docs-active-<zadanie>-faza-N.*); powtórka tej samej fazy — nie
        m = os.path.join(TR, 'meta', o + '.json')
        if os.path.exists(m) and o.startswith('f-'):
            mo = json.load(open(m))
            if (mo['zadanie'], numer(mo)) != wl: deny.append('Read(//tmp/review-*-docs-active-%s-faza-%d*)' % (mo['zadanie'], numer(mo)))
    deny += ['Edit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Bash(gh:*)', 'Bash(curl:*)', 'Bash(wget:*)',
             'Bash(git push:*)', 'Bash(git fetch:*)', 'Bash(git pull:*)', 'Bash(git remote:*)', 'Bash(git commit:*)', 'Bash(git checkout:*)',
             'Bash(git reset:*)', 'Bash(git stash:*)']
    return {'disableAllHooks': True, 'permissions': {'deny': deny}}


def budzet(et, krok, w):
    """Bezpiecznik --max-budget-usd = 2 × górna granica kosztu kroku [M jedn.] × USD_M. Review fazy: dzis_max wariantu z test-review-plan.json;
    review fixa: 1 M (4 warianty × 0,33 M środka, §2.6, z zapasem); sędzia: 1,35 M (0,90 × 1,5); sceptycy wariantu: 1 M."""
    if krok == 'review' and et.startswith('f-'):
        fz = json.load(open(os.path.join(BASE, 'dane', 'test-review-plan.json')))['fazy']
        sha = json.load(open(os.path.join(TR, 'meta', et + '.json')))['sha']
        gorna = [f for f in fz if sha.startswith(f['faza'])][0]['koszt'][w]['dzis_max']
    else:
        gorna = 1.35 if krok.startswith('sedzia') else 1.0
    return round(2 * gorna * USD_M, 2)


def start(et, krok, w):
    meta = json.load(open(os.path.join(TR, 'meta', et + '.json')))
    skrypt, args = skrypt_i_args(et, krok, w)
    if not os.path.exists(skrypt): raise SystemExit('brak skryptu ' + skrypt)
    sid = id_sesji(et, krok, w)
    log_d = os.path.join(TR, 'sesje', et); os.makedirs(log_d, exist_ok=True)
    ust = os.path.join(log_d, '%s-%s.ustawienia.json' % (krok, w))
    json.dump(ustawienia(et), open(ust, 'w'), ensure_ascii=False, indent=1)
    wiad = ('Uruchom narzędzie Workflow z parametrem scriptPath="%s" i args=%s — to jest moje wyraźne polecenie uruchomienia tego workflow '
            '(test review). Nie wykonuj żadnych innych działań: nie czytaj plików, nie uruchamiaj poleceń, nie oceniaj wyniku. Poczekaj na '
            'zakończenie workflow i odpowiedz jednym wierszem: RUN <identyfikator runu> <status>.\n%s' % (skrypt, json.dumps(args, ensure_ascii=False), N1))
    cmd = ['claude', '-p', wiad, '--model', MODEL, '--effort', 'high', '--strict-mcp-config', '--permission-mode', 'bypassPermissions',
           '--settings', ust, '--session-id', sid, '--output-format', 'json', '--max-budget-usd', str(budzet(et, krok, w))]
    out = os.path.join(log_d, '%s-%s.out.json' % (krok, w))
    with open(out, 'w') as fo, open(out.replace('.out.json', '.err.txt'), 'w') as fe:
        kod = subprocess.run(cmd, cwd=meta['kopia'], stdin=subprocess.DEVNULL, stdout=fo, stderr=fe).returncode
    print('%s %s %s: sesja %s zakończona kodem %s' % (et, krok, w, sid, kod))
    return kod


def zbierz(et, krok, w):
    meta = json.load(open(os.path.join(TR, 'meta', et + '.json')))
    sid = id_sesji(et, krok, w)
    runy = sorted(glob.glob(os.path.join(PROJ, slug(meta['kopia']), sid, 'workflows', '*.json')), key=os.path.getmtime)
    if not runy: raise SystemExit('%s %s %s: brak pliku runu w sesji %s' % (et, krok, w, sid))
    r = json.load(open(runy[-1]))
    wynik = r.get('result')
    if isinstance(wynik, str):
        try: wynik = json.loads(wynik)
        except ValueError: pass
    d = os.path.join(TR, 'wyniki', et); os.makedirs(d, exist_ok=True)
    nazwa = nazwa_wyniku(krok, w)
    dane = wynik if isinstance(wynik, dict) else {'wynik_surowy': wynik}
    dane['_run'] = {'runId': r.get('runId'), 'status': r.get('status'), 'model': r.get('defaultModel'), 'ms': r.get('durationMs'),
                    'agentow': r.get('agentCount'), 'sesja': sid, 'katalog': os.path.join(PROJ, slug(meta['kopia']), sid)}
    json.dump(dane, open(os.path.join(d, nazwa), 'w'), ensure_ascii=False, indent=1)
    print('%s %s %s: run %s status %s, findingów %s' % (et, krok, w, r.get('runId'), r.get('status'), len(dane.get('findings') or [])))


if __name__ == '__main__':
    tryb, et, krok, w = sys.argv[1:5]
    if tryb == 'gotowy': sys.exit(0 if gotowy(et, krok, w) else 1)
    sys.exit({'start': start, 'zbierz': zbierz, 'odrzuc': odrzuc}[tryb](et, krok, w))

#!/usr/bin/env python3
"""Ślepy test P12 — wejście-wyjście harnessu (logika z testami: test_review_p12.py, test_review_p12_transkrypt.py). Zero agentów poza krokami,
które uruchamia test_review_p12.sh `faza` (sesje headless przez test_review_sesja.py).

Użycie (z katalogu analizy):
  python3 skrypty/test_review_p12_cli.py claude                     — git archive .claude z main (stary) i gałęzi P12 (nowy) → ~/test-review/p12/claude-<w>/
  python3 skrypty/test_review_p12_cli.py przygotuj <et>             — kopie wariantów na bazie buildu (~/test-review/p12-kopie/<et>/<w>), dist bibliotek
                                                                    zbudowany na bazie, skrypty buildu z kontrolą bajtową (<w>-pliki/wariant-build.js)
  python3 skrypty/test_review_p12_cli.py wycinki <et> <w>           — zero agentów: blok reguł/D10, który planner wariantu wkleiłby każdemu IU planu
  python3 skrypty/test_review_p12_cli.py nakladka <et> <w> <zrodlo> — .claude wariantu <zrodlo> (stary | nowy) na kopii <w> + odcisk (do skanu)
  python3 skrypty/test_review_p12_cli.py reset <et> <w>             — kopia <w> z powrotem na bazie buildu (przed ponowną próbą buildu)
  python3 skrypty/test_review_p12_cli.py przed-buildem <et>         — zrzut bramek fazy w /tmp z poprzedniego buildu przeniesiony (domknięcie zapisuje go od nowa)
  python3 skrypty/test_review_p12_cli.py po-buildzie <et> <w>       — bramki z domknięcia → <w>-pliki/bramki.json, dossier z main, skrypt review z main
  python3 skrypty/test_review_p12_cli.py sedzia <et>                — implementacje A/B/C (stary, nowy, historyczny; permutacja z fazy) + skrypt sędziego
  python3 skrypty/test_review_p12_cli.py skan <et> <krok> <w>       — modele, przeciek, N1, stan kopii (kod 2 = STOP, 4 = przeciek)
  python3 skrypty/test_review_p12_cli.py wynik [<et> …]            — per faza i razem → dane/test-review/p12-wynik.{txt,json}"""
import glob, json, os, re, shutil, subprocess, sys, time

sys.dont_write_bytecode = True
import panel_koszt_dane as KD
import test_review_p12 as P
import test_review_p12_transkrypt as TT
import test_review_sesja as T
import test_review_skan as SK

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = os.path.abspath(os.path.join(BASE, '..', '..', '..'))
TR = P.TR
P12, P12K = os.path.join(TR, 'p12'), os.path.join(TR, 'p12-kopie')
OUT = os.path.join(BASE, 'dane', 'test-review')
REFY = {'stary': 'main', 'nowy': 'popr/P12-buildery'}
POMIN_W_SEDZIM = re.compile(r'^(docs/|\.claude/)|\.md$|(^|/)pnpm-lock\.yaml$|^supabase/migrations\.sum$')


def _json(p, dane=None):
    if dane is None:
        with open(p) as f: return json.load(f)
    with open(p, 'w') as f: json.dump(dane, f, ensure_ascii=False, indent=1)
    return dane


def _g(kopia, *a, check=True):
    return subprocess.run(['git', '-C', kopia, *a], capture_output=True, text=True, check=check).stdout


def faza(et):
    """Dane fazy z wyboru (dane/test-review/p12-fazy.json): baza buildu, sha, numer, zadanie, klucze z klasą i zakresem."""
    f = [x for x in _json(os.path.join(OUT, 'p12-fazy.json'))['fazy'] if x['et'] == et]
    if not f: raise SystemExit('STOP: %s spoza wyboru faz (test_review_p12_fazy.py)' % et)
    return dict(f[0], kopia_fazy=_json(os.path.join(TR, 'meta', et + '.json'))['kopia'])


def kopia(et, w):
    return os.path.join(P12K, et, w)


def pliki(et, w):
    return kopia(et, w) + '-pliki'


def claude():
    meta_p = os.path.join(P12, 'claude.json')
    sha = {w: _g(SZ, 'rev-parse', r + ':.claude').strip() for w, r in REFY.items()}
    if os.path.exists(meta_p):
        if _json(meta_p) != sha: raise SystemExit('STOP: drzewa .claude wariantów inne niż %s — test w toku używa %s' % (sha, _json(meta_p)))
        print('.claude wariantów już są: %s' % sha); return
    for w, s in sha.items():
        d = os.path.join(P12, 'claude-' + w); os.makedirs(d)
        arch = subprocess.run(['git', '-C', SZ, 'archive', '--prefix=.claude/', s], capture_output=True, check=True).stdout
        subprocess.run(['tar', '-x', '-C', d], input=arch, check=True)
    _json(meta_p, sha)
    print('.claude wariantów: %s' % sha)


def _buduj_biblioteki(cel, libs):
    for lib in libs:
        r = subprocess.run(['pnpm', '--dir', os.path.join(cel, lib), 'run', 'build'], capture_output=True, text=True)
        if r.returncode: raise SystemExit('STOP: build %s w %s: %s' % (lib, cel, (r.stdout + r.stderr)[-800:]))
    st = _g(cel, 'status', '--porcelain', '--untracked-files=all')
    if st: raise SystemExit('STOP: kopia %s brudna po buildzie bibliotek: %s' % (cel, st[:300]))


def przygotuj(et):
    f = faza(et)
    args = {'sciezka': 'docs/active/' + f['zadanie'], 'faza': f['faza']}
    os.makedirs(os.path.join(P12, et), exist_ok=True)
    stan = {'args': args, 'baza': f['baza'], 'sha': f['sha'], 'kopie': {}, 'kontrole': {}}
    for w in P.WARIANTY:
        if not os.path.exists(kopia(et, w)):
            info = P.kopia_bazy(f['kopia_fazy'], kopia(et, w), f['baza'], f['sha'])
            _buduj_biblioteki(kopia(et, w), info['biblioteki'])
            stan['kopie'][w] = info
        os.makedirs(pliki(et, w), exist_ok=True)
        with open(os.path.join(P12, 'claude-' + w, '.claude', 'workflows', 'dev-docs-execute-wf.js')) as fo: src = fo.read()
        js, k = P.wariant_build(src, args, w)
        if not k['przechodzi']: raise SystemExit('STOP: kontrola bajtowa wariantu %s: %s' % (w, k))
        with open(os.path.join(pliki(et, w), 'wariant-build.js'), 'w') as fo: fo.write(js)
        stan['kontrole'][w] = k
    _json(os.path.join(P12, et, 'przygotowanie.json'), stan)
    print('%s: faza %s, baza buildu %s, sha %s | kopie %s | warianty %s' % (et, f['faza'], f['baza'][:10], f['sha'][:10], ', '.join(
        '%s usunięte %d, biblioteki %s' % (w, len(i['usuniete']), i['biblioteki']) for w, i in stan['kopie'].items()) or 'już były',
        ', '.join('%s %s' % (w, k['zrodlo_sha']) for w, k in stan['kontrole'].items())))


def wycinki(et, w):
    """Blok, który planner wariantu doklei IU (polecenie z jego plannerPrompt), policzony skryptem wiedzy z .claude wariantu na kopii."""
    f = faza(et)
    zapob = '--zapobieganie' in open(os.path.join(P12, 'claude-' + w, '.claude', 'workflows', 'dev-docs-execute-wf.js')).read()
    for iu in f['iu']:
        cmd = ['node', '.claude/scripts/wiedza/wiedza.mjs', 'wycinek'] + (['--zapobieganie'] if zapob else []) + ['--pliki', ','.join(iu['pliki'])]
        r = subprocess.run(cmd, cwd=kopia(et, w), capture_output=True, text=True)
        try: o = json.loads(r.stdout)
        except ValueError: o = {'blad': (r.stderr or r.stdout)[-300:]}
        print('%s %s %s (%d plików): %s' % (w, iu['id'], iu['agentType'], len(iu['pliki']), json.dumps({k: v for k, v in o.items() if k != 'tresc'}, ensure_ascii=False)))
        for l in (o.get('tresc') or '').split('\n'): print('    ' + l[:160])


def nakladka(et, w, zrodlo):
    wynik = P.P11.nakladka(kopia(et, w), os.path.join(P12, 'claude-' + zrodlo))
    _json(os.path.join(P12, et, 'odcisk-%s.json' % w), {'zrodlo': zrodlo, 'odcisk': SK.odcisk(kopia(et, w))})
    print('%s %s: nakladka %s — agenci %d, ukryte zmiany %d, nowe %d' % (et, w, zrodlo, len(wynik['agenci']), wynik['ukryte_zmiany'], wynik['nowe']))


def reset(et, w):
    f, cel = faza(et), kopia(et, w)
    _g(cel, 'checkout', '-q', '-f', P.GALAZ)
    _g(cel, 'reset', '-q', '--hard', f['baza'])
    _g(cel, 'clean', '-q', '-fd')
    _buduj_biblioteki(cel, P.biblioteki(P.czysc_artefakty(cel)))
    print('%s %s: kopia na bazie %s' % (et, w, f['baza'][:10]))


def plik_bramek(et):
    f = faza(et)
    return '/tmp/bramki-%s-faza-%d.json' % (re.sub(r'^-+|-+$', '', re.sub(r'[^A-Za-z0-9]+', '-', 'docs/active/' + f['zadanie'])), f['faza'])


def przed_buildem(et):
    p = plik_bramek(et)
    if os.path.exists(p):
        cel = os.path.join(P12, et, 'bramki-poprzednie-%s.json' % time.strftime('%Y%m%d-%H%M%S'))
        shutil.move(p, cel); print('%s: %s przeniesiony do %s' % (et, p, cel))


def po_buildzie(et, w):
    f, cel, pl = faza(et), kopia(et, w), pliki(et, w)
    bramki = os.path.join(pl, 'bramki.json')
    if os.path.exists(plik_bramek(et)): shutil.move(plik_bramek(et), bramki)
    args = {'sciezka': 'docs/active/' + f['zadanie'], 'faza': f['faza'], 'srodowiskoE2E': 'pominieto', 'baza': f['baza']}
    cmd = ['node', os.path.join(P12, 'claude-stary', '.claude', 'scripts', 'dossier', 'dossier.mjs'), '--sciezka', args['sciezka'], '--faza',
           str(args['faza']), '--baza', f['baza'], '--projekt', cel, '--wyjscie', os.path.join(pl, 'tmp')] + (['--bramki', bramki] if os.path.exists(bramki) else [])
    os.makedirs(os.path.join(pl, 'tmp'), exist_ok=True)
    args['dossier'] = json.loads(subprocess.run(cmd, capture_output=True, text=True, check=True).stdout)
    with open(os.path.join(P12, 'claude-stary', '.claude', 'workflows', 'dev-docs-review-wf.js')) as fo: src = fo.read()
    js, k = P.wariant_review(src, args, w)
    if not k['przechodzi']: raise SystemExit('STOP: kontrola bajtowa review %s: %s' % (w, k))
    with open(os.path.join(pl, 'wariant-review.js'), 'w') as fo: fo.write(js)
    stan = {'head': _g(cel, 'rev-parse', 'HEAD').strip(), 'commity': _g(cel, 'log', '--oneline', '%s..HEAD' % f['baza']).splitlines(),
            'status': _g(cel, 'status', '--porcelain', '--untracked-files=all'), 'bramki': os.path.exists(bramki), 'kontrola_review': k}
    _json(os.path.join(P12, et, 'po-buildzie-%s.json' % w), stan)
    print('%s %s: HEAD %s, commity %d, status %d linii, bramki %s, dossier %s plików' % (et, w, stan['head'][:10], len(stan['commity']),
          len(stan['status'].splitlines()), 'tak' if stan['bramki'] else 'BRAK', len(args['dossier'].get('pliki') or [])))


def eksport(repo, od, do, cel):
    """Implementacja dla sędziego: zmiany.diff + pliki/ (pliki kodu zmienione od `od`; `do` = commit albo None = drzewo robocze z nieśledzonymi)."""
    spec = ['--', '.', ':!docs', ':!.claude']
    if do:
        nazwy = _g(repo, 'diff', '--name-only', '--diff-filter=ACMR', od, do, *spec).split()
        diff = _g(repo, 'diff', '-U5', od, do, *spec)
    else:
        nazwy = _g(repo, 'diff', '--name-only', '--diff-filter=ACMR', od, *spec).split()
        nowe = [p for p in _g(repo, 'ls-files', '--others', '--exclude-standard', *spec).split() if not POMIN_W_SEDZIM.search(p)]
        diff = _g(repo, 'diff', '-U5', od, *spec) + ''.join(
            subprocess.run(['git', '-C', repo, 'diff', '--no-index', '-U5', '/dev/null', p], capture_output=True, text=True).stdout for p in nowe)
        nazwy += nowe
    nazwy = [p for p in nazwy if not POMIN_W_SEDZIM.search(p)]
    for p in nazwy:
        dst = os.path.join(cel, 'pliki', p); os.makedirs(os.path.dirname(dst), exist_ok=True)
        if do:
            with open(dst, 'w') as fo: fo.write(_g(repo, 'show', '%s:%s' % (do, p)))
        else: shutil.copyfile(os.path.join(repo, p), dst)
    with open(os.path.join(cel, 'zmiany.diff'), 'w') as fo: fo.write(diff)
    return {'pliki': len(nazwy), 'linie_diff': diff.count('\n')}


def sedzia(et):
    f = faza(et)
    kat = P.katalog(et, 'p12-sedzia-p1', 'S')
    if os.path.exists(os.path.join(kat, 'A')): raise SystemExit('STOP: %s już ma implementacje — sędzia przygotowany' % kat)
    perm, info = P.permutacja(et), {}
    for e, v in perm.items():
        info[e] = eksport(f['kopia_fazy'], f['baza'], f['sha'], os.path.join(kat, e)) if v == 'historyczny' else eksport(kopia(et, v), f['baza'], None, os.path.join(kat, e))
    d10 = _json(os.path.join(OUT, 'p12-fazy.json'))['d10']
    grupa = lambda k: 'd10' if k in d10['zdania'] else 'pokryte' if k in d10['pokryte'] else 'inne'
    w_zakresie = {k['id']: k for k in f['klucz1'] + f['klucz2'] if k['w_zakresie']}
    klucze = [k for k in _json(os.path.join(TR, 'sedzia', et + '-klucze.json'))['klucze'] if k['id'] in w_zakresie]
    mapowanie = {'etykieta': et, 'warianty': perm, 'implementacje': info,
                 'K': {k['id']: {'zrodlo': k['zrodlo'], 'klasa': w_zakresie[k['id']]['klasa'], 'grupa': grupa(w_zakresie[k['id']]['klasa']), 'waga': k['waga']} for k in klucze}}
    _json(os.path.join(TR, 'sedzia', '%s-p12-p1-mapowanie.json' % et), mapowanie)
    with open(os.path.join(BASE, 'skrypty', 'test_review_p12_sedzia_szablon.js')) as fo: szablon = fo.read()
    dane = {'prompt': P.prompt_sedziego({'klucze': klucze}, kat), 'etykieta': 'sedzia:%s:p12-p1[high]' % et}
    js = szablon.replace('const DANE = __DANE__', 'const DANE = ' + json.dumps(dane, ensure_ascii=False)).replace('__NAZWA__', 'test-review-p12-sedzia-%s-p1' % et)
    with open(os.path.join(kat, 'sedzia-p1.js'), 'w') as fo: fo.write(js)
    print('%s: K %d (w zakresie), implementacje %s, prompt %d zn' % (et, len(klucze), ', '.join('%s %d plików/%d linii' % (e, i['pliki'], i['linie_diff'])
                                                                                          for e, i in sorted(info.items())), len(dane['prompt'])))


def _agenci(et, krok, w):
    kat, sid = os.path.join(T.PROJ, T.slug(T.katalog_kroku(et, krok, w))), T.id_sesji(et, krok, w)
    for rd in glob.glob(os.path.join(kat, sid, 'subagents', 'workflows', '*')):
        lab = SK.etykiety(rd)
        for jf in sorted(glob.glob(os.path.join(rd, 'agent-*.jsonl'))): yield lab.get(os.path.basename(jf)[6:-6], '?'), jf


def skan(et, krok, w):
    f = faza(et)
    kat = os.path.join(T.PROJ, T.slug(T.katalog_kroku(et, krok, w)))
    rp, sid = P.zakazane_re(et, krok, w), T.id_sesji(et, krok, w)
    stop, przeciek, uwagi = [], [], []
    inne = [n for n in SK.narzedzia_sesji(os.path.join(kat, sid + '.jsonl')) if n not in ('Workflow', 'ToolSearch')]
    if inne: stop.append('N1 sesja: %s' % inne)
    for e, jf in _agenci(et, krok, w):
        _, _, tw, uw = SK.agent(jf, rp, e, sid, kat)
        # build zapisuje w kopii z założenia — uwagi o Write/Edit i zapisach Bashem nie są zdarzeniem
        uwagi += ['%s: %s' % (e, u) for u in uw if krok != 'p12-build' or not re.match(r'(Write|Edit|NotebookEdit|MultiEdit) |zapis Bashem', u)]
        for k, v in tw.items():
            if v: (przeciek if k == 'przeciek' else stop).append('%s %s: %s' % (k.upper(), e, v[:2]))
    if krok in ('p12-build', 'p12-review'):
        cel = kopia(et, w)
        if subprocess.run(['git', '-C', cel, 'cat-file', '-e', f['sha']], capture_output=True).returncode == 0: stop.append('commit fazy osiągalny w kopii')
        if subprocess.run(['git', '-C', cel, 'merge-base', '--is-ancestor', f['baza'], 'HEAD']).returncode: stop.append('HEAD kopii nie wyrasta z bazy buildu')
        if SK.odcisk(cel) != _json(os.path.join(P12, et, 'odcisk-%s.json' % w))['odcisk']: stop.append('nakladka .claude/CLAUDE.md zmieniona w trakcie kroku')
        if krok == 'p12-review':
            pb = _json(os.path.join(P12, et, 'po-buildzie-%s.json' % w))
            if _g(cel, 'rev-parse', 'HEAD').strip() != pb['head']: stop.append('review zmienił HEAD kopii')
            if _g(cel, 'status', '--porcelain', '--untracked-files=all') != pb['status']: stop.append('review zmienił drzewo robocze kopii')
        else:
            st = _g(cel, 'status', '--porcelain', '--untracked-files=all')
            if st: uwagi.append('kopia po buildzie z nieskomitowanymi zmianami: ' + st[:200].replace('\n', '; '))
            if _g(cel, 'rev-parse', 'HEAD').strip() == f['baza']: uwagi.append('build bez commita (HEAD = baza)')
    print('skan %s %s %s: STOP %d, przeciek %d, uwagi %d' % (et, krok, w, len(stop), len(przeciek), len(uwagi)))
    for x in stop + przeciek + uwagi[:12]: print('  ' + x)
    return 2 if stop else 4 if przeciek else 0


def _structured(jf):
    so = None
    with open(jf, errors='ignore') as fo:
        for line in fo:
            if '"StructuredOutput"' not in line: continue
            try: o = json.loads(line)
            except ValueError: continue
            for b in (o.get('message') or {}).get('content') or []:
                if isinstance(b, dict) and b.get('name') == 'StructuredOutput': so = b.get('input')
    return so


def _rola(e):
    return e.split(':')[0] if e.startswith(('planner', 'domkniecie', 'build', 'sedzia')) else e


def _build(et, w):
    """Build wariantu: wynik execute, IU z plannera, koszt per rola, buildery (przestrzeganie, koszt, ctx_start)."""
    wyn = _json(os.path.join(TR, 'wyniki', et, 'p12-build-%s.json' % w))
    role, buildery, plan = {}, [], None
    for e, jf in _agenci(et, 'p12-build', w):
        s = KD.sklad(jf)
        if s: role[_rola(e)] = role.get(_rola(e), 0) + s['koszt'] / 1e6
        if e.startswith('planner'): plan = _structured(jf)
        if e.startswith('build:') and s:
            buildery.append(dict(TT.builder(jf), etykieta=e, koszt=round(s['koszt'] / 1e6, 3), ctx_start=s['ctx_start'], wywolania=s['wywolania']))
    return {'status': wyn.get('status'), 'problem': wyn.get('problem'), 'odchylenia': wyn.get('odchylenia') or [], 'ms': (wyn.get('_run') or {}).get('ms'),
            'iu': [{'id': x['id'], 'agentType': x['agentType']} for x in (plan or {}).get('iu') or []], 'strategia': (plan or {}).get('strategia'),
            'koszt_role': {k: round(v, 3) for k, v in sorted(role.items())}, 'koszt': round(sum(role.values()), 3), 'buildery': buildery,
            'przestrzeganie': TT.agregat(buildery)}


def _review(et, w, plik):
    fnd = (_json(plik).get('findings') or []) if os.path.exists(plik) else None
    if fnd is None: return None
    per_os = {}
    for x in fnd:
        t = per_os.setdefault(x.get('_zrodlo') or '?', {'razem': 0, 'p1p2': 0})
        t['razem'] += 1; t['p1p2'] += x.get('severity') in ('P1', 'P2')
    return {'razem': len(fnd), 'p1p2': sum(x.get('severity') in ('P1', 'P2') for x in fnd), 'p1': sum(x.get('severity') == 'P1' for x in fnd), 'osie': per_os}


def _koszt_kroku(et, krok, w):
    return round(sum(KD.sklad(jf)['koszt'] / 1e6 for _, jf in _agenci(et, krok, w) if KD.sklad(jf)), 3)


def wynik(ets):
    if not ets: ets = sorted(os.path.basename(p)[:-len('-p12-p1-mapowanie.json')] for p in glob.glob(os.path.join(TR, 'sedzia', '*-p12-p1-mapowanie.json'))
                             if os.path.exists(os.path.join(TR, 'wyniki', os.path.basename(p)[:-len('-p12-p1-mapowanie.json')], 'p12-sedzia-p1.json')))
    dane, L = {}, ['test_review_p12_cli.py wynik — ślepy test P12 (buildery stare = main, nowe = gałąź P12; review z main ucięty przed Verify; sędzia obecności defektu, '
                   'czułość = OBECNY na kodzie historycznym); koszt [M jedn.] bez sesji uruchamiających']
    for et in ets:
        mp = _json(os.path.join(TR, 'sedzia', '%s-p12-p1-mapowanie.json' % et))
        sed = P.wynik_sedziego(_json(os.path.join(TR, 'wyniki', et, 'p12-sedzia-p1.json')), mp)
        r = {'sedzia': sed, 'mapowanie': mp['warianty'], 'koszt_sedziego': _koszt_kroku(et, 'p12-sedzia-p1', 'S'), 'build': {}, 'review': {}, 'koszt_review': {},
             'review_historyczny_p11': _review(et, 'nowy', os.path.join(TR, 'wyniki', et, 'p11-nowy.json'))}
        L.append('== %s: K %d w zakresie (D10 %d, pokryte %d, inne %d); czułość sędziego na kodzie historycznym %s; sędzia %.2f M' % (
            et, len(mp['K']), *(sum(k['grupa'] == g for k in mp['K'].values()) for g in ('d10', 'pokryte', 'inne')), sed['czulosc_historycznego'], r['koszt_sedziego']))
        for w in P.WARIANTY_SEDZIEGO:
            s = sed[w]
            L.append('  %-11s razem O/Z/B %d/%d/%d | klucz2 %d/%d/%d | klucz1 %d/%d/%d | D10 %s | pokryte %s' % (w, *(s['razem'][o] for o in P.OCENY),
                     *(s['klucz2'][o] for o in P.OCENY), *(s['klucz1'][o] for o in P.OCENY),
                     '/'.join(str(s['grupy'].get('d10', {}).get(o, 0)) for o in P.OCENY), '/'.join(str(s['grupy'].get('pokryte', {}).get(o, 0)) for o in P.OCENY)))
        L.append('  pary (oba warianty mają kod): %s' % {k: v for k, v in sed['pary'].items()})
        for w in P.WARIANTY:
            b = r['build'][w] = _build(et, w)
            rv = r['review'][w] = _review(et, w, os.path.join(TR, 'wyniki', et, 'p12-review-%s.json' % w))
            r['koszt_review'][w] = _koszt_kroku(et, 'p12-review', w)
            pz = b['przestrzeganie']
            ctx = [x['ctx_start'] for x in b['buildery']]
            L.append('  %-5s build %s (%s), %s, IU %s | koszt %.2f M %s | buildery: ctx_start śr. %s, koszt śr. %s M | czas %s min' % (
                w, b['status'], (b['problem'] or '')[:80], b['strategia'], ' '.join('%s:%s' % (x['id'], x['agentType'].replace('feature-builder-', '')) for x in b['iu']),
                b['koszt'], b['koszt_role'], round(sum(ctx) / len(ctx)) if ctx else '—',
                round(sum(x['koszt'] for x in b['buildery']) / len(ctx), 3) if ctx else '—', round(b['ms'] / 60000, 1) if b['ms'] else '—'))
            L.append('        przestrzeganie (builderów z cechą / %d): %s | statusy %s | klasy D10 w promptach %s | resources %d odczytów, %d zn | odchylenia: %s' % (
                pz['builderow'], pz['z_cecha'], pz['statusy'], pz['klasy_d10'], pz['resources_odczyty'], pz['resources_zn'],
                [o[:90] for x in b['buildery'] for o in (x['wynik'] or {}).get('odchylenia') or []][:6]))
            L.append('        review z main: %s | koszt review %.2f M' % (('findingi %d, P1/P2 %d (P1 %d), osie %s' % (rv['razem'], rv['p1p2'], rv['p1'], rv['osie'])) if rv else 'brak',
                                                               r['koszt_review'][w]))
        if r['review_historyczny_p11']:
            h = r['review_historyczny_p11']
            L.append('  odniesienie: review main na kodzie historycznym (P11 „nowy”): findingi %d, P1/P2 %d (P1 %d)' % (h['razem'], h['p1p2'], h['p1']))
        dane[et] = r
    razem = {w: {o: sum(d['sedzia'][w]['razem'][o] for d in dane.values()) for o in P.OCENY} for w in P.WARIANTY_SEDZIEGO}
    L.append('== razem (%d faz): %s' % (len(dane), ' | '.join('%s O/Z/B %d/%d/%d' % (w, *(razem[w][o] for o in P.OCENY)) for w in P.WARIANTY_SEDZIEGO)))
    _json(os.path.join(OUT, 'p12-wynik.json'), {'fazy': dane, 'razem': razem})
    with open(os.path.join(OUT, 'p12-wynik.txt'), 'w') as fo: fo.write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: raise SystemExit(__doc__)
    k = {'claude': lambda: claude(), 'przygotuj': lambda: przygotuj(a[1]), 'wycinki': lambda: wycinki(a[1], a[2]), 'nakladka': lambda: nakladka(a[1], a[2], a[3]),
         'reset': lambda: reset(a[1], a[2]), 'przed-buildem': lambda: przed_buildem(a[1]), 'po-buildzie': lambda: po_buildzie(a[1], a[2]),
         'sedzia': lambda: sedzia(a[1]), 'skan': lambda: sys.exit(skan(a[1], a[2], a[3])), 'wynik': lambda: wynik(a[1:])}
    if a[0] not in k: raise SystemExit(__doc__)
    k[a[0]]()

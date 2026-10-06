#!/usr/bin/env python3
"""Ślepy test P11 — wejście-wyjście harnessu (logika z testami: test_review_p11.py). Zero agentów poza krokami, które uruchamia
test_review_p11.sh `faza` (sesje headless przez test_review_sesja.py).

Użycie (z katalogu analizy):
  python3 skrypty/test_review_p11_cli.py claude                       — git archive .claude z main (stary) i gałęzi P11 (nowy) → ~/test-review/p11/claude-<w>/
  python3 skrypty/test_review_p11_cli.py przygotuj <et>               — bramki (adapter) → dossier (dossier.mjs --baza --bramki z .claude nowego) →
                                                                      skrypty wariantów z kontrolą bajtową → ~/test-review/p11/<et>/
  python3 skrypty/test_review_p11_cli.py nakladka <et> <wariant>      — .claude wariantu na kopii + odcisk nakładki (do skanu)
  python3 skrypty/test_review_p11_cli.py pula <et> <perm>             — skrypt sędziego ~/test-review/p11/<et>/sedzia-p<perm>.js + mapowanie w ~/test-review/sedzia/
  python3 skrypty/test_review_p11_cli.py skan <et> <krok> <wariant>   — modele, przeciek, N1, kopia bez zmian (kod 2 = STOP, 4 = przeciek)
  python3 skrypty/test_review_p11_cli.py wynik [<et> …]              — per faza i po fazach (CI bootstrapem, klucz 2 i szum per oś, koszt);
                                                                      bez <et> = fazy z wyrokiem sędziego → dane/test-review/p11-wynik.{txt,json}"""
import glob, json, os, re, subprocess, sys

sys.dont_write_bytecode = True
import panel_koszt_dane as KD
import test_review_p11 as P
import test_review_p11_wynik as W
import test_review_sesja as T
import test_review_skan as SK

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = os.path.abspath(os.path.join(BASE, '..', '..', '..'))
TR, P11 = P.TR, P.P11
OUT = os.path.join(BASE, 'dane', 'test-review')
REFY = {'stary': 'main', 'nowy': 'popr/P11-reviewerzy'}
# fazy ślepego testu w kolejności wyniku (6a pkt 62; b26128d = pilot)
FAZY = ('f-b26128d', 'f-b8374c8', 'f-303ff62', 'f-1de5a4c', 'f-32975a1', 'f-2536643', 'f-46be55a')


def _json(p, dane=None):
    if dane is None:
        with open(p) as f: return json.load(f)
    with open(p, 'w') as f: json.dump(dane, f, ensure_ascii=False, indent=1)
    return dane


def claude():
    """Raz na test: .claude z drzew commitów (nie z drzewa roboczego). Ponowne wywołanie przy innym drzewie .claude odmawia — warianty faz muszą mieć to samo."""
    meta_p = os.path.join(P11, 'claude.json')
    # hash drzewa .claude, nie commitu: commity docs/reviews na gałęzi nie zmieniają wariantu
    sha = {w: subprocess.run(['git', '-C', SZ, 'rev-parse', r + ':.claude'], capture_output=True, text=True, check=True).stdout.strip() for w, r in REFY.items()}
    if os.path.exists(meta_p):
        if _json(meta_p) != sha: raise SystemExit('STOP: drzewa .claude wariantów inne niż %s — test w toku używa %s' % (sha, _json(meta_p)))
        print('.claude wariantów już są: %s' % sha); return
    for w, s in sha.items():
        d = os.path.join(P11, 'claude-' + w); os.makedirs(d)
        arch = subprocess.run(['git', '-C', SZ, 'archive', '--prefix=.claude/', s], capture_output=True, check=True).stdout
        subprocess.run(['tar', '-x', '-C', d], input=arch, check=True)
    _json(meta_p, sha)
    print('.claude wariantów: %s' % sha)


def parametry(et):
    meta = _json(os.path.join(TR, 'meta', et + '.json'))
    fz = [v for s, v in _json(os.path.join(BASE, 'dane', 'test-review-fazy.json'))['fazy'].items() if meta['sha'].startswith(s)][0]
    return meta, {'sciezka': 'docs/active/' + meta['zadanie'], 'faza': fz['numer'], 'srodowiskoE2E': 'pominieto', 'baza': fz['baza']}


def przygotuj(et):
    meta, args = parametry(et)
    d = os.path.join(P11, et); os.makedirs(os.path.join(d, 'tmp'), exist_ok=True)
    nowy = os.path.join(P11, 'claude-nowy')
    bramki = subprocess.run(['node', os.path.join(BASE, 'skrypty', 'test_review_p11_bramki.mjs'), '--kopia', meta['kopia'], '--baza', args['baza'],
                             '--wrzesien', os.path.join(OUT, 'bramki-%s.json' % et), '--claude', nowy, '--narzedzia', os.path.join(TR, '_narzedzia')],
                            capture_output=True, text=True, check=True).stdout
    with open(os.path.join(d, 'bramki.json'), 'w') as f: f.write(bramki)
    dossier = subprocess.run(['node', os.path.join(nowy, '.claude', 'scripts', 'dossier', 'dossier.mjs'), '--sciezka', args['sciezka'], '--faza',
                              str(args['faza']), '--baza', args['baza'], '--bramki', os.path.join(d, 'bramki.json'), '--projekt', meta['kopia'],
                              '--wyjscie', os.path.join(d, 'tmp')], capture_output=True, text=True, check=True).stdout
    args['dossier'] = json.loads(dossier)
    _json(os.path.join(d, 'args.json'), args)
    kontrole = {}
    for w in P.WARIANTY:
        with open(os.path.join(P11, 'claude-' + w, '.claude', 'workflows', 'dev-docs-review-wf.js')) as f: src = f.read()
        js, kontrole[w] = P.wariant(src, args, w)
        if not kontrole[w]['przechodzi']: raise SystemExit('STOP: kontrola bajtowa wariantu %s nie przechodzi: %s' % (w, kontrole[w]))
        with open(os.path.join(d, 'wariant-%s.js' % w), 'w') as f: f.write(js)
    _json(os.path.join(d, 'kontrola.json'), kontrole)
    b = json.loads(bramki)
    print('%s: faza %s, baza %s | bramki: %s | mutanty %d, ostrzezenia ESLint %d | dossier %s zn, plikow %d | warianty %s' % (
        et, args['faza'], args['baza'], ', '.join('%s %s' % (k, v['status']) for k, v in b.items()), len(b['stryker']['trafienia']),
        len(b['eslint'].get('ostrzezenia') or []), args['dossier'].get('ctxZnaki'), len(args['dossier']['pliki']),
        ', '.join('%s %s' % (w, k['zrodlo_sha']) for w, k in kontrole.items())))


def nakladka(et, w):
    kopia = _json(os.path.join(TR, 'meta', et + '.json'))['kopia']
    wynik = P.nakladka(kopia, os.path.join(P11, 'claude-' + w))
    _json(os.path.join(P11, et, 'odcisk.json'), {'wariant': w, 'odcisk': SK.odcisk(kopia)})
    print('%s: nakladka %s — agenci %d, ukryte zmiany %d, nowe %d' % (et, w, len(wynik['agenci']), wynik['ukryte_zmiany'], wynik['nowe']))


def pula(et, perm):
    klucze = _json(os.path.join(TR, 'sedzia', et + '-klucze.json'))
    wyniki = {w: _json(os.path.join(TR, 'wyniki', et, 'p11-%s.json' % w)).get('findings') or [] for w in P.WARIANTY}
    F, mapowanie, prompt = P.pula_sedziego(klucze, wyniki, et, perm)
    _json(os.path.join(TR, 'sedzia', '%s-p11-p%s-mapowanie.json' % (et, perm)), mapowanie)
    with open(os.path.join(BASE, 'skrypty', 'test_review_sedzia_szablon.js')) as f: szablon = f.read()
    dane = {'prompt': prompt, 'etykieta': 'sedzia:%s:p11-p%s[medium]' % (et, perm)}
    js = szablon.replace('const DANE = __DANE__', 'const DANE = ' + json.dumps(dane, ensure_ascii=False)).replace('__NAZWA__', 'test-review-p11-sedzia-%s-p%s' % (et, perm))
    if len(js.encode()) > 512 * 1024: raise SystemExit('STOP: skrypt sędziego > 512 KB')
    with open(os.path.join(P11, et, 'sedzia-p%s.js' % perm), 'w') as f: f.write(js)
    print('%s p%s: K %d, F %d (%s), prompt %d zn' % (et, perm, len(klucze['klucze']), len(F), ', '.join('%s %d' % (w, len(v)) for w, v in wyniki.items()), len(prompt)))


def skan(et, krok, w):
    """Sesja jednego kroku: twarde zatrzymania jak TEST-REVIEW-PLAN §11 (skan wrześniowy) + kopia: HEAD, git status, odcisk ostatniej nakładki."""
    meta = _json(os.path.join(TR, 'meta', et + '.json'))
    kat = os.path.join(T.PROJ, T.slug(meta['kopia']))
    rp = re.compile(SK.zakazane_re(et).pattern + r'|test-review/p11/(?!%s/)' % re.escape(et))
    sid = T.id_sesji(et, krok, w)
    stop, przeciek, uwagi = [], [], []
    inne = [n for n in SK.narzedzia_sesji(os.path.join(kat, sid + '.jsonl')) if n not in ('Workflow', 'ToolSearch')]
    if inne: stop.append('N1 sesja: %s' % inne)
    for rd in glob.glob(os.path.join(kat, sid, 'subagents', 'workflows', '*')):
        lab = SK.etykiety(rd)
        for jf in glob.glob(os.path.join(rd, 'agent-*.jsonl')):
            e = lab.get(os.path.basename(jf)[6:-6], '?')
            _, _, tw, uw = SK.agent(jf, rp, e, sid, kat)
            uwagi += ['%s: %s' % (e, u) for u in uw]
            for k, v in tw.items():
                if v: (przeciek if k == 'przeciek' else stop).append('%s %s: %s' % (k.upper(), e, v[:2]))
    head = SK.git(meta['kopia'], 'rev-parse', 'HEAD').strip()
    if not head.startswith(meta['sha'][:10]): stop.append('HEAD %s ≠ sha fazy' % head[:10])
    st = SK.git(meta['kopia'], 'status', '--porcelain', '--untracked-files=all').strip()
    if st: stop.append('git status kopii: ' + st[:300].replace('\n', '; '))
    if SK.odcisk(meta['kopia']) != _json(os.path.join(P11, et, 'odcisk.json'))['odcisk']: stop.append('nakladka .claude/CLAUDE.md zmieniona w trakcie kroku')
    print('skan %s %s %s: STOP %d, przeciek %d, uwagi %d' % (et, krok, w, len(stop), len(przeciek), len(uwagi)))
    for x in stop + przeciek + uwagi[:10]: print('  ' + x)
    return 2 if stop else 4 if przeciek else 0


def koszt(et, krok, w):
    """Koszt kroku zmierzony z transkryptów (cennik d4r, ostatni usage per message.id): sesja uruchamiająca osobno, agenci per etykieta."""
    meta = _json(os.path.join(TR, 'meta', et + '.json'))
    kat, sid = os.path.join(T.PROJ, T.slug(meta['kopia'])), T.id_sesji(et, krok, w)
    s = KD.sklad(os.path.join(kat, sid + '.jsonl'))
    role = {}
    for rd in glob.glob(os.path.join(kat, sid, 'subagents', 'workflows', '*')):
        lab = SK.etykiety(rd)
        for jf in glob.glob(os.path.join(rd, 'agent-*.jsonl')):
            a = KD.sklad(jf)
            if a: e = lab.get(os.path.basename(jf)[6:-6], '?'); role[e] = role.get(e, 0) + a['koszt'] / 1e6
    return {'sesja': (s['koszt'] / 1e6) if s else 0.0, 'agenci': round(sum(role.values()), 3), 'role': {k: round(v, 3) for k, v in sorted(role.items())}}


def _ci(r):
    return '—' if r is None else '%+.1f pkt [%+.1f; %+.1f]' % (r['roznica'], r['ci95'][0], r['ci95'][1])


def _po_fazach(dane):
    fazy = {et: r['zlapania'] for et, r in dane.items()}
    p = W.podsumowanie(fazy)
    p['koszt'] = W.koszt(fazy, {et: r['koszt'] for et, r in dane.items()})
    p['szum_mutantow'] = {w: sum(r['szum_mutantow'][w] for r in dane.values()) for w in P.WARIANTY}
    L = ['== po fazach (%d): %s; CI 95%% bootstrap po fazach, %d losowan, ziarno %d' % (len(dane), ' '.join(dane), W.N_BOOT, W.ZIARNO_BOOT)]
    for k in W.KLUCZE:
        L.append('  %s: %s | nowy − stary szeroko %s, PEŁNE %s' % (k, ' / '.join('%s %d/%d (PEŁNE %d)' % (w, p['sumy'][w][k]['szeroko'], p['sumy'][w][k]['obecne'],
                 p['sumy'][w][k]['pelne']) for w in P.WARIANTY), _ci(p['roznice'][k]['szeroko']), _ci(p['roznice'][k]['pelne'])))
    L.append('  klucz2 per os (os wariantu, ktora zlapala): klucze osi | stary | nowy | strata realna | przeniesione na inna os | zysk realny | nowy − stary')
    for o, t in p['klucz2_osie'].items():
        L.append('    %-16s %3d | %3d | %3d | %3d | %3d | %3d | %s' % (o, t['klucze'], t['stary'], t['nowy'], t['strata_realna'], t['przeniesione'],
                 t['zysk_realny'], _ci(t['roznica'])))
    L.append('  szum poza kluczem (razem/P1+P2) per os:')
    for w in P.WARIANTY:
        L.append('    %-5s %s | z mutantow (test-coverage P1/P2) %d' % (w, ', '.join('%s %d/%d' % (o, t['poza_kluczem'], t['p1p2'])
                 for o, t in p['szum_osie'][w].items()), p['szum_mutantow'][w]))
    k = p['koszt']
    for w in P.WARIANTY:
        L.append('  koszt %-5s znajdowanie %.2f M, na zlapany klucz %s | osie: %s' % (w, k[w]['znajdowanie'], ('%.3f M' % k[w]['na_zlapany_klucz'])
                 if k[w]['na_zlapany_klucz'] else '—', ', '.join('%s %.2f' % (o, m) for o, m in k[w]['osie'].items())))
    L.append('  koszt znajdowania nowy vs stary: %+.1f%%' % k['zmiana_procent'])
    return p, L


def wynik(ets):
    if not ets: ets = [et for et in FAZY if os.path.exists(os.path.join(TR, 'wyniki', et, 'p11-sedzia-p1.json'))]
    dane, L = {}, ['test_review_p11_cli.py wynik — slepy test P11, sedzia p1; szeroko = PEŁNE + CZĘŚCIOWE; koszt zmierzony [M jedn.] bez sesji uruchamiajacej']
    for et in ets:
        sed = _json(os.path.join(TR, 'wyniki', et, 'p11-sedzia-p1.json'))
        mp = _json(os.path.join(TR, 'sedzia', '%s-p11-p1-mapowanie.json' % et))
        z = P.zlapania(sed, mp)
        wyniki = {w: _json(os.path.join(TR, 'wyniki', et, 'p11-%s.json' % w)).get('findings') or [] for w in P.WARIANTY}
        r = {'zlapania': z, 'koszt': {w: koszt(et, 'p11', w) for w in P.WARIANTY}, 'koszt_sedziego': koszt(et, 'p11-sedzia-p1', 'S'), 'findingi': {},
             'szum_mutantow': W.szum_mutantow(sed, mp, wyniki)}
        L.append('== %s' % et)
        for w in P.WARIANTY:
            per_os = {}
            for f in wyniki[w]:
                t = per_os.setdefault(f.get('_zrodlo') or '?', {'razem': 0, 'p1p2': 0})
                t['razem'] += 1; t['p1p2'] += f.get('severity') in ('P1', 'P2')
            r['findingi'][w] = per_os
            k1, k2, kw = z[w]['klucz1'], z[w]['klucz2'], r['koszt'][w]['agenci']
            zl = k1['szeroko'] + k2['szeroko']
            L.append('  %-5s klucz1 %d/%d (PEŁNE %d) | klucz2 %d/%d (PEŁNE %d) | szum %d (P1/P2 %d, z mutantow %d) | koszt %.2f M, na zlapany klucz %s' % (
                w, k1['szeroko'], k1['obecne'], k1['pelne'], k2['szeroko'], k2['obecne'], k2['pelne'], z[w]['szum']['poza_kluczem'],
                z[w]['szum']['p1p2'], r['szum_mutantow'][w], kw, ('%.2f M' % (kw / zl)) if zl else '—'))
            L.append('        findingi per os (razem/P1+P2): %s' % ', '.join('%s %d/%d' % (o, v['razem'], v['p1p2']) for o, v in sorted(per_os.items())))
            L.append('        osie, ktore zlapaly: klucz1 %s | klucz2 %s' % (z[w]['osie_klucz1'], z[w]['osie_klucz2']))
        for k in ('klucz1', 'klucz2'): L.append('  pary %s: %s' % (k, {p: v for p, v in z['pary'][k].items()}))
        L.append('  sedzia %.2f M' % r['koszt_sedziego']['agenci'])
        dane[et] = r
    p, Lp = _po_fazach(dane)
    _json(os.path.join(OUT, 'p11-wynik.json'), {'fazy': dane, 'po_fazach': p})
    with open(os.path.join(OUT, 'p11-wynik.txt'), 'w') as f: f.write('\n'.join(L + Lp) + '\n')
    print('\n'.join(L + Lp))

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: raise SystemExit(__doc__)
    if a[0] == 'claude': claude()
    elif a[0] == 'przygotuj': przygotuj(a[1])
    elif a[0] == 'nakladka': nakladka(a[1], a[2])
    elif a[0] == 'pula': pula(a[1], a[2])
    elif a[0] == 'skan': sys.exit(skan(a[1], a[2], a[3]))
    elif a[0] == 'wynik': wynik(a[1:])
    else: raise SystemExit(__doc__)

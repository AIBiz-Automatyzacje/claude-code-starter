#!/usr/bin/env python3
"""Ślepy test P11 (PLAN-POPRAWY §3 P11, HANDOFF 6a pkt 62) — stare vs nowe pliki reviewerów na tej samej kopii fazy.

Warianty: „stary” = .claude z main (pliki reviewerów sprzed P11), „nowy” = .claude z gałęzi P11. Każdy = dev-docs-review-wf.js
SWOJEGO .claude ucięty przed Verify (findingi po dedupie), z args wklejonymi w skrypt (dossier ze skryptu dossier.mjs --baza, ten sam
plik dla obu). Sędzia ocenia oba warianty w jednym przebiegu: pula F z neutralnymi id w kolejności losowej (ziarno: faza, permutacja).

Logika z testami (test_review_p11_test.py); wejście-wyjście i komendy: test_review_p11_cli.py, przebieg fazy: test_review_p11.sh."""
import hashlib, json, os, re, subprocess

TR = os.path.expanduser('~/test-review')
P11 = os.path.join(TR, 'p11')
WARIANTY = ('stary', 'nowy')
VERIFY = "\nphase('Verify')\n"
DEKLARACJA_TESTERA = 'function trybTesteraE2e(warstwy, e2eLiczbaZnana, e2eCheckboxy, figmaScreens, srodowiskoE2E) {\n'
# Środowisko przeglądarkowe dla stanu historycznego nie istnieje — tester E2E wyłączony w obu wariantach (TEST-REVIEW-PLAN §3 pkt 4).
WYLACZ_TESTERA = "  return 'pominiety' // TEST REVIEW P11: tester E2E wylaczony w obu wariantach (brak srodowiska stanu historycznego)\n"


def sha(t):
    return hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]


def kolejnosc(et):
    """Kolejność wariantów w fazie (sesje idą po kolei na jednej kopii): z hasha fazy, żeby w 7 fazach żaden wariant nie startował zawsze pierwszy."""
    return sorted(WARIANTY, key=lambda w: sha('%s:%s' % (et, w)))


def _meta(nazwa):
    return ("export const meta = {\n  name: 'test-review-p11-%s',\n  description: 'Slepy test P11: dev-docs-review-wf.js wariantu %s uciety przed Verify "
            "(findingi po dedupie), args wklejone, tester E2E wylaczony',\n  phases: [{ title: 'Review', detail: 'reviewerzy wg routingu + dedup' }],\n}\n"
            % (nazwa, nazwa))


ZWROT = ("// TEST REVIEW P11: zwrot przed Verify — findingi po dedupie (to, co poszloby do sceptykow i do limitu P3)\n"
         "return { findings: dedup, przebieg: { aktywni: aktywni.map((r) => r.key), pominieci, plikiKodu, zrodloDossier, poDedupJs,\n"
         "  poDedupSem: dedup.length, nulle: wyniki.map((w, i) => (w ? null : etykietyZrodel[i])).filter(Boolean) } }\n")


def wariant(src, args, nazwa):
    """Skrypt wariantu: meta testu + args wklejone (sesja przepisująca kilka KB JSON-u myli nawiasy) + ciało workflowu do Verify w funkcji
    z parametrem `args`, BEZ ZMIAN poza wyłączeniem testera E2E. Zwraca (js, kontrola)."""
    if src.count(VERIFY) != 1: raise ValueError("workflow bez jednej linii phase('Verify') — źródło do przeglądu")
    if src.count(DEKLARACJA_TESTERA) != 1: raise ValueError('workflow bez deklaracji trybTesteraE2e — źródło do przeglądu')
    i_meta = src.index('\n}\n') + 3
    cialo = src[i_meta:src.index(VERIFY) + 1]
    cialo_testu = cialo.replace(DEKLARACJA_TESTERA, DEKLARACJA_TESTERA + WYLACZ_TESTERA)
    js = (_meta(nazwa) + '// TEST REVIEW P11: args wklejone w skrypt — ten sam obiekt (dossier, baza, faza) dla obu wariantow\n'
          + 'const ARGS_TESTU = ' + json.dumps(args, ensure_ascii=False) + '\n'
          + 'const wynikTestu = await (async (args) => {\n' + cialo_testu + ZWROT + '})(ARGS_TESTU)\nreturn wynikTestu\n')
    odtworzone = js.split('const wynikTestu = await (async (args) => {\n', 1)[1].split(ZWROT, 1)[0]
    roznice = [l for l in odtworzone.splitlines() if l not in set(cialo.splitlines())]
    return js, {'zrodlo_sha': sha(src), 'cialo_sha': sha(cialo), 'roznice': [l.strip() for l in roznice],
                'przechodzi': odtworzone.replace(WYLACZ_TESTERA, '', 1) == cialo and len(roznice) == 1}


# Pliki .claude z epoki fazy, których nakładka nie rusza: wiedza projektu z tamtej chwili (nowsza opisuje właśnie te defekty, TEST-REVIEW-PLAN §3)
# i ustawienia lokalne (sesje testu dostają własne przez --settings).
ZOSTAJA_Z_EPOKI = ('rules/learned-patterns.md', 'settings.local.json', '.DS_Store')


def _git(k, *a):
    return subprocess.run(['git', '-C', k, *a], capture_output=True, text=True, check=True).stdout


def nakladka(kopia, zrodlo):
    """.claude kopii = dokładnie .claude z `zrodlo` (poza ZOSTAJA_Z_EPOKI). Różnice wobec epoki ukryte przed gitem: zmienione i usunięte pliki
    śledzone — skip-worktree, nowe — .git/info/exclude; `git status` i diff fazy widziane przez reviewerów zostają diffem fazy."""
    if not os.path.isdir(os.path.join(zrodlo, '.claude')): raise FileNotFoundError('brak %s/.claude' % zrodlo)
    sledzone = [p for p in _git(kopia, 'ls-files', '-z', '--', '.claude').split('\0') if p]
    if sledzone: subprocess.run(['git', '-C', kopia, 'update-index', '--no-skip-worktree', '--stdin'], input='\n'.join(sledzone), text=True, check=True)
    subprocess.run(['rsync', '-a', '--checksum', '--delete', *sum((['--exclude', w] for w in ZOSTAJA_Z_EPOKI), []),
                    os.path.join(zrodlo, '.claude') + '/', os.path.join(kopia, '.claude') + '/'], check=True)
    rozne = [p for p in _git(kopia, 'ls-files', '-z', '-m', '-d', '--', '.claude').split('\0') if p]
    if rozne: subprocess.run(['git', '-C', kopia, 'update-index', '--skip-worktree', '--stdin'], input='\n'.join(sorted(set(rozne))), text=True, check=True)
    nowe = [p for p in _git(kopia, 'ls-files', '-z', '--others', '--exclude-standard', '--', '.claude').split('\0') if p]
    wykluczenia = os.path.join(kopia, '.git', 'info', 'exclude')
    if nowe:
        os.makedirs(os.path.dirname(wykluczenia), exist_ok=True)
        with open(wykluczenia, 'a') as f: f.write(''.join('/%s\n' % p for p in nowe))
    status = _git(kopia, 'status', '--porcelain')
    if status: raise RuntimeError('kopia brudna po nakładce:\n' + status[:2000])
    agenci = sorted(os.listdir(os.path.join(kopia, '.claude', 'agents'))) if os.path.isdir(os.path.join(kopia, '.claude', 'agents')) else []
    return {'zrodlo': zrodlo, 'ukryte_zmiany': len(set(rozne)), 'nowe': len(nowe), 'agenci': agenci}


def _plik_i_linia(f):
    plik, linia = str(f.get('plik') or '?'), f.get('linia')
    m = re.search(r':(\d+)(?:-\d+)?$', plik)
    if linia is None and m: plik, linia = plik[:m.start()], int(m.group(1))
    return plik, linia


def pula_sedziego(klucze, wyniki, et, perm):
    """Pula F obu wariantów dla sędziego (prompt skalibrowany we wrześniu, test_review_sedzia.prompt_sedziego — 0/20 błędów): sędzia widzi
    plik, linię, wagę, opis i scenariusz; wariant, oś i indeks są tylko w mapowaniu. Kolejność losowa z ziarnem (faza, permutacja)."""
    import random
    import test_review_sedzia as S
    brak = [w for w in WARIANTY if w not in wyniki]
    if brak: raise ValueError('brak wyniku wariantu: %s' % ', '.join(brak))
    pozycje = []
    for w in WARIANTY:
        for i, f in enumerate(wyniki[w]):
            plik, linia = _plik_i_linia(f)
            widoczne = {'plik': plik, 'linia': linia, 'waga': f.get('severity') or f.get('waga'), 'opis': (f.get('opis') or '')[:1500],
                        'scenariusz': (f.get('scenariusz') or '')[:600]}
            pozycje.append((widoczne, {'wariant': w, 'indeks': i, 'os': f.get('_zrodlo'), 'plik': plik, 'linia': linia, 'waga': widoczne['waga']}))
    random.Random(int(hashlib.sha256(('p11:pula:%s:%s' % (et, perm)).encode()).hexdigest()[:8], 16)).shuffle(pozycje)
    F = [dict(widoczne, id='F%d' % (n + 1)) for n, (widoczne, _) in enumerate(pozycje)]
    mapowanie = {'etykieta': et, 'permutacja': perm, 'F': {'F%d' % (n + 1): mp for n, (_, mp) in enumerate(pozycje)},
                 'K': {x['id']: {'zrodlo': x['zrodlo'], 'przypadek': x['przypadek'], 'waga': x['waga'], 'os': x.get('os')} for x in klucze['klucze']}}
    return F, mapowanie, S.prompt_sedziego(klucze, F)


def zlapania(sedzia, mapowanie):
    """Złapania per wariant po wyroku sędziego (definicje jak TEST-REVIEW-WYNIK: tylko K obecne = TAK; „szeroko” = PEŁNE + CZĘŚCIOWE, miara główna),
    osobno klucz 1 (zysk) i klucz 2 (strata); osie wariantu, które złapały klucz (sumy i per klucz — do strat per oś po fazach); pary do odczytu
    strat; szum = F bez dopasowania POZA_KLUCZEM, razem i per oś."""
    z = {w: {'klucz1': {'obecne': 0, 'pelne': 0, 'szeroko': 0}, 'klucz2': {'obecne': 0, 'pelne': 0, 'szeroko': 0},
             'osie_klucz1': {}, 'osie_klucz2': {}, 'szum': {'poza_kluczem': 0, 'p1p2': 0}, 'szum_osie': {}} for w in WARIANTY}
    z['pary'] = {k: {'tylko_stary': [], 'tylko_nowy': [], 'oba': []} for k in ('klucz1', 'klucz2')}
    z['klucze'] = {}
    for k in sedzia['klucze']:
        zr = mapowanie['K'][k['id']]['zrodlo']
        if k['obecny'] != 'TAK': continue
        lapie = {}
        for d in k['dopasowania']:
            f = mapowanie['F'][d['f']]
            lapie.setdefault(f['wariant'], {'pelne': False, 'osie': set()})
            lapie[f['wariant']]['pelne'] |= d['ocena'] == 'PEŁNE'
            lapie[f['wariant']]['osie'].add(f.get('os') or '?')
        for w in WARIANTY:
            t = z[w][zr]
            t['obecne'] += 1
            if w not in lapie: continue
            t['szeroko'] += 1; t['pelne'] += lapie[w]['pelne']
            for o in lapie[w]['osie']: z[w]['osie_' + zr][o] = z[w]['osie_' + zr].get(o, 0) + 1
        z['klucze'][k['id']] = dict(zrodlo=zr, **{w: sorted(lapie[w]['osie']) if w in lapie else None for w in WARIANTY})
        para = 'oba' if len(lapie) == 2 else ('tylko_' + next(iter(lapie))) if lapie else None
        if para: z['pary'][zr][para].append(k['id'])
    for b in sedzia.get('bez_dopasowania', []):
        if b['kategoria'] != 'POZA_KLUCZEM': continue
        f = mapowanie['F'][b['f']]
        for t in (z[f['wariant']]['szum'], z[f['wariant']]['szum_osie'].setdefault(f.get('os') or '?', {'poza_kluczem': 0, 'p1p2': 0})):
            t['poza_kluczem'] += 1
            t['p1p2'] += f.get('waga') in ('P1', 'P2')
    return z


if __name__ == '__main__':
    raise SystemExit(__doc__)

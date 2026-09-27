#!/usr/bin/env python3
"""Test review — kalibracja sędziego etapu głównego (TEST-REVIEW-PLAN §5.2, próg 15%). Moduł skryptu test_review_analiza.py (polecenie `probka`
i część `kalibracja` wyniku); metoda jak test_review_pilot.probka, ale tylko NOWE jednostki etapu (bez pilota) i inne ziarno."""
import hashlib, json, os, random, sys

sys.dont_write_bytecode = True
import test_review_pilot as P

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dane', 'test-review')
PROBKA_NA_TYP = 10
PROG_KALIBRACJI = 15.0          # plan §5.2 / §11


def jednostki():
    return json.load(open(os.path.join(OUT, 'etap.json')))


def probka():
    """Jak test_review_pilot.probka, ale z nowych jednostek etapu i z innym ziarnem."""
    rnd = random.Random(int(hashlib.sha256(b'etap-kalibracja').hexdigest()[:8], 16))
    dop, brak = [], []
    for u in jednostki():
        if u['z_pilota']: continue
        et = u['et']
        kl, s, m = P.wczytaj(et, '1')
        gdzie = {b['f']: 'bez dopasowania: %s' % b['kategoria'] for b in s.get('bez_dopasowania', [])}
        for k in s['klucze']:
            for d in k.get('dopasowania') or []: gdzie[d['f']] = 'dopasowany do %s (%s)' % (k['id'], d.get('ocena'))
        for k in s['klucze']:
            K = kl[k['id']]
            for d in k.get('dopasowania') or []:
                dop.append({'et': et, 'K': k['id'], 'F': d['f'], 'ocena': d.get('ocena'), 'uzasadnienie': d.get('uzasadnienie')})
            if k.get('obecny') != 'TAK': continue
            moje = {d['f'] for d in k.get('dopasowania') or []}
            kand = sorted((abs((mf['linia'] or 0) - (K['linia'] or 0)), int(fid[1:]), fid) for fid, mf in m['F'].items()
                          if mf['plik'].lstrip('./') == str(K['plik']).lstrip('./') and fid not in moje)
            if kand: brak.append({'et': et, 'K': k['id'], 'F': kand[0][2], 'ocena': 'BRAK', 'odleglosc_linii': kand[0][0],
                                  'gdzie_sedzia_go_dal': gdzie.get(kand[0][2], '?')})
    wybor = rnd.sample(dop, PROBKA_NA_TYP) + rnd.sample(brak, PROBKA_NA_TYP)
    L = []
    for nr, x in enumerate(wybor, 1):
        kl, _, m = P.wczytaj(x['et'], '1')
        K, mf = kl[x['K']], m['F'][x['F']]
        x.update({'nr': nr, 'klucz': {c: K.get(c) for c in ('zrodlo', 'przypadek', 'waga', 'os', 'plik', 'linia', 'streszczenie')} | {
                      'tresc': (K.get('tresc') or '')[:900], 'wycinek': K.get('wycinek')},
                  'finding': {'wlasciciele': mf['wlasciciele'], 'rodzaj': mf['rodzaj'], 'plik': mf['plik'], 'linia': mf['linia'], 'waga': mf['waga']}
                  | P.tekst_findingu(x['et'], mf)})
        L += ['#%d %s %s×%s — sędzia: %s' % (nr, x['et'], x['K'], x['F'], x['ocena']),
              '  KLUCZ %s %s %s:%s — %s' % (K['przypadek'], K.get('waga'), K['plik'], K['linia'], K.get('streszczenie')),
              '  treść: ' + x['klucz']['tresc'].replace('\n', ' '),
              '  FINDING %s %s %s:%s — %s' % (''.join(mf['wlasciciele']), mf['waga'], mf['plik'], mf['linia'], x['finding']['opis'].replace('\n', ' ')),
              '  scenariusz: ' + x['finding']['scenariusz'].replace('\n', ' '),
              '  sędzia: ' + (x.get('uzasadnienie') or x.get('gdzie_sedzia_go_dal', '')) + ('' if 'odleglosc_linii' not in x else ' | odległość linii %d' % x['odleglosc_linii']), '']
    json.dump(wybor, open(os.path.join(OUT, 'wynik-kalibracja-probka.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, 'wynik-kalibracja-probka.txt'), 'w').write('\n'.join(L))
    print('próbka: %d z %d dopasowań, %d z %d par BRAK → wynik-kalibracja-probka.txt' % (PROBKA_NA_TYP, len(dop), PROBKA_NA_TYP, len(brak)))


def kalibracja():
    plik = os.path.join(OUT, 'wynik-kalibracja-oceny.json')
    if not os.path.exists(plik): return {'stan': 'brak ocen — najpierw wynik-kalibracja-oceny.json'}
    pr = {x['nr']: x for x in json.load(open(os.path.join(OUT, 'wynik-kalibracja-probka.json')))}
    oc = json.load(open(plik))
    zle = [o for o in oc if not o['zgodne']]
    typ = lambda o: 'BRAK' if pr[o['nr']]['ocena'] == 'BRAK' else 'PEŁNE/CZĘŚCIOWE'
    return {'decyzji': len(oc), 'niezgodnych': len(zle), 'procent_bledow': round(100 * len(zle) / len(oc), 1), 'prog': PROG_KALIBRACJI,
            'w_progu': 100 * len(zle) / len(oc) <= PROG_KALIBRACJI, 'wg_typu': {t: sum(1 for o in zle if typ(o) == t) for t in ('PEŁNE/CZĘŚCIOWE', 'BRAK')},
            'szara_strefa': [o['nr'] for o in oc if o.get('szara_strefa')], 'niezgodne': zle}

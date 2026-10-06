#!/usr/bin/env python3
"""Ślepy test P11 — wynik po fazach (PLAN-POPRAWY §3 P11: brak istotnej straty na kluczu 2 per oś, koszt znajdowania nie wyższy niż stary).

Wejście: złapania faz z test_review_p11.zlapania (+ koszt z test_review_p11_cli.koszt). Sumy po fazach, różnice nowy − stary z CI 95%
bootstrapem po fazach (losowanie faz ze zwracaniem, percentyle, ziarno stałe — metoda jak test_review_analiza.bootstrap), klucz 2 per oś,
szum P1/P2 per oś, koszt znajdowania i na złapany klucz. Testy: test_review_p11_test.py."""
import random
import re

import test_review_p11 as P

KLUCZE = ('klucz1', 'klucz2')
MIARY = ('obecne', 'pelne', 'szeroko')
N_BOOT = 10000
ZIARNO_BOOT = 20261006
ID_MUTANTA = re.compile(r'\bM\d+\b')


def sumy(fazy):
    """Złapania per wariant i klucz zsumowane po fazach."""
    return {w: {k: {m: sum(z[w][k][m] for z in fazy.values()) for m in MIARY} for k in KLUCZE} for w in P.WARIANTY}


def roznica(jednostki):
    """Różnica nowy − stary w pkt % łącznej liczby kluczy + CI 95% (percentyle 2,5–97,5) z losowania faz ze zwracaniem.
    jednostki = [(obecne, stary, nowy)] per faza; bez kluczy = None."""
    n = sum(u[0] for u in jednostki)
    if not n: return None
    rnd, roz = random.Random(ZIARNO_BOOT), []
    for _ in range(N_BOOT):
        s = [jednostki[rnd.randrange(len(jednostki))] for _ in jednostki]
        ns = sum(u[0] for u in s)
        if ns: roz.append(100 * (sum(u[2] for u in s) - sum(u[1] for u in s)) / ns)
    roz.sort()
    return {'roznica': round(100 * (sum(u[2] for u in jednostki) - sum(u[1] for u in jednostki)) / n, 1),
            'ci95': [round(roz[int(0.025 * len(roz))], 1), round(roz[int(0.975 * len(roz)) - 1], 1)], 'fazy': len(jednostki)}


def klucz2_osie(fazy):
    """Klucz 2 per oś: klucz należy do osi X, gdy złapała go oś X któregokolwiek wariantu. stary/nowy = klucze złapane przez oś X wariantu;
    strata realna = oś X starego łapie, nowy nie łapie wcale; przeniesione = nowy łapie inną osią; zysk realny = oś X nowego łapie, stary wcale."""
    osie = sorted({o for z in fazy.values() for k in z['klucze'].values() if k['zrodlo'] == 'klucz2' for w in P.WARIANTY for o in k[w] or []})
    wynik = {}
    for o in osie:
        t = dict.fromkeys(('klucze', 'stary', 'nowy', 'strata_realna', 'przeniesione', 'zysk_realny'), 0)
        jednostki = []
        for z in fazy.values():
            u = [0, 0, 0]
            for k in z['klucze'].values():
                s, n = k['stary'] or [], k['nowy'] or []
                if k['zrodlo'] != 'klucz2' or o not in s + n: continue
                u[0] += 1; u[1] += o in s; u[2] += o in n
                t['strata_realna'] += o in s and k['nowy'] is None
                t['przeniesione'] += o in s and bool(n) and o not in n
                t['zysk_realny'] += o in n and k['stary'] is None
            t['klucze'] += u[0]; t['stary'] += u[1]; t['nowy'] += u[2]
            jednostki.append(tuple(u))
        wynik[o] = dict(t, roznica=roznica(jednostki))
    return wynik


def szum_osie(fazy):
    """Szum (F bez dopasowania POZA_KLUCZEM) per wariant i oś, zsumowany po fazach."""
    wynik = {w: {} for w in P.WARIANTY}
    for z in fazy.values():
        for w in P.WARIANTY:
            for o, t in z[w]['szum_osie'].items():
                d = wynik[w].setdefault(o, {'poza_kluczem': 0, 'p1p2': 0})
                d['poza_kluczem'] += t['poza_kluczem']; d['p1p2'] += t['p1p2']
    return {w: dict(sorted(v.items())) for w, v in wynik.items()}


def szum_mutantow(sedzia, mapowanie, wyniki):
    """Szum P1/P2 osi test-coverage, który powołuje się na mutanta (id M<n> w opisie) — reguła „mutant = P2 TEST” (6a pkt 63 c)."""
    wynik = dict.fromkeys(P.WARIANTY, 0)
    for b in sedzia.get('bez_dopasowania', []):
        f = mapowanie['F'][b['f']]
        if b['kategoria'] != 'POZA_KLUCZEM' or f.get('os') != 'test-coverage' or f.get('waga') not in ('P1', 'P2'): continue
        wynik[f['wariant']] += bool(ID_MUTANTA.search(wyniki[f['wariant']][f['indeks']].get('opis') or ''))
    return wynik


def koszt(fazy, koszty):
    """Koszt znajdowania = agenci wariantu (reviewerzy + dedup) zsumowani po fazach, per oś (role review:<oś>) i na złapany klucz (1 + 2, szeroko);
    zmiana nowy vs stary w %. koszty = {faza: {wariant: wynik test_review_p11_cli.koszt}}."""
    s = sumy(fazy)
    wynik = {}
    for w in P.WARIANTY:
        osie = {}
        for et in fazy:
            for rola, m in koszty[et][w]['role'].items():
                if rola.startswith('review:'): osie[rola[7:]] = osie.get(rola[7:], 0) + m
        razem = sum(koszty[et][w]['agenci'] for et in fazy)
        zlapane = s[w]['klucz1']['szeroko'] + s[w]['klucz2']['szeroko']
        wynik[w] = {'znajdowanie': round(razem, 3), 'osie': {o: round(m, 3) for o, m in sorted(osie.items())},
                    'na_zlapany_klucz': round(razem / zlapane, 3) if zlapane else None}
    st, nw = wynik['stary']['znajdowanie'], wynik['nowy']['znajdowanie']
    wynik['zmiana_procent'] = round(100 * (nw - st) / st, 1) if st else None
    return wynik


def podsumowanie(fazy):
    """Sumy, różnice nowy − stary na kluczach 1 i 2 (szeroko i PEŁNE) z CI po fazach, klucz 2 per oś, szum per oś."""
    roznice = {k: {m: roznica([(z['stary'][k]['obecne'], z['stary'][k][m], z['nowy'][k][m]) for z in fazy.values()]) for m in ('szeroko', 'pelne')}
               for k in KLUCZE}
    return {'sumy': sumy(fazy), 'roznice': roznice, 'klucz2_osie': klucz2_osie(fazy), 'szum_osie': szum_osie(fazy)}

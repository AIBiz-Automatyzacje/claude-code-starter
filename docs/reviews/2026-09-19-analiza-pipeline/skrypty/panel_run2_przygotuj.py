"""Panel decyzyjny, run 2 (sędzia) — przygotowanie skryptu Workflow z danymi wklejonymi do promptów.

Wejście: dane/panel-zestaw-historyczny.jsonl (195 B), dane/panel-run1-projekty.json (katalogi A/B/C),
dane/panel-katalog-projekt0.json (katalog projektu 0).
Wyjście: skrypty/panel-run2.js (skrypt Workflow; dane jako stała DANE, bo skrypt workflowu nie czyta plików),
mapowanie etykiet P/Q/R/S -> projekt w pliku podanym jako argv[1] (poza docs/reviews do końca runu — zaślepienie),
dane/panel-run2-porcje.txt (skład porcji, rozmiary promptów).

Porcje (PANEL-PLAN §5, z odstępstwem: S1 correctness 77 dzielone na dwie porcje po PR, żeby wynik jednego agenta
nie przekraczał ~160 ocen; permutacja pełna 4x4 — każdy projekt raz na każdej pozycji etykiety).
Identyfikatory mechanizmów zastępowane neutralnymi (<etykieta><nr>), pole klasy_docelowe usuwane (deklaracja autora,
nie tekst mechanizmu — sędzia ocenia brzmienie).
"""
import json
import re
import sys
from pathlib import Path

BAZA = Path(__file__).resolve().parent.parent
ZESTAW = BAZA / 'dane' / 'panel-zestaw-historyczny.jsonl'
RUN1 = BAZA / 'dane' / 'panel-run1-projekty.json'
P0 = BAZA / 'dane' / 'panel-katalog-projekt0.json'
SZABLON = BAZA / 'skrypty' / 'panel_run2_szablon.js'
WYJ_JS = BAZA / 'skrypty' / 'panel-run2.js'
WYJ_TXT = BAZA / 'dane' / 'panel-run2-porcje.txt'

ETYKIETY = ['P', 'Q', 'R', 'S']
# neutralne klucze katalogów w skrypcie (projekt -> klucz; mapowanie tylko w pliku mapowania)
KLUCZE = {'B': 'k1', '0': 'k2', 'C': 'k3', 'A': 'k4'}
# kolejność projektów przypisanych do P,Q,R,S w porcji i (rotacja: każdy projekt raz na każdej pozycji)
ROTACJE = [['A', 'B', 'C', '0'], ['B', 'C', '0', 'A'], ['C', '0', 'A', 'B'], ['0', 'A', 'B', 'C']]
PORCJE_OSI = [
    ('S1a', ['correctness'], 'pierwsza połowa'),
    ('S1b', ['correctness'], 'druga połowa'),
    ('S2', ['test-coverage', 'code-quality', 'e2e', 'domkniecie/kontrola-fixa'], None),
    ('S3', ['security', 'spec', 'performance'], None),
]


def oczysc_bota(t):
    if not t:
        return None
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'✅ Addressed in commit \w+', '', t)
    t = re.sub(r'\n{3,}', '\n\n', t).strip()
    return t[:900]


def przypadek(x):
    return {
        'id': x['id'], 'pr': x['pr'], 'plik': x['plik'], 'klasa': x['klasa'], 'waga': x['waga'],
        'streszczenie': x['streszczenie'], 'tresc_bota': oczysc_bota(x['tresc_bota']),
        'tresc_dopasowanie': x['tresc_dopasowanie'], 'compound': x['compound'],
    }


def katalog_neutralny(kat, etykieta):
    wynik, mapa = [], {}
    for i, m in enumerate(kat, 1):
        nid = etykieta + str(i).zfill(2)
        mapa[nid] = m['id']
        wynik.append({'id': nid, 'typ': m['typ'], 'rola': m['rola'], 'etap': m['etap'],
                      'warunek': m['warunek'], 'brzmienie': m['brzmienie']})
    return wynik, mapa


def main():
    mapowanie_plik = Path(sys.argv[1])
    zestaw = [json.loads(l) for l in ZESTAW.open()]
    run1 = json.loads(RUN1.read_text())
    katalogi = {'A': run1['A']['katalog'], 'B': run1['B']['katalog'], 'C': run1['C']['katalog'],
                '0': json.loads(P0.read_text())['katalog']}

    kor = sorted([x for x in zestaw if x['os_wlasciciel'] == 'correctness'], key=lambda x: (x['pr'], x['id']))
    pol = (len(kor) + 1) // 2
    porcje, mapowanie, txt = [], {}, []
    for i, (nazwa, osie, czesc) in enumerate(PORCJE_OSI):
        if czesc == 'pierwsza połowa':
            przyp = kor[:pol]
        elif czesc == 'druga połowa':
            przyp = kor[pol:]
        else:
            przyp = [x for x in zestaw if x['os_wlasciciel'] in osie]
        kolumny, mapa_porcji = {}, {}
        for et, proj in zip(ETYKIETY, ROTACJE[i]):
            kat, mapa_id = katalog_neutralny(katalogi[proj], et)
            kolumny[et] = kat
            mapa_porcji[et] = {'projekt': proj, 'klucz': KLUCZE[proj], 'id': mapa_id}
        porcje.append({'nazwa': nazwa, 'przypadki': [przypadek(x) for x in przyp],
                       'kolejnosc': [KLUCZE[proj] for proj in ROTACJE[i]]})
        mapowanie[nazwa] = mapa_porcji
        zn_przyp = len(json.dumps([przypadek(x) for x in przyp], ensure_ascii=False))
        zn_kat = len(json.dumps(kolumny, ensure_ascii=False))
        txt.append(f'{nazwa}: przypadkow {len(przyp)} (P1/P2 {sum(1 for x in przyp if x["waga"] in ("P1", "P2"))}), '
                   f'osie {"+".join(osie)}, etykiety ' + ', '.join(f'{e}={p}' for e, p in zip(ETYKIETY, ROTACJE[i])) +
                   f' [mapowanie tylko w pliku mapowania]; znaki przypadkow {zn_przyp}, katalogow {zn_kat}')
    assert sum(len(p['przypadki']) for p in porcje) == len(zestaw) == 195
    assert len({x['id'] for p in porcje for x in p['przypadki']}) == 195

    szablon = SZABLON.read_text()
    kat_js = {KLUCZE[p]: [{'typ': m['typ'], 'rola': m['rola'], 'etap': m['etap'], 'warunek': m['warunek'],
                           'brzmienie': m['brzmienie']} for m in katalogi[p]] for p in katalogi}
    dane = {'katalogi': kat_js, 'porcje': porcje}
    js = szablon.replace('/*__DANE__*/null', json.dumps(dane, ensure_ascii=False))
    WYJ_JS.write_text(js)
    mapowanie_plik.write_text(json.dumps(mapowanie, ensure_ascii=False, indent=1))
    txt = [l.split(', etykiety')[0] + l[l.index(';'):] for l in txt]  # etykiet nie ujawniamy w dane/ przed runem
    WYJ_TXT.write_text('panel_run2_przygotuj.py — porcje run 2\n' + '\n'.join(txt) +
                       f'\nskrypt: {WYJ_JS.name}, {len(js)} znakow, {len(js.encode())} bajtow\n')
    print('\n'.join(txt))
    print('skrypt', len(js), len(js.encode()))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Test review — mechanizmy za liczbami analizy (moduł skryptu test_review_analiza.py): wkład Strykera (D5) i to, który dzisiejszy reviewer
(pole _zrodlo findingu wariantu 0) dał trafienia, które A/B/C gubią. Wejście: wiersze kluczy z test_review_analiza.wiersze()."""
import collections, json, os, re, sys

sys.dont_write_bytecode = True
import test_review_pilot as P

TR = os.path.expanduser('~/test-review')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dane', 'test-review')
WARIANTY = '0ABC'
NOWE = 'ABC'
RE_MUTANT = re.compile(r'mutant|stryker|przeży', re.I)


def obecne_fazy(R, zrodlo):
    return [r for r in R if r['obecny'] == 'TAK' and r['czesc'] == 'fazy' and r['zrodlo'] == zrodlo]


def stan_strykera(et):
    bramki = json.load(open(os.path.join(OUT, 'bramki-%s.json' % et)))['bramki']
    wyniki = (bramki.get('stryker') or {}).get('wyniki') or {}
    sek = sum(v.get('sekundy') or 0 for v in wyniki.values())
    return {'aplikacje': {a: str(v.get('status'))[:12] for a, v in wyniki.items()} or (bramki.get('stryker') or {}).get('status'),
            'sekundy_strykera': round(sek), 'sekundy_bramek_razem': round(sek + sum(b.get('sekundy') or 0 for n, b in bramki.items() if n != 'stryker'))}


def stryker(R, ets):
    """D5: klucze klucza 1 w fazach z rodziny test-niefalsyfikowalny — złapane i złapane findingiem, który powołuje się na przeżyty mutant
    (lista mutantów była wejściem reviewera testów A/B/C, 0 jej nie ma); stan i czas Strykera per faza."""
    powolane = collections.defaultdict(set)
    for et in ets:
        kl, sed, mp = P.wczytaj(et, '1')
        for k in sed['klucze']:
            for d in k.get('dopasowania') or []:
                f = mp['F'].get(d['f'])
                if f and f['rodzaj'] == 'agent' and RE_MUTANT.search(P.tekst_findingu(et, f)['opis']):
                    powolane[(et, kl[k['id']]['przypadek'])].add(f['wlasciciele'][0])
    rs = [r for r in obecne_fazy(R, 'klucz1') if r['rodzina'] == 'test-niefalsyfikowalny']
    return {'stan_strykera': {et: stan_strykera(et) for et in ets}, 'n': len(rs),
            **{w: {'zlapane': sum(r['sz_' + w] for r in rs), 'przez_mutanta': sum(w in powolane[(r['et'], r['przypadek'])] for r in rs if r['sz_' + w])}
               for w in WARIANTY}}


def zrodla_0(ets):
    """{(et, przypadek): reviewerzy wariantu 0 (pole _zrodlo findingu), których findingi sędzia dopasował do klucza}."""
    out = {}
    for et in ets:
        kl, sed, mp = P.wczytaj(et, '1')
        fs = json.load(open(os.path.join(TR, 'wyniki', et, 'wariant0.json')))['findings']
        for k in sed['klucze']:
            for d in k.get('dopasowania') or []:
                f = mp['F'].get(d['f'])
                if f and f['rodzaj'] == 'agent' and f['wlasciciele'] == ['0']:
                    out.setdefault((et, kl[k['id']]['przypadek']), set()).add(str(fs[f['indeks']].get('_zrodlo')))
    return out


def zrodla_0_podsumowanie(R, k2, zr):
    """Ile trafień wariantu 0 (klucz 1 i 2, fazy) dał każdy dzisiejszy reviewer i ile z trafień klucza 2 gubionych przez A/B/C."""
    licz = lambda rs: dict(sorted(collections.Counter(z for r in rs for z in zr.get((r['et'], r['przypadek']), [])).items()))
    return {'klucz1': licz([r for r in obecne_fazy(R, 'klucz1') if r['sz_0']]), 'klucz2': licz([r for r in obecne_fazy(R, 'klucz2') if r['sz_0']]),
            **{'klucz2_gubi_' + w: dict(sorted(collections.Counter(z for x in k2 if w in x['gubi'] for z in x['zrodlo_0']).items())) for w in NOWE}}


def kontrola_fixa_dzis(R, ets_fix):
    """D12: z czego składa się dzisiejsza kontrola fixa (źródło/wzorzec findingów wariantu 0) i przy ilu kluczach klucza 1 miała finding w tym samym pliku."""
    zrodla, w_pliku = collections.Counter(), 0
    for et in ets_fix:
        _, _, mp = P.wczytaj(et, '1')
        fs = json.load(open(os.path.join(TR, 'wyniki', et, 'wariant0.json')))['findings']
        zrodla.update('%s/%s' % (f.get('zrodlo'), f.get('wzorzec') or '-') for f in fs)
        pliki0 = {str(f['plik']).split(':')[0].lstrip('./') for f in mp['F'].values() if f['wlasciciele'] == ['0']}
        w_pliku += sum(str(r['plik']).lstrip('./') in pliki0 for r in R if r['et'] == et and r['obecny'] == 'TAK' and r['zrodlo'] == 'klucz1')
    return {'findingi_wg_zrodla': dict(sorted(zrodla.items())), 'klucze_z_findingiem_0_w_tym_samym_pliku': w_pliku}


def mutanty_w_promptach(ets):
    """D5: w ilu promptach faz każdy wariant A/B/C dostał listę przeżytych mutantów (linie z regułą stryker/*) i ile linii łącznie."""
    out = {}
    for w in NOWE:
        linie = [sum('stryker/' in l for l in open(os.path.join(TR, 'prompty', '%s-%s.txt' % (et, w)), errors='ignore')) for et in ets]
        out[w] = {'faz_z_lista': sum(n > 0 for n in linie), 'faz': len(ets), 'linii': sum(linie)}
    return out

#!/usr/bin/env python3
"""Plan testu review (HANDOFF 6a pkt 28) — koszt przed startem, wybór faz, moc statystyczna. Zero agentów.

Wejście: dane/test-review-fazy.json (test_review_fazy.py), dane/panel-koszt-referencja.json (949 agentów oferty-online od 09-06),
dane/panel-run1-projekty.json (role_koszt projektów A/B/C), panel_koszt_model.Referencja (współczynnik „po zmianie kontekstu”).

Koszt roli w fazie = a + b × pliki_kodu (regresja liniowa na 29 wykonaniach faz z danych referencyjnych, kontekst dzisiejszy, jednostki
cennika d4r). Zakres testu = etap znajdowania: wariant 0 = dzisiejszy dev-docs-review-wf ucięty przed weryfikacją (packager, reviewerzy
wg WARUNKI, dedup; bez testera E2E, sceptyków i scribe'a); warianty A/B/C = role review z role_koszt[] projektu (wywołania, mnożnik tur,
warunek, efort) + agregacja. Sceptycy każdego wariantu tylko na findingach dopasowanych do klucza (górna granica: połowa przypadków fazy,
jednostka verify-batch; P1 × liczba sceptyków projektu). Sędzia dopasowania: 1 wywołanie na fazę = reviewer correctness (widełki ×0,6–1,5).
Efort: widełki ±20% pracy reviewerów.
Wyjście: dane/test-review-plan.{txt,json}.
"""
import collections
import json
import math
import os
import shutil
import statistics as st
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, 'skrypty'))
from panel_koszt_model import Referencja  # noqa: E402

FAZY = os.path.join(BASE, 'dane', 'test-review-fazy.json')
REF = os.path.join(BASE, 'dane', 'panel-koszt-referencja.json')
PROJ = os.path.join(BASE, 'dane', 'panel-run1-projekty.json')
OUT_TXT = os.path.join(BASE, 'dane', 'test-review-plan.txt')
OUT_JSON = os.path.join(BASE, 'dane', 'test-review-plan.json')
K2_PLIK = os.path.join(BASE, 'dane', 'test-review-klucz2.json')   # test_review_klucz2.py (uruchomić przed tym skryptem)
K2 = {}

ROLE_REVIEW = ('review:correctness', 'review:security', 'review:test-coverage', 'review:spec-compliance', 'review:code-quality',
               'review:performance', 'kontekst:diff', 'dedup:semantyczny', 'verify', 'verify-batch', 'scribe', 'fix:kontrola')
FINDINGI_NA_FAZE = 26.7          # panel-koszt.txt §1 (średnia faz referencyjnych, reviewerzy przed dedupem)
EFORT = {'high': 1.2, 'medium': 1.0, 'low': 0.8}   # widełki pracy wg PANEL-PLAN §3 (±20%); dzisiejszy efort sesji = 1,0
# efort reviewerów wariantu 0 = efort sesji uruchamiającej (TIERY_DOMYSLNE.reviewer = null); operator 2026-09-25: sesje na high i medium
# -> test na high (konserwatywnie: dzisiejszy wariant w najlepszym realnym ustawieniu), do potwierdzenia przed pilotem
EFORT_WARIANT0 = 'high'
LIMIT_MNOZNIK = 1.5              # twardy limit = 1,5 × górna granica (jak PANEL-PLAN §10)


def dopasowania():
    """Regresja kosztu roli [M jedn.] na liczbie plików kodu fazy + współczynnik po zmianie kontekstu z panel_koszt_model."""
    d = json.load(open(REF))
    fz = {(f['run'], f['faza']): f for f in d['fazy']}
    by = collections.defaultdict(list)
    for a in d['agenci']:
        f = fz.get((a['run'], a['faza']))
        if f and a['rola'] in ROLE_REVIEW:
            by[a['rola']].append((f['pliki_kodu'], a['koszt'] / 1e6))
    ref = Referencja()
    fit = {}
    for r, xs in by.items():
        n = [x[0] for x in xs]; k = [x[1] for x in xs]
        mx, my = st.mean(n), st.mean(k)
        b = sum((a - mx) * (c - my) for a, c in zip(n, k)) / max(1e-9, sum((a - mx) ** 2 for a in n))
        try:
            wsp = ref.jednostka(r, kontekst='po') / ref.jednostka(r, kontekst='dzis')
        except KeyError:
            wsp = 0.5
        fit[r] = {'a': my - b * mx, 'b': b, 'n': len(xs), 'mediana': st.median(k), 'po_zmianie': wsp}
    fit['review:simplicity'] = fit['review:code-quality']
    return fit


def koszt_roli(fit, analog, kod, mn=1.0, kontekst='dzis'):
    f = fit[analog]
    k = max(f['mediana'] * 0.3, f['a'] + f['b'] * kod) * mn
    return k * (f['po_zmianie'] if kontekst == 'po' else 1.0)


def warianty(proj):
    """Lista (rola, analog, wywołania_na_fazę | ('per_finding', x), mnożnik_tur, efort, warunek) per wariant — tylko etap review."""
    w = {'0': [('kontekst:diff', 'kontekst:diff', 1, 1, 'medium', 'zawsze'),
               ('correctness', 'review:correctness', 1, 1, EFORT_WARIANT0, 'faza_z_kodem'),
               ('security', 'review:security', 1, 1, EFORT_WARIANT0, 'zawsze'),
               ('test-coverage', 'review:test-coverage', 1, 1, EFORT_WARIANT0, 'zawsze'),
               ('spec-compliance', 'review:spec-compliance', 1, 1, EFORT_WARIANT0, 'zawsze'),
               ('code-quality', 'review:code-quality', 1, 1, EFORT_WARIANT0, 'faza_z_kodem'),
               ('performance', 'review:performance', 1, 1, EFORT_WARIANT0, 'kod_ge_5'),
               ('dedup', 'dedup:semantyczny', 1, 1, 'medium', 'zawsze')]}
    for k in 'ABC':
        role = []
        for r in proj[k]['role_koszt']:
            an = r['analog']
            if not (an.startswith('review:') or an in ('kontekst:diff', 'dedup:semantyczny')):
                continue
            if an == 'review:e2e' or not r['wywolania']:
                continue
            wyw = ('per_finding', r['wywolania']) if r['per'] == 'finding' else r['wywolania'] * (r['czestosc'] if r.get('czestosc') and r['czestosc'] < 1 and r['warunek'] == 'faza_z_kodem' else 1)
            role.append((r['rola'], an, wyw, r.get('mnoznik_tur') or 1, (r.get('effort') or 'medium').split()[0], r['warunek']))
        w[k] = role
    return w


def koszt_fazy(fit, role, kod, kontekst='dzis', efort_skala=0.0):
    """Koszt etapu review wariantu w fazie o `kod` plikach kodu. efort_skala: -1 = dolne widełki, +1 = górne."""
    s = 0.0
    for _, an, wyw, mn, ef, war in role:
        if war == 'kod_ge_5' and kod < 5:
            continue
        n = FINDINGI_NA_FAZE * wyw[1] if isinstance(wyw, tuple) else wyw
        e = EFORT.get(ef, 1.0) * ((1 + 0.2 * efort_skala) if an.startswith('review:') else 1)
        s += n * koszt_roli(fit, an, kod, mn * e, kontekst)
    return s


def moc(n_przyp, r=1, p0=0.2, p1=0.4, rozrzut=0.15):
    """Połowa szerokości 95% CI różnicy odsetków złapanych (warianty sparowane po przypadku, niezależne przebiegi):
    wariancja wewnątrz przypadku (Bernoulli, dzielona przez r powtórek) + między przypadkami (rozrzut prawdziwej różnicy)."""
    wew = (p0 * (1 - p0) + p1 * (1 - p1)) / r
    var = (wew + rozrzut ** 2) / n_przyp
    se = math.sqrt(var)
    return 1.96 * se, 2.8 * se


def main():
    dane = json.load(open(FAZY))
    proj = json.load(open(PROJ))
    fit = dopasowania()
    W = warianty(proj)
    global K2
    K2 = json.load(open(K2_PLIK)) if os.path.exists(K2_PLIK) else {}
    przyp = {p['id']: p for p in dane['przypadki']}
    fazy = []
    for k, f in dane['fazy'].items():
        pp = [przyp[i] for i in f['przypadki']]
        kod = f['pliki_kodu']
        kz = {v: {'dzis': koszt_fazy(fit, W[v], kod), 'po': koszt_fazy(fit, W[v], kod, 'po'),
                  'dzis_max': koszt_fazy(fit, W[v], kod, efort_skala=1), 'po_min': koszt_fazy(fit, W[v], kod, 'po', -1)} for v in W}
        # sceptycy na dopasowanych: górna granica połowa przypadków fazy × (verify-batch; P1 wariantów A/B × 3 sceptyków)
        dop = 0.5 * len(pp) * koszt_roli(fit, 'verify-batch', kod) + 0.5 * sum(p['waga'] == 'P1' for p in pp) * 2 * koszt_roli(fit, 'verify', kod)
        for v in kz:
            for kk in kz[v]:
                kz[v][kk] += dop * (fit['verify-batch']['po_zmianie'] if kk.startswith('po') else 1.0)
        sedzia = koszt_roli(fit, 'review:correctness', kod)
        fazy.append({'faza': k, 'pr': f['pr'], 'numer': f['numer'], 'kod': kod, 'linie': f['linie_diff'], 'przypadki': len(pp),
                     'p12': sum(p['waga'] in ('P1', 'P2') for p in pp), 'ogon': sum(p['ogon'] for p in pp),
                     'wrzesien': sum(p['epoka'] == 'wrzesien' for p in pp), 'osie': dict(collections.Counter(p['os'] for p in pp)),
                     'koszt': kz, 'sedzia': sedzia, 'ids': f['przypadki']})

    def suma(fs, klucz):
        return sum(sum(f['koszt'][v][klucz] for v in W) for f in fs) + sum(f['sedzia'] for f in fs) * (1.5 if klucz.endswith('max') else 0.6 if klucz.endswith('min') else 1.0)

    # wybór: pełny / zachłanny po (przypadki P1/P2 + 0,5 × P3) na koszt, z minimum po osiach
    for f in fazy:
        f['wart'] = (f['p12'] + 0.5 * (f['przypadki'] - f['p12'])) / (sum(f['koszt'][v]['dzis'] for v in W) + f['sedzia'])
    kolej = sorted(fazy, key=lambda f: -f['wart'])
    o = ['test_review_plan.py — koszt, wybór faz i moc testu review (zero agentów; jednostki cennika d4r, M = mln)\n']
    o.append('=== 1. Koszt roli [M jedn.] = a + b × pliki_kodu (29 wykonań faz, kontekst dziś) i współczynnik po zmianie kontekstu ===')
    for r in ROLE_REVIEW:
        if r in fit:
            f = fit[r]
            o.append('  {:24s} n={:3d} a={:.2f} b={:.3f} mediana={:.2f} po_zmianie×{:.2f}'.format(r, f['n'], f['a'], f['b'], f['mediana'], f['po_zmianie']))
    o.append('\n=== 2. Etap review na fazę o medianie plików kodu (kontekst dziś / po zmianie kontekstu) ===')
    kod_med = st.median(f['kod'] for f in fazy)
    for v in W:
        o.append('  wariant {}: {:.2f} / {:.2f} M (faza {} plików kodu); role: {}'.format(
            v, koszt_fazy(fit, W[v], kod_med), koszt_fazy(fit, W[v], kod_med, 'po'), kod_med,
            ', '.join('{}×{}'.format(r[0].split(' (')[0], r[2] if not isinstance(r[2], tuple) else 'finding·' + str(r[2][1])) for r in W[v])))
    o.append('  sędzia dopasowania (1 na fazę): {:.2f} M (widełki ×0,6–1,5)'.format(koszt_roli(fit, 'review:correctness', kod_med)))

    o.append('\n=== 3. Fazy w kolejności wartości (przypadki P1/P2 + ½ P3 na M jedn. całego testu fazy) ===')
    cum = collections.Counter()
    wiersze = []
    for i, f in enumerate(kolej, 1):
        cum['przyp'] += f['przypadki']; cum['p12'] += f['p12']; cum['ogon'] += f['ogon']; cum['wrz'] += f['wrzesien']
        cum['koszt'] += sum(f['koszt'][v]['dzis'] for v in W) + f['sedzia']
        cum['koszt_po'] += sum(f['koszt'][v]['po'] for v in W) + f['sedzia'] * W_PO
        wiersze.append(dict(cum, n=i))
        o.append('  {:2d}. {} PR{} f{} kod {:2d} | przyp {} (P1/P2 {}, ogon {}, wrz {}) {} | test fazy {:.1f} M (po zm. {:.1f}) | narast.: przyp {} P1/P2 {} ogon {} wrz {} koszt {:.0f} M (po zm. {:.0f})'.format(
            i, f['faza'], f['pr'], f['numer'], f['kod'], f['przypadki'], f['p12'], f['ogon'], f['wrzesien'], f['osie'],
            sum(f['koszt'][v]['dzis'] for v in W) + f['sedzia'], sum(f['koszt'][v]['po'] for v in W) + f['sedzia'] * W_PO,
            cum['przyp'], cum['p12'], cum['ogon'], cum['wrz'], cum['koszt'], cum['koszt_po']))

    o.append('\n=== 4. Warianty zakresu (koszt całego testu: 4 warianty review + sędzia; widełki: po zmianie kontekstu i efort −20% .. dziś i efort +20%) ===')
    wyn_zakresy = {}
    for nazwa, n in (('pełny', len(kolej)), ('75% przypadków', None), ('50% przypadków', None)):
        if n is None:
            cel = sum(f['przypadki'] for f in fazy) * (0.75 if nazwa.startswith('75') else 0.5)
            n = next(w['n'] for w in wiersze if w['przyp'] >= cel)
        fs = kolej[:n]
        osie = collections.Counter()
        for f in fs:
            osie.update(f['osie'])
        dol, sr, gora = suma(fs, 'po_min'), suma(fs, 'dzis'), suma(fs, 'dzis_max')
        wyn_zakresy[nazwa] = {'fazy': n, 'przypadki': sum(f['przypadki'] for f in fs), 'p12': sum(f['p12'] for f in fs),
                              'ogon': sum(f['ogon'] for f in fs), 'wrzesien': sum(f['wrzesien'] for f in fs), 'osie': dict(osie),
                              'koszt_dol': dol, 'koszt_sr': sr, 'koszt_gora': gora, 'limit': gora * LIMIT_MNOZNIK,
                              'per_wariant_sr': {v: sum(f['koszt'][v]['dzis'] for f in fs) for v in W}}
        z = wyn_zakresy[nazwa]
        z['klucz2'] = sum(len(K2.get(f['faza'], {}).get('p12', [])) for f in fs)
        o.append('  {}: faz {}, par (przypadek, faza) {} (P1/P2 {}, ogon {}, wrzesień {}), klucz 2 (znane trafienia) {}, osie {}'.format(
            nazwa, n, z['przypadki'], z['p12'], z['ogon'], z['wrzesien'], z['klucz2'], z['osie']))
        o.append('     koszt {:.0f} .. {:.0f} .. {:.0f} M (twardy limit {:.0f} M); per wariant (dziś): {}'.format(
            dol, sr, gora, z['limit'], ', '.join('{} {:.0f}'.format(v, c) for v, c in z['per_wariant_sr'].items())))

    # pilot: dwie fazy o najwyższej wartości + najwyżej ceniona faza wrześniowa (obie epoki w pilocie)
    wrz = max((f for f in fazy if f['wrzesien']), key=lambda f: f['wart'])
    pilot = kolej[:2] + ([wrz] if wrz not in kolej[:2] else [kolej[2]])
    ps, pg = suma(pilot, 'dzis'), suma(pilot, 'dzis_max')
    o.append('  pilot (2 fazy o najwyższej wartości + najwyżej ceniona faza wrześniowa): {} | przypadków {} | koszt {:.0f} .. {:.0f} .. {:.0f} M'.format(
        ', '.join('{} (PR{} f{}, kod {})'.format(f['faza'], f['pr'], f['numer'], f['kod']) for f in pilot), sum(f['przypadki'] for f in pilot),
        suma(pilot, 'po_min'), ps, pg))
    wyn_zakresy['pilot'] = {'fazy': [f['faza'] for f in pilot], 'przypadki': sum(f['przypadki'] for f in pilot), 'koszt_dol': suma(pilot, 'po_min'),
                            'koszt_sr': ps, 'koszt_gora': pg, 'limit': pg * LIMIT_MNOZNIK,
                            'powtorka_najmniejszej': min(pilot, key=lambda f: f['kod'])['faza']}
    mn = min(pilot, key=lambda f: f['kod'])
    o.append('  powtórka r=2 w pilocie (najmniejsza faza pilota, wszystkie warianty + sędzia): {} — {:.0f} .. {:.0f} .. {:.0f} M'.format(
        mn['faza'], suma([mn], 'po_min'), suma([mn], 'dzis'), suma([mn], 'dzis_max')))
    o.append('  skala: run autopilota 20.09 (3 fazy, cały pipeline) = 35,3 M jedn. (panel-koszt.txt §2: 31,60 M fazy + 3,70 M poziom zadania)')

    o.append('\n=== 5. Moc: połowa szerokości 95% CI różnicy odsetka złapanych między dwoma wariantami i MDD (80% mocy) ===')
    o.append('  założenie: dziś 20% vs projekt 40%, rozrzut prawdziwej różnicy między przypadkami 0,15; powtarzalność review ~50% (POMIARY §4)')
    Z = wyn_zakresy
    for opis, n in (('pełny, wszystkie', Z['pełny']['przypadki']), ('pełny, P1/P2', Z['pełny']['p12']), ('75%, wszystkie', Z['75% przypadków']['przypadki']),
                    ('50%, wszystkie', Z['50% przypadków']['przypadki']), ('50%, P1/P2', Z['50% przypadków']['p12']), ('pilot', Z['pilot']['przypadki'])):
        for r in (1, 2):
            h, mdd = moc(n, r)
            o.append('  {:17s} N={:3d} r={} -> ±{:.1f} pkt proc., MDD {:.1f} pkt'.format(opis, n, r, 100 * h, 100 * mdd))
    n0 = Z['pełny']['przypadki']
    o.append('  wniosek mechaniczny: r=2 przy tym samym N zawęża CI o {:.0%}, podwojenie N o {:.0%} (koszt w obu przypadkach ×2) — więcej faz daje'.format(
        1 - moc(n0, 2)[0] / moc(n0, 1)[0], 1 - moc(2 * n0, 1)[0] / moc(n0, 1)[0]))
    o.append('  nieco więcej i dodatkowo szerszy przekrój klas; ale faz z przypadkami B jest {} ({} przypadków) — ponad pełny zakres są już tylko powtórki.'.format(
        Z['pełny']['fazy'], n0))

    # moduł opcjonalny: kontrola fixa na przypadkach urodzonych w fixie
    fixy = collections.defaultdict(list)
    for p in dane['przypadki']:
        if p['pochodzenie'] in ('fix-review', 'kontrola') and not p.get('faza_luzna'):
            fixy[p['scisla']['commit']].append(p)
    fk = koszt_roli(fit, 'fix:kontrola', 10)
    o.append('\n=== 6. Moduł opcjonalny: kontrola diffu fixa (przypadki urodzone w fixie review fazy) ===')
    o.append('  przypadków {} w {} commitach fixa; P1/P2 {}; koszt 4 warianty × {:.2f} M + sędzia ≈ {:.0f} M'.format(
        sum(len(v) for v in fixy.values()), len(fixy), sum(p['waga'] in ('P1', 'P2') for v in fixy.values() for p in v),
        fk, len(fixy) * (4 * fk + 0.5)))

    open(OUT_TXT, 'w').write('\n'.join(o) + '\n')
    json.dump({'fit': fit, 'fazy': fazy, 'kolejnosc': [f['faza'] for f in kolej], 'zakresy': wyn_zakresy,
               'fix_modul': {k: [p['id'] for p in v] for k, v in fixy.items()}}, open(OUT_JSON, 'w'), ensure_ascii=False, indent=1)
    print('\n'.join(o))


W_PO = 1.0   # sędzia nie ma „po zmianie” — ten sam koszt w obu kolumnach

if __name__ == '__main__':
    try:
        main()
    finally:
        shutil.rmtree(os.path.join(BASE, 'skrypty', '__pycache__'), ignore_errors=True)

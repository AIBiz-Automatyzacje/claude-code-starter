#!/usr/bin/env python3
"""Test review — analiza wyniku etapu głównego (HANDOFF 6a pkt 31, TEST-REVIEW-PLAN §5.2–§5.3, §6, §8). Zero agentów, zero tokenów.

Użycie:
  python3 skrypty/test_review_analiza.py probka  — próbka kalibracyjna sędziego etapu (plan §5.2): tylko NOWE jednostki (bez pilota), permutacja p1,
        ziarno stałe (moduł test_review_analiza_kalibracja.py); 10 dopasowań PEŁNE/CZĘŚCIOWE + 10 par BRAK (klucz obecny + niedopasowany do niego finding z TEGO SAMEGO pliku, najbliżej
        linii klucza) — metoda jak test_review_pilot.probka → dane/test-review/wynik-kalibracja-probka.{json,txt}
  python3 skrypty/test_review_analiza.py wynik   — liczby raportu → dane/test-review/wynik-{zlapania,roznice,przekroje,szum,koszt,klucz2-straty,
        kalibracja}.json + wynik.txt (tekst: moduł test_review_analiza_tekst.py; Stryker i źródła trafień dziś: test_review_analiza_mechanizmy.py). Oceny kalibracji z dane/test-review/wynik-kalibracja-oceny.json ([{nr, zgodne, uwaga}]); jednozdaniowe
        opisy strat klucza 2 z dane/test-review/wynik-klucz2-opisy.json ({"<et>|<przypadek>": "zdanie"}) — oba pisane w sesji głównej po lekturze.

Jednostki = dane/test-review/etap.json (13 faz f-* + 24 commity fixa x-*), zawsze permutacja p1 (także w jednostkach pilota — 6a pkt 31).
Złapanie „szeroko” = klucz obecny (TAK) i co najmniej jeden finding wariantu dopasowany PEŁNE lub CZĘŚCIOWE (miara główna, pilot §2).
Różnice A/B/C − 0 sparowane po kluczu; CI 95% bootstrapem po jednostkach (losowanie jednostek ze zwracaniem, percentyle).
Koszt: test_review_wynik.koszt na wszystkich jednostkach do katalogu tymczasowego (dane/test-review/koszt.* zostają nietknięte), kolumna PO
(„po zmianie kontekstu”, panel_koszt_model.Referencja) minus sesja uruchamiająca (pomiar)."""
import collections, json, os, random, re, subprocess, sys, tempfile

sys.dont_write_bytecode = True
import test_review_analiza_kalibracja as KAL
import test_review_analiza_mechanizmy as M
import test_review_analiza_tekst as TX
import test_review_pilot as P
import test_review_wynik as W

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = os.path.expanduser('~/test-review')
OUT = os.path.join(BASE, 'dane', 'test-review')
WARIANTY = '0ABC'
NOWE = 'ABC'
N_BOOT = 10000
ZIARNO_BOOT = 20260927
RE_KOD = re.compile(r'\.(ts|tsx|js|jsx|mjs|cjs|sql)$')   # jak linie_diff w test_review_fazy.py


def jednostki():
    return json.load(open(os.path.join(OUT, 'etap.json')))


def czesc(et):
    return 'fazy' if et.startswith('f-') else 'fix'


def zestaw():
    return {z['id']: z for z in map(json.loads, open(os.path.join(BASE, 'dane', 'panel-zestaw-historyczny.jsonl')))}


def wiersze():
    """Jeden wiersz na klucz jednostki: metadane + dla każdego wariantu sz_/pe_ (szeroko/PEŁNE), br_ (przez bramkę), tylko_br_, ver_ (po sceptykach)."""
    zest, R = zestaw(), []
    for u in jednostki():
        et = u['et']
        kl, sed, mp = P.wczytaj(et, '1')
        zab = {w: W.zabite(et, w) for w in WARIANTY}
        for k in sed['klucze']:
            K = kl[k['id']]
            z = zest.get(K['przypadek'], {})
            r = {'et': et, 'czesc': czesc(et), 'rodzaj': u['rodzaj'], 'z_pilota': u['z_pilota'], 'zrodlo': K['zrodlo'], 'przypadek': K['przypadek'],
                 'waga': K.get('waga'), 'os': K.get('os') or z.get('os_wlasciciel'), 'rodzina': z.get('rodzina'), 'epoka': z.get('epoka'),
                 'ogon': (not z['widoczna_dla_projektantow']) if z else None, 'obecny': k.get('obecny'), 'plik': K['plik'], 'linia': K['linia']}
            for w in WARIANTY:
                ds = [d for d in k.get('dopasowania') or [] if w in mp['F'].get(d['f'], {}).get('wlasciciele', [])]
                agent = [d for d in ds if mp['F'][d['f']]['rodzaj'] == 'agent']
                r['sz_' + w], r['pe_' + w] = bool(ds), any(d.get('ocena') == 'PEŁNE' for d in ds)
                r['br_' + w], r['tylko_br_' + w] = len(agent) < len(ds), bool(ds) and not agent
                r['ver_' + w] = None if zab[w] is None else any(d['f'] not in zab[w] for d in ds)
            R.append(r)
    return R


def obecne(R, czesc_=None, zrodlo=None, filtr=None):
    return [r for r in R if r['obecny'] == 'TAK' and (czesc_ is None or r['czesc'] == czesc_) and (zrodlo is None or r['zrodlo'] == zrodlo)
            and (filtr is None or filtr(r))]


def bootstrap(rs, w, miara='sz'):
    """(różnica w pkt %, CI 2,5–97,5) dla wariantu w względem 0; losowanie jednostek ze zwracaniem."""
    po_et = collections.defaultdict(lambda: [0, 0, 0])
    for r in rs:
        t = po_et[r['et']]; t[0] += 1; t[1] += r[miara + '_0']; t[2] += r[miara + '_' + w]
    u = list(po_et.values())
    if not u: return None
    rnd, roz = random.Random(ZIARNO_BOOT), []
    for _ in range(N_BOOT):
        s = [u[rnd.randrange(len(u))] for _ in u]
        n = sum(x[0] for x in s)
        if n: roz.append(100 * (sum(x[2] for x in s) - sum(x[1] for x in s)) / n)
    roz.sort()
    n = sum(x[0] for x in u)
    return {'roznica': round(100 * (sum(x[2] for x in u) - sum(x[1] for x in u)) / n, 1),
            'ci95': [round(roz[int(0.025 * len(roz))], 1), round(roz[int(0.975 * len(roz)) - 1], 1)], 'jednostek': len(u)}


def zlapania(rs, miara='sz'):
    n = len(rs)
    return {'n': n, **{w: {'zlapane': sum(r[miara + '_' + w] for r in rs), 'procent': round(100 * sum(r[miara + '_' + w] for r in rs) / n, 1) if n else None}
                       for w in WARIANTY}}


def roznice(rs):
    """Sparowane po kluczu: X łapie a 0 nie (zysk pary) / 0 łapie a X nie (strata pary) + bootstrap szeroko i PEŁNE."""
    out = {}
    for w in NOWE:
        out[w] = {'tylko_' + w: sum(r['sz_' + w] and not r['sz_0'] for r in rs), 'tylko_0': sum(r['sz_0'] and not r['sz_' + w] for r in rs),
                  'szeroko': bootstrap(rs, w, 'sz'), 'pelne': bootstrap(rs, w, 'pe')}
    return out


def komplementarnosc(rs):
    """Czy warianty łapią to samo: nikt / wszyscy / ktokolwiek oraz suma pokrycia par 0 ∪ X (szeroko)."""
    return {'n': len(rs), 'nikt': sum(not any(r['sz_' + w] for w in WARIANTY) for r in rs), 'wszyscy': sum(all(r['sz_' + w] for w in WARIANTY) for r in rs),
            'ktokolwiek': sum(any(r['sz_' + w] for w in WARIANTY) for r in rs), **{'0+' + w: sum(r['sz_0'] or r['sz_' + w] for r in rs) for w in NOWE}}


def przekroje(R):
    """Złapane szeroko w grupach klucza 1 (fazy, fix) i klucza 2 (fazy) — małe N, tylko liczby."""
    grupy = {'P1/P2': lambda r: r['waga'] in ('P1', 'P2'), 'P1': lambda r: r['waga'] == 'P1', 'P3': lambda r: r['waga'] == 'P3',
             'ogon': lambda r: r['ogon'], 'wrzesień': lambda r: r['epoka'] == 'wrzesien'}
    out = {}
    for cz in ('fazy', 'fix'):
        rs = obecne(R, cz, 'klucz1')
        g = {n: zlapania([r for r in rs if f(r)]) for n, f in grupy.items()}
        for pole in ('os', 'rodzina'):
            for v in sorted({r[pole] for r in rs}):
                g['%s=%s' % (pole, v)] = zlapania([r for r in rs if r[pole] == v])
        out['klucz1|' + cz] = g
    rs = obecne(R, 'fazy', 'klucz2')
    out['klucz2|fazy'] = {n: zlapania([r for r in rs if r['waga'] == n]) for n in ('P1', 'P2')}
    return out


def bramki_i_weryfikacja(R):
    rs = obecne(R, None, 'klucz1')
    bram = {cz: {w: {'przez_bramke': sum(r['br_' + w] for r in rs if r['czesc'] == cz), 'tylko_bramka': sum(r['tylko_br_' + w] for r in rs if r['czesc'] == cz)}
                 for w in NOWE} for cz in ('fazy', 'fix')}
    ver = {}
    for w in WARIANTY:
        f = [r for r in rs if r['czesc'] == 'fazy' and r['ver_' + w] is not None]
        ver[w] = {'szeroko_przed': sum(r['sz_' + w] for r in f), 'szeroko_po': sum(bool(r['ver_' + w]) for r in f),
                  'zabite_prawdziwe_B': [r['przypadek'] for r in f if r['sz_' + w] and not r['ver_' + w]],
                  'P1P2_przed': sum(r['sz_' + w] for r in f if r['waga'] in ('P1', 'P2')), 'n': len(f)}
    return bram, ver


def linie_diffu(et):
    br = json.load(open(os.path.join(OUT, 'bramki-%s.json' % et)))
    out = subprocess.run(['git', '-C', os.path.join(TR, '_mirror'), 'diff', '--numstat', br['baza'], br['sha']], capture_output=True, text=True, check=True).stdout
    return sum(int(a) + int(b) for a, b, p in (l.split('\t', 2) for l in out.splitlines()) if a != '-' and RE_KOD.search(p)), br['pliki_kodu']


def szum():
    """Per jednostka i wariant: findingi agentów (P1/P2), POZA KLUCZEM (agent / bramka, P1/P2), INNA UWAGA BOTA; linie diffu kodu."""
    per = {}
    for u in jednostki():
        et = u['et']
        _, sed, mp = P.wczytaj(et, '1')
        kat = {b['f']: b['kategoria'] for b in sed.get('bez_dopasowania', [])}
        linie, pliki = linie_diffu(et)
        per[et] = {'linie': linie, 'pliki_kodu': pliki}
        for w in WARIANTY:
            moje = {fid: f for fid, f in mp['F'].items() if w in f['wlasciciele']}
            p12 = lambda f: f['waga'] in ('P1', 'P2')
            poza = [f for fid, f in moje.items() if kat.get(fid) == 'POZA_KLUCZEM']
            per[et][w] = {'findingi_agent': sum(f['rodzaj'] == 'agent' for f in moje.values()),
                          'findingi_agent_P1P2': sum(f['rodzaj'] == 'agent' and p12(f) for f in moje.values()),
                          'poza_agent': sum(f['rodzaj'] == 'agent' for f in poza), 'poza_agent_P1P2': sum(f['rodzaj'] == 'agent' and p12(f) for f in poza),
                          'poza_bramka': sum(f['rodzaj'] == 'bramka' for f in poza),
                          'inna_uwaga_bota': sum(kat.get(fid) == 'INNA_UWAGA_BOTA' for fid in moje)}
    razem = {}
    for cz in ('fazy', 'fix'):
        ets = [et for et in per if czesc(et) == cz]
        linie = sum(per[et]['linie'] for et in ets)
        razem[cz] = {'jednostek': len(ets), 'linie': linie}
        for w in WARIANTY:
            s = {k: sum(per[et][w][k] for et in ets) for k in per[ets[0]][w]}
            s.update({'poza_agent_na_jednostke': round(s['poza_agent'] / len(ets), 1), 'poza_agent_P1P2_na_jednostke': round(s['poza_agent_P1P2'] / len(ets), 1),
                      'poza_agent_na_100_linii': round(100 * s['poza_agent'] / linie, 2), 'poza_agent_P1P2_na_100_linii': round(100 * s['poza_agent_P1P2'] / linie, 2),
                      'findingi_agent_P1P2_na_jednostke': round(s['findingi_agent_P1P2'] / len(ets), 1)})
            razem[cz][w] = s
    return {'jednostki': per, 'razem': razem}


def koszt(R):
    """Koszt netto wariantów (PO − sesja uruchamiająca) per część; na jednostkę i na złapaną uwagę B (klucz 1 szeroko); przyrost względem 0."""
    import contextlib, io
    tmp = tempfile.mkdtemp(prefix='analiza-koszt-')
    W.OUT = tmp
    with contextlib.redirect_stdout(io.StringIO()):
        W.koszt([u['et'] for u in jednostki()])
    kz = json.load(open(os.path.join(tmp, 'koszt.json')))
    netto = lambda v, pole: (v[pole] - v['pomiar']) / 1e6
    per = collections.defaultdict(dict)
    for k, v in kz.items():
        et, krok = k.split('|', 1)
        per[et][krok] = {'po': round(netto(v, 'po'), 3), 'zmierzony': round(netto(v, 'zmierzony'), 3), 'pomiar': round(v['pomiar'] / 1e6, 3),
                         'zmierzony_brutto': round(v['zmierzony'] / 1e6, 3)}
    out = {'razem_zmierzony_brutto': round(sum(x['zmierzony_brutto'] for d in per.values() for x in d.values()), 2), 'czesci': {}}
    for cz in ('fazy', 'fix'):
        ets = [u['et'] for u in jednostki() if czesc(u['et']) == cz]
        rs = obecne(R, cz, 'klucz1')
        c = {}
        for w in WARIANTY:
            zn = sum(per[et].get('wariant' + w, {}).get('po', 0) for et in ets)
            zn_zm = sum(per[et].get('wariant' + w, {}).get('zmierzony', 0) for et in ets)
            ver = sum(per[et].get('sceptycy' + w, {}).get('po', 0) for et in ets)
            zl = sum(r['sz_' + w] for r in rs)
            c[w] = {'znajdowanie_po': round(zn, 2), 'znajdowanie_zmierzony': round(zn_zm, 2), 'weryfikacja_dopasowanych_po': round(ver, 2),
                    'na_jednostke_po': round(zn / len(ets), 2), 'zlapane_klucz1': zl, 'na_zlapana_B_po': round(zn / zl, 2) if zl else None}
        for w in NOWE:
            dz = c[w]['zlapane_klucz1'] - c['0']['zlapane_klucz1']
            c[w]['przyrost_kosztu_po'] = round(c[w]['znajdowanie_po'] - c['0']['znajdowanie_po'], 2)
            c[w]['przyrost_zlapan'] = dz
        c['pomiar_po'] = round(sum(x['po'] + x['pomiar'] for et in ets for k, x in per[et].items() if k.startswith('sedzia')), 2)
        out['czesci'][cz] = c
    out['jednostki'] = per
    return out


def klucz2_straty(R, zrodla):
    opisy_p = os.path.join(OUT, 'wynik-klucz2-opisy.json')
    opisy = json.load(open(opisy_p)) if os.path.exists(opisy_p) else {}
    tresci = {}
    for et in {r['et'] for r in R if r['czesc'] == 'fazy'}:
        for K in json.load(open(os.path.join(TR, 'sedzia', et + '-klucze.json')))['klucze']:
            tresci[(et, K['przypadek'])] = K
    lista = []
    for r in obecne(R, 'fazy', 'klucz2'):
        gubi = [w for w in NOWE if r['sz_0'] and not r['sz_' + w]]
        zyskuje = [w for w in NOWE if r['sz_' + w] and not r['sz_0']]
        if not gubi and not zyskuje: continue
        K = tresci[(r['et'], r['przypadek'])]
        lista.append({'et': r['et'], 'przypadek': r['przypadek'], 'waga': r['waga'], 'plik': r['plik'], 'linia': r['linia'], 'gubi': gubi,
                      'lapie_tylko_nowy': zyskuje, 'zrodlo_0': sorted(zrodla.get((r['et'], r['przypadek']), [])),
                      'opis': opisy.get('%s|%s' % (r['et'], r['przypadek'])), 'tresc': (K.get('tresc') or '')[:600]})
    return lista


def wynik():
    R = wiersze()
    nazwy = {'klucz1|fazy': obecne(R, 'fazy', 'klucz1'), 'klucz2|fazy': obecne(R, 'fazy', 'klucz2'), 'klucz1|fix': obecne(R, 'fix', 'klucz1'),
             'klucz1|razem': obecne(R, None, 'klucz1'),
             'bilans P1/P2 (klucz1 P1/P2 + klucz2)|fazy': obecne(R, 'fazy', None, lambda r: r['waga'] in ('P1', 'P2'))}
    zl = {n: {'sz': zlapania(rs, 'sz'), 'pe': zlapania(rs, 'pe'), 'kompl': komplementarnosc(rs)} for n, rs in nazwy.items()}
    rz = {n: roznice(rs) for n, rs in nazwy.items()}
    prz = przekroje(R)
    bram, ver = bramki_i_weryfikacja(R)
    fazy = sorted({u['et'] for u in jednostki() if czesc(u['et']) == 'fazy'})
    zr = M.zrodla_0(fazy)
    sz, ko, k2, kal, st = szum(), koszt(R), klucz2_straty(R, zr), KAL.kalibracja(), M.stryker(R, fazy)
    bram['zrodla_0'] = M.zrodla_0_podsumowanie(R, k2, zr)
    bram['kontrola_fixa_dzis'] = M.kontrola_fixa_dzis(R, sorted({u['et'] for u in jednostki() if czesc(u['et']) == 'fix'}))
    st['mutanty_w_promptach'] = M.mutanty_w_promptach(fazy)
    nieobecne = collections.Counter((r['czesc'], r['zrodlo'], r['obecny']) for r in R)
    for nazwa, dane in (('zlapania', {'wiersze': R, 'obecnosc': {'|'.join(k): v for k, v in nieobecne.items()}, 'zlapania': zl}), ('roznice', rz),
                        ('przekroje', prz), ('bramki-weryfikacja', {'bramki': bram, 'weryfikacja': ver, 'stryker': st}), ('szum', sz), ('koszt', ko),
                        ('klucz2-straty', k2), ('kalibracja', kal)):
        json.dump(dane, open(os.path.join(OUT, 'wynik-%s.json' % nazwa), 'w'), ensure_ascii=False, indent=1)
    t = TX.tekst({'kal': kal, 'zl': zl, 'rz': rz, 'prz': prz, 'bram': bram, 'st': st, 'ver': ver, 'sz': sz, 'ko': ko, 'k2': k2,
                  'obecnosc': dict(nieobecne)}, N_BOOT)
    open(os.path.join(OUT, 'wynik.txt'), 'w').write(t)
    print(t)


if __name__ == '__main__':
    t = sys.argv[1] if len(sys.argv) > 1 else ''
    if t == 'probka': KAL.probka()
    elif t == 'wynik': wynik()
    else: raise SystemExit(__doc__)

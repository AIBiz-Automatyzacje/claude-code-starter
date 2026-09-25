#!/usr/bin/env python3
"""Test review — analiza po pilocie (TEST-REVIEW-PLAN §12 pkt 3): kalibracja sędziego, zgodność sędziego p1 vs p2, stabilność b26128d vs r2,
koszt zmierzony vs szacunek, szczelność ze skanów. Zero agentów.

Użycie:
  python3 skrypty/test_review_pilot.py probka   — próbka kalibracyjna ze stałym ziarnem, permutacja p1: 10 decyzji PEŁNE/CZĘŚCIOWE + 10 par BRAK
                                                  (klucz obecny + niedopasowany do niego finding z TEGO SAMEGO pliku, najbliżej linii klucza)
                                                  → dane/test-review/pilot-kalibracja-probka.{json,txt}
  python3 skrypty/test_review_pilot.py wynik    — liczby pilota → dane/test-review/pilot-{zgodnosc,stabilnosc,koszt,szczelnosc,kalibracja}.json
                                                  + pilot.txt; kalibracja z ocen w dane/test-review/pilot-kalibracja-oceny.json ([{nr, zgodne, uwaga}]).
Tożsamość findingu między permutacjami: agent = (wariant, indeks w jego liście), bramka = (właściciele, plik, linia); klucze między fazą
a powtórką = (źródło, przypadek) — id K i F są losowane per faza / permutacja."""
import hashlib, json, os, random, sys

sys.dont_write_bytecode = True
import test_review_wynik as W

TR = os.path.expanduser('~/test-review')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dane', 'test-review')
FAZY = ['f-b26128d', 'f-2634b67', 'f-f3ee433', 'f-b26128d-r2', 'x-411a434', 'x-05dd804']
WARIANTY = '0ABC'
PROBKA_NA_TYP = 10
PROG_KALIBRACJI = 15.0   # §11: kalibracja sędziego > 15% dwukrotnie = twarde zatrzymanie etapu głównego


def wczytaj(et, perm):
    """(klucze fazy po id, wynik sędziego, mapowanie) jednej permutacji."""
    kl = {k['id']: k for k in json.load(open(os.path.join(TR, 'sedzia', et + '-klucze.json')))['klucze']}
    sed = json.load(open(os.path.join(TR, 'wyniki', et, 'sedzia-p%s.json' % perm)))
    mp = json.load(open(os.path.join(TR, 'sedzia', '%s-p%s-mapowanie.json' % (et, perm))))
    return kl, sed, mp


def tozsamosc(f):
    if f['rodzaj'] == 'agent': return 'agent|%s|%s' % (f['wlasciciele'][0], f['indeks'])
    return 'bramka|%s|%s|%s' % (''.join(sorted(f['wlasciciele'])), f['plik'], f['linia'])


def zlapania(sed, mp):
    """{id K: {obecny, szeroko: warianty z dopasowaniem PEŁNE/CZĘŚCIOWE, pelne: warianty z PEŁNE}}"""
    z = {}
    for k in sed.get('klucze', []):
        sz, pe = set(), set()
        for d in k.get('dopasowania') or []:
            wl = set(mp['F'].get(d['f'], {}).get('wlasciciele', []))
            sz |= wl
            if d.get('ocena') == 'PEŁNE': pe |= wl
        z[k['id']] = {'obecny': k.get('obecny') == 'TAK', 'szeroko': sz, 'pelne': pe}
    return z


def dopasowania_f(sed, mp):
    """{tożsamość findingu: zbiór (id K, ocena)} — do czego sędzia przypisał każdy finding."""
    d = {}
    for k in sed.get('klucze', []):
        for x in k.get('dopasowania') or []:
            if x['f'] in mp['F']: d.setdefault(tozsamosc(mp['F'][x['f']]), set()).add((k['id'], x.get('ocena')))
    return d


def zgodnosc():
    suma = {m: [0, 0] for m in ('obecny', 'szeroko', 'pelne', 'finding')}
    fazy = []
    for et in FAZY:
        _, s1, m1 = wczytaj(et, '1'); _, s2, m2 = wczytaj(et, '2')
        z1, z2, rozb = zlapania(s1, m1), zlapania(s2, m2), []
        for kid in sorted(z1, key=lambda x: int(x[1:])):
            a, b = z1[kid], z2.get(kid)
            if b is None: rozb.append('%s: brak klucza w wyniku p2' % kid); continue
            suma['obecny'][0] += a['obecny'] == b['obecny']; suma['obecny'][1] += 1
            if a['obecny'] != b['obecny']: rozb.append('%s obecny: p1 %s, p2 %s' % (kid, a['obecny'], b['obecny']))
            if not (a['obecny'] and b['obecny']): continue
            for w in WARIANTY:
                for m in ('szeroko', 'pelne'):
                    zg = (w in a[m]) == (w in b[m]); suma[m][0] += zg; suma[m][1] += 1
                    if not zg: rozb.append('%s wariant %s %s: p1 %s, p2 %s' % (kid, w, m, w in a[m], w in b[m]))
        f1, f2 = dopasowania_f(s1, m1), dopasowania_f(s2, m2)
        for t in set(f1) | set(f2):
            zg = f1.get(t, set()) == f2.get(t, set()); suma['finding'][0] += zg; suma['finding'][1] += 1
        fazy.append({'et': et, 'rozbieznosci': rozb})
    return {'zgodnosc': {m: {'zgodne': a, 'z': n, 'procent': round(100 * a / n, 1) if n else None} for m, (a, n) in suma.items()},
            'opis': 'obecny = sędzia tak samo ocenił obecność klucza w kodzie; szeroko/pelne = para (klucz obecny w obu, wariant) złapana tak samo; '
                    'finding = finding dopasowany w którejś permutacji do tych samych kluczy z tą samą oceną', 'fazy': fazy}


def stan_fazy(et):
    kl, s, m = wczytaj(et, '1')
    z = zlapania(s, m)
    przyp = {'%s|%s' % (kl[k]['zrodlo'], kl[k]['przypadek']): v for k, v in z.items()}
    per = {}
    for w in WARIANTY:
        fs = json.load(open(os.path.join(TR, 'wyniki', et, 'wariant%s.json' % w))).get('findings') or []
        szum = [b for b in s.get('bez_dopasowania', []) if b['kategoria'] == 'POZA_KLUCZEM' and w in m['F'].get(b['f'], {}).get('wlasciciele', [])]
        per[w] = {'findingow': len(fs), 'szum': len(szum), 'szum_P1P2': sum(m['F'][b['f']]['waga'] in ('P1', 'P2') for b in szum)}
    return przyp, per


def stabilnosc(a='f-b26128d', b='f-b26128d-r2'):
    (pa, fa), (pb, fb) = stan_fazy(a), stan_fazy(b)
    wspolne = sorted(set(pa) & set(pb))
    obecne = [c for c in wspolne if pa[c]['obecny'] and pb[c]['obecny']]
    wynik = {'klucze_wspolne': len(wspolne), 'obecne_w_obu': len(obecne),
             'obecnosc_zgodna': sum(pa[c]['obecny'] == pb[c]['obecny'] for c in wspolne), 'warianty': {}}
    for w in WARIANTY:
        r = {'findingow': [fa[w]['findingow'], fb[w]['findingow']], 'szum': [fa[w]['szum'], fb[w]['szum']],
             'szum_P1P2': [fa[w]['szum_P1P2'], fb[w]['szum_P1P2']]}
        for m in ('szeroko', 'pelne'):
            x, y = {c for c in obecne if w in pa[c][m]}, {c for c in obecne if w in pb[c][m]}
            r[m] = {'oba': len(x & y), 'tylko_' + a: len(x - y), 'tylko_' + b: len(y - x), 'zlapane': [len(x), len(y)]}
        wynik['warianty'][w] = r
    return wynik


def koszt():
    W.koszt(FAZY)   # świeże koszt.json dla wszystkich faz (limit w runie liczył tylko fazy tamtego przebiegu)
    kz = json.load(open(os.path.join(OUT, 'koszt.json')))
    szac = {f['et']: f for f in json.load(open(os.path.join(OUT, 'koszt-pilota.json')))['fazy']}
    fazy, razem, odrzucone = [], 0.0, 0.0
    for et in FAZY:
        kroki = {k.split('|', 1)[1]: v for k, v in kz.items() if k.split('|', 1)[0] == et}
        zm = sum(v['zmierzony'] for v in kroki.values()) / 1e6
        odr = kroki.get('odrzucone', {}).get('zmierzony', 0) / 1e6
        warianty = {w: round(kroki.get('wariant' + w, {}).get('zmierzony', 0) / 1e6, 2) for w in WARIANTY}
        fazy.append({'et': et, 'zmierzony': round(zm, 2), 'w_tym_odrzucone': round(odr, 2), 'szacunek': szac[et]['razem'],
                     'warianty_zmierzone': warianty, 'warianty_szacunek_gorna': szac[et].get('per_wariant_gorna')})
        razem += zm; odrzucone += odr
    p = json.load(open(os.path.join(OUT, 'koszt-pilota.json')))
    return {'jednostka': 'M jedn. (cennik d4r)', 'razem_zmierzony': round(razem, 2), 'w_tym_odrzucone': round(odrzucone, 2),
            'szacunek_srodek': p['srodek'], 'szacunek_gorna': p['gorna'], 'limit': p['limit'], 'fazy': fazy,
            'etap_glowny': przeliczenie(fazy, kz)}


def przeliczenie(fazy, kz):
    """Etap główny ze zmierzonych danych: warianty = szacunek „dziś” zakresu × średnia proporcja (zmierzone warianty / szacunek „dziś” tych
    samych faz pilota); do tego narzut na fazę (sędzia jednej permutacji + sceptycy + sesje) zmierzony w fazach review pilota."""
    plan = json.load(open(os.path.join(os.path.dirname(OUT), 'test-review-plan.json')))
    proporcje, narzut = [], []
    for f in fazy:
        if not f['et'].startswith('f-'): continue
        sha = json.load(open(os.path.join(TR, 'meta', f['et'] + '.json')))['sha']
        szac = [x for x in plan['fazy'] if sha.startswith(x['faza'])]
        warianty = sum(f['warianty_zmierzone'].values())
        if szac: proporcje.append(warianty / sum(szac[0]['koszt'][w]['dzis'] for w in WARIANTY))
        p2 = kz.get('%s|sedzia-p2' % f['et'], {}).get('zmierzony', 0) / 1e6
        narzut.append(f['zmierzony'] - f['w_tym_odrzucone'] - warianty - p2)
    p, n = sum(proporcje) / len(proporcje), sum(narzut) / len(narzut)
    zakresy = {}
    for z, v in plan['zakresy'].items():
        if 'per_wariant_sr' not in v: continue   # zakres „pilot” — to ten pomiar
        war = sum(v['per_wariant_sr'].values()) * p
        zakresy[z] = {'fazy': v['fazy'], 'szacunek_przed_pilotem_sr': round(v['koszt_sr'], 1), 'limit_przed_pilotem': round(v['limit'], 1),
                      'po_pilocie': round(war + n * v['fazy'], 1), 'w_tym_warianty': round(war, 1), 'w_tym_narzut': round(n * v['fazy'], 1)}
    return {'proporcja_wariantow': [round(x, 3) for x in proporcje], 'srednia_proporcja': round(p, 3), 'narzut_na_faze': round(n, 2),
            'zakresy': zakresy, 'uwaga': 'per_wariant_sr planu = suma szacunku „dziś” pierwszych N faz z kolejności (sprawdzone 2026-09-25), '
                                         'proporcja też względem „dziś”; bez modułu kontroli diffu fixa (pilot: ~2,2 M jedn. na commit fixa)'}


def szczelnosc():
    fazy = []
    for et in FAZY:
        s = json.load(open(os.path.join(OUT, 'skan-%s.json' % et)))
        fazy.append({'et': et, 'podsumowanie': s['podsumowanie'], 'kopia': s.get('kopia') or 'bez zmian', 'uwagi': s.get('uwagi', [])})
    stan = open(os.path.join(OUT, 'stan-po.txt')).read()
    return {'fazy': fazy, 'twarde_razem': sum(f['podsumowanie'][k] for f in fazy for k in ('model', 'przeciek', 'zapis', 'n1')),
            'uwag_razem': sum(len(f['uwagi']) for f in fazy), 'stan_po_linii': len(stan.splitlines())}


def tekst_findingu(et, mf):
    if mf['rodzaj'] == 'agent':
        f = json.load(open(os.path.join(TR, 'wyniki', et, 'wariant%s.json' % mf['wlasciciele'][0])))['findings'][mf['indeks']]
        return {'opis': (f.get('opis') or '')[:900], 'scenariusz': (f.get('scenariusz') or '')[:300]}
    br = json.load(open(os.path.join(OUT, 'bramki-%s.json' % et)))
    t = [t for p in 'ABC' for t in br['projekty'][p]['trafienia'] if t['plik'] == mf['plik'] and t['linia'] == mf['linia']]
    return {'opis': ('bramka %s: %s' % (t[0]['regula'], t[0]['opis'])) if t else '?', 'scenariusz': ''}


def probka():
    rnd = random.Random(int(hashlib.sha256(b'pilot-kalibracja').hexdigest()[:8], 16))
    dop, brak = [], []
    for et in FAZY:
        kl, s, m = wczytaj(et, '1')
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
    wybor = rnd.sample(dop, min(PROBKA_NA_TYP, len(dop))) + rnd.sample(brak, min(PROBKA_NA_TYP, len(brak)))
    L = []
    for nr, x in enumerate(wybor, 1):
        kl, _, m = wczytaj(x['et'], '1')
        K, mf = kl[x['K']], m['F'][x['F']]
        x.update({'nr': nr, 'klucz': {c: K.get(c) for c in ('zrodlo', 'przypadek', 'waga', 'os', 'plik', 'linia', 'streszczenie')} | {
                      'tresc': (K.get('tresc') or '')[:700], 'wycinek': K.get('wycinek')},
                  'finding': {'wlasciciele': mf['wlasciciele'], 'rodzaj': mf['rodzaj'], 'plik': mf['plik'], 'linia': mf['linia'], 'waga': mf['waga']}
                  | tekst_findingu(x['et'], mf)})
        L += ['#%d %s %s×%s — sędzia: %s' % (nr, x['et'], x['K'], x['F'], x['ocena']),
              '  KLUCZ %s %s %s:%s — %s' % (K['przypadek'], K.get('waga'), K['plik'], K['linia'], K.get('streszczenie')),
              '  treść: ' + x['klucz']['tresc'].replace('\n', ' ')[:500],
              '  FINDING %s %s %s:%s — %s' % (''.join(mf['wlasciciele']), mf['waga'], mf['plik'], mf['linia'], x['finding']['opis'].replace('\n', ' ')[:600]),
              '  sędzia: ' + (x.get('uzasadnienie') or x.get('gdzie_sedzia_go_dal', '')) + ('' if 'odleglosc_linii' not in x else ' | odległość linii %d' % x['odleglosc_linii']), '']
    json.dump(wybor, open(os.path.join(OUT, 'pilot-kalibracja-probka.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, 'pilot-kalibracja-probka.txt'), 'w').write('\n'.join(L))
    print('próbka: %d PEŁNE/CZĘŚCIOWE z %d, %d BRAK z %d → pilot-kalibracja-probka.txt' % (min(PROBKA_NA_TYP, len(dop)), len(dop),
                                                                                          min(PROBKA_NA_TYP, len(brak)), len(brak)))


def kalibracja():
    plik = os.path.join(OUT, 'pilot-kalibracja-oceny.json')
    if not os.path.exists(plik): return {'stan': 'brak ocen — najpierw pilot-kalibracja-oceny.json'}
    pr = {x['nr']: x for x in json.load(open(os.path.join(OUT, 'pilot-kalibracja-probka.json')))}
    oc = json.load(open(plik))
    zle = [o for o in oc if not o['zgodne']]
    typ = lambda o: 'BRAK' if pr[o['nr']]['ocena'] == 'BRAK' else 'PEŁNE/CZĘŚCIOWE'
    return {'decyzji': len(oc), 'niezgodnych': len(zle), 'procent_bledow': round(100 * len(zle) / len(oc), 1), 'prog': PROG_KALIBRACJI,
            'w_progu': 100 * len(zle) / len(oc) <= PROG_KALIBRACJI,
            'wg_typu': {t: sum(1 for o in zle if typ(o) == t) for t in ('PEŁNE/CZĘŚCIOWE', 'BRAK')},
            'szara_strefa_PELNE_CZESCIOWE': sum(1 for o in oc if o.get('szara_strefa')),   # definicja dopuszcza obie oceny — dotyczy metryki PEŁNE
            'niezgodne': zle}


def wynik():
    czesci = {'zgodnosc': zgodnosc(), 'stabilnosc': stabilnosc(), 'koszt': koszt(), 'szczelnosc': szczelnosc(), 'kalibracja': kalibracja()}
    for n, d in czesci.items(): json.dump(d, open(os.path.join(OUT, 'pilot-%s.json' % n), 'w'), ensure_ascii=False, indent=1)
    L = ['test_review_pilot.py wynik — analiza po pilocie']
    L += ['ZGODNOŚĆ sędziego p1 vs p2: ' + '; '.join('%s %s/%s (%s%%)' % (m, v['zgodne'], v['z'], v['procent']) for m, v in czesci['zgodnosc']['zgodnosc'].items())]
    L += ['  %s: %s' % (f['et'], '; '.join(f['rozbieznosci']) or 'bez rozbieżności') for f in czesci['zgodnosc']['fazy']]
    st = czesci['stabilnosc']
    L += ['STABILNOŚĆ f-b26128d vs r2 (p1): kluczy wspólnych %d, obecnych w obu %d, obecność zgodna %d' % (st['klucze_wspolne'], st['obecne_w_obu'], st['obecnosc_zgodna'])]
    L += ['  wariant %s: %s' % (w, json.dumps(r, ensure_ascii=False)) for w, r in st['warianty'].items()]
    k = czesci['koszt']
    L += ['KOSZT: zmierzony %.2f M (w tym odrzucone %.2f) vs szacunek środek %s, górna %s, limit %s' % (k['razem_zmierzony'], k['w_tym_odrzucone'],
                                                                                                    k['szacunek_srodek'], k['szacunek_gorna'], k['limit'])]
    L += ['  %s: %.2f M (odrzucone %.2f) vs szacunek %s; warianty %s vs górna %s' % (f['et'], f['zmierzony'], f['w_tym_odrzucone'], f['szacunek'],
                                                                                   f['warianty_zmierzone'], f['warianty_szacunek_gorna']) for f in k['fazy']]
    e = k['etap_glowny']
    L += ['ETAP GŁÓWNY po pilocie: proporcja wariantów %s (średnio %s), narzut na fazę %s M' % (e['proporcja_wariantow'], e['srednia_proporcja'], e['narzut_na_faze'])]
    L += ['  %s: %s' % (z, json.dumps(v, ensure_ascii=False)) for z, v in e['zakresy'].items()]
    s = czesci['szczelnosc']
    L += ['SZCZELNOŚĆ: twardych alarmów w końcowych skanach %d, uwag %d' % (s['twarde_razem'], s['uwag_razem'])]
    L += ['  %s: %s | kopia: %s | uwagi: %s' % (f['et'], f['podsumowanie'], f['kopia'], f['uwagi']) for f in s['fazy']]
    L += ['KALIBRACJA: ' + json.dumps({x: y for x, y in czesci['kalibracja'].items() if x != 'niezgodne'}, ensure_ascii=False)]
    open(os.path.join(OUT, 'pilot.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    {'probka': probka, 'wynik': wynik}[sys.argv[1]]()

"""Panel decyzyjny, po run 2 — profil pokrycia per projekt (PANEL-PLAN §5, §7 pkt 2, §10).

Wejście: dane/panel-run2-sedzia.json (journal_do_json.py z runu 2: etykieta -> {oceny, trudne}),
dane/panel-run2-mapowanie.json (porcja -> etykieta P/Q/R/S -> projekt + mapa neutralnych id),
dane/panel-zestaw-historyczny.jsonl (waga, rodzina, ogon, epoka, oś).
Wyjście: dane/panel-pokrycie.txt (raport), dane/panel-pokrycie.json (ocena per przypadek per projekt, id mechanizmów oryginalne).

Kalibracja: projekt 0 = dzisiejszy pipeline, przez który przeszedł każdy przypadek B; odsetek BRAMKA+LISTA w jego kolumnie
mierzy łagodność sędziego; > 15% = punkt zatrzymania (PANEL-PLAN §10) — czytanie próbki 10 ocen tej kolumny.
"""
import collections
import json
import random
import sys
from pathlib import Path

# argv[1] (opcjonalnie) = przyrostek wariantu runu, np. '-medium' -> panel-run2-sedzia-medium.json -> panel-pokrycie-medium.*
WARIANT = sys.argv[1] if len(sys.argv) > 1 else ''
BAZA = Path(__file__).resolve().parent.parent
SEDZIA = BAZA / 'dane' / f'panel-run2-sedzia{WARIANT}.json'
MAPA = BAZA / 'dane' / 'panel-run2-mapowanie.json'
ZESTAW = BAZA / 'dane' / 'panel-zestaw-historyczny.jsonl'
WYJ_TXT = BAZA / 'dane' / f'panel-pokrycie{WARIANT}.txt'
WYJ_JSON = BAZA / 'dane' / f'panel-pokrycie{WARIANT}.json'

PROJEKTY = ['0', 'A', 'B', 'C']
KAT = ['BRAMKA', 'LISTA', 'E2E', 'WIEDZA', 'PROBKI', 'MANDAT', 'NIE']
SILA = {k: i for i, k in enumerate(KAT)}
PROG_KALIBRACJI = 0.15
MOCNE = {'BRAMKA', 'LISTA'}


def wczytaj():
    sedzia = json.loads(SEDZIA.read_text())
    mapa = json.loads(MAPA.read_text())
    zestaw = {x['id']: x for x in (json.loads(l) for l in ZESTAW.open())}
    oceny, trudne, bledy = {}, [], []
    for etykieta, wynik in sedzia.items():
        porcja = etykieta.split(':')[1].split(' ')[0]
        if not wynik:
            bledy.append(f'{porcja}: brak wyniku')
            continue
        m = mapa[porcja]
        for o in wynik['oceny']:
            rec = {}
            for et, kol in o['kolumny'].items():
                proj = m[et]['projekt']
                mid = kol['mechanizm_id']
                orig = m[et]['id'].get(mid)
                if mid and orig is None:
                    bledy.append(f'{porcja} {o["id_przypadku"]} {et}: mechanizm_id {mid!r} spoza katalogu')
                rec[proj] = dict(kol, mechanizm_id=orig or mid, etykieta=et, porcja=porcja)
            oceny[o['id_przypadku']] = rec
        trudne += [dict(t, porcja=porcja) for t in wynik['trudne']]
    return oceny, trudne, bledy, zestaw


def profil(ids, oceny, proj):
    c = collections.Counter(oceny[i][proj]['kategoria'] for i in ids if i in oceny)
    n = sum(c.values())
    return c, n


def wiersz(nazwa, ids, oceny):
    out = []
    for p in PROJEKTY:
        c, n = profil(ids, oceny, p)
        bl = c['BRAMKA'] + c['LISTA']
        ble = bl + c['E2E']
        blew = ble + c['WIEDZA']
        out.append(f'    {p}: n {n:3d}  BRAMKA {c["BRAMKA"]:3d} LISTA {c["LISTA"]:3d} E2E {c["E2E"]:2d} WIEDZA {c["WIEDZA"]:3d} '
                   f'PROBKI {c["PROBKI"]:2d} MANDAT {c["MANDAT"]:3d} NIE {c["NIE"]:3d} | B+L {100 * bl / max(n, 1):5.1f}%  '
                   f'+E2E {100 * ble / max(n, 1):5.1f}%  +WIEDZA {100 * blew / max(n, 1):5.1f}%')
    return [f'  {nazwa} ({len(ids)})'] + out


def main():
    oceny, trudne, bledy, zestaw = wczytaj()
    L = []
    Q = L.append
    efort = sorted({e.split('(')[-1].rstrip(')') for e in json.loads(SEDZIA.read_text())})
    Q(f'panel_pokrycie.py — profil pokrycia per projekt (run 2, sędzia: {", ".join(efort)})')
    Q(f'ocenionych przypadków {len(oceny)} / {len(zestaw)}; trudnych {len(trudne)}; błędów spójności {len(bledy)}')
    for b in bledy[:20]:
        Q('  BŁĄD ' + b)
    wszystkie = sorted(oceny)
    p12 = [i for i in wszystkie if zestaw[i]['waga'] in ('P1', 'P2')]
    ogon = [i for i in wszystkie if not zestaw[i]['widoczna_dla_projektantow']]
    ogon12 = [i for i in ogon if i in p12]
    wrz = [i for i in wszystkie if zestaw[i]['epoka'] == 'wrzesien']

    Q('')
    Q('=== 1. Kalibracja (projekt 0 = dzisiejszy pipeline; każdy przypadek przeszedł przez niego) ===')
    c0, n0 = profil(wszystkie, oceny, '0')
    kal = (c0['BRAMKA'] + c0['LISTA']) / max(n0, 1)
    Q(f'  projekt 0: BRAMKA+LISTA {c0["BRAMKA"] + c0["LISTA"]} / {n0} = {100 * kal:.1f}% (próg {100 * PROG_KALIBRACJI:.0f}%) -> '
      + ('PRZEKROCZONY: czytać próbkę 10 ocen kolumny 0 przed użyciem wyników (PANEL-PLAN §10)' if kal > PROG_KALIBRACJI else 'OK'))
    for por in sorted({oceny[i]['0']['porcja'] for i in wszystkie}):
        ids = [i for i in wszystkie if oceny[i]['0']['porcja'] == por]
        c, n = profil(ids, oceny, '0')
        Q(f'    {por}: {c["BRAMKA"] + c["LISTA"]}/{n} = {100 * (c["BRAMKA"] + c["LISTA"]) / max(n, 1):.1f}% (etykieta kolumny 0: {oceny[ids[0]]["0"]["etykieta"]})')
    mocne0 = [i for i in wszystkie if oceny[i]['0']['kategoria'] in MOCNE]
    random.seed(20260924)
    probka = random.sample(mocne0, min(10, len(mocne0)))
    Q('  próbka do przeczytania (kolumna 0, BRAMKA/LISTA): ' + ', '.join(probka))
    for i in probka:
        o = oceny[i]['0']
        Q(f'    {i} [{zestaw[i]["waga"]}] {zestaw[i]["streszczenie"][:110]}')
        Q(f'      -> {o["kategoria"]} {o["mechanizm_id"]} ({o["pewnosc"]}): {o["uzasadnienie"][:220]}')

    Q('')
    Q('=== 2. Profil pokrycia per projekt ===')
    for nazwa, ids in [('wszystkie', wszystkie), ('P1/P2', p12), ('ogon (klasy niewidoczne dla projektantów)', ogon),
                       ('ogon P1/P2', ogon12), ('wrzesień (PR 13–19)', wrz)]:
        L.extend(wiersz(nazwa, ids, oceny))
    Q('')
    Q('  per oś-właściciel:')
    for os_ in sorted({zestaw[i]['os_wlasciciel'] for i in wszystkie}):
        L.extend(wiersz(os_, [i for i in wszystkie if zestaw[i]['os_wlasciciel'] == os_], oceny))
    Q('')
    Q('  per rodzina (B+L% per projekt 0/A/B/C):')
    for rodz, ids in sorted(collections.defaultdict(list, {r: [i for i in wszystkie if zestaw[i]['rodzina'] == r]
                                                          for r in {zestaw[i]['rodzina'] for i in wszystkie}}).items(),
                            key=lambda kv: -len(kv[1])):
        proc = []
        for p in PROJEKTY:
            c, n = profil(ids, oceny, p)
            proc.append(f'{p} {100 * (c["BRAMKA"] + c["LISTA"]) / max(n, 1):3.0f}%')
        Q(f'    {rodz[:38]:38s} ({len(ids):2d})  ' + '  '.join(proc))

    Q('')
    Q('=== 3. Kontrola pozycji etykiety (permutacja pełna: każdy projekt raz na P/Q/R/S) ===')
    for et in 'PQRS':
        cel = [(i, p) for i in wszystkie for p in PROJEKTY if oceny[i][p]['etykieta'] == et]
        bl = sum(1 for i, p in cel if oceny[i][p]['kategoria'] in MOCNE)
        Q(f'  {et}: ocen {len(cel)}, B+L {100 * bl / max(len(cel), 1):.1f}%')

    Q('')
    Q('=== 4. Mechanizmy najczęściej rozstrzygające B+L (per projekt, top 8) ===')
    for p in PROJEKTY:
        c = collections.Counter(oceny[i][p]['mechanizm_id'] for i in wszystkie if oceny[i][p]['kategoria'] in MOCNE)
        Q(f'  {p}: ' + ', '.join(f'{m} {n}' for m, n in c.most_common(8)))

    Q('')
    Q('=== 5. Przypadki, w których projekty się różnią (B+L w jednym, nie w innym) — materiał dla sceptyków ===')
    rozne = [i for i in wszystkie if len({oceny[i][p]['kategoria'] in MOCNE for p in 'ABC'}) > 1]
    Q(f'  {len(rozne)} przypadków; B+L tylko w jednym projekcie A/B/C:')
    for p in 'ABC':
        tylko = [i for i in rozne if oceny[i][p]['kategoria'] in MOCNE and sum(oceny[i][q]['kategoria'] in MOCNE for q in 'ABC') == 1]
        Q(f'    tylko {p}: {len(tylko)} (P1/P2 {sum(1 for i in tylko if i in p12)}): ' + ', '.join(tylko[:25]))
    nikt = [i for i in wszystkie if not any(oceny[i][p]['kategoria'] in MOCNE for p in 'ABC')]
    Q(f'  żaden projekt A/B/C nie ma B+L: {len(nikt)} (P1/P2 {sum(1 for i in nikt if i in p12)})')

    Q('')
    Q('=== 7. Wariant ścisły (BRAMKA dowolna + LISTA z pewnością średnią; LISTA niska = MANDAT) — informacyjnie ===')
    for nazwa, ids in [('wszystkie', wszystkie), ('P1/P2', p12)]:
        par = []
        for p in PROJEKTY:
            n = sum(1 for i in ids if oceny[i][p]['kategoria'] == 'BRAMKA'
                    or (oceny[i][p]['kategoria'] == 'LISTA' and oceny[i][p]['pewnosc'] in ('srednia', 'wysoka')))
            par.append(f'{p} {100 * n / len(ids):5.1f}%')
        Q(f'  {nazwa} ({len(ids)}): ' + '  '.join(par))
    c = collections.Counter(oceny[i]['0']['mechanizm_id'] for i in wszystkie if oceny[i]['0']['kategoria'] == 'LISTA')
    Q('  kolumna 0, LISTA per mechanizm: ' + ', '.join(f'{m} {n}' for m, n in c.most_common()))
    poprz = BAZA / 'dane' / 'panel-pokrycie-medium.json'
    if poprz.exists() and WARIANT != '-medium':
        om = json.loads(poprz.read_text())['oceny']
        Q('  stabilność vs run 2 medium (ta sama kategoria / B+L zgodne):')
        for p in PROJEKTY:
            ta = sum(1 for i in wszystkie if om[i][p]['kategoria'] == oceny[i][p]['kategoria'])
            bl = sum(1 for i in wszystkie if (om[i][p]['kategoria'] in MOCNE) == (oceny[i][p]['kategoria'] in MOCNE))
            Q(f'    {p}: kategoria {100 * ta / len(wszystkie):.0f}%, B+L {100 * bl / len(wszystkie):.0f}%')

    Q('')
    Q(f'=== 6. Trudne przypadki ({len(trudne)}) ===')
    for t in trudne:
        Q(f'  {t["porcja"]} {t["id_przypadku"]}: {t["powod"][:200]}')

    WYJ_TXT.write_text('\n'.join(L) + '\n')
    WYJ_JSON.write_text(json.dumps({'oceny': oceny, 'trudne': trudne, 'bledy': bledy}, ensure_ascii=False, indent=1))
    print('\n'.join(L))


if __name__ == '__main__':
    main()

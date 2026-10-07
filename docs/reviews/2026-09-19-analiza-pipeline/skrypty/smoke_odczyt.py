"""Odczyt smoke'a paczki (PLAN-POPRAWY §1, P0) — run vs referencja z rekordów telemetrii i pliku harnessu (uogólnienie it1_odczyt.py).

Użycie: python3 smoke_odczyt.py <wf_id> [--ref <wf_id>] > ../dane/smoke-<paczka>.txt
Referencja domyślna = REFERENCJA = R0 (smoke P0, wf_588f7b18-d71); It. 1 = wf_031f0eae-204 (--ref).

Porównuje: status, gate i przebieg review, koszt (całość, per etap, per rola), agentów per rola, model/efort (z transkryptu —
pole `effort` rekordu agenta), ctx_start per klasa roli, zgodność szablonu, smokeStatus. Rekordy pisze hook Stop ~30 s po końcu
runu — bez rekordów skrypt kończy się błędem, nie pustym porównaniem.
P8: kontrolaFixa.listy i fix.p1_z_testem z rekordów faz; z journala runu — wpis `sprawdzono` per lista K-1…K-7 i bramki,
P3 na liście fixa (prompt agenta fix:faza-N) i agenci fix:pre-skan / verify-fix (po P8 ma ich nie być).
P9 (smoke_sceptycy.py): faza.sceptyk, agent.werdykty/obalone, verify-batch vs ⌈P2/4⌉, etykiety i błędy schematu w journalu,
wiersz sceptyków w raporcie review i „Zamkniete cyklem fix” w archiwum kopii; K-7: pozycje na plikach docs/active/<zadanie>/.
P10 (smoke_wiedza.py): learned_zn, faza.wiedza, blok „Wyuczone reguly projektu:” i wywołania wycinka w promptach plannera,
builderów i fixa, wynik compoundu (wiedza, indeks, propozycjeBramek, uwagaIndeksu).
P12 (smoke_p12.py): reguły kodu eager / Read / załącznik z `paths:` per rola, blok D10 w promptach builderów, kryterium 6a pkt 67 (d).
"""
import collections
import glob
import json
import os
import statistics
import sys

import smoke_p12
import smoke_sceptycy
import smoke_wiedza

PLIK = os.path.expanduser('~/.claude/telemetry/pipeline.jsonl')
HARNESS = os.path.expanduser('~/.claude/projects/*/*/workflows/wf_*.json')
KATALOG_RUNU = os.path.expanduser('~/.claude/projects/*/*/subagents/workflows/%s')
LISTY_K = ('K-1', 'K-2', 'K-3', 'K-4', 'K-5', 'K-6', 'K-7', 'bramki')
REFERENCJA = 'wf_588f7b18-d71'  # R0 — smoke P0 (2026-10-01): 3,92 M, 29 agentów, 13 min, gate CZYSTE


def ostatnie_rekordy(run_id):
    ostatnie = {}
    for linia in open(PLIK, encoding='utf-8'):
        r = json.loads(linia)
        if r.get('run') == run_id and isinstance(r.get('klucz'), str):
            ostatnie[r['klucz']] = r
    return list(ostatnie.values())


def dane_runu(run_id):
    rekordy = ostatnie_rekordy(run_id)
    run = next((r for r in rekordy if r['typ'] == 'run'), None)
    if run is None:
        sys.exit('BŁĄD: brak rekordu `run` dla %s w %s — hook Stop jeszcze nie zapisał albo zły identyfikator.' % (run_id, PLIK))
    pliki = [p for p in glob.glob(HARNESS) if os.path.basename(p) == run_id + '.json']
    harness = json.load(open(pliki[0], encoding='utf-8')) if pliki else {}
    return {
        'run': run,
        'fazy': sorted((r for r in rekordy if r['typ'] == 'faza'), key=lambda r: r['faza']),
        'agenci': [r for r in rekordy if r['typ'] == 'agent'],
        'harness': harness,
    }


def mln(x):
    return '%.2f M' % (x / 1e6) if isinstance(x, (int, float)) else '—'


def delta(a, b):
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)) or a == 0:
        return ''
    return '%+.0f%%' % ((b - a) / a * 100)


def wiersz(nazwa, ref, run, fmt=str, liczbowy=True):
    znak = delta(ref, run) if liczbowy else ('' if ref == run else '≠')
    print('  %-34s %-22s %-22s %s' % (nazwa, fmt(ref) if ref is not None else '—', fmt(run) if run is not None else '—', znak))


def per_rola(agenci):
    grupy = collections.defaultdict(lambda: [0, 0])
    for a in agenci:
        grupy[a['rola']][0] += 1
        grupy[a['rola']][1] += a.get('koszt_jedn') or 0
    return grupy


def ctx_per_klasa(agenci):
    grupy = collections.defaultdict(list)
    for a in agenci:
        if a.get('ctx_start'):
            grupy['%s/%s' % (a['klasa_roli'], a['model'].replace('claude-', ''))].append(a['ctx_start'])
    return {k: (len(v), round(statistics.median(v) / 1000), round(max(v) / 1000)) for k, v in grupy.items()}


def sekcja_run(ref, run):
    print('== 1. Run')
    r, s = ref['run'], run['run']
    wiersz('status', r['status'], s['status'], liczbowy=False)
    wiersz('powód STOP', r['powod'], s['powod'], liczbowy=False)
    wiersz('fazy ukończone / zadania', '%s/%s' % (r['fazyUkonczone'], r['fazyZadania']),
           '%s/%s' % (s['fazyUkonczone'], s['fazyZadania']), liczbowy=False)
    wiersz('walidacja końcowa', r['walidacja'], s['walidacja'], liczbowy=False)
    wiersz('szablon zgodny', r['szablon'].get('zgodny'), s['szablon'].get('zgodny'), liczbowy=False)
    wiersz('smokeStatus (harness)', ref['harness'].get('result', {}).get('smokeStatus'),
           run['harness'].get('result', {}).get('smokeStatus'), liczbowy=False)
    wiersz('koszt [jedn.]', r['koszt']['jedn'], s['koszt']['jedn'], mln)
    wiersz('agentów', r['koszt']['agentow'], s['koszt']['agentow'])
    wiersz('tur', r['koszt']['tur'], s['koszt']['tur'])
    wiersz('czas [min]', round(r['sekundy'] / 60), round(s['sekundy'] / 60))


def sekcja_fazy(ref, run):
    print('\n== 2. Fazy: gate, review, fix')
    for i in range(max(len(ref['fazy']), len(run['fazy']))):
        r = ref['fazy'][i] if i < len(ref['fazy']) else {}
        s = run['fazy'][i] if i < len(run['fazy']) else {}
        print(' faza %d' % (i + 1))
        wiersz('status / gate', '%s / %s' % (r.get('status'), r.get('gate')), '%s / %s' % (s.get('status'), s.get('gate')),
               liczbowy=False)
        wiersz('cykle fix', r.get('cykle'), s.get('cykle'))
        for pole in ('p1', 'p2', 'p3'):
            wiersz('potwierdzone ' + pole, (r.get('liczniki') or {}).get(pole), (s.get('liczniki') or {}).get(pole))
        for pole in ('znalezione', 'poDedupSem', 'weryfikowane', 'obalone'):
            wiersz('review ' + pole, (r.get('przebieg') or {}).get(pole), (s.get('przebieg') or {}).get(pole))
        wiersz('pominięci reviewerzy', (r.get('przebieg') or {}).get('pominieci'), (s.get('przebieg') or {}).get('pominieci'),
               liczbowy=False)
        wiersz('fix naprawione', (r.get('fix') or {}).get('naprawione'), (s.get('fix') or {}).get('naprawione'))
        wiersz('kontrola fixa: regresje', (r.get('kontrolaFixa') or {}).get('regresje'),
               (s.get('kontrolaFixa') or {}).get('regresje'))
        wiersz('kontrola fixa: listy', (r.get('kontrolaFixa') or {}).get('listy'), (s.get('kontrolaFixa') or {}).get('listy'),
               liczbowy=False)
        wiersz('fix: P1 z testem (K-6)', (r.get('fix') or {}).get('p1_z_testem'), (s.get('fix') or {}).get('p1_z_testem'))
        testy = [p['plik'] for p in ((s.get('fix') or {}).get('pliki') or []) if '.test.' in p['plik']]
        print('  %-34s %s' % ('fix dotknął testów (run)', testy or 'NIE'))
        etapy_r = (r.get('koszt') or {}).get('per_etap') or {}
        etapy_s = (s.get('koszt') or {}).get('per_etap') or {}
        wiersz('koszt fazy', (r.get('koszt') or {}).get('jedn'), (s.get('koszt') or {}).get('jedn'), mln)
        for etap in sorted(set(etapy_r) | set(etapy_s)):
            wiersz('  etap ' + etap, etapy_r.get(etap), etapy_s.get(etap), mln)


def agenci_journala(run_id):
    """[(etykieta, agentId, wynik)] z journal.jsonl runu; pusta lista, gdy katalogu runu nie ma."""
    katalogi = glob.glob(KATALOG_RUNU % run_id)
    if not katalogi:
        return [], None
    etykiety, wyniki = {}, []
    for linia in open(os.path.join(katalogi[0], 'journal.jsonl'), encoding='utf-8'):
        if not linia.strip():
            continue
        r = json.loads(linia)
        if r.get('type') == 'started':
            etykiety[r['agentId']] = r.get('label') or ''
        elif r.get('type') == 'result':
            wyniki.append((etykiety.get(r['agentId'], ''), r['agentId'], r.get('result')))
    return wyniki, katalogi[0]


def p3_w_prompcie_fixa(katalog, agent_id):
    """Liczba findingów P3 na liście „OTWARTE FINDINGI DO NAPRAWY” w poleceniu agenta fixa (transkrypt agenta)."""
    plik = os.path.join(katalog, 'agent-%s.jsonl' % agent_id)
    if not os.path.exists(plik):
        return None
    for linia in open(plik, encoding='utf-8'):
        tresc = json.loads(linia).get('message', {}).get('content')
        if isinstance(tresc, str) and 'OTWARTE FINDINGI DO NAPRAWY' in tresc:
            lista = tresc.split('OTWARTE FINDINGI DO NAPRAWY', 1)[1].split('FINDINGI Z PREFIKSEM', 1)[0]
            return lista.count('"severity": "P3"')
    return None


def sekcja_kontrola_journal(run_id, wyniki, katalog):
    print('\n== 2b. Kontrola fixa i P3 (journal runu %s)' % run_id)
    if katalog is None:
        print('  brak katalogu runu w ~/.claude/projects/*/*/subagents/workflows/')
        return
    for rola in ('fix:pre-skan', 'verify-fix'):
        print('  %-34s %d' % ('agenci ' + rola, sum(1 for e, _, _ in wyniki if e.startswith(rola + ':'))))
    for etykieta, agent_id, wynik in wyniki:
        if etykieta.startswith('scribe:') and isinstance(wynik, dict):
            p3 = sum(1 for f in wynik.get('findings') or [] if f.get('severity') == 'P3' and f.get('typ') in ('KOD', 'TEST'))
            print('  %-34s %d' % (etykieta + ': P3 KOD/TEST', p3))
        elif etykieta.startswith('fix:faza-'):
            print('  %-34s %s' % (etykieta + ': P3 na liście', p3_w_prompcie_fixa(katalog, agent_id)))
        elif etykieta.startswith('fix:kontrola:') and isinstance(wynik, dict):
            if 'listy' not in wynik:
                print('  %-34s %s' % (etykieta, 'bez list K (kontrola sprzed P8)'))
                continue
            listy = dict(wynik['listy'], bramki=wynik.get('bramki'))
            for lista in LISTY_K:
                w = listy.get(lista) or {}
                pozycje = len(w.get('testy') or []) if lista == 'K-6' else len(w.get('pozycje') or [])
                sprawdzono = (w.get('sprawdzono') or 'BRAK WPISU').replace('\n', ' ')
                print('  %-34s %-3s %s' % ('%s %s' % (etykieta, lista), pozycje, sprawdzono[:110]))
            # Poprawka K-7 z P8: katalog zadania to księgowość fixa, nie „zmiana poza findingiem”.
            ksiegowosc = [p['plik'] for p in (listy.get('K-7') or {}).get('pozycje') or [] if p.get('plik', '').startswith('docs/active/')]
            print('  %-34s %d %s' % (etykieta + ' K-7 docs/active/', len(ksiegowosc), ksiegowosc or ''))


def sekcja_role(ref, run):
    print('\n== 3. Agenci per rola: liczba, koszt')
    r, s = per_rola(ref['agenci']), per_rola(run['agenci'])
    opis = lambda g, rola: '%d × %s' % (g[rola][0], mln(g[rola][1])) if rola in g else None
    for rola in sorted(set(r) | set(s)):
        wiersz(rola, opis(r, rola), opis(s, rola), liczbowy=False)
        if rola in r and rola in s:
            print('  %-34s %s' % ('  Δ koszt', delta(r[rola][1], s[rola][1])))


def sekcja_model(ref, run):
    print('\n== 4. Model / efort (transkrypt)')
    licz = lambda agenci: collections.Counter('%s/%s' % (a['model'].replace('claude-', ''), a['effort']) for a in agenci)
    r, s = licz(ref['agenci']), licz(run['agenci'])
    for klucz in sorted(set(r) | set(s)):
        wiersz(klucz, r.get(klucz, 0), s.get(klucz, 0))
    print('\n== 5. ctx_start per klasa/model: n, p50 [k], max [k]')
    r, s = ctx_per_klasa(ref['agenci']), ctx_per_klasa(run['agenci'])
    for klasa in sorted(set(r) | set(s)):
        wiersz(klasa, r.get(klasa), s.get(klasa), liczbowy=False)
        if klasa in r and klasa in s:
            print('  %-34s %s' % ('  Δ p50', delta(r[klasa][1], s[klasa][1])))


def main(argumenty):
    if len(argumenty) not in (1, 3) or (len(argumenty) == 3 and argumenty[1] != '--ref'):
        sys.exit('Użycie: smoke_odczyt.py <wf_id> [--ref <wf_id>]')
    run_id, ref_id = argumenty[0], argumenty[2] if len(argumenty) == 3 else REFERENCJA
    ref, run = dane_runu(ref_id), dane_runu(run_id)
    print('Smoke: %s (projekt %s) vs referencja %s (projekt %s)' % (run_id, run['run']['projekt'], ref_id, ref['run']['projekt']))
    print('  %-34s %-22s %-22s %s' % ('metryka', 'referencja', 'run', 'Δ'))
    sekcja_run(ref, run)
    sekcja_fazy(ref, run)
    wyniki, katalog = agenci_journala(run_id)
    sekcja_kontrola_journal(run_id, wyniki, katalog)
    smoke_sceptycy.sekcja_sceptycy(ref, run, wiersz)
    smoke_sceptycy.sekcja_sceptycy_journal(wyniki, katalog)
    smoke_sceptycy.sekcja_kopia(wyniki, katalog, run['run']['zadanie'])
    smoke_wiedza.sekcja_wiedza(ref, run, wiersz)
    smoke_wiedza.sekcja_wiedza_journal(wyniki, katalog)
    smoke_wiedza.sekcja_compound(run)
    smoke_p12.sekcja_p12(run, wyniki, katalog)
    sekcja_role(ref, run)
    sekcja_model(ref, run)


if __name__ == '__main__':
    main(sys.argv[1:])

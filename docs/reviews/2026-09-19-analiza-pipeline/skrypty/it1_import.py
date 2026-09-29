#!/usr/bin/env python3
"""It. 1 krok 10 — jednorazowy import historii BEZ zrodla maszynowego do ~/.claude/telemetry/pipeline.jsonl (v = 0, zrodlo = import).

(a) dane/coderabbit/klasyfikacja-574.csv → typ `pr` (jeden rekord na PR oferty-online, 19 PR): klasy uwag przez slownik It. 1
    (dane/it1-slownik-klas.csv + dane/it1-slownik-nadpisania.csv), `pliki` = changedFiles z gh (tylko odczyt; lista zapisana do
    dane/it1-pr-oferty.json przed importem), zadanie = galaz PR bez prefiksu feature/. Typ `pr`, a nie `run.pr`: jeden PR obejmuje
    kilka runow dev-pr, a historyczna klasyfikacja jest per PR (unikalne watki).
(b) stara telemetria: ~/.claude/telemetry/autopilot-runs.odzyskane-2026-09-19.jsonl (32) + autopilot-runs.jsonl (8) + dane/
    telemetria-odzyskana-wszystko.json (33) → typ `run_v0`, klucz import|run_v0|projekt|zadanie|ts (stare wpisy nie maja wf_);
    deduplikacja po kluczu.
agents.csv i skille.csv NIE sa importowane (decyzja O2 — pelny skan zrodel; te pliki sa testem akceptacyjnym krokow 1 i 4).
Idempotentny: rekord z istniejacym kluczem nie jest dopisywany. Zapis pod tym samym zamkiem co zbierz.mjs (katalog <plik>.zamek).
Uzycie: python3 skrypty/it1_import.py [--plik <jsonl>] → dane/it1-import.txt
"""
import csv, datetime, json, os, subprocess, sys, time

sys.dont_write_bytecode = True
BAZA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DANE = os.path.join(BAZA, 'dane')
TELEMETRIA = os.path.expanduser('~/.claude/telemetry')
PLIK = sys.argv[sys.argv.index('--plik') + 1] if '--plik' in sys.argv else os.path.join(TELEMETRIA, 'pipeline.jsonl')
REPO_OFERTY = os.path.expanduser('~/Documents/Kodowanie/oferty-online')
PROJEKT = 'oferty-online'
LIMIT_CZEKANIA_NA_ZAMEK_S = 60


def czytaj_csv(nazwa):
    return list(csv.DictReader(open(os.path.join(DANE, nazwa))))


def metadane_pr(numery):
    """changedFiles i galaz PR z gh — cache w dane/it1-pr-oferty.json (drugi import nie pyta sieci)."""
    cache = os.path.join(DANE, 'it1-pr-oferty.json')
    meta = json.load(open(cache)) if os.path.exists(cache) else {}
    for n in numery:
        if str(n) in meta:
            continue
        out = subprocess.run(['gh', 'pr', 'view', str(n), '--json', 'number,changedFiles,headRefName,mergedAt,createdAt'],
                             cwd=REPO_OFERTY, capture_output=True, text=True, check=True).stdout
        meta[str(n)] = json.loads(out)
    json.dump(meta, open(cache, 'w'), ensure_ascii=False, indent=1)
    return meta


def rekordy_pr(ts):
    uwagi = czytaj_csv(os.path.join('coderabbit', 'klasyfikacja-574.csv'))
    mapa = {r['stara']: (r['nowa'], r['os']) for r in czytaj_csv('it1-slownik-klas.csv')}
    nadpisania = {(r['pr'], r['id']): r['nowa'] for r in czytaj_csv('it1-slownik-nadpisania.csv')}
    osie = {nowa: os_ for nowa, os_ in mapa.values()}
    numery = sorted({int(u['pr']) for u in uwagi})
    meta = metadane_pr(numery)
    rekordy = []
    for n in numery:
        m = meta[str(n)]
        klasy = []
        for u in (u for u in uwagi if int(u['pr']) == n):
            nowa = nadpisania.get((u['pr'], u['id']), mapa[u['klasa']][0])
            klasy.append(dict(id=f"import-{n}-{u['id']}", klasa=nowa, severity=u['severity'], plik=u['plik'], os=osie[nowa],
                              koszyk=u['koszyk'], stara_klasa=u['klasa'], ma_regule=None))
        wagi = [k['severity'] for k in klasy]
        rekordy.append(dict(v=0, ts=ts, typ='pr', zrodlo='import', projekt=PROJEKT, numer=n, zadanie=m['headRefName'].removeprefix('feature/'),
                            start=m['createdAt'], merge=m.get('mergedAt'), pliki=m['changedFiles'], uwagi_razem=len(klasy),
                            p1=wagi.count('P1'), p2=wagi.count('P2'), p3=wagi.count('P3'),
                            # Miara jakosci mapy walidacji: koszyk B (nasz review powinien byl zlapac) P1/P2 — jak d5b-baseline-jakosci.txt.
                            b_p1p2=sum(1 for k in klasy if k['koszyk'] == 'B' and k['severity'] in ('P1', 'P2')), klasy=klasy, klucz=f'import|pr|{PROJEKT}#{n}'))
    return rekordy


def rekordy_v0(ts):
    zrodla = [os.path.join(TELEMETRIA, 'autopilot-runs.odzyskane-2026-09-19.jsonl'), os.path.join(TELEMETRIA, 'autopilot-runs.jsonl')]
    wpisy = []
    for z in zrodla:
        if os.path.exists(z):
            wpisy += [json.loads(l) for l in open(z) if l.strip()]
    wpisy += json.load(open(os.path.join(DANE, 'telemetria-odzyskana-wszystko.json')))
    wynik = {}
    for w in wpisy:
        klucz = f"import|run_v0|{w.get('projekt', '?')}|{w.get('zadanie', '?')}|{w.get('ts', '?')}"
        wynik.setdefault(klucz, dict(w, v=0, ts_importu=ts, typ='run_v0', zrodlo='import', start=w.get('ts'), klucz=klucz))
    return list(wynik.values()), len(wpisy)


def z_zamkiem(praca):
    zamek = PLIK + '.zamek'
    koniec = time.time() + LIMIT_CZEKANIA_NA_ZAMEK_S
    while True:
        try:
            os.mkdir(zamek)
            break
        except FileExistsError:
            if time.time() > koniec:
                sys.exit(f'zamek {zamek} zajety dluzej niz {LIMIT_CZEKANIA_NA_ZAMEK_S} s — skan w toku? ponow pozniej')
            time.sleep(1)
    try:
        return praca()
    finally:
        os.rmdir(zamek)


def main():
    ts = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    pr = rekordy_pr(ts)
    v0, wejsc = rekordy_v0(ts)

    def dopisz():
        istniejace = set()
        if os.path.exists(PLIK):
            for l in open(PLIK):
                try:
                    istniejace.add(json.loads(l).get('klucz'))
                except json.JSONDecodeError:
                    continue
        nowe = [r for r in pr + v0 if r['klucz'] not in istniejace]
        if nowe:
            with open(PLIK, 'a') as f:
                f.write(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in nowe))
        return len(nowe)

    dopisanych = z_zamkiem(dopisz)
    klasy = [k for r in pr for k in r['klasy']]
    spoza = [k for k in klasy if not k['klasa']]
    out = ['It. 1 krok 10 — import historii bez zrodla maszynowego (%s)' % ts[:10],
           f'(a) PR oferty-online: {len(pr)} rekordow typ pr; uwag {len(klasy)} (oczekiwane 574); klas spoza slownika: {len(spoza)}; '
           f'pliki PR z gh: min {min(r["pliki"] for r in pr)}, max {max(r["pliki"] for r in pr)}',
           f'    B P1/P2 na 100 plikow (miara mapy walidacji; tlo — baseline porownan = B0): ' +
           ', '.join(f'#{r["numer"]} {100 * r["b_p1p2"] / r["pliki"]:.1f}' for r in pr),
           f'    kontrola vs d5b-baseline-jakosci.txt (17 PR pipeline\'u, bez #12 i #18): '
           f'{100 * sum(r["b_p1p2"] for r in pr if r["numer"] not in (12, 18)) / sum(r["pliki"] for r in pr if r["numer"] not in (12, 18)):.1f} '
           f'na 100 plikow (wzorzec 6.7)',
           f'(b) stara telemetria: {wejsc} wpisow z 3 zrodel → {len(v0)} unikalnych run_v0 (klucz projekt|zadanie|ts)',
           f'Dopisanych do {PLIK}: {dopisanych} (0 przy ponownym uruchomieniu)',
           '→ ' + ('ZALICZONE' if len(klasy) == 574 and not spoza and len(pr) == 19 else 'NIEZALICZONE')]
    open(os.path.join(DANE, 'it1-import.txt'), 'w').write('\n'.join(out) + '\n')
    print('\n'.join(out))


if __name__ == '__main__':
    main()

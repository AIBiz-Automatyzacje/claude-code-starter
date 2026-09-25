#!/usr/bin/env python3
"""Plan testu review (HANDOFF 6a pkt 28): skąd pochodzi każda uwaga B i na jakiej fazie da się ją odtworzyć.

Dla każdego z 195 przypadków (dane/panel-zestaw-historyczny.jsonl):
 1. wątek bota (dane/coderabbit/bot-comments.jsonl — dopasowanie po początku treści) -> komentarz z pr-N-review-comments.json
    -> original_commit_id + original_start_line..original_line (linia, na którą bot patrzył);
 2. git blame tych linii na commicie bota w oferty-online (tylko odczyt) -> commit, który je wprowadził;
    decyduje najpóźniejszy commit wśród nietrywialnych linii zakresu (defekt istnieje w całości dopiero wtedy);
    commit „pakujący” (część serwerowa PR-ów dzielonych) -> ten sam fragment w ostatniej wersji pliku na gałęzi fazowej i blame tam;
 3. klasa pochodzenia commitu po temacie: faza (execute), fix-review (poprawki po review fazy), kontrola, pr-tura (poprawki po
    recenzji bota), poza-pipeline (smoke, ręczne poprawki operatora, porządki);
 4. dla pochodzenia „faza”: faza = najbliższy commit potomny „poprawki po review fazy N” na tej samej linii historii;
    stan PRZED review = jego rodzic; baza fazy = ostatni commit poprzedniej grupy review (fix-review / kontrola) albo
    merge-base z main.
Wyjście: dane/test-review-fazy.json (przypadki + fazy) i dane/test-review-fazy.txt (podsumowanie).
Repo oferty-online tylko czytane (git blame / log / rev-list / show).
"""
import collections
import json
import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = '/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online'
ZESTAW = os.path.join(BASE, 'dane', 'panel-zestaw-historyczny.jsonl')
BOT = os.path.join(BASE, 'dane', 'coderabbit', 'bot-comments.jsonl')
RC = os.path.join(BASE, 'dane', 'coderabbit', 'pr-{}-review-comments.json')
OUT_JSON = os.path.join(BASE, 'dane', 'test-review-fazy.json')
OUT_TXT = os.path.join(BASE, 'dane', 'test-review-fazy.txt')

RE_FIX_REVIEW = re.compile(r'poprawki po review fazy (\d+)', re.I)
RE_KONTROLA = re.compile(r'kontrola diffu naprawczego fazy (\d+)', re.I)
RE_PR_TURA = re.compile(r'fix\(pr\)|review coderabbit|coderabbita|uwag[ai]? z (drugiego |trzeciego |drugiej rundy )?review|'
                        r'po review pr|druga runda review|re-review|po review bota|tura \d po review pr', re.I)
RE_POZA = re.compile(r'smoke|po powt[oó]rce|decyzje operatora|chore\(dashboard\): tura porz|^fix\(db\)|^fix\(server\)|'
                     r'^fix\(dashboard\)|^fix\(oferta\)|^fix\(compare|^fix\(claude\)|^chore\(claude|^chore\(agents|^chore\(coderabbit', re.I)
RE_PAKUJACY = re.compile(r'część serwerowa|\(#\d+\)$|^merge|^Merge', re.I)


def git(*a):
    return subprocess.run(['git', '-C', REPO, *a], capture_output=True, text=True).stdout


def temat(c):
    return git('log', '-1', '--format=%s', c).strip()


def klasa_commitu(s):
    if RE_PAKUJACY.search(s):
        return 'pakujacy'
    if RE_KONTROLA.search(s):
        return 'kontrola'
    if RE_FIX_REVIEW.search(s):
        return 'fix-review'
    if RE_PR_TURA.search(s):
        return 'pr-tura'
    if RE_POZA.search(s):
        return 'poza-pipeline'
    if re.match(r'^(feat|test|ui|chore)\(', s):
        return 'faza'
    return 'poza-pipeline'


def norm(t):
    t = re.sub(r'<details>.*?</details>', ' ', t or '', flags=re.S)
    return re.sub(r'\s+', ' ', t).strip()


def watek_bota(przypadek, bot):
    """Wątek po początku treści (tresc_bota = pierwsze 900 zn wątku bez zwiniętych bloków — porównanie po normalizacji
    białych znaków); bez treści (dopasowanie niejednoznaczne) — po pliku i linii z CSV (|Δ| ≤ 3)."""
    glowne = [b for b in bot if b['pr'] == przypadek['pr'] and b['in_reply_to'] is None]
    t = norm(przypadek.get('tresc_bota'))[:150]
    if t:
        kand = [b for b in glowne if norm(b['body']).startswith(t)]
        if len(kand) == 1:
            return kand[0]
    m = re.match(r'^(.*?):(\d+)', przypadek['plik'])
    if m:
        kand = [b for b in glowne if b['path'] == m.group(1) and abs((b['line'] or 0) - int(m.group(2))) <= 3]
        if len(kand) == 1:
            return kand[0]
    return None


def blame(commit, sciezka, od, do):
    wyj = git('blame', '-w', '--porcelain', '-L', '{},{}'.format(od, do), commit, '--', sciezka)
    commity, linie, biezacy = [], [], None
    for w in wyj.splitlines():
        m = re.match(r'^([0-9a-f]{40}) \d+ \d+', w)
        if m:
            biezacy = m.group(1)
        elif w.startswith('\t') and biezacy:
            commity.append(biezacy)
            linie.append(w[1:])
    return commity, linie


def pochodzenie_przez_pakujacy(pakujacy, sciezka, od, do, commit_bota):
    """Commit pakujący (część serwerowa) niesie cały plik z gałęzi fazowej. Biorę ostatni commit gałęzi fazowej, który
    dotknął pliku przed pakującym (--full-history: merge'e inaczej chowają gałąź boczną), znajduję w jego wersji ten sam
    fragment (linie od..do z commitu bota, dopasowanie tekstu całego zakresu) i robię blame tam."""
    granica = int(git('log', '-1', '--format=%ct', pakujacy).strip())
    fragment = git('show', commit_bota + ':' + sciezka).splitlines()[od - 1:do]
    for w in git('log', '--all', '--full-history', '--format=%H %ct %s', '--', sciezka).splitlines():
        h, t, s = w.split(' ', 2)
        if int(t) > granica or h.startswith(pakujacy[:10]) or klasa_commitu(s) in ('pakujacy', 'pr-tura') or s.startswith('Merge'):
            continue
        tresc = git('show', h + ':' + sciezka).splitlines()
        trafienia = [i for i in range(len(tresc) - len(fragment) + 1) if [x.strip() for x in tresc[i:i + len(fragment)]] == [x.strip() for x in fragment]]
        if len(trafienia) == 1:
            i = trafienia[0] + 1
            commity, linie = blame(h, sciezka, i, i + len(fragment) - 1)
            return (commity[-1] if commity else None), h
        return None, h
    return None, None


def dzieci_mapa(dodatkowe):
    """--all plus commity bota: gałęzie części PR-ów (np. samodzielna rejestracja) są skasowane, ale ich commity są w repo."""
    m = collections.defaultdict(list)
    for w in git('rev-list', '--children', '--all', *dodatkowe).splitlines():
        cz = w.split()
        m[cz[0]] = cz[1:]
    return m


def tylko_maszyneria(c):
    pliki = git('show', '--name-only', '--format=', c).split()
    return bool(pliki) and all(p.startswith(('.claude/', 'docs/')) for p in pliki)


def faza_dla(commit, dzieci):
    """Przeszukanie potomków wszerz do najbliższego „poprawki po review fazy N”; przerywa gałąź na recenzji bota, commicie
    pakującym i poprawce spoza pipeline'u (commity dotykające tylko .claude/ i docs/ przepuszcza — sync maszynerii w trakcie runu)."""
    kolejka, widziane = [(commit, 0)], set()
    while kolejka:
        c, gl = kolejka.pop(0)
        for d in dzieci.get(c, []):
            if d in widziane or gl > 40:
                continue
            widziane.add(d)
            s = temat(d)
            m = RE_FIX_REVIEW.search(s)
            if m:
                return {'fix_commit': d[:10], 'numer': int(m.group(1)), 'przed_review': git('rev-parse', d + '^').strip()[:10]}
            if s.lower().startswith('merge') or klasa_commitu(s) in ('pr-tura', 'pakujacy'):
                continue
            if klasa_commitu(s) == 'poza-pipeline' and not tylko_maszyneria(d):
                continue
            kolejka.append((d, gl + 1))
    return None


def baza_fazy(przed_review):
    """Ostatni commit poprzedniej grupy review (fix-review/kontrola) na pierwszej linii rodziców."""
    for w in git('log', '--first-parent', '--format=%h %s', przed_review).splitlines()[1:]:
        h, s = w.split(' ', 1)
        if RE_FIX_REVIEW.search(s) or RE_KONTROLA.search(s) or s.startswith('Merge pull request') or re.search(r'\(#\d+\)$', s):
            return h
    return None


def przypisz(wprowadzil, dzieci, fazy, p, sciezka, linia):
    """Klasa pochodzenia commitu i (dla „faza”) klucz fazy = stan przed review; rejestruje fazę i przypadek w `fazy`."""
    kl = klasa_commitu(temat(wprowadzil))
    if kl != 'faza':
        return kl, None
    f = faza_dla(wprowadzil, dzieci)
    if not f:
        return 'faza-bez-review', None
    klucz = f['przed_review']
    if klucz not in fazy:
        f['baza'] = baza_fazy(klucz)
        zakres = (f['baza'] or klucz + '^') + '..' + klucz
        pliki = git('diff', '--name-only', zakres).split()
        kod = [x for x in pliki if re.search(r'\.(ts|tsx|js|jsx|mjs|cjs|sql)$', x)]
        f.update({'temat_fix': temat(f['fix_commit'])[:100], 'pliki': len(pliki), 'pliki_kodu': len(kod),
                  'linie_diff': sum(int(a) + int(b) for a, b, *_ in (l.split('\t') for l in git('diff', '--numstat', zakres, '--', *kod).splitlines())
                                    if a != '-'),
                  'pr': set(), 'przypadki': [], 'obecnosc': {}})
        fazy[klucz] = f
    if p['id'] not in fazy[klucz]['przypadki']:
        fazy[klucz]['przypadki'].append(p['id'])
        fazy[klucz]['pr'].add(p['pr'])
        # czy linia kotwicy istnieje w stanie przed review (warunek konieczny widoczności defektu dla reviewera fazy)
        fazy[klucz]['obecnosc'][p['id']] = linia.strip() in git('show', klucz + ':' + sciezka)
    return kl, klucz


def main():
    przypadki = [json.loads(l) for l in open(ZESTAW)]
    bot = [json.loads(l) for l in open(BOT)]
    rc = {}
    for pr in range(1, 21):
        try:
            for c in json.load(open(RC.format(pr))):
                rc[str(c['id'])] = c
        except FileNotFoundError:
            pass
    dzieci = dzieci_mapa(sorted({c['original_commit_id'] for c in rc.values()} | {c['commit_id'] for c in rc.values()}))
    wynik, fazy = [], {}
    for p in przypadki:
        w = watek_bota(p, bot)
        rek = {'id': p['id'], 'pr': p['pr'], 'waga': p['waga'], 'os': p['os_wlasciciel'], 'epoka': p['epoka'],
               'rodzina': p['rodzina'], 'ogon': not p['widoczna_dla_projektantow'], 'plik_csv': p['plik']}
        k = rc.get(str(w['id'])) if w else None
        if not k:
            rek['pochodzenie'] = 'brak-watku'
            wynik.append(rek)
            continue
        sciezka = k['path']
        do = int(k.get('original_line') or k.get('line') or 0)
        od = int(k.get('original_start_line') or do)
        commit_bota = k['original_commit_id']
        rek.update({'sciezka': sciezka, 'linie_bota': [od, do], 'commit_bota': commit_bota[:10]})
        commity, linie = blame(commit_bota, sciezka, od, do)
        if not commity:
            rek['pochodzenie'] = 'blame-pusty'
            wynik.append(rek)
            continue
        # Dwie reguły przypisania (heurystyki — obie do raportu, klucz fazy = suma, obecność defektu rozstrzyga sędzia):
        #  ścisła: defekt istnieje w całości dopiero, gdy istnieją wszystkie linie zakresu bota -> najpóźniejszy commit wśród
        #          linii nietrywialnych (bez samych nawiasów/pustych);
        #  luźna:  linia kotwicy bota (ostatnia w zakresie).
        nietryw = [c for c, l in zip(commity, linie) if len(l.strip()) > 3] or commity
        scisly = max(set(nietryw), key=lambda c: int(git('log', '-1', '--format=%ct', c).strip()))
        rek['mieszane'] = len({klasa_commitu(temat(c)) for c in set(nietryw)}) > 1
        for regula, wprowadzil in (('scisla', scisly), ('luzna', commity[-1])):
            if klasa_commitu(temat(wprowadzil)) == 'pakujacy':
                zrodlo, wersja = pochodzenie_przez_pakujacy(wprowadzil, sciezka, od, do, commit_bota)
                rek['przez_pakujacy'] = {'pakujacy': wprowadzil[:10], 'wersja_fazowa': (wersja or '')[:10]}
                wprowadzil = zrodlo or wprowadzil
            kl, klucz = przypisz(wprowadzil, dzieci, fazy, p, sciezka, linie[-1])
            rek[regula] = {'commit': wprowadzil[:10], 'temat': temat(wprowadzil)[:120], 'pochodzenie': kl, 'faza': klucz}
        rek.update({'pochodzenie': rek['scisla']['pochodzenie'], 'faza': rek['scisla']['faza'],
                    'faza_luzna': rek['luzna']['faza'], 'linia_bota_tekst': linie[-1].strip()[:200]})
        wynik.append(rek)

    for f in fazy.values():
        f['pr'] = sorted(f['pr'])
    json.dump({'przypadki': wynik, 'fazy': fazy}, open(OUT_JSON, 'w'), ensure_ascii=False, indent=1)
    raport(wynik, fazy)


def raport(wynik, fazy):
    o = []
    o.append('test_review_fazy.py — pochodzenie 195 uwag B i fazy do odtworzenia (oferty-online tylko czytane)\n')
    c = collections.Counter(r['pochodzenie'] for r in wynik)
    o.append('pochodzenie zakresu linii wskazanego przez bota: ' + ', '.join('{} {}'.format(k, v) for k, v in c.most_common()))
    o.append('zakres z liniami różnego pochodzenia (flaga mieszane): {} (w tym z fazą: {})'.format(
        sum(1 for r in wynik if r.get('mieszane')), sum(1 for r in wynik if r.get('mieszane') and r.get('faza'))))
    fz = [r for r in wynik if r.get('faza')]
    luz = [r for r in wynik if r.get('faza_luzna')]
    suma_ = [r for r in wynik if r.get('faza') or r.get('faza_luzna')]
    rozne = [r for r in wynik if r.get('faza') and r.get('faza_luzna') and r['faza'] != r['faza_luzna']]
    o.append('przypadki z fazą pipeline\'u: reguła ścisła {}, luźna {}, suma (kandydaci do klucza) {}; obie z fazą, ale różną: {}'.format(
        len(fz), len(luz), len(suma_), len(rozne)))
    o.append('linia kotwicy obecna w stanie przed review przypisanej fazy: {}/{} par (przypadek, faza)'.format(
        sum(sum(f['obecnosc'].values()) for f in fazy.values()), sum(len(f['obecnosc']) for f in fazy.values())))
    fz = suma_
    for nazwa, f in (('P1/P2', lambda r: r['waga'] in ('P1', 'P2')), ('ogon', lambda r: r['ogon']), ('wrzesień', lambda r: r['epoka'] == 'wrzesien')):
        o.append('  {}: wszystkie {} -> z fazą {}'.format(nazwa, sum(map(f, wynik)), sum(map(f, fz))))
    o.append('  per oś (wszystkie -> z fazą): ' + ', '.join('{} {}->{}'.format(k, v, sum(1 for r in fz if r['os'] == k))
                                                        for k, v in collections.Counter(r['os'] for r in wynik).most_common()))
    o.append('\nfazy z przypadkami: {}'.format(len(fazy)))
    for k, f in sorted(fazy.items(), key=lambda x: -len(x[1]['przypadki'])):
        rr = [r for r in wynik if k in (r.get('faza'), r.get('faza_luzna'))]
        o.append('  {} PR {} faza {} | przypadki {} (P1/P2 {}, ogon {}, wrzesień {}) | pliki {} / kodu {} / linie {} | baza {} | {}'.format(
            k, f['pr'], f['numer'], len(rr), sum(r['waga'] in ('P1', 'P2') for r in rr), sum(r['ogon'] for r in rr),
            sum(r['epoka'] == 'wrzesien' for r in rr), f['pliki'], f['pliki_kodu'], f['linie_diff'], f['baza'], f['temat_fix'][:60]))
    nk = [r for r in wynik if not (r.get('faza') or r.get('faza_luzna'))]
    o.append('\nPOZA KLUCZEM (żadna reguła nie daje fazy): {} (P1/P2 {}); P1 w kluczu {} z {}; pochodzenie: {}'.format(
        len(nk), sum(r['waga'] in ('P1', 'P2') for r in nk), sum(r['waga'] == 'P1' for r in fz), sum(r['waga'] == 'P1' for r in wynik),
        ', '.join('{} {}'.format(k, v) for k, v in collections.Counter(r['pochodzenie'] for r in nk).most_common())))
    o.append('W KLUCZU: {} przypadków (tylko reguła luźna: {}); rodziny: {}'.format(len(fz), sum(1 for r in fz if not r.get('faza')),
        ', '.join('{} {}'.format(k, v) for k, v in collections.Counter(r['rodzina'] for r in fz).most_common())))
    o.append('\npoza fazą wg reguły ścisłej (per pochodzenie, PR):')
    for kl in sorted({r['pochodzenie'] for r in wynik} - {'faza'}):
        rr = [r for r in wynik if r['pochodzenie'] == kl]
        o.append('  {} {}: PR {}'.format(kl, len(rr), dict(collections.Counter(r['pr'] for r in rr))))
    open(OUT_TXT, 'w').write('\n'.join(o) + '\n')
    print('\n'.join(o))


if __name__ == '__main__':
    sys.exit(main())

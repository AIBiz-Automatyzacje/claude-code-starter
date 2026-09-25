#!/usr/bin/env python3
"""Plan testu review — klucz 2 „znane trafienia”: findingi P1/P2 (KOD/TEST), które historyczne review fazy znalazło i które przeszły
weryfikację (raport docs/completed/<zadanie>/review-faza-N.md w oferty-online, odczyt `git show HEAD:`). Klucz 1 (uwagi B bota) mierzy,
czy wariant łapie to, co dziś uciekło; klucz 2 — czy wariant nie gubi tego, co dziś łapiemy (selekcja klucza 1 faworyzuje warianty
nowe, klucza 2 — dzisiejszy). Wejście: dane/test-review-fazy.json. Wyjście: dane/test-review-klucz2.{txt,json}."""
import json
import os
import re
import subprocess

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = '/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online'
FAZY = os.path.join(BASE, 'dane', 'test-review-fazy.json')
OUT_TXT = os.path.join(BASE, 'dane', 'test-review-klucz2.txt')
OUT_JSON = os.path.join(BASE, 'dane', 'test-review-klucz2.json')

# zakres tematu commitu fixa -> katalog zadania w docs/completed
ZADANIA = [('faza-1', 'faza-1-fundament'), ('faza-2', 'faza-2-publikacja-ofert'), ('faza-3', 'faza-3-konto-i-dashboard'),
           ('faza-4', 'faza-4-tracking-i-widok-oferty'), ('faza-5', 'faza-5-heatmapa'), ('siatka', 'siatka-heatmapy-proporcjonalna'),
           ('faza-6', 'faza-6-cta-i-webhooki'), ('faza-7', 'faza-7-szablony-i-grafiki'), ('faza 8', 'faza-8-connector-oauth-i-dashboard'),
           ('faza-9a', 'faza-9a-domena-mailer-limity'), ('faza-9b', 'faza-9b-wielu-uzytkownikow'), ('faza-9c', 'faza-9c-dokumenty-prawne'),
           ('samodzielna', 'samodzielna-rejestracja-czlonkow-aa')]


def git(*a):
    return subprocess.run(['git', '-C', REPO, *a], capture_output=True, text=True).stdout


def zadanie(temat_fix):
    m = re.match(r'^fix\(([^)]*)\)', temat_fix)
    zakres = m.group(1) if m else ''
    for pref, kat in ZADANIA:
        if zakres.startswith(pref):
            return kat
    return None


RE_POZ = re.compile(r'[`*]{1,2}([\w./@-]+\.[a-z]{1,5}(?::\d+)?)[`*]{1,2}')


def findingi_p12(raport):
    """Pozycje P1/P2 typu KOD/TEST po weryfikacji. Raporty mają kilka formatów (nagłówek ####/###, lista numerowana, lista
    z checkboxem, plik w backtickach albo pogrubieniu), więc: waga pozycji = waga w jej wierszu, a gdy brak — waga bieżącej
    sekcji (nagłówek z P1/P2/P3); pozycja = wiersz nagłówka lub listy z `plik.ext[:linia]`; pomijane: OPERATOR, E2E, sekcje
    obalonych, statystyk i bookkeepingu, wiersze tabel."""
    wyn, sekcja, pomin = [], None, False
    for w in raport.splitlines():
        if w.startswith('#'):
            s = w.lower()
            pomin = any(x in s for x in ('obalon', 'statyst', 'bookkeeping', 'operator', 'werdykt', 'rozkład', 'pliki'))
            m = re.findall(r'\bp([123])\b', s)
            if len(set(m)) == 1:
                sekcja = m[0]
            elif m or 'findingi' in s or 'findings' in s:
                sekcja = None if len(set(m)) > 1 else sekcja
            if not RE_POZ.search(w):
                continue
        if pomin or w.lstrip().startswith('|'):
            continue
        if not re.match(r'^\s*(#{2,5} |[-*] |\d+\. )', w):
            continue
        poz = RE_POZ.search(w)
        if not poz or 'OPERATOR' in w or re.search(r'\bE2E\b', w[:60]):
            continue
        waga = re.search(r'\bP([123])\b', w)
        wg = waga.group(1) if waga else sekcja
        if wg in ('1', '2'):
            wyn.append({'waga': 'P' + wg, 'plik': poz.group(1), 'wiersz': w.strip()[:160]})
    return wyn


def main():
    d = json.load(open(FAZY))
    o = ['test_review_klucz2.py — klucz 2: potwierdzone P1/P2 historycznego review fazy (raporty docs/completed w oferty-online)\n']
    wynik, razem, brak = {}, 0, []
    for k, f in d['fazy'].items():
        kat = zadanie(f['temat_fix'])
        sciezka = 'docs/completed/{}/review-faza-{}.md'.format(kat, f['numer']) if kat else None
        tresc = git('show', 'HEAD:' + sciezka) if sciezka else ''
        ff = findingi_p12(tresc) if tresc else []
        wynik[k] = {'raport': sciezka if tresc else None, 'p12': ff}
        razem += len(ff)
        if not tresc:
            brak.append(k)
        o.append('  {} PR{} f{} {:45s} P1/P2 historyczne: {:2d}'.format(k, f['pr'], f['numer'], (sciezka or '?')[15:], len(ff)))
    o.insert(1, 'faz {}, z raportem {}, potwierdzonych P1/P2 KOD/TEST razem {}; bez raportu: {}'.format(
        len(d['fazy']), len(d['fazy']) - len(brak), razem, ', '.join(brak) or '—'))
    o.insert(2, 'uwaga: raport w docs/completed to OSTATNI przebieg review fazy (przy powtórce review — wynik powtórki), więc klucz 2 to')
    o.insert(3, 'dolna granica znanych trafień; sędzia sprawdza obecność każdej pozycji w stanie przed review tak samo jak dla klucza 1.\n')
    open(OUT_TXT, 'w').write('\n'.join(o) + '\n')
    json.dump(wynik, open(OUT_JSON, 'w'), ensure_ascii=False, indent=1)
    print('\n'.join(o))


if __name__ == '__main__':
    main()

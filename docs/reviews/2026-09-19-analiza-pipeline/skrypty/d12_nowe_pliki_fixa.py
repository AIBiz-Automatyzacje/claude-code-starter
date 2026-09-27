#!/usr/bin/env python3
"""D12 część 2 („finding wymagający nowej funkcjonalności → nowa IU”) — ile commitów fixa z testu review dodaje nowe pliki i ile defektów
urodzonych w fixie (klucz 1 modułu fixa, obecne) leży w plikach, które fix DODAŁ, a ile w plikach tylko zmienionych.

Użycie: python3 skrypty/d12_nowe_pliki_fixa.py → dane/d12-nowe-pliki-fixa.{txt,json}
Źródła: dane/test-review/etap.json (24 commity x-*), lustro oferty-online ~/test-review/_mirror (git show --name-status, tylko odczyt),
wiersze kluczy z test_review_analiza.wiersze() (czesc = fix, zrodlo = klucz1, obecny = TAK). Nowy plik = status A w commicie fixa; produkcyjny = kod bez wzorca testu (.test., .spec., tests/, e2e/, __tests__);
„nowy kod w istniejącym pliku” nie jest tu liczony (granica D12(2) to nowy plik / trasa / eksport — trasy i eksporty wymagałyby czytania diffu)."""
import collections, json, os, re, subprocess, sys

sys.dont_write_bytecode = True
import test_review_analiza as TA

MIRROR = os.path.expanduser('~/test-review/_mirror')
DANE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dane')
KOD = ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.sql')
RE_TEST = re.compile(r'(\.test\.|\.spec\.|/tests?/|/e2e/|__tests__)')


def zmiany(sha):
    out = subprocess.run(['git', '-C', MIRROR, 'show', '--name-status', '--format=', sha], capture_output=True, text=True, check=True).stdout
    return [(l.split('\t')[0][0], l.split('\t')[-1]) for l in out.splitlines() if '\t' in l]


def main():
    fixy = [u for u in TA.jednostki() if u['et'].startswith('x-')]
    R = [r for r in TA.obecne(TA.wiersze(), 'fix', 'klucz1')]
    per, razem = [], collections.Counter()
    for u in fixy:
        z = zmiany(u['sha'])
        nowe = {p for s, p in z if s == 'A'}
        kod = [p for s, p in z if p.endswith(KOD)]
        nowe_kod = [p for p in nowe if p.endswith(KOD)]
        nowe_prod = [p for p in nowe_kod if not RE_TEST.search(p)]
        ks = [r for r in R if r['et'] == u['et']]
        w_nowych = [r for r in ks if r['plik'] in nowe]
        w_nowych_prod = [r for r in ks if r['plik'] in nowe_prod]
        per.append({'et': u['et'], 'plikow': len(z), 'plikow_kodu': len(kod), 'nowych': len(nowe), 'nowych_kodu': len(nowe_kod),
                    'nowych_produkcyjnych': nowe_prod, 'kluczy_w_nowych_produkcyjnych': len(w_nowych_prod), 'kluczy': len(ks), 'kluczy_w_nowych': len(w_nowych), 'wagi_w_nowych': [r['waga'] for r in w_nowych]})
        razem.update({'commitow': 1, 'z_nowym_plikiem_kodu': bool(nowe_kod), 'kluczy': len(ks), 'kluczy_w_nowych': len(w_nowych),
                      'p1p2_w_nowych': sum(r['waga'] in ('P1', 'P2') for r in w_nowych), 'p1p2': sum(r['waga'] in ('P1', 'P2') for r in ks),
                      'nowych_plikow_kodu': len(nowe_kod), 'plikow_kodu': len(kod),
                      'z_nowym_plikiem_produkcyjnym': bool(nowe_prod), 'nowych_produkcyjnych': len(nowe_prod),
                      'kluczy_w_nowych_produkcyjnych': len(w_nowych_prod),
                      'p1p2_w_nowych_produkcyjnych': sum(r['waga'] in ('P1', 'P2') for r in w_nowych_prod)})
    wynik = {'razem': dict(razem), 'commity': per}
    json.dump(wynik, open(os.path.join(DANE, 'd12-nowe-pliki-fixa.json'), 'w'), ensure_ascii=False, indent=1)
    L = ['d12_nowe_pliki_fixa.py — 24 commity fixa z testu review (moduł §2.6), klucz 1 fixa obecny', '  razem: ' + json.dumps(dict(razem), ensure_ascii=False)]
    L += ['  %-11s plików %3d (kod %3d)  nowych %2d (kod %2d)  kluczy %d, w nowych %d %s  nowe produkcyjne: %s' % (
              p['et'], p['plikow'], p['plikow_kodu'], p['nowych'], p['nowych_kodu'], p['kluczy'], p['kluczy_w_nowych'], p['wagi_w_nowych'],
              ', '.join(p['nowych_produkcyjnych']) or '-')
          for p in per]
    open(os.path.join(DANE, 'd12-nowe-pliki-fixa.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()

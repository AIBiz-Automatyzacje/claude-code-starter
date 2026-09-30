"""Pojedynczy hunk z dane/pa-proponowany.diff (PLAN-POPRAWY §1, P0).

`git apply --include=<plik>` bierze WSZYSTKIE hunki pliku, a `filterdiff` nie jest zainstalowany — ten skrypt wycina jeden.

Użycie (z katalogu repo szablonu):
  python3 pa_hunk.py H07 > /tmp/h07.diff && git apply --check /tmp/h07.diff && git apply /tmp/h07.diff
  python3 pa_hunk.py --sprawdz > ../dane/pa-hunki-lata-tresc.txt   # 62 × pojedyncze `git apply --check` na HEAD → łata / treść

Klasyfikacja (§1): ŁATA = pojedyncze `--check` przechodzi i hunk nie jest z góry treścią; TREŚĆ = z góry (lista §1) albo `--check`
nie przechodzi; WYPADA = H59, H60 (znikają razem z `kontekstPrompt`, P7). Paczka = linia `Hunki:` w PLAN-POPRAWY §3.
Kontrola wewnętrzna: numer, PA, plik i zakres `-a,b +c,d` każdego wyciętego hunka = mapa z nagłówka diffu.
"""
import os
import re
import subprocess
import sys
import tempfile

KATALOG = os.path.dirname(os.path.abspath(__file__))
DIFF = os.path.join(KATALOG, '..', 'dane', 'pa-proponowany.diff')
PLAN = os.path.join(KATALOG, '..', 'PLAN-POPRAWY.md')
REPO = subprocess.run(['git', 'rev-parse', '--show-toplevel'], cwd=KATALOG, capture_output=True, text=True,
                      check=True).stdout.strip()

Z_GORY_TRESC = {'H40', 'H44', 'H45', 'H48', 'H50', 'H52', 'H53', 'H62'}
WYPADA = {'H59', 'H60'}
RE_MAPA = re.compile(r'^#\s+(\d+)\s+(PA-\d\d)\s+(\S+)\s+(-\d+(?:,\d+)? \+\d+(?:,\d+)?)$')
RE_HUNK = re.compile(r'^@@ (-\d+(?:,\d+)? \+\d+(?:,\d+)?) @@')


def mapa_z_naglowka(linie):
    return {'H%02d' % int(m.group(1)): (m.group(2), m.group(3), m.group(4))
            for m in (RE_MAPA.match(l) for l in linie) if m}


def hunki_z_diffu(linie):
    """H<nn> → (plik, nagłówek pliku, linie hunka). Numeracja jak w mapie nagłówka: kolejność w pliku."""
    hunki, naglowek, plik, biezacy = {}, [], None, None
    for linia in linie:
        if linia.startswith('diff --git '):
            naglowek, plik, biezacy = [linia], linia.split(' b/', 1)[1].rstrip('\n'), None
        elif linia.startswith('@@'):
            biezacy = [linia]
            hunki['H%02d' % (len(hunki) + 1)] = (plik, list(naglowek), biezacy)
        elif biezacy is not None:
            biezacy.append(linia)
        elif plik is not None:
            naglowek.append(linia)
    return hunki


def kontrola(hunki, mapa):
    bledy = []
    if set(hunki) != set(mapa):
        bledy.append('hunki w diffie %d, w mapie %d' % (len(hunki), len(mapa)))
    for hid, (plik, _, tresc) in hunki.items():
        if hid not in mapa:
            continue
        zakres = RE_HUNK.match(tresc[0]).group(1)
        if (plik, zakres) != (mapa[hid][1], mapa[hid][2]):
            bledy.append('%s: wycięty %s %s ≠ mapa %s %s' % (hid, plik, zakres, mapa[hid][1], mapa[hid][2]))
    return bledy


def patch(hunek):
    _, naglowek, tresc = hunek
    return ''.join(naglowek + tresc)


def git_check(tekst):
    with tempfile.NamedTemporaryFile('w', suffix='.diff', delete=False) as f:
        f.write(tekst)
    try:
        w = subprocess.run(['git', 'apply', '--check', f.name], cwd=REPO, capture_output=True, text=True)
        return w.returncode == 0, w.stderr.strip().splitlines()[:1]
    finally:
        os.unlink(f.name)


def paczki_z_planu():
    paczki, biezaca = {}, None
    for linia in open(PLAN, encoding='utf-8'):
        m = re.match(r'^### (P\d+)', linia)
        if m:
            biezaca = m.group(1)
        elif biezaca and '**Hunki:**' in linia:
            for h in re.findall(r'\[(H\d\d)\]', linia):
                paczki[h] = biezaca
    return paczki


def sprawdz(hunki, mapa):
    paczki = paczki_z_planu()
    head = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    print('pa_hunk.py --sprawdz — pojedyncze `git apply --check` na HEAD %s (%s)' % (head, os.path.relpath(DIFF, REPO)))
    print('hunk  PA     paczka  check  wynik   plik  [powód]')
    licznik, check_ok = {}, 0
    for hid in sorted(hunki):
        ok, blad = git_check(patch(hunki[hid]))
        if hid in WYPADA:
            wynik, powod = 'WYPADA', 'z kontekstPrompt (P7)'
        elif hid in Z_GORY_TRESC:
            wynik, powod = 'TREŚĆ', 'z góry (§1)'
        elif ok:
            wynik, powod = 'ŁATA', ''
        else:
            wynik, powod = 'TREŚĆ', 'check: ' + ' '.join(blad)
        licznik[wynik] = licznik.get(wynik, 0) + 1
        check_ok += ok
        print('%s   %s  %-6s  %-5s  %-6s  %s  %s' % (hid, mapa[hid][0], paczki.get(hid, 'BRAK'), 'OK' if ok else 'FAIL',
                                                 wynik, hunki[hid][0], powod))
    print('\nrazem %d: %s' % (len(hunki), ', '.join('%s %d' % kv for kv in sorted(licznik.items()))))
    print('check OK %d / %d' % (check_ok, len(hunki)))
    print('hunki bez paczki w PLAN-POPRAWY:', sorted(set(hunki) - set(paczki)) or '—')
    print('UWAGA: wynik dotyczy HEAD %s — paczka przed `git apply` powtarza pojedyncze `--check` (wcześniejsze paczki zmieniają pliki).' % head)


def main(argumenty):
    linie = open(DIFF, encoding='utf-8').readlines()
    mapa, hunki = mapa_z_naglowka(linie), hunki_z_diffu(linie)
    bledy = kontrola(hunki, mapa)
    if bledy:
        sys.exit('BŁĄD kontroli wewnętrznej:\n' + '\n'.join(bledy))
    if argumenty == ['--sprawdz']:
        sprawdz(hunki, mapa)
    elif len(argumenty) == 1 and argumenty[0] in hunki:
        sys.stdout.write(patch(hunki[argumenty[0]]))
    else:
        sys.exit('Użycie: pa_hunk.py H<nn> | --sprawdz   (H01–H%02d)' % len(hunki))


if __name__ == '__main__':
    main(sys.argv[1:])

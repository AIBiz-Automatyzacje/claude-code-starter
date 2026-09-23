#!/usr/bin/env python3
"""Przeglad D4 (2026-09-23): kontrola odwrotna zrodla -> PANEL-WEJSCIE.md po poprawkach D1–D6.
A. Te same zrodla i markery co skrypty/d4_kontrola_odwrotna.py (2026-09-21) na OBECNYM pakiecie — czy edycje po przegladach nie zgubily
   czegos, co pierwotnie bylo pokryte; porownanie z lista 44 jednostek przejrzanych recznie (dopasowanie po poczatku tekstu, bo linie sie przesunely).
B. Nowe zrodla: PROPOZYCJA-POPRAWEK-DOMKNIEC.md (sekcje D1–D6) i rekord telemetrii dane/d5-telemetria-rekord.txt §8–§9 — markery rozszerzone
   o slownictwo korekt (proponuj/poprawk/zamiast/korekt/punkt odniesienia/wymaga zmiany).
Metryka jak w d4_kontrola_odwrotna.py: udzial terminow jednostki zrodlowej obecnych w najlepszym oknie 1–2 sasiednich jednostek pakietu.
Wyjscie: dane/d4r-kontrola-odwrotna.txt."""
import importlib.util, os, re, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('d4', os.path.join(BASE, 'skrypty', 'd4_kontrola_odwrotna.py'))
src = open(spec.origin, encoding='utf-8').read()
# bierzemy definicje funkcji i stale z oryginalu, bez jego czesci wykonawczej (zaczyna sie od „pak_lines =”)
ns = {'__name__': 'd4', 'sys': sys}
sys_argv = sys.argv; sys.argv = [spec.origin, BASE]
exec(compile(src.split('\npak_lines = ')[0], spec.origin, 'exec'), ns)
sys.argv = sys_argv
jednostki, wytnij, tokeny, norm, MARKERY = ns['jednostki'], ns['wytnij'], ns['tokeny'], ns['norm'], ns['MARKERY']

MARKERY_B = re.compile(MARKERY.pattern + r'|proponuj|poprawk|zamiast|korekt|punkt odniesienia|wymaga zmiany|do przeliczenia|panel', re.I)
ZRODLA_B = [
    ('PROPOZYCJA-POPRAWEK-DOMKNIEC.md', ('## D1', None), 'PROPOZYCJA D1–D6'),
    ('dane/d5-telemetria-rekord.txt', ('=== 8.', None), 'REKORD D5 §8–§9'),
]


def okna_pakietu(plik):
    pu = jednostki(open(os.path.join(BASE, plik), encoding='utf-8').read().split('\n'))
    pt = [(ln, tokeny(u)) for ln, u in pu]
    ok = []
    for i, (ln, t) in enumerate(pt):
        ok.append((ln, t))
        if i + 1 < len(pt): ok.append((ln, t | pt[i + 1][1]))
    return ok, len(pu)


def kontrola(zrodla, markery, okna):
    wyn = []
    for plik, zakres, opis in zrodla:
        lines = open(os.path.join(BASE, plik), encoding='utf-8').read().split('\n')
        sel = wytnij(lines, zakres)
        if not sel: continue
        off = sel[0][0]
        for ln, u in jednostki([l for _, l in sel]):
            if u.startswith('#') or not markery.search(norm(u)): continue
            t = tokeny(u)
            if len(t) < 6: continue
            best = max(((len(t & pt) / len(t), pln) for pln, pt in okna), default=(0, None))
            wyn.append((best[0], opis, ln + off - 1, best[1], u))
    return sorted(wyn, key=lambda x: x[0])


okna, n_pak = okna_pakietu('PANEL-WEJSCIE.md')
out = []; P = out.append
P('# D4r — kontrola odwrotna po poprawkach D1–D6 (2026-09-23); pakiet PANEL-WEJSCIE.md: %d jednostek' % n_pak)

# --- 0. odtworzenie pierwotnej kontroli na wersjach z gita (przed i po 9 uzupelnieniach, 2026-09-21) ---
import subprocess, tempfile
REPO = subprocess.run(['git', '-C', BASE, 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
PLIKI = ['PANEL-WEJSCIE.md', 'HANDOFF.md', 'ETAP1-ROZSTRZYGNIECIE.md', 'ETAP1B-ROZSTRZYGNIECIE.md', 'ETAP2-ROZSTRZYGNIECIE.md',
         'POMIARY-ROZSTRZYGNIECIE.md', 'ETAP3-ROZSTRZYGNIECIE.md']
for commit, opis in (('ac4fc72', 'przed 9 uzupelnieniami'), ('5ed33b7', 'po 9 uzupelnieniach')):
    with tempfile.TemporaryDirectory() as tmp:
        d = os.path.join(tmp, 'a'); os.makedirs(d)
        for f in PLIKI:
            open(os.path.join(d, f), 'w').write(subprocess.run(['git', '-C', REPO, 'show', commit + ':docs/reviews/2026-09-19-analiza-pipeline/' + f], capture_output=True, text=True).stdout)
        open(os.path.join(tmp, '2026-09-19-przeglad-runow-po-naprawie.md'), 'w').write(subprocess.run(['git', '-C', REPO, 'show', commit + ':docs/reviews/2026-09-19-przeglad-runow-po-naprawie.md'], capture_output=True, text=True).stdout)
        wynik = subprocess.run([sys.executable, spec.origin, d], capture_output=True, text=True).stdout
        P('0. pierwotna kontrola na wersji %s (%s): ' % (commit, opis) + ' | '.join(l.strip('# ') for l in wynik.split('\n') if l.startswith('## ')))
P('   -> recznie przejrzano NISKIE (58), SREDNIE wyrywkowo; „118 przejrzanych recznie” w wersji operatora = NISKIE + SREDNIE, zawyzone.')

# --- A ---
A = kontrola(ns['ZRODLA'], MARKERY, okna)
stary = open(os.path.join(BASE, 'dane', 'd4-kontrola-odwrotna.txt'), encoding='utf-8').read()
stare_niskie = set()
for blok in stary.split('\n## ')[1:2]:  # sekcja NISKIE
    for m in re.finditer(r'\n    (.{60})', blok): stare_niskie.add(norm(m.group(1)))
niskie = [w for w in A if w[0] < 0.3]
nowe = [w for w in niskie if norm(w[4][:60]) not in stare_niskie]
P('\n## A. Zrodla i markery z 2026-09-21 na obecnym pakiecie: %d jednostek z markerem; <0,30: %d (2026-09-21: 44); SPOZA dawnej listy 44: %d' % (len(A), len(niskie), len(nowe)))
for s, opis, ln, pln, u in nowe:
    P('[%.2f] %s:%d -> pakiet:%s\n    %s' % (s, opis, ln, pln, u if len(u) <= 420 else u[:420] + '…'))
zniknely = [x for x in stare_niskie if not any(norm(w[4][:60]) == x for w in niskie)]
P('Z dawnej listy 44 nie ma juz ponizej 0,30: %d (pokrycie wzroslo po dopiskach albo jednostka zmienila brzmienie w zrodle)' % len(zniknely))

# --- B ---
B = kontrola(ZRODLA_B, MARKERY_B, okna)
for prog, tytul in ((0.3, 'NISKIE (<0,30) — przejrzec recznie'), (0.5, 'SREDNIE (0,30–0,49)')):
    grp = [w for w in B if (w[0] < prog and (prog == 0.3 or w[0] >= 0.3))]
    P('\n## B. %s: %d z %d jednostek nowych zrodel' % (tytul, len(grp), len(B)))
    for s, opis, ln, pln, u in grp:
        P('[%.2f] %s:%d -> pakiet:%s\n    %s' % (s, opis, ln, pln, u if len(u) <= 420 else u[:420] + '…'))
P('\n## B. WYSOKIE (>=0,50): %d' % sum(1 for w in B if w[0] >= 0.5))
P('''
## PRZEGLAD RECZNY (sesja glowna 2026-09-23; kategorie jak w d4-kontrola-odwrotna.txt: U uzasadnienie, M metadane, S pokryte innymi slowami,
## N nieaktualne, P poza panelem, LUKA = brak w pakiecie)
A: ETAP3:26 L3 -> D1 = N (§4 D1) | HANDOFF 6a pkt 19 „praca w nowych sesjach” = P (sposob pracy, nie wejscie panelu)
B: PROPOZYCJA D5 porzadkowe rola() sklejanie fix = S §12 („agents.csv PRZELICZONY … poprawiona rola()”), ale opis pola `rola` w §12 nadal „jak rola()
   w koszt_agentow.py” -> porzadkowe D4 | D6 popr. 2 history.jsonl = S §7 (korekta D6 pkt 1) | D1 popr. 3 „Dlaczego” = U (§4 D1 pkt 1)
   | D5 „pola wejscia i cache poprawne” = U | D5 popr. 2 wznowienie = S §12 („wznowienie = ten sam runId, 9/9”) | D2 popr. 2 „Obecnie” = N (stara liczba)
   | D6 popr. 1 proba czytana recznie = U | D1 popr. 1 pol na pol = S §4, §8 | D5 porzadkowe cleanupPeriodDays 120 dni = LUKA -> §10 (higiena konta)
   | D6 popr. 1 „punkt odniesienia 3x za niski” = S §12 (mediany 2,39 M / 0,56 M) | D5 popr. 5 instrukcje_stale bez producenta = S §12 (pole agent)
WYNIK: 1 luka (cleanupPeriodDays) + 1 porzadkowe (opis `rola` w §12); edycje pakietu po przegladach D1–D6 nie zgubily niczego z kontroli 2026-09-21
(<0,30: 44 -> 37, dwie nowe ponizej progu pokryte). Srednie B (0,30–0,49) przeczytane z lista: kazda ma odpowiednik w pakiecie
(najczesciej §4 i §12, po innych slowach). Ograniczenie jak w 2026-09-21: markery slowne.''')
open(os.path.join(BASE, 'dane', 'd4r-kontrola-odwrotna.txt'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('\n'.join(out))

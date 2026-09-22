#!/usr/bin/env python3
"""D5b poprawka — baseline JAKOSCI (uwagi bota) znormalizowany: na 100 plikow, per typ kodu, per os, w plikach fixow.
Wejscie: dane/coderabbit/klasyfikacja-574.csv + katalog z listami plikow i commitow PR (gh pr view / gh api, tylko odczyt)
+ repo oferty-online (git show --name-only commitow fixow pipeline'u). Zero agentow.
Uzycie: d5b_baseline_jakosci.py <katalog_pr> <repo_oferty>  -> dane/d5b-baseline-jakosci.txt"""
import collections, csv, json, os, re, subprocess, sys

TU = os.path.dirname(os.path.abspath(__file__))
DANE = os.path.join(os.path.dirname(TU), 'dane')
KAT, REPO = sys.argv[1], sys.argv[2]
POZA_PIPELINE = {12, 18}  # 12 = reczna tura porzadkowa (chore), 18 = reczny fix — nie powstaly w autopilocie
FIX_RE = re.compile(r'poprawki po review fazy|kontrola diffu')

def typ_kodu(p):
    if re.search(r'\.test\.|/tests?/|__tests__|e2e/', p): return 'testy'
    if p.startswith('supabase/') or p.endswith('.sql') or p.startswith('apps/server/') or p.startswith('packages/shared/'): return 'dane-serwer'
    if p.startswith('apps/dashboard/') and re.search(r'\.(tsx|css)$', p): return 'ui'
    if p.startswith('apps/dashboard/'): return 'dashboard-logika'
    return 'inne'

def os_review(etap):
    m = re.match(r'(review:[a-z0-9-]+|kontrola|domkniecie)', etap or '')
    return m.group(1) if m else (etap or '?')

rows = list(csv.DictReader(open(os.path.join(DANE, 'coderabbit', 'klasyfikacja-574.csv'))))
pr_pliki, pr_fix_pliki = {}, {}
for i in range(1, 20):
    pr_pliki[i] = [l.strip() for l in open(os.path.join(KAT, f'files{i}.txt')) if l.strip()]
    d = json.load(open(os.path.join(KAT, f'pr{i}.json')))
    fp = set()
    for c in d['commits']:
        if FIX_RE.search(c['messageHeadline']):
            out = subprocess.run(['git', '-C', REPO, 'show', '--name-only', '--format=', c['oid']], capture_output=True, text=True).stdout
            fp.update(x for x in out.splitlines() if x)
    pr_fix_pliki[i] = fp & set(pr_pliki[i]) if fp else set()

def istotna(r): return r['koszyk'] == 'B' and r['severity'] in ('P1', 'P2')
out = []; P = out.append
P('D5b — BASELINE JAKOSCI znormalizowany (2026-09-22). Skrypt: skrypty/d5b_baseline_jakosci.py. Miara: uwagi bota koszyka B o wadze P1/P2')
P('(realne defekty, ktore przeszly przez nasze review — ETAP1B). 19 PR oferty-online; PR 12 i 18 poza pipeline\'em (reczne) — pokazane, wylaczone z sum.')
P('Pliki PR = lista z GitHuba (gh api pulls/N/files); pliki fixa = pliki commitow "poprawki po review fazy" / "kontrola diffu" obecne w PR.')
P('')
P('=== 1. PER PR: surowo vs na 100 plikow ===')
P(f"{'PR':>3} {'pliki':>6} {'B P1/P2':>8} {'na 100 pl.':>10} {'pl. fixa':>9} {'B P1/P2 w pl. fixa':>19}")
suma_pl = suma_b = suma_fx = suma_bfx = 0
seria = []
for i in range(1, 20):
    b = [r for r in rows if int(r['pr']) == i and istotna(r)]
    bfx = [r for r in b if r['plik'].split(':')[0] in pr_fix_pliki[i]]
    n = len(pr_pliki[i]); nf = len(pr_fix_pliki[i])
    znak = ' (poza pipeline)' if i in POZA_PIPELINE else ''
    P(f"{i:>3} {n:>6} {len(b):>8} {100 * len(b) / n:>10.1f} {nf:>9} {len(bfx):>19}{znak}")
    if i not in POZA_PIPELINE:
        suma_pl += n; suma_b += len(b); suma_fx += nf; suma_bfx += len(bfx); seria.append((len(b), n))
P(f"RAZEM (17 PR pipeline'u): {suma_pl} plikow, {suma_b} B P1/P2 = {100 * suma_b / suma_pl:.1f} na 100 plikow; "
  f"pliki fixow {suma_fx}, w nich {suma_bfx} B P1/P2 = {100 * suma_bfx / max(suma_fx, 1):.1f} na 100 plikow fixa "
  f"(vs {100 * (suma_b - suma_bfx) / max(suma_pl - suma_fx, 1):.1f} w pozostalych plikach)")
P('')
P('=== 2. SZUM: suma B P1/P2 w oknie 5 kolejnych PR (surowo i na 100 plikow) — jak bardzo rozrzut maskuje zmiane ===')
okna = [(sum(x[0] for x in seria[k:k + 5]), sum(x[1] for x in seria[k:k + 5])) for k in range(len(seria) - 4)]
sur = [o[0] for o in okna]; nor = [100 * o[0] / o[1] for o in okna]
P(f"surowo: min {min(sur)} / max {max(sur)} (rozrzut {max(sur) / max(min(sur), 1):.1f}x); na 100 plikow: min {min(nor):.1f} / max {max(nor):.1f} "
  f"(rozrzut {max(nor) / min(nor):.1f}x)")
P('')
P('=== 3. PER TYP KODU (plik uwagi → typ po sciezce; mianownik = pliki tego typu we wszystkich PR pipeline\'u) ===')
mian = collections.Counter(); licz = collections.Counter(); licz_wszystkie = collections.Counter()
for i in range(1, 20):
    if i in POZA_PIPELINE: continue
    for p in pr_pliki[i]: mian[typ_kodu(p)] += 1
for r in rows:
    if int(r['pr']) in POZA_PIPELINE: continue
    t = typ_kodu(r['plik'].split(':')[0])
    licz_wszystkie[t] += 1
    if istotna(r): licz[t] += 1
for t in ('dane-serwer', 'dashboard-logika', 'ui', 'testy', 'inne'):
    P(f"  {t:17} pliki {mian[t]:>5}  B P1/P2 {licz[t]:>4}  na 100 plikow {100 * licz[t] / max(mian[t], 1):>5.1f}  (wszystkie uwagi bota {licz_wszystkie[t]})")
P('')
P('=== 4. PER OS REVIEW (kolumna `etap` z klasyfikacji 1b = os, ktora powinna byla to zlapac; zastepuje filtr po nazwie klasy) ===')
osie = collections.Counter(); osie_all = collections.Counter()
for r in rows:
    if r['koszyk'] != 'B' or int(r['pr']) in POZA_PIPELINE: continue
    o = os_review(r['etap']); osie_all[o] += 1
    if r['severity'] in ('P1', 'P2'): osie[o] += 1
for o, v in osie_all.most_common():
    P(f"  {o:26} B razem {v:>4}  B P1/P2 {osie[o]:>4}  na 100 plikow PR {100 * osie[o] / suma_pl:>5.2f}")
P('')
P('=== 5. KLASY, KTORE WEDLUG MAPY SA "POD OBSERWACJA" (hook obslugi bledow, zal. 8) — pelne dopasowanie po klasie ===')
kl8 = [r for r in rows if int(r['pr']) not in POZA_PIPELINE and re.search(r'sciezka-bledu|catch|console|sentry|blad', r['klasa'])]
P('  ' + ', '.join(f"{k}:{v}" for k, v in collections.Counter(r['klasa'] for r in kl8).most_common()) + f"  | razem {len(kl8)}, w tym B P1/P2 {sum(1 for r in kl8 if istotna(r))}")
P('')
P('=== 6. EPOKA: trend w czasie (L16) — baseline do porownan = OSTATNIE PR pipeline\'u, nie srednia z 17 ===')
for nazwa, zakres in (('PR 1-7 (sierpien)', range(1, 8)), ('PR 8-11', range(8, 12)), ('PR 13-19 (wrzesien, bez 18)', [13, 14, 15, 16, 17, 19])):
    pl = sum(len(pr_pliki[i]) for i in zakres); bb = sum(1 for r in rows if int(r['pr']) in zakres and istotna(r))
    per = [100 * sum(1 for r in rows if int(r['pr']) == i and istotna(r)) / len(pr_pliki[i]) for i in zakres]
    P(f"  {nazwa:30} pliki {pl:>5}  B P1/P2 {bb:>4}  na 100 plikow {100 * bb / pl:>5.1f}  (rozrzut per PR {min(per):.1f}-{max(per):.1f})")
P('  UWAGA: PR 9, 10, 15, 16 to czesci serwerowe zadan dzielonych na dwa PR — commity fixow pipeline\'u sa w PR siostrzanym, wiec "pliki fixa" = 0')
P('  zanizaja mianownik plikow fixa; porownanie fix vs reszta w sekcji 1 jest przez to ostrozne (reszta zawiera czesc plikow po fixie).')
txt = '\n'.join(out) + '\n'
open(os.path.join(DANE, 'd5b-baseline-jakosci.txt'), 'w').write(txt)
print(txt)

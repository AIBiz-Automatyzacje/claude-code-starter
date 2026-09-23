#!/usr/bin/env python3
"""D1 — rewizja (przeglad domkniec na Opus 5.5, 2026-09-23). Niezalezne przeliczenie atrybucji nowych findingow po fixie.
Roznice wobec d1_atrybucja_po_fixie.py:
  1. TRZY pary z pomiaru 4 z kodem zmienionym miedzy runami (D1 wzielo 2; trzecia: samodzielna f3 run2 -> run3).
  2. Kontrola dryfu linii: czy identyfikatory z opisu findingu (w backtickach) wystepuja w oknie +-5 linii wokol linii findingu na HEAD2.
  3. Granica A/B: dla B i C — odleglosc linii findingu od najblizszego hunka fixa (nowa strona diffu HEAD1..HEAD2) w tym samym pliku
     oraz czy opis odwoluje sie do pliku:linii lezacej w hunku fixa albo wprost do fixa ("fix", "poprawk", "wprowadzon").
  4. HEAD1 = rodzic najstarszego commitu w oknie (stan, ktory ogladala runda 1), HEAD2 = najnowszy commit w oknie.
  5. Klasa SEMANTYCZNA (pytanie D1: skutek fixa czy przeoczenie rundy wczesniejszej) — blame na linii nie widzi przyczyny lezacej gdzie indziej.
     Wyjatki od reguly "A -> FIX, B/C -> PRZEOCZONE" sa w slowniku RECZNE z uzasadnieniem z czytania diffu (sesja 2026-09-23):
     FIX = urodzone w fixie okna | LANCUCH = urodzone we WCZESNIEJSZYM fixie, przeoczone przez pelna runde po nim | PRZEOCZONE = istnialo
     w stanie, ktory ogladala runda 1 | SRODOWISKO = E2E/srodowisko, nie kod.
Wyjscie: dane/d1r-rewizja-atrybucji.{json,txt}. Uzycie: d1r_rewizja_atrybucji.py <repo_oferty_online>"""
import collections, csv, difflib, glob, json, os, re, subprocess, sys

S = os.path.dirname(os.path.abspath(__file__)) + '/../dane/'
ROOT = os.path.expanduser('~/.claude/projects')
REPO = sys.argv[1]
PARY = [
    ('faza-9b-wielu-uzytkownikow', '4', 'wf_cf90b5d6-f83', 'wf_29d462f8-85c'),
    ('samodzielna-rejestracja-czlonkow-aa', '3', 'wf_8eefb073-6a9', 'wf_ce87b73b-89f'),
    ('samodzielna-rejestracja-czlonkow-aa', '3', 'wf_ce87b73b-89f', 'wf_feed7bad-902'),
]
BLISKO = 15  # linii od hunka fixa = "ten sam fragment kodu"
FIX_SLOWA = re.compile(r'\bfix|poprawk|wprowadzon|po turze|naprawcz', re.I)
dec = json.JSONDecoder()
rows = {(r['run'], r['opis']): r for r in csv.DictReader(open(S + 'agents.csv')) if r['rola'] == 'scribe'}


def prompt_of(r):
    base = os.path.join(ROOT, '-Users-kacper-trzepiecinski-Documents-Kodowanie-' + r['projekt'])
    jfs = glob.glob(os.path.join(base, '*', 'subagents', 'workflows', r['run'], f"agent-{r['agent']}.jsonl"))
    for line in open(jfs[0], errors='ignore'):
        o = json.loads(line)
        if o.get('type') == 'user':
            c = o['message']['content']
            return c if isinstance(c, str) else ' '.join(b.get('text', '') for b in c if isinstance(b, dict))
    raise RuntimeError('brak promptu ' + r['agent'])


def findings(txt):
    j = txt.find('[', txt.find('Findings (JSON)'))
    v, _ = dec.raw_decode(txt[j:])
    return [f for f in v if isinstance(f, dict)]


def git(*a):
    return subprocess.run(['git', '-C', REPO] + list(a), capture_output=True, text=True).stdout


def plik_linia(p):
    m = re.match(r'^(.*?):(\d+)', str(p or ''))
    return (m.group(1), int(m.group(2))) if m else (re.sub(r':.*$', '', str(p or '')), None)


def ten_sam(a, b):
    """Dopasowanie jak w POMIARY §4 (luzniejsze niz D1): ten sam plik i (|dlinia|<=3 lub podobienstwo opisu > 0,3)."""
    pa, la = plik_linia(a.get('plik')); pb, lb = plik_linia(b.get('plik'))
    if pa != pb:
        return False
    if la and lb and abs(la - lb) <= 3:
        return True
    return difflib.SequenceMatcher(None, str(a.get('opis', ''))[:400].lower(), str(b.get('opis', ''))[:400].lower()).ratio() > 0.3


def hunki(head1, head2, plik):
    """Zakresy linii po NOWEJ stronie diffu head1..head2 w pliku (to, co fix dodal/zmienil)."""
    out = git('diff', '-U0', head1, head2, '--', plik)
    zak = []
    for m in re.finditer(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@', out, re.M):
        start, n = int(m.group(1)), int(m.group(2) if m.group(2) is not None else 1)
        zak.append((start, start + max(n, 1) - 1))
    return zak


def dryf(plik, linia, opis, head2):
    ids = [i for i in re.findall(r'`([^`]{3,60})`', opis) if re.search(r'[A-Za-z_]', i)]
    if not ids:
        return None  # brak identyfikatorow do sprawdzenia
    tekst = git('show', f'{head2}:{plik}').splitlines()
    okno = '\n'.join(tekst[max(0, linia - 6):linia + 5])
    tokeny = [re.split(r'[(\s.]', i.strip('/'))[0] for i in ids]
    return any(t and t in okno for t in tokeny)


RECZNE = {  # (plik findingu, severity) -> (klasa semantyczna, uzasadnienie)
    ('apps/dashboard/src/features/onboarding/use-first-steps.ts:293', 'P3'): ('FIX', 'komentarz nieaktualny, bo fix 417a9fd usunal probeOfferIds/visit-summary i nie poprawil komentarza'),
    ('apps/dashboard/src/features/help/help-page.tsx:43', 'P3'): ('FIX', 'fix 417a9fd wprowadzil stan blad; track zostal bezwarunkowy — niespojnosc powstala w fixie'),
    ('apps/server/src/access/invitation-service.ts:265', 'P3'): ('FIX', 'DEFAULT_REGISTRATION_REDIRECT_PATH wprowadzil fix 5c3c7ac (git log -S) — duplikat literalu powstal w fixie'),
    ('CLAUDE.md:73', 'P2'): ('FIX', 'dokument rozjechany z kodem po fixie 5c3c7ac (jak w D1)'),
    ('CLAUDE.md:73', 'P3'): ('FIX', 'jw.'),
    ('e2e/seeds/rejestracja-czlonek-seed.sql:?', 'P2'): ('SRODOWISKO', 'scenariusz E2E nieodegrany: limit mailera'),
    ('docs/active/samodzielna-rejestracja-czlonkow-aa/samodzielna-rejestracja-czlonkow-aa-zadania.md:?', 'P2'): ('SRODOWISKO', 'scenariusz E2E nigdy PASS — srodowisko'),
    ('apps/server/src/access/registration-service.ts:234', 'P2'): ('LANCUCH', 'redirectPath z fixa 5c3c7ac (pary 2); pelna runda 2 przeoczyla'),
    ('apps/server/src/access/redirect-path.test.ts:48', 'P3'): ('LANCUCH', 'plik utworzony fixem 5c3c7ac'),
    ('apps/dashboard/src/features/auth/waitlist-question.tsx:26', 'P3'): ('LANCUCH', 'plik utworzony fixem 5c3c7ac'),
    ('apps/dashboard/src/features/oauth/consent-cards.tsx:89', 'P2'): ('LANCUCH', 'sciezka powrotu wprowadzona fixem 5c3c7ac; linia findingu w pliku nietknietym'),
}


def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); r = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5)
    return ((c - r) / d, (c + r) / d)


wynik, raport = [], []
for zad, faza, run1, run2 in PARY:
    r1, r2 = rows[(run1, f'scribe:faza-{faza}')], rows[(run2, f'scribe:faza-{faza}')]
    f1, f2 = findings(prompt_of(r1)), findings(prompt_of(r2))
    t1, t2 = r1['start'], r2['start']
    commity = [l.split(' ', 1) for l in git('log', '--reflog', '--format=%H %s', f'--since={t1}', f'--until={t2}').strip().splitlines() if l]
    head2 = commity[0][0]
    head1 = git('rev-parse', commity[-1][0] + '^').strip()
    zmienione = {p for p in git('diff', '--name-only', head1, head2).split() if not p.startswith(('docs/', '.claude/'))}
    nowe = [f for f in f2 if not any(ten_sam(f, w) for w in f1)]
    raport.append(f"\n=== {zad} f{faza}: {run1} -> {run2}; HEAD1 {head1[:7]} HEAD2 {head2[:7]}; commity: "
                  + ', '.join(f'{s[:7]} {m[:40]}' for s, m in commity) + f"; plikow kodu {len(zmienione)}; run2 {len(f2)}, nowych {len(nowe)}")
    for f in nowe:
        plik, linia = plik_linia(f.get('plik'))
        opis = str(f.get('opis', ''))
        rec = {'para': f'{run1}->{run2}', 'zadanie': zad, 'sev': f.get('severity'), 'plik': f.get('plik'), 'opis': opis,
               'klasa': 'X', 'dryf_ok': None, 'odl_od_fixa': None, 'odwolanie_do_fixa': False, 'slowo_fix': bool(FIX_SLOWA.search(opis))}
        kod = plik and not plik.startswith(('docs/', 'CLAUDE.md'))
        if kod and linia:
            bl = git('blame', '-L', f'{linia},{linia}', '--porcelain', head2, '--', plik).split()
            sha = bl[0] if bl else None
            w_oknie = sha is not None and any(sha == s for s, _ in commity)
            rec['blame'] = (sha or '')[:7]
            rec['blame_commit'] = git('log', '--format=%s', '-1', sha).strip()[:70] if sha else None
            rec['klasa'] = 'A' if w_oknie else ('B' if plik in zmienione else 'C')
            rec['dryf_ok'] = dryf(plik, linia, opis, head2)
            h = hunki(head1, head2, plik)
            if h:
                rec['odl_od_fixa'] = min(0 if a <= linia <= b else min(abs(linia - a), abs(linia - b)) for a, b in h)
        elif kod:
            rec['klasa'] = ('B' if plik in zmienione else 'C') + '?'
        # odwolania w opisie do innych miejsc plik:linia lezacych w hunkach fixa
        for p2, l2 in re.findall(r'([\w./-]+\.(?:tsx?|sql|js|mjs)):(\d+)', opis):
            kand = [z for z in zmienione if z.endswith(p2)]
            for z in kand:
                if any(a - 3 <= int(l2) <= b + 3 for a, b in hunki(head1, head2, z)):
                    rec['odwolanie_do_fixa'] = True
        rec['sem'], rec['sem_uzasadnienie'] = RECZNE.get((rec['plik'], rec['sev']), ('FIX' if rec['klasa'] == 'A' else 'PRZEOCZONE', 'regula: blame'))
        wynik.append(rec)
        raport.append(f"  [{rec['klasa']}] {rec['sev']} {rec['plik']} | dryf_ok={rec['dryf_ok']} odl_fix={rec['odl_od_fixa']} "
                      f"odw_fix={rec['odwolanie_do_fixa']} slowo_fix={rec['slowo_fix']} | {opis[:150]}")

raport.append('\n=== ZESTAWIENIE ===')
for para in dict.fromkeys(w['para'] for w in wynik):
    c = collections.Counter(w['klasa'].rstrip('?') for w in wynik if w['para'] == para)
    raport.append(f'{para}: {dict(c)}')
c = collections.Counter(w['klasa'].rstrip('?') for w in wynik)
raport.append(f'RAZEM {len(wynik)}: {dict(c)}')
B = [w for w in wynik if w['klasa'] == 'B']
raport.append(f"B blisko fixa (<= {BLISKO} linii od hunka): {sum(1 for w in B if w['odl_od_fixa'] is not None and w['odl_od_fixa'] <= BLISKO)}/{len(B)}")
raport.append(f"B/C z odwolaniem do linii fixa lub slowem 'fix' w opisie: {sum(1 for w in wynik if w['klasa'] in ('B', 'C', 'C?', 'B?') and (w['odwolanie_do_fixa'] or w['slowo_fix']))}")
wf = [w for w in wynik if w['klasa'] in ('B', 'C') and str(w.get('blame_commit') or '').startswith('fix(')]
raport.append(f"B/C, ktorych linia urodzila sie we WCZESNIEJSZYM fixie (blame -> commit fix(...) sprzed okna): {len(wf)} -> "
              + '; '.join(f"{w['sev']} {w['plik']} [{w['blame']}]" for w in wf))
raport.append('\n=== KLASA SEMANTYCZNA (blame + RECZNE) ===')
for para in dict.fromkeys(w['para'] for w in wynik):
    c = collections.Counter(w['sem'] for w in wynik if w['para'] == para)
    kod = [w for w in wynik if w['para'] == para and w['sem'] != 'SRODOWISKO']
    prz = sum(1 for w in kod if w['sem'] == 'PRZEOCZONE')
    raport.append(f"{para}: {dict(c)} | przeoczone/kod = {prz}/{len(kod)} = {prz / len(kod):.0%}")
for etykieta, zb in (('wszystkie', wynik), ('tylko P1/P2', [w for w in wynik if w['sev'] in ('P1', 'P2')]),
                     ('D1 (pary 1-2)', [w for w in wynik if not w['para'].endswith('feed7bad-902')])):
    kod = [w for w in zb if w['sem'] != 'SRODOWISKO']
    c = collections.Counter(w['sem'] for w in kod)
    lo, hi = wilson(c['PRZEOCZONE'], len(kod))
    raport.append(f"{etykieta}: n_kod={len(kod)} {dict(c)} | PRZEOCZONE {c['PRZEOCZONE'] / len(kod):.0%} (95% Wilson {lo:.0%}-{hi:.0%}, "
                  f"bez efektu klastra — 3 pary, 2 zadania, 1 repo) | FIX+LANCUCH {(c['FIX'] + c['LANCUCH']) / len(kod):.0%}")
kod = [w for w in wynik if w['sem'] != 'SRODOWISKO']
for opis_w, zmien in (('bez RECZNE->FIX dla help-page:43 (najslabsza ocena)', {'apps/dashboard/src/features/help/help-page.tsx:43'}),
                      ('bez zadnego RECZNE->FIX w kodzie (sam blame; CLAUDE.md zostaje FIX)', {'apps/dashboard/src/features/help/help-page.tsx:43',
                       'apps/dashboard/src/features/onboarding/use-first-steps.ts:293', 'apps/server/src/access/invitation-service.ts:265'})):
    prz = sum(1 for w in kod if w['sem'] == 'PRZEOCZONE' or w['plik'] in zmien)
    prz12 = sum(1 for w in kod if not w['para'].endswith('feed7bad-902') and (w['sem'] == 'PRZEOCZONE' or w['plik'] in zmien))
    n12 = sum(1 for w in kod if not w['para'].endswith('feed7bad-902'))
    raport.append(f"wrazliwosc — {opis_w}: PRZEOCZONE {prz}/{len(kod)} = {prz / len(kod):.0%}; pary 1-2: {prz12}/{n12} = {prz12 / n12:.0%}")
raport.append('Wyjatki RECZNE z uzasadnieniem:')
for (pl, sv), (k, u) in RECZNE.items():
    raport.append(f'  {sv} {pl} -> {k}: {u}')
d = [w['dryf_ok'] for w in wynik if w['dryf_ok'] is not None]
raport.append(f"dryf: identyfikator z opisu w oknie +-5 linii: {sum(d)}/{len(d)} (reszta: {len([w for w in wynik if w['dryf_ok'] is None and w['klasa'] != 'X'])} bez identyfikatora)")
json.dump(wynik, open(S + 'd1r-rewizja-atrybucji.json', 'w'), ensure_ascii=False, indent=1)
open(S + 'd1r-rewizja-atrybucji.txt', 'w').write('\n'.join(raport) + '\n')
print('\n'.join(raport))

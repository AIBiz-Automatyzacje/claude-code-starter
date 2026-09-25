#!/usr/bin/env python3
"""Test review (TEST-REVIEW-PLAN §4.1, §2.6) — wariant 0 = dzisiejszy pipeline z HEAD workspace-template, ucięty przed weryfikacją, z kontrolą bajtową.

Użycie: python3 skrypty/test_review_wariant0.py
Wyjście: skrypty/test-review-wariant0.js (review fazy), skrypty/test-review-wariant0-fix.js (kontrola diffu fixa, moduł §2.6),
         dane/test-review/wariant0-kontrola.json (hashe wycinków źródła i wyniku, lista różnic linii) — generator odmawia zapisu, gdy
         różnic jest więcej niż dozwolone (STOP §11: kontrola bajtowa wariantu 0 nie przechodzi).

Review fazy: tekst .claude/workflows/dev-docs-review-wf.js od początku do linii `phase('Verify')` BEZ ZMIAN poza: (1) meta (nazwa, opis — literał
wymagany przez harness), (2) linia `const e2eTryb = …` → stała 'pominiety' (tester E2E wyłączony we wszystkich wariantach, §3 pkt 4 — równoważne
usunięciu thunka, a nie rozjeżdża indeksów etykiet ani nie uruchamia retry testera). Dalej dopięty BEZ ZMIAN blok od `phase('Verify')` (bez samego
wywołania phase) do końca globalnego limitu P3, a po nim zwrot {findings, przebieg, pominieci} — to, co poszłoby do sceptyków.
Kontrola fixa: stałe PRE_SKAN_FIXA, REGRESJA_FIXA, funkcje preSkanFixaPrompt, regresjaFixaPrompt i zEffortemAP z .claude/workflows/dev-autopilot-wf.js
BEZ ZMIAN + wywołania jak w autopilocie (pre-skan haiku low, kontrola effort low) i zwrot pozycji jak `doPoprawki` (filtr console.log w testach)."""
import difflib, hashlib, json, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = os.path.abspath(os.path.join(BASE, '..', '..', '..'))
REVIEW = os.path.join(SZ, '.claude', 'workflows', 'dev-docs-review-wf.js')
AUTOPILOT = os.path.join(SZ, '.claude', 'workflows', 'dev-autopilot-wf.js')
OUT_JS = os.path.join(BASE, 'skrypty', 'test-review-wariant0.js')
OUT_FIX = os.path.join(BASE, 'skrypty', 'test-review-wariant0-fix.js')
OUT_K = os.path.join(BASE, 'dane', 'test-review', 'wariant0-kontrola.json')
# wycinki, które muszą być bajt w bajt jak w źródle (TEST-REVIEW-PLAN §4.1)
WYCINKI = ['const BLOK_ZAUFANIE', 'const BLOK_LIMIT_P3', 'const BLOK_SEMANTYKA', 'const BLOK_DLUGIE_KOMENDY', 'const FINDINGS', 'const KONTEKST',
           'const REVIEWERZY', 'function rereviewBlok', 'function mapaBlok', 'function kontekstPrompt', 'function zrodlaBlok', 'function reviewerPrompt',
           'function testCoveragePrompt', 'const WARUNKI', 'const TIERY_DOMYSLNE', 'const poKluczu', 'if (dedup.length > 1)', 'function wybierzNity']


def sha(t):
    return hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]


def wycinek(tekst, poczatek):
    """Deklaracja od linii zaczynającej się `poczatek` do jej końca: linia zamykająca w kolumnie 0 (`}` / `]` …) albo ta sama linia,
    gdy deklaracja jest jednolinijkowa."""
    i = tekst.index('\n' + poczatek) + 1
    pierwsza_koniec = tekst.index('\n', i)
    if not tekst[i:pierwsza_koniec].rstrip().endswith(('{', '[', '(', '`', '=')):
        return tekst[i:pierwsza_koniec]
    m = re.compile(r'\n[\]}][^\n]*').search(tekst, pierwsza_koniec)
    return tekst[i:m.end() if m else len(tekst)]


def review():
    src = open(REVIEW, encoding='utf-8').read()
    i_verify = src.index("\nphase('Verify')\n") + 1
    i_p8 = src.index('\n// Poprawka 8:', i_verify)
    przed = src[:i_verify]
    blok_p3 = src[i_verify + len("phase('Verify')\n"):i_p8 + 1]
    i_meta_koniec = przed.index('\n}\n') + 3
    meta = ("export const meta = {\n  name: 'test-review-wariant0',\n  description: 'Test review (TEST-REVIEW-PLAN §4.1): dev-docs-review-wf.js z HEAD szablonu "
            "ucięty przed Verify — packager, reviewerzy wg routingu, dedup JS+haiku, globalny limit P3; tester E2E wyłączony; zwrot findingów przed weryfikacją',\n"
            "  phases: [\n    { title: 'Review', detail: 'context-packager + reviewerzy równolegle wg routingu domenowego (bez testera E2E)' },\n  ],\n}\n")
    stara_e2e = re.search(r"^const e2eTryb = !domenaE2E\n  \? 'pominiety'\n  : \(srodowiskoE2E !== undefined && srodowiskoE2E !== 'gotowe'\) \? 'bez-przegladarki' : 'przegladarka'\n", przed, re.M)
    assert stara_e2e, 'nie znaleziono linii e2eTryb — źródło zmienione, generator do przeglądu'
    nowa_e2e = "const e2eTryb = 'pominiety' // TEST REVIEW (§3 pkt 4): tester E2E wyłączony we wszystkich wariantach; routing domeny liczony bez zmian\n"
    tresc = meta + przed[i_meta_koniec:].replace(stara_e2e.group(0), nowa_e2e)
    zwrot = ("// TEST REVIEW: zwrot przed weryfikacją — to, co poszłoby do sceptyków (P1/P2 poza OPERATOR) + nity po globalnym limicie P3 + OPERATOR\n"
             "const doSedziego = [...doWeryfikacji, ...e2eBezVerify, ...nity, ...operatorowe]\n"
             "return {\n  findings: doSedziego.map((f) => ({ ...f, _zrodlo: f._zrodlo })),\n  przebieg: { aktywni: aktywni.map((r) => r.key), plikiFazy: plikiFazy.length, plikiKodu,\n"
             "    warstwy, e2eTryb, poDedupJs, poDedupSem: dedup.length, p3Odrzucone, dossier: !!(kontekst && kontekst.ctxZapisany),\n"
             "    diffZapisany: !!(kontekst && kontekst.diffZapisany), diffUciety: !!(kontekst && kontekst.diffUciety), kontekstNull: !kontekst,\n"
             "    nulle: wyniki.map((w, i) => (w ? null : etykietyZrodel[i])).filter(Boolean) },\n  pominieci,\n"
             "  kontekst, // mapa zmian packagera — wejście mapaBlok() sceptyków wariantu 0 w kroku weryfikacji (§6)\n}\n")
    wynik = tresc + '\n' + blok_p3 + '\n' + zwrot
    # kontrola: różnice linii względem źródła tylko w meta, w linii e2eTryb i w dopisanym zwrocie
    zrodlo_do_p8 = src[:i_p8 + 1]
    diff = [l for l in difflib.unified_diff(zrodlo_do_p8.splitlines(), wynik.splitlines(), lineterm='', n=0)
            if l[:1] in '+-' and not l.startswith(('+++', '---'))]
    dozwolone = set(meta.splitlines()) | set(src[:src.index('\n}\n') + 3].splitlines()) | set(stara_e2e.group(0).splitlines()) \
        | set(nowa_e2e.splitlines()) | set(zwrot.splitlines()) | {"phase('Verify')", ''}
    niedozwolone = [l for l in diff if l[1:] not in dozwolone]
    hashe = {w: {'zrodlo': sha(wycinek(src, w)), 'wynik': sha(wycinek(wynik, w))} for w in WYCINKI}
    rozne = [w for w, h in hashe.items() if h['zrodlo'] != h['wynik']]
    return wynik, {'zrodlo': os.path.relpath(REVIEW, SZ), 'zrodlo_sha': sha(src), 'linie_zrodla_do_verify': zrodlo_do_p8.count('\n'),
                   'linie_roznic': diff, 'roznice_niedozwolone': niedozwolone, 'wycinki': hashe, 'wycinki_rozne': rozne}


def fix():
    src = open(AUTOPILOT, encoding='utf-8').read()
    czesci = {n: wycinek(src, n) for n in ('const PRE_SKAN_FIXA', 'const REGRESJA_FIXA', 'function preSkanFixaPrompt', 'function regresjaFixaPrompt',
                                            'const zEffortemAP')}
    for n, t in czesci.items():
        assert t.count('\n') > 0 or n == 'const zEffortemAP', n
    wywolania = [l.strip() for l in src.splitlines() if 'agent(preSkanFixaPrompt(' in l or 'agent(regresjaFixaPrompt(' in l]
    assert len(wywolania) == 2, wywolania
    meta = ("export const meta = {\n  name: 'test-review-wariant0-fix',\n  description: 'Test review (§2.6): kontrola diffu fixa z dev-autopilot-wf.js bez zmian — pre-skan (haiku, low) i fix:kontrola (low)',\n"
            "  phases: [{ title: 'Kontrola', detail: 'pre-skan + kontrola regresji i bramek' }],\n}\n")
    ciało = ("const sciezka = args && args.sciezka\nconst numerFazy = args && args.faza\nphase('Kontrola')\n"
             "// wywołania skopiowane z dev-autopilot-wf.js (efort i model jak w autopilocie)\n"
             + '\n'.join(wywolania) + "\n"
             "// zwrot jak doPoprawki w autopilocie (filtr console.log w plikach testowych w JS)\n"
             "const doPoprawki = []\n"
             "if (preSkan && Array.isArray(preSkan.trafienia)) {\n"
             "  for (const t of preSkan.trafienia.filter((t) => !(t.wzorzec === 'console-log' && /\\.(test|spec)\\./i.test(t.plik || '')))) doPoprawki.push({ zrodlo: 'pre-skan', wzorzec: t.wzorzec, plik: t.plik, opis: 'commit fix wprowadzil: ' + t.linia })\n"
             "}\n"
             "if (regresja) {\n"
             "  for (const r of regresja.regresje || []) doPoprawki.push({ zrodlo: 'regresja', plik: r.plik, opis: r.opis })\n"
             "  for (const b of (regresja.bramki || []).filter((b) => !b.testOdmowy)) doPoprawki.push({ zrodlo: 'bramka-bez-testu-odmowy', plik: b.plik, opis: 'nowa bramka walidacyjna (' + b.opis + ') nie ma testu ODMOWY. Wektory do pokrycia: ' + (b.wektory || []).join(' | ') })\n"
             "}\n"
             "return { projekt: '0', tryb: 'fix', findings: doPoprawki.map((p) => ({ ...p, waga: 'P2' })), przebieg: { preSkanNull: !preSkan, regresjaNull: !regresja } }\n")
    wynik = meta + '\n' + '\n\n'.join(czesci.values()) + '\n\n' + ciało
    hashe = {n: {'zrodlo': sha(t), 'wynik': sha(wycinek(wynik, n))} for n, t in czesci.items()}
    return wynik, {'zrodlo': os.path.relpath(AUTOPILOT, SZ), 'zrodlo_sha': sha(src), 'wywolania': wywolania, 'wycinki': hashe,
                   'wycinki_rozne': [n for n, h in hashe.items() if h['zrodlo'] != h['wynik']]}


def main():
    js, k_rev = review()
    js_fix, k_fix = fix()
    kontrola = {'review': k_rev, 'fix': k_fix,
                'przechodzi': not k_rev['roznice_niedozwolone'] and not k_rev['wycinki_rozne'] and not k_fix['wycinki_rozne']}
    os.makedirs(os.path.dirname(OUT_K), exist_ok=True)
    json.dump(kontrola, open(OUT_K, 'w'), ensure_ascii=False, indent=1)
    if not kontrola['przechodzi']:
        raise SystemExit('STOP §11: kontrola bajtowa wariantu 0 nie przechodzi — %s' % OUT_K)
    open(OUT_JS, 'w').write(js)
    open(OUT_FIX, 'w').write(js_fix)
    print('wariant 0: %s (%d B), różnice linii względem źródła: %d (wszystkie dozwolone), wycinki bajt w bajt: %d/%d' % (
        os.path.relpath(OUT_JS, BASE), len(js.encode()), len(k_rev['linie_roznic']), len(WYCINKI) - len(k_rev['wycinki_rozne']), len(WYCINKI)))
    print('wariant 0 fix: %s (%d B), wycinki bajt w bajt: %d/%d, wywołania: %s' % (
        os.path.relpath(OUT_FIX, BASE), len(js_fix.encode()), len(k_fix['wycinki']) - len(k_fix['wycinki_rozne']), len(k_fix['wycinki']), k_fix['wywolania']))


if __name__ == '__main__':
    main()

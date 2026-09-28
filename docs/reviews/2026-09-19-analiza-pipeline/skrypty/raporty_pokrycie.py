#!/usr/bin/env python3
"""Kontrola raportów etapu 5 w obie strony (HANDOFF 6a pkt 35; wzór: panel_wynik_pokrycie.py).

Użycie: python3 skrypty/raporty_pokrycie.py → dane/raporty-pokrycie.txt (kod 1, gdy czegoś brakuje)
Część A — źródła → raporty: pozycja = (źródło, nazwa, regex, gdzie); gdzie: 'O' = RAPORT-DLA-OPERATORA.md, 'T' = RAPORT-TECHNICZNY.md,
'*' = którykolwiek. Regex wąski (nazwa własna rzeczy): brak trafienia = prawie na pewno brak pozycji; trafienie nie dowodzi pełności opisu.
Źródła: HANDOFF 6a pkt 1–35, PANEL-WEJSCIE §8 (tezy) i §9 (ograniczenia + trzy zdania z ETAP2 §6), PANEL-WYNIK §1–§6, zadanie sesji (6a pkt 35).
Część B — raporty → źródła: każda liczba z przecinkiem dziesiętnym, procentem, „M”, „k”/„tys.” albo ≥ 11 musi wystąpić (po zaokrągleniu do tej samej
liczby miejsc) w korpusie: dane/*.txt|json|csv, dane/test-review/*.txt|json, dokumenty .md etapów (bez samych raportów). Przeliczenia jawne —
lista PRZELICZENIA z powodem."""
import glob, json, os, re, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAPORTY = {'O': 'RAPORT-DLA-OPERATORA.md', 'T': 'RAPORT-TECHNICZNY.md'}
POZYCJE = [
    # --- HANDOFF 6a pkt 1–35 ---
    ('6a pkt 1', 'CLAUDE.md: nikt nie dopisuje, uzgodnienie po merge’u, docs/decisions', r'po merge', '*'),
    ('6a pkt 1', 'docs/decisions', r'docs/decisions', '*'),
    ('6a pkt 2', 'dev-pr: 4 zmiany, sufit 3 tur, rekomendacja', r'dev-pr', 'T'),
    ('6a pkt 2', 'dev-pr w wersji operatora (bot, klasyfikacja uwag)', r'[Bb]ot', 'O'),
    ('6a pkt 3', 'higiena konta', r'[Hh]igien', 'O'),
    ('6a pkt 3', 'higiena konta w spisie', r'[Hh]igien', 'T'),
    ('6a pkt 4, 17', 'learned-patterns 3 poziomy, limit dotyczy indeksu', r'3 poziomy|trzech poziom', 'T'),
    ('6a pkt 5', 'coding-rules', r'coding-rules', '*'),
    ('6a pkt 6', 'profil stacku', r'profil\w* stacku', 'T'),
    ('6a pkt 7', 'enabledPlugins per projekt', r'enabledPlugins', 'O'),
    ('6a pkt 7', '/doctor, /skill-doctor, /plugin stats', r'skill-doctor', 'O'),
    ('6a pkt 8', 'budżet pliku', r'budżet\w* (pliku|rozmiaru)', '*'),
    ('6a pkt 9, 15', 'reguły paths: = bonus', r'paths:', 'T'),
    ('6a pkt 10', 'MCP per agent (Figma przy figma_screens, Supabase MCP w sesji głównej)', r'figma_screens|makiety', '*'),
    ('6a pkt 11', 'zmiany .coderabbit.yaml przed pomiarem (B0)', r'coderabbit', 'T'),
    ('6a pkt 12', 'doctor + „Wymagania” w README', r'Wymagania', 'T'),
    ('6a pkt 13', 'szablon jako plugin — nie teraz', r'jako plugin', 'T'),
    ('6a pkt 14', 'styl: problem → przyczyna → co robimy → co to daje', r'\*\*Przyczyna\.\*\*|\*\*Problem\.\*\*', 'O'),
    ('6a pkt 15', 'allowlista tools: u wszystkich agentów', r'allowlist', '*'),
    ('6a pkt 15', 'omitClaudeMd tylko u mechanicznych, CLAUDE.md u builderów i reviewerów', r'omitClaudeMd', 'T'),
    ('6a pkt 15', 'fix bez dodatkowej rundy review', r'bez re-review|zamiast kolejnej rundy|bez kolejnej rundy', '*'),
    ('6a pkt 15', 'fix tylko P1/P2', r'tylko P1/P2', '*'),
    ('6a pkt 16, 21', 'mini-run', r'[Mm]ini-run', '*'),
    ('6a pkt 17', 'sceptyk asymetryczny', r'asymetryczn|bez uzasadnienia autora', '*'),
    ('6a pkt 17', '8 zabezpieczeń learned-patterns', r'8 zabezpiecze', 'T'),
    ('6a pkt 17', 'zielony main w bootstrapie', r'zielony main', 'T'),
    ('6a pkt 18 L7', 'L7', r'\bL7\b', 'T'), ('6a pkt 18 L8', 'L8 w wersji operatora', r'\bL8\b', 'O'),
    ('6a pkt 18 L10', 'L10 advisors chmura', r'advisors', '*'), ('6a pkt 18 L11', 'L11 E2E → MANUAL', r'MANUAL|na ręczny', '*'),
    ('6a pkt 18 L13', 'L13 /bugfix', r'bugfix', 'T'), ('6a pkt 18 L14', 'L14 hook error-handling, kieran/simplicity', r'kieran', 'T'),
    ('6a pkt 18 L17', 'L17 koszt wdrożenia nie jest kryterium', r'\bL17\b', 'T'), ('6a pkt 18 L19', 'L19 generator coderabbit', r'\bL19\b', 'T'),
    ('6a pkt 18', 'telemetria mechaniczna, zero agentów', r'[Tt]elemetri', 'O'),
    ('6a pkt 18', 'budżet instrukcji: warstwa stała < 150', r'< ?150', 'T'),
    ('6a pkt 18', 'pliki agentów per klasa roli', r'plik\w* klas', 'T'),
    ('6a pkt 19', 'scalenie dev-plan + dev-docs', r'dev-plan', '*'),
    ('6a pkt 19', 'E2E → [MANUAL] trafia do smoke', r'smoke', '*'),
    ('6a pkt 19', 'mapa walidacji (D5b)', r'MAPA-WALIDACJI|mapa walidacji|d5b-mapa', '*'),
    ('6a pkt 20', 'usunięcia koszyka D, dev-ideate, freshness-audit, tryb ręczny', r'freshness-audit', 'T'),
    ('6a pkt 20', 'cleanupPeriodDays 120', r'cleanupPeriodDays', 'O'),
    ('6a pkt 20', 'szablon mobile osobno', r'mobil', '*'),
    ('6a pkt 21', 'N1 zdanie w poleceniu startu', r'\bN1\b', 'T'), ('6a pkt 21', 'N2 nowa sesja po zmianach .claude/', r'N2', 'O'),
    ('6a pkt 22', 'model: Opus 5.5', r'Opus 5\.5', 'T'),
    ('6a pkt 23', 'panel decyzyjny zamiast projektowego', r'panel decyzyjny', 'T'),
    ('6a pkt 24, 25', 'prompt-audit jako obszar cykliczny', r'prompt-audit', 'T'),
    ('6a pkt 26 a', 'compound ze szczeblem', r'szczebl', 'T'), ('6a pkt 26 d', 'odbiór bramek testem porażki', r'test\w* porażki', 'T'),
    ('6a pkt 26 f', 'ślepy test zmian promptów', r'ślep', '*'), ('6a pkt 26 g', 'zadanie sprzątające ESLint', r'sprzątając', 'O'),
    ('6a pkt 26 h', 'skill weryfikacji z mapą funkcji', r'mapą funkcji|mapa funkcji', 'T'),
    ('6a pkt 26 i', 'granice warstw w ESLint', r'granic\w* warstw', 'T'), ('6a pkt 26 j', 'ogrodnik', r'[Oo]grodnik', '*'),
    ('6a pkt 27', 'D12 wchodzi do panelu', r'D12', 'T'), ('6a pkt 28', 'ocena papierowa przecenia', r'papier', 'T'),
    ('6a pkt 29', 'test review: klucz 1 / klucz 2', r'klucz', 'T'), ('6a pkt 30', 'etap główny 13 faz, jeden przebieg', r'13 faz', '*'),
    ('6a pkt 31', 'wynik etapu głównego (TEST-REVIEW-WYNIK)', r'TEST-REVIEW-WYNIK', '*'),
    ('6a pkt 32', 'obecna architektura zostaje + 3 dodatki', r'6 osobnych reviewerów|[Ss]ześciu recenzentów', '*'),
    ('6a pkt 33', 'run 3 pominięty', r'panel_run3|run 3', 'T'), ('6a pkt 34', 'allowlista jako R1 w It. 3', r'R1', 'T'),
    ('6a pkt 35', 'forma skrócona, bez publikacji', r'[Ff]orma skrócona', '*'),
    # --- PANEL-WEJSCIE §8: tezy na jednym filarze ---
    ('PW §8', 'teza: kontekst 40–50%', r'40–50%', 'T'), ('PW §8', 'teza: listy 60–70%', r'60–70%', '*'),
    ('PW §8', 'teza: review kodu naprawczego', r'kodu naprawczego', 'T'), ('PW §8', 'teza: bramki nie kasują osi', r'nie kasują', 'T'),
    ('PW §8', 'teza: test-coverage do zdegradowania', r'zdegradowania', 'T'), ('PW §8', 'teza: sceptyk ~4×', r'4×|czterokrotn', '*'),
    ('PW §8', 'teza: model kosztu opisuje dzisiejszy szablon', r'N1–N9', '*'),
    ('PW §8', 'tezy prostymi słowami w wersji operatora', r'Co może się nie udać', 'O'),
    # --- PANEL-WEJSCIE §9: ograniczenia L6–L18 + trzy zdania ETAP2 §6 ---
    *[('PW §9', 'ograniczenie ' + l, r'\*\*' + l + r'\*\*', 'T') for l in ('L6', 'L7', 'L8', 'L9', 'L10', 'L13', 'L16', 'L18')],
    ('PW §9 / ETAP2 §6', 'lekcja 1: reguły w tekście pomijane; bot łapie modelem, nie linterem', r'modelem, nie linterem', 'O'),
    ('PW §9 / ETAP2 §6', 'lekcja 2: powtarzanie review', r'[Pp]owtarzanie recenzji', 'O'),
    ('PW §9 / ETAP2 §6', 'lekcja 3: sceptyk dostaje odpowiedź razem z pytaniem', r'nie powinien znać odpowiedzi autora', 'O'),
    ('PW §9', 'L16 prostymi słowami (miara zmienna bez zmian pipeline’u)', r'12,8', 'O'),
    ('PW §9', 'L6 prostymi słowami (sceptyk może kasować prawdziwe)', r'kasować prawdziwe', 'O'),
    # --- PANEL-WYNIK §1: pokrętła K1–K13 ---
    *[('PWY §1', 'pokrętło K%d' % i, r'\bK%d\b' % i, 'T') for i in range(1, 14)],
    # --- PANEL-WYNIK §2: D1–D12 ---
    *[('PWY §2', 'decyzja D%s' % d, r'\bD%s\b' % d, 'T') for d in ('1', '2', '3', '4', '5', '6', '7', '8a', '8b', '9', '10', '11', '12')],
    # --- PANEL-WYNIK §3 ---
    ('PWY §3 pkt 1', 'performance zostaje', r'performance\*\* — zostaje|[Ww]ydajności .*zostaj|wydajności 7 trafień', '*'),
    ('PWY §3 pkt 2', 'security nie skracany bez ślepego testu', r'ślepego testu', '*'),
    ('PWY §3 pkt 3', 'code-quality: lint jako wejście', r'lint jako wejście|warn/knip jako wejście', 'T'),
    ('PWY §3 pkt 4', 'test-coverage scalone wypada', r'zał\. 2, 3, 6|zostaje osobno', 'T'),
    ('PWY §3 pkt 5', 'listy per oś', r'per oś|po jednej osi', '*'), ('PWY §3 pkt 6', 'PA-01…07 po ślepym teście', r'PA-01', 'T'),
    # --- PANEL-WYNIK §4: iteracje ---
    *[('PWY §4', 'iteracja %d' % i, r'It\. ?%d|· %d[a-e ,]' % (i, i), 'T') for i in range(1, 10)],
    *[('PWY §4', 'krok %d w wersji operatora' % i, r'krok\w* %d' % i, 'O') for i in (1, 2, 3, 4, 5, 8)],
    ('PWY §4', 'czas planu ≈ 2 miesiące', r'2 miesiące|dwóch\s+miesięcy', '*'),
    # --- PANEL-WYNIK §4a A–K ---
    ('PWY §4a A', 'learned-patterns wycinek po katalogach', r'wycinek', 'T'), ('PWY §4a B', 'scalony dev-plan', r'[Ss]calon', '*'),
    ('PWY §4a C', 'zamknięty słownik klas', r'słownik', 'T'), ('PWY §4a D', 'correctness własny plik agenta', r'własny plik', 'T'),
    ('PWY §4a E', 'precheck → env-up', r'precheck', 'T'), ('PWY §4a E', 'dev-docs-review-wf.js:904', r'904', 'T'),
    ('PWY §4a E', 'REVIEWERZY:368', r'368', 'T'), ('PWY §4a F', 'seedy z właścicielem', r'seed', 'T'),
    ('PWY §4a F', '__tests__', r'__tests__', 'T'), ('PWY §4a F', 'claude plugin validate', r'validate', 'T'),
    ('PWY §4a F', 'smoke-autopilot', r'smoke-autopilot', 'T'), ('PWY §4a G', 'learnings-researcher.md:256', r'learnings-researcher', 'T'),
    ('PWY §4a H', 'PA-25, PA-26', r'PA-25', 'T'), ('PWY §4a I', 'statusLine', r'statusLine', '*'),
    ('PWY §4a J', 'regresja po funkcjach odłożona', r'regresj', 'T'), ('PWY §4a K', 'dwa raporty etapu 5', r'RAPORT-TECHNICZNY', 'O'),
    # --- PANEL-WYNIK §5 i §6 ---
    ('PWY §5', 'docelowy pipeline: co znika', r'[Zz]nika', '*'),
    ('PWY §5', 'dźwignie nie sumują się', r'nie sumuj', '*'),
    ('PWY §6 pkt 1', 'pokrętła = górna granica', r'górna granica|górną granicą', '*'),
    ('PWY §6 pkt 3', 'sceptycy B na własnych findingach', r'własne findingi', 'T'),
    ('PWY §6 pkt 4', '„nowy plik” ≈ nowa funkcjonalność', r'nowa funkcjonalność', 'T'),
    ('PWY §6 pkt 8', 'diff PA sprawdzony na 46e854b', r'46e854b', 'T'),
    # --- zadanie sesji (6a pkt 35 / instrukcja §8) ---
    ('zadanie 1', 'koszt „po” z zastrzeżeniem dolnej granicy', r'dolna granica|dolną granicą', 'O'),
    ('zadanie 1', 'koszt „po”: wkład allowlisty osobno', r'−40', '*'),
    ('zadanie 2', 'czego wymaga: 2–3 zadania na B0', r'[Dd]wóch–trzech zadań|2–3 zadań', 'O'),
    ('zadanie 2', 'czego wymaga: nowe sesje po zmianach .claude/', r'[Nn]owej sesji po każdej zmianie', 'O'),
    ('zadanie 2', 'jak czytać pierwszy pomiar', r'Jak za miesiąc', 'O'),
    ('zadanie 2', 'mapa gdzie jesteśmy / co dalej / czego chcesz', r'Gdzie jesteśmy, co dalej, czego od Ciebie chcę', 'O'),
    ('operator 2026-09-27', 'oferty-online = materiał do nauki, pomiar na nowych projektach', r'materiał do nauki', '*'),
    ('operator 2026-09-27', 'B0 na nowym projekcie', r'nowego projektu', 'O'),
    ('operator 2026-09-27', 'narzędzie do przeglądu konta per poziom', r'konto_inwentarz', 'O'),
    ('operator 2026-09-27', 'plan naprawy konta z komendami', r'Plan naprawy', 'O'),
    ('operator 2026-09-27', 'stan docelowy konta w spisie', r'Stan docelowy', 'T'),
    ('operator 2026-09-28', 'higiena konta = krok 0 przed It. 1, decyzje z operatorem', r'KROK 0', '*'),
    ('zadanie 3', 'mapa plików analizy', r'Mapa plików', 'T'), ('zadanie 3', 'zapisy nieaktualne', r'NIEAKTUALNE', 'T'),
    ('zadanie 3', 'szybkie zyski It. 3c', r'Szybkie zyski', 'T'), ('zadanie 3', 'ścieżki do danych i skryptów', r'Dane i skrypty', 'T'),
]
# przeliczenia jawne: liczba z raportu -> (powód, liczba źródłowa)
PRZELICZENIA = {
    '2,5': 'bramki ≤ 143 s na fazę (TEST-REVIEW-WYNIK §7) = ~2,4 min, zaokrąglone „~2,5 minuty”',
    '−64,1': 'suma naiwna −51,2 + (−12,9) — dane/raport-koszt-po.txt §3 podaje −64.1',
    '19,3': 'K1 + K2 + K4 + K9 = 11,0 + 1,1 + 5,2 + 2,0 (dane/pokretla-kosztu.txt POKRĘTŁA)',
    '120': 'cleanupPeriodDays = 120 dni (HANDOFF 6a pkt 20)',
    '150': 'PR ≤ 150 plików; warstwa stała < 150 (PANEL-WYNIK It. 3c, It. 9)',
}
# część C (mocna): liczba z raportu → konkretny plik i dokładny napis w nim. (raport, napis w raporcie, plik źródła, napis w źródle)
KP = 'dane/raport-koszt-po.txt'
KLUCZOWE = [
    ('O', '52,0 M', KP, 'zadanie  52.04 M'), ('O', '22,4 M', KP, 'zadanie  22.37 M'), ('O', '12,75 → 5,65', KP, 'faza   5.65 M'),
    ('O', '−57%', KP, '-57.0% vs dzis'), ('O', '−51%', KP, 'S0 -> S2: zadanie  -51.2%'), ('O', '−40%', KP, 'S0 -> S1: zadanie  -40.2%'),
    ('O', '−18%', KP, 'S1 -> S2: zadanie  -18.3%'), ('O', '−12%', KP, 'S2 -> S5: zadanie  -12.0%'), ('O', '−64%', KP, '= -64.1%'),
    ('O', 'około 123', KP, 'zadanie 122.8'), ('O', 'około 99', KP, 'zadanie 99.0'), ('O', 'około −2%', KP, '-2.4% vs S5'),
    ('T', '52,04 M†', KP, 'zadanie  52.04 M'), ('T', '31,10 M†', KP, 'zadanie  31.10 M'), ('T', '25,41 M†', KP, 'zadanie  25.41 M'),
    ('T', '45,31 M†', KP, 'zadanie  45.31 M'), ('T', '22,37 M†', KP, 'zadanie  22.37 M'), ('T', '−12,9%', KP, 'zadanie  -12.9%'),
    ('T', '−7,8%', KP, 'mechanika        -7.8%'), ('T', 'mechanika −4,4%', KP, '-4.4% zadania po kontekscie'),
    ('T', '(K1, K2, K4, K9) −4,5%', KP, '-4.5% zadania po kontekscie'), ('T', 'P2 −3,3%', KP, '-3.3% zadania po kontekscie'),
    ('T', '×0,492', KP, 'cel x0.492'), ('T', '×0,737', KP, 'cel x0.737'), ('T', '×0,927', KP, 'cel x0.927'), ('T', '×0,577', KP, 'cel x0.577'),
    ('T', '×1,066', KP, 'cel x1.066'), ('T', 'execute 28,7%', KP, 'S5: execute 28.7%'), ('T', '−15,9%', KP, 'te same starty): -15.9%'),
    ('T', '−58,0%', KP, '-58.0% vs dzis'), ('T', '< 0,1%', KP, 'ZGODNE (< 0,1%)'), ('T', '(S1 → S2, −18,3%)', KP, '-18.3%'),
    ('O', 'około 39%', 'dane/panel-koszt.txt', '(-39%)'), ('T', '~39%', 'dane/panel-koszt.txt', '(-39%)'),
    ('O', '~118 tys.', 'dane/mr-kontekst.txt', 'reviewer-opus-plik       dzis 118766'),
    ('O', 'od ~30 tys.', 'dane/mr-kontekst.txt', 'TOLk  29747'), ('O', '137 tys. znaków', 'dane/mr-kontekst.txt', '(137193 zn)'),
    ('O', '37 tys. znaków', 'dane/mr-kontekst.txt', '( 36942 zn)'), ('O', '30 tys. znaków listy skilli', 'dane/mr-kontekst.txt', 'skille  29988'),
    ('T', '118,8k → T 53,5k', 'dane/mr-kontekst.txt', 'T  53450'), ('O', '~970 narzędzi', 'dane/d5r-wykonalnosc-rekordu.txt', 'narzedzia 972, skille 309'),
    ('O', '498 z 514', 'HANDOFF.md', '498 z 514'), ('O', '1 z 97', 'POMIARY-ROZSTRZYGNIECIE.md', '**1 z 97**'),
    ('O', '45 z 68', 'HANDOFF.md', 'ETAP1 45/68'), ('O', '+72%', 'MINI-RUN-WYNIK.md', '(**+72%**)'),
    ('O', '15 z 30', 'TEST-REVIEW-WYNIK-DLA-OPERATORA.md', 'złapały po 15–16'), ('O', '1 z 12', 'TEST-REVIEW-WYNIK-DLA-OPERATORA.md', '(1 z 12)'),
    ('O', '6 z 12', 'TEST-REVIEW-WYNIK-DLA-OPERATORA.md', 'złapał 6 z 12'), ('O', '3 → 9', 'dane/pokretla-kosztu.txt', '"klucz1_0_A": [3, 9]'),
    ('O', '3 → 10', 'dane/pokretla-kosztu.txt', '"klucz1_0_A": [3, 10]'), ('O', '4 błędy', 'TEST-REVIEW-WYNIK-DLA-OPERATORA.md', 'złapały 4 błędy'),
    ('O', '12 z 25', 'PANEL-WYNIK.md', 'code-quality 12 (10 tylko on)'), ('O', '7 trafień', 'PANEL-WYNIK.md', '7 trafień tylko jego'),
    ('O', '16 dzisiejszych trafień', 'PANEL-WYNIK.md', 'security 16 (16)'), ('O', '7 sekund do 2 minut', 'PANEL-WYNIK.md', '7–126 s'),
    ('O', '14,0 vs 4,7', 'PANEL-WYNIK.md', '14,0 vs 4,7'), ('O', '0,46 M', 'PANEL-WYNIK.md', '0,46 M/commit'),
    ('O', '3,5 na 100', 'HANDOFF.md', '(3,5/100'), ('O', 'z 12,8 do 5,2', 'PANEL-WEJSCIE.md', '12,8 → 5,2/100'),
    ('O', '54–77 tys.', 'PANEL-WEJSCIE.md', '54–77k (opus) / 37–53k (haiku)'), ('O', 'około 48%', 'HANDOFF.md', 'dźwignia ≈48%'),
    ('O', '~9–10 tys.', 'PANEL-WYNIK.md', '9–10k / 25–26k / 29k / 38k'), ('T', '188 błędów', 'PANEL-WYNIK.md', '188 zastanych błędów'),
    ('T', '5 plików z klientem Supabase', 'PANEL-WYNIK.md', '5 plików z importem klienta Supabase'), ('O', '1–2 godzin', 'HANDOFF.md', '~1–2 h przekazań'),
    ('O', '~11% kosztu', 'HANDOFF.md', 'Telemetria widziała ~11%'), ('O', 'skasowali dwa', 'PANEL-WYNIK.md', 'zabiła 2 prawdziwe'),
    ('O', 'około 6 PR-ów tygodniowo', 'PANEL-WYNIK.md', '6,1 PR/tydzień'), ('T', 'a5e9b76', '../2026-09-19-przeglad-runow-po-naprawie.md', 'a5e9b76'),
    # konto (dane/konto-inwentarz-workspace-template.txt — skrypty/konto_inwentarz.py --koszt)
    ('O', '~42 tys. tokenów', 'dane/konto-inwentarz-workspace-template.txt', '~41939 tok na KAŻDĄ sesję'),
    ('O', '~30 tys.** (164 skille)', 'dane/konto-inwentarz-workspace-template.txt', 'skille 164, agenci 1, MCP posthog'),
    ('O', 'posthog ~30 tys.', 'dane/konto-inwentarz-workspace-template.txt', 'always-on ~30164 tok'),
    ('O', 'aibiz ~2,8 tys.', 'dane/konto-inwentarz-workspace-template.txt', 'always-on ~2790 tok'),
    ('O', 'strona-przez-rozmowe ~2,5 tys.', 'dane/konto-inwentarz-workspace-template.txt', 'always-on ~2462 tok'),
    ('O', 'figma ~2,1 tys.', 'dane/konto-inwentarz-workspace-template.txt', 'always-on ~2135 tok'),
    ('O', '~274 skilli', 'dane/konto-inwentarz-workspace-template.txt', 'RAZEM ~274 skilli'),
    ('O', '42 ze 121', 'dane/konto-inwentarz-workspace-template.txt', 'wpisów projektów 121, dla nieistniejących katalogów 42'),
    ('O', '9 serwerów MCP', 'dane/konto-inwentarz-workspace-template.txt', 'asana,atlassian,figma,gmail,google calendar,intercom,linear,notion,slack'),
    ('T', '~41,9k tok', 'dane/konto-inwentarz-workspace-template.txt', '~41939 tok'),
    ('T', '0 prawdziwych skasowanych vs dziś 2 z 21', 'PANEL-WYNIK.md', 'B z 21 złapanych'), ('T', '16,5 → 15,3', 'PANEL-WYNIK.md', '16,5 → 15,3'),
    ('T', '~12k zn', 'PANEL-WYNIK.md', '~12k zn w starcie'), ('T', ':819', 'PANEL-WYNIK.md', 'dev-docs-review-wf.js:819'),
    ('T', '6,1 PR/tydzień', 'dane/tempo-pr.txt', '6.1'),
]
NIE_LICZBY = re.compile(r'(§\s?\d+|It\.\s?\d+|pkt\s?\d+|\bL\d+\b|\bK\d+\b|\bD\d+\b|\bN\d\b|PA-\d+|20\d\d-\d\d-\d\d|\b\d{1,2}\.\d\d\b(?=\s|\)|,|\.)|'
                        r':\d+(-\d+)?|[0-9a-f]{7}\b|v\d|\bS\d\b|B0|W\d|R\d|\d+ PR|L-[A-Z]+-\d)')


def pokrycie(teksty):
    braki = []
    for z, n, rx, gdzie in POZYCJE:
        cele = teksty.values() if gdzie == '*' else [teksty[gdzie]]
        if not any(re.search(rx, t) for t in cele): braki.append((z, n, gdzie))
    return braki


def korpus():
    pliki = [p for p in glob.glob(os.path.join(BASE, 'dane', '*')) + glob.glob(os.path.join(BASE, 'dane', 'test-review', 'wynik*'))
             + glob.glob(os.path.join(BASE, '*.md')) + [os.path.join(os.path.dirname(BASE), '2026-09-19-przeglad-runow-po-naprawie.md')]
             if os.path.isfile(p) and os.path.basename(p) not in RAPORTY.values() and os.path.basename(p) != 'raporty-pokrycie.txt']
    wart = set()
    for p in pliki:
        try: t = open(p, encoding='utf-8').read()
        except UnicodeDecodeError: continue
        for m in re.finditer(r'\d+(?:[  ]\d{3})*(?:[.,]\d+)?', t):
            s = m.group(0).replace(' ', '').replace(' ', '').replace(',', '.')
            try: v = float(s)
            except ValueError: continue
            for d in (0, 1, 2, 3):
                wart.add(round(v, d)); wart.add(round(v / 1000, d)); wart.add(round(v / 1e6, d))
    return wart


def liczby_raportu(t):
    t2 = NIE_LICZBY.sub(' ', t)
    for m in re.finditer(r'[−-]?\d+(?:[  ]\d{3})*(?:,\d+)?\s?(%|M|k\b|tys\.?|min|s\b|pkt)?', t2):
        txt = m.group(0).strip()
        num = re.match(r'[−-]?\d+(?:[  ]\d{3})*(?:,\d+)?', txt).group(0)
        czysty = num.replace('−', '').replace('-', '').replace(' ', '').replace(' ', '')
        dec = len(czysty.split(',')[1]) if ',' in czysty else 0
        v = float(czysty.replace(',', '.'))
        if dec == 0 and not m.group(1) and v <= 10: continue   # małe liczby całkowite: kroki, punkty, liczebniki
        yield num, round(v, dec)


def main():
    teksty = {k: open(os.path.join(BASE, f), encoding='utf-8').read() for k, f in RAPORTY.items()}
    braki = pokrycie(teksty)
    L = ['raporty_pokrycie.py — kontrola raportów etapu 5 w obie strony', '',
         '=== A. Źródła → raporty (HANDOFF 6a pkt 1–35, PANEL-WEJSCIE §8–§9, PANEL-WYNIK §1–§6, zadanie sesji) ===',
         'pozycji %d, z miejscem %d, BRAK %d' % (len(POZYCJE), len(POZYCJE) - len(braki), len(braki))]
    L += ['  BRAK  %-18s [%s] %s' % (z, g, n) for z, n, g in braki]
    wart = korpus()
    bez = {}; n_all = 0
    for k, t in teksty.items():
        for num, v in liczby_raportu(t):
            n_all += 1
            if v in wart or num.replace('−', '') in PRZELICZENIA or num in PRZELICZENIA: continue
            bez.setdefault((k, num), 0); bez[(k, num)] += 1
    L += ['', '=== B. Raporty → źródła (liczby w korpusie dane/ + dokumenty etapów, po zaokrągleniu) ===',
          'liczb sprawdzonych %d, bez źródła %d' % (n_all, len(bez))]
    L += ['  BEZ ŹRÓDŁA  [%s] %s' % k for k in sorted(bez)]
    L += ['  przeliczenia jawne: ' + '; '.join('%s ← %s' % kv for kv in PRZELICZENIA.items())]
    L += ['  UWAGA: część B jest słaba (korpus ma ~70 tys. wartości — prawie każda liczba coś trafia); mocna kontrola = część C.']
    zle = []
    for rap, w_rap, plik, w_zr in KLUCZOWE:
        zr = os.path.normpath(os.path.join(BASE, plik))
        n = lambda s: re.sub(r'\s+', ' ', s)
        ok_r = n(w_rap) in n(teksty[rap])
        ok_z = os.path.exists(zr) and n(w_zr) in n(open(zr, encoding='utf-8').read())
        if not (ok_r and ok_z): zle.append((rap, w_rap, plik, w_zr, ok_r, ok_z))
    L += ['', '=== C. Liczby kluczowe → konkretny plik (napis w raporcie i dokładny napis w źródle) ===',
          'par %d, zgodnych %d, NIEZGODNYCH %d' % (len(KLUCZOWE), len(KLUCZOWE) - len(zle), len(zle))]
    L += ['  NIEZGODNE [%s] „%s” (w raporcie: %s) ← %s „%s” (w źródle: %s)' % (r, a, 'tak' if okr else 'NIE', p, b, 'tak' if okz else 'NIE')
          for r, a, p, b, okr, okz in zle]
    braki_c = zle
    open(os.path.join(BASE, 'dane', 'raporty-pokrycie.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))
    sys.exit(1 if braki or bez or braki_c else 0)


if __name__ == '__main__':
    main()

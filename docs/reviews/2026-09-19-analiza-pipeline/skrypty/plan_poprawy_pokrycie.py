#!/usr/bin/env python3
"""Kontrola kompletności PLAN-POPRAWY.md w obie strony (sesja planu poprawy, 2026-09-30).

Rejestr pozycji źródłowych = cała historia ustaleń, które plan ma wdrożyć albo jawnie odrzucić:
  - PANEL-WYNIK §2 (rekordy D2–D12), §3 (cofnięte ustalenia), §4 (wiersze It. 2–9, 3a–3e, R1), §4a (A–K), §5 („znika”);
  - 65 pozycji `panel_wynik_pokrycie.py` (HANDOFF 6a pkt 1–33 + PANEL-WEJSCIE §2, §2a, §7, §9, §10) — importowane z tamtego skryptu;
  - PA-01…PA-44 (PROMPT-AUDIT.md, wyciągane z pliku) i 62 hunki `dane/pa-proponowany.diff` (z nagłówka diffu);
  - INSPIRACJE A1–C6 + „nie bierzemy”; HANDOFF 6a pkt 20, 25, 26, 34, 36–40; IT1-ODCZYT §5–6; PANEL-WEJSCIE §2a/§10 spoza listy 65.

Sprawdzenia:
  (1) źródła → plan: każda pozycja (poza PA z hunkami) przypisana DOKŁADNIE raz — w linii `Pozycje:` (paczka, §1, §6) albo w §5 z powodem;
      PA z hunkami pokryte, gdy każdy ich hunk jest w którejś paczce;
  (2) plan → źródła: każdy tag w planie istnieje w rejestrze; każdy punkt `Zakres:` ma tag; każda pozycja z `Pozycje:` paczki występuje w jej `Zakres:`;
  (3) każdy hunk w dokładnie jednej linii `Hunki:`, a jego plik na liście `Pliki:` tej paczki;
  (4) każdy plik z `Pliki:` co najmniej dwóch paczek wymieniony w §4 „Wspólne pliki”.
Użycie: python3 skrypty/plan_poprawy_pokrycie.py → dane/plan-poprawy-pokrycie.txt, dane/plan-poprawy-mapa.csv, dane/plan-poprawy-pliki.txt (kod 1 przy brakach)."""
import csv
import importlib.util
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DANE = os.path.join(BASE, 'dane')

RE_TAG = re.compile(r'\[(PA-\d\d|H\d\d|W4-[\w-]+|R1-[\w-]+|D\d+[ab]?(?:-\d)?|S3-\d|[A-KZ]-[\w-]+|PW\d\d|INS-[\w-]+|6a-[\w-]+|IT1-\w+|PWE-[\w-]+)\]')

# ── Rejestr pisany ręcznie: (id, źródło, nazwa) ─────────────────────────────────────────────────────────────────────────────────────
RECZNE = [
    # PANEL-WYNIK §4 — wiersze tabeli iteracji
    ('W4-2a', 'PANEL-WYNIK §4 It. 2', 'generator coderabbit-base.yaml + 8 zmian .coderabbit.yaml'),
    ('W4-2b', 'PANEL-WYNIK §4 It. 2', '4 zmiany dev-pr + sufit 3 tur'),
    ('W4-2c', 'PANEL-WYNIK §4 It. 2', 'kalibracja klasyfikatora na 2–3 starych PR vs 1b'),
    ('W4-2d', 'PANEL-WYNIK §4 It. 2', 'B0 z 2–3 zadań bez zmian pipeline’u'),
    ('W4-2e', 'PANEL-WYNIK §4 It. 2', 'zadanie sprzątające ESLint w oferty-online'),
    ('W4-3', 'PANEL-WYNIK §4 It. 3', 'kontrola diffu fixa wg katalogu A (K-1…K-7, K-6 zastępuje verify-fix)'),
    ('W4-3pre', 'PANEL-WYNIK §4 It. 3', 'fix:pre-skan znika'),
    ('W4-3a-tools', 'PANEL-WYNIK §4 It. 3a', 'allowlista tools: + pliki klas ról'),
    ('W4-3a-omit', 'PANEL-WYNIK §4 It. 3a', 'omitClaudeMd dla mechanicznych'),
    ('W4-3a-n1', 'PANEL-WYNIK §4 It. 3a', 'zdanie N1 w poleceniu startu'),
    ('W4-3b', 'PANEL-WYNIK §4 It. 3b', 'efort jawny: reviewerzy high, sceptyk P2 medium, P1 high, mechaniczni haiku'),
    ('W4-3c-pr150', 'PANEL-WYNIK §4 It. 3c', 'PR ≤ 150 plików (bramka w dev-docs-complete)'),
    ('W4-3c-zielony', 'PANEL-WYNIK §4 It. 3c', 'zielony main w bootstrapie'),
    ('W4-3c-czystosc', 'PANEL-WYNIK §4 It. 3c', 'bramka czystości: brudny tylko katalog zadania → commit (rek. 4)'),
    ('W4-3c-rek7', 'PANEL-WYNIK §4 It. 3c', 'drobne z przeglądu runów rek. 7'),
    ('W4-3d', 'PANEL-WYNIK §4 It. 3d', 'packager → skrypt'),
    ('W4-3d-stan', 'PANEL-WYNIK §4 It. 3d', 'stan fazy w prompcie następcy zamiast stan:zapis'),
    ('W4-3e-env', 'PANEL-WYNIK §4 It. 3e', 'parametryzacja .env.e2e'),
    ('W4-3e-manual', 'PANEL-WYNIK §4 It. 3e', 'E2E → [MANUAL] z przejściem do smoke'),
    ('W4-3e-doctor', 'PANEL-WYNIK §4 It. 3e', 'sekcja Doctor przed startem'),
    ('W4-4a', 'PANEL-WYNIK §4 It. 4a', 'bramki lint/knip/size-limit/tsc/typecheck/migracje/advisors w domknięciu'),
    ('W4-4a-granice', 'PANEL-WYNIK §4 It. 4a', 'granice warstw w ESLint (§2 pkt 15)'),
    ('W4-4a-odbior', 'PANEL-WYNIK §4 It. 4a', 'każda bramka odebrana testem porażki (I3)'),
    ('W4-4b-stryker', 'PANEL-WYNIK §4 It. 4b', 'Stryker diff-scoped w skrypcie bramek (produkcja listy mutantów)'),
    ('W4-4b-review', 'PANEL-WYNIK §4 It. 4b', 'mutanty jako wejście test-coverage (ułożenie C) + efort medium'),
    ('W4-5', 'PANEL-WYNIK §4 It. 5', 'sceptyk asymetryczny + batch 4 dla P2'),
    ('W4-5pre', 'PANEL-WYNIK §4 It. 5', 'kill rate na archiwalnych findingach przed wdrożeniem'),
    ('W4-6', 'PANEL-WYNIK §4 It. 6', 'fix tylko P1/P2, P3 → known-issues/bot, zakaz zmian poza miejscem'),
    ('W4-7a', 'PANEL-WYNIK §4 It. 7a', 'polecenia-listy correctness z katalogu A (bez L-COR-6/7)'),
    ('W4-7b', 'PANEL-WYNIK §4 It. 7b', 'spec: listy L-SPC + sekcja planu + medium + warunek D4'),
    ('W4-7c', 'PANEL-WYNIK §4 It. 7c', 'pliki reviewerów security/performance/code-quality wg PA po ślepym teście'),
    ('W4-8-lp', 'PANEL-WYNIK §4 It. 8', 'learned-patterns trzy poziomy + wycinek od orkiestratora'),
    ('W4-8-d10', 'PANEL-WYNIK §4 It. 8', 'D10 zapobiegalne jako zdania + PA-27 + PA-24'),
    ('W4-9-rev', 'PANEL-WYNIK §4 It. 9', 'warstwa stała < 150 — reviewerzy, test budżetu'),
    ('W4-9-bld', 'PANEL-WYNIK §4 It. 9', 'warstwa stała < 150 — buildery'),
    ('W4-slepy', 'PANEL-WYNIK §4 (reguły)', 'ślepy test przed/po zmian promptów reviewerów i builderów'),
    ('W4-N2', 'PANEL-WYNIK §4 (reguły)', 'po każdej zmianie w .claude/ nowa sesja przed autopilotem (N2)'),
    ('R1-1', 'PANEL-WYNIK §4 R1', 'scalony dev-plan (D8a/D8b)'),
    ('R1-2-bld', 'PANEL-WYNIK §4 R1', 'zawężenie samosprawdzenia buildera (D7)'),
    ('R1-2-fix', 'PANEL-WYNIK §4 R1', 'zawężenie weryfikacji fixa — bramki na plikach fixa (D7)'),
    ('R1-3', 'PANEL-WYNIK §4 R1', 'compound ze szczeblem (I1)'),
    ('R1-4', 'PANEL-WYNIK §4 R1', 'skill weryfikacji z mapą funkcji (I6)'),
    ('R1-5', 'PANEL-WYNIK §4 R1', 'ogrodnik (I8)'),
    ('R1-6', 'PANEL-WYNIK §4 R1', 'hook error-handling wycofany po bramce ESLint'),
    ('R1-7', 'PANEL-WYNIK §4 R1', 'efort klas poza review (D6 krok 4)'),
    # PANEL-WYNIK §2 — rekordy decyzji
    ('D2', 'PANEL-WYNIK §2', 'grupowanie sceptyków: P2 batch 4, P1 ×3'),
    ('D3', 'PANEL-WYNIK §2', 'dossier po przejściu packagera do skryptu, bez mandatu'),
    ('D4', 'PANEL-WYNIK §2', 'spec/security/test-coverage tylko w fazach z kodem'),
    ('D5', 'PANEL-WYNIK §2', 'Stryker w domknięciu fazy, lista mutantów'),
    ('D6-1', 'PANEL-WYNIK §2 D6', 'efort jawny (krok 1)'),
    ('D6-2', 'PANEL-WYNIK §2 D6', 'test-coverage medium (krok 2)'),
    ('D6-3', 'PANEL-WYNIK §2 D6', 'spec medium (krok 3)'),
    ('D6-4', 'PANEL-WYNIK §2 D6', 'klasy poza review (krok 4)'),
    ('D7-1', 'PANEL-WYNIK §2 D7', 'warstwa 1: samosprawdzenie buildera na plikach IU'),
    ('D7-2', 'PANEL-WYNIK §2 D7', 'warstwa 2: skrypt bramek w domknięciu'),
    ('D7-3', 'PANEL-WYNIK §2 D7', 'warstwa 3: bramki na plikach fixa'),
    ('D7-4', 'PANEL-WYNIK §2 D7', 'warstwa 4: walidacja końcowa raz na zadanie'),
    ('D8a', 'PANEL-WYNIK §2', 'kształt scalonego dev-plan'),
    ('D8b', 'PANEL-WYNIK §2', 'research warunkowy przy „Lekka”'),
    ('D9', 'PANEL-WYNIK §2', 'disable-model-invocation dla workflowów-dzieci'),
    ('D10', 'PANEL-WYNIK §2', 'rozkład reguł builder ↔ reviewer'),
    ('D11', 'PANEL-WYNIK §2', 'kolejność wdrożenia (okna W1–W7)'),
    ('D12a', 'PANEL-WYNIK §2', 'D12 cz. 1 — kontrola po fixie wg A'),
    ('D12b', 'PANEL-WYNIK §2', 'D12 cz. 2 — nowa IU dla nowego pliku: nie teraz'),
    # PANEL-WYNIK §3 — cofnięte ustalenia
    ('S3-1', 'PANEL-WYNIK §3', 'performance zostaje'),
    ('S3-2', 'PANEL-WYNIK §3', 'security bez skracania do ślepego testu'),
    ('S3-3', 'PANEL-WYNIK §3', 'code-quality: lint jako wejście, prompt i high zostają'),
    ('S3-4', 'PANEL-WYNIK §3', 'test-coverage osobno (nie scalone z correctness)'),
    ('S3-5', 'PANEL-WYNIK §3', 'listy per oś, nie naraz'),
    ('S3-6', 'PANEL-WYNIK §3', 'PA-01/02/05/06/07 tylko po ślepym teście'),
    # PANEL-WYNIK §4a
    ('A-lp', 'PANEL-WYNIK §4a A', 'learned-patterns: trzy poziomy, 8 zabezpieczeń, konwersja'),
    ('A-lp-swap', 'PANEL-WYNIK §4a A', 'możliwa zamiana It. 7 ↔ It. 8'),
    ('A-cmd-complete', 'PANEL-WYNIK §4a A', 'żaden skill nie dopisuje do CLAUDE.md (complete)'),
    ('A-cmd-decisions', 'PANEL-WYNIK §4a A', 'decyzje fazowe → docs/decisions/ + indeks'),
    ('A-cmd-bootstrap', 'PANEL-WYNIK §4a A', 'bootstrap sprawdza wpis docs/decisions/ ostatniego merge’a'),
    ('A-cmd-merge', 'PANEL-WYNIK §4a A', 'uzgodnienie CLAUDE.md w dev-pr po merge’u z bramką rozmiaru'),
    ('B-plan', 'PANEL-WYNIK §4a B', 'scalony dev-plan'),
    ('B-budzet-plan', 'PANEL-WYNIK §4a B', 'budżet pliku z wymiarami w IU'),
    ('B-budzet-eslint', 'PANEL-WYNIK §4a B', 'ten sam próg z tolerancją w ESLint max-lines'),
    ('B-budzet-bot', 'PANEL-WYNIK §4a B', 'ten sam próg z tolerancją w .coderabbit.yaml'),
    ('B-prep', 'PANEL-WYNIK §4a B', 'dev-prep bez zmian'),
    ('C-bot', 'PANEL-WYNIK §4a C', 'generator bota + opis w skillu + 8 zmian'),
    ('C-devpr', 'PANEL-WYNIK §4a C', 'dev-pr 4 zmiany + sufit 3 tur'),
    ('C-slownik', 'PANEL-WYNIK §4a C', 'zamknięty słownik klas'),
    ('D-tools', 'PANEL-WYNIK §4a D', 'allowlista tools: w plikach klas ról'),
    ('D-mcp', 'PANEL-WYNIK §4a D', 'MCP per agent (Figma przy figma_screens, Supabase tylko sesja główna)'),
    ('D-claude', 'PANEL-WYNIK §4a D', 'CLAUDE.md u builderów/reviewerów, omitClaudeMd u mechanicznych'),
    ('D-bypass', 'PANEL-WYNIK §4a D', 'bypass i czytanie Bashem zostają'),
    ('D-skills', 'PANEL-WYNIK §4a D', 'skills: u builderów zostaje'),
    ('D-badacz', 'PANEL-WYNIK §4a D', '6 agentów researchowych w klasie badacz'),
    ('D-corr', 'PANEL-WYNIK §4a D', 'correctness własny plik agenta'),
    ('E-precheck', 'PANEL-WYNIK §4a E', 'precheck → env-up'),
    ('E-dedup', 'PANEL-WYNIK §4a E', 'dedup zostaje'),
    ('E-904', 'PANEL-WYNIK §4a E', 'wywołanie test-coverage bez zEffortem/agentType (:904)'),
    ('E-spec', 'PANEL-WYNIK §4a E', 'spec-compliance: martwe odwołania + duplikat fokusu :368'),
    ('E-cq', 'PANEL-WYNIK §4a E', 'prompt code-quality w jednym miejscu (It. 7c)'),
    ('E-kieran', 'PANEL-WYNIK §4a E', 'kieran/simplicity: treść do list, pliki usunięte'),
    ('F-migr', 'PANEL-WYNIK §4a F', 'bramka niezmienności migracji w domknięciu + migrations.sum'),
    ('F-migr-sum', 'PANEL-WYNIK §4a F', 'migrations.sum przed env-up'),
    ('F-migr-fix', 'PANEL-WYNIK §4a F', 'niezmienność migracji w kontroli fixa'),
    ('F-zielony', 'PANEL-WYNIK §4a F', 'zielony main w bootstrapie'),
    ('F-seedy-e2e', 'PANEL-WYNIK §4a F', 'seedy: tester sprawdza seed vs kontrakt migracji'),
    ('F-seedy-sec', 'PANEL-WYNIK §4a F', 'seedy: security — strażnicy w seedach'),
    ('F-seedy-bot', 'PANEL-WYNIK §4a F', 'seedy: e2e/seeds jako granica zaufania w bocie'),
    ('F-cr', 'PANEL-WYNIK §4a F', 'coding-rules przepisanie (USUŃ/ZMIEŃ/DODAJ/PRZENIEŚ, PA-26)'),
    ('F-cr2-tekst', 'PANEL-WYNIK §4a F', 'wyjątek w coding-rules §2 (tekst)'),
    ('F-cr2-pole', 'PANEL-WYNIK §4a F', 'pole faza.testy_usuniete[] (I2)'),
    ('F-tests', 'PANEL-WYNIK §4a F', '__tests__: każda iteracja aktualizuje testy przypinające zachowanie'),
    ('F-smoke', 'PANEL-WYNIK §4a F', 'templates/smoke-autopilot jako scenariusz po każdej iteracji'),
    ('F-ci', 'PANEL-WYNIK §4a F', 'bramka CI: claude plugin validate --strict + eval'),
    ('F-doctor', 'PANEL-WYNIK §4a F', 'doctor: bash, lista z projektu, Wymagania w README'),
    ('G-usun', 'PANEL-WYNIK §4a G', 'usunięcia z 6a pkt 20 + README + learnings-researcher:256 + przeniesienie treści'),
    ('G-mobile', 'PANEL-WYNIK §4a G', 'szablon mobile — osobna decyzja'),
    ('H-a', 'PANEL-WYNIK §4a H', 'prompt-audit grupa (a)'),
    ('H-b', 'PANEL-WYNIK §4a H', 'prompt-audit grupa (b) po ślepym teście'),
    ('H-c', 'PANEL-WYNIK §4a H', 'PA-25, PA-26 — decyzje operatora przy wdrożeniu'),
    ('H-24-27', 'PANEL-WYNIK §4a H', 'PA-24 i PA-27 w It. 8'),
    ('H-cykl', 'PANEL-WYNIK §4a H', 'ponowny prompt-audit po iteracjach promptów'),
    ('I-konto', 'PANEL-WYNIK §4a I', 'higiena konta'),
    ('J-plugin', 'PANEL-WYNIK §4a J', 'szablon jako plugin — nie teraz'),
    ('J-regres', 'PANEL-WYNIK §4a J', 'przejście regresyjne — odłożone'),
    ('J-d12', 'PANEL-WYNIK §4a J', 'D12 cz. 2 — odłożone'),
    ('J-reczny', 'PANEL-WYNIK §4a J', 'tryb ręczny execute/review usunięty'),
    ('K-raporty', 'PANEL-WYNIK §4a K', 'raporty etapu 5'),
    # PANEL-WYNIK §5 — „znika”
    ('Z-packager', 'PANEL-WYNIK §5', 'znika agent packager'),
    ('Z-stan', 'PANEL-WYNIK §5', 'znika stan:zapis'),
    ('Z-preskan', 'PANEL-WYNIK §5', 'znika fix:pre-skan'),
    ('Z-verifyfix', 'PANEL-WYNIK §5', 'znika verify-fix'),
    ('Z-telemetria', 'PANEL-WYNIK §5', 'znika agent telemetrii'),
    ('Z-koszykD', 'PANEL-WYNIK §5', 'znikają skille koszyka D'),
    ('Z-ideate', 'PANEL-WYNIK §5', 'znika dev-ideate'),
    ('Z-freshness', 'PANEL-WYNIK §5', 'znika freshness-audit'),
    ('Z-reczny', 'PANEL-WYNIK §5', 'znika tryb ręczny execute/review jako skille'),
    # INSPIRACJE (6a pkt 26)
    ('INS-A1-rev', 'INSPIRACJE A1', 'pytanie „undefined” + 5 kształtów — lista test-coverage'),
    ('INS-A1-bld', 'INSPIRACJE A1', 'pytanie „undefined” — pozycja warstwy stałej buildera'),
    ('INS-A1-lint', 'INSPIRACJE A1', 'część mechaniczna — reguły wtyczki vitest'),
    ('INS-A2', 'INSPIRACJE A2', 'drabina egzekwowania w compoundzie (szczebel)'),
    ('INS-A3', 'INSPIRACJE A3', 'bramka odebrana, gdy „gryzie”'),
    ('INS-A4', 'INSPIRACJE A4', 'cztery zasady writing-for-agents'),
    ('INS-A5', 'INSPIRACJE A5', 'ślepa ewaluacja zmian promptów'),
    ('INS-B1', 'INSPIRACJE B1', 'skill weryfikacji z mapą funkcji'),
    ('INS-B2', 'INSPIRACJE B2', 'standardy u reviewera vs buildera'),
    ('INS-B3', 'INSPIRACJE B3', 'poziom pewności dowodu 1–5'),
    ('INS-B4', 'INSPIRACJE B4', 'lżejszy plan + szwy testowe'),
    ('INS-B5', 'INSPIRACJE B5', 'równoległe IU w worktree'),
    ('INS-B6', 'INSPIRACJE B6', 'granice warstw grafem importów'),
    ('INS-B7', 'INSPIRACJE B7', 'ogrodnik'),
    ('INS-B8', 'INSPIRACJE B8', 'komentarze jako nośnik obejść — obserwować'),
    ('INS-C1', 'INSPIRACJE C1', 'katalog odrzucanych wzorców bota'),
    ('INS-C2', 'INSPIRACJE C2', 'porażka CI: klasyfikacja'),
    ('INS-C3', 'INSPIRACJE C3', 'dziennik decyzji / „Na co zwrócić uwagę”'),
    ('INS-C4', 'INSPIRACJE C4', 'opis PR z ryzykiem'),
    ('INS-C5', 'INSPIRACJE C5', 'wizard kont i sekretów'),
    ('INS-C6', 'INSPIRACJE C6', 'ankieta dla klienta'),
    ('INS-drabina', 'HANDOFF 6a pkt 26', 'drabina egzekwowania jako zasada przekrojowa — odrzucona'),
    ('INS-N-poteto', 'INSPIRACJE §4', 'router poteto-mode'),
    ('INS-N-interrogate', 'INSPIRACJE §4', 'interrogate (wiele modeli)'),
    ('INS-N-sicko', 'INSPIRACJE §4', 'osobny agent komentarzy'),
    ('INS-N-shipping', 'INSPIRACJE §4', 'shipping / auto-merge'),
    ('INS-N-orchestrate', 'INSPIRACJE §4', 'orchestrate / swarm / arena'),
    ('INS-N-petla', 'INSPIRACJE §4', 'pętla zewnętrzna Slack/Sentry'),
    ('INS-N-formalna', 'INSPIRACJE §4', 'weryfikacja formalna'),
    ('INS-N-setup', 'INSPIRACJE §4', 'setup-pstack'),
    ('INS-N-matt', 'INSPIRACJE §4', 'pozostałe skille Matta'),
    # HANDOFF 6a
    ('6a-20-koszykD', 'HANDOFF 6a pkt 20', 'koszyk D wypada (code-review, code-quality, gemini, dev-docs-update, bugfix)'),
    ('6a-20-ideate', 'HANDOFF 6a pkt 20', 'dev-ideate i freshness-audit (+wf) wypadają'),
    ('6a-20-reczny', 'HANDOFF 6a pkt 20', 'tryb ręczny wypada, treść SKILL.md do workflowów, opisy builderów'),
    ('6a-20-cleanup', 'HANDOFF 6a pkt 20', 'cleanupPeriodDays = 120'),
    ('6a-20-mobile', 'HANDOFF 6a pkt 20', 'szablon mobile — nie ruszać bez pytania'),
    ('6a-25-a', 'HANDOFF 6a pkt 25', 'prompt-audit (a) do pierwszej iteracji'),
    ('6a-25-b', 'HANDOFF 6a pkt 25', 'prompt-audit (b) pliki reviewerów'),
    ('6a-25-c', 'HANDOFF 6a pkt 25', 'prompt-audit (c) PA-25/PA-26 decyzje przy wdrożeniu'),
    ('6a-25-effort', 'HANDOFF 6a pkt 25', 'rekord agent z polem effort'),
    ('6a-25-cykl', 'HANDOFF 6a pkt 25', 'obszar aktualizowany cyklicznie (ponowny prompt-audit)'),
    ('6a-26-a', 'HANDOFF 6a pkt 26', '(a) compound ze szczeblem'),
    ('6a-26-b', 'HANDOFF 6a pkt 26', '(b) pytanie „undefined”'),
    ('6a-26-c', 'HANDOFF 6a pkt 26', '(c) wyjątek w coding-rules §2'),
    ('6a-26-d', 'HANDOFF 6a pkt 26', '(d) odbiór bramek testem porażki'),
    ('6a-26-e', 'HANDOFF 6a pkt 26', '(e) zasady 8–11 pisania'),
    ('6a-26-f', 'HANDOFF 6a pkt 26', '(f) prompty wg Anthropic + ślepy test'),
    ('6a-26-g', 'HANDOFF 6a pkt 26', '(g) lint a stary kod'),
    ('6a-26-h', 'HANDOFF 6a pkt 26', '(h) skill weryfikacji z mapą funkcji'),
    ('6a-26-i', 'HANDOFF 6a pkt 26', '(i) granice warstw w ESLint bez dependency-cruiser'),
    ('6a-26-j', 'HANDOFF 6a pkt 26', '(j) ogrodnik automatycznie na zamknięciu'),
    ('6a-26-k', 'HANDOFF 6a pkt 26', '(k) rozkład reguł builder ↔ reviewer'),
    ('6a-26-odrz', 'HANDOFF 6a pkt 26', 'odrzucone: zakaz komentarzy i sześć pozycji „na później”'),
    ('6a-34-c', 'HANDOFF 6a pkt 34', '(c) allowlista w It. 3 równolegle jako R1'),
    ('6a-36-a', 'HANDOFF 6a pkt 36', '(a) oferty-online = materiał do nauki (kopie, tło)'),
    ('6a-36-b', 'HANDOFF 6a pkt 36', '(b) higiena konta = KROK 0'),
    ('6a-37-d', 'HANDOFF 6a pkt 37', '(d) instrukcja instalacji per projekt + profil settings.json'),
    ('6a-37-d2', 'HANDOFF 6a pkt 37', '(d) test na czystym koncie: propozycja instalacji per projekt'),
    ('6a-37-d3', 'HANDOFF 6a pkt 37', '(d) disableClaudeAiConnectors tylko terminal — instrukcja mówi wprost'),
    ('6a-37-e', 'HANDOFF 6a pkt 37', '(e) token Airtable'),
    ('6a-38-e1', 'HANDOFF 6a pkt 38', '(e) kompakcja pipeline.jsonl'),
    ('6a-38-e2', 'HANDOFF 6a pkt 38', '(e) skan w doctor (O5)'),
    ('6a-38-e3', 'HANDOFF 6a pkt 38/39', 'push szablonu do GitHuba — decyzja'),
    ('6a-40-1', 'HANDOFF 6a pkt 40', '(1) wdrożenie jedna po drugiej wg zależności i ryzyka'),
    ('6a-40-2', 'HANDOFF 6a pkt 40', '(2) pomiar telemetrią po poprawie, progi do odczytu'),
    ('6a-40-3', 'HANDOFF 6a pkt 40', '(3) testy + smoke po paczce zmian w workflowach'),
    ('6a-40-4', 'HANDOFF 6a pkt 40', '(4) ślepe testy — decyzja operatora'),
    ('6a-40-5', 'HANDOFF 6a pkt 40', '(5) B0 wypada jako warunek'),
    # IT1-ODCZYT §5–6
    ('IT1-5', 'IT1-ODCZYT §5', 'ogólny mechanizm dla osieroconych rekordów'),
    ('IT1-6a', 'IT1-ODCZYT §6', 'fixture smoke’a w monorepo poza bramkami'),
    ('IT1-6b', 'IT1-ODCZYT §6', 'commit archiwizacji z komunikatem feature'),
    ('IT1-6c', 'IT1-ODCZYT §6', '.DS_Store śledzony w gicie'),
    # PANEL-WEJSCIE §2a / §10 — pozycje spoza listy 65
    ('PWE-scribe', 'PANEL-WEJSCIE §2a (ETAP1)', 'scribe review: niższy tier + krótszy prompt'),
    ('PWE-zwin', 'PANEL-WEJSCIE §2a (ETAP1)', 'zwin-do-poprawy → stan w JS'),
    ('PWE-e2e-prompt', 'PANEL-WEJSCIE §2a (ETAP1)', 'e2e: harness → env-up, jedno źródło promptu'),
    ('PWE-1b', 'PANEL-WEJSCIE §2a (ETAP1)', 'domknięcie pkt 1b nie jest duplikatem hooka'),
    ('PWE-C', 'PANEL-WEJSCIE §2a (ETAP1B)', '28 uwag C i preferencje bota zostają botowi'),
    ('PWE-N3', 'PANEL-WEJSCIE §2a (mini-run)', 'N3: builder idzie za git status z session_context'),
    ('PWE-N2', 'PANEL-WEJSCIE §10', 'N2: komunikat na końcu sync-template'),
    ('PWE-rek7-bak', 'PANEL-WEJSCIE §10 rek. 7', 'complete pomija *.bak'),
    ('PWE-rek7-fazy', 'PANEL-WEJSCIE §10 rek. 7', 'fazyUkonczone po stanie zadania'),
    ('PWE-rek7-stopka', 'PANEL-WEJSCIE §10 rek. 7', 'stopka commita STOP z pustą linią'),
    ('PWE-advisors', 'PANEL-WEJSCIE §2 pkt 8', 'security warunkowe po profilu stacku (advisors przejmuje RLS)'),
    ('PWE-komendy', 'HANDOFF 6a pkt 6', 'komendy-listy per technologia u reviewerów'),
    ('PWE-ctx', 'PANEL-WEJSCIE §2a (ETAP2)', 'correctness wzmocniony mechanicznie (no-floating-promises, react-hooks)'),
    ('PWE-skille-split', 'PANEL-WEJSCIE §2 pkt 3 / §7', 'skille buildera dzielone na stałą/referencyjną'),
    ('PWE-S27-p1test', 'PANEL-WEJSCIE §2 pkt 7', 'naprawa P1 zawiera test padający przed poprawką'),
    # dopisane po przeglądzie niezależnego subagenta (2026-09-30, uwaga 22)
    ('PWE-budzet-doctor', 'PANEL-WEJSCIE §2 pkt 3', 'test budżetu warstwy stałej także w sync-template/doctor + liczba w telemetrii'),
    ('D-d9-doctor', 'PANEL-WYNIK §2 D9', 'warunek wstępny: stały test w doctor, że dziecko z flagą się uruchamia'),
    ('6a-25-klasy', 'HANDOFF 6a pkt 25', 'ponowny prompt-audit po wdrożeniu plików klas ról i po iteracjach promptów'),
    ('PWE-d10-regen', 'PANEL-WEJSCIE §2a (ETAP1B)', 'tabela klas ucieczek u buildera regenerowana z compoundów'),
]


def pa_z_audytu():
    tekst = open(os.path.join(BASE, 'PROMPT-AUDIT.md'), encoding='utf-8').read()
    nazwy = {}
    for m in re.finditer(r'\*\*(PA-\d\d)\*\*\s*(?:\(add\))?\s*—\s*([^\n]{0,90})|\*\*(PA-\d\d) — ([^*\n]+)\*\*', tekst):
        pid = m.group(1) or m.group(3)
        nazwy.setdefault(pid, (m.group(2) or m.group(4)).strip())
    for pid in sorted(set(re.findall(r'PA-\d\d', tekst))):
        nazwy.setdefault(pid, '(wzmianka)')
    return nazwy


def hunki_z_diffu():
    hunki = {}
    for linia in open(os.path.join(DANE, 'pa-proponowany.diff'), encoding='utf-8'):
        m = re.match(r'#\s+(\d+)\s+(PA-\d\d)\s+(\S+)', linia)
        if m:
            hunki['H%02d' % int(m.group(1))] = (m.group(2), m.group(3))
    return hunki


def pw_z_panelu():
    spec = importlib.util.spec_from_file_location('pwp', os.path.join(BASE, 'skrypty', 'panel_wynik_pokrycie.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return [('PW%02d' % (i + 1), z, n) for i, (z, n, _rx) in enumerate(mod.POZYCJE)]


def rejestr():
    reg = {pid: ('RĘCZNY', zr, n) for pid, zr, n in RECZNE}
    for pid, zr, n in pw_z_panelu():
        reg[pid] = ('PANEL-WYNIK 65', zr, n)
    for pid, n in pa_z_audytu().items():
        reg[pid] = ('PROMPT-AUDIT', 'PROMPT-AUDIT §3', n)
    for hid, (pa, plik) in hunki_z_diffu().items():
        reg[hid] = ('DIFF', pa, plik)
    return reg


# ── Parser planu ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
def wlasciciel(naglowek):
    m = re.match(r'### (P\d+) ', naglowek)
    if m:
        return m.group(1)
    for prefiks, nazwa in (('## 1.', 'ZASADY'), ('## 4.', 'WSPOLNE'), ('## 5.', 'WYPADA'), ('## 6.', 'DECYZJE')):
        if naglowek.startswith(prefiks):
            return nazwa
    return None


def punkty(linie):
    """Łączy punkt listy (`- ` / `  - `) z liniami kontynuacji; zwraca (wcięcie, tekst)."""
    wynik = []
    for linia in linie:
        m = re.match(r'^( *)- (.*)$', linia)
        if m:
            wynik.append([len(m.group(1)), m.group(2)])
        elif wynik and linia.startswith(' ') and linia.strip():
            wynik[-1][1] += ' ' + linia.strip()
    return [(w, t) for w, t in wynik]


def parsuj_plan(sciezka):
    sekcje, biezacy = {}, None
    for linia in open(sciezka, encoding='utf-8').read().split('\n'):
        if linia.startswith('## ') or linia.startswith('### '):
            nowy = wlasciciel(linia)
            if nowy or linia.startswith('## '):
                biezacy = nowy
                if nowy:
                    sekcje.setdefault(nowy, [])
                continue
        if biezacy:
            sekcje[biezacy].append(linia)
    plan = {}
    for wl, linie in sekcje.items():
        pk = punkty(linie)
        d = {'pozycje': [], 'hunki': [], 'zakres': [], 'pliki': [], 'wypada': [], 'tekst': '\n'.join(linie)}
        w_zakresie = False
        for wciecie, tekst in pk:
            if wciecie == 0:
                w_zakresie = tekst.startswith('**Zakres:**')
                if tekst.startswith('**Pozycje:**'):
                    d['pozycje'] += RE_TAG.findall(tekst)
                elif tekst.startswith('**Hunki:**'):
                    d['hunki'] += re.findall(r'\[(H\d\d)\]', tekst)
                elif tekst.startswith('**Pliki:**'):
                    # w nawiasach bywają nazwy funkcji (`fixPrompt`) — plik = ścieżka z „/” albo plik w korzeniu repo
                    kandydaci = [p.split()[0] for p in re.findall(r'`([^`]+)`', tekst)]
                    d['pliki'] += [p for p in kandydaci if '/' in p or p in ('README.md', '.gitignore')]
                elif wl == 'WYPADA' and RE_TAG.search(tekst):
                    d['wypada'].append((RE_TAG.findall(tekst), tekst))
            elif wciecie > 0 and w_zakresie:
                d['zakres'].append(tekst)
        plan[wl] = d
    return plan


def main():
    reg = rejestr()
    hunki = {k: v for k, v in reg.items() if v[0] == 'DIFF'}
    plan = parsuj_plan(os.path.join(BASE, 'PLAN-POPRAWY.md'))
    tekst_planu = open(os.path.join(BASE, 'PLAN-POPRAWY.md'), encoding='utf-8').read()
    bledy, L = [], []

    # (1) przypisania
    przypisania = {}
    for wl, d in plan.items():
        for pid in d['pozycje']:
            przypisania.setdefault(pid, []).append((wl, ''))
        for tagi, tekst in d['wypada']:
            powod = re.sub(r'\s+', ' ', RE_TAG.sub('', tekst)).strip(' -—')
            for pid in tagi:
                przypisania.setdefault(pid, []).append(('WYPADA', powod))
    hunk_wl = {}
    for wl, d in plan.items():
        for h in d['hunki']:
            hunk_wl.setdefault(h, []).append(wl)
    for h in sorted(hunki):
        if len(hunk_wl.get(h, [])) != 1:
            bledy.append('HUNK %s (%s %s) przypisany %d razy: %s' % (h, hunki[h][1], hunki[h][2], len(hunk_wl.get(h, [])), hunk_wl.get(h, [])))
    pa_z_hunkami = {v[1] for v in hunki.values()}  # v = ('DIFF', PA, plik)
    for pid, (typ, zr, nazwa) in sorted(reg.items()):
        if typ == 'DIFF':
            continue
        n = len(przypisania.get(pid, []))
        if typ == 'PROMPT-AUDIT' and pid in pa_z_hunkami:
            niepokryte = [h for h, v in hunki.items() if v[1] == pid and len(hunk_wl.get(h, [])) != 1]
            if niepokryte:
                bledy.append('BRAK  %s — hunki bez paczki: %s' % (pid, niepokryte))
            continue
        if n == 0:
            bledy.append('BRAK  %-18s %-28s %s' % (pid, zr, nazwa))
        elif n > 1:
            bledy.append('DUBEL %-18s przypisany %d razy: %s' % (pid, n, [w for w, _ in przypisania[pid]]))

    # (2) plan → źródła
    for tag in sorted(set(RE_TAG.findall(tekst_planu))):
        if tag not in reg:
            bledy.append('NIEZNANY TAG w planie: %s' % tag)
    for wl, d in plan.items():
        if not re.match(r'P\d+$', wl) and wl != 'ZASADY':
            continue
        if not d['pozycje']:
            bledy.append('PACZKA %s bez pozycji źródłowych' % wl)
        zakres_tagi = set()
        for punkt in d['zakres']:
            tagi = RE_TAG.findall(punkt)
            if not tagi:
                bledy.append('PUNKT BEZ TAGU w %s: %s' % (wl, punkt[:100]))
            zakres_tagi.update(tagi)
        for pid in d['pozycje']:
            if pid not in zakres_tagi:
                bledy.append('POZYCJA %s w %s nie występuje w Zakres' % (pid, wl))

    # (3) hunk → plik paczki
    for h, wls in hunk_wl.items():
        if h not in hunki or len(wls) != 1:
            continue
        plik = hunki[h][2]
        pliki = plan[wls[0]]['pliki']
        if not any(plik == p or (p.endswith('/') and plik.startswith(p)) for p in pliki):
            bledy.append('HUNK %s: plik %s nie ma na liście Pliki paczki %s' % (h, plik, wls[0]))

    # (4) wspólne pliki
    plik_paczki = {}
    for wl, d in plan.items():
        if re.match(r'P\d+$', wl):
            for p in d['pliki']:
                plik_paczki.setdefault(p, []).append(wl)
    wspolne_tekst = plan.get('WSPOLNE', {}).get('tekst', '')
    wspolne = {p: w for p, w in plik_paczki.items() if len(set(w)) > 1}
    for p, w in sorted(wspolne.items()):
        if p not in wspolne_tekst and os.path.basename(p.rstrip('/')) not in wspolne_tekst:
            bledy.append('WSPÓLNY PLIK bez opisu w §4: %s (%s)' % (p, ', '.join(sorted(set(w)))))

    # wyniki
    liczby = {}
    for pid, (typ, _zr, _n) in reg.items():
        liczby[typ] = liczby.get(typ, 0) + 1
    przyp = [p for p in reg if reg[p][0] != 'DIFF']
    wlasciciele = {}
    for pid in przyp:
        for wl, _ in przypisania.get(pid, []):
            wlasciciele[wl] = wlasciciele.get(wl, 0) + 1
    L.append('plan_poprawy_pokrycie.py — rejestr %d pozycji (%s)' % (len(reg), ', '.join('%s %d' % kv for kv in sorted(liczby.items()))))
    L.append('źródła → plan: pozycji do przypisania %d (bez hunków), PA z hunkami pokrywane przez hunki: %d; hunków %d' % (
        len(przyp), len(pa_z_hunkami), len(hunki)))
    L.append('przypisania wg miejsca: ' + ', '.join('%s %d' % (k, wlasciciele[k]) for k in sorted(wlasciciele, key=lambda x: (len(x), x))))
    L.append('plan → źródła: tagów w planie %d, punktów Zakres %d; paczek %d; plików wspólnych %d' % (
        len(set(RE_TAG.findall(tekst_planu))), sum(len(d['zakres']) for d in plan.values()),
        len([w for w in plan if re.match(r'P\d+$', w)]), len(wspolne)))
    L.append('WYNIK: %s' % ('KOMPLETNY — 0 braków' if not bledy else 'BRAKI: %d' % len(bledy)))
    L += ['  ' + b for b in bledy]
    open(os.path.join(DANE, 'plan-poprawy-pokrycie.txt'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')

    with open(os.path.join(DANE, 'plan-poprawy-mapa.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['id', 'typ', 'zrodlo', 'nazwa', 'miejsce', 'powod_wypada'])
        for pid in sorted(reg, key=lambda x: (reg[x][0], x)):
            typ, zr, nazwa = reg[pid]
            if typ == 'DIFF':
                w.writerow([pid, typ, zr, nazwa, '|'.join(hunk_wl.get(pid, ['BRAK'])), ''])
                continue
            miejsca = przypisania.get(pid, [])
            if typ == 'PROMPT-AUDIT' and pid in pa_z_hunkami and not miejsca:
                miejsca = [('hunki:' + '|'.join(sorted({hunk_wl.get(h, ['?'])[0] for h, v in hunki.items() if v[1] == pid})), '')]
            w.writerow([pid, typ, zr, nazwa, '|'.join(m for m, _ in miejsca) or 'BRAK', ' | '.join(p for _, p in miejsca if p)])

    P = ['plik → paczki (z linii Pliki:), %d plików, %d wspólnych' % (len(plik_paczki), len(wspolne))]
    for p in sorted(plik_paczki):
        P.append('%-4s %-70s %s' % ('*' if p in wspolne else '', p, ', '.join(sorted(set(plik_paczki[p]), key=lambda x: int(x[1:])))))
    open(os.path.join(DANE, 'plan-poprawy-pliki.txt'), 'w', encoding='utf-8').write('\n'.join(P) + '\n')

    print('\n'.join(L))
    sys.exit(1 if bledy else 0)


if __name__ == '__main__':
    main()

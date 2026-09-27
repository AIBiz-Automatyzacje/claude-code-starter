#!/usr/bin/env python3
"""Kontrola pokrycia PANEL-WYNIK.md: czy każda zmiana / decyzja uzgodniona w analizie (HANDOFF 6a pkt 1–33, PANEL-WEJSCIE §2, §2a, §7, §9, §10)
ma w PANEL-WYNIK miejsce (iterację albo jawne „poza planem / odłożone”).

Użycie: python3 skrypty/panel_wynik_pokrycie.py → dane/panel-wynik-pokrycie.txt (kod 1, gdy czegoś brakuje)
Pozycja = (źródło, nazwa, regex); trafienie regexu w PANEL-WYNIK.md = pozycja ma miejsce. Regex jest wąski (nazwa własna rzeczy), więc brak trafienia
to prawie na pewno brak pozycji; trafienie nie dowodzi, że opis jest pełny — to sprawdza czytanie."""
import os, re, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POZYCJE = [
    ('6a pkt 1', 'żaden skill nie dopisuje do CLAUDE.md (dev-docs-complete:115-116, complete-wf:160)', r'nie dopisuje do CLAUDE\.md'),
    ('6a pkt 1', 'decyzje fazowe → docs/decisions/ + 1 linia indeksu', r'docs/decisions'),
    ('6a pkt 1, 11', 'uzgodnienie CLAUDE.md dopiero po merge’u, bramka rozmiaru w JS, bootstrap sprawdza wpis', r'po merge'),
    ('6a pkt 2', 'dev-pr: 4 zmiany z ETAP1B §4 (zbierz w każdej turze, guard uzasadnień, rekomendacja w JS, raport per tura)', r'rekomendacj'),
    ('6a pkt 2', 'dev-pr: sufit 3 tur, tryb interaktywny zostaje', r'[Ss]ufit 3 tur'),
    ('6a pkt 3, 17', 'higiena konta: MCP i pluginy per projekt, audyt pluginów (osobny etap)', r'[Aa]udyt (\w+ )?plugin'),
    ('6a pkt 4, 17', 'learned-patterns: format klasa → reguła (2 zdania) → źródło', r'klasa → reguła'),
    ('6a pkt 17', 'learned-patterns: indeks generowany przez dev-compound-refresh z frontmatteru solutions', r'generowan\w* przez (dev-)?compound-refresh'),
    ('6a pkt 17', 'learned-patterns wychodzi z .claude/rules/ (koniec ładowania eager)', r'\.claude/rules'),
    ('6a pkt 17', '8 zabezpieczeń learned-patterns', r'zabezpiecze'),
    ('6a pkt 17', 'jednorazowa konwersja 49k zn skryptem z listą odrzutów', r'konwersj'),
    ('6a pkt 5', 'coding-rules.md: przepisanie (tabela USUŃ/ZMIEŃ/DODAJ/PRZENIEŚ-DO-LINTERA, PA-26)', r'coding-rules'),
    ('6a pkt 26 c', 'wyjątek w coding-rules §2: usunąć wolno tylko zielony test niefalsyfikowalny', r'zielon\w* test'),
    ('6a pkt 6, 18 L10', 'profil stacku w dossier każdego reviewera', r'profil\w* stacku'),
    ('6a pkt 8', 'budżet pliku: wymiary + ten sam próg z tolerancją 20% w ESLint i .coderabbit.yaml', r'tolerancj'),
    ('6a pkt 10', 'MCP per agent: Figma tylko UI/fullstack/tester przy figma_screens, Supabase MCP tylko sesja główna', r'figma_screens'),
    ('6a pkt 12', 'doctor: skrypt bash, narzędzia wyliczane z projektu + sekcja „Wymagania” w README', r'Wymagania'),
    ('6a pkt 13', 'szablon jako plugin — nie teraz', r'plugin\w*\W+nie teraz|jako plugin'),
    ('6a pkt 15', 'bypass i czytanie Bashem zostają; paths: to bonus', r'bypass'),
    ('6a pkt 15', 'skills: u builderów zostaje', r'skills:'),
    ('6a pkt 17', 'bramka „zielony main” w bootstrapie', r'zielony main'),
    ('6a pkt 18 L8', 'wiedza do podzielenia: jak radzić sobie z dużą liczbą MCP/skilli (allowlista)', r'L8'),
    ('6a pkt 18 L13 / 20', 'usunięcie /bugfix i koszyka D, dev-ideate, freshness-audit, tryb ręczny', r'6a pkt 20'),
    ('6a pkt 20', 'usunięcie: poprawki README i learnings-researcher.md:256', r'learnings-researcher'),
    ('6a pkt 20', 'szablon mobile — osobna decyzja', r'mobile'),
    ('6a pkt 20', 'opisy builderów „wywoływany przez dev-docs-execute” przepiąć na workflow', r'opisy (trzech )?builder'),
    ('6a pkt 18 L19', 'generator coderabbit-base.yaml + opis w skillu', r'coderabbit-base'),
    ('6a pkt 18 L14', 'hook tsc w sesji głównej zostaje; error-handling-reminder wycofać po ESLint', r'error-handling'),
    ('6a pkt 18 L14', 'kieran-typescript-reviewer i code-simplicity-reviewer: treść do list, pliki usunąć', r'kieran'),
    ('6a pkt 18', 'budżet instrukcji w trzech warstwach (stała <150, referencyjna, mechaniczna)', r'< ?150'),
    ('6a pkt 18 L10', 'advisors przez Management API na chmurze, zero Dockera', r'advisors'),
    ('6a pkt 19', 'E2E → [MANUAL] z przejściem do smoke operatora', r'MANUAL'),
    ('6a pkt 21 N1', 'zdanie N1 w poleceniu startu', r'N1'),
    ('6a pkt 21 N2', 'nowa sesja po zmianach w .claude/ (komunikat sync-template, zdanie w dev-autopilot-wf)', r'N2'),
    ('6a pkt 25', 'prompt-audit (a) poprawki faktów', r'grupa \(a\)'),
    ('6a pkt 25', 'prompt-audit (b) pliki reviewerów PA-01, 02, 05, 06, 07', r'PA-01'),
    ('6a pkt 25', 'prompt-audit (c) PA-25 (kopia figma-design-to-code) — decyzja operatora', r'PA-25'),
    ('6a pkt 25', 'cykliczny prompt-audit przy zmianie modelu i po iteracjach dotykających promptów', r'ponown\w* prompt-audit'),
    ('6a pkt 25', 'PA-24 skill security u builderów → reguły; PA-27 krok 1.7', r'PA-24'),
    ('6a pkt 26 a', 'compound ze szczeblem kod | lint | reguła', r'szczebl'),
    ('6a pkt 26 b', 'pytanie „undefined” o testy (lista test-coverage + builder)', r'undefined'),
    ('6a pkt 26 d', 'odbiór każdej bramki testem porażki', r'test\w* porażki'),
    ('6a pkt 26 e', 'zasady pisania 1–11 warstwy stałej', r'zasad\w* (pisania )?1–11'),
    ('6a pkt 26 f', 'ślepy test przed/po przy zmianie promptów', r'ślep'),
    ('6a pkt 26 g', 'lint: stary kod sprzątany przed nowym workflow (zadanie sprzątające)', r'sprzątając'),
    ('6a pkt 26 h', 'skill weryfikacji z mapą funkcji', r'mapą funkcji'),
    ('6a pkt 26 h', 'przejście regresyjne po funkcjach — odłożone z warunkiem', r'regresyjn'),
    ('6a pkt 26 i', 'granice warstw w ESLint', r'granic\w* warstw'),
    ('6a pkt 26 j', 'ogrodnik', r'ogrodnik'),
    ('6a pkt 20', 'cleanupPeriodDays 120', r'cleanupPeriodDays|120 dni'),
    ('PANEL-WEJSCIE §2a', 'precheck → env-up', r'precheck'),
    ('PANEL-WEJSCIE §2a', 'dedup zostaje', r'dedup'),
    ('PANEL-WEJSCIE §2a', 'test-coverage: brak zEffortem/agentType w wywołaniu (dev-docs-review-wf.js:904)', r'904'),
    ('PANEL-WEJSCIE §2a', 'spec-compliance: duplikat fokusu REVIEWERZY:368', r'368'),
    ('PANEL-WEJSCIE §2a', 'correctness — własny plik agenta', r'własny plik'),
    ('PANEL-WEJSCIE §2a', 'bramka niezmienności migracji (domknięcie + kontrola fixa)', r'niezmienno'),
    ('PANEL-WEJSCIE §2a', 'seedy z właścicielem (e2e / security), e2e/seeds jako granica zaufania w bocie', r'seed'),
    ('PANEL-WEJSCIE §2a / 6a pkt 17', 'zamknięty słownik klas (L12)', r'słownik'),
    ('PANEL-WEJSCIE §2a', 'claude plugin validate --strict + eval jako bramka CI zmian maszynerii', r'validate'),
    ('PANEL-WEJSCIE §7', '__tests__ szablonu (74 testy; test TIERY sceptycy-p2.test.mjs)', r'__tests__'),
    ('PANEL-WEJSCIE §7', 'oś code-quality: prompt w dwóch miejscach → jedno', r'dwóch miejsc'),
    ('PANEL-WEJSCIE §7', 'templates/smoke-autopilot', r'smoke-autopilot'),
    ('PANEL-WEJSCIE §7', 'settings: enabledPlugins dev-browser, statusLine npx @latest → higiena konta', r'statusLine'),
    ('PANEL-WEJSCIE §9 / ETAP2 §6', 'raport etapu 5: dwa raporty (techniczny + dla operatora) z ograniczeniami L6–L18', r'RAPORT'),
    ('6a pkt 12, §2 pkt 14', 'sekcja Doctor / zielony main / doctor w bootstrapie', r'[Dd]octor'),
]


def main():
    tekst = open(os.path.join(BASE, 'PANEL-WYNIK.md')).read()
    braki = [(z, n) for z, n, rx in POZYCJE if not re.search(rx, tekst)]
    L = ['panel_wynik_pokrycie.py — pozycji %d, z miejscem w PANEL-WYNIK %d, BRAK %d' % (len(POZYCJE), len(POZYCJE) - len(braki), len(braki))]
    L += ['  BRAK  %-28s %s' % (z, n) for z, n in braki]
    open(os.path.join(BASE, 'dane', 'panel-wynik-pokrycie.txt'), 'w').write('\n'.join(L) + '\n')
    print('\n'.join(L))
    sys.exit(1 if braki else 0)


if __name__ == '__main__':
    main()

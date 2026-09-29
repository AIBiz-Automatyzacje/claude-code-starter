# IT. 1 — telemetria + import: plan wdrożenia (2026-09-29, do akceptacji operatora)

Źródła: PANEL-WYNIK §4 (wiersz It. 1), §4a C i F; PANEL-WEJSCIE §2 pkt 5, §12; `dane/d5-telemetria-rekord.txt` (§2, §7–§11 — rekord
obowiązujący); RAPORT-TECHNICZNY (wiersz „Telemetria”); HANDOFF 6a pkt 34, 36, 37. Wersja dla operatora: `IT1-PLAN-DLA-OPERATORA.md`.

## 0. Wniosek

It. 1 da się zrobić w **10 krokach, każdy = jeden commit** z testem pisanym przed kodem. Nowy kod żyje w `.claude/scripts/telemetria/`
(Node, bez nowych zależności); w istniejących plikach zmieniają się tylko `dev-autopilot-wf.js` (usunięcie agenta telemetrii i liczników
z `budget.spent()`), `dev-pr-wf.js` (schemat `pr:zbierz`), `sync-template.sh` (plik hashy), `settings.json` (hook Stop) i README.
**Grep zmienił dwa elementy planu na tańsze:**
1. **Efort jest już w transkryptach agentów** (pole `effort` wpisów `assistant`: 3 419 / 3 472 agentów opus; haiku nie ma — zgodnie z PA-23).
   Zmiana etykiet agentów jest zbędna — skan czyta efort wprost (decyzja O1).
2. **Wszystkie źródła importu nadal leżą na dysku:** 2 941 / 2 941 agentów z `agents.csv` ma transkrypt, 130 / 130 runów ma plik harnessu,
   149 / 149 epizodów `skille.csv` ma sesję (`cleanupPeriodDays` = 120 od kroku 0). Zamiast importować przeliczone CSV — **pełny skan źródeł**
   nowym skryptem, a CSV i liczby z przeglądów D5/D6 służą jako **test akceptacyjny portu** (1 293 M jedn., mediany skilli 2,39 / 0,56 / 1,40 M)
   (decyzja O2). Importu wymagają tylko rzeczy bez źródła maszynowego: klasyfikacja 574 uwag bota i 40 wpisów starej telemetrii.

## 1. Co już jest w kodzie (grep 2026-09-29) — żeby nie dublować

| co | gdzie | los w It. 1 |
|---|---|---|
| agent `telemetria:<status>` (haiku, heredoc do `autopilot-runs.jsonl`) | `dev-autopilot-wf.js:1028-1087`, wołany w `stopRun()` :1169 i na końcu :1762 | usunięty (krok 7) |
| `tokSpent()` = `budget.spent()` (tylko output), `tokRunStart`, `tokenyRazemK`, `tokeny`/`tokenyEtapy` per faza, `tokeny` w wyniku | :937, :945, :1066, :1294–1331, :1436, :1603–1614, :1757–1768 | usunięte (krok 7, decyzja O3) |
| `skrotE2eSync` + `E2E_SYNC_LIMIT_TELEMETRII` (używane tylko przez agenta telemetrii) + 4 testy N6 | :990–998; `__tests__/telemetria-i-kontrola-fixa.test.mjs:41-64` | przeniesione do skanu razem z testami (krok 2) |
| `podsumujKontroleFixa` + testy N9, `skrotPrzebiegu`, `METRYKI_FAZY` + `metryki-w-stanie.test.mjs` | :1004, :956 | bez zmian — skan czyta je z `result` pliku harnessu i ze stanu |
| `FIX_RESULT.commity[]` (hashe commitów fixa) | :274 | źródło `faza.fix.pliki[]` (git `--name-status` w skanie) — bez zmiany workflowu |
| `effort` w opcjach agentów (`TIERY_DOMYSLNE`, `zEffortem`, `zEffortemAP`) | review-wf :819–822, autopilot :860 | bez zmian; efort czytany z transkryptu |
| `pr:zbierz` — `klasa` = decyzja (napraw / napraw-szerzej / odrzuc / do-operatora), bez klasy błędu, osi i wagi | `dev-pr-wf.js:93-101`, :237–267 | schemat rozszerzony (krok 8) |
| manifest sync-template = lista ścieżek, bez hashy; marker `.template-version` | `sync-template.sh:54-55`, :240–241 | nowy plik `.template-hashes` (krok 9) |
| hook Stop: `stop-build-check-enhanced.sh`, `error-handling-reminder.sh` | `settings.json` | + trzecia komenda (krok 5) |
| doctor | **nie istnieje** (planowany w It. 3c) | skan w doctor → It. 3c (decyzja O5) |
| `package.json`, tsconfig, ESLint w repo szablonu | **nie ma** | dodane w kroku 0 (O10 — ZDECYDOWANE) |
| port Pythona do przeniesienia | `skrypty/koszt_agentow.py` (170 l.), `koszt_skilli.py` (78), `d5r_koszt_output.py`, `d5r_wykonalnosc_rekordu.py`, `d6r_rewizja_audytu.py` | logika przepisana do `.mjs` z poprawkami D5 §8 i D6 §9 |

`~/.claude/telemetry/` zawiera też pliki `1p_failed_events.*` samego Claude Code — nowy plik obok nich jest bezpieczny (stary
`autopilot-runs.jsonl` przeżył tam od lipca).

## 2. Kroki (kolejność = zależności; każdy: test → kod → `pnpm typecheck` → `pnpm test` → `pnpm lint` → commit)

### Krok 0 — narzędzia jakości w repo szablonu (O10, operator 2026-09-29: „tak, O10 z krokiem 0”)
- **Pliki (katalog główny, NIE `.claude/` — sync-template ich nie kopiuje):** `package.json` (pnpm, `devDependencies` z wersjami przypiętymi
  dokładnie: `typescript`, `eslint`, `@eslint/js`, `globals`, `@types/node`; skrypty `typecheck` = `tsc --noEmit`, `lint` = `eslint .`,
  `test` = `node --test` obu katalogów testów), `pnpm-lock.yaml`, `tsconfig.json` (`strict`, `checkJs`, `allowJs`, `noEmit`, zakres:
  `.claude/scripts/**/*.mjs`, testy `.mjs`), `eslint.config.js` (dwie konfiguracje: skrypty Node; workflowy z globalnymi `agent`, `log`, `args`,
  `phase`, `parallel`, `pipeline`, `budget` i top-level `await`). Typy nowych skryptów w JSDoc — pliki zostają `.mjs`, bo hook odpala je zwykły
  `node` u każdego kursanta (`.ts` wymaga Node ≥ 22.18).
- **Poprawki istniejącego kodu:** pierwszy przebieg `pnpm lint` (i `typecheck` tam, gdzie obejmuje istniejące `.mjs`) na 4 462 liniach workflowów
  i 7 plikach testów; znaleziska naprawiane w kodzie, nie w konfiguracji (coding-rules §5); osobny commit. Rozmiar nieznany przed uruchomieniem —
  jeśli wyjdzie > ~30 zmian albo zmiana zachowania, zatrzymuję się i pokazuję listę.
- **Test:** narzędzia same są bramką — `pnpm typecheck && pnpm test && pnpm lint` zielone na obecnym kodzie; próba porażki: celowy błąd
  (np. nieużywana zmienna, zły typ w JSDoc) daje błąd, potem cofnięty.
- **Cofnięcie:** revert commitów kroku 0 (poprawki kodu osobno od dodania narzędzi).

Wspólne dla testów: `node --test '.claude/scripts/telemetria/__tests__/*.test.mjs'` i dotychczasowe `'.claude/workflows/__tests__/*.test.mjs'`.
Fixture: `.claude/scripts/telemetria/__tests__/fixtures/` — mały, syntetyczny katalog `projects/<slug>/<sesja>/` (plik harnessu, journal,
4–6 transkryptów agentów, meta, jedna sesja główna); bez danych z oferty-online (coding-rules §2: fixtures, nie pełne datasety).
Moduły ≤ 300 linii (coding-rules §1) — dlatego podział na pliki.

### Krok 1 — rekord `agent` (port `koszt_agentow.py` z poprawkami)
- **Pliki:** `.claude/scripts/telemetria/zrodla.mjs` (odczyt pliku harnessu, journala, transkryptu, meta), `role.mjs` (`rola()` z dopasowaniem
  najdłuższej nazwy, `klasaRoli()` wg `dane/d3-mapa-rol-agentow.txt`, `klasyfikuj()` po prompcie dla starych runów), `agent.mjs` (rekord),
  `cennik.mjs` (in×1 + cache_w×1,25 + cache_r×0,1 + out×5).
- **Test najpierw** (`agent.test.mjs`): (a) odpowiedź API w kilku wpisach z różnym `output_tokens` → liczona raz, z OSTATNIEGO wpisu;
  (b) `ctx_start` = in + cache_w + cache_r pierwszej tury; (c) `effort` z transkryptu, haiku → null; (d) `fix:kontrola` / `fix:pre-skan` / `fix:poprawka`
  nie sklejają się w `fix`; (e) agent z `started` bez `result` → `wynik: brak`, wpis `failed` → `blad`, `proba` z `attempt`; (f) faza agenta
  workflowu-dziecka = najbliższa wcześniejsza grupa „Faza N”; (g) `kontekst{claude_md_zn, rules_zn, learned_zn, pamiec_zn, narzedzia_n, skille_n,
  tools_zn, odroczone_zn, skille_zn}` z załączników przed pierwszym `assistant`; (h) `cc_wersja`, `prompt_zn`, `narzedzia.mcp`.
- **Działa, gdy:** test zielony ORAZ **akceptacja na prawdziwych danych** (skrypt tylko czyta): suma kosztu 2 941 agentów z `agents.csv`
  = 1 293 M jedn. ±0,5% i udziały etapów oferty-online po 06.09 = `d5r-koszt-output.txt` §2 ±0,3 pp. Rozjazd = błąd portu, nie tolerancja.
- **Cofnięcie:** `git revert` commita (nowe pliki, nic nie woła ich jeszcze).

### Krok 2 — rekordy `faza` i `run`
- **Pliki:** `faza.mjs`, `run.mjs`, `git.mjs` (jedyne wywołania `git`: `show --name-status --numstat` commitów fixa), przeniesiony
  `skrotE2eSync` (do `faza.mjs`).
- **Test najpierw** (`faza-run.test.mjs` + przeniesione 4 testy N6 bez zmiany asercji): (a) status z pliku harnessu: completed + `result.status`
  OK/STOP → OK/STOP z powodem; `killed`/`failed` → KILLED/FAILED; (b) brak pliku harnessu, run w `background_tasks` → pominięty (w toku);
  brak pliku, journal cichy > 3 h, run nieobecny w `background_tasks` → KILLED, powód „sesja zakończona” (O6); (c) `faza.fix.pliki[]`
  = `[{plik, status: A|M|D|R}]` + `linie_diff{plus, minus}` z commitów `FIX_RESULT.commity[]` (repo-fixture w katalogu tymczasowym);
  commit nieosiągalny → `pliki: null`, nie wyjątek; (d) `findingi_per_os` z `result` reviewerów w journalu; (e) `stop_kategoria` z powodu STOP;
  (f) **test kompletności kluczy**: rekord `run`/`faza`/`agent`/`skill` ma KAŻDY klucz z d5 §2, §7, §8, §10, §11 (także te bez producenta dziś:
  `bramki.*`, `wiedza.*`, `sceptyk`, `werdykty`, `testy_usuniete`, `ogrod`, `smoke`, `profil_stacku` — wartość null) — wymóg PANEL-WEJSCIE §12
  „pola mogą być null, klucze nie mogą zniknąć”.
- **Działa, gdy:** test zielony; na prawdziwych danych statusy 156 runów z przeglądu D5 zgadzają się z `d5r-wykonalnosc-rekordu.txt`
  (autopilot 20 OK / 30 STOP / 3 killed / 2 failed; dev-pr 59 OK / 8 / 2 / 6 STOP).
- **Cofnięcie:** revert.

### Krok 3 — rekord `run.szablon` (wersja maszynerii, która się wykonała)
- **Pliki:** `szablon.mjs` — `marker` (`.claude/.template-version` albo null), `skrypt_sha` = hash blob gita pola `script` pliku harnessu (liczony
  w Node: sha1 z `blob <len>\0` + treść, bez wywołania git), `zgodny` (= hash z `.claude/.template-hashes`, null gdy pliku brak),
  `dzieci_zmienione` (pliki `*-wf.js` różne od hashy albo mtime > `startTime`).
- **Test najpierw:** hash zgodny z `git hash-object` na fixture; skrypt zmieniony o jeden znak → `zgodny: false`; brak pliku hashy → null.
- **Działa, gdy:** test zielony; na danych: 33 / 55 runów autopilota „spoza historii szablonu” jak w D5 §8 pkt 3 (kontrola względem historii gita
  szablonu, jednorazowo w teście akceptacyjnym).
- **Cofnięcie:** revert.

### Krok 4 — zapis i CLI `zbierz.mjs` (+ rekord `skill`)
- **Pliki:** `zapis.mjs` (jeden `appendFileSync` na partię; `agent` dopisywany, gdy klucza brak; `run`/`faza` — nowa wersja przy zmianie;
  odczyt z deduplikacją „ostatnia wersja per klucz”; zamek-katalog tylko jako oszczędność pracy; linia nieparsowalna → pominięta + wpis do
  `~/.claude/telemetry/zbierz-bledy.log`, nigdy przepisanie pliku), `skill.mjs` (port `koszt_skilli.py` z granicą D6 §9: epizod do następnego
  skilla albo końca sesji; subagenci po `toolUseId`; deduplikacja kopii wznowionych sesji; `pierwsza_odpowiedz_jedn`, `wiadomosci_operatora`,
  `okno_h`), `zbierz.mjs` (CLI: `--skan`, `--skan --szybko` = katalogi zmienione po znaczniku ostatniego skanu, `--hook` = czyta JSON hooka
  ze stdin, zawsze exit 0, zero wyjścia na stdout).
- **Plik danych:** `~/.claude/telemetry/pipeline.jsonl` (O4). Stary `autopilot-runs.jsonl` nietknięty.
- **Test najpierw:** (a) dwa skany z rzędu → zero nowych linii; (b) zmiana statusu runu → nowa wersja, odczyt zwraca nową; (c) uszkodzona linia
  w pliku → skan przechodzi, błąd w logu; (d) `--hook` z uszkodzonym stdin → exit 0, wpis w logu; (e) epizod skilla nie kończy się na
  `<task-notification>` ani na „[Request interrupted”.
- **Działa, gdy:** testy zielone; pełny skan maszyny (426 plików harnessu dziś) kończy się bez błędu; typ `skill`: mediany pełnego kosztu
  dev-plan / dev-docs / dev-prep = 2,39 / 0,56 / 1,40 M ±2% (`d6r-rewizja-audytu.txt`); czas `--skan --szybko` bez zmian < 1 s.
- **Cofnięcie:** revert; plik `pipeline.jsonl` usuwam wyłącznie po Twoim potwierdzeniu ścieżki.

### Krok 5 — hook Stop jako wyzwalacz
- **Pliki:** `.claude/settings.json` — trzecia komenda w istniejącym bloku Stop: `node "$CLAUDE_PROJECT_DIR/.claude/scripts/telemetria/zbierz.mjs" --hook`
  (z `timeout` hooka 10 s).
- **Test najpierw:** `hook.test.mjs` — proces `zbierz.mjs --hook` z przykładowym stdin (format z `dane/mr-surowe/stop-hook.jsonl`, run `running`
  i run zakończony) kończy się exit 0, pusty stdout, zapisuje tylko run zakończony.
- **Działa, gdy:** w NOWEJ sesji (N2) po pierwszej odpowiedzi nie ma śladu w transkrypcie (zero tokenów) i czas hooka < 1 s; odczyt It. 1 (§3).
- **Cofnięcie:** revert jednego wpisu w `settings.json`; skan ręczny i skan w `raport.mjs` działają dalej.

### Krok 6 — `raport.mjs` (raport miesięczny)
- **Pliki:** `raport.mjs` (+ `raport-sekcje.mjs`, jeśli > 300 l.). Na starcie `--skan`. Sekcje z d5 §4: koszt (per projekt/zadanie/run, udziały per
  etap jednym jawnym grupowaniem + przeliczony punkt odniesienia ETAP0), kontekst (`ctx_start` p50/p90 per klasa roli I per model vs cele D4,
  `narzedzia_n`, `claude_md_zn`), efort per klasa roli, jakość (`findingi_per_os`, P1/P2 bota na 100 plików z UNIKALNYCH wątków `run.pr`),
  niezawodność (STOP per kategoria, KILLED, MANUAL), anomalie (> 2× mediany roli, `ctx_start` > progu klasy i modelu). Wyjście: `.txt` + `.csv`
  do `--wyj` (domyślnie `docs/reviews/telemetria/`).
- **Test najpierw:** na fixture — sumy kosztu, mediana, grupowanie etapów, liczenie wątków unikalnych (ten sam wątek w 2 turach = 1).
- **Działa, gdy:** raport za wrzesień na prawdziwych danych odtwarza udziały etapów z d5r §2 i `ctx_start` z D4 (8,8k / 25,5k / 26–27k / 20,3k /
  28–30k / 38,6k ±5%).
- **Cofnięcie:** revert.

### Krok 7 — orkiestrator bez agenta telemetrii i bez liczników `budget.spent()`
- **Pliki:** `dev-autopilot-wf.js` — usunięte `zapiszTelemetrie()` i oba wywołania, `tokSpent`, `tokRunStart`, `tokenyRazemK`, `tokeny` /
  `tokenyEtapy` w `raporty[]` i w wyniku (O3), `skrotE2eSync` (już w skanie), opis fazy „Zakończenie” w `meta`; `stopRun()` zostaje z commitem
  artefaktów. README: wiersz `dev-autopilot-wf` (:142) — telemetria = skan po runie. `skills/dev-docs-review/SKILL.md:130` — jedno zdanie.
- **Test najpierw** (w `telemetria-i-kontrola-fixa.test.mjs` → plik przemianowany na `kontrola-fixa.test.mjs`, testy N9 bez zmian):
  „orkiestrator nie powołuje agenta telemetrii” (brak `label` zaczynającego się od `telemetria:` i brak `budget.spent` w źródle — strażnik
  regresji, bo skrypt workflowu nie da się uruchomić w teście) + `skladnia-workflowow.test.mjs` zielony.
- **Działa, gdy:** testy zielone; w runie odczytu (§3) plik harnessu nie ma agenta `telemetria:*`, a wynik runu ma `status` i `powod`
  (z nich czyta skan).
- **Cofnięcie:** revert — stary agent wraca; skan działa niezależnie.

### Krok 8 — `pr:zbierz` z klasą błędu, osią i wagą → `run.pr` (zamknięty słownik klas)
- **Przygotowanie (analiza, przed edycją `.claude/`):** skrypt `skrypty/it1_slownik_klas.py` → `dane/it1-slownik-klas.{txt,csv}`: 109 dzisiejszych
  nazw z `klasyfikacja-574.csv` + klasy ETAP1 → jedna lista ~25–35 klas (+ `inna`) z odwzorowaniem stara → nowa. Listę ocenia niezależny subagent
  i dopiero po naniesieniu jego poprawek wchodzi do kodu (O7 — bez akceptacji operatora).
- **Pliki:** `dev-pr-wf.js` — stała `KLASY_BLEDOW` (słownik w kodzie workflowu, bo skrypt workflowu nie czyta plików), w schemacie `ZEBRANE`
  nowe pola per wątek: `klasaBledu` (enum słownika), `os` (security | correctness | spec | test | performance | code-quality | e2e | brak),
  `waga` (P1 | P2 | P3 | 0) i na poziomie tury `plikiPr` (liczba plików PR z `gh pr view --json changedFiles` — agent już woła `gh`);
  tabela klas w prompcie etapu `zbierz`. Istniejące `klasa` (decyzja) bez zmian. Skan buduje `run.pr{numer, tury, pliki, uwagi_razem, p1, p2, p3,
  koszyk, klasy[{id, klasa, severity, plik, os, ma_regule: null}], rekomendacja: null}` (`ma_regule` i `rekomendacja` — It. 8 i It. 2).
- **Test najpierw** (`klasy-bledow.test.mjs`): enum schematu = `KLASY_BLEDOW`; każda z 109 starych nazw ma odwzorowanie w słowniku (plik mapowania
  z `dane/`); skan na fixture wyniku `pr:zbierz` z 2 turami liczy wątki unikalne po `id`.
- **Działa, gdy:** testy zielone; realny odczyt przy kalibracji klasyfikatora w It. 2 (2–3 stare PR vs 1b) — w It. 1 nie ma świeżego PR.
- **Cofnięcie:** revert — `pr:zbierz` wraca do samej decyzji.

### Krok 9 — sync-template zapisuje hash per plik
- **Pliki:** `sync-template.sh` — po manifeście zapis `.claude/.template-hashes` (linia: `<blob-sha>\t<ścieżka>`, `git hash-object` każdego
  pliku zarządzanego); manifest bez zmian formatu (O8). `SKILL.md` sync-template — jedno zdanie o nowym pliku.
- **Test najpierw** (`sync-template.test.mjs`, w `.claude/skills/sync-template/scripts/__tests__/`): uruchomienie z `TEMPLATE_LOCAL_SRC`
  (repo-fixture) i `PROJECT_DIR` (katalog tymczasowy) → plik hashy istnieje, hash każdego pliku = `git hash-object`; drugi sync bez zmian
  nie zmienia pliku.
- **Działa, gdy:** test zielony; w projekcie po sync `run.szablon.zgodny = true` dla runu na świeżym szablonie.
- **Cofnięcie:** revert; brak pliku hashy = `zgodny: null` (skan to znosi).

### Krok 10 — import historii bez źródła maszynowego (jednorazowo, poza `.claude/`)
- **Pliki:** `skrypty/it1_import.py` (analiza, nie synchronizowany do projektów) → dopisuje do `pipeline.jsonl` z `v: 0` i `zrodlo: import`:
  (a) `klasyfikacja-574.csv` → `run.pr` dla 19 PR oferty-online, klasy przez odwzorowanie z kroku 8, `pliki` = rozmiar PR z `gh` (tylko odczyt;
  lista PR-ów zapisana do `dane/` przed importem), wątki unikalne; (b) 40 wpisów starej telemetrii (`autopilot-runs.odzyskane-2026-09-19.jsonl`
  32 + `autopilot-runs.jsonl` 8; `dane/telemetria-odzyskana-wszystko.json` ma 33 — różnicę wyjaśnia import, deduplikacja po `projekt|zadanie|ts`) → typ `run_v0` z kluczem `projekt|zadanie|ts` (stare wpisy nie mają `wf_…`; przypisanie do runu po czasie
  tylko tam, gdzie jednoznaczne — reszta zostaje jako `run_v0` bez runu).
- **Nie importuję** `agents.csv` i `skille.csv` — zastępuje je pełny skan z kroków 1 i 4 (O2), a te pliki służą tam jako test akceptacyjny.
- **Test:** skrypt kończy się kontrolą: 574 uwagi → tyle samo wierszy `klasy[]` w 19 rekordach, 0 klas spoza słownika; liczba `run_v0` = liczba unikalnych wpisów.
- **Cofnięcie:** linie importu mają `zrodlo: import` — filtr przy odczycie; plik nie jest przepisywany.

## 3. Odczyt It. 1 (PANEL-WYNIK §4: „1 run: każdy run ma rekord z prawdziwym statusem, 0 agentów telemetrii”)

1. **Nowa sesja (N2)** po ostatnim commicie `.claude/`.
2. **Run odczytu:** `smoke-autopilot` (`.claude/templates/smoke-autopilot`) w katalogu roboczym poza repo szablonu, po `sync-template`
   z lokalnego źródła (O9).
3. Po zakończeniu: bez żadnej komendy (hook) w `pipeline.jsonl` jest rekord `run` z `status` = status z pliku harnessu, rekordy `faza` i `agent`
   dla każdego agenta z `workflowProgress`, `szablon.zgodny = true`, `effort` u agentów opus; plik harnessu nie ma agenta `telemetria:*`.
4. Pełny skan maszyny: każdy z 426+ plików harnessu ma rekord `run` (liczba rekordów = liczba plików), `NIEZNANY` = 0.
5. `raport.mjs` za wrzesień → `docs/reviews/telemetria/` — do przejrzenia przez Ciebie.
Warunek odwrotu: brak — bez telemetrii nie ma odczytu żadnej iteracji (PANEL-WYNIK). Błędny rekord = poprawka skanu, nie wycofanie.

## 4. Otwarte decyzje (rekomendacja pierwsza)

- **O10 narzędzia jakości — ZDECYDOWANE 2026-09-29:** `package.json` + TypeScript `strict`/`checkJs` + ESLint, pnpm, wersje przypięte, krok 0
  z poprawkami istniejącego kodu (operator: „To, co proponujesz, to jest gorsze podejście. Przecież możemy dodać” → „tak, O10 z krokiem 0”).
  Tryb omawiania: O10, O2, O3, O7, O9 po jednej; O1, O4, O5, O6, O8 do akceptacji hurtem.
- **O2 — ZDECYDOWANE 2026-09-29: pełny skan** (operator: „tak, pełny skan”). `agents.csv` i `skille.csv` nie są importowane; są testem
  akceptacyjnym kroków 1 i 4. Pierwszy pełny skan przed ~2026-12-03 (retencja 120 dni najstarszych transkryptów z 2026-08-05).
- **O3 — ZDECYDOWANE 2026-09-29: usunąć wszystkie trzy** (operator: „tak, usuń wszystkie trzy”): `tokenyRazemK`, `tokeny`/`tokenyEtapy`
  w `raporty[]` faz i `tokeny` w wyniku runu, razem z `tokSpent`/`tokRunStart`. Jedyne źródło kosztu = skan (pełny cennik).
- **O7 — ZDECYDOWANE 2026-09-29: 25–35 klas + `inna`, BEZ akceptacji operatora; zamiast niej review niezależnego subagenta** (operator: „Bez mojej
  akceptacji mi się tego nie chce czytać, a też nie znam się na błędach, więc zaufam tobie. Może sobie pójść jakiegoś subagenta, który zrobi review
  i oceni to jeszcze.”). Wyjątek od „BEZ agentów” tej sesji — jeden agent, tylko do oceny słownika. Procedura przed krokiem 8: (1) skrypt
  `skrypty/it1_slownik_klas.py` → projekt listy z odwzorowaniem 109 nazw + klas ETAP1 i przykładami; (2) subagent (świeży kontekst, czyta tylko
  plik listy, `klasyfikacja-574.csv` i ETAP1/ETAP1B §3) ocenia: klasy rozłączne (jedna uwaga → jedna klasa), brak klas-worków (≤ 10% uwag P1/P2
  w jednej klasie poza `inna`; `inna` ≤ 5%), każda klasa przypisana do jednej osi, nazwy zrozumiałe w 5 sekund; zwraca listę poprawek z uzasadnieniem;
  (3) poprawki naniesione, werdykt i zmiany w `dane/it1-slownik-klas-review.txt`; operator dostaje tylko jedno zdanie w podsumowaniu kroku.
- **O9 — ZDECYDOWANE 2026-09-29: smoke-autopilot teraz** (operator: „tak, smoke teraz”), w nowej sesji po ostatnim commicie `.claude/`,
  w katalogu roboczym poza repo; przed startem szacunek kosztu z historii runów smoke (jeśli są w danych).
- **O1, O4, O5, O6, O8 — ZAAKCEPTOWANE 2026-09-29 wg rekomendacji** (operator: „o1 - Ok … o4 - ok, o5 - ok, 06 - ok, o8 - ok”). Przy O1 pytanie
  operatora „czy agent Haiku zostaje?” — wyjaśnione: agent telemetrii (haiku) jest USUWANY (krok 7); „haiku bez efortu” w O1 dotyczy pozostałych
  agentów mechanicznych pipeline'u (dedup, stan:zapis, pre-skan…), które zostają do It. 3 — u nich `effort` = null, bo model go nie obsługuje.
  **Plan It. 1 zamknięty — wszystkie decyzje O1–O10 podjęte.**

- **O1 efort:** (a) **czytać `effort` z transkryptu agenta** — już jest (3 419 / 3 472 opus), zero zmian w workflowach; (b) dopisywać efort do
  etykiet (PANEL-WYNIK) — 2 workflowy do zmiany, ryzyko rozjazdu etykiety z faktycznym parametrem. Rekomendacja (a).
- **O2 import `agents.csv` / `skille.csv`:** (a) **pełny skan źródeł**, CSV jako test akceptacyjny portu; (b) import przeliczonych CSV — dwie
  ścieżki liczenia tej samej rzeczy. Rekomendacja (a); skan musi zdążyć przed 120-dniową retencją (najstarsze transkrypty z 2026-08-05 → do
  ~2026-12-03).
- **O3 liczniki z `budget.spent()`:** (a) **usunąć wszystkie** (`tokenyRazemK`, `tokeny`, `tokenyEtapy` w raporcie fazy i wyniku) — to ~11%
  kosztu, myli; koszt per faza i etap daje skan; (b) usunąć tylko `tokenyRazemK` (literalnie PANEL-WYNIK). Rekomendacja (a).
- **O4 plik danych:** (a) **jeden `~/.claude/telemetry/pipeline.jsonl`** z deduplikacją przy odczycie; (b) plik per run. Rekomendacja (a)
  (D5 §8 pkt 2: oba bezpieczne, jeden prostszy dla raportu).
- **O5 skan w doctor:** (a) **w It. 3c razem z doctor** (doctor dziś nie istnieje); siatką do tego czasu hook + `--skan` na starcie raportu;
  (b) minimalny doctor już teraz. Rekomendacja (a).
- **O6 run przerwany razem z sesją:** (a) **brak pliku harnessu + journal cichy > 3 h + run nie w `background_tasks` → KILLED „sesja zakończona”**
  (najdłuższy agent w historii 6 016 s; późniejszy plik harnessu nadpisuje wersję); (b) zostawić NIEZNANY do ręcznej decyzji. Rekomendacja (a).
- **O7 słownik klas:** (a) **~25–35 klas + `inna`, lista z odwzorowaniem od Ciebie do akceptacji przed krokiem 8**; (b) 109 obecnych nazw
  bez scalania (nieporównywalne — ETAP1B: 3 nazwy na ten sam parser). Rekomendacja (a).
- **O8 hashe szablonu:** (a) **osobny `.claude/.template-hashes`** — stary manifest i logika REMOVE bez zmian; (b) hash w manifeście — zmiana
  formatu i czytania starych manifestów. Rekomendacja (a).
- **O9 run odczytu:** (a) **smoke-autopilot w katalogu roboczym** teraz (koszt jednego małego runu, odczyt od razu); (b) pierwszy run B0
  w nowym projekcie (It. 2) — zero dodatkowego kosztu, ale błąd skanu wyjdzie na danych B0. Rekomendacja (a).

## 5. Czego It. 1 NIE robi

Kalibracja klasyfikatora, `rekomendacja` w JS i B0 (It. 2); doctor (It. 3c); pola z producentem w późniejszych iteracjach (bramki It. 4a,
werdykty sceptyka It. 5, wycinek wiedzy i `ma_regule` It. 8, ogród R1) — klucze są, wartości null; zmiany promptów reviewerów; CLAUDE.md.
Zero nowych agentów i zero nowych zależności.

## 6. Po akceptacji

Kroki 1–10 po kolei (krok 8 czeka na Twoją akceptację słownika), po każdym: `node --check` wszystkich zmienionych `.mjs`/`.js`,
`node --test` obu katalogów testów, commit. Potem nowa sesja (N2) i odczyt §3; HANDOFF (§2, 6a pkt 38, §8 → instrukcja It. 2), pamięć projektu,
commit `docs/reviews`.

# Pilot szablonu mobile — run 4: wnioski do niezależnej analizy

Plik dla nowej sesji, która ma sprawdzić, czy wnioski i poprawki z runu 4 wystarczą. Jest samowystarczalny: opisuje stan,
co zrobiono, co znaleziono, co poprawiono, czego nie sprawdzono i jakie decyzje czekają. Pełna historia pilota (W1–W37, runy
1–4): `docs/reviews/2026-11-pilot-nawykometr-wnioski.md`. Plan: `docs/plans/2026-11-01-001-feat-szablon-mobile-z-rdzenia-plan.md`,
sekcja „Etap 4” (wiersz „pilot wnioski 4”).

## Zadanie dla sesji analizującej

1. Oceń, czy poprawki W35 i W36 usuwają przyczynę, a nie objaw, i czy testy łapią regresję (wymagane: test pada na starym kodzie).
2. Oceń W37 (otwarty) i zaproponuj poprawkę z uzasadnieniem; przyczyna utraty sterownika XCTest jest niepotwierdzona.
3. Sprawdź, czy lista „Niesprawdzone” jest pełna i czy któraś pozycja blokuje włączenie automatu publikacji (IU-3.3).
4. Zaplanuj przeniesienie zmian szablonu webowego (rdzenia) do repo mobile — sekcja „Zmiany rdzenia niewprowadzone na mobile”.
5. Nie dotykaj prawdziwych projektów (zasada niżej). Czego nie sprawdzisz, nazwij niesprawdzonym.

## Zasady (decyzje operatora)

- **2026-11-11: szablon testujemy wyłącznie na kopiach.** Prawdziwych projektów (`../Nawykometr` z remote `nawykometr-app`,
  `gramywpadla`, `vibersi` i inne) nie dotykamy: bez syncu, gałęzi, baz, `.claude/`.
- Bez EAS, nowych kont, połączeń ze zdalnymi bazami. Sekretów nie ruszamy; z `.env` czytamy tylko nazwy kluczy.
- Merge do `main` szablonu z pushem i publikacja do repo mobile — tylko za zgodą operatora.

## Stan na koniec runu 4 (2026-11-12/13)

- **Szablon** (`claude-code-starter`): `main` = `origin/main` = `b0dd78b`, CI `maszyneria` zielone (run `43201177438`). Gałąź
  `popr/pilot-run4-kopie-repo-testowe` (worktree `.claude/worktrees/plan-szablon-mobile`), **niezmergowana**, commity od `b0dd78b`:
  `c77fdd6` (plan i wnioski: tylko kopie), `3c4d6f2` + `5dd2424` (W35), `72afd58` (W36), `cfbefd2` (zapis runu 4), plus commit
  z tym plikiem.
- **Bramki na gałęzi** (`72afd58`; późniejsze commity to same dokumenty): `pnpm -s test` 1956/1956; typecheck 0; lint 0;
  `node stacks/testuj-wariant.mjs expo` 1470/1472 (2 pominięte, 0 padnięć, 435 plików, typecheck 0); wariant także z `PATH` bez
  Maestro (lekcja z CI runu 3) — tak samo.
- **Repo mobile** `AIBiz-Automatyzacje/workspace-template-mobile`: `main` = `2ef6b6e` („sync: rdzeń 30d4ed2…”), strażnik zielony.
  Automat publikacji wyłączony.
- **Kopia** `../_pilot-mobile/Nawykometr-kopia`: `main` = `origin/main` = `d5debba`, drzewo czyste, maszyneria `2ef6b6e`.
  Zdalne: `origin` = prywatne repo testowe `AIBiz-Automatyzacje/nawykometr-kopia-pilot`; `nawykometr-lokalny` = `../Nawykometr`
  z `pushurl` `BRAK` (prawdziwy Nawykometr: `main` `5ad1445`, bez zmian).
- **Środowisko kopii:** lokalny Supabase w Dockerze (`supabase_*_nawykometr-kopia`, porty 54321/54322), symulator
  „Nawykometr-kopia” (UDID `928F81C8-13E6-43A6-9305-A5C640A0C466`), Metro zatrzymane. Atrapa `SUPABASE_ACCESS_TOKEN` i pusty
  `EXPO_TOKEN` w `.claude/settings.local.json` kopii; w shellu operatora są prawdziwe — komendy supabase/expo w kopii tylko bez nich.

## Przebieg runu 4

1. **Repo testowe.** Skan wszystkich blobów historii `main` kopii (2343) na wzorce kluczy i nazwy plików: tylko `.env.example`
   i przykłady z dokumentacji szablonu. Push samego `main`.
   **Odstępstwo od polecenia operatora („nie ruszaj origin”):** skill `/dev-pr` na sztywno pushuje na `origin` i liczy rozmiar PR
   względem `origin/main`, więc w kopii `origin` → `nawykometr-lokalny` (z `pushurl` `BRAK`), repo testowe → `origin`. Bez tego
   etapu PR nie dało się sprawdzić. Do oceny: czy szablon powinien gdzieś to mówić (projekt bez GitHuba w `origin`).
2. **`/dev-pr --claude-md opinia-z-ustawien --bez-push`** (zaległe uzgodnienie z runu 3): CLAUDE.md uzgodniony (`8ebb1ec`), ale
   commit **wypchnięty mimo `--bez-push`** → W35.
3. **`/dev-plan`** zadania `wersja-w-ustawieniach` (stopka z wersją i buildem z `expo-application` w Ustawieniach, testy Jest,
   jeden `[E2E]`, bez migracji i paczek): plan Lekki, 1 faza, 2 IU (`feature-builder-ui`), `553864a`. `sprawdz` czerwony raz —
   **W12 potwierdzony** (grep po `run-all.sh` w polu Weryfikacja uznany za uruchomienie runnera). `gotowosc` zielona.
4. **Autopilot — trzy starty.** Dwa STOP-y w bootstrapie na canary E2E („kod SIGKILL”) → W36, W37. Trzeci run do archiwum:
   `17f5fe1` faza, `6b3ae9c` fix, `1f8403f` i `85b7efe` wiedza, `7c6bf65` archiwum. Review P1 0, P2 1 (naprawiony), P3 0;
   `[E2E]` `e10-wersja-w-ustawieniach` PASS; Jest 1235/1235, typecheck, lint, `expo export`. Smoke bez pozycji.
5. **`/dev-pr --bez-bota`** — pierwszy żywy etap PR w pilocie: PR #1 na repo testowym, `merge` najpierw `GOTOWY-DO-DECYZJI`
   (jedyny warunek: brak CI i brak zgody), po `zgodaBezCi` squash `132224a`; `compound` `POMINIETY` (tryb bez bota, zgodnie
   z kodem); `claude-md` `d5debba`, push OK. Sprawdzone na GitHubie: PR `MERGED`, `origin/main` = `d5debba`.

## Wnioski runu 4

### W35 — `--bez-push` nie chronił przed pushem (wysoki, poprawione w rdzeniu)

- **Fakt:** etap `claude-md` z `bezPusha: true` wypchnął commit i zwrócił `push: true`, `pushDetal: "OK"`, `ciGlownej: "brak-ci"`
  (tryb każe `"nie-dotyczy"`). Agent `klasa-mechaniczny` (Haiku) dostał krok `PUSH: … git push origin …`, a zakaz „NIE pushuj”
  był doklejony na końcu tego kroku. JS nie sprawdzał wyniku. W projekcie, gdzie push na główną to deploy, tryb nie chronił.
- **Poprawka** (`.claude/workflows/dev-pr-wf.js`, etapy `claude-md` i `compound`): `krokiPoCommicie(nr)` — w trybie bez pusha
  w poleceniu jest jeden krok `KROK_BEZ_PUSHA` („nie uruchamiaj `git push`, `git fetch` ani `gh run`”), bez kroków CI głównej
  i PUSH; `pushMimoBezPusha()` — `push: true` mimo trybu daje pole `pushMimoBezPusha: true` w wyniku i UWAGĘ w logu. Skill
  `dev-pr/SKILL.md`: takie pole to pierwsza UWAGA raportu, bez cofania pushem.
- **Testy:** `dev-pr.test.mjs` — prompty obu etapów z `bezPusha` bez `git push origin` i `gh run`, prompt bez trybu nadal z pushem
  i CI; wynik z `push: true` w trybie → `pushMimoBezPusha: true` i log. Na starym kodzie 3 testy padają. Zmienione istniejące
  testy: „compound: krok push w prompcie…” i „tryb bez pusha…” (wzorce źródła → nowe kroki / zachowanie).
- **Do oceny:** to nadal zakaz w prompcie + wykrycie po fakcie, nie twarda blokada (agent ma Bash). Twarda blokada wymagałaby
  np. hooka albo uruchomienia commitu przez skrypt bez pushu. Etap `claude-md` krok 1 nadal robi `git pull --ff-only` (odczyt,
  nie push) — świadomie zostawione. Niesprawdzone na żywym runie (kopia ma maszynerię `2ef6b6e`).

### W36 — STOP canary mylił przyczynę (średni, poprawione w nakładce Expo)

- **Fakt:** STOP „canary na Nawykometr-kopia: kod SIGKILL” ze stosem Maestro (`FileUtils.zipDir` ← `DebugLogStore.finalizeRun`).
  To własny limit skryptu (`LIMIT_CANARY_MS` = 240 s w `stacks/expo/nakladka/.claude/scripts/e2e/expo-canary.mjs`), a sesja kopii
  opisała to jako zabicie przez system.
- **Poprawka:** `uruchomMaestro` zwraca `przekroczonyLimitMs`, gdy SIGKILL dał limit skryptu (pole tylko wtedy — kształt wyniku
  bez zmian dla `expo-flow.mjs`, które mapuje `SIGKILL` → `zawieszony`); `przejdzCanary` przy limicie: „przekroczony limit 240 s
  — skrypt zatrzymał Maestro (SIGKILL)”, naprawa: zmierz czas ręcznie (`time maestro …`), krótki przebieg = obciążenie maszyny,
  długi albo wiszący = flow i zrzut w katalogu roboczym.
- **Test:** `stacks/expo/__tests__/adapter-e2e.test.mjs` — atrapa `maestro` śpiąca dłużej niż limit 3000 ms → `przekroczonyLimitMs`;
  treść STOP-u z limitem; zwykły SIGKILL bez nowej treści. Pada na starym kodzie.
- **Do oceny:** `expo-flow.mjs` (tester scenariuszy) też używa `uruchomMaestro`, ale nie korzysta z nowego pola — czy status
  `zawieszony` powinien rozróżniać limit skryptu.
- **Moja pomyłka do odnotowania:** pierwszy STOP przypisałem obciążeniu Maca przez bramki szablonu uruchomione równolegle; drugi
  STOP przy wolnej maszynie pokazał, że to nie jedyna przyczyna (W37).

### W37 — canary bramki E2E jest niestabilny (średni, OTWARTY, do decyzji)

- **Pomiary (2026-11-12, Maestro 2.5.1, iOS 26.4, symulator „Nawykometr-kopia”):**
  - Autopilot, start 1 (równolegle bramki szablonu): STOP po 240 s, zawieszenie w `zipDir`.
  - Autopilot, start 2 (maszyna wolna): STOP po 240 s; log Maestro: zaraz po `openLink` `viewHierarchy` 500
    `kAXErrorInvalidUIElement`, `CommandFailed`, potem zawieszenie do limitu, brak zrzutu.
  - Ręczne `e2e.mjs start`: raz kod 1 po 32 s („Failed to connect to /127.0.0.1:7001” — sterownik XCTest zniknął; wcześniej
    Maestro przy `clearState` odinstalował i zainstalował aplikację), potem dwa razy „gotowe” po 244 s i 112 s.
  - Sam `maestro test .maestro/_canary.yaml` (także z argumentami skryptu: `--test-output-dir`, `--debug-output`, `-e APP_ID…`):
    3 × kod 0, ok. 34 s.
  - Reload Metro (`wyslijReload`, jak `adapter.mjs` przed canary) tuż przed Maestro: 2 × kod 0, ale 133 s i 154 s.
  - Autopilot, start 3: canary przeszedł, run do końca.
- **Wniosek:** po reloadzie canary trwa 110–240 s zamiast ~34 s, więc limit 240 s jest w zasięgu zwykłego przebiegu; dodatkowo
  zdarza się utrata sterownika XCTest (przyczyna niepotwierdzona, log sterownika nadpisany przez kolejne przebiegi). Canary
  własny projektu robi `clearState` i `clearKeychain`, co w Maestro na iOS oznacza reinstalację aplikacji.
- **Opcje:** (a) po `wyslijReload` czekać na koniec przeładowania (np. pojawienie się bundla w logu Metro / gotowość aplikacji)
  albo nie wysyłać reloadu, gdy Metro właśnie wystartowało; (b) wyższy limit canary; (c) jedno ponowienie canary przed STOP-em.
  Rekomendacja sesji prowadzącej: (a), bo usuwa przyczynę; (c) jako uzupełnienie dla utraty sterownika. Decyzja operatora.

### Pozostałe obserwacje runu 4

- **W12 potwierdzony** (otwarty): detektor „uruchamia runner E2E” w `plan.mjs sprawdz` reaguje na ścieżkę `run-all.sh` w poleceniu
  grep.
- **W30 ponownie:** commity etapu `claude-md` mają stopkę `Co-Authored-By` z modelem agenta workflowu (Haiku), nie sesji.
- **Po STOP-ie bootstrapu Metro zostało uruchomione** (port 8081), kolejny start je przejął; `e2e.mjs stop` potem: „brak pliku PID
  — serwer nieuruchomiony przez pipeline”. Pokrewne W26 (sprzątanie po STOP-ie) — do oceny, czy serwer bez pliku PID to luka.
- **`tryb-recenzji.mjs`** zwraca `recenzjaPr: "bot"` w projekcie z `.coderabbit.yaml`; tryb bez bota wyłącznie z flagi — zgodnie
  ze skillem, bez zapisu w `.claude/projekt.json`.
- **Compound PR w trybie bez bota jest pomijany z założenia** — projekt bez bota nie zasila bazy wiedzy z etapu PR. Do oceny, czy
  to wystarcza (wiedza z review fazy idzie przez compound autopilota).
- **Prowadzenie sesji kopii przez sesję nadrzędną:** zgoda na merge bez CI i komenda `/dev-pr` przyszły wiadomością, a skill uznaje
  tylko polecenie wpisane przez operatora. To cecha pilota, nie błąd szablonu.

### Sprawdzone na żywo w runie 4 (poprawki z runu 3)

- **W18:** nagłówek raportu review „Gate review (przed fixem): ZASTRZEZENIA”.
- **W28:** adapter SDK `lib/app-version.ts` w IU z UI i IU z samymi plikami E2E → `feature-builder-ui`.
- **W21:** po uzgodnieniu CLAUDE.md bramka gotowości zielona (na żywo sprawdzony wcześniej, po runie 3).

## Niesprawdzone

- Poprawki W35 i W36 na żywym runie (kopia na `2ef6b6e`; wymagają publikacji i syncu kopii).
- Recenzja z botem (CodeRabbit): instalacja aplikacji GitHub przez admina organizacji i konto CodeRabbit; warunki cenowe dla repo
  prywatnych niesprawdzone. Z tym: etapy `zbierz`, `napraw`, tury poprawek, compound PR, bramka merge'a z recenzją czubka.
- Merge z działającym CI (repo testowe bez `.github/`) i `ciGlownej` inny niż `brak-ci`.
- PR wieloczęściowy (`--czesc`), `--bez-merge` z pytaniem o merge.
- Ścieżki, które nie wystąpiły: W11 (`[Manual] agent:`), W19 (smoke bez pozycji), W32 (kontrola fixa bez pominiętych), W23
  (STOP startu E2E z bramką natywną), W25 po `partial`, W17 (seed, który nie wszedł), D4 (`[E2E]` → `[Manual]`), W26 po STOP-ie
  po execute.
- Przyczyna utraty sterownika XCTest (W37).

## Zmiany rdzenia niewprowadzone na mobile (do zaplanowania)

Operator: szablon webowy (rdzeń) dostał kilka zmian i trzeba zaplanować, jak je wprowadzić na mobile.

- Repo mobile ma rdzeń `30d4ed2`; `main` szablonu `b0dd78b` ma od tego czasu **55 commitów bez merge'ów**, 86 plików w `.claude/`
  i `stacks/` (+2740 −270). Do tego dochodzą poprawki tej gałęzi (W35 w rdzeniu, W36 w nakładce) po jej merge'u.
- Główne grupy (partie „weryfikacja partii” punkty 41–55 i „walidacja 51–55” punkty 56–61):
  - **Decyzje operatora i smoke** (punkt 40): decyzje w jednej sekcji `known-issues`, sekcja „Decyzje przed PR” w smoke'u,
    nowy skill `/dev-smoke` zamiast ramki do wklejania, `otwarte.mjs` (sprawy odłożone liczone z plików).
  - **Przegląd spójności planu przed autopilotem** (punkt 41): agent `spojnosc-planu`, `plan/spojnosc.mjs`, bramka w autopilocie
    (świeże zadanie bez przeglądu = STOP), builder rozstrzyga sprzeczność źródeł planu wg hierarchii.
  - **Execute i autopilot:** decyzje autopilota w stanie fazy, gate ZASTRZEZENIA także po wznowieniu, domknięcie częściowe
    (schowek, `partial` z bazą fazy).
  - **`/dev-pr`:** smoke przed PR na czystym drzewie, `--bez-merge` kończy się pytaniem o merge, nieczytelny kontrakt bota
    zatrzymuje start.
  - **Inne:** sygnał Supabase w `stack/projekt.mjs`, skaner kluczy telemetrii, doctor (`ignore_title_keywords`), `sync-template`
    wymusza pełny sync przy testach maszynerii w manifeście.
- **Już odwzorowane w nakładce przez inne sesje** (`git diff 30d4ed2 b0dd78b -- stacks`): agenci builderów i testera (po jednej
  linii), `dev-smoke/references/stack.md` Expo (+19), `dev-docs-complete/references/stack.md`, `security/SKILL.md`, smoke-autopilot
  (`README.md`, `przygotuj-kopie.sh`), `stacks/sloty.json`. Wariant buduje się i przechodzi (1470/1472).
- **Do sprawdzenia przed publikacją:** czy nowe elementy rdzenia mają odpowiednik Expo tam, gdzie zależą od stacku (np. `/dev-smoke`
  na urządzeniu, przegląd spójności planu z makietami mobile, `po-archiwum.mjs` z Maestro), i czy kopia po syncu przejdzie
  bramkę gotowości z nową bramką przeglądu spójności (świeże zadanie bez przeglądu = STOP — zmienia przebieg `/dev-plan` na kopii).
- **Droga:** merge tej gałęzi → publikacja `workflow_dispatch` (za zgodą) → sync kopii → run 5 na kopii, który sprawdzi W35, W36
  i nowe elementy rdzenia na żywo.

## Decyzje czekające na operatora

1. Merge `popr/pilot-run4-kopie-repo-testowe` do `main` szablonu z pushem (rozjazdu z `main` brak na 2026-11-13).
2. Publikacja do repo mobile (rdzeń `b0dd78b` + ta gałąź).
3. W37 — wybór opcji (a/b/c).
4. Otwarte wcześniej: W1/W8, W6, W12, W13, W15, W24, W26, W27, W29, W30, W31, W33.
5. Sprzątanie po pilocie (każde osobno): repo testowe `nawykometr-kopia-pilot`, `claude plugin marketplace remove
   claude-code-starter`, kontenery i wolumeny `supabase_*_nawykometr-kopia`, symulator „Nawykometr-kopia”, katalog `_pilot-mobile`,
   gałęzie `popr/pilot-*`.

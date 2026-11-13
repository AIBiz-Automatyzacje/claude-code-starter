# Pilot szablonu mobile — run 4: niezależna analiza

Odpowiedź na „Zadanie dla sesji analizującej” z `docs/reviews/2026-11-13-pilot-run4-do-analizy.md`. Sesja z 2026-11-13, na gałęzi
`popr/pilot-run4-kopie-repo-testowe`. Prawdziwych projektów nie dotykano; z kopii czytano tylko `.maestro/_canary.yaml`
i `_session-bootstrap.yaml`. Symulatora, Metro ani Maestro sesja nie uruchamiała.

## 1. W35 i W36 — przyczyna czy objaw, testy

Nowe testy uruchomione na kodzie z `b0dd78b` (kopia w katalogu roboczym sesji): W35 — padają 3 (`compound: krok push…`, dwa
`tryb bez pusha…`), W36 — pada 1 (`canary: przekroczony limit skryptu…`). Na gałęzi przechodzą.

**W35.** Usunięcie kroków PUSH i CI głównej z polecenia usuwa to, co wywołało push: agent nie dostaje już komendy. Zostawały
trzy luki, dwie zamknięte w tej sesji:

| Luka | Stan |
|---|---|
| Wykrycie opierało się na polu `push` zwróconym przez agenta, który pushował. Agent, który wypchnie i zwróci `push: false`, przechodził bez śladu. | Zamknięte: osobny agent `klasa-mechaniczny-pomiar` uruchamia `git branch -r --contains <commit>`; niepuste wyjście = `pushMimoBezPusha: true` z nazwą gałęzi. Hash sprawdzany wzorcem przed wstawieniem do polecenia. Pomiar bez wyniku = UWAGA w logu z komendą do ręcznego sprawdzenia. |
| Etap `compound` w trybie bez pusha odsyłał do „pkt 7”, którego w tym trybie nie ma. | Zamknięte. |
| Brak twardej blokady: agent ma Bash i może uruchomić `git push`. | Otwarte, świadomie. Blokada przez `remote.origin.pushurl` zostawia stan w repo projektu: przerwany etap zostawiłby projekt bez możliwości pushu. Hook `PreToolUse` nie zna trybu etapu bez pliku-znacznika, czyli też stanu. Do decyzji operatora, czy to ryzyko jest warte blokady. |

Nie zmieniano: `git pull --ff-only` w pierwszym agencie etapu `claude-md` (odczyt), brak walidacji `ciGlownej` w trybie bez pusha.

**W36.** Problemem W36 była treść STOP-u, więc poprawka komunikatu usuwa przyczynę; niestabilność to W37. Dopłata z tej sesji:
`expo-flow.mjs` oddaje `limitSek` przy statusie `zawieszony`, gdy zatrzymał go limit skryptu (SIGKILL z zewnątrz zostaje bez pola).

## 2. W37 — canary

Źródło: `~/.maestro/tests/2026-11-12_*` (6 przebiegów, 22:39–23:06). Logi przebiegów ubitych limitem (starty 1 i 2 autopilota)
nie zachowały się.

- **Sterownik XCTest nie zniknął w trakcie flow — nie wstał.** Przebieg 22:39:26 (kod 1 po 32 s): pierwsza kontrola sterownika
  `[Done]` (żył sterownik z wcześniejszego przebiegu), Maestro ubił procesy runnera, odinstalował i uruchomił `xcodebuild
  test-without-building`; port 7001 odmawiał połączenia przez 28 s, do końca. W pozostałych pięciu przebiegach pierwsza kontrola
  od razu `[Failed]` (starego sterownika nie było) i nowy wstawał w 4–17 s. Hipoteza: `SIGKILL` samego Maestro z limitu skryptu
  zostawia potomny `xcodebuild` ze sterownikiem, a następny przebieg płaci za jego sprzątanie. Niepotwierdzone.
- **Canary kopii czeka 45 s na element zależny od danych.** `extendedWaitUntil` na `home-preprompt` (`optional`, `timeout:
  45000`) skończył się `WARNED` w każdym z czterech przebiegów z pełną osią czasu; przebiegi trwały 100–115 s, z czego 45 s to
  to czekanie. Modal zależy od stanu bazy (aktywny cel), a canary biegnie przed db-sync.
- `kAXErrorInvalidUIElement` nie występuje w żadnym z zachowanych logów.
- Wpływu reloadu Metro (133 s i 154 s wobec ~34 s) sesja nie mierzyła; przyjęty z pomiarów sesji prowadzącej.
- Budżet: agent startu ma 600 s; próbny zrzut 40 s, start Metro 90 s (domyślnie), canary 240 s. Drugi pełny canary się nie mieści.

Poprawka (nakładka Expo, zrobiona w tej sesji):

1. `uruchomMaestro` przy limicie ubija Maestro razem z potomkami (`potomkowie` z `ps -axo pid=,ppid=`). Test z atrapą, która
   zostawia proces potomny, pada bez poprawki.
2. `poStarcie` nie wysyła reloadu Metro; `wyslijReload` usunięte. Canary własny i tymczasowy otwierają aplikację od nowa, więc
   świeży env wchodzi z nową paczką. Dokumentacja nakładki poprawiona w trzech miejscach.
3. Jedno ponowienie canary, gdy pierwszy przebieg skończył się kodem liczbowym z „Failed to connect to /127.0.0.1:<port>”,
   w reszcie tego samego limitu 240 s i tylko gdy zostało co najmniej 60 s. Porażka flow i przebieg ubity limitem bez ponowienia.
4. Wzór `_canary.yaml`: uwaga o czekaniach `optional` na elementy zależne od danych.

Opcja (b), wyższy limit, odrzucona: nie usuwa żadnej z przyczyn. Niesprawdzone: czy `xcodebuild` jest potomkiem procesu Maestro
w drzewie (założenie poprawki 1), cała poprawka na symulatorze.

## 3. Lista „Niesprawdzone”

Brakujące pozycje:

- Android: w `2026-11-pilot-nawykometr-wnioski.md` nie ma ani jednej wzmianki; cały pilot szedł na symulatorze iOS.
- Automat publikacji w gałęzi `workflow_run`: sprawdzony tylko `workflow_dispatch`.
- Nowe elementy rdzenia na mobile: `/dev-smoke` na symulatorze, przegląd spójności planu i jego bramka w autopilocie,
  `sync-template` kopii z rdzenia `b0dd78b`.
- Poprawki tej sesji (W37, pomiar pushu) na żywym runie.
- Metro bez pliku PID po STOP-ie bootstrapu.
- Projekt bez GitHuba w `origin`.

Włączenie automatu (IU-3.3): pozycje z botem, CI i PR wieloczęściowym nie blokują (kod rdzenia, wspólny z web). Blokują:
W37 do potwierdzenia na żywo (2 z 3 startów runu 4 zatrzymane na bramce), 55 commitów rdzenia nieuruchomionych na mobile,
W35 i W36 niesprawdzone na żywo. Rekomendacja: automat po czystym runie 5.

## 4. Przeniesienie zmian rdzenia na mobile

Sprawdzone (`git diff 30d4ed2 b0dd78b`):

- 72 pliki `.claude/` zmienione, 11 z nich nakładka podmienia; wszystkie 11 mają zmianę w nakładce w tym samym zakresie.
- Nowe pliki rdzenia: `spojnosc-planu.md`, `plan/spojnosc.mjs`, `smoke/otwarte.mjs`, `dev-smoke/SKILL.md` (slot `references/stack.md`
  ma wersję Expo). `spojnosc.mjs` i `pr/po-archiwum.mjs` nie odwołują się do profilu stacku ani runnera.
- Poza plikami usuwanymi i podmienianymi rdzeń nie odwołuje się do narzędzia makiet. Słów web pilnuje `stacks/straznik.json`.
- Wariant na gałęzi po zmianach tej sesji: `pnpm -s test` 1959/1959, typecheck 0, lint 0, `testuj-wariant.mjs expo` 1471/1473
  (2 pominięte), także bez Maestro w `PATH`.

Kolejność:

1. Merge gałęzi do `main` szablonu z pushem (zgoda operatora).
2. Publikacja `workflow_dispatch` (zgoda operatora).
3. `/sync-template --dry-run` na kopii, potem sync; doctor.
4. Run 5 na kopii, zadanie z makietą i pozycją smoke'u: `/dev-plan` (bramka spójności), autopilot (canary bez reloadu),
   `/dev-smoke` na symulatorze, `/dev-pr --bez-bota --bez-push` (pomiar pushu).
5. Decyzja o automacie po runie 5. Android poza runem 5, chyba że operator zdecyduje inaczej.

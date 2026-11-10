# Pilot Etapu 4 — wnioski z kopii Nawykometru

Zbiór wniosków z pilota (plan `docs/plans/2026-11-01-001-feat-szablon-mobile-z-rdzenia-plan.md`, Etap 4, krok 1: kopia).
Poprawki wchodzą jedną gałęzią `popr/*` po runie autopilota na kopii, z bramkami i wierszem w planie.

Kopia: `../_pilot-mobile/Nawykometr-kopia` (lokalny klon, `pushurl` = `BRAK`, bez kluczy do zdalnych baz, lokalny Supabase
w Dockerze z `project_id` = `nawykometr-kopia`).

## Wnioski

| # | Wniosek | Poprawka | Priorytet | Stan |
|---|---|---|---|---|
| W1 | Globalny `SUPABASE_ACCESS_TOKEN` w środowisku shella (plus login CLI w pęku kluczy) daje każdej sesji i agentowi dostęp do całego konta Supabase, także w projekcie bez plików `.env`. Szablon o tym nie mówi. | Doctor: ostrzeżenie (bez blokady), gdy widzi zmienną w środowisku; jedno zdanie w README środowiska E2E. | średni | otwarty |
| W2 | Konwersja `learned-patterns` odrzuca reguły odziedziczone ze starego szablonu (źródło spoza `docs/solutions/`, w Nawykometrze nr 2 i 3 z `etap-12b`) i nie mówi, co z nimi zrobić. Odwołania w kodzie projektu do starego pliku (19 w Nawykometrze) wypisuje, ale README milczy. Dotyczy tylko projektów przechodzących ze starego szablonu. | Dwa zdania w README repo mobile, sekcja „Przejście ze starego szablonu”: odrzuty odziedziczone są w skillach nowego wariantu (tu `mobile-e2e-maestro`), odwołania w kodzie mogą zostać jako historia. Bez nowych mechanizmów. | niski | poprawione (`popr/pilot-nawykometr-wnioski`) |
| W3 | README przejścia twierdzi, że sync skasuje edytowany `learned-patterns.md`. Skrypt syncu `6fbd49d` wyklucza ten plik (`EXCLUDE_PATHS`), więc dla tej wersji to nieprawda; konwersja jest potrzebna, bo nowy wariant tego pliku nie czyta. | Przeredagować zdanie w tej samej sekcji README. | niski | poprawione (`popr/pilot-nawykometr-wnioski`) |
| W5 | Pierwszy sync starym skryptem (`6fbd49d`) pada w połowie: skrypt podmienia sam siebie w trakcie biegu (`line 195: syntax error`). Pliki nowe i zmienione są już na miejscu, usunięcia, marker wersji i manifest nie. Nowy skrypt ma na to blok `{ …; exit; }`, ale stare projekty uruchamiają stary. Drugi przebieg (już nowym skryptem, adres z `profil.json`) dokończył sync: 95 usunięć, `.template-version` = `fb79426`. Dotyczy każdego projektu na starym szablonie mobile (prawdziwy Nawykometr, gramywpadla). | README repo mobile, sekcja „Przejście ze starego szablonu”: pierwszy sync może skończyć się błędem składni, uruchom go drugi raz (dokończy nowy skrypt). | wysoki | poprawione (`popr/pilot-nawykometr-wnioski`) |
| W6 | Doctor po syncu: bramki domknięcia „nie dotyczy”, bo projekt ma własny `eslint.config.js` (eslint 9.25, `eslint-config-expo`). Bramki szablonu wymagają eslint 10.11 i typescript 6.0.3 (`.claude/templates/bramki/package.json`), czyli aktualizacji stacku. Stary projekt dostaje więc wariant bez bramki ESLint, a doctor mówi „nie dotyczy” zamiast „UWAGA”. | Do decyzji po pilocie: doctor jako UWAGA z instrukcją, gdy projekt ma własny ESLint; zdanie w README przejścia. | średni | częściowo: zdanie w README przejścia; UWAGA w doctorze — do decyzji |
| W7 | Po syncu zostaje stary skill projektu `.claude/skills/sync-claude-template` (spoza manifestu szablonu, własny przepis syncu z ochroną `learned-patterns`). Doctor wypisuje go jako własny skill projektu; może mylić operatora i agentów obok `/sync-template`. | README przejścia: stary skill syncu usuń ręcznie. | niski | poprawione (`popr/pilot-nawykometr-wnioski`) |
| W8 | W środowisku shella jest też `EXPO_TOKEN` (konto Expo/EAS). Kopia: pusty `EXPO_TOKEN` w `.claude/settings.local.json`, build bez niego. | Dopisać do W1 (ostrzeżenie doctora obejmuje też `EXPO_TOKEN`). | średni | otwarty |
| W9 | Komenda przebudowy iOS z szablonu (`REBUILD.ios` w `.claude/scripts/e2e/expo-urzadzenie.mjs`, to samo w `.claude/stack/po-fazie.md` i w README e2e-env, pkt 5 „na symulatorze bez konta Apple”) to `expo run:ios --no-bundler`. Aplikacja z entitlements wymagającymi podpisu (Nawykometr: `com.apple.developer.applesignin`, `aps-environment`) na Macu bez certyfikatu i bez `DEVELOPMENT_TEAM` pada także dla symulatora: Expo (`simulatorBuildRequiresCodeSigning`) żąda podpisu i kończy `No code signing certificates are available to use`, z mylącym komunikatem o „physical iOS devices”. Projekt ma własne obejście w `docs/operator/e2e-env-setup.md` §8: `xcodebuild … -sdk iphonesimulator CODE_SIGN_IDENTITY="-"` i `xcrun simctl install`. Przebudowa w STOP-ie bramki natywnej da operatorowi komendę, która nie zadziała. | Komenda przebudowy iOS: wariant ad-hoc (`xcodebuild` z `CODE_SIGN_IDENTITY="-"` + `simctl install`) albo wykrycie entitlements i podanie go w STOP-ie; zdanie w README e2e-env (podpis ad-hoc zachowuje entitlements, w zgodzie z „nie buduj z `CODE_SIGNING_ALLOWED=NO`”). | wysoki | poprawione (`popr/pilot-nawykometr-wnioski`) |
| W10 | Supabase nie wystawia już nowych tabel w `public` rolom Data API bez jawnych `GRANT` (komentarz `auto_expose_new_tables` w `config.toml` CLI 2.106: nowa domyślna reguła chmury, stary przełącznik usunięty 2026-10-30). Lokalna baza kopii z 6 migracji Nawykometru: `anon`/`authenticated` mają tylko `REFERENCES, TRIGGER, TRUNCATE`, aplikacja dostaje 403 na każdej tabeli, canary pada na „Nie udało się wczytać Twojego profilu”. Skille szablonu (`supabase-dev-guidelines` web i Expo, security) nie wymagają jawnych `GRANT` w migracji, a review tego nie łapie. | Reguła w skillach Supabase (rdzeń i nakładka): nowa tabela w `public` ma w tej samej migracji `GRANT` dla ról, które jej używają; punkt w procedurze security; w README e2e-env zdanie o bazie od zera. Zmiana rdzenia — nazwać w commicie. | wysoki | poprawione (`popr/pilot-nawykometr-wnioski`) |
| W11 | `/dev-plan`: skill każe pisać `[Manual agent]`, a `plan.mjs sprawdz` odrzuca ten znacznik (sesja planu zamieniła go na `[Manual]`). | Ujednolicić skill i walidator. | średni | otwarty, z raportu sesji planu |
| W12 | `/dev-plan`: zwykły `grep` po `.maestro/run-all.sh` w polu Weryfikacja daje błąd „uruchamia runner E2E” — detektor patrzy na ścieżkę, nie na komendę. | Detektor po komendzie uruchamiającej, nie po wystąpieniu ścieżki. | niski | otwarty, z raportu sesji planu |
| W13 | Próg 360 linii (reguły kodu) bez wyjątku dla plików już za dużych. Projekt ma testy po 400–900 linii, a jego ESLint nie ma `max-lines`; plan dodał 4 wydzielenia i częściowo przez to omija `sync-cycle`. | Do decyzji: próg tylko dla nowych plików albo przyrostu w istniejących (stary projekt). | średni | otwarty, z raportu sesji planu |
| W14 | Sloty stackowe wariantu opisują Uniwind, SDK 58, Jest 30 i `src/app`; projekt ma NativeWind 5, Expo 55, jest 29 i `app/`. Buildery dostaną skill `uniwind` i reguły Uniwind — ryzyko złych klas. | Wariant dla projektu ze starszym stackiem: wykrycie stylowania (NativeWind vs Uniwind) w profilu albo sekcja „projekt na NativeWind” w slotach; do obserwacji w runie. | wysoki | poprawione (`popr/pilot-nawykometr-wnioski`) |
| W15 | Bramka gotowości: kontrola advisors nie przewiduje lokalnego Supabase (brak refu projektu) — uwaga pojawia się zawsze. | Rozpoznać bazę lokalną (`127.0.0.1`) i pisać „nie dotyczy”. | niski | otwarty, z raportu sesji planu |
| W16 | Run 1 (`zgoda-analityka`): bootstrap uznał środowisko E2E za gotowe (`e2e.mjs start`: canary PASS), choć baza e2e nie ma `public.e2e_env_marker`, którego wymagają wszystkie seedy (wymóg z README e2e-env szablonu, „Pozytywna identyfikacja bazy”). Nie sprawdza też zgodności `E2E_TEST_EMAIL` ze stałą seedów (`pg_temp.e2e_email()` w `.maestro/_seed-constants.sql`). Przyczyna po stronie przygotowania kopii (moje pominięcie §4b i pkt 8 checklisty projektu), ale bramka powinna to złapać. | `e2e.mjs sprawdz/start`: gdy seedy zawierają guard markera, sprawdzić `to_regclass('public.e2e_env_marker')` na bazie e2e → STOP z komendą; opcjonalnie próbny seed w transakcji z `rollback`. | wysoki | poprawione (`popr/pilot-nawykometr-wnioski`) |
| W17 | Run 1: niegotowe środowisko (seed pada, EXIT=3) dało ciche przejście obu `[E2E]` na `[Manual]` z powodem „środowisko”, run doszedł do compoundu i archiwizacji. README e2e-env obiecuje STOP na starcie przy niesprawnym środowisku, a `[Manual]` tylko dla awarii w trakcie runu. | Awaria seeda na pierwszym przebiegu (środowisko, nie scenariusz) → STOP bramki E2E, nie `[Manual]`; albo przynajmniej blokada archiwizacji przy 0 PASS. | wysoki | poprawione (`popr/pilot-nawykometr-run2`): seed, który nie wszedł, to bloker `stop-srodowisko` — STOP przed zamknięciem review, linie `[E2E]` bez zmian; niesprawdzone na żywym runie |
| W18 | Run 1: nagłówki raportów review mówią „Gate: ZASTRZEZENIA”, a JSON workflowu podaje dla każdej fazy `gate: "CZYSTE"`. | Jedno źródło werdyktu bramki. | średni | otwarty |
| W19 | Run 1: smoke operatora (`docs/operator/2026-11-09-zgoda-analityka-smoke.md`, linia 17) dziedziczy po poprzednim smoke'u prefiksy URL zdalnych projektów dev i e2e prawdziwego Nawykometru, bez sprawdzenia `.env*` bieżącego środowiska. | Smoke bierze adres bazy z bieżącego `.env.e2e` (sam host/prefiks), nie z poprzedniego smoke'u. | średni | otwarty |
| W20 | Run 1: koszt ok. 3,9 M tokenów subagentów, ok. 101 min, 8 z 71 agentów zwróciło pusty wynik (wg raportu sesji kopii, niesprawdzone w telemetrii). | Do przejrzenia w telemetrii runu: które role zwróciły pusty wynik i czy workflow to wykrył. | średni | otwarty |
| W4 | Plan (wiersze 515, 541–542) i `docs/reviews/2026-11-audyt-mobile/00-decyzje.md` (wiersze 9, 71) mówią o „nightly `react-native-css`”. `react-native-css` 3.0.7 to stabilny `latest` (2026-04-09). Para z `nativewind` 5.0.0-preview.2 ma znane błędy (react-native-css#293, #317/#403, nativewind#1837), ale Nawykometr ma override `lightningcss` 1.30.1 i nie używa `bg-*/NN` ani `tint-*`. | Poprawić zdania w planie i w `00-decyzje.md`. | niski | poprawione (`popr/pilot-nawykometr-wnioski`) |
| W21 | Run 2: `plan.mjs gotowosc` dał `ok: true`, a start autopilota stanął na `start: CLAUDE.md nieuzgodniony po merge'u` (plik decyzji runu 1 na `main` z `claude_md: do-uzgodnienia`). Naprawa ze STOP-u (`/dev-pr --claude-md <zadanie> --bez-push`) działa bez GitHuba, ale nie mówi, że gałąź zadania założona przed uzgodnieniem nie ma nowego CLAUDE.md. | `gotowosc` sprawdza to samo co bootstrap (`git grep '^claude_md:' <główna> -- docs/decisions/`); zdanie w naprawie o wciągnięciu głównej do gałęzi zadania. | średni | otwarty |
| W22 | Run 2: bramka `stack` (expo-doctor) padła po execute fazy na 18 paczkach SDK ze starszym patchem, zastanych przed fazą (faza dodała tylko `expo-haptics`). Bramka nie odróżnia rozjazdu zastanego od wprowadzonego, a doctor szablonu i `gotowosc` go nie zapowiadają: STOP po ok. 12 min i ok. 332 tys. tokenów. Lista oczekiwanych wersji przychodzi z sieci, więc ten sam projekt przechodzi jednego dnia, a pada następnego. | Bramka pada tylko na paczkach dodanych albo zmienionych w fazie, zastane idą jako uwaga; doctor szablonu: UWAGA z `npx expo install --check` przed startem. | wysoki | poprawione (`popr/pilot-nawykometr-run2`): paczki fazy z diffu `package.json`, zastane jako `ostrzezenia` i `zastane`; uwaga przed startem w bramce gotowości `/dev-plan` (`uwagiPlanowania`), nie w doctorze |
| W23 | Run 2: STOP bramki natywnej w bootstrapie nie zawiera komendy przebudowy. `e2e.mjs start` zwraca kod 1 i pełne pole `naprawa` (zwykła przebudowa i wariant ad-hoc z W9), ale agent przepisujący wynik podmienił je na tekst zapasowy „Uruchom recznie: … e2e.mjs sprawdz” (przewidziany dla kodu 3). `sprawdz` nie ma bramki natywnej i przy starym dev-cliencie pokazuje „gotowe”. | Wynik skryptu nie może zależeć od przepisania przez agenta: skrypt zapisuje JSON do pliku, a STOP czyta `naprawa` stamtąd; naprawa zapasowa wskazuje `start`, nie `sprawdz`. | wysoki | poprawione (`popr/pilot-nawykometr-run2`): agent zwraca ostatnią linię stdout w polu `stdout`, pola skryptu wygrywają w JS (`startZeSkryptu`), naprawa zapasowa wskazuje `start`; zapis wyniku do pliku odrzucony, bo JS workflowu nie czyta plików |
| W24 | Run 2: bramka natywna zgłasza jako natywne `jest-expo (ios)`, `@expo/cli` i `@expo/router-server` („brak node_modules/…, potraktowany jak natywny” — paczki zagnieżdżone pod `node_modules/expo/`). | Rozwiązywać ścieżkę paczki z lockfile'a (klucz `node_modules/…/node_modules/…`), paczki testowe poza listą. | niski | otwarty |
| W25 | Run 2: execute zakończony jako `partial` (porażka bramki `stack`) nie zapisał bazy fazy (`.autopilot-state.json`: `execute: pending`, `baza: null`, choć commit fazy istnieje). W kolejnym runie planner zwrócił `poza: true`, a review wziął bazę zapasową (merge-base z gałęzią główną, w kopii `origin/main` sprzed syncu i runu 1): dossier „585 plików, +60009 −27511”, `diffUciety: true`, przy fazie 8 plików (+290 −5). Gate CZYSTE wydany na złym diffie. | Execute zapisuje bazę fazy także przy `partial`; review bez bazy fazy → STOP zamiast bazy zapasowej, albo baza z pierwszego commita fazy (`feat(<zadanie>): …`). | wysoki | poprawione (`popr/pilot-nawykometr-run2`): baza zostaje w stanie przy execute bez `completed`, idzie do execute-wf przy wznowieniu i nie ginie przy plannerze bez pracy; baza zapasowa dossier to najbliższy merge-base (lokalna główna przed zdalną); niesprawdzone na żywym runie |
| W26 | Run 2: po STOP-ie bramki `stack` zostało działające środowisko E2E (Metro na 8081, `.env.development.local`). `expo install --fix` przy działającym Metro padł w połowie i zostawił `node_modules` w stanie częściowym (przyczyna niepotwierdzona: błąd wycofania w npm 10.9.8 zasłonił komunikat). | Do sprawdzenia: czy STOP po execute ma sprzątać środowisko (`e2e.mjs stop`); co najmniej zdanie w naprawie STOP-u. | średni | otwarty, przyczyna padnięcia npm niesprawdzona |
| W27 | `/dev-plan`: uwaga „IU ma ≥ 8 scenariuszy” liczy też `[E2E]` i `[Manual]`, których builder nie wykonuje (IU-2: 11 pozycji, w tym 6 `[Unit]`). | Próg liczy `[Unit]`. | niski | otwarty |
| W28 | Routing builderów po ścieżce: adapter haptyki w `lib/` trafia do `feature-builder-data` ze skillami `supabase-dev-guidelines`, `security`, `sentry-integration`. | Do decyzji: w wariancie Expo `lib/` to nie zawsze warstwa danych (adapter SDK urządzenia). | niski | otwarty |
| W29 | Run 2: compound zapisał wpis wiedzy z nienaprawionego P3 (martwa asercja `unhandledRejections` zostaje w kodzie, a `docs/solutions/` opisuje ją jako rozwiązany problem). | Compound nie zapisuje wpisu z findingu, który trafił do `known-issues.md` bez naprawy, albo oznacza go jako otwarty. | niski | otwarty |
| W30 | Commit etapu `claude-md` ma stopkę `Co-Authored-By` z modelem agenta workflowu, nie sesji. | Do decyzji: stopka w commitach agentów mechanicznych. | niski | otwarty |
| W31 | `/dev-plan` szuka dokumentu źródłowego w `docs/brainstorms/`, projekt ma `docs/dev-brainstorms/` (glob zapasowy `docs/*brainstorm*` go znajduje; do potwierdzenia). Wpisy `docs/solutions/` projektu odsyłają do nieistniejącego `.claude/rules/learned-patterns.md` (pokrewne W2). | Zdanie w README przejścia. | niski | otwarty |

## Ustalenia dla projektu Nawykometr (nie dla szablonu)

- **Brak jawnych `GRANT` w migracjach.** Istniejące projekty w chmurze mają stare domyślne uprawnienia, więc dziś działa. Nowy projekt
  Supabase (np. nowa baza e2e albo odtworzenie od zera) dostanie 403 na wszystkich tabelach. Kopia: dawne uprawnienia odtworzone
  bezpośrednio w lokalnej bazie (`grant all on all tables/sequences` + `alter default privileges` dla `anon`, `authenticated`,
  `service_role`), repo bez zmian. Do decyzji operatora: migracja z jawnymi `GRANT` w prawdziwym projekcie.
- Łańcuch 6 migracji wchodzi na pustą bazę bez błędów (`supabase start` w kopii).

## Przebieg przygotowania kopii (2026-11-09)

- Sync: `6fbd49d` → `fb79426` (dwa przebiegi, W5), doctor OK z 5 uwagami, plugin `expo@claude-code-starter` 1.14.3 (`a9e5bd3`).
- Bramki bazowe kopii: typecheck 0, jest 81/81 suit i 1095/1095 testów, lint 0 błędów i 2 ostrzeżenia.
- Dev-client: `expo run:ios` pada (W9); build `xcodebuild … CODE_SIGN_IDENTITY="-"` na symulatorze „Nawykometr-kopia” (iOS 26.4),
  podpis ad-hoc z symulowanymi entitlements, `simctl install`.
- `e2e.mjs sprawdz`: gotowe. `e2e.mjs start`: pierwszy przebieg canary FAIL (W10), po odtworzeniu uprawnień: Metro i canary PASS.
- react-native-css#293: nie występuje — Metro zbudowało paczkę, aplikacja renderuje style i fonty.
- Atrapa `SUPABASE_ACCESS_TOKEN`: CLI z atrapą w środowisku kończy `Invalid access token` (atrapa wygrywa z loginem w pęku kluczy).

## E2E po runie 1 (ręcznie, poza autopilotem)

- Środowisko naprawione tylko lokalnie: marker `public.e2e_env_marker` w bazie kopii, `E2E_TEST_EMAIL` i
  `EXPO_PUBLIC_E2E_TEST_USER_EMAIL` w `.env.e2e` zgodne ze stałą `pg_temp.e2e_email()`.
- `e2e.mjs start`: konto e2e założone przez admin API, canary PASS. `bash .maestro/run-all.sh` (z kluczami `.env.e2e`):
  **16/16 PASS**, w tym nowy `e8-zgoda-analityka` z runu 1 i 15 flow regresji E3–E6. `e2e.mjs stop` sprzątnął serwer
  i `.env.development.local`, drzewo kopii czyste.
- Niesprawdzone tą drogą: tester E2E autopilota (`feature-tester-e2e`), księgowanie `e2e.mjs ksieguj`, bramka natywna — do runu 2.

## Run 2 — `haptyka-check-in` (2026-11-09/10)

- Przed runem: `feature/zgoda-analityka` zmergowany lokalnie do `main` kopii (`--no-ff`), sync `fb79426` → `40c35a3`
  (1 nowy, 11 zmienionych, 0 usuniętych; commit `b43e2ad`), doctor OK z 4 uwagami, `e2e.mjs sprawdz`: gotowe (kontrola markera
  bez błędu; przypadek bazy bez markera niesprawdzony na żywo).
- Sesja w kopii dostaje atrapę: `supabase projects list` → `Invalid access token`, `EXPO_TOKEN` pusty.
- `/dev-plan`: plan Lekki, 1 faza, 2 IU, `sprawdz` `ok: true` z 1 uwagą (W27), `gotowosc` zielona. W11, W12 i W15 nie wystąpiły
  (brak `[Manual agent]`, brak ścieżek runnera w Weryfikacji, zadanie bez migracji). W13 potwierdzony: Home ma 407 linii, więc
  haptyka poszła do modułu okna zamiast do ekranu.
- Cztery starty autopilota: STOP CLAUDE.md (W21) → STOP bramki `stack` po execute (W22; operator: `npx expo install --fix`,
  commit `edfd5f9`) → STOP bramki natywnej (W23, W24) → run do końca.
- Przebudowa komendą ad-hoc z pola `naprawa` skryptu (W9): `expo prebuild --clean` 25 s, `xcodebuild … CODE_SIGN_IDENTITY=-`
  256 s, `simctl install` 7 s; `expo-haptics` w `Nawykometr.debug.dylib`, `e2e.mjs start`: bramka natywna i canary PASS.
- Wynik runu: faza 1 gate CZYSTE (nagłówek raportu i JSON zgodne — W18 nie wystąpił), P3 2; oba `[E2E]` (`e3-checkin`,
  `e6-undo`) PASS przez `feature-tester-e2e`, zaksięgowane przez `e2e.mjs ksieguj` (odznaczone 2, manual 0, skip 0); Jest
  1194/1194, typecheck, lint, `expo export` PASS; archiwum `ddb4693`. Review czytał zły diff (W25), więc gate CZYSTE nie jest
  dowodem jakości fazy.
- W19 potwierdzony ponownie: smoke runu 2 cytuje prefiksy URL zdalnych projektów z poprzedniego smoke'u, wymaga `.env` projektu
  dev i każe budować dev-clienta przez EAS.
- W20 wyjaśniony: „puste wyniki” to reviewerzy z `{"findings":[]}` i dedup z `{"duplikaty":[]}` (5 z 24 agentów), nie awarie.
- Koszt czterech startów wg raportów sesji kopii: ok. 29 tys. + 332 tys. + 55 tys. + 964 tys. tokenów.
- Niesprawdzone w runie 2: D4 (żaden `[E2E]` nie przeszedł na `[Manual]`), W17 (seed nie padł), W14 w builderze UI (zadanie
  bez warstwy UI), bramka migracji na zadaniu z migracją, haptyka na fizycznym urządzeniu.

## Niesprawdzone

- Zgodność schematu lokalnego (z migracji repo) ze zdalną bazą — decyzja operatora: bez połączenia ze zdalną bazą.
- (zamknięte w runie 2) Czy sesja Claude Code w katalogu kopii faktycznie dostaje atrapę z `.claude/settings.local.json` — tak.

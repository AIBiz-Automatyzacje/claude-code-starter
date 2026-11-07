# Odbiór Etapu 2 — nakładka Expo

Data: 2026-11-07. Szablon: `cc4e4ce`, CI „maszyneria” zielone (run `42362958177`). Plan: `docs/plans/2026-11-01-001-feat-szablon-mobile-z-rdzenia-plan.md`.

**Status: Etap 2 przyjęty przez operatora 2026-11-07, z zastrzeżeniami.** Kryterium z planu spełnione, run autopilota na kopii przeszedł bez punktu bramek.

Zastrzeżenia i ich stan:
- Punkt bramek ESLint i migracji w wariancie Expo przechodzi do pilota w Etapie 4. Otwarte.
- D3 naprawiane przed Etapem 3: zrobione, merge `ea23fce`, próba na iPhone 17. Android nie biegł, a `ps -E` nadal pokazuje wartości temu samemu użytkownikowi.
- Przebieg autopilota web na kopii: zrobiony po przyjęciu, regresji nie znaleziono, merge poprawek README `d1ce766`.
- `paths:` w skillach web: usunięte po przebiegu web, merge `3b5eede`. Ta zmiana nie miała prawdziwego runu autopilota web.

## Wynik

| Kryterium | Wynik | Dowód |
|---|---|---|
| `node stacks/zbuduj.mjs expo <katalog>` daje `.claude/` | PASS | 410 plików, 85 usuniętych, `.rdzen-version` = `cc4e4ce16f08…` bez `-dirty` |
| Testy rdzenia na wariancie | PASS | `node stacks/testuj-wariant.mjs expo`: 1268/1270, 2 pominięte, 0 padnięć, typecheck 0 |
| Testy nakładki | PASS | `pnpm -s test` w worktree: 1711/1711; typecheck 0, lint 0 |
| Obie listy zaległych puste | PASS | `ZALEGLE = []`, `ZALEGLE_ODESLANIA = []`; w `stacks/straznik.json` brak wpisów `przejsciowy` |
| CI | PASS | `pnpm typecheck && pnpm test && pnpm lint` na `cc4e4ce`, 1m59s |
| Pełny run autopilota na kopii (warunek operatora) | PASS w 3 z 4 punktów „Oczekiwanego wyniku”, punkt 3 NIESPRAWDZONE | `wf_6272905b-2d8` STOP zgodnie z oczekiwaniem, `wf_e05c211e-938` status OK; sekcja niżej |

Uwagi do liczb:
- Testy wariantu biegną na ławce, a nie w katalogu z CLI. Porównanie sum SHA-256 `.claude/` obu katalogów: 410 plików, zero różnic.
- Dwa pominięte testy to warunki stacku web: port deweloperski w `E2E_URL` i plik `.env.e2e.local`.
- `pnpm -s test` w głównym katalogu po merge'u: 1992/1992. Różnica względem 1711 to znany glob, który łapie testy z `.claude/worktrees`.
- CI nie uruchamia testów rdzenia na wariancie: job `wariant-expo` to IU-3.2. Ten wynik pochodzi tylko z lokalnego biegu, a testy z `stacks/expo/__tests__/` CI uruchamia.
- Na urządzeniu `cc4e4ce` biegł tylko w runie autopilota, na iPhone 17. Na Androidzie nie był uruchamiany; tam najnowsza próba to IU-2.6.

## Run autopilota na kopii

Kopia klonu `spike-expo-58`, `.rdzen-version` = `cc4e4ce`, iPhone 17 (iOS 26.4), Maestro 2.5.1. Sesja [Pełny run autopilota Expo na kopii spike'a], gałąź `popr/smoke-expo-po-biegu`.

| Run | Wynik | Czas | Koszt |
|---|---|---|---|
| `wf_6272905b-2d8`, przebieg (1) | Oczekiwany STOP: `start: srodowisko E2E — zadanie ma 2 scenariuszy [E2E], a repo nie ma .env.e2e` | 1 min | 0,51 USD |
| `wf_e05c211e-938`, przebieg (2) | Status OK, 2 fazy, 40 agentów | 31 min | 11,71 USD |
| `wf_e9599c7b-68c`, przerwany | Zabity przez limit zadań w tle `claude -p`, wyniku nie liczę | 10 min | 3,40 USD |
| `/weryfikacja-setup` | Przejście na żywo, commit `76affd6` | 13 min | 1,02 USD |

| Punkt „Oczekiwanego wyniku” | Wynik | Dowód |
|---|---|---|
| 1. Status OK, 2 fazy, gate, archiwum, mapa funkcji | PASS | `status: OK`, `fazyUkonczone: 2`, archiwum `62e14da`, `mapa-funkcji.md` ma oba flow |
| 2. P2 na teście happy path, fix | PASS | `review-faza-1.md`: P2 na `src/lib/smoke-autopilot.test.ts:13`; fix `81e944e`, kontrola fixa `c629e06` |
| 3. Bramki `eslint` i `migracje` z porażką i naprawą | NIESPRAWDZONE | Spike nie ma ESLint ani migracji. Wg notatki sesji: `eslint: brak`, `migracje: pominieta`, `stack: pominieta` (pole z wyniku agenta, poza plikiem runu, nie sprawdzałem osobno) |
| 4. Smoke operatora | PASS | `docs/operator/2026-11-07-smoke-autopilot-smoke.md`, sekcja „E2E do odegrania ręcznie” z flow i powodem, plik w `62e14da` |

Scenariusze: `smoke-strona` PASS na symulatorze (zrzut: nagłówek i „dodajBezpiecznie(2, 3) = 5”, dymek LogBox `fetch failed` wg sesji pochodzi z sondy spike'a). `smoke-strona-faza-2` SKIP `srodowisko` i `[Manual]` z powodem, bo Metro zatrzymano o 12:29:37 (`watcher-stop.log`); `curl` kod 7 w `review-faza-2.md`.

Defekty z runu:
- **D1, naprawione, merge `1f165d9` (Expo) i `d1ce766` (web):** README fixture'u kazał wykonać `stop` po domknięciu fazy 1, ale `e2e:restart:faza-2` stawia Metro od nowa, więc flow przeszedłby zamiast iść na `[Manual]`.
- **D2, naprawione, merge `1f165d9`:** tabele planu fixture'u podawały 18 i 15 linii flow, a treść ma 16 i 13.
- **D3, naprawione, merge `ea23fce`:** `zmienneFlow` w `stacks/expo/nakladka/.claude/scripts/e2e/expo-canary.mjs` podawało `E2E_EMAIL` i `E2E_PASSWORD` jako `-e KLUCZ=wartość`, więc były jawne w wierszu komendy procesu. Tester wywołał `pgrep -fl` i wartości trafiły do jego transkryptu (w spike'u atrapy, finding OPERATOR w review fazy 1). Do logu i folderu dowodów nie trafiły. Teraz konto i klucze idą w środowisku procesu Maestro jako `MAESTRO_E2E_EMAIL`, `MAESTRO_E2E_PASSWORD` i `MAESTRO_*`. Próba na iPhone 17: canary i flow przeszły, 198 próbek `ps` i `pgrep -fl` bez wartości, `~/.maestro/tests` i dowody bez nich. Zostaje `ps -E`, które tym samym użytkownikiem pokazuje środowisko Maestro i Metro. Android nie biegł.
- **D4, otwarte, rdzeń:** `.claude/scripts/e2e/ksiegowanie.mjs:18` ucina powód `[Manual]` po 160 znakach w połowie zdania, a smoke odsyła po pełny dowód do `docs/active/`, którego po archiwizacji już nie ma.
- **Do sprawdzenia, moja obserwacja:** plan fixture'u wymaga pustego `catch` w `parsujLiczbe`, a w historii kopii tego pliku nie ma żadnego commita z `catch`. Sesja podaje, że usunął go audyt domknięcia. Jeśli tak jest, punkt 3 w części ESLint może nie wyjść także w projekcie Expo z ESLint. W przebiegu web `catch` wszedł do commita i ESLint go zgłosił, ale projekt miał tam ESLint, więc pytanie o Expo zostaje otwarte do pilota.

Drobne, bez wpływu na wynik: etykieta `warmup:vitest` przy runnerze Jest (`.claude/workflows/dev-autopilot-wf.js:1762`), `profil_stacku: null` w telemetrii, `testyTypow` z powodem „brak vitest”.

Odstępstwa od README i zlecenia:
- Run biegł przez `claude -p --effort medium --dangerously-skip-permissions` w kopii, a nie w sesji desktop.
- Metro zatrzymano zaraz po `e2e:restart:faza-2`, nie po domknięciu fazy 1 (D1).
- Commit źródła w klonie przedatowany na 11-05, bo inaczej bramka świeżości słusznie zatrzymałaby start.
- `przygotuj-kopie.sh` skończył się kodem 8 na `runner testów`, bo Jest spike'a nie ma `testPathIgnorePatterns`; naprawa z doctora osobnym commitem w kopii (`492f2c1`).
- `pgrep -fl` sesji runu wypisał do jej transkryptu `CLAUDE_CODE_MESSAGING_TOKEN` zakończonej sesji potomnej. Wg sesji token nie był użyty.

## Run autopilota na kopii: web

Przebieg po przyjęciu Etapu 2, które na nim nie czekało. Kopia klonu `vibersi` (`5597449`), szablon `53a17e7`, lokalny Supabase w Dockerze z 37 migracjami kopii, konto testowe tylko w tej bazie. Gałąź `popr/smoke-web-po-biegu`.

| Run | Wynik | Czas | Koszt |
|---|---|---|---|
| `wf_57525432-d15`, przebieg (1) | Oczekiwany STOP: `start: srodowisko E2E — zadanie ma 2 scenariuszy [E2E], a repo nie ma .env.e2e` | 3 min | 0,55 USD |
| `wf_78488c6d-20c`, przebieg (2) | Status OK, 2 fazy, 39 agentów | 43 min | 11,56 USD |

| Punkt „Oczekiwanego wyniku” | Wynik | Dowód |
|---|---|---|
| Przebieg (1): STOP przed fazą 1 | PASS | Wynik `wf_57525432-d15`; fazy `pending` |
| Środowisko: `sprawdz` i konto | PASS | `status: gotowe`, `bazaE2e: true`; log startu: konto utworzone przez admin API |
| Przebieg (2): `smoke-strona` PASS, `smoke-strona-faza-2` na `[Manual]`, 0 STOP-ów | PASS | Zrzut `smoke-strona.png`; telemetria: faza 2 `manual: 1`, `run.manual_razem: 1`; serwer zatrzymany o 14:15:16 |
| 1. Status OK, 2 fazy, gate, archiwum, mapa funkcji | PASS | Gate CZYSTE w obu fazach, archiwum `540728a`, `mapa-funkcji.md` z oboma flow |
| 2. P2 na teście happy path, fix | PASS | `review-faza-1.md`: P2 `src/lib/smoke-autopilot.test.ts:7`; sceptycy `agree` 3/3; fix `7b8c970` daje `toBe(5)`; kontrola `aa19308` |
| 2a. Bramki | PASS | `eslint` `porazka` z `no-empty`, `migracje` i `migracjeSuma` `porazka`, po naprawie `ok`; `stryker` 2 trafienia; suma 17,8 s; telemetria `bramki.eslint.status = porazka`; diff `supabase/` względem bazy pusty |
| 3. Smoke operatora | PASS | `docs/operator/2026-11-07-smoke-autopilot-smoke.md` (5 pozycji), sekcja ręcznego E2E z powodem, plik w `540728a`, wartości sekretów: 0 trafień |
| 3. Wariant negatywny (drugi run) | NIESPRAWDZONE | Nie uruchamiałem, to kolejny pełny run |
| 4. Ogrodnik | PASS | `ogrod:pomiar` po `compound-refresh`, przed `smoke-operatora`; bez `ogrod:ocena`, log podaje powód; sekcja `## Ogród`; `run.ogrod.status = ok` |

Punkt 2a dotyczy webu: pusty `catch` z planu wszedł w `e81b111`, a ESLint go zgłosił. Nie zamyka to pytania z runu Expo, gdzie takiego commita nie ma, a projekt nie ma ESLint.

**Regresji względem webu nie znalazłem.** Porównanie z `wf_6ce4e483-5b6` (smoke P17, też vibersi, sprzed `746d862`): te same role poza `fix:poprawka` (dodatkowa tura kontroli fixa) i `review:performance` (routing), 39 zamiast 45 agentów, 3,18 M zamiast 4,49 M jednostek, 43 zamiast 41 min. P17 miał 4 buildy i 29 oraz 27 plików w review, więc koszt nie jest wprost porównywalny. Pominięcie 5 reviewerów w fazie 2 to nie zmiana: to samo robił `wf_1a28a396-1e1` sprzed Etapu 2.

Defekty z runu:
- **D1, naprawione na `popr/smoke-web-po-biegu`:** moment `stop` w `.claude/templates/smoke-autopilot/README.md`. W runie stop nastąpił po `e2e:restart:faza-2`.
- **D4, otwarte, potwierdzone w webie:** `.claude/scripts/e2e/ksiegowanie.mjs:18` uciął powód na `Preflight: curl -sS http://localhost:5184`. Smoke odsyła po dziennik do `docs/active/`, a po archiwizacji plik jest w `docs/completed/`.
- **D5, otwarte, niska waga, nie z Etapu 2:** `stan:zapis` (`.claude/workflows/dev-autopilot-wf.js:1693`, `klasa-mechaniczny`, haiku) odmówił nadpisania stanu, bo uznał przejście fazy na `fix: done` za utratę findingów, wbrew poleceniu. Retry z `:1698` zapisał plik. To samo zdarzyło się w `wf_1a28a396-1e1`.
- **D6, naprawione na `popr/smoke-web-po-biegu`:** punkt 2a README wymagał pola `mutanty`, którego nie ma w wyniku bramek, i nowego `migrations.sum`, które vibersi już ma.

Poza szablonem, w projekcie: 8 testów vibersi pada bez `.env` (`VITE_TURNSTILE_SITE_KEY`, `VITE_SUPABASE_*`), 2 kolejne padły raz pod obciążeniem przy starcie Dockera, a `src/components/layout/menu-telefonu.test.tsx:411` padł w 1 z 5 biegów fazy 2, przyczyny nie ustalono.

Odstępstwa:
- `claude -p --effort medium --dangerously-skip-permissions` za zgodą operatora, bez sesji desktop.
- `.env` kopii z atrapami, bo `przygotuj-kopie.sh` skończył się kodem 7 przez te testy. Bazowe bramki potem 3547/3547.
- `E2E_START` to samo Vite na porcie 5184, bo 5174 zajmuje obcy proces, a `pnpm e2e:start` wymaga adresu `*.supabase.co`. Serwer Hono nie działał.
- Bez `/weryfikacja-setup`: vibersi ma skill, w kopii poprawiony tylko Launch (`c271b0d`), bez przejścia na żywo.

Niesprawdzone: wgranie nowej migracji przez db-sync (fazy jej nie dodają, wynik `aktualna`), advisors (brak tokenu i brak zmian w migracjach), login canary z captchą, trasy serwera, sesja desktop, pozycje ze smoke'u operatora, test resume, źródło „2 agentów z pustym wynikiem” z raportu sesji runu (journal: 39 wyników na 39 startów).

Kontrola granic: polecenia agentów bez `Kodowanie/vibersi` i `.supabase.co`, transkrypty runów bez wartości klucza i hasła e2e, prawdziwe vibersi bez zmian (`5597449`, `main`, czyste).

## Co powstało

Pełne opisy: tabela „Stan Etapu 2” w planie.

| IU | Merge | Co powstało | Wariant po IU |
|---|---|---|---|
| 2.0 | `fddd086` | `stacks/zbuduj.mjs`, `stacks/testuj-wariant.mjs`, listy zaległych | 1402/1402 (bez nakładki) |
| 2.7 | `9e01e65` | `usun.txt`, plugin Expo i reguły `deny`, skille mobile, slot `dev-docs-complete` | 1254/1257, 3 padnięcia |
| 2.8 | `984276d` | `rules/stack.md` Expo, hook `mobile-anti-pattern-check.sh`, bramki na jest | 1247/1251, 4 padnięcia |
| 2.3 | `10ab4f8` | Adapter E2E, `expo-env`, `expo-urzadzenie`, `expo-canary`, `templates/e2e-env` | 1238/1253, 13 padnięć |
| 2.4 | `99f7437` | `expo-natywne.mjs`, slot `po-fazie.md`, STOP przed testerem przy zmianie natywnej | 1239/1254, 13 padnięć |
| 2.5 | `c20b2a2` | Sloty tekstowe, bramka `expo-doctor`, `expo-swiezosc.mjs`, `e2e.plikFlow` | 1241/1254, 11 padnięć |
| 2.2 | `869570e` | Tester `feature-tester-e2e` na Maestro, `expo-flow.mjs` | 1241/1254, 11 padnięć |
| 2.4a | `f7df3a4` | Przebudowa tylko przy stwierdzonym braku dev-clienta | 1241/1254, 11 padnięć |
| 2.1 | `f4798b4` | Buildery RN i warianty `-figma` z testem porównania z web | 1280/1284, 2 padnięcia |
| 2.6 | `349ab5c` | Slot `weryfikacja-setup`, `expo-trasy.mjs`, fixture `smoke-autopilot` RN | 1268/1270, 0 padnięć |
| 2.9 | `cc4e4ce` | Sloty `dev-prep` i `dev-compound`, kopie skilli wspólnych i agentów badawczych, `references/stack.md` | 1268/1270, 0 padnięć |

Zmiany w rdzeniu nazwane w tabeli planu: IU-2.7, 2.3, 2.4, 2.5, 2.6, a w IU-2.2 tylko test `tester-porcje`. IU-2.1, 2.4a i 2.9 nie zmieniły rdzenia.

## Próby na urządzeniach

Wszystkie na klonie albo kopii `spike-expo-58`, Maestro 2.5.1.

| IU, data | iOS (iPhone 17) | Android (Pixel_8) |
|---|---|---|
| 2.3, 11-05 | Odrzucenie iPhone 17 Pro z kontem Apple, włączenie iPhone 17, wykrycie starego dev-clienta, przebudowa, monit „Otwórz”, `.env.development.local` tworzony i usuwany, obce Metro zastąpione | `.env.development.local` działa w obie strony przy działającym Metro |
| 2.4, 11-05 | Zmiana natywna: STOP z komendą naprawy; `prebuild --clean` + `run:ios` z prawdziwą paczką | `prebuild --clean` + `run:android` przeszedł, bez próbnej paczki natywnej |
| 2.5, 11-05 | `expo-swiezosc.mjs`: stary dev-client daje `przebudowa: true`; bez emulatora „brak urządzenia” | Tylko `expo export` i `.hbc`, bez urządzenia |
| 2.2, 11-05 | Prawdziwa rola testera, 4 scenariusze: PASS, FAIL, SKIP, FAIL zgodnie z oczekiwaniem | `expo-flow.mjs --urzadzenie` na `emulator-5554`: flow przeszedł, zrzut w folderze zadania |
| 2.4a, 11-06 | Podmieniony `bundleIdentifier`: `brak dev-clienta`, `przebudowa: true` | Wyłączony: bez przebudowy; włączony z dev-clientem: `ok: true`; podmieniony pakiet: `przebudowa: true` |
| 2.1, 11-06 | `proba-licznik` PASS przed animacją i po niej, `proba-kubek` PASS, `proba-przypomnienie` FAIL (pułapka zapisana w skillu); z `centerElement: true` przeszedł przy wyłączonym LogBox | Nie uruchamiano |
| 2.6, 11-07 | Flow prawdziwego `feature-builder-ui` po `e2e.mjs start` przeszedł; komenda przejścia na żywo ze slotu przeszła | Ten sam flow przeszedł; canary spike'a w kopii padł na `scrollUntilVisible`, przyczyny nie badano |

IU-2.9 nie miało próby na urządzeniu: prawdziwy `feature-builder-data` jako subagent na kopii, `tsc --noEmit` kod 0, doctor `zapis hooków` OK. IU-2.7 i 2.8 miały próby narzędzi bez urządzenia (Stryker na jest-expo 4/4).

## Rozjazdy z planem

**IU-2.9**
1. Rdzeń i web są nietknięte, a skille wspólne i agenci badawczy to kopie Expo z testem porównania linii z web, zamiast neutralizacji rdzenia i slotu web. Przeniesienie reguł ze `SKILL.md` do pliku czytanego na żądanie zmieniłoby zachowanie builderów web. Koszt: większa nakładka, a zmiana web zatrzymuje test, dopóki ktoś jej nie przeniesie.
2. `dev-browser@dev-browser-marketplace` zostaje w wariancie, bo `doctor.test.mjs` rdzenia wymaga tego wiersza. Doctor daje `UWAGA`, bez blokady.
3. `@sentry/deno` 11 i `major_version` z A0.3 §4.4 dotyczą plików wspólnych z webem i nie weszły.

**IU-2.6**
1. Fixture RN nie ma nowej trasy, tylko linie na ekranie głównym: trasa spoza natywnych kart nie jest osiągalna linkiem. Koryguje to zapis z IU-2.2: wywracanie dev-clienta dotyczy linku z adresem Metro.
2. `__expo_disable_onboarding` jest poza canary: próba kontrolna nie pokazała arkusza dev-menu. Warunkowe zamknięcie zostaje, a kiedy arkusz wraca, nie ustalono.
3. `usun.txt` zabiera testy, `pakiet/` i `wstaw-pakiet.mjs` fixture'u web, a kontrakt jest w `stacks/expo/__tests__/smoke-fixture.test.mjs`.
4. Slot Jest dostał `testPathIgnorePatterns`, a wiersz `Linie dziś → po` liczy skrypt.

**IU-2.1**
1. `paths:` zdjęte z `rn-expo-guidelines` i `ux-ui-guidelines-mobile`: skill z `paths:` ładuje się ze `skills:` tylko po wcześniejszym dotknięciu pasującego pliku. Preload sprawdzaj na subagencie, nie przez `claude -p --agent`.
2. Polecenie roli przeszło na „przed napisaniem przeczytaj”, bo builder nie otworzył `plan-e2e.md`.
3. Preload bez `expo:expo-data-fetching` z A0.7 §2.4, a lista antywzorców wyglądu zastąpiona odesłaniem do `resources/ai-pitfalls.md`.

**IU-2.2 do 2.5, 2.8 i D19**
- IU-2.2: Maestro pisze do katalogu tymczasowego, a do repo idą tylko zrzuty, bo `commands-*.json` zapisuje wartości `-e`, także hasło. Tester woła skrypt zamiast `maestro test`. Wejście na ekran makiety idzie mapą funkcji albo flow, nie deep linkiem z A0.7.
- IU-2.3: `--test-output-dir` działa już w Maestro 2.5.1 (plan: ≥ 2.8). Sonda pyta `/status`. Przebudowa to `expo run:*`, nie `xcodebuild` z A0.1 #15.
- IU-2.4: bramka biegnie w `restart` przed testerem, a nie jako krok po execute, i robi STOP zamiast przebudowy. Przebudowa to `prebuild --clean` + `run:*`.
- IU-2.5: linia scenariusza niesie identyfikator flow, nie ścieżkę. Krok build to `expo export`, a `expo-doctor` jest bramką i biegnie przez `npx` tylko po zmianie zależności albo konfiguracji. A0.1 #30 przeszło do slotu `dev-prep`.
- IU-2.8: testy poza katalogiem tras leżą obok plików źródłowych, bo Stryker łączy pary plików. Sekcje Bezpieczeństwo, Type safety i Performance ustalone z dokumentacji, nie próbą.
- D19: `disabledMcpServers` i `deny` w projekcie nie usuwają serwera `plugin:expo:expo`, więc nakładka nie ma reguły dla MCP. Bez logowania serwer nie daje narzędzi.

## Niesprawdzone

Lista z akapitów „Do kolejnych kroków” planu. Stan z dat prób, nie sprawdzany ponownie w odbiorze.

**IU-2.9**
- Klient Supabase z `expo-sqlite/localStorage` na urządzeniu (typecheck przeszedł, dev-client bez przebudowy).
- OAuth PKCE z `expo-auth-session` i Universal Links.
- Sentry z pluginem na urządzeniu, `withUniwindConfig(getSentryExpoConfig(...))`, `autoWrapExpoRouterErrorBoundary`, `heartbeatCallback`.
- `experimental_android`: pole potwierdzone w kodzie pluginu, działanie nie.
- Przepływ Stripe mobile.
- Role badawcze w działaniu, kopie resources poza `SKILL.md` przez builder.

**IU-2.6**
- Z pełnego runu na kopii zostały: defekty bramek (punkt 3), Android, sesja desktop. Reszta przeszła w `wf_e05c211e-938`.
- `przygotuj-kopie.sh` na pnpm, yarn i bun.
- Przejście `/weryfikacja-setup` przez agenta (komenda ze slotu sprawdzona ręcznie).
- Ekran główny za logowaniem, IU-1 i IU-3 fixture'u przez builder.
- Trasy w monorepo z aplikacją w podkatalogu (szkielet zostawia znacznik).
- `testPathIgnorePatterns` na projekcie z bramką Stryker.

**IU-2.4a**
- Zachowanie w prawdziwym runie autopilota: `decyzjaPrzebudowy` i `srodowiskoPoRestarcie` testowane osobno.
- Android-only bez `E2E_PLATFORMA` na Macu z symulatorami bez dev-clienta i wyłączonym emulatorem daje `przebudowa: true`, choć dev-client może być na emulatorze. Naprawa wymienia oba kroki.

**IU-2.1**
- Buildery w prawdziwym runie autopilota (`agentType` w Workflow).
- `get_design_context` przez wariant `-figma` z prawdziwą makietą, przebieg z `figma_screens`.
- Fullstack i dane z prawdziwą bazą, migracją i Deno. Rola data nie dostała flow w próbie.
- Flow z zimnego startu bez wcześniejszego `e2e.mjs start`, flow z `openLink` na Androidzie.

**IU-2.7 i IU-2.8**
- Snippety `ux-ui-guidelines-mobile` (subagent, bez kompilacji), `Uniwind.setTheme`, `@variant`, `withUniwind` z `colorClassName`.
- Pełny `bramki.mjs` na jest-expo (Stryker przeszedł, reszta na fixture'ze).
- Hook w sesji Claude Code.

**IU-2.5**
- Kontrola `expo-swiezosc.mjs` i slot smoke'u w prawdziwym runie.
- `expo-doctor` przy niedziałającej sieci oraz na pnpm, yarn i bun.
- Czas zimnego Jest na dużym projekcie.
- `maestro hierarchy --compact` na urządzeniu w naprawie (sprawdzone tylko `--help`).
- Typecheck bramki na czystym checkoucie, gdy rozgrzewka nie biegła.

**IU-2.4**
- STOP z autopilota w prawdziwym runie.
- Diff lockfile'ów pnpm, yarn i bun na prawdziwym pliku.
- Projekt z `ios/` i `android/` w repo.

**IU-2.3**
- Canary z prawdziwym logowaniem Supabase.
- Sygnatury blokera na prawdziwym błędzie modułu natywnego i entitlements.
- STOP przy niepodpisanym buildzie na prawdziwej binarce (atrapa `codesign`).
- `E2E_URZADZENIE` i fallback Androida bez `E2E_PLATFORMA` na urządzeniach (atrapy).
- Kontrola świeżości na Androidzie przy starym buildzie.
- pnpm i bun w komendzie startu.

**IU-2.2**
- Seedy i `psql` testera na prawdziwej bazie e2e, runner `.maestro/<etap>-run-all.sh`.
- Raport `.ips` przy prawdziwym padzie, sygnatury blokera z dowodu testera.
- Status `zawieszony` na prawdziwym flow (atrapa).
- Tryb `bez-interakcji` i porcje w prawdziwym runie, makiety przez całą rolę.
- Maestro nowszy niż 2.5.1 (najnowszy wg zapisu z 2026-11-05: `cli-2.12.1`).
- Rola po poprawce dowodów (skrypt sprawdzony osobno, wynik roli sprzed poprawki).

**Zapis `<pm> expo run:*`**
- README używa `npx`; pnpm i bun niesprawdzone.

**Dopisane w tym odbiorze**
- Przebieg autopilota w projekcie web po zmianach rdzenia z Etapu 2: wykonany na kopii po przyjęciu, sekcja „Run autopilota na kopii: web”. W chwili przyjęcia „web bez zmian zachowania” opierało się na testach: od `746d862` w `.claude/` zmieniło się 68 plików (+1447, −440), w tym `dev-autopilot-wf.js`, `start.mjs` i zmiany spoza Etapu 2 z `popr/znaleziska-szablonu`.
- Z runu autopilota: bramki `eslint` i `migracje` z defektami fixture'u oraz `expo-doctor` w runie (faza nie zmieniła zależności), run na Androidzie (Pixel_8 nie był włączany, canary spike'a padał na nim w IU-2.6 bez ustalonej przyczyny), baza e2e i db-sync (spike nie ma Supabase), pozycje ręczne ze smoke'a operatora.

## Sprawy otwarte

1. **Defekty z runów:** D4 (ucięty powód `[Manual]`, odesłanie do `docs/active/`) i D5 (`stan:zapis` odmawia nadpisania stanu, niska waga, nie z Etapu 2) otwarte. D1, D2, D3 i D6 zmergowane.
2. **`paths:` w skillach web, naprawione, merge `3b5eede`:** pole zniknęło z `supabase-dev-guidelines`, `tailwind-react-guidelines` i `ux-ui-guidelines`, doszedł test rdzenia `.claude/workflows/__tests__/skille-preload.test.mjs`. Zmiana zachowania webu zamówiona przez operatora. Prawdziwe projekty dostaną ją dopiero przez `sync-template`. Niesprawdzone wg raportu sesji naprawy: role `-fullstack` i `-figma` (tylko test frontmattera, bez próby), prawdziwy run autopilota web z tą zmianą.
3. **`dev-browser` w wariancie:** do decyzji, zdjęcie wymaga zmiany `doctor.test.mjs` rdzenia.
4. **Test „probny zrzut na starcie” w `srodowisko.test.mjs`:** padł raz w pełnym `pnpm test`, przyczyna nieustalona. W trzech pełnych biegach odbioru nie padł.
5. **`create_session` Figmy z A0.7 §4:** dalej poza allowlistą, jak na webie.
6. **`dowodNatywnosci`:** dev-paczka z katalogiem `ios` (np. `jest-expo`) liczy się jako natywna. Fałszywy STOP kosztuje jedną przebudowę.
7. **Dysk operatora:** pliki `commands-*.json` z wcześniejszych przebiegów w `~/.maestro/tests` zostają i mogą zawierać wartości `-e`.
8. **Stan `spike-expo-58`:** `package-lock.json` zmieniony przez `npm install` po próbie Strykera, treści zmiany nie oglądano. `.env.e2e` ma `E2E_PLATFORMA=android` i próbne wartości, jest `.maestro/_canary.yaml`.
9. **Kopia i klon z runu:** zostają w scratchpadzie sesji runu do decyzji operatora o usunięciu.
10. **D3 po merge'u:** `ps -E` pokazuje wartości temu samemu użytkownikowi (zakaz w roli testera, bez technicznej blokady), Android nie biegł, runner `.maestro/<etap>-run-all.sh` niesprawdzony, a klucze `MAESTRO_*` z `.env.e2e` są teraz w środowisku samego CLI i mogą wpływać na jego ustawienia. Flow używające starych `${E2E_EMAIL}` i `${E2E_PASSWORD}` przestają działać.
11. **Kopia i wolumeny z przebiegu web:** `kopia-vibersi`, `baza-e2e` i wolumeny Dockera `supabase_db_kopia-smoke-vibersi`, `supabase_storage_kopia-smoke-vibersi` zostają do decyzji operatora o usunięciu.

## CI

| Commit | Run | Wynik |
|---|---|---|
| `cc4e4ce` (merge IU-2.9, z IU-2.4a, 2.1 i 2.6) | `42362958177` | success, 1m59s |
| `53a17e7` (raport odbioru, D1 i D2 Expo) | `42370428123` | success, 1m20s |

Push `cc4e4ce` objął 9 commitów nad `36273e1`, a `main..origin/main` był pusty po `git fetch` przed pushem.

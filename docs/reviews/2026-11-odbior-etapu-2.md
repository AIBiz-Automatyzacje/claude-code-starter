# Odbiór Etapu 2 — nakładka Expo

Data: 2026-11-07. Szablon: `cc4e4ce`, CI „maszyneria” zielone (run `42362958177`). Plan: `docs/plans/2026-11-01-001-feat-szablon-mobile-z-rdzenia-plan.md`.

**Status: kryterium z planu spełnione, Etap 2 nieprzyjęty.** Operator zdecydował, że przyjęcie czeka na pełny run autopilota na kopii.

## Wynik

| Kryterium | Wynik | Dowód |
|---|---|---|
| `node stacks/zbuduj.mjs expo <katalog>` daje `.claude/` | PASS | 410 plików, 85 usuniętych, `.rdzen-version` = `cc4e4ce16f08…` bez `-dirty` |
| Testy rdzenia na wariancie | PASS | `node stacks/testuj-wariant.mjs expo`: 1268/1270, 2 pominięte, 0 padnięć, typecheck 0 |
| Testy nakładki | PASS | `pnpm -s test` w worktree: 1711/1711; typecheck 0, lint 0 |
| Obie listy zaległych puste | PASS | `ZALEGLE = []`, `ZALEGLE_ODESLANIA = []`; w `stacks/straznik.json` brak wpisów `przejsciowy` |
| CI | PASS | `pnpm typecheck && pnpm test && pnpm lint` na `cc4e4ce`, 1m59s |
| Pełny run autopilota na kopii | NIESPRAWDZONE | decyzja operatora: przed przyjęciem, w osobnej sesji |

Uwagi do liczb:
- Testy wariantu biegną na ławce, a nie w katalogu z CLI. Porównanie sum SHA-256 `.claude/` obu katalogów: 410 plików, zero różnic.
- Dwa pominięte testy to warunki stacku web: port deweloperski w `E2E_URL` i plik `.env.e2e.local`.
- `pnpm -s test` w głównym katalogu po merge'u: 1992/1992. Różnica względem 1711 to znany glob, który łapie testy z `.claude/worktrees`.
- CI nie uruchamia testów rdzenia na wariancie: job `wariant-expo` to IU-3.2. Ten wynik pochodzi tylko z lokalnego biegu, a testy z `stacks/expo/__tests__/` CI uruchamia.
- W odbiorze nie włączano urządzeń. Próby niżej dotyczą stanów z poszczególnych IU, a `cc4e4ce` jako całość na urządzeniu nie był uruchamiany.

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
- Pełny run autopilota na kopii: oba przebiegi z README, defekty review i bramek, `[Manual]` po zatrzymaniu Metro.
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
- Przebieg autopilota w projekcie web po zmianach rdzenia z Etapu 2. Plan i raporty nie mają takiego zapisu, a „web bez zmian zachowania” opiera się na testach. Od `746d862` w `.claude/` zmieniło się 68 plików (+1447, −440), w tym `dev-autopilot-wf.js`, `start.mjs` i zmiany spoza Etapu 2 z `popr/znaleziska-szablonu`. Etap 1 złapał regresję canary właśnie takim przebiegiem, po zielonych testach.

## Sprawy otwarte

1. **Pełny run autopilota na kopii:** warunek przyjęcia Etapu 2 wg decyzji operatora (2026-11-07), osobna sesja.
2. **`paths:` w skillach web:** `supabase-dev-guidelines`, `tailwind-react-guidelines` i `ux-ui-guidelines` nadal mają to pole, więc buildery web dostają te skille tylko czasem (transkrypty vibersi z 2026-11-01 i 11-03). Naprawa zmienia zachowanie webu. Decyzja operatora: po odbiorze, osobna gałąź `popr/*` z usunięciem `paths:` i testem rdzenia „skill w `skills:` bez `paths:`”.
3. **`dev-browser` w wariancie:** do decyzji, zdjęcie wymaga zmiany `doctor.test.mjs` rdzenia.
4. **Test „probny zrzut na starcie” w `srodowisko.test.mjs`:** padł raz w pełnym `pnpm test`, przyczyna nieustalona. W trzech pełnych biegach odbioru nie padł.
5. **`create_session` Figmy z A0.7 §4:** dalej poza allowlistą, jak na webie.
6. **`dowodNatywnosci`:** dev-paczka z katalogiem `ios` (np. `jest-expo`) liczy się jako natywna. Fałszywy STOP kosztuje jedną przebudowę.
7. **Dysk operatora:** pliki `commands-*.json` z wcześniejszych przebiegów w `~/.maestro/tests` zostają i mogą zawierać wartości `-e`.
8. **Stan `spike-expo-58`:** `package-lock.json` zmieniony przez `npm install` po próbie Strykera, treści zmiany nie oglądano. `.env.e2e` ma `E2E_PLATFORMA=android` i próbne wartości, jest `.maestro/_canary.yaml`.

## CI

| Commit | Run | Wynik |
|---|---|---|
| `cc4e4ce` (merge IU-2.9, z IU-2.4a, 2.1 i 2.6) | `42362958177` | success, 1m59s |

Push objął 9 commitów nad `36273e1`, a `main..origin/main` był pusty po `git fetch` przed pushem.

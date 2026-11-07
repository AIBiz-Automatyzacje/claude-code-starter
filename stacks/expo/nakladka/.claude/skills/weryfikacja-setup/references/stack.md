# weryfikacja-setup — fragmenty stacku Expo (Maestro)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Narzędzie jazdy w przejściu na żywo i wiedza o dev-cliencie. Szkielet skilla weryfikacji
dostaje te same komendy z adaptera E2E (`SZKIELET_WERYFIKACJI` w `.claude/scripts/e2e/adapter.mjs`). Setup środowiska opisuje
`.claude/templates/e2e-env/README.md`, a przebudowę dev-clienta `.claude/stack/po-fazie.md`, sekcja „Przebudowa”.

## Fakty z kodu

Selektor w krokach Drive to `testID` z komponentu, a we flow pole `id`. Etykiety bierzesz z tekstu widocznego na ekranie. Trasy szkielet liczy
z plików Expo Router. Adres z grupą albo parametrem sprawdzasz na żywo, bo trasa spoza układu kart nie musi być osiągalna linkiem.

## Przejście na żywo

- Drive: napisz flow w `.expo/weryfikacja-setup/przejscie.yaml` (`.expo/` jest w `.gitignore`, a do `.maestro/` trafiają tylko flow zadań) według sekcji
  Drive skilla i drogi jednej funkcji z mapy (najnowszy wpis) albo głównego ekranu, gdy mapa jest pusta. Flow zaczyna się od `stopApp` i `openLink` do
  dev-clienta (`${APP_SCHEME}://expo-development-client/?url=${METRO_URL}`), zmienne podaje skrypt.
- Evidence: flow ma asercję oczekiwanego stanu i `takeScreenshot`. Uruchomienie:
  `node .claude/scripts/e2e/expo-flow.mjs --zadanie .expo/weryfikacja-setup --flow przejscie --plik .expo/weryfikacja-setup/przejscie.yaml`. Wynik `status: ok` i zrzut w
  `.expo/weryfikacja-setup/maestro/przejscie/` są dowodem. Skrypt nie włącza urządzenia, więc biegnie po `e2e.mjs start`.
- Cleanup: `e2e.mjs stop` zatrzymuje Metro i usuwa `.env.development.local`; urządzenie zostaje włączone, więc wyłącz je, gdy kończysz pracę.

## Dev-client i pułapki

- `launchApp` na świeżym dev-cliencie ląduje na ekranie „DEVELOPMENT SERVERS”, a pierwsza asercja pada bez wskazania przyczyny. Po `e2e.mjs start` aplikacja jest już
  załadowana, więc `launchApp` wtedy przechodzi: nie dowodzi to, że flow ruszy z zimnego startu. Do dev servera wchodzisz `openLink`.
- Restart aplikacji w flow to `stopApp` i `openLink`, nigdy `launchApp` z `openLink`: link z adresem Metro do żywego procesu wywraca runtime.
- Arkusz „This is the developer menu” z przyciskiem `Continue` może wrócić po `clearState: true`. Wzór warunkowego zamknięcia: `.claude/templates/e2e-env/_canary.yaml`.
- Pierwszy deep link na iOS pyta „Otworzyć w…”: tap warunkowy po `Otwórz|Open`.
- Symulator z zalogowanym kontem Apple pokazuje monit, który zasłania aplikację i nie zamyka się wstrzykniętym dotknięciem. Adapter go odrzuca, a przy `E2E_URZADZENIE` wskaż inny.
- Element przy dole ekranu przewijasz z `centerElement: true`: inaczej dotknięcie trafia w pływający pasek kart albo dymek LogBox.
- Moduł natywny sprawdzasz w `<App>.app/<App>.debug.dylib` (`nm -a … | grep -ci <moduł>`) i w `ExpoModulesProvider.swift` w `ios/Pods`. Lista `Frameworks/` i sam plik `<App>` nic nie dowodzą: pody linkują się do dylib, a `<App>` to mały stub.
- Logowanie e2e za bramką `__DEV__` wyklucza build `preview`: przycisk w nim nie powstaje, a flow pada na pierwszym `tapOn`. E2E biegnie na dev-cliencie.
- Przycisk dev sign-in wymaga pary `EXPO_PUBLIC_E2E_TEST_USER_EMAIL` i `EXPO_PUBLIC_E2E_TEST_USER_PASSWORD` w `.env.e2e`, równej `E2E_TEST_EMAIL` i `E2E_TEST_PASSWORD`. Bez niej przycisk się nie renderuje, a start tego nie zgłosi.

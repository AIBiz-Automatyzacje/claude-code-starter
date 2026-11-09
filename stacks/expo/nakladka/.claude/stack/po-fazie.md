# Po fazie — stack Expo

Slot stackowy (rejestr: `stacks/sloty.json`). Punkt rozszerzenia: to, co stack musi zrobić po zmianach fazy, zanim tester ją sprawdzi.

## Przebudowa

Faza, która dodała paczkę z kodem natywnym albo zmieniła konfigurację natywną, unieważnia dev-clienta: binarka nie ma tego kodu, więc
każdy flow pada na `Cannot find native module`. Bramka biegnie w `e2e.mjs start` i `e2e.mjs restart` przed testerem każdej fazy ze
scenariuszami, a przy potrzebie przebudowy autopilot robi STOP.

- Tani detektor: binarka starsza od `ios/Podfile.lock` (iOS), `android/build.gradle` (Android), `app.json`, `app.config.*` albo lockfile'a.
  `package.json` celowo poza listą, bo jego mtime przestawia każdy checkout.
- Nowszy plik natywny to STOP od razu. Przy pozostałych rozstrzyga diff od pierwszego commita nowszego niż binarka:
  - paczka dodana albo podbita jest natywna, gdy na dysku ma `expo-module.config.json`, `ios/`, `android/`, `app.plugin.js`, pole `expo`
    w `package.json`, `*.podspec` albo `build.gradle`;
  - zmiana `plugins`, `ios`, `android`, `permissions`, `entitlements` albo `scheme` w `app.json`, a także każda zmiana `app.config.*`, też wymaga przebudowy;
  - czego nie da się rozstrzygnąć (brak `node_modules/<pkg>`, nieznany format lockfile'a, brak historii git), idzie jak zmiana natywna.
- Paczka czysto JS albo sam checkout: przebudowa niepotrzebna, a wynik startu mówi to w uwadze.
- Brak działającego urządzenia to nie przebudowa: wystarczy je włączyć. `start` robi STOP z tą naprawą, a `restart` w trakcie runu nie zatrzymuje autopilota: scenariusze idą na `[Manual]` z tym powodem.

Przebudowa:

- iOS: `LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios && LANG=en_US.UTF-8 npx expo run:ios --no-bundler`. Bez `LANG` CocoaPods pada na
  `Unicode Normalization not appropriate for ASCII-8BIT` w powłoce bez locale.
- iOS z Sign in with Apple albo associated domains na Macu bez certyfikatu Apple: `expo run:ios` żąda podpisu także dla symulatora i kończy się
  `No code signing certificates are available to use`. Wtedy podpis ad-hoc, który zostawia entitlements:
  `LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios && LANG=en_US.UTF-8 xcodebuild -workspace ios/<Aplikacja>.xcworkspace -scheme <Aplikacja> -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build CODE_SIGN_IDENTITY=- build && xcrun simctl install <UDID> ios/build/Build/Products/Debug-iphonesimulator/<Aplikacja>.app`
  (`<Aplikacja>` = nazwa `ios/*.xcworkspace`). Nie `CODE_SIGNING_ALLOWED=NO`: binarka straci entitlements, a SecureStore sesję.
- Android: `npx expo prebuild --clean --platform android && npx expo run:android --no-bundler`. Gradle sam dociąga brakującą platformę Androida.
- `--clean` usuwa `ios/` i `android/`. Projekt, który trzyma te katalogi w repo, pomija `prebuild` i woła samo `expo run:*`.
- `eas build` nie jest potrzebny do E2E.
- Po przebudowie: świeży run. Execute fazy jest zapisany, więc run wchodzi prosto w review.
- Komendy startu są dla npm; projekt na pnpm albo bun podmienia `npx` na swój odpowiednik.

Niewykryte: commit z datą sprzed builda dołączony mergem. Taki przypadek łapią sygnatury blokera testera (`brak-modulu-natywnego`, `brak-entitlements`).

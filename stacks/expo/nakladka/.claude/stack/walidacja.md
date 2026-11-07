# Walidacja — stack Expo (jest-expo + RNTL)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń odsyła tu po wszystko, co w walidacji zależy od runnera testów
i narzędzia builda. Prawa środowiska agenta (watchdog 180 s ciszy, limit 600 s foreground Bash, praca w tle z pollingiem)
są w rdzeniu i obowiązują niezależnie od tego pliku.

## Runner testów i build

- Runner testów: jest (jest-expo, RNTL 14, Jest 30; D8). Komendy bierzesz z `scripts` w `package.json` (typecheck, lint, test).
- Test jednego pliku (np. pozycja `Weryfikacja` w planie): `npx jest <ścieżka> --watchAll=false`.
- Krok build: `npx expo export --platform ios --platform android --output-dir .expo/export-walidacja`, także bez skryptu `build`
  w `package.json`. Sprawdza, że Metro składa paczkę na obie platformy, czego Jest nie sprawdzi; `.expo/` jest w `.gitignore`.
- `eas build` nie jest krokiem walidacji: wymaga konta i kolejki, a E2E biegnie na lokalnym dev-cliencie.
- Domknięcie fazy sprawdza, że `expo export` przechodzi. `expo-doctor` uruchamia bramka `stack` ze `scripts/bramki/bramki.mjs`,
  gdy faza zmieniła zależności albo konfigurację aplikacji, więc nie wołasz go osobno.
- Typecheck na czystym checkoucie: `expo-env.d.ts` i `.expo/types` są w `.gitignore`, a bez nich `tsc` zgłasza TS2882 i TS2307 na
  plikach `.css`. Przed `tsc`: `npx expo customize tsconfig.json`; tworzy je bez Metro i nie zmienia istniejącego `tsconfig.json`.
- `src/uniwind-types.d.ts` generuje Metro, a bez niego każdy `className` to TS2322. Plik nie jest w `.gitignore`: commitujesz go.
- Szablon `default@sdk-58` przy `verbatimModuleSyntax` ma importy typów bez `type` (TS1484) i osobny błąd TS2322 w
  `app-tabs.web.tsx`, obecny także bez tej flagi. To defekty szablonu: naprawiasz je przy starcie projektu.

## Konfiguracja Jest

Wzorzec `transformIgnorePatterns` z docs Expo nie wystarcza. Klucz `jest` w `package.json`, sprawdzony na Expo SDK 58:

```json
{
  "preset": "jest-expo",
  "resolver": "react-native-reanimated/jest/resolver",
  "testPathIgnorePatterns": ["/node_modules/", "<rootDir>/.claude/"],
  "transformIgnorePatterns": [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|uniwind))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/"
  ],
  "moduleNameMapper": {
    "\\.css$": "<rootDir>/jest-css-stub.js",
    "^@/assets/(.*)$": "<rootDir>/assets/$1"
  }
}
```

Plik `jest-css-stub.js` w korzeniu to `module.exports = {};`. Skrypt testów: `"test": "jest --watchAll=false"`.

| Objaw | Przyczyna | Naprawa |
|---|---|---|
| Doctor: `jest zbiera <n> plików testów maszynerii z .claude/**` | Jest zbiera testy szablonu, których nie umie uruchomić, więc run staje na starcie | `testPathIgnorePatterns` wyżej |
| `Must use import to load ES Module: standard-navigation` | wzorzec z docs nie ma `standard-navigation`, a Expo Router 58 go wymaga | wzorzec wyżej |
| to samo dla `uniwind/src/index.ts` | kod testowany importuje z `uniwind` | wzorzec wyżej |
| `SyntaxError` na `@import 'tailwindcss'` | import `@/global.css` | `moduleNameMapper` na `\.css$` |
| `Could not locate @/assets/...` | `jest-expo` przepisuje `paths` z `tsconfig`, a `@/*` wygrywa z `@/assets/*` | `moduleNameMapper` na `^@/assets/` |
| `Cannot read properties of undefined (reading 'elastic')` | Reanimated w Jest | `resolver` wyżej |

`@expo/env` nie ładuje `.env.local` w trybie `test` (kod `getEnvFiles`, bez próby testem), więc test nie opiera się na tym pliku.

## Zimny runner

- Jest wypisuje linię po każdym skończonym zestawie, ale przed pierwszym zestawem zimny bieg może milczeć w fazie transformacji.
- Pomiar na małym projekcie (3 zestawy, 4 testy): bez cache 13 s, z cache 7 s. Dużego projektu nie mierzono, więc przy pełnym
  zestawie po zmianie zależności stosujesz procedurę tła.
- Komendy mogące trwać >100 s: pełny zestaw na dużym projekcie, `expo export` po zmianie zależności.
- Po zmianie `package.json` / lockfile / `babel.config.*` / klucza `jest` / `metro.config.js` przez kogokolwiek w tym runie: pierwszy
  bieg traktuj jako ZIMNY (pełna procedura tła).
- Jednostka dodająca nową zależność (paczka, konfiguracja Jest albo Babela) → strategia serial: równoległe zimne biegi powielają
  tę samą transformację.

## Flake infrastruktury

Błąd infrastruktury workera w pełnym zestawie: `Jest worker encountered`, `Call retries were exceeded`, `ENOMEM`, `heap out of memory`.

## Rozgrzewka cache

Cel: zbudować cache transformacji Jest PRZED fazami implementacji i wygenerować typy potrzebne do typechecku.

1. Runner: rozgrzewka dotyczy WYŁĄCZNIE jest (`jest-expo` w `package.json`). Brak → rozgrzewka zbędna.
2. Plik: JEDEN test komponentu z najcięższym setupem: `*.test.tsx` importujący komponenty RN (`src/components/`, `src/features/`;
   testy tras w `__tests__/`). Bez żadnego testu komponentu w repo (projekt greenfield): tymczasowy plik
   `__tests__/autopilot-warmup.test.tsx` z renderem `<View><Text>warmup</Text></View>` przez `await render` z
   `@testing-library/react-native` i 1 asercją; usuwasz go po rozgrzewce.
3. Komenda biegu: `npx expo customize tsconfig.json && <pm> jest <plik> --watchAll=false` (pm z lockfile: `bun.lockb`→bunx, pnpm→pnpm,
   yarn→yarn, npm→npx). `expo customize` tworzy tylko pliki z `.gitignore`, więc nie łamie zakazu modyfikacji plików.

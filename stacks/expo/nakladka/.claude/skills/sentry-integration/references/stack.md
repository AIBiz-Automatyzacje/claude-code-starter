# sentry-integration — fragmenty stacku Expo

Klient `@sentry/react-native` zamiast rdzeniowego SDK web. Pełne wzorce: `resources/react-native-sentry-patterns.md`.

## Instalacja

- `npx expo install @sentry/react-native`, plugin `@sentry/react-native/expo` w app config i `metro.config.js` z `getSentryExpoConfig(__dirname)` (`@sentry/react-native/metro`). Bez Metro paczka i sourcemapy nie mają Debug ID.
- Wersja: SDK 58 instaluje `~8.28.0`, a spany nawigacji Expo Router 58 działają od `>=8.33.0` (sprawdzone 2026-11-07: `bundledNativeModules.json`, npm 8.34.0). Przypinasz dokładną wersję co najmniej 8.33.0 i dopisujesz paczkę do `expo.install.exclude` (`.claude/rules/stack.md`, sekcja „Zależności”). Na innym SDK sprawdzasz changelog.
- Plugin i Metro to warstwa natywna: po dodaniu przebudowa dev-clienta (`.claude/stack/po-fazie.md`, sekcja „Przebudowa”).

## Inicjalizacja

- `Sentry.init` na poziomie modułu w root layoucie (`src/app/_layout.tsx` albo `app/_layout.tsx`), a na końcu pliku `export default Sentry.wrap(RootLayout)`.
- `expoRouterIntegration({ enableTimeToInitialDisplay: !isRunningInExpoGo() })`, `tracesSampleRate: 0.1`.

## PII

- `sendDefaultPii: false`: w RN to właściwy przełącznik, a `dataCollection` dotyczy JS SDK. Użytkownika identyfikuje `id`.
- Session Replay maskuje domyślnie tekst, obrazy i grafikę wektorową. Wyłączasz to tylko per ekran bez danych osobowych.

## Sourcemapy

- EAS Build wysyła je sam, gdy `SENTRY_AUTH_TOKEN` jest sekretem EAS (`eas env:set`). Token nie ma prefiksu `EXPO_PUBLIC_`.
- EAS Update nie wysyła ich sam: `npx expo export --dump-sourcemap`, `eas update`, potem `npx @sentry/expo-upload-sourcemaps dist`.
- `eas` uruchamiasz tylko na polecenie operatora.

## Komunikat dla użytkownika

- Po `logger.error` pokazujesz `Alert.alert` albo komponent błędu ekranu; `toast` z przykładów web tu nie istnieje.

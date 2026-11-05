# Kod per platforma

- `process.env.EXPO_OS` zamiast `Platform.OS`: pozwala usunąć nieużywaną gałąź z paczki.
- Pliki `.ios.tsx` i `.android.tsx` przy dużym rozjeździe; małe różnice w klasach przez warianty `ios:` i `android:` (skill `uniwind`).
- `@expo/ui` (SwiftUI, Jetpack Compose) dla arkuszy, pickerów, sliderów, przełączników i menu. Warstwa uniwersalna działa w Expo Go od SDK 56.
- SF Symbols przez `expo-symbols`, Material na Androidzie (`expo:expo-native-ui`).

## Kiedy dev build

Dev build jest potrzebny przy module natywnym spoza Expo Go, np. `react-native-keyboard-controller`, push na Androidzie albo własnym config plugin. Szablon testuje E2E na dev-cliencie (`mobile-e2e-maestro`). Zmiana warstwy natywnej wymaga przebudowy dev-clienta; pilnuje tego bramka po fazie.

## Pliki konfiguracji

`app.json` albo `app.config.ts`, `metro.config.js` z `withUniwindConfig` jako najbardziej zewnętrznym wrapperem, `global.css` importowany w głównym layoutcie, nie w pliku wejściowym.

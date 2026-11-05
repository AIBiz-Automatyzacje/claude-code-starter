# Dostępność, tekst, motyw

## Dostępność

- `role` ma pierwszeństwo przed `accessibilityRole`; używasz jednego z nich konsekwentnie.
- Ikona i obraz niosące treść mają `accessibilityLabel`; stan kontrolki opisuje `accessibilityState`.
- Ogłoszenia dynamiczne: `accessibilityLiveRegion` działa tylko na Androidzie, na iOS `AccessibilityInfo.announceForAccessibility`.
- Device Hub w SDK 58 ma przełączniki rozmiaru tekstu i ustawień dostępności, przydatne przy sprawdzaniu.
- Czytnik ekranu sprawdza operator w smoke'u; builder działa bez urządzenia.

Pełna checklista: `ux-ui-guidelines-mobile`, `resources/accessibility-mobile.md`.

## Dynamic Type

`allowFontScaling` zostaje domyślnie włączone. `maxFontSizeMultiplier` ograniczasz tylko tam, gdzie układ nie ma wyjścia, np. w tab barze. Na iOS `dynamicTypeRamp` (`body`, `headline`…) daje skalowanie semantyczne.

Układ testujesz przy dużym tekście systemowym, zanim oddasz ekran.

## Ciemny motyw

- `userInterfaceStyle: "automatic"` w konfiguracji aplikacji, `expo-system-ui` dla Androida w dev buildach.
- Warianty `dark:` i przełączanie motywu: `Uniwind.setTheme`; nigdy `:root.dark` na natywnych platformach (skill `uniwind`, `references/theming.md`).
- `useColorScheme` z `react-native`, gdy logika, nie klasa, zależy od motywu.
- Kolory semantyczne `Color` z `expo-router` same dostosowują się do motywu.

Dokumentacja: https://docs.expo.dev/develop/user-interface/color-themes/

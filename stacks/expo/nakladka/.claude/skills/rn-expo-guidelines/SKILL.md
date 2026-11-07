---
name: rn-expo-guidelines
description: "Wytyczne kodu React Native + Expo SDK 58 + Uniwind: komponenty i tokeny, listy FlashList, expo-image, safe area, klawiatura, Reanimated 4, haptyka, dostępność, Dynamic Type, ciemny motyw, kod per platforma, testy RNTL. Używaj przy pisaniu ekranów i komponentów RN, 'ekran', 'lista', 'formularz', 'animacja', przy review kodu UI mobile."
---

# Wytyczne RN + Expo

## Cel

Jak pisać kod UI w tym stosie. Skill nie powtarza innych źródeł: UX i design są w `ux-ui-guidelines-mobile`, API platformy w skillach `expo:*`, a składnia stylów w `uniwind`. Reguły „nigdy / zawsze” stoją w `.claude/rules/stack.md`.

## Kiedy używać

Przy nowym ekranie, komponencie, liście, formularzu, animacji i przy naprawie błędu UI. Przy dotykaniu tylko warstwy danych wystarczy `supabase-dev-guidelines`.

## Checklisty

**Nowy ekran**
- [ ] Safe area: `useSafeAreaInsets` albo `SafeAreaView` z `react-native-safe-area-context`.
- [ ] Na ekranie ze Stack pierwszy element to `ScrollView` albo lista z `contentInsetAdjustmentBehavior="automatic"`.
- [ ] Stany: ładowanie, błąd, pusto, treść.
- [ ] Duży tekst systemowy nie rozbija układu.
- [ ] Ciemny motyw: tylko tokeny semantyczne.
- [ ] `testID` na elementach, których dotyka flow Maestro.

**Nowy komponent**
- [ ] Warianty przez mapę kompletnych klas, bez sklejania nazw klas.
- [ ] Kolory i odstępy z tokenów w `global.css`; wartość arbitralna tylko z makiety.
- [ ] `role`, `accessibilityLabel` na ikonach i obrazach, `accessibilityState`.
- [ ] Cel dotyku co najmniej 44 pt.

**Lista**
- [ ] Długa albo o nieznanej długości: FlashList v2. Krótka: `FlatList`. Grupa ustawień: `List` z `@expo/ui`.
- [ ] W wierszu `expo-image` z `recyclingKey`, bez `entering`.

**Formularz**
- [ ] `KeyboardAwareScrollView` z `react-native-keyboard-controller` i `keyboardShouldPersistTaps="handled"`.
- [ ] `autoComplete`, `textContentType`, `returnKeyType`, `submitBehavior` na polach.
- [ ] Bez `lineHeight` w `TextInput` na iOS, kolory pola przez `accent-*`.

**Animacja**
- [ ] Najniższy szczebel drabinki (`references/motion-haptics.md`).
- [ ] `useReducedMotion` albo `ReduceMotion.System`.

## Główne zasady

1. Tekst tylko w `<Text>`; `View` nie renderuje gołego stringa.
2. `SafeAreaView` tylko z `react-native-safe-area-context`.
3. Obraz przez `expo-image`; `ImageBackground` zastępuje `View` z obrazem pozycjonowanym absolutnie.
4. Kontrolki systemowe najpierw z `@expo/ui` (`expo-stos-szablonu`, reguła wyboru komponentu).
5. Cień przez `boxShadow`, nie `shadow*` ani `elevation`. Krawędź `borderCurve: 'continuous'`.
6. Platformę rozpoznajesz przez `process.env.EXPO_OS` (tree-shaking), duży rozjazd przez pliki `.ios.tsx` i `.android.tsx`.
7. Klawiatura przez `react-native-keyboard-controller`, bez `Keyboard.addListener` z animacją.
8. Animacja na natywnym wątku przez Reanimated 4; `Color` i `PlatformColor` nie trafiają do jego stylów.
9. `allowFontScaling` zostaje włączone; `maxFontSizeMultiplier` tylko tam, gdzie układ nie ma wyjścia.
10. Haptyka nie niesie jedynej informacji: na iOS nie działa m.in. w Low Power Mode.
11. Klas nie budujesz dynamicznie; Tailwind skanuje je w czasie budowania.
12. `withUniwind` tylko dla komponentów spoza `react-native` i Reanimated, np. `expo-image`.
13. Test leży obok pliku, a test trasy w `__tests__/`; `render` i `fireEvent` z RNTL 14 wymagają `await`.

## Wersje stosu

Jedyne miejsce z numerami wersji. Sprawdzone 2026-11-05 w `bundledNativeModules.json` gałęzi `sdk-58`, npm i spike'u SDK 58. Projekt bierze wersje z `npx expo install`, nie z tej tabeli.

| Paczka | Wersja |
|---|---|
| `expo` / `react-native` / `react` | 58.0.23 / 0.88.1 / 19.3.0 |
| `react-native-reanimated` / `react-native-worklets` | 4.7.1 / 0.13.0 |
| `react-native-gesture-handler` | ~3.3.0 |
| `@shopify/flash-list` | 2.3.2 |
| `react-native-keyboard-controller` | 1.22.7 |
| `react-native-safe-area-context` | ~5.11.1 |
| `@expo/ui` / `expo-image` / `expo-haptics` | ~58.0.27 / ~58.0.18 / ~58.0.7 |
| `uniwind` / `tailwindcss` | 1.13.x (spike: 1.13.1, npm: 1.13.2) / 4.3.4 |
| `jest` / `jest-expo` / `@testing-library/react-native` | 30.5.2 / 58.0.14 / 14.1.0 |

## Navigation guide

| Temat | Plik | Skill zewnętrzny |
|---|---|---|
| Silnik stylowania, propsy kolorów, komponenty firm trzecich | `references/styling-engine.md` | `uniwind` |
| Warianty, struktura komponentu, kiedy wydzielać | `references/components-and-tokens.md` | `expo:expo-design-system` |
| FlashList, `FlatList`, `expo-image` | `references/lists-and-images.md` | `expo:expo-ui` |
| Safe area, scroll, edge-to-edge | `references/layout-safe-area.md` | `expo:expo-native-ui` |
| Pola, klawiatura, RHF + Zod | `references/forms-keyboard.md` | `ux-ui-guidelines-mobile` |
| Drabinka ruchu, haptyka | `references/motion-haptics.md` | `expo:expo-animation` |
| Dostępność, Dynamic Type, motyw | `references/a11y-type-theme.md` | `ux-ui-guidelines-mobile` |
| Kod per platforma, dev build | `references/platform.md` | `expo:expo-ui`, `expo:expo-dev-client` |
| Testy jednostkowe i granica z Maestro | `references/testing.md` | `mobile-e2e-maestro` |
| Lista „nigdy” z grepami | `references/anti-patterns.md` | — |

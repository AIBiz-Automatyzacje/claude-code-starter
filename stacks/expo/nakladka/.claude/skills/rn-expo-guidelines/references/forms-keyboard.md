# Formularze i klawiatura

## Klawiatura

`react-native-keyboard-controller` wymaga dev builda i Reanimated oraz `KeyboardProvider` w korzeniu aplikacji.

| Sytuacja | Narzędzie |
|---|---|
| Formularz | `KeyboardAwareScrollView` |
| Wiele pól, przejścia między nimi | `KeyboardToolbar` |
| Czat, własna animacja | `useKeyboardHandler` |

`KeyboardAvoidingView` nadaje się na prototyp. Wtedy `behavior="padding"` na obu platformach: aplikacje Expo na Androidzie są edge-to-edge, więc widok bez `behavior` zostaje pod klawiaturą. Pod nagłówkiem nawigacji `keyboardVerticalOffset` daje `useHeaderHeight()` z `expo-router/react-navigation`. Na Androidzie nie łączysz tego z `softwareKeyboardLayoutMode: "pan"`, bo pole przesuwa się podwójnie.

Główna akcja nie chowa się pod klawiaturą. Na przewijanych kontenerach `keyboardShouldPersistTaps="handled"`. Bez `Keyboard.addListener` z animacją czasową.

Źródło: https://docs.expo.dev/guides/keyboard-handling/

## Pola

Każde pole ma `autoComplete`, `textContentType`, `keyboardType`, `returnKeyType` i `submitBehavior`, żeby system proponował dane i klawisz „Dalej” przechodził do następnego pola. Kolory i `lineHeight` pola opisuje `styling-engine.md`.

## Walidacja

React Hook Form + Zod jak na webie; `TextInput` podpinasz przez `Controller` (`onChangeText`, `onBlur`, `value`). Dane z zewnątrz walidujesz tym samym schematem.

Błąd pola widać przy polu. Ogłoszenie dla czytnika różni się między platformami: `accessibilityLiveRegion` działa tylko na Androidzie, na iOS potrzebny jest `AccessibilityInfo.announceForAccessibility`.

UX formularzy, kolejność pól i komunikaty: `ux-ui-guidelines-mobile`, `resources/forms-keyboard.md`.

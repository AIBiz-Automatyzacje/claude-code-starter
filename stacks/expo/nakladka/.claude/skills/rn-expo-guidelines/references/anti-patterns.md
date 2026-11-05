# Antywzorce

Każdy wiersz ma grep do szybkiego przeglądu zmienionych plików. Trafienie to sygnał, nie wyrok: sprawdź kontekst.

| Nigdy | Grep | Zamiast |
|---|---|---|
| `SafeAreaView` z `react-native` | `SafeAreaView.*from 'react-native'` | `react-native-safe-area-context` |
| `ImageBackground` | `ImageBackground` | `View` + obraz pozycjonowany absolutnie |
| `Image` z `react-native` | `Image.*from 'react-native'` | `expo-image` |
| `Keyboard.addListener` z animacją | `Keyboard\.addListener` | `react-native-keyboard-controller` |
| `entering` na wierszu listy | `entering=` w `renderItem` | animacja poza wierszem |
| `shadow*`, `elevation` | `shadow(Color\|Offset\|Opacity\|Radius)\|elevation:` | `boxShadow` |
| Kolor na sztywno | `bg-\[#\|text-\[#` | token z `global.css` |
| Klasa sklejana | `` `bg-\$\{ `` | mapa kompletnych klas |
| `withUniwind` na komponencie RN | `withUniwind\((View\|Text\|Pressable\|Image\)` | `className` wprost; `withUniwind` dla paczek spoza RN |
| `text-*` na `placeholderTextColor` | `placeholderTextColor=` | `placeholderTextColorClassName="accent-*"` |
| `lineHeight` w `TextInput` na iOS | `TextInput` z `text-lg` albo `leading-` | `text-[18px]` bez `lineHeight` |
| String `cubic-bezier` | `'cubic-bezier` | helper `cubicBezier` |
| `runOnJS` | `runOnJS` | `scheduleOnRN` |
| Pin nightly w `package.json` | `nightly` | wersja z `npx expo install` |
| `NativeWind` w nowym projekcie | `nativewind` | Uniwind (`expo-stos-szablonu`) |
| Test w katalogu tras | `app/.*\.test\.tsx` | `__tests__/` |

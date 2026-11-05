# Ruch i haptyka

Receptury są w `expo:expo-animation`. Tu jest wybór narzędzia.

## Drabinka Reanimated 4

Reanimated 4 działa tylko na New Architecture i wymaga `react-native-worklets`.

| Co się dzieje | Narzędzie |
|---|---|
| Zmiana stanu | CSS transition (`transitionProperty`) |
| Pętla, animacja przy montowaniu | CSS animation (`animationName` z keyframes) |
| Montowanie, odmontowanie | `entering`, `exiting`, `itemLayoutAnimation` |
| Gest, ciągła wartość | shared value |
| Nawigacja | natywne przejście stosu |

Bierzesz najniższy szczebel, który wystarcza. `transitionProperty: 'all'` istnieje, ale wymieniasz konkretne właściwości.

Pułapki:
- Krzywą podajesz helperem `cubicBezier(...)`, nie stringiem `'cubic-bezier(...)'`: Reanimated go odrzuca.
- `Color` i `PlatformColor` nie trafiają do stylów Reanimated.
- Z workletu do JS przechodzisz przez `scheduleOnRN` z `react-native-worklets`; `runOnJS` jest przestarzałe.
- `withSpring` ma w v4 inne domyślne parametry niż w v3.

Dokumentacja: https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/

## Gesty

RNGH 3: hooki `usePanGesture`, `useTapGesture` i kompozycja `useSimultaneousGestures`, `useExclusiveGestures`, `useCompetingGestures`. Builder API jest przestarzałe.

Dokumentacja: https://docs.swmansion.com/react-native-gesture-handler/docs/guides/upgrading-to-3/

## Reduced motion

`useReducedMotion` albo `ReduceMotion.System` w konfiguracji animacji. Zamiast ruchu dajesz natychmiastową zmianę, nie jej brak.

## Haptyka

| Zdarzenie | API `expo-haptics` |
|---|---|
| Zmiana wyboru | `selectionAsync` |
| Naciśnięcie | `impactAsync` (`Light`…`Rigid`) |
| Wynik | `notificationAsync` (`Success`, `Warning`, `Error`) |
| Android, wzorzec systemowy | `performAndroidHapticsAsync` zamiast `Vibrator` |

Na iOS haptyka nie działa w Low Power Mode ani przy aktywnej kamerze albo dyktowaniu, więc nie niesie jedynej informacji. `Switch` i datetimepicker mają ją wbudowaną.

Dokumentacja: https://docs.expo.dev/versions/latest/sdk/haptics/

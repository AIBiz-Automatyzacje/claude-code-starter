# Haptyka i gesty (Mobile)

Haptyka i gesty to dwie warstwy które odróżniają mobile od desktopu. Źle użyte są męczące lub mylące. Dobrze użyte — niewidoczne, ale brakuje ich gdy znikają. Things 3 i Linear Mobile to wzorce: haptyka tylko w momentach które **komunikują informację**, nigdy jako ozdoba.

Stack referencyjny: `expo-haptics` + `react-native-gesture-handler` (RNGH) — aktualny major **3.x** + `react-native-reanimated` — aktualny major **4.x** (3.x legacy, patrz [motion-microinteractions.md](motion-microinteractions.md)) + `react-native-worklets`. Na Expo SDK 58: `expo-haptics` ~58.0.7, RNGH ~3.3.0, Reanimated 4.7.1, Worklets 0.13.0.

---

## Filozofia haptyki: less is more

Haptyka działa najlepiej gdy user jej nie zauważa świadomie. Vibracja na każdy tap = po 2 minutach user wyłącza dźwięk i wibracje całego telefonu (badania UX z 2024-2025 pokazują że nadmierna haptyka jest #2 przyczyną "uninstall by friction" zaraz po pop-up notyfikacjach).

**Zasada:** haptyka komunikuje **outcome**, nie **action**. User klika button = action. Zapis się udał = outcome → haptyka.

> **Apple HIG (2025):** "Use haptics consistently with what users feel elsewhere on the system. Avoid overusing haptics — frequent vibrations diminish their impact and may annoy users."

---

## Kiedy używać haptyki

| Sytuacja | Typ | Dlaczego |
|----------|-----|----------|
| Confirm save / send / submit | Light impact | Subtelne potwierdzenie świadomej akcji |
| Confirm delete (destructive) | Medium impact | Mocniejszy sygnał wagi akcji |
| Long press activation | Light impact | "Aktywował się tryb" — feedback że gest złapał |
| Picker / slider snap to value | Selection | Każdy "snap" daje rytm przy przewijaniu |
| Segmented control change | Selection | Tab change w segmented |
| Drag-to-reorder grab | Light impact | "Złapałeś element" |
| Drag-to-reorder release | Light impact | "Element wpadł na miejsce" |
| Swipe-to-delete trigger | Medium impact | Akcja zaszła |
| Pull-to-refresh trigger | Light impact | Threshold osiągnięty |
| Success outcome (po async) | Notification.Success | Sygnał "zrobione" |
| Error outcome | Notification.Error | Sygnał "coś nie gra" |
| Warning (potwierdź usuń) | Notification.Warning | Konsekwencje |

## Kiedy NIE używać haptyki

| Sytuacja | Dlaczego |
|----------|----------|
| Tap na każdy button | Męczy, dewaluuje sygnał |
| Scroll | System już nie wibruje — user oczekuje ciszy |
| Wszystkie animacje | Animacja sama komunikuje, dublowanie jest szumem |
| Inbound notification (push, in-app) | System obsługuje to sam |
| Hover-like efekty | Mobile nie ma hover — nie wymyślaj odpowiednika |
| Loading | User nie potrzebuje wibracji że "ładujemy" |
| Każda zmiana stanu w formularzu | Pisanie z wibracją po każdym znaku = horror |

---

## API `expo-haptics`

```ts
import * as Haptics from 'expo-haptics';

// Impact — fizyczny "stuk"
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);    // delikatny
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);   // standard confirm
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);    // mocny — używaj rzadko
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);     // tłumiony — Android/iOS/Web
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);    // ostry — Android/iOS/Web

// Notification — outcome async operacji
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// Selection — picker, slider, segmented
Haptics.selectionAsync();

// Android-specific — pełen dostęp do natywnego haptic engine (np. gesture-based haptics)
Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm);
```

> Wszystkie funkcje są async i `Promise<void>`. Nigdy nie `await` w handlerze — fire-and-forget. Jeśli czekasz na haptykę, gubisz natychmiastowy feedback.

---

## Action → Haptic matrix

| Action | API | Variant |
|--------|-----|---------|
| Save / submit / send | `impactAsync` | `Light` |
| Confirm destructive | `impactAsync` | `Medium` |
| Long press activated | `impactAsync` | `Light` |
| Pull-to-refresh threshold | `impactAsync` | `Light` |
| Slider value change | `selectionAsync` | — |
| Picker scroll snap | `selectionAsync` | — |
| Segmented tab change | `selectionAsync` | — |
| Toggle on/off | `impactAsync` | `Light` |
| Success after async | `notificationAsync` | `Success` |
| Error after async | `notificationAsync` | `Error` |
| Warning modal trigger | `notificationAsync` | `Warning` |
| Drag start | `impactAsync` | `Light` |
| Drag drop | `impactAsync` | `Light` |
| Android — natywny haptic engine (precyzyjniejsze wzorce niż `impactAsync`) | `performAndroidHapticsAsync` | np. `AndroidHaptics.Confirm`, `.Reject`, `.Gesture_Start`, `.Drag_Start`, `.Toggle_On` |

---

## Platforma: iOS vs Android

**iOS Haptic Engine** (iPhone 7+) — pełny taptic support, precyzyjna kontrola intensywności i czasu. Wszystkie 3 typy (`impact`, `notification`, `selection`) działają jak opisane.

**Android** — różne urządzenia mają różne silniki wibracyjne. Niektóre flagowce (Pixel, Samsung S/Z series) mają precyzyjne haptic, większość ma podstawową wibrację. `expo-haptics` mapuje do `VibrationEffect` na Androidzie.

**Reguła degradacji:** projektuj haptykę jako "nice to have", nie "must have". User na low-end Android nie powinien być zdezorientowany jeśli haptyka jest słabsza/brakująca. Wszystko musi być zrozumiałe **bez** haptyki — haptyka to dodatkowy kanał komunikacji.

---

## Accessibility: respect Reduce Motion

iOS user z włączonym "Reduce Motion" prawdopodobnie chce też mniej haptyki. Nie ma osobnego API "reduce haptics" przed iOS 18 — używaj `isReduceMotionEnabled` jako proxy.

```ts
import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';

async function gentleConfirm(): Promise<void> {
  const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
  if (reduceMotion) return; // skip haptic
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
```

> **Wyjątek:** error/warning notifications zachowuj nawet przy reduce motion — to krytyczna komunikacja dla osób które mogły przegapić wizualny sygnał.

---

## Gesty natywne

`react-native-gesture-handler` (RNGH) 3.x opisuje gesty hookami z obiektem konfiguracji (`useTapGesture()`, `usePanGesture()` i pozostałe), pokazanymi niżej. Stary `PanResponder` z core RN — nie używaj, słabsza wydajność i brak natywnego wątku.

> **Nota v3:** hooki zastępują builder API (`Gesture.*`), które RNGH 3 oznacza jako przestarzałe. Callbacki zmieniają nazwy: `onStart` na `onActivate`, `onEnd` na `onDeactivate`, a `onChange` znika, bo `onUpdate` niesie też właściwości `change*`. Zamiast drugiego parametru `success` zdarzenie ma pole `canceled`. Relacji między gestami nie ustawisz w poprzek obu API, więc gesty w jednym układzie piszesz jednym stylem.

| Gest | API | Use case |
|------|-----|----------|
| Tap | `useTapGesture()` | Press buttonów (preferuj `Pressable` jeśli prosta akcja) |
| Long press | `useLongPressGesture()` | Context menu, drag-to-reorder grab |
| Pan | `usePanGesture()` | Swipe-to-delete, drawer, sheet, drag |
| Pinch | `usePinchGesture()` | Zoom obrazka, mapy |
| Swipe | `useFlingGesture()` | Swipe nawigacja |
| Native (system) | `useNativeGesture()` | Kompozycja z natywnym ScrollView |

---

## Pressable vs Touchable* — wybór

| Komponent | Status | Use |
|-----------|--------|-----|
| **`Pressable`** | Default 2026 | Wszystkie buttony, klikalne karty — preferowany |
| `TouchableOpacity` | Legacy | Stare projekty — migruj do Pressable |
| `TouchableWithoutFeedback` | Legacy | Bardzo rzadko (kiedy nie chcesz feedback) |
| `useTapGesture()` (RNGH) | Specjalistyczny | Gdy potrzebujesz kompozycji z innymi gestami |

`Pressable` daje:
- `onPress`, `onPressIn`, `onPressOut`, `onLongPress`
- `pressed` state (dla styling)
- `hitSlop` dla rozszerzenia obszaru tappable poza wizualne granice
- Współpraca z Reanimated (`Animated.createAnimatedComponent(Pressable)`)

---

## Gesture conflicts — kompozycja

Częsty problem: scroll lista zawiera swipeable rows. Gdy user przeciąga pionowo, ma scrollować. Gdy przeciąga poziomo, ma swipe'ować row. Domyślnie gesty się "kradną".

```tsx
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';

const panGesture = usePanGesture({
  activeOffsetX: [-10, 10], // poziomy pan dopiero po 10px
  failOffsetY: [-5, 5],     // jeśli pionowy ruch większy — fail i oddaj scrollowi
  onUpdate: (e) => {
    translateX.value = e.translationX;
  },
});
```

**Reguły kompozycji:**
- `activeOffsetX/Y` — kiedy gest zaczyna się aktywować
- `failOffsetX/Y` — kiedy gest oddaje kontrolę innemu
- `useSimultaneousGestures(g1, g2)` — oba mogą działać równocześnie (np. pinch + pan na obrazku)
- `useExclusiveGestures(g1, g2)` — tylko jeden naraz, priorytet według kolejności argumentów (g1 najwyższy)
- `useCompetingGestures(g1, g2)` — tylko jeden naraz, pierwszy aktywowany anuluje pozostałe
- `requireToFail: other` w konfiguracji — czeka aż inny gest sfailuje; relacje dopełniają `simultaneousWith` i `block`

---

## Pełny przykład: Pressable z haptyką

```tsx
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface HapticButtonProps {
  onPress: () => void | Promise<void>;
  children: React.ReactNode;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
}

export function HapticButton({
  onPress,
  children,
  haptic = 'light',
}: HapticButtonProps): React.JSX.Element {
  const scale = useSharedValue(1);

  const handlePress = async (): Promise<void> => {
    if (haptic !== 'none') {
      const style = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      }[haptic];
      Haptics.impactAsync(style); // fire-and-forget
    }
    await onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 100, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
      }}
      style={animatedStyle}
      accessibilityRole="button"
    >
      {children}
    </AnimatedPressable>
  );
}
```

---

## Pełny przykład: Swipeable row z delete

Wzorzec Things 3 / Mail.app — przesunięcie w lewo odsłania akcję delete.

```tsx
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

const SWIPE_THRESHOLD = -80;

interface SwipeableRowProps {
  onDelete: () => void;
  children: React.ReactNode;
}

export function SwipeableRow({ onDelete, children }: SwipeableRowProps): React.JSX.Element {
  const translateX = useSharedValue(0);
  const hasTriggered = useSharedValue(false);

  const triggerHaptic = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const panGesture = usePanGesture({
    activeOffsetX: [-10, 10],
    failOffsetY: [-5, 5],
    onUpdate: (e) => {
      translateX.value = Math.min(0, e.translationX);
      // haptic threshold trigger (raz na gest)
      if (!hasTriggered.value && e.translationX < SWIPE_THRESHOLD) {
        hasTriggered.value = true;
        scheduleOnRN(triggerHaptic);
      }
      if (hasTriggered.value && e.translationX > SWIPE_THRESHOLD) {
        hasTriggered.value = false;
      }
    },
    onDeactivate: (e) => {
      if (!e.canceled && e.translationX < SWIPE_THRESHOLD) {
        translateX.value = withTiming(-100);
        scheduleOnRN(onDelete);
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
      }
      hasTriggered.value = false;
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
```

> **Uwaga:** callback gestu działa jako worklet na UI thread, ale `Haptics.impactAsync` i `onDelete` muszą iść na JS thread, więc wołasz je przez `scheduleOnRN` z `react-native-worklets`. Bez tego — crash. Argumenty podajesz po funkcji: `scheduleOnRN(fn, arg)`. `runOnJS` z Reanimated jest przestarzałe, a `scheduleOnUI` analogicznie zastępuje `runOnUI`.
>
> **Dyrektywa `'worklet'`:** plugin Babela `react-native-worklets/plugin` sam oznacza callbacki podane wprost w konfiguracji hooka, więc w przykładach jej nie ma. Dopisujesz ją tylko w funkcji zdefiniowanej osobno i przekazanej przez referencję albo owiniętej w `useCallback` lub `useMemo`.

---

## Pełny przykład: Bottom sheet drag handle

```tsx
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

const SNAP_POINTS = [0, 300, 600];

export function BottomSheet({ children }: { children: React.ReactNode }): React.JSX.Element {
  const translateY = useSharedValue(SNAP_POINTS[1]);
  const startY = useSharedValue(0);

  const snapHaptic = (): void => {
    Haptics.selectionAsync();
  };

  const panGesture = usePanGesture({
    onActivate: () => {
      startY.value = translateY.value;
    },
    onUpdate: (e) => {
      translateY.value = Math.max(SNAP_POINTS[0], startY.value + e.translationY);
    },
    onDeactivate: (e) => {
      // znajdź najbliższy snap point
      const current = translateY.value + e.velocityY * 0.2;
      const closest = SNAP_POINTS.reduce((prev, curr) =>
        Math.abs(curr - current) < Math.abs(prev - current) ? curr : prev
      );
      translateY.value = withSpring(closest, { damping: 20, stiffness: 200 });
      scheduleOnRN(snapHaptic);
    },
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
```

---

## Powiązane

- [motion-microinteractions.md](motion-microinteractions.md) — animacja jako companion haptyki
- [accessibility-mobile.md](accessibility-mobile.md) — reduce motion + haptyka
- [polish-checklist.md](polish-checklist.md) — checklist haptyki

---

*Źródła: Apple HIG Haptics (developer.apple.com/design/human-interface-guidelines/playing-haptics), expo-haptics docs (docs.expo.dev/versions/latest/sdk/haptics), react-native-gesture-handler 3 docs (docs.swmansion.com/react-native-gesture-handler — domyślna wersja docs to 3.x; 2.x i 1.x są w archiwum pod `/docs/2.x/` i `/docs/1.x/`; migracja: guide *Upgrading to the new API introduced in Gesture Handler 3*, `/docs/guides/upgrading-to-3` — konfiguracja obiektem zamiast builderów, `onStart`→`onActivate`, `onEnd`→`onDeactivate`, relacje przez hooki `useSimultaneousGestures()`), Things 3 haptic teardown (Cultured Code blog), react-native-reanimated migration from 3.x (docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x), Linear Mobile UX patterns. Update: 2026-11-05.*

# Sheets & modals — overlays mobile

Bottom sheety, modale, popovery, alerty, toasty. Decision tree który overlay kiedy + implementation w Expo (`@expo/ui`, native iOS sheets, Gorhom, sonner-native).

---

## Czym to zaimplementować — kolejność wyboru

Ten dokument mówi **który overlay** i **jak ma się zachowywać** (to jest warstwa UX). O tym, **jakim
komponentem** go zbudować, decyduje skill **`expo:expo-ui`** — i tam jest źródło prawdy:

1. **`BottomSheet` z `@expo/ui`** — domyślny wybór dla sheetów. Prawdziwe SwiftUI / Jetpack Compose,
   od SDK 56+ działa w Expo Go bez custom builda. Sterowanie: `isPresented` / `onDismiss`,
   `snapPoints` przyjmuje `'half'`, `'full'`, `{ fraction }`, `{ height }`, ale dwie ostatnie formy
   działają dokładnie tylko na iOS i web: na Androidzie przyciągają do najbliższego z `'half'` / `'full'`.
2. **Native iOS sheet przez `expo-router`** — gdy sheet jest ekranem w nawigacji (detents, routing).
3. **`@gorhom/bottom-sheet`** — dopiero gdy potrzebujesz czegoś, czego `@expo/ui` nie daje (patrz
   sekcja „Gorhom Bottom Sheet" niżej), albo gdy migrujesz istniejącą integrację.

> **Nie buduj sheeta od zera na Reanimated.** Jeśli `@expo/ui` ma komponent, ręczna implementacja to
> praca wyrzucona i gorszy platform fit.

> **Pułapka przy przechodzeniu z gorhoma:** `BottomSheet` z `@expo/ui` **nie** przyjmuje `isOpen`,
> `isOpened`, `onIsOpenedChange` ani `onChange`. Podane tam **cicho nic nie zrobią** — sheet po prostu
> się nie otworzy, bez błędu. Używaj `isPresented` / `onDismiss`.

---

## Decision matrix — który overlay

| Overlay | Kiedy | Kiedy NIE |
|---------|-------|-----------|
| **System Alert** (`Alert.alert`) | Destructive confirm ("Usunąć konto?"), critical error który blokuje flow | Nice-to-know info, success notification, recoverable error |
| **Bottom sheet** | Selekcja z 5+ opcji, quick action menu, contextual preview, share | Multi-step form, krytyczne decyzje (alert), passive notification |
| **Modal full-screen** | Multi-step task (onboarding, checkout), heavy form, separate context (player, editor) | Pojedyncza akcja, info-only, < 2 pola formularza |
| **Modal sheet (iOS form)** | Średniej wielkości form (3-7 pól), settings sub-screen | Krótkie potwierdzenia |
| **Popover** | Quick info attached do trigger (tooltip+), small selection (color picker, mention list) | Główna nawigacja, > 5 opcji, mobile portrait (slabo działa) |
| **Toast / Snackbar** | Passive notification ("Skopiowano", "Wysłano"), undo affordance | Critical error wymagający akcji, blokująca decyzja |
| **Banner** | Persistent state ("Offline", "New version available"), wymaga uwagi przez czas | Single event notification (od tego jest toast) |

**Pryncypium hierarchii:** im bardziej blokujący overlay, tym ważniejsza musi być akcja. Alert blokuje wszystko → tylko gdy decyzja ma realne konsekwencje. Toast nie blokuje nic → dla "fyi" feedbacku.

---

## Bottom sheets — patterns

### Snap points

| Snap config | Kiedy |
|-------------|-------|
| **1 punkt (full)** | Single-purpose sheet — jeden ekran zadań |
| **2 punkty (peek + full)** | Lista akcji która może wymagać scrollowania (peek = 5 ostatnich, full = wszystko) |
| **3 punkty (peek + half + full)** | Apple Maps pattern — info → details → full content |

**Reguły dobrego snap:**

- **Peek (collapsed):** 25-35% wysokości ekranu — pokazuje że jest content do rozwinięcia
- **Half:** ~50-60% — wystarcza dla głównej zawartości bez full takeover
- **Full:** ~92% (zostaw 8% backdropu) — tap w backdrop = dismiss

**Drag handle:** rounded rectangle 36×4px, kolor `--muted-foreground` z 40% opacity. Nawet jeśli nie jest funkcjonalny — sygnał że "to się przesuwa".

### Backdrop

- **Standard:** `rgba(0,0,0,0.4)` — przyciemnienie, ale tło widać
- **Premium:** blur (iOS BlurView, Android shrunk + dim) — feel jak Apple Maps, kosztuje GPU
- **Tap dismiss:** prawie zawsze TAK. Wyjątek: destructive flow gdzie chcesz wymusić explicit decyzję

### Drag-to-dismiss

**Zawsze działa**, ALE plus widoczny przycisk dismiss (X w rogu lub Cancel). Powody:
- Accessibility — VoiceOver user nie zrobi gestu drag
- Discoverability — pierwszy raz user nie wie że można drag
- Predictability — nawyk z innych apek

### Klawiatura

Test: otwórz bottom sheet z TextInputem, focus inputa.

**Dwa zachowania:**

1. **Sheet pushes up:** sheet expanduje się powyżej klawiatury. Uwaga na default: w `@gorhom/bottom-sheet` domyślne `keyboardBehavior` to **`'interactive'`**, nie `'extend'` — rozciągnięcie do max snap pointa (`'extend'`) trzeba podać **jawnie** (trzecia opcja: `'fillParent'`). Na Androidzie do płynnego push-up ustaw `android_keyboardInputMode="adjustResize"` — default to `'adjustPan'`. Powiązany default: `keyboardBlurBehavior: 'none'`
2. **Sheet resize:** sheet zostaje na miejscu, content się skraca (gdy sheet ma scroll)

Test oba — jeden zwykle wygląda lepiej dla konkretnego content. Form heavy → resize. Quick input → push up.

---

## iOS native sheet (iOS 15+)

**Kiedy preferować nad Gorhom:**
- Prosty sheet (jeden snap point lub medium/large)
- Nie potrzebujesz custom backdrop / animacji
- Chcesz native swipe-down dismiss z OS gestem
- Zachowanie ma się czuć "system-native"

**Konfiguracja w expo-router:**

```tsx
// app/modal.tsx
export const unstable_settings = {
  presentation: 'modal',
};

// Lub w Stack.Screen
<Stack.Screen
  name="filter-sheet"
  options={{
    presentation: 'formSheet', // iOS sheet z detentami — WYMAGA formSheet, nie 'modal'
    sheetAllowedDetents: [0.5, 1], // liczby 0-1 (procent wysokości ekranu), NIE stringi 'medium'/'large'
    sheetGrabberVisible: true,
    sheetCornerRadius: 24,
  }}
/>
```

**Limitacje:** `formSheet` działa natywnie na **obu** platformach — na Androidzie od SDK 52 / RNS 4.0 przez `BottomSheetBehavior` (na iOS `UIModalPresentationFormSheet`). Ograniczenia Androida: maks. 3 detenty, brak wsparcia dla nagłówków native-stacka i zagnieżdżonych stacków wewnątrz form sheetu (`headerShown`, `title`, przyciski nagłówka nie wyrenderują się w sheecie). `sheetGrabberVisible` to opcja **iOS-only**.

---

## Gorhom Bottom Sheet

> **To jest ścieżka fallback, nie domyślna.** Najpierw sprawdź `BottomSheet` z `@expo/ui` (skill
> `expo:expo-ui`). Do gorhoma schodź tylko z konkretnego powodu z listy niżej — a przy istniejącej
> integracji rozważ drop-in `@expo/ui/community/bottom-sheet` zamiast pełnej zależności.

**Kiedy zejść do gorhoma:**
- Custom animacje, których uniwersalny `BottomSheet` nie wyraża (np. crossfade content między snap pointami)
- Custom backdrop (blur, gradient, interaktywne elementy w backdropie)
- Precyzyjne snap pointy na Androidzie, gdzie `@expo/ui` zna tylko `'half'` i `'full'`, oraz 3+ punkty poza tym zestawem
- Sheet jako trwała część layoutu strony, nie modal navigation
- Projekt na SDK < 56, gdzie warstwa uniwersalna `@expo/ui` jeszcze nie istnieje

**Performance:** backbone na Reanimated, native driver, 60fps. Główny narzut: setup boilerplate + provider w roocie.

> **Wersje:** `@gorhom/bottom-sheet` (5.2.14 na 08.2026) deklaruje peer `react-native-reanimated: ">=3.16.0 || >=4.0.0-"` oraz `react-native-gesture-handler >=2.16.1` — czyli wspiera **zarówno Reanimated 3.16+, jak i 4.x** (wsparcie dla v4 doszło w v5.1.8, 27.07.2025). Na projektach z New Architecture / Reanimated 4 trzymaj `@gorhom/bottom-sheet >= 5.1.8`.

**Boilerplate:**

```tsx
import { useRef, useMemo, useCallback } from 'react';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

export function FilterSheet({ onClose }: { onClose: () => void }) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) onClose();
  }, [onClose]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      handleIndicatorStyle={{ backgroundColor: '#9ca3af', width: 36 }}
      backgroundStyle={{ backgroundColor: '#ffffff' }}
    >
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}>
        {/* Content */}
      </BottomSheetView>
    </BottomSheet>
  );
}
```

**Pamiętaj:** `GestureHandlerRootView` w roocie aplikacji + `BottomSheetModalProvider` jeśli używasz modal API zamiast inline.

---

## Modal anti-patterns

| Anti-pattern | Dlaczego źle | Co zamiast |
|--------------|--------------|------------|
| **Modal w modalu** | Cognitive overload, user gubi się w stosie kontekstów | Stack navigation lub multi-step w jednym sheet |
| **Modal jako navigation** ("kliknij settings → modal") | Modal = side task, settings = primary destination | Stack screen, push/pop |
| **Required action bez dismiss** | User trapped — UX cardinal sin | Zawsze allow dismiss; jeśli akcja krytyczna, zablokuj feature do podjęcia decyzji ALE pozwól wyjść |
| **Error modal dla inline-fixable issue** | Przerywa flow gdy można pokazać error obok pola | Inline error text pod fieldem |
| **Modal z 1 button "OK"** | Marnowanie atencji — toast wystarczy | Toast/snackbar |
| **Modal full-screen na 2 polach** | Over-engineering, strata kontekstu | Bottom sheet medium |

---

## Alert design

System alert (`Alert.alert` w RN) renderuje native iOS alert / Android Material dialog. **Używaj system alertu** dla 95% przypadków — wygląda i działa jak user oczekuje.

**Anatomy:**

| Element | Reguła |
|---------|--------|
| **Title** | 1 linia, opisuje akcję ("Usunąć turniej?", nie "Uwaga!") |
| **Message** | 1-2 linie, konsekwencje ("Wszystkie statystyki zostaną utracone. Tej operacji nie można cofnąć.") |
| **Cancel button** | Zawsze, lewa strona iOS, "Anuluj" |
| **Action button** | Maksymalnie 1 destructive + 1 confirm. Łącznie nigdy więcej niż 3 buttony |
| **Destructive style** | iOS red, Android: nie wbudowane — użyj custom dialog albo akceptuj |

```tsx
import { Alert } from 'react-native';

function handleDelete() {
  Alert.alert(
    'Usunąć turniej?',
    'Wszystkie statystyki zostaną utracone. Tej operacji nie można cofnąć.',
    [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: deleteTournament },
    ],
  );
}
```

**Custom alert (np. branded):** akceptowalne TYLKO jeśli design system tego wymaga. Wtedy: zachowaj wszystkie reguły system alertu (max 3 buttony, focus trap, escape dismiss, backdrop dim).

---

## Toast / Snackbar

**Kiedy:** passive feedback po akcji ("Skopiowano", "Zapisano", "Usunięto z możliwością cofnięcia").

**Position:**
- iOS — top safe area (zgodnie z system notifications)
- Android — bottom (Material spec)
- Cross-platform pragmatic — top safe area dla wszystkiego, Expo SafeAreaView wyrównuje

**Duration:**

| Typ | Czas | Powód |
|-----|------|-------|
| Success short | 2s | "Skopiowano" — instant feedback |
| Success default | 3s | "Zapisano zmiany" |
| Info | 4s | "Synchronizacja w toku" |
| Error | 6s+ | User musi przeczytać, może zwykle nie spojrzał na ekran |
| Persistent z action | brak auto-dismiss | "Usunięto. Cofnij" — user musi zdecydować |

**Stack handling:** maksymalnie 1 toast widoczny jednocześnie, kolejne queue. Wyświetlanie 3 toastów na raz = chaos i gubienie informacji.

**Library:**

| Library | Plus | Minus |
|---------|------|-------|
| `sonner-native` | API jak Sonner web, działa premium, dobry default | Świeższa biblioteka, ekosystem mniejszy |
| `react-native-toast-message` | Sprawdzona, prosta, queueowanie | Mniej elegancki design out-of-box |
| Custom (Reanimated) | Pełna kontrola | Czas budowy + utrzymania |

```tsx
// sonner-native
import { toast } from 'sonner-native';

function handleSave() {
  // ... save logic
  toast.success('Zapisano zmiany', {
    duration: 3000,
  });
}

function handleDelete() {
  // optymistyczne usunięcie
  removeItem(id);
  toast('Usunięto element', {
    action: {
      label: 'Cofnij',
      onClick: () => restoreItem(id),
    },
    duration: 6000,
  });
}
```

---

## Modal presentation styles — iOS vs Android

| Presentation | iOS | Android |
|--------------|-----|---------|
| `'modal'` (default) | Page sheet — sliding from bottom, top scrim | Full-screen modal |
| `'fullScreenModal'` | Full-screen takeover, swipe down dismiss off | Full-screen, status bar override |
| `'formSheet'` | Centered card, dimmed backdrop (iPad-friendly) | Full-screen (no equivalent) |
| `'transparentModal'` | Transparent background, custom content | Transparent overlay |

**Mobile pragmatic default:** `presentation: 'modal'` w expo-router. Daje native iOS feel + sensowny Android fallback.

---

## Backdrop tap dismiss

**Almost always YES.** Wyjątki:

1. **Destructive confirmation** (alert delete) — wymuszamy explicit decyzję
2. **Onboarding mandatory step** — user musi przejść przez krok (rzadkie)
3. **Payment / signing flow** — nie chcesz aby przypadkowy tap zgubił dane

W każdym innym przypadku: tap w backdrop = dismiss = mental model jak iOS, jak web modale, jak alle apps.

---

## Code patterns

### Bottom sheet z Gorhom — full example

```tsx
import { useRef, useMemo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';

interface FilterSheetProps {
  isVisible: boolean;
  onClose: () => void;
}

export function FilterSheet({ isVisible, onClose }: FilterSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const renderBackdrop = useCallback(
    (props: Parameters<typeof BottomSheetBackdrop>[0]) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
      />
    ),
    [],
  );

  if (!isVisible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: '#9ca3af', width: 36, height: 4 }}
    >
      <BottomSheetView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-xl font-semibold">Filtruj</Text>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Zamknij"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
          >
            <X size={24} />
          </Pressable>
        </View>
        {/* filter content */}
      </BottomSheetView>
    </BottomSheet>
  );
}
```

### Native iOS sheet via expo-router

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="filter"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
        }}
      />
    </Stack>
  );
}

// app/filter.tsx
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

export default function FilterScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background px-6 pt-4">
      <Text className="text-xl font-semibold mb-4">Filtruj</Text>
      {/* content */}
    </View>
  );
}
```

### Toast trigger w action handler

```tsx
import { Pressable, Text } from 'react-native';
import { toast } from 'sonner-native';
import * as Clipboard from 'expo-clipboard';

export function CopyButton({ value }: { value: string }) {
  const handleCopy = async () => {
    await Clipboard.setStringAsync(value);
    toast.success('Skopiowano do schowka', { duration: 2000 });
  };

  return (
    <Pressable
      onPress={handleCopy}
      accessibilityLabel="Kopiuj"
      accessibilityRole="button"
      className="h-11 px-4 items-center justify-center rounded-lg bg-primary"
    >
      <Text className="text-primary-foreground">Kopiuj</Text>
    </Pressable>
  );
}
```

---

## Checklist — sheet/modal review

- [ ] Wybrałeś najlżejszy overlay który spełnia zadanie (toast > popover > sheet > modal > alert)
- [ ] Drag handle widoczny na bottom sheet
- [ ] Backdrop tap dismiss działa (chyba że destructive)
- [ ] Widoczny X / Cancel button (nie tylko gesture)
- [ ] Klawiatura nie zakrywa inputa (test focus na każdym polu)
- [ ] Toast na critical error? Zamień na alert lub inline error
- [ ] Modal z 1 buttonem? Zamień na toast
- [ ] Alert z 4+ buttonami? Zamień na bottom sheet z action list
- [ ] Status bar styled poprawnie pod modal (light/dark)
- [ ] `accessibilityViewIsModal={true}` na modalu (focus trap)
- [ ] Test escape gesture na iOS (swipe down)
- [ ] Test back button na Androidzie (powinien dismiss)

---

## Powiązane

- `[[icons.md]]` — close X button conventions
- `[[states-loading-empty-error.md]]` — error display: inline vs toast vs modal
- `[[platform-conventions.md]]` — iOS sheet vs Android bottom sheet
- `[[resources/forms-keyboard.md]]` — form w modal vs full-screen

---

## Źródła

- Apple HIG — Sheets, Alerts, Action Sheets (developer.apple.com/design/human-interface-guidelines/sheets)
- Material 3 — Bottom Sheets, Dialogs (m3.material.io/components/bottom-sheets, m3.material.io/components/dialogs)
- Gorhom Bottom Sheet (gorhom.github.io/react-native-bottom-sheet)
- expo-router — modal presentation (docs.expo.dev/router/advanced/modals)
- sonner-native (github.com/gunnartorfis/sonner-native)

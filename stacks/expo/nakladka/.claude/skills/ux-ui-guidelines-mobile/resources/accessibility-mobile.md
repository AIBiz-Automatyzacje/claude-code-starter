# Accessibility na Mobile

Accessibility to nie "feature for blind people" — to **good design for everyone**. Statystyka która zmienia perspektywę: ponad 1 mld ludzi ma jakąś formę disability, ale **65% iOS userów używa Dynamic Type** (Apple, 2024) — większość bez disability, po prostu chcą większego tekstu. A11y test = test czy twoja apka działa też dla 65% twojej user base'y.

WCAG 2.2 AA to baseline w 2026. European Accessibility Act egzekwuje od czerwca 2025 — apki bez a11y mogą być prawnie zablokowane na rynku EU.

Stack referencyjny: React Native a11y props + `AccessibilityInfo` (`expo-screen-reader` nie istnieje jako pakiet — screen reader detection i announcements idą przez `AccessibilityInfo` z `react-native`).

---

## WCAG 2.2 AA — krytyczne kryteria dla mobile

| Kryterium | Co znaczy | Implementacja |
|-----------|-----------|---------------|
| **1.4.3 Contrast (text)** | Tekst ≥ 4.5:1, large text ≥ 3:1 | Test każdego ekranu w kontraście |
| **1.4.4 Resize text** | Tekst skaluje 200% bez utraty funkcji | `allowFontScaling`, layout adapt |
| **1.4.10 Reflow** | Brak horizontal scroll przy zoom | Flex layout, no fixed widths |
| **1.4.11 Non-text contrast** | Ikony, bordery ≥ 3:1 | Outline na cards, icon visibility |
| **2.4.11 Focus Not Obscured** | Focus widoczny pełnie, nie pod barem | Sticky bar respect focus |
| **2.5.5 Target Size (AAA)** | 44×44pt rekomendowane | Min size buttonów |
| **2.5.8 Target Size (AA)** | Min 24×24 CSS px (WCAG; na mobile ≈ pt/dp) | Hard floor — nigdy mniej |
| **2.5.7 Dragging Movements** | Alternatywa dla drag | Single-tap option dla każdego drag |
| **3.3.7 Redundant Entry** | Nie wymagaj dwukrotnego wpisania danych | Autofill, persisted state |
| **3.3.8 Accessible Authentication** | Brak puzzle CAPTCHA dla a11y | Biometric, magic link, passkey |

**Touch target hard rules:**
- iOS: 44pt minimum (Apple HIG)
- Android: 48dp minimum (Material 3)
- WCAG 2.2 AA: 24×24 CSS px absolute floor (na mobile ≈ pt/dp)
- **Cel praktyczny:** **44pt iOS / 48dp Android dla wszystkich primary actions**

---

## React Native a11y props

| Prop | Co robi | Przykład |
|------|---------|----------|
| `accessible` | Grupuje children jako jeden a11y element | `<View accessible>...</View>` |
| `accessibilityLabel` | **Co to jest** (krótko, rzeczowo) | `"Przycisk usuń"` |
| `accessibilityHint` | **Co się stanie po akcji** (uzupełnienie) | `"Usuwa zadanie z listy"` |
| `accessibilityRole` | Semantyczna rola | `"button"`, `"link"`, `"header"`, `"image"` |
| `accessibilityState` | Aktualny stan | `{ selected, disabled, expanded, busy, checked }` |
| `accessibilityValue` | Wartość (slider, progress) | `{ min: 0, max: 100, now: 42 }` |
| `accessibilityElementsHidden` | Ukryj przed VoiceOver (iOS) | `true` dla decorative |
| `importantForAccessibility` | Android odpowiednik | `"yes"` / `"no"` / `"no-hide-descendants"` |
| `accessibilityLiveRegion` | Auto-ogłoszenie zmiany (Android) | `"polite"` lub `"assertive"` |
| `accessibilityActions` | Custom actions (rotor, swipe) | `[{ name: 'delete', label: 'Usuń' }]` |

### Label vs Hint — różnica

```tsx
// Label = co to jest (always)
// Hint = co się stanie (uzupełnienie, opcjonalne)
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Usuń zadanie"
  accessibilityHint="Trwale usuwa zadanie z listy"
  onPress={handleDelete}
>
  <TrashIcon />
</Pressable>
```

> **Reguła:** label musi być sam wystarczający. Hint to tylko uzupełnienie — nie wszyscy screen readerzy go czytają (default iOS — czytany; Android — opcjonalne).

---

## VoiceOver (iOS)

VoiceOver czyta elementy w **kolejności drzewa** komponentów (top-to-bottom, left-to-right w LTR). Najczęstsze błędy:

**Reading order broken** — elementy w `position: absolute` mogą być czytane przed elementami "wyżej" wizualnie. Rozwiązanie: `accessibilityViewIsModal` + group przez `accessible` lub re-order w drzewie.

**Custom actions dla swipe gestures** — VoiceOver user nie zrobi swipe-to-delete fizycznie. Daj custom action:

```tsx
<View
  accessible
  accessibilityActions={[
    { name: 'delete', label: 'Usuń' },
    { name: 'archive', label: 'Archiwizuj' },
  ]}
  onAccessibilityAction={(e) => {
    if (e.nativeEvent.actionName === 'delete') handleDelete();
    if (e.nativeEvent.actionName === 'archive') handleArchive();
  }}
>
  <TaskRow />
</View>
```

**Rotor** — VoiceOver user może nawigować po nagłówkach, linkach, formach. Ustaw `accessibilityRole="header"` na sekcjach, `"link"` na nawigacyjnych elementach, `"button"` na akcjach.

---

## TalkBack (Android)

Różnice vs VoiceOver:
- Linear nav by default (swipe right = next element)
- Brak rotora — używa "Reading controls" gesture
- `accessibilityHint` często skipowany — wszystko ważne musi być w `accessibilityLabel`
- `accessibilityLiveRegion` natywny (nie ma na iOS — używaj `AccessibilityInfo.announceForAccessibility`)

```tsx
<Text
  accessibilityLiveRegion="polite" // Android — auto-ogłosi gdy text się zmieni
  accessibilityRole="alert"
>
  {errorMessage}
</Text>
```

---

## Dynamic Type — krytyczna funkcja

**65% iOS userów ma niestandardowy rozmiar tekstu.** Apka która ignoruje Dynamic Type wygląda dla nich źle.

**Reguła:** `allowFontScaling` jest `true` domyślnie — **nie wyłączaj go** chyba że masz konkretny powód (np. design w Figma operuje na fixed pt i nie pozwala na flex).

### Cap dla extreme sizes

`maxFontSizeMultiplier` — przy ekstremalnych rozmiarach (XXL, XXXL) layout może się rozpaść. Sensowny cap: **1.5-2.0x**.

```tsx
<Text
  allowFontScaling
  maxFontSizeMultiplier={1.5}
  style={styles.body}
>
  Treść
</Text>
```

### Layout adaptacji

Przy dużym Dynamic Type, **zmień row → column**:

```tsx
import { useWindowDimensions } from 'react-native';

const { fontScale } = useWindowDimensions();
const isLargeText = fontScale > 1.3;

<View style={{ flexDirection: isLargeText ? 'column' : 'row' }}>
  <Avatar />
  <Text>Long username...</Text>
</View>
```

**Test każdego ekranu na "Extra Extra Large" (XXXL)** w iOS Settings → Accessibility → Display & Text Size → Larger Text. To nie edge case — to realny user.

---

## Color blindness

8% mężczyzn i 0.5% kobiet ma jakąś formę color blindness (najczęściej deuteranopia — czerwony/zielony). Najczęstszy błąd: status komunikowany **tylko kolorem**.

```tsx
// Bad — color only
<Text style={{ color: status === 'error' ? 'red' : 'green' }}>{message}</Text>

// Good — color + icon + text
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  {status === 'error' ? <ErrorIcon /> : <CheckIcon />}
  <Text style={{ color: status === 'error' ? 'red' : 'green' }}>
    {status === 'error' ? 'Błąd: ' : 'Sukces: '}
    {message}
  </Text>
</View>
```

**Reguły:**
- Nie polegaj na kolorze samym — dodaj ikonę, tekst, pattern
- Unikaj red-green jako jedynej różnicy (worst case dla deuteranopia)
- Test: Stark plugin (Figma), Sim Daltonism (macOS), iOS Color Filters (Settings → Accessibility)

---

## Reduce Motion

Patrz [motion-microinteractions.md](motion-microinteractions.md) — sekcja Reduce Motion. Quick check:

```tsx
import { AccessibilityInfo } from 'react-native';

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
    setReduceMotion(enabled);
  });
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
  return () => sub.remove();
}, []);
```

**Co wyłączać:** decorative entrances, parallax, stagger.
**Co zachować:** state change feedback (skróć do 0-100ms zamiast usuwać).

---

## Reduce Transparency

iOS Liquid Glass / Material You glass effects są piękne, ale nie-czytelne dla części userów. **`isReduceTransparencyEnabled` to iOS-only API** — Android nie ma odpowiadającego systemowego toggle'a ani `AccessibilityInfo` API dla transparency. Na Androidzie fallback jest projektowy: domyślnie solid surfaces zamiast rely na runtime detection.

`backdropFilter` (web CSS) **nie istnieje w `ViewStyle` React Native** — nie renderuje blur, tylko cicho nic nie robi. Blur na natywie idzie przez `expo-blur` (`BlurView`), które renderuje prawdziwy natywny blur i (jak w tabeli niżej) samo respektuje Reduce Transparency.

> **Powierzchnie Liquid Glass ≠ zwykły blur.** Od iOS 26 dedykowanym modułem SDK jest **`expo-glass-effect`** (`GlassView`, `GlassContainer` do łączenia wielu szklanych warstw w jeden efekt) — natywny efekt szkła z automatycznym fallbackiem do zwykłego `View` na iOS < 26 i na platformach bez wsparcia. Dostępność sprawdzasz przez `isLiquidGlassAvailable()` (czy Liquid Glass jest wkompilowany w apkę) oraz `isGlassEffectAPIAvailable()` (czy API jest dostępne w runtime — zabezpieczenie przed crashem na części bet iOS 26). Wspierane: iOS, tvOS, Expo Go. `expo-blur` zostaje dla zwykłego blur cross-platform (Android: RenderNode od SDK 31 przez `experimentalBlurMethod`).
>
> Pamiętaj o drugim wektorze a11y obok Reduce Transparency: **od iOS 27 użytkownik sam reguluje intensywność przezroczystości Liquid Glass suwakiem** (Settings → Appearance → Liquid Glass). Nie zakładaj domyślnego ustawienia — czytelność testuj w obu skrajnościach suwaka.

```tsx
import { AccessibilityInfo } from 'react-native';
import { BlurView } from 'expo-blur';

const [reduceTransparency, setReduceTransparency] = useState(false);

useEffect(() => {
  // iOS-only — na Androidzie zawsze false, projektuj solid fallback jako default
  AccessibilityInfo.isReduceTransparencyEnabled?.().then(setReduceTransparency);
}, []);

{reduceTransparency ? (
  <View style={[styles.surface, { backgroundColor: '#FFFFFF' }]}>
    {children}
  </View>
) : (
  <BlurView intensity={40} tint="light" style={styles.surface}>
    {children}
  </BlurView>
)}
```

> **Uwaga:** `BlurView` sam już respektuje Reduce Transparency systemowo (patrz tabela niżej — "Zero" odpowiedzialności). Manualny branch powyżej jest przydatny TYLKO gdy chcesz custom solid fallback (inny kolor niż systemowy default) — jeśli wystarczy Ci zachowanie systemowe, wystarczy sam `<BlurView>` bez warunku.

### Natywne API vs custom — KTO odpowiada za fallback

**To jest praktyczna decyzja, którą każdy mobile dev powinien zrozumieć przed wyborem implementacji glass/blur effects.**

| Implementacja | Toggle "Reduce Transparency" | Twoja odpowiedzialność |
|---------------|------------------------------|------------------------|
| **Natywne Apple API** (`UIVisualEffectView` przez `expo-blur` `BlurView`) | **System auto-handluje** — zamienia na solid surface przy włączonym toggle | Zero — używasz native, dostajesz fallback za darmo |
| **Natywne Liquid Glass modifier** (Expo UI / SwiftUI `.glassBackgroundEffect()`) | **System auto-handluje** — Apple egzekwuje accessibility automatycznie | Zero |
| **Custom implementacja** (rgba + manual blur, web-style backdrop-filter, custom shaders) | **NIE jest auto-handlowane** — toggle nie zna twojego custom kodu | **TY musisz** wykryć `isReduceTransparencyEnabled` i renderować solid alternative |

**Praktyczna konsekwencja:**

- **Jeśli używasz `expo-blur` `BlurView`** → możesz zignorować ten kod, system robi za ciebie. To powód #1 dlaczego warto preferować native API nad custom implementacjami glass/blur.
- **Jeśli używasz custom rgba + blur** (najczęstszy scenariusz w cross-platform RN) → MUSISZ napisać fallback jak w przykładzie powyżej. Brak fallbacku = naruszenie WCAG 2.2 + złe doświadczenie dla low-vision userów.
- **Jeśli używasz Liquid Glass przez Expo UI / SwiftUI** → identycznie jak natywne API, system handluje fallback za ciebie.

**Reguła:** za każdym razem, gdy widzisz `rgba()` z alpha < 1.0 LUB `backdropFilter: 'blur(...)'` w kodzie, **sprawdź czy ten widok ma fallback dla Reduce Transparency**. Jeśli nie — dodaj. To jest najczęstsze niedopatrzenie a11y w premium-looking apkach.

---

## Bold Text (iOS)

iOS user może włączyć Bold Text systemowo. System fonts (San Francisco) automatycznie się dostosowują. Custom fonts — musisz ręcznie load wariantu Bold i podmienić.

```tsx
const [boldText, setBoldText] = useState(false);

useEffect(() => {
  AccessibilityInfo.isBoldTextEnabled?.().then(setBoldText);
}, []);

<Text style={{ fontFamily: boldText ? 'Inter-Bold' : 'Inter-Regular' }}>
  {text}
</Text>
```

**Reguła:** preferuj system font (San Francisco / Roboto) dla body text. Custom fonts tylko dla hero / brand moments.

---

## Screen reader announcements (dynamic updates)

Gdy stan ekranu zmienia się asynchronicznie (toast pojawia się, error się aktualizuje), screen reader sam **nie zauważy**. Wymuś ogłoszenie:

```tsx
import { AccessibilityInfo, findNodeHandle } from 'react-native';

// iOS — programmatic announcement
AccessibilityInfo.announceForAccessibility('Zadanie zapisane');

// Android — live region (preferowane)
<Text accessibilityLiveRegion="polite">{statusMessage}</Text>
```

**`polite` vs `assertive`:**
- `polite` — czeka aż screen reader skończy aktualne czytanie (default)
- `assertive` — przerywa natychmiast (tylko krytyczne — error, alert)

---

## Custom controls — slider z proper labels

Custom slider/picker musi pokazać screen readerowi swój stan:

```tsx
import { Pressable, View } from 'react-native';

interface CustomSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onChange: (value: number) => void;
}

export function CustomSlider({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: CustomSliderProps): React.JSX.Element {
  const increment = (): void => onChange(Math.min(max, value + step));
  const decrement = (): void => onChange(Math.max(min, value - step));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[
        { name: 'increment', label: 'Zwiększ' },
        { name: 'decrement', label: 'Zmniejsz' },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') increment();
        if (e.nativeEvent.actionName === 'decrement') decrement();
      }}
    >
      {/* Visual slider rendering */}
    </View>
  );
}
```

`accessibilityRole="adjustable"` powoduje że screen reader oferuje swipe up/down (iOS) lub volume keys (Android) do zmiany wartości.

---

## Common mistakes

| Błąd | Co się dzieje | Fix |
|------|--------------|-----|
| Decorative image bez `accessible={false}` | Screen reader czyta "image" za każdym razem | `accessible={false}` lub `accessibilityElementsHidden` |
| Icon button bez `accessibilityLabel` | "Button" — user nie wie co kliknie | Dodaj label opisowy |
| Touch target < 44pt | A11y user nie trafia | `hitSlop` lub powiększ wizualnie |
| Modal bez focus trap | Screen reader czyta tło modala | `accessibilityViewIsModal` + manualne focus |
| Loading state bez announcement | User nie wie że trwa | `aria-live="polite"` (Android) + `AccessibilityInfo.announceForAccessibility` (iOS) |
| Form error tylko czerwoną ramką | A11y user nie widzi | `accessibilityLabel` + role alert |
| `accessibilityHint` zawiera label | Powtórzenie | Hint = uzupełnienie, nie duplikat |
| Custom button na `View` | Brak default a11y | Użyj `Pressable` + `accessibilityRole="button"` |
| Animacja bez reduce motion | A11y user choruje | Sprawdź `isReduceMotionEnabled` |
| Color contrast < 4.5:1 | Niewidoczny tekst | Sprawdź kontrast każdego foreground/background |

---

## Pełny przykład: accessible Button

```tsx
import { Pressable, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AccessibleButtonProps {
  onPress: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}

export function AccessibleButton({
  onPress,
  label,
  hint,
  disabled,
  loading,
  destructive,
  children,
}: AccessibleButtonProps): React.JSX.Element {
  const scale = useSharedValue(1);

  const handlePress = (): void => {
    Haptics.impactAsync(
      destructive ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        if (disabled || loading) return;
        scale.value = withTiming(0.96, { duration: 100, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
      }}
      disabled={disabled || loading}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        animatedStyle,
        { minHeight: 44, minWidth: 44 }, // touch target
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {children}
    </AnimatedPressable>
  );
}
```

---

## Testing checklist (PRZED merge)

1. **VoiceOver na realnym iOS device** (nie symulator — symulator kłamie z timingiem)
2. **TalkBack na realnym Android device** (różne urządzenia różnie się zachowują)
3. **Dynamic Type na XXXL** — czy layout nadal działa, czy są obcięcia
4. **Reduce Motion ON** — czy core flow nadal komunikuje stan
5. **Reduce Transparency ON** — czy tekst nadal czytelny
6. **Bold Text ON** — czy custom fonts adaptują
7. **Color contrast każdego ekranu** — Stark plugin, Apple Accessibility Inspector
8. **Touch target audit** — wszystkie tappable ≥ 44pt iOS / 48dp Android
9. **Keyboard navigation** (jeśli external keyboard) — focus visible, focus order sensowny
10. **Empty / loading / error states** — czy screen reader ogłasza zmiany

---

## Powiązane

- [motion-microinteractions.md](motion-microinteractions.md) — reduce motion patterns
- [haptics-gestures.md](haptics-gestures.md) — haptic + a11y proxy
- [polish-checklist.md](polish-checklist.md) — a11y w checklist polish

---

*Źródła: Apple Accessibility Programming Guide (developer.apple.com/accessibility), Android Accessibility Developer Guide (developer.android.com/guide/topics/ui/accessibility), React Native Accessibility (reactnative.dev/docs/accessibility), W3C WCAG 2.2 (w3.org/WAI/WCAG22 — nadal aktualna W3C Recommendation z 12.12.2024), Apple Dynamic Type usage stats (WWDC 2023, 2024), WWDC 2026 / iOS 27 (rewizja Liquid Glass + użytkowniczy suwak przezroczystości), expo-glass-effect docs (docs.expo.dev/versions/latest/sdk/glass-effect). Update: 2026-11-05.*

# Motion & Microinteractions (Mobile)

Animacje na mobile nie są dekoracją — komunikują zmianę stanu, kierunek nawigacji i hierarchię. Każda animacja musi odpowiadać na pytanie: **co ona komunikuje?** Jeśli odpowiedź to "wygląda fajnie" — usuń ją.

Stack referencyjny: `react-native-reanimated` + `Easing` z `react-native`. Pryncypia są platform-agnostic.

> **Ten plik odpowiada na „czy i co animować".** Gdy wiesz już, że animujesz — implementację prowadzi
> skill **`expo:expo-animation`** (wybór wątku, worklety, handoff gestu, degradacja na słabszym
> urządzeniu). A jeśli animacja miałaby być sheetem, pickerem, sliderem albo togglem — **nie pisz jej
> ręcznie**: sprawdź `expo:expo-ui`, bo `@expo/ui` daje gotowy komponent natywny.

> **Wersja:** aktualny major to **Reanimated 4.x** — wymaga New Architecture (Fabric; docs: *„Reanimated 4 works only with the React Native New Architecture"*). **3.x to linia legacy** (Old Architecture) — wg oficjalnej dokumentacji **nie jest już aktywnie utrzymywana** (*„you can use Reanimated in version 3 (which is no longer actively maintained)"*); używaj jej wyłącznie w projektach przed migracją na New Architecture, a samą migrację na 4.x traktuj jako domyślny kierunek. Stan npm i Expo SDK 58: `latest` = 4.7.1 (wymaga RN 0.86–0.88 i `react-native-worklets` 0.13.x), tag `reanimated-3` = 3.19.5. Nazwy API animacji (`withTiming`, `withSpring`, `Easing`, `useSharedValue`) są wspólne dla 3.x i 4.x, ale `withSpring` w 4.x zachowuje się inaczej: ma nowe domyślne parametry, `duration` oznacza czas odczuwany (faktyczny to 1,5 × `duration`), a `energyThreshold` zastępuje `restDisplacementThreshold` i `restSpeedThreshold`. Stare wartości domyślne daje `Reanimated3DefaultSpringConfig`. Przykłady w tym pliku są pisane pod 4.x.

---

## Filozofia

Apple HIG i Material 3 zgadzają się w jednym: animacja istnieje aby **redukować poznawcze obciążenie**, nie zwiększać je. Trzy zadania motion:

1. **Orient** — pokaż gdzie znalazł się user po nawigacji (slide z prawej = idziemy w głąb, modal z dołu = nakładka)
2. **Confirm** — potwierdź że akcja zaszła (toggle, checkbox, save)
3. **Connect** — pokaż relację między elementami (shared element, expand from card)

Animacja która nie robi żadnej z tych trzech rzeczy — jest ozdobą. Na liście Things 3, Linear Mobile, Bear ozdoby pojawiają się **rzadko i krótko**.

> **Reguła:** jeśli usuniesz animację i user nadal rozumie co się stało, animacja była zbędna lub za długa.

---

## Decision framework — czy animować?

| Sytuacja | Animuj? | Czas | Patrz |
|----------|---------|------|-------|
| State change (toggle, checkbox, expand) | Tak | 150-250ms | timing matrix |
| Navigation (push, modal, tab) | Tak | 250-350ms | timing matrix |
| Press / tap feedback | Tak | 100-150ms | scale on press |
| Loading (>300ms) | Tak | continuous | skeleton/spinner |
| Inbound notification badge | Tak (krótko) | 200ms | subtle pulse |
| Element pojawia się raz przy mount | Może — jeśli waga | 200-400ms | enter animation |
| Każdy element listy fade-in przy scrollu | NIE | — | dystrakcja |
| Hover ozdoba (mobile nie ma hover) | NIE | — | — |
| "Wygląda profesjonalnie" | NIE | — | — |

---

## Timing matrix

Mobile ma inny budget czasu niż desktop. User czeka na feedback, ale nie chce czekać na animację. Bazowe wartości oparte o Material Motion (M3) i Apple HIG Motion (2025).

| Kategoria | Czas | Use case |
|-----------|------|----------|
| **Micro** | 100-150ms | Toggle, ripple, color change, checkbox, switch, tab indicator |
| **Standard** | 200-300ms | Expand/collapse, fade in/out, slide-in row, drawer open |
| **Slow** | 400-600ms | Page transition złożona, modal z bottom sheet, hero entrance |
| **Storytelling** | 600-1200ms | Onboarding intro, success celebration, splash → home |

**Hard limit dla default interaction: 600ms.** Powyżej user czuje opóźnienie. Wyjątek: świadome storytelling (pierwszy onboarding ekran). Apple HIG zaleca 200-500ms jako "zone of natural feel".

---

## Easing — wybór krzywej

Easing komunikuje fizykę. Złe easing = element wygląda jak się ślizga, klei lub szarpie.

| Easing | Reanimated | Kiedy |
|--------|------------|-------|
| **ease-out** (decelerate) | `Easing.out(Easing.cubic)` | Wchodzące elementy — szybko start, wolno koniec (~80% przypadków) |
| **ease-in** (accelerate) | `Easing.in(Easing.cubic)` | Wychodzące elementy — wolno start, szybko koniec, znika z drogi |
| **ease-in-out** (standard) | `Easing.inOut(Easing.cubic)` | Toggle, slide back-and-forth, między dwoma pozycjami |
| **linear** | `Easing.linear` | Tylko ciągłe — loading bar, infinite scroll, progress |
| **spring** | `withSpring({ damping, stiffness })` | Naturalny ruch — drag release, bounce-back, drawer snap |

**Default 80% przypadków: `ease-out`.** Wchodząca treść hamuje przy końcu — to czuje się "premium" bo imituje fizykę masy.

> **Anty-pattern:** `Easing.linear` na enter animation. Element wygląda jakby został "wciśnięty" do widoku.

### Spring configs (Reanimated)

```ts
// Subtle UI snap (toggle, expand) — nie skacze, czuje się responsywnie
withSpring(targetValue, { damping: 20, stiffness: 200 });

// Drag release (sheet, swipe-back) — natural feel
withSpring(targetValue, { damping: 18, stiffness: 150 });

// Bouncy (use rzadko — np. success celebration)
withSpring(targetValue, { damping: 8, stiffness: 100 });
```

### Android 17 — rozszerzenie Material 3 Expressive

Android 17 (stabilny 16.06.2026, API 37) pcha M3 Expressive dalej: obok spring-based motion tokens (`standard` / `expressive` motion scheme zamiast ręcznego doboru krzywych) system rozlewa **blur i translucencję** poza notyfikacje i quick settings (dodane w Android 16 QPR1) — na suwak i panel głośności, power menu, widget picker, menu launchera oraz **przejścia startu aplikacji**.

Co z tego wynika dla ruchu w Twojej apce:
- **Przejścia wchodzące na Androidzie mają dziś systemowe tło z blur** — jeśli sam animujesz własny overlay pod launch/menu, uważaj, żeby nie dublować efektu (ten sam błąd co statyczne cienie na ikonie Liquid Glass — patrz [[app-icon-splash.md]])
- **Kontrast tekstu na animowanych warstwach półprzezroczystych** to teraz problem po obu stronach, nie tylko na iOS — patrz [[color-darkmode.md]]
- Nazwy schematów `standard` / `expressive` są poprawne, ale w stabilnym `androidx.compose.material3` 1.4.0 API expressive żyją jeszcze za opt-inem — szczegóły w [[platform-conventions.md]]

---

## Stagger pattern

Lista elementów wchodząca naraz = chaos. Lista wchodząca jeden po drugim z `withDelay` = porządek wizualny.

**Reguły:**
- Delay 30-50ms per element (50ms domyślny)
- Max 6-8 elementów — powyżej cumulative delay (`8 × 50ms = 400ms`) jest zbyt długi
- Powyżej 8 elementów: animuj **pierwsze 6-8 widocznych**, reszta pojawia się instant przy scrollu

```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

function StaggeredItem({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const delay = Math.min(index, 7) * 50; // cap stagger
    opacity.value = withDelay(delay, withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) }));
  }, [index]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
```

---

## Press feedback — scale 0.96

Każdy interaktywny element musi pokazać że został naciśnięty. Standard: scale do `0.96`. Nigdy poniżej `0.95` (wygląda przesadnie). Subtelny wariant: `0.98` (dla drobnych elementów typu icon button).

**Czas: 100-150ms ease-out** w obie strony. Spring tylko dla "zabawnych" akcji — domyślnie timing.

```tsx
import { Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableButton({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 100, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
      }}
      onPress={onPress}
      style={animatedStyle}
    >
      {children}
    </AnimatedPressable>
  );
}
```

> **Uwaga:** użyj CSS-like timing (nie spring) dla press, bo user może puścić w trakcie animacji. Timing-based animacje są **przerywalne** — spring nie zawsze.

---

## Shared element transitions

> **Status: eksperymentalny, not recommended for production.** W Reanimated 4 Shared Element Transitions działają na New Architecture (Fabric) dopiero od **4.2.0**, i to za feature flagą (`ENABLE_SHARED_ELEMENT_TRANSITIONS`) — ze znanymi crashami i ograniczeniami. Traktuj `sharedTransitionTag` jako preview feature, nie stabilne API — testuj dokładnie przed użyciem w production flow.

Reanimated ma wsparcie dla shared element transitions przez `sharedTransitionTag`. Używaj gdy ten sam element pojawia się na dwóch ekranach (avatar w liście → avatar w detailu, zdjęcie produktu w gridzie → na detail page).

```tsx
import Animated from 'react-native-reanimated';

// Screen A — list
<Animated.Image source={...} sharedTransitionTag={`avatar-${user.id}`} />

// Screen B — detail
<Animated.Image source={...} sharedTransitionTag={`avatar-${user.id}`} />
```

**Kiedy używać:**
- Element ma fizyczną tożsamość (zdjęcie, awatar, karta)
- Przejście wzbogaca rozumienie hierarchii (skąd przyszedłem, dokąd wracam)

**Kiedy NIE:**
- Tekstowe nagłówki (rzadko mają tę samą rolę między ekranami)
- Listy elementów które się zmieniają

Performance: shared transitions kosztują — używaj 1-2 na ekran max.

---

## CSS animations i transitions w Reanimated 4

Reanimated 4 ma też deklaratywne animacje i przejścia w stylu CSS na komponentach `Animated`, bez shared values. Przy prostej zmianie stanu to często mniej kodu niż `useAnimatedStyle`.

```tsx
// Transition: animuje zmianę wskazanej właściwości stylu
<Animated.View
  style={{
    opacity: isVisible ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: 300,
  }}
  onCSSTransitionEnd={(event) => console.log(event.propertyName)}
/>

// Animation: keyframes w stylu
<Animated.View
  style={{
    animationName: { '100%': { transform: [{ translateX: 100 }] } },
    animationDuration: '300ms',
  }}
  onCSSAnimationEnd={handleEnd}
/>
```

Callbacki `onCSSAnimation*` i `onCSSTransition*` są propsami komponentu, nie częścią `style`. Klasy `transition-*` i `animate-*` w `className` to funkcja Uniwind Pro; szablon używa wersji Free, więc te właściwości podajesz w `style`.

---

## Anti-patterns

| Anty-pattern | Dlaczego źle | Co zamiast |
|--------------|--------------|------------|
| Animowanie `width` / `height` / `top` / `left` | Wymusza layout pass = jank | Tylko `transform` + `opacity` |
| Animacja > 600ms na default interaction | User czuje opóźnienie | Skróć do 300-400ms |
| Wszystkie elementy ekranu animują naraz | Chaos, brak hierarchii | Stagger 50ms |
| Bounce spring na confirm button | Wygląda dziecięco | Timing 150ms ease-out |
| Animacja na każdy mount listy podczas scrolla | Distrakcja | Initial render staggered, reszta instant |
| `transitionProperty: 'all'` (Reanimated 4 to ma, dokumentacja odradza) | Animuje rzeczy które nie powinny, grozi problemami z wydajnością | Specyficzne properties |
| Spring na destructive action confirm | "Confirm delete" nie powinno być wesołe | Subtle timing fade |
| `useNativeDriver: false` bez powodu | Animacja przez JS thread = jank | Domyślnie native driver (Reanimated robi to automatycznie) |

---

## Performance — co animować, czego nie ruszać

GPU może animować bez jank tylko **transform i opacity**. Wszystko inne wymusza layout pass i powoduje spadki FPS.

| Property | GPU? | Uwaga |
|----------|------|-------|
| `transform: translateX/Y` | Tak | Default choice |
| `transform: scale` | Tak | Press feedback |
| `transform: rotate` | Tak | Loading spinner |
| `opacity` | Tak | Fade in/out |
| `width` / `height` | NIE | Layout reflow — unikaj |
| `backgroundColor` | Częściowo | OK przy małych elementach, jank na full screen |
| `borderRadius` | NIE | Layout w niektórych engine'ach |
| `shadow*` (iOS) / `elevation` (Android) | NIE | Performance trap |
| `blur` (filter) | Częściowo | iOS lepiej, Android może laggować |

**60fps mandatory.** Spadki FPS najczęściej z:
- Layout animation (animate width, padding, margin)
- Złożone shadow/blur na scroll
- Re-render React komponentu w trakcie animacji (animuj przez `useSharedValue`, nie `useState`)

---

## Reduce Motion (accessibility)

iOS i Android mają systemowy toggle "Reduce Motion". 65% iOS userów ma jakiś accessibility setting włączony — zignorować = wykluczać.

```tsx
import { AccessibilityInfo } from 'react-native';

const [reduceMotion, setReduceMotion] = useState(false);

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
  return () => sub.remove();
}, []);

const duration = reduceMotion ? 0 : 250;
```

**Co wyłączać przy reduce motion:**
- Hero / decorative entrances
- Slide animations (zastąp crossfade)
- Bounce / spring overshoot
- Stagger (wszystko pojawia się instant)
- Parallax / scroll-driven

**Co zachować (krytyczne dla zrozumienia stanu):**
- State change feedback (toggle, expand) — ale skróć do 0-100ms
- Press feedback — może zostać (taktilne)
- Loading indicator (replace spin z statycznym progress)

> **Reguła:** reduce motion ≠ no motion. Zachowaj komunikację stanu, usuń ozdoby.

---

## Pełny przykład: Animated Pressable z reduce motion

```tsx
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useReduceMotion } from './hooks/use-reduce-motion';

interface PressableButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  static?: boolean; // wyłącza scale (np. na mocno-stylowanym buttonie)
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableButton({
  onPress,
  children,
  disabled,
  static: isStatic,
}: PressableButtonProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const reduceMotion = useReduceMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (): void => {
    if (isStatic || reduceMotion) return;
    scale.value = withTiming(0.96, {
      duration: 100,
      easing: Easing.out(Easing.cubic),
    });
  };

  const handlePressOut = (): void => {
    if (isStatic || reduceMotion) return;
    scale.value = withTiming(1, {
      duration: 150,
      easing: Easing.out(Easing.cubic),
    });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={animatedStyle}
      accessibilityRole="button"
    >
      {children}
    </AnimatedPressable>
  );
}
```

---

## Powiązane

- [haptics-gestures.md](haptics-gestures.md) — kiedy łączyć animację z haptyką
- [accessibility-mobile.md](accessibility-mobile.md) — reduce motion, screen reader
- [polish-checklist.md](polish-checklist.md) — checklist micro-detali

---

*Źródła: Apple HIG Motion (developer.apple.com/design/human-interface-guidelines/motion), Material 3 Motion (m3.material.io/styles/motion), react-native-reanimated 4 docs (docs.swmansion.com/react-native-reanimated — bieżąca dokumentacja opisuje 4.x, npm latest 4.7.1 na 11.2026; 3.x to linia archiwalna), Rauno Freiberg (rauno.me/craft), Things 3 / Linear Mobile teardown observations, Android 17 / Material 3 Expressive (android-developers.googleblog.com). Update: 2026-11-05.*

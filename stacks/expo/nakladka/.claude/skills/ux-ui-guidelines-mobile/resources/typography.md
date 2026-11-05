# Typography — system typograficzny mobilny

System fontów, skala, weight, line-height, dynamic scaling. SF Pro vs Roboto, kiedy custom font, jak ładować w Expo, jak adaptować layout pod Dynamic Type.

---

## System fonts wygrywają — dlaczego

Apple zainwestowało lata w SF Pro / SF Display / SF Mono. Google to samo z Roboto / Roboto Flex. Te fonty NIE są tylko "ładnymi krojami" — to fundamenty platformy.

**Zalety system fonts:**

| Zaleta | Custom font | System font |
|--------|-------------|-------------|
| **Dynamic Type / font scaling** | Często psuje layout | Native support, automatyczne |
| **Accessibility** | Trzeba dospecyfikować | Działa z VoiceOver/TalkBack out-of-box |
| **Performance** | +50-200KB per weight, blocking render | Zero KB, instant |
| **Renderowanie** | Może różnić per platforma/density | Wzorcowe na każdym DPI |
| **Pixel-perfect na małych rozmiarach** | Często rozmyte poniżej 14pt | Optymalizowane pod każdą skalę |
| **Variable axes** | Trzeba załadować osobne pliki | SF Pro / Roboto Flex mają wszystkie axes |

**Custom font OK na:** logo, hero numbers, branded headlines (1-2 ekrany w apce). Body text, UI labels, buttons, inputs — ZAWSZE system font.

---

## SF Pro vs Roboto — różnice

| Wymiar | SF Pro | Roboto |
|--------|--------|--------|
| **Family** | SF Pro Text (do 19pt), SF Pro Display (20pt+), SF Pro Rounded, SF Mono | Roboto, Roboto Mono, Roboto Slab, Roboto Flex (variable) |
| **Domyślny weight UI** | 400 (Regular), 590 (Semibold dla emphasis) | 400 (Regular), 500 (Medium dla emphasis) |
| **Letter spacing UI** | Auto-tracking — system dostosowuje per size | Stała — ustawia się manualnie |
| **Wizualnie** | Bardziej geometryczny, "spokojny" | Lekko humanistyczny, większy x-height |
| **Optical sizing** | SF Pro Text vs Display — różne kontury per size | Roboto Flex ma `opsz` axis |

**Praktyka:** te same 16px renderuje się wizualnie inaczej. Roboto wygląda "nieco większy" od SF Pro przy tej samej deklaracji. To nie błąd — to celowy design system platforma. Cross-platform apki często dodają 1pt offset na Androidzie albo używają density-independent unitów.

---

## Type scale — matematyka

Type scale to hierarchia rozmiarów gdzie każdy poziom ma matematyczną relację do sąsiednich. Trzy popularne ratia:

| Ratio | Nazwa | Skala (od 12) | Kiedy użyć |
|-------|-------|---------------|------------|
| **1.125** | Minor third | 12, 13.5, 15.2, 17.1, 19.2, 21.6 | Gęsta informacja (apki finansowe, dashboardy) |
| **1.25** | Major third | 12, 15, 18.75, 23.4, 29.3, 36.6 | Uniwersalny — większość apek |
| **1.5** | Perfect fifth | 12, 18, 27, 40.5, 60.75 | Dramatyczne nagłówki (editorial, content-first) |

**Zaokrąglanie:** matematyczne wyniki nie zawsze są zdrowe. `13.5` zaokrąglij do `14`. Trzymaj się rozmiarów dzielnych przez 2 lub 4 dla pixel-perfect renderowania.

### Konkretna skala uniwersalna (1.25 ratio, zaokrąglona)

| Token | Size | Weight | Line-height | Letter-spacing | Użycie |
|-------|------|--------|-------------|----------------|--------|
| `caption` | 11 | 400 | 14 (1.27) | +0.4 | Helper text, timestamps |
| `footnote` | 12 | 400 | 16 (1.33) | +0.2 | Metadata, captions |
| `subheadline` | 14 | 400 | 20 (1.43) | 0 | Sekundarny text |
| `body` | 16 | 400 | 24 (1.5) | 0 | **Body — domyślny** |
| `bodyEmphasis` | 16 | 600 | 24 (1.5) | 0 | Body z emphasis |
| `callout` | 18 | 400 | 26 (1.44) | -0.1 | Wyróżniony body |
| `headline` | 20 | 600 | 26 (1.3) | -0.2 | Card titles |
| `title3` | 24 | 600 | 30 (1.25) | -0.3 | Section titles |
| `title2` | 32 | 600 | 38 (1.19) | -0.4 | Page titles |
| `title1` | 40 | 700 | 46 (1.15) | -0.5 | Screen heroes |
| `display` | 56 | 700 | 60 (1.07) | -1 | Marketing, splash |
| `displayLarge` | 72 | 800 | 76 (1.06) | -1.5 | Editorial hero |

**Reguła letter-spacing:** im większy rozmiar, tym ciaśniejszy spacing (negative). Im mniejszy, tym luźniejszy (positive). Optycznie zwartość kompensuje "rozjeżdżanie się" liter na dużych rozmiarach.

**Reguła line-height:** od 1.5x dla body (czytelność długiego tekstu), do 1.05-1.15 dla display (proporcje, brak nadmiernej przerwy).

---

## Weight (waga) — kiedy używać czego

| Weight | Numeryczna | Użycie |
|--------|-----------|--------|
| Light | 300 | Display heroes, marketing — NIE body |
| Regular | 400 | Body text, paragrafy, inputs — domyślny |
| Medium | 500 | Subtelny emphasis (Android) |
| Semibold | 600 | Headlines, labels, button text — **najczęstszy emphasis** |
| Bold | 700 | Page titles, mocny emphasis |
| Heavy / Black | 800-900 | Display, marketing, NIE UI |

**Zasady:**
- Body text NIGDY w Light (300) — gubi się na małych rozmiarach
- Buttons, CTA — minimum 600 (Semibold)
- Maksymalnie 3 weighty w jednej apce — więcej = niespójność

---

## Custom fonts w Expo — jak ładować

Expo ma `expo-font` z hookiem `useFonts`. Splash screen można utrzymać do załadowania.

```tsx
// app/_layout.tsx
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Bricolage-Regular": require("../assets/fonts/Bricolage-Regular.ttf"),
    "Bricolage-Medium": require("../assets/fonts/Bricolage-Medium.ttf"),
    "Bricolage-Bold": require("../assets/fonts/Bricolage-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hide();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;
  return <Slot />;
}
```

**Zasady ładowania custom fontów:**
- Ładuj TYLKO weighty, których faktycznie używasz (3-4 max)
- Format: `.ttf` lub `.otf`. Variable fonts (jeden plik, wiele weights) = preferencja
- Trzymaj rozmiar < 200KB per weight, < 800KB total
- Używaj `SplashScreen` żeby uniknąć flash of unstyled text (FOUT)

---

## Uniwind — tokeny tekstu

Uniwind daje Tailwind v4 w RN, a tokeny definiujesz w `@theme` w `global.css` (setup opisuje skill `uniwind`). Rozmiar i interlinia idą razem przez sufiks `--line-height`:

```css
/* global.css */
@theme {
  /* Custom hero: jeden font na rodzinę, nazwa jak plik bez rozszerzenia */
  --font-display: 'Bricolage-Bold';

  --text-caption: 11px;
  --text-caption--line-height: 14px;
  --text-footnote: 12px;
  --text-footnote--line-height: 16px;
  --text-body: 16px;
  --text-body--line-height: 24px;
  --text-headline: 20px;
  --text-headline--line-height: 26px;
  --text-title2: 32px;
  --text-title2--line-height: 38px;
  --text-display: 56px;
  --text-display--line-height: 60px;
}
```

Font systemowy nie potrzebuje tokenu: `Text` bez klasy `font-*` renderuje się SF Pro na iOS i Robotem na Androidzie. Odstęp liter i wagę dodajesz klasami przy roli:

| Rola | Klasy |
|------|-------|
| caption | `text-caption tracking-[0.4px]` |
| footnote | `text-footnote tracking-[0.2px]` |
| body | `text-body` |
| headline | `text-headline tracking-[-0.2px] font-semibold` |
| title2 | `text-title2 tracking-[-0.4px] font-semibold` |
| display | `text-display tracking-[-1px] font-display` |

```tsx
// Użycie
<Text className="text-body text-foreground">
  Body text using system font
</Text>

<Text className="text-display tracking-[-1px] font-display text-foreground">
  Hero using custom font
</Text>
```

W `TextInput` nie używaj tokenów z interlinią, bo na iOS przesuwają wpisany tekst w dół; powód i zamiennik są w `forms-keyboard.md`.

---

## Dynamic Type (iOS) i font scaling (Android)

Apple traktuje Dynamic Type jako fundament — nie opcję dla "users with vision problems". Każda apka iOS, która ignoruje user's preferred text size, wygląda amatorsko.

### iOS — scaling kategorii

iOS oferuje 12 kategorii rozmiaru tekstu (od `xSmall` po `accessibilityXXXLarge`). Każda powiększa tekst proporcjonalnie.

```tsx
import { Text } from "react-native";

<Text
  style={{ fontSize: 16 }}
  allowFontScaling={true}        // domyślnie true
  maxFontSizeMultiplier={1.5}    // cap przy 24px (16 * 1.5)
>
  Adapts to user preference
</Text>
```

### Android — `sp` units (scale-independent pixels)

Android automatycznie skaluje fonty deklarowane w `sp`. RN/Expo używa abstrakcji — `fontSize: 16` jest interpretowane jako sp na Androidzie.

### Adaptacja layoutu — kiedy `maxFontSizeMultiplier`

| Element | Reguła |
|---------|--------|
| Body text (paragrafy) | `allowFontScaling={true}`, bez cap — pełna adaptacja |
| Buttons | `maxFontSizeMultiplier={1.5}` — żeby button nie pochłonął ekranu |
| Numbers w hero (score, timer) | `allowFontScaling={false}` — projektowane jako wizualny element |
| Tab bar labels | `maxFontSizeMultiplier={1.2}` — żeby zmieściły się w nav bar |
| Caption text | `allowFontScaling={true}` — pełna adaptacja, ważne dla a11y |

```tsx
// Helper komponent
function ResponsiveText({ children, capAt = 1.5, ...props }) {
  return (
    <Text maxFontSizeMultiplier={capAt} {...props}>
      {children}
    </Text>
  );
}
```

### Layout jako reakcja na powiększenie

Przy `accessibilityXXLarge` (200%+) horizontalny layout często musi przełączyć się na vertical. Użyj `useWindowDimensions` lub Detect:

```tsx
import { PixelRatio } from "react-native";

const fontScale = PixelRatio.getFontScale();
const isLargeText = fontScale > 1.3;

<View className={isLargeText ? "flex-col gap-2" : "flex-row gap-4"}>
  <Icon />
  <Text>Long label</Text>
</View>
```

---

## Tabular numbers — `fontVariant`

Dynamiczne liczby (timer, score, cena, licznik) MUSZĄ używać tabular numerals — inaczej szerokość się zmienia z każdą cyfrą i layout drży.

```tsx
<Text
  className="text-display"
  style={{ fontVariant: ["tabular-nums"] }}
>
  {seconds.toString().padStart(2, "0")}:{ms}
</Text>
```

**Kiedy używać tabular-nums:**
- Score / wynik
- Timer / countdown
- Cena (zwłaszcza w tabeli)
- Statystyki, dashboardy
- Numer telefonu, kod OTP

**Kiedy NIE używać:**
- Prose / paragrafy z liczbami w tekście — proportional wygląda lepiej w prozie
- Tytuły, headlines

SF Pro i Roboto oba mają wbudowany tabular numbers wariant — dostępny natywnie.

---

## Custom TextStyle preset — pattern

Dla większych projektów, zamiast pisać className w każdym Text, zdefiniuj komponenty per styl:

```tsx
// components/typography.tsx
import { Text, type TextProps } from "react-native";

export function Body({ className = "", ...props }: TextProps & { className?: string }) {
  return (
    <Text
      className={`text-body text-foreground ${className}`}
      maxFontSizeMultiplier={2}
      {...props}
    />
  );
}

export function Headline({ className = "", ...props }: TextProps & { className?: string }) {
  return (
    <Text
      className={`text-headline text-foreground ${className}`}
      maxFontSizeMultiplier={1.5}
      {...props}
    />
  );
}

export function Display({ className = "", ...props }: TextProps & { className?: string }) {
  return (
    <Text
      className={`text-display font-display text-foreground ${className}`}
      style={{ fontVariant: ["tabular-nums"] }}
      maxFontSizeMultiplier={1.2}
      {...props}
    />
  );
}
```

```tsx
// Użycie
<Headline>Card title</Headline>
<Body>Description text</Body>
<Display>{score}</Display>
```

**Zalety:** spójność, łatwa zmiana stylów globalnie, semantyczne nazewnictwo zamiast utility soup.

---

## Checklist typography

- [ ] Body text używa system font (SF Pro / Roboto), NIE custom
- [ ] Custom font tylko na hero / branding, max 3-4 weighty
- [ ] Type scale spójny (jeden ratio) — minor third / major third / perfect fifth
- [ ] Każdy poziom ma weight + line-height + letter-spacing skoordynowane
- [ ] Letter-spacing: większe rozmiary = ciaśniej, mniejsze = luźniej
- [ ] Body text minimum weight 400, button text minimum 600
- [ ] Dynamic Type wsparte (`allowFontScaling`, sensible caps)
- [ ] Layout adaptuje się przy `fontScale > 1.3` (horizontal → vertical)
- [ ] `tabular-nums` na każdej dynamicznej liczbie (timer, score, cena)
- [ ] Custom fonty ładowane przez `useFonts` + SplashScreen (zero FOUT)
- [ ] Maksymalnie 3 weighty w jednej apce

---

## Powiązane

- [[resources/spacing-grid.md]] — line-height ↔ spacing rytm
- [[resources/platform-conventions.md]] — SF Pro vs Roboto różnice
- [[resources/color-darkmode.md]] — text contrast WCAG
- [[resources/ai-pitfalls.md]] — dekoracyjna typografia jako AI signature

*Źródła: Apple HIG Typography (developer.apple.com/design/human-interface-guidelines/typography), Material 3 Typography (m3.material.io/styles/typography), Type Scale (typescale.com), expo-font docs (docs.expo.dev/versions/latest/sdk/font), wiki/typografia-i-spacing. Ostatni update: 2026-11-05.*

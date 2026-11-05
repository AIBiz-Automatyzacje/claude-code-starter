# Spacing & Grid — system 8pt

System 8pt grid, tokeny spacingowe, safe areas, Dynamic Island, touch targets, tokeny w `@theme`. Fundament, na którym stoi cały interfejs — jeśli zrobiony dobrze, apka wygląda profesjonalnie nawet z prostymi komponentami.

---

## Dlaczego 8pt grid

Każdy spacing w apce = wielokrotność 8: `8, 16, 24, 32, 40, 48, 56, 64`. Czemu osemka?

**Dzieli się ładnie.** 8/2=4, 8/4=2. Na różnych gęstościach ekranu (1x, 1.5x, 2x, 3x, 4x density) wartości pozostają całkowite — brak sub-pixel rendering, brak rozmytego stylu.

**Skaluje proporcjonalnie.** iOS ma 1x, 2x, 3x. Android ma mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi (1x → 4x). 8pt = 8px na 1x, 16px na 2x, 24px na 3x, 32px na 4x. Bez fragmentacji.

**Tworzy dyscyplinę.** Designer mówi "tu daj 15px" = sygnał że nie ma systemu. W 8pt grid nigdy nie pojawia się arbitralna wartość. Zamiast 50 decyzji spacingowych dziennie — system decyduje za ciebie.

**Tworzy naturalne proporcje.** Element o paddingu 16, marginesie 24, gap 8 — relacje są harmoniczne, bo wszystkie pochodzą z tej samej skali.

---

## Tokeny spacingowe

Standardowy zestaw tokenów. Zdefiniuj raz, używaj wszędzie.

| Token | Pixele | Zastosowanie |
|-------|--------|--------------|
| `xs` | 4 | Pomiędzy ikoną a tekstem, hairline gaps |
| `sm` | 8 | Inner padding (chip, badge), gap w gęstym UI |
| `md` | 12 | Padding średnich elementów (input internal) |
| `lg` | 16 | **Domyślny screen padding**, card padding, gap między elementami |
| `xl` | 24 | Section gaps, padding hero, between cards |
| `2xl` | 32 | Major section breaks, padding around hero |
| `3xl` | 48 | Vertical rhythm między dużymi sekcjami |
| `4xl` | 64 | Splash, marketing, breathing room na hero |

**Reguła:** 90% paddingów i marginesów to `sm`, `md`, `lg`. Wartości większe (`xl`+) głównie do separacji semantycznie różnych sekcji.

---

## 4pt half-step — kiedy OK, kiedy nie

Czasami 8pt jest za luźne. 4pt half-step (`4, 12, 20, 28`) bywa potrzebny.

**Kiedy 4pt OK:**
- Gęsty UI (tabela, dashboard, gęsta lista) — `12` zamiast `16` mieści więcej
- Padding wewnątrz małych komponentów (chip 4pt vertical, 8pt horizontal)
- Pomiędzy ikoną 16x16 a tekstem (`gap-1` = 4pt)

**Kiedy unikać:**
- Screen-level layout — trzymaj 8pt grid
- Większe odległości (`>24`) — używaj wielokrotności 8
- Gdy nie masz uzasadnienia "dlaczego 12 a nie 16"

**Reguła:** jeśli używasz 4pt, to świadomie i konsekwentnie w danym kontekście. Mieszanie 4 i 8 ad-hoc = sygnał braku systemu.

---

## Padding vs margin vs gap — różnice praktyczne

W RN i Uniwind masz wszystkie trzy. Kiedy co?

| Konstrukcja | Kiedy używać |
|-------------|--------------|
| `padding` | Przestrzeń WEWNĄTRZ elementu — między brzegiem a contentem (button, card, screen) |
| `margin` | Przestrzeń NA ZEWNĄTRZ — między bratami w starszych layoutach |
| `gap` | Przestrzeń MIĘDZY dziećmi flexa/grida — preferowany w Flexbox |

**W 2026 reguła:**
- **Containerze flex/grid → `gap`** (NIE `margin` na dzieciach)
- **Padding wewnątrz komponentu → `padding`**
- **`margin` tylko gdy gap niemożliwy** (np. element odpada od layoutu, sticky)

```tsx
// DOBRE — gap między dziećmi flexa
<View className="flex-row gap-3">
  <Item />
  <Item />
  <Item />
</View>

// ZŁE — margin na dzieciach (potrzebny last-child override)
<View className="flex-row">
  <Item className="mr-3" />
  <Item className="mr-3" />
  <Item />            {/* trzeba pamiętać o usunięciu marginu */}
</View>
```

---

## Safe areas — `useSafeAreaInsets`

Współczesne urządzenia mają notch, Dynamic Island, home indicator, status bar. Content nie może być pod tymi elementami.

### `react-native-safe-area-context` — must-have

```tsx
// app/_layout.tsx
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
```

```tsx
// W ekranie
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Screen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
      className="flex-1 bg-background px-4"
    >
      <Content />
    </View>
  );
}
```

Uniwind ma też klasy `pt-safe`, `pb-safe`, `px-safe` oraz warianty `pt-safe-or-4` (większa z dwóch wartości) i `pb-safe-offset-4` (inset plus wartość). W wersji Free insety musisz im przekazać: owijasz aplikację w `SafeAreaProvider` i `SafeAreaListener`, a w `onChange` wołasz `Uniwind.updateInsets(insets)`. Szczegóły są w skillu `uniwind`.

### Kiedy respektować, kiedy ignorować

| Sytuacja | Insets |
|----------|--------|
| Header / nav bar | `paddingTop: insets.top` (lub native header) |
| Tab bar / bottom buttons | `paddingBottom: insets.bottom` |
| Full-bleed image (hero) | **Ignoruj** insets — image rozciąga się pod notch |
| Modal / sheet | Sheet API obsługuje insets automatycznie |
| Background color (gradient, solid) | Ignoruj insets — rozciąga się do brzegu |
| Tekst, content interaktywny | Zawsze respektuj insets |

### Dynamic Island i notch — część designu

Apple promuje traktowanie Dynamic Island i notch jako część designu, NIE jako przeszkodę. Apki które zostawiają duży black bar pod notchem wyglądają tanio.

```tsx
// DOBRE — full-bleed image z content respektującym insets
<View className="flex-1">
  <Image
    source={hero}
    className="absolute inset-0 h-72 w-full"  // pod notchem
    resizeMode="cover"
  />
  <View style={{ paddingTop: insets.top }} className="flex-1 px-4">
    <Text className="text-display text-white">Title</Text>
  </View>
</View>
```

---

## Tab bar / Navigation bar — wymiary per platforma

| Element | iOS | Android |
|---------|-----|---------|
| **Tab bar height (sam tab bar)** | 49pt | 56dp (Material) / 80dp (M3 navigation bar) |
| **Tab bar + safe area bottom (iPhone 15 Pro)** | 83pt | n/a (gestural nav może mieć 0) |
| **Header / Nav bar** | 44pt + status bar | 56dp |
| **Status bar — notch (iPhone X–14)** | 47pt | 24-28dp |
| **Status bar — Dynamic Island (iPhone 14 Pro–16 Pro)** | 59pt | n/a |
| **Dynamic Island clearance** | ~37pt (height) | n/a |

**Zasada:** te wartości różnią się per model urządzenia (notch vs Dynamic Island to różne wycięcia z różnym top inset) i zmieniają się z każdą generacją iPhone'a — **zawsze `useSafeAreaInsets`, nigdy hardcode**. Powyższe liczby to punkt odniesienia, nie stałe do wpisania w kod.

---

## Touch target — minimum i recommended

| Standard | iOS | Android | WCAG 2.2 |
|----------|-----|---------|----------|
| **Minimum** | 44pt | 48dp | 24x24px (AA) |
| **Recommended** | 44-48pt | 48-56dp | 44x44px (AAA) |
| **Optimum dla emocjonalnie tap-tap-tap** | 48-56pt | 56-64dp | — |

**Dlaczego:**
- 44pt iOS to *fingertip width* przeciętnego dorosłego
- 48dp Android = ten sam wymiar fizyczny (1dp ≈ 1pt na większości urządzeń)
- 24x24 to absolutne minimum WCAG, ale nie pewny tap z grubych palców

### Hit area expansion — pseudo-element

Jeśli widoczny element jest mniejszy (np. ikona 20x20 w toolbarze), rozszerz hit area:

```tsx
// React Native — Pressable ma hitSlop
<Pressable
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  onPress={handlePress}
>
  <Icon size={20} />  {/* widoczny 20x20 */}
  {/* hit area = 20 + 24 = 44pt */}
</Pressable>
```

**Reguła kolizji:** dwa interaktywne elementy NIGDY nie mogą mieć nakładających się hit areas. Jeśli `hitSlop` powoduje overlap, zmniejsz lub zwiększ odstęp między elementami.

---

## Gdzie umieszczać główne CTA — środek ekranu, nie "thumb zone"

**Klasyczny mit obalony przez własnego autora.** Diagram "thumb reach zone" (zielona/żółta/czerwona strefa zasięgu kciuka) z 2013 roku był przez dekadę cytowany jako podstawa decyzji o umieszczaniu CTA u dołu ekranu. **Steven Hoober — autor oryginalnych badań — opublikował korektę** (na podstawie własnych primary research): wyniki pokazały dokładne przeciwieństwo popularnej interpretacji.

**Co naprawdę pokazują dane Hoobera:**
- **Środek ekranu jest dotykany najczęściej, najszybciej i najdokładniej** — nie krawędzie
- **Jednoręczne użycie to mniej niż 50%** wszystkich interakcji (nie większość, jak zakładał viralowy diagram)
- Użytkownicy **nieustannie zmieniają chwyt** — przekładają telefon, używają drugiej ręki, kładą na stole
- Na dużych telefonach **gorna strefa jest poza zasięgiem** przy jednoręcznym użyciu — **CTA na górze = "najdroższy błąd UX"**
- **Dolne krawędzie również są trudne** w zasięgu na nowoczesnych dużych telefonach (iPhone Pro Max, Samsung Ultra)

**Praktyczna reguła 2026:**

| Strefa ekranu | Charakterystyka | Co tu umieszczać |
|---------------|-----------------|------------------|
| **Górna 20%** | Trudna jednoręcznie, ale używana wzrokowo | Header, tytuł, mniej krytyczne info |
| **Środkowa 60%** | **Najczęściej i najdokładniej dotykana** | **Główne CTA, primary actions, content interaktywny** |
| **Dolna 20%** | Bottom navigation (rzadziej dotykana niż środek!) | Tab bar (nawigacja), secondary actions |

**Test do code review:** zamiast "one-thumb test" (czy zasięg kciuka?) → **"center-screen test"** (czy główne CTA są w środkowej części ekranu?).

**Wyjątek dla nawigacji:** bottom tab bar pozostaje na dole nie dlatego że "łatwy do tapnięcia", tylko dlatego że jest **przewidywalny** (user wie gdzie szukać) i **nie konkuruje wizualnie z contentem**. Te dwa argumenty są niezależne od dyskredytowanej "thumb zone".

→ Patrz [[resources/platform-conventions.md]] dla tab bar HIG (wyłącznie nawigacja, nie akcje).

---

## Optical alignment vs grid — kiedy łamać

Czasem geometryczny środek nie wygląda jak optyczny środek. Łam grid optycznie:

| Sytuacja | Korekta |
|----------|---------|
| Trójkąt Play (▶) wycentrowany | Przesuń o 1-2px w prawo |
| Tekst kursywą obok prostego | Lekko zmniejsz spacing po prawej |
| Ikona z asymetrycznym ciężarem (gwiazdka, strzałka) | Adjust w SVG viewBox albo `marginLeft: 1` |
| Button z tekstem + ikoną po prawej | Padding po stronie ikony = padding po stronie tekstu - 2px |
| Krąg vs kwadrat tej samej szerokości | Krąg może wymagać lekkiej korekcji wertykalnej |

```tsx
// Optical — buton z ikoną, mniej paddingu po stronie ikony
<Pressable className="pl-4 pr-3.5 flex-row items-center gap-2 h-12">
  <Text>Continue</Text>
  <ArrowRightIcon />
</Pressable>
```

Reguła: jeśli wygląda nie tak, zaufaj OKU, nie linijce.

---

## Tokeny w Uniwind — `@theme` w `global.css`

Uniwind to Tailwind v4 CSS-first: tokeny mieszkają w `global.css`, a pliku konfiguracyjnego JS nie ma. Pełny setup opisuje skill `uniwind`.

```css
/* global.css */
@import 'tailwindcss';
@import 'uniwind';

@theme {
  /* 8pt grid jako default: skala Tailwinda (p-2, p-4, gap-3) działa obok tych aliasów */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;
  --spacing-3xl: 48px;
  --spacing-4xl: 64px;

  /* Tokeny radius: outer = inner + padding (concentric) */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-2xl: 28px;
}
```

```tsx
// Użycie
<View className="px-lg py-xl gap-md">
  <Card />
  <Card />
</View>

// Albo standardowe klasy Tailwinda: rem = 16 px, więc px-4 = 16 pt, gap-3 = 12 pt
<View className="px-4 py-6 gap-3">
  <Card />
</View>
```

**1 pt z Figmy = 1 px w klasie.** Wartość arbitralna w `px` równa się punktom (`w-[16px]` = 16 pt), więc liczbę spoza skali przepisujesz z makiety wprost. `@theme` przyjmuje tylko wartości statyczne; funkcje urządzenia, jak `hairlineWidth()`, idą do `@utility`.

---

## Patterns — typowe layouty

### Screen container

```tsx
import { useSafeAreaInsets } from "react-native-safe-area-context";

function Screen({ children }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      className="flex-1 bg-background px-4"
    >
      {children}
    </View>
  );
}
```

### Card list

```tsx
<ScrollView contentContainerClassName="px-4 py-6 gap-3">
  {items.map((item) => (
    <View key={item.id} className="bg-surface rounded-xl p-4 gap-2">
      <Text className="text-headline">{item.title}</Text>
      <Text className="text-body text-muted-foreground">{item.body}</Text>
    </View>
  ))}
</ScrollView>
```

### Form

```tsx
<View className="gap-6">           {/* between fields */}
  <View className="gap-2">         {/* label + input */}
    <Text className="text-footnote">Email</Text>
    <TextInput className="h-12 px-4 rounded-xl border border-border" />
  </View>
  <View className="gap-2">
    <Text className="text-footnote">Password</Text>
    <TextInput className="h-12 px-4 rounded-xl border border-border" />
  </View>
  <Pressable className="h-12 rounded-xl bg-primary justify-center items-center">
    <Text className="text-bodyEmphasis text-primary-foreground">Sign in</Text>
  </Pressable>
</View>
```

---

## Concentric shapes — 3 oficjalne typy iOS 26

Apple na WWDC25 (sesja "Get to know the new design system") sformalizował **3 typy kształtów** które są podstawą iOS 26 Liquid Glass design language. Każdy element UI należy do jednej kategorii:

| Typ | Definicja | Przykłady użycia |
|-----|-----------|------------------|
| **`fixed`** | Stały radius niezależny od kontekstu | Małe ikony, badges, dots |
| **`capsule`** | Radius = połowa wysokości (pełna pigułka) | Pill buttons, tagi, chipy, status pills |
| **`concentric`** | Radius = radius rodzica MINUS padding | Zagnieżdżone karty, button w karcie, content w sheet |

**Kluczowa reguła Apple — concentric jest obowiązkowy w zagnieżdżeniach:** każdy zagnieżdżony element musi liczyć swój radius z radiusu rodzica. To eliminuje "off feel" gdy inner element wygląda jak płaski prostokąt w zaokrąglonym pudełku.

```
concentricInnerRadius = parentRadius - padding
```

```tsx
// DOBRE — concentric: outer 20px, padding 8px, inner 12px
<View className="rounded-2xl p-2 bg-surface">  {/* parent 20px radius */}
  <View className="rounded-xl bg-card">         {/* 12px = 20 - 8 ✓ concentric */}
    <Content />
  </View>
</View>

// DOBRE — capsule button (radius = h/2)
<Pressable className="h-12 px-6 rounded-full bg-primary">  {/* h-12 = 48px → rounded-full = 24px */}
  <Text>Action</Text>
</Pressable>

// DOBRE — fixed badge
<View className="w-2 h-2 rounded-sm bg-error" />  {/* fixed 6px independent */}

// ZŁE — same radius wewnętrznie i zewnętrznie (pochłania padding)
<View className="rounded-2xl p-2">
  <View className="rounded-2xl">  {/* wygląda "off" — łamie concentric */}
    <Content />
  </View>
</View>

// ZŁE — fixed radius w miejscu gdzie powinien być concentric
<View className="rounded-3xl p-4 bg-surface">  {/* 24px outer */}
  <View className="rounded-md bg-card">         {/* 6px — wizualny dysonans */}
    <Content />
  </View>
</View>
```

**Praktyczna konsekwencja dla design systemu:** zamiast hardcodować radiusy, **definiuj kształty per rola** (np. `card`, `button`, `chip`, `badge`) i niech każdy automatycznie wybiera typ (capsule dla buttonów, concentric dla zagnieżdżeń, fixed dla badges).

→ Patrz [[resources/platform-conventions.md]] dla iOS 26 Liquid Glass design language jako kontekstu.

---

## Checklist spacing & grid

- [ ] Wszystkie paddingi/marginesy/gapy = wielokrotność 4 (preferencyjnie 8)
- [ ] Tokens spacingowe zdefiniowane w `@theme` w `global.css`, nie hardcoded
- [ ] `gap` zamiast `margin` w kontenerach flex/grid
- [ ] `useSafeAreaInsets` na każdym screenie z headerem / bottomem
- [ ] Touch targets minimum 44pt iOS / 48dp Android (recommended 48-56)
- [ ] `hitSlop` na małych ikonach (< 44pt visible)
- [ ] Dynamic Island i notch traktowane jako część designu (nie black bar)
- [ ] Concentric radius przy zagnieżdżonych elementach (lub świadomy fixed/capsule per rola)
- [ ] Brak nakładających się hit areas na sąsiadujących interaktywnych elementach
- [ ] Optical alignment używany świadomie (Play, italic, asymetryczne ikony)
- [ ] **Główne CTA w środkowej części ekranu** (NIE u góry, NIE tylko u dołu — Hoober myth busted)

---

## Powiązane

- [[resources/typography.md]] — line-height ↔ vertical rhythm
- [[resources/platform-conventions.md]] — touch targets per platforma, tab bar dimensions
- [[resources/polish-checklist.md]] — concentric radius, optical alignment w kontekście "Spacing & layout polish"
- [[resources/ai-pitfalls.md]] — niespójny spacing jako AI signature

*Źródła: Apple HIG Layout (developer.apple.com/design/human-interface-guidelines/layout), Apple WWDC25 "Get to know the new design system" (concentric shapes 3 typy — primary source), Material 3 Layout (m3.material.io/foundations/layout), Steven Hoober — autor oryginalnych badań thumb zone (4ourth.com/Touch.html, primary research correction), react-native-safe-area-context (github.com/th3rdwave/react-native-safe-area-context), wiki/typografia-i-spacing. Ostatni update: 2026-11-05.*

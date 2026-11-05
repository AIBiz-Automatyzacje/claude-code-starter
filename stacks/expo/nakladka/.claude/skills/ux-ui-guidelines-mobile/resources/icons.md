# Icons — system ikon mobilnych

Wybór biblioteki, sizing, optical alignment, semantic vs decorative, rules dla touch targets i accessibility. Decyzje pod Expo + React Native + Uniwind, ale pryncypia uniwersalne.

---

## Decision tree — która biblioteka

| Biblioteka | Kiedy wybrać | Plusy | Minusy |
|------------|--------------|-------|--------|
| **SF Symbols / Material Symbols** (`expo-symbols`) | Uniwersalny native feel — iOS/tvOS: SF Symbols, Android/web: Material Symbols (moduł sam mapuje) | 7000+ ikon (SF Symbols 7 stable / 8 beta), jedna abstrakcja na wszystkie platformy, hierarchical/palette/multicolor + `animationSpec` na iOS, scaluje się z Dynamic Type, działa w Expo Go, free | Brak parytetu 1:1 katalogów — mapuj `name={{ ios, android, web }}`; waga na Androidzie/webie przez `expo-symbols/androidWeights/{weight}`; moduł oznaczony w docs jako **beta** (breaking changes) |
| **Lucide React Native** | Cross-platform default | 1700+ ikon (1776 na 08.2026), jeden style, stroke-based, mały bundle, licencja **ISC** | Dodatkowy paint cycle (SVG), brak hierarchical |
| **Heroicons** | Tailwind ecosystem, prosty styl | Zsynchronizowane z Tailwind, outline + solid pairs | Mniejszy zestaw (~300), mniej semantycznych odpowiedników |
| **Material Symbols** | Android-first, Material 3 brand | Variable axes (fill/weight/grade/opsz), spójne z system Android | Większy bundle, mniej dopasowane do iOS |
| **Custom set** | Brand wymaga unikalnego stylu | Pełna kontrola | Drogie utrzymanie, brak nowych ikon "za darmo" |

**Pryncypium:** jedna biblioteka per app. Mieszanie Lucide + Heroicons w jednym ekranie = wizualny chaos (różny stroke, różny rounding, różne proporcje).

**Cross-platform z native feel:** Lucide jako default + `expo-symbols` dla 5-10 kluczowych miejsc (tab bar, share button, back arrow). Tam gdzie native gesture/affordance — system icon. Tam gdzie content/feature — Lucide. **Nie potrzebujesz `Platform.OS === 'ios'`** — podaj nazwę per platforma, moduł sam wybierze SF Symbol albo Material Symbol:

```tsx
import { SymbolView } from 'expo-symbols';

<SymbolView
  name={{ ios: 'info.circle', android: 'info', web: 'info' }}
  fallback={<LucideInfo size={24} />}
/>
```

`fallback` NIE oznacza „Android niewspierany" — to zapas na brak symbolu / starszą platformę. Źródło nazw dla Androida/webu: `@expo-google-fonts/material-symbols` (**nie** `@expo/material-symbols`).

---

## Sizing matrix

| Rozmiar | Użycie | Touch target |
|---------|--------|--------------|
| **16px** | Inline w tekście, badges, helper text | n/a (nieklikalne) |
| **20px** | List items dense, secondary action, chip leading | 44x44 wrapper |
| **24px** | **Default UI** — toolbar, button, input affordance | 44x44 wrapper |
| **28px** | Tab bar (Material 3), prominent action | 48x48 wrapper |
| **32px** | Feature highlights, settings sections leading | 48x48+ |
| **40-64px** | Empty states, hero illustrations | n/a (dekoracja) |
| **80-128px** | Onboarding, splash, success state | n/a |

**Reguła 24px:** jeśli nie wiesz jak duża ma być ikona, weź 24. To rozmiar do którego designerzy iOS i Android zoptymalizowali większość metaforek.

**Density-aware:** na Androidzie wolisz `dp` zamiast `px`. W RN, także przez klasy Uniwind, oba są density-independent — `size={24}` to 24dp, nie 24 fizyczne piksele.

---

## Stroke width — premium signal

| Stroke | Vibe | Użycie |
|--------|------|--------|
| **1px** | Hairline, ultra-premium | Marketing, editorial — gubi się przy 16px |
| **1.5px** | Lucide default, wyważony | UI default, dobry kompromis czytelności i lekkości |
| **2px** | Bolder, "friendly" | Apki dla seniorów, wysokokontrastowe konteksty, dense data |
| **Variable** | SF Symbols, Material Symbols Variable | Adaptuje się do font-weight wokół, automatic |

**Test:** zrenderuj ikonę w 16px na średniej jasności tle. Jeśli stroke "ginie" — zwiększ do 2px lub idź na filled variant.

**Nie miksuj stroke widths w tym samym ekranie.** Wszystkie ikony 1.5 albo wszystkie 2. Inaczej oko widzi że "coś tu nie gra".

---

## Outline vs filled — zasady

**Default state:** outline. Lżejszy wizualnie, nie konkuruje z treścią.

**Active / selected state:** filled. W tab barze: zaznaczona zakładka = filled, reszta = outline. W liście ulubionych: serce filled = ulubione, outline = nie. Filled = "to jest now wybrane / włączone".

**Anti-pattern:** miksowanie filled outline w tym samym widoku tab bara. Albo wszystkie outline z color tint na aktywnym, albo outline → filled crossfade na aktywnym. Nie 3 outline + 1 filled bez logiki.

**Hierarchical (SF Symbols):** trzeci wariant — opacity gradient w obrębie jednej ikony. Premium, ale tylko iOS. Use case: ekran "filled na aktywnym, hierarchical na 2nd-tier".

---

## Optical alignment — dlaczego ikony są "krzywe"

Ikony NIE leżą na grid baseline jak tekst. Optyczny środek figury != geometryczny środek bounding boxa.

**Konkretnie:**

| Kształt | Korekta |
|---------|---------|
| Trójkąt skierowany w prawo (play) | Przesunięcie o 1-2px w lewo wewnątrz boxa, inaczej wygląda za bardzo w prawo |
| Diament / romb | Przesunięcie pionowe 1px w dół |
| Okrągłe ikony | Często optycznie 5-10% mniejsze niż bounding box kwadratu — kompensują percepcję |
| Ikona + tekst | Ikona center cap-height, NIE center full font box |

**Praktyka:** zaufaj designerowi biblioteki. Lucide, Heroicons, SF Symbols mają to już skorygowane. **Nie próbuj fixować "krzywej" ikony rotation/translate** — najpewniej widzisz poprawną optyczną korektę.

**Ikona + tekst horizontal:** użyj flex z items-center, ale dodaj `lineHeight` na text taki sam jak `size` ikony. Inaczej tekst ucieka w dół.

```tsx
<View className="flex-row items-center gap-2">
  <Plus size={20} strokeWidth={1.5} />
  <Text className="text-base leading-5">Dodaj</Text>
  {/* leading-5 = 20px = match icon height */}
</View>
```

---

## Semantic icons — uniwersalna rozpoznawalność

Niektóre ikony to konwencja. **Nie wymyślaj koła na nowo.**

| Concept | Ikona | NIE używaj |
|---------|-------|------------|
| Search | Magnifier (lupa) | Lornetka, oko, książka |
| Settings | Gear / cog | Klucz francuski, suwaki w oderwaniu od kontekstu |
| Profile / account | Person silhouette | Avatar zdjęcie generic, książka adresowa |
| Home | House | Strzałka w dół, kompas |
| Add / new | Plus | Strzałka w dół, plik |
| More options | 3 dots horizontal (`more-horizontal`) lub vertical (kebab) | Hamburger (to nawigacja root) |
| Navigation menu | Hamburger (3 linie) | Kebab (to action menu) |
| Share | iOS share box (square + arrow up) lub Android nodes | Strzałka w prawo, ptak |
| Delete | Trash | X (X = close/dismiss) |
| Close / dismiss | X | Strzałka wstecz (to history back) |
| Back | Chevron-left / arrow-left | X |
| Edit | Pencil | Klucz, papier |
| Filter | Funnel | Suwaki (to settings) |
| Sort | Arrow up-down lub bars-arrow | Funnel |

**Reguła:** jeśli inna apka tej samej kategorii używa `gear` na settings — Twoja też. User attention budget na "co znaczy ta ikona" = 0.

---

## Color rules

**Default:** ikona ma kolor tekstu wokół, ale w RN style się nie dziedziczą, więc podajesz go wprost: `color={textColor}` albo, z Uniwind, `colorClassName="accent-foreground"` na ikonie owiniętej w `withUniwind`:

```tsx
// components/icons.ts: owijasz raz, na poziomie modułu, nigdy w renderze
import { withUniwind } from 'uniwind';
import { Search as LucideSearch } from 'lucide-react-native';

export const Search = withUniwind(LucideSearch);
```

```tsx
<Search size={24} strokeWidth={1.5} colorClassName="accent-foreground" />
```

Prefiks `accent-` jest obowiązkowy, bo `color` nie należy do `style`. Przykłady ikon z `colorClassName` w tym skillu zakładają takie owinięcie.

**Semantic colors:**

| Semantyka | Color token | Przykład |
|-----------|-------------|----------|
| Error / destructive | `accent-destructive` | Trash w "delete account" |
| Success | `accent-success` | Checkmark "saved" |
| Warning | `accent-warning` | Warning triangle przy form error summary |
| Info | `accent-info` | Info circle przy tooltip trigger |
| Disabled | `accent-muted-foreground` (50% opacity) | Action niedostępna |

**Anti-patterns:**
- Rainbow ikony bez powodu — chyba że brand (Slack, Google Photos)
- Color jako jedyny sygnał stanu (a11y) — czerwona ikona przy błędzie + ikona alert + tekst
- Hardcoded hex w kodzie ikony — zawsze przez theme/token

---

## Touch targets — 44x44 minimum

**WCAG 2.2 AA:** 24x24px minimum. **Apple HIG:** 44x44pt. **Material 3:** 48x48dp.

**Praktyka mobile:** 44x44 minimum, nawet gdy ikona ma 20px. Padding wokół ikony robi resztę.

```tsx
// ŹLE — touch target 24x24, za mało
<Pressable onPress={handlePress}>
  <X size={24} />
</Pressable>

// DOBRZE — 44x44 touch target przy 24px ikonie
<Pressable
  onPress={handlePress}
  className="h-11 w-11 items-center justify-center"
  hitSlop={8}
>
  <X size={24} />
</Pressable>
```

`hitSlop` na RN rozszerza touch area BEZ wpływu na layout. Użyj gdy potrzebujesz wizualnie małej ikony (np. 16px close button w chipie) z dużym touch areą.

**Spacing między ikonami:** minimum 8px gap, idealnie 12-16px. Inaczej fat-finger problem.

---

## Accessibility — `accessibilityLabel` jest obowiązkowe

**Icon-only button = ZAWSZE `accessibilityLabel`.** Screen reader nie widzi SVG path, widzi label.

```tsx
// ŹLE — VoiceOver przeczyta "button"
<Pressable onPress={handleClose}>
  <X size={24} />
</Pressable>

// DOBRZE — VoiceOver przeczyta "Zamknij, button"
<Pressable
  onPress={handleClose}
  accessibilityLabel="Zamknij"
  accessibilityRole="button"
>
  <X size={24} />
</Pressable>
```

**Decorative icon (z tekstem obok):** `accessibilityElementsHidden={true}` na ikonie, label na rodzicu/tekście. Inaczej VoiceOver przeczyta dwa razy.

```tsx
<Pressable accessibilityLabel="Dodaj nowy item" accessibilityRole="button">
  <View pointerEvents="none" className="flex-row items-center gap-2">
    <Plus size={20} aria-hidden />
    <Text>Dodaj</Text>
  </View>
</Pressable>
```

**`accessibilityRole`:** zawsze gdy klikalne. `button` dla akcji, `link` dla nawigacji do innej strony.

---

## Performance — SVG vs PNG vs font icons

| Format | Plusy | Minusy | Werdykt |
|--------|-------|--------|---------|
| **SVG** (react-native-svg / Lucide) | Skalowalny bez utraty jakości, zmienia color, mały rozmiar | Każdy SVG = paint cycle, lista 100+ ikon SVG = jank | **Default** |
| **PNG** | Szybkie renderowanie | Multi-density (1x/2x/3x), brak tintowania bez `tintColor`, fix color | Tylko gdy SVG nie wchodzi (kompleks ilustracje) |
| **Icon fonts** | Bardzo małe | Anti-pattern w RN (problemy z linkowaniem), gorsza a11y, alignment problems | **Unikaj** |

**Lista 100+ ikon w FlashList:** memoizuj `renderItem`, przekazuj `size` jako stała, NIE re-renderuj ikon na każdy scroll. Jeśli ikona się NIE zmienia — `React.memo` na komponencie wrappującym.

**`expo-image` dla ilustracji rasterowych:** lepszy cache, lazy loading, mniej re-renderów niż `<Image>`.

---

## Code patterns

### Lucide icon w button (cross-platform)

```tsx
import { Pressable, Text, View } from 'react-native';
import { Search } from 'lucide-react-native';

export function SearchButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Szukaj"
      accessibilityRole="button"
      className="h-11 w-11 items-center justify-center rounded-full active:opacity-60"
    >
      <Search size={24} strokeWidth={1.5} colorClassName="accent-foreground" />
    </Pressable>
  );
}
```

### SF Symbol via `expo-symbols` (iOS) z fallbackiem Lucide (Android)

```tsx
import { Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Heart } from 'lucide-react-native';

interface FavoriteIconProps {
  isActive: boolean;
  size?: number;
}

export function FavoriteIcon({ isActive, size = 24 }: FavoriteIconProps) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={isActive ? 'heart.fill' : 'heart'}
        size={size}
        tintColor={isActive ? '#ef4444' : '#6b7280'}
        weight="medium"
      />
    );
  }

  return (
    <Heart
      size={size}
      strokeWidth={1.5}
      fill={isActive ? '#ef4444' : 'transparent'}
      color={isActive ? '#ef4444' : '#6b7280'}
    />
  );
}
```

### Sizing system w `@theme`

```css
/* global.css */
@theme {
  /* Icon size tokens */
  --spacing-icon-xs: 16px;
  --spacing-icon-sm: 20px;
  --spacing-icon-md: 24px;
  --spacing-icon-lg: 28px;
  --spacing-icon-xl: 32px;
}
```

```tsx
// Użycie — wrapper na ikonie
<View className="h-icon-md w-icon-md items-center justify-center">
  <Plus size={24} />
</View>
```

### Memoizowana ikona w liście

```tsx
import { memo } from 'react';
import { ChevronRight } from 'lucide-react-native';

export const ListChevron = memo(function ListChevron() {
  return <ChevronRight size={20} strokeWidth={1.5} colorClassName="accent-muted-foreground" />;
});
```

---

## Checklist — przed mergem

- [ ] Jedna biblioteka per app (lub świadomy mix iOS native + Lucide)
- [ ] Wszystkie ikony tego samego stroke width
- [ ] `size` prop, nie hardcoded width/height na SVG
- [ ] `accessibilityLabel` na każdym icon-only buttonie
- [ ] `accessibilityElementsHidden` na dekoracyjnej ikonie obok tekstu
- [ ] Touch target minimum 44x44 (lub `hitSlop`)
- [ ] Color przez theme token, nie hex
- [ ] Outline default, filled tylko na active state
- [ ] Semantic icon (search = lupa, settings = gear) — bez kreatywności
- [ ] Test w dark mode — kontrast ikony do tła
- [ ] Test w 200% font scale — czy ikona dalej "pasuje" obok tekstu

---

## Powiązane

- `[[typography.md]]` — line-height matchowanie ikona+tekst
- `[[states-loading-empty-error.md]]` — empty state hero icons
- `[[platform-conventions.md]]` — kiedy SF Symbols vs Material Symbols
- `[[app-icon-splash.md]]` — app icon vs UI icons (różne pryncypia)

---

## Źródła

- Apple HIG — SF Symbols (developer.apple.com/design/human-interface-guidelines/sf-symbols)
- Material 3 Icons (m3.material.io/styles/icons)
- Lucide (lucide.dev)
- Heroicons (heroicons.com)
- expo-symbols docs (docs.expo.dev/versions/latest/sdk/symbols)
- WCAG 2.2 — 2.5.8 Target Size (Minimum)

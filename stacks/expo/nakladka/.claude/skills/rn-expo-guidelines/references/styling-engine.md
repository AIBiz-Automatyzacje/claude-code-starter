# Silnik stylowania

Kontrakt szablonu nad Uniwind Free. Setup i pełne API opisuje skill `uniwind`.

## Tokeny

Tokeny leżą w `@theme` w `global.css`. Nie ma `tailwind.config.*`. Motywy definiują ten sam zestaw zmiennych; rozjazd daje błąd w czasie działania.

## Skala i makieta

`rem` to 16 px, więc skala jest jak na webie: `p-4` = 16, `text-sm` = 14/20. Wartość arbitralna w `px` równa się pt (`w-[16px]` = 16), więc „1 pt Figma = 1 px” działa wprost. Sprawdzone na iOS i Androidzie w spike'u SDK 58.

Z makiety bierzesz token, gdy istnieje. Wartość arbitralna zostaje dla pomiaru bez tokenu.

## Klasy dynamiczne

Tailwind skanuje klasy w czasie budowania, więc `bg-${kolor}-500` nie działa. Używasz kompletnych literałów, mapy wariantów albo operatora warunkowego. Scalanie klas z propsów: `cn()` z `tailwind-merge`.

## Kolory poza `style`

Propsy koloru spoza obiektu `style` dostają własny prop `*ClassName` z klasą `accent-*`:

```tsx
<TextInput
  className="h-12 px-4 border border-border rounded-xl text-foreground"
  placeholderTextColorClassName="accent-muted"
  cursorColorClassName="accent-primary"
  selectionColorClassName="accent-primary"
/>
<ActivityIndicator colorClassName="accent-primary" />
```

Prefiks działa też z własnym tokenem. `text-*` na tych propsach nic nie zmienia.

## `TextInput` i `lineHeight`

Klasa `text-lg` niesie `lineHeight: 28`, a przy `lineHeight` wpisany tekst siedzi na iOS ok. 7 pt poniżej środka pola. W polu używasz `text-[18px]` bez `lineHeight`. Android nie ma tego przesunięcia. Nie wiadomo, czy przyczyna leży w RN, czy w Uniwind.

## Komponenty firm trzecich

```tsx
import { Image as ExpoImage } from 'expo-image'
import { withUniwind } from 'uniwind'

export const Image = withUniwind(ExpoImage)
```

Komponentów `react-native` i Reanimated nie owijasz: mają `className` wbudowany, a owinięcie psuje zachowanie.

## Co działa bez obejść

Sprawdzone na obu platformach: `leading-*` i sufiks `--text-*--line-height` w `@theme`, `translate` w procentach, `shadow-*` (kompiluje się do `boxShadow`).

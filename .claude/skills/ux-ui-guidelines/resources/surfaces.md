# Surfaces

Border radius, optical alignment, shadows, image outlines, hit areas — micro-detale powierzchni które sprawiają, że UI wygląda dopracowany.

---

## Concentric Border Radius

Przy zagnieżdżaniu zaokrąglonych elementów zewnętrzny radius musi równać się wewnętrznemu plus padding między nimi:

```
outerRadius = innerRadius + padding
```

Reguła jest najbardziej użyteczna gdy zagnieżdżone powierzchnie są blisko siebie. Jeśli padding jest większy niż `24px`, traktuj warstwy jako osobne powierzchnie i wybierz każdy radius niezależnie zamiast wymuszać ścisłą koncentryczną matematykę.

### Przykład

```css
/* Good — concentric radii */
.card {
  border-radius: 20px; /* 12 + 8 */
  padding: 8px;
}
.card-inner {
  border-radius: 12px;
}

/* Bad — same radius on both */
.card {
  border-radius: 12px;
  padding: 8px;
}
.card-inner {
  border-radius: 12px;
}
```

### Tailwind

```tsx
// Good — outer radius accounts for padding
<div className="rounded-2xl p-2">       {/* 16px radius, 8px padding */}
  <div className="rounded-lg">          {/* 8px radius = 16 - 8 ✓ */}
    ...
  </div>
</div>

// Bad — same radius on both
<div className="rounded-xl p-2">
  <div className="rounded-xl">          {/* same radius, looks off */}
    ...
  </div>
</div>
```

Niedopasowane radii w zagnieżdżonych elementach to jedna z najczęstszych rzeczy, które sprawiają, że interfejs wygląda "off". Zawsze licz koncentrycznie.

---

## Optical Alignment

Gdy geometryczne wycentrowanie wygląda źle, wyrównuj optycznie zamiast geometrycznie.

### Przyciski z tekstem + ikoną

Użyj nieco mniej paddingu po stronie ikony, żeby przycisk wyglądał na zbalansowany. Niezawodna reguła:
`padding po stronie ikony = padding po stronie tekstu - 2px`.

```css
/* Good — less padding on icon side */
.button-with-icon {
  padding-left: 16px;
  padding-right: 14px; /* icon side = text side - 2px */
}

/* Bad — equal padding looks like icon is pushed too far right */
.button-with-icon {
  padding: 0 16px;
}
```

```tsx
// Tailwind
<button className="pl-4 pr-3.5 flex items-center gap-2">
  <span>Continue</span>
  <ArrowRightIcon />
</button>
```

### Trójkąty Play

Ikony Play są trójkątne i ich geometryczny środek nie jest ich wizualnym środkiem. Przesuń lekko w prawo:

```css
/* Good — optically centered */
.play-button svg {
  margin-left: 2px; /* shift right to account for triangle shape */
}

/* Bad — geometrically centered but looks off */
.play-button svg {
  /* no adjustment */
}
```

### Asymetryczne ikony (Stars, Arrows, Carets)

Niektóre ikony mają nierówny ciężar wizualny. Najlepszy fix to dostosowanie samego SVG, żeby w kodzie komponentu nie potrzeba było dodatkowych margin/padding.

```tsx
// Best — fix in the SVG itself
// Adjust the viewBox or path to visually center the icon

// Fallback — adjust with margin
<span className="ml-px">
  <StarIcon />
</span>
```

---

## Shadows zamiast Borders

Dla **przycisków, kart i kontenerów** używających border do głębi lub elewacji preferuj zastąpienie go subtelnym `box-shadow`. Cienie adaptują się do każdego tła (używają przezroczystości); solidne bordery nie. Pomaga to też przy obrazach lub wielu kolorach jako tło — solidne kolory bordera nie działają na tłach innych niż te, do których były projektowane.

**Nie stosuj tego do dividers** (`border-b`, `border-t`, side borders) ani żadnego bordera, którego celem jest separacja layoutu, nie głębia elementu. Te powinny zostać borderami.

### Shadow as Border (Light Mode)

Cień składa się z trzech warstw. Pierwsza działa jak 1px border ring, druga dodaje subtelne uniesienie, trzecia zapewnia ambient depth.

Wartości `rgba` stoją tylko w definicji tokenu (`:root` i `.dark` w `src/index.css`, wzorzec z [design-system.md](design-system.md)); komponent używa `var(--shadow-border)`. To ta sama zasada co zakaz kolorów wpisanych w komponent — sekcja „Kolory tylko przez tokeny” w design-system.md.

```css
/* src/index.css */
:root {
  --shadow-border:
    0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 2px -1px rgba(0, 0, 0, 0.06),
    0px 2px 4px 0px rgba(0, 0, 0, 0.04);
  --shadow-border-hover:
    0px 0px 0px 1px rgba(0, 0, 0, 0.08),
    0px 1px 2px -1px rgba(0, 0, 0, 0.08),
    0px 2px 4px 0px rgba(0, 0, 0, 0.06);
}
```

### Shadow as Border (Dark Mode)

W dark mode upraszczaj do pojedynczego białego ringu — warstwowe cienie głębi nie są widoczne na ciemnych tłach:

```css
/* src/index.css — dark mode przez klasę .dark (useTheme + @custom-variant dark z design-system.md) */
.dark {
  --shadow-border: 0 0 0 1px rgba(255, 255, 255, 0.08);
  --shadow-border-hover: 0 0 0 1px rgba(255, 255, 255, 0.13);
}
```

W Tailwind używasz tokenu przez wartość arbitralną ze zmienną: `shadow-(--shadow-border) hover:shadow-(--shadow-border-hover)`.

### Użycie z Hover Transition

Zastosuj zmienną i dodaj `transition-[box-shadow]` dla płynnego hover. `box-shadow` animujesz tylko przy zmianie stanu (hover, fokus) — ruch i wejście elementu idą przez `transform` i `opacity` ([animations.md](animations.md), sekcja „Które właściwości animujesz”):

```css
.card {
  box-shadow: var(--shadow-border);
  transition-property: box-shadow;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

.card:hover {
  box-shadow: var(--shadow-border-hover);
}
```

### Kiedy shadows vs borders

| Użyj shadows | Użyj borders |
| --- | --- |
| Karty, kontenery z głębią | Dividers między elementami listy |
| Przyciski z bordered styles | Granice komórek tabeli |
| Elewowane elementy (dropdowns, modale) | Form input outlines (dla a11y) |
| Elementy na zróżnicowanych tłach | Hairline separators w gęstym UI |
| Hover/focus states z efektem lift | |

---

## Image Outlines

Dodaj subtelny `1px` outline z niską przezroczystością do obrazów. Tworzy spójną głębię, szczególnie w design systems gdzie inne elementy używają borders lub shadows.

### Reguły kolorów

Kolor obrysu to token `--outline-image` zdefiniowany w `:root` i `.dark` ([design-system.md](design-system.md), sekcja „Kolory tylko przez tokeny”). Wartości poniżej wpisujesz tylko w tej definicji; obraz i komponent używają tokenu.

- **Light mode** (`:root`): czarny — `rgb(0 0 0 / 0.1)`. Dokładne wartości: R=0, G=0, B=0, przezroczystość 10%.
- **Dark mode** (`.dark`): biały — `rgb(255 255 255 / 0.1)`. Dokładne wartości: R=255, G=255, B=255, przezroczystość 10%.
- Nigdy nie używaj koloru bliskiego czarnemu/białemu z palety projektu (np. slate-900, zinc-900, `#0a0a0a`, `#111827`, `#f5f5f7`). Zabarwione outlines podchwytują kolor otaczającej powierzchni i czytają się jak brud na krawędzi obrazu.
- Nigdy nie dopasowuj outline do koloru akcentowego lub atramentowego projektu. Outline jest neutralnym separatorem, nie tematycznym elementem.

### Light Mode i Dark Mode — token

```css
/* src/index.css */
:root {
  --outline-image: rgb(0 0 0 / 0.1);
}

.dark {
  --outline-image: rgb(255 255 255 / 0.1);
}

@theme inline {
  --color-outline-image: var(--outline-image);
}
```

### Użycie w CSS

```css
img {
  outline: 1px solid var(--outline-image);
  outline-offset: -1px; /* inset so it doesn't add to layout */
}
```

### Tailwind z Dark Mode

```tsx
{/* Token sam przełącza się z .dark, więc wariant dark: nie jest potrzebny */}
<img
  className="outline -outline-offset-1 outline-outline-image"
  src={src}
  alt={alt}
/>
```

Używaj tokenu `outline-outline-image` — nie `outline-slate-*`, `outline-zinc-*`, `outline-neutral-*` ani żadnej zabarwionej skali, i nie wpisuj `outline-black/10` / `outline-white/10` w komponent: wartość zmieniasz wtedy w każdym miejscu zamiast w jednej definicji.

**Dlaczego outline zamiast border?** `outline` nie wpływa na layout (brak dodanej szerokości/wysokości), a `outline-offset: -1px` trzyma go inset, więc obrazy zachowują zamierzony rozmiar.

---

## Minimum Hit Area

Progi rozmiaru celu mają jedno źródło: [accessibility.md](accessibility.md#rozmiar-celu) (sekcja „Rozmiar celu”). Progi: cel ma co najmniej 24×24 px (WCAG 2.2 AA, 2.5.8 — próg twardy), a kontrolka dotykowa 44×44 px (`min-h-11 min-w-11`, Apple HIG / WCAG AAA 2.5.5). Jeśli widoczny element jest mniejszy (np. 20×20 checkbox), rozszerz hit area pseudo-elementem do 24×24 px, a przy wskaźniku dotykowym (`pointer: coarse`) do 44×44 px. Na desktopie obszar 44 px przykrywałby sąsiednie cele bez potrzeby, bo mysz trafia precyzyjnie.

### CSS

```css
/* Small checkbox with expanded hit area: 20px + 2 × 2px = 24px, na dotyku 20px + 2 × 12px = 44px */
.checkbox {
  position: relative;
  width: 20px;
  height: 20px;
}

.checkbox::after {
  content: "";
  position: absolute;
  inset: -2px;
}

@media (pointer: coarse) {
  .checkbox::after {
    inset: -12px;
  }
}
```

### Tailwind

```tsx
<button
  aria-label="Zaznacz"
  className="relative size-5 after:absolute after:-inset-0.5 pointer-coarse:after:-inset-3"
>
  <CheckIcon aria-hidden="true" />
</button>
```

### Reguła kolizji

Jeśli rozszerzony hit area nakłada się na inny interaktywny element, zmniejsz pseudo-element — ale zrób go tak dużym, jak to możliwe bez kolizji i nie mniejszym niż 24×24 px (próg AA; przy ciasnym układzie zwiększ odstęp między elementami). Dwa interaktywne elementy nigdy nie powinny mieć nakładających się hit areas.

---

## Zobacz Także

- [design-system.md](design-system.md) — border radius scale, shadows scale, z-index, tokeny kolorów (`:root`/`.dark`)
- [accessibility.md](accessibility.md#rozmiar-celu) — rozmiar celu (WCAG 2.5.8), jedno źródło progów
- [polish-checklist.md](polish-checklist.md) — pełna checklista polish

# Performance Polish

Specyfika transitions i hinty kompozycji GPU — micro-optymalizacje wydajności animacji.

---

## Transition Only What Changes

Nie używaj `transition: all` (w Tailwind: klasa z sufiksem `-all`) ani gołego Tailwindowego `transition`. W v4 gołe `transition` nie mapuje na `all`, tylko na stałą, szeroką listę właściwości, m.in.: kolory (`color`, `background-color`, `border-color`, `outline-color`, `fill`, `stroke`, stopnie gradientu), `opacity`, `box-shadow`, `transform`, `translate`, `scale`, `rotate`, `filter`, `backdrop-filter` i dyskretne `display`, `content-visibility`, `overlay`. To wciąż więcej, niż zwykle się zmienia, więc specyfikujesz konkretne properties.

### Dlaczego

- `transition: all` zmusza przeglądarkę do śledzenia każdej property pod kątem zmian
- Powoduje nieoczekiwane przejścia na properties, których nie zamierzałeś animować (kolory, padding, shadows); gołe `transition` z v4 robi to samo dla kolorów, cieni i filtrów z listy wyżej
- Blokuje optymalizacje przeglądarki

### CSS

Przykład animuje `scale` (naciśnięcie) i `background-color` (hover): kolor animujesz przy zmianie stanu elementu, a ruch i wejście — przez `transform` i `opacity` ([animations.md](animations.md), sekcja „Które właściwości animujesz”).

```css
/* Good — only transition what changes */
.button {
  transition-property: scale, background-color;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

/* Bad — transition everything */
.button {
  transition: all 150ms ease-out;
}
```

### Tailwind

```tsx
// Good — explicit properties
<button className="transition-[scale,background-color] duration-150 ease-out">

// Bad — gołe transition: w v4 szeroka lista właściwości (kolory, cień, transformacje, filtry), nie tylko te, które się zmieniają
<button className="transition duration-150 ease-out">
```

### Tailwind `transition-transform` — uwaga

`transition-transform` w Tailwind mapuje na `transition-property: transform, translate, scale, rotate` — pokrywa wszystkie properties związane z transform, nie tylko `transform`. Używaj tego, gdy animujesz tylko transformy. Dla wielu non-transform properties użyj składni z nawiasami: `transition-[scale,opacity,filter]`.

---

## Use `will-change` Sparingly

`will-change` podpowiada przeglądarce, żeby pre-promować element do własnej warstwy kompozycji GPU. Bez niego przeglądarka promuje element dopiero gdy animacja się zaczyna — ta jednorazowa promocja warstwy może powodować micro-stutter na pierwszej klatce.

To pomaga szczególnie gdy element zmienia `scale`, `rotation` lub porusza się z `transform`. Dla innych properties nie pomaga zbytnio — przeglądarka i tak nie może ich kompozycjonować na GPU.

### Reguły

```css
/* Good — specific property that benefits from GPU compositing */
.animated-card {
  will-change: transform;
}

/* Good — multiple compositor-friendly properties */
.animated-card {
  will-change: transform, opacity;
}

/* Bad — never use will-change: all */
.animated-card {
  will-change: all;
}

/* Bad — properties that can't be GPU-composited anyway */
.animated-card {
  will-change: background-color, padding;
}
```

### Useful Properties

| Property | GPU-compositable | Warto użyć `will-change` |
| --- | --- | --- |
| `transform` | Tak | Tak |
| `opacity` | Tak | Tak |
| `filter` (blur, brightness) | Tak | Tak |
| `clip-path` | Tak | Tak |
| `top`, `left`, `width`, `height` | Nie | Nie |
| `background`, `border`, `color` | Nie | Nie |

### Kiedy pomijać

Nowoczesne przeglądarki same dobrze optymalizują. Dodawaj `will-change` tylko gdy zauważysz first-frame stutter — szczególnie Safari na tym korzysta. Nie dodawaj prewencyjnie do każdego animowanego elementu; każda dodatkowa warstwa kompozycji kosztuje pamięć.

---

## Zobacz Także

- [animations.md](animations.md) — Motion patterns, View Transitions
- [animation-polish.md](animation-polish.md) — interruptible, subtle exits, scale on press
- [polish-checklist.md](polish-checklist.md) — pełna checklista polish

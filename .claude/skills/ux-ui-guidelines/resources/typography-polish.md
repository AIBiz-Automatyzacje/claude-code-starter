# Typography Polish

Micro-detale typografii sprawiające, że interfejs wygląda dopracowany — uzupełnia [design-system.md](design-system.md) (skala rozmiarów, weights, fluid) o detale renderingu.

---

## Text Wrapping

### text-wrap: balance

Rozkłada tekst równomiernie między linie, zapobiegając osieroconym słowom w nagłówkach i krótkich blokach. **Działa tylko na blokach do 6 linii** (Chromium) lub 10 linii (Firefox) — algorytm balansowania jest kosztowny obliczeniowo, więc przeglądarki ograniczają go do krótkich tekstów.

```css
/* Good — even line lengths on short text */
h1, h2, h3 {
  text-wrap: balance;
}
```

```css
/* Bad — default wrapping leaves orphans */
h1 {
  /* no text-wrap rule → "Read our
     blog" instead of balanced lines */
}
```

```css
/* Bad — balance on long paragraphs (silently ignored, wastes intent) */
.article-body p {
  text-wrap: balance;
}
```

**Tailwind:** `text-balance`

### text-wrap: pretty

Zapobiega osieroconym słowom (pojedynczemu słowu zwisającemu w ostatniej linii) przez dostosowanie podziałów linii w całym akapicie. W przeciwieństwie do `balance` nie próbuje wyrównywać długości linii — zapewnia tylko, że ostatnia linia nie jest żenująco krótka. Działa na tekście dowolnej długości bez limitu linii.

To powinno być **domyślne dla krótkich i średnich tekstów** — akapitów, opisów, podpisów, list, tekstu w kartach. Dla bardzo długich tekstów (10+ linii) pomijaj zarówno `pretty`, jak i `balance` — domyślne zawijanie przeglądarki jest wystarczające, a unikasz niepotrzebnego kosztu układu.

```css
/* Good — descriptions, captions, short paragraphs */
p, li, figcaption, blockquote {
  text-wrap: pretty;
}
```

```tsx
// Tailwind
<p className="text-pretty">
  A short paragraph that won't leave an orphan on the last line.
</p>
```

**Tailwind:** `text-pretty`

### Kiedy którego użyć

| Scenariusz | Użyj |
| --- | --- |
| Nagłówki, tytuły, gdzie liczy się równomierna dystrybucja | `text-wrap: balance` |
| Krótkie i średnie teksty — akapity, opisy, podpisy, UI text | `text-wrap: pretty` |
| Długi tekst (10+ linii), bloki kodu, formatowany tekst | Żadne — zostaw default |

---

## Font Smoothing (macOS)

Na macOS tekst renderuje się domyślnie cięższy niż zamierzono. Zastosuj antialiased smoothing do root layout, żeby wszystkie teksty renderowały się ostrzej i cieniej.

```css
/* CSS */
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

```html
<!-- Tailwind — w Vite SPA element <html> jest w index.html, nie w JSX, więc atrybut to class -->
<html lang="pl" class="antialiased">
```

### Good vs. Bad

```css
/* Good — applied once at the root */
html {
  -webkit-font-smoothing: antialiased;
}

/* Bad — applied per-element, inconsistent */
.heading {
  -webkit-font-smoothing: antialiased;
}
.body {
  /* no smoothing → heavier than heading */
}
```

**Uwaga:** Wpływa tylko na renderowanie macOS. Inne platformy ignorują te properties, więc bezpiecznie stosować uniwersalnie.

---

## Tabular Numbers

Gdy liczby aktualizują się dynamicznie (liczniki, ceny, timery, kolumny tabel), użyj `tabular-nums`, żeby wszystkie cyfry miały równą szerokość. Zapobiega to przesunięciu układu przy zmianie wartości.

```css
/* CSS */
.counter {
  font-variant-numeric: tabular-nums;
}
```

```tsx
// Tailwind
<span className="tabular-nums">{count}</span>
```

### Kiedy używać

| Użyj tabular-nums | Nie używaj tabular-nums |
| --- | --- |
| Liczniki i timery | Statyczne liczby do wyświetlania |
| Ceny, które się aktualizują | Dekoracyjne duże liczby |
| Kolumny tabel z liczbami | Numery telefonów, kody pocztowe |
| Animowane przejścia liczb | Numery wersji (v2.1.0) |
| Tablice wyników, dashboardy | |

### Caveat

Niektóre fonty (jak Inter) zmieniają wizualny wygląd cyfr przy tej property — konkretnie cyfra `1` staje się szersza i wycentrowana. To zachowanie oczekiwane i zwykle pożądane dla wyrównania, ale zweryfikuj, jak wygląda w Twoim konkretnym foncie.

```css
/* With Inter font:
   Default:  1234  → proportional, "1" is narrow
   Tabular:  1234  → all digits equal width, "1" centered */
```

---

## Zobacz Także

- [design-system.md](design-system.md) — typografia macro (skala, weights, fluid headlines)
- [polish-checklist.md](polish-checklist.md) — pełna checklista polish

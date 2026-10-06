# Design System

Paleta kolorów (OKLCH), typografia, spacing i design tokens - Tailwind v4.

---

## Konfiguracja Kolorów (Tailwind v4)

Ten plik jest jedynym źródłem wartości kolorów obu motywów i ich kontrastu. Wzorzec jest ten sam co
w `.claude/skills/tailwind-react-guidelines/resources/styling-guide.md` (sekcja „Tokeny CSS + dark variant”): tokeny
w `:root` i `.dark`, mapowanie na utility przez `@theme inline` i `@custom-variant dark`. styling-guide.md pokazuje
wzorzec tymi samymi liczbami i odsyła tutaj; wartość zmieniasz w tym pliku, a kopię w styling-guide.md dopasowujesz.

### src/index.css
```css
@import "tailwindcss";

/* Dark mode przez klasę .dark ustawianą przez useTheme (v4 nie ma darkMode w configu).
   Bez tej linii utility dark: reagują na prefers-color-scheme, a nie na klasę. */
@custom-variant dark (&:where(.dark, .dark *));

/* ===== KOLORY (OKLCH), tryb jasny ===== */
:root {
    /* Primary - niebieski CTA; biały tekst ~8:1 */
    --primary: oklch(0.45 0.26 264);
    --primary-foreground: oklch(1 0 0);

    /* Accent - zielony. Jasny odcień (L ≈ 0.65) z białym tekstem daje ~2,8:1, poniżej WCAG AA 4,5:1,
       więc L = 0.5: biały tekst ~5,3:1. */
    --accent: oklch(0.5 0.15 160);
    --accent-foreground: oklch(1 0 0);

    /* Destructive - czerwony; biały tekst ~5:1 */
    --destructive: oklch(0.55 0.25 27);
    --destructive-foreground: oklch(1 0 0);

    /* Success - token stoi pod tekstem (`bg-success text-success-foreground`) i jest kolorem tekstu
       (`text-success`), więc potrzebuje ≥ 4,5:1. L = 0.5 daje z białym ~5,6:1. Jasny odcień (L ≈ 0.65)
       ma ~3:1 — wystarcza na wypełnienie albo ikonę (próg 3:1), nie na tekst. */
    --success: oklch(0.5 0.15 145);
    --success-foreground: oklch(1 0 0);

    /* Warning - jasne wypełnienie z ciemnym tekstem (~7:1). Samo `--warning` jako kolor tekstu albo ikony
       na białym tle ma ~2,3:1, poniżej progu 3:1 dla ikon. Tekst i ikona ostrzeżenia na tle aplikacji
       (Alert, ikona statusu) biorą `--warning-text` (`text-warning-text`): ~6:1 na białym tle, ~5,7:1 na `bg-warning/10`. */
    --warning: oklch(0.75 0.15 85);
    --warning-foreground: oklch(0.25 0.02 60);
    --warning-text: oklch(0.5 0.11 70);

    /* Neutralne */
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0.039 264);

    --muted: oklch(0.96 0.005 264);
    /* L = 0.5: ~5,3:1 na `bg-muted` i ~6:1 na białym tle (L = 0.55 dawało 4,3:1) */
    --muted-foreground: oklch(0.5 0.02 264);

    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0.039 264);

    --border: oklch(0.922 0.012 264);
    --input: oklch(0.922 0.012 264);
    --ring: oklch(0.45 0.26 264);

    /* Obrys obrazów — neutralna czerń 10%, zob. surfaces.md (Image Outlines) */
    --outline-image: rgb(0 0 0 / 0.1);
}

/* ===== KOLORY, tryb ciemny ===== */
.dark {
    --background: oklch(0.145 0.039 264);
    --foreground: oklch(0.98 0.005 264);

    --muted: oklch(0.2 0.02 264);
    --muted-foreground: oklch(0.65 0.02 264);

    --card: oklch(0.18 0.02 264);
    --card-foreground: oklch(0.98 0.005 264);

    --border: oklch(0.3 0.02 264);
    --input: oklch(0.3 0.02 264);

    /* Kolory marki rozjaśnione: L 0.45–0.55 na ciemnym tle daje 2,4–3,9:1 (tekst, link, ring).
       Jasne wypełnienie dostaje ciemny tekst; każda para ma ≥ 6,8:1. */
    --primary: oklch(0.7 0.16 264);
    --primary-foreground: oklch(0.145 0.039 264);
    --ring: oklch(0.7 0.16 264);
    --accent: oklch(0.72 0.15 160);
    --accent-foreground: oklch(0.145 0.039 264);
    --destructive: oklch(0.7 0.19 22);
    --destructive-foreground: oklch(0.145 0.039 264);
    --success: oklch(0.72 0.17 145);
    --success-foreground: oklch(0.145 0.039 264);
    /* Warning: bez tych wartości ciemny `--warning-foreground` z :root zostałby ciemnym tekstem
       na ciemnym tle (~1,4:1). Wypełnienie z ciemnym tekstem ~10,5:1, tekst ostrzeżenia na tle ~10,5:1. */
    --warning: oklch(0.8 0.15 85);
    --warning-foreground: oklch(0.145 0.039 264);
    --warning-text: oklch(0.8 0.15 85);

    --outline-image: rgb(255 255 255 / 0.1);
}

/* Mapowanie tokenów na utility Tailwind (bg-primary, text-success, outline-outline-image, ...).
   inline: var() rozwiązuje się w miejscu użycia, więc wartości z .dark działają. */
@theme inline {
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-destructive: var(--destructive);
    --color-destructive-foreground: var(--destructive-foreground);
    --color-success: var(--success);
    --color-success-foreground: var(--success-foreground);
    --color-warning: var(--warning);
    --color-warning-foreground: var(--warning-foreground);
    --color-warning-text: var(--warning-text);
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-card: var(--card);
    --color-card-foreground: var(--card-foreground);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-ring: var(--ring);
    --color-outline-image: var(--outline-image);
}

/* Tokeny bez wersji ciemnej zostają w zwykłym @theme */
@theme {
    /* ===== TYPOGRAPHY ===== */
    --font-sans: "Inter", system-ui, sans-serif;

    /* ===== RADIUS (wartości domyślne v4) ===== */
    --radius-xs: 0.125rem;
    --radius-sm: 0.25rem;
    --radius-md: 0.375rem;
    --radius-lg: 0.5rem;
    --radius-xl: 0.75rem;
}
```

Kontrast par podany w komentarzach liczony jest wg WCAG (luminancja względna sRGB). Po zmianie wartości
sprawdź parę narzędziem z [accessibility.md](accessibility.md) (sekcja „Kontrast Kolorów”).

### Dark Mode Toggle
```typescript
// src/hooks/use-theme.ts
import { useEffect, useState } from 'react';
import { z } from 'zod';

const THEME_STORAGE_KEY = 'theme';
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

// localStorage to dane z zewnątrz (ręczna edycja, stara wersja aplikacji):
// wartość spoza listy albo brak wpisu daje 'system' zamiast rzutowania `as Theme`
const themeSchema = z.enum(['light', 'dark', 'system']).catch('system');
type Theme = z.infer<typeof themeSchema>;

interface UseThemeResult {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

export function useTheme(): UseThemeResult {
    // Vite SPA renderuje tylko w przeglądarce, więc window i localStorage zawsze istnieją
    const [theme, setTheme] = useState<Theme>(() =>
        themeSchema.parse(localStorage.getItem(THEME_STORAGE_KEY)),
    );

    useEffect(() => {
        const root = document.documentElement;
        const media = window.matchMedia(DARK_SCHEME_QUERY);
        const applyTheme = (): void => {
            const isDark = theme === 'dark' || (theme === 'system' && media.matches);
            root.classList.toggle('dark', isDark);
        };

        applyTheme();
        localStorage.setItem(THEME_STORAGE_KEY, theme);

        // W trybie 'system' motyw idzie za zmianą ustawień systemu; cleanup odpina nasłuch
        media.addEventListener('change', applyTheme);
        return () => media.removeEventListener('change', applyTheme);
    }, [theme]);

    return { theme, setTheme };
}
```

### CSS light-dark() — Dark Mode bez JS
```css
/* Natywna funkcja CSS — bez klas, bez JavaScript.
   Wartości kolorów nadal stoją tylko w definicji tokenu; light-dark() wybiera wariant wg color-scheme. */
:root {
    color-scheme: light dark;
    --card: light-dark(oklch(1 0 0), oklch(0.18 0.02 264));
    --card-foreground: light-dark(oklch(0.145 0.039 264), oklch(0.98 0.005 264));
}

.card {
    background: var(--card);
    color: var(--card-foreground);
}
```

**Kiedy `light-dark()` vs class-based:**
| CSS `light-dark()` | Class-based (`.dark`) |
|---------------------|----------------------|
| Automatyczne z systemem | Pełna kontrola (toggle) |
| Zero JavaScript | Wymaga JS dla toggle |
| Prostsze CSS | Kompatybilne z shadcn/ui |

**Rekomendacja:** Dla shadcn/ui pozostań przy class-based (`.dark`), ponieważ shadcn wymaga JS toggle. `light-dark()` przydatna dla prostych stron bez komponentów.

---

## Dlaczego OKLCH?

### Problem z HSL
```css
/* HSL - różna percepcja jasności */
--blue: hsl(220, 100%, 50%);   /* Wydaje się ciemniejszy */
--yellow: hsl(60, 100%, 50%);  /* Wydaje się jaśniejszy */
/* Obie mają L=50%, ale wyglądają inaczej */
```

### OKLCH Rozwiązanie
```css
/* OKLCH - perceptually uniform */
--blue: oklch(0.6 0.2 264);    /* Rzeczywiście ta sama jasność */
--yellow: oklch(0.6 0.2 90);   /* co żółty */
```

### Składnia OKLCH
```
oklch(L C H)
│     │ │ └─ Hue: 0-360 (kolor na kole)
│     │ └─── Chroma: 0-0.4 (nasycenie)
│     └───── Lightness: 0-1 (jasność)
```

### Popularne Hue Values

| Kolor | Hue |
|-------|-----|
| Red | 27 |
| Orange | 60 |
| Yellow | 90 |
| Green | 145 |
| Teal | 180 |
| Blue | 264 |
| Purple | 300 |
| Pink | 0 |

---

## Użycie Kolorów

### Kolory tylko przez tokeny

Wartość koloru (`#hex`, `rgb()`, `rgba()`, `oklch()`, klasa arbitralna `bg-[#1a73e8]`) wpisujesz tylko w definicji
tokenu w `:root` i `.dark`; komponent, klasa CSS i styl inline używają tokenu (`bg-primary`, `var(--outline-image)`).
To ta sama zasada co „Hardcoded Colors” w `.claude/skills/tailwind-react-guidelines/resources/styling-guide.md`,
a powód jest praktyczny: kolor zależny od motywu ma dwie wartości, a zmieniasz je w jednym miejscu.

Wartości z plików polish (obrys obrazów `rgb(0 0 0 / 0.1)` i `rgb(255 255 255 / 0.1)`, cienie
`--shadow-border` z [surfaces.md](surfaces.md)) też są tokenami: stoją w `:root`/`.dark`, a komponent używa
`outline-outline-image` albo `var(--shadow-border)`. Klasa palety z przezroczystością, której kolor nie zmienia
się z motywem (`bg-black/50` pod tłem modala), może zostać w komponencie.

### Semantyczne Klasy
```typescript
// Background & Text
<div className="bg-background text-foreground" />
<div className="bg-muted text-muted-foreground" />
<div className="bg-card text-card-foreground" />

// Brand colors
<button className="bg-primary text-primary-foreground" />
<span className="text-destructive" />
<div className="bg-accent text-accent-foreground" />

// Borders
<div className="border border-border" />
<input className="border border-input" />

// Focus ring
<button className="focus-visible:ring-2 focus-visible:ring-ring" />
```

### Opacity Variants
```typescript
<div className="bg-primary/10" />     // 10% opacity
<div className="bg-primary/50" />     // 50% opacity
<button className="hover:bg-primary/90" />
```

### color-mix() — Natywna Manipulacja Kolorami
```css
/* Baseline Widely Available — bezpieczne w produkcji */

/* Rozjaśnianie/przyciemnianie */
.hover-lighter {
    background: color-mix(in oklch, var(--color-primary) 80%, white);
}

/* Semi-transparent */
.overlay {
    background: color-mix(in oklch, var(--color-primary) 30%, transparent);
}

/* Mieszanie dwóch kolorów */
.blend {
    color: color-mix(in oklch, var(--color-primary), var(--color-accent));
}
```

### Relative Color Syntax (Nowe)
```css
/* Manipulacja komponentów koloru — Baseline Newly Available (Chrome, Edge, Safari, Firefox) */
.darker-primary {
    color: oklch(from var(--color-primary) calc(l - 0.1) c h);
}

.desaturated {
    color: oklch(from var(--color-primary) l calc(c * 0.5) h);
}
```

### Status Colors
```typescript
// Success
<Badge className="bg-success text-success-foreground">
    Zapisano
</Badge>

// Warning — wypełnienie z ciemnym tekstem; sam tekst ostrzeżenia na tle aplikacji: text-warning-text
<Badge className="bg-warning text-warning-foreground">
    Uwaga
</Badge>
<p className="text-sm text-warning-text">Sesja wygasa za 5 minut</p>

// Destructive
<Badge className="bg-destructive text-destructive-foreground">
    Błąd
</Badge>
```

---

## Gradienty Kategorii
```typescript
// src/constants/gradients.ts
// Biały tekst text-xs potrzebuje ≥ 4,5:1 także na jaśniejszym końcu gradientu.
// Odcienie 500 dają z białym 2,2–4,8:1 (green-500 ~2,2:1), odcienie 700 — co najmniej ~4,9:1.
const DEFAULT_CATEGORY_GRADIENT = 'from-gray-700 to-gray-800';

export const CATEGORY_GRADIENTS = {
    'Technology': 'from-blue-700 to-blue-800',
    'Business': 'from-green-700 to-green-800',
    'Design': 'from-purple-700 to-purple-800',
    'Marketing': 'from-orange-700 to-orange-800',
    'Sales': 'from-pink-700 to-pink-800',
    'Education': 'from-indigo-700 to-indigo-800',
    'Other': 'from-red-700 to-red-800',
} as const satisfies Record<string, string>;

type GradientCategory = keyof typeof CATEGORY_GRADIENTS;

// Strażnik typu zamiast indeksu stringiem: CATEGORY_GRADIENTS[category] przy category: string
// to w trybie strict błąd TS7053, a kategoria z danych może być spoza listy
function isGradientCategory(category: string): category is GradientCategory {
    return Object.hasOwn(CATEGORY_GRADIENTS, category);
}

export function getCategoryGradient(category: string): string {
    return isGradientCategory(category) ? CATEGORY_GRADIENTS[category] : DEFAULT_CATEGORY_GRADIENT;
}

// Użycie (v4: bg-linear-to-r; bg-gradient-to-r to nazwa z v3)
<span className={cn(
    "px-2 py-1 rounded-full text-xs font-medium text-white",
    "bg-linear-to-r",
    getCategoryGradient(category)
)}>
    {category}
</span>
```

### Custom OKLCH Gradient
```css
/* src/index.css — dla bardziej precyzyjnych gradientów.
   @utility zamiast zwykłej klasy: działa z wariantami (hover:, md:) i stoi w warstwie utilities.
   Kolory z tokenu: drugi koniec to primary przyciemniony i przesunięty w odcieniu (relative color syntax). */
@utility gradient-brand {
    background: linear-gradient(
        135deg,
        var(--color-primary) 0%,
        oklch(from var(--color-primary) calc(l - 0.1) c calc(h + 16)) 100%
    );
}
```

---

## Typografia

### Font Stack
```css
font-family: "Inter", system-ui, -apple-system, sans-serif;
```

### Skala Rozmiarów

| Klasa | Rozmiar | Line Height | Użycie |
|-------|---------|-------------|--------|
| `text-xs` | 12px | 16px | Metadata, timestamps |
| `text-sm` | 14px | 20px | Body text |
| `text-base` | 16px | 24px | Body emphasis |
| `text-lg` | 18px | 28px | Card titles |
| `text-xl` | 20px | 28px | Section headers |
| `text-2xl` | 24px | 32px | Page titles |
| `text-3xl` | 30px | 36px | Hero subheading |
| `text-4xl` | 36px | 40px | Hero headline |

### Fluid Typography (Headlines)

To jedyna definicja klas `text-fluid-*` w skillu; [responsive-design.md](responsive-design.md) (sekcja Fluid Typography) ich używa i linkuje tutaj. Nowy stopień skali dopisujesz w tym bloku.
```css
/* src/index.css — @utility (v4) zamiast zwykłej klasy, żeby działały warianty (md:text-fluid-3xl) */
@utility text-fluid-xl {
    font-size: clamp(1.25rem, 1rem + 1vw, 1.5rem);
}

@utility text-fluid-2xl {
    font-size: clamp(1.5rem, 1rem + 2vw, 2.25rem);
}

@utility text-fluid-3xl {
    font-size: clamp(1.875rem, 1.25rem + 2.5vw, 3rem);
}
```
```typescript
// Użycie
<h1 className="text-fluid-3xl font-bold">
    Hero Headline
</h1>
```

### Font Weights
```typescript
<p className="font-normal">Normal (400)</p>
<p className="font-medium">Medium (500)</p>
<p className="font-semibold">Semibold (600)</p>
<p className="font-bold">Bold (700)</p>
```

### Typowe Kombinacje
```typescript
<h1 className="text-2xl font-bold">Page Title</h1>
<h2 className="text-xl font-semibold">Section Title</h2>
<h3 className="text-lg font-medium">Card Title</h3>
<p className="text-sm text-muted-foreground">Body text</p>
<span className="text-xs font-medium uppercase tracking-wide">Label</span>
```

### Hierarchia Nagłówków (A11y)
```typescript
// ✅ Poprawna hierarchia
<h1>Tytuł strony</h1>           // Jeden na stronę
  <h2>Sekcja główna</h2>
    <h3>Podsekcja</h3>
      <h4>Szczegóły</h4>

// ❌ Nie pomijaj poziomów
<h1>Tytuł</h1>
<h3>Sekcja</h3>  // Błąd - pominięty h2!
```

### Polish detale typografii

Dla detali renderingu (text-wrap balance/pretty, font-smoothing macOS, tabular-nums dla dynamicznych liczb) → [typography-polish.md](typography-polish.md).

---

## Spacing

### Skala

| Value | Pixels | Rem | Użycie |
|-------|--------|-----|--------|
| 1 | 4px | 0.25rem | Minimal gaps |
| 2 | 8px | 0.5rem | Tight spacing |
| 3 | 12px | 0.75rem | Small gaps |
| 4 | 16px | 1rem | Standard |
| 5 | 20px | 1.25rem | |
| 6 | 24px | 1.5rem | Card padding |
| 8 | 32px | 2rem | Section gaps |
| 10 | 40px | 2.5rem | |
| 12 | 48px | 3rem | Large sections |
| 16 | 64px | 4rem | Page sections |

### Padding
```typescript
<Card className="p-6" />           // 24px
<Button className="px-4 py-2" />   // 16px / 8px
<Input className="px-3 py-2" />    // 12px / 8px
<Badge className="px-2 py-0.5" />  // 8px / 2px
```

### Gap
```typescript
<div className="flex gap-2" />     // 8px
<div className="flex gap-4" />     // 16px
<div className="grid gap-4" />     // 16px
<div className="grid gap-6" />     // 24px (cards)
```

### Margin / Space
```typescript
<div className="space-y-4" />      // 16px between children
<div className="space-y-6" />      // 24px
<section className="mt-8 mb-12" /> // Sections
```

---

## Border Radius

Nazwy Tailwind v4 (w v3 `rounded-sm` było 2px, a `rounded` 4px — v4 przesunęło skalę o jeden stopień):

| Class | Value | Użycie |
|-------|-------|--------|
| `rounded-xs` | 2px | Subtle |
| `rounded-sm` | 4px | Default (gołe `rounded` też daje 4px) |
| `rounded-md` | 6px | Buttons, inputs |
| `rounded-lg` | 8px | Cards |
| `rounded-xl` | 12px | Modals |
| `rounded-2xl` | 16px | Large cards |
| `rounded-full` | 9999px | Pills, avatars |
```typescript
<Card className="rounded-lg" />
<Button className="rounded-md" />
<Badge className="rounded-full" />
<Avatar className="rounded-full" />
{/* Dialog z shadcn/Radix nie renderuje elementu — klasy idą na DialogContent */}
<DialogContent className="rounded-xl" />
```

**Concentric radius (zagnieżdżone elementy):** outer = inner + padding. Niedopasowane radii to częsta przyczyna "off feel" → [surfaces.md](surfaces.md).

---

## Shadows

### Skala
Nazwy Tailwind v4 (v3 `shadow-sm` to w v4 `shadow-xs`, a v3 `shadow` to w v4 `shadow-sm`):
```typescript
shadow-2xs  // Hairline
shadow-xs   // Subtle
shadow-sm   // Default (gołe `shadow` daje to samo)
shadow-md   // Medium
shadow-lg   // Large
shadow-xl   // Extra large
shadow-2xl  // Maximum
```

### Użycie
```typescript
<Card className="shadow-xs" />
<Card className="hover:shadow-md transition-shadow" />
{/* Root Dialog i DropdownMenu nie renderują elementu — klasy idą na *Content */}
<DialogContent className="shadow-xl" />
<DropdownMenuContent className="shadow-lg" />
```

### Colored Shadows (CTA)
```typescript
// Primary button z colored shadow
<Button className={cn(
    "bg-primary text-primary-foreground",
    "shadow-lg shadow-primary/25",
    "hover:shadow-xl hover:shadow-primary/30"
)}>
    Call to Action
</Button>
```

### Custom Shadow (OKLCH)
```css
/* src/index.css — kolor z tokenu primary, więc cień idzie za motywem i zmianą marki */
@utility shadow-primary-glow {
    box-shadow:
        0 4px 14px 0 oklch(from var(--color-primary) l c h / 0.25),
        0 1px 3px 0 oklch(from var(--color-primary) l c h / 0.1);
}
```

### Shadow-as-border pattern

Dla kart i przycisków preferuj 3-warstwowy `box-shadow` zamiast solidnego bordera (cienie adaptują się do tła, bordery nie) → [surfaces.md](surfaces.md).

---

## Z-Index

| Class | Value | Użycie |
|-------|-------|--------|
| `z-0` | 0 | Base |
| `z-10` | 10 | Raised elements |
| `z-20` | 20 | Dropdowns |
| `z-30` | 30 | Sticky header |
| `z-40` | 40 | Overlays |
| `z-50` | 50 | Modals, toasts |
```typescript
<Header className="sticky top-0 z-30" />
<DropdownMenuContent className="z-20" />
<div className="fixed inset-0 bg-black/50 z-40" /> {/* Overlay */}
<DialogContent className="z-50" />
<Toaster className="z-50" />
```

---

## Transitions

### Duration
```typescript
duration-150  // Fast (hover, naciśnięcie, wyjście)
duration-200  // Default
duration-300  // Górna granica przejść UI (modale, panele, przejście strony)
```

Przejścia interfejsu trwają 150–300 ms, a wyjście jest krótsze niż wejście. Dłużej trwają tylko pętle ładowania (`animate-spin`, `animate-pulse`), bo nie blokują interakcji. Zasada animacji: [SKILL.md](../SKILL.md), przykłady w [animations.md](animations.md).

### Easing
```typescript
ease-in-out   // Default
ease-out      // Enter animations
ease-in       // Exit animations
```

### Common Patterns
```typescript
// Hover color change
<Button className="transition-colors duration-150" />

// Hover with transform — tylko właściwości, które się zmieniają (w v4 translate to osobna właściwość CSS);
// box-shadow animujesz przy zmianie stanu (hover, fokus), przesunięcie idzie przez translate
<Card className="transition-[box-shadow,translate] duration-200 hover:shadow-md hover:-translate-y-0.5" />

// Focus ring
<Input className="transition-shadow duration-150 focus:ring-2" />
```

Bez przejścia na wszystkie właściwości (`transition: all`): animuje każdą zmienioną właściwość, także te, których nie planujesz → [performance.md](performance.md).

---

## Icons

### Biblioteka: Lucide React
Sprawdź package.json; nową zależność zgłoś (w workflowie: w odchyleniach); instalujesz menedżerem z lockfile
projektu z dokładną wersją, np. `pnpm add -E lucide-react`.
```typescript
import { Search, Plus, ChevronRight, Loader2 } from 'lucide-react';
```

### Standardowe Rozmiary

| Context | Size | Class |
|---------|------|-------|
| Inline text | 16px | `h-4 w-4` |
| Buttons | 16-20px | `h-4 w-4` lub `h-5 w-5` |
| Navigation | 20px | `h-5 w-5` |
| Empty states | 48px | `h-12 w-12` |
| Hero icons | 64px+ | `h-16 w-16` |

### Użycie w Buttonach
```typescript
// Icon + text
<Button>
    <Plus className="mr-2 h-4 w-4" />
    Dodaj
</Button>

// Text + icon
<Button>
    Dalej
    <ChevronRight className="ml-2 h-4 w-4" />
</Button>

// Icon only - wymaga aria-label
<Button size="icon" aria-label="Szukaj">
    <Search className="h-4 w-4" aria-hidden="true" />
</Button>
```

### Loading Spinner
```typescript
<Button disabled={isPending}>
    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
    {isPending ? 'Zapisywanie...' : 'Zapisz'}
</Button>
```

### Kolory Ikon
```typescript
// Inherit from text
<Search className="h-4 w-4" />

// Muted
<Info className="h-4 w-4 text-muted-foreground" />

// Semantic
<CheckCircle className="h-4 w-4 text-success" />
<AlertTriangle className="h-4 w-4 text-warning-text" /> // text-warning na białym tle ma ~2,3:1 (próg ikon 3:1); text-warning-text ma wartość dla obu motywów
<XCircle className="h-4 w-4 text-destructive" />
```

### Popularne Ikony

| Akcja | Ikona |
|-------|-------|
| Szukaj | `Search` |
| Dodaj | `Plus` |
| Edytuj | `Pencil` |
| Usuń | `Trash2` |
| Zamknij | `X` |
| Menu | `Menu` |
| Ustawienia | `Settings` |
| User | `User` |
| Loading | `Loader2` (+ `animate-spin`) |
| Sukces | `Check`, `CheckCircle` |
| Błąd | `X`, `XCircle`, `AlertCircle` |
| Info | `Info` |
| Warning | `AlertTriangle` |
| Nawigacja | `ChevronRight`, `ChevronDown`, `ArrowLeft` |
| External link | `ExternalLink` |
| Copy | `Copy`, `ClipboardCopy` |
| Download | `Download` |
| Upload | `Upload` |
| Favorite | `Heart`, `Star` |
| More | `MoreHorizontal`, `MoreVertical` |

### Accessibility
```typescript
// Dekoracyjne - ukryj przed screen readers
<Search className="h-4 w-4" aria-hidden="true" />
<span>Szukaj</span>

// Standalone - wymaga label; sama ikona 16 px jest poniżej progu 24×24 px, więc przycisk ma 36 px
// na desktopie i 44 px przy wskaźniku dotykowym (rozmiar celu → accessibility.md, sekcja „Rozmiar celu”)
<button aria-label="Zamknij dialog" className="inline-flex size-9 items-center justify-center pointer-coarse:size-11">
    <X className="h-4 w-4" aria-hidden="true" />
</button>

// Status icons - dodaj sr-only text
<CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
<span className="sr-only">Sukces:</span>
<span>Zapisano pomyślnie</span>
```

## Podsumowanie

| Token | Standard |
|-------|----------|
| **Colors** | OKLCH w `:root`/`.dark`, mapowane przez `@theme inline`; w komponentach tylko tokeny |
| **Dark mode** | Klasa `.dark` + `@custom-variant dark (&:where(.dark, .dark *))` |
| **Kontrast** | Tekst ≥ 4,5:1, ikony i obramowania ≥ 3:1 (pary w komentarzach tokenów) |
| **Typography** | Inter, fluid dla headlines |
| **Spacing** | Wielokrotności 4px |
| **Radius** | `rounded-md` buttons, `rounded-lg` cards |
| **Shadows** | Colored dla CTA |
| **Z-index** | 30 header, 50 modals |

---

## Zobacz Także

- [accessibility.md](accessibility.md) - Contrast ratios
- [responsive-design.md](responsive-design.md) - Responsive spacing
- [animations.md](animations.md) - Transitions
- [typography-polish.md](typography-polish.md) - text-wrap, font-smoothing, tabular-nums
- [surfaces.md](surfaces.md) - concentric radius, shadow-as-border, image outlines, hit area
- [polish-checklist.md](polish-checklist.md) - 16 pryncypiów + checklista review
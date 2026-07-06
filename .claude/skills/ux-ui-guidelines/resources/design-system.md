# Design System

Paleta kolorów (OKLCH), typografia, spacing i design tokens - Tailwind v4.

---

## Konfiguracja Kolorów (Tailwind v4)

### globals.css
```css
@import "tailwindcss";

@theme {
    /* ===== COLORS (OKLCH) ===== */
    
    /* Primary - Niebieski CTA */
    --color-primary: oklch(0.55 0.25 264);
    --color-primary-foreground: oklch(1 0 0);
    
    /* Accent - Zielony */
    /* ⚠️ KONTRAST: accent (L≈0.65) + biały foreground (oklch(1 0 0)) daje ~2.5-3:1,
       poniżej WCAG AA 4.5:1 dla tekstu. Dla tekstu użyj ciemnego foreground
       (np. oklch(0.2 0.02 260)) LUB zejdź z tłem do ~L 0.45-0.5. */
    --color-accent: oklch(0.65 0.2 160);
    --color-accent-foreground: oklch(1 0 0);
    
    /* Destructive - Czerwony */
    --color-destructive: oklch(0.55 0.25 27);
    --color-destructive-foreground: oklch(1 0 0);
    
    /* Success */
    /* ⚠️ KONTRAST: success (L≈0.65) + biały foreground (oklch(1 0 0)) daje ~2.5-3:1,
       poniżej WCAG AA 4.5:1 dla tekstu. Dla tekstu użyj ciemnego foreground
       (np. oklch(0.2 0.02 260)) LUB zejdź z tłem do ~L 0.45-0.5.
       Jasny odcień jest OK jako wypełnienie/UI (próg 3:1), ale nie dla tekstu. */
    --color-success: oklch(0.65 0.2 145);
    --color-success-foreground: oklch(1 0 0);
    
    /* Warning */
    --color-warning: oklch(0.75 0.15 85);
    --color-warning-foreground: oklch(0.25 0.02 60);
    
    /* ===== NEUTRAL (Light Mode) ===== */
    
    --color-background: oklch(1 0 0);
    --color-foreground: oklch(0.2 0.02 260);
    
    --color-muted: oklch(0.96 0.005 260);
    --color-muted-foreground: oklch(0.55 0.02 260);
    
    --color-card: oklch(1 0 0);
    --color-card-foreground: oklch(0.2 0.02 260);
    
    --color-border: oklch(0.9 0.01 260);
    --color-input: oklch(0.9 0.01 260);
    --color-ring: oklch(0.55 0.25 264);
    
    /* ===== TYPOGRAPHY ===== */
    
    --font-sans: "Inter", system-ui, sans-serif;
    
    /* ===== RADIUS ===== */
    
    --radius-sm: 0.25rem;
    --radius-md: 0.375rem;
    --radius-lg: 0.5rem;
    --radius-xl: 0.75rem;
}

/* ===== DARK MODE (class-based for shadcn) ===== */
@layer base {
    .dark {
        --color-background: oklch(0.15 0.02 260);
        --color-foreground: oklch(0.95 0.01 260);
        
        --color-muted: oklch(0.2 0.02 260);
        --color-muted-foreground: oklch(0.65 0.02 260);
        
        --color-card: oklch(0.18 0.02 260);
        --color-card-foreground: oklch(0.95 0.01 260);
        
        --color-border: oklch(0.3 0.02 260);
        --color-input: oklch(0.3 0.02 260);
    }
}
```

### Dark Mode Toggle
```typescript
// hooks/useTheme.ts
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === 'undefined') return 'system';
        return (localStorage.getItem('theme') as Theme) || 'system';
    });

    useEffect(() => {
        const root = document.documentElement;
        
        if (theme === 'system') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', systemDark);
        } else {
            root.classList.toggle('dark', theme === 'dark');
        }
        
        localStorage.setItem('theme', theme);
    }, [theme]);

    return { theme, setTheme };
}
```

### CSS light-dark() — Dark Mode bez JS
```css
/* Natywna funkcja CSS — bez klas, bez JavaScript */
:root {
    color-scheme: light dark;
}

.card {
    background: light-dark(oklch(1 0 0), oklch(0.18 0.02 260));
    color: light-dark(oklch(0.2 0.02 260), oklch(0.95 0.01 260));
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
/* Manipulacja komponentów koloru — cross-browser w 2026 */
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

// Warning
<Badge className="bg-warning text-warning-foreground">
    Uwaga
</Badge>

// Destructive
<Badge className="bg-destructive text-destructive-foreground">
    Błąd
</Badge>
```

---

## Gradienty Kategorii
```typescript
// constants/gradients.ts
export const CATEGORY_GRADIENTS = {
    'Technology': 'from-blue-500 to-blue-600',
    'Business': 'from-green-500 to-green-600',
    'Design': 'from-purple-500 to-purple-600',
    'Marketing': 'from-orange-500 to-orange-600',
    'Sales': 'from-pink-500 to-pink-600',
    'Education': 'from-indigo-500 to-indigo-600',
    'Other': 'from-red-500 to-red-600',
} as const;

// Użycie
<span className={cn(
    "px-2 py-1 rounded-full text-xs font-medium text-white",
    "bg-gradient-to-r",
    CATEGORY_GRADIENTS[category] ?? 'from-gray-500 to-gray-600'
)}>
    {category}
</span>
```

### Custom OKLCH Gradient
```css
/* Dla bardziej precyzyjnych gradientów */
.gradient-brand {
    background: linear-gradient(
        135deg,
        oklch(0.55 0.25 264) 0%,
        oklch(0.45 0.25 280) 100%
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
```css
/* globals.css */
.text-fluid-xl {
    font-size: clamp(1.25rem, 1rem + 1vw, 1.5rem);
}

.text-fluid-2xl {
    font-size: clamp(1.5rem, 1rem + 2vw, 2.25rem);
}

.text-fluid-3xl {
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

| Class | Value | Użycie |
|-------|-------|--------|
| `rounded-sm` | 2px | Subtle |
| `rounded` | 4px | Default |
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
<Dialog className="rounded-xl" />
```

**Concentric radius (zagnieżdżone elementy):** outer = inner + padding. Niedopasowane radii to częsta przyczyna "off feel" → [surfaces.md](surfaces.md).

---

## Shadows

### Skala
```typescript
shadow-sm   // Subtle
shadow      // Default
shadow-md   // Medium
shadow-lg   // Large
shadow-xl   // Extra large
shadow-2xl  // Maximum
```

### Użycie
```typescript
<Card className="shadow-sm" />
<Card className="hover:shadow-md transition-shadow" />
<Dialog className="shadow-xl" />
<Dropdown className="shadow-lg" />
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
/* globals.css */
.shadow-primary-glow {
    box-shadow: 
        0 4px 14px 0 oklch(0.55 0.25 264 / 0.25),
        0 1px 3px 0 oklch(0.55 0.25 264 / 0.1);
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
<DropdownMenu className="z-20" />
<div className="fixed inset-0 bg-black/50 z-40" /> {/* Overlay */}
<Dialog className="z-50" />
<Toaster className="z-50" />
```

---

## Transitions

### Duration
```typescript
duration-150  // Fast (hover states)
duration-200  // Default
duration-300  // Medium (modals)
duration-500  // Slow (page transitions)
```

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

// Hover with transform
<Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" />

// Focus ring
<Input className="transition-shadow duration-150 focus:ring-2" />
```

---

---

## Icons

### Biblioteka: Lucide React
```bash
npm install lucide-react
```
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
    <Search className="h-4 w-4" />
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
<AlertTriangle className="h-4 w-4 text-warning" />
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

// Standalone - wymaga label
<button aria-label="Zamknij dialog">
    <X className="h-4 w-4" />
</button>

// Status icons - dodaj sr-only text
<CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
<span className="sr-only">Sukces:</span>
<span>Zapisano pomyślnie</span>
```

## Podsumowanie

| Token | Standard |
|-------|----------|
| **Colors** | OKLCH w `@theme` |
| **Dark mode** | Class-based w `@layer base` |
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
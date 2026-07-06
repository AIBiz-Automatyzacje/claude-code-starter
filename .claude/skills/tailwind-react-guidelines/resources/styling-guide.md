# Przewodnik Stylowania

Wzorce stylowania z TailwindCSS v4, shadcn/ui i kompozycja klas.

---

## TailwindCSS v4 - CSS-First Configuration

### Koniec z tailwind.config.js

W Tailwind v4 konfiguracja jest w CSS, nie w JavaScript:
```css
/* globals.css */
@import "tailwindcss";

@theme {
    /* Kolory */
    --color-background: oklch(1 0 0);
    --color-foreground: oklch(0.145 0.039 264);
    --color-primary: oklch(0.45 0.26 264);
    --color-primary-foreground: oklch(1 0 0);
    --color-muted: oklch(0.96 0.005 264);
    --color-muted-foreground: oklch(0.556 0.022 264);
    --color-destructive: oklch(0.577 0.245 27);
    --color-border: oklch(0.922 0.012 264);
    --color-ring: oklch(0.45 0.26 264);
    
    /* Fonty */
    --font-sans: "Inter", sans-serif;
    --font-display: "Cal Sans", sans-serif;
    
    /* Animacje */
    --animate-fade-in: fade-in 0.3s ease-out;
    --animate-slide-up: slide-up 0.3s ease-out;
}

@keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slide-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
```

**Dlaczego CSS-first:**
- Szybszy (Oxide engine)
- Prostszy setup
- Brak Node.js do parsowania config

---

## Kolory: OKLCH zamiast HSL

OKLCH ma lepszą percepcję jasności - kolory wyglądają spójniej:
```css
/* STARE - HSL */
--primary: 212.3 100% 47.6%;

/* NOWE - OKLCH */
--color-primary: oklch(0.45 0.26 264);
```

### Użycie w komponentach
```typescript
// Tailwind automatycznie rozpoznaje --color-* zmienne
<div className="bg-background text-foreground" />
<button className="bg-primary text-primary-foreground" />
<span className="text-muted-foreground" />
<div className="border-border" />
```

---

## Podstawy Stylowania

### Preferuj Klasy Utility
```typescript
// TAK
<div className="flex flex-col gap-4 p-6 bg-background rounded-lg border">
    <h2 className="text-xl font-semibold">Tytuł</h2>
</div>

// NIE - inline styles
<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
```

### Grupowanie Klas
```typescript
<button
    className={cn(
        // Layout
        "flex items-center justify-center gap-2",
        // Rozmiar
        "h-10 px-4 py-2",
        // Typografia
        "text-sm font-medium",
        // Kolory
        "bg-primary text-primary-foreground",
        // Interakcje
        "hover:bg-primary/90 focus-visible:ring-2",
        // Przejścia
        "transition-colors duration-200"
    )}
>
    Przycisk
</button>
```

---

## Funkcja cn()
```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
```

### Użycie
```typescript
// Łączenie klas
<div className={cn("p-4 bg-card", "rounded-lg border")} />

// Warunkowe klasy
<div className={cn(
    "p-4 rounded-lg",
    isActive && "bg-primary text-primary-foreground",
    isDisabled && "opacity-50 cursor-not-allowed"
)} />

// Z props className (pozwala nadpisać z zewnątrz)
export const Card = ({ className, children }: CardProps) => (
    <div className={cn("p-4 bg-card rounded-lg border", className)}>
        {children}
    </div>
);
```

---

## Class Variance Authority (cva)

Standard dla komponentów z wariantami:
```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
    // Base styles
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90",
                destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                outline: "border border-input bg-background hover:bg-accent",
                secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {}

export const Button = ({ className, variant, size, ...props }: ButtonProps) => (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
);

// Użycie
<Button variant="destructive" size="lg">Usuń</Button>
```

---

## Dark Mode

### Jak działa
```typescript
// Kolory automatycznie się zmieniają
<div className="bg-background text-foreground">
    {/* Light: białe tło, ciemny tekst */}
    {/* Dark: ciemne tło, jasny tekst */}
</div>
```

### Definicja w CSS
```css
@import "tailwindcss";

@theme {
    --color-background: oklch(1 0 0);
    --color-foreground: oklch(0.145 0.039 264);
}

@media (prefers-color-scheme: dark) {
    :root {
        --color-background: oklch(0.145 0.039 264);
        --color-foreground: oklch(0.98 0.005 264);
    }
}

/* Lub z klasą */
.dark {
    --color-background: oklch(0.145 0.039 264);
    --color-foreground: oklch(0.98 0.005 264);
}
```

### Specyficzne style
```typescript
<div className={cn(
    "bg-white dark:bg-slate-900",
    "text-slate-900 dark:text-white"
)}>
```

**Zasada:** Preferuj design tokens (`bg-background`) nad explicit `dark:` gdy możliwe.

---

## shadcn/ui + Tailwind v4 Setup

W Tailwind v4 nie ma `tailwind.config.js` ani `darkMode: 'class'` - konfiguracja i wariant dark idą przez CSS. shadcn/ui integruje się przez `components.json` + tokeny CSS.

### Vite plugin
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()], // Brak postcss.config - plugin ogarnia Tailwind v4
});
```

### components.json
```json
{
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "new-york",
    "tailwind": {
        "config": "",
        "css": "src/index.css",
        "baseColor": "neutral",
        "cssVariables": true
    },
    "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }
}
```

### Tokeny CSS + dark variant
```css
/* src/index.css */
@import "tailwindcss";

/* Dark mode przez klasę .dark (v4 nie ma darkMode w configu) */
@custom-variant dark (&:is(.dark *));

:root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0.039 264);
    --primary: oklch(0.45 0.26 264);
    --primary-foreground: oklch(1 0 0);
    --border: oklch(0.922 0.012 264);
}

.dark {
    --background: oklch(0.145 0.039 264);
    --foreground: oklch(0.98 0.005 264);
    --border: oklch(0.3 0.02 264);
}

/* Mapowanie tokenów na utility Tailwind (bg-background, text-foreground, ...) */
@theme inline {
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-border: var(--border);
}
```

**Dlaczego `@theme inline`:** tokeny trzymamy w `:root`/`.dark` (żeby dark mode je nadpisywał), a `@theme inline` tylko generuje z nich utility - `var()` rozwiązuje się w miejscu użycia, więc `dark:` działa poprawnie.

---

## Responsywność

### Viewport Breakpoints (Mobile-First)

| Breakpoint | Min-width | Użycie |
|------------|-----------|--------|
| (default)  | 0px       | Mobile |
| `sm:`      | 640px     | Duży telefon |
| `md:`      | 768px     | Tablet |
| `lg:`      | 1024px    | Desktop |
| `xl:`      | 1280px    | Duży desktop |
```typescript
<div className={cn(
    // Mobile
    "flex flex-col gap-2 p-4",
    // Tablet
    "md:flex-row md:gap-4 md:p-6",
    // Desktop
    "lg:gap-6 lg:p-8"
)}>
```

### Container Queries (Standard 2026)

Komponent reaguje na szerokość kontenera, nie ekranu - lepsze dla reużywalnych komponentów:
```typescript
// Kontener
<div className="@container">
    <article className={cn(
        "flex flex-col",
        "@md:flex-row @md:gap-4"  // Zmienia gdy KONTENER ma ≥28rem
    )}>
        <div className="w-full @md:w-1/3">Sidebar</div>
        <div className="w-full @md:w-2/3">Content</div>
    </article>
</div>

// Named container
<div className="@container/card">
    <div className="@lg/card:grid-cols-2">
        {/* Reaguje na szerokość kontenera "card" */}
    </div>
</div>
```

**Kiedy Container Queries:**
- Karty, widgety (nie wiedzą gdzie są umieszczone)
- Komponenty w sidebarach vs main content
- Reużywalne komponenty biblioteczne

**Kiedy Viewport Queries:**
- Layout strony
- Nawigacja
- Zmiany globalne

---

## Dynamic Viewport Units

Rozwiązuje problemy z `100vh` na mobile (Safari toolbar):
```typescript
// STARE - problematyczne na mobile
<div className="min-h-screen" />

// NOWE - Dynamic Viewport Height
<div className="min-h-dvh" />  // Dynamicznie się dostosowuje

// Small Viewport (zawsze pomniejszone o toolbar)
<div className="min-h-svh" />

// Large Viewport (ignoruje toolbar)
<div className="min-h-lvh" />
```

**Rekomendacja:** Używaj `min-h-dvh` dla full-height layouts.

---

## Grid i Subgrid

### Podstawowy Grid
```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.map(item => <Card key={item.id} />)}
</div>
```

### Subgrid (Wyrównanie między kartami)
```typescript
// Karty z różną ilością contentu - nagłówki i footery się wyrównują
<div className="grid grid-cols-3 gap-4">
    {cards.map(card => (
        <article 
            key={card.id}
            className="grid grid-rows-subgrid row-span-3 gap-2"
        >
            <header className="font-bold">{card.title}</header>
            <p className="text-muted-foreground">{card.description}</p>
            <footer className="mt-auto">
                <Button>Action</Button>
            </footer>
        </article>
    ))}
</div>
```

---

## Typografia
```typescript
// xs: 12px - Metadata
<span className="text-xs text-muted-foreground">2 min temu</span>

// sm: 14px - Body text
<p className="text-sm">Główny tekst</p>

// base: 16px - Emphasis
<p className="text-base font-medium">Ważny tekst</p>

// lg: 18px - Card titles
<h3 className="text-lg font-semibold">Tytuł karty</h3>

// xl+: Headings
<h1 className="text-2xl md:text-4xl font-bold">Hero</h1>
```

### Text Truncation
```typescript
<p className="truncate">Jedna linia...</p>
<p className="line-clamp-2">Dwie linie...</p>
```

---

## Stany Interakcji
```typescript
<button className={cn(
    "bg-primary text-primary-foreground",
    "hover:bg-primary/90",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "transition-colors duration-200"
)}>
    Przycisk
</button>

// Active/Selected
<div className={cn(
    "p-4 rounded-lg border cursor-pointer",
    "hover:border-primary/50",
    "transition-all duration-200",
    isActive && "border-primary bg-primary/5"
)}>
```

---

## Animacje

### CSS Transitions
```typescript
<button className="hover:bg-primary/90 transition-colors duration-200">
<div className="hover:scale-105 transition-transform duration-300">
```

### Motion (złożone animacje)
```typescript
// Pakiet `motion` (dawniej framer-motion) - import z 'motion/react'
import { motion, AnimatePresence } from 'motion/react';

<motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
>

<AnimatePresence>
    {isOpen && (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            Modal
        </motion.div>
    )}
</AnimatePresence>
```

### View Transitions API (proste przejścia)

Natywne browser API dla prostych animacji przejść:
```typescript
import { flushSync } from 'react-dom';

const toggleTheme = () => {
    if (!document.startViewTransition) {
        setIsDark(!isDark);
        return;
    }
    
    document.startViewTransition(() => {
        flushSync(() => {
            setIsDark(!isDark);
        });
    });
};
```
```css
/* CSS obsługuje animację automatycznie */
::view-transition-old(root),
::view-transition-new(root) {
    animation-duration: 0.3s;
}
```

**Uwaga:** View Transitions API (same-document) jest wspierane w Chrome 111+, Firefox 133+ i Safari 18+. Cross-document transitions mają ograniczone wsparcie — używaj z feature detection.

---

## Nowe Utility (Tailwind v4.1+)

### Text Shadow
```typescript
<h1 className="text-shadow-sm">Subtelny cień</h1>
<h1 className="text-shadow-md text-shadow-primary/20">Kolorowy cień</h1>
```

### Mask Utilities
```typescript
// Gradient mask (fade out)
<div className="mask-linear-gradient mask-b-from-50%">
    <img src="hero.jpg" />
</div>
```

### @starting-style (Entry Animations)
```css
/* W globals.css - animacja przy pojawieniu się elementu */
dialog[open] {
    opacity: 1;
    transform: scale(1);

    @starting-style {
        opacity: 0;
        transform: scale(0.95);
    }
}
```
```typescript
// Tailwind v4.1+: starting variant
<div className="starting:opacity-0 starting:scale-95 transition-all duration-300">
    Content with entry animation
</div>
```

### Pointer Variants
```typescript
// Responsywność na podstawie urządzenia wskazującego
<button className={cn(
    "px-4 py-2",
    "pointer-fine:py-1.5 pointer-fine:text-sm",   // Mysz (precyzyjne)
    "pointer-coarse:py-3 pointer-coarse:text-base", // Dotyk (grube)
)}>
    Adaptive Button
</button>
```

### Tabular Numbers (font-variant-numeric)
```typescript
// Utility `tabular-nums` = font-variant-numeric: tabular-nums (równa szerokość cyfr)
<span className="tabular-nums">1234567890</span>
<span className="tabular-nums">$1,234.56</span>
```

---

### Reduced Motion
```typescript
// Hook
const usePrefersReducedMotion = () => {
    const [prefersReduced, setPrefersReduced] = useState(false);
    
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReduced(mq.matches);
        
        const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    
    return prefersReduced;
};

// CSS
<div className="motion-safe:animate-fade-in motion-reduce:opacity-100">
```

---

## Czego Unikać

### Inline Styles
```typescript
// NIE
<div style={{ padding: '16px' }}>

// TAK
<div className="p-4">
```

### Hardcoded Colors
```typescript
// NIE
<div className="bg-[#1a73e8]">

// TAK
<div className="bg-primary">
```

### tailwind.config.js (w v4)
```javascript
// NIE - przestarzałe w v4
module.exports = {
    theme: { extend: { colors: { ... } } }
}

// TAK - @theme w CSS
@theme {
    --color-brand: oklch(0.6 0.2 250);
}
```

### @apply w komponentach
```css
/* NIE */
.my-button { @apply px-4 py-2 bg-primary; }

/* TAK - klasy w JSX */
<button className="px-4 py-2 bg-primary">
```

**@apply OK dla:** Global styles, third-party components.

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Struktura komponentów
- [loading-and-error-states.md](./loading-and-error-states.md) - Loading states
- [performance.md](./performance.md) - Optymalizacja
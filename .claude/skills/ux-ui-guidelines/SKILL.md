---
name: ux-ui-guidelines
description: Wytyczne UX/UI dla React 19 + Tailwind v4. Design system (OKLCH colors), dostępność (WCAG 2.2, ARIA), responsive design (mobile-first, container queries), animacje (Motion, View Transitions, prefers-reduced-motion), UI patterns (navigation, tables, search, onboarding), interface polish (concentric radius, optical alignment, tabular numbers, scale 0.96 on press, font smoothing, image outlines, interruptible animations, shadow-as-border). Używaj przy projektowaniu UI, dostępności, animacjach, mobile UX oraz micro-detalach polish — "feels off", "interface polish", "border radius polish", "stagger animations", "tabular numbers", "scale on press".
---

# UX/UI Guidelines

## Cel

Przewodnik dla projektowania interfejsu użytkownika - design system, dostępność, responsywność, animacje, wzorce UI zgodne ze standardami Marzec 2026.

## Kiedy Używać Tego Skilla

- Projektowanie nowych komponentów UI
- Implementacja dostępności (WCAG 2.2, ARIA)
- Responsive design i container queries
- Animacje i przejścia
- Formularze i modale
- Mobile UX
- Nawigacja, tabele, wyszukiwanie, onboarding

---

## Quick Start

### Checklist Nowego Komponentu UI

- [ ] Mobile-first styling (zaczynaj od mobile)
- [ ] Container queries dla komponentów (`@container`)
- [ ] Focus visible dla nawigacji klawiaturą
- [ ] ARIA labels dla elementów interaktywnych
- [ ] Touch targets min 24x24px (WCAG 2.2 AA, 2.5.8), rekomendowane 44x44px (Apple HIG / cel AAA, 2.5.5)
- [ ] `prefers-reduced-motion` dla animacji
- [ ] Contrast ratio min 4.5:1 (WCAG AA)
- [ ] Dynamic viewport units (`min-h-dvh`)
- [ ] `<search>` element dla obszarów wyszukiwania
- [ ] Concentric border radius na zagnieżdżonych elementach (outer = inner + padding)
- [ ] `tabular-nums` na dynamicznych liczbach (licznik, timer, cena)
- [ ] `active:scale-[0.96]` na klikalnych przyciskach (gdzie sensowne)
- [ ] Konkretne `transition-property`, nigdy `transition: all`

### Checklist Formularza

- [ ] Labels powiązane z inputami (`htmlFor`)
- [ ] Komunikaty błędów z `role="alert"`
- [ ] Walidacja inline (nie tylko po submit)
- [ ] Loading state z `useTransition` lub mutation
- [ ] Success/error feedback (Sonner toast)
- [ ] Focus na pierwszym błędzie
- [ ] `aria-describedby` dla error messages

---

## Design System

### Paleta Kolorów (OKLCH)

OKLCH zapewnia lepszą percepcję jasności niż HSL:
```css
/* globals.css - Tailwind v4 */
@theme {
    /* Brand */
    --color-primary: oklch(0.55 0.25 264);        /* Niebieski CTA */
    --color-primary-foreground: oklch(1 0 0);     /* Biały tekst */
    --color-accent: oklch(0.65 0.2 160);          /* Zielony accent */
    --color-destructive: oklch(0.55 0.25 27);     /* Czerwony błędy */

    /* Neutral */
    --color-background: oklch(1 0 0);             /* Białe tło */
    --color-foreground: oklch(0.2 0.02 260);      /* Główny tekst */
    --color-muted: oklch(0.96 0.01 260);          /* Drugie tła */
    --color-muted-foreground: oklch(0.55 0.02 260); /* Drugie teksty */
    --color-border: oklch(0.9 0.01 260);          /* Obramowania */
}
```

### Skala Typografii

| Rozmiar | Użycie | Klasa |
|---------|--------|-------|
| 12px | Metadata, caption | `text-xs` |
| 14px | Body text | `text-sm` |
| 16px | Body emphasis | `text-base` |
| 18px | Card titles | `text-lg` |
| 20px | Section headers | `text-xl` |
| 24px+ | Page titles | `text-2xl` |

### Spacing
```
4px  = p-1, gap-1
8px  = p-2, gap-2
12px = p-3, gap-3
16px = p-4, gap-4
24px = p-6, gap-6
32px = p-8, gap-8
```

**[Pełny Przewodnik: resources/design-system.md](resources/design-system.md)**

---

## Topic Guides

### Dostępność (WCAG 2.2)

**Wymagania:**
- Contrast ratio min 4.5:1 dla tekstu
- Focus visible i nie zasłonięty (2.4.11 Focus Not Obscured)
- Touch targets min 24x24px (2.5.8 Target Size Minimum, AA); 44x44px to Apple HIG / cel AAA (2.5.5)
- ARIA labels dla ikon/przycisków
- Nagłówki w poprawnej hierarchii

**Kluczowe Wzorce:**
- `aria-label` dla przycisków z ikonami
- `role="alert"` + `aria-live="polite"` dla błędów
- `sr-only` dla tekstu screen reader only
- Focus trap w modalach (react-focus-lock)

**[Pełny Przewodnik: resources/accessibility.md](resources/accessibility.md)**

---

### Responsive Design

**Mobile-First + Container Queries:**
```typescript
// Tailwind v4 - container queries
<div className="@container">
    <div className="flex flex-col @md:flex-row @lg:gap-6">
        {/* Reaguje na rozmiar kontenera, nie viewportu */}
    </div>
</div>
```

**Breakpointy (viewport):**
- `sm: 640px` - Małe tablety
- `md: 768px` - Tablety
- `lg: 1024px` - Desktop

**Container queries (komponent):**
- `@sm: 320px`
- `@md: 448px`
- `@lg: 512px`

**Dynamic Viewport Units:**
```css
/* Uwzględnia mobile browser chrome */
min-h-dvh  /* dynamic viewport height */
min-h-svh  /* small viewport height */
min-h-lvh  /* large viewport height */
```

**[Pełny Przewodnik: resources/responsive-design.md](resources/responsive-design.md)**

---

### Animacje

**Motion (dawniej Framer Motion) Wzorce:**
- Fade in dla wchodzących elementów
- Staggered lists dla grup
- AnimatePresence dla mount/unmount

**View Transitions API (Baseline 2025):**
```typescript
function handleNavigation() {
    if (!document.startViewTransition) {
        navigate(path);
        return;
    }
    document.startViewTransition(() => navigate(path));
}
```

**Kluczowe Zasady:**
- `prefers-reduced-motion` - wymagane
- Krótkie animacje (150-300ms)
- Unikaj animacji layoutu (CLS)
- CSS animations > JS gdy możliwe

**[Pełny Przewodnik: resources/animations.md](resources/animations.md)**

---

### Komponenty UX

**Wzorce:**
- Modale z focus trap (react-focus-lock)
- Formularze z inline validation
- Toast notifications (Sonner)
- Loading states (useTransition)
- Optimistic updates (useOptimistic)

**[Pełny Przewodnik: resources/component-ux.md](resources/component-ux.md)**

---

### UI Patterns

**Nawigacja:**
- Tabs (URL-synced)
- Breadcrumbs z aria-label
- Pagination (number + cursor-based)

**Wyświetlanie danych:**
- Responsive tables (cards na mobile)
- Empty states
- Skeleton loading

**Wyszukiwanie i filtrowanie:**
- Debounced search input
- Filter chips
- URL state sync

**Onboarding:**
- Multi-step wizard ze StepIndicator
- Feature spotlight/tooltip
- Progress save (localStorage)

**[Pełny Przewodnik: resources/patterns.md](resources/patterns.md)**

---

### Interface Polish

Micro-detale, które sprawiają, że interfejs wygląda dopracowany — uzupełnia macro UX patterns o szczegóły renderingu i micro-interakcje.

**Główne kategorie:**
- **Typography polish** — text-wrap balance/pretty, font-smoothing macOS, tabular-nums dla dynamicznych liczb
- **Surfaces** — concentric border radius, optical alignment ikon, shadow-as-border, image outlines, minimum hit area 40×40px
- **Animation polish** — interruptible CSS transitions vs keyframes, subtelne wyjścia, contextual icon crossfade, `scale(0.96)` on press
- **Performance** — nigdy `transition: all`, `will-change` oszczędnie i tylko dla transform/opacity/filter

**Quick wins:**
- `tabular-nums` na każdym liczniku/timerze/cenie → zero layout shift
- `text-wrap: balance` na h1-h3 → zero osieroconych słów w nagłówkach
- `active:scale-[0.96]` na przyciskach → tactile feedback
- Concentric radius na zagnieżdżonych kartach → eliminuje "off" feel

**[Pełne Pryncypia: resources/polish-checklist.md](resources/polish-checklist.md)**

---

## Przykład: Komponent Button (2026)
```typescript
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionButtonProps {
    onClick: () => Promise<void>;
    children: React.ReactNode;
    disabled?: boolean;
}

export function ActionButton({ onClick, children, disabled }: ActionButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(async () => {
            await onClick();
        });
    };

    return (
        <Button
            onClick={handleClick}
            disabled={disabled || isPending}
            className={cn(
                "inline-flex items-center justify-center gap-2",
                "min-h-11 px-4",  // 44px touch target
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "transition-colors duration-200"
            )}
            aria-busy={isPending}
        >
            {isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {children}
        </Button>
    );
}
```

---

## Navigation Guide

| Potrzebujesz... | Przeczytaj |
|-----------------|------------|
| Kolory, typografia, spacing, ikony | [design-system.md](resources/design-system.md) |
| WCAG 2.2, ARIA, dostępność | [accessibility.md](resources/accessibility.md) |
| Mobile-first, container queries, mobile patterns | [responsive-design.md](resources/responsive-design.md) |
| Motion, View Transitions | [animations.md](resources/animations.md) |
| Modale, formularze, feedback | [component-ux.md](resources/component-ux.md) |
| Tabs, breadcrumbs, tables, search, onboarding | [patterns.md](resources/patterns.md) |
| Concentric radius, optical alignment, shadow-as-border, image outlines, hit area | [surfaces.md](resources/surfaces.md) |
| Interruptible animations, subtelne wyjścia, icon crossfade, scale on press | [animation-polish.md](resources/animation-polish.md) |
| text-wrap balance/pretty, font smoothing, tabular nums | [typography-polish.md](resources/typography-polish.md) |
| Transition specificity, `will-change` usage | [performance.md](resources/performance.md) |
| 16 pryncypiów polish + checklista review | [polish-checklist.md](resources/polish-checklist.md) |

---

## Główne Zasady 2026

1. **Mobile-First** + Container Queries
2. **WCAG 2.2** jako minimum (nowe: focus-not-obscured, target size)
3. **OKLCH colors** zamiast HSL
4. **Dynamic viewport** (`dvh`) zamiast `vh`
5. **Focus States** widoczne i nie zasłonięte
6. **Touch Targets** min 24x24px (WCAG 2.2 AA, 2.5.8); 44x44px to Apple HIG / cel AAA
7. **prefers-reduced-motion** obowiązkowo
8. **useTransition** dla loading states (nie useState)
9. **View Transitions** dla nawigacji (z fallbackiem)
10. **Popover API** dla tooltipów i non-modal popovers (natywny)
11. **`<search>` element** zamiast `role="search"`
12. **Concentric radius** — outer = inner + padding na zagnieżdżonych powierzchniach
13. **Tabular numbers** — `font-variant-numeric: tabular-nums` na dynamicznych liczbach
14. **Specyficzne transitions** — nigdy `transition: all`, zawsze konkretne properties
15. **Scale on press** — `0.96` (nigdy poniżej `0.95`) dla tactile feedback

---

## Powiązane Skills

- **tailwind-react-guidelines**: Komponenty React, Tailwind v4
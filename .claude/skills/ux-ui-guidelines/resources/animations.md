# Animacje

Motion (dawniej Framer Motion), View Transitions API, CSS animations.

---

## Motion (dawniej Framer Motion)

### Import
```typescript
// Nowy pakiet (rekomendowany dla nowych projektów)
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

// Stary pakiet (nadal działa, re-eksport z motion)
// import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
```

**Migracja:** Pakiet `framer-motion` został przemianowany na `motion` (wersja wg package.json; przy podbiciu majora sprawdź upgrade guide motion.dev). Import zmieniony z `framer-motion` na `motion/react`. Stary pakiet działa bez zmian.
Od v13 Motion nie używa automatycznie `@emotion/is-prop-valid` — przy styled-components/Emotion trzeba je jawnie wstrzyknąć przez `MotionConfig` (zob. upgrade guide).

Nowe projekty: sprawdź package.json; nową zależność zgłoś (w workflowie: w odchyleniach); instalujesz menedżerem
z lockfile projektu z dokładną wersją, np. `pnpm add -E motion`. Istniejące projekty z `framer-motion` nie wymagają
zmian: `motion/react` jest re-eksportem `framer-motion` (motion zależy od framer-motion), oba pakiety mają tę samą wersję.

### Reduced motion w korzeniu aplikacji

Przykłady Motion w tym pliku i w [animation-polish.md](animation-polish.md) zakładają `MotionConfig` w korzeniu
aplikacji. Z `reducedMotion="user"` Motion przy włączonym w systemie „ogranicz ruch” pomija animacje transformacji
(`x`, `y`, `scale`, `rotate`) i layoutu, a zostawia `opacity` i kolory — element pojawia się bez przesuwania.
Komponent, który ma inną treść animacji dla reduced motion (np. pulsowanie zamiast skakania), czyta
`useReducedMotion()` — przykłady w sekcji [prefers-reduced-motion](#prefers-reduced-motion).

```typescript
// src/app.tsx
import { MotionConfig } from 'motion/react';
import { RouterProvider } from 'react-router/dom';

import { router } from '@/router';

export function App() {
    return (
        <MotionConfig reducedMotion="user">
            <RouterProvider router={router} />
        </MotionConfig>
    );
}
```

### Podstawowe Animacje
```typescript
// Pod <MotionConfig reducedMotion="user">: przy reduced motion y i scale są pomijane, zostaje fade
// Fade in
<motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
>
    Zawartość
</motion.div>

// Fade in z przesunięciem
<motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
>
    Wchodzi od dołu
</motion.div>

// Scale in
<motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.2 }}
>
    Pojawia się z scale
</motion.div>
```

---

## Staggered Lists

### Variants Pattern
`TemplateGrid` przyjmuje gotową listę (`templates`), a dane pobiera komponent nadrzędny przez hook (`useTemplates` z `@/hooks/use-templates`) — to samo API co w [patterns.md](patterns.md).
```typescript
// src/components/template-grid.tsx
import { motion, type Variants } from 'motion/react';

import { TemplateCard } from '@/components/template-card';
import type { Template } from '@/schemas/template-schema';

// Pod <MotionConfig reducedMotion="user">: przy reduced motion elementy wchodzą samym fade, bez y
const CONTAINER_VARIANTS = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.07,
        },
    },
} satisfies Variants;

const ITEM_VARIANTS = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
} satisfies Variants;

export function TemplateGrid({ templates }: { templates: Template[] }) {
    return (
        <motion.div
            variants={CONTAINER_VARIANTS}
            initial="hidden"
            animate="show"
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
            {templates.map((template) => (
                <motion.div key={template.id} variants={ITEM_VARIANTS}>
                    <TemplateCard template={template} />
                </motion.div>
            ))}
        </motion.div>
    );
}
```

### Prostsza Wersja (delay)
```typescript
// Pod <MotionConfig reducedMotion="user"> — jak wyżej: przy reduced motion sam fade
{templates.map((template, index) => (
    <motion.div
        key={template.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
    >
        <TemplateCard template={template} />
    </motion.div>
))}
```

---

## AnimatePresence

### Podstawowe Użycie
```typescript
<AnimatePresence>
    {isVisible && (
        <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            Zawartość
        </motion.div>
    )}
</AnimatePresence>
```

### Mode Prop
```typescript
// mode="wait" - czeka na exit przed enter; w danej chwili renderujesz jedno dziecko
// (tu warunki wykluczają się, więc zawsze jest jedna zakładka)
<AnimatePresence mode="wait">
    {currentTab === 'a' && <TabA key="a" />}
    {currentTab === 'b' && <TabB key="b" />}
</AnimatePresence>

// mode="sync" (domyślny, gdy nie podasz mode) - exit i enter jednocześnie (crossfade)
<AnimatePresence mode="sync">
    {items.map(item => (
        <motion.div key={item.id} exit={{ opacity: 0 }}>
            {item.name}
        </motion.div>
    ))}
</AnimatePresence>

// mode="popLayout" - dla layout animations
<AnimatePresence mode="popLayout">
    {items.map(item => (
        <motion.div key={item.id} layout exit={{ opacity: 0, scale: 0.8 }}>
            {item.name}
        </motion.div>
    ))}
</AnimatePresence>
```

### Modal Animation

`DialogContent` z shadcn wymaga kontekstu `<Dialog>` (inaczej Radix rzuca błąd kontekstu) i sam renderuje
portal z overlayem, więc nie da się go owinąć w `motion.div`. Animację wyjścia z Motion robisz na prymitywach
Radix: `forceMount` zostawia montowanie `AnimatePresence`, a `asChild` przekazuje zachowanie dialogu (focus trap,
Escape, `aria-modal`, klik poza) na `motion.div`. Gdy wystarczy animacja wejścia i wyjścia z CSS, zostań przy
gotowym `DialogContent` z shadcn — ma ją w klasach `data-[state=open]`.

```typescript
// src/components/animated-modal.tsx
// import z '@radix-ui/react-dialog' albo `import { Dialog as DialogPrimitive } from 'radix-ui'` — wg package.json
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';

interface AnimatedModalProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: string;
    children: React.ReactNode;
}

export function AnimatedModal({ isOpen, onOpenChange, title, children }: AnimatedModalProps) {
    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {isOpen && (
                    <DialogPrimitive.Portal forceMount>
                        {/* Backdrop — klik zamyka dialog przez onOpenChange */}
                        <DialogPrimitive.Overlay asChild forceMount>
                            <motion.div
                                key="backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/50 z-40"
                            />
                        </DialogPrimitive.Overlay>

                        {/* Modal; pod <MotionConfig reducedMotion="user"> scale i y są pomijane */}
                        <DialogPrimitive.Content asChild forceMount>
                            <motion.div
                                key="modal"
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                // Wyjście krótsze niż wejście
                                exit={{ opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.15, ease: 'easeIn' } }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-1/2 rounded-xl bg-card p-6 text-card-foreground shadow-xl"
                            >
                                <DialogPrimitive.Title className="text-lg font-semibold">
                                    {title}
                                </DialogPrimitive.Title>
                                {children}
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}
```

`-translate-1/2` w v4 ustawia właściwość CSS `translate`, a Motion animuje `transform` — obie składają się,
więc centrowanie nie gryzie się z `y` i `scale`.

---

## Hover & Tap

### Card Hover
```typescript
// Cień ze skali Tailwinda zamiast rgba wpisanego w komponent (kolory tylko przez tokeny → design-system.md);
// box-shadow animujesz przy zmianie stanu (tu hover), ruch idzie przez transform (y)
<motion.div
    whileHover={{ y: -4 }}
    transition={{ duration: 0.2 }}
    className="rounded-lg transition-shadow duration-200 hover:shadow-lg"
>
    <Card>Zawartość</Card>
</motion.div>
```

### Button
```typescript
<motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.96 }}
    transition={{ duration: 0.15 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
>
    Kliknij
</motion.button>
```

**Dlaczego `0.96`, nie `0.98`?** `0.96` to standard polish dla scale-on-press — daje wyczuwalny tactile feedback bez przesady. Wartości poniżej `0.95` wyglądają przesadnie. Pełne pryncypia + warianty (Tailwind, CSS, prop `isStatic`) → [animation-polish.md](animation-polish.md).

### Tylko na Desktop (hover: hover)
```typescript
// Tailwind v4 — wariant hover: sam jest objęty @media (hover: hover),
// więc na dotyku efekt się nie włącza i nie zostaje „przyklejony” po tapnięciu
<div className="transition-transform duration-200 hover:-translate-y-1">
    Zawartość
</div>

// Motion — whileHover reaguje tylko na prawdziwy wskaźnik (zdarzenia myszy emulowane z dotyku pomija),
// więc sprawdzanie matchMedia('(hover: none)') w renderze nie jest potrzebne
<motion.div whileHover={{ y: -4 }}>
    Zawartość
</motion.div>
```

---

## View Transitions API (Baseline Newly Available)

### Nawigacja z Transition

React Router sam owija aktualizację stanu nawigacji w `document.startViewTransition` — wystarczy prop
`viewTransition` na `<Link>` albo opcja `{ viewTransition: true }` w `navigate`. Ręczne `navigate` wewnątrz
`startViewTransition` łapie zły stan: callback kończy się przed wyrenderowaniem nowej trasy, więc przeglądarka
robi zrzut „po” jeszcze ze starą stroną. Przeglądarka bez API nawiguje bez przejścia — router robi ten fallback sam.

```typescript
import { Link, useNavigate } from 'react-router';

import { ROUTES } from '@/constants/routes';

// Link
<Link to={ROUTES.ITEMS} viewTransition>
    Elementy
</Link>

// Nawigacja z kodu; navigate zwraca promise, więc void (ESLint: każdy promise obsłużony)
function SettingsButton() {
    const navigate = useNavigate();

    return (
        <button onClick={() => void navigate(ROUTES.SETTINGS, { viewTransition: true })}>
            Ustawienia
        </button>
    );
}
```

### Custom Transition Styles
```css
/* src/index.css */
::view-transition-old(root) {
    animation: fade-out 0.2s ease-out;
}

::view-transition-new(root) {
    animation: fade-in 0.2s ease-in;
}

@keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
}

@keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}
```

### Named Transitions (Shared Element)

`view-transition-name` musi być unikalny na stronie, więc nazwa niesie id. Selektory pseudo-elementów nie
przyjmują wzorców (`card-*` nie istnieje) — wspólny styl dla wszystkich kart daje `view-transition-class`.

```typescript
// Źródło - karta w liście
<div
    className="[view-transition-class:card]"
    style={{ viewTransitionName: `card-${template.id}` }}
>
    <img src={template.thumbnail} alt="" />
</div>

// Cel - strona szczegółów
<div
    className="[view-transition-class:card]"
    style={{ viewTransitionName: `card-${templateId}` }}
>
    <img src={template.thumbnail} alt="" />
</div>
```
```css
/* Animacja shared element — każda grupa z klasą card */
::view-transition-group(*.card) {
    animation-duration: 0.3s;
}
```

### Feature Detection
```typescript
// Potrzebne tylko poza nawigacją (np. własna animacja zmiany stanu) — przy nawigacji fallback robi React Router.
// Vite SPA renderuje tylko w przeglądarce, więc document zawsze istnieje.
const supportsViewTransitions = 'startViewTransition' in document;

// Lub hook
function useSupportsViewTransitions(): boolean {
    return 'startViewTransition' in document;
}
```

**Wsparcie przeglądarek:**
| Przeglądarka | Same-document | Cross-document |
|-------------|--------------|----------------|
| Chrome | 111+ | 126+ |
| Safari | 18+ | 18.2+ |
| Firefox | 144+ | Brak |
| Edge | 111+ | 126+ |

Same-document: Baseline Newly Available (~90% pokrycia wg caniuse); cross-document poza Baseline (brak Firefox). `view-transition-class` ma węższe wsparcie niż same View Transitions (sprawdź caniuse); przeglądarka bez niego robi przejście z domyślnym czasem trwania.

---

## prefers-reduced-motion

### Motion Hook (Wbudowany)
```typescript
import { motion, useReducedMotion } from 'motion/react';

function AnimatedCard({ children }: { children: React.ReactNode }) {
    const shouldReduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
        >
            {children}
        </motion.div>
    );
}
```

### Global CSS Reset
```css
/* src/index.css */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
```

### Conditional Variants
```typescript
const fadeInUp = (shouldReduce: boolean) => ({
    initial: { 
        opacity: 0, 
        y: shouldReduce ? 0 : 20 
    },
    animate: { 
        opacity: 1, 
        y: 0 
    },
    transition: { 
        duration: shouldReduce ? 0 : 0.3 
    },
});

function Card({ children }: { children: React.ReactNode }) {
    const shouldReduceMotion = useReducedMotion();
    const variants = fadeInUp(shouldReduceMotion ?? false);

    return (
        <motion.div {...variants}>
            {children}
        </motion.div>
    );
}
```

---

## CSS Transitions

### Tailwind Classes
```typescript
// Color transition
<button className="bg-primary hover:bg-primary/90 transition-colors duration-150">
    Przycisk
</button>

// Transform
<div className="hover:-translate-y-1 transition-transform duration-200">
    Unosi się
</div>

// Shadow
<div className="hover:shadow-lg transition-shadow duration-200">
    Cień na hover
</div>

// Multiple — wymień właściwości, które się zmieniają (w v4 scale to osobna właściwość CSS)
<div className="hover:scale-105 hover:shadow-lg transition-[scale,box-shadow] duration-200">
    Skala i cień
</div>
```

Gołe `transition` w Tailwind v4 to stała lista właściwości (kolory, `opacity`, `box-shadow`, transformacje,
filtry), a nie `all`; `all` daje dopiero `transition-all`, którego nie używasz → [performance.md](performance.md).

### Duration Guide

| Duration | Użycie |
|----------|--------|
| `duration-150` | Naciśnięcie (active), hover, wyjście elementu |
| `duration-200` | Standard transitions |
| `duration-300` | Większe zmiany (modale, panele, przejście strony) — górna granica |

Przejścia interfejsu mieszczą się w 150–300 ms, a wyjście jest krótsze niż wejście, bo uwaga użytkownika przechodzi już do następnej rzeczy. Dłużej trwają tylko pętle ładowania (spinner, pulsowanie, kropki: cykl 0,6–1 s), bo nie blokują interakcji, a krótszy cykl wygląda jak migotanie.

### Które właściwości animujesz

- **Domyślnie `transform` i `opacity`** (`translate`, `scale`, `rotate`, przezroczystość) — przeglądarka składa je na GPU bez przeliczania układu.
- **`filter`, `box-shadow` i kolor** — przy zmianie stanu elementu (hover, fokus, naciśnięcie, przełączenie ikony), nie przy wejściu całych sekcji.
- **Właściwości układu** (`width`, `height`, `top`, `margin`) — nie animujesz, bo każda klatka przelicza layout i przesuwa treść obok. Wyjątek: wysokość przez `interpolate-size` (sekcja [Collapsible / Accordion](#collapsible--accordion)).

---

## CSS Scroll-Driven Animations

### Scroll Progress
```css
/* src/index.css */
@keyframes reveal {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.scroll-reveal {
    animation: reveal linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 50%;
}

@media (prefers-reduced-motion: reduce) {
    .scroll-reveal {
        animation: none;
    }
}
```
```typescript
// Użycie
<div className="scroll-reveal">
    Pojawia się przy scrollowaniu
</div>
```

### Feature Detection
```typescript
const supportsScrollTimeline = CSS.supports('animation-timeline', 'view()');
```

**Wsparcie (caniuse):** Chrome 115+, Edge 115+, Safari 26+, Firefox 157+. Globalne pokrycie ~85%. Poza Baseline — stosuj jako progressive enhancement z `@supports (animation-timeline: scroll())`. Animacja na osi przewijania nie liczy czasu, więc globalny reset `animation-duration` z sekcji wyżej jej nie wyłącza — dlatego `.scroll-reveal` ma własne `animation: none` dla `prefers-reduced-motion: reduce`.

### Fallback z Intersection Observer
```typescript
const SUPPORTS_SCROLL_TIMELINE = CSS.supports('animation-timeline', 'view()');
const REVEAL_THRESHOLD = 0.1;

interface ScrollRevealResult {
    ref: React.RefObject<HTMLDivElement | null>;
    isVisible: boolean;
}

function useScrollReveal(): ScrollRevealResult {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Jeśli CSS scroll-driven wspierane, nie używaj JS
        if (SUPPORTS_SCROLL_TIMELINE) return;

        const observer = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { threshold: REVEAL_THRESHOLD }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return { ref, isVisible };
}

// Użycie
function RevealSection({ children }: { children: React.ReactNode }) {
    const { ref, isVisible } = useScrollReveal();

    // CSS scroll-driven wspierane: animuje klasa .scroll-reveal. Motion nie ustawia tu stanu początkowego,
    // bo inline opacity: 0 zostałoby na stałe przy reduced motion (wtedy .scroll-reveal ma animation: none)
    if (SUPPORTS_SCROLL_TIMELINE) {
        return <div className="scroll-reveal">{children}</div>;
    }

    // Fallback JS; pod <MotionConfig reducedMotion="user"> przy reduced motion zostaje sam fade
    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
        >
            {children}
        </motion.div>
    );
}
```

---

## CSS Entry Animations (@starting-style)

Natywne animacje wejścia z `display: none` — bez hacków JS. **Baseline Newly Available** (Chrome 117+, Safari 17.5+, Firefox 129+).

### Dialog/Popover Animation
```css
/* src/index.css */
dialog[open] {
    opacity: 1;
    transform: scale(1);
    transition: opacity 0.3s, transform 0.3s,
        display 0.3s allow-discrete,
        overlay 0.3s allow-discrete;

    @starting-style {
        opacity: 0;
        transform: scale(0.95);
    }
}
```

### Tailwind v4.0+ (starting variant)
```typescript
{/* Tylko właściwości, które się zmieniają; globalny reset reduced motion skraca to przejście */}
<div className="starting:opacity-0 starting:scale-95 transition-[opacity,scale] duration-300">
    Content with entry animation
</div>
```

### Kiedy `@starting-style` vs Motion
| `@starting-style` | Motion (dawniej Framer Motion) |
|-------------------|----------------------|
| Proste enter/exit | Złożone sekwencje |
| Natywne dialog/popover | Staggered lists |
| Zero JS, zero bundle | Gestures, springs |
| CSS-only | Layout animations (prop `layout` — Motion przelicza je na `transform`) |

---

## Loading Animations

### Spinner
```typescript
// CSS
<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />

// Motion — pod <MotionConfig reducedMotion="user"> obrót przy reduced motion jest pomijany
// (globalny reset CSS zatrzymuje też animate-spin), więc stan ładowania niesie też tekst albo role="status"
<motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
>
    <Loader2 className="h-6 w-6" />
</motion.div>

// Lucide (najprostsze)
<Loader2 className="h-6 w-6 animate-spin" />
```

### Skeleton Pulse
```typescript
<div className="animate-pulse space-y-3">
    <div className="h-4 bg-muted rounded w-3/4" />
    <div className="h-4 bg-muted rounded w-1/2" />
</div>
```

### Dots Loading
```typescript
import { motion, useReducedMotion } from 'motion/react';

const DOTS = [0, 1, 2] as const;

function LoadingDots() {
    // Przy reduced motion kropki pulsują przezroczystością zamiast skakać — wskaźnik ładowania zostaje,
    // ruch znika (samo MotionConfig zatrzymałoby skok i zostawiło nieruchome kropki)
    const shouldReduceMotion = useReducedMotion();

    return (
        <div className="flex gap-1" role="status" aria-label="Ładowanie">
            {DOTS.map((i) => (
                <motion.div
                    key={i}
                    className="h-2 w-2 bg-primary rounded-full"
                    animate={shouldReduceMotion ? { opacity: [0.4, 1, 0.4] } : { y: [0, -8, 0] }}
                    transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.1,
                    }}
                />
            ))}
        </div>
    );
}
```

---

## Collapsible / Accordion

Wysokość to właściwość układu: animowana w JS (Motion `height: 'auto'`) przelicza layout w każdej klatce i przesuwa treść pod panelem. Panel w Motion animuje więc samą przezroczystość, a wysokość zmienia się od razu. Płynną zmianę wysokości daje tylko CSS z `interpolate-size` (podsekcja niżej) — jedyny wyjątek od zasady „bez animowania właściwości układu”.
```typescript
import { AnimatePresence, motion } from 'motion/react';

interface CollapsibleProps {
    isOpen: boolean;
    children: React.ReactNode;
}

// Pod <MotionConfig reducedMotion="user"> opacity zostaje (zmiana bez ruchu)
export function Collapsible({ isOpen, children }: CollapsibleProps) {
    return (
        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
                    exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
```

### Natywna alternatywa: `interpolate-size` (Chrome 129+)

Od Chrome 129+ animacja `height: auto` jest możliwa czystym CSS, bez mierzenia wysokości
w JS/Motion — wystarczy włączyć `interpolate-size: allow-keywords` na `:root` (lub przez
`calc-size()`). Tylko Chromium (Chrome/Edge 129+); brak w Safari i Firefox (caniuse), ~70% pokrycia.
Traktuj jako progressive enhancement: przeglądarka bez wsparcia otwiera panel od razu na końcową wysokość,
bez animacji (zamiennik z `grid-template-rows` 0fr→1fr też animuje układ, więc go nie stosujesz).
Przy `prefers-reduced-motion: reduce` wyłączasz przejście (blok niżej).

```css
:root {
    interpolate-size: allow-keywords;
}

.collapsible {
    height: 0;
    overflow: hidden;
    transition: height 0.3s ease;
}
.collapsible[data-open='true'] {
    height: auto; /* interpolowane dzięki interpolate-size */
}

@media (prefers-reduced-motion: reduce) {
    .collapsible {
        transition: none;
    }
}
```

---

## Unikaj

### Layout Shift (CLS)
```typescript
// ❌ Zmienia layout - powoduje CLS
<motion.div animate={{ width: isExpanded ? 300 : 100 }}>
    Zmienia szerokość
</motion.div>

// ✅ Transform nie wpływa na layout
<motion.div animate={{ scale: isExpanded ? 1.5 : 1 }}>
    Skaluje się
</motion.div>
```

### Zbyt Długie Animacje
```typescript
// ❌ Zbyt wolne - frustruje użytkownika
transition={{ duration: 1.5 }}

// ✅ Szybkie i responsywne
transition={{ duration: 0.2 }}  // hover
transition={{ duration: 0.3 }}  // modals
```

### Zbyt Wiele Animacji
```typescript
// ❌ Chaos wizualny
<motion.div animate={{ x: 10, rotate: 5, scale: 1.05, skew: 2 }}>
    Za dużo
</motion.div>

// ✅ Jeden celowy efekt
<motion.div whileHover={{ y: -4 }}>
    Subtelne
</motion.div>
```

### Animacje Bez Celu
```typescript
// ❌ Animacja dla animacji
<motion.div animate={{ rotate: [0, 360] }} transition={{ repeat: Infinity }}>
    Kręci się bez powodu
</motion.div>

// ✅ Animacja z celem (loading indicator)
{isLoading && (
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity }}>
        <Loader2 />
    </motion.div>
)}
```

---

## Podsumowanie

| Technika | Użycie |
|----------|--------|
| **Motion** (dawniej Framer Motion) | Kompleksowe animacje, staggered lists |
| **CSS transitions** | Proste hover, focus states |
| **View Transitions** | Nawigacja między stronami |
| **Scroll-driven** | Reveal on scroll |
| **AnimatePresence** | Mount/unmount animations |
| **@starting-style** | Natywne entry animations (dialog, popover) |

| Zasada | Standard |
|--------|----------|
| Duration | 150–300 ms; wyjście krótsze niż wejście, pętle ładowania dłużej |
| Właściwości | `transform` i `opacity`; `filter`, `box-shadow`, kolor przy zmianie stanu |
| Easing | `easeOut` dla enter, `easeIn` dla exit |
| Reduced motion | Zawsze wspierany |
| Właściwości układu (`width`, `height`) | Bez animacji (CLS); wyjątek: `interpolate-size` |

---

## Zobacz Także

- [accessibility.md](accessibility.md) - Reduced motion
- [component-ux.md](component-ux.md) - Loading states
- [responsive-design.md](responsive-design.md) - Responsive animations
- [animation-polish.md](animation-polish.md) - Interruptible transitions, subtelne wyjścia, contextual icon crossfade, scale on press
- [performance.md](performance.md) - Transition specificity, `will-change` usage
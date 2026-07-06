# Animacje

Motion (dawniej Framer Motion), View Transitions API, CSS animations - standardy 2026.

---

## Motion (dawniej Framer Motion)

### Import
```typescript
// Nowy pakiet (rekomendowany dla nowych projektów)
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

// Stary pakiet (nadal działa, re-eksport z motion)
// import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
```

**Migracja:** Pakiet `framer-motion` został przemianowany na `motion` (v12.x). Import zmieniony z `framer-motion` na `motion/react`. Stary pakiet nadal działa bez zmian.
```bash
# Nowe projekty
npm install motion

# Istniejące projekty — brak zmian wymaganych
# framer-motion jest re-eksportem z motion
```

### Podstawowe Animacje
```typescript
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
```typescript
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.07,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
};

function TemplateGrid({ templates }: { templates: Template[] }) {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
            {templates.map((template) => (
                <motion.div key={template.id} variants={itemVariants}>
                    <TemplateCard template={template} />
                </motion.div>
            ))}
        </motion.div>
    );
}
```

### Prostsza Wersja (delay)
```typescript
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
// mode="wait" - czeka na exit przed enter (domyślne dla modali)
<AnimatePresence mode="wait">
    {currentTab === 'a' && <TabA key="a" />}
    {currentTab === 'b' && <TabB key="b" />}
</AnimatePresence>

// mode="sync" - exit i enter jednocześnie (crossfade)
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
```typescript
<AnimatePresence>
    {isOpen && (
        <>
            {/* Backdrop */}
            <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />
            
            {/* Modal */}
            <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
                <DialogContent>{children}</DialogContent>
            </motion.div>
        </>
    )}
</AnimatePresence>
```

---

## Hover & Tap

### Card Hover
```typescript
<motion.div
    whileHover={{ y: -4, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.2)' }}
    transition={{ duration: 0.2 }}
>
    <Card>Zawartość</Card>
</motion.div>
```

### Button
```typescript
<motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.96 }}
    transition={{ duration: 0.1 }}
    className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
>
    Kliknij
</motion.button>
```

**Dlaczego `0.96`, nie `0.98`?** `0.96` to standard polish dla scale-on-press — daje wyczuwalny tactile feedback bez przesady. Wartości poniżej `0.95` wyglądają przesadnie. Pełne pryncypia + warianty (Tailwind, CSS, prop `static`) → [animation-polish.md](animation-polish.md).

### Tylko na Desktop (hover: hover)
```typescript
// CSS approach - hover tylko gdy urządzenie obsługuje
<div className="transition-transform duration-200 hover:[@media(hover:hover)]:-translate-y-1">
    Zawartość
</div>

// Framer Motion approach
const isTouch = window.matchMedia('(hover: none)').matches;

<motion.div
    whileHover={isTouch ? undefined : { y: -4 }}
>
    Zawartość
</motion.div>
```

---

## View Transitions API (Baseline Newly Available)

### Nawigacja z Transition
```typescript
function useViewTransition() {
    const navigate = useNavigate();

    return (to: string) => {
        // Fallback dla przeglądarek bez wsparcia
        if (!document.startViewTransition) {
            navigate(to);
            return;
        }

        document.startViewTransition(() => {
            navigate(to);
        });
    };
}

// Użycie
function NavLink({ to, children }: Props) {
    const navigateWithTransition = useViewTransition();

    return (
        <button onClick={() => navigateWithTransition(to)}>
            {children}
        </button>
    );
}
```

### Custom Transition Styles
```css
/* globals.css */
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
```typescript
// Źródło - karta w liście
<div style={{ viewTransitionName: `card-${template.id}` }}>
    <img src={template.thumbnail} alt="" />
</div>

// Cel - strona szczegółów
<div style={{ viewTransitionName: `card-${templateId}` }}>
    <img src={template.thumbnail} alt="" />
</div>
```
```css
/* Animacja shared element */
::view-transition-old(card-*),
::view-transition-new(card-*) {
    animation-duration: 0.3s;
}
```

### Feature Detection
```typescript
const supportsViewTransitions = 'startViewTransition' in document;

// Lub hook
function useSupportsViewTransitions() {
    return typeof document !== 'undefined' && 'startViewTransition' in document;
}
```

**Wsparcie przeglądarek (2026):**
| Przeglądarka | Same-document | Cross-document |
|-------------|--------------|----------------|
| Chrome | 111+ | 126+ |
| Safari | 18+ | 18.2+ |
| Firefox | 133+ | Brak |
| Edge | 111+ | 126+ |

---

## prefers-reduced-motion

### Motion Hook (Wbudowany)
```typescript
import { useReducedMotion } from 'motion/react';

function AnimatedCard({ children }: Props) {
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
/* globals.css */
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

function Card({ children }: Props) {
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

// Multiple (all)
<div className="hover:scale-105 hover:shadow-lg transition-all duration-200">
    Wszystko
</div>
```

### Duration Guide

| Duration | Użycie |
|----------|--------|
| `duration-100` | Instant feedback (active states) |
| `duration-150` | Hover states |
| `duration-200` | Standard transitions |
| `duration-300` | Larger changes (modals) |
| `duration-500` | Page transitions |

---

## CSS Scroll-Driven Animations

### Scroll Progress
```css
/* globals.css */
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

**Wsparcie (2026):** Chrome 115+, Edge 115+, Safari 26+ (nowe!), Firefox za flagą. Globalne pokrycie ~83-85%. Stosuj jako progressive enhancement.

### Fallback z Intersection Observer
```typescript
function useScrollReveal() {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Jeśli CSS scroll-driven wspierane, nie używaj JS
        if (CSS.supports('animation-timeline', 'view()')) return;

        const observer = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { threshold: 0.1 }
        );

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return { ref, isVisible };
}

// Użycie
function RevealSection({ children }: Props) {
    const { ref, isVisible } = useScrollReveal();

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
            className="scroll-reveal" // CSS fallback gdy wspierane
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
/* globals.css */
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

### Tailwind v4.1+ (starting variant)
```typescript
<div className="starting:opacity-0 starting:scale-95 transition-all duration-300">
    Content with entry animation
</div>
```

### Kiedy `@starting-style` vs Motion
| `@starting-style` | Motion (dawniej Framer Motion) |
|-------------------|----------------------|
| Proste enter/exit | Złożone sekwencje |
| Natywne dialog/popover | Staggered lists |
| Zero JS, zero bundle | Gestures, springs |
| CSS-only | Layout animations |

---

## Loading Animations

### Spinner
```typescript
// CSS
<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />

// Framer Motion
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
function LoadingDots() {
    return (
        <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className="h-2 w-2 bg-primary rounded-full"
                    animate={{ y: [0, -8, 0] }}
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
```typescript
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface CollapsibleProps {
    isOpen: boolean;
    children: React.ReactNode;
}

export function Collapsible({ isOpen, children }: CollapsibleProps) {
    const shouldReduceMotion = useReducedMotion();

    return (
        <AnimatePresence initial={false}>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                        height: { duration: shouldReduceMotion ? 0 : 0.3 },
                        opacity: { duration: shouldReduceMotion ? 0 : 0.2 },
                    }}
                    style={{ overflow: 'hidden' }}
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
`calc-size()`). Traktuj jako progressive enhancement (przeglądarki bez wsparcia po prostu
skoczą do końcowej wysokości) i zawsze respektuj `prefers-reduced-motion`.

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
| Duration | 150-300ms |
| Easing | `easeOut` dla enter, `easeIn` dla exit |
| Reduced motion | Zawsze wspierany |
| Layout animations | Unikaj (CLS) |

---

## Zobacz Także

- [accessibility.md](accessibility.md) - Reduced motion
- [component-ux.md](component-ux.md) - Loading states
- [responsive-design.md](responsive-design.md) - Responsive animations
- [animation-polish.md](animation-polish.md) - Interruptible transitions, subtelne wyjścia, contextual icon crossfade, scale on press
- [performance.md](performance.md) - Transition specificity, `will-change` usage
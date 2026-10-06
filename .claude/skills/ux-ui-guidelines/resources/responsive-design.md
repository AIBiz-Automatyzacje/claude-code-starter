# Responsive Design

Mobile-first, container queries, dynamic viewport units, wzorce dotykowe.

---

## Mobile-First

### Zasada

Styluj najpierw dla mobile, potem dodawaj breakpointy dla większych ekranów.
```typescript
<div className={cn(
    // Mobile (default)
    "flex flex-col gap-2 p-4",
    // Tablet (md: 768px)
    "md:flex-row md:gap-4 md:p-6",
    // Desktop (lg: 1024px)
    "lg:gap-6 lg:p-8"
)}>
    Responsywna zawartość
</div>
```

### Dlaczego Mobile-First

1. **Progresywne ulepszanie** - podstawowe doświadczenie działa wszędzie
2. **Mniejszy CSS** - nadpisywanie od małego do dużego jest czystsze
3. **Priorytet mobile** - większość ruchu jest z mobile

---

## Container Queries

### Problem z Viewport Breakpoints

Viewport breakpoints reagują na szerokość okna, nie komponentu. Karta w sidebarze ma inne potrzeby niż ta sama karta na pełnej szerokości.

### Rozwiązanie: @container
```typescript
// Kontener z named container
<div className="@container/card">
    <div className={cn(
        // Bazowy layout (narrow)
        "flex flex-col gap-2",
        // Gdy kontener >= 320px
        "@[320px]/card:flex-row @[320px]/card:gap-4",
        // Gdy kontener >= 480px
        "@[480px]/card:gap-6"
    )}>
        <Image />
        <Content />
    </div>
</div>
```

### Tailwind v4 Container Query Classes

| Class | Container Width |
|-------|-----------------|
| `@xs:` | 320px |
| `@sm:` | 384px |
| `@md:` | 448px |
| `@lg:` | 512px |
| `@xl:` | 576px |

### Praktyczny Przykład: Karta
```typescript
function TemplateCard({ template }: { template: Template }) {
    return (
        <article className="@container">
            <div className={cn(
                // Mobile/narrow: stack
                "flex flex-col gap-3 p-4",
                // Wide container: horizontal
                "@md:flex-row @md:items-center @md:gap-4"
            )}>
                {/* Thumbnail */}
                <div className={cn(
                    "aspect-video rounded-lg overflow-hidden",
                    "w-full @md:w-32 @md:shrink-0"
                )}>
                    <img src={template.thumbnail} alt="" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{template.name}</h3>
                    <p className={cn(
                        "text-sm text-muted-foreground",
                        "line-clamp-2 @md:line-clamp-1"
                    )}>
                        {template.description}
                    </p>
                </div>

                {/* Actions - stack on narrow, row on wide */}
                <div className={cn(
                    "flex gap-2 mt-2",
                    "@md:mt-0 @md:shrink-0"
                )}>
                    <Button size="sm">Użyj</Button>
                </div>
            </div>
        </article>
    );
}
```

### Kiedy Container Queries vs Viewport

| Użyj Container Queries | Użyj Viewport Breakpoints |
|------------------------|---------------------------|
| Komponenty reużywalne | Layout strony |
| Karty, widgety | Navigation |
| Sidebar content | Hero sections |
| Grid items | Page containers |

---

## Dynamic Viewport Units

### Problem z `vh`

Na mobile `100vh` nie uwzględnia paska adresu przeglądarki - content jest obcięty.

### Rozwiązanie: dvh, svh, lvh
```css
/* Dynamic - zmienia się z paskiem adresu */
min-h-dvh

/* Small - zakłada widoczny pasek (bezpieczne minimum) */  
min-h-svh

/* Large - zakłada ukryty pasek (maksimum) */
min-h-lvh
```

### Praktyczne Użycie
```typescript
// Full-screen hero
<section className="min-h-dvh flex items-center justify-center">
    <HeroContent />
</section>

// Mobile drawer/modal
<div className="fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto">
    <DrawerContent />
</div>

// Sticky footer layout
<div className="min-h-dvh flex flex-col">
    <Header />
    <main className="flex-1">{children}</main>
    <Footer />
</div>
```

### Fallback dla Starszych Przeglądarek
```css
/* src/index.css — @utility (Tailwind v4) zamiast zwykłej klasy, żeby działały warianty (md:min-h-screen-safe) */
@utility min-h-screen-safe {
    min-height: 100vh;
    min-height: 100dvh;
}
```

### Logiczne Viewport Units (Nowe)
```css
/* Dla layoutów niezależnych od writing-mode */
svb / svi  /* Small viewport block/inline */
dvb / dvi  /* Dynamic viewport block/inline */
lvb / lvi  /* Large viewport block/inline */
```
Przydatne przy wsparciu RTL (right-to-left) layouts.

---

## Viewport Breakpoints

### Tailwind Defaults

| Prefix | Min Width | Typowe Urządzenia |
|--------|-----------|-------------------|
| (none) | 0px | Mobile phones |
| `sm:` | 640px | Małe tablety |
| `md:` | 768px | Tablety |
| `lg:` | 1024px | Laptopy |
| `xl:` | 1280px | Desktop |
| `2xl:` | 1536px | Duże ekrany |

### Grid Layouts
```typescript
// Template grid
<div className={cn(
    "grid gap-4",
    "grid-cols-1",        // Mobile: 1 kolumna
    "md:grid-cols-2",     // Tablet: 2 kolumny
    "lg:grid-cols-3"      // Desktop: 3 kolumny
)}>
    {templates.map(template => (
        <TemplateCard key={template.id} template={template} />
    ))}
</div>
```

---

## Fluid Typography

### Problem z Breakpointami
```typescript
// ❌ Skokowe zmiany rozmiaru
<h1 className="text-2xl md:text-3xl lg:text-4xl">
```

### Rozwiązanie: clamp()

Rozmiar rośnie płynnie z szerokością ekranu między minimum a maksimum z `clamp()`. Klasy `text-fluid-xl`, `text-fluid-2xl` i `text-fluid-3xl` (`@utility` w `src/index.css`, więc działają z wariantami, np. `md:text-fluid-3xl`) mają jedną definicję: [design-system.md](design-system.md#fluid-typography-headlines), sekcja Fluid Typography. Tu ich nie powtarzasz — dwie kopie z różnymi wartościami dawały ten sam nagłówek w dwóch rozmiarach.

### Użycie
```typescript
// Fluid hero title — klasa z design-system.md
<h1 className="text-fluid-3xl font-bold">
    Płynne skalowanie
</h1>

// Jednorazowy rozmiar spoza skali — wartość arbitralna z clamp()
<h1 className="text-[clamp(1.5rem,1rem+2vw,2.25rem)]">
    Fluid Title
</h1>
```

### Kiedy Fluid vs Breakpoints

| Fluid Typography | Breakpoint Typography |
|------------------|----------------------|
| Hero headlines | Body text |
| Page titles | UI labels |
| Marketing content | Form inputs |

---

## Aspect Ratio

### Responsive Media
```typescript
// Video container
<div className="aspect-video rounded-lg overflow-hidden">
    <video src={url} className="w-full h-full object-cover" />
</div>

// Square thumbnail
<div className="aspect-square rounded-lg overflow-hidden">
    <img src={thumbnail} alt="" className="w-full h-full object-cover" />
</div>

// Custom aspect ratio — obraz z treścią ma opis w alt, dekoracyjny alt=""
<div className="aspect-[4/3] bg-muted">
    <img src={image} alt={imageAlt} className="w-full h-full object-contain" />
</div>
```

### Tailwind Aspect Classes

| Class | Ratio |
|-------|-------|
| `aspect-square` | 1:1 |
| `aspect-video` | 16:9 |
| `aspect-[4/3]` | 4:3 |
| `aspect-[3/2]` | 3:2 |

---

## Subgrid

### Problem: Wyrównanie Między Kartami

Gdy karty mają różną ilość contentu, elementy nie są wyrównane.

### Rozwiązanie: Subgrid
```typescript
// Parent grid
<div className="grid grid-cols-3 gap-4">
    {templates.map(template => (
        <article 
            key={template.id}
            className={cn(
                "grid grid-rows-subgrid row-span-3",
                "gap-2 p-4 border rounded-lg"
            )}
        >
            {/* Row 1: Title - wyrównane między kartami */}
            <h3 className="font-medium">{template.name}</h3>
            
            {/* Row 2: Description - wyrównane */}
            <p className="text-sm text-muted-foreground">
                {template.description}
            </p>
            
            {/* Row 3: Actions - wyrównane na dole */}
            <div className="flex gap-2">
                <Button size="sm">Użyj</Button>
            </div>
        </article>
    ))}
</div>
```

---

## CSS Anchor Positioning (Baseline Newly Available)

Pozycjonowanie tooltipów, popovers i dropdown bez Popper.js/floating-ui:
```css
/* Anchor element */
.trigger {
    anchor-name: --tooltip-anchor;
}

/* Positioned element */
.tooltip {
    position: fixed;
    position-anchor: --tooltip-anchor;
    top: anchor(bottom);
    left: anchor(center);
    margin-top: 8px;
}
```

**Wsparcie:** Chrome 125+, Edge 125+, Firefox 147+, Safari 26+ (Baseline Newly Available); aktualne pokrycie sprawdzasz na caniuse.com. Starsze Safari i Firefox potrzebują fallbacku.

**Rekomendacja:** Stosuj jako progressive enhancement. Dla pełnego wsparcia przeglądarek nadal używaj Radix UI positioning lub floating-ui.

---

## Touch-Friendly Design

### Minimum Touch Targets (WCAG 2.2)

Zasada rozmiaru celu ma jedno źródło: [accessibility.md, sekcja Rozmiar celu](accessibility.md#rozmiar-celu) — min 24×24 px dla każdego celu (próg twardy, WCAG 2.2 AA), 44×44 px dla kontrolek obsługiwanych palcem, mniejszy widoczny element z obszarem rozszerzonym pseudo-elementem. Tu jej zastosowanie w widokach mobilnych:
```typescript
// Kontrolka dotykowa 44px - Tailwind v4
<Button className="min-h-11 min-w-11">
    Dotknij
</Button>

// Icon button widoczny tylko na mobile — od razu 44px
<Button size="icon" className="size-11 md:hidden" aria-label="Ulubione">
    <Heart className="h-5 w-5" aria-hidden="true" />
</Button>

// Icon button wspólny dla desktopu i dotyku — 36px z shadcn/ui, 44px przy wskaźniku dotykowym
<Button size="icon" className="pointer-coarse:size-11" aria-label="Udostępnij">
    <Share className="h-5 w-5" aria-hidden="true" />
</Button>

// Link z odpowiednim paddingiem
<a className="inline-flex items-center gap-2 py-3 px-4 -m-3">
    <span>Link z wystarczającym target</span>
</a>
```

### Spacing Między Touch Targets
```typescript
// Minimum 8px gap między przyciskami
<div className="flex gap-2">
    <Button size="icon" aria-label="Edytuj" />
    <Button size="icon" aria-label="Duplikuj" />
    <Button size="icon" aria-label="Usuń" />
</div>
```

---

## Hover vs Touch

### Media Query dla Hover
```typescript
// Hover tylko na urządzeniach, które go obsługują
<Card className={cn(
    // Konkretne właściwości zamiast przejścia wszystkich: animujesz tylko cień i przesunięcie
    "transition-[box-shadow,translate] duration-200",
    // W Tailwind v4 wariant hover: jest objęty @media (hover: hover), więc na dotyku nie „przykleja się”
    "hover:shadow-md hover:-translate-y-0.5"
)}>
    {children}
</Card>
```

### Touch Feedback
```typescript
// Active state dla touch — ta sama skala naciśnięcia w całym skillu
<button className={cn(
    "transition-transform",
    "active:scale-[0.96]"
)}>
    Przycisk
</button>

// Tap highlight (custom)
<button className={cn(
    "relative overflow-hidden",
    "after:absolute after:inset-0",
    "after:bg-foreground/10 after:opacity-0",
    "active:after:opacity-100"
)}>
    Z tap highlight
</button>
```

---

## Wzorce Layoutu

### Navigation
```typescript
// NavLink z React Routera przyjmuje `to`, nie `href`; ścieżki ze stałej ROUTES (src/constants/routes.ts)
import { Menu } from 'lucide-react';
import { NavLink } from 'react-router';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ROUTES } from '@/constants/routes';

<nav className="flex items-center justify-between p-4">
    <Logo className="h-8" />

    {/* Desktop nav */}
    <div className="hidden md:flex items-center gap-4">
        <NavLink to={ROUTES.HOME}>Home</NavLink>
        <NavLink to={ROUTES.ITEMS}>Elementy</NavLink>
        <Button>Zaloguj</Button>
    </div>

    {/* Mobile menu trigger — przycisk tylko na mobile, więc cel 44px */}
    <Sheet>
        <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label="Otwórz menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px]">
            <nav className="flex flex-col gap-4 mt-8">
                <NavLink to={ROUTES.HOME} className="min-h-11 inline-flex items-center">Home</NavLink>
                <NavLink to={ROUTES.ITEMS} className="min-h-11 inline-flex items-center">Elementy</NavLink>
                <Button className="w-full min-h-11">Zaloguj</Button>
            </nav>
        </SheetContent>
    </Sheet>
</nav>
```

### Modal/Dialog
```typescript
<Dialog>
    <DialogContent className={cn(
        // Mobile: prawie pełny ekran
        "w-[calc(100%-32px)] max-w-lg",
        // Max height z dynamic viewport
        "max-h-[85dvh] overflow-y-auto"
    )}>
        {children}
    </DialogContent>
</Dialog>
```

### Tabele → Karty na Mobile
```typescript
{/* Desktop: tabela */}
<div className="hidden md:block">
    <Table>{/* ... */}</Table>
</div>

{/* Mobile: karty */}
<div className="md:hidden space-y-3">
    {items.map(item => (
        <Card key={item.id} className="p-4">
            <div className="flex justify-between items-center">
                <span className="font-medium">{item.name}</span>
                <Badge>{item.status}</Badge>
            </div>
        </Card>
    ))}
</div>
```

---

## Responsive Spacing

### Container
```typescript
<div className={cn(
    "mx-auto w-full max-w-7xl",
    "px-4 sm:px-6 lg:px-8"
)}>
    {children}
</div>
```

### Sections
```typescript
<section className={cn(
    "py-8 md:py-12 lg:py-16"
)}>
    {children}
</section>
```

---

## Testowanie

### DevTools

1. Chrome: `F12` → Device Toolbar (`Ctrl+Shift+M`)
2. Testuj viewport breakpoints
3. Testuj container queries (resize parent element)

### Szerokości do Testowania

| Szerokość | Urządzenie |
|-----------|------------|
| 320px | iPhone SE |
| 375px | iPhone standard |
| 390px | iPhone 14 |
| 768px | iPad portrait |
| 1024px | iPad landscape |
| 1280px | Desktop |
| 1920px | Full HD |

### Container Query Testing

Użyj DevTools do resize'owania parent elementu, nie całego viewport.

---

## Podsumowanie

| Technika | Użycie |
|----------|--------|
| **Container queries** | Reużywalne komponenty |
| **Viewport breakpoints** | Page layout |
| **Dynamic viewport** | Full-height sections |
| **Fluid typography** | Headlines |
| **Subgrid** | Wyrównanie grid items |
| **Rozmiar celu** | Min 24×24 px każdy cel; 44×44 px kontrolki dotykowe ([accessibility.md](accessibility.md#rozmiar-celu)) |
| **Gesty (swipe, pull)** | Skrót do akcji dostępnej też przyciskiem; destrukcyjne z potwierdzeniem albo „Cofnij” |

---
---

## Mobile Patterns

### Bottom Navigation
```typescript
import { Heart, Home, PlusCircle, Search, User } from 'lucide-react';
import { NavLink } from 'react-router';

import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

// SEARCH, FAVORITES i PROFILE dopisujesz do tego samego obiektu ROUTES w src/constants/routes.ts
const BOTTOM_NAV_ITEMS = [
    { to: ROUTES.HOME, icon: Home, label: 'Home' },
    { to: ROUTES.SEARCH, icon: Search, label: 'Szukaj' },
    { to: ROUTES.ITEM_NEW, icon: PlusCircle, label: 'Utwórz' },
    { to: ROUTES.FAVORITES, icon: Heart, label: 'Ulubione' },
    { to: ROUTES.PROFILE, icon: User, label: 'Profil' },
] as const;

function BottomNav() {
    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-background border-t z-30 pb-safe">
            <ul className="flex justify-around">
                {BOTTOM_NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                    <li key={to}>
                        <NavLink
                            to={to}
                            className={({ isActive }) => cn(
                                "flex flex-col items-center py-2 px-3 min-h-12 min-w-12",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <Icon className="h-5 w-5" aria-hidden="true" />
                            <span className="text-xs mt-1">{label}</span>
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
```

**Safe Area dla notch/gesture bar:**

`env(safe-area-inset-*)` zwraca wartość większą od zera dopiero wtedy, gdy strona rozciąga się pod wycięcie ekranu — meta viewport w `index.html` potrzebuje `viewport-fit=cover`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```
```css
/* src/index.css — @utility (Tailwind v4): zwykła klasa .pb-safe nie działałaby z wariantami (md:pb-safe) */
@utility pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 0px);
}
```
`pb-safe` ustawia cały dolny padding, więc w elemencie z `p-4` nadpisuje dolne 16 px. Gdy potrzebujesz obu, łączysz je w jednej wartości: `pb-[calc(1rem+env(safe-area-inset-bottom))]`.

### Bottom Sheet

`Sheet` z Radix nie obsługuje przeciągania, więc nie dostaje atrapy uchwytu: pasek, który wygląda na przeciągalny i nie reaguje, myli użytkownika. Panel zamykany gestem w dół to `Drawer` (vaul) z [patterns.md](patterns.md) (sekcja Drawer), który sam renderuje uchwyt.
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface BottomSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: string;
    children: React.ReactNode;
}

function BottomSheet({ isOpen, onOpenChange, title, children }: BottomSheetProps) {
    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent 
                side="bottom" 
                className="h-[85dvh] rounded-t-2xl"
            >
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                </SheetHeader>
                
                <div className="overflow-y-auto flex-1 pb-safe">
                    {children}
                </div>
            </SheetContent>
        </Sheet>
    );
}
```

### Pull to Refresh

Stan gestu to jedna unia (`idle` / `pulling` / `refreshing`) zamiast dwóch flag, które mogłyby być prawdziwe naraz. Komponent ma własny kontener przewijania z `overscroll-y-contain`: bez tego przeciągnięcie w dół na górze strony uruchomiłoby równolegle natywne odświeżanie przeglądarki (przeładowanie strony w Chrome na Androidzie). Kolejne odświeżenie nie startuje, dopóki trwa poprzednie, a powrót do `idle` jest w `finally`, więc wykonuje się po sukcesie i po błędzie. Gest jest skrótem: lista ma też przycisk „Odśwież” (np. w nagłówku), bo przeciągnięcie wymaga ścieżki ruchu, a WCAG 2.5.1 wymaga alternatywy jednym kliknięciem ([accessibility.md](accessibility.md), sekcja Dragging Movements).
```typescript
import { Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

const PULL_MAX_DISTANCE_PX = 100;
const PULL_REFRESH_THRESHOLD_PX = 60;

type PullState = { phase: 'idle' } | { phase: 'pulling' } | { phase: 'refreshing' };

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
    const [state, setState] = useState<PullState>({ phase: 'idle' });
    const startY = useRef<number | null>(null);
    const pullDistance = useRef(0);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        const touch = e.touches[0];
        if (e.currentTarget.scrollTop === 0 && touch) {
            startY.current = touch.clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (startY.current === null || !touch || state.phase === 'refreshing') return;

        pullDistance.current = touch.clientY - startY.current;
        if (pullDistance.current > 0 && pullDistance.current < PULL_MAX_DISTANCE_PX) {
            setState({ phase: 'pulling' });
        }
    };

    const handleTouchEnd = () => {
        const shouldRefresh =
            pullDistance.current > PULL_REFRESH_THRESHOLD_PX && state.phase !== 'refreshing';
        startY.current = null;
        pullDistance.current = 0;

        if (!shouldRefresh) {
            if (state.phase === 'pulling') setState({ phase: 'idle' });
            return;
        }

        setState({ phase: 'refreshing' });
        void onRefresh()
            .catch((error: unknown) => {
                logger.error('PULL_TO_REFRESH_FAILED', error);
                toast.error('Nie udało się odświeżyć');
            })
            .finally(() => setState({ phase: 'idle' }));
    };

    return (
        // Własny kontener przewijania: overscroll-y-contain nie przekazuje przeciągnięcia
        // do strony, więc natywne pull-to-refresh przeglądarki się nie uruchamia
        <div
            className="h-full overflow-y-auto overscroll-y-contain"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {state.phase !== 'idle' && (
                <div className="flex justify-center py-4">
                    <Loader2
                        aria-hidden="true"
                        className={cn(
                            "h-6 w-6 text-primary",
                            state.phase === 'refreshing' && "animate-spin"
                        )}
                    />
                </div>
            )}
            {/* Ogłoszenie dla czytnika — region w DOM od początku, zmienia się treść */}
            <span role="status" className="sr-only">
                {state.phase === 'refreshing' ? 'Odświeżanie' : ''}
            </span>
            {children}
        </div>
    );
}
```

### Swipe Actions

Swipe jest skrótem, nie jedyną drogą do akcji (WCAG 2.5.1 i 2.5.7, [accessibility.md](accessibility.md), sekcja Dragging Movements): te same akcje są w wierszu jako przyciski. Gest łatwo wykonać przypadkiem, więc akcja destrukcyjna nie wykonuje się od razu — usunięcie przechodzi przez potwierdzenie (`useConfirm`), a archiwizacja daje „Cofnij” w toaście ([component-ux.md](component-ux.md), sekcja Confirm Before Action). Kolory tła biorą się z tokenów (`bg-success`, `bg-destructive`) przez warstwy z animowaną przezroczystością, zamiast wartości rgb wpisanych w kod.
```typescript
import { Archive, Trash2 } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';

import { Button } from '@/components/ui/button';

const SWIPE_MAX_OFFSET_PX = 100;
const SWIPE_ACTION_THRESHOLD_PX = 80;

interface SwipeableItemProps {
    children: React.ReactNode;
    itemLabel: string;
    onArchive: () => void; // odwracalne: hook pokazuje toast z „Cofnij”
    onDelete: () => void; // nieodwracalne: przed usunięciem woła confirm()
}

export function SwipeableItem({ children, itemLabel, onArchive, onDelete }: SwipeableItemProps) {
    const x = useMotionValue(0);
    const shouldReduceMotion = useReducedMotion();
    const archiveOpacity = useTransform(x, [0, SWIPE_ACTION_THRESHOLD_PX], [0, 1]);
    const deleteOpacity = useTransform(x, [-SWIPE_ACTION_THRESHOLD_PX, 0], [1, 0]);

    const handleDragEnd = () => {
        const offset = x.get();
        // Wiersz wraca na miejsce; akcję potwierdza dialog albo „Cofnij” w toaście.
        // Imperatywne animate() nie czyta MotionConfig, więc reduced motion sprawdzasz sam
        if (shouldReduceMotion) {
            x.set(0);
        } else {
            void animate(x, 0);
        }
        if (offset < -SWIPE_ACTION_THRESHOLD_PX) onDelete();
        if (offset > SWIPE_ACTION_THRESHOLD_PX) onArchive();
    };

    return (
        <div className="relative overflow-hidden">
            {/* Tło gestu — dekoracyjne, akcje są dostępne przyciskami w wierszu */}
            <motion.div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-start bg-success px-4 text-success-foreground"
                style={{ opacity: archiveOpacity }}
            >
                <Archive className="h-5 w-5" />
            </motion.div>
            <motion.div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-end bg-destructive px-4 text-destructive-foreground"
                style={{ opacity: deleteOpacity }}
            >
                <Trash2 className="h-5 w-5" />
            </motion.div>

            {/* Content */}
            <motion.div
                drag="x"
                dragConstraints={{ left: -SWIPE_MAX_OFFSET_PX, right: SWIPE_MAX_OFFSET_PX }}
                onDragEnd={handleDragEnd}
                style={{ x }}
                className="relative flex items-center gap-2 bg-background"
            >
                <div className="min-w-0 flex-1">{children}</div>

                {/* ✅ Alternatywa dla gestu — cele 44px na dotyku */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="pointer-coarse:size-11"
                    onClick={onArchive}
                    aria-label={`Archiwizuj: ${itemLabel}`}
                >
                    <Archive className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="pointer-coarse:size-11"
                    onClick={onDelete}
                    aria-label={`Usuń: ${itemLabel}`}
                >
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                </Button>
            </motion.div>
        </div>
    );
}
```

Użycie — gest i przyciski wołają te same funkcje, więc zabezpieczenie działa dla obu dróg:
```typescript
function TemplateRow({ template }: { template: Template }) {
    const confirm = useConfirm();
    const archiveTemplate = useArchiveTemplate(); // onSuccess hooka pokazuje toast z „Cofnij”
    const deleteTemplate = useDeleteTemplate(); // onError hooka loguje TEMPLATE_DELETE_FAILED

    const handleDelete = async () => {
        const isConfirmed = await confirm({
            title: 'Usuń szablon',
            description: `Szablon „${template.name}” zostanie usunięty na stałe.`,
            confirmText: 'Usuń',
            isDestructive: true,
        });
        if (isConfirmed) deleteTemplate.mutate(template.id);
    };

    return (
        <SwipeableItem
            itemLabel={template.name}
            onArchive={() => archiveTemplate.mutate(template.id)}
            onDelete={() => void handleDelete()}
        >
            <span className="font-medium">{template.name}</span>
        </SwipeableItem>
    );
}
```

Powrót wiersza jest imperatywnym `animate(x, 0)`, a takie wywołanie nie czyta kontekstu `MotionConfig reducedMotion="user"` ([animations.md](animations.md)). Dlatego `SwipeableItem` sam sprawdza `useReducedMotion()` i przy ograniczonym ruchu ustawia `x.set(0)` bez animacji.

### Floating Action Button (FAB)
```typescript
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function FAB({ onClick }: { onClick: () => void }) {
    return (
        <Button
            size="icon"
            onClick={onClick}
            className={cn(
                "md:hidden fixed right-4 bottom-20 z-30",
                "h-14 w-14 rounded-full",
                "shadow-lg shadow-primary/25",
                "hover:shadow-xl hover:shadow-primary/30"
            )}
            aria-label="Utwórz nowy"
        >
            <Plus className="h-6 w-6" aria-hidden="true" />
        </Button>
    );
}
```

### Mobile Form Patterns
```typescript
// Input z większym touch target
<Input className="h-12 text-base" />

// Select natywny na mobile
<select className="md:hidden h-12 w-full rounded-md border px-3">
    {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
</select>

// Custom Select na desktop
<div className="hidden md:block">
    <Select>{/* shadcn Select */}</Select>
</div>
```

### Auto-resize Textarea
```typescript
// CSS-only auto-resize (Chrome/Edge 123+)
<Textarea className="[field-sizing:content] min-h-[80px] max-h-[200px]" />

// Fallback: JavaScript resize
<Textarea
    rows={3}
    onInput={(e) => {
        e.currentTarget.style.height = 'auto';
        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
    }}
/>
```
**Uwaga:** `field-sizing: content` wspierane tylko w Chrome/Edge. Stosuj z fallbackiem JS.

### Sticky Elements
```typescript
// Sticky header z blur
<header className={cn(
    "sticky top-0 z-30",
    "bg-background/80 backdrop-blur-sm",
    "border-b"
)}>
    {/* ... */}
</header>

// Sticky CTA na mobile — padding 16px plus safe area w jednej wartości (pb-safe nadpisałby dolne 16px)
<div className={cn(
    "md:hidden fixed bottom-0 inset-x-0 z-30",
    "bg-background/80 backdrop-blur-sm border-t",
    "p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
)}>
    <Button className="w-full min-h-11">Zapisz</Button>
</div>
```

### Scroll Snap (Horizontal Carousel)
```typescript
import { Children } from 'react';

import { cn } from '@/lib/utils';

function HorizontalScroll({ children }: { children: React.ReactNode }) {
    return (
        <div className={cn(
            "flex gap-4 overflow-x-auto",
            "snap-x snap-mandatory",
            "scrollbar-hide",
            "-mx-4 px-4"  // Full-bleed na mobile
        )}>
            {Children.map(children, child => (
                <div className="snap-start shrink-0 w-[280px]">
                    {child}
                </div>
            ))}
        </div>
    );
}
```
```css
/* src/index.css — @utility (Tailwind v4), żeby działały warianty (md:scrollbar-hide) */
@utility scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
    &::-webkit-scrollbar {
        display: none;
    }
}
```

## Zobacz Także

- [design-system.md](design-system.md) - Spacing scale
- [component-ux.md](component-ux.md) - Mobile patterns, potwierdzenie i „Cofnij” dla akcji destrukcyjnych
- [accessibility.md](accessibility.md) - Rozmiar celu, alternatywy dla gestów
- [animations.md](animations.md) - Responsive animations
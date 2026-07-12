# Responsive Design

Mobile-first, container queries, dynamic viewport units - standardy 2026.

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

## Container Queries (2026)

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
/* globals.css */
.min-h-screen-safe {
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
```css
/* globals.css */
.text-fluid-xl {
    font-size: clamp(1.5rem, 1rem + 2vw, 2.25rem);
}

.text-fluid-2xl {
    font-size: clamp(1.875rem, 1.25rem + 2.5vw, 3rem);
}

.text-fluid-3xl {
    font-size: clamp(2.25rem, 1.5rem + 3vw, 3.75rem);
}
```

### Użycie
```typescript
// Fluid hero title
<h1 className="text-fluid-3xl font-bold">
    Płynne skalowanie
</h1>

// Lub z Tailwind arbitrary values
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

// Custom aspect ratio
<div className="aspect-[4/3] bg-muted">
    <img src={image} className="w-full h-full object-contain" />
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

**Wsparcie:** Chrome 127+, Edge 126+, Firefox 149+, Safari 26.1+.

**Rekomendacja:** Stosuj jako progressive enhancement. Dla pełnego wsparcia przeglądarek nadal używaj Radix UI positioning lub floating-ui.

---

## Touch-Friendly Design

### Minimum Touch Targets (WCAG 2.2)
```typescript
// 44px minimum - Tailwind v4
<Button className="min-h-11 min-w-11">
    Dotknij
</Button>

// Icon button
<Button size="icon" className="h-11 w-11">
    <Heart className="h-5 w-5" />
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
    <Button size="icon" />
    <Button size="icon" />
    <Button size="icon" />
</div>
```

---

## Hover vs Touch

### Media Query dla Hover
```typescript
// Hover tylko na urządzeniach z precyzyjnym pointerem
<Card className={cn(
    "transition-all duration-200",
    // @media (hover: hover) and (pointer: fine)
    "hover:shadow-md hover:-translate-y-0.5"
)}>
    {children}
</Card>
```

### Touch Feedback
```typescript
// Active state dla touch
<button className={cn(
    "transition-transform",
    "active:scale-95"
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
<nav className="flex items-center justify-between p-4">
    <Logo className="h-8" />

    {/* Desktop nav */}
    <div className="hidden md:flex items-center gap-4">
        <NavLink href="/">Home</NavLink>
        <NavLink href="/templates">Szablony</NavLink>
        <Button>Zaloguj</Button>
    </div>

    {/* Mobile menu trigger */}
    <Sheet>
        <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
            </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px]">
            <nav className="flex flex-col gap-4 mt-8">
                <NavLink href="/">Home</NavLink>
                <NavLink href="/templates">Szablony</NavLink>
                <Button className="w-full">Zaloguj</Button>
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
| **Touch targets 44px** | Wszystkie interaktywne |

---
---

## Mobile Patterns

### Bottom Navigation
```typescript
import { Home, Search, PlusCircle, Heart, User } from 'lucide-react';
import { NavLink } from 'react-router';

function BottomNav() {
    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-background border-t z-30 pb-safe">
            <ul className="flex justify-around">
                {[
                    { to: '/', icon: Home, label: 'Home' },
                    { to: '/search', icon: Search, label: 'Szukaj' },
                    { to: '/create', icon: PlusCircle, label: 'Utwórz' },
                    { to: '/favorites', icon: Heart, label: 'Ulubione' },
                    { to: '/profile', icon: User, label: 'Profil' },
                ].map(({ to, icon: Icon, label }) => (
                    <li key={to}>
                        <NavLink
                            to={to}
                            className={({ isActive }) => cn(
                                "flex flex-col items-center py-2 px-3 min-h-12 min-w-12",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <Icon className="h-5 w-5" />
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
```css
/* globals.css */
.pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 0);
}
```

### Bottom Sheet
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

function BottomSheet({ 
    open, 
    onOpenChange, 
    title, 
    children 
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent 
                side="bottom" 
                className="h-[85dvh] rounded-t-2xl"
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-2 pb-4">
                    <div className="w-10 h-1 bg-muted rounded-full" />
                </div>
                
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
```typescript
import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';

function PullToRefresh({ 
    onRefresh, 
    children 
}: { 
    onRefresh: () => Promise<void>; 
    children: React.ReactNode 
}) {
    const [pulling, setPulling] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const startY = useRef(0);
    const pullDistance = useRef(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            startY.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY.current === 0) return;
        
        pullDistance.current = e.touches[0].clientY - startY.current;
        if (pullDistance.current > 0 && pullDistance.current < 100) {
            setPulling(true);
        }
    };

    const handleTouchEnd = async () => {
        if (pullDistance.current > 60) {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
        }
        setPulling(false);
        startY.current = 0;
        pullDistance.current = 0;
    };

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {(pulling || refreshing) && (
                <div className="flex justify-center py-4">
                    <Loader2 className={cn(
                        "h-6 w-6 text-primary",
                        refreshing && "animate-spin"
                    )} />
                </div>
            )}
            {children}
        </div>
    );
}
```

### Swipe Actions
```typescript
import { motion, useMotionValue, useTransform } from 'motion/react';
import { Trash2, Archive } from 'lucide-react';

function SwipeableItem({ 
    children, 
    onDelete, 
    onArchive 
}: {
    children: React.ReactNode;
    onDelete: () => void;
    onArchive: () => void;
}) {
    const x = useMotionValue(0);
    const background = useTransform(
        x,
        [-100, 0, 100],
        ['rgb(239 68 68)', 'rgb(255 255 255)', 'rgb(34 197 94)']
    );

    const handleDragEnd = () => {
        const xVal = x.get();
        if (xVal < -80) onDelete();
        if (xVal > 80) onArchive();
    };

    return (
        <div className="relative overflow-hidden">
            {/* Background actions */}
            <motion.div 
                className="absolute inset-0 flex items-center justify-between px-4"
                style={{ background }}
            >
                <Archive className="h-5 w-5 text-white" />
                <Trash2 className="h-5 w-5 text-white" />
            </motion.div>

            {/* Content */}
            <motion.div
                drag="x"
                dragConstraints={{ left: -100, right: 100 }}
                onDragEnd={handleDragEnd}
                style={{ x }}
                className="bg-background relative"
            >
                {children}
            </motion.div>
        </div>
    );
}
```

### Floating Action Button (FAB)
```typescript
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
            <Plus className="h-6 w-6" />
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

// Sticky CTA na mobile
<div className={cn(
    "md:hidden fixed bottom-0 inset-x-0 z-30",
    "bg-background/80 backdrop-blur-sm border-t",
    "p-4 pb-safe"
)}>
    <Button className="w-full">Zapisz</Button>
</div>
```

### Scroll Snap (Horizontal Carousel)
```typescript
function HorizontalScroll({ children }: { children: React.ReactNode }) {
    return (
        <div className={cn(
            "flex gap-4 overflow-x-auto",
            "snap-x snap-mandatory",
            "scrollbar-hide",
            "-mx-4 px-4"  // Full-bleed na mobile
        )}>
            {React.Children.map(children, child => (
                <div className="snap-start shrink-0 w-[280px]">
                    {child}
                </div>
            ))}
        </div>
    );
}
```
```css
/* globals.css */
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
```

## Zobacz Także

- [design-system.md](design-system.md) - Spacing scale
- [component-ux.md](component-ux.md) - Mobile patterns
- [animations.md](animations.md) - Responsive animations
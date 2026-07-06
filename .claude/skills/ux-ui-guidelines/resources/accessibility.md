# Dostępność (Accessibility)

WCAG 2.2 AA, ARIA, nawigacja klawiaturą - standardy 2026.

---

## WCAG 2.2 Wymagania

### Nowe w WCAG 2.2 (2023)

| Kryterium | Poziom | Opis |
|-----------|--------|------|
| 2.4.11 Focus Not Obscured | AA | Focus nie może być całkowicie zasłonięty |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Focus nie może być częściowo zasłonięty |
| 2.5.7 Dragging Movements | AA | Alternatywa dla drag-and-drop |
| 2.5.8 Target Size (Minimum) | AA | Min 24x24px dla touch targets |
| 3.2.6 Consistent Help | A | Pomoc w spójnym miejscu |
| 3.3.7 Redundant Entry | A | Nie wymagaj ponownego wpisywania |

### Status Regulacyjny (2026)

- **WCAG 2.2** (W3C Recommendation, Paź 2023) — obowiązująca wersja rekomendacji do wdrożeń
- **EU EAA** (European Accessibility Act) — obowiązuje od 28 czerwca 2025, wymaga WCAG 2.2
- **WCAG 3.0** — Working Draft (marzec 2026), NIE gotowy do implementacji (~2028)

---

## Kontrast Kolorów

### Wymagania

| Element | Minimum | Enhanced |
|---------|---------|----------|
| Tekst normalny | 4.5:1 | 7:1 |
| Tekst duży (18px+ lub 14px bold) | 3:1 | 4.5:1 |
| UI Components (przyciski, ikony) | 3:1 | - |

### Sprawdzanie
```typescript
// Narzędzia:
// - Chrome DevTools > Elements > Accessibility
// - axe DevTools extension
// - https://webaim.org/resources/contrastchecker/
// - https://colorable.jxnblk.com/
```

### Przykłady
```typescript
// ✅ Wystarczający kontrast
<p className="text-foreground">Główny tekst</p>
<p className="text-muted-foreground">Tekst drugorzędny</p>

// ❌ Za mały kontrast
<p className="text-gray-400 bg-white">Za jasny tekst</p>
```

### prefers-contrast
```css
/* globals.css */
@media (prefers-contrast: more) {
    :root {
        --color-border: oklch(0.3 0.02 260);  /* Ciemniejsze borders */
        --color-muted-foreground: oklch(0.35 0.02 260);  /* Ciemniejszy tekst */
    }
}
```
```typescript
// Hook
function usePrefersContrast() {
    const [prefersMore, setPrefersMore] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-contrast: more)');
        setPrefersMore(mq.matches);
        
        const handler = (e: MediaQueryListEvent) => setPrefersMore(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return prefersMore;
}
```

### forced-colors (Windows High Contrast)
```css
/* globals.css */
@media (forced-colors: active) {
    .custom-checkbox {
        border: 2px solid ButtonText;
    }
    .icon-button svg {
        fill: ButtonText;
    }
}
```
**Wsparcie:** ~93% globalnie. Ważne dla użytkowników Windows z trybem wysokiego kontrastu.

### prefers-reduced-transparency
```css
/* globals.css - progressive enhancement */
@media (prefers-reduced-transparency: reduce) {
    .glass-panel {
        backdrop-filter: none;
        background: var(--color-background);
    }
}
```
**Wsparcie:** Tylko Chrome/Edge 118+. Stosuj jako progressive enhancement.

---

## Target Size (WCAG 2.2)

### Wymagania

| Poziom | Rozmiar | Użycie |
|--------|---------|--------|
| AA (2.5.8) | Min 24x24px | Wszystkie touch targets |
| AAA | Min 44x44px | Rekomendowane |

### Implementacja
```typescript
// ✅ Minimum 24px (WCAG AA)
<Button className="min-h-6 min-w-6">Small</Button>

// ✅ Rekomendowane 44px (WCAG AAA / Apple HIG)
<Button className="min-h-11 min-w-11">Standard</Button>

// Icon button
<Button size="icon" className="h-11 w-11">
    <Heart className="h-5 w-5" />
</Button>

// Link z wystarczającym padding
<a className="inline-flex items-center gap-2 py-3 px-4 -m-3">
    Link z touch target
</a>
```

### Spacing Between Targets
```typescript
// Min 8px między touch targets
<div className="flex gap-2">
    <Button size="icon" />
    <Button size="icon" />
</div>
```

### Wyjątki

Target size nie dotyczy:
- Linków w tekście (inline)
- Elementów kontrolowanych przez user agent (native checkboxy)
- Gdy mniejszy rozmiar jest niezbędny dla funkcji

---

## Focus States

### Focus Visible
```typescript
// Wzorzec focus-visible (nie zwykły focus)
<button className={cn(
    "bg-primary text-primary-foreground",
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-ring",
    "focus-visible:ring-offset-2"
)}>
    Przycisk
</button>

// Link
<a className={cn(
    "text-primary underline-offset-4 hover:underline",
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-ring",
    "rounded-sm"  // Dla lepszego ring shape
)}>
    Link
</a>
```

### Focus Not Obscured (WCAG 2.2 - 2.4.11)

Focus nie może być zasłonięty przez sticky/fixed elements.
```typescript
// ❌ Problem - sticky header zasłania focus
<header className="sticky top-0 z-30">Navigation</header>
<main>
    <button>Ten focus może być zasłonięty</button>
</main>

// ✅ Rozwiązanie - scroll-margin
<main className="scroll-mt-16"> {/* Wysokość headera */}
    <button className="scroll-mt-16">Focus widoczny</button>
</main>

// ✅ Lub scroll-padding na kontenerze
<html className="scroll-pt-16">
```
```css
/* globals.css */
:target {
    scroll-margin-top: 4rem;  /* Wysokość sticky header */
}

:focus {
    scroll-margin-top: 4rem;
}
```

### Focus Management
```typescript
// Focus po otwarciu modala
function Modal({ isOpen, children }: Props) {
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            closeButtonRef.current?.focus();
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen}>
            <DialogContent>
                <DialogClose ref={closeButtonRef}>×</DialogClose>
                {children}
            </DialogContent>
        </Dialog>
    );
}

// Focus po usunięciu elementu z listy
function List({ items }: Props) {
    const listRef = useRef<HTMLUListElement>(null);

    const handleDelete = (id: string, index: number) => {
        deleteItem(id);
        
        // Focus na poprzedni lub następny element
        requestAnimationFrame(() => {
            const buttons = listRef.current?.querySelectorAll('button');
            const targetIndex = Math.min(index, (buttons?.length ?? 1) - 1);
            (buttons?.[targetIndex] as HTMLButtonElement)?.focus();
        });
    };

    return <ul ref={listRef}>{/* items */}</ul>;
}
```

---

## ARIA

### Przyciski z Ikonami
```typescript
// ❌ Brak kontekstu
<button>
    <Heart className="h-5 w-5" />
</button>

// ✅ aria-label
<button aria-label="Dodaj do ulubionych">
    <Heart className="h-5 w-5" />
</button>

// ✅ sr-only text
<button>
    <Heart className="h-5 w-5" aria-hidden="true" />
    <span className="sr-only">Dodaj do ulubionych</span>
</button>
```

### Stany Dynamiczne
```typescript
// Loading button
<button
    disabled={isPending}
    aria-busy={isPending}
    aria-disabled={isPending}
>
    {isPending ? 'Zapisywanie...' : 'Zapisz'}
</button>

// Expanded/collapsed
<button
    aria-expanded={isOpen}
    aria-controls="menu-content"
>
    Menu
</button>
<div id="menu-content" hidden={!isOpen}>
    {/* Content */}
</div>

// Toggle button
<button
    aria-pressed={isActive}
    onClick={() => setIsActive(!isActive)}
>
    {isActive ? 'Aktywne' : 'Nieaktywne'}
</button>

// Selected in list
<li
    role="option"
    aria-selected={isSelected}
>
    {item.name}
</li>
```

### aria-live Regions
```typescript
// Polite - czeka na zakończenie aktualnego czytania
<div aria-live="polite" aria-atomic="true">
    {statusMessage}
</div>

// Assertive - przerywa natychmiast (używaj rzadko)
<div aria-live="assertive" role="alert">
    {errorMessage}
</div>

// Praktyczny przykład - status operacji
function SaveButton() {
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    return (
        <>
            <button onClick={handleSave}>Zapisz</button>
            
            {/* Announcement dla screen readers */}
            <div aria-live="polite" className="sr-only">
                {status === 'saving' && 'Zapisywanie...'}
                {status === 'saved' && 'Zapisano pomyślnie'}
                {status === 'error' && 'Błąd podczas zapisywania'}
            </div>
        </>
    );
}
```

### Nowe Atrybuty ARIA 1.3

```typescript
// aria-description — bezpośredni opis (zamiast aria-describedby dla prostych przypadków)
<button aria-description="Usuwa element na stałe">
    <Trash className="h-4 w-4" />
</button>

// aria-errormessage — powiązanie komunikatu błędu z polem
<Input
    id="email"
    aria-invalid={!!errors.email}
    aria-errormessage={errors.email ? 'email-error' : undefined}
/>
<p id="email-error" role="alert">{errors.email?.message}</p>
```

**Uwaga:** `aria-description` to uproszczenie dla przypadków gdzie `aria-describedby` wymaga dodatkowego elementu DOM. `aria-errormessage` jest semantycznie precyzyjniejsze niż `aria-describedby` dla błędów.

### role="alert" dla Błędów
```typescript
{error && (
    <div
        role="alert"
        className="p-3 rounded-md bg-destructive/10 text-destructive text-sm"
    >
        {error}
    </div>
)}
```

---

## Formularze

### Labels
```typescript
// ZAWSZE łącz label z input
<div className="space-y-2">
    <Label htmlFor="email">Email</Label>
    <Input
        id="email"
        type="email"
        aria-describedby="email-hint email-error"
    />
    <p id="email-hint" className="text-xs text-muted-foreground">
        Użyjemy go do potwierdzenia
    </p>
    {error && (
        <p id="email-error" role="alert" className="text-xs text-destructive">
            {error}
        </p>
    )}
</div>
```

### Required Fields
```typescript
<div className="space-y-2">
    <Label htmlFor="name">
        Imię
        <span className="text-destructive ml-1" aria-hidden="true">*</span>
    </Label>
    <Input
        id="name"
        required
        aria-required="true"
    />
</div>

// Lub opis na początku formularza
<p className="text-sm text-muted-foreground mb-4">
    Pola oznaczone <span className="text-destructive">*</span> są wymagane
</p>
```

### Invalid Fields
```typescript
<Input
    id="email"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? 'email-error' : undefined}
    className={errors.email ? 'border-destructive' : ''}
/>
{errors.email && (
    <p id="email-error" role="alert" className="text-sm text-destructive">
        {errors.email.message}
    </p>
)}
```

### Fieldset dla Grup
```typescript
<fieldset className="space-y-3">
    <legend className="text-sm font-medium">Preferowany kontakt</legend>
    
    <div className="flex items-center gap-2">
        <input type="radio" id="contact-email" name="contact" value="email" />
        <label htmlFor="contact-email">Email</label>
    </div>
    
    <div className="flex items-center gap-2">
        <input type="radio" id="contact-phone" name="contact" value="phone" />
        <label htmlFor="contact-phone">Telefon</label>
    </div>
</fieldset>
```

---

## Dragging Movements (WCAG 2.2 - 2.5.7)

Każda akcja drag-and-drop musi mieć alternatywę single-pointer.

### Przykład: Sortowalna Lista
```typescript
function SortableList({ items, onReorder }: Props) {
    return (
        <ul>
            {items.map((item, index) => (
                <li key={item.id} className="flex items-center gap-2">
                    {/* Drag handle */}
                    <button
                        className="cursor-grab"
                        aria-label={`Przeciągnij ${item.name}`}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                    
                    <span>{item.name}</span>
                    
                    {/* ✅ Alternatywy dla drag */}
                    <div className="flex gap-1 ml-auto">
                        <button
                            onClick={() => onReorder(index, index - 1)}
                            disabled={index === 0}
                            aria-label={`Przenieś ${item.name} w górę`}
                        >
                            <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => onReorder(index, index + 1)}
                            disabled={index === items.length - 1}
                            aria-label={`Przenieś ${item.name} w dół`}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
}
```

---

## Inert Attribute

`inert` wyłącza interakcję i dostępność dla elementu i jego dzieci. **Baseline** od IV.2023 (~94%+ globalnie) — bezpieczny w produkcji bez polyfilli. W React 19 `inert` to natywny boolean — przekazuj `inert={warunek}`, bez hacku `inert={x ? '' : undefined}`.

### Modal z inert
```typescript
function App() {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            {/* Main content - inert gdy modal otwarty */}
            <div inert={modalOpen}>
                <Header />
                <main>{/* Content */}</main>
                <Footer />
            </div>

            {/* Modal - poza inert */}
            {modalOpen && (
                <Dialog open onOpenChange={setModalOpen}>
                    <DialogContent>{/* ... */}</DialogContent>
                </Dialog>
            )}
        </>
    );
}
```

### Drawer/Sidebar
```typescript
function Layout({ children }: Props) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <>
            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 w-64 transform transition-transform",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
                inert={!sidebarOpen}
            >
                <nav>{/* Navigation */}</nav>
            </aside>

            {/* Main - inert gdy sidebar otwarty na mobile */}
            <main
                inert={sidebarOpen}
                className="md:ml-64"
            >
                {children}
            </main>
        </>
    );
}
```

---

## Popover API (Natywne Popovers)

Popover API (Baseline Widely Available od IV.2025) oferuje wbudowaną dostępność:

### Co przeglądarka robi automatycznie
- `aria-expanded` na trigger button
- Focus management (powrót focusu po zamknięciu)
- Zamknięcie przez Escape i kliknięcie poza elementem
- Light dismiss behavior

### Implementacja
```typescript
// Natywny popover — bez JS, z wbudowaną dostępnością
<button popovertarget="menu-popover">Menu</button>
<div id="menu-popover" popover>
    <nav>
        <a href="/settings">Ustawienia</a>
        <a href="/help">Pomoc</a>
    </nav>
</div>

// Tooltip pattern
<button popovertarget="tooltip-1" popovertargetaction="toggle">
    <Info className="h-4 w-4" />
</button>
<div id="tooltip-1" popover="hint" role="tooltip">
    Dodatkowe informacje
</div>
```

### Kiedy Popover vs Dialog
| Popover API | `<dialog>` / Radix Dialog |
|-------------|---------------------------|
| Tooltips, menu, panele | Modalne okna dialogowe |
| Non-modal (nie blokuje UI) | Wymaga interakcji użytkownika |
| Light dismiss (klik poza) | Focus trap, overlay |
| Wbudowany focus return | Wymaga zarządzania focusem |

---

## Nawigacja Klawiaturą

### Tab Order
```typescript
// Naturalna kolejność - nie używaj tabindex > 0

// tabindex="0" - dodaj do tab order
<div
    tabIndex={0}
    role="button"
    onClick={handleClick}
    onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    }}
>
    Custom button
</div>

// tabindex="-1" - focus programowy, nie w tab order
<div ref={ref} tabIndex={-1}>
    Fokus przez ref.current.focus()
</div>
```

### Arrow Keys dla List
```typescript
function Listbox({ items, value, onChange }: Props) {
    const [focusedIndex, setFocusedIndex] = useState(0);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex((i) => Math.min(i + 1, items.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex((i) => Math.max(i - 1, 0));
                break;
            case 'Home':
                e.preventDefault();
                setFocusedIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setFocusedIndex(items.length - 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                onChange(items[focusedIndex]);
                break;
        }
    };

    return (
        <ul role="listbox" onKeyDown={handleKeyDown}>
            {items.map((item, index) => (
                <li
                    key={item.id}
                    role="option"
                    aria-selected={value === item}
                    tabIndex={index === focusedIndex ? 0 : -1}
                >
                    {item.name}
                </li>
            ))}
        </ul>
    );
}
```

---

## Screen Reader Only
```typescript
// Tailwind class
<span className="sr-only">Tekst tylko dla screen readers</span>

// Przykłady użycia
// External link
<a href="https://example.com" target="_blank" rel="noopener">
    Dokumentacja
    <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
    <span className="sr-only">(otwiera się w nowym oknie)</span>
</a>

// Icon button
<button aria-label="Usuń">
    <Trash className="h-4 w-4" aria-hidden="true" />
</button>

// Badge count
<button>
    <Bell className="h-5 w-5" />
    <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-white text-xs rounded-full">
        3
    </span>
    <span className="sr-only">Powiadomienia: 3 nieprzeczytane</span>
</button>
```

---

## Skip Links
```typescript
// Na początku <body>

    href="#main-content"
    className={cn(
        "sr-only focus:not-sr-only",
        "focus:absolute focus:top-4 focus:left-4 focus:z-50",
        "focus:bg-background focus:px-4 focus:py-2",
        "focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-ring"
    )}
>
    Przeskocz do głównej treści
</a>

// Target
<main id="main-content" tabIndex={-1}>
    {/* Główna zawartość */}
</main>
```

---

## Element `<search>` (HTML)

Semantyczny landmark zastępujący `role="search"`:
```typescript
// ✅ Nowy standard (2024+)
<search>
    <form>
        <Label htmlFor="q">Szukaj</Label>
        <Input type="search" id="q" name="q" />
        <Button type="submit">Szukaj</Button>
    </form>
</search>

// ❌ Stary sposób
<div role="search">
    <form>...</form>
</div>
```

**Wsparcie:** Chrome 118+, Firefox 118+, Safari 17+, Edge 118+.

**Uwaga:** Gdy na stronie jest kilka obszarów wyszukiwania, dodaj `aria-label`:
```typescript
<search aria-label="Wyszukiwanie produktów">...</search>
<search aria-label="Wyszukiwanie w dokumentacji">...</search>
```

---

## Testowanie

### Narzędzia

| Narzędzie | Użycie |
|-----------|--------|
| axe DevTools | Automatyczne testy w przeglądarce |
| WAVE | Wizualna analiza |
| Lighthouse | Audyt w Chrome DevTools |
| NVDA / VoiceOver | Testowanie screen reader |
| Keyboard only | Wyłącz mysz, używaj tylko Tab |

### Checklist

**Każdy komponent:**
- [ ] Focus visible (ring-2)
- [ ] Focus not obscured
- [ ] Kontrast min 4.5:1
- [ ] Touch target min 24x24px
- [ ] ARIA labels dla ikon
- [ ] Semantyczne HTML

**Formularze:**
- [ ] Label + htmlFor
- [ ] aria-describedby dla hints/errors
- [ ] aria-invalid dla błędów
- [ ] role="alert" dla error messages
- [ ] Required oznaczone

**Modale:**
- [ ] Focus trap
- [ ] Escape zamyka
- [ ] Focus wraca po zamknięciu
- [ ] inert na tle

**Interakcje drag:**
- [ ] Alternatywa single-pointer (przyciski góra/dół)

---

## Podsumowanie

| Kryterium | Wymaganie |
|-----------|-----------|
| Kontrast tekstu | 4.5:1 (AA) |
| Kontrast UI | 3:1 |
| Touch target | Min 24x24px (AA), 44x44px (AAA) |
| Focus | Widoczny, nie zasłonięty |
| Dragging | Musi mieć alternatywę |
| Errors | role="alert" |
| Icons | aria-label lub sr-only |

---

## Zobacz Także

- [design-system.md](design-system.md) - Kolory z kontrastem
- [component-ux.md](component-ux.md) - Formularze
- [animations.md](animations.md) - prefers-reduced-motion
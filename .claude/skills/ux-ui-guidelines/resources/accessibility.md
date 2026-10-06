# Dostępność (Accessibility)

WCAG 2.2 AA, ARIA, nawigacja klawiaturą. Ten plik jest jedynym źródłem zasady rozmiaru celu (sekcja [Rozmiar celu](#rozmiar-celu)); pozostałe pliki skilla ją stosują i tu linkują.

---

## WCAG 2.2 Wymagania

### Nowe w WCAG 2.2 (2023)

| Kryterium | Poziom | Opis |
|-----------|--------|------|
| 2.4.11 Focus Not Obscured | AA | Focus nie może być całkowicie zasłonięty |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Focus nie może być częściowo zasłonięty |
| 2.4.13 Focus Appearance | AAA | Widoczny wskaźnik focusu o min. rozmiarze/kontraście |
| 2.5.7 Dragging Movements | AA | Alternatywa dla drag-and-drop |
| 2.5.8 Target Size (Minimum) | AA | Min 24×24 px dla każdego celu wskaźnika (mysz i dotyk) |
| 3.2.6 Consistent Help | A | Pomoc w spójnym miejscu |
| 3.3.7 Redundant Entry | A | Nie wymagaj ponownego wpisywania |
| 3.3.8 Accessible Authentication (Minimum) | AA | Brak testów poznawczych w logowaniu (pozwól na wklejanie / menedżer haseł) |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | Bez testów poznawczych nawet z alternatywą |

Razem 9 nowych kryteriów; 4.1.1 Parsing zostało usunięte w 2.2.

### Status regulacyjny

- **WCAG 2.2** (W3C Recommendation, 5 paź 2023, zaktualizowana 12 gru 2024) — obowiązująca wersja rekomendacji do wdrożeń
- **EU EAA** (European Accessibility Act, dyr. 2019/882) — stosowana od 28 czerwca 2025; prawnym punktem odniesienia jest norma zharmonizowana EN 301 549 (V3.2.1 = WCAG 2.1 AA). Rewizja EN 301 549 z WCAG 2.2 AA jest w trakcie harmonizacji; dopóki nie zostanie zacytowana w Dz.U. UE, formalnym wymogiem pozostaje 2.1 AA. Wdrażasz WCAG 2.2 AA jako cel, bo zawiera 2.1 i spełnia oba stany prawne
- **WCAG 3.0** — szkic roboczy (Working Draft), jeszcze nie do wdrożeń; projekt nie stosuje go jako celu

---

## Kontrast Kolorów

### Wymagania

| Element | Minimum | Enhanced |
|---------|---------|----------|
| Tekst normalny | 4,5:1 | 7:1 |
| Tekst duży (18px+ lub 14px bold) | 3:1 | 4,5:1 |
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
/* src/index.css */
@media (prefers-contrast: more) {
    :root {
        --color-border: oklch(0.3 0.02 260);  /* Ciemniejsze borders */
        --color-muted-foreground: oklch(0.35 0.02 260);  /* Ciemniejszy tekst */
    }
}
```
```typescript
// src/hooks/use-prefers-contrast.ts
export function usePrefersContrast(): boolean {
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
/* src/index.css */
@media (forced-colors: active) {
    .custom-checkbox {
        border: 2px solid ButtonText;
    }
    .icon-button svg {
        fill: ButtonText;
    }
}
```
**Wsparcie:** przeglądarki Chromium i Firefox; aktualne pokrycie sprawdzasz na caniuse.com. Ważne dla użytkowników Windows z trybem wysokiego kontrastu.

### prefers-reduced-transparency
```css
/* src/index.css - progressive enhancement */
@media (prefers-reduced-transparency: reduce) {
    .glass-panel {
        backdrop-filter: none;
        background: var(--color-background);
    }
}
```
**Wsparcie:** Tylko Chrome/Edge 118+. Stosuj jako progressive enhancement.

---

## Rozmiar celu

Target Size, WCAG 2.2. To jedyne źródło tej zasady w skillu: responsive-design.md, patterns.md, component-ux.md i pozostałe pliki stosują ją i linkują tutaj.

### Zasada

| Cel | Rozmiar | Skąd | Jak w Tailwind |
|-----|---------|------|----------------|
| Każdy cel wskaźnika (mysz i dotyk) | min 24×24 px — próg twardy | WCAG 2.2 AA, 2.5.8 | `min-h-6 min-w-6` albo obszar rozszerzony pseudo-elementem |
| Kontrolka obsługiwana palcem (widok mobilny, `pointer-coarse`) | 44×44 px | Apple HIG, WCAG AAA 2.5.5 | `min-h-11 min-w-11`, `size-11`, `pointer-coarse:size-11` |
| Przycisk na desktopie (precyzyjny wskaźnik) | `size="icon"` z shadcn/ui (36–40 px), `h-9`/`h-10` | spełnia AA | bez zmian |

Próg 24 px obowiązuje zawsze, bo poniżej niego użytkownik z drżeniem ręki albo na dotyku trafia obok. 44 px stosujesz dla kontrolek, które obsługuje się palcem: elementy widoczne tylko na mobile (`md:hidden`), dolna nawigacja, FAB, akcje w wierszach listy na telefonie, a w komponentach wspólnych dla obu wskaźników — wariant `pointer-coarse:`. Na desktopie domyślne rozmiary shadcn/ui (36–40 px) są wystarczające.

Gdy widoczny element ma być mniejszy (ikona w chipie filtra, przycisk czyszczenia w polu wyszukiwania), obszar kliknięcia rozszerzasz pseudo-elementem zamiast powiększać sam element: `relative` na przycisku i `after:absolute after:-inset-N`, tak by wymiar elementu plus dwa razy N dawał 24 px (albo 44 px na dotyku). Rozszerzone obszary sąsiednich celów nie mogą na siebie nachodzić.

### Implementacja
```typescript
// ✅ Minimum 24px (WCAG AA) — próg twardy
<Button className="min-h-6 min-w-6">Small</Button>

// ✅ Kontrolka dotykowa 44px (Apple HIG / WCAG AAA 2.5.5)
<Button className="min-h-11 min-w-11">Standard</Button>

// Icon button: 36px z shadcn/ui na desktopie, 44px przy wskaźniku dotykowym
<Button size="icon" className="pointer-coarse:size-11" aria-label="Dodaj do ulubionych">
    <Heart className="h-5 w-5" aria-hidden="true" />
</Button>

// Mały widoczny element, większy obszar kliknięcia: 20px ikony + 2 × 2px = 24px, na dotyku 20px + 2 × 12px = 44px
<button
    type="button"
    className="relative inline-flex size-5 items-center justify-center rounded-full after:absolute after:-inset-0.5 pointer-coarse:after:-inset-3"
    aria-label="Usuń filtr: Marketing"
>
    <X className="h-3 w-3" aria-hidden="true" />
</button>

// Link z wystarczającym padding
<a className="inline-flex items-center gap-2 py-3 px-4 -m-3">
    Link z touch target
</a>
```

### Spacing Between Targets
```typescript
// Min 8px między celami; przy celach mniejszych niż 24px odstęp musi zmieścić
// okrąg o średnicy 24px wokół każdego celu bez nakładania się (wyjątek spacing w 2.5.8)
<div className="flex gap-2">
    <Button size="icon" aria-label="Edytuj" />
    <Button size="icon" aria-label="Usuń" />
</div>
```

### Wyjątki

Próg 24 px nie dotyczy:
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
/* src/index.css */
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
function Modal({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) {
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
// onDelete przychodzi z hooka mutacji; akcja destrukcyjna ma potwierdzenie albo „Cofnij”
// (component-ux.md, sekcja Confirm Before Action)
function List({ items, onDelete }: ListProps) {
    const listRef = useRef<HTMLUListElement>(null);

    const handleDelete = (id: string, index: number) => {
        onDelete(id);

        // Focus na poprzedni lub następny element
        requestAnimationFrame(() => {
            const buttons = listRef.current?.querySelectorAll('button');
            const targetIndex = Math.min(index, (buttons?.length ?? 1) - 1);
            buttons?.[targetIndex]?.focus();
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

// Status - role="status" to region polite (zakończenie operacji, liczba wyników)
<div role="status">
    {statusMessage}
</div>

// Assertive - przerywa natychmiast (używaj rzadko): role="alert" sam w sobie
// jest regionem assertive, więc nie łączysz go z aria-live="polite"
<div role="alert">
    {errorMessage}
</div>

// Praktyczny przykład - status operacji
// useSaveSettings: hook z useMutation → settingsService.save, onError loguje SETTINGS_SAVE_FAILED
function SaveButton({ settings }: { settings: Settings }) {
    const saveSettings = useSaveSettings();

    return (
        <>
            <button onClick={() => saveSettings.mutate(settings)} disabled={saveSettings.isPending}>
                Zapisz
            </button>

            {/* Announcement dla screen readers: postęp i sukces jako status */}
            <div role="status" className="sr-only">
                {saveSettings.status === 'pending' && 'Zapisywanie...'}
                {saveSettings.status === 'success' && 'Zapisano pomyślnie'}
            </div>

            {/* Błąd jako alert, widoczny także dla osób widzących */}
            {saveSettings.status === 'error' && (
                <p role="alert" className="text-sm text-destructive">
                    Błąd podczas zapisywania
                </p>
            )}
        </>
    );
}
```

Region `role="status"` renderujesz od początku i zmieniasz tylko jego treść; region dodany do DOM razem z komunikatem część czytników pomija.

### Nowe Atrybuty ARIA 1.3

```typescript
// aria-description — bezpośredni opis (zamiast aria-describedby dla prostych przypadków)
<button aria-description="Usuwa element na stałe">
    <Trash className="h-4 w-4" />
</button>

// aria-errormessage — uzupełnienie aria-describedby, nie jego zamiennik
<Input
    id="email"
    aria-invalid={errors.email ? true : undefined}
    aria-describedby={errors.email ? 'email-error' : undefined}
    aria-errormessage={errors.email ? 'email-error' : undefined}
/>
{errors.email && (
    <p id="email-error" role="alert">{errors.email.message}</p>
)}
```

**Uwaga:** `aria-description` to uproszczenie dla przypadków gdzie `aria-describedby` wymaga dodatkowego elementu DOM. Komunikat błędu pola wiążesz przez `aria-describedby`, bo ma najszersze wsparcie czytników ekranu; `aria-errormessage` część czytników pomija, więc dodajesz go najwyżej jako uzupełnienie (odczytywany jest tylko przy `aria-invalid`). `aria-invalid` ustawiasz na `true` przy błędzie i pomijasz bez błędu (`undefined`), żeby atrybut nie pojawiał się w DOM jako `"false"`.

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
// Każde pole ma label powiązany przez htmlFor — kliknięcie w label ustawia fokus, czytnik odczytuje nazwę pola
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
    aria-invalid={errors.email ? true : undefined}
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

Każda akcja drag-and-drop musi mieć alternatywę single-pointer. To samo dotyczy gestów ze ścieżką (swipe, pull to refresh — WCAG 2.5.1 Pointer Gestures): gest jest skrótem, a ta sama akcja jest dostępna przyciskiem albo w menu. Akcja destrukcyjna uruchomiona gestem przechodzi przez potwierdzenie albo daje „Cofnij” w toaście, bo gest łatwo wykonać przypadkiem (component-ux.md, sekcja Confirm Before Action; responsive-design.md, sekcja Swipe Actions).

### Przykład: Sortowalna Lista
```typescript
const reorderButtonClass =
    'inline-flex size-8 items-center justify-center rounded-md hover:bg-muted pointer-coarse:size-11';

function SortableList({ items, onReorder }: SortableListProps) {
    return (
        <ul>
            {items.map((item, index) => (
                <li key={item.id} className="flex items-center gap-2">
                    {/* Drag handle — cel 32px (44px na dotyku), nie ikona 16px */}
                    <button
                        type="button"
                        className={cn(reorderButtonClass, 'cursor-grab')}
                        aria-label={`Przeciągnij ${item.name}`}
                    >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <span>{item.name}</span>

                    {/* ✅ Alternatywy dla drag */}
                    <div className="flex gap-1 ml-auto">
                        <button
                            type="button"
                            className={reorderButtonClass}
                            onClick={() => onReorder(index, index - 1)}
                            disabled={index === 0}
                            aria-label={`Przenieś ${item.name} w górę`}
                        >
                            <ChevronUp className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className={reorderButtonClass}
                            onClick={() => onReorder(index, index + 1)}
                            disabled={index === items.length - 1}
                            aria-label={`Przenieś ${item.name} w dół`}
                        >
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
}
```

Rozmiar przycisków według sekcji [Rozmiar celu](#rozmiar-celu): sama ikona 16px bez paddingu jest poniżej progu 24px.

---

## Inert Attribute

`inert` wyłącza interakcję i dostępność dla elementu i jego dzieci. **Baseline** we wszystkich głównych przeglądarkach — bezpieczny w produkcji bez polyfilli. W React 19 `inert` to natywny boolean — przekazuj `inert={warunek}`, bez hacku `inert={x ? '' : undefined}`.

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
import { useMediaQuery } from '@/hooks/use-media-query';

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

function Layout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

    // Na md+ sidebar jest stale widoczny, więc ani on, ani main nie są inert.
    // Na mobile zamknięty sidebar (poza ekranem) jest inert, a otwarty blokuje main.
    const isSidebarInert = !isDesktop && !sidebarOpen;
    const isMainInert = !isDesktop && sidebarOpen;

    return (
        <>
            {/* Przełącznik poza main, żeby działał także wtedy, gdy main jest inert */}
            <button
                type="button"
                className="md:hidden inline-flex size-11 items-center justify-center"
                onClick={() => setSidebarOpen((isOpen) => !isOpen)}
                aria-expanded={sidebarOpen}
                aria-label={sidebarOpen ? 'Zamknij menu' : 'Otwórz menu'}
            >
                <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 w-64 transition-transform md:translate-x-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
                inert={isSidebarInert}
            >
                <nav>{/* Navigation */}</nav>
            </aside>

            {/* Main - inert tylko gdy sidebar otwarty na mobile */}
            <main
                inert={isMainInert}
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

Popover API (atrybut `popover` jest Baseline we wszystkich głównych przeglądarkach; aktualne pokrycie sprawdzasz na caniuse.com albo w MDN) oferuje wbudowaną dostępność:

### Co przeglądarka robi automatycznie
- `aria-expanded` na trigger button
- Focus management (powrót focusu po zamknięciu)
- Zamknięcie przez Escape i kliknięcie poza elementem
- Light dismiss behavior

### Implementacja
```typescript
// Natywny popover — bez JS, z wbudowaną dostępnością
// React 19 przyjmuje atrybuty w camelCase: popoverTarget, popoverTargetAction
<button popoverTarget="menu-popover">Menu</button>
<div id="menu-popover" popover="auto">
    <nav>
        <a href="/settings">Ustawienia</a>
        <a href="/help">Pomoc</a>
    </nav>
</div>

// Tooltip pattern
// popover="hint" nie działa jeszcze we wszystkich przeglądarkach (stan sprawdzasz na caniuse.com);
// wg spec HTML nieznana wartość degraduje do `manual` (bez light-dismiss/Esc). Dodajesz więc własne
// zamykanie na mouseout/blur/Escape albo feature-detect (ustaw el.popover='hint' i odczytaj) z fallbackiem na `auto`.
<button
    type="button"
    popoverTarget="tooltip-1"
    popoverTargetAction="toggle"
    className="inline-flex size-6 items-center justify-center rounded-sm pointer-coarse:size-11"
    aria-label="Więcej informacji"
>
    <Info className="h-4 w-4" aria-hidden="true" />
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
interface ListboxOption {
    id: string;
    name: string;
}

interface ListboxProps {
    label: string;
    items: ListboxOption[];
    value: ListboxOption | null;
    onChange: (item: ListboxOption) => void;
}

function Listbox({ label, items, value, onChange }: ListboxProps) {
    const [focusedIndex, setFocusedIndex] = useState(0);
    const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

    // Roving tabIndex: sama zmiana tabIndex nie przesuwa fokusu,
    // więc po zmianie indeksu fokus ustawiasz na elemencie przez ref
    const moveFocus = (index: number) => {
        setFocusedIndex(index);
        optionRefs.current[index]?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                moveFocus(Math.min(focusedIndex + 1, items.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                moveFocus(Math.max(focusedIndex - 1, 0));
                break;
            case 'Home':
                e.preventDefault();
                moveFocus(0);
                break;
            case 'End':
                e.preventDefault();
                moveFocus(items.length - 1);
                break;
            case 'Enter':
            case ' ': {
                e.preventDefault();
                const item = items[focusedIndex];
                if (item) onChange(item);
                break;
            }
        }
    };

    return (
        <ul role="listbox" aria-label={label} onKeyDown={handleKeyDown}>
            {items.map((item, index) => (
                <li
                    key={item.id}
                    ref={(element) => {
                        optionRefs.current[index] = element;
                    }}
                    role="option"
                    aria-selected={value?.id === item.id}
                    tabIndex={index === focusedIndex ? 0 : -1}
                    onClick={() => onChange(item)}
                    onFocus={() => setFocusedIndex(index)}
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

// Icon button — cel według sekcji Rozmiar celu
<button aria-label="Usuń" className="inline-flex size-9 items-center justify-center pointer-coarse:size-11">
    <Trash className="h-4 w-4" aria-hidden="true" />
</button>

// Badge count — licznik wizualny ukryty przed czytnikiem, pełna treść w sr-only
<button className="relative inline-flex size-9 items-center justify-center pointer-coarse:size-11">
    <Bell className="h-5 w-5" aria-hidden="true" />
    <span
        className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full"
        aria-hidden="true"
    >
        3
    </span>
    <span className="sr-only">Powiadomienia: 3 nieprzeczytane</span>
</button>
```

---

## Skip Links
```typescript
// Na początku <body>
<a
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
// ✅ Element <search> jako landmark wyszukiwania
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
- [ ] Kontrast min 4,5:1
- [ ] Rozmiar celu: min 24×24 px, kontrolki dotykowe 44×44 px ([Rozmiar celu](#rozmiar-celu))
- [ ] ARIA labels dla ikon
- [ ] Semantyczne HTML

**Formularze:**
- [ ] Label + htmlFor
- [ ] aria-describedby dla hints/errors
- [ ] aria-invalid przy błędzie (bez błędu atrybut nieobecny)
- [ ] role="alert" dla error messages
- [ ] Required oznaczone

**Modale:**
- [ ] Focus trap (Dialog z shadcn/ui albo natywny `<dialog>` z `showModal()`)
- [ ] Escape zamyka
- [ ] Focus wraca po zamknięciu
- [ ] inert na tle

**Interakcje drag i gesty:**
- [ ] Alternatywa single-pointer (przyciski góra/dół)
- [ ] Akcja ze swipe dostępna też przyciskiem; destrukcyjna z potwierdzeniem albo „Cofnij”

---

## Podsumowanie

| Kryterium | Wymaganie |
|-----------|-----------|
| Kontrast tekstu | 4,5:1 (AA) |
| Kontrast UI | 3:1 |
| Rozmiar celu | Min 24×24 px (AA, próg twardy); kontrolki dotykowe 44×44 px |
| Focus | Widoczny, nie zasłonięty |
| Dragging i gesty | Alternatywa przyciskiem; destrukcyjne z potwierdzeniem albo „Cofnij” |
| Errors | role="alert" |
| Icons | aria-label lub sr-only |

---

## Zobacz Także

- [design-system.md](design-system.md) - Kolory z kontrastem
- [component-ux.md](component-ux.md) - Formularze, potwierdzenie i „Cofnij” dla akcji destrukcyjnych
- [responsive-design.md](responsive-design.md) - Touch-friendly design, gesty
- [animations.md](animations.md) - prefers-reduced-motion
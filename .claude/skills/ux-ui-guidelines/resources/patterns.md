# UI Patterns

Nawigacja, wyświetlanie danych, wyszukiwanie i onboarding.

---

## Navigation Patterns

### Tabs
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function TemplateTabs() {
    return (
        <Tabs defaultValue="all" className="w-full">
            <TabsList>
                <TabsTrigger value="all">Wszystkie</TabsTrigger>
                <TabsTrigger value="favorites">Ulubione</TabsTrigger>
                <TabsTrigger value="recent">Ostatnie</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4">
                <TemplateGrid filter="all" />
            </TabsContent>
            <TabsContent value="favorites" className="mt-4">
                <TemplateGrid filter="favorites" />
            </TabsContent>
            <TabsContent value="recent" className="mt-4">
                <TemplateGrid filter="recent" />
            </TabsContent>
        </Tabs>
    );
}
```

**URL-Synced Tabs:**

Parametr z URL to dane z zewnątrz (użytkownik może wpisać dowolny `?tab=`), więc przechodzi przez schemat Zod z wartością domyślną. Zapis przez funkcję aktualizującą kopiuje bieżące parametry i zmienia tylko `tab` — `setSearchParams({ tab })` skasowałby filtry, wyszukiwanie i paginację.
```typescript
import { useSearchParams } from 'react-router';
import { z } from 'zod';

const TEMPLATE_TABS = ['all', 'favorites', 'recent'] as const;
const tabSchema = z.enum(TEMPLATE_TABS).catch('all');

function UrlTabs() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = tabSchema.parse(searchParams.get('tab'));

    const handleTabChange = (value: string) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            next.set('tab', tabSchema.parse(value));
            return next;
        });
    };

    return (
        <Tabs 
            value={activeTab} 
            onValueChange={handleTabChange}
        >
            {/* ... */}
        </Tabs>
    );
}
```

### Breadcrumbs
```typescript
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
    return (
        <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1 text-sm text-muted-foreground">
                <li>
                    {/* Link z samą ikoną: cel 24px zamiast 16px (accessibility.md, Rozmiar celu) */}
                    <Link 
                        to="/" 
                        className="inline-flex size-6 items-center justify-center hover:text-foreground transition-colors"
                        aria-label="Strona główna"
                    >
                        <Home className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </li>
                
                {items.map((item, index) => (
                    <li key={index} className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        {item.href ? (
                            <Link 
                                to={item.href}
                                className="hover:text-foreground transition-colors"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className="text-foreground font-medium" aria-current="page">
                                {item.label}
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

// Użycie
<Breadcrumbs items={[
    { label: 'Items', href: '/items' },
    { label: 'Technology', href: '/items?category=technology' },
    { label: 'Item details' },
]} />
```

### Pagination
```typescript
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    const pages = generatePageNumbers(currentPage, totalPages);

    return (
        <nav aria-label="Paginacja" className="flex items-center justify-center gap-1">
            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Poprzednia strona"
            >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>

            {pages.map((page, index) =>
                // Zawężenie typu przez typeof zamiast rzutowania
                typeof page === 'number' ? (
                    <Button
                        key={page}
                        variant={page === currentPage ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => onPageChange(page)}
                        aria-current={page === currentPage ? 'page' : undefined}
                        aria-label={`Strona ${page}`}
                    >
                        {page}
                    </Button>
                ) : (
                    <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground" aria-hidden="true">
                        ...
                    </span>
                )
            )}

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Następna strona"
            >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
        </nav>
    );
}

const MAX_VISIBLE_PAGES = 7;

function generatePageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= MAX_VISIBLE_PAGES) return Array.from({ length: total }, (_, i) => i + 1);
    
    if (current <= 3) return [1, 2, 3, 4, '...', total];
    if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
    
    return [1, '...', current - 1, current, current + 1, '...', total];
}
```

Przyciski `size="icon"` z shadcn/ui (36 px) spełniają próg 24 px i wystarczają na desktopie. Na wąskim ekranie dotykowym siedem numerów po 44 px się nie mieści, więc pokazujesz tam mniej: poprzednia/następna i tekst „Strona 3 z 12” — przyciski mają wtedy pełne 44 px ([accessibility.md](accessibility.md#rozmiar-celu)).

**Cursor-based (Infinite Scroll Alternative):**
```typescript
function LoadMoreButton({ 
    hasNextPage, 
    isFetchingNextPage, 
    fetchNextPage 
}: InfiniteQueryResult) {
    if (!hasNextPage) return null;

    return (
        <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full"
        >
            {isFetchingNextPage ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Ładowanie...
                </>
            ) : (
                'Załaduj więcej'
            )}
        </Button>
    );
}
```

---

## Data Display

### Responsive Table
```typescript
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface Column<T> {
    key: keyof T & string;
    header: string;
    hideOnMobile?: boolean;
    render?: (row: T) => React.ReactNode;
}

interface DataViewProps<T extends { id: string }> {
    data: T[];
    columns: Column<T>[];
}

// Klucz wiersza z id rekordu, nie z indeksu: przy sortowaniu i usuwaniu React nie myli wierszy
function DataTable<T extends { id: string }>({ data, columns }: DataViewProps<T>) {
    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        {columns.map((col) => (
                            <TableHead 
                                key={col.key} 
                                className={col.hideOnMobile ? 'hidden md:table-cell' : ''}
                            >
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row) => (
                        <TableRow key={row.id}>
                            {columns.map((col) => (
                                <TableCell 
                                    key={col.key}
                                    className={col.hideOnMobile ? 'hidden md:table-cell' : ''}
                                >
                                    {col.render ? col.render(row) : String(row[col.key])}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
```

**Mobile: Cards zamiast Table**
```typescript
function ResponsiveDataView<T extends { id: string }>({ data, columns }: DataViewProps<T>) {
    return (
        <>
            {/* Desktop: Table */}
            <div className="hidden md:block">
                <DataTable data={data} columns={columns} />
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden space-y-3">
                {data.map((item) => (
                    <Card key={item.id} className="p-4">
                        {columns.map((col) => (
                            <div key={col.key} className="flex justify-between py-1">
                                <span className="text-muted-foreground text-sm">
                                    {col.header}
                                </span>
                                <span className="font-medium">
                                    {col.render ? col.render(item) : String(item[col.key])}
                                </span>
                            </div>
                        ))}
                    </Card>
                ))}
            </div>
        </>
    );
}
```

### Empty State

Komponent `EmptyState` (`{ title, description?, action? }`) jest zdefiniowany w [component-ux.md](component-ux.md#empty-states) — ten sam w całym projekcie, więc tu go nie powtarzasz. W widokach danych rozróżniasz dwa przypadki: pusta kolekcja (opis zachęca do utworzenia pierwszego elementu, akcja tworzy) i brak wyników filtrowania (opis podpowiada zmianę kryteriów, akcja czyści filtry).
```typescript
import { EmptyState } from '@/components/empty-state';

// Brak wyników filtrowania
<EmptyState
    title="Brak wyników"
    description="Spróbuj zmienić filtry lub wyszukaj coś innego."
    action={<Button variant="outline" onClick={clearFilters}>Wyczyść filtry</Button>}
/>

// Pusta kolekcja
<EmptyState
    title="Nie masz jeszcze szablonów"
    description="Utwórz pierwszy szablon, żeby zacząć."
    action={<Button onClick={openCreateDialog}>Utwórz szablon</Button>}
/>
```

### Skeleton Loading
```typescript
import { Skeleton } from '@/components/ui/skeleton';

function TemplateCardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <Skeleton className="aspect-video w-full" />
            <div className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        </Card>
    );
}

function TemplateGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <TemplateCardSkeleton key={i} />
            ))}
        </div>
    );
}
```

---

## Search & Filtering

### Search Input with Debounce

Debounce robisz hookiem `useDebounce` z `@/hooks/use-debounce`, który projekt już ma (tailwind-react-guidelines/resources/performance.md, sekcja useDebounce Hook) — bez nowej zależności `use-debounce`. Pole jest kontrolowane i reaguje od razu, a opóźniona jest tylko wartość, która trafia do zapytania: użytkownik widzi każdy znak, a zapytanie idzie dopiero po przerwie w pisaniu.
```typescript
import { Search, X } from 'lucide-react';
import { useRef } from 'react';

import { Input } from '@/components/ui/input';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
}

function SearchInput({ value, onChange, placeholder = 'Szukaj...', label = 'Szukaj' }: SearchInputProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClear = () => {
        onChange('');
        // Fokus wraca do pola, żeby można było od razu wpisać nową frazę
        inputRef.current?.focus();
    };

    return (
        <div className="relative">
            <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
            />
            <Input
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={label}
                // Natywny przycisk czyszczenia WebKit dublowałby własny
                className="pl-9 pr-10 [&::-webkit-search-cancel-button]:hidden"
                type="search"
            />
            {value && (
                // Widoczny przycisk 28px, obszar kliknięcia 44px na dotyku (accessibility.md, Rozmiar celu)
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground after:absolute pointer-coarse:after:-inset-2"
                    aria-label="Wyczyść wyszukiwanie"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}

// Użycie: opóźniona jest wartość dla zapytania, nie pole
import { useDebounce } from '@/hooks/use-debounce';

const SEARCH_DEBOUNCE_MS = 300;

function TemplateSearch() {
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
    const templates = useTemplates({ search: debouncedQuery });

    return (
        <>
            <SearchInput value={query} onChange={setQuery} label="Szukaj szablonów" />
            <TemplateGrid templates={templates.data ?? []} />
        </>
    );
}
```

### Filter Chips
```typescript
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FilterChipsProps {
    filters: { key: string; label: string }[];
    onRemove: (key: string) => void;
    onClearAll: () => void;
}

function FilterChips({ filters, onRemove, onClearAll }: FilterChipsProps) {
    if (filters.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => (
                <Badge 
                    key={filter.key} 
                    variant="secondary"
                    className="gap-1 pr-1"
                >
                    {filter.label}
                    {/* Widoczne kółko 20px, obszar kliknięcia 24px (AA), na dotyku 44px —
                        pseudo-element zamiast powiększania chipa (accessibility.md, Rozmiar celu) */}
                    <button
                        type="button"
                        onClick={() => onRemove(filter.key)}
                        className="relative ml-1 inline-flex size-5 items-center justify-center rounded-full hover:bg-muted after:absolute after:-inset-0.5 pointer-coarse:after:-inset-3"
                        aria-label={`Usuń filtr: ${filter.label}`}
                    >
                        <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                </Badge>
            ))}
            
            {filters.length > 1 && (
                <button
                    type="button"
                    onClick={onClearAll}
                    className="min-h-6 px-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
                >
                    Wyczyść wszystkie
                </button>
            )}
        </div>
    );
}
```

Usunięcie filtru jest odwracalne jednym kliknięciem w panelu filtrów, więc nie potrzebuje potwierdzenia. Przy „Wyczyść wszystkie” z wieloma filtrami toast z „Cofnij” oszczędza ponownego ustawiania (component-ux.md, Confirm Before Action).

### Filter Panel (Mobile Drawer)
```typescript
import { Filter } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

function FilterPanel({ children, activeCount }: { children: React.ReactNode; activeCount: number }) {
    return (
        <>
            {/* Desktop: Sidebar */}
            <aside className="hidden lg:block w-64 shrink-0">
                <div className="sticky top-20 space-y-6">
                    {children}
                </div>
            </aside>

            {/* Mobile: Bottom Sheet */}
            <div className="lg:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="gap-2 min-h-11">
                            <Filter className="h-4 w-4" aria-hidden="true" />
                            Filtry
                            {activeCount > 0 && (
                                <Badge variant="secondary" className="ml-1">
                                    {activeCount}
                                    <span className="sr-only"> aktywne</span>
                                </Badge>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[80dvh]">
                        <SheetHeader>
                            <SheetTitle>Filtry</SheetTitle>
                        </SheetHeader>
                        <div className="mt-4 space-y-6 overflow-y-auto">
                            {children}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
```

### URL State Sync

Parametry z URL to dane z zewnątrz: każdy przechodzi przez schemat Zod z wartością domyślną (`.catch`), zamiast rzutowania `as`. Nieznane `?sort=` daje `newest`, za długa fraza — pusty ciąg, i widok się nie wywraca.
```typescript
// src/hooks/use-filters.ts
import { useSearchParams } from 'react-router';
import { z } from 'zod';

const SORT_OPTIONS = ['newest', 'popular', 'name'] as const;
const SEARCH_QUERY_MAX_LENGTH = 200;

const filtersSchema = z.object({
    q: z.string().max(SEARCH_QUERY_MAX_LENGTH).catch(''),
    category: z.string().min(1).nullable().catch(null),
    sort: z.enum(SORT_OPTIONS).catch('newest'),
});

export interface Filters {
    search: string;
    category: string | null;
    sort: (typeof SORT_OPTIONS)[number];
}

export function useFilters(): [Filters, (updates: Partial<Filters>) => void] {
    const [searchParams, setSearchParams] = useSearchParams();

    const parsed = filtersSchema.parse({
        q: searchParams.get('q'),
        category: searchParams.get('category'),
        sort: searchParams.get('sort'),
    });
    const filters: Filters = { search: parsed.q, category: parsed.category, sort: parsed.sort };

    const setFilters = (updates: Partial<Filters>) => {
        // Funkcja aktualizująca dostaje bieżące parametry, więc dwie szybkie zmiany się nie nadpisują
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            for (const [key, value] of Object.entries(updates)) {
                const paramKey = key === 'search' ? 'q' : key;
                if (value === null || value === undefined || value === '') {
                    next.delete(paramKey);
                } else {
                    next.set(paramKey, value);
                }
            }
            return next;
        }, { replace: true });
    };

    return [filters, setFilters];
}
```

---

## Onboarding Flows

### Multi-Step Wizard
```typescript
import { Check } from 'lucide-react';

interface Step {
    id: string;
    title: string;
    description?: string;
}

interface StepIndicatorProps {
    steps: Step[];
    currentStep: number;
}

function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
    return (
        <nav aria-label="Postęp">
            <ol className="flex items-center gap-2">
                {steps.map((step, index) => {
                    const status = index < currentStep ? 'complete' : 
                                   index === currentStep ? 'current' : 'upcoming';
                    
                    return (
                        <li
                            key={step.id}
                            className="flex items-center"
                            aria-current={status === 'current' ? 'step' : undefined}
                        >
                            {index > 0 && (
                                <div className={cn(
                                    "w-12 h-0.5 mx-2",
                                    status === 'upcoming' ? 'bg-muted' : 'bg-primary'
                                )} />
                            )}
                            
                            <div className="flex items-center gap-2">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                                    status === 'complete' && "bg-primary text-primary-foreground",
                                    status === 'current' && "border-2 border-primary text-primary",
                                    status === 'upcoming' && "border-2 border-muted text-muted-foreground"
                                )}>
                                    {status === 'complete' ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        index + 1
                                    )}
                                </div>
                                
                                <span className={cn(
                                    "hidden sm:block text-sm",
                                    status === 'current' ? "font-medium" : "text-muted-foreground"
                                )}>
                                    {step.title}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
```

**Wizard Container:**
```typescript
function OnboardingWizard() {
    const [currentStep, setCurrentStep] = useState(0);
    const [data, setData] = useState<OnboardingData>({});

    const steps: Step[] = [
        { id: 'profile', title: 'Profil' },
        { id: 'preferences', title: 'Preferencje' },
        { id: 'workspace', title: 'Workspace' },
    ];

    const updateData = (stepData: Partial<OnboardingData>) => {
        setData(prev => ({ ...prev, ...stepData }));
    };

    const nextStep = () => setCurrentStep(s => Math.min(s + 1, steps.length - 1));
    const prevStep = () => setCurrentStep(s => Math.max(s - 1, 0));

    return (
        <div className="max-w-2xl mx-auto py-8">
            <StepIndicator steps={steps} currentStep={currentStep} />
            
            <div className="mt-8">
                {currentStep === 0 && (
                    <ProfileStep data={data} onUpdate={updateData} />
                )}
                {currentStep === 1 && (
                    <PreferencesStep data={data} onUpdate={updateData} />
                )}
                {currentStep === 2 && (
                    <WorkspaceStep data={data} onUpdate={updateData} />
                )}
            </div>

            <div className="mt-8 flex justify-between">
                <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 0}
                >
                    Wstecz
                </Button>
                
                {currentStep === steps.length - 1 ? (
                    <Button onClick={handleComplete}>
                        Zakończ
                    </Button>
                ) : (
                    <Button onClick={nextStep}>
                        Dalej
                    </Button>
                )}
            </div>
        </div>
    );
}
```

### Feature Tooltip / Spotlight
```typescript
import { X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface SpotlightProps {
    id: string;
    targetSelector: string;
    title: string;
    description: string;
    placement?: Placement;
}

interface SpotlightPosition {
    top: number;
    left: number;
    transform: string;
}

// Jeden stan zamiast flagi `show` i osobnej pozycji: pozycja istnieje tylko, gdy spotlight jest widoczny
type SpotlightState = { status: 'hidden' } | { status: 'visible'; position: SpotlightPosition };

const SPOTLIGHT_OFFSET_PX = 8;

function getSpotlightPosition(rect: DOMRect, placement: Placement): SpotlightPosition {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    switch (placement) {
        case 'top':
            return { top: rect.top - SPOTLIGHT_OFFSET_PX, left: centerX, transform: 'translate(-50%, -100%)' };
        case 'bottom':
            return { top: rect.bottom + SPOTLIGHT_OFFSET_PX, left: centerX, transform: 'translateX(-50%)' };
        case 'left':
            return { top: centerY, left: rect.left - SPOTLIGHT_OFFSET_PX, transform: 'translate(-100%, -50%)' };
        case 'right':
            return { top: centerY, left: rect.right + SPOTLIGHT_OFFSET_PX, transform: 'translateY(-50%)' };
    }
}

function FeatureSpotlight({ id, targetSelector, title, description, placement = 'bottom' }: SpotlightProps) {
    const [spotlight, setSpotlight] = useState<SpotlightState>({ status: 'hidden' });
    const titleId = useId();

    useEffect(() => {
        const dismissed = localStorage.getItem(`spotlight-${id}`);
        if (dismissed) return;

        const target = document.querySelector(targetSelector);
        if (!target) return;

        setSpotlight({
            status: 'visible',
            position: getSpotlightPosition(target.getBoundingClientRect(), placement),
        });
    }, [id, targetSelector, placement]);

    const dismiss = () => {
        localStorage.setItem(`spotlight-${id}`, 'true');
        setSpotlight({ status: 'hidden' });
    };

    if (spotlight.status === 'hidden') return null;

    return (
        <>
            {/* Backdrop — kliknięcie zamyka; dla klawiatury jest przycisk Zamknij i „Rozumiem” */}
            <div className="fixed inset-0 bg-black/50 z-40" onClick={dismiss} aria-hidden="true" />
            
            {/* Tooltip */}
            <div
                role="dialog"
                aria-labelledby={titleId}
                className="fixed z-50 w-72 p-4 bg-card rounded-lg shadow-xl"
                style={spotlight.position}
            >
                <button
                    type="button"
                    onClick={dismiss}
                    className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground pointer-coarse:size-11"
                    aria-label="Zamknij"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
                
                <h4 id={titleId} className="font-semibold mb-1">{title}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
                
                <Button size="sm" className="mt-3" onClick={dismiss}>
                    Rozumiem
                </Button>
            </div>
        </>
    );
}
```

### Progress Save

`localStorage` to dane z zewnątrz: użytkownik, inna wersja aplikacji albo rozszerzenie mogą zostawić tam cokolwiek. Zapis czytasz więc przez schemat Zod przekazany do hooka, a uszkodzony JSON kończy się wartością początkową i śladem w logu zamiast wywrotki onboardingu.
```typescript
// src/hooks/use-onboarding-progress.ts
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { logger } from '@/lib/logger';

const stepSchema = z.coerce.number().int().min(0).catch(0);

function readSaved<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
    const saved = localStorage.getItem(key);
    if (saved === null) return fallback;
    try {
        const result = schema.safeParse(JSON.parse(saved));
        if (result.success) return result.data;
        logger.info('ONBOARDING_PROGRESS_INVALID', { key });
        return fallback;
    } catch (error) {
        // JSON.parse rzuca SyntaxError przy uszkodzonym zapisie; inny błąd idzie dalej
        if (!(error instanceof SyntaxError)) throw error;
        logger.warn('ONBOARDING_PROGRESS_CORRUPTED', { key });
        return fallback;
    }
}

interface OnboardingProgress<T> {
    data: T;
    setData: React.Dispatch<React.SetStateAction<T>>;
    currentStep: number;
    setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
    clearProgress: () => void;
}

export function useOnboardingProgress<T>(
    key: string,
    schema: z.ZodType<T>,
    initialData: T
): OnboardingProgress<T> {
    const [data, setData] = useState<T>(() => readSaved(key, schema, initialData));

    const [currentStep, setCurrentStep] = useState(() =>
        stepSchema.parse(localStorage.getItem(`${key}-step`))
    );

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(data));
    }, [key, data]);

    useEffect(() => {
        localStorage.setItem(`${key}-step`, String(currentStep));
    }, [key, currentStep]);

    const clearProgress = () => {
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}-step`);
        setData(initialData);
        setCurrentStep(0);
    };

    return { data, setData, currentStep, setCurrentStep, clearProgress };
}
```

---

## Command Palette (cmdk)

### shadcn/ui Command
```typescript
import { Home, Moon, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { ROUTES } from '@/constants/routes';
import { useTheme } from '@/hooks/use-theme';

function CommandPalette() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { setTheme } = useTheme();

    // Po wyborze polecenia paleta się zamyka, a fokus wraca do elementu, który ją otworzył (Radix Dialog)
    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    // Ctrl+K / Cmd+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Wpisz polecenie..." />
            <CommandList>
                <CommandEmpty>Brak wyników.</CommandEmpty>
                <CommandGroup heading="Nawigacja">
                    <CommandItem onSelect={() => runCommand(() => void navigate(ROUTES.HOME))}>
                        <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                        Strona główna
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => void navigate(ROUTES.SETTINGS))}>
                        <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                        Ustawienia
                    </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Akcje">
                    <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
                        <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
                        Tryb ciemny
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
```

**Trigger button:**
```typescript
<Button
    variant="outline"
    className="w-64 justify-between text-muted-foreground"
    onClick={() => setOpen(true)}
>
    Szukaj...
    <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs">
        <span className="text-xs">⌘</span>K
    </kbd>
</Button>
```

---

## Drawer (Vaul)

Mobile-first drawer z gesture animations. Zamknięcie przeciągnięciem w dół to skrót — drawer ma też przycisk „Zamknij” i zamyka się Escape, bo gest ze ścieżką potrzebuje alternatywy jednym kliknięciem (accessibility.md, Dragging Movements). Uchwyt do przeciągania renderuje sam `DrawerContent` z shadcn/ui, więc nie dodajesz drugiego.
```typescript
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';

function MobileDrawer() {
    return (
        <Drawer>
            <DrawerTrigger asChild>
                <Button variant="outline" className="min-h-11">Otwórz</Button>
            </DrawerTrigger>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>Opcje</DrawerTitle>
                </DrawerHeader>
                <div className="px-4">
                    {/* Content */}
                </div>
                {/* Dolny odstęp z safe area: pb-safe nadpisałby padding p-4, więc calc łączy oba */}
                <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <DrawerClose asChild>
                        <Button variant="outline" className="min-h-11">Zamknij</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
```

Safe area (`env(safe-area-inset-bottom)`) działa dopiero z `viewport-fit=cover` w meta viewport — konfiguracja i utility `pb-safe` w [responsive-design.md](responsive-design.md) (sekcja Bottom Navigation).

### Responsive Dialog/Drawer
```typescript
// Desktop: Dialog, Mobile: Drawer — każda gałąź z własnym Content, bo DialogContent
// i DrawerContent to różne komponenty i nie da się ich podać jako wspólnych children
import { useMediaQuery } from '@/hooks/use-media-query';

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

interface ResponsiveModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    children: React.ReactNode;
}

function ResponsiveModal({ open, onOpenChange, title, children }: ResponsiveModalProps) {
    const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    {children}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>{title}</DrawerTitle>
                </DrawerHeader>
                <div className="px-4">{children}</div>
                <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <DrawerClose asChild>
                        <Button variant="outline" className="min-h-11">Zamknij</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
```

---

## Zobacz Także

- [component-ux.md](component-ux.md) - Forms, modals, confirmations, `EmptyState`
- [responsive-design.md](responsive-design.md) - Mobile patterns, safe area
- [accessibility.md](accessibility.md) - ARIA dla navigation, rozmiar celu
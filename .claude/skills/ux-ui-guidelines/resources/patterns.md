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
```typescript
import { useSearchParams } from 'react-router';

function UrlTabs() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') ?? 'all';

    return (
        <Tabs 
            value={activeTab} 
            onValueChange={(value) => setSearchParams({ tab: value })}
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
                    <Link 
                        to="/" 
                        className="hover:text-foreground transition-colors"
                        aria-label="Strona główna"
                    >
                        <Home className="h-4 w-4" />
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
                <ChevronLeft className="h-4 w-4" />
            </Button>

            {pages.map((page, index) => (
                page === '...' ? (
                    <span key={index} className="px-2 text-muted-foreground">...</span>
                ) : (
                    <Button
                        key={index}
                        variant={page === currentPage ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => onPageChange(page as number)}
                        aria-current={page === currentPage ? 'page' : undefined}
                    >
                        {page}
                    </Button>
                )
            ))}

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Następna strona"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </nav>
    );
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    
    if (current <= 3) return [1, 2, 3, 4, '...', total];
    if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
    
    return [1, '...', current - 1, current, current + 1, '...', total];
}
```

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
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full"
        >
            {isFetchingNextPage ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

function DataTable<T>({ 
    data, 
    columns 
}: { 
    data: T[]; 
    columns: Column<T>[] 
}) {
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
                    {data.map((row, index) => (
                        <TableRow key={index}>
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
function ResponsiveDataView<T>({ data, columns }: Props<T>) {
    return (
        <>
            {/* Desktop: Table */}
            <div className="hidden md:block">
                <DataTable data={data} columns={columns} />
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden space-y-3">
                {data.map((item, index) => (
                    <Card key={index} className="p-4">
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
```typescript
import { FileQuestion } from 'lucide-react';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

function EmptyState({ 
    icon = <FileQuestion className="h-12 w-12" />,
    title, 
    description, 
    action 
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-muted-foreground mb-4">
                {icon}
            </div>
            <h3 className="text-lg font-semibold mb-1">{title}</h3>
            {description && (
                <p className="text-muted-foreground text-sm max-w-sm mb-4">
                    {description}
                </p>
            )}
            {action}
        </div>
    );
}

// Użycie
<EmptyState
    icon={<Search className="h-12 w-12" />}
    title="Brak wyników"
    description="Spróbuj zmienić filtry lub wyszukaj coś innego."
    action={<Button variant="outline" onClick={clearFilters}>Wyczyść filtry</Button>}
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
```typescript
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

function SearchInput({ value, onChange, placeholder = 'Szukaj...' }: SearchInputProps) {
    const [localValue, setLocalValue] = useState(value);
    
    const debouncedOnChange = useDebouncedCallback((val: string) => {
        onChange(val);
    }, 300);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
        debouncedOnChange(e.target.value);
    };

    const handleClear = () => {
        setLocalValue('');
        onChange('');
    };

    return (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                value={localValue}
                onChange={handleChange}
                placeholder={placeholder}
                className="pl-9 pr-9"
                type="search"
            />
            {localValue && (
                <button
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Wyczyść"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
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
                    <button
                        onClick={() => onRemove(filter.key)}
                        className="ml-1 rounded-full hover:bg-muted p-0.5"
                        aria-label={`Usuń filtr: ${filter.label}`}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            ))}
            
            {filters.length > 1 && (
                <button
                    onClick={onClearAll}
                    className="text-sm text-muted-foreground hover:text-foreground"
                >
                    Wyczyść wszystkie
                </button>
            )}
        </div>
    );
}
```

### Filter Panel (Mobile Drawer)
```typescript
import { Filter } from 'lucide-react';
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
                        <Button variant="outline" className="gap-2">
                            <Filter className="h-4 w-4" />
                            Filtry
                            {activeCount > 0 && (
                                <Badge variant="secondary" className="ml-1">
                                    {activeCount}
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
```typescript
import { useSearchParams } from 'react-router';

interface Filters {
    search: string;
    category: string | null;
    sort: 'newest' | 'popular' | 'name';
}

function useFilters(): [Filters, (updates: Partial<Filters>) => void] {
    const [searchParams, setSearchParams] = useSearchParams();

    const filters: Filters = {
        search: searchParams.get('q') ?? '',
        category: searchParams.get('category'),
        sort: (searchParams.get('sort') as Filters['sort']) ?? 'newest',
    };

    const setFilters = (updates: Partial<Filters>) => {
        const newParams = new URLSearchParams(searchParams);
        
        Object.entries(updates).forEach(([key, value]) => {
            const paramKey = key === 'search' ? 'q' : key;
            if (value === null || value === '') {
                newParams.delete(paramKey);
            } else {
                newParams.set(paramKey, value);
            }
        });
        
        setSearchParams(newParams, { replace: true });
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
                        <li key={step.id} className="flex items-center">
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
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SpotlightProps {
    id: string;
    targetSelector: string;
    title: string;
    description: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
}

function FeatureSpotlight({ id, targetSelector, title, description, placement = 'bottom' }: SpotlightProps) {
    const [show, setShow] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const dismissed = localStorage.getItem(`spotlight-${id}`);
        if (dismissed) return;

        const target = document.querySelector(targetSelector);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        setPosition({
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2,
        });
        setShow(true);
    }, [id, targetSelector]);

    const dismiss = () => {
        localStorage.setItem(`spotlight-${id}`, 'true');
        setShow(false);
    };

    if (!show) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-40" onClick={dismiss} />
            
            {/* Tooltip */}
            <div
                className="fixed z-50 w-72 p-4 bg-card rounded-lg shadow-xl"
                style={{
                    top: position.top,
                    left: position.left,
                    transform: 'translateX(-50%)',
                }}
            >
                <button
                    onClick={dismiss}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                    aria-label="Zamknij"
                >
                    <X className="h-4 w-4" />
                </button>
                
                <h4 className="font-semibold mb-1">{title}</h4>
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
```typescript
function useOnboardingProgress<T>(key: string, initialData: T) {
    const [data, setData] = useState<T>(() => {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : initialData;
    });

    const [currentStep, setCurrentStep] = useState(() => {
        return Number(localStorage.getItem(`${key}-step`)) || 0;
    });

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
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';

function CommandPalette() {
    const [open, setOpen] = useState(false);

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
                    <CommandItem onSelect={() => navigate('/')}>
                        <Home className="mr-2 h-4 w-4" />
                        Strona główna
                    </CommandItem>
                    <CommandItem onSelect={() => navigate('/settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        Ustawienia
                    </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Akcje">
                    <CommandItem onSelect={() => setTheme('dark')}>
                        <Moon className="mr-2 h-4 w-4" />
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

Mobile-first drawer z gesture animations:
```typescript
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';

function MobileDrawer() {
    return (
        <Drawer>
            <DrawerTrigger asChild>
                <Button variant="outline">Otwórz</Button>
            </DrawerTrigger>
            <DrawerContent>
                {/* Drag handle */}
                <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
                <DrawerHeader>
                    <DrawerTitle>Opcje</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 pb-safe">
                    {/* Content */}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
```

### Responsive Dialog/Drawer
```typescript
// Desktop: Dialog, Mobile: Drawer
function ResponsiveModal({ children }: { children: React.ReactNode }) {
    const isDesktop = useMediaQuery('(min-width: 768px)');

    if (isDesktop) {
        return <Dialog>{children}</Dialog>;
    }

    return <Drawer>{children}</Drawer>;
}
```

---

## Zobacz Także

- [component-ux.md](component-ux.md) - Forms, modals, confirmations
- [responsive-design.md](responsive-design.md) - Mobile patterns
- [accessibility.md](accessibility.md) - ARIA dla navigation
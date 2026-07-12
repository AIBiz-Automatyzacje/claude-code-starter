# Optymalizacja Wydajności

Wzorce optymalizacji dla React 19 + Vite SPA - lazy loading, memoizacja, data fetching, Web Vitals.

---

## Zasada: Nie Optymalizuj Przedwcześnie

**Mierz najpierw, optymalizuj potem.**

React jest szybki domyślnie. Większość aplikacji nie potrzebuje agresywnej memoizacji.
```typescript
// NIE - przedwczesna optymalizacja
const value = useMemo(() => a + b, [a, b]);

// TAK - optymalizuj gdy masz problem
// 1. Zmierz (React DevTools Profiler)
// 2. Zidentyfikuj bottleneck
// 3. Zastosuj odpowiednią technikę
```

---

## React Compiler 1.0 (Rekomendowany)

React Compiler 1.0 (stabilny od Paź 2025) automatycznie memoizuje komponenty i wartości. W Vite wymaga setup:
```bash
npm install -D babel-plugin-react-compiler
```
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
    ],
});
```

**Z Compiler 1.0 (rekomendowany setup):**
- `useMemo` / `useCallback` zbędne — Compiler memoizuje automatycznie
- Pisz zwykły kod, bez manualnej memoizacji
- `React.memo()` zbędne — Compiler sam decyduje

**Bez Compiler (legacy setup):**
- Ręczna memoizacja nadal przydatna
- Stosuj zasady z sekcji poniżej

---

## Lazy Loading

Szczegóły implementacji w [component-patterns.md](./component-patterns.md).

### Kiedy Lazy Load

| Lazy Load | Nie Lazy Load |
|-----------|---------------|
| Strony (route-level) | Header, Footer, Navigation |
| Modale, dialogi | Komponenty above-the-fold |
| Ciężkie formularze | Małe, lekkie komponenty |
| Komponenty poniżej fold | Krytyczne UI |
| Rzadko używane features | |
```typescript
// Route-level
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

// Component-level
const HeavyModal = lazy(() => import('./HeavyModal'));

// Z Suspense
<Suspense fallback={<LoadingOverlay />}>
    <SettingsPage />
</Suspense>
```

---

## Memoizacja (bez React Compiler)

Jeśli nie masz włączonego React Compiler, stosuj te zasady:

### useMemo - Drogie Obliczenia
```typescript
// TAK - filtrowanie/sortowanie dużych tablic
const filteredItems = useMemo(() => {
    return items
        .filter(item => item.category === category)
        .sort((a, b) => a.name.localeCompare(b.name));
}, [items, category]);

// NIE - proste obliczenia
const total = useMemo(() => a + b, [a, b]); // Niepotrzebne
```

**Używaj gdy:**
- Filtrowanie/sortowanie >100 elementów
- Złożone transformacje danych
- Obliczenia zajmujące >1ms

### useCallback - Event Handlers
```typescript
// TAK - handler przekazywany do memo() child
const MemoizedList = memo(({ onItemClick }) => ...);

function Parent() {
    const handleClick = useCallback((id: string) => {
        selectItem(id);
    }, []);

    return <MemoizedList onItemClick={handleClick} />;
}

// NIE - handler dla DOM element
function Component() {
    // OK bez useCallback
    return <button onClick={() => doSomething()}>Click</button>;
}
```

**Używaj gdy:**
- Handler przekazywany do `React.memo()` component
- Handler w dependencies `useEffect`/`useMemo`

**NIE używaj gdy:**
- Handler dla DOM elements (`<button>`, `<input>`)
- Komponent child nie jest memoizowany

### React.memo - Komponenty
```typescript
// TAK - element listy renderowany wiele razy
const ListItem = memo<ListItemProps>(({ item, onSelect }) => {
    return <div onClick={() => onSelect(item.id)}>{item.name}</div>;
});

// NIE - komponent renderowany raz lub rzadko
const Header = memo(() => ...); // Prawdopodobnie niepotrzebne
```

---

## Data Fetching

### React Query (Rekomendowane dla SPA)
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetching z automatycznym cache
function TemplateList() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['templates'],
        queryFn: fetchTemplates,
        staleTime: 5 * 60 * 1000, // 5 minut
    });

    if (isLoading) return <Skeleton />;
    if (error) return <ErrorMessage error={error} />;
    
    return <Grid templates={data} />;
}

// Mutacja z invalidacją
function useAddFavorite() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: (templateId: string) => addToFavorites(templateId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['favorites'] });
        },
    });
}
```

**Dlaczego React Query dla SPA:**
- Automatyczny cache i refetch
- Deduplikacja requestów
- Background refresh
- Retry logic
- DevTools

### useSuspenseQuery (Suspense-based)

Alternatywa dla early returns — data jest zawsze zdefiniowane:
```typescript
import { useSuspenseQuery } from '@tanstack/react-query';

function TemplateList() {
    // data jest ZAWSZE zdefiniowane (nigdy undefined)
    const { data } = useSuspenseQuery({
        queryKey: ['templates'],
        queryFn: fetchTemplates,
        staleTime: 5 * 60 * 1000,
    });

    // Nie potrzebujesz: if (isLoading)... if (error)...
    return <Grid templates={data} />;
}

// Parent musi mieć Suspense + ErrorBoundary
<ErrorBoundary FallbackComponent={ErrorFallback}>
    <Suspense fallback={<TemplateListSkeleton />}>
        <TemplateList />
    </Suspense>
</ErrorBoundary>
```

**Kiedy `useSuspenseQuery` vs `useQuery`:**

| `useSuspenseQuery` | `useQuery` |
|---------|---------|
| Data zawsze zdefiniowane | Data może być undefined |
| Suspense + ErrorBoundary obsługują stany | Early returns w komponencie |
| Czystszy kod komponentu | Więcej kontroli nad UI stanami |
| Wymaga parent boundaries | Samodzielny komponent |

### queryOptions Helper

Reużywalne query configs z type-safety:
```typescript
import { queryOptions } from '@tanstack/react-query';

function templateOptions(id: string) {
    return queryOptions({
        queryKey: ['template', id],
        queryFn: () => api.getTemplate(id),
        staleTime: 5 * 60 * 1000,
    });
}

// Reużywalne wszędzie:
useQuery(templateOptions(id));
useSuspenseQuery(templateOptions(id));
queryClient.prefetchQuery(templateOptions(id));
queryClient.setQueryData(templateOptions(id).queryKey, newData);
```

### useOptimistic (React 19)

Natychmiastowa reakcja UI przed odpowiedzią serwera:
```typescript
import { useOptimistic, useTransition } from 'react';

function FavoriteButton({ templateId, isFavorite }: Props) {
    const [isPending, startTransition] = useTransition();
    const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(isFavorite);

    // useOptimistic wołaj wewnątrz transition/action — poza nimi React loguje warning,
    // a optymistyczny stan jest natychmiast cofany (mignięcie UI), zamiast utrzymać się do końca akcji
    const handleToggle = () => {
        startTransition(async () => {
            setOptimisticFavorite(!optimisticFavorite); // Natychmiast

            try {
                await toggleFavorite(templateId); // API call
            } catch {
                // useOptimistic automatycznie przywraca przy błędzie
                toast.error('Nie udało się zaktualizować');
            }
        });
    };

    return (
        <Button variant="ghost" size="icon" onClick={handleToggle} disabled={isPending}>
            <Heart className={cn(
                "h-5 w-5 transition-colors",
                optimisticFavorite 
                    ? "fill-red-500 text-red-500" 
                    : "text-muted-foreground"
            )} />
        </Button>
    );
}
```

**Różnica od manualnego optimistic update:**
- `useOptimistic` automatycznie rollback przy error
- Integruje się z Concurrent React
- Czystszy kod

---

## Debouncing

### useDebounce Hook
```typescript
// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
```

### Użycie
```typescript
function SearchInput() {
    const [input, setInput] = useState('');
    const debouncedSearch = useDebounce(input, 300);

    useEffect(() => {
        if (debouncedSearch) {
            performSearch(debouncedSearch);
        }
    }, [debouncedSearch]);

    return (
        <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Szukaj..."
        />
    );
}
```

---

## useTransition i useDeferredValue

### useTransition - Non-blocking Updates
```typescript
import { useTransition } from 'react';

function FilterableList() {
    const [filter, setFilter] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleFilterChange = (value: string) => {
        // Natychmiastowa aktualizacja inputa
        setFilter(value);
        
        // Ciężka operacja - może być odroczona
        startTransition(() => {
            setFilteredItems(filterLargeList(items, value));
        });
    };

    return (
        <div>
            <Input value={filter} onChange={(e) => handleFilterChange(e.target.value)} />
            <div className={cn(isPending && "opacity-50")}>
                {filteredItems.map(item => <Item key={item.id} item={item} />)}
            </div>
        </div>
    );
}
```

### useDeferredValue - Deferred Rendering
```typescript
import { useDeferredValue, useMemo } from 'react';

function SearchResults({ query }: { query: string }) {
    const deferredQuery = useDeferredValue(query);
    const isStale = query !== deferredQuery;

    const results = useMemo(
        () => filterLargeList(items, deferredQuery),
        [deferredQuery]
    );

    return (
        <div className={cn(isStale && "opacity-50 transition-opacity")}>
            {results.map(item => <Item key={item.id} item={item} />)}
        </div>
    );
}
```

**Różnica:**
- `useTransition` - owijasz setState, kontrolujesz co jest "low priority"
- `useDeferredValue` - owijasz wartość, React decyduje kiedy zaktualizować

---

## Virtualization (Duże Listy)

Dla list >100 elementów:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }: { items: Item[] }) {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50,
    });

    return (
        <div ref={parentRef} className="h-[400px] overflow-auto">
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                        key={virtualItem.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualItem.start}px)`,
                        }}
                    >
                        <Item item={items[virtualItem.index]} />
                    </div>
                ))}
            </div>
        </div>
    );
}
```

---

## Memory Leaks Prevention

### Cleanup w useEffect
```typescript
useEffect(() => {
    const subscription = channel.subscribe();
    const timer = setInterval(() => {}, 1000);

    return () => {
        subscription.unsubscribe();
        clearInterval(timer);
    };
}, []);
```

### AbortController dla Fetch
```typescript
useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
        try {
            const res = await fetch('/api/data', { signal: controller.signal });
            const data = await res.json();
            setData(data);
        } catch (error) {
            if (error.name !== 'AbortError') {
                logger.error('Fetch error', error);
            }
        }
    }

    fetchData();
    return () => controller.abort();
}, []);
```

---

## Web Vitals

| Metryka | Cel | Co mierzy |
|---------|-----|-----------|
| **LCP** | <2.5s | Czas ładowania głównej treści |
| **INP** | <200ms | Responsywność na interakcje |
| **CLS** | <0.1 | Stabilność layoutu |

### Pomiar
```typescript
import { onLCP, onINP, onCLS } from 'web-vitals';

onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

### Optymalizacje

**LCP:**
- Lazy load poniżej fold
- Preload krytycznych zasobów
- Optymalizuj obrazy (AVIF/WebP)
- `<link rel="preload">` dla hero image

**INP:**
- `useTransition` dla ciężkich operacji
- Unikaj długich tasków JS (>50ms)
- Debounce inputs

**CLS:**
- Zawsze podawaj wymiary obrazów (`width`, `height`)
- Skeleton placeholders
- Suspense zamiast conditional rendering

---

## Optymalizacja Obrazów

### Formaty (priorytet)

1. **AVIF** - najlepsza kompresja, szeroko wspierane (2026)
2. **WebP** - fallback
3. **JPEG/PNG** - legacy fallback

### Implementacja
```typescript
// Komponent z srcSet
function OptimizedImage({ src, alt }: { src: string; alt: string }) {
    return (
        <picture>
            <source srcSet={`${src}.avif`} type="image/avif" />
            <source srcSet={`${src}.webp`} type="image/webp" />
            <img 
                src={`${src}.jpg`} 
                alt={alt}
                loading="lazy"
                decoding="async"
                width={800}
                height={600}
            />
        </picture>
    );
}
```

### Lazy Loading
```typescript
// Native lazy loading
<img src="image.jpg" loading="lazy" />

// Intersection Observer dla więcej kontroli
const { ref, inView } = useInView({ triggerOnce: true });

<div ref={ref}>
    {inView && <img src="heavy-image.jpg" />}
</div>
```

---

## Third-Party Scripts

Ładuj skrypty analityczne bez blokowania:
```typescript
// Lazy load po interakcji
useEffect(() => {
    const loadAnalytics = () => {
        const script = document.createElement('script');
        script.src = 'https://analytics.example.com/script.js';
        script.async = true;
        document.body.appendChild(script);
    };

    // Ładuj po pierwszej interakcji
    window.addEventListener('click', loadAnalytics, { once: true });
    window.addEventListener('scroll', loadAnalytics, { once: true });
    
    // Lub po idle
    if ('requestIdleCallback' in window) {
        requestIdleCallback(loadAnalytics);
    } else {
        setTimeout(loadAnalytics, 2000);
    }
}, []);
```

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Lazy loading, Suspense
- [loading-and-error-states.md](./loading-and-error-states.md) - Loading states
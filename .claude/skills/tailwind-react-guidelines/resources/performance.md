# Optymalizacja Wydajności

Wzorce optymalizacji dla React 19 + Vite SPA - lazy loading, memoizacja, data fetching, Web Vitals.

---

## Zasada: Nie Optymalizuj Przedwcześnie

**Mierz najpierw, optymalizuj potem.**

React jest szybki domyślnie. Większość aplikacji nie potrzebuje agresywnej memoizacji.
```typescript
// Nie - przedwczesna optymalizacja
const value = useMemo(() => a + b, [a, b]);

// TAK - optymalizuj gdy masz problem
// 1. Zmierz (React DevTools Profiler)
// 2. Zidentyfikuj bottleneck
// 3. Zastosuj odpowiednią technikę
```

---

## React Compiler

React Compiler automatycznie memoizuje komponenty i wartości. Czy projekt go ma, sprawdzasz w package.json (`babel-plugin-react-compiler`) i w konfiguracji Vite — nie zakładasz, że jest włączony. Dodanie Compilera to nowa zależność: zgłaszasz ją (w workflowie: w odchyleniach) i instalujesz menedżerem z lockfile projektu z dokładną wersją, np.:
```bash
pnpm add -D -E babel-plugin-react-compiler @rolldown/plugin-babel
```
```typescript
// vite.config.ts
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] }),
    ],
});
```

**Wymagania:** wersje Vite, `@vitejs/plugin-react` i `babel-plugin-react-compiler` wg package.json
(`babel-plugin-react-compiler` to opcjonalny peer `@vitejs/plugin-react`).
Opcja `react({ babel: { plugins: [...] } })` istnieje tylko w `@vitejs/plugin-react` < 6 — od 6.0.0
(Vite 8 + Oxc) plugin nie używa Babela i opcja `babel` została usunięta; Compiler włącza się wtedy przez
`@rolldown/plugin-babel` + `reactCompilerPreset`. Przy starszym `@vitejs/plugin-react` konfiguracja jest inna — sprawdzasz
ją w CHANGELOG `@vitejs/plugin-react` i na https://react.dev/learn/react-compiler/installation.
Przy podbiciu wersji sprawdzasz, czy `reactCompilerPreset` jest nadal eksportowany z `@vitejs/plugin-react`
i czy `@rolldown/plugin-babel` nie został wchłonięty do core Vite.

**Projekt z React Compilerem (`babel-plugin-react-compiler` w package.json):**
- Bez ręcznych `useMemo` / `useCallback` — Compiler memoizuje automatycznie
- Bez `React.memo()` — Compiler sam decyduje, co memoizować
- Wyjątek: stabilna zależność efektu. Gdy funkcja albo obiekt trafia do tablicy zależności `useEffect` i bez stabilnej referencji efekt uruchamiałby się przy każdym renderze, `useCallback` / `useMemo` zostaje (reguły kodu, sekcja Async i React)

**Projekt bez React Compilera:**
- Ręczna memoizacja według zasad z sekcji niżej — po pomiarze, nie na zapas

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
| Komponent większy niż 50 KB (z zależnościami) | |

Komponent większy niż 50 KB ładujesz dynamicznie (reguły kodu, sekcja Performance); rozmiar sprawdzasz w raporcie builda, nie na oko.
```typescript
// Route-level — strona ładowana przez lazy() ma default export
const SettingsPage = lazy(() => import('@/pages/settings-page'));

// Component-level — komponent ma named export, więc mapujesz go na default
const HeavyModal = lazy(() =>
    import('./heavy-modal').then((module) => ({ default: module.HeavyModal }))
);

// Z Suspense
<Suspense fallback={<LoadingOverlay />}>
    <SettingsPage />
</Suspense>
```

---

## Memoizacja — projekt bez React Compilera

Przykłady w tej sekcji dotyczą projektu bez React Compilera (brak `babel-plugin-react-compiler` w package.json). Z Compilerem ręcznej memoizacji nie dodajesz, poza stabilną zależnością efektu. Każdą memoizację poprzedza pomiar (React DevTools Profiler).

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
- Obliczenia, którym pomiar dał >1ms

### useCallback - Event Handlers
```typescript
// TAK - handler przekazywany do memo() child (projekt bez React Compilera)
interface MemoizedListProps {
    items: Item[];
    onItemClick: (id: string) => void;
}

const MemoizedList = memo(function MemoizedList({ items, onItemClick }: MemoizedListProps) {
    return (
        <ul>
            {items.map((item) => (
                <li key={item.id}>
                    <button type="button" onClick={() => onItemClick(item.id)}>{item.name}</button>
                </li>
            ))}
        </ul>
    );
});

function Parent({ items }: { items: Item[] }) {
    const handleClick = useCallback((id: string) => {
        selectItem(id);
    }, []);

    return <MemoizedList items={items} onItemClick={handleClick} />;
}

// NIE - handler dla DOM element
function Component() {
    // OK bez useCallback
    return <button onClick={() => doSomething()}>Click</button>;
}
```

**Używaj gdy:**
- Handler przekazywany do `React.memo()` component
- Handler w dependencies `useEffect`/`useMemo` (ten przypadek zostaje także z React Compilerem)

**Nie używaj gdy:**
- Handler dla DOM elements (`<button>`, `<input>`)
- Komponent child nie jest memoizowany

### React.memo - Komponenty
```typescript
// TAK - element listy renderowany wiele razy (projekt bez React Compilera, po pomiarze)
interface ListItemProps {
    item: Item;
    onSelect: (id: string) => void;
}

const ListItem = memo(function ListItem({ item, onSelect }: ListItemProps) {
    return (
        <button type="button" onClick={() => onSelect(item.id)}>
            {item.name}
        </button>
    );
});

// NIE - komponent renderowany raz lub rzadko
const Header = memo(() => ...); // Prawdopodobnie niepotrzebne
```

---

## Data Fetching

### React Query (Rekomendowane dla SPA)

Warstwy z reguł kodu: komponent → hook → serwis → klient. Komponent woła hook z `src/hooks/`, hook owija `useQuery` / `useMutation` i woła serwis z `src/services/`, a serwis — wspólny klient z limitem czasu i walidacją Zod ([file-organization.md](./file-organization.md)). Klucze zapytań pochodzą z jednej fabryki, żeby invalidacja trafiała w te same klucze, które zapisało pobieranie.

Ten plik jest miejscem definicji zapytań szablonów w module `src/hooks/use-templates.ts`: `templateKeys`, `TEMPLATES_STALE_TIME_MS`, `templateListOptions(filters)`, `useTemplates(filters = {})`, `useSuspenseTemplates(filters = {})` i `useTemplate(id)`. Ten sam moduł dostaje mutacje `useCreateTemplate` i `useUpdateTemplate` z [forms.md](./forms.md#integracja-z-react-query) oraz `useDeleteTemplate` z [loading-and-error-states.md](./loading-and-error-states.md#hook-danych-i-fabryka-kluczy); `useToggleFavorite` ma własny plik `src/hooks/use-toggle-favorite.ts` (loading-and-error-states.md, sekcja Optimistic Updates). Inne pliki importują te hooki, zamiast definiować je od nowa.
```typescript
// src/hooks/use-templates.ts — fabryka kluczy na początku pliku hooków szablonów
import type { TemplateFilters } from '@/services/template-service';

export const templateKeys = {
    all: ['templates'] as const,
    list: (filters: TemplateFilters) => [...templateKeys.all, 'list', filters] as const,
    detail: (id: string) => [...templateKeys.all, 'detail', id] as const,
};
```
```typescript
// src/hooks/use-templates.ts — ciąg dalszy
import { queryOptions, useQuery } from '@tanstack/react-query';

import { templateService, type TemplateFilters } from '@/services/template-service';

export const TEMPLATES_STALE_TIME_MS = 5 * 60 * 1000; // 5 minut

// Jedna konfiguracja zapytania dla wariantu zwykłego i Suspense (queryOptions — sekcja niżej).
// signal przerywa żądanie przy odmontowaniu albo zmianie klucza.
export function templateListOptions(filters: TemplateFilters) {
    return queryOptions({
        queryKey: templateKeys.list(filters),
        queryFn: ({ signal }) => templateService.list(filters, signal),
        staleTime: TEMPLATES_STALE_TIME_MS,
    });
}

// Pobieranie z automatycznym cache; bez argumentu — lista bez filtrów
export function useTemplates(filters: TemplateFilters = {}) {
    return useQuery(templateListOptions(filters));
}
```

Mutację ulubionych z invalidacją (`useToggleFavorite`) definiuje [loading-and-error-states.md](./loading-and-error-states.md#useoptimistic---natywny-hook) w `src/hooks/use-toggle-favorite.ts`: `onError` loguje `FAVORITE_TOGGLE_FAILED` i pokazuje toast, a `onSettled` zwraca promise invalidacji `templateKeys.all`, więc `mutateAsync` kończy się dopiero po odświeżeniu danych.
```typescript
// src/components/template-list.tsx
import { EmptyState } from '@/components/empty-state';
import { ErrorMessage } from '@/components/error-message';
import { Grid } from '@/components/grid';
import { Skeleton } from '@/components/ui/skeleton';
import { useTemplates } from '@/hooks/use-templates';

export function TemplateList() {
    const { data, isPending, error } = useTemplates();

    // Kolejność gałęzi: ładowanie → błąd → pusto → dane
    if (isPending) return <Skeleton />;
    if (error) return <ErrorMessage error={error} />;
    if (data.length === 0) return <EmptyState title="Brak szablonów" />;

    return <Grid templates={data} />;
}
```

`isPending` zamiast `isLoading`: po wykluczeniu `isPending` i `error` TypeScript zawęża `data` do zdefiniowanej tablicy, więc gałąź danych nie potrzebuje `data?.` ani `!`.

**Dlaczego React Query dla SPA:**
- Automatyczny cache i refetch
- Deduplikacja requestów
- Background refresh
- Retry logic
- DevTools

### useSuspenseQuery (Suspense-based)

Dane pod granicą Suspense pobierasz przez `useSuspenseQuery` (SKILL.md, zasada 4), a nie przez `useQuery` z ręcznym stanem ładowania — inaczej ładowanie obsługują dwa miejsca. Wybór między wariantami opisuje tabela niżej; data jest zawsze zdefiniowane:
```typescript
// src/hooks/use-templates.ts (cd.) — ta sama konfiguracja co useTemplates
import { useSuspenseQuery } from '@tanstack/react-query';

export function useSuspenseTemplates(filters: TemplateFilters = {}) {
    return useSuspenseQuery(templateListOptions(filters));
}
```
```typescript
// src/components/template-list.tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { EmptyState } from '@/components/empty-state';
import { ErrorFallback } from '@/components/error-fallback';
import { Grid } from '@/components/grid';
import { TemplateListSkeleton } from '@/components/template-list-skeleton';
import { useSuspenseTemplates } from '@/hooks/use-templates';
import { logger } from '@/lib/logger';

export function TemplateList() {
    // data jest zawsze zdefiniowane (nigdy undefined)
    const { data } = useSuspenseTemplates();

    // Nie potrzebujesz: if (isPending)... if (error)... — obsługują je Suspense i ErrorBoundary
    if (data.length === 0) return <EmptyState title="Brak szablonów" />;

    return <Grid templates={data} />;
}

// Parent musi mieć Suspense + ErrorBoundary; reset z QueryErrorResetBoundary ponawia zapytanie
// (układ granic i ErrorFallback: component-patterns.md, sekcja Error Boundaries)
<QueryErrorResetBoundary>
    {({ reset }) => (
        <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onError={(error) => logger.error('UI_BOUNDARY', error)}
            onReset={reset}
        >
            <Suspense fallback={<TemplateListSkeleton />}>
                <TemplateList />
            </Suspense>
        </ErrorBoundary>
    )}
</QueryErrorResetBoundary>
```

**Kiedy `useSuspenseQuery` vs `useQuery`:**

| `useSuspenseQuery` | `useQuery` |
|---------|---------|
| Data zawsze zdefiniowane | Data może być undefined |
| Suspense + ErrorBoundary obsługują stany | Early returns w komponencie |
| Czystszy kod komponentu | Więcej kontroli nad UI stanami |
| Wymaga parent boundaries | Samodzielny komponent |

### queryOptions Helper

Konfiguracja zapytania używana w kilku miejscach (wariant zwykły, Suspense, prefetch, zapis do cache) ma jedno źródło z typem danych przypiętym do klucza — kopie klucza, `queryFn` i `staleTime` rozjeżdżają się po cichu. Funkcja z `queryOptions` zostaje w module hooków (jak `templateListOptions` wyżej), a reszta aplikacji korzysta z hooków. Szczegóły szablonu stoją w tym samym pliku co lista (`use-templates.ts`), więc `templateKeys` i `TEMPLATES_STALE_TIME_MS` są w zasięgu bez importu, a komponent importuje `useTemplate` z `@/hooks/use-templates`:
```typescript
// src/hooks/use-templates.ts (cd.) — szczegóły szablonu
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';

import type { Template } from '@/schemas/template';
import { templateService } from '@/services/template-service';

function templateDetailOptions(id: string) {
    return queryOptions({
        queryKey: templateKeys.detail(id),
        queryFn: ({ signal }) => templateService.get(id, signal),
        staleTime: TEMPLATES_STALE_TIME_MS,
    });
}

export function useTemplate(id: string) {
    return useQuery(templateDetailOptions(id));
}

export function useSuspenseTemplate(id: string) {
    return useSuspenseQuery(templateDetailOptions(id));
}

// Prefetch przy najechaniu na kartę i zapis po edycji — ten sam klucz z typem danych
export function useTemplateCache(): {
    prefetch: (id: string) => Promise<void>;
    write: (template: Template) => void;
} {
    const queryClient = useQueryClient();

    return {
        prefetch: (id) => queryClient.prefetchQuery(templateDetailOptions(id)),
        write: (template) => {
            queryClient.setQueryData(templateDetailOptions(template.id).queryKey, template);
        },
    };
}
```

### useOptimistic (React 19)

Natychmiastowa reakcja UI przed odpowiedzią serwera. Wzorcem jest `FavoriteButton` (`src/components/favorite-button.tsx`) z hookiem `useToggleFavorite` (`src/hooks/use-toggle-favorite.ts`), zdefiniowany raz w [loading-and-error-states.md](./loading-and-error-states.md#useoptimistic---natywny-hook) — log z kodem błędu, toast i invalidacja są w hooku, więc komponent zawiera tylko stan optymistyczny. Tu go importujesz:
```typescript
import { FavoriteButton } from '@/components/favorite-button';

<FavoriteButton templateId={template.id} isFavorite={template.isFavorite} />
```

Mechanizm, który czyni ten przycisk wydajnym (fragment komponentu z loading-and-error-states.md):
- `setOptimisticFavorite(!optimisticFavorite)` stoi wewnątrz `startTransition(async () => { ... })` — poza transition albo akcją React loguje ostrzeżenie, a stan optymistyczny jest natychmiast cofany (mignięcie UI), zamiast utrzymać się do końca akcji;
- `await toggleFavorite.mutateAsync()` kończy się po `onSettled` hooka, czyli po odświeżeniu `isFavorite` z serwera;
- `catch` zatrzymuje odrzucenie (inaczej trafiłoby do Error Boundary) i zostawia ślad wycofania `logger.info('FAVORITE_OPTIMISTIC_ROLLBACK', { templateId, error })`; przyczynę z kodem `FAVORITE_TOGGLE_FAILED` zalogował już `onError` hooka.

**Jak działa powrót do źródła prawdy:**
- `useOptimistic` pokazuje wartość optymistyczną tylko do końca transition; potem komponent wraca do `isFavorite` z propsów. Bez odświeżenia źródła prawdy UI po sukcesie wróciłoby do starej wartości.
- Dlatego `onSettled` w hooku zwraca promise invalidacji: `mutateAsync` kończy się dopiero po refetchu, a transition kończy się z nowym `isFavorite`.
- Przy błędzie refetch przywraca prawdziwą wartość z serwera — to nie automatyczny rollback `useOptimistic`, tylko koniec transition plus świeże dane.

**Różnica od manualnego optimistic update (`onMutate` + `setQueryData` + przywracanie kontekstu w `onError`):**
- Stan optymistyczny żyje tylko w komponencie, cache zapytania się nie zmienia
- Integruje się z Concurrent React (`isPending` z transition)
- Mniej kodu: brak ręcznego zapisu i przywracania cache

---

## Debouncing

### useDebounce Hook
```typescript
// hooks/use-debounce.ts
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

Wyszukiwanie po debounce idzie przez TanStack Query, nie przez `useEffect`: zapytanie z kluczem frazy dostaje `signal`, więc odpowiedź na starą frazę nie nadpisze nowszej, a wynik trafia do cache.
```typescript
// src/hooks/use-templates.ts (cd.) — ta sama konfiguracja listy, z frazą w filtrach
export function useTemplateSearch(search: string) {
    return useQuery({
        ...templateListOptions({ search }),
        enabled: search !== '',
    });
}
```
```typescript
// src/components/search-input.tsx
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { useTemplateSearch } from '@/hooks/use-templates';

const SEARCH_DEBOUNCE_MS = 300;

export function SearchInput() {
    const [input, setInput] = useState('');
    const debouncedSearch = useDebounce(input, SEARCH_DEBOUNCE_MS);
    const { data: results } = useTemplateSearch(debouncedSearch);

    return (
        <div>
            <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Szukaj..."
                aria-label="Szukaj szablonów"
            />
            <ul>
                {results?.map((template) => <li key={template.id}>{template.name}</li>)}
            </ul>
        </div>
    );
}
```

---

## useTransition i useDeferredValue

### useTransition - Non-blocking Updates
```typescript
import { useState, useTransition } from 'react';

function FilterableList({ items }: { items: Item[] }) {
    const [filter, setFilter] = useState('');
    const [appliedFilter, setAppliedFilter] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleFilterChange = (value: string) => {
        // Natychmiastowa aktualizacja inputa
        setFilter(value);

        // Ciężki render listy - może być odroczony
        startTransition(() => {
            setAppliedFilter(value);
        });
    };

    // Lista liczona z propsów i zastosowanego filtra, bez kopii items w stanie
    const filteredItems = filterLargeList(items, appliedFilter);

    return (
        <div>
            <Input
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value)}
                aria-label="Filtruj listę"
            />
            <div className={cn(isPending && "opacity-50")}>
                {filteredItems.map(item => <ItemRow key={item.id} item={item} />)}
            </div>
        </div>
    );
}
```

### useDeferredValue - Deferred Rendering
```typescript
import { useDeferredValue } from 'react';

function SearchResults({ query, items }: { query: string; items: Item[] }) {
    const deferredQuery = useDeferredValue(query);
    const isStale = query !== deferredQuery;

    // Render z nową frazą (pilny) używa starego deferredQuery, więc kosztowne filtrowanie
    // musi być zapamiętane, żeby się nie powtarzało. Z React Compilerem robi to Compiler.
    // Projekt bez React Compilera: useMemo(() => filterLargeList(items, deferredQuery), [items, deferredQuery]).
    const results = filterLargeList(items, deferredQuery);

    return (
        <div className={cn(isStale && "opacity-50 transition-opacity")}>
            {results.map(item => <ItemRow key={item.id} item={item} />)}
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
import { useRef } from 'react';

const ROW_HEIGHT_PX = 50; // szacowana wysokość wiersza listy

function VirtualList({ items }: { items: Item[] }) {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT_PX,
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
                        <ItemRow item={items[virtualItem.index]} />
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
const CLOCK_TICK_MS = 1000;

useEffect(() => {
    const subscription = channel.subscribe();
    const timer = setInterval(refreshClock, CLOCK_TICK_MS);

    return () => {
        subscription.unsubscribe();
        clearInterval(timer);
    };
}, []);
```

### Żądanie Sieciowe bez Wycieku Wyniku

Dane z serwera pobierasz przez TanStack Query — `queryFn` dostaje `signal`, a biblioteka przerywa żądanie i odrzuca wynik, gdy komponent się odmontuje albo zmieni się klucz:
```typescript
// src/hooks/use-dashboard-summary.ts; dashboardKeys — fabryka kluczy jak templateKeys
export function useDashboardSummary() {
    return useQuery({
        queryKey: dashboardKeys.summary,
        queryFn: ({ signal }) => dashboardService.getSummary(signal),
    });
}
```

Efekt z żądaniem zostaje tylko tam, gdzie projekt nie ma TanStack Query. Wtedy limit czasu daje `AbortSignal.timeout`, a cleanup ustawia flagę `ignore` zamiast przerywać żądanie drugim sygnałem — wynik po odmontowaniu albo zmianie parametrów jest odrzucany. Limit czasu, kopertę `{ data, error }`, parsowanie Zod i `ApiError` ma wspólny `request()` z [file-organization.md](./file-organization.md), więc efekt dokłada tylko flagę.
```typescript
type DashboardState =
    | { status: 'loading' }
    | { status: 'success'; summary: DashboardSummary }
    | { status: 'error' };

const [state, setState] = useState<DashboardState>({ status: 'loading' });

useEffect(() => {
    let ignore = false;

    // request(): AbortSignal.timeout(REQUEST_TIMEOUT_MS) + walidacja odpowiedzi schematem
    void request('/dashboard', dashboardSummarySchema)
        .then((summary) => {
            if (!ignore) setState({ status: 'success', summary });
        })
        .catch((error: unknown) => {
            logger.error('DASHBOARD_FETCH_FAILED', error);
            if (!ignore) setState({ status: 'error' });
        });

    return () => {
        ignore = true;
    };
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
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

import { logger } from '@/lib/logger';

// Pomiar idzie przez logger (skill sentry-integration) ze stałym kodem, nie do konsoli
function reportWebVital(metric: Metric): void {
    logger.info('WEB_VITAL', { name: metric.name, value: metric.value, rating: metric.rating });
}

onLCP(reportWebVital);
onINP(reportWebVital);
onCLS(reportWebVital);
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

1. **AVIF** - najlepsza kompresja, szeroko wspierane
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
// Native lazy loading — z wymiarami (CLS) i tekstem alternatywnym
<img src="image.jpg" alt="Podgląd szablonu" width={800} height={600} loading="lazy" />

// Intersection Observer dla więcej kontroli (react-intersection-observer — sprawdź package.json,
// nową zależność zgłaszasz; natywny loading="lazy" zwykle wystarcza)
const { ref, inView } = useInView({ triggerOnce: true });

<div ref={ref}>
    {inView && <img src="heavy-image.jpg" alt="Wykres sprzedaży" width={1200} height={800} />}
</div>
```

---

## Third-Party Scripts

Ładuj skrypty analityczne bez blokowania. Trzy wyzwalacze (kliknięcie, przewinięcie, bezczynność) ładują skrypt raz — pilnuje tego flaga — a cleanup zdejmuje listenery i anuluje oczekujący callback, żeby po odmontowaniu nic nie dołożyło skryptu:
```typescript
const ANALYTICS_FALLBACK_DELAY_MS = 2000; // gdy przeglądarka nie ma requestIdleCallback

// Lazy load po interakcji albo w bezczynności
useEffect(() => {
    let isLoaded = false;
    let idleCallbackId: number | undefined;
    let timeoutId: number | undefined;

    const removeInteractionListeners = (): void => {
        window.removeEventListener('click', loadAnalytics);
        window.removeEventListener('scroll', loadAnalytics);
    };

    function loadAnalytics(): void {
        if (isLoaded) return;
        isLoaded = true;
        removeInteractionListeners();

        const script = document.createElement('script');
        script.src = 'https://analytics.example.com/script.js';
        script.async = true;
        document.body.appendChild(script);
    }

    // Ładuj po pierwszej interakcji
    window.addEventListener('click', loadAnalytics, { once: true });
    window.addEventListener('scroll', loadAnalytics, { once: true, passive: true });

    // Lub po idle
    if (typeof window.requestIdleCallback === 'function') {
        idleCallbackId = window.requestIdleCallback(loadAnalytics);
    } else {
        timeoutId = window.setTimeout(loadAnalytics, ANALYTICS_FALLBACK_DELAY_MS);
    }

    return () => {
        removeInteractionListeners();
        if (idleCallbackId !== undefined) window.cancelIdleCallback(idleCallbackId);
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
}, []);
```

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Lazy loading, Suspense
- [loading-and-error-states.md](./loading-and-error-states.md) - Loading states
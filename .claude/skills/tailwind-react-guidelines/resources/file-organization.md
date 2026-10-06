# Organizacja Plików

Struktura katalogów dla Vite + React SPA.

---

## Struktura Projektu
```
src/
├── main.tsx                # Punkt wejścia
├── app.tsx                 # Router + providers
├── components/             # Komponenty React
│   ├── ui/                # Prymitywy UI (shadcn/ui)
│   └── [feature-name].tsx # Komponenty aplikacji
├── pages/                  # Komponenty stron (route-level)
├── contexts/               # Konteksty React (np. AuthProvider)
├── hooks/                  # Custom hooks (useQuery/useMutation owinięte w hook)
├── services/               # Serwisy: wywołania API i Supabase dla hooków
├── lib/                    # Utilities i klienty (request, supabase, logger, env, errors)
├── schemas/                # Schematy Zod kontraktów i typy z nich (z.infer)
├── types/                  # Typy bez schematu (np. wygenerowane typy bazy)
├── constants/              # Stałe i konfiguracja
└── test/                   # Setup, utils, mocks (MSW)
```

Warstwy idą według sekcji Architektura reguł kodu: strona → komponent → hook (`hooks/use-items.ts`) → serwis (`services/item-service.ts`) → klient (`lib/api.ts`, `lib/supabase.ts`). Kontrakt danych (schemat Zod i typ z niego) leży w `schemas/` (`schemas/item-schema.ts`), bo korzystają z niego serwis, hook, formularz i fixture'y testów; `types/` trzyma tylko typy, które nie mają schematu. Komponent nie woła serwisu, `fetch` ani `supabase` sam — dostaje dane i mutacje z hooka, dzięki czemu cache, obsługa błędu i limit czasu stoją w jednym miejscu. Fixture'y testów jednostkowych leżą w `tests/fixtures/` w korzeniu repo (sekcja Testowanie reguł kodu).

---

## Alternatywa: Feature-Sliced Design (FSD)

Dla większych projektów enterprise - rygorystyczny podział na warstwy:
```
src/
├── app/                    # Init, providers, router
│   ├── providers.tsx
│   └── router.tsx
├── pages/                  # Kompozycja widoków (route-level)
│   ├── home/
│   └── settings/
├── features/               # Funkcjonalności biznesowe
│   ├── auth/
│   │   ├── ui/
│   │   ├── model/
│   │   └── api/
│   └── templates/
├── entities/               # Modele biznesowe
│   ├── user/
│   └── template/
├── shared/                 # UI kit, api client, utils
│   ├── ui/
│   ├── api/
│   └── lib/
└── types/
```

W FSD warstwę serwisu pełnią `features/*/api` i `shared/api`; hook z `features/*/model` woła je, a `ui/` dostaje dane z hooka.

**Kiedy FSD:**
- Projekt >50 komponentów
- Większy zespół (>3 devów)
- Wyraźne domeny biznesowe
- Long-term maintenance

**Kiedy flat structure:**
- Mniejsze projekty
- MVP / prototypy
- Solo developer

---

## Katalog components/

### ui/ - shadcn/ui
```
components/ui/
├── button.tsx
├── card.tsx
├── dialog.tsx
└── ...
```

**Zasady:**
- Nie modyfikuj bezpośrednio - używaj `className`
- Nazwy w kebab-case jak w całym projekcie (CLI shadcn generuje je tak samo: `dropdown-menu.tsx`)

### Komponenty Aplikacji
```
components/
├── header.tsx
├── footer.tsx
├── sidebar.tsx
└── [feature]-card.tsx
```

---

## Katalog pages/

Komponenty na poziomie route - lazy-loaded:
```
pages/
├── home-page.tsx
├── settings-page.tsx
├── profile-page.tsx
└── not-found-page.tsx
```
```typescript
// app.tsx
const HomePage = lazy(() => import('@/pages/home-page'));
const SettingsPage = lazy(() => import('@/pages/settings-page'));

<Routes>
    <Route path={ROUTES.HOME} element={
        <Suspense fallback={<LoadingOverlay />}>
            <HomePage />
        </Suspense>
    } />
</Routes>
```

Strona ładowana przez `lazy()` ma default export (`export default function HomePage()`), bo `lazy` oczekuje modułu z `default`. Strona importowana wprost (np. `NotFoundPage`), komponenty i hooki mają named export.

---

## Routing (React Router v8)

Wersja wg package.json. v8 podnosi minima do Node 22.22+ i React 19.2.7+ oraz wprowadza breaking changes:
pakiet `react-router-dom` został całkowicie usunięty — importuj z `react-router`, a komponenty DOM
(`RouterProvider`, `HydratedRouter`) z `react-router/dom`; middleware zawsze włączone (`context` w loader/action
= `RouterContextProvider`); pakiet ESM-only; usunięte `hasErrorBoundary`; flagi `future.v8_*` stały się domyślne.
(Źródło: CHANGELOG `packages/react-router` w repo remix-run/react-router, sekcja 8.0.0 — sprawdź przy podbiciu majora.)

### Konfiguracja w app.tsx
```typescript
// app.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';

import { Layout } from '@/components/layout';
import { LoadingOverlay } from '@/components/loading-overlay';
import { ProtectedRoute } from '@/components/protected-route';
import { ROUTES } from '@/constants/routes';
import { AuthProvider } from '@/contexts/auth-context';
import { queryClient } from '@/lib/query-client';
import { NotFoundPage } from '@/pages/not-found-page';

// Lazy load pages (każda strona ma default export)
const HomePage = lazy(() => import('@/pages/home-page'));
const ItemsPage = lazy(() => import('@/pages/items-page'));
const ItemPage = lazy(() => import('@/pages/item-page'));
const SettingsPage = lazy(() => import('@/pages/settings-page'));
const LoginPage = lazy(() => import('@/pages/login-page'));

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AuthProvider>
                    <Routes>
                        {/* Public routes */}
                        <Route path={ROUTES.LOGIN} element={
                            <Suspense fallback={<LoadingOverlay />}>
                                <LoginPage />
                            </Suspense>
                        } />

                        {/* Protected routes z Layout */}
                        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                            <Route index element={
                                <Suspense fallback={<LoadingOverlay />}>
                                    <HomePage />
                                </Suspense>
                            } />
                            <Route path={ROUTES.ITEMS} element={
                                <Suspense fallback={<LoadingOverlay />}>
                                    <ItemsPage />
                                </Suspense>
                            } />
                            <Route path={ROUTES.ITEM} element={
                                <Suspense fallback={<LoadingOverlay />}>
                                    <ItemPage />
                                </Suspense>
                            } />
                            <Route path={ROUTES.SETTINGS} element={
                                <Suspense fallback={<LoadingOverlay />}>
                                    <SettingsPage />
                                </Suspense>
                            } />
                        </Route>

                        {/* 404 */}
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                    <Toaster position="bottom-right" richColors />
                </AuthProvider>
            </BrowserRouter>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
```

`QueryClientProvider`, `Toaster` i `ReactQueryDevtools` stoją w drzewie raz, tutaj; `main.tsx` renderuje samo `<App />` (sekcja Setup React Query).

### Protected Route
```typescript
// components/protected-route.tsx
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { LoadingOverlay } from '@/components/loading-overlay';
import { ROUTES } from '@/constants/routes';
import { useAuth, type AppRole } from '@/hooks/use-auth';

interface ProtectedRouteProps {
    children?: ReactNode;
    requiredRole?: AppRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const auth = useAuth();
    const location = useLocation();

    switch (auth.status) {
        case 'loading':
            return <LoadingOverlay />;
        case 'anonymous':
            // Zapisz, dokąd użytkownik chciał wejść (sama ścieżka; LoginForm parsuje ją schematem)
            return <Navigate to={ROUTES.LOGIN} state={{ from: location.pathname }} replace />;
        case 'authenticated':
            if (requiredRole && auth.role !== requiredRole) {
                return <Navigate to={ROUTES.HOME} replace />;
            }
            return children ?? <Outlet />;
    }
}
```

Stan uwierzytelnienia to unia dyskryminowana, nie zestaw flag (`isLoading`, `isAuthenticated`), bo flagi dopuszczają sprzeczne kombinacje (zalogowany i ładujący naraz), a `switch` po `status` daje `role` tylko w gałęzi `authenticated`. Źródło roli opisuje sekcja Bezpieczeństwo reguł kodu: `AuthProvider` czyta ją z claimu dodanego przez Custom Access Token Hook albo z `app_metadata` ustawianego po stronie serwera, nie z `user_metadata` (użytkownik zmienia je przez `updateUser`) ani z top-level claimu `role` (to rola Postgresa, np. `authenticated`):

```typescript
// contexts/auth-context.tsx — fragment: stan i odczyt roli
import type { Session, User } from '@supabase/supabase-js';
import { z } from 'zod';

const appRoleSchema = z.enum(['admin', 'user']);
export type AppRole = z.infer<typeof appRoleSchema>;

export type AuthState =
    | { status: 'loading' }
    | { status: 'anonymous' }
    | { status: 'authenticated'; user: User; role: AppRole };

// app_metadata zmienia tylko serwer (Admin API albo Custom Access Token Hook);
// brak albo nieznana wartość daje rolę z najmniejszymi uprawnieniami
function readRole(session: Session): AppRole {
    const parsed = appRoleSchema.safeParse(session.user.app_metadata.role);
    return parsed.success ? parsed.data : 'user';
}
```

Hook `useAuth` (`hooks/use-auth.ts`) zwraca `AuthState` z kontekstu i eksportuje typ `AppRole`. `ProtectedRoute` tylko ukrywa ekran przed osobą bez roli — nie zastępuje RLS. Dostęp do danych egzekwują polityki RLS w bazie z tym samym warunkiem roli (skill security, `auth-security-patterns.md`), bo kod klienta użytkownik może zmienić w przeglądarce.

### Layout z Outlet
```typescript
// components/layout.tsx
import { Outlet } from 'react-router';

import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';

export function Layout() {
    return (
        <div className="min-h-dvh flex flex-col">
            <Header />
            <div className="flex flex-1">
                <Sidebar />
                <main className="flex-1 p-6">
                    <Outlet /> {/* Renderuje child route */}
                </main>
            </div>
        </div>
    );
}
```

### Stałe Routes

Jedyne miejsce ze ścieżkami aplikacji to `src/constants/routes.ts`; trasy w `app.tsx`, linki i `navigate` biorą je stąd, bo ścieżka wpisana w kilku plikach rozjeżdża się po cichu przy zmianie.

```typescript
// constants/routes.ts
export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    ITEMS: '/items',
    ITEM: '/items/:id',
    ITEM_NEW: '/items/new',
    SETTINGS: '/settings',
    SETTINGS_PROFILE: '/settings/profile',
    SETTINGS_NOTIFICATIONS: '/settings/notifications',
    SETTINGS_SECURITY: '/settings/security',
} as const satisfies Record<string, string>;

// Użycie
import { generatePath, Link, useNavigate } from 'react-router';

import { ROUTES } from '@/constants/routes';

const navigate = useNavigate();

<Link to={ROUTES.ITEMS}>Elementy</Link>
<Link to={generatePath(ROUTES.ITEM, { id: item.id })}>Zobacz</Link>
void navigate(ROUTES.SETTINGS);
```

`as const` zachowuje dosłowne typy ścieżek, a `satisfies Record<string, string>` pilnuje, że każda wartość to ścieżka (sam `satisfies` bez `as const` zostawia typ `string`). Ścieżkę z parametrem składa `generatePath` z React Routera — koduje wartość i sprawdza nazwy parametrów względem wzorca. `navigate` w React Routerze v7+ może zwrócić promise, więc wywołanie poza `return` dostaje `void` (sekcja Pilnuje ESLint reguł kodu).

### useParams - Parametry URL
```typescript
// pages/item-page.tsx
import { useParams } from 'react-router';
import { z } from 'zod';

import { ErrorMessage } from '@/components/error-message';
import { ItemDetails } from '@/components/item-details';
import { Skeleton } from '@/components/ui/skeleton';
import { useItem } from '@/hooks/use-items';
import { NotFoundPage } from '@/pages/not-found-page';

// Parametr ścieżki to dane z zewnątrz — parsujesz go schematem przed użyciem
const itemParamsSchema = z.strictObject({ id: z.uuid() });

export default function ItemPage() {
    const params = itemParamsSchema.safeParse(useParams());

    if (!params.success) return <NotFoundPage />;

    return <ItemView id={params.data.id} />;
}

// Osobny komponent, bo hook nie może stać za wczesnym returnem
function ItemView({ id }: { id: string }) {
    const { data: item, isPending, isError, error } = useItem(id);

    if (isPending) return <Skeleton className="h-40 w-full" />;
    if (isError) return <ErrorMessage error={error} />;

    return <ItemDetails item={item} />;
}
```

### useSearchParams - Query String
```typescript
// pages/items-page.tsx
import { useSearchParams } from 'react-router';
import { z } from 'zod';

import { Filters } from '@/components/filters';
import { ItemGrid } from '@/components/item-grid';
import { Pagination } from '@/components/pagination';
import { useItems } from '@/hooks/use-items';

const MAX_SEARCH_LENGTH = 200;

// Query string to dane z zewnątrz; każde pole ma .catch, więc zły parametr daje wartość domyślną
const itemsSearchSchema = z.object({
    category: z.string().min(1).optional().catch(undefined),
    q: z.string().max(MAX_SEARCH_LENGTH).catch(''),
    page: z.coerce.number().int().min(1).catch(1),
});

export default function ItemsPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Odczyt (parse nie rzuca, bo każde pole ma .catch)
    const { category, q: search, page } = itemsSearchSchema.parse(Object.fromEntries(searchParams));

    // Zapis
    const handleCategoryChange = (nextCategory: string | null) => {
        setSearchParams((prev) => {
            if (nextCategory) {
                prev.set('category', nextCategory);
            } else {
                prev.delete('category');
            }
            prev.delete('page'); // Reset paginacji
            return prev;
        }, { replace: true });
    };

    const handlePageChange = (nextPage: number) => {
        setSearchParams((prev) => {
            prev.set('page', String(nextPage));
            return prev;
        });
    };

    // React Query z params — przez hook z fabryką kluczy (sekcja Katalog hooks/)
    const { data } = useItems({ category, search, page });

    return (
        <div>
            <Filters
                category={category}
                onCategoryChange={handleCategoryChange}
            />
            <ItemGrid items={data?.items} />
            <Pagination
                currentPage={page}
                totalPages={data?.totalPages}
                onPageChange={handlePageChange}
            />
        </div>
    );
}
```

### useNavigate - Programowa Nawigacja
```typescript
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';

import { LoginFields } from '@/components/login-fields';
import { ROUTES } from '@/constants/routes';

// location.state przychodzi z historii przeglądarki — parsujesz go jak każde dane z zewnątrz.
// Ścieżka względna od jednego "/" (nie "//host"), żeby powrót po logowaniu nie wyprowadził poza aplikację.
const loginStateSchema = z.object({
    from: z.string().regex(/^\/(?!\/)/),
});

function LoginForm() {
    const navigate = useNavigate();
    const location = useLocation();

    // Gdzie przekierować po logowaniu
    const parsedState = loginStateSchema.safeParse(location.state);
    const from = parsedState.success ? parsedState.data.from : ROUTES.HOME;

    const handleSuccess = () => {
        void navigate(from, { replace: true });
    };

    return <LoginFields onSuccess={handleSuccess} />;
}

// Nawigacja z state (odbiorca parsuje state schematem, jak wyżej)
void navigate(ROUTES.ITEM_NEW, { state: { initialValues: draft } });

// Cofnij
void navigate(-1);

// Replace (bez historii)
void navigate(ROUTES.HOME, { replace: true });
```

### Nested Routes (Settings)
```typescript
// app.tsx — fragment
import { Navigate, Route } from 'react-router';

import { ROUTES } from '@/constants/routes';
import { NotificationSettings } from '@/pages/notification-settings';
import { ProfileSettings } from '@/pages/profile-settings';
import { SecuritySettings } from '@/pages/security-settings';
import { SettingsLayout } from '@/pages/settings-layout';

<Route path={ROUTES.SETTINGS} element={<SettingsLayout />}>
    <Route index element={<Navigate to={ROUTES.SETTINGS_PROFILE} replace />} />
    <Route path={ROUTES.SETTINGS_PROFILE} element={<ProfileSettings />} />
    <Route path={ROUTES.SETTINGS_NOTIFICATIONS} element={<NotificationSettings />} />
    <Route path={ROUTES.SETTINGS_SECURITY} element={<SecuritySettings />} />
</Route>

// pages/settings-layout.tsx
import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';

import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

export function SettingsLayout() {
    return (
        <div className="flex gap-6">
            <nav className="w-48 space-y-1">
                <SettingsNavLink to={ROUTES.SETTINGS_PROFILE}>Profil</SettingsNavLink>
                <SettingsNavLink to={ROUTES.SETTINGS_NOTIFICATIONS}>Powiadomienia</SettingsNavLink>
                <SettingsNavLink to={ROUTES.SETTINGS_SECURITY}>Bezpieczeństwo</SettingsNavLink>
            </nav>
            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    );
}

function SettingsNavLink({ to, children }: { to: string; children: ReactNode }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => cn(
                "block px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
            )}
        >
            {children}
        </NavLink>
    );
}
```

### Redirect po Akcji
```typescript
// Fragment komponentu strony; mutacje pochodzą z hooków (sekcja Katalog hooks/),
// które unieważniają cache i logują błąd. Komponent dokłada tylko przekierowanie.
const navigate = useNavigate();
const createItem = useCreateItem();
const deleteItem = useDeleteItem();

// Po utworzeniu - przekieruj do nowego zasobu
const handleCreate = (input: CreateItemInput) => {
    createItem.mutate(input, {
        onSuccess: (newItem) => void navigate(generatePath(ROUTES.ITEM, { id: newItem.id })),
    });
};

// Po usunięciu - przekieruj do listy. Wołane z akcji potwierdzenia w AlertDialog
// (wzorzec w loading-and-error-states.md, sekcja IO-bound), bo usunięcia nie da się cofnąć.
const handleDeleteConfirmed = (id: string) => {
    deleteItem.mutate(id, {
        onSuccess: () => void navigate(ROUTES.ITEMS, { replace: true }),
    });
};
```

### Scroll Restoration
```typescript
// app.tsx lub components/layout.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, useLocation } from 'react-router';

function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}

// W App
<BrowserRouter>
    <ScrollToTop />
    <Routes>...</Routes>
</BrowserRouter>
```

### View Transitions (opcjonalne)
```typescript
import { generatePath, Link, useNavigate } from 'react-router';

import { ROUTES } from '@/constants/routes';

// Link: React Router sam opakowuje zmianę trasy w document.startViewTransition
<Link to={generatePath(ROUTES.ITEM, { id })} viewTransition>
    Zobacz
</Link>

// Nawigacja programowa
const navigate = useNavigate();
void navigate(generatePath(ROUTES.ITEM, { id }), { viewTransition: true });
```

Opcja `viewTransition` zastępuje własny hook z `document.startViewTransition(() => navigate(...))`: router aktualizuje stan wewnątrz przejścia, więc przeglądarka robi zrzut starego i nowego widoku we właściwych momentach, a ręczne wywołanie `navigate` w callbacku łapie zły stan. Przeglądarka bez View Transitions API przechodzi zwykłą nawigacją. Obsługę opcji w trybie, którego używa projekt (`BrowserRouter` albo `createBrowserRouter`), sprawdzasz w dokumentacji wersji z package.json. Animacje przejść opisuje skill ux-ui-guidelines (`animations.md`).

### Error Boundary dla Route

Granica trasy działa jak kanoniczny `ErrorFallback` z [component-patterns.md](./component-patterns.md#error-boundaries): `onError` loguje kod `UI_BOUNDARY`, treść błędu widać tylko w trybie deweloperskim, a „Spróbuj ponownie” resetuje zapytania przez `QueryErrorResetBoundary`, więc zapytanie, które rzuciło do granicy, pobiera dane od nowa. Wariant trasy dokłada przycisk „Wróć”.
```typescript
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { Route, useNavigate } from 'react-router';

import { LoadingOverlay } from '@/components/loading-overlay';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { logger } from '@/lib/logger';

const ItemPage = lazy(() => import('@/pages/item-page'));

<Route path={ROUTES.ITEM} element={
    <QueryErrorResetBoundary>
        {({ reset }) => (
            <ErrorBoundary
                FallbackComponent={RouteErrorFallback}
                onError={(error) => logger.error('UI_BOUNDARY', error)}
                onReset={reset}
            >
                <Suspense fallback={<LoadingOverlay />}>
                    <ItemPage />
                </Suspense>
            </ErrorBoundary>
        )}
    </QueryErrorResetBoundary>
} />

function RouteErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    const navigate = useNavigate();

    return (
        <div role="alert" className="p-6 text-center">
            <h2>Coś poszło nie tak</h2>
            {/* Treść błędu tylko w trybie deweloperskim: komunikat techniczny nie trafia do użytkownika */}
            {import.meta.env.DEV && error instanceof Error && (
                <pre className="text-sm text-muted-foreground">{error.message}</pre>
            )}
            <div className="flex gap-2 justify-center mt-4">
                <Button onClick={resetErrorBoundary}>Spróbuj ponownie</Button>
                <Button variant="outline" onClick={() => void navigate(-1)}>Wróć</Button>
            </div>
        </div>
    );
}
```


## Katalog hooks/

Custom hooks dla logiki biznesowej.

### Nie używaj useEffect do data fetching

To **anty-wzorzec** (sekcja Async i React reguł kodu: nowy kod pobierający dane idzie przez TanStack Query):
```typescript
// ❌ Anty-wzorzec
function useMyFeature() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        fetchData().then(setData).finally(() => setIsLoading(false));
    }, []);
    
    return { data, isLoading };
}
```

**Problemy:**
- Race conditions
- Brak cache
- Waterfall requests
- Podwójne wywołania w Strict Mode
- Brak limitu czasu i anulowania żądania

### ✅ Używaj React Query
```typescript
// hooks/use-items.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import type { CreateItemInput } from '@/schemas/item-schema';
import { itemService, type ItemFilters } from '@/services/item-service';

const ITEMS_STALE_TIME_MS = 5 * 60 * 1000;

// Fabryka kluczy: jedno źródło kluczy dla zapytań i unieważniania
export const itemKeys = {
    all: ['items'] as const,
    list: (filters: ItemFilters) => [...itemKeys.all, 'list', filters] as const,
    detail: (id: string) => [...itemKeys.all, 'detail', id] as const,
};

export function useItems(filters: ItemFilters) {
    return useQuery({
        queryKey: itemKeys.list(filters),
        queryFn: ({ signal }) => itemService.list(filters, signal),
        staleTime: ITEMS_STALE_TIME_MS,
    });
}

export function useItem(id: string) {
    return useQuery({
        queryKey: itemKeys.detail(id),
        queryFn: ({ signal }) => itemService.get(id, signal),
    });
}

export function useCreateItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateItemInput) => itemService.create(input),
        // Zwracany promise: mutacja kończy się po odświeżeniu listy
        onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
        onError: (error) => {
            logger.error('ITEM_CREATE_FAILED', error);
            toast.error('Nie udało się utworzyć elementu');
        },
    });
}

export function useDeleteItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => itemService.remove(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
        onError: (error) => {
            logger.error('ITEM_DELETE_FAILED', error);
            toast.error('Nie udało się usunąć elementu');
        },
    });
}
```

`queryFn` przekazuje `signal` z TanStack Query do serwisu, więc zmiana klucza albo odmontowanie anuluje żądanie; limit czasu dokłada klient `request()` (sekcja Katalog lib/). `useItems` dostaje filtry (`useItems({ category: 'marketing' })`, bez filtrów `useItems({})`), a `data` ma kształt odpowiedzi serwisu: `{ items, totalPages }`. Hooki listy, szczegółów i mutacji elementów leżą w jednym pliku `hooks/use-items.ts`, więc test importuje je z `./use-items`. Hook zwraca wynik `useQuery`/`useMutation`, więc typ zwracany wynika z tego wywołania (sekcja Type safety reguł kodu).

### Hooki utility (te są OK)
```typescript
// hooks/use-debounce.ts
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

// hooks/use-local-storage.ts — odczyt przez schema.safeParse(JSON.parse(...)) w try z logiem,
// bo localStorage to dane z zewnątrz (użytkownik i inne wersje aplikacji zmieniają je dowolnie)
export function useLocalStorage<T>(
    key: string,
    schema: z.ZodType<T>,
    initialValue: T,
): [T, (value: T) => void] {
    // ...
}

// hooks/use-media-query.ts
export function useMediaQuery(query: string): boolean {
    // ...
}
```

**Różnica:**
- `useEffect` dla data fetching = ❌
- `useEffect` dla synchronizacji (timers, subscriptions, DOM) = ✅

---

## Katalog lib/
```
lib/
├── api.ts              # Klient HTTP: request() z limitem czasu, kopertą i ApiError
├── env.ts              # Zmienne środowiska sparsowane Zod (API_URL)
├── errors.ts           # Typowane błędy (ApiError, BootstrapError, ContextMissingError)
├── supabase.ts         # Supabase client (createClient z global.fetch z limitem czasu)
├── logger.ts           # Logger ze skilla sentry-integration
├── utils.ts            # cn(), formatters
└── query-client.ts     # React Query config
```

Definicję `logger.ts` (API `logger.error(message, error?)`, `logger.warn`, `logger.info(message, data?)`) daje skill sentry-integration: [react-sentry-patterns.md, sekcja Logger Integration](../../sentry-integration/resources/react-sentry-patterns.md#logger-integration). Komunikat to stały kod błędu w `UPPER_SNAKE_CASE` (`logger.error('ITEM_CREATE_FAILED', error)`), nie tekst z danymi.

### errors.ts
```typescript
// lib/errors.ts
// Bez parameter properties (erasableSyntaxOnly) — pola przypisane w konstruktorze
export class ApiError extends Error {
    readonly code: string;
    readonly status: number | undefined;
    constructor(code: string, message: string, status?: number) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.status = status;
    }
}

export class BootstrapError extends Error {
    readonly code: string;
    constructor(code: string) {
        super(code);
        this.name = 'BootstrapError';
        this.code = code;
    }
}

// Hook kontekstu użyty poza swoim providerem (useAuth, useConfirm, useMyContext)
export class ContextMissingError extends Error {
    readonly code: string;
    constructor(code: string) {
        super(code);
        this.name = 'ContextMissingError';
        this.code = code;
    }
}
```

Klasy błędów mają jedno miejsce, `lib/errors.ts`; komponenty, hooki i konteksty je importują (`import { ContextMissingError } from '@/lib/errors'`), bo druga definicja tej samej klasy rozjeżdża się po cichu, a `instanceof` z dwóch modułów nie rozpoznaje błędu z drugiego.

### env.ts
```typescript
// lib/env.ts
import { z } from 'zod';

// import.meta.env ma też klucze Vite (MODE, DEV, BASE_URL), więc z.object, nie strictObject
const envSchema = z.object({
    VITE_API_URL: z.url(),
});

// Brak albo zły adres zatrzymuje start aplikacji z czytelnym błędem Zod (fail fast)
const parsedEnv = envSchema.parse(import.meta.env);

export const env = {
    API_URL: parsedEnv.VITE_API_URL,
} as const;
```

### api.ts
```typescript
// lib/api.ts
import { z } from 'zod';

import { env } from '@/lib/env';
import { ApiError } from '@/lib/errors';

const REQUEST_TIMEOUT_MS = 10_000;
const NO_CONTENT_STATUS = 204;

const apiErrorSchema = z.strictObject({
    code: z.string(),
    message: z.string(),
});

// Koperta API { data, error: { code, message } } (sekcja Obsługa błędów reguł kodu):
// sukces ma error: null, porażka ma data: null. Schemat koperty nie jest generyczny —
// dane parsuje osobno schemat podany przez serwis (sekcja pod blokiem)
const envelopeSchema = z.union([
    z.strictObject({ data: z.unknown(), error: z.null() }),
    z.strictObject({ data: z.null(), error: apiErrorSchema }),
]);

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    // Sygnał TanStack Query (anulowanie przy zmianie klucza) łączysz z limitem czasu
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

    try {
        return await fetch(url, {
            ...init,
            // headers po ...init, żeby nagłówki z init nie nadpisały scalonych
            headers: { 'Content-Type': 'application/json', ...init.headers },
            signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'TimeoutError') {
            throw new ApiError('REQUEST_TIMEOUT', `Brak odpowiedzi w ${REQUEST_TIMEOUT_MS} ms`);
        }
        throw error; // AbortError (anulowanie) i błąd sieci idą dalej bez zmian
    }
}

// Zwraca pole `data` koperty albo rzuca ApiError z kodem z koperty
async function readEnvelopeData(response: Response): Promise<unknown> {
    // 204 No Content nie ma ciała: traktujesz je jak kopertę { data: null, error: null }
    if (response.status === NO_CONTENT_STATUS) return null;

    const isJson = response.headers.get('Content-Type')?.includes('application/json') ?? false;
    if (!isJson) {
        throw new ApiError('INVALID_RESPONSE', `Odpowiedź ${response.status} bez JSON`, response.status);
    }

    const body: unknown = await response.json();
    const envelope = envelopeSchema.safeParse(body);
    if (!envelope.success) {
        throw new ApiError('INVALID_RESPONSE', 'Odpowiedź API ma nieoczekiwany kształt', response.status);
    }
    if (envelope.data.error !== null) {
        const { code, message } = envelope.data.error;
        throw new ApiError(code, message, response.status);
    }
    return envelope.data.data;
}

export async function request<T extends z.ZodType>(
    endpoint: string,
    dataSchema: T,
    init: RequestInit = {},
): Promise<z.output<T>> {
    const response = await fetchWithTimeout(`${env.API_URL}${endpoint}`, init);
    const data = dataSchema.safeParse(await readEnvelopeData(response));
    if (!data.success) {
        throw new ApiError('INVALID_RESPONSE', 'Dane odpowiedzi mają nieoczekiwany kształt', response.status);
    }
    return data.data;
}
```

`request()` to jedyne miejsce z `fetch` do własnego API: limit czasu (`AbortSignal.timeout` z nazwaną stałą), parsowanie koperty `z.strictObject` i typowany `ApiError` z kodem z koperty stoją tu raz, a serwisy podają tylko ścieżkę i schemat danych. Kopertę parsuje schemat niegeneryczny (`data: z.unknown()`), a dane — `dataSchema.safeParse` w drugim kroku: unia z generycznym `dataSchema` w środku daje w zod 4 typ, z którego TypeScript nie odczyta pola `data` (błąd kompilacji TS2339). Odpowiedź 204 bez ciała (np. `DELETE`) daje `data: null`, więc serwis z `z.null()` (`itemService.remove`) przyjmuje i kopertę `{ data: null, error: null }`, i pustą odpowiedź. Klient Supabase dostaje limit czasu przez opakowany `fetch` w `createClient({ global: { fetch } })` (sekcja Async i React reguł kodu).

### query-client.ts
```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

const DEFAULT_STALE_TIME_MS = 60 * 1000;
const QUERY_RETRY_COUNT = 1;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: DEFAULT_STALE_TIME_MS,
            retry: QUERY_RETRY_COUNT,
        },
    },
});
```

### utils.ts
```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat('pl-PL').format(new Date(date));
}
```

---

## Katalog services/

Serwis to warstwa między hookiem a klientem: składa ścieżkę i query, wybiera schemat odpowiedzi i woła `request()` albo `supabase`. Nie zna Reacta, więc hook (`use-items.ts`) owija go w `useQuery`/`useMutation`.

```typescript
// services/item-service.ts
import { z } from 'zod';

import { request } from '@/lib/api';
import { itemSchema, type CreateItemInput, type Item } from '@/schemas/item-schema';

export interface ItemFilters {
    category?: string;
    search?: string;
    page?: number;
}

const itemListSchema = z.strictObject({
    items: z.array(itemSchema),
    totalPages: z.number().int().min(0),
});
export type ItemList = z.infer<typeof itemListSchema>;

// URLSearchParams koduje wartości (spacja, &, = w wyszukiwanej frazie)
function toQueryString(filters: ItemFilters): string {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('q', filters.search);
    if (filters.page) params.set('page', String(filters.page));
    const query = params.toString();
    return query ? `?${query}` : '';
}

export const itemService = {
    list: (filters: ItemFilters, signal?: AbortSignal): Promise<ItemList> =>
        request(`/items${toQueryString(filters)}`, itemListSchema, { signal }),
    get: (id: string, signal?: AbortSignal): Promise<Item> =>
        request(`/items/${encodeURIComponent(id)}`, itemSchema, { signal }),
    create: (input: CreateItemInput): Promise<Item> =>
        request('/items', itemSchema, { method: 'POST', body: JSON.stringify(input) }),
    remove: (id: string): Promise<null> =>
        request(`/items/${encodeURIComponent(id)}`, z.null(), { method: 'DELETE' }),
};
```

Serwis to jeden obiekt z metodami (`itemService.list`, `.get`, `.create`, `.remove`), nie luźne funkcje w tym samym module — hook, test i przykład w [typescript-standards.md](./typescript-standards.md) wołają tę samą postać.

---

## Katalog schemas/
```
schemas/
├── item-schema.ts      # Schemat Zod kontraktu Item i typy z z.infer
├── contact-schema.ts   # Schemat formularza kontaktowego (forms.md)
└── template-schema.ts  # Schemat formularza i kontrakt Template (forms.md)
```
```typescript
// schemas/item-schema.ts
import { z } from 'zod';

const MAX_ITEM_NAME_LENGTH = 200;

export const ITEM_CATEGORIES = ['marketing', 'sprzedaz', 'hr'] as const;

// Typ wyprowadzasz ze schematu, żeby kontrakt miał jedno źródło: schemat parsuje
// odpowiedź w serwisie, a ten sam typ widzą hooki, komponenty i fixture'y testów
export const itemSchema = z.strictObject({
    id: z.uuid(),
    name: z.string().min(1).max(MAX_ITEM_NAME_LENGTH),
    category: z.enum(ITEM_CATEGORIES),
    created_at: z.iso.datetime(),
});
export type Item = z.infer<typeof itemSchema>;

// Dane do utworzenia elementu — id i created_at nadaje serwer
export const createItemSchema = itemSchema.omit({ id: true, created_at: true });
export type CreateItemInput = z.infer<typeof createItemSchema>;
```

Schemat jest zmienną, więc ma nazwę w `camelCase` (`itemSchema`), a typ z niego — w `PascalCase` (`Item`), według sekcji Nazewnictwo reguł kodu.

---

## Katalog types/
```
types/
├── database.types.ts   # Typy tabel DB (generowane: supabase gen types typescript)
└── index.ts            # Re-exports
```
```typescript
// types/database.types.ts — fragment
export interface User {
    id: string;
    email: string;
    created_at: string;
}
```

Typ, który opisuje dane z zewnątrz (odpowiedź API, formularz, `localStorage`), ma schemat w `schemas/`, bo te dane parsujesz przed użyciem (sekcja Bezpieczeństwo reguł kodu). W `types/` zostają typy bez parsowania: wygenerowane typy bazy i typy pomocnicze.

---

## Katalog constants/
```typescript
// constants/config.ts
export const ITEMS_PER_PAGE = 20;
```

`ROUTES` ma jedno miejsce, `constants/routes.ts` (sekcja Routing, Stałe Routes) — tu go nie powtarzasz. Adres API nie jest stałą: czyta go `lib/env.ts` ze zmiennej środowiska, a `request()` bierze go stamtąd, więc w `constants/` nie stoi drugi `API_URL`.

---

## Barrel Exports (index.ts)

### Używaj z rozwagą
```typescript
// components/ui/index.ts
export { Button } from './button';
export { Card, CardHeader, CardContent } from './card';

// Import
import { Button, Card } from '@/components/ui';
```

### Problemy w dużych projektach

Barrel files mogą **spowalniać**:
- Start dev servera (Vite)
- Testy (Vitest)
- HMR (Hot Module Replacement)

**Dlaczego:** Importując jedną rzecz, bundler przetwarza cały index.

### Rekomendacja

| Rozmiar projektu | Barrel files |
|------------------|--------------|
| Mały (<20 komponentów) | ✅ OK |
| Średni (20-50) | Tylko dla `ui/` |
| Duży (>50) | ❌ Bezpośrednie importy |
```typescript
// Dla dużych projektów - bezpośrednie importy
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
```

---

## Organizacja Testów

### Co-located (Rekomendowane)
```
components/
├── header.tsx
├── header.test.tsx
├── footer.tsx
└── footer.test.tsx
```

### Konwencja nazw

- `component-name.test.tsx` - unit tests
- `component-name.integration.test.tsx` - integration tests

---

## Konwencje Nazewnictwa

Nazwy plików w kebab-case (sekcja Nazewnictwo reguł kodu); identyfikatory w kodzie zostają w swojej konwencji (komponent `PascalCase`, hook i funkcja `camelCase`, stała `UPPER_SNAKE_CASE`).

| Typ | Plik | Przykład pliku | Identyfikator w kodzie |
|-----|------|----------------|------------------------|
| Komponenty | kebab-case | `item-card.tsx` | `ItemCard` |
| shadcn/ui | kebab-case (tak generuje CLI) | `button.tsx`, `dropdown-menu.tsx` | `Button`, `DropdownMenu` |
| Strony | kebab-case + `-page` | `settings-page.tsx` | `SettingsPage` (default export przy `lazy()`) |
| Hooki | kebab-case + `use-` | `use-items.ts` | `useItems` |
| Serwisy | kebab-case + `-service` | `item-service.ts` | `itemService` |
| Utilities | kebab-case | `format-date.ts` | `formatDate` |
| Schematy | kebab-case z sufiksem `-schema` | `item-schema.ts`, `contact-schema.ts` | `itemSchema`, `Item` |
| Typy | kebab-case | `database.types.ts` | `User` |
| Stałe | kebab-case | `routes.ts` | `ROUTES` |
| Testy | nazwa pliku + `.test` | `item-card.test.tsx` | — |

Wyjątek: plik, którego nazwę wymusza framework albo narzędzie (`vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`).

---

## Import Aliasy
```typescript
// vite.config.ts
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});

// tsconfig.json
{
    "compilerOptions": {
        "paths": {
            "@/*": ["./src/*"]
        }
    }
}
```

**Użycie:**
```typescript
import { Button } from '@/components/ui/button';
import { useItems } from '@/hooks/use-items';
import { cn } from '@/lib/utils';
```

| Alias | Ścieżka | Przykład |
|-------|---------|----------|
| `@/` | `src/` | `import { ROUTES } from '@/constants/routes'` |
| `@/components` | `src/components` | `import { Button } from '@/components/ui/button'` |
| `@/hooks` | `src/hooks` | `import { useTemplates } from '@/hooks/use-templates'` |
| `@/services` | `src/services` | `import { itemService } from '@/services/item-service'` (tylko w hookach) |
| `@/schemas` | `src/schemas` | `import { itemSchema, type Item } from '@/schemas/item-schema'` |
| `@/lib` | `src/lib` | `import { cn } from '@/lib/utils'` |
| `@/test` | `src/test` | `import { render } from '@/test/utils'` |

Alias zdefiniowany w `vite.config.ts` i `tsconfig.json` — oba pliki muszą mieć tę samą ścieżkę.

---

## Kiedy Tworzyć Nowy Plik

Próg rozmiaru z sekcji Pilnuje ESLint reguł kodu: plik TS/TSX ponad 360 linii albo funkcja ponad 60 linii (bez pustych linii i komentarzy) dzielisz na moduły i pod-funkcje. Tabele niżej mówią, kiedy wydzielić plik wcześniej.

### Nowy Komponent

| Nowy plik | Ten sam plik |
|-----------|--------------|
| Reużywalny | <50 linii helper |
| Plik przekroczyłby próg 360 linii albo funkcja próg 60 linii | Ściśle powiązany |
| Jasna odpowiedzialność | Nie reużywany |
| Logika biznesowa (idzie do hooka albo serwisu, nie do pliku komponentu) | Logika samego widoku |

### Nowy Hook

| Nowy plik | Nie trzeba |
|-----------|------------|
| Data fetching (React Query) | Prosty useState wrapper |
| Reużywalna logika | <20 linii |
| Synchronizacja (timers, DOM) | Użyte raz |

### Nowa Utility

| lib/ | W komponencie |
|------|---------------|
| Używana w trzech miejscach (przy dwóch prosta duplikacja jest lepsza niż abstrakcja) | Użyta w jednym miejscu |
| Bez React | React-specific |
| Ogólne zadanie | Formatowanie widoku tego komponentu (logika biznesowa idzie do hooka albo serwisu) |

Wyjątek od progu trzech użyć: stała albo kontrakt (schemat, typ, próg, ścieżka) w dwóch miejscach od razu dostaje jedno źródło (sekcja Organizacja kodu reguł kodu), bo kopie rozjeżdżają się po cichu.

---

## Setup React Query
```typescript
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app';
import { BootstrapError } from '@/lib/errors';

// Zawężenie zamiast `!`: brak #root w index.html daje błąd z kodem
const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new BootstrapError('ROOT_MISSING');
}

createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
```

`QueryClientProvider` z `queryClient` (`lib/query-client.ts`) i `ReactQueryDevtools` stoją w `app.tsx` (sekcja Routing, Konfiguracja w app.tsx). Provider w obu plikach zagnieżdżałby drugi `QueryClientProvider` i rozkładał konfigurację na dwa miejsca, więc `main.tsx` renderuje samo `<App />`.

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Wzorce komponentów, lazy loading
- [typescript-standards.md](./typescript-standards.md) - Typy
- [performance.md](./performance.md) - React Query, caching
- [loading-and-error-states.md](./loading-and-error-states.md) - Loading, Error Boundaries
- [react-sentry-patterns.md](../../sentry-integration/resources/react-sentry-patterns.md#logger-integration) - Definicja `lib/logger.ts`
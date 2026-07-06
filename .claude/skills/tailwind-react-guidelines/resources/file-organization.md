# Organizacja Plików

Struktura katalogów dla Vite + React SPA.

---

## Struktura Projektu
```
src/
├── main.tsx                # Punkt wejścia
├── App.tsx                 # Router + providers
├── components/             # Komponenty React
│   ├── ui/                # Prymitywy UI (shadcn/ui)
│   └── [Feature].tsx      # Komponenty aplikacji
├── pages/                  # Komponenty stron (route-level)
├── hooks/                  # Custom hooks
├── lib/                    # Utilities i klienty
├── types/                  # TypeScript types
└── constants/              # Stałe i konfiguracja
```

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
- Lowercase nazwy (konwencja shadcn)

### Komponenty Aplikacji
```
components/
├── Header.tsx
├── Footer.tsx
├── Sidebar.tsx
└── [Feature]Card.tsx
```

---

## Katalog pages/

Komponenty na poziomie route - lazy-loaded:
```
pages/
├── HomePage.tsx
├── SettingsPage.tsx
├── ProfilePage.tsx
└── NotFoundPage.tsx
```
```typescript
// App.tsx
const HomePage = lazy(() => import('@/pages/HomePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

<Routes>
    <Route path="/" element={
        <Suspense fallback={<LoadingOverlay />}>
            <HomePage />
        </Suspense>
    } />
</Routes>
```

---
---

## Routing (React Router v7)

### Konfiguracja w App.tsx
```typescript
// App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Lazy load pages
const HomePage = lazy(() => import('@/pages/HomePage'));
const ItemsPage = lazy(() => import('@/pages/ItemsPage'));
const ItemPage = lazy(() => import('@/pages/ItemPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));

export function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AuthProvider>
                    <Routes>
                        {/* Public routes */}
                        <Route path="/login" element={
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
                            <Route path="templates" element={
                                <Suspense fallback={<LoadingOverlay />}>
                                    <ItemsPage />
                                </Suspense>
                            } />
                            <Route path="templates/:id" element={
                                <Suspense fallback={<LoadingOverlay />}>
                                    <ItemPage />
                                </Suspense>
                            } />
                            <Route path="settings" element={
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
        </QueryClientProvider>
    );
}
```

### Protected Route
```typescript
// components/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingOverlay } from '@/components/LoadingOverlay';

interface ProtectedRouteProps {
    children?: React.ReactNode;
    requiredRole?: 'admin' | 'user';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const { user, isLoading, isAuthenticated } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <LoadingOverlay />;
    }

    if (!isAuthenticated) {
        // Zapisz gdzie user chciał iść
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requiredRole && user?.role !== requiredRole) {
        return <Navigate to="/" replace />;
    }

    return children ?? <Outlet />;
}
```

### Layout z Outlet
```typescript
// components/Layout.tsx
import { Outlet } from 'react-router';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';

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
```typescript
// constants/routes.ts
export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    TEMPLATES: '/templates',
    TEMPLATE: (id: string) => `/templates/${id}`,
    SETTINGS: '/settings',
    SETTINGS_PROFILE: '/settings/profile',
    SETTINGS_NOTIFICATIONS: '/settings/notifications',
} as const;

// Użycie
import { ROUTES } from '@/constants/routes';

<Link to={ROUTES.TEMPLATES}>Szablony</Link>
<Link to={ROUTES.TEMPLATE(template.id)}>Zobacz</Link>
navigate(ROUTES.SETTINGS);
```

### useParams - Parametry URL
```typescript
// pages/ItemPage.tsx
import { useParams } from 'react-router';

export function ItemPage() {
    const { id } = useParams<{ id: string }>();

    const { data: item, isLoading } = useQuery({
        queryKey: ['item', id],
        queryFn: () => {
            if (!id) throw new Error('Brak parametru id');
            return api.getItem(id); // id zawężone do string, bez non-null assertion
        },
        enabled: Boolean(id),
    });

    if (isLoading) return <Skeleton />;
    if (!item) return <NotFound />;

    return <ItemDetails item={item} />;
}

export default ItemPage;
```

### useSearchParams - Query String
```typescript
// pages/ItemsPage.tsx
import { useSearchParams } from 'react-router';

export function ItemsPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Odczyt
    const category = searchParams.get('category');
    const search = searchParams.get('q') ?? '';
    const page = Number(searchParams.get('page')) || 1;

    // Zapis
    const handleCategoryChange = (category: string | null) => {
        setSearchParams((prev) => {
            if (category) {
                prev.set('category', category);
            } else {
                prev.delete('category');
            }
            prev.delete('page'); // Reset paginacji
            return prev;
        }, { replace: true });
    };

    // React Query z params
    const { data } = useQuery({
        queryKey: ['templates', { category, search, page }],
        queryFn: () => api.getItems({ category, search, page }),
    });

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
                onPageChange={(p) => setSearchParams({ ...Object.fromEntries(searchParams), page: String(p) })}
            />
        </div>
    );
}
```

### useNavigate - Programowa Nawigacja
```typescript
import { useNavigate, useLocation } from 'react-router';

function LoginForm() {
    const navigate = useNavigate();
    const location = useLocation();

    // Gdzie przekierować po logowaniu
    const from = (location.state as { from?: Location })?.from?.pathname || '/';

    const handleSuccess = () => {
        navigate(from, { replace: true });
    };

    return <form onSubmit={...}>...</form>;
}

// Nawigacja z state
navigate('/templates/new', { state: { prefill: data } });

// Cofnij
navigate(-1);

// Replace (bez historii)
navigate('/dashboard', { replace: true });
```

### Nested Routes (Settings)
```typescript
// App.tsx
<Route path="settings" element={<SettingsLayout />}>
    <Route index element={<Navigate to="profile" replace />} />
    <Route path="profile" element={<ProfileSettings />} />
    <Route path="notifications" element={<NotificationSettings />} />
    <Route path="security" element={<SecuritySettings />} />
</Route>

// pages/SettingsLayout.tsx
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/utils';

export function SettingsLayout() {
    return (
        <div className="flex gap-6">
            <nav className="w-48 space-y-1">
                <SettingsNavLink to="profile">Profil</SettingsNavLink>
                <SettingsNavLink to="notifications">Powiadomienia</SettingsNavLink>
                <SettingsNavLink to="security">Bezpieczeństwo</SettingsNavLink>
            </nav>
            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    );
}

function SettingsNavLink({ to, children }: { to: string; children: React.ReactNode }) {
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
// Po utworzeniu - przekieruj do nowego zasobu
const mutation = useMutation({
    mutationFn: api.createItem,
    onSuccess: (newItem) => {
        queryClient.invalidateQueries({ queryKey: ['items'] });
        navigate(ROUTES.ITEM(newItem.id));
    },
});

// Po usunięciu - przekieruj do listy
const deleteMutation = useMutation({
    mutationFn: api.deleteItem,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['items'] });
        navigate(ROUTES.TEMPLATES, { replace: true });
    },
});
```

### Scroll Restoration
```typescript
// App.tsx lub Layout.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router';

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
// hooks/useViewTransitionNavigate.ts
import { useNavigate } from 'react-router';
import { useCallback } from 'react';

export function useViewTransitionNavigate() {
    const navigate = useNavigate();

    return useCallback((to: string, options?: { replace?: boolean }) => {
        if (!document.startViewTransition) {
            navigate(to, options);
            return;
        }

        document.startViewTransition(() => {
            navigate(to, options);
        });
    }, [navigate]);
}

// Użycie
const navigate = useViewTransitionNavigate();
navigate(ROUTES.TEMPLATE(id));
```

### Error Boundary dla Route
```typescript
import { ErrorBoundary } from 'react-error-boundary';

<Route path="templates/:id" element={
    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
        <Suspense fallback={<LoadingOverlay />}>
            <ItemPage />
        </Suspense>
    </ErrorBoundary>
} />

function RouteErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    const navigate = useNavigate();

    return (
        <div className="p-6 text-center">
            <h2>Coś poszło nie tak</h2>
            <p className="text-muted-foreground">{error.message}</p>
            <div className="flex gap-2 justify-center mt-4">
                <Button onClick={resetErrorBoundary}>Spróbuj ponownie</Button>
                <Button variant="outline" onClick={() => navigate(-1)}>Wróć</Button>
            </div>
        </div>
    );
}
```


## Katalog hooks/

Custom hooks dla logiki biznesowej.

### ⚠️ Nie używaj useEffect do data fetching

To jest **anty-wzorzec** w 2026:
```typescript
// ❌ NIE RÓB TEGO
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

### ✅ Używaj React Query
```typescript
// hooks/useItems.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useItems(category?: string) {
    return useQuery({
        queryKey: ['items', category],
        queryFn: () => api.getItems(category),
        staleTime: 5 * 60 * 1000, // 5 minut
    });
}

export function useCreateItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: api.createItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['items'] });
        },
    });
}
```

### Hooki utility (te są OK)
```typescript
// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

// hooks/useLocalStorage.ts
export function useLocalStorage<T>(key: string, initialValue: T) {
    // ...
}

// hooks/useMediaQuery.ts
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
├── api.ts              # API client (fetch wrapper)
├── supabase.ts         # Supabase client
├── logger.ts           # Production-safe logger
├── utils.ts            # cn(), formatters
└── queryClient.ts      # React Query config
```

### api.ts
```typescript
// lib/api.ts
const BASE_URL = import.meta.env.VITE_API_URL;

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    });
    
    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
}

export const api = {
    getItems: (category?: string) =>
        request<Item[]>(`/items${category ? `?category=${category}` : ''}`),
    getItem: (id: string) =>
        request<Item>(`/items/${id}`),
    createItem: (data: CreateItemInput) =>
        request<Item>('/items', { method: 'POST', body: JSON.stringify(data) }),
};
```

### queryClient.ts
```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 minuta
            retry: 1,
        },
    },
});
```

### utils.ts
```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat('pl-PL').format(new Date(date));
}
```

---

## Katalog types/
```
types/
├── database.ts         # Typy tabel DB
├── api.ts              # Typy request/response
└── index.ts            # Re-exports
```
```typescript
// types/database.ts
export interface User {
    id: string;
    email: string;
    created_at: string;
}

export interface Item {
    id: string;
    name: string;
    category: string;
}
```

---

## Katalog constants/
```typescript
// constants/routes.ts
export const ROUTES = {
    HOME: '/',
    SETTINGS: '/settings',
    PROFILE: '/profile',
} as const;

// constants/config.ts
export const CONFIG = {
    API_URL: import.meta.env.VITE_API_URL,
    ITEMS_PER_PAGE: 20,
} as const;
```

---

## Barrel Exports (index.ts)

### ⚠️ Używaj z rozwagą
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
| Średni (20-50) | ⚠️ Tylko dla `ui/` |
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
├── Header.tsx
├── Header.test.tsx
├── Footer.tsx
└── Footer.test.tsx
```

### Konwencja nazw

- `Component.test.tsx` - unit tests
- `Component.integration.test.tsx` - integration tests

---

## Konwencje Nazewnictwa

| Typ | Konwencja | Przykład |
|-----|-----------|----------|
| Komponenty | PascalCase | `ItemCard.tsx` |
| shadcn/ui | lowercase | `button.tsx` |
| Hooki | camelCase + `use` | `useItems.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Typy | camelCase | `database.ts` |
| Stałe | camelCase | `routes.ts` |
| Testy | `.test.tsx` | `Header.test.tsx` |

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
import { useItems } from '@/hooks/useItems';
import { api } from '@/lib/api';
```

---

## Kiedy Tworzyć Nowy Plik

### Nowy Komponent

| Nowy plik | Ten sam plik |
|-----------|--------------|
| Reużywalny | <50 linii helper |
| >150 linii | Ściśle powiązany |
| Jasna odpowiedzialność | Nie reużywany |

### Nowy Hook

| Nowy plik | Nie trzeba |
|-----------|------------|
| Data fetching (React Query) | Prosty useState wrapper |
| Reużywalna logika | <20 linii |
| Synchronizacja (timers, DOM) | Użyte raz |

### Nowa Utility

| lib/ | W komponencie |
|------|---------------|
| Reużywalna | Użyta raz |
| Bez React | React-specific |
| Ogólne zadanie | Komponent-specific |

---

## Setup React Query
```typescript
// main.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/queryClient';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    </React.StrictMode>
);
```

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Wzorce komponentów, lazy loading
- [typescript-standards.md](./typescript-standards.md) - Typy
- [performance.md](./performance.md) - React Query, caching
- [loading-and-error-states.md](./loading-and-error-states.md) - Loading, Error Boundaries
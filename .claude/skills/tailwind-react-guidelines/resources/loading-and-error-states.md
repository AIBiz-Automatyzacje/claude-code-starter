# Stany Ładowania i Błędów

Wzorce dla Vite + React 19 SPA z React Query.

---

## Wybór Wzorca

| Scenariusz | Wzorzec |
|------------|---------|
| Data fetching | React Query + early returns |
| Mutacje | React Query + useOptimistic |
| Ciężkie operacje (filtrowanie) | useTransition |
| Lazy-loaded komponenty | Suspense + fallback |
| Nieoczekiwane błędy | Error Boundary |
| Feedback użytkownika | Toast (Sonner) |

---

## Data Fetching z React Query

### Early Returns (Client Components)
```typescript
function TemplateList() {
    const { data, isLoading, error } = useTemplates();

    if (isLoading) return <TemplateListSkeleton />;
    if (error) return <ErrorMessage error={error} />;
    if (!data?.length) return <EmptyState />;

    return (
        <div className="grid gap-4">
            {data.map(template => (
                <TemplateCard key={template.id} template={template} />
            ))}
        </div>
    );
}
```

**Dlaczego early returns:**
- Jasna kolejność: loading → error → empty → data
- Każdy stan ma dedykowany UI
- TypeScript narrowing - po checkach `data` jest zdefiniowane

### useSuspenseQuery (Preferowane dla nowych komponentów)

Eliminuje potrzebę early returns — data zawsze zdefiniowane:
```typescript
import { useSuspenseQuery } from '@tanstack/react-query';

function TemplateList() {
    const { data } = useSuspenseQuery({
        queryKey: ['templates'],
        queryFn: api.getTemplates,
    });

    // Brak potrzeby: if (isLoading)... if (error)...
    if (!data.length) return <EmptyState />;

    return (
        <div className="grid gap-4">
            {data.map(template => (
                <TemplateCard key={template.id} template={template} />
            ))}
        </div>
    );
}

// Parent obsługuje loading i error:
<ErrorBoundary FallbackComponent={ErrorFallback}>
    <Suspense fallback={<TemplateListSkeleton />}>
        <TemplateList />
    </Suspense>
</ErrorBoundary>
```

**Różnica od early returns:**
- Komponent jest czystszy (tylko logika prezentacji)
- Loading/error obsługiwane przez parent boundaries
- `data` jest zawsze zdefiniowane na poziomie typów
- Granice Suspense mogą być współdzielone między komponentami

### ⚠️ Nie używaj useEffect do fetchingu
```typescript
// ❌ Anty-wzorzec
useEffect(() => {
    setIsLoading(true);
    fetchData().then(setData).finally(() => setIsLoading(false));
}, []);

// ✅ React Query
const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
});
```

---

## Hook `use` (React 19)

React 19 wprowadził `use` do "odpakowywania" Promise w komponencie:
```typescript
import { use, Suspense } from 'react';

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
    const user = use(userPromise); // Suspenduje do resolve
    return <div>{user.name}</div>;
}

// Użycie
<Suspense fallback={<Skeleton />}>
    <UserProfile userPromise={fetchUser(id)} />
</Suspense>
```

### Kiedy `use` vs React Query

| `use` hook | React Query |
|------------|-------------|
| Proste, jednorazowe fetch | Cache, refetch, stale-while-revalidate |
| Brak mutacji | Mutacje z invalidation |
| Komponenty "read-only" | Pełna interaktywność |

**Dla Vite SPA:** React Query pozostaje preferowany - lepszy cache, devtools, retry logic.

---

## Optimistic Updates (React 19)

### useOptimistic - natywny hook
```typescript
import { useOptimistic, useTransition } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function FavoriteButton({ templateId, isFavorite }: Props) {
    const queryClient = useQueryClient();
    const [isPending, startTransition] = useTransition();

    // Optimistic state
    const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(isFavorite);

    const mutation = useMutation({
        mutationFn: () => api.toggleFavorite(templateId),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['templates'] });
        },
    });

    // useOptimistic MUSI być wołane wewnątrz transition/action, nie w onMutate.
    // Await mutateAsync utrzymuje optimistic value do czasu odświeżenia cache.
    const handleToggle = () => {
        startTransition(async () => {
            setOptimisticFavorite(!optimisticFavorite); // Instant UI update
            try {
                await mutation.mutateAsync();
            } catch {
                // Auto-rollback przez React - optimisticFavorite wraca do isFavorite
                toast.error('Nie udało się zapisać');
            }
        });
    };

    return (
        <Button
            variant="ghost"
            onClick={handleToggle}
            disabled={isPending}
        >
            <Heart 
                className={cn(
                    optimisticFavorite && 'fill-red-500 text-red-500'
                )} 
            />
        </Button>
    );
}
```

### Alternatywa: React Query onMutate

Dla prostszych przypadków React Query sam obsługuje optimistic updates:
```typescript
const mutation = useMutation({
    mutationFn: api.toggleFavorite,
    onMutate: async (templateId) => {
        await queryClient.cancelQueries({ queryKey: ['templates'] });
        
        const previous = queryClient.getQueryData(['templates']);
        
        queryClient.setQueryData(['templates'], (old: Template[]) =>
            old.map(t => 
                t.id === templateId 
                    ? { ...t, isFavorite: !t.isFavorite } 
                    : t
            )
        );
        
        return { previous };
    },
    onError: (err, variables, context) => {
        queryClient.setQueryData(['templates'], context?.previous);
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
});
```

**Kiedy który:**
- `useOptimistic` - prosty boolean/number, natywny React
- React Query `onMutate` - kompleksowe cache updates

---

## useTransition dla Ciężkich Operacji

### CPU-bound (filtrowanie, sortowanie)
```typescript
function TemplateSearch() {
    const [query, setQuery] = useState('');
    const [filteredResults, setFilteredResults] = useState<Template[]>([]);
    const [isPending, startTransition] = useTransition();

    const handleSearch = (value: string) => {
        setQuery(value); // Natychmiastowy update inputa
        
        startTransition(() => {
            // Ciężka operacja - nie blokuje UI
            const filtered = templates.filter(t => 
                t.name.toLowerCase().includes(value.toLowerCase()) ||
                t.tags.some(tag => tag.includes(value))
            );
            setFilteredResults(filtered);
        });
    };

    return (
        <>
            <Input 
                value={query} 
                onChange={e => handleSearch(e.target.value)}
            />
            {isPending && <Spinner className="absolute right-2" />}
            <TemplateGrid templates={filteredResults} />
        </>
    );
}
```

### IO-bound (async actions)
```typescript
function DeleteButton({ templateId }: { templateId: string }) {
    const [isPending, startTransition] = useTransition();
    const queryClient = useQueryClient();

    const handleDelete = () => {
        startTransition(async () => {
            await api.deleteTemplate(templateId);
            queryClient.invalidateQueries({ queryKey: ['templates'] });
            toast.success('Szablon usunięty');
        });
    };

    return (
        <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isPending}
        >
            {isPending ? <Spinner /> : <Trash />}
            Usuń
        </Button>
    );
}
```

---

## Loading States dla Przycisków

### Z React Query mutation
```typescript
function SaveButton() {
    const mutation = useCreateTemplate();

    return (
        <Button 
            onClick={() => mutation.mutate(data)}
            disabled={mutation.isPending}
        >
            {mutation.isPending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Zapisywanie...
                </>
            ) : (
                'Zapisz'
            )}
        </Button>
    );
}
```

### Z useTransition
```typescript
function SubmitButton({ onSubmit }: { onSubmit: () => Promise<void> }) {
    const [isPending, startTransition] = useTransition();

    return (
        <Button 
            onClick={() => startTransition(onSubmit)}
            disabled={isPending}
        >
            {isPending ? <Spinner /> : 'Wyślij'}
        </Button>
    );
}
```

### useFormStatus + useActionState (React 19)

`useFormStatus` wymaga `<form action={...}>`. W React 19 używaj razem z `useActionState`:

```typescript
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Wysyłanie...' : 'Wyślij'}
        </Button>
    );
}

function SimpleContactForm() {
    const [state, submitAction, isPending] = useActionState(
        async (_prev: State, formData: FormData) => {
            const result = await api.sendContact(Object.fromEntries(formData));
            return result;
        },
        { error: null }
    );

    return (
        <form action={submitAction}>
            <Input name="name" required />
            <Input name="email" type="email" required />
            {state.error && <p className="text-destructive">{state.error}</p>}
            <SubmitButton />
        </form>
    );
}
```

**Dla złożonych formularzy:** React Hook Form + Zod pozostaje lepszym wyborem (walidacja, DevTools, dynamic fields).

---

## Suspense dla Lazy Components

### ⚠️ Nie używaj early returns dla lazy-loaded
```typescript
// ❌ Błąd - zaburza Suspense
const LazyDashboard = lazy(() => import('./Dashboard'));

function App() {
    const [isReady, setIsReady] = useState(false);
    
    if (!isReady) return <Loading />; // Problem!
    
    return <LazyDashboard />;
}

// ✅ Poprawnie - Suspense obsługuje loading
function App() {
    return (
        <Suspense fallback={<LoadingOverlay />}>
            <LazyDashboard />
        </Suspense>
    );
}
```

### Zagnieżdżone Suspense Boundaries
```typescript
function App() {
    return (
        <Suspense fallback={<AppSkeleton />}>
            <Layout>
                <Suspense fallback={<SidebarSkeleton />}>
                    <Sidebar />
                </Suspense>
                
                <main>
                    <Suspense fallback={<ContentSkeleton />}>
                        <Outlet />
                    </Suspense>
                </main>
            </Layout>
        </Suspense>
    );
}
```

---

## Error Boundaries

### react-error-boundary (Rekomendowane)
```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">Coś poszło nie tak</h2>
            <p className="mt-2 text-sm text-muted-foreground">
                {error.message}
            </p>
            <Button onClick={resetErrorBoundary} className="mt-4">
                Spróbuj ponownie
            </Button>
        </div>
    );
}

// Użycie
<ErrorBoundary 
    FallbackComponent={ErrorFallback}
    onError={(error) => logger.error('Boundary caught:', error)}
    onReset={() => queryClient.clear()}
>
    <App />
</ErrorBoundary>
```

### useErrorBoundary w komponentach
```typescript
import { useErrorBoundary } from 'react-error-boundary';

function DataProcessor() {
    const { showBoundary } = useErrorBoundary();

    const handleProcess = async () => {
        try {
            await processData();
        } catch (error) {
            showBoundary(error); // Propaguje do Error Boundary
        }
    };

    return <Button onClick={handleProcess}>Przetwórz</Button>;
}
```

---

## Toast Notifications (Sonner)

### Podstawowe użycie
```typescript
import { toast } from 'sonner';

// Success
toast.success('Szablon zapisany');

// Error
toast.error('Nie udało się zapisać');

// Z opisem
toast.error('Błąd połączenia', {
    description: 'Sprawdź połączenie internetowe',
});
```

### toast.promise dla async
```typescript
const handleSave = async () => {
    await toast.promise(api.saveTemplate(data), {
        loading: 'Zapisywanie...',
        success: 'Szablon zapisany!',
        error: 'Nie udało się zapisać',
    });
};
```

### Z akcją
```typescript
toast.error('Szablon usunięty', {
    action: {
        label: 'Cofnij',
        onClick: () => api.restoreTemplate(id),
    },
});
```

### Setup (main.tsx)
```typescript
import { Toaster } from 'sonner';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
            <Toaster position="bottom-right" richColors />
        </QueryClientProvider>
    </React.StrictMode>
);
```

---

## Komponenty Skeleton

### Zasady
```typescript
// Skeleton dopasowany do contentu
function TemplateCardSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-3/4" /> {/* Title */}
            </CardHeader>
            <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
            </CardContent>
        </Card>
    );
}

function TemplateListSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <TemplateCardSkeleton key={i} />
            ))}
        </div>
    );
}
```

### Animacja pulse
```typescript
// components/ui/skeleton.tsx (shadcn)
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-md bg-muted', className)}
            {...props}
        />
    );
}
```

---

## Logger dla Produkcji
```typescript
// lib/logger.ts
const isDev = import.meta.env.DEV;

interface LogContext {
    component?: string;
    action?: string;
    [key: string]: unknown;
}

export const logger = {
    error: (message: string, error?: unknown, context?: LogContext) => {
        if (isDev) {
            console.error(message, error, context);
        }
        
        // Production: Sentry, LogRocket, etc.
        // Sentry.captureException(error, { extra: context });
    },
    
    warn: (message: string, context?: LogContext) => {
        if (isDev) {
            console.warn(message, context);
        }
    },
    
    info: (message: string, context?: LogContext) => {
        if (isDev) {
            console.info(message, context);
        }
    },
};
```

### Użycie z Error Boundary
```typescript
<ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error, info) => {
        logger.error('React Error Boundary', error, {
            componentStack: info.componentStack,
        });
    }}
>
    <App />
</ErrorBoundary>
```

---

## Empty States
```typescript
interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            {icon && (
                <div className="text-muted-foreground mb-4">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-medium">{title}</h3>
            {description && (
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

// Użycie
<EmptyState
    icon={<FileX className="h-12 w-12" />}
    title="Brak szablonów"
    description="Utwórz swój pierwszy szablon, aby rozpocząć."
    action={<Button>Utwórz szablon</Button>}
/>
```

---

## Pełny Przykład: Lista z CRUD
```typescript
function TemplateList() {
    const { data, isLoading, error } = useTemplates();
    const deleteMutation = useDeleteTemplate();
    const [isPending, startTransition] = useTransition();

    // Loading
    if (isLoading) return <TemplateListSkeleton />;

    // Error
    if (error) {
        return (
            <EmptyState
                icon={<AlertCircle className="h-12 w-12 text-destructive" />}
                title="Błąd ładowania"
                description={error.message}
                action={
                    <Button onClick={() => window.location.reload()}>
                        Odśwież stronę
                    </Button>
                }
            />
        );
    }

    // Empty
    if (!data?.length) {
        return (
            <EmptyState
                icon={<FileX className="h-12 w-12" />}
                title="Brak szablonów"
                action={<Button>Utwórz szablon</Button>}
            />
        );
    }

    // Data
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map(template => (
                <TemplateCard
                    key={template.id}
                    template={template}
                    onDelete={() => {
                        toast.promise(
                            deleteMutation.mutateAsync(template.id),
                            {
                                loading: 'Usuwanie...',
                                success: 'Szablon usunięty',
                                error: 'Nie udało się usunąć',
                            }
                        );
                    }}
                />
            ))}
        </div>
    );
}
```

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Error Boundary szczegóły
- [performance.md](./performance.md) - React Query, caching
- [file-organization.md](./file-organization.md) - Struktura hooks/
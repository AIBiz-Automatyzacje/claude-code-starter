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

### Hook danych i fabryka kluczy

Komponent nie woła serwisu ani `useQuery` z `queryFn` wprost (sekcja Architektura reguł kodu): dane dostaje z hooka w `src/hooks/`, który woła serwis z `src/services/`. Serwis `templateService` (`src/services/template-service.ts`) jest zbudowany jak `item-service.ts` w [file-organization.md](./file-organization.md) — na kliencie `request()` z limitem czasu, kopertą i `ApiError`.

```typescript
// src/hooks/use-templates.ts
import {
    queryOptions,
    useMutation,
    useQuery,
    useQueryClient,
    useSuspenseQuery,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import { templateService, type TemplateFilters } from '@/services/template-service';

const TEMPLATES_STALE_TIME_MS = 5 * 60 * 1000;

// Jedno źródło kluczy dla zapytań, unieważniania i setQueryData
export const templateKeys = {
    all: ['templates'] as const,
    list: (filters: TemplateFilters) => [...templateKeys.all, 'list', filters] as const,
    detail: (id: string) => [...templateKeys.all, 'detail', id] as const,
};

// Konfiguracja zapytania używana przez useQuery i useSuspenseQuery
export const templateListQuery = queryOptions({
    queryKey: templateKeys.list({}),
    queryFn: ({ signal }) => templateService.list({}, signal),
    staleTime: TEMPLATES_STALE_TIME_MS,
});

export function useTemplates() {
    return useQuery(templateListQuery);
}

export function useTemplatesSuspense() {
    return useSuspenseQuery(templateListQuery);
}

export function useDeleteTemplate() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (templateId: string) => templateService.remove(templateId),
        onSuccess: () => {
            toast.success('Szablon usunięty');
            // Zwracany promise: mutacja kończy się po odświeżeniu listy
            return queryClient.invalidateQueries({ queryKey: templateKeys.all });
        },
        onError: (error) => {
            logger.error('TEMPLATE_DELETE_FAILED', error);
            toast.error('Nie udało się usunąć szablonu');
        },
    });
}
```

Pozostałe hooki mutacji w tym pliku (`useCreateTemplate`, `useSaveTemplate`, `useRestoreTemplate`, `useProcessTemplates`) mają ten sam kształt: `mutationFn` woła `templateService`, `onError` loguje stały kod błędu, unieważnienie wraca jako promise.

### Early Returns (domyślny wzorzec)
```typescript
function TemplateList() {
    const { data, isPending, isError, error } = useTemplates();

    if (isPending) return <TemplateListSkeleton />;
    if (isError) return <ErrorMessage error={error} />;
    if (!data.length) return <EmptyState title="Brak szablonów" />;

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
- TypeScript narrowing - po `isPending` i `isError` typ `data` jest zdefiniowany (przy `isLoading` nie: wyłączone zapytanie ma `isLoading: false` i brak danych)

### useSuspenseQuery (widok z Suspense i Error Boundary nad sobą)

Domyślnie widok używa `useQuery` z gałęziami ładowanie → błąd → pusto → dane (sekcja wyżej). `useSuspenseQuery` wybierasz, gdy nad widokiem stoją już `Suspense` i Error Boundary — wtedy znika gałąź ładowania i błędu, a `data` jest zawsze zdefiniowane. Bez tych granic zawieszenie albo błąd wychodzą do najbliższej granicy wyżej i zasłaniają większą część ekranu.
```typescript
import { useTemplatesSuspense } from '@/hooks/use-templates';

function TemplateList() {
    const { data } = useTemplatesSuspense();

    // Brak potrzeby: if (isPending)... if (isError)...
    if (!data.length) return <EmptyState title="Brak szablonów" />;

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

### Nie używaj useEffect do fetchingu
```typescript
// ❌ Anty-wzorzec
useEffect(() => {
    setIsLoading(true);
    fetchData().then(setData).finally(() => setIsLoading(false));
}, []);

// ✅ React Query przez hook (src/hooks/use-templates.ts, sekcja wyżej)
const { data, isPending } = useTemplates();
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

// ❌ Promise tworzony w renderze: każdy render daje nowy obiekt, więc komponent zawiesza się w kółko
<UserProfile userPromise={fetchUser(id)} />
```

Promise dla `use` powstaje raz, poza renderem komponentu, który go odpakowuje, i jest stabilny między renderami. W tym stacku daje go cache React Query przez hook:

```typescript
// src/hooks/use-user-promise.ts
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { userService } from '@/services/user-service';
import type { User } from '@/types/user';

export const userKeys = {
    all: ['users'] as const,
    detail: (id: string) => [...userKeys.all, 'detail', id] as const,
};

export function useUserPromise(userId: string): Promise<User> {
    const queryClient = useQueryClient();
    // Inicjalizator useState działa raz na montowanie; nowy userId daje nowe montowanie przez `key`
    const [userPromise] = useState(() =>
        queryClient.fetchQuery({
            queryKey: userKeys.detail(userId),
            queryFn: ({ signal }) => userService.get(userId, signal),
        }),
    );
    return userPromise;
}

// Użycie: odrzucony promise trafia z `use` do najbliższego Error Boundary
function UserSection({ userId }: { userId: string }) {
    const userPromise = useUserPromise(userId);

    return (
        <Suspense fallback={<Skeleton className="h-6 w-40" />}>
            <UserProfile userPromise={userPromise} />
        </Suspense>
    );
}

// Rodzic: <UserSection key={userId} userId={userId} />
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
// src/hooks/use-toggle-favorite.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { templateKeys } from '@/hooks/use-templates';
import { logger } from '@/lib/logger';
import { templateService } from '@/services/template-service';

export function useToggleFavorite(templateId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => templateService.toggleFavorite(templateId),
        onError: (error) => {
            logger.error('FAVORITE_TOGGLE_FAILED', error);
            toast.error('Nie udało się zapisać');
        },
        // Zwracany promise: mutateAsync kończy się dopiero po odświeżeniu źródła prawdy
        onSettled: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
    });
}
```
```typescript
// src/components/favorite-button.tsx
import { useOptimistic, useTransition } from 'react';

import { useToggleFavorite } from '@/hooks/use-toggle-favorite';
import { logger } from '@/lib/logger';

interface FavoriteButtonProps {
    templateId: string;
    isFavorite: boolean;
}

export function FavoriteButton({ templateId, isFavorite }: FavoriteButtonProps) {
    const [isPending, startTransition] = useTransition();
    const toggleFavorite = useToggleFavorite(templateId);

    // Optimistic state
    const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(isFavorite);

    // setOptimisticFavorite wołasz wewnątrz transition (nie w onMutate): wartość optymistyczna
    // trwa, dopóki trwa transition. mutateAsync czeka na promise z onSettled, więc transition
    // kończy się po odświeżeniu cache, a nowy `isFavorite` z rodzica zastępuje wartość optymistyczną.
    const handleToggle = () => {
        startTransition(async () => {
            setOptimisticFavorite(!optimisticFavorite); // Instant UI update
            try {
                await toggleFavorite.mutateAsync();
            } catch (error) {
                // Zdarzenie błędu wysłał już onError hooka (log + toast); React cofa wartość
                // optymistyczną do isFavorite. Złapanie odrzucenia zatrzymuje je przed Error Boundary,
                // a ślad wycofania z przyczyną zostaje w logu bez drugiego zdarzenia Sentry.
                logger.info('FAVORITE_OPTIMISTIC_ROLLBACK', { templateId, error });
            }
        });
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label="Ulubiony"
            aria-pressed={optimisticFavorite}
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

Dla prostszych przypadków React Query sam obsługuje optimistic updates w cache:
```typescript
// src/hooks/use-toggle-favorite-in-cache.ts
export function useToggleFavoriteInCache() {
    const queryClient = useQueryClient();
    const listKey = templateKeys.list({});

    return useMutation({
        mutationFn: (templateId: string) => templateService.toggleFavorite(templateId),
        onMutate: async (templateId) => {
            await queryClient.cancelQueries({ queryKey: templateKeys.all });

            const previous = queryClient.getQueryData<Template[]>(listKey);

            // old jest undefined, gdy lista nie trafiła jeszcze do cache
            queryClient.setQueryData<Template[]>(listKey, (old) =>
                old?.map(t =>
                    t.id === templateId
                        ? { ...t, isFavorite: !t.isFavorite }
                        : t
                )
            );

            return { previous };
        },
        onError: (error, _templateId, context) => {
            logger.error('FAVORITE_TOGGLE_FAILED', error);
            queryClient.setQueryData(listKey, context?.previous);
            toast.error('Nie udało się zapisać');
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
    });
}
```

**Kiedy który:**
- `useOptimistic` - prosty boolean/number, natywny React
- React Query `onMutate` - kompleksowe cache updates

---

## useTransition dla Ciężkich Operacji

### CPU-bound (filtrowanie, sortowanie)
```typescript
function TemplateSearch({ templates }: { templates: Template[] }) {
    const [query, setQuery] = useState('');
    const [filteredResults, setFilteredResults] = useState(templates);
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
            <div className="relative">
                <Input 
                    aria-label="Szukaj szablonów"
                    value={query} 
                    onChange={e => handleSearch(e.target.value)}
                />
                {isPending && <Spinner className="absolute right-2 top-1/2 -translate-y-1/2" />}
            </div>
            <TemplateGrid templates={filteredResults} />
        </>
    );
}
```

### IO-bound (async actions)

Operacja sieciowa idzie przez mutację z hooka (`useDeleteTemplate` z sekcji Hook danych), a stan oczekiwania daje `isPending` mutacji. `useTransition` z funkcją async zostaw dla akcji spoza React Query (np. `useActionState`), bo dwa źródła stanu oczekiwania dla jednej operacji rozjeżdżają się. Usunięcia nie da się cofnąć, więc przycisk pyta o potwierdzenie (AlertDialog z shadcn/ui):

```typescript
// src/components/delete-template-button.tsx
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useDeleteTemplate } from '@/hooks/use-templates';

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
    const deleteTemplate = useDeleteTemplate();

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleteTemplate.isPending}>
                    {deleteTemplate.isPending ? <Spinner /> : <Trash />}
                    Usuń
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Usunąć szablon?</AlertDialogTitle>
                    <AlertDialogDescription>Tej operacji nie można cofnąć.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteTemplate.mutate(templateId)}>
                        Usuń
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
```

---

## Loading States dla Przycisków

### Z React Query mutation
```typescript
function SaveButton({ data }: { data: TemplateInput }) {
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

Dla akcji spoza React Query. `onSubmit` sam obsługuje swój błąd (log z kodem i komunikat); odrzucenie, które wyjdzie z akcji w transition, React przekazuje do najbliższego Error Boundary.
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

`useFormStatus` wymaga `<form action={...}>`. W React 19 używaj razem z `useActionState`. Akcja stoi w hooku (komponent nie woła serwisu), dane z `FormData` parsuje schemat Zod, a stan formularza to unia dyskryminowana zamiast pary flag:

```typescript
// src/hooks/use-simple-contact-action.ts
import { useActionState } from 'react';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { contactService } from '@/services/contact-service';

const simpleContactSchema = z.strictObject({
    name: z.string().min(2).max(100),
    email: z.email(),
});

export type SimpleContactState =
    | { status: 'idle' }
    | { status: 'success' }
    | { status: 'error'; message: string };

const INITIAL_STATE: SimpleContactState = { status: 'idle' };

async function submitSimpleContact(
    _prev: SimpleContactState,
    formData: FormData,
): Promise<SimpleContactState> {
    const parsed = simpleContactSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
        return { status: 'error', message: 'Popraw imię i adres e-mail.' };
    }

    try {
        await contactService.send(parsed.data);
        return { status: 'success' };
    } catch (error) {
        logger.error('CONTACT_SEND_FAILED', error);
        return { status: 'error', message: 'Nie udało się wysłać wiadomości.' };
    }
}

export function useSimpleContactAction() {
    return useActionState(submitSimpleContact, INITIAL_STATE);
}
```
```typescript
// src/components/simple-contact-form.tsx
import { useFormStatus } from 'react-dom';

import { useSimpleContactAction } from '@/hooks/use-simple-contact-action';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Wysyłanie...' : 'Wyślij'}
        </Button>
    );
}

export function SimpleContactForm() {
    const [state, submitAction] = useSimpleContactAction();

    return (
        <form action={submitAction}>
            <Input name="name" aria-label="Imię" required />
            <Input name="email" type="email" aria-label="E-mail" required />
            {state.status === 'error' && (
                <p role="alert" className="text-destructive">{state.message}</p>
            )}
            {state.status === 'success' && <p role="status">Wiadomość wysłana.</p>}
            <SubmitButton />
        </form>
    );
}
```

**Dla złożonych formularzy:** React Hook Form + Zod pozostaje lepszym wyborem (walidacja, DevTools, dynamic fields).

---

## Suspense dla Lazy Components

### Nie używaj early returns dla lazy-loaded
```typescript
// ❌ Błąd - zaburza Suspense
const LazyDashboard = lazy(() => import('@/pages/dashboard-page')); // strona z default exportem

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
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

import { logger } from '@/lib/logger';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div role="alert" className="p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">Coś poszło nie tak</h2>
            <p className="mt-2 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Nieznany błąd'}
            </p>
            <Button onClick={resetErrorBoundary} className="mt-4">
                Spróbuj ponownie
            </Button>
        </div>
    );
}

// Użycie: stały kod błędu jako komunikat logu, błąd jako drugi argument
<ErrorBoundary 
    FallbackComponent={ErrorFallback}
    onError={(error) => logger.error('UI_BOUNDARY', error)}
    onReset={() => queryClient.clear()}
>
    <App />
</ErrorBoundary>
```

### useErrorBoundary w komponentach
```typescript
import { useErrorBoundary } from 'react-error-boundary';

import { useProcessTemplates } from '@/hooks/use-templates';

function DataProcessor() {
    const { showBoundary } = useErrorBoundary();
    const processTemplates = useProcessTemplates();

    const handleProcess = async () => {
        try {
            await processTemplates.mutateAsync();
        } catch (error) {
            showBoundary(error); // Propaguje do Error Boundary, które loguje błąd w onError
        }
    };

    return <Button onClick={() => void handleProcess()}>Przetwórz</Button>;
}
```

Ten sam efekt bez `try/catch` daje opcja mutacji `throwOnError: true` w hooku — React Query przekazuje wtedy błąd do Error Boundary sam.

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
// useSaveTemplate: hook z useMutation → templateService.save, onError loguje
// TEMPLATE_SAVE_FAILED; komunikat dla użytkownika daje tu toast.promise, więc hook nie dokłada toastu
const saveTemplate = useSaveTemplate();

const handleSave = (data: TemplateInput) => {
    toast.promise(saveTemplate.mutateAsync(data), {
        loading: 'Zapisywanie...',
        success: 'Szablon zapisany!',
        error: 'Nie udało się zapisać',
    });
};
```

`toast.promise` w Sonner v2 zwraca obiekt z `unwrap()`, nie promise, więc `await toast.promise(...)` nie czeka na operację (wersję sonner sprawdzasz w package.json). Kod, który ma czekać na wynik, czeka na `toast.promise(...).unwrap()` albo na sam `mutateAsync` i obsługuje jego odrzucenie.

### Z akcją
```typescript
// useRestoreTemplate: hook z useMutation → templateService.restore, onError z logiem TEMPLATE_RESTORE_FAILED
const restoreTemplate = useRestoreTemplate();

toast('Szablon usunięty', {
    action: {
        label: 'Cofnij',
        onClick: () => restoreTemplate.mutate(id),
    },
});
```

### Setup

`<Toaster>` stoi w drzewie raz, obok providerów w `app.tsx` (pełny plik w [file-organization.md](./file-organization.md), sekcja Routing):

```typescript
// src/app.tsx — fragment
import { Toaster } from 'sonner';

<QueryClientProvider client={queryClient}>
    <BrowserRouter>
        {/* ...trasy */}
        <Toaster position="bottom-right" richColors />
    </BrowserRouter>
</QueryClientProvider>
```

`main.tsx` renderuje samo `<App />` po zawężeniu elementu `#root` (`if (!rootElement) throw new BootstrapError('ROOT_MISSING')` zamiast `!`) — plik w file-organization.md, sekcja Setup React Query.

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

const TEMPLATE_SKELETON_COUNT = 6;

function TemplateListSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: TEMPLATE_SKELETON_COUNT }).map((_, i) => (
                <TemplateCardSkeleton key={i} />
            ))}
        </div>
    );
}
```

### Animacja pulse
```typescript
// components/ui/skeleton.tsx (shadcn)
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
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

Logger aplikacji (`src/lib/logger.ts`) definiuje skill sentry-integration: [react-sentry-patterns.md, sekcja Logger Integration](../../sentry-integration/resources/react-sentry-patterns.md#logger-integration). Ten plik go nie powtarza, bo dwie definicje loggera rozjeżdżają się po cichu — tamta w produkcji wysyła zdarzenie do Sentry, a wersja tylko z `console.*` nie zostawia operatorowi żadnego śladu.

API, którego używają przykłady w tym skillu:

```typescript
import { logger } from '@/lib/logger';

// Błąd nieoczekiwany: stały kod w UPPER_SNAKE_CASE jako komunikat, błąd jako drugi argument
logger.error('TEMPLATE_CREATE_FAILED', error);

// Oczekiwana odmowa (walidacja, 4xx z kodem biznesowym): bez zdarzenia błędu w Sentry
logger.info('TEMPLATE_NAME_TAKEN', { status: 409 });
```

Komunikat to kod błędu, nie tekst z danymi użytkownika — sekretów i danych osobowych nie logujesz (sekcja Bezpieczeństwo reguł kodu).

### Użycie z Error Boundary
```typescript
<ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error) => logger.error('UI_BOUNDARY', error)}
>
    <App />
</ErrorBoundary>
```

Stos komponentów przy błędzie renderu dołącza do zdarzenia integracja Sentry z Reactem (`Sentry.ErrorBoundary` albo `reactErrorHandler()`, ten sam plik skilla sentry-integration).

---

## Empty States

`EmptyState` ma jedno API we wszystkich plikach skilli UI: `{ title, description?, action? }`.
```typescript
// src/components/empty-state.tsx
interface EmptyStateProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
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
    title="Brak szablonów"
    description="Utwórz swój pierwszy szablon, aby rozpocząć."
    action={<Button>Utwórz szablon</Button>}
/>
```

---

## Pełny Przykład: Lista z CRUD
```typescript
import { DeleteTemplateButton } from '@/components/delete-template-button';
import { EmptyState } from '@/components/empty-state';
import { useTemplates } from '@/hooks/use-templates';

function TemplateList() {
    const { data, isPending, isError, refetch } = useTemplates();

    // Loading
    if (isPending) return <TemplateListSkeleton />;

    // Error
    if (isError) {
        return (
            <div role="alert">
                <EmptyState
                    title="Błąd ładowania"
                    description="Nie udało się pobrać szablonów."
                    action={
                        <Button onClick={() => void refetch()}>
                            Spróbuj ponownie
                        </Button>
                    }
                />
            </div>
        );
    }

    // Empty
    if (!data.length) {
        return (
            <EmptyState
                title="Brak szablonów"
                action={<Button>Utwórz szablon</Button>}
            />
        );
    }

    // Data — usuwanie przez przycisk z potwierdzeniem; hook useDeleteTemplate loguje błąd,
    // pokazuje toast i unieważnia listę (sekcje Hook danych i IO-bound)
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map(template => (
                <TemplateCard
                    key={template.id}
                    template={template}
                    actions={<DeleteTemplateButton templateId={template.id} />}
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
- [file-organization.md](./file-organization.md) - Struktura hooks/ i services/, klient `request()`, `ApiError`
- [react-sentry-patterns.md](../../sentry-integration/resources/react-sentry-patterns.md#logger-integration) - Definicja `lib/logger.ts`
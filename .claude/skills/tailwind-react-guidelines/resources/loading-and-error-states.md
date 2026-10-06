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

Hooki szablonów mają jeden plik, `src/hooks/use-templates.ts`. Fabrykę kluczy `templateKeys`, `TEMPLATES_STALE_TIME_MS`, `templateListOptions(filters)`, `useTemplates(filters = {})`, `useSuspenseTemplates(filters = {})` i `useTemplate(id)` definiuje [performance.md](./performance.md#react-query-rekomendowane-dla-spa), a `useCreateTemplate` i `useUpdateTemplate` — [forms.md](./forms.md#integracja-z-react-query). Ten plik dokłada do tego samego modułu mutację usuwania:

```typescript
// src/hooks/use-templates.ts (cd.) — templateKeys stoi wyżej w tym samym pliku
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import { templateService } from '@/services/template-service';

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

Pozostałe hooki mutacji w tym module (`useCreateTemplate` i `useUpdateTemplate` z forms.md oraz `useSaveTemplate`, `useRestoreTemplate`, `useProcessTemplates` z przykładów niżej) mają ten sam kształt: `mutationFn` woła `templateService`, `onError` loguje stały kod błędu, unieważnienie wraca jako promise.

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
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { EmptyState } from '@/components/empty-state';
import { ErrorFallback } from '@/components/error-fallback';
import { TemplateCard } from '@/components/template-card';
import { TemplateListSkeleton } from '@/components/template-list-skeleton';
import { useSuspenseTemplates } from '@/hooks/use-templates';
import { logger } from '@/lib/logger';

function TemplateList() {
    const { data } = useSuspenseTemplates();

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

// Parent obsługuje loading i error; reset z QueryErrorResetBoundary ponawia zapytanie
// (ErrorFallback i ten układ granic: component-patterns.md, sekcja Error Boundaries)
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
// src/components/user-profile.tsx
import { use } from 'react';

import type { User } from '@/schemas/user';

export function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
    const user = use(userPromise); // Suspenduje do resolve
    return <div>{user.name}</div>;
}

// ❌ Promise tworzony w renderze (fetchUser — dowolna funkcja zwracająca promise): każdy render
// daje nowy obiekt, więc komponent zawiesza się w kółko
<UserProfile userPromise={fetchUser(id)} />
```

Promise dla `use` powstaje raz, poza renderem komponentu, który go odpakowuje, i jest stabilny między renderami. W tym stacku daje go cache React Query przez hook:

```typescript
// src/hooks/use-user-promise.ts
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { User } from '@/schemas/user';
import { userService } from '@/services/user-service';

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
```
```typescript
// src/components/user-section.tsx
import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { UserProfile } from '@/components/user-profile';
import { useUserPromise } from '@/hooks/use-user-promise';

// Odrzucony promise trafia z `use` do najbliższego Error Boundary
export function UserSection({ userId }: { userId: string }) {
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

`useToggleFavorite` i `FavoriteButton` mają w projekcie jedną definicję — tę. performance.md i component-ux.md (skill ux-ui-guidelines) importują je z `@/hooks/use-toggle-favorite` i `@/components/favorite-button`, zamiast definiować własne.
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
            toast.error('Nie udało się zapisać ulubionych');
        },
        // Zwracany promise: mutateAsync kończy się dopiero po odświeżeniu źródła prawdy
        onSettled: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
    });
}
```
```typescript
// src/components/favorite-button.tsx
import { Heart } from 'lucide-react';
import { useOptimistic, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useToggleFavorite } from '@/hooks/use-toggle-favorite';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

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
            // size="icon" ma 36 px; na ekranie dotykowym cel rośnie do 44 px (accessibility.md, Rozmiar celu)
            className="pointer-coarse:size-11"
            aria-label={optimisticFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            aria-pressed={optimisticFavorite}
            onClick={handleToggle}
            disabled={isPending}
        >
            <Heart
                aria-hidden="true"
                className={cn(
                    "h-5 w-5 transition-colors",
                    optimisticFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                )}
            />
        </Button>
    );
}
```

`aria-pressed` mówi czytnikowi ekranu, czy przełącznik jest włączony, a `aria-label` — co zrobi kliknięcie; ikona jest ukryta przed czytnikiem, bo nazwę daje etykieta.

### Alternatywa: React Query onMutate

Dla prostszych przypadków React Query sam obsługuje optimistic updates w cache:
```typescript
// src/hooks/use-toggle-favorite-in-cache.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { templateKeys } from '@/hooks/use-templates';
import { logger } from '@/lib/logger';
import type { Template } from '@/schemas/template-schema';
import { templateService } from '@/services/template-service';

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
            toast.error('Nie udało się zapisać ulubionych');
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

W stanie trzymasz frazę, nie przefiltrowaną listę: kopia `templates` w `useState` zostaje przy starych danych, gdy rodzic dostanie nowe po refetchu albo unieważnieniu cache. Transition odracza tylko zastosowanie frazy, a lista liczy się w renderze z aktualnych propsów — ten sam wzorzec co `FilterableList` w [performance.md](./performance.md#usetransition---non-blocking-updates).
```typescript
import { useState, useTransition } from 'react';

import { TemplateGrid } from '@/components/template-grid';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import type { Template } from '@/schemas/template-schema';

function filterTemplates(templates: Template[], query: string): Template[] {
    const normalizedQuery = query.toLowerCase();
    return templates.filter((template) =>
        template.name.toLowerCase().includes(normalizedQuery) ||
        template.tags.some((tag) => tag.includes(normalizedQuery))
    );
}

function TemplateSearch({ templates }: { templates: Template[] }) {
    const [query, setQuery] = useState('');
    const [appliedQuery, setAppliedQuery] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleSearch = (value: string) => {
        setQuery(value); // Natychmiastowy update inputa

        // Ciężki render listy z nową frazą — odroczony, nie blokuje wpisywania
        startTransition(() => {
            setAppliedQuery(value);
        });
    };

    // Lista z aktualnych propsów i zastosowanej frazy; bez kopii templates w stanie
    const filteredTemplates = filterTemplates(templates, appliedQuery);

    return (
        <>
            <div className="relative">
                <Input
                    aria-label="Szukaj szablonów"
                    value={query}
                    onChange={(event) => handleSearch(event.target.value)}
                />
                {isPending && <Spinner className="absolute right-2 top-1/2 -translate-y-1/2" />}
            </div>
            <TemplateGrid templates={filteredTemplates} />
        </>
    );
}
```

Ten sam efekt bez transition daje `useDeferredValue(query)` — przykład w performance.md, sekcja useDeferredValue.

### IO-bound (async actions)

Operacja sieciowa idzie przez mutację z hooka (`useDeleteTemplate` z sekcji Hook danych), a stan oczekiwania daje `isPending` mutacji. `useTransition` z funkcją async zostaw dla akcji spoza React Query (np. `useActionState`), bo dwa źródła stanu oczekiwania dla jednej operacji rozjeżdżają się. Usunięcia nie da się cofnąć, więc przycisk pyta o potwierdzenie. Potwierdzenie stoi na `AlertDialog` z shadcn/ui (rola `alertdialog`, nie zamyka się kliknięciem w tło), tak jak kanoniczny `ConfirmDialog` z hookiem `useConfirm` (`@/contexts/confirm-context`) w [component-ux.md](../../ux-ui-guidelines/resources/component-ux.md#useconfirm-hook). Gdy projekt ma `ConfirmProvider`, przycisk woła `const confirm = useConfirm()` i `if (await confirm({...})) deleteTemplate.mutate(templateId)`; przykład niżej pokazuje ten sam dialog bez providera, złożony wprost z części `AlertDialog`:

```typescript
// src/components/delete-template-button.tsx
import { Trash } from 'lucide-react';

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
import { Spinner } from '@/components/ui/spinner';
import { useDeleteTemplate } from '@/hooks/use-templates';

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
    const deleteTemplate = useDeleteTemplate();

    return (
        <AlertDialog>
            {/* asChild — API Radix; components.json ma styl Radix (styling-guide.md, components.json) */}
            <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleteTemplate.isPending}>
                    {deleteTemplate.isPending ? <Spinner /> : <Trash aria-hidden="true" />}
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
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCreateTemplate } from '@/hooks/use-templates';
import type { TemplateValues } from '@/schemas/template-schema';

function SaveButton({ values }: { values: TemplateValues }) {
    const mutation = useCreateTemplate();

    return (
        <Button 
            onClick={() => mutation.mutate(values)}
            disabled={mutation.isPending}
        >
            {mutation.isPending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Zapisywanie...
                </>
            ) : (
                'Zapisz'
            )}
        </Button>
    );
}
```

### Z useTransition — `AsyncButton`

Dla akcji spoza React Query (kopiowanie do schowka, eksport pliku) projekt ma jeden przycisk: `AsyncButton` z [component-ux.md](../../ux-ui-guidelines/resources/component-ux.md#button-z-usetransition) (`src/components/async-button.tsx`). Łapie błąd wewnątrz transition i loguje go ze stałym kodem z propsa `errorCode`, bo odrzucony promise w `startTransition` trafiłby do najbliższego Error Boundary i zamienił ekran w stan błędu; ma też `aria-busy`, widoczny fokus i cel 44 px na ekranie dotykowym (`pointer-coarse:min-h-11`). Mutacji z hooka React Query mu nie przekazujesz — hook już loguje błąd w `onError`, więc wystarcza `mutate` + `isPending` z sekcji wyżej.
```typescript
import { AsyncButton } from '@/components/async-button';

<AsyncButton onClick={exportReport} errorCode="REPORT_EXPORT_FAILED">
    Eksportuj
</AsyncButton>
```

### useFormStatus + useActionState (React 19)

`useFormStatus` wymaga `<form action={...}>`. W React 19 używaj razem z `useActionState`. Akcja stoi w hooku (komponent nie woła serwisu), dane z `FormData` parsuje schemat Zod, a stan formularza to unia dyskryminowana zamiast pary flag. Formularz wysyła te same dane co `ContactForm` z [forms.md](./forms.md#podstawowy-formularz) — imię, e-mail i wiadomość — więc akcja parsuje je tym samym `contactSchema` i woła `contactService.send` z pełnym `ContactValues`. Wzorzec jest ten sam co `NewsletterForm` z [component-ux.md](../../ux-ui-guidelines/resources/component-ux.md#formularz-bez-react-query--akcja-w-hooku): stan błędu niesie wpisane wartości, bo React 19 po akcji resetuje niekontrolowane pola, a region `role="status"` jest w DOM od początku.

```typescript
// src/hooks/use-contact-action.ts
import { useActionState } from 'react';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { contactSchema } from '@/schemas/contact-schema';
import { contactService } from '@/services/contact-service';

// Wpisane wartości do odtworzenia pól; .catch('') daje pusty tekst dla brakującego pola
const contactDraftSchema = z.object({
    name: z.string().catch(''),
    email: z.string().catch(''),
    message: z.string().catch(''),
});
export type ContactDraft = z.infer<typeof contactDraftSchema>;

export type ContactActionState =
    | { status: 'idle' }
    | { status: 'success' }
    | { status: 'error'; message: string; draft: ContactDraft };

const INITIAL_CONTACT_ACTION_STATE: ContactActionState = { status: 'idle' };

async function submitContact(
    _previous: ContactActionState,
    formData: FormData,
): Promise<ContactActionState> {
    const fields = Object.fromEntries(formData);
    const draft = contactDraftSchema.parse(fields);
    const parsed = contactSchema.safeParse(fields);
    if (!parsed.success) {
        return { status: 'error', message: 'Popraw imię, adres e-mail i wiadomość.', draft };
    }

    try {
        await contactService.send(parsed.data);
        return { status: 'success' };
    } catch (error) {
        logger.error('CONTACT_SEND_FAILED', error);
        return { status: 'error', message: 'Nie udało się wysłać wiadomości.', draft };
    }
}

export function useContactAction() {
    return useActionState(submitContact, INITIAL_CONTACT_ACTION_STATE);
}
```
```typescript
// src/components/contact-action-form.tsx
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useContactAction } from '@/hooks/use-contact-action';

// Przycisk z useFormStatus czyta stan formularza, w którym stoi; nazwa odróżnia go od AsyncButton
function FormSubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="pointer-coarse:min-h-11">
            {pending ? 'Wysyłanie...' : 'Wyślij'}
        </Button>
    );
}

export function ContactActionForm() {
    const [state, submitAction] = useContactAction();
    const draft = state.status === 'error' ? state.draft : undefined;

    return (
        <form action={submitAction} className="space-y-2">
            <Input name="name" aria-label="Imię" required defaultValue={draft?.name ?? ''} />
            <Input name="email" type="email" aria-label="E-mail" required defaultValue={draft?.email ?? ''} />
            <Textarea name="message" aria-label="Wiadomość" required defaultValue={draft?.message ?? ''} />
            {state.status === 'error' && (
                <p role="alert" className="text-sm text-destructive">{state.message}</p>
            )}
            {/* Region status w DOM od początku; zmienia się tylko treść */}
            <p role="status" className="text-sm">
                {state.status === 'success' && 'Wiadomość wysłana.'}
            </p>
            <FormSubmitButton />
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

`ErrorFallback` (`src/components/error-fallback.tsx`) ma jedną definicję w [component-patterns.md](./component-patterns.md#error-boundaries): ogólny komunikat dla użytkownika, treść błędu tylko w trybie deweloperskim i przycisk „Spróbuj ponownie”. Każde `<ErrorBoundary>` ma `onError` z kodem `UI_BOUNDARY`, a ponowienie idzie przez `reset` z `QueryErrorResetBoundary` — zapytanie, które rzuciło do granicy, pobiera dane od nowa, a reszta cache zostaje (`queryClient.clear()` w `onReset` wyczyściłby dane całej aplikacji).
```typescript
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

import { ErrorFallback } from '@/components/error-fallback';
import { logger } from '@/lib/logger';

// Użycie: stały kod błędu jako komunikat logu, błąd jako drugi argument
<QueryErrorResetBoundary>
    {({ reset }) => (
        <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onError={(error) => logger.error('UI_BOUNDARY', error)}
            onReset={reset}
        >
            <App />
        </ErrorBoundary>
    )}
</QueryErrorResetBoundary>
```

### useErrorBoundary w komponentach
```typescript
import { useErrorBoundary } from 'react-error-boundary';

import { Button } from '@/components/ui/button';
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

const handleSave = (values: TemplateValues) => {
    toast.promise(saveTemplate.mutateAsync(values), {
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
// Pełny układ z QueryErrorResetBoundary — sekcja Error Boundaries wyżej
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

`EmptyState` ma jedno API we wszystkich plikach skilli UI: `{ title, description?, action? }`. Komponent (`src/components/empty-state.tsx`) definiuje [component-ux.md](../../ux-ui-guidelines/resources/component-ux.md#empty-states) — ten plik go importuje, bo dwie definicje z tym samym API rozjeżdżają się wyglądem. Tytuł mówi, co się stało, opis — co użytkownik może zrobić, akcja — następny krok.
```typescript
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

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
import { TemplateCard } from '@/components/template-card';
import { TemplateListSkeleton } from '@/components/template-list-skeleton';
import { Button } from '@/components/ui/button';
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
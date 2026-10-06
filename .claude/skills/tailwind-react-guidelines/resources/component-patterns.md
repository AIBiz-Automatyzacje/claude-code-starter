# Wzorce Komponentów

Architektura komponentów React 19 - TypeScript, lazy loading, Suspense, Error Boundaries.

---

## Podstawowy Wzorzec Komponentu

### React 19 - Funkcje z typowanymi props
```typescript
interface MyComponentProps {
    /** ID użytkownika */
    userId: string;
    /** Opcjonalny callback */
    onAction?: () => void;
}

export function MyComponent({ userId, onAction }: MyComponentProps) {
    return (
        <div className="flex items-center gap-2 p-4">
            User: {userId}
            {onAction && <Button onClick={onAction}>Akcja</Button>}
        </div>
    );
}
```

**Kluczowe punkty:**
- Props interface z JSDoc comments
- Bezpośrednie typowanie props (bez `React.FC`)
- Typ zwracany komponentu wynika z JSX — nie dopisujesz go ręcznie (coding-rules, Type safety)
- Named export; default export tylko dla strony ładowanej przez `lazy()` (sekcja „Wzorzec Eksportu”)

### Alternatywa: React.FC

`React.FC` nadal działa, ale jest opcjonalny:
```typescript
// Też poprawne, ale mniej preferowane
export const MyComponent: React.FC<MyComponentProps> = ({ userId }) => {
    return <div>{userId}</div>;
};
```

**Dlaczego funkcje bez FC:**
- Prostsze
- Lepsze dla Generic Components
- Brak historycznych problemów z `children`

---

## Pełny Szablon Komponentu

Komponent nie woła serwisu ani API wprost: zapis idzie przez hook z `src/hooks/`, który owija `useMutation`, woła serwis z `src/services/` i zostawia ślad błędu w loggerze (`src/lib/logger.ts` ze skilla sentry-integration) z kodem błędu.
```typescript
// src/hooks/use-save-entity.ts
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import { entityService } from '@/services/entity-service';

export function useSaveEntity(entityId: string) {
    return useMutation({
        mutationFn: () => entityService.save(entityId),
        onError: (error) => {
            logger.error('ENTITY_SAVE_FAILED', error);
            toast.error('Nie udało się zapisać');
        },
    });
}
```
```typescript
// src/components/my-component.tsx
/**
 * Opis komponentu - co robi, kiedy używać
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSaveEntity } from '@/hooks/use-save-entity';

// 1. PROPS INTERFACE
interface MyComponentProps {
    /** ID encji */
    entityId: string;
    /** Callback gdy akcja się zakończy */
    onComplete?: () => void;
    /** Tryb wyświetlania */
    mode?: 'view' | 'edit';
    /** Ref do kontenera (React 19 - zwykły prop) */
    ref?: React.Ref<HTMLDivElement>;
}

// 2. KOMPONENT
export function MyComponent({
    entityId,
    onComplete,
    mode = 'view',
    ref,
}: MyComponentProps) {
    // 3. HOOKS
    const saveEntity = useSaveEntity(entityId);
    const [isEditing, setIsEditing] = useState(mode === 'edit');

    // 4. HANDLERS
    // Z React Compilerem (babel-plugin-react-compiler w package.json) — zwykłe funkcje, kompilator memoizuje.
    // Bez Compilera — useCallback tylko dla handlera przekazywanego do dziecka w memo() albo funkcji,
    // która jest zależnością efektu.
    // Handler jest synchroniczny: mutate nie zwraca promise, a błąd obsługuje onError w hooku.
    const handleSave = () => {
        saveEntity.mutate(undefined, {
            onSuccess: () => {
                setIsEditing(false);
                toast.success('Zapisano pomyślnie');
                onComplete?.();
            },
        });
    };

    // 5. RENDER
    return (
        <Card ref={ref}>
            <CardHeader>
                <CardTitle>Mój Komponent</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {isEditing ? (
                    <Button onClick={handleSave} disabled={saveEntity.isPending}>
                        Zapisz
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                        Edytuj
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
```

---

## React 19: Ref jako Prop

W React 19 `forwardRef` **nie jest potrzebny** (React zapowiada oznaczenie go jako przestarzałego; czy Twoja wersja ostrzega, sprawdzasz w package.json i changelogu Reacta). Ref to zwykły prop. Etykietę i komunikat błędu wiążesz z polem przez `id` z `useId`, żeby czytnik ekranu odczytał je razem z polem:
```typescript
// React 19 - ref w interfejsie props
import { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    ref?: React.Ref<HTMLInputElement>;
}

export function Input({ 
    label, 
    error, 
    ref,
    id,
    className,
    ...props 
}: InputProps) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
        <div className="flex flex-col gap-1">
            {label && <label htmlFor={inputId} className="text-sm font-medium">{label}</label>}
            <input
                ref={ref}
                id={inputId}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    "px-3 py-2 border rounded-md",
                    error && "border-destructive",
                    className
                )}
                {...props}
            />
            {error && <span id={errorId} role="alert" className="text-sm text-destructive">{error}</span>}
        </div>
    );
}

// Użycie
const inputRef = useRef<HTMLInputElement>(null);
<Input ref={inputRef} label="Email" />
```

### Migracja z forwardRef
```typescript
// STARE (React 18) - nie używaj
const Input = forwardRef<HTMLInputElement, Props>((props, ref) => {
    return <input ref={ref} {...props} />;
});
Input.displayName = 'Input';

// NOWE (React 19) - prostsze
function Input({ ref, ...props }: Props & { ref?: React.Ref<HTMLInputElement> }) {
    return <input ref={ref} {...props} />;
}
```

---

## Lazy Loading

### Kiedy Lazy Load

| Lazy Load | Nie Lazy Load |
|-----------|---------------|
| Strony (route-level) | Header, Footer, Navigation |
| Modale, dialogi | Komponenty above-the-fold |
| Ciężkie formularze | Małe komponenty |
| Poniżej fold | Krytyczne UI |

### Implementacja

`lazy()` oczekuje modułu z default exportem. Default export ma tylko strona ładowana przez `lazy()`; komponent, który nie jest stroną (modal, ciężki formularz), zostaje przy named exporcie i mapujesz go na `default` w `.then`:
```typescript
import { lazy, Suspense } from 'react';

// Strona (default export w src/pages/settings-page.tsx)
const SettingsPage = lazy(() => import('@/pages/settings-page'));

// Komponent z named exportem
const TemplateModal = lazy(() =>
    import('./template-modal').then((module) => ({
        default: module.TemplateModal
    }))
);
```

### Użycie z Suspense
```typescript
function App() {
    const [showModal, setShowModal] = useState(false);

    return (
        <div>
            <MainContent />
            
            <Suspense fallback={<LoadingOverlay />}>
                {showModal && <TemplateModal onClose={() => setShowModal(false)} />}
            </Suspense>
        </div>
    );
}
```

---

## Suspense Boundaries

### LoadingOverlay

Ten sam komponent (bez propsów) opisuje component-ux.md; `role="status"` ogłasza ładowanie czytnikowi ekranu.
```typescript
import { Loader2 } from 'lucide-react';

export function LoadingOverlay() {
    return (
        <div
            role="status"
            className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
        >
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Ładowanie...</p>
            </div>
        </div>
    );
}
```

### Wiele Boundaries
```typescript
function Dashboard() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Suspense fallback={<CardSkeleton />}>
                <MainContent />
            </Suspense>

            <Suspense fallback={<CardSkeleton />}>
                <Sidebar />
            </Suspense>

            <Suspense fallback={<ListSkeleton count={5} />}>
                <RecentActivity />
            </Suspense>
        </div>
    );
}
```

Każda sekcja ładuje się niezależnie.

---

## Error Boundaries

Używaj `react-error-boundary` zamiast pisania klasy. Sprawdź package.json; nową zależność zgłoś (w workflowie: w odchyleniach) i instaluj menedżerem z lockfile projektu z dokładną wersją, np.:
```bash
pnpm add -E react-error-boundary
```

### Podstawowe użycie

Boundary łapie błąd renderu, więc tak jak każdy `catch` zostawia ślad dla operatora: `onError` loguje go przez logger z kodem błędu. Użytkownik widzi ogólny komunikat; treść błędu pokazujesz tylko w trybie deweloperskim.
```typescript
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

import { logger } from '@/lib/logger';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="p-4 text-center" role="alert">
            <p className="text-destructive mb-4">Coś poszło nie tak</p>
            {import.meta.env.DEV && error instanceof Error && (
                <pre className="text-sm text-muted-foreground mb-4">
                    {error.message}
                </pre>
            )}
            <Button onClick={resetErrorBoundary}>Spróbuj ponownie</Button>
        </div>
    );
}

// Użycie
<ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error) => logger.error('UI_BOUNDARY_CAUGHT', error)}
>
    <MyComponent />
</ErrorBoundary>
```

### Z Suspense
```typescript
<ErrorBoundary FallbackComponent={ErrorFallback}>
    <Suspense fallback={<LoadingOverlay />}>
        <LazyComponent />
    </Suspense>
</ErrorBoundary>
```

**Kolejność:** ErrorBoundary na zewnątrz Suspense — wtedy łapie też błąd rzucony podczas ładowania leniwego komponentu (np. nieudany import chunka).

### Z onReset
```typescript
<ErrorBoundary
    FallbackComponent={ErrorFallback}
    onReset={() => {
        // Reset state, refetch data, etc. — promise świadomie pomijany (`void`), bo onReset nic nie zwraca
        void queryClient.invalidateQueries();
    }}
    resetKeys={[userId]} // Reset gdy userId się zmieni
>
    <UserProfile userId={userId} />
</ErrorBoundary>
```

### useErrorBoundary Hook

Programowe zgłaszanie błędów. Operacja idzie przez hook z mutacją (komponent nie woła serwisu wprost), a błąd przekazujesz do najbliższego ErrorBoundary, którego `onError` zostawia ślad w loggerze:
```typescript
import { useErrorBoundary } from 'react-error-boundary';

import { useRiskyOperation } from '@/hooks/use-risky-operation';

function MyComponent() {
    const { showBoundary } = useErrorBoundary();
    const riskyOperation = useRiskyOperation();

    const handleClick = () => {
        riskyOperation.mutate(undefined, {
            onError: (error) => showBoundary(error), // Przekaż do ErrorBoundary
        });
    };

    return <Button onClick={handleClick}>Risky Action</Button>;
}
```

TanStack Query ma też opcję `throwOnError: true` w `useMutation` — wtedy błąd mutacji trafia do ErrorBoundary bez `showBoundary`.

---

## Separacja Komponentów

### Kiedy Dzielić

| Nowy plik | Ten sam plik |
|-----------|--------------|
| Trudno zrozumieć na pierwszy rzut oka | <50 linii helper |
| Wiele odrębnych odpowiedzialności | Ściśle powiązane |
| Sekcje do ponownego użycia | Nie reużywane |
| Zagnieżdżenie JSX >4 poziomy | Prosty prezentacyjny |

### Przykład
```typescript
// NIE - monolityczny
function MassiveComponent() {
    // Wyszukiwanie + filtrowanie + grid + akcje...
}

// TAK - modularny
function ParentContainer() {
    return (
        <div className="flex flex-col gap-4">
            <SearchAndFilter onFilter={handleFilter} />
            <DataGrid data={filteredData} />
            <ActionPanel onAction={handleAction} />
        </div>
    );
}
```

---

## Komunikacja Komponentów

### Props Down, Events Up
```typescript
// Parent
function Parent() {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    return (
        <Child
            data={data}              // Props down
            onSelect={setSelectedId} // Events up
        />
    );
}

// Child
interface ChildProps {
    data: Data[];
    onSelect: (id: string) => void;
}

function Child({ data, onSelect }: ChildProps) {
    // Akcja na przycisku (nie na div): działa z klawiatury i ma rolę dla czytnika ekranu
    return (
        <ul>
            {data.map((item) => (
                <li key={item.id}>
                    <button type="button" onClick={() => onSelect(item.id)}>
                        {item.name}
                    </button>
                </li>
            ))}
        </ul>
    );
}
```

### Unikaj Prop Drilling (>3 poziomy)

Hook kontekstu użyty poza providerem rzuca typowany błąd z kodem (klasa z polem `code`), nie `Error` ze stringiem — operator rozpozna przyczynę po kodzie w logu.
```typescript
import { createContext, useContext, type ReactNode } from 'react';

interface MyData {
    title: string;
}

class ContextMissingError extends Error {
    readonly code: string;
    constructor(code: string) {
        super(`${code}: hook kontekstu użyty poza swoim providerem`);
        this.name = 'ContextMissingError';
        this.code = code;
    }
}

// Context dla głębokiego zagnieżdżenia
const MyContext = createContext<MyData | null>(null);

function Provider({ children }: { children: ReactNode }) {
    const data = useMyData();
    return <MyContext.Provider value={data}>{children}</MyContext.Provider>;
}

// Custom hook dla bezpiecznego użycia: zawężenie zamiast `!`
function useMyContext(): MyData {
    const context = useContext(MyContext);
    if (!context) {
        throw new ContextMissingError('MY_CONTEXT_MISSING');
    }
    return context;
}

function DeepChild() {
    const data = useMyContext();
    // Używaj data bezpośrednio
    return <h2>{data.title}</h2>;
}
```

---

## Generic Components
```typescript
interface ListProps<T> {
    items: T[];
    renderItem: (item: T) => ReactNode;
    keyExtractor: (item: T) => string;
}

export function List<T>({
    items,
    renderItem,
    keyExtractor
}: ListProps<T>) {
    return (
        <ul>
            {items.map(item => (
                <li key={keyExtractor(item)}>
                    {renderItem(item)}
                </li>
            ))}
        </ul>
    );
}

// Użycie
<List
    items={templates}
    renderItem={(t) => <TemplateCard template={t} />}
    keyExtractor={(t) => t.id}
/>
```

---

## React 19: use Hook (Data Fetching)

Hook `use` pozwala czytać Promise w komponencie. Poniższy przykład pokazuje samą mechanikę i nie jest wzorcem pobierania danych w tym stacku: nowy kod pobierający dane idzie przez TanStack Query (coding-rules, Async i React), a `fetchData()` wywołane przy imporcie modułu nie ma limitu czasu, ponawiania ani cache.
```typescript
import { use, Suspense } from 'react';

// Mechanika (poza tym stackiem): promise utworzony poza renderem, stabilny między renderami
const dataPromise = fetchData();

function DataView() {
    const data = use(dataPromise); // Suspenduje do rozwiązania
    return <div>{data.title}</div>;
}

// Użycie
<Suspense fallback={<Skeleton />}>
    <DataView />
</Suspense>
```

**Dla Vite SPA:** dane pobierasz przez React Query (TanStack Query) — oferuje cache, refetch, anulowanie i devtools; hook `use` jest niskopoziomowy. W tym stacku `use` przydaje się do odczytu kontekstu, także warunkowo (czego `useContext` nie pozwala):
```typescript
import { use } from 'react';

function ThemeBadge({ isVisible }: { isVisible: boolean }) {
    if (!isVisible) return null;
    const theme = use(ThemeContext); // `use` wolno wywołać po warunku
    return <span className="text-xs text-muted-foreground">{theme}</span>;
}
```

---

## React 19: useActionState

Hook do zarządzania stanem formularza z wbudowaną obsługą pending. Akcja leży w hooku: parsuje `FormData` schematem Zod (zamiast `formData.get(...) as string`), woła serwis, w `catch` zostawia ślad w loggerze i zwraca stan jako unię dyskryminowaną zamiast pary `success`/`error`:
```typescript
// src/hooks/use-submit-name.ts
import { useActionState } from 'react';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { nameService } from '@/services/name-service';

const nameSchema = z.strictObject({
    name: z.string().trim().min(1, 'Podaj imię'),
});

type SubmitNameState =
    | { status: 'idle' }
    | { status: 'success' }
    | { status: 'error'; message: string };

const INITIAL_SUBMIT_NAME_STATE: SubmitNameState = { status: 'idle' };

async function submitName(_previous: SubmitNameState, formData: FormData): Promise<SubmitNameState> {
    const parsed = nameSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
        return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane' };
    }
    try {
        await nameService.submit(parsed.data);
        return { status: 'success' };
    } catch (error) {
        logger.error('NAME_SUBMIT_FAILED', error);
        return { status: 'error', message: 'Nie udało się wysłać' };
    }
}

export function useSubmitName() {
    return useActionState(submitName, INITIAL_SUBMIT_NAME_STATE);
}
```
```typescript
// src/components/simple-form.tsx
export function SimpleForm() {
    const [state, submitAction, isPending] = useSubmitName();
    const hasError = state.status === 'error';

    return (
        <form action={submitAction} className="space-y-2">
            <Label htmlFor="simple-name">Imię</Label>
            <Input
                id="simple-name"
                name="name"
                aria-invalid={hasError ? true : undefined}
                aria-describedby={hasError ? 'simple-name-error' : undefined}
            />
            {state.status === 'error' && (
                <p id="simple-name-error" role="alert" className="text-sm text-destructive">
                    {state.message}
                </p>
            )}
            {state.status === 'success' && <p role="status" className="text-sm">Wysłano</p>}
            <Button type="submit" disabled={isPending}>
                {isPending ? 'Wysyłanie...' : 'Wyślij'}
            </Button>
        </form>
    );
}
```

**Kiedy `useActionState` vs React Hook Form:**

| `useActionState` | React Hook Form + Zod |
|------|------|
| Proste formularze (1-3 pola) | Złożone formularze (>3 pola) |
| Walidacja schematem w akcji, po wysłaniu | Zaawansowana walidacja na bieżąco |
| Progressive enhancement | Bogate interakcje (wizard, dynamic fields) |
| Natywny `<form action>` | Kontrolowane komponenty |

---

## Wzorzec Eksportu
```typescript
// Komponent i hook — tylko named export
export function MyComponent({ ... }: Props) {
    // ...
}

// Strona ładowana przez lazy() — default export
// src/pages/settings-page.tsx
export default function SettingsPage() {
    // ...
}
```

**Dlaczego tak:**
- Named export dla testowania/refactoringu — jedna nazwa we wszystkich importach
- Default export tylko tam, gdzie go ktoś importuje: `lazy(() => import('@/pages/settings-page'))`. Default export komponentu, którego nikt nie importuje domyślnie, to nieużywany eksport (coding-rules, sekcja ESLint)
- Komponent, który nie jest stroną, ładujesz leniwie przez `.then((module) => ({ default: module.TemplateModal }))` (sekcja „Lazy Loading”)

---

## Zobacz Także

- [styling-guide.md](./styling-guide.md) - TailwindCSS v4
- [loading-and-error-states.md](./loading-and-error-states.md) - Suspense, loading
- [performance.md](./performance.md) - React Compiler, memoizacja
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
        <div className="p-4">
            User: {userId}
        </div>
    );
}

export default MyComponent;
```

**Kluczowe punkty:**
- Props interface z JSDoc comments
- Bezpośrednie typowanie props (bez `React.FC`)
- Named export + default export

### Alternatywa: React.FC

`React.FC` nadal działa, ale jest opcjonalny:
```typescript
// Też poprawne, ale mniej preferowane w 2026
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
```typescript
/**
 * Opis komponentu - co robi, kiedy używać
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

import type { Item } from '@/types/database';

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
    const { user } = useAuth();
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    // 4. HANDLERS
    // Bez React Compiler - useCallback dla handlers przekazywanych do memo children
    // Z React Compiler 1.0 (rekomendowany od Paź 2025) - zwykłe funkcje, compiler sam optymalizuje
    const handleSave = async () => {
        try {
            await saveData();
            toast.success('Zapisano pomyślnie');
            onComplete?.();
        } catch (error) {
            logger.error('Błąd podczas zapisu', error);
            toast.error('Nie udało się zapisać');
        }
    };

    // 5. RENDER
    return (
        <Card ref={ref}>
            <CardHeader>
                <CardTitle>Mój Komponent</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Button onClick={handleSave}>Zapisz</Button>
            </CardContent>
        </Card>
    );
}

// 6. DEFAULT EXPORT
export default MyComponent;
```

---

## React 19: Ref jako Prop

W React 19 `forwardRef` **nie jest już potrzebny** (zostanie oznaczony jako deprecated w przyszłym wydaniu; w 19.2 brak warningu). Ref to zwykły prop:
```typescript
// React 19 - ref w interfejsie props
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    ref?: React.Ref<HTMLInputElement>;
}

export function Input({ 
    label, 
    error, 
    ref,
    className,
    ...props 
}: InputProps) {
    return (
        <div className="flex flex-col gap-1">
            {label && <label className="text-sm font-medium">{label}</label>}
            <input
                ref={ref}
                className={cn(
                    "px-3 py-2 border rounded-md",
                    error && "border-destructive",
                    className
                )}
                {...props}
            />
            {error && <span className="text-sm text-destructive">{error}</span>}
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
```typescript
import { lazy, Suspense } from 'react';

// Default export
const TemplateModal = lazy(() => import('./TemplateModal'));

// Named export
const MyComponent = lazy(() =>
    import('./MyComponent').then(module => ({
        default: module.MyComponent
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
```typescript
export function LoadingOverlay() {
    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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

Używaj `react-error-boundary` zamiast pisania klasy:
```bash
npm install react-error-boundary
```

### Podstawowe użycie
```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="p-4 text-center" role="alert">
            <p className="text-destructive mb-4">Coś poszło nie tak</p>
            <pre className="text-sm text-muted-foreground mb-4">
                {error.message}
            </pre>
            <Button onClick={resetErrorBoundary}>Spróbuj ponownie</Button>
        </div>
    );
}

// Użycie
<ErrorBoundary FallbackComponent={ErrorFallback}>
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

**Kolejność:** ErrorBoundary NA ZEWNĄTRZ Suspense.

### Z onReset
```typescript
<ErrorBoundary
    FallbackComponent={ErrorFallback}
    onReset={() => {
        // Reset state, refetch data, etc.
        queryClient.invalidateQueries();
    }}
    resetKeys={[userId]} // Reset gdy userId się zmieni
>
    <UserProfile userId={userId} />
</ErrorBoundary>
```

### useErrorBoundary Hook

Programowe zgłaszanie błędów:
```typescript
import { useErrorBoundary } from 'react-error-boundary';

function MyComponent() {
    const { showBoundary } = useErrorBoundary();

    const handleClick = async () => {
        try {
            await riskyOperation();
        } catch (error) {
            showBoundary(error); // Przekaż do ErrorBoundary
        }
    };

    return <Button onClick={handleClick}>Risky Action</Button>;
}
```

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
    return (
        <div onClick={() => onSelect(data[0].id)}>
            {/* Zawartość */}
        </div>
    );
}
```

### Unikaj Prop Drilling (>3 poziomy)
```typescript
// Context dla głębokiego zagnieżdżenia
const MyContext = createContext<MyData | null>(null);

function Provider({ children }: { children: ReactNode }) {
    const data = useMyData();
    return <MyContext.Provider value={data}>{children}</MyContext.Provider>;
}

// Custom hook dla bezpiecznego użycia
function useMyContext() {
    const context = useContext(MyContext);
    if (!context) {
        throw new Error('useMyContext must be used within Provider');
    }
    return context;
}

function DeepChild() {
    const data = useMyContext();
    // Używaj data bezpośrednio
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

Hook `use` pozwala czytać Promise w komponencie:
```typescript
import { use, Suspense } from 'react';

// Promise utworzony poza renderem
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

**Dla Vite SPA:** React Query jest nadal lepszym wyborem dla większości przypadków - oferuje cache, refetch, devtools. Hook `use` jest niskopoziomowy.

---

## React 19: useActionState

Hook do zarządzania stanem formularza z wbudowaną obsługą pending:
```typescript
import { useActionState } from 'react';

function SimpleForm() {
    const [state, submitAction, isPending] = useActionState(
        async (previousState: State, formData: FormData) => {
            const name = formData.get('name') as string;
            try {
                await api.submit({ name });
                return { success: true, error: null };
            } catch (error) {
                return { success: false, error: 'Nie udało się wysłać' };
            }
        },
        { success: false, error: null }
    );

    return (
        <form action={submitAction}>
            <Input name="name" />
            {state.error && <p className="text-destructive">{state.error}</p>}
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
| Brak client-side walidacji | Zaawansowana walidacja |
| Progressive enhancement | Bogate interakcje (wizard, dynamic fields) |
| Natywny `<form action>` | Kontrolowane komponenty |

---

## Wzorzec Eksportu
```typescript
// Named + default (rekomendowane)
export function MyComponent({ ... }: Props) {
    // ...
}

export default MyComponent;
```

**Dlaczego oba:**
- Named export dla testowania/refactoringu
- Default export dla lazy loading

---

## Zobacz Także

- [styling-guide.md](./styling-guide.md) - TailwindCSS v4
- [loading-and-error-states.md](./loading-and-error-states.md) - Suspense, loading
- [performance.md](./performance.md) - React Compiler, memoizacja
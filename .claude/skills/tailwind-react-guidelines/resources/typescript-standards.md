# Standardy TypeScript

Wytyczne TypeScript i React 19 - konfiguracja, typy, nowoczesne wzorce.

**Wersja TypeScriptu:** wg package.json projektu. Od TypeScriptu 6 `strict`, `noUncheckedSideEffectImports`
i nowoczesny `target` są domyślne (target ES5 usunięty), ale w tsconfig zapisujesz je jawnie, żeby konfiguracja
nie zależała od wersji kompilatora. TypeScript 7 to natywny kompilator; przejście na niego to zmiana zależności,
którą zgłaszasz, po sprawdzeniu, czy toolchain projektu (edytor, typescript-eslint, Vite) go obsługuje.
Zmiany domyślnych przy podbiciu wersji sprawdzasz w notach wydania na devblogs.microsoft.com/typescript.

---

## Konfiguracja tsconfig.json
```json
{
    "compilerOptions": {
        // Strict mode
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true,
        "noUncheckedSideEffectImports": true,

        // Tylko składnia usuwalna bez transformacji (nowy projekt)
        "erasableSyntaxOnly": true,

        // Moduły
        "target": "ES2022",
        "lib": ["DOM", "DOM.Iterable", "ESNext"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "verbatimModuleSyntax": true,
        "allowImportingTsExtensions": true,
        "noEmit": true,

        // React 19
        "jsx": "react-jsx"
    }
}
```

**Kluczowe flagi:**
- `strict` i `verbatimModuleSyntax` — wymagane przez reguły kodu (sekcja Type safety)
- `erasableSyntaxOnly: true` — w nowym projekcie (reguły kodu, Type safety). Zabrania `enum`, `namespace` z kodem i parameter properties (`constructor(private x: string)`), czyli składni, której nie da się usunąć bez transformacji; zamiast `enum` — obiekt `as const` z sekcji niżej, zamiast parameter properties — pola klasy przypisane w konstruktorze
- `moduleResolution: "bundler"` - standard dla Vite i nowoczesnych bundlerów
- `verbatimModuleSyntax: true` - zastępuje stare `importsNotUsedAsValues` i `preserveValueImports`
- `noUncheckedSideEffectImports` - TS 5.6+, wymusza explicit side-effect imports
- `allowImportingTsExtensions` działa tylko z `noEmit` (albo `emitDeclarationOnly`) — w Vite pliki emituje bundler, `tsc` tylko sprawdza typy

---

## Type Imports (Inline Syntax)

Preferowana składnia - jeden import z type modifier:
```typescript
// TAK - inline type imports
import {
    useEffect,
    useRef,
    useState,
    type FC,
    type ReactNode,
    type RefObject
} from 'react';

// Kod UI importuje serwis, nie klienta bazy (warstwy: komponent → hook → serwis → klient)
import {
    templateService,
    type TemplateFilters
} from '@/services/template-service';

// OK - oddzielne (gdy tylko typy); typy tabel z wygenerowanego pliku typów
import type { Database, Tables } from '@/types/database.types';

// NIE - stary styl
import { FC, ReactNode } from 'react'; // Jeśli to tylko typy
```

---

## Interfejsy Props
```typescript
interface MyComponentProps {
    /** ID użytkownika */
    userId: string;
    /** Czy wyłączony */
    disabled?: boolean;
    /** Callback */
    onAction?: () => void;
    /** Children */
    children?: ReactNode;
}

export const MyComponent = ({
    userId,
    disabled = false,
    onAction,
    children
}: MyComponentProps) => {
    // ...
};
```

**Zasady:**
- JSDoc komentarze dla props
- Opcjonalne props z `?`
- Domyślne wartości w destrukturyzacji

---

## React 19: Ref jako Prop

W React 19 `forwardRef` **nie jest potrzebny** — React zapowiada jego wycofanie, a ref to zwykły prop:
```typescript
// React 19 - ref jako prop
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    ref?: React.Ref<HTMLInputElement>;
}

export const Input = ({
    label,
    error,
    ref,
    className,
    ...props
}: InputProps) => {
    const inputId = useId();
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
            {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
    );
};

// Użycie
const inputRef = useRef<HTMLInputElement>(null);
<Input ref={inputRef} label="Email" />
```

**Migracja z forwardRef:**
```typescript
// STARY (React 18) - nie używaj
const Input = forwardRef<HTMLInputElement, Props>((props, ref) => {
    return <input ref={ref} {...props} />;
});

// NOWY (React 19)
const Input = ({ ref, ...props }: Props & { ref?: React.Ref<HTMLInputElement> }) => {
    return <input ref={ref} {...props} />;
};
```

---

## React 19: Async Components

Komponenty async istnieją tylko jako Server Components we frameworkach SSR i nie dotyczą Vite SPA. Tu komponent jest synchroniczny, a dane pobiera hook z TanStack Query (komponent → hook → serwis), opisany w [performance.md](./performance.md#react-query-rekomendowane-dla-spa).

---

## Kiedy Explicit Types, Kiedy Inferowanie
```typescript
// Pozwól inferować dla prostych przypadków
const [count, setCount] = useState(0);           // number
const [name, setName] = useState('');            // string
const items = templates.filter(t => t.active);   // Item[]

// Explicit gdy null/undefined
const [user, setUser] = useState<User | null>(null);

// Explicit dla unii stanów — jedna unia dyskryminowana zamiast kilku flag (isLoading, error, data)
type SaveState =
    | { status: 'idle' }
    | { status: 'saving' }
    | { status: 'error'; code: string };
const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });

// Explicit dla pustych tablic
const [items, setItems] = useState<Item[]>([]);

// Explicit return types dla publicznych funkcji (serwisy, utilsy)
export async function getItems(): Promise<Item[]> {
    // ...
}

// Bez ręcznego typu zwracanego: komponent React (typ z JSX) i hook, który zwraca wynik
// hooka biblioteki (useQuery, useForm) — ręczny zapis tylko powtórzyłby wywnioskowany typ
export function useItems() {
    return useQuery(itemListOptions());
}
```

---

## satisfies Operator

Waliduje typ BEZ poszerzania go:
```typescript
// Bez satisfies - typ poszerzony
const config = {
    theme: 'dark',
    debug: true,
};
// config.theme: string

// Z satisfies - walidacja + literal types
interface Config {
    theme: 'light' | 'dark';
    debug: boolean;
}

const config = {
    theme: 'dark',
    debug: true,
} satisfies Config;
// config.theme: "dark" (literal!)

// Praktyczny przykład - routes (src/constants/routes.ts; jedyna definicja tras
// w projekcie, pełna lista w file-organization.md)
export const ROUTES = {
    HOME: '/',
    SETTINGS: '/settings',
    PROFILE: '/profile',
} as const satisfies Record<string, string>;

// ROUTES.HOME jest typu "/" nie string — literał daje as const,
// a satisfies sprawdza, że każda wartość jest stringiem.
// Samo `satisfies Record<string, string>` zostawiłoby typ string: kontekst string poszerza literał.
```

---

## as const

Tworzy readonly literal types:
```typescript
// Bez as const
const STATUS = {
    IDLE: 'idle',
    LOADING: 'loading',
}; // { IDLE: string, LOADING: string }

// Z as const
const STATUS = {
    IDLE: 'idle',
    LOADING: 'loading',
} as const; // { readonly IDLE: "idle", readonly LOADING: "loading" }

// Typ z wartości
type Status = typeof STATUS[keyof typeof STATUS]; // "idle" | "loading"

// Tablice
const CATEGORIES = ['work', 'personal', 'other'] as const;
type Category = typeof CATEGORIES[number]; // "work" | "personal" | "other"
```

---

## Const Type Parameters (TS 5.0+)

Automatyczne literal types w generykach - bez wymuszania `as const` przy wywołaniu:
```typescript
// Bez const - wymaga 'as const' przy wywołaniu
function createRoutes<T>(routes: T): T {
    return routes;
}
const r1 = createRoutes({ home: '/' }); // { home: string }
const r2 = createRoutes({ home: '/' } as const); // { readonly home: "/" }

// Z const type parameter - automatyczne literały
function createRoutes<const T>(routes: T): T {
    return routes;
}
const r3 = createRoutes({ home: '/' }); // { readonly home: "/" }

// Praktyczne użycie - builder pattern
function defineConfig<const T extends Record<string, unknown>>(config: T): T {
    return config;
}

const config = defineConfig({
    apiUrl: 'https://api.example.com',
    timeout: 5000,
});
// config.apiUrl: "https://api.example.com" (literal)
```

---

## NoInfer (TS 5.4+)

Blokuje niechcianą inferencję w generykach:
```typescript
// Problem bez NoInfer
function createState<T>(initial: T, defaultValue: T) {
    return { initial, defaultValue };
}
createState('hello', 42); 
// T = string | number (niechciane poszerzenie!)

// Rozwiązanie z NoInfer
function createState<T>(initial: T, defaultValue: NoInfer<T>) {
    return { initial, defaultValue };
}
createState('hello', 42); 
// Error: Argument of type 'number' is not assignable to 'string'

// Praktyczne użycie - default values
// T wynika ze schematu; defaultValue nie wpływa na inferencję, więc zły typ domyślny to błąd kompilacji.
// Dane z localStorage przechodzą przez Zod (safeParse), nie przez `as`.
function useLocalStorage<T>(key: string, schema: z.ZodType<T>, defaultValue: NoInfer<T>): T {
    // ...
}
```

---

## Import Defer (TS 5.9+)

Odroczona ewaluacja modułu — kod importowany jest wykonywany dopiero przy pierwszym dostępie:
```typescript
// Moduł ładowany leniwie — ewaluacja dopiero przy użyciu
import defer * as analytics from './analytics';

function handleClick() {
    analytics.track('click'); // Ewaluacja modułu dopiero tutaj
}
```

**Uwaga:** Tylko namespace imports (`* as`). Named/default imports nie są wspierane z `defer`. Wymaga bundlera z obsługą deferred imports.

---

## Runtime Validation z Zod

TypeScript sprawdza typy tylko w compile time. Dla danych zewnętrznych użyj Zod:
```typescript
// src/schemas/item.ts
import { z } from 'zod';

// Schema
export const ItemSchema = z.object({
    id: z.uuid(),
    name: z.string().min(1),
    category: z.enum(['marketing', 'sprzedaz', 'hr']),
    created_at: z.iso.datetime(),
});

// Dane do utworzenia elementu — id i created_at nadaje serwer
export const createItemSchema = ItemSchema.omit({ id: true, created_at: true });

// Typ ze schema
export type Item = z.infer<typeof ItemSchema>;
```
```typescript
// src/services/item-service.ts
import { request } from '@/lib/api';
import { ItemSchema, type Item } from '@/schemas/item';

// Walidacja odpowiedzi: request() z file-organization.md ma limit czasu (AbortSignal.timeout),
// parsuje kopertę { data, error: { code, message } } przez z.strictObject, dane — podanym schematem,
// a przy error rzuca ApiError(code, message, status). Schemat jest jedynym miejscem, które zna kształt Item.
export async function getItem(id: string, signal?: AbortSignal): Promise<Item> {
    return request(`/items/${encodeURIComponent(id)}`, ItemSchema, { signal });
}
```
```typescript
// Safe parse — gdy zła wartość ma inną ścieżkę niż wyjątek (payload: unknown)
const result = ItemSchema.safeParse(payload);
if (result.success) {
    // result.data jest typu Item
} else {
    logger.error('ITEM_PARSE_FAILED', result.error);
}
```

---

## Type Guards
```typescript
// Type guard function
function isItem(item: unknown): item is Item {
    return (
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        'name' in item
    );
}

// Discriminated unions — koperta API z reguł kodu: { data, error: { code, message } }
interface ApiSuccess<T> {
    data: T;
    error: null;
}

interface ApiFailure {
    data: null;
    error: { code: string; message: string };
}

type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

// ApiError — klasa błędu z kodem (definicja przy wspólnym kliencie request(), file-organization.md)
function unwrapEnvelope<T>(envelope: ApiEnvelope<T>, status: number): T {
    if (envelope.error !== null) {
        // Zawężone do ApiFailure: typowany błąd z kodem zamiast new Error(message)
        throw new ApiError(envelope.error.code, envelope.error.message, status);
    }
    // Zawężone do ApiSuccess<T>
    return envelope.data;
}
```

W kodzie aplikacji kopertę rozpakowuje wspólny `request()`; przykład pokazuje, jak `error: null` w jednym wariancie unii zawęża typ bez `as` i bez `!`.

---

## Utility Types

### Podstawowe
```typescript
Partial<T>        // Wszystkie props opcjonalne
Required<T>       // Wszystkie props wymagane
Pick<T, K>        // Wybierz konkretne props
Omit<T, K>        // Usuń konkretne props
Record<K, V>      // Object type
ReturnType<F>     // Typ zwracany przez funkcję
Parameters<F>     // Typy parametrów funkcji
```

### Zaawansowane
```typescript
Extract<T, U>     // Wyciągnij typy pasujące do U
Exclude<T, U>     // Wyklucz typy pasujące do U
NonNullable<T>    // Usuń null i undefined
Awaited<T>        // Typ wewnątrz Promise
NoInfer<T>        // Blokuj inferencję (TS 5.4+)
```

### Przykłady
```typescript
type ItemPreview = Pick<Item, 'id' | 'name'>;
type ItemCreate = Omit<Item, 'id' | 'created_at'>;
type ItemCache = Record<string, Item>;

type StringKeys = Extract<'a' | 'b' | 1 | 2, string>; // 'a' | 'b'
type NumberKeys = Exclude<'a' | 'b' | 1 | 2, string>; // 1 | 2

type MaybeUser = User | null | undefined;
type DefiniteUser = NonNullable<MaybeUser>; // User

type Data = Awaited<Promise<Item[]>>; // Item[]
```

---

## Typy dla React Events
```typescript
// Click
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {};

// Change
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {};

// Form submit
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {};

// Keyboard
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {};
```

---

## Generic Components
```typescript
interface ListProps<T> {
    items: T[];
    renderItem: (item: T) => ReactNode;
    keyExtractor: (item: T) => string;
}

export const List = <T,>({
    items,
    renderItem,
    keyExtractor
}: ListProps<T>) => (
    <ul>
        {items.map(item => (
            <li key={keyExtractor(item)}>
                {renderItem(item)}
            </li>
        ))}
    </ul>
);

// Użycie
<List
    items={templates}
    renderItem={(t) => <ItemCard item={t} />}
    keyExtractor={(t) => t.id}
/>
```

---

## Unikaj

### any
```typescript
// NIE
function process(data: any) { ... }

// TAK
function process(data: unknown) {
    if (isValidData(data)) { ... }
}
```

### Non-null Assertion (!)
```typescript
// NIE
const user = getUser()!;

// TAK - zawężenie i typowany błąd z kodem (NotFoundError zbudowany jak ApiError)
const user = getUser();
if (!user) throw new NotFoundError('USER_NOT_FOUND');
```

### Type Assertions bez walidacji
```typescript
// NIE
const data = response as Item[];

// TAK
const data = ItemArraySchema.parse(response);
```

`as` zostaje tylko przy zawężaniu typów DOM (`event.target as HTMLInputElement` tam, gdzie TypeScript nie zna elementu) i w `as const`. Dla wartości z zewnątrz — odpowiedzi, `JSON.parse`, `localStorage`, parametrów URL — schemat Zod; dla wartości znanych w kodzie — `satisfies` albo type guard.

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Wzorce komponentów React 19
- [file-organization.md](./file-organization.md) - Gdzie umieszczać typy
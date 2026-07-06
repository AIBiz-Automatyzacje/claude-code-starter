# Standardy TypeScript

Wytyczne TypeScript 5.7+ (aktualna: 5.9) i React 19 - konfiguracja, typy, nowoczesne wzorce.

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
        
        // Moduły (standard 2026)
        "target": "ES2022",
        "lib": ["DOM", "DOM.Iterable", "ESNext"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "verbatimModuleSyntax": true,
        "allowImportingTsExtensions": true,
        
        // React 19
        "jsx": "react-jsx"
    }
}
```

**Kluczowe flagi:**
- `moduleResolution: "bundler"` - standard dla Vite i nowoczesnych bundlerów
- `verbatimModuleSyntax: true` - zastępuje stare `importsNotUsedAsValues` i `preserveValueImports`
- `noUncheckedSideEffectImports` - TS 5.6+, wymusza explicit side-effect imports

---

## Type Imports (Inline Syntax)

Preferowana składnia 2026 - jeden import z type modifier:
```typescript
// TAK - inline type imports (standard 2026)
import { 
    useState, 
    useEffect, 
    useCallback,
    type FC, 
    type ReactNode,
    type RefObject 
} from 'react';

import { 
    supabase,
    type Template,
    type User 
} from '@/lib/supabase';

// OK - oddzielne (gdy tylko typy)
import type { Database } from '@/types/database';

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

W React 19 `forwardRef` jest **deprecated**. Ref to zwykły prop:
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

Komponenty mogą być async (Server Components):
```typescript
// Async component - zwraca Promise<JSX.Element>
export async function UserProfile({ userId }: { userId: string }) {
    const user = await db.users.get(userId);
    
    return (
        <div>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
        </div>
    );
}

// TypeScript poprawnie typuje Promise
type AsyncComponent = () => Promise<JSX.Element>;
```

**Uwaga:** Async components działają w Server Components (frameworki SSR). W Vite SPA używaj standardowych komponentów + React Query do data fetchingu.

---

## Kiedy Explicit Types, Kiedy Inferowanie
```typescript
// Pozwól inferować dla prostych przypadków
const [count, setCount] = useState(0);           // number
const [name, setName] = useState('');            // string
const items = templates.filter(t => t.active);   // Item[]

// Explicit gdy null/undefined
const [user, setUser] = useState<User | null>(null);
const [error, setError] = useState<Error | undefined>(undefined);

// Explicit dla pustych tablic
const [items, setItems] = useState<Item[]>([]);

// Explicit return types dla publicznych funkcji
async function getItems(): Promise<Item[]> {
    // ...
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

// Praktyczny przykład - routes
const ROUTES = {
    home: '/',
    settings: '/settings',
    profile: '/profile',
} satisfies Record<string, string>;

// ROUTES.home jest typu "/" nie string
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
function useLocalStorage<T>(key: string, defaultValue: NoInfer<T>): T {
    // defaultValue nie wpływa na inferencję T
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
import { z } from 'zod';

// Schema
const ItemSchema = z.object({
    id: z.uuid(),
    name: z.string().min(1),
    category: z.enum(['marketing', 'sprzedaz', 'hr']),
    created_at: z.iso.datetime(),
});

// Typ ze schema
type Item = z.infer<typeof ItemSchema>;

// Walidacja
async function fetchItem(id: string): Promise<Item> {
    const response = await fetch(`/api/items/${id}`);
    const data = await response.json();
    return ItemSchema.parse(data); // Rzuca błąd jeśli invalid
}

// Safe parse
const result = ItemSchema.safeParse(data);
if (result.success) {
    // result.data jest typu Item
} else {
    logger.error('Invalid data', result.error);
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

// Discriminated unions
interface SuccessResponse {
    status: 'success';
    data: Item[];
}

interface ErrorResponse {
    status: 'error';
    message: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

function handleResponse(response: ApiResponse) {
    if (response.status === 'success') {
        return response.data;
    }
    throw new Error(response.message);
}
```

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

// TAK
const user = getUser();
if (!user) throw new Error('User not found');
```

### Type Assertions bez walidacji
```typescript
// NIE
const data = response as Item[];

// TAK
const data = ItemArraySchema.parse(response);
```

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Wzorce komponentów React 19
- [file-organization.md](./file-organization.md) - Gdzie umieszczać typy
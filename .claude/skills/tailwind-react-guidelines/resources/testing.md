# Testowanie

Vitest + React Testing Library + MSW - unit testy, integracyjne, mockowanie API.

---

## Stack Testowy

| Narzędzie | Rola |
|-----------|------|
| **Vitest** | Test runner (szybki, natywny ESM, kompatybilny z Vite) |
| **React Testing Library** | Testowanie komponentów React |
| **MSW** | Mockowanie API (Service Worker) |
| **@testing-library/user-event** | Symulacja interakcji użytkownika |

---

## Setup

### Instalacja

Sprawdź package.json; nową zależność zgłoś (w workflowie: w odchyleniach). Instalujesz menedżerem z lockfile projektu z dokładną wersją, np.:
```bash
pnpm add -D -E vitest @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom msw
```
> `@testing-library/dom` to obowiązkowy peer `@testing-library/react` (zakres wersji podaje `peerDependencies` w jego package.json). npm doinstaluje go sam, ale pnpm i yarn w trybie strict wymagają jawnego wpisu.

### vitest.config.ts
```typescript
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        // Vitest 4.x - opcje pool na top-level
        clearMocks: true,
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'src/test/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/types/',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
```

### src/test/setup.ts
```typescript
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';

// Cleanup po każdym teście
afterEach(() => {
    cleanup();
});

// MSW setup
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### tsconfig.json - typy
```json
{
    "compilerOptions": {
        "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
    }
}
```

`types` zastępuje listę typów globalnych, zamiast do niej dopisywać. Bez `"vite/client"` znika typ `import.meta.env` i deklaracje importów CSS, więc `lib/env.ts` i import `index.css` (przy `noUncheckedSideEffectImports` z [typescript-standards.md](./typescript-standards.md)) przestają się kompilować.

### package.json - skrypty
```json
{
    "scripts": {
        "test": "vitest",
        "test:ui": "vitest --ui",
        "test:coverage": "vitest run --coverage",
        "test:watch": "vitest --watch"
    }
}
```

### Vitest 4.x — Breaking Changes

W Vitest 4.0 zmieniono konfigurację pool:
```typescript
// Vitest 3.x
export default defineConfig({
    test: {
        pool: 'forks',
        poolOptions: { forks: { execArgv: ['--expose-gc'] } },
    },
});

// Vitest 4.x
export default defineConfig({
    test: {
        pool: 'forks',
        execArgv: ['--expose-gc'],
        isolate: false,
    },
});
```

Inne zmiany w v4:
- `workspace` → `projects` (nowa nazwa opcji)
- `poolOptions.threads.maxThreads` → `maxWorkers` (top-level)
- `coverage.all` usunięte → użyj `coverage.include`
- `singleThread: true` → `maxWorkers: 1, isolate: false`

---

## MSW - Mockowanie API

### tests/fixtures/items.ts

Dane testowe to małe fixture'y w `tests/fixtures/`, wspólne dla handlerów i asercji. Fixture przechodzi przez ten sam schemat Zod co odpowiedź serwera (`itemSchema` z `@/schemas/item`, definicja w [file-organization.md](./file-organization.md#katalog-schemas)), więc identyfikatory to UUID, kategoria pochodzi z listy `ITEM_CATEGORIES`, a `created_at` to data ISO.
```typescript
import type { Item } from '@/schemas/item';

export const FIXTURE_CREATED_AT = new Date(Date.UTC(2025, 0, 15, 10)).toISOString();
export const NEW_ITEM_ID = '3d9e7b20-6c1f-4a8d-b2e4-5f7a9c1d3e60';
export const MISSING_ITEM_ID = '00000000-0000-4000-8000-000000000000';

export const MARKETING_ITEM = {
    id: '7f3c1a2e-0b4d-4c8e-9a51-2d6f8e0c4b11',
    name: 'Item 1',
    category: 'marketing',
    created_at: FIXTURE_CREATED_AT,
} satisfies Item;

export const SALES_ITEM = {
    id: '1b2e8d40-5f6a-4e7b-8c9d-0a1b2c3d4e5f',
    name: 'Item 2',
    category: 'sprzedaz',
    created_at: FIXTURE_CREATED_AT,
} satisfies Item;

export const ITEMS_FIXTURE = [MARKETING_ITEM, SALES_ITEM];
```

### src/test/mocks/handlers.ts

Handlery odpowiadają kopertą z reguł kodu `{ data, error: { code, message } }` i tym samym kształtem danych co prawdziwe API (lista: `{ items, totalPages }` jak `itemListSchema` w `itemService`), więc klient parsuje w teście ten sam kształt co w produkcji. Adres API pochodzi z `lib/env.ts` — tego samego modułu, z którego bierze go `request()` — a w testach ustawia go plik `.env.test` (`VITE_API_URL=http://localhost:3000/api`). Drugiej wartości awaryjnej tu nie ma: `lib/env.ts` przy braku zmiennej i tak zatrzymuje start z błędem Zod. Testy, które nadpisują handler, importują `API_URL` stąd.
```typescript
import { http, HttpResponse } from 'msw';

import { env } from '@/lib/env';
import { createItemSchema } from '@/schemas/item';

import { FIXTURE_CREATED_AT, ITEMS_FIXTURE, NEW_ITEM_ID } from '../../../tests/fixtures/items';

export const API_URL = env.API_URL;

export const handlers = [
    // GET /items?category=marketing — handler filtruje tak jak serwer
    http.get(`${API_URL}/items`, ({ request }) => {
        const category = new URL(request.url).searchParams.get('category');
        const items = category
            ? ITEMS_FIXTURE.filter((item) => item.category === category)
            : ITEMS_FIXTURE;

        return HttpResponse.json({ data: { items, totalPages: 1 }, error: null });
    }),

    // GET /items/:id
    http.get(`${API_URL}/items/:id`, ({ params }) => {
        const item = ITEMS_FIXTURE.find((candidate) => candidate.id === params.id);

        if (!item) {
            return HttpResponse.json(
                { data: null, error: { code: 'ITEM_NOT_FOUND', message: 'Nie znaleziono elementu' } },
                { status: 404 },
            );
        }

        return HttpResponse.json({ data: item, error: null });
    }),

    // POST /items — ciało parsowane schematem, jak na serwerze
    http.post(`${API_URL}/items`, async ({ request }) => {
        const parsed = createItemSchema.safeParse(await request.json());

        if (!parsed.success) {
            return HttpResponse.json(
                { data: null, error: { code: 'ITEM_INVALID', message: 'Nieprawidłowe dane elementu' } },
                { status: 400 },
            );
        }

        return HttpResponse.json(
            { data: { ...parsed.data, id: NEW_ITEM_ID, created_at: FIXTURE_CREATED_AT }, error: null },
            { status: 201 },
        );
    }),

    // DELETE /items/:id — 204 bez ciała; request() zamienia je na data: null,
    // więc itemService.remove (schemat z.null()) kończy się sukcesem
    http.delete(`${API_URL}/items/:id`, () => {
        return new HttpResponse(null, { status: 204 });
    }),

    // POST /contact — adres, który woła contactService.send
    http.post(`${API_URL}/contact`, () => {
        return HttpResponse.json({ data: { id: 'message-1' }, error: null }, { status: 201 });
    }),
];
```

### src/test/mocks/server.ts
```typescript
import { setupServer } from 'msw/node';

import { handlers } from './handlers';
import { supabaseHandlers } from './supabase-handlers';

// supabaseHandlers — sekcja „Usługi zewnętrzne: MSW zamiast vi.mock()” niżej
export const server = setupServer(...handlers, ...supabaseHandlers);
```

### Nadpisywanie Handlerów w Testach
```typescript
import { http, HttpResponse } from 'msw';

import { ItemList } from '@/components/item-list';
import { API_URL } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import { render, screen } from '@/test/utils';

test('obsługuje błąd serwera', async () => {
    // Nadpisz handler tylko dla tego testu
    server.use(
        http.get(`${API_URL}/items`, () => {
            return HttpResponse.json(
                { data: null, error: { code: 'INTERNAL', message: 'Błąd serwera' } },
                { status: 500 },
            );
        }),
    );

    render(<ItemList />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/błąd/i);
});
```

---

## Testowanie Komponentów

### Podstawowy Test
```typescript
// components/ui/button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from './button';

describe('Button', () => {
    it('renderuje tekst', () => {
        render(<Button>Kliknij</Button>);
        expect(screen.getByRole('button', { name: /kliknij/i })).toBeInTheDocument();
    });

    it('wywołuje onClick', async () => {
        const user = userEvent.setup();
        const handleClick = vi.fn();

        render(<Button onClick={handleClick}>Kliknij</Button>);
        await user.click(screen.getByRole('button'));

        // Atrapę sprawdzasz z argumentami: jedno wywołanie, ze zdarzeniem kliknięcia
        expect(handleClick).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'click' }));
    });

    it('jest wyłączony gdy disabled', () => {
        render(<Button disabled>Kliknij</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
```

### Test z Async
```typescript
// ItemList woła useQuery, więc renderujesz go z providerami z @/test/utils (sekcja niżej)
import { ItemList } from '@/components/item-list';
import { render, screen, waitFor } from '@/test/utils';

test('ładuje i wyświetla dane', async () => {
    render(<ItemList />);

    // Sprawdź loading state
    expect(screen.getByText(/ładowanie/i)).toBeInTheDocument();

    // Poczekaj na dane
    await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    expect(screen.getByText('Item 2')).toBeInTheDocument();
});
```

---

## Wrapper dla Providerów

### src/test/utils.tsx
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { Toaster } from 'sonner';

// QueryClient dla testów - bez retry, bez cache
function createTestQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
            },
            mutations: {
                retry: false,
            },
        },
    });
}

interface WrapperProps {
    children: ReactNode;
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    initialEntries?: string[];
}

// Jeden QueryClient na wrapper (czyli na test): klient tworzony w renderze Wrappera
// gubiłby cache przy każdym ponownym renderze
function createWrapper(initialEntries: string[] = ['/']): ComponentType<WrapperProps> {
    const queryClient = createTestQueryClient();

    return function Wrapper({ children }: WrapperProps) {
        return (
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={initialEntries}>
                    {children}
                    <Toaster />
                </MemoryRouter>
            </QueryClientProvider>
        );
    };
}

function customRender(
    ui: ReactElement,
    { initialEntries, ...options }: CustomRenderOptions = {}
): RenderResult {
    return render(ui, {
        wrapper: createWrapper(initialEntries),
        ...options
    });
}

// Re-export wszystkiego
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient, createWrapper };
```

`createWrapper` służy też testom hooków (`renderHook(..., { wrapper: createWrapper() })`), a `createTestQueryClient` — testom z własnym drzewem tras. Konfiguracja klienta testowego jest jedna, więc testy nie rozjeżdżają się w ustawieniach `retry` i cache.

**Dlaczego MemoryRouter:**
- `BrowserRouter` używa globalnej historii przeglądarki
- W JSDOM może powodować wycieki stanu między testami
- `MemoryRouter` izoluje każdy test

### Użycie
```typescript
import { ItemList } from '@/components/item-list';
// Zamiast import z @testing-library/react
import { render, screen, waitFor } from '@/test/utils';

test('komponent z React Query', async () => {
    render(<ItemList />);

    await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
    });
});

// Z konkretną ścieżką początkową — ItemList czyta kategorię z query stringu
test('lista filtrowana kategorią z URL', async () => {
    render(<ItemList />, { initialEntries: ['/items?category=marketing'] });

    expect(await screen.findByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
});
```

Komponent, który czyta parametr ścieżki (`useParams`), potrzebuje drzewa `<Routes>` z pasującą trasą — wzorzec w sekcji [Testowanie Routingu](#testowanie-routingu).

---

## Testowanie React Query

### Hook useQuery

Test woła hook z tą samą sygnaturą co aplikacja: `useItems(filters: ItemFilters)` z [file-organization.md](./file-organization.md#katalog-hooks), a `data` ma kształt odpowiedzi serwisu `{ items, totalPages }`.
```typescript
// hooks/use-items.test.tsx
import { createWrapper, renderHook, waitFor } from '@/test/utils';

import { MARKETING_ITEM, SALES_ITEM } from '../../tests/fixtures/items';

import { useItems } from './use-items';

describe('useItems', () => {
    it('pobiera listę elementów', async () => {
        const { result } = renderHook(() => useItems({}), {
            wrapper: createWrapper(),
        });

        // Początkowo ładowanie
        expect(result.current.isPending).toBe(true);

        // Poczekaj na dane
        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        // Dosłowny wynik: pusta tablica albo undefined nie przejdą
        expect(result.current.data).toEqual({ items: [MARKETING_ITEM, SALES_ITEM], totalPages: 1 });
    });

    it('filtruje po kategorii', async () => {
        const { result } = renderHook(() => useItems({ category: 'marketing' }), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        // Handler filtruje po ?category, więc hook, który nie wyśle kategorii, dostanie oba elementy
        expect(result.current.data?.items).toEqual([MARKETING_ITEM]);
    });
});
```

Asercja `data?.items.every((item) => item.category === 'marketing')` przechodzi dla pustej tablicy, więc nie złapie hooka, który zgubił dane; przy handlerze bez filtrowania nie sprawdza też, czy hook w ogóle wysłał kategorię. Konkretne wejście (`{ category: 'marketing' }`) i dosłowny wynik (`[MARKETING_ITEM]`) łapią oba błędy.

### Hook useMutation

`useCreateItem` leży w tym samym pliku co `useItems` (`hooks/use-items.ts`), więc test importuje go z `./use-items`.
```typescript
// hooks/use-items.test.tsx (cd.)
import { http, HttpResponse } from 'msw';

import { API_URL } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import { act, createWrapper, renderHook, waitFor } from '@/test/utils';

import { FIXTURE_CREATED_AT, NEW_ITEM_ID } from '../../tests/fixtures/items';

import { useCreateItem } from './use-items';

describe('useCreateItem', () => {
    it('tworzy nowy element', async () => {
        const { result } = renderHook(() => useCreateItem(), {
            wrapper: createWrapper(),
        });

        // React 19: użyj async act dla mutacji
        await act(async () => {
            result.current.mutate({ name: 'New Item', category: 'hr' });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual({
            id: NEW_ITEM_ID,
            name: 'New Item',
            category: 'hr',
            created_at: FIXTURE_CREATED_AT,
        });
    });

    it('obsługuje błąd', async () => {
        // Nadpisz handler żeby zwracał błąd w kopercie
        server.use(
            http.post(`${API_URL}/items`, () => {
                return HttpResponse.json(
                    { data: null, error: { code: 'ITEM_INVALID', message: 'Nieprawidłowe dane elementu' } },
                    { status: 400 },
                );
            }),
        );

        const { result } = renderHook(() => useCreateItem(), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            result.current.mutate({ name: '', category: 'hr' });
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        // Klient zamienił kopertę błędu na ApiError z kodem i statusem
        expect(result.current.error).toMatchObject({ code: 'ITEM_INVALID', status: 400 });
    });
});
```

### React 19: Async Act

W React 19 aktualizacje stanu mogą być asynchroniczne. Dla mutacji i akcji używaj `async act`:
```typescript
// ✅ React 19 - async act
await act(async () => {
    result.current.mutate(data);
});

// ❌ Stary sposób - może powodować ostrzeżenia w React 19
act(() => {
    result.current.mutate(data);
});
```

**Kiedy async act:**
- Mutacje (useMutation)
- useOptimistic
- useTransition
- Każda operacja która triggeruje async state update

---

## Testowanie Formularzy

Testy dotyczą `ContactForm` z [forms.md](./forms.md): `ContactForm({ onSuccess }: { onSuccess?: () => void })`, `useForm({ mode: 'onTouched' })` (pole sprawdzane po pierwszym opuszczeniu, potem przy każdej zmianie; wysłanie sprawdza wszystkie pola), schemat `contactSchema` (imię 2–100 znaków, email, wiadomość 10–2000 znaków), wysyłka przez `useSendContact()` → `contactService.send`, `onError` z `logger.error('CONTACT_SEND_FAILED', error)` i toastem, po sukcesie reset i `onSuccess?.()`. Pole z błędem ma `aria-invalid` i `aria-describedby` wskazujące komunikat z `role="alert"`; bez błędu atrybutu `aria-invalid` nie ma.

Schemat nie ustala treści komunikatów, więc testy sprawdzają błąd przez role i atrybuty, a nie przez tekst. jsdom, tak jak przeglądarka, blokuje wysyłkę formularza z niespełnionym `required` albo `type="email"`, zanim zadziała Zod — dlatego niepoprawny email w teście (`jan@example`) przechodzi walidację przeglądarki i odpada dopiero na schemacie.
```typescript
// components/contact-form.test.tsx
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';

import { logger } from '@/lib/logger';
import { API_URL } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import { render, screen, waitFor } from '@/test/utils';

import { ContactForm } from './contact-form';

const VALID_CONTACT = {
    name: 'Jan Kowalski',
    email: 'jan@example.com',
    message: 'To jest testowa wiadomość do formularza',
};

async function fillValidForm(user: UserEvent): Promise<void> {
    await user.type(screen.getByLabelText(/imię/i), VALID_CONTACT.name);
    await user.type(screen.getByLabelText(/email/i), VALID_CONTACT.email);
    await user.type(screen.getByLabelText(/wiadomość/i), VALID_CONTACT.message);
}

describe('ContactForm', () => {
    it('renderuje wszystkie pola', () => {
        render(<ContactForm />);

        expect(screen.getByLabelText(/imię/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/wiadomość/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /wyślij/i })).toBeInTheDocument();
    });

    it('wyświetla błędy walidacji', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        // Kliknij submit bez wypełnienia
        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        // Trzy pola z błędem — trzy komunikaty, więc getAllByRole (getByRole rzuciłby wyjątek)
        expect(await screen.findAllByRole('alert')).toHaveLength(3);
        expect(screen.getByLabelText(/imię/i)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText(/wiadomość/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('waliduje email', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        await user.type(screen.getByLabelText(/imię/i), VALID_CONTACT.name);
        await user.type(screen.getByLabelText(/email/i), 'jan@example');
        await user.type(screen.getByLabelText(/wiadomość/i), VALID_CONTACT.message);
        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        // Dokładnie jeden błąd — przy emailu, powiązany z polem przez aria-describedby
        expect(await screen.findAllByRole('alert')).toHaveLength(1);
        const emailInput = screen.getByLabelText(/email/i);
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
        expect(emailInput).toHaveAccessibleDescription(/.+/);
        expect(screen.getByLabelText(/imię/i)).not.toHaveAttribute('aria-invalid');
    });

    it('wysyła formularz z poprawnymi danymi', async () => {
        const user = userEvent.setup();
        const onSuccess = vi.fn();
        const receivedBodies: unknown[] = [];
        server.use(
            http.post(`${API_URL}/contact`, async ({ request }) => {
                receivedBodies.push(await request.json());
                return HttpResponse.json({ data: { id: 'message-1' }, error: null }, { status: 201 });
            }),
        );

        render(<ContactForm onSuccess={onSuccess} />);
        await fillValidForm(user);
        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        // onSuccess?.() wołany bez argumentów, raz
        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalledExactlyOnceWith();
        });
        // Obserwowalny skutek: serwer dostał dokładnie te dane
        expect(receivedBodies).toEqual([VALID_CONTACT]);
    });

    it('wyświetla loading podczas wysyłania', async () => {
        const user = userEvent.setup();
        // Odpowiedź, która nie przychodzi — stan wysyłania trwa do końca testu
        server.use(
            http.post(`${API_URL}/contact`, async () => {
                await delay('infinite');
                return HttpResponse.json({ data: null, error: null });
            }),
        );
        render(<ContactForm />);

        await fillValidForm(user);
        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        expect(await screen.findByRole('button', { name: /wysyłanie/i })).toBeDisabled();
    });

    it('czyści formularz po sukcesie', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        await fillValidForm(user);
        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        await waitFor(() => {
            expect(screen.getByLabelText(/imię/i)).toHaveValue('');
        });
        expect(screen.getByLabelText(/email/i)).toHaveValue('');
        expect(screen.getByLabelText(/wiadomość/i)).toHaveValue('');
    });

    it('przy błędzie wysyłki zostawia dane i ślad dla operatora', async () => {
        const user = userEvent.setup();
        const onSuccess = vi.fn();
        // Logger działa naprawdę; spy tylko podsłuchuje, z jakim kodem zapisał błąd
        const loggerErrorSpy = vi.spyOn(logger, 'error');
        server.use(
            http.post(`${API_URL}/contact`, () => {
                return HttpResponse.json(
                    { data: null, error: { code: 'INTERNAL', message: 'Błąd serwera' } },
                    { status: 500 },
                );
            }),
        );

        render(<ContactForm onSuccess={onSuccess} />);
        await fillValidForm(user);
        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        await waitFor(() => {
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                'CONTACT_SEND_FAILED',
                expect.objectContaining({ code: 'INTERNAL', status: 500 }),
            );
        });
        expect(screen.getByLabelText(/imię/i)).toHaveValue(VALID_CONTACT.name);
        expect(onSuccess).not.toHaveBeenCalled();
    });
});
```

### Testowanie Select/Checkbox
```typescript
import userEvent from '@testing-library/user-event';

import { render, screen } from '@/test/utils';

import { ItemForm } from './item-form';

test('wybiera kategorię z Select', async () => {
    const user = userEvent.setup();
    render(<ItemForm />);

    // Otwórz select (shadcn/ui Select)
    await user.click(screen.getByRole('combobox'));

    // Wybierz opcję
    await user.click(screen.getByRole('option', { name: /marketing/i }));

    expect(screen.getByRole('combobox')).toHaveTextContent(/marketing/i);
});

test('zaznacza checkbox', async () => {
    const user = userEvent.setup();
    render(<ItemForm />);

    const checkbox = screen.getByRole('checkbox', { name: /publiczny/i });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
});
```

---

## Testowanie Routingu
```typescript
// pages/item-page.test.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { createTestQueryClient } from '@/test/utils';

import { MARKETING_ITEM, MISSING_ITEM_ID } from '../../tests/fixtures/items';

// Strona ładowana przez lazy() ma default export
import ItemPage from './item-page';

function renderWithRouter(initialEntry: string): RenderResult {
    return render(
        <QueryClientProvider client={createTestQueryClient()}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path="/items/:id" element={<ItemPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe('ItemPage', () => {
    it('wyświetla element na podstawie ID z URL', async () => {
        renderWithRouter(`/items/${MARKETING_ITEM.id}`);

        expect(await screen.findByText(MARKETING_ITEM.name)).toBeInTheDocument();
    });

    it('wyświetla 404 dla nieistniejącego elementu', async () => {
        renderWithRouter(`/items/${MISSING_ITEM_ID}`);

        expect(await screen.findByText(/nie znaleziono/i)).toBeInTheDocument();
    });
});
```

`render` z `@/test/utils` dokłada własny wrapper z `MemoryRouter`, a router w routerze React Router odrzuca. Tu drzewo tras budujesz sam, dlatego test bierze `render` wprost z Testing Library i ten sam klient testowy (`createTestQueryClient`). Identyfikatory w URL są UUID z fixture'a, bo strona parsuje parametr ścieżki schematem Zod (`z.uuid()`), zanim zapyta serwer.

---

## Testowanie Dostępności

### Podstawowe Asercje
```typescript
import userEvent from '@testing-library/user-event';

import { ContactForm } from '@/components/contact-form';
import { render, screen, waitFor } from '@/test/utils';

test('formularz ma poprawne aria atrybuty', () => {
    render(<ContactForm />);

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('type', 'email');
    // Bez błędu atrybutu nie ma wcale (aria-invalid={errors.email ? true : undefined})
    expect(emailInput).not.toHaveAttribute('aria-invalid');
});

test('wyświetla błąd z aria-invalid', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.click(screen.getByRole('button', { name: /wyślij/i }));

    await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    });
});

test('komunikat błędu ma role="alert"', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.click(screen.getByRole('button', { name: /wyślij/i }));

    // Puste pola dają trzy komunikaty, więc getAllByRole — getByRole rzuciłby wyjątek przy kilku
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(3);
    expect(alerts.map((alert) => alert.id)).toContain('email-error');
});
```

### axe-core (Automatyczne Testy A11y)

Sprawdź package.json; nową zależność zgłoś (w workflowie: w odchyleniach). Instalujesz menedżerem z lockfile projektu z dokładną wersją, np.:
```bash
pnpm add -D -E @axe-core/react jest-axe @types/jest-axe
```
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

import { ContactForm } from '@/components/contact-form';
import { render, screen } from '@/test/utils';

expect.extend(toHaveNoViolations);

test('formularz nie ma naruszeń a11y', async () => {
    const { container } = render(<ContactForm />);
    // Bez tej asercji pusty kontener też „nie ma naruszeń”
    expect(screen.getByRole('button', { name: /wyślij/i })).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
});
```

---

## Mockowanie

Atrapy zastępują tylko usługi zewnętrzne: HTTP, Supabase, SDK firm trzecich. Własne moduły (`@/lib/*`, `@/services/*`, `@/hooks/*`, providery) w teście działają naprawdę — atrapa własnego modułu sprawdza atrapę, więc test przechodzi także wtedy, gdy prawdziwy moduł jest zepsuty.

### vi.fn() - Atrapa Callbacku
`vi.fn()` zastępuje callback przekazany w propsach (`onSelect`, `onSuccess`) albo funkcję klienta usługi zewnętrznej. Wywołanie atrapy sprawdzasz z argumentami — samo „została wywołana” przechodzi przy złych danych.
```typescript
const handleSelect = vi.fn();

// Sprawdzenie wywołań — z argumentami
expect(handleSelect).toHaveBeenCalledWith('item-1');
expect(handleSelect).toHaveBeenCalledExactlyOnceWith('item-1'); // jedno wywołanie, te argumenty
expect(handleSelect).toHaveBeenNthCalledWith(2, 'item-2');      // drugie wywołanie
expect(handleSelect).not.toHaveBeenCalled();                    // brak wywołania — jedyna forma bez argumentów

// Wartość zwracana atrapy; odrzucenie typowanym błędem z kodem, jak w kodzie aplikacji
// import { ApiError } from '@/lib/errors';
handleSelect.mockReturnValue(true);
handleSelect.mockResolvedValue({ id: 'item-1' });
handleSelect.mockRejectedValue(new ApiError('ITEM_SELECT_FAILED', 'Serwer niedostępny', 503));

// Reset (przy clearMocks/restoreMocks w vitest.config.ts robi to Vitest po każdym teście)
handleSelect.mockClear();  // Czyści wywołania
handleSelect.mockReset();  // Czyści wywołania i implementację
```

### Usługi zewnętrzne: MSW zamiast vi.mock()
HTTP do własnego API zastępujesz handlerem MSW (sekcja [MSW](#msw---mockowanie-api)). Supabase też: supabase-js woła `fetch`, więc MSW przechwytuje `/rest/v1/*` i `/auth/v1/*`, a klient, serwisy i hooki działają naprawdę.
```typescript
// src/test/mocks/supabase-handlers.ts
import { http, HttpResponse } from 'msw';

import { TEST_SESSION, TEST_USER } from '../../../tests/fixtures/auth';
import { ITEMS_FIXTURE } from '../../../tests/fixtures/items';

// .env.test: VITE_SUPABASE_URL=http://localhost:54321
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const supabaseHandlers = [
    // supabase.from('items').select() → GET /rest/v1/items (PostgREST odpowiada samą tablicą)
    http.get(`${SUPABASE_URL}/rest/v1/items`, () => HttpResponse.json(ITEMS_FIXTURE)),

    // supabase.auth.signInWithPassword() → POST /auth/v1/token?grant_type=password
    http.post(`${SUPABASE_URL}/auth/v1/token`, () => HttpResponse.json(TEST_SESSION)),

    // supabase.auth.getUser() → GET /auth/v1/user
    http.get(`${SUPABASE_URL}/auth/v1/user`, () => HttpResponse.json(TEST_USER)),
];
```

`vi.mock()` zostaje dla SDK usługi zewnętrznej, której ruchu nie przechwycisz na poziomie sieci, np. biblioteki analitycznej:
```typescript
import posthog from 'posthog-js';

vi.mock('posthog-js', () => ({
    default: { capture: vi.fn() },
}));

test('zapisuje zdarzenie wysłania formularza', async () => {
    // ... wypełnienie i wysłanie formularza ...
    expect(posthog.capture).toHaveBeenCalledWith('contact_form_sent', { source: 'footer' });
});
```

### vi.spyOn() - Ślad dla Operatora
Kod aplikacji nie pisze do konsoli, tylko do loggera (skill sentry-integration), więc spy na `console` nie ma czego sprawdzać. Gdy test ma potwierdzić ślad dla operatora, podsłuchujesz `logger.error` — spy bez `mockImplementation` przepuszcza wywołanie do prawdziwego loggera — i sprawdzasz kod błędu oraz przyczynę.
```typescript
import { logger } from '@/lib/logger';

const loggerErrorSpy = vi.spyOn(logger, 'error');

// Test wywołujący błąd zapisu (handler MSW zwraca kopertę z error)...

expect(loggerErrorSpy).toHaveBeenCalledWith(
    'ITEM_CREATE_FAILED',
    expect.objectContaining({ code: 'INTERNAL', status: 500 }),
);
// restoreMocks: true w vitest.config.ts przywraca oryginał po teście
```

---

## Hooki z Kontekstem

### Prawdziwy Provider zamiast Atrapy Hooka
Hook z kontekstem (`useAuth`) testujesz przez prawdziwy provider. Atrapa `vi.mock('@/hooks/use-auth')` sprawdza tylko, czy komponent wyświetla to, co zwróciła atrapa — przejdzie także wtedy, gdy AuthProvider źle mapuje sesję albo hook zmienił kształt. Atrapą jest serwer Supabase (handlery wyżej), a stan logowania ustawiasz tak jak aplikacja — przez klienta.
```typescript
// tests/fixtures/auth.ts
import { FIXTURE_CREATED_AT } from './items';

export const TEST_USER = {
    id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: { name: 'Test' },
    created_at: FIXTURE_CREATED_AT,
};

export const TEST_SESSION = {
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'test-refresh-token',
    user: TEST_USER,
};
```
```typescript
// components/user-profile.test.tsx
import { AuthProvider } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { render, screen } from '@/test/utils';

import { TEST_USER } from '../../tests/fixtures/auth';

import { UserProfile } from './user-profile';

afterEach(() => {
    // supabase-js trzyma sesję w localStorage — czyścisz ją, żeby testy były niezależne
    localStorage.clear();
});

test('wyświetla dane zalogowanego użytkownika', async () => {
    // Logowanie przez prawdziwego klienta; MSW odpowiada sesją z fixture'a
    const { error } = await supabase.auth.signInWithPassword({
        email: TEST_USER.email,
        password: 'test-password',
    });
    expect(error).toBeNull();

    render(
        <AuthProvider>
            <UserProfile />
        </AuthProvider>
    );

    expect(await screen.findByText('Test')).toBeInTheDocument();
});

test('niezalogowanemu pokazuje zaproszenie do logowania', async () => {
    render(
        <AuthProvider>
            <UserProfile />
        </AuthProvider>
    );

    expect(await screen.findByText(/zaloguj się/i)).toBeInTheDocument();
});
```

---

## Testowanie Timers
```typescript
import userEvent from '@testing-library/user-event';

import { SearchInput } from '@/components/search-input';
import { act, render, screen } from '@/test/utils';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

test('debounce search', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSearch = vi.fn();

    render(<SearchInput onSearch={onSearch} debounceMs={300} />);

    await user.type(screen.getByRole('textbox'), 'test');

    // Przed upływem debounce
    expect(onSearch).not.toHaveBeenCalled();

    // Przesuń czas; act, bo timer aktualizuje stan komponentu
    act(() => {
        vi.advanceTimersByTime(300);
    });

    // Jedno wywołanie z pełną frazą, nie po jednym na każdą literę
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('test');
});
```

---

## Snapshoty DOM — Zamiast Nich Asercje na Role i Tekst

Snapshotu DOM (`expect(container.firstChild).toMatchSnapshot()`) nie stosujesz. Utrwala kształt drzewa, a nie zachowanie: pada przy każdej zmianie klasy Tailwinda, więc przy aktualizacji snapshotu nikt nie czyta różnicy, a pierwszy zapis utrwala to, co komponent akurat renderuje — także błąd. To, co snapshot miał chronić, opisujesz asercjami na role, nazwy dostępne i tekst:
```typescript
import { render, screen } from '@/test/utils';

import { MARKETING_ITEM } from '../../tests/fixtures/items';

import { ItemCard } from './item-card';

test('renderuje kartę elementu', () => {
    render(<ItemCard item={MARKETING_ITEM} />);

    expect(screen.getByRole('heading', { name: 'Item 1' })).toBeInTheDocument();
    expect(screen.getByText('marketing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /zobacz/i })).toHaveAttribute(
        'href',
        `/items/${MARKETING_ITEM.id}`,
    );
});
```

Inline snapshot pojedynczej wartości (`toMatchInlineSnapshot('"Item 1"')`) zastępujesz asercją z tą wartością wprost (`toHaveTextContent('Item 1')`), bo czyta się ją bez znajomości mechanizmu snapshotów i nie da się jej zaktualizować jednym przełącznikiem.

---

## Struktura Testów

### Organizacja Plików
Testy leżą obok plików źródłowych; wspólne fixture'y — w `tests/fixtures/`.
```
src/
├── components/
│   ├── item-card.tsx
│   ├── item-card.test.tsx       # Unit test
│   └── contact-form/
│       ├── contact-form.tsx
│       ├── contact-form.test.tsx
│       └── contact-form.integration.test.tsx
├── hooks/
│   ├── use-items.ts
│   └── use-items.test.tsx
├── services/
│   ├── item-service.ts
│   └── item-service.test.ts
├── pages/
│   ├── home-page.tsx
│   └── home-page.test.tsx
└── test/
    ├── setup.ts
    ├── utils.tsx
    └── mocks/
        ├── handlers.ts
        ├── supabase-handlers.ts
        └── server.ts
tests/
└── fixtures/
    ├── auth.ts
    └── items.ts
```

### Konwencje Nazewnictwa

Nazwy plików w kebab-case, jak pliki źródłowe.

| Typ | Nazwa pliku |
|-----|-------------|
| Unit test | `item-card.test.tsx` |
| Integration test | `contact-form.integration.test.tsx` |
| E2E test | `checkout.e2e.test.ts` (Playwright - osobny folder) |

---

## Coverage

### Uruchomienie

Skrypt uruchamiasz menedżerem z lockfile projektu, np.:
```bash
pnpm test:coverage
```

### Progi w vitest.config.ts
```typescript
export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
```

### Co Testować vs Nie Testować

| Testuj | Nie testuj |
|--------|------------|
| Logika biznesowa | Implementacje bibliotek (React Query, RHF) |
| Custom hooks | Wewnętrzny stan komponentu (testujesz DOM) |
| Formularze (walidacja, submit) | Typy TypeScript |
| Integracja z API (przez MSW) | CSS/Styling |
| Edge cases, error handling | Kod third-party |
| Komponenty prezentacyjne: to, co widzi użytkownik | Szczegóły drzewa DOM (snapshoty) |

Każda nowa funkcja publiczna — także komponent prezentacyjny — ma test ścieżki poprawnej i test błędu (reguły kodu, sekcja Testowanie). Dla komponentu prezentacyjnego ścieżka błędu to zwykle brak danych albo wariant błędu z propsów.

---

## Dobre Praktyki

### 1. Testuj Zachowanie, Nie Implementację
```typescript
// ❌ Źle - testuje implementację
expect(component.state.isOpen).toBe(true);

// ✅ Dobrze - testuje zachowanie
expect(screen.getByRole('dialog')).toBeInTheDocument();
```

### 2. Używaj Role zamiast Test ID
```typescript
// ❌ Mniej preferowane
screen.getByTestId('submit-button');

// ✅ Preferowane - accessibility-first
screen.getByRole('button', { name: /wyślij/i });
```

### 3. Jeden Koncept na Test
```typescript
// ❌ Za dużo w jednym teście
test('formularz działa', async () => {
    // renderowanie
    // walidacja
    // submit
    // reset
    // error handling
});

// ✅ Osobne testy
test('wyświetla błędy walidacji', async () => { ... });
test('wysyła dane po wypełnieniu', async () => { ... });
test('resetuje po sukcesie', async () => { ... });
```

### 4. Arrange-Act-Assert
```typescript
test('dodaje element do listy', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<TodoList />);

    // Act
    await user.type(screen.getByRole('textbox'), 'Nowe zadanie');
    await user.click(screen.getByRole('button', { name: /dodaj/i }));

    // Assert
    expect(screen.getByText('Nowe zadanie')).toBeInTheDocument();
});
```

---

## Debugowanie

Narzędzia poniżej wypisują do konsoli w trakcie diagnozy; wywołania usuwasz z testu, zanim go zostawisz.

### screen.debug()
```typescript
test('debug', () => {
    render(<Component />);
    screen.debug(); // Wypisuje DOM do konsoli
    screen.debug(screen.getByRole('button')); // Konkretny element
});
```

### logRoles()
```typescript
import { logRoles } from '@testing-library/react';

test('pokaż role', () => {
    const { container } = render(<Component />);
    logRoles(container); // Wypisuje wszystkie role ARIA
});
```

### Testing Playground
```typescript
screen.logTestingPlaygroundURL(); // Generuje URL do testing-playground.com
```

---

## Zobacz Także

- [component-patterns.md](./component-patterns.md) - Error Boundaries
- [forms.md](./forms.md) - React Hook Form + Zod
- [loading-and-error-states.md](./loading-and-error-states.md) - React Query patterns
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
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
```

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

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
        "types": ["vitest/globals", "@testing-library/jest-dom"]
    }
}
```

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

### src/test/mocks/handlers.ts
```typescript
import { http, HttpResponse } from 'msw';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Przykładowe dane
const mockItems = [
    { id: '1', name: 'Item 1', category: 'marketing' },
    { id: '2', name: 'Item 2', category: 'sales' },
];

export const handlers = [
    // GET /items
    http.get(`${API_URL}/items`, () => {
        return HttpResponse.json(mockItems);
    }),

    // GET /items/:id
    http.get(`${API_URL}/items/:id`, ({ params }) => {
        const item = mockItems.find((t) => t.id === params.id);
        
        if (!item) {
            return new HttpResponse(null, { status: 404 });
        }
        
        return HttpResponse.json(item);
    }),

    // POST /items
    http.post(`${API_URL}/items`, async ({ request }) => {
        const body = await request.json();
        const newItem = { id: '3', ...body };
        return HttpResponse.json(newItem, { status: 201 });
    }),

    // DELETE /items/:id
    http.delete(`${API_URL}/items/:id`, ({ params }) => {
        return new HttpResponse(null, { status: 204 });
    }),
];
```

### src/test/mocks/server.ts
```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Nadpisywanie Handlerów w Testach
```typescript
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';

test('obsługuje błąd serwera', async () => {
    // Nadpisz handler tylko dla tego testu
    server.use(
        http.get('http://localhost:3000/api/items', () => {
            return new HttpResponse(null, { status: 500 });
        })
    );

    render(<ItemList />);
    
    await waitFor(() => {
        expect(screen.getByText(/błąd/i)).toBeInTheDocument();
    });
});
```

---

## Testowanie Komponentów

### Podstawowy Test
```typescript
// components/Button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

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

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('jest wyłączony gdy disabled', () => {
        render(<Button disabled>Kliknij</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
```

### Test z Async
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { Toaster } from 'sonner';
import { type ReactElement, type ReactNode } from 'react';

// QueryClient dla testów - bez retry, bez cache
function createTestQueryClient() {
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

function createWrapper(initialEntries: string[] = ['/']) {
    return function Wrapper({ children }: WrapperProps) {
        const queryClient = createTestQueryClient();

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
) {
    return render(ui, { 
        wrapper: createWrapper(initialEntries), 
        ...options 
    });
}

// Re-export wszystkiego
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient };
```

**Dlaczego MemoryRouter:**
- `BrowserRouter` używa globalnej historii przeglądarki
- W JSDOM może powodować wycieki stanu między testami
- `MemoryRouter` izoluje każdy test

### Użycie
```typescript
// Zamiast import z @testing-library/react
import { render, screen, waitFor } from '@/test/utils';

test('komponent z React Query', async () => {
    render(<ItemList />);
    
    await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
    });
});

// Z konkretną ścieżką początkową
test('strona szczegółów', async () => {
    render(<ItemPage />, { initialEntries: ['/items/1'] });
    
    await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
    });
});
```

---

## Testowanie React Query

### Hook useQuery
```typescript
// hooks/useItems.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useItems } from './useItems';

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

describe('useItems', () => {
    it('pobiera listę elementów', async () => {
        const { result } = renderHook(() => useItems(), {
            wrapper: createWrapper(),
        });

        // Początkowo loading
        expect(result.current.isLoading).toBe(true);

        // Poczekaj na dane
        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toHaveLength(2);
        expect(result.current.data?.[0].name).toBe('Item 1');
    });

    it('filtruje po kategorii', async () => {
        const { result } = renderHook(() => useItems('marketing'), {
            wrapper: createWrapper(),
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        // Zakładając że handler obsługuje filtrowanie
        expect(result.current.data?.every((t) => t.category === 'marketing')).toBe(true);
    });
});
```

### Hook useMutation
```typescript
// hooks/useCreateItem.test.tsx
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCreateItem } from './useCreateItem';

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

        expect(result.current.data?.name).toBe('New Item');
    });

    it('obsługuje błąd', async () => {
        // Nadpisz handler żeby zwracał błąd
        server.use(
            http.post('http://localhost:3000/api/items', () => {
                return new HttpResponse(null, { status: 400 });
            })
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

### React Hook Form + Zod
```typescript
// components/ContactForm.test.tsx
import { render, screen, waitFor } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { ContactForm } from './ContactForm';

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

        await waitFor(() => {
            expect(screen.getByText(/minimum 2 znaki/i)).toBeInTheDocument();
            expect(screen.getByText(/nieprawidłowy.*email/i)).toBeInTheDocument();
        });
    });

    it('waliduje email', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        await user.type(screen.getByLabelText(/email/i), 'invalid-email');
        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        await waitFor(() => {
            expect(screen.getByText(/nieprawidłowy.*email/i)).toBeInTheDocument();
        });
    });

    it('wysyła formularz z poprawnymi danymi', async () => {
        const user = userEvent.setup();
        const onSuccess = vi.fn();

        render(<ContactForm onSuccess={onSuccess} />);

        await user.type(screen.getByLabelText(/imię/i), 'Jan Kowalski');
        await user.type(screen.getByLabelText(/email/i), 'jan@example.com');
        await user.type(screen.getByLabelText(/wiadomość/i), 'To jest testowa wiadomość do formularza');

        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it('wyświetla loading podczas wysyłania', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        await user.type(screen.getByLabelText(/imię/i), 'Jan Kowalski');
        await user.type(screen.getByLabelText(/email/i), 'jan@example.com');
        await user.type(screen.getByLabelText(/wiadomość/i), 'To jest testowa wiadomość');

        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        expect(screen.getByText(/wysyłanie/i)).toBeInTheDocument();
    });

    it('czyści formularz po sukcesie', async () => {
        const user = userEvent.setup();
        render(<ContactForm />);

        const nameInput = screen.getByLabelText(/imię/i);
        await user.type(nameInput, 'Jan Kowalski');
        await user.type(screen.getByLabelText(/email/i), 'jan@example.com');
        await user.type(screen.getByLabelText(/wiadomość/i), 'To jest testowa wiadomość');

        await user.click(screen.getByRole('button', { name: /wyślij/i }));

        await waitFor(() => {
            expect(nameInput).toHaveValue('');
        });
    });
});
```

### Testowanie Select/Checkbox
```typescript
import { render, screen, waitFor } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { ItemForm } from './ItemForm';

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
// pages/ItemPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ItemPage } from './ItemPage';

function renderWithRouter(initialEntry: string) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return render(
        <QueryClientProvider client={queryClient}>
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
        renderWithRouter('/items/1');

        await waitFor(() => {
            expect(screen.getByText('Item 1')).toBeInTheDocument();
        });
    });

    it('wyświetla 404 dla nieistniejącego elementu', async () => {
        renderWithRouter('/items/999');

        await waitFor(() => {
            expect(screen.getByText(/nie znaleziono/i)).toBeInTheDocument();
        });
    });
});
```

---

## Testowanie Dostępności

### Podstawowe Asercje
```typescript
import { render, screen } from '@/test/utils';

test('formularz ma poprawne aria atrybuty', () => {
    render(<ContactForm />);

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('type', 'email');
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

    await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });
});
```

### axe-core (Automatyczne Testy A11y)
```bash
npm install -D @axe-core/react jest-axe @types/jest-axe
```
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('formularz nie ma naruszeń a11y', async () => {
    const { container } = render(<ContactForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
});
```

---

## Mockowanie

### vi.fn() - Mock Funkcji
```typescript
const mockFn = vi.fn();

// Sprawdzenie wywołań
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');

// Mock return value
mockFn.mockReturnValue('mocked');
mockFn.mockResolvedValue('async mocked');
mockFn.mockRejectedValue(new Error('error'));

// Reset
mockFn.mockClear();  // Czyści wywołania
mockFn.mockReset();  // Czyści wywołania i implementację
```

### vi.mock() - Mock Modułów
```typescript
// Mock całego modułu
vi.mock('@/lib/api', () => ({
    api: {
        getTemplates: vi.fn().mockResolvedValue([]),
        createTemplate: vi.fn(),
    },
}));

// Mock z partial
vi.mock('@/hooks/useAuth', async () => {
    const actual = await vi.importActual('@/hooks/useAuth');
    return {
        ...actual,
        useAuth: () => ({
            user: { id: '1', name: 'Test User' },
            isAuthenticated: true,
        }),
    };
});
```

### vi.spyOn() - Spy na Metodach
```typescript
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Test...

expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('error'));
consoleSpy.mockRestore();
```

---

## Mockowanie Hooków

### Custom Hook z Kontekstem
```typescript
// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
    useAuth: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';

const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
    mockUseAuth.mockReturnValue({
        user: { id: '1', name: 'Test' },
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
    });
});

test('wyświetla dane zalogowanego użytkownika', () => {
    render(<UserProfile />);
    expect(screen.getByText('Test')).toBeInTheDocument();
});

test('przekierowuje niezalogowanego', () => {
    mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        login: vi.fn(),
        logout: vi.fn(),
    });

    render(<UserProfile />);
    expect(screen.getByText(/zaloguj się/i)).toBeInTheDocument();
});
```

---

## Testowanie Timers
```typescript
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

    // Przesuń czas
    vi.advanceTimersByTime(300);

    expect(onSearch).toHaveBeenCalledWith('test');
});
```

---

## Snapshot Testing
```typescript
test('renderuje poprawnie', () => {
    const { container } = render(<ItemCard template={mockTemplate} />);
    expect(container.firstChild).toMatchSnapshot();
});

// Inline snapshot
test('renderuje tytuł', () => {
    render(<ItemCard template={mockTemplate} />);
    expect(screen.getByRole('heading').textContent).toMatchInlineSnapshot(`"Template 1"`);
});
```

**Uwaga:** Używaj snapshot testing oszczędnie - łatwo generują false positives.

---

## Struktura Testów

### Organizacja Plików
```
src/
├── components/
│   ├── Button.tsx
│   ├── Button.test.tsx          # Unit test
│   └── ContactForm/
│       ├── ContactForm.tsx
│       ├── ContactForm.test.tsx
│       └── ContactForm.integration.test.tsx
├── hooks/
│   ├── useItems.ts
│   └── useItems.test.tsx
├── pages/
│   ├── HomePage.tsx
│   └── HomePage.test.tsx
└── test/
    ├── setup.ts
    ├── utils.tsx
    └── mocks/
        ├── handlers.ts
        └── server.ts
```

### Konwencje Nazewnictwa

| Typ | Nazwa pliku |
|-----|-------------|
| Unit test | `Component.test.tsx` |
| Integration test | `Component.integration.test.tsx` |
| E2E test | `feature.e2e.test.ts` (Playwright - osobny folder) |

---

## Coverage

### Uruchomienie
```bash
npm run test:coverage
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
| Custom hooks | Proste komponenty prezentacyjne |
| Formularze (walidacja, submit) | Typy TypeScript |
| Integracja z API (przez MSW) | CSS/Styling |
| Edge cases, error handling | Kod third-party |

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
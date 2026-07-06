# React Sentry Patterns

Szczegółowe wzorce integracji Sentry z React 19 + Vite + TypeScript.

> **✅ SDK v10 Ready (Stan: Marzec 2026)**
>
> Te wzorce są zgodne z Sentry SDK v10+, który używa:
> - Funkcyjnych integracji (`browserTracingIntegration()` zamiast `new BrowserTracing()`)
> - API `startSpan()` zamiast `startTransaction()`
> - Uproszczonej konfiguracji Session Replay
> - `reactErrorHandler()` dla React 19 error hooków
> - INP (Interaction to Next Paint) zamiast FID

## Table of Contents

- [Instalacja](#instalacja)
- [Konfiguracja Sentry](#konfiguracja-sentry)
- [Source Maps (Vite)](#source-maps-vite)
- [Error Boundary](#error-boundary)
- [Logger Integration](#logger-integration)
- [User Context](#user-context)
- [Performance Monitoring](#performance-monitoring)
- [Session Replay](#session-replay)
- [Ignorowane Błędy](#ignorowane-błędy)

---

## Instalacja

```bash
npm install @sentry/react
```

**Wymagana wersja:** `@sentry/react >= 10.0.0` (SDK v10)

---

## Konfiguracja Sentry

**Plik: `src/lib/sentry.ts`**

```typescript
import * as Sentry from '@sentry/react';

/**
 * Inicjalizuje Sentry tylko w produkcji
 * Wywołaj w main.tsx PRZED renderowaniem aplikacji
 */
export function initSentry() {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,

      // Release tracking — spina zdarzenia z wersją i source mapami (patrz sekcja Source Maps).
      // Musi zgadzać się z `release` w @sentry/vite-plugin.
      release: import.meta.env.VITE_APP_VERSION,

      // Distributed tracing — dołączaj nagłówki trace do własnego API i Supabase.
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/[a-z0-9-]+\.supabase\.co/,
      ],

      // Obejście ad-blockerów — tuneluj zdarzenia przez własny endpoint (np. proxy /monitoring).
      tunnel: '/monitoring',

      // Performance monitoring - 10% transakcji
      tracesSampleRate: 0.1,

      // Session replay
      replaysSessionSampleRate: 0.1, // 10% normalnych sesji
      replaysOnErrorSampleRate: 1.0, // 100% sesji z błędami

      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          // GDPR: domyślnie maskuj tekst i blokuj media w nagraniach sesji
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // GDPR: Maskowanie danych osobowych
      beforeSend(event) {
        // Maskowanie emaili
        if (event.user?.email) {
          event.user.email = event.user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
        }

        // Usuwanie wrażliwych headers
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }

        return event;
      },

      // Błędy do ignorowania
      ignoreErrors: [
        // Browser errors
        'ResizeObserver loop',
        'Non-Error exception captured',
        'Non-Error promise rejection captured',

        // Network errors
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'AbortError',

        // Chunk loading errors
        /^Loading chunk \d+ failed/,
        /^Loading CSS chunk \d+ failed/,

        // User cancellation
        'AbortError: The user aborted a request',
      ],

      // Filtrowanie breadcrumbs
      beforeBreadcrumb(breadcrumb) {
        // Ignoruj console.log breadcrumbs w produkcji
        if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
          return null;
        }
        return breadcrumb;
      },
    });

    // Ustawienie tagów globalnych
    Sentry.setTags({
      app: import.meta.env.VITE_APP_NAME || 'my-app',
      version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    });
  }
}

/**
 * Ustawia kontekst użytkownika w Sentry
 * Wywołaj przy login/logout
 */
export function setSentryUser(user: { id: string; email: string } | null) {
  if (import.meta.env.PROD) {
    if (user) {
      Sentry.setUser({
        id: user.id,
        // GDPR: Maskowanie emaila
        email: user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
      });
    } else {
      Sentry.setUser(null);
    }
  }
}

/**
 * Ręczne wysłanie błędu z kontekstem
 */
export function captureError(
  error: unknown,
  context?: {
    operation?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  if (import.meta.env.PROD) {
    Sentry.withScope((scope) => {
      if (context?.operation) {
        scope.setTag('operation', context.operation);
      }
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }
      if (context?.extra) {
        scope.setContext('extra', context.extra);
      }
      Sentry.captureException(error);
    });
  } else {
    console.error('[Sentry would capture]:', error, context);
  }
}
```

---

## Source Maps (Vite)

Bez uploadu source map produkcyjny stack trace jest zminifikowany (`a.b is not a function`).
`@sentry/vite-plugin` generuje release, uploaduje source mapy do Sentry i sprząta je z bundla.

**Instalacja:**

```bash
npm install --save-dev @sentry/vite-plugin
```

**Plik: `vite.config.ts`**

```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: 'hidden', // WYMAGANE: generuj mapy, ale nie linkuj ich w bundlu
  },
  plugins: [
    react(),
    // Plugin Sentry MUSI być po pozostałych pluginach
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Token TYLKO z env — NIGDY nie commituj do repo
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Musi zgadzać się z `release` w Sentry.init()
      release: { name: process.env.VITE_APP_VERSION },

      sourcemaps: {
        // Usuń mapy po uploadzie, żeby nie trafiły na produkcję
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    }),
  ],
});
```

**Zmienne (CI/build, NIE w kliencie):**

```env
SENTRY_ORG=twoja-organizacja
SENTRY_PROJECT=twoj-projekt
SENTRY_AUTH_TOKEN=sntrys_xxx   # sekret CI, nie VITE_*
```

> **Uwaga:** `SENTRY_AUTH_TOKEN` to sekret build-time. Nie używaj prefiksu `VITE_`, bo
> zmienne `VITE_*` są wstrzykiwane do bundla klienta i token by wyciekł.

---

## Error Boundary

**Plik: `src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { initSentry } from '@/lib/sentry';
import App from './App';
import './index.css';

// Inicjalizuj Sentry PRZED renderowaniem
initSentry();

// Komponent fallback dla błędów
function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          Coś poszło nie tak
        </h1>
        <p className="text-muted-foreground mb-6">
          Przepraszamy za niedogodności. Spróbuj odświeżyć stronę.
        </p>
        <button
          onClick={resetError}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Spróbuj ponownie
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error} resetError={resetError} />
      )}
      onError={(error, componentStack) => {
        // Dodatkowy kontekst dla React errors
        Sentry.withScope((scope) => {
          scope.setTag('error.type', 'react_error_boundary');
          scope.setContext('componentStack', { stack: componentStack });
        });
      }}
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
```

### React 19 Error Hooks

React 19 wprowadził nowe hooki błędów w `createRoot()`. Sentry obsługuje je przez `reactErrorHandler()`.

**Zaktualizowany `main.tsx` (React 19):**

```typescript
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { initSentry } from '@/lib/sentry';
import App from './App';
import './index.css';

initSentry();

createRoot(document.getElementById('root')!, {
  // Błędy nieprzechwycone przez ErrorBoundary
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn('Uncaught error', error, errorInfo.componentStack);
  }),
  // Błędy przechwycone przez ErrorBoundary (dodatkowy kontekst)
  onCaughtError: Sentry.reactErrorHandler(),
  // Błędy z których React się regeneruje
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <Sentry.ErrorBoundary
    fallback={({ error, resetError }) => (
      <ErrorFallback error={error} resetError={resetError} />
    )}
  >
    <App />
  </Sentry.ErrorBoundary>
);
```

> **Nota:** `Sentry.ErrorBoundary` nadal jest rekomendowane jako uzupełnienie — zapewnia fallback UI. `reactErrorHandler()` przechwytuje błędy, które ErrorBoundary nie łapie (np. w event handlerach).

---

## Logger Integration

**Plik: `src/lib/logger.ts`**

```typescript
import * as Sentry from '@sentry/react';

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Loguje błędy
   * W dev: console.error
   * W prod: wysyła do Sentry
   */
  error(message: string, error?: unknown) {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      Sentry.captureException(error, {
        tags: { source: 'logger' },
        extra: { message },
      });
    }
  },

  /**
   * Loguje ostrzeżenia
   * W dev: console.warn
   * W prod: wysyła jako warning do Sentry
   */
  warn(message: string, data?: unknown) {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, data);
    } else {
      Sentry.captureMessage(message, {
        level: 'warning',
        extra: { data },
      });
    }
  },

  /**
   * Loguje informacje
   * W dev: console.log
   * W prod: cisza (lub opcjonalnie Sentry breadcrumb)
   */
  info(message: string, data?: unknown) {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, data);
    } else {
      // Opcjonalnie: breadcrumb dla kontekstu
      Sentry.addBreadcrumb({
        category: 'info',
        message,
        level: 'info',
        data: data as Record<string, unknown>,
      });
    }
  },

  /**
   * Loguje debug (tylko w dev)
   */
  debug(message: string, data?: unknown) {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  },
};
```

---

## User Context

**Integracja z `useAuth.ts`:**

```typescript
import { setSentryUser } from '@/lib/sentry';

// W useEffect przy zmianie user
useEffect(() => {
  if (user) {
    setSentryUser({
      id: user.id,
      email: user.email || '',
    });
  } else {
    setSentryUser(null);
  }
}, [user]);
```

---

## Performance Monitoring

**Automatyczne śledzenie:**
- Page loads
- Navigation
- API calls (fetch)
- Web Vitals (LCP, INP, CLS)

**Manualne span dla wolnych operacji:**

```typescript
import * as Sentry from '@sentry/react';

async function heavyOperation() {
  return await Sentry.startSpan(
    {
      name: 'heavy-operation',
      op: 'function',
    },
    async () => {
      // Twoja wolna operacja
      const result = await processLargeData();
      return result;
    }
  );
}
```

---

## Session Replay

Session Replay nagrywa sesje użytkowników dla łatwiejszej diagnostyki.

**Konfiguracja:**
- 10% normalnych sesji (`replaysSessionSampleRate: 0.1`)
- 100% sesji z błędami (`replaysOnErrorSampleRate: 1.0`)

**Opcje prywatności:**
```typescript
Sentry.replayIntegration({
  maskAllText: true,      // Maskuj cały tekst
  blockAllMedia: true,    // Blokuj media
  maskAllInputs: true,    // Maskuj inputy
})
```

---

## Ignorowane Błędy

Pełna, kanoniczna lista `ignoreErrors` jest częścią `Sentry.init()` w sekcji
[Konfiguracja Sentry](#konfiguracja-sentry) — nie duplikuj jej, edytuj w jednym miejscu.

Kategorie błędów, które NIE powinny trafiać do Sentry (i dlaczego):

| Kategoria | Przykłady | Dlaczego ignorować |
|-----------|-----------|--------------------|
| Browser quirks | `ResizeObserver loop`, `Non-Error exception captured` | Szum przeglądarki, nie błąd aplikacji |
| Network (user side) | `Failed to fetch`, `Network request failed`, `NetworkError` | Problem łącza użytkownika, nie kodu |
| Chunk loading | `/^Loading chunk \d+ failed/` | Rozwiązuje odświeżenie po deployu |
| User cancellation | `AbortError` | Świadome anulowanie żądania przez usera |

---

## Zmienne Środowiskowe

**`.env.local`:**
```env
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
VITE_APP_VERSION=1.0.0
```

**TypeScript types (`src/vite-env.d.ts`):**
```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

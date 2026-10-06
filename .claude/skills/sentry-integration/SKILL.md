---
name: sentry-integration
description: Sentry error tracking i performance monitoring dla React + Supabase Edge Functions. Aktywuje się przy pracy z błędami, monitoringiem, captureException, error boundary, śledzeniem błędów, diagnostyką, loggerem, Edge Functions, crash, awaria, wydajność, raportowanie błędów, exception, wyjątek.
---

# Sentry Integration Guidelines

Kompleksowy przewodnik integracji Sentry error tracking i performance monitoring dla projektu React + Supabase Edge Functions.

> **Stan SDK**
>
> - **React SDK:** v10+ (funkcyjne integracje, React 19 error hooks) ✅
> - **Edge Functions:** `npm:@sentry/deno@^10` na Deno 2.x, handler `export default { fetch: withSupabase(...) }` ⚠️ — `@sentry/deno` nie ma integracji dla fetch-handlera, więc błędy łapiesz ręcznie (`try/catch` → `captureError`); ustaw `defaultIntegrations: false` (tak robi oficjalny przykład Supabase), używaj `withScope` dla izolacji i `await flush()` przed `Response`

## Table of Contents

- [Critical Rules](#critical-rules)
- [Dobre praktyki (Edge Functions / Supabase)](#dobre-praktyki-edge-functions--supabase)
- [Error Levels](#error-levels)
- [Quick Reference](#quick-reference)
- [Context Enrichment](#context-enrichment)
- [GDPR Compliance](#gdpr-compliance)
- [Checklist dla Nowego Kodu](#checklist-dla-nowego-kodu)
- [Common Mistakes](#common-mistakes)
- [Resources](#resources)

---

## Critical Rules

1. **Nieoczekiwany błąd trafia do Sentry** — wyjątek bez obsługi, awaria usługi albo błąd bazy wysyłasz przez `logger.error` (frontend) albo `captureError` (Edge Functions), bo w produkcji tylko Sentry pokazuje go operatorowi. Oczekiwana odmowa (błąd walidacji, 401, 403, 404, przekroczony limit) zostaje odpowiedzią dla użytkownika bez zdarzenia w Sentry, bo taki szum zakrywa prawdziwe awarie.
2. **W Edge Functions błąd zapisuje `await captureError(...)`** — helper izoluje kontekst zdarzenia (`withScope`) i robi `flush` przed odpowiedzią; sam log funkcji nie wystarcza, bo nikt go nie przegląda, a izolat może zostać zamrożony, zanim zdarzenie wyjdzie.
3. **Dane osobowe maskujesz w jednym miejscu** — `beforeSend` i `setSentryUser` zamieniają email na `us***@example.com`, bo zdarzenie widzi każdy z dostępem do projektu Sentry, a RODO wymaga minimalizacji danych.
4. **Kontekst zdarzenia to identyfikatory i nazwy operacji** — hasła, tokeny, klucze API, nagłówek `Authorization` i ciała żądań zostają poza `setContext`, tagami i breadcrumbami, bo Sentry to zewnętrzny serwis i sekret wysłany tam trzeba uznać za ujawniony.
5. **Poziom odpowiada skutkowi** — `fatal` tylko dla awarii całego systemu, `error` dla nieudanej operacji użytkownika, `warning` dla problemu odwracalnego (tabela Error Levels niżej), bo zawyżony poziom uczy operatora ignorować alerty.

---

## Dobre praktyki (Edge Functions / Supabase)

`@sentry/deno` (v10) działa na Supabase Edge Runtime (Deno 2.x) ze wsparciem `beforeSend`.
Handler piszemy jako `export default { fetch: withSupabase(...) }` (`Deno.serve` to legacy), a
`@sentry/deno` nie ma integracji dla fetch-handlera — instrumentacja jest ręczna (`try/catch`).
Oficjalny przykład Supabase ustawia `defaultIntegrations: false` na Edge Runtime, bo bez tego nie
ma gwarancji scope separation między requestami w tym samym isolate. Nadal stosuj:

| Zasada | Dlaczego |
|--------|----------|
| `defaultIntegrations: false` w `Sentry.init()` | Bezpieczny default dopóki nie zweryfikujesz scope separation na swoim runtime |
| Ustawiaj kontekst przez `Sentry.withScope()` | Izolacja per operacja; unikasz wycieku tagów między requestami |
| Nie ustawiaj globalnych tagów per-request | Globalny scope jest współdzielony w obrębie isolate'u |
| `await Sentry.flush()` przed `Response` | Isolate może zostać zamrożony zaraz po odpowiedzi |
| Maskuj PII w `beforeSend` | Jeden centralny punkt dla wszystkich zdarzeń |

**Wzorzec kontekstu per request:**
```typescript
// ŹLE - kontekst wycieknie do innych requestów
Sentry.setTag('user_id', userId);
Sentry.captureException(error);

// DOBRZE - izolowany scope
Sentry.withScope((scope) => {
  scope.setTag('user_id', userId);
  Sentry.captureException(error);
});
```

Szczegóły: [edge-functions-sentry.md](resources/edge-functions-sentry.md)

---

## Error Levels

| Level | Kiedy używać | Przykład |
|-------|--------------|----------|
| `fatal` | System nie działa, wymaga natychmiastowej interwencji | Brak połączenia z bazą |
| `error` | Operacja nie powiodła się, użytkownik dotknięty | Płatność Stripe nie przeszła |
| `warning` | Problem odwracalny, nie wymaga natychmiastowej akcji | Retry po timeout |
| `info` | Informacje operacyjne | Użytkownik zalogowany |

---

## Quick Reference

### Frontend (React)

**Inicjalizacja w `main.tsx`:**
```typescript
import { initSentry } from '@/lib/sentry';
import * as Sentry from '@sentry/react';

initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <AppWrapper />
  </Sentry.ErrorBoundary>
);
```

**Użycie loggera (preferowane):**
```typescript
import { logger } from '@/lib/logger';

try {
  await riskyOperation();
} catch (error) {
  logger.error('Operacja nie powiodła się', error);
  toast.error('Wystąpił błąd');
}
```

**Bezpośrednie Sentry (gdy potrzeba więcej kontekstu):**
```typescript
import * as Sentry from '@sentry/react';

Sentry.withScope((scope) => {
  scope.setTag('operation', 'payment');
  scope.setContext('order', { orderId: '123', amount: 100 });
  Sentry.captureException(error);
});
```

### Edge Functions (Deno)

**Edge Function z Sentry i `withScope`:**
```typescript
import { withSupabase } from 'npm:@supabase/server@^1';
import { initSentry, captureError } from '../_shared/sentry.ts';

const Sentry = initSentry('function-name');

// export default { fetch } + withSupabase zamiast Deno.serve.
// Tryb auth per funkcja ('user' | 'publishable' | 'secret' | 'none');
// dla trybu innego niż 'user' -> verify_jwt = false w supabase/config.toml.
export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      // logika — ctx.supabase (RLS), ctx.userClaims?.sub = user_id
    } catch (error) {
      // await captureError: withScope + flush wewnętrznie
      await captureError(error, {
        operation: 'checkout',
        user_id: ctx.userClaims?.sub  // NIE user_email (GDPR)
      });
      return new Response(JSON.stringify({ error: 'Error' }), { status: 500 });
    }
  }),
};
```

---

## Context Enrichment

**Kontekst błędu (tagi, kontekst operacji, breadcrumbs):**

```typescript
// DOBRZE - bogaty kontekst
Sentry.withScope((scope) => {
  scope.setUser({ id: userId, email: maskedEmail });
  scope.setTag('service', 'payments');
  scope.setTag('endpoint', '/checkout');
  scope.setContext('operation', {
    type: 'stripe_checkout',
    sessionId: session.id,
    amount: amount
  });
  scope.addBreadcrumb({
    category: 'payment',
    message: 'Starting checkout',
    level: 'info'
  });
  Sentry.captureException(error);
});

// ŹLE - brak kontekstu
Sentry.captureException(error); // Skąd? Co? Dla kogo?
```

---

## GDPR Compliance

**Maskowanie emaili (zasada 3):**

```typescript
// W beforeSend
beforeSend(event) {
  if (event.user?.email) {
    event.user.email = event.user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
  }
  return event;
}

// W setSentryUser
export function setSentryUser(user: { id: string; email: string } | null) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    });
  } else {
    Sentry.setUser(null);
  }
}
```

---

## Checklist dla Nowego Kodu

Przed każdym PR sprawdź:

- [ ] Zaimportowano Sentry lub odpowiedni helper
- [ ] Każdy nieoczekiwany błąd trafia do Sentry; oczekiwane odmowy nie (zasada 1)
- [ ] Dodano znaczący kontekst (tagi, breadcrumbs)
- [ ] Użyto odpowiedniego poziomu błędu
- [ ] Brak wrażliwych danych w event (hasła, tokeny)
- [ ] Email użytkownika jest maskowany
- [ ] Przetestowano ścieżki błędów

---

## Common Mistakes

**Unikaj:**
```typescript
// Połykanie błędów
try {
  await operation();
} catch (error) {
  // nic - użytkownik nie wie, my nie wiemy
}

// console.error bez Sentry
} catch (error) {
  console.error('Error:', error); // W produkcji nikt nie widzi!
}

// Wrażliwe dane
Sentry.setContext('auth', { token: userToken }); // token w zewnętrznym serwisie
```

**Zamiast tego:**
```typescript
// Capture + informacja dla użytkownika
try {
  await operation();
} catch (error) {
  logger.error('Operacja nie powiodła się', error);
  toast.error('Wystąpił błąd. Spróbuj ponownie.');
}

// Bezpieczny kontekst
Sentry.setContext('auth', {
  userId: user.id,
  provider: 'google' // OK - nie wrażliwe
});
```

---

## Resources

Szczegółowe wzorce znajdują się w:

- **[react-sentry-patterns.md](resources/react-sentry-patterns.md)** - Pełna konfiguracja React + Vite, ErrorBoundary, performance, session replay
- **[edge-functions-sentry.md](resources/edge-functions-sentry.md)** - Wzorce dla Supabase Edge Functions (Deno), shared helpers, Stripe tracking

---
name: sentry-integration
description: Sentry error tracking i performance monitoring dla React + Supabase Edge Functions. Aktywuje się przy pracy z błędami, monitoringiem, captureException, error boundary, śledzeniem błędów, diagnostyką, loggerem, Edge Functions, crash, awaria, wydajność, raportowanie błędów, exception, wyjątek.
---

# Sentry Integration Guidelines

Kompleksowy przewodnik integracji Sentry error tracking i performance monitoring dla projektu React + Supabase Edge Functions.

> **Stan SDK**
>
> - **React SDK:** v10+ (funkcyjne integracje, React 19 error hooks) ✅
> - **Edge Functions:** `@sentry/deno` na Deno 2.x (instrumentacja + `beforeSend`) ✅ — używaj `withScope` dla izolacji i `await flush()` przed `Response`

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

**NIGDY NIE ŁAMIESZ TYCH ZASAD:**

1. **ALL ERRORS MUST BE CAPTURED TO SENTRY** - w produkcji każdy błąd musi trafić do Sentry
2. **NIGDY `console.error` bez Sentry** - w Edge Functions każdy `console.error` musi mieć `captureError()`
3. **MASKUJ DANE OSOBOWE** - email musi być maskowany: `user@example.com` → `us***@example.com`
4. **NIE WYSYŁAJ WRAŻLIWYCH DANYCH** - hasła, tokeny, klucze API NIGDY nie trafiają do Sentry
5. **UŻYWAJ ODPOWIEDNICH POZIOMÓW** - `fatal` tylko dla krytycznych, `error` dla operacji

---

## Dobre praktyki (Edge Functions / Supabase)

`@sentry/deno` działa na Supabase Edge Runtime (Deno 2.x) z instrumentacją requestów
i wsparciem `beforeSend`. Wcześniejsze ograniczenia (Deno 1.45.2, brak instrumentacji,
brak `beforeSend`) są nieaktualne. Nadal stosuj:

| Zasada | Dlaczego |
|--------|----------|
| Ustawiaj kontekst przez `Sentry.withScope()` | Izolacja per operacja; unikasz wycieku tagów między requestami |
| Nie ustawiaj globalnych tagów per-request | Globalny scope jest współdzielony w obrębie isolate'u |
| `await Sentry.flush()` przed `Response` | Isolate może zostać zamrożony zaraz po odpowiedzi |
| Maskuj PII w `beforeSend` | Jeden centralny punkt dla wszystkich zdarzeń |

**Zawsze używaj tego wzorca:**
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

**Każda funkcja MUSI mieć Sentry z `withScope`:**
```typescript
import { initSentry, captureError } from '../_shared/sentry.ts';

const Sentry = initSentry('function-name');

// WAŻNE: Deno.serve zamiast serve z deno.land/std
Deno.serve(async (req) => {
  try {
    // logika
  } catch (error) {
    // ZAWSZE używaj captureError (używa withScope wewnętrznie)
    captureError(error, {
      operation: 'checkout',
      user_id: userId  // NIE user_email (GDPR)
    });
    return new Response(JSON.stringify({ error: 'Error' }), { status: 500 });
  }
});
```

---

## Context Enrichment

**ZAWSZE dodawaj kontekst do błędów:**

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

**Maskowanie emaili - OBOWIĄZKOWE:**

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
- [ ] Wszystkie bloki try/catch wysyłają do Sentry
- [ ] Dodano znaczący kontekst (tagi, breadcrumbs)
- [ ] Użyto odpowiedniego poziomu błędu
- [ ] Brak wrażliwych danych w event (hasła, tokeny)
- [ ] Email użytkownika jest maskowany
- [ ] Przetestowano ścieżki błędów

---

## Common Mistakes

**NIE RÓB:**
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
Sentry.setContext('auth', { token: userToken }); // NIE!
```

**RÓB:**
```typescript
// Zawsze capture + informacja dla użytkownika
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

---

**Skill Status**: COMPLETE
**Progressive Disclosure**: Szczegółowe wzorce w plikach `resources/`

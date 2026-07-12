# Edge Functions Sentry Patterns

Szczegółowe wzorce integracji Sentry z Supabase Edge Functions (Deno runtime).

> **ℹ️ STAN RUNTIME'U**
>
> Supabase Edge Runtime działa dziś na Deno 2.x, a `@sentry/deno` ma instrumentację
> requestów (`Deno.serve`) oraz wsparcie `beforeSend`. Wsparcie instrumentacji `Deno.serve`
> jest jednak świeże/eksperymentalne — oficjalna dokumentacja Supabase nadal zaleca
> `defaultIntegrations: false` na Edge Runtime, bo bez tego nie ma gwarancji scope
> separation między requestami w tym samym isolate. Traktuj automatyczną instrumentację
> jako bonus, nie jako zamiennik izolacji przez `withScope()`.
>
> Dobre praktyki, które nadal warto stosować:
> 1. **Używaj `Sentry.withScope()`** dla izolacji kontekstu per operacja/branch — czytelniejsze
>    niż globalne tagi, niezależnie od instrumentacji runtime'u.
> 2. **`await Sentry.flush()`** przed zakończeniem requestu — isolate może zostać zamrożony
>    zaraz po zwróceniu `Response`, więc zdarzenia muszą wyjść przed `return`.
> 3. **Centralne maskowanie PII** rób w `beforeSend` (patrz [Shared Helper](#shared-helper)).

## Table of Contents

- [Instalacja i Import](#instalacja-i-import)
- [Shared Helper](#shared-helper)
- [Integracja w Edge Function](#integracja-w-edge-function)
- [Stripe Webhook Patterns](#stripe-webhook-patterns)
- [Context dla Operacji](#context-dla-operacji)
- [Zmienne Środowiskowe](#zmienne-środowiskowe)
- [Troubleshooting](#troubleshooting)

---

## Instalacja i Import

Supabase Edge Functions używają Deno. Oficjalnie zalecany import:

```typescript
// Oficjalny Sentry SDK dla Deno
import * as Sentry from 'npm:@sentry/deno';
```

**Uwagi:**
- `npm:@sentry/deno` to aktualny zalecany import (stary `deno.land/x/sentry` jest deprecated)
- Wymaga Deno 2.x — Supabase Edge Runtime spełnia ten wymóg. Domyślne integracje (w tym tracing)
  działają, ale instrumentacja `Deno.serve` jest świeża/eksperymentalna — patrz `defaultIntegrations: false` niżej

---

## Shared Helper

**Plik: `supabase/functions/_shared/sentry.ts`**

```typescript
import * as Sentry from 'npm:@sentry/deno';

let initialized = false;

/**
 * Inicjalizuje Sentry dla Edge Function
 * @param functionName - Nazwa funkcji (np. 'stripe-webhook')
 *
 * Domyślne integracje (w tym tracing) działają na Deno 2.x, ale instrumentacja
 * Deno.serve jest świeża/eksperymentalna. Kontekst per operacja izolujemy
 * jawnie przez Sentry.withScope() — nie polegamy tylko na auto-instrumentacji.
 */
export function initSentry(functionName: string): typeof Sentry {
  if (!initialized) {
    const dsn = Deno.env.get('SENTRY_DSN');
    const environment = Deno.env.get('ENVIRONMENT') || 'production';

    if (dsn) {
      Sentry.init({
        dsn,
        environment,
        release: Deno.env.get('SENTRY_RELEASE'), // np. 'stripe-webhook@1.4.0'
        tracesSampleRate: 0.1, // 10% transakcji

        // Bezpieczny default na Edge Runtime: bez gwarancji scope separation
        // między requestami w tym samym isolate przy auto-instrumentacji
        // Deno.serve. Usuń dopiero gdy zweryfikujesz separation na swoim runtime.
        defaultIntegrations: false,

        // Centralne maskowanie PII — jeden punkt dla wszystkich zdarzeń
        beforeSend(event) {
          if (event.user?.email) {
            event.user.email = event.user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
          }
          // Usuń wrażliwe nagłówki, jeśli trafiły do requestu
          if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }
          return event;
        },
      });

      // Tagi globalne (będą współdzielone między requestami!)
      Sentry.setTag('function', functionName);
      Sentry.setTag('runtime', 'deno');
      Sentry.setTag('platform', 'supabase');

      initialized = true;
    }
  }

  return Sentry;
}

/**
 * Przechwytuje błąd z kontekstem operacji
 * @param error - Błąd do przechwycenia
 * @param context - Kontekst operacji (bez wrażliwych danych!)
 */
export async function captureError(
  error: unknown,
  context?: {
    operation?: string;
    event_type?: string;
    user_id?: string;
    // NIE: user_email (wrażliwe), NIE: token, NIE: hasło
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  Sentry.withScope((scope) => {
    // Ustawianie tagów
    if (context?.operation) {
      scope.setTag('operation', context.operation);
    }
    if (context?.event_type) {
      scope.setTag('stripe.event_type', context.event_type);
    }

    // User context (tylko ID, NIE email!)
    if (context?.user_id) {
      scope.setUser({ id: context.user_id });
    }

    // Dodatkowy kontekst
    if (context?.extra) {
      scope.setContext('operation_details', context.extra);
    }

    // Breadcrumb dla kontekstu
    scope.addBreadcrumb({
      category: 'edge-function',
      message: `Error in ${context?.operation || 'unknown operation'}`,
      level: 'error',
      data: {
        event_type: context?.event_type,
        user_id: context?.user_id,
      },
    });

    Sentry.captureException(error);
  });

  // WAŻNE: flush przed zakończeniem requestu (runtime może się zakończyć)
  await Sentry.flush(2000);

  // Zawsze też loguj do konsoli (Supabase logs)
  console.error('[Sentry captured]', error);
}

/**
 * Wysyła informacyjną wiadomość do Sentry
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  Sentry.captureMessage(message, level);
}
```

---

## Integracja w Edge Function

**Plik: `supabase/functions/stripe-webhook/index.ts`**

```typescript
// UWAGA: Używamy Deno.serve (natywne API) zamiast serve z deno.land/std
import Stripe from 'npm:stripe@22';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { initSentry, captureError } from '../_shared/sentry.ts';

// Inicjalizacja Sentry (raz przy cold start)
const Sentry = initSentry('stripe-webhook');

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2026-06-24.dahlia', // Wersja API pinowana przez stripe-node v22.3.x
  httpClient: Stripe.createFetchHttpClient(),
});

// Natywne Deno.serve - zalecane przez Supabase
Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );

    console.log('Webhook event received:', event.type);

    // WAŻNE: Używaj withScope dla izolacji kontekstu między requestami
    Sentry.withScope((scope) => {
      scope.setTag('stripe.event_type', event.type);
      scope.addBreadcrumb({
        category: 'stripe',
        message: `Processing ${event.type}`,
        level: 'info',
      });
    });

    // ... obsługa eventów ...

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    // KRYTYCZNE: await przed Response — captureError robi Sentry.flush(),
    // a isolate może zostać zamrożony zaraz po zwróceniu odpowiedzi.
    // Alternatywa bez blokowania: EdgeRuntime.waitUntil(captureError(...)).
    await captureError(error, {
      operation: 'stripe_webhook',
      event_type: 'unknown', // Nie mamy event.type bo parsowanie się nie powiodło
      extra: {
        has_signature: !!signature,
      },
    });

    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
```

**Kluczowe zmiany vs stary pattern:**
- `Deno.serve()` zamiast `serve()` z `deno.land/std`
- Wersje bibliotek bez pinowania (np. `stripe@22` zamiast `stripe@22.3.0`)
- `Sentry.withScope()` dla izolacji kontekstu między requestami

---

## Stripe Webhook Patterns

**Przechwytywanie błędów per event type z izolowanym scope:**

```typescript
switch (event.type) {
  case 'checkout.session.completed': {
    const session = event.data.object as Stripe.Checkout.Session;
    const userEmail = session.metadata?.user_email;
    const userId = session.metadata?.user_id;

    try {
      // Aktualizacja użytkownika
      const { error: updateError } = await supabase
        .from('users')
        .update({ paid: true })
        .eq('email', userEmail);

      if (updateError) {
        // WAŻNE: withScope dla izolacji kontekstu
        Sentry.withScope((scope) => {
          scope.setTag('operation', 'update_user_paid_status');
          scope.setTag('stripe.event_type', event.type);
          scope.setUser({ id: userId });
          scope.setContext('checkout', {
            session_id: session.id,
            // NIE: user_email (GDPR)
          });
          Sentry.captureException(updateError);
        });
        throw updateError;
      }

      console.log(`Payment succeeded for user ${userId}`);
    } catch (error) {
      // await — flush musi się dokończyć zanim handler zwróci Response
      await captureError(error, {
        operation: 'checkout_session_completed',
        event_type: event.type,
        user_id: userId,
      });
      // Nie rzucaj dalej - Stripe dostanie 200
    }
    break;
  }

  case 'payment_intent.payment_failed': {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const userId = paymentIntent.metadata?.user_id;

    // Loguj failed payment (nie jako exception, bo to expected behavior)
    // Używaj withScope dla izolacji
    Sentry.withScope((scope) => {
      scope.setUser({ id: userId });
      scope.setTag('stripe.event_type', event.type);
      Sentry.captureMessage(`Payment failed for user ${userId}`, 'warning');
    });

    // ... obsługa ...
    break;
  }
}
```

---

## Context dla Operacji

**Wzorzec dla operacji z bogatym kontekstem:**

```typescript
async function processCheckout(session: Stripe.Checkout.Session) {
  const operationContext = {
    operation: 'process_checkout',
    event_type: 'checkout.session.completed',
    user_id: session.metadata?.user_id,
    extra: {
      session_id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
    },
  };

  try {
    // Breadcrumb: start
    Sentry.addBreadcrumb({
      category: 'checkout',
      message: 'Starting checkout processing',
      level: 'info',
      data: { session_id: session.id },
    });

    // ... logika ...

    // Breadcrumb: success
    Sentry.addBreadcrumb({
      category: 'checkout',
      message: 'Checkout processing completed',
      level: 'info',
    });
  } catch (error) {
    captureError(error, operationContext);
    throw error; // Re-throw jeśli chcesz przerwać
  }
}
```

---

## Zmienne Środowiskowe

**Ustawienie secrets w Supabase:**

```bash
# DSN z Sentry
supabase secrets set SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Environment (production/staging/development)
supabase secrets set ENVIRONMENT=production
```

**Weryfikacja:**

```bash
supabase secrets list
```

---

## Troubleshooting

### Sentry nie wysyła błędów

1. **Sprawdź DSN:**
   ```typescript
   console.log('SENTRY_DSN:', Deno.env.get('SENTRY_DSN'));
   ```

2. **Sprawdź inicjalizację:**
   ```typescript
   const Sentry = initSentry('test-function');
   Sentry.captureMessage('Test message from Edge Function');
   ```

3. **Sprawdź Supabase logs:**
   - Dashboard → Edge Functions → Logs
   - Powinien być `[Sentry captured]` z console.error

### Brak kontekstu w Sentry / Kontekst z innego requestu

**Problem:** Błędy mają kontekst z poprzedniego requestu (brak izolacji scope).

**Przyczyna:** Ustawianie tagów/usera na globalnym scope (`Sentry.setTag`, `Sentry.setUser`)
zamiast na scope izolowanym per operacja.

**Rozwiązanie:** ZAWSZE używaj `Sentry.withScope()`:

```typescript
// ŹLE - kontekst współdzielony między requestami
Sentry.setTag('user_id', userId);
Sentry.captureException(error);

// DOBRZE - izolowany kontekst per request
Sentry.withScope((scope) => {
  scope.setTag('user_id', userId);
  scope.setContext('request', { path: req.url });
  Sentry.captureException(error);
});

// LUB użyj helpera captureError() który robi to automatycznie
captureError(error, {
  operation: 'checkout',
  event_type: event.type,
  user_id: userId,
});
```

### Deno SDK compatibility

**Problem:** Import Sentry nie działa lub błędy runtime.

**Rozwiązanie:**
1. Używaj `npm:@sentry/deno` (stary `deno.land/x/sentry` jest deprecated)
2. Dodaj `await Sentry.flush(2000)` po `captureException` — isolate może zostać zamrożony przed wysłaniem
3. Sprawdź, czy `SENTRY_DSN` jest ustawiony jako secret (`supabase secrets list`)

Na Deno 2.x SDK wysyła zdarzenia niezawodnie, więc **ręczny fallback nie jest potrzebny**.
Gdybyś jednak musiał wysłać zdarzenie bez SDK, celuj w aktualny **envelope endpoint**
(`/api/{PROJECT_ID}/envelope/`), a nie w zdeprecjonowany `/store/` z nagłówkiem `X-Sentry-Auth`.
Uwaga: body dla `/envelope/` to format newline-delimited (nagłówek envelope + nagłówek itemu +
payload), a nie zwykły JSON — dlatego ręczne budowanie jest kruche i lepiej polegać na SDK:

```typescript
// Klucz z DSN: https://<PUBLIC_KEY>@<HOST>/<PROJECT_ID>
const url = `https://${host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`;
// body = `${JSON.stringify(envelopeHeader)}\n${JSON.stringify(itemHeader)}\n${JSON.stringify(event)}`
```

### Wersje bibliotek (Best Practices)

**Stripe:**
- Używaj major version bez patch: `stripe@22` zamiast `stripe@22.3.0`
- Sprawdź `apiVersion` - aktualna: `2026-06-24.dahlia` (pinowana przez stripe-node v22.3.x)

**Supabase JS:**
- Używaj: `@supabase/supabase-js@2` (automatycznie najnowsza z major 2)

**Sentry:**
- Używaj: `npm:@sentry/deno` (stary `deno.land/x/sentry` jest deprecated)

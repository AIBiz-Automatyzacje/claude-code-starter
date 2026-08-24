# Edge Functions Sentry Patterns

Szczegółowe wzorce integracji Sentry z Supabase Edge Functions (Deno runtime).

> **ℹ️ STAN RUNTIME'U**
>
> Supabase Edge Runtime działa dziś na Deno 2.x, a `@sentry/deno` (aktualnie 10.x, wymaga
> Deno >= 2.0) wspiera `captureException`, `withScope`, `flush` i `beforeSend`. Handler
> piszemy jako `export default { fetch: withSupabase(...) }` (oficjalny wzorzec Supabase,
> `Deno.serve` to legacy). **Dokumentacja `@sentry/deno` nie ma integracji ani wrappera
> dla fetch-handlera / `Deno.serve`** (sprawdzone 2026-08: docs.sentry.io/platforms/javascript/guides/deno/
> i lista integracji) — instrumentację robimy ręcznie: `try/catch` w handlerze,
> `captureException` w `withScope`, `await flush()` przed `Response`. Dokładnie tak robi to
> oficjalny przykład Supabase (docs/guides/functions/examples/sentry-monitoring), który też
> zostawia `defaultIntegrations: false`, bo bez tego nie ma gwarancji scope separation między
> requestami w tym samym isolate.
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
// Oficjalny Sentry SDK dla Deno — pin majora spójny z @sentry/react v10
import * as Sentry from 'npm:@sentry/deno@^10';
```

**Uwagi:**
- `npm:@sentry/deno@^10` to aktualny zalecany import (stary `deno.land/x/sentry` jest deprecated).
  Pin: aktualna 10.70.0 (npm, 2026-08). Przykład w dokumentacji Supabase używa jeszcze `@^8` —
  używaj `@^10`, spójnie z `@sentry/react` v10. Przy podbiciu majora sprawdź changelog
  (getsentry/sentry-javascript) pod kątem `sendDefaultPii` → `dataCollection` i zmian w `beforeSend`
- Wymaga Deno >= 2.0 — Supabase Edge Runtime spełnia ten wymóg. Brak integracji dla
  fetch-handlera — patrz `defaultIntegrations: false` i ręczny `try/catch` niżej

---

## Shared Helper

**Plik: `supabase/functions/_shared/sentry.ts`**

```typescript
import * as Sentry from 'npm:@sentry/deno@^10';

let initialized = false;

/**
 * Inicjalizuje Sentry dla Edge Function
 * @param functionName - Nazwa funkcji (np. 'stripe-webhook')
 *
 * @sentry/deno nie ma integracji dla fetch-handlera (withSupabase / export default fetch),
 * więc błędy łapiemy ręcznie w try/catch handlera. Kontekst per operacja izolujemy
 * jawnie przez Sentry.withScope().
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

        // Bezpieczny default na Edge Runtime (tak samo w oficjalnym przykładzie Supabase):
        // bez gwarancji scope separation między requestami w tym samym isolate.
        // Usuń dopiero gdy zweryfikujesz separation na swoim runtime.
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
// UWAGA: export default { fetch } + withSupabase (oficjalny wzorzec Supabase) zamiast Deno.serve
import Stripe from 'npm:stripe@22';
import { withSupabase } from 'npm:@supabase/server@^1';
import { initSentry, captureError } from '../_shared/sentry.ts';

// Inicjalizacja Sentry (raz przy cold start)
const Sentry = initSentry('stripe-webhook');

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  // MUSI rownac sie pinowi zainstalowanego majora (Stripe.LatestApiVersion) —
  // typ to literal jednej wersji, wiec rozjazd = blad typow, nie ostrzezenie.
  apiVersion: '2026-07-29.dahlia', // pin ze stripe-node 22.5.0 (wszedl w 22.4.0)
  httpClient: Stripe.createFetchHttpClient(),
});

// Webhook Stripe: auth: 'none' (Stripe nie wysyła JWT — tożsamość daje WYŁĄCZNIE sygnatura
// stripe-signature) + cors: 'disabled' (serwer-serwer). Wymaga w supabase/config.toml:
//   [functions.stripe-webhook]
//   verify_jwt = false
// Klient admin do zapisu subskrypcji: ctx.supabaseAdmin (omija RLS).
// @sentry/deno nie ma wrappera dla fetch-handlera — instrumentacja ręcznie przez try/catch.
export default {
  fetch: withSupabase({ auth: 'none', cors: 'disabled' }, async (req, ctx) => {
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

      // ... obsługa eventów (zapis przez ctx.supabaseAdmin) ...

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
  }),
};
```

**Kluczowe zmiany vs stary pattern:**
- `export default { fetch: withSupabase(...) }` zamiast `Deno.serve()` / `serve()` z `deno.land/std`
  (`Deno.serve` nadal działa, ale Supabase już go nie dokumentuje); tryb `auth` per funkcja,
  `verify_jwt = false` dla każdego trybu innego niż `'user'`
- Klienci Supabase z `ctx.supabase` / `ctx.supabaseAdmin` zamiast ręcznego `createClient`
  (`npm:@supabase/server@^1`, aktualna 1.4.1 — przy podbiciu majora sprawdź README pod kątem
  sygnatury `withSupabase` i kształtu opcji `cors`)
- Wersje bibliotek bez pinowania patcha (np. `stripe@22` zamiast `stripe@22.3.0`)
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
      const { error: updateError } = await ctx.supabaseAdmin
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
1. Używaj `npm:@sentry/deno@^10` (stary `deno.land/x/sentry` jest deprecated)
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
- Sprawdź `apiVersion` - aktualna: `2026-07-29.dahlia` (pinowana przez stripe-node v22.5.0, zmiana weszła w 22.4.0)
- `apiVersion` MUSI równać się `Stripe.LatestApiVersion` zainstalowanego majora — to literal typu, więc rozjazd wywala `deno check`. Po każdym podbiciu sprawdź `src/apiVersion.ts` w tagu wersji

**Supabase JS / server:**
- Handler: `npm:@supabase/server@^1` (`withSupabase`) — klienci z `ctx`, ręczny `createClient` tylko poza wrapperem
- Jeśli potrzebujesz klienta ręcznie: `npm:@supabase/supabase-js@2` (nie `jsr:` — docs i quickstart Supabase używają `npm:`)

**Sentry:**
- Używaj: `npm:@sentry/deno@^10` (stary `deno.land/x/sentry` jest deprecated; przykład Supabase z `@^8` jest nieaktualny względem @sentry/react v10)

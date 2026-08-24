# Edge Functions

Wzorce dla Supabase Edge Functions - Deno runtime, autentykacja, CORS, Stripe.

---

## Struktura Edge Function

### Katalog i Plik
```
supabase/functions/
├── create-checkout-session/
│   ├── deno.json
│   └── index.ts
├── create-billing-portal-session/
│   └── index.ts
└── stripe-webhook/
    └── index.ts
```

### CORS — załatwia wrapper `withSupabase`

`withSupabase` z `npm:@supabase/server@^1` sam obsługuje preflight (OPTIONS) i dokleja
standardowe nagłówki CORS supabase-js (opcja `cors: 'default'`, domyślna). Nie twórz
`_shared/cors.ts` ani ręcznej gałęzi `if (req.method === 'OPTIONS')`. Warianty:
`cors: 'disabled'` (webhooki server-to-server) lub `cors: { headers: {...} }` (własne
nagłówki, np. konkretne `Access-Control-Allow-Origin`).

### Podstawowy Szablon (2026) — `withSupabase`

Wzorzec oficjalny Supabase: eksport domyślny obiektu z handlerem `fetch`, owinięty
`withSupabase`. Wrapper weryfikuje auth PRZED wejściem do handlera, tworzy klientów
(`ctx.supabase` — w roli usera, podlega RLS; `ctx.supabaseAdmin` — secret key, omija RLS)
i obsługuje CORS. Ten sam handler działa bez zmian na Cloudflare Workers i Bun.

```typescript
// supabase/functions/my-function/index.ts
import { withSupabase } from 'npm:@supabase/server@^1';

export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
        try {
            // ctx.userClaims: { id, email, role } z JWT (null przy auth innym niż 'user')
            const result = await processRequest(req, ctx.supabase, ctx.userClaims);

            return Response.json(result);
        } catch (error) {
            console.error('Function error:', error);

            const message = error instanceof Error ? error.message : 'Internal error';
            return Response.json({ error: message }, { status: 400 });
        }
    }),
};
```

**Sygnatura (README `supabase/server`, v1.4.1):**
```typescript
withSupabase(
    {
        auth: 'user' | 'publishable' | 'secret' | 'none' | AuthMode[],   // tablica = dowolny z trybów
        cors?: 'default' | 'disabled' | { headers: Record<string, string> },
    },
    handler: (req: Request, ctx: SupabaseContext) => Promise<Response>,
);

interface SupabaseContext {
    supabase: SupabaseClient;        // RLS (rola usera / anon)
    supabaseAdmin: SupabaseClient;   // secret key, omija RLS
    userClaims: UserClaims | null;   // id, email, role — tylko auth 'user'
    jwtClaims: JWTClaims | null;     // pełne claims JWT
    authMode: AuthMode;              // który tryb dopasowano
    authKeyName?: string;            // nazwa klucza API ('secret'/'publishable')
}
```

Wrapper czyta `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` i
`SUPABASE_JWKS` — wszystkie wstrzykiwane automatycznie w Edge Functions.

### Tryb `auth` — dobierz per funkcja

| Tryb | Kto woła | Klient w ctx | `verify_jwt` w `config.toml` |
|------|----------|--------------|------------------------------|
| `'user'` | zalogowany user (JWT w `Authorization`) | `ctx.supabase` (RLS) | domyślne (`true`) |
| `'secret'` | cron, worker, `pg_net`, inna funkcja (secret key) | `ctx.supabaseAdmin` | `false` |
| `'publishable'` | klient publiczny przed logowaniem | `ctx.supabase` (anon) | `false` |
| `'none'` | endpoint publiczny / webhook zewnętrzny (weryfikacja w kodzie) | `ctx.supabase` jako anon | `false` |

Dla KAŻDEGO trybu innego niż `'user'` wyłącz weryfikację JWT na bramce, inaczej gateway
odrzuci request zanim dojdzie do wrappera:

```toml
# supabase/config.toml
[functions.stripe-webhook]
verify_jwt = false

[functions.nightly-cleanup]
verify_jwt = false
```

---

## Importy (2026)

### Preferowane Źródła
```typescript
// Wrapper handlera (auth, klienci, CORS)
import { withSupabase } from 'npm:@supabase/server@^1';

// Supabase JS — tylko gdy potrzebujesz klienta poza ctx (docs Supabase używają npm:, nie jsr:)
import { createClient } from 'npm:@supabase/supabase-js@2';

// Stripe - użyj npm:
import Stripe from 'npm:stripe@22';

// Inne pakiety npm
import { z } from 'npm:zod@4';

// Deno std (jeśli potrzebne)
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
```

### Dlaczego JSR/npm zamiast esm.sh?

| Źródło | Status 2026 | Użycie |
|--------|-------------|--------|
| `npm:` | ✅ Preferowane | Pakiety npm (w tym `@supabase/server`, `@supabase/supabase-js`) |
| `jsr:` | ✅ Preferowane | Pakiety Deno-native (`@std/*`) |
| `deno.land/x` | ⚠️ Minimalizuj | Wspierane, niepreferowane — docs: „minimize the use" |
| `esm.sh`, `unpkg.com` | ⚠️ Minimalizuj | Tylko gdy jsr/npm nie działa |

Zawsze pinuj wersję (`@2`, `@^1`, `@22`).

### Konfiguracja `deno.json` (Preferowane)

Od Deno 2.x, `deno.json` jest preferowany nad import maps. Jeśli oba istnieją, `deno.json` ma pierwszeństwo.

```json
// supabase/functions/deno.json
{
  "imports": {
    "@supabase/server": "npm:@supabase/server@^1",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "stripe": "npm:stripe@22"
  }
}
```

Z `deno.json` importy w kodzie są czystsze:
```typescript
import { withSupabase } from '@supabase/server';
import Stripe from 'stripe';
```

---

## Weryfikacja JWT

### `auth: 'user'` — wrapper weryfikuje za Ciebie (PREFEROWANE)

Z `withSupabase({ auth: 'user' })` nie parsujesz nagłówka `Authorization` ani nie wołasz
`getClaims()`/`getUser()` ręcznie: request bez ważnego JWT jest odrzucany ZANIM handler
się wykona. Tożsamość masz w `ctx.userClaims` (`id`, `email`, `role`), pełne claims
w `ctx.jwtClaims`, a `ctx.supabase` działa już w roli tego usera (RLS).

```typescript
import { withSupabase } from 'npm:@supabase/server@^1';

export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
        // ctx.userClaims nie jest null — wrapper odrzucił request bez JWT
        const userId = ctx.userClaims?.id;
        if (!userId) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await processForUser(userId, ctx.supabase);
        return Response.json(result);
    }),
};
```

Pełny obiekt `User` (metadata, identities) — dopiero gdy naprawdę go potrzebujesz:
`const { data: { user } } = await ctx.supabase.auth.getUser();` (round-trip do Auth).

### getClaims() vs getUser() — gdy weryfikujesz ręcznie

Potrzebne tylko przy `auth: 'none'` z własną logiką (np. token w body) lub poza wrapperem.

- `getClaims()` — preferowane. Od 1 października 2025 nowe projekty mają asymetryczne
  klucze JWT: weryfikacja lokalna przez JWKS (`SUPABASE_JWKS`), bez round-tripu do Auth.
- Na projektach z symetrycznym secretem JWT `getClaims()` sam robi fallback do weryfikacji
  zdalnej (jak `getUser()`) — działa, tylko bez zysku wydajności; `getUser()` pozostaje
  równoważną alternatywą.

```typescript
const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
const { data, error } = await ctx.supabase.auth.getClaims(token);
if (error || !data) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
}
const userId = data.claims.sub;
```

---

## Przykład: Stripe Checkout

### create-checkout-session
```typescript
// supabase/functions/create-checkout-session/index.ts
import { withSupabase } from 'npm:@supabase/server@^1';
import Stripe from 'npm:stripe@22';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    // MUSI rownac sie pinowi zainstalowanego majora (Stripe.LatestApiVersion).
    // Typ apiVersion to literal JEDNEJ wersji — rozjazd = blad typow w deno check,
    // nie ostrzezenie. Po kazdym podbiciu stripe-node sprawdz src/apiVersion.ts.
    apiVersion: '2026-07-29.dahlia', // stripe-node 22.5.0 (pin wszedl w 22.4.0)
});

// auth: 'user' — wrapper odrzuca request bez ważnego JWT i obsługuje CORS/preflight
export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
        try {
            const user = ctx.userClaims;
            if (!user) {
                return Response.json({ error: 'Unauthorized' }, { status: 401 });
            }

            // Pobierz dane z body
            const { priceId, successUrl, cancelUrl } = await req.json();

            // Utwórz sesję Stripe Checkout
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card', 'blik', 'p24'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: successUrl,
                cancel_url: cancelUrl,
                customer_email: user.email,
                metadata: {
                    user_id: user.id,
                    user_email: user.email,
                },
            });

            return Response.json({ sessionId: session.id, url: session.url });
        } catch (error) {
            console.error('Checkout error:', error);

            const message = error instanceof Error ? error.message : 'Internal error';
            return Response.json({ error: message }, { status: 400 });
        }
    }),
};
```

---

## Przykład: Stripe Webhook

### stripe-webhook
```typescript
// supabase/functions/stripe-webhook/index.ts
import { withSupabase } from 'npm:@supabase/server@^1';
import Stripe from 'npm:stripe@22';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    // MUSI rownac sie pinowi zainstalowanego majora (Stripe.LatestApiVersion).
    // Typ apiVersion to literal JEDNEJ wersji — rozjazd = blad typow w deno check,
    // nie ostrzezenie. Po kazdym podbiciu stripe-node sprawdz src/apiVersion.ts.
    apiVersion: '2026-07-29.dahlia', // stripe-node 22.5.0 (pin wszedl w 22.4.0)
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

// Webhook zewnętrzny: auth 'none' (Stripe nie ma JWT Supabase), CORS wyłączony
// (server-to-server). Zaufanie opiera się WYŁĄCZNIE na podpisie stripe-signature.
// Wymaga `verify_jwt = false` dla tej funkcji w supabase/config.toml.
export default {
    fetch: withSupabase({ auth: 'none', cors: 'disabled' }, async (req, ctx) => {
    try {
        const body = await req.text();
        const signature = req.headers.get('stripe-signature');

        if (!signature) {
            throw new Error('Missing signature');
        }

        // Weryfikuj sygnaturę webhook — jedyna bramka auth tej funkcji
        const event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret
        );

        // Klient admin (secret key, omija RLS) — dopiero PO weryfikacji podpisu
        const supabase = ctx.supabaseAdmin;

        // Obsłuż event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                // Dopasowanie po UUID z metadata (ustawionym przy tworzeniu
                // sesji), NIGDY po email — email jest mutowalny.
                const userId = session.metadata?.user_id;
                const customerId = session.customer as string;

                if (!userId) {
                    throw new Error('Missing user_id in session metadata');
                }

                // Aktywuj dostęp
                await supabase
                    .from('users')
                    .update({
                        paid: true,
                        stripe_customer_id: customerId,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId);

                // Zapisz płatność
                await supabase
                    .from('payments')
                    .insert({
                        user_id: userId,
                        stripe_payment_intent_id: session.payment_intent as string,
                        stripe_customer_id: customerId,
                        amount: session.amount_total ?? 0,
                        currency: session.currency ?? 'pln',
                        status: 'succeeded',
                        metadata: { session_id: session.id },
                    });

                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;

                // Deaktywuj dostęp
                await supabase
                    .from('users')
                    .update({
                        paid: false,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('stripe_customer_id', customerId);

                break;
            }
        }

        return Response.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);

        const message = error instanceof Error ? error.message : 'Internal error';
        return Response.json({ error: message }, { status: 400 });
    }
    }),
};
```

```toml
# supabase/config.toml
[functions.stripe-webhook]
verify_jwt = false
```

**Uwaga:** Webhook ma `cors: 'disabled'` — jest wywoływany przez Stripe server-to-server.
NIE przepisuj go na `auth: 'user'`/`'secret'`: Stripe nie wyśle ani JWT, ani secret key.

---

## Wywołanie Edge Function z Frontend

### Użycie supabase.functions.invoke
```typescript
// lib/stripe.ts
import { supabase } from './supabase';

export async function redirectToCheckout() {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
            priceId: import.meta.env.VITE_STRIPE_PRICE_ID,
            successUrl: `${window.location.origin}/payment-success`,
            cancelUrl: `${window.location.origin}/payment-canceled`,
        },
    });

    if (error) {
        throw error;
    }

    // Przekieruj do Stripe
    window.location.href = data.url;
}

export async function redirectToBillingPortal() {
    const { data, error } = await supabase.functions.invoke('create-billing-portal-session', {
        body: {
            returnUrl: window.location.origin,
        },
    });

    if (error) {
        throw error;
    }

    // Otwórz w nowej karcie
    window.open(data.url, '_blank');
}
```

---

## Zmienne Środowiskowe

### Ustawianie Secrets
```bash
# Przez CLI
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Lista secrets
supabase secrets list

# Lub przez Supabase Dashboard:
# Project Settings > Edge Functions > Secrets
```

### Dostęp w Funkcji
```typescript
// Automatycznie dostępne (docs: functions/secrets). Z withSupabase nie czytasz ich
// ręcznie — klienci są gotowi w ctx.supabase / ctx.supabaseAdmin.
const supabaseUrl = Deno.env.get('SUPABASE_URL');

// Klucze API to JSON-mapy nazwanych kluczy; główny klucz pod 'default'
const publishableKey = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default; // sb_publishable_...
const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;           // sb_secret_...

// LEGACY (anon/service_role JWT, wycofywane do końca 2026): SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY — nie używaj w nowym kodzie.

// Custom secrets
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
```

---

## Lokalne Testowanie

### Uruchomienie Funkcji
```bash
# Uruchom wszystkie funkcje
supabase functions serve

# Uruchom konkretną funkcję
supabase functions serve create-checkout-session

# Z env file
supabase functions serve --env-file .env.local

# Z debugowaniem
supabase functions serve --debug
```

### Testowanie z curl
```bash
# Test funkcji z JWT
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/create-checkout-session' \
  --header 'Authorization: Bearer <JWT_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"priceId": "price_..."}'

# Test webhook (bez auth)
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/stripe-webhook' \
  --header 'Content-Type: application/json' \
  --header 'stripe-signature: <SIGNATURE>' \
  --data '{"type": "checkout.session.completed", ...}'
```

### Stripe CLI dla Webhooków
```bash
# Przekieruj webhooki lokalnie
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Wyślij test event
stripe trigger checkout.session.completed
```

---

## Deploy

### Deploy Pojedynczej Funkcji
```bash
supabase functions deploy create-checkout-session
```

### Deploy Wszystkich Funkcji
```bash
supabase functions deploy
```

### Weryfikacja
```bash
# Lista deployowanych funkcji
supabase functions list
```

---

## Error Handling

### Standardowy Pattern
```typescript
import { withSupabase } from 'npm:@supabase/server@^1';

export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
        try {
            // Walidacja input
            const body = await req.json();

            if (!body.priceId) {
                return Response.json({ error: 'Missing priceId' }, { status: 400 });
            }

            // Logika...
            const result = await process(body, ctx.supabase);

            return Response.json(result);
        } catch (error) {
            // Loguj pełny błąd (widoczny w Supabase Dashboard > Logs)
            console.error('Function error:', error);

            // Zwróć bezpieczną wiadomość (401 dla braku JWT zwraca sam wrapper)
            const message = error instanceof Error ? error.message : 'Internal error';
            return Response.json({ error: message }, { status: 500 });
        }
    }),
};
```

---

## Podsumowanie

**Checklist Edge Function (2026):**
- [ ] `export default { fetch: withSupabase({ auth }, handler) }` — nie `Deno.serve()`
- [ ] Importy: `npm:@supabase/server@^1`, `npm:@supabase/supabase-js@2`, `npm:stripe@22` (zawsze z wersją)
- [ ] Tryb `auth` dobrany per funkcja (`'user'` / `'secret'` / `'publishable'` / `'none'`)
- [ ] `verify_jwt = false` w `config.toml` dla każdej funkcji z `auth` innym niż `'user'`
- [ ] CORS przez wrapper (`'default'` / `'disabled'` dla webhooków) — bez `_shared/cors.ts`
- [ ] `ctx.supabaseAdmin` tylko w webhookach/cronie, po weryfikacji podpisu
- [ ] Loguj błędy (widoczne w Dashboard > Logs)
- [ ] Zwracaj odpowiednie kody statusu
- [ ] Ustaw secrets przez CLI lub Dashboard
- [ ] Testuj lokalnie przed deployem

**Migracja ze Starego Kodu:**
```typescript
// ❌ STARY (Deno 1.x era)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
serve(async (req) => { ... });

// ⚠️ STARSZY (nadal działa, niezalecany przez Supabase — AI-prompt: „do NOT use Deno.serve")
import { createClient } from 'jsr:@supabase/supabase-js@2';
Deno.serve(async (req) => { ... });

// ✅ NOWY (Deno 2.x — oficjalny wzorzec 2026)
import { withSupabase } from 'npm:@supabase/server@^1';
export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => { ... }),
};
```

**Zobacz Także:**
- [auth-patterns.md](auth-patterns.md) - Weryfikacja JWT
- [security.md](security.md) - Service role
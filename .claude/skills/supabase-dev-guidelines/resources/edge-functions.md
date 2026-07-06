# Edge Functions

Wzorce dla Supabase Edge Functions - Deno runtime, autentykacja, CORS, Stripe.

---

## Struktura Edge Function

### Katalog i Plik
```
supabase/functions/
├── _shared/
│   └── cors.ts              # Współdzielone CORS headers
├── create-checkout-session/
│   └── index.ts
├── create-billing-portal-session/
│   └── index.ts
└── stripe-webhook/
    └── index.ts
```

### Współdzielone CORS Headers
```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### Podstawowy Szablon (2026)
```typescript
// supabase/functions/my-function/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    // Obsługa CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Logika funkcji
        const result = await processRequest(req);

        return new Response(
            JSON.stringify(result),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );
    } catch (error) {
        console.error('Function error:', error);

        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
```

---

## Importy (2026)

### Preferowane Źródła
```typescript
// Supabase - użyj JSR
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Stripe - użyj npm:
import Stripe from 'npm:stripe@18';

// Inne pakiety npm
import { z } from 'npm:zod@3';

// Deno std (jeśli potrzebne)
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
```

### Dlaczego JSR/npm zamiast esm.sh?

| Źródło | Status 2026 | Użycie |
|--------|-------------|--------|
| `jsr:` | ✅ Preferowane | Pakiety Deno-native |
| `npm:` | ✅ Preferowane | Pakiety npm |
| `esm.sh` | ⚠️ Legacy | Tylko gdy jsr/npm nie działa |
| `deno.land/x` | ❌ Deprecated | Migruj do jsr: |

### Konfiguracja `deno.json` (Preferowane)

Od Deno 2.x, `deno.json` jest preferowany nad import maps. Jeśli oba istnieją, `deno.json` ma pierwszeństwo.

```json
// supabase/functions/deno.json
{
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@2",
    "stripe": "npm:stripe@18"
  }
}
```

Z `deno.json` importy w kodzie są czystsze:
```typescript
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
```

---

## Weryfikacja JWT

### Pobieranie Użytkownika z Token
```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Pobierz Authorization header
        const authHeader = req.headers.get('Authorization');

        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        // Utwórz klienta Supabase z tokenem użytkownika
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        );

        // Pobierz użytkownika (weryfikuje token z serwerem)
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            throw new Error('Invalid token');
        }

        // Użytkownik zweryfikowany - kontynuuj
        const result = await processForUser(user);

        return new Response(
            JSON.stringify(result),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            }
        );
    }
});
```

---

## Przykład: Stripe Checkout

### create-checkout-session
```typescript
// supabase/functions/create-checkout-session/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2026-06-24.dahlia',
});

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Weryfikuj użytkownika
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing authorization');
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            throw new Error('Unauthorized');
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

        return new Response(
            JSON.stringify({ sessionId: session.id, url: session.url }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('Checkout error:', error);

        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
```

---

## Przykład: Stripe Webhook

### stripe-webhook
```typescript
// supabase/functions/stripe-webhook/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2026-06-24.dahlia',
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
    try {
        const body = await req.text();
        const signature = req.headers.get('stripe-signature');

        if (!signature) {
            throw new Error('Missing signature');
        }

        // Weryfikuj sygnaturę webhook
        const event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret
        );

        // Service role client dla pełnego dostępu
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

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

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Webhook error:', error);

        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
```

**Uwaga:** Webhook nie używa CORS headers - jest wywoływany przez Stripe server-to-server.

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
// Automatycznie dostępne
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Walidacja input
        const body = await req.json();
        
        if (!body.priceId) {
            return new Response(
                JSON.stringify({ error: 'Missing priceId' }),
                { 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400 
                }
            );
        }

        // Logika...
        const result = await process(body);

        return new Response(
            JSON.stringify(result),
            { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200 
            }
        );

    } catch (error) {
        // Loguj pełny błąd (widoczny w Supabase Dashboard > Logs)
        console.error('Function error:', error);

        // Zwróć bezpieczną wiadomość
        const message = error instanceof Error ? error.message : 'Internal error';
        const status = error instanceof AuthError ? 401 : 500;

        return new Response(
            JSON.stringify({ error: message }),
            { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status 
            }
        );
    }
});
```

---

## Podsumowanie

**Checklist Edge Function (2026):**
- [ ] Użyj `Deno.serve()` (nie importuj serve)
- [ ] Importy: `jsr:` dla Supabase, `npm:` dla Stripe
- [ ] Obsłuż CORS preflight (OPTIONS)
- [ ] Weryfikuj JWT dla autentykowanych endpointów
- [ ] Użyj service_role tylko dla webhooków
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

// ✅ NOWY (Deno 2.x — obecny runtime)
import { createClient } from 'jsr:@supabase/supabase-js@2';
Deno.serve(async (req) => { ... });
```

**Zobacz Także:**
- [auth-patterns.md](auth-patterns.md) - Weryfikacja JWT
- [security.md](security.md) - Service role
# Wzorce Bezpieczenstwa Auth

Wzorce bezpieczenstwa specyficzne dla auth flow w stacku React 19 + Supabase + Edge Functions.

---

## 1. Supabase RLS Patterns

### Read Own Data

Uzytkownik widzi tylko swoje dane. Najpopularniejszy wzorzec.

```sql
-- Profil uzytkownika
CREATE POLICY "users_read_own_profile"
ON profiles FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = id);
```

### Read Public Data

Dane dostepne dla wszystkich (opublikowane posty, publiczne profile).

```sql
-- Opublikowane posty -- dostepne dla kazdego
CREATE POLICY "anyone_read_published_posts"
ON posts FOR SELECT
TO anon, authenticated
USING (published = true);

-- Wlasne posty (w tym nieopublikowane) -- tylko wlasciciel
CREATE POLICY "owners_read_own_posts"
ON posts FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

### Write Own Data

Uzytkownik moze tworzyc i edytowac tylko swoje dane.

```sql
-- INSERT -- wymuszenie user_id na biezacego uzytkownika
CREATE POLICY "users_insert_own_data"
ON posts FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

-- UPDATE -- tylko wlasne rekordy
CREATE POLICY "users_update_own_data"
ON posts FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
```

### Dostęp administracyjny (role)

> ⚠️ **KRYTYCZNE — najczęstszy błąd autoryzacji w Supabase, notorycznie popełniany przez agentów AI.**
> NIGDY nie trzymaj roli w `user_metadata`. Pole `raw_user_meta_data` (czyli claim `user_metadata` w JWT) jest **edytowalne przez samego użytkownika** — wystarczy `supabase.auth.updateUser({ data: { role: 'admin' } })` z konsoli/DevTools i atakujący podnosi sobie rolę, po czym RLS przepuszcza go do cudzych danych (privilege escalation).
> Do autoryzacji używaj **`app_metadata`** (ustawiane wyłącznie server-side, użytkownik go nie zmieni) albo **dedykowanej tabeli ról**.
> Nie używaj też top-levelowego claimu `role` w policy — to zarezerwowany claim Postgres/PostgREST (`authenticated` / `anon` / `service_role`), nie rola aplikacyjna.

```sql
-- ŹLE: user_metadata jest edytowalne przez klienta -> privilege escalation
-- USING ((SELECT auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')   -- NIGDY

-- Opcja 1: app_metadata (ustawiane server-side, immutable dla usera)
CREATE POLICY "admins_full_access"
ON posts FOR ALL
TO authenticated
USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Opcja 2: dedykowana tabela rol (preferowane przy RBAC / wielu rolach)
CREATE POLICY "admins_manage_posts"
ON posts FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.user_id = (SELECT auth.uid())
    )
);
```

Rolę w `app_metadata` ustawiasz **tylko z backendu** przez Admin API (klucz `service_role`) — nigdy z klienta:

```ts
// Server-side only (service_role) -- np. Edge Function, nigdy w przegladarce
await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'admin' },
});
```

### Typowe Bledy RLS

| Blad | Konsekwencja | Poprawka |
|------|-------------|----------|
| Brak `ENABLE ROW LEVEL SECURITY` | Pelny dostep dla kazdego | Zawsze wlaczaj RLS |
| Brak policy na DELETE | Nikt nie moze usuwac (lub kazdy, jesli RLS wylaczony) | Dodaj explicit DELETE policy |
| `auth.email()` w policy | Email jest mutowalny -- uzytkownik moze zmienic | Uzywaj `auth.uid()` (UUID immutable) |
| Rola z `user_metadata` w policy | User edytuje `user_metadata` z DevTools i podnosi sobie rolę (privilege escalation) | Używaj `app_metadata` (server-side) lub tabeli ról; nie top-level `role` |
| `auth.uid()` bez subquery | Wolniejsze -- ewaluowane per row | Uzywaj `(SELECT auth.uid())` -- ewaluowane raz |
| Brak policy = brak dostepu | Tabela jest niedostepna dla klientow | Zamierzone dla service-only tabel, blad dla reszty |
| Policy na SELECT ale nie na INSERT | Uzytkownik widzi dane ale nie moze tworzyc | Sprawdz kazda operacje osobno |

---

## 2. Edge Functions Auth

### JWT Verification -- Standardowy Wzorzec

Kazda chroniona Edge Function musi weryfikowac JWT.

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Utworz klienta z tokenem uzytkownika
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Brak tokena' } }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        );

        // Weryfikacja -- getUser() kontaktuje sie z serwerem Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Nieprawidlowy token' } }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Logika biznesowa z zweryfikowanym user.id
        // ...

        return new Response(
            JSON.stringify({ data: { success: true } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        // Loguj bez wrazliwych danych
        console.error('Edge Function error:', error instanceof Error ? error.message : 'Unknown');
        return new Response(
            JSON.stringify({ error: { code: 'INTERNAL', message: 'Blad serwera' } }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
```

### Service Role -- Kiedy i Jak

Service role omija RLS. Uzywaj TYLKO gdy operacja wymaga dostepu do danych innych uzytkownikow lub tabel bez policies.

```typescript
// Service role client -- TYLKO w Edge Functions, NIGDY na froncie
const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Przyklad: webhook Stripe musi zaktualizowac subskrypcje dowolnego uzytkownika
const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('stripe_customer_id', customerId);
```

**Zasady service_role:**
- NIGDY nie zwracaj danych pobranych przez service_role bezposrednio w odpowiedzi -- filtruj
- NIGDY nie przekazuj service_role key w headerach odpowiedzi
- NIGDY nie loguj service_role key
- Uzywaj service_role client tylko do konkretnych operacji, nie jako domyslny client

### CORS Handling

```typescript
// supabase/functions/_shared/cors.ts
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://myapp.com';

export const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
};
```

### Walidacja Inputow (Zod)

Kazdy input do Edge Function musi byc walidowany.

```typescript
import { z } from 'npm:zod@3';

const CreatePostSchema = z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
    published: z.boolean().default(false),
});

Deno.serve(async (req) => {
    // ... auth verification ...

    const body = await req.json();
    const parsed = CreatePostSchema.safeParse(body);

    if (!parsed.success) {
        return new Response(
            JSON.stringify({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Nieprawidlowe dane',
                    details: parsed.error.flatten().fieldErrors,
                },
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Uzyj parsed.data -- typowany i zwalidowany
    const { title, content, published } = parsed.data;
    // ...
});
```

---

## 3. React XSS Prevention

### React Domyslnie Escapuje -- Ale Sa Pulapki

React automatycznie escapuje wartosci w JSX. Ponizsze jest bezpieczne:

```typescript
// BEZPIECZNE -- React escapuje userInput
function SafeComponent({ userInput }: { userInput: string }) {
    return <p>{userInput}</p>; // <script> zostanie wyswietlone jako tekst
}
```

### Pulapka 1: Niebezpieczne renderowanie raw HTML

Kazde wstawianie surowego HTML od uzytkownika do DOM jest niebezpieczne -- zarowno przez React API (`__html`), jak i natywne DOM API. Zawsze sanityzuj przez DOMPurify.

```typescript
// BEZPIECZNE -- sanityzacja DOMPurify przed renderowaniem HTML
import DOMPurify from 'dompurify';

function SafeComment({ html }: { html: string }) {
    const clean = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    // Renderuj tylko po sanityzacji -- uzyj odpowiedniego API React do wstawienia HTML
    return <div>{clean}</div>;
}
```

### Pulapka 2: User-Generated URLs

Protokol `javascript:` w atrybutach `href` i `src` pozwala na wykonanie kodu.

```typescript
// NIEBEZPIECZNE -- javascript: protocol
function UserProfile({ websiteUrl }: { websiteUrl: string }) {
    return <a href={websiteUrl}>Strona</a>;
    // Jesli websiteUrl = "javascript:alert(document.cookie)" -- XSS
}

// BEZPIECZNE -- walidacja protokolu
function UserProfile({ websiteUrl }: { websiteUrl: string }) {
    const isSafe = /^https?:\/\//i.test(websiteUrl);
    if (!isSafe) return null;

    return (
        <a href={websiteUrl} rel="noopener noreferrer" target="_blank">
            Strona
        </a>
    );
}
```

### Pulapka 3: Dynamiczne Atrybuty src/href

```typescript
// NIEBEZPIECZNE -- user input w src bez walidacji
function Avatar({ imageUrl }: { imageUrl: string }) {
    return <img src={imageUrl} alt="Avatar" />;
    // Moze prowadzic do request do wewnetrznych serwisow
}

// BEZPIECZNE -- whitelist domen
const ALLOWED_IMAGE_DOMAINS = [
    'avatars.githubusercontent.com',
    'lh3.googleusercontent.com',
    'your-supabase-project.supabase.co',
];

function Avatar({ imageUrl }: { imageUrl: string }) {
    let isSafe = false;
    try {
        const url = new URL(imageUrl);
        isSafe = url.protocol === 'https:' && ALLOWED_IMAGE_DOMAINS.includes(url.hostname);
    } catch {
        isSafe = false;
    }

    if (!isSafe) {
        return <div className="w-10 h-10 bg-muted rounded-full" />; // Placeholder
    }

    return <img src={imageUrl} alt="Avatar" />;
}
```

---

## 4. Walidacja Granic Systemu

Kazdy punkt wejscia danych musi miec walidacje Zod. Ponizej lista wymaganych walidacji per typ operacji.

### Create (INSERT)

```typescript
const CreateItemSchema = z.object({
    // Wymagane pola z ograniczeniami
    name: z.string().min(1, 'Nazwa wymagana').max(200, 'Nazwa za dluga'),
    description: z.string().max(5000).optional(),
    // Enumeracje zamiast dowolnych stringow
    status: z.enum(['draft', 'published', 'archived']),
    // Numeryczne z zakresem
    priority: z.number().int().min(1).max(5),
    // Tablice z limitem
    tags: z.array(z.string().max(50)).max(10).default([]),
});
```

### Update (UPDATE)

```typescript
// Partial -- kazde pole opcjonalne, ale z tymi samymi ograniczeniami
const UpdateItemSchema = CreateItemSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Przynajmniej jedno pole wymagane' }
);
```

### Delete (DELETE)

```typescript
const DeleteItemSchema = z.object({
    id: z.string().uuid('Nieprawidlowy format ID'),
});
```

### Query (SELECT z filtrami)

```typescript
const QueryItemsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    search: z.string().max(200).optional(),
    sortBy: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

### Wzorzec Uzycia na Granicy

```typescript
// Edge Function
Deno.serve(async (req) => {
    const body = await req.json();
    const result = CreateItemSchema.safeParse(body);

    if (!result.success) {
        return new Response(
            JSON.stringify({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Nieprawidlowe dane wejsciowe',
                    details: result.error.flatten().fieldErrors,
                },
            }),
            { status: 400 }
        );
    }

    // Od tego momentu result.data jest typowane i bezpieczne
    const item = result.data;
});

// React Hook Form + Zod (frontend)
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function CreateItemForm() {
    const form = useForm({
        resolver: zodResolver(CreateItemSchema),
        defaultValues: { name: '', status: 'draft' as const, priority: 1, tags: [] },
    });

    const onSubmit = form.handleSubmit(async (data) => {
        // data jest juz zwalidowane przez Zod
        await supabase.from('items').insert(data);
    });
}
```

---

## 5. Secrets Management

### Co NIE moze byc w VITE_* (dostepne w przegladarce)

Zmienne z prefixem `VITE_` sa wbudowane w bundle JavaScript i widoczne dla kazdego uzytkownika.

**NIGDY nie umieszczaj w VITE_*:**
- `SUPABASE_SERVICE_ROLE_KEY` -- omija RLS, pelny dostep do bazy
- `STRIPE_SECRET_KEY` -- pelny dostep do Stripe API
- `STRIPE_WEBHOOK_SECRET` -- weryfikacja webhookow
- Jakiekolwiek klucze z prefixem `sk_`, `secret_`, `private_`
- Hasla do baz danych, API keys z pelnym dostepem
- Klucze szyfrowania, JWT secret

### Co MOZE byc w VITE_* (bezpieczne do ekspozycji)

- `VITE_SUPABASE_URL` -- publiczny URL projektu
- `VITE_SUPABASE_ANON_KEY` -- anon key (ograniczony przez RLS)
- `VITE_SENTRY_DSN` -- DSN do raportowania bledow
- `VITE_APP_URL` -- URL aplikacji
- Publiczne identyfikatory (np. Google Analytics ID, Facebook App ID)

### Pattern: .env -> .env.local -> .env.example

```bash
# .env.example (commitowany do repo -- TYLKO klucze bez wartosci)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SENTRY_DSN=
VITE_APP_URL=

# .env.local (NIE commitowany -- w .gitignore)
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SENTRY_DSN=https://abc@sentry.io/123
VITE_APP_URL=http://localhost:5173
```

**Weryfikacja .gitignore:**
```gitignore
# Secrets
.env
.env.local
.env.*.local
!.env.example
```

### Edge Functions -- Zmienne Srodowiskowe

Edge Functions maja dostep do zmiennych ustawionych przez CLI lub Dashboard.

```bash
# Ustawianie secretow przez CLI
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set ALLOWED_ORIGIN=https://myapp.com

# Sprawdzanie ustawionych secretow (bez wartosci)
supabase secrets list
```

**Uzycie w Edge Function:**
```typescript
// Zmienne dostepne przez Deno.env.get()
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

// Zmienne Supabase dostepne automatycznie:
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = Deno.env.get('SUPABASE_URL');
```

**Zasady:**
- NIGDY nie hardcoduj secretow w kodzie Edge Functions
- NIGDY nie loguj wartosci secretow
- Rozne wartosci dla dev/staging/prod (Supabase CLI profiles)
- Rotuj klucze regularnie (przynajmniej co 90 dni dla kluczy produkcyjnych)

---

## Podsumowanie

**Najwazniejsze zasady:**
1. RLS zawsze wlaczony, policies na kazdej operacji, `(SELECT auth.uid())` zamiast `auth.email()`
2. Edge Functions -- `getUser()` do weryfikacji JWT, service_role tylko gdy konieczne
3. React -- uwazaj na niebezpieczne renderowanie raw HTML, user URLs, dynamiczne `src`/`href`
4. Zod na kazdej granicy systemu (Edge Functions, formularze, query params)
5. Secrets -- VITE_* tylko dla publicznych kluczy, reszta w Edge Functions env vars

**Zobacz takze:**
- [owasp-react-supabase.md](owasp-react-supabase.md) -- OWASP Top 10 mapowanie

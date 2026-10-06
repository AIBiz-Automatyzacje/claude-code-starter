# Klient, przegląd tematów i częste błędy

Warstwa referencyjna skilla supabase-dev-guidelines: konfiguracja klienta, podstawowe operacje, skrót każdego przewodnika z `resources/`, zmienne środowiskowe i częste błędy z poprawną wersją. Reguły stałe i checklisty są w `SKILL.md`.

## Klient Supabase

### Typed Client (Standard 2026)
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// Publishable key (sb_publishable_...) — bezpieczny do ujawnienia, podlega RLS.
// Legacy anon/service_role (JWT) będą wycofane do końca 2026 — nowe projekty
// używają publishable/secret keys (docs: guides/api/api-keys).
export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    // Domyślny flowType to 'implicit' — dla OAuth/magic link ustaw PKCE jawnie
    { auth: { flowType: 'pkce' } }
);

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update'];
```

### Generowanie Typów
```bash
# Z lokalnej bazy
supabase gen types --lang typescript --local > src/types/database.types.ts

# Z produkcji (pozycyjne `typescript` to stara forma — używaj --lang)
supabase gen types --lang typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

### Podstawowe Operacje
```typescript
// SELECT
const { data, error } = await supabase
    .from('posts')
    .select('id, title, created_at')  // kolumny potrzebne widokowi, nie '*'
    .eq('published', true)
    .order('created_at', { ascending: false });

// INSERT
const { data, error } = await supabase
    .from('posts')
    .insert({ title, content, user_id: userId });

// UPDATE
const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: newName })
    .eq('id', userId);

// DELETE
const { data, error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);

// RPC (wywołanie funkcji PostgreSQL)
const { data, error } = await supabase.rpc('ensure_user_profile');
```

---

## Topic Guides

### Autentykacja

**Dostępne metody:**
- OAuth (Google, Facebook, GitHub, Discord, etc.)
- Email/hasło

**Kluczowe Koncepcje:**
- Domyślny `flowType` w `createClient` to `implicit` — PKCE włącz jawnie: `{ auth: { flowType: 'pkce' } }` (`@supabase/ssr` ma PKCE skonfigurowane); `detectSessionInUrl: true` domyślnie — nie wymieniaj `code` ręcznie w przeglądarce
- Hook `useAuth()` zarządza sesją
- Trigger `handle_new_user()` tworzy rekord w `public.profiles`
- Funkcja `ensure_user_profile()` jako fallback
- `getSession()` dla UI, `getUser()` lub `getClaims()` dla krytycznych operacji

**[Pełny Przewodnik: auth-patterns.md](auth-patterns.md)**

---

### Baza Danych i RLS

**Wzorcowe Tabele:**
- `profiles` - dane użytkowników (1:1 z auth.users)
- `posts` - treści z własnością użytkownika
- `comments` - relacje do postów i użytkowników
- `bookmarks` - relacja many-to-many
- `audit_log` - logowanie krytycznych operacji (write-only)

**RLS Patterns:**
- Public read: `USING (true)`
- Own data: `USING ((SELECT auth.uid()) = user_id)`
- Conditional: `USING (published = true OR (SELECT auth.uid()) = user_id)`
- Service only: brak policies (tylko service_role)

**[Pełny Przewodnik: database-patterns.md](database-patterns.md)**

---

### Edge Functions

**Typowe Zastosowania:**
- Stripe Checkout / Webhooks
- Integracje z zewnętrznymi API
- Operacje wymagające service_role

**Wzorce 2026:**
- `export default { fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {...}) }` z `npm:@supabase/server@^1` — `ctx.supabase` (RLS) / `ctx.supabaseAdmin`; Supabase zaleca ten wrapper, `Deno.serve()` to starsza forma, która też działa
- `npm:@supabase/supabase-js@2` (nie jsr:/esm.sh) — tylko gdy potrzebny klient poza `ctx`
- `npm:stripe@22` (nie esm.sh)
- `constructEventAsync` dla Stripe webhooks
- Runtime: **Deno 2.x** (upgrade z 1.45.2)
- `deno.json` preferowany nad import maps

**[Pełny Przewodnik: edge-functions.md](edge-functions.md)**

---

### Bezpieczeństwo

**Kluczowe Wzorce:**
- RLS dla izolacji danych
- UUID w policies (nie email - email jest mutowalny)
- SECURITY DEFINER dla uprawnionych operacji
- Audit log izolowany (bez INSERT dla authenticated)
- Logowanie przez triggers lub SECURITY DEFINER functions

**[Pełny Przewodnik: security.md](security.md)**

---

### Realtime (Opcjonalnie)

**Użycie:**
- Subscriptions dla zmian w tabelach
- Presence dla statusu użytkowników
- Broadcast dla custom events

**Bezpieczeństwo:** kanały prywatne (`config: { private: true }`) działają dopiero po wyłączeniu
„Allow public access" w **Realtime Settings** (`/dashboard/project/_/realtime/settings`).
Dopóki jest włączone, RLS na `realtime.messages` nie jest wymuszane przy joinie.

**[Pełny Przewodnik: realtime.md](realtime.md)**

---

## Zmienne Środowiskowe

### Frontend (.env.local)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # legacy: VITE_SUPABASE_ANON_KEY (wycofywany do końca 2026)
```

### Edge Functions
```env
# Wstrzykiwane automatycznie (withSupabase czyta je sam):
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEYS={"default":"sb_publishable_..."}
SUPABASE_SECRET_KEYS={"default":"sb_secret_..."}   # legacy: SUPABASE_SERVICE_ROLE_KEY; poza repo, bez commitu
# Własne secrets (supabase secrets set):
STRIPE_SECRET_KEY=...          # poza repo, bez commitu
STRIPE_WEBHOOK_SECRET=...      # poza repo, bez commitu
```

---

## Częste Błędy

### Unikaj
```typescript
// ❌ Service role na froncie
const supabase = createClient(url, SERVICE_ROLE_KEY);

// ❌ Email w RLS policy
USING (user_email = auth.email())  // Email może się zmienić!

// ❌ Brak typów
const { data } = await supabase.from('posts').select('*');  // data: any

// ❌ console.error w produkcji
console.error('DB error:', error);  // Wycieka info o strukturze DB

// ❌ Stary import w Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// ❌ getSession() do autoryzacji server-side
const { data: { session } } = await supabase.auth.getSession();
if (session) { /* autoryzacja */ }  // Token nie jest zweryfikowany!
```

### Preferuj
```typescript
// ✅ Publishable key na froncie (sb_publishable_...; legacy anon key działa do końca 2026)
const supabase = createClient(url, PUBLISHABLE_KEY);

// ✅ UUID w RLS policy (subquery: wynik liczony raz na zapytanie)
USING ((SELECT auth.uid()) = user_id)  // UUID jest immutable

// ✅ Typed queries z wybranymi kolumnami
const { data } = await supabase.from('posts').select('id, title');  // typ wyniku z wybranych kolumn

// ✅ Production-safe logger
logger.error('Błąd operacji', error);

// ✅ Nowy standard Edge Functions (Deno.serve = legacy, nadal działa)
export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => { ... }),
};

// ✅ getUser() lub getClaims() do autoryzacji
const { data: { user } } = await supabase.auth.getUser();
if (user) { /* autoryzacja */ }
```

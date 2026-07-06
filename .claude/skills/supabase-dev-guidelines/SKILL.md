---
name: supabase-dev-guidelines
description: Auth (Google/Facebook OAuth, email), Database (PostgreSQL, RLS policies, SECURITY DEFINER), Edge Functions, Realtime subscriptions. Uzywaj przy pracy z autentykacja, baza danych, migracjami, bezpieczenstwem.
---

# Supabase Development Guidelines

## Cel

Kompleksowy przewodnik dla pracy z Supabase w aplikacjach Vite SPA - autentykacja, baza danych, RLS policies, Edge Functions i bezpieczeństwo.

## Kiedy Używać Tego Skilla

- Praca z autentykacją (login, rejestracja, OAuth)
- Tworzenie lub modyfikacja tabel bazy danych
- Pisanie RLS policies
- Tworzenie Edge Functions
- Migracje bazy danych
- Bezpieczeństwo i audit logging

---

## Quick Start

### Checklist Nowej Tabeli

- [ ] Utwórz tabelę w migracji SQL
- [ ] Włącz RLS: `ALTER TABLE tablename ENABLE ROW LEVEL SECURITY`
- [ ] Zdefiniuj RLS policies dla SELECT, INSERT, UPDATE, DELETE
- [ ] Używaj `(SELECT auth.uid())` w policies (nie email) — subquery dla wydajności
- [ ] Dodaj indeksy dla często używanych kolumn
- [ ] Wygeneruj typy: `supabase gen types typescript --local > src/types/database.ts`
- [ ] Utwórz funkcje API w `lib/supabase.ts`

### Checklist Edge Function

- [ ] Utwórz katalog `supabase/functions/function-name/`
- [ ] Użyj `Deno.serve()` (nie importuj serve)
- [ ] Importy: `jsr:@supabase/supabase-js@2`, `npm:stripe@18`
- [ ] CORS headers w `_shared/cors.ts`
- [ ] Zweryfikuj JWT jeśli wymagana autentykacja
- [ ] Loguj błędy (bez wrażliwych danych)
- [ ] Przetestuj lokalnie: `supabase functions serve`
- [ ] Deploy: `supabase functions deploy function-name`

### Checklist Bezpieczeństwa

- [ ] RLS włączony na każdej tabeli
- [ ] UUID (`auth.uid()`) w policies, nie email
- [ ] Audit log bez INSERT policy dla authenticated (tylko triggers/SECURITY DEFINER)
- [ ] `SET search_path = ''` (pusty) + w pełni kwalifikowane nazwy (`public.tabela`) w każdej funkcji SECURITY DEFINER
- [ ] Email enumeration protection włączone w Dashboard

---

## Klient Supabase

### Typed Client (Standard 2026)
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
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
supabase gen types typescript --local > src/types/database.ts

# Z produkcji
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

### Podstawowe Operacje
```typescript
// SELECT
const { data, error } = await supabase
    .from('posts')
    .select('*')
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
- PKCE z auto-detekcją (`detectSessionInUrl: true` — domyślnie); nie wymieniaj `code` ręcznie w przeglądarce
- Hook `useAuth()` zarządza sesją
- Trigger `handle_new_user()` tworzy rekord w `public.profiles`
- Funkcja `ensure_user_profile()` jako fallback
- `getSession()` dla UI, `getUser()` lub `getClaims()` dla krytycznych operacji

**[Pełny Przewodnik: resources/auth-patterns.md](resources/auth-patterns.md)**

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

**[Pełny Przewodnik: resources/database-patterns.md](resources/database-patterns.md)**

---

### Edge Functions

**Typowe Zastosowania:**
- Stripe Checkout / Webhooks
- Integracje z zewnętrznymi API
- Operacje wymagające service_role

**Wzorce 2026:**
- `Deno.serve()` (wbudowane, bez importu)
- `jsr:@supabase/supabase-js@2` (nie esm.sh)
- `npm:stripe@18` (nie esm.sh)
- `constructEventAsync` dla Stripe webhooks
- Runtime: **Deno 2.x** (upgrade z 1.45.2)
- `deno.json` preferowany nad import maps

**[Pełny Przewodnik: resources/edge-functions.md](resources/edge-functions.md)**

---

### Bezpieczeństwo

**Kluczowe Wzorce:**
- RLS dla izolacji danych
- UUID w policies (nie email - email jest mutowalny)
- SECURITY DEFINER dla uprawnionych operacji
- Audit log izolowany (bez INSERT dla authenticated)
- Logowanie przez triggers lub SECURITY DEFINER functions

**[Pełny Przewodnik: resources/security.md](resources/security.md)**

---

### Realtime (Opcjonalnie)

**Użycie:**
- Subscriptions dla zmian w tabelach
- Presence dla statusu użytkowników
- Broadcast dla custom events

**[Pełny Przewodnik: resources/realtime.md](resources/realtime.md)**

---

## Navigation Guide

| Potrzebujesz... | Przeczytaj |
|-----------------|------------|
| Autentykację OAuth/email | [auth-patterns.md](resources/auth-patterns.md) |
| Bazę danych i RLS | [database-patterns.md](resources/database-patterns.md) |
| Edge Functions | [edge-functions.md](resources/edge-functions.md) |
| Bezpieczeństwo | [security.md](resources/security.md) |
| Realtime subscriptions | [realtime.md](resources/realtime.md) |
| Supabase CLI | [cli-guide.md](resources/cli-guide.md) |

---

## Główne Zasady

1. **RLS Zawsze Włączony**: Każda tabela musi mieć RLS
2. **UUID w Policies**: `auth.uid() = user_id`, nigdy email
3. **Generated Types**: `supabase gen types` po każdej migracji
4. **SECURITY DEFINER Ostrożnie**: Zawsze `SET search_path = ''` (pusty) + w pełni kwalifikowane nazwy (`public.tabela`)
5. **Service Role Tylko w Edge Functions**: Nigdy nie eksponuj na froncie
6. **Audit Log Izolowany**: Wpisy tylko przez triggers/SECURITY DEFINER
7. **Logger dla Błędów**: `logger.error()` zamiast `console.error()`

---

## Zmienne Środowiskowe

### Frontend (.env.local)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Edge Functions
```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...  # NIGDY nie commituj!
STRIPE_SECRET_KEY=...          # NIGDY nie commituj!
STRIPE_WEBHOOK_SECRET=...      # NIGDY nie commituj!
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
// ✅ Anon key na froncie
const supabase = createClient(url, ANON_KEY);

// ✅ UUID w RLS policy
USING (auth.uid() = user_id)  // UUID jest immutable

// ✅ Typed queries
const { data } = await supabase.from('posts').select('*');  // data: Tables[]

// ✅ Production-safe logger
logger.error('Błąd operacji', error);

// ✅ Nowy standard Edge Functions
Deno.serve(async (req) => { ... });

// ✅ getUser() lub getClaims() do autoryzacji
const { data: { user } } = await supabase.auth.getUser();
if (user) { /* autoryzacja */ }
```

---

**Status Skilla**: Modułowa struktura z progressive loading dla optymalnego zarządzania kontekstem. Zaktualizowany do standardów Marzec 2026.

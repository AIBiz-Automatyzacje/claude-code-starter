---
name: supabase-dev-guidelines
description: Auth (Google/Facebook OAuth, email), Database (PostgreSQL, RLS policies, SECURITY DEFINER), Edge Functions, Realtime subscriptions. Uzywaj przy pracy z autentykacja, baza danych, migracjami, bezpieczenstwem.
paths:
  - "supabase/**"
  - "**/*.sql"
  - "src/lib/**"
  - "src/hooks/**"
---

# Supabase Development Guidelines

## Cel

Przewodnik pracy z Supabase w aplikacjach Vite SPA: autentykacja, baza danych, polityki RLS, Edge Functions i Realtime. Ten plik to checklisty i zasady stałe; przykłady kodu i szczegóły są w `resources/` (tabela na końcu). Reguły bezpieczeństwa (RLS, autoryzacja, klucze, dane w odpowiedziach) są w skillu security i w sekcji Bezpieczeństwo `.claude/rules/coding-rules.md` — tu stoją tylko odwołania do nich.

## Kiedy Używać Tego Skilla

- Praca z autentykacją (login, rejestracja, OAuth)
- Tworzenie lub modyfikacja tabel bazy danych
- Pisanie RLS policies
- Tworzenie Edge Functions
- Migracje bazy danych
- Bezpieczeństwo i audit logging

---

## Checklisty

### Nowa tabela

- [ ] Tabela w nowej migracji SQL (`supabase migration new <opis>`)
- [ ] RLS w tej samej migracji: `ALTER TABLE tablename ENABLE ROW LEVEL SECURITY`
- [ ] Polityki dla operacji, których potrzebuje plan (SELECT, INSERT, UPDATE, DELETE) — według skilla security i reguł kodu
- [ ] W politykach UUID z `auth.uid()` (w subquery, jak w regułach kodu), nie email
- [ ] Indeksy dla kolumn filtrów zapytań i polityk
- [ ] Typy po migracji: `supabase gen types --lang typescript --local > src/types/database.ts`
- [ ] Funkcje API w `lib/supabase.ts` (albo w module zapytań, którego używa projekt)

### Edge Function

- [ ] Katalog `supabase/functions/function-name/`
- [ ] `export default { fetch: withSupabase({ auth }, handler) }` z `npm:@supabase/server@^1` (nie `Deno.serve()`)
- [ ] Importy: `npm:@supabase/supabase-js@2`, `npm:stripe@22`
- [ ] Tryb `auth` per funkcja: `'user'` (JWT), `'secret'` (cron/pg_net), `'publishable'` (przed logowaniem), `'none'` (webhook zewnętrzny)
- [ ] `verify_jwt = false` w `supabase/config.toml` dla trybów innych niż `'user'`
- [ ] CORS załatwia wrapper (`cors: 'disabled'` dla webhooków) — bez `_shared/cors.ts`
- [ ] Błędy przez `captureError` (skill sentry-integration), bez wrażliwych danych
- [ ] Test lokalny: `supabase functions serve`
- [ ] Deploy (`supabase functions deploy function-name`) na prośbę operatora

### Bezpieczeństwo bazy

- [ ] RLS włączony na każdej tabeli w schemacie API
- [ ] UUID (`auth.uid()`) w politykach, nie email
- [ ] Audit log bez INSERT policy dla authenticated (wpisy tylko przez triggery i funkcje SECURITY DEFINER)
- [ ] Każda funkcja SECURITY DEFINER: `SET search_path = ''` (pusty), w pełni kwalifikowane nazwy (`public.tabela`), EXECUTE odebrane od `PUBLIC` i `anon` i nadane roli, która ją woła
- [ ] Email enumeration protection włączone w Dashboard

---

## Główne zasady

1. **RLS zawsze włączony** — każda tabela w schemacie API ma RLS, bo bez niego klucz publiczny czyta i zmienia całą tabelę (szczegóły w skillu security).
2. **UUID w politykach, nie email** — użytkownik zmienia email, a UUID z `auth.uid()` jest niezmienny, więc polityka na emailu po zmianie adresu daje dostęp złej osobie.
3. **Typy generowane po każdej migracji** — `supabase gen types`, bo kod typuje się z wygenerowanego pliku, a stary plik przepuszcza zapytania do nieistniejących kolumn.
4. **SECURITY DEFINER ostrożnie** — funkcja działa z prawami właściciela i omija RLS, więc dostaje pusty `search_path`, w pełni kwalifikowane nazwy i EXECUTE tylko dla roli, która ją woła (reguły kodu; uzasadnienie w `resources/security.md`).
5. **Klucz sekretny tylko w Edge Functions** — klucz `service_role` i sekretny omijają RLS, a wszystko po stronie przeglądarki jest publiczne (skill security).
6. **Audit log izolowany** — wpisy tylko przez triggery i funkcje SECURITY DEFINER, bo użytkownik z polityką INSERT dopisze sobie dowolną historię.
7. **Błędy przez logger** — `logger.error()` zamiast `console.error()`, bo logger maskuje dane i wysyła zdarzenie do Sentry (skill sentry-integration).

---

## Navigation Guide

| Potrzebujesz... | Przeczytaj |
|-----------------|------------|
| Klienta, typów, podstawowych operacji, zmiennych środowiskowych i częstych błędów | [klient-i-przeglad.md](resources/klient-i-przeglad.md) |
| Autentykację OAuth/email | [auth-patterns.md](resources/auth-patterns.md) |
| Bazę danych i RLS | [database-patterns.md](resources/database-patterns.md) |
| Edge Functions | [edge-functions.md](resources/edge-functions.md) |
| Bezpieczeństwo | [security.md](resources/security.md) |
| Realtime subscriptions | [realtime.md](resources/realtime.md) |
| Supabase CLI | [cli-guide.md](resources/cli-guide.md) |

Przewodnik tematu czytasz, zanim zaczniesz pisać kod tego tematu: każdy ma pułapki, których nie widać w samym API (domyślny `flowType` `implicit` zamiast PKCE w auth, kanały prywatne Realtime działające dopiero po wyłączeniu publicznego dostępu, `withSupabase` zamiast `Deno.serve` w Edge Functions).

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
- [ ] RLS i polityki w tej samej migracji — według skilla security (operacje, `with check`, kolumny chronione) i reguł kodu (subquery `auth.uid()`, `TO <rola>`)
- [ ] Indeksy dla kolumn filtrów zapytań i polityk
- [ ] Typy po migracji: `supabase gen types --lang typescript --local > src/types/database.types.ts` (albo plik typów, którego projekt już używa)
- [ ] Funkcje API w `lib/supabase.ts` (albo w module zapytań, którego używa projekt)

### Edge Function

- [ ] Katalog `supabase/functions/function-name/`
- [ ] `export default { fetch: withSupabase({ auth }, handler) }` z `npm:@supabase/server@^1` (nie `Deno.serve()`)
- [ ] Importy: `npm:@supabase/supabase-js@2`, `npm:stripe@22`
- [ ] Tryb `auth` per funkcja: `'user'` (JWT), `'secret'` (cron/pg_net), `'publishable'` (przed logowaniem), `'none'` (webhook zewnętrzny); co uzupełnić w kodzie przy każdym trybie — skill security
- [ ] `verify_jwt = false` w `supabase/config.toml` dla trybów innych niż `'user'`
- [ ] CORS załatwia wrapper (`cors: 'disabled'` dla webhooków) — bez `_shared/cors.ts`
- [ ] Błędy przez `captureError` (skill sentry-integration), odpowiedź w kopercie błędu z reguł kodu
- [ ] Test lokalny: `supabase functions serve`
- [ ] Deploy (`supabase functions deploy function-name`) na prośbę operatora

### Baza poza politykami

- [ ] Funkcja SECURITY DEFINER według reguł kodu (pusty `search_path`, EXECUTE tylko dla roli, która ją woła); przykłady z REVOKE/GRANT w `resources/security.md`
- [ ] Email enumeration protection włączone w Dashboard

---

## Główne zasady

1. **UUID w politykach, nie email** — użytkownik zmienia email, a UUID z `auth.uid()` jest niezmienny, więc polityka na emailu po zmianie adresu daje dostęp złej osobie.
2. **Typy generowane po każdej migracji** — `supabase gen types`, bo kod typuje się z wygenerowanego pliku, a stary plik przepuszcza zapytania do nieistniejących kolumn.
3. **Audit log izolowany** — bez polityki INSERT dla `authenticated`, wpisy tylko przez triggery i funkcje SECURITY DEFINER, bo użytkownik z polityką INSERT dopisze sobie dowolną historię.
4. **Nieoczekiwany błąd przez logger** — `logger.error()` zamiast `console.error()`, bo logger wysyła zdarzenie do Sentry z kontekstem; oczekiwaną odmowę zapisuje `logger.info()` bez zdarzenia (skill sentry-integration).

RLS, klucze i autoryzacja w Edge Functions — skill security; funkcje SECURITY DEFINER, polityki z subquery i walidacja wejścia — sekcja Bezpieczeństwo reguł kodu.

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

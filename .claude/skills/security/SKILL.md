---
name: security
description: "Reguły bezpieczeństwa dla kodu React 19 + Supabase + Edge Functions (RLS, autoryzacja, walidacja wejścia, sekrety, XSS, SSRF) i protokół audytu bezpieczeństwa w resources. Używaj przy pisaniu kodu z auth/authz, RLS policies, walidacją inputów, Edge Functions i danymi osobowymi, a także przy review bezpieczeństwa, audycie przed deployem i OWASP Top 10."
---

# Bezpieczeństwo implementacji

Reguły dla kodu, który piszesz w projekcie React 19 + Supabase + Edge Functions. Uzupełniają sekcję Bezpieczeństwo w `.claude/rules/coding-rules.md` (sekrety, SQL z parametrami, walidacja wejścia schematem, źródło roli, polityki RLS, funkcje `security definer`, limity) i jej nie powtarzają. Przy każdej regule stoi powód, żeby przypadek spoza przykładu dało się rozstrzygnąć tym samym rozumowaniem.

## Baza danych i RLS

- Tabela w schemacie wystawionym przez API (`public`) dostaje `enable row level security` w tej samej migracji, która ją tworzy, bo między migracjami tabela bez RLS jest czytelna dla każdego z kluczem publicznym.
- Polityki piszesz osobno dla każdej operacji, której jednostka potrzebuje (`select`, `insert`, `update`, `delete`). Operacja bez polityki jest odmową i taka zostaje, gdy plan jej nie zamawia.
- `insert` ma `with check` z warunkiem własności, a `with check` w `update` nie jest słabszy niż `using` (bez klauzuli Postgres stosuje `using` do nowej wersji wiersza), bo `with check (true)` albo słabszy warunek pozwala założyć wiersz cudzemu właścicielowi albo oddać mu istniejący.
- `update` potrzebuje też polityki `select` na te same wiersze — bez niej Postgres nie widzi wiersza i aktualizacja zmienia zero wierszy bez błędu.
- Kolumnę, której użytkownik nie zmienia sam (rola, status płatności, właściciel), chronisz osobno, bo RLS filtruje wiersze, nie kolumny: `revoke update on <tabela> from authenticated` i `grant update (<kolumny dozwolone>) on <tabela> to authenticated`, trigger albo zmiana tylko przez funkcję. Samo `revoke update (kolumna)` nie działa, gdy rola ma UPDATE na całą tabelę, a Supabase nadaje je domyślnie.
- Widok nad tabelą z RLS tworzysz z `with (security_invoker = true)`, bo widok domyślnie działa z prawami właściciela i omija RLS.
- Dynamiczny SQL w funkcji PL/pgSQL składasz przez `format()` z `%I` dla identyfikatorów i `execute ... using` (albo `%L`) dla wartości, bo sklejony tekst w funkcji wołanej przez `.rpc()` to SQL injection mimo parametryzowanego klienta.
- Bucket Storage z plikami użytkowników jest prywatny, dostęp dają polityki na `storage.objects` (pierwszy segment ścieżki = identyfikator właściciela) i podpisane URL-e z krótkim czasem ważności, bo publiczny bucket udostępnia każdy plik pod przewidywalnym adresem.

## Edge Functions i autoryzacja

- Tożsamość wołającego bierzesz ze zweryfikowanego tokenu — `withSupabase({ auth: 'user' })` (`ctx.userClaims`) albo `getClaims()` / `getUser()` — a nie z `getSession()` ani z pola w ciele żądania, bo sesję z klienta i identyfikator w ciele podrobi każdy.
- Klient z kluczem sekretnym (`ctx.supabaseAdmin`, `service_role`) omija RLS, więc funkcja, która go używa, sprawdza w kodzie własność zasobu i rolę wołającego przed zapytaniem. Gdzie wystarcza klient użytkownika (`ctx.supabase`), używasz jego, bo wtedy RLS jest drugą bramką.
- Klucz sekretny i `service_role` trzymasz w sekretach Edge Functions; zmienna `VITE_*` trafia do paczki przeglądarki, więc klucz w niej jest publiczny.
- Tryb `auth` dobierasz do wołającego i uzupełniasz tym, czego wrapper nie sprawdza: `'secret'` weryfikuje klucz sekretny, więc ciało sprawdza uprawnienie do zasobu; `'publishable'` przepuszcza każdego z publicznym kluczem, więc funkcja ma limit częstości i nie zwraca cudzych danych; `'none'` nie sprawdza niczego, więc kontrola (podpis webhooka, limit) jest w kodzie funkcji.
- Błąd sprawdzenia uprawnień (wyjątek, przekroczony limit czasu, brak wiersza roli) kończy się odmową, bo gałąź obsługi błędu, która przepuszcza, daje dostęp przy każdej awarii bazy.
- Webhook weryfikuje podpis na surowym ciele (`await req.text()`, potem `constructEventAsync` dla Stripe) przed parsowaniem i jakimkolwiek zapisem, bo bez podpisu każdy wyśle zdarzenie „zapłacone”.
- Schemat Zod wejścia ogranicza każde pole: tekst ma `.max()` zgodne z ograniczeniem kolumny, a format (email, URL, UUID, data) ma walidator formatu, bo schemat przepuszczający dowolny string przenosi błąd do bazy albo do odbiorcy.
- Żądanie serwera pod adres z wejścia użytkownika (podgląd linku, import z URL, webhook wychodzący) idzie tylko do hostów z listy dozwolonych, po parsowaniu `new URL()` i sprawdzeniu protokołu, bo inaczej funkcja czyta adresy wewnętrzne (SSRF).

## Dane w odpowiedziach i logach

- Zapytanie wybiera kolumny potrzebne odbiorcy (`.select('id, title')`), bo `select('*')` wysyła klientowi każdą kolumnę, także dodaną później.
- Klient dostaje kod i komunikat z koperty błędu, a szczegóły błędu bazy (tabela, ograniczenie, treść SQL) idą do logu, bo ujawniają schemat.
- W logu i w Sentry użytkownika identyfikuje jego identyfikator, nie email ani imię; maskowanie i redakcję zdarzeń opisuje skill sentry-integration.

## Interfejs

- HTML z danych użytkownika albo CMS renderujesz przez `dangerouslySetInnerHTML` dopiero po sanitizacji (DOMPurify), bo React escapuje tekst, a nie gotowy HTML.
- URL z danych użytkownika w `href` i `src` przechodzi przez `new URL()` z listą dozwolonych protokołów (`https:`, `http:`, `mailto:`), bo `javascript:` w linku wykonuje kod po kliknięciu.
- Ukryty przycisk i chroniona trasa to wygoda interfejsu; tę samą regułę egzekwuje RLS albo funkcja serwera, bo klient omija każdy warunek w JS.

## Testy

- Każda polityka, trasa i funkcja z kontrolą dostępu ma test odmowy — bez sesji, inny użytkownik, rola bez uprawnienia — bo test tylko na właścicielu przechodzi także przy polityce `using (true)`.

## Audyt

Audyt bezpieczeństwa (review przed deployem, podejrzenie luki, audyt na prośbę operatora) prowadzisz według `resources/protokol-audytu.md`. Mapowanie OWASP Top 10:2025 na stack jest w `resources/owasp-react-supabase.md`, wzorce auth i bezpieczeństwa — w `resources/auth-security-patterns.md`.

-- MR-333c3d
-- Prywatne notatki handlowca do jego opublikowanej oferty (IU-MR).
--
-- Zasady, które ta migracja egzekwuje:
--   * Notatki widzi, dodaje i kasuje WYŁĄCZNIE właściciel oferty — RLS jest
--     jedyną linią obrony (tokeny MCP nie mają scope'ów). Zero polityk dla
--     `anon` i zero polityki admina: to prywatne zapiski handlowca.
--   * Notatka jest NIEMUTOWALNA: brak grantu i brak polityki UPDATE. Zmiana
--     treści = nowa notatka (i ewentualnie skasowanie starej).
--   * Autor jest wołającym: INSERT przechodzi tylko z `autor_id = auth.uid()`.
--   * `id` i `created_at` nadaje baza — grant INSERT jest kolumnowy, więc klient
--     nie podsunie własnego znacznika czasu i nie przestawi kolejności listy.
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- mr_notatki_oferty
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  autor_id uuid not null references auth.users (id),
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatne notatki handlowca do własnej oferty. Widoczne wyłącznie dla właściciela oferty; niemutowalne (brak UPDATE). Kasowane kaskadą razem z ofertą.';
comment on column public.mr_notatki_oferty.tresc is
  'Treść notatki po trim, 1–2000 znaków. `char_length` liczy PUNKTY KODOWE — walidacja Zod w apps/server/src/offer/mr-notatki.ts liczy tak samo.';

-- Sufit długości i zakaz treści z samych białych znaków, zakładane idempotentnie
-- (Postgres nie ma ADD CONSTRAINT IF NOT EXISTS). Lustro walidacji serwera:
-- serwer tnie białe znaki na brzegach, baza odrzuca to, czego cięcie nie
-- uratuje (token MCP idzie prosto do PostgREST z pominięciem serwera).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mr_notatki_oferty_tresc_shape_check'
      and conrelid = 'public.mr_notatki_oferty'::regclass
  ) then
    alter table public.mr_notatki_oferty
      add constraint mr_notatki_oferty_tresc_shape_check check (
        char_length(tresc) between 1 and 2000
        and tresc ~ '[^[:space:]]'
      );
  end if;
end $$;

-- Ścieżka odczytu: notatki jednej oferty od najnowszej. Ten sam indeks obsługuje
-- podzapytanie polityk i kaskadę `on delete` z `offers`.
create index if not exists mr_notatki_oferty_oferta_created_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe i kolumnowe
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty. Odbieramy je
-- i wydajemy minimum: odczyt, kasowanie i wstawienie TYLKO kolumn wejścia.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;

grant select, delete on table public.mr_notatki_oferty to authenticated;
grant insert (oferta_id, autor_id, tresc) on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Polityki osobno per operacja. `(select auth.uid())` zamiast `auth.uid()` —
-- planner liczy wartość raz na zapytanie, nie raz na wiersz. Własność oferty
-- czytana z `public.offers.owner_id` (sama `offers` ma RLS `offers_select_own`,
-- więc podzapytanie i tak widzi wyłącznie oferty wołającego).
-- Brak polityki UPDATE jest ŚWIADOMY — notatka jest niemutowalna.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.mr_notatki_oferty enable row level security;

drop policy if exists mr_notatki_oferty_select_owner on public.mr_notatki_oferty;
create policy mr_notatki_oferty_select_owner
  on public.mr_notatki_oferty
  for select
  to authenticated
  using (
    exists (
      select 1 from public.offers o
      where o.id = mr_notatki_oferty.oferta_id
        and o.owner_id = (select auth.uid())
    )
  );

drop policy if exists mr_notatki_oferty_insert_owner on public.mr_notatki_oferty;
create policy mr_notatki_oferty_insert_owner
  on public.mr_notatki_oferty
  for insert
  to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.offers o
      where o.id = mr_notatki_oferty.oferta_id
        and o.owner_id = (select auth.uid())
    )
  );

drop policy if exists mr_notatki_oferty_delete_owner on public.mr_notatki_oferty;
create policy mr_notatki_oferty_delete_owner
  on public.mr_notatki_oferty
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.offers o
      where o.id = mr_notatki_oferty.oferta_id
        and o.owner_id = (select auth.uid())
    )
  );

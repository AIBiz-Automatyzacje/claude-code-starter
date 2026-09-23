-- MR-0dbd80
-- Notatki handlowca do opublikowanej oferty („klient pytał o rabat").
--
-- Zasady, które ta migracja egzekwuje:
--   * RLS jest JEDYNĄ linią obrony — tokeny MCP z Supabase nie mają scope'ów,
--     więc token handlowca idzie prosto do PostgREST.
--   * Notatkę widzi, dodaje i kasuje wyłącznie WŁAŚCICIEL oferty
--     (`public.offers.owner_id`), a autorem wstawianej notatki jest wołający.
--   * Notatka jest niemutowalna: brak polityki UPDATE i brak grantu UPDATE.
--   * `id` i `created_at` nadaje baza — grant INSERT jest kolumnowy, więc klient
--     nie poda własnego czasu utworzenia (porządek listy jest po `created_at`).
--   * Zero polityk dla roli `anon`.
--
-- Wzorzec: `20260824171406_init_profiles_offers.sql` (tabela offers).
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- mr_notatki_oferty
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatna notatka handlowca do oferty. Widzi ją tylko właściciel oferty; notatka jest niemutowalna (brak UPDATE).';
comment on column public.mr_notatki_oferty.tresc is
  'Treść notatki: 1–2000 znaków (punkty kodowe, char_length), co najmniej jeden znak niebiały. Ten sam sufit trzyma MR_NOTATKA_MAX_ZNAKOW w apps/server/src/offer/mr-notatki.ts.';

-- Długość w punktach kodowych (`char_length`) — serwer liczy tę samą jednostkę
-- (`[...tresc].length`), nie jednostki UTF-16, więc obie bramki nie rozjadą się
-- poza BMP. Drugi warunek odrzuca treść z samych białych znaków wstawioną prosto
-- przez PostgREST z pominięciem `trim` w serwerze.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mr_notatki_oferty_tresc_check'
      and conrelid = 'public.mr_notatki_oferty'::regclass
  ) then
    alter table public.mr_notatki_oferty
      add constraint mr_notatki_oferty_tresc_check
      check (char_length(tresc) between 1 and 2000 and tresc ~ '[^[:space:]]');
  end if;
end $$;

-- Ścieżka odczytu: notatki jednej oferty od najnowszej. Kolumna `oferta_id`
-- jest też tą, po której filtruje polityka RLS.
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe i kolumnowe
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;

grant select, delete on table public.mr_notatki_oferty to authenticated;
-- INSERT kolumnowo: `id` i `created_at` zawsze z wartości domyślnych.
grant insert (oferta_id, autor_id, tresc) on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Własność oferty sprawdza podzapytanie na `public.offers` wykonywane z
-- uprawnieniami wołającego — polityka `offers_select_own` i tak pokazuje mu
-- wyłącznie własne oferty, a warunek `owner_id` jest tu jawnie powtórzony.
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
      where o.id = oferta_id
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
      where o.id = oferta_id
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
      where o.id = oferta_id
        and o.owner_id = (select auth.uid())
    )
  );

-- MR-R-50f9f4

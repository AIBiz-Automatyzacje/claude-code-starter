-- MR-dbca2f
-- Notatki handlowca do opublikowanej oferty („klient pytał o rabat”).
--
-- Zasady, które ta migracja egzekwuje:
--   * Notatkę widzi, dodaje i kasuje WYŁĄCZNIE właściciel oferty — RLS jest
--     jedyną linią obrony (tokeny MCP nie mają scope'ów), więc polityki pytają
--     `public.offers.owner_id`, a nie kolumnę samej notatki.
--   * Notatka jest niemutowalna: brak grantu i polityki UPDATE.
--   * Zero polityk dla roli `anon`.
--   * `id` i `created_at` nadaje baza — grant INSERT jest kolumnowy, więc klient
--     PostgREST nie przepisze znacznika czasu ani identyfikatora w ładunku.
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  -- Kaskada spójna z `offers.owner_id`: usunięcie konta zabiera jego notatki.
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatne notatki handlowca do opublikowanej oferty. Widzi je tylko właściciel oferty. Niemutowalne — brak UPDATE.';

-- Sufit liczony w punktach kodowych (`char_length`) — ta sama jednostka, którą
-- liczy moduł `apps/server/src/offer/mr-notatki.ts`. Dolna granica po `btrim`,
-- żeby treść z samych spacji nie przeszła bokiem przez PostgREST.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mr_notatki_oferty_tresc_length_check'
      and conrelid = 'public.mr_notatki_oferty'::regclass
  ) then
    alter table public.mr_notatki_oferty
      add constraint mr_notatki_oferty_tresc_length_check
      check (char_length(btrim(tresc)) >= 1 and char_length(tresc) <= 2000);
  end if;
end $$;

-- Ścieżka odczytu listy notatek oferty (najnowsze pierwsze); obsługuje też
-- klucz obcy `oferta_id` przy kaskadzie z `offers`.
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;

grant select, delete on table public.mr_notatki_oferty to authenticated;
grant insert (oferta_id, autor_id, tresc) on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- `(select auth.uid())` zamiast `auth.uid()` — planner liczy wartość raz na
-- zapytanie, nie raz na wiersz. Podzapytanie trafia w PK `offers`.
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

-- Autor to wołający ORAZ właściciel oferty — bez drugiego warunku dało się
-- dopisać notatkę do cudzej oferty, znając jej id.
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
-- MR-R-0a720b

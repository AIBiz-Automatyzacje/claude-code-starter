-- MR-433cbd
-- Notatki handlowca do opublikowanej oferty (IU-MR, docs/active/mr-notatki-oferty).
--
-- Zasady, które ta migracja egzekwuje:
--   * Notatka jest PRYWATNA — widzi ją wyłącznie właściciel oferty
--     (`public.offers.owner_id`). Odbiorca oferty nie ma do niej żadnej ścieżki:
--     zero polityk dla roli `anon`, a serwowanie oferty idzie przez serwis Node.
--   * Notatka jest NIEMUTOWALNA — brak grantu i polityki UPDATE. Poprawka to
--     nowa notatka (i ewentualne skasowanie starej).
--   * Tożsamość autora pochodzi z JWT: polityka INSERT wymaga
--     `autor_id = (select auth.uid())`, więc klient nie może podpisać notatki
--     cudzym identyfikatorem.
--   * Limit treści (1–2000 znaków) jest pilnowany w bazie — token MCP idzie
--     prosto do PostgREST, więc walidacja serwera nie jest jedyną barierą.
--
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
  'Prywatne notatki handlowca do opublikowanej oferty. Widoczne wyłącznie dla właściciela oferty; niemutowalne (brak UPDATE).';
comment on column public.mr_notatki_oferty.autor_id is
  'Autor notatki. Polityka INSERT wymusza równość z (select auth.uid()) — nigdy nie przepisuj wartości z danych klienta.';
comment on column public.mr_notatki_oferty.tresc is
  'Treść notatki, 1–2000 znaków (char_length, czyli punkty kodowe — ta sama miara co walidacja serwera). Pusta po obcięciu białych znaków jest odrzucana.';

-- Treść: niepusta po obcięciu białych znaków i co najwyżej 2000 znaków.
-- Ograniczenie zakładane idempotentnie (Postgres nie ma ADD CONSTRAINT IF NOT EXISTS).
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

-- Ścieżka odczytu: notatki jednej oferty od najnowszej. Ten sam indeks obsługuje
-- podzapytanie polityk RLS po `oferta_id` i kaskadę przy kasowaniu oferty.
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- Kaskada z auth.users po `autor_id` bez indeksu dawałaby seq scan.
create index if not exists mr_notatki_oferty_autor_id_idx
  on public.mr_notatki_oferty (autor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty dla anon,
-- authenticated i service_role. Odbieramy je i wydajemy tylko to, co potrzebne.
-- Świadomie BEZ UPDATE — notatka jest niemutowalna.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;
grant select, insert, delete on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Polityki osobno per operacja. `(select auth.uid())` zamiast `auth.uid()` —
-- planner liczy wartość raz na zapytanie, nie raz na wiersz. Własność oferty
-- sprawdzana podzapytaniem do `public.offers` (wiersz oferty jest i tak
-- widoczny dla właściciela przez `offers_select_own`).
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

-- Wstawić notatkę może tylko właściciel oferty i tylko pod własnym autor_id.
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

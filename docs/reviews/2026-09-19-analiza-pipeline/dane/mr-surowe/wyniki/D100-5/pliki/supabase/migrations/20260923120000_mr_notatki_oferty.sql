-- MR-89ab0f
-- Prywatne notatki handlowca do własnej opublikowanej oferty (IU-MR,
-- docs/active/mr-notatki-oferty).
--
-- Zasady, które ta migracja egzekwuje:
--   * Notatkę widzi WYŁĄCZNIE właściciel oferty — RLS jest jedyną linią obrony
--     (token MCP idzie prosto do PostgREST), więc każda polityka sprawdza
--     `offers.owner_id = (select auth.uid())`, nie samo `autor_id`.
--   * Notatka jest niemutowalna: brak grantu UPDATE i brak polityki UPDATE.
--     Poprawka treści = usunięcie + nowa notatka.
--   * `autor_id` przy INSERT musi być wołającym — nie da się podpisać notatki
--     cudzym identyfikatorem.
--   * Zero polityk dla roli `anon` — odbiorca oferty nigdy nie widzi notatek.
--   * Limit treści 1–2000 znaków (po odrzuceniu białych znaków na brzegach nie
--     może zostać pusty tekst) — ta sama granica, co w
--     `apps/server/src/offer/mr-notatki.ts`; baza jest drugą barierą.
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabela
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  -- Kaskada spójna z `offers.owner_id`: skasowanie konta nie może utknąć na
  -- notatce, a notatka bez autora nie ma właściciela, który mógłby ją czytać.
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatna notatka handlowca do jego oferty. Widoczna tylko dla właściciela oferty, niemutowalna (brak UPDATE).';
comment on column public.mr_notatki_oferty.autor_id is
  'Wołający w chwili zapisu. Polityka INSERT wymusza autor_id = auth.uid() — nigdy nie przepisuj go z danych wejściowych.';

-- Limit długości w znakach (char_length liczy znaki, nie bajty) i zakaz treści
-- złożonej wyłącznie z białych znaków (`\S`, nie `btrim` — ten bez drugiego
-- argumentu zdejmuje tylko spacje, więc przepuściłby notatkę z samych `\n`).
-- Ograniczenie zakładane idempotentnie (Postgres nie ma ADD CONSTRAINT
-- IF NOT EXISTS).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mr_notatki_oferty_tresc_length_check'
      and conrelid = 'public.mr_notatki_oferty'::regclass
  ) then
    alter table public.mr_notatki_oferty
      add constraint mr_notatki_oferty_tresc_length_check
      check (tresc ~ '\S' and char_length(tresc) <= 2000);
  end if;
end $$;

-- Ścieżka odczytu: notatki jednej oferty od najnowszej. Indeks obsługuje też
-- podzapytanie polityk RLS po `oferta_id` i kaskadę przy kasowaniu oferty.
create index if not exists mr_notatki_oferty_oferta_created_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Granty
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty dla anon,
-- authenticated i service_role. Odbieramy je i wydajemy tylko to, co potrzebne.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;
grant select, insert, delete on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- `(select auth.uid())` zamiast `auth.uid()` — planner liczy wartość raz na
-- zapytanie, nie raz na wiersz. Podzapytanie po `public.offers` wykonuje się
-- z uprawnieniami wołającego, więc dodatkowo przechodzi przez
-- `offers_select_own` — cudza oferta jest dla niego po prostu niewidoczna.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.mr_notatki_oferty enable row level security;

drop policy if exists mr_notatki_oferty_select_own on public.mr_notatki_oferty;
create policy mr_notatki_oferty_select_own
  on public.mr_notatki_oferty
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.offers o
      where o.id = mr_notatki_oferty.oferta_id
        and o.owner_id = (select auth.uid())
    )
  );

drop policy if exists mr_notatki_oferty_insert_own on public.mr_notatki_oferty;
create policy mr_notatki_oferty_insert_own
  on public.mr_notatki_oferty
  for insert
  to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1
      from public.offers o
      where o.id = mr_notatki_oferty.oferta_id
        and o.owner_id = (select auth.uid())
    )
  );

drop policy if exists mr_notatki_oferty_delete_own on public.mr_notatki_oferty;
create policy mr_notatki_oferty_delete_own
  on public.mr_notatki_oferty
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.offers o
      where o.id = mr_notatki_oferty.oferta_id
        and o.owner_id = (select auth.uid())
    )
  );

-- Świadomie BRAK polityki UPDATE: notatka jest niemutowalna. Brak grantu UPDATE
-- odbiera prawo na poziomie uprawnień, brak polityki — na poziomie wierszy.

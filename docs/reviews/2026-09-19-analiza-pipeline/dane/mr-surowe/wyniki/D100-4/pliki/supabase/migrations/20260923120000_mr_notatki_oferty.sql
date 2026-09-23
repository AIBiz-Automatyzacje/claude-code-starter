-- MR-6ac1e4
-- Notatki handlowca do opublikowanej oferty (IU-MR).
--
-- Prywatna notatka właściciela oferty („klient pytał o rabat"). Zasady:
--   * Notatkę widzi i kasuje WYŁĄCZNIE właściciel oferty (`offers.owner_id`).
--     Odbiorca oferty nie ma do niej żadnej ścieżki: zero polityk dla `anon`,
--     a serwowanie ofert idzie przez serwis Node, nie przez PostgREST.
--   * Notatka jest niemutowalna — brak grantu i polityki UPDATE. Poprawka to
--     nowa notatka (i ewentualnie skasowanie starej).
--   * `autor_id` przy INSERT musi być wołającym — nie da się podpisać notatki
--     cudzym identyfikatorem, nawet we własnej ofercie.
--   * Limit treści (1–2000 znaków) egzekwuje baza jako drugą barierę; pierwszą
--     jest `apps/server/src/offer/mr-notatki.ts`, która odmawia zdaniem po polsku.
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- mr_notatki_oferty
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  -- Kaskada także od autora: bez niej usunięcie konta w auth.users byłoby
  -- blokowane przez notatki (autor = właściciel oferty, więc i tak znikają
  -- razem z jego ofertami).
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatne notatki właściciela do opublikowanej oferty. Niemutowalne (brak UPDATE). Widoczne wyłącznie dla właściciela oferty.';
comment on column public.mr_notatki_oferty.autor_id is
  'Autor notatki — przy INSERT polityka wymusza (select auth.uid()). Nigdy nie przepisywany z danych wejściowych.';
comment on column public.mr_notatki_oferty.tresc is
  'Treść notatki po trim, 1–2000 znaków (mr_notatki_oferty_tresc_length_check).';

-- Limit długości i zakaz treści złożonej z samych białych znaków. Serwer
-- przycina treść przed zapisem, ale token MCP idzie prosto do PostgREST —
-- baza nie może zakładać, że wejście przeszło przez serwer.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mr_notatki_oferty_tresc_length_check'
      and conrelid = 'public.mr_notatki_oferty'::regclass
  ) then
    alter table public.mr_notatki_oferty
      add constraint mr_notatki_oferty_tresc_length_check
      check (char_length(tresc) between 1 and 2000 and char_length(btrim(tresc)) >= 1);
  end if;
end $$;

-- Ścieżka odczytu: notatki jednej oferty od najnowszej. Indeks obsługuje też
-- podzapytanie polityki (lookup po oferta_id) i kaskadę z public.offers.
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- Kaskada z auth.users filtruje po autor_id — bez indeksu seq scan.
create index if not exists mr_notatki_oferty_autor_id_idx
  on public.mr_notatki_oferty (autor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty. Odbieramy je
-- i wydajemy tylko SELECT/INSERT/DELETE — bez UPDATE, bo notatka jest
-- niemutowalna i bez grantu nie ma czego obchodzić polityką.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;
grant select, insert, delete on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.mr_notatki_oferty enable row level security;

-- Polityki osobno per operacja. `(select auth.uid())` zamiast `auth.uid()` —
-- planner liczy wartość raz na zapytanie, nie raz na wiersz. Własność oferty
-- sprawdzana podzapytaniem po `offers.id` (PK) + `offers.owner_id`.

drop policy if exists mr_notatki_oferty_select_own on public.mr_notatki_oferty;
create policy mr_notatki_oferty_select_own
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

-- INSERT: oferta musi należeć do wołającego ORAZ autor musi być wołającym.
drop policy if exists mr_notatki_oferty_insert_own on public.mr_notatki_oferty;
create policy mr_notatki_oferty_insert_own
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

drop policy if exists mr_notatki_oferty_delete_own on public.mr_notatki_oferty;
create policy mr_notatki_oferty_delete_own
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

-- Świadomie BRAK polityki UPDATE — notatka jest niemutowalna.

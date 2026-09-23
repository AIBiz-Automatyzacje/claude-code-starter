-- MR-cf02b8
-- Prywatne notatki handlowca do jego opublikowanej oferty (IU-MR).
--
-- Zasady, które ta migracja egzekwuje:
--   * Notatkę widzi, dodaje i usuwa WYŁĄCZNIE właściciel oferty
--     (`public.offers.owner_id = (select auth.uid())`). Odbiorca oferty nie ma
--     do niej żadnej ścieżki — zero polityk dla roli `anon`.
--   * Notatka jest niemutowalna: brak grantu i polityki UPDATE. Poprawka to
--     usunięcie i dodanie nowej notatki.
--   * Tożsamość autora nie pochodzi z danych klienta: WITH CHECK wymusza
--     `autor_id = (select auth.uid())`, więc nie da się podpisać notatki cudzym id.
--   * Limit treści (1–2000 znaków, niepusta po obcięciu białych znaków) jest
--     drugą barierą — pierwszą jest schemat Zod w
--     `apps/server/src/offer/mr-notatki.ts`, który potrafi nazwać problem po polsku.
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- mr_notatki_oferty
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  -- Kaskada z auth.users: usunięcie konta i tak kasuje jego oferty (a z nimi
  -- notatki), więc wiersz bez autora nie ma sensu i nie może blokować usunięcia.
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatne notatki handlowca do własnej oferty. Niemutowalne; widoczne tylko dla właściciela oferty. Nigdy nie trafiają do dokumentu serwowanego klientowi.';
comment on column public.mr_notatki_oferty.autor_id is
  'Autor notatki. Polityka INSERT wymusza równość z (select auth.uid()) — nie przepisuj tej wartości z danych wejściowych.';

-- Treść 1–2000 znaków, pusta po obcięciu białych znaków = odmowa. Ograniczenie
-- zakładane idempotentnie (Postgres nie ma ADD CONSTRAINT IF NOT EXISTS).
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
-- filtr `oferta_id` w politykach RLS.
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty dla anon i
-- authenticated. Odbieramy je i wydajemy tylko SELECT/INSERT/DELETE — bez
-- UPDATE, bo notatka jest niemutowalna.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;
grant select, insert, delete on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Polityki osobno per operacja. `(select auth.uid())` zamiast `auth.uid()` —
-- planner liczy wartość raz na zapytanie, nie raz na wiersz. Przynależność
-- oferty sprawdzana podzapytaniem do `public.offers` (klucz główny +
-- `offers_owner_id_idx`).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.mr_notatki_oferty enable row level security;

drop policy if exists mr_notatki_oferty_select_own on public.mr_notatki_oferty;
create policy mr_notatki_oferty_select_own
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

-- WITH CHECK pilnuje dwóch rzeczy naraz: oferta należy do wołającego ORAZ
-- notatka jest podpisana jego własnym id.
drop policy if exists mr_notatki_oferty_insert_own on public.mr_notatki_oferty;
create policy mr_notatki_oferty_insert_own
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

-- Brak polityki UPDATE — notatka jest niemutowalna (patrz granty wyżej).

drop policy if exists mr_notatki_oferty_delete_own on public.mr_notatki_oferty;
create policy mr_notatki_oferty_delete_own
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

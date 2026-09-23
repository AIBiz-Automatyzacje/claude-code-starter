-- MR-5e5d89
-- IU-MR: prywatne notatki handlowca do opublikowanej oferty.
--
-- Zasady, które ta migracja egzekwuje:
--   * Notatkę widzi wyłącznie właściciel oferty — RLS jest jedyną linią obrony,
--     bo token MCP idzie prosto do PostgREST.
--   * Notatka jest NIEMUTOWALNA: brak grantu UPDATE i brak polityki UPDATE.
--     Poprawka to usunięcie i nowy wpis.
--   * Autor notatki nie pochodzi z danych wejściowych: polityka INSERT wymaga
--     `autor_id = (select auth.uid())`, więc nie da się podpisać notatki cudzym
--     identyfikatorem ani dopisać jej do cudzej oferty.
--   * Zero polityk i grantów dla roli `anon` — odbiorca oferty nigdy nie widzi
--     notatek handlowca.
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- mr_notatki_oferty
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  -- Kaskada z auth.users: autor jest zawsze właścicielem oferty (polityka
  -- INSERT), a oferta i tak znika kaskadą z konta właściciela. Bez kaskady
  -- osierocony wiersz blokowałby usunięcie konta.
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatne notatki handlowca do jego opublikowanej oferty (np. „klient pytał o rabat”). Widoczne wyłącznie dla właściciela oferty. Niemutowalne — brak UPDATE; poprawka to usunięcie i nowy wpis.';
comment on column public.mr_notatki_oferty.autor_id is
  'Autor notatki. Przy INSERT musi równać się (select auth.uid()) — NIGDY nie przepisywany z danych wejściowych.';
comment on column public.mr_notatki_oferty.tresc is
  'Treść notatki: 1–2000 punktów kodowych, nie same białe znaki. Lustro walidacji Zod w apps/server/src/offer/mr-notatki.ts; przekroczenie jest odrzucane, nigdy przycinane.';

-- Treść 1–2000 znaków i nie z samych białych znaków. `char_length` liczy
-- punkty kodowe — tak samo jak walidacja Zod po stronie serwera.
-- `~ '[^[:space:]]'` odrzuca spacje, tabulatory i nowe linie (btrim bez
-- drugiego argumentu obciąłby wyłącznie spacje).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mr_notatki_oferty_tresc_check'
      and conrelid = 'public.mr_notatki_oferty'::regclass
  ) then
    alter table public.mr_notatki_oferty
      add constraint mr_notatki_oferty_tresc_check check (
        char_length(tresc) between 1 and 2000
        and tresc ~ '[^[:space:]]'
      );
  end if;
end $$;

-- Ścieżka odczytu: notatki oferty od najnowszej. Indeks pokrywa też filtr
-- polityk RLS (oferta_id na pierwszej pozycji).
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe i kolumnowe
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty dla anon,
-- authenticated i service_role. Odbieramy je i wydajemy tylko to, co potrzebne.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;

-- SELECT i DELETE w granicach własnych ofert (granice pilnuje RLS).
grant select, delete on table public.mr_notatki_oferty to authenticated;

-- INSERT kolumnowo: `id` i `created_at` nadaje baza — klient nie może ich
-- podrobić (np. antydatować notatki).
grant insert (oferta_id, autor_id, tresc) on table public.mr_notatki_oferty to authenticated;

-- Świadomie BRAK grantu UPDATE — notatka jest niemutowalna.

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Polityki osobno per operacja. `(select auth.uid())` zamiast `auth.uid()` —
-- planner liczy wartość raz na zapytanie, nie raz na wiersz.
-- Własność oferty sprawdza podzapytanie do public.offers z jawnym warunkiem na
-- `owner_id` — nie polegamy na tym, że RLS tabeli offers przypadkiem zawęża
-- widok do ofert wołającego.
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

-- Brak polityki UPDATE — w połączeniu z brakiem grantu każda próba edycji
-- kończy się jawną odmową uprawnień, nie cichym „0 wierszy”.

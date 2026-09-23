-- MR-b7373d
-- Notatki handlowca do opublikowanej oferty (IU-MR).
--
-- Prywatna notatka właściciela oferty („klient pytał o rabat"). Zasady:
--   * RLS jest JEDYNĄ linią obrony — token MCP idzie prosto do PostgREST, więc
--     polityki i granty są tu jedyną barierą, nie walidacja serwera.
--   * Notatkę widzi, dodaje i kasuje WYŁĄCZNIE właściciel oferty. Własność
--     czytana z `public.offers.owner_id`, nie z żadnego pola ładunku.
--   * Notatka jest niemutowalna: brak grantu i polityki UPDATE. Poprawka =
--     skasowanie i nowa notatka.
--   * Zero polityk dla `anon` i zero polityki administratora (tabela wisi na
--     `offers`, na której polityki admina nie ma i mieć nie może).
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- mr_notatki_oferty
-- ─────────────────────────────────────────────────────────────────────────────

-- `autor_id` z `on delete cascade` jak `offers.owner_id`: autor jest zawsze
-- właścicielem oferty (pilnuje polityka insert), więc skasowanie konta i tak
-- zabiera notatki kaskadą przez `offers` — tu tylko nie blokujemy tej ścieżki.
create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatne notatki handlowca do własnej oferty. Widoczne wyłącznie dla właściciela oferty; niemutowalne (brak UPDATE).';
comment on column public.mr_notatki_oferty.tresc is
  'Treść notatki: 1–2000 znaków liczonych jak char_length (punkty kodowe), co najmniej jeden znak niebiały.';

-- Sufit liczony `char_length` (punkty kodowe) — serwer liczy tę samą jednostką
-- (`mr-notatki.ts`), więc obie bramki odmawiają dokładnie tych samych wartości.
-- Drugi warunek zamyka notatkę z samych spacji wysłaną z pominięciem serwera.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mr_notatki_oferty_tresc_check'
      and conrelid = 'public.mr_notatki_oferty'::regclass
  ) then
    alter table public.mr_notatki_oferty
      add constraint mr_notatki_oferty_tresc_check
      check (char_length(tresc) between 1 and 2000 and tresc ~ '\S');
  end if;
end $$;

-- Ścieżka odczytu: notatki jednej oferty od najnowszej. Ten sam indeks obsługuje
-- kaskadę `on delete` z `offers` (wiodąca kolumna `oferta_id`).
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe i kolumnowe
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty dla anon
-- i authenticated. Odbieramy je i wydajemy tylko to, co potrzebne.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;

-- INSERT kolumnowo: `id` i `created_at` nadaje baza. Bez tego klient ustawiłby
-- `created_at` w ładunku i przestawił kolejność notatek.
grant select, delete on table public.mr_notatki_oferty to authenticated;
grant insert (oferta_id, autor_id, tresc) on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- `(select auth.uid())` zamiast `auth.uid()` — planner liczy wartość raz na
-- zapytanie. Podzapytanie do `offers` trafia w `offers_pkey` i samo podlega
-- polityce `offers_select_own`, a warunek `owner_id` jest powtórzony jawnie,
-- żeby bramka nie zależała od polityki innej tabeli.
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

-- Autor = wołający ORAZ oferta należy do wołającego: nie da się dopisać notatki
-- do cudzej oferty ani podpisać jej cudzym `autor_id`.
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

-- Brak polityki UPDATE z rozmysłu: notatka jest niemutowalna. Brak grantu UPDATE
-- (revoke all wyżej) jest pierwszą barierą, brak polityki — drugą.

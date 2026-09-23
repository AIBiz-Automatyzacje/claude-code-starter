-- MR-1a2010
-- Notatki handlowca do oferty (docs/active/mr-notatki-oferty, IU-MR).
--
-- Handlowiec zapisuje prywatne notatki do własnej opublikowanej oferty („klient
-- pytał o rabat"). Notatka jest widoczna WYŁĄCZNIE dla właściciela oferty —
-- nigdy dla odbiorcy (serwowanie `/o/<slug>` nie czyta tej tabeli) i nigdy dla
-- innego konta.
--
-- Zasady, które ta migracja egzekwuje:
--   * RLS jest JEDYNĄ linią obrony — token MCP idzie prosto do PostgREST, więc
--     własność sprawdzają polityki, a kształt treści CHECK w bazie.
--   * Notatka jest NIEMUTOWALNA: brak grantu i polityki UPDATE. Poprawka treści
--     = skasowanie i nowa notatka.
--   * `id` i `created_at` nadaje baza. Grant INSERT jest KOLUMNOWY
--     (`oferta_id`, `autor_id`, `tresc`), więc klient nie podrobi znacznika
--     czasu jednym polem ładunku `POST /rest/v1/mr_notatki_oferty`
--     (`.claude/rules/learned-patterns.md`, wpis z 2026-09-13).
--   * Zero polityk dla `anon` i zero polityki admina — tak jak na `offers`.
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabela
-- ─────────────────────────────────────────────────────────────────────────────

-- `char_length` liczy PUNKTY KODOWE — tę samą miarę co `countCodePoints`
-- w `apps/server/src/offer/mr-notatki.ts`, więc emoji nie rozjeżdża obu bramek.
-- `~ '[^[:space:]]'` odrzuca treść z samych białych znaków (spacje, tabulatory,
-- nowe linie) — `btrim` bez drugiego argumentu obciąłby wyłącznie spacje.
create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  autor_id uuid not null references auth.users (id),
  tresc text not null,
  created_at timestamptz not null default now(),
  constraint mr_notatki_oferty_tresc_shape_check check (
    char_length(tresc) between 1 and 2000
    and tresc ~ '[^[:space:]]'
  )
);

comment on table public.mr_notatki_oferty is
  'Prywatne notatki handlowca do własnej oferty. Widzi je wyłącznie właściciel oferty (RLS). Niemutowalne — brak UPDATE; poprawka = delete + insert.';

comment on column public.mr_notatki_oferty.autor_id is
  'Autor notatki. Polityka INSERT wymusza autor_id = auth.uid() — tożsamości nie bierze się z ładunku klienta.';

comment on column public.mr_notatki_oferty.created_at is
  'Znacznik zapisu nadawany przez bazę. Poza grantem INSERT, więc klient go nie ustawi.';

-- Ścieżka odczytu: notatki jednej oferty od najnowszej.
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe i kolumnowe
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty dla anon,
-- authenticated i service_role. Odbieramy je i wydajemy tylko to, co potrzebne.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;

grant select, delete on table public.mr_notatki_oferty to authenticated;
grant insert (oferta_id, autor_id, tresc) on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Polityki osobno per operacja. `(select auth.uid())` zamiast `auth.uid()` —
-- planner liczy wartość raz na zapytanie, nie raz na wiersz. Własność
-- rozstrzyga `offers.owner_id`, nie `autor_id`: notatka należy do oferty.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.mr_notatki_oferty enable row level security;

drop policy if exists mr_notatki_oferty_select_offer_owner on public.mr_notatki_oferty;
create policy mr_notatki_oferty_select_offer_owner
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

-- Dwa warunki naraz: oferta należy do wołającego ORAZ wołający podpisuje się
-- sobą. Bez drugiego członu właściciel mógłby wstawić notatkę „od" innego konta.
drop policy if exists mr_notatki_oferty_insert_offer_owner on public.mr_notatki_oferty;
create policy mr_notatki_oferty_insert_offer_owner
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

drop policy if exists mr_notatki_oferty_delete_offer_owner on public.mr_notatki_oferty;
create policy mr_notatki_oferty_delete_offer_owner
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

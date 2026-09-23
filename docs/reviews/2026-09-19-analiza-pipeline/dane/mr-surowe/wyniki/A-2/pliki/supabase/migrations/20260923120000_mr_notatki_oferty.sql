-- MR-fcac0f
-- Notatki handlowca do własnej oferty (IU-MR, docs/active/mr-notatki-oferty).
--
-- Zasady, które ta migracja egzekwuje:
--   * RLS jest JEDYNĄ linią obrony — tokeny MCP z Supabase nie mają scope'ów,
--     więc notatkę widzi, dodaje i kasuje wyłącznie właściciel oferty.
--   * Notatka jest niemutowalna: brak polityki i grantu UPDATE.
--   * Zero polityk dla roli `anon`.
--   * `id` i `created_at` nadaje baza — grant INSERT jest kolumnowy, więc klient
--     nie poda w ładunku `created_at` (cofnięta data przestawiłaby kolejność
--     listy, po której leci indeks) ani własnego `id`.
--   * Sufit treści liczony w punktach kodowych (`char_length`) — tej samej
--     jednostce co bramka Zod w `apps/server/src/offer/mr-notatki.ts`.
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatna notatka handlowca do jego oferty. Niemutowalna — brak UPDATE; widoczna wyłącznie dla właściciela oferty.';
comment on column public.mr_notatki_oferty.tresc is
  'Treść po trim, 1–2000 punktów kodowych. Ten sam sufit co MR_NOTATKA_MAX_ZNAKOW w apps/server/src/offer/mr-notatki.ts.';

-- Treść: 1–2000 znaków i nie same białe znaki. `~ '\S'` zamiast
-- `btrim(tresc) <> ''`, bo `btrim` bez argumentu zdejmuje wyłącznie spacje,
-- a serwer tnie każdy biały znak (`String.prototype.trim`).
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

-- Ścieżka odczytu: notatki jednej oferty od najnowszej. Indeks obsługuje też
-- podzapytanie polityk RLS po `oferta_id`.
create index if not exists mr_notatki_oferty_oferta_created_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe i kolumnowe
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;

grant select, delete on table public.mr_notatki_oferty to authenticated;
grant insert (oferta_id, autor_id, tresc) on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Właściciela rozstrzyga `public.offers.owner_id` — to on jest źródłem prawdy,
-- nie `autor_id` notatki. Podzapytanie na `offers` samo podlega RLS
-- (`offers_select_own`), więc cudza oferta i tak jest niewidoczna; warunek na
-- `owner_id` stoi jawnie, żeby polityka nie zależała od polityki innej tabeli.
-- `(select auth.uid())` — planner liczy wartość raz na zapytanie.
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
-- MR-R-9abba9

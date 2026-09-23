-- MR-ec90f7
-- Notatki handlowca do opublikowanej oferty (IU-MR, docs/active/mr-notatki-oferty).
--
-- Zasady, które ta migracja egzekwuje:
--   * Notatkę widzi, dodaje i kasuje WYŁĄCZNIE właściciel oferty. RLS jest
--     jedyną linią obrony — token MCP idzie prosto do PostgREST bez scope'ów.
--   * Notatka jest niemutowalna: brak grantu UPDATE i brak polityki UPDATE.
--     Poprawka treści = skasuj i dodaj nową.
--   * Zero polityk dla roli `anon` i zero polityki administratora — notatka jest
--     prywatna jak sama oferta (CLAUDE.md: na `offers` nie ma polityki admina).
--   * `created_at` stempluje baza: grant INSERT jest kolumnowy i nie obejmuje
--     `id` ani `created_at`, więc klient nie poda własnej chwili zapisu
--     (lekcja z 2026-09-13 o kolumnie czasu podawanej w ładunku).
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- mr_notatki_oferty
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  -- `on delete cascade` także tutaj: autorem jest zawsze właściciel oferty,
  -- a ścieżka usuwania konta nie może się zatrzymać na jego własnych notatkach.
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatna notatka handlowca do własnej oferty. Niemutowalna (brak UPDATE); widoczna wyłącznie dla właściciela oferty.';
comment on column public.mr_notatki_oferty.tresc is
  'Treść notatki, 1–2000 znaków (char_length = punkty kodowe). Serwer liczy ten sam sufit w tej samej jednostce — patrz apps/server/src/offer/mr-notatki.ts.';

-- Sufit długości w bazie: token MCP omija serwer Node, więc CHECK jest drugą
-- barierą obok schematu Zod. `char_length` liczy punkty kodowe; schemat
-- serwera liczy DOKŁADNIE tak samo (nie jednostkami UTF-16), żeby obie bramki
-- nie rozjechały się poza BMP.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mr_notatki_oferty_tresc_length_check'
      and conrelid = 'public.mr_notatki_oferty'::regclass
  ) then
    alter table public.mr_notatki_oferty
      add constraint mr_notatki_oferty_tresc_length_check
      check (char_length(tresc) between 1 and 2000);
  end if;
end $$;

-- Ścieżka odczytu „notatki oferty od najnowszej" i jednocześnie indeks pod
-- polityki RLS (filtr po `oferta_id`) oraz kaskadę z `offers`.
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe i kolumnowe
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty dla anon,
-- authenticated i service_role. Odbieramy je i wydajemy tylko to, co potrzebne.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;

-- SELECT i DELETE na wiersz (granice pilnuje RLS). INSERT kolumnowo: `id`
-- i `created_at` nadaje wyłącznie baza. UPDATE nie istnieje — notatka jest
-- niemutowalna, a grant bez polityki byłby furtką czekającą na pierwszą
-- przypadkową politykę.
grant select, delete on table public.mr_notatki_oferty to authenticated;
grant insert (oferta_id, autor_id, tresc) on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Własność notatki wynika z własności OFERTY (`offers.owner_id`), nie z samego
-- `autor_id`: dzięki temu notatka nie przeżyje w cudzym widoku, a INSERT do
-- cudzej oferty jest odrzucany nawet z poprawnym `autor_id`.
-- `(select auth.uid())` zamiast `auth.uid()` — planner liczy wartość raz.
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

-- Dwa warunki naraz: oferta należy do wołającego ORAZ wołający podpisuje
-- notatkę sobą. Bez drugiego właściciel mógłby wpisać cudze `autor_id`.
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

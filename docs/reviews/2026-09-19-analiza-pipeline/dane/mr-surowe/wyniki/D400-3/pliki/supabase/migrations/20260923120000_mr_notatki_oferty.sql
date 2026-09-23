-- MR-3b86f8
-- Notatki handlowca do opublikowanej oferty (IU-MR, docs/active/mr-notatki-oferty).
--
-- Zasady, które ta migracja egzekwuje:
--   * RLS jest JEDYNĄ linią obrony — token MCP idzie prosto do PostgREST, więc
--     granice „czyja oferta" i „kto jest autorem" pilnuje baza, nie serwer.
--   * Notatkę widzi wyłącznie właściciel oferty. Odbiorca oferty (anon) nie ma
--     tu żadnej ścieżki — zero grantów i zero polityk dla roli `anon`.
--   * Notatka jest niemutowalna: brak grantu UPDATE i brak polityki UPDATE.
--     Poprawka = usunięcie i nowa notatka.
--   * Brak polityki administratora — tak jak na `offers` (CLAUDE.md).
--
-- Migracja jest idempotentna (IF NOT EXISTS / DROP … IF EXISTS przed CREATE).

-- ─────────────────────────────────────────────────────────────────────────────
-- mr_notatki_oferty
-- ─────────────────────────────────────────────────────────────────────────────

-- `autor_id … on delete cascade`: autorem jest zawsze właściciel oferty
-- (polityka INSERT), a `offers.owner_id` kasuje się kaskadą z `auth.users`.
-- Bez kaskady na `autor_id` wiersz wstawiony z pominięciem RLS (service_role)
-- z autorem innym niż właściciel blokowałby usunięcie konta tego autora.
create table if not exists public.mr_notatki_oferty (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.offers (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  tresc text not null,
  created_at timestamptz not null default now()
);

comment on table public.mr_notatki_oferty is
  'Prywatne notatki handlowca do własnej oferty. Widzi je wyłącznie właściciel oferty; notatka jest niemutowalna (brak UPDATE).';
comment on column public.mr_notatki_oferty.tresc is
  'Treść notatki: 1–2000 znaków (char_length = punkty kodowe), nie same białe znaki. Serwer przycina ją przed zapisem; CHECK jest drugą barierą dla zapisu z pominięciem serwera.';

-- Limit liczony `char_length` (punkty kodowe). Walidacja serwera liczy TĘ SAMĄ
-- jednostkę (`[...tresc].length`), żeby obie bramki odmawiały tego samego —
-- `z.string().max` liczy jednostki UTF-16 i rozjeżdża się poza BMP.
-- Drugi warunek odrzuca treść złożoną z samych białych znaków: serwer przycina
-- wejście, ale zapis prosto przez PostgREST przycięcia nie przechodzi.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mr_notatki_oferty_tresc_check'
      and conrelid = 'public.mr_notatki_oferty'::regclass
  ) then
    alter table public.mr_notatki_oferty
      add constraint mr_notatki_oferty_tresc_check
      check (char_length(tresc) between 1 and 2000 and tresc ~ '[^[:space:]]');
  end if;
end $$;

-- Ścieżka odczytu: notatki jednej oferty od najnowszej. Ten sam indeks obsługuje
-- kolumnę `oferta_id` w polityce RLS i kaskadę `on delete` z `offers`.
create index if not exists mr_notatki_oferty_oferta_id_created_at_idx
  on public.mr_notatki_oferty (oferta_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Uprawnienia tabelowe i kolumnowe
--
-- Supabase nadaje nowym tabelom w `public` domyślne granty dla anon,
-- authenticated i service_role. Odbieramy je i wydajemy tylko to, co potrzebne.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on table public.mr_notatki_oferty from anon, authenticated;

-- INSERT kolumnowo: `id` i `created_at` nadaje baza. Tabelowy grant INSERT
-- pozwoliłby klientowi podać własny `created_at` jednym polem ładunku
-- `POST /rest/v1/…` i przestawić kolejność notatek.
grant select, delete on table public.mr_notatki_oferty to authenticated;
grant insert (oferta_id, autor_id, tresc) on table public.mr_notatki_oferty to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Polityki osobno per operacja. `(select auth.uid())` zamiast `auth.uid()` —
-- planner liczy wartość raz na zapytanie, nie raz na wiersz. Własność oferty
-- czytana z `public.offers` przez `exists` — podzapytanie podlega polityce
-- `offers_select_own`, więc cudza oferta jest w nim po prostu niewidoczna.
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

-- Autor musi być wołającym (blokada podpisania notatki cudzym `autor_id`),
-- a oferta — jego własna (blokada dopisania notatki do cudzej oferty).
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

-- Świadomie BRAK polityki UPDATE i grantu UPDATE — notatka jest niemutowalna.

# Supabase CLI Guide

Przewodnik po Supabase CLI (v2.78+) — lokalne środowisko, migracje, Edge Functions, diagnostyka.

---

## Instalacja

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# npm (jako dev dependency)
npm install supabase --save-dev

# Aktualizacja
brew upgrade supabase
```

---

## Inicjalizacja Projektu

```bash
supabase init                           # Tworzy supabase/config.toml
supabase login                          # Uwierzytelnienie (otwiera przeglądarkę)
supabase link --project-ref <ref>       # Połącz z projektem remote
```

### CI/CD (bez interakcji)
```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
supabase link --project-ref <ref>
```

---

## Lokalne Środowisko

```bash
supabase start                          # Uruchom cały stack (Docker ~7GB RAM)
supabase start -x imgproxy,vector       # Wyklucz niepotrzebne serwisy
supabase status                         # Pokaż URL-e i klucze API
supabase stop                           # Zatrzymaj (zachowaj dane)
supabase stop --no-backup               # Zatrzymaj i usuń dane
```

---

## Baza Danych

> **CLI 3 (od 2026-11-02) — cel komendy.** `db push`, `db pull`, `db dump`, `migration list|fetch|repair`, `inspect db *`
> i `gen types` bez flagi celu działają na **lokalnym** stacku. Na podlinkowany projekt: `--linked` (działa w v2 i v3;
> w v3 z ostrzeżeniem, zamiennik `--remote`), na konkretną bazę: `--db-url "<url>"` (v3: `--remote=<url>`). Każda zmiana
> hostowanej bazy bez terminala (agent, CI) wymaga `--yes` — agent dostaje błąd `HostedMutationConsentRequiredError`
> i pyta operatora, zanim doda `--yes` na dev/prod. Przewodnik: https://supabase.com/docs/guides/local-development/cli/migrating-to-v3

### Migracje
```bash
supabase migration new <nazwa>          # Utwórz pusty plik migracji
supabase migration list --linked        # Historia: lokalne pliki vs podlinkowany projekt
supabase migration up                   # Aplikuj oczekujące migracje
supabase migration down --last 1        # Cofnij ostatnią migrację
supabase migration squash               # Scal wiele migracji w jedną
supabase migration repair <ver> --status applied  # Napraw historię
```

### Schema Diff (automatyczne migracje)
```bash
supabase db diff                        # Pokaż zmiany vs ostatnia migracja
supabase db diff -f nowa_zmiana         # Zapisz diff jako nową migrację
supabase db diff --linked               # Porównaj z remote
```

### Push / Pull / Reset
```bash
supabase db push --linked               # Wypchnij migracje na podlinkowany projekt (operator potwierdza)
supabase db push --linked --dry-run     # Podgląd bez aplikowania
supabase db push --linked --include-roles  # Uwzględnij role
supabase db pull --linked               # Pobierz schemat z podlinkowanego projektu
supabase db reset                       # Odtwórz lokalną bazę od zera
supabase db reset --no-seed             # Bez danych seed
```

### Dump i Lint
```bash
supabase db dump -f schema.sql          # Eksport schematu (pg_dump)
supabase db dump --data-only -f data.sql # Eksport tylko danych
supabase db lint                        # Walidacja PL/pgSQL (plpgsql_check)
supabase db lint --fail-on error        # Fail w CI przy błędach
```

---

## Generowanie Typów

```bash
# Z lokalnej bazy (po supabase start)
supabase gen types typescript --local > src/types/database.types.ts

# Z remote (po supabase link)
supabase gen types typescript --linked > src/types/database.types.ts

# Konkretne schematy
supabase gen types typescript --local --schema public,auth > src/types/database.types.ts
```

**Workflow:** Po każdej migracji → `supabase gen types` → commit typów.

---

## Edge Functions

```bash
supabase functions new <nazwa>          # Scaffold nowej funkcji
supabase functions serve                # Uruchom lokalnie
supabase functions serve --inspect      # Z debuggerem V8
supabase functions serve --env-file .env.local  # Z plikiem env
supabase functions serve --no-verify-jwt # Bez weryfikacji JWT (dev)

supabase functions deploy <nazwa>       # Deploy jednej funkcji
supabase functions deploy               # Deploy wszystkich
supabase functions deploy --prune       # Usuń remote functions nieobecne lokalnie
supabase functions download             # Pobierz kod z remote (bez Docker)
supabase functions list                 # Lista deployowanych
supabase functions delete <nazwa>       # Usuń z remote
```

---

## Sekrety

```bash
supabase secrets set KEY=value          # Ustaw sekret
supabase secrets set --env-file .env.prod  # Batch z pliku
supabase secrets list                   # Lista sekretów
supabase secrets unset KEY              # Usuń sekret
```

---

## Diagnostyka Bazy (`inspect db`)

```bash
supabase inspect db long-running-queries  # Zapytania > 5 min
supabase inspect db outliers              # Najwolniejsze zapytania (łącznie)
supabase inspect db calls                 # Najczęściej wywoływane
supabase inspect db blocking              # Zapytania blokujące inne
supabase inspect db locks                 # Aktywne locki
supabase inspect db bloat                 # Rozdęcie tabel (MVCC)
supabase inspect db index-stats           # Wydajność indeksów
supabase inspect db table-stats           # Metryki tabel
supabase inspect db vacuum-stats          # Aktywność vacuum
supabase inspect db replication-slots     # Sloty replikacji
supabase inspect report --output-dir ./reports  # CSV raport wszystkiego
```

Wszystkie obsługują: `--linked` (remote), `--local`, `--db-url <url>`.

---

## Testowanie (pgTAP)

```bash
supabase test new <nazwa>               # Utwórz plik testowy
supabase test db                         # Uruchom testy pgTAP
supabase test db --linked                # Testy na remote
```

---

## Storage

Wymagają `--experimental`.

```bash
supabase storage ls ss:///bucket-name     # Listuj obiekty
supabase storage cp local.png ss:///bucket/file.png  # Upload
supabase storage cp ss:///bucket/file.png ./local.png  # Download
supabase storage rm ss:///bucket/file.png  # Usuń
```

---

## Preview Branches

```bash
supabase branches create <nazwa>        # Utwórz preview branch
supabase branches create <nazwa> --persistent  # Trwały branch
supabase branches list                  # Lista branches
supabase branches delete <nazwa>        # Usuń branch
```

---

## Konfiguracja `config.toml`

Kluczowe sekcje:

```toml
project_id = "my-project"

[db]
major_version = 15   # musi zgadzać się z bazą zdalną: SHOW server_version; (przykład)

[auth]
site_url = "http://localhost:3000"
enable_signup = true

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"    # Referencja do zmiennej środowiskowej
secret = "env(GOOGLE_SECRET)"

[edge_runtime]
policy = "oneshot"

# Konfiguracja per środowisko
[remotes.staging]
project_id = "staging-ref"

[remotes.staging.auth]
site_url = "https://staging.myapp.com"
```

Zmiany w `config.toml` wymagają `supabase stop && supabase start`.

---

## Workflow: Local → Production

### 1. Setup
```bash
supabase init && supabase start
supabase link --project-ref <prod-ref>
```

### 2. Development
```bash
# Edytuj schemat w Studio (localhost:54323) lub ręcznie
supabase db diff -f add_new_feature      # Auto-migration z diffa
supabase db reset                        # Weryfikacja od zera
supabase gen types typescript --local > src/types/database.types.ts
```

### 3. Deploy
```bash
supabase db push --linked --dry-run      # Podgląd
supabase db push --linked                # Aplikuj migracje (operator potwierdza; bez terminala: --yes)
supabase functions deploy                # Deploy Edge Functions
supabase secrets set --env-file .env.prod  # Sekrety
```

### 4. Monitoring
```bash
supabase inspect db outliers --linked    # Wolne zapytania
supabase inspect db bloat --linked       # Rozdęcie
```

---

## Flagi Globalne

| Flaga | Opis |
|-------|------|
| `--debug` | Logi debugowania na stderr |
| `-o, --output <format>` | Format: `pretty`, `json`, `yaml`, `toml`, `env` |
| `--experimental` | Włącz funkcje eksperymentalne |
| `--workdir <path>` | Ścieżka do katalogu projektu |

---

## Zobacz Także

- [edge-functions.md](edge-functions.md) — Wzorce kodu Edge Functions
- [database-patterns.md](database-patterns.md) — Wzorce tabel i RLS
- [security.md](security.md) — Bezpieczeństwo i audit logging

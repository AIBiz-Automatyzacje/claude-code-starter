# Pakiet po dashboardzie (2026-11-02) — co zrobione i co zostało

Sesja przeglądu przebiegów autopilota i `/dev-pr` na akademia-automatyzacji-dashboard (zadanie
`ciecie-zbednych-funkcji`, PR #104–#107) i vibersi (27.10–02.11), potem porządki w claude-cron, dashboardzie
i piszemy_wirale. Notatka dla następnej sesji: stan na koniec dnia.

## Wdrożone w szablonie (origin/main `04ec043`)

| Commit | Zmiana | Skąd |
|---|---|---|
| `f9c7f9d` | telemetria: skan czyta sesje główne po jednej (pełny skan i `raport.mjs` padały na stercie 4 GB; 8995 rekordów identycznych, RSS 2,4 → 0,95 GB) | `zbierz.mjs --skan` OOM |
| `d70ed5b` | `/dev-pr`: compound i krok CLAUDE.md czekają na CI czubka głównej przed pushem (`ciGlownej` w raporcie); wątki potwierdzone przez bota rozwiązywane mutacją; `konfliktyZTur` przy konflikcie części N>1; claude-md bez pliku decyzji przy zmergowanym PR = pominięty; kategorie STOP `konflikt-rebase`, `claude-md` | PR #104 (compound anulował deploy, zbędna tura 2), część 2 (konflikt `handlers.ts`), vibersi poczta |
| `2f3ce2a` … `f28d829` | kontrola higieny projektu (`scripts/doctor/higiena.mjs`): stara baza wiedzy, kontekst startowy agenta (próg 20k zn), pliki `.claude` spoza manifestu, hooki wskazujące usunięte pliki, `.backups`/CLAUDE.md claude-mem poza `.gitignore`, bajty sterujące w wiedzy, `.coderabbit.yaml`; w doctorze, linie `HIGIENA:` przy każdym `/sync-template`, pozycja `higiena` w bramce `/dev-plan` | claude-cron, dashboard, piszemy_wirale |
| `ab16ce4` | `wiedza.mjs sprawdz` odrzuca bajty sterujące; `konwersja zastosuj` zwraca `odwolania` do starego pliku reguł | claude-cron (NUL niewidoczny dla ripgrep, `.coderabbit.yaml`) |
| `04ec043` | `sync-template.sh` w bloku `{ …; exit; }` — sync podmieniający własny skrypt nie kończy się błędem składni (kod wyjścia był 0) | dashboard PR #109 |

Niezweryfikowane w realnym runie: czekanie na CI w `/dev-pr` (pierwszy prawdziwy merge pokaże). Przejście projektów na
`04ec043` może raz dać błąd składni w `sync-template.sh` (stara kopia skryptu) — ponowne uruchomienie naprawia.

## Stan projektów

- **dashboard** — `ciecie-zbednych-funkcji` domknięte (3 części, prod na nowej wersji). Konwersja wiedzy, CLAUDE.md
  62k → 11,5k zn, pozostałości starego zestawu usunięte (PR #108), szablon `f28d829` (PR #109), doctor 7/7 OK.
  CI: smoke czeka na `build_sha`, `paths-ignore: docs/**` (PR #105). **Otwarte:** wątek bota w PR #108 (`CLAUDE.md:91`) —
  reguła „batch importer = INSERT OR IGNORE” nieaktualna, importery używają `ON CONFLICT … DO UPDATE`. Kroki operatora
  z części 3: zmienne w Coolify, unieważnienie kluczy, kopia `*.pre-removed-features-*.bak` z PII poza serwer.
- **claude-cron** — konwersja wiedzy, CLAUDE.md 47k → 7k zn, bajty NUL/0x1f poprawione, doctor 7/7 OK. **Otwarte:**
  commit synchronizacji `172f8fc` (szablon `f28d829`) niewypchnięty.
- **vibersi** — MVP i poprawki przed startem zmergowane. Przed startem: teksty prawnika (regulamin, polityka),
  sprawdzenie migracji #21/#22 na prod i wersji prod, dzień startu wg `docs/operator/etap-6b-start-przygotowanie.md`.
- **piszemy_wirale** — szablon wprowadzony (`chore/szablon-claude` zmergowane lokalnie na main), praca idzie na
  `feature/t0-zabezpieczenie-produkcji` (F0 z planu refaktoryzacji). Zanim przy pierwszym PR: `/coderabbit-setup`.

## Pomysły nie wdrożone

- `/dev-pr` dla PR bez zadania (porządki, chore): czekanie na bota, wątki, bramka merge'a, bez compoundu — dziś
  takie PR-y idą ręcznymi instrukcjami, a „zielone CI” bywało brane za „bot skończył” (PR #108).
- Instrukcja odchudzania CLAUDE.md jako skill: każdą regułę o kodzie sprawdzać grepem, nie tylko fakty o wyciętych funkcjach.
- CI dashboardu: `deploy-trigger` nie zależy od `trivy-scan` (deploy kończy się przed skanem „CRITICAL gate”).
- Vibersi: `build_sha` w `/healthz` (dziś wersji prod nie da się sprawdzić z zewnątrz).

# Środowisko E2E dla dev-autopilot (one-time setup Operatora)

Po tym setupie autopilot **autonomicznie wykonuje testy E2E w przeglądarce** (agent-browser):
stawia dev server Vite na dedykowanej bazie e2e, synchronizuje migracje+seedy per faza, a fail
scenariusza wchodzi w pętlę fix jako finding P2 typ E2E.

**Bramka opt-in:**
- **Brak `.env.e2e`** → projekt nie chce E2E → flow klasyfikowane jako OPERATOR, run leci dalej (status quo).
- **`.env.e2e` istnieje, ale środowisko niegotowe** (np. złe klucze, zajęty port 5173) → autopilot
  **TWARDO zatrzymuje run w bootstrapie** z gotową komendą naprawczą. Powód: gdy projekt opt-in'ował
  się w E2E, ciche pominięcie = E2E znika z runu bez śladu. Świadomy run headless: usuń/zmień nazwę `.env.e2e`.

## Architektura

```
Bootstrap:    env-up    — .env.e2e? gitignore? dev server Vite (detached, --mode e2e ładuje .env.e2e).
                          .env.e2e jest, a env niegotowe = HARD STOP (gate opt-in);
                          brak .env.e2e = pominieto, run leci dalej.
Per faza:     db-sync   — supabase db push na bazę e2e (PIERWSZY realny apply SQL migracji
                          w pipeline!) + seedy e2e/seeds/*-seed.sql + konto testowe.
Review/fix:   tester E2E i fix odpalają agent-browser na localhost:5173 (gotowe środowisko).
Zakończenie:  env-down  — ubija TYLKO dev server z naszego .pid; STOP zostawia środowisko
                          do ręcznego debugowania.
```

## Szybki start — gotowy prompt dla asystenta

Zamiast wykonywać kroki ręcznie, wklej asystentowi w sesji projektu (zastąp `<projekt>`):

```markdown
Zrób one-time setup środowiska E2E wg .claude/templates/e2e-env/README.md:

1. Utwórz dedykowany projekt Supabase "<projekt>-e2e" (przez Supabase MCP
   jeśli dostępny, inaczej daj mi link i poprowadź przez dashboard — free tier).
   To MUSI być NOWY projekt — nigdy ref istniejącej bazy dev/prod.
2. Zbierz: URL, anon key, service_role key, connection string (session pooler, IPv4).
3. Utwórz `.env.e2e` w korzeniu repo wg .claude/templates/e2e-env/.env.e2e.example,
   wygeneruj silne hasło dla konta testowego (e2e@<projekt>.test).
4. Dopisz `.env.e2e` do .gitignore i ZWERYFIKUJ: `git check-ignore .env.e2e`.
5. Sprawdź, że `<pm> run dev -- --mode e2e --port 5173` startuje i celuje w bazę e2e
   (otwórz localhost:5173, zaloguj kontem testowym).
6. Na koniec smoke: curl do URL projektu e2e + `supabase db push --db-url ...`
   na pustą bazę (zaaplikuje WSZYSTKIE migracje od zera — to też test, czy
   łańcuch migracji jest kompletny!) i pokaż mi raport co działa, a co wymaga
   mojej ręki.

Sekretów nie loguj i nie commituj. Po wszystkim NIE odpalaj autopilota — czekaj na mnie.
```

Krok 1 może wymagać ręcznego kliknięcia w dashboardzie (uprawnienia tokena MCP);
resztę asystent zrobi sam. Pierwszy run autopilota z `.env.e2e` traktuj jako test
bojowy tej fazy.

## Kroki (raz na maszynę/projekt)

1. **Utwórz dedykowany projekt Supabase** (np. `<projekt>-e2e`). Nigdy nie podawaj tu
   refów dev/prod — env-up ma guard tożsamości (URL e2e ≠ URL z `.env`), ale nie kuś losu.
2. **Skopiuj config**: `cp .claude/templates/e2e-env/.env.e2e.example .env.e2e` i uzupełnij
   (API keys, connection string session pooler, konto testowe email+hasło).
3. **Gitignore**: dopisz `.env.e2e` do `.gitignore` (env-up odmówi startu bez tego).
4. **Tryb e2e w Vite**: dev server musi ładować `.env.e2e`. Vite robi to natywnie flagą
   `--mode e2e` (`<pm> run dev -- --mode e2e --port 5173`). Upewnij się, że skrypt `dev`
   w package.json przepuszcza dodatkowe flagi (domyślnie `vite` je przepuszcza).
5. **agent-browser**: testy E2E napędza skill `agent-browser` (CLI) — nic do instalacji poza nim.
6. Gotowe — następny run autopilota wykryje `.env.e2e` i przejdzie w tryb zarządzany.

## Konwencje dla planów zadań

- Scenariusz E2E w przeglądarce opisz w checkboxie `Weryfikacja:` zadania (oznaczenie 🌐):
  URL, kroki (click/type/expect visible), oczekiwany rezultat. agent-browser wykonuje go z opisu.
- Seedy: `e2e/seeds/<nazwa-flow>-seed.sql` — db-sync wiąże seed z flow po nazwie. Pisz seedy **idempotentnie**.
- Logowanie w flow wyłącznie kontem `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (OAuth providera
  jest nietestowalny headless — popup poza kontrolą przeglądarki automatycznej).

## Pułapki

- **Dev server „zastany"**: jeśli masz już ręcznie odpalone `bun run dev` (env dev!), autopilot go
  użyje i ostrzeże w logu — flow mogą gadać z bazą dev. Ubij własny dev server przed runem
  (albo trzymaj go na innym porcie niż 5173).
- **Reset danych**: db-sync nie robi `db reset` — czyszczenie zostawione seedom
  (idempotencja). Gdy baza e2e „zgnije", zresetuj ręcznie: `supabase db reset --db-url ...`.
- **Connection string „direct" jest IPv6-only** — w sieci bez IPv6 psql/db push wiszą na
  timeout. Używaj session poolera (IPv4, port 5432, wspiera migracje) — wzór w `.env.e2e.example`.
- **Stary Supabase CLI potrafi mieć zepsute tworzenie projektu** (np. 2.67.1 — wybór regionu);
  przy dziwnych błędach najpierw `brew upgrade supabase`.
- **Seedy muszą wstawiać WSZYSTKO, czego flow potrzebuje** — świeża baza e2e nie ma danych
  „oczywistych" z dev (np. słownikowych wstawianych kiedyś ręcznie). Migracje ≠ dane.

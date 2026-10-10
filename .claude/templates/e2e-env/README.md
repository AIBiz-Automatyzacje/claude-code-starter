# Środowisko E2E dla dev-autopilot (one-time setup Operatora)

Po tym setupie autopilot **autonomicznie wykonuje testy E2E w przeglądarce** (agent-browser):
uruchamia serwer aplikacji według `.env.e2e`, synchronizuje migracje i seedy bazy e2e per faza, a fail
scenariusza wchodzi w pętlę fix jako finding P2 typ E2E. Cały przepis uruchomienia siedzi w skrypcie
`.claude/scripts/e2e/e2e.mjs` — autopilot, tester, fix i smoke operatora wołają ten sam skrypt.

**Dwa przypadki (PANEL-WEJSCIE §2 pkt 6):**
- **Środowisko niesprawne NA STARCIE** → **STOP w bootstrapie, przed fazą 1**, z komendą naprawy.
  Dotyczy zadania z niezaznaczonymi `[E2E]`, gdy repo nie ma `.env.e2e` albo sprawdzenie pada (plik poza
  `.gitignore`, brak kluczy bazy e2e, ta sama baza co dev, zmieniona wypchnięta migracja, niedziałający
  agent-browser, serwer nie wstaje). Bez cichej degradacji: brak środowiska nie udaje świadomej rezygnacji.
  Świadomy opt-out: zmień marker `[E2E]` → `[Manual]` w pliku zadań (scenariusz wykonasz w smoke'u operatora).
- **Test niewykonalny W TRAKCIE runu** (serwer padł, limit usługi zewnętrznej, popup OAuth, tester nie dał
  przebiegu) → linia `[E2E]` przechodzi na `[Manual]` z powodem `(MANUAL — <przyczyna>: <powód>)`,
  **run idzie dalej**, pozycja trafia do smoke'u operatora (`docs/operator/…-smoke.md`). Każda faza ze scenariuszami
  albo makietami zaczyna review od restartu serwera (`e2e.mjs restart`) — serwer z bootstrapu nie widzi plików konfiguracji
  powstałych w fazach. Serwer, który po restarcie pada od razu, daje fazie tester bez przeglądarki, a ogon logu idzie
  do reviewera correctness (kod fazy go położył); do końca runu przeglądarka znika, gdy serwer nie odpowiada w limicie startu.
- **Projekt od zera** (repo bez `package.json` albo z `package.json` bez zależności, komenda startu nie ma czego uruchomić)
  → start **odroczony**, nie STOP: serwer wstaje restartem przed testerem pierwszej fazy, która go potrzebuje. Projekt
  z aplikacją (świeży klon bez `node_modules`, literówka w `E2E_START`) dostaje nadal STOP z naprawą.
- Zadanie bez `[E2E]` i bez makiet `figma_screens` → środowisko pominięte, serwera nie uruchamiamy.

Sprawdzenie bez startu (to samo, co robi bootstrap, plus stan serwera):
`node .claude/scripts/e2e/e2e.mjs sprawdz --zadanie docs/active/<zadanie>`

## Parametry `.env.e2e`

Wszystkie opcjonalne — domyślnie dev server Vite na `http://localhost:5173`:

| Klucz | Domyślnie | Znaczenie |
|---|---|---|
| `E2E_URL` | `http://localhost:5173` | adres aplikacji (tester, sonda zdrowia, port domyślnej komendy) |
| `E2E_START` | `<pm> run dev -- --mode e2e --port <port z E2E_URL> --strictPort` | komenda startu serwera (pm z lockfile); dostaje zmienne z `.env.e2e` w środowisku; wartość ze spacjami w cudzysłowie (`E2E_START="…"`), bo db-sync wczytuje plik shellem |
| `E2E_HEALTH` | `E2E_URL` | adres sondy zdrowia; odpowiedź < 500 = serwer działa |
| `E2E_START_TIMEOUT` | `90` | sekundy na odpowiedź serwera po starcie |

Baza e2e (projekt z katalogiem `supabase/` albo z kluczami `SUPABASE_E2E_*`) wymaga dodatkowo:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (albo legacy `VITE_SUPABASE_ANON_KEY`), `SUPABASE_E2E_DB_URL`, `SUPABASE_E2E_SERVICE_ROLE_KEY`,
`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`. Opcjonalnie `SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access Tokens):
lint advisors (RLS, `search_path`, indeksy) bazy e2e po wgraniu migracji każdej fazy — wynik dostaje reviewer security; bez tokenu
security sprawdza migracje ręcznie. Token daje dostęp do całego konta Supabase i nie trafia do procesu aplikacji. Ref projektu
advisors bierze z `VITE_SUPABASE_URL` (`https://<ref>.supabase.co`) albo z `SUPABASE_E2E_PROJECT_REF`. Guard tożsamości: `VITE_SUPABASE_URL` z `.env.e2e` musi się różnić od
`.env` / `.env.local`. Projekt bez bazy e2e (np. serwis Node na wspólnym stagingu) ustawia tylko `E2E_URL`
i `E2E_START`; db-sync wtedy się nie uruchamia. Wzór: `.claude/templates/e2e-env/.env.e2e.example`.

## Architektura

```
Bootstrap:    e2e:start  — e2e.mjs start: scenariusze [E2E] i makiety zadania, sprawdzenie .env.e2e,
                           start serwera w tle (PID i log w /tmp/autopilot-e2e-<projekt>.*).
                           Niesprawne środowisko przy [E2E] = STOP przed fazą 1 z naprawą ze skryptu.
Per faza:     db-sync    — tylko z bazą e2e: e2e.mjs suma (migrations.sum), supabase db push na bazę e2e
                           (pierwszy realny apply SQL migracji w pipeline), seedy e2e/seeds/*-seed.sql, konto testowe.
Review:       tester E2E — agent-browser na E2E_URL; wpis per scenariusz z przyczyną SKIP. Gdy aplikacja milczy:
                           e2e.mjs stan (czy nasz serwer żyje + ogon logu) — padł z błędem kodu = FAIL do fixa,
                           inaczej SKIP „srodowisko” → [Manual]; następna faza zaczyna od restartu serwera.
              scribe     — e2e.mjs ksieguj: PASS odznacza, SKIP środowiska/limitu/harnessu → [Manual] z powodem.
Fix:          po awarii środowiska e2e.mjs manual zamiast odgrywania scenariusza.
Zakończenie:  env-down   — e2e.mjs stop: zatrzymuje tylko serwer z naszego PID-u; STOP zostawia środowisko
                           do ręcznego debugowania.
Smoke:        e2e.mjs lista-manual → sekcja „E2E do odegrania ręcznie (środowisko w trakcie runu)”.
```

## Szybki start — gotowy prompt dla asystenta

Zamiast wykonywać kroki ręcznie, wklej asystentowi w sesji projektu (zastąp `<projekt>`):

```markdown
Zrób one-time setup środowiska E2E wg .claude/templates/e2e-env/README.md:

1. Utwórz dedykowany projekt Supabase "<projekt>-e2e" (przez Supabase MCP
   jeśli dostępny, inaczej daj mi link i poprowadź przez dashboard — free tier).
   To MUSI być NOWY projekt — nigdy ref istniejącej bazy dev/prod.
2. Zbierz: URL, publishable key (`sb_publishable_…`), service_role key, connection string (session pooler, IPv4).
3. Utwórz `.env.e2e` w korzeniu repo wg .claude/templates/e2e-env/.env.e2e.example,
   wygeneruj silne hasło dla konta testowego (e2e@<projekt>.test).
4. Dopisz `.env.e2e` do .gitignore i ZWERYFIKUJ: `git check-ignore .env.e2e`.
5. Sprawdź `node .claude/scripts/e2e/e2e.mjs sprawdz --zadanie <dowolne zadanie z [E2E]>` i że serwer
   z `E2E_START` (domyślnie `<pm> run dev -- --mode e2e --port 5173`) celuje w bazę e2e (otwórz E2E_URL,
   zaloguj kontem testowym).
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
   refów dev/prod — sprawdzenie ma guard tożsamości (URL e2e ≠ URL z `.env`), ale nie kuś losu.
2. **Skopiuj config**: `cp .claude/templates/e2e-env/.env.e2e.example .env.e2e` i uzupełnij
   (API keys, connection string session pooler, konto testowe email+hasło).
3. **Gitignore**: dopisz `.env.e2e` do `.gitignore` (start odmówi bez tego).
4. **Serwer aplikacji**: domyślnie Vite ładuje `.env.e2e` flagą `--mode e2e`; skrypt `dev` w package.json
   musi przepuszczać dodatkowe flagi (domyślnie `vite` je przepuszcza). Inny serwer — `E2E_START` i `E2E_URL`.
5. **agent-browser**: testy E2E napędza CLI `agent-browser` (`npm i -g agent-browser && agent-browser install`);
   sprawdzenie startu woła `agent-browser doctor --offline --quick`.
6. Gotowe — `e2e.mjs sprawdz` zielone, następny run autopilota przejdzie w tryb zarządzany.

## Konwencje dla planów zadań

- Scenariusz E2E zapisuje plan techniczny `/dev-plan` (`[E2E] \`<flow>\` — <URL i kroki> → <oczekiwany stan>`,
  szablon w `.claude/skills/dev-plan/references/szablon-planu.md`); agent-browser wykonuje go z opisu.
- Seedy: `e2e/seeds/<nazwa-flow>-seed.sql` — db-sync wiąże seed z flow po nazwie. Pisz seedy **idempotentnie**.
- Logowanie w flow wyłącznie kontem `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (OAuth providera
  jest nietestowalny headless — popup poza kontrolą przeglądarki automatycznej).
- **Re-seed per flow** (izolacja stanu): każdy scenariusz zaczyna od czystego, znanego stanu —
  seed idempotentny aplikuj przed KAŻDYM scenariuszem, nie raz na całą fazę.
- **Wyegzekwuj re-seed skryptem, nie zdaniem w dokumencie**: jeśli seedy etapu resetują ten sam
  rekord/konto (typowo: `delete from … where user_id = <konto e2e>`), to są **wzajemnie
  destrukcyjne** — po zbiorczym db-sync stan spełnia warunek wstępny najwyżej JEDNEGO scenariusza
  i „N/N PASS" jest nieosiągalne, choć każdy scenariusz osobno przechodzi. Dołóż do etapu runner
  `e2e/<etap>-run-all.sh` przeplatający `psql -v ON_ERROR_STOP=1 -f <seed>` ze scenariuszami para
  po parze i wskaż go JEDNĄ linią `Weryfikacja: [E2E] \`e2e/<etap>-run-all.sh\` — <stan>`
  (scenariusze zostają w swoich liniach `Test: [E2E]`; tester uruchamia runner RAZ i wyprowadza
  z jego outputu wynik per scenariusz — nie odgrywa scenariuszy objętych runnerem standalone).
  Wzór: runner etapu obok seedów, np. `e2e/e3-run-all.sh`.
- **Seedy aplikuj `psql`, nie `supabase db query -f`**: `db query` wysyła plik jako JEDNO prepared
  statement, więc seed z `begin; do $$ … $$; commit;` pada na `cannot insert multiple commands into
  a prepared statement (42601)`. CLI nadaje się do jednozdaniowych sprawdzeń, nie do seedów.
- **Pozytywna identyfikacja bazy w każdym destrukcyjnym seedzie**: guard „konto testowe istnieje"
  NIE chroni — zawodzi dokładnie wtedy, gdy konto o tym mailu istnieje na dev/prod. Wymagaj tabeli
  markera zakładanej ręcznie WYŁĄCZNIE na bazie e2e (poza migracjami, żeby `db push` nie mógł jej
  przynieść na dev/prod) i zaczynaj seed od:
  `if to_regclass('public.e2e_env_marker') is null then raise exception '…' end if;`

## Pułapki

- **Serwer „zastany"**: jeśli coś już odpowiada na `E2E_HEALTH` (np. ręcznie odpalone `bun run dev` na env dev),
  autopilot go użyje i ostrzeże w logu — flow mogą gadać z bazą dev. Ubij własny dev server przed runem
  (albo trzymaj go na innym porcie niż `E2E_URL`).
- **Reset danych**: db-sync nie robi `db reset` — czyszczenie zostawione seedom
  (idempotencja). Gdy baza e2e „zgnije", zresetuj ręcznie: `supabase db reset --db-url ...`.
- **Connection string „direct" jest IPv6-only** — w sieci bez IPv6 psql/db push wiszą na
  timeout. Używaj session poolera (IPv4, port 5432, wspiera migracje) — wzór w `.env.e2e.example`.
- **Stary Supabase CLI potrafi mieć zepsute tworzenie projektu** (np. 2.67.1 — wybór regionu);
  przy dziwnych błędach najpierw `brew upgrade supabase`.
- **Seedy muszą wstawiać WSZYSTKO, czego flow potrzebuje** — świeża baza e2e nie ma danych
  „oczywistych" z dev (np. słownikowych wstawianych kiedyś ręcznie). Migracje ≠ dane.

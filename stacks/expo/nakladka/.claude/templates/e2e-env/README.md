# Środowisko E2E dla dev-autopilot (one-time setup Operatora)

Po tym setupie autopilot **autonomicznie wykonuje testy E2E na urządzeniu** (Maestro): wybiera symulator albo emulator z aktualnym
dev-clientem, stawia Metro według `.env.e2e`, dowodzi canary, że flow ruszy, synchronizuje migracje i seedy bazy e2e per faza, a fail
scenariusza wchodzi w pętlę fix jako finding P2 typ E2E. Cały przepis siedzi w skrypcie `.claude/scripts/e2e/e2e.mjs`: autopilot,
tester, fix i smoke operatora wołają ten sam skrypt.

**Przypadki:**
- **Środowisko niesprawne NA STARCIE** → **STOP w bootstrapie, przed fazą 1**, z komendą naprawy. Dotyczy zadania z niezaznaczonymi
  `[E2E]`, gdy repo nie ma `.env.e2e` albo sprawdzenie pada: plik poza `.gitignore`, brak kluczy bazy e2e, brak tabeli markera przy seedach z jej guardem, ta sama baza co dev, zmieniona
  wypchnięta migracja, brak Maestro albo Java 17+, brak urządzenia, przestarzały albo niepodpisany dev-client, Metro nie wstaje, canary
  pada. Świadomy opt-out: zmień marker `[E2E]` → `[Manual]` w pliku zadań (scenariusz wykonasz w smoke'u operatora).
- **Seed nie wchodzi na bazę e2e w trakcie runu** (`psql` kończy go błędem z powodu połączenia, uprawnień, guardu bazy albo brakującej
  migracji) → STOP z naprawą, nie `[Manual]`: scenariusz bez danych nie jest testem do odegrania ręcznie. Review fazy zostaje otwarte,
  a świeży run po naprawie powtarza je z testerem. Błąd SQL w seedzie napisanym w tej fazie to defekt do fixa.
- **Test niewykonalny W TRAKCIE runu** (Metro padło, limit usługi zewnętrznej, tester nie dał przebiegu) → linia `[E2E]` przechodzi na
  `[Manual]` z powodem `(MANUAL — <przyczyna>: <powód>)`, **run idzie dalej**, pozycja trafia do smoke'u operatora
  (`docs/operator/…-smoke.md`). Każda faza ze scenariuszami albo makietami zaczyna review od restartu Metro (`e2e.mjs restart`).
- **Faza zmieniła warstwę natywną, brak modułu natywnego albo entitlements w trakcie runu** → STOP z komendą przebudowy, nie `[Manual]`: po
  restarcie Metro błąd nie znika, więc każdy kolejny scenariusz padłby tak samo (`.claude/stack/po-fazie.md`, `SYGNATURY_BLOKERA` w adapterze).
- **Projekt od zera** (repo bez `package.json` albo z `package.json` bez zależności) → start **odroczony**, nie STOP: Metro wstaje
  restartem przed testerem pierwszej fazy, która go potrzebuje.
- Zadanie bez `[E2E]` i bez makiet `figma_screens` → środowisko pominięte, Metro nie startuje.

Sprawdzenie bez startu (to samo, co robi bootstrap, plus stan serwera):
`node .claude/scripts/e2e/e2e.mjs sprawdz --zadanie docs/active/<zadanie>`

## Parametry `.env.e2e`

Wszystkie opcjonalne. Wzór: `.claude/templates/e2e-env/.env.e2e.example`.

| Klucz | Domyślnie | Znaczenie |
|---|---|---|
| `E2E_URL` | `http://localhost:8081` | adres Metro (sonda zdrowia, port domyślnej komendy, reload) |
| `E2E_START` | `env -u CI <pm> expo start --port <port z E2E_URL>` | komenda startu (pm z lockfile); dostaje zmienne z `.env.e2e` w środowisku; wartość ze spacjami w cudzysłowie, bo db-sync wczytuje plik shellem. Własna komenda też musi usuwać `CI`: przy `CI=1` Metro nie obserwuje plików |
| `E2E_HEALTH` | `<E2E_URL>/status` | adres sondy zdrowia; odpowiedź < 500 = działa |
| `E2E_HEALTH_TRESC` | — | tekst wymagany w odpowiedzi sondy; dla `/status` Metro: `packager-status:running` |
| `E2E_START_TIMEOUT` | `90` | sekundy na odpowiedź Metro po starcie. Canary ma własny limit 240 s, a agent startu 600 s, więc nie ustawiaj powyżej 300 |
| `E2E_PLATFORMA` | — | `ios` albo `android`; bez niego iOS, a przy braku Android |
| `E2E_URZADZENIE` | — | nazwa albo UDID symulatora, serial `adb` |

Baza e2e (projekt z katalogiem `supabase/` albo z kluczami `SUPABASE_E2E_*`) wymaga dodatkowo:
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (albo legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY`), `SUPABASE_E2E_DB_URL`,
`SUPABASE_E2E_SERVICE_ROLE_KEY`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`. Opcjonalnie `SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access
Tokens): lint advisors (RLS, `search_path`, indeksy) bazy e2e po wgraniu migracji każdej fazy; wynik dostaje reviewer security, a bez tokenu
security sprawdza migracje ręcznie. Token daje dostęp do całego konta Supabase i nie trafia do procesu aplikacji. Ref projektu advisors
bierze z `EXPO_PUBLIC_SUPABASE_URL` (`https://<ref>.supabase.co`) albo z `SUPABASE_E2E_PROJECT_REF`. Guard tożsamości:
`EXPO_PUBLIC_SUPABASE_URL` z `.env.e2e` musi się różnić od `.env` i `.env.local`. Projekt bez bazy e2e ustawia tylko parametry Metro; db-sync
wtedy się nie uruchamia.

Aplikacja z przyciskiem dev sign-in potrzebuje też pary `EXPO_PUBLIC_E2E_TEST_USER_EMAIL` i `EXPO_PUBLIC_E2E_TEST_USER_PASSWORD`: bez niej
przycisk się nie renderuje i każdy flow pada na pierwszym `tapOn`, a start tego nie zgłosi.

## Jak zmienne trafiają do aplikacji

Expo nie ładuje `.env.e2e`, a env procesu Metro przegrywa w trybie dev z plikami. Dlatego `e2e.mjs start` zapisuje linie `EXPO_PUBLIC_*` z
`.env.e2e` do `.env.development.local` (najwyższy priorytet w dev) i wysyła reload, a `e2e.mjs stop` plik usuwa:

- `.env.local` zostaje nietknięty;
- plik i kopia muszą być w `.gitignore` (`.env*.local` jest w `.gitignore` szablonu Expo), inaczej start się zatrzymuje;
- istniejący `.env.development.local` operatora trafia do `.env.kopia-e2e.local` i wraca po `stop`. Gdy oba istnieją, start się zatrzymuje;
- plik zostaje po STOP-ie, żeby środowisko dało się debugować. Przykrywa wtedy `.env.local` w dev, więc zgłasza go doctor i bramka
  `/dev-plan`. Sprzątanie po zakończonej pracy: `node .claude/scripts/e2e/e2e.mjs stop`;
- w Release i `expo export` priorytet jest odwrotny: proces wygrywa z plikiem. Ten mechanizm dotyczy tylko trybu dev.

## Urządzenie i dev-client

- **iOS najpierw.** Adapter bierze iPhone'a z dev-clientem, włączone urządzenia najpierw, i włącza wybrany. Nie bierze symulatora z
  zalogowanym kontem Apple: monit „Weryfikacja konta Apple” zasłania aplikację i nie zamyka się wstrzykniętym dotknięciem.
- **Android jako zapas.** Tylko emulator już działający (`emulator -avd <nazwa>`).
- **Świeżość.** Zmiana natywna po buildzie to STOP na starcie i przed testerem każdej fazy ze scenariuszami; paczka czysto JS i sam checkout nie
  zatrzymują. Reguły i komendy przebudowy: `.claude/stack/po-fazie.md`, sekcja „Przebudowa”. Bez odczytu mtime na Androidzie kontrola odpada z uwagą.
- **Podpis iOS.** Niepodpisany build działa, ale SecureStore nie utrwala sesji, więc logowanie „przechodzi”, a kolejny flow startuje
  wylogowany. Nie buduj z `CODE_SIGNING_ALLOWED=NO`.

## Canary

Po odpowiedzi Metro adapter uruchamia `.maestro/_canary.yaml` (wzór: `.claude/templates/e2e-env/_canary.yaml`): logowanie i asercja za
logowaniem, potem restart i ta sama asercja, co łapie brak entitlements. Bez tego pliku idzie tymczasowy flow wejścia w dev-client, który
dowodzi tylko, że aplikacja wstaje; wynik startu mówi to wprost, a bramka `/dev-plan` zgłasza brak pliku. Login REST kontem e2e robi rdzeń przed
Metro (brak konta → założenie kluczem service_role).

## Aplikacja z osobnym serwerem API (aplikacja + backend)

Domyślny start to jeden proces Metro. Gdy aplikacja woła własny serwer poza Supabase, scenariusze z zapisem przez serwer kończą się SKIP
„środowisko” → `[Manual]`. Taki projekt potrzebuje:

1. **Skryptu startu obu procesów** w repo (np. `scripts/e2e/start-e2e.mjs`): uruchamia serwer na osobnym porcie z mapą zmiennych z `.env.e2e`
   (adres i klucz bazy e2e, testowe klucze usług zewnętrznych, wysyłki w trybie dziennika), potem Metro bez `CI`; sygnał zakończenia i padnięcie
   jednego procesu kończą oba.
2. **`E2E_START` na ten skrypt** (`E2E_START="npm run e2e:start"`), jeden klucz w pliku.
3. **Sondy na trasie serwera z treścią**: `E2E_HEALTH=http://localhost:<port serwera>/healthz` i `E2E_HEALTH_TRESC='"status":"ok"'`. Bez tego start
   samego Metro przechodzi sondę. Sonda nie podąża za przekierowaniem. Adres serwera dla aplikacji idzie linią `EXPO_PUBLIC_*` w `.env.e2e`;
   emulator Androida widzi komputer pod `10.0.2.2`, nie pod `localhost`.

Gdy skrypt startu powstaje dopiero w zadaniu, plan ma pozycję checklisty `[blokuje: faza N]` (N = faza pierwszego scenariusza zapisującego albo
czytającego przez serwer): operator podmienia `E2E_START` i ustawia sondy po fazie z IU skryptu, a autopilot zatrzymuje się przed fazą N,
dopóki pozycja jest nieodhaczona.

## Architektura

```
Bootstrap:    e2e:start  — e2e.mjs start: scenariusze [E2E] i makiety zadania, sprawdzenie .env.e2e, z bazą e2e login kontem
                           E2E_TEST_EMAIL, urządzenie i dev-client, .env.development.local, próbny zrzut, Metro w tle (PID i log w
                           /tmp/autopilot-e2e-<projekt>.*), reload, canary. Niesprawne środowisko przy [E2E] = STOP przed fazą 1.
Per faza:     db-sync    — tylko z bazą e2e: e2e.mjs suma (migrations.sum), supabase db push na bazę e2e, seedy .maestro/*-seed.sql, konto testowe.
Review:       tester E2E — Maestro na urządzeniu; wpis per scenariusz z przyczyną SKIP. Gdy aplikacja milczy: e2e.mjs stan (czy nasze Metro
                           żyje + ogon logu) — padło z błędem kodu = FAIL do fixa, inaczej SKIP „srodowisko” → [Manual].
              scribe     — e2e.mjs ksieguj: PASS odznacza, SKIP środowiska/limitu/harnessu → [Manual] z powodem.
Fix:          po awarii środowiska e2e.mjs manual zamiast odgrywania scenariusza.
Zakończenie:  env-down   — e2e.mjs stop: zatrzymuje tylko Metro z naszego PID-u i sprząta plik env; urządzenie zostaje włączone. STOP zostawia
                           środowisko do ręcznego debugowania.
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
5. Skopiuj .claude/templates/e2e-env/_canary.yaml do .maestro/_canary.yaml i dopasuj testID logowania i element za logowaniem.
6. Sprawdź `node .claude/scripts/e2e/e2e.mjs sprawdz --zadanie <dowolne zadanie z [E2E]>`, a potem `e2e.mjs start`:
   przejdzie, gdy jest aktualny dev-client i canary (naprawy podaje start). Na koniec `e2e.mjs stop`.
7. Na koniec smoke: curl do URL projektu e2e + `supabase db push --db-url ... --include-all --yes`
   na pustą bazę (zaaplikuje WSZYSTKIE migracje od zera — to też test, czy
   łańcuch migracji jest kompletny!) i pokaż mi raport co działa, a co wymaga
   mojej ręki.

Sekretów nie loguj i nie commituj. Po wszystkim NIE odpalaj autopilota — czekaj na mnie.
```

Krok 1 może wymagać ręcznego kliknięcia w dashboardzie (uprawnienia tokena MCP); resztę asystent zrobi sam. Pierwszy run autopilota z `.env.e2e`
traktuj jako test bojowy tej fazy.

## Kroki (raz na maszynę/projekt)

1. **Utwórz dedykowany projekt Supabase** (np. `<projekt>-e2e`). Nigdy nie podawaj tu refów dev/prod: sprawdzenie ma guard tożsamości, ale nie kuś losu.
2. **Skopiuj config**: `cp .claude/templates/e2e-env/.env.e2e.example .env.e2e` i uzupełnij (klucze, connection string session pooler, konto testowe).
3. **Gitignore**: dopisz `.env.e2e` do `.gitignore` (start odmówi bez tego); `.env*.local` jest już w `.gitignore` szablonu Expo.
4. **Maestro**: `curl -fsSL "https://get.maestro.mobile.dev" | bash`, Java 17+ z `JAVA_HOME`. Sprawdzenie startu woła `maestro --version` i `java -version`.
5. **Dev-client**: `LANG=en_US.UTF-8 npx expo run:ios --no-bundler` na symulatorze bez konta Apple albo `npx expo run:android --no-bundler` na działającym emulatorze. Aplikacja z Sign in with Apple albo associated domains bez certyfikatu Apple: podpis ad-hoc wg `.claude/stack/po-fazie.md`, sekcja „Przebudowa”.
6. **Canary**: skopiuj `.claude/templates/e2e-env/_canary.yaml` do `.maestro/_canary.yaml` i dopasuj.
7. Gotowe: `e2e.mjs sprawdz` zielone, następny run autopilota przejdzie w tryb zarządzany.

## Konwencje dla planów zadań

- Scenariusz E2E zapisuje plan techniczny `/dev-plan` (`[E2E] \`<flow>\` — <kroki> → <oczekiwany stan>`, szablon w
  `.claude/skills/dev-plan/references/szablon-planu.md`). Plik `.maestro/<flow>.yaml` jest częścią dostawy buildera.
- Seedy: `.maestro/<nazwa-flow>-seed.sql`; db-sync wiąże seed z flow po nazwie. Pisz seedy **idempotentnie**.
- Logowanie w flow wyłącznie kontem `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (Maestro nie przejdzie sheetu OAuth). W YAML to `${MAESTRO_E2E_EMAIL}` i `${MAESTRO_E2E_PASSWORD}`: adapter podaje je w środowisku procesu Maestro, nie przez `-e`, bo argumenty widać w `ps` i `pgrep -fl`. Klucze `MAESTRO_*` z `.env.e2e` idą tą samą drogą.
- **Re-seed per flow** (izolacja stanu): każdy scenariusz zaczyna od czystego, znanego stanu; seed idempotentny aplikuj przed KAŻDYM scenariuszem.
- **Wyegzekwuj re-seed skryptem, nie zdaniem w dokumencie**: jeśli seedy etapu resetują ten sam rekord albo konto, są **wzajemnie destrukcyjne** i
  „N/N PASS” jest nieosiągalne, choć każdy scenariusz osobno przechodzi. Dołóż runner `.maestro/<etap>-run-all.sh` przeplatający
  `psql -v ON_ERROR_STOP=1 -f <seed>` ze scenariuszami para po parze i wskaż go JEDNĄ linią `Weryfikacja: [E2E] \`.maestro/<etap>-run-all.sh\` — <stan>`
  (scenariusze zostają w swoich liniach `Test: [E2E]`; tester uruchamia runner RAZ i wyprowadza z jego outputu wynik per scenariusz).
- **Seedy aplikuj `psql`, nie `supabase db query -f`**: `db query` wysyła plik jako JEDNO prepared statement, więc seed z
  `begin; do $$ … $$; commit;` pada na `cannot insert multiple commands into a prepared statement (42601)`.
- **Pozytywna identyfikacja bazy w każdym destrukcyjnym seedzie**: guard „konto testowe istnieje” NIE chroni, bo zawodzi dokładnie wtedy, gdy konto o
  tym mailu istnieje na dev/prod. Wymagaj tabeli markera zakładanej ręcznie WYŁĄCZNIE na bazie e2e (poza migracjami) i zaczynaj seed od:
  `if to_regclass('public.e2e_env_marker') is null then raise exception '…' end if;`

## Pułapki

- **Obce Metro**: proces na porcie E2E adapter zatrzymuje i stawia swój (obce Metro może serwować paczkę innego projektu). Twoje zwykłe `expo start` na
  8081 zginie przy starcie E2E; po przebiegu uruchom je ponownie.
- **Reset danych**: db-sync nie robi `db reset`, czyszczenie zostawione seedom. Gdy baza e2e „zgnije”, zresetuj ręcznie: `supabase db reset --db-url ... --yes`.
- **Connection string „direct” jest IPv6-only**: w sieci bez IPv6 psql i db push wiszą na timeout. Używaj session poolera (IPv4, port 5432).
- **Supabase CLI 3** (od 2026-11-02): zmiana hostowanej bazy bez terminala (agent, CI) wymaga `--yes`, `echo Y |` nic nie potwierdza; `--db-url` działa w v2 i
  v3 (w v3 z ostrzeżeniem, usunięte w v4, zamiennik `--remote=<url>`); `--password` przy URL bazy kończy się błędem. Przewodnik:
  https://supabase.com/docs/guides/local-development/cli/migrating-to-v3
- **Seedy muszą wstawiać WSZYSTKO, czego flow potrzebuje**: świeża baza e2e nie ma danych „oczywistych” z dev. Migracje ≠ dane.

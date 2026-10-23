---
title: "feat: Narzędzie makieta obok aplikacji w smoke'u operatora"
type: feat
status: active
date: 2026-10-20
origin: docs/brainstorms/2026-10-19-makieta-obok-aplikacji-requirements.md
design_md: null
figma_spec: null
figma_screens: {}
operator_prep: null
---

# feat: Narzędzie makieta obok aplikacji w smoke'u operatora

## Przegląd

Nowe narzędzie szablonu (`.claude/scripts/makieta/` i skill `/makieta`) pokazuje w smoke'u operatora aplikację w ramkach kilku
urządzeń naraz obok makiety bieżącego ekranu. Decyzje „Zgodne”, „Odstępstwo OK” i „Zgłoś błąd” zapisuje do jednej linii checklisty
smoke'u, a zgłoszenia błędów dostarcza do działającej sesji smoke'u. Lokalny serwer jest jednocześnie proxy do aplikacji,
które zdejmuje zakaz osadzania w ramce. `dev-docs-complete` zaczyna generować punkty wizualne w formacie, który narzędzie czyta.

**Tryb wykonania (decyzja operatora 2026-10-20):** plan wykonuje ręcznie sesja na gałęzi `popr/P24-makieta-obok-aplikacji`,
jak P22/P23, a nie autopilot. Każda IU: test padający bez poprawki (podmiana linii), pełne testy, typecheck, lint, prompt-audit
dodanych linii, recenzja subagenta z mutacjami w worktree, commit per IU i osobny commit „po recenzji”. Pola `Delegate to`
i `Skills in play` są wypełnione tylko pod kontrakt `plan.mjs sprawdz`.

## Ujęcie problemu

W smoke'u etapu 4 vibersi było ok. 25 punktów wizualnych w 3 sesjach. Najwięcej czasu szło na wypatrywanie różnic: PNG makiety
w jednym oknie, aplikacja w DevTools ustawiona na szerokość makiety w drugim, decyzje dyktowane sesji. Części zrzutów aplikacji
brakowało (`agent-browser screenshot` > 30 s). Operator chce przejść wszystkie punkty wizualne w jednym widoku, a decyzje
i zgłoszenia mają same trafiać do checklisty i do sesji (zob. źródło: docs/brainstorms/2026-10-19-makieta-obok-aplikacji-requirements.md).

## Śledzenie wymagań

- R1. Sesja smoke'u uruchamia narzędzie na polecenie operatora; działa w tle, daje link na localhost, bez klucza API.
- R2. Ekrany z punktów checklisty z `visual-diff/<ekran>-figma.png`; makieta = ten PNG, bez niego PNG z katalogu SPEC planu;
  wymiary z punktu albo SPEC; każdy ekran pokazuje treść i status punktu (otwarty, zgodny, odstępstwo, błąd zgłoszony).
- R3. Ramki startują na trasie z punktu, bez trasy na `/`; w ramkach da się klikać i nawigować.
- R4. Lewa część: aplikacja w ramkach kilku urządzeń; prawa: makieta 1:1 z dopasowaniem do wysokości, przyciski „Poprzedni”
  i „Następny”.
- R5. Biblioteka presetów urządzeń plus własny wymiar; domyślnie urządzenia pasujące do szerokości makiety; wybór pamiętany
  między ekranami.
- R6. Jedna sesja logowania dla wszystkich ramek; zmiana konta obejmuje wszystkie ramki.
- R7. „Zgodne” odhacza punkt i dopisuje `*(RRRR-MM-DD: zgodne)*`.
- R8. „Odstępstwo OK” z obowiązkową notatką odhacza punkt i dopisuje `*(RRRR-MM-DD: <notatka> — zatwierdzone)*`.
- R9. „Zgłoś błąd” (opis, urządzenie, szerokość): (a) trafia do sesji w kilka sekund, sesja naprawia z testem; (b) zapisuje się
  w linii punktu, punkt zostaje `[ ]`; (c) po poprawce ramki się przeładowują, punkt ma status „poprawione, do sprawdzenia”.
- R10. Narzędzie zmienia tylko linię punktu i nie nadpisuje równoległych zmian sesji.
- R11. Smoke z `dev-docs-complete` wymienia narzędzie przy punktach wizualnych, a punkty podają ekran, trasę i viewport
  w formacie czytelnym dla narzędzia.
- R12. Narzędzie jest częścią `.claude/`, trafia do projektów przez `/sync-template`, bez zmian w kodzie projektu.

## Granice zakresu

- Bez nakładki makiety na ramkę (suwak przezroczystości, tryb „różnica”) — operator wybrał porównanie obok siebie.
- Bez algorytmicznej różnicy pikseli (pixelmatch, odiff) — fonty i antyaliasing dają fałszywe różnice; ewentualnie etap 2.
- Bez naprawiania przez osobny proces `claude -p` — naprawia wyłącznie bieżąca sesja smoke'u.
- Bez zmian w testerze E2E (`feature-tester-e2e.md`) i w formacie katalogu `visual-diff/`.
- Bez fizycznych urządzeń — punkty **[fizyczne urządzenie]** przechodzi się po staremu.
- Bez zrzutów z narzędzia (agent-browser w sesji w tle zawiesza się na `screenshot`, HANDOFF §7).
- Bez zastępczego wzorca dla nieaktualnej makiety (inny node Figmy, HTML) — operator ocenia to notatką „Odstępstwo OK”.
- Bez wycofywania decyzji: ponowna ocena dopisuje nową adnotację przed starymi, stare zostają.

## Kontekst i research

### Relevantny kod i wzorce

- `.claude/scripts/e2e/serwer.mjs` — proces w tle z plikiem PID (`{pid, start, odcisk, uruchomiony}`), tożsamość PID + czas
  startu z `ps -o lstart=` w `LC_ALL=C`, `odpowiada(url)`, `procesNaPorcie(port)`, zatrzymanie grupy procesów z limitem.
- `.claude/scripts/smoke/zmienne.mjs` — CLI z nagłówkiem „Uzycie”, `parseArgs`, jedna linia JSON, kody 0/1/2/3, `--projekt`;
  testy `__tests__/zmienne.test.mjs` z fixture'ami-wycinkami smoke'ów vibersi.
- `.claude/scripts/pr/czekaj-na-bota.mjs` + `/dev-pr` krok 2 — wzorzec Monitora: jedna linia JSON = jedno zdarzenie, błędy na
  stderr, `--limit-min` najwyżej 25, bo Monitor żyje najwyżej 30 min.
- `.claude/scripts/plan/plan-techniczny.mjs` — `parsujPlan`, `poleTekstowe(plan, 'figma_spec')`, `ekranyFigmy(plan)`;
  `.claude/scripts/plan/makiety.mjs` — katalog `ekrany/` obok `figma_spec`, zdejmowanie `./` ze ścieżek.
- `.claude/workflows/dev-docs-complete-wf.js` (`smokePrompt`) i `.claude/skills/dev-docs-complete/SKILL.md` krok 3 — źródło
  smoke'u; `.claude/workflows/__tests__/start-koniec.test.mjs` wycina `smokePrompt` i pilnuje ramki „Jak kontynuować”.
- Prawdziwy smoke: `../vibersi/docs/operator/2026-10-18-etap-4-dodawanie-i-moderacja-smoke.md` — punkty wizualne w odmianach:
  `(viewport 1440×1041)`, `(viewport 1440×1150; zrzutu z aplikacji brak)`, trasa przed makietą (`` `/konto/projekty` obok ``),
  trasy z placeholderem (`/admin/kolejka?projekt=<id>`), dwie makiety w punkcie bez viewportu, kilka adnotacji, ścieżki
  w adnotacjach. Tester pisze `(viewport: W×H)` z dwukropkiem.
- Katalog `-figma` planu: `SPEC.md` z tabelą `| Nazwa | Plik | SPEC ekranu | Wymiary | Frame |` (`<W>×<H>px`), `ekrany/<nazwa>.md`,
  PNG obok SPEC. Trasy ekranu nie ma ani w SPEC, ani w planie — jedynym źródłem jest punkt checklisty.
- Archiwum: smoke `docs/operator/<data>-<zadanie>-smoke.md` odwołuje się do `visual-diff/` względnie; katalog zadania to
  `docs/completed/<zadanie>/` (przed archiwizacją `docs/active/<zadanie>/`), plan techniczny wskazuje w nim linia
  `Plan techniczny: \`docs/plans/...\`` w `<zadanie>-plan.md`.
- vibersi: `server/app.ts` `naglowkiOchronne` (Hono `secureHeaders`: `X-Frame-Options: DENY`, CSP z `frame-ancestors 'none'`,
  COOP/CORP `same-origin`, HSTS); Vite dev tych nagłówków nie wysyła. Sesja `@supabase/auth-js` w localStorage, PKCE,
  `redirectTo = window.location.origin + trasa` (`src/lib/konto/akcje-auth.ts`).
- Lint i typy: `eslint.config.js` daje `globals.node` dla `**/*.mjs` — kod przeglądarki potrzebuje bloku z `globals.browser`;
  `tsconfig.json` sprawdza `.claude/**/*.mjs` (DOM dostępny, target es2024 bez `lib`).
- `/sync-template` kopiuje wszystkie śledzone pliki `.claude/` (`git ls-files .claude`) — nowy katalog i skill trafiają do
  projektów bez manifestu.

### Wiedza instytucjonalna

- HANDOFF §7 (P13): parser markdownu sprawdzany na wszystkich prawdziwych plikach, fail-closed z numerem linii; treść pisana do
  checkboxów nie zawiera tokenów grepów pipeline'u (`[E2E]`, `[Manual]`, `[Unit]`, `Operator:`, `[P1]`–`[P3]`).
- HANDOFF P14/P16/P19: proces w tle — plik PID z czasem startu, `process.kill(-pid)` dla grupy, nigdy PID ≤ 1; testy sprzątają
  w `afterEach`, a po teście `pgrep -fl` nie pokazuje sierot.
- HANDOFF P22 D2: sesja nie czyta PNG makiet (ok. 2,5 tys. tokenów na turę) — zgłoszenie niesie ścieżkę SPEC ekranu
  (`ekrany/<ekran>.md`) i ścieżkę PNG, bez obrazu.
- HANDOFF E1 / hook `env-wartosci`: adres aplikacji i porty czyta Node, nie Bash z `.env*`; wyjście narzędzia (trafia przez
  Monitor do transkryptu) nie zawiera ciasteczek, nagłówka `Authorization`, tokenów ani ciał `/auth/v1/*`.
- HANDOFF A2: plik w drzewie projektu blokuje autopilota i `gotowosc` (`--untracked-files=all`) — stan narzędzia poza drzewem
  (`$TMPDIR`, jak cache tsc), a jedynym stanem w repo jest linia checklisty.
- HANDOFF P22 B2/B4: smoke kończy się „Następny krok: /clear, potem /dev-pr …”; commity poprawek ze smoke'u wylicza
  `pr/po-archiwum.mjs` — narzędzie tego nie zastępuje.
- HANDOFF A1: testy szablonu tylko `node:test` w `.claude/**`.

### Referencje zewnętrzne

- Node `http` — zdarzenie `upgrade` (https://nodejs.org/api/http.html#event-upgrade); nagłówki hop-by-hop RFC 9110 §7.6.1.
- Vite: reverse proxy przed Vite ma przepuszczać WebSocket HMR; bez tego klient łączy się z serwerem HMR wprost
  (https://vite.dev/config/server-options).
- `frame-ancestors` nie działa w `<meta>` (MDN) — wystarczy edycja nagłówków HTTP.
- localStorage i zdarzenie `storage` wspólne dla ramek jednego originu; auth-js rozsyła zmiany sesji przez `BroadcastChannel`.
- Supabase Redirect URLs: glob, `**` = dowolne znaki (https://supabase.com/docs/guides/auth/redirect-urls).
- Claude Code Monitor: każda linia stdout = zdarzenie, maks. 30 min (https://code.claude.com/docs/en/tools-reference#monitor-tool);
  dokumentacja nie mówi, czy zdarzenie budzi sesję czekającą na operatora.
- `fs.rename` nadpisuje cel atomowo w obrębie systemu plików.

## Kluczowe decyzje techniczne

- **Proxy narzędzia zamiast zmian w aplikacji** (zob. źródło): serwer `node:http` na `127.0.0.1:<port>` przekazuje wszystko poza
  `/__makieta/` do aplikacji i zdejmuje wyłącznie `X-Frame-Options`, dyrektywę `frame-ancestors` z każdej polityki CSP
  (także `-Report-Only`) i `Strict-Transport-Security`. Reszta CSP zostaje, żeby smoke dalej widział prawdziwe błędy CSP.
- **Jeden origin dla strony narzędzia i ramek:** strona pod `/__makieta/`, ramki pod resztą ścieżek — ramki są same-origin ze
  stroną (przeładowanie z rodzica) i dzielą localStorage, więc jedna sesja logowania (R6). Po zmianie konta przycisk „Przeładuj
  ramki” jest gwarancją; synchronizacja auth-js przez BroadcastChannel to bonus.
- **Stały port i adres `http://127.0.0.1:5180`:** PKCE i sesja zależą od originu, a OAuth wymaga wpisu w Redirect URLs Supabase
  dev — port nie może skakać. Port zajęty przez obcy proces = błąd z PID-em i komendą procesu (bez szukania wolnego);
  zajęty przez poprzednią instancję narzędzia = przejęcie jej (stop i start).
- **Cel proxy tylko lokalny:** `--aplikacja <url>` (domyślnie `http://localhost:5173`), host wyłącznie `localhost`,
  `127.0.0.1` albo `[::1]`, porównanie po `new URL` (bez ukośnika końcowego, port domyślny). Nagłówek `Host` zostaje originem
  proxy (aplikacja widzi swój `'self'`), `Location` absolutne na cel przepisane na origin proxy, `Set-Cookie` bez `Domain`
  i `Secure`, nagłówki hop-by-hop zdjęte, ciało i `content-encoding` bez zmian, WebSocket przez `upgrade`.
- **Logowanie OAuth w karcie, nie w ramce:** przycisk „Otwórz w karcie” otwiera trasę aplikacji w nowej karcie originu proxy;
  dostawca wraca na origin proxy (`redirectTo` = `window.location.origin`), ramki dostają sesję ze wspólnego localStorage.
  Wymóg dla projektu: `http://127.0.0.1:5180/**` w Redirect URLs Supabase dev; logowanie hasłem działa bez tego.
- **Checklista jedynym źródłem stanu punktu:** status liczony z linii — checkbox plus pierwsza adnotacja `*(…)*` zaraz po nim.
  `[x]` + adnotacja kończąca się „— zatwierdzone” = odstępstwo; `[x]` w innym razie = zgodny; `[ ]` + adnotacja zaczynająca się
  „błąd zgłoszony” = błąd zgłoszony; `[ ]` + „poprawione” = poprawione, do sprawdzenia; reszta = otwarty. Nowa adnotacja wchodzi
  zaraz po checkboxie, przed starymi (tak jak dziś w smoke'ach).
- **Identyfikator punktu z treści, nie z numeru linii:** `p-` + 8 znaków hex z SHA-1 treści linii bez checkboxa i bez adnotacji.
  Sesja dopisuje adnotacje i sekcje, więc numer linii się przesuwa, a treść nie. Dwie linie z tą samą treścią = punkt
  niejednoznaczny, tylko do odczytu.
- **Zapis linii z kontrolą konfliktu:** zapis podaje identyfikator i linię, którą widział operator; serwer czyta plik od nowa,
  linia inna = konflikt (HTTP 409, strona odświeża punkty), zgodna = podmiana tylko tej linii, zapis do pliku tymczasowego
  w tym samym katalogu i `rename`. Zapisy narzędzia (serwer i CLI) serializuje blokada `open(…,'wx')` w katalogu stanu
  z usuwaniem przeterminowanej. Sesja edytuje plik narzędziem Edit, które samo odmawia przy zmianie od odczytu.
- **Notatki operatora oczyszczone:** jedna linia, bez `*(` i `)*`, tokeny `[E2E]`, `[Manual]`, `[Unit]`, `[P1]`–`[P3]`
  i `Operator:` zamienione na wersję bez nawiasów i dwukropka, limit 300 znaków; pusta notatka „Odstępstwo OK” = odmowa.
- **Dostarczenie zgłoszenia: plik + Monitor** (odroczone pytanie źródła R9): zgłoszenie trafia najpierw do linii checklisty (R9b),
  potem do kolejki `kolejka.jsonl` w katalogu stanu. Sesja trzyma `makieta.mjs czekaj --limit-min 25` w Monitorze: przy starcie
  wypisuje zgłoszenia jeszcze niedostarczone, potem każde nowe jako jedną linię JSON, na końcu `{"zdarzenie":"limit"}` — sesja
  uruchamia Monitor ponownie. `makieta.mjs zgloszenia` wypisuje wszystkie otwarte zgłoszenia z checklisty (droga awaryjna, gdy
  zdarzenie nie dotarło albo po `/clear`).
- **Sygnał „poprawione” daje sesja** (odroczone pytanie źródła R9c): po teście i commicie poprawki (przy zbudowanym serwerze też
  po przebudowie i restarcie aplikacji) sesja woła `makieta.mjs poprawione --punkt <id> --commit <sha>`. CLI dopisuje
  `*(RRRR-MM-DD: poprawione w <sha>, do sprawdzenia)*`, czeka do 60 s, aż aplikacja odpowiada (`odpowiada()`), i prosi serwer
  o przeładowanie ramek (SSE do strony). Przy Vite dev HMR i tak odświeży moduły; przeładowanie wraca ramki na trasę punktu.
- **Strona widzi zmiany sesji:** serwer obserwuje plik smoke'u (`fs.watchFile`, 1 s) i wysyła stronie zdarzenie SSE `punkty`.
- **Stan narzędzia poza repo:** `$TMPDIR/claude-makieta/<nazwa katalogu projektu>-<cksum ścieżki>/` — `serwer.json`
  (pid, start, port, token, smoke, aplikacja), `kolejka.jsonl`, `serwer.log`, blokada. Jedna instancja na projekt.
- **Ochrona API:** nasłuch tylko na `127.0.0.1`; link startowy niesie losowy token (`/__makieta/?t=<token>`), strona trzyma go
  w `sessionStorage` i wysyła w nagłówku `x-makieta-token`; zapisy i SSE bez tokenu albo z obcym `Origin` = 403.
- **Ekrany SPEC bez punktu** (odroczone pytanie źródła R2): pomijane — bez linii nie ma gdzie zapisać decyzji; wynik `start`
  i nagłówek strony wymieniają je z nazwy, żeby operator mógł dopisać punkt.
- **Trasa z placeholderem** (`<id>`, `<slug>`): ramki startują na trasie do pierwszego segmentu z `<`, a pełna trasa stoi nad
  ramkami jako podpowiedź; wspólny pasek adresu ustawia trasę wszystkim ramkom naraz. Punkt bez trasy startuje na `/`.
- **Kilka makiet w jednym punkcie:** każda makieta to osobny ekran na liście, decyzja dotyczy wspólnej linii. Nowe smoke'i dają
  jedną makietę na punkt (R11).
- **Presety i reguła domyślna** (odroczone pytanie źródła R5): `iphone-se` 375×667, `iphone-15` 393×852, `pixel-8` 412×915,
  `ipad-mini` 768×1024, `ipad-11` 834×1194, `laptop-1280` 1280×800, `desktop-1440` 1440×900. Domyślnie presety o szerokości
  w granicach ±24 px od szerokości makiety; żaden nie pasuje (komponent 358, 480, 520, 1104) → ramka „wymiar makiety W×H” plus
  `desktop-1440`, gdy makieta ma ≥ 600 px albo punkt zaczyna się od „Komputer”, w przeciwnym razie `iphone-15`. Ręczna zmiana
  wyboru zostaje dla kolejnych ekranów (localStorage strony) do kliknięcia „Domyślne”.
- **Ramki szersze niż kolumna** skalowane `transform: scale` z wrapperem o wymiarach po skali (media queries widzą pełną
  szerokość); przełącznik „1:1”.
- **Kod przeglądarki jako `.mjs`** w `.claude/scripts/makieta/strona/` z blokiem `globals.browser` w `eslint.config.js` — tsc
  sprawdza go razem z resztą; logika czysta (`urzadzenia.mjs`, `punkty.mjs` w części statusów) jest wspólna dla serwera i strony
  i testowana `node:test`.
- **Format punktu wizualnego w smoke'u (R11):** `- [ ] <Urządzenie>[, <stan>]: \`<trasa>\` obok \`visual-diff/<ekran>-figma.png\`
  (viewport <W>×<H>) → <oczekiwany wynik>`; bez znanej trasy `<opis wejścia> obok …`; jedna makieta na punkt. Parser przyjmuje
  też stare odmiany (dwukropek po „viewport”, sufiks `px`, dopisek po `;`, kilka makiet), więc smoke'i etapów 1–4 działają.
  `makieta.mjs sprawdz --smoke <plik>` jest kontrolą formatu w workflowie archiwizacji, jak `zmienne.mjs --smoke`.
- **Procedura sesji w skillu `/makieta`**, nie w ramce smoke'u: ramka i sekcja makiet tylko kierują do skilla, który ładuje się
  na żądanie (start, Monitor, obsługa zgłoszenia bez czytania PNG, `poprawione`, `stop` przed `/clear`).

## Rejestr stałych

| Stała | Wartość | Plik | IU-źródło | Konsumenci |
|---|---|---|---|---|
| `ZNACZNIK_BLEDU` | `'błąd zgłoszony'` | `.claude/scripts/makieta/punkty.mjs` | IU-1 | IU-1, IU-3, IU-6 |
| `ZNACZNIK_POPRAWKI` | `'poprawione'` | `.claude/scripts/makieta/punkty.mjs` | IU-1 | IU-1, IU-3 |
| `ZNACZNIK_ODSTEPSTWA` | `'— zatwierdzone'` | `.claude/scripts/makieta/punkty.mjs` | IU-1 | IU-1, IU-3 |
| `PREFIKS_NARZEDZIA` | `'/__makieta/'` | `.claude/scripts/makieta/proxy.mjs` | IU-4 | IU-4, IU-5, IU-7 |
| `NAGLOWEK_TOKENU` | `'x-makieta-token'` | `.claude/scripts/makieta/serwer.mjs` | IU-5 | IU-5, IU-6, IU-7 |
| `DOMYSLNY_PORT` | `5180` | `.claude/scripts/makieta/proces.mjs` | IU-6 | IU-6, IU-8 |
| `DOMYSLNA_APLIKACJA` | `'http://localhost:5173'` | `.claude/scripts/makieta/proces.mjs` | IU-6 | IU-6 |
| `LIMIT_CZEKANIA_MIN` | `25` | `.claude/scripts/makieta/kolejka.mjs` | IU-5 | IU-5, IU-6, IU-8 |
| `PRESETY` | lista z „Kluczowe decyzje” | `.claude/scripts/makieta/urzadzenia.mjs` | IU-7 | IU-7 |

## Otwarte pytania

### Rozwiązane podczas planowania

- Wykonanie: ręcznie na `popr/P24-makieta-obok-aplikacji`, nie autopilotem (decyzja operatora 2026-10-20).
- Mechanizm dostarczenia zgłoszenia (R9): plik kolejki + `czekaj` w Monitorze + `zgloszenia` jako droga awaryjna.
- Kto daje sygnał „przeładuj” (R9c): sesja, poleceniem `poprawione`, po teście, commicie i ewentualnym restarcie aplikacji.
- OAuth przez proxy (R6): `redirectTo` aplikacji już jest originem okna; wystarczy stały port i wpis w Redirect URLs Supabase dev;
  logowanie w karcie, nie w ramce.
- Ekrany SPEC bez punktu (R2): pomijane i wymieniane z nazwy.
- Presety i reguła „pasuje do szerokości” (R5): jak w „Kluczowe decyzje”.
- Bezpieczna edycja linii (R10): identyfikator z treści, porównanie linii przed zapisem, `rename`, blokada narzędzia.
- Skąd plan: z nazwy pliku smoke'u (`<data>-<zadanie>-smoke.md`) → katalog zadania → linia „Plan techniczny:” → frontmatter.

### Odroczone do implementacji

- Czy zdarzenie Monitora budzi sesję, która czeka na wiadomość operatora (dokumentacja milczy) — sprawdzić w pilocie IU-8;
  gdy nie budzi, skill każe operatorowi napisać „zgłoszenia”, a sesja woła `makieta.mjs zgloszenia`.
- Czy proces w tle przeżywa `/clear` i czy po nim `czekaj` z nowej sesji widzi ten sam serwer — pilot IU-8; skill i tak każe
  zatrzymać narzędzie przed `/clear`.
- Czy HMR Vite przechodzi przez `upgrade` proxy bez `server.hmr.clientPort` — test na żywym Vite w pilocie; bez HMR zostaje
  przeładowanie z `poprawione` i przycisk.
- Czy wiele ramek auth-js na jednym originie nie spowalnia odświeżania tokenu (Navigator Locks) — obserwacja w pilocie.
- Dokładna treść strony 502 „aplikacja nie odpowiada” i układ CSS strony — przy pisaniu IU-4 i IU-7.

## Wymagania wstępne operatora

Brak — implementacja startuje od razu. Pilot (IU-8) wymaga działającej aplikacji vibersi; logowanie OAuth w pilocie —
wpisu `http://127.0.0.1:5180/**` w Redirect URLs Supabase dev (pozycja w Operator checklist IU-8).

## Implementation Units

### Faza 1 — Checklista smoke'u jako dane

**Zależy od:** Brak

- [x] **IU-1: Parser punktów wizualnych i status punktu**

**Cel:** Moduł czysty, który z treści smoke'u wyciąga punkty wizualne z ekranami, trasą, viewportem, statusem i identyfikatorem.

**Wymagania:** R2, R3, R11

**Zależności:** Brak

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `.claude/scripts/makieta/punkty.mjs` | 0 → 180 | — | nowy |
| Test (unit) | `.claude/scripts/makieta/__tests__/punkty.test.mjs` | 0 → 200 | — | nowy |
| Stwórz | `.claude/scripts/makieta/__tests__/fixtures/vibersi-etap-4-smoke.md` | — → — | — | nowy |
| Stwórz | `.claude/scripts/makieta/__tests__/fixtures/vibersi-etap-3-smoke.md` | — → — | — | nowy |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- Punkt = linia checkboxa (`- [ ] ` albo `- [x] ` w kolumnie 0) z co najmniej jednym `visual-diff/<ekran>-figma.png`; linie
  poza checkboxami (Stan przebiegu, Przygotowanie) pomijane.
- Rozbiór linii: checkbox → adnotacje `*(…)*` na początku (wszystkie, najnowsza pierwsza) → treść. Ekrany, trasa i viewport
  tylko z treści, nigdy z adnotacji (adnotacje zawierają ścieżki typu `/p/smoke-formularz-9-54`).
- Trasa: pierwszy fragment w backtickach zaczynający się od `/` przed pierwszym `obok`; fragmenty z `*`, `rpc/`, `api/`
  w środku opisu nie są trasą; brak = `null` (start na `/`). Trasa z `<…>` daje też `trasaStartowa` do segmentu przed `<`.
- Viewport: `viewport` z opcjonalnym `:`, `W×H` (także `x`), opcjonalny `px`, dopisek po `;` ignorowany; brak = `null`
  (wymiary uzupełni IU-2 z SPEC).
- Status według decyzji „Checklista jedynym źródłem stanu” (`[x]` + „— zatwierdzone” = odstępstwo, `[x]` = zgodny,
  `[ ]` + „błąd zgłoszony” = błąd, `[ ]` + „poprawione” = poprawione, reszta = otwarty); stałe źródłowe w tym pliku:
  `ZNACZNIK_BLEDU = 'błąd zgłoszony'`, `ZNACZNIK_POPRAWKI = 'poprawione'`, `ZNACZNIK_ODSTEPSTWA = '— zatwierdzone'`.
- Identyfikator `p-<8 hex SHA-1 treści>`; powtórzona treść = `niejednoznaczny: true`. Moduł bez `node:` w części używanej
  przez stronę (status, adnotacje) — SHA-1 liczy funkcja wstrzykiwana albo osobny eksport serwerowy.
- Wynik `sprawdzFormat(md)`: lista punktów wizualnych bez ekranu, z linią spoza formatu R11 albo niejednoznacznych — z numerem
  linii (fail-closed, P13).

**Notatka wykonawcza:** characterization-first — najpierw testy na wycinkach prawdziwych smoke'ów vibersi (etap 3 i 4), potem parser.

**Wzorce do naśladowania:**
- `.claude/scripts/smoke/zmienne.mjs`
- `.claude/scripts/plan/pola-iu.mjs`

**Scenariusze testowe:**
- [Unit] linia z trasą, makietą i `(viewport 390×782)` daje ekran, trasę `/konto/projekty`, viewport 390×782, status otwarty
- [Unit] `(viewport: 390×844)` z dwukropkiem, `1440×1041px` i `(viewport 1440×1150; zrzutu z aplikacji brak)` dają ten sam kształt viewportu
- [Unit] linia z dwiema makietami bez viewportu daje dwa ekrany jednego punktu i viewport `null`
- [Unit] ścieżka `/p/smoke-formularz-9-54` w adnotacji nie staje się trasą; `*/api/projekty*` w opisie nie jest trasą
- [Unit] `/admin/kolejka?projekt=<id>` daje trasaStartowa `/admin/kolejka` i pełną trasę do podpowiedzi
- [Unit] pięć statusów z checkboxa i pierwszej adnotacji, w tym linia z kilkoma adnotacjami (najnowsza decyduje)
- [Unit] identyfikator nie zmienia się po dopisaniu adnotacji; dwie linie z tą samą treścią są niejednoznaczne
- [Unit] na fixture etapu 4 liczba punktów równa liczbie linii checkboxów z `-figma.png`; `sprawdzFormat` wskazuje punkt z dwiema makietami z numerem linii

**Weryfikacja:**
- `node --test .claude/scripts/makieta/__tests__/punkty.test.mjs` przechodzi
- `pnpm typecheck` przechodzi bez błędów
- `pnpm lint` przechodzi bez błędów

- [x] **IU-2: Źródła makiet — katalog zadania, plan, PNG i wymiary**

**Cel:** Dla pliku smoke'u znaleźć katalog zadania, plan techniczny, PNG każdego ekranu i jego wymiary oraz ekrany SPEC bez punktu.

**Wymagania:** R2

**Zależności:** IU-1

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `.claude/scripts/makieta/zrodla.mjs` | 0 → 130 | — | nowy |
| Test (unit) | `.claude/scripts/makieta/__tests__/zrodla.test.mjs` | 0 → 150 | — | nowy |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- Zadanie z nazwy `docs/operator/<RRRR-MM-DD>-<zadanie>-smoke.md`; katalog: `docs/completed/<zadanie>/`, a bez niego
  `docs/active/<zadanie>/`; brak obu = błąd z obiema ścieżkami.
- Plan techniczny z linii `Plan techniczny:` w `<zadanie>-plan.md` katalogu zadania; frontmatter przez `parsujPlan`,
  `poleTekstowe(plan, 'figma_spec')` i `ekranyFigmy(plan)` z `.claude/scripts/plan/plan-techniczny.mjs` (bez własnego parsera).
- PNG ekranu: `<katalog zadania>/visual-diff/<ekran>-figma.png`, bez niego PNG z `figma_screens`; brak obu = ekran z flagą
  „brak makiety” (strona pokazuje komunikat, decyzje działają).
- Wymiary: viewport punktu; bez niego wiersz tabeli `SPEC.md` (`<W>×<H>px`) albo nagłówek `ekrany/<ekran>.md`; ścieżka SPEC
  ekranu (`ekrany/<ekran>.md`) idzie do zgłoszenia (P22 D2: sesja czyta SPEC ekranu, nie PNG).
- Ekrany SPEC bez punktu = klucze `figma_screens` bez żadnego punktu (decyzja „Ekrany SPEC bez punktu”: pomijane, wymieniane).
- Wszystkie ścieżki względem korzenia projektu, sprawdzone `realpath` w obrębie projektu (PNG serwowany przez IU-5).

**Wzorce do naśladowania:**
- `.claude/scripts/plan/makiety.mjs`

**Scenariusze testowe:**
- [Unit] smoke w `docs/operator/` z zadaniem w `docs/completed/` znajduje plan, PNG z `visual-diff/` i ścieżkę `ekrany/<ekran>.md`
- [Unit] zadanie tylko w `docs/active/` też działa; brak obu katalogów = błąd z obiema ścieżkami
- [Unit] brak PNG w `visual-diff/` → PNG z `figma_screens`; brak obu → flaga braku makiety
- [Unit] punkt bez viewportu dostaje wymiary z tabeli `SPEC.md`
- [Unit] ekran z `figma_screens` bez punktu trafia do listy pominiętych
- [Unit] ścieżka PNG wychodząca poza projekt (`../`) jest odrzucona

**Weryfikacja:**
- `node --test .claude/scripts/makieta/__tests__/zrodla.test.mjs` przechodzi
- `pnpm typecheck` przechodzi bez błędów

- [x] **IU-3: Zapis decyzji do jednej linii checklisty**

**Cel:** Podmiana jednej linii punktu z adnotacją decyzji, z odrzuceniem przy zmianie linii i atomowym zapisem pliku.

**Wymagania:** R7, R8, R9, R10

**Zależności:** IU-1

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `.claude/scripts/makieta/zapis-linii.mjs` | 0 → 150 | — | nowy |
| Test (unit) | `.claude/scripts/makieta/__tests__/zapis-linii.test.mjs` | 0 → 190 | — | nowy |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- Decyzje: `zgodne` → `[x]` + `*(RRRR-MM-DD: zgodne)*`; `odstepstwo` → `[x]` + `*(RRRR-MM-DD: <notatka> — zatwierdzone)*`;
  `blad` → `[ ]` + `*(RRRR-MM-DD: błąd zgłoszony — <urządzenie> <szerokość> px: <opis>)*`; `poprawione` → `[ ]` +
  `*(RRRR-MM-DD: poprawione w <sha>, do sprawdzenia)*`. Znaczniki z `punkty.mjs` (`ZNACZNIK_BLEDU = 'błąd zgłoszony'`,
  `ZNACZNIK_POPRAWKI = 'poprawione'`, `ZNACZNIK_ODSTEPSTWA = '— zatwierdzone'`). Data lokalna, nie UTC (jak `dzis()` w `plan.mjs`).
- Nowa adnotacja zaraz po checkboxie, przed starymi; reszta linii bez zmian; pozostałe linie pliku bajt w bajt (także końce linii).
- Konflikt: punkt szukany po identyfikatorze w świeżo przeczytanym pliku; brak, kilka trafień albo linia różna od podanej =
  wynik `konflikt` bez zapisu (decyzja „Zapis linii z kontrolą konfliktu”).
- Zapis: plik tymczasowy w katalogu smoke'u (`.<nazwa>.<pid>.<uuid>.tmp`, `open 'wx'`, `sync`), `rename`, sprzątanie
  tymczasowego przy błędzie; blokada `open(…,'wx')` w katalogu stanu z wiekiem > 10 s = przeterminowana.
- Oczyszczanie notatek według decyzji „Notatki operatora oczyszczone” (jedna linia, bez `*(`/`)*`, tokeny grepów pipeline'u
  zneutralizowane, 300 znaków, pusta notatka odstępstwa i pusty opis błędu = odmowa).

**Notatka wykonawcza:** test-first — konflikt i zachowanie reszty pliku najpierw jako testy padające.

**Wzorce do naśladowania:**
- `.claude/scripts/e2e/ksiegowanie.mjs`

**Scenariusze testowe:**
- [Unit] „zgodne” na punkcie otwartym daje `[x]` i adnotację z dzisiejszą datą; reszta pliku identyczna bajtowo (także CRLF)
- [Unit] „odstępstwo” bez notatki = odmowa; z notatką = adnotacja kończąca się „— zatwierdzone” przed starą adnotacją
- [Unit] „błąd” zostawia `[ ]` (także na punkcie `[x]`), zapisuje urządzenie, szerokość i opis; status po zapisie = błąd zgłoszony
- [Unit] „poprawione” po „błąd” daje status poprawione, do sprawdzenia
- [Unit] linia zmieniona przez sesję między odczytem a zapisem = konflikt, plik bez zmian
- [Unit] notatka ze znacznikiem scenariusza przeglądarkowego w nawiasach kwadratowych, słowem „Operator” z dwukropkiem, zamknięciem adnotacji i znakiem nowej linii trafia do pliku bez tych tokenów
- [Unit] przerwany zapis nie zostawia pliku tymczasowego; przeterminowana blokada nie blokuje zapisu

**Weryfikacja:**
- `node --test .claude/scripts/makieta/__tests__/zapis-linii.test.mjs` przechodzi
- `pnpm typecheck` przechodzi bez błędów
- `pnpm lint` przechodzi bez błędów

### Faza 2 — Serwer narzędzia i proxy

**Zależy od:** Faza 1

- [x] **IU-4: Proxy do aplikacji bez zakazu osadzania**

**Cel:** Reverse proxy `node:http` do lokalnej aplikacji, które zdejmuje zakaz osadzania w ramce i obsługuje przekierowania, ciasteczka i WebSocket.

**Wymagania:** R3, R6, R12

**Zależności:** Brak

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `.claude/scripts/makieta/naglowki.mjs` | 0 → 100 | — | nowy |
| Stwórz | `.claude/scripts/makieta/proxy.mjs` | 0 → 170 | — | nowy |
| Test (unit) | `.claude/scripts/makieta/__tests__/naglowki.test.mjs` | 0 → 140 | — | nowy |
| Test (unit) | `.claude/scripts/makieta/__tests__/proxy.test.mjs` | 0 → 190 | — | nowy |
| Stwórz | `.claude/scripts/makieta/__tests__/fixtures/naglowki-vibersi.json` | — → — | — | nowy |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- `naglowki.mjs` (czyste): zdjęcie `X-Frame-Options` i `Strict-Transport-Security`; CSP i CSP-Report-Only — podział po `,` na
  polityki i po `;` na dyrektywy, wyrzucenie dyrektywy, której pierwszy token bez względu na wielkość liter to
  `frame-ancestors`, puste polityki pominięte, reszta CSP bez zmian (decyzja „Proxy narzędzia zamiast zmian w aplikacji”);
  `Location` absolutne na origin celu → origin proxy, względne bez zmian; `Set-Cookie` (tablica) bez `Domain` i `Secure`;
  nagłówki hop-by-hop (RFC 9110 §7.6.1 i lista z `Connection`) zdjęte w obu kierunkach.
- `proxy.mjs`: przekazanie metody, ścieżki, nagłówków i ciała strumieniem; `Host` = origin proxy plus `X-Forwarded-Host`
  i `X-Forwarded-Proto`; ciało i `content-encoding` bez zmian; SSE bez buforowania (`flushHeaders`); `upgrade` dla
  WebSocketu z buforem `head`; obsługa `error` na żądaniu, odpowiedzi i socketach; zamknięcie klienta niszczy żądanie do celu.
- Cel z `--aplikacja`: host tylko `localhost`, `127.0.0.1`, `[::1]` (decyzja „Cel proxy tylko lokalny”).
- Aplikacja nie odpowiada → 502 z krótką stroną HTML „Aplikacja nie odpowiada pod <cel> — uruchom ją i kliknij „Przeładuj
  ramki”.”, bez wywracania procesu.
- Ścieżki z prefiksem `PREFIKS_NARZEDZIA = '/__makieta/'` (źródło w tym pliku) nie idą do celu — obsługuje je IU-5.
- Fixture nagłówków nagrane z odpowiedzi zbudowanego serwera vibersi (`server/app.ts` `naglowkiOchronne`), z komentarzem
  pochodzenia; test proxy na prawdziwym `http.createServer` celu na losowym porcie, nie na ręcznym stringu.
- Proxy niczego nie loguje z ciasteczek, `Authorization`, query z tokenami ani ciał `/auth/v1/*`; log tylko metoda, ścieżka bez
  query i status.

**Notatka wykonawcza:** test-first na nagłówkach z fixture'u vibersi.

**Wzorce do naśladowania:**
- `.claude/scripts/e2e/serwer.mjs`

**Scenariusze testowe:**
- [Unit] nagłówki z fixture'u vibersi: bez XFO, HSTS i `frame-ancestors`, reszta CSP (`default-src`, `connect-src`, `frame-src`) bez zmian
- [Unit] dwa nagłówki CSP i polityki po przecinku: `frame-ancestors` znika z każdej, puste polityki nie zostają; `FRAME-ANCESTORS` też
- [Unit] `Location: http://localhost:5173/zaloguj` → origin proxy; `Location: /zaloguj` i adres obcy bez zmian
- [Unit] `Set-Cookie` z `Domain` i `Secure` traci oba atrybuty, pozostałe zostają; kilka ciasteczek zostaje tablicą
- [Unit] żądanie POST z ciałem dochodzi do celu z `Host` proxy; odpowiedź gzip przechodzi bajtowo bez zmian
- [Unit] WebSocket przez proxy wymienia wiadomość z celem (echo na `upgrade`)
- [Unit] cel wyłączony → 502 ze stroną komunikatu, proces proxy żyje; cel `http://example.com` = odmowa startu
- [Unit] żądanie pod `/__makieta/` nie dociera do celu

**Weryfikacja:**
- `node --test .claude/scripts/makieta/__tests__/naglowki.test.mjs` przechodzi
- `node --test .claude/scripts/makieta/__tests__/proxy.test.mjs` przechodzi
- `pnpm typecheck` przechodzi bez błędów

- [x] **IU-5: Serwer narzędzia — strona, makiety, API decyzji i zdarzenia**

**Cel:** Serwer HTTP łączący proxy z trasami `/__makieta/`: statyka strony, PNG makiet, lista punktów, zapis decyzji, kolejka zgłoszeń i zdarzenia SSE.

**Wymagania:** R1, R2, R7, R8, R9, R10

**Zależności:** IU-2, IU-3, IU-4

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `.claude/scripts/makieta/serwer.mjs` | 0 → 230 | — | nowy |
| Stwórz | `.claude/scripts/makieta/kolejka.mjs` | 0 → 110 | — | nowy |
| Test (unit) | `.claude/scripts/makieta/__tests__/serwer.test.mjs` | 0 → 220 | — | nowy |
| Test (unit) | `.claude/scripts/makieta/__tests__/kolejka.test.mjs` | 0 → 120 | — | nowy |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- `utworzSerwer({ projekt, smoke, aplikacja, token, katalogStanu })` zwraca serwer `node:http` (nasłuch `127.0.0.1`, robi go
  IU-6); ścieżki z `PREFIKS_NARZEDZIA` (= `'/__makieta/'`, import z `proxy.mjs`) obsługuje narzędzie, reszta idzie do proxy.
- Trasy: `GET /__makieta/` (strona z IU-7, token wstrzyknięty nie w HTML, tylko odczytany przez stronę z `?t=`),
  `GET /__makieta/strona/*` (statyka z katalogu `strona/`, bez wyjścia poza katalog), `GET /__makieta/makieta/<ekran>.png`
  (PNG z IU-2, tylko ekrany z listy), `GET /__makieta/api/punkty` (punkty, ekrany, statusy, ekrany SPEC bez punktu),
  `POST /__makieta/api/decyzja` (`{punkt, linia, decyzja, notatka?, urzadzenie?, szerokosc?}` → IU-3; konflikt = 409),
  `GET /__makieta/api/zdarzenia` (SSE: `punkty` po zmianie pliku, `przeladuj`), `POST /__makieta/api/przeladuj` (z CLI).
- Ochrona: `NAGLOWEK_TOKENU = 'x-makieta-token'` (źródło w tym pliku) z tokenem z `serwer.json`; SSE z tokenem w query;
  `POST` z `Origin` innym niż origin narzędzia = 403 (decyzja „Ochrona API”).
- „Zgłoś błąd”: najpierw linia checklisty (IU-3, R9b), potem wpis do `kolejka.jsonl` (`kolejka.mjs`): punkt, ekran, trasa,
  viewport, urządzenie, szerokość, opis, ścieżka SPEC ekranu i PNG, `dostarczone: false`. Wpis bez treści sekretów.
- `kolejka.mjs`: dopisanie wpisu, odczyt niedostarczonych, oznaczenie dostarczenia, `czekaj(limitMin)` jako async iterator
  zdarzeń z limitem (`LIMIT_CZEKANIA_MIN = 25` — źródło tutaj, konsumuje IU-6), zgłoszenia otwarte liczone z checklisty
  (status błąd zgłoszony), nie z kolejki.
- Obserwacja pliku smoke'u `fs.watchFile` co 1 s → SSE `punkty` (decyzja „Strona widzi zmiany sesji”).

**Wzorce do naśladowania:**
- `.claude/scripts/pr/czekaj-na-bota.mjs`

**Scenariusze testowe:**
- [Unit] `GET /__makieta/api/punkty` na fixture etapu 4 w katalogu tymczasowym zwraca punkty ze statusami i ekrany SPEC bez punktu
- [Unit] decyzja „zgodne” z tokenem zmienia linię w pliku; bez tokenu albo z obcym `Origin` = 403 i plik bez zmian
- [Unit] decyzja na linii zmienionej w pliku po odczycie = 409
- [Unit] „błąd” zapisuje linię i wpis kolejki; `czekaj` oddaje wpis raz, a po ponownym starcie już go nie oddaje
- [Unit] zmiana pliku smoke'u wysyła SSE `punkty`; `POST /api/przeladuj` z tokenem wysyła SSE `przeladuj`
- [Unit] `GET /__makieta/strona/../../serwer.mjs` i PNG spoza listy ekranów = 404
- [Unit] ścieżka spoza prefiksu trafia do proxy (cel testowy odpowiada)

**Weryfikacja:**
- `node --test .claude/scripts/makieta/__tests__/serwer.test.mjs` przechodzi
- `node --test .claude/scripts/makieta/__tests__/kolejka.test.mjs` przechodzi
- `pnpm typecheck` przechodzi bez błędów
- `pnpm lint` przechodzi bez błędów

- [x] **IU-6: CLI makieta.mjs i proces w tle**

**Cel:** Polecenia `start`, `stop`, `stan`, `czekaj`, `zgloszenia`, `poprawione` i `sprawdz` z procesem serwera w tle i stanem poza repo.

**Wymagania:** R1, R9, R11, R12

**Zależności:** IU-5

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `.claude/scripts/makieta/makieta.mjs` | 0 → 170 | — | nowy |
| Stwórz | `.claude/scripts/makieta/proces.mjs` | 0 → 150 | — | nowy |
| Test (unit) | `.claude/scripts/makieta/__tests__/makieta-cli.test.mjs` | 0 → 220 | — | nowy |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- `proces.mjs`: katalog stanu `$TMPDIR/claude-makieta/<nazwa katalogu projektu>-<cksum ścieżki>/` (decyzja „Stan narzędzia poza
  repo”); `serwer.json` `{pid, start, port, token, smoke, aplikacja, uruchomiony}`; tożsamość procesu PID + `ps -o lstart=`
  w `LC_ALL=C`, stop grupy procesów z limitem, nigdy PID ≤ 1 (wzór `e2e/serwer.mjs`, reużycie `odpowiada` i `procesNaPorcie`
  z tego modułu). Stałe źródłowe: `DOMYSLNY_PORT = 5180`, `DOMYSLNA_APLIKACJA = 'http://localhost:5173'`.
- `start --smoke <plik> [--aplikacja <url>] [--port <n>]`: sprawdza smoke (IU-1, IU-2), cel lokalny, port (obcy proces = błąd
  z PID-em i komendą; nasza poprzednia instancja = stop i start), uruchamia `makieta.mjs serwer …` odłączony z logiem
  w katalogu stanu, czeka na odpowiedź serwera; wynik JSON: `link` (`http://127.0.0.1:<port>/__makieta/?t=<token>`), liczba
  punktów i ekranów, ekrany SPEC bez punktu, czy aplikacja odpowiada.
- `serwer` (wewnętrzne): proces serwera z IU-5 do sygnału.
- `stop`, `stan`: zatrzymanie i stan instancji projektu.
- `czekaj [--limit-min N]` (N ≤ `LIMIT_CZEKANIA_MIN` = 25): linie JSON `{"zdarzenie":"zgloszenie", punkt, ekran, trasa, viewport,
  urzadzenie, szerokosc, opis, spec, makieta}`, na końcu `{"zdarzenie":"limit"}`; serwer martwy = `{"zdarzenie":"serwer-zatrzymany"}`.
- `zgloszenia`: wszystkie otwarte zgłoszenia z checklisty (droga awaryjna).
- `poprawione --punkt <id> --commit <sha>`: adnotacja przez IU-3, czekanie do 60 s na `odpowiada(aplikacja)`, `POST /api/przeladuj`
  z tokenem; konflikt linii = kod 1 z treścią linii.
- `sprawdz --smoke <plik>`: `sprawdzFormat` z IU-1 + źródła z IU-2; punkty poza formatem R11 albo bez makiety = kod 1 z liniami.
- Nagłówek pliku „Uzycie” i kody 0/1/2/3 jak `smoke/zmienne.mjs`; stdout bez wartości env i tokenu poza polem `link` startu.

**Wzorce do naśladowania:**
- `.claude/scripts/e2e/serwer.mjs`
- `.claude/scripts/smoke/zmienne.mjs`

**Scenariusze testowe:**
- [Unit] `start` na katalogu tymczasowym z fixture'em daje link z tokenem, `stan` widzi proces, `stop` go kończy; `pgrep` po teście bez sierot
- [Unit] drugi `start` przejmuje własną instancję; port zajęty przez obcy proces = kod 1 z PID-em
- [Unit] `serwer.json` z PID 1 albo z PID innego procesu (inny czas startu) nie zabija niczego
- [Unit] `czekaj --limit-min` z krótkim limitem wypisuje zgłoszenie złożone przez API, potem `limit`; drugi `czekaj` go nie powtarza
- [Unit] `poprawione` zmienia status punktu i wysyła `przeladuj` (strona testowa odbiera SSE)
- [Unit] `sprawdz` na fixture etapu 4 wskazuje punkt z dwiema makietami; na smoke'u w formacie R11 = kod 0
- [Unit] `--aplikacja http://example.com` = kod 2

**Weryfikacja:**
- `node --test .claude/scripts/makieta/__tests__/makieta-cli.test.mjs` przechodzi
- `pnpm test` przechodzi w całości
- `pnpm typecheck` przechodzi bez błędów
- `pnpm lint` przechodzi bez błędów

### Faza 3 — Strona narzędzia, skill i smoke

**Zależy od:** Faza 2

- [x] **IU-7: Strona narzędzia — ramki urządzeń, makieta i decyzje**

**Cel:** Strona `/__makieta/` z ramkami aplikacji w presetach urządzeń po lewej, makietą 1:1 po prawej i przyciskami decyzji.

**Wymagania:** R2, R3, R4, R5, R6, R7, R8, R9

**Zależności:** IU-5

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `.claude/scripts/makieta/urzadzenia.mjs` | 0 → 70 | — | nowy |
| Stwórz | `.claude/scripts/makieta/strona/index.html` | — → — | — | nowy |
| Stwórz | `.claude/scripts/makieta/strona/styl.css` | — → — | — | nowy |
| Stwórz | `.claude/scripts/makieta/strona/strona.mjs` | 0 → 220 | — | nowy |
| Stwórz | `.claude/scripts/makieta/strona/ramki.mjs` | 0 → 140 | — | nowy |
| Test (unit) | `.claude/scripts/makieta/__tests__/urzadzenia.test.mjs` | 0 → 90 | — | nowy |
| Modyfikuj | `eslint.config.js` | 51 → 55 | — | zostaje |

**Delegate to:** feature-builder-ui

**Skills in play:** tailwind-react-guidelines, ux-ui-guidelines

**Podejście:**
- `urzadzenia.mjs` (czyste, wspólne ze stroną): `PRESETY` (źródło tutaj) i `domyslneUrzadzenia(makieta, etykietaPunktu)`
  według decyzji „Presety i reguła domyślna” (±24 px; bez trafienia: wymiar makiety plus `desktop-1440` przy ≥ 600 px albo
  etykiecie „Komputer”, inaczej `iphone-15`).
- `strona.mjs`: token z `?t=` do `sessionStorage` i usunięcie go z paska adresu; lista ekranów z `/api/punkty`; nagłówek ekranu
  z treścią punktu, statusem i trasą (pełna trasa z placeholderem jako podpowiedź); „Poprzedni” / „Następny” (także klawiszami
  strzałek poza polami tekstowymi); decyzje: „Zgodne”, „Odstępstwo OK” (pole notatki wymagane), „Zgłoś błąd” (opis, urządzenie
  i szerokość wybrane z ramek); 409 = komunikat i odświeżenie punktów; SSE `punkty` i `przeladuj`; punkt niejednoznaczny bez
  przycisków; ekrany SPEC bez punktu wymienione w nagłówku.
- `ramki.mjs`: ramki dla wybranych urządzeń (preset albo własny W×H), start na `trasaStartowa` albo `/`; wspólny pasek adresu
  dla wszystkich ramek; skalowanie `transform: scale` z wrapperem po skali i przełącznikiem „1:1”; „Przeładuj ramki”
  (`iframe.src` od nowa) i „Otwórz w karcie” (trasa w nowej karcie originu proxy — logowanie OAuth, decyzja „Logowanie OAuth
  w karcie”); wybór urządzeń w localStorage z `try/catch` i przyciskiem „Domyślne”.
- Makieta po prawej w skali 1:1 z przełącznikiem „Dopasuj do wysokości”; brak makiety = komunikat.
- Strona nie czyta tokenów aplikacji ani zawartości ramek; jedyna interakcja z ramką to `src` i przeładowanie.
- `eslint.config.js`: blok `files: ['.claude/scripts/makieta/strona/*.mjs']` z `globals.browser`.

**Teksty (verbatim):**
- Przyciski decyzji: „Zgodne”, „Odstępstwo OK”, „Zgłoś błąd”
- Pole notatki odstępstwa: „Co się różni i dlaczego to OK”
- Pole opisu błędu: „Co jest nie tak”
- Nawigacja: „Poprzedni”, „Następny”
- Ramki: „Przeładuj ramki”, „Otwórz w karcie”, „Domyślne”, „1:1”
- Makieta: „Dopasuj do wysokości”
- Statusy: „otwarty”, „zgodny”, „odstępstwo”, „błąd zgłoszony”, „poprawione, do sprawdzenia”
- Konflikt zapisu: „Sesja zmieniła ten punkt w międzyczasie — odświeżyłem go, oceń jeszcze raz.”
- Brak makiety: „Brak PNG makiety dla tego ekranu.”
- Punkt niejednoznaczny: „Ta sama treść punktu występuje w checkliście kilka razy — decyzję zapisz w sesji.”

**Wzorce do naśladowania:**
- `.claude/scripts/smoke/zmienne.mjs`

**Scenariusze testowe:**
- [Unit] makieta 390 px wybiera `iphone-15`, `iphone-se` i `pixel-8`; 1440 px wybiera `desktop-1440`
- [Unit] makieta 480 px z etykietą „Komputer” daje wymiar makiety i `desktop-1440`; 358 px daje wymiar makiety i `iphone-15`
- [Manual] strona na smoke'u etapu 4 w kopii vibersi: ramki trzech telefonów na `/konto/projekty`, makieta obok, „Następny” przechodzi przez wszystkie ekrany

**Weryfikacja:**
- `node --test .claude/scripts/makieta/__tests__/urzadzenia.test.mjs` przechodzi
- `pnpm typecheck` przechodzi bez błędów
- `pnpm lint` przechodzi bez błędów

- [x] **IU-8: Skill /makieta, smoke z dev-docs-complete i pilot**

**Cel:** Procedura sesji w skillu `/makieta`, format punktów wizualnych i odesłanie do narzędzia w generowanym smoke'u oraz pilot na kopii vibersi.

**Wymagania:** R1, R9, R11, R12

**Zależności:** IU-6, IU-7

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `.claude/skills/makieta/SKILL.md` | — → — | — | nowy |
| Modyfikuj | `.claude/skills/dev-docs-complete/SKILL.md` | — → — | — | zostaje |
| Modyfikuj | `.claude/workflows/dev-docs-complete-wf.js` | 283 → 292 | — | zostaje |
| Modyfikuj | `.claude/workflows/__tests__/start-koniec.test.mjs` | 268 → 290 | — | zostaje |
| Modyfikuj | `README.md` | — → — | — | zostaje |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- Skill `makieta` (`description` z frazami „odpalamy narzędzie makiet”, „makieta obok aplikacji”, „przejdźmy punkty wizualne”;
  `argument-hint: "[plik smoke'u] | stop | stan"`): (1) `start` z plikiem smoke'u bieżącej sesji i adresem aplikacji z sekcji
  „0. Przygotowanie”, link dla operatora; (2) Monitor na `node .claude/scripts/makieta/makieta.mjs czekaj --limit-min 25`
  (`LIMIT_CZEKANIA_MIN` = 25), po `limit` ponownie; (3) zgłoszenie: SPEC ekranu z pola `spec`, PNG tylko ścieżką — bez Read
  obrazu (kryterium sukcesu źródła); odtworzenie w aplikacji, poprawka z testem i commitem jak w ramce „Jak kontynuować”,
  przy zbudowanym serwerze przebudowa i restart; (4) `poprawione --punkt <id> --commit <sha>`; (5) operator mówi
  „zgłoszenia” albo zdarzenie nie przyszło → `makieta.mjs zgloszenia`; (6) przed `/clear` i na koniec smoke'u `stop`.
  Wymóg dla OAuth: `http://127.0.0.1:5180/**` (`DOMYSLNY_PORT` = 5180) w Redirect URLs Supabase dev; logowanie hasłem bez tego.
- `dev-docs-complete` krok 3 i `smokePrompt` (te same zdania w obu, test pilnuje): format punktu wizualnego R11 (decyzja
  „Format punktu wizualnego w smoke'u”: urządzenie, trasa w backtickach, jedna makieta, `(viewport W×H)` bez dwukropka,
  oczekiwany wynik); w smoke'u z punktami wizualnymi zdanie przed pierwszym z nich „Punkty wizualne przejdziesz narzędziem
  makiet: w sesji smoke'u wpisz /makieta.”; ramka „Jak kontynuować” dostaje zdanie „Przy punktach wizualnych uruchom /makieta,
  a przed /clear je zatrzymaj.” przed zdaniami o „Następny krok” (ramka nadal kończy się nimi — test B2).
- Kontrola po zapisie smoke'u w `smokePrompt`: `node .claude/scripts/makieta/makieta.mjs sprawdz --smoke <plik>`; kod 1 = popraw
  wskazane linie i uruchom ponownie (wzór kontroli `zmienne.mjs --smoke`); smoke bez punktów wizualnych = kod 0.
- README: `makieta/` na liście `.claude/scripts/` i wiersz skilla `makieta` w tabeli skilli.
- Prompt-audit dodanych linii skilla i promptu (`pa_dodane.py`, pliki nieśledzone po `git add -N`).

**Wzorce do naśladowania:**
- `.claude/skills/dev-pr/SKILL.md`
- `.claude/workflows/__tests__/start-koniec.test.mjs`

**Scenariusze testowe:**
- [Unit] `smokePrompt` i krok 3 skilla zawierają format punktu wizualnego, zdanie o /makieta i kontrolę `makieta.mjs sprawdz --smoke`
- [Unit] ramka „Jak kontynuować” nadal kończy się zdaniami o „Następny krok: /clear, potem /dev-pr --czesc 1”
- [Manual] pilot na kopii vibersi (zbudowany serwer z XFO na 5173, smoke etapu 4 z cofniętymi checkboxami): ramki ładują się mimo `X-Frame-Options: DENY`, logowanie hasłem raz obejmuje wszystkie ramki, zmiana konta po „Przeładuj ramki” obejmuje wszystkie
- [Manual] pilot: „Zgodne” i „Odstępstwo OK” zmieniają tylko linię punktu (`git diff` jednej linii), decyzja po edycji linii przez sesję daje komunikat konfliktu
- [Manual] pilot: „Zgłoś błąd” dociera do sesji przez Monitor w kilka sekund także wtedy, gdy sesja czeka na wiadomość; po `poprawione` ramki się przeładowują, a punkt ma status „poprawione, do sprawdzenia”
- [Manual] pilot na Vite dev: HMR przez proxy działa albo przeładowanie z `poprawione` wystarcza; wynik do HANDOFF

**Weryfikacja:**
- `node --test .claude/workflows/__tests__/start-koniec.test.mjs` przechodzi
- `node --test .claude/workflows/__tests__/odwolania.test.mjs` przechodzi
- `pnpm test` przechodzi w całości
- `grep -c "makieta.mjs sprawdz --smoke" .claude/workflows/dev-docs-complete-wf.js .claude/skills/dev-docs-complete/SKILL.md` daje co najmniej 1 w każdym pliku

**Operator checklist:**
- [ ] Wpis `http://127.0.0.1:5180/**` w Redirect URLs Supabase dev vibersi przed pilotem logowania OAuth
- [ ] Zgoda na merge `popr/P24-makieta-obok-aplikacji`, potem `/sync-template` w vibersi przed smoke'iem etapu 5

## Odchylenia przy wykonaniu (2026-10-20, HANDOFF 6a pkt 95)

- Trasa punktu: fragment w backtickach przed pierwszą makietą, nie przed pierwszym „obok” („obok” w opisie stanu gubiło trasę).
- Osadzanie: proxy nie zdejmuje zakazu, tylko zamienia go na `X-Frame-Options: SAMEORIGIN` i `frame-ancestors 'self'`
  (ramki są same-origin; obca strona nie osadzi aplikacji z sesją operatora). Proxy odrzuca też Host spoza originu narzędzia.
- Presety: makieta niższa niż połowa najniższego presetu pasującego szerokością to komponent — wtedy „bez trafienia”
  (358×234 mieści się w ±24 od iphone-se 375, a decyzja wymieniała ją jako komponent bez trafienia).
- Moduł wspólny ze stroną leży pod `/__makieta/urzadzenia.mjs`; `punkty.mjs` nie jest podawany stronie (statusy z API).

## Wpływ systemowy

- **Graf interakcji:** operator (przeglądarka) ↔ serwer narzędzia (proxy + API) ↔ aplikacja projektu; serwer ↔ plik smoke'u
  (zapis linii, obserwacja); serwer → kolejka → `czekaj` w Monitorze → sesja smoke'u → poprawka → `poprawione` → serwer → SSE →
  strona. Sesja i narzędzie piszą do tego samego pliku — rozdzielają je kontrola linii (narzędzie) i odmowa Edit (sesja).
- **Propagacja błędów:** aplikacja nie działa = 502 w ramkach, narzędzie żyje; serwer martwy = `czekaj` zwraca
  `serwer-zatrzymany`, sesja proponuje `start`; konflikt linii = komunikat na stronie, nic nie ginie.
- **Cykl życia stanu:** stan decyzji wyłącznie w checkliście (przeżywa restart narzędzia, `/clear`, archiwizację); kolejka
  i `serwer.json` w `$TMPDIR` to tylko dostarczanie i proces.
- **Pipeline:** `dev-docs-complete` dostaje regułę formatu i kontrolę `sprawdz`; tester E2E, scribe i `visual-diff/` bez zmian.
  Poprawki ze smoke'u dalej wylicza `pr/po-archiwum.mjs` (P22 B4).
- **Projekty:** narzędzie przychodzi z `/sync-template`, bez zależności npm i bez zmian w kodzie aplikacji; jedyny wymóg
  zewnętrzny to wpis Redirect URLs dla OAuth.

## Ryzyka i zależności

- **Monitor nie budzi czekającej sesji** → zgłoszenie dociera dopiero przy następnej wiadomości operatora; łagodzenie: zapis
  w checkliście (R9b) i `zgloszenia`; pilot rozstrzyga i wynik idzie do HANDOFF.
- **Aplikacja z innymi zakazami osadzania** (np. `frame-ancestors` w `<meta>` — nieobsługiwane przez przeglądarki, albo
  skrypt „frame-busting”) → ramka ucieka do góry; łagodzenie: obserwacja w pilocie, poza zakresem MVP.
- **HMR Vite przez proxy** → bez `upgrade` HMR łączy się wprost z Vite; test w IU-4 i pilot.
- **Bezpieczeństwo proxy:** narzędzie zdejmuje ochronę przed clickjackingiem dla originu proxy — tylko `127.0.0.1`, tylko cel
  lokalny, token na API; recenzja security w IU-4 i IU-5.
- **Wyścig zapisu z Edit sesji** w oknie między porównaniem a `rename` — bardzo krótkie; Edit sesji odmawia przy zmianie,
  a strona pokaże stan z pliku po SSE `punkty`.
- **Zależność kolejności:** IU-1 → IU-2, IU-3 → IU-5 → IU-6, IU-7 → IU-8; IU-4 niezależna od fazy 1, ale w fazie 2.

## Dokumentacja / Notatki operacyjne

- README: katalog `makieta/` i skill `makieta`.
- HANDOFF 6a: wpis P24 z wynikiem pilota (Monitor przy czekającej sesji, `/clear`, HMR, OAuth) i §8 (merge za zgodą, `/sync-template`
  w vibersi przed smoke'iem etapu 5).

## Źródła i referencje

- **Dokument źródłowy:** docs/brainstorms/2026-10-19-makieta-obok-aplikacji-requirements.md
- HANDOFF: `docs/reviews/2026-09-19-analiza-pipeline/HANDOFF.md` 6a pkt 91 poz. 7, pkt 92–94, §7
- Smoke etapu 4 vibersi: `../vibersi/docs/operator/2026-10-18-etap-4-dodawanie-i-moderacja-smoke.md`
- Plan etapu 4 vibersi: `../vibersi/docs/plans/2026-10-17-001-feat-etap-4-dodawanie-i-moderacja-plan.md`
- Powiązany kod: `.claude/scripts/e2e/serwer.mjs`, `.claude/scripts/smoke/zmienne.mjs`, `.claude/scripts/pr/czekaj-na-bota.mjs`,
  `.claude/scripts/plan/plan-techniczny.mjs`, `.claude/workflows/dev-docs-complete-wf.js`
- Node http upgrade, RFC 9110 §7.6.1, Vite server options, MDN frame-ancestors, Supabase Redirect URLs, Claude Code Monitor

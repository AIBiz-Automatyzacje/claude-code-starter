export const meta = {
  name: 'dev-docs-execute-wf',
  description: 'Wykonanie jednej fazy zadania: buildery per IU, walidacja, commit.',
  whenToUse: 'Wolany przez dev-autopilot-wf; standalone: args {sciezka, faza}.',
  phases: [
    { title: 'Plan IU', detail: 'wczytaj plan techniczny, zbuduj prompty builderow' },
    { title: 'Build', detail: 'jeden builder per Implementation Unit' },
    { title: 'Domkniecie', detail: 'walidacja, commit, aktualizacja docs' },
  ],
}

// Kopia stalej z dev-autopilot-wf.js (workflowy sa self-contained — przy zmianie synchronizuj recznie).
// Doklejana W JS do prompta KAZDEGO buildera i domkniecia — nie polegamy na tym, ze planner ja przekopiuje.
const BLOK_DLUGIE_KOMENDY = `
=== DLUGIE KOMENDY (przeczytaj ZANIM uruchomisz testy/buildy — prawa srodowiska, nie sugestie) ===
(1) Runtime zabija subagenta po ~180s bez zadnego outputu ("agent stalled"); po 6 killach pada CALY run.
(2) Pojedyncze foreground Bash ma limit 600s (domyslnie 120s) — dluzszej komendy NIE dokonczysz.
(3) Zimny vitest po inwalidacji cache (Vite optimizeDeps / zmiana zaleznosci lub configu) potrafi MILCZEC
    przez faze transform/prebundle PRZED pierwszym outputem reportera — cisza to nie zwis; zaden reporter nie pomaga.
REGULY:
- Komenda mogaca trwac >100s (vitest po zmianie zaleznosci/configu, pelny suite, build): uruchom przez
  Bash z run_in_background i przekierowaniem do pliku logu, potem POLLUJ krotkim Bash co ~45-60s
  (tail loga / sprawdzenie procesu) az do zakonczenia. Kazda sonda = znak zycia dla watchdoga.
- NIGDY nie podnos timeoutu foreground zamiast isc w tlo — 180s ciszy zabija CIEBIE, nie komende.
- Po zmianie package.json / lockfile / vite.config / vitest.config przez kogokolwiek w tym runie: pierwszy vitest
  traktuj jako ZIMNY (pelna procedura tla powyzej).
- vitest uruchamiaj z --reporter=dot: strumieniowany stdout W TRAKCIE foreground Bash resetuje watchdog,
  wiec chroni WARM suite'y w oknie 180-600s.
  NIE chroni: zimnego cache (transform milczy do konca) ani komend >600s (twardy limit Bash).
- FLAKE INFRA: gdy pelny suite zglosi na pliku blad infrastruktury workera ([vitest-worker]: Timeout
  calling "fetch", "Timeout calling", worker terminated, ENOMEM, heap out of memory) — re-runuj TEN plik
  w izolacji (procedura OSOBNO dla kazdego takiego pliku). PASS w izolacji = flake infra, NIE defekt:
  odnotuj "flake-infra: <plik> (PASS w izolacji)" i NIE traktuj jako FAIL. FAIL w izolacji = realny defekt.
  Po obsludze flake'ow DOKONCZ przerwany lancuch walidacji (kolejne kroki, np. build).
=== KONIEC BLOKU DLUGICH KOMEND ===`

// ── Schematy ──────────────────────────────────────────────────────────────

const IU_PLAN = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fazaNumer: { type: 'integer' },
    fazaNazwa: { type: 'string' },
    strategia: { type: 'string', enum: ['serial', 'parallel'], description: 'serial gdy IU maja zaleznosci/wspolne pliki; parallel gdy niezalezne' },
    poza: { type: 'boolean', description: 'true gdy faza juz ukonczona / nic do zrobienia' },
    baza: { type: 'string', description: 'pelny SHA z `git rev-parse HEAD` przed faza — od niego bramki domkniecia licza zmiany fazy' },
    iu: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          nazwa: { type: 'string' },
          agentType: {
            type: 'string',
            enum: ['feature-builder-ui', 'feature-builder-data', 'feature-builder-fullstack', 'feature-builder-ui-figma', 'feature-builder-fullstack-figma'],
          },
          prompt: { type: 'string', description: 'KOMPLETNY blok IU gotowy do wyslania builderowi (Cel, Wymagania, Pliki, Podejscie, Wzorce, Scenariusze testowe, Weryfikacja) + sciezka zadania + numer IU + doklejony designerski kontekst gdy UI/fullstack' },
        },
        required: ['id', 'nazwa', 'agentType', 'prompt'],
      },
    },
  },
  required: ['fazaNumer', 'strategia', 'poza', 'baza', 'iu'],
}

const BUILD_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['completed', 'partial', 'blocked'] },
    pliki: { type: 'array', items: { type: 'string' } },
    odchylenia: { type: 'array', items: { type: 'string' } },
    nastepneKroki: { type: ['string', 'null'] },
    pytanie: { type: ['string', 'null'], description: 'wypelnione gdy status=blocked' },
  },
  required: ['id', 'status'],
}

// Bramki domkniecia (PLAN-POPRAWY P6): kolejnosc i nazwy jak w kolejce .claude/scripts/bramki/bramki.mjs.
const NAZWY_BRAMEK = ['typecheck', 'eslint', 'testyTypow', 'knip', 'sizeLimit', 'migracje', 'migracjeSuma', 'advisors', 'testyUsuniete', 'stryker']
const STATUS_BRAMKI = { type: 'string', enum: ['ok', 'porazka', 'brak', 'blad', 'pominieta'] }
const WYNIK_BRAMKI = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: STATUS_BRAMKI,
    sekundy: { type: ['number', 'null'] },
    trafienia: { type: 'integer', description: 'liczba trafien' },
    poNaprawie: { type: ['string', 'null'], enum: [...STATUS_BRAMKI.enum, null] },
  },
  required: ['status', 'sekundy', 'trafienia'],
}
// Dossier fazy dla review (PLAN-POPRAWY P7) — kopia schematu KONTEKST z dev-docs-review-wf.js (workflowy sa self-contained;
// zgodnosc pilnuje domkniecie-bramki.test.mjs). Review liczy z niego routing reviewerow bez agenta context-packagera.
const DOSSIER = {
  type: ['object', 'null'],
  description: 'wynik JSON skryptu dossier 1:1; null gdy skrypt padl',
  additionalProperties: false,
  properties: {
    diffStat: { type: 'string', description: 'liczba plikow i linii fazy, np. "4 plikow, +12 −3"' },
    pliki: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plik: { type: 'string' },
          czegoDotyczy: { type: 'string', description: 'status pliku i liczby linii, np. "dodany (+12)"' },
        },
        required: ['plik', 'czegoDotyczy'],
      },
    },
    warstwy: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ui: { type: 'boolean', description: 'faza tyka warstwy prezentacji: komponenty, style, HTML, szablony, public/' },
        dane: { type: 'boolean', description: 'faza tyka danych/IO: SQL, migracje, zapytania, fetch/HTTP, cache, petle po rekordach, praca na plikach' },
        typowanie: { type: 'boolean', description: 'w diffie sa pliki .ts/.tsx ALBO projekt ma tsconfig.json (statyczne typowanie w gre)' },
        nowyModul: { type: 'boolean', description: 'faza dodaje nowy modul/plik zrodlowy albo przesuwa granice warstw (nie: edycja istniejacego pliku)' },
      },
      required: ['ui', 'dane', 'typowanie', 'nowyModul'],
    },
    e2eCheckboxy: { type: 'integer', description: 'liczba NIEZAZNACZONYCH checkboxow [E2E] tej fazy (prefiksy Test: ORAZ Weryfikacja:) wymagajacych przegladarki/agent-browser (0 gdy brak)' },
    figmaScreens: { type: 'boolean', description: 'czy plik kontekstu zadania ma niepuste pole figma_screens (mapa ekran -> mockup) — tester robi wtedy visual diff nawet bez checkboxow [E2E]' },
    diffPlik: { type: 'string', description: 'sciezka zrzutu diffu fazy (pusty string gdy zrzut sie nie udal)' },
    ctxPlik: { type: 'string', description: 'sciezka dossier fazy (pusty string gdy zapis sie nie udal)' },
    ctxZapisany: { type: 'boolean', description: 'true tylko gdy dossier realnie powstalo i jest niepuste' },
    ctxZnaki: { type: 'integer', description: 'liczba znakow dossier fazy (telemetria: faza.dossier_zn)' },
    preSkan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          wzorzec: { type: 'string', enum: ['pusty-catch', 'then-bez-catch'] },
          plik: { type: 'string', description: 'plik:linia' },
        },
        required: ['wzorzec', 'plik'],
      },
      description: 'mechaniczne trafienia w DODANYCH liniach diffu fazy (pusty catch, .then bez .catch w tym samym pliku)',
    },
    diffZapisany: { type: 'boolean', description: 'true tylko gdy plik zrzutu realnie powstal i jest niepusty' },
    diffUciety: { type: 'boolean', description: 'true gdy zrzut przekroczyl limit i zostal przyciety ze znacznikiem' },
  },
  required: ['pliki', 'warstwy', 'e2eCheckboxy'],
}

const EXECUTE_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fazaNumer: { type: 'integer' },
    status: { type: 'string', enum: ['completed', 'partial', 'blocked'] },
    iu: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          nazwa: { type: 'string' },
          subagent: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['id', 'status'],
      },
    },
    commity: { type: 'array', items: { type: 'string' } },
    testy: { type: 'string', description: 'PASS/FAIL z liczbami lub "brak"' },
    odchylenia: { type: 'array', items: { type: 'string' } },
    problem: { type: ['string', 'null'] },
    bramki: {
      type: 'object',
      additionalProperties: false,
      description: 'pierwszy przebieg skryptu bramek; poNaprawie = status z przebiegu po naprawie (null gdy nie bylo)',
      properties: Object.fromEntries(NAZWY_BRAMEK.map((n) => [n, WYNIK_BRAMKI])),
    },
    testyUsuniete: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { plik: { type: 'string' }, nazwa: { type: 'string' }, uzasadnienie: { type: 'string' } },
        required: ['plik', 'nazwa', 'uzasadnienie'],
      },
    },
    dossier: DOSSIER,
    stanZapisany: { type: ['boolean', 'null'], description: 'true po zapisie pliku stanu i odczycie z wynikiem JSON-OK' },
  },
  required: ['fazaNumer', 'status', 'iu', 'stanZapisany'],
}

// ── Buildery promptow ──────────────────────────────────────────────────────

function plannerPrompt(sciezka, faza) {
  return `Jestes plannerem fazy implementacji. Zbuduj liste Implementation Units gotowych do delegacji.

Folder zadania: ${sciezka}
Faza do wykonania: ${faza}

0. \`git rev-parse HEAD\` -> pole baza (pelny SHA). To commit sprzed fazy: bramki domkniecia licza od niego zmiany fazy.
1. CZYTAJ WYCINKAMI, NIE CALYMI PLIKAMI. Cztery dokumenty tego zadania to lacznie 120-175 KB, a plik
   zadan rosnie w trakcie jednego zadania z 23 KB do 59 KB (sekcje "Do poprawy po review") i jest czytany
   przy KAZDEJ fazie. Do zbudowania jednostek fazy ${faza} potrzebujesz pieciu wycinkow. Kazdy bierz
   przez \`grep -n\` naglowka, a potem \`Read\` z \`offset\` i \`limit\` — nigdy nie ladujesz calego pliku:
   - z \`${sciezka}/*-plan.md\`: tabela \`## Fazy\` i sekcja \`## Zrodla\` (stamtad masz sciezke planu technicznego),
   - z \`${sciezka}/*-zadania.md\`: blok od \`## Faza ${faza}\` do NASTEPNEGO naglowka tego samego poziomu,
   - z \`${sciezka}/*-kontekst.md\`: sekcja \`## Designerski kontekst\`,
   - z planu technicznego w \`docs/plans/\`: sekcja \`### Faza ${faza}\` (tam sa Implementation Units tej fazy),
   - z planu technicznego: sekcja zaczynajaca sie od \`## Granice\` (wykluczenia zadania), jesli plan ja ma.
   Po wiecej siegaj TYLKO wtedy, gdy jednostka odsyla do czegos, czego w tych wycinkach nie ma
   (np. decyzja opisana przy innej fazie). Nie czytaj dokumentow "dla kontekstu".
1b. Przeczytaj .claude/rules/learned-patterns.md (jesli istnieje) — reguly wyprodukowane z problemow
   rozwiazanych w poprzednich zadaniach tego projektu. Ten plik czytasz w CALOSCI (ok. 11 KB): reguly
   istotne dla danego IU DOPISZ do jego promptu (sekcja "Wyuczone reguly projektu:") — buildery nie maja
   gwarancji dostepu do project rules.
2. W sekcji \`### Faza ${faza}\` planu technicznego zlokalizuj Implementation Units tej fazy.
3. Jesli faza ${faza} jest juz ukonczona albo nie ma niezaznaczonych checkboxow IMPLEMENTACYJNYCH -> ustaw poza=true, iu=[].
   Do ukonczenia NIE licza sie (pomijaj calkowicie): checkboxy z prefiksem "Weryfikacja:", "Operator:",
   oznaczone "[E2E]"/"[Manual]", oraz wszystkie checkboxy w sekcjach "## Do poprawy po review fazy N"
   i "## Operator checklist faza N" (obsluguje je review/fix, nie buildery).
4. Wybierz strategie: serial (IU zalezne / wspolne pliki) lub parallel (IU niezalezne).
   Jesli ktorykolwiek IU dodaje nowa zaleznosc (biblioteka, config vite/vitest) — preferuj serial:
   rownolegle zimne vitesty po inwalidacji cache duplikuja ~16-min prace i ryzykuja watchdog-kill.
5. Dla kazdego IU zbuduj KOMPLETNY prompt builderowi:
   - caly blok IU doslownie (Cel, Wymagania, Pliki, Podejscie, Teksty (verbatim), Wzorce, Scenariusze testowe, Weryfikacja)
   - DOMKNIJ ODWOLANIA DO DECYZJI. Builder pracuje w OSOBNYM kontekscie i nie widzi planu: odwolanie
     w rodzaju "straznik regresji D2" albo "zgodnie z decyzja D7" jest dla niego pustym stringiem.
     Dla KAZDEGO takiego odwolania w jednostce znajdz jego definicje w sekcji kluczowych decyzji planu
     technicznego i SKOPIUJ ja do promptu jako blok "Decyzje przywolane przez to IU:" (identyfikator + tresc).
     Udokumentowany skutek pominiecia: builder fazy 6 sam wyszukiwal plik checklisty i zostawil o tym
     komentarz w kodzie (cta-section.ts:26) — robil prace plannera, w polowie slepo.
     Podobnie z tekstami: gdy jednostka odsyla do "tekstow verbatim z sekcji X", wklej te teksty DOSLOWNIE.
     Nie streszczaj i nie parafrazuj — tekst widoczny dla uzytkownika inny niz zatwierdzony to finding P2.
   - sciezka zadania ${sciezka} + numer IU
   - wykluczenia z sekcji \`## Granice\` planu technicznego jako blok "Czego zadanie nie obejmuje:" z dopiskiem:
     "Niczego z tej listy nie implementuj, nawet gdy wyglada na przydatne. Gdy jednostka wymaga takiej pracy,
     zwroc status blocked i w polu pytanie nazwij te prace." Plan bez tej sekcji — blok pomin.
   - dla feature-builder-ui|fullstack (takze wariantow -figma): gdy sekcja "Designerski kontekst" w ${sciezka}/*-kontekst.md istnieje
     i ma choc jedna niepusta sciezke, doklej blok (sciezki z tej sekcji):
       ## Mandatory designerski kontekst (przeczytaj przed implementacja)
       - DESIGN.md (tokeny calego projektu): <sciezka z design_md albo "brak — bazuj na ux-ui-guidelines">
       - SPEC.md (pomiary tej funkcji z Figmy): <sciezka z figma_spec albo "brak — projektujesz w oparciu o DESIGN.md">
       - Screeny referencyjne (PNG): <nazwa>: <sciezka>, jedna linia na screen
       Te pliki sa zrodlem prawdy o designie, od najbardziej konkretnego: SPEC.md > DESIGN.md > ux-ui-guidelines.
       Gdy SPEC.md nie ma potrzebnego pomiaru, pobierz go z Figmy przez mcp__plugin_figma_figma__get_design_context
       (fileKey i nodeId z naglowka SPEC.md). Wymiarow nie zgadujesz.
     Sekcji brak albo wszystkie pola puste/null — blok pomin. Dla feature-builder-data blok pomijasz zawsze.
   - NIE kopiuj "Skills in play:" — skille sa wstrzykiwane z frontmatter subagenta.
   - agentType = wartosc pola "Delegate to:" z IU. IU bez tego pola (plan starszy niz delegacja) — dobierz
     agentType po plikach jednostki: tylko warstwa danych -> feature-builder-data, tylko UI -> feature-builder-ui,
     obie -> feature-builder-fullstack.
     Gdy sekcja "Designerski kontekst" ma niepuste figma_spec albo figma_screens, builder UI i fullstack bierzesz
     w wariancie z Figma: feature-builder-ui-figma, feature-builder-fullstack-figma (tylko one maja narzedzia Figma MCP).
   DOPISZ DOSLOWNIE na koncu promptu KAZDEGO IU blok "Wymagania wykonania":
   "Wymagania wykonania: zaimplementuj kod dla checkboxow implementacyjnych (POMIJAJ: Weryfikacja:,
   Operator:, [E2E], [Manual] — to dla review/operatora). Testy dla checkboxow Test: pisz RAZEM z kodem.
   Jesli dodajesz zaleznosc (bun add / npm install) — odnotuj to w odchyleniach."
   (Regul srodowiska dot. dlugich komend NIE kopiuj — orkiestrator dokleja je automatycznie.)

Zwroc obiekt zgodny ze schematem IUPlan. Sam nie implementuj kodu.`
}

// Baza fazy dla bramek domkniecia: SHA z plannera (HEAD przed builderami). Bez poprawnego SHA — HEAD domkniecia:
// buildery nie commituja, wiec zmiany fazy i tak sa w drzewie roboczym. Wartosc trafia do komendy powloki.
function bazaFazy(plan) {
  return /^[0-9a-f]{7,40}$/.test(plan.baza || '') ? plan.baza : 'HEAD'
}

// Stan zadania po execute (P7): autopilot podaje go w args.stanPoExecute, JS wstawia baze fazy, domkniecie zapisuje plik.
// Baza w stanie pozwala odtworzyc dossier fazy po STOP-ie miedzy execute a review (args.baza review-wf).
function stanZBaza(tresc, faza, baza) {
  const stan = JSON.parse(tresc)
  const sha = /^[0-9a-f]{7,40}$/.test(baza) ? baza : null
  return JSON.stringify({ ...stan, fazy: stan.fazy.map((f) => (f.numer === faza ? { ...f, baza: sha } : f)) }, null, 2)
}

// Kopia blokZapisuStanu z dev-autopilot-wf.js (workflow nie importuje modulow; zgodnosc pilnuje stan-fazy.test.mjs).
function blokZapisuStanu(sciezka, tresc) {
  const plik = `${sciezka}/.autopilot-state.json`
  return `Zapis stanu pipeline'u:
a) Narzedziem Write zapisz plik ${plik} (pelne nadpisanie) z trescia miedzy znacznikami, bez znacznikow
   i bez zmian w tresci.
b) Odczytaj plik z dysku: \`node -e "JSON.parse(require('fs').readFileSync('${plik}','utf8'));console.log('JSON-OK')"\`.
   Bez wyniku JSON-OK zapisz plik jeszcze raz i powtorz odczyt.
c) Pole stanZapisany w wyniku: true po odczycie z wynikiem JSON-OK, w kazdym innym przypadku false.
Z tego pliku pipeline wznawia fazy po zatrzymaniu, dlatego tresc idzie na dysk bajt w bajt.
--- POCZATEK STANU ---
${tresc}
--- KONIEC STANU ---`
}

function punktZapisuStanu(sciezka, faza, baza, stanPoExecute) {
  if (!stanPoExecute) return ''
  return `\n\nZAPIS STANU (po punkcie 6), gdy zwracasz status=completed; przy innym statusie pomin go i zwroc stanZapisany=false.
${blokZapisuStanu(sciezka, stanZBaza(stanPoExecute, faza, baza))}`
}

// Wynik bramek w pliku artefaktow fazy (wzor nazwy jak w .claude/scripts/dossier/sciezki.mjs): kazdy przebieg bramek go
// nadpisuje, wiec skrypt dossier bierze ostatni — kod po naprawie, ktory ogladaja reviewerzy.
function plikBramek(sciezka, faza) {
  return `/tmp/bramki-${String(sciezka).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-faza-${faza}.json`
}

function domknieciePrompt(sciezka, faza, buildResults, baza, plikBramek) {
  const podsumowanieIU = buildResults
    .map((b) => `- ${b.id}: ${b.status}${b.odchylenia && b.odchylenia.length ? ` (odchylenia: ${b.odchylenia.join('; ')})` : ''}`)
    .join('\n')
  return `Jestes domknieciem fazy implementacji. Buildery skonczyly — zwaliduj i utrwal.

Folder zadania: ${sciezka}
Faza: ${faza}

Raporty builderow:
${podsumowanieIU}

1. System-Wide Test Check: typecheck bez nowych bledow,
   istniejace testy przechodza, nowe testy pokrywaja happy path + error case, checkboxy "Test:" napisane i przechodza,
   importy nie lamia modulow, build (vite build) przechodzi. Komendy z package.json.
   Checkbox "Test:" tej fazy bez napisanego testu — napisz ten test przed zamknieciem fazy ("Test: [E2E]" pomijasz,
   patrz punkt 2). Kazde sprawdzenie z odpowiedzia "nie" naprawiasz przed commitem.
   UWAGA: jesli ktorykolwiek builder raportowal dodanie zaleznosci — pierwszy vitest jest ZIMNY (procedura tla z bloku).
1a. BRAMKI MECHANICZNE (po punkcie 1, przed commitem — skrypt czyta drzewo robocze):
   \`node .claude/scripts/bramki/bramki.mjs --baza ${baza} > ${plikBramek}; echo "kod: $?"\`, potem Read ${plikBramek}.
   Kod 0 = bez porazek, 1 = sa porazki. Wynik (JSON w pliku): {bramka: {status, sekundy, trafienia: [{plik, linia, regula,
   opis}], powod?, ostrzezenia?, zastane?}}. Status: ok | porazka | brak | blad | pominieta.
   - porazka: napraw KAZDE trafienie w kodzie — regula i plik:linia mowia, co poprawic. Lista bramek jest kompletna:
     Nie uruchamiaj ESLint, tsc ani knipa osobno i nie szukaj innych uwag lintera. Nie wylaczasz reguly (eslint-disable,
     zmiana konfiguracji narzedzia) — poprawiasz kod. Trafienie bramki migracje albo migracjeSuma: przywroc plik
     (\`git checkout ${baza} -- <plik>\`), a zmiane schematu zapisz NOWA migracja.
   - Po naprawie uruchom bramki jeszcze raz ta sama komenda. Porazka w drugim przebiegu: status=partial, w problem nazwa bramki i trafienia.
   - blad: narzedzie padlo — powod do odchylen, narzedzia nie naprawiasz. brak, pominieta: nic nie robisz.
   - Pole bramki: dla kazdej bramki z PIERWSZEGO przebiegu {status, sekundy, trafienia: liczba trafien}, poNaprawie =
     status z drugiego przebiegu (null, gdy drugiego nie bylo).
   - ostrzezenia bramki eslint i trafienia bramki stryker zostawiasz bez naprawy — review fazy dostaje
     je w dossier (punkt 6).
   - Kazde trafienie bramki testyUsuniete przepisz do pola testyUsuniete z uzasadnieniem (funkcja usunieta w tej fazie
     albo nowa nazwa testu). Test usuniety bez usuniecia testowanej funkcji przywroc.
   - Na koniec \`node .claude/scripts/bramki/bramki.mjs --dopisz-sume\` — dopisuje nowe migracje do supabase/migrations.sum
     (plik commitujesz razem z migracjami).
1b. AUDYT ERROR-HANDLINGU (przed commitem — hooki sesyjne nie widza zmian commitowanych przez workflow):
   przejrzyj git diff tej fazy pod katem: (a) console.log/console.error w kodzie PRODUKCYJNYM
   (testy i skrypty narzedziowe sa OK) — zamien na structured logging lub Sentry; (b) bloki catch
   bez raportowania — dodaj Sentry captureError/captureException lub re-throw (zakaz pustych catch).
   Znaleziska NAPRAW przed commitem, nie odnotowuj "do zrobienia".
${BLOK_DLUGIE_KOMENDY}
2. Aktualizuj ${sciezka}/*-zadania.md: oznacz ukonczone checkboxy [x] (NIE ruszaj "Weryfikacja:" ANI zadnego
   checkboxa z markerem [E2E]/[Manual] — "Test: [E2E]" to URUCHOMIENIE flow przez testera review, nie jego
   napisanie; odznacza go scribe review po PASS w przegladarce. Napisany seed e2e/seeds/*.sql odhaczasz WYLACZNIE
   w checkboxie implementacyjnym "Stwórz (e2e seed):").
3. Aktualizuj ${sciezka}/*-kontekst.md: zmiany i decyzje tej fazy dopisz do sekcji \`## Dziennik\`
   (jedna sekcja, chronologicznie) plus "Ostatnia aktualizacja". NIE zakladaj w tym pliku sekcji
   "Decyzje techniczne", "Kluczowe pliki", "Odroczone do implementacji" ani "Wzorce do nasladowania" —
   te tresci zyja w planie technicznym, a kopia w pliku kontekstu rozjezdza sie z nim. Decyzja korygujaca plan idzie
   do planu technicznego w docs/plans/ (punkt 4), a w Dzienniku zostaje jedno zdanie i wskaznik.
4. Aktualizuj plan techniczny w docs/plans/ (odznacz test scenarios / verification dla tej fazy).
5. Commit inkrementalny: feat/fix/refactor([nazwa]): [co i dlaczego]. Staguj tylko zmienione pliki (nie git add .).
6. DOSSIER FAZY (po commicie):
   \`node .claude/scripts/dossier/dossier.mjs --sciezka ${sciezka} --faza ${faza}${baza === 'HEAD' ? '' : ` --baza ${baza}`} --bramki ${plikBramek}\`
   Wynik (JSON na stdout) przepisz 1:1 do pola dossier. Kod wyjscia inny niz 0: dossier = null, stderr do odchylen —
   status fazy od tego nie zalezy.

Dzialaj autonomicznie. Zwroc obiekt zgodny ze schematem ExecuteResult
(status=completed tylko gdy walidacja PASS, zadna bramka nie konczy sie porazka i wszystkie IU completed).`
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

const sciezka = args && args.sciezka
const faza = args && args.faza
if (!sciezka || faza === undefined) {
  return { fazaNumer: -1, status: 'blocked', iu: [], problem: 'brak args {sciezka, faza}' }
}

phase('Plan IU')
const plan = await agent(plannerPrompt(sciezka, faza), { schema: IU_PLAN, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `planner:faza-${faza}` })

// Null-guard: planner zabity/blad -> kontrolowany blocked zamiast TypeError (ktory wykoleilby caly autopilot).
if (!plan) {
  return { fazaNumer: faza, status: 'blocked', iu: [], commity: [], testy: 'n/a', odchylenia: [], problem: 'planner zwrocil null (agent padl lub zostal pominiety)' }
}

if (plan.poza || plan.iu.length === 0) {
  return { fazaNumer: faza, status: 'completed', iu: [], commity: [], testy: 'brak', odchylenia: [], problem: null }
}

phase('Build')
// BLOK doklejany deterministycznie w JS — kazdy builder dostaje prawa srodowiska niezaleznie od plannera.
const promptIU = (iu) => `${iu.prompt}\n${BLOK_DLUGIE_KOMENDY}`
let builds
if (plan.strategia === 'parallel') {
  // IU niezalezne — wszystkie buildery rownolegle (bariera, czekamy na komplet)
  builds = await parallel(
    plan.iu.map((iu) => () =>
      agent(promptIU(iu), { schema: BUILD_RESULT, agentType: iu.agentType, effort: 'high', label: `build:${iu.id}`, phase: 'Build' })
    )
  )
} else {
  // serial — IU zalezne / wspolne pliki, kolejnosc ma znaczenie
  builds = []
  for (const iu of plan.iu) {
    const r = await agent(promptIU(iu), { schema: BUILD_RESULT, agentType: iu.agentType, effort: 'high', label: `build:${iu.id}`, phase: 'Build' })
    builds.push(r)
    // null (builder zabity/blad) traktuj jak blocked — kolejne IU moga zalezec od tego
    if (!r || r.status === 'blocked') break
  }
}

const buildResults = builds.filter(Boolean)
// Najpierw blocked (niesie pytanie blokera), potem guard kompletnosci.
const zablokowany = buildResults.find((b) => b.status === 'blocked')
if (zablokowany) {
  return {
    fazaNumer: faza,
    status: 'blocked',
    iu: buildResults.map((b) => ({ id: b.id, status: b.status })),
    commity: [],
    testy: 'n/a',
    odchylenia: [],
    problem: zablokowany.pytanie || `IU ${zablokowany.id} zablokowany`,
  }
}
// Guard: builder zabity przez runtime znika jako null — IU nie moze zniknac bezslednie.
if (buildResults.length !== plan.iu.length) {
  const zwrocone = new Set(buildResults.map((b) => b.id))
  const brakujace = plan.iu.filter((iu) => !zwrocone.has(iu.id)).map((iu) => iu.id)
  return {
    fazaNumer: faza,
    status: 'partial',
    iu: plan.iu.map((iu) => ({ id: iu.id, nazwa: iu.nazwa, status: zwrocone.has(iu.id) ? 'completed' : 'brak wyniku (kill/blad)' })),
    commity: [],
    testy: 'n/a',
    odchylenia: [],
    problem: `builder(y) bez wyniku: ${brakujace.join(', ')} — IU niewykonane lub niezweryfikowane`,
  }
}

phase('Domkniecie')
const wynik = await agent(domknieciePrompt(sciezka, faza, buildResults, bazaFazy(plan), plikBramek(sciezka, faza)) + punktZapisuStanu(sciezka, faza, bazaFazy(plan), args.stanPoExecute), { schema: EXECUTE_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `domkniecie:faza-${faza}` })
// Baza fazy z JS (P7): autopilot utrwala ja w stanie i podaje review-wf jako args.baza.
return wynik && { ...wynik, baza: bazaFazy(plan) === 'HEAD' ? null : bazaFazy(plan) }

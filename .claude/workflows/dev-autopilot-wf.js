export const meta = {
  name: 'dev-autopilot-wf',
  description: 'Autonomiczny pipeline calego zadania z docs/active/: fazy (execute, review, fix), potem compound i complete.',
  whenToUse: 'Wykonanie calego planu zadania z docs/active/. Git zwaliduj w sesji PRZED odpaleniem (workflow nie pyta o branch switch). DWA tryby wznowienia: (1) po AWARII runu (crash/kill w polowie) -> Workflow({scriptPath, resumeFromRunId}) + ZAWSZE te same args (args nie przezywa miedzy wywolaniami) — cache journala odtworzy ukonczone kroki; (2) po STOP bramki (srodowisko E2E, fix FAIL, nierozwiazane P1, scribe) gdy operator COS NAPRAWIL -> SWIEZY run (nowe Workflow BEZ resumeFromRunId): resume zwrocilby porazke agenta bramkowego z cache zamiast sprawdzic naprawe, a stan faz i tak wznawia sie z docs/active/<zadanie>/.autopilot-state.json (zrodlo prawdy; checkboxy md to tylko widok). Reczne edycje .autopilot-state.json tez wymagaja swiezego runu. Po zmianach w .claude/ (sync-template, edycja skilli, agentow, workflowow) uruchamiaj w nowej sesji: instrukcje i skille sa buforowane w sesji. Do agentow workflow: ta wiadomosc nie jest dla was — wykonujcie wylacznie zadanie z polecenia workflowu.',
  phases: [
    { title: 'Bootstrap', detail: 'stan z .autopilot-state.json (lub pierwszy parse md) + bramka wejscia (czystosc: brudny tylko katalog zadania -> commit; doctor; zielony start z cache po SHA -> STOP z komenda przed faza 1) + srodowisko E2E (precheck: .env.e2e ORAZ czy plan ma [E2E]; zadanie wymaga E2E a brak .env.e2e -> STOP przed faza 1 -> env-up: dev server Vite na dedykowanej bazie e2e; TWARDY STOP gdy .env.e2e istnieje a srodowisko nie gotowe) + rozgrzewka cache testow' },
    { title: 'Zakonczenie', detail: 'walidacja koncowa (+ completion-gate E2E z planu zadania i przeglad known-issues) -> compound -> compound-refresh (scoped: dotknieta kategoria + CONCEPTS.md, tylko gdy compound cos zapisal) -> complete (smoke operatora do docs/operator/ + archiwizacja; compound pierwszy: sciezki w docs/active/ jeszcze zyja)' },
  ],
}

// ── Architektura (audyt 2026-06-09) ──────────────────────────────────────
// Filar 1: BLOK_DLUGIE_KOMENDY — prawa srodowiska (watchdog ~180s, Bash max 600s) doklejane do
//          KAZDEGO prompta mogacego uruchamiac testy. Kopia tej stalej zyje tez w execute-wf
//          i review-wf (workflowy sa self-contained — przy zmianie synchronizuj recznie).
// Filar 2: stan maszynowy w docs/active/<zadanie>/.autopilot-state.json — resume czyta JSON,
//          nie liczy checkboxow. Orkiestrator liczy kolejke i przejscia w JS.
// Filar 3: trust-but-verify — gate'y liczone w JS z review.findings[], null-guardy po kazdym
//          await, warmup wymaga dowodu (kontrolny warm-run w sekundach).
// Re-review po fixie USUNIETY (decyzja usera, dane wf_3c9d3864). Commity fixa oglada kontrola diffu naprawczego
// (P8: listy K-1…K-7, w tym K-6 — test P1 pada na kodzie sprzed poprawki; zastapila targeted verify z 2026-07-12).
// Mitygacja test-weakeningu: zakaz modyfikacji asercji w fixPrompt + git diff testow w walidacji.
// RESUME vs CACHE: resumeFromRunId odtwarza wyniki agentow z journala po prefiksie wywolan — sluzy
// TYLKO do wznowienia po awarii runu. Po STOP bramki srodowiskowej operator naprawia i odpala
// SWIEZY run (bez resume): prompty agentow bramkowych sa statyczne, wiec resume zwrociloby ich
// zcache'owana porazke. Poprawnosc wznowienia gwarantuje .autopilot-state.json, nie cache.

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

const FINDING_OTWARTY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    // 'P3' zostaje dla stanow sprzed P8 (plan B1 slal P3 do fixa): bootstrap przepisuje stan przez ten schemat, a P3 spoza
    // enumu znikalyby przy wznowieniu (oferty-online, faza 6: 13 utraconych P3). Orkiestrator przenosi je do known-issues.
    severity: { type: 'string', enum: ['P1', 'P2', 'P3'] },
    typ: { type: 'string', enum: ['KOD', 'TEST', 'E2E'] },
    plik: { type: 'string' },
    opis: { type: 'string' },
  },
  required: ['severity', 'typ', 'plik', 'opis'],
}

// Metryki fazy utrwalane w .autopilot-state.json (2026-07-26). Powod: telemetria ma dawac dane do
// strojenia progow (routing, dedup, sceptycy), a przy resume review sie NIE powtarza — bez utrwalenia
// wpis telemetrii mial null. Schemat MUSI istniec tu, bo stan przechodzi przez bootstrap-agenta
// (additionalProperties: false wymazalby nieznane pole przy pierwszym zapiszStan).
// Do stanu idzie SKROT (liczby do strojenia); pelny przebieg z flagami warstw zyje w raporcie review-faza-N.md.
const METRYKI_FAZY = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {
    liczniki: {
      type: 'object',
      additionalProperties: false,
      properties: { p1: { type: 'integer' }, p2: { type: 'integer' }, p3: { type: 'integer' }, operator: { type: 'integer' } },
      required: ['p1', 'p2', 'p3'],
    },
    przebieg: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        pominieci: { type: 'array', items: { type: 'string' }, description: 'keys reviewerow pominietych przez routing' },
        // Poza `required` SWIADOMIE (2026-07-30): stany zapisane przed ta zmiana maja `przebieg` BEZ tego
        // pola, a bootstrap-agent przepisuje `metryki` 1:1 przez ten schemat. W `required` wywalilby
        // wznowienie starego zadania na walidacji. null = przebieg ze starszego runu.
        e2eTryb: { type: ['string', 'null'], description: 'tryb testera E2E: przegladarka | bez-przegladarki | pominiety' },
        znalezione: { type: 'integer' },
        poDedupJs: { type: 'integer' },
        poDedupSem: { type: 'integer' },
        weryfikowane: { type: 'integer' },
        obalone: { type: 'integer' },
        // Poza required: stany zapisane przed portem globalnego limitu P3 tego pola nie maja, a bootstrap
        // przepisuje stan 1:1 przez ten schemat — wymog wywracalby resume starszych zadan.
        p3Odrzucone: { type: ['integer', 'null'], description: 'P3 uciete globalnym limitem po dedupie (strojenie progu)' },
        // Pola E2E (port z mobile, 2026-08-23) tez poza required — stany sprzed tej daty ich nie maja.
        e2eCheckboxy: { type: ['integer', 'null'] },
        e2eStatus: { type: ['string', 'null'], description: 'status testera E2E z review-wf (wykonany / padl / pominiety przez routing)' },
        e2ePass: { type: ['integer', 'null'] },
        e2eFail: { type: ['integer', 'null'] },
        e2eSkip: { type: ['integer', 'null'] },
        // Metryki kosztu review (audyt 2026-09-06, N3) — tez poza `required`, bo stany sprzed tej
        // daty ich nie maja, a bootstrap przepisuje stan 1:1 przez ten schemat. Bez nich progi
        // "efekt dossier" i "batchowanie sceptykow" byly niemierzalne: `additionalProperties: false`
        // wymazywal te pola przy PIERWSZYM zapiszStan, wiec do telemetrii nie mialy jak dojsc.
        // `dossier: false` = cichy fallback do czytania pelnych dokumentow, nieodrozniany od sukcesu.
        dossier: { type: ['boolean', 'null'], description: 'czy dossier fazy powstalo (false = reviewerzy czytali pelne dokumenty)' },
        sceptycy: {
          type: ['object', 'null'],
          additionalProperties: false,
          properties: {
            p1: { type: ['integer', 'null'], description: 'liczba agentow-sceptykow P1 (3 na finding)' },
            p2Grupy: { type: ['integer', 'null'], description: 'liczba agentow-sceptykow P2 po batchowaniu per plik' },
            p2Findingi: { type: ['integer', 'null'], description: 'liczba findingow P2 poddanych verify' },
          },
        },
        severityKorekty: {
          type: ['object', 'null'],
          additionalProperties: false,
          properties: {
            przyjete: { type: ['integer', 'null'], description: 'korekty severity przyjete (zgodna wiekszosc sceptykow)' },
            odrzucone: { type: ['integer', 'null'], description: 'sugestie pojedynczego sceptyka odrzucone przez regule (plan A7)' },
          },
        },
        tiery: { type: ['object', 'null'], additionalProperties: { type: ['string', 'null'] }, description: 'tier rozumowania per rola (plan B4)' },
      },
      required: ['pominieci', 'znalezione', 'poDedupJs', 'poDedupSem', 'weryfikowane', 'obalone'],
    },
  },
  required: ['liczniki', 'przebieg'],
}

const PLAN_STATE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nazwaZadania: { type: 'string', description: 'ostatni segment sciezki zadania' },
    branch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        aktualny: { type: 'string' },
        wymagany: { type: ['string', 'null'] },
        zgodny: { type: 'boolean' },
      },
      required: ['aktualny', 'wymagany', 'zgodny'],
    },
    // Dane bramki wejscia (P4) — decyzje liczy decyzjaWejscia w JS.
    wejscie: {
      type: 'object',
      additionalProperties: false,
      properties: {
        zmiany: { type: 'array', items: { type: 'string' }, description: 'linie `git status --porcelain --untracked-files=all` 1:1 (pusta = czyste drzewo)' },
        doctorKod: { type: ['integer', 'null'], description: 'kod wyjscia doctor.sh (0 OK, 1 brak obowiazkowego); null = brak skryptu' },
        doctorWynik: { type: 'string', description: 'linia WYNIK z doctora ("" gdy brak)' },
        kodJakPrzyTescie: { type: ['boolean', 'null'], description: 'od bazaZielona.sha zmiany tylko w docs/; null = brak bazaZielona' },
        // Pliki decyzji na galezi glownej (P5) — czy CLAUDE.md uzgodniono po merge'u, liczy decyzjaClaudeMd.
        decyzje: {
          type: 'object',
          additionalProperties: false,
          properties: {
            glowna: { type: ['string', 'null'], description: 'main albo master; null = zadnej' },
            katalog: { type: 'boolean', description: 'docs/decisions istnieje na galezi glownej' },
            linie: { type: 'array', items: { type: 'string' }, description: "wyjscie git grep -e '^claude_md:' 1:1" },
          },
          required: ['glowna', 'katalog', 'linie'],
        },
      },
      required: ['zmiany', 'doctorKod', 'doctorWynik', 'kodJakPrzyTescie', 'decyzje'],
    },
    // Wynik zielonego startu z pliku stanu (przepisany 1:1) — swiezy run po STOP-ie przed faza 1 nie powtarza testow.
    bazaZielona: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: { sha: { type: 'string' }, wynik: { type: 'string', enum: ['PASS'] } },
      required: ['sha', 'wynik'],
    },
    zrodloStanu: { type: 'string', enum: ['state-json', 'pierwszy-parse-md'] },
    fazy: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          numer: { type: 'integer' },
          nazwa: { type: 'string' },
          execute: { type: 'string', enum: ['done', 'pending'] },
          review: { type: 'string', enum: ['done', 'pending'] },
          fix: { type: 'string', enum: ['done', 'pending', 'none'], description: 'none = review nie zostawil otwartych P1/P2' },
          otwarteFindingi: { type: 'array', items: FINDING_OTWARTY },
          metryki: METRYKI_FAZY,
          // Baza fazy z execute-wf (P7) — poza `required`, bo stany sprzed P7 jej nie maja.
          baza: { type: ['string', 'null'], description: 'SHA HEAD przed builderami fazy; null = nieznana' },
        },
        required: ['numer', 'nazwa', 'execute', 'review', 'fix', 'otwarteFindingi'],
      },
    },
    zakonczenie: {
      type: 'object',
      additionalProperties: false,
      properties: {
        walidacja: { type: 'string', enum: ['done', 'pending'] },
        complete: { type: 'string', enum: ['done', 'pending'] },
        compound: { type: 'string', enum: ['done', 'pending'] },
      },
      required: ['walidacja', 'complete', 'compound'],
    },
    rozbieznosci: { type: 'array', items: { type: 'string' }, description: 'informacyjne: stan vs pliki md (np. review-faza-N.md istnieje a stan mowi pending)' },
  },
  required: ['nazwaZadania', 'branch', 'wejscie', 'zrodloStanu', 'fazy', 'zakonczenie', 'rozbieznosci'],
}

const ZAPIS_STANU = {
  type: 'object',
  additionalProperties: false,
  properties: {
    zapisano: { type: 'boolean' },
    // Agent ustawia je po REALNYM sparsowaniu pliku z dysku, nie po samym wywolaniu Write (patrz zapiszStanPrompt).
    poprawnyJson: { type: ['boolean', 'null'], description: 'plik odczytany z dysku po zapisie sparsowal sie jako JSON' },
  },
  required: ['zapisano', 'poprawnyJson'],
}

// ── Stan fazy (P7) ──────────────────────────────────────────────────────────
// Tresc .autopilot-state.json liczy JS; zapis dokleja sie do polecenia agenta, ktory w tym miejscu i tak startuje
// (mapa 14 miejsc: HANDOFF 6a pkt 54). Przed pod-workflowem i po niepotwierdzonym zapisie zostaje agent `stan:zapis`.
function trescStanu(stan) {
  return JSON.stringify(
    { wersja: 1, zadanie: stan.nazwaZadania, fazy: stan.fazy, zakonczenie: stan.zakonczenie, bazaZielona: stan.bazaZielona || null },
    null,
    2
  )
}

// Pole potwierdzenia w schemacie kazdego agenta, ktoremu autopilot dokleja zapis stanu.
const POLE_STANU = { type: ['boolean', 'null'], description: 'true po zapisie pliku stanu i odczycie z wynikiem JSON-OK' }

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

function zapisPotwierdzony(wynik) {
  return Boolean(wynik) && wynik.stanZapisany === true
}

// Stan po udanym execute fazy — zapisuje go domkniecie execute-wf (z baza fazy wstawiona w JS), zanim autopilot dostanie wynik.
function stanPoExecute(stan, numer) {
  return { ...stan, fazy: stan.fazy.map((f) => (f.numer === numer ? { ...f, execute: 'done' } : f)) }
}
// ── Koniec stanu fazy

const WARMUP_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['zbudowano', 'zbedne', 'niepowodzenie'] },
    detal: { type: 'string', description: 'co odpalono + czasy, lub powod pominiecia/niepowodzenia' },
    czasZimnySek: { type: ['integer', 'null'], description: 'czas pierwszego (zimnego) biegu w sekundach' },
    czasKontrolnySek: { type: ['integer', 'null'], description: 'czas kontrolnego warm-runu w sekundach — DOWOD zbudowania cache' },
  },
  required: ['status', 'detal'],
}

// Precheck: TANI, deterministyczny sygnal opt-in — oddzielony od ciezkiego env-up, zeby flake ciezkiego
// agenta na projekcie opt-in NIE degradowal cicho E2E (patrz orkiestracja).
// Precheck czyta DWA niezalezne sygnaly: czy repo MA srodowisko (.env.e2e) i czy zadanie go WYMAGA
// (checkboxy [E2E] w planie). Sam plik to za malo — brak setupu bylby nieodrozanialny od swiadomej
// rezygnacji (regresja e3-core-loop, mobile: run przejechal 3 fazy i ~20h zanim ktokolwiek zauwazyl,
// ze scenariusze [E2E] nie maja gdzie sie wykonac).
const E2E_PRECHECK = {
  type: 'object',
  additionalProperties: false,
  properties: {
    istnieje: { type: 'boolean', description: 'true = plik .env.e2e istnieje w korzeniu repo (srodowisko E2E skonfigurowane)' },
    zadanieWymagaE2E: { type: 'boolean', description: 'true = plan zadania ma co najmniej jeden NIEZAZNACZONY checkbox z markerem [E2E] (zadanie deklaruje E2E jako deliverable)' },
    liczbaScenariuszy: { type: 'integer', description: 'ile niezaznaczonych checkboxow [E2E] znaleziono w planie zadania (0 gdy zadnego)' },
    stanZapisany: POLE_STANU,
  },
  required: ['istnieje', 'zadanieWymagaE2E', 'liczbaScenariuszy'],
}

const E2E_ENV_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['gotowe', 'pominieto', 'niepowodzenie'] },
    detal: { type: 'string', description: 'co postawiono / powod pominiecia lub niepowodzenia (BEZ wartosci sekretow)' },
    devServer: { type: 'string', enum: ['uruchomione', 'zastane', 'brak'], description: 'dev server Vite na dedykowanej bazie e2e' },
  },
  required: ['status', 'detal', 'devServer'],
}

const E2E_DB_SYNC_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['zsynchronizowano', 'aktualna', 'niepowodzenie'] },
    detal: { type: 'string', description: 'co zaaplikowano (migracje/seedy/konto) lub tresc bledu — blad SQL migracji to potencjalny DEFEKT KODU' },
  },
  required: ['status', 'detal'],
}

const E2E_DOWN_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    posprzatano: { type: 'boolean' },
    detal: { type: 'string' },
    stanZapisany: POLE_STANU,
  },
  required: ['posprzatano', 'detal'],
}

const FIX_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    naprawione: { type: 'integer' },
    pozostaje: { type: 'integer' },
    typy: {
      type: 'object',
      additionalProperties: false,
      properties: { kod: { type: 'integer' }, test: { type: 'integer' }, e2e: { type: 'integer' } },
      required: ['kod', 'test', 'e2e'],
    },
    e2eReweryfikacja: { type: 'string', description: 'X/Y passed lub "n/a"' },
    walidacja: { type: 'string', enum: ['PASS', 'FAIL'] },
    commity: { type: 'array', items: { type: 'string' }, description: 'hashe commitow utworzonych w tym przebiegu — zakres kontroli fixa' },
    nienaprawione: { type: 'array', items: { type: 'string' } },
    nierozwiazaneP1: { type: 'integer', description: 'P1 ktorych fix NIE zamknal (krytyczne -> STOP)' },
    nierozwiazaneP2: { type: 'integer', description: 'P2 przeniesione do known-issues (graceful)' },
    // Guard plikow binarnych (run team-os-onboarding-instalatory, 2026-07-26): fix wpisal do
    // scripts/inbox/invite.mjs regex z SUROWYMI bajtami sterujacymi zamiast sekwencji \x.. — plik
    // przestal byc tekstem (git: "Bin 9804 -> 15506 bytes") i KAZDY kolejny agent padal na jego Read
    // (APIError), 6 prob z rzedu, run martwy po 2h47min. W required, bo pusta lista MUSI znaczyc
    // "sprawdzilem i czysto"; pole opcjonalne = agent moze pominac sprawdzenie i cicho wylaczyc guard.
    plikiBinarne: {
      type: 'array',
      items: { type: 'string' },
      description: 'pliki zmienione w tej fazie, ktore git widzi jako binarne (numstat "-"), a NIE sa legalnymi binariami — typowa przyczyna: surowe bajty sterujace w pliku zrodlowym',
    },
    stanZapisany: POLE_STANU,
  },
  required: ['naprawione', 'pozostaje', 'walidacja', 'nierozwiazaneP1', 'nierozwiazaneP2', 'plikiBinarne'],
}

const VALIDATION_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    wykryteKomendy: { type: 'array', items: { type: 'string' } },
    typecheck: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    lint: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    testy: { type: 'string', description: 'PASS/FAIL z liczbami X/Y (+ adnotacje flake-infra)' },
    build: { type: 'string', enum: ['PASS', 'FAIL', 'n/a'], description: 'vite build (lub build z package.json)' },
    testyZmodyfikowane: { type: 'array', items: { type: 'string' }, description: 'pliki *.test.* ze ZMIENIONYMI istniejacymi asercjami w commitach fix(...) — sygnal test-weakeningu' },
    e2eNieuruchomione: { type: 'array', items: { type: 'string' }, description: 'tresci checkboxow [E2E] wciaz NIEZAZNACZONYCH w planie zadania, ktore NIGDY nie przebiegly (bez suffixu "(FAIL:") — wymusza wynik=FAIL (completion-gate). Nie zalezy od istnienia .env.e2e: zrodlem prawdy o wymaganiu E2E jest plan, nie repo' },
    e2eFail: { type: 'array', items: { type: 'string' }, description: 'tresci checkboxow [E2E] z suffixem "(FAIL:" — flow przebiegl i padl na znanym defekcie (known-issues); wymusza wynik=FAIL, ale z inna instrukcja dla operatora (napraw kod, NIE zmieniaj na [Manual])' },
    e2eFazy: { type: 'array', items: { type: 'integer' }, description: 'numery faz (z naglowka "## Faza N"), w ktorych lezy co najmniej jeden niezaznaczony [E2E] z e2eNieuruchomione/e2eFail — orkiestrator cofa im review do pending' },
    knownIssuesZamkniete: { type: ['integer', 'null'], description: 'ile wpisow known-issues.md przeniesiono do sekcji "Zamkniete" (higiena, NIE wplywa na wynik)' },
    wynik: { type: 'string', enum: ['PASS', 'FAIL'] },
    bledy: { type: 'array', items: { type: 'string' } },
    stanZapisany: POLE_STANU,
  },
  required: ['wynik'],
}

// ── Prompty leaf-agentow ──────────────────────────────────────────────────

function bootstrapPrompt(sciezka) {
  return `Jestes bootstrapem pipeline'u dev-autopilot. Zbuduj jawny stan orkiestratora.

Folder zadania: ${sciezka}

1. GIT: uruchom \`git branch --show-current\` i \`git status --porcelain --untracked-files=all\`.
   Przeczytaj wymagany branch z dokumentacji w ${sciezka}/ (szukaj "Branch:").
   Ustaw branch.zgodny (aktualny == wymagany lub wymagany == null). Linie statusu wpisz 1:1 do wejscie.zmiany
   (bez interpretacji — czy zmiany blokuja run, liczy orkiestrator).

1a. DOCTOR: \`bash .claude/scripts/doctor/doctor.sh; echo "KOD=$?"\` (timeout Bash 300000). wejscie.doctorKod = liczba
   z linii KOD=, wejscie.doctorWynik = linia zaczynajaca sie od "WYNIK:". Brak pliku skryptu -> doctorKod null, doctorWynik "".

1b. DECYZJE NA GALEZI GLOWNEJ: wejscie.decyzje.glowna = "main", gdy \`git rev-parse --verify --quiet refs/heads/main\` zwraca SHA,
   inaczej "master" przy tym samym sprawdzeniu, inaczej null (wtedy katalog false, linie []).
   katalog: \`git cat-file -e <glowna>:docs/decisions && echo TAK || echo NIE\` -> TAK = true.
   linie: \`git grep -e '^claude_md:' <glowna> -- 'docs/decisions/*.md'\` — kazda linia wyjscia 1:1 (brak trafien = []).

2. STAN — najpierw sprawdz czy istnieje ${sciezka}/.autopilot-state.json:

   A) PLIK ISTNIEJE (resume): NAJPIERW zwaliduj, ze to poprawny JSON:
      \`node -e "JSON.parse(require('fs').readFileSync('${sciezka}/.autopilot-state.json','utf8'));console.log('JSON-OK')"\`
      Blad parsowania -> NIE PROBUJ go odczytac ani zrekonstruowac. Model potrafi "odczytac" uszkodzony JSON
      i zmyslic stan faz, a to znaczy albo powtorzenie kilku godzin pracy, albo pominiecie fazy, ktorej nikt
      nie wykonal. Zamiast tego zbuduj stan z plikow md jak w wariancie B, ustaw
      zrodloStanu:"pierwszy-parse-md" i dopisz do rozbieznosci[] wpis:
      "USZKODZONY .autopilot-state.json (nie parsuje sie) — stan odtworzony z md; operator powinien go
      sprawdzic lub usunac przed kolejnym runem". Nie modyfikuj tego pliku.
      JSON-OK -> przeczytaj go i zwroc jego fazy/zakonczenie BEZ reinterpretacji
      checkboxow md — plik stanu jest ZRODLEM PRAWDY, checkboxy to tylko widok dla czlowieka.
      Pole "metryki" fazy (jesli obecne) PRZEPISZ 1:1 — nie licz go sam, nie uzupelniaj, nie zeruj;
      to zapis telemetrii z runu, w ktorym review sie odbylo. Gdy pola nie ma, pomin je (null).
      Pole "baza" fazy (jesli obecne) przepisz 1:1 — od niej review liczy diff fazy po wznowieniu. Gdy pola nie ma, pomin je.
      Pole "bazaZielona" (jesli obecne i nie null) przepisz 1:1 i ustaw wejscie.kodJakPrzyTescie:
      \`git diff --quiet <bazaZielona.sha> HEAD -- . ':(exclude)docs' && echo TAK || echo NIE\` -> TAK = true, NIE = false.
      zrodloStanu = "state-json". Dodatkowo porownaj informacyjnie z plikami (np. istnieje
      ${sciezka}/review-faza-N.md a stan mowi review=pending) i wpisz różnice do rozbieznosci[]
      (NIE koryguj stanu samodzielnie).

   B) PLIKU NIE MA (pierwszy run): zbuduj stan z plikow, zrodloStanu = "pierwszy-parse-md":
      - ${sciezka}/*-plan.md -> lista faz [(numer, nazwa)].
      - ${sciezka}/*-zadania.md -> per faza execute:
        execute = "done" gdy wszystkie checkboxy fazy sa [x], LICZAC WYLACZNIE checkboxy
        implementacyjne. POMIN CALKOWICIE: checkboxy z prefiksem "Weryfikacja:", "Operator:",
        oznaczone "[E2E]" lub "[Manual]", ORAZ wszystkie checkboxy w sekcjach
        "## Do poprawy po review fazy N" i "## Operator checklist faza N" (te sekcje obsluguje
        review/fix, nie execute). Dowolny INNY [ ] => execute = "pending".
      - review = "done" gdy istnieje ${sciezka}/review-faza-{numer}.md, inaczej "pending".
        UWAGA: faza z execute="done" i review="pending" to NORMALNY stan po awarii — taka faza
        MUSI miec review (nie pomijaj jej).
      - sekcja "## Do poprawy po review fazy {numer}" w zadaniach: niezaznaczone checkboxy P1/P2
        -> sparsuj kazdy do otwarteFindingi (severity z [P1]/[P2], typ KOD/TEST/E2E z kontekstu,
        plik i opis z tresci linii) i ustaw fix = "pending". Wszystkie zaznaczone lub sekcji brak
        przy review="done" -> fix = "done" lub "none" (none gdy sekcji nigdy nie bylo).
        Gdy review="pending" -> fix = "pending" tylko jesli sa otwarte findingi, inaczej "none"
        (review je ustali).

3. zakonczenie: przy pierwszym parse ustaw walidacja/complete/compound = "pending"
   (chyba ze zadanie jest juz w docs/completed/ — wtedy "done").
4. nazwaZadania = ostatni segment sciezki ${sciezka}.
5. Bez pliku stanu albo bez pola bazaZielona: bazaZielona = null, wejscie.kodJakPrzyTescie = null.

Zwroc obiekt zgodny ze schematem. Nie modyfikuj zadnych plikow — to read-only bootstrap.`
}

function zapiszStanPrompt(sciezka, trescJson) {
  return `Zapisz plik stanu pipeline'u dev-autopilot: ${sciezka}/.autopilot-state.json (pelne nadpisanie).

Tresc ponizej jest juz POPRAWNYM JSON-em wygenerowanym maszynowo. Twoje jedyne zadanie to przeniesc ja
na dysk BAJT W BAJT. Nie formatuj, nie poprawiaj, nie skracaj, nie dodawaj komentarzy ani pol.

--- POCZATEK TRESCI ---
${trescJson}
--- KONIEC TRESCI ---

1. ZAPIS: uzyj narzedzia Write z dokladnie ta trescia (bez linii "--- POCZATEK/KONIEC TRESCI ---").
2. WALIDACJA (obowiazkowa, nie pomijaj): odczytaj plik Z DYSKU i sprawdz, ze parsuje sie jako JSON:
   \`node -e "JSON.parse(require('fs').readFileSync('${sciezka}/.autopilot-state.json','utf8'));console.log('JSON-OK')"\`
   (brak node -> \`python3 -c "import json;json.load(open('${sciezka}/.autopilot-state.json'));print('JSON-OK')"\`).
   Wynik "JSON-OK" -> zwroc {zapisano:true, poprawnyJson:true}.
   Blad parsowania -> ZAPISZ PONOWNIE (raz) i zwaliduj jeszcze raz. Nadal blad -> {zapisano:false, poprawnyJson:false}.
3. POWOD tej walidacji (run feedback-marcin-poprawki, mobile, 2026-08-06): przy przepisywaniu tresci przez
   agenta w opisie findingu wszedl NIEZAESCAPOWANY cudzyslow — plik przestal byc JSON-em. To jest plik,
   z ktorego pipeline odtwarza stan po awarii: uszkodzony albo wywroci nastepny bootstrap, albo cicho skasuje
   dowod, ze cala faza zostala wykonana, i pipeline powtorzy kilka godzin pracy. Zapis bez odczytu = brak dowodu.

Nie modyfikuj ZADNYCH innych plikow.`
}

const TESTY_STARTU = {
  type: 'object',
  additionalProperties: false,
  properties: {
    wynik: { type: 'string', enum: ['PASS', 'FAIL', 'BRAK-TESTOW'] },
    sha: { type: 'string', description: 'krotki hash HEAD, na ktorym biegly testy' },
    komenda: { type: 'string', description: 'komenda do odtworzenia, np. "pnpm typecheck && pnpm test"' },
    bledy: { type: 'array', items: { type: 'string' }, description: 'przy FAIL: plik testu albo typecheck + jednozdaniowy objaw' },
  },
  required: ['wynik', 'sha', 'komenda', 'bledy'],
}

// Zielony start (P4): testy na drzewie, od ktorego run zaczyna prace. Drzewo jest czyste (bramka czystosci wyzej),
// wiec HEAD = kod startu; galaz moze juz niesc poprawke zastanego czerwonego testu z main.
function testyStartuPrompt() {
  return `Sprawdzasz, czy run dev-autopilot startuje z zielonego kodu: typecheck i pelne testy projektu na biezacym HEAD.
${BLOK_DLUGIE_KOMENDY}

1. \`git rev-parse --short HEAD\` -> sha.
2. Komendy z package.json scripts (pm z lockfile: pnpm-lock -> pnpm, bun.lock/bun.lockb -> bun, yarn.lock -> yarn,
   package-lock -> npm): typecheck (brak skryptu -> \`tsc --noEmit\` przy tsconfig.json, inaczej pomin) i test.
   Brak skryptu test -> wynik "BRAK-TESTOW", komenda "", bledy [] i koniec.
3. Uruchom typecheck, potem test wg BLOKU DLUGICH KOMEND (tlo + polling, flake infra wg procedury z bloku).
   komenda = to, co uruchomiles, w jednej linii (np. "pnpm typecheck && pnpm test").
4. Realny FAIL -> wynik "FAIL" i do bledy[] plik testu (albo "typecheck") z jednozdaniowym objawem. Nic nie naprawiaj:
   decyzje o STOP-ie podejmuje orkiestrator, a operator naprawia kod sam.

Nie modyfikuj plikow i nie commituj. Zwroc {wynik, sha, komenda, bledy}.`
}

function warmupPrompt(sciezka) {
  return `Jestes rozgrzewka cache testowego pipeline'u dev-autopilot (folder zadania: ${sciezka}).
CEL: zbudowac cache transformacji vitest (node_modules/.vite / optimizeDeps) PRZED fazami implementacji,
zeby zaden pozniejszy agent nie trafil na zimny, milczacy bieg transform/prebundle.
${BLOK_DLUGIE_KOMENDY}

1. Wykryj runner: przeczytaj package.json. Rozgrzewka dotyczy WYLACZNIE vitest. Brak vitest
   (inny runner lub brak testow) -> zwroc {status:"zbedne", detal:"<powod>"} i ZAKONCZ.
2. Wybierz JEDEN test komponentu z najciezszym setupem: szukaj *.test.tsx importujacego
   komponenty React (src/components/, src/features/, src/pages/ — transform JSX + jsdom + ciezkie
   zaleznosci sa najdrozsze). Jesli W CALYM repo nie ma zadnego testu komponentu
   (projekt greenfield): utworz TYMCZASOWY plik .autopilot-warmup.test.tsx w katalogu testowym
   projektu z trywialnym renderem <div>warmup</div> (przez @testing-library/react) i 1 asercja — to JEDYNY
   wyjatek od zakazu modyfikacji plikow; USUN go w kroku 5.
3. BIEG ZIMNY — OBOWIAZKOWO przez tlo (komenda moze milczec dlugo na zimnym cache, foreground NIE dokonczy):
   uruchom \`<pm> vitest run <plik> --reporter=dot > /tmp/autopilot-warmup.log 2>&1\` przez Bash
   z run_in_background (pm z lockfile: bun.lockb->bunx, pnpm->pnpm, yarn->yarn, npm->npx).
   POLLUJ co ~45-60s: \`tail -5 /tmp/autopilot-warmup.log\` + sprawdzenie czy proces zyje.
   Czekaj do zakonczenia (budzet ~25 min). Zanotuj laczny czas jako czasZimnySek.
   WYNIK testu (pass/fail asercji) jest NIEISTOTNY — liczy sie ukonczenie procesu (= zapis cache).
4. DOWOD — bieg kontrolny foreground: uruchom TEN SAM test zwyklym Bash (timeout 120s wystarczy).
   Zanotuj czas jako czasKontrolnySek. Cache zbudowany = czas rzedu SEKUND.
   czasKontrolnySek < 60 -> status "zbudowano". Wiecej lub timeout -> status "niepowodzenie"
   (cache NIE dziala — nie raportuj sukcesu ktorego nie ma).
5. Sprzatanie: usun /tmp/autopilot-warmup.log i ewentualny tymczasowy test z kroku 2.

Poza wyjatkiem z kroku 2 NIE modyfikuj zadnych plikow. Zwroc {status, detal, czasZimnySek, czasKontrolnySek}.`
}

function e2ePrecheckPrompt(sciezka) {
  return `Jestes precheck-agentem E2E pipeline'u dev-autopilot. Zadanie: zebrac DWA niezalezne sygnaly.
NIE interpretuj ich i NIE wyciagaj wnioskow — decyzje podejmuje orkiestrator.

1. CZY SRODOWISKO ISTNIEJE: \`test -f "$(git rev-parse --show-toplevel)/.env.e2e" && echo TAK || echo NIE\`.
   TAK -> istnieje:true, NIE -> istnieje:false. NIE czytaj zawartosci pliku (sekrety).

2. CZY ZADANIE WYMAGA E2E: \`grep -hE '^- \\[ \\].*\\[E2E\\]' ${sciezka}/*-zadania.md | grep -vcE 'Operator:|\\[P[123]\\]'\`
   (brak trafien = 0 — grep konczy sie wtedy kodem 1, to NIE jest blad). Marker [E2E] oznacza scenariusz,
   ktory ma byc wykonany w przegladarce (agent-browser) na zarzadzanym srodowisku. Liczysz WYLACZNIE
   niezaznaczone \`- [ ]\`; pozycje juz odhaczone, pozycje z markerem [Manual] (swiadomie recznie przez
   operatora), kopie z prefiksem "Operator:" w sekcjach "## Operator checklist faza N" oraz pozycje findingow
   z tokenem [P1]/[P2]/[P3] w sekcjach "## Do poprawy po review fazy N" (linie zrodlowe z planu nigdy go
   nie maja) sie NIE licza.
   Wynik -> liczbaScenariuszy; zadanieWymagaE2E = (liczbaScenariuszy > 0).

Zwroc {istnieje, zadanieWymagaE2E, liczbaScenariuszy}. Nic wiecej nie rob.`
}

function e2eEnvUpPrompt() {
  return `Jestes agentem srodowiska E2E pipeline'u dev-autopilot. Postaw dev server Vite na DEDYKOWANEJ
bazie e2e, zeby reviewer E2E (agent-browser) i fix mogly REALNIE wykonac flow w przegladarce zamiast
klasyfikowac je jako OPERATOR. Baza = DEDYKOWANY projekt Supabase e2e z .env.e2e (nigdy dev/prod).
${BLOK_DLUGIE_KOMENDY}

0. SELF-SKIP: jesli w korzeniu repo NIE ma pliku .env.e2e -> zwroc
   {status:"pominieto", detal:"brak .env.e2e — E2E w trybie OPERATOR (setup: .claude/templates/e2e-env/README.md)", devServer:"brak"}
   i ZAKONCZ.

1. BEZPIECZENSTWO (twarde):
   a) \`git check-ignore -q .env.e2e\` — exit != 0 (plik NIE jest gitignorowany) -> {status:"niepowodzenie",
      detal:"dopisz .env.e2e do .gitignore — plik zawiera sekrety"}. NIGDY nie loguj wartosci z tego pliku.
   b) Wymagane klucze: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_E2E_DB_URL,
      SUPABASE_E2E_SERVICE_ROLE_KEY, E2E_TEST_EMAIL, E2E_TEST_PASSWORD. Brak -> niepowodzenie z LISTA NAZW brakow.
   c) GUARD TOZSAMOSCI: VITE_SUPABASE_URL z .env.e2e musi byc ROZNY od wartosci w .env / .env.local
      (jesli istnieja). Identyczny = to nie jest dedykowany projekt e2e -> niepowodzenie (ochrona bazy dev/prod).

2. DEV SERVER: \`curl -s localhost:5173\` (lub port z vite.config / skryptu dev).
   - Odpowiada -> devServer:"zastane"; w detal ostrzezenie: zastany dev server moze byc zbudowany na
     bazie dev (innym .env) — flow E2E zweryfikuja to posrednio (login kontem e2e).
   - Nie odpowiada -> uruchom DETACHED (musi przezyc Twoje zakonczenie; pm z lockfile:
     bun.lockb->bun, pnpm->pnpm, yarn->yarn, npm->npm). Vite laduje .env.e2e przez flage --mode e2e:
     \`nohup <pm> run dev -- --mode e2e --port 5173 --strictPort > /tmp/autopilot-vite.log 2>&1 & echo $! > /tmp/autopilot-vite.pid\`
     (gdy skrypt dev nie przepuszcza flag — \`nohup <pm> exec vite --mode e2e --port 5173 --strictPort ...\`).
     Polluj \`curl -s localhost:5173\` co ~5s (max ~90s). Sukces -> devServer:"uruchomione",
     timeout -> niepowodzenie (dolacz tail -20 /tmp/autopilot-vite.log do detal).

3. status "gotowe" TYLKO gdy: dev server odpowiada na localhost:5173. Nie modyfikuj plikow repo.`
}

function e2eDbSyncPrompt(sciezka, numerFazy) {
  return `Jestes agentem synchronizacji bazy e2e pipeline'u dev-autopilot (zadanie: ${sciezka}, faza ${numerFazy}).
Cel: dedykowany projekt Supabase e2e ma miec migracje i seedy tej fazy PRZED testami E2E w przegladarce.
Ten projekt WOLNO modyfikowac autonomicznie — to nie jest baza dev/prod (guard tozsamosci zrobil env-up).
NIGDY nie loguj wartosci sekretow z .env.e2e.
${BLOK_DLUGIE_KOMENDY}

1. Wczytaj SUPABASE_E2E_DB_URL i SUPABASE_E2E_SERVICE_ROLE_KEY z .env.e2e (do uzycia, nie do logu).
2. MIGRACJE — realny apply: \`supabase db push --db-url "$SUPABASE_E2E_DB_URL" --include-all\`
   (non-interactive: dodaj --yes jesli CLI wspiera, inaczej \`echo Y |\`). To pierwsza PRAWDZIWA
   weryfikacja SQL migracji w pipeline (testy migracji w repo to regex na pliku). Blad SQL ->
   status "niepowodzenie" z pelna trescia bledu w detal — to moze byc DEFEKT KODU migracji, nie infra.
3. SEED: znajdz seedy powiazane z flow tej fazy — pliki *-seed.sql w e2e/seeds/. Zrodla nazw flow/seedow
   fazy ${numerFazy} w ${sciezka}/*-zadania.md (WSZYSTKIE, nie tylko "Weryfikacja:"): (a) kazda linia z markerem
   [E2E] (prefiks Test: i Weryfikacja:) — identyfikator flow (pierwszy backtick w linii) i ewentualne jawne
   "(seed: e2e/seeds/<x>-seed.sql)"; (b) checkboxy implementacyjne "Stwórz (e2e seed):" tej fazy (niosa dokladne
   sciezki); (c) fallback: kazdy e2e/seeds/*-seed.sql dodany lub zmieniony w commitach tej fazy.
   Jawny "(seed: …)" WYGRYWA (scenariusz moze uzywac cudzego seeda); konwencje <flow>-seed.sql dobieraj
   po identyfikatorze flow tylko gdy linia nie wskazuje seeda jawnie. Aplikuj kazdy
   WYLACZNIE przez \`psql "$SUPABASE_E2E_DB_URL" -v ON_ERROR_STOP=1 -f <plik>\`.
   ZAKAZ \`supabase db query -f\` jako fallbacku: CLI wysyla plik jako JEDNO prepared statement, wiec
   seed z \`begin; do $$ ... $$; commit;\` pada na "cannot insert multiple commands into a prepared
   statement" (42601) — to narzedzie do jednozdaniowych sprawdzen, nie do seedow. Brak psql ->
   status "niepowodzenie" z instrukcja instalacji w detal (brew install libpq / apt install postgresql-client).
   Bledy duplikatow przy nieidempotentnym seedzie odnotuj, nie failuj.
4. KONTO TESTOWE: sprawdz czy user E2E_TEST_EMAIL istnieje (GET /auth/v1/admin/users przez
   service_role). Brak -> utworz (POST /auth/v1/admin/users, email_confirm:true, haslo E2E_TEST_PASSWORD).

Zwroc {status, detal}: "zsynchronizowano" (cos zaaplikowano), "aktualna" (nic do zrobienia),
"niepowodzenie" (+ co dokladnie padlo).`
}

function e2eEnvDownPrompt() {
  return `Sprzatanie srodowiska E2E dev-autopilot. Zabij WYLACZNIE procesy uruchomione przez pipeline:
1. Jesli istnieje /tmp/autopilot-vite.pid: \`kill $(cat /tmp/autopilot-vite.pid)\` (ignoruj blad gdy
   proces juz nie zyje), potem usun /tmp/autopilot-vite.pid i /tmp/autopilot-vite.log.
   Dev server "zastany" (brak naszego .pid) zostaw w spokoju — nie nalezy do nas.
Zwroc {posprzatano, detal}.`
}

// Zwiniecie sekcji "Do poprawy" robi fix, ktory i tak edytuje plik zadan (P7; wczesniej osobny agent po fixie, plan B8).
// Plik zadan czytaja planner, tester E2E i scribe kazdej nastepnej fazy; pelna tresc findingow zostaje w review-faza-N.md.
function blokZwinieciaDoPoprawy(sciezka, numerFazy) {
  return `ZWINIECIE SEKCJI "Do poprawy" (po naprawach, przed commitem): w sekcji "## Do poprawy po review fazy ${numerFazy}" pliku ${sciezka}/*-zadania.md
usun wiersze zaznaczone (\`- [x]\`) i wstaw w ich miejsce jedna linie:
\`Zamkniete cyklem fix: <liczba usunietych wierszy> pozycji — pelna tresc findingow i uzasadnienia w \`review-faza-${numerFazy}.md\`.\`
Wiersze niezaznaczone (\`- [ ]\`) zostaja doslownie, razem z adnotacjami: dev-docs-complete zbiera z nich otwarte [P1]/[P2]
do domkniecia zadania i do smoke'u operatora. Pozostale sekcje pliku, w tym "## Operator checklist faza ${numerFazy}", zostaja bez zmian.
Plik zadan czytaja kolejne fazy, a pelna tresc findingow jest w raporcie review — w pliku zadan wystarczy slad cyklu fix.`
}

function fixPrompt(sciezka, numerFazy, otwarteFindingi) {
  return `Jestes czescia pipeline'u dev-autopilot. Naprawiasz problemy z review fazy ${numerFazy}.
WAZNE: to JEDYNY przebieg fix tej fazy — po nim NIE ma ponownego review. Twoj raport jest
OSTATECZNYM zrodlem prawdy o stanie findingow, wiec klasyfikuj uczciwie czego nie zamknales.

Folder zadania: ${sciezka}
Numer fazy: ${numerFazy}

OTWARTE FINDINGI DO NAPRAWY (lista autorytatywna — przekazana przez orkiestratora):
${JSON.stringify(otwarteFindingi, null, 2)}

FINDINGI Z PREFIKSEM "[z przerwanego review tej fazy — potwierdz, czy nadal aktualny]": to findingi
z POPRZEDNIEGO podejscia do tej fazy, ktore zatrzymalo sie na awarii srodowiska (nie na jakosci kodu).
Biezacy przebieg reviewerow ich NIE potwierdzil — mogl ich nie znalezc, ale kod mogl tez zostac
w miedzyczasie zmieniony. Przy kazdym takim findingu NAJPIERW otworz wskazany plik i sprawdz, czy
defekt nadal tam jest. Jesli JEST — napraw normalnie, wg klasyfikacji nizej. Jesli GO NIE MA (kod
juz poprawiony, plik usuniety, opis nieaktualny) — NIE wymuszaj zmiany: policz go jako zamkniety
i napisz w raporcie jednym zdaniem, ze defekt nie wystepuje. Nigdy nie zgaduj — sprawdz w pliku.

Pelny kontekst kazdego findingu: ${sciezka}/review-faza-${numerFazy}.md
(uwaga: findingi przeniesione opisano w raporcie z POPRZEDNIEGO podejscia, wiec ich pelnej tresci
moze tam nie byc — wtedy zrodlem jest opis z listy powyzej).
Checkboxy w sekcji "Do poprawy po review fazy ${numerFazy}" w ${sciezka}/*-zadania.md odznaczaj
w miare napraw (to widok dla czlowieka).

KOLEJNOSC PRACY (lista zawiera P1 i P2; P3 z tej fazy sa w ${sciezka}/known-issues.md i nie sa do naprawy):
1. NAJPIERW wszystkie P1 (blocking). Kazdy musi zostac zamkniety albo policzony w nierozwiazaneP1.
2. POTEM wszystkie P2 (important).

MIEJSCE ZMIAN: zmieniasz kod wskazany przez findingi i testy do nich. Zmiana w pliku, ktorego nie wskazuje zaden
finding, wraca do cofniecia — kontrola fixa porownuje pliki commitow z lista findingow (K-7).
NAPRAWA P1: najpierw test, ktory odtwarza defekt i pada na obecnym kodzie, potem poprawka. Kontrola fixa uruchamia
ten test na kodzie sprzed poprawki (K-6); test zielony przed poprawka albo jego brak wraca do tury poprawek.

KLASYFIKUJ kazdy finding przed naprawa:
- Typ KOD (blad implementacji/security/perf/architektury): napraw kod -> uruchom unit testy -> odznacz checkbox.
- Typ TEST (brakujacy test): NIE ruszaj kodu produkcyjnego, napisz test (min 1 asercja, nie assertion-free)
  zgodnie z planem w docs/plans/ -> uruchom -> odznacz.
- Typ E2E (weryfikacja E2E): napraw przyczyne (takze: NAPISZ brakujacy seed e2e/seeds/<flow>-seed.sql wg IU,
  gdy finding mowi "brak seeda") -> re-uruchom scenariusz w przegladarce (agent-browser: open URL, snapshot,
  click, screenshot; przed odegraniem zaaplikuj seed flow przez psql na "$SUPABASE_E2E_DB_URL") -> odznacz
  DOPIERO po PASS (nie na "naprawilem kod"). Zrodlowy checkbox identyfikuj TOLERANCYJNIE: NAJPIERW po
  identyfikatorze flow (pierwszy backtick w linii = ten z linii "checkbox:" opisu findingu), FALLBACK po tresci
  po normalizacji (bez markera, bez suffixow) dla linii bez identyfikatora — nie po literalnym "[E2E]".
  JEDEN FLOW = WIELE LINII: po PASS odznacz KAZDA
  niezaznaczona linie "Test:/Weryfikacja: … [E2E]" tej fazy wskazujaca ten sam flow (nie tylko te z "checkbox:"),
  usun z nich suffix "(SKIP — …)"/"(FAIL: …)" i odhacz/usun odpowiadajace kopie "Operator: …"
  w "## Operator checklist faza ${numerFazy}". Po PASS odznacz TAKZE zrodlowy checkbox tej fazy
  w ${sciezka}/*-zadania.md — "- [ ] Test: [E2E] ..." lub "- [ ] Weryfikacja: [E2E] ..." — nie tylko pozycje
  w "Do poprawy". Po fix NIE ma re-review, wiec nikt inny go nie odznaczy, a completion-gate
  (grep niezaznaczonych [E2E]) zatrzymalby run mimo realnego PASS.

ZAKAZ TEST-WEAKENINGU (twardy): NIE modyfikuj istniejacych testow ani asercji zeby przeszly —
napraw IMPLEMENTACJE. Mozesz testy DODAWAC. Oslabienie/usuniecie asercji = niedopuszczalne;
walidacja koncowa audytuje git diff testow w commitach fix i zglosi kazda taka zmiane.

${blokZwinieciaDoPoprawy(sciezka, numerFazy)}

Kolejnosc: KOD -> TEST -> E2E. Po naprawach: pelna walidacja (typecheck, test, build —
komendy z package.json), commit \`fix([nazwa]): poprawki po review fazy ${numerFazy}\`,
staguj tylko zmienione pliki.
${BLOK_DLUGIE_KOMENDY}

GUARD PLIKOW BINARNYCH (po naprawach i commicie, ZANIM zwrocisz wynik — obowiazkowy):
zakres = commity fix tej fazy, ktore wlasnie utworzyles (te same, ktore raportujesz w commity[];
znajdziesz je tak jak walidacja koncowa: \`git log --oneline --grep="^fix("\`) —
uruchom \`git diff --numstat <pierwszy-commit-fixa>^..HEAD\`; gdy nic nie zacommitowales: \`git diff --numstat HEAD\`.
Plik, ktory git widzi jako binarny, ma w numstat "-" zamiast liczb dodanych/usunietych linii.
Do plikiBinarne[] wpisz KAZDY taki plik POZA legalnymi binariami (.png .jpg .jpeg .gif .webp .avif
.ico .bmp, .woff .woff2 .ttf .otf, .pdf .zip .gz .mp4 .mp3, bun.lockb) — plik zrodlowy lub tekstowy
na tej liscie to AWARIA pipeline'u, nie znalezisko.
POWOD (run team-os-onboarding-instalatory, 2026-07-26): fix zapisal do scripts/inbox/invite.mjs regex
z SUROWYMI bajtami sterujacymi (literalne U+0000, U+001F, U+007F) zamiast sekwencji ucieczki
\\x00-\\x1f\\x7f-\\x9f. Plik przestal byc tekstem, a kazdy kolejny agent rozlaczal sie przy jego Read
(APIError) — 6 prob z rzedu i caly run byl martwy. Zapisujac regexy/stringi z bajtami sterujacymi
uzywaj WYLACZNIE sekwencji ucieczki.
NIE probuj naprawiac takiego pliku w tym przebiegu — jego Read zabije rowniez CIEBIE. Zwroc go na liscie.
Gdy nic nie znalazles, zwroc pusta liste (pole jest obowiazkowe: brak listy = orkiestrator nie wie, czy sprawdziles).

KNOWN-ISSUES (graceful — bez osobnego agenta): jesli ZOSTAJA P2 ktorych NIE udalo sie naprawic
(a zero nierozwiazanych P1), zapisz je do ${sciezka}/known-issues.md. Dedup: jesli sekcja
"## Faza ${numerFazy}" juz istnieje — ZASTAP jej cala tresc (od naglowka do nastepnego "## " lub konca pliku),
NIE dopisuj duplikatu. Format: "## Faza ${numerFazy}\\nPozostaje N problemow P2 po fixie. Review: review-faza-${numerFazy}.md\\n- 🟠 [P2] plik — opis".
Po zapisie upewnij sie ze jest DOKLADNIE jeden naglowek "## Faza ${numerFazy}".
Jesli nierozwiazany P2 jest typu E2E: w KAZDEJ zrodlowej linii "- [ ] Test: [E2E] ..." / "- [ ] Weryfikacja: [E2E] ..."
tej fazy wskazujacej ten flow ZASTAP istniejacy suffix "(SKIP — …)"/"(FAIL: …)" (jesli jest) JEDNYM nowym
" (FAIL: <skrot bledu z przebiegu> — known-issues faza ${numerFazy})" — na linii ma byc dokladnie jeden suffix; NIE odznaczaj jej.
Completion-gate rozroznia po tym suffixie "przebiegl i padl na defekcie" od "nigdy nie uruchomiony"; bez
niego operator dostalby falszywa instrukcje "odpal lub zmien na [Manual]" dla znanego defektu.

Dzialaj autonomicznie, nie pytaj usera. Zwroc obiekt FixResult — KRYTYCZNE pola (orkiestrator gate'uje
z nich, bez re-review): nierozwiazaneP1 (P1 ktorych NIE zamknales -> orkiestrator zrobi STOP),
nierozwiazaneP2 (P2 przeniesione do known-issues), walidacja (PASS/FAIL pelnej walidacji),
plikiBinarne (pliki zrodlowe, ktore przestaly byc tekstem -> orkiestrator zrobi STOP).`
}

// ── Kontrola diffu naprawczego (P8: listy K-1…K-7 katalogu A) ─────────────
// Po fixie nie ma re-review, wiec commity fixa oglada jeden agent kontroli. Dawna kontrola (regresje + nowe bramki)
// zlapala 0 z 30 defektow urodzonych w fixie (test review), pre-skan haiku dal 199 trafien bez defektu, a verify-fix
// sprawdzal sama deklaracje naprawy P1. Listy K daja polecenie per klasa defektu, K-6 zastepuje verify-fix (test P1
// pada na kodzie sprzed poprawki), bramki P6 biegna na plikach fixa (w tym niezmiennosc migracji). Pole kazdej listy
// jest wymagane: pusta lista ma wpis, czego i czym szukano.

const WYNIK_LISTY_KONTROLI = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sprawdzono: { type: 'string', description: 'co i jaka komenda sprawdzono — takze przy zerze pozycji albo gdy warunek listy nie zachodzi' },
    pozycje: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plik: { type: 'string', description: 'plik:linia' },
          opis: { type: 'string', description: 'co commity fixa zmienily albo pominely i co poprawic' },
        },
        required: ['plik', 'opis'],
      },
    },
  },
  required: ['sprawdzono', 'pozycje'],
}

// K-6: agent podaje wyniki testow P1, pozycje liczy JS (pozycjeKontroliFixa).
const WYNIK_K6 = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sprawdzono: WYNIK_LISTY_KONTROLI.properties.sprawdzono,
    testy: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          finding: { type: 'string', description: 'plik:linia findingu P1' },
          test: { type: ['string', 'null'], description: 'plik testu dodanego przez fix dla tego P1; null = fix nie dodal testu' },
          czerwonyPrzedPoprawka: { type: 'boolean', description: 'true = test pada na rodzicu najstarszego commita fixa' },
        },
        required: ['finding', 'test', 'czerwonyPrzedPoprawka'],
      },
    },
  },
  required: ['sprawdzono', 'testy'],
}

const KONTROLA_FIXA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    listy: {
      type: 'object',
      additionalProperties: false,
      properties: {
        'K-1': WYNIK_LISTY_KONTROLI, 'K-2': WYNIK_LISTY_KONTROLI, 'K-3': WYNIK_LISTY_KONTROLI, 'K-4': WYNIK_LISTY_KONTROLI,
        'K-5': WYNIK_LISTY_KONTROLI, 'K-6': WYNIK_K6, 'K-7': WYNIK_LISTY_KONTROLI,
      },
      required: ['K-1', 'K-2', 'K-3', 'K-4', 'K-5', 'K-6', 'K-7'],
    },
    bramki: WYNIK_LISTY_KONTROLI,
  },
  required: ['listy', 'bramki'],
}

// Zakres diffu fixa podany wprost z FixResult.commity — bez tego agent szukal "pierwszego commita fixa tej fazy"
// grepem po calej historii zadania (pre-skan: mediana 20 wywolan narzedzi na jeden diff). Gdy fix nie podal hashy,
// zostaje grep po komunikacie commita fixa tej fazy.
function zakresFixa(numerFazy, commity) {
  const hashe = (Array.isArray(commity) ? commity : [])
    .map((c) => String(c).trim().split(/\s+/)[0])
    .filter((h) => /^[0-9a-f]{7,40}$/i.test(h))
  return hashe.length
    ? `Zakres: commity fixa tej fazy (z raportu agenta fixa): ${hashe.join(' ')}.
Najstarszy: ostatni wiersz \`git log --no-walk --format=%h ${hashe.join(' ')}\`. Diff fixa: \`git diff <najstarszy>^..HEAD\`.`
    : `Zakres: \`git log --oneline --grep="^fix("\` -> pierwszy commit fixa fazy ${numerFazy} (komunikat konczy sie "fazy ${numerFazy}").
Diff fixa: \`git diff <pierwszy-commit-fixa>^..HEAD\`; ten commit jest najstarszym commitem fixa.`
}

// Pozycje do tury poprawkowej z wyniku fix:kontrola: pozycje list K-1…K-7 i bramek ze zrodlem. K-6 liczy JS z testow P1:
// test brakujacy albo zielony na kodzie sprzed poprawki nie odtwarza defektu (zastepuje dawny verify-fix).
function pozycjeKontroliFixa(kontrola) {
  const listy = (kontrola && kontrola.listy) || {}
  const zList = Object.keys(listy).sort().flatMap((id) => {
    if (id !== 'K-6') return (listy[id].pozycje || []).map((p) => ({ zrodlo: id, plik: p.plik, opis: p.opis }))
    return (listy[id].testy || []).filter((t) => t.czerwonyPrzedPoprawka !== true).map((t) => ({
      zrodlo: 'K-6',
      plik: t.finding,
      opis: t.test
        ? `test ${t.test} przechodzi na kodzie sprzed poprawki — nie odtwarza defektu P1; popraw test tak, zeby padal przed poprawka`
        : 'naprawa P1 bez testu — dopisz test, ktory pada na kodzie sprzed poprawki',
    }))
  })
  const zBramek = ((kontrola && kontrola.bramki && kontrola.bramki.pozycje) || []).map((p) => ({ zrodlo: 'bramki', plik: p.plik, opis: p.opis }))
  return [...zList, ...zBramek]
}

function kontrolaFixaPrompt(sciezka, numerFazy, commity, findingi) {
  const p1 = findingi.filter((f) => f.severity === 'P1').map((f) => f.plik)
  const worktree = `/tmp/kontrola-fixa-faza-${numerFazy}`
  const plikBramek = `/tmp/bramki-fix-${String(sciezka).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-faza-${numerFazy}.json`
  return `Kontrola commitow fixa fazy ${numerFazy} (zadanie: ${sciezka}). Po fixie nie ma re-review: oceniasz to, co commity
fixa zmienily albo pominely, wg list K-1…K-7 i bramek mechanicznych. Kodu nie poprawiasz — pozycje z wyniku dostaje
jedna tura poprawek.

${zakresFixa(numerFazy, commity)}

Findingi, ktore fix naprawial (lista orkiestratora):
${JSON.stringify(findingi, null, 2)}

Wynik kazdej listy ma pole sprawdzono: co i jaka komenda sprawdziles, takze przy zerze pozycji i gdy warunek listy
nie zachodzi. Pozycja = {plik: "plik:linia", opis: co commity fixa zmienily albo pominely i co poprawic}. Problemy kodu
sprzed fixa nie sa pozycjami — ocenialo je review fazy.

K-1 (regresja, zmiana kontraktu): dla kazdej zmienionej linii commitow fixa wypisz zachowanie przed i po oraz finding,
ktory tego wymagal. Zmiana zachowania bez findingu (nowe pole odpowiedzi, dolozony sygnal, zmieniony kontrakt) to pozycja.
K-2 (gdy diff fixa dodaje albo zmienia bramke walidacyjna: wyrazenie regularne, allowlista, limit rozmiaru, porownanie
originu, sprawdzenie roli, parsowanie wejscia): dla kazdej bramki wypisz trzy konkretne wejscia obejscia i test odmowy,
czyli test, ze zle wejscie zostaje odrzucone. Bramka bez testu odmowy to pozycja z wejsciami obejscia w opisie.
K-3 (defekt urodzony w fixie): wykonaj na diffie fixa trzy listy correctness; kazdy defekt to pozycja.
  L-COR-1: kazda operacja zmieniajaca stan (zapis do bazy, wywolanie z efektem, wysylka) ze wszystkimi drogami do niej
  (handler, trasa, retry, job, inny modul) i plikiem:linia bramki na kazdej drodze. Droga bez bramki, ktora maja inne
  drogi do tej operacji, to defekt.
  L-COR-2: dla kazdego await w sciezce zapisu: co widzi uzytkownik przy odrzuceniu obietnicy i jaki stan zostaje zapisany
  czesciowo. Odpowiedz "nic", "wyjatek bez obslugi" albo "stan rozjechany" to defekt.
  L-COR-3 (gdy diff fixa ma await): kazda wartosc odczytana przed await i uzyta po nim oraz kazdy sygnal zatrzymania
  petli lub ponowien, z informacja, czy po await jest porownanie numeru generacji albo AbortSignal. Uzycie bez porownania
  i petla ponowien bez sufitu to defekt.
K-4 (gdy fix zmienil albo usunal nazwe: funkcja, stala, pole, trasa, klucz tekstu): dla kazdej starej nazwy uruchom
\`git grep -n '<stara nazwa>'\` w calym repo, w tym docs/ i CLAUDE.md. Trafienie poza diffem fixa to pozycja.
K-5: dla kazdej funkcji i bloku zmienionego przez fix wypisz komentarz, JSDoc i akapit dokumentacji, ktory go opisuje,
z ocena zgodnosci. Opis niezgodny z kodem po fixie to pozycja.
K-6 (P1 naprawiane przez fix: ${p1.length ? p1.join(', ') : 'brak — zwroc testy: [] i wpisz to w sprawdzono'}): dla kazdego P1 wskaz
test dodany przez fix i uruchom go na rodzicu najstarszego commita fixa. Worktree: \`git worktree add --detach ${worktree} <najstarszy>^\`
(gdy katalog zostal z poprzedniego przebiegu, najpierw \`git worktree remove --force ${worktree}\`), skopiuj do niego plik testu
z HEAD, dowiaz zaleznosci (\`ln -s "$(git rev-parse --show-toplevel)/node_modules" ${worktree}/node_modules\`, w monorepo takze
node_modules pakietu z testem), uruchom sam ten plik testu komenda testow z package.json, na koniec
\`git worktree remove --force ${worktree}\`. Wpis: {finding: plik:linia P1, test: plik testu albo null, czerwonyPrzedPoprawka:
czy test padl na kodzie sprzed poprawki}. Czy wpis jest pozycja, liczy orkiestrator.
K-7: wypisz pliki commitow fixa, ktorych nie wskazuje zaden finding z listy ani test do niego. Zmiana w takim pliku to
pozycja do cofniecia.

Bramki mechaniczne na plikach fixa (drzewo robocze = stan po fixie):
\`node .claude/scripts/bramki/bramki.mjs --baza <najstarszy>^ > ${plikBramek}; echo "kod: $?"\`, potem Read ${plikBramek}.
Kazde trafienie bramki ze statusem porazka to pozycja w bramki.pozycje, opis "<bramka>: <regula> — <opis>" (migracje
i migracjeSuma = edycja wypchnietej migracji). Status blad, brak i pominieta wpisz w bramki.sprawdzono; ostrzezenia
eslint i trafienia strykera pomijasz.

Repo zostaje bez zmian: piszesz jedynie worktree K-6 i plik wyniku bramek w /tmp, nie commitujesz.
${BLOK_DLUGIE_KOMENDY}`
}

function fixPoprawkaPrompt(sciezka, numerFazy, pozycje, commity) {
  return `Jestes czescia pipeline'u dev-autopilot. To JEDYNA tura poprawek po kontroli commita fix fazy ${numerFazy}.
Kontrola diffu naprawczego znalazla ponizsze pozycje — to rzeczy, ktore wprowadzil albo pominal
sam fix, nie nowe findingi z review.

Folder zadania: ${sciezka}
${zakresFixa(numerFazy, commity)}

DO POPRAWY (lista autorytatywna):
${JSON.stringify(pozycje, null, 2)}

Zasady wg pola zrodlo:
- K-1, K-3: cofnij zmiane zachowania, o ktora nie prosil zaden finding, albo napraw defekt wprowadzony przez fix.
- K-2: dopisz test odmowy — po jednym na wejscie obejscia z opisu; test sprawdza, ze bramka odrzuca zle wejscie.
- K-4: zaktualizuj odwolania do starej nazwy wskazane w opisie (kod, docs/, CLAUDE.md).
- K-5: popraw komentarz, JSDoc albo akapit dokumentacji, zeby opisywal kod po fixie.
- K-6: test P1 ma padac na kodzie sprzed poprawki — dopisz brakujacy test albo przerob test dodany przez fix, zeby
  odtwarzal defekt.
- K-7: cofnij zmiane w pliku, ktorego nie wskazuje zaden finding (\`git diff <najstarszy commit fixa>^ -- <plik>\`).
- bramki: napraw trafienie w kodzie wg reguly; edycja wypchnietej migracji = przywroc plik z rodzica najstarszego
  commita fixa, a zmiane schematu zapisz nowa migracja. Reguly nie wylaczasz (eslint-disable, zmiana konfiguracji).
Testow sprzed fixa nie oslabiasz i nie zmieniasz, zeby przeszly (coding-rules §2).

Po poprawkach: pelna walidacja (typecheck, test, build — komendy z package.json), commit
\`fix([nazwa]): kontrola diffu naprawczego fazy ${numerFazy}\` z jawnym pathspec zmienionych plikow
(ZAKAZ \`git add -A\` i \`git add .\`). Gdy ktorejs pozycji NIE da sie zamknac bez ruszania kodu spoza tej
fazy — zostaw ja i opisz w nienaprawione[]; to nie jest bramka blokujaca faze.
BILANS MUSI SIE ZGADZAC: naprawione + liczba wpisow w nienaprawione[] == liczba pozycji z listy. Kazda
pozycja, ktorej nie naprawiles, MA swoj wpis w nienaprawione[] w formacie "<plik:linia> — <jedno zdanie,
co stoi na przeszkodzie>" (np. "rzutowanie na granicy zewnetrznego SDK, dubler klienta Supabase").
Orkiestrator liczy roznice i pozycje bez sladu wypisuje jako ostrzezenie — "PASS" walidacji nie
zastepuje uzasadnienia.
${BLOK_DLUGIE_KOMENDY}

Zwroc {naprawione, pozostaje, walidacja, nierozwiazaneP1: 0, nierozwiazaneP2: 0, plikiBinarne, nienaprawione}.`
}

function finalValidationPrompt(sciezka) {
  return `Wykonaj pelna walidacje calego projektu po autopilocie (folder zadania: ${sciezka}).
${BLOK_DLUGIE_KOMENDY}

KROK 1 — odkryj komendy (NIE zgaduj): przeczytaj package.json scripts (typecheck/lint/test/build/check),
wykryj package manager (bun.lockb->bun, pnpm-lock->pnpm, yarn.lock->yarn, package-lock->npm).
Brak skryptu typecheck -> sprobuj tsc --noEmit jesli jest tsconfig.json. Build: skrypt build z package.json
(zwykle \`vite build\`). Brak skryptu build -> ustaw build="n/a".

KROK 2 — uruchom w kolejnosci: typecheck -> lint (jesli jest) -> test (pelny suite, wg BLOKU
DLUGICH KOMEND: tlo + polling; flake infra obsluz wg procedury z bloku i DOKONCZ lancuch) -> build.
Zatrzymaj sie dopiero na REALNYM FAIL (flake infra PASS-w-izolacji nie jest FAIL).

KROK 3 — AUDYT TESTOW PO FIXACH: \`git log --oneline --grep="^fix(" \` dla commitow fix tego zadania,
potem \`git diff <zakres>\` zawezony do plikow *.test.* — szukaj ZMIAN W ISTNIEJACYCH asercjach/testach
(usuniecie testu, oslabienie expect, zmiana oczekiwanej wartosci). Nowe testy sa OK. Kazda modyfikacje
istniejacego testu wpisz do testyZmodyfikowane[] (to sygnal test-weakeningu do raportu, nie auto-FAIL).

KROK 4 — jesli REALNY FAIL i potrafisz naprawic prosty problem (import, typ) — napraw, commituj,
uruchom ponownie. Jak nie potrafisz — zapisz liste bledow z lokalizacjami i ustaw wynik=FAIL,
ale NIE KONCZ pracy: kroki 5 i 6 wykonaj ZAWSZE, takze na sciezce FAIL. Krok 5 tylko raportuje,
a krok 6 jest higiena, ktorej pominiecie zostawia operatorowi nieaktualny obraz stanu projektu
dokladnie wtedy, gdy najbardziej go potrzebuje (przy zatrzymanym runie).

KROK 5 — COMPLETION-GATE E2E (krytyczny — chroni przed cichym zamknieciem sprintu z pominietym E2E):
Grepnij zadanie: \`grep -nE '^- \\[ \\].*\\[E2E\\]' ${sciezka}/*-zadania.md | grep -vE 'Operator:|\\[P[123]\\]'\` (brak trafien
= exit 1, to NIE blad; kopie "Operator:" w Operator checklist i pozycje findingow [P1]/[P2]/[P3] w "Do poprawy" nie sa
scenariuszami — liczy sie wylacznie linia zrodlowa Test:/Weryfikacja: w sekcji fazy). Dla kazdego trafienia ustal numer fazy
z najblizszego naglowka "## Faza N" powyzej i wpisz go do e2eFazy[] (unikalne numery) — orkiestrator cofnie
review tych faz do "pending", zeby swiezy run powtorzyl tester zamiast zatrzymywac sie w petli na tym samym gate.
Rozdziel trafienia na DWIE listy:
- linie z suffixem "(FAIL:" -> e2eFail[] — flow PRZEBIEGL i padl na znanym defekcie (fix nie domknal P2, wpis jest
  w known-issues.md). wynik=FAIL, bledy[] += "N scenariuszy [E2E] przebieglo i padlo na defekcie — patrz
  known-issues.md (faza N). NIE zmieniaj ich na [Manual]: to ukryloby znany defekt; napraw kod i odpal flow ponownie."
- pozostale -> e2eNieuruchomione[] — scenariusz NIGDY nie przebiegl. wynik=FAIL, bledy[] += "N scenariuszy [E2E]
  nieuruchomionych — sprint NIE moze sie zamknac z cicho pominietym E2E. Operator musi je
  odpalic LUB przeniesc do Operator checklist ze zmiana markera [E2E] -> [Manual], jesli scenariusz ma byc
  swiadomie wykonany recznie."
UWAGA: ten gate NIE zalezy od istnienia \`.env.e2e\`. Gdyby brak pliku wylaczal bramke, zadanie pelne
scenariuszy [E2E] mogloby zamknac sie cicho jako "OPERATOR" — dokladnie ten scenariusz, przed ktorym
gate ma chronic (regresja e3-core-loop, mobile). Zrodlem prawdy o tym, czy E2E jest wymagane,
jest PLAN ZADANIA, a nie zawartosc repo.
NIE probuj sam odpalac scenariuszy w przegladarce — to gate raportujacy, blokuje archiwizacje.

KROK 6 — PRZEGLAD known-issues.md (higiena, nie bramka — nie zmienia wyniku PASS/FAIL):
Jesli ${sciezka}/known-issues.md istnieje, zweryfikuj KAZDY wpis wzgledem AKTUALNEGO kodu (nie wzgledem tego,
co pisal fix w swojej fazie): przeczytaj wskazany plik/flow i rozstrzygnij, czy problem nadal zachodzi.
- Nadal otwarty -> zostaw w swojej sekcji bez zmian.
- Zamkniety (naprawiony pozniejsza faza, fixem innego findingu albo recznie przez operatora) -> PRZENIES go
  na koniec pliku, do sekcji "## Zamkniete", z jednolinijkowa adnotacja CZYM zostal zamkniety
  (commit / faza / "operator recznie"). NIE kasuj wpisow — historia problemu bywa cenniejsza niz sam wpis.
Liczbe przeniesionych wpisow zwroc w polu knownIssuesZamkniete (NIE w bledy[] — to pole jest dla realnych
FAIL-i z krokow 4/5 i mieszanie tam informacji higienicznej grozi tym, ze ustawisz wynik=FAIL bez powodu).
COMMIT (obowiazkowy, gdy cokolwiek zmieniles w known-issues.md): \`git add <sciezka known-issues.md> &&
git commit -m "docs(known-issues): przenies zamkniete wpisy"\`. Bez commita zostawiasz BRUDNE DRZEWO,
a kolejny run autopilota zatrzyma sie w bootstrapie na bramce czystosci brancha ("niezacommitowane zmiany") —
poprawka higieniczna zablokowalaby wznowienie. Na sciezce FAIL jest to szczegolnie istotne, bo archiwizacja
(dev-docs-complete-wf), ktora normalnie commituje docs/active + docs/completed + smoke operatora + wyjscia compound
(pathspec jawny, nie blanket docs/), w ogole sie nie wykona.
POWOD (run feedback-marcin-poprawki, mobile): wpisy z faz 2 i 3 byly domkniete w pozniejszych fazach, ale plik
dalej prezentowal je jako otwarte problemy — operator czytal miedzy runami nieprawdziwy obraz stanu projektu.

Zwroc obiekt zgodny ze schematem ValidationResult.`
}

// ── Helpery orkiestratora (deterministycznie, w JS) ───────────────────────

// Filar 3: liczniki i gate liczone z findings[], nie z self-reportu scribe'a.
// Efort kazdego agent() jest jawny w opcjach (tabela D6, pilnuje __tests__/klasy-rol.test.mjs); haiku bez efortu.

function policzFindingi(findings) {
  const istotne = (findings || []).filter((f) => f.typ !== 'OPERATOR')
  return {
    p1: istotne.filter((f) => f.severity === 'P1').length,
    p2: istotne.filter((f) => f.severity === 'P2').length,
    p3: istotne.filter((f) => f.severity === 'P3').length,
    operator: (findings || []).length - istotne.length,
  }
}

// Fix naprawia tylko P1/P2 (P8; odwraca plan B1 z 2026-09-03). Fix naprawial 98% findingow lacznie z P3 (138 z 225),
// a kazda zmiana w kodzie to nowa powierzchnia dla defektow urodzonych w fixie — po fixie nie ma re-review. P3 zapisuje
// scribe do known-issues (sekcja "## P3 faza N"), skad ida do opisu PR i bota.
// OPERATOR zostaje poza fixem — to warunki srodowiskowe, ida do "## Operator checklist faza N" i smoke'u operatora.
function otwartePoReview(findings) {
  return (findings || [])
    .filter((f) => f.typ !== 'OPERATOR' && (f.severity === 'P1' || f.severity === 'P2'))
    .map((f) => ({ severity: f.severity, typ: f.typ, plik: f.plik, opis: f.opis }))
}

// Stan sprzed P8 trzyma P3 w otwarteFindingi (plan B1 slal je do fixa). Przy wznowieniu P3 wychodza z listy fixa
// do known-issues; faza po review bez P1/P2 nie ma czego naprawiac. Funkcja nie zmienia wejscia — orkiestrator
// podmienia stan dopiero po potwierdzonym zapisie known-issues, zeby P3 nie zniknely przy padzie agenta.
function odlozP3ZeStanu(fazy) {
  const odlozone = []
  const po = fazy.map((f) => {
    const p3 = f.otwarteFindingi.filter((x) => x.severity === 'P3')
    if (!p3.length) return f
    odlozone.push({ faza: f.numer, findingi: p3 })
    const otwarteFindingi = f.otwarteFindingi.filter((x) => x.severity !== 'P3')
    const fix = f.review === 'done' && f.fix === 'pending' && !otwarteFindingi.length ? 'none' : f.fix
    return { ...f, otwarteFindingi, fix }
  })
  return { fazy: po, odlozone }
}

// Sekcja "## P3 faza N" ma ten sam format co u scribe'a w dev-docs-review-wf.js — walidacja koncowa przeglada ja
// jak kazdy wpis known-issues, smoke operatora ja pomija, opis PR bierze ja do "Swiadomie nienaprawione".
function p3KnownIssuesPrompt(sciezka, odlozone) {
  const sekcje = odlozone.map(({ faza, findingi }) => `## P3 faza ${faza}\n${findingi.map((f) => `- 🟡 [P3] ${f.plik} — ${f.opis}`).join('\n')}`).join('\n\n')
  return `Zapisz nity P3 do ${sciezka}/known-issues.md. Stan pipeline'u sprzed zmiany trzymal je na liscie fixa; fix naprawia
teraz P1 i P2, a P3 zostaja w known-issues.

Sekcje (tresc gotowa, przenies wiersze bez zmian):
--- POCZATEK SEKCJI ---
${sekcje}
--- KONIEC SEKCJI ---

1. Plik nie istnieje: utworz go z ta trescia (bez linii POCZATEK/KONIEC SEKCJI).
2. Plik istnieje: dla kazdej sekcji "## P3 faza N" — naglowek juz jest: dopisz pod nim wiersze, ktorych tam nie ma
   (ten sam plik:linia i ten sam opis = ten sam wiersz), bez duplikatow i bez usuwania istniejacych; naglowka nie ma:
   wstaw cala sekcje przed "## Zamkniete" (gdy jest), inaczej na koncu pliku. Pozostale sekcje zostaja bez zmian.
3. \`git add ${sciezka}/known-issues.md\` i ${instrukcjaCommita('docs(known-issues): P3 ze stanu sprzed zmiany fixa')}
   Gdy plik juz mial wszystkie wiersze, nie commituj.
Zwroc zapisano=true, gdy wszystkie wiersze sa w pliku (dopisane teraz albo juz byly), i hash commita albo null.`
}

// Scalenie findingow, gdy faza jest reviewowana PONOWNIE (audyt 2026-09-06, N2).
//
// Bloker srodowiska i pad testera E2E zostawiaja `faza.review = 'pending'` CELOWO: findingi E2E
// powstaly na zepsutym srodowisku i po naprawie wymagaja swiezego werdyktu. Ale powtorka nadpisywala
// cala liste, wiec razem z ocena E2E przepadala ocena KODU — a ta z awaria srodowiska nie miala nic
// wspolnego. W oferty-online (faza 6) kosztowalo to 11 findingow P3 typu KOD/TEST przy jednym STOP-ie.
//
// Zasada: powtarzamy ocene SRODOWISKA, nie ocene kodu. Findingi typu E2E z poprzedniego podejscia
// odpadaja (tester wystawi nowe), reszta wraca na liste oznaczona jako przeniesiona.
function polaczFindingiPoPowtorce(nowe, poprzednie) {
  const swieze = nowe || []
  const doPrzeniesienia = (poprzednie || []).filter((f) => f.typ !== 'E2E')
  if (!doPrzeniesienia.length) return swieze

  // Dedup po pliku ORAZ tresci: w jednym pliku bywa wiele osobnych defektow, wiec sam plik to za
  // grube sito. Poczatek opisu wystarcza — reviewer opisujacy ten sam defekt zaczyna tak samo,
  // a rozne defekty rozjezdzaja sie w pierwszym zdaniu.
  const kluczem = (f) => `${f.plik}|${(f.opis || '').slice(0, 60).toLowerCase()}`
  const juzJest = new Set(swieze.map(kluczem))

  const przeniesione = doPrzeniesienia
    .filter((f) => !juzJest.has(kluczem(f)))
    .map((f) => ({
      severity: f.severity,
      typ: f.typ,
      plik: f.plik,
      // Oznaczenie jest istotne dla fixa i dla raportu: agent ma wiedziec, ze tego findingu NIE
      // potwierdzil biezacy przebieg reviewerow, wiec najpierw sprawdza, czy defekt nadal istnieje.
      opis: `[z przerwanego review tej fazy — potwierdz, czy nadal aktualny] ${f.opis}`,
    }))
  if (przeniesione.length) {
    log(`Powtorka review: przenosze ${przeniesione.length} finding(ow) z przerwanego podejscia (E2E pominiete — tester wystawil swiezy werdykt)`)
  }
  return [...swieze, ...przeniesione]
}

// ── Bramka wejscia (P4) ───────────────────────────────────────────────────
// Przed pierwsza faza: czystosc drzewa, doctor, zielony start. Agenci zbieraja dane (bootstrap) i wykonuja (commit,
// testy); decyzja zapada tutaj, w funkcjach czystych (__tests__/start-koniec.test.mjs). Brak srodowiska ma wyjsc przed
// startem, nie w domknieciu fazy: zastany czerwony test zatrzymywal run dopiero po zaplaceniu za execute (smoke P0).

// Sciezki z linii `git status --porcelain` (rename `a -> b` daje obie strony, cudzyslow przy spacjach zdjety).
function sciezkiZmian(linie) {
  return linie.flatMap((l) => l.slice(3).split(' -> ')).map((s) => s.replace(/^"(.*)"$/, '$1'))
}

function komendaSwiezegoRunu(sciezka) {
  return `/dev-autopilot-wf ${sciezka}`
}

// Zielony start sprawdzamy przed pierwsza faza. Gdy faza ma execute=done, kod faz testuje juz domkniecie execute.
function decyzjaWejscia(sciezka, wejscie, fazy, cache) {
  const uwagi = []
  const poza = sciezkiZmian(wejscie.zmiany).filter((s) => s !== sciezka && !s.startsWith(`${sciezka}/`))
  if (poza.length) {
    return {
      stop: {
        powod: `niezacommitowane zmiany poza katalogiem zadania: ${poza.join(', ')}`,
        naprawa: `Sprawdz \`git status --short\`, zacommituj albo odloz te zmiany (\`git stash -u\`), potem swiezy run: ${komendaSwiezegoRunu(sciezka)}`,
      },
      commitZadania: false, testyStartu: false, uwagi,
    }
  }
  if (wejscie.doctorKod === 1) {
    return {
      stop: {
        powod: `start: doctor — ${wejscie.doctorWynik || 'brak obowiazkowego narzedzia'}`,
        naprawa: `Zainstaluj braki z kolumny Instalacja (\`bash .claude/scripts/doctor/doctor.sh\` pokazuje tabele), potem swiezy run: ${komendaSwiezegoRunu(sciezka)}`,
      },
      commitZadania: false, testyStartu: false, uwagi,
    }
  }
  if (wejscie.doctorKod !== 0) uwagi.push(`doctor bez wyniku (kod ${wejscie.doctorKod ?? 'brak'}) — sprawdzenie narzedzi pominiete`)
  let testyStartu = true
  if (fazy.some((f) => f.execute === 'done')) {
    testyStartu = false
    uwagi.push('zielony start pominiety: zadanie w toku, kod faz testuje domkniecie execute')
  } else if (cache && cache.wynik === 'PASS' && wejscie.kodJakPrzyTescie === true) {
    testyStartu = false
    uwagi.push(`zielony start z cache: testy PASS na ${cache.sha}, od tego czasu zmiany tylko w docs/`)
  }
  return { stop: null, commitZadania: wejscie.zmiany.length > 0, testyStartu, uwagi }
}

// Czerwony wynik nie trafia do cache: po naprawie testy ida jeszcze raz. Brak wyniku nie zatrzymuje runu (padniety agent
// to nie dowod czerwonego kodu) — wtedy run zachowuje sie jak przed P4, a domkniecie fazy i tak uruchomi testy.
function decyzjaTestowStartu(wynik, sciezka) {
  if (!wynik) return { stop: null, cache: null, uwaga: 'testy startu bez wyniku (agent null) — zielony start niepotwierdzony' }
  if (wynik.wynik === 'BRAK-TESTOW') return { stop: null, cache: null, uwaga: 'projekt bez skryptu testow — zielony start nie dotyczy' }
  if (wynik.wynik === 'FAIL') {
    return {
      stop: {
        powod: `start: testy na starcie galezi czerwone (${wynik.sha}): ${(wynik.bledy || []).join(' | ') || 'brak szczegolow'}`,
        naprawa: `Odtworz: \`${wynik.komenda}\`. Czerwony test zastany na main napraw na main i wciagnij do galezi (\`git merge main\`) albo commitem na galezi zadania. Potem swiezy run: ${komendaSwiezegoRunu(sciezka)}`,
      },
      cache: null, uwaga: null,
    }
  }
  return { stop: null, cache: { sha: wynik.sha, wynik: 'PASS' }, uwaga: null }
}

// CLAUDE.md uzgadnia sie z kodem po merge'u PR (/dev-pr --claude-md), nie przy archiwizacji (P4). Kazdy plik decyzji na
// galezi glownej z `do-uzgodnienia` zatrzymuje kolejne zadanie: wg reguly „tylko ostatni” pominiete uzgodnienie zostaloby
// nieuzgodnione na zawsze (decyzja operatora 2026-10-02). Linie z `git grep -e '^claude_md:' <glowna> -- 'docs/decisions/*.md'`.
function decyzjaClaudeMd(decyzje, sciezka) {
  if (!decyzje.glowna || !decyzje.katalog) {
    return { stop: null, uwaga: `brak docs/decisions/ na galezi glownej (${decyzje.glowna || 'nie ustalono'}) — warunek CLAUDE.md po merge'u pominiety` }
  }
  const pliki = decyzje.linie
    .map((l) => l.slice(decyzje.glowna.length + 1).match(/^(docs\/decisions\/([^:]+)\.md):claude_md:\s*(\S+)/))
    .filter((m) => m && m[3] === 'do-uzgodnienia')
    .map((m) => ({ plik: m[1], zadanie: m[2].replace(/^\d{4}-\d{2}-\d{2}-/, '') }))
  if (!pliki.length) return { stop: null, uwaga: null }
  return {
    stop: {
      powod: `start: CLAUDE.md nieuzgodniony po merge'u — ${pliki.map((p) => p.plik).join(', ')} (claude_md: do-uzgodnienia)`,
      naprawa: `\`git switch ${decyzje.glowna}\` (z remote takze \`git pull --ff-only\`), potem ${pliki.map((p) => `/dev-pr --claude-md ${p.zadanie}`).join(', ')} (albo recznie claude_md: uzgodniono i commit na ${decyzje.glowna}), wroc na galaz zadania i swiezy run: ${komendaSwiezegoRunu(sciezka)}`,
    },
    uwaga: null,
  }
}

function fazyUkonczone(fazy) {
  return fazy.filter((f) => f.execute === 'done' && f.review === 'done' && (f.fix === 'done' || f.fix === 'none')).length
}

// Agent haiku wpisal raz Co-Authored-By w druga linie tematu (commit 2c97286, przeglad runow 19.09) — stopka bez pustej linii.
function instrukcjaCommita(temat) {
  return `\`git commit -m "${temat}"\` — temat w jednej linii. Stopke (np. Co-Authored-By) dopisujesz wylacznie drugim \`-m\`: git oddziela ja wtedy pusta linia.`
}
// ── Koniec bramki wejscia ─────────────────────────────────────────────────

// ── Orkiestracja ──────────────────────────────────────────────────────────

// Sanityzacja args — UI wstrzykuje prefix '@' (mention) i czesto trailing '/'.
const sciezkaRaw = typeof args === 'string' ? args : args && args.sciezka
const sciezka = sciezkaRaw && sciezkaRaw.replace(/^@/, '').replace(/\/+$/, '')
if (!sciezka) {
  return {
    status: 'STOP',
    powod: 'brak sciezki zadania. Przy starcie: args:"docs/active/<zadanie>". Przy RESUME (scriptPath+resumeFromRunId): przekaz args PONOWNIE — nie przenosi sie z poprzedniego runu.',
  }
}

// Stan runu zadeklarowany PRZED pierwsza bramka (port z mobile, 2026-08-08): stopRun czyta `raporty`, a kazda zmienna,
// ktora czyta, musi istniec, zanim jakikolwiek STOP bedzie mogl zapasc.
// Telemetria (It. 1): zapis i koszt robi skrypt po runie (.claude/scripts/telemetria/zbierz.mjs z hooka Stop) z pliku
// harnessu i transkryptow — workflow nie wola agenta telemetrii i nie liczy tokenow z budzetu runu (tylko output, ~11% kosztu).
const historia = {}
const raporty = []
let kolejka
let e2eEnv = null
let stan = null
// Stan fazy do zapisu (P7): tresc czekajaca na nastepnego agenta i tresc doklejona do jego polecenia.
let stanDoZapisu = null
let stanDoklejony = null
let compound = null

// Normalizacja metryk przebiegu do SKROTU (schemat METRYKI_FAZY + telemetria): review-wf zwraca
// pelny obiekt (pominieci = [{key,powod}]), a stan po resume trzyma juz skrot (pominieci = ['key']).
// Jedna funkcja, zeby stan i telemetria mialy IDENTYCZNY kształt niezaleznie od zrodla.
function skrotPrzebiegu(p) {
  if (!p) return null
  return {
    pominieci: (p.pominieci || []).map((x) => (typeof x === 'string' ? x : x.key)),
    // null = przebieg ze STARSZEGO stanu, ktory tego pola nie zna (patrz METRYKI_FAZY) — konsument
    // telemetrii ma widziec brak danych, nie zgadywany tryb.
    e2eTryb: p.e2eTryb || null,
    znalezione: p.znalezione,
    poDedupJs: p.poDedupJs,
    poDedupSem: p.poDedupSem,
    weryfikowane: p.weryfikowane,
    obalone: p.obalone,
    p3Odrzucone: p.p3Odrzucone ?? null,
    // E2E: faza, w ktorej wszystkie [E2E] spadly do SKIP, musi byc odroznialna w stanie i telemetrii od fazy 100% PASS.
    e2eCheckboxy: p.e2eCheckboxy ?? null,
    e2eStatus: p.e2eStatus ?? null,
    e2ePass: p.e2ePass ?? null,
    e2eFail: p.e2eFail ?? null,
    e2eSkip: p.e2eSkip ?? null,
    // Metryki kosztu review (audyt 2026-09-06, N3). Do tej pory review-wf je liczyl, ale ta funkcja
    // ich NIE przepisywala — a to ona decyduje, co wchodzi do stanu i do wpisu JSONL. Bez nich
    // telemetria pokazywala `dossier: undefined` we wszystkich fazach i progi 2 oraz pozycje A7/B4
    // planu naprawy nie mialy na czym stanac. null = przebieg ze starszego runu, ktory tego nie zna.
    dossier: p.dossier ?? null,
    sceptycy: p.sceptycy
      ? { p1: p.sceptycy.p1 ?? null, p2Grupy: p.sceptycy.p2Grupy ?? null, p2Findingi: p.sceptycy.p2Findingi ?? null }
      : null,
    severityKorekty: p.severityKorekty
      ? { przyjete: p.severityKorekty.przyjete ?? null, odrzucone: p.severityKorekty.odrzucone ?? null }
      : null,
    tiery: p.tiery || null,
  }
}

// Podsumowanie tury poprawkowej po kontroli diffu naprawczego (audyt 2026-09-06, N9).
// Do tej pory do stanu i telemetrii szlo tylko {pozycje, naprawione, walidacja} — a agent poprawki
// podaje w nienaprawione[] uzasadnienia pozycji, ktorych nie ruszyl, i orkiestrator je WYRZUCAL.
// Dowod: oferty-online faza 5 — 61 pozycji, 55 naprawionych, walidacja PASS; commit opisuje 4 swiadome
// wyjatki (granica zewnetrznego SDK), wiec 2 pozycje nie mialy zadnego sladu. `bezSladu` to dokladnie
// ta luka: policzona deterministycznie, zeby PASS przy 55/61 nie udawal PASS przy 61/61.
function podsumujKontroleFixa(pozycje, poprawka) {
  const pominiete = Array.isArray(poprawka.nienaprawione) ? poprawka.nienaprawione.filter((x) => typeof x === 'string' && x.trim()) : []
  const naprawione = Number.isInteger(poprawka.naprawione) ? poprawka.naprawione : 0
  return {
    pozycje,
    naprawione,
    walidacja: poprawka.walidacja,
    pominiete,
    bezSladu: Math.max(0, pozycje - naprawione - pominiete.length),
  }
}

// Wynik sprzatania artefaktow przy STOP-ie (plan B2).
const P3_KNOWN_ISSUES = {
  type: 'object',
  additionalProperties: false,
  properties: {
    zapisano: { type: 'boolean', description: 'true, gdy kazdy wiersz P3 jest w known-issues.md (dopisany teraz albo juz byl)' },
    commit: { type: ['string', 'null'], description: 'krotki hash nowego commita albo null' },
  },
  required: ['zapisano', 'commit'],
}

const COMMIT_ARTEFAKTOW = {
  type: 'object',
  additionalProperties: false,
  properties: {
    zacommitowano: { type: 'boolean', description: 'true tylko gdy powstal NOWY commit; false takze wtedy, gdy nie bylo czego commitowac' },
    commit: { type: ['string', 'null'], description: 'krotki hash nowego commita albo null' },
    brudnePozaZadaniem: {
      type: 'array',
      items: { type: 'string' },
      description: 'sciezki z `git status --short` SPOZA katalogu zadania — nietkniete, ida do komunikatu STOP',
    },
    stanZapisany: POLE_STANU,
  },
  required: ['zacommitowano', 'brudnePozaZadaniem'],
}

// Najczestszy STOP w telemetrii (6 na 39 runow) to "niezacommitowane zmiany" — i ZAWSZE bezposrednio
// po innym zatrzymaniu. Mechanizm: zapis stanu tworzy .autopilot-state.json, scribe zapisuje
// review-faza-N.md, po czym run staje na bramce i NIKT tego nie commituje. Bootstrap nastepnego runu
// widzi brudne drzewo i zatrzymuje sie na bramce czystosci — operator dostaje falszywy STOP o cudzych
// zmianach, ktorych nie ma, i musi recznie zacommitowac artefakty pipeline'u.
//
// Sprzatamy WYLACZNIE `docs/active/<zadanie>/` (plan B2, wariant rekomendowany). Kod fazy zostaje
// nietkniety, a semantyka bramki czystosci sie nie zmienia: ona dalej chroni przed uruchomieniem
// autopilota na cudzych zmianach — tyle ze te zmiany to juz NIE sa nasze wlasne artefakty.
async function zacommitujArtefaktyStop(faza) {
  // Przed bootstrapem nie znamy ani zadania, ani sciezki — nie ma czego i gdzie commitowac.
  if (!sciezka || !stan || !stan.nazwaZadania) return null
  // Bramka brancha jest WCZESNIEJ niz ten commit i nie wolno jej ominac: przy STOP-ie "branch mismatch"
  // siedzimy na cudzej galezi (typowo main), a artefakty zadania naleza do feature/<zadanie>. Commit
  // tutaj wsadzilby dokumentacje zadania do niewlasciwej historii — gorzej niz brudne drzewo.
  if (stan.branch && stan.branch.zgodny === false) {
    log('Commit artefaktow przy STOP pominiety — jestesmy na niewlasciwym branchu, artefakty zostaja w drzewie')
    return null
  }
  const opisFazy = Number.isInteger(faza) ? ` (faza ${faza})` : ''
  return await zacommitujKatalogZadania(`docs(${stan.nazwaZadania}): stan pipeline'u po STOP${opisFazy}`, 'stop:commit-artefaktow')
}

// Commit WYLACZNIE katalogu zadania: przy STOP-ie (artefakty pipeline'u) i na starcie (zmiany operatora w katalogu
// zadania, rek. 4 przegladu runow — wczesniej falszywy STOP "niezacommitowane zmiany" po edycji zadan).
async function zacommitujKatalogZadania(temat, etykieta) {
  const polecenie = `Zacommituj tylko zmiany w katalogu zadania \`${sciezka}/\` — to pliki zadania i artefakty pipeline'u,
a brudne drzewo zatrzymuje bootstrap kolejnego runu na bramce czystosci.

1. \`git status --short\` — zapamietaj pelna liste.
2. Z tej listy wyodrebnij sciezki SPOZA \`${sciezka}/\`. Nie dotykaj ich w zaden sposob: nie dodawaj,
   nie stashuj, nie cofaj. Zwroc je w brudnePozaZadaniem[] — ida do komunikatu dla operatora.
3. Jesli w \`${sciezka}/\` sa jakiekolwiek zmiany (zmodyfikowane, nowe lub usuniete):
   \`git add ${sciezka}/\` — dokladnie ten pathspec, bez \`git add -A\` i \`git add .\` — a potem
   ${instrukcjaCommita(temat)}
   Zwroc zacommitowano=true i krotki hash z \`git rev-parse --short HEAD\`.
4. Jesli w \`${sciezka}/\` nie ma zmian — nic nie commituj, zwroc zacommitowano=false i commit=null.
5. Gdy \`git commit\` zwroci blad (np. hook odrzucil), nie obchodz go flagami (\`--no-verify\`,
   \`-f\`): zwroc zacommitowano=false i commit=null. Falszywy commit jest gorszy niz brudne drzewo.

Nie modyfikuj plikow, nie uruchamiaj testow, nie przelaczaj brancha.`
  // Przy STOP-ie agent najpierw zapisuje zalegly stan (P7), wiec plik stanu trafia do tego samego commita.
  return etykieta === 'stop:commit-artefaktow'
    ? await agent(zeStanem(polecenie), { schema: COMMIT_ARTEFAKTOW, agentType: 'klasa-mechaniczny', label: 'stop:commit-artefaktow' })
    : await agent(polecenie, { schema: COMMIT_ARTEFAKTOW, agentType: 'klasa-mechaniczny', label: 'start:commit-zadania' })
}

// Kazde zatrzymanie runu przechodzi TEDY — inaczej bramka, ktora zadziala, nie zostawia po sobie danych.
async function stopRun(obj) {
  // try/catch, bo to wywolanie wola agenta, a najczestsza przyczyna STOP-u bywa przeciazenie API (529).
  // Rzucony wyjatek zabralby operatorowi komunikat bramki (`powod`, `naprawa`).
  let artefakty = null
  try {
    artefakty = await zacommitujArtefaktyStop(obj.faza)
  } catch (e) {
    log(`Commit artefaktow przy STOP nie powiodl sie (${e && e.message ? e.message : e}) — best-effort, komunikat STOP wraca normalnie`)
  }
  // Stan oznaczony przed STOP-em zapisuje agent commita; gdy go pominieto, padl albo nie potwierdzil — zapis zapasowy.
  try {
    await potwierdzStan(artefakty)
    await zapiszZaleglyStan()
  } catch (e) {
    log(`Zapis stanu przy STOP nie powiodl sie (${e && e.message ? e.message : e}) — sprawdz .autopilot-state.json przed swiezym runem`)
  }
  let powod = obj.powod
  if (artefakty) {
    if (artefakty.zacommitowano) {
      log(`Artefakty pipeline'u zacommitowane przed STOP-em: ${artefakty.commit || '(brak hasha)'} — bootstrap nastepnego runu nie stanie na bramce czystosci`)
    }
    const brudne = artefakty.brudnePozaZadaniem || []
    if (brudne.length) {
      powod = `${powod} UWAGA: poza katalogiem zadania zostaly niezacommitowane zmiany (${brudne.join(', ')}) — NIE tknelismy ich, ale bramka czystosci nastepnego runu na nich stanie.`
    }
  }
  // Fazy domkniete w zadaniu (nie w tym runie): STOP na fazie 3 z 3 po dwoch zielonych to nie porazka calego zadania.
  const ukonczone = stan && Array.isArray(stan.fazy) ? fazyUkonczone(stan.fazy) : null
  return { status: 'STOP', ...obj, powod, fazyUkonczone: ukonczone, artefaktyStop: artefakty }
}

phase('Bootstrap')
stan = await agent(bootstrapPrompt(sciezka), { schema: PLAN_STATE, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: 'bootstrap' })
if (!stan) {
  return await stopRun({ powod: 'bootstrap nie zwrocil stanu (agent null)' })
}

// Decyzja A: git zwalidowany w sesji przed odpaleniem; tu tylko bezpiecznik.
if (!stan.branch.zgodny) {
  return await stopRun({ powod: `branch mismatch: jestes na "${stan.branch.aktualny}", wymagany "${stan.branch.wymagany}"`, stan })
}
for (const r of stan.rozbieznosci || []) log(`Bootstrap rozbieznosc (informacyjna): ${r}`)

// Bramka wejscia (P4): STOP z gotowa komenda przed pierwsza faza, decyzja w decyzjaWejscia.
const wejscie = decyzjaWejscia(sciezka, stan.wejscie, stan.fazy, stan.bazaZielona || null)
for (const u of wejscie.uwagi) log(`Bramka wejscia: ${u}`)
if (wejscie.stop) {
  return await stopRun({ ...wejscie.stop, stan })
}
const claudeMd = decyzjaClaudeMd(stan.wejscie.decyzje, sciezka)
if (claudeMd.uwaga) log(`Bramka wejscia: ${claudeMd.uwaga}`)
if (claudeMd.stop) {
  return await stopRun({ ...claudeMd.stop, stan })
}
if (wejscie.commitZadania) {
  const commitZadania = await zacommitujKatalogZadania(`docs(${stan.nazwaZadania}): zmiany w katalogu zadania przed runem`, 'start:commit-zadania')
  if (!commitZadania || !commitZadania.zacommitowano || commitZadania.brudnePozaZadaniem.length) {
    return await stopRun({
      powod: `niezacommitowane zmiany w katalogu zadania — commit na starcie sie nie udal${commitZadania && commitZadania.brudnePozaZadaniem.length ? ` (poza zadaniem: ${commitZadania.brudnePozaZadaniem.join(', ')})` : ''}`,
      naprawa: `Zacommituj recznie: \`git add ${sciezka}/ && git commit -m "docs(${stan.nazwaZadania}): zmiany w katalogu zadania"\`, potem swiezy run: ${komendaSwiezegoRunu(sciezka)}`,
      stan,
    })
  }
  log(`Bramka wejscia: zmiany w katalogu zadania zacommitowane (${commitZadania.commit || 'brak hasha'})`)
}
if (wejscie.testyStartu) {
  const testy = await agent(testyStartuPrompt(), { schema: TESTY_STARTU, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: 'start:testy' })
  const d = decyzjaTestowStartu(testy, sciezka)
  if (d.stop) return await stopRun({ ...d.stop, stan })
  if (d.uwaga) log(`Bramka wejscia: ${d.uwaga}`)
  if (d.cache) {
    stan.bazaZielona = d.cache
    log(`Bramka wejscia: zielony start (${testy.komenda}) na ${d.cache.sha}`)
    // Zapisuje e2e:precheck (nastepny agent); STOP srodowiska E2E commituje katalog zadania, wiec swiezy run wezmie wynik z cache.
    oznaczStan()
  }
}

// Stan sprzed P8 (P3 na liscie fixa): P3 do known-issues, potem stan bez nich. Bez zapisu P3 zniknelyby przy wznowieniu.
const p3ZeStanu = odlozP3ZeStanu(stan.fazy)
if (p3ZeStanu.odlozone.length) {
  const zapisP3 = await agent(p3KnownIssuesPrompt(sciezka, p3ZeStanu.odlozone), { schema: P3_KNOWN_ISSUES, agentType: 'klasa-mechaniczny', label: 'start:p3-known-issues' })
  if (!zapisP3 || !zapisP3.zapisano) {
    return await stopRun({
      powod: `stan sprzed zmiany fixa trzyma P3 na liscie fixa (fazy ${p3ZeStanu.odlozone.map((o) => o.faza).join(', ')}), a zapis do known-issues.md sie nie udal`,
      naprawa: `Sprawdz ${sciezka}/known-issues.md i odpal swiezy run: ${komendaSwiezegoRunu(sciezka)}`,
      stan,
    })
  }
  stan.fazy = p3ZeStanu.fazy
  oznaczStan()
  log(`Stan sprzed zmiany fixa: ${p3ZeStanu.odlozone.reduce((n, o) => n + o.findingi.length, 0)}x P3 przeniesione do known-issues (fix naprawia P1/P2)`)
}

// Filar 2: kolejka liczona w JS ze stanu — zero interpretacji LLM.
kolejka = stan.fazy
  .filter((f) => f.execute === 'pending' || f.review === 'pending' || f.fix === 'pending')
  .map((f) => f.numer)

log(`Autopilot: ${stan.nazwaZadania} (stan: ${stan.zrodloStanu}) — fazy do wykonania: ${kolejka.join(', ') || 'brak'}`)

// Zapis zapasowy: tani leaf-agent (haiku) przed pod-workflowem i po niepotwierdzonym zapisie nastepcy. Best-effort z ostrzezeniem.
async function zapiszStan(tresc) {
  let w = await agent(zapiszStanPrompt(sciezka, tresc), { schema: ZAPIS_STANU, agentType: 'klasa-mechaniczny', label: 'stan:zapis' })
  // Nieudany zapis LUB plik, ktory nie sparsowal sie z dysku, to ten sam problem: stanu na dysku NIE MA.
  // Jedna ponowna proba (na modelu glownym — haiku wlasnie pokazal, ze nie uniosl przepisania tresci).
  if (!w || !w.zapisano || w.poprawnyJson === false) {
    log(`Zapis .autopilot-state.json nieudany (${!w ? 'agent null' : w.poprawnyJson === false ? 'plik nie parsuje sie jako JSON' : 'zapisano=false'}) — ponawiam raz`)
    w = await agent(zapiszStanPrompt(sciezka, tresc), { schema: ZAPIS_STANU, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: 'stan:zapis:retry' })
  }
  if (!w || !w.zapisano || w.poprawnyJson === false) {
    log('OSTRZEZENIE: .autopilot-state.json NIE zostal poprawnie zapisany po 2 probach — resume bedzie polegac na parse md, a uszkodzony plik moze wywrocic nastepny bootstrap. Sprawdz go recznie przed kolejnym runem.')
  }
}

// Stan fazy (P7): oznaczStan() liczy tresc w JS po kazdej zmianie stanu; zapisuje ja nastepny agent z doklejonym blokiem
// (zeStanem + potwierdzStan). Przed pod-workflowem zalegly stan idzie do agenta stan:zapis; po complete-wf zapisu nie ma.
function oznaczStan() {
  stanDoZapisu = trescStanu(stan)
}

function zeStanem(polecenie) {
  if (!stanDoZapisu) return polecenie
  stanDoklejony = stanDoZapisu
  stanDoZapisu = null
  return `${polecenie}\n\nPrzed zadaniem opisanym wyzej wykonaj zapis stanu. Ten zapis jest czescia zadania, takze gdy polecenie wyzej zabrania zmian w plikach.\n${blokZapisuStanu(sciezka, stanDoklejony)}`
}

async function potwierdzStan(wynik) {
  const tresc = stanDoklejony
  stanDoklejony = null
  if (!tresc || zapisPotwierdzony(wynik)) return
  log(`Zapis stanu doklejony do agenta niepotwierdzony (${wynik ? `stanZapisany=${wynik.stanZapisany}` : 'agent null'}) — zapis zapasowy`)
  await zapiszStan(tresc)
}

async function zapiszZaleglyStan() {
  if (!stanDoZapisu) return
  const tresc = stanDoZapisu
  stanDoZapisu = null
  await zapiszStan(tresc)
}

// Srodowisko E2E PRZED warmupem: tani gate (precheck + wczesne checki env-up) zatrzymuje run
// zanim zaplacimy za rozgrzewke cache. Dev server Vite hot-reloaduje working tree, wiec stawiamy raz per run.
//
// BRAMKA OPT-IN (2026-06-16, regresja etap-11): status decyduje czy run leci dalej.
//   'pominieto'     = brak .env.e2e I zadanie nie ma zadnego [E2E] -> projekt faktycznie nie chce E2E ->
//                     degradacja do OPERATOR. Gdy zadanie MA [E2E], run nie dochodzi tutaj — zatrzymuje
//                     go bramka setupu wyzej (brak srodowiska != swiadoma rezygnacja).
//   'niepowodzenie' = .env.e2e ISTNIEJE, ale srodowisko nie gotowe
//                     -> HARD STOP w bootstrapie, PRZED jakakolwiek faza (E2E nie znika cicho do OPERATOR).
//   'gotowe'        = dev server Vite na dedykowanej bazie e2e -> E2E aktywne.
//
// PRECHECK: tani, deterministyczny sygnal opt-in ODDZIELONY od ciezkiego env-up. Bez niego flake env-up
// (null) na projekcie opt-in degradowalby cicho E2E — a completion-gate wylapalby to dopiero na KONCU runu
// (najdrozszy moment). Z precheckiem: opt-in potwierdzony -> null env-up = STOP, nie degradacja.
const precheck = await agent(zeStanem(e2ePrecheckPrompt(sciezka)), { schema: E2E_PRECHECK, agentType: 'klasa-mechaniczny', label: 'e2e:precheck', phase: 'Bootstrap' })
await potwierdzStan(precheck)
const optIn = precheck ? precheck.istnieje : null // null = precheck padl (nie wiemy — env-up ma self-skip)

// BRAMKA SETUPU (port z mobile, regresja e3-core-loop): zadanie DEKLARUJE scenariusze [E2E], a repo nie ma
// srodowiska. Wczesniej ta kombinacja byla nieodrozanialna od "projekt nie chce E2E" i degradowala sie
// cicho do OPERATOR — run jechal przez wszystkie fazy, a brak srodowiska wychodzil dopiero na
// completion-gate, czyli po zaplaceniu za CALA prace. Teraz STOP przed faza 1, gdy jest najtaniej.
if (optIn === false && precheck.zadanieWymagaE2E) {
  return await stopRun({
    powod: `zadanie deklaruje ${precheck.liczbaScenariuszy} scenariuszy [E2E], a repo nie ma .env.e2e — srodowisko E2E nie jest skonfigurowane. Run zatrzymany PRZED faza 1: bez srodowiska te scenariusze i tak nie zostana wykonane, a etap nie domknie sie na completion-gate.`,
    naprawa: 'One-time setup wg .claude/templates/e2e-env/README.md (dedykowany projekt Supabase e2e, .env.e2e, gitignore, tryb --mode e2e w Vite, konto testowe). Swiadomy opt-out (scenariusz wykonasz recznie): przenies te pozycje do "Operator checklist" i zmien marker [E2E] na [Manual] w pliku zadania. Po setupie odpal SWIEZY run (te same args, BEZ resumeFromRunId).',
    stan,
  })
}

if (optIn !== false) {
  // Opt-in TAK lub nieznany -> odpal env-up (ma wlasny self-skip gdy .env.e2e faktycznie nie ma).
  e2eEnv = await agent(e2eEnvUpPrompt(), { schema: E2E_ENV_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: 'e2e:env-up', phase: 'Bootstrap' })
  if (!e2eEnv && optIn === true) {
    // Opt-in POTWIERDZONY przez precheck, a ciezki env-up padl -> jeden retry (infra hiccup bywa przejsciowy).
    log('E2E env-up: agent zwrocil null przy potwierdzonym .env.e2e — retry raz')
    e2eEnv = await agent(e2eEnvUpPrompt(), { schema: E2E_ENV_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: 'e2e:env-up:retry', phase: 'Bootstrap' })
    if (!e2eEnv) {
      // Drugi null przy potwierdzonym opt-in -> STOP (nie degraduj cicho, jak przy 'niepowodzenie').
      return await stopRun({
        powod: 'E2E env-up zwrocil null 2x przy istniejacym .env.e2e (projekt opt-in E2E) — nie degraduje cicho do OPERATOR. To infra/agent hiccup, nie brak setupu.',
        naprawa: 'Sprawdz srodowisko (dev server Vite / port 5173 / baza e2e) i odpal SWIEZY run (te same args, BEZ resumeFromRunId). UWAGA: dwa nulle POD RZAD bez zuzytych tokenow i bez wywolan narzedzi to zwykle przeciazenie API (529 Overloaded), a nie problem srodowiska — wtedy natychmiastowe ponawianie tylko doklada ruchu. Odczekaj kilkanascie minut albo odpal run przez `/loop <interwal> /dev-autopilot-wf <sciezka>`.',
        stan,
      })
    }
  }
}
log(`E2E env: ${e2eEnv ? `${e2eEnv.status} (devServer: ${e2eEnv.devServer}) — ${e2eEnv.detal}` : `pomijam E2E (${optIn === false ? 'brak .env.e2e, a zadanie nie deklaruje zadnego scenariusza [E2E] — projekt nie opt-in' : 'precheck padl i env-up null — infra'})`}`)
if (e2eEnv && e2eEnv.status === 'niepowodzenie') {
  return await stopRun({
    powod: `Srodowisko E2E nie gotowe, a .env.e2e istnieje (projekt wymaga E2E): ${e2eEnv.detal}`,
    naprawa: 'Setup: .claude/templates/e2e-env/README.md. Najczestsze braki = niepoprawne klucze VITE_*/SUPABASE_E2E_* w .env.e2e, brak dedykowanego projektu Supabase e2e (guard tozsamosci: VITE_SUPABASE_URL musi sie ROZNIC od .env), albo zajety port 5173. Opt-out swiadomego runu headless: usun/zmien nazwe .env.e2e I zdejmij markery [E2E] z planu zadania (bramka setupu czyta plan). Po setupie odpal SWIEZY run (te same args, BEZ resumeFromRunId — resume zwrociloby zcache\'owana porazke env-up; stan faz wznowi sie z .autopilot-state.json).',
    e2eEnv,
    stan,
  })
}
const e2eAktywne = !!e2eEnv && e2eEnv.status === 'gotowe'

// Filar 1: rozgrzewka cache vitest — PO bramce E2E (tani gate first). Self-skip gdy brak vitest; warm = sekundy.
// Chroni tez walidacje koncowa przy pustej kolejce (np. resume po ukonczonych fazach na zimnej maszynie).
const warmup = await agent(warmupPrompt(sciezka), { schema: WARMUP_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: 'warmup:vitest', phase: 'Bootstrap' })
if (!warmup) {
  return await stopRun({ powod: 'rozgrzewka nie zwrocila wyniku (agent null)', stan })
}
log(`Rozgrzewka: ${warmup.status} — ${warmup.detal} (zimny: ${warmup.czasZimnySek ?? 'n/a'}s, kontrolny: ${warmup.czasKontrolnySek ?? 'n/a'}s)`)
// Warmup to OPTYMALIZACJA, nie warunek poprawnosci — 'niepowodzenie' degraduje z ostrzezeniem,
// nie zatrzymuje runu (prog <60s kontrolnego biegu jest maszyno-zalezny; na wolnym sprzecie
// poprawny cache potrafi go przekroczyc). Agenci faz i tak maja BLOK_DLUGIE_KOMENDY (tlo+polling).
if (warmup.status === 'niepowodzenie') {
  log(`OSTRZEZENIE: rozgrzewka cache niepotwierdzona (${warmup.detal}) — kontynuuje; agenci faz musza scisle stosowac procedure tla dla zimnych biegow`)
}

for (const numerFazy of kolejka) {
  const faza = stan.fazy.find((f) => f.numer === numerFazy)
  if (!faza) {
    return await stopRun({ powod: `kolejka zawiera faze ${numerFazy} nieobecna w fazy[] — niespojny stan bootstrapu`, raporty })
  }
  phase(`Faza ${numerFazy}`)
  let gateFazy = 'CZYSTE'
  let cykle = 0
  let e2eSync = null
  // Metryki fazy: przy resume review moze byc juz 'done' i review-wf sie NIE odpali — wtedy liczniki
  // i przebieg czytamy z faza.metryki utrwalonych w stanie (bez tego telemetria dostawala null).
  const metrykiZeStanu = faza.metryki || {}
  let licznikiFazy = metrykiZeStanu.liczniki || null
  let przebiegFazy = metrykiZeStanu.przebieg || null
  let fixInfo = null
  // Wynik kontroli diffu naprawczego (plan B5) — do raportu fazy i telemetrii.
  let kontrolaFixa = null

  // 1) EXECUTE — tylko gdy pending (resume nigdy nie powtarza ukonczonego execute, w tym migracji).
  // Dossier fazy z domkniecia (P7) idzie do review; faza wznowiona z execute: done go nie ma — review-wf odtwarza je
  // zapasowym agentem (kod mogl sie zmienic po STOP-ie, plik w /tmp bylby nieaktualny) z baza fazy utrwalona w stanie.
  // Stan „execute done” z baza zapisuje domkniecie execute-wf (args.stanPoExecute); bez potwierdzenia — zapis zapasowy.
  let dossierZExecute = null
  if (faza.execute === 'pending') {
    await zapiszZaleglyStan()
    const exec = await workflow('dev-docs-execute-wf', { sciezka, faza: numerFazy, stanPoExecute: trescStanu(stanPoExecute(stan, numerFazy)) })
    if (!exec || exec.status !== 'completed') {
      // Domkniecie mialo zapisac stan tylko przy completed; gdy mimo to potwierdzilo zapis, STOP nadpisuje go stanem z pamieci.
      if (exec && exec.stanZapisany) oznaczStan()
      return await stopRun({ powod: `execute fazy ${numerFazy} zwrocil "${exec ? exec.status : 'null'}"${exec && exec.problem ? `: ${exec.problem}` : ''}`, faza: numerFazy, exec, raporty })
    }
    faza.execute = 'done'
    faza.baza = exec.baza || null
    dossierZExecute = exec.dossier || null
    if (!zapisPotwierdzony(exec)) {
      log(`Faza ${numerFazy}: domkniecie nie potwierdzilo zapisu stanu — zapis zapasowy`)
      await zapiszStan(trescStanu(stan))
    }
    log(`Faza ${numerFazy}: Execute OK (${exec.iu.length} IU)`)
  }

  // 2) REVIEW — tylko gdy pending. Faza ukonczona z otwartymi findingami idzie PROSTO do fix (Bug 1).
  if (faza.review === 'pending') {
    // Findingi z PRZERWANEGO podejscia do tej fazy (STOP na blokerze srodowiska albo padzie testera
    // E2E zostawia review=pending z niepusta lista). Zapamietane PRZED review, bo `faza.otwarteFindingi`
    // zaraz zostanie nadpisane wynikiem nowego przebiegu — patrz polaczFindingiPoPowtorce (audyt N2).
    const findingiPrzedPowtorka = faza.otwarteFindingi.slice()
    // Sync bazy e2e per faza PO execute (migracje fazy powstaja w execute, db push jest
    // przyrostowy — brak nowych migracji = no-op). Niepowodzenie nie blokuje review:
    // tester E2E trafi na brak danych i sklasyfikuje OPERATOR, a detal (np. blad SQL
    // migracji = potencjalny defekt kodu!) zostaje w logu i raporcie fazy dla operatora.
    if (e2eAktywne) {
      e2eSync = await agent(e2eDbSyncPrompt(sciezka, numerFazy), { schema: E2E_DB_SYNC_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `e2e:db-sync:faza-${numerFazy}` })
      log(`E2E db-sync fazy ${numerFazy}: ${e2eSync ? `${e2eSync.status} — ${e2eSync.detal}` : 'agent zwrocil null'}`)
    }
    await zapiszZaleglyStan()
    const review = await workflow('dev-docs-review-wf', {
      sciezka,
      faza: numerFazy,
      poprzednieFindingi: faza.otwarteFindingi.length ? faza.otwarteFindingi : null,
      dossier: dossierZExecute,
      // Baza fazy ze stanu (P7): zapasowy agent dossier po STOP-ie miedzy execute a review liczy diff od niej, nie od main.
      baza: faza.baza || null,
      // Status srodowiska przegladarkowego (2026-07-30): routing v2 sam z diffu NIE wie, czy przegladarka
      // stoi, wiec w runie rownolegle-joby (faza 1) przywolal testera przy e2eSrodowisko: "pominieto"
      // — wynik 1 passed / 1 failed / 3 skipped. Z tym sygnalem review-wf da mu tryb bez przegladarki.
      srodowiskoE2E: e2eAktywne ? 'gotowe' : (e2eEnv ? e2eEnv.status : 'brak'),
    })
    if (!review) {
      return await stopRun({ powod: `review fazy ${numerFazy} zwrocil null`, faza: numerFazy, raporty })
    }
    // Scribe padl 2x: raport review-faza-N.md i sekcja "Do poprawy" NIE powstaly. Nie oznaczamy
    // review=done (utrwalone done nigdy juz nie odtworzy raportu) — STOP; kolejny run powtorzy review.
    if (review.scribeFail) {
      oznaczStan()
      return await stopRun({
        powod: `Faza ${numerFazy}: scribe padl 2x — findingi zweryfikowane (P1/P2 w wyniku), ale raport review-faza-${numerFazy}.md nie zostal zapisany. Review pozostaje pending; odpal SWIEZY run (reviewerzy odpala sie ponownie).`,
        faza: numerFazy, findings: review.findings, raporty,
      })
    }
    // BLOKER SRODOWISKA wykryty po SYGNATURZE w opisach findingow (review-wf liczy to w JS, bez LLM).
    // Bez tego run ciagnal kolejne fazy na trwale zepsutym srodowisku, a kazdy nastepny scenariusz padal
    // z tego samego powodu — operator dowiadywal sie dopiero na completion-gate, po godzinach pracy
    // (run feedback-marcin-poprawki, mobile: 5 faz na zepsutej binarce). Review ZOSTAJE zapisane (raport
    // i sekcja "Do poprawy" sa juz na dysku), ale nie oznaczamy go jako done: findingi E2E powstaly na
    // zepsutym srodowisku, wiec po naprawie faza wymaga powtorki.
    if (review.blokerSrodowiska && review.blokerSrodowiska.wykryty) {
      const b = review.blokerSrodowiska
      // Utrwal to, co review JUZ ustalilo o kodzie (audyt 2026-09-02, pozycja A2). Dotad ta galaz
      // wychodzila przed zapisem metryk, wiec STOP na blokerze zostawial w stanie i telemetrii `null`
      // zamiast licznikow — praca 8 reviewerow znikala. `faza.review` CELOWO zostaje `pending`:
      // findingi E2E powstaly na zepsutym srodowisku i po naprawie wymagaja powtorki.
      faza.otwarteFindingi = polaczFindingiPoPowtorce(otwartePoReview(review.findings), findingiPrzedPowtorka)
      faza.metryki = { liczniki: policzFindingi(review.findings), przebieg: skrotPrzebiegu(review.przebieg) }
      oznaczStan()
      return await stopRun({
        powod: `Faza ${numerFazy}: scenariusz E2E padl na BLOKERZE SRODOWISKA (${b.klasa}), nie na defekcie kodu. Dowod z outputu: "${b.dowod}". Kazdy kolejny scenariusz padlby tak samo, wiec zatrzymuje run zamiast ciagnac go na zepsutym srodowisku.`,
        naprawa: b.klasa === 'dev-server-nieosiagalny'
          ? 'Dev server Vite jest nieosiagalny — padl w trakcie runu albo port sie nie zgadza. Sprawdz /tmp/autopilot-vite.log (tail -30) i czy port 5173 jest wolny (`lsof -ti:5173`). Potem SWIEZY run (te same args, BEZ resumeFromRunId) — env-up postawi dev server od nowa, a review tej fazy powtorzy sie na sprawnym srodowisku.'
          : 'Host z .env.e2e nie rozwiazuje sie w DNS — najczesciej projekt Supabase e2e jest SPAUZOWANY (free tier usypia po tygodniu) albo URL w .env.e2e jest bledny. Odpauzuj/zweryfikuj projekt w dashboardzie Supabase, sprawdz VITE_SUPABASE_URL i SUPABASE_E2E_DB_URL, potem SWIEZY run (te same args, BEZ resumeFromRunId).',
        faza: numerFazy, blokerSrodowiska: b, raporty,
      })
    }
    // TESTER E2E PADL 2x przy checkboxach [E2E] (review-wf zwraca e2eTesterFail). Raport i sekcje sa na dysku
    // (checkboxy [E2E] zostaly [ ] + kopie w Operator checklist), ale review NIE jest done: bez przebiegu
    // w przegladarce faza z E2E nie ma dowodu, a cicha degradacja do OPERATOR to dokladnie regresja etap-11/12b.
    // (po blokerze srodowiska: bloker to konkretniejsza diagnoza z instrukcja naprawy; oba zostawiaja review pending)
    if (review.e2eTesterFail) {
      // Utrwal dorobek reviewerow, tak samo jak galaz blokera srodowiska (audyt 2026-09-06, N2).
      // Do tej pory ta sciezka robila samo `zapiszStan()`: metryki i findingi zostawaly w pamieci runu
      // i ginely razem z nim, wiec pad TESTERA kasowal ocene KODU, ktora z przegladarka nie miala nic
      // wspolnego — ta sama szkoda, ktora plan A2 naprawil, ale tylko dla blokera srodowiska.
      // `faza.review` zostaje `pending` (bez przebiegu w przegladarce faza z E2E nie ma dowodu).
      faza.otwarteFindingi = polaczFindingiPoPowtorce(otwartePoReview(review.findings), findingiPrzedPowtorka)
      faza.metryki = { liczniki: policzFindingi(review.findings), przebieg: skrotPrzebiegu(review.przebieg) }
      oznaczStan()
      return await stopRun({
        powod: `Faza ${numerFazy}: tester E2E (agent-browser) ${(review.przebieg && review.przebieg.e2eStatus) || 'padl 2x'} przy ${review.przebieg && review.przebieg.e2eLiczbaZnana ? `${review.przebieg.e2eCheckboxy} checkboxach [E2E]` : 'nieznanej liczbie checkboxow [E2E] (dossier tez nie powstalo — szukaj 529/watchdoga, nie przegladarki)'}. Nie degraduje cicho do OPERATOR: review pozostaje pending.`,
        naprawa: 'Sprawdz dev server Vite (port 5173, /tmp/autopilot-vite.log), agent-browser (`agent-browser doctor`) albo 529 Overloaded i odpal SWIEZY run (te same args, BEZ resumeFromRunId) — review tej fazy powtorzy sie z testerem. Jesli srodowisko stoi, a tester pada 2x na tym samym flow — flow prawdopodobnie wisi na powierzchni poza kontrola headless (popup OAuth, natywny dialog przegladarki): odegraj scenariusz recznie, zeby zobaczyc gdzie, i rozwaz [E2E] -> [Manual].',
        faza: numerFazy, findings: review.findings, raporty,
      })
    }
    // Filar 3: liczniki/gate w JS z findings[]; liczniki scribe'a tylko do porownania w logu.
    const liczniki = policzFindingi(review.findings)
    const scribeL = review.liczniki || {}
    if (scribeL.p1 !== liczniki.p1 || scribeL.p2 !== liczniki.p2) {
      log(`Faza ${numerFazy}: NIESPOJNOSC licznikow scribe (p1=${scribeL.p1},p2=${scribeL.p2}) vs JS (p1=${liczniki.p1},p2=${liczniki.p2}) — uzywam JS`)
    }
    log(`Review fazy ${numerFazy}: P1=${liczniki.p1} P2=${liczniki.p2} P3=${liczniki.p3} OPERATOR=${liczniki.operator}`)
    licznikiFazy = liczniki
    przebiegFazy = review.przebieg || null
    if (przebiegFazy) {
      const skrot = skrotPrzebiegu(przebiegFazy)
      const pom = skrot.pominieci.length ? skrot.pominieci.join(',') : 'brak'
      log(`Routing fazy ${numerFazy}: pominieci=${pom}; tester E2E=${skrot.e2eTryb || 'n/a'}; findingi ${przebiegFazy.znalezione}->${przebiegFazy.poDedupSem} po dedupie, obalone ${przebiegFazy.obalone}/${przebiegFazy.weryfikowane}; E2E: ${przebiegFazy.e2eStatus || 'n/a'} (${przebiegFazy.e2eCheckboxy ?? '?'} checkboxow, PASS/FAIL/SKIP ${przebiegFazy.e2ePass ?? 0}/${przebiegFazy.e2eFail ?? 0}/${przebiegFazy.e2eSkip ?? 0})`)
    }
    faza.review = 'done'
    // Metryki utrwalone w stanie — zrodlo dla telemetrii po resume (review sie wtedy nie powtarza).
    // Skrot zgodny z METRYKI_FAZY: same liczby do strojenia progow. Pelny przebieg (flagi warstw,
    // lista aktywnych) zostaje w raporcie review-faza-N.md, zeby nie puchl plik stanu.
    faza.metryki = { liczniki, przebieg: skrotPrzebiegu(przebiegFazy) }
    faza.otwarteFindingi = polaczFindingiPoPowtorce(otwartePoReview(review.findings), findingiPrzedPowtorka)
    faza.fix = faza.otwarteFindingi.length ? 'pending' : 'none'
    oznaczStan()
  }

  // 3) FIX — bez re-review; gate z self-reportu + lista findingow przekazana wprost (md tylko jako widok).
  if (faza.fix === 'pending') {
    // Stan po review (fix pending) zapisuje agent fixa (P7).
    const fix = await agent(zeStanem(fixPrompt(sciezka, numerFazy, faza.otwarteFindingi)), { schema: FIX_RESULT, agentType: 'klasa-naprawiacz', effort: 'high', label: `fix:faza-${numerFazy}` })
    await potwierdzStan(fix)
    if (!fix) {
      return await stopRun({ powod: `fix fazy ${numerFazy} zwrocil null`, faza: numerFazy, raporty })
    }
    cykle = 1
    fixInfo = { naprawione: fix.naprawione, nierozwiazaneP2: fix.nierozwiazaneP2 }
    log(`Fix fazy ${numerFazy}: naprawiono ${fix.naprawione}, nierozwiazane P1=${fix.nierozwiazaneP1} P2=${fix.nierozwiazaneP2}, walidacja ${fix.walidacja}`)

    // Guard plikow binarnych PRZED gate'em walidacji: uszkodzony plik zrodlowy jest PRZYCZYNA,
    // a typecheck/testy failuja wtornie — na "walidacja FAIL" operator szuka defektu logiki zamiast
    // uszkodzonego pliku. Run team-os-onboarding-instalatory (2026-07-26): surowe bajty sterujace
    // wpisane do scripts/inbox/invite.mjs zabily 6 kolejnych agentow na Read (APIError) i caly run.
    // Semantyka jak w sasiednich STOP-ach: fix zostaje 'pending', wiec swiezy run wraca wprost do fixa.
    const plikiBinarne = fix.plikiBinarne || []
    if (plikiBinarne.length) {
      oznaczStan()
      return await stopRun({
        powod: `Faza ${numerFazy}: po fixie git widzi jako BINARNE pliki, ktore powinny byc tekstem: ${plikiBinarne.join(', ')}. Najprawdopodobniej wpisano do nich SUROWE bajty sterujace zamiast sekwencji ucieczki (np. literalny U+001F zamiast \\x1f w regexie). Kazdy kolejny agent, ktory zrobi Read takiego pliku, rozlaczy sie na APIError — pipeline bedzie umieral w kolko, dopoki plik nie zostanie naprawiony.`,
        naprawa: `Napraw ${plikiBinarne.join(', ')} POZA pipelinem i NIE otwieraj ich Readem (to samo rozlaczenie dotyczy kazdej sesji): albo cofnij zmiane (\`git checkout <commit-sprzed-fixa> -- <plik>\`), albo przepisz plik od nowa z sekwencjami ucieczki (\\x00-\\x1f\\x7f-\\x9f zamiast literalnych bajtow). Potwierdz \`file <plik>\` = "... text" i \`git diff --numstat\` = liczby zamiast "-", zacommituj, potem odpal SWIEZY run (te same args, BEZ resumeFromRunId).`,
        faza: numerFazy, fix, plikiBinarne, raporty,
      })
    }

    if (fix.walidacja === 'FAIL' || fix.nierozwiazaneP1 > 0) {
      // Stan NIE oznacza fix=done — resume wroci wprost do fixa z ta sama lista.
      oznaczStan()
      return await stopRun({
        powod: fix.nierozwiazaneP1 > 0
          ? `Faza ${numerFazy}: ${fix.nierozwiazaneP1}x P1 nierozwiazane po fixie — wymagana reczna interwencja`
          : `Faza ${numerFazy}: walidacja fixa FAIL — wymagana reczna interwencja`,
        naprawa: 'Po recznej naprawie odpal SWIEZY run (te same args, BEZ resumeFromRunId) — stan wroci wprost do tej fazy z .autopilot-state.json; resume odtworzyloby zcache\'owany FAIL fixa.',
        faza: numerFazy, fix, raporty,
      })
    }

    // KONTROLA DIFFU NAPRAWCZEGO (P8): jeden agent z listami K-1…K-7 katalogu A i bramkami P6 na plikach fixa,
    // zakres z hashy FixResult.commity. Pozycje liczy JS (K-6 z wynikow testow P1 — zastepuje dawny verify-fix).
    // Agent padl = faza idzie dalej bez kontroli (best-effort, jak dotad).
    const kontrola = await agent(kontrolaFixaPrompt(sciezka, numerFazy, fix.commity, faza.otwarteFindingi), { schema: KONTROLA_FIXA, agentType: 'klasa-sceptyk', effort: 'medium', label: `fix:kontrola:faza-${numerFazy}` })
    if (!kontrola) log(`Faza ${numerFazy}: kontrola diffu fixa zwrocila null — faza idzie dalej bez kontroli (best-effort)`)
    const doPoprawki = pozycjeKontroliFixa(kontrola)
    // JEDEN cykl poprawkowy, twardo. To kontrola wlasnej roboty pipeline'u, nie kolejna runda review —
    // druga tura zaczelaby scigac wlasny ogon i nie da sie jej ograniczyc niczym poza licznikiem.
    if (doPoprawki.length) {
      log(`Faza ${numerFazy}: kontrola diffu naprawczego zwraca ${doPoprawki.length} pozycji do fixa (jeden cykl):\n  ${doPoprawki.map((p) => `[${p.zrodlo}] ${p.plik} — ${p.opis}`).join('\n  ')}`)
      const poprawka = await agent(fixPoprawkaPrompt(sciezka, numerFazy, doPoprawki, fix.commity), { schema: FIX_RESULT, agentType: 'klasa-naprawiacz', effort: 'high', label: `fix:poprawka:faza-${numerFazy}` })
      if (!poprawka) {
        log(`Faza ${numerFazy}: tura poprawkowa zwrocila null — pozycje zostaja otwarte, faza idzie dalej (P3-klasa, nie bramka)`)
      } else {
        kontrolaFixa = podsumujKontroleFixa(doPoprawki.length, poprawka)
        log(`Faza ${numerFazy}: tura poprawkowa — naprawiono ${poprawka.naprawione}/${doPoprawki.length}, walidacja ${poprawka.walidacja}${kontrolaFixa.pominiete.length ? `, pominiete z uzasadnieniem: ${kontrolaFixa.pominiete.length}` : ''}`)
        if (kontrolaFixa.bezSladu > 0) {
          log(`Faza ${numerFazy}: UWAGA — ${kontrolaFixa.bezSladu} pozycji kontroli diffu ani nie naprawiono, ani nie uzasadniono w nienaprawione[]. Walidacja ${poprawka.walidacja} nie mowi nic o tych pozycjach; sprawdz commit "kontrola diffu naprawczego fazy ${numerFazy}".`)
        }
        // Walidacja FAIL po turze poprawkowej JEST bramka: zostawilibysmy faze z niedzialajacym typecheckiem
        // albo czerwonymi testami, a nastepna faza budowalaby na tym.
        if (poprawka.walidacja === 'FAIL') {
          oznaczStan()
          return await stopRun({
            powod: `Faza ${numerFazy}: tura poprawkowa po kontroli diffu naprawczego zakonczyla sie walidacja FAIL — kod fazy zostal w stanie, w ktorym typecheck/testy/build nie przechodza.`,
            naprawa: 'Sprawdz ostatni commit `fix(...): kontrola diffu naprawczego` i doprowadz walidacje do zieleni recznie, potem odpal SWIEZY run (te same args, BEZ resumeFromRunId).',
            faza: numerFazy, fix, poprawka, raporty,
          })
        }
      }
    } else if (kontrola) {
      log(`Faza ${numerFazy}: kontrola diffu naprawczego czysta — zero pozycji z list K-1…K-7 i bramek na plikach fixa`)
    }

    gateFazy = fix.nierozwiazaneP2 > 0 ? 'ZASTRZEZENIA' : 'CZYSTE'
    if (fix.nierozwiazaneP2 > 0) {
      cykle = '1 (graceful P2)'
      log(`Faza ${numerFazy}: GRACEFUL — ${fix.nierozwiazaneP2}x P2 do known-issues, kontynuuje`)
    }
    faza.fix = 'done'
    faza.otwarteFindingi = []
    oznaczStan()
  } else if (faza.fix === 'none') {
    gateFazy = 'CZYSTE'
  }

  historia[numerFazy] = cykle
  log(`Faza ${numerFazy}: koniec — gate ${gateFazy}, cykle ${cykle}`)
  // przebieg = metryki routingu/dedupu/verify (z review-wf albo ze stanu po resume) — dane do
  // strojenia progow: kogo routing pomija, ile dedup sklei, ile verify obala.
  raporty.push({ faza: numerFazy, gate: gateFazy, cykle, liczniki: licznikiFazy, fix: fixInfo, kontrolaFixa, e2eSync: e2eSync ? `${e2eSync.status}: ${e2eSync.detal}` : 'n/a', przebieg: skrotPrzebiegu(przebiegFazy) })
}

// ── Zakonczenie ──────────────────────────────────────────────────────────
phase('Zakonczenie')

if (stan.zakonczenie.walidacja === 'pending') {
  const walidacja = await agent(zeStanem(finalValidationPrompt(sciezka)), { schema: VALIDATION_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: 'walidacja-koncowa' })
  await potwierdzStan(walidacja)
  if (!walidacja) {
    return await stopRun({ powod: 'walidacja koncowa zwrocila null', historia, raporty })
  }
  if (walidacja.testyZmodyfikowane && walidacja.testyZmodyfikowane.length) {
    log(`UWAGA test-weakening: fix zmodyfikowal istniejace testy: ${walidacja.testyZmodyfikowane.join(', ')}`)
  }
  if (walidacja.knownIssuesZamkniete) {
    log(`known-issues: przeniesiono ${walidacja.knownIssuesZamkniete} zamknietych wpisow do sekcji "Zamkniete"`)
  }
  // Filar 3: gate w JS. Agent MA ustawic FAIL przy otwartych [E2E], ale nic poza JS tego nie egzekwuje —
  // wynik=PASS z niepusta lista [E2E] archiwizowalby zadanie z nieuruchomionym E2E (cicha zielen).
  const e2eOtwarte = [...(walidacja.e2eNieuruchomione || []), ...(walidacja.e2eFail || [])]
  if (e2eOtwarte.length && walidacja.wynik !== 'FAIL') {
    log(`NIESPOJNOSC walidacji: ${e2eOtwarte.length} otwartych [E2E] przy wynik=${walidacja.wynik} — wymuszam FAIL`)
    walidacja.wynik = 'FAIL'
  }
  if (walidacja.wynik === 'FAIL') {
    // Completion-gate E2E bez automatycznej drogi powrotu = petla identycznych STOP-ow: po naprawie srodowiska/kodu
    // swiezy run mial wszystkie fazy done, szedl prosto do walidacji i padal na tym samym grepie. Dlatego fazy
    // z niezaznaczonymi [E2E] cofamy do review=pending — swiezy run wraca do review z testerem, ktory ponawia flow.
    const fazyDoPowtorki = (walidacja.e2eFazy || []).filter((n) => stan.fazy.some((f) => f.numer === n))
    if (e2eOtwarte.length && fazyDoPowtorki.length) {
      for (const n of fazyDoPowtorki) {
        const f = stan.fazy.find((x) => x.numer === n)
        f.review = 'pending'
        f.fix = 'none'
        f.otwarteFindingi = []
      }
      oznaczStan()
    }
    const naprawaE2e = e2eOtwarte.length
      ? ` E2E: ${fazyDoPowtorki.length ? `fazy ${fazyDoPowtorki.join(', ')} cofniete do review=pending — po naprawie (srodowisko/kod) odpal SWIEZY run (te same args, BEZ resumeFromRunId): review tych faz powtorzy sie z testerem, ktory ponowi flow i odznaczy zrodlowe checkboxy po PASS.` : 'nie udalo sie ustalic faz z niezaznaczonymi [E2E] — recznie ustaw im review:"pending" w .autopilot-state.json i odpal swiezy run.'} Alternatywy: (b) recznie odegraj scenariusz w przegladarce na srodowisku z .env.e2e (dev server \`--mode e2e\` + seed flow przez psql), przy PASS zaznacz [x] i usun suffix (SKIP/FAIL) w zadaniach + commit; (c) swiadomy opt-out: [E2E] -> [Manual] w zadaniach i planie (NIE dla linii z "(FAIL:" — to ukryloby znany defekt). Jesli srodowisko stoi, a ten sam flow pada/wisi przy kazdym runie — flow prawdopodobnie dotyka powierzchni poza kontrola headless (popup OAuth, natywny dialog przegladarki): odegraj go recznie, zeby zobaczyc gdzie, i rozwaz opt-out.`
      : ''
    return await stopRun({
      powod: 'walidacja koncowa FAIL',
      naprawa: `Bledy: ${(walidacja.bledy || []).join(' | ') || 'brak szczegolow'}.${naprawaE2e}`,
      walidacja, historia, raporty,
    })
  }
  stan.zakonczenie.walidacja = 'done'
  stan.walidacjaWynik = walidacja
  oznaczStan()
}

// Teardown E2E dopiero PO walidacji i tylko na sciezce sukcesu — kazdy wczesniejszy STOP
// celowo zostawia dev server Vite zywy (operator debuguje na gotowym srodowisku; nasz .pid
// pozwala nastepnemu runowi przejac lub ubic proces).
if (e2eAktywne) {
  const down = await agent(zeStanem(e2eEnvDownPrompt()), { schema: E2E_DOWN_RESULT, agentType: 'klasa-mechaniczny', label: 'e2e:env-down' })
  await potwierdzStan(down)
  log(`E2E env-down: ${down ? `${down.posprzatano ? 'OK' : 'pominieto'} — ${down.detal}` : 'agent zwrocil null'}`)
}

// Compound PRZED complete: dokumentuje solutions gdy sciezki w docs/active/ jeszcze zyja.
// Complete (archiwizacja, przenosi folder) jest OSTATNI — po nim juz NIE zapisujemy stanu
// (plik wedruje do archiwum razem z folderem; zapis wskrzesilby pusty katalog w active/).
// Stempel complete:"done" w zarchiwizowanym pliku stawia sam complete-wf (krok 5 jego prompta).
const REFRESH_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    przejrzano: { type: 'number', description: 'liczba dokumentow w waskim scope' },
    akcje: { type: 'array', items: { type: 'string' }, description: 'wykonane akcje (Keep/Update/Replace/Archive/dedup CONCEPTS)' },
    slownik: { type: 'string', enum: ['posprzatany', 'bez zmian', 'brak pliku'] },
    // Refresh EDYTUJE istniejace dokumenty bazy wiedzy (w audytowanym runie zmodyfikowal siostrzany
    // solution), a nikt tych zmian nie commitowal — razem z artefaktami compound zostawaly w drzewie
    // i blokowaly bramke bootstrapu nastepnego runu. W required z tego samego powodu co plikiBinarne:
    // brak commita musi byc jawny, pole opcjonalne = agent cicho pomija commit.
    commit: { type: 'string', description: 'hash commita zmian bazy wiedzy ("" gdy nic nie zmieniono albo commit sie nie udal)' },
    stanZapisany: POLE_STANU,
  },
  required: ['przejrzano', 'slownik', 'commit'],
}

const refreshPrompt = (plik, kategoria) =>
  `Jestes czescia pipeline'u dev-autopilot. Utrzymujesz baze wiedzy PO zapisie nowego solution.
Wykonaj skill .claude/skills/dev-compound-refresh/SKILL.md w TRYBIE AUTONOMICZNYM (bez pytan), ale SCOPED — WASKO:
- Zakres = kategoria dotknieta tym runem${kategoria ? `: "${kategoria}"` : ` (wywnioskuj z ${plik})`} + plik docs/CONCEPTS.md.
- NIE przegladaj calej bazy docs/solutions/ — tylko ten waski scope (routing "Skupiony", 1-2 dokumenty).
- Cel: czy nowy solution (${plik}) podwaza/zastepuje siostrzany dokument w tej kategorii; dedup i weryfikacja hasel w docs/CONCEPTS.md; napraw nieaktualne referencje.
- Wykonuj bezpieczne akcje (Keep/Update/Archive/Replace gdy dowody wystarczajace); niejednoznaczne oznacz stale. Best-effort — nie blokuj.
- Subagentow nie uruchamiasz: zakres to 1-2 dokumenty, wiec badanie i dokument zastepczy (Replace) piszesz sam.
- PO wykonaniu akcji ZACOMMITUJ zmienione dokumenty bazy wiedzy. Kto zapisuje, ten commituje: dwa runy
  z rzedu zostawily artefakty bazy wiedzy niezacommitowane, a brudne drzewo blokuje bramke bootstrapu
  nastepnego runu autopilota (STOP "niezacommitowane zmiany").
  Staguj WYLACZNIE po whiteliscie: \`git add docs/solutions/ docs/CONCEPTS.md .claude/rules/learned-patterns.md\`
  (pomin sciezki, ktorych nie ma na dysku). ZAKAZ \`git add -A\` i \`git add .\`.
  Message: \`docs(solutions): odswiezenie bazy wiedzy — <co zmieniono>\`.
  Gdy nie zmieniles zadnego pliku albo commit sie nie udal — zwroc commit: "" i nie przerywaj.
Zwroc obiekt zgodny ze schematem RefreshResult (commit = hash commita lub "").`

// `compound` jest zadeklarowany na gorze pliku razem z reszta stanu runu (czyta go wynik runu na koncu).
let refresh = null
if (stan.zakonczenie.compound === 'pending') {
  await zapiszZaleglyStan()
  compound = await workflow('dev-compound-wf', { sciezka })
  // compound=done przed refreshem (P7): stan zapisuje refresh; bez refresha — zapis zalegly przed complete-wf.
  stan.zakonczenie.compound = 'done'
  oznaczStan()
  // Scoped refresh ZARAZ po compound — dedup/prune bazy dla dotknietej kategorii + CONCEPTS.md.
  // Odpala sie tylko gdy compound cos zapisal (compound.plik != null). Best-effort: nie blokuje complete.
  if (compound && compound.plik) {
    refresh = await agent(zeStanem(refreshPrompt(compound.plik, compound.kategoria)), { schema: REFRESH_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: 'compound-refresh' })
    await potwierdzStan(refresh)
    log(`Compound-refresh (scoped): ${refresh ? `${refresh.przejrzano} dok., slownik=${refresh.slownik}, commit=${refresh.commit || 'brak'}` : 'agent zwrocil null'}`)
  }
}

let complete = null
if (stan.zakonczenie.complete === 'pending') {
  // Wyjscia compound/refresh (solution, regula, slownik) — complete-wf dostaje je jako dodatkowy pathspec.
  // Refresh sam commituje po whiteliscie (patrz refreshPrompt), ale to best-effort: gdy jego commit sie nie
  // uda (albo compound nie domknie swojego), run konczylby sie OK z brudnym drzewem i nastepny bootstrap
  // STOP-owalby. Katalogowo, nie punktowo: refresh edytuje TAKZE siostrzane solutions (Update/Replace/Archive ->
  // docs/solutions/_archived/), CONCEPTS.md i learned-patterns.md niezaleznie od pol CompoundResult, a nie
  // raportuje sciezek. Bootstrap gwarantuje czyste drzewo na starcie, wiec wszystko brudne pod tymi sciezkami
  // pochodzi z tego runu. complete-wf pomija sciezki nieistniejace (krok 8), wiec brak katalogu nie szkodzi.
  const dodatkowePathspec = compound
    ? ['docs/solutions', 'docs/CONCEPTS.md', '.claude/rules/learned-patterns.md']
    : []
  await zapiszZaleglyStan()
  complete = await workflow('dev-docs-complete-wf', { nazwaZadania: stan.nazwaZadania, dodatkowePathspec })
  if (complete && (!complete.archiwum || !complete.commit)) {
    log(`UWAGA: archiwizacja NIE domknieta (archiwum=${complete.archiwum || 'brak'}, commit=${complete.commit || 'brak'}): ${(complete.rezultaty || []).join('; ') || 'bez szczegolow'} — zadanie moglo zostac w docs/active/, sprawdz git status`)
  }
  // Smoke operatora (dokument #2 dla czlowieka) powstaje w complete-wf z sekcji "Operator checklist faza N",
  // [Manual] i findingow OPERATOR — to jest lista "co sprawdzic recznie po zielonym automacie".
  // Logujemy sciezke wprost, bo to pierwsza rzecz, ktorej operator szuka po runie.
  // Cztery stany, nie dwa: `complete === null` (caly complete-wf padl) i `smokeStatus === 'agent-null'`
  // (agent smoke'u padl 2x) to AWARIE — nie wolno ich logowac jako "brak pozycji", bo operator uznalby,
  // ze nie ma nic do sprawdzenia, a Operator checklist/[Manual] nigdy nie trafily do docs/operator/.
  if (!complete) {
    log('UWAGA: complete-wf zwrocil null — smoke operatora i archiwizacja w stanie NIEZNANYM; sprawdz docs/active/ i docs/operator/ recznie')
  } else if (complete.smokeStatus === 'agent-null') {
    log(`UWAGA: smoke operatora NIE powstal (agent padl 2x) — pozycje Operator checklist/[Manual] nie zostaly przeniesione; wygeneruj recznie: /dev-docs-complete ${stan.nazwaZadania}`)
  } else if (complete.smokeOperatora) {
    log(`Smoke operatora do przejscia recznie: ${complete.smokeOperatora}`)
  } else {
    log('Smoke operatora: brak pozycji do recznego sprawdzenia (plik nie powstal)')
  }
}

log(`Autopilot koniec: ${kolejka.length} faz w tym runie, ${fazyUkonczone(stan.fazy)}/${stan.fazy.length} domknietych w zadaniu (koszt runu: raport telemetrii — .claude/scripts/telemetria/raport.mjs)`)

return {
  status: 'OK',
  nazwaZadania: stan.nazwaZadania,
  fazyUkonczone: fazyUkonczone(stan.fazy),
  fazyWRunie: kolejka.length,
  historia,
  raporty,
  walidacja: stan.walidacjaWynik || 'done w poprzednim runie',
  e2eSrodowisko: e2eEnv ? e2eEnv.status : 'brak',
  archiwum: complete && complete.archiwum,
  archiwumCommit: (complete && complete.commit) || '',
  // Plik decyzji i rozmiar PR (P4) — UWAGA, nie STOP: operator decyduje o podziale PR-a.
  uwagiArchiwum: (complete && complete.uwagi) || [],
  smokeOperatora: (complete && complete.smokeOperatora) || '',
  smokeStatus: complete ? (complete.smokeStatus || 'brak-pola') : (stan.zakonczenie.complete === 'done' ? 'done-w-poprzednim-runie' : 'complete-null'),
  archiwizacjaStatus: complete ? (complete.archiwum && complete.commit ? 'ok' : 'niedomknieta') : (stan.zakonczenie.complete === 'done' ? 'done-w-poprzednim-runie' : 'complete-null'),
  solution: compound && compound.plik,
  regula: compound && compound.regula,
  refresh: refresh ? refresh.slownik : 'pominieto',
}

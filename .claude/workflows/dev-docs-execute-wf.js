export const meta = {
  name: 'dev-docs-execute-wf',
  description: 'Wykonanie JEDNEJ fazy zadania: planner czyta IU z docs/plans/, buildery (feature-builder-*) implementuja je przez agentType, potem walidacja + commit + aktualizacja dokumentacji.',
  whenToUse: 'Pojedyncza faza implementacji. Wolany przez dev-autopilot lub standalone z args {sciezka, faza}.',
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
            enum: ['feature-builder-ui', 'feature-builder-data', 'feature-builder-fullstack'],
          },
          prompt: { type: 'string', description: 'KOMPLETNY blok IU gotowy do wyslania builderowi (Cel, Wymagania, Pliki, Podejscie, Wzorce, Scenariusze testowe, Weryfikacja) + sciezka zadania + numer IU + doklejony designerski kontekst gdy UI/fullstack' },
        },
        required: ['id', 'nazwa', 'agentType', 'prompt'],
      },
    },
  },
  required: ['fazaNumer', 'strategia', 'poza', 'iu'],
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
  },
  required: ['fazaNumer', 'status', 'iu'],
}

// ── Buildery promptow ──────────────────────────────────────────────────────

function plannerPrompt(sciezka, faza) {
  return `Jestes plannerem fazy implementacji. Zbuduj liste Implementation Units gotowych do delegacji.

Folder zadania: ${sciezka}
Faza do wykonania: ${faza}

Referencja metodologii: przeczytaj .claude/skills/dev-docs-execute/SKILL.md sekcje 2.5, 3, 3a
(strategia delegacji, granice scope'u, mandatory designerski kontekst).

1. Przeczytaj ${sciezka}/*-plan.md, ${sciezka}/*-zadania.md, ${sciezka}/*-kontekst.md.
2. Otworz plan techniczny w docs/plans/ (referencja "Plan techniczny:"/"origin:" w pliku planu zadania).
   Zlokalizuj Implementation Units odpowiadajace fazie ${faza}.
3. Jesli faza ${faza} jest juz ukonczona albo nie ma niezaznaczonych checkboxow IMPLEMENTACYJNYCH -> ustaw poza=true, iu=[].
   Do ukonczenia NIE licza sie (pomijaj calkowicie): checkboxy z prefiksem "Weryfikacja:", "Operator:",
   oznaczone "[E2E]"/"[Manual]", oraz wszystkie checkboxy w sekcjach "## Do poprawy po review fazy N"
   i "## Operator checklist faza N" (obsluguje je review/fix, nie buildery).
4. Wybierz strategie: serial (IU zalezne / wspolne pliki) lub parallel (IU niezalezne).
   Jesli ktorykolwiek IU dodaje nowa zaleznosc (biblioteka, config vite/vitest) — preferuj serial:
   rownolegle zimne vitesty po inwalidacji cache duplikuja ~16-min prace i ryzykuja watchdog-kill.
5. Dla kazdego IU zbuduj KOMPLETNY prompt builderowi:
   - caly blok IU doslownie (Cel, Wymagania, Pliki, Podejscie, Wzorce, Scenariusze testowe, Weryfikacja)
   - sciezka zadania ${sciezka} + numer IU
   - dla feature-builder-ui|fullstack: doklej "Mandatory designerski kontekst" z sekcji "Designerski kontekst"
     w ${sciezka}/*-kontekst.md (DESIGN.md, SPEC.md, screeny). Dla -data pomijaj.
   - NIE kopiuj "Skills in play:" — skille sa wstrzykiwane z frontmatter subagenta.
   - agentType = wartosc pola "Delegate to:" z IU.
   DOPISZ DOSLOWNIE na koncu promptu KAZDEGO IU blok "Wymagania wykonania":
   "Wymagania wykonania: zaimplementuj kod dla checkboxow implementacyjnych (POMIJAJ: Weryfikacja:,
   Operator:, [E2E], [Manual] — to dla review/operatora). Testy dla checkboxow Test: pisz RAZEM z kodem.
   Jesli dodajesz zaleznosc (bun add / npm install) — odnotuj to w odchyleniach."
   (Regul srodowiska dot. dlugich komend NIE kopiuj — orkiestrator dokleja je automatycznie.)

Zwroc obiekt zgodny ze schematem IUPlan. Sam nie implementuj kodu.`
}

function domknieciePrompt(sciezka, faza, buildResults) {
  const podsumowanieIU = buildResults
    .map((b) => `- ${b.id}: ${b.status}${b.odchylenia && b.odchylenia.length ? ` (odchylenia: ${b.odchylenia.join('; ')})` : ''}`)
    .join('\n')
  return `Jestes domknieciem fazy implementacji. Buildery skonczyly — zwaliduj i utrwal.

Folder zadania: ${sciezka}
Faza: ${faza}

Raporty builderow:
${podsumowanieIU}

1. System-Wide Test Check (.claude/skills/dev-docs-execute/SKILL.md sekcja 4.5): typecheck bez nowych bledow,
   istniejace testy przechodza, nowe testy pokrywaja happy path + error case, checkboxy "Test:" napisane i przechodza,
   importy nie lamia modulow, build (vite build) przechodzi. Komendy z package.json.
   UWAGA: jesli ktorykolwiek builder raportowal dodanie zaleznosci — pierwszy vitest jest ZIMNY (procedura tla z bloku).
${BLOK_DLUGIE_KOMENDY}
2. Aktualizuj ${sciezka}/*-zadania.md: oznacz ukonczone checkboxy [x] (NIE ruszaj "Weryfikacja:" — to dla review).
3. Aktualizuj ${sciezka}/*-kontekst.md: zmiany, decyzje, "Ostatnia aktualizacja".
4. Aktualizuj plan techniczny w docs/plans/ (odznacz test scenarios / verification dla tej fazy).
5. Commit inkrementalny: feat/fix/refactor([nazwa]): [co i dlaczego]. Staguj tylko zmienione pliki (nie git add .).

Dzialaj autonomicznie. Zwroc obiekt zgodny ze schematem ExecuteResult
(status=completed tylko gdy walidacja PASS i wszystkie IU completed).`
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

const sciezka = args && args.sciezka
const faza = args && args.faza
if (!sciezka || faza === undefined) {
  return { fazaNumer: -1, status: 'blocked', iu: [], problem: 'brak args {sciezka, faza}' }
}

phase('Plan IU')
const plan = await agent(plannerPrompt(sciezka, faza), { schema: IU_PLAN, label: `planner:faza-${faza}` })

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
      agent(promptIU(iu), { schema: BUILD_RESULT, agentType: iu.agentType, label: `build:${iu.id}`, phase: 'Build' })
    )
  )
} else {
  // serial — IU zalezne / wspolne pliki, kolejnosc ma znaczenie
  builds = []
  for (const iu of plan.iu) {
    const r = await agent(promptIU(iu), { schema: BUILD_RESULT, agentType: iu.agentType, label: `build:${iu.id}`, phase: 'Build' })
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
const wynik = await agent(domknieciePrompt(sciezka, faza, buildResults), { schema: EXECUTE_RESULT, label: `domkniecie:faza-${faza}` })
return wynik

export const meta = {
  name: 'dev-docs-review-wf',
  description: 'Code review fazy: context-packager (mapa zmian raz) -> 8 reviewerow rownolegle (security/perf/architektura/typescript/spec-compliance/simplicity/test/E2E) -> dedup -> adversarial verify P1/P2 (P1=3 sceptykow, P2=1) -> scribe zapisuje raport + bookkeeping checkboxow Weryfikacja: -> severity gate.',
  whenToUse: 'Review jednej fazy. Wolany przez dev-autopilot lub standalone z args {sciezka, faza}.',
  phases: [
    { title: 'Review', detail: 'context-packager + 8 reviewerow rownolegle (w tym spec-compliance i simplicity/YAGNI)' },
    { title: 'Verify', detail: 'adversarial verify per finding (P1=3 sceptykow, P2=1)' },
    { title: 'Zapis', detail: 'raport + bookkeeping + severity gate' },
  ],
}

// Kopia stalej z dev-autopilot-wf.js (workflowy sa self-contained — przy zmianie synchronizuj recznie).
// Doklejana do promptow agentow, ktorzy URUCHAMIAJA komendy (test-coverage, e2e) — reviewerzy read-only jej nie potrzebuja.
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

const FINDINGS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          typ: { type: 'string', enum: ['KOD', 'TEST', 'E2E', 'OPERATOR'], description: 'OPERATOR = weryfikacja niewykonalna headless (wymaga realnego deploya / zewnetrznego srodowiska / providera OAuth) — nie defekt kodu, nie idzie do fix' },
          plik: { type: 'string', description: 'plik:linia lub "?"' },
          opis: { type: 'string' },
        },
        required: ['severity', 'typ', 'plik', 'opis'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    realny: { type: 'boolean', description: 'czy finding jest prawdziwy po probie obalenia' },
    uzasadnienie: { type: 'string' },
    severityKorekta: { type: ['string', 'null'], enum: ['P1', 'P2', 'P3', null] },
  },
  required: ['realny', 'uzasadnienie'],
}

const REVIEW_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fazaNumer: { type: 'integer' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          typ: { type: 'string', enum: ['KOD', 'TEST', 'E2E', 'OPERATOR'] },
          plik: { type: 'string' },
          opis: { type: 'string' },
        },
        required: ['severity', 'typ', 'plik', 'opis'],
      },
    },
    liczniki: {
      type: 'object',
      additionalProperties: false,
      properties: { p1: { type: 'integer' }, p2: { type: 'integer' }, p3: { type: 'integer' }, operator: { type: 'integer', description: 'findingi OPERATOR — poza fix, do operator-checklist' } },
      required: ['p1', 'p2', 'p3'],
    },
    severityGate: { type: 'string', enum: ['BLOKUJE', 'ZASTRZEZENIA', 'CZYSTE'] },
    e2e: {
      type: 'object',
      additionalProperties: false,
      properties: { passed: { type: 'integer' }, failed: { type: 'integer' }, skipped: { type: 'integer' } },
      required: ['passed', 'failed', 'skipped'],
    },
    raportSciezka: { type: 'string' },
  },
  required: ['fazaNumer', 'findings', 'liczniki', 'severityGate', 'raportSciezka'],
}

// Poprawka 9: wspolna mapa zmian zbudowana RAZ zamiast 7x niezaleznie przez kazdego reviewera.
const KONTEKST = {
  type: 'object',
  additionalProperties: false,
  properties: {
    diffStat: { type: 'string', description: 'git diff --stat fazy (lub "brak zmian")' },
    pliki: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plik: { type: 'string' },
          czegoDotyczy: { type: 'string', description: 'jednolinijkowe co zmieniono w pliku' },
        },
        required: ['plik', 'czegoDotyczy'],
      },
    },
  },
  required: ['pliki'],
}

// ── Reviewerzy (leaf-agenci przez agentType) ───────────────────────────────

const REVIEWERZY = [
  { key: 'security', agentType: 'security-sentinel', fokus: 'auth, RLS policies, XSS, data exposure, Zod validation, API key exposure' },
  { key: 'performance', agentType: 'performance-oracle', fokus: 'N+1 queries, bundle size, lazy loading, memoization, useEffect cleanup' },
  { key: 'architecture', agentType: 'architecture-strategist', fokus: 'SOLID, wzorce, nazewnictwo, import organization, granice warstw' },
  { key: 'typescript', agentType: 'kieran-typescript-reviewer', fokus: 'type safety, brak any/as/!, discriminated unions, explicit return types' },
  { key: 'spec-compliance', agentType: 'spec-flow-analyzer', fokus: 'zgodnosc implementacji ze spec/planem IU: (a) wymagania ze spec/IU BRAKUJACE lub czesciowo zaimplementowane (under-implementation), (b) zachowanie w diffie o ktore nikt nie prosil (scope creep / over-implementation), (c) wymagania pozornie zaimplementowane ale BLEDNIE. Cytuj linie spec/IU (ID wymagania lub nazwa IU). Jesli brak spec ani planu — zwroc pusta liste findingow' },
  { key: 'simplicity', agentType: 'code-simplicity-reviewer', fokus: 'YAGNI i minimalizm: zbedna zlozonosc, abstrakcje bez 2+ uzyc, defensive code na niemozliwe scenariusze, martwy kod, redundancja, uproszczenia bez utraty funkcji. Duplication > Complexity — prosta duplikacja jest OK, zlozona abstrakcja DRY nie' },
]

// Blok doklejany w trybie re-review (po cyklu fix) — targetowana weryfikacja zamiast pelnego re-skanu.
function rereviewBlok(poprzednie) {
  if (!poprzednie || !poprzednie.length) return ''
  return `

=== TRYB RE-REVIEW (po cyklu fix) ===
To NIE jest swiezy review. Ponizej findingi z poprzedniego review tej fazy:
${JSON.stringify(poprzednie, null, 2)}

Twoje zadanie:
1. Dla KAZDEGO powyzszego findingu sprawdz w kodzie czy zostal naprawiony. Jesli NADAL otwarty -> zglos go ponownie (ten sam severity/typ).
2. Zglaszaj NOWY finding WYLACZNIE jesli to REGRESJA wprowadzona przez commit fix (cos co fix zepsul). NIE rob pelnego re-skanu calej fazy, NIE zglaszaj pre-existing problemow ktorych poprzedni review nie wykryl.
Cel: zweryfikowac skutecznosc napraw, nie wygenerowac nowa liste.`
}

// Wspolna mapa zmian doklejana do promptu reviewera — punkt startu zamiast wlasnego "co sie zmienilo".
function mapaBlok(kontekst) {
  if (!kontekst || !kontekst.pliki || !kontekst.pliki.length) return ''
  const lista = kontekst.pliki.map((p) => `- ${p.plik} — ${p.czegoDotyczy}`).join('\n')
  return `

=== MAPA ZMIAN FAZY (wspolna, zbudowana raz) ===
${kontekst.diffStat || ''}
${lista}
Uzyj jej jako punktu startu. Read tylko pliki istotne dla Twojego fokusu — pelna wiernosc, NIE polegaj wylacznie na mapie.`
}

function kontekstPrompt(sciezka, faza) {
  return `Jestes context-packagerem review fazy ${faza} (${sciezka}). Zbuduj WSPOLNA mape zmian dla reviewerow,
zeby kazdy z nich nie musial od zera ustalac co sie zmienilo (dotad 7x ten sam git diff).

1. Ustal zakres zmian fazy ${faza}: \`git diff --stat\` zmian tej fazy. Jesli faza ma osobne commity — diff od bazy fazy;
   jak nie da sie wyodrebnic — uzyj diff vs main/origin/main.
2. Dla kazdego zmienionego pliku podaj jednolinijkowe "czego dotyczy" (np. "nowy hook useLobbyData — fetch + realtime").
Nie oceniaj jakosci, nie zglaszaj findingow. Zwroc obiekt {diffStat, pliki[]}.`
}

function reviewerPrompt(sciezka, faza, fokus, poprzednie, kontekst) {
  return `Jestes reviewerem fazy ${faza} w folderze ${sciezka}.
Przeczytaj zmiany git tej fazy (diff) + requirements doc (docs/brainstorms/*-requirements.md jesli istnieje) + plan techniczny / Implementation Unit fazy ${faza} w docs/plans/ (Files:, Test scenarios:, Patterns to follow:).
Przeczytaj tez .claude/rules/learned-patterns.md (jesli istnieje) — reguly z poprzednich zadan tego projektu; naruszenie ktorejkolwiek z nich zglos jako finding.
Skup sie na: ${fokus}.
Sklasyfikuj kazdy finding: P1 (blocking), P2 (important), P3 (nit) oraz typ: KOD / TEST / E2E / OPERATOR.
Zwroc obiekt {findings:[...]} zgodny ze schematem. Sam nie zapisuj plikow.${mapaBlok(kontekst)}${rereviewBlok(poprzednie)}`
}

function testCoveragePrompt(sciezka, faza, poprzednie, kontekst) {
  return `Jestes testerem scenariuszy/coverage dla fazy ${faza} w ${sciezka}.
Sprawdz: happy path, invalid inputs, boundary conditions, concurrent operations, scale.
Test coverage: czy plan techniczny (docs/plans/) definiowal scenariusze testowe dla tej fazy i czy pliki testowe
istnieja oraz maja asercje? Brakujace testy = P2 (typ TEST).
Zwroc {findings:[...]} (severity P1/P2/P3, typ KOD/TEST/E2E/OPERATOR). Nie zapisuj plikow.
${BLOK_DLUGIE_KOMENDY}${mapaBlok(kontekst)}${rereviewBlok(poprzednie)}`
}

function e2ePrompt(sciezka, faza, poprzednie) {
  return `Jestes testerem E2E w przegladarce (agent-browser) dla fazy ${faza} w ${sciezka}.
Zbierz niezaznaczone checkboxy "Weryfikacja:" tej fazy dotyczace scenariuszy w przegladarce
(open/navigate URL, click, type/fill, expect/assert visible, screenshot, nawigacja klawiatura,
responsywnosc/viewport, oznaczenie 🌐). Pomin CLI i Manual.

BRAMKA (Poprawka 10) — najpierw policz te browserowe checkboxy. Jesli jest ICH ZERO -> zwroc OD RAZU {findings:[]},
POMIN preflight (curl) i agent-browser. Nie odpalaj srodowiska gdy nie ma czego testowac.

NAJPIERW preflight srodowiska (Bash): czy dev server Vite UP (curl -s localhost:5173 — lub port z vite.config/.env).
Potem proba scenariuszy przez skill agent-browser (open URL, snapshot -i, click, screenshot).

SRODOWISKO ZARZADZANE (jesli w korzeniu repo istnieje .env.e2e): orkiestrator postawil dev server Vite
na dedykowanej bazie e2e i zsynchronizowal migracje+seedy PRZED Twoim startem. Wtedy:
- konto do logowania w flow = E2E_TEST_EMAIL / E2E_TEST_PASSWORD z .env.e2e (nie loguj wartosci),
- "migracja/RPC niewdrozona na remote" i "brak seeded sesji" NIE sa automatycznym powodem
  OPERATOR — najpierw SPRAWDZ realnie (uruchom flow); klasyfikuj OPERATOR dopiero po twardym
  dowodzie blokera srodowiskowego (np. blad poza kontrola: dev server down, popup OAuth zewnetrznego providera).

KLASYFIKACJA per scenariusz (to jest krytyczne — nie wszystko jest P2):
- Scenariusz WYKONANY i FAILED z powodu defektu w kodzie/UI/stylu -> finding P2 typ E2E.
- Scenariusz NIEWYKONALNY headless (dev server down, popup OAuth zewnetrznego providera,
  migracja/RPC niewdrozona na remote, brak seeded sesji) -> finding typ OPERATOR (severity P3).
  To NIE jest defekt kodu — to brakujacy warunek srodowiskowy. NIE klasyfikuj jako P2.
  W opisie podaj: tresc checkboxa + dokladny blocker + Operator action (kroki do odblokowania).
- Scenariusz WYKONANY i PASSED -> nie zglaszaj (scribe odznaczy w bookkeepingu).

Jesli zadanie ma figma_screens / mockupy w sekcji designerskiej — zrob side-by-side visual
comparison screenshotu z mockupem (rozbieznosci wizualne = P2 typ E2E).

Zwroc {findings:[...]}. Nie zapisuj plikow (scribe zrobi bookkeeping).
${BLOK_DLUGIE_KOMENDY}${rereviewBlok(poprzednie)}`
}

function scribePrompt(sciezka, faza, potwierdzone) {
  return `Jestes scribe review fazy ${faza} w ${sciezka}. Otrzymujesz ZWERYFIKOWANE findings (po adversarial verify).

Findings (JSON):
${JSON.stringify(potwierdzone, null, 2)}

Referencja procedury: .claude/skills/dev-docs-review/SKILL.md sekcje 4, 4.5, 4.7.

1. Zapisz ${sciezka}/review-faza-${faza}.md — pelny raport (findings posortowane P1->P2->P3, statystyki).
2. Zaktualizuj ${sciezka}/*-zadania.md: dodaj/uzupelnij sekcje "## Do poprawy po review fazy ${faza}"
   — wylistuj TYLKO findingi typu KOD/TEST/E2E o severity P1 i P2 jako checkbox: "- [ ] 🔴/🟠 [severity] **plik:linia** — opis". P3 opcjonalnie.
   Findingi typu OPERATOR (niewykonalne headless) NIE ida tutaj — trafiaja do osobnej sekcji "## Operator checklist faza ${faza}".
   KAZDA pozycja tej sekcji MA format: "- [ ] Operator: <tresc> — Operator action: <kroki>" (prefiks "Operator:"
   jest OBOWIAZKOWY — bootstrap/planner po nim wykluczaja te checkboxy z liczenia ukonczenia fazy).
   To nie sa zadania do fix, tylko warunki srodowiskowe dla operatora.
3. Bookkeeping checkboxow "Weryfikacja:" (sekcja 4.7): re-parsuj niezaznaczone "Weryfikacja:" fazy ${faza},
   sklasyfikuj (CLI->uruchom przez Bash, exit0->[x]; Grep->uruchom; E2E browser (agent-browser) wykonany->wg findings E2E;
   E2E niewykonalny headless->Operator checklist (typ OPERATOR, nie P2); Manual->zostaw z adnotacja; Niejasne->P3).
   Odznacz/anotuj w pliku zadan. Dopisz sekcje "Bookkeeping checkboxow Weryfikacja:" do raportu.
4. Policz liczniki: p1/p2/p3 (tylko KOD/TEST/E2E) oraz operator (osobno — findingi OPERATOR). P2 z bookkeepingu: CLI FAIL, Grep FAIL.
5. Ustaw severityGate: BLOKUJE (sa P1) / ZASTRZEZENIA (tylko P2) / CZYSTE (zero P1/P2 — sam P3/OPERATOR nie blokuje gate'u).
6. Policz e2e {passed, failed, skipped}.

Zwroc obiekt zgodny ze schematem ReviewResult (findings = finalna lista po bookkeepingu, z findingami OPERATOR wlacznie).`
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

const sciezka = args && args.sciezka
const faza = args && args.faza
// Poprawka 1: w re-review orkiestrator przekazuje findingi z poprzedniego cyklu -> targetowana weryfikacja.
const poprzednie = (args && args.poprzednieFindingi) || []
if (!sciezka || faza === undefined) {
  return { fazaNumer: -1, findings: [], liczniki: { p1: 0, p2: 0, p3: 0, operator: 0 }, severityGate: 'BLOKUJE', raportSciezka: '', e2e: { passed: 0, failed: 0, skipped: 0 } }
}

// Rozdziel poprzednie findingi po obszarze odpowiedzialnego agenta (pusta lista w trybie swiezego review).
const poprzKod = poprzednie.filter((f) => f.typ === 'KOD')
const poprzTest = poprzednie.filter((f) => f.typ === 'TEST')
const poprzE2e = poprzednie.filter((f) => f.typ === 'E2E' || f.typ === 'OPERATOR')

// Faza 1: context-packager RAZ (mapa zmian), potem reviewerzy rownolegle (bariera — potrzebujemy kompletu do dedup)
phase('Review')
// Poprawka 9: zbuduj diff/mape raz; reviewerzy dostaja ja inline zamiast kazdy odkrywac zmiany od zera.
// Null (agent skipniety/blad) -> reviewerzy robia wlasna dyskryminacje jak dotad (fallback w mapaBlok).
const kontekst = await agent(kontekstPrompt(sciezka, faza), { schema: KONTEKST, label: 'kontekst:diff', phase: 'Review' })
const thunki = REVIEWERZY.map((r) => () =>
  agent(reviewerPrompt(sciezka, faza, r.fokus, poprzKod, kontekst), { schema: FINDINGS, agentType: r.agentType, label: `review:${r.key}`, phase: 'Review' })
)
thunki.push(() => agent(testCoveragePrompt(sciezka, faza, poprzTest, kontekst), { schema: FINDINGS, label: 'review:test-coverage', phase: 'Review' }))
thunki.push(() => agent(e2ePrompt(sciezka, faza, poprzE2e), { schema: FINDINGS, agentType: 'feature-tester-e2e', label: 'review:e2e', phase: 'Review' }))

const wyniki = await parallel(thunki)

// Dedup w JS (po pliku + poczatku opisu) — bariera byla potrzebna wlasnie tu.
// Przy kolizji klucza wygrywa WYZSZE severity (P1<P2<P3), nie kolejnosc reviewerow.
const wszystkie = wyniki.filter(Boolean).flatMap((w) => w.findings)
const RANGA = { P1: 0, P2: 1, P3: 2 }
const poKluczu = new Map()
for (const f of wszystkie) {
  const klucz = `${f.plik}|${f.opis.slice(0, 60).toLowerCase()}`
  const obecny = poKluczu.get(klucz)
  if (!obecny || RANGA[f.severity] < RANGA[obecny.severity]) poKluczu.set(klucz, f)
}
const dedup = [...poKluczu.values()]

// Faza 2: adversarial verify — tylko P1/P2 (P3/nity przechodza bez weryfikacji)
phase('Verify')
const doWeryfikacji = dedup.filter((f) => f.severity === 'P1' || f.severity === 'P2')
const nity = dedup.filter((f) => f.severity === 'P3')

// Poprawka 8: P1 (blocking) -> 3 sceptykow (konsensus 2/3). P2 (important) -> 1 sceptyk.
// Verify bylo 55% calego runu (dane wf_ed163076: 114/208 agentow). 3x na kazdy P2 to nadmiar —
// P2 nie blokuje merge'a, wystarczy jeden glos czy realny.
const liczbaSceptykow = (f) => (f.severity === 'P1' ? 3 : 1)
const zweryfikowane = await parallel(
  doWeryfikacji.map((f) => () =>
    parallel(
      Array.from({ length: liczbaSceptykow(f) }, (_, i) => () =>
        agent(
          `Adwersaryjnie OBAL ten finding z review fazy ${faza} (${sciezka}). Domyslnie zakladaj ze finding jest NIEREALNY, chyba ze masz twardy dowod z kodu.\nFinding [${f.severity}/${f.typ}] ${f.plik}: ${f.opis}\nSprawdz kod. Czy to prawdziwy problem czy false positive? Zwroc werdykt.`,
          { schema: VERDICT, label: `verify:${f.plik}:${i}`, phase: 'Verify' }
        )
      )
    ).then((werdykty) => {
      const glosy = werdykty.filter(Boolean)
      // 0 glosow (wszyscy sceptycy padli) != konsensus — przepusc bez kill, ale oznacz w opisie.
      if (glosy.length === 0) {
        return { ...f, potwierdzony: true, opis: `[NIEZWERYFIKOWANY — 0 glosow sceptykow] ${f.opis}` }
      }
      const realne = glosy.filter((v) => v.realny).length
      // potwierdzony gdy wiekszosc sceptykow NIE zdolala obalic
      const potwierdzony = realne >= Math.ceil(glosy.length / 2)
      // Korekta severity tylko gdy zgodna WIEKSZOSC glosujacych ja proponuje — pojedynczy glos
      // nie moze zdegradowac P1 (ominalby twardy STOP) ani awansowac P2.
      const korekty = glosy.map((v) => v.severityKorekta).filter(Boolean)
      const zliczone = {}
      for (const k of korekty) zliczone[k] = (zliczone[k] || 0) + 1
      const [najczestsza, ileGlosow] = Object.entries(zliczone).sort((a, b) => b[1] - a[1])[0] || [null, 0]
      const severity = ileGlosow > glosy.length / 2 ? najczestsza : f.severity
      return { ...f, potwierdzony, severity }
    })
  )
)

const potwierdzone = [
  ...zweryfikowane.filter(Boolean).filter((f) => f.potwierdzony).map(({ potwierdzony, ...f }) => f),
  ...nity,
]
log(`Verify: z ${doWeryfikacji.length} findingow P1/P2 potwierdzono ${potwierdzone.length - nity.length} (+ ${nity.length} nitow)`)

// Faza 3: scribe zapisuje raport + bookkeeping + liczy severity gate
phase('Zapis')
let wynik = await agent(scribePrompt(sciezka, faza, potwierdzone), { schema: REVIEW_RESULT, label: `scribe:faza-${faza}` })
if (!wynik) {
  // Scribe padl — jedna ponowna proba (to JEDYNY agent zapisujacy review-faza-N.md i sekcje
  // "Do poprawy"; bez tych artefaktow fix dziala bez kontekstu, a czlowiek bez widoku).
  log(`Scribe fazy ${faza} padl — ponawiam raz`)
  wynik = await agent(
    `${scribePrompt(sciezka, faza, potwierdzone)}\n\n(PONOWNA PROBA — poprzedni zapis nie zwrocil wyniku. Pliki zapisuj idempotentnie: nadpisz raport w calosci, sekcje w zadaniach ZASTAP zamiast dopisywac duplikat.)`,
    { schema: REVIEW_RESULT, label: `scribe:faza-${faza}:retry` }
  )
}
if (!wynik) {
  // Scribe padl 2x — zwroc zweryfikowane findingi + flage scribeFail (orkiestrator liczy gate w JS
  // z findings[], ale NIE moze oznaczyc review jako done: raport i checkboxy nie powstaly).
  return {
    fazaNumer: faza,
    findings: potwierdzone,
    liczniki: { p1: 0, p2: 0, p3: 0, operator: 0 },
    severityGate: 'BLOKUJE',
    raportSciezka: '',
    e2e: { passed: 0, failed: 0, skipped: 0 },
    scribeFail: true,
  }
}
return wynik

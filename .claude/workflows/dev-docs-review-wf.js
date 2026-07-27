export const meta = {
  name: 'dev-docs-review-wf',
  description: 'Code review fazy: context-packager (mapa zmian + flagi warstw raz) -> routing v2 domenowy (rdzen security/spec/simplicity/test zawsze; perf/architektura/typescript/E2E tylko gdy ich domena jest w fazie obecna; fail-open bez flag) -> do 8 reviewerow rownolegle -> dedup 2-przebiegowy (JS + semantyczny haiku) -> adversarial verify P1/P2 (P1=3 sceptykow, P2=1) -> scribe zapisuje raport + sekcje "Przebieg review" + bookkeeping checkboxow Weryfikacja: -> severity gate. Zwraca przebieg (metryki routingu/dedupu/verify) dla telemetrii.',
  whenToUse: 'Review jednej fazy. Wolany przez dev-autopilot lub standalone z args {sciezka, faza}.',
  phases: [
    { title: 'Review', detail: 'context-packager + reviewerzy rownolegle wg routingu domenowego (do 8, w tym spec-compliance i simplicity/YAGNI)' },
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

// Doklejany do reviewerow i do sceptykow w Verify. Powod (run team-os-hub-api, 2026-07-24):
// skrypt migracji wstawial surowym INSERT-em dane z PUBLICZNIE eksponowanego Postgresa, omijajac
// walidacje tozsamosci/limitow z warstwy API. Cala klasa (spoofing from_user, splice do cudzego
// watku, obejscie MAX_*_LEN) zostala zredukowana do dwoch P3 z uzasadnieniem "skrypt jednorazowy,
// usuwany w kolejnym IU". Zewnetrzny commit-reviewer nazwal to authentication-bypass/high.
const BLOK_ZAUFANIE = `
=== GRANICE ZAUFANIA POZA WARSTWA API (obowiazkowe przy ocenie severity) ===
Skrypty migracyjne, ETL, importy, seedy, joby wsadowe i narzedzia jednorazowe, ktore zapisuja dane
OMIJAJAC warstwe API, sa granica zaufania: obowiazuje ta sama walidacja tozsamosci, limitow i ksztaltu
danych co na endpointach. Pytanie kontrolne: czy zrodlo danych moglo byc zapisywalne przez kogos z zewnatrz?
"Jednorazowy / throwaway / usuwany w kolejnym IU / tylko lokalnie" NIE jest podstawa do obnizenia severity —
oceniaj wplyw w momencie, w ktorym skrypt zostanie URUCHOMIONY na realnych danych.
=== KONIEC BLOKU GRANIC ZAUFANIA ===`

// Doklejany do KAZDEGO agenta zglaszajacego findingi (reviewerzy, test-coverage, e2e).
// Powod (telemetria 5 zadan / 16 faz): P1=2, P2=29, P3=179 — P3 to 85% calego outputu review,
// a NIE trafia do petli naprawczej: otwartePoReview w dev-autopilot-wf.js filtruje wylacznie
// severity P1|P2. Za kazdy P3 placimy trzy razy (generacja u 6-8 reviewerow rownolegle, wejscie
// dedupu semantycznego, prompt scribe'a) i raz czytaniem 17-25 KB raportu. W jednym zadaniu bylo
// 60 P3 przy 10 realnie naprawionych P1/P2. Limit jest TWARDY i dotyczy WYLACZNIE P3 — przemilczany
// P1 to katastrofa, przemilczany P3 to oszczednosc.
const BLOK_LIMIT_P3 = `
=== LIMIT I AKCYJNOSC P3 (nity) ===
LIMIT: zglos MAKSYMALNIE 5 findingow P3. Widzisz wiecej — wybierz 5 najwartosciowszych, reszty NIE zglaszaj.
Limit dotyczy TYLKO severity P3. P1 i P2 NIE sa limitowane: zglos kazdy, choc bys mial ich dwadziescia.
Findingi typu OPERATOR (warunek srodowiskowy, nie defekt) sa poza limitem — nie licz ich do piatki.
AKCYJNOSC: P3 zglaszasz tylko wtedy, gdy potrafisz wskazac KONKRETNA akcje naprawcza w TEJ fazie
(co, w ktorym pliku, na co zmienic). "Warto by kiedys rozwazyc", "mozna by dodac wiecej testow",
"nazwa moglaby byc lepsza", "rozwazyc refaktor" — bez konkretu NIE zglaszasz. Nit bez akcji to szum.
Nie dobijaj do piatki na sile: zero akcyjnych P3 => zero P3 w wyniku.
=== KONIEC BLOKU LIMITU P3 ===`

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

// Sentinel kompletnosci zapisu scribe'a: prompt scribe'a (krok 7) kaze wkleic ten blok DOKLADNIE
// na koncu raportu, wiec jego obecnosc w pliku = zapis sie domknal.
const SENTINEL_RAPORTU = '## Przebieg review'

// Schemat inspektora dysku po padzie scribe'a — maly, bo inspektor tylko patrzy, nie zapisuje.
const INSPEKCJA_RAPORTU = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kompletny: { type: 'boolean', description: `raport istnieje i zawiera naglowek "${SENTINEL_RAPORTU}"` },
    raportSciezka: { type: 'string', description: 'sciezka raportu gdy istnieje, pusty string gdy brak pliku' },
    e2e: {
      type: 'object',
      additionalProperties: false,
      properties: { passed: { type: 'integer' }, failed: { type: 'integer' }, skipped: { type: 'integer' } },
      required: ['passed', 'failed', 'skipped'],
    },
  },
  required: ['kompletny', 'raportSciezka', 'e2e'],
}

// Zrzut diffu fazy (2026-07-27): packager przekierowaniem powloki (`git diff ... > plik`) sklada
// artefakt, ktory reviewerzy czytaja JEDNYM Read zamiast kazdy odpalac wlasny `git diff` i samodzielnie
// ustalac zakres. Diff NIE przechodzi przez output packagera — wynik strukturalny agenta to jego tokeny
// WYJSCIOWE, wiec zwracanie tresci diffu w schemacie kosztowaloby dokladnie tyle, ile chcemy zaoszczedzic
// (plus ryzyko uciecia i przeklamania). W schemacie leca WYLACZNIE metadane artefaktu.
// HIPOTEZA: to ma obnizyc koszt fazy review (realne fazy: 224-298k tokenow). Weryfikacja przez telemetrie —
// rozbicie tokenow per etap zbiera dev-autopilot-wf.js; nastepny run pokaze, czy review faktycznie tanieje.
// Limit 300 KB: przy ~4 znakach na token to ~75k tokenow, czyli gorna granica, przy ktorej reviewer ma
// jeszcze miejsce na plan/spec/learned-patterns i wlasne Read. Powyzej i tak nikt tego nie czyta w calosci.
const LIMIT_DIFFU_B = 300 * 1024
const ZNACZNIK_UCIECIA = '=== DIFF PRZYCIETY (limit 300 KB) — dalsza czesc zmian fazy NIE jest w tym pliku ==='

// Poprawka 9: wspolna mapa zmian zbudowana RAZ zamiast 7x niezaleznie przez kazdego reviewera.
// Routing v2 (2026-07-26): packager zwraca tez FLAGI WARSTW i liczbe browserowych checkboxow.
// Wczesniej routing zgadywal warstwe regexami po sciezce (src/hooks|lib, .sql) — nie trafial
// w projekty bez src/ (Node/CLI), wiec warunek nigdy nie odpalal. Packager i tak czyta caly diff.
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
    e2eCheckboxy: { type: 'integer', description: 'liczba NIEZAZNACZONYCH checkboxow "Weryfikacja:" tej fazy wymagajacych przegladarki (0 gdy brak)' },
    // Metadane artefaktu z diffem — NIGDY tresc diffu (patrz komentarz przy LIMIT_DIFFU_B).
    // Poza `required`: gdy packager ich nie zwroci, mapa dziala jak dotad (fail-open), zamiast
    // wywalic caly obiekt kontekstu na walidacji schematu i stracic rowniez flagi routingu.
    diffPlik: { type: 'string', description: 'sciezka zrzutu diffu fazy (pusty string gdy zrzut sie nie udal)' },
    diffZapisany: { type: 'boolean', description: 'true tylko gdy plik zrzutu realnie powstal i jest niepusty' },
    diffUciety: { type: 'boolean', description: 'true gdy zrzut przekroczyl limit i zostal przyciety ze znacznikiem' },
  },
  required: ['pliki', 'warstwy', 'e2eCheckboxy'],
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
// FAIL-OPEN dwuwarstwowy: (a) brak zrzutu (packager padl / zrzut sie nie udal) => blok o pliku znika;
// (b) `diffZapisany` to DEKLARACJA agenta o wlasnej pracy, nie fakt sprawdzony przez workflow, a /tmp bywa
// czyszczone — wiec sam blok niesie tez instrukcje na nieudany Read. Reviewer nigdy nie zostaje bez diffu.
function mapaBlok(kontekst) {
  if (!kontekst || !kontekst.pliki || !kontekst.pliki.length) return ''
  const lista = kontekst.pliki.map((p) => `- ${p.plik} — ${p.czegoDotyczy}`).join('\n')
  const diffBlok = kontekst.diffZapisany && kontekst.diffPlik
    ? `
=== PELNY DIFF FAZY (juz przygotowany) ===
Plik: ${kontekst.diffPlik}
ZACZNIJ od jednego Read tego pliku — to ten sam diff, ktory inaczej generowalbys sam. NIE odpalaj wlasnego \`git diff\` calej fazy.${kontekst.diffUciety ? `
UWAGA: ten zrzut jest PRZYCIETY (limit ${Math.round(LIMIT_DIFFU_B / 1024)} KB, znacznik uciecia na koncu pliku) — NIE jest pelnym obrazem zmian.
Pliki z listy powyzej, ktorych w zrzucie nie ma, dobierz osobno (Read pliku albo \`git diff -- <plik>\`).` : ''}
Gdy Read tego pliku sie nie powiedzie albo plik okaze sie pusty (np. /tmp wyczyszczone) — zrob wlasny \`git diff\` fazy dokladnie jak dotad: brak artefaktu NIE zwalnia Cie z obejrzenia pelnego diffu.`
    : ''
  return `

=== MAPA ZMIAN FAZY (wspolna, zbudowana raz) ===
${kontekst.diffStat || ''}
${lista}
${diffBlok}
Uzyj jej jako punktu startu. Read tylko pliki istotne dla Twojego fokusu — pelna wiernosc, NIE polegaj wylacznie na mapie.`
}

function kontekstPrompt(sciezka, faza, diffPlik) {
  return `Jestes context-packagerem review fazy ${faza} (${sciezka}). Zbuduj WSPOLNA mape zmian dla reviewerow,
zeby kazdy z nich nie musial od zera ustalac co sie zmienilo (dotad 7x ten sam git diff).

1. Ustal zakres zmian fazy ${faza}: \`git diff --stat\` zmian tej fazy. Jesli faza ma osobne commity — diff od bazy fazy;
   jak nie da sie wyodrebnic — uzyj diff vs main/origin/main.
2. Zrzuc PELNY diff DOKLADNIE tego samego zakresu do pliku ${diffPlik} — Bash, przekierowaniem powloki:
   \`git diff <ten sam zakres co w kroku 1> > ${diffPlik}\`
   Tresc diffu ma NIGDY nie przejsc przez Twoja odpowiedz (to Twoje tokeny wyjsciowe) — tylko przekierowanie.
   Potem \`wc -c < ${diffPlik}\`. Gdy rozmiar > ${LIMIT_DIFFU_B} B, przytnij i oznacz uciecie:
   \`head -c ${LIMIT_DIFFU_B} ${diffPlik} > ${diffPlik}.tmp && mv ${diffPlik}.tmp ${diffPlik} && printf '\\n%s\\n' '${ZNACZNIK_UCIECIA}' >> ${diffPlik}\`
   Zwroc METADANE: diffPlik (sciezka albo "" gdy zrzut sie nie udal), diffZapisany (plik powstal i jest niepusty),
   diffUciety (czy przycinales). Nieudany zrzut NIE jest bledem krytycznym — ustaw diffZapisany=false i lec dalej.
3. Dla kazdego zmienionego pliku podaj jednolinijkowe "czego dotyczy" (np. "nowy hook useLobbyData — fetch + realtime").
4. Ustal 4 FLAGI WARSTW (ui / dane / typowanie / nowyModul — opisy w schemacie). Oceniaj po TRESCI zmian,
   nie po nazwie katalogu: projekt bez src/ tez ma warstwe danych, a plik .mjs z petla INSERT to "dane".
   \`typowanie\` = sa pliki .ts/.tsx w diffie ALBO w korzeniu repo istnieje tsconfig.json (sprawdz).
   Flagi decyduja, ktorzy reviewerzy sie odpala — pomylka w gore (true) jest tania, w dol (false) gubi reviewera.
5. Policz \`e2eCheckboxy\`: niezaznaczone checkboxy "Weryfikacja:" fazy ${faza} w ${sciezka}/*-zadania.md wymagajace
   PRZEGLADARKI (open/navigate URL, click, type/fill, assert visible, screenshot, responsywnosc, 🌐). CLI/Manual nie licz.
Nie oceniaj jakosci, nie zglaszaj findingow. Zwroc obiekt {diffStat, pliki[], warstwy{}, e2eCheckboxy, diffPlik, diffZapisany, diffUciety}.`
}

function reviewerPrompt(sciezka, faza, fokus, poprzednie, kontekst) {
  return `Jestes reviewerem fazy ${faza} w folderze ${sciezka}.
Przeczytaj zmiany git tej fazy (diff) + requirements doc (docs/brainstorms/*-requirements.md jesli istnieje) + plan techniczny / Implementation Unit fazy ${faza} w docs/plans/ (Files:, Test scenarios:, Patterns to follow:).
Przeczytaj tez .claude/rules/learned-patterns.md (jesli istnieje) — reguly z poprzednich zadan tego projektu; naruszenie ktorejkolwiek z nich zglos jako finding.
Skup sie na: ${fokus}.
Sklasyfikuj kazdy finding: P1 (blocking), P2 (important), P3 (nit) oraz typ: KOD / TEST / E2E / OPERATOR.
Zwroc obiekt {findings:[...]} zgodny ze schematem. Sam nie zapisuj plikow.
${BLOK_ZAUFANIE}${BLOK_LIMIT_P3}${mapaBlok(kontekst)}${rereviewBlok(poprzednie)}`
}

function testCoveragePrompt(sciezka, faza, poprzednie, kontekst) {
  return `Jestes testerem scenariuszy/coverage dla fazy ${faza} w ${sciezka}.
Sprawdz: happy path, invalid inputs, boundary conditions, concurrent operations, scale.
Test coverage: czy plan techniczny (docs/plans/) definiowal scenariusze testowe dla tej fazy i czy pliki testowe
istnieja oraz maja asercje? Brakujace testy = P2 (typ TEST).
Zwroc {findings:[...]} (severity P1/P2/P3, typ KOD/TEST/E2E/OPERATOR). Nie zapisuj plikow.
${BLOK_DLUGIE_KOMENDY}${BLOK_LIMIT_P3}${mapaBlok(kontekst)}${rereviewBlok(poprzednie)}`
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
${BLOK_DLUGIE_KOMENDY}${BLOK_LIMIT_P3}${rereviewBlok(poprzednie)}`
}

// Gotowy blok markdown dla raportu — liczby policzone w JS, scribe wkleja 1:1 (nie przelicza).
function przebiegBlok(p) {
  const pom = p.pominieci.length ? p.pominieci.map((x) => `${x.key} (${x.powod})`).join('; ') : 'brak — pelny sklad'
  const w = p.warstwy
    ? `ui=${p.warstwy.ui} dane=${p.warstwy.dane} typowanie=${p.warstwy.typowanie} nowyModul=${p.warstwy.nowyModul}`
    : 'brak flag (packager padl) — fail-open, pelny sklad'
  return `## Przebieg review

| Etap | Wartosc |
|---|---|
| Pliki w fazie (z tego kodu) | ${p.pliki} (${p.plikiKodu}) |
| Flagi warstw | ${w} |
| Browserowe checkboxy \`Weryfikacja:\` | ${p.e2eCheckboxy} |
| Reviewerzy aktywni | ${p.aktywni.join(', ')} |
| Reviewerzy pominieci | ${pom} |
| Findingi: znalezione -> dedup JS -> dedup semantyczny | ${p.znalezione} -> ${p.poDedupJs} -> ${p.poDedupSem} |
| Adversarial verify: weryfikowane / obalone / bez glosow | ${p.weryfikowane} / ${p.obalone} / ${p.niezweryfikowane} |`
}

function scribePrompt(sciezka, faza, potwierdzone, przebieg) {
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
   Odznacz/anotuj w pliku zadan. Dopisz sekcje "Bookkeeping checkboxow Weryfikacja:" do raportu.${przebieg.aktywni.includes('e2e') ? '' : `
   UWAGA — TESTER E2E NIE ODPALIL W TEJ FAZIE (routing pominal: ${(przebieg.pominieci.find((x) => x.key === 'e2e') || {}).powod || 'brak warstwy UI'}).
   Zadnego checkboxa wymagajacego PRZEGLADARKI NIE odznaczaj — nie ma przebiegu, ktory by to potwierdzil.
   Jesli mimo to znajdziesz taki checkbox, zostaw \`- [ ]\` i przenies go do "## Operator checklist faza ${faza}"
   (format "- [ ] Operator: ..."), bo weryfikacja nie zostala wykonana.`}
4. Policz liczniki: p1/p2/p3 (tylko KOD/TEST/E2E) oraz operator (osobno — findingi OPERATOR). P2 z bookkeepingu: CLI FAIL, Grep FAIL.
5. Ustaw severityGate: BLOKUJE (sa P1) / ZASTRZEZENIA (tylko P2) / CZYSTE (zero P1/P2 — sam P3/OPERATOR nie blokuje gate'u).
6. Policz e2e {passed, failed, skipped}.
7. Na koniec raportu wklej DOKLADNIE ten blok (1:1, NIE przeliczaj liczb — sa policzone przez orkiestratora):

${przebiegBlok(przebieg)}

Zwroc obiekt zgodny ze schematem ReviewResult (findings = finalna lista po bookkeepingu, z findingami OPERATOR wlacznie).`
}

function inspekcjaPrompt(sciezka, faza) {
  return `Jestes inspektorem dysku po padzie scribe'a review fazy ${faza} (${sciezka}). Jestes READ-ONLY:
NIE zapisuj, NIE nadpisuj i NIE modyfikuj zadnego pliku — masz wylacznie sprawdzic, co juz na dysku LEZY.

1. Sprawdz, czy istnieje plik ${sciezka}/review-faza-${faza}.md. Brak pliku => kompletny=false, raportSciezka="".
2. Sprawdz, czy raport zawiera naglowek "${SENTINEL_RAPORTU}". Scribe wkleja ten blok DOKLADNIE NA KONCU
   raportu, wiec jego obecnosc oznacza, ze zapis sie domknal. Jest => kompletny=true, nie ma => kompletny=false.
3. Odczytaj z raportu statystyki E2E {passed, failed, skipped}. Gdy raport ich nie podaje — zwroc zera. Nie zgaduj.
Zwroc {kompletny, raportSciezka, e2e}.`
}

// Liczniki i gate licza sie w JS z findings[] — tak samo jak robi to orkiestrator (policzFindingi
// w dev-autopilot-wf.js). Findingi OPERATOR sa poza gate'em: to warunki srodowiskowe, nie defekty.
function podsumujFindingi(findings) {
  const istotne = findings.filter((f) => f.typ !== 'OPERATOR')
  const liczniki = {
    p1: istotne.filter((f) => f.severity === 'P1').length,
    p2: istotne.filter((f) => f.severity === 'P2').length,
    p3: istotne.filter((f) => f.severity === 'P3').length,
    operator: findings.length - istotne.length,
  }
  const severityGate = liczniki.p1 > 0 ? 'BLOKUJE' : liczniki.p2 > 0 ? 'ZASTRZEZENIA' : 'CZYSTE'
  return { liczniki, severityGate }
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
// Sciezka zrzutu diffu: POZA repo (drzewo robocze usera zostaje czyste, artefakt nie wpadnie do commita),
// deterministyczna z (sciezka, faza) — retry packagera nadpisuje ten sam plik zamiast mnozyc smieci.
const diffPlik = `/tmp/review-diff-${String(sciezka).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-faza-${faza}.diff`
const kontekst = await agent(kontekstPrompt(sciezka, faza, diffPlik), { schema: KONTEKST, label: 'kontekst:diff', phase: 'Review' })

// Routing v2 (2026-07-26) — DOMENOWY, nie ilosciowy. Poprzedni prog "<=2 pliki" nie odpalil ani raz
// (realne fazy: 6-15 plikow), a regexy po sciezce nie trafialy w projekty bez src/. Teraz decyduja
// FLAGI WARSTW od packagera: reviewer odpala sie, gdy jego domena jest w fazie OBECNA.
// Rdzen nietykalny: security (XSS/wyciek siedzi tez w "czysto UI" pliku), spec-compliance, simplicity,
// test-coverage. Warunkowi: performance, architecture, typescript, e2e.
// FAIL-OPEN: brak mapy albo brak flag (packager padl) => PELNY sklad — bez faktow nie pomijamy nikogo.
const plikiFazy = (kontekst && kontekst.pliki) || []
const warstwy = (kontekst && kontekst.warstwy) || null
const e2eCheckboxy = (kontekst && Number.isInteger(kontekst.e2eCheckboxy)) ? kontekst.e2eCheckboxy : 0
const plikiKodu = plikiFazy.filter((p) => /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|py|go|rs|sh|sql)$/i.test(p.plik)).length

// Warunek per reviewer: brak wpisu = rdzen (zawsze aktywny).
// `plikiKodu > 0` przy `dane` (2026-07-27): faza czysto dokumentacyjna (run team-os-onboarding-instalatory,
// faza 3 — 5 plikow md, 0 kodu) dostawala flage dane=true od packagera i budzila performance-oracle
// nad markdownem. Perf nie ma czego mierzyc bez ani jednego pliku kodu — a >=5 plikow kodu i tak lapie
// duze fazy niezaleznie od flagi.
const WARUNKI = {
  performance: (w) => (w.dane && plikiKodu > 0) || plikiKodu >= 5,
  architecture: (w) => w.nowyModul || plikiKodu >= 3,
  typescript: (w) => w.typowanie,
}
const aktywni = REVIEWERZY.filter((r) => !warstwy || !WARUNKI[r.key] || WARUNKI[r.key](warstwy))
// E2E ma druga, niezalezna furtke: nawet gdy packager pomyli sie na `ui`, faza z browserowym
// checkboxem "Weryfikacja:" zawsze dostaje testera (inaczej scribe odznaczylby go bez przebiegu).
const e2eAktywny = !warstwy || warstwy.ui || e2eCheckboxy > 0
const pominieci = [
  ...REVIEWERZY.filter((r) => !aktywni.includes(r)).map((r) => ({ key: r.key, powod: 'domena nieobecna w mapie zmian fazy' })),
  ...(e2eAktywny ? [] : [{ key: 'e2e', powod: `brak warstwy UI i zero browserowych checkboxow Weryfikacja: (${e2eCheckboxy})` }]),
]
if (pominieci.length) log(`Routing v2: pomijam ${pominieci.map((p) => p.key).join(', ')} (${plikiFazy.length} plikow, ${plikiKodu} kodu)`)
else log(`Routing v2: pelny sklad (${plikiFazy.length} plikow${warstwy ? '' : ', brak flag warstw — fail-open'})`)

const thunki = aktywni.map((r) => () =>
  agent(reviewerPrompt(sciezka, faza, r.fokus, poprzKod, kontekst), { schema: FINDINGS, agentType: r.agentType, label: `review:${r.key}`, phase: 'Review' })
)
thunki.push(() => agent(testCoveragePrompt(sciezka, faza, poprzTest, kontekst), { schema: FINDINGS, label: 'review:test-coverage', phase: 'Review' }))
if (e2eAktywny) {
  thunki.push(() => agent(e2ePrompt(sciezka, faza, poprzE2e), { schema: FINDINGS, agentType: 'feature-tester-e2e', label: 'review:e2e', phase: 'Review' }))
}

const wyniki = await parallel(thunki)

// Dedup przebieg 1 — JS (po pliku + poczatku opisu): lapie identyczne sformulowania za darmo.
// Przy kolizji klucza wygrywa WYZSZE severity (P1<P2<P3), nie kolejnosc reviewerow.
//
// UWAGA — ten przebieg praktycznie NIC nie skleja i tak ma zostac. Zmierzone na trzech kolejnych
// fazach realnego runu: 49->49, 44->44, 24->24 (zero sklejen). Kilkoro reviewerow opisuje ten sam
// problem wlasnymi slowami, wiec pierwsze 60 znakow opisu nigdy sie nie pokrywa. Cala prace robi
// przebieg semantyczny nizej (117->80, -32%). Klucz zostaje jako tani filtr dokladnych powtorzen.
//
// Wzmocnienie klucza po LOKALIZACJI (plik + linia w oknie tolerancji) bylo rozwazone, zmierzone
// i ODRZUCONE — nie probuj tego ponownie bez nowych danych:
//   - sam klucz `plik:linia` (+typ) na 75 realnych findingach z raportow produkcyjnych dal
//     5 sklejen i KAZDE bylo bledne: pod jednym `plik:linia` potrafia siedziec dwa rozne defekty
//     (uprawnienia 0644 obok nieatomowego zapisu; brak try/catch obok braku walidacji roli).
//     Falszywe sklejenie TRWALE gubi finding i nikt tego nie zauwazy — ten przebieg nie ma nad
//     soba ani modelu, ani czlowieka.
//   - wariant z bramka podobienstwa opisow (Jaccard + okno linii) faktycznie dzialal: zero bledow
//     i jedno poprawne sklejenie duplikatu, ktory przepuscil nawet przebieg semantyczny. Ale trzy
//     progi kalibrowane na JEDNYM polskojezycznym korpusie (opisy findingow nie zawsze beda po
//     polsku) przy zysku rzedu jednej pary na 75 findingow to zla wymiana wobec ryzyka cichej
//     utraty findingu — regula §11 "Duplication > Complexity".
const wszystkie = wyniki.filter(Boolean).flatMap((w) => w.findings)
const RANGA = { P1: 0, P2: 1, P3: 2 }
const poKluczu = new Map()
for (const f of wszystkie) {
  const klucz = `${f.plik}|${f.opis.slice(0, 60).toLowerCase()}`
  const obecny = poKluczu.get(klucz)
  if (!obecny || RANGA[f.severity] < RANGA[obecny.severity]) poKluczu.set(klucz, f)
}
let dedup = [...poKluczu.values()]
// Zapisz stan PRZED dedupem semantycznym — `dedup` jest nadpisywane, a metryka idzie do raportu.
const poDedupJs = dedup.length

// Dedup przebieg 2 — semantyczny (haiku): 8 reviewerow czesto opisuje TEN SAM problem roznymi
// slowami; klucz tekstowy tego nie sklei, a kazdy duplikat P1/P2 kosztuje potem 1-3 sceptykow
// w verify. Agent zwraca TYLKO grupy indeksow-duplikatow; scalanie liczy JS (wygrywa wyzsze
// severity). Agent null / niepoprawne indeksy => zostaje wynik przebiegu 1 (best-effort).
if (dedup.length > 1) {
  const DEDUP_GRUPY = {
    type: 'object',
    additionalProperties: false,
    properties: {
      duplikaty: {
        type: 'array',
        items: { type: 'array', items: { type: 'integer' } },
        description: 'grupy indeksow (min 2 na grupe) opisujacych TEN SAM problem; findingi bez duplikatu POMIN',
      },
    },
    required: ['duplikaty'],
  }
  const lista = dedup.map((f, i) => `${i}. [${f.severity}/${f.typ}] ${f.plik} — ${f.opis}`).join('\n')
  const grupy = await agent(
    `Ponizej ponumerowana lista findingow z code review od NIEZALEZNYCH reviewerow (faza ${faza}, ${sciezka}).
Znajdz grupy wpisow opisujacych TEN SAM problem inna parafraza (ten sam plik/mechanizm i ta sama przyczyna).
NIE lacz roznych problemow w tym samym pliku ani problemow o wspolnym objawie, ale innej przyczynie.
W razie watpliwosci NIE laczyc. Zwroc wylacznie grupy 2+ indeksow; brak duplikatow => {duplikaty: []}.

${lista}`,
    { schema: DEDUP_GRUPY, label: 'dedup:semantyczny', model: 'haiku', phase: 'Review' }
  )
  if (grupy && Array.isArray(grupy.duplikaty)) {
    const doUsuniecia = new Set()
    for (const grupa of grupy.duplikaty) {
      const poprawne = [...new Set(grupa)].filter((i) => Number.isInteger(i) && i >= 0 && i < dedup.length)
      if (poprawne.length < 2) continue
      // Reprezentant grupy = najwyzsze severity (najnizsza RANGA); reszta odpada.
      const reprezentant = poprawne.reduce((a, b) => (RANGA[dedup[a].severity] <= RANGA[dedup[b].severity] ? a : b))
      for (const i of poprawne) if (i !== reprezentant) doUsuniecia.add(i)
    }
    if (doUsuniecia.size) {
      log(`Dedup semantyczny: scalono ${doUsuniecia.size} duplikatow (z ${dedup.length} findingow)`)
      dedup = dedup.filter((_, i) => !doUsuniecia.has(i))
    }
  } else if (!grupy) {
    log('Dedup semantyczny: agent zwrocil null — zostaje dedup JS')
  }
}

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
          `Adwersaryjnie OBAL ten finding z review fazy ${faza} (${sciezka}). Domyslnie zakladaj ze finding jest NIEREALNY, chyba ze masz twardy dowod z kodu.\nFinding [${f.severity}/${f.typ}] ${f.plik}: ${f.opis}\nSprawdz kod. Czy to prawdziwy problem czy false positive? Zwroc werdykt.\n\nWYJATEK od domyslnej skepsy: argument "to kod jednorazowy / throwaway / skrypt migracyjny / usuwany pozniej" NIE obala findingu i NIE uzasadnia severityKorekta w dol. Obalasz WYLACZNIE dowodem z kodu, ze wplyw nie zachodzi.${BLOK_ZAUFANIE}`,
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

// Metryki przebiegu liczone w JS (Filar 3: agent nigdy nie liczy tego, co JS wie na pewno).
// Ida do raportu review (widok dla czlowieka) I do orkiestratora -> stan -> telemetria (strojenie progow).
const przebieg = {
  pliki: plikiFazy.length,
  plikiKodu,
  warstwy,
  e2eCheckboxy,
  aktywni: [...aktywni.map((r) => r.key), 'test-coverage', ...(e2eAktywny ? ['e2e'] : [])],
  pominieci,
  znalezione: wszystkie.length,
  poDedupJs,
  poDedupSem: dedup.length,
  weryfikowane: doWeryfikacji.length,
  obalone: doWeryfikacji.length - (potwierdzone.length - nity.length),
  niezweryfikowane: potwierdzone.filter((f) => f.opis.startsWith('[NIEZWERYFIKOWANY')).length,
}

// Faza 3: scribe zapisuje raport + bookkeeping + liczy severity gate
phase('Zapis')
let wynik = await agent(scribePrompt(sciezka, faza, potwierdzone, przebieg), { schema: REVIEW_RESULT, label: `scribe:faza-${faza}` })
if (!wynik) {
  // Scribe padl — jedna ponowna proba (to JEDYNY agent zapisujacy review-faza-N.md i sekcje
  // "Do poprawy"; bez tych artefaktow fix dziala bez kontekstu, a czlowiek bez widoku).
  log(`Scribe fazy ${faza} padl — ponawiam raz`)
  wynik = await agent(
    `${scribePrompt(sciezka, faza, potwierdzone, przebieg)}\n\n(PONOWNA PROBA — poprzedni zapis nie zwrocil wyniku. Pliki zapisuj idempotentnie: nadpisz raport w calosci, sekcje w zadaniach ZASTAP zamiast dopisywac duplikat.)`,
    { schema: REVIEW_RESULT, label: `scribe:faza-${faza}:retry` }
  )
}
if (!wynik) {
  // Scribe potrafi padnac PO udanym zapisie — przy zwracaniu wyniku do orkiestratora (run
  // team-os-onboarding-instalatory, faza 2, 2026-07-26: raport 363 linie + komplet sekcji i
  // bookkeeping juz na dysku, APIError dopiero na returnie). Bez tej inspekcji leci scribeFail
  // i autopilot kaze powtorzyc cale review — 150-250k tokenow za prace, ktora juz jest zrobiona.
  const inspekcja = await agent(inspekcjaPrompt(sciezka, faza), { schema: INSPEKCJA_RAPORTU, model: 'haiku', label: `scribe:faza-${faza}:inspekcja` })
  if (inspekcja && inspekcja.kompletny) {
    // Liczniki i gate z JS, nie z galezi scribeFail: tam 'BLOKUJE' bylo bezpiecznikiem dla braku
    // raportu, tutaj raport jest — gate ma odpowiadac realnym findingom.
    const { liczniki, severityGate } = podsumujFindingi(potwierdzone)
    log(`Scribe fazy ${faza} padl przy zwracaniu wyniku, ale raport jest kompletny (jest "${SENTINEL_RAPORTU}") — odzyskuje wynik z dysku zamiast powtarzac review`)
    return {
      fazaNumer: faza,
      findings: potwierdzone,
      liczniki,
      severityGate,
      raportSciezka: inspekcja.raportSciezka || `${sciezka}/review-faza-${faza}.md`,
      e2e: inspekcja.e2e || { passed: 0, failed: 0, skipped: 0 },
      przebieg,
      scribeOdzyskany: true,
    }
  }
  log(`Scribe fazy ${faza} padl 2x, a raportu nie da sie odzyskac (${inspekcja ? 'raport niekompletny lub go nie ma' : 'inspektor zwrocil null'})`)
  // Scribe padl 2x — zwroc zweryfikowane findingi + flage scribeFail (orkiestrator liczy gate w JS
  // z findings[], ale NIE moze oznaczyc review jako done: raport i checkboxy nie powstaly).
  return {
    fazaNumer: faza,
    findings: potwierdzone,
    liczniki: { p1: 0, p2: 0, p3: 0, operator: 0 },
    severityGate: 'BLOKUJE',
    raportSciezka: '',
    e2e: { passed: 0, failed: 0, skipped: 0 },
    przebieg,
    scribeFail: true,
  }
}
// przebieg dokladany w JS (nie przez schemat agenta) — orkiestrator zapisuje go w stanie i telemetrii.
return { ...wynik, przebieg }

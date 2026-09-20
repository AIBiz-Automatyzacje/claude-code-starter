export const meta = {
  name: 'pipeline-analiza-a',
  description: 'Wartosc kazdej osi review i mechaniki review (z kontra adwersarialna) + research zewnetrzny zmapowany na nasz pipeline',
  phases: [
    { title: 'Wartosc review', detail: 'analityk per os/mechanika -> sceptyk per werdykt; osobno: co ucieklo do CodeRabbit' },
    { title: 'Research', detail: '4 kierunki researchu -> mapowanie na nasz pipeline' },
    { title: 'Krytyk', detail: 'czego brakuje w obu galeziach' },
  ],
}

const S = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/dane'
const WT = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template'
const OO = '/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online'

const WSPOLNE = 'KONTEKST: analizujemy pipeline dev-* (workspace-template) — autonomiczny pipeline implementacji feature\'ow oparty na subagentach Claude Code (plan -> docs -> autopilot: execute -> review 6-7 reviewerow -> adversarial verify -> fix -> kontrola diffu -> complete -> PR z botem CodeRabbit).\n' +
  'Cel calej analizy: ODCHUDZIC i zoptymalizowac ten proces (koszt tokenow, czas, liczba etapow) BEZ utraty jakosci dostarczanego kodu.\n' +
  'Miara jakosci: ile P1/P2 znajduja CodeRabbit i /bugfix PO naszym review (im mniej, tym lepiej) — nie liczba findingow naszego review.\n' +
  'NAJPIERW przeczytaj w calosci ' + S + '/dane-digest.md (twarde liczby z 2 941 agentow; koszt = tury x kontekst, tokeny wyjsciowe to 6% kosztu).\n' +
  'Pisz po polsku, z polskimi znakami. Kazda teza MA MIEC dowod: liczbe z digestu/plikow, cytat z findingu (plik:linia), albo zrodlo URL. Bez dowodu = nie pisz.'

const WERDYKT_OSI = {
  type: 'object', additionalProperties: false,
  properties: {
    element: { type: 'string' },
    coRobi: { type: 'string', description: 'w 2 zdaniach: co ten element faktycznie robi w pipeline (z kodu/promptu), nie co deklaruje' },
    kosztUdzial: { type: 'string', description: 'udzial w koszcie z digestu + koszt na agenta + tury' },
    unikalnaWartosc: { type: 'string', description: 'co znajduje TYLKO on (klasy defektow), z 3-5 cytatami findingow plik:linia i ocena czy to realne defekty czy styl/szum' },
    nakladanie: { type: 'string', description: 'z kim sie pokrywa (osie, sceptycy, CodeRabbit, typecheck/lint/testy) — z dowodem' },
    jakoscProbki: { type: 'object', additionalProperties: false, properties: {
      ocenionych: { type: 'integer' }, realnyDefekt: { type: 'integer' }, stylLubKonwencja: { type: 'integer' }, szumLubFalszywy: { type: 'integer' }, operatorLubDoc: { type: 'integer' },
    }, required: ['ocenionych', 'realnyDefekt', 'stylLubKonwencja', 'szumLubFalszywy', 'operatorLubDoc'] },
    aktualnosc: { type: 'string', description: 'czy prompt/agent jest aktualny wobec stacku i regul projektu; co jest martwe/zdublowane w prompcie' },
    werdykt: { type: 'string', enum: ['ZOSTAW', 'ZOSTAW-ODCHUDZ', 'SCAL', 'ZASTAP', 'USUN'] },
    zKim: { type: 'string', description: 'przy SCAL/ZASTAP: z czym scalic / czym zastapic (np. typecheck, CodeRabbit, jeden reviewer generalista, hook)' },
    uzasadnienie: { type: 'string' },
    szacowanaOszczednosc: { type: 'string', description: 'w % kosztu fazy i w turach, z wyliczeniem' },
    ryzyko: { type: 'string', description: 'co moze sie pogorszyc i jak to zmierzyc' },
    pewnosc: { type: 'string', enum: ['wysoka', 'srednia', 'niska'] },
  },
  required: ['element', 'coRobi', 'kosztUdzial', 'unikalnaWartosc', 'nakladanie', 'jakoscProbki', 'aktualnosc', 'werdykt', 'zKim', 'uzasadnienie', 'szacowanaOszczednosc', 'ryzyko', 'pewnosc'],
}
const KONTRA = {
  type: 'object', additionalProperties: false,
  properties: {
    element: { type: 'string' },
    obalony: { type: 'boolean', description: 'true = werdykt analityka NIE broni sie na danych' },
    argumenty: { type: 'array', items: { type: 'string' }, description: 'konkretne kontrargumenty z dowodami (liczba, cytat findingu, plik:linia)' },
    werdyktPoKontrze: { type: 'string', enum: ['ZOSTAW', 'ZOSTAW-ODCHUDZ', 'SCAL', 'ZASTAP', 'USUN'] },
    coZmienicWUzasadnieniu: { type: 'string' },
  },
  required: ['element', 'obalony', 'argumenty', 'werdyktPoKontrze', 'coZmienicWUzasadnieniu'],
}
const UCIECZKI = {
  type: 'object', additionalProperties: false,
  properties: {
    przeanalizowane: { type: 'integer' },
    klasy: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      klasa: { type: 'string' }, przyklady: { type: 'array', items: { type: 'string' } }, ktoraOsPowinnaZlapac: { type: 'string' },
      czemuNieZlapala: { type: 'string', enum: ['poza-zakresem-promptu', 'w-zakresie-ale-przeoczone', 'wymaga-kontekstu-calego-repo', 'wymaga-uruchomienia', 'to-nie-defekt-tylko-konwencja-bota', 'inne'] },
      liczba: { type: 'integer' },
    }, required: ['klasa', 'przyklady', 'ktoraOsPowinnaZlapac', 'czemuNieZlapala', 'liczba'] } },
    brakujacaOs: { type: 'string', description: 'czy jest klasa, ktorej zaden reviewer nie ma w zakresie — i czy warto ja dodac, czy zostawic botowi' },
    wniosek: { type: 'string' },
  },
  required: ['przeanalizowane', 'klasy', 'brakujacaOs', 'wniosek'],
}
const RESEARCH = {
  type: 'object', additionalProperties: false,
  properties: {
    kierunek: { type: 'string' },
    ustalenia: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      teza: { type: 'string' }, dowod: { type: 'string' }, zrodlo: { type: 'string', description: 'URL lub dokument' }, data: { type: 'string' },
      zastosowanieUNas: { type: 'string', description: 'konkretnie co to zmienia w naszym pipeline (nazwa etapu/pliku)' },
      pewnosc: { type: 'string', enum: ['wysoka', 'srednia', 'niska'] },
    }, required: ['teza', 'dowod', 'zrodlo', 'data', 'zastosowanieUNas', 'pewnosc'] } },
    czegoNieUdaloSieUstalic: { type: 'string' },
  },
  required: ['kierunek', 'ustalenia', 'czegoNieUdaloSieUstalic'],
}
const MAPA = {
  type: 'object', additionalProperties: false,
  properties: {
    zastapienia: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      naszElement: { type: 'string' }, czymZastapic: { type: 'string' }, dlaczego: { type: 'string' }, dowod: { type: 'string' }, ryzyko: { type: 'string' }, pewnosc: { type: 'string', enum: ['wysoka', 'srednia', 'niska'] },
    }, required: ['naszElement', 'czymZastapic', 'dlaczego', 'dowod', 'ryzyko', 'pewnosc'] } },
    zostawicWlasne: { type: 'array', items: { type: 'string' }, description: 'elementy, ktorych nic natywnego nie zastepuje — z uzasadnieniem' },
    trendy: { type: 'array', items: { type: 'string' } },
  },
  required: ['zastapienia', 'zostawicWlasne', 'trendy'],
}
const KRYTYK = {
  type: 'object', additionalProperties: false,
  properties: {
    luki: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { luka: { type: 'string' }, dlaczegoWazna: { type: 'string' }, jakDomknac: { type: 'string' } }, required: ['luka', 'dlaczegoWazna', 'jakDomknac'] } },
    sprzecznosci: { type: 'array', items: { type: 'string' } },
    najmocniejszeUstalenia: { type: 'array', items: { type: 'string' } },
  },
  required: ['luki', 'sprzecznosci', 'najmocniejszeUstalenia'],
}

const OSIE = [
  { key: 'security', agent: 'security-sentinel.md' }, { key: 'performance', agent: 'performance-oracle.md' },
  { key: 'code-quality', agent: 'architecture-strategist.md (+ kieran-typescript-reviewer.md i code-simplicity-reviewer.md scalone od 09.09)' },
  { key: 'correctness', agent: '(general-purpose, prompt inline w dev-docs-review-wf.js REVIEWERZY)' },
  { key: 'spec-compliance', agent: 'spec-compliance-reviewer.md' }, { key: 'test-coverage', agent: '(prompt inline: "Jestes testerem scenariuszy/coverage")' },
  { key: 'e2e', agent: 'feature-tester-e2e.md' },
]
const MECHANIKI = [
  { key: 'verify-sceptycy', opis: 'adversarial verify: 3 sceptykow na P1 (verify), sceptyk per plik na P2 (verify-batch), verify-fix; 12% kosztu; 12% obalonych, 64 korekty severity' },
  { key: 'dossier-dedup-scribe', opis: 'kontekst:diff (packager dossier), dedup JS + dedup semantyczny (haiku), scribe (raport review-faza-N.md); ok. 5,7% kosztu' },
  { key: 'petla-fix', opis: 'fix (1 agent, 83 tur), fix:pre-skan (grep), fix:kontrola (niezalezny kontroler diffu), fix:poprawka, zwin-do-poprawy; ok. 12% kosztu; naprawia 98% findingow lacznie z P3' },
  { key: 'orkiestracja-stan-telemetria', opis: 'stan:zapis (269 agentow haiku piszacych JSON), telemetria (haiku, skasowala plik 2x), bootstrap, planner fazy, domkniecie fazy (60 tur), warmup, e2e precheck/env-up/db-sync/env-down; lacznie ok. 12% kosztu' },
]

function promptAnalityka(item) {
  const os = item.key
  const plikOs = S + '/findingi-per-os/' + os + '.json'
  const zrodla = item.agent
    ? '(2) ' + plikOs + ', (4) plik agenta w ' + WT + '/.claude/agents/ (' + item.agent + ')'
    : '(2) odpowiednie fragmenty ' + S + '/koszt_tabele.txt i ' + S + '/przezywalnosc_osi2.txt'
  const zadanie = item.agent
    ? 'Ocen probke findingow z pliku JSON (potwierdzone_probka + zgloszone_probka + obalone_wszystkie): kazdy zaklasyfikuj jako realny defekt / styl-konwencja / szum-falszywy / operator-doc. Ustal, co ta os znajduje UNIKALNIE (czego nie zlapie typecheck, lint, testy, inny reviewer ani CodeRabbit), z kim sie pokrywa, czy jej prompt jest aktualny (stack: React 19, Tailwind v4, Supabase, Node; reguly w coding-rules.md) i czy zawiera martwe instrukcje. Policz koszt na faze z digestu (koszt/agent x 1 agent na faze) i oszacuj oszczednosc dla kazdego wariantu decyzji.'
    : 'Ocen mechanike na danych: ile filtruje/naprawia, ile kosztuje, co by sie stalo bez niej (dowod: liczby obalonych, korekt severity, bezSladu, tur). Zaproponuj wariant tanszy o >=50% i policz, co traci.'
  return WSPOLNE + '\n\nROLA: analityk wartosci JEDNEGO elementu pipeline\'u review: **' + os + '**' + (item.opis ? ' — ' + item.opis : '') + '.\n' +
    'PRZECZYTAJ: (1) ' + S + '/dane-digest.md, ' + zrodla + ', (3) kod: ' + WT + '/.claude/workflows/dev-docs-review-wf.js (REVIEWERZY ok. linii 361, verify ok. 1150-1300, dedup ok. 1000-1060, scribe ok. 686) i ' + WT + '/.claude/workflows/dev-autopilot-wf.js (petla fix ok. linii 1300-1560, stan:zapis, telemetria ok. 1040-1110) — czytaj grep-em/wycinkami, nie calymi plikami, (5) dla porownania z botem: pliki w ' + OO + '/docs/solutions/ zawierajace "bota" w nazwie lub tresci (np. 2026-09-17-klasy-z-istniejaca-regula-wracaja-po-naszym-review-*.md, 2026-09-13-straznik-negatywny-*.md).\n' +
    'ZADANIE: ' + zadanie + '\n' +
    'Wydaj werdykt: ZOSTAW / ZOSTAW-ODCHUDZ / SCAL / ZASTAP / USUN. Badz surowy: element, ktory glownie produkuje P3 typu styl, jest kandydatem do USUN albo SCAL, nawet jesli "cos znajduje". Element, ktory lapie realne P1/P2, ktorych nikt inny nie lapie — ZOSTAW, nawet jesli drogi.'
}

phase('Wartosc review')
const analizy = pipeline(
  [...OSIE, ...MECHANIKI],
  (item) => agent(promptAnalityka(item), { label: 'analityk:' + item.key, phase: 'Wartosc review', schema: WERDYKT_OSI }),
  (werdykt, item) => werdykt ? agent(WSPOLNE + '\n\nROLA: SCEPTYK. Analityk wydal werdykt dla elementu **' + item.key + '** (ponizej). Twoim zadaniem jest OBALIC go na tych samych danych:\n' +
    JSON.stringify(werdykt, null, 1) + '\n' +
    'Przeczytaj ' + S + '/dane-digest.md i ' + (item.agent ? S + '/findingi-per-os/' + item.key + '.json' : S + '/koszt_tabele.txt') + '; sprawdz cytowane findingi i liczby. Szukaj: (a) czy klasyfikacja probki jest uczciwa (otworz 8-10 findingow i ocen sam), (b) czy "unikalna wartosc" naprawde nie jest pokryta przez typecheck/testy/CodeRabbit/inna os, (c) czy oszczednosc jest policzona z digestu, a nie zgadnieta, (d) czy werdykt USUN nie kasuje jedynego zrodla P1 — sprawdz P1 w pliku JSON, (e) czy werdykt ZOSTAW nie broni elementu, ktory produkuje glownie P3 stylu. Domyslnie zakladaj, ze werdykt jest ZLY, i szukaj dowodu; jesli po sprawdzeniu sie broni — obalony=false i napisz, co go wzmacnia.',
    { label: 'sceptyk:' + item.key, phase: 'Wartosc review', schema: KONTRA }).then((k) => ({ element: item.key, werdykt, kontra: k })) : null,
)

const ucieczki = agent(WSPOLNE + '\n\nROLA: analityk "co ucieklo". Nasz review (6-7 reviewerow + sceptycy + fix) puszcza kod, a potem CodeRabbit na PR i /bugfix znajduja kolejne rzeczy.\n' +
  'PRZECZYTAJ: ' + S + '/dane-digest.md, potem WSZYSTKIE pliki w ' + OO + '/docs/solutions/ ktore zawieraja slowo "bota" lub "CodeRabbit" (grep -ril, ok. 19 plikow; czytaj je w calosci — to compoundy klas bledow znalezionych przez bota PO naszym review), plus ' + OO + '/.claude/rules/learned-patterns.md (36 wpisow — wnioski z bledow), plus pliki z "bugfix" w nazwie w ' + OO + '/docs/solutions/ jesli istnieja.\n' +
  'ZADANIE: wypisz kazda klase defektu/uwagi, ktora przeszla przez nasz review, przypisz jej os reviewera, ktora POWINNA ja zlapac (patrz REVIEWERZY w ' + WT + '/.claude/workflows/dev-docs-review-wf.js ok. linii 361 i pliki ' + WT + '/.claude/agents/*.md), i powiedz DLACZEGO nie zlapala (poza zakresem promptu / w zakresie ale przeoczone / wymaga kontekstu calego repo / wymaga uruchomienia / to konwencja bota, nie defekt). Rozroznij: realne defekty (bledna logika, luka bezpieczenstwa, zly test) vs. preferencje bota (styl, docstring, nazewnictwo). Na koncu: czy istnieje klasa, ktorej zaden nasz reviewer nie ma w zakresie, i czy oplaca sie ja dodac, czy taniej zostawic botowi (bot jest darmowy dla nas w tokenach).',
  { label: 'ucieczki-do-bota', phase: 'Wartosc review', schema: UCIECZKI })

const KIERUNKI = [
  { key: 'claude-code-natywne', agentType: 'claude-code-guide', prompt: 'Ustal (oficjalna dokumentacja code.claude.com/docs + changelog Claude Code + blog Anthropic, stan na wrzesien 2026), ktore NATYWNE mechanizmy Claude Code moga ZASTAPIC elementy naszego wlasnego pipeline\'u: (1) subagenci / zespoly agentow (agent teams, TeamCreate/SendMessage) vs nasz Workflow tool z JS-orkiestratorem; (2) wbudowane /code-review (ultrareview, review multi-agent w chmurze) i /simplify vs nasz dev-docs-review-wf z 6 reviewerami; (3) hooki (PreToolUse/PostToolUse/Stop/SubagentStop) vs nasze bramki-agenci (walidacja koncowa, kontrola diffu, stan:zapis); (4) pamiec i CLAUDE.md — limity, zalecany rozmiar, mechanizmy ladowania warunkowego (rules z paths/globs, @imports, skills on-demand) vs nasze 90k-znakowe CLAUDE.md wstrzykiwane do kazdego agenta; (5) ToolSearch/deferred tools i MCP — jak ograniczyc narzut ok. 500 nazw narzedzi MCP w kontekscie subagentow (per-agent tool allowlist, wylaczenie MCP w subagentach, pole tools w definicji agenta); (6) modele i effort per subagent (haiku/sonnet/opus, effort low..max), prompt caching 1h; (7) plugin evals (claude plugin eval) do mierzenia skilli; (8) Workflow tool: pipeline/parallel/resume, budget — cokolwiek nowego; (9) kompaktowanie kontekstu i limity tur subagentow. Dla KAZDEGO: co dokladnie robi, od kiedy, link, i czy realnie zastepuje nasz element (z nazwa naszego elementu). Zacznij od przeczytania ' + S + '/dane-digest.md sekcje 3, 4, 7 — zeby wiedziec, co u nas kosztuje.' },
  { key: 'spec-driven', agentType: 'web-research-specialist', prompt: 'Research (2025-2026): jak wyglada DZIS praktyka spec-driven development z agentami kodujacymi: GitHub spec-kit, AWS Kiro (specs: requirements/design/tasks), OpenSpec, BMAD, Claude Code plan mode, Cursor plans, Codex — jaki poziom szczegolowosci planu/spec sie oplaca, czy "Implementation Units" z gotowa lista plikow (nasz dev-plan: 867 linii skilla, plan techniczny + osobny dev-docs robiacy zadania z checkboxami) sa standardem czy przerostem, jakie sa dowody (case studies, benchmarki, doswiadczenia zespolow) ze szczegolowe plany podnosza jakosc vs. tylko koszt. Szczegolnie: czy plan i "docs zadania" (dwa etapy u nas: dev-plan -> dev-docs) sa gdziekolwiek rozdzielone, czy to jeden artefakt; jak inni trzymaja stan wieloetapowej implementacji (nasz .autopilot-state.json pisany przez agenta). Zwroc konkretne wzorce z URL-ami i ocene, co u nas jest nadmiarowe.' },
  { key: 'ekonomia-review', agentType: 'web-research-specialist', prompt: 'Research (2025-2026): ekonomia wieloagentowego code review i weryfikacji adwersarialnej. Szukaj dowodow (papers: LLM-as-judge, multi-agent debate, "AI code review" studies; blogi inzynierskie: Anthropic multi-agent research system, Cursor, Sourcegraph, CodeRabbit, Graphite, Greptile; raporty o false positive rate reviewerow AI; "review convergence" — czy kolejne rundy review znajduja tyle samo) na pytania: (a) ile wyspecjalizowanych reviewerow ma sens — marginalna wartosc 3. i kolejnego; (b) czy adversarial verify (sceptyk per finding) obniza false positives na tyle, by oplacic koszt; (c) jaki odsetek findingow AI-review to styl/szum; (d) wzorce ciecia kosztu: context engineering (dossier/packet zamiast pelnych dokow), prompt caching, mniejsze modele do triage, "one big turn instead of many small", tool-result trimming, ograniczenie liczby tur; (e) czy warto naprawiac P3/nitpicki automatycznie (nasza petla fix naprawia 98% wszystkiego, lacznie z P3). Zacznij od ' + S + '/dane-digest.md sekcje 0, 1, 4, 5. Zwroc ustalenia z URL-ami i pewnoscia.' },
  { key: 'tdd-i-bramki-jakosci', agentType: 'web-research-specialist', prompt: 'Research (2025-2026): TDD z agentami kodujacymi i bramki jakosci. (a) Jak dzis wyglada skuteczna praktyka "agent pisze test pierwszy" (Anthropic docs "Claude Code best practices", Kent Beck augmented coding, Simon Willison, Martin Fowler/ThoughtWorks, Addy Osmani) — czy vertical slices (tracer bullets) sa standardem; (b) jakie deterministyczne bramki (typecheck, lint, testy, mutation testing, coverage thresholds, hooki pre-commit) zastepuja reviewera-agenta i dla jakich klas defektow; (c) jak zespoly mierza jakosc kodu od agentow: escaped defects, rework rate, bot comments per PR, DORA — co jest praktykowane; (d) rola botow PR (CodeRabbit, Copilot review, Greptile) jako drugiej linii — czy zespoly rezygnuja z wlasnego wieloagentowego review na rzecz bota + bramek; (e) E2E w headless z agentem (Playwright MCP, agent-browser) — dobre praktyki, kiedy scenariusze sa niemierzalne (rAF, OAuth popup) i jak sie je oznacza. Zacznij od ' + S + '/dane-digest.md sekcje 5, 6. Zwroc ustalenia z URL-ami.' },
]

phase('Research')
const research = parallel(KIERUNKI.map((k) => () => agent(WSPOLNE + '\n\nROLA: researcher kierunku **' + k.key + '**. ' + k.prompt + '\nWymagania: minimum 8 ustalen, kazde z URL-em i data publikacji; oznacz pewnosc; osobno wypisz, czego nie udalo sie ustalic. Nie powtarzaj tresci digestu jako "ustalen" — digest to nasz stan, research to swiat zewnetrzny.', { label: 'research:' + k.key, phase: 'Research', schema: RESEARCH, agentType: k.agentType })))

const [wynikiAnaliz, wynikUcieczek, wynikiResearch] = await Promise.all([analizy, ucieczki, research])
const analizyOk = wynikiAnaliz.filter(Boolean)
const researchOk = wynikiResearch.filter(Boolean)
log('Analizy: ' + analizyOk.length + '/' + (OSIE.length + MECHANIKI.length) + ', research: ' + researchOk.length + '/' + KIERUNKI.length + ', ucieczki: ' + (wynikUcieczek ? 'ok' : 'brak'))

const mapa = await agent(WSPOLNE + '\n\nROLA: mapowanie researchu na nasz pipeline. Masz 4 raporty researchu (ponizej) i inwentarz naszej maszynerii (' + S + '/dane-digest.md sekcja 7 + kod w ' + WT + '/.claude/workflows/ i ' + WT + '/.claude/skills/dev-*/SKILL.md — czytaj wycinkami).\nRAPORTY:\n' +
  JSON.stringify(researchOk, null, 1) + '\n' +
  'ZADANIE: dla kazdego naszego elementu (skill dev-brainstorm/prep/plan/docs/docs-execute/docs-review/docs-complete/compound/compound-refresh/pr; workflow: bootstrap, e2e env, warmup, planner, build, domkniecie, stan:zapis, kontekst:diff, 6 reviewerow, dedup, verify, scribe, fix, pre-skan, kontrola, poprawka, walidacja-koncowa, compound, smoke, complete, telemetria; agenci; reguly; hooki) powiedz, czy istnieje NATYWNY lub standardowy zamiennik (z dowodem z raportow), co zostaje wlasne i dlaczego. Uwzglednij ograniczenie: skrypt Workflow nie ma fs ani Bash — stad agenci haiku piszacy stan i telemetrie. Wypisz tez trendy, ktore powinny wplynac na projekt "po".', { label: 'mapowanie-researchu', phase: 'Research', schema: MAPA })

phase('Krytyk')
const krytyk = await agent(WSPOLNE + '\n\nROLA: krytyk kompletnosci. Masz wyniki dwoch galezi analizy pipeline\'u: (1) werdykty per os review i mechanike + kontry sceptykow + analiza ucieczek do bota, (2) research zewnetrzny + mapa zastapien. Przeczytaj tez ' + S + '/dane-digest.md.\nWYNIKI:\n' +
  JSON.stringify({ analizy: analizyOk, ucieczki: wynikUcieczek, mapa: mapa }, null, 1) + '\n' +
  'ZADANIE: (a) LUKI — czego NIE zmierzono albo nie oceniono, a bez czego plan odchudzenia bedzie zgadywaniem (np. brak pomiaru X, brak porownania Y); dla kazdej: jak ja domknac konkretnie (skrypt, agent, pomiar na nastepnym runie); (b) SPRZECZNOSCI miedzy werdyktami/kontrami/researchem; (c) 10 najmocniejszych ustalen z dowodami — to pojdzie do projektantow pipeline\'u "po". Badz konkretny, bez ogolnikow.', { label: 'krytyk-kompletnosci', phase: 'Krytyk', schema: KRYTYK })

return { analizy: analizyOk, ucieczki: wynikUcieczek, research: researchOk, mapa: mapa, krytyk: krytyk }
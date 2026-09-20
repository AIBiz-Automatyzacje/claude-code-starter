export const meta = {
  name: 'pipeline-analiza-etap2-research',
  description: 'Etap 2: research zewnetrzny w 5 kierunkach (kontekst subagentow, mutation testing, bramki mechaniczne, coding-rules 2026, ekonomia review LLM) + mapowanie na inwentarz pipeline dev-*',
  phases: [
    { title: 'Research', detail: '6 agentow (opus): 2x claude-code-guide + 4 web research, min. 8 ustalen z URL i data', model: 'opus' },
    { title: 'Mapowanie', detail: '1 agent (opus): dla kazdego elementu inwentarza — czy istnieje natywny/standardowy zamiennik, z dowodem', model: 'opus' },
  ],
}

const WT = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template'
const AN = WT + '/docs/reviews/2026-09-19-analiza-pipeline'

const FAKTY = 'FAKTY Z ETAPOW 0-1b (nasze pomiary, 13 runow autopilota, 2941 agentow; nie kwestionuj, uzyj jako wejscia):\n' +
  '- Koszt agenta = tury x kontekst. Cache read 59%, cache write 39%, output 2%. Pierwsza tura kazdego agenta zapisuje ~107k tokenow do cache: system prompt 44k, CLAUDE.md+rules 33k, nazwy ~900 narzedzi MCP 27k, opisy ~300 skilli 10k. Faza autopilota powoluje 35 agentow. Reviewer przed rozrostem CLAUDE.md: 398k tokenow/agent, 13 tur; po: 938k/agent, 28 tur.\n' +
  '- Review 6 osi (security, correctness, spec-compliance, performance, test-coverage, code-quality, e2e) + sceptycy verify (obalaja 12-19% findingow) + petla fix (naprawia 98%, w tym P3). Review NIE ZBIEGA: powtorka tej samej fazy daje 12-18 nowych findingow; P1 znaleziony dopiero w drugim pelnym przejsciu.\n' +
  '- Ucieczki do bota CodeRabbit po naszym review: 68 realnych defektow z compoundow, 45 mialo wlasciciela-reviewera I regule w prompcie/CLAUDE.md i mimo to przeszly; z 574 uwag bota na GitHubie 195 to realne defekty do uniknięcia (B), 157 szum konfiguracyjny (progi 300/50 linii, styl). Najwieksze klasy B: sciezka bledu bez obslugi, cykl zycia React/wyscigi, TEST NIEFALSYFIKOWALNY (31: asercja/atrapa/schemat luzniejszy od kontraktu), bramka czarna lista, PII w message do Sentry, brak timeoutu, poprawka w juz wypchnietej migracji (P1).\n' +
  '- Decyzje juz podjete: performance -> ZASTAP (size-limit + Supabase advisors + 5 linii w correctness); code-quality -> ESLint flat config + knip w domknieciu fazy, agent tylko na klasy zachowaniowe; test-coverage -> kryterium falsyfikowalnosci; reguly bez mechanicznego wejscia nie dzialaja -> polecenia-listy w promptach; dev-plan+dev-docs -> jeden skill; stan orkiestracji doklejany do promptu nastepcy zamiast agenta haiku.\n' +
  '- Stack projektow: TypeScript strict, React 19, Vite, Tailwind v4, shadcn/ui, Supabase (Postgres, RLS, Edge Functions), Node/Hono, vitest, Playwright/agent-browser E2E, Sentry, PostHog, CodeRabbit jako bot PR, Claude Code z Workflow tool (subagenci).\n'

const ZASADY = '\nZASADY: Pisz po polsku z polskimi znakami. Uzyj WebSearch i WebFetch (zaladuj je przez ToolSearch "select:WebSearch,WebFetch"); dla dokumentacji bibliotek mozesz uzyc context7 (ToolSearch "context7"). KAZDE ustalenie musi miec: URL zrodla (oficjalne docs > repo/changelog > paper > blog; pojedynczy tweet lub blog bez danych = niska pewnosc), date publikacji lub ostatniej aktualizacji strony (jesli nieznana, wpisz "brak daty" — nie zgaduj), 1-2 zdania tezy i 1 zdanie "co to znaczy dla naszego pipeline". MINIMUM 8 ustalen, docelowo 10-14. Nie wymyslaj URL-i — otworz kazdy WebFetch-em i cytuj tylko to, co tam jest. Jesli czegos nie znalazles, zapisz w polu luki jako "do pomiaru" lub "brak zrodla", nie zastepuj opinia. Odpowiedz WYLACZNIE przez StructuredOutput.'

const RESEARCH = {
  type: 'object', additionalProperties: false,
  properties: {
    kierunek: { type: 'string' },
    ustalenia: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      teza: { type: 'string' }, url: { type: 'string' }, data: { type: 'string' },
      typZrodla: { type: 'string', enum: ['docs', 'repo', 'paper', 'blog', 'benchmark', 'inne'] },
      pewnosc: { type: 'string', enum: ['wysoka', 'srednia', 'niska'] },
      dlaNas: { type: 'string', description: 'co to zmienia w naszym pipeline, 1 zdanie' },
    }, required: ['teza', 'url', 'data', 'typZrodla', 'pewnosc', 'dlaNas'] } },
    luki: { type: 'array', items: { type: 'string' }, description: 'pytania bez zrodla: "do pomiaru" albo "brak zrodla"' },
    rekomendacje: { type: 'array', items: { type: 'string' }, description: '3-6 konkretnych ruchow dla naszego pipeline wynikajacych z ustalen, kazdy z odwolaniem do numeru ustalenia' },
    kosztWdrozenia: { type: 'string', description: 'szacunek: ile pracy/konfiguracji i jaki koszt runtime (czas CI, tokeny) — 2-3 zdania' },
  },
  required: ['kierunek', 'ustalenia', 'luki', 'rekomendacje', 'kosztWdrozenia'],
}

const GUIDE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    odpowiedzi: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      pytanie: { type: 'string' }, odpowiedz: { type: 'string' }, url: { type: 'string' }, data: { type: 'string' },
      status: { type: 'string', enum: ['potwierdzone-w-docs', 'docs-milcza-do-pomiaru', 'zaprzeczone-w-docs'] },
    }, required: ['pytanie', 'odpowiedz', 'url', 'data', 'status'] } },
  },
  required: ['odpowiedzi'],
}

const KIERUNKI = [
  {
    key: 'natywne-a', typ: 'guide',
    prompt: 'Odpowiedz krotko po polsku, z URL do docs Claude Code (code.claude.com/docs) i data strony. Dwa pytania:\n' +
      '1. Czy reguly .claude/rules/*.md z frontmatter paths: (globy) laduja sie w SUBAGENTACH (Agent tool, agent() w Workflow) gdy subagent czyta plik pasujacy do globu? Jesli docs tego nie mowia wprost, odpowiedz "docs milcza — do pomiaru".\n' +
      '2. Co dokladnie robi omitClaudeMd: true w definicji subagenta — czy wylacza tez rules/*.md i @import, od jakiej wersji, czy dziala dla agentow uruchamianych z Workflow tool?',
  },
  {
    key: 'natywne-b', typ: 'guide',
    prompt: 'Odpowiedz krotko po polsku, z URL do docs Claude Code i data strony. Jedno pytanie z dwoma czesciami:\n' +
      'Jak dziala claude plugin eval (i /skill-doctor) do MIERZENIA skuteczności skilli i agentow: format suite JSON, co jest mierzone (trafienie triggera, jakosc wyjscia, tokeny?), czy da sie uruchomic w CI, czy nadaje sie do porownania dwoch wersji promptu reviewera (A/B) na tych samych przypadkach?',
  },
  {
    key: 'mutation-testing', typ: 'web',
    prompt: 'KIERUNEK 2: testy niefalsyfikowalne — mutation testing jako narzedzie zamiast promptu reviewera.\n' +
      'Kontekst: 31 z 195 uwag bota to test niefalsyfikowalny (asercja zawsze przechodzi, atrapa nie sprawdza argumentow, schemat Zod luzniejszy od kontraktu). Dzis lapie to (slabo) agent LLM test-coverage. Pytania: (a) StrykerJS 2025/2026 — stan, integracja z vitest (runner @stryker-mutator/vitest-runner), tryb incremental i --since/diff-only: czy da sie uruchomic TYLKO na plikach zmienionych w fazie (git diff) i ile to trwa; (b) koszt czasu na projekcie ~50-200 plikow TS/TSX, typowe mutation score progi; (c) alternatywy dla TS (np. mutation testing wbudowane w inne narzedzia, "assertion roulette"/vacuous-assertion lintery: eslint-plugin-vitest expect-expect, no-conditional-expect, valid-expect; jest/vitest "toHaveBeenCalledWith" checks); (d) czy mutation testing lapie klasy "atrapa bez sprawdzenia argumentow" i "schemat luzniejszy od kontraktu", czy tylko slabe asercje; (e) jak zespoly uzywajace LLM do pisania testow raportuja problem testow "ksztaltu" i co robia (papers/blogi 2025-2026); (f) czy mutation testing w CI na diffie to praktyka standardowa czy niszowa.',
  },
  {
    key: 'bramki-mechaniczne', typ: 'web',
    prompt: 'KIERUNEK 3: bramki mechaniczne w domknieciu fazy — co jest standardem 2026.\n' +
      'Kontekst: dzis role lintera gra agent Opus (code-quality), progi rozmiaru 300/50 linii egzekwuje bot PR i generuje 80 uwag szumu; pusty catch i martwa galaz przechodza; poprawka w juz wypchnietej migracji Supabase przeszla jako P1. Pytania: (a) ESLint 9/10 flat config 2026 — aktualna skladnia, typescript-eslint v8+ strict-type-checked, reguly: max-lines (z opcja skipBlankLines/skipComments; jak ustawic tolerancje 20% -> 360/60), max-lines-per-function, no-empty, no-unreachable, no-explicit-any, no-non-null-assertion, import ordering (eslint-plugin-import-x vs perfectionist vs simple-import-sort — ktory jest zywy); react-hooks v5+ z regulami React 19 (react-compiler, set-state-in-effect); (b) knip — stan 2026, co wykrywa (nieuzywane eksporty/pliki/zaleznosci), czas dzialania, integracja z vitest/vite; (c) size-limit vs bundlesize vs vite-bundle-visualizer — standard bramki bundle w CI dla Vite; (d) bramka niezmiennosci migracji: czy Supabase CLI / inne narzedzia (Atlas, sqitch, prisma migrate) maja wbudowane wykrywanie edycji juz zaaplikowanej migracji; jak to robia zespoly (git diff na katalogu migracji, checksum); (e) czy sa gotowe "quality gate" pakiety laczace to w jedno polecenie (np. biome jako zamiennik ESLint+prettier — czy pokrywa reguly typu max-lines i typed rules; oxlint); (f) czas wykonania kazdej bramki na projekcie ~50-200 plikow, zeby ocenic koszt w domknieciu fazy.',
  },
  {
    key: 'coding-rules-2026', typ: 'web',
    prompt: 'KIERUNEK 4: coding-rules od zera — skonfrontuj nasz dokument regul z praktykami 2026.\n' +
      'PRZECZYTAJ NAJPIERW plik ' + WT + '/.claude/rules/coding-rules.md (14 sekcji, ~11k znakow) narzedziem Read. Potem dla KAZDEJ sekcji sprawdz w oficjalnych zrodlach (docs TypeScript 5.x/6, react.dev dla React 19, supabase.com/docs, hono.dev, nodejs.org, vitest.dev, typescript-eslint, OWASP) czy regula: (1) jest nadal aktualna, (2) jest przestarzala lub sprzeczna z zaleceniem oficjalnym, (3) jest lepiej egzekwowana narzedziem niz tekstem (podaj regule lintera/konfiguracje), (4) czegos brakuje wzgledem praktyk 2026 (np. React 19: Actions, useActionState, use(), ref jako prop, React Compiler i co to zmienia w memoizacji; TS: satisfies, using/Explicit Resource Management, erasableSyntaxOnly, verbatimModuleSyntax; Supabase: RLS z auth.uid() w (select ...), security definer, app_metadata vs user_metadata, advisors; Hono: walidatory zValidator, middleware kolejnosc, HTTPException; Node 22/24: fetch natywny, AbortSignal.timeout, node:test; testy: vitest browser mode, testing-library zasady). Zwroc uwage na wewnetrzne sprzecznosci dokumentu (np. sekcja 3 "wyciagaj shared logic" vs sekcja 11 "duplication > complexity"; absolutne NIGDY/ZAWSZE). Kazde ustalenie = jedna regula lub luka z URL do zrodla. Minimum 12 ustalen. W rekomendacjach: lista USUN / ZMIEN / DODAJ / PRZENIES-DO-LINTERA z numerem sekcji.',
  },
  {
    key: 'ekonomia-review', typ: 'web',
    prompt: 'KIERUNEK 5: ekonomia review wieloagentowego LLM.\n' +
      'Kontekst: nasz review 6 wyspecjalizowanych reviewerow + sceptycy adwersarialni (obalaja 12-19%) + petla fix; koszt review = ok. 66% tokenow fazy; review NIE ZBIEGA — powtorka tej samej fazy daje 12-18 nowych findingow, P1 znaleziony dopiero w drugim przejsciu; 45 z 68 ucieczek mialo regule w prompcie i przeszlo. Pytania: (a) czy niezbieganie (brak stabilnosci findingow miedzy przejsciami, niska powtarzalnosc) jest udokumentowana wlasnoscia LLM-as-reviewer/LLM-as-judge — szukaj papers 2024-2026 o self-consistency, inter-run agreement, recall vs liczba probek (sampling k razy, union findingow, "more agents is all you need" i krytyki), oraz jak to gasza (majority vote, kalibracja, ensembling, ograniczenie do jednego przejscia + deterministyczne narzedzia); (b) ile wyspecjalizowanych reviewerow ma sens: dane o zyskach z podzialu na role vs jeden generalista (papers o multi-agent debate, role specialization, "agents as reviewers" w code review: CodeRabbit, Greptile, Cursor Bugbot, GitHub Copilot code review, Anthropic /code-review i "ultrareview" — jak oni to robia: ile przejsc, czy weryfikuja findingi drugim agentem, jak deduplikuja); (c) czy adversarial verification (drugi agent probuje obalic finding) sie oplaca — dane o false positive rate w AI code review 2025-2026 i o skutecznosci weryfikatora; (d) context engineering: dossier/streszczenie diffu vs pelne czytanie repo przez reviewera — co mowia dane o recall gdy reviewer dostaje tylko diff, diff+kontekst, cale pliki; (e) czy reguly w system prompt podnosza wykrywalnosc czy nie (instruction following w dlugich promptach, "lost in the middle", degradacja z liczba regul) — dowody, ze checklisty/polecenia produkujace liste dzialaja lepiej niz zasady; (f) koszt: jak inni ograniczaja koszt review per PR (routing po ryzyku diffu, review tylko zmienionych funkcji, cache).',
  },
]

const MAPOWANIE = {
  type: 'object', additionalProperties: false,
  properties: {
    elementy: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      element: { type: 'string' },
      dzisiaj: { type: 'string', description: 'jak dziala u nas, 1 zdanie' },
      zamiennik: { type: 'string', enum: ['natywny-claude-code', 'standardowe-narzedzie', 'czesciowy', 'brak', 'nie-dotyczy'] },
      czym: { type: 'string', description: 'nazwa mechanizmu/narzedzia albo "-"' },
      dowod: { type: 'string', description: 'URL + data z researchu (albo numer ustalenia kierunek:nr)' },
      coZostajeAgentowi: { type: 'string', description: 'jaka czesc pracy nadal wymaga LLM po wdrozeniu zamiennika' },
      ryzyko: { type: 'string' },
    }, required: ['element', 'dzisiaj', 'zamiennik', 'czym', 'dowod', 'coZostajeAgentowi', 'ryzyko'] } },
    sprzecznosciMiedzyKierunkami: { type: 'array', items: { type: 'string' } },
    doPomiaru: { type: 'array', items: { type: 'string' }, description: 'tezy z researchu, ktore u nas trzeba zmierzyc zanim staną się decyzja' },
  },
  required: ['elementy', 'sprzecznosciMiedzyKierunkami', 'doPomiaru'],
}

phase('Research')
const wyniki = await parallel(KIERUNKI.map((k) => () => {
  if (k.typ === 'guide') {
    return agent(k.prompt, { label: 'research:' + k.key, phase: 'Research', schema: GUIDE_SCHEMA, model: 'opus', agentType: 'claude-code-guide' })
      .then((r) => ({ key: k.key, typ: 'guide', wynik: r }))
  }
  return agent(FAKTY + '\n' + k.prompt + ZASADY, { label: 'research:' + k.key, phase: 'Research', schema: RESEARCH, model: 'opus' })
    .then((r) => ({ key: k.key, typ: 'web', wynik: r }))
}))
const gotowe = wyniki.filter(Boolean)
log('Research gotowy: ' + gotowe.length + '/' + KIERUNKI.length + ' kierunkow')
const padly = KIERUNKI.filter((k) => !gotowe.find((g) => g.key === k.key)).map((k) => k.key)
if (padly.length) log('PADLY (bez wyniku): ' + padly.join(', '))

phase('Mapowanie')
const mapa = await agent(FAKTY +
  '\nROLA: mapowanie researchu na nasz pipeline. Przeczytaj narzedziem Read: ' + AN + '/ETAP1-ROZSTRZYGNIECIE.md (sekcja 1 — tabela 11 elementow: security, correctness, spec-compliance, performance, e2e, code-quality, test-coverage, verify-sceptycy, petla fix, orkiestracja/stan/telemetria, dossier/dedup/scribe) oraz ' + AN + '/ETAP1B-ROZSTRZYGNIECIE.md sekcja 3 (etapy: domkniecie fazy, planner dev-plan/docs, builder, dev-pr) i ' + AN + '/HANDOFF.md sekcja 3 (model kosztu) i 6a pkt 7 (co juz wiemy o kontekscie subagentow).\n' +
  'INWENTARZ do zmapowania (kazdy jako osobny wpis): 7 osi review (security, correctness, spec-compliance, performance, test-coverage, code-quality, e2e), verify-sceptycy, dedup semantyczny, packager/dossier, scribe telemetrii, stan:zapis (agent haiku), precheck, env-up E2E, pre-skan fixa, kontrola diffu naprawczego, domkniecie fazy (typecheck/test/lint/commit), planner+dev-docs, builder (kontekst startowy: CLAUDE.md, rules, MCP, skille), dev-pr (tury z botem), dev-compound (dopisywanie do CLAUDE.md/learned-patterns), sync-template (dystrybucja szablonu), coding-rules.md jako dokument.\n' +
  'Dla KAZDEGO elementu odpowiedz: czy istnieje natywny mechanizm Claude Code (tools: allowlist, omitClaudeMd, rules paths:, skills:, plugin eval, hooks) albo standardowe narzedzie (ESLint/knip/size-limit/Stryker/CodeRabbit config/Supabase advisors/CI) ktore zastepuje go w calosci lub czesci — WYLACZNIE z dowodem z wynikow researchu ponizej (cytuj URL). Gdzie research nie daje dowodu, wpisz zamiennik "brak" i nie wymyslaj. Wypisz sprzecznosci miedzy kierunkami i liste tez do zmierzenia u nas.\n' +
  'WYNIKI RESEARCHU (JSON):\n' + JSON.stringify(gotowe, null, 0) + '\nPisz po polsku z polskimi znakami. Odpowiedz WYLACZNIE przez StructuredOutput.',
  { label: 'mapowanie-na-pipeline', phase: 'Mapowanie', schema: MAPOWANIE, model: 'opus' })

return { research: gotowe, padly: padly, mapowanie: mapa }

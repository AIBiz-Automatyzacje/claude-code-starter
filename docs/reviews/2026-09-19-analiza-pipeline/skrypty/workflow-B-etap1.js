export const meta = {
  name: 'pipeline-analiza-etap1',
  description: 'Etap 1: analitycy test-coverage + 4 mechanik, sceptycy do 11 werdyktow, ucieczki do bota; zapis wynikow do pliku',
  phases: [
    { title: 'Analitycy', detail: 'test-coverage + 4 mechaniki review (opus)', model: 'opus' },
    { title: 'Sceptycy', detail: '11 kontr adwersarialnych, po jednej na werdykt (opus)', model: 'opus' },
    { title: 'Ucieczki', detail: 'co CodeRabbit i /bugfix znajduja PO naszym review (opus)', model: 'opus' },
    { title: 'Zapis', detail: 'pelne wyniki do dane/workflow-B-etap1-wyniki.json (haiku)', model: 'haiku' },
  ],
}

const S = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/dane'
const WT = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template'
const OO = '/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online'
const PLIK_GOTOWYCH = S + '/workflow-A-wyniki-czesciowe.json'
const PLIK_WYNIKOW = S + '/workflow-B-etap1-wyniki.json'

const WSPOLNE = 'KONTEKST: analizujemy pipeline dev-* (workspace-template) — autonomiczny pipeline implementacji feature\'ow oparty na subagentach Claude Code (plan -> docs -> autopilot: execute -> review 6-7 reviewerow -> adversarial verify -> fix -> kontrola diffu -> complete -> PR z botem CodeRabbit).\n' +
  'Cel calej analizy: ODCHUDZIC i zoptymalizowac ten proces (koszt tokenow, czas, liczba etapow) BEZ utraty jakosci dostarczanego kodu.\n' +
  'Miara jakosci: ile P1/P2 znajduja CodeRabbit i /bugfix PO naszym review (im mniej, tym lepiej) — nie liczba findingow naszego review.\n' +
  'NAJPIERW przeczytaj w calosci ' + S + '/dane-digest.md (twarde liczby z 2 941 agentow; koszt = tury x kontekst; tokeny wyjsciowe to 2% kosztu, cache read 59%, cache write 39%).\n' +
  'Pisz po polsku, z polskimi znakami. Kazda teza MA MIEC dowod: liczbe z digestu/plikow, cytat z findingu (plik:linia), albo sciezke do kodu. Bez dowodu = nie pisz.\n' +
  'Pliki czytaj narzedziem Read (wycinkami, offset/limit), nie cat-em; grep tylko do lokalizacji.'

const WERDYKT_OSI = {
  type: 'object', additionalProperties: false,
  properties: {
    element: { type: 'string' },
    coRobi: { type: 'string', description: 'w 2 zdaniach: co ten element faktycznie robi w pipeline (z kodu/promptu), nie co deklaruje' },
    kosztUdzial: { type: 'string', description: 'udzial w koszcie z digestu + koszt na agenta + tury' },
    unikalnaWartosc: { type: 'string', description: 'co znajduje/robi TYLKO on, z 3-5 cytatami (finding plik:linia lub kod workflow plik:linia) i ocena czy to realna wartosc' },
    nakladanie: { type: 'string', description: 'z kim sie pokrywa (osie, sceptycy, CodeRabbit, typecheck/lint/testy, inna mechanika) — z dowodem' },
    jakoscProbki: { type: 'object', additionalProperties: false, properties: {
      ocenionych: { type: 'integer' }, realnyDefekt: { type: 'integer' }, stylLubKonwencja: { type: 'integer' }, szumLubFalszywy: { type: 'integer' }, operatorLubDoc: { type: 'integer' },
    }, required: ['ocenionych', 'realnyDefekt', 'stylLubKonwencja', 'szumLubFalszywy', 'operatorLubDoc'] },
    aktualnosc: { type: 'string', description: 'czy prompt/agent/kod jest aktualny wobec stacku i regul; co jest martwe/zdublowane' },
    werdykt: { type: 'string', enum: ['ZOSTAW', 'ZOSTAW-ODCHUDZ', 'SCAL', 'ZASTAP', 'USUN'] },
    zKim: { type: 'string', description: 'przy SCAL/ZASTAP: z czym scalic / czym zastapic' },
    uzasadnienie: { type: 'string' },
    szacowanaOszczednosc: { type: 'string', description: 'w % kosztu fazy i w turach, z wyliczeniem z digestu' },
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
    coSieBroni: { type: 'array', items: { type: 'string' }, description: 'ktore tezy analityka sprawdziles i sie potwierdzily' },
    werdyktPoKontrze: { type: 'string', enum: ['ZOSTAW', 'ZOSTAW-ODCHUDZ', 'SCAL', 'ZASTAP', 'USUN'] },
    coZmienicWUzasadnieniu: { type: 'string' },
  },
  required: ['element', 'obalony', 'argumenty', 'coSieBroni', 'werdyktPoKontrze', 'coZmienicWUzasadnieniu'],
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
const ZAPIS = {
  type: 'object', additionalProperties: false,
  properties: { zapisano: { type: 'boolean' }, sciezka: { type: 'string' }, bajtow: { type: 'integer' } },
  required: ['zapisano', 'sciezka', 'bajtow'],
}

const NOWE_OSIE = [
  { key: 'test-coverage', agent: '(prompt inline: "Jestes testerem scenariuszy/coverage" w dev-docs-review-wf.js REVIEWERZY)', opis: 'najwieksze zrodlo findingow: 202 potwierdzone (P1 7 / P2 81 / P3 114), 88 zgloszonych w 15 fazach, 5,9 na agenta, 47% P3; 4,9% kosztu, 718k/agent, 26 tur' },
]
const MECHANIKI = [
  { key: 'verify-sceptycy', opis: 'adversarial verify: 3 sceptykow na P1 (verify), sceptyk per plik na P2 (verify-batch), verify-fix; ok. 6% kosztu fazy (verify 7,3% + verify-batch 2,9% globalnie); 12% obalonych, 64 korekty severity' },
  { key: 'dossier-dedup-scribe', opis: 'kontekst:diff (packager dossier, 1,6%), dedup JS + dedup semantyczny (haiku, 0,7%), scribe (raport review-faza-N.md, 2,7%); ok. 5% kosztu fazy' },
  { key: 'petla-fix', opis: 'fix (1 agent, 37 tur p50, p90 109), fix:pre-skan (haiku), fix:kontrola (niezalezny kontroler diffu), fix:poprawka, zwin-do-poprawy; ok. 17% kosztu fazy; naprawia 98% findingow lacznie z P3 (P1 5, P2 82, P3 138 w 15 fazach)' },
  { key: 'orkiestracja-stan-telemetria', opis: 'stan:zapis (269 agentow haiku piszacych JSON, 2,8%), telemetria (haiku, skasowala plik 2x), bootstrap, planner fazy (8 tur), domkniecie fazy (31 tur, 4%), warmup, e2e precheck/env-up/db-sync/env-down; lacznie ok. 12% kosztu fazy' },
]
const GOTOWE_OSIE = ['security', 'correctness', 'spec-compliance', 'performance', 'e2e', 'code-quality']

function promptAnalityka(item) {
  const os = item.key
  const jestOs = Boolean(item.agent)
  const zrodla = jestOs
    ? '(2) ' + S + '/findingi-per-os/' + os + '.json (potwierdzone_probka + zgloszone_probka + obalone_wszystkie), (4) prompt reviewera w ' + WT + '/.claude/workflows/dev-docs-review-wf.js (REVIEWERZY ok. linii 361; ' + item.agent + ')'
    : '(2) ' + S + '/koszt_tabele.txt, ' + S + '/przezywalnosc_osi2.txt, ' + S + '/journale-runow-po-0906.txt (wycinkami, grep po nazwie mechaniki), ' + S + '/telemetria-odzyskana-wszystko.json (wycinkami)'
  const zadanie = jestOs
    ? 'Ocen probke findingow z pliku JSON: kazdy zaklasyfikuj jako realny defekt / styl-konwencja / szum-falszywy / operator-doc. Ustal, co ta os znajduje UNIKALNIE (czego nie zlapie typecheck, lint, testy, coverage tool, inny reviewer ani CodeRabbit), z kim sie pokrywa (zwlaszcza: correctness, spec-compliance), czy jej prompt jest aktualny (stack: React 19, Tailwind v4, Supabase, Node; reguly w coding-rules.md sekcja 2 Testowanie) i czy zawiera martwe instrukcje. Osobno odpowiedz: czy 114 P3 tej osi to realne luki w testach czy „dopisz jeszcze test na X"; czy oplaca sie scalic ja z correctness jako „poprawnosc + testy zachowania". Policz koszt na faze z digestu i oszacuj oszczednosc dla kazdego wariantu decyzji.'
    : 'Ocen mechanike na danych: ile filtruje/naprawia/zapisuje, ile kosztuje (agentow na faze x koszt/agent z digestu), co by sie stalo bez niej lub z tanszym wariantem (dowod: liczby obalonych, korekt severity, tur, agentow). Zaproponuj wariant tanszy o >=50% (np. verify tylko dla P1/P2 KOD; stan+telemetria jako jeden plik JSON pisany przez istniejacego agenta zamiast 3 agentow haiku na faze; fix tylko P1/P2; planner+domkniecie w builderze) i policz konkretnie, co traci i o ile taniej. Uwzglednij ograniczenie platformy: skrypt Workflow nie ma fs ani Bash, wiec zapis stanu wymaga agenta.'
  return WSPOLNE + '\n\nROLA: analityk wartosci JEDNEGO elementu pipeline\'u review: **' + os + '** — ' + item.opis + '.\n' +
    'PRZECZYTAJ: (1) ' + S + '/dane-digest.md, ' + zrodla + ', (3) kod: ' + WT + '/.claude/workflows/dev-docs-review-wf.js (REVIEWERZY ok. linii 361, verify ok. 1150-1300, dedup ok. 1000-1060, scribe ok. 686) i ' + WT + '/.claude/workflows/dev-autopilot-wf.js (petla fix ok. linii 1300-1560, stan:zapis ok. 1205, telemetria ok. 1040-1110, planner i domkniecie — grep po labelach) — czytaj wycinkami, nie calymi plikami, (5) dla porownania z botem: pliki w ' + OO + '/docs/solutions/ zawierajace "bota" w nazwie lub tresci.\n' +
    'ZADANIE: ' + zadanie + '\n' +
    'Wydaj werdykt: ZOSTAW / ZOSTAW-ODCHUDZ / SCAL / ZASTAP / USUN. Badz surowy: element, ktory glownie produkuje P3 typu styl albo kosztuje wiecej niz wartosc, ktora daje, jest kandydatem do USUN/SCAL/ZASTAP, nawet jesli „cos robi". Element, ktory lapie realne P1/P2 lub chroni przed utrata pracy, a nikt inny tego nie robi — ZOSTAW, nawet jesli drogi.'
}

function promptSceptyka(key, zrodloWerdyktu, plikDanych) {
  return WSPOLNE + '\n\nROLA: SCEPTYK. Analityk wydal werdykt dla elementu **' + key + '**. ' + zrodloWerdyktu + '\n' +
    'Twoim zadaniem jest OBALIC ten werdykt na tych samych danych. Przeczytaj ' + S + '/dane-digest.md i ' + plikDanych + '; sprawdz cytowane findingi, liczby i miejsca w kodzie (' + WT + '/.claude/workflows/*.js, wycinkami).\n' +
    'Szukaj: (a) czy klasyfikacja probki jest uczciwa (otworz 8-10 findingow lub wpisow i ocen sam), (b) czy „unikalna wartosc" naprawde nie jest pokryta przez typecheck/testy/CodeRabbit/inna os/inna mechanike, (c) czy oszczednosc jest policzona z digestu, a nie zgadnieta — przelicz sam, (d) czy werdykt USUN/ZASTAP nie kasuje jedynego zrodla P1 albo jedynego zabezpieczenia (sprawdz P1 w pliku JSON / STOP-y w journalach), (e) czy werdykt ZOSTAW nie broni elementu, ktory produkuje glownie P3 stylu albo kosztuje wiecej niz daje.\n' +
    'Domyslnie zakladaj, ze werdykt jest ZLY, i szukaj dowodu; jesli po sprawdzeniu sie broni — obalony=false i wypisz w coSieBroni, co go wzmacnia. Kazdy argument z dowodem (liczba, plik:linia).'
}

phase('Analitycy')
log('5 analitykow (test-coverage + 4 mechaniki) na opus; kazdy po werdykcie od razu dostaje sceptyka')
const nowe = pipeline(
  [...NOWE_OSIE, ...MECHANIKI],
  (item) => agent(promptAnalityka(item), { label: 'analityk:' + item.key, phase: 'Analitycy', schema: WERDYKT_OSI, model: 'opus' }),
  (werdykt, item) => werdykt
    ? agent(promptSceptyka(item.key, 'Werdykt analityka (JSON):\n' + JSON.stringify(werdykt, null, 1), item.agent ? S + '/findingi-per-os/' + item.key + '.json' : S + '/koszt_tabele.txt + ' + S + '/journale-runow-po-0906.txt'),
        { label: 'sceptyk:' + item.key, phase: 'Sceptycy', schema: KONTRA, model: 'opus' })
        .then((k) => ({ element: item.key, werdykt, kontra: k }))
    : null,
)

phase('Sceptycy')
log('6 sceptykow do gotowych werdyktow z workflow-A (czytaja werdykt z pliku)')
const gotowe = parallel(GOTOWE_OSIE.map((key) => () =>
  agent(promptSceptyka(key, 'Werdykt jest zapisany w pliku ' + PLIK_GOTOWYCH + ' pod kluczem "analityk:' + key + '" — przeczytaj go narzedziem Read (plik ma ok. 79 kB; uzyj grep -n \'"analityk:' + key + '"\' zeby znalezc offset, potem Read z offsetem).', S + '/findingi-per-os/' + key + '.json'),
    { label: 'sceptyk:' + key, phase: 'Sceptycy', schema: KONTRA, model: 'opus' })
    .then((k) => ({ element: key, werdykt: 'plik:' + PLIK_GOTOWYCH + '#analityk:' + key, kontra: k }))))

phase('Ucieczki')
const ucieczki = agent(WSPOLNE + '\n\nROLA: analityk „co ucieklo". Nasz review (6-7 reviewerow + sceptycy + fix) puszcza kod, a potem CodeRabbit na PR i /bugfix znajduja kolejne rzeczy.\n' +
  'PRZECZYTAJ: ' + S + '/dane-digest.md, potem WSZYSTKIE pliki w ' + OO + '/docs/solutions/ ktore zawieraja slowo „bota" lub „CodeRabbit" (grep -ril, ok. 19 plikow; czytaj je w calosci narzedziem Read — to compoundy klas bledow znalezionych przez bota PO naszym review), plus ' + OO + '/.claude/rules/learned-patterns.md (wnioski z bledow), plus pliki z „bugfix" w nazwie w ' + OO + '/docs/solutions/ jesli istnieja, plus ' + WT + '/docs/reviews/2026-09-02-audyt-pipeline.md (sekcja o 127 komentarzach bota w 6 PR-ach).\n' +
  'ZADANIE: wypisz kazda klase defektu/uwagi, ktora przeszla przez nasz review, przypisz jej os reviewera, ktora POWINNA ja zlapac (REVIEWERZY w ' + WT + '/.claude/workflows/dev-docs-review-wf.js ok. linii 361 i pliki ' + WT + '/.claude/agents/*.md), i powiedz DLACZEGO nie zlapala. Rozroznij: realne defekty (bledna logika, luka bezpieczenstwa, zly test) vs. preferencje bota (styl, docstring, nazewnictwo). Na koncu: czy istnieje klasa, ktorej zaden nasz reviewer nie ma w zakresie, i czy oplaca sie ja dodac, czy taniej zostawic botowi (bot jest darmowy dla nas w tokenach).',
  { label: 'ucieczki-do-bota', phase: 'Ucieczki', schema: UCIECZKI, model: 'opus' })

const [wynikiNowe, wynikiGotowe, wynikUcieczek] = await Promise.all([nowe, gotowe, ucieczki])
const spory = [...wynikiNowe.filter(Boolean), ...wynikiGotowe.filter(Boolean)]
log('Etap 1: ' + spory.length + ' sporow (werdykt + kontra), ucieczki: ' + (wynikUcieczek ? wynikUcieczek.klasy.length + ' klas' : 'brak'))

phase('Zapis')
const pelne = { etap: 1, spory, ucieczki: wynikUcieczek }
const zapis = await agent('Zapisz PONIZSZY JSON dokladnie, bez zmian i bez komentarza, do pliku ' + PLIK_WYNIKOW + ' narzedziem Write (nie Bash). Po zapisie sprawdz rozmiar pliku (ls -l) i zwroc zapisano=true, sciezka, bajtow.\n\nJSON:\n' + JSON.stringify(pelne, null, 1),
  { label: 'zapis-wynikow', phase: 'Zapis', schema: ZAPIS, model: 'haiku' })

return {
  zapis,
  tabela: spory.map((s) => ({
    element: s.element,
    werdyktAnalityka: typeof s.werdykt === 'string' ? '(z pliku)' : s.werdykt.werdykt + ' / ' + s.werdykt.pewnosc + ' / ' + s.werdykt.szacowanaOszczednosc,
    obalony: s.kontra ? s.kontra.obalony : null,
    werdyktPoKontrze: s.kontra ? s.kontra.werdyktPoKontrze : null,
    liczbaArgumentow: s.kontra ? s.kontra.argumenty.length : 0,
    pierwszyArgument: s.kontra && s.kontra.argumenty[0] ? s.kontra.argumenty[0].slice(0, 300) : '',
  })),
  ucieczki: wynikUcieczek ? { przeanalizowane: wynikUcieczek.przeanalizowane, klasy: wynikUcieczek.klasy.map((k) => k.klasa + ' [' + k.liczba + ', ' + k.czemuNieZlapala + ' -> ' + k.ktoraOsPowinnaZlapac + ']'), brakujacaOs: wynikUcieczek.brakujacaOs, wniosek: wynikUcieczek.wniosek } : null,
}
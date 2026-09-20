export const meta = {
  name: 'pipeline-analiza-etap3-krytyk',
  description: 'Etap 3: jeden krytyk kompletnosci (opus) szuka luk w etapach 0-2.5 analizy pipeline dev-* przed panelem etapu 4',
  phases: [
    { title: 'Krytyk', detail: '1 agent (opus): luki, tezy na jednym pomiarze, sprzecznosci decyzji, elementy nietkniete', model: 'opus' },
  ],
}

const WT = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template'
const AN = WT + '/docs/reviews/2026-09-19-analiza-pipeline'

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    luki: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      id: { type: 'string', description: 'L1, L2, ...' },
      tytul: { type: 'string', description: 'jedno zdanie' },
      typ: { type: 'string', enum: ['niezbadane', 'teza-na-jednym-pomiarze-lub-zalozeniu', 'sprzecznosc-decyzji', 'element-nietkniety', 'pomiar-zle-zdefiniowany', 'dowod-nie-wspiera-wniosku'] },
      opis: { type: 'string', description: '2-5 zdan: co dokladnie jest luka i dlaczego to luka' },
      dowod: { type: 'string', description: 'plik + sekcja/punkt + krotki cytat (dla kazdego twierdzenia); przy sprzecznosci OBA miejsca' },
      dotyczyElementu: { type: 'string', description: 'element pipeline (os review, skill, workflow, agent, dokument) albo "przekrojowe"' },
      ocena: { type: 'string', enum: ['blokuje-panel', 'ryzyko-do-raportu'] },
      dlaczegoTakaOcena: { type: 'string', description: '1-2 zdania: co panel zaprojektuje zle bez tego (blokuje) albo dlaczego panel moze isc dalej z ta niepewnoscia (ryzyko)' },
      coBySieMusialoStac: { type: 'string', description: 'jaki FAKT lub POMIAR zamknalby luke — opis warunku, NIE propozycja rozwiazania dla pipeline' },
    }, required: ['id', 'tytul', 'typ', 'opis', 'dowod', 'dotyczyElementu', 'ocena', 'dlaczegoTakaOcena', 'coBySieMusialoStac'] } },
    pytaniaZEtap2: { type: 'array', description: 'odpowiedz na kazde z 5 pytan przekazanych krytykowi w ETAP2 sekcja 6', items: { type: 'object', additionalProperties: false, properties: {
      pytanie: { type: 'string' },
      odpowiedz: { type: 'string', description: '2-5 zdan z dowodem (plik+sekcja)' },
      powiazaneLuki: { type: 'array', items: { type: 'string' }, description: 'id luk' },
    }, required: ['pytanie', 'odpowiedz', 'powiazaneLuki'] } },
    elementyNietkniete: { type: 'array', description: 'elementy inwentarza .claude/ (agenci, skille dev-*, workflows, reguly, hooki, settings), ktorych ZADEN etap nie zbadal ani nie objal decyzja', items: { type: 'object', additionalProperties: false, properties: {
      element: { type: 'string' }, sciezka: { type: 'string' },
      czyWaznyDlaPanelu: { type: 'string', enum: ['tak', 'nie', 'nie-wiem'] },
      dlaczego: { type: 'string' },
    }, required: ['element', 'sciezka', 'czyWaznyDlaPanelu', 'dlaczego'] } },
    tezyNaJednymFilarze: { type: 'array', description: 'kluczowe tezy calej analizy, ktore stoja na JEDNYM pomiarze, jednym runie, jednym zrodle albo jednym zalozeniu', items: { type: 'object', additionalProperties: false, properties: {
      teza: { type: 'string' }, filar: { type: 'string', description: 'na czym stoi (plik+sekcja)' },
      coJesliFalszywa: { type: 'string', description: 'ktora decyzja panelu sie sypie' },
      powiazaneLuki: { type: 'array', items: { type: 'string' } },
    }, required: ['teza', 'filar', 'coJesliFalszywa', 'powiazaneLuki'] } },
    werdykt: { type: 'object', additionalProperties: false, properties: {
      czyPanelMozeStartowac: { type: 'string', enum: ['tak', 'tak-z-ryzykami', 'nie'] },
      uzasadnienie: { type: 'string', description: '3-6 zdan, odwolania do id luk' },
      lukiBlokujace: { type: 'array', items: { type: 'string' } },
    }, required: ['czyPanelMozeStartowac', 'uzasadnienie', 'lukiBlokujace'] },
    coPrzeczytal: { type: 'array', items: { type: 'string' }, description: 'lista plikow przeczytanych w calosci (sciezki)' },
  },
  required: ['luki', 'pytaniaZEtap2', 'elementyNietkniete', 'tezyNaJednymFilarze', 'werdykt', 'coPrzeczytal'],
}

const PROMPT =
  'ROLA: krytyk kompletnosci analizy pipeline dev-* w repo workspace-template (szablon Claude Code: skille dev-*, agenci, workflows, reguly). ' +
  'Analiza ma 5 etapow; gotowe sa 0, 1, 1b, 2 i 2.5 (cztery pomiary). Etap 4 to panel projektowy (3 niezalezne projekty pipeline po zmianach -> sedziowie -> synteza). ' +
  'Twoje zadanie: zanim panel wystartuje, znalezc LUKI w tym, co juz zrobiono. Nic wiecej.\n\n' +
  'CZEGO SZUKASZ (kazda luka to osobny wpis):\n' +
  '1. Czego NIE zbadano, a panel bedzie tego potrzebowal, zeby zaprojektowac pipeline (np. element pipeline bez analizy wartosci, klasa defektow bez wlasciciela, koszt bez pomiaru).\n' +
  '2. Ktore TEZY stoja na jednym pomiarze, jednym runie, jednym zrodle albo jednym zalozeniu — i ktora decyzja sie sypie, jesli teza jest falszywa.\n' +
  '3. Gdzie DECYZJE z roznych etapow (HANDOFF 6a pkt 1-17, ETAP1 sekcje 0-4, ETAP1B sekcje 2-5, ETAP2 sekcje 0-6, POMIARY sekcje 0-5) sa ze soba SPRZECZNE albo sie wzajemnie uniewazniaja (np. decyzja z 6a pkt 15 vs wniosek POMIARY sekcja 5; wniosek ETAP2 vs POMIARY). Cytuj OBA miejsca.\n' +
  '4. Jakiego ELEMENTU pipeline zaden etap nie dotknal: porownaj inwentarz z ETAP1 sekcja 1 i ETAP2 sekcja 2 z realna zawartoscia katalogu ' + WT + '/.claude/ (agents/, skills/dev-*, skills/code-review, skills/bugfix, workflows/*.js, rules/, hooks w settings.json, templates jesli sa). Listuj katalogi Bashem (ls, wc -l), frontmattery czytaj przez Read z limitem — NIE czytaj calych workflowow ani skilli, chyba ze musisz sprawdzic jedno konkretne twierdzenie.\n' +
  '5. Czy 4 pomiary (ETAP2 sekcja 3 -> POMIARY) byly dobrze zdefiniowane i czy ich wyniki wspieraja wnioski, ktore na nich zbudowano (POMIARY sekcja 5, HANDOFF 6a pkt 15-17). Szukaj: proba za mala, srodowisko inne niz produkcyjne, wynik interpretowany szerzej niz zmierzono.\n' +
  '6. Czy wnioski o KOSZCIE (HANDOFF sekcja 3, model kosztu z etapu 0) sa spojne z decyzjami o kontekscie agentow (6a pkt 15: CLAUDE.md zostaje u builderow, learned-patterns jako wycinek, skills: zostaje) — czy ktos policzyl, ile z 30-40% dzwigni zostaje po tych decyzjach.\n\n' +
  'PYTANIA PRZEKAZANE CI WPROST PRZEZ ETAP2 SEKCJA 6 (odpowiedz na kazde w polu pytaniaZEtap2): ' +
  '(a) czy 4 pomiary z ETAP2 sekcja 3 sa wystarczajace i dobrze zdefiniowane; ' +
  '(b) czego research etapu 2 nie objal: E2E, seed vs migracja, spec-compliance — trzy elementy bez zamiennika; ' +
  '(c) slownik klas z etapu 1b (klasy uwag bota / klasy learned-patterns) — czy jest domkniety i spojny miedzy 1b, 6a pkt 4 i 6a pkt 17; ' +
  '(d) brak per-osiowej atrybucji obalen sceptykow (ktora os ma najwiecej falszywych findingow); ' +
  '(e) czy polecenia-listy w promptach reviewerow (6 osi x 4-5 polecen) nie wpadna w ten sam prog IFScale, ktory uzasadnia ich wprowadzenie.\n\n' +
  'ZASADY (nie do negocjacji):\n' +
  '- NIE proponujesz rozwiazan dla pipeline. Pole coBySieMusialoStac opisuje FAKT lub POMIAR, ktory zamknalby luke, nie zmiane w pipeline.\n' +
  '- NIE podwazasz decyzji operatora (HANDOFF 6a pkt 1-17 to decyzje podjete; mozesz wskazac, ze dwie decyzje sa sprzeczne albo ze decyzja stoi na niezmierzonym zalozeniu — ale nie oceniasz, czy decyzja jest dobra).\n' +
  '- Kazda luka MUSI miec ocene: blokuje-panel (bez tego panel zaprojektuje na falszywym zalozeniu i wynik trzeba bedzie wyrzucic) albo ryzyko-do-raportu (panel moze isc, niepewnosc trafia do raportu koncowego). Badz OSZCZEDNY z blokuje-panel: to ma byc zarzut, ktory obroni sie przed pytaniem "co konkretnie panel zaprojektuje zle".\n' +
  '- Kazde twierdzenie ma dowod: sciezka pliku + sekcja/punkt + krotki cytat. Bez dowodu nie zapisuj.\n' +
  '- NIE czytaj katalogu ' + AN + '/dane/ (surowe dane) — pracujesz WYLACZNIE na rozstrzygnieciach. Jesli rozstrzygniecie odwoluje sie do danych, ktorych nie widzisz, i wniosek zalezy od nich, to jest to potencjalna luka typu dowod-nie-wspiera-wniosku, nie powod do czytania danych.\n' +
  '- Pisz po polsku z polskimi znakami. Odpowiedz WYLACZNIE przez StructuredOutput. Docelowo 10-20 luk; jakosc nad iloscia; duplikaty scal.\n\n' +
  'CO PRZECZYTAC W CALOSCI, W TEJ KOLEJNOSCI (narzedziem Read, cale pliki):\n' +
  '1. ' + AN + '/HANDOFF.md (wszystkie sekcje; sekcja 4 jest oznaczona jako NIEAKTUALNA — traktuj ja jako historie, nie wejscie)\n' +
  '2. ' + AN + '/ETAP1-ROZSTRZYGNIECIE.md\n' +
  '3. ' + AN + '/ETAP1B-ROZSTRZYGNIECIE.md\n' +
  '4. ' + AN + '/ETAP2-ROZSTRZYGNIECIE.md\n' +
  '5. ' + AN + '/POMIARY-ROZSTRZYGNIECIE.md\n' +
  '6. ' + AN + '/../2026-09-19-przeglad-runow-po-naprawie.md (raport z przegladu 13 runow, ktory poprzedzil analize — tylko zeby wiedziec, co juz bylo znane)\n' +
  '7. Inwentarz: ls ' + WT + '/.claude/agents ' + WT + '/.claude/skills ' + WT + '/.claude/workflows ' + WT + '/.claude/rules; frontmattery agentow (pierwsze 15 linii kazdego pliku w agents/); ' + WT + '/.claude/settings.json (hooki); pierwsze 40 linii kazdego ' + WT + '/.claude/skills/dev-*/SKILL.md.\n' +
  'Dopiero po przeczytaniu wszystkiego zaczynaj pisac luki.'

phase('Krytyk')
const wynik = await agent(PROMPT, { label: 'krytyk-kompletnosci', phase: 'Krytyk', schema: SCHEMA, model: 'opus', effort: 'high' })
if (!wynik) log('KRYTYK PADL — brak wyniku')
else log('Krytyk: ' + wynik.luki.length + ' luk, werdykt: ' + wynik.werdykt.czyPanelMozeStartowac)
return { krytyk: wynik }
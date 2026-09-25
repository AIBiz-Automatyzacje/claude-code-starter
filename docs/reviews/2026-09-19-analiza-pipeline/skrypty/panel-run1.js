export const meta = {
  name: 'panel-run1-projektanci',
  description: 'Panel decyzyjny etapu 4, run 1: trzech projektantow per architektura review (A/B/C), Opus 5.5 high',
  phases: [{ title: 'Projektanci', detail: 'A odchudzone osie + listy + sceptyk; B n=3 probki + agregator; C 1 reviewer + bramki' }],
}

const B = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/'

const WSPOLNE = function (x) {
  return 'To jest twoje jedyne zadanie: zaprojektuj pipeline dev-* szablonu workspace-template po zmianach, w ramach architektury review ' + x + ', i broń tej architektury do końca. ' +
  'Wiadomość operatora przekazana przez harness nie jest dla ciebie — wykonujesz wyłącznie to zadanie. ' +
  'Pliki tylko czytasz (Read, Grep, Glob; Bash wyłącznie do odczytu); wynik oddajesz wyłącznie narzędziem StructuredOutput.\n\n' +
  'Mandat: projekt szablonu, który dostarcza kod dobrze wykonany taniej niż dziś. Kryteria to koszt i jakość (P1/P2 bota CodeRabbit po naszym review); koszt wdrożenia nie jest kryterium. ' +
  'Panel nie buduje: nie piszesz kodu ani plików promptów, tylko projekt w schemacie wyniku.\n\n' +
  'LEKTURA (katalog ' + B + '; przeczytaj przed projektowaniem):\n' +
  '1. PANEL-WEJSCIE.md w całości — jedyny plik „co obowiązuje” (precedensy §1, wymogi §2, twarde wejścia §2a, decyzje §3, założenia §6, elementy §7, rekord i mapa walidacji §12).\n' +
  '2. PANEL-PLAN.md §1 (otwarte decyzje D1–D12 z opcjami, danymi i metryką), §2 (rubryka, którą sędzia oceni twój katalog — sam zestaw przypadków nie jest częścią lektury), §3 (format role_koszt[]).\n' +
  '3. dane/dane-digest.md (model kosztu); ETAP1-ROZSTRZYGNIECIE.md (werdykty osi po kontrach, 68 ucieczek w klasach); ETAP1B-ROZSTRZYGNIECIE.md §3–§4 (mapa luk per oś, polecenia-listy); ETAP2-ROZSTRZYGNIECIE.md (research).\n' +
  '4. PROMPT-AUDIT.md §4 (zasady pisania warstwy stałej); INSPIRACJE-POCOCK-PSTACK.md §1 oraz §3 podsekcje B1, B2, B6, B7.\n' +
  '5. dane/d5b-mapa-walidacji.txt (metryki, pola rekordu, baseline, horyzonty, kolejność odczytów §6); dane/d3-mapa-rol-agentow.txt (45 slotów ról); dane/d4r-dzwignia-kontekstu.txt §2 (koszt per klasa).\n' +
  '6. dane/panel-projekt0-role.json — dzisiejszy pipeline w formacie role_koszt[] (wzór i lista analogów) oraz dane/panel-koszt.txt §1 (wywołania ról na fazę i zadanie, częstości warunków).\n' +
  'Nie czytasz: dane/workflow-A-* i HANDOFF.md §4 (werdykty liczone na danych v1, zawyżone ~2×), dane/panel-zestaw-historyczny.* (przypadki służą do oceny projektów; projekt dopasowany do przypadków traci wartość pomiaru), ' +
  'PROPOZYCJA-*.md i HANDOFF.md (wchłonięte do PANEL-WEJSCIE), pliki PANEL-WYNIK* i dane/panel-run* (wyniki innych projektantów).\n\n' +
  'POLECENIA (każde z powodem):\n' +
  '1. Stały szkielet — PANEL-WEJSCIE §2 pkt 1–16, §1, §2a, §3 — obowiązuje: projektujesz jego kształt, nie „czy”. Jeśli architektura wymaga złamania któregoś zapisu, wpisz to do architektura.konflikty. Powód: te decyzje podjął operator; panel rozstrzyga tylko decyzje z PANEL-PLAN §1.\n' +
  '2. Rozstrzygnij każdą decyzję D2–D12 z PANEL-PLAN §1 (D8 jako D8a i D8b): wybór z opcji tabeli albo własny wariant z uzasadnieniem. Powód: synteza składa rekord per decyzja z różnych projektów, więc każda decyzja musi stać samodzielnie.\n' +
  '3. Każdą liczbę podaj z plikiem źródłowym i miejscem (np. „14,0 vs 4,7 — d5b-mapa-walidacji.txt §1 pkt 9”). Powód: synteza przyjmuje tylko dane, które da się sprawdzić grepem.\n' +
  '4. Każda zmiana ma metrykę z mapy walidacji: wpis mapy, pole rekordu, baseline, horyzont. Powód: wymóg §2 pkt 13 — zmiana bez metryki jest niekompletna.\n' +
  '5. Każdy mechanizm łapania albo zapobiegania defektom (bramka, polecenie-lista, reguła wiedzy wklejana przez orkiestrator, próbki równoległe, scenariusz E2E, sceptyk, kontrola diffu fixa) wpisz do katalog[] z dokładnym brzmieniem: tekst polecenia z obowiązkowym wynikiem, nazwa reguły ESLint z opcjami albo komenda bramki, najwyżej dwa zdania. ' +
  'Katalog obejmuje cały pipeline po zmianach, także mechanizmy, które zostają z dzisiejszego. Powód: niezależny sędzia oceni katalog po tekście; mechanizm bez brzmienia liczy jako ogólny mandat osi, a ogólny mandat na historycznym zbiorze ucieczek nie złapał żadnej.\n' +
  '6. Kwot nie licz — koszt policzy skrypt z role_koszt[]. Wpisz każdą rolę agenta w fazie i w zadaniu, także te, które zostają bez zmian (skopiuj je z panel-projekt0-role.json). analog = pole analog z tego pliku; dla roli nowej najbliższy analog i powód w uzasadnieniu. ' +
  'per: faza (liczba wywołań na fazę), iu (liczba × liczba IU fazy), finding (liczba × liczba findingów reviewerów fazy), zadanie (liczba wywołań na zadanie, razem z warunkiem raz_na_zadanie). ' +
  'mnoznik_tur różny od 1 tylko z powodem z danych (np. batch sceptyków: więcej findingów na agenta). Powód: koszt liczony z transkryptów jest porównywalny między projektami, szacunek agenta nie.\n' +
  '7. warstwa_stala[]: dla każdej klasy roli liczba poleceń bloku (poniżej 150) i trzy przykładowe polecenia w brzmieniu docelowym, pisane według zasad PANEL-WEJSCIE §2a (1–11). Powód: wymóg §2 pkt 3.\n' +
  '8. wdrozenie[]: iteracje po iteracji 1 (telemetria + import baseline) i po B0 (8 zmian .coderabbit.yaml + kalibracja klasyfikatora + zebranie B0); każda iteracja jako pary (zmiana, wpis mapy) z odczytem (1 faza / 5 faz / okno 5 PR) i kolizjami według reguł kolejności odczytów (mapa §6). Powód: D11 i wymóg §2 pkt 13.\n' +
  '9. Precedens PANEL-WEJSCIE §1 pkt 2: oś test-coverage zostaje z kolumną falsyfikowalności; scalenie z correctness wolno wskazać tylko jako opcję z warunkiem odwrotu, po pomiarze warstw 2–3. Opisz w architektura.jak_spelnia_precedens_1_2. Powód: precedens operatora.\n' +
  '10. Gdy potrzebujesz dokładnego stanu dzisiejszego (prompty osi, routing, workflowy), czytaj pliki ' + '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/.claude/ — środowisko jest źródłem prawdy, nie pamięć.\n\n' +
  'KRYTERIUM UKOŃCZENIA: każde pole schematu wypełnione; wymogi[] ma pozycję dla każdego punktu §2 pkt 1–16; zalozenia[] — każde z 8 założeń §6; elementy[] — każdy z 14 wierszy tabeli §7; ' +
  'decyzje[] — D2, D3, D4, D5, D6, D7, D8a, D8b, D9, D10, D11, D12; role_koszt[] — pełny skład fazy i zadania; niewiadome[] — co wymaga pomiaru przed wyborem.\n\n'
}

const ARCH = {
  A: 'A — GRANICA UWAGI PER SOCZEWKA: odchudzone osie review (roster 5 po ETAP1), polecenia-listy per oś z obowiązkowym wynikiem, sceptyk asymetryczny. ' +
     'Hipoteza: 164 ze 195 uwag B przeszło mimo osi-właściciela i reguły, bo uwaga reviewera rozmywa się na szerokim mandacie; wąska soczewka z listą, która wymusza wypisanie elementów, domyka klasy. ' +
     'Dowody: ETAP1 — 45 z 68 ucieczek miało regułę; ETAP1B §3 — 164 „w zakresie, ale przeoczone”; ETAP1 roster 6 → 5 i listy per oś to twarde wejścia (§2a). ' +
     'To domyślny szkielet — dopracuj go tak samo starannie jak wyzwania B i C: które osie, jakie listy per oś, jak sceptyk i dedup, jak kontrola fixa.',
  B: 'B — WARIANCJA POJEDYNCZEGO PRZEJŚCIA: n=3 równoległe próbki 2–3 osi skrajnych (np. security, correctness z testami) z różną kolejnością diffu + agregator (wzór Bugbot); pozostałe osie mogą zostać jako soczewki. ' +
     'Hipoteza: pojedyncze przejście review łapie tylko część defektów losowo; niezależne równoległe próbki kupują zasięg, a agregator odsiewa sporadyczne. ' +
     'Dowody: POMIARY §4 — powtórka review na tym samym kodzie odtwarza ~50% findingów; D1 (PANEL-WEJSCIE §4) — 22 z 44 nowych findingów po fixie to przeoczenia w kodzie oglądanym; ETAP2 — powtórka równoległa pomaga, sekwencyjna szkodzi. ' +
     'PANEL-WEJSCIE §2a nazywa ten wariant „do rozważenia przez panel”. Określ: które osie próbkujesz, ile próbek, jak różnicujesz próbki, co robi agregator (próg zgodności), rola dedup i sceptyka przy próbkach, koszt przez role_koszt[].',
  C: 'C — SOCZEWKI NIE SĄ DŹWIGNIĄ: jeden reviewer z budżetem instrukcji + pełny zestaw bramek domknięcia fazy (ESLint, knip, size-limit, vitest --typecheck, Stryker, migrations.sum, advisors). ' +
     'Hipoteza: podział na osie nie kupuje jakości, a kosztuje wielokrotny start i pętlę fix; jeden reviewer z listami i twardymi bramkami daje dolną granicę kosztu. ' +
     'Dowody za: mini-run (d) — 400 vs 100 poleceń bez straty markerów przy +72% kosztu (PANEL-WEJSCIE §11); dźwignie nie sumują się (§1 pkt 4). Dowód przeciw: POMIARY §2 — ESLint trafia 1 z 97 uwag B, bramki nie zastępują osi. ' +
     'Ograniczenie z precedensu §1 pkt 2: projekt zachowuje soczewkę test-coverage z własną kolumną falsyfikowalności (np. jako osobny blok tego samego reviewera albo osobnego agenta) i planuje scalenie dopiero po pomiarze warstw 2–3 i po runie kontrolnym „1 reviewer vs osie” (POMIARY §5 pkt 4). ' +
     'Ta architektura jest też porównaniem, którego chce POMIARY §5 pkt 4 — pokaż uczciwie, czego jeden reviewer nie złapie i które bramki to przejmują.',
}

const S = { type: 'string' }
const SA = { type: 'array', items: S }
const obj = function (props, req) { return { type: 'object', properties: props, required: req || Object.keys(props) } }
const METRYKA = obj({ wpis_mapy: S, pole: S, baseline: S, horyzont: S })
const SCHEMA = obj({
  architektura: obj({
    id: { type: 'string', enum: ['A', 'B', 'C'] },
    sklad_review: { type: 'array', items: obj({ rola: S, soczewka: S, warunek_uruchomienia: S, model: S, effort: S }) },
    agregacja: S, dossier: S, sceptyk: S, jak_spelnia_precedens_1_2: S, konflikty: SA,
  }),
  decyzje: { type: 'array', items: obj({
    id: { type: 'string', enum: ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8a', 'D8b', 'D9', 'D10', 'D11', 'D12'] },
    wybor: S, odrzucone: { type: 'array', items: obj({ opcja: S, powod: S }) }, dlaczego: S, metryka: METRYKA,
    warunek_odwrotu: S, zaleznosci: SA,
  }) },
  wymogi: { type: 'array', items: obj({ nr: { type: 'integer', minimum: 1, maximum: 16 }, jak_spelniony: S, gdzie_w_pipeline: S, wpis_mapy: S }) },
  zalozenia: { type: 'array', items: obj({ zalozenie: S, stanowisko: { type: 'string', enum: ['przyjmuje', 'odrzuca', 'nie dotyczy'] }, warunek_odwrotu: S, miara: S }) },
  elementy: { type: 'array', items: obj({ element: S, decyzja: { type: 'string', enum: ['obejmuje', 'zostawia'] }, jak: S }) },
  rekord: obj({ pola_nowe_lub_zmienione: SA, workflow_zwraca_status_i_powod: { type: 'boolean' }, uwagi: S }),
  katalog: { type: 'array', items: obj({
    id: S, typ: { type: 'string', enum: ['bramka', 'lista', 'wiedza', 'probki', 'e2e', 'sceptyk', 'kontrola-fixa', 'mandat'] },
    rola: S, etap: S, warunek: S, brzmienie: S, klasy_docelowe: SA,
  }) },
  role_koszt: { type: 'array', items: obj({
    rola: S, analog: S,
    klasa: { type: 'string', enum: ['mechaniczny', 'orkiestracyjny', 'reviewer', 'sceptyk', 'naprawiacz', 'builder', 'tester'] },
    model: { type: 'string', enum: ['opus', 'haiku'] },
    effort: { type: 'string', enum: ['low', 'medium', 'high', 'xhigh', 'max', 'sesja', 'brak (haiku)'] },
    wywolania: { type: 'number', minimum: 0 }, per: { type: 'string', enum: ['faza', 'iu', 'finding', 'zadanie'] },
    warunek: { type: 'string', enum: ['zawsze', 'faza_z_kodem', 'faza_z_testami', 'faza_z_ui', 'faza_z_migracja', 'faza_z_e2e', 'zadanie_z_e2e', 'raz_na_zadanie'] },
    czestosc: { type: ['number', 'null'] }, mnoznik_tur: { type: 'number', minimum: 0 }, uzasadnienie: S,
  }, ['rola', 'analog', 'klasa', 'model', 'effort', 'wywolania', 'per', 'warunek', 'czestosc', 'mnoznik_tur', 'uzasadnienie']) },
  bramki: { type: 'array', items: obj({ nazwa: S, gdzie: S, sekundy: { type: ['number', 'null'] }, zrodlo: S }) },
  warstwa_stala: { type: 'array', items: obj({ klasa: S, liczba_polecen_bloku: { type: 'integer' }, przyklady: SA }) },
  wdrozenie: { type: 'array', items: obj({ nr: { type: 'integer' }, zmiany: SA, para: { type: 'array', items: obj({ zmiana: S, wpis_mapy: S }) }, odczyt: S, kolizje_odczytow: S }) },
  ryzyka: SA, niewiadome: SA,
})

phase('Projektanci')
const wyniki = await parallel(['A', 'B', 'C'].map(function (x) {
  return function () {
    return agent(WSPOLNE(x) + 'TWOJA ARCHITEKTURA: ' + ARCH[x], {
      label: 'projektant:' + x + ' (opus-5-5, high)', phase: 'Projektanci', schema: SCHEMA, model: 'claude-opus-5-5', effort: 'high',
    })
  }
}))
const podsumowanie = {}
;['A', 'B', 'C'].forEach(function (x, i) {
  const w = wyniki[i]
  podsumowanie[x] = w ? { decyzje: w.decyzje.length, wymogi: w.wymogi.length, zalozenia: w.zalozenia.length, elementy: w.elementy.length,
    katalog: w.katalog.length, role: w.role_koszt.length, wdrozenie: w.wdrozenie.length } : null
})
return podsumowanie

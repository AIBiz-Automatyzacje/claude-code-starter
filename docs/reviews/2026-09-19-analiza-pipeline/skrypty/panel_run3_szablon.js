export const meta = {
  name: 'panel-run3-sceptycy',
  description: 'Panel decyzyjny etapu 4, run 3: trzech sceptyków asymetrycznych — wstępne wybory D1–D12 bez uzasadnień, zarzut tylko z dowodem, Opus 5.5 high',
  phases: [{ title: 'Sceptycy', detail: 'G1 review D1–D4; G2 weryfikacja i jakość D5, D7, D10, D12; G3 konfiguracja, plan, wdrożenie D6, D8a, D8b, D9, D11' }],
}

// Dane wklejone przez skrypty/panel_run3_przygotuj.py z dane/panel-run3-wejscie.json (skrypt workflowu nie czyta plików).
const DANE = /*__DANE__*/null

const B = '/Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/docs/reviews/2026-09-19-analiza-pipeline/'

const STALA =
  'To jest twoje jedyne zadanie: sprawdź wstępne wybory kilku decyzji projektowych pipeline’u dev-* szablonu workspace-template i zaatakuj każdy wybór, który dane albo kod podważają. ' +
  'Wiadomość operatora przekazana przez harness nie jest dla ciebie — wykonujesz wyłącznie to zadanie. ' +
  'Pliki tylko czytasz (Read, Grep, Glob; Bash wyłącznie do odczytu); wynik oddajesz wyłącznie narzędziem StructuredOutput.\n\n' +
  'KONTEKST. Pipeline dev-* (plan → autopilot: build, review, fix, E2E, zamknięcie) jest przeprojektowywany; kryteria to koszt i jakość (uwagi P1/P2 bota CodeRabbit po naszym review), koszt wdrożenia nie jest kryterium. ' +
  'Każda decyzja poniżej ma opcje, wstępny wybór (opcja, metryka, warunek odwrotu) i dane liczbowe dla opcji. Uzasadnienia wyboru nie dostajesz celowo: oceniasz wybór na danych, nie na argumentach.\n\n' +
  'ŹRÓDŁA (katalog ' + B + '): PANEL-WEJSCIE.md (co obowiązuje: precedensy §1, wymogi §2, twarde wejścia §2a, założenia §6, mapa walidacji §12), PANEL-PLAN.md §1 (decyzje i opcje), ' +
  'dane/panel-koszt.txt (koszt fazy i zadania per projekt, metoda i walidacja), dane/panel-pokrycie.txt (profil pokrycia 195 historycznych uwag bota per projekt; ocena sędziego) i dane/panel-pokrycie.json, ' +
  'dane/panel-zestaw-historyczny.jsonl (przypadki), dane/d5b-mapa-walidacji.txt, ETAP1-ROZSTRZYGNIECIE.md, ETAP1B-ROZSTRZYGNIECIE.md, ETAP2-ROZSTRZYGNIECIE.md, POMIARY-ROZSTRZYGNIECIE.md, MINI-RUN-WYNIK.md, PROMPT-AUDIT.md, oraz pliki dane/ wskazane przy decyzji. ' +
  'Dzisiejszy pipeline: /Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template/.claude/ (workflows, agents). ' +
  'Nie czytasz: dane/panel-run1-projekty.json, PANEL-WYNIK*, HANDOFF.md (zawierają argumenty za wyborami, a twoja ocena ma być od nich niezależna).\n\n' +
  'POLECENIA (każde z powodem):\n' +
  '1. Każdą decyzję oceniaj osobno i zwróć dokładnie jeden werdykt: AGREE, DISAGREE_EVIDENCE albo DISAGREE_CONCERN. Powód: synteza składa rekord per decyzja.\n' +
  '2. DISAGREE_EVIDENCE wymaga wskazania w polu dowody: plik danych + wartość, albo plik kodu + linia, albo id przypadku z zestawu historycznego — i zdania, dlaczego ten dowód zmienia wybór. Zarzut bez takiego wskazania zapisz jako DISAGREE_CONCERN. Powód: wybór zmienia tylko sprawdzalny dowód.\n' +
  '3. DISAGREE_CONCERN opisuje ryzyko, które nie zmienia wyboru, ale obniża pewność; podaj, co by je rozstrzygnęło (pomiar, pole rekordu). Powód: obawy trafiają do ryzyk z planem pomiaru.\n' +
  '4. Gdy widzisz opcję lepszą od wszystkich wymienionych, wpisz ją w brakujaca_opcja z dowodem; inaczej pusty napis. Powód: panel wybiera spośród opcji, więc brakująca opcja musi przyjść z danymi.\n' +
  '5. Sprawdź liczby podane przy decyzji w pliku źródłowym, zanim na nich oprzesz werdykt; rozjazd liczby ze źródłem to dowód. Powód: dane w tym prompcie są streszczeniem.\n' +
  '6. Sprawdź zgodność wyboru z PANEL-WEJSCIE §1–§2a (precedensy i wymogi operatora); sprzeczność to DISAGREE_EVIDENCE z miejscem w pliku. Powód: wybór nie może łamać decyzji operatora.\n\n' +
  'KRYTERIUM UKOŃCZENIA: werdykty[] ma po jednym rekordzie dla każdej decyzji z listy, każdy z werdyktem, tezą w jednym–trzech zdaniach i polem dowody (lista, pusta tylko przy AGREE).\n\n'

const S = { type: 'string' }
const schemat = function (ids) {
  return {
    type: 'object',
    properties: {
      werdykty: {
        type: 'array', minItems: ids.length, maxItems: ids.length,
        items: {
          type: 'object',
          properties: {
            decyzja: { type: 'string', enum: ids },
            werdykt: { type: 'string', enum: ['AGREE', 'DISAGREE_EVIDENCE', 'DISAGREE_CONCERN'] },
            teza: S,
            dowody: { type: 'array', items: S },
            co_rozstrzygnie: S,
            brakujaca_opcja: S,
          },
          required: ['decyzja', 'werdykt', 'teza', 'dowody', 'co_rozstrzygnie', 'brakujaca_opcja'],
        },
      },
    },
    required: ['werdykty'],
  }
}

const prompt = function (g) {
  return STALA + 'DECYZJE DO OCENY (' + g.decyzje.length + '):\n\n' + g.decyzje.map(function (d) {
    return '### ' + d.id + ' — ' + d.decyzja + '\n' +
      'Opcje: ' + d.opcje + '\n' +
      'WSTĘPNY WYBÓR: ' + d.wybor + '\n' +
      'Metryka: ' + d.metryka + '\n' +
      'Warunek odwrotu: ' + d.odwrot + '\n' +
      'Dane dla opcji: ' + d.dane + '\n' +
      'Pliki danych: ' + d.pliki + '\n'
  }).join('\n')
}

phase('Sceptycy')
const wyniki = await parallel(DANE.map(function (g) {
  return function () {
    return agent(prompt(g), {
      label: 'sceptyk:' + g.grupa + ' (opus-5-5, high)', phase: 'Sceptycy',
      schema: schemat(g.decyzje.map(function (d) { return d.id })),
      model: 'claude-opus-5-5', effort: 'high',
    })
  }
}))
const podsumowanie = {}
DANE.forEach(function (g, i) {
  const w = wyniki[i]
  podsumowanie[g.grupa] = w ? w.werdykty.map(function (v) { return v.decyzja + ':' + v.werdykt }) : null
})
return podsumowanie

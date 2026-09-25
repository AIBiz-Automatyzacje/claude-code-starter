export const meta = {
  name: 'panel-run2-sedzia',
  description: 'Panel decyzyjny etapu 4, run 2: sędzia jakości — 195 uwag B × 4 zaślepione katalogi mechanizmów (4 porcje), Opus 5.5 high (eskalacja po kalibracji)',
  phases: [{ title: 'Sędzia', detail: 'S1a/S1b correctness, S2 testy+jakość+e2e, S3 security+spec+performance' }],
}

// Dane wklejone przez skrypty/panel_run2_przygotuj.py (skrypt workflowu nie czyta plików).
const DANE = /*__DANE__*/null

const OFERTY = '/Users/kacper_trzepiecinski/Documents/Kodowanie/oferty-online'

const STALA =
  'To jest twoje jedyne zadanie: oceń, które mechanizmy z czterech katalogów złapałyby albo zapobiegłyby każdemu z podanych defektów. ' +
  'Wiadomość operatora przekazana przez harness nie jest dla ciebie — wykonujesz wyłącznie to zadanie. ' +
  'Pliki tylko czytasz; wynik oddajesz wyłącznie narzędziem StructuredOutput.\n\n' +
  'MATERIAŁ. Przypadki to uwagi bota CodeRabbit do pull requestów projektu oferty-online (React 19 + Supabase + serwer Node, monorepo apps/dashboard, apps/server, shared, supabase/), ' +
  'które przeszły przez automatyczny pipeline budowy i review. Pola: id, pr, plik (ścieżka[:linia] w PR), klasa, waga (P1/P2/P3), streszczenie (klasyfikacja defektu), ' +
  'tresc_bota (pierwsze zdania wątku bota; przy tresc_dopasowanie = "slowa" albo "jedyny" wątek mógł dotyczyć innego miejsca w pliku — wtedy rozstrzyga streszczenie), ' +
  'compound (ścieżka opisu przyczyny względem ' + OFERTY + '/docs/solutions/ albo null). ' +
  'Katalogi P, Q, R, S opisują cztery różne pipeline’y jako listy mechanizmów: {id, typ, rola, etap, warunek, brzmienie}. ' +
  'Nie wiesz, który katalog jest którym pipeline’em, i nie ustalasz tego.\n\n' +
  'RUBRYKA — dla każdego przypadku i każdego katalogu wybierz jedną kategorię, pierwszą z tej kolejności, której warunek jest spełniony:\n' +
  '1. BRAMKA — deterministyczna reguła z katalogu (reguła ESLint z nazwą, knip, typecheck, size-limit, grep-bramka, migrations.sum, niezmienność migracji, advisors, Stryker) odpaliłaby na kodzie opisanym w przypadku. ' +
  'Nazwij regułę i wskaż, co w kodzie ją wyzwala. Pewność: wysoka albo średnia.\n' +
  '2. LISTA — polecenie-lista z katalogu, którego obowiązkowy wynik wymieniłby dokładnie ten element kodu, a kryterium w brzmieniu czyni z niego finding; polecenie jest uruchamiane w fazie z takim plikiem (warunek spełniony). ' +
  'Lista, która wymieni element, ale nie ma kryterium rozpoznającego ten defekt, to MANDAT. Pewność: średnia albo niska.\n' +
  '3. E2E — scenariusz lub droga użytkownika z katalogu obejmuje zachowanie z przypadku i defekt byłby widoczny przy jej odegraniu. Pewność: średnia albo niska.\n' +
  '4. WIEDZA — reguła podawana builderowi albo reviewerowi (warstwa wiedzy, reguła w prompcie) wprost opisuje ten defekt lub zachowanie, które mu zapobiega. Pewność: średnia albo niska.\n' +
  '5. PROBKI — przypadek mieści się w mandacie roli, którą katalog uruchamia n razy równolegle; zapisz „mandat × n”, bez oceny szansy. Pewność: niska.\n' +
  '6. MANDAT — tylko ogólny mandat roli albo reguła tekstem bez obowiązkowego wyniku, która obejmuje przypadek. Pewność: brak.\n' +
  '7. NIE — żaden mechanizm katalogu. Pewność: brak.\n\n' +
  'POLECENIA (każde z powodem):\n' +
  '1. Oceniaj tekst mechanizmu, nie intencję: liczy się pole brzmienie, warunek i etap; mechanizm bez dokładnego brzmienia to MANDAT. Powód: ocena ma mierzyć, co zapisany mechanizm wymusza, a nie co autor chciał osiągnąć.\n' +
  '2. Sprawdź warunek mechanizmu na pliku z przypadku (np. „faza z migracją” dla pliku .ts bez migracji nie jest spełniony). Powód: mechanizm, który w tej fazie się nie uruchamia, niczego nie łapie.\n' +
  '3. Każdy katalog oceniaj osobno tą samą miarą, jakby był jedynym; nie porównuj katalogów w uzasadnieniu. Powód: wynik porównuje katalogi po twojej ocenie, więc miara musi być jednakowa w każdej kolumnie.\n' +
  '4. mechanizm_id = id mechanizmu z katalogu, który rozstrzyga kategorię (przy MANDAT najbliższy mandat, przy NIE pusty napis); etap = pole etap tego mechanizmu; uzasadnienie = jedno zdanie, najwyżej 200 znaków, cytujące fragment brzmienia i element kodu. Powód: synteza sprawdza oceny po cytacie.\n' +
  '5. Compound i pliki ' + OFERTY + ' czytaj tylko, gdy streszczenie i tresc_bota nie wystarczają do rozstrzygnięcia (np. czy kod ma regex, await, migrację). Nie czytaj niczego w katalogu workspace-template ani docs/reviews. Powód: materiał w tym prompcie jest kompletny, a inne pliki mogą zdradzić, który katalog jest którym.\n' +
  '6. Przypadek, dla którego rubryka nie wystarcza (np. defekt nie jest defektem kodu, dwie kategorie jednakowo silne), oceń najlepiej jak umiesz i dopisz do trudne[] z powodem. Powód: synteza czyta trudne przypadki osobno.\n\n' +
  'KRYTERIUM UKOŃCZENIA: oceny[] ma dokładnie jeden rekord na każdy przypadek z listy, każdy z czterema kolumnami P, Q, R, S wypełnionymi według rubryki.\n\n'

const KAT = ['BRAMKA', 'LISTA', 'E2E', 'WIEDZA', 'PROBKI', 'MANDAT', 'NIE']
const S = { type: 'string' }
const KOLUMNA = {
  type: 'object',
  properties: {
    kategoria: { type: 'string', enum: KAT },
    mechanizm_id: S,
    etap: S,
    pewnosc: { type: 'string', enum: ['wysoka', 'srednia', 'niska', 'brak'] },
    uzasadnienie: S,
  },
  required: ['kategoria', 'mechanizm_id', 'etap', 'pewnosc', 'uzasadnienie'],
}
const schemat = function (ids) {
  return {
    type: 'object',
    properties: {
      oceny: {
        type: 'array', minItems: ids.length, maxItems: ids.length,
        items: {
          type: 'object',
          properties: {
            id_przypadku: { type: 'string', enum: ids },
            kolumny: { type: 'object', properties: { P: KOLUMNA, Q: KOLUMNA, R: KOLUMNA, S: KOLUMNA }, required: ['P', 'Q', 'R', 'S'] },
          },
          required: ['id_przypadku', 'kolumny'],
        },
      },
      trudne: { type: 'array', items: { type: 'object', properties: { id_przypadku: S, powod: S }, required: ['id_przypadku', 'powod'] } },
    },
    required: ['oceny', 'trudne'],
  }
}

const ETYK = ['P', 'Q', 'R', 'S']
// katalog pod etykietą: neutralne id <etykieta><nr> (to samo co mapowanie w panel_run2_przygotuj.py)
const katalogPod = function (p, i) {
  return DANE.katalogi[p.kolejnosc[i]].map(function (m, n) {
    return { id: ETYK[i] + String(n + 1).padStart(2, '0'), typ: m.typ, rola: m.rola, etap: m.etap, warunek: m.warunek, brzmienie: m.brzmienie }
  })
}
const prompt = function (p) {
  const k = { P: katalogPod(p, 0), Q: katalogPod(p, 1), R: katalogPod(p, 2), S: katalogPod(p, 3) }
  return STALA +
    'PRZYPADKI (' + p.przypadki.length + '):\n' + JSON.stringify(p.przypadki) + '\n\n' +
    'KATALOG P:\n' + JSON.stringify(k.P) + '\n\n' +
    'KATALOG Q:\n' + JSON.stringify(k.Q) + '\n\n' +
    'KATALOG R:\n' + JSON.stringify(k.R) + '\n\n' +
    'KATALOG S:\n' + JSON.stringify(k.S) + '\n'
}

phase('Sędzia')
const wyniki = await parallel(DANE.porcje.map(function (p) {
  return function () {
    return agent(prompt(p), {
      label: 'sedzia:' + p.nazwa + ' (opus-5-5, high)', phase: 'Sędzia',
      schema: schemat(p.przypadki.map(function (x) { return x.id })),
      model: 'claude-opus-5-5', effort: 'high',
    })
  }
}))
const podsumowanie = {}
DANE.porcje.forEach(function (p, i) {
  const w = wyniki[i]
  podsumowanie[p.nazwa] = w ? { oceny: w.oceny.length, trudne: w.trudne.length } : null
})
return podsumowanie

export const meta = {
  name: 'test-review-wariant0-verify',
  description: 'Test review (§6): wycinek Verify z dev-docs-review-wf.js bez zmian na findingach dopasowanych przez sędziego',
  phases: [{ title: 'Verify', detail: 'P1 = 3 sceptyków (2/3), P2 = sceptyk na grupę z pliku' }],
}

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
AKCYJNOSC (ZAOSTRZONA — P3 IDA TERAZ DO NAPRAWY): P3 nie jest juz notatka na przyszlosc. Agent fixa
dostaje Twoj opis jako zlecenie i nie ma jak dopytac, wiec nit bez wykonalnej tresci to zmarnowana tura.
Zglaszasz P3 WYLACZNIE, gdy Twoj opis spelnia OBA warunki:
  (a) DOKLADNIE JEDEN plik z numerem linii w polu \`plik\` (format \`sciezka/plik.ts:123\`, nie "?",
      nie "kilka miejsc", nie sam katalog). P3 rozlany po wielu plikach to refaktor, nie nit — nie zglaszasz.
  (b) opis zawiera ZDANIE AKCJI: co zmienic i na co, na tyle konkretnie, ze da sie to zrobic bez pytan
      (np. "zamien \`as SessionRow\` na guard \`isSessionRow()\` z linii 12" — nie "poprawic typowanie").
"Warto by kiedys rozwazyc", "mozna by dodac wiecej testow", "nazwa moglaby byc lepsza", "rozwazyc refaktor",
"do przemyslenia w przyszlosci" — to NIE sa findingi. Nit bez akcji w jednym pliku to szum.
Nie dobijaj do piatki na sile: zero akcyjnych P3 => zero P3 w wyniku. Piec pustych nitow jest GORSZE
niz zero, bo teraz kosztuja ture agenta fixa.
=== KONIEC BLOKU LIMITU P3 ===`

// Doklejany do spec-compliance i test-coverage. Powod (run feedback-marcin-poprawki, 2026-08-06,
// repo mobile — klasa bledu w pelni przenosna): `price_pln` to koszt CALEGO turnieju, ale trzy miejsca
// w kodzie czytaly go jako kwote OD GRACZA — rejestr wplat pokazywal "zebrano 640 zl z 1280 zl"
// zamiast 80 z 160 (8x zawyzenie), a jeden ekran jednoczesnie "5,00 zl za osobe" i "40 zl od gracza".
// Unit testy byly ZIELONE, bo fixture'y powielaly to samo bledne zalozenie; zaden z 8 reviewerow tego
// nie zglosil, bo kod jest wewnetrznie spojny. Wylapal to dopiero E2E na realnych danych — najdrozsza
// mozliwa sciezka.
const BLOK_SEMANTYKA = `
=== SEMANTYKA I JEDNOSTKI POL (obowiazkowe, gdy faza tyka danych liczbowych/czasowych) ===
Kod wewnetrznie spojny moze byc jednolicie BLEDNY: jesli fixture i implementacja przyjmuja to samo zle
zalozenie o znaczeniu pola, testy przechodza, a produkt liczy zle.

PROCEDURA (wykonaj ja, nie streszczaj):
1. Wypisz pola liczbowe/czasowe dotkniete faza i dla KAZDEGO uruchom
   \`grep -rn "<nazwa_pola>" --include=*.ts --include=*.tsx --include=*.sql .\` — masz zobaczyc WSZYSTKIE
   uzycia, takze te spoza diffu. Bez tego kroku "sprawdz kazde uzycie" jest deklaracja, nie weryfikacja.
2. Ustal znaczenie U ZRODLA, w tej kolejnosci: komentarz/CHECK w migracji SQL -> spec albo IU w docs/plans/
   -> requirements doc. Gdy WSZYSTKIE trzy milcza (typowo goly \`numeric\` bez komentarza), NIE zgaduj
   z nazwy zmiennej — to jest dokladnie ten moment, w ktorym poprzednio poszlo zle. Zglos wtedy P2:
   "pole <X> nie ma zdefiniowanej semantyki w zadnym zrodle prawdy" + wskaz uzycia, ktore sie rozjezdzaja.
3. Gdy srodowisko E2E jest aktywne (istnieje .env.e2e): odczytaj JEDEN realny wiersz z bazy e2e i porownaj
   RZAD WIELKOSCI z wartoscia, ktora apka pokazuje uzytkownikowi. Rozjazd 8x widac natychmiast, a zaden
   przeglad kodu nie daje takiej pewnosci jak realna liczba.

Co sprawdzasz w kazdym uzyciu:
- kwoty: calosc vs per-osoba vs per-jednostke; grosze vs zlote; brutto vs netto,
- czas: sekundy vs milisekundy; UTC vs lokalny; timestamp vs data,
- indeksy i skale: miesiac 0- vs 1-based; procenty jako 0..1 vs 0..100; licznik vs suma,
- liczebnosci: liczba graczy vs liczba druzyn vs liczba miejsc.
Rozjazd miedzy dwoma uzyciami TEGO SAMEGO pola = P1 (KOD), nawet gdy testy sa zielone — zwlaszcza gdy
testy sa zielone, bo to znaczy, ze fixture tez jest skazony. Podaj oba miejsca i zrodlo prawdy.
Sygnal alarmowy: dwa rozne teksty w UI opisujace te sama wartosc ("za osobe" i "od gracza" obok siebie).
UWAGA: w opisanym runie WSZYSTKIE trzy miejsca czytaly pole jednakowo zle, wiec kanal "rozjazd miedzy
uzyciami" NIE zadzialal — zadzialaly dopiero sprzeczne teksty w UI i realna liczba z bazy. Nie opieraj sie
wylacznie na porownywaniu uzyc miedzy soba: jednomyslnosc kodu nie jest dowodem poprawnosci.
=== KONIEC BLOKU SEMANTYKI ===`

// Globalny limit P3 PO dedupie (port z mobile, 2026-08-08). BLOK_LIMIT_P3 dziala per reviewer, wiec przy
// 8 reviewerach (dzis 7 — patrz konsolidacja B12) agregat i tak dochodzil do 20-24 P3 na faze (run feedback-marcin-poprawki: 90 P3 na 5 faz
// przy 1 P1 i 17 P2 realnie naprawionych). P3 nie wchodza do petli naprawczej (otwartePoReview filtruje
// P1|P2), wiec ponad limit placimy juz tylko za prompt scribe'a i objetosc raportu.
// Prog PODNIESIONY 8 -> 15 (2026-09-03, plan B1). Osiem bylo progiem dla nitow, ktorych NIKT nie
// naprawial — otwartePoReview odcinalo P3 przed fixem, wiec ciecie kosztowalo tylko objetosc raportu.
// Od decyzji operatora P3 typu KOD/TEST wchodza do petli naprawczej, wiec ten sam limit zaczal
// wyrzucac PRACE DO ZROBIENIA, nie szum. 15 to prog wstepny; strojenie po telemetrii z kilku runow
// (przebieg.p3Odrzucone mowi, ile ucielismy, a fix.p3Pominiete — ile z przepuszczonych bylo realnych).
const LIMIT_P3_GLOBALNY = 15

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

const VERDICTS_BATCH = {
  type: 'object',
  additionalProperties: false,
  properties: {
    werdykty: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          indeks: { type: 'integer', description: 'numer findingu z ponumerowanej listy w prompcie' },
          realny: { type: 'boolean', description: 'czy finding jest prawdziwy po probie obalenia' },
          uzasadnienie: { type: 'string' },
          severityKorekta: { type: ['string', 'null'], enum: ['P1', 'P2', 'P3', null] },
        },
        required: ['indeks', 'realny', 'uzasadnienie'],
      },
    },
  },
  required: ['werdykty'],
}

const LIMIT_DIFFU_B = 300 * 1024

const ZNACZNIK_UCIECIA = '=== DIFF PRZYCIETY (limit 300 KB) — dalsza czesc zmian fazy NIE jest w tym pliku ==='

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
  // Dossier fazy (2026-09-03, plan B3). Ten sam wzorzec fail-open co przy diffie: gdy packager go nie
  // zbudowal albo Read padnie, blok znika / niesie instrukcje powrotu do pelnych dokumentow. Reviewer
  // nigdy nie zostaje bez zrodla prawdy o wymaganiach — zmieniamy DROGE do faktow, nie ich dostepnosc.
  const ctxBlok = kontekst.ctxZapisany && kontekst.ctxPlik
    ? `
=== DOSSIER FAZY (juz przygotowane) ===
Plik: ${kontekst.ctxPlik}
Zawiera sekcje planu technicznego dla TEJ fazy, przywolane wiersze "Sledzenie wymagan",
cale .claude/rules/learned-patterns.md oraz zadania i kontekst designerski fazy.
ZACZNIJ od jednego Read tego pliku. Pelny plan techniczny i dokument wymagan otwieraj WYLACZNIE wtedy,
gdy jednostka implementacyjna odsyla do czegos, czego w dossier NIE MA (np. decyzja z innej fazy,
wymaganie spoza przywolanych wierszy). Nie czytaj ich "dla kontekstu" — osiem osob czytajacych te same
70 KB to jest dokladnie ten koszt, ktory ten plik usuwa.
Gdy Read sie nie powiedzie albo plik bedzie pusty (np. /tmp wyczyszczone) — wroc do czytania pelnych
dokumentow dokladnie jak dotad: brak artefaktu NIE zwalnia Cie ze znajomosci wymagan fazy.`
    : ''
  // Pre-skan (plan B6): dwa wzorce, ktore JS widzi na pewno, podane reviewerom jako WSKAZOWKA, nie werdykt.
  // Klasyfikacja zostaje przy reviewerze — pusty catch w bloku, ktory za chwile i tak rzuca, bywa poprawny.
  const preSkan = Array.isArray(kontekst.preSkan) ? kontekst.preSkan : []
  const preSkanBlok = preSkan.length
    ? `
=== PRE-SKAN MECHANICZNY (grep po dodanych liniach, bez oceny) ===
${preSkan.map((t) => `- ${t.wzorzec}: ${t.plik}`).join('\n')}
To sa MIEJSCA, nie findingi. Obejrzyj kazde i sam zdecyduj, czy to defekt — pusty catch bywa swiadomy,
a \`.then\` bez \`.catch\` moze miec obsluge pietro wyzej. Brak wpisu na tej liscie NIE znaczy, ze pliku
nie trzeba sprawdzic: to uzupelnienie Twojego przegladu, nie jego zamiennik.`
    : ''
  return `

=== MAPA ZMIAN FAZY (wspolna, zbudowana raz) ===
${kontekst.diffStat || ''}
${lista}
${diffBlok}${ctxBlok}${preSkanBlok}
Uzyj jej jako punktu startu. Read tylko pliki istotne dla Twojego fokusu — pelna wiernosc, NIE polegaj wylacznie na mapie.`
}

const TIERY_DOMYSLNE = { packager: 'low', sceptykP2: 'medium', sceptykP1: null, reviewer: null }

const tiery = { ...TIERY_DOMYSLNE, ...((args && args.tiery) || {}) }

const zEffortem = (opts, effort) => (effort ? { ...opts, effort } : opts)

function kluczPliku(plik) {
  // "src/a.ts:214" i "src/a.ts:31" to ten sam plik — numer linii tu przeszkadza.
  return String(plik || '').split(':')[0].trim().toLowerCase()
}

const MAKS_W_GRUPIE_P2 = 4
// Ile razy sceptycy w ogole ruszaja severity: `przyjete` = korekta zgodnej wiekszosci (>=2 glosy),
// `odrzucone` = sugestia pojedynczego glosu, ktora poszla do opisu zamiast do severity. Drugi licznik
// mowi, ile P2 bylo o krok od przeklasyfikowania przez jeden glos — bez niego zmiana z A7 jest niewidoczna.
let severityKorektyPrzyjete = 0
let severityKorektyOdrzucone = 0

// Domkniecie werdyktow -> finding. JEDNO miejsce dla P1 i dla batchowanych P2, zeby regula z A7
// (pojedynczy glos nie rusza severity) nie rozjechala sie miedzy dwiema sciezkami.
function domknijWerdykty(f, glosy) {
  // 0 glosow (sceptyk padl albo nie zwrocil werdyktu dla tego indeksu) != konsensus — przepusc bez kill,
  // ale oznacz w opisie. Cicha zamiana na "obalony" gubilaby realne findingi na awarii infrastruktury.
  if (glosy.length === 0) {
    return { ...f, potwierdzony: true, opis: `[NIEZWERYFIKOWANY — 0 glosow sceptykow] ${f.opis}` }
  }
  // Uzasadnienia sceptykow zostaja przy findingu (pole wewnetrzne, jak _zrodlo) — potrzebne do sekcji
  // "Obalone przez verify" w raporcie (plan B11). Dane sa juz w pamieci procesu, koszt zerowy.
  const _uzasadnienie = glosy.map((v) => v.uzasadnienie).filter(Boolean).join(' | ')
  const realne = glosy.filter((v) => v.realny).length
  // potwierdzony gdy wiekszosc sceptykow NIE zdolala obalic
  const potwierdzony = realne >= Math.ceil(glosy.length / 2)
  // Korekta severity tylko gdy zgodna WIEKSZOSC glosujacych ja proponuje — pojedynczy glos
  // nie moze zdegradowac P1 (ominalby twardy STOP) ani awansowac P2.
  //
  // Przy JEDNYM glosie "wiekszosc" jest pojeciem pustym: `1 > 0.5` przepuszczalo korekte kazdego
  // pojedynczego sceptyka, a P2 ma z definicji dokladnie jednego — wiec regula z komentarza nie
  // obowiazywala dla ZADNEGO findingu waznego (audyt 2026-09-02, A7).
  // Teraz sugestia jednego glosu idzie do OPISU, gdzie widzi ja fix i czlowiek, a severity zostaje.
  const korekty = glosy.map((v) => v.severityKorekta).filter(Boolean)
  const zliczone = {}
  for (const k of korekty) zliczone[k] = (zliczone[k] || 0) + 1
  const [najczestsza, ileGlosow] = Object.entries(zliczone).sort((a, b) => b[1] - a[1])[0] || [null, 0]
  if (glosy.length === 1) {
    const sugestia = najczestsza && najczestsza !== f.severity
    if (sugestia) severityKorektyOdrzucone++
    return { ...f, potwierdzony, _uzasadnienie, opis: sugestia ? `${f.opis} [sceptyk sugeruje ${najczestsza}]` : f.opis }
  }
  const severity = ileGlosow > glosy.length / 2 ? najczestsza : f.severity
  if (severity !== f.severity) severityKorektyPrzyjete++
  return { ...f, potwierdzony, severity, _uzasadnienie }
}

// Grupowanie P2 po SCIEZCE pliku (bez numeru linii) w porcje po maks `maks`. Dwa findingi w tym samym
// pliku to jedno wejscie w plik dla sceptyka; porcja jest ograniczona, bo dlugie listy rozmywaja skepse.
function grupujPoPliku(lista, maks) {
  const poPliku = new Map()
  for (const f of lista) {
    const k = kluczPliku(f.plik)
    if (!poPliku.has(k)) poPliku.set(k, [])
    poPliku.get(k).push(f)
  }
  const grupy = []
  for (const wPliku of poPliku.values()) {
    for (let i = 0; i < wPliku.length; i += maks) grupy.push(wPliku.slice(i, i + maks))
  }
  return grupy
}


// wejście: args {sciezka, faza, kontekst (mapa packagera wariantu 0), findings (P1/P2 w kształcie dedupu wariantu 0)}
const sciezka = args.sciezka
const faza = args.faza
const kontekst = args.kontekst || null
const doWeryfikacji = args.findings || []
phase('Verify')
const p1DoVerify = doWeryfikacji.filter((f) => f.severity === 'P1')
const p2DoVerify = doWeryfikacji.filter((f) => f.severity !== 'P1')
const grupyP2 = grupujPoPliku(p2DoVerify, MAKS_W_GRUPIE_P2)

const skepsaBlok = `Domyslnie zakladaj ze finding jest NIEREALNY, chyba ze masz twardy dowod z kodu.

WYJATEK od domyslnej skepsy: argument "to kod jednorazowy / throwaway / skrypt migracyjny / usuwany pozniej"
NIE obala findingu i NIE uzasadnia severityKorekta w dol. Obalasz WYLACZNIE dowodem z kodu, ze wplyw nie zachodzi.${BLOK_ZAUFANIE}${mapaBlok(kontekst)}`

const p1Zweryfikowane = await parallel(
  p1DoVerify.map((f) => () =>
    parallel(
      Array.from({ length: 3 }, (_, i) => () =>
        agent(
          `Adwersaryjnie OBAL ten finding z review fazy ${faza} (${sciezka}). ${skepsaBlok}

Finding [${f.severity}/${f.typ}] ${f.plik}: ${f.opis}
Sprawdz kod. Czy to prawdziwy problem czy false positive? Zwroc werdykt.`,
          zEffortem({ schema: VERDICT, label: `verify:${f.plik}:${i}`, phase: 'Verify' }, tiery.sceptykP1)
        )
      )
    ).then((werdykty) => domknijWerdykty(f, werdykty.filter(Boolean)))
  )
)

const p2Wyniki = await parallel(
  grupyP2.map((grupa) => () => {
    const lista = grupa.map((f, i) => `${i}. [${f.severity}/${f.typ}] ${f.plik} — ${f.opis}`).join('\n')
    return agent(
      `Adwersaryjnie OBAL ponizsze findingi z review fazy ${faza} (${sciezka}). Wszystkie dotycza tego samego
pliku, wiec kod otwierasz RAZ — ale oceniasz je OSOBNO. ${skepsaBlok}

OSOBNO ZNACZY OSOBNO: brak dowodu przeciw jednemu findingowi NIE obala pozostalych, a obalenie jednego
NIE jest argumentem przeciw kolejnym. Nie szukaj "wspolnego mianownika" i nie oceniaj listy jako calosci.

${lista}

Dla KAZDEGO indeksu z listy zwroc osobny werdykt w werdykty[] z polem \`indeks\` rownym numerowi z listy.
Gdy dla ktoregos indeksu nie potrafisz rozstrzygnac — POMIN go zamiast zgadywac; pominiety indeks zostanie
oznaczony jako niezweryfikowany, a zgadniety werdykt cicho zabilby albo przepuscil realny finding.`,
      zEffortem({ schema: VERDICTS_BATCH, label: `verify-batch:${kluczPliku(grupa[0].plik)}:${grupa.length}`, phase: 'Verify' }, tiery.sceptykP2)
    ).then((wynik) => {
      const werdykty = (wynik && Array.isArray(wynik.werdykty)) ? wynik.werdykty : []
      return grupa.map((f, i) => {
        const w = werdykty.find((v) => v && v.indeks === i)
        return domknijWerdykty(f, w ? [w] : [])
      })
    })
  })
)
// Grupa, ktorej thunk rzucil (null), NIE moze wyparowac razem ze swoimi findingami — schodzi do
// "niezweryfikowany", dokladnie jak pojedynczy sceptyk, ktory padl.
const p2Zweryfikowane = p2Wyniki.flatMap((wynikGrupy, i) =>
  Array.isArray(wynikGrupy) ? wynikGrupy : grupyP2[i].map((f) => domknijWerdykty(f, []))
)
if (grupyP2.length) {
  log(`Verify P2: ${p2DoVerify.length} findingow w ${grupyP2.length} grupach po pliku (maks ${MAKS_W_GRUPIE_P2} na grupe), tier ${tiery.sceptykP2 || 'sesji'}`)
}
const zweryfikowane = [...p1Zweryfikowane, ...p2Zweryfikowane]

return { projekt: '0', decyzje: zweryfikowane.filter(Boolean).map((f) => ({ plik: f.plik, opis: f.opis, severity: f.severity, zabity: !f.potwierdzony, uzasadnienie: f._uzasadnienie || '' })) }

export const meta = {
  name: 'test-review-p9-verify',
  description: 'Kill rate P9: wycinek Verify z dev-docs-review-wf.js (sceptyk asymetryczny) na findingach dopasowanych przez sędziego',
  phases: [{ title: 'Verify', detail: 'P1 = 3 sceptyków (2/3 dowodem), P2 = porcje po 4' }],
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
// Powod (telemetria 5 zadan / 16 faz): P1=2, P2=29, P3=179 — P3 to 85% calego outputu review. Za kazdy P3 placimy
// generacja u kilku reviewerow, dedupem semantycznym i promptem scribe'a. Od P8 P3 nie ida do fixa — scribe zapisuje je
// w known-issues, skad trafiaja do opisu PR i bota. Limit dotyczy WYLACZNIE P3: przemilczany P1 to katastrofa.
const BLOK_LIMIT_P3 = `
=== LIMIT I AKCYJNOSC P3 (nity) ===
LIMIT: zglos MAKSYMALNIE 5 findingow P3. Widzisz wiecej — wybierz 5 najwartosciowszych, reszty NIE zglaszaj.
Limit dotyczy TYLKO severity P3. P1 i P2 NIE sa limitowane: zglos kazdy, choc bys mial ich dwadziescia.
Findingi typu OPERATOR (warunek srodowiskowy, nie defekt) sa poza limitem — nie licz ich do piatki.
AKCYJNOSC: P3 laduje w known-issues zadania i w opisie PR. Czyta go operator albo bot bez kontekstu tego review,
wiec nit bez wykonalnej tresci zostaje martwym wpisem. P3 zglaszasz wtedy, gdy Twoj opis spelnia oba warunki:
  (a) DOKLADNIE JEDEN plik z numerem linii w polu \`plik\` (format \`sciezka/plik.ts:123\`, nie "?",
      nie "kilka miejsc", nie sam katalog). P3 rozlany po wielu plikach to refaktor, nie nit — nie zglaszasz.
  (b) opis zawiera ZDANIE AKCJI: co zmienic i na co, na tyle konkretnie, ze da sie to zrobic bez pytan
      (np. "zamien \`as SessionRow\` na guard \`isSessionRow()\` z linii 12" — nie "poprawic typowanie").
"Warto by kiedys rozwazyc", "mozna by dodac wiecej testow", "nazwa moglaby byc lepsza", "rozwazyc refaktor",
"do przemyslenia w przyszlosci" — to NIE sa findingi. Nit bez akcji w jednym pliku to szum.
Nie dobijaj do piatki na sile: zero akcyjnych P3 => zero P3 w wyniku. Piec pustych nitow jest GORSZE niz zero.
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
   z nazwy zmiennej — nazwa typu \`price\` nie mowi, czy to kwota za calosc, czy za osobe. Zglos wtedy P2:
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
UWAGA: gdy WSZYSTKIE uzycia czytaja pole jednakowo zle, porownanie uzyc miedzy soba niczego nie pokaze —
wtedy zdradzaja je dopiero sprzeczne teksty w UI i realna liczba z bazy. Jednomyslnosc kodu nie jest
dowodem poprawnosci.
=== KONIEC BLOKU SEMANTYKI ===`

// Globalny limit P3 PO dedupie (port z mobile, 2026-08-08). BLOK_LIMIT_P3 dziala per reviewer, wiec agregat i tak
// dochodzil do 20-24 P3 na faze (run feedback-marcin-poprawki: 90 P3 na 5 faz). Od P8 P3 nie ida do fixa, wiec 15
// to sufit raportu i known-issues; strojenie po telemetrii (przebieg.p3Odrzucone mowi, ile ucielismy).
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

const ETYKIETA_SCEPTYKA = {
  type: 'string',
  enum: ['AGREE', 'DISAGREE_EVIDENCE', 'DISAGREE_CONCERN'],
  description: 'AGREE = kod potwierdza teze; DISAGREE_EVIDENCE = linia kodu albo test przeczy tezie; DISAGREE_CONCERN = watpliwosc bez takiego dowodu',
}

const DOWOD_SCEPTYKA = { type: 'string', description: 'DISAGREE_EVIDENCE: plik:linia albo test, ktory przeczy tezie; pozostale etykiety: ""' }

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    etykieta: ETYKIETA_SCEPTYKA,
    dowod: DOWOD_SCEPTYKA,
    uzasadnienie: { type: 'string' },
  },
  required: ['etykieta', 'dowod', 'uzasadnienie'],
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
          indeks: { type: 'integer', description: 'numer zarzutu z ponumerowanej listy w prompcie' },
          etykieta: ETYKIETA_SCEPTYKA,
          dowod: DOWOD_SCEPTYKA,
          uzasadnienie: { type: 'string' },
        },
        required: ['indeks', 'etykieta', 'dowod', 'uzasadnienie'],
      },
    },
  },
  required: ['werdykty'],
}

function mapaBlok(kontekst) {
  if (!kontekst || !kontekst.pliki || !kontekst.pliki.length) return ''
  const lista = kontekst.pliki.map((p) => `- ${p.plik} — ${p.czegoDotyczy}`).join('\n')
  const diffBlok = kontekst.diffZapisany && kontekst.diffPlik
    ? `
=== PELNY DIFF FAZY (juz przygotowany) ===
Plik: ${kontekst.diffPlik}
ZACZNIJ od jednego Read tego pliku — to ten sam diff, ktory inaczej generowalbys sam. NIE odpalaj wlasnego \`git diff\` calej fazy.${kontekst.diffUciety ? `
UWAGA: ten zrzut jest PRZYCIETY (limit 300 KB, znacznik uciecia na koncu pliku) — NIE jest pelnym obrazem zmian.
Pliki z listy powyzej, ktorych w zrzucie nie ma, dobierz osobno (Read pliku albo \`git diff -- <plik>\`).` : ''}
Gdy Read tego pliku sie nie powiedzie albo plik okaze sie pusty (np. /tmp wyczyszczone) — zrob wlasny \`git diff\` fazy: brak artefaktu NIE zwalnia Cie z obejrzenia pelnego diffu.`
    : ''
  // Dossier fazy. Ten sam wzorzec fail-open co przy diffie: gdy go nie ma albo Read padnie, blok znika / niesie
  // instrukcje powrotu do pelnych dokumentow — zmieniamy DROGE do faktow, nie ich dostepnosc.
  const ctxBlok = kontekst.ctxZapisany && kontekst.ctxPlik
    ? `
=== DOSSIER FAZY (juz przygotowane) ===
Plik: ${kontekst.ctxPlik}
Zawiera: zmiany fazy, profil stacku, sygnaly diffu, wynik bramek domkniecia (ostrzezenia ESLint, knip,
przezyte mutanty), sekcje planu technicznego TEJ fazy, przywolane wiersze "Sledzenie wymagan",
cale .claude/rules/learned-patterns.md, zadania fazy i kontekst designerski.
ZACZNIJ od jednego Read tego pliku. Pelny plan techniczny i dokument wymagan otwieraj WYLACZNIE wtedy,
gdy jednostka implementacyjna odsyla do czegos, czego w dossier NIE MA (np. decyzja z innej fazy,
wymaganie spoza przywolanych wierszy). Nie czytaj ich "dla kontekstu" — osiem osob czytajacych te same
70 KB to jest dokladnie ten koszt, ktory ten plik usuwa.
Gdy Read sie nie powiedzie albo plik bedzie pusty (np. /tmp wyczyszczone) — przeczytaj pelne dokumenty
(plan techniczny fazy, requirements doc, learned-patterns.md): brak artefaktu NIE zwalnia Cie ze znajomosci wymagan fazy.`
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

const TIERY_DOMYSLNE = { sceptykP2: 'medium', sceptykP1: 'high', reviewer: 'high', scribe: 'low' }

const tiery = { ...TIERY_DOMYSLNE, ...((args && args.tiery) || {}) }

const zEffortem = (opts, effort) => (effort ? { ...opts, effort } : opts)

function kluczPliku(plik) {
  // "src/a.ts:214" i "src/a.ts:31" to ten sam plik — numer linii tu przeszkadza.
  return String(plik || '').split(':')[0].trim().toLowerCase()
}

const MAKS_W_GRUPIE_P2 = 4
// Sceptyk asymetryczny (P9): glos to etykieta. Liczniki: etykiety = glosy (po regule dowodu), degradacje = findingi.
// Ida do przebiegu -> stan -> telemetria `faza.sceptyk` (progi P9: obalenia < 5%, degradacje > 35%).
const sceptykLiczniki = { agree: 0, disagree_evidence: 0, disagree_concern: 0, degradacje: 0 }
const NIZSZA_WAGA = { P1: 'P2', P2: 'P3' }

// Obala tylko dowod: DISAGREE_EVIDENCE bez linii kodu albo testu w `dowod` jest watpliwoscia (CONCERN).
function etykietaGlosu(v) {
  if (v.etykieta === 'DISAGREE_EVIDENCE' && !String(v.dowod || '').trim()) return 'DISAGREE_CONCERN'
  return v.etykieta
}

// Domkniecie werdyktow -> finding. JEDNO miejsce dla P1 (3 glosy) i porcji P2 (1 glos).
// Wiekszosc = wiecej niz polowa glosujacych: 1 z 1, 2 z 2, 2 z 3. Wiekszosc DISAGREE_EVIDENCE kasuje; wiekszosc
// sprzeciwu bez wiekszosci dowodow obniza wage o jeden stopien (P1 -> P2, P2 -> P3 do known-issues), nie kasuje.
// Pojedynczy glos nie rusza P1 (ominalby twardy STOP).
function domknijWerdykty(f, glosy) {
  // 0 glosow (sceptyk padl albo nie zwrocil werdyktu dla tego indeksu) != konsensus — przepusc bez kill,
  // ale oznacz w opisie. Cicha zamiana na "obalony" gubilaby realne findingi na awarii infrastruktury.
  if (glosy.length === 0) {
    return { ...f, potwierdzony: true, opis: `[NIEZWERYFIKOWANY — 0 glosow sceptykow] ${f.opis}` }
  }
  const etykiety = glosy.map(etykietaGlosu)
  for (const e of etykiety) sceptykLiczniki[e.toLowerCase()]++
  // Uzasadnienia i dowody zostaja przy findingu (pole wewnetrzne, jak _zrodlo) — sekcja "Obalone przez verify" (plan B11).
  const _uzasadnienie = glosy.map((v) => [v.uzasadnienie, v.dowod && `dowod: ${v.dowod}`].filter(Boolean).join(' — ')).filter(Boolean).join(' | ')
  const wiekszosc = Math.floor(glosy.length / 2) + 1
  const dowody = etykiety.filter((e) => e === 'DISAGREE_EVIDENCE').length
  const sprzeciwy = etykiety.filter((e) => e !== 'AGREE').length
  if (dowody >= wiekszosc) return { ...f, potwierdzony: false, _uzasadnienie }
  const nizsza = NIZSZA_WAGA[f.severity]
  if (sprzeciwy < wiekszosc || !nizsza) return { ...f, potwierdzony: true, _uzasadnienie }
  sceptykLiczniki.degradacje++
  const opis = `${f.opis} [sceptyk: ${f.severity} → ${nizsza}, sprzeciw bez dowodu obalenia]`
  return { ...f, potwierdzony: true, severity: nizsza, _uzasadnienie, opis }
}

// Porcje P2 po `maks` niezaleznie od pliku (P9, D2): grupa po pliku dawala 80% grup jednoelementowych, wiec ~1 agent
// na finding. Sortowanie po pliku (stabilne) zostawia findingi z jednego pliku obok siebie — sceptyk otwiera go raz.
// Porcja jest ograniczona, bo dlugie listy rozmywaja skepse.
function porcjujP2(lista, maks) {
  const poPliku = [...lista].sort((a, b) => kluczPliku(a.plik).localeCompare(kluczPliku(b.plik)))
  const porcje = []
  for (let i = 0; i < poPliku.length; i += maks) porcje.push(poPliku.slice(i, i + maks))
  return porcje
}


// wejście: args {sciezka, faza, kontekst (mapa packagera wariantu 0 bez zrzutów /tmp), findings (P1/P2 w kształcie dedupu wariantu 0)}
// sesja uruchamiajaca bywa, ze poda args jako tekst JSON (2 z 14 faz w pierwszym przebiegu) — wtedy findings byly puste
const wejscie = typeof args === 'string' ? JSON.parse(args) : args
const sciezka = wejscie.sciezka
const faza = wejscie.faza
const kontekst = wejscie.kontekst || null
const doWeryfikacji = wejscie.findings || []
if (!doWeryfikacji.length) throw new Error('kill rate P9: brak findingow w args')
phase('Verify')
const p1DoVerify = doWeryfikacji.filter((f) => f.severity === 'P1')
const p2DoVerify = doWeryfikacji.filter((f) => f.severity !== 'P1')
const grupyP2 = porcjujP2(p2DoVerify, MAKS_W_GRUPIE_P2)

// Sceptyk dostaje sam zarzut: waga, plik:linia i teza. Autor (_zrodlo), os i typ zostaja w JS — literatura
// (ETAP2 §1): sceptyk bez uzasadnienia autora obala ~4x skuteczniej; test review: B (asymetryczny) 0 zabitych prawdziwych.
function zarzutSceptyka(f) {
  return `[${f.severity}] ${f.plik} — ${f.opis}`
}

const skepsaBlok = `Dostajesz sam zarzut (waga, plik:linia, teza) bez uzasadnienia autora; autor jest celowo ukryty, teze sprawdzasz w kodzie.
Odpowiadasz jedna etykieta:
- AGREE — kod potwierdza teze;
- DISAGREE_EVIDENCE — w polu \`dowod\` wskazujesz linie kodu (plik:linia) albo test, ktory przeczy tezie; tylko ta etykieta usuwa zarzut;
- DISAGREE_CONCERN — masz watpliwosc bez takiej linii albo testu; zarzut zostaje z waga nizsza o stopien.
Bez wskazanej linii albo testu wybierasz DISAGREE_CONCERN, bo usuwa tylko dowod.
Argument "kod jednorazowy / usuwany pozniej" nie przeczy tezie i nie jest powodem do DISAGREE_CONCERN (granice zaufania nizej).${BLOK_ZAUFANIE}${mapaBlok(kontekst)}`

const p1Zweryfikowane = await parallel(
  p1DoVerify.map((f) => () =>
    parallel(
      Array.from({ length: 3 }, (_, i) => () =>
        agent(
          `Sprawdz zarzut z review fazy ${faza} (${sciezka}). ${skepsaBlok}

Zarzut: ${zarzutSceptyka(f)}
Sprawdz kod i zwroc werdykt.`,
          zEffortem({ schema: VERDICT, label: `verify:${f.plik}:${i}`, phase: 'Verify' }, tiery.sceptykP1)
        )
      )
    ).then((werdykty) => domknijWerdykty(f, werdykty.filter(Boolean)))
  )
)

const p2Wyniki = await parallel(
  grupyP2.map((grupa, n) => () => {
    const lista = grupa.map((f, i) => `${i}. ${zarzutSceptyka(f)}`).join('\n')
    return agent(
      `Sprawdz zarzuty z review fazy ${faza} (${sciezka}); kazdy oceniasz osobno. ${skepsaBlok}

Ocena jednego zarzutu nie jest argumentem za ani przeciw pozostalym; nie szukaj wspolnego mianownika listy.

${lista}

Dla kazdego indeksu z listy zwroc osobny werdykt w werdykty[] z polem \`indeks\` rownym numerowi z listy.
Indeks, ktorego nie potrafisz rozstrzygnac, pomin: zostanie oznaczony jako niezweryfikowany, a zgadniety werdykt cicho zabilby albo przepuscil prawdziwy zarzut.`,
      zEffortem({ schema: VERDICTS_BATCH, label: `verify-batch:${n}:${grupa.length}`, phase: 'Verify' }, tiery.sceptykP2)
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
  log(`Verify P2: ${p2DoVerify.length} findingow w ${grupyP2.length} porcjach (maks ${MAKS_W_GRUPIE_P2}), tier ${tiery.sceptykP2 || 'sesji'}`)
}
const zweryfikowane = [...p1Zweryfikowane, ...p2Zweryfikowane]

return { projekt: 'P9', liczniki: sceptykLiczniki, decyzje: zweryfikowane.filter(Boolean).map((f) => ({ plik: f.plik, opis: f.opis, severity: f.severity, zabity: !f.potwierdzony, uzasadnienie: f._uzasadnienie || '' })) }

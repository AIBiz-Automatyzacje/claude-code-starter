export const meta = {
  name: 'dev-docs-review-wf',
  description: 'Code review fazy: context-packager (mapa zmian + flagi warstw raz) -> routing v2 domenowy (rdzen security/spec/simplicity/test zawsze; perf/architektura/typescript/E2E tylko gdy ich domena jest w fazie obecna; fail-open bez flag) -> do 8 reviewerow rownolegle (tester E2E zwraca przebiegi[] per checkbox [E2E]) -> dedup 2-przebiegowy (JS + semantyczny haiku) -> detekcja blokera srodowiska po sygnaturze (JS) + globalny limit P3 po dedupie (round-robin po zrodle) -> adversarial verify P1/P2 (P1=3 niezaleznych sceptykow z konsensusem 2/3; P2 batchowane po pliku, jeden sceptyk na grupe do 4 findingow; findingi E2E testera i OPERATOR poza verify) -> scribe zapisuje raport + sekcje "Przebieg review" + bookkeeping checkboxow Weryfikacja:/Test: [E2E] (odznaczanie WYLACZNIE z wpisu PASS) -> severity gate. Zwraca przebieg (metryki routingu/dedupu/verify) dla telemetrii oraz blokerSrodowiska i e2eTesterFail dla orkiestratora.',
  whenToUse: 'Review jednej fazy. Wolany przez dev-autopilot lub standalone z args {sciezka, faza}.',
  phases: [
    { title: 'Review', detail: 'context-packager + reviewerzy rownolegle wg routingu domenowego (do 8, w tym spec-compliance i simplicity/YAGNI)' },
    { title: 'Verify', detail: 'adversarial verify: P1 = 3 sceptykow (2/3), P2 = jeden sceptyk na grupe findingow z tego samego pliku' },
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
// 8 reviewerach agregat i tak dochodzil do 20-24 P3 na faze (run feedback-marcin-poprawki: 90 P3 na 5 faz
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

// Tester E2E zwraca JAWNY przebieg per checkbox. Powod (review adwersaryjny 2026-08-23, P1, port z mobile):
// wczesniej jedynym sygnalem PASS dla scribe'a byl BRAK findingu — a brak findingu daje tez tester zabity
// przez watchdoga (null) albo flow pominiety po cichu. Scribe odznaczal wtedy [E2E] jako PASS bez zadnego
// przebiegu w przegladarce (falszywa zielen, ktorej completion-gate juz nie lapie, bo widzi [x]).
const E2E_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: FINDINGS.properties.findings,
    przebiegi: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          checkbox: { type: 'string', description: 'tresc wiersza checkboxa [E2E] z *-zadania.md skopiowana 1:1 (bez "- [ ] ", lacznie z ewentualnym suffixem "(SKIP — …)"/"(FAIL: …)")' },
          flow: { type: 'string', description: 'kebab-case IDENTYFIKATOR flow z linii [E2E] (pierwszy backtick w linii; dla runnera — sciezka e2e/<etap>-run-all.sh) — KLUCZ dopasowania dla scribe (tresc checkboxa moze sie roznic suffixami); "" TYLKO gdy linia nie ma zadnego backticka (starszy format — wtedy scribe dopasowuje po znormalizowanej tresci). W webie flow nie ma osobnego pliku: agent-browser gra scenariusz z opisu linii' },
          wynik: { type: 'string', enum: ['PASS', 'FAIL', 'SKIP'] },
          dowod: { type: 'string', description: 'PASS/FAIL: co zaasertowano/gdzie padlo + sciezka screenshotu (lub exit code runnera); SKIP: dokladny powod (bloker srodowiskowy)' },
        },
        required: ['checkbox', 'flow', 'wynik', 'dowod'],
      },
      description: 'KAZDY policzony checkbox [E2E] fazy MUSI miec wpis — brak wpisu scribe traktuje jak SKIP',
    },
  },
  required: ['findings', 'przebiegi'],
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

// Werdykty grupowe dla P2 (plan B4). Jeden sceptyk ocenia do MAKS_W_GRUPIE_P2 findingow z tego samego
// pliku, ale KAZDY osobno. `indeks` wiaze werdykt z pozycja listy w prompcie; brak wpisu dla indeksu
// jest DOZWOLONY i znaczy "nie rozstrzygniete" — obslugujemy go jak zero glosow, nigdy jak obalenie.
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
    e2eCheckboxy: { type: 'integer', description: 'liczba NIEZAZNACZONYCH checkboxow [E2E] tej fazy (prefiksy Test: ORAZ Weryfikacja:) wymagajacych przegladarki/agent-browser (0 gdy brak)' },
    // Druga, niezalezna od checkboxow praca testera: visual diff z makietami (feature-tester-e2e §3.5).
    // Poza `required` — starszy packager jej nie zwroci i routing wraca wtedy do fail-open po `warstwy.ui`.
    figmaScreens: { type: 'boolean', description: 'czy plik kontekstu zadania ma niepuste pole figma_screens (mapa ekran -> mockup) — tester robi wtedy visual diff nawet bez checkboxow [E2E]' },
    // Metadane artefaktu z diffem — NIGDY tresc diffu (patrz komentarz przy LIMIT_DIFFU_B).
    // Poza `required`: gdy packager ich nie zwroci, mapa dziala jak dotad (fail-open), zamiast
    // wywalic caly obiekt kontekstu na walidacji schematu i stracic rowniez flagi routingu.
    diffPlik: { type: 'string', description: 'sciezka zrzutu diffu fazy (pusty string gdy zrzut sie nie udal)' },
    // Dossier fazy (2026-09-03, plan B3) — drugi artefakt packagera obok zrzutu diffu. Poza `required`
    // z tego samego powodu co diffPlik: nieudany zapis ma degradowac do starej sciezki (kazdy czyta pelne
    // dokumenty sam), a nie wywalac calego obiektu kontekstu na walidacji schematu i gubic flagi routingu.
    ctxPlik: { type: 'string', description: 'sciezka dossier fazy (pusty string gdy zapis sie nie udal)' },
    ctxZapisany: { type: 'boolean', description: 'true tylko gdy dossier realnie powstalo i jest niepuste' },
    // Wsparcie deterministyczne dla reviewerow (plan B6): dwa wzorce, ktore packager i tak widzi w diffie,
    // a ktore reviewer potrafi przeoczyc, bo kod wyglada poprawnie. Poza `required` — brak pola = brak bloku.
    preSkan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          wzorzec: { type: 'string', enum: ['pusty-catch', 'then-bez-catch'] },
          plik: { type: 'string', description: 'plik:linia' },
        },
        required: ['wzorzec', 'plik'],
      },
      description: 'mechaniczne trafienia w DODANYCH liniach diffu fazy (pusty catch, .then bez .catch w tym samym pliku)',
    },
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
  // semantyka:true -> dostaje BLOK_SEMANTYKA. Tylko spec-compliance, bo tylko on ma ZRODLO PRAWDY
  // (spec/IU) jako punkt odniesienia; pozostali dostaja procedure posrednio przez test-coverage.
  { key: 'spec-compliance', semantyka: true, agentType: 'spec-flow-analyzer', fokus: 'zgodnosc implementacji ze spec/planem IU: (a) wymagania ze spec/IU BRAKUJACE lub czesciowo zaimplementowane (under-implementation), (b) zachowanie w diffie o ktore nikt nie prosil (scope creep / over-implementation), (c) wymagania pozornie zaimplementowane ale BLEDNIE. Cytuj linie spec/IU (ID wymagania lub nazwa IU). Jesli brak spec ani planu — zwroc pusta liste findingow' },
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

function kontekstPrompt(sciezka, faza, diffPlik, ctxPlik) {
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
5. Policz \`e2eCheckboxy\`: niezaznaczone checkboxy \`[E2E]\` fazy ${faza} w ${sciezka}/*-zadania.md — z OBU prefiksow
   (\`Test: [E2E] ...\` ORAZ \`Weryfikacja: [E2E] ...\`; grep \`^- \\[ \\].*\\[E2E\\]\` z wykluczeniem kopii \`Operator:\` i pozycji findingow \`[P1]/[P2]/[P3]\` z "Do poprawy"). To scenariusze wymagajace
   przegladarki (agent-browser). CLI (\`test\`/\`typecheck\`/\`grep\`) i \`[Manual]\` nie licz.
6. Ustal \`figmaScreens\`: w ${sciezka}/*-kontekst.md, sekcja "Designerski kontekst", pole \`figma_screens\`.
   true tylko wtedy, gdy pole istnieje i ma co najmniej jeden wpis ekran -> sciezka mockupu; puste/null/brak = false.
   To DRUGA praca testera obok checkboxow: visual diff z makietami odpala sie z tego pola, nie z checkboxa,
   wiec bez tej flagi faza z makietami a bez \`[E2E]\` stracilaby porownanie z mockupem.
7. ZBUDUJ DOSSIER FAZY -> ${ctxPlik}. To najwiekszy pojedynczy oszczednik w tym workflow: dotad KAZDY
   z osmiu reviewerow czytal dokument wymagan (dziesiatki KB), caly plan techniczny i learned-patterns.md.
   Ty i tak czytasz te zrodla, wiec przepisz z nich RAZ wylacznie to, co dotyczy fazy ${faza}.
   Wycinaj \`grep -n\` na naglowku + \`Read\` z offsetem i limitem — nigdy nie czytaj calych plikow do odpowiedzi.
   Sklad pliku, dokladnie te cztery sekcje i w tej kolejnosci:

   \`\`\`
   # Dossier fazy ${faza} — ${sciezka}

   ## Plan techniczny — sekcja fazy
   [sekcja \`### Faza ${faza}\` z planu technicznego (sciezka z "Zrodla" w ${sciezka}/*-plan.md),
    ciecie od tego naglowka do nastepnego naglowka tego samego poziomu, w calosci i bez parafrazy]

   ## Sledzenie wymagan — wiersze tej fazy
   [wylacznie te wiersze tabeli "Sledzenie wymagan" z planu technicznego, ktorych ID przywoluja
    jednostki implementacyjne tej fazy; naglowek tabeli zostaw, reszte wierszy pomin]

   ## Reguly projektu (learned-patterns.md)
   [.claude/rules/learned-patterns.md w CALOSCI, bez skracania; gdy pliku nie ma — "Brak pliku."]

   ## Zadania i kontekst designerski fazy
   [sekcja \`## Faza ${faza}\` z ${sciezka}/*-zadania.md w calosci (checkboxy razem z prefiksami)
    + pole \`figma_screens\` z sekcji "Designerski kontekst" w ${sciezka}/*-kontekst.md]
   \`\`\`

   Tresc przepisuj DOSLOWNIE — to ma zastapic czytanie zrodel, wiec parafraza albo skrot cicho odbiera
   reviewerom fakty. Zwroc ctxPlik (sciezka albo "" gdy zapis sie nie udal) i ctxZapisany (plik powstal
   i jest niepusty). Nieudany zapis NIE jest bledem krytycznym: ustaw ctxZapisany=false i lec dalej —
   reviewerzy wroca wtedy do czytania pelnych dokumentow.
8. PRE-SKAN MECHANICZNY (grep, nie ocena). W liniach DODANYCH przez diff tej fazy znajdz dwa wzorce:
   - \`pusty-catch\`: \`catch {}\` albo \`catch (e) {}\` — takze z bialymi znakami i nowa linia miedzy klamrami,
   - \`then-bez-catch\`: plik, w ktorym pojawilo sie \`.then(\`, a w CALYM tym pliku nie ma ani jednego \`.catch(\`.
   Zwroc liste {wzorzec, plik} z numerem linii w polu plik. Zero trafien to poprawny wynik ([]).
   NIE oceniaj, czy to defekt — od tego sa reviewerzy; Ty tylko wskazujesz miejsca.
Nie oceniaj jakosci, nie zglaszaj findingow. Zwroc obiekt {diffStat, pliki[], warstwy{}, e2eCheckboxy, figmaScreens, diffPlik, diffZapisany, diffUciety, ctxPlik, ctxZapisany, preSkan}.`
}

// Zrodla wymagan podawane reviewerowi. Gdy packager zbudowal dossier (plan B3), lektura zaczyna sie
// i zwykle konczy na nim; bez dossier wracamy do brzmienia sprzed zmiany, czyli kazdy czyta pelne dokumenty.
function zrodlaBlok(faza, kontekst) {
  return (kontekst && kontekst.ctxZapisany && kontekst.ctxPlik)
    ? `Wymagania, reguly projektu i zadania tej fazy masz w DOSSIER FAZY (sciezka nizej) — zacznij od niego.
Pelny plan techniczny i requirements doc otwieraj tylko wtedy, gdy jednostka odsyla do czegos, czego w dossier nie ma.
Naruszenie ktorejkolwiek reguly z sekcji "Reguly projektu" dossier zglos jako finding.`
    : `Przeczytaj zmiany git tej fazy (diff) + requirements doc (docs/brainstorms/*-requirements.md jesli istnieje) + plan techniczny / Implementation Unit fazy ${faza} w docs/plans/ (Files:, Test scenarios:, Patterns to follow:).
Przeczytaj tez .claude/rules/learned-patterns.md (jesli istnieje) — reguly z poprzednich zadan tego projektu; naruszenie ktorejkolwiek z nich zglos jako finding.`
}

function reviewerPrompt(sciezka, faza, fokus, poprzednie, kontekst, semantyka) {
  return `Jestes reviewerem fazy ${faza} w folderze ${sciezka}.
${zrodlaBlok(faza, kontekst)}
Skup sie na: ${fokus}.
Sklasyfikuj kazdy finding: P1 (blocking), P2 (important), P3 (nit) oraz typ: KOD / TEST / E2E / OPERATOR.
Zwroc obiekt {findings:[...]} zgodny ze schematem. Sam nie zapisuj plikow.
${BLOK_ZAUFANIE}${semantyka ? BLOK_SEMANTYKA : ''}${BLOK_LIMIT_P3}${mapaBlok(kontekst)}${rereviewBlok(poprzednie)}`
}

function testCoveragePrompt(sciezka, faza, poprzednie, kontekst) {
  return `Jestes testerem scenariuszy/coverage dla fazy ${faza} w ${sciezka}.
${zrodlaBlok(faza, kontekst)}
Sprawdz: happy path, invalid inputs, boundary conditions, concurrent operations, scale.
Test coverage: czy plan techniczny definiowal scenariusze testowe dla tej fazy (sekcja "Plan techniczny"
dossier, a bez dossier — docs/plans/) i czy pliki testowe istnieja oraz maja asercje? Brakujace testy = P2 (typ TEST).
Zwroc {findings:[...]} (severity P1/P2/P3, typ KOD/TEST/E2E/OPERATOR). Nie zapisuj plikow.
${BLOK_DLUGIE_KOMENDY}${BLOK_SEMANTYKA}${BLOK_LIMIT_P3}${mapaBlok(kontekst)}${rereviewBlok(poprzednie)}`
}

// Blok trybu `bez-przegladarki` — doklejany, gdy orkiestrator zglosil, ze srodowiska E2E NIE MA.
// Obserwacja (run rownolegle-joby, faza 1, 2026-07-30): routing przywolal testera (ui=true + 1 browserowy
// checkbox), ale srodowiska nie bylo (e2eSrodowisko: "pominieto", brak .env.e2e) — tester i tak poszedl
// w przegladarke i skonczylo sie na 1 passed / 1 failed / 3 skipped. Nie wycinamy go, bo ten JEDEN fail
// byl realny i wykryty na poziomie HTTP; odbieramy mu tylko przegladarke, ktorej nie ma.
const BLOK_BEZ_PRZEGLADARKI = `
TRYB BEZ PRZEGLADARKI — orkiestrator zglosil, ze srodowisko E2E jest NIEDOSTEPNE. To zakaz, nie sugestia:
- NIE uruchamiaj skilla agent-browser, NIE nawiguj po URL-ach, NIE rob screenshotow ani snapshotow.
- Kazdy scenariusz wymagajacy PRZEGLADARKI = wpis SKIP w \`przebiegi\` z powodem "brak srodowiska E2E"
  + finding typ OPERATOR (severity P3) z Operator action, zeby trafil do Operator checklist. NIE zglaszaj go
  jako P2 (to nie defekt kodu) i pod zadnym pozorem NIE opisuj go tak, jakby zostal odegrany.
- Wykonaj TYLKO weryfikacje NIEBROWSEROWE dajace rownowazny dowod: HTTP (curl na route/endpoint + sprawdzenie
  statusu i tresci odpowiedzi), CLI (skrypty, testy, inspekcja artefaktow builda). Porazka wykryta tak samo
  jest defektem -> finding P2 typ E2E + wpis FAIL w \`przebiegi\`.
- Preflight (curl) nadal wykonaj — bez niego nie wiesz, co da sie sprawdzic po HTTP.
`

function e2ePrompt(sciezka, faza, poprzednie, tryb, kontekst) {
  return `Jestes testerem E2E w przegladarce (agent-browser) dla fazy ${faza} w ${sciezka}.
Zbierz niezaznaczone checkboxy oznaczone \`[E2E]\` tej fazy — NIEZALEZNIE od prefiksu:
\`Test: [E2E] ...\` ORAZ \`Weryfikacja: [E2E] ...\` (planner pisze scenariusze E2E pod \`Test:\`,
nie tylko \`Weryfikacja:\` — MUSISZ przeszukac OBA). To scenariusze do odegrania w przegladarce
(open URL, snapshot -i, click, type/fill, assert visible, screenshot, nawigacja klawiatura,
responsywnosc/viewport). Pomin tylko CLI (\`test\`/\`typecheck\`/\`grep\`) i \`[Manual]\`.

BRAMKA (Poprawka 10) — policz checkboxy \`[E2E]\` z OBU prefiksow (Test: + Weryfikacja:). Jesli jest ICH ZERO ->
zwroc OD RAZU {findings:[], przebiegi:[]}, POMIN preflight (curl) i agent-browser. Nie odpalaj srodowiska gdy nie ma
czego testowac. UWAGA — historyczny bug (regresja etap-12b, mobile): liczenie tylko \`Weryfikacja:\` skipowalo E2E
pisane pod \`Test: [E2E]\` i cicho degradowalo je do OPERATOR mimo gotowego srodowiska. "Zero" liczy sie
WYLACZNIE po realnym grepie obu prefiksow w sekcji fazy (\`grep -nE '^- \\[ \\].*\\[E2E\\]' | grep -vE 'Operator:|\\[P[123]\\]'\` —
kopie w Operator checklist i pozycje findingow w "Do poprawy" nie sa scenariuszami).
JEDEN FLOW = JEDEN PRZEBIEG: w webie flow NIE ma osobnego pliku — agent-browser gra scenariusz z OPISU linii
[E2E]. Pole \`flow\` wpisu = kebab-case IDENTYFIKATOR z linii (pierwszy backtick; dla runnera — sciezka
\`e2e/<etap>-run-all.sh\`); \`""\` TYLKO gdy linia nie ma zadnego backticka (starszy format — dopasowanie po
znormalizowanej tresci). Linie [E2E] wskazujace TEN SAM flow (ten sam identyfikator LUB identyczna
znormalizowana tresc) odgrywasz RAZ, ale wpis w \`przebiegi\` dajesz dla KAZDEJ z tych linii
(checkbox = tresc 1:1). WYNIK JEST WLASNOSCIA PRZEBIEGU, nie linii: wszystkie wpisy tego samego przebiegu
maja IDENTYCZNY wynik = wynik jednego odegrania scenariusza (PASS dla kazdej linii; FAIL dla kazdej + JEDEN
finding P2 z lista "checkbox:" wszystkich linii tego przebiegu). Nie interpretuj per linia, ktore kroki "przeszly".
RUNNER: jesli sekcja fazy ma linie \`Weryfikacja: [E2E] e2e/<etap>-run-all.sh\`, uruchom runner RAZ (env z .env.e2e)
i z jego outputu wyprowadz wpis PASS/FAIL per scenariusz dla kazdej linii Test: [E2E] tej fazy (dowod = fragment
outputu runnera) + wpis dla linii runnera; scenariuszy objetych runnerem NIE odgrywaj standalone (runner istnieje,
bo seedy sa wzajemnie destrukcyjne i re-seeduje per scenariusz).
Bez runnera, gdy linia ma "(seed: …)" albo istnieje e2e/seeds/<flow>-seed.sql — przed odegraniem scenariusza
zaaplikuj seed (\`psql "$SUPABASE_E2E_DB_URL" -v ON_ERROR_STOP=1 -f <seed>\`; zbiorczy db-sync mogl go nadpisac
seedem innego flow).

NAJPIERW preflight srodowiska (Bash): czy dev server Vite UP (curl -s localhost:5173 — lub port z vite.config/.env).
Potem proba scenariuszy przez skill agent-browser (open URL, snapshot -i, click, screenshot).

SRODOWISKO ZARZADZANE (jesli w korzeniu repo istnieje .env.e2e): orkiestrator postawil dev server Vite
na dedykowanej bazie e2e i zsynchronizowal migracje+seedy PRZED Twoim startem. Wtedy:
- konto do logowania w flow = E2E_TEST_EMAIL / E2E_TEST_PASSWORD z .env.e2e (nie loguj wartosci),
- "migracja/RPC niewdrozona na remote" i "brak seeded sesji" NIE sa automatycznym powodem
  OPERATOR — najpierw SPRAWDZ realnie (uruchom flow); klasyfikuj OPERATOR dopiero po twardym
  dowodzie blokera srodowiskowego (np. blad poza kontrola: dev server down, popup OAuth zewnetrznego providera).
${tryb === 'bez-przegladarki' ? BLOK_BEZ_PRZEGLADARKI : ''}
KLASYFIKACJA per scenariusz (to jest krytyczne — nie wszystko jest P2):
- Scenariusz WYKONANY i FAILED z powodu defektu w kodzie/UI/stylu -> finding P2 typ E2E.
- Scenariusz NIEWYKONALNY headless (dev server down, popup OAuth zewnetrznego providera,
  migracja/RPC niewdrozona na remote, brak seeded sesji) -> finding typ OPERATOR (severity P3).
  To NIE jest defekt kodu — to brakujacy warunek srodowiskowy. NIE klasyfikuj jako P2.
  W opisie podaj: tresc checkboxa + dokladny blocker + Operator action (kroki do odblokowania).
- Scenariusz WYKONANY i PASSED -> NIE zglaszaj findingu, ale WPISZ go do \`przebiegi\` z wynik:"PASS"
  i dowodem (co zaasertowano + sciezka screenshotu). BEZ wpisu scribe NIE odznaczy
  checkboxa — brak findingu NIE jest dowodem PASS.

PRZEBIEGI (obowiazkowe): KAZDY policzony checkbox [E2E] tej fazy MUSI miec wpis w \`przebiegi\`
(checkbox = tresc wiersza 1:1 lacznie z suffixami, flow = identyfikator z backtickow — po nim scribe dopasowuje,
fallback znormalizowana tresc; wynik PASS/FAIL/SKIP, dowod). FAIL = finding P2 typ E2E (pierwsza linia opisu: "checkbox: <tresc>", plik = *-zadania.md z linia)
+ wpis FAIL; SKIP = finding typ OPERATOR + wpis SKIP z powodem. Brak wpisu = scribe traktuje jak SKIP.

CYTUJ DOSLOWNE KOMUNIKATY BLEDOW: gdy scenariusz pada na bledzie srodowiska/sieci (connection refused,
ERR_*, ECONNREFUSED, timeout, DNS), wklej do opisu findingu DOSLOWNY komunikat z konsoli/outputu
(skopiowany 1:1), nie parafraze. Orkiestrator rozpoznaje klasy blokera srodowiska po SYGNATURZE
tekstowej w opisach findingow — parafraza ("serwer nie odpowiadal") tej detekcji NIE uruchomi
i run pojedzie dalej na zepsutym srodowisku.

Jesli zadanie ma figma_screens / mockupy w sekcji designerskiej — zrob side-by-side visual
comparison screenshotu z mockupem (rozbieznosci wizualne = P2 typ E2E).

Zwroc {findings:[...], przebiegi:[...]}. NIE zapisuj zadnych plikow — w szczegolnosci NIE modyfikuj
*-zadania.md (zadnych ✅, zadnych [x]; odznacza wylacznie scribe na podstawie \`przebiegi\`).
Brak seeda wskazanego linia (checkbox "Stwórz (e2e seed):" niewykonany albo seed nie pokrywa scenariusza)
LUB linia [E2E] bez wykonalnego opisu scenariusza = finding P2 typ E2E (pierwsza linia opisu: "checkbox: <tresc>";
typ E2E, nie KOD — fix pisze seed / doprecyzowuje scenariusz wg IU, re-odgrywa i odznacza zrodlo dopiero po PASS)
+ wpis SKIP (flow = identyfikator z linii, jesli jest; "" tylko gdy linia nie ma backticka).
${BLOK_DLUGIE_KOMENDY}${BLOK_LIMIT_P3}${mapaBlok(kontekst)}${rereviewBlok(poprzednie)}`
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
| Checkboxy \`[E2E]\` (Test: + Weryfikacja:) | ${p.e2eCheckboxy} |
| Tryb testera E2E | ${p.e2eTryb} |
| Tester E2E | ${p.e2eStatus} |
| Przebiegi E2E PASS / FAIL / SKIP | ${p.e2ePass} / ${p.e2eFail} / ${p.e2eSkip} |
| Reviewerzy aktywni | ${p.aktywni.join(', ')} |
| Reviewerzy pominieci | ${pom} |
| Findingi: znalezione -> dedup JS -> dedup semantyczny | ${p.znalezione} -> ${p.poDedupJs} -> ${p.poDedupSem} |
| P3 odrzucone limitem globalnym | ${p.p3Odrzucone || 0} |
| Adversarial verify: weryfikowane / obalone / bez glosow | ${p.weryfikowane} / ${p.obalone} / ${p.niezweryfikowane} |`
}

// Ostrzezenie o niepotwierdzonych checkboxach wisi na `e2eTryb`, a NIE na `aktywni.includes('e2e')`
// (2026-07-30). W trybie `bez-przegladarki` tester JEST w `aktywni`, ale przegladarki nie tknal — warunek
// "tester nie odpalil" przepuscilby wtedy scribe'a do odznaczania browserowych checkboxow bez zadnego
// przebiegu, cicho kasujac gwarancje z poprzedniego audytu. Pytanie jest wiec "czy tester MIAL PRZEGLADARKE".
function scribePrompt(sciezka, faza, potwierdzone, przebieg) {
  return `Jestes scribe review fazy ${faza} w ${sciezka}. Otrzymujesz ZWERYFIKOWANE findings (po adversarial verify).

Findings (JSON):
${JSON.stringify(potwierdzone, null, 2)}

Przebiegi E2E testera (JSON; JEDYNY dowod PASS — tester: ${przebieg.e2eStatus}):
${JSON.stringify(przebieg.e2ePrzebiegi || [], null, 2)}

Referencja procedury: .claude/skills/dev-docs-review/SKILL.md sekcje 4, 4.5, 4.7.

1. Zapisz ${sciezka}/review-faza-${faza}.md — pelny raport (findings posortowane P1->P2->P3, statystyki).
2. Zaktualizuj ${sciezka}/*-zadania.md: dodaj/uzupelnij sekcje "## Do poprawy po review fazy ${faza}"
   — wylistuj findingi typu KOD/TEST/E2E o severity P1 i P2 ORAZ findingi P3 typu KOD/TEST,
   jako checkbox: "- [ ] 🔴/🟠/🟡 [severity] **plik:linia** — opis".
   P3 sa tu od 2026-09-03: orkiestrator przekazuje je agentowi fixa razem z P1/P2 (P3 typu E2E i OPERATOR
   NIE — te ida odpowiednio do bookkeepingu i do Operator checklist). Kazda pozycja P3 MUSI byc wykonalna
   bez dopytywania: jeden plik z numerem linii + zdanie akcji (co zmienic i na co). Gdy finding P3 tego nie
   ma, NIE przepisuj go w tej postaci — zapisz go w raporcie review-faza-${faza}.md, a do tej sekcji wstaw
   tylko wtedy, gdy potrafisz go dociagnac do wykonalnej postaci z tresci findingu. Lista zyczen w tej sekcji
   kosztuje ture agenta fixa.
   W tresci tych pozycji NIE przepisuj markera [E2E] z opisu findingu (linia "checkbox:" findingu E2E) — zamien go na
   [e2e→fix]; jedyna nosna linia [E2E] jest zrodlowa (Test:/Weryfikacja:), a grepy precheck/tester/completion-gate/smoke
   liczylyby kopie jako osobne, nieuruchomione scenariusze.
   Findingi typu OPERATOR (niewykonalne headless) NIE ida tutaj — trafiaja do osobnej sekcji "## Operator checklist faza ${faza}".
   KAZDA pozycja tej sekcji MA format: "- [ ] Operator: <tresc> — Operator action: <kroki>" (prefiks "Operator:"
   jest OBOWIAZKOWY — bootstrap/planner po nim wykluczaja te checkboxy z liczenia ukonczenia fazy).
   W tresci kopiowanej do tej sekcji ZAMIEN marker [E2E] na [Manual] — jedyna nosna linia [E2E] jest
   zrodlowa (precheck, completion-gate i smoke liczylyby kopie podwojnie, a po opt-out operatora kopia
   dalej blokowalaby gate). IDEMPOTENCJA: jesli kopia tej samej linii/flow juz istnieje w sekcji — zaktualizuj
   jej powod, NIE dodawaj drugiej; sekcje "## Do poprawy po review fazy ${faza}" i "## Operator checklist faza ${faza}"
   zapisuj jako calosc z TEGO review (stare pozycje, ktorych tu nie ma, usun).
   To nie sa zadania do fix, tylko warunki srodowiskowe dla operatora.
3. Bookkeeping checkboxow "Weryfikacja:" i "Test: [E2E]" (sekcja 4.7): re-parsuj niezaznaczone wiersze fazy ${faza}
   pasujace do regex ^\\s*-\\s*\\[\\s*\\]\\s*(Weryfikacja:|Test:\\s*\\[E2E\\]) — oba prefiksy, bo scenariusz [E2E]
   z planu laduje pod "Test:", a jego JEDYNYM wlascicielem odznaczenia jest ten bookkeeping (execute go nie rusza).
   REGULA ZERO: linia z markerem [E2E] (dowolny prefiks) = ZAWSZE kategoria E2E, niezaleznie od innych slow.
   Sklasyfikuj (CLI->uruchom przez Bash, exit0->[x]; Grep->uruchom; E2E -> WYLACZNIE wg listy "Przebiegi E2E"
   wyzej. DOPASOWANIE TOLERANCYJNE: NAJPIERW po identyfikatorze flow zawartym w linii (pierwszy backtick
   = pole flow wpisu), FALLBACK po tresci po normalizacji (bez "- [ ] ", bez suffixow "(SKIP — …)"/"(FAIL: …)",
   bez bialych znakow) — dla linii bez identyfikatora (starszy format). Dla kazdego flow
   wez ZBIOR wpisow o nim: jesli KTORYKOLWIEK jest FAIL lub SKIP -> caly flow = FAIL/SKIP (FAIL przed SKIP, oba
   przed PASS) i NIE odznaczaj zadnej linii tego flow; [x] dla KAZDEJ niezaznaczonej linii [E2E] tej fazy wskazujacej
   ten flow WYLACZNIE gdy wszystkie wpisy tego flow sa PASS; przy odznaczaniu USUN stary suffix SKIP/FAIL i odhacz/usun
   odpowiadajaca kopie "Operator: …" w "## Operator checklist faza ${faza}". FAIL -> [ ]; USUN nieaktualny suffix
   "(SKIP — …)" (flow przebiegl), istniejacy "(FAIL: …)" zostaw — fix zastapi go po swoim re-runie (P2 juz jest).
   SKIP lub BRAK wpisu -> [ ] z suffixem "(SKIP — <powod>)" (zastap istniejacy suffix, nie dopisuj drugiego)
   + kopia do "## Operator checklist faza ${faza}" (format "- [ ] Operator: ...", [E2E] -> [Manual]; bez duplikatu).
   BRAK FINDINGU NIE JEST DOWODEM PASS. Manual->zostaw z adnotacja; Niejasne->P3).
   Odznacz/anotuj w pliku zadan. Dopisz sekcje "Bookkeeping checkboxow Weryfikacja: / Test: [E2E]" do raportu.${przebieg.e2eTesterFail ? `
   UWAGA — TESTER E2E PADL (${przebieg.e2eStatus}). Orkiestrator ZATRZYMA run i review tej fazy POWTORZY sie z testerem.
   Zadnego checkboxa \`[E2E]\` NIE odznaczaj, NIE dopisuj suffixow i NIE kopiuj ich do Operator checklist —
   to review zostanie uniewaznione, a kopie zostalyby w smoke'u operatora jako reczne scenariusze.` : przebieg.e2eWykonany ? '' : `
   UWAGA — TESTER E2E NIE DAL ZADNEGO PRZEBIEGU W TEJ FAZIE (${przebieg.e2eStatus}).
   Zadnego checkboxa \`[E2E]\` NIE odznaczaj — nie ma przebiegu, ktory by to potwierdzil.
   Kazdy taki checkbox zostaw \`- [ ]\` i przenies jego kopie do "## Operator checklist faza ${faza}"
   (format "- [ ] Operator: ...", [E2E] -> [Manual] w kopii), bo weryfikacja nie zostala wykonana.`}
4. Policz liczniki: p1/p2/p3 (tylko KOD/TEST/E2E) oraz operator (osobno — findingi OPERATOR). P2 z bookkeepingu: CLI FAIL, Grep FAIL.
5. Ustaw severityGate: BLOKUJE (sa P1) / ZASTRZEZENIA (tylko P2) / CZYSTE (zero P1/P2 — sam P3/OPERATOR nie blokuje gate'u).
6. Policz e2e {passed, failed, skipped} Z LISTY "Przebiegi E2E" (checkboxy bez wpisu licz jako skipped).
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
// Status srodowiska przegladarkowego E2E od orkiestratora ('gotowe' | 'pominieto' | 'niepowodzenie' | 'brak').
// undefined = run standalone (reczne /dev-docs-review) — wtedy NIE wiemy nic o srodowisku i nie wolno nam
// niczego ograniczac: FAIL-OPEN, zachowanie dokladnie jak przed ta zmiana.
const srodowiskoE2E = args ? args.srodowiskoE2E : undefined
// Tiery rozumowania per rola (plan B4). Wystawione jako `args.tiery`, zeby dalo sie porownac dwa
// ustawienia bez edycji kodu — inaczej kazda proba strojenia kosztu jest commitem w workflow.
// Domyslnie taniej tam, gdzie praca jest mechaniczna: packager przepisuje sekcje i liczy checkboxy,
// sceptyk P2 sprawdza jeden plik. Reviewerzy i sceptycy P1 zostaja na tierze sesji — tam kupujemy
// jakosc osadu, a P1 dodatkowo bramkuje twardy STOP.
const TIERY_DOMYSLNE = { packager: 'low', sceptykP2: 'medium', sceptykP1: null, reviewer: null }
const tiery = { ...TIERY_DOMYSLNE, ...((args && args.tiery) || {}) }
// `effort: undefined` bywa traktowane inaczej niz brak pola — dokladamy klucz tylko gdy tier jest ustawiony.
const zEffortem = (opts, effort) => (effort ? { ...opts, effort } : opts)
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
const ctxPlik = `/tmp/review-ctx-${String(sciezka).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-faza-${faza}.md`
const kontekst = await agent(kontekstPrompt(sciezka, faza, diffPlik, ctxPlik), zEffortem({ schema: KONTEKST, label: 'kontekst:diff', phase: 'Review' }, tiery.packager))

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
// Liczba checkboxow [E2E] pochodzi z packagera; gdy packager padl (null) liczba jest NIEZNANA, nie zero —
// bramkowanie retry/STOP licznikiem zamienialoby awarie dwoch agentow (529/watchdog) w cicha degradacje.
const e2eLiczbaZnana = !!(kontekst && Number.isInteger(kontekst.e2eCheckboxy))
// Flaga `figmaScreens` jest poza `required` schematu — starszy/padniety packager jej nie zwroci i wtedy
// dzialamy jak dotad (fail-open ponizej po `warstwy.ui`).
const figmaScreens = !!(kontekst && kontekst.figmaScreens)
// Do 2026-09-02 warunkiem bylo `warstwy.ui`, czyli KAZDA faza dotykajaca prezentacji budzila testera —
// takze taka, ktora nie ma ani jednego scenariusza do odegrania. W telemetrii: 10 z 18 uruchomien testera
// szlo w tryb `przegladarka` przy `e2eCheckboxy: 0`. Teraz decyduje POLICZONA praca: checkboxy [E2E] albo
// makiety Figmy do visual diffu (feature-tester-e2e §3.5 wisi na `figma_screens`, nie na checkboxie).
// Gdy packager padl i liczba jest NIEZNANA, wracamy do `warstwy.ui` — bez faktow nie wycinamy testera.
const domenaE2E = !warstwy || (e2eLiczbaZnana ? (e2eCheckboxy > 0 || figmaScreens) : warstwy.ui)
// Tryb testera E2E (2026-07-30) — trzy stany zamiast wlacz/wylacz. Domena decyduje, CZY tester ma co robic;
// status srodowiska decyduje, CZYM moze to robic. Obserwacja z runu rownolegle-joby (faza 1): tester
// przywolany bez srodowiska (e2eSrodowisko: "pominieto") dal 1 passed / 1 failed / 3 skipped — czesc tej
// pracy zrobilby scribe za darmo, ale ten jeden fail byl realny. Wiec: ograniczamy zakres i MIERZYMY.
//   'przegladarka'     = domena obecna + srodowisko gotowe ALBO nieznane (standalone) -> jak dotad,
//   'bez-przegladarki' = domena obecna, ale srodowisko ZNANE i != 'gotowe' -> tylko HTTP/CLI,
//   'pominiety'        = brak warstwy UI i zero browserowych checkboxow -> tester nie startuje.
const e2eTryb = !domenaE2E
  ? 'pominiety'
  : (srodowiskoE2E !== undefined && srodowiskoE2E !== 'gotowe') ? 'bez-przegladarki' : 'przegladarka'
const pominieci = [
  ...REVIEWERZY.filter((r) => !aktywni.includes(r)).map((r) => ({ key: r.key, powod: 'domena nieobecna w mapie zmian fazy' })),
  ...(e2eTryb === 'pominiety' ? [{ key: 'e2e', powod: `zero checkboxow [E2E] (${e2eCheckboxy}) i brak makiet figma_screens${e2eLiczbaZnana ? '' : ' — liczba nieznana, decydowal brak warstwy UI'}` }] : []),
]
if (pominieci.length) log(`Routing v2: pomijam ${pominieci.map((p) => p.key).join(', ')} (${plikiFazy.length} plikow, ${plikiKodu} kodu)`)
else log(`Routing v2: pelny sklad (${plikiFazy.length} plikow${warstwy ? '' : ', brak flag warstw — fail-open'})`)
log(kontekst && kontekst.ctxZapisany
  ? `Dossier fazy: ${kontekst.ctxPlik} — reviewerzy czytaja je zamiast pelnego planu i dokumentu wymagan`
  : 'Dossier fazy NIE powstalo — reviewerzy czytaja pelne dokumenty jak przed zmiana (fail-open, drozej)')

const thunki = aktywni.map((r) => () =>
  agent(reviewerPrompt(sciezka, faza, r.fokus, poprzKod, kontekst, !!r.semantyka), zEffortem({ schema: FINDINGS, agentType: r.agentType, label: `review:${r.key}`, phase: 'Review' }, tiery.reviewer))
)
thunki.push(() => agent(testCoveragePrompt(sciezka, faza, poprzTest, kontekst), { schema: FINDINGS, label: 'review:test-coverage', phase: 'Review' }))
if (e2eTryb !== 'pominiety') {
  log(`Tester E2E: tryb ${e2eTryb} (srodowisko: ${srodowiskoE2E === undefined ? 'nieznane — run standalone' : srodowiskoE2E})`)
  thunki.push(() => agent(e2ePrompt(sciezka, faza, poprzE2e, e2eTryb, kontekst), { schema: E2E_RESULT, agentType: 'feature-tester-e2e', label: 'review:e2e', phase: 'Review' }))
}

const wyniki = await parallel(thunki)

// Tester E2E jest ZAWSZE ostatnim thunkiem (ta sama zaleznosc indeksowa, z ktorej korzysta etykietyZrodel).
// Null testera (watchdog-kill po 180s ciszy przegladarki, 529) NIE moze byc cicho zamieniony na "zero findingow":
// jeden retry (jak env-up w autopilocie), a po drugim nullu twarda flaga e2eTesterFail dla orkiestratora.
const e2eAktywny = e2eTryb !== 'pominiety'
const indeksE2e = e2eAktywny ? thunki.length - 1 : -1
// `e2eLiczbaZnana` policzone wyzej przy routingu (ten sam fakt: czy packager podal liczbe checkboxow).
const e2eMozeMiecCheckboxy = e2eCheckboxy > 0 || !e2eLiczbaZnana
// Wynik "wykonany, ale bez ani jednego przebiegu" przy checkboxach [E2E] jest rownowazny nullowi: tester nie
// dowiodl niczego (przerwany po preflighcie, zapomnial raportowac) — bez retry cala faza spadlaby do OPERATOR.
const brakPrzebiegow = (w) => !w || (e2eMozeMiecCheckboxy && (!Array.isArray(w.przebiegi) || w.przebiegi.length === 0))
let e2eRetry = false
if (e2eAktywny && brakPrzebiegow(wyniki[indeksE2e])) {
  e2eRetry = true
  const powod = wyniki[indeksE2e] ? 'zwrocil wynik BEZ zadnego wpisu przebiegi[]' : 'zwrocil null (watchdog/API)'
  log(`Tester E2E fazy ${faza} ${powod} (checkboxy [E2E]: ${e2eLiczbaZnana ? e2eCheckboxy : 'liczba nieznana — packager padl'}) — ponawiam raz`)
  wyniki[indeksE2e] = await agent(
    `${e2ePrompt(sciezka, faza, poprzE2e, e2eTryb, kontekst)}\n\n(PONOWNA PROBA — poprzedni przebieg ${powod}. KAZDY checkbox [E2E] fazy MUSI miec wpis PASS/FAIL/SKIP w przebiegi[] (przy zerze checkboxow zwroc {findings:[], przebiegi:[]}); jesli scenariusz w przegladarce milczy >120s, loguj postep do pliku i czytaj go w tle zgodnie z blokiem dlugich komend.)`,
    { schema: E2E_RESULT, agentType: 'feature-tester-e2e', label: 'review:e2e:retry', phase: 'Review' }
  )
}
const e2eWynik = e2eAktywny ? wyniki[indeksE2e] : null
const e2ePrzebiegi = (e2eWynik && Array.isArray(e2eWynik.przebiegi)) ? e2eWynik.przebiegi : []
// "Wykonany" = dal przebiegi (albo realnie nie bylo czego testowac). Null 2x = NIE wykonany; pusto 2x przy ZNANEJ
// liczbie checkboxow > 0 = NIE wykonany -> twarda flaga dla orkiestratora (STOP, review pending). Przy liczbie
// NIEZNANEJ (packager padl) drugi pusty wynik jest AKCEPTOWANY jako "brak checkboxow" — tester sam grepuje sekcje
// fazy, a gdyby sie mylil, scribe zostawi [E2E] jako [ ] i completion-gate to zlapie (nie ma tu cichej zieleni).
const e2eWykonany = !!e2eWynik && !(e2eMozeMiecCheckboxy && e2ePrzebiegi.length === 0 && e2eCheckboxy > 0)
const e2eTesterFail = e2eAktywny && e2eMozeMiecCheckboxy && !e2eWykonany
const e2eStatus = !e2eAktywny
  ? 'pominiety przez routing'
  : e2eTesterFail
    ? (e2eWynik ? 'padl (2x wynik bez zadnego przebiegu) — zadnego dowodu' : 'padl (agent null 2x) — zadnego przebiegu')
    : e2eWynik
      ? (e2ePrzebiegi.length === 0 ? `wykonany — brak checkboxow [E2E] w fazie${e2eRetry ? ' (po retry; liczba z packagera nieznana)' : ''}` : `wykonany (tryb ${e2eTryb})${e2eRetry ? ' (po retry)' : ''}`)
      : 'bez checkboxow [E2E] (packager policzyl 0, tester nic nie zwrocil — OK)'
if (e2eTesterFail) log(`Tester E2E fazy ${faza} ${e2eStatus} przy ${e2eLiczbaZnana ? e2eCheckboxy : 'nieznanej liczbie'} checkboxow [E2E] — review zapisze sie BEZ odznaczania [E2E], orkiestrator zatrzyma run (review pending)`)

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
// ── Detekcja blokera srodowiskowego po SYGNATURZE (port z mobile, 2026-08-08) ──
// Powod (run feedback-marcin-poprawki, mobile): awarie SRODOWISKA objawialy sie dopiero w scenariuszach
// E2E, tester klasyfikowal je jako P2/OPERATOR i RUN LECIAL DALEJ przez kolejne fazy — kazdy nastepny
// scenariusz padal z tego samego powodu, a operator dowiadywal sie po godzinach. Klasy z jednoznaczna
// sygnatura w outputach rozpoznajemy w JS (bez LLM) i pozwalamy orkiestratorowi zatrzymac run od razu.
// Web-owe klasy: (a) dev server nieosiagalny (padl w trakcie runu / zly port) — kazdy kolejny scenariusz
// przegladarkowy padnie tak samo; (b) host nierozwiazywalny (zly URL w .env.e2e / projekt Supabase
// spauzowany) — to samo. SWIADOME OGRANICZENIE: gdy przegladarka/curl zmieni brzmienie komunikatu,
// detekcja przestanie dzialac po cichu — dlatego to UZUPELNIENIE normalnej klasyfikacji, nie jej
// zamiennik. Finding nierozpoznany dalej idzie zwykla sciezka P2/OPERATOR (stan sprzed tej zmiany).
// Tester E2E ma nakaz cytowania DOSLOWNYCH komunikatow (patrz e2ePrompt) — parafraza nie uruchomi detekcji.
// Gole `getaddrinfo` USUNIETE z drugiego wzorca (audyt 2026-09-02, finding A1). Nazwa wywolania systemowego
// wystepuje w NORMALNYM opisie defektu kodu — realny P2 z oferty-online brzmial "`resolveWebhookTarget`
// (a w nim `dns.lookup`) jest awaitowane PRZED utworzeniem AbortSignal.timeout, a `dns.lookup`/`getaddrinfo`
// nie ma wlasnego limitu" i zatrzymywal run jako "bloker srodowiska", choc opisywal brak timeoutu w kodzie.
// Zostaje wylacznie `getaddrinfo` ZLACZONE z kodem bledu (tak brzmi realny komunikat runtime).
const SYGNATURY_BLOKERA = [
  { re: /err_connection_refused|econnrefused|net::err_connection|connection refused|(localhost|127\.0\.0\.1):\d+[^\n]{0,60}\b(refused|unreachable|timed out|nie odpowiada)/i, klasa: 'dev-server-nieosiagalny' },
  { re: /err_name_not_resolved|\benotfound\b|\beai_again\b|getaddrinfo\s+(enotfound|eai_again|eai_fail)|could not resolve host/i, klasa: 'host-nierozwiazywalny' },
]
// `przebiegiTestera` to trzeci filtr obok sygnatury i zrodla (audyt 2026-09-02, finding A1): bloker
// srodowiska objawia sie PADNIETYM scenariuszem. Gdy tester nie ma ani jednego wpisu FAIL/SKIP, sygnatura
// w opisie jest cytatem z kodu albo dywagacja, nie awaria — i nie ma powodu zatrzymywac calego runu.
function wykryjBlokerSrodowiska(findingi, przebiegiTestera) {
  const maNieudanyPrzebieg = Array.isArray(przebiegiTestera)
    && przebiegiTestera.some((p) => p && (p.wynik === 'FAIL' || p.wynik === 'SKIP'))
  if (!maNieudanyPrzebieg) return null
  for (const f of findingi) {
    const tekst = `${f.opis || ''} ${f.plik || ''}`
    for (const s of SYGNATURY_BLOKERA) {
      if (s.re.test(tekst)) return { wykryty: true, klasa: s.klasa, dowod: (f.opis || '').slice(0, 500) }
    }
  }
  return null
}

// Etykieta zrodla per finding — kolejnosc `wyniki` odpowiada kolejnosci `thunki` (aktywni, potem
// test-coverage, potem opcjonalnie e2e). Potrzebna do sprawiedliwego przyciecia P3 (patrz wybierzNity):
// bez niej `slice` ucinal po kolejnosci reviewerow, czyli wyciszal zawsze tych samych ostatnich.
const etykietyZrodel = [...aktywni.map((r) => r.key), 'test-coverage', ...(e2eTryb !== 'pominiety' ? ['e2e'] : [])]
const wszystkie = wyniki.flatMap((w, i) => (w ? w.findings.map((f) => ({ ...f, _zrodlo: etykietyZrodel[i] || '?' })) : []))
// Wejscie zawezone do findingow TESTERA (audyt 2026-09-02, finding A1): sygnatura w opisie reviewera kodu
// mowi o kodzie, nie o srodowisku. I tylko w trybie `przegladarka` — w `bez-przegladarki` odmowa polaczenia
// z curla jest stanem OCZEKIWANYM (srodowiska swiadomie nie ma), a nie awaria uzasadniajaca STOP runu.
const blokerSrodowiska = e2eTryb === 'przegladarka'
  ? wykryjBlokerSrodowiska(wszystkie.filter((f) => f._zrodlo === 'e2e'), e2ePrzebiegi)
  : null
if (blokerSrodowiska) {
  log(`BLOKER SRODOWISKA wykryty po sygnaturze (${blokerSrodowiska.klasa}) — orkiestrator zatrzyma run zamiast ciagnac kolejne fazy na zepsutym srodowisku`)
}
const RANGA = { P1: 0, P2: 1, P3: 2 }
const poKluczu = new Map()
for (const f of wszystkie) {
  // Findingi testera (typ E2E, zrodlo e2e) zaczynaja opis od "checkbox: Test: [E2E] `<flow>` …" — dwie
  // linie tego samego flow maja identyczne 60 pierwszych znakow i ten sam plik, wiec klucz skrotowy by je sklejal
  // (druga linia zniknelaby przed fixem). Dla nich klucz = pelny opis.
  const klucz = (f.typ === 'E2E' && f._zrodlo === 'e2e') ? `${f.plik}|${f.opis.toLowerCase()}` : `${f.plik}|${f.opis.slice(0, 60).toLowerCase()}`
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
// Typ E2E poza adversarial verify: dowodem findingu E2E jest PRZEBIEG w przegladarce (output/screenshot), nie kod —
// sceptyk czytajacy JSX ("tekst jest w komponencie") obalal realne FAIL-e, a scribe bez findingu odznaczal [x].
// Typ OPERATOR tez nie jest do obalania kodem (warunek srodowiskowy) — idzie wprost do potwierdzonych.
// Ominiecie dotyczy WYLACZNIE zrodla 'e2e' (tester ma za soba przebieg); reviewer kodu, ktory sklasyfikowal finding
// jako typ E2E z lektury kodu, nadal przechodzi przez sceptykow.
const zE2eTestera = (f) => f.typ === 'E2E' && f._zrodlo === 'e2e'
const doWeryfikacji = dedup.filter((f) => (f.severity === 'P1' || f.severity === 'P2') && f.typ !== 'OPERATOR' && !zE2eTestera(f))
const e2eBezVerify = dedup.filter((f) => (f.severity === 'P1' || f.severity === 'P2') && zE2eTestera(f))
// Globalny limit P3 PO dedupie — per-reviewerowy BLOK_LIMIT_P3 nie ogranicza AGREGATU (8 reviewerow x 5).
// Przycinamy JAWNIE (log + metryka p3Odrzucone), nigdy po cichu: milczace uciecie czytaloby sie jak
// "tyle bylo", a to falszywy obraz jakosci fazy. P1/P2 NIE sa tu dotykane pod zadnym warunkiem.
// OPERATOR poza limitem P3 (spojnie z BLOK_LIMIT_P3 per reviewer): odrzucony finding OPERATOR nie trafilby
// do "## Operator checklist faza N" ani do smoke'u operatora, a scribe bez findingu odznaczylby [E2E] jako PASS.
const wszystkieNity = dedup.filter((f) => f.severity === 'P3' && f.typ !== 'OPERATOR')
const operatorowe = dedup.filter((f) => f.typ === 'OPERATOR')
// Wybor round-robin po ZRODLE, nie `slice` po kolejnosci wstawiania. Powod (review adwersaryjny 2026-08-08,
// mobile): findingi wchodza do Mapy w kolejnosci reviewerow (security, performance, architecture,
// typescript, spec-compliance, simplicity, test-coverage, e2e), wiec proste `slice(0,8)` przy 20+ nitach
// przepuszczalo wylacznie P3 dwoch pierwszych reviewerow i SYSTEMATYCZNIE, w kazdej fazie, wycinalo cale
// wyjscie simplicity, test-coverage i e2e. To nie jest uciecie ogona, tylko wyciszenie trzech reviewerow.
// W obrebie zrodla KOD/TEST ida przed OPERATOR (nit o defekcie jest wart wiecej niz nota srodowiskowa).
// Od 2026-09-03 (plan B1) wybor jest DWUSTOPNIOWY. Skoro P3 ida do fixa, najtanszy nit to ten, ktorego
// plik agent fixa i tak otworzy przy P1/P2 tej samej fazy — naprawa kosztuje wtedy jedno spojrzenie
// wiecej, a nie osobne wejscie w plik. Dopiero reszte tniemy round-robinem po zrodle jak dotad.
// `plikiWaznych` liczymy PRZED verify, wiec moze zawierac plik findingu, ktory sceptycy zaraz obala —
// to swiadomy kompromis: to jest tie-breaker kolejnosci nitow, nie decyzja o ich losie.
function kluczPliku(plik) {
  // "src/a.ts:214" i "src/a.ts:31" to ten sam plik — numer linii tu przeszkadza.
  return String(plik || '').split(':')[0].trim().toLowerCase()
}
function wybierzNity(nityLista, limit, plikiWaznych) {
  if (nityLista.length <= limit) return nityLista
  const PRIORYTET = { KOD: 0, TEST: 1, E2E: 2, OPERATOR: 3 }
  const wTymSamymPliku = nityLista.filter((f) => plikiWaznych.has(kluczPliku(f.plik)))
  const pozostale = nityLista.filter((f) => !plikiWaznych.has(kluczPliku(f.plik)))
  // Stopien 1: nity w plikach juz otwieranych przez fix. Gdyby samych takich bylo ponad limit,
  // tez ida round-robinem — inaczej jeden gadatliwy reviewer zjadlby caly budzet.
  const wybrane = []
  const dobierz = (lista) => {
    if (wybrane.length >= limit || !lista.length) return
    const kolejki = new Map()
    for (const f of lista) {
      const k = f._zrodlo || '?'
      if (!kolejki.has(k)) kolejki.set(k, [])
      kolejki.get(k).push(f)
    }
    for (const q of kolejki.values()) q.sort((a, b) => (PRIORYTET[a.typ] ?? 9) - (PRIORYTET[b.typ] ?? 9))
    for (let runda = 0; wybrane.length < limit; runda++) {
      let dodano = false
      for (const q of kolejki.values()) {
        if (q.length > runda) {
          wybrane.push(q[runda])
          dodano = true
          if (wybrane.length === limit) break
        }
      }
      if (!dodano) break // wyczerpalismy wszystkie kolejki tego stopnia
    }
  }
  dobierz(wTymSamymPliku)
  dobierz(pozostale)
  return wybrane
}
// Pliki findingow waznych tej fazy — bez OPERATOR (nie sa defektem kodu, fix ich nie otwiera).
const plikiWaznych = new Set(
  dedup.filter((f) => (f.severity === 'P1' || f.severity === 'P2') && f.typ !== 'OPERATOR').map((f) => kluczPliku(f.plik))
)
plikiWaznych.delete('?')
plikiWaznych.delete('')
const nity = wybierzNity(wszystkieNity, LIMIT_P3_GLOBALNY, plikiWaznych)
const p3Odrzucone = wszystkieNity.length - nity.length
if (p3Odrzucone) {
  const odrzucone = wszystkieNity.filter((f) => !nity.includes(f)).map((f) => `${f._zrodlo}: ${f.plik} — ${(f.opis || '').slice(0, 60)}`)
  log(`Limit P3: z ${wszystkieNity.length} nitow po dedupie zostawiam ${nity.length} (odrzucone: ${p3Odrzucone}) — prog LIMIT_P3_GLOBALNY=${LIMIT_P3_GLOBALNY}\n  odrzucone: ${odrzucone.join(' | ')}`)
}

// Poprawka 8: P1 (blocking) -> 3 sceptykow (konsensus 2/3). P2 (important) -> 1 sceptyk.
// Verify bylo 55% calego runu (dane wf_ed163076: 114/208 agentow). 3x na kazdy P2 to nadmiar —
// P2 nie blokuje merge'a, wystarczy jeden glos czy realny.
//
// Plan B4 (2026-09-03): P2 sa dodatkowo BATCHOWANE po pliku. Sceptyk P2 i tak zaczyna od otwarcia pliku
// i zbudowania sobie obrazu zmian; przy trzech findingach w tym samym pliku placilismy za to trzy razy.
// Jeden sceptyk na grupe (maks 4 findingi z jednego pliku) robi to raz. P1 zostaja BEZ ZMIAN — tam
// niezaleznosc glosow jest cala wartoscia mechanizmu i konsensus 2/3 nie ma sensu bez trzech osobnych agentow.
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
    return { ...f, potwierdzony, opis: sugestia ? `${f.opis} [sceptyk sugeruje ${najczestsza}]` : f.opis }
  }
  const severity = ileGlosow > glosy.length / 2 ? najczestsza : f.severity
  if (severity !== f.severity) severityKorektyPrzyjete++
  return { ...f, potwierdzony, severity }
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

const potwierdzoneKod = zweryfikowane.filter(Boolean).filter((f) => f.potwierdzony).map(({ potwierdzony, ...f }) => f)
const potwierdzone = [
  ...potwierdzoneKod,
  ...e2eBezVerify,
  ...operatorowe,
  ...nity,
]
log(`Verify: z ${doWeryfikacji.length} findingow P1/P2 spoza testera potwierdzono ${potwierdzoneKod.length} (+ ${e2eBezVerify.length} E2E testera bez verify, + ${operatorowe.length} OPERATOR, + ${nity.length} nitow)`)

// Metryki przebiegu liczone w JS (Filar 3: agent nigdy nie liczy tego, co JS wie na pewno).
// Ida do raportu review (widok dla czlowieka) I do orkiestratora -> stan -> telemetria (strojenie progow).
const przebieg = {
  pliki: plikiFazy.length,
  plikiKodu,
  warstwy,
  e2eCheckboxy,
  figmaScreens,
  // Czy packager zbudowal dossier fazy (plan B3). Bez tej metryki cichy fallback do czytania pelnych
  // dokumentow wygladalby w telemetrii identycznie jak brak oszczednosci z samej zmiany.
  dossier: !!(kontekst && kontekst.ctxZapisany),
  e2eTryb,
  aktywni: [...aktywni.map((r) => r.key), 'test-coverage', ...(e2eTryb !== 'pominiety' ? ['e2e'] : [])],
  pominieci,
  znalezione: wszystkie.length,
  poDedupJs,
  poDedupSem: dedup.length,
  p3Odrzucone,
  weryfikowane: doWeryfikacji.length,
  obalone: doWeryfikacji.length - potwierdzoneKod.length,
  severityKorekty: { przyjete: severityKorektyPrzyjete, odrzucone: severityKorektyOdrzucone },
  // Ile agentow realnie kosztowal verify (plan B4): P1 x3 + jeden na grupe P2 zamiast jednego na finding.
  sceptycy: { p1: p1DoVerify.length * 3, p2Grupy: grupyP2.length, p2Findingi: p2DoVerify.length },
  tiery,
  e2eWykonany,
  e2eTesterFail,
  e2eRetry,
  e2eLiczbaZnana,
  e2eStatus,
  e2ePrzebiegi,
  e2ePass: e2ePrzebiegi.filter((x) => x.wynik === 'PASS').length,
  e2eFail: e2ePrzebiegi.filter((x) => x.wynik === 'FAIL').length,
  e2eSkip: e2ePrzebiegi.filter((x) => x.wynik === 'SKIP').length,
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
      blokerSrodowiska,
      e2eTesterFail,
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
    blokerSrodowiska,
    e2eTesterFail,
    scribeFail: true,
  }
}
// przebieg, blokerSrodowiska i e2eTesterFail dokladane w JS (nie przez schemat agenta) — orkiestrator zapisuje
// przebieg w stanie i telemetrii, po blokerze zatrzymuje run, a po e2eTesterFail zostawia review pending.
return { ...wynik, przebieg, blokerSrodowiska, e2eTesterFail }

export const meta = {
  name: 'dev-docs-execute-wf',
  description: 'Wykonanie jednej fazy zadania: buildery per IU, walidacja, commit.',
  whenToUse: 'Wolany przez dev-autopilot-wf; standalone: args {sciezka, faza}.',
  phases: [
    { title: 'Plan IU', detail: 'wczytaj plan techniczny, zbuduj prompty builderow' },
    { title: 'Build', detail: 'jeden builder per Implementation Unit' },
    { title: 'Domkniecie', detail: 'walidacja, commit, aktualizacja docs' },
  ],
}

// Kopia stalej z dev-autopilot-wf.js (workflowy sa self-contained — przy zmianie synchronizuj recznie).
// Doklejana W JS do prompta KAZDEGO buildera i domkniecia — nie polegamy na tym, ze planner ja przekopiuje.
const BLOK_DLUGIE_KOMENDY = `
=== DLUGIE KOMENDY (przeczytaj ZANIM uruchomisz testy/buildy — prawa srodowiska, nie sugestie) ===
(1) Runtime zabija subagenta po ~180s bez zadnego outputu ("agent stalled"); po 6 killach pada CALY run.
(2) Pojedyncze foreground Bash ma limit 600s (domyslnie 120s) — dluzszej komendy NIE dokonczysz.
(3) Zimny runner testow po inwalidacji cache (zmiana zaleznosci lub configu) potrafi MILCZEC przed pierwszym
    outputem reportera — cisza to nie zwis; zaden reporter nie pomaga.
STACK: runner testow, pliki inwalidujace jego cache, reporter strumieniowy i sygnatury flake'ow infrastruktury
TEGO projektu sa w .claude/stack/walidacja.md, sekcje „Zimny runner” i „Flake infrastruktury” — przeczytaj je
PRZED pierwszym uruchomieniem testow.
REGULY:
- Komenda mogaca trwac >100s (runner testow po zmianie zaleznosci/configu, pelny suite, build): uruchom przez
  Bash z run_in_background i przekierowaniem do pliku logu, potem POLLUJ krotkim Bash co ~45-60s
  (tail loga / sprawdzenie procesu) az do zakonczenia. Kazda sonda = znak zycia dla watchdoga.
- NIGDY nie podnos timeoutu foreground zamiast isc w tlo — 180s ciszy zabija CIEBIE, nie komende.
- Po zmianie package.json / lockfile / configu runnera albo builda (lista w sekcji „Zimny runner”) przez kogokolwiek
  w tym runie: pierwszy bieg testow traktuj jako ZIMNY (pelna procedura tla powyzej).
- Runner uruchamiaj z reporterem strumieniowym z sekcji „Zimny runner”: strumieniowany stdout W TRAKCIE foreground
  Bash resetuje watchdog, wiec chroni WARM suite'y w oknie 180-600s.
  NIE chroni: zimnego cache (transform milczy do konca) ani komend >600s (twardy limit Bash).
- FLAKE INFRA: gdy pelny suite zglosi na pliku blad infrastruktury workera (sygnatury w sekcji „Flake infrastruktury”)
  — re-runuj TEN plik w izolacji (procedura OSOBNO dla kazdego takiego pliku). PASS w izolacji = flake infra,
  NIE defekt: odnotuj "flake-infra: <plik> (PASS w izolacji)" i NIE traktuj jako FAIL. FAIL w izolacji = realny defekt.
  Po obsludze flake'ow DOKONCZ przerwany lancuch walidacji (kolejne kroki, np. build).
=== KONIEC BLOKU DLUGICH KOMEND ===`

// ── Schematy ──────────────────────────────────────────────────────────────

const IU_PLAN = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fazaNumer: { type: 'integer' },
    fazaNazwa: { type: 'string' },
    strategia: { type: 'string', enum: ['serial', 'parallel'], description: 'serial gdy IU maja zaleznosci/wspolne pliki; parallel gdy niezalezne' },
    poza: { type: 'boolean', description: 'true gdy faza juz ukonczona / nic do zrobienia' },
    baza: { type: 'string', description: 'pelny SHA z `git rev-parse HEAD` przed faza — od niego bramki domkniecia licza zmiany fazy' },
    iu: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          nazwa: { type: 'string' },
          agentType: {
            type: 'string',
            enum: ['feature-builder-ui', 'feature-builder-data', 'feature-builder-fullstack', 'feature-builder-ui-figma', 'feature-builder-fullstack-figma'],
          },
          prompt: { type: 'string', description: 'KOMPLETNY blok IU gotowy do wyslania builderowi (Cel, Wymagania, Pliki, Podejscie, Wzorce, Scenariusze testowe, Weryfikacja) + sciezka zadania + numer IU + doklejony designerski kontekst gdy UI/fullstack' },
        },
        required: ['id', 'nazwa', 'agentType', 'prompt'],
      },
    },
  },
  required: ['fazaNumer', 'strategia', 'poza', 'baza', 'iu'],
}

const BUILD_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['completed', 'partial', 'blocked'] },
    pliki: { type: 'array', items: { type: 'string' } },
    odchylenia: { type: 'array', items: { type: 'string' } },
    nastepneKroki: { type: ['string', 'null'] },
    pytanie: { type: ['string', 'null'], description: 'wypelnione gdy status=blocked; po polsku, prostym jezykiem: co blokuje i gdzie, opcje ze skutkiem, rekomendacja (blok PYTANIE BLOKERA)' },
    decyzje: { type: 'array', items: { type: 'string' }, description: 'sprzecznosci zrodel rozstrzygniete wg blok HIERARCHIA ZRODEL, po polsku: "<plik:linia> — <zrodlo A> mowi …, <zrodlo B> mowi … → wybrano …; cofniecie: …"' },
  },
  required: ['id', 'status'],
}

// Bramki domkniecia (PLAN-POPRAWY P6): kolejnosc i nazwy jak w kolejce .claude/scripts/bramki/bramki.mjs.
const NAZWY_BRAMEK = ['typecheck', 'eslint', 'testyTypow', 'knip', 'sizeLimit', 'stack', 'migracje', 'migracjeSuma', 'testyUsuniete', 'stryker']
const STATUS_BRAMKI = { type: 'string', enum: ['ok', 'porazka', 'brak', 'blad', 'pominieta'] }
const WYNIK_BRAMKI = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: STATUS_BRAMKI,
    sekundy: { type: ['number', 'null'] },
    trafienia: { type: 'integer', description: 'liczba trafien' },
    poNaprawie: { type: ['string', 'null'], enum: [...STATUS_BRAMKI.enum, null] },
  },
  required: ['status', 'sekundy', 'trafienia'],
}
// Dossier fazy dla review (PLAN-POPRAWY P7) — kopia schematu KONTEKST z dev-docs-review-wf.js (workflowy sa self-contained;
// zgodnosc pilnuje domkniecie-bramki.test.mjs). Review liczy z niego routing reviewerow bez agenta context-packagera.
const DOSSIER = {
  type: ['object', 'null'],
  description: 'wynik JSON skryptu dossier 1:1; null gdy skrypt padl',
  additionalProperties: false,
  properties: {
    diffStat: { type: 'string', description: 'liczba plikow i linii fazy, np. "4 plikow, +12 −3"' },
    pliki: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plik: { type: 'string' },
          czegoDotyczy: { type: 'string', description: 'status pliku i liczby linii, np. "dodany (+12)"' },
        },
        required: ['plik', 'czegoDotyczy'],
      },
    },
    warstwy: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ui: { type: 'boolean', description: 'faza tyka warstwy prezentacji: sciezki UI wg .claude/stack/buildery.md, sekcja „Ścieżki warstw”' },
        dane: { type: 'boolean', description: 'faza tyka danych/IO: SQL, migracje, zapytania, fetch/HTTP, cache, petle po rekordach, praca na plikach' },
        typowanie: { type: 'boolean', description: 'w diffie sa pliki .ts/.tsx ALBO projekt ma tsconfig.json (statyczne typowanie w gre)' },
        nowyModul: { type: 'boolean', description: 'faza dodaje nowy modul/plik zrodlowy albo przesuwa granice warstw (nie: edycja istniejacego pliku)' },
      },
      required: ['ui', 'dane', 'typowanie', 'nowyModul'],
    },
    e2eCheckboxy: { type: 'integer', description: 'liczba NIEZAZNACZONYCH checkboxow [E2E] tej fazy (prefiksy Test: ORAZ Weryfikacja:) wymagajacych srodowiska E2E i narzedzia jazdy testera (0 gdy brak)' },
    figmaScreens: { type: 'boolean', description: 'czy plik kontekstu zadania ma niepuste pole figma_screens (mapa ekran -> mockup) — tester robi wtedy visual diff nawet bez checkboxow [E2E]' },
    diffPlik: { type: 'string', description: 'sciezka zrzutu diffu fazy (pusty string gdy zrzut sie nie udal)' },
    ctxPlik: { type: 'string', description: 'sciezka dossier fazy (pusty string gdy zapis sie nie udal)' },
    ctxZapisany: { type: 'boolean', description: 'true tylko gdy dossier realnie powstalo i jest niepuste' },
    ctxZnaki: { type: 'integer', description: 'liczba znakow dossier fazy (telemetria: faza.dossier_zn)' },
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
    wiedza: {
      type: 'object',
      additionalProperties: false,
      description: 'wiedza projektu w dossier (telemetria: faza.wiedza)',
      properties: {
        indeksZn: { type: ['integer', 'null'], description: 'znaki docs/learned-patterns.md (null gdy brak pliku)' },
        claudeMdZn: { type: ['integer', 'null'], description: 'znaki CLAUDE.md projektu (null gdy brak pliku)' },
        wycinekZn: { type: 'integer', description: 'znaki wycinka regul dla plikow fazy' },
        wycinekWpisy: { type: 'integer', description: 'reguly w wycinku' },
        wycinekPominiete: { type: 'integer', description: 'reguly dopasowane, ale poza limitem wycinka' },
      },
      required: ['indeksZn', 'claudeMdZn', 'wycinekZn', 'wycinekWpisy', 'wycinekPominiete'],
    },
  },
  required: ['pliki', 'warstwy', 'e2eCheckboxy'],
}

const EXECUTE_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fazaNumer: { type: 'integer' },
    status: { type: 'string', enum: ['completed', 'partial', 'blocked'] },
    iu: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          nazwa: { type: 'string' },
          subagent: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['id', 'status'],
      },
    },
    commity: { type: 'array', items: { type: 'string' } },
    testy: { type: 'string', description: 'PASS/FAIL z liczbami lub "brak"' },
    odchylenia: { type: 'array', items: { type: 'string' } },
    problem: { type: ['string', 'null'], description: 'null przy completed; inaczej po polsku, prostym jezykiem: co nie przeszlo i gdzie, co operator moze z tym zrobic' },
    bramki: {
      type: 'object',
      additionalProperties: false,
      description: 'pierwszy przebieg skryptu bramek; poNaprawie = status z przebiegu po naprawie (null gdy nie bylo)',
      properties: Object.fromEntries(NAZWY_BRAMEK.map((n) => [n, WYNIK_BRAMKI])),
    },
    testyUsuniete: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { plik: { type: 'string' }, nazwa: { type: 'string' }, uzasadnienie: { type: 'string' } },
        required: ['plik', 'nazwa', 'uzasadnienie'],
      },
    },
    dossier: DOSSIER,
    stanZapisany: { type: ['boolean', 'null'], description: 'true po zapisie pliku stanu i odczycie z wynikiem JSON-OK' },
  },
  required: ['fazaNumer', 'status', 'iu', 'stanZapisany'],
}

// Punkt 41, krok 6 (aa-exam E3, wf_1c69a604-076): scenariusz wymagal imienia w mailu, makieta i teksty go nie mialy — builder
// stanal, a faza z nim. Cel operatora: autopilot przechodzi calosc. Builder rozstrzyga sprzecznosc zrodel sam, gdy wybor jest
// zgodny z wyzszym zrodlem, niczego nie dodaje i da sie go cofnac; wybor idzie jako decyzja autopilota do known-issues
// (sekcja „Decyzje operatora”), a stamtad do „Decyzji przed PR” w smoke'u (punkt 40). STOP zostaje dla nieodwracalnego i pracy
// spoza Granic (decyzja operatora 2026-11-11). Blok doklejany w JS kazdemu builderowi, jak PYTANIE BLOKERA.
const BLOK_HIERARCHIA_ZRODEL = `
HIERARCHIA ZRODEL (gdy zrodla jednostki mowia co innego): Granice zakresu > makieta i Teksty (verbatim) > Kluczowe decyzje
i pole „Znika z obecnej wersji” > Podejscie > Scenariusze testowe > obecny kod i wzorce. Przy sprzecznosci wybierasz opcje zgodna
z wyzszym zrodlem, gdy (a) niczego nie dodaje ponad zrodla (nowego tekstu, pola danych, zaleznosci, zachowania) i (b) da sie ja
cofnac zwykla zmiana kodu. Scenariusz testowy dopasowujesz do wybranej opcji (test sprawdza zachowanie, ktore zostawiasz).
Kazdy taki wybor wpisujesz do pola decyzje, po polsku: "<plik:linia> — <zrodlo A> mowi …, <zrodlo B> mowi … → wybrano …;
cofniecie: …". Operator potwierdzi go albo zmieni w smoke'u, a review nie traktuje go jako bledu.
Status blocked zostaje tylko, gdy: zadna opcja nie spelnia (a) i (b); wybor jest nieodwracalny albo dotyka danych (migracja
zmieniajaca lub usuwajaca dane), bezpieczenstwa (uwierzytelnienie, uprawnienia, polityki dostepu) albo pieniedzy (platnosci,
kwoty); bez pracy wykluczonej w Granicach jednostki nie da sie ukonczyc. Gdy elementu wykluczonego w Granicach zada tylko nizsze
zrodlo (Podejscie, scenariusz, obecny kod albo wzorzec), a reszte jednostki da sie zrobic bez niego: pomijasz element, dopasowujesz
scenariusz i wpisujesz wybor do pola decyzje (np. scenariusz chce imienia w mailu, a Granice zabraniaja tekstow spoza makiet →
mail bez imienia jako decyzja, nie blocked).`

// Pytanie blokera idzie 1:1 do powodu STOP-u, ktory operator czyta bez kontekstu buildera (punkt 41, aa-exam E3: pytanie po
// angielsku, bez opcji). Blok doklejany w JS, wiec obowiazuje kazdego buildera kazdego stacku niezaleznie od plannera i pliku roli.
const BLOK_PYTANIE_BLOKERA = `
PYTANIE BLOKERA (gdy zwracasz status blocked): pole pytanie czyta operator w raporcie zatrzymania, bez dostepu do twojego
kontekstu. Piszesz je po polsku, prostym jezykiem, w tej kolejnosci: (1) co blokuje prace i gdzie (jednostka, plik, pole planu
albo makieta), (2) opcje do wyboru, kazda z jednym zdaniem skutku, (3) ktora opcje rekomendujesz i dlaczego. Bez skrotow
z twojej pracy i bez nazw, ktorych operator nie zna z planu.
Pole pliki wypelniasz takze przy blocked i partial: kazdy plik, ktory zdazyles utworzyc albo zmienic (pusta lista, gdy zadnego).
Orkiestrator odklada te pliki do schowka gita, a jednostki ukonczone przed toba zapisuje commitem.`

// ── Wznowienie po przerwanym execute (znaleziska szablonu, punkt 34) ─────────
// aa-exam E3 (wf_1c69a604-076, faza 3): IU-10 i IU-11 ukonczone, IU-12 `blocked` — execute wrocil bez commita, 26 pozycji
// zostalo w drzewie, swiezy run stanal na bramce czystosci, a faze zbudowano od nowa. Jednostki ukonczone zapisuje teraz
// domkniecie czesciowe, ich lista wraca do stanu zadania (pole fazy `iuUkonczone`), a nastepny run zaczyna od przerwanej.
const CZESCIOWE_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    zacommitowano: { type: 'boolean', description: 'true tylko po zielonej walidacji i udanym commicie jednostek ukonczonych' },
    commit: { type: ['string', 'null'], description: 'SHA commita jednostek ukonczonych; null, gdy go nie ma' },
    schowek: { type: ['string', 'null'], description: 'nazwa wpisu `git stash` z plikami jednostki nieukonczonej; null, gdy nic nie odlozono albo pliki wrocily do drzewa' },
    plikiOdlozone: { type: 'array', items: { type: 'string' } },
    walidacja: { type: 'string', description: 'PASS/FAIL z liczbami' },
    powod: { type: ['string', 'null'], description: 'null przy zacommitowano=true; inaczej po polsku, prostym jezykiem: dlaczego jednostek nie zapisano' },
  },
  required: ['zacommitowano', 'commit', 'schowek', 'plikiOdlozone', 'walidacja', 'powod'],
}

// Klucz jednostki niezalezny od zapisu id (planner: "IU-12", builder: "12").
function kluczIu(id) {
  return String(id == null ? '' : id).toLowerCase().replace(/^iu[\s-]*/, '').trim()
}

// Jednostki ukonczone w poprzednim podejsciu (args.iuUkonczone ze stanu zadania) odpadaja z listy plannera w JS: checkboxy md
// odhacza dopiero domkniecie, wiec planner bez tej listy zbudowalby je drugi raz.
function bezUkonczonych(jednostki, ukonczone) {
  const zrobione = new Set((Array.isArray(ukonczone) ? ukonczone : []).map(kluczIu))
  return jednostki.filter((iu) => !zrobione.has(kluczIu(iu.id)))
}

// Co da sie zapisac przy przerwanym execute. Odmowa zostawia drzewo jak dotad (STOP na bramce czystosci nastepnego runu):
// - builder bez wyniku albo bez listy plikow przy strategii serial mogl zmienic pliki wczesniejszych jednostek,
// - plik wspolny jednostki ukonczonej i nieukonczonej nie da sie rozdzielic na commit i schowek.
function planCzesciowegoDomkniecia(plan, buildResults) {
  const ukonczone = buildResults.filter((b) => b.status === 'completed')
  const przerwane = buildResults.filter((b) => b.status !== 'completed')
  const zwrocone = new Set(buildResults.map((b) => kluczIu(b.id)))
  const bezWyniku = plan.iu.filter((iu) => !zwrocone.has(kluczIu(iu.id))).map((iu) => iu.id)
  const odmowa = (powod) => ({ mozna: false, powod, ukonczone: [], nieukonczone: [] })
  if (!ukonczone.length) return odmowa('zadna jednostka fazy nie jest ukonczona')
  const bezPlikow = ukonczone.filter((b) => !Array.isArray(b.pliki) || !b.pliki.length).map((b) => b.id)
  if (bezPlikow.length) return odmowa(`jednostka ukonczona bez listy plikow: ${bezPlikow.join(', ')}`)
  const nieznanePliki = przerwane.filter((b) => !Array.isArray(b.pliki)).map((b) => b.id)
  // Serial konczy petle na pierwszym `blocked` albo na builderze bez wyniku: po `blocked` brakujace jednostki nie wystartowaly,
  // bez `blocked` pierwsza brakujaca to builder zabity w trakcie pracy. Parallel: jednostki niezalezne, pliki rozlaczne.
  const serial = plan.strategia !== 'parallel'
  const zabite = serial ? (przerwane.some((b) => b.status === 'blocked') ? [] : bezWyniku.slice(0, 1)) : bezWyniku
  const niewiadome = [...nieznanePliki, ...(serial ? zabite : [])]
  if (serial && niewiadome.length) {
    return odmowa(`nie wiadomo, ktore pliki zmienila jednostka ${niewiadome.join(', ')} (brak wyniku albo listy plikow), a przy kolejnosci serial mogla zmienic pliki wczesniejszych`)
  }
  const plikiUkonczonych = new Set(ukonczone.flatMap((b) => b.pliki))
  const wspolne = [...new Set(przerwane.flatMap((b) => b.pliki || []).filter((f) => plikiUkonczonych.has(f)))]
  if (wspolne.length) return odmowa(`plik zmieniony przez jednostke ukonczona i nieukonczona: ${wspolne.join(', ')}`)
  return {
    mozna: true,
    powod: null,
    ukonczone: ukonczone.map((b) => ({ id: b.id, pliki: b.pliki })),
    nieukonczone: [...przerwane.map((b) => `${b.id} (${b.status})`), ...bezWyniku.map((id) => `${id} (${zabite.includes(id) ? 'bez wyniku' : 'nie zaczeta'})`)],
  }
}

function nazwaSchowka(sciezka, faza) {
  return `autopilot/${String(sciezka).replace(/\/+$/, '').split('/').pop()}/faza-${faza}`
}

function domkniecieCzesciowePrompt(sciezka, faza, czesc, baza) {
  const schowek = nazwaSchowka(sciezka, faza)
  return `Jestes domknieciem czesciowym fazy implementacji. Execute przerwal sie na jednostce, ktora czeka na decyzje operatora
albo nie zwrocila wyniku. Zapisujesz jednostki ukonczone, zeby nastepny run zaczal od przerwanej zamiast budowac faze od nowa.

Folder zadania: ${sciezka}
Faza: ${faza}

Jednostki ukonczone i ich pliki:
${czesc.ukonczone.map((u) => `- ${u.id}: ${u.pliki.join(', ')}`).join('\n')}
Jednostki nieukonczone: ${czesc.nieukonczone.join(', ')}

1. \`git status --porcelain --untracked-files=all\`. Zmienione pliki dzielisz na trzy grupy: (a) pliki jednostek ukonczonych
   z listy wyzej, (b) pliki w ${sciezka}/, (c) reszta — praca jednostki nieukonczonej. Plik z listy, ktorego nie ma w wyniku
   git status, pomijasz. Lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lock, bun.lockb) idzie do grupy
   manifestu package.json z tego samego katalogu: manifest w (a) → lockfile w (a); bez manifestu w (a) lockfile zostaje w (c).
2. Pliki (c) odkladasz do schowka jedna komenda, z nazwami plikow po \`--\`. Nazwa: "${schowek}"; gdy \`git stash list\` ma juz
   wpis o tej nazwie (drugi STOP tej samej fazy), uzyj kolejnego numeru: "${schowek}#2", "${schowek}#3" itd.
   \`git stash push --include-untracked -m "<nazwa>" -- <pliki (c)>\`. Bez plikow (c) krok pomijasz (schowek = null).
   W polu schowek zwracasz nazwe, ktorej faktycznie uzyles.
3. Walidacja na drzewie bez plikow (c): typecheck i testy projektu (komendy z package.json, szczegoly stacku w
   .claude/stack/walidacja.md). Niczego nie naprawiasz i nie zmieniasz kodu: czerwona walidacja znaczy, ze jednostki ukonczone
   nie stoja bez przerwanej. Wtedy przywroc pliki (c) (\`git stash pop\`, gdy schowek powstal), sprawdz w git status, ze
   wrocily, i zakoncz: zacommitowano=false, schowek=null, w powod nazwa walidacji i pierwszy blad.
${BLOK_DLUGIE_KOMENDY}
4. Zielona walidacja: w ${sciezka}/*-zadania.md oznacz [x] checkboxy implementacyjne jednostek ukonczonych (nie ruszaj
   "Weryfikacja:", "Operator:" ani checkboxow z markerem [E2E]/[Manual]). W ${sciezka}/*-kontekst.md dopisz do \`## Dziennik\`
   jedna linie: faza ${faza} przerwana, jednostki ukonczone i zapisane, jednostki nieukonczone, nazwa schowka (gdy powstal).
5. Commit: \`git add\` wylacznie pliki (a) i dwa pliki z punktu 4 (nie git add .), potem
   \`git commit -m "feat(<nazwa zadania>): faza ${faza}, jednostki <lista ukonczonych> (execute przerwany)"\`.
5a. Commit odrzucony mimo zielonej walidacji (np. hook): niczego nie poprawiasz; \`git stash pop\` (gdy schowek powstal) i
   zakoncz: zacommitowano=false, schowek=null, w powod tresc bledu commita.
   Nieudany \`git stash pop\` (tu albo w punkcie 3): nie probuj dalej (bez reset, checkout ani drop); zakoncz z zacommitowano=false,
   schowek = nazwa (wpis zostaje w git stash list), w powod "schowek <nazwa> nie wrocil do drzewa: git stash list" i blad gita.
6. Bramek mechanicznych i dossier nie uruchamiasz: zrobi je domkniecie calej fazy, liczone od bazy ${baza}.

Zwroc obiekt zgodny ze schematem: zacommitowano, commit (SHA), schowek (faktyczna nazwa schowka albo null), plikiOdlozone (pliki (c)),
walidacja, powod (null przy zacommitowano=true).`
}

// Decyzje builderow (HIERARCHIA ZRODEL) z prefiksem jednostki. Builder zablokowany nie daje decyzji (jego pliki ida do schowka
// gita). `tylkoUkonczone` (weryfikacja partii, punkt 48): przy przerwaniu pliki buildera `partial` ida do schowka razem z jednostka
// przerwana, wiec jego decyzje opisywalyby kod spoza repo — do zapisu po przerwaniu ida tylko decyzje jednostek ukonczonych.
// Funkcje czyste (walidacja 51–55, punkt 60): testy wykonuja je na danych, nie dopasowuja tekstu orkiestracji.
function decyzjeBuilderow(buildResults, tylkoUkonczone) {
  return buildResults.filter((b) => (tylkoUkonczone ? b.status === 'completed' : b.status !== 'blocked'))
    .flatMap((b) => (Array.isArray(b.decyzje) ? b.decyzje : []).map((d) => String(d).trim()).filter(Boolean).map((d) => `${b.id}: ${d}`))
}

// Wynik execute po domknieciu. Weryfikacja partii 26–45, punkt 54: domkniecie bez wyniku (agent padl albo zostal przerwany)
// zwracalo null — autopilot zostawial stan z baza: null (swiezy run liczylby review od galezi glownej), a decyzje autopilota
// przepadaly. Bez wyniku: obiekt zgodny z EXECUTE_RESULT, status partial — autopilot zapisuje baze i robi STOP jak przy kazdym
// execute bez „completed”.
function wynikDomkniecia(wynik, faza, buildResults, baza, decyzjeAutopilota) {
  if (!wynik) {
    return {
      fazaNumer: faza,
      status: 'partial',
      iu: buildResults.map((b) => ({ id: b.id, status: b.status })),
      commity: [],
      testy: 'n/a',
      odchylenia: [],
      problem: 'domkniecie fazy nie zwrocilo wyniku (agent padl albo zostal przerwany) — commit fazy mogl juz powstac: sprawdz git log i git status',
      baza,
      decyzjeAutopilota,
    }
  }
  return { ...wynik, baza, decyzjeAutopilota }
}

// Wynik execute przerwanego przed domknieciem: baza fazy zawsze (bez niej commit resztek z drzewa gubi poczatek fazy),
// a po udanym domknieciu czesciowym lista jednostek ukonczonych — wczesniejszych i z tego podejscia.
function wynikPrzerwanego(pola, plan, wczesniej, czesc, czesciowe) {
  const zapisane = Boolean(czesciowe && czesciowe.zacommitowano)
  const baza = bazaFazy(plan)
  return {
    ...pola,
    commity: zapisane && czesciowe.commit ? [czesciowe.commit] : [],
    testy: 'n/a',
    odchylenia: [],
    baza: baza === 'HEAD' ? null : baza,
    iuUkonczone: zapisane ? [...wczesniej, ...czesc.ukonczone.map((u) => u.id)] : wczesniej,
    czesciowe: czesc.mozna
      ? czesciowe || { zacommitowano: false, commit: null, schowek: null, plikiOdlozone: [], walidacja: 'n/a', powod: 'agent domkniecia czesciowego nie zwrocil wyniku — sprawdz git status i git stash list' }
      : { zacommitowano: false, commit: null, schowek: null, plikiOdlozone: [], walidacja: 'n/a', powod: czesc.powod },
  }
}
// ── Koniec wznowienia po przerwanym execute

// ── Buildery promptow ──────────────────────────────────────────────────────

function plannerPrompt(sciezka, faza, ukonczone = []) {
  return `Jestes plannerem fazy implementacji. Zbuduj liste Implementation Units gotowych do delegacji.

Folder zadania: ${sciezka}
Faza do wykonania: ${faza}

0. \`git rev-parse HEAD\` -> pole baza (pelny SHA). To commit sprzed fazy: bramki domkniecia licza od niego zmiany fazy.
1. CZYTAJ WYCINKAMI, NIE CALYMI PLIKAMI. Cztery dokumenty tego zadania to lacznie 120-175 KB, a plik
   zadan rosnie w trakcie jednego zadania z 23 KB do 59 KB (sekcje "Do poprawy po review") i jest czytany
   przy KAZDEJ fazie. Do zbudowania jednostek fazy ${faza} potrzebujesz pieciu wycinkow. Kazdy bierz
   przez \`grep -n\` naglowka, a potem \`Read\` z \`offset\` i \`limit\` — nigdy nie ladujesz calego pliku:
   - z \`${sciezka}/*-plan.md\`: tabela \`## Fazy\` i linia \`Plan techniczny:\` (sciezka planu technicznego),
   - z \`${sciezka}/*-zadania.md\`: blok od \`## Faza ${faza}\` do NASTEPNEGO naglowka tego samego poziomu,
   - z \`${sciezka}/*-kontekst.md\`: sekcja \`## Designerski kontekst\`,
   - z planu technicznego w \`docs/plans/\`: sekcja \`### Faza ${faza}\` (tam sa Implementation Units tej fazy),
   - z planu technicznego: sekcja zaczynajaca sie od \`## Granice\` (wykluczenia zadania), jesli plan ja ma.
   Po wiecej siegaj TYLKO wtedy, gdy jednostka odsyla do czegos, czego w tych wycinkach nie ma
   (np. decyzja opisana przy innej fazie). Nie czytaj dokumentow "dla kontekstu".
2. W sekcji \`### Faza ${faza}\` planu technicznego zlokalizuj Implementation Units tej fazy.
${ukonczone.length ? `   Jednostki zapisane commitem w poprzednim, przerwanym podejsciu do tej fazy: ${ukonczone.join(', ')}. Pomijasz je
   (nie budujesz dla nich promptu), takze gdy ich checkboxy nie sa odhaczone.
` : ''}3. Jesli faza ${faza} jest juz ukonczona albo nie ma niezaznaczonych checkboxow IMPLEMENTACYJNYCH -> ustaw poza=true, iu=[].
   Do ukonczenia NIE licza sie (pomijaj calkowicie): checkboxy z prefiksem "Weryfikacja:", "Operator:",
   oznaczone "[E2E]"/"[Manual]", oraz wszystkie checkboxy w sekcjach "## Do poprawy po review fazy N"
   i "## Operator checklist faza N" (obsluguje je review/fix, nie buildery).
4. Wybierz strategie: serial (IU zalezne / wspolne pliki) lub parallel (IU niezalezne).
   Jesli ktorykolwiek IU dodaje nowa zaleznosc (biblioteka, config runnera testow albo builda) — preferuj serial:
   rownolegle zimne biegi runnera po inwalidacji cache duplikuja wielominutowa prace i ryzykuja watchdog-kill
   (czas zimnego biegu tego stacku: .claude/stack/walidacja.md, sekcja „Zimny runner”).
   Jesli ktorykolwiek IU ma migracje bazy albo generuje typy bazy — strategia serial: buildery danych stosuja migracje
   na jednej lokalnej bazie i nadpisuja ten sam plik typow.
   Jesli IU korzysta z pliku, ktory tworzy inny IU tej fazy (hook, serwis, schemat, typy) — strategia serial i IU tworzacy
   plik przed IU, ktory go uzywa: przy parallel import jeszcze nie istnieje i typecheck buildera pada.
   Jesli IU usuwa plik, ktorego importera zmienia albo usuwa inny IU tej fazy — strategia serial i IU usuwajacy plik
   po IU, ktory zmienia importera: builder nie usunie pliku z zywym importem i faza skonczy sie jako partial.
5. Dla kazdego IU zbuduj KOMPLETNY prompt builderowi:
   - caly blok IU doslownie (Cel, Wymagania, Pliki, Podejscie, Teksty (verbatim), Znika z obecnej wersji, Wzorce, Scenariusze testowe, Weryfikacja)
   - DOMKNIJ ODWOLANIA DO DECYZJI. Builder pracuje w OSOBNYM kontekscie i nie widzi planu: odwolanie
     w rodzaju "straznik regresji D2" albo "zgodnie z decyzja D7" jest dla niego pustym stringiem.
     Dla KAZDEGO takiego odwolania w jednostce znajdz jego definicje w sekcji kluczowych decyzji planu
     technicznego i SKOPIUJ ja do promptu jako blok "Decyzje przywolane przez to IU:" (identyfikator + tresc).
     Udokumentowany skutek pominiecia: builder fazy 6 sam wyszukiwal plik checklisty i zostawil o tym
     komentarz w kodzie (cta-section.ts:26) — robil prace plannera, w polowie slepo.
     Podobnie z tekstami: gdy jednostka odsyla do "tekstow verbatim z sekcji X", wklej te teksty DOSLOWNIE.
     Nie streszczaj i nie parafrazuj — tekst widoczny dla uzytkownika inny niz zatwierdzony to finding P2.
   - sciezka zadania ${sciezka} + numer IU
   - gdy IU korzysta z plikow tworzonych przez inne IU tej fazy: blok "Pliki innych jednostek tej fazy:" z linia
     \`<id IU>: <sciezki z jego pola Pliki>\` dla kazdego takiego IU, bo builder nie widzi planu i bez tego bloku nie wie,
     ze hook albo serwis, ktorego jeszcze nie ma w repo, powstaje w tej fazie.
   - reguly projektu i klasy bledow dla plikow jednostki (z pola Pliki):
     \`node .claude/scripts/wiedza/wiedza.mjs wycinek --zapobieganie --pliki <pliki jednostki po przecinku>\`. Niepuste pole
     \`tresc\` wyniku wklej doslownie jako blok "Reguly projektu i klasy bledow dla plikow jednostki:" (pusta tresc — blok
     pomin), bo regula wklejona do promptu delegacji jest przez buildera stosowana, a regula czekajaca w pliku bywa pomijana.
   - wykluczenia z sekcji \`## Granice\` planu technicznego jako blok "Czego zadanie nie obejmuje:" z dopiskiem:
     "Niczego z tej listy nie implementuj, nawet gdy wyglada na przydatne. Gdy jednostka wymaga takiej pracy,
     zwroc status blocked i w polu pytanie nazwij te prace (wyjatek: element zadany tylko przez nizsze zrodlo — HIERARCHIA ZRODEL)."
     Plan bez tej sekcji — blok pomin.
   - gdy IU ma pole "Znika z obecnej wersji" z lista elementow (nie sama kreska): pod polem dopisz zdanie
     "Elementow z decyzja „znika” nie przenosisz z obecnego pliku ani ze wzorca, takze gdy obecny kod albo wzorzec je zawiera.
     Gdy Podejscie albo scenariusz jednostki wymaga takiego elementu, wygrywa decyzja „znika” (HIERARCHIA ZRODEL): nie przenosisz
     elementu, dopasowujesz scenariusz i wpisujesz wybor do pola decyzje."
     Bez tego zdania builder bierze obecny plik za wzorzec i przenosi element, ktory operator kazal usunac.
   - dla feature-builder-ui|fullstack (takze wariantow -figma): gdy sekcja "Designerski kontekst" w ${sciezka}/*-kontekst.md istnieje
     i ma choc jedna niepusta sciezke, uruchom \`node .claude/scripts/plan/plan.mjs designerski <sciezka z linii "Plan techniczny:"> --iu <id IU>\`
     i niepuste pole \`tresc\` wyniku wklej doslownie (pusta — blok pomin). Skrypt daje DESIGN.md, SPEC.md oraz SPEC i PNG tylko ekranow
     z pola Makiety jednostki (bez pola — wszystkie ekrany i caly SPEC), bo builder czytajacy caly SPEC i wszystkie zrzuty niesie je
     w kontekscie przez kazda ture. Kolejnosc zrodel i brakujace pomiary rozstrzyga builder (jego plik roli). Dla feature-builder-data blok pomijasz zawsze.
   - NIE kopiuj "Skills in play:" — skille sa wstrzykiwane z frontmatter subagenta.
   - agentType = wartosc pola "Delegate to:" z IU. IU bez tego pola (plan starszy niz delegacja) — dobierz
     agentType po plikach jednostki: tylko warstwa danych -> feature-builder-data, tylko UI -> feature-builder-ui,
     obie -> feature-builder-fullstack.
     Gdy sekcja "Designerski kontekst" ma niepuste figma_spec albo figma_screens, builder UI i fullstack bierzesz
     w wariancie z Figma: feature-builder-ui-figma, feature-builder-fullstack-figma (tylko one maja narzedzia Figma MCP).
   Zakres checkboxow, testy razem z kodem i nowe zaleznosci w odchyleniach ma kazdy builder w pliku roli, a zasady
   dlugich komend dokleja orkiestrator — tych blokow nie dopisujesz.

Zwroc obiekt zgodny ze schematem IUPlan. Sam nie implementuj kodu.`
}

// Baza fazy dla bramek domkniecia: SHA z plannera (HEAD przed builderami). Bez poprawnego SHA — HEAD domkniecia:
// buildery nie commituja, wiec zmiany fazy i tak sa w drzewie roboczym. Wartosc trafia do komendy powloki.
function bazaFazy(plan) {
  return /^[0-9a-f]{7,40}$/.test(plan.baza || '') ? plan.baza : 'HEAD'
}

// Stan zadania po execute (P7): autopilot podaje go w args.stanPoExecute, JS wstawia baze fazy, domkniecie zapisuje plik.
// Baza w stanie pozwala odtworzyc dossier fazy po STOP-ie miedzy execute a review (args.baza review-wf).
function stanZBaza(tresc, faza, baza) {
  const stan = JSON.parse(tresc)
  const sha = /^[0-9a-f]{7,40}$/.test(baza) ? baza : null
  return JSON.stringify({ ...stan, fazy: stan.fazy.map((f) => (f.numer === faza ? { ...f, baza: sha } : f)) }, null, 2)
}

// Kopia blokZapisuStanu z dev-autopilot-wf.js (workflow nie importuje modulow; zgodnosc pilnuje stan-fazy.test.mjs).
function blokZapisuStanu(sciezka, tresc) {
  const plik = `${sciezka}/.autopilot-state.json`
  return `Zapis stanu pipeline'u:
a) Narzedziem Write zapisz plik ${plik} (pelne nadpisanie) z trescia miedzy znacznikami, bez znacznikow
   i bez zmian w tresci. Plik zwykle juz istnieje: Write wymaga wczesniejszego Read, wiec przeczytaj go i nadpisz. Inna tresc na dysku to poprzedni stan,
   ktory wlasnie zastepujesz — nie sprawdzasz jej i nie porownujesz z historia gita.
b) Odczytaj plik z dysku: \`node -e "JSON.parse(require('fs').readFileSync('${plik}','utf8'));console.log('JSON-OK')"\`.
   Bez wyniku JSON-OK zapisz plik jeszcze raz i powtorz odczyt.
c) Pole stanZapisany w wyniku: true po odczycie z wynikiem JSON-OK, w kazdym innym przypadku false.
Z tego pliku pipeline wznawia fazy po zatrzymaniu, dlatego tresc idzie na dysk bajt w bajt.
--- POCZATEK STANU ---
${tresc}
--- KONIEC STANU ---`
}

function punktZapisuStanu(sciezka, faza, baza, stanPoExecute) {
  if (!stanPoExecute) return ''
  return `\n\nZAPIS STANU (po punkcie 6), gdy zwracasz status=completed; przy innym statusie pomin go i zwroc stanZapisany=false.
${blokZapisuStanu(sciezka, stanZBaza(stanPoExecute, faza, baza))}`
}

// Wynik bramek w pliku artefaktow fazy (wzor nazwy jak w .claude/scripts/dossier/sciezki.mjs): kazdy przebieg bramek go
// nadpisuje, wiec skrypt dossier bierze ostatni — kod po naprawie, ktory ogladaja reviewerzy.
function plikBramek(sciezka, faza) {
  return `/tmp/bramki-${String(sciezka).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-faza-${faza}.json`
}

// Decyzje autopilota w domknieciu (weryfikacja partii 2026-11-11, punkt 48): builder dopasowal test do wybranej opcji, a domkniecie
// znalo tylko status, odchylenia i nastepne kroki — przy checkboxie "Test:" z pierwotnym scenariuszem mialo polecenie dopisac
// brakujacy test, czyli przywrocic zrodlo, ktore przegralo (sprzecznosc zapisana przy punkcie 41: „domkniecie dopisujace testy”).
function decyzjeBlok(decyzje) {
  if (!decyzje.length) return ''
  return `DECYZJE AUTOPILOTA tej fazy (builder rozstrzygnal sprzecznosc zrodel planu wg hierarchii zrodel; operator potwierdzi wybor
albo go zmieni w smoke'u):
${decyzje.map((d) => `- ${d}`).join('\n')}
Wybor obowiazuje takze Ciebie. Checkbox "Test:", ktorego scenariusz builder dopasowal do wybranej opcji, zalicza test tej opcji:
nie dopisujesz testu pierwotnego scenariusza i nie przywracasz w kodzie tego, z czego builder zrezygnowal. Brak takiego testu
albo zachowania nie jest powodem statusu partial. Tresci pozycji w pliku zadan i w planie nie zmieniasz.
`
}

function domknieciePrompt(sciezka, faza, buildResults, baza, plikBramek, wczesniej = [], decyzje = []) {
  const podsumowanieIU = buildResults
    .map((b) => `- ${b.id}: ${b.status}${b.odchylenia && b.odchylenia.length ? ` (odchylenia: ${b.odchylenia.join('; ')})` : ''}${b.nastepneKroki ? ` (nastepne kroki: ${b.nastepneKroki})` : ''}`)
    .join('\n')
  return `Jestes domknieciem fazy implementacji. Buildery skonczyly — zwaliduj i utrwal.

Folder zadania: ${sciezka}
Faza: ${faza}

Raporty builderow:
${podsumowanieIU || '(brak — w tym podejsciu zaden builder nie pracowal; walidujesz i domykasz stan repo od bazy fazy)'}
${wczesniej.length ? `Jednostki zapisane commitem w poprzednim, przerwanym podejsciu (kod jest juz w repo, checkboxy odhaczone): ${wczesniej.join(', ')}.\nWalidacja, bramki i dossier obejmuja cala faze od bazy.\n` : ''}${decyzjeBlok(decyzje)}
1. System-Wide Test Check: typecheck bez nowych bledow,
   istniejace testy przechodza, nowe testy pokrywaja happy path + error case, checkboxy "Test:" napisane i przechodza,
   importy nie lamia modulow, build (krok build wg .claude/stack/walidacja.md) przechodzi. Komendy z package.json.
   Checkbox "Test:" tej fazy bez napisanego testu — napisz ten test przed zamknieciem fazy ("Test: [E2E]" pomijasz,
   patrz punkt 2). Kazde sprawdzenie z odpowiedzia "nie" naprawiasz przed commitem.
   UWAGA: jesli ktorykolwiek builder raportowal dodanie zaleznosci — pierwszy bieg testow jest ZIMNY (procedura tla z bloku).
1a. BRAMKI MECHANICZNE (po punkcie 1, przed commitem — skrypt czyta drzewo robocze):
   \`node .claude/scripts/bramki/bramki.mjs --baza ${baza} > ${plikBramek}; echo "kod: $?"\`, potem Read ${plikBramek}.
   Kod 0 = bez porazek, 1 = sa porazki. Wynik (JSON w pliku): {bramka: {status, sekundy, trafienia: [{plik, linia, regula,
   opis}], powod?, ostrzezenia?, zastane?}}. Status: ok | porazka | brak | blad | pominieta.
   - porazka: napraw KAZDE trafienie w kodzie — regula i plik:linia mowia, co poprawic. Lista bramek jest kompletna:
     Nie uruchamiaj ESLint, tsc ani knipa osobno i nie szukaj innych uwag lintera. Nie wylaczasz reguly (eslint-disable,
     zmiana konfiguracji narzedzia) — poprawiasz kod. Trafienie bramki migracje albo migracjeSuma: przywroc plik
     (\`git checkout ${baza} -- <plik>\`), a zmiane schematu zapisz NOWA migracja.
   - Po naprawie uruchom bramki jeszcze raz ta sama komenda. Porazka w drugim przebiegu: status=partial, w problem nazwa bramki i trafienia.
   - blad: narzedzie padlo — powod do odchylen, narzedzia nie naprawiasz. brak, pominieta: nic nie robisz.
   - Pole bramki: dla kazdej bramki z PIERWSZEGO przebiegu {status, sekundy, trafienia: liczba trafien}, poNaprawie =
     status z drugiego przebiegu (null, gdy drugiego nie bylo).
   - ostrzezenia bramki eslint i trafienia bramki stryker zostawiasz bez naprawy — review fazy dostaje
     je w dossier (punkt 6).
   - ostrzezenia bramki stack to stan sprzed fazy (np. paczki z rozjazdem wersji, ktorych faza nie zmienila): nie naprawiasz
     ich i nie zmieniasz przez nie zaleznosci — przepisz je do odchylen z komenda naprawy dla operatora.
   - Kazde trafienie bramki testyUsuniete przepisz do pola testyUsuniete z uzasadnieniem (funkcja usunieta w tej fazie
     albo nowa nazwa testu). Test usuniety bez usuniecia testowanej funkcji przywroc.
   - Na koniec \`node .claude/scripts/bramki/bramki.mjs --dopisz-sume\` — dopisuje nowe migracje do supabase/migrations.sum
     (plik commitujesz razem z migracjami).
1b. AUDYT ERROR-HANDLINGU (przed commitem — hooki sesyjne nie widza zmian commitowanych przez workflow):
   przejrzyj git diff tej fazy pod katem: (a) console.log/console.error w kodzie PRODUKCYJNYM
   (testy i skrypty narzedziowe sa OK) — zamien na structured logging lub Sentry; (b) bloki catch
   bez sladu (zakaz pustych catch): nieoczekiwany blad — Sentry captureError/captureException albo re-throw; oczekiwana odmowa (walidacja, 4xx) — log bez zdarzenia Sentry.
   Znaleziska NAPRAW przed commitem, nie odnotowuj "do zrobienia".
${BLOK_DLUGIE_KOMENDY}
2. Aktualizuj ${sciezka}/*-zadania.md: oznacz ukonczone checkboxy [x] (NIE ruszaj "Weryfikacja:" ANI zadnego
   checkboxa z markerem [E2E]/[Manual] — "Test: [E2E]" to URUCHOMIENIE flow przez testera review, nie jego
   napisanie; odznacza go scribe review po PASS testera E2E. Napisany seed *-seed.sql odhaczasz WYLACZNIE
   w checkboxie implementacyjnym "Stwórz (e2e seed):").
3. Aktualizuj ${sciezka}/*-kontekst.md: zmiany i decyzje tej fazy dopisz do sekcji \`## Dziennik\`
   (jedna sekcja, chronologicznie) plus "Ostatnia aktualizacja". Odchylenia i nastepne kroki builderow z listy raportow dopisz do \`## Dziennik\` (linia na IU), bo to jedyny zapis pracy, ktora builder zostawil poza jednostka. NIE zakladaj w tym pliku sekcji
   "Decyzje techniczne", "Kluczowe pliki", "Odroczone do implementacji" ani "Wzorce do nasladowania" —
   te tresci zyja w planie technicznym, a kopia w pliku kontekstu rozjezdza sie z nim. Decyzja korygujaca plan idzie
   do sekcji \`## Decyzje z realizacji\` planu technicznego w docs/plans/ (punkt 4), a w Dzienniku zostaje jedno zdanie i wskaznik.
4. Aktualizuj plan techniczny w docs/plans/: odznacz test scenarios / verification dla tej fazy. Decyzja korygujaca plan
   trafia WYLACZNIE do sekcji \`## Decyzje z realizacji\` na koncu planu (brak sekcji = utworz ja jako ostatnia), jedna linia
   na decyzje: \`- faza ${faza}, IU-x: <decyzja>\`. Poza ta sekcja w planie zmieniasz tylko stan checkboxow: przeglad spojnosci
   planu liczy odcisk tresci bez tej sekcji i bez checkboxow, wiec kazda inna zmiana zatrzyma kolejny run na bramce gotowosci.
5. Commit inkrementalny: feat/fix/refactor([nazwa]): [co i dlaczego]. Staguj tylko zmienione pliki (nie git add .).
6. DOSSIER FAZY (po commicie):
   \`node .claude/scripts/dossier/dossier.mjs --sciezka ${sciezka} --faza ${faza}${baza === 'HEAD' ? '' : ` --baza ${baza}`} --bramki ${plikBramek}\`
   Wynik (JSON na stdout) przepisz 1:1 do pola dossier. Kod wyjscia inny niz 0: dossier = null, stderr do odchylen —
   status fazy od tego nie zalezy.

Dzialaj autonomicznie. Zwroc obiekt zgodny ze schematem ExecuteResult
(status=completed tylko gdy walidacja PASS, zadna bramka nie konczy sie porazka i wszystkie IU completed).
Pole problem przy statusie innym niz completed czyta operator w raporcie zatrzymania: piszesz je po polsku, prostym jezykiem —
co nie przeszlo (nazwa walidacji albo bramki i trafienia), gdzie, i co operator moze z tym zrobic.`
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

const sciezka = args && args.sciezka
const faza = args && args.faza
if (!sciezka || faza === undefined) {
  return { fazaNumer: -1, status: 'blocked', iu: [], problem: 'brak args {sciezka, faza}' }
}

phase('Plan IU')
const ukonczoneWczesniej = Array.isArray(args.iuUkonczone) ? args.iuUkonczone.filter((id) => typeof id === 'string' && id) : []
const plan = await agent(plannerPrompt(sciezka, faza, ukonczoneWczesniej), { schema: IU_PLAN, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `planner:faza-${faza}` })

// Null-guard: planner zabity/blad -> kontrolowany blocked zamiast TypeError (ktory wykoleilby caly autopilot).
if (!plan) {
  return { fazaNumer: faza, status: 'blocked', iu: [], commity: [], testy: 'n/a', odchylenia: [], problem: 'planner zwrocil null (agent padl lub zostal pominiety)' }
}

// Baza ze stanu zadania (args.baza) wygrywa z HEAD-em plannera: execute przerwany po commicie fazy (porazka bramki domkniecia)
// wznawia sie z HEAD-em juz PO zmianach fazy, wiec bramki i dossier liczone od niego nie widzialyby jej diffu (pilot Nawykometr, run 2).
const bazaZeStanu = /^[0-9a-f]{7,40}$/.test((args && args.baza) || '') ? args.baza : null
if (bazaZeStanu) plan.baza = bazaZeStanu

plan.iu = plan.poza ? [] : bezUkonczonych(plan.iu, ukonczoneWczesniej)

// Planner bez pracy. Bez bazy w stanie faza byla domknieta wczesniej — nic do zrobienia. Z baza w stanie poprzednie podejscie
// przerwalo sie po czesci pracy (porazka bramki domkniecia po commicie, jednostki zapisane domknieciem czesciowym): domkniecie
// biegnie jeszcze raz na stanie repo, zeby bramka, ktora zatrzymala faze, przeszla przed review (punkt 34).
if (plan.iu.length === 0 && !bazaZeStanu) {
  return { fazaNumer: faza, status: 'completed', iu: [], commity: [], testy: 'brak', odchylenia: [], problem: null, baza: null }
}

phase('Build')
// BLOK doklejany deterministycznie w JS — kazdy builder dostaje prawa srodowiska niezaleznie od plannera.
const promptIU = (iu) => `${iu.prompt}\n${BLOK_DLUGIE_KOMENDY}${BLOK_HIERARCHIA_ZRODEL}${BLOK_PYTANIE_BLOKERA}`
let builds
if (plan.iu.length === 0) {
  builds = []
} else if (plan.strategia === 'parallel') {
  // IU niezalezne — wszystkie buildery rownolegle (bariera, czekamy na komplet)
  builds = await parallel(
    plan.iu.map((iu) => () =>
      agent(promptIU(iu), { schema: BUILD_RESULT, agentType: iu.agentType, effort: 'high', label: `build:${iu.id}`, phase: 'Build' })
    )
  )
} else {
  // serial — IU zalezne / wspolne pliki, kolejnosc ma znaczenie
  builds = []
  for (const iu of plan.iu) {
    const r = await agent(promptIU(iu), { schema: BUILD_RESULT, agentType: iu.agentType, effort: 'high', label: `build:${iu.id}`, phase: 'Build' })
    builds.push(r)
    // null (builder zabity/blad) traktuj jak blocked — kolejne IU moga zalezec od tego
    if (!r || r.status === 'blocked') break
  }
}

const buildResults = builds.filter(Boolean)
// Najpierw blocked (niesie pytanie blokera), potem guard kompletnosci.
const zablokowany = buildResults.find((b) => b.status === 'blocked')
// Domkniecie czesciowe (punkt 34): jednostki ukonczone ida do commita po walidacji, pliki nieukonczonej do schowka gita.
async function zapiszUkonczone() {
  const czesc = planCzesciowegoDomkniecia(plan, buildResults)
  if (!czesc.mozna) return { czesc, czesciowe: null }
  phase('Domkniecie')
  const czesciowe = await agent(domkniecieCzesciowePrompt(sciezka, faza, czesc, bazaFazy(plan)), { schema: CZESCIOWE_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `domkniecie-czesciowe:faza-${faza}` })
  return { czesc, czesciowe }
}
// Decyzje autopilota z builderow (HIERARCHIA ZRODEL) liczone w JS; autopilot zapisuje je w known-issues jak decyzje fixa. Takze
// przy zatrzymaniu: jednostki ukonczone przed blokerem zapisuje domkniecie czesciowe. Builder zablokowany nie daje decyzji
// (jego pliki ida do schowka gita).
const decyzjeAutopilota = decyzjeBuilderow(buildResults, false)
const decyzjeUkonczonych = decyzjeBuilderow(buildResults, true)

if (zablokowany) {
  const { czesc, czesciowe } = await zapiszUkonczone()
  return wynikPrzerwanego({
    fazaNumer: faza,
    decyzjeAutopilota: decyzjeUkonczonych,
    status: 'blocked',
    iu: buildResults.map((b) => ({ id: b.id, status: b.status })),
    problem: zablokowany.pytanie || `IU ${zablokowany.id} zablokowany`,
  }, plan, ukonczoneWczesniej, czesc, czesciowe)
}
// Guard: builder zabity przez runtime znika jako null — IU nie moze zniknac bezslednie.
if (buildResults.length !== plan.iu.length) {
  const zwrocone = new Set(buildResults.map((b) => b.id))
  const brakujace = plan.iu.filter((iu) => !zwrocone.has(iu.id)).map((iu) => iu.id)
  const { czesc, czesciowe } = await zapiszUkonczone()
  return wynikPrzerwanego({
    fazaNumer: faza,
    decyzjeAutopilota: decyzjeUkonczonych,
    status: 'partial',
    iu: plan.iu.map((iu) => ({ id: iu.id, nazwa: iu.nazwa, status: zwrocone.has(iu.id) ? 'completed' : 'brak wyniku (kill/blad)' })),
    problem: `builder(y) bez wyniku: ${brakujace.join(', ')} — IU niewykonane lub niezweryfikowane`,
  }, plan, ukonczoneWczesniej, czesc, czesciowe)
}

phase('Domkniecie')
const wynik = await agent(domknieciePrompt(sciezka, faza, buildResults, bazaFazy(plan), plikBramek(sciezka, faza), ukonczoneWczesniej, decyzjeAutopilota) + punktZapisuStanu(sciezka, faza, bazaFazy(plan), args.stanPoExecute), { schema: EXECUTE_RESULT, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `domkniecie:faza-${faza}` })
// Baza fazy z JS (P7): autopilot utrwala ja w stanie i podaje review-wf jako args.baza.
const bazaWyniku = bazaFazy(plan) === 'HEAD' ? null : bazaFazy(plan)
return wynikDomkniecia(wynik, faza, buildResults, bazaWyniku, decyzjeAutopilota)

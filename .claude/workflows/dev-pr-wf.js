export const meta = {
  name: 'dev-pr-wf',
  description: "Mechanika obslugi pull requesta: bramka wejscia i utworzenie PR (etap 'start') -> zebranie i klasyfikacja nierozwiazanych watkow bota (etap 'zbierz') -> naprawa wybranych watkow + odpowiedzi + commit i push (etap 'napraw') -> bramka merge'a (etap 'merge') -> compound z petla zwrotna do reviewerow (etap 'compound'). Decyzje operatora i czekanie na bota naleza do skilla /dev-pr — tutaj sa wylacznie bramki liczone w JS.",
  whenToUse: "Wolany przez skill /dev-pr, jeden etap na wywolanie. Nie uruchamiaj samodzielnie — skill trzyma licznik tur i pyta operatora.",
  phases: [{ title: 'PR' }],
}

// ── Dlaczego ten workflow istnieje ────────────────────────────────────────
// Audyt 2026-09-02: odcinek od wyslania pull requesta do merge'a byl calkowicie poza szablonem.
// W projekcie zrodlowym to 127 komentarzy bota w 6 pull requestach i 14 commitow recznych tur —
// przy ZERZE wpisow w docs/solutions/. Najskuteczniejszy zewnetrzny reviewer nie zasilal bazy wiedzy,
// a te same klasy bledow wracaly w kolejnym PR.
//
// Podzial rol jest ten sam co w dev-docs-execute i dev-docs-review: MECHANIKA w JS, DECYZJE w skillu.
// Tylko glowna konwersacja moze zapytac operatora (AskUserQuestion) i tylko ona ma Monitor do czekania
// na bota — dlatego workflow jest wolany ETAPAMI, a nie raz na caly przebieg.

// ── Bloki wspolne ─────────────────────────────────────────────────────────

// Kopia zasady z dev-autopilot-wf.js (workflowy sa self-contained — przy zmianie synchronizuj recznie).
const BLOK_KOMEND_PROJEKTU = `
=== KOMENDY WALIDACYJNE (czytaj z projektu, nie zgaduj) ===
Komendy typecheck / test / build bierz z pola "scripts" w package.json TEGO repo. Nie zakladaj \`npm\`:
sprawdz, ktory menedzer jest uzywany (bun.lockb -> bun, pnpm-lock.yaml -> pnpm, yarn.lock -> yarn,
package-lock.json -> npm) i uzyj jego skladni. Gdy skryptu nie ma — napisz to wprost w wyniku zamiast
uruchamiac wymyslona komende. Monorepo: komendy odpalaj w tym samym miejscu, w ktorym robi to CI.
=== KONIEC BLOKU KOMEND ===`

const BLOK_GH = `
=== PRACA Z gh (twarde reguly) ===
- Tresc pull requesta i tresc komentarza podawaj ZAWSZE przez plik albo parametr GraphQL, NIGDY przez stdin:
  \`gh pr create --body-file <plik>\` zamiast \`gh pr create --body -\`. Przy pustym stdin \`gh\` konczy sie
  kodem 0 i tworzy PR z PUSTYM opisem — bez sladu bledu, ktory dalo by sie zauwazyc.
- Nierozwiazane watki inline sa dostepne WYLACZNIE przez GraphQL (REST ich nie rozroznia). Zapytanie:
  \`\`\`
  gh api graphql -F owner=<owner> -F repo=<repo> -F pr=<numer> -f query='
    query($owner:String!, $repo:String!, $pr:Int!) {
      repository(owner:$owner, name:$repo) {
        pullRequest(number:$pr) {
          reviewThreads(first:100) {
            nodes {
              id isResolved isOutdated path line
              comments(first:20) { nodes { author { login } body createdAt } }
            }
          }
        }
      }
    }'
  \`\`\`
  \`owner\` i \`repo\` wez z \`gh repo view --json owner,name\`.
- Odpowiedz w watku: mutacja \`addPullRequestReviewThreadReply\` z \`pullRequestReviewThreadId\`. Gdy
  mutacja zawiedzie, fallback REST: \`gh api --method POST repos/<owner>/<repo>/pulls/<pr>/comments/<id>/replies -f body=@<plik>\`.
- NIE rozwiazuj watkow (\`resolveReviewThread\`), ktorych nie zaadresowales. Rozwiazany watek znika
  operatorowi z widoku — to jest kasowanie uwagi, nie jej domkniecie.
- Kazde wywolanie \`gh\` moze zwrocic blad sieci albo limitu. Nie powtarzaj w petli: zglos blad w wyniku.
=== KONIEC BLOKU gh ===`

// ── Schematy ──────────────────────────────────────────────────────────────

const START = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bramka: { type: 'string', enum: ['OK', 'STOP'], description: 'STOP = ktorykolwiek warunek wejscia niespelniony' },
    powod: { type: ['string', 'null'], description: 'przy STOP: co dokladnie jest nie tak i co operator ma zrobic' },
    branch: { type: 'string' },
    prNumer: { type: ['integer', 'null'] },
    prUrl: { type: ['string', 'null'] },
    prUtworzony: { type: 'boolean', description: 'true gdy TEN etap utworzyl pull requesta' },
    headRefOid: { type: ['string', 'null'], description: 'SHA czubka galezi — po nim poznajemy, czy recenzja bota dotyczy aktualnego kodu' },
    state: { type: ['string', 'null'] },
    mergeable: { type: ['string', 'null'] },
    mergeStateStatus: { type: ['string', 'null'] },
  },
  required: ['bramka', 'branch', 'prUtworzony'],
}

const KLASY = ['napraw', 'napraw-szerzej', 'odrzuc', 'do-operatora']

const ZEBRANE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    watki: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'reviewThreads.nodes[].id z GraphQL — klucz do odpowiedzi w watku' },
          plik: { type: 'string', description: 'path:line albo "(recenzja ogolna)"' },
          streszczenie: { type: 'string', description: 'jedno zdanie: co bot zarzuca' },
          klasa: { type: 'string', enum: KLASY },
          uzasadnienie: { type: 'string', description: 'dlaczego ta klasa; przy "odrzuc" MUSI zawierac cytat z CLAUDE.md, planu albo docs/CONCEPTS.md' },
          wplywNaProjekt: {
            type: 'string',
            description: 'wplyw na TERAZ i na DALSZY CIAG: czy to klasa bledu, ktora sie powtorzy; czy dotyka kontraktu, schematu bazy albo granicy zaufania; czy blokuje kolejne fazy. To jest to, co operator widzi przy wyborze',
          },
          klaster: { type: ['string', 'null'], description: 'identyfikator wspolnej przyczyny — watki z tym samym klastrem zamyka JEDNA naprawa' },
        },
        required: ['id', 'plik', 'streszczenie', 'klasa', 'uzasadnienie', 'wplywNaProjekt'],
      },
    },
    recenzjaAktualna: { type: 'boolean', description: 'czy pobrana recenzja dotyczy biezacego headRefOid' },
    uwagi: { type: ['string', 'null'], description: 'cokolwiek, co operator powinien wiedziec o samym zbieraniu (np. ucieta lista watkow)' },
  },
  required: ['watki', 'recenzjaAktualna'],
}

const NAPRAWA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    naprawione: { type: 'array', items: { type: 'string' }, description: 'id watkow realnie zamknietych zmiana w kodzie' },
    odrzucone: { type: 'array', items: { type: 'string' }, description: 'id watkow, na ktore odpowiedzielismy odmowa z cytatem' },
    nieruszone: { type: 'array', items: { type: 'string' }, description: 'id watkow z wyboru, ktorych NIE udalo sie zamknac' },
    walidacja: { type: 'string', enum: ['PASS', 'FAIL', 'BRAK-KOMEND'], description: 'BRAK-KOMEND = package.json nie ma odpowiednich skryptow' },
    walidacjaDetal: { type: 'string', description: 'ktore komendy uruchomiono i z jakim wynikiem' },
    odpowiedziWyslane: { type: 'integer', description: 'ile watkow dostalo odpowiedz' },
    commit: { type: ['string', 'null'], description: 'krotki hash commita poprawek albo null' },
    push: { type: 'boolean' },
    plikiBinarne: { type: 'array', items: { type: 'string' }, description: 'pliki zrodlowe, ktore po naprawie git widzi jako binarne (numstat "-")' },
  },
  required: ['naprawione', 'odrzucone', 'nieruszone', 'walidacja', 'odpowiedziWyslane', 'push', 'plikiBinarne'],
}

const MERGE_STAN = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mergeable: { type: ['string', 'null'] },
    mergeStateStatus: { type: ['string', 'null'] },
    ciZielone: { type: 'boolean', description: 'wszystkie wymagane checki CI zakonczone sukcesem' },
    ciDetal: { type: 'string', description: 'lista checkow z ich stanem (albo "brak CI")' },
    watkiNapraw: { type: 'integer', description: 'nierozwiazane watki sklasyfikowane jako napraw/napraw-szerzej' },
    watkiDoOperatora: { type: 'integer' },
  },
  required: ['mergeable', 'mergeStateStatus', 'ciZielone', 'ciDetal', 'watkiNapraw', 'watkiDoOperatora'],
}

const MERGE_WYNIK = {
  type: 'object',
  additionalProperties: false,
  properties: {
    zmergowany: { type: 'boolean' },
    detal: { type: 'string' },
  },
  required: ['zmergowany', 'detal'],
}

const COMPOUND_PR = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pliki: { type: 'array', items: { type: 'string' }, description: 'zapisane docs/solutions/<kategoria>/<plik>.md' },
    regula: { type: 'string', description: 'status learned-patterns.md' },
    propozycjeDoReviewerow: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          agent: { type: 'string', description: 'nazwa pliku agenta, np. security-sentinel' },
          klasa: { type: 'string', description: 'klasa uwagi, ktora bot znalazl po naszym review' },
          regula: { type: 'string', description: 'proponowany zapis do dopisania temu agentowi' },
          podstawa: { type: 'string', description: 'w ktorych pull requestach ta klasa wystapila' },
        },
        required: ['agent', 'klasa', 'regula', 'podstawa'],
      },
      description: 'TYLKO propozycje — wdrozenie jest decyzja operatora, ten workflow NIE edytuje plikow agentow',
    },
    commit: { type: ['string', 'null'] },
  },
  required: ['pliki', 'regula', 'propozycjeDoReviewerow'],
}

// ── Wejscie ───────────────────────────────────────────────────────────────

const etap = (args && args.etap) || 'start'
const zadanie = args && args.zadanie
const tura = (args && Number.isInteger(args.tura)) ? args.tura : 1
const auto = !!(args && args.auto)
// Lista id watkow wybranych przez operatora (tryb interaktywny). null = tryb autonomiczny,
// wybor liczy sam agent naprawy wg rubryki (napraw + napraw-szerzej).
const wybor = (args && Array.isArray(args.wybor)) ? args.wybor : null
const watkiWejsciowe = (args && Array.isArray(args.watki)) ? args.watki : []

if (!zadanie) {
  return { status: 'BLAD', powod: 'Brak args.zadanie — workflow nie wie, ktorego zadania dotyczy pull request. Wolaj go przez skill /dev-pr.' }
}

phase('PR')

// ── Etap: start (Faza 0 — bramka wejscia + utworzenie PR) ─────────────────

if (etap === 'start') {
  const wynik = await agent(
    `Jestes bramka wejscia skilla /dev-pr dla zadania "${zadanie}". Sprawdzasz warunki i — gdy trzeba —
tworzysz pull requesta. NIE naprawiasz kodu i NIE odpowiadasz na zadne komentarze.

BRAMKA (wszystkie trzy warunki musza byc spelnione; ktorykolwiek niespelniony => bramka=STOP z powodem):
1. Jestesmy na galezi INNEJ niz glowna. \`git branch --show-current\` i porownaj z domyslna galezia repo
   (\`gh repo view --json defaultBranchRef\`). Praca na galezi glownej = STOP.
2. Drzewo czyste: \`git status --short\` puste. Niezacommitowane zmiany = STOP (nie commituj ich sam —
   nie wiesz, czy naleza do tego zadania).
3. Zadanie istnieje: katalog \`docs/completed/${zadanie}\` ALBO \`docs/active/${zadanie}\`. Brak obu = STOP.

STAN PULL REQUESTA:
\`gh pr view --json number,state,mergeable,mergeStateStatus,headRefOid,url\` dla biezacej galezi.
- Pull request ISTNIEJE => zwroc jego dane, prUtworzony=false.
- Pull requesta NIE MA => utworz go:
  a) Zbuduj tresc opisu w pliku tymczasowym \`/tmp/dev-pr-body-${zadanie}.md\`:
     - podsumowanie z \`<katalog zadania>/${zadanie}-podsumowanie.md\` (gdy pliku nie ma — z pliku planu zadania),
     - sekcja \`## Swiadomie nienaprawione\` zlozona z: otwartych P3 z sekcji "## Do poprawy po review fazy N"
       w \`<katalog zadania>/*-zadania.md\` (wiersze \`- [ ]\` z tokenem [P3]) ORAZ otwartych wpisow
       z \`<katalog zadania>/known-issues.md\` (otwarte = poza sekcja "## Zamkniete"). Gdy oba zrodla puste,
       wpisz w tej sekcji jedna linie "Brak — wszystkie findingi review zamkniete."
     - ZADNYCH wartosci sekretow, tokenow ani hasel, takze gdy cytujesz known-issues.
  b) \`gh pr create --title "<tytul zadania>" --body-file /tmp/dev-pr-body-${zadanie}.md\`.
     NIGDY przez stdin — patrz blok gh nizej.
  c) Odczytaj stan nowego PR tym samym \`gh pr view --json ...\` i zwroc prUtworzony=true.

Nie pushuj, nie mergeuj, nie zmieniaj kodu. Zwroc obiekt zgodny ze schematem.${BLOK_GH}`,
    { schema: START, label: `pr:start:${zadanie}` }
  )
  if (!wynik) return { status: 'BLAD', etap, powod: 'Bramka wejscia zwrocila null (agent padl) — sprobuj ponownie albo sprawdz `gh auth status`.' }
  if (wynik.bramka === 'STOP') {
    log(`/dev-pr: bramka wejscia STOP — ${wynik.powod || 'bez powodu'}`)
    return { status: 'STOP', etap, ...wynik }
  }
  log(`/dev-pr: PR #${wynik.prNumer} ${wynik.prUtworzony ? 'UTWORZONY' : 'istnieje'} (${wynik.prUrl || 'brak url'}), head ${String(wynik.headRefOid || '').slice(0, 8)}`)
  return { status: 'OK', etap, ...wynik }
}

// ── Etap: zbierz (Faza 2 — zebranie i klasyfikacja watkow) ────────────────

if (etap === 'zbierz') {
  const wynik = await agent(
    `Jestes klasyfikatorem uwag z code review bota dla pull requesta zadania "${zadanie}" (tura ${tura}).
Czytasz i klasyfikujesz. NIE naprawiasz kodu, NIE odpowiadasz w watkach, NIE commitujesz.

1. Ustal numer PR (\`gh pr view --json number,headRefOid\`) i pobierz WSZYSTKIE watki review przez GraphQL
   (zapytanie w bloku gh nizej). Wez tylko te z \`isResolved: false\`. Dolacz tresc recenzji ogolnych
   (\`gh pr view --json reviews\`) jako pozycje z plikiem "(recenzja ogolna)".
2. Ustal \`recenzjaAktualna\`: czy najnowsza recenzja bota dotyczy biezacego \`headRefOid\`. Gdy recenzja jest
   starsza od czubka galezi, ustaw false — skill zdecyduje, czy czekac na recenzje przyrostowa.
3. Dla KAZDEGO watku ustal klase wg rubryki:

| Klasa | Kryterium |
|---|---|
| \`napraw\` | realny defekt: bezpieczenstwo, poprawnosc, utrata danych, zlamany kontrakt — ALBO drobiazg tanszy do naprawy niz do dyskusji |
| \`napraw-szerzej\` | uwaga trafna i wystepujaca TAKZE w blizniaczych miejscach; naprawa ma objac wszystkie. Zanim uzyjesz tej klasy, ZNAJDZ te miejsca gropem i wymien je w uzasadnieniu |
| \`odrzuc\` | bot nie zna decyzji projektowej. **Wymaga CYTATU** z CLAUDE.md, planu technicznego w docs/plans/ albo docs/CONCEPTS.md. Bez cytatu ta klasa jest niedozwolona — uzyj \`do-operatora\` |
| \`do-operatora\` | wymaga decyzji produktowej albo ryzyka nie da sie ograniczyc w tej turze |

4. Dla kazdego watku wypelnij \`wplywNaProjekt\` — to jest pole, ktore operator czyta przy wyborze.
   Odpowiedz w nim na trzy pytania, konkretnie, nie ogolnikami:
   - czy to KLASA bledu, ktora sie powtorzy (czy zobaczymy to samo w kolejnym pull requescie)?
   - czy dotyka kontraktu API, schematu bazy albo granicy zaufania (walidacja, autoryzacja, wejscie z zewnatrz)?
   - czy blokuje kolejne fazy z mapy faz zadania?
   Uwaga dotyczaca nazwy zmiennej i uwaga o braku walidacji na endpointcie NIE moga miec tego samego wpisu.
5. KLASTRUJ watki o wspolnej przyczynie: nadaj im ten sam \`klaster\` (krotki identyfikator, np.
   "brak-limitu-czasu-http"). Jedna naprawa zamyka wtedy kilka komentarzy i tak tez zostana policzone.

Nie zgaduj tresci watku z samego tytulu — przeczytaj komentarze i zajrzyj do wskazanego pliku.
Zwroc obiekt zgodny ze schematem.${BLOK_GH}`,
    { schema: ZEBRANE, label: `pr:zbierz:tura-${tura}` }
  )
  if (!wynik) return { status: 'BLAD', etap, powod: 'Zbieranie watkow zwrocilo null (agent padl).' }

  // Liczniki w JS (Filar 3: agent nigdy nie liczy tego, co JS wie na pewno).
  const watki = wynik.watki || []
  const licznik = {}
  for (const k of KLASY) licznik[k] = watki.filter((w) => w.klasa === k).length
  const klastry = [...new Set(watki.map((w) => w.klaster).filter(Boolean))]
  // "odrzuc" bez cytatu jest niedozwolone — pilnujemy tego w kodzie, nie tylko w prompcie, bo to
  // jedyna klasa, w ktorej agent moze CICHO zamknac trafna uwage bota wlasnym zdaniem.
  const odrzuconeBezCytatu = watki.filter((w) => w.klasa === 'odrzuc' && !/CLAUDE\.md|docs\/plans\/|CONCEPTS\.md|`/.test(w.uzasadnienie || ''))
  for (const w of odrzuconeBezCytatu) {
    w.klasa = 'do-operatora'
    w.uzasadnienie = `[PRZEKLASYFIKOWANE z "odrzuc": brak cytatu ze zrodla decyzji] ${w.uzasadnienie || ''}`
  }
  if (odrzuconeBezCytatu.length) {
    licznik['odrzuc'] -= odrzuconeBezCytatu.length
    licznik['do-operatora'] += odrzuconeBezCytatu.length
    log(`/dev-pr: ${odrzuconeBezCytatu.length}x klasa "odrzuc" bez cytatu ze zrodla decyzji -> przeklasyfikowane na "do-operatora"`)
  }
  log(`/dev-pr tura ${tura}: ${watki.length} nierozwiazanych watkow (napraw ${licznik['napraw']}, szerzej ${licznik['napraw-szerzej']}, odrzuc ${licznik['odrzuc']}, do-operatora ${licznik['do-operatora']}), klastrow: ${klastry.length}${wynik.recenzjaAktualna ? '' : ' — UWAGA: recenzja NIE dotyczy biezacego czubka galezi'}`)
  return { status: 'OK', etap, tura, watki, licznik, klastry, recenzjaAktualna: wynik.recenzjaAktualna, uwagi: wynik.uwagi || null }
}

// ── Etap: napraw (Faza 4 — naprawa, odpowiedzi, commit, push) ─────────────

if (etap === 'napraw') {
  // Wybor liczy JS, nie agent: w trybie autonomicznym rubryka jest deterministyczna (napraw +
  // napraw-szerzej), a w interaktywnym decyzja nalezy do operatora i przychodzi w args.wybor.
  const doNaprawy = wybor
    ? watkiWejsciowe.filter((w) => wybor.includes(w.id))
    : watkiWejsciowe.filter((w) => w.klasa === 'napraw' || w.klasa === 'napraw-szerzej')
  const doOdrzucenia = watkiWejsciowe.filter((w) => w.klasa === 'odrzuc' && !doNaprawy.includes(w))
  const doOperatora = watkiWejsciowe.filter((w) => w.klasa === 'do-operatora')

  if (!doNaprawy.length && !doOdrzucenia.length) {
    log(`/dev-pr tura ${tura}: nic do naprawy i nic do odrzucenia — tura pusta`)
    return { status: 'OK', etap, tura, pusta: true, doOperatora: doOperatora.map((w) => w.id) }
  }

  const wynik = await agent(
    `Jestes agentem naprawczym tury ${tura} pull requesta zadania "${zadanie}". Naprawiasz DOKLADNIE to,
co jest na listach ponizej — ani mniej, ani wiecej. Rozszerzanie zakresu poza te listy jest zabronione:
kazda dodatkowa zmiana wraca do Ciebie jako kolejny komentarz bota w nastepnej turze.

DO NAPRAWY (${doNaprawy.length}):
${JSON.stringify(doNaprawy, null, 2)}

DO ODRZUCENIA — odpowiadasz w watku, NIE zmieniasz kodu (${doOdrzucenia.length}):
${JSON.stringify(doOdrzucenia, null, 2)}

1. NAPRAWA. Idz po klastrach: watki z tym samym \`klaster\` maja WSPOLNA przyczyne i zamyka je jedna
   zmiana — nie lataj kazdego osobno. Przy klasie \`napraw-szerzej\` napraw takze blizniacze miejsca
   wymienione w uzasadnieniu; pominiecie ktoregos oznacza, ze ta sama uwaga wroci w nastepnej turze.
   ZAKAZ TEST-WEAKENINGU (twardy): nie modyfikuj istniejacych testow ani asercji, zeby przeszly —
   napraw implementacje. Testy mozesz DODAWAC. Gdy uwaga bota dotyczy brakujacego przypadku brzegowego,
   dopisz test, ktory ten przypadek pokrywa.
2. WALIDACJA przed commitem: typecheck, testy, build. Wynik zapisz w \`walidacjaDetal\` (ktore komendy,
   z jakim skutkiem). Walidacja FAIL => NIE commituj i NIE pushuj, zwroc walidacja="FAIL" z detalem.
3. ODPOWIEDZI W WATKACH. Kazdy watek z obu list dostaje odpowiedz:
   - naprawiony: co konkretnie zmienilismy i gdzie (plik:linia), jednym-dwoma zdaniami,
   - odrzucony: dlaczego, Z CYTATEM ze zrodla decyzji (z pola \`uzasadnienie\`). Odmowa bez cytatu
     jest niedopuszczalna — jesli cytatu nie masz, NIE odpowiadaj odmowa, tylko zostaw watek nieruszony.
   Odpowiedzi pisz po polsku. NIE rozwiazuj watkow — rozwiazany watek znika operatorowi z widoku.
4. COMMIT jawnym pathspec zmienionych plikow (ZAKAZ \`git add -A\` i \`git add .\`), komunikat
   \`fix(pr): tura ${tura} — poprawki po review bota\`. Potem \`git push\`.
5. GUARD PLIKOW BINARNYCH: po commicie \`git diff --numstat HEAD~1..HEAD\`; plik z "-" zamiast liczb,
   ktory NIE jest legalnym binarium (.png .jpg .jpeg .gif .webp .avif .ico .bmp, .woff .woff2 .ttf .otf,
   .pdf .zip .gz .mp4 .mp3, bun.lockb), wpisz do plikiBinarne[]. Typowa przyczyna: surowe bajty sterujace
   wpisane do pliku zrodlowego zamiast sekwencji ucieczki — kazdy kolejny agent padnie na jego Read.

Watek, ktorego nie zamknales, wpisz do nieruszone[] — nie udawaj, ze zostal zaadresowany.
${BLOK_KOMEND_PROJEKTU}${BLOK_GH}`,
    { schema: NAPRAWA, label: `pr:napraw:tura-${tura}` }
  )
  if (!wynik) return { status: 'BLAD', etap, tura, powod: 'Agent naprawczy zwrocil null — zmiany moga byc czesciowo na dysku, sprawdz `git status`.' }

  const plikiBinarne = wynik.plikiBinarne || []
  if (plikiBinarne.length) {
    log(`/dev-pr tura ${tura}: STOP — git widzi jako binarne pliki, ktore powinny byc tekstem: ${plikiBinarne.join(', ')}`)
    return {
      status: 'STOP', etap, tura, plikiBinarne,
      powod: `Po naprawie git widzi jako BINARNE pliki, ktore powinny byc tekstem: ${plikiBinarne.join(', ')}. Najprawdopodobniej wpisano do nich surowe bajty sterujace zamiast sekwencji ucieczki. Kazdy kolejny agent, ktory zrobi Read takiego pliku, rozlaczy sie na APIError.`,
      naprawa: 'Napraw te pliki POZA pipelinem i NIE otwieraj ich Readem: cofnij zmiane (`git checkout HEAD~1 -- <plik>`) albo przepisz plik z sekwencjami ucieczki. Potwierdz `file <plik>` = "... text", zacommituj, wypchnij i wroc do /dev-pr.',
    }
  }
  if (wynik.walidacja === 'FAIL') {
    log(`/dev-pr tura ${tura}: walidacja FAIL — bez commita i bez pusha (${wynik.walidacjaDetal || 'brak detalu'})`)
    return {
      status: 'STOP', etap, tura, ...wynik,
      powod: `Tura ${tura}: walidacja po naprawach zakonczyla sie FAIL, wiec nic nie zostalo zacommitowane ani wypchniete. ${wynik.walidacjaDetal || ''}`,
      naprawa: 'Doprowadz walidacje do zieleni recznie (zmiany sa w drzewie roboczym), zacommituj, wypchnij — i wroc do /dev-pr po kolejna recenzje przyrostowa.',
    }
  }
  if (wynik.walidacja === 'BRAK-KOMEND') {
    log(`/dev-pr tura ${tura}: package.json nie ma skryptow walidacyjnych — poprawki poszly BEZ bramki jakosci (${wynik.walidacjaDetal || ''})`)
  }
  log(`/dev-pr tura ${tura}: naprawiono ${wynik.naprawione.length}, odrzucono ${wynik.odrzucone.length}, nieruszone ${wynik.nieruszone.length}, odpowiedzi ${wynik.odpowiedziWyslane}, commit ${wynik.commit || 'brak'}, push ${wynik.push ? 'tak' : 'NIE'}`)
  return { status: 'OK', etap, tura, ...wynik, doOperatora: doOperatora.map((w) => w.id) }
}

// ── Etap: merge (Faza 6 — bramka merge'a) ─────────────────────────────────

if (etap === 'merge') {
  const stan = await agent(
    `Zbierz stan pull requesta zadania "${zadanie}" na potrzeby bramki merge'a. NICZEGO nie mergeuj,
nie zmieniaj kodu i nie odpowiadaj w watkach — masz TYLKO odczytac fakty.

1. \`gh pr view --json mergeable,mergeStateStatus,statusCheckRollup\`.
2. \`ciZielone\`: true tylko wtedy, gdy KAZDY wymagany check ma conclusion SUCCESS (albo NEUTRAL/SKIPPED).
   Check w stanie PENDING/QUEUED/IN_PROGRESS => false (nie "jeszcze zobaczymy" — false). Brak jakiegokolwiek
   CI => ciZielone=true i \`ciDetal\` = "brak CI". Wypisz w \`ciDetal\` nazwy checkow z ich stanem.
3. Policz nierozwiazane watki review (GraphQL jak w bloku gh): \`watkiNapraw\` = te, ktore dotycza realnego
   defektu do naprawy, \`watkiDoOperatora\` = te wymagajace decyzji produktowej. Watki \`isResolved: true\`
   i watki, na ktore odpowiedzielismy odmowa z cytatem, NIE licza sie do zadnej z tych liczb.

Zwroc obiekt zgodny ze schematem.${BLOK_GH}`,
    { schema: MERGE_STAN, label: `pr:merge-stan:${zadanie}` }
  )
  if (!stan) return { status: 'BLAD', etap, powod: 'Odczyt stanu PR zwrocil null (agent padl).' }

  // BRAMKA LICZONA W JS — kazdy warunek osobno, zeby raport mowil, KTORY nie przeszedl.
  // Merge jest nieodwracalny z poziomu pipeline'u, wiec zaden z tych warunkow nie jest "miekki".
  const warunki = [
    { nazwa: 'mergeable = MERGEABLE', ok: stan.mergeable === 'MERGEABLE', jest: String(stan.mergeable) },
    { nazwa: 'mergeStateStatus = CLEAN', ok: stan.mergeStateStatus === 'CLEAN', jest: String(stan.mergeStateStatus) },
    { nazwa: 'zero nierozwiazanych watkow klasy napraw', ok: stan.watkiNapraw === 0, jest: `${stan.watkiNapraw}` },
    { nazwa: 'zero watkow do-operatora', ok: stan.watkiDoOperatora === 0, jest: `${stan.watkiDoOperatora}` },
    { nazwa: 'CI zielone', ok: stan.ciZielone === true, jest: stan.ciDetal },
  ]
  const niespelnione = warunki.filter((w) => !w.ok)
  if (niespelnione.length) {
    log(`/dev-pr: bramka merge'a NIE przeszla — ${niespelnione.map((w) => `${w.nazwa} (jest: ${w.jest})`).join('; ')}`)
    return { status: 'GOTOWY-DO-DECYZJI', etap, stan, niespelnione, warunki }
  }
  if (!auto) {
    log("/dev-pr: wszystkie warunki merge'a spelnione — merge zostaje decyzja operatora (tryb interaktywny)")
    return { status: 'GOTOWY-DO-MERGE', etap, stan, warunki }
  }
  const merge = await agent(
    `Wszystkie warunki bramki merge'a dla pull requesta zadania "${zadanie}" zostaly spelnione i zweryfikowane
w kodzie orkiestratora (mergeable, mergeStateStatus, zero watkow do naprawy, zero do operatora, CI zielone).
Wykonaj merge: \`gh pr merge --squash --delete-branch\`. Gdy komenda zwroci blad — NIE probuj innych strategii
ani \`--admin\`: zwroc zmergowany=false z trescia bledu. Zwroc obiekt zgodny ze schematem.${BLOK_GH}`,
    { schema: MERGE_WYNIK, label: `pr:merge:${zadanie}` }
  )
  if (!merge) return { status: 'BLAD', etap, stan, powod: 'Merge zwrocil null — sprawdz stan PR recznie przed ponowieniem.' }
  log(`/dev-pr: merge ${merge.zmergowany ? 'wykonany' : 'NIE wykonany'} — ${merge.detal}`)
  return { status: merge.zmergowany ? 'ZMERGOWANY' : 'GOTOWY-DO-DECYZJI', etap, stan, merge, warunki }
}

// ── Etap: compound (Faza 7 — baza wiedzy + petla zwrotna do reviewerow) ───

if (etap === 'compound') {
  const wynik = await agent(
    `Jestes czescia pipeline'u /dev-pr. To jest etap, ktorego w szablonie brakowalo najbardziej:
w projekcie zrodlowym 127 komentarzy bota w 6 pull requestach dalo ZERO wpisow w bazie wiedzy,
wiec te same klasy bledow wracaly w kolejnym PR.

Zadanie: "${zadanie}". Material: diff wszystkich tur poprawek tego pull requesta
(\`git log --oneline --grep="^fix(pr)"\` -> \`git diff <pierwszy>^..HEAD\`) oraz lista watkow bota:
${JSON.stringify(watkiWejsciowe, null, 2)}

1. Wykonaj procedure ze skilla .claude/skills/dev-compound/SKILL.md w TRYBIE COMPACT (autonomiczny, bez pytan),
   ale z jednym zawezeniem: dokumentujesz KLASY BLEDOW, ktore bot znalazl PO naszym wlasnym review.
   To jest najcenniejszy material, jaki ten pipeline produkuje — dowod, czego nasze review nie widzi.
   Pojedyncza literowka albo uwaga o stylu NIE jest klasa bledu i nie zasluguje na wpis.
2. Ocen rule-worthy do .claude/rules/learned-patterns.md (limit ~50, dedup jak w skillu).
3. PETLA ZWROTNA DO REVIEWEROW. Sprawdz, czy ktoras klasa uwagi wystepuje w tym pull requescie
   NIE PIERWSZY RAZ — porownaj z wpisami w docs/solutions/ i z learned-patterns.md. Dla klasy, ktora
   pojawia sie po raz DRUGI albo kolejny, zaproponuj regule do KONKRETNEGO agenta-reviewera
   (.claude/agents/<nazwa>.md), np. brakujacy naglowek bezpieczenstwa -> security-sentinel,
   brak limitu czasu w kliencie HTTP -> architecture-strategist, rozjazd z wymaganiem -> spec-compliance-reviewer.
   **NIE EDYTUJ plikow agentow.** To sa PROPOZYCJE do raportu — wdrozenie jest decyzja operatora,
   bo zmiana promptu reviewera dotyka kazdej przyszlej fazy kazdego zadania.
4. Zacommituj TYLKO artefakty bazy wiedzy jawnym pathspec (docs/solutions/, .claude/rules/learned-patterns.md,
   docs/CONCEPTS.md — te, ktore realnie zmieniles). ZAKAZ \`git add -A\` i \`git add .\`.

Zwroc obiekt zgodny ze schematem.`,
    { schema: COMPOUND_PR, label: `pr:compound:${zadanie}` }
  )
  if (!wynik) return { status: 'BLAD', etap, powod: 'Compound zwrocil null — baza wiedzy nie zostala zasilona.' }
  log(`/dev-pr compound: ${wynik.pliki.length} wpisow w docs/solutions/, regula: ${wynik.regula}, propozycji do reviewerow: ${wynik.propozycjeDoReviewerow.length}`)
  return { status: 'OK', etap, ...wynik }
}

return { status: 'BLAD', powod: `Nieznany etap "${etap}". Dozwolone: start, zbierz, napraw, merge, compound.` }

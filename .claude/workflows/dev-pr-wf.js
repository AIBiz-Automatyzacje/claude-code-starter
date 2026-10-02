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

// Stan PR i CI czyta zbierz (rekomendacja po kazdej turze) i merge (bramka) — jedna regula dla obu.
const BLOK_STANU_PR = `
=== STAN PR I CI ===
\`gh pr view --json mergeable,mergeStateStatus,statusCheckRollup\` -> \`mergeable\`, \`mergeStateStatus\`.
\`ciZielone\`: true tylko wtedy, gdy KAZDY wymagany check ma conclusion SUCCESS (albo NEUTRAL/SKIPPED).
Check w stanie PENDING/QUEUED/IN_PROGRESS => false (nie "jeszcze zobaczymy" — false). Brak jakiegokolwiek
CI => ciZielone=true i \`ciDetal\` = "brak CI". Wypisz w \`ciDetal\` nazwy checkow z ich stanem.
=== KONIEC STANU PR ===`

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

// Zamkniety slownik klas BLEDU (It. 1, L12): miara jakosci „P1/P2 bota na 100 plikow per klasa i os” wymaga jednej nazwy na
// klase — historycznie 109 nazw od trzech klasyfikatorow. Zrodlo: docs/reviews/2026-09-19-analiza-pipeline/dane/it1-slownik-klas.*
// (po review subagenta). `os` = reviewer, ktory powinien byl zlapac uwage; `brak` = dzis zadna os albo nie-defekt.
// Zmiana listy = swiadoma decyzja (porownania miedzy epokami) — test __tests__/klasy-bledow.test.mjs.
const KLASY_BLEDOW = {
  'cykl-zycia-ui': { os: 'correctness', opis: 'efekt, timer albo stan UI zyje dluzej niz komponent albo przezywa zmiane propsa/identyfikatora (zmiana propsa, odmontowanie → tu; dwie rownolegle operacje → wyscig)' },
  'wyscig-i-wspolbieznosc': { os: 'correctness', opis: 'dwie rownolegle operacje albo wartosc sprzed await psuja wynik' },
  'sciezka-bledu': { os: 'correctness', opis: 'blad psuje stan dla uzytkownika albo niszczy dane zamiast byc obsluzony (skutek dla uzytkownika/danych → tu; brak sladu tylko dla operatora → polkniety-blad)' },
  'bramka-na-jednej-drodze': { os: 'correctness', opis: 'warunek chroni jedna droge do operacji, a inna go omija' },
  'dopasowanie-tekstu': { os: 'correctness', opis: 'parsowanie albo porownanie tekstu, HTML, URI lub zbiorow daje zly wynik (regex, includes, wielkosc liter, Set gubi krotnosc); gdy skutkiem jest obejscie kontroli dostepu → bramka-czarna-lista' },
  'wartosc-graniczna': { os: 'correctness', opis: 'zle zachowanie na granicy zakresu: 0, 1, limit, maksymalna dlugosc' },
  'limit-czasu-i-ponowien': { os: 'correctness', opis: 'wywolanie bez limitu czasu albo petla ponowien bez sufitu' },
  'spojnosc-dwoch-systemow': { os: 'correctness', opis: 'kod zaklada o innym systemie (baza, cudze API, drugi proces) cos, co nie jest prawda' },
  'bramka-czarna-lista': { os: 'security', opis: 'kontrola dostepu wylicza, co blokuje (albo dopasowuje niedokladnie), i domyslnie przepuszcza reszte' },
  'zaufanie-danym-klienta': { os: 'security', opis: 'decyzja (limit, dostep) oparta na danych, ktore kontroluje klient: naglowek, content-length' },
  'pii-i-sekrety': { os: 'security', opis: 'dane osobowe albo sekret trafiaja do logu, Sentry, repo albo argv' },
  'walidacja-granicy-api': { os: 'security', opis: 'dane z zewnatrz wchodza bez walidacji ksztaltu (Zod) na granicy' },
  'uprawnienia-naglowki-sql': { os: 'security', opis: 'grant bazy za szeroki albo za waski, brak naglowkow bezpieczenstwa HTTP, sklejanie SQL' },
  'test-niefalsyfikowalny': { os: 'test', opis: 'test przechodzi takze wtedy, gdy zachowanie jest zepsute' },
  'luka-pokrycia': { os: 'test', opis: 'zachowanie z planu albo sciezka bledu nie ma testu' },
  'test-kruchy': { os: 'test', opis: 'test pada od zmiany niezwiazanej z zachowaniem (twarde liczby, kolejnosc)' },
  'tekst-ui': { os: 'spec', opis: 'tekst dla uzytkownika obiecuje cos, czego kod nie robi, albo niesie zle dane' },
  'kontrakt-wspolny': { os: 'spec', opis: 'dwie warstwy (SQL, Zod, typ, dwie bramki) JUZ opisuja to samo pole inaczej (kopia na razie zgodna → duplikacja)' },
  'zgodnosc-prawna': { os: 'brak', opis: 'dokument prawny niezgodny z przepisami (np. brak elementow z art. 13 RODO)' },
  'polkniety-blad': { os: 'code-quality', opis: 'pusty catch albo blad polkniety: operator nie widzi przyczyny (kod bledu, stderr)' },
  'duplikacja': { os: 'code-quality', opis: 'ta sama logika albo stala w dwoch miejscach, na razie zgodnych, ktore moga sie rozjechac' },
  'martwy-kod-lub-komentarz': { os: 'code-quality', opis: 'nieosiagalna galaz albo komentarz, ktory nie zgadza sie z kodem' },
  'cache-i-zapytania': { os: 'performance', opis: 'zbedne zapytania, zly cache albo wspolne wiadro limitera spowalnia / blokuje klientow' },
  'seed-e2e': { os: 'e2e', opis: 'seed testow E2E niezgodny z kontraktem migracji' },
  'migracja-bazy': { os: 'brak', opis: 'migracja blokuje tabele, nie jest idempotentna albo wchodzi w zlej kolejnosci' },
  'a11y': { os: 'brak', opis: 'dostepnosc: fokus, klawiatura, kontrast, atrybuty ARIA' },
  'wada-dokumentu-sterujacego': { os: 'brak', opis: 'CLAUDE.md, plan albo instrukcja projektu kaze zrobic cos zlego albo sama sobie przeczy' },
  'prog-rozmiaru': { os: 'brak', opis: 'plik albo funkcja przekracza prog linii z konwencji' },
  'konwencja-kodu': { os: 'brak', opis: 'bot cytuje regule projektu (typowanie as/any, eksporty, importy, style, console, Act/Assert, rate limit)' },
  'preferencja-bota': { os: 'brak', opis: 'sugestia bota bez defektu i bez reguly projektu (rada, preferencja formatowania)' },
  'teza-obalona': { os: 'brak', opis: 'uwaga bota nieprawdziwa albo wycofana przez samego bota' },
  'odpowiedz-bota': { os: 'brak', opis: 'odpowiedz bota w watku (potwierdzenie poprawki), nie nowa uwaga' },
  'inna': { os: 'brak', opis: 'nic z listy nie pasuje — uzasadnienie w polu uzasadnienie' },
}
const OSIE_UWAG = ['security', 'correctness', 'spec', 'test', 'performance', 'code-quality', 'e2e', 'brak']
const WAGI_UWAG = ['P1', 'P2', 'P3', '0']

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
          uzasadnienie: { type: 'string', description: 'dlaczego ta klasa; przy "odrzuc" nazwa dokumentu decyzji (CLAUDE.md, docs/plans/<plik>, docs/CONCEPTS.md, docs/decisions/<plik>) i uzasadnienie' },
          wplywNaProjekt: {
            type: 'string',
            description: 'wplyw na TERAZ i na DALSZY CIAG: czy to klasa bledu, ktora sie powtorzy; czy dotyka kontraktu, schematu bazy albo granicy zaufania; czy blokuje kolejne fazy. To jest to, co operator widzi przy wyborze',
          },
          klaster: { type: ['string', 'null'], description: 'identyfikator wspolnej przyczyny — watki z tym samym klastrem zamyka JEDNA naprawa' },
          klasaBledu: { type: 'string', enum: Object.keys(KLASY_BLEDOW), description: 'klasa BLEDU ze slownika (niezalezna od decyzji w polu klasa)' },
          os: { type: 'string', enum: OSIE_UWAG, description: 'ktory reviewer pipeline\'u powinien byl to zlapac; domyslnie os klasy ze slownika' },
          waga: { type: 'string', enum: WAGI_UWAG, description: 'P1 bezpieczenstwo/utrata danych/awaria, P2 defekt zachowania, P3 drobny, 0 nie-defekt' },
        },
        required: ['id', 'plik', 'streszczenie', 'klasa', 'uzasadnienie', 'wplywNaProjekt', 'klasaBledu', 'os', 'waga'],
      },
    },
    prNumer: { type: ['integer', 'null'], description: 'numer pull requesta z gh pr view' },
    headRefOid: { type: ['string', 'null'], description: 'SHA czubka galezi z gh pr view — z niego JS liczy token tury' },
    mergeable: { type: ['string', 'null'] },
    mergeStateStatus: { type: ['string', 'null'] },
    ciZielone: { type: 'boolean' },
    ciDetal: { type: 'string' },
    plikiPr: { type: ['integer', 'null'], description: 'liczba zmienionych plikow PR (gh pr view --json changedFiles) — mianownik miary jakosci' },
    recenzjaAktualna: { type: 'boolean', description: 'czy pobrana recenzja dotyczy biezacego headRefOid' },
    uwagi: { type: ['string', 'null'], description: 'cokolwiek, co operator powinien wiedziec o samym zbieraniu (np. ucieta lista watkow)' },
  },
  required: ['watki', 'headRefOid', 'mergeable', 'mergeStateStatus', 'ciZielone', 'ciDetal', 'recenzjaAktualna', 'plikiPr'],
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

const UZGODNIENIE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    glowna: { type: 'string', description: 'domyslna galaz repo' },
    naGlownej: { type: 'boolean', description: 'biezaca galaz = glowna, drzewo czyste poza CLAUDE.md, pull --ff-only bez bledu' },
    plikDecyzji: { type: ['string', 'null'], description: 'docs/decisions/<data>-<zadanie>.md na glownej; null = brak' },
    poleClaudeMd: { type: ['string', 'null'], description: 'wartosc claude_md z frontmattera przed zmiana' },
    fakty: { type: 'array', items: { type: 'string' }, description: "punkty sekcji Do CLAUDE.md po merge'u (bez \"brak\")" },
    znPrzed: { type: ['integer', 'null'], description: 'git show HEAD:CLAUDE.md | wc -m' },
    znPo: { type: ['integer', 'null'], description: 'wc -m < CLAUDE.md po zmianie' },
    zmiany: { type: 'string', description: 'co dopisano, poprawiono, usunieto w CLAUDE.md' },
    uwagi: { type: ['string', 'null'] },
  },
  required: ['glowna', 'naGlownej', 'plikDecyzji', 'poleClaudeMd', 'fakty', 'znPrzed', 'znPo', 'zmiany'],
}

const UZGODNIENIE_COMMIT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pole: { type: ['string', 'null'], description: 'wartosc claude_md w HEAD po commicie' },
    commit: { type: ['string', 'null'] },
    push: { type: 'boolean' },
    pushDetal: { type: 'string' },
  },
  required: ['pole', 'commit', 'push', 'pushDetal'],
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
    plikPropozycji: { type: ['string', 'null'], description: 'docs/reviews/propozycje-do-reviewerow.md, gdy dopisano sekcje' },
    commit: { type: ['string', 'null'] },
  },
  required: ['pliki', 'regula', 'propozycjeDoReviewerow', 'plikPropozycji'],
}

// ── Decyzje dev-pr (P5) ───────────────────────────────────────────────────
// Decyzje etapow zapadaja tutaj, w funkcjach czystych (__tests__/dev-pr.test.mjs); agenci zbieraja fakty i wykonuja.

// Zrodla decyzji projektowej, na ktore moze powolac sie odrzucenie uwagi bota (docs/decisions/ od P4 — tam ida decyzje zadan).
const ZRODLA_DECYZJI = /CLAUDE\.md|docs\/plans\/\S*|docs\/CONCEPTS\.md|docs\/decisions\/\S*/g
const MIN_UZASADNIENIA = 20

// Sam backtick przepuszczal odrzucenie z fragmentem kodu jako „cytat” (ETAP1B §4). Wymagamy nazwy dokumentu i uzasadnienia
// poza nia — „odrzuc” to jedyna klasa, w ktorej agent moze cicho zamknac trafna uwage bota wlasnym zdaniem.
function odrzucenieUzasadnione(uzasadnienie) {
  const tekst = uzasadnienie || ''
  const bezZrodel = tekst.replace(ZRODLA_DECYZJI, '')
  return bezZrodel !== tekst && bezZrodel.trim().length >= MIN_UZASADNIENIA
}

// Tury 2–3 szly do `napraw` z pominieciem `zbierz` (ETAP1B §4: 3 agenty zbierz, 7 napraw) — bez rubryki i bez guarda.
// `zbierz` stempluje kazdy watek tokenem tury, `napraw` przyjmuje tylko watki z tokenem swojej tury.
function tokenTury(tura, headRefOid) {
  return `tura-${tura}@${String(headRefOid || '').slice(0, 12)}`
}

function watkiTury(watki, token, tura) {
  if (!token || !token.startsWith(`tura-${tura}@`)) {
    return {
      watki: [], bezTokenu: watki.map((w) => w.id),
      blad: `brak tokenu tury ${tura} (jest: ${token || 'brak'}) — uruchom etap zbierz w tej turze i przekaz jego watki z polem token`,
    }
  }
  return { watki: watki.filter((w) => w.token === token), bezTokenu: watki.filter((w) => w.token !== token).map((w) => w.id), blad: null }
}

// Uwagi per runda bota 17,1 / 2,1 / 2,3 / 1,5 — krzywa nie zbiega do zera, a rundy 3+ maja 69% Major (ETAP1B §4).
const SUFIT_TUR = 3

// Kazdy warunek merge'a osobno, zeby raport mowil, KTORY nie przeszedl. Merge jest nieodwracalny z poziomu pipeline'u.
function warunkiMerge(stan) {
  return [
    { nazwa: 'mergeable = MERGEABLE', ok: stan.mergeable === 'MERGEABLE', jest: String(stan.mergeable), watki: false },
    { nazwa: 'mergeStateStatus = CLEAN', ok: stan.mergeStateStatus === 'CLEAN', jest: String(stan.mergeStateStatus), watki: false },
    { nazwa: 'zero nierozwiazanych watkow klasy napraw', ok: stan.watkiNapraw === 0, jest: `${stan.watkiNapraw}`, watki: true },
    { nazwa: 'zero watkow do-operatora', ok: stan.watkiDoOperatora === 0, jest: `${stan.watkiDoOperatora}`, watki: true },
    { nazwa: 'CI zielone', ok: stan.ciZielone === true, jest: stan.ciDetal, watki: false },
  ]
}

// Bramka zwracala liste faktow bez werdyktu i zaden epizod nie doszedl do merge'a (ETAP1B §4). Werdykt rozroznia warunek
// naprawialny kolejna tura (watki napraw) od wymagajacego czlowieka (watki do-operatora, sufit tur, CI, konflikt).
function rekomendacja(stan, turyWykonane) {
  if (stan.watkiDoOperatora > 0) return `DECYZJA OPERATORA — ${stan.watkiDoOperatora} watkow wymaga decyzji produktowej`
  if (stan.watkiNapraw > 0) {
    return turyWykonane < SUFIT_TUR
      ? `KOLEJNA TURA — ${stan.watkiNapraw} watkow do naprawy (tura ${turyWykonane + 1} z ${SUFIT_TUR})`
      : `DECYZJA OPERATORA — sufit ${SUFIT_TUR} tur wyczerpany, ${stan.watkiNapraw} watkow do naprawy zostalo`
  }
  const blokady = warunkiMerge(stan).filter((w) => !w.ok && !w.watki)
  if (blokady.length) return `NIE MERGUJ — ${blokady.map((w) => `${w.nazwa} (jest: ${w.jest})`).join('; ')}`
  return 'MERGUJ'
}

// Raport tury: dane plik:linia | zarzut | uzasadnienie sa w watki[] z etapu zbierz, a naprawa zwraca same id —
// brakowalo zlaczenia (ETAP1B §4). Tabela idzie do rozmowy, nie na dysk: commit raportu wywolalby kolejna recenzje bota.
function komorka(tekst) {
  return String(tekst || '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')
}

function decyzjaWatku(w, naprawa) {
  if (naprawa.naprawione.includes(w.id)) return 'naprawiony'
  if (naprawa.odrzucone.includes(w.id)) return 'odrzucony'
  if (naprawa.nieruszone.includes(w.id)) return 'nieruszony'
  if (w.klasa === 'do-operatora') return 'do operatora'
  return 'pominiety'
}

function tabelaTury(tura, watki, naprawa) {
  return [
    `| Tura ${tura}: plik:linia | zarzut | decyzja | uzasadnienie |`,
    '|---|---|---|---|',
    ...watki.map((w) => `| ${komorka(w.plik)} | ${komorka(w.streszczenie)} | ${decyzjaWatku(w, naprawa)} | ${komorka(w.uzasadnienie)} |`),
  ].join('\n')
}

// CLAUDE.md oferty urosl 3,4k -> 89,7k zn w 4 tygodnie (~4,3k na PR), a czyta go kazdy builder i reviewer. Prog przyrostu
// na jedno zadanie (decyzja operatora 2026-10-02: bez sufitu bezwzglednego); skrocenie zawsze przechodzi.
const PRZYROST_CLAUDE_MD = 2000

function bramkaClaudeMd(znPrzed, znPo) {
  if (!Number.isInteger(znPrzed) || !Number.isInteger(znPo)) return `brak pomiaru rozmiaru CLAUDE.md (przed: ${znPrzed}, po: ${znPo})`
  const przyrost = znPo - znPrzed
  if (przyrost <= PRZYROST_CLAUDE_MD) return null
  return `CLAUDE.md urosl o ${przyrost} zn (${znPrzed} -> ${znPo}), prog przyrostu na zadanie ${PRZYROST_CLAUDE_MD} zn`
}

// Pole zmienia skrypt, nie agent z wolnej reki: bootstrap autopilota czyta je dokladnie (`^claude_md: `). Kod 3 = pola
// `do-uzgodnienia` nie ma. Sciezka pochodzi z wyniku agenta, wiec przed wklejeniem do powloki — wylacznie nazwa pliku.
function komendaUzgodnienia(plik) {
  if (!/^docs\/decisions\/[\w.-]+\.md$/.test(plik || '')) return null
  return `node -e 'const fs=require("fs");const p=process.argv[1];const t=fs.readFileSync(p,"utf8");const n=t.replace(/^claude_md: do-uzgodnienia$/m,"claude_md: uzgodniono");if(n===t){console.error("brak pola claude_md: do-uzgodnienia w "+p);process.exit(3)}fs.writeFileSync(p,n)' ${plik}`
}
// ── Koniec decyzji dev-pr ─────────────────────────────────────────────────

// ── Wejscie ───────────────────────────────────────────────────────────────

const etap = (args && args.etap) || 'start'
const zadanie = args && args.zadanie
const tura = (args && Number.isInteger(args.tura)) ? args.tura : 1
const auto = !!(args && args.auto)
// Lista id watkow wybranych przez operatora (tryb interaktywny). null = tryb autonomiczny,
// wybor liczy sam agent naprawy wg rubryki (napraw + napraw-szerzej).
const wybor = (args && Array.isArray(args.wybor)) ? args.wybor : null
const watkiWejsciowe = (args && Array.isArray(args.watki)) ? args.watki : []
const tokenWejsciowy = (args && typeof args.token === 'string') ? args.token : null
// Etap merge: ile tur napraw juz wykonano (licznik skilla) — rekomendacja odroznia KOLEJNA TURE od sufitu.
const turyWykonane = (args && Number.isInteger(args.turyWykonane)) ? args.turyWykonane : 0

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
    { schema: START, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `pr:start:${zadanie}` }
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

1. Ustal numer PR, czubek galezi i liczbe zmienionych plikow (\`gh pr view --json number,headRefOid,changedFiles\` → \`prNumer\`, \`headRefOid\`, \`plikiPr\`)
   i pobierz WSZYSTKIE watki review przez GraphQL
   (zapytanie w bloku gh nizej). Wez tylko te z \`isResolved: false\`. Dolacz tresc recenzji ogolnych
   (\`gh pr view --json reviews\`) jako pozycje z plikiem "(recenzja ogolna)".
2. Ustal \`recenzjaAktualna\`: czy najnowsza recenzja bota dotyczy biezacego \`headRefOid\`. Gdy recenzja jest
   starsza od czubka galezi, ustaw false — skill zdecyduje, czy czekac na recenzje przyrostowa.
3. Dla KAZDEGO watku ustal klase wg rubryki:

| Klasa | Kryterium |
|---|---|
| \`napraw\` | realny defekt: bezpieczenstwo, poprawnosc, utrata danych, zlamany kontrakt — ALBO drobiazg tanszy do naprawy niz do dyskusji |
| \`napraw-szerzej\` | uwaga trafna i wystepujaca TAKZE w blizniaczych miejscach; naprawa ma objac wszystkie. Zanim uzyjesz tej klasy, ZNAJDZ te miejsca gropem i wymien je w uzasadnieniu |
| \`odrzuc\` | bot nie zna decyzji projektowej. **Wymaga nazwy dokumentu** (CLAUDE.md, docs/plans/<plik>, docs/CONCEPTS.md, docs/decisions/<plik>) i uzasadnienia poza nia (min. 20 znakow). Sam fragment kodu w backtickach nie jest zrodlem decyzji — wtedy \`do-operatora\` |
| \`do-operatora\` | wymaga decyzji produktowej albo ryzyka nie da sie ograniczyc w tej turze |

   Przeczytaj ostatni komentarz bota w watku: gdy po naszej odpowiedzi podtrzymuje zarzut, nie klasyfikuj watku jako \`odrzuc\`.
4. Dla kazdego watku wypelnij \`wplywNaProjekt\` — to jest pole, ktore operator czyta przy wyborze.
   Odpowiedz w nim na trzy pytania, konkretnie, nie ogolnikami:
   - czy to KLASA bledu, ktora sie powtorzy (czy zobaczymy to samo w kolejnym pull requescie)?
   - czy dotyka kontraktu API, schematu bazy albo granicy zaufania (walidacja, autoryzacja, wejscie z zewnatrz)?
   - czy blokuje kolejne fazy z mapy faz zadania?
   Uwaga dotyczaca nazwy zmiennej i uwaga o braku walidacji na endpointcie NIE moga miec tego samego wpisu.
5. Dla KAZDEGO watku przypisz \`klasaBledu\` — DOKLADNIE jedna nazwe z listy (opis rozstrzyga; nic nie pasuje → \`inna\`
   i powod w uzasadnieniu), \`os\` (ktory nasz reviewer powinien byl to zlapac; domyslnie os podana przy klasie) i \`waga\`
   (P1 bezpieczenstwo / utrata danych / awaria, P2 defekt zachowania, P3 drobny, 0 nie-defekt: preferencja, konwencja bez skutku,
   teza obalona). Klasa bledu opisuje CO jest zle; decyzja z punktu 3 — co z tym robimy. To dwa niezalezne pola.
${Object.entries(KLASY_BLEDOW).map(([k, v]) => `   - \`${k}\` [os: ${v.os}] — ${v.opis}`).join('\n')}
6. KLASTRUJ watki o wspolnej przyczynie: nadaj im ten sam \`klaster\` (krotki identyfikator, np.
   "brak-limitu-czasu-http"). Jedna naprawa zamyka wtedy kilka komentarzy i tak tez zostana policzone.
7. Odczytaj stan PR i CI wg bloku stanu nizej (\`mergeable\`, \`mergeStateStatus\`, \`ciZielone\`, \`ciDetal\`) — z niego
   i z klas orkiestrator liczy rekomendacje tury.

Nie zgaduj tresci watku z samego tytulu — przeczytaj komentarze i zajrzyj do wskazanego pliku.
Zwroc obiekt zgodny ze schematem.${BLOK_STANU_PR}${BLOK_GH}`,
    { schema: ZEBRANE, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `pr:zbierz:tura-${tura}` }
  )
  if (!wynik) return { status: 'BLAD', etap, powod: 'Zbieranie watkow zwrocilo null (agent padl).' }

  // Liczniki w JS (Filar 3: agent nigdy nie liczy tego, co JS wie na pewno).
  const token = tokenTury(tura, wynik.headRefOid)
  const watki = (wynik.watki || []).map((w) => ({ ...w, token }))
  const licznik = {}
  for (const k of KLASY) licznik[k] = watki.filter((w) => w.klasa === k).length
  const klastry = [...new Set(watki.map((w) => w.klaster).filter(Boolean))]
  // "odrzuc" bez zrodla decyzji jest niedozwolone — pilnujemy tego w kodzie, nie tylko w prompcie.
  const odrzuconeBezCytatu = watki.filter((w) => w.klasa === 'odrzuc' && !odrzucenieUzasadnione(w.uzasadnienie))
  for (const w of odrzuconeBezCytatu) {
    w.klasa = 'do-operatora'
    w.uzasadnienie = `[PRZEKLASYFIKOWANE z "odrzuc": brak cytatu ze zrodla decyzji] ${w.uzasadnienie || ''}`
  }
  if (odrzuconeBezCytatu.length) {
    licznik['odrzuc'] -= odrzuconeBezCytatu.length
    licznik['do-operatora'] += odrzuconeBezCytatu.length
    log(`/dev-pr: ${odrzuconeBezCytatu.length}x klasa "odrzuc" bez cytatu ze zrodla decyzji -> przeklasyfikowane na "do-operatora"`)
  }
  const rek = rekomendacja({
    mergeable: wynik.mergeable, mergeStateStatus: wynik.mergeStateStatus, ciZielone: wynik.ciZielone, ciDetal: wynik.ciDetal,
    watkiNapraw: licznik['napraw'] + licznik['napraw-szerzej'], watkiDoOperatora: licznik['do-operatora'],
  }, tura - 1)
  log(`/dev-pr tura ${tura}: rekomendacja ${rek}`)
  log(`/dev-pr tura ${tura}: ${watki.length} nierozwiazanych watkow (napraw ${licznik['napraw']}, szerzej ${licznik['napraw-szerzej']}, odrzuc ${licznik['odrzuc']}, do-operatora ${licznik['do-operatora']}), klastrow: ${klastry.length}${wynik.recenzjaAktualna ? '' : ' — UWAGA: recenzja NIE dotyczy biezacego czubka galezi'}`)
  // plikiPr i prNumer ida do wyniku runu — z niego telemetria buduje run.pr (miara: P1/P2 bota na 100 plikow PR).
  return { status: 'OK', etap, tura, rekomendacja: rek, token, watki, licznik, klastry, recenzjaAktualna: wynik.recenzjaAktualna, plikiPr: wynik.plikiPr, prNumer: wynik.prNumer ?? null, uwagi: wynik.uwagi || null }
}

// ── Etap: napraw (Faza 4 — naprawa, odpowiedzi, commit, push) ─────────────

if (etap === 'napraw') {
  if (tura > SUFIT_TUR) {
    return { status: 'STOP', etap, tura, powod: `sufit ${SUFIT_TUR} tur — tura ${tura} nie startuje`, naprawa: "Zamknij PR bramka merge'a (etap merge) i oddaj decyzje operatorowi." }
  }
  const zTury = watkiTury(watkiWejsciowe, tokenWejsciowy, tura)
  if (zTury.blad) {
    log(`/dev-pr tura ${tura}: STOP — ${zTury.blad}`)
    return { status: 'STOP', etap, tura, powod: zTury.blad, naprawa: `Wywolaj etap zbierz z tura ${tura}, potem napraw z jego watkami i tokenem.` }
  }
  if (zTury.bezTokenu.length) log(`/dev-pr tura ${tura}: ${zTury.bezTokenu.length} watkow bez tokenu tej tury pominietych (${zTury.bezTokenu.join(', ')})`)
  // Wybor liczy JS, nie agent: w trybie autonomicznym rubryka jest deterministyczna (napraw +
  // napraw-szerzej), a w interaktywnym decyzja nalezy do operatora i przychodzi w args.wybor.
  const doNaprawy = wybor
    ? zTury.watki.filter((w) => wybor.includes(w.id))
    : zTury.watki.filter((w) => w.klasa === 'napraw' || w.klasa === 'napraw-szerzej')
  const doOdrzucenia = zTury.watki.filter((w) => w.klasa === 'odrzuc' && !doNaprawy.includes(w))
  const doOperatora = zTury.watki.filter((w) => w.klasa === 'do-operatora')

  if (!doNaprawy.length && !doOdrzucenia.length) {
    log(`/dev-pr tura ${tura}: nic do naprawy i nic do odrzucenia — tura pusta`)
    const tabela = tabelaTury(tura, zTury.watki, { naprawione: [], odrzucone: [], nieruszone: [] })
    return { status: 'OK', etap, tura, pusta: true, tabela, doOperatora: doOperatora.map((w) => w.id) }
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
   - odrzucony: dlaczego — dokument decyzji i uzasadnienie z pola \`uzasadnienie\`. Odmowa bez dokumentu decyzji
     jest niedopuszczalna — wtedy NIE odpowiadaj odmowa, tylko zostaw watek nieruszony.
   Odpowiedzi pisz po polsku. NIE rozwiazuj watkow — rozwiazany watek znika operatorowi z widoku.
4. COMMIT jawnym pathspec zmienionych plikow (ZAKAZ \`git add -A\` i \`git add .\`), komunikat
   \`fix(pr): tura ${tura} — poprawki po review bota\`. Potem \`git push\`.
5. GUARD PLIKOW BINARNYCH: po commicie \`git diff --numstat HEAD~1..HEAD\`; plik z "-" zamiast liczb,
   ktory NIE jest legalnym binarium (.png .jpg .jpeg .gif .webp .avif .ico .bmp, .woff .woff2 .ttf .otf,
   .pdf .zip .gz .mp4 .mp3, bun.lockb), wpisz do plikiBinarne[]. Typowa przyczyna: surowe bajty sterujace
   wpisane do pliku zrodlowego zamiast sekwencji ucieczki — kazdy kolejny agent padnie na jego Read.

Watek, ktorego nie zamknales, wpisz do nieruszone[] — nie udawaj, ze zostal zaadresowany.
${BLOK_KOMEND_PROJEKTU}${BLOK_GH}`,
    { schema: NAPRAWA, agentType: 'klasa-naprawiacz', effort: 'high', label: `pr:napraw:tura-${tura}` }
  )
  if (!wynik) return { status: 'BLAD', etap, tura, powod: 'Agent naprawczy zwrocil null — zmiany moga byc czesciowo na dysku, sprawdz `git status`.' }
  const tabela = tabelaTury(tura, zTury.watki, wynik)

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
      status: 'STOP', etap, tura, ...wynik, tabela,
      powod: `Tura ${tura}: walidacja po naprawach zakonczyla sie FAIL, wiec nic nie zostalo zacommitowane ani wypchniete. ${wynik.walidacjaDetal || ''}`,
      naprawa: 'Doprowadz walidacje do zieleni recznie (zmiany sa w drzewie roboczym), zacommituj, wypchnij — i wroc do /dev-pr po kolejna recenzje przyrostowa.',
    }
  }
  if (wynik.walidacja === 'BRAK-KOMEND') {
    log(`/dev-pr tura ${tura}: package.json nie ma skryptow walidacyjnych — poprawki poszly BEZ bramki jakosci (${wynik.walidacjaDetal || ''})`)
  }
  log(`/dev-pr tura ${tura}: naprawiono ${wynik.naprawione.length}, odrzucono ${wynik.odrzucone.length}, nieruszone ${wynik.nieruszone.length}, odpowiedzi ${wynik.odpowiedziWyslane}, commit ${wynik.commit || 'brak'}, push ${wynik.push ? 'tak' : 'NIE'}`)
  return { status: 'OK', etap, tura, ...wynik, tabela, doOperatora: doOperatora.map((w) => w.id) }
}

// ── Etap: merge (Faza 6 — bramka merge'a) ─────────────────────────────────

if (etap === 'merge') {
  const stan = await agent(
    `Zbierz stan pull requesta zadania "${zadanie}" na potrzeby bramki merge'a. NICZEGO nie mergeuj,
nie zmieniaj kodu i nie odpowiadaj w watkach — masz TYLKO odczytac fakty.

1. Stan PR i CI wg bloku stanu nizej.
2. Policz nierozwiazane watki review (GraphQL jak w bloku gh): \`watkiNapraw\` = te, ktore dotycza realnego
   defektu do naprawy, \`watkiDoOperatora\` = te wymagajace decyzji produktowej. Watki \`isResolved: true\`
   i watki, na ktore odpowiedzielismy odmowa z cytatem, NIE licza sie do zadnej z tych liczb.

Zwroc obiekt zgodny ze schematem.${BLOK_STANU_PR}${BLOK_GH}`,
    { schema: MERGE_STAN, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `pr:merge-stan:${zadanie}` }
  )
  if (!stan) return { status: 'BLAD', etap, powod: 'Odczyt stanu PR zwrocil null (agent padl).' }

  // BRAMKA LICZONA W JS: MERGUJ wtedy i tylko wtedy, gdy wszystkie warunki z warunkiMerge sa spelnione.
  const warunki = warunkiMerge(stan).map(({ nazwa, ok, jest }) => ({ nazwa, ok, jest }))
  const rek = rekomendacja(stan, turyWykonane)
  log(`/dev-pr: rekomendacja ${rek}`)
  if (rek !== 'MERGUJ') {
    const niespelnione = warunki.filter((w) => !w.ok)
    return { status: 'GOTOWY-DO-DECYZJI', etap, rekomendacja: rek, stan, niespelnione, warunki }
  }
  if (!auto) {
    log("/dev-pr: wszystkie warunki merge'a spelnione — merge zostaje decyzja operatora (tryb interaktywny)")
    return { status: 'GOTOWY-DO-MERGE', etap, rekomendacja: rek, stan, warunki }
  }
  const merge = await agent(
    `Wszystkie warunki bramki merge'a dla pull requesta zadania "${zadanie}" zostaly spelnione i zweryfikowane
w kodzie orkiestratora (mergeable, mergeStateStatus, zero watkow do naprawy, zero do operatora, CI zielone).
Wykonaj merge: \`gh pr merge --squash --delete-branch\`. Gdy komenda zwroci blad — NIE probuj innych strategii
ani \`--admin\`: zwroc zmergowany=false z trescia bledu. Zwroc obiekt zgodny ze schematem.${BLOK_GH}`,
    { schema: MERGE_WYNIK, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `pr:merge:${zadanie}` }
  )
  if (!merge) return { status: 'BLAD', etap, stan, powod: 'Merge zwrocil null — sprawdz stan PR recznie przed ponowieniem.' }
  log(`/dev-pr: merge ${merge.zmergowany ? 'wykonany' : 'NIE wykonany'} — ${merge.detal}`)
  return { status: merge.zmergowany ? 'ZMERGOWANY' : 'GOTOWY-DO-DECYZJI', etap, rekomendacja: rek, stan, merge, warunki }
}

// ── Etap: claude-md (po potwierdzonym merge'u — CLAUDE.md uzgodniony z kodem) ─

// Potwierdzeniem merge'u jest plik decyzji zadania na glownej: trafia tam tylko z commitem archiwizacji zmergowanego PR.
// Bootstrap autopilota zatrzymuje kolejne zadanie, dopoki pole claude_md nie jest `uzgodniono`.
if (etap === 'claude-md') {
  const u = await agent(
    `Uzgadniasz CLAUDE.md z kodem po merge'u pull requesta zadania "${zadanie}". NIE commitujesz — commit robi
nastepny krok, po bramce rozmiaru liczonej w orkiestratorze.

1. GALAZ: glowna = \`gh repo view --json defaultBranchRef -q .defaultBranchRef.name\`; bez remote albo bez gh: main, gdy
   \`git rev-parse --verify --quiet refs/heads/main\` zwraca SHA, inaczej master. naGlownej = false (i koniec, nic nie zmieniaj),
   gdy \`git branch --show-current\` to inna galaz albo \`git status --porcelain\` ma linie inne niz CLAUDE.md. Gdy \`git remote\`
   jest niepusty: \`git pull --ff-only\`; blad = naGlownej false i tresc bledu w uwagi.
2. PLIK DECYZJI: \`ls docs/decisions/*-${zadanie}.md\`. Brak = plikDecyzji null i koniec. poleClaudeMd = wartosc linii
   \`claude_md:\` z frontmattera. Wartosc "uzgodniono" = koniec bez zmian (krok juz wykonany).
3. FAKTY: punkty sekcji "## Do CLAUDE.md po merge'u" do fakty[] (punkt "brak" pomin).
4. znPrzed = \`git show HEAD:CLAUDE.md | wc -m\` (brak CLAUDE.md w HEAD = 0).
5. Gdy fakty[] niepuste, wprowadz je do CLAUDE.md: kazdy fakt raz, w sekcji, ktorej dotyczy. Zdanie, ktoremu fakt przeczy,
   popraw albo usun zamiast dopisywac obok. Bez historii zadania, dat i uzasadnien — te zostaja w pliku decyzji. Fakt, ktory
   CLAUDE.md juz zawiera, pomin. Innych zmian w CLAUDE.md nie rob.
6. znPo = \`wc -m < CLAUDE.md\`. W zmiany jednym-dwoma zdaniami: co dopisano, poprawiono, usunieto (albo "bez zmian").

Zwroc obiekt zgodny ze schematem.`,
    { schema: UZGODNIENIE, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `pr:claude-md:${zadanie}` }
  )
  if (!u) return { status: 'BLAD', etap, powod: 'Uzgodnienie CLAUDE.md zwrocilo null (agent padl) — sprawdz `git status` przed ponowieniem.' }
  const ponow = `/dev-pr --claude-md ${zadanie}`
  if (!u.naGlownej) {
    return { status: 'STOP', etap, powod: `krok CLAUDE.md wymaga galezi ${u.glowna} z czystym drzewem${u.uwagi ? ` (${u.uwagi})` : ''}`, naprawa: `\`git switch ${u.glowna} && git pull --ff-only\`, potem ${ponow}` }
  }
  if (!u.plikDecyzji) {
    return { status: 'STOP', etap, powod: `brak pliku docs/decisions/<data>-${zadanie}.md na ${u.glowna} — PR niezmergowany albo zadanie sprzed docs/decisions/`, naprawa: `Po merge'u PR: ${ponow}` }
  }
  if (u.poleClaudeMd === 'uzgodniono') {
    log(`/dev-pr: ${u.plikDecyzji} juz ma claude_md: uzgodniono — bez zmian`)
    return { status: 'OK', etap, plikDecyzji: u.plikDecyzji, juzUzgodniono: true }
  }
  const bramka = bramkaClaudeMd(u.znPrzed, u.znPo)
  if (bramka) {
    log(`/dev-pr: bramka CLAUDE.md STOP — ${bramka}`)
    return {
      status: 'STOP', etap, ...u, powod: bramka,
      naprawa: `Zmiana CLAUDE.md jest w drzewie bez commita (\`git diff CLAUDE.md\`). Przytnij ja do przyrostu <= ${PRZYROST_CLAUDE_MD} zn albo cofnij (\`git checkout -- CLAUDE.md\`), potem ${ponow}`,
    }
  }
  const komenda = komendaUzgodnienia(u.plikDecyzji)
  if (!komenda) return { status: 'BLAD', etap, powod: `nieoczekiwana sciezka pliku decyzji: ${u.plikDecyzji}` }
  const c = await agent(
    `Zamknij uzgodnienie CLAUDE.md zadania "${zadanie}" na galezi ${u.glowna}.
1. \`${komenda}\` — zmienia pole claude_md na "uzgodniono". Kod 3 = pola do-uzgodnienia nie ma: nie commituj, przejdz do pkt 3.
2. \`git add -- ${u.plikDecyzji}\` oraz \`git add -- CLAUDE.md\`, gdy plik istnieje (zadnych innych sciezek), potem
   \`git commit -m "docs(${zadanie}): CLAUDE.md uzgodniony po merge'u"\` — temat w jednej linii, stopka wylacznie drugim \`-m\`.
   commit = krotki hash.
3. pole = sama wartosc (bez "claude_md: ") z \`git show HEAD:${u.plikDecyzji} | grep -m1 '^claude_md:'\`.
4. PUSH: \`git remote\` pusty = push false, pushDetal "brak remote". Inaczej \`git push\`; blad = push false i tresc bledu
   w pushDetal — bez --force i bez innej galezi. Udany push = pushDetal "OK".
Zwroc obiekt zgodny ze schematem.`,
    { schema: UZGODNIENIE_COMMIT, agentType: 'klasa-mechaniczny', label: `pr:claude-md-commit:${zadanie}` }
  )
  if (!c || c.pole !== 'uzgodniono') {
    return { status: 'BLAD', etap, powod: `pole claude_md po commicie: ${c ? c.pole : 'brak wyniku agenta'} — sprawdz ${u.plikDecyzji} i \`git log -1\`` }
  }
  if (!c.push) log(`/dev-pr: UWAGA — commit ${c.commit} bez pusha (${c.pushDetal}); pojedzie z nastepna galezia`)
  log(`/dev-pr: CLAUDE.md uzgodniony (${u.znPrzed} -> ${u.znPo} zn), ${u.plikDecyzji}: claude_md: uzgodniono, commit ${c.commit}`)
  return { status: 'OK', etap, plikDecyzji: u.plikDecyzji, fakty: u.fakty, zmiany: u.zmiany, znPrzed: u.znPrzed, znPo: u.znPo, commit: c.commit, push: c.push, pushDetal: c.pushDetal }
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
4. Gdy propozycje sa niepuste, dopisz na koncu docs/reviews/propozycje-do-reviewerow.md sekcje
   \`## <data z \`date +%F\`> ${zadanie}\` z jedna linia na propozycje: \`- <agent> ← <klasa>: <regula> (wystapila w: <podstawa>)\`.
   Gdy pliku nie ma, utworz go z naglowkiem \`# Propozycje do reviewerow\` i zdaniem: "Propozycje z compoundu /dev-pr —
   wdrozenie w plikach agentow jest decyzja operatora." Sciezke zwroc w plikPropozycji (bez propozycji: null).
5. Zacommituj TYLKO artefakty bazy wiedzy jawnym pathspec (docs/solutions/, .claude/rules/learned-patterns.md,
   docs/CONCEPTS.md, docs/reviews/propozycje-do-reviewerow.md — te, ktore realnie zmieniles). ZAKAZ \`git add -A\` i \`git add .\`.

Zwroc obiekt zgodny ze schematem.`,
    { schema: COMPOUND_PR, agentType: 'klasa-orkiestracyjny', effort: 'medium', label: `pr:compound:${zadanie}` }
  )
  if (!wynik) return { status: 'BLAD', etap, powod: 'Compound zwrocil null — baza wiedzy nie zostala zasilona.' }
  log(`/dev-pr compound: ${wynik.pliki.length} wpisow w docs/solutions/, regula: ${wynik.regula}, propozycji do reviewerow: ${wynik.propozycjeDoReviewerow.length}`)
  // Propozycje mialy zero artefaktow w repo mimo 19 compoundow (ETAP1B §4) — brak pliku przy niepustej liscie widac w logu.
  if (wynik.propozycjeDoReviewerow.length && !wynik.plikPropozycji) log('/dev-pr compound: UWAGA — propozycje bez zapisu do docs/reviews/propozycje-do-reviewerow.md')
  return { status: 'OK', etap, ...wynik }
}

return { status: 'BLAD', powod: `Nieznany etap "${etap}". Dozwolone: start, zbierz, napraw, merge, claude-md, compound.` }

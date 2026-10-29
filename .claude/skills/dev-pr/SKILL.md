---
name: dev-pr
description: "Obsługa pull requesta od wysłania do merge'a: tworzy PR, czeka na recenzję bota, klasyfikuje uwagi wg wpływu na projekt, prowadzi tury poprawek i domyka je compoundem do bazy wiedzy. Używaj po `/dev-docs-complete`, gdy zadanie jest gotowe do wysłania, oraz gdy bot zostawił komentarze do obsłużenia."
argument-hint: "[liczba tur 1–3 — bez niej tryb interaktywny] [--bez-merge] [--czesc N] | --claude-md <zadanie>"
---

# `/dev-pr` — od pull requesta do merge'a

Skill prowadzi zadanie od `/dev-docs-complete` do merge'a: wysłanie PR, tury poprawek po uwagach bota
i compound, który zamienia te uwagi we wpisy bazy wiedzy — bez niego te same klasy błędów wracają
w kolejnym pull requeście.

**Podział ról:** mechanika żyje w `.claude/workflows/dev-pr-wf.js` (bramki liczone w JS, `gh`, naprawy,
odpowiedzi w wątkach). Ty prowadzisz rozmowę, trzymasz licznik tur i pytasz operatora. Nie wykonuj
mechaniki ręcznie — wołaj workflow etapami.

## Miejsce w pipeline

```
/dev-docs-complete → /dev-pr → merge → CLAUDE.md uzgodniony
```

## Ograniczenie, o którym musisz powiedzieć operatorowi

**Bot odpowiada nieprzewidywalnie.** W zebranych danych pull request otwarty o 22:13 dostał tury
poprawek dopiero następnego dnia o 08:58. `Monitor` jest związany z sesją, więc **tryb autonomiczny ma
sens wyłącznie w sesji, którą operator zostawia otwartą**. Powiedz to wprost przy starcie trybu
autonomicznego — jednym zdaniem, nie akapitem.

Jeśli limit czasu minie bez recenzji, kończysz raportem „bot nie odpowiedział" i **nie ruszasz kodu**.

## Tryby

| Wywołanie | Zachowanie |
|---|---|
| `/dev-pr` | **Interaktywny.** Po każdej klasyfikacji operator wybiera przez `AskUserQuestion` (multiSelect), co naprawiamy w tej turze. Merge zawsze zostaje jego decyzją. |
| `/dev-pr 3` | **Autonomiczny, do 3 tur.** Sam wybierasz wg rubryki. Po wyczerpaniu tur albo po czystej turze przechodzisz do bramki merge'a. Pytanie o review zmian po archiwizacji (krok 1) pada przed startem także w tym trybie. |
| `/dev-pr 3 --bez-merge` | Jak wyżej, ale kończysz raportem zamiast merge'em. |
| `/dev-pr --czesc N` (z trybem jak wyżej) | **Część N PR wieloczęściowego** — zadanie ma w podsumowaniu sekcję „Części PR” (archiwizacja: więcej niż 150 plików do recenzji bota). Części wysyłasz po kolei; każda przechodzi pełny cykl do merge'a. |
| `/dev-pr --claude-md <zadanie>` | Tylko krok „uzgodnij CLAUDE.md” dla zmergowanego zadania (np. po STOP-ie bootstrapu autopilota). |

**Sufit: 3 tury** w każdym trybie (`/dev-pr 5` = 3). Workflow nie wystartuje czwartej tury napraw. Wyczerpany limit = domknięcie,
nawet gdy zostały otwarte wątki. Nie proponuj „jeszcze jednej tury" — zaraportuj, co zostało, i oddaj decyzję operatorowi.
Wątki otwarte po suficie i wątki odłożone „do części N+1” przekazujesz etapowi `compound` w `odlozone` — trafiają do
`known-issues.md` zadania z linkiem wątku, a start kolejnej części zbiera nierozwiązane wątki PR poprzednich części.

## Przebieg

Ustal `zadanie` (nazwa folderu w `docs/completed/` lub `docs/active/` — z argumentu, z nazwy gałęzi
`feature/<nazwa>` albo `feature/<nazwa>-czN`, albo zapytaj), `tury` (liczba z argumentu, najwyżej 3, brak = tryb interaktywny),
`bezMerge` i `czesc` (liczba z `--czesc`; brak = zadanie jednym PR).
`--claude-md <zadanie>` → od razu krok „Uzgodnienie CLAUDE.md” z punktu 6, bez kroków 1–5.

### 1. Start — bramka wejścia i pull request

**Zmiany po archiwizacji.** Najpierw `node .claude/scripts/pr/po-archiwum.mjs --zadanie <zadanie>` (z `--czesc N` przy części).
Skrypt wylicza commity `<archiwum>..feature/<zadanie>` bez tematów pipeline'u, czyli zmiany ze smoke'u operatora, których
żaden reviewer fazy nie widział. `wTejCzesci: true` i niepuste `plikiKodu` (pliki poza `docs/` i `.claude/`) → pytanie
o review w kroku zgody niżej. `archiwum: null`, puste `plikiKodu` albo `wTejCzesci: false` → bez pytania o review
(commity po archiwum jadą w ostatniej części). PR gałęzi już istnieje (`gh pr view --json number` zwraca numer) → oba pytania
pomijasz: zmiany są już na zewnątrz, a bot je recenzuje. Kod wyjścia skryptu 3 (`wyjatek`) → podaj operatorowi błąd i pytaj
jak przy plikach kodu.

**P3 z realnym scenariuszem.** P3 osi correctness i security wracały od bota jako P2 (vibersi: co najmniej jeden na etap).
Przed pytaniem o zgodę: `git show feature/<zadanie>:docs/completed/<zadanie>/known-issues.md | grep -E '^- 🟡 \[P3/(correctness|security)\]'`
— przy `--czesc N` tylko sekcje `## P3 faza K` dla faz tej części (kolumna „Fazy” tabeli „Części PR”) oraz, przy części
ostatniej, sekcja `## P3 po archiwizacji`; bez części wszystkie.
Niepusta lista (N pozycji) → pytanie o zgodę dostaje opcję „Naprawić przed PR (N)” z listą (plik:linia, oś, opis).
Wybór → poprawka z testem dla wybranych pozycji, commit jawnymi ścieżkami, linia przeniesiona do sekcji `## Zamkniete`,
potem krok zgody od nowa. Bez wyboru operatora niczego nie naprawiasz — P3 idą do opisu PR jak dotąd.

**Otwarte wątki poprzednich części.** `--czesc N` > 1: przed pytaniem o zgodę pobierz PR części 1..N−1
(`gh pr list --state merged --head feature/<zadanie>-czK --json number,url`) i ich wątki zapytaniem GraphQL `reviewThreads`
(jak w bloku gh workflowu), tylko isResolved:false. Wypisz je w pytaniu o zgodę (PR, plik:linia, zarzut, link) — operator
decyduje, czy naprawić je przed wysłaniem części. Etap `start` dopisuje je też do opisu PR (`otwarteWatkiPoprzednich`).

**Zgoda na wysłanie.** Etap `start` wypycha gałąź i tworzy PR, czyli publikuje zmiany na zewnątrz. Przed nim zawsze pytasz
operatora przez `AskUserQuestion`: „Wysłać PR <zadanie>[, część N]?” z opcjami „Wyślij PR” i „Jeszcze nie”. Przy plikach
kodu po archiwum opcje to „Krótkie review, potem PR”, „PR bez review” i „Jeszcze nie”, a w pytaniu podajesz liczbę
commitów i plików kodu. Bez pytania wysyłasz tylko wtedy, gdy bieżąca wiadomość operatora wprost każe wysłać PR: wpisana
przez niego komenda `/dev-pr` albo polecenie „wyślij PR”, i gdy nie ma pytania o review. Zgodą nie jest instrukcja
wklejona wcześniej w sesji („Po smoke'u: /dev-pr --czesc 1”), akceptacja innej rzeczy („reszta ok”) ani wywołanie tego
skilla przez Ciebie, ani ogólne „działaj dalej” bez pytania o PR. Zgoda z tego wywołania skilla obejmuje powrót do kroku 1
po konflikcie rebase'u. „Jeszcze nie” → koniec bez etapu `start`.

**Krótkie review** (wybór operatora): dwa wywołania naraz narzędziem `Agent` z typami
`correctness-reviewer` i `security-sentinel`, każde z poleceniem: „Review commitów po archiwizacji zadania <zadanie>: `git show <sha> -- <plikiKodu>`
dla każdego commitu z `commity` (sha i tematy). Zwróć findingi P1/P2/P3 z plik:linia, scenariuszem
błędu i poprawką; bez zmian w plikach.” Pokaż findingi. P1/P2 → `AskUserQuestion`: „Naprawiam przed PR” (poprawka z testem,
commit jawnymi ścieżkami, potem krok zgody od nowa) albo „PR z findingami w opisie” (wpisz je operatorowi do raportu). Bez
P1/P2 → etap `start`. P3 (i findingi zostawione przy „PR z findingami w opisie”) dopisujesz do
`docs/completed/<zadanie>/known-issues.md` (brak pliku = utwórz z nagłówkiem `# Known issues — <zadanie>`), po linii na finding:
`- 🟡 [P3/<oś>] <plik:linia> — <opis> (krótkie review po archiwizacji)`, oś = `correctness` albo `security` (reviewer,
który go zgłosił), w sekcji `## P3 po archiwizacji` (brak = utwórz przed `## Zamkniete`); commit tego pliku jawną ścieżką przed etapem `start`. Opis PR bierze je
z known-issues, a etap 6 widzi je w archiwum zadania.

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "start", zadanie, czesc}})
```

Etap wypycha bieżącą gałąź przed utworzeniem PR (`git push -u`, bez `--force`), gdy na origin jej nie ma albo jest za
lokalną — commity smoke'u i poprawek po archiwizacji trafiają do PR. Origin z commitami, których lokalna gałąź nie ma = STOP.

`czesc` przekazujesz tylko z `--czesc`. Workflow czyta tabelę „Części PR” z podsumowania na gałęzi `feature/<zadanie>`
i przygotowuje gałąź części: część nieostatnia = gałąź `feature/<zadanie>-czN` od commitu cięcia (od części 2 jej commity
idą rebase'em na `origin/main`), część ostatnia = `git rebase --onto origin/main <cięcie>` gałęzi zadania, typecheck i testy,
`git push --force-with-lease`. Część N > 1 startuje dopiero po merge'u części N−1. Wynik `OK` niesie `czesc` i `czesci` —
przekazujesz je **w każdym** kolejnym etapie (`zbierz`, `napraw`, `merge`, `compound`, `claude-md`).

`status: "STOP"` → wypisz `powod` i **zakończ**. Nie obchodź bramki: nie commituj cudzych zmian, nie
przełączaj gałęzi, nie twórz PR z gałęzi głównej.

`status: "STOP"` z polem `rozmiar` (część albo jeden PR ≥ 150 plików do recenzji po przeliczeniu czubka — commity po
archiwizacji dołożyły pliki do liczby z archiwizacji) → `AskUserQuestion` z liczbą (`rozmiar.pliki`, `rozmiar.tabela`)
i opcjami „Dodatkowa część” i „Jeszcze nie”. „Dodatkowa część” = cięcie na commicie archiwizacji (pole `archiwum`
z `po-archiwum.mjs`): przy `--czesc N` wiersz części N kończy się na nim, a nowy wiersz N+1 biegnie od niego do „czubek
gałęzi” (fazy = ostatnia faza części N); przy jednym PR tabela „## Części PR” z dwoma wierszami (część 1 od
`git merge-base origin/main feature/<zadanie>` do niego, część 2 od niego do czubka). Liczby plików każdego wiersza
z `rozmiar.mjs --baza <od> --czubek <do>` (pole `doRecenzji`). Tabelę wpisujesz w podsumowanie zadania na
`feature/<zadanie>`, commit jawną ścieżką i znów krok 1 (`/dev-pr --czesc N`, przy jednym PR `--czesc 1`). Bez decyzji
operatora nie wysyłasz PR ponad limitem bota.

Konflikt rebase'u wyłącznie w `docs/learned-patterns.md` (indeks generowany z `docs/solutions/`) workflow rozwiązuje sam:
przelicza indeks z drzewa commitu, kontynuuje rebase i przygotowuje część od nowa (log „pliki generowane rozwiązane”).
Tak samo `supabase/migrations.sum`: workflow scala wpisy obu stron (`bramki.mjs --scal-sume`); ta sama migracja z inną sumą
po obu stronach albo suma niezgodna z migracjami to `KONFLIKT` z powodem.

`status: "KONFLIKT"` (rebase części) → rebase stoi na konflikcie w plikach `konflikty`. Zapytaj operatora przez
`AskUserQuestion`: „Rozwiąż w tej sesji” (czytasz oba warianty każdego pliku, proponujesz rozwiązanie, po akceptacji
`git add <pliki>` i `git rebase --continue`; kolejny konflikt — to samo, aż rebase się skończy; potem znów krok 1 z tym samym
`czesc`), „Rozwiążę sam” (koniec; operator wraca `/dev-pr --czesc N`) albo „Przerwij” (`git rebase --abort`, koniec). Konfliktu
nie rozwiązujesz bez tej decyzji. Gdy wśród konfliktów jest też `docs/learned-patterns.md` (plik generowany): zostaw jedną
z jego wersji, a po rebase'ie `node .claude/scripts/wiedza/wiedza.mjs indeks --zapisz` i commit indeksu. Gdy jest wśród
nich `supabase/migrations.sum`: `node .claude/scripts/bramki/bramki.mjs --scal-sume` przed `git add` (przy `scalony: false`
pokaż operatorowi `powod`).

Zadanie z tabelą „Części PR” wywołane bez `--czesc` → `STOP` z poleceniem `/dev-pr --czesc 1`: jeden PR byłby ponad limitem bota.

`status: "OK"` → powiedz jednym zdaniem, czy PR został utworzony, czy już istniał, i podaj URL.

### 2. Czekanie na recenzję bota

Czekanie prowadzi skrypt; pętli nie piszesz sam. Uruchom go przez `Monitor`:

```
Monitor({command: "node .claude/scripts/pr/czekaj-na-bota.mjs --pr <numer> --sha $(git rev-parse HEAD) --limit-min 20",
         description: "recenzja CodeRabbit PR #<numer>", timeout_ms: <(limit-min + 5) × 60000>})
```

`<numer>` = numer PR z kroku 1, `--sha` = lokalny `HEAD` po starcie albo po pushu tury napraw. **Limit czasu: 20 minut**
(domyślnie; operator może podać inny). Jedno wywołanie ma `--limit-min` najwyżej 25, bo `Monitor` żyje najwyżej 30 minut;
przy dłuższym limicie po `limit` wołasz skrypt kolejny raz z pozostałymi minutami.

Po turze napraw z `push: false` nie uruchamiaj skryptu: commit nie dotarł na GitHub, więc bot go nie zrecenzuje. Raport
„tura <N> niewypchnięta” z commitem tury, **koniec bez zmian w kodzie**. Wyjątek: tura bez commita (sama odpowiedź w wątkach
`odrzuć`, np. `KOLEJNA TURA (tylko odpowiedzi)`) nie ma czego recenzować — przechodzisz od razu do kroku 3.

Skrypt czyta status commita albo check-run `CodeRabbit` na tym czubku (od 29.10.2026 bot raportuje tylko check-run).
Tekst komentarzy bota nie mówi, czy recenzja trwa: fraza
„Reviewing files that changed…” zostaje w podsumowaniu także po zakończonej recenzji. Bot ustawia status success przed
publikacją recenzji, więc po success skrypt czeka jeszcze na recenzję bota z `commit_id` = czubek, najwyżej 2 min od statusu.
Skrypt wypisuje jedną linię JSON `{stan, powod, sha, minuty, pr, recenzja}` (`recenzja` tylko przy `gotowa`):

- `gotowa` → krok 3. `recenzja: brak` znaczy, że 2 min po statusie recenzji czubka nie było (bot bez uwag do czubka jej
  nie publikuje) — `powod` niesie adnotację, a `recenzjaAktualna: false` z kroku 3 nie odsyła wtedy do kroku 2.
- `limit` → raport „bot nie odpowiedział w ciągu N minut” z `powod` i stanem PR, **koniec bez zmian w kodzie**.
  Nie zgaduj, co bot by powiedział.
- `pauza`, `pominieta`, `blad`, `pr-zamkniety`, `blad-gh`, `blad-argumentow` → raport „bot nie zrecenzował czubka: <stan> — <powod>”,
  **koniec bez zmian w kodzie**. Przy `pauza` dopisz, że operator może wznowić bota komentarzem `@coderabbitai review`.
  Nie pisz tego komentarza sam.

### 3. Zebranie i klasyfikacja

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "zbierz", zadanie, tura}})
```

Wołasz go w **każdej** turze, także drugiej i trzeciej. Workflow zwraca `rekomendacja`, `token`, `watki[]` (każdy z `klasa`,
`uzasadnienie`, `wplywNaProjekt`, `klaster`, `token`), `licznik` i `recenzjaAktualna`. **Pierwszy wiersz** Twojej wiadomości
o turze to `rekomendacja` 1:1 (MERGUJ / NIE MERGUJ — warunek / KOLEJNA TURA / DECYZJA OPERATORA — liczy ją JS).

`recenzjaAktualna: false` przy `recenzja: jest` → recenzja nie dotyczy czubka gałęzi. Wróć do kroku 2 i poczekaj na recenzję
przyrostową, zamiast naprawiać na podstawie nieaktualnych uwag. Na ten sam czubek wracasz najwyżej raz: gdy skrypt
znów odda `gotowa` dla tego samego `sha`, a `zbierz` znów `recenzjaAktualna: false`, kończysz raportem „status bota
i recenzja się nie zgadzają” (sha, `powod` skryptu), **bez zmian w kodzie**.

Zero wątków albo `rekomendacja` inna niż KOLEJNA TURA → przejdź do kroku 6 (domknięcie).

`KOLEJNA TURA (tylko odpowiedzi)` → wątki `odrzuć` czekają na naszą odpowiedź, a bramka merge'a liczy je jako `napraw`.
Bez pytania operatora przechodzisz do kroku 5 z `wybor: []`: tura wysyła odpowiedzi z dokumentem decyzji i kodu nie zmienia.

### 4. Decyzja — co naprawiamy w tej turze

**Interaktywnie:** `AskUserQuestion` z `multiSelect: true`, pozycje pogrupowane po klasie, w kolejności
`napraw` → `napraw-szerzej` → `do-operatora` → `odrzuć`. W opisie każdej pozycji daj **`wplywNaProjekt`**,
nie treść komentarza bota — operator wybiera po wpływie, nie po tym, co bot napisał. Wątki z tym samym
`klaster` pokaż jako **jedną pozycję** („3 komentarze, jedna naprawa").

Przy więcej niż ~10 wątkach nie wysypuj wszystkiego naraz: pokaż klasy `napraw` i `napraw-szerzej`,
a resztę streść jednym zdaniem z liczbami.

**Autonomicznie:** bierzesz `napraw` i `napraw-szerzej`. `odrzuć` dostaje odpowiedź w wątku,
`do-operatora` **zatrzymuje turę** i trafia do raportu — nie zgaduj decyzji produktowej.

### 5. Naprawa

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js",
          args: {etap: "napraw", zadanie, tura, token, watki, wybor}})
```

`token` i `watki` = wynik `zbierz` **tej samej tury**, bez zmian. Wątki bez tokenu tej tury workflow pomija, a bez tokenu
zatrzymuje turę — to pilnuje, że tura 2 i 3 przechodzą przez klasyfikację i guard. `wybor` = tablica `id` wybranych wątków
(tryb interaktywny) albo pomiń pole (tryb autonomiczny — workflow weźmie `napraw` + `napraw-szerzej`).

`status: "STOP"` (walidacja FAIL albo plik binarny) → wypisz `powod` i `naprawa`, **zakończ**. Nic nie
zostało wypchnięte; kolejna tura na zepsutym drzewie tylko pogłębi problem.

`status: "OK"` → pokaż `tabela` (wątki tej tury: plik:linia | zarzut | decyzja | uzasadnienie) i zwiększ licznik tur.
Limit wyczerpany → krok 6. W przeciwnym razie **wróć do kroku 2**: po pushu bot robi recenzję przyrostową.

### 6. Domknięcie

**Bramka merge'a** (JS liczy warunki, nie Ty):

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "merge", zadanie, auto, turyWykonane}})
```

`auto: true` tylko w trybie autonomicznym **i** bez `--bez-merge`; `turyWykonane` = licznik tur napraw. Merge wykonuje się
wyłącznie przy `rekomendacja: "MERGUJ"`: `mergeable = MERGEABLE`, `mergeStateStatus = CLEAN`, zero nierozwiązanych wątków
klasy `napraw`, zero `do-operatora`, CI zielone.

- `GOTOWY-DO-DECYZJI` → raport z `rekomendacja` i listą `niespelnione` (co nie przeszło, jaka jest aktualna wartość).
- `GOTOWY-DO-MERGE` (tryb interaktywny) → pokaż warunki i zapytaj operatora, czy mergujemy. Tak → ten sam etap z `auto: true`.
- `ZMERGOWANY` → idź dalej.

**Compound** — uruchom **zawsze**, także gdy merge nie doszedł do skutku. To jest część, która zamienia
komentarze bota w wiedzę projektu, i jest niezależna od tego, czy PR wylądował na głównej gałęzi:

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js",
          args: {etap: "compound", zadanie, watki: <wszystkie wątki ze wszystkich tur>,
                 odlozone: <wątki otwarte po suficie albo odłożone do kolejnej części: {plik, streszczenie, url}>}})
```

Workflow zapisuje do `docs/solutions/` **klasy błędów**, które bot znalazł po naszym własnym review, z polami wiedzy
(klasa, reguła, wzorce plików, szczebel). Wpisy trafiają do indeksu `docs/learned-patterns.md`; wpisy `kod` i `lint`
wracają też jako `propozycjeBramek[]`; obok nich `propozycjeDoReviewerow[]`. Commit compoundu workflow pushuje na bieżącą
gałąź (po merge'u to gałąź główna); `push: false` przy niepustym `commit` → wypchnij go przed kolejnym PR i krokiem CLAUDE.md.
Bez merge'u bieżąca gałąź to gałąź PR: commit compoundu trafia do PR i bot robi recenzję przyrostową samych plików wiedzy.
Chroniona gałąź główna odrzuca push — wtedy `pushDetal` ma błąd, a commit wypychasz przez PR albo ręcznie.

**Propozycji bramek nie wdrażasz.** Typ albo reguła lint to zmiana kodu projektu — decyzja operatora; zapis zostaje
w samym solution (`szczebel`, `szczebel_powod`). Do wdrożenia bramki lekcja działa jak reguła (indeks, wycinek); po wdrożeniu
solution dostaje pole `bramka` (gdzie wdrożona) i wypada z indeksu.

**Propozycji do reviewerów nie wdrażasz.** Zmiana promptu agenta-reviewera dotyka każdej przyszłej fazy
każdego zadania — to decyzja operatora. Workflow dopisuje je do `docs/reviews/propozycje-do-reviewerow.md` (commit
compoundu); w raporcie podaj agenta, klasę uwagi, regułę i pull requesty, w których klasa wystąpiła.

**Uzgodnienie CLAUDE.md** — tylko po `ZMERGOWANY` (albo w trybie `--claude-md`, gdy operator zmergował sam), po compoundzie:

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "claude-md", zadanie}})
```

Wejście: sekcja „Do CLAUDE.md po merge'u” z `docs/decisions/<data>-<zadanie>.md` na gałęzi głównej (plik jest tam tylko po
merge'u). Workflow wprowadza fakty do CLAUDE.md, liczy przyrost w JS (próg 2000 zn na zadanie), zmienia pole na
`claude_md: uzgodniono`, commituje na gałęzi głównej i pushuje. Bootstrap autopilota zatrzymuje kolejne zadanie, dopóki
któryś plik decyzji na gałęzi głównej ma `do-uzgodnienia`. `STOP` → wypisz `powod` i `naprawa`; nie przycinaj CLAUDE.md sam.

**Część nieostatnia** (`czesc` < `czesci`): po merge'u i compoundzie (commit compoundu wypchnięty na główną) kończysz raportem,
którego ostatnia linia to „Następny krok: /clear, potem /dev-pr --czesc <N+1>”. Kolejnej części nie uruchamiasz w tej sesji:
świeża sesja nie niesie kontekstu poprzedniej części, a operator wpisuje komendę sam. Krok CLAUDE.md workflow pomija
(`pominiety: true`) — plik decyzji jedzie w ostatniej części; uzgodnienie robisz po merge'u ostatniej.

## Raport końcowy

```text
Rekomendacja: <rekomendacja z ostatniego etapu zbierz albo merge, 1:1>
🔀 PR #<numer> — <url> [część N z M, fazy a–b]
   Tury: <N wykonanych> / <limit albo "interaktywnie"> (sufit 3)
   Wątki: naprawione <a> · odrzucone z dokumentem decyzji <b> · do operatora <c> · nieruszone <d>
   Walidacja ostatniej tury: PASS/FAIL/BRAK-KOMEND
   Merge: <zmergowany / gotowy do decyzji: lista niespełnionych warunków / --bez-merge>
   CLAUDE.md: <uzgodniony (przed → po zn, commit, push) / STOP: powód / nie dotyczy — PR niezmergowany>

<tabela każdej tury z pola `tabela` etapu napraw, w kolejności tur>

📚 Baza wiedzy: <N wpisów w docs/solutions/>, indeks: <indeks>, odmowy: <odmowy albo „brak”>, commit: <commit albo „brak”> (push: <pushDetal>)
   <uwagaIndeksu z etapu compound, gdy niepusta: „Indeks wiedzy pełny — uruchom `/dev-compound-refresh` (pełny przegląd)”>

🧱 Propozycje bramek (do Twojej decyzji, NIE wdrożone; zapis: solution ze szczeblem kod/lint):
   - [<szczebel>] <klasa>: <propozycja> — <powod> (<solution>)

🔁 Propozycje do reviewerów (do Twojej decyzji, NIE wdrożone; zapis: docs/reviews/propozycje-do-reviewerow.md):
   - <agent> ← <klasa uwagi> (wystąpiła w: <PR-y>)
     Proponowana reguła: <treść>

⚠️ Do Twojej decyzji: <wątki do-operatora, jeden wiersz na wątek z wplywNaProjekt>
```

Przy części nieostatniej raport kończy linia „Następny krok: /clear, potem /dev-pr --czesc <N+1>”.

Gdy któraś sekcja jest pusta — napisz to jednym słowem zamiast pomijać nagłówek. „Brak propozycji do
reviewerów" to informacja; brak sekcji to luka, której operator nie zauważy.

## Zasady twarde

- **Nigdy nie rozwiązuj wątku, którego nie zaadresowałeś.** Rozwiązany wątek znika operatorowi z widoku —
  to kasowanie uwagi, nie jej domknięcie.
- **Odmowa wymaga dokumentu decyzji** (`CLAUDE.md`, plan w `docs/plans/`, `docs/CONCEPTS.md`, `docs/decisions/`) i uzasadnienia
  poza jego nazwą; sam fragment kodu nie wystarcza. Workflow sam przeklasyfikowuje takie `odrzuć` na `do-operatora` — nie
  obchodź tego własnym uzasadnieniem w rozmowie.
- **Zakaz `git add -A` i `git add .`** — commit jawnym pathspec zmienionych plików.
- **Nie modyfikuj testów, żeby przeszły.** Uwaga bota o brakującym przypadku brzegowym = dopisz test,
  nie osłab asercji.
- **Nie rozszerzaj zakresu poza wybrane wątki.** Każda dodatkowa zmiana wraca jako kolejny komentarz
  bota w następnej turze.

## Referencje kontekstowe

- `.claude/workflows/dev-pr-wf.js` — mechanika; etapy `start` / `zbierz` / `napraw` / `merge` / `claude-md` / `compound`
- `.claude/rules/coding-rules.md` — reguły, których naprawy muszą przestrzegać
- `.claude/skills/dev-compound/SKILL.md` — procedura bazy wiedzy używana przez etap `compound`
- `.coderabbit.yaml` w repo projektu — gdy ma `auto_incremental_review: true`, każda tura poprawek
  dostaje recenzję automatycznie i krok 2 ma sens; bez tego operator musi poprosić bota ręcznie

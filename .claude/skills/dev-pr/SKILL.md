---
name: dev-pr
description: "Obsługa pull requesta od wysłania do merge'a: tworzy PR, czeka na recenzję bota, klasyfikuje uwagi wg wpływu na projekt, prowadzi tury poprawek i domyka je compoundem do bazy wiedzy. Bot recenzji jest opcjonalny: z `--bez-bota` skill prowadzi PR do merge'a bez niego. Używaj po `/dev-docs-complete`, gdy zadanie jest gotowe do wysłania, oraz gdy bot zostawił komentarze do obsłużenia."
argument-hint: "[liczba tur 1–3 — bez niej tryb interaktywny] [--bez-merge] [--bez-push] [--review | --bez-review] [--czesc N] [--bez-bota] | --claude-md <zadanie>"
---

# `/dev-pr` — od pull requesta do merge'a

Skill prowadzi zadanie od `/dev-docs-complete` do merge'a: wysłanie PR, tury poprawek po uwagach bota
i compound, który zamienia te uwagi we wpisy bazy wiedzy — bez niego te same klasy błędów wracają
w kolejnym pull requeście.

**Podział ról:** mechanika żyje w `.claude/workflows/dev-pr-wf.js` (bramki liczone w JS, `gh`, naprawy,
odpowiedzi w wątkach). Ty prowadzisz rozmowę i pytasz operatora. Licznik tur i decyzje o wątkach żyją na PR-ze
(commity `fix(pr): tura N`, znaczniki w odpowiedziach), więc nowa sesja może wznowić pracę. Nie wykonuj mechaniki ręcznie — wołaj
workflow etapami.

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
| `/dev-pr 3` | **Autonomiczny, do 3 tur.** Sam wybierasz wg rubryki. Po wyczerpaniu tur albo po czystej turze przechodzisz do bramki merge'a. Krótkie review zmian po archiwizacji (krok 1) uruchamiasz sam, bez pytania, gdy po archiwizacji są pliki kodu w tej części. |
| `/dev-pr 3 --bez-merge` | Jak wyżej, ale merge'a nie robisz sam: przy zielonej bramce merge'a kończysz **jednym pytaniem o merge**, bez zielonej bramki raportem. Tę komendę podają raporty i handoffy pipeline'u: tury idą same, a merge, czyli często deploy, zostaje decyzją operatora. |
| `--review` / `--bez-review` (z każdym trybem) | Odpowiedź z góry na pytanie o krótkie review zmian po archiwizacji (krok 1): `--review` = krótkie review, potem PR; `--bez-review` = PR bez review. |
| `/dev-pr --czesc N` (z trybem jak wyżej) | **Część N PR wieloczęściowego** — zadanie ma w podsumowaniu sekcję „Części PR” (archiwizacja: więcej niż 150 plików do recenzji bota). Części wysyłasz po kolei; każda przechodzi pełny cykl do merge'a. |
| `--bez-push` (z każdym trybem) | Etapy `compound` i `claude-md` commitują lokalnie i nie wypychają głównej: w projekcie, gdzie push na główną to deploy, push zostaje operatorowi. |
| `--bez-bota` (z każdym trybem) | **Projekt bez bota recenzji** (CodeRabbit jest opcjonalny): PR, CI, krótkie review zmian po archiwizacji i merge, bez czekania na bota i bez tur. Przebieg w sekcji „Tryb bez bota”. |
| `/dev-pr --claude-md <zadanie>` | Tylko krok „uzgodnij CLAUDE.md” dla zmergowanego zadania (np. po STOP-ie bootstrapu autopilota). |

**Sufit: 3 tury** w każdym trybie (`/dev-pr 5` = 3). Workflow nie wystartuje czwartej tury napraw. Turę liczy commit
`fix(pr): tura N`: tura z samymi odpowiedziami w wątkach, bez commita, nie zużywa sufitu, a następny `zbierz` zwraca ten sam numer tury. Wyczerpany limit = domknięcie,
nawet gdy zostały otwarte wątki. Nie proponuj „jeszcze jednej tury" — zaraportuj, co zostało, i oddaj decyzję operatorowi.
Wątki otwarte po suficie i wątki odłożone „do części N+1” przekazujesz etapowi `compound` w `odlozone` — trafiają do
`known-issues.md` zadania z linkiem wątku, a start kolejnej części zbiera nierozwiązane wątki PR poprzednich części.

## Tryb bez bota

CodeRabbit jest opcjonalny: zmienia tylko to, kto recenzuje PR jako pierwszy. Projekt bez niego domyka PR tym trybem.

- **Włącza go operator, nigdy Ty.** Trzy źródła: zapis w pliku projektu (`node .claude/scripts/pr/tryb-recenzji.mjs` zwraca
  `recenzjaPr: "bez-bota"` — sprawdzasz to przed krokiem 1 w każdym wywołaniu), `--bez-bota` w komendzie `/dev-pr` wpisanej przez
  operatora (jedno wywołanie, bez zapisu) albo odpowiedź „Projekt bez bota recenzji” na pytanie o config (krok 1). Brak
  `.coderabbit.yaml` ani brak check-runu bota po pushu nie dowodzą, że bota nie ma: bot bywa wstrzymany, pomija PR albo wyczerpał
  limit planu, a w takim projekcie bramka recenzji czubka ma zostać. Pole `blad` w wyniku skryptu pokazujesz operatorowi i idziesz
  trybem z botem.
- **Zapis wyboru.** Po odpowiedzi „Projekt bez bota recenzji”: `node .claude/scripts/pr/tryb-recenzji.mjs --ustaw bez-bota`
  (plik `.claude/projekt.json`; szablon go nie dostarcza, więc `/sync-template` go nie nadpisze), commit tego pliku jawną ścieżką
  na `feature/<zadanie>` i znów krok 1. Z pliku czytają też `/dev-plan` i archiwizacja: próg 150 plików to limit recenzji bota
  i w projekcie bez bota jest tylko uwagą.
- **Każdy etap workflowu** dostaje `bezBota: true`. Start nie sprawdza wtedy configu bota ani progu 150 plików jego recenzji
  (ostrzeżenie o bazie PR zostaje).
- **Krok 1** idzie jak zwykle: czyste drzewo, zmiany po archiwizacji, P3 z realnym scenariuszem, zgoda na wysłanie, krótkie
  review. Krótkie review jest tu jedynym review zmian po archiwizacji; każda faza przeszła własne review w autopilocie.
- **Kroki 2–5 pomijasz**: nie czekasz na bota i nie wołasz etapów `zbierz`, `napraw` ani `decyzja`. Tur nie ma.
- **Krok 6, merge**: etap `merge` z `bezBota: true`. Warunki: `mergeable = MERGEABLE`, `mergeStateStatus = CLEAN`, zero otwartych
  wątków (recenzja człowieka na GitHubie też je tworzy), CI zielone i PR ma choć jeden check CI. `niespelnione` z warunkiem
  „CI istnieje albo zgoda operatora (tryb bez bota)” → `AskUserQuestion` w każdym trybie, także autonomicznym: „PR nie ma CI ani
  recenzji bota, więc przed merge'em nie sprawdziło go nic poza naszym pipeline'em. Mergować?” z opcjami „Merguj” (ten sam
  etap z `zgodaBezCi: true` i `auto: true`) i „Jeszcze nie” (raport). Sam tej zgody nie przekazujesz. Otwarte wątki recenzji
  człowieka → raport z ich listą; operator rozstrzyga je sam.
- **Compound PR pomijasz**: opisuje klasy błędów, które bot znalazł po naszym review, a tych nie ma (workflow zwraca
  `POMINIETY`). Krok „Uzgodnienie CLAUDE.md” idzie jak zwykle.
- **Raport końcowy**: „Tury: nie dotyczy (bez bota)”, „Wątki: nie dotyczy”, „📚 Baza wiedzy: pominięta (tryb bez bota)”; sekcje
  propozycji piszesz jednym słowem „brak”. Polecenie dla kolejnej części i dla nowej sesji niesie `--bez-bota` tylko wtedy,
  gdy tryb przyszedł z flagi, a nie z pliku projektu.

## Przebieg

Ustal `zadanie` (nazwa folderu w `docs/completed/` lub `docs/active/` — z argumentu, z nazwy gałęzi
`feature/<nazwa>` albo `feature/<nazwa>-czN`, albo zapytaj), `tury` (liczba z argumentu, najwyżej 3, brak = tryb interaktywny),
`bezMerge`, `czesc` (liczba z `--czesc`; brak = zadanie jednym PR) i odpowiedź o review (`--review` albo `--bez-review`; brak = wg trybu, krok 1).
`--claude-md <zadanie>` → od razu krok „Uzgodnienie CLAUDE.md” z punktu 6, bez kroków 1–5.

**Wznowienie.** Gdy PR gałęzi już istnieje (`gh pr view --json number`), przed krokiem 1 wołasz etap `stan` i pokazujesz jego wynik: tury,
wątki otwarte, rozstrzygnięte i czekające na bota, recenzję czubka. `tura` = `tury` + 1. `sufit: true` → od razu krok 6, bez nowej tury
napraw. Przy tabeli części bierzesz `--czesc`, którego PR jest otwarty. Gdy kontekst sesji się kończy, kończysz raportem z gotowym
poleceniem dla nowej sesji (`/dev-pr 3 --bez-merge --czesc N`, przy jednym PR `/dev-pr 3 --bez-merge`; stan: `etap stan`), zamiast prowadzić merge ręcznie.
Przerwanie sesji (Esc, zmiana modelu) nie zatrzymuje etapu, który już działa w tle: zanim uruchomisz go drugi raz, sprawdź
`gh pr view` i wynik zadania w tle, i nie pisz operatorowi „nic nie trafiło na GitHub” bez tego sprawdzenia (vibersi PR #24:
pierwszy `start` utworzył PR po przerwaniu, drugi go tylko znalazł).
Powrót tą komendą do PR bez otwartych wątków (np. po odpowiedzi „Jeszcze nie” albo po zielonym CI) przechodzi kroki 2–3 bez
tury napraw i dochodzi do kroku 6: przy zielonej bramce kończy się tym samym pytaniem o merge.

### 1. Start — bramka wejścia i pull request

**Czyste drzewo.** Krok 1 zaczynasz od `git status --porcelain`, w każdym trybie i także wtedy, gdy pytanie o wysłanie
pomijasz: etap `start` przełącza gałęzie i przy brudnym drzewie kończy STOP-em, przy części dopiero po pomiarze rozmiaru.
Niepusty wynik → pokazujesz pliki i pytasz przez `AskUserQuestion`: „Commit wskazanych plików” (pierwsza opcja, z listą
ścieżek) albo „Jeszcze nie” (koniec bez etapu `start`). Commit robisz jawnymi ścieżkami i tylko plików z pytania. Plik
smoke'u i dokumenty zadania commitujesz na `feature/<zadanie>`, nie na `feature/<zadanie>-czN`: plik smoke'u leży na gałęzi
zadania, a jej commity po cięciu jadą z ostatnią częścią. Stasha nie używasz: `start` przełącza gałęzie i nikt go potem
nie zdejmie. Po commicie sprawdzasz drzewo jeszcze raz; czyste → dalsza część kroku 1, do pytania o wysłanie.

**Smoke przed PR.** Na czystym drzewie: `node .claude/scripts/smoke/otwarte.mjs --zadanie <zadanie>`. Otwarte pozycje smoke'u
to `smoke.otwarte − smoke.poDeployu` (pozycje z dopiskiem „po deployu” czekają z definicji na wdrożenie). Liczba większa od
zera → przed pytaniem o zgodę podajesz ją i pytasz, czy wysyłać mimo to. To miękka bramka: decyduje operator. `smoke: null`
(zadanie bez pliku smoke'u) → bez pytania; `ok: false` albo nieczytelny wynik → podajesz błąd i pytasz jak przy otwartych pozycjach.

**Zmiany po archiwizacji.** Najpierw `node .claude/scripts/pr/po-archiwum.mjs --zadanie <zadanie>` (z `--czesc N` przy części).
Skrypt wylicza commity `<archiwum>..feature/<zadanie>` bez tematów pipeline'u, czyli zmiany ze smoke'u operatora, których
żaden reviewer fazy nie widział. Poprawki po decyzjach, które sesja `/dev-smoke` już pokazała dwóm reviewerom
(pusty commit-znacznik z liniami `Sprawdzone: <sha>`), skrypt pomija i podaje w polu `sprawdzone`. `wTejCzesci: true` i niepuste `plikiKodu` (pliki poza `docs/` i `.claude/`) → krótkie
review wg akapitów „Zgoda na wysłanie” i „Review bez pytania” niżej. `archiwum: null`, puste `plikiKodu` albo `wTejCzesci: false` → bez pytania o review
i bez review, także z `--review` (commity po archiwum jadą w ostatniej części). PR gałęzi już istnieje (`gh pr view --json number` zwraca numer) → oba pytania
pomijasz i krótkiego review nie uruchamiasz: zmiany są już na zewnątrz, a bot je recenzuje. Kod wyjścia skryptu 3 (`wyjatek`) → podaj operatorowi błąd
i zapytaj o review w każdym trybie, chyba że komenda niesie `--bez-review`.

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
wklejona wcześniej w sesji („Po smoke'u: /dev-pr 3 --bez-merge --czesc 1”), akceptacja innej rzeczy („reszta ok”) ani wywołanie tego
skilla przez Ciebie, ani ogólne „działaj dalej” bez pytania o PR. Zgoda z tego wywołania skilla obejmuje powrót do kroku 1
po konflikcie rebase'u. „Jeszcze nie” → koniec bez etapu `start`.

**Review bez pytania.** Przy plikach kodu po archiwum pytania o review nie zadajesz, gdy komenda `/dev-pr` wpisana przez
operatora w bieżącej wiadomości niesie odpowiedź: `--review` = krótkie review, potem PR; `--bez-review` = PR bez review;
liczba tur bez flagi (tryb autonomiczny) = krótkie review uruchamiasz sam, potem PR. Tryb interaktywny bez flagi → pytanie
jak wyżej. Flaga i liczba tur liczą się tylko w takiej komendzie: z ramki wklejonej wcześniej w sesji ani z wywołania
skilla przez Ciebie odpowiedzi nie bierzesz i pytasz jak w trybie interaktywnym.

**Krótkie review** (wybór operatora, `--review` albo tryb autonomiczny bez flagi; pytanie o P1/P2 pada w każdym trybie): dwa wywołania naraz narzędziem `Agent` z typami
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

`status: "STOP"` z polem `niewypchnieteGlowna` → `AskUserQuestion`: „Wypchnę główną” (koniec; push to decyzja operatora, może oznaczać
deploy) albo „Jadą w tym PR” (znów krok 1 z `zGlowna: true`). `status: "STOP"` z polem `konfigBota` → pokaż `odstepstwa` i pytaj: „/coderabbit-setup”
(uruchamiasz skill, commit na tej gałęzi, znów krok 1), „Bez poprawnego configu” (krok 1 z `bezKonfigu: true`: bot działa mimo odstępstw) albo „Projekt bez bota recenzji”
(zapis wyboru i krok 1 z `bezBota: true` wg sekcji „Tryb bez bota”; kolejne wywołania czytają wybór z `.claude/projekt.json`).

`status: "STOP"` → wypisz `powod` i **zakończ**. Nie obchodź bramki: po STOP-ie nie commituj zmian na własną rękę, nie
przełączaj gałęzi, nie twórz PR z gałęzi głównej. Brudne drzewo ma drogę przed startem (akapit „Czyste drzewo”): commit
plików pokazanych operatorowi, za jego zgodą. Po STOP-ie z tego powodu operator wraca `/dev-pr 3 --bez-merge` (z `--czesc N` przy części) i przechodzi ją od początku.

`status: "STOP"` z polem `rozmiar` (część albo jeden PR ≥ 150 plików do recenzji po przeliczeniu czubka — commity po
archiwizacji dołożyły pliki do liczby z archiwizacji) → `AskUserQuestion` z liczbą (`rozmiar.pliki`, `rozmiar.tabela`)
i opcjami „Dodatkowa część” i „Jeszcze nie”. „Dodatkowa część” = cięcie na commicie archiwizacji (pole `archiwum`
z `po-archiwum.mjs`): przy `--czesc N` wiersz części N kończy się na nim, a nowy wiersz N+1 biegnie od niego do „czubek
gałęzi” (fazy = ostatnia faza części N); przy jednym PR tabela „## Części PR” z dwoma wierszami (część 1 od
`git merge-base origin/main feature/<zadanie>` do niego, część 2 od niego do czubka). Liczby plików każdego wiersza
z `rozmiar.mjs --baza <od> --czubek <do>` (pole `doRecenzji`). Tabelę wpisujesz w podsumowanie zadania na
`feature/<zadanie>`, commit jawną ścieżką i znów krok 1 (`/dev-pr 3 --bez-merge --czesc N`, przy jednym PR `--czesc 1`). Bez decyzji
operatora nie wysyłasz PR ponad limitem bota.

Konflikt rebase'u wyłącznie w `docs/learned-patterns.md` (indeks generowany z `docs/solutions/`) workflow rozwiązuje sam:
przelicza indeks z drzewa commitu, kontynuuje rebase i przygotowuje część od nowa (log „pliki generowane rozwiązane”).
Tak samo `supabase/migrations.sum`: workflow scala wpisy obu stron (`bramki.mjs --scal-sume`); ta sama migracja z inną sumą
po obu stronach albo suma niezgodna z migracjami to `KONFLIKT` z powodem.

`status: "KONFLIKT"` (rebase części) → rebase stoi na konflikcie w plikach `konflikty`. Niepuste `konfliktyZTur` pokaż przed
pytaniem: commit tury PR poprzedniej części zmienił ten plik (np. poprawka po uwadze bota), a ta część go przebudowuje —
rozwiązanie to zwykle wersja tej części z naniesioną poprawką tury, gdy fragment przeżył. Zapytaj operatora przez
`AskUserQuestion`: „Rozwiąż w tej sesji” (czytasz oba warianty każdego pliku, proponujesz rozwiązanie, po akceptacji
`git add <pliki>` i `git rebase --continue`; kolejny konflikt — to samo, aż rebase się skończy; potem znów krok 1 z tym samym
`czesc`), „Rozwiążę sam” (koniec; operator wraca `/dev-pr 3 --bez-merge --czesc N`) albo „Przerwij” (`git rebase --abort`, koniec). Konfliktu
nie rozwiązujesz bez tej decyzji. Gdy wśród konfliktów jest też `docs/learned-patterns.md` (plik generowany): zostaw jedną
z jego wersji, a po rebase'ie `node .claude/scripts/wiedza/wiedza.mjs indeks --zapisz` i commit indeksu. Gdy jest wśród
nich `supabase/migrations.sum`: `node .claude/scripts/bramki/bramki.mjs --scal-sume` przed `git add` (przy `scalony: false`
pokaż operatorowi `powod`).

Zadanie z tabelą „Części PR” wywołane bez `--czesc` → `STOP` z poleceniem `/dev-pr 3 --bez-merge --czesc 1`: jeden PR byłby ponad limitem bota.

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
- `limit-recenzji` → bot wyczerpał limit planu i **nie zrecenzował czubka**, choć check-run bywa zielony. Raport z `powod` i `czekajMin`,
  **koniec bez zmian w kodzie**: operator wraca po resecie limitu (`/dev-pr 3 --bez-merge`, z `--czesc N` przy części, albo komentarz `@coderabbitai review`).
- `limit` → raport „bot nie odpowiedział w ciągu N minut” z `powod` i stanem PR, **koniec bez zmian w kodzie**.
  Nie zgaduj, co bot by powiedział.
- `pauza`, `pominieta`, `blad`, `pr-zamkniety`, `blad-gh`, `blad-argumentow` → raport „bot nie zrecenzował czubka: <stan> — <powod>”,
  **koniec bez zmian w kodzie**. Przy `pauza` dopisz, że operator może wznowić bota komentarzem `@coderabbitai review`.
  Nie pisz tego komentarza sam.

### 3. Zebranie i klasyfikacja

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "zbierz", zadanie, tura}})
```

Wołasz go w **każdej** turze, także drugiej i trzeciej. `tura` z wyniku zastępuje Twoją: gdy PR ma już commity tej tury, workflow liczy
następną. Wątki `rozstrzygniete` i `czekajaNaBota` są poza turą i nie wracają do wyboru, chyba że bot zgłosił w nich nowy zarzut; pokaż ich liczbę jednym zdaniem.
Workflow zwraca `rekomendacja`, `token`, `watki[]` (każdy z `klasa`,
`uzasadnienie`, `wplywNaProjekt`, `klaster`, `token`), `licznik`, `recenzjaAktualna` i `potwierdzone` (wątki naprawione we
wcześniejszej turze, które bot potwierdził, a nie rozwiązał — workflow rozwiązuje je sam; nie trafiają do `watki[]`, więc nie
dajesz ich do kolejnej tury; `bledy` pokaż operatorowi). **Pierwszy wiersz** Twojej wiadomości
o turze to `rekomendacja` 1:1 (MERGUJ / NIE MERGUJ — warunek / CZEKAJ NA BOTA / KOLEJNA TURA / DECYZJA OPERATORA — liczy ją JS).

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

**Decyzja operatora o wątku** („zostaje”, „odkładamy”, „nie naprawiamy”) trafia od razu na PR, żeby nie wracała w kolejnych turach ani w nowej sesji:
`Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "decyzja", zadanie, decyzje: [{id, tresc, plik, streszczenie}]}})`. Nie pytaj drugi raz o wątek, który ma zapisaną decyzję.
Uwaga z recenzji ogólnej (`plik` „(recenzja ogolna)”) nie ma wątku: etap zapisuje decyzję komentarzem PR ze znacznikiem, a `zbierz`
zwraca ją potem w `rozstrzygnieteOgolne`, poza turą. Uwagi ogólne z recenzji starszego commitu, których bot nie powtórzył przy
czubku, `zbierz` zwraca w `stareOgolne`: nie wracają do tury ani do pytań, wymieniasz je w raporcie jednym zdaniem (punkt 63).

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

`status: "OK"` → pokaż `tabela` (wątki tej tury: plik:linia | zarzut | decyzja | uzasadnienie). **Zawsze wróć do kroku 2**, także po
ostatniej turze: po pushu bot robi recenzję przyrostową, a bramka merge'a wymaga recenzji czubka. Po limicie tur z recenzji nie robisz
kolejnej naprawy: `zbierz` i krok 6 (uwagi trafiają do raportu i `odlozone`).

### 6. Domknięcie

**Bramka merge'a** (JS liczy warunki, nie Ty):

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "merge", zadanie, auto, turyWykonane}})
```

Pierwsze wywołanie etapu: `auto: true` tylko w trybie autonomicznym **i** bez `--bez-merge`; po odpowiedzi „Merguj” na pytanie
przy `GOTOWY-DO-MERGE` etap idzie drugi raz z `auto: true`. `turyWykonane` = liczba tur z etapu `zbierz` (workflow bierze liczbę z commitów PR, gdy stan PR jest czytelny).
Merge wykonuje się wyłącznie przy `rekomendacja: "MERGUJ"`: `mergeable = MERGEABLE`, `mergeStateStatus = CLEAN`, zero otwartych wątków bez naszej decyzji,
CI zielone, recenzja bota dotyczy czubka i krótkie review dużej ostatniej tury za nami. Liczy to JS ze stanu PR. `informacje` (wątki rozstrzygnięte, `reviewDecision`) pokaż w raporcie: nie blokują.

- `GOTOWY-DO-DECYZJI` → raport z `rekomendacja` i listą `niespelnione` (co nie przeszło, jaka jest aktualna wartość).
- `rekomendacja` zaczyna się od „CZEKAJ NA BOTA” → nasza poprawka czeka na ocenę bota, a od jego recenzji czubka minęło mniej
  niż 10 minut (decyzja operatora, punkt 64). Bez pytania: `Monitor` z poleceniem `sleep <resztaMin × 60>; echo koniec`
  (`resztaMin` z `stan.czekanieNaBota`), potem etap `zbierz` tej samej tury i dalej jak w kroku 3. Bot odrzucił poprawkę →
  wątek wraca do tury; odpowiedział potwierdzeniem albo milczy → etap `merge` jeszcze raz. Po 10 minutach bez odpowiedzi bramka
  przepuszcza merge, a `informacje.poLimicieBota` wymieniasz w raporcie w linii `Merge:` („bot nie ocenił poprawki w <plik> w 10 min”).
  (vibersi PR #24: bot odrzucił poprawkę 4 min po swojej recenzji, bramka sprawdzała stan kilkanaście sekund później).
- `niespelnione` zawiera krótkie review (pole `krotkieReview`: `commit`, `plikiKodu`) → dwa wywołania `Agent` (`correctness-reviewer`, `security-sentinel`) na `git show <commit> -- <plikiKodu>`, jak w kroku 1.
  P1/P2 → `AskUserQuestion`: naprawa poza turami bota albo decyzja o merge'u mimo to. Potem etap `merge` z `reviewOstatniejTury: true`. Zmiany, których nie dało się sprawdzić testem (współbieżność na prawdziwej bazie, przeglądarka),
  podajesz w raporcie jako gotowe polecenie dla sesji: przejście lokalnie przed merge'em, a nie samą uwagę.
- `stan.ciTylkoBot: true` → na GitHubie działa tylko check bota recenzji, testów tam nie ma: tak to mówisz operatorowi i w raporcie,
  nigdy „zielone testy na GitHubie”. Testy uruchamiały tylko tury napraw lokalnie (`walidacjaDetal`).
- `MERGE-NIEUDANY` → komenda merge'a zawiodła (`merge.detal`): raport z treścią błędu, bez innej strategii. Bramka przeszła, więc to nie jest pytanie o warunki.
- `GOTOWY-DO-MERGE` (tryb interaktywny i `--bez-merge`) → pokaż warunki i zapytaj przez `AskUserQuestion`: „Wszystkie warunki
  merge'a spełnione. Mergować teraz?” z opcjami „Merguj” (ten sam etap z `auto: true`) i „Jeszcze nie” (raport końcowy; merge
  zostaje operatorowi).
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
wracają też jako `propozycjeBramek[]` (mechanizmu nie ma w kodzie) albo `bramkiWdrozone[]` (poprawka już go wprowadziła,
pole `mechanizm` = `plik:linia`); obok nich `propozycjeDoReviewerow[]`. Commit compoundu workflow pushuje na bieżącą
gałąź (po merge'u to gałąź główna); `push: false` przy niepustym `commit` → wypchnij go przed kolejnym PR i krokiem CLAUDE.md.
Bez merge'u bieżąca gałąź to gałąź PR: commit compoundu trafia do PR i bot robi recenzję przyrostową samych plików wiedzy.
Chroniona gałąź główna odrzuca push — wtedy `pushDetal` ma błąd, a commit wypychasz przez PR albo ręcznie.

`--bez-push` → przekazujesz `bezPusha: true` etapom `compound` i `claude-md`; commit zostaje lokalnie, a w raporcie podajesz polecenie pushu i listę commitów. Po commicie osobny agent pomiaru sprawdza, czy commit jest na zdalnej gałęzi (`git branch -r --contains`). Wynik etapu z `pushMimoBezPusha: true` znaczy, że commit mimo to trafił na zdalną główną: piszesz to w raporcie jako pierwszą UWAGĘ (commit, `git log origin/<główna> -1`), bez cofania pushem.

Przed pushem na gałąź główną compound i krok CLAUDE.md **czekają na CI czubka głównej** (do ~36 min): push zaraz po merge'u
uruchamia CI od nowa, a CI z `concurrency: cancel-in-progress` anulowałby przebieg i deploy commitu merge'a. Wynik wraca jako
`ciGlownej` i to jedyne źródło linii o CI i deployu w raporcie: `success` = przebieg (z deployem, jeśli projekt go ma) przeszedł;
`failure` / `cancelled` = deploy commitu merge'a NIE jest potwierdzony — napisz to wprost; `w-toku` = commit niewypchnięty, wypchnij
po zakończeniu przebiegu; `brak-ci` = repo nie ma CI na push. Nie pisz „deploy ruszył”, gdy `ciGlownej` tego nie mówi.

**Propozycji bramek nie wdrażasz.** Typ albo reguła lint to zmiana kodu projektu — decyzja operatora; zapis zostaje
w samym solution (`szczebel`, `szczebel_powod`). Do wdrożenia bramki lekcja działa jak reguła (indeks, wycinek); po wdrożeniu
solution dostaje pole `bramka` (gdzie wdrożona) i wypada z indeksu.

**Bramki już w kodzie to nie propozycje.** `bramkiWdrozone[]` niesie wpisy `kod` i `lint`, których mechanizm compound znalazł
grepem na bieżącym drzewie. W raporcie podajesz je jako „wdrożone w `<plik:linia>`” i o nic nie pytasz. Pola `bramka`
w solution compound przy tym nie ustawia, więc lekcja zostaje w indeksie i wycinku jak reguła.

**Plików agentów w projekcie nie edytujesz.** `.claude/agents/` należy do szablonu i `/sync-template` je nadpisuje, więc
zmiana w projekcie zniknie przy najbliższym syncu. `propozycjeDoReviewerow[]` niesie tylko reguły ogólne, czyli takie,
które dotyczą każdego projektu. Workflow dopisuje je do `docs/reviews/propozycje-do-reviewerow.md` (commit compoundu),
gdzie czekają na przeniesienie do repo szablonu. Przenosi je operator, ręcznie: niczego nie wysyłasz poza projekt, bo
propozycja może nieść szczegóły prywatnego kodu. W raporcie podaj agenta, klasę uwagi, regułę i pull requesty, w których
klasa wystąpiła. Klasa projektowa, która wróciła, nie daje propozycji do reviewera: jej reguła zostaje w solution
z `paths` i działa przez wycinek wiedzy, a compound ocenia dla niej wyższy szczebel (`kod` albo `lint`), czyli propozycję bramki.

**Uzgodnienie CLAUDE.md** — tylko po `ZMERGOWANY` (albo w trybie `--claude-md`, gdy operator zmergował sam), po compoundzie:

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "claude-md", zadanie}})
```

Wejście: sekcja „Do CLAUDE.md po merge'u” z `docs/decisions/<data>-<zadanie>.md` na gałęzi głównej (plik jest tam tylko po
merge'u). Workflow wprowadza fakty do CLAUDE.md, liczy przyrost w JS (próg 2000 zn na zadanie), zmienia pole na
`claude_md: uzgodniono`, commituje jawnymi ścieżkami na gałęzi głównej i pushuje (`--bez-push`: bez pushu). Niezacommitowane pliki obok nie blokują kroku. `rozjazdy` to fakty sprzeczne
z kodem, których nie wprowadzono: podaj je operatorowi. Bootstrap autopilota zatrzymuje kolejne zadanie, dopóki
któryś plik decyzji na gałęzi głównej ma `do-uzgodnienia`. `STOP` → wypisz `powod` i `naprawa`; nie przycinaj CLAUDE.md sam.
Zadanie zrobione poza `/dev-docs-complete` nie ma pliku decyzji: przy zmergowanym PR workflow zwraca `pominiety: true` — w raporcie
„CLAUDE.md: nie dotyczy — zadanie bez pliku decyzji”.

**Wątki poprzednich części.** Po merge'u części, która naprawiła wątek odłożony z wcześniejszego PR, odpowiedz w nim („Naprawione w PR #N”) i rozwiąż go. `CHANGES_REQUESTED`
na zmergowanym PR nic nie blokuje, ale otwarty wątek nikt inny nie zamknie. Przed merge'em każdej części z wdrożeniem podajesz w raporcie gotowe polecenie przejścia kluczowego flow
na stanie tej części, lokalnie: części wdrażają stany pośrednie, których smoke całej gałęzi nie sprawdza.

**Część nieostatnia** (`czesc` < `czesci`): po merge'u i compoundzie (commit compoundu wypchnięty na główną) kończysz raportem,
którego ostatnia linia to „Następny krok: /clear, potem /dev-pr 3 --bez-merge --czesc <N+1>”. Kolejnej części nie uruchamiasz w tej sesji:
świeża sesja nie niesie kontekstu poprzedniej części, a operator wpisuje komendę sam. Krok CLAUDE.md workflow pomija
(`pominiety: true`) — plik decyzji jedzie w ostatniej części; uzgodnienie robisz po merge'u ostatniej.

**Część albo PR niezmergowany** (odpowiedź „Jeszcze nie” albo niespełnione warunki bramki): ostatnia linia raportu to
„Następny krok: <co ma się wydarzyć, np. zielone CI>, potem /clear i /dev-pr 3 --bez-merge --czesc <N> — dokończy i zapyta o merge”;
przy jednym PR ta sama linia bez `--czesc <N>`. Linii z `--czesc <N+1>` przed merge'em części N nie podajesz: start części
N+1 zatrzyma się na niezmergowanej części N.

## Raport końcowy

Po `ZMERGOWANY` pierwsza linia raportu to „ZMERGOWANY”, nie rekomendacja sprzed merge'a.

```text
Rekomendacja: <rekomendacja z ostatniego etapu zbierz albo merge, 1:1; po merge'u: ZMERGOWANY>
🔀 PR #<numer> — <url> [część N z M, fazy a–b]
   Tury: <N wykonanych> / <limit albo "interaktywnie"> (sufit 3)
   Wątki: naprawione <a> · odrzucone z dokumentem decyzji <b> · do operatora <c> · nieruszone <d>
   Walidacja ostatniej tury: PASS/FAIL/BRAK-KOMEND
   Merge: <zmergowany / gotowy do decyzji: lista niespełnionych warunków / warunki spełnione, operator: „Jeszcze nie”>
   CI po merge'u: <ciGlownej z compoundu albo kroku CLAUDE.md, 1:1; failure/cancelled = „deploy commitu merge'a niepotwierdzony”>
   CLAUDE.md: <uzgodniony (przed → po zn, commit, push) / STOP: powód / nie dotyczy — PR niezmergowany>
   Otwarte sprawy: <pole `zdanie` z `node .claude/scripts/smoke/otwarte.mjs --zadanie <zadanie>`, 1:1>
   Po wdrożeniu: <pole `smoke.poDeployuLista` tego skryptu, jedna pozycja na wiersz; puste = „brak”>

<tabela każdej tury z pola `tabela` etapu napraw, w kolejności tur>

📚 Baza wiedzy: <N wpisów w docs/solutions/>, indeks: <indeks>, odmowy: <odmowy albo „brak”>, commit: <commit albo „brak”> (push: <pushDetal>)
   <uwagaIndeksu z etapu compound, gdy niepusta: „Indeks wiedzy pełny — uruchom `/dev-compound-refresh` (pełny przegląd)”>

🧱 Propozycje bramek (do Twojej decyzji, NIE wdrożone; zapis: solution ze szczeblem kod/lint):
   - [<szczebel>] <klasa>: <propozycja> — <powod> (<solution>)
   Już w kodzie (z `bramkiWdrozone`, bez decyzji):
   - [<szczebel>] <klasa>: <regula> — wdrożone w <mechanizm> (<solution>)

🔁 Propozycje do reviewerów (reguły ogólne, czekają na przeniesienie do repo szablonu; zapis: docs/reviews/propozycje-do-reviewerow.md):
   Plików agentów w projekcie nie edytujemy: sync szablonu je nadpisze. Przeniesienie robisz ręcznie.
   - <agent> ← <klasa uwagi> (wystąpiła w: <PR-y>)
     Proponowana reguła: <treść>

⚠️ Do Twojej decyzji: <wątki do-operatora, jeden wiersz na wątek z wplywNaProjekt>
```

Przy zmergowanej części nieostatniej raport kończy linia „Następny krok: /clear, potem /dev-pr 3 --bez-merge --czesc <N+1>”: tury idą same, a merge, czyli
często deploy, zostaje decyzją operatora. Część albo PR niezmergowany kończy linia z akapitu „Część albo PR niezmergowany”
(krok 6): ta sama komenda z `--czesc <N>`, która dokończy i zapyta o merge. Tryb interaktywny (`/dev-pr --czesc <N+1>`) wspomnij tylko wtedy, gdy są wątki `do-operatora`.

Zmergowany PR (bez części albo część ostatnia) z niepustą `smoke.poDeployuLista` kończy linia „Następny krok: po wdrożeniu
/clear, potem /dev-smoke <zadanie>”: sesja smoke'u w trybie po wdrożeniu przechodzi te pozycje i je odhacza. Nie wypisujesz
ich z `docs/operator/odlozone.md`: tam są sprawy na inny etap projektu, nie sprawdzenia tego zadania.

Linię „Otwarte sprawy” bierzesz ze skryptu, nie z pamięci sesji: dopóki zdanie nie brzmi „Otwarte: brak …”, nie piszesz, że zadanie
jest zamknięte w całości (punkt 45: raport mówił „zamknięte w całości” przy otwartych pozycjach smoke'u).

Gdy któraś sekcja jest pusta — napisz to jednym słowem zamiast pomijać nagłówek. „Brak propozycji do
reviewerów" to informacja; brak sekcji to luka, której operator nie zauważy.

## Zasady twarde

- **Nigdy nie rozwiązuj wątku, którego nie zaadresowałeś.** Rozwiązany wątek znika operatorowi z widoku —
  to kasowanie uwagi, nie jej domknięcie.
- **Odmowa wymaga dokumentu decyzji** (`CLAUDE.md`, plan w `docs/plans/`, `docs/CONCEPTS.md`, `docs/decisions/`) i uzasadnienia
  poza jego nazwą; sam fragment kodu nie wystarcza. Workflow sam przeklasyfikowuje takie `odrzuć` na `do-operatora` — nie
  obchodź tego własnym uzasadnieniem w rozmowie.
- **Zakaz `git add -A` i `git add .`** — commit jawnym pathspec zmienionych plików.
- **Nie osłabiaj asercji zachowania, żeby test przeszedł.** Uwaga bota o brakującym przypadku brzegowym = dopisz test. Atrapę odtwarzającą
  sekwencję wywołań i test opisujący zmieniane zachowanie można zmienić, gdy wątek tego wymaga, z uzasadnieniem w commicie.
- **Znalezisko spoza zakresu PR** zgłaszasz operatorowi przed merge'em, nie w raporcie po nim.
- **Nie rozszerzaj zakresu poza wybrane wątki.** Każda dodatkowa zmiana wraca jako kolejny komentarz
  bota w następnej turze.

## Referencje kontekstowe

- `.claude/scripts/pr/stan-pr.mjs` — tury, decyzje o wątkach i recenzja czubka z PR; `.claude/scripts/pr/kontrakt-bota.mjs` — kontrakt `.coderabbit.yaml`
- `.claude/workflows/dev-pr-wf.js` — mechanika; etapy `start` / `stan` / `decyzja` / `zbierz` / `napraw` / `merge` / `claude-md` / `compound`
- `.claude/rules/coding-rules.md` i `.claude/rules/stack.md` — reguły kodu i mechanizmy stacku, których naprawy muszą przestrzegać
- `.claude/skills/dev-compound/SKILL.md` — procedura bazy wiedzy używana przez etap `compound`
- `.coderabbit.yaml` w repo projektu — gdy ma `auto_incremental_review: true`, każda tura poprawek
  dostaje recenzję automatycznie i krok 2 ma sens; bez tego operator musi poprosić bota ręcznie

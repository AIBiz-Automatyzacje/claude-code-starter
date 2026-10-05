---
name: dev-pr
description: "Obsługa pull requesta od wysłania do merge'a: tworzy PR, czeka na recenzję bota, klasyfikuje uwagi wg wpływu na projekt, prowadzi tury poprawek i domyka je compoundem do bazy wiedzy. Używaj po `/dev-docs-complete`, gdy zadanie jest gotowe do wysłania, oraz gdy bot zostawił komentarze do obsłużenia."
argument-hint: "[liczba tur 1–3 — bez niej tryb interaktywny] [--bez-merge] | --claude-md <zadanie>"
---

# `/dev-pr` — od pull requesta do merge'a

Ten skill domyka odcinek, którego w pipelinie nie było. Do tej pory zadanie kończyło się na
`/dev-docs-complete`, a wszystko dalej — wysłanie PR, 127 komentarzy bota w 6 pull requestach,
14 commitów ręcznych tur — działo się poza szablonem i **nie zasilało bazy wiedzy**. Te same klasy
błędów wracały w kolejnym pull requeście.

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
| `/dev-pr 3` | **Autonomiczny, do 3 tur.** Sam wybierasz wg rubryki. Po wyczerpaniu tur albo po czystej turze przechodzisz do bramki merge'a. |
| `/dev-pr 3 --bez-merge` | Jak wyżej, ale kończysz raportem zamiast merge'em. |
| `/dev-pr --claude-md <zadanie>` | Tylko krok „uzgodnij CLAUDE.md” dla zmergowanego zadania (np. po STOP-ie bootstrapu autopilota). |

**Sufit: 3 tury** w każdym trybie (`/dev-pr 5` = 3). Workflow nie wystartuje czwartej tury napraw. Wyczerpany limit = domknięcie,
nawet gdy zostały otwarte wątki. Nie proponuj „jeszcze jednej tury" — zaraportuj, co zostało, i oddaj decyzję operatorowi.

## Przebieg

Ustal `zadanie` (nazwa folderu w `docs/completed/` lub `docs/active/` — z argumentu, z nazwy gałęzi
`feature/<nazwa>` albo zapytaj), `tury` (liczba z argumentu, najwyżej 3, brak = tryb interaktywny) i `bezMerge`.
`--claude-md <zadanie>` → od razu krok „Uzgodnienie CLAUDE.md” z punktu 6, bez kroków 1–5.

### 1. Start — bramka wejścia i pull request

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "start", zadanie}})
```

`status: "STOP"` → wypisz `powod` i **zakończ**. Nie obchodź bramki: nie commituj cudzych zmian, nie
przełączaj gałęzi, nie twórz PR z gałęzi głównej.

`status: "OK"` → powiedz jednym zdaniem, czy PR został utworzony, czy już istniał, i podaj URL.

### 2. Czekanie na recenzję bota

Użyj `Monitor` z pętlą until na `gh pr view --json reviews,comments`, aż pojawi się recenzja bota dla
bieżącego `headRefOid` i zniknie znacznik „reviewing". **Limit czasu: 20 minut** (domyślnie; operator
może podać inny).

Limit minął bez recenzji → raport „bot nie odpowiedział w ciągu N minut", stan PR, **koniec bez zmian
w kodzie**. Nie zgaduj, co bot by powiedział.

### 3. Zebranie i klasyfikacja

```
Workflow({scriptPath: ".claude/workflows/dev-pr-wf.js", args: {etap: "zbierz", zadanie, tura}})
```

Wołasz go w **każdej** turze, także drugiej i trzeciej. Workflow zwraca `rekomendacja`, `token`, `watki[]` (każdy z `klasa`,
`uzasadnienie`, `wplywNaProjekt`, `klaster`, `token`), `licznik` i `recenzjaAktualna`. **Pierwszy wiersz** Twojej wiadomości
o turze to `rekomendacja` 1:1 (MERGUJ / NIE MERGUJ — warunek / KOLEJNA TURA / DECYZJA OPERATORA — liczy ją JS).

`recenzjaAktualna: false` → recenzja nie dotyczy czubka gałęzi. Wróć do kroku 2 i poczekaj na recenzję
przyrostową, zamiast naprawiać na podstawie nieaktualnych uwag.

Zero wątków albo `rekomendacja` inna niż KOLEJNA TURA → przejdź do kroku 6 (domknięcie).

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
          args: {etap: "compound", zadanie, watki: <wszystkie wątki ze wszystkich tur>}})
```

Workflow zapisuje do `docs/solutions/` **klasy błędów**, które bot znalazł po naszym własnym review, z polami wiedzy
(klasa, reguła, wzorce plików, szczebel). Wpisy ze szczeblem `regula` trafiają do indeksu `docs/learned-patterns.md`,
wpisy `kod` i `lint` wracają jako `propozycjeBramek[]`; obok nich `propozycjeDoReviewerow[]`.

**Propozycji bramek nie wdrażasz.** Typ albo reguła lint to zmiana kodu projektu — decyzja operatora; zapis zostaje
w samym solution (`szczebel`, `szczebel_powod`).

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

## Raport końcowy

```text
Rekomendacja: <rekomendacja z ostatniego etapu zbierz albo merge, 1:1>
🔀 PR #<numer> — <url>
   Tury: <N wykonanych> / <limit albo "interaktywnie"> (sufit 3)
   Wątki: naprawione <a> · odrzucone z dokumentem decyzji <b> · do operatora <c> · nieruszone <d>
   Walidacja ostatniej tury: PASS/FAIL/BRAK-KOMEND
   Merge: <zmergowany / gotowy do decyzji: lista niespełnionych warunków / --bez-merge>
   CLAUDE.md: <uzgodniony (przed → po zn, commit, push) / STOP: powód / nie dotyczy — PR niezmergowany>

<tabela każdej tury z pola `tabela` etapu napraw, w kolejności tur>

📚 Baza wiedzy: <N wpisów w docs/solutions/>, indeks: <indeks>, odmowy: <odmowy albo „brak”>
   <uwagaIndeksu z etapu compound, gdy niepusta: „Indeks wiedzy pełny — uruchom `/dev-compound-refresh` (pełny przegląd)”>

🧱 Propozycje bramek (do Twojej decyzji, NIE wdrożone; zapis: solution ze szczeblem kod/lint):
   - [<szczebel>] <klasa>: <propozycja> — <powod> (<solution>)

🔁 Propozycje do reviewerów (do Twojej decyzji, NIE wdrożone; zapis: docs/reviews/propozycje-do-reviewerow.md):
   - <agent> ← <klasa uwagi> (wystąpiła w: <PR-y>)
     Proponowana reguła: <treść>

⚠️ Do Twojej decyzji: <wątki do-operatora, jeden wiersz na wątek z wplywNaProjekt>
```

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

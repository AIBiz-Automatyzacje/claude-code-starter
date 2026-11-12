---
name: sync-template
description: "Aktualizuje maszynerię workflow (.claude/: skille, agenci, reguły, hooki, workflows, templates + settings.json) w bieżącym projekcie, zaciągając najnowszą wersję z repo szablonu (claude-code-starter albo repo wariantu stacku z profilu projektu). Jednym uruchomieniem sprawdza czy w szablonie pojawiły się jakiekolwiek zmiany i automatycznie je aplikuje. Używaj gdy: „zaktualizuj szablon\", „zsynchronizuj .claude\", „zaciągnij zmiany z szablonu\", „sync template\", „czy są nowe skille/agenci\", „update workflow\", „odśwież folder Claude\" — a także po wrzuceniu tego szablonu do nowego projektu, żeby dociągnąć maszynerię. Wywołuj TEN skill zawsze gdy user chce zsynchronizować konfigurację Claude Code z centralnym szablonem, nawet jeśli nie nazwie tego wprost „synchronizacją\"."
argument-hint: "[opcjonalnie: --dry-run (tylko podgląd), --force (aplikuj mimo tej samej wersji)]"
---

# sync-template — aktualizacja maszynerii workflow z szablonu

Zaciąga najnowszą wersję folderu `.claude/` z repo szablonu (branch `main`) do bieżącego projektu.
Adres repo bierze z klucza `szablon.repo` w `.claude/stack/profil.json` projektu: wariant stacku publikuje się do
własnego repo, a bez profilu albo klucza zostaje **`AIBiz-Automatyzacje/claude-code-starter`**. Zmienna
`TEMPLATE_REPO_URL` wygrywa z obu.
Powstał, żeby po wrzuceniu szablonu do innego projektu nie trzeba było ręcznie
dyktować linku i prosić o aktualizację — jedno uruchomienie sprawdza, czy w
szablonie coś się zmieniło, i automatycznie to aplikuje.

## Model działania (ważne — tak zdecydował user)

- **Zakres:** tylko maszyneria `.claude/` — `skills/`, `agents/`, `rules/`,
  `hooks/`, `workflows/`, `templates/`, `scripts/`, `docs/` oraz `settings.json`. **Nie** rusza
  `settings.local.json` (lokalny), rootowego `README.md`/`CLAUDE.md` ani `docs/` projektu.
- **Bez testów maszynerii:** katalogi `__tests__/` są testami repo szablonu (zależą od jego `node_modules` i katalogu
  `stacks/`), więc do projektów nie jadą i nie są kontrolą projektu. Testy z wcześniejszych synców następny sync zdejmuje
  jako `USUNIETE`, z kopią w backupie. Po pierwszym syncu na tę wersję uruchom sync drugi raz: pierwszy idzie jeszcze starym
  skryptem z projektu i testy kopiuje, drugi (już nowym skryptem) je zdejmuje, także gdy szablon się nie zmienił.
- **Szablon zawsze wygrywa:** pliki wspólne są nadpisywane wersją z szablonu, także
  gdy były lokalnie modyfikowane. Nadpisywane i usuwane pliki najpierw trafiają do
  backupu (ścieżka odwrotu) — user nie musi tego zatwierdzać.
- **Tryb w pełni automatyczny:** aplikuj od razu, bez pytania o potwierdzenie planu.
  Raport podsumowujący pokaż dopiero na końcu.
- **Pliki lokalne projektu są bezpieczne:** cokolwiek istnieje lokalnie, a czego
  szablon nigdy nie miał (np. własny skill projektu), pozostaje nietknięte. Usuwane
  są wyłącznie pliki, które szablon *wcześniej dostarczał*, a teraz je wycofał
  (wykrywane przez manifest `.claude/.template-manifest`).

## Wykonanie

Uruchom bundlowany skrypt — robi całość deterministycznie (klon → porównanie SHA →
klasyfikacja → backup → apply → aktualizacja markera wersji i manifestu):

```bash
bash .claude/skills/sync-template/scripts/sync-template.sh
```

Skrypt sam wykrywa katalog projektu (`$CLAUDE_PROJECT_DIR` → git toplevel → `pwd`),
klonuje szablon płytko do katalogu tymczasowego przez `git`/istniejące
poświadczenia (`gh auth`/git credentials) i sprząta po sobie.

**Argumenty (przekaż dalej, jeśli user o nie poprosił):**
- `--dry-run` — pokaż co by się zmieniło, nic nie zapisuj (przydatne, gdy user
  chce najpierw zobaczyć skalę zmian, mimo domyślnie automatycznego trybu).
- `--force` — aplikuj nawet gdy SHA szablonu = ostatni zsynchronizowany (np. gdy
  ktoś ręcznie namieszał w `.claude/` i chce twardy reset do wersji z szablonu).

## Odczyt wyniku skryptu

Skrypt wypisuje ustrukturyzowany raport, który streszczasz userowi po polsku:

- `STATUS: UP_TO_DATE` → szablon aktualny. Powiedz krótko „Szablon jest aktualny,
  brak zmian do zaciągnięcia" i zakończ. Nie kombinuj dalej.
- `STATUS: CHANGES` + `COUNTS: nowe=… zmienione=… usuniete=… bez_zmian=…` →
  podsumuj liczby i wypisz **konkretne** pozycje z sekcji `NOWE`/`ZMIENIONE`/`USUNIETE`
  (to interesuje usera najbardziej — jakie skille/agenci przybyły albo się zmieniły).
- `APPLIED: …` → potwierdź, że zmiany zaaplikowano.
- `BACKUP: <ścieżka>` → podaj userowi tę ścieżkę jako punkt odwrotu (tam są
  poprzednie wersje nadpisanych/usuniętych plików).
- `NOWA SESJA: …` → przekaż userowi dosłownie jako ostatnie zdanie raportu: instrukcje i skille
  są buforowane w sesji, więc `/dev-autopilot-wf` uruchomiony w tej sesji działałby na starej
  maszynerii.
- `RUNNER TESTÓW: <szczegół> — poprawka: <config>` (także po `STATUS: UP_TO_DATE`) → vitest albo jest
  projektu zbiera pliki testów spod `.claude/**` (własne testy projektu, kopie w `.claude/.backups/`) i autopilot
  zatrzyma się na `npm test` na starcie.
  Przekaż userowi linię z poprawką (wpis `exclude` w pliku configu, który podaje) i zaproponuj, że ją
  wpiszesz i zacommitujesz. Sync i tak się udał.
- `HIGIENA: <element> — <szczegół> — naprawa: <komenda>` (każdy sync, także `UP_TO_DATE`) → rzecz, której sync nie
  przenosi, a która kosztuje albo psuje pipeline: stara baza wiedzy (`learned-patterns.md` w `.claude/rules/`), kontekst startowy
  agenta ponad próg (CLAUDE.md + reguły bez `paths:`), pozostałości starego zestawu w `.claude/`, hook wskazujący usunięty
  plik, `.claude/.backups/` albo `CLAUDE.md` w podkatalogach poza `.gitignore`, bajt sterujący w wiedzy, brak albo nieaktualny
  `.coderabbit.yaml`. Wypisz każdą linię z naprawą jako listę do decyzji usera — sam niczego nie naprawiasz. Sync i tak się udał.
- `--- DOCTOR (pierwsza instalacja) ---` + tabela + `DOCTOR_KOD: <n>` → pierwsza instalacja
  szablonu w projekcie. Pokaż userowi tabelę. `DOCTOR_KOD: 0` = wszystkie obowiązkowe narzędzia są;
  inny kod = wypisz wiersze `BRAK` z komendami z kolumny „Instalacja" i powiedz, że bez nich run
  pipeline'u się zatrzyma. Sync i tak się udał — nie ponawiaj go. Ten sam sprawdzian user uruchamia
  później sam: `bash .claude/scripts/doctor/doctor.sh`.

## Obsługa błędów

- `BŁĄD: nie udało się sklonować…` → repo może być prywatne lub brak sieci.
  Przekaż userowi stderr z git i zasugeruj `gh auth login` / sprawdzenie sieci.
  **Nie** ponawiaj w kółko tej samej komendy.
- `BŁĄD: brak 'git' w PATH` → git nie jest zainstalowany; zgłoś to userowi.
- `BŁĄD: niepoprawny szablon.repo w .claude/stack/profil.json` (kod 7) → profil stacku projektu ma klucz, który nie jest
  adresem git. Skrypt niczego nie ruszył i celowo nie wrócił do claude-code-starter, bo projekt innego stacku dostałby
  cudzy wariant. Przekaż userowi wartość klucza; poprawny adres podaje profil w repo szablonu tego stacku.
- `syntax error` w `sync-template.sh` (kod wyjścia bywa 0) albo brak linii `APPLIED`/`STATUS` → sync podmienił własny skrypt
  w trakcie działania: pliki są już nowe, a marker wersji i manifest nie. Uruchom skrypt **ponownie** (ten sam, już nowy) —
  zaktualizuje marker i manifest, pliki ma identyczne. Od wersji z blokiem `{ …; exit; }` skrypt jest parsowany w całości
  przed wykonaniem; błąd może się zdarzyć tylko raz, przy przejściu ze starszej kopii.
- `BŁĄD: workflow(y) w szablonie nie parsują się` → w **szablonie** jest plik
  `.claude/workflows/*.js`, którego runtime by nie zarejestrował. Skrypt nie
  zaaplikował **niczego**, projekt jest nietknięty. To defekt po stronie szablonu, nie
  projektu: przekaż userowi listę plików ze stdout i powiedz, że naprawa idzie do repo
  szablonu (tam `node --test '.claude/workflows/__tests__/skladnia-workflowow.test.mjs'`
  odtwarza błąd). **Nie obchodź tego** kopiowaniem plików ręcznie — zepsuty
  workflow milczy aż do pierwszego wywołania, a wtedy autopilot pada w środku fazy.

Nie modyfikuj skryptu „w locie", żeby obejść błąd konfiguracji — zdiagnozuj przyczynę.

## Higiena repo

Katalog backupów `.claude/.backups/` i pliki `.claude/.template-version` /
`.claude/.template-manifest` / `.claude/.template-hashes` to lokalne bookkeeping — zasugeruj userowi dodanie
`.claude/.backups/` do `.gitignore` projektu, jeśli jeszcze go tam nie ma. `.template-hashes` (hash gita
każdego pliku z chwili syncu) czyta telemetria: czy run wykonał dokładnie wersję z szablonu (`run.szablon.zgodny`).

Przy syncu przejrzyj `docs/reviews/propozycje-do-reviewerow.md` projektu, gdy istnieje: propozycje, które szablon już
przyjął, można wtedy z pliku usunąć.

## Uwagi techniczne

- Skrypt jest zgodny z **bash 3.2** (domyślny na macOS) — bez associative arrays.
- `settings.json` (współdzielona konfiguracja szablonu) jest nadpisywany; lokalne
  nadpisania konfiguracji projekt trzyma w `settings.json` **local** — czyli
  `settings.local.json`, którego skrypt nigdy nie dotyka.
- Skill narzędzia z własnym upstreamem aktualizuje się przez repo jak każdy inny skill;
  jego twarda synchronizacja z upstreamem to osobny proces opisany w
  `ZRODLA-SZABLONU.md` — nie mieszaj tych dwóch.

## Domknięcie synca

Zmiany z synca idą na gałąź główną własnym PR-em, bez czekania na recenzję bota. W aa-exam (PR #52) i dashboardzie (PR #127)
PR z samą maszynerią przeszedł pełny proces: bot pominął filtrami 146 ze 147 plików albo nie zgłosił żadnej uwagi.

1. Gałąź `chore/szablon-<data>` (np. `chore/szablon-2026-11-07`) od aktualnej gałęzi głównej.
2. Commit zmian z synca.
3. PR z tytułem zaczynającym się od `chore(szablon)`, np. `chore(szablon): sync do <sha>`.
4. CI tam, gdzie się uruchamia: poczekaj na wynik, czerwony check napraw przed merge'em.
5. Merge bez czekania na recenzję bota. Gdy merge oznacza deploy, powiedz to operatorowi w pytaniu o zgodę.
6. Po merge'u, który oznacza deploy: sprawdź produkcję.

Push, utworzenie PR i merge to publikacja: każda z tych czynności wymaga zgody operatora w tej sesji.

Słowo `chore(szablon)` wyłącza recenzję tylko wtedy, gdy `.coderabbit.yaml` projektu ma je w
`reviews.auto_review.ignore_title_keywords`. Sync tego pliku nie rusza: słowo dopisuje `/coderabbit-setup` albo jedna linia
w configu, zanim powstanie PR. PR synca nie idzie przez `/dev-pr`: nie ma zadania, a `/dev-pr` w projekcie z botem czeka na jego recenzję.

## Pierwsze wprowadzenie do projektu

Po pierwszej synchronizacji doprowadź do tego, żeby maszyneria była na zdalnej gałęzi głównej: push `main` (po decyzji operatora, bo może oznaczać deploy) albo osobny PR z sekcji „Domknięcie synca”. Inaczej
pierwszy `/dev-pr` policzy jej pliki jako część zadania. Linie `HIGIENA:` przejdź przed pierwszym `/dev-pr`, także CodeRabbit (bot jest opcjonalny; projekt bez niego zapisuje wybór w `.claude/projekt.json`, którego sync nie rusza): istniejący `.coderabbit.yaml` musi spełniać kontrakt pipeline'u
(`node .claude/scripts/pr/kontrakt-bota.mjs --galaz main`), a nie tylko istnieć.

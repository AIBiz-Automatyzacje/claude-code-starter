---
name: sync-template
description: "Aktualizuje maszynerię workflow (.claude/: skille, agenci, reguły, hooki, workflows, templates + settings.json) w bieżącym projekcie, zaciągając najnowszą wersję z repo szablonu claude-code-starter. Jednym uruchomieniem sprawdza czy w szablonie pojawiły się jakiekolwiek zmiany i automatycznie je aplikuje. Używaj gdy: „zaktualizuj szablon\", „zsynchronizuj .claude\", „zaciągnij zmiany z szablonu\", „sync template\", „czy są nowe skille/agenci\", „update workflow\", „odśwież folder Claude\" — a także po wrzuceniu tego szablonu do nowego projektu, żeby dociągnąć maszynerię. Wywołuj TEN skill zawsze gdy user chce zsynchronizować konfigurację Claude Code z centralnym szablonem, nawet jeśli nie nazwie tego wprost „synchronizacją\"."
argument-hint: "[opcjonalnie: --dry-run (tylko podgląd), --force (aplikuj mimo tej samej wersji)]"
---

# sync-template — aktualizacja maszynerii workflow z szablonu

Zaciąga najnowszą wersję folderu `.claude/` z centralnego repo szablonu
**`AIBiz-Automatyzacje/claude-code-starter`** (branch `main`) do bieżącego projektu.
Powstał, żeby po wrzuceniu szablonu do innego projektu nie trzeba było ręcznie
dyktować linku i prosić o aktualizację — jedno uruchomienie sprawdza, czy w
szablonie coś się zmieniło, i automatycznie to aplikuje.

## Model działania (ważne — tak zdecydował user)

- **Zakres:** tylko maszyneria `.claude/` — `skills/`, `agents/`, `rules/`,
  `hooks/`, `workflows/`, `templates/`, `docs/` oraz `settings.json`. **Nie** rusza
  `settings.local.json` (lokalny), rootowego `README.md`/`CLAUDE.md` ani `docs/` projektu.
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

## Obsługa błędów

- `BŁĄD: nie udało się sklonować…` → repo może być prywatne lub brak sieci.
  Przekaż userowi stderr z git i zasugeruj `gh auth login` / sprawdzenie sieci.
  **Nie** ponawiaj w kółko tej samej komendy.
- `BŁĄD: brak 'git' w PATH` → git nie jest zainstalowany; zgłoś to userowi.

Nie modyfikuj skryptu „w locie", żeby obejść błąd konfiguracji — zdiagnozuj przyczynę.

## Higiena repo

Katalog backupów `.claude/.backups/` i pliki `.claude/.template-version` /
`.claude/.template-manifest` to lokalne bookkeeping — zasugeruj userowi dodanie
`.claude/.backups/` do `.gitignore` projektu, jeśli jeszcze go tam nie ma.

## Uwagi techniczne

- Skrypt jest zgodny z **bash 3.2** (domyślny na macOS) — bez associative arrays.
- `settings.json` (współdzielona konfiguracja szablonu) jest nadpisywany; lokalne
  nadpisania konfiguracji projekt trzyma w `settings.json` **local** — czyli
  `settings.local.json`, którego skrypt nigdy nie dotyka.
- `agent-browser` aktualizuje się przez repo jak każdy inny skill; jego twarda
  synchronizacja z upstream CLI (vercel-labs) to osobny proces opisany w
  `ZRODLA-SZABLONU.md` — nie mieszaj tych dwóch.

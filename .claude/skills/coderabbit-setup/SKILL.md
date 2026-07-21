---
name: coderabbit-setup
description: "Tworzy dopasowany do stacku projektu plik .coderabbit.yaml, żeby CodeRabbit robił automatyczny AI code review każdego pull requesta przed merge. Wykrywa stack (Expo/RN, Next.js, React+Vite, Node, Supabase), skleja config z bazowego template'u + bloków per stack i waliduje YAML. Używaj gdy: „skonfiguruj CodeRabbit\", „dodaj CodeRabbit do projektu\", „coderabbit setup\", „ustaw AI reviewera PR-ów\", „dodaj code review do repo\", „chcę review pull requestów\" — a także przy bootstrapie nowego projektu, gdy user chce mieć reviewera PR od startu."
argument-hint: "[opcjonalnie: stack — expo | next | react-web | node | supabase (można łączyć)]"
---

# coderabbit-setup — konfiguracja CodeRabbit dla projektu

Tworzy `.coderabbit.yaml` w korzeniu repo — spójny ze standardem z pozostałych
projektów (język polski, profil assertive, te same tools i reguły z
`coding-rules.md`), a dopasowany do stacku bieżącego projektu.

## Pliki skilla

- `templates/coderabbit-base.yaml` — część wspólna configu (tone, review, tools,
  knowledge_base). Zawiera komentarze `# STACK:` i `# UZUPEŁNIJ:` wskazujące
  miejsca do dopasowania.
- `reference/stack-blocks.md` — gotowe bloki `path_filters` + `path_instructions`
  per stack, z sygnałami detekcji.

## Wykonanie

1. **Sprawdź istniejący config.** Jeśli `.coderabbit.yaml` już istnieje w korzeniu
   repo — pokaż userowi diff względem tego, co byś wygenerował, i ZAPYTAJ czy
   nadpisać. Nie nadpisuj bez potwierdzenia.

2. **Wykryj stack.** Przeczytaj `package.json` (dependencies + devDependencies)
   i strukturę katalogów. Sygnały detekcji są opisane przy każdym bloku w
   `reference/stack-blocks.md`. Jeśli user podał stack w argumencie — użyj go
   zamiast detekcji. Jeśli detekcja jest niejednoznaczna (np. brak package.json) —
   ZAPYTAJ usera o stack, nie zgaduj.

3. **Sklej config.** Weź `templates/coderabbit-base.yaml` w całości i:
   - dołóż do `path_filters` i `path_instructions` bloki wykrytego stacku
     (Supabase łączy się z blokiem frontowym),
   - w `path_instructions` zostaw TYLKO wpisy dla katalogów, które istnieją
     w projekcie (wyjątek: świeży projekt przed init — wtedy zostaw z komentarzem,
     że filtry są przygotowane z wyprzedzeniem),
   - w `knowledge_base.code_guidelines.filePatterns` wpisz TYLKO istniejące pliki —
     sprawdź kolejno: `.claude/rules/coding-rules.md`, `CLAUDE.md`, dodatkowe
     konwencje w `docs/` (np. `docs/figma-build-conventions.md`),
   - jeśli branch główny to nie `main` (sprawdź `git symbolic-ref refs/remotes/origin/HEAD`
     lub `git branch`) — popraw `base_branches`.

4. **Zapisz** jako `.coderabbit.yaml` w korzeniu repo (git toplevel, nie cwd).

5. **Zwaliduj YAML.** Uruchom:
   ```bash
   ruby -ryaml -e 'YAML.load_file(".coderabbit.yaml"); puts "YAML OK"'
   ```
   (systemowy ruby jest na macOS; gdyby go nie było — zwaliduj innym dostępnym
   parserem YAML). Błąd parsowania = napraw plik, nie pomijaj walidacji.

6. **Zweryfikuj instalację aplikacji GitHub CodeRabbit — KROK OBOWIĄZKOWY,
   nie pomijaj go nigdy.** Bez zainstalowanej aplikacji config jest martwym
   plikiem. Instalacji nie da się wykonać z CLI, ale da się ją WYKRYĆ:
   ```bash
   gh api user/installations --jq '.installations[] | select(.app_slug == "coderabbitai") | .account.login'
   ```
   - Wynik zawiera ownera repo (porównaj z `gh repo view --json owner -q .owner.login`)
     → instalacja jest, odnotuj ✅.
   - Wynik pusty, brak ownera albo błąd → uznaj instalację za BRAKUJĄCĄ (❌).
     Sygnał potwierdzający: sprawdź, czy bot komentował ostatnie PR-y —
     ```bash
     gh pr list --state merged --limit 3 --json number -q '.[].number'
     gh api "repos/{owner}/{repo}/issues/<nr>/comments" --jq '[.[] | select(.user.login == "coderabbitai[bot]")] | length'
     ```
     Zero komentarzy bota na istniejących PR-ach = na pewno brak instalacji.

7. **Raport dla usera — ZAWSZE wypisz wszystkie 4 punkty poniżej.** Nie skracaj
   i nie pomijaj żadnego, nawet gdy wszystko jest OK:
   1. Wykryty stack + które bloki weszły do configu.
   2. Pliki wpisane do `code_guidelines.filePatterns`.
   3. **Instalacja aplikacji GitHub CodeRabbit: ✅ albo ❌** (wynik kroku 6).
      Przy ❌ powiedz wprost: „**Bez tego config NIE DZIAŁA.** Jednorazowy krok
      ręczny w przeglądarce (nie da się z CLI):
      https://github.com/apps/coderabbitai → Configure → zaznacz to repo."
   4. Przypomnienie: `.coderabbit.yaml` trzeba **zacommitować i wypchnąć** —
      CodeRabbit czyta config z brancha PR-a, więc już pierwszy PR zawierający
      ten plik jest reviewowany według niego.

## Czego NIE robić

- Nie dodawaj sekcji, których nie ma w template (np. `pre_merge_checks`,
  `finishing_touches`, `slop_detection`) — user świadomie z nich zrezygnował.
- Nie zmieniaj `tone_instructions`, `profile` ani listy `tools` bez wyraźnej
  prośby usera — to ustandaryzowane między projektami.
- Nie wpisuj do `filePatterns` plików, których nie ma w repo — CodeRabbit
  po cichu je zignoruje, a config kłamie.

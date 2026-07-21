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

6. **Raport dla usera.** Podsumuj: wykryty stack, które bloki weszły do configu,
   jakie pliki trafiły do `code_guidelines.filePatterns`. Przypomnij o kroku
   ręcznym, bez którego config nie działa:
   - aplikacja GitHub **CodeRabbit** musi być zainstalowana na repo (jednorazowo:
     https://github.com/apps/coderabbitai → Configure → zaznacz repo),
   - config zadziała od pierwszego PR-a po jego zamergowaniu do brancha bazowego
     (CodeRabbit czyta `.coderabbit.yaml` z brancha PR-a, więc pierwszy PR
     z samym configiem też już jest reviewowany wg niego).

## Czego NIE robić

- Nie dodawaj sekcji, których nie ma w template (np. `pre_merge_checks`,
  `finishing_touches`, `slop_detection`) — user świadomie z nich zrezygnował.
- Nie zmieniaj `tone_instructions`, `profile` ani listy `tools` bez wyraźnej
  prośby usera — to ustandaryzowane między projektami.
- Nie wpisuj do `filePatterns` plików, których nie ma w repo — CodeRabbit
  po cichu je zignoruje, a config kłamie.

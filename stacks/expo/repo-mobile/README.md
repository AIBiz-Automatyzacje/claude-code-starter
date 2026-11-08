# Workspace Template Mobile

Wariant [Claude Code Starter](https://github.com/AIBiz-Automatyzacje/claude-code-starter) dla aplikacji mobilnych na stacku
**Expo (React Native) + TypeScript + Supabase + Uniwind**. Kopiujesz folder `.claude/` do projektu Expo i Claude dostaje ten
sam pipeline co w wariancie webowym (plan, autopilot fazami, review, naprawy, wnioski), a do tego skille, agentów i testy
E2E pod aplikację natywną.

## Skąd pochodzi `.claude/`

Tego folderu nikt tu nie pisze ręcznie. Powstaje w repo
[`claude-code-starter`](https://github.com/AIBiz-Automatyzacje/claude-code-starter) z dwóch części:

- **rdzeń**: `.claude/` i `output-styles/` szablonu, wspólne dla webu i mobile;
- **nakładka Expo**: `stacks/expo/` w tym samym repo. Usuwa pliki webowe (`usun.txt`), podmienia lub dodaje pliki stacku
  (`nakladka/`) i dokłada ustawienia (`settings.patch.json`).

Build (`node stacks/zbuduj.mjs expo <katalog>`) skleja obie części, a wynik trafia tu commitem `sync: rdzeń <sha>`.
SHA rdzenia, z którego zbudowano wariant, jest w `.claude/.rdzen-version`.

## Nie edytuj `.claude/` w tym repo

Zmiany w `.claude/` i `output-styles/` idą do `claude-code-starter`: treść wspólna do rdzenia, treść Expo do `stacks/expo/`.
Następna publikacja i tak nadpisałaby ręczną zmianę. Workflow `straznik-claude` buduje wariant z SHA w `.claude/.rdzen-version`
i porównuje go z tym repo, więc commit, który zmienia te katalogi inaczej niż build, nie przejdzie CI.

README, `docs/` i `.github/` tego repo edytujesz normalnie.

## Instalacja

Wszystko instalujesz w projekcie, nie globalnie na koncie.

1. Skopiuj folder `.claude/` do katalogu projektu Expo i zacommituj go (`.claude/settings.local.json` zostaje tylko Twój).
2. Zainstaluj pluginy projektu (Claude Code sam ich nie instaluje). Plugin `expo` (skille `expo:*`) pochodzi z marketplace'u
   w repo [`claude-code-starter`](https://github.com/AIBiz-Automatyzacje/claude-code-starter), który przypina
   [`expo/skills`](https://github.com/expo/skills) na jednym commicie. W katalogu projektu:
   ```bash
   claude plugin marketplace add AIBiz-Automatyzacje/claude-code-starter
   claude plugin install expo@claude-code-starter --scope project
   claude plugin install figma@claude-plugins-official --scope project
   ```
   `figma` czyta makiety; bez makiet jest niepotrzebny.
3. Włącz **Dynamic Workflows**: `/config` → *Dynamic workflows* = `true`. Bez tego `dev-autopilot-wf` nie istnieje.
4. Sprawdź projekt doctorem i doinstaluj to, co pokazuje kolumna „Instalacja”:
   ```bash
   bash .claude/scripts/doctor/doctor.sh
   ```
5. Otwórz **nową** sesję Claude Code i wpisz `/dev-brainstorm` albo `/dev-plan`.

Testy E2E na symulatorze albo emulatorze (Maestro, dev-client, osobna baza e2e) ustawiasz według
[`.claude/templates/e2e-env/README.md`](.claude/templates/e2e-env/README.md). Bramki domknięcia faz: wzory w
`.claude/templates/bramki/`.

## Aktualizacja

`/sync-template` w projekcie zaciąga najnowszą wersję z tego repo. Adres bierze z `szablon.repo` w
`.claude/stack/profil.json`, więc projekt mobile nie dostanie przez pomyłkę wariantu webowego. Nadpisywane pliki trafiają do
`.claude/.backups/`. Po syncu zacznij nową sesję, bo skille i instrukcje wczytują się na starcie.

### Przejście ze starego szablonu mobile

Projekt zsynchronizowany z tym repo przed listopadem 2026 ma starszy zestaw (inne nazwy agentów, skille `dev-docs*`,
`learned-patterns.md` w `.claude/rules/`). Pierwszy sync usunie pliki, których nowy wariant już nie ma. Przed nim:

1. Przenieś reguły z `.claude/rules/learned-patterns.md` do `docs/solutions/` albo do reguł projektu i zacommituj je.
   Sync nadpisuje pliki szablonu, więc edytowana kopia zniknie (zostanie tylko w backupie).
2. Uruchom `/sync-template --dry-run` i przejrzyj listę zmian.
3. Zacommituj stan projektu, potem uruchom sync bez `--dry-run`.

## Bonus: Output Style „adhd"

W [`output-styles/adhd.md`](output-styles/adhd.md) jest Output Style, przy którym Claude zaczyna od konkretu zamiast ściany
tekstu. Skopiuj go do `.claude/output-styles/` projektu, zrestartuj sesję i wybierz w `/config` → *Output style* → *adhd*.

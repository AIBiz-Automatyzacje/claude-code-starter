[![Akademia Automatyzacji](assets/baner-akademia-automatyzacji.png)](https://akademiaautomatyzacji.com)

> **[Dołącz do Akademii Automatyzacji →](https://akademiaautomatyzacji.com)** - 1350+ osób
> uczy się u nas automatyzacji i AI na prawdziwych wdrożeniach, nie na teorii.

# Claude Code Starter

Gotowy system pracy z Claude Code. Kopiujesz jeden folder do swojego projektu i Claude
przestaje pisać kod na ślepo - dostaje skille, agentów i reguły, dzięki którym prowadzi
projekt od pomysłu do działającej aplikacji.

## Do czego to służy

Sami na tym budujemy własne aplikacje w Akademii Automatyzacji. Po skopiowaniu folderu `.claude/` Twój Claude:

- **Pomaga doprecyzować, CO budujesz** - zanim powstanie linijka kodu, przepyta Cię o wymagania i rozpisze plan techniczny.
- **Implementuje fazami i sam sprawdza swoją robotę** - każdą fazę przegląda do 7 niezależnych agentów-reviewerów
  (bezpieczeństwo, wydajność, jakość kodu, poprawność, zgodność ze specyfikacją, testy, E2E w prawdziwej przeglądarce),
  a poważne znaleziska przechodzą przez agenta-sceptyka, który próbuje je obalić. Błędy naprawia.
- **Zapamiętuje wnioski** - rozwiązane problemy trafiają do `docs/solutions/`, a reguły z nich dostają agenci pracujący
  nad tymi samymi plikami. Im dłużej pracujesz w projekcie, tym mniej błędów Claude powtarza.

Sterowanie trzyma kod, nie model: kolejność faz, bramki jakości i limity napraw są w deterministycznych workflowach JS.
Claude wykonuje zadania, ale nie decyduje, czy może pominąć review.

Całość jest zestrojona pod stack **React 19 + TypeScript + Supabase + Vite + Tailwind v4**. Na innym stacku rdzeń
(pipeline, review, baza wiedzy) zadziała, tylko skille techniczne będą do podmiany.

## Jak to działa

```
/dev-brainstorm → /dev-prep → /dev-plan → dev-autopilot-wf → /dev-pr → merge
  co budować     co dostarcza   jak budować   fazy: kod, review,   PR, recenzja bota,
                 człowiek       + zadanie     naprawy, wnioski     tury poprawek
```

1. **`/dev-brainstorm`** *(opcjonalny)* - przepytuje Cię pytanie po pytaniu, aż będzie jasne, co ma powstać. Efekt: dokument wymagań.
2. **`/dev-prep`** *(opcjonalny)* - lista tego, co musisz dostarczyć Ty: decyzje, konta i sekrety, treści, makiety.
3. **`/dev-plan`** - plan techniczny w fazach, branch `feature/<nazwa>`, zadanie w `docs/active/` i bramka gotowości.
   Na końcu dostajesz gotowe polecenie autopilota.
4. **`dev-autopilot-wf`** - wykonuje fazy jedna po drugiej: implementacja, review, naprawa. Na koniec zapisuje wnioski,
   archiwizuje zadanie i zostawia Ci listę rzeczy do ręcznego sprawdzenia (`docs/operator/<data>-<zadanie>-smoke.md`).
5. **`/dev-pr`** - tworzy PR, czeka na recenzję bota, prowadzi tury poprawek i zapisuje, czego nasze review nie złapało.

Szczegóły każdego kroku są w plikach skilli (`.claude/skills/<nazwa>/SKILL.md`) i workflowów (`.claude/workflows/`).

## Instalacja

Wszystko instalujesz **w projekcie**, nie globalnie na koncie, więc inne Twoje projekty nie płacą za to kontekstem.

1. Sklonuj repo i skopiuj folder `.claude/` do swojego projektu. Zacommituj go (`.claude/settings.local.json` zostaje tylko Twój).
2. Zainstaluj pluginy projektu (Claude Code sam ich nie instaluje). W katalogu projektu:
   ```bash
   claude plugin marketplace add sawyerhood/dev-browser
   claude plugin install dev-browser@dev-browser-marketplace --scope project
   claude plugin install figma@claude-plugins-official --scope project
   ```
   `figma` czyta makiety (bez makiet niepotrzebny), `dev-browser` to przeglądarka do Twojej ręcznej pracy z Claude.
3. Włącz **Dynamic Workflows**: `/config` → *Dynamic workflows* = `true`. To ustawienie konta, projekt nie włączy go za Ciebie.
   Bez tego `dev-autopilot-wf` nie istnieje.
4. Sprawdź projekt doctorem:
   ```bash
   bash .claude/scripts/doctor/doctor.sh
   ```
   `WYNIK: OK` = można startować. `BRAK` = doinstaluj to, co pokazuje kolumna „Instalacja”, i uruchom ponownie.
   Projekt z vitest/jest nie może zbierać testów z `.claude/**` - doctor poda gotowy wpis `exclude`.
5. Otwórz **nową** sesję Claude Code i wpisz `/dev-brainstorm` albo `/dev-plan`.

Aktualizacja szablonu w projekcie: `/sync-template` (zaciąga zmiany z tego repo, nadpisywane pliki trafiają do `.claude/.backups/`).
Po niej zacznij nową sesję - skille i instrukcje wczytują się na starcie.

## Wymagania

Doctor sprawdza listę pod Twój projekt: narzędzie warunkowe tylko wtedy, gdy projekt go używa. **BRAK** blokuje start
autopilota, **UWAGA** nie blokuje.

| Element | Kiedy | Instalacja (macOS) |
|---|---|---|
| git, node ≥ 22, gh (zalogowany) | zawsze | `brew install git node gh && gh auth login` |
| menedżer pakietów z lockfile | jest lockfile | np. `npm install -g pnpm` |
| supabase CLI | jest katalog `supabase/` | `brew install supabase/tap/supabase` |
| agent-browser (globalnie) | plan ma scenariusze `[E2E]` | `npm install -g agent-browser && agent-browser install` |
| jq | hook projektu go woła | `brew install jq` |
| Dynamic Workflows | zawsze | `/config` → Dynamic workflows: `true` |

## Bramki domknięcia

Każda faza kończy się skryptem bramek zamiast agenta, który „gra lintera”: tsc, ESLint, knip, size-limit, niezmienność
migracji, testy usunięte w fazie i Stryker na zmienionych liniach. Bramka bez narzędzia w projekcie nie blokuje, więc
działa tylko to, co zainstalujesz. W nowym projekcie, od pierwszego commita:

```bash
cp .claude/templates/bramki/eslint.config.szablon.ts eslint.config.ts
cp .claude/templates/bramki/knip.json .claude/templates/bramki/.size-limit.json .claude/templates/bramki/stryker.config.json .
pnpm add -D -E $(node -p "Object.entries(require('./.claude/templates/bramki/package.json').devDependencies).map(([n, v]) => n + '@' + v).join(' ')")
echo '.stryker-tmp/' >> .gitignore
```

TypeScript musi być < 6.1 (lista instaluje 5.9.3), bo reguły typowane ESLint i Stryker nie działają z TS 7. W istniejącym
projekcie ESLint wprowadzaj osobnym zadaniem sprzątającym.

## Testy E2E (opcjonalne)

Zadanie bez scenariuszy `[E2E]` i bez makiet nie uruchamia przeglądarki. Gdy chcesz testów w prawdziwej przeglądarce:

1. `.env.e2e` według [`.claude/templates/e2e-env/`](.claude/templates/e2e-env/README.md) - osobny projekt Supabase e2e
   (nigdy dev ani prod), adres i komenda startu aplikacji (domyślnie `localhost:5174`).
2. `/weryfikacja-setup` - skill weryfikacji projektu: jak uruchomić aplikację, zalogować się i gdzie są funkcje.

Autopilot sam stawia serwer, wgrywa migracje i seedy na bazę e2e, a tester odgrywa scenariusze. Scenariusz, którego
nie da się wykonać w trakcie runu, trafia do Twojej listy ręcznego sprawdzenia.

## Co jest w środku

| Katalog | Zawartość |
|---|---|
| `.claude/skills/` | pipeline `dev-*`, skille stacku (React/Tailwind, Supabase, UX/UI, bezpieczeństwo, Sentry) i narzędziowe (`agent-browser`, `makieta`, `coderabbit-setup`, `sync-template`, `weryfikacja-setup`, `zroastuj-mnie`, `coolify-manager`) |
| `.claude/agents/` | buildery warstw (z wariantami Figma), reviewerzy osi, tester E2E, research i klasy ról pipeline'u |
| `.claude/workflows/` | orkiestratory `-wf` w JS: autopilot, execute, review, compound, complete, PR |
| `.claude/scripts/` | logika deterministyczna z testami: doctor, bramki, plan, dossier review, E2E, wiedza, telemetria |
| `.claude/rules/coding-rules.md` | reguły kodu ładowane przy pracy z plikami kodu i SQL |
| `.claude/hooks/` | m.in. blokada wypisywania wartości z `.env*` i zbieranie telemetrii po runie |

W projekcie pipeline prowadzi `docs/`: `plans/` (plany), `active/` i `completed/` (zadania), `operator/` (listy dla
człowieka), `solutions/` i `learned-patterns.md` (wiedza), `CONCEPTS.md` (słownik domenowy).

## Najważniejsze zasady

- **Branch ustawiasz przed autopilotem** - workflow nie przełącza gałęzi (robi to `/dev-plan`).
- **Po STOP-ie bramki** (środowisko E2E, nieudana poprawka) i Twojej naprawie: **nowy run z tymi samymi `args`, bez `resumeFromRunId`**.
  `resumeFromRunId` tylko po awarii runu, też z tymi samymi `args`. Stan faz i tak wznawia się z `.autopilot-state.json`.
- **Raport telemetrii** zapisuj poza repo projektu (`--wyj`): niezacommitowane pliki zatrzymują następny start autopilota.
- **Konektory claude.ai** profil wyłącza tylko w terminalowym `claude`; w aplikacji desktop wyłącz je w menu konektorów sesji.

## Bonus: Output Style „adhd"

W [`output-styles/adhd.md`](output-styles/adhd.md) jest Output Style, przy którym Claude zaczyna od konkretu zamiast
ściany tekstu (inspiracja: [i-have-adhd](https://github.com/ayghri/i-have-adhd)). Skopiuj go do `.claude/output-styles/`,
zrestartuj sesję i wybierz w `/config` → *Output style* → *adhd*.

## Historia zmian

Changelog nie jest prowadzony w README - zmiany opisują [commity na `main`](https://github.com/AIBiz-Automatyzacje/claude-code-starter/commits/main).

> Źródła inspiracji: `compound-engineering-plugin` (EveryInc) i `mattpocock/skills`, zaadaptowane i spolszczone pod nasz stack.

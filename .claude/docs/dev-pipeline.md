# Pipeline dev-* — dokumentacja

Data utworzenia: 2026-03-24
Źródło: compound-engineering-plugin (zaadaptowane do stacku React 19 + TypeScript + Supabase + Tailwind v4 + Vite)

---

## Pipeline — przegląd

```
/dev-ideate → /dev-brainstorm → /dev-plan → /dev-docs → /dev-docs-execute ↔ /dev-docs-review → /dev-docs-complete → /dev-compound
                                                                                                                        ↓
                                                       dev-autopilot-wf (orkiestruje execute↔review→complete→compound)
                                                                                                          /dev-compound-refresh
```

Skille dev-* mogą być wywoływane programowo przez inne skille i agenty (bez `disable-model-invocation`).
Każdy skill działa BEZ argumentów (wyciąga kontekst z sesji). Argumenty są opcjonalne.

### Pipeline jako Dynamic Workflows

W tym szablonie część fazy implementacji jest zaimplementowana jako **Dynamic Workflows** —
deterministyczne orkiestratory w JavaScript w `.claude/workflows/*.js` (suffix `-wf`, żeby uniknąć
kolizji nazw ze skillami). Orkiestrator trzyma plan i sterowanie w kodzie, a buildery i reviewerzy
to **leaf-agenci** wołani przez `agentType`. Pliki workflowów:

| Workflow | Plik | Co robi |
|----------|------|---------|
| `dev-autopilot-wf` | `.claude/workflows/dev-autopilot-wf.js` | Autonomiczny pipeline: bootstrap → per faza (execute → review → adversarial verify → fix) → complete → compound. Trzyma `PlanState` w kodzie, resume z `.autopilot-state.json`. |
| `dev-docs-execute-wf` | `.claude/workflows/dev-docs-execute-wf.js` | Wykonanie JEDNEJ fazy: planner czyta Implementation Units z `docs/plans/`, buildery `feature-builder-*` implementują je przez `agentType`, potem walidacja + commit + aktualizacja dokumentacji. |
| `dev-docs-review-wf` | `.claude/workflows/dev-docs-review-wf.js` | Code review jednej fazy: context-packager → 7 reviewerów równolegle (+ E2E) → dedup → adversarial verify każdego P1/P2 → scribe zapisuje raport + bookkeeping checkboxów `Weryfikacja:` → severity gate. |
| `dev-docs-complete-wf` | `.claude/workflows/dev-docs-complete-wf.js` | Archiwizacja ukończonego zadania: `docs/active/<zadanie>` → `docs/completed/`, podsumowanie, aktualizacja dokumentacji projektu. |
| `dev-compound-wf` | `.claude/workflows/dev-compound-wf.js` | Dokumentuje rozwiązane problemy z sesji do `docs/solutions/` (tryb compact) i ocenia rule-worthy do `.claude/rules/learned-patterns.md`. |

Workflowy `*-wf` odpalasz toolem **`Workflow`** (`Workflow({scriptPath: ".claude/workflows/dev-autopilot-wf.js"}, args)`),
standalone (z argumentami, np. `{sciezka, faza}`) albo orkiestrowane przez `dev-autopilot-wf`.
**Git walidujesz w sesji PRZED odpaleniem autopilota** — workflow nie pyta o branch switch.
RESUME po przerwanym runie: `Workflow({scriptPath, resumeFromRunId})` + ZAWSZE przekaż `args` ponownie
(stan wznowienia czyta z `.autopilot-state.json`, checkboxy md to tylko widok dla człowieka).

Skille fazy discovery/planowania (`/dev-ideate`, `/dev-brainstorm`, `/dev-plan`, `/dev-docs`,
`/dev-docs-update`, `/dev-compound-refresh`) pozostają zwykłymi skillami — nie mają wariantu `-wf`.
Skill `/dev-autopilot` (ręczna orkiestracja) zostaje jako legacy/fallback — domyślną ścieżką jest `dev-autopilot-wf`.

---

## Skille — co robi każdy

### Faza discovery

#### `/dev-ideate`
**Cel:** Generowanie pomysłów na ulepszenia projektu.
**Kiedy:** Nie wiesz co budować. Chcesz zobaczyć co można poprawić.
**Jak działa:** 4 agenty skanują projekt z różnych perspektyw (tech debt, UX, performance, product), potem Devil's Advocate filtruje słabe pomysły.
**Output:** `docs/ideation/YYYY-MM-DD-topic-ideation.md`
**Następny krok:** `/dev-brainstorm [wybrany pomysł]`

#### `/dev-brainstorm`
**Cel:** Walidacja i doprecyzowanie pomysłu. Odpowiada na pytanie CO budować.
**Kiedy:** Masz pomysł ale nie masz jasnych wymagań. Chcesz przegadać scope, ryzyka, alternatywy.
**Jak działa:** Interaktywny dialog — jedno pytanie na raz, pressure test, eksploracja podejść.
**Output:** `docs/brainstorms/YYYY-MM-DD-topic-requirements.md` (requirements doc z: Problem, Wymagania R1/R2, Kryteria sukcesu, Granice scope'u)
**Następny krok:** `/dev-plan`

### Faza planowania

#### `/dev-plan`
**Cel:** Planowanie techniczne. Odpowiada na pytanie JAK budować.
**Kiedy:** Masz jasne wymagania (z brainstormu lub własne). Potrzebujesz planu technicznego z konkretnymi plikami, podejściem, testami.
**Jak działa:** Szuka requirements doc w `docs/brainstorms/`, skanuje repo (agenty research), tworzy Implementation Units.
**Output:** `docs/plans/YYYY-MM-DD-NNN-type-name-plan.md` z Implementation Units (Goal, Files, Approach, Test scenarios, Verification)
**Następny krok:** `/dev-docs`

#### `/dev-docs`
**Cel:** Tworzenie struktury zarządzania zadaniami do implementacji.
**Kiedy:** Masz plan (z dev-plan lub z rozmowy w plan mode). Chcesz zacząć implementację.
**Jak działa:** Szuka plan/requirements docs, tworzy branch git, generuje 3 pliki w `docs/active/[nazwa]/`.
**Output:** `docs/active/[nazwa]/` z: plan.md, kontekst.md, zadania.md + branch `feature/[nazwa]`
**Następny krok:** `dev-autopilot-wf docs/active/[nazwa]` (cały pipeline) lub `/dev-docs-execute docs/active/[nazwa]` (faza po fazie)

### Faza implementacji

#### `dev-autopilot-wf docs/active/[nazwa]` (workflow)
**Cel:** Automatyczne wykonanie WSZYSTKICH faz implementacji z review i naprawami.
**Kiedy:** Masz gotową dokumentację w docs/active/ i chcesz uruchomić cały pipeline bez ręcznej interwencji.
**Jak działa:** Dynamic Workflow (`.claude/workflows/dev-autopilot-wf.js`). Czyta plan, buduje `PlanState` i kolejkę faz. Per faza woła pod-workflowy: `dev-docs-execute-wf` → `dev-docs-review-wf` → (przy P1/P2) cykl fix. Po wszystkich fazach: `dev-docs-complete-wf` + `dev-compound-wf`.
**Output:** Zaimplementowany kod + archiwum w docs/completed/ + wpis w docs/solutions/
**Resumability:** `Workflow({scriptPath, resumeFromRunId})` + te same args — stan z `.autopilot-state.json` (źródło prawdy), kontynuuje od ostatniej niekompletnej fazy.
**Stop conditions:** P1 po cyklu fix (limit cykli fix = 1 — drugi cykl naprawiał 0 findingów, a kosztował pełny re-review), błąd buildu/testów, git conflict. Walidację brancha robisz w sesji PRZED odpaleniem.

#### `/dev-docs-execute docs/active/[nazwa]` (workflow: `dev-docs-execute-wf`)
**Cel:** Wykonanie jednej fazy implementacji.
**Kiedy:** Masz gotową dokumentację w docs/active/. Chcesz zaimplementować kolejną fazę.
**Jak działa:** Planner czyta Implementation Units z planu, znajduje następną fazę. Każdy IU jest delegowany do buildera przez `agentType` (`feature-builder-ui` | `feature-builder-data` | `feature-builder-fullstack`) — wartość z pola `Delegate to:` w IU. Strategia: serial (zależne) lub parallel (niezależne). Dla IU dotykających UI/fullstack doklejany jest mandatory kontekst designerski. Po zakończeniu: System-Wide Test Check, aktualizacja checkboxów, incremental commits.
**Output:** Zaimplementowany kod + zaktualizowana dokumentacja + commit(y)
**Następny krok:** `/dev-docs-review docs/active/[nazwa] [numer-fazy]` lub kolejny `/dev-docs-execute`

#### `/dev-docs-review docs/active/[nazwa] [numer-fazy]` (workflow: `dev-docs-review-wf`)
**Cel:** Code review wykonanej fazy.
**Kiedy:** Po `/dev-docs-execute` — chcesz sprawdzić jakość kodu przed kontynuacją.
**Jak działa:** context-packager (mapa zmian raz) → 7 reviewerów równolegle (Security, Performance, Architecture, TypeScript, Spec-compliance, Test-coverage) + osobny agent E2E. Następnie dedup → adversarial verify każdego P1/P2 (sceptycy próbują obalić finding; P1=3 sceptyków, P2=1) → scribe zapisuje raport i robi bookkeeping checkboxów `Weryfikacja:` → severity gate: P1 (blokuje) / P2 (zastrzeżenia) / P3 (OK).
**Weryfikacja E2E:** Agent `feature-tester-e2e` (skill `agent-browser`) — testuje w przeglądarce na dev serverze Vite (localhost:5173), NIE headless symulację. Sprawdza checkboxy `Weryfikacja:` 🌐 z checklisty: interakcje, nawigację klawiaturą, responsywność, visual regression. Jeśli zadanie ma `figma_screens` — robi side-by-side visual comparison z mockupami. Najpierw preflight: czy dev server żyje (`curl localhost:5173`).
**Output:** `docs/active/[nazwa]/review-faza-X.md` + checkboxy do poprawy w zadaniach
**Następny krok:** `/dev-docs-execute` (poprawki) lub kolejna faza

#### `/dev-docs-update docs/active/[nazwa]`
**Cel:** Zapisanie stanu pracy przed resetem kontekstu (kompaktowanie).
**Kiedy:** Sesja się kończy, kontekst się zapełnia, chcesz zabezpieczyć postęp.
**Jak działa:** Commituje WIP, aktualizuje 3 pliki zadania, dokumentuje niedokończoną pracę.
**Output:** Zaktualizowana dokumentacja + WIP commit

### Faza zamknięcia

#### `/dev-docs-complete [nazwa]`
**Cel:** Archiwizacja ukończonego zadania.
**Kiedy:** Wszystkie fazy zrobione, testy przechodzą, feature gotowy.
**Jak działa:** Weryfikuje ukończenie, wyciąga wnioski, przenosi do `docs/completed/`, aktualizuje dokumentację projektu.
**Output:** `docs/completed/[nazwa]/` z podsumowaniem
**Następny krok:** Sugestia `/dev-compound` do udokumentowania rozwiązanych problemów

### Knowledge capture

#### `/dev-compound`
**Cel:** Dokumentowanie rozwiązanego problemu do bazy wiedzy.
**Kiedy:** Po rozwiązaniu problemu — bugfix, workaround, konfiguracja. Chcesz żeby następnym razem ten problem nie zabierał czasu.
**Jak działa:** Bez argumentów = wyciąga kontekst z sesji autonomicznie. Z argumentem = użyj jako opis. Compact mode domyślny, `--full` dla pełnego formatu. Dodatkowo, jeśli problem jest "rule-worthy", dodaje regułę do `.claude/rules/learned-patterns.md` (ładowana automatycznie do każdej sesji).
**Output:** `docs/solutions/[category]/YYYY-MM-DD-title.md` + opcjonalnie reguła w `.claude/rules/learned-patterns.md`
**Kategorie:** build-errors, runtime-errors, supabase-issues, auth-issues, ui-bugs, performance-issues, typescript-errors, deployment-issues, testing-issues

#### `/dev-compound-refresh`
**Cel:** Przegląd aktualności bazy wiedzy.
**Kiedy:** Co kilka tygodni, po dużym refaktorze, po upgrade'ach dependencies.
**Jak działa:** Autonomicznie przegląda WSZYSTKIE docs/solutions/. Dla każdego: Keep (aktualne) / Update (drobne zmiany) / Replace (nowe rozwiązanie) / Archive (problem nie istnieje). Archiwizuje do `docs/solutions/_archived/`. Dodatkowo przegląda `.claude/rules/learned-patterns.md`: usuwa reguły po Archive, aktualizuje po Replace, deduplikuje, pilnuje limitu ~50.
**Output:** Raport z akcjami + zarchiwizowane/zaktualizowane dokumenty + zaktualizowany learned-patterns.md

---

## Agenty — kto co robi

### Research (używane przez `/dev-plan`)
| Agent | Rola |
|-------|------|
| `repo-research-analyst` | Skanuje strukturę repo, konwencje, wzorce |
| `learnings-researcher` | Szuka w `docs/solutions/` powiązanych rozwiązań |
| `best-practices-researcher` | Szuka best practices online (Context7, WebSearch) |
| `framework-docs-researcher` | Szuka dokumentacji framework'ów/bibliotek |

### Review (używane przez `/dev-docs-review` / `dev-docs-review-wf` — 7 reviewerów równolegle + E2E)
| Agent | Rola |
|-------|------|
| `security-sentinel` | Auth, RLS, XSS, Zod validation, API key exposure |
| `performance-oracle` | N+1, bundle size, lazy loading, memoizacja, useEffect cleanup |
| `kieran-typescript-reviewer` | Type safety, brak `any`, modern patterns, naming |
| `architecture-strategist` | SOLID, component boundaries, coupling, circular deps |
| `spec-flow-analyzer` | Zgodność ze spec/planem IU: under-implementation, scope creep, błędna implementacja |
| (default agent) | Test-coverage: happy path, invalid inputs, boundary, brakujące testy |
| `feature-tester-e2e` | E2E w przeglądarce (agent-browser) — checkboxy `Weryfikacja:` 🌐 |

### Workflow (używane przez `/dev-plan`)
| Agent | Rola |
|-------|------|
| `spec-flow-analyzer` | User flow analysis, missing paths, edge cases |
| `code-simplicity-reviewer` | YAGNI, redundancja, uproszczenia (manualny `/dev-docs-review`) |

---

## Struktura katalogów

```
docs/
├── brainstorms/              ← requirements docs z /dev-brainstorm
├── plans/                    ← plany techniczne z /dev-plan
├── ideation/                 ← pomysły z /dev-ideate
└── solutions/                ← rozwiązane problemy z /dev-compound
    ├── build-errors/
    ├── runtime-errors/
    ├── supabase-issues/
    ├── auth-issues/
    ├── ui-bugs/
    ├── performance-issues/
    ├── typescript-errors/
    ├── deployment-issues/
    ├── testing-issues/
    └── _archived/

    active/                   ← aktywne zadania z /dev-docs
    │   └── [nazwa-zadania]/
    │       ├── [nazwa]-plan.md
    │       ├── [nazwa]-kontekst.md
    │       └── [nazwa]-zadania.md
    └── completed/                ← zarchiwizowane z /dev-docs-complete
        └── [nazwa-zadania]/
            ├── [nazwa]-plan.md
            ├── [nazwa]-kontekst.md
            ├── [nazwa]-zadania.md
            └── [nazwa]-podsumowanie.md
```

---

## Typowe scenariusze użycia

### Scenariusz 1: Nowy feature od zera
```
/dev-ideate                          ← "co można poprawić?"
/dev-brainstorm lazy loading         ← doprecyzuj wybrany pomysł
/dev-plan                            ← plan techniczny
/dev-docs                            ← struktura zadań
/dev-docs-execute docs/active/lazy-loading   ← faza 1
/dev-docs-review docs/active/lazy-loading 1  ← review
/dev-docs-execute docs/active/lazy-loading   ← faza 2
/dev-docs-complete lazy-loading      ← archiwizacja
```

### Scenariusz 2: Bugfix z dokumentacją
```
[rozmowa: naprawiasz buga]
/dev-compound                        ← udokumentuj rozwiązanie do docs/solutions/
```

### Scenariusz 3: Szybki feature (bez pełnego pipeline'u)
```
[rozmowa + plan mode]
/dev-docs                            ← od razu do struktury zadań
/dev-docs-execute docs/active/nazwa   ← implementuj
/dev-docs-complete nazwa             ← zamknij
```

### Scenariusz 4: Maintenance bazy wiedzy
```
/dev-compound-refresh                ← przejrzyj wszystkie docs/solutions/
/dev-compound-refresh supabase-issues ← przejrzyj tylko jedną kategorię
```

### Scenariusz 5: Pełny autopilot
```
/dev-brainstorm lazy loading         ← doprecyzuj pomysł
/dev-plan                            ← plan techniczny
/dev-docs                            ← struktura zadań
dev-autopilot-wf docs/active/lazy-loading  ← WSZYSTKO automatycznie (tool Workflow):
                                          execute fazy 1..N
                                          review każdej fazy + adversarial verify
                                          fix jeśli P1/P2 (1 cykl, bez re-review)
                                          complete + compound
```

> Uwaga: środowisko E2E (agent-browser na dedykowanej bazie Supabase e2e) jest opcjonalne i opt-in —
> patrz `.claude/templates/e2e-env/README.md`. Bez `.env.e2e` weryfikacje E2E lądują jako OPERATOR.
> Po każdej zmianie `.claude/workflows/*-wf.js` odpal smoke-test: `.claude/templates/smoke-autopilot/`.

# Claude Code Starter

> Opiniowany starter Claude Code dla product engineering na stacku **React 19 + TypeScript + Supabase + Vite + Tailwind v4**.
> Kompletny katalog `.claude/` (skille, agenci, workflowy, reguły, hooki) + pipeline `dev-*` od pomysłu do wdrożenia — z autonomicznym autopilotem, code review multi-agent i kumulowaniem wiedzy.

**Ostatnia aktualizacja:** 2026-07-06 · **Repo:** `AIBiz-Automatyzacje/claude-code-starter`

---

## Co dostajesz

Sklonuj → skopiuj katalog `.claude/` do swojego projektu → masz gotowy, spójny system pracy z Claude Code:

- **Pipeline `dev-*`** — od ideacji, przez plan, po autonomiczną implementację z review i naprawami (`dev-autopilot-wf`).
- **Skille techniczne** pod stack — React/Tailwind, Supabase, UX/UI, bezpieczeństwo, Sentry — z aktualnymi wzorcami (React 19, Tailwind v4, Zod v4, OWASP 2025).
- **15 wyspecjalizowanych agentów** — buildery warstw, reviewerzy, research.
- **Knowledge compounding** — rozwiązane problemy (`docs/solutions/`), reguły (`learned-patterns.md`) i żywy słownik domenowy (`docs/CONCEPTS.md`).
- **Reguły kodowania** i katalog anty-patternów AI (`.claude/rules/coding-rules.md`).

---

## Changelog

| Data | Zmiana |
|------|--------|
| **2026-07-12** | **Poprawki po multi-agent review (46 findingów, 0 obalonych):** naprawa nazwy skilla Figma (`figma-design-to-code` — zaimportowany lokalnie z pluginu; poprzednia nazwa nie istniała), ujednolicenie ścieżki `docs/brainstorms/` (handoff brainstorm→plan był cicho zerwany), usunięcie skażonego `auto-error-resolver`, **8. reviewer** (`code-simplicity-reviewer`) w review-wf, **targeted verify P1/KOD po fixie** (niezależny weryfikator zamiast czystego self-reportu), warmup degraduje zamiast STOP, retry scribe'a, readerzy `learned-patterns.md` (planner/reviewerzy/buildery), audyt console.log/Sentry w domknięciu fazy, skille `/dev-docs-execute`+`/dev-docs-review` = cienkie wrappery na workflowy, `web-research-specialist` podłączony do brainstorm/ideate. Freshness: **Stripe v22** (wpis 2026-07-06 błędnie utrzymywał v18), Zod v4 w Edge Functions, `getClaims()` preferowane, React Router v8 (`react-router`, bez `-dom`), TS 6.0/7.0, Sentry `defaultIntegrations: false`. Skorygowana semantyka RESUME (świeży run po STOP bramki vs resume po awarii). |
| **2026-07-06** | **Słownik domenowy `docs/CONCEPTS.md`** (writer w `dev-compound`, readerzy w `dev-plan`/`dev-docs`/builderach, utrzymanie w `dev-compound-refresh`). Autopilot woła teraz **scoped `dev-compound-refresh`** po compound. **Audyt skilli technicznych:** `security` → OWASP Top 10:2025 + błąd `user_metadata` (reguła w `coding-rules §9`); `tailwind` → Zod v4 + `useOptimistic` w transition; `supabase` → PKCE `onAuthStateChange` + Stripe v18 + `search_path=''`; `ux-ui` → kontrast/`inert`/`interpolate-size`; `sentry` → source maps + Deno 2.x. |
| 2026-06-21 | Dev Autopilot przeniesiony na **Dynamic Workflow** (`.claude/workflows/*-wf.js`); orkiestrator w JS, buildery/reviewerzy jako leaf-agenci. |
| 2026-06-04 | Wchłonięte koncepty inżynierskie z mattpocock/skills (Tier 2); agenty/skille podciągnięte z compound-engineering. |
| 2026-05-18 | Świadomość Figma/DESIGN.md w pipeline `dev-*` + visual diff w testerze E2E. |
| 2026-05-11 | `sentry-integration` podłączony do builderów data + fullstack. |
| 2026-05-05 | Polish wcielony w `ux-ui-guidelines`; sprzątanie skilli legacy. |

> Źródła inspiracji: `compound-engineering-plugin` (EveryInc) + `mattpocock/skills`, zaadaptowane i spolszczone pod nasz stack. Szczegóły adaptacji: lokalna notatka `ZRODLA-SZABLONU.md` (gitignored).

---

## Pipeline `dev-*` — przegląd

```
/dev-ideate → /dev-brainstorm → /dev-plan → /dev-docs → [ dev-autopilot-wf ] → gotowe
  (pomysły)     (CO budować)     (JAK)      (struktura)   (cały pipeline auto)

dev-autopilot-wf orkiestruje:
  bootstrap → per faza( execute-wf → review-wf + adversarial verify → fix ) → compound-wf → compound-refresh(scoped) → complete-wf
```

Zasady ogólne:
- Skille `dev-*` **działają BEZ argumentów** (wyciągają kontekst z sesji). Argumenty są opcjonalne.
- Skille bez `disable-model-invocation` mogą być wołane programowo przez inne skille i agentów.
- Fazę implementacji domyślnie prowadzi **`dev-autopilot-wf`** (dynamic workflow). Skille `/dev-docs-execute` i `/dev-docs-review` możesz odpalać też ręcznie, faza po fazie.

### Dynamic Workflows (`-wf`)

Część pipeline'u to **deterministyczne orkiestratory w JavaScript** w `.claude/workflows/*.js` (suffix `-wf`, by uniknąć kolizji nazw ze skillami). Orkiestrator trzyma plan i sterowanie w kodzie, a buildery/reviewerzy to **leaf-agenci** wołani przez `agentType`.

| Workflow | Co robi |
|----------|---------|
| `dev-autopilot-wf` | Autonomiczny pipeline: bootstrap (stan z `.autopilot-state.json`) → per faza (execute → review + adversarial verify → fix) → compound → **compound-refresh (scoped)** → complete. |
| `dev-docs-execute-wf` | Wykonanie JEDNEJ fazy: planner czyta Implementation Units z `docs/plans/`, buildery `feature-builder-*` implementują je przez `agentType`, potem walidacja + commit + aktualizacja docs. |
| `dev-docs-review-wf` | Review jednej fazy: context-packager → 8 reviewerów równolegle → dedup → adversarial verify P1/P2 → scribe zapisuje raport + bookkeeping checkboxów `Weryfikacja:` → severity gate. |
| `dev-docs-complete-wf` | Archiwizacja: `docs/active/<zadanie>` → `docs/completed/`, podsumowanie, aktualizacja docs projektu, commit. |
| `dev-compound-wf` | Dokumentuje rozwiązane problemy do `docs/solutions/`, ocenia rule-worthy do `learned-patterns.md`, aktualizuje `docs/CONCEPTS.md`. |

**Jak odpalać:** toolem `Workflow`, np. `Workflow({scriptPath: ".claude/workflows/dev-autopilot-wf.js"}, args)`.
**RESUME po przerwanym runie:** `Workflow({scriptPath, resumeFromRunId})` + **ZAWSZE przekaż `args` ponownie** (te same, np. ścieżkę zadania — `args` NIE przeżywa między wywołaniami). Stan wznowienia czyta z `.autopilot-state.json` (źródło prawdy); checkboxy w `.md` to tylko widok dla człowieka.

---

## Skille — pełna lista

### Pipeline `dev-*`

#### Discovery

**`/dev-ideate`** — generowanie pomysłów na ulepszenia. 4 agenty skanują projekt z różnych perspektyw (tech debt, UX, performance, product), Devil's Advocate filtruje słabe. → `docs/ideation/`

**`/dev-brainstorm`** — walidacja pomysłu (**CO** budować). Interaktywny dialog: jedno pytanie na raz, pressure test, eksploracja podejść. → `docs/brainstorms/*-requirements.md`

#### Planowanie

**`/dev-plan`** — planowanie techniczne (**JAK** budować). Szuka requirements w `docs/brainstorms/`, skanuje repo agentami research, tworzy Implementation Units (Goal, Files, Approach, Test scenarios, Verification). Czyta `docs/CONCEPTS.md` dla terminologii domenowej. → `docs/plans/`

**`/dev-docs`** — struktura zarządzania zadaniem. Tworzy branch `feature/[nazwa]` + 3 pliki w `docs/active/[nazwa]/` (plan, kontekst, zadania). Wciąga kontekst designerski (SPEC.md/DESIGN.md/Figma) do `kontekst.md`. → następnie `dev-autopilot-wf` albo `/dev-docs-execute`.

#### Implementacja

**`dev-autopilot-wf docs/active/[nazwa]`** *(workflow, domyślna ścieżka)* — automatyczne wykonanie WSZYSTKICH faz z review i naprawami. Buduje `PlanState` + kolejkę faz, per faza woła `dev-docs-execute-wf` → `dev-docs-review-wf` → (przy P1/P2) cykl fix. Po fazach: compound → scoped refresh → complete.
- **Resumability:** po **awarii runu** (crash/kill) — `Workflow({scriptPath, resumeFromRunId})` + te same args (cache odtwarza ukończone kroki). Po **STOP bramki** (środowisko E2E, fix FAIL, nierozwiązane P1), gdy coś naprawiłeś — **świeży run bez resume** (stan faz i tak wznowi się z `.autopilot-state.json`; resume zwróciłby porażkę bramki z cache).
- **Stop conditions:** P1 po cyklu fix (limit fix = 1 — drugi cykl naprawiał 0 findingów przy koszcie pełnego re-review; każdy P1/KOD po fixie przechodzi dodatkowo **niezależny targeted verify**), błąd buildu/testów, git conflict.
- **Myk:** walidację brancha robisz **w sesji PRZED** odpaleniem — workflow nie pyta o branch switch.

**`/dev-docs-execute docs/active/[nazwa]`** *(workflow: `dev-docs-execute-wf`)* — wykonanie jednej fazy. Każdy IU delegowany do buildera przez `agentType` (pole `Delegate to:` w IU): `feature-builder-ui` | `feature-builder-data` | `feature-builder-fullstack`. Strategia serial (zależne) / parallel (niezależne). Dla IU dotykających UI doklejany mandatory kontekst designerski. Na końcu: System-Wide Test Check, checkboxy, incremental commits.

**`/dev-docs-review docs/active/[nazwa] [faza]`** *(workflow: `dev-docs-review-wf` — skill jest cienkim wrapperem wołającym workflow)* — code review fazy. context-packager (mapa zmian raz) → **8 reviewerów równolegle** (Security, Performance, Architecture, TypeScript, Spec-compliance, Simplicity/YAGNI, Test-coverage, E2E) → dedup → **adversarial verify** każdego P1/P2 (sceptycy próbują obalić finding; **P1 = 3 sceptyków, P2 = 1**) → scribe zapisuje raport + bookkeeping checkboxów `Weryfikacja:` → severity gate (P1 blokuje / P2 zastrzeżenia / P3 OK).
- **Myk E2E:** `feature-tester-e2e` testuje w **prawdziwej przeglądarce** (agent-browser) na dev serverze Vite (`localhost:5173`), nie w headless symulacji. Preflight: `curl localhost:5173`. Przy `figma_screens` robi side-by-side visual diff z mockupami. Bez `.env.e2e` weryfikacje E2E lądują jako OPERATOR (do ręcznego sprawdzenia).

**`/dev-docs-update docs/active/[nazwa]`** — zapis stanu przed kompaktowaniem kontekstu. Commituje WIP, aktualizuje 3 pliki zadania, dokumentuje niedokończoną pracę.

#### Zamknięcie

**`/dev-docs-complete [nazwa]`** — archiwizacja ukończonego zadania. Weryfikuje ukończenie, wyciąga wnioski, przenosi `docs/active/` → `docs/completed/`, aktualizuje docs projektu. → sugeruje `/dev-compound`.

#### Knowledge capture

**`/dev-compound`** — dokumentowanie rozwiązanego problemu. Bez argumentów = wyciąga kontekst z sesji autonomicznie. Compact mode domyślny, `--full` dla pełnego formatu. Jeśli problem jest rule-worthy → dodaje regułę do `learned-patterns.md`. Jeśli pojawił się termin domenowy → dopisuje hasło do `docs/CONCEPTS.md` (Krok 4.5). → `docs/solutions/[category]/`
- **Kategorie:** build-errors, runtime-errors, supabase-issues, auth-issues, ui-bugs, performance-issues, typescript-errors, deployment-issues, testing-issues.

**`/dev-compound-refresh`** — przegląd aktualności bazy wiedzy. Autonomicznie przegląda `docs/solutions/`: Keep / Update / Replace / Archive. Przegląda `learned-patterns.md` (usuwa po Archive, aktualizuje po Replace, dedup, limit ~50) oraz `docs/CONCEPTS.md` (usuwa martwe hasła, scala duplikaty).
- **Myk:** pełny refresh (bez argumentu) przegląda całą bazę — uruchamiaj okresowo. W autopilocie odpala się **automatycznie, ale scoped** (tylko dotknięta kategoria + CONCEPTS.md, i tylko gdy compound coś zapisał).

### Skille techniczne (guidelines pod stack)

Ładowane on-demand (progressive disclosure: `SKILL.md` + `resources/`). Preładowane do odpowiednich builderów/reviewerów.

| Skill | Zakres |
|-------|--------|
| **`tailwind-react-guidelines`** | React 19 (`use`, Actions, `useActionState`, `useOptimistic`, ref jako prop), TypeScript 5.7+, Tailwind v4 (CSS-first `@theme`), shadcn/ui, React Query, RHF + **Zod v4**, testy (Vitest + RTL + MSW), lazy/Suspense, Sonner. |
| **`supabase-dev-guidelines`** | Auth (OAuth + email, PKCE przez `onAuthStateChange`), PostgreSQL, RLS (`(SELECT auth.uid())`), SECURITY DEFINER (`search_path=''`), Edge Functions (Deno, Stripe v22), Realtime, Supavisor pooling. |
| **`ux-ui-guidelines`** | Design system (OKLCH), dostępność (WCAG 2.2, ARIA, natywny `inert`), responsive (container queries), animacje (Motion, View Transitions, `interpolate-size`), interface polish. |
| **`security`** | Audyt bezpieczeństwa: **OWASP Top 10:2025**, RLS, `app_metadata` vs `user_metadata`, SSRF, CSP dla Vite, `getClaims` + asymetryczne JWT. |
| **`sentry-integration`** | Error tracking + performance dla React + Edge Functions (Deno 2.x): `beforeSend`, source maps (`@sentry/vite-plugin`), release tracking, `await captureError`. |
| **`code-quality`** | Audyt jakości (stack-agnostic): architektura (SOLID, circular deps), performance (Big O, N+1), prostota (YAGNI, LOC), wzorce. |
| **`code-review`** | Code review pod nasz stack — raport z klasyfikacją problemów (krytyczne/poważne/drobne/sugestie). |
| **`bugfix`** | Systematyczna naprawa bugów w działającej aplikacji (Sentry, failujące E2E, zgłoszenia). |

### Skille narzędziowe

| Skill | Do czego |
|-------|----------|
| **`agent-browser`** | Automatyzacja przeglądarki przez CLI (nawigacja, formularze, screenshoty, scraping, testowanie UI) z ref-based selection (`@e1`, `@e2`). Silnik E2E dla `feature-tester-e2e`. |
| **`figma-design-to-code`** | Implementacja designu Figma jako kod (kierunek design→code). Zaimportowany lokalnie z oficjalnego pluginu Figma (v2.2.78) — działa też bez zainstalowanego pluginu. Preładowany do builderów UI/fullstack. |
| **`zroastuj-mnie`** | Bezlitosny wywiad stress-testujący plan/projekt. Research docs przed sesją, wykrywanie sprzeczności, scenariusze. Na końcu sugeruje utrwalenie (m.in. terminu do `docs/CONCEPTS.md`). |
| **`gemini`** | Uruchamia Gemini CLI jako subagenta (analiza kodu, audyt UX/security). Zapisuje feedback do `Zasoby/gemini/`. |
| **`coolify-manager`** | Zarządzanie i troubleshooting deploymentów Coolify (CLI + API): serwery, WordPress, kontenery, SSL, bazy, env, backupy. |
| **`dev-autopilot`** *(legacy)* | Ręczna orkiestracja pipeline'u. **Domyślną ścieżką jest `dev-autopilot-wf`** — ten skill zostaje jako fallback. Uwaga: celowo używa starszego modelu pętli naprawczej (fix → pełny re-review, do `MAX_FIX_CYKLI: 2`), więc jest droższy i zachowuje się inaczej niż workflow (fix ×1 + targeted verify). |

---

## Agenci — pełna lista (15)

### Buildery warstw (wołane przez `dev-docs-execute-wf`)

| Agent | Rola |
|-------|------|
| `feature-builder-ui` | Warstwa UI: komponenty React 19, Tailwind v4, shadcn/ui, formy, dostępność. Czyta kontekst designerski (SPEC/DESIGN/Figma) + `docs/CONCEPTS.md`. |
| `feature-builder-data` | Warstwa danych: zapytania Supabase, RLS, migracje SQL, walidacja Zod, Edge Functions, autoryzacja. |
| `feature-builder-fullstack` | Cross-layer (UI + dane naraz): formularze z auth, full-page z fetchem, CRUD end-to-end. |

### Reviewerzy (wołani przez `dev-docs-review-wf` — 8 równolegle)

| Agent | Rola |
|-------|------|
| `security-sentinel` | Auth, RLS, XSS, walidacja Zod, ekspozycja kluczy API, OWASP. |
| `performance-oracle` | N+1, bundle size, lazy loading, memoizacja, cleanup `useEffect`. |
| `kieran-typescript-reviewer` | Type safety, brak `any`, modern patterns, nazewnictwo. |
| `architecture-strategist` | SOLID, granice komponentów, coupling, circular deps. |
| `spec-flow-analyzer` | Zgodność ze spec/planem IU: under-implementation, scope creep, błędna implementacja, edge case'y. |
| `code-simplicity-reviewer` | YAGNI, zbędna złożoność, martwy kod, uproszczenia bez utraty funkcji. |
| `feature-tester-e2e` | E2E w przeglądarce (agent-browser) — checkboxy `Weryfikacja:` 🌐, visual diff z Figmą. |

> Test-coverage w review-wf pokrywa domyślny agent (happy path, invalid inputs, boundary, brakujące testy).

### Research (wołani przez `dev-plan`, `dev-brainstorm`, `dev-ideate`)

| Agent | Rola |
|-------|------|
| `repo-research-analyst` | Struktura repo, konwencje, wzorce implementacyjne (dev-plan). |
| `learnings-researcher` | Szuka w `docs/solutions/` + `docs/CONCEPTS.md` powiązanych wniosków (dev-plan). |
| `best-practices-researcher` | Best practices online (Context7, WebSearch) (dev-plan). |
| `framework-docs-researcher` | Dokumentacja frameworków/bibliotek, wersje, ograniczenia (dev-plan). |
| `web-research-specialist` | Iteracyjny research w sieci — prior art, wzorce konkurencji (dev-brainstorm, dev-ideate). |

---

## Słownik domenowy — `docs/CONCEPTS.md`

Żywy glosariusz pojęć o znaczeniu **specyficznym dla projektu** (encje, nazwane procesy, statusy/enumy o niestandardowym sensie). Forma: **cienki indeks** — `## Termin` + 1-2 zdania + link do szczegółów w `CLAUDE.md`. Tylko słownik, nie spec.

- **Zasilany** przez `/dev-compound` (Krok 4.5) — automatycznie łapie nowe terminy domenowe.
- **Czytany** przez `dev-plan`, `dev-docs`, buildery i `learnings-researcher` — żeby nie „naprawiać" zachowania wbrew definicjom (klasyczny błąd: „poprawianie" statusu, który celowo działa nietypowo).
- **Utrzymywany** przez `/dev-compound-refresh` (dedup, usuwanie martwych haseł).
- **Seed:** przy pierwszym `/dev-compound` w projekcie z bogatą domeną generuje startowy słownik z `CLAUDE.md` + schematu bazy.

---

## Reguły, hooki, szablony

- **`.claude/rules/coding-rules.md`** — 14 sekcji reguł (rozmiar plików, testowanie, error handling, type safety, bezpieczeństwo, performance, async/race, architektura) + **katalog 10 anty-patternów AI**. Ładowane do każdej sesji.
- **`.claude/rules/learned-patterns.md`** — reguły wyprodukowane przez `/dev-compound` (tworzone per projekt, limit ~50).
- **`.claude/hooks/`** — hooki harnessa (walidacje/automatyzacje przy wywołaniach narzędzi).
- **`.claude/templates/e2e-env/`** — opcjonalne środowisko E2E (agent-browser na dedykowanej bazie Supabase e2e). Opt-in przez `.env.e2e`.
- **`.claude/templates/smoke-autopilot/`** — smoke-test po każdej zmianie `.claude/workflows/*-wf.js`.

---

## Struktura katalogów

```
docs/
├── ideation/                 ← pomysły z /dev-ideate
├── brainstorms/              ← requirements docs z /dev-brainstorm
├── plans/                    ← plany techniczne z /dev-plan
├── CONCEPTS.md               ← słownik domenowy (żywy)
├── solutions/                ← rozwiązane problemy z /dev-compound
│   ├── build-errors/  runtime-errors/  supabase-issues/  auth-issues/
│   ├── ui-bugs/  performance-issues/  typescript-errors/  deployment-issues/
│   ├── testing-issues/
│   └── _archived/
├── active/                   ← aktywne zadania z /dev-docs
│   └── [nazwa]/  { plan.md · kontekst.md · zadania.md }   + branch feature/[nazwa]
└── completed/                ← zarchiwizowane z /dev-docs-complete
    └── [nazwa]/  { plan · kontekst · zadania · podsumowanie }
```

---

## Typowe scenariusze

**1. Pełny autopilot (rekomendowane dla większych zmian)**
```
/dev-brainstorm lazy loading            ← doprecyzuj CO
/dev-plan                               ← plan techniczny (IU)
/dev-docs                               ← struktura zadań + branch
# zwaliduj branch w sesji, potem:
dev-autopilot-wf docs/active/lazy-loading   ← execute→review→fix→compound→refresh→complete
```

**2. Nowy feature krok po kroku (ręczna kontrola)**
```
/dev-ideate  →  /dev-brainstorm  →  /dev-plan  →  /dev-docs
/dev-docs-execute docs/active/nazwa
/dev-docs-review  docs/active/nazwa 1
/dev-docs-execute docs/active/nazwa          ← faza 2 …
/dev-docs-complete nazwa
```

**3. Szybki feature (bez pełnego pipeline'u)**
```
[rozmowa + plan mode]  →  /dev-docs  →  /dev-docs-execute docs/active/nazwa  →  /dev-docs-complete nazwa
```

**4. Bugfix z dokumentacją**
```
/bugfix [opis lub link Sentry]
/dev-compound                           ← udokumentuj rozwiązanie do docs/solutions/
```

**5. Maintenance bazy wiedzy**
```
/dev-compound-refresh                   ← przejrzyj całość
/dev-compound-refresh supabase-issues   ← tylko jedna kategoria
```

---

## Myki i pułapki (najważniejsze)

- **Autopilot: waliduj branch PRZED odpaleniem** — workflow nie pyta o branch switch.
- **RESUME tylko po awarii runu** (zawsze z tymi samymi `args` — nie przeżywają między wywołaniami). Po **STOP bramki** (środowisko E2E, fix FAIL), gdy coś naprawiłeś — **świeży run bez `resumeFromRunId`**: resume zwróciłby porażkę bramki z cache; stan faz i tak wznowi się z `.autopilot-state.json` (źródło prawdy), checkboxy `.md` to tylko widok. Ręczne edycje `.autopilot-state.json` też wymagają świeżego runu.
- **E2E to prawdziwa przeglądarka**, nie symulacja — wymaga żywego dev servera (`localhost:5173`). Bez `.env.e2e` weryfikacje E2E → OPERATOR.
- **Limit cyklu fix = 1** — drugi cykl historycznie naprawiał 0 findingów przy koszcie pełnego re-review. Po fixie każdy P1/KOD przechodzi **niezależny targeted verify** (weryfikator sprawdza kod, nie self-report fixa).
- **`compound-refresh` w autopilocie jest scoped** (tylko dotknięta kategoria + CONCEPTS.md) — pełny refresh całej bazy odpalaj osobno, okresowo.
- **Nie autoryzuj po `user_metadata`** (Supabase) — jest edytowalne przez usera; używaj `app_metadata` lub tabeli ról (reguła w `coding-rules §9`).
- **Po każdej zmianie `.claude/workflows/*-wf.js`** odpal smoke-test z `.claude/templates/smoke-autopilot/`.
- **Skille `dev-*` działają bez argumentów** — argument jest opcjonalnym doprecyzowaniem, nie wymogiem.

[![Akademia Automatyzacji](assets/baner-akademia-automatyzacji.png)](https://akademiaautomatyzacji.com)

> **[Dołącz do Akademii Automatyzacji →](https://akademiaautomatyzacji.com)** - 1200 osób
> uczy się u nas automatyzacji i AI na prawdziwych wdrożeniach, nie na teorii.

# Claude Code Starter

Gotowy system pracy z Claude Code. Kopiujesz jeden folder do swojego projektu i Claude
przestaje pisać kod na ślepo - dostaje skille, agentów i reguły, dzięki którym prowadzi
projekt od pomysłu do działającej aplikacji.

## Do czego to służy

Sami na tym budujemy własne aplikacje w Akademii Automatyzacji. Po skopiowaniu folderu `.claude/` Twój Claude:

- **Pomaga doprecyzować, CO budujesz** - zanim powstanie linijka kodu, przepyta Cię
  o wymagania i rozpisze plan techniczny.
- **Implementuje fazami i sam sprawdza swoją robotę** - każdą fazę przegląda **do 8** niezależnych
  agentów-reviewerów (bezpieczeństwo, wydajność, architektura, testy), a skład dobiera pod domenę
  fazy: projekt bez ani jednego `.ts` nie płaci za reviewera typów. Błędy naprawia.
- **Zapamiętuje wnioski** - rozwiązane problemy trafiają do `docs/solutions/`, więc
  w kolejnych zadaniach nie wpada na te same miny.

Całość jest zestrojona pod stack **React 19 + TypeScript + Supabase + Vite + Tailwind v4**.
Budujesz na czymś innym? Rdzeń systemu (pipeline, review, baza wiedzy) zadziała, tylko
skille techniczne będą do podmiany.

## Jak to działa

Zaczynasz od pomysłu, kończysz na działającej, sprawdzonej aplikacji. Po drodze wygląda to tak:

1. **Opisujesz pomysł** - `/dev-brainstorm` przepytuje Cię pytanie po pytaniu, aż będzie jasne,
   co dokładnie ma powstać. Efekt: dokument wymagań.
2. **Claude rozpisuje plan** - `/dev-plan` skanuje repo i dzieli robotę na fazy z konkretnymi
   krokami. Ty tylko zatwierdzasz.
3. **`/dev-docs` przygotowuje zadanie** - tworzy branch `feature/[nazwa]` i 3 pliki robocze
   (plan, kontekst, lista zadań), z których pipeline będzie korzystał przez całą implementację.
4. **Odpalasz autopilot** - `dev-autopilot-wf` wykonuje fazy jedna po drugiej: implementacja,
   review, naprawa błędów. Wracasz do gotowej zmiany z raportem, co i dlaczego zostało zrobione.

### Klucze do tego rozwiązania

- **Spec-Driven + Test-Driven Development** - najpierw powstaje specyfikacja i plan, dopiero
  potem kod. Każda faza kończy się testami i pełnym pokryciem testowym.
- **Pełna dokumentacja techniczna w dwóch dokumentach** - Dev Plan (plan techniczny
  z `/dev-plan`) i DevDocs (dokumentacja wykonawcza z `/dev-docs`: plan, kontekst, lista
  zadań), aktualizowane na bieżąco w trakcie implementacji.
- **Review robi do 8 niezależnych agentów naraz** (bezpieczeństwo, wydajność, architektura,
  zgodność ze specyfikacją, prostota, testy) - **skład zależy od domeny fazy**, więc reviewer bez
  materiału do pracy się nie odpala. Każde poważne znalezisko przechodzi jeszcze przez
  agenta-sceptyka, który próbuje je obalić. Zostają tylko prawdziwe błędy.
- **Sterowanie trzyma kod, nie model** - kolejność faz, bramki jakości i limity napraw są
  zapisane w deterministycznych workflowach JS. Claude wykonuje zadania, ale nie decyduje,
  czy może pominąć review.
- **Reguły kodowania i katalog anty-patternów AI** (`.claude/rules/`) pilnują jakości
  od pierwszej linijki - m.in. zakaz osłabiania testów i obniżania progów, żeby "przeszło".

### Czego system uczy się w trakcie projektu

- Każdy rozwiązany problem ląduje w `docs/solutions/` - następnym razem Claude sięga
  po gotowe rozwiązanie zamiast kombinować od zera.
- Powtarzalne wnioski zamieniają się w reguły (`learned-patterns.md`), które czytają
  wszyscy agenci w kolejnych zadaniach.
- Pojęcia z Twojej domeny trafiają do słownika `docs/CONCEPTS.md` - dzięki temu Claude
  nie "naprawia" rzeczy, które celowo działają nietypowo.

Im dłużej pracujesz w projekcie, tym mniej błędów Claude powtarza.

## Jak zacząć - 4 kroki

1. Sklonuj repo: `git clone https://github.com/AIBiz-Automatyzacje/claude-code-starter.git`
2. Skopiuj folder `.claude/` do swojego projektu.
3. **Włącz Dynamic Workflows**: wpisz `/config` i ustaw **Dynamic workflows** na `true`. Bez tego
   Claude nie widzi plików z `.claude/workflows/`, więc `dev-autopilot-wf` w ogóle nie da się odpalić -
   a to on prowadzi całą implementację. Objaw: pliki `*-wf.js` leżą w projekcie, ale Claude twierdzi,
   że nie zna workflow o tej nazwie, albo komenda nic nie robi.
4. Odpal Claude Code i wpisz `/dev-brainstorm` - opisz, co chcesz zbudować. Resztą pokieruje pipeline.

Chcesz zrozumieć, jak to działa pod maską? Niżej masz pełną dokumentację: pipeline `dev-*`,
workflowy, wszystkich 15 agentów i pułapki, na które sami wpadliśmy.

## Bonus: Output Style „adhd"

Masz dość gadatliwych odpowiedzi? W [`output-styles/adhd.md`](output-styles/adhd.md) znajdziesz
gotowy Output Style, który sprawia, że Claude zaczyna od konkretu zamiast ściany tekstu.
Napisany według wytycznych Anthropic dla modeli z serii 5 (zero zakazów — opisany cel,
resztę model wyprowadza sam). Inspiracja: skill [i-have-adhd](https://github.com/ayghri/i-have-adhd)
z wiralowego wątku na r/ClaudeAI.

1. Skopiuj `output-styles/adhd.md` do folderu `.claude/output-styles/` w swoim projekcie
   (albo do `~/.claude/output-styles/` globalnie).
2. Zrestartuj sesję Claude Code.
3. Wpisz `/config`, wybierz **Output style → adhd** i zatwierdź enterem.

---

## Co dostajesz

Sklonuj → skopiuj katalog `.claude/` do swojego projektu → masz gotowy, spójny system pracy z Claude Code. A gdy szablon się rozwinie — jedno `/sync-template` zaciąga zmiany z tego repo do projektu (bez ręcznego dyktowania linku):

- **Pipeline `dev-*`** — od ideacji, przez plan, po autonomiczną implementację z review i naprawami (`dev-autopilot-wf`).
- **Skille techniczne** pod stack — React/Tailwind, Supabase, UX/UI, bezpieczeństwo, Sentry — z aktualnymi wzorcami (React 19, Tailwind v4, Zod v4, OWASP 2025).
- **15 wyspecjalizowanych agentów** — buildery warstw, reviewerzy, research.
- **Knowledge compounding** — rozwiązane problemy (`docs/solutions/`), reguły (`learned-patterns.md`) i żywy słownik domenowy (`docs/CONCEPTS.md`).
- **Reguły kodowania** i katalog anty-patternów AI (`.claude/rules/coding-rules.md`).

---

## Pipeline `dev-*` — przegląd

```
/dev-ideate → /dev-brainstorm → /dev-prep → /dev-plan → /dev-docs → [ dev-autopilot-wf ] → gotowe
  (pomysły)     (CO budować)   (CO ma       (JAK)      (struktura)   (cały pipeline auto)
                                dostarczyć
                                człowiek)

dev-autopilot-wf orkiestruje:
  bootstrap → per faza( execute-wf → review-wf + adversarial verify → fix ) → compound-wf → compound-refresh(scoped) → complete-wf
```

Zasady ogólne:
- Skille `dev-*` **działają BEZ argumentów** (wyciągają kontekst z sesji). Argumenty są opcjonalne.
- Skille bez `disable-model-invocation` mogą być wołane programowo przez inne skille i agentów.
- Fazę implementacji domyślnie prowadzi **`dev-autopilot-wf`** (dynamic workflow). Skille `/dev-docs-execute` i `/dev-docs-review` możesz odpalać też ręcznie, faza po fazie.

### Dynamic Workflows (`-wf`)

Część pipeline'u to **deterministyczne orkiestratory w JavaScript** w `.claude/workflows/*.js` (suffix `-wf`, by uniknąć kolizji nazw ze skillami). Orkiestrator trzyma plan i sterowanie w kodzie, a buildery/reviewerzy to **leaf-agenci** wołani przez `agentType`.

> **Wymagane włączenie w Claude Code.** Dynamic Workflows są funkcją samego Claude Code, sterowaną
> przez `/config` → **Dynamic workflows**. Gdy jest ustawione na `false`, Claude nie widzi żadnego
> pliku z `.claude/workflows/` - `dev-autopilot-wf` nie istnieje dla niego, mimo że leży w projekcie.
> Tego nie da się dowieźć w szablonie: to ustawienie Twojego klienta, nie repozytorium (`.claude/settings.json`
> go nie obsługuje). Skopiowanie folderu `.claude/` **nie** włącza tego za Ciebie - sprawdź `/config`
> przed pierwszym uruchomieniem. Skille `dev-*` (`/dev-brainstorm`, `/dev-plan`, `/dev-docs`) działają
> niezależnie od tego przełącznika; blokuje on wyłącznie workflowy `-wf`.

| Workflow | Co robi |
|----------|---------|
| `dev-autopilot-wf` | Autonomiczny pipeline: bootstrap (stan z `.autopilot-state.json`, **walidowany JSON.parse przed odczytem** — uszkodzony plik = powrót do parse md, nie zmyślony stan) → **bramka setupu E2E** (precheck czyta `.env.e2e` ORAZ markery `[E2E]` w planie; zadanie wymaga E2E a środowiska brak = STOP przed fazą 1) → per faza (execute → review + adversarial verify → fix + targeted verify P1) → compound → **compound-refresh (scoped)** → complete → **telemetria** (1 linia JSONL do globalnego `~/.claude/telemetry/autopilot-runs.jsonl`, **także na ścieżkach STOP** — run zatrzymany na bramce też zostawia wpis ze statusem i powodem; dane do strojenia progów: liczniki P1/P2/P3, wynik fixa, **metryki routingu/dedupu/verify per faza**, **rozbicie tokenów na etapy** `execute`/`review`/`fix`, tokeny; metryki utrwalane w stanie, więc ani resume, ani domknięcie zadania w kilku runach ich nie gubi — wpis obejmuje wszystkie fazy zadania, z oznaczeniem `zrodlo: "run" \| "stan"`). Zapis stanu z **odczytem z dysku + retry** (zapis bez dowodu = brak zapisu). Po fixie **guard plików binarnych**: plik źródłowy, który przestał być tekstem, zatrzymuje pipeline STOP-em, zanim zabije kolejne agenty na `Read`. Po review **bramka blokera środowiska**: sygnatura infra-błędu (dev server down, DNS) w findingu **testera E2E**, poparta wpisem FAIL/SKIP w jego przebiegach, = STOP zamiast ciągnięcia kolejnych faz na zepsutym środowisku; STOP zapisuje przy tym metryki i otwarte findingi fazy, więc praca reviewerów nie przepada. Walidacja końcowa ma **completion-gate E2E z planu zadania** (nie z istnienia `.env.e2e`) i **przegląd known-issues.md** (z commitem). |
| `dev-docs-execute-wf` | Wykonanie JEDNEJ fazy: planner czyta Implementation Units z `docs/plans/`, buildery `feature-builder-*` implementują je przez `agentType`, potem walidacja + commit + aktualizacja docs. |
| `dev-docs-review-wf` | Review jednej fazy: context-packager (mapa zmian + **flagi warstw** + **zrzut diffu fazy do pliku**, który reviewerzy czytają jednym `Read` zamiast każdy własnym `git diff`) → **routing domenowy** (rdzeń `security`/`spec-compliance`/`simplicity`/`test-coverage` zawsze; `performance`/`architecture`/`typescript`/`e2e` tylko gdy ich domena jest w fazie obecna; brak flag = pełny skład) → do 8 reviewerów równolegle (**limit 5 P3 na reviewera** + **globalny limit 8 P3 po dedupie z wyborem round-robin po źródle** — żeby ucinanie nie wyciszało systematycznie tych samych reviewerów; P1/P2 bez limitu; tester E2E w trybie `przegladarka` / `bez-przegladarki` / `pominiety` — zależnie od domeny fazy i tego, czy środowisko przeglądarkowe stoi; spec-compliance i test-coverage dostają **blok semantyki jednostek pól** — wykonywalna procedura grep wszystkich użyć + kolejność źródeł prawdy + odczyt realnego wiersza z bazy e2e) → dedup 2-przebiegowy (JS + semantyczny Haiku) → **detekcja blokera środowiska po sygnaturze** (JS, bez LLM — connection refused / DNS, ale **tylko** w findingach testera E2E, **tylko** w trybie `przegladarka` i **tylko** gdy tester ma wpis FAIL albo SKIP w `przebiegi[]`; sama nazwa `getaddrinfo` w opisie defektu kodu blokerem nie jest — regexy pod testem `__tests__/bloker-srodowiska.test.mjs`; orkiestrator robi STOP zamiast ciągnąć fazy na zepsutym środowisku) → adversarial verify P1/P2 (findingi E2E/OPERATOR testera poza verify — dowodem jest przebieg, nie kod) → scribe zapisuje raport + sekcję **`## Przebieg review`** + bookkeeping checkboxów (`[E2E]` odznacza **wyłącznie** z wpisów PASS w `przebiegi[]` testera — brak findingu ≠ PASS) → severity gate. Gdy scribe padnie po udanym zapisie, **wynik jest odzyskiwany z dysku** po sentinelu `## Przebieg review` zamiast powtarzać całe review. |
| `dev-docs-complete-wf` | Dwie fazy: **smoke operatora** (`docs/operator/<data>-<zadanie>-smoke.md` — co sprawdzić ręcznie po zielonym automacie; `[E2E]` nieuruchomione jako czerwona flaga) → archiwizacja: `docs/active/<zadanie>` → `docs/completed/`, podsumowanie, aktualizacja docs projektu, commit (jawnym pathspecem, także wyjścia compound). |
| `dev-compound-wf` | Dokumentuje rozwiązane problemy do `docs/solutions/`, ocenia rule-worthy do `learned-patterns.md`, aktualizuje `docs/CONCEPTS.md` — i **commituje te artefakty** (whitelist ścieżek, bez `git add -A`), żeby nie zostawiać brudnego drzewa blokującego następny run. |
| `freshness-audit-wf` | Cykliczny audyt aktualności skilli technicznych: inwentaryzacja twierdzeń o świecie (wersje, piny, wzorce API) → weryfikacja w **żywych** źródłach (oficjalne docs, changelogi GitHub, npm — przez WebFetch/WebSearch/context7, zakaz pamięci modelu) → adversarial verify P1/P2 → raport do `docs/reviews/freshness-<data>.md`. Niczego nie zmienia w skillach — tylko raportuje. |

**Jak odpalać:** toolem `Workflow`, np. `Workflow({scriptPath: ".claude/workflows/dev-autopilot-wf.js"}, args)`.
**RESUME po przerwanym runie:** `Workflow({scriptPath, resumeFromRunId})` + **ZAWSZE przekaż `args` ponownie** (te same, np. ścieżkę zadania — `args` NIE przeżywa między wywołaniami). Stan wznowienia czyta z `.autopilot-state.json` (źródło prawdy); checkboxy w `.md` to tylko widok dla człowieka.

---

## Skille — pełna lista

### Pipeline `dev-*`

#### Discovery

**`/dev-ideate`** — generowanie pomysłów na ulepszenia. 4 agenty skanują projekt z różnych perspektyw (tech debt, UX, performance, product), Devil's Advocate filtruje słabe. → `docs/ideation/`

**`/dev-brainstorm`** *(opcjonalny — „pusta kartka")* — walidacja pomysłu (**CO** budować). Interaktywny dialog: jedno pytanie na raz, pressure test, eksploracja podejść. → `docs/brainstorms/*-requirements.md`
- **Kiedy:** nowy feature bez wymagań, kilka konkurencyjnych kierunków, niejasno ujęty problem. **Kiedy nie:** wymagania już są (etap w zbiorczym `mvp-requirements.md`, lista poprawek z feedbacku, bug/tech-debt, „zrób jak w X") — wtedy od razu `/dev-plan`, który czyta takie źródła bezpośrednio.
- Nie oferuje skoku do implementacji z pominięciem planu — kod powstaje tylko z Implementation Units.

#### Planowanie

**`/dev-prep`** *(opcjonalny — nowy etap)* — **operator checklist etapu** (**CO CZŁOWIEK MUSI DOSTARCZYĆ**, zanim ruszy implementacja). Czyta etap zbiorczego dokumentu wymagań (`docs/brainstorms/mvp-requirements.md#etap-17`), skanuje repo read-only (route'y, `docs/DESIGN.md`, `SPEC.md`, **nazwy** zmiennych z `.env.example`, wcześniejsze checklisty etapów) i zapisuje **jeden** dokument z czterema sekcjami: decyzje (pytania zamknięte z opcjami, `[blokuje: planowanie]`), konta/konsole/sekrety (🔓 publiczne vs 🔒 sekrety, notatka o kolejności zależnych kroków, „Gdzie to ląduje"), assety i treści (`[~]` = świadomy dług), makiety (nazwa ekranu = klucz, stany, breakpointy, puste `URL Figma:`). Nie planuje — zero IU, zero architektury. → `docs/operator/<slug>-przygotowanie.md`
- **Kiedy:** startujesz etap wymagający kont zewnętrznych, assetów albo makiet i chcesz je zamówić, zanim usiądziesz do planowania. **Kiedy nie:** bugfix, tech-debt, zmiana czysto backendowa — wtedy wprost `/dev-plan`, który utworzy krótką listę sam.
- **Dziedziczy nazewnictwo zastanej serii:** gdy w `docs/operator/` leżą już checklisty etapów (np. `e1-operator-checklist.md`, `e2-operator-checklist.md`), nowy plik dostaje ten sam wzorzec nazwy z identyfikatorem bieżącego etapu — zamiast wstawiać w środek serii obcy `<slug>-przygotowanie.md`. Dwa konkurencyjne wzorce = pytanie do użytkownika, pusty katalog = nazwa domyślna. Cały pipeline odnajduje ten plik po frontmatterze (`origin:`, `feature_slug:`) i po `operator_prep:` w planie, nigdy po nazwie — więc dowolna konwencja działa bez zmian w `/dev-plan` i `/dev-docs`.
- **To ten sam plik, który uzupełnia `/dev-plan`** — nie powstaje drugi dokument przygotowawczy. `/dev-prep` zakłada listę bez numerów faz (jeszcze ich nie ma), `/dev-plan` dopisuje do niej numery blokowanych faz i pozycje wynikłe z IU (3.7 → 5.2b, edycja w miejscu, `[x]` nietknięte). Gdy wszystkie ekrany mają wklejone URL-e Figmy, `/dev-plan` **nie pyta o Figmę** — fetchuje wprost z listy (1.6 krok C).

**`/dev-plan`** — planowanie techniczne (**JAK** budować). Źródłem wymagań jest requirements doc z `docs/brainstorms/`, **sekcja zbiorczego dokumentu** (np. `docs/brainstorms/mvp-requirements.md#etap-17`) albo lista wymagań z requestu. Skanuje repo agentami research, tworzy Implementation Units (Goal, Files, Approach, Test scenarios, Verification) **pogrupowane w numerowane fazy** (`### Faza N — …`, obowiązkowe — autopilot wykonuje plan fazami, `/dev-docs` przenosi je 1:1). Klasyfikację UI/pure-data wyprowadza z plików, bez pytania. Czyta `docs/CONCEPTS.md` dla terminologii domenowej. Dla scenariuszy `[E2E]` stosuje konwencję zarządzanego harnessu: scenariusz opisany w nośnej linii `Test: [E2E] \`<flow>\` — <URL, kroki> → <oczekiwany stan>` (agent-browser wykonuje go z opisu; identyfikator flow w backtickach), seed `e2e/seeds/<flow>-seed.sql` jako deliverable **buildera**. → `docs/plans/`
- **Przygotowanie dla operatora (dokument #1):** sekcja „Wymagania wstępne operatora" w planie + plik `docs/operator/<slug>-przygotowanie.md` — wyłącznie to, czego Claude nie zrobi sam (konsole OAuth, sekrety w `.env`, `.env.e2e` wg `.claude/templates/e2e-env/` gdy plan ma `[E2E]`, assety graficzne, migracje na projekcie głównym, decyzje do podjęcia). Każda pozycja: po co / jak / dowód wykonania + marker blokady z jednej rodziny: `[blokuje: planowanie]` albo `[blokuje: faza N]` (`/dev-prep` pisze pierwszy, `/dev-plan` podmienia go na drugi, gdy zna numer fazy; `/dev-docs` grepuje `^- \[ \].*\[blokuje:` w bramce gotowości i zatrzymuje handoff na pozycjach blokujących planowanie lub fazę 1). Frontmatter `operator_prep:`.

**`/dev-docs`** — **transformacja planu technicznego w zadanie dla autopilota**, bez nowej treści (zero własnych ryzyk/szacunków — to, czego nie ma w planie, nie pojawi się w zadaniu; brak planu → odesłanie do `/dev-plan`). Branch `feature/[nazwa]` (bezpiecznie: istniejący → checkout, brudne drzewo → STOP) + 3 pliki w `docs/active/[nazwa]/`: plan (mapa faz 1:1 z planem), kontekst (pliki, decyzje, wzorce, designerski kontekst SPEC.md/DESIGN.md/Figma), zadania (checkboxy wg kontraktu parserów: impl. / `Test:` / `Weryfikacja:` / `## Operator checklist faza N`, jedna nośna linia `Test: [E2E]` per scenariusz).
- **Handoff = autopilot:** na końcu bramka gotowości (`[E2E]` vs `.env.e2e`, niezaznaczone blokery z `docs/operator/<slug>-przygotowanie.md`, branch) i gotowe wywołanie `Workflow({scriptPath: ".claude/workflows/dev-autopilot-wf.js", args: "docs/active/[nazwa]"})`. Ścieżka ręczna (`/dev-docs-execute` → `/dev-docs-review`) tylko jako alternatywa.

#### Implementacja

**`dev-autopilot-wf docs/active/[nazwa]`** *(workflow, domyślna ścieżka)* — automatyczne wykonanie WSZYSTKICH faz z review i naprawami. Buduje `PlanState` + kolejkę faz, per faza woła `dev-docs-execute-wf` → `dev-docs-review-wf` → (przy P1/P2) cykl fix. Po fazach: compound → scoped refresh → complete.
- **Resumability:** po **awarii runu** (crash/kill) — `Workflow({scriptPath, resumeFromRunId})` + te same args (cache odtwarza ukończone kroki). Po **STOP bramki** (środowisko E2E, fix FAIL, nierozwiązane P1), gdy coś naprawiłeś — **świeży run bez resume** (stan faz i tak wznowi się z `.autopilot-state.json`; resume zwróciłby porażkę bramki z cache).
- **Stop conditions:** P1 po cyklu fix (limit fix = 1 — drugi cykl naprawiał 0 findingów przy koszcie pełnego re-review; każdy P1/KOD po fixie przechodzi dodatkowo **niezależny targeted verify**), błąd buildu/testów, git conflict.
- **Myk:** walidację brancha robisz **w sesji PRZED** odpaleniem — workflow nie pyta o branch switch.

**`/dev-docs-execute docs/active/[nazwa]`** *(workflow: `dev-docs-execute-wf`)* — wykonanie jednej fazy. Każdy IU delegowany do buildera przez `agentType` (pole `Delegate to:` w IU): `feature-builder-ui` | `feature-builder-data` | `feature-builder-fullstack`. Strategia serial (zależne) / parallel (niezależne). Dla IU dotykających UI doklejany mandatory kontekst designerski. Na końcu: System-Wide Test Check, checkboxy, incremental commits.

**`/dev-docs-review docs/active/[nazwa] [faza]`** *(workflow: `dev-docs-review-wf` — skill jest cienkim wrapperem wołającym workflow)* — code review fazy. context-packager (mapa zmian + flagi warstw raz) → **do 8 reviewerów równolegle** (Security, Performance, Architecture, TypeScript, Spec-compliance, Simplicity/YAGNI, Test-coverage, E2E) → dedup → **adversarial verify** każdego P1/P2 (sceptycy próbują obalić finding; **P1 = 3 sceptyków, P2 = 1**) → scribe zapisuje raport + `## Przebieg review` + bookkeeping checkboxów `Weryfikacja:` → severity gate (P1 blokuje / P2 zastrzeżenia / P3 OK).
- **Routing domenowy:** rdzeń (Security, Spec-compliance, Simplicity, Test-coverage) odpala się zawsze; Performance / Architecture / TypeScript / E2E tylko gdy faza tyka ich domeny — np. projekt bez ani jednego `.ts` nie płaci za reviewera typów. Tester przeglądarki odpala się po **policzonej pracy**, nie po warstwie: potrzebuje niezaznaczonego checkboxa `[E2E]` albo makiet `figma_screens` do visual diffu, więc faza UI bez ani jednego scenariusza go nie budzi. Gdy packager nie zwróci flag → pełny skład (fail-open). Pominięcie E2E blokuje odznaczanie browserowych checkboxów `Weryfikacja:` (idą do Operator checklist).
- **Myk E2E:** `feature-tester-e2e` testuje w **prawdziwej przeglądarce** (agent-browser) na dev serverze Vite (`localhost:5173`), nie w headless symulacji. Preflight: `curl localhost:5173`. Zwraca **jawny przebieg per checkbox `[E2E]`** (`przebiegi[]` PASS/FAIL/SKIP z dowodem, oba prefiksy `Test:`/`Weryfikacja:`) i **nie pisze do pliku zadań** — odznacza scribe, wyłącznie z wpisu PASS. Przy `figma_screens` robi side-by-side visual diff z mockupami (manualna akceptacja = finding OPERATOR, nie auto-checkbox). Bez `.env.e2e` weryfikacje E2E lądują jako OPERATOR (do ręcznego sprawdzenia).

**`/dev-docs-update docs/active/[nazwa]`** — zapis stanu przed kompaktowaniem kontekstu. Commituje WIP, aktualizuje 3 pliki zadania, dokumentuje niedokończoną pracę.

#### Zamknięcie

**`/dev-docs-complete [nazwa]`** — archiwizacja ukończonego zadania. Weryfikuje ukończenie, wyciąga wnioski, przenosi `docs/active/` → `docs/completed/`, aktualizuje docs projektu. W trybie ręcznym skill wykonuje procedurę inline w sesji (smoke → archiwizacja); `dev-docs-complete-wf` jest wołany przez autopilot i czyta ten skill jako referencję procedury. → sugeruje `/dev-compound`.
- **Smoke operatora (dokument #2):** przed archiwizacją generuje `docs/operator/<data>-<nazwa>-smoke.md` — listę **wyłącznie tego, czego automat nie sprawdził** (niezaznaczone `## Operator checklist faza N`, scenariusze `[Manual]`, findingi OPERATOR z raportów review, known-issues, P3 widoczne dla użytkownika), z sekcją „0. Przygotowanie" (właściwy projekt Supabase — nie e2e, konto testowe nazwą zmiennej, dev server) i ramką „Jak kontynuować w nowej sesji". Niezaznaczone `[E2E]` trafiają na górę jako `⚠️ E2E nieuruchomione` — nigdy nie są cicho odhaczane. Autopilot loguje ścieżkę i zwraca ją w `smokeOperatora`.

#### Knowledge capture

**`/dev-compound`** — dokumentowanie rozwiązanego problemu. Bez argumentów = wyciąga kontekst z sesji autonomicznie. Compact mode domyślny, `--full` dla pełnego formatu. Jeśli problem jest rule-worthy → dodaje regułę do `learned-patterns.md`. Jeśli pojawił się termin domenowy → dopisuje hasło do `docs/CONCEPTS.md` (Krok 4.5). → `docs/solutions/[category]/`
- **Kategorie:** build-errors, runtime-errors, supabase-issues, auth-issues, ui-bugs, performance-issues, typescript-errors, deployment-issues, testing-issues.

**`/dev-compound-refresh`** — przegląd aktualności bazy wiedzy. Autonomicznie przegląda `docs/solutions/`: Keep / Update / Replace / Archive. Przegląda `learned-patterns.md` (usuwa po Archive, aktualizuje po Replace, dedup, limit ~50) oraz `docs/CONCEPTS.md` (usuwa martwe hasła, scala duplikaty).
- **Myk:** pełny refresh (bez argumentu) przegląda całą bazę — uruchamiaj okresowo. W autopilocie odpala się **automatycznie, ale scoped** (tylko dotknięta kategoria + CONCEPTS.md, i tylko gdy compound coś zapisał).

### Skille techniczne (guidelines pod stack)

Ładowane on-demand (progressive disclosure: `SKILL.md` + `resources/`). Preładowane do **builderów** przez pole `skills:` w ich definicji (`feature-builder-ui`, `-data`, `-fullstack`) oraz do testera `feature-tester-e2e`. Reviewerzy tego pola nie mają — ich wiedza siedzi w prompcie agenta i w blokach doklejanych przez `dev-docs-review-wf`.

| Skill | Zakres |
|-------|--------|
| **`tailwind-react-guidelines`** | React 19 (`use`, Actions, `useActionState`, `useOptimistic`, ref jako prop), TypeScript 5.7+, Tailwind v4 (CSS-first `@theme`), shadcn/ui, React Query, RHF + **Zod v4**, testy (Vitest + RTL + MSW), lazy/Suspense, Sonner. |
| **`supabase-dev-guidelines`** | Auth (OAuth + email, PKCE przez `onAuthStateChange`), PostgreSQL, RLS (`(SELECT auth.uid())`), SECURITY DEFINER (`search_path=''`), Edge Functions (Deno, Stripe v22), Realtime, Supavisor pooling. |
| **`ux-ui-guidelines`** | Design system (OKLCH), dostępność (WCAG 2.2, ARIA, natywny `inert`), responsive (container queries), animacje (Motion, View Transitions, `interpolate-size`), interface polish. |
| **`security`** | Audyt bezpieczeństwa: **OWASP Top 10:2025**, RLS, `app_metadata` vs `user_metadata`, SSRF, CSP dla Vite, `getClaims` + asymetryczne JWT. |
| **`sentry-integration`** | Error tracking + performance dla React + Edge Functions (Deno 2.x): `beforeSend`, source maps (`@sentry/vite-plugin`), release tracking, `await captureError`. |
| **`bugfix`** | Systematyczna naprawa bugów w działającej aplikacji (Sentry, failujące E2E, zgłoszenia). |

### Skille narzędziowe

| Skill | Do czego |
|-------|----------|
| **`code-quality`** *(poza pipeline)* | Audyt jakości (stack-agnostic): architektura (SOLID, circular deps), performance (Big O, N+1), prostota (YAGNI, LOC), wzorce. **Uruchamiasz ręcznie** — żaden agent, workflow ani skill `dev-*` go nie ładuje. |
| **`code-review`** *(poza pipeline)* | Code review pod nasz stack — raport z klasyfikacją problemów (krytyczne/poważne/drobne/sugestie). **Uruchamiasz ręcznie** — review w pipelinie robi `dev-docs-review-wf`, nie ten skill. |
| **`agent-browser`** | Automatyzacja przeglądarki przez CLI (nawigacja, formularze, screenshoty, scraping, testowanie UI) z ref-based selection (`@e1`, `@e2`). Silnik E2E dla `feature-tester-e2e`. |
| **`figma-design-to-code`** | Implementacja designu Figma jako kod (kierunek design→code). Zaimportowany lokalnie z oficjalnego pluginu Figma (v2.2.78) — działa też bez zainstalowanego pluginu. Preładowany do builderów UI/fullstack. |
| **`zroastuj-mnie`** | Bezlitosny wywiad stress-testujący plan/projekt. Research docs przed sesją, wykrywanie sprzeczności, scenariusze. Na końcu sugeruje utrwalenie (m.in. terminu do `docs/CONCEPTS.md`). |
| **`gemini`** | Uruchamia Gemini CLI jako subagenta (analiza kodu, audyt UX/security). Zapisuje feedback do `Zasoby/gemini/`. |
| **`coolify-manager`** | Zarządzanie i troubleshooting deploymentów Coolify (CLI + API): serwery, WordPress, kontenery, SSL, bazy, env, backupy. |
| **`freshness-audit`** *(workflow: `freshness-audit-wf`)* | Cykliczny audyt aktualności skilli technicznych względem **żywej** dokumentacji (oficjalne docs, changelogi GitHub, npm). Weryfikuje wersje/piny/wzorce API z URL-i, nie z pamięci modelu; adversarial verify P1/P2; raport do `docs/reviews/freshness-<data>.md`. Odpalaj okresowo (np. raz w miesiącu). Nic nie zmienia w skillach — tylko raportuje. |
| **`coderabbit-setup`** | Tworzy `.coderabbit.yaml` dopasowany do stacku projektu (detekcja z `package.json` i struktury katalogów: Expo/RN, Next.js, React+Vite, Node, Supabase — bloki można łączyć). Standard między projektami: review po polsku, profil assertive, eslint/actionlint/gitleaks/trufflehog/semgrep/osvScanner, guidelines z `coding-rules.md`. Do `filePatterns` trafiają tylko pliki istniejące w repo; YAML walidowany przed oddaniem. Przypomina o jednorazowej instalacji aplikacji GitHub CodeRabbit na repo. |
| **`sync-template`** | Aktualizuje maszynerię `.claude/` (skille, agenci, reguły, hooki, workflows, templates + `settings.json`) w projekcie docelowym, zaciągając najnowszą wersję z tego repo (`claude-code-starter`, branch `main`). Jedno uruchomienie sprawdza po SHA commita, czy coś się zmieniło, i **automatycznie aplikuje** — szablon zawsze wygrywa, ale nadpisywane/usuwane pliki najpierw trafiają do backupu (`.claude/.backups/`). Pliki lokalne projektu (`settings.local.json`, własne skille) pozostają nietknięte. Argumenty: `--dry-run` (podgląd), `--force` (twardy reset do wersji z szablonu). |

---

## Agenci — pełna lista (16)

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
| `spec-compliance-reviewer` | Zgodność implementacji z zamówieniem — wymagania brakujące, częściowe, błędnie zaimplementowane, scope creep, teksty niezgodne z verbatim. Każdy finding cytuje ID wymagania lub nazwę IU. |
| `code-simplicity-reviewer` | YAGNI, zbędna złożoność, martwy kod, uproszczenia bez utraty funkcji. |
| `feature-tester-e2e` | E2E w przeglądarce (agent-browser) — uruchamia scenariusze checkboxów `[E2E]` (oba prefiksy `Test:`/`Weryfikacja:`), zwraca przebieg PASS/FAIL/SKIP per checkbox z dowodem, visual diff z Figmą. Nie pisze do pliku zadań. |

> Test-coverage w review-wf pokrywa domyślny agent (happy path, invalid inputs, boundary, brakujące testy).

### Research (wołani przez `dev-plan`, `dev-brainstorm`, `dev-ideate`)

| Agent | Rola |
|-------|------|
| `repo-research-analyst` | Struktura repo, konwencje, wzorce implementacyjne (dev-plan). |
| `learnings-researcher` | Szuka w `docs/solutions/` + `docs/CONCEPTS.md` powiązanych wniosków (dev-plan). |
| `best-practices-researcher` | Best practices online (Context7, WebSearch) (dev-plan). |
| `framework-docs-researcher` | Dokumentacja frameworków/bibliotek, wersje, ograniczenia (dev-plan). |
| `web-research-specialist` | Iteracyjny research w sieci — prior art, wzorce konkurencji (dev-brainstorm, dev-ideate). |
| `spec-flow-analyzer` | Analiza specyfikacji **przed** implementacją: kompletność user flow, edge case'y, luki w handoffach (`dev-plan` 1.5). W review fazy już nie występuje — tam pracuje `spec-compliance-reviewer`. |

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
├── brainstorms/              ← requirements docs z /dev-brainstorm (lub zbiorczy, np. mvp-requirements.md)
├── plans/                    ← plany techniczne z /dev-plan (IU w fazach)
├── operator/                 ← dokumenty dla człowieka: <slug>-przygotowanie.md (z /dev-prep, uzupełniany
│                                przez /dev-plan — PRZED implementacją) i <data>-<zadanie>-smoke.md
│                                (z /dev-docs-complete, PO autopilocie)
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

**1. Pełny autopilot (ścieżka domyślna)**
```
/dev-brainstorm lazy loading            ← tylko gdy wymagań jeszcze nie ma („pusta kartka")
/dev-plan                               ← plan techniczny (IU w fazach) + docs/operator/<slug>-przygotowanie.md
# odhacz przygotowanie dla operatora (konsole, sekrety, .env.e2e wg templates/e2e-env gdy plan ma [E2E])
/dev-docs                               ← zadania z planu + branch + bramka gotowości → gotowe wywołanie autopilota
dev-autopilot-wf docs/active/lazy-loading   ← execute→review→fix→compound→refresh→complete
# po runie: docs/operator/<data>-lazy-loading-smoke.md → przejdź ręcznie w przeglądarce → PR
```

**2. Nowy feature krok po kroku (ręczna kontrola)**
```
/dev-ideate  →  (/dev-brainstorm)  →  /dev-plan  →  /dev-docs
/dev-docs-execute docs/active/nazwa
/dev-docs-review  docs/active/nazwa 1
/dev-docs-execute docs/active/nazwa          ← faza 2 …
/dev-docs-complete nazwa                     ← też generuje smoke operatora
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

---

## Changelog

**Ostatnia aktualizacja:** 2026-09-01

| Data | Zmiana |
|------|--------|
| **2026-09-01** | **Fallback wyszukiwania requirements doc** (`dev-plan` 0.2, `dev-prep` 0.1): `docs/brainstorms/` to konwencja szablonu, nie kontrakt — projekt mógł zapisać brainstorm gdzie indziej (np. `docs/dev-brainstorms/`), a pusty glob oznaczał dotąd ciche przejście w planning bootstrap i zgubienie istniejącego brainstormu. Teraz pusty glob → fallback `docs/**/*-requirements.md` + katalogi `*brainstorm*` (z pominięciem `plans/`, `active/`, `completed/`, `solutions/`, `operator/`), trafienie ogłaszane jako nietypowa lokalizacja, a brak trafień = **pytanie do użytkownika** o ścieżkę zamiast milczącego bootstrapu. Błąd wykryty na realnym projekcie z `docs/dev-brainstorms/`; ta sama łata w szablonie mobile (`workspace-template-mobile@6fbd49d`). |
| **2026-08-24** *(popr.)* | **Konsolidacja: jeden dokument przygotowawczy, nie dwa.** Pierwsza wersja `/dev-prep` zapisywała własny `<slug>-przed-planem.md` obok `<slug>-przygotowanie.md` z `/dev-plan` — dwie listy do odhaczania dla tej samej pracy. Teraz **`/dev-prep` tworzy `docs/operator/<slug>-przygotowanie.md`**, a `/dev-plan` go **uzupełnia w miejscu** (`Edit`, nigdy `Write`): dopisuje numery blokowanych faz przy istniejących pozycjach i dokłada te wynikłe z IU; `[x]` wraz z wpisanymi wartościami i datami są nietykalne, sekcje nie są duplikowane, układ zastany w pliku wygrywa z szablonem. Wejście wprost do `/dev-plan` (bugfix) tworzy plik od zera jak dotąd — 5.2b ma teraz dwie ścieżki: uzupełnij albo utwórz. Zostają **dwa** dokumenty operatora zamiast trzech: przygotowanie i smoke. Sam skill przeorientowany na wzorzec z realnego projektu (`Nawykometr`, `docs/operator/e1…e6`): tytuł „Operator checklist (przygotowanie przed implementacją)", sekcja **Decyzje na górze** („zero plików, ale blokują resztę"), legenda **🔓 publiczne / 🔒 sekret** + zamykająca sekcja **„Gdzie to ląduje"**, notatka o **kolejności zależnych kroków** (klucz wymagający fingerprintu z builda), `[~]` = świadomy dług, `*(kod)*` przy pozycjach na granicy „człowiek vs autopilot", dziedziczenie układu sekcji z checklist wcześniejszych etapów i pomijanie pozycji dostarczonych w etapie poprzednim. **Dziedziczenie nazewnictwa serii** (`/dev-prep` 0.3): skill wykrywa wzorzec nazw w `docs/operator/` (≥2 pliki ze wspólnym sufiksem po identyfikatorze etapu, z pominięciem `*-smoke.md`), odtwarza prefiks w konwencji serii, przy jednym pliku przyjmuje jego sufiks, przy dwóch konkurencyjnych wzorcach pyta, przy pustym katalogu bierze domyślny `<slug>-przygotowanie.md`. Żeby to nie rozjechało pipeline'u, wyszukiwanie checklisty poszło z nazwy na **frontmatter**: `dev-plan` 0.2 globuje `docs/operator/*.md` i dopasowuje po `origin:`, 5.2b używa znalezionej ścieżki bez zmiany nazwy, a `operator_prep:` w planie jest jedyną referencją dla `/dev-docs` (bramka gotowości, commit inicjalny, sekcja źródeł). |
| **2026-08-24** | **Nowy skill `/dev-prep` — zamówienie na materiały wejściowe przed planowaniem.** Luka zamknięta: `/dev-plan` pytał o mockupy Figmy dopiero w kroku 1.6, w środku przebiegu, więc o potrzebie makiet dowiadywałeś się w trakcie planowania — a tabela 3.7 miała martwy wiersz „dostęp do Figmy z mockupami" ze źródłem 1.6, czyli pozycję dopisywaną ~300 linii PO tym, jak sprawa została rozstrzygnięta (fetch się udał albo zapadła decyzja „projektujemy z głowy"); dopisanie jej do checklisty przed autopilotem niczego już nie odblokowywało. `/dev-prep` czyta **etap zbiorczego dokumentu wymagań** (`mvp-requirements.md#etap-17` — ta sama konwencja `origin:` z kotwicą sekcji co `dev-plan` 0.2), skanuje repo read-only (route'y → ekran istniejący to zamówienie na *modyfikację*, nie nowy design; `docs/DESIGN.md`; `docs/plans/*-figma/SPEC.md`; **nazwy** zmiennych z `.env.example` — nigdy wartości) i zapisuje `docs/operator/<slug>-przed-planem.md` z czterema listami: **makiety** (nazwa ekranu kebab-case = klucz dopasowania do URL-a Figmy, status nowy/modyfikacja/już-zaprojektowany, stany pusty·ładowanie·błąd, breakpointy, ID wymagań, puste pole `URL Figma:`), konta/klucze/dostępy, assety i treści (kryterium: **czas realizacji po stronie człowieka**), decyzje produktowe jako **pytania zamknięte z opcjami** (`[blokuje planowanie]`). Skill jawnie **nie planuje** (zero IU, architektury, szacunków) i jest opcjonalny — bugfix/tech-debt/backend idą wprost do `/dev-plan`. **Trzy sprzężenia w `dev-plan`:** (1) **0.2** — glob `docs/operator/*-przed-planem.md` po `origin:`, przejęcie `feature_slug:` (jeden slug na cały pipeline: plan, `-figma/`, `-przygotowanie.md`), pytanie o nieodhaczone `[blokuje planowanie]`; (2) **1.6 krok C** — dokument wskoczył jako pozycja 2 kolejności sprawdzeń (za istniejącym SPEC, przed linkami w źródle) z czterema rozstrzygnięciami po stanie pól `URL Figma:`: wszystkie wypełnione → **fetch bez pytania** z listą `{name, url}` z dokumentu, część → wybór (fetchuj gotowe / podaj brakujące / przerwij), zero → projektujemy z głowy albo stop, sekcja pusta/`dotyka_ui: false` → `figma_spec: null`; (3) **3.7** — pozycje `[x]` z sekcji 2–3 **nie są powtarzane** (operator nie robi tego samego dwa razy), nieodhaczone przepisywane z dołożeniem numeru blokowanego IU/fazy, martwy wiersz Figmy usunięty z tabeli. Brak dokumentu `/dev-prep` = pełna kompatybilność wstecz: `dev-plan` idzie starą ścieżką i pyta o Figmę interaktywnie — skill nigdy nie jest wymogiem. README: trzeci dokument operatora w drzewie `docs/` i w opisie pipeline'u. |
| **2026-08-23** | **Port audytu pipeline'u z szablonu mobile (commit `c57847d`): audyt `dev-brainstorm` / `dev-plan` / `dev-docs` + dokumenty dla operatora + domknięcie toru `[E2E]`.** `dev-docs` przepisany na **czystą transformację planu** (koniec z dublowaniem analizy/ryzyk/szacunków z `dev-plan`; brak planu → odesłanie do `/dev-plan`), jawny **kontrakt formatu** czytany przez parsery (checkboxy w kolumnie 0, impl. / `Test:` / `Weryfikacja:` / `## Operator checklist faza N`, **jedna nośna linia per scenariusz** `Test: [E2E] \`<flow>\`[ (seed: e2e/seeds/<x>-seed.sql)] — <scenariusz> → <stan>` z kebab-case identyfikatorem flow w backtickach), bezpieczny branch (istniejący → checkout, brudne drzewo → STOP ze stash per ścieżka), **handoff na autopilot** z bramką gotowości (`[E2E]` vs `.env.e2e`, blokery operatora, git) zamiast sugestii ręcznego `/dev-docs-execute`. `dev-plan`: **fazy obowiązkowe** (`### Faza N — …`, numeracja od 1 — `/dev-docs` przenosi 1:1), **zbiorczy dokument wymagań / lista z requestu jako pełnoprawne źródło**, klasyfikacja UI/pure-data bez pytania, nowa sekcja **„Wymagania wstępne operatora"** + `docs/operator/<slug>-przygotowanie.md` (frontmatter `operator_prep:`). `dev-brainstorm`: sekcja „Kiedy używać" (opcjonalny, tylko „pusta kartka"), usunięte „Przejdź bezpośrednio do pracy" (omijało plan, IU, `[E2E]` i stan). `dev-docs-complete-wf`: nowa faza **smoke operatora** (`docs/operator/<data>-<zadanie>-smoke.md` z Operator checklist, `[Manual]`, findingów OPERATOR, known-issues; `[E2E]` nieuruchomione jako ⚠️), `smokeOperatora`/`smokeStatus`/`archiwizacjaStatus` w wyniku autopilota; complete commituje jawnym pathspecem także wyjścia compound. **Domknięcie toru `[E2E]` end-to-end** (P1 z audytu mobile: scribe traktował brak findingu jako PASS — tester zabity przez watchdoga = fałszywa zieleń): tester E2E zwraca **jawny przebieg per checkbox** (`przebiegi[]` PASS/FAIL/SKIP z dowodem) — scribe odznacza `[E2E]` **wyłącznie** z wpisu PASS, retry testera po null/pustym wyniku + twardy STOP (`e2eTesterFail`) zamiast cichej degradacji do OPERATOR, findingi E2E/OPERATOR testera poza adversarial verify (dowodem jest przebieg, nie kod) i poza limitem P3, właściciel odznaczania `Test: [E2E]` = scribe/fix (execute nie rusza), kopie w Operator checklist z `[E2E]`→`[Manual]`, completion-gate rozdziela `e2eFail` (przebiegło i padło, suffix `(FAIL: …)`) od `e2eNieuruchomione` i **cofa fazy z otwartymi `[E2E]` do `review=pending`** (`e2eFazy`) zamiast pętli identycznych STOP-ów, jeden grep `[E2E]` we wszystkich bramkach (oba prefiksy, bez kopii `Operator:`), db-sync dobiera seedy ze wszystkich linii `[E2E]` i checkboxów `Stwórz/Modyfikuj (e2e seed)`, pola E2E w `skrotPrzebiegu`/telemetrii. Agent **`feature-tester-e2e` przepisany na kontrakt** — zintegrowany z trzema trybami z 2026-07-30 (`przegladarka`/`bez-przegladarki`/`pominiety` zostają; kontrakt `przebiegi[]` obowiązuje w każdym trybie): oba prefiksy, scenariusz wiążący z treści linii `[E2E]`, runner `e2e/<etap>-run-all.sh` uruchamiany RAZ z wynikiem per scenariusz, brak seeda = P2 typ E2E dla fixa (tester go nie pisze), nie modyfikuje pliku zadań, visual-diff jako finding OPERATOR. Web-adaptacje portu: brak plików flow (agent-browser gra scenariusz z opisu w linii — kluczem dopasowania przebieg↔checkbox jest backtick-identyfikator flow z nośnej linii, fallback po znormalizowanej treści), dev server Vite z harnessu `.env.e2e` zamiast dev-clienta z prebuildu. Spójność: fixture `smoke-autopilot` (`### IU-1`, `Test: [Unit]`, `## Operator checklist faza 1` + asercje smoke'u w README), README `e2e-env` (runner wskazywany jedną linią `Weryfikacja: [E2E]`). |
| **2026-08-18** | **Port 8 ulepszeń architektury z szablonu mobile (commity 899dd2c..a67df8c, wyprowadzone z runów feedback-marcin-poprawki i e3-core-loop).** **Integralność stanu:** `zapiszStan` czyta plik z dysku po zapisie i waliduje `JSON.parse` (+1 retry na modelu głównym) — niezaescapowany cudzysłów w opisie findingu potrafił uszkodzić `.autopilot-state.json`, a to plik, z którego pipeline odtwarza stan po awarii; bootstrap waliduje plik przed odczytem i przy uszkodzeniu wraca do parse md zamiast „odczytywać" (= zmyślać) stan faz. **Telemetria także na STOP:** run zatrzymany na bramce zostawiał ZERO telemetrii (w mobile: ~10 h, 136 agentów, 5 STOP-ów, ani jednej linii) — teraz każdy STOP przechodzi przez `stopRun()` z wpisem status+powód, w try/catch (529 przy zapisie nie może zabić komunikatu bramki), a linia JSONL jest walidowana i usuwana gdy wadliwa. **Bramka setupu E2E:** opt-in czyta DWA sygnały — `.env.e2e` (czy środowisko jest) i markery `[E2E]` w planie (czy jest wymagane); zadanie z `[E2E]` bez środowiska = STOP przed fazą 1 zamiast cichej degradacji do OPERATOR wykrywanej dopiero na completion-gate (w mobile kosztowało to 3 fazy i ~20 h); completion-gate w walidacji końcowej też czyta PLAN, nie repo. **Bloker środowiska po sygnaturze:** review-wf rozpoznaje w JS (bez LLM) infra-błędy w findingach E2E (`ERR_CONNECTION_REFUSED`/`ECONNREFUSED` = dev server down; `ERR_NAME_NOT_RESOLVED`/`ENOTFOUND` = zły URL / spauzowany projekt Supabase) i autopilot STOP-uje od razu zamiast ciągnąć kolejne fazy na zepsutym środowisku; tester E2E ma nakaz cytowania DOSŁOWNYCH komunikatów błędów (parafraza nie uruchomi detekcji); regexy pokryte testem 12 przypadków. **Globalny limit P3 (8 po dedupie) z round-robinem po źródle:** per-reviewerowy limit 5 nie ogranicza agregatu (8×5), a proste `slice` ucinałoby po kolejności reviewerów — systematycznie wyciszając simplicity/test-coverage/e2e w każdej fazie; odrzucone P3 jawnie w logu i metryce `p3Odrzucone`. **Blok semantyki jednostek pól** dla spec-compliance i test-coverage: wykonywalna procedura (grep WSZYSTKICH użyć pola, kolejność źródeł prawdy: migracja SQL → spec/IU → requirements, odczyt realnego wiersza z bazy e2e) — w mobile pole `price_pln` czytane w 3 miejscach jako kwota od gracza zamiast całości dało 8× zawyżenie przy ZIELONYCH testach, bo fixture powielał to samo błędne założenie. **Przegląd known-issues.md w walidacji końcowej** (z commitem — brudne drzewo blokuje bootstrap następnego runu): wpisy domknięte późniejszymi fazami przenoszone do sekcji „Zamknięte" zamiast strasznić operatora nieaktualnym obrazem. **Konwencje bezpieczeństwa seedów** (templates/e2e-env): seedy WYŁĄCZNIE przez `psql` (`supabase db query -f` wysyła plik jako jedno prepared statement — 42601), pozytywna identyfikacja bazy tabelą-markerem przed każdym destrukcyjnym seedem (guard „konto istnieje" zawodzi dokładnie wtedy, gdy konto o tym mailu jest na dev/prod), re-seed per scenariusz egzekwowany runnerem, nie zdaniem w README. NIE portowane (czysto mobilne): świeżość binarki dev-clienta, bramka natywnych zależności, canary Maestro, pary `EXPO_PUBLIC_*`. |
| **2026-07-30** | **Dwie luki z audytu runu `rownolegle-joby` (4 fazy, 1,8 M tokenów).** **Baza wiedzy jest commitowana przez tego, kto ją zapisuje:** `dev-compound-wf` zapisywał solution, `learned-patterns.md` i `CONCEPTS.md`, a NIKT tego nie commitował — dwa runy z rzędu zostawiły te pliki w drzewie, co blokowało bramkę bootstrapu następnego runu (STOP „niezacommitowane zmiany"), czyli compound sabotował kolejne uruchomienie pipeline'u. Teraz commituje compound (krok 7, whitelist ścieżek, zakaz `git add -A`), commituje `compound-refresh` (edytuje istniejące dokumenty, więc ma ten sam obowiązek), a `dev-docs-complete-wf` sprawdza `git status` i dociąga to, co zostało — trzy warstwy, bo compound bywa też odpalany standalone. **Tester E2E ma trzy tryby zamiast włącz/wyłącz:** orkiestrator zna status środowiska (`e2eAktywne`), ale nie przekazywał go do review-wf, więc routing przywoływał testera na podstawie samego diffu — w audytowanym runie poszedł w przeglądarkę bez środowiska i skończyło się na 1 passed / 1 failed / 3 skipped. Teraz `srodowiskoE2E` idzie w argumentach, a tester dostaje tryb `przegladarka` / `bez-przegladarki` (tylko HTTP i CLI, scenariusze browserowe → Operator checklist) / `pominiety`; `undefined` (ręczne `/dev-docs-review`) = fail-open bez zmian. Ostrzeżenie dla scribe'a przeniesione z „tester nie odpalił" na **„tester nie miał przeglądarki"** — w trybie ograniczonym tester jest na liście aktywnych, więc stary warunek przepuściłby odznaczanie niepotwierdzonych checkboxów. `e2eTryb` trafia do `## Przebieg review` i telemetrii (poza `required` w schemacie stanu — starsze `.autopilot-state.json` go nie mają). **README: wymóg włączenia Dynamic Workflows** — zgłoszenie od osoby instalującej szablon: przy `/config` → Dynamic workflows = `false` Claude nie widzi żadnego pliku z `.claude/workflows/`, więc `dev-autopilot-wf` „nie istnieje" mimo poprawnej instalacji. Teraz to osobny krok w „Jak zacząć" + ostrzeżenie z objawem w sekcji Dynamic Workflows. |
| **2026-07-27** | **Sześć poprawek z audytu pierwszego runu na routingu v2 (`team-os-onboarding-instalatory`, 3 fazy, 4 uruchomienia, 6 h 45 min).** **Odzyskiwanie scribe'a:** scribe potrafi paść PO udanym zapisie, przy zwracaniu wyniku — w audytowanym runie raport (363 linie) i bookkeeping leżały już na dysku, a pipeline i tak zażądał powtórki całego review (~150–250 k tokenów). Teraz przed ogłoszeniem porażki inspektor na Haiku sprawdza sentinel `## Przebieg review` (scribe wkleja go na samym końcu, więc jego obecność = zapis domknięty) i wynik jest odzyskiwany z dysku. **Guard plików binarnych:** fix wpisał do pliku źródłowego surowe bajty sterujące, plik przestał być tekstem i każdy kolejny agent rozłączał się na jego `Read` — 6 prób, run martwy po 2 h 47 min. Agent fixa raportuje teraz `plikiBinarne[]` (`git diff --numstat` = `-`, z whitelistą legalnych binariów), a orkiestrator robi STOP **przed** bramką walidacji, bo uszkodzony plik jest przyczyną, a failujący typecheck tylko objawem. **Limit P3:** telemetria 5 zadań dała P1=2, P2=29, **P3=179** przy tym, że P3 nigdy nie wchodzi do pętli naprawczej — twardy limit 5 P3 na reviewera + wymóg konkretnej akcji naprawczej (P1/P2 bez limitu). **Atrybucja tokenów per etap:** `execute`/`review`/`fix` osobno w raporcie i telemetrii, z `null` (nie `0`) dla etapu nieobecnego w runie — bez tego wiadomo tylko, że faza kosztowała 250 k, nie na co. **Diff jako artefakt:** packager zrzuca diff fazy przekierowaniem powłoki do pliku poza repo, reviewerzy czytają go jednym `Read` zamiast 6–8× własny `git diff`; przez schemat idą wyłącznie metadane (treść przez output agenta kosztowałaby dokładnie tyle, ile oszczędzamy), z limitem 300 KB, znacznikiem ucięcia i fail-open. **Dedup JS — świadomie NIE zmieniony:** przebieg JS nie skleja nic (zmierzone 49→49, 44→44, 24→24), ale wzmocnienie klucza po lokalizacji dało na 75 realnych findingach 5 sklejeń i każde błędne (pod jednym `plik:linia` siedzą dwa różne defekty); wariant z bramką podobieństwa działał, lecz kalibrował progi na jednym polskojęzycznym korpusie przy zysku jednej pary — odrzucone jako zła wymiana wobec ryzyka cichej utraty findingu, z dowodem zapisanym w komentarzu. **Telemetria opisuje całe zadanie, nie tylko ostatni run:** `kolejka` filtruje fazy po `pending`, więc faza domknięta we wcześniejszym runie nigdy nie dostawała wiersza — w audytowanym zadaniu z telemetrii zniknęła faza 1, mimo że jej metryki leżały w stanie. Wpis JSONL scala teraz raporty runu z `fazy[].metryki` ze stanu (`zrodlo: "run" \| "stan"`, `null` tam, gdzie stan nie zna wartości, nowe pole `fazyZadania`). **Routing — `performance` wymaga pliku kodu:** faza czysto dokumentacyjna (5 plików `.md`, 0 kodu) dostawała od packagera `dane=true` i budziła `performance-oracle` nad markdownem; warunek to teraz `(dane && plikiKodu > 0) \|\| plikiKodu >= 5`. |
| **2026-07-26** | **Wnioski z audytu runu produkcyjnego (`team-os-hub-api`, 4 fazy).** **Routing reviewerów v2 — domenowy zamiast ilościowego:** stary próg „≤2 pliki" nie odpalił ani razu (realne fazy: 6–15 plików), a regexy po ścieżce (`src/hooks|lib`) nie trafiały w projekty bez `src/`. Teraz `context-packager` zwraca **flagi warstw** (`ui`/`dane`/`typowanie`/`nowyModul`) + liczbę browserowych checkboxów, a reviewer odpala się, gdy jego domena jest w fazie obecna; rdzeń (security/spec/simplicity/test) zawsze, brak flag = pełny skład (fail-open). Nowość: **E2E też jest warunkowy** — z drugą furtką na checkboxy `Weryfikacja:` i twardym zakazem odznaczania ich, gdy tester nie odpalił. **Obserwowalność:** raport review kończy się sekcją **`## Przebieg review`** (aktywni/pominięci reviewerzy z powodem, `znalezione → dedup JS → dedup semantyczny`, `verify: weryfikowane/obalone/bez głosów`) — liczby liczy orkiestrator, scribe je tylko wkleja. **Telemetria:** metryki routingu/dedupu/verify per faza trafiają do wpisu JSONL i są **utrwalane w `.autopilot-state.json`** (`fazy[].metryki`, przepisywane 1:1 przez bootstrap), więc resume ich nie gubi. **Severity dyscyplina:** skrypty migracyjne/ETL/seedy omijające warstwę API to granica zaufania — nowa sekcja w `security-sentinel`, blok w promptach reviewerów i sceptyków oraz reguła w `coding-rules §9`; „jednorazowy/throwaway" **nie** obniża severity (w audytowanym runie ta klasa błędu — spoofing tożsamości przy migracji z publicznie eksponowanej bazy — wylądowała jako dwa P3). |
| **2026-07-21** | **Nowy skill `/coderabbit-setup`** — generuje `.coderabbit.yaml` dopasowany do stacku projektu (Expo/RN, Next.js, React+Vite, Node, Supabase), żeby CodeRabbit robił automatyczny AI code review każdego PR-a przed merge. Część wspólna (język polski, profil assertive, tools, knowledge_base z `coding-rules.md`) w `templates/coderabbit-base.yaml`, bloki per stack w `reference/stack-blocks.md`; skill wykrywa stack z `package.json`/struktury katalogów, wpisuje do `code_guidelines.filePatterns` tylko istniejące pliki i waliduje YAML przed zapisem. |
| **2026-07-14** | **Nowy skill `/sync-template`** — aktualizacja maszynerii `.claude/` w projekcie docelowym prosto z tego repo (`claude-code-starter`). Sprawdza po SHA commita, czy szablon się zmienił, i automatycznie aplikuje (szablon wygrywa; backup nadpisywanych/usuwanych plików do `.claude/.backups/`; `settings.local.json` i własne skille projektu nietknięte; usuwanie wycofanych plików sterowane manifestem `.claude/.template-manifest`). Bundlowany skrypt bash zgodny z bash 3.2 (macOS), tryby `--dry-run`/`--force`. Rozwiązuje potrzebę ręcznego dyktowania linku i proszenia o aktualizację po wrzuceniu szablonu do nowego projektu. |
| **2026-07-12** | **Poprawki po multi-agent review (46 findingów, 0 obalonych):** naprawa nazwy skilla Figma (`figma-design-to-code` — zaimportowany lokalnie z pluginu; poprzednia nazwa nie istniała), ujednolicenie ścieżki `docs/brainstorms/` (handoff brainstorm→plan był cicho zerwany), usunięcie skażonego `auto-error-resolver`, **8. reviewer** (`code-simplicity-reviewer`) w review-wf, **targeted verify P1/KOD po fixie** (niezależny weryfikator zamiast czystego self-reportu), warmup degraduje zamiast STOP, retry scribe'a, readerzy `learned-patterns.md` (planner/reviewerzy/buildery), audyt console.log/Sentry w domknięciu fazy, skille `/dev-docs-execute`+`/dev-docs-review` = cienkie wrappery na workflowy, `web-research-specialist` podłączony do brainstorm/ideate. Freshness: **Stripe v22** (wpis 2026-07-06 błędnie utrzymywał v18), Zod v4 w Edge Functions, `getClaims()` preferowane, React Router v8 (`react-router`, bez `-dom`), TS 6.0/7.0, Sentry `defaultIntegrations: false`. Skorygowana semantyka RESUME (świeży run po STOP bramki vs resume po awarii). **Nowe mechanizmy:** routing reviewerów wg mapy zmian + dedup semantyczny (Haiku) w review-wf, `/freshness-audit` (cykliczny audyt skilli w żywych źródłach), telemetria runów autopilota (`~/.claude/telemetry/autopilot-runs.jsonl`), pola `paths` w skillach guideline, sync `agent-browser` z upstream 0.31.1. |
| **2026-07-06** | **Słownik domenowy `docs/CONCEPTS.md`** (writer w `dev-compound`, readerzy w `dev-plan`/`dev-docs`/builderach, utrzymanie w `dev-compound-refresh`). Autopilot woła teraz **scoped `dev-compound-refresh`** po compound. **Audyt skilli technicznych:** `security` → OWASP Top 10:2025 + błąd `user_metadata` (reguła w `coding-rules §9`); `tailwind` → Zod v4 + `useOptimistic` w transition; `supabase` → PKCE `onAuthStateChange` + Stripe v18 + `search_path=''`; `ux-ui` → kontrast/`inert`/`interpolate-size`; `sentry` → source maps + Deno 2.x. |
| 2026-06-21 | Dev Autopilot przeniesiony na **Dynamic Workflow** (`.claude/workflows/*-wf.js`); orkiestrator w JS, buildery/reviewerzy jako leaf-agenci. |
| 2026-06-04 | Wchłonięte koncepty inżynierskie z mattpocock/skills (Tier 2); agenty/skille podciągnięte z compound-engineering. |
| 2026-05-18 | Świadomość Figma/DESIGN.md w pipeline `dev-*` + visual diff w testerze E2E. |
| 2026-05-11 | `sentry-integration` podłączony do builderów data + fullstack. |
| 2026-05-05 | Polish wcielony w `ux-ui-guidelines`; sprzątanie skilli legacy. |

> Źródła inspiracji: `compound-engineering-plugin` (EveryInc) + `mattpocock/skills`, zaadaptowane i spolszczone pod nasz stack. Szczegóły adaptacji: lokalna notatka `ZRODLA-SZABLONU.md` (gitignored).

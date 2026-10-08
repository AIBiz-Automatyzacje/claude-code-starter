# PROMPT-AUDIT-2 — ponowny audyt maszynerii szablonu po serii P0–P15

**Data:** 2026-10-08 (P16). **Status:** poprawki naniesione w `4eadafc` na gałęzi `popr/P16-zamkniecie` (6 wysokiej, 17 średniej pewności);
diff: `dane/pa2-proponowany.diff` (22 pliki, 41 hunków, liczony od `18ab718`). **Poprzedni audyt:** `PROMPT-AUDIT.md` (2026-09-24, PA-01…PA-44).
**Metoda:** przewodnik `claude-api` → `shared/prompt-audit.md` (Step 0–7) i `shared/model-migration.md` → Migrating to Claude Opus 5.5,
Migrating to Claude Haiku 5.5. **Narzędzia:** `skrypty/pa_inwentarz.py <repo> pa2-` (sygnały, ten sam zestaw co w pierwszym audycie),
`skrypty/pa2_status.py` (stan PA-01…PA-44 i 62 hunków), `skrypty/pa2_komendy.py` (komendy skryptów w promptach), `skrypty/pa2_kontrola.py`
(kontrola w obie strony). Czytanie: sesja główna — dodane od bazy audytu treści promptów sześciu workflowów i trafienia sygnałów;
niezależny subagent (Opus) — 24 pliki agentów i 14 skilli w całości, reszta po trafieniach. Każde ustalenie subagenta sprawdzone w repo.

## 0. Założenia (Step 0, te same co w PROMPT-AUDIT §0 poza punktem 2)

1. **Zakres** jak w pierwszym audycie: skille z referencjami, pliki agentów, stringi promptów workflowów, `coding-rules.md` (tylko raport),
   komunikaty hooków do modelu, `templates/`. Skille z koszyka usuniętych już nie istnieją (P1).
2. **Model docelowy:** Opus 5.5 dla wszystkich ról bez `model: haiku`; **Haiku 5.5** dla klas `klasa-mechaniczny*` — alias `haiku` trafia
   od R-P14 na `claude-haiku-5-5` (transkrypty R-P14 i R-P15; pierwszy audyt zakładał Haiku 4.5).
3. **Stałe ograniczenia** bez zmian: tryb rozkazujący zostaje (atakujemy nacisk, fałszywe fakty, archeologię, sprzeczności); liczba poleceń
   nie jest dźwignią; zdanie z udokumentowaną awarią i powodem zostaje.

## 1. Wniosek

1. **Pozycje pierwszego audytu są zamknięte.** PA-01…PA-44: zamknięte albo świadomie zostawione (PA-26 częściowo przez P12, PA-32 zniknęło
   z P14, PA-34 i PA-43 — decyzja „zostaje”, PA-42 — konto). 62 hunki: stara treść zniknęła we wszystkich (`dane/pa2-status.txt`).
   Sygnały grepem: 576 → 331 (wersaliki 204 → 95, historia/incydenty 33 → 23; `dane/pa2-sygnaly.txt` vs `pa2baza-sygnaly.txt`).
2. **Nowe ustalenia to głównie rozjazdy między plikami po przepisaniu ról w P10–P15 (Grupa 2), nie nacisk.** Reviewerzy spec i test szukali
   pól planu po angielskich nazwach, których szablon planu od P13 nie ma; `learnings-researcher` i `dev-compound-refresh` szukały w solutions pól
   `module`/`problem_type`, których nikt nie zapisuje (od P10 solution ma pola wiedzy); reviewer jakości zgłaszałby komponent bez jawnego typu
   zwracanego, który reguły kodu od P12 każą zostawić wywnioskowany; hook wysyłał do Sentry każde `console.*` wbrew skillowi Sentry.
3. **Workflowy są czyste poza archeologią.** Dodane od bazy treści sześciu workflowów nie mają wzorców (pa_dodane w każdej paczce = 0);
   zostały dwa akapity „POWOD (run …, data)” w autopilocie, przeoczone przez pierwszy audyt, i wstęp etapu compound w `dev-pr-wf`.
   Komendy skryptów w promptach: 52 wywołania, 0 martwych podkomend i flag (`dane/pa2-komendy.txt`, odbiór na 3 podłożonych błędach).

## 2. Liczby per grupa

| grupa przewodnika | wysoka | średnia | niska |
|---|---|---|---|
| 1a nacisk | 0 | 3 (PA2-15, PA2-17, PA2-20) | 4 |
| 1d skamieliny, archeologia | 0 | 4 (PA2-16, PA2-18, PA2-21, PA2-22) | 4 |
| 1e kierunek frontendu (wyjątek Opus 5.5) | 0 | 1 (PA2-23) | 1 |
| 2 fakty nieaktualne, sprzeczności | 6 (PA2-01…06) | 8 (PA2-07…10, PA2-12…14, PA2-19) | 9 |
| 4 konfiguracja | 0 | 1 (PA2-11) | 1 (flaga efortu haiku) |
| **razem** | **6** | **17** | **19** |

## 3. Ustalenia — pewność wysoka

**PA2-01 — reviewer jakości przeczy regułom kodu**
- Lokalizacja: `.claude/agents/architecture-strategist.md:26`, `:32`.
- Cytat: „asercję `!`, eksportowaną funkcję bez jawnego typu zwracanego,”; „`UPPER_SNAKE_CASE`, plik poza kebab-case.”
- Wzorzec: 2 — pliki instrukcji sprzeczne w tym samym punkcie.
- Dlaczego: `coding-rules.md` (Type safety) — komponent React i hook zwracający wynik hooka biblioteki mają typ wywnioskowany; (Nazewnictwo) —
  kebab-case „chyba że framework wymusza inną konwencję”. Reguła nowsza (`17da963`) niż plik roli (`bf7eec0`).
- Akcja: rewrite — wyjątki z reguł w obu poleceniach.

**PA2-02 — nazwy pól planu, których plan nie ma**
- Lokalizacja: `.claude/agents/spec-compliance-reviewer.md:16`; `.claude/agents/test-coverage-reviewer.md:12`, `:26`; `.claude/workflows/dev-docs-review-wf.js:407`.
- Cytat: „pola `Files:`, `Test scenarios:`, `Patterns to follow:`”; „sekcję planu technicznego z `Test scenarios:`”; „(Files:, Test scenarios:, Patterns to follow:)”
- Wzorzec: 2 — volatile specifics.
- Dlaczego: kontrakt planu (`skills/dev-plan/references/szablon-planu.md:36,42,43`, parser `scripts/plan/`) — `**Pliki:**`, `**Scenariusze testowe:**`,
  `**Wzorce do naśladowania:**`, `**Teksty (verbatim):**`.
- Akcja: rewrite na nazwy z kontraktu.

**PA2-03 — learnings-researcher szuka pól, których nikt nie zapisuje**
- Lokalizacja: `.claude/agents/learnings-researcher.md:33`, `:80-82`, `:93-96`, `:104`, `:126-136`, `:145-159`, `:175`, `:179-188`, `:209-210`, `:250`.
- Cytat: „Grep: pattern="problem_type:.*(architecture_pattern|design_pattern|tooling_decision)"”; „Dwa tory `problem_type`”
- Wzorzec: 2 — volatile specifics i sprzeczność z `dev-compound`.
- Dlaczego: jedyny zapisujący (`skills/dev-compound/SKILL.md`, Krok 4) pisze pola title, date, category, severity, tags, status, klasa, regula, paths,
  waga, szczebel, zrodlo, ucieczki (walidator `scripts/wiedza/walidacja.mjs`); `module`, `problem_type`, `component`, `symptoms`, `root_cause` nie
  występują w żadnym producencie; `tags` to lista blokowa, więc `tags:.*(x)` nie trafia. Agent wołany przez `/dev-plan` przy każdym planie Standardowym.
- Akcja: rewrite — wzorce Grep, pola, kryteria trafności i format wyjścia na pola wiedzy; kategorie z `dev-compound`.

**PA2-04 — dev-compound-refresh: stary schemat i tryb, którego nie ma**
- Lokalizacja: `.claude/skills/dev-compound-refresh/SKILL.md:90`, `:123`, `:146`, `:368`.
- Cytat: „szukaj w polach `module`, `component` lub `tags`”; „frontmatter YAML (title, category, date, module, component, tags)”; „ponownie uruchomić skill interaktywnie”
- Wzorzec: 2 — sprzeczność w pliku (`:298` mówi o polach wiedzy) i z `dev-compound`; martwe odwołanie (tabela trybów nie ma interaktywnego, `:25` „Nigdy nie czekaj na input”).
- Dlaczego: dokument zastępczy wg `:146` nie przejdzie `wiedza.mjs sprawdz`. `:298` nowszy (`ea209a3`) niż `:146` (import `c3c9d49`).
- Akcja: rewrite.

**PA2-05 — hook error-handling przeczy skillowi Sentry**
- Lokalizacja: `.claude/hooks/error-handling-reminder.sh:81` (stderr przy exit 2).
- Cytat: „→ Użyj Sentry.captureException() / Sentry.captureMessage() zamiast console.*”
- Wzorzec: 2 — sprzeczność hook ↔ skill.
- Dlaczego: `skills/sentry-integration/SKILL.md` zasada 1 (`8d175d6`): nieoczekiwany błąd przez `logger.error` / `captureError`, oczekiwana odmowa
  `logger.info` bez zdarzenia. Hook (`a3d9649`) działa w projektach bez ESLint z szablonu.
- Akcja: rewrite.

**PA2-06 — coderabbit-setup: reguła, której nie ma**
- Lokalizacja: `.claude/skills/coderabbit-setup/SKILL.md:104`.
- Cytat: „Próg w instrukcji to 360/60 (reguła 300/50 + 20%)”
- Wzorzec: 2 — volatile specifics. `coding-rules.md` i `eslint.config.szablon.ts` mają 360/60; reguły 300/50 nie ma od P12.
- Akcja: rewrite.

## 4. Ustalenia — pewność średnia

**PA2-07 — workflow review każe zgłaszać każdą regułę, pliki ról — tylko swoją oś**
- Lokalizacja: `.claude/workflows/dev-docs-review-wf.js:406`, `:408`; pliki reviewerów (`.claude/agents/correctness-reviewer.md:31` i pięć pozostałych: „Pomijaj … mają je inne osie”).
- Cytat: „Naruszenie ktorejkolwiek reguly z sekcji "Reguly projektu" dossier zglos jako finding.”
- Wzorzec: 2 — sprzeczność agent ↔ workflow; workflow (`29ded79`) starszy niż pliki ról (P11).
- Akcja: rewrite — „…reguły, która dotyczy Twojej osi…”. Zmiana kontraktu w `__tests__/wycinek-wiedzy.test.mjs:56`.

**PA2-08 — `docs/design.md` zamiast `docs/DESIGN.md`**
- Lokalizacja: `.claude/agents/spec-compliance-reviewer.md:21`.
- Cytat: „z formą zwracania się z `docs/design.md`”
- Wzorzec: 2 — volatile specifics; cały szablon używa `docs/DESIGN.md`, na systemie plików z rozróżnianiem wielkości liter warunek nie zachodzi.
- Akcja: rewrite z odsyłaczem do istniejących ekranów, gdy DESIGN.md formy nie ma.

**PA2-09 — „Tryb pipeline”, którego nikt nie wywołuje**
- Lokalizacja: `.claude/skills/dev-plan/SKILL.md:21`, `.claude/skills/dev-prep/SKILL.md:265`.
- Cytat: „**Tryb pipeline** (wywołanie z workflowu albo z `disable-model-invocation`)”
- Wzorzec: 2 / 1d — żaden workflow nie woła dev-plan ani dev-prep, żaden z nich nie ma `disable-model-invocation`; import `c3c9d49`.
- Akcja: remove.

**PA2-10 — dev-plan: nieaktualne twierdzenie o Explore**
- Lokalizacja: `.claude/skills/dev-plan/SKILL.md:99`.
- Cytat: „(`Explore` nie ma narzędzi sieciowych, a definicja w prompcie gubi `model:` i `tools:` z frontmattera)”
- Wzorzec: 2 — twierdzenie o API bez daty; w bieżącym harnessie Explore ma narzędzia sieciowe. Powód nakazu (definicja doklejona gubi frontmatter) zostaje.
- Akcja: rewrite.

**PA2-11 — dev-prep woła repo-research-analyst bez `Scope:`**
- Lokalizacja: `.claude/skills/dev-prep/SKILL.md:124`.
- Cytat: „deleguj przez Agent tool, `subagent_type: "repo-research-analyst"`, zamiast czytać plik po pliku.”
- Wzorzec: 4 — jak PA-21 (poprawione w dev-plan, nie tu); bez `Scope:` agent przechodzi też issues i szablony.
- Akcja: rewrite z `Scope: technology, architecture`.

**PA2-12 — `--full` w świeżej sesji, a tryb Full czyta rozmowę**
- Lokalizacja: `.claude/skills/dev-compound/SKILL.md:234`.
- Cytat: „uruchom /dev-compound --full w świeżej sesji.”
- Wzorzec: 2 — sprzeczność w pliku (tryb Full: „Wyciąga historię rozmowy”).
- Akcja: rewrite — „w tej samej sesji”.

**PA2-13 — (w PA2-04)** `dev-compound-refresh:368` — martwy tryb interaktywny; hunk w tym samym pliku.

**PA2-14 — hook stop-build przeczy Type safety**
- Lokalizacja: `.claude/hooks/stop-build-check-enhanced.sh:69`.
- Cytat: „(typuj poprawnie, nie używaj any/as)”
- Wzorzec: 2 — `coding-rules.md` dopuszcza `as const` i zawężanie DOM; „zero `as`” model czyta dosłownie (`coderabbit-setup:106-108`).
- Akcja: rewrite.

**PA2-15 — coderabbit-setup: wersaliki**
- Lokalizacja: `.claude/skills/coderabbit-setup/SKILL.md:29`, `:35`, `:66-67`, `:82-83`.
- Cytat: „KROK OBOWIĄZKOWY,”; „ZAWSZE wypisz wszystkie 4 punkty poniżej”
- Wzorzec: 1a. Akcja: rewrite — powód zamiast wersalików.

**PA2-16 — dev-pr: archeologia w skillu i w prompcie compoundu**
- Lokalizacja: `.claude/skills/dev-pr/SKILL.md:9-12`, `.claude/workflows/dev-pr-wf.js:748-750`.
- Cytat: „Ten skill domyka odcinek, którego w pipelinie nie było.”; „To jest etap, ktorego w szablonie brakowalo najbardziej:”
- Wzorzec: 2 history narratives / 1d migration-relative. Akcja: rewrite na cel w czasie teraźniejszym.

**PA2-17 — auth-security-patterns: nacisk i cecha modelu**
- Lokalizacja: `.claude/skills/security/resources/auth-security-patterns.md:60-61`.
- Cytat: „notorycznie popełniany przez agentów AI.”
- Wzorzec: 1a (KRYTYCZNE, NIGDY, twierdzenie o skłonnościach modelu). Reguła zostaje (keep-list 5). Akcja: rewrite nagłówka.

**PA2-18 — auth-security-patterns: „AKTUALNY WZORZEC (2026)”**
- Lokalizacja: `.claude/skills/security/resources/auth-security-patterns.md:117-124`.
- Cytat: „AKTUALNY WZORZEC (2026).”; „sam robi to, co wczesniej pisalismy recznie”
- Wzorzec: 1d / 2 — treść zależna od czasu i względna wobec poprzedniej wersji. Akcja: rewrite.

**PA2-19 — framework-docs-researcher: Server Components w stacku SPA**
- Lokalizacja: `.claude/agents/framework-docs-researcher.md:28`.
- Cytat: „React 19 (Server Components, use hook, Actions)”
- Wzorzec: 2 — stack to Vite SPA (`tailwind-react-guidelines`, `supabase-dev-guidelines`). Akcja: rewrite.

**PA2-20 — researcherzy: MANDATORY i powtórzenie**
- Lokalizacja: `.claude/agents/framework-docs-researcher.md:68`, `:94`; `.claude/agents/best-practices-researcher.md:57`.
- Cytat: „**MANDATORY: Deprecation/Sunset Check**”; „**ALWAYS check for API deprecation first**”
- Wzorzec: 1a + 1c (powtórzenie jako wzmocnienie). Akcja: rewrite z powodem, remove powtórzenia.

**PA2-21 — autopilot: archeologia walidacji stanu**
- Lokalizacja: `.claude/workflows/dev-autopilot-wf.js:463`.
- Cytat: „POWOD tej walidacji (run feedback-marcin-poprawki, mobile, 2026-08-06)”
- Wzorzec: 2 history narratives — nazwa runu i data nic nie mówią agentowi; mechanizm awarii zostaje. Pierwszy audyt przeoczył (`06fdc62`). Akcja: rewrite.

**PA2-22 — autopilot: archeologia guardu binarnego**
- Lokalizacja: `.claude/workflows/dev-autopilot-wf.js:675-678`.
- Cytat: „POWOD (run team-os-onboarding-instalatory, 2026-07-26): fix zapisal do scripts/inbox/invite.mjs regex”
- Wzorzec: jw. (`8c97962`). Akcja: rewrite — mechanizm bez nazwy runu, pliku i liczby prób.

**PA2-23 — lista stylów do unikania bez domyślnych stylów Opus 5.5**
- Lokalizacja: `.claude/agents/feature-builder-ui.md:22`, `feature-builder-ui-figma.md:22`, `feature-builder-fullstack.md:30`, `feature-builder-fullstack-figma.md:30`.
- Cytat: „Unikasz przy tym stylów, do których wraca projekt bez kierunku: gradientu fiolet–niebieski na tle i w tekście nagłówka,”
- Wzorzec: 1e — wyjątek dla frontendu na Opus 5.5: lista nazwanych stylów działa, ale ma nazywać domyślne style modelu docelowego (kremowe tło,
  kursywa w słowach-akcentach nagłówka, numerowane etykiety „01/02/03”, etykiety monospace, przyciski-pigułki); lista z P12 (PA-44) nazywa style
  starszych modeli. Akcja: add — lista rozszerzona, nic nie usunięte; warianty `-figma` z identyczną treścią (test `klasy-rol.test.mjs`).

## 5. Pewność niska (flagi, bez zmian w diffie)

- Bloki `<examples>` w treści sześciu agentów researchu (routing w złym miejscu; reszta PA-02); `framework-docs-researcher:116` „Remember: You are the bridge…”.
- `learnings-researcher` „Agenci-researcherzy bywają pewni siebie i błędni” — cecha modelu jako powód flagowania konfliktu; `docs/solutions/patterns/critical-patterns.md` bez producenta.
- `repo-research-analyst:85` `tailwind.config.ts` jako sygnał Tailwind (v4 go nie ma); `best-practices-researcher:107-114` sekcja issues GitHuba.
- `dev-plan:177` „`supabase db push` migracji i seedów” (seedy idą przez psql); `szablon-planu.md:184` przykładowe IU UI+seed delegowane do fullstack.
- `dev-compound:375-468` `<preconditions>`, „Filozofia”, `<auto_invoke>` — idiomy; `dev-compound-refresh:204` przykład z Ruby.
- `zroastuj-mnie:18-24` bez `docs/decisions/` wśród źródeł decyzji (add); `dev-brainstorm:108` „URUCHOM”; `agent-browser/SKILL.md:48,269` „(WAŻNE)”.
- `security-sentinel:17` „co najmniej pięć konkretnych wejść” — kwota (1f), świadomie z P11; ciągi „Wypisz każdy…” w plikach reviewerów — przepisane w P11 z powodami.
- Wersje przypięte bez daty: `edge-functions-sentry.md:505`, `supabase edge-functions.md:223,281` (Stripe `2026-07-29.dahlia`).
- Workflowy: `dev-autopilot-wf.js:1003-1004` „fix naprawia teraz P1 i P2” (migracja starego stanu — kontekst danych, zostaje);
  `dev-docs-execute-wf.js:272` „plan starszy niz delegacja”; wersaliki z powodem obok („WAZNE: to JEDYNY przebieg fix…”, „zabija CIEBIE”) —
  ocena pierwszego audytu bez zmian; `whenToUse` `dev-pr-wf` bez etapu `claude-md`.
- `error-handling-reminder.sh:132` „Zapytaj użytkownika…” — hook Stop sesji głównej, użytkownik jest; zostaje.
- **Flaga konfiguracji (Grupa 4):** klasy haiku nie mają jawnego efortu; na Haiku 5.5 to efort domyślny `medium` (na 4.5 efortu nie było).
  Koszt ról haiku ~1% runu, prompty krótkie — bez zmiany; telemetria pokazuje `haiku-5-5/medium` (R-P15). Do odczytu w karcie (`KARTA-ODCZYTU.md` §2).
- `coding-rules.md` (tylko raport): PA-26 (a)–(c) rozwiązane w P12; zostaje `:69` (weryfikacja przed „gotowe”, PA-29 — decyzja panelu).

## 6. Porównanie z PROMPT-AUDIT.md

| | PROMPT-AUDIT (09-24) | PROMPT-AUDIT-2 (10-08) |
|---|---|---|
| model haiku | Haiku 4.5 | Haiku 5.5 |
| trafienia sygnałów w zakresie | 576 | 331 |
| ustalenia wysokiej / średniej | 8 / 13 w diffie (+ 8 flag średnich) | 6 / 17 |
| dominująca grupa | 1a nacisk, 1d frazy migracyjne (prompty review/fix/execute, pliki reviewerów) | 2 rozjazdy między plikami po przepisaniu ról |
| workflowy | frazy migracyjne w promptach review/fix/execute | czyste poza 3 akapitami archeologii |
| hunki | 62 (naniesione w P1–P15) | 41 (naniesione w `4eadafc`) |

## 7. Kontrola w obie strony

`skrypty/pa2_kontrola.py` → `dane/pa2-kontrola.txt`: (1) raport → źródła: każdy cytat z pola „Cytat:” istnieje w pliku z „Lokalizacja:” na
`18ab718` (stan audytowany); (2) raport → diff: każdy plik ustalenia wysokiej i średniej ma hunk w `dane/pa2-proponowany.diff`;
(3) diff → raport: każdy plik diffu należy do co najmniej jednego ustalenia; (4) liczby: 6 + 17 ustaleń, 22 pliki, 41 hunków.

# Etap 2 — rozstrzygnięcie: research zewnętrzny (5 kierunków) i mapowanie na nasz pipeline

**Data:** 2026-09-20. **Rozstrzyga:** sesja główna (Fable 5.1) na wynikach 7 agentów Opus, run `wf_f3c27f89-972` (10 min, 880k tokenów subagentów, 124 wywołania narzędzi).
**Źródła:** `dane/workflow-D-etap2-wyniki.json` (pełne), czytelnie per agent `dane/etap2-research/*.txt`. Skrypt: `skrypty/workflow-D-etap2-research.js`,
odtworzenie z journala: `skrypty/journal_do_json.py`. Wejściem były wyłącznie ustalenia z ETAP1 i ETAP1B (agenci nie czytali surowych danych).

**Zasada czytania:** każde ustalenie niżej ma URL i datę w plikach `dane/etap2-research/`. Daty „brak daty" oznaczają stronę docs bez daty publikacji (dostęp 2026-09-20).
Kierunek 1b (plugin eval) jest zweryfikowany lokalnie z `claude plugin eval --help` na Claude Code 2.1.278, nie z publicznych docs — nie ma czego cytować poza tym.

## 0. Sześć ustaleń przekrojowych (to zmienia projekt „po")

1. **„Reguły bez mechanicznego wejścia nie działają" ma teraz liczbę.** Benchmark IFScale (2025-07, 20 modeli): przy 10 instrukcjach przestrzeganie 98–100%,
   przy 150 instrukcjach 84–99%, przy 500 — ok. 68% u najlepszych; dominujący błąd to **ciche pominięcie całej instrukcji**, nie jej zniekształcenie.
   To wyjaśnia 45 z 68 ucieczek z etapu 1 (reguła była, właściciel był, przeszło). CodeRabbit, który łapie po nas 195 realnych defektów, **nie jest czystym LLM**:
   odpala 50+ deterministycznych linterów w sandboksie i wkłada wyniki do recenzji. My tę pracę zlecamy agentowi Opus za 400–900k tokenów.
2. **„Review nie zbiega" to udokumentowana własność LLM-jako-sędziego, ale lek zależy od kierunku powtarzania.** Intra-rater reliability tego samego modelu
   na tym samym prompcie: Krippendorff α 0,33–0,79 przy progu 0,8 (2025-10). Powtórka **sekwencyjna** szkodzi: F1 0,376 → 0,303, na 1 nowy prawdziwy defekt
   4–5 fałszywych (2026-03). Powtórka **równoległa** (n próbek tej samej osi + agregator) pomaga: recall +119% przy n=10, plateau ok. n=10 (SWR-Bench 2025-09);
   Cursor Bugbot: 8 równoległych przejść z losowaną kolejnością linii + głosowanie + walidator, resolution rate 52% → 70%. **Nasze 12–18 nowych findingów
   w powtórce fazy to przypadek sekwencyjny** — potwierdza decyzję „powtórka po STOP-ie E2E = sam tester" i zakazuje pętli „review aż zbiegnie".
3. **Nasi sceptycy działają na ćwierć możliwości i wiadomo dlaczego.** Obalają 12–19%. Refute-or-Promote (2026-04): sceptyk z **kontekstem asymetrycznym**
   (sam claim, bez uzasadnienia autora) zabija 63% kandydatów w etapie A i 79–83% łącznie; Adversarial Review (2026-08): **wymuszone etykiety sporu**
   AGREE / DISAGREE_EVIDENCE / DISAGREE_CONCERN dają F1 0,533 vs 0,457 bez struktury. Oba źródła: o zaufaniu decyduje test/PoC, nie konsensus modeli.
   Koszt zmiany: prompt sceptyka, zero nowych agentów.
4. **Dźwignia kontekstu startowego (30–40%) jest potwierdzona w docs tylko w połowie.** `omitClaudeMd: true` (v2.1.271+) wyłącza „user, project, and local
   CLAUDE.md files" — potwierdzone. Docs **milczą**: (a) czy wyłącza też `.claude/rules/*.md` i rozwinięte `@import` (a tam siedzi połowa z 33k),
   (b) czy reguły z `paths:` w ogóle ładują się w subagentach z Agent tool / `agent()` w Workflow, (c) czy `omitClaudeMd` działa dla agentów z Workflow tool.
   Mini-run z HANDOFF 6a pkt 9 **przestaje być opcją, staje się warunkiem wejścia do etapu 4** — bez niego panel projektuje na założeniu.
5. **Testy niefalsyfikowalne mają trzy warstwy mechaniczne, żadna nie jest samym Strykerem.** (1) `@vitest/eslint-plugin`: expect-expect, valid-expect,
   no-conditional-expect, prefer-called-with — milisekundy, łapie asercję pustą i atrapę bez argumentów; (2) `vitest --typecheck` +
   `expectTypeOf<z.infer<typeof Schema>>().toEqualTypeOf<Kontrakt>()` — jedyne znalezione narzędzie trafiające wprost w „schemat luźniejszy od kontraktu";
   (3) StrykerJS diff-scoped. **Uwaga:** StrykerJS **nie ma** opcji `--since` (jest tylko w Stryker.NET; blogi 2026 kłamią) — zakresy liczymy sami z `git diff`
   i podajemy przez `--mutate "plik:od-do"`. Google robi mutację produkcyjnie tylko na zmienionym kodzie (2021). MutGen (2026-04): 100% coverage przy 4%
   mutation score; sprzężenie zwrotne z mutacji do modelu piszącego testy podnosi wynik 53% → 89,5% — **wynik Strykera idzie do buildera, nie do reviewera**.
   Mutation score **nie** jako cel liczbowy (ISSTA 2026: poza regresją nie mierzy wykrywalności; agent zacznie pisać testy pod metrykę).
6. **Dwie reguły w coding-rules.md są sprzeczne z oficjalnymi docs i jedna z nich wyprodukowała regresję, którą potem łapaliśmy agentem.** §13 „useEffect
   z async = ZAWSZE AbortController": react.dev odradza fetch w efekcie i gasi wyścig flagą `ignore` w cleanupie — a dołożony `AbortSignal.any` był jedną
   z 3 regresji złapanych przez kontrolę diffu fixa (ETAP1 §2). §9 zaleca `app_metadata` na rolę: przewodnik RBAC Supabase prowadzi do tabeli ról + Custom
   Access Token Auth Hook i o `app_metadata` nie wspomina (zakaz `user_metadata` się broni). Do tego §3 vs §11 (sprzeczność) i katalog „10 anty-patternów AI
   z procentami 80–90%" bez żadnego źródła.

## 1. Tabela kierunków

| kierunek | ustaleń | najważniejsze (URL w `dane/etap2-research/`) | co zmienia u nas |
|---|---|---|---|
| 1a. kontekst subagentów (docs) | 7 odpowiedzi | `omitClaudeMd` potwierdzone (v2.1.271+; ignorowane tylko dla agenta głównego via `--agent`); reguły bez `paths:` wchodzą do subagenta jak CLAUDE.md; `paths:` w subagentach, rules/@import pod `omitClaudeMd`, Workflow `agent()` — **docs milczą** | 3 pomiary przed etapem 4 (§3) |
| 1b. plugin eval | 4 odpowiedzi | suita = katalogi `evals/<case>/prompt.md` + `graders/*.md` (regex, tool_used, tool_order, file_exists, llm 2-z-3, baseline); CI: `--trust-plugin --json --threshold`, kody 0/1/2; **nie mierzy tokenów** (tylko sufit `--max-cost-usd`); A/B promptów tylko operacyjnie (dwa checkouty, ten sam `--model`, `--judge-model`, podniesione `--runs`); `context.history_file` pozwala oceniać „kolejną turę" reviewera | narzędzie do A/B promptów reviewerów po wdrożeniu poleceń-list; koszt kontekstu mierzy `/skill-doctor`, nie eval |
| 2. mutation testing | 13 | Stryker 10.0 (2026-08, Node 22+, TS 7); vitest-runner wymusza `perTest`; **brak `--since` w JS**, są zakresy `plik:od-do`; incremental cache; Google diff-only; MutGen 53→89,5% z feedbackiem; ISSTA 2026: score ≠ wykrywalność; `@vitest/eslint-plugin`; `vitest --typecheck` na schemat vs kontrakt | trzy warstwy w domknięciu fazy (§0 pkt 5); test-coverage zostaje agentem tylko na „luka pokrycia / strażnik negatywny" |
| 3. bramki mechaniczne | 14 | ESLint 10 (2026-02): eslintrc **martwe**, tylko flat config; `recommendedTypeChecked` error, `strictTypeChecked` **tylko warn** (niestabilny wg semver); `max-lines {360, skipBlankLines, skipComments}`, `max-lines-per-function {60}`; `no-empty` w recommended za darmo; `eslint-plugin-react-hooks` v6 z regułami kompilatora (set-state-in-effect, refs, purity) — działa bez włączonego kompilatora; `import-x/order`; knip `--production --cache --reporter json`; size-limit; **Supabase CLI nie ma checksumy migracji** → własny `migrations.sum` na wzór Atlas/Prisma; Biome v2 i oxlint **nie zastąpią** ESLinta (brak max-lines i react-hooks), oxlint `--type-aware` (2026-07) jako plan B na czas; koszt typed lint ≈ jeden `tsc` | jeden `eslint.config.ts` + knip + size-limit + migrations.sum + `supabase db advisors` w domknięciu fazy; pre-skan fixa do skasowania |
| 4. coding-rules 2026 | 21 | patrz §0 pkt 6; do lintera: §1, §6, część §5/§10 (`no-explicit-any` z `fixToUnknown`, `no-floating-promises` = mechaniczne wejście dla „ścieżka błędu bez obsługi", `consistent-type-imports`); brakuje: `verbatimModuleSyntax`, `erasableSyntaxOnly`, `satisfies` zamiast zakazu `as`, `using`/`await using`, 4 reguły RLS (`(select auth.uid())`, indeks na kolumnie polityki, `TO <rola>`, zakaz `security definer` w wystawionym schemacie), Hono `zValidator` + `HTTPException`/`app.onError`, `AbortSignal.timeout` (klasa „brak timeoutu" jedną linią), OWASP API4:2023 (limit payloadu, page size, throttling), React 19 `useActionState`/`useOptimistic`, React Compiler = finding „brak useMemo" nieważny | przepisanie coding-rules.md w etapie 4/5 z tabelą USUŃ/ZMIEŃ/DODAJ/PRZENIEŚ-DO-LINTERA (lista w `research-coding-rules-2026.txt` → `rekomendacje`); właściciel: szablon, każda zmiana z URL |
| 5. ekonomia review | 14 | patrz §0 pkt 1–3; przy **zrównanym budżecie tokenów** pojedynczy agent dorównuje systemom wieloagentowym (2026-04) — 6 osi może „działać" przez 6× compute, nie przez specjalizację; specjalizacja płaci na przypadkach skrajnych (2026-01); OpenCodeReview (2026-08): regułowy dobór plików + ograniczone narzędzia = 2,17× lepszy SEM-F1 przy 5–15× mniejszym koszcie niż swobodny agent; pełne pliki biją sam diff, **pozytywny framing w opisie zmiany obniża wykrywalność** (2026-09, niska pewność); rynek stroi na niski FP, nie na recall (2026-05) | zakaz powtórek sekwencyjnych; sceptyk asymetryczny z etykietami; run kontrolny „1 reviewer z budżetem 6 osi vs 6 osi"; dossier = kod i fakty, bez zapewnień z planu |

## 2. Mapowanie na inwentarz — rozstrzygnięcia (pełna tabela z URL: `dane/etap2-research/mapowanie-na-pipeline.txt`)

| element | zamiennik | rozstrzygnięcie po etapie 2 (nadpisuje etap 1 tylko tam, gdzie zaznaczono) |
|---|---|---|
| security | częściowy | bez zmian wzgl. etapu 1; `supabase db advisors` (0013, 0007, 0002, 0023) w domknięciu zdejmuje z promptu reguły RLS; agentowi zostaje tryb atakującego na bramkach w kodzie TS + ładunek wyjątku + diff w `.claude/` |
| correctness | częściowy | **wzmocnienie:** `no-floating-promises` + `react-hooks` v6 (set-state-in-effect, refs, purity, immutability) jako mechaniczne wejście dla 2 największych klas B (ścieżka błędu 12, cykl życia React 11+6); agentowi zostaje „wszystkie drogi do operacji", wartość przed/po `await`, długość literału vs constraint |
| spec-compliance | **brak** | jedyna oś bez żadnego mechanicznego zamiennika — potwierdza ZOSTAW z etapu 1; polecenia-listy krótkie i na początku promptu (IFScale) |
| performance | standardowe narzędzie | potwierdza ZASTĄP: size-limit + advisors performance (0001, 0003, 0005) + `AbortSignal.timeout` jako reguła kodu; przy React Compilerze zapisać wprost: „brak useMemo/useCallback" nie jest findingiem |
| test-coverage | standardowe narzędzie (3 warstwy) | **zmiana wzgl. etapu 1:** kryterium falsyfikowalności zostaje, ale PRZED agentem stoją: `@vitest/eslint-plugin` → `vitest --typecheck` (expectTypeOf) → Stryker diff-scoped; wynik mutacji → builder (lista mutantów do zabicia); agent tylko na „luka pokrycia / strażnik negatywny" — kandydat do scalenia z correctness w etapie 4 |
| code-quality | standardowe narzędzie | potwierdza etap 1; konkret: ESLint 10 flat, `recommendedTypeChecked` error / `strictTypeChecked` warn, `max-lines` 360/60 ze skip*, `import-x/order`, knip; wynik lintera jako WEJŚCIE do promptu |
| e2e | **brak** | jedyny element nieodchudzalny bramką (mutacja nie obejmuje Browser Mode/E2E; brak narzędzia seed-vs-migracja); zostaje polecenie-lista o seedach |
| verify-sceptycy | częściowy (mechanika) | **zmiana wzgl. etapu 1:** ZOSTAW + przepisać na kontekst asymetryczny i etykiety sporu (DISAGREE_EVIDENCE wymaga linii kodu lub testu); dla P1 zamknięcie testem regresyjnym, nie konsensusem; batch 4/sceptyk z etapu 1 nadal hipoteza |
| dedup semantyczny | częściowy | rola zmienia się z „scal duplikaty" na „zagreguj i odsiej sporadyczne" — ma sens tylko, jeśli etap 4 wybierze n równoległych próbek; głosowanie nie naprawia błędów skorelowanych |
| packager/dossier | częściowy → **JS** | **rozstrzygnięcie otwartego pytania z etapu 1:** dobór plików i routing deterministycznie w JS (OpenCodeReview), treść dossier = pełne pliki dotknięte + kontrakty, **bez zapewnień z planu fazy**; agent packagera znika. Sprzeczność „szeroko vs wąsko" (§4) do pomiaru |
| scribe telemetrii | brak w researchu | decyzja z etapu 1 (niższy tier, krótszy prompt); własny wniosek: append jednego wiersza to praca JS, nie modelu |
| stan:zapis | nie dotyczy | etap 1 stoi (stan w prompcie następcy); docs potwierdzają, że subagent nie dziedziczy historii, więc stan i tak musi być w delegacji |
| precheck | częściowy → skrypt | `doctor` (bash, HANDOFF 6a pkt 12) + scalenie z env-up; `claude plugin validate`/`eval` jako bramka CI maszynerii szablonu |
| env-up E2E | częściowy | `doctor` + bramka `migrations.sum` PRZED postawieniem środowiska (Supabase CLI nie zauważy edycji wypchniętej migracji) |
| pre-skan fixa | standardowe narzędzie | **skasować** — to praca ESLint (`no-empty`, `no-unreachable`, `no-unused-vars`) i knipa |
| kontrola diffu naprawczego | częściowy | NIE scalać (etap 1 stoi); `migrations.sum` + `vitest --typecheck` łapią część klasy „zmiana kontraktu", reszta zostaje agentowi |
| domknięcie fazy | standardowe narzędzie | pełny zestaw: `eslint.config.ts` + knip + size-limit + `vitest --typecheck` + Stryker diff-scoped + `migrations.sum` + `supabase db advisors`; brak gotowego pakietu → skrypt w package.json; **czas niezmierzony** |
| planner + dev-docs | częściowy | budżet pliku w IU = liczba z `max-lines` (360/60) jako wyzwalacz, wymiary jako werdykt (HANDOFF 6a pkt 8); knip jako wykrywacz martwych eksportów/rejestru stałych |
| builder — kontekst startowy | **natywny** | `omitClaudeMd` + `tools:` allowlista + `disallowedTools: mcp__*` + `skills:`; reguły potrzebne agentowi jako krótkie polecenia w prompcie delegacji; **warunek: 3 pomiary z §3** |
| dev-pr | częściowy | 8 zmian `.coderabbit.yaml` PRZED pomiarem (etap 1b stoi); `.coderabbit.yaml` to konfiguracja 50+ linterów bota, nie tylko promptu |
| dev-compound | **natywny** | warstwowanie: wiedza do reguł z `paths:` (ładowane przy czytaniu pasującego pliku), nie do CLAUDE.md; **ale** jeśli `paths:` nie działa w subagentach, warstwowość odchudza tylko sesję główną — pomiar §3 |
| sync-template | częściowy | plugin ODŁOŻONY (decyzja operatora); `claude plugin validate --strict` + `eval` jako bramka CI zmian w maszynerii — do wdrożenia niezależnie od pluginu |
| coding-rules.md | częściowy | przepisać wg §0 pkt 6 i kierunku 4; docelowo: to, co zostaje, to polecenia produkujące listę, nie proza; ~3k tokenów × 35 agentów = ~105k na fazę tylko za reguły |

## 3. Do pomiaru PRZED etapem 4 (warunki wejścia, kolejność wg wagi)

1. **Reguły `paths:` i `omitClaudeMd` w subagentach** — mini-run wg HANDOFF 6a pkt 9, rozszerzony o: (a) czy `omitClaudeMd` wyłącza `rules/*.md` i `@import`,
   (b) czy działa dla `agent()` w Workflow, (c) kontekst startowy z `usage` dla trzech wariantów: `omitClaudeMd`, `tools:` bez MCP, `skills:` zamiast 300 opisów.
   Bez tego panel nie wie, czy dźwignia to 30–40% czy 15–20%.
2. **Ile z 195 uwag B łapie sam ESLint flat + knip + tsc + `@vitest/eslint-plugin` + `vitest --typecheck`** — przepuścić dzisiejszy kod oferty-online przez
   proponowany `eslint.config.ts` i zestawić trafienia z `klasyfikacja-574.csv` po `plik:linia`. To jedna liczba rozstrzygająca, ile osi review można skasować.
3. **Czas bramki mechanicznej na oferty-online** (ESLint typed, knip `--cache`, size-limit, Stryker na fazie o 10–30 plikach, advisors) — żadne źródło nie
   podaje liczb dla 50–200 plików. Jeśli > kilku minut, plan B: oxlint `--type-aware` jako dodatek.
4. **Inter-run agreement naszego review:** ile z 12–18 findingów powtórki (9b f4 ×2, f3 ×3) to te same findingi, ile nowe prawdziwe — rozstrzyga, czy jesteśmy
   w reżimie „powtórka szkodzi" czy „za mało próbek". Dane są w `findingi-per-os/`, to skrypt, nie agent.

Pomiary po etapie 4 (nie blokują projektu): kill rate sceptyka asymetrycznego (i czy nie obala P1); run kontrolny „1 reviewer z budżetem 6 osi"; Stryker
na atrapach bez argumentów (hipoteza: nie łapie, łapie `prefer-called-with`) i na schematach Zod; cache `stryker-incremental.json` między fazami; fałszywe alarmy
knipa; efekt mandatu dossier na tury Bash reviewerów; wariancja `plugin eval` między `--runs`.

## 4. Sprzeczności w researchu i jak je rozstrzygam

- **Sekwencyjnie vs równolegle (kierunek 5).** Nie sprzeczność, lecz rozróżnienie: druga runda po pierwszej szkodzi; n równoległych próbek pomaga. U nas
  dzisiaj jest wyłącznie wariant szkodliwy. Do panelu: wariant „n=3 próbki correctness z różną kolejnością diffu + agregator" jako alternatywa dla 6 osi.
- **Tnij compute (1 agent = MAS przy równym budżecie) vs dołóż compute (adversarial ~4,5× tokenów).** Rozstrzygnięcie: compute przesuwa się z osi produkujących
  szum (performance, code-quality → lint) do weryfikacji (sceptyk asymetryczny). Sceptycy to dziś 6% fazy — nawet 2× więcej to mniej niż jedna oś.
- **Dossier szeroko (pełne pliki biją diff) vs wąsko (deterministyczny dobór bije swobodne czytanie).** Oba mówią to samo o JEDNYM: dobór plików ma być
  regułowy (JS), a wybrane pliki podane w całości. Sprzeczne jest tylko „ile plików" — do pomiaru mandatu dossier.
- **Mutacja generuje pracę agenta (kierunek 2) vs tnij tury (kierunek 5).** Mutacja jest tania w tokenach (CPU), a jej wynik zastępuje tury reviewera
  test-coverage turami buildera — ten sam agent, który i tak istnieje, z listą zamiast szukania.
- **`strictTypeChecked` (kierunek 4 rekomenduje) vs niestabilny wg semver (kierunek 3 ostrzega).** `recommendedTypeChecked` error, `strictTypeChecked` warn.
- **Blogi vs schemat Strykera.** Schemat wygrywa: brak `--since`, zakresy przez `--mutate`.

## 5. Ograniczenia tego etapu

- Większość docs bez daty publikacji (data = dostęp 2026-09-20). Cztery ustalenia niskiej pewności (blog Stryker 2026-06, paper o kontekście 2026-09, przewodnik
  augmentcode, sourcegraph) użyte tylko jako potwierdzenie, nie jako podstawa decyzji.
- Brak źródeł: mechanika `/code-review`/ultrareview Anthropic, Copilot code review, Greptile (liczba przejść, weryfikacja); routing po ryzyku PR (dane Cloudflare
  nie otwarte u źródła); badanie porównujące dokładnie nasze 6 osi z jednym reviewerem.
- Kierunek 1b oparty na `--help` lokalnej wersji 2.1.278 — może się zmienić z wersją.

## 6. Co idzie dalej

- **Do krytyka (etap 3):** czy 4 pomiary z §3 są wystarczające i dobrze zdefiniowane; czego research nie objął (E2E, seed vs migracja, spec-compliance — trzy
  elementy bez zamiennika); słownik klas z 1b; brak per-osiowej atrybucji obaleń; czy „polecenia-listy" nie wpadną w ten sam próg IFScale przy 6 osiach × 4–5 poleceń.
- **Do panelu (etap 4), twarde wejścia z etapu 2:** zakaz powtórek sekwencyjnych review; sceptyk asymetryczny z etykietami; pełny zestaw bramek domknięcia
  (§2 „domknięcie fazy"); trzy warstwy testów niefalsyfikowalnych z wynikiem do buildera; packager → JS; pre-skan → skasować; `omitClaudeMd` + `tools:` + `skills:`
  u agentów pipeline'u (warunkowo na pomiar 1); przepisanie coding-rules.md wg kierunku 4. **Wariant do rozważenia:** n=3 równoległe próbki 2–3 osi skrajnych
  (security, correctness+testy) zamiast 6 osi. **Nie jest wariantem:** plugin.
- **Do raportów (etap 5):** dla operatora — trzy zdania: reguły w tekście są pomijane (68% przy 500), bot łapie nas linterami, a nie mądrością; powtarzanie review
  kupuje 1 prawdziwy defekt za 4–5 fałszywych; sceptyk działa 4× słabiej niż może, bo dostaje odpowiedź razem z pytaniem.

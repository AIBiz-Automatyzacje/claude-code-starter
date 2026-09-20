# HANDOFF — analiza i odchudzenie pipeline'u dev-* (stan na 2026-09-19 ~23:30)

**Dla kogo:** dla Claude'a w nowej sesji (nowe konto, limit Fable wyczerpany). Przeczytaj TEN plik w całości, potem
`dane/dane-digest.md`, potem `dane/workflow-A-werdykty-6-osi.txt`. Dopiero wtedy działaj.

## 1. Czego chce operator (Kacper) — dosłownie

Sesja zaczęła się od przeglądu 13 runów autopilota po naprawach N1–N9 (raport: `../2026-09-19-przeglad-runow-po-naprawie.md`).
Potem operator zmienił cel na **analizę i plan odchudzenia całego procesu dev-***. Jego słowa (skrót, bez zniekształceń):

- „szukam wąskich gardeł tego procesu"; „staramy się dodawać nowe rzeczy, a prościej byłoby o odchudzenie i optymalizację"
- przykład 1: „dev-plan i dev-docs — czemu nie możemy tego złączyć w jeden etap? zawsze po dev-plan odpalam dev-docs i nic pomiędzy nie robię"
- przykład 2: „najwięcej tokenów zjada faza review. Mamy tam ileś subagentów. Czy każdy jest potrzebny? Czy jest aktualny? Czy jakiegoś nie brakuje? Czy proces jest optymalny?"
- „Spec-Driven Development (plany, IU) i Test-Driven Development — jak możemy zrobić to dzisiaj lepiej"
- „biorę pod uwagę koszt, o ile będzie nam dostarczał kod, który będzie dobrze wykonany"
- „nie uruchamiaj nieskończonej ilości procesów — zarządź dużymi zasobami rozsądnie"
- **wynik końcowy:** „konkretny plan, jak to wszystko potem poprawić" — najpierw faza analizy i wniosków
- **dwa raporty:** (a) techniczny, dla Claude'a, „żeby potem lepiej z niego składać rzeczy" — pełne dowody, liczby, ścieżki;
  (b) dla człowieka, prosty do czytania, **ogólnie, z perspektywy DLACZEGO te zmiany optymalizują workflow i dlaczego warto** —
  bez technicznych wywodów (te idą do raportu technicznego).
- Założenia potwierdzone przez operatora („zacznij"): miara jakości kodu = ile P1/P2 znajdują CodeRabbit i /bugfix PO naszym
  review; SDD i TDD to zasady do optymalizacji, nie nienaruszalne; wnioski mają dotyczyć szablonu (workspace-template), nie jednego projektu.
- Tryb: ultracode (workflowy wieloagentowe dozwolone), ale z rozsądkiem.

## 2. Plan pracy (uzgodniony z operatorem) i gdzie jesteśmy

| # | Etap | Status |
|---|---|---|
| 0 | Model kosztu — deterministycznie, skryptami, bez agentów | **GOTOWE** (`dane/`, sekcja 3 niżej) |
| 1 | Wartość każdego reviewera i mechaniki review (analityk + sceptyk per element) | **GOTOWE 2026-09-20** (run `wf_7181673d-ef5`, 18 agentów Opus, skrypt `skrypty/workflow-B-etap1.js`). Wyniki: `dane/workflow-B-etap1-wyniki.json`, czytelnie `dane/etap1-spory/*.txt`. **Rozstrzygnięcie na Fable: `ETAP1-ROZSTRZYGNIECIE.md` — to jest wejście do etapów 2–4, a NIE werdykty z workflow-A (liczone na danych v1, zawyżone ~2×).** |
| 1b | dev-pr (analityk + sceptyk) + klasyfikacja 574 uwag CodeRabbita z GitHuba | **GOTOWE 2026-09-20** (run `wf_daf2b119-3c4`, 6 agentów Opus, skrypt `skrypty/workflow-C-etap1b.js`). Dane: `dane/coderabbit/` (bot-comments.jsonl, klasyfikacja-574.csv). **Rozstrzygnięcie: `ETAP1B-ROZSTRZYGNIECIE.md`** — 8 zmian w .coderabbit.yaml (−85% szumu), mapa luk per oś z poleceniami-listami (~60–70% uwag B), dev-pr PRZEBUDUJ wąsko (4 zmiany). |
| 2 | Research zewnętrzny (5 kierunków) + mapowanie na nasz pipeline | **GOTOWE 2026-09-20** (run `wf_f3c27f89-972`, 7 agentów Opus, skrypt `skrypty/workflow-D-etap2-research.js`, odtworzenie `skrypty/journal_do_json.py`). Dane: `dane/workflow-D-etap2-wyniki.json`, czytelnie `dane/etap2-research/*.txt`. **Rozstrzygnięcie: `ETAP2-ROZSTRZYGNIECIE.md`** — 6 ustaleń przekrojowych (IFScale: reguły cicho pomijane; powtórka sekwencyjna szkodzi, równoległa pomaga; sceptyk asymetryczny 4× skuteczniejszy; `omitClaudeMd` potwierdzone, `paths:`/rules w subagentach — docs milczą; 3 warstwy testów niefalsyfikowalnych, StrykerJS bez `--since`; 2 reguły coding-rules sprzeczne z docs), mapa 22 elementów, **4 pomiary jako warunek wejścia do etapu 4** (§3). |
| 3 | Krytyk kompletności | NIE ZROBIONE (wejście: ETAP2 §6) |
| 4 | Panel projektowy: 3 niezależne projekty pipeline'u „po" (minimalistyczny / jakość-najpierw / hybrydowy) → sędziowie → adwersarialna krytyka → synteza | NIE ZROBIONE |
| 5 | Dwa raporty (techniczny + dla człowieka) do `docs/reviews/` + publikacja jako artefakt (opcjonalnie) | NIE ZROBIONE |

**Jak wznowić etap 1–3:** skrypt workflow A leży w `skrypty/workflow-A-pipeline-analiza-a.js` (ścieżki już przepisane na
`docs/reviews/2026-09-19-analiza-pipeline/dane`). Najprościej: uruchomić go ponownie jako NOWY workflow (`Workflow({script: <treść pliku>})`),
ale (a) usunąć z listy OSIE 6 gotowych osi albo wkleić ich werdykty do promptów sceptyków, (b) skrócić prompt kierunku
`claude-code-natywne` (był za długi dla agenta `claude-code-guide` — podzielić na 2 agentów albo usunąć fragment o digestcie),
(c) rozważyć `model: 'opus'`/`'sonnet'` per agent, żeby nie spalić limitu — analitycy i sceptycy na opus wystarczą; research na sonnet.
Resume po `resumeFromRunId: wf_b4073f19-1a6` NIE zadziała na nowym koncie (inny katalog sesji).

## 3. Twarde ustalenia z modelu kosztu (etap 0) — to jest fundament wszystkich wniosków

Pełne liczby: `dane/dane-digest.md` (wersja 2, po korekcie liczenia tur), tabele: `dane/koszt_tabele.txt`, `dane/kontekst_1_tury.txt`,
`dane/koszt_skilli.txt`, `dane/koszt_zadan.txt`. Surowe: `dane/agents.csv` (2 941 agentów), `dane/skille.csv` (149 epizodów skilli).
Skrypty do odtworzenia: `skrypty/*.py` (czytają `~/.claude/projects/*/…/subagents/workflows/wf_*/agent-*.jsonl`).

1. **Koszt = tury × kontekst.** Skład kosztu (cennik: input 1, cache write 1,25, cache read 0,1, output 5): cache read 59%,
   cache write 39%, **output 2%**. Dotychczasowa telemetria mierzyła tylko output, więc każda decyzja o progach oceniała 2% kosztu.
2. **Opłata za powołanie agenta = 22% całości.** Pierwsza tura każdego agenta zapisuje do cache ~107k tokenów (system prompt 44k,
   CLAUDE.md+rules 33k, nazwy ~900 narzędzi MCP 27k, opisy ~300 skilli 10k). Faza powołuje **35 agentów** (740 tur).
3. **Stały narzut kontekstu × tury = 40% kosztu** (26% to czysty narzut bez promptu zadania). `oferty-online/CLAUDE.md` urósł
   z 3,4k do 89,7k znaków w 4 tygodnie, `learned-patterns.md` 0 → 47k — dopisuje je dev-compound. Każdy agent niesie to w każdej turze.
4. **Udziały per etap fazy (oferty-online po 06.09):** execute (planner+build+domknięcie) 28%, 6 reviewerów 25%, pętla fix 17%,
   orkiestracja+e2e-env+zakończenie 12%, sceptycy 6%, mechanika review (packager+dedup+scribe) 5%. Żaden pojedynczy reviewer > 5,4%.
5. **Builderzy/fix czytają przez Bash:** 78% ich komend to cat/sed/grep (tryb „bashFirst strict"), 37 Bash vs 2 Read na agenta;
   każda komenda = tura = ponowny odczyt 150–200k kontekstu.
6. **Skille przed autopilotem (prep, plan, docs) = 2–5% kosztu zadania.** Scalenie dev-plan+dev-docs oszczędza czas operatora
   (~1–2 h przekazań) i jedno przepisanie (zadania z dev-docs to w 22–46% niemal dosłowna kopia planu 57–137 kB), nie tokeny autopilota.
7. **Review:** potwierdzone findingi per oś (P1/P2/P3): security 9/122/134, test-coverage 7/81/114, performance 7/71/105,
   code-quality 1/36/99, spec 10/58/64, correctness 4/39/38, e2e 1/13/51. Sceptycy obalają 12%, częściej przeklasyfikowują (64 korekty).
   Pętla fix naprawia 98% findingów łącznie z P3. Review NIE zbiega: powtórka tej samej fazy daje 12–18 nowych pozycji (9b f4 ×2, samodzielna f3 ×3).
8. **Runy:** 13 po 06.09, 3 z 5 zadań po 2–3 runy; STOP-y prawie wyłącznie E2E (niemierzalna asercja, limit mailera ×2, fałszywy STOP po edycji operatora).
   Scribe telemetrii (haiku) skasował globalny JSONL 2× (odzyskane 32 wpisy: `~/.claude/telemetry/autopilot-runs.odzyskane-2026-09-19.jsonl`).
   `oferty-online` NIE ma napraw N1–N9 (sync zablokowany lokalnym patchem E2E).

## 4. Werdykty 6 osi review z workflow-A (NIEAKTUALNE — patrz `ETAP1-ROZSTRZYGNIECIE.md`; liczby bezwzględne poniżej są z danych v1, zawyżone ~2×)

| oś | werdykt | próbka: realne/styl/szum/operator | sedno |
|---|---|---|---|
| security | ZOSTAW-ODCHUDZ | 42/8/1/13 z 64 | jedyne źródło P1/P2 klasy CSP/nosniff/XFF/wyciek do PostHoga; prompt 191 linii ma ~100 martwych (OWASP raport, Edge Functions, DOMPurify, 3 zdublowane checklisty); działa jak generalista (22/42 realnych spoza domeny) |
| correctness | ZOSTAW-ODCHUDZ | 47/2/2/9 z 60 | najwyższa gęstość realnych defektów; łapie klasę, którą bot znajduje po nas (cykl życia stanu, wyścigi); 55 tur → celować w ~35; dać mu plik agenta zamiast general-purpose |
| spec-compliance | ZOSTAW-ODCHUDZ | 38/9/1/15 z 63 | jedyny kierunek „od wymagania do kodu"; najniższy odsetek P3 i obalonych; ~27% findingów dubluje inne osie — ogrodzić |
| performance | ZOSTAW-ODCHUDZ | 37/14/3/10 z 64 | 0 obalonych, ~20 realnych bez innego łapacza (bundle D12, `for update` na hot path, canvas 1 GB); 59 martwych linii promptu; 57% P3 |
| e2e | ZOSTAW-ODCHUDZ | 11/1/7/30 z 49 | jedyna oś klasy render/nawigacja/seed; 32 puste przebiegi (brak checkboxów) powinny być bramką JS, nie agentem; diagnostyka harnessu do env-up |
| code-quality | **ZASTĄP** | 13/42/2/4 z 61 | 69% to styl/konwencja; 1 P1 (duplikat security); zastąpić ESLint flat config (no-explicit-any, no-non-null-assertion, max-lines, import order, knip) w domknięciu fazy + checklista granic warstw w correctness |

Brakujące analizy z etapu 1 (do zrobienia): **test-coverage** (największe źródło findingów: 202 potwierdzone, 88 zgłoszonych w 15 fazach,
5,9 na agenta, 47% P3), **verify-sceptycy** (12% obalonych za 6% kosztu — czy się opłaca), **dossier/dedup/scribe**, **pętla fix**
(naprawianie P3 kosztuje 17% fazy), **orkiestracja** (stan:zapis 269 agentów haiku, telemetria, planner, domknięcie 31 tur).

## 5. Hipotezy do projektu „po" (z danych, jeszcze nie zweryfikowane panelem)

Kolejność wg spodziewanego efektu. Każda ma być w raporcie z liczbą „przed/po" i ryzykiem.

1. **Odchudzić kontekst startowy agenta** (największa dźwignia, ~30–40% kosztu): CLAUDE.md projektu ≤ 15k znaków + reguły ładowane
   warunkowo (rules z globs, skills on-demand), learned-patterns poza kontekstem (czytane przez packager do dossier), wyłączenie MCP
   i listy skilli w subagentach pipeline'u (pole `tools:`/allowlist w definicji agenta — do potwierdzenia w docs Claude Code),
   dev-compound przestaje dopisywać do CLAUDE.md (pisze do docs/solutions + jeden indeks).
2. **Mniej agentów na fazę** (35 → ~15): stan:zapis i telemetria jako jeden plik JSON per run pisany `Write` przez agenta, który i tak
   istnieje (scribe), zamiast 3 osobnych agentów haiku na fazę; dedup semantyczny do scribe'a; pre-skan + kontrola + poprawka → jedna
   kontrola; planner + domknięcie → w builderze; verify-batch tylko dla P1/P2 KOD (nie dla P3 i OPERATOR).
3. **Roster review 6 → 4–5:** code-quality → lint (ESLint/knip) w domknięciu; security/performance/spec/correctness zostają
   z odchudzonymi promptami (~50% linii) i twardym ogrodzeniem domen; test-coverage — do zbadania (może scalić z correctness jako
   „poprawność + testy zachowania"); e2e zostaje, ale puste przebiegi to bramka JS.
4. **Powtórka review po STOP-ie E2E = tylko tester**, nie pełny skład (dowód: ~1,2M tokenów wyj. na powtórki w 2 zadaniach).
5. **P3: nie naprawiać automatycznie** — zostawić botowi/operatorowi; pętla fix tylko P1/P2 (do potwierdzenia analizą pętli fix:
   ile z 138 P3 to realne defekty).
6. **dev-plan + dev-docs = jeden skill** (jeden artefakt: plan z fazami i checkboxami, bez przepisywania 22–46% treści);
   dev-prep zostaje osobno (interaktywny, 100 min z człowiekiem). Oszczędność: czas operatora, nie tokeny.
7. **Builderzy: Read/Edit zamiast Bash** (wyłączyć „bashFirst strict" dla subagentów pipeline'u) — mniej tur na to samo czytanie.
8. **Telemetria pełna:** liczyć cache read/write, nie output; jeden plik na run; próg alarmowy na koszt fazy, nie na tokeny wyjściowe.
9. **Parametryzacja E2E w szablonie** (sonda, start, PID z `.env.e2e`) — bez tego `oferty-online` nie dostanie żadnej naprawy.

## 6. Co dokładnie zrobić po wznowieniu (kolejność)

1. Przeczytać: ten plik → `dane/dane-digest.md` → `dane/workflow-A-werdykty-6-osi.txt` → `../2026-09-19-przeglad-runow-po-naprawie.md`.
2. Dokończyć etap 1: uruchomić workflow (na bazie `skrypty/workflow-A-pipeline-analiza-a.js`) TYLKO dla brakujących elementów:
   analityk test-coverage + 4 mechaniki, sceptycy dla wszystkich 11 werdyktów (6 gotowych werdyktów wkleić do promptów sceptyków
   z `dane/workflow-A-wyniki-czesciowe.json`), „ucieczki do bota". Modele: opus (nie fable). ~20 agentów.
3. Etap 2: ZROBIONE (`ETAP2-ROZSTRZYGNIECIE.md`). Przed etapem 4 wykonać 4 pomiary z ETAP2 §3 (reguły `paths:`/`omitClaudeMd` w subagentach; ile z 195 uwag B łapie lint; czas bramek; inter-run agreement) — skrypty i mini-run, nie agenci.
4. Etap 3: krytyk. 1 agent (opus). Wejście: ETAP2 §6.
5. Etap 4: panel projektowy — 3 projektanci (każdy dostaje digest + werdykty po kontrach + mapę researchu + hipotezy z sekcji 5,
   ale z innym priorytetem: minimalny koszt / maksymalna jakość / hybryda), 3 sędziów, sceptyk na zwycięzcę, synteza. ~8 agentów.
6. Etap 5: napisać dwa raporty do `docs/reviews/2026-09-19-analiza-pipeline/`:
   - `RAPORT-TECHNICZNY.md` — dla Claude'a: mapa kosztów przed/po, tabela decyzji per element z dowodem, docelowy pipeline z szacunkiem
     kosztu fazy, plan wdrożenia w 3 iteracjach z miarą sukcesu, quick wins, decyzje operatora, pełne ścieżki do danych;
   - `RAPORT-DLA-OPERATORA.md` — dla Kacpra: prosto, bez technicznych wywodów, DLACZEGO każda zmiana optymalizuje proces i dlaczego warto;
     porównanie „dziś / po" w 5–8 punktach; co zyska (koszt, czas, jakość); czego wymaga od niego (decyzje).
   Zaproponować publikację raportu dla operatora jako artefaktu (strona do przekazania dalej).
7. Zaktualizować pamięć: `~/.claude/projects/-Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template/memory/` —
   plik `project_analiza_pipeline_2026_09.md` (jeszcze NIE istnieje; utworzyć) + wpis w `MEMORY.md`.

## 6a. Uzupełnienia operatora po etapie 1 (2026-09-20) — obowiązują dla etapów 2–5

1. **CLAUDE.md:** żaden skill nie dopisuje do CLAUDE.md (dev-docs-complete:115-116, complete-wf:160 do usunięcia). Aktualizacja = krok „uzgodnij
   z rzeczywistością" na końcu pracy na branchu (po smoke i po bocie), z bramką rozmiaru liczoną w JS. Decyzje fazowe → `docs/decisions/` + 1 linia indeksu.
2. **dev-pr do osobnej analizy** (operator niezadowolony): (a) czy realnie naprawia findingi bota, które powinien; (b) brak raportu końcowego per tura
   (co było, co naprawiono); (c) brak jasnej rekomendacji merguj / nie merguj / potrzebna kolejna tura; (d) domyślna liczba tur 3–4 do ustalenia;
   (e) **pomiar uwag CodeRabbita z GitHuba oferty-online**: których dało się uniknąć i dlaczego (progi 300/50 linii przekroczone o 5–10% = szum
   do wyłączenia w `.coderabbit.yaml`), a które pokazują realne luki procesu. Analiza ucieczek (etap 1) zrobiła to z compoundów, nie z GitHuba.
3. **Higiena konta (poza szablonem, sekcja raportu dla operatora):** MCP i pluginy per projekt, nie globalnie; **audyt zainstalowanych pluginów** — usunąć nieużywane.
4. **learned-patterns:** format klasa → reguła (2 zdania) → Source; dev-compound wstawia do sekcji klasy; refresh deduplikuje per klasa; bramka rozmiaru w JS.
   **Pytanie otwarte operatora:** projekt rozwijany rok, mikroserwisy — sztywny limit reguł/rozmiaru odrzuca wiedzę. Odpowiedź: limit dotyczy warstwy
   zawsze ładowanej (indeks), nie wiedzy — wiedza schodzi do warstw ładowanych warunkowo (patrz odpowiedź w sesji 2026-09-20).
5. **coding-rules.md:** poprawki (sprzeczność §3/§11, zbyt absolutne NIGDY/ZAWSZE, część do ESLint) + **research w etapie 2**: czy dokument pisany dziś
   od zera wyglądałby inaczej (stan praktyk 2026 dla TS/React 19/Supabase/Node); co usunąć, co dodać. Właściciel: szablon, wersjonowany, zmiany tylko z dowodem.
6. **Profil stacku** z package.json w dossier + komendy-listy per technologia u istniejących reviewerów; NIE nowy agent.
7. **Ustalenia z docs Claude Code (2026-09-20, agent claude-code-guide, code.claude.com/docs/en/memory, /sub-agents, /settings-reference):**
   - `.claude/rules/*.md` z frontmatter `paths:` (globy) ładują się DOPIERO gdy Claude czyta plik pasujący do wzorca; bez `paths:` — na starcie
     jak CLAUDE.md. `@import` w CLAUDE.md jest ZAWSZE eager (ładowany na starcie). Subagent (nie-fork) dostaje całą hierarchię CLAUDE.md + reguły
     bezwarunkowe; `omitClaudeMd: true` (v2.1.271+) to wyłącza; reguły `paths:` w subagencie — niezagwarantowane w docs (trigger to Read, więc
     logicznie działają; do zmierzenia na jednym runie). Docs: „jeśli reguła musi dotrzeć do subagenta, powtórz ją w prompcie delegacji".
   - Definicja subagenta: `tools:` = allowlista, usuwa definicje MCP z kontekstu subagenta; `disallowedTools: mcp__*` wyłącza MCP w całości;
     skille wstrzykuje osobne pole `skills:` (pełna treść), brak `Skill` w `tools` blokuje ich wywołanie. **To jest mechanizm na 27k+10k tokenów
     narzędzi/skilli u agentów pipeline'u.**
   - `enabledPlugins` działa w `.claude/settings.json` projektu → pluginy per projekt, nie globalnie. `/doctor` pokazuje koszt kontekstowy
     nieużywanych skilli/MCP/pluginów; `/skill-doctor` i `/plugin stats` — użycie z 7 dni i „never invoked" (dane do audytu pluginów).
8. **Budżet pliku w scalonym dev-plan+dev-docs (uzupełnienie po 1b):** IU dotykające istniejącego pliku podaje jego długość, szacowany przyrost
   i ocenę pozostałych wymiarów (liczba powodów do zmiany, eksporty konsumowane przez różne warstwy, importy z wielu domen, test-lustro rosnące
   szybciej niż kod, reguła 5 sekund). Jeśli którykolwiek wymiar pęka → IU zawiera jawny krok „wydziel moduł X" PRZED dodaniem Y. Linie = wyzwalacz
   pytania (z tolerancją 20%), wymiary = werdykt. Ten sam próg z tolerancją w ESLint (domknięcie) i w `.coderabbit.yaml`.
9. **Test reguł warunkowych i kontekstu subagentów (przed etapem 4, osobny mini-run na małym repo):** reguły-markery z `paths:` dla 5 wymiarów
   (`*.tsx`, `supabase/migrations/**`, `*.test.*`, `Dockerfile`+`coolify*`, `.claude/**`), jedna reguła z DWOMA globami, dwie z nakładającymi się
   globami, jedna bez `paths:` (kontrola), jedna reguła o „momencie procesu" bez ścieżki (ma NIE wejść). Mierzyć: (a) czy marker trafia do
   sesji głównej / subagenta z Agent tool / agenta z `agent()` w workflow / agenta z `omitClaudeMd: true`; (b) co wyzwala: Read, Edit, Write
   NOWEGO pliku, Bash `cat`, dossier z listą plików bez otwierania; (c) czy marker zostaje w kolejnych turach; (d) kontekst startowy przed/po
   (z `usage` w transkrypcie) dla: reguły warunkowe, `tools:` allowlista bez MCP, `enabledPlugins` per projekt. Wynik: tabela wymiar × wyzwalacz × typ agenta.
10. **MCP per agent — kto potrzebuje:** buildery danych robią migracje przez Supabase CLI (`supabase db reset`, feature-builder-data.md:65), nie MCP;
    Coolify przez CLI (skill coolify-manager). Figma MCP: builder UI, builder fullstack, tester E2E — tylko gdy zadanie ma `figma_screens`. Reszta
    agentów pipeline'u: `disallowedTools: mcp__*`. Supabase MCP tylko w sesji głównej (dev-plan). Dopisanie serwera agentowi = jedna linia, gdy zajdzie potrzeba.
11. **Aktualizacja CLAUDE.md dopiero PO merge'u** (nie po ostatniej turze — kolejna tura po commicie może przynieść Major i wymusić ręczną naprawę):
    krok w dev-pr po potwierdzonym merge'u (auto lub operator potwierdza w skillu) + siatka bezpieczeństwa: bootstrap autopilota na main sprawdza,
    czy ostatni merge ma wpis w `docs/decisions/`; brak → uzgodnienie CLAUDE.md przed startem runu. Zmiany w `.coderabbit.yaml` (8 z ETAP1B §2)
    wdrożyć PRZED pomiarem dev-pr, bo zmniejszą liczbę tur.
12. **Wymagane narzędzia CLI — dziś brak systemu.** Stan: tylko skill agent-browser ma `command -v`; sync-template sprawdza git; README nie ma
    sekcji wymagań. Użytkownik szablonu bez Supabase CLI dowie się w ŚRODKU runu autopilota (e2e:env-up `supabase db push`, builder-data
    `supabase db reset`), bez gh — na starcie dev-pr, bez agent-browser — w testerze E2E. Ruch: mechaniczny skrypt `doctor` (bash, zero agentów),
    lista narzędzi WYLICZANA z projektu (git, gh+auth, node+pm z lockfile, supabase CLI gdy jest `supabase/`, agent-browser gdy są checkboxy E2E,
    coolify CLI gdy jest konfiguracja Coolify, docker gdy Dockerfile), wynik: tabela brak/wersja + komenda instalacji. Wołany w trzech miejscach:
    sync-template (pierwsza instalacja), dev-prep (checklista operatora), bootstrap autopilota (STOP przed pierwszą fazą, nie w środku). Plus sekcja
    „Wymagania" w README.
13. **Szablon jako plugin — DECYZJA OPERATORA 2026-09-20: NIE WDRAŻAĆ TERAZ.** Zbadane, zapisane niżej jako pomysł na później; w panelu etapu 4 nie jest wariantem, co najwyżej wzmianką „opcja na przyszłość". Pierwotne pytanie: dziś szablon to kopiowany katalog `.claude/`
    z synchronizacją przez sync-template; lokalny patch w oferty-online zablokował sync (digest §6) — to argument ZA pluginem (maszyneria
    read-only, aktualizacja przez marketplace, `doctor` jako komenda pluginu). Do sprawdzenia w docs: czy plugin może dostarczać workflows
    (`.claude/workflows/*.js`), rules, hooki, agentów, templates; jak wygląda aktualizacja i pinowanie wersji; co MUSI zostać w projekcie
    (CLAUDE.md, learned-patterns, docs/, .autopilot-state, settings) i jak plugin czyta to z projektu; czy istniejący plugin `aibiz`
    (skill plugin-zespolowy) jest gotowym wzorcem. Doctor: narzędzia obowiązkowe (git, gh+auth, node+pm, agent-browser) vs warunkowe
    z profilu stacku (supabase CLI tylko gdy `supabase/`, coolify tylko gdy konfiguracja Coolify) — informacja przy instalacji, nie w runie.
    **Ustalenia z docs (2026-09-20, claude-code-guide; plugins-reference, plugins, workflows#distribute-a-workflow-in-a-plugin, plugin-marketplaces):**
    plugin MOŻE nieść: skills/, agents/, commands/, hooks/hooks.json, .mcp.json, **workflows/ (skrypty Workflow tool)**, templates jako assety
    czytane z `${CLAUDE_PLUGIN_ROOT}/templates/`. NIE MOŻE: CLAUDE.md jako kontekst, `rules/*.md` jako auto-ładowany kontekst (brak pola
    `rules`), permissions/env/settings (plugin settings.json wspiera tylko `agent` i `subagentStatusLine`). Skille i workflowy dostają
    namespace `/nazwa-pluginu:skill` — wszystkie wewnętrzne odwołania między skillami do przepisania. Agenci projektu nadpisują pluginowych
    o tej samej nazwie. Pliki projektu: skille pluginu działają w cwd projektu, czytają i piszą normalnie; zmienne `${CLAUDE_PLUGIN_ROOT}`
    (zmienia się per wersja — nie trzymać tam stanu), `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_DATA}` (przeżywa update). Aktualizacja:
    auto-update per marketplace, DOMYŚLNIE WYŁĄCZONY dla własnych marketplace'ów; ręcznie `/plugin marketplace update`; **bieżąca sesja NIE
    dostaje nowej wersji** (dopiero `/reload-plugins` albo restart) — run autopilota jest bezpieczny; stare wersje w cache ~14 dni. Pin:
    `extraKnownMarketplaces` w `.claude/settings.json` projektu z `ref`/`sha` + `version` w plugin.json. Przed migracją: `claude plugin validate
    --strict` i `claude plugin eval`. W projekcie zostają: settings.json, CLAUDE.md, rules/ (albo rules → skille), docs/, stan autopilota.
14. **Styl komunikacji z operatorem:** gdzie był problem → co go powodowało → jak działa rozwiązanie → co to daje. Język korzyści, minimum żargonu.

## 7. Uwagi techniczne, żeby nie powtarzać błędów tej sesji

- Hook `md-guard` blokuje zapis `.md` przez Bash (heredoc/python) — pliki `.md` pisz WYŁĄCZNIE narzędziem Write/Edit; dane robocze zapisuj jako `.txt`/`.json`/`.csv`.
- Skrypt Workflow to czysty JS bez template literals z backtickami wewnątrz stringów zawierających backticki — pierwszy skrypt padł na parse; używaj konkatenacji `'...' + '...'`.
- Prompt dla `claude-code-guide` nie może być długi („Prompt is too long") — ten agent ma mały limit; daj mu 1–2 pytania.
- W transkryptach agentów jedna odpowiedź API = kilka wpisów `assistant` z tym samym `message.id` i tym samym `usage` — licz raz per id (poprawione w `koszt_agentow.py` v2).
- Etykiety agentów: nowsze runy mają `description` w `agent-*.meta.json` lub `label` w `journal.jsonl`; starsze wymagają klasyfikacji po początku promptu (`klasyfikuj()` w `koszt_agentow.py`).
- Scratchpad sesji (`/private/tmp/claude-501/.../scratchpad`) znika — wszystko trwałe jest w tym katalogu.
- `docs/reviews/` w szablonie jest nieśledzone przez git (`??`) — decyzja operatora otwarta; ten katalog też jest nieśledzony.

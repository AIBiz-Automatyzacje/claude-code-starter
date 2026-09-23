# MINI-RUN — plan (część A)

**Data:** 2026-09-23. **Status:** PLAN, czeka na znak operatora. Nic z części B nie jest uruchomione — poza krokiem 0 (sprawdzenie modelu), na który operator
dał zgodę w wiadomości startowej. **Wersja dla operatora:** `MINI-RUN-PLAN-DLA-OPERATORA.md`.
**Źródła:** HANDOFF §8 (instrukcja), 6a pkt 9, 15–20; PANEL-WEJSCIE §1 pkt 4, §2 pkt 1–4, §11, §12; POMIARY §1 + `dane/pomiar1-reguly-subagenci/`;
`PRZEGLAD-D4-DLA-OPERATORA.md` + `dane/d4r-dzwignia-kontekstu.txt`; `dane/d5r-wykonalnosc-rekordu.txt` §2, §10.

## 0. Krok 0 — jaki model dostaje agent (WYKONANY 2026-09-23, run `wf_ab0244a1-f3e`)

Pięciu agentów z tym samym promptem „odpowiedz OK”, effort low; model odczytany z pola `message.model` w transkrypcie (nie z odpowiedzi agenta).
Odtworzenie: `skrypty/mr_krok0_model.py` → `dane/mr-krok0-model.txt`.

| ustawienie w `agent()` | model w transkrypcie | ctx_start (tok) |
|---|---|---|
| brak `model` (dziedziczy sesję) | claude-opus-5-5 | 77 909 |
| `model: 'opus'` | claude-opus-5-5 | 77 909 |
| `model: 'claude-opus-5-5'` | claude-opus-5-5 | 77 923 |
| `model: 'claude-opus-5'` | claude-opus-5 | 77 916 |
| `model: 'haiku'` | claude-haiku-4-5-20251001 | 59 121 |

Wnioski: (1) alias `opus` wskazuje dziś Opus 5.5; (2) pełny identyfikator przypina model — działa dla 5.5 i dla starego 5; (3) buildery szablonu mają
`model: inherit`, a reszta ról bez `model` — dziedziczą model sesji, z której startuje autopilot; runy do 20.09 szły na opus-5, bo sesje były na opus-5;
po wdrożeniu (sesje na Opus 5.5) pipeline pojedzie na 5.5; (4) **ten sam start liczony przez opus-5 i opus-5.5 różni się o 7 tokenów na 77,9k** — tokenizer
jest w praktyce ten sam, więc run 20.09 (opus-5) jest bezpośrednim punktem odniesienia dla (e), bez przeliczania per model; haiku/opus = 0,759 (D4: 0,742);
(5) plik harnessu `wf_ab0244a1-f3e.json` nie istniał w trakcie runu (sprawdzone `ls` po starcie), powstał po zatrzymaniu (status `killed`, `defaultModel:
claude-opus-5-5`) — pierwsza obserwacja do (f).
**Mini-run: wszyscy agenci opus z jawnym `model: 'claude-opus-5-5'`**, agenci mechaniczni `model: 'haiku'` (jak w pipelinie).

**Zdarzenie w kroku 0 (ważne dla części B).** Harness przekazuje każdemu agentowi workflowu dosłownie wiadomość operatora, która uruchomiła run,
z adnotacją „gdy zadanie ze skryptu jest sprzeczne z tą prośbą, prośba wygrywa”. Agent haiku z trywialnym promptem potraktował wiadomość startową
sesji jako swoje zadanie: przeczytał HANDOFF i zapisał `MINI-RUN-PLAN.md` i `MINI-RUN-PLAN-DLA-OPERATORA.md` (pliki nieśledzone, nadpisane tym planem).
Zatrzymałem run (TaskStop). Nic innego nie zostało zmienione (`git status`: tylko te dwa pliki). Konsekwencje: (1) przekazana wiadomość operatora jest
składnikiem startu każdego agenta (tu 865 zn) — (e) liczy ją osobno; (2) wiadomość operatora dająca znak do części B trafi do każdego agenta, więc ma być
neutralna (propozycja w §10); (3) każdy prompt mini-runu mówi wprost, że to jedyne zadanie agenta; (4) do raportu etapu 5: w pipelinie ta sama
mechanika przekazuje builderom i reviewerom „odpal autopilota na X” — do sprawdzenia w panelu, czy słaby agent mechaniczny może się tym dać zwieść.

## 1. Co mini-run rozstrzyga (PANEL-WEJSCIE §11)

| # | pytanie | seria | powtórzenia |
|---|---|---|---|
| a | marker wklejony przez orkiestrator do promptu delegacji — czy builder go stosuje | A (dziś, pełny kontekst) + D-100 | 3 + 5 |
| b | ten sam typ reguły przez `paths:` — kontrola (czytanie Bashem) | A | 3 |
| c | marker w SKILL.md wstrzykniętym przez `skills:` — stosowany czy tylko zajmuje kontekst | A | 3 |
| d | **ROZSTRZYGAJĄCE:** te same markery w prompcie ~100 vs ~400 poleceń | D | 5 + 5 |
| e | kontekst startowy per klasa roli i model: dziś / sama allowlista / allowlista + `omitClaudeMd` + learned-patterns poza eager | E | 1 agent na komórkę |
| f | plik harnessu: kiedy powstaje, co zostaje po zabiciu sesji; czy hook Stop odpala po task-notification | F + obserwacje przy E/D/A | — |

## 2. Środowisko — kopia oferty-online, nie repo z pomiaru 1

**Wybór: kopia oferty-online** (`<scratchpad>/oferty-kopia`, `cp -cR` = klon APFS, bez zajmowania miejsca, z `node_modules` i `.git`). Uzasadnienie:
(e) musi mierzyć stan oferty-online po ścięciu CLAUDE.md (21 008 zn), z learned-patterns 46 897 zn i coding-rules 11 016 zn, z jej agentami, skillami
i pluginem `dev-browser` — repo z pomiaru 1 ma kilkadziesiąt linii i nie daje żadnej z tych liczb. Seria A odpowiada na (a)/(c) w prawdziwym tłoku
kontekstu buildera (~500 instrukcji, D2), a nie w pustym repo, gdzie marker nie ma z czym konkurować. Seria D kontroluje kontekst plikiem agenta
(`omitClaudeMd`, allowlista, bez skilli), więc repo jej nie przeszkadza. Jedno repo = jedna konfiguracja do przygotowania i sprawdzenia.

**Sanityzacja kopii (przed jakimkolwiek agentem, skrypt `mr_przygotuj.sh`):** usunąć `.env`, `.env.e2e`, `supabase/.temp/` (link do projektu
chmurowego — bez niego `supabase db push` nie ma dokąd pisać), `git remote remove origin`; w `.claude/settings.json` kopii zastąpić hooki Stop
(tsc i przypomnienie o błędach działają tylko w sesji głównej, subagentów nie dotyczą) hookiem testowym z (f). Oryginał oferty-online tylko do odczytu.
Nadrzędny CLAUDE.md (`Kodowanie/CLAUDE.md`, ~0,5k zn) kopiuję do `<scratchpad>/CLAUDE.md`, żeby hierarchia instrukcji była jak w oryginale.
**Nie odtwarzam** pamięci projektu oferty-online (MEMORY.md, ~1,3k tok w D4 jako „pozostałe instrukcje”) — (e) raportuje ten składnik osobno jako brak.

**Pliki testowe w kopii (commit w kopii, żeby worktree serii D je widziały):**
- pliki klas (seria E): `mr-mechaniczny.md` (sama allowlista) i `mr-mechaniczny-o.md` (allowlista + `omitClaudeMd: true`), `mr-orkiestracyjny.md`,
  `mr-reviewer.md`, `mr-sceptyk.md`, `mr-naprawiacz.md` (CLAUDE.md zostaje), `mr-builder.md` (allowlista + `skills:` i treść jak `feature-builder-data`);
  wszędzie `tools: Read, Bash, Edit, Write` (+ StructuredOutput od harnessu) — ta sama allowlista, na której D4 liczyło cele; `omitClaudeMd` tylko
  u mechanicznych (6a pkt 15); model podawany w `agent()`, nie w pliku;
- `.claude/agents/mr-builder-czysty.md` (seria D): allowlista `Read, Bash, Edit, Write, Glob, Grep`, `omitClaudeMd: true`, bez `skills:`, treść 2 zdania
  („implementujesz jedną jednostkę z promptu; pracujesz w bieżącym katalogu”) — poza promptem agent nie dostaje żadnych poleceń projektu;
- `.claude/rules/mr-migracje.md` z `paths: ["supabase/migrations/**"]` — marker R (seria A);
- marker S dopisany w środku `.claude/skills/supabase-dev-guidelines/SKILL.md` kopii, w formie sąsiednich reguł (skill wstrzykiwany builderowi danych).

**Sesja:** na czas części B przenoszę sesję główną do kopii (`change_directory`) — agenci workflowu startują w katalogu sesji, a `agent()` nie ma opcji
`cwd`. To zachowuje środowisko aplikacji desktop (schematy narzędzi, lista MCP i skilli jak w prawdziwych runach), czego `claude -p` z terminala
nie daje. Po części B wracam do workspace-template. Plan awaryjny, gdy przeniesienie nie zadziała (agenci nie startują w kopii — sprawdzam polem
`cwd` w pierwszym transkrypcie): zatrzymuję się i proszę o otwarcie osobnej sesji desktop w kopii z gotowym poleceniem uruchomienia skryptów.

## 3. Zadanie buildera i markery

**IU-MR (jedno zadanie, warstwa danych, format plannera):** tabela `mr_notatki_oferty` (id, oferta_id → oferty, tresc ≤ 2000 zn, autor, created_at)
z RLS „właściciel oferty”, migracja `supabase/migrations/20260923120000_mr_notatki_oferty.sql`; moduł `apps/server/src/offer/mr-notatki.ts`
(schemat Zod wejścia, funkcja walidacji, funkcja budująca wiersz do insertu); test `apps/server/src/offer/mr-notatki.test.ts` (happy path + błąd).
Wzorce: istniejące migracje i moduły `apps/server/src/offer/`. Pełny tekst IU generuje `mr_przygotuj.py` (do wglądu przed startem).
**Wymagania wykonania (wspólne dla A i D, poza markerami):** blok „Wymagania wykonania” plannera + `BLOK_DLUGIE_KOMENDY` dosłownie jak w
`dev-docs-execute-wf.js` + jedno zdanie: „Kopia bez zależności i bez połączenia z bazą: nie uruchamiaj testów, instalacji, buildów ani komend supabase;
napisz kod i testy.” Powód: bez `.env` i linku testy integracyjne i tak nie ruszą, a worktree serii D nie ma `node_modules`; zdanie usuwa też ryzyko
dotknięcia chmury. Koszt dla wniosków: builder robi mniej tur niż w runie (ograniczenie w §9).

**Markery** — losowe ciągi generowane skryptem w części B (`secrets.token_hex`), **unikalne per run** (przeciek między runami byłby widoczny jako cudzy
ciąg), zapis w `dane/mr-markery.json` przed startem. Każdy marker to zwykła konwencja projektu, pisana stylem sąsiednich poleceń (bez wersalików i wyróżnień):

| id | treść polecenia (wzór) | sprawdzenie skryptem |
|---|---|---|
| M1 | każdy nowy plik .ts zaczyna się linią `// MR-<ciąg>` | pierwsza linia nowych .ts |
| M2 | każda nowa migracja SQL zaczyna się linią `-- MR-<ciąg>` | pierwsza linia nowej migracji |
| M3 | każda eksportowana funkcja w nowym module ma w JSDoc tag `@mr <ciąg>` | JSDoc nad każdym `export function`/`export const … = (` |
| M4 | nazwa każdego nowego testu (`it`/`test`) zaczyna się od `<ciąg>:` | pierwsze argumenty `it(`/`test(` w nowym pliku testu |
| M5 | nowy moduł eksportuje stałą `MR_ZNACZNIK = '<ciąg>'` | grep w nowym module |
| R | każda nowa migracja kończy się linią `-- MR-R-<ciąg>` (reguła `paths:`) | ostatnia niepusta linia migracji |
| S | każdy nowy plik testu kończy się linią `// MR-S-<ciąg>` (SKILL.md) | ostatnia niepusta linia testu |

Ocena per marker: **pełne** (wszystkie miejsca), **częściowe**, **brak**. Dla R i S dodatkowo **dotarcie**: czy ciąg jest w kontekście agenta
(załącznik / wynik narzędzia w transkrypcie) — odróżnia „nie dotarła” od „dotarła, nie zastosowana”. Dla R zapisuję też, czym builder otworzył
istniejące migracje (Read / Bash `cat` / wcale). Skrypt nie ocenia jakości kodu — tylko markery i status z wyniku buildera.

## 4. Serie

### Seria E — kontekst startowy (pytanie e), 2 runy Workflow, 24 agentów jednoturowych
Prompty: **prawdziwe prompty z runu 20.09** (`wf_e5c34cd8-66c`, computed task), dla każdej klasy i modelu agent z medianowym ctx_start (wybór skryptem
`mr_prompty_20_09.py`), z dopiskiem „to pomiar kontekstu, nie wykonuj zadania, zwróć {ok: true}” i schematem `{ok}` (StructuredOutput jak w pipelinie).
Effort low. Komórki: mechaniczny haiku, orkiestracyjny opus, reviewer opus z plikiem (`security-sentinel`), reviewer opus bez pliku (oś correctness,
domyślny agent), sceptyk opus, naprawiacz opus, naprawiacz haiku, builder opus (`feature-builder-data`) — 8 komórek.
- **E1 „dziś” (8) + „T: sama allowlista” (8)** — jeden run; „dziś” = wywołanie jak w pipelinie (ten sam agentType/model), „T” = pliki `mr-*`
  bez `omitClaudeMd` (mechaniczny: `mr-mechaniczny`).
- Między runami: w kopii `git mv .claude/rules/learned-patterns.md docs/` (learned-patterns poza eager).
- **E2 „T+O+L” (8)** — pliki `mr-*` (mechaniczny: `mr-mechaniczny-o`), do promptu klas niemechanicznych doklejony wycinek 1 500 zn z learned-patterns
  (pierwsze wpisy pasujące do `apps/server/src/offer` i `supabase/migrations`) — konfiguracja, na której D4 policzyło cele.
Odczyt: `mr_kontekst.py` = funkcja `sklad()` z `d4r_dzwignia_kontekstu.py` (ta sama metoda): ctx_start, składniki w znakach i tokenach (stawki z D4),
liczba narzędzi w tablicy `tools`, liczba nazw odroczonych, skilli, pliki instrukcji, przekazana wiadomość operatora; środowisko: `entrypoint`
(claude-desktop / cli), `version`, lista serwerów MCP w sesji. Potem **przeliczenie dźwigni**: Δ startu zmierzone per klasa (dziś − T+O+L) podstawione
za modelowane Δ w agentach runu 20.09 (te same wagi wywołań co d4r) → % kosztu fazy; osobno sama allowlista (dziś − T).

### Seria D — 100 vs 400 poleceń (pytanie d), 1 run Workflow, 10 builderów równolegle
Agent `mr-builder-czysty`, `model: 'claude-opus-5-5'`, `isolation: 'worktree'` (każdy run we własnym worktree kopii — pliki się nie mieszają; nie potrzebują
`node_modules`, bo testów się nie uruchamia). Schemat wyniku = `BUILD_RESULT` z `dev-docs-execute-wf.js`.
**Prompt** = tekst IU-MR + wymagania wykonania (wspólne) + **jeden oznaczony blok poleceń** (`=== POLECENIA ===`, każda pozycja listy = jedno polecenie —
jednostka testu budżetu przyjęta w przeglądzie D2). Blok 400: prawdziwe polecenia z materiałów, które builder dostaje dziś — coding-rules szablonu,
treść `feature-builder-data.md`, skille `supabase-dev-guidelines`/`security`/`sentry-integration`, wpisy learned-patterns oferty-online — przepisane
jako pozycje listy bez zmiany treści; skrypt odrzuca polecenia sprzeczne z markerami (o komentarzach na początku pliku, JSDoc, nazwach testów, stałych)
i duplikaty. **Blok 100 = losowy (ziarno zapisane) podzbiór bloku 400 w tej samej kolejności** — ramiona różnią się wyłącznie liczbą poleceń. Markery
M1–M5 jako pozycje bloku na tych samych **względnych** pozycjach w obu ramionach: 10%, 30%, 50%, 70%, 90% (w bloku 400 = pozycje 40/120/200/280/360,
w bloku 100 = 10/30/50/70/90). Liczba poleceń: ~100 i ~400 w bloku + ~25 w tekście IU i wymaganiach (policzone skryptem obiema metodami: pozycje
bloku oraz metoda D2 — lista + zdania nakazowe — dla ciągłości z pomiarem 6).
**Powtórzenia: 5 na ramię** → 25 obserwacji markerów na ramię. Dlaczego tyle wystarczy: pytanie brzmi, czy liczba poleceń jest DUŻĄ dźwignią
(taką, która uzasadnia budżet 150 jako cel jakościowy); przy 25 vs 25 różnica ≥ 20 pp jest istotna (Fisher jednostronny p < 0,05: 25/25 vs 20/25 → p = 0,025;
24/25 vs 18/25 → p = 0,024), a efekt mniejszy niż ~20 pp i tak ginąłby w szumie prawdziwego runu (review, fix, bot). Więcej powtórzeń kupuje wykrycie
efektów, które niczego w decyzji nie zmieniają. Uwaga: markery w jednym runie nie są niezależne — dlatego drugi odczyt per run (ile z 5 markerów).

### Seria A — builder „dziś” (pytania a, b, c), 3 runy Workflow po kolei
Agent `feature-builder-data` (prawdziwy plik z kopii: `skills: [supabase-dev-guidelines, security, sentry-integration]`, `model: inherit` → jawnie
`model: 'claude-opus-5-5'`), pełny kontekst dziś (CLAUDE.md, coding-rules, learned-patterns eager, MCP), bez worktree — w katalogu kopii, żeby hierarchia
CLAUDE.md i reguły `paths:` działały dokładnie jak w pipelinie. Prompt = IU-MR w formacie plannera z sekcją „Wyuczone reguły projektu:” (tak planner
wkleja dziś learned-patterns i tak orkiestrator ma wklejać wycinek) zawierającą 3 prawdziwe wpisy learned-patterns + markery M1–M5 + wymagania
wykonania + `BLOK_DLUGIE_KOMENDY`. R w regule `paths:`, S w SKILL.md. Po każdym runie (bez agentów, Bash): zrzut nowych i zmienionych plików
+ `git diff` do `<scratchpad>/mr/wyniki/A-<n>/`, potem `git checkout -- . && git clean -fd` w kopii (pliki śledzone przez git; `node_modules` ignorowane,
zostaje). 3 runy po kolei, nie równolegle — worktree serii A dokładałby drugi CLAUDE.md z katalogu nadrzędnego (do sprawdzenia w D) i psułby
realność „dziś”.

### Seria F — plik harnessu i hook Stop (pytanie f), bez dodatkowych agentów w sesji desktop
- **f1 kiedy powstaje plik harnessu:** przy każdym runie E1/E2/D/A `ls <sesja>/workflows/` w trakcie i po zakończeniu (krok 0: w trakcie brak, po TaskStop jest).
- **f2 co zostaje po zabiciu sesji głównej:** w `<scratchpad>/mr-f/` (mały `git init`) `claude -p --model haiku` uruchamia Workflow z pliku skryptu
  (1 agent haiku: `sleep 90`, potem OK); po ~40 s zabijam proces `claude` — wariant SIGTERM, potem drugi przebieg SIGKILL; spis plików sesji
  (journal, transkrypt agenta, `workflows/<run>.json`, ich stan). To terminal, nie desktop — zapis harnessu jest wspólny, ale to zapisuję jako ograniczenie.
- **f3 hook Stop po task-notification:** hook testowy w `.claude/settings.json` kopii dopisuje do `<scratchpad>/mr/stop-hook.jsonl` czas i wejście hooka
  (JSON ze stdin). Po każdym runie E/D/A odpowiedź sesji na task-notification kończy turę — sprawdzam, czy jest wpis z tą chwilą. Jeśli po przeniesieniu
  sesji hooki kopii się nie ładują (zero wpisów po mojej zwykłej odpowiedzi), odpowiedź daje f2 z tym samym hookiem w `mr-f/` (czy `claude -p`
  czeka na workflow i czy Stop odpala po jego zakończeniu), a desktop zostaje jako otwarte pytanie wdrożenia.

## 5. Agenci — pełna lista

| seria | agentów | model | agentType | tury |
|---|---|---|---|---|
| 0 (wykonany) | 5 | opus-5-5 ×3, opus-5, haiku | domyślny | 1 (haiku zatrzymany po 7 narzędziach) |
| E1 | 16 | opus-5-5 ×12, haiku ×4 | pipeline'owe (w tym `security-sentinel`, `feature-builder-data`) + `mr-*` | 1 |
| E2 | 8 | opus-5-5 ×6, haiku ×2 | `mr-*` | 1 |
| D | 10 | opus-5-5 | `mr-builder-czysty`, worktree | pełne zadanie |
| A | 3 | opus-5-5 | `feature-builder-data` | pełne zadanie |
| F | 2 (po 1 agencie w 2 sesjach `claude -p`: SIGTERM, SIGKILL) | haiku | domyślny | kilka |

Razem w części B: **39 agentów + 2 krótkie sesje terminalowe**, 6 runów Workflow w sesji desktop (E1, E2, D, A×3). Zero agentów analizujących — wyniki liczą skrypty.

## 6. Skrypty i dane (część B)

`skrypty/mr_przygotuj.sh` (kopia, sanityzacja, pliki testowe, commit w kopii) · `skrypty/mr_przygotuj.py` (markery, IU-MR, bloki 100/400, prompty A/D,
liczenie poleceń → `dane/mr-markery.json`, `dane/mr-prompty/*.txt`, `dane/mr-polecenia.txt`) · `skrypty/mr_prompty_20_09.py` (prompty E z runu 20.09)
· `skrypty/mr_kontekst.py` (E → `dane/mr-kontekst.{txt,json}`, dźwignia) · `skrypty/mr_ocena.py` (A/D: markery, dotarcie, narzędzia, Fisher →
`dane/mr-markery-wynik.{txt,json}`) · `skrypty/mr_harness.py` (F → `dane/mr-harness.txt`). Wszystko z transkryptów, journali i plików harnessu —
nic z pamięci. Skrypty workflowów zapisane obok jako `skrypty/mr-workflow-*.js`.

## 7. Kryteria rozstrzygnięcia (zapisane PRZED uruchomieniem)

- **(a) wklejenie do promptu.** Miara: odsetek markerów M1–M5 zastosowanych w pełni, osobno A (15 obserwacji) i D-100 (25).
  **DZIAŁA:** ≥ 80% w A i w D-100 → wariant „orkiestrator wkleja wycinek” (6a pkt 15/17) potwierdzony. **CZĘŚCIOWO:** 50–79% w którymkolwiek → wycinek
  zostaje, ale reguły sprawdzalne mechanicznie idą też do bramek. **NIE DZIAŁA:** < 50% → wklejenie nie wystarcza, wiedza projektu musi iść w bramki
  i polecenia-listy warstwy stałej; wraca do panelu jako zmiana wymogu §2 pkt 4.
- **(b) `paths:`.** Spodziewane: nie dociera (builder czyta Bashem). **POTWIERDZONE:** R nie dotarł w ≥ 2 z 3 runów → precedens §1 pkt 1 bez zmian.
  Dotarł, bo builder użył Read → „bonus działa przy Read” (zapis), bez zmiany precedensu. Dotarł 3/3 → notuję, że builder w kopii czyta Read-em częściej
  niż w runach (78% Bash), wniosek nie zmienia decyzji o bypass.
- **(c) `skills:`.** **STOSOWANA:** S dotarł i zastosowany w ≥ 2 z 3 runów → `skills:` zostaje bez zmian (6a pkt 15). **TYLKO KONTEKST:** dotarł 3/3,
  zastosowany 0/3 → podział skilli na warstwę stałą (do promptu) i referencyjną z wymogu §2 pkt 3 staje się konieczny, nie porządkowy. **NIESTABILNA:**
  1/3 → reguły krytyczne nie mogą polegać wyłącznie na skillu. Nie dotarł → błąd konfiguracji, run do powtórki po naprawie.
- **(d) 100 vs 400 (rozstrzygające).** Miara główna: odsetek markerów w pełni zastosowanych na ramię (25 obserwacji); pomocnicza: mediana markerów per run.
  **DŹWIGNIA:** różnica (100 − 400) ≥ 20 pp i Fisher jednostronny p < 0,05 i mediana per run niższa o ≥ 1 → budżet 150 jest celem jakościowym, panel
  projektuje warstwę stałą z twardym limitem. **BRAK DŹWIGNI:** różnica ≤ 8 pp (≤ 2 z 25) → budżet zostaje jako porządek i koszt (PANEL §11), główną dźwignią
  jakości są małe naprawy (D1) i ewentualnie równoległe próbki. **NIEJEDNOZNACZNE:** pomiędzy → raportuję jako brak dowodu dużego efektu; dołożenie
  po 5 runów na ramię tylko na znak operatora. Dodatkowo (opisowo, bez progu): zależność od pozycji (10% / 50% / 90%) i porównanie z A (ten sam zestaw
  M1–M5 w pełnym kontekście dziś, ~500 instrukcji poza promptem).
- **(e) kontekst.** **POTWIERDZONE:** zmierzony start „T+O+L” w granicach ±25% celu D4 dla każdej klasy (mechaniczne ~9–10k, orkiestracyjne/sceptycy/
  naprawiacze opus ~25–26k, naprawiacz haiku ~21k, reviewer ~29k, builder ~38k) i przeliczona dźwignia ≥ 40%. **NIŻSZA:** dźwignia 30–40% albo któraś
  klasa poza ±25% → poprawiam liczby w pakiecie (PANEL §1 pkt 4, §12, mapa walidacji) przed panelem. **OBALONE:** < 30% → dźwignia do przeliczenia
  od nowa, kolejność priorytetów panelu do rozmowy. Osobno: sama allowlista vs D4 27–38%; rozjazd składnika > 25% → wyjaśniam przyczynę (np. inny zestaw MCP
  w dzisiejszej sesji niż 20.09) liczbą z transkryptu.
- **(f) fakty, bez progów:** f1 plik harnessu powstaje tylko po zakończeniu (tak/nie, z czasem pliku vs `durationMs`); f2 lista plików po SIGTERM i SIGKILL
  + status w pliku harnessu, jeśli jest; f3 hook Stop odpala / nie odpala po odpowiedzi na task-notification, i co niesie na wejściu. Wynik trafia
  do rekordu D5 §3 (wyzwalacz skanu: hook Stop vs doctor).

## 8. Koszt i czas (szacunek; jednostka jak w D4: input 1, cache write 1,25, cache read 0,1, output 5)

| pozycja | rachunek | M jedn. |
|---|---|---|
| E1 + E2 (24 agentów, 1 tura) | „dziś” opus ~125k × 1,25 × 6 + haiku ~90k × 1,25 × 2 + T i T+O+L średnio ~40k × 1,25 × 16 | ~2,0 |
| D (10 builderów, ~15 tur) | ramię 100: start ~15k, średni kontekst ~30k → ~0,17 M/run; ramię 400: start ~35k, ~50k → ~0,23 M/run | ~2,0 |
| A (3 buildery, ~20 tur) | start ~140k, średni kontekst ~160k: 20 × 160k × 0,1 + ~0,18 M zapisów + ~0,1 M output → ~0,6 M/run | ~1,8 |
| F (haiku, terminal) | 2 krótkie sesje | ~0,2 |
| **razem** | | **~6 M (≈ 1/6 runu 20.09, 35,3 M)** |

Krok 0 już kosztował ~0,4 M tokenów (harness: 419 056). Czas: przygotowanie ~20 min (skrypty, bez agentów), E ~10 min, D ~15 min, A ~30 min
(3 × ~10 po kolei), F ~10 min, skrypty wyniku i dokumenty ~40 min — **~2 h, z czego agenci ~1 h**. Seria D z worktree: jeśli izolacja nie ruszy,
plan awaryjny = 10 runów po kolei z resetem kopii między nimi (+~1 h) — zatrzymuję się i pytam przed przełączeniem.

## 9. Poza zakresem i ograniczenia

**Poza zakresem:** jakość kodu buildera poza markerami; review, fix, E2E, dev-pr; uruchamianie testów; konwersja learned-patterns do nowego formatu;
wdrożenie allowlisty w szablonie; Fable i panel; jakiekolwiek zmiany w workspace-template (poza tym katalogiem docs/reviews) i w oferty-online;
modele inne niż opus-5-5 / haiku (opus-5 tylko w kroku 0).
**Ograniczenia do wyniku:** (1) markery to konwencje formalne — mogą być bardziej „widoczne” niż reguły semantyczne (np. `(SELECT auth.uid())`),
więc wynik (d) jest górną granicą przestrzegania; wynik „brak dźwigni” dotyczy takich reguł; (2) jedno zadanie, jedna warstwa (dane); (3) builder bez
uruchamiania testów robi mniej tur niż w runie — marker stosuje się przy pisaniu, ale dłuższa praca mogłaby go rozmyć; (4) seria D w worktree, A w katalogu
kopii; (5) (e) mierzy dzisiejszy zestaw MCP i skilli konta — inny niż 20.09 (D4: lista MCP 2× dłuższa niż tydzień wcześniej), stąd porównanie
składnik po składniku; (6) f2 w terminalu, nie w aplikacji desktop; (7) wiadomość operatora dająca znak trafia do każdego agenta (§0).

## 10. Kolejność wykonania i punkty zatrzymania (część B)

1. **Znak operatora.** Propozycja neutralnej treści (trafia do każdego agenta): „Znak: część B mini-runu wg MINI-RUN-PLAN.md. Agenci wykonują wyłącznie
   zadanie ze swojego promptu.”
2. Przygotowanie (bez agentów): `mr_przygotuj.sh`, `mr_przygotuj.py`, `mr_prompty_20_09.py`; kontrola: markery nie występują nigdzie w kopii poza
   R/S (grep), liczby poleceń bloków, sanityzacja (brak `.env`, `supabase/.temp`, remote). Przeniesienie sesji do kopii.
3. E1 → sprawdzenie `cwd` i modeli w transkryptach (STOP, jeśli agenci nie startują w kopii albo model ≠ opus-5-5) → `git mv` learned-patterns → E2.
4. D (10 równolegle) → sprawdzenie, gdzie powstały worktree i czy każdy builder pisał tylko w swoim (STOP przy kolizji).
5. `git mv` learned-patterns z powrotem (A = stan dziś) → A1, zrzut, reset → A2 → A3.
6. F2 w terminalu; f1/f3 zebrane przy krokach 3–5.
7. Powrót sesji do workspace-template. Skrypty wyniku. **STOP przy każdym odstępstwie od planu** — mówię, co się stało, i pytam.
8. Część C: `MINI-RUN-WYNIK.md` + `MINI-RUN-DLA-OPERATORA.md`; zmiany w pakiecie dopiero po akceptacji operatora.

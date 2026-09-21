# Etap 3 — rozstrzygnięcie: krytyk kompletności przed panelem etapu 4

**Data:** 2026-09-20. **Rozstrzyga:** sesja główna (Fable 5.1) na wyniku 1 agenta Opus (`effort: high`), run `wf_2ff97321-477`
(29 min, 235k tokenów, 21 wywołań narzędzi). Skrypt: `skrypty/workflow-E-etap3-krytyk.js`, odtworzenie z journala: `skrypty/journal_do_json.py`.
**Dane:** `dane/workflow-E-etap3-wyniki.json` (pełny wynik), czytelnie `dane/etap3-krytyk/krytyk-kompletnosci.txt`.
**Wejście krytyka:** HANDOFF.md (całość), ETAP1, ETAP1B, ETAP2, POMIARY (rozstrzygnięcia), `../2026-09-19-przeglad-runow-po-naprawie.md`,
inwentarz `.claude/` (frontmattery agentów i skilli dev-*, settings.json, grep po workflowach). Krytyk NIE czytał `dane/`.
**Mandat krytyka:** szukać luk, nie proponować rozwiązań, nie podważać decyzji operatora (6a pkt 1–17). Każda luka z oceną blokuje-panel / ryzyko-do-raportu.

**Zasada czytania:** sekcja 0 to werdykt sesji głównej, który ODCHODZI od werdyktu krytyka w trzech z czterech „blokad" — uzasadnienie w §1.
Wszystkie 19 luk krytyka zostają w dokumencie z pełnymi dowodami; zmieniam tylko ich klasyfikację tam, gdzie luka zamyka się faktem, który już mamy,
albo arytmetyką na zmierzonych liczbach.

## 0. Werdykt

**Krytyk:** panel NIE może startować — 4 luki blokujące (L1 dźwignia kontekstu przeliczona dla odrzuconej konfiguracji, L2 polecenia-listy bez pomiaru,
L3 atrybucja nowych findingów po fixie tylko po nazwie pliku, L4 sprzeczne mandaty dla osi test-coverage) + 15 ryzyk do raportu.

**Sesja główna:** panel MOŻE startować po trzech tanich domknięciach (skrypty + czytanie w sesji głównej, zero agentów, łącznie ~2 h) i po jednym
słowie operatora w sprawie test-coverage. Uzasadnienie per luka w §1. Skrót:

| luka | krytyk | sesja główna | dlaczego |
|---|---|---|---|
| L1 dźwignia 30–40% | blokuje | **ryzyko + korekta liczby (zrobiona w §1.1)** | arytmetyka na liczbach z POMIARY §1 daje ~86% pierwotnej dźwigni; kolejność priorytetów nie zmienia się. Druga część (24 role bez pliku agenta) to FAKT wejściowy dla panelu, nie blokada |
| L2 polecenia-listy | blokuje | **ryzyko z warunkiem odwrotu + domknięcie D2 przed panelem** | skuteczności nie da się zmierzyć przed wdrożeniem; budżet instrukcji per reviewer da się policzyć skryptem w 30 min |
| L3 atrybucja po fixie | blokuje | **blokuje → domknięcie D1 przed panelem (~1 h)** | jedyna luka, gdzie fakt jest tani, a bez niego panel dostaje pytanie postawione na złym podziale |
| L4 test-coverage | blokuje | **precedens do potwierdzenia przez operatora (D4)** | sprzeczność jest realna; rozstrzyga ją kolejność dokumentów i utrata przesłanki, nie nowy pomiar |

Werdykt: **tak, z ryzykami** — pod warunkiem D1–D4 z §7.

## 1. Cztery „blokady" krytyka — rozstrzygnięcie każdej

### 1.1 L1 — dźwignia kontekstu startowego po decyzjach 6a pkt 15

**Zarzut (trafny w faktach):** POMIARY §5 pkt 1 liczy 35 agentów × ~57k, a 57k = 62,0k (general-purpose) − 4,5k (`tools:` + `omitClaudeMd`) — konfiguracja,
której 6a pkt 15 NIE przyjmuje dla builderów i reviewerów (CLAUDE.md 20,6k zn zostaje, `skills:` 7–12k tok zostaje, wycinek learned-patterns dochodzi).
Druga część: `tools:`/`omitClaudeMd` żyją w pliku definicji agenta, a w workflowach `agentType` mają tylko: security-sentinel, performance-oracle,
architecture-strategist (oś code-quality), spec-compliance-reviewer, feature-tester-e2e (`dev-docs-review-wf.js:362-368, 902-929`) i trzy buildery
(`dev-docs-execute-wf.js:233-240`). `dev-autopilot-wf.js` ma 19 wywołań `agent()` bez `agentType`; correctness idzie jako `general-purpose` (:365),
test-coverage bez `agentType` (:904); sceptycy, packager, dedup, scribe, fix — bez pliku. `agent()` w Workflow przyjmuje tylko `label, phase, schema,
model, effort, isolation, agentType` (workflow-authoring reference) — **nie ma opcji `tools:`/`omitClaudeMd`**, więc allowlista dla ~24 ról = ~24 nowe
pliki agentów. To jest koszt wdrożenia (L17), nie zmiana dźwigni.

**Przeliczenie (arytmetyka na liczbach zmierzonych w POMIARY §1; szacunek, nie pomiar):**

| rola (na fazę ~35 agentów) | konfiguracja docelowa wg 6a pkt 15 | start szacowany | oszczędność vs 62,0k |
|---|---|---|---|
| mechaniczne (~15: bootstrap, stan:zapis ×n, precheck, env-up/down, telemetria, packager, dedup, scribe, kontekst:diff) | `tools:` + `omitClaudeMd` | 4,5k (zmierzone) | 57,5k |
| reviewerzy, sceptycy, fix:kontrola (~14) | `tools:` + CLAUDE.md 20,6k zn (~6k tok) + coding-rules (~3k) + wycinek 1–2k | ~15–16k | ~46k |
| buildery, fix:poprawka, planner (~6) | jw. + `skills:` 7–12k | ~22–28k | ~34–40k |

Średnia ważona ≈ 49k/agent zamiast 57k → **~86% deklarowanej dźwigni**: start ~9,5% fazy zamiast ~11%, całość (start + mniejszy kontekst w turach)
**~25–35% zamiast 30–40%**. Następna zweryfikowana dźwignia (roster + mechanika review, ETAP1) to 8–10% — kolejność priorytetów panelu **nie zmienia się**.
Założenia przeliczenia: 11,6k − 4,5k = 7,1k to CLAUDE.md+reguły w kontekście workspace-template; dla oferty-online po odchudzeniu przyjąłem ~9k;
proporcja ról z HANDOFF §3 pkt 4. **Do potwierdzenia w mini-runie etapu 4 (6a pkt 16): dopisać odczyt `usage` pierwszej tury per rola — zero
dodatkowych agentów.**

**Klasyfikacja:** ryzyko-do-raportu (liczba w raporcie: 25–35%, nie 30–40%) + fakt wejściowy do panelu: „allowlista wymaga pliku agenta per rola; dziś 9 ról ma plik, ~24 nie".

### 1.2 L2 — polecenia-listy bez pomiaru, budżet instrukcji nieznany

**Zarzut (trafny):** szacunek „polecenia-listy domkną 60–70% uwag B" (ETAP1B §3) to oceny agentów z etapu 1b, bez runu. ETAP2 §0 pkt 1 (IFScale:
150 instrukcji → 84–99%, 500 → ~68%, błąd = ciche pominięcie) jest jednocześnie uzasadnieniem poleceń-list i mechanizmem ich porażki. Nikt nie policzył,
ile instrukcji niesie dziś jeden reviewer: prompt osi (security-sentinel 191 linii wg krytyka), fokus z workflowu (code-quality = trzy osie w jednym
stringu, `dev-docs-review-wf.js:364`), bloki wspólne `reviewerPrompt()`, CLAUDE.md, coding-rules (14 sekcji), u builderów treść `skills:`.
Mini-run 6a pkt 16 testuje dotarcie JEDNEGO markera, nie wykonanie trzydziestej instrukcji.

**Dlaczego nie blokuje:** skuteczność poleceń-list da się zmierzyć dopiero PO ich wdrożeniu (PR z warstwy walidacji/migracji vs PR 2, 4, 9 — ETAP1B §3),
czyli po panelu. Panel nie może czekać na wynik implementacji własnego projektu. Budżet instrukcji natomiast jest do policzenia skryptem przed panelem (D2).
Panel dostaje polecenia-listy jako **założenie z warunkiem odwrotu** (wzór: ETAP1 §1 performance — „>1 P1/P2 klasy X od bota na 5 faz przywraca oś")
i z twardym budżetem instrukcji na agenta wynikającym z D2.

**Klasyfikacja:** ryzyko-do-raportu + domknięcie D2 przed panelem + warunek odwrotu jako wymóg dla każdego z trzech projektów.

### 1.3 L3 — atrybucja nowych findingów po fixie tylko po lokalizacji pliku

**Zarzut (trafny, podtrzymany):** POMIARY §4 klasyfikuje „nowe w plikach zmienionych 17/19" (9b f4) i na tej podstawie rozstrzyga „to NIE jest niezbieganie —
to review kodu naprawczego". Ale fix dotknął 23 plików tej samej fazy, więc „w pliku zmienionym fixem" nie odróżnia (a) defektu wprowadzonego przez fix
od (b) defektu, który był w rundzie 1 i nie został znaleziony. Przegląd runów (§7 rek. 6) prosił dokładnie o to rozróżnienie. W dwóch pozostałych parach
(samodzielna f3 run 2/3) tylko 7/14 i 6/14 nowych leży w plikach zmienionych — połowa jest w kodzie nietkniętym, czyli składnik „przeoczone" na pewno istnieje.
POMIARY §5 pkt 3 oddaje panelowi wybór „n=3 próbek vs jedna runda z lepszym sceptykiem" na podstawie tego podziału; jeśli podział jest odwrotny,
panel wybierze odwrotnie.

**Dlaczego blokuje i jak się zamyka:** fakt jest tani — 33 findingi (19 z 9b f4, 14 z samodzielnej f3 run 2), każdy do przypisania do jednej z trzech klas
z linią kodu jako dowodem: (1) wprowadzony commitem fixa (linia jest w diffie fixa), (2) istniał przed fixem w tym samym pliku, (3) kod nietknięty.
Dane: `dane/findingi-per-os/`, commity fixów w oferty-online (sha z `dane/pomiar4-powtorki-review.json`). Skrypt + czytanie w sesji głównej, ~1 h. To D1.
Uwaga: **6a pkt 15 wycofało „lekką rundę correctness po fixie"** (zamiast tego polecenia-listy w `fix:kontrola`), więc D1 rozstrzyga już tylko składnik
„niestabilność" (n=3 vs sceptyk), nie architekturę pętli fix.

**Klasyfikacja:** blokuje-panel → domknięcie D1.

### 1.4 L4 — dwa mandaty dla osi test-coverage

**Zarzut (trafny):** ETAP2 §2 wiersz test-coverage: „PRZED agentem stoją: @vitest/eslint-plugin → vitest --typecheck (expectTypeOf) → Stryker diff-scoped (…)
agent tylko na „luka pokrycia / strażnik negatywny" — kandydat do scalenia z correctness". POMIARY §2: warstwa 1 na klasie test-niefalsyfikowalny **0/31**;
§5 pkt 4: Stryker na atrapach i Zod **niezmierzony**; §2: „ile osi można skasować: zero dodatkowych". Oś dała 202 potwierdzone findingi (HANDOFF §3 pkt 7:
7/81/114). Panel dostaje jednocześnie „zdegraduj" i „nie kasuj".

**Rozstrzygnięcie precedensem (do potwierdzenia przez operatora — D4):** POMIARY jest późniejsze niż ETAP2 i było pomyślane jako warunek wejścia do etapu 4
(ETAP2 §3). Degradacja z ETAP2 była warunkowa („trzy warstwy przejmą klasę") i straciła przesłankę: jedyna zmierzona warstwa trafia 0/31, dwie pozostałe
nie mają pomiaru. Zapis obowiązujący dla panelu: **test-coverage ZOSTAJE jako oś** (z kryterium falsyfikowalności z ETAP1); trzy warstwy mechaniczne
to DODATKI z wynikiem do buildera (ETAP2 §0 pkt 5), a scalenie z correctness jest **opcją wariantu** wyłącznie z warunkiem odwrotu i po pomiarze warstw 2–3
na plikach testowych z tych 31 uwag (pomiar po wdrożeniu warstw, nie przed panelem). Nie jest to nowa decyzja, tylko odczyt kolejności — ale dotyczy osi
z największą liczbą findingów, więc operator ma to potwierdzić jednym zdaniem.

**Klasyfikacja:** blokuje-panel → domknięcie D4 (słowo operatora), bez pomiaru.

## 2. Pozostałe 15 luk (L5–L19) — klasyfikacja sesji głównej

Pełne opisy, dowody i „co by musiało się stać" są w `dane/etap3-krytyk/krytyk-kompletnosci.txt`. Tu tylko rozstrzygnięcie i gdzie luka ląduje.

| id | element | sedno | ocena | gdzie ląduje |
|---|---|---|---|---|
| L5 | kontekst agentów, Read vs Bash | POMIARY §5 pkt 1 („każdy agent `omitClaudeMd`, buildery czytają Read") vs 6a pkt 15 („bypass zostaje, CLAUDE.md trafia do builderów"); HANDOFF §5 hip. 7 (Read zamiast Bash) nadal w pakiecie dla projektantów | ryzyko | **precedens: 6a pkt 15 (późniejsze, „decyzje po pomiarach") nadpisuje POMIARY §5 pkt 1 i hipotezę 7** — zapis w pakiecie wejściowym panelu (D4) |
| L6 | verify-sceptycy | sceptyk asymetryczny przyjęty z literatury (63–83% kill); nasze obalenia to trzy liczby (12% / 19,2% / 10,9%), `obalone_n` per oś = artefakt; kill rate na naszych findingach niezmierzony | ryzyko | raport (niepewność: sceptyk 79% przy naszych 10–19% może kasować prawdziwe P1/P2) + pomiar po wdrożeniu (archiwalne findingi o znanych werdyktach) |
| L7 | model kosztu (etap 0) | udziały per etap fazy z oferty-online BEZ N1–N9; jedyny run na aktualnej maszynerii = 1 faza bez E2E | ryzyko | raport: liczby „przed" opisują maszynerię sprzed N1–N9; N1–N9 nie zmieniały liczby agentów na fazę (raportowanie/stan/formaty), więc udziały prawdopodobnie stoją — do zaznaczenia |
| L8 | pomiar 1b | −50k to konto z ~900 narzędziami MCP; czyste repo: 44,3k → 4,2k; higiena konta (osobny etap) skonsumuje część tej samej oszczędności | ryzyko | raport: −50k podać jako „konto z pełnym MCP"; w §1.1 uwzględnione pośrednio (kierunek stoi, wielkość zależy od konta) |
| L9 | pomiar 2 | 97 z 200 uwag B (103 bez linii), dopasowanie ±3 linie; reguły ERROR odpaliły 49/8/6/4 razy w tych samych plikach i nie liczą się jako trafienia | ryzyko | raport: „1/97" podawać z metodą i pokryciem; wniosek jest zachowawczy (nie kasować osi), więc błąd nieodwracalny nie grozi |
| L10 | performance ZASTĄP, security odchudzone | oba stoją na `supabase db advisors`, niezmierzonym (Docker off, 6a pkt 17: „zmierzymy przy wdrożeniu bramki"); size-limit 0 trafień w szablonie | ryzyko | panel dostaje to jako założenie z warunkiem odwrotu (już zapisany w ETAP1 §1) |
| L11 | oś e2e, env-up/down | jedyny element bez zamiennika, źródło prawie wszystkich STOP-ów i ~1,2 M tokenów powtórek; 3 rekomendacje z przeglądu runów (parametryzacja E2E, katalog zadania jako własne artefakty, kategoria przyczyny SKIP) nie weszły do żadnej decyzji | ryzyko | **wejście do panelu:** każdy projekt ma pokazać, co robi ze STOP-ami E2E; parametryzacja E2E (HANDOFF §5 hip. 9) na listę zmian szablonu |
| L12 | słownik klas | nie istnieje jako lista; ETAP1 §3 „cykl życia i współbieżność UI" (20) vs ETAP1B §3 „cykl życia React" (11) + „wyścigi" (6); 6a pkt 17 „zamknięty słownik" dotyczy learned-patterns, nie uwag bota ani dossier | ryzyko | raport + wdrożenie: jedna lista nazw z odwzorowaniem ETAP1↔ETAP1B; decyzja, czy jeden słownik obsługuje 3 zastosowania — to jest praca implementacyjna, nie panelowa |
| L13 | /bugfix | połowa zadeklarowanej miary jakości (HANDOFF §1), zero danych, zero wystąpień w rozstrzygnięciach; skill nie zinwentaryzowany | ryzyko | raport: miara jakości = dziś tylko CodeRabbit; /bugfix do zliczenia przy pierwszym pomiarze po wdrożeniu (git/Sentry oferty-online) |
| L14 | inwentarz poza rdzeniem | 8 agentów niewołanych z workflowów (2 martwe: kieran-typescript-reviewer, code-simplicity-reviewer — 0 odwołań w skillach i workflowach), dev-ideate/dev-brainstorm/dev-docs-update, skill code-review (drugi roster), freshness-audit (mechanizm „czy reviewer aktualny" — nieużyty), 2 hooki Stop, templates/, 74 testy workflowów | ryzyko | **wejście do panelu:** lista elementów, które projekt „po" musi albo objąć, albo jawnie zostawić; martwe agenty → lista zmian szablonu |
| L15 | mapa oś → plik → prompt | code-quality = `architecture-strategist.md` + fokus w workflowie; correctness i test-coverage bez pliku (start 62k) | ryzyko | domknięcie D3 (tabela, 20 min grep) — bez niej „odchudź prompt o połowę" jest niejednoznaczne |
| L16 | miara sukcesu | „P1/P2 od bota po 5 zadaniach" spadła 12,8 → 5,2/100 plików bez zmiany pipeline'u (charakter kodu); brak protokołu stratyfikacji | ryzyko | raport jako ograniczenie; baseline per typ kodu (walidacja/migracje, UI, integracje) policzyć przy pierwszym pomiarze po wdrożeniu |
| L17 | kryteria panelu | koszt i ryzyko wdrożenia nie są wymiarem sędziów (autopilot-wf 120 kB, review-wf 97 kB, 74 testy, ~24 nowe pliki agentów, 188 zastanych błędów ESLint) | ryzyko | **propozycja dla operatora:** dodać sędziom wymiar „koszt wdrożenia i utrzymania jednoosobowego" (§7) |
| L18 | packager/dossier | ETAP1: bilans ujemny, jedyny pomiar przeciwny tezie (Bash reviewerów 10,5 → 23); ETAP2: „routing w JS, agent znika" z literatury; pomiar mandatu dossier nie był warunkiem wejścia | ryzyko | raport; kierunek tani i odwracalny; pomiar tur Bash/Read z dossier i bez na tej samej wersji maszynerii — po wdrożeniu |
| L19 | coderabbit-setup | 8 zmian `.coderabbit.yaml` zapisane dla oferty-online, a progi 300/50 siedzą w `.claude/skills/coderabbit-setup/templates/coderabbit-base.yaml:54-55` (zweryfikowane) | ryzyko | **lista zmian szablonu** (nie panel): przenieść 8 zmian do generatora; 10 min |

## 3. Odpowiedzi na pięć pytań z ETAP2 §6

1. **Czy 4 pomiary wystarczają i są dobrze zdefiniowane?** Pomiar 3 (czasy) — tak, z dwiema dziurami (advisors, Stryker ekstrapolowany z 3 plików).
   Pomiar 1 — metodologicznie najmocniejszy (17 scenariuszy z markerami), ale liczba −50k jest funkcją konta (L8) i nie obejmuje ról bez pliku (L1).
   Pomiar 2 — 97/200 i ±3 linie: mówi o metodzie tyle co o bramkach (L9). Pomiar 4 — 6 par, 3 na zmienionym kodzie, atrybucja po pliku (L3).
   Brakujące pomiary warunkujące podjęte decyzje: polecenia-listy (L2), kill rate sceptyka (L6), advisors (L10) — wszystkie trzy mierzalne dopiero po wdrożeniu.
2. **E2E, seed vs migracja, spec-compliance:** research potwierdził brak zamiennika i się zatrzymał. E2E to najpoważniejsza luka (L11). Seed vs migracja:
   `migrations.sum` pilnuje edycji wypchniętej migracji, nie zgodności seeda z kontraktem — klasa bez narzędzia i bez pomiaru. Spec-compliance: ZOSTAW,
   waga na poleceniach-listach (L2); nierozstrzygnięte z etapu 1, czy oś ma działać tylko na fazach z kodem (27% jej wyjścia to `.md`, których bot nie ocenia).
3. **Słownik klas:** nie jest domknięty ani spójny (L12); to trzy słowniki traktowane jak jeden (uwagi bota / learned-patterns / dossier ucieczek).
4. **Atrybucja obaleń per oś:** brak potwierdzony i głębszy — trzy różne liczby globalne, `obalone_n` = artefakt (L6). Sceptyk asymetryczny będzie stosowany
   jednakowo do wszystkich osi z siłą z literatury.
5. **Czy polecenia-listy wpadną w próg IFScale?** Nie wiadomo, bo nikt nie policzył instrukcji per reviewer; „4–5 poleceń na oś" to nie jest liczba,
   którą agent dostaje (L2). D2 to zamyka.

## 4. Tezy całej analizy stojące na jednym filarze (do raportu jako lista założeń)

| teza | filar | co się sypie, jeśli fałszywa | luki |
|---|---|---|---|
| kontekst startowy = 30–40% kosztu fazy | POMIARY §1 (jedno konto, jedno repo) + arytmetyka §5 | kolejność priorytetów — **po przeliczeniu §1.1: 25–35%, kolejność stoi** | L1, L8 |
| polecenia-listy domkną 60–70% uwag B | ETAP1B §3 — oceny agentów, zero runów | cała strona jakościowa projektu „po": pipeline tańszy i gorszy naraz | L2, L12 |
| nowe findingi po fixie = review kodu naprawczego | POMIARY §4 — 3 pary, atrybucja po pliku | wybór n=3 vs sceptyk; „po STOP-ie E2E sam tester" | L3, L6 |
| bramki nie kasują żadnej dodatkowej osi | POMIARY §2 — jedna konfiguracja, ±3 linie, 97/200 | panel utrzyma oś zastępowalną bramką albo raport poda zły powód przewagi bota | L9, L4 |
| test-coverage do zdegradowania (3 warstwy) | ETAP2 §0 pkt 5 — research; jedyny pomiar 0/31 | utrata 202 findingów, klasa „test niefalsyfikowalny" (31) bez właściciela | L4 |
| sceptyk asymetryczny ~4× skuteczniejszy | 2 prace zewnętrzne, zero pomiaru u nas | brak wzmocnienia jednej rundy albo kasowanie prawdziwych P1/P2 | L6, L3 |
| model kosztu opisuje dzisiejszy szablon | HANDOFF §3 — oferty-online bez N1–N9 | liczby „przed" bez punktu odniesienia dla „po" | L7 |

## 5. Elementy inwentarza nietknięte przez żaden etap (wejście do panelu jako lista „objąć albo jawnie zostawić")

Zweryfikowane grepem w tej sesji (`.claude/workflows/*.js` bez `__tests__`, `.claude/skills/**`):

- **Agenci bez odwołań w workflowach (8):** best-practices-researcher, framework-docs-researcher, learnings-researcher, repo-research-analyst, spec-flow-analyzer,
  web-research-specialist (wołane ze skilli dev-plan/dev-ideate — 1–3 odwołania każdy); **kieran-typescript-reviewer, code-simplicity-reviewer — 0 odwołań
  nigdzie (martwe po scaleniu trzech osi w code-quality, komentarz `dev-docs-review-wf.js:351-359`)**. Wchodzą do zdania „żaden z 16 agentów nie ma `tools:`".
- **Oś code-quality = `architecture-strategist.md` + fokus w workflowie** (:364) — prompt żyje w dwóch miejscach; correctness (`general-purpose`, :365) i test-coverage (:904) bez pliku.
- **Skille dev-ideate (403 linie), dev-brainstorm (344), dev-docs-update (107)** — 0 wystąpień w rozstrzygnięciach; dev-docs-update nakłada się na bootstrap stanu autopilota.
- **Skill code-review** — drugi, niezależny roster review poza pipeline'em; po przeprojektowaniu osi zostanie ze starym.
- **Skill bugfix** — połowa miary jakości, zero danych (L13).
- **freshness-audit (skill + `freshness-audit-wf.js` 16 kB)** — gotowy mechanizm na pytanie operatora „czy reviewer jest aktualny", nieużyty i nieoceniony.
- **coderabbit-setup + `templates/coderabbit-base.yaml`** — źródło progów 300/50 (L19).
- **Hooki Stop** (`stop-build-check-enhanced.sh`, `error-handling-reminder.sh` w `settings.json`) — nakładają się na projektowaną bramkę domknięcia; wartość/koszt nieoceniony.
- **templates/e2e-env, templates/smoke-autopilot** — parametryzacja E2E dotyczy `.env.e2e.example` stąd; smoke-autopilot to jedyny scenariusz testowy maszynerii.
- **`.claude/workflows/__tests__/` (7 plików, 74 testy)** — przypinają dzisiejsze zachowanie; każdy projekt panelu je łamie (L17).
- **Skille w `skills:` builderów** (supabase-dev-guidelines, tailwind-react-guidelines, ux-ui-guidelines, security, sentry-integration, figma-design-to-code, agent-browser) —
  zostają wg 6a pkt 15, treść nieoceniona pod kątem aktualności ani stosowania; mini-run 6a pkt 16 (c) to sprawdza.
- **Role bez pliku definicji (~24 wywołania `agent()`)** — nośnik allowlisty `tools:` nie istnieje (§1.1).
- (poza zakresem panelu) `settings.json` `enabledPlugins dev-browser=true` vs `settings.local.json=false`; statusLine z `npx -y ...@latest` — do etapu higieny konta.

## 6. Sprzeczności rozstrzygnięte precedensem (do wpisania w pakiet wejściowy panelu)

1. **omitClaudeMd i Read/Bash (L5):** obowiązuje 6a pkt 15. POMIARY §5 pkt 1 („każdy agent `omitClaudeMd`", „buildery czytają Read") i HANDOFF §5 hipoteza 7
   są NIEAKTUALNE dla builderów i reviewerów. Reguły `paths:` = bonus, nie kanał dostawy.
2. **test-coverage (L4):** obowiązuje POMIARY §2 („zero dodatkowych osi") nad ETAP2 §2 (degradacja) — czeka na potwierdzenie operatora (D4).
3. **lekka runda correctness po fixie:** POMIARY §4 ją proponuje, 6a pkt 15 ją wycofuje na rzecz poleceń-list w `fix:kontrola` — obowiązuje 6a pkt 15.

## 7. Co idzie dalej

**Domknięcia PRZED panelem (zero agentów, sesja główna + skrypty; łącznie ~2 h):**

- **D1 (zamyka L3, ~1 h):** klasyfikacja 33 findingów powtórek po fixie (9b f4: 19; samodzielna f3 run 2: 14) na trzy klasy z linią kodu jako dowodem.
  Dane: `dane/findingi-per-os/`, sha z `dane/pomiar4-powtorki-review.json`, `git show` commitów fixa w oferty-online. Wynik: `dane/pomiar5-atrybucja-po-fixie.json` + dopisek do POMIARY §4.
- **D2 (zamyka budżetową część L2, ~30 min):** skrypt zliczający instrukcje faktycznie podane jednemu reviewerowi i jednemu builderowi dziś
  (plik agenta + fokus + bloki wspólne z `reviewerPrompt()` + CLAUDE.md oferty-online + coding-rules + `skills:`) — jedna liczba per rola, porównana z progami IFScale (10/150/500).
- **D3 (zamyka L15 i L1b, ~20 min):** tabela oś → `agentType` → plik agenta lub brak → miejsce promptu → start dziś; lista ~24 ról bez pliku.
- **D4 (słowo operatora, 0 min):** potwierdzenie precedensów z §6 pkt 1–3, w szczególności test-coverage.

**Wyniki domknięć (2026-09-21):**

- **D1 (L3) GOTOWE** — `dane/pomiar5-atrybucja-po-fixie.{json,txt}`, dopisek w POMIARY §4: 33 findingi = A urodzone w fixie 13 (39%, wszystkie kodowe to skutek
  naprawy findingu rundy 1, w tym jedyny P1; kontrola diffu nie złapała żadnego) / B przeoczone w rundzie 1 w pliku fixa 14 (42%, 5 P2) / C przeoczone w kodzie
  nietkniętym 6 (18%). Składnik recall rundy 1 (60%) jest większy niż składnik „nowy kod" (40%).
- **D2 (L2) GOTOWE** — `skrypty/d2_budzet_instrukcji.py`, `dane/pomiar6-budzet-instrukcji.{json,txt}`. Jednostka = pozycja listy albo zdanie z markerem nakazu.
  Dziś (oferty-online): **reviewer security ~365 instrukcji** (dolna granica 319), z tego plik agenta 104, coding-rules 117, CLAUDE.md 46, learned-patterns 38 **×2**
  (eager z `.claude/rules/` ORAZ w całości w dossier — packager przepisuje go ponownie), bloki workflow 22; **builder danych ~537** (dolna 490): iu.prompt od plannera
  97 (mediana 16,9k zn), trzy skille `skills:` 178, coding-rules 117, plik agenta 49, CLAUDE.md 46, learned-patterns 38. Reguły learned-patterns są wielozdaniowe
  (211 nakazów w 37 pozycjach, 5,7 na regułę), więc górna granica to **reviewer ~650–710, builder ~710**. Po 6a pkt 15/17 (learned-patterns → wycinek ~20 nakazów):
  **reviewer ~310–320, builder ~520–530**. Największe bloki po zmianie: coding-rules 117–130, skille buildera 178, plik agenta security 104, iu.prompt 97.
  **Wniosek dla panelu:** nawet po decyzjach każdy agent siedzi w paśmie IFScale 150–500 (84–99% → ~68%), a builder przy górnej krawędzi; polecenia-listy
  (4–5 na oś) są marginalne wobec tła — budżet instrukcji musi być projektowany jako CAŁOŚĆ na rolę (cel: <150), inaczej listy dołożone do 300–500 istniejących
  nakazów nie mają lepszych szans niż reguły, które zastępują. Dubel learned-patterns w dossier = 13k tokenów × 6 reviewerów na fazę za nic.

**Dodatkowe wejścia do panelu (poza ETAP2 §6 i POMIARY §5):**

- polecenia-listy jako założenie z **warunkiem odwrotu** w każdym projekcie + twardy budżet instrukcji per rola (z D2);
- allowlista `tools:` wymaga pliku agenta per rola (~24 nowe pliki) — koszt wdrożenia, nie dźwignia;
- dźwignia kontekstu: **25–35%**, nie 30–40%;
- E2E: każdy projekt mówi, co robi ze STOP-ami E2E (3 rekomendacje z przeglądu runów);
- lista elementów nietkniętych (§5): objąć albo jawnie zostawić;
- **propozycja dla operatora (L17):** sędziowie dostają czwarty wymiar — koszt wdrożenia i utrzymania jednoosobowego (pliki, testy `__tests__`, nowe agenty).

**Do raportu etapu 5 jako jawne ograniczenia:** L6, L7, L8, L9, L10, L13, L16, L18 + tabela tez z §4.

**Na listę zmian szablonu (poza panelem):** L19 (coderabbit-base.yaml), martwe agenty (L14), parametryzacja E2E (L11).

## 8. Ograniczenia etapu 3

- Jeden krytyk, bez sceptyka na krytyka — jego oceny „blokuje" zweryfikowałem sam względem dokumentów i kodu (grep), nie drugim agentem.
- Krytyk nie czytał `dane/`; luki typu „dowód nie wspiera wniosku" (L1, L7, L18) mogą mieć odpowiedź w surowych danych — D1 i D2 to sprawdzą dla najważniejszych.
- Przeliczenie w §1.1 to arytmetyka na zmierzonych liczbach z założeniem o proporcji ról; nie jest pomiarem.
- Krytyk odpowiedział na wszystkie 5 pytań z ETAP2 §6 i wypisał 19 luk; nie wypisał żadnej luki w etapie 0 poza L7 — model kosztu (2 941 agentów, 13 runów) uznał za solidny.

# PANEL-WEJSCIE — pakiet wejściowy panelu etapu 4

**Data:** 2026-09-21 (domknięcie D4). **Charakter:** sama kompilacja — każdy zapis ma źródło w HANDOFF.md (6a), ETAP1/1B/2/3 albo POMIARY;
ten plik NIE wprowadza żadnej nowej decyzji. Gdy dwa dokumenty mówią co innego, obowiązuje precedens z §1. Sekcja §12 (telemetria) dochodzi w D5.
**Dla kogo:** dla 3 projektantów, 3 sędziów, sceptyka i syntezy w panelu etapu 4 — jako jedyny plik „co obowiązuje", zamiast czytania pięciu rozstrzygnięć.

## 0. Co robi panel i kto co czyta

- **Skład (HANDOFF §2 wiersz 4, §6 pkt 5):** 3 niezależne projekty pipeline'u „po" — **minimalistyczny** (minimalny koszt), **jakość-najpierw**
  (maksymalna jakość), **hybrydowy** — → 3 sędziów → sceptyk (adwersarialna krytyka) na zwycięzcę → synteza. ~8 agentów, wszyscy `model: 'opus'`;
  synteza w sesji głównej na Fable. Wnioski dotyczą szablonu (workspace-template), nie jednego projektu (HANDOFF §1).
- **Każdy projektant dostaje:** ten plik + `dane/dane-digest.md` (model kosztu) + `ETAP1-ROZSTRZYGNIECIE.md` (werdykty osi po kontrach) +
  `ETAP2-ROZSTRZYGNIECIE.md` (mapa researchu) + hipotezy §5 tego pliku, każdy z innym priorytetem. NIE dostaje werdyktów workflow-A (HANDOFF §4, dane v1, zawyżone ~2×).
- **Sędziowie (HANDOFF §1, 6a pkt 18 L17):** wymiary = koszt (o ile pipeline „dostarcza kod dobrze wykonany") i jakość = P1/P2 od CodeRabbit PO naszym
  review (+ Sentry po wdrożeniu; /bugfix wypada z miary — L13). **Koszt i ryzyko wdrożenia NIE są kryterium** (propozycja czwartego wymiaru WYCOFANA; wdrożenie fazowe wg planu etapu 5).
- **Nie jest wariantem:** szablon jako plugin (6a pkt 13 — zbadany, odłożony; co najwyżej wzmianka „opcja na przyszłość").
- **Przed panelem, w etapie 4:** mini-run z 6a pkt 16 (§11 tego pliku). Start panelu wyłącznie na znak operatora, po D5 i rozmowie.

## 1. Precedensy — co obowiązuje, gdy dokumenty się rozjeżdżają (ETAP3 §6, potwierdzone 6a pkt 18)

1. **Kontekst agentów, Read vs Bash — WERSJA B (6a pkt 15, potwierdzona 2026-09-21):** CLAUDE.md projektu (po odchudzeniu, 20,6k zn) TRAFIA do builderów
   i reviewerów; `omitClaudeMd: true` tylko u agentów mechanicznych nie patrzących na kod (stan:zapis, telemetria, dedup, precheck, kontekst:diff);
   tryb bypass i czytanie Bashem (`cat`/`sed -n`) ZOSTAJĄ; reguły `paths:` = bonus, nie kanał dostawy. **NIEAKTUALNE:** POMIARY §5 pkt 1
   („każdy agent `omitClaudeMd`", „buildery czytają Read") i HANDOFF §5 hipoteza 7 (Read zamiast Bash).
2. **Oś test-coverage ZOSTAJE (operator 2026-09-21, L4):** obowiązuje POMIARY §2 („zero dodatkowych osi do skasowania") nad ETAP2 §2 (degradacja).
   Kryterium falsyfikowalności z ETAP1; trzy warstwy mechaniczne (`@vitest/eslint-plugin` → `vitest --typecheck` z `expectTypeOf` → Stryker diff-scoped) to DODATKI z wynikiem
   do buildera (ETAP2 §0 pkt 5), nie zamiennik. Scalenie z correctness = wyłącznie opcja wariantu, z warunkiem odwrotu i PO pomiarze warstw 2–3 na 31 uwagach klasy „test niefalsyfikowalny".
3. **Brak lekkiej rundy correctness po fixie:** POMIARY §5 pkt 3 ją proponował, 6a pkt 15 ją wycofuje na rzecz poleceń-list correctness w `fix:kontrola`
   (ten sam 1 agent, ten sam cykl). Obowiązuje 6a pkt 15.
4. **Dźwignia kontekstu startowego = 25–35% kosztu fazy, nie 30–40%** (ETAP3 §1.1, przeliczenie dla konfiguracji z pkt 1; szacunek do potwierdzenia
   odczytem `usage` w mini-runie). Kolejność priorytetów bez zmian: kontekst > roster + mechanika review (8–10%, ETAP1).
5. **Model kosztu (etap 0) opisuje oferty-online BEZ napraw N1–N9 (L7):** operator — niska waga; do raportu jako uwaga, nie ryzyko. N1–N9 nie zmieniały liczby agentów na fazę.
6. **STOP E2E ze środowiska / limitu zewnętrznego → [MANUAL], run idzie dalej (operator 2026-09-21, po D4):** obowiązuje 6a pkt 18 L11. **NIEAKTUALNY:** zapis ETAP1
   „powtórka po STOP-ie E2E = sam tester" (i HANDOFF §5 hipoteza 4) — traci przedmiot, bo taki STOP nie zatrzymuje runu, więc nie ma po nim żadnej powtórki review.

## 2. Twarde wymogi KAŻDEGO z trzech projektów (6a pkt 15–18; brak któregoś = projekt niekompletny)

1. **Allowlista `tools:` u wszystkich agentów pipeline'u** (−50k tokenów startu na agenta na koncie z pełnym MCP; 498/514 agentów nie wołało MCP — 6a pkt 15).
   Nośnik: **pliki agentów PER KLASA ROLI** jako domyślne (mechaniczny-haiku / orkiestracyjny-opus / reviewer / sceptyk / naprawiacz z Edit + skille),
   per rola tylko jako wyjątek — istniejące 8 plików (4 reviewerów, tester E2E, 3 buildery). Docelowo kilkanaście plików zamiast ~40 (6a pkt 18 po D3).
   Powód: `agent()` w Workflow nie ma opcji `tools:`/`omitClaudeMd`, a prompty 36 ról bez pliku są dynamiczne (JS), więc plik niesie wyłącznie ustawienia.
   MCP: `disallowedTools: mcp__*` dla reszty; Figma tylko builder UI / fullstack / tester E2E gdy zadanie ma `figma_screens`; Supabase MCP tylko w sesji głównej (6a pkt 10).
2. **Kontekst per klasa roli wg §1 pkt 1** (CLAUDE.md u builderów/reviewerów, `omitClaudeMd` mechaniczne, bypass zostaje) + `skills:` u builderów ZOSTAJE (7–12k tok/agent; dobór per IU niewart logiki).
3. **Budżet instrukcji w TRZECH WARSTWACH (6a pkt 18 po D2):** (1) warstwa STAŁA na rolę (mandat, kilkanaście poleceń-list, format wyniku, bloki workflowu)
   **<150 instrukcji**, liczona skryptem metodą `skrypty/d2_budzet_instrukcji.py` jako TEST szablonu w `.claude/workflows/__tests__` (pada przy edycji promptu)
   + w sync-template/doctor; **w runie zero STOP-ów**, co najwyżej liczba w telemetrii; (2) warstwa REFERENCYJNA bez limitu, podzielona po warstwie kodu
   i temacie (reguły zachowaniowe coding-rules, checklisty skilli buildera, wpisy learned-patterns), **doklejana przez orkiestrator po plikach jednostki**
   (nie „agent sam sięgnie" — ETAP1 45/68 ucieczek miało regułę); (3) warstwa MECHANICZNA (ESLint/knip/advisors) znika z tekstu. Skille buildera dzielone
   na stałą/referencyjną, nie skracane. Odrzucone: czyste wycinanie, czysty model skillowy.
4. **learned-patterns (6a pkt 15, 17):** trzy poziomy — (0) jedna linia w CLAUDE.md, (1) `docs/learned-patterns.md` = indeks GENEROWANY przez dev-compound-refresh
   z nagłówków solutions (klasa | reguła 2 zdania | wzorce plików | waga | link), (2) `docs/solutions/*.md` z frontmatterem klasa/reguła/paths/waga jako jedyne źródło prawdy. Plik wychodzi
   z `.claude/rules/` (koniec ładowania eager). Orkiestrator wkleja builderowi I reviewerowi tylko wpisy pasujące do katalogów IU (1–2k zn); dev-plan czyta indeks.
   8 zabezpieczeń PRZYJĘTYCH: walidacja globów; zamknięty słownik klas w szablonie; koszyk „zawsze" z twardym limitem w JS; walidacja frontmatteru w JS
   (compound odmawia zapisu bez pól); ten sam wycinek do reviewerów przez dossier; data + źródło + licznik ucieczek per wpis; jednorazowa konwersja 49k zn
   skryptem z listą odrzutów; dopasowanie po katalogach, nie nazwach. Plus bramka „zielony main" w bootstrapie autopilota. Żaden skill nie dopisuje do CLAUDE.md (6a pkt 1).
5. **Telemetria centralna, mechaniczna, ZERO agentów (6a pkt 18):** skrypt po zakończeniu runu czyta `journal.jsonl` + transkrypty (`usage`) i dopisuje
   jeden rekord per agent/faza do globalnego JSONL + skrypt raportu miesięcznego. Pełny cennik (cache read/write/output), nie sam output. Rekord: §12 (D5).
6. **E2E → [MANUAL] zamiast STOP (6a pkt 18 L11):** test niewykonalny przez środowisko / limit zewnętrzny = checkbox przechodzi na [MANUAL] z powodem, run idzie dalej.
   Każdy projekt mówi wprost, co robi ze STOP-ami E2E i z 3 rekomendacjami z `../2026-09-19-przeglad-runow-po-naprawie.md` (parametryzacja E2E z `.env.e2e`,
   katalog zadania jako własne artefakty, kategoria przyczyny SKIP). Zapis ETAP1 „powtórka po STOP-ie E2E = sam tester" NIEAKTUALNY (§1 pkt 6).
7. **Sceptyk asymetryczny (6a pkt 17):** verify dostaje sam zarzut (plik:linia + teza) BEZ uzasadnienia autora; odpowiada AGREE / DISAGREE_EVIDENCE
   (musi wskazać linię kodu lub test) / DISAGREE_CONCERN (nie kasuje, obniża wagę); dla P1 naprawa zawiera test padający przed poprawką. Stosowany jednakowo do wszystkich osi.
8. **Security WARUNKOWE po profilu stacku (6a pkt 6, 18):** profil z package.json + katalogów w dossier KAŻDEGO reviewera. Projekt z `supabase/` → bramka advisors
   **przez Management API / Supabase MCP `get_advisors` na projekcie chmurowym** (Supabase WYŁĄCZNIE chmurowe, ZERO Dockera) przejmuje RLS/search_path/auth.users,
   a security dostaje „nie sprawdzaj tego, robi to advisors"; projekt bez Supabase → security zachowuje polecenia-listy o RLS/politykach. Reguły nie są usuwane, tylko warunkowe.
9. **Pętla fix BEZ dodatkowej rundy review (6a pkt 15):** sufit jednego cyklu w `fix:kontrola` zostaje; (1) `fix:kontrola` dostaje polecenia-listy correctness
   zawężone do diffu fixa; (2) builder fixa naprawia tylko P1/P2, P3 → known-issues/bot, zakaz zmian poza zgłoszonym miejscem; (3) reszta → CodeRabbit w dev-pr.
   Miara: P1/P2 od bota w plikach dotkniętych fixami po 5 zadaniach. NIE scalać `fix:kontrola` z `fix:poprawka` (ETAP1: 3 realne regresje złapane).
10. **Zakaz powtórek sekwencyjnych review** (ETAP2 §0: sekwencyjna szkodzi, równoległa pomaga; 1 prawdziwy defekt za 4–5 fałszywych).
11. **Polecenia-listy zamiast długich reguł** (ETAP1B §3, 6a pkt 18) — jako założenie z **warunkiem odwrotu** w każdym projekcie (§6) i w budżecie z pkt 3.

## 2a. Twarde wejścia z etapów 1, 1b, 2 i pomiarów (rozstrzygnięte przed decyzjami operatora; obowiązują, o ile §1 nie mówi inaczej)

- **ETAP1 §1, §2, §4:** roster 6 → 5 (performance ZASTĄP: size-limit w domknięciu + advisors performance + 5 linii w fokusie correctness: N+1, `for update` na hot path,
  `Promise.all` po kolekcji, `.limit()` bez `count`, pętla z fetchem); security prompt 191 → ~90 linii + warunek `plikiKodu>0`; correctness własny plik agenta, tury
  29,6 → ~20; spec-compliance: usunąć martwe odwołania w `spec-compliance-reviewer.md:49` i duplikat fokusu REVIEWERZY:368; code-quality: ESLint flat + knip
  w domknięciu, prompt z zakazem zgłaszania czegokolwiek, co łapie lint; e2e: harness → env-up, jedno źródło promptu, parametry z `.env.e2e`; stan fazy (policzony
  w JS) doklejany do promptu agenta-następcy zamiast `stan:zapis` (80 powołań haiku/23 fazy); precheck → env-up; pre-skan → ESLint; zwiń → stan:zapis; NIE scalać
  `fix:kontrola` z `fix:poprawka`; scribe review: niższy tier + krótszy prompt, nie dzielić; dedup ZOSTAW; domknięcie fazy pkt 1b (audyt error-handlingu) NIE jest
  duplikatem hooka; progi rozmiaru → bot; **PR ≤ ~150 plików jako bramka w dev-docs-complete** (222 pliki = bot odmówił recenzji). Otwarte po ETAP1: batch sceptyków (§6),
  spec tylko na fazach z kodem (27% wyjścia to `.md` poza miarą jakości). Zapis „powtórka po STOP-ie E2E = sam tester" — NIEAKTUALNY (§1 pkt 6).
- **ETAP1B §2, §3, §5:** polecenia-listy per oś — konkretne polecenia w tabeli ETAP1B §3 (correctness 4, test-coverage 3 + kolumna falsyfikowalności, security 4,
  spec 3, performance → 5. polecenie correctness o limicie czasu, e2e o seedach); **budżet pliku i rejestr stałych w plannerze** (IU wprowadzające stałą istniejącą
  w repo wskazuje jedno źródło i konsumentów); **dossier klas ucieczek u buildera** (tabela 8–10 klas z jednym zdaniem „co robić zamiast", regenerowana z compoundów);
  **bramka niezmienności migracji** (`git diff --name-only base..HEAD -- supabase/migrations/` ∩ pliki obecne w base ≠ ∅ → STOP „popraw nową migracją"; ta sama
  w kontroli diffu naprawczego); 8 zmian `.coderabbit.yaml` (→ generator, §10); 4 zmiany dev-pr (§3 pkt 2); **seedy z właścicielem** (e2e dla kontraktu z migracją,
  security dla strażników; `e2e/seeds/*.sql` bez path_instructions bota → dopisać jako granicę zaufania); słownik klas (jedna nazwa na klasę) warunkiem porównywalności następnego pomiaru.
- **ETAP2 §1, §2, §6:** zakaz powtórek sekwencyjnych (§2 pkt 10); sceptyk asymetryczny (§2 pkt 7); **pełny zestaw bramek domknięcia fazy:** `eslint.config.ts`
  (ESLint 10 flat, `recommendedTypeChecked` error, `strictTypeChecked` warn, `max-lines` 360/60 ze skip*, `import-x/order`, `no-empty`, `no-floating-promises`,
  `react-hooks` v6+ z regułami kompilatora) + knip + size-limit + `vitest --typecheck` + Stryker diff-scoped + `migrations.sum` (Supabase CLI nie ma checksumy migracji)
  + advisors (na chmurze, §2 pkt 8); correctness wzmocniony mechanicznie (`no-floating-promises`, `react-hooks` set-state-in-effect/refs/purity) dla 2 największych
  klas B; przy React Compilerze „brak useMemo/useCallback" NIE jest findingiem; trzy warstwy testów niefalsyfikowalnych jako DODATKI (§1 pkt 2); packager → JS
  (założenie z warunkiem odwrotu, §6; dossier = pełne pliki dotknięte + kontrakty, BEZ zapewnień z planu fazy); dedup: rola „zagreguj i odsiej sporadyczne" ma sens
  tylko przy n równoległych próbkach; pre-skan → skasować; `migrations.sum` PRZED env-up; przepisanie coding-rules.md z tabelą USUŃ/ZMIEŃ/DODAJ/PRZENIEŚ-DO-LINTERA
  (`dane/etap2-research/research-coding-rules-2026.txt`); `claude plugin validate --strict` + `eval` jako bramka CI zmian w maszynerii (niezależnie od pluginu).
  **Wariant do rozważenia przez panel:** n=3 równoległe próbki 2–3 osi skrajnych (security, correctness+testy) zamiast 6 osi — rozstrzygać z wynikiem D1 (§4).
- **POMIARY §1–§3 (fakty, które stoją niezależnie od §1 pkt 1):** reguły `paths:` wyzwala tylko Read/Edit (nie `cat`, nie Write nowego pliku, nie `ls`) → reguła
  o nowej migracji musi być w prompcie delegacji; `omitClaudeMd` działa też dla `agent()` w Workflow; sam `disallowedTools: mcp__*` daje 39,3k (nie 11,6k) — dźwignia
  jest w `tools:`; bramki z cache ESLint + knip + size-limit ≈ 4 s + typecheck 10 s na 585 plikach; pierwsze wdrożenie ESLint = tura wyciszania 188 zastanych błędów;
  **Stryker ~2 min na 3 pliki → 5–15 min na fazę, NIE do każdego domknięcia** (kandydat: przed dev-pr lub tylko pliki testowe dotknięte w fazie); Stryker wymaga
  zielonego zestawu testów (bramka „zielony main", §2 pkt 4); pomiar 2: ESLint trafia 1/97 uwag B po linii → bramki gaszą koszyk A i zapobiegają, nie kasują osi.

## 3. Pozostałe decyzje operatora 6a pkt 1–14 obowiązujące dla projektów (jedna linia każda)

- pkt 1: aktualizacja CLAUDE.md = krok „uzgodnij z rzeczywistością" na końcu brancha z bramką rozmiaru w JS; decyzje fazowe → `docs/decisions/` + 1 linia indeksu; do usunięcia dopisywanie w dev-docs-complete:115-116 i complete-wf:160.
- pkt 11: uzgodnienie CLAUDE.md dopiero PO potwierdzonym merge'u (krok w dev-pr) + bootstrap autopilota na main sprawdza wpis w `docs/decisions/`.
- pkt 2: dev-pr PRZEBUDUJ wąsko — 4 zmiany z ETAP1B §4 (zero nowych agentów): (1) etap `zbierz` obowiązkowy w KAŻDEJ turze, `napraw` odrzuca wątki bez niego; (2) regex guarda uzasadnień bez alternatywy z backtickiem, wymagana nazwa dokumentu + 20 zn; (3) pole `rekomendacja` liczone w JS (MERGUJ / NIE MERGUJ / KOLEJNA TURA / DECYZJA OPERATORA) jako pierwszy wiersz raportu; (4) raport = tabela per tura złączona po id z `watki[]` + `propozycjeDoReviewerow` commitowane w compoundzie. Osobno: sufit 3 tur, tryb interaktywny zostaje. 8 zmian `.coderabbit.yaml` wdrożyć PRZED pomiarem dev-pr.
- pkt 4, 17: learned-patterns — format klasa → reguła (2 zdania) → Source; zamknięty słownik klas (L12: dziś trzy słowniki traktowane jak jeden — do jednej listy z odwzorowaniem ETAP1↔ETAP1B; praca wdrożeniowa, nie panelowa).
- pkt 5: coding-rules.md — poprawki (sprzeczność §3/§11, zbyt absolutne NIGDY/ZAWSZE, część do ESLint; ETAP2: §13 i §9 sprzeczne z docs); właściciel szablon, zmiany tylko z dowodem; po D2 to drugi największy blok instrukcji (117–130; większy tylko blok skilli buildera 178) → warstwa referencyjna.
- pkt 6: profil stacku w dossier + komendy-listy per technologia u istniejących reviewerów; NIE nowy agent.
- pkt 8: budżet pliku w scalonym dev-plan+dev-docs — IU podaje długość pliku, przyrost, wymiary (powody zmiany, eksporty, importy, test-lustro, 5 sekund); pęka → krok „wydziel moduł" PRZED dodaniem; ten sam próg z tolerancją 20% w ESLint i `.coderabbit.yaml` (progi rozmiaru → bot, ETAP1).
- pkt 3, 17: higiena konta (MCP/pluginy per projekt, audyt pluginów) = OSOBNY etap po raportach, poza panelem.
- pkt 12: `doctor` — mechaniczny skrypt bash, lista narzędzi WYLICZANA z projektu, wołany w sync-template / dev-prep / bootstrapie autopilota (STOP przed pierwszą fazą) + sekcja „Wymagania" w README.
- pkt 14: styl komunikacji z operatorem — problem → przyczyna → rozwiązanie → korzyść.

## 4. Wyniki domknięć D1–D3 (2026-09-21)

- **D1 (L3) — `dane/pomiar5-atrybucja-po-fixie.{json,txt}`, dopisek POMIARY §4.** 33 findingi powtórek po fixie = A urodzone w fixie 13 (39%, w tym jedyny P1;
  wszystkie 10 kodowych to skutek naprawy findingu rundy 1, kontrola diffu nie złapała żadnego) / B przeoczone w rundzie 1 w pliku fixa 14 (42%, 5 P2) / C przeoczone
  w kodzie nietkniętym 6 (18%). Składnik recall rundy 1 (60%) jest WIĘKSZY niż składnik „nowy kod" (40%) — „review kodu naprawczego" z POMIARY §4 było za mocne.
  **Dla panelu:** wybór „n=3 równoległe próbki 2–3 osi skrajnych vs jedna runda z lepszym sceptykiem" (ETAP2 §6, POMIARY §5 pkt 3) rozstrzygać na tym podziale.
- **D2 (L2) — `skrypty/d2_budzet_instrukcji.py`, `dane/pomiar6-budzet-instrukcji.{json,txt}`, ETAP3 §7.** Reviewer security dziś ~365 instrukcji (górna ~650–710:
  learned-patterns ×2 — eager z `.claude/rules/` ORAZ w dossier, 5,7 nakazu/regułę), builder danych ~537 (górna ~710; iu.prompt od plannera 97, trzy skille 178).
  Po 6a pkt 15/17 nadal reviewer ~310–320, builder ~520–530 = pasmo IFScale 150–500 (84–99% → ~68% przestrzegania). Dubel learned-patterns w dossier = 13k tok × 6 reviewerów na fazę za nic.
  **Dla panelu:** budżet projektować jako CAŁOŚĆ na rolę (cel <150), „4–5 poleceń na oś" to nie jest liczba, którą agent dostaje → wymóg §2 pkt 3.
- **D3 (L15, L1b) — `dane/d3-mapa-rol-agentow.txt`.** 45 slotów ról w 6 workflowach = 36 bez pliku agenta + 9 z plikiem (8 plików); `dev-autopilot-wf.js` 19 wywołań,
  zero `agentType`; 0/16 plików ma `tools:`. Prompt osi review żyje w DWÓCH miejscach dla 4 osi (plik + fokus w workflowie), tylko w workflowie dla correctness
  i test-coverage, a code-quality = angielski plik „architecture-strategist" + fokus z trzema osiami — „odchudź prompt o połowę" musi wskazać oba miejsca. Telemetria:
  3 klasy ról po kontekście na turę (mechaniczne haiku 86–102k, orkiestracyjne opus 119–168k, reviewerzy 193–224k, buildery 238k); sceptycy 135 wywołań/23 fazy
  = najliczniejsza rola bez pliku (naturalne miejsce na pierwszy wspólny plik klasy). **Dla panelu:** wymóg §2 pkt 1 (pliki per klasa).

## 5. Hipotezy z HANDOFF §5 — stan po decyzjach (projektant dostaje je w TEJ wersji)

| # | hipoteza (HANDOFF §5) | stan | źródło |
|---|---|---|---|
| 1 | odchudzić kontekst startowy agenta | **OBOWIĄZUJE w wersji §1 pkt 1 / §2 pkt 1–4**; dźwignia 25–35%; MCP/skille przez `tools:`; learned-patterns → wycinek od orkiestratora; dev-compound nie pisze do CLAUDE.md | 6a pkt 15, 17; ETAP3 §1.1 |
| 2 | mniej agentów na fazę (35 → ~15) | **OTWARTA dla panelu** z ustaleniami: stan w prompcie następcy, precheck → env-up, pre-skan → ESLint, zwiń → stan:zapis, NIE scalać kontroli z poprawką, scribe review niższy tier (ETAP1); telemetria = skrypt, NIE agent (nadpisuje część hipotezy o scribe); dedup ZOSTAW z rolą zależną od wyboru n próbek (ETAP2); packager → JS jako założenie z warunkiem odwrotu (ETAP2, §6) | ETAP1 §1, ETAP2 §2, 6a pkt 18 |
| 3 | roster 6 → 4–5 | **ROZSTRZYGNIĘTE w ETAP1 + L4:** performance ZASTĄP (z warunkiem odwrotu); security ZOSTAW-ODCHUDŹ (prompt 191 → ~90 linii, `plikiKodu>0`, warunkowe po stacku); correctness ZOSTAW-ODCHUDŹ + własny plik; spec-compliance ZOSTAW (otwarte: tylko fazy z kodem); code-quality ZOSTAW-ODCHUDŹ + lint (styl/progi zakazane w prompcie); test-coverage ZOSTAJE (falsyfikowalność); e2e ZOSTAW-ODCHUDŹ (harness → env-up, jedno źródło promptu, parametry z `.env.e2e`). Roster 6 → 5. | ETAP1 §1, §7; 6a pkt 18 |
| 4 | powtórka po STOP-ie E2E = tylko tester | **NIEAKTUALNA (§1 pkt 6):** STOP środowiskowy/limitowy → [MANUAL], run idzie dalej, powtórka nie istnieje | 6a pkt 18 L11 |
| 5 | P3 nie naprawiać automatycznie | **PRZYJĘTA:** builder fixa tylko P1/P2, P3 → known-issues/bot | 6a pkt 15 |
| 6 | dev-plan + dev-docs = jeden skill | **OTWARTA dla panelu**, z uzupełnieniem: budżet pliku i rejestr stałych w plannerze (6a pkt 8, ETAP1B); dev-prep osobno; oszczędność = czas operatora, nie tokeny | HANDOFF §3 pkt 6 |
| 7 | buildery Read zamiast Bash | **NIEAKTUALNA** (§1 pkt 1) | 6a pkt 15, 18 |
| 8 | telemetria pełna | **PRZYJĘTA i rozszerzona:** mechaniczna, zero agentów, globalny JSONL + raport miesięczny (§2 pkt 5, §12) | 6a pkt 18 |
| 9 | parametryzacja E2E w szablonie | **na listę zmian szablonu** (§10) + wejście panelu przez §2 pkt 6 | ETAP3 §7 |

## 6. Założenia z warunkiem odwrotu (każdy projekt wpisuje warunek i miarę przy każdym z nich)

| założenie | na czym stoi | warunek odwrotu / pomiar | źródło |
|---|---|---|---|
| polecenia-listy domkną ~60–70% uwag B | oceny agentów etapu 1b, zero runów; IFScale jednocześnie uzasadnia i grozi | skuteczność mierzalna dopiero PO wdrożeniu (PR z warstwy walidacji/migracji vs PR 2, 4, 9 z 1b); wzór warunku: „>1 P1/P2 klasy X od bota na 5 faz przywraca regułę/oś"; budżet <150 z D2 | ETAP1B §3, ETAP3 §1.2 |
| performance ZASTĄP (size-limit + advisors + 5-liniowa checklista w correctness) | advisors NIEZMIERZONE (do zmierzenia przy wdrożeniu bramki, na chmurze); size-limit dziś w szablonie nieobecny (0 wystąpień w `.claude/`), zmierzony tylko czas (0,8 s) | >1 P1/P2 klasy perf od bota na 5 faz → przywrócić oś warunkowo na tierze low | ETAP1 §1, ETAP3 L10 |
| security odchudzone + warunkowe po stacku | jw. advisors | P1/P2 klasy security od bota po review (dziś 7+6 w dwóch klasach ucieczek) | ETAP1 §1, 6a pkt 18 |
| packager → JS (agent znika) | ETAP1: bilans ujemny (18,7 M kosztu vs 9,5 M routingu), jedyny pomiar: reviewerzy po dossier czytają 2× więcej Bashem (10,5 → 23 tur); ETAP2: z literatury | pomiar tur Bash/Read reviewerów z dossier i bez na tej samej maszynerii — po wdrożeniu; kierunek tani i odwracalny | ETAP1 §1, ETAP3 L18 |
| sceptyk asymetryczny ~4× skuteczniejszy | 2 prace zewnętrzne (63–83% kill); u nas obalenia 12% / 19,2% / 10,9%, `obalone_n` per oś = artefakt | kill rate na archiwalnych findingach o znanych werdyktach — po wdrożeniu; ryzyko: kasowanie prawdziwych P1/P2 | ETAP3 L6 |
| test-coverage scalone z correctness (tylko jako opcja wariantu) | jedyna zmierzona warstwa mechaniczna trafia 0/31 | dopiero po pomiarze warstw 2–3 (Stryker na atrapach i Zod) na plikach z 31 uwag | §1 pkt 2 |
| batch sceptyków (4 findingi per sceptyk) | hipoteza ETAP1: 105 → ~30 agentów/23 fazy ≈ −2% | odsetek obalonych i degradacji P2→P3 przy batchowaniu vs dziś (10,9% / 23%) | ETAP1 §1 |
| hook `error-handling-reminder.sh` → wycofać | 6a pkt 18 L14 | dopiero gdy bramka ESLint (`no-console` + reguła Sentry) wejdzie do domknięcia fazy | 6a pkt 18 |

## 7. Elementy nietknięte — każdy projekt OBEJMUJE albo JAWNIE ZOSTAWIA (ETAP3 §5 + rozstrzygnięcia 6a pkt 18)

| element | stan | co projekt ma z tym zrobić |
|---|---|---|
| `kieran-typescript-reviewer.md`, `code-simplicity-reviewer.md` | ROZSTRZYGNIĘTE: ścieżka odwrotu konsolidacji z 2026-09-03, po panelu bez sensu → USUNĄĆ; treść (kieran §4b async/błędy, §5 usunięcia i regresje, §7 sygnały ekstrakcji; simplicity: YAGNI) = materiał do poleceń-list correctness i code-quality | wykorzystać treść, nie wplatać w inny proces |
| hooki Stop | ROZSTRZYGNIĘTE: `stop-build-check-enhanced.sh` ZOSTAJE (poza autopilotem, zero tokenów); `error-handling-reminder.sh` → wycofać po bramce ESLint | nic do projektowania |
| skill `/bugfix` | ROZSTRZYGNIĘTE: praktycznie nieużywany → kandydat do usunięcia; wypada z miary jakości | lista zmian szablonu |
| `coderabbit-setup/templates/coderabbit-base.yaml:54-55` (progi 300/50) | ROZSTRZYGNIĘTE: poprawić generator + opisać w skillu, jak konfigurować bota bez szumu (8 zmian z ETAP1B) | lista zmian szablonu |
| 6 agentów researchowych (best-practices, framework-docs, learnings, repo-research, spec-flow, web-research) | wołane ze skilli dev-plan/dev-prep/dev-ideate/dev-brainstorm (1–3 odwołania), 0/16 z `tools:` | objąć allowlistą (klasa) albo zostawić z uzasadnieniem |
| skille dev-ideate (403 l), dev-brainstorm (344), dev-docs-update (107) | 0 wystąpień w rozstrzygnięciach; dev-docs-update nakłada się na bootstrap stanu autopilota | objąć albo zostawić |
| skill `code-review` | drugi, niezależny roster review poza pipeline'em; po przeprojektowaniu osi zostanie ze starym | objąć albo zostawić |
| `freshness-audit` (skill + `freshness-audit-wf.js` 16 kB) | gotowy mechanizm na „czy reviewer jest aktualny", nieużyty i nieoceniony | objąć albo zostawić |
| `templates/e2e-env`, `templates/smoke-autopilot` | źródło parametryzacji E2E (`.env.e2e.example`); smoke-autopilot = jedyny scenariusz testowy maszynerii | objąć przez §2 pkt 6 |
| `.claude/workflows/__tests__/` (7 plików, 74 testy) | przypinają dzisiejsze zachowanie; każdy projekt je łamie; koszt NIE jest kryterium sędziów | projekt mówi, które testy zastępuje testem budżetu instrukcji (§2 pkt 3) i testem telemetrii |
| treść skilli `skills:` builderów (supabase-dev-guidelines, tailwind-react-guidelines, ux-ui-guidelines, security, sentry-integration, figma-design-to-code, agent-browser) | zostają (6a pkt 15); aktualność i stosowanie nieocenione — mini-run (c) to sprawdza | podzielić na stałą/referencyjną (§2 pkt 3) |
| oś code-quality: `architecture-strategist.md` (angielski, „architektura") + fokus z trzema osiami w `dev-docs-review-wf.js:364` | prompt w dwóch miejscach (D3) | jedno miejsce promptu per oś |
| `settings.json` `enabledPlugins dev-browser` vs `settings.local.json`; statusLine `npx -y ...@latest` | poza zakresem panelu | → etap higieny konta |

## 8. Tezy całej analizy stojące na jednym filarze (ETAP3 §4, po D1) — do raportu jako lista założeń

| teza | filar | co się sypie, jeśli fałszywa | stan po domknięciach |
|---|---|---|---|
| kontekst startowy = 25–35% kosztu fazy | POMIARY §1 (jedno konto, jedno repo) + arytmetyka ETAP3 §1.1 | kolejność priorytetów | przeliczone; kolejność stoi; potwierdzenie w mini-runie |
| polecenia-listy domkną 60–70% uwag B | ETAP1B §3 — oceny agentów, zero runów | strona jakościowa projektu „po": tańszy i gorszy naraz | D2: listy są marginalne wobec tła 300–500 nakazów → wymóg budżetu §2 pkt 3 |
| nowe findingi po fixie = review kodu naprawczego | POMIARY §4 — atrybucja po pliku | wybór n=3 vs sceptyk | **D1 obaliło w 60%:** większość to recall rundy 1 (§4) |
| bramki nie kasują żadnej dodatkowej osi | POMIARY §2 — jedna konfiguracja, ±3 linie, 97/200 | utrzymanie osi zastępowalnej bramką | stoi (wniosek zachowawczy, L9) |
| test-coverage do zdegradowania | ETAP2 §0 pkt 5; jedyny pomiar 0/31 | utrata 202 findingów, 31 uwag bez właściciela | **rozstrzygnięte: ZOSTAJE** (§1 pkt 2) |
| sceptyk asymetryczny ~4× skuteczniejszy | 2 prace zewnętrzne, zero pomiaru u nas | brak wzmocnienia albo kasowanie prawdziwych P1/P2 | przyjęty z warunkiem odwrotu (§6) |
| model kosztu opisuje dzisiejszy szablon | oferty-online bez N1–N9 | liczby „przed" bez punktu odniesienia | niska waga (§1 pkt 5) |

## 9. Jawne ograniczenia do raportu etapu 5 (z ETAP3 §2, po decyzjach 6a pkt 18)

L6 kill rate sceptyka niezmierzony · L7 model kosztu sprzed N1–N9 (uwaga, nie ryzyko) · L8 −50k = konto z pełnym MCP (**opisać jako wiedzę do podzielenia:
jak radzić sobie z dużą liczbą MCP/skilli przez `tools:`**) · L9 pomiar 2: 97/200, ±3 linie, reguły ERROR nie liczone jako trafienia · L10 advisors niezmierzone
(chmura) · L13 /bugfix zero danych · L16 miara sukcesu spadła 12,8 → 5,2/100 plików bez zmiany pipeline'u (typ kodu, nie rozmiar) — baseline per typ kodu przy
pierwszym pomiarze · L18 packager bez pomiaru mandatu dossier · tabela tez §8.

## 10. Lista zmian szablonu POZA panelem (wdrożenie bez decyzji projektowej)

L19 generator `coderabbit-base.yaml` + opis w skillu · martwe agenty kieran/simplicity → usunąć po wykorzystaniu treści (L14) · parametryzacja E2E (`.env.e2e`)
w szablonie (L11, ETAP1 e2e) · `/bugfix` kandydat do usunięcia (L13) · `error-handling-reminder.sh` po bramce ESLint (L14) · skrypt `doctor` (6a pkt 12) ·
CLAUDE.md po merge'u + `docs/decisions/` (6a pkt 1, 11) · 8 zmian `.coderabbit.yaml` PRZED pomiarem dev-pr (6a pkt 11) · bramka „zielony main" w bootstrapie (6a pkt 17).

## 11. Mini-run PRZED panelem (6a pkt 16 + dodatki) — NIE ZROBIONY, ~1 h, metoda markerów z pomiaru 1

Jedno małe zadanie buildera, trzy pytania: (a) czy reguła-marker wklejona przez orkiestrator do promptu delegacji („każdy nowy plik zaczyna się komentarzem X")
jest STOSOWANA w kodzie; (b) to samo dla reguły przez `paths:` (kontrola); (c) czy treść skilla wstrzykniętego przez `skills:` jest stosowana (marker w SKILL.md
testowym), czy tylko zajmuje kontekst. Dodatki: (d) ta sama para markerów w prompcie ~100 vs ~400 instrukcji (6a pkt 18 po D2); (e) odczyt `usage` pierwszej
tury per klasa roli — potwierdzenie dźwigni 25–35% (ETAP3 §1.1). Zero dodatkowych agentów analizujących. Wynik rozstrzyga wariant learned-patterns i czy `skills:` zostaje bez zmian.

## 12. Telemetria mechaniczna — rekord i miejsce w runie (D5)

*(dopisane w domknięciu D5; szkic pól w `dane/d5-telemetria-rekord.txt`)*

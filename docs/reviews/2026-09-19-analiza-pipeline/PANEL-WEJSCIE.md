# PANEL-WEJSCIE — pakiet wejściowy panelu etapu 4

**Data:** 2026-09-21 (domknięcie D4). **Charakter:** sama kompilacja — każdy zapis ma źródło w HANDOFF.md (6a), ETAP1/1B/2/3 albo POMIARY;
ten plik NIE wprowadza żadnej nowej decyzji. Gdy dwa dokumenty mówią co innego, obowiązuje precedens z §1. Sekcja §12 (telemetria) dochodzi w D5.
**Dla kogo:** dla 3 projektantów, 3 sędziów, sceptyka i syntezy w panelu etapu 4 — jako jedyny plik „co obowiązuje", zamiast czytania pięciu rozstrzygnięć.

## 0. Co robi panel i kto co czyta

- **Skład (HANDOFF §2 wiersz 4, §6 pkt 5):** 3 niezależne projekty pipeline'u „po" — **minimalistyczny** (minimalny koszt), **jakość-najpierw**
  (maksymalna jakość), **hybrydowy** — → 3 sędziów → sceptyk (adwersarialna krytyka) na zwycięzcę → synteza. ~8 agentów, **wszyscy na Fable** (6a pkt 19:
  „zależy nam na jakości"), w **TRZECH osobnych runach** (projektanci → sesja główna czyta → sędziowie → sceptyk), synteza w sesji głównej; przed startem sprawdzić
  limit Fable. Wnioski dotyczą szablonu (workspace-template), nie jednego projektu (HANDOFF §1). **Panel NIE buduje:** wynik = koncepcja docelowego pipeline'u
  + kolejność wdrożenia; etap 5 robi z tego plan w iteracjach, implementacja faza po fazie z metryką w telemetrii (6a pkt 19). Żaden projektant nie pisze kodu.
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
   „powtórka po STOP-ie E2E = sam tester" (i HANDOFF §5 hipoteza 4, i rek. 3 przeglądu runów) — traci przedmiot, bo taki STOP nie zatrzymuje runu, więc nie ma po nim żadnej powtórki review.

## 2. Twarde wymogi KAŻDEGO z trzech projektów (6a pkt 15–18; brak któregoś = projekt niekompletny)

1. **Allowlista `tools:` u wszystkich agentów pipeline'u** (−50k tokenów startu na agenta na koncie z pełnym MCP; 498/514 agentów nie wołało MCP — 6a pkt 15).
   Nośnik: **pliki agentów PER KLASA ROLI** jako domyślne (mechaniczny-haiku / orkiestracyjny-opus / reviewer / sceptyk / naprawiacz z Edit + skille),
   per rola tylko jako wyjątek — istniejące 8 plików (4 reviewerów, tester E2E, 3 buildery). Docelowo kilkanaście plików zamiast ~40 (6a pkt 18 po D3).
   Powód: `agent()` w Workflow nie ma opcji `tools:`/`omitClaudeMd`, a prompty 36 ról bez pliku są dynamiczne (JS), więc plik niesie wyłącznie ustawienia.
   MCP: `disallowedTools: mcp__*` dla reszty; Figma tylko builder UI / fullstack / tester E2E gdy zadanie ma `figma_screens`; Supabase MCP tylko w sesji głównej (6a pkt 10).
2. **Kontekst per klasa roli wg §1 pkt 1** (CLAUDE.md u builderów/reviewerów, `omitClaudeMd` mechaniczne, bypass zostaje) + `skills:` u builderów ZOSTAJE (7–12k tok/agent; dobór per IU niewart logiki).
3. **Budżet instrukcji w TRZECH WARSTWACH (6a pkt 18 po D2):** (1) warstwa STAŁA na rolę (mandat, kilkanaście poleceń-list, format wyniku, bloki workflowu)
   **<150 instrukcji** jako TEST szablonu w `.claude/workflows/__tests__` (pada przy edycji promptu) + w sync-template/doctor; **w runie zero STOP-ów**, co najwyżej
   liczba w telemetrii; **jednostka w teście (przegląd D2 2026-09-23, przyjęte): warstwa stała roli ma JEDEN oznaczony blok poleceń (stały nagłówek), każde polecenie
   = jedna pozycja listy w bloku; test liczy pozycje bloku i pada, gdy poza blokiem jest zdanie nakazowe** (metoda `d2_budzet_instrukcji.py` — lista + zdania z markerem —
   zależy od formy zapisu: 43% jednostek reviewera to pozycje list bez słowa nakazu, ta sama treść prozą byłaby niepoliczona, więc test nagradzałby przepisanie list
   na prozę); uzasadnienie budżetu = trafność i koszt (~2/3 poleceń reviewera warunkowe → warstwa referencyjna), nie procent przestrzegania z IFScale (inna jednostka); (2) warstwa REFERENCYJNA bez limitu, podzielona po warstwie kodu
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
6. **E2E → [MANUAL] zamiast STOP (6a pkt 18 L11, doprecyzowane 6a pkt 19):** warunek wstępny = środowisko E2E sprawdzone i działające PRZED startem autopilota
   (doctor/precheck); test niewykonalny w trakcie runu przez środowisko / limit zewnętrzny = checkbox przechodzi na [MANUAL] z powodem, run idzie dalej,
   a pozycja [MANUAL] **trafia do smoke operatora** (dev-docs-complete) — nie znika; ponowne stawianie środowiska w runie jest droższe niż test ręczny.
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
12. **Scalenie dev-plan + dev-docs w jeden skill (6a pkt 19; dotąd hipoteza 6):** każdy projekt projektuje scalony skill z budżetem tokenów, na analizie tego,
    co oba skille dziś robią i gdzie przepalają kontekst (HANDOFF §3 pkt 6: skille przed autopilotem = 2–5% kosztu zadania, dev-docs kopiuje 22–46% planu;
    6a pkt 8 budżet pliku w IU; `dane/skille.csv`, `dane/koszt_skilli.txt`). dev-prep zostaje osobno (interaktywny).
13. **Każda zmiana w projekcie ma wskazaną metrykę z rekordu telemetrii (6a pkt 19):** metryka, pole rekordu, baseline z etapu 0, horyzont — wg mapy walidacji
    D5b (§12). Zmiana bez metryki = niekompletna.

## 2a. Twarde wejścia z etapów 1, 1b, 2 i pomiarów (rozstrzygnięte przed decyzjami operatora; obowiązują, o ile §1 nie mówi inaczej)

- **ETAP1 §1, §2, §4:** roster 6 → 5 (performance ZASTĄP: size-limit w domknięciu + advisors performance + 5 linii w fokusie correctness: N+1, `for update` na hot path,
  `Promise.all` po kolekcji, `.limit()` bez `count`, pętla z fetchem); security prompt 191 → ~90 linii + warunek `plikiKodu>0`; correctness własny plik agenta, tury
  29,6 → ~20; spec-compliance: usunąć martwe odwołania w `spec-compliance-reviewer.md:49` i duplikat fokusu REVIEWERZY:368; code-quality: ESLint flat + knip
  w domknięciu, prompt z zakazem zgłaszania czegokolwiek, co łapie lint; test-coverage: naprawić brak `zEffortem`/`agentType` w wywołaniu (`dev-docs-review-wf.js:904`);
  e2e: harness → env-up, jedno źródło promptu, parametry z `.env.e2e`; stan fazy (policzony
  w JS) doklejany do promptu agenta-następcy zamiast `stan:zapis` (80 powołań haiku/23 fazy); precheck → env-up; pre-skan → ESLint; zwiń → stan:zapis; NIE scalać
  `fix:kontrola` z `fix:poprawka`; scribe review: niższy tier + krótszy prompt, nie dzielić; dedup ZOSTAW; domknięcie fazy pkt 1b (audyt error-handlingu) NIE jest
  duplikatem hooka; progi rozmiaru → bot; **PR ≤ ~150 plików jako bramka w dev-docs-complete** (222 pliki = bot odmówił recenzji). Otwarte po ETAP1: batch sceptyków (§6),
  spec tylko na fazach z kodem (27% wyjścia to `.md` poza miarą jakości). Zapis „powtórka po STOP-ie E2E = sam tester" — NIEAKTUALNY (§1 pkt 6).
- **ETAP1B §2, §3, §5:** polecenia-listy per oś — konkretne polecenia w tabeli ETAP1B §3 (correctness 4, test-coverage 3 + kolumna falsyfikowalności, security 4,
  spec 3, performance → 5. polecenie correctness o limicie czasu, e2e o seedach); **budżet pliku i rejestr stałych w plannerze** (IU wprowadzające stałą istniejącą
  w repo wskazuje jedno źródło i konsumentów); **dossier klas ucieczek u buildera** (tabela 8–10 klas z jednym zdaniem „co robić zamiast", regenerowana z compoundów);
  **bramka niezmienności migracji** (`git diff --name-only base..HEAD -- supabase/migrations/` ∩ pliki obecne w base ≠ ∅ → STOP „popraw nową migracją"; ta sama
  w kontroli diffu naprawczego); 8 zmian `.coderabbit.yaml` (→ generator, §10); 4 zmiany dev-pr (§3 pkt 2); **seedy z właścicielem** (e2e dla kontraktu z migracją,
  security dla strażników; `e2e/seeds/*.sql` bez path_instructions bota → dopisać jako granicę zaufania; seed vs migracja to klasa BEZ narzędzia — `migrations.sum`
  pilnuje edycji wypchniętej migracji, nie zgodności seeda z kontraktem, ETAP3 §3 pkt 2); 28 uwag C (realna luka bez właściciela) i preferencje bota (Act/Assert,
  docstring) zostają botowi; słownik klas (jedna nazwa na klasę) warunkiem porównywalności następnego pomiaru.
- **ETAP2 §1, §2, §6:** zakaz powtórek sekwencyjnych (§2 pkt 10); sceptyk asymetryczny (§2 pkt 7); **pełny zestaw bramek domknięcia fazy:** `eslint.config.ts`
  (ESLint 10 flat, `recommendedTypeChecked` error, `strictTypeChecked` warn, `max-lines` 360/60 ze skip*, `import-x/order`, `no-empty`, `no-floating-promises`,
  `react-hooks` v6+ z regułami kompilatora) + knip + size-limit + `vitest --typecheck` + Stryker diff-scoped + `migrations.sum` (Supabase CLI nie ma checksumy migracji)
  + advisors (na chmurze, §2 pkt 8); correctness wzmocniony mechanicznie (`no-floating-promises`, `react-hooks` set-state-in-effect/refs/purity) dla 2 największych
  klas B; przy React Compilerze „brak useMemo/useCallback" NIE jest findingiem; trzy warstwy testów niefalsyfikowalnych jako DODATKI (§1 pkt 2) — StrykerJS bez `--since`
  (zakresy `plik:od-do` liczone z `git diff`), wynik mutacji → builder jako lista mutantów do zabicia, **mutation score NIE jako cel liczbowy** (agent pisałby testy
  pod metrykę); zasada alokacji: compute przesuwa się z osi produkujących szum (performance, code-quality → lint) do weryfikacji — sceptycy to 6% fazy, nawet 2× więcej
  to mniej niż jedna oś; packager → JS
  (założenie z warunkiem odwrotu, §6; dossier = pełne pliki dotknięte + kontrakty, BEZ zapewnień z planu fazy); dedup: rola „zagreguj i odsiej sporadyczne" ma sens
  tylko przy n równoległych próbkach; pre-skan → skasować; `migrations.sum` PRZED env-up; przepisanie coding-rules.md z tabelą USUŃ/ZMIEŃ/DODAJ/PRZENIEŚ-DO-LINTERA
  (`dane/etap2-research/research-coding-rules-2026.txt`); `claude plugin validate --strict` + `eval` jako bramka CI zmian w maszynerii (niezależnie od pluginu).
  **Wariant do rozważenia przez panel:** n=3 równoległe próbki 2–3 osi skrajnych (security, correctness+testy) z różną kolejnością diffu + agregator (wzór Bugbot)
  zamiast 6 osi — D1 (§4) podaje, ile zasięgu brakuje (połowa nowych findingów po fixie to przeoczenia), ale nie rozstrzyga wyboru: n próbek kupuje zasięg,
  sceptyk go nie zwiększa; pomiar po panelu: run kontrolny „1 reviewer z budżetem 6 osi vs 6 osi" (POMIARY §5 pkt 4).
- **POMIARY §1–§3 (fakty, które stoją niezależnie od §1 pkt 1):** reguły `paths:` wyzwala tylko Read/Edit (nie `cat`, nie Write nowego pliku, nie `ls`) → reguła
  o nowej migracji musi być w prompcie delegacji; `omitClaudeMd` działa też dla `agent()` w Workflow; sam `disallowedTools: mcp__*` daje 39,3k (nie 11,6k) — dźwignia
  jest w `tools:`; bramki z cache ESLint + knip + size-limit ≈ 4 s + typecheck 10 s na 585 plikach; pierwsze wdrożenie ESLint = tura wyciszania 188 zastanych błędów;
  **Stryker ~2 min na 3 pliki → 5–15 min na fazę, NIE do każdego domknięcia** (kandydat: przed dev-pr lub tylko pliki testowe dotknięte w fazie); Stryker wymaga
  zielonego zestawu testów (bramka „zielony main", §2 pkt 4); pomiar 2: ESLint trafia 1/97 uwag B po linii → bramki gaszą koszyk A i zapobiegają, nie kasują osi.

## 3. Pozostałe decyzje operatora 6a pkt 1–14 obowiązujące dla projektów (jedna linia każda)

- pkt 1: aktualizacja CLAUDE.md = krok „uzgodnij z rzeczywistością" na końcu brancha z bramką rozmiaru w JS; decyzje fazowe → `docs/decisions/` + 1 linia indeksu; do usunięcia dopisywanie w dev-docs-complete:115-116 i complete-wf:160.
- pkt 11: uzgodnienie CLAUDE.md dopiero PO potwierdzonym merge'u (krok w dev-pr) + bootstrap autopilota na main sprawdza wpis w `docs/decisions/`.
- pkt 2: dev-pr PRZEBUDUJ wąsko — 4 zmiany z ETAP1B §4 (zero nowych agentów): (1) etap `zbierz` obowiązkowy w KAŻDEJ turze, `napraw` odrzuca wątki bez niego; (2) regex guarda uzasadnień bez alternatywy z backtickiem, wymagana nazwa dokumentu + 20 zn; (3) pole `rekomendacja` liczone w JS (MERGUJ / NIE MERGUJ / KOLEJNA TURA / DECYZJA OPERATORA) jako pierwszy wiersz raportu; (4) raport = tabela per tura złączona po id z `watki[]` + `propozycjeDoReviewerow` commitowane w compoundzie. Osobno: sufit 3 tur, tryb interaktywny zostaje. dev-pr = 0,74% kosztu pipeline'u — NIE jest celem oszczędności, cel = jakość decyzji operatora. Odrzucone w ETAP1B: klasa `bot-podtrzymuje`, etap `raport` z plikiem na dysku (karmi pętlę recenzji), domyślne 2 tury. 8 zmian `.coderabbit.yaml` wdrożyć PRZED pomiarem dev-pr.
- pkt 4, 17: learned-patterns — format klasa → reguła (2 zdania) → Source; zasada: limit rozmiaru dotyczy warstwy ZAWSZE ładowanej (indeksu), nie wiedzy — wiedza schodzi do warstw ładowanych warunkowo (odpowiedź na pytanie operatora o projekt rozwijany rok); zamknięty słownik klas (L12: dziś trzy słowniki traktowane jak jeden — do jednej listy z odwzorowaniem ETAP1↔ETAP1B; praca wdrożeniowa, nie panelowa).
- pkt 5: coding-rules.md — poprawki (sprzeczność §3/§11, zbyt absolutne NIGDY/ZAWSZE, część do ESLint; ETAP2: §13 i §9 sprzeczne z docs); właściciel szablon, zmiany tylko z dowodem; po D2 to drugi największy blok instrukcji (117–130; większy tylko blok skilli buildera 178) → warstwa referencyjna.
- pkt 6: profil stacku w dossier + komendy-listy per technologia u istniejących reviewerów; NIE nowy agent.
- pkt 8: budżet pliku w scalonym dev-plan+dev-docs — IU podaje długość pliku, przyrost, wymiary (powody zmiany, eksporty, importy, test-lustro, 5 sekund); pęka → krok „wydziel moduł" PRZED dodaniem; ten sam próg z tolerancją 20% w ESLint i `.coderabbit.yaml` (progi rozmiaru → bot, ETAP1).
- pkt 3, 17: higiena konta (MCP/pluginy per projekt, audyt pluginów) = OSOBNY etap po raportach, poza panelem.
- pkt 12: `doctor` — mechaniczny skrypt bash, lista narzędzi WYLICZANA z projektu, wołany w sync-template / dev-prep / bootstrapie autopilota (STOP przed pierwszą fazą) + sekcja „Wymagania" w README.
- pkt 14: styl komunikacji z operatorem — problem → przyczyna → rozwiązanie → korzyść.

## 4. Wyniki domknięć D1–D3 (2026-09-21)

- **D1 (L3) — wersja po przeglądzie 2026-09-23: `skrypty/d1r_rewizja_atrybucji.py` → `dane/d1r-rewizja-atrybucji.{txt,json}`, korekta w POMIARY §4
  (pierwotnie `dane/pomiar5-atrybucja-po-fixie.*`, 2 pary, 33 findingi, „60% recall”).** Trzy powtórki po fixie (9b f4, samodzielna f3 run 1→2 i 2→3),
  44 findingi kodowe, klasa semantyczna (blame na linii + przyczyna z diffu): **urodzone w fixie 15 kodowych (+3 rozjazdy CLAUDE.md), łańcuch 4 (urodzone
  we wcześniejszym fixie, przeoczone przez PEŁNĄ następną rundę, w tym 2 P2), przeoczone w kodzie oglądanym przez rundę wcześniejszą 22 = 50%
  (przedział 36–64%, wrażliwość 50–57%)**; P1/P2 kodowe: przeoczone 7, fix + łańcuch 8; jedyny P1 urodził się w fixie; kontrola diffu nie złapała żadnego
  urodzonego w fixie. Wniosek: składniki porównywalne — ani „review kodu naprawczego” (POMIARY §4), ani „większość to recall” nie wynika z danych.
  **Dla panelu:** (1) wybór „n=3 równoległe próbki 2–3 osi skrajnych vs jedna runda z lepszym sceptykiem” (ETAP2 §6, POMIARY §5 pkt 3) NIE wynika z tego
  podziału — sceptyk odsiewa fałszywe, nie znajduje przeoczonych; D1 mówi, ile zasięgu brakuje (22/44), a wybór to decyzja o kupowaniu zasięgu za compute;
  (2) łańcuch pokazuje, że kodu naprawczego nie łapie niezawodnie także kolejna pełna runda → źródłem steruje się po stronie fixa (§2 pkt 9).
- **D2 (L2) — `skrypty/d2_budzet_instrukcji.py`, `dane/pomiar6-budzet-instrukcji.{json,txt}`, ETAP3 §7; wersja po przeglądzie 2026-09-23:
  `skrypty/d2r_rewizja_budzetu.py` → `dane/d2r-rewizja-budzetu.txt`.** Reviewer security dziś ~365 jednostek (lista + zdanie z markerem nakazu; górna bez
  podwójnego liczenia ~500 — learned-patterns ma 5,7 nakazu/regułę i wchodzi DWA razy: eager z `.claude/rules/` ORAZ w całości w dossier, co jest kosztem 13k tok
  × 6 reviewerów na fazę, ale nie dodatkowymi poleceniami), builder danych ~497 na medianie iu.prompt (górna ~670; trzy skille 178). Po 6a pkt 15/17 nadal reviewer
  ~310–320, builder ~480–490. Precyzja licznika na próbce 30: reviewer 29/30 to polecenia, builder 23/30; **reviewer: ~1/3 zawsze obowiązujące (~110), ~2/3 warunkowe**.
  **IFScale mierzy inną jednostkę** („użyj dokładnie słowa X”) — kierunek (więcej poleceń → ciche pominięcia) stoi, procenty 84–99% → ~68% NIE przenoszą się;
  nasz punkt na krzywej da mini-run (d) (§11). **Dla panelu:** budżet projektować jako CAŁOŚĆ na rolę (cel <150), uzasadniony TRAFNOŚCIĄ i KOSZTEM (warunkowe
  → warstwa referencyjna, stała ~110 jest osiągalna bez wycinania wiedzy) → wymóg §2 pkt 3; oczekiwania wobec poleceń-list niższe (§6, §8).
- **D3 (L15, L1b) — `dane/d3-mapa-rol-agentow.txt`.** 45 slotów ról w 6 workflowach = 36 bez pliku agenta + 9 z plikiem (8 plików); `dev-autopilot-wf.js` 19 wywołań,
  zero `agentType`; 0/16 plików ma `tools:`. Prompt osi review żyje w DWÓCH miejscach dla 4 osi (plik + fokus w workflowie), tylko w workflowie dla correctness
  i test-coverage, a code-quality = angielski plik „architecture-strategist" + fokus z trzema osiami — „odchudź prompt o połowę" musi wskazać oba miejsca. Telemetria:
  3 klasy ról po kontekście na turę (mechaniczne haiku 86–102k, orkiestracyjne opus 119–168k, reviewerzy 193–224k, buildery 238k); sceptycy 135 wywołań/23 fazy
  = najliczniejsza rola bez pliku (naturalne miejsce na pierwszy wspólny plik klasy). **Dla panelu:** wymóg §2 pkt 1 (pliki per klasa).
  **Korekta po przeglądzie 2026-09-23 (`skrypty/d3r_kontekst_per_klasa.py` → `dane/d3r-kontekst-per-klasa.txt`):** (1) kontekst per klasa z telemetrii NIE jest punktem
  odniesienia — pochodzi z epoki, w której CLAUDE.md oferty-online rósł 13,8k → 87k zn (08-31 → 09-17), learned-patterns 7,8k → 45k, a kontekst PIERWSZEJ tury rósł
  razem z nimi (mechaniczne 55k → 101k, reviewerzy 76k → 145k, buildery 89k → 160k tok); po ścięciu CLAUDE.md do 21k (09-21) nie było żadnego pełnego runu; punkt
  odniesienia = mini-run (e) na obecnym stanie repo, przed `tools:`; porównania `ctx_start` tylko przy podobnym rozmiarze stałych plików (`faza.wiedza.*`);
  (2) CLAUDE.md nie tłumaczy różnicy między klasami (ładuje się obu): średni kontekst na turę mierzy PRACĘ (reviewer 25 tur, mechaniczny 5); na starcie różnica ~40k,
  głównie MODEL (haiku ~93k, opus ~127k przy tej samej konfiguracji bez pliku) → cele ctx_start sprawdzać per model; (3) klasy uzasadnia zestaw USTAWIEŃ roli (model,
  CLAUDE.md, Edit/skille, MCP), nie poziom kontekstu; (4) freshness-audit-wf (4 role) poza mapą do decyzji operatora po D6. Wzrost stałego kontekstu o 46–75k tok
  w 3 tygodnie bez zmiany pipeline'u = najmocniejszy dowód na 6a pkt 1 i 17 (nic nie dopisuje do CLAUDE.md, learned-patterns poza eager).

## 5. Hipotezy z HANDOFF §5 — stan po decyzjach (projektant dostaje je w TEJ wersji)

| # | hipoteza (HANDOFF §5) | stan | źródło |
|---|---|---|---|
| 1 | odchudzić kontekst startowy agenta | **OBOWIĄZUJE w wersji §1 pkt 1 / §2 pkt 1–4**; dźwignia 25–35%; MCP/skille przez `tools:`; learned-patterns → wycinek od orkiestratora; dev-compound nie pisze do CLAUDE.md | 6a pkt 15, 17; ETAP3 §1.1 |
| 2 | mniej agentów na fazę (35 → ~15) | **OTWARTA dla panelu** z ustaleniami: stan w prompcie następcy, precheck → env-up, pre-skan → ESLint, zwiń → stan:zapis, NIE scalać kontroli z poprawką, scribe review niższy tier (ETAP1); telemetria = skrypt, NIE agent (nadpisuje część hipotezy o scribe); dedup ZOSTAW z rolą zależną od wyboru n próbek (ETAP2); packager → JS jako założenie z warunkiem odwrotu (ETAP2, §6) | ETAP1 §1, ETAP2 §2, 6a pkt 18 |
| 3 | roster 6 → 4–5 | **ROZSTRZYGNIĘTE w ETAP1 + L4:** performance ZASTĄP (z warunkiem odwrotu); security ZOSTAW-ODCHUDŹ (prompt 191 → ~90 linii, `plikiKodu>0`, warunkowe po stacku); correctness ZOSTAW-ODCHUDŹ + własny plik; spec-compliance ZOSTAW (otwarte: tylko fazy z kodem); code-quality ZOSTAW-ODCHUDŹ + lint (styl/progi zakazane w prompcie); test-coverage ZOSTAJE (falsyfikowalność); e2e ZOSTAW-ODCHUDŹ (harness → env-up, jedno źródło promptu, parametry z `.env.e2e`). Roster 6 → 5. | ETAP1 §1, §7; 6a pkt 18 |
| 4 | powtórka po STOP-ie E2E = tylko tester | **NIEAKTUALNA (§1 pkt 6):** STOP środowiskowy/limitowy → [MANUAL], run idzie dalej, powtórka nie istnieje | 6a pkt 18 L11 |
| 5 | P3 nie naprawiać automatycznie | **PRZYJĘTA:** builder fixa tylko P1/P2, P3 → known-issues/bot | 6a pkt 15 |
| 6 | dev-plan + dev-docs = jeden skill | **WYMÓG (§2 pkt 12, 6a pkt 19)**, z uzupełnieniem: budżet pliku i rejestr stałych w plannerze (6a pkt 8, ETAP1B); dev-prep osobno; oszczędność = czas operatora + kontekst scalonego skilla | HANDOFF §3 pkt 6, 6a pkt 19 |
| 7 | buildery Read zamiast Bash | **NIEAKTUALNA** (§1 pkt 1) | 6a pkt 15, 18 |
| 8 | telemetria pełna | **PRZYJĘTA i rozszerzona:** mechaniczna, zero agentów, globalny JSONL + raport miesięczny (§2 pkt 5, §12) | 6a pkt 18 |
| 9 | parametryzacja E2E w szablonie | **na listę zmian szablonu** (§10) + wejście panelu przez §2 pkt 6 | ETAP3 §7 |

## 6. Założenia z warunkiem odwrotu (każdy projekt wpisuje warunek i miarę przy każdym z nich)

| założenie | na czym stoi | warunek odwrotu / pomiar | źródło |
|---|---|---|---|
| polecenia-listy domkną ~60–70% uwag B | oceny agentów etapu 1b, zero runów; IFScale jednocześnie uzasadnia i grozi (po przeglądzie D2: inna jednostka, tylko kierunek); **oczekiwanie obniżone** — D1 (połowa nowych findingów to przeoczenia w oglądanym kodzie) i 1b (164/200 B „w zakresie promptu”) wskazują raczej na granicę uwagi/osądu niż na nadmiar reguł | skuteczność mierzalna dopiero PO wdrożeniu, porównanie w tym samym typie kodu względem B0 (baseline po zmianie `.coderabbit.yaml`); wzór warunku (D5b v2 — jednostka i próg poprawione): B P1/P2 bota osi na 100 plików w oknie 5 PR ≥ max(3, 2 × oczekiwana) przywraca regułę/oś, klasa = diagnoza (dawne „>1 P1/P2 klasy X na 5 faz" = 1–2 PR i fałszywy alarm); budżet <150 z D2 | ETAP1B §3, ETAP3 §1.2 |
| performance ZASTĄP (size-limit + advisors + 5-liniowa checklista w correctness) | advisors NIEZMIERZONE (do zmierzenia przy wdrożeniu bramki, na chmurze); size-limit dziś w szablonie nieobecny (0 wystąpień w `.claude/`), zmierzony tylko czas (0,8 s) | ≥3 B P1/P2 osi performance od bota w oknie 5 PR → przywrócić oś warunkowo na tierze low (D5b v2; baseline 5 w 17 PR, wrzesień 1 na 683 pliki; dawne „>1 na 5 faz" alarmowałoby przypadkiem w ~20% okien) | ETAP1 §1, ETAP3 L10, D5b |
| security odchudzone + warunkowe po stacku | jw. advisors | B P1/P2 osi security od bota na 100 plików, osobno per profil stacku (D5b v2: 33 w 17 PR = 1,72/100, wrzesień 0,88/100; próg odwrotu w oknie 5 PR ≥ max(3, 2 × oczekiwana), dziś 10; „7+6" z ETAP1 = inny zbiór, nieporównywalny) | ETAP1 §1, 6a pkt 18, D5b |
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
| **wszystkie skille szablonu — użycie (D6, 2026-09-22; `skrypty/d6_audyt_skilli.py` → `dane/d6-audyt-skilli.{txt,json}`)** | 28 skilli + 7 workflowów; trzy źródła: koszt ze `skille.csv` (5 projektów, 08-05..09-18), skan 5228 transkryptów wszystkich projektów (okno 2026-08-03..09-22 — retencja ~7 tyg., „0" ≠ „nigdy"), artefakty w 17 repo z szablonem (ślad z całego życia). **A. rdzeń, używany w każdym zadaniu (13):** dev-prep/dev-plan/dev-docs (52 epizody, 39,6 M jedn., 5 projektów), dev-autopilot-wf (54 uruchomienia Workflow, 5 projektów) + 4 workflowy-dzieci (wołane z autopilota przez `workflow()`, widoczne tylko w journalach nowego formatu: execute 15, review 18, compound 5, complete 5), dev-pr (11) + dev-pr-wf (75 uruchomień, 2 projekty), dev-compound (6 + 206 solutions w 12 repo), dev-docs-complete i dev-compound-refresh (SKILL.md czytany przez agenta w runie; 101 completed w 10 repo). **B. wstrzykiwane `skills:` (7):** supabase/security/sentry w 148 agentach (data 125 + fullstack 23), tailwind/ux/figma-design-to-code w 53, agent-browser w 59 testerach; zero wywołań ręcznych poza 2 (security 1, supabase 1); czy treść jest STOSOWANA — mini-run (c). **C. rzadko, celowo, poza pipeline'em (5):** coolify-manager 8/3 proj., sync-template 8/4, zroastuj-mnie 7/4, dev-brainstorm 7/4 + 8 brainstormów w 6 repo, coderabbit-setup 1 epizod, ale 5 repo z wygenerowanym plikiem. **D. kandydaci do usunięcia (5, 748 linii SKILL.md, 15 plików; zero użyć w oknie, zero artefaktów, nic w maszynerii ich nie woła):** code-review (ostatnia zmiana 03-20), code-quality (jedyne „odwołanie" = nazwa osi w review-wf, kolizja nazw), gemini (03-20, nie ma go nawet na liście skilli sesji), dev-docs-update (0 odwołań), bugfix (1 użycie w 7 tyg. na ~30 projektów — L13 potwierdzone). **E. do decyzji (5):** dev-ideate (1 użycie przerwane + 1 artefakt, 403 l), freshness-audit + wf (2 uruchomienia i 3 raporty, wszystkie 2026-08-23, tylko repo szablonu — „nieużyty" potwierdzone), dev-docs-execute/dev-docs-review jako SKILLE = tryb ręczny: 0 wywołań, wszystko idzie autopilotem, ale ich SKILL.md czyta agent w runie. Usunięcie D nie zmienia kosztu runów (skille nie ładują się do agentów) — tylko listę skilli operatora i utrzymanie. Skille konta (figma:*, frontend-design, artifact-design…) poza audytem → higiena konta. | D → usunąć (decyzja operatora); E → panel mówi, czy tryb ręczny execute/review zostaje jako skill, czy redukuje się do workflowu; dev-ideate i freshness-audit → operator; A/B/C → objąć przez §2 |
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
| polecenia-listy domkną 60–70% uwag B | ETAP1B §3 — oceny agentów, zero runów | strona jakościowa projektu „po": tańszy i gorszy naraz | D2 (po przeglądzie 2026-09-23): listy są marginalne wobec tła ~300–500 poleceń, ale procentów IFScale nie da się przenieść; oczekiwanie „60–70%” obniżone (D1 + 1b: raczej granica uwagi niż nadmiar reguł); mini-run (d) rozstrzyga, czy liczba poleceń jest dźwignią jakości → wymóg budżetu §2 pkt 3 |
| nowe findingi po fixie = review kodu naprawczego | POMIARY §4 — atrybucja po pliku | architektura pętli fix, ocena zasięgu review | **D1 (po przeglądzie 2026-09-23): pół na pół** — 22/44 przeoczenia, 22/44 urodzone w fixach (w tym łańcuch 4); teza za mocna w obie strony; 3 powtórki, 2 zadania, 1 repo (§4) |
| bramki nie kasują żadnej dodatkowej osi | POMIARY §2 — jedna konfiguracja, ±3 linie, 97/200 | utrzymanie osi zastępowalnej bramką | stoi (wniosek zachowawczy, L9) |
| test-coverage do zdegradowania | ETAP2 §0 pkt 5; jedyny pomiar 0/31 | utrata 202 findingów, 31 uwag bez właściciela | **rozstrzygnięte: ZOSTAJE** (§1 pkt 2) |
| sceptyk asymetryczny ~4× skuteczniejszy | 2 prace zewnętrzne, zero pomiaru u nas | brak wzmocnienia albo kasowanie prawdziwych P1/P2 | przyjęty z warunkiem odwrotu (§6) |
| model kosztu opisuje dzisiejszy szablon | oferty-online bez N1–N9 | liczby „przed" bez punktu odniesienia | niska waga (§1 pkt 5) |

## 9. Jawne ograniczenia do raportu etapu 5 (z ETAP3 §2, po decyzjach 6a pkt 18)

L6 kill rate sceptyka niezmierzony · L7 model kosztu sprzed N1–N9 (uwaga, nie ryzyko) · L8 −50k = konto z pełnym MCP (**opisać jako wiedzę do podzielenia:
jak radzić sobie z dużą liczbą MCP/skilli przez `tools:`**) · L9 pomiar 2: 97/200, ±3 linie, reguły ERROR nie liczone jako trafienia · L10 advisors niezmierzone
(chmura) · L13 /bugfix zero danych · L16 miara sukcesu spadła 12,8 → 5,2/100 plików bez zmiany pipeline'u (typ kodu, nie rozmiar) — baseline per typ kodu przy
pierwszym pomiarze · L18 packager bez pomiaru mandatu dossier · tabela tez §8. Do raportu dla operatora trzy zdania z ETAP2 §6 (reguły w tekście są pomijane;
bot łapie nas modelem, nie linterami — po POMIARY §2; powtarzanie review kupuje 1 prawdziwy defekt za 4–5 fałszywych; sceptyk działa 4× słabiej, bo dostaje odpowiedź razem z pytaniem).

## 10. Lista zmian szablonu POZA panelem (wdrożenie bez decyzji projektowej)

L19 generator `coderabbit-base.yaml` + opis w skillu · martwe agenty kieran/simplicity → usunąć po wykorzystaniu treści (L14) · parametryzacja E2E (`.env.e2e`)
w szablonie (L11, ETAP1 e2e) · `/bugfix` kandydat do usunięcia (L13) · `error-handling-reminder.sh` po bramce ESLint (L14) · skrypt `doctor` (6a pkt 12) ·
CLAUDE.md po merge'u + `docs/decisions/` (6a pkt 1, 11) · 8 zmian `.coderabbit.yaml` PRZED pomiarem dev-pr (6a pkt 11) · bramka „zielony main" w bootstrapie (6a pkt 17) ·
drobne z przeglądu runów rek. 7 (`complete` pomija `*.bak`; `fazyUkonczone` liczyć po stanie zadania; stopka commita STOP z pustą linią) · bramka czystości: brudny
wyłącznie katalog zadania → commit i kontynuacja, nie STOP (rek. 4). **Otwarte decyzje operatora z przeglądu runów (poza panelem):** scalenie odzyskanej telemetrii
z oryginałem (→ import w D5, §12), parametryzacja E2E przed następnym zadaniem w oferty-online.

## 11. Mini-run PRZED panelem (6a pkt 16 + dodatki) — NIE ZROBIONY, ~1 h, metoda markerów z pomiaru 1

Jedno małe zadanie buildera, trzy pytania: (a) czy reguła-marker wklejona przez orkiestrator do promptu delegacji („każdy nowy plik zaczyna się komentarzem X")
jest STOSOWANA w kodzie; (b) to samo dla reguły przez `paths:` (kontrola); (c) czy treść skilla wstrzykniętego przez `skills:` jest stosowana (marker w SKILL.md
testowym), czy tylko zajmuje kontekst. Dodatki: (d) ta sama para markerów w prompcie ~100 vs ~400 instrukcji (6a pkt 18 po D2) — **po przeglądzie D2 (2026-09-23) test ROZSTRZYGAJĄCY, nie dodatek:**
jedyny pomiar, czy liczba poleceń jest u nas dźwignią jakości (procenty IFScale mierzą inną jednostkę); marker ginie wyraźnie częściej przy ~400 → budżet 150 jest celem
jakościowym; nie ginie → budżet zostaje jako porządek i koszt, a główną dźwignią jakości są małe naprawy (D1) i ewentualnie równoległe próbki; (e) odczyt `usage` pierwszej
tury per klasa roli — potwierdzenie dźwigni 25–35% (ETAP3 §1.1); **po przeglądzie D3 (2026-09-23) to także PUNKT ODNIESIENIA kontekstu startowego per klasa i per model
na obecnym stanie repo (po ścięciu CLAUDE.md, przed `tools:`)** — telemetria sprzed 09-21 miesza epoki różniące się prawie 2×. Zero dodatkowych agentów analizujących. Wynik rozstrzyga wariant learned-patterns i czy `skills:` zostaje bez zmian.

## 12. Telemetria mechaniczna — rekord i miejsce w runie (D5, 2026-09-21; pełny szkic: `dane/d5-telemetria-rekord.txt`)

**Dziś:** jeden wpis per run dopisywany przez agenta haiku (`zapiszTelemetrie()`, `dev-autopilot-wf.js:1028-1087`, także w `stopRun()`), który 2× skasował plik;
`tokenyRazemK` = `budget.spent()` = WYŁĄCZNIE tokeny wyjściowe (2% kosztu); poziom agenta nie istnieje. **Ograniczenie twarde:** skrypt workflowu nie ma dostępu
do plików ani Node (workflow-authoring), więc orkiestrator nie dopisze rekordu sam; dziennik runu nie zapisuje wyniku końcowego (status/powód zna tylko sesja główna).

**Źródła na dysku (zero tokenów, zweryfikowane na runie z 85 agentami):** `journal.jsonl` (label, phase, result strukturalny każdego agenta — w tym `findings`
reviewerów), `agent-<id>.jsonl` (usage per odpowiedź API z cache read/write, model, timestampy, tool_use), `agent-<id>.meta.json` (agentType), `.autopilot-state.json`
(metryki fazy). Etykiety agentów w workflowach-dzieciach nie niosą numeru fazy — do dopisania (`review:security:faza-2`), do tego czasu faza po kolejności grup.

**Rekord (jeden plik `~/.claude/telemetry/pipeline.jsonl`, append-only, klucz idempotencji `run|typ|id`, trzy typy; alternatywa z rek. 1 przeglądu runów — plik per run
+ globowanie katalogu — była lekiem na agenta kasującego wspólny plik; przy skrypcie, który nigdy nie otwiera pliku do nadpisania, oba formaty są bezpieczne, wybór przy wdrożeniu):**
- `agent` — id, etykieta, faza, rola (jak `rola()` w `koszt_agentow.py`), **klasa_roli** (mechaniczny/orkiestracyjny/reviewer/sceptyk/builder/naprawiacz/tester-e2e),
  agentType, model, tury, in/cache_w/cache_r/out/thinking, koszt_jedn (pełny cennik), **ctx_start** (kontekst pierwszej tury = miara dźwigni `tools:`), ctx_sr/max,
  narzędzia, start/koniec/sekundy, wynik (ok/null/brak), findingi p1/p2/p3 (reviewerzy), obalone (sceptycy), instrukcje_stale (z testu budżetu, jeśli jest).
- `faza` — status, liczniki, przebieg (skrót jak dziś), **findingi_per_os**, e2e {pass, fail, skip, **manual[] z powodem** (L11)}, fix, kontrolaFixa (z `regresje`),
  **bramki** {typecheck, eslint, knip, sizeLimit, migracje, advisors, stryker: status + sekundy}, koszt per etap, sekundy.
- `run` — status OK/STOP/NIEZNANY, powód, zrodlo_statusu (sesja/skan), **stop_kategoria** (E2E-środowisko / E2E-asercja / fix-FAIL / P1 / scribe / czystość / inne),
  manual_razem, fazy, walidacja, e2eSrodowisko, solution, koszt razem, sekundy, szablon (sha).

**Skrypt i miejsce w runie (propozycja, zero agentów w każdym wariancie):** `.claude/scripts/telemetria/zbierz.mjs` (Node, port `koszt_agentow.py`; test na fixture
w `__tests__`) + `raport.mjs`. **A (główne):** sesja główna po task-notification wywołuje `zbierz.mjs --run <runId> --status <status> --powod <powód>` — krok
w skillach wszystkich workflowów; z orkiestratora znika agent telemetrii (2 wywołania) i `tokenyRazemK`. **B (siatka, obowiązkowa):** `--skan` w raporcie
i w doctor dopisuje każdy run bez rekordu (status z ostatniej etykiety w journalu albo NIEZNANY; run w toku pomijany). **C (do sprawdzenia w mini-runie):**
hook Stop z `--skan --szybko` = pełna automatyzacja bez kroku w skillu.

**Raport miesięczny:** koszt per projekt/zadanie/run i udziały per etap i klasa roli (vs ETAP0 28/25/6/5/17/12%); ctx_start per klasa roli (czy allowlista
działa: cel ~4,5k / ~15k / ~25k); findingi per oś, kill rate sceptyka, P1/P2 po fixie; runy per zadanie, STOP-y per kategoria, MANUAL per powód, bramki
PASS/FAIL i czas; max instrukcje_stale per rola vs 150; anomalie (agent/faza > 2× mediany). **Wymóg dla każdego projektu panelu:** rekord w tym kształcie
(pola mogą być null, klucze nie mogą zniknąć) i punkt w runie, w którym wywołanie A jest możliwe.

**Decyzja operatora (6a pkt 19):** wariant A + siatka B przyjęte; C do sprawdzenia w mini-runie.

**Mapa walidacji zmian (D5b, 2026-09-22, wersja 2 po akceptacji 9 poprawek operatora — `PROPOZYCJA-POPRAWEK-MAPY-WALIDACJI.md`; pełny tekst:
`dane/d5b-mapa-walidacji.txt`, 21 wpisów; liczby jakości: `skrypty/d5b_baseline_jakosci.py` → `dane/d5b-baseline-jakosci.txt`).** Dla każdego z 13 wymogów §2
i 8 założeń §6: METRYKA → POLA rekordu (typ.pole) → BASELINE → HORYZONT → dla założeń ODWRÓT tymi samymi polami; pole bez producenta ma dopisek
„WYMAGA ZMIANY: <miejsce>". **Konwencja horyzontów:** KONFIGURACJA = 1 faza (ctx_start per klasa, bramki, budżet instrukcji, telemetria); KOSZT/TURY
= 5 faz (rozrzut tur p50 39 / p90 83); JAKOŚĆ = okno 5 PR (5 faz ≠ 5 PR: zadanie ma 3–6 faz i 1 PR). **MIARA JAKOŚCI (wspólna):** B P1/P2 bota
NA 100 PLIKÓW PR (PR-y 12–160 plików), per typ kodu i per oś (kolumna `etap` z 1b, nie filtr po nazwie klasy); baseline = epoka wrześniowa PR 13–19
(3,5/100; sierpień 9,3 — jakość spadała sama, średnia 6,7 dałaby fałszywą „poprawę", L16); porównania pipeline'u względem **B0 zebranego po 8 zmianach
`.coderabbit.yaml`** (inny przyrząd); **próg odwrotu** per oś w oknie 5 PR ≥ max(3, 2 × oczekiwana), klasa = diagnoza (dziś: correctness 14, test 12,
security 10, spec 4, perf 3). Przykłady: `tools:` → p50 `agent.ctx_start` per klasa i model vs punkt odniesienia z mini-runu (e) na obecnym stanie repo (telemetria 67–118k to średnia epok, D3 po przeglądzie)
(cel ~4,5k / ~15k / ~25k), 1 faza; pętla fix →
B P1/P2 bota na 100 plików fixa vs reszta PR: dziś **14,0 vs 4,7 (wrzesień 7,2 vs 2,2) ≈ 3×**, cel: stosunek spada; sceptyk → DISAGREE_EVIDENCE/
weryfikowane vs 12% / 19,2% / 10,9%, odwrót: kill rate >50% i ≥3 B P1/P2 w miejscach obalonych w oknie 5 PR; scalenie dev-plan+dev-docs → koszt
i minuty epizodu vs 930k + 707k, 47 + 67 min. **Kolejność odczytów (mapa §6):** ustawienia i koszt równolegle; zmiany jakościowe rozłącznych osi
równolegle w jednym oknie; zmiany przekrojowe (budżet instrukcji, wycinek wiedzy, polecenia-listy naraz, kontekst reviewerów, sceptyk, fix tylko P1/P2)
mają okno 5 PR dla siebie.
**Kontrola odwrotna (mapa → rekord D5): 16 brakujących pozycji dopisanych do rekordu (`d5-telemetria-rekord.txt` §7):** `agent.prompt_zn`,
`agent.narzedzia.mcp`, `agent.weryfikowane`, `agent.werdykty{agree, disagree_evidence, disagree_concern}`, `faza.sceptyk`, `faza.wiedza{indeks_zn,
claude_md_zn, wycinek_*}`, `faza.fix.pliki[]`, `faza.fix.linie_diff`, `faza.fix.p1_z_testem`, `faza.review_rundy`, `faza.dossier_zn`,
`faza.bramki.eslint.{trafienia, reguly[]}` + `bramki.testyTypow`, `run.profil_stacku`, `run.smoke{pozycje, z_manual}`, **`run.pr{pliki, koszyk, klasy[], rekomendacja}`
dla dev-pr — najważniejsze: bez niego żadna miara JAKOŚCI (P1/P2 od bota po naszym review, HANDOFF §1) nie ma źródła** (producent: rozszerzony schemat
istniejącego agenta `pr:zbierz` o klasę/oś/wagę, zero nowych agentów; `ma_regule` skryptem; pole „dlaczego przeoczone" wypada z runu → próbka w raporcie
miesięcznym; przed porównaniami kalibracja klasyfikatora na 2–3 starych PR vs 1b), oraz **nowy typ `skill`**
(epizod skilla w sesji głównej, port `koszt_skilli.py`) — bez niego §2 pkt 12 nie ma odczytu. Import baseline (plan etapu 5): `agents.csv` → agent,
odzyskana telemetria → faza/run v0, `skille.csv` → skill, `klasyfikacja-574.csv` + rozmiary PR z gh → `run.pr` dla 19 PR (tło jakości i epoka wrześniowa;
właściwy baseline porównań = B0; import załatwia otwartą decyzję o scaleniu odzyskanej telemetrii). Trzy rzeczy poza telemetrią, mierzone PRZED wdrożeniem: kill rate sceptyka na archiwalnych findingach, warstwy 2–3 testów
na 31 uwagach, stosowanie treści `skills:`/wycinka (mini-run §11). **Konsekwencja dla etapu 5: iteracja 1 = telemetria + import baseline; potem 8 zmian
`.coderabbit.yaml` + kalibracja klasyfikatora uwag bota + zebranie B0 z 2–3 zadań PRZED pierwszą zmianą pipeline'u; każda kolejna iteracja wchodzi z parą
(zmiana, wpis z mapy), zaplanowanym odczytem po 1 / 5 fazach / oknie 5 PR i regułami kolejności odczytów.** Wymóg §2 pkt 13 stoi na tej mapie.

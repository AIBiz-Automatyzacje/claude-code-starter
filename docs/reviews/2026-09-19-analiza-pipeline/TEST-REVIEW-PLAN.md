# TEST-REVIEW-PLAN — plan prawdziwego testu review (dziś vs A vs B vs C na historycznych fazach oferty-online)

**Data:** 2026-09-25. **Status:** ZAAKCEPTOWANY 2026-09-25 (HANDOFF 6a pkt 29): moduł §2.6 WCHODZI, efort wariantu 0 = `high` (§4.1, do potwierdzenia przy zgodzie na pilot),
przebieg fazami (§12); następny krok = skrypty przygotowawcze w nowej sesji, bez agentów. Nic nie uruchomione, zero agentów, zero zmian w `.claude/`, CLAUDE.md i oferty-online (repo tylko czytane:
`git blame/log/show/rev-list`). **Podstawa:** HANDOFF 6a pkt 27–28, §7, §8 „STAN … PO RUN 1” i „STAN PO RUN 2”; PANEL-PLAN §2, §3, §8, §10, §11;
PANEL-WEJSCIE §1, §2 pkt 7–11, §2a, §6, §12; POMIARY §4, §5 pkt 4; skill workflow-authoring. **Wersja dla operatora:** `TEST-REVIEW-PLAN-DLA-OPERATORA.md`.
**Liczby ze skryptów (zero agentów):**
- `skrypty/test_review_fazy.py` → `dane/test-review-fazy.{json,txt}` — skąd pochodzi każda z 195 uwag B i na jakiej fazie da się ją odtworzyć;
- `skrypty/test_review_klucz2.py` → `dane/test-review-klucz2.{json,txt}` — znane trafienia dzisiejszego review w tych fazach;
- `skrypty/test_review_plan.py` → `dane/test-review-plan.{json,txt}` — koszt przed startem, kolejność faz, zakresy, moc statystyczna
  (używa `panel_koszt_model.Referencja`; `__pycache__` sprząta sam).

## 0. Konstrukcja w jednym akapicie

Dla każdej historycznej fazy oferty-online, w której powstał kod z późniejszą uwagą B bota, odtwarzamy kod **w stanie tuż przed review tej fazy** w kopii poza
repo (historia ucięta na tym commicie — przyszłość niewidoczna). Na tej kopii uruchamiamy naprawdę bramki projektów i cztery warianty etapu znajdowania: dzisiejszy
`dev-docs-review-wf` (prompty bez zmian, ucięty przed weryfikacją) oraz review projektów A, B, C złożone skryptem z brzmienia ich katalogów, z tym samym modelem
i efortem co w projekcie. Ślepy sędzia (nie wie, który wariant jest który) dopasowuje wszystkie findingi fazy do dwóch kluczy: **klucz 1** = uwagi B bota
(to, co dziś uciekło) i **klucz 2** = potwierdzone P1/P2 historycznego review tej fazy (to, co dziś łapiemy — czy nowy wariant tego nie zgubi). Sceptycy każdego
wariantu weryfikują tylko dopasowane findingi. Koszt liczymy z transkryptów metodą `panel_koszt_model.py`. Najpierw **pilot 3 faz** (kalibracja sędziego,
kosztu i szczelności kopii) → notatka i decyzja o zakresie → etap główny.

## 1. Problem → przyczyna → co robimy

**Problem.** Run 2 dał dzisiejszemu pipeline'owi 32,8% (high) przy prawdziwych 0% — ocena „na papierze” przecenia (HANDOFF 6a pkt 28). Nie da się na niej wybrać
architektury review ani ocenić, czy dodatkowe próbki (B) albo jeden reviewer (C) są warte swojej ceny.
**Przyczyna.** Sędzia oceniał, czy tekst mechanizmu *obejmuje* przypadek; ucieczki B pokazują, że objęcie ≠ złapanie (POMIARY §4: powtórka review odtwarza ~40–50%
findingów; D1r: 22/44 nowych findingów po fixie to przeoczenia w kodzie oglądanym). Skuteczność zależy od uwagi agenta na konkretnym kodzie, a tego papier nie mierzy.
**Co robimy.** Replay na prawdziwym kodzie: te same fazy, te same klucze, cztery warianty, bramki uruchomione naprawdę, koszt z transkryptów.
**Co to da.** Liczby do D1 (i części D2, D5, D12): ile znanych ucieczek łapie każdy wariant, ile dzisiejszych trafień gubi, ile szumu dokłada i ile kosztuje jedno złapanie.

## 2. Wybór faz

### 2.1 Skąd pochodzi każda z 195 uwag B (`dane/test-review-fazy.txt`)

Metoda (skrypt): przypadek → wątek bota (dopasowanie po początku treści po normalizacji białych znaków; bez treści — plik + linia z CSV) → komentarz w
`pr-N-review-comments.json` → `original_commit_id` i zakres `original_start_line..original_line` → `git blame -w` tego zakresu → commit, który go wprowadził →
klasa commitu po temacie. Dla commitów „pakujących” (część serwerowa PR-ów dzielonych: 2f48bdc, e43257e, 0f6e697, e89ac9c) — ten sam fragment w ostatniej
wersji pliku na gałęzi fazowej (`git log --all --full-history`, bo merge chowa gałąź boczną) i blame tam. Gałęzie skasowane (samodzielna rejestracja) — commity
dostępne przez commity bota (`rev-list --children --all <commity bota>`). Faza = najbliższy potomny commit „poprawki po review fazy N” (przeszukanie wszerz,
przez commity samej maszynerii `.claude/`/`docs/`); **stan przed review = rodzic tego commitu**; baza fazy = ostatni commit poprzedniej grupy review.

Dwie reguły przypisania (heurystyki, obie w danych): **ścisła** — najpóźniejszy commit wśród nietrywialnych linii zakresu bota (defekt istnieje w całości dopiero
wtedy); **luźna** — linia kotwicy bota. Pierwsza wersja skryptu brała samą kotwicę i przy zakresach kończących się `}` / `});` przypisywała defekt przypadkowej
linii (sprawdzone czytaniem próbki 15 przypadków: 7 „faza”, 3 „fix-review”, 3 „pr-tura”, 2 „faza bez review” — zgodne z treścią uwag poza tymi kotwicami).

| pochodzenie wg reguły ścisłej | przypadki | co to znaczy dla testu |
|---|---|---|
| faza (execute) z review w pipelinie | 91 | **w kluczu 1** |
| fix-review (poprawki po review fazy) | 34 | 7 w kluczu przez regułę luźną; 27 = urodzone w fixie → moduł opcjonalny §2.6 |
| pr-tura (poprawki po recenzji bota) | 27 | poza testem — kod, którego nasze review nigdy nie widziało |
| faza bez review (commity po autopilocie: smoke, dopiski operatora, PR 12 porządkowy) | 21 | poza testem (3 w kluczu przez regułę luźną) |
| poza pipeline'em (ręczne poprawki, smoke) | 13 | poza testem (2 w kluczu przez regułę luźną) |
| kontrola diffu naprawczego | 5 | 1 w kluczu; 4 → moduł §2.6 |
| pakujący bez rozwiązania / brak wątku | 3 / 1 | poza testem |

**Klucz 1 = 104 przypadki** (91 ścisła + 13 tylko luźna) w **37 fazach**, 106 par (przypadek, faza) — 2 przypadki mają różną fazę wg obu reguł i idą do obu.
Linia kotwicy obecna w stanie przed review przypisanej fazy: 106/106 (warunek konieczny; o obecności całego defektu rozstrzyga sędzia, §5).
**Poza kluczem 91 przypadków (65 P1/P2)** — test ich nie zmierzy (§8). W kluczu: P1/P2 67 z 132, P1 3 z 9, ogon 13 z 27, wrzesień 27 z 39; osie:
correctness 38/77, test-coverage 25/39, security 13/38, spec 9/15, code-quality 8/12, performance 6/8, e2e 4/4, domknięcie 1/2. Rodzina „bramka czarną listą”
ma w kluczu tylko 3 z 15 — większość urodziła się w turach PR (skaner HTML).

### 2.2 Klucz 2 — znane trafienia (`dane/test-review-klucz2.txt`)

Potwierdzone P1/P2 KOD/TEST z raportów `docs/completed/<zadanie>/review-faza-N.md` (odczyt `git show HEAD:`): **210 pozycji w 37 fazach** (raport jest dla
każdej fazy). Parser obsługuje pięć formatów raportów; sprawdzony na 9 raportach wobec liczników „Statystyki”: 7 zgodnych, 2 z odchyleniem ±1 (jedna pozycja
dziennika wzięta za finding, jeden nagłówek bez backticka pominięty) — przed testem lista idzie do sędziego po przejrzeniu w sesji głównej.
Raport to ostatni przebieg review fazy, więc klucz 2 to dolna granica. **Po co:** selekcja klucza 1 (tylko to, co uciekło) faworyzuje warianty nowe — dzisiejszy
review na tych przypadkach już raz przegrał; klucz 2 ma odwrotną selekcję. Oba razem pokazują zysk i stratę każdego wariantu.

### 2.3 Kolejność faz i zakresy (`dane/test-review-plan.txt` §3–§4)

Wartość fazy = (P1/P2 + ½ P3 klucza 1) / koszt całego testu fazy (4 warianty + sędzia). Zakresy są prefiksami tej kolejności:

| zakres | fazy | pary klucza 1 (P1/P2, ogon, wrzesień) | klucz 2 | koszt [M jedn.] dolny .. środek .. górny | twardy limit |
|---|---|---|---|---|---|
| pilot | 3: b26128d (PR 4/9 f2), 2634b67 (PR 3 f1), f3ee433 (PR 13 f2) | 13 | 14 | 26 .. 56 .. 66 | 99 |
| + powtórka r=2 (b26128d) | 1 | 6 | 7 | 8 .. 18 .. 22 | 33 |
| 50% | 13 (pilot w środku) | 58 (40, 7, 9) | 66 | 141 .. 309 .. 367 | 551 |
| 75% | 21 | 82 (56, 13, 15) | 125 | 232 .. 508 .. 605 | 907 |
| pełny | 37 | 106 (69, 13, 27) | 210 | 395 .. 865 .. 1 033 | 1 549 |
| moduł §2.6 (D12) | 24 commity fixa (2 w pilocie jako próba harnessu, ~4 M) | 31 (22 P1/P2) | — | ≈ 44 (środek) | 66 |

Koszty z efortem wariantu 0 = `high` (§4.1); przy `medium` wariant 0 byłby tańszy o ~15% (pełny: 214 zamiast 251 M).

Osie w zakresie 50%: correctness 20, test-coverage 13, code-quality 6, spec 6, performance 5, security 5, e2e 3 — **security i ogon są w nim słabo pokryte**
(5 z 13 i 7 z 13); 75% daje cały ogon (13) i security 7. Skala: jeden run autopilota z 20.09 (3 fazy, cały pipeline) = 35,3 M jedn.

### 2.4 Losowość: powtórki czy więcej faz (`dane/test-review-plan.txt` §5)

Model: przypadek × wariant = próba Bernoulliego (powtarzalność review ~50%, POMIARY §4), warianty sparowane po przypadku, rozrzut prawdziwej różnicy między
przypadkami 0,15; przykład dziś 20% vs projekt 40%. Połowa szerokości 95% CI różnicy / najmniejsza wykrywalna różnica (80% mocy): pełny 106 par ±12,4 / 17,7 pkt;
pełny P1/P2 (69) ±15,3 / 21,9; 75% (82) ±14,1 / 20,1; 50% (58) ±16,7 / 23,9; 50% P1/P2 (40) ±20,1 / 28,8; pilot (13) ±35,3 / 50,5.
Powtórka r=2 przy tym samym N zawęża CI o 27%, podwojenie N o 29% — przy tym samym koszcie **więcej faz daje nieco więcej i szerszy przekrój klas**. Faz
z przypadkami B jest 37, więc ponad pełny zakres zostają tylko powtórki. **Rozstrzygnięcie:** najpierw fazy, powtórka tylko jedna — cała faza pilota
b26128d drugi raz we wszystkich wariantach — żeby zmierzyć stabilność każdego wariantu (B deklaruje, że 3 próbki ją podnoszą; to jest bezpośredni test tej tezy).
Pilot nie rozstrzyga niczego o jakości (MDD 50 pkt) — służy do kalibracji.

### 2.5 Rekomendacja zakresu

Pilot → notatka (koszt zmierzony zamiast szacunku, zgodność sędziego, szczelność, pierwsze liczby) → **decyzja operatora o zakresie etapu głównego**. Rekomendacja
na dziś: **75%** — jedyny zakres z całym ogonem i MDD ~20 pkt przy ~59% kosztu pełnego; 50% jest tańsze o ~40%, ale security (5) i ogon (7) nie dają tam żadnego
wniosku. Rozszerzenie do pełnego tylko wtedy, gdy po 75% dwa najlepsze warianty różnią się mniej niż MDD, a wybór między nimi zmienia koszt zadania o >10%.

### 2.6 Moduł opcjonalny — kontrola diffu fixa (D12)

31 przypadków (22 P1/P2) urodzonych w fixie review lub kontroli, w 24 commitach fixa. Ten sam replay, ale na etapie `fix:kontrola`: diff fixa + lista findingów,
które fix naprawiał (z raportu fazy), cztery warianty kontroli (dziś: prompt kontroli z `dev-autopilot-wf.js` bez zmian; A/B/C: pozycje katalogu typu
`kontrola-fixa`, w tym grep nazw z D12). Koszt ≈ 44 M jedn. Mierzy jedyną metrykę, która dziś pokazuje ≈3× gorszą jakość (pliki fixa 14,0 vs 4,7 B P1/P2 na 100 plików).
**Operator 2026-09-25: moduł WCHODZI** („jeżeli ten koszt da nam jak najwięcej informacji … akceptuję”). Wykonanie: 2 commity fixa w pilocie jako
próba harnessu (sędzia, szczelność, koszt), pozostałe w etapie głównym razem z fazami.

## 3. Odtworzenie kodu (oferty-online i `.claude/` bez żadnych zmian)

1. **Katalog testu poza repo i poza `Documents/Kodowanie`** (np. `~/test-review/`) — żeby nie ładował się `Kodowanie/CLAUDE.md` (kontekst claude-mem) ani reguły szablonu.
2. **Kopia historii ucięta na fazie:** `git clone --mirror` oferty-online do `~/test-review/_mirror` (kopia; w oferty-online zero nowych refów), w lustrze gałąź
   `test/<faza>` na commicie „stan przed review”, potem `git clone --single-branch --branch test/<faza>` → repo zawiera wyłącznie przodków tej fazy: pełną wcześniejszą
   historię zadania (jak prawdziwy reviewer), zero przyszłych commitów, zero poprawek bota.
3. **Maszyneria dzisiejsza w kopii:** `.claude/` szablonu z HEAD workspace-template skopiowane bez zmian (agenci, workflowy, skille, hooki, ustawienia,
   `rules/coding-rules.md`); `rules/learned-patterns.md` i CLAUDE.md zostają **z epoki fazy** (wiedza projektu z tamtej chwili — nowsza zawiera opisy tych
   właśnie defektów). Nadpisane pliki `git update-index --skip-worktree`, nowe w `.git/info/exclude` → `git status` i `git diff` kopii są czyste, więc diff fazy
   widziany przez reviewerów jest dokładnie diffem fazy.
4. **Tester E2E wyłączony we wszystkich wariantach** (środowisko przeglądarkowe dla stanu historycznego nie istnieje): w wariancie 0 przez ucięcie orkiestracji (§4.1),
   w A/B/C nie jest składany.
5. **Zależności:** `pnpm install --frozen-lockfile` z lockfile'a epoki + zależności bramek z pomiaru 3 (ESLint 10.11, typescript-eslint 8.70, react-hooks 7.1,
   @vitest/eslint-plugin 1.6, knip 6.37, size-limit 14, Stryker 10.0, eslint-plugin-import-x) dodane w kopii; pułapki znane z POMIARY §3 (plugin Strykera ścieżką
   do `dist/src/index.js`, `tsconfig.tools.json`, `globals.node`).
6. **Ustawienia sesji testu w kopii** (`.claude/settings.local.json`, tylko kopia): deny dla `Read`/`Bash` poza katalogiem kopii w części, którą da się wyrazić
   wzorcem (`docs/reviews`, oferty-online, `~/.claude/projects`), `WebFetch`, `WebSearch`, `Bash(gh:*)` — szczelność i tak rozstrzyga skan transkryptów (§10).
7. **Dowód „bez zmian”:** skrypt zapisuje przed i po teście `git -C oferty-online for-each-ref` + `status --porcelain` + `git -C workspace-template status -- .claude CLAUDE.md`;
   różnica = STOP (§11).

## 4. Warianty

Wspólne: **Opus 5.5** (`claude-opus-5-5`) wszędzie, gdzie projekt ma opusa; haiku tylko tam, gdzie projekt go ma (dedup/agregator); sesja uruchamiająca = headless
`claude -p --model claude-opus-5-5` z katalogu kopii (jedna sesja na fazę i wariant, bez `--resume` — N2), wiadomość startowa z N1 („Do agentów workflow…”),
`--strict-mcp-config` bez serwerów MCP (498/514 agentów nie woła MCP — 6a pkt 15; start mniejszy dla wszystkich wariantów jednakowo, prompty nietknięte; koszt
przeliczany i tak do jednej bazy, §7). Wynik każdego wariantu = findingi po jego własnej agregacji, **przed** weryfikacją (to, co poszłoby do sceptyków).

### 4.1 Wariant 0 — dzisiejszy pipeline

Skrypt `test-review-wariant0.js` generowany z `.claude/workflows/dev-docs-review-wf.js` z HEAD: tekst do `phase('Verify')` (linia 1079) bez zmian, dalej zwrot
`{findings, przebieg, pominieci}` po dedupie i globalnym limicie P3; usunięty tylko thunk testera E2E. Generator sprawdza, że `REVIEWERZY`, `WARUNKI`,
`kontekstPrompt`, `reviewerPrompt`, `testCoveragePrompt`, schematy i dedup są bajt w bajt jak w źródle (hash wycinków) — inaczej nie startuje. Argumenty jak
z autopilota: `{sciezka: docs/active/<zadanie>, faza: N, srodowiskoE2E: 'pominieto'}`. Reviewerzy dziedziczą efort sesji (`TIERY_DOMYSLNE.reviewer = null`),
więc efort ustawia się flagą `--effort` sesji headless wariantu 0 — nie dziedziczy się z sesji głównej, która uruchamia skrypt. `~/.claude/settings.json` ma
`effortLevel: medium` bez wpisu dla `claude-opus-5-5`, ale operator uruchamia sesje na `high` i na `medium` (2026-09-25), więc **test bierze `high`**: dzisiejszy
wariant w najlepszym realnym ustawieniu — jeśli A/B/C i tak go wyprzedzą, wniosek jest bezpieczny; odwrotny wybór zawyżałby przewagę projektów, których główni
reviewerzy mają `high` wpisane w projekt. Do potwierdzenia przy zgodzie na pilot. Weryfikacja wariantu 0 (§6) = wycinek `Verify` tego samego pliku, bez zmian promptów.

### 4.2 Warianty A, B, C — prompty testowe z brzmienia katalogów

Generator `skrypty/test_review_warianty.py` (sesja główna, zero agentów) buduje dla każdej fazy skrypt `test-review-wariant{A,B,C}.js`:
- **skład i routing** = `architektura.sklad_review` + `role_koszt[]` projektu z `dane/panel-run1-projekty.json` (A: 5 soczewek correctness/security high,
  test/spec medium, code-quality low + dedup haiku; B: correctness ×3 i security ×1 + ×2 przy warstwie `dane` (medium), różna kolejność plików i przesunięte listy
  w próbkach, test-coverage, spec (faza z UI/migracją), code-quality + agregator haiku z progiem zgodności k ≥ 2 z 3; C: jeden reviewer kodu high z czterema
  blokami soczewek + osobny reviewer testów medium, agregacja w JS);
- **tekst promptu** = stały szkielet wspólny dla trzech projektów (zadanie + N1 + „pliki tylko czytasz” + format wyniku) + mandat soczewki z `sklad_review` +
  **pozycje katalogu typu `lista` / `wiedza` / `mandat` przypisane tej roli, dosłownie z pola `brzmienie`**, z aktywnym `warunek` dla fazy + przykłady warstwy stałej
  z `warstwa_stala[]` projektu. Warunki katalogów (tekst) → predykaty na sygnałach diffu fazy: mapowanie jednorazowe w `dane/test-review-warunki.json`, pisane
  w sesji głównej i przeglądane przed pilotem; warunek nierozstrzygalny = pozycja aktywna (fail-open jak pipeline);
- **dossier** wg `architektura.dossier` projektu, liczone skryptem (Python ma dostęp do plików, skrypt Workflow nie): A — sygnały diffu (grep dodanych linii)
  + sekcja planu tylko dla spec; B — lista plików w kolejności próbki + kontrakty IU + wycinek wiedzy; C — pełne pliki do 60k zn + diff reszty + kontrakty + wynik bramek.
  Wycinek wiedzy (1–2k zn) = wpisy `learned-patterns.md` z epoki, w których występuje katalog pliku fazy (format docelowy §2 pkt 4 jeszcze nie istnieje);
- **wynik bramek (§5) jako wejście** tam, gdzie katalog projektu tak mówi (np. „wynik ESLint/knip jako wejście”, „lista przeżytych mutantów”);
- **schemat wyniku** wspólny (plik, linia, waga P1/P2/P3, opis, scenariusz) + pola projektu (A: wynik per aktywna lista; B: numer próbki); dane wklejone w skrypt
  jako stała (limit 512 KB, HANDOFF §7); konkatenacja zamiast template literals.
Model i efort per rola z `role_koszt[]`; efort zapisany w etykiecie agenta (harness go nie loguje, PA-22).

### 4.3 Czego warianty nie mają w teście (jednakowo dla wszystkich)

Testera E2E, fixa, `fix:kontrola`, scribe'a, advisors (§5), wiedzy w formacie docelowym (wszyscy mają learned-patterns z epoki: 0 eager, A/B/C wycinek), zmian
po stronie buildera (kod jest historyczny — napisany przez dzisiejszych builderów).

## 5. Bramki i sędzia

### 5.1 Bramki uruchamiane naprawdę na kopii fazy (przed reviewerami, zero tokenów)

Z katalogów `typ: bramka` każdego projektu: ESLint flat typowany z regułami projektu (A: G01–G13, B: B-02…B-10, C: G-03..G-12 — trzy konfiguracje z nazw i opcji
reguł; reguła bez istniejącej implementacji → „nieuruchomiona” z powodem w danych), knip, size-limit (fazy z UI), typecheck, `vitest --typecheck`, Stryker
diff-scoped wg zakresu projektu (fazy z testami; wymaga zielonego zestawu — czerwony dry run = „nieuruchomiona”, POMIARY §3), niezmienność migracji i
`migrations.sum` (skrypt: `git diff --name-only baza..stan -- supabase/migrations` ∩ pliki obecne w bazie). **advisors nieuruchamialne** (wymaga projektu Supabase
w stanie historycznym na chmurze — zero Dockera, 6a) → w danych jako brak. Trafienia bramek idą do puli sędziego jako findingi „mechaniczne” danego wariantu
(kategoria BRAMKA z run 2) i, gdzie katalog tak mówi, jako wejście reviewerów. Wariant 0 dziś bramek lint nie ma (domknięcie = typecheck + testy + build).

### 5.2 Ślepy sędzia dopasowania (jeden na fazę)

Wejście (skrypt): klucz fazy = klucz 1 + klucz 2 **wymieszane, neutralne id `K1..Kn`** (sędzia nie wie, co jest uwagą bota, a co historycznym trafieniem):
ścieżka, linia przeliczona na stan przed review (kotwica odnaleziona w pliku), wycinek kodu ±6 linii, streszczenie i treść uwagi; pula findingów wszystkich
czterech wariantów + trafień bramek, **neutralne id `F1..Fm`, kolejność losowa ustalona skryptem, bez nazw wariantów, soczewek, `lista_id` i numerów próbek**
(tylko plik, linia, waga, opis, scenariusz). Na żądanie odczyt plików kopii fazy. Model Opus 5.5, efort `medium` (eskalacja `high`, jak run 2).
Wynik per `K`: **obecny w kodzie fazy** TAK / NIE / NIEPEWNE; dopasowane `F` z oceną **PEŁNE** (to samo miejsce ±~5 linii albo ta sama funkcja i ten sam
mechanizm awarii) / **CZĘŚCIOWE** (ten sam defekt w innym miejscu albo to samo miejsce z pokrewnym defektem, po którego naprawie uwaga zniknęłaby) + jedno zdanie.
Per `F` bez dopasowania: **INNA UWAGA BOTA** (lista pozostałych uwag bota z PR-ów fazy, koszyki A/C — też z neutralnym id) / **POZA KLUCZEM**.
Kalibracja: sesja główna czyta 20 decyzji (10 PEŁNE/CZĘŚCIOWE, 10 BRAK przy findingach w tym samym pliku); niezgodność > 15% → powtórka `high`; znowu > 15% → STOP.
W pilocie sędzia idzie dwa razy z inną permutacją `F` — zgodność sędziego z samym sobą jako miara szumu pomiaru.

### 5.3 Metryki (skrypt `test_review_wynik.py`, po runie)

Per wariant, osobno klucz 1 i klucz 2, tylko `K` z obecnością TAK: **złapane PEŁNE** i **PEŁNE+CZĘŚCIOWE** (jak B+L „szeroko” w run 2); przekroje P1/P2, ogon,
wrzesień, oś, rodzina; wkład bramek (BRAMKA) osobno; **szum** = findingi POZA KLUCZEM na fazę i na 100 linii diffu (P1/P2 osobno — to one idą do fixa);
stabilność (pilot r=2: odsetek złapanych w obu przebiegach, Jaccard findingów); **koszt na złapaną uwagę B** i koszt na fazę; czas ściany. Różnice względem
wariantu 0 sparowane po przypadku, z CI bootstrapem po fazach.

## 6. Sceptycy na dopasowanych

Każdy finding P1/P2 dopasowany do klucza 1 (PEŁNE/CZĘŚCIOWE) przechodzi weryfikację **według projektu swojego wariantu** (0: wycinek `Verify` dzisiejszego skryptu;
A: P2 grupa po pliku ≤ 4, P1 ×3 z 2/3; B: P2 batch 4, P1 ×3; C: P2 batch 4, P1 ×1 high; asymetrycznie wg §2 pkt 7). Wynik: odsetek prawdziwych B zabitych
przez weryfikację per wariant → „złapane po weryfikacji”. Klucz 2 — tylko w pilocie (koszt). Szumu (POZA KLUCZEM) sceptycy w teście nie weryfikują — liczba
jest górną granicą; próbka weryfikacji szumu to opcja po pilocie.

## 7. Koszt

**Szacunek przed startem** (`test_review_plan.py`): koszt roli = a + b × pliki kodu fazy (regresja na 29 wykonaniach faz oferty-online od 06.09, kontekst dziś,
ostatni `usage` na odpowiedź API), np. correctness 0,54 + 0,019/plik, security 0,38 + 0,016, test-coverage 0,46 + 0,023; współczynnik „po zmianie kontekstu”
z `panel_koszt_model.Referencja` (reviewerzy ×0,54–0,58, packager ×0,25, dedup ×0,41, sceptyk ×0,44–0,49). Etap znajdowania na fazie o medianie 19 plików kodu:
**0 — 5,78 M (efort `high`), A — 4,03 M, B — 6,19 M, C — 2,72 M** (po zmianie kontekstu 3,12 / 2,25 / 3,45 / 1,57); sędzia 0,90 M (×0,6–1,5); sceptycy na dopasowanych
— górna granica połowa przypadków fazy × jednostka verify-batch (+ P1 × dodatkowi sceptycy). Widełki: dolna = po zmianie kontekstu i efort −20%, górna = kontekst
dziś i efort +20%. Środowisko `--strict-mcp-config` powinno wylądować między dolną a środkiem — pilot to zmierzy.
**Liczby zakresów** — §2.3. Proporcje per wariant (środek, pełny zakres): 0 251, A 181, B 271, C 126 M — B najdroższy, bo jego istotą są próbki.
**Po teście:** koszt z transkryptów agentów runów testu (`<sesja>/subagents/workflows/<run>/agent-*.jsonl`, ostatni wpis `usage` na `message.id`, cennik d4r) —
kod `panel_koszt_dane.py`/`panel_koszt_model.py` bez zmian metody; raport w dwóch kolumnach: **zmierzony** (środowisko testu) i **przeliczony do bazy „po zmianie
kontekstu”** (Δ startu per klasa i model jak w `po_zmianie()`), żeby liczby były porównywalne z `dane/panel-koszt.txt`. Sesje headless (orkiestracja testu) i sędzia
— osobna pozycja „koszt pomiaru”, nie koszt wariantu.
**Twardy limit** = 1,5 × górna granica etapu (jak PANEL-PLAN §10): pilot 99 M (+33 M powtórka), moduł §2.6 66 M, etap główny wg zakresu z §2.3. Egzekucja: skrypt uruchamiający liczy
koszt z transkryptów po każdej fazie i nie startuje następnej po przekroczeniu; dodatkowo `--max-budget-usd` na sesję jako bezpiecznik (2× szacunku fazy-wariantu).
**Czas:** kopia + instalacja + bramki 10–25 min na fazę (Stryker 2–15 min); cztery warianty po 15–30 min (równolegle w obrębie fazy); sędzia ~10 min;
w pilocie jedna faza naraz (~25 agentów jednocześnie: 0 ~7, A ~6, B ~9, C 2 — sprawdzenie limitów konta), w etapie głównym 2–3 fazy naraz, jeśli
pilot pokaże, że limity to znoszą. Pilot ~3–4 h ściany; 75% ~12–18 h; praca sesji głównej przed pilotem (skrypty §12) ~1 sesja.

## 8. Decyzje D2–D12 — co ten test mierzy, a co idzie z warunkiem odwrotu

| decyzja | test mierzy? | czym / dlaczego nie |
|---|---|---|
| D1 architektura review | **TAK** — cel testu | złapane klucza 1 i 2, szum, stabilność, koszt na złapanie |
| D2 grupowanie sceptyków | **częściowo** | ile prawdziwych B zabija weryfikacja w układzie A (po pliku) vs B/C (batch 4) — tylko na dopasowanych, małe N; precyzja (zabijanie fałszywych) nie |
| D3 dossier i mandat | **nie rozstrzyga** | dossier jest splecione z architekturą (każdy projekt ma inne); dane poboczne: tury Bash/Read per wariant z transkryptów |
| D4 spec tylko w fazach z kodem | nie | wszystkie fazy testu mają kod (≥ 3 pliki) |
| D5 Stryker — gdzie | **częściowo** | ile przypadków klucza (rodzina test-niefalsyfikowalny: 25) łapią przeżyte mutanty na poziomie fazy i ile to trwa; „przed dev-pr” vs „w domknięciu” rozstrzyga czas, nie jakość |
| D6 efort i model per klasa | nie | każdy wariant ma jeden zestaw efortów; ablacja (np. C high vs medium na pilocie, ~+15 M) — opcja, nie w planie |
| D7 warstwy weryfikacji | nie | test nie uruchamia buildera ani domknięcia |
| D8a/D8b plan i research | nie | poza review |
| D9 opisy workflowów-dzieci | nie | kontekst sesji głównej |
| D10 reguły builder ↔ reviewer | nie | kod jest historyczny — strony buildera test nie widzi; strona reviewera splecione z architekturą |
| D11 kolejność wdrożenia | nie | wynika z D1–D10 |
| D12 sprzątanie po fixie + nowa IU | **tylko z modułem §2.6** | 31 przypadków urodzonych w fixie, kontrola diffu fixa w czterech wariantach |

**Konsekwencja dla run 3 (sceptycy, wstrzymany):** po teście sceptycy dostają D1, D2, D5 (i D12 z modułem) **z liczbami z testu** jako danymi; D3, D4, D6–D11
idą przez run 3 jak w PANEL-PLAN §6, każda z warunkiem odwrotu i wpisem mapy walidacji (pomiar po wdrożeniu, okno 5 PR względem B0).

## 9. Czego test nie zmierzy

1. **91 z 195 uwag B (65 P1/P2)** — urodzonych w turach PR, fixach (bez modułu §2.6), commitach po autopilocie i poprawkach poza pipeline'em; P1 w kluczu tylko 3 z 9.
2. **Zapobiegania** — projekty zmieniają też buildera (warstwa referencyjna, wycinek wiedzy, budżet pliku); na kodzie historycznym to niewidoczne.
3. **E2E** — tester i mapa funkcji wyłączone; 4 przypadki osi e2e mogą złapać tylko reviewerzy kodu.
4. **advisors** — nieuruchamialne na stanie historycznym.
5. **Kosztu pętli fix** wywołanej szumem nowych list — test liczy szum, nie jego koszt w fixie.
6. **Pełnej precyzji** — „POZA KLUCZEM” ≠ fałszywy alarm (bot też nie widzi wszystkiego, recenzował kod po naszym fixie).
7. **Wiedzy w formacie docelowym** — wycinek to przybliżenie z learned-patterns epoki.
8. **Stabilności ponad jedną powtórkę** — r=2 tylko na jednej fazie.

## 10. Ryzyka i zabezpieczenia

| ryzyko | skutek | zabezpieczenie |
|---|---|---|
| **selekcja klucza 1** (tylko to, co raz uciekło; review z sierpnia ≠ dzisiejszy) | wariant 0 zaniżony względem A/B/C | klucz 2 o odwrotnej selekcji; wniosek tylko z obu naraz |
| **asymetria promptów** (0 = produkcyjne, dopracowane; A/B/C = złożone z katalogu) | w obie strony | wspólny szkielet A/B/C, generator deterministyczny, prompty do wglądu przed pilotem; w raporcie jako ograniczenie |
| **przeciek przyszłości** (agent czyta `docs/reviews`, oferty-online, `gh`, transkrypty) | wynik fazy bezwartościowy | kopia bez przyszłych commitów, katalog poza Kodowanie, deny w kopii, **skan transkryptów** (ścieżki spoza kopii, `gh`, WebFetch, git na innych repo) |
| przypisanie defektu do fazy (heurystyka blame) | przypadek w złej fazie | dwie reguły, obecność rozstrzyga sędzia (NIE/NIEPEWNE wypadają), próbka 15 przeczytana |
| błąd sędziego dopasowania | zła liczba złapań | ślepota na wariant i klucz, kalibracja 20 decyzji, podwójny sędzia w pilocie |
| N1 (haiku wykonuje wiadomość startową) | agent robi coś spoza zadania | zdanie „Do agentów…” w każdej wiadomości, skan `tool_use` haiku |
| bramki nie wstają na stanie historycznym (lockfile, czerwone testy) | brak kategorii BRAMKA | status „nieuruchomiona” z powodem; > 1/3 faz bez ESLint → STOP |
| koszt ponad szacunek (duże fazy: epoka 09-08..09-17 −39% w modelu) | przekroczony budżet | pilot mierzy, limit per etap, skrypt nie startuje następnej fazy |

## 11. Twarde zatrzymania i planowane punkty

**Planowane (czekam na operatora):** (1) po przygotowaniu (skrypty, kopie pilota, prompty A/B/C i mapowanie warunków do wglądu) — zgoda na start pilota z kosztem;
(2) po pilocie — notatka (koszt zmierzony, kalibracja sędziego, szczelność, stabilność) i decyzja o zakresie; (3) po etapie głównym — `TEST-REVIEW-WYNIK.md` +
wersja operatora do akceptacji.
**Twarde (zatrzymuję się sam):** model agenta ≠ projektowany (opus ≠ `claude-opus-5-5`, haiku poza rolami projektu); przeciek w > 1 fazie (jedna faza z przeciekiem
= wypada z wyników); agent użył Write/Edit w kopii poza rolami, które to robią dziś (packager pisze `/tmp`), albo zmiana w oferty-online / `.claude/` szablonu
(§3 pkt 7); kontrola bajtowa wariantu 0 nie przechodzi; koszt etapu > limit; kalibracja sędziego > 15% dwukrotnie; > 10% agentów zwróciło null; bramki
nieuruchomione w > 1/3 faz; wykonanie wiadomości startowej przez agenta (N1).

## 12. Przebieg wykonania i pliki

1. **Przygotowanie (sesja główna, zero agentów):** `skrypty/test_review_kopia.sh` (lustro, klon ucięty, overlay `.claude/`, skip-worktree, instalacja, zapis
   stanu „przed”), `skrypty/test_review_bramki.py` (trzy konfiguracje ESLint z katalogów, knip, Stryker, migracje → `dane/test-review/bramki-<faza>.json`),
   `skrypty/test_review_warianty.py` (skrypty wariantu 0 z kontrolą bajtową i A/B/C + `dane/test-review-warunki.json`), `skrypty/test_review_sedzia.py` (pula,
   permutacja, klucze), `skrypty/test_review_uruchom.sh` (sesje headless, limit), `skrypty/test_review_skan.py` (modele, przeciek, zapisy — rozszerzenie
   `panel_modele.py`), `skrypty/test_review_wynik.py` (metryki, koszt). Kopie skryptów Workflow w `skrypty/test-review-*.js`.
2. **Pilot** (po zgodzie): 3 fazy + powtórka + 2 commity fixa (moduł §2.6) → `dane/test-review/pilot-*.json`, notatka `TEST-REVIEW-PILOT-DLA-OPERATORA.md`.
   **Przebieg fazami, nie wariantami** (uzgodnione z operatorem 2026-09-25): dla każdej fazy kolejno (1) kopia + instalacja + bramki (zero agentów), (2) cztery
   warianty naraz na tej samej kopii — każdy osobną sesją headless, (3) sędzia po komplecie czterech, (4) sceptycy na dopasowanych, (5) koszt z transkryptów
   i decyzja skryptu o następnej fazie. Powody: sędzia potrzebuje kompletu fazy; przerwanie w dowolnym miejscu zostawia pełne porównania dla skończonych faz;
   warianty jadą w tych samych warunkach (dzień, limity konta, kopia). Uruchamia jeden skrypt (`test_review_uruchom.sh`) z sesji głównej po zgodzie operatora.
3. **Etap główny** (zakres wg decyzji) → `TEST-REVIEW-WYNIK.md` + wersja operatora; dane w `dane/test-review/`; wynik odtwarzany z journali skryptem.
4. **Potem:** run 3 wg §8, HANDOFF, pamięć, commit.

**Decyzje operatora 2026-09-25:** (a) plan zaakceptowany — przygotowanie w nowej sesji, bez agentów; przed pilotem złożone prompty A/B/C i koszt pilota do wglądu;
(b) moduł §2.6 WCHODZI; (c) efort wariantu 0 = `high` (propozycja po odpowiedzi „sesje na high i medium”; potwierdzenie przy zgodzie na pilot).
Zakres etapu głównego — po pilocie (rekomendacja 75%).

## 13. Kontrola planu w obie strony

- **Plan → źródła:** 195/132/27/39 i osie — `dane/panel-zestaw-historyczny.txt`; pochodzenie, 104/91/37/106, przekroje klucza — `dane/test-review-fazy.txt`;
  210 i 37 raportów — `dane/test-review-klucz2.txt`; koszty ról, warianty, zakresy, pilot, moc, moduł §2.6 — `dane/test-review-plan.txt` §1–§6; 35,3 M i 31,60 M —
  `dane/panel-koszt.txt` §2; −39% epoki — `panel-koszt.txt` §3; 40–50% powtarzalności, czasy bramek i Stryker — POMIARY §3–§4; 22/44 — PANEL-WEJSCIE §4 D1r;
  14,0 vs 4,7 — PANEL-WEJSCIE §12; linia 1079 `phase('Verify')` i `TIERY_DOMYSLNE` — `.claude/workflows/dev-docs-review-wf.js:819, 1079`; effort — `~/.claude/settings.json`;
  498/514 — PANEL-WEJSCIE §2 pkt 1.
- **Źródła → plan (pozycje instrukcji operatora):** wybór faz (gałęzie, commity, stan przed review, pokrycie osi/P1-P2/ogona/września, powtórki vs fazy) → §2;
  odtworzenie kodu → §3; reviewerzy dziś / A/B/C z katalogów, model i efort, bramki naprawdę → §4, §5.1; klucz + ślepy sędzia + fałszywe alarmy → §5.2–§5.3, sceptycy → §6;
  koszt z transkryptów, szacunek, twardy limit → §7; D2–D12 i run 3 → §8; czego nie zmierzy, ryzyka, zatrzymania → §9–§11. Wszystkie cztery warianty są w każdym
  zakresie (6a pkt 28); decyzje z 6a nie są otwierane.

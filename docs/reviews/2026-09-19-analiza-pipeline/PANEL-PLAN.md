# PANEL-PLAN — plan panelu decyzyjnego etapu 4 (część A)

**Data:** 2026-09-24. **Status:** PLAN ZAAKCEPTOWANY 2026-09-24 (D12 wchodzi, projektant C zostaje); wykonanie w NOWEJ sesji (ta miała ~400k tokenów kontekstu) wg HANDOFF §8
„WYKONANIE PANELU”. Nic nie uruchomione poza skryptem krok 0 (b) (zero agentów, zero kosztu).
**Podstawa:** HANDOFF 6a pkt 22–26 (panel decyzyjny na Opus 5.5), PANEL-WEJSCIE.md (jedyny plik „co obowiązuje”), MINI-RUN-WYNIK.md (N1, N2, (e)),
PROMPT-AUDIT.md §1/§4, INSPIRACJE-POCOCK-PSTACK.md §1/§3, ETAP1 §3, ETAP1B §3, skill workflow-authoring.
**Wersja dla operatora:** `PANEL-PLAN-DLA-OPERATORA.md`.
**Dane przygotowane teraz:** `skrypty/panel_zestaw_historyczny.py` → `dane/panel-zestaw-historyczny.{jsonl,txt}`.

## 0. Konstrukcja w jednym akapicie

Krok 0 (sesja główna, skrypty) ustala, CO jest do rozstrzygnięcia (12 otwartych decyzji D1–D12, w tym D12 dopisana do akceptacji; D8 w dwóch częściach, §1), NA CZYM mierzymy jakość (195 uwag B bota jako przypadki, §2)
i JAK liczymy koszt (skrypt na transkryptach, §3). Run 1: trzech projektantów, każdy broni jednej architektury review i w jej ramach rozstrzyga pozostałe
decyzje (§4). Run 2: sędzia jakości (jedna rola, trzy porcje przypadków) ocenia każdy przypadek względem czterech zaślepionych katalogów mechanizmów — trzech
projektów i dzisiejszego pipeline'u jako kolumny kalibracyjnej (§5). Run 3: trzech sceptyków asymetrycznych dostaje wstępne wybory per decyzja bez uzasadnień
i atakuje je tylko z dowodem (§6). Synteza w sesji głównej: rekord per decyzja → wejście do planu iteracji etapu 5 (§7). 9 agentów Opus 5.5, ~10–16 M jedn.

## 1. Krok 0 (a) — otwarte decyzje

Stały szkielet każdego projektu = wymogi PANEL-WEJSCIE §2 pkt 1–16, precedensy §1, twarde wejścia §2a, decyzje §3. Poniżej tylko to, czego te sekcje
nie przesądzają. Każda decyzja ma już wskazany wpis mapy walidacji (`dane/d5b-mapa-walidacji.txt`), więc projektant nie wymyśla metryki, tylko ją wybiera.

| id | decyzja | opcje | dane (źródło) | metryka (mapa walidacji) |
|---|---|---|---|---|
| D1 | **architektura review** (oś run 1) | A: odchudzone osie (roster 5) + polecenia-listy + sceptyk asymetryczny; B: n=3 równoległe próbki 2–3 osi skrajnych z różną kolejnością diffu + agregator; C: 1 reviewer z budżetem instrukcji + pełne bramki | §4 niżej | §1 pkt 3, 7, 10, 11; zał. 1–3, 5; wspólna miara B P1/P2 bota na 100 plików PR |
| D2 | grupowanie sceptyków | dziś (grupa po pliku, 80% grup jednoelementowych); batch 4 findingi niezależnie od pliku; per finding | ETAP1: 105 → ~30 agentów na 23 fazy; po allowliście ≈ −0,4% kosztu fazy (§6 pakietu); obalenia 10,9%, degradacje P2→P3 23% | zał. 7 |
| D3 | dossier po przejściu packagera do JS | JS + mandat („reviewer zaczyna od dossier, nie od `git diff`”); JS bez mandatu; bez dossier, routing E2E grepem checkboxów | ETAP1: packager 18,7 M kosztu vs 9,5 M zysku z routingu; Bash reviewerów po dossier 10,5 → 23 tur (efekt zmieszany); L18 | zał. 4 |
| D4 | spec-compliance tylko w fazach z kodem | tak / nie / tylko gdy faza dotyka tekstów UI lub dokumentów prawnych | ETAP1: 27% wyjścia spec to `.md` poza miarą jakości; B osi spec 15/195, z czego tekst UI 12 | P3 (§7 mapy) + wspólna miara per oś |
| D5 | Stryker — gdzie | przed dev-pr (raz na zadanie); w domknięciu tylko pliki testowe dotknięte fazą; poza runem (ręcznie) | POMIARY §3: ~2 min na 3 pliki → 5–15 min na fazę; wymaga zielonego zestawu; rodzina „test niefalsyfikowalny” 39/195 | I2 (§8 mapy), `faza.bramki.stryker` |
| D6 | efort i model per klasa roli | tiery per klasa (mechaniczny / orkiestracyjny / reviewer / sceptyk / naprawiacz / builder / tester) na Opus 5.5; mechaniczni na haiku czy opus | PA-22: tiery strojone na Opus 5 (~94% historii), domyślny efort API 5.5 = `medium`, poziomy nie mapują się 1:1; test `sceptycy-p2.test.mjs:157` przypina `TIERY_DOMYSLNE`; Haiku 4.5 bez efortu (PA-23); N1: haiku wykonywał przekazaną wiadomość (3/4), opus 0/12 | P4 (§7 mapy), `agent.effort` |
| D7 | warstwy weryfikacji | które z: samosprawdzenie buildera (tsc/test/lint/build), domknięcie fazy, walidacja w fixie, walidacja końcowa — zostają, scalają się, znikają | PA-29: pięć warstw; domknięcie mediana 32 wywołań narzędzi; migracja 5.5 wskazuje polecenia weryfikacji do re-testu; bramki z cache ≈ 4 s + tsc 10 s (POMIARY §3). Hook `tsc` w sesji głównej ZOSTAJE (6a pkt 18 L14 a) — poza decyzją | koszt domknięcia i narzędzia per rola (P1/P4 mapy) |
| D8a | kształt scalonego dev-plan + dev-docs (wymóg §2 pkt 12 — „jak”, nie „czy”) | jeden artefakt planu z fazami i checkboxami; budżet tokenów epizodu; budżet pliku w IU (6a pkt 8); rejestr stałych | D6r: dev-plan mediana 2,39 M, dev-docs ~0,56 M, prep+plan+docs 95,8 M; kopia planu 22–46% | §2 pkt 12 mapy, rekord `skill` |
| D8b | research w dev-plan przy głębokości „Lekka” | obowiązkowy (dziś) / warunkowy (jawne kryterium) / wyłączony przy „Lekka” | PA-30; subagenci researchu 18,6 M z 55,6 M w 19 epizodach — największa pozycja dev-plan | §2 pkt 12 mapy |
| D9 | opisy workflowów-dzieci w liście skilli | skrócić do routingu / `disable-model-invocation` dla dzieci / zostawić | PA-31: ~12k zn opisów skilli szablonu w starcie; po §2 pkt 1 lista skilli znika u agentów pipeline'u (d4r składnik T) — **zostaje tylko sesja główna** i agenci bez allowlisty | `agent.kontekst.skille_zn` sesji głównej |
| D10 | rozkład reguł zachowaniowych builder ↔ reviewer | reguły u buildera (warstwa referencyjna po plikach IU); u reviewera (Matt `retro`); podział per klasa (np. zapobiegalne u buildera, wykrywalne u reviewera) | za reviewerem: builder ~480–490 instrukcji, coding-rules 117–130, mini-run (d) +72% kosztu bez zysku markerów; za builderem: ETAP1 45/68 ucieczek miało regułę, D1 każdy finding = tura fixa, ETAP1B builder przez którego przechodzi 100% B | P1/P2 na fazę, tury fixa, `ctx_start` buildera (6a pkt 26 k) |
| D11 | kolejność wdrożenia po iteracji 1 | projektant proponuje kolejne iteracje jako pary (zmiana, wpis mapy) | przesądzone: iteracja 1 = telemetria + import; potem 8 zmian `.coderabbit.yaml` + kalibracja klasyfikatora + B0 (PANEL §12); reguły kolejności odczytów (mapa §6); lint po sprzątaniu (6a pkt 26 g); N2 | mapa §5–§6 |
| D12 | **dopisana** — po fixie: mechaniczne sprzątanie + finding wymagający nowej funkcjonalności | (1) grep nazw zmienionych/usuniętych przez fix + komentarze i dokumenty je opisujące; (2) finding wymagający nowego pliku/ścieżki → nowa IU z własnym review zamiast pętli fix | D1r: 3 defekty „stara linia, przyczyna w fixie”, 3 rozjazdy CLAUDE.md, łańcuch 4 defektów fixa przeoczony przez pełną rundę 2; fix 14,0 vs 4,7 B P1/P2 na 100 plików (≈3×) | §2 pkt 9 mapy (stosunek plików fixa vs reszta PR) |

**Dlaczego D12 dopisana:** 6a pkt 19 zapisał to jako „obserwację sesji dla etapu 5 (NIE decyzja)”. Należy do tej samej pętli co wymóg §2 pkt 9 i do jedynej
metryki, która dziś pokazuje ≈3× gorszą jakość (pliki fixa), więc projekt bez stanowiska w tej sprawie zostawia największą znaną różnicę jakości bez właściciela.
**Operator 2026-09-24: D12 WCHODZI do panelu.**

**Sprawdzone w PANEL-WEJSCIE — kandydaci, którzy NIE są otwartą decyzją:**
- test-coverage scalone z correctness — precedens §1 pkt 2: wyłącznie opcja z warunkiem odwrotu i **po** pomiarze warstw 2–3; panel nie może jej wybrać teraz.
  Konsekwencja dla architektury C (1 reviewer): musi zachować soczewkę test-coverage z własną kolumną falsyfikowalności i z kolejnością wdrożenia, w której
  scalenie następuje dopiero po pomiarze warstw 2–3 i po runie kontrolnym „1 reviewer vs osie” (POMIARY §5 pkt 4).
- packager → JS — założenie §6 z odwrotem („kierunek tani i odwracalny”); otwarty zostaje tylko mandat dossier (D3).
- hook `tsc` w sesji głównej — zostaje (6a pkt 18 L14 a); D7 dotyczy tylko warstw w runie.
- przejście regresyjne po mapie funkcji — odłożone z warunkiem (§2 pkt 14).
- `pre-skan` → skasować, stan fazy w prompcie następcy, precheck → env-up, zwiń → stan:zapis, scribe niższy tier, dedup zostaje, `fix:kontrola` osobno,
  PR ≤ 150 plików, performance ZASTĄP — ETAP1 / §2a, obowiązują.
- skill `security` u builderów → warstwa referencyjna w postaci reguł (PA-24) i usunięcie kroku 1.7 (PA-27) — kierunek przesądzony, projektant podaje kształt.

**Kształt wymogów do zaprojektowania (nie decyzje „czy”, ale projekt musi je wypełnić):** §2 pkt 6 (3 rekomendacje z przeglądu runów),
§2 pkt 14 (kto i kiedy utrzymuje mapę funkcji, gdzie w runie tester czyta skill), §2 pkt 15 (lista reguł ESLint granic, kolejność ze sprzątaniem),
§2 pkt 16 (próg przyrostu i N dla agenta oceny ogrodnika), §2 pkt 3 (blok poleceń warstwy stałej per klasa roli, zasady pisania 1–11 z §2a).

## 2. Krok 0 (b) — zestaw historyczny (ZROBIONY: `dane/panel-zestaw-historyczny.jsonl`)

**Skład.** 195 uwag koszyka B (klasyfikacja 574, bez 5 „test kruchy” — ETAP1B §1): 132 P1/P2 (9 P1), 164 „w zakresie, ale przeoczone”, 25 „poza zakresem
promptu”. Oś-właściciel: correctness 77, test-coverage 39, security 38, spec 15, code-quality 12, performance 8, e2e 4, domknięcie/kontrola fixa 2.
Epoka: sierpień 156, wrzesień (PR 13–19, baseline mapy) 39.

**68 ucieczek z ETAP1 §3 to nie osobny zbiór przypadków.** ETAP1 liczył je na poziomie klas z 19 compoundów, a compoundy opisują te same wątki bota z PR 8–19
(identyfikatory wątków w `docs/completed/…`). Skrypt dopasował 30 przypadków B do compoundów (PR + nazwa pliku + linia) — te dostają ścieżkę do compoundu jako
kontekst (przyczyna, fragment kodu). Klasy ETAP1 §3 spoza B („progi rozmiaru” 20 = koszyk A → ESLint i bot; „preferencje bota” 11 = nie defekty) nie są
przypadkami do łapania — ich los jest przesądzony. Wniosek: zestaw = 195 B, compound = kontekst.

**Rodziny i ogon (ochrona przed dopasowaniem do testu).** Projektanci czytają ETAP1 §3 i ETAP1B §3, czyli znają nazwy głównych klas. 168 przypadków należy
do 14 rodzin nazwanych w tych tabelach, **27 (14 P1/P2, 22 klasy) to ogon** — klasy, których projektant po nazwie nie widzi (np. wartość graniczna poza migracją,
zaufanie nagłówkowi, konkatenacja SQL, kolejność middleware, cache bez inwalidacji). Pokrycie ogona raportujemy osobno: mierzy uogólnienie, nie dopasowanie
do znanej listy. Projektanci NIE dostają pliku przypadków.

**Format jednego przypadku (JSONL):**
`id` (B-PR-nr), `pr`, `epoka`, `plik` (ścieżka[:linia]), `klasa` (surowa z 1b), `rodzina`, `widoczna_dla_projektantow`, `waga` (P1/P2/P3), `os_wlasciciel`,
`dlaczego` (w-zakresie-ale-przeoczone / poza-zakresem-promptu / …), `streszczenie` (klasyfikator 1b), `tresc_bota` (pierwsze 900 zn wątku bota bez zwiniętych
skryptów — dopasowanie: 97 po linii, 48 jedyny wątek w pliku, 49 po słowach streszczenia, 1 niejednoznaczne → sędzia ma samo streszczenie), `compound` (ścieżka albo null).
Sprawdzone czytaniem próbki 12 przypadków (streszczenie ↔ treść wątku zgodne); identyfikatory `id` z CSV nie nadają się do złączenia (klasyfikatory 1b numerowały
niespójnie), stąd dopasowanie po pliku, linii i słowach.

**Jak sędzia rozpozna „złapane i czym” — rubryka (ta sama dla każdej kolumny):**

| kategoria | kiedy | pewność |
|---|---|---|
| BRAMKA | deterministyczna reguła z katalogu (reguła ESLint z nazwą, knip, typecheck, size-limit, grep-bramka, `migrations.sum`, niezmienność migracji, advisors) odpaliłaby na kodzie opisanym w przypadku — sędzia nazywa regułę i wskazuje, co w kodzie ją wyzwala | wysoka / średnia |
| LISTA | polecenie-lista z katalogu, którego obowiązkowy wynik wymieniłby dokładnie ten element (np. „wypisz każdą bramkę + gałąź domyślną” dla bramki czarną listą) i które jest uruchamiane w fazie z takim plikiem | średnia / niska |
| WIEDZA | reguła doklejana przez orkiestrator (wycinek learned-patterns / warstwa referencyjna) builderowi lub reviewerowi po katalogu tego pliku — zapobieganie albo wykrycie | średnia / niska |
| PROBKI | przypadek w mandacie osi, którą architektura próbkuje n razy równolegle — zapis „mandat × n”, bez oceny szansy | niska |
| E2E | scenariusz mapy funkcji / checkbox E2E obejmujący drogę użytkownika z przypadku | średnia / niska |
| MANDAT | tylko ogólny mandat osi albo reguła tekstem bez obowiązkowego wyniku — **na tym zbiorze historycznie 0 skuteczności** (każdy przypadek B przeszedł mimo mandatu) | — |
| NIE | żaden mechanizm katalogu | — |

Plus `mechanizm_id` z katalogu, `etap` (gdzie w runie), jedno zdanie uzasadnienia cytujące brzmienie mechanizmu. Sędzia ocenia **tekst mechanizmu**, nie intencję:
mechanizm bez dokładnego brzmienia = MANDAT.

**Zaślepienie i kalibracja.** Katalogi trzech projektów i katalog dzisiejszego pipeline'u (projekt 0, wypisany w kroku 0 z obecnych promptów osi, plików reviewerów
i bramek — ta sama szczegółowość) dostają neutralne etykiety P/Q/R/S w kolejności różnej w każdej porcji; sędzia nie wie, który jest dzisiejszy. Każdy przypadek
B przeszedł przez dzisiejszy pipeline, więc kolumna projektu 0 mierzy łagodność sędziego (albo nieskuteczność list, których dziś jest mało): odsetek BRAMKA+LISTA
w kolumnie 0 raportujemy obok wyników; powyżej 15% sesja główna czyta próbkę 10 ocen tej kolumny przed użyciem wyników (punkt zatrzymania, §10).

**Czego run 2 nie zmierzy (do raportu wprost).** (1) Zasięgu (recall): PROBKI i MANDAT nie mówią, jaka jest szansa znalezienia — różnica A vs B w zasięgu wymaga
powtórki review na historycznych diffach (run kontrolny POMIARY §5 pkt 4; metoda ślepa 6a pkt 26 f) i należy do etapu 5 albo do opcjonalnego pomiaru poza panelem.
(2) Skuteczności list: LISTA to pokrycie, a założenie „listy domkną B” ma obniżone oczekiwanie (§6 pakietu) i warunek odwrotu. (3) Fałszywych alarmów i kosztu
pętli fix, które dodają nowe mechanizmy — koszt liczy skrypt (§3), fałszywe alarmy — telemetria po wdrożeniu.
Wynik run 2 jest więc **profilem pokrycia per projekt** (BRAMKA / LISTA / WIEDZA / PROBKI / E2E / MANDAT / NIE, osobno P1/P2, osobno ogon, osobno wrzesień),
nie jedną liczbą „jakości”.

## 3. Krok 0 (c) — skrypt kosztu projektu (`skrypty/panel_koszt_projektu.py`, pisany po znaku, przed run 1)

**Co liczy.** Koszt typowej fazy i zadania w jednostkach cennika (in 1, cache write 1,25, cache read 0,1, output 5) dla projektu 0 i każdego projektu, metodą d4r:
koszt agenta po zmianie = koszt dziś − Δ startu × (1,25 + 0,1 × (wywołania − 1)) [+ zmiana części „praca” przez mnożnik tur], gdzie Δ startu = start dziś − start
po zmianie klasy z mini-runu (e) (TOLk: mechaniczny haiku 8,8k, orkiestracyjny 25,5k, reviewer 28,1–29,7k, sceptyk 27,0k, naprawiacz opus 26,0k / haiku 20,3k,
builder 38,6k). Koszt fazy = Σ ról × wywołania na fazę × częstość warunku. Wyjście: koszt fazy i zadania (projekt vs projekt 0 vs dziś), udział per etap
(execute / review / sceptycy / mechanika / fix / orkiestracja / E2E / zamknięcie), liczba agentów na fazę, czas bramek w sekundach osobno (POMIARY §3).

**Punkt odniesienia.** Koszty ról z transkryptów runu 20.09 (`wf_e5c34cd8-66c`, 85 agentów, CLAUDE.md po ścięciu) z ostatnim wpisem `usage` na odpowiedź API;
role nieobecne w tym runie — z epoki 09-08..09-17 po korekcie CLAUDE.md (kontrfakt d4r). Częstości warunków (faza z kodem, faza z testami, faza z tekstami UI,
faza z migracją, zadanie z E2E) — z 23 faz oferty-online po 06.09 (`git log` gałęzi zadań, pliki w diffie fazy), liczone w kroku 0.

**Walidacja przed użyciem.** Projekt 0 wpisany w tym samym formacie co projekty musi odtworzyć koszt faz runu 20.09 z dokładnością ±5% (przed zmianą kontekstu)
i dźwignię ≈48% (po zmianie kontekstu, mini-run (e)). Bez tego skrypt nie liczy projektów.

**Wejście od projektanta — tabela `role_koszt[]`** (projektant NIE podaje kwot):
`rola` (nazwa w projekcie), `analog` (istniejąca rola z listy `rola()` d4r — lista w prompcie; dla ról nowych najbliższy odpowiednik + uzasadnienie),
`klasa` (7 klas §12), `model`, `effort`, `wywolania_na_faze` (liczba albo `per_finding` z mnożnikiem), `warunek` (zawsze / faza_z_kodem / faza_z_testami /
faza_z_ui / faza_z_migracja / zadanie_z_e2e / raz_na_zadanie), `mnoznik_tur` (domyślnie 1; inna wartość wymaga powodu z danymi), `uzasadnienie`.
Plus `bramki[]` (nazwa, gdzie, szacunek sekund ze źródłem).

**Czego nie liczy (w wyniku jawnie):** wpływu efortu na koszt (harness nie zapisuje efortu — PA-22; skrypt podaje wariant ±20% części „praca” ról, którym projekt
zmienia efort), kosztu fałszywych alarmów nowych list w pętli fix, kosztu wdrożenia (6a pkt 18 L17: nie jest kryterium).

## 4. Run 1 — projektanci per architektura review

**Ile i jakie — z danych.** Review to największa pozycja zależna od architektury: reviewerzy 24,7% kosztu runu 20.09 (29,2% epoki), sceptycy 7,1% (6,3%), naprawiacze
16,1% (14,9%) — pętla fix rośnie z liczbą findingów (d4r §2). Po allowliście reviewer zachowuje 56–67% kosztu, więc wybór architektury waży po zmianie kontekstu
więcej, nie mniej. Każda architektura to jedna hipoteza o tym, dlaczego 164/195 uwag B przeszło mimo właściciela i reguły:
- **A — granica uwagi per soczewka** (osie + polecenia-listy + sceptyk asymetryczny). Dowód: ETAP1 45/68 z regułą, ETAP1B 164 w zakresie; ETAP1 roster 6 → 5
  i listy per oś to twarde wejścia (§2a). To domyślny szkielet — broni go projektant, żeby był równie dopracowany co wyzwania.
- **B — wariancja pojedynczego przejścia** (n=3 równoległe próbki 2–3 osi skrajnych, różna kolejność diffu, agregator). Dowód: POMIARY §4 — powtórka review na tym
  samym kodzie odtwarza ~50% findingów; D1r — 22/44 nowych findingów po fixie to przeoczenia w kodzie oglądanym; ETAP2 — powtórka równoległa pomaga, sekwencyjna
  szkodzi (wzór Bugbot). Wariant nazwany w §2a jako „do rozważenia przez panel”.
- **C — soczewki nie są dźwignią** (1 reviewer z budżetem + pełne bramki). Dowód za: mini-run (d) — 400 vs 100 poleceń bez straty markerów (+72% kosztu); dźwignie
  nie sumują się (§1 pkt 4). Dowód przeciw: POMIARY §2 — ESLint trafia 1/97 uwag B, bramki nie zastępują osi. C daje dolną granicę kosztu i jest porównaniem,
  którego chce POMIARY §5 pkt 4; ograniczenie z precedensu §1 pkt 2 opisane w §1 wyżej.

Czwarta architektura (hybryda A+B) nie dostaje projektanta: B z definicji może zostawić pozostałe osie jako soczewki, a synteza składa rekord per decyzja,
więc dobre elementy przegranych nie giną. Jeśli operator chce oszczędzić, C da się pominąć (−1 agent, ~−2 M); tracimy dolną granicę kosztu. **Operator 2026-09-24: C zostaje** („koszty nas dziś
silniej wiążą niż efekt” — dolna granica kosztu jest potrzebna).

**Wejście (czyta w całości):** PANEL-WEJSCIE.md; `dane/dane-digest.md`; ETAP1-ROZSTRZYGNIECIE.md; ETAP1B-ROZSTRZYGNIECIE.md §3–§4; ETAP2-ROZSTRZYGNIECIE.md;
PROMPT-AUDIT.md §4; INSPIRACJE-POCOCK-PSTACK.md §1 i §3 (B1, B2, B6, B7); `dane/d5b-mapa-walidacji.txt`; `dane/d3-mapa-rol-agentow.txt` (45 slotów ról);
`dane/d4r-dzwignia-kontekstu.txt` §2 (koszt per klasa); ten plik §1 (decyzje), §2 (rubryka sędziego — bez przypadków), §3 (format `role_koszt[]`).
Na żądanie: pliki `.claude/` szablonu (obecne prompty, workflowy) — tylko odczyt.
**NIE dostaje:** werdyktów workflow-A (`dane/workflow-A-werdykty-6-osi.txt`, `workflow-A-wyniki-czesciowe.json`, HANDOFF §4 — dane v1 zawyżone ~2×),
pliku przypadków (`panel-zestaw-historyczny.jsonl`), projektów pozostałych projektantów, PROPOZYCJA-* (wchłonięte do pakietu), HANDOFF (pakiet go kompiluje).

**Schemat wyniku (StructuredOutput):**
- `architektura` — {id, sklad_review[] (rola, soczewka, warunek uruchomienia, model, efort), agregacja, dossier, sceptyk, jak_spelnia_precedens_1_2, konflikty[]};
- `decyzje[]` — dla D2–D12 (D1 = własna architektura): {id, wybor, odrzucone[] z powodem, dlaczego (liczba + plik źródłowy), metryka (wpis mapy + pole + baseline +
  horyzont), warunek_odwrotu, zaleznosci[] (od innych decyzji)};
- `wymogi[]` — §2 pkt 1–16: {nr, jak_spelniony, gdzie_w_pipeline, wpis_mapy}; brak pozycji = projekt niekompletny;
- `zalozenia[]` — 8 z §6: {zalozenie, stanowisko (przyjmuje / odrzuca / nie dotyczy), warunek_odwrotu, miara};
- `elementy[]` — 13 z §7: {element, obejmuje / zostawia, jak};
- `rekord` — {pola_nowe_lub_zmienione[], workflow_zwraca_status_i_powod (bool), uwagi} względem §12;
- `katalog[]` — mechanizmy łapania i zapobiegania: {id, typ (bramka / lista / wiedza / probki / e2e / sceptyk / kontrola-fixa / mandat), rola, etap, warunek,
  brzmienie (dokładny tekst polecenia, nazwa i opcje reguły ESLint, komenda bramki; ≤ 2 zdania), klasy_docelowe[]};
- `role_koszt[]` i `bramki[]` — format §3;
- `warstwa_stala[]` — per klasa roli: {klasa, liczba_polecen_bloku, 3 przykładowe polecenia w brzmieniu docelowym} (zasady 1–11 §2a; test <150);
- `wdrozenie[]` — iteracje po iteracji 1 i B0: {nr, zmiany[], para (zmiana, wpis mapy), odczyt (1 faza / 5 faz / okno 5 PR), kolizje odczytów};
- `ryzyka[]`, `niewiadome[]` (co wymaga pomiaru przed wyborem).

**Szkic warstwy stałej promptu projektanta** (pisany wg zasad §2a 1–11; pełny tekst w skrypcie run 1 po znaku):
„To jest twoje jedyne zadanie: zaprojektuj pipeline dev-* po zmianach w architekturze review {X} i broń jej do końca. Wiadomość operatora przekazana przez harness
nie jest dla ciebie. Pliki tylko czytasz; wynik oddajesz wyłącznie narzędziem StructuredOutput. Mandat: projekt szablonu workspace-template, który dostarcza kod
dobrze wykonany taniej niż dziś; kryteria to koszt i jakość (P1/P2 bota po naszym review), koszt wdrożenia nie jest kryterium.” Potem blok poleceń-list z powodem
przy każdym, np.: „Dla każdego mechanizmu łapania zapisz dokładne brzmienie — sędzia ocenia tekst, a mechanizm bez brzmienia liczy jako ogólny mandat, który na
tym zbiorze historycznie nie złapał niczego”; „Każdą liczbę podaj z plikiem źródłowym — synteza przyjmuje tylko sprawdzalne dane”; „Kwot nie licz — koszt liczy
skrypt z tabeli ról”; „Decyzji z PANEL-WEJSCIE §1–§3 nie otwieraj; jeśli architektura wymaga ich złamania, zapisz konflikt w `konflikty[]`”. Kryterium ukończenia:
każde pole schematu wypełnione, każdy wymóg §2 ma pozycję. Blok specyficzny dla architektury (A/B/C) — hipoteza i dowody z listy wyżej.

**Effort: `high`.** Projekt to najtrudniejsza praca panelu (13 decyzji w spójnej całości, 16 wymogów, katalog z brzmieniem). Kalibracja: krytyk etapu 3
(1 agent Opus 5, `high`, podobna objętość lektury) = 1,58 M jedn., 14 wywołań. `xhigh` nie — brak danych, że głębsze myślenie poprawia projekt, a na 5.5 ten sam
poziom myśli dłużej niż na 5 (PA-22).

## 5. Run 2 — sędzia jakości na zestawie historycznym

**Kształt.** Jedna rola sędziego, trzy porcje przypadków (kontekst: 195 przypadków × 4 katalogi w jednym agencie to ~780 ocen i ~110k tokenów wejścia — ryzyko
spadku staranności pod koniec). Porcje po osi-właścicielu, żeby sędzia miał spójny materiał: S1 correctness 77; S2 test-coverage 39 + code-quality 12 + e2e 4 +
domknięcie 2 = 57; S3 security 38 + spec 15 + performance 8 = 61. Każda porcja ocenia **każdy przypadek względem wszystkich czterech katalogów naraz** — porównanie
projektów robi ten sam sędzia na tym samym przypadku (to zastępuje „trzech sędziów”, a nie powiela jednej opinii).

**Wejście:** porcja przypadków (JSONL wklejony do promptu przez skrypt — sędzia nie szuka zakresu sam, zasada §2a pkt 5), cztery katalogi `katalog[]` z etykietami P/Q/R/S
(permutacja per porcja: S1 PQRS, S2 QRSP, S3 RSPQ z mapowaniem trzymanym w sesji głównej), rubryka §2. Na żądanie: compound z pola `compound`, pliki
oferty-online (odczyt) gdy opis nie wystarcza. **NIE dostaje:** nazw architektur, uzasadnień projektantów, kosztu, informacji, który katalog jest dzisiejszy.

**Schemat wyniku:** `oceny[]` {id_przypadku, kolumny: {P, Q, R, S}: {kategoria, mechanizm_id, etap, pewnosc, uzasadnienie}}, `trudne[]` (przypadki, w których
rubryka nie wystarcza — z powodem).

**Effort: `medium`.** Ocena jest przypisaniem wg zamkniętej rubryki na krótkim opisie, powtarzanym ~240 razy na porcję; kolumna kalibracyjna pokaże łagodność.
Jeśli kalibracja przekroczy próg (§10), ta porcja idzie ponownie z `high` (koszt ~+1 M).

**Po runie (skrypt `panel_pokrycie.py`):** profil pokrycia per projekt: kategorie × waga × rodzina × ogon × epoka; różnica względem kolumny 0; lista przypadków,
w których projekty się różnią (materiał dla sceptyków).

## 6. Run 3 — sceptyk asymetryczny per otwarta decyzja

**Wejście per decyzja (asymetria):** decyzja i opcje (§1), **wstępny wybór** sesji głównej (opcja + metryka + warunek odwrotu) **bez uzasadnienia**, dane
liczbowe dla wszystkich opcji (koszt ze skryptu, profil pokrycia sędziego), lista plików danych. Sceptyk nie widzi argumentów projektantów ani syntezy.
**Odpowiedź per decyzja:** AGREE / DISAGREE_EVIDENCE (wymaga wskazania: plik danych + wartość, albo plik kodu + linia, albo przypadek z zestawu) /
DISAGREE_CONCERN (nie zmienia wyboru, obniża pewność, idzie do ryzyk) + opcjonalnie `brakujaca_opcja` z dowodem.

**Grupy (3 agentów, każda decyzja oceniana osobno w obrębie agenta):** G1 review: D1, D2, D3, D4; G2 weryfikacja i jakość: D5, D7, D10, D12;
G3 konfiguracja, plan, wdrożenie: D6, D8a, D8b, D9, D11. Grupowanie po temacie, bo dowody dla decyzji w grupie leżą w tych samych plikach (jeden odczyt).

**Effort: `high`.** Sceptyk musi znaleźć dowód w danych albo kodzie, a zarzut bez dowodu nie liczy się — to praca wyszukiwania i sprawdzania, nie przypisywania.

## 7. Synteza w sesji głównej → rekord per decyzja

1. Po run 1: kompletność (każdy wymóg §2, każde założenie §6, każdy element §7, pole rekordu §12) — skryptem na JSON; projekt niekompletny → jedna tura naprawy
   (nowy agent z listą braków i poprzednim wynikiem; bez ponownego projektowania). Koszt skryptem (§3). Katalog projektu 0 (§2).
2. Po run 2: profil pokrycia; kalibracja kolumną 0.
3. Wstępny wybór per decyzja: z opcji zaproponowanych przez projektantów (niezależnie od tego, który projektant wygrał D1 — decyzje D2–D12 mogą pochodzić
   z różnych projektów), z kontrolą spójności zależności (`zaleznosci[]`; np. D2 i dedup zależą od D1).
4. Po run 3: DISAGREE_EVIDENCE → zmiana wyboru albo odpowiedź z danymi w rekordzie; CONCERN → ryzyka.
5. **Rekord per decyzja:** {id, wybor, alternatywy i dlaczego odrzucone, dane (koszt skryptem, pokrycie sędziego), metryka (wpis mapy walidacji, pole, baseline,
   horyzont), warunek_odwrotu, zarzuty sceptyka i odpowiedź, iteracja etapu 5, pewność}.
6. **Pliki:** `PANEL-WYNIK.md` (rekordy, docelowy pipeline jako całość, kolejność iteracji, ograniczenia) + `PANEL-WYNIK-DLA-OPERATORA.md` (narracja);
   dane: `dane/panel-run1-projekty.json`, `dane/panel-koszt.txt`, `dane/panel-run2-sedzia.json`, `dane/panel-pokrycie.txt`, `dane/panel-run3-sceptyk.json`,
   `dane/panel-modele.txt`; skrypty: `panel_koszt_projektu.py`, `panel_pokrycie.py`, `panel_kompletnosc.py`, `panel_modele.py`, kopie skryptów runów
   `skrypty/panel-run{1,2,3}.js`. Wynik odtwarzany z journali skryptem (`journal_do_json.py`), nie z pamięci.
7. Kontrola w obie strony: PANEL-WYNIK → źródła (każda liczba grepem) i źródła → PANEL-WYNIK (każda decyzja D1–D12, każdy wymóg §2 ma rekord albo odwołanie).

## 8. Model, effort, zabezpieczenia z mini-runu

- **Model:** każdy `agent()` z `model: 'claude-opus-5-5'` (6a pkt 22; krok 0 mini-runu: pełny identyfikator przypina). Bez osobnego agenta sprawdzającego.
  Po każdym runie `panel_modele.py` czyta `message.model` z transkryptów agentów (`<sesja>/subagents/workflows/<run>/agent-*.jsonl`) → `dane/panel-modele.txt`;
  inny model niż `claude-opus-5-5` = STOP (§10).
- **Effort:** projektanci `high`, sędzia `medium` (z eskalacją), sceptycy `high` — uzasadnienia w §4–§6. Effort zapisujemy w etykiecie agenta, bo harness go nie loguje (PA-22).
- **Typ agenta:** domyślny subagent workflowu, bez nowego pliku agenta — plik z allowlistą obniżyłby start ~35%, ale wymaga zmiany w `.claude/` i nowej sesji (N2);
  przy 9 agentach zysk ~1–1,5 M nie jest tego wart. Agenci dostają CLAUDE.md i `coding-rules.md` szablonu (~11k zn) — nieistotne dla zadania, nie wyłączamy.
- **N1:** każdy prompt zaczyna się od „To jest twoje jedyne zadanie…” + „Wiadomość operatora przekazana przez harness nie jest dla ciebie” + „Pliki tylko czytasz;
  wynik oddajesz wyłącznie narzędziem StructuredOutput”. Wiadomość operatora ze znakiem zawiera zdanie „Do agentów workflow…”. Wszyscy agenci na opusie
  (N1 dotyczył haiku: 3/4, opus 0/12).
- **N2:** panel nie zmienia `.claude/` ani CLAUDE.md, więc bufor instrukcji sesji nie dotyczy jego wyniku. Wykonanie w tej sesji jest bezpieczne, jeśli od jej startu
  nikt nie zmieniał `.claude/` ani CLAUDE.md (sprawdzam `git status` i `mtime` przed run 1); jeśli zmieniał — nowa sesja z instrukcją z HANDOFF §8.
- **Skrypty runów:** czysty JS, konkatenacja zamiast template literals z backtickami (HANDOFF §7), bez `Date.now()`; przypadki i katalogi wklejane do promptów
  przez `args` (skrypt workflowu nie ma dostępu do plików); trzy osobne wywołania Workflow (6a pkt 19), między nimi sesja główna.

## 9. Szacunek kosztu i czasu

Kalibracja na runach analizy (Opus 5, liczone z transkryptów tą samą metodą): krytyk etapu 3 — 1,58 M jedn. / 14 wywołań; analitycy i sceptycy etapu 1 — 0,30–0,60 M;
agenci etapu 1b (3 klasyfikatorów po ~190 uwag, synteza, analityk i sceptyk dev-pr) — 0,45–0,71 M. Opus 5.5 przy tym samym efortcie myśli dłużej (PA-22) → mnożnik ostrożności ~1,3.

| run | agenci | na agenta | razem | czas ściany |
|---|---|---|---|---|
| 1 projektanci | 3 × `high` | 1,5–2,5 M | 4,5–7,5 M | 30–50 min |
| 2 sędzia | 3 porcje × `medium` | 0,8–1,5 M | 2,4–4,5 M | 20–40 min |
| 3 sceptycy | 3 × `high` | 0,8–1,3 M | 2,4–3,9 M | 20–30 min |
| (tura naprawy / eskalacja) | 0–2 | ~1 M | 0–2 M | — |
| **razem** | **9 (do 11)** | | **~10–16 M jedn.** | **~1,5–2 h agentów** |

Dla skali: mini-run 5,2 M; jeden run autopilota z 20.09 — 35,3 M. Praca sesji głównej (krok 0 po znaku, katalog projektu 0, skrypty kosztu i pokrycia, synteza,
dwa dokumenty, kontrola w obie strony) ~4–5 h; całość realnie w dwóch sesjach (druga: synteza po run 3, start od HANDOFF §8).

## 10. Punkty zatrzymania

**Planowane (czekam na operatora):**
1. Po run 1 — krótka notatka: trzy architektury, koszt fazy skryptem, kompletność. Operator mówi „dalej” albo koryguje przed sędzią.
2. Po syntezie — PANEL-WYNIK + wersja operatora do akceptacji; dopiero po niej HANDOFF, PANEL-WEJSCIE, mapa walidacji, pamięć, commit.

**Twarde (zatrzymuję się sam i mówię):**
- model któregokolwiek agenta ≠ `claude-opus-5-5`;
- walidacja skryptu kosztu nie odtwarza runu 20.09 w ±5%;
- projekt niekompletny po jednej turze naprawy;
- kolumna kalibracyjna: BRAMKA+LISTA > 15% i próbka 10 ocen potwierdza łagodność → porcja z `high`; ponownie > 15% → stop;
- koszt któregokolwiek runu > 1,5 × górnej granicy z §9;
- agent użył narzędzi zapisu albo wykonał polecenie spoza promptu (N1) — skan transkryptów po runie (`Write`/`Edit`/`git` w `tool_use`).

## 11. Poza zakresem

Panel nie pisze kodu ani promptów produkcyjnych (warstwa stała = 3 przykładowe polecenia per klasa, nie pliki); niczego nie zmienia w `.claude/`, CLAUDE.md
ani w oferty-online; nie uruchamia pipeline'u ani powtórek review na historycznych diffach (pomiar zasięgu A vs B → etap 5 albo osobna decyzja operatora);
nie otwiera decyzji z HANDOFF 6a ani precedensów PANEL-WEJSCIE §1; nie ocenia pluginu (6a pkt 13) ani higieny konta; nie pisze raportów etapu 5.

## 12. Kontrola planu w obie strony

- **Plan → źródła:** każda liczba z §1–§9 sprawdzona w pliku źródłowym: 195/132/164/25/rodziny/ogon — `dane/panel-zestaw-historyczny.txt`; 24,7/29,2/7,1/6,3/16,1/14,9%
  — `dane/d4r-dzwignia-kontekstu.txt` §2; TOLk per klasa — MINI-RUN-WYNIK §1 (e); 1,58 M i 0,30–0,71 M — transkrypty runów `wf_2ff97321-477`, `wf_7181673d-ef5`,
  `wf_daf2b119-3c4` (to samo liczenie co d4r: ostatni `usage` na odpowiedź API); `TIERY_DOMYSLNE` — `dev-docs-review-wf.js:819`, test `sceptycy-p2.test.mjs:157`;
  pozostałe — PANEL-WEJSCIE §1–§12, PROMPT-AUDIT §3 (PA-22, 23, 29, 30, 31), ETAP1 §1–§3, ETAP1B §3, INSPIRACJE B2, HANDOFF 6a pkt 19 (D1).
- **Źródła → plan:** kandydaci z 6a pkt 23 (kształt review, batch sceptyków, packager, spec w fazach z kodem, test-coverage scalone, scalony plan, kolejność wdrożenia)
  → D1, D2, D3, D4, „przesądzone”, D8a, D11; z 6a pkt 25 (efort, warstwy weryfikacji, research, opisy dzieci) → D6, D7, D8b, D9; z 6a pkt 26 (k) → D10;
  wymogi §2 pkt 14–16 → „kształt wymogów”; otwarte z §2a / §5 hip. 2 / §6 → D2, D3, D5 lub „przesądzone”; obserwacja D1 z 6a pkt 19 → D12 (dopisana, do akceptacji);
  pozycje instrukcji operatora (krok 0 a–c, run 1–3, model, effort, N1, N2, koszt, czas, zatrzymania, zakres) → §1–§11.

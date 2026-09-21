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
| 2 | Research zewnętrzny (5 kierunków) + mapowanie na nasz pipeline | **GOTOWE 2026-09-20** (run `wf_f3c27f89-972`, 7 agentów Opus, skrypt `skrypty/workflow-D-etap2-research.js`, odtworzenie `skrypty/journal_do_json.py`). Dane: `dane/workflow-D-etap2-wyniki.json`, czytelnie `dane/etap2-research/*.txt`. **Rozstrzygnięcie: `ETAP2-ROZSTRZYGNIECIE.md`** (wersja dla operatora: `ETAP2-DLA-OPERATORA.md` — od etapu 2 każdy etap ma obie wersje) — 6 ustaleń przekrojowych (IFScale: reguły cicho pomijane; powtórka sekwencyjna szkodzi, równoległa pomaga; sceptyk asymetryczny 4× skuteczniejszy; `omitClaudeMd` potwierdzone, `paths:`/rules w subagentach — docs milczą; 3 warstwy testów niefalsyfikowalnych, StrykerJS bez `--since`; 2 reguły coding-rules sprzeczne z docs), mapa 22 elementów, **4 pomiary jako warunek wejścia do etapu 4** (§3). |
| 2½ | 4 pomiary przed etapem 4 (ETAP2 §3) | **GOTOWE 2026-09-20** (skrypty + `claude -p`, zero agentów analizujących). **`POMIARY-ROZSTRZYGNIECIE.md`** + `POMIARY-DLA-OPERATORA.md`. Sedno: (1) reguły `paths:` działają w każdym typie subagenta przy Read/Edit, NIE przy `cat`/Write/ls; `omitClaudeMd` działa też w Workflow; **allowlista `tools:` to −50k tokenów startu agenta (62k → 11,6k → 4,5k z omitClaudeMd), żaden z 16 agentów szablonu jej nie ma**; (2) ESLint trafia 1 z 97 uwag B bota po linii — uwagi B są semantyczne, bramki gaszą koszyk A i zapobiegają, nie kasują osi; (3) czasy bramek na 585 plikach: tsc 10 s, ESLint 1,3 s z cache, knip 2 s, size-limit <1 s; (4) powtórka review na tym samym kodzie odtwarza ~50%, po fixie ~0% — nowe findingi to review kodu naprawczego (17/19 w plikach zmienionych fixem). Dane: `dane/pomiar1-reguly-subagenci/`, `pomiar2-lint-uwag-B/`, `pomiar3-bramki/`, `pomiar4-powtorki-review.json`. |
| 3 | Krytyk kompletności | **GOTOWE 2026-09-20** (run `wf_2ff97321-477`, 1 agent Opus effort high, 29 min, skrypt `skrypty/workflow-E-etap3-krytyk.js`). Dane: `dane/workflow-E-etap3-wyniki.json`, czytelnie `dane/etap3-krytyk/`. **Rozstrzygnięcie: `ETAP3-ROZSTRZYGNIECIE.md` + `ETAP3-DLA-OPERATORA.md` (główny produkt).** Krytyk: 19 luk, 4 blokujące, werdykt „nie". Sesja główna: **panel może startować po 4 domknięciach D1–D4 (ETAP3 §7, ~2 h, zero agentów)**: D1 klasyfikacja 33 findingów powtórek po fixie (wprowadzone fixem / przeoczone / kod nietknięty), D2 zliczenie instrukcji per reviewer/builder (budżet IFScale), D3 tabela oś → plik agenta (9 ról ma plik, ~24 nie — `agent()` w Workflow nie ma opcji `tools:`), D4 słowo operatora: test-coverage ZOSTAJE (POMIARY §2 nad ETAP2 §2) + precedensy 6a pkt 15 nad POMIARY §5 pkt 1. Dźwignia kontekstu po 6a pkt 15 przeliczona: **25–35%, nie 30–40%** (kolejność priorytetów bez zmian). Polecenia-listy = założenie z warunkiem odwrotu. Propozycja: czwarty wymiar sędziów „koszt wdrożenia jednoosobowego". 15 ryzyk do raportu + lista elementów nietkniętych (§5). |
| 3½ | Domknięcia D1–D5 przed panelem (jedno po drugim, po każdym rozmowa z operatorem) | **D1 GOTOWE 2026-09-21** (`skrypty/d1_atrybucja_po_fixie.py`, `dane/pomiar5-atrybucja-po-fixie.{json,txt}`, dopisek w POMIARY §4): 33 findingi = A urodzone w fixie 13 (39%, w tym jedyny P1; wszystkie 10 kodowych to skutek naprawy findingu rundy 1, kontrola diffu nie złapała żadnego) / B przeoczone w rundzie 1 w pliku fixa 14 (42%, 5 P2) / C przeoczone w kodzie nietkniętym 6 (18%). „Review kodu naprawczego" z POMIARY §4 było za mocne — składnik recall rundy 1 jest większy (60%). **D2 GOTOWE 2026-09-21** (`skrypty/d2_budzet_instrukcji.py`, `dane/pomiar6-budzet-instrukcji.{json,txt}`, wynik w ETAP3 §7): reviewer security dziś ~365 instrukcji (górna ~710 — learned-patterns ×2: eager + dossier, 5,7 nakazu/regułę), builder danych ~537 (górna ~710); po 6a pkt 15/17 reviewer ~310–320, builder ~520–530 — nadal pasmo IFScale 150–500; największe bloki: coding-rules 117–130, skille buildera 178, plik agenta security 104, iu.prompt 97. Wejście do panelu: budżet instrukcji projektować per rola jako całość (cel <150), nie „4–5 poleceń na oś". **D3 GOTOWE 2026-09-21** (`dane/d3-mapa-rol-agentow.txt`): 45 slotów ról = 36 bez pliku agenta + 9 z plikiem (8 plików); autopilot 19 wywołań, zero `agentType`; prompt osi w 2 miejscach (4 osie) / tylko w workflowie (correctness, test-coverage); telemetria: 3 klasy ról po kontekście na turę (haiku 86–102k, orkiestracyjne 119–168k, reviewerzy 193–224k, buildery 238k); decyzja operatora: pliki agentów per KLASA roli, per rola jako wyjątek (6a pkt 18). **D4 GOTOWE 2026-09-21** — `PANEL-WEJSCIE.md` (12 sekcji, sama kompilacja, zero nowych decyzji): §0 skład panelu i co kto czyta (sędziowie: koszt + jakość = P1/P2 od bota; koszt wdrożenia NIE jest kryterium; plugin nie jest wariantem), §1 sześć precedensów (wersja B kontekstu, test-coverage ZOSTAJE, brak lekkiej rundy po fixie, dźwignia 25–35%, L7 niska waga, STOP E2E→MANUAL nad „sam tester" z ETAP1), §2 jedenaście twardych wymogów każdego projektu (6a pkt 15–18: `tools:` + pliki per klasa, trzy warstwy instrukcji <150 jako test szablonu, learned-patterns 3 poziomy + 8 zabezpieczeń, telemetria mechaniczna, E2E→MANUAL, sceptyk asymetryczny, security warunkowe po stacku na chmurze, fix bez dodatkowej rundy, zakaz powtórek sekwencyjnych, polecenia-listy z warunkiem odwrotu), §3 decyzje 6a pkt 1–14 po linii, §4 D1–D3, §5 dziewięć hipotez HANDOFF §5 ze stanem po decyzjach (hip. 7 NIEAKTUALNA, hip. 3 rozstrzygnięta: roster 6 → 5), §6 osiem założeń z warunkiem odwrotu, §7 trzynaście elementów nietkniętych z tym, co projekt ma zrobić, §8 tezy na jednym filarze po D1, §9 ograniczenia do raportu, §10 lista zmian szablonu poza panelem, §11 mini-run 6a pkt 16 + dodatki (d) 100 vs 400 instrukcji, (e) `usage` per klasa roli, §12 placeholder na D5. **D5 — NIE ZROBIONE:** szkic rekordu telemetrii (pola) + który skrypt i w którym miejscu runu go dopisuje (6a pkt 18), ~30 min; plik `dane/d5-telemetria-rekord.txt` + sekcja w PANEL-WEJSCIE.md. Po D5: pokazać operatorowi, rozmowa, potem etap 4 na jego znak. |
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
15. **Decyzje po pomiarach (2026-09-20, po rozmowie o POMIARY-ROZSTRZYGNIECIE):**
    - **Tryb bypass zostaje** dla subagentów, więc czytanie Bashem (`cat`/`sed -n`) zostaje. Konsekwencja: reguły `paths:` NIE są kanałem dostawy wiedzy
      do builderów (nigdy się u nich nie załadują) — co najwyżej bonus dla agentów, które użyją Read. Nie budować na nich architektury.
    - **Allowlista `tools:` u wszystkich agentów pipeline'u** — zaakceptowane (−50k tokenów startu/agent; 498 z 514 agentów nie wołało MCP; tester E2E
      i buildery UI z Figmą dostają dodatkowo swoje serwery).
    - **CLAUDE.md (po odchudzeniu, 20,6k zn) TRAFIA do builderów i reviewerów** — nie wyłączać. `omitClaudeMd: true` tylko dla agentów mechanicznych
      nie patrzących na kod (stan:zapis, telemetria, dedup, precheck, kontekst:diff).
    - **learned-patterns (49k zn, ładowany bezwarunkowo do 35 agentów):** kierunek = **orkiestrator wkleja wycinek** (JS dobiera z formatu klasa → reguła
      → źródło tylko klasy pasujące do plików IU i dokleja 1–2k zn do promptu buildera/reviewera; przy planowaniu dev-plan czyta całość). Operator NIE chce
      czytać learned-patterns sam. Wariant „wiedza poza kontekstem agentów" odrzucony jako domyślny. Do potwierdzenia mini-runem (niżej).
    - **Skille bazowe builderów (`skills:` w frontmatterze, 7–12k tok/agent):** działa, zostawić; dobór per IU nie jest warty logiki w orkiestratorze.
    - **Pętla fixów: ŻADNEJ dodatkowej rundy review** (historia „fixa po fixie" = przepalone tokeny; sufit jednego cyklu w `fix:kontrola` zostaje).
      Zamiast tego: (1) `fix:kontrola` dostaje polecenia-listy correctness zawężone do diffu fixa (ten sam 1 agent, ten sam cykl); (2) builder fixa
      naprawia tylko P1/P2, P3 → known-issues/bot, zakaz zmian poza zgłoszonym miejscem (mniejszy diff = mniej nowych odkryć); (3) reszta → CodeRabbit
      w dev-pr. Miara: P1/P2 od bota w plikach dotkniętych fixami po 5 zadaniach.
17. **Decyzje operatora 2026-09-20 (druga rozmowa po pomiarach):**
    - **Sceptyk asymetryczny: TAK** — prompt verify: sceptyk dostaje sam zarzut (plik:linia + teza) bez uzasadnienia autora; odpowiada etykietą
      AGREE / DISAGREE_EVIDENCE (musi wskazać linię kodu lub test) / DISAGREE_CONCERN (nie kasuje findingu, obniża wagę); dla P1 naprawa zawiera test
      padający przed poprawką.
    - **Struktura learned-patterns: PRZYJĘTA.** Trzy poziomy: (0) CLAUDE.md — jedna linia wskazująca indeks; (1) `docs/learned-patterns.md` — indeks
      GENEROWANY przez dev-compound-refresh z nagłówków solutions (klasa | reguła 2 zdania | wzorce plików | waga | link), bramka rozmiaru i dedup w JS
      przy generowaniu, nikt nie edytuje ręcznie; (2) `docs/solutions/*.md` — szczegóły, bez limitu, frontmatter z polami klasa/reguła/paths/waga
      (jedyne źródło prawdy). Plik wychodzi z `.claude/rules/` (nie jest już ładowany eager). Orkiestrator wkleja builderowi/reviewerowi tylko wpisy
      pasujące do plików IU; dev-plan czyta indeks w całości. Luki i zabezpieczenia: patrz odpowiedź w sesji 2026-09-20 (słownik klas, walidacja globów,
      koszyk „zawsze" z twardym limitem, walidacja frontmatteru w JS, ten sam wycinek dla reviewerów, data + źródło + licznik ucieczek per wpis,
      jednorazowa konwersja obecnych 49k zn skryptem).
    - **Higiena konta (MCP/pluginy per projekt, audyt pluginów): osobny etap po raportach**, przeprowadzony na tym projekcie, z wnioskami do szablonu.
    - **8 zabezpieczeń learned-patterns PRZYJĘTE przez operatora** (wejście do panelu): walidacja globów przy generowaniu indeksu; zamknięty słownik
      klas w szablonie; koszyk „zawsze" z twardym limitem w JS; walidacja frontmatteru solutions w JS (compound odmawia zapisu bez pól); ten sam wycinek
      do reviewerów przez dossier; data + źródło + licznik ucieczek per wpis (zasila dev-pr); jednorazowa konwersja 49k zn skryptem z listą odrzutów
      dla operatora; dopasowanie po katalogach IU, nie po nazwach plików. Plus bramka „zielony main" w bootstrapie autopilota.
    - **ETAP 3 STARTUJE W NOWEJ SESJI** — wszystkie decyzje do etapów 3–5 są w tym pliku (6a pkt 1–17), ETAP1/1B/2 i POMIARY. Nie pytać o nie ponownie.
    - Docker i czerwone testy oferty-online: **nie są blokerem niczego teraz** — advisors zmierzymy przy wdrożeniu bramki; czerwony main to finding
      dla szablonu (bramka „zielony main" w bootstrapie autopilota), nie zadanie dla operatora w tej analizie.
16. **Mini-run w etapie 4 (przed panelem, ~1 h, metoda markerów z pomiaru 1):** trzy pytania na jednym małym zadaniu buildera: (a) czy reguła-marker
    wklejona przez orkiestrator do promptu delegacji („każdy nowy plik zaczyna się komentarzem X") jest STOSOWANA w kodzie; (b) to samo dla reguły
    dostarczonej przez `paths:` (kontrola); (c) czy treść skilla wstrzykniętego przez `skills:` jest stosowana (marker w SKILL.md testowym), czy tylko
    zajmuje kontekst. Wynik rozstrzyga wariant learned-patterns i to, czy `skills:` zostaje bez zmian.

18. **Decyzje operatora po etapie 3 (2026-09-21, po lekturze ETAP3-DLA-OPERATORA):**
    - **L7 (model kosztu sprzed N1–N9): niska waga** — realną ocenę zmian da dopiero wdrożenie na prawdziwym projekcie; do raportu jako uwaga, nie jako ryzyko.
    - **L8 (−50k to konto z pełnym MCP): wiedza do podzielenia się** — raport ma opisać, jak radzić sobie z dużą liczbą MCP/skilli na koncie (allowlista `tools:`), jako wartość sama w sobie.
    - **L10 (advisors): Supabase WYŁĄCZNIE chmurowe, ZERO Dockera** — advisors mierzyć przez Management API / Supabase MCP (`get_advisors`) na projekcie chmurowym, nie `supabase db advisors` lokalnie. Bramka domknięcia fazy musi działać na chmurze.
    - **L11 (E2E): mechanizm „test nie może się wykonać → przełącz na manual, nie zatrzymuj autopilota"** — STOP E2E przez środowisko/limit zewnętrzny = checkbox przechodzi na [MANUAL] z powodem, run idzie dalej. Wymóg dla każdego projektu panelu.
    - **L13 (/bugfix): operator praktycznie nie używa, kandydat do usunięcia z szablonu** — miara jakości = CodeRabbit (+ Sentry po wdrożeniu). Na listę zmian szablonu.
    - **L17 (koszt wdrożenia): NIE jest kryterium sędziów** — zysk z lepszego workflow przewyższa koszt naprawy; wdrożenie będzie fazowe wg planu z etapu 5. Propozycja czwartego wymiaru WYCOFANA.
    - **L19: poprawić generator** (`coderabbit-setup/templates/coderabbit-base.yaml`) i opisać w skillu, jak konfigurować bota, żeby nie produkował szumu.
    - **NOWE — telemetria centralna, mechaniczna, zero tokenów:** operator chce za miesiąc po wdrożeniu usiąść i mieć zebrane dane łatwe do analizy (co działa, co nie). Wymóg: zbieranie NIE może zwiększać kosztu — żadnych agentów (scribe haiku skasował JSONL 2×), tylko skrypt po zakończeniu runu czytający `journal.jsonl` + transkrypty (`usage`) i dopisujący jeden rekord per agent/faza do globalnego JSONL (run, zadanie, faza, rola, model, tury, cache read/write/output, czas, findingi per oś, wynik bramek, przyczyna STOP/MANUAL) + skrypt raportu miesięcznego. To produktyzacja `skrypty/koszt_agentow.py`. **Wejście do panelu: każdy projekt ma wbudowaną telemetrię mechaniczną.**
    - Potwierdzenia rozumienia (nie decyzje): L1 = tak, dopisać pliki definicji per rola; L2 = tak, listy zamiast długich reguł, skuteczność do weryfikacji po wdrożeniu; L3 = tak, klasyfikacja źródła 33 findingów; L12 = tak, słownik klas do stworzenia; L15 = tak, audyt agentów review; L16 = wartość informacyjna (typ kodu, nie rozmiar).
    - **Po D2 (2026-09-21, operator: „wybierz i doradź") — BUDŻET INSTRUKCJI W TRZECH WARSTWACH, twardy wymóg każdego projektu panelu (jak telemetria):**
      (1) warstwa STAŁA na rolę (mandat, kilkanaście poleceń-list, format wyniku, bloki workflowu) — **budżet <150 instrukcji**, liczony skryptem tą samą
      metodą co `skrypty/d2_budzet_instrukcji.py` — **NIE w runie** (operator 2026-09-21: „autopilot ma się nie stopować przez kilka linii"), tylko jako TEST
w `.claude/workflows/__tests__` szablonu (pada przy edycji promptów/agentów, gdy rola przekracza budżet) + w sync-template/doctor przy instalacji; w runie
co najwyżej liczba w telemetrii, zero STOP-ów; (2) warstwa REFERENCYJNA bez limitu,
      podzielona po warstwie kodu i temacie (reguły zachowaniowe z coding-rules, checklisty z dzisiejszych skilli buildera, wpisy learned-patterns) —
      **orkiestrator dokleja po plikach jednostki** (rozszerzenie 6a pkt 15/17 z learned-patterns na całą wiedzę projektu; NIE polegać na „agent sam sięgnie",
      bo instrukcja „przeczytaj X" jest pomijana jak każda inna — ETAP1 45/68); (3) warstwa MECHANICZNA (ESLint/knip/advisors) — znika z tekstu.
      Wzorzec skillowy (agent sam sięga po referencję) zostaje tylko jako uzupełnienie dla sytuacji nieprzewidzianych przez skrypt. Skille buildera:
      mechanizm `skills:` zostaje (6a pkt 15), treść DZIELONA na warstwę stałą i referencyjne, nie skracana. Odrzucone: czyste wycinanie (traci wiedzę),
      czysty model skillowy (zależy od pamięci modelu). Do mini-runu 6a pkt 16 dołożyć parę: ten sam marker w prompcie ~100 vs ~400 instrukcji.
    - **Po D3 (operator 2026-09-21: „pasuje") — PLIKI AGENTÓW PER KLASA ROLI jako domyślne, per rola tylko jako wyjątek.** Uzasadnienie: prompty 36 ról
      bez pliku są dynamiczne (funkcje w JS z argumentami), więc plik niesie WYŁĄCZNIE ustawienia (model, `tools:`, `omitClaudeMd`, `skills:`, krótki mandat);
      telemetria D3 pokazuje 4–5 zestawów ustawień (mechaniczny-haiku, orkiestracyjny-opus, reviewer, sceptyk, naprawiacz z Edit+skille). Istniejące 8 plików
      (4 reviewerów, tester E2E, 3 buildery) = wyjątki per rola. Docelowo kilkanaście plików zamiast 40. Wejście do panelu jako preferowany kierunek.
    - **L4 (test-coverage): TAK (operator 2026-09-21)** — oś test-coverage ZOSTAJE; trzy warstwy mechaniczne to dodatki z wynikiem do buildera; scalenie z correctness tylko jako opcja wariantu z warunkiem odwrotu i po pomiarze warstw 2–3. Obowiązuje POMIARY §2 nad ETAP2 §2.
    - **L10 uzupełnienie (operator 2026-09-21): reguły security nie są USUWANE, tylko WARUNKOWE po profilu stacku** (rozszerzenie 6a pkt 6). Projekt z `supabase/` → bramka advisors (chmura) przejmuje RLS/search_path/auth.users, a security dostaje polecenie „nie sprawdzaj tego, robi to advisors". Projekt bez Supabase (np. Postgres na VPS) → security zachowuje polecenia-listy o RLS/politykach, bo nie ma bramki. Profil stacku z package.json + katalogów trafia do promptu każdego reviewera (dossier), nie tylko builderów.
    - **L15: robimy w domknięciach przed panelem** (D3, 20 min) razem z D1 i D2 — na znak operatora.
    - **Telemetria: „trzeba też to przygotować"** → nowe domknięcie **D5 (~30 min):** szkic rekordu telemetrii (pola) + wskazanie, który skrypt i w którym miejscu runu go dopisuje (produktyzacja `skrypty/koszt_agentow.py`); wejście do panelu jako element obowiązkowy każdego projektu; implementacja w planie etapu 5.
    - **L5: WERSJA B (operator 2026-09-21)** — obowiązuje 6a pkt 15: CLAUDE.md (odchudzony) u builderów i reviewerów, `omitClaudeMd` tylko u agentów mechanicznych, bypass i czytanie Bashem zostają, reguły `paths:` = bonus. POMIARY §5 pkt 1 i HANDOFF §5 hipoteza 7 są NIEAKTUALNE — zapisać w pakiecie wejściowym panelu.
    - **Po D4 (operator 2026-09-21): L11 nadpisuje ETAP1 „powtórka po STOP-ie E2E = sam tester"** — STOP środowiskowy/limitowy → [MANUAL], run idzie dalej;
      zapis ETAP1 i HANDOFF §5 hipoteza 4 NIEAKTUALNE (nie ma powtórki po STOP-ie, który nie zatrzymuje runu). Wpisane jako precedens 6 w PANEL-WEJSCIE §1.
    - **L14 — hooki Stop i dwa martwe agenty: POTWIERDZONE przez operatora 2026-09-21 (wszystkie trzy punkty):** (a) `stop-build-check-enhanced.sh` (tsc po każdej odpowiedzi w sesji głównej) ZOSTAJE — działa poza autopilotem, zero tokenów; (b) `error-handling-reminder.sh` (console.log / captureError w edytowanych plikach, exit 2 = dodatkowa tura) → WYCOFAĆ, gdy bramka ESLint (`no-console` + reguła Sentry) wejdzie do domknięcia fazy; (c) `kieran-typescript-reviewer.md` i `code-simplicity-reviewer.md` to ścieżka odwrotu konsolidacji z 2026-09-03 (`dev-docs-review-wf.js:349-359`), nie przypadkowe resztki — po panelu ścieżka odwrotu traci sens; ich treść (kieran §4b async/błędy, §5 usunięcia i regresje, §7 sygnały ekstrakcji modułu; simplicity: YAGNI) posłuży jako materiał do poleceń-list osi correctness i code-quality, a pliki do USUNIĘCIA. NIE wplatać w inny proces.

## 7. Uwagi techniczne, żeby nie powtarzać błędów tej sesji

- Hook `md-guard` blokuje zapis `.md` przez Bash (heredoc/python) — pliki `.md` pisz WYŁĄCZNIE narzędziem Write/Edit; dane robocze zapisuj jako `.txt`/`.json`/`.csv`.
- Skrypt Workflow to czysty JS bez template literals z backtickami wewnątrz stringów zawierających backticki — pierwszy skrypt padł na parse; używaj konkatenacji `'...' + '...'`.
- Prompt dla `claude-code-guide` nie może być długi („Prompt is too long") — ten agent ma mały limit; daj mu 1–2 pytania.
- W transkryptach agentów jedna odpowiedź API = kilka wpisów `assistant` z tym samym `message.id` i tym samym `usage` — licz raz per id (poprawione w `koszt_agentow.py` v2).
- Etykiety agentów: nowsze runy mają `description` w `agent-*.meta.json` lub `label` w `journal.jsonl`; starsze wymagają klasyfikacji po początku promptu (`klasyfikuj()` w `koszt_agentow.py`).
- Scratchpad sesji (`/private/tmp/claude-501/.../scratchpad`) znika — wszystko trwałe jest w tym katalogu.
- `docs/reviews/` w szablonie jest nieśledzone przez git (`??`) — decyzja operatora otwarta; ten katalog też jest nieśledzony.

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
| 3½ | Domknięcia D1–D5 przed panelem (jedno po drugim, po każdym rozmowa z operatorem) | **D1 GOTOWE 2026-09-21** (`skrypty/d1_atrybucja_po_fixie.py`, `dane/pomiar5-atrybucja-po-fixie.{json,txt}`, dopisek w POMIARY §4): 33 findingi = A urodzone w fixie 13 (39%, w tym jedyny P1; wszystkie 10 kodowych to skutek naprawy findingu rundy 1, kontrola diffu nie złapała żadnego) / B przeoczone w rundzie 1 w pliku fixa 14 (42%, 5 P2) / C przeoczone w kodzie nietkniętym 6 (18%). „Review kodu naprawczego" z POMIARY §4 było za mocne — składnik recall rundy 1 jest większy (60%). **[KOREKTA 2026-09-23, przegląd domknięć na Opus 5.5, PRZYJĘTA — `PROPOZYCJA-POPRAWEK-DOMKNIEC.md` §D1, `skrypty/d1r_rewizja_atrybucji.py` → `dane/d1r-rewizja-atrybucji.{txt,json}`: z trzecią parą (samodzielna run 2→3) i klasą semantyczną 44 kodowe = urodzone w fixie 15 + łańcuch 4 (fix po rundzie 1 przeoczony przez PEŁNĄ rundę 2) / przeoczone 22 = 50% (36–64%) — pół na pół, „większy” nie wynika z danych; lepszy sceptyk nie adresuje przeoczeń, więc podział nie rozstrzyga n=3 vs sceptyk.]** **D2 GOTOWE 2026-09-21** (`skrypty/d2_budzet_instrukcji.py`, `dane/pomiar6-budzet-instrukcji.{json,txt}`, wynik w ETAP3 §7): reviewer security dziś ~365 instrukcji (górna ~710 — learned-patterns ×2: eager + dossier, 5,7 nakazu/regułę), builder danych ~537 (górna ~710); po 6a pkt 15/17 reviewer ~310–320, builder ~520–530 — nadal pasmo IFScale 150–500; największe bloki: coding-rules 117–130, skille buildera 178, plik agenta security 104, iu.prompt 97. Wejście do panelu: budżet instrukcji projektować per rola jako całość (cel <150), nie „4–5 poleceń na oś". **[KOREKTA 2026-09-23, PRZYJĘTA — `PROPOZYCJA-POPRAWEK-DOMKNIEC.md` §D2, `skrypty/d2r_rewizja_budzetu.py` → `dane/d2r-rewizja-budzetu.txt`: procenty IFScale nie przenoszą się (tam instrukcja = „użyj słowa X”), tylko kierunek; górna reviewer ~500 (learned-patterns raz), builder 497/670 na medianie iu.prompt, po decyzjach ~480–490; reviewer ~110 poleceń zawsze obowiązujących, ~2/3 warunkowe → budżet uzasadnia trafność i koszt; test liczy oznaczony blok poleceń (licznik D2 zależny od formy zapisu); oczekiwanie wobec poleceń-list obniżone; mini-run (d) rozstrzygający.]** **D3 GOTOWE 2026-09-21** (`dane/d3-mapa-rol-agentow.txt`): 45 slotów ról = 36 bez pliku agenta + 9 z plikiem (8 plików); autopilot 19 wywołań, zero `agentType`; prompt osi w 2 miejscach (4 osie) / tylko w workflowie (correctness, test-coverage); telemetria: 3 klasy ról po kontekście na turę (haiku 86–102k, orkiestracyjne 119–168k, reviewerzy 193–224k, buildery 238k); decyzja operatora: pliki agentów per KLASA roli, per rola jako wyjątek (6a pkt 18). **[KOREKTA 2026-09-23, PRZYJĘTA — `PROPOZYCJA-POPRAWEK-DOMKNIEC.md` §D3, `skrypty/d3r_kontekst_per_klasa.py`: kontekst per klasa miesza epoki wzrostu CLAUDE.md oferty 13,8k → 87k zn (ctx 1. tury rósł 55k → 101k mechaniczne, 76k → 145k reviewerzy), zero runów po ścięciu do 21k → punkt odniesienia = mini-run (e) per klasa i model; CLAUDE.md nie tłumaczy różnicy klas (ładuje się obu; różnica na starcie to głównie model: haiku ~93k vs opus ~127k).]** **D4 GOTOWE 2026-09-21** — `PANEL-WEJSCIE.md` (12 sekcji, sama kompilacja, zero nowych decyzji): §0 skład panelu i co kto czyta (sędziowie: koszt + jakość = P1/P2 od bota; koszt wdrożenia NIE jest kryterium; plugin nie jest wariantem), §1 sześć precedensów (wersja B kontekstu, test-coverage ZOSTAJE, brak lekkiej rundy po fixie, dźwignia 25–35%, L7 niska waga, STOP E2E→MANUAL nad „sam tester" z ETAP1), §2 jedenaście twardych wymogów każdego projektu (6a pkt 15–18: `tools:` + pliki per klasa, trzy warstwy instrukcji <150 jako test szablonu, learned-patterns 3 poziomy + 8 zabezpieczeń, telemetria mechaniczna, E2E→MANUAL, sceptyk asymetryczny, security warunkowe po stacku na chmurze, fix bez dodatkowej rundy, zakaz powtórek sekwencyjnych, polecenia-listy z warunkiem odwrotu), §3 decyzje 6a pkt 1–14 po linii, §4 D1–D3, §5 dziewięć hipotez HANDOFF §5 ze stanem po decyzjach (hip. 7 NIEAKTUALNA, hip. 3 rozstrzygnięta: roster 6 → 5), §6 osiem założeń z warunkiem odwrotu, §7 trzynaście elementów nietkniętych z tym, co projekt ma zrobić, §8 tezy na jednym filarze po D1, §9 ograniczenia do raportu, §10 lista zmian szablonu poza panelem, §11 mini-run 6a pkt 16 + dodatki (d) 100 vs 400 instrukcji, (e) `usage` per klasa roli, §12 telemetria (D5). **Weryfikacja D4 (2026-09-21, trzy rundy: 3 fragmenty w źródle, 27 liczb grepem, pełne czytanie obok źródeł):** 5 błędów poprawionych (4 zmiany dev-pr z ETAP1B §4, e2e bez „bramki JS", skille buildera > coding-rules, nazwa `@vitest/eslint-plugin`, packager → JS zamiast „otwarty") + dopisana **§2a: twarde wejścia z ETAP1/1B/2 i POMIARY** (bramka niezmienności migracji, dossier klas ucieczek, seedy z właścicielem, pełny zestaw bramek domknięcia, Stryker nie do każdego domknięcia), wcześniej pominięte. **Kontrola odwrotna (źródła → pakiet, `skrypty/d4_kontrola_odwrotna.py`, wynik `dane/d4-kontrola-odwrotna.txt`):** 164 jednostki z markerem decyzji z 6 dokumentów + przegląd runów; 58 o niskim pokryciu przejrzane ręcznie → 9 uzupełnień (zEffortem/agentType test-coverage, Stryker bez `--since` i score nie jako cel, compute z osi szumu do sceptyków, wariant n=3 z różną kolejnością diffu, dev-pr nie jest celem oszczędności + odrzucone, zasada „limit dotyczy indeksu, nie wiedzy", rek. 3 przeglądu nieaktualna, rek. 4/7 przeglądu i otwarte decyzje operatora → §10, rek. 1 przeglądu jako alternatywa formatu w §12); po nich 44 pozostałe = uzasadnienia/metadane/pokryte semantycznie (klasyfikacja per jednostka w pliku wyniku). Ograniczenie: markery słowne. **[KOREKTA 2026-09-23, przegląd D4 na Opus 5.5, PRZYJĘTA w całości — `PROPOZYCJA-POPRAWEK-DOMKNIEC.md` §D4, notatka `PRZEGLAD-D4-DLA-OPERATORA.md`, `skrypty/d4r_dzwignia_kontekstu.py` → `dane/d4r-dzwignia-kontekstu.{txt,json}`, `skrypty/d4r_kontrola_odwrotna.py` → `dane/d4r-kontrola-odwrotna.txt`: (1) DŹWIGNIA KONTEKSTU ≈ 40–50% kosztu fazy po ścięciu CLAUDE.md, nie 25–35% — liczona agent po agencie (Δ startu × wywołania API, koszt z ostatnim `usage`): run 20.09 51,4% (fazy 48–53%), epoka 09-08..09-17 37,1% (duże runy 32,8–40,6%; z CLAUDE.md przyciętym 39,9%), sama allowlista 27–38%, wrażliwość ±15% stawek 32–44% / 45–60%; ETAP3 zaniżał (start 62k z pustego agenta CLI zamiast 115–127k, polski tekst ~2 zn/tok zamiast 3,4–3,7, aplikacja desktop: schematy narzędzi 116–172k zn, nazwy MCP 26–55k zn); kalibracja na pomiarze 1b, opus 1,016 / haiku 0,742 (tokenizer), u 80% agentów opusa błąd ≤1%, niezależne dopasowanie stawki PL 2,05 vs 1,97; (2) dźwignie nie sumują się — po allowliście agent mechaniczny zachowuje ~1/3 kosztu, sceptyk ~1/2, reviewer 56–67% → roster+mechanika rząd 3–7% zamiast 8–10%, batch sceptyków ~−0,4% zamiast −2%; (3) cele ctx_start per klasa i model (stan 20.09, z promptem): mechaniczne ~9–10k, orkiestracyjne/sceptycy/naprawiacze opus ~25–26k, reviewer ~29k, builder ~38k (dawne 4,5/15/25k fałszywie pokazałyby „allowlista nie działa”); (4) porządkowe: skład startu (§3 pkt 2), L8 zależne od MCP w sesji, `agent.kontekst` z rozmiarami w znakach, metryka „start × wywołania” (54,7% / 60,9%) w mapie §2 pkt 2, stare zapisy w wersji operatora (7 tyg., 67–118k, „jedenaście”, „118 przejrzanych ręcznie” → 58 + 60 wyrywkowo, odtworzone skryptem), 1 293 M w mapie dla operatora, luka `cleanupPeriodDays` → §10, jawne grupowanie etapów w raporcie; kontrola odwrotna po D1–D6: nic nie zginęło (<0,30: 44 → 37). Poprawione: PANEL-WEJSCIE §0/§1 pkt 4/§2 pkt 1/§4 D3/§5/§6/§8/§9/§10/§11/§12, ETAP3 §1.1/§4/§7, ETAP3-DLA-OPERATORA, wersja operatora (wstęp, części 1, 2, 6, 8, „jak sprawdzany”, „co teraz”), mapa walidacji obu wersji, rekord D5 §4 pkt 2 i §8 pkt 5, digest §3, HANDOFF §3 pkt 2.]** **D5 GOTOWE 2026-09-21** — `dane/d5-telemetria-rekord.txt` + PANEL-WEJSCIE §12: (1) fakty: skrypt workflowu nie ma fs/Node (orkiestrator nie zapisze sam), journal nie zapisuje wyniku końcowego (status/powód zna tylko sesja główna), `tokenyRazemK` = `budget.spent()` = tylko output, etykiety w workflowach-dzieciach bez numeru fazy; (2) rekord: jeden plik `~/.claude/telemetry/pipeline.jsonl`, append-only, klucz `run|typ|id`, trzy typy — agent (rola, klasa_roli, ctx_start, pełny cennik, narzędzia, findingi/obalone), faza (findingi_per_os, e2e manual[], bramki domknięcia, kontrolaFixa.regresje, koszt per etap), run (status, stop_kategoria, manual_razem, szablon sha); (3) skrypt `.claude/scripts/telemetria/zbierz.mjs` (Node, port `koszt_agentow.py`) + `raport.mjs`; miejsce: A — sesja główna po task-notification (`--run --status --powod`, krok w skillach wf, agent telemetrii znika), B — `--skan` w raporcie i doctor jako siatka, C — hook Stop do sprawdzenia w mini-runie. Propozycja do potwierdzenia przez operatora; implementacja w planie etapu 5. **[KOREKTA 2026-09-23, przegląd D5 na Opus 5.5, PRZYJĘTA w całości — `PROPOZYCJA-POPRAWEK-DOMKNIEC.md` §D5, `skrypty/d5r_wykonalnosc_rekordu.py` + `skrypty/d5r_koszt_output.py`, rekord §8: (1) harness zapisuje po każdym runie `<sesja>/workflows/<run>.json` (156/156, oba formaty journala: status completed/killed/failed, wynik OK/STOP + powód, args, log(), skrypt, lista agentów z etykietą/grupą) → skan = główny zapis, wariant A zbędny, heurystyka „ostatnia etykieta” (32/55) i reguła „run w toku” (4 runy zgubione) odpadają; (2) wznowienie = ten sam runId (9/9) + 6,6% końców odpowiedzi dwóch sesji w ciągu 2 s → agent dopisywany raz, run/faza „ostatni wygrywa przy odczycie”; (3) `szablon` = {marker, skrypt_sha, zgodny} — 33/55 runów autopilota wykonało skrypt spoza historii szablonu, marker brak w 6/11 repo, sync-template dopisze hash per plik; (4) `run.pr` per zadanie z id wątku — suma po runach dev-pr zawyża jakość o 43%; (5) `instrukcje_stale` jednym modułem z testem, `agent.kontekst` z załączników transkryptu (972 narzędzia, 309 skilli; CLAUDE.md widziany ≠ main u 27% agentów), `cc_wersja`, ctx_start per model; (6) model kosztu etapu 0 zaniżał output: 10,9% nie 2%, całość 1 293 M, udziały ×0,91 — dźwignia 25–35% do przeliczenia w D4; (7) korekta D3: run 20.09 (85 agentów) już miał ścięty CLAUDE.md 17,8k → pierwszy punkt odniesienia, mini-run (e) = potwierdzenie.]** **Wersja dla operatora: `PANEL-WEJSCIE-DLA-OPERATORA.md` (2026-09-22, narracja bez tabel, 8 części + jak pakiet był sprawdzany).** **Po lekturze operator podjął decyzje 6a pkt 19 (2026-09-22) — zapisane w obu wersjach pakietu.** **D6 GOTOWE 2026-09-22** — `skrypty/d6_audyt_skilli.py` → `dane/d6-audyt-skilli.{txt,json}`, wpis w PANEL-WEJSCIE §7 i PANEL-WEJSCIE-DLA-OPERATORA część 7. Trzy źródła: `skille.csv` (koszt, 5 projektów), skan 5228 transkryptów (30 projektów, okno 2026-08-03..09-22 — retencja ~7 tyg., „0" ≠ „nigdy"), artefakty w 17 repo z szablonem. Wynik: **A. rdzeń 13** (prep/plan/docs 52 epizody; autopilot 54 uruchomienia + 4 workflowy-dzieci wołane przez `workflow()` — widoczne tylko w journalach nowego formatu, ~100 starszych nie ma pola `phase`; pr-wf 75; compound 206 solutions; complete/refresh — SKILL.md czytany przez agenta w runie), **B. wstrzykiwane `skills:` 7** (148 / 53 / 59 agentów, zero wywołań ręcznych), **C. rzadko-celowo 5** (coolify, sync-template, zroastuj, brainstorm, coderabbit-setup), **D. kandydaci do usunięcia 5** (code-review, code-quality — kolizja nazwy z osią review, gemini, dev-docs-update, bugfix 1 użycie/7 tyg.; 748 linii, 15 plików; zero wpływu na koszt runów), **E. do decyzji 5** (dev-ideate, freshness-audit + wf tylko w repo szablonu 2026-08-23, dev-docs-execute/review jako tryb ręczny: 0 wywołań, wszystko autopilotem). Kontrola: sumy A vs csv, wstrzyknięcia vs meta.json, artefakty vs `ls`, niezależny grep dev-plan/dev-pr-wf — zgodne. Pułapki znalezione: `<command-name>` w transkrypcie AGENTA = wstrzyknięcie/kontekst odziedziczony, nie wywołanie; workflow-dziecko nie jest tool_use. **[KOREKTA 2026-09-23, przegląd D6 na Opus 5.5, PRZYJĘTA w całości — `PROPOZYCJA-POPRAWEK-DOMKNIEC.md` §D6, `skrypty/d6r_rewizja_audytu.py` → `dane/d6r-rewizja-audytu.{txt,json}`, notatka `PRZEGLAD-D6-DLA-OPERATORA.md`: (1) koszt A = „pierwsza odpowiedź skilla” — epizod kończy się też na powrocie subagenta (dev-plan 7/19) i przerwaniu, rozmowa z operatorem i subagenci poza nim; pełny koszt prep+plan+docs 95,8 M zamiast 39,2 M, dev-plan mediana 2,39 M (subagenci researchu 18,6 z 55,6 M), udział w zadaniu ~4–7% w medianie (nie 2–5%); rekord `skill` z nową granicą (d5-telemetria-rekord §9), wysiłek operatora = liczba jego wiadomości; (2) retencja ~30 dni w aktywnym projekcie, nie 7 tyg.; `history.jsonl` (CLI od 2025-10-05): D porzucone, nie nieużywane (code-review I, gemini XII–III, docs-update XII–II), tryb ręczny execute/review 593 wywołania do 07.06, potem zero; (3) z pliku harnessu: dzieci execute 81, review 84, compound 20, complete 20; refresh/complete w 20/55 runach; dev-pr 75 runów = 8 PR; (4) porządkowe: gemini tylko komendą (`disable-model-invocation`), 14 skilli bez opisu na liście agenta, README przy usuwaniu, mobile osobno, C bez „rzadko” dla zroastuj/brainstorm.]** **D5b GOTOWE 2026-09-22** — `dane/d5b-mapa-walidacji.txt` (21 wpisów: 13 wymogów §2 + 8 założeń §6, każdy METRYKA → POLA → BASELINE etapu 0 → HORYZONT, założenia z ODWROTEM tymi samymi polami; konwencja horyzontów: KONFIGURACJA 1 faza / KOSZT-TURY 5 faz / JAKOŚĆ 5 PR) + streszczenie w PANEL-WEJSCIE §12 + wersja operatora część 6 + **pełna wersja dla operatora `MAPA-WALIDACJI-DLA-OPERATORA.md`** (21 wpisów narracją, kryteria doboru metryk i horyzontów). **Kontrola odwrotna: 16 pozycji brakujących w rekordzie D5 → dopisane do `d5-telemetria-rekord.txt` §7** (prompt_zn, narzedzia.mcp, werdykty sceptyka agree/disagree_evidence/disagree_concern, faza.wiedza, fix.pliki[]/linie_diff/p1_z_testem, review_rundy, dossier_zn, bramki.eslint.trafienia+reguly, testyTypow, profil_stacku, smoke, **run.pr z klasyfikacją uwag bota — jedyne źródło miary jakości**, **nowy typ `skill`** dla §2 pkt 12). Import baseline: agents.csv → agent, odzyskana telemetria → faza/run, skille.csv → skill, klasyfikacja-574 → run.pr (19 PR). Konsekwencja dla etapu 5: iteracja 1 = telemetria + import; każda następna z parą (zmiana, wpis mapy). **Mapa v2 (2026-09-22, operator zaakceptował 9 poprawek z `PROPOZYCJA-POPRAWEK-MAPY-WALIDACJI.md` po przeglądzie na Opus 5.5):** jakość = B P1/P2 bota NA 100 PLIKÓW PR per typ kodu i per oś (kolumna `etap` 1b); baseline = epoka wrześniowa PR 13–19 (3,5/100; sierpień 9,3 — L16); porównania względem B0 zebranego po 8 zmianach `.coderabbit.yaml`; próg odwrotu per oś w oknie 5 PR ≥ max(3, 2 × oczekiwana), 5 faz ≠ 5 PR; pętla fix: pliki fixa 14,0 vs 4,7 na 100 plików (≈3×); `run.pr` produkuje rozszerzony schemat istniejącego `pr:zbierz` (pole „dlaczego" wypada z runu na próbkę miesięczną, kalibracja klasyfikatora na 2–3 starych PR); nowa sekcja kolejności odczytów (ustawienia/koszt równolegle, rozłączne osie równolegle, zmiany przekrojowe mają okno 5 PR dla siebie); dopiski WYMAGA ZMIANY przy polach bez producenta. Liczby: `skrypty/d5b_baseline_jakosci.py` → `dane/d5b-baseline-jakosci.txt`. Korekta przy wprowadzaniu: próg spec 4, nie 3. **Potem: mini-run (Opus) i panel (3 runy na Fable) — na znak operatora.** Instrukcja startowa każdej sesji: §8. |
| 3¾ | Mini-run przed panelem (PANEL-WEJSCIE §11) | **GOTOWE 2026-09-23, wynik ZAAKCEPTOWANY** — `MINI-RUN-WYNIK.md` + `MINI-RUN-DLA-OPERATORA.md` (plan: `MINI-RUN-PLAN.md`, kryteria §7). (a) wklejone do promptu DZIAŁA 40/40; (b) `paths:` 0/3 — precedens bez zmian; (c) `skills:` STOSOWANA 2/2 (dostawa zaburzona buforem sesji); (d) 100 vs 400 poleceń 25/25 vs 25/25 — BRAK DŹWIGNI, +72% kosztu; (e) start każdej klasy 0,93–1,03 celu D4, dźwignia ≈48%, allowlista 35% (Opus 5.5, desktop; E2 z korektą learned-patterns); (f) plik harnessu tylko po końcu runu, po zabiciu sesji brak, hook Stop odpala na task-notification z `background_tasks`. Poboczne: N1 haiku wykonuje przekazaną wiadomość operatora (E1: `git mv` w repo; zdanie „do agentów” → 0/8), N2 instrukcje i skille buforowane w sesji, N3 builder idzie za `git status`. Skrypty `mr_*.py`, dane `mr-*`; wpisane do PANEL-WEJSCIE (§0, §1 pkt 4, §2 pkt 2–4, §2a, §4, §7, §8, §10, §11, §12), wersji operatora, mapy walidacji (obie wersje). Szczegóły 6a pkt 21. |
| 3⅞ | Prompt-audit maszynerii szablonu pod Opus 5.5 / Haiku 4.5 (6a pkt 24) | **GOTOWE 2026-09-24, ZAAKCEPTOWANE W CAŁOŚCI (6a pkt 25)** — `PROMPT-AUDIT.md` + `PROMPT-AUDIT-DLA-OPERATORA.md`, diff `dane/pa-proponowany.diff` (62 hunki, 21 ustaleń; NIE naniesiony), skrypty `pa_inwentarz.py`, `pa_wywolania.py`, `pa_kontrola.py` (kontrola w obie strony: 0 błędów). 44 pozycje: 21 w diffie (8 wysoka, 13 średnia), 8 flag (decyzje operatora/panelu), 15 niskich. Sedno: pliki reviewerów security/performance/architecture to import z compound-engineering pisany pod czat (przykładowe dialogi, „last line of defense, be paranoid”, drugi format raportu) i dwie sprzeczności z resztą szablonu (memoizacja vs React Compiler, `getSession()`); prompty review/fix pisane jak dziennik zmian („teraz już nie”, „jak dotąd”, „w opisanym runie”); compound w autopilocie każe czytać sesję, której agent nie ma; `fix:pre-skan` (haiku) mediana 20 wywołań narzędzi na jedno polecenie gita; efort ról strojony na Opus 5 (~94% historii). **Prompty maszynerii = nowy obszar zmian szablonu** (PANEL-WEJSCIE §10 „Obszar: prompty”, zasady warstwy stałej w §2a, metryki w mapie walidacji §7). |
| 3⅞b | Tematy-inspiracje operatora: mattpocock/skills + wystąpienie poteto (pstack) | **GOTOWE 2026-09-24, decyzje w 6a pkt 26** — `INSPIRACJE-POCOCK-PSTACK.md` (v2 po transkrypcji) + `INSPIRACJE-POCOCK-PSTACK-DLA-OPERATORA.md`, skrypty `insp_*.py`. Przyjęte poza panelem: compound ze szczeblem, pytanie „undefined” o testy + wyjątek w coding-rules §2, odbiór bramek „gryzie”, 4 zasady pisania, zmiany promptów wg Anthropic + ślepe przed/po, reguła lint razem z posprzątaniem. Nowe wymogi panelu §2 pkt 14–16: mapa funkcji (regresja odłożona), granice warstw w ESLint (bez wyjątku dla auth), ogrodnik na zamknięciu zadania. Otwarta decyzja: reguły builder ↔ reviewer. |
| 4 | Panel projektowy: 3 niezależne projekty pipeline'u „po" (minimalistyczny / jakość-najpierw / hybrydowy) → sędziowie → adwersarialna krytyka → synteza | NIE ZROBIONE — **zastąpiony PANELEM DECYZYJNYM (6a pkt 23)**: krok 0 skryptami (otwarte decyzje, zestaw historycznych ucieczek, koszt skryptem) → projektanci per architektura review → sędzia jakości na historii → sceptyk per decyzja → rekord per decyzja; Opus 5.5 (6a pkt 22), start WYŁĄCZNIE na znak operatora; instrukcja: §8 „AKTUALNA”. **PLAN (część A) ZAAKCEPTOWANY 2026-09-24 (D12 wchodzi, projektant C zostaje), wykonanie w nowej sesji wg §8 „WYKONANIE PANELU”:** `PANEL-PLAN.md` + `PANEL-PLAN-DLA-OPERATORA.md`; krok 0 (b) zrobiony skryptem `skrypty/panel_zestaw_historyczny.py` → `dane/panel-zestaw-historyczny.{jsonl,txt}` (195 B, 132 P1/P2, ogon 27; 68 ucieczek = te same wątki bota, compound jako kontekst 30 przypadków). **WYKONANIE W TOKU (sesja 6e626ae3, 2026-09-24): krok 0 + RUN 1 ZROBIONE, notatka po run 1 oddana; operator kontynuuje w NOWEJ sesji (kontekst ~500k) wg §8 „KONTYNUACJA PANELU PO RUN 1” — stan w §8.** **RUN 2 ZROBIONY (sesja 1bd5477f): ocena papierowa przecenia (kalibracja 33% > 15%, STOP §10); operator 2026-09-25 (6a pkt 28): żadna koncepcja nie odpada przed prawdziwym testem → następny krok PLAN prawdziwego testu review w nowej sesji wg §8 „PLAN TESTU REVIEW”; run 3 wstrzymany.** **PLAN TESTU REVIEW ZAAKCEPTOWANY 2026-09-25 (6a pkt 29):** `TEST-REVIEW-PLAN.md` + wersja operatora; następny krok = skrypty przygotowawcze testu w NOWEJ sesji, bez agentów, wg §8 „PRZYGOTOWANIE TESTU REVIEW”. **TEST REVIEW ZROBIONY I PRZEANALIZOWANY 2026-09-27 (6a pkt 30–32):** `TEST-REVIEW-WYNIK.md` + wersja operatora; decyzja D1: obecna architektura review zostaje + 3 dodatki, D12 rozstrzygnięta (kontrola diffu fixa wg A); **Run 3 (sceptycy) POMINIĘTY (6a pkt 33)**; następny krok = decyzje D2–D11 (+ D12 cz. 2) z metryką i warunkiem odwrotu oraz plan wdrożenia wg §8 „DECYZJE I PLAN WDROŻENIA”. **DECYZJE D2–D12 I PLAN WDROŻENIA ZAAKCEPTOWANE 2026-09-27 (6a pkt 34):** `PANEL-WYNIK.md` + `PANEL-WYNIK-DLA-OPERATORA.md` — etap 4 ZAMKNIĘTY. |
| 5 | Dwa raporty (techniczny + dla człowieka) do `docs/reviews/` ~~+ publikacja jako artefakt~~ | **GOTOWE I ZAAKCEPTOWANE 2026-09-28 (6a pkt 36)** — forma skrócona (6a pkt 35): `RAPORT-DLA-OPERATORA.md` + `RAPORT-TECHNICZNY.md` (spis); koszt „po” `skrypty/raport_koszt_po.py` → `dane/raport-koszt-po.{txt,json}` (zadanie 52,0 → 22,4 M†, −57%; kontekst −51%, pokrętła po kontekście −12%); kontrola `skrypty/raporty_pokrycie.py` (171/171, 84/84 liczb); inwentarz konta `skrypty/konto_inwentarz.py`. **Zmiany operatora: oferty-online = materiał do nauki (pomiar na nowych projektach); higiena konta = KROK 0 przed It. 1.** Następny krok: §8 „KROK 0 — PORZĄDKI KONTA” |
| K0 | Krok 0 — porządki konta Claude Code na całym komputerze (przed It. 1, 6a pkt 36 b) | **GOTOWE I ZAAKCEPTOWANE 2026-09-29 (6a pkt 37)** — `KROK0-DECYZJE.md` (decyzje per element, kopie, komendy, wyniki N2 i N3); dane `dane/konto-inwentarz-globalny-{przed,po,po-n3}.{txt,json}`. Start sesji: skille 303 (248 bez opisu) → 48 (0), narzędzia MCP 265 / 30 serwerów → 87 / 14, always-on user ~46,2k → ~0,1k tok. Narzędzie: skill `/konto` w repo workspace. Następny krok: It. 1 telemetria (§8). |
| It.1 | Telemetria + import (PANEL-WYNIK §4 wiersz 1) | **WDROŻONE 2026-09-29/30 (6a pkt 38), ODCZYTANE I ZAAKCEPTOWANE 2026-09-30 (6a pkt 39)** — odczyt `IT1-ODCZYT.md` + `IT1-ODCZYT-DLA-OPERATORA.md` (smoke `wf_031f0eae-204` OK, 4,78 M; poprawka skanu `run.walidacja` v4 + 3 wady raportu); plan `IT1-PLAN.md` + `IT1-PLAN-DLA-OPERATORA.md` (decyzje O1–O10, §7 wynik); `.claude/scripts/telemetria/` (zbierz.mjs + raport.mjs), hook Stop, agent telemetrii usunięty, słownik klas w dev-pr, hashe w sync-template, import historii; commity `d4c73a7`…`b7a4fe7`; akceptacje na prawdziwych danych `dane/it1-akceptacja-*.txt` (wszystkie ZALICZONE). Następny krok: §8 „IT. 2 — BOT, DEV-PR I B0” |
| Popr. | Poprawa całego szablonu wg ustaleń analizy (6a pkt 40: B0 nie blokuje; pomiar telemetrią na nowych projektach po poprawie) | **PLAN ZAAKCEPTOWANY 2026-09-30 (6a pkt 41)** — `PLAN-POPRAWY.md` + `PLAN-POPRAWY-DLA-OPERATORA.md`: 17 paczek P0–P16 w 4 grupach, 32–38 sesji, 15 smoke'ów; kompletność skryptem `plan_poprawy_pokrycie.py` 395/395; decyzje 1–3 wg rekomendacji. **P0 ZROBIONA 2026-10-01 (6a pkt 42): smoke R0 `wf_588f7b18-d71` zielony (3,92 M), merge do main `8e356f2`. **P1 ZROBIONA 2026-10-01 (6a pkt 43): smoke `wf_8936d61f-1cb` zielony (3,77 M, −4% vs R0), merge do main `5a4f593`. **P2 ZROBIONA 2026-10-01 (6a pkt 44, 45): doctor, profil pluginów w `.claude/settings.json`, README „Instalacja” i „Wymagania”, bramka CI `maszyneria.yml` (sam pnpm — validate/eval nie działają na repo bez manifestu pluginu); merge do main `5d28922` + poprawka po teście czystego konta `0730d04`. **P3 SESJA 1/2 ZROBIONA 2026-10-01 (6a pkt 46): pięć plików klas ról, `tools:` w plikach ról i badaczy, warianty builderów `-figma`, PA-25 (skill figma z pluginu), test `klasy-rol.test.mjs`; gałąź `popr/P3-agenci` niezmergowana. **P3 ZROBIONA 2026-10-02 (6a pkt 47): `agentType` w każdym `agent()`, efort jawny wg D6, D9 ścieżką odwrotu (flaga nie istnieje dla workflowów projektu — krótkie opisy dzieci), N1/N2; smoke `wf_2894ee9c-566` zielony (2,82 M, −28% vs R0; haiku start 52k → 8k, opus 72–84k → 49–60k), merge do main `3933432`. **P4 ZROBIONA 2026-10-02 (6a pkt 48): bramka wejścia autopilota (czystość, doctor, zielony start z cache po SHA), archiwizacja bez CLAUDE.md z `docs/decisions/` (`claude_md: do-uzgodnienia`), bramka PR ≤ 150, `fazyUkonczone` po stanie; smoke w dwóch runach — STOP na czerwonej bazie `wf_ec07d4a4-d06`, potem `wf_f330324d-8a5` zielony (2,84 M, −27% vs R0); merge do main `8f5ff82`. **P5 SESJA 1/2 ZROBIONA 2026-10-03 (6a pkt 49): dev-pr (token tury, guard odrzuceń, rekomendacja w JS, tabela tury, sufit 3 tur, etap `claude-md` po merge'u z bramką przyrostu 2000 zn), STOP bootstrapu przy nieuzgodnionym CLAUDE.md na main; smoke: STOP `wf_1c847902-82a` → `/dev-pr --claude-md` `wf_477d96d9-bd5` → PASS `wf_b96dcd26-cea` (2,85 M, +0% vs P4); merge do main `dd3ed11`. **P5 ZROBIONA 2026-10-03 (6a pkt 50): generator bota (8 zmian ETAP1B §2, próg 360/60, wyjątki w bloku głównym, seedy E2E, stała `CODING_RULES`, sekcja „Bot bez szumu”), test schematem CodeRabbit (devDependencies `yaml`, `ajv` za zgodą); kalibracja `zbierz` na PR 2, 4, 16 → waga = skutek, klasy nie-defektu = 0 w JS (defekt/nie-defekt 73% → 88%); merge do main `ed613b8`. Grupa 1 (P0–P5) zamknięta — push szablonu wg D-2 czeka na operatora. **P6 SESJA 1/2 ZROBIONA 2026-10-03 (6a pkt 51): `.claude/scripts/bramki/` — 10 bramek, CLI z wynikiem JSON, odbiór każdej testem porażki (ESLint i tsc prawdziwe, knip/size-limit/Stryker/vitest na nagranym wyjściu), bez nowych zależności; gałąź `popr/P6-bramki` niezmergowana. **P6 ZROBIONA 2026-10-03 (6a pkt 52): konfiguracje `.claude/templates/bramki/` (pakiet workspace z devDependencies za zgodą, TS 5.9.3), domknięcie fazy uruchamia `bramki.mjs` z bazą od plannera, hook error-handling wyłączony przy ESLint z szablonu, `stop_hook_active`, telemetria `faza.bramki`/`testy_usuniete`, doctor, README, monorepo (pakiety z własnymi narzędziami); smoke `wf_4bbe1753-420` zielony (eslint `no-empty` i migracje porażka → po naprawie ok, mutanty, bramki 6,8 s; 3,87 M, +36% vs P5 — przyrost z większego fixture'u); merge do main `20e20b8`. **P7 SESJA 1/2 ZROBIONA 2026-10-03 (6a pkt 53): `.claude/scripts/dossier/` (diff do pliku, flagi warstw i pre-skan ze skryptu, [E2E], `figma_screens`, wycinki planu/zadań, profil stacku, bloki z OSTATNIEGO przebiegu bramek), domknięcie zwraca `dossier` w `EXECUTE_RESULT` (bez `ostrzezeniaEslint`/`mutanty`), review-wf liczy routing z `args.dossier` albo zapasowego agenta `dossier:zapas` (haiku), `kontekst:diff` znika. **P7 ZROBIONA 2026-10-04 (6a pkt 54): stan fazy liczony w JS (`trescStanu`), zapis doklejony do agenta, który i tak startuje (precheck, domknięcie z bazą fazy, fix, walidacja, env-down, refresh, commit STOP-u); `stan:zapis` zostaje przed pod-workflowem i jako zapas (odstępstwo od PANEL §5, lista miejsc w pkt 54); zwijanie „Do poprawy” w poleceniu fixa; baza fazy w stanie → `args.baza` review; telemetria `dossier_zn`, `review_rundy` z grup review-wf, role. Smoke A `wf_17eac746-574` zielony (3,49 M, −10% vs R-P6; 28 agentów; `stan:zapis` 1×) = nowa referencja R-P7; wznowienie: kill `wf_56ef0a6d-2d7` → świeży `wf_c3f62710-562` (dossier od zapasowego agenta z `--baza`, identyczne z domknięciem). Merge do main `b0e961a`. **P8 SESJA 1/2 ZROBIONA 2026-10-04 (6a pkt 55): dossier bez `.autopilot-state.json`; `fix:kontrola` wg list K-1…K-7 katalogu A + bramki P6 na plikach fixa, zakres z hashy commitów fixa; `fix:pre-skan` i `verify-fix` usunięte; telemetria `kontrolaFixa.listy`, `fix.p1_z_testem`; 441/441 testów. **P8 ZROBIONA 2026-10-04 (6a pkt 56): fix naprawia tylko P1/P2, P3 trwale w known-issues (`## P3 faza N`, pisze scribe; stan sprzed P8 z P3 na liście fixa → agent `start:p3-known-issues`), blok limitu P3 i scribe pod nową semantykę (prompt scribe −16%), smoke operatora bez P3, `smoke_odczyt.py` z listami K; smoke `wf_9317b7cf-cdf` zielony (3,62 M, +4% vs R-P7; etap fix 0,58 M = R-P7; 0 pre-skan, 0 verify-fix, K-1…K-7 i bramki z wpisem) = nowa referencja R-P8; poprawka K-7 po smoke'u (katalog zadania = księgowość) zmergowana bez osobnego smoke'a, sprawdzi ją smoke P9; 456/456 testów; merge do main `e08e1f4`. **P9 SESJA 1/2 ZROBIONA 2026-10-04 (6a pkt 57): sceptyk asymetryczny (sam zarzut `[waga] plik:linia — teza` bez autora, osi i typu; AGREE / DISAGREE_EVIDENCE z dowodem / DISAGREE_CONCERN obniża wagę o stopień, nie kasuje; P1 ×3 z kasacją przy 2/3 dowodów; EVIDENCE bez dowodu = CONCERN), P2 w porcjach po 4 niezależnie od pliku, telemetria `faza.sceptyk` + `agent.werdykty`, `werdyktySceptyka` mapuje etykiety; 466/466 testów; kill rate na archiwum test-review: 74 prawdziwe findingi (P1 12) — zabity 1/21 na kluczu 1 (dziś 2/21), 0/53 na kluczu 2, 0 obniżonych, 0,050 M/finding (dziś 0,083) → kryterium merge'a spełnione. **P9 ZROBIONA 2026-10-04 (6a pkt 58): `smoke_odczyt.py` + `smoke_sceptycy.py` (sekcje 2c–2e); smoke `wf_34ba05c9-cca` zielony (3,49 M, −4% vs R-P8; 28 agentów, 18 min; verify-batch 2 = ⌈5/4⌉, etykiety w wyniku, w `faza.sceptyk`, `agent.werdykty` i w raporcie review, 0 błędów schematu, etap sceptycy 0,15 M vs 0,17 M; K-7 na `docs/active/` 0, „Zamkniete cyklem fix” w archiwum) = nowa referencja R-P9; merge do main `85bfec3`; grupa II (P6–P9) zamknięta i wypchnięta (D-2), kopia smoke'a usunięta. **P10 SESJA 1/3 ZROBIONA 2026-10-04 (6a pkt 59): podział P10 na 3 sesje i `stanZapisany` w `required` (osobny commit, sprawdzi smoke P10) zaakceptowane; `.claude/scripts/wiedza/` — klasy (kopia `KLASY_BLEDOW` z testem równości), frontmatter bez YAML, walidacja pól wiedzy, indeks `docs/learned-patterns.md` z bramką (koszyk „zawsze” ≤ 5, 20k zn), wycinek ≤ 2000 zn po globach, konwersja (kandydaci skryptem → klasa od agenta → zapis z walidacją, odrzuty i stary plik do `docs/archiwum/`), CLI `wiedza.mjs`; 509/509 testów; próba na oferty (odczyt): 38/38 reguł z solution, 8 bez kandydata wzorca; gałąź `popr/P10-wiedza` NIEZMERGOWANA. **P10 SESJA 2/3 ZROBIONA 2026-10-05 (6a pkt 60): compound z polami wiedzy i szczeblem (`sprawdz` przed commitem, indeks skryptem, `propozycjeBramek[]`), refresh z indeksem, jednym wątkiem i `--konwersja`, wycinek w prompcie IU i w dossier, odwołania przepięte (5 builderów bez kroku 1.7, test odwołań bez wyjątku), `faza.wiedza` + `run.pr.klasy[].ma_regule`, README; 533/533 testów, prompt-audit 0; smoke w tej sesji: konwersja na kopii 38/38 (0 odrzutów), run `wf_844929f5-f35` zielony (2,30 M, −34% vs R-P9; ctx_start opus −40…−51%; `learned_zn` 0; dossier 6,2k zn; compound zapisał solution z polami, indeks = bramka 20 256 > 20 000 zn). Merge `--ff-only` do main `0779bf4` (decyzja operatora po zielonym smoke'u; sesja 3 na tej samej gałęzi). Decyzje po smoke'u (6a pkt 60 g): limit indeksu 40 000 zn, wycinek dla fixa i tury poprawek /dev-pr, pełny indeks jako sygnał w raporcie, lekcja kod/lint w wycinku do wdrożenia bramki. **P10 SESJA 3/3 ZROBIONA 2026-10-05 (6a pkt 61) — PACZKA ZAMKNIĘTA:** limit indeksu 40 000 zn, wycinek w prompcie fixa autopilota i tury poprawek /dev-pr, `uwagaIndeksu` („Indeks wiedzy pelny — uruchom /dev-compound-refresh (pelny przeglad)”) w wyniku autopilota i raporcie /dev-pr, wąski refresh nie porządkuje indeksu pod limit, `kod`/`lint` bez pola `bramka` w indeksie i wycinku (walidacja pola, metryka `bramki`), `smoke_wiedza.py`; 543/543 testów, prompt-audit 0; smoke `wf_5b0d08ef-0a3` zielony (2,23 M, −3% vs R-P10 s2; fix wywołał wycinek; compound: indeks zapisany 40 wpisów, bez bramki) = **referencja R-P10**. Merge `--ff-only` do main. **P11 SESJA 1/5 ZROBIONA 2026-10-05 (6a pkt 62): podział 5 sesji i fazy ślepego testu (6 + 46be55a) zaakceptowane; test warstwy stałej (`warstwa-stala.mjs`), correctness i spec od zera, tiery `medium` spec/test-coverage, test-coverage w `REVIEWERZY`, routing D4 (faza bez kodu = zero reviewerów; spec przy tekstach UI / dokumencie prawnym); 553/553 testów, prompt-audit 0; gałąź `popr/P11-reviewerzy` NIEZMERGOWANA. **P11 SESJA 2/5 ZROBIONA 2026-10-05 (6a pkt 63): warunek code-quality `plikiKodu > 0` (decyzja operatora), blok mutantów w dossier jak w C (id, mutator → zamiennik, status), test-coverage i code-quality od zera (mutanty, „undefined”, 5 kształtów; trzy osie + warn/knip + L-CQ), jedno `reviewerPrompt` (bez `testCoveragePrompt` i `BLOK_SEMANTYKA`), kieran i code-simplicity usunięte; 563/563 testów, prompt-audit 0; gałąź NIEZMERGOWANA. **P11 SESJA 3/5 ZROBIONA 2026-10-05 (6a pkt 64): security i performance od zera (treść bez skracania + L-SEC z katalogu A; RLS warunkowo po statusie advisors; PA-03 z warunkiem Compilera, PA-40), profil stacku z pakietami workspace'u i React Compilerem, ostrzeżenia advisors w dossier, fokus = nazwa osi dla 6 osi, licznik warstwy stałej w doctor i `agent.instrukcje_stale` w telemetrii, bloki wspólne wg zasad pisania; 575/575 testów, prompt-audit 0; gałąź NIEZMERGOWANA. **P11 SESJA 4/5 ZROBIONA 2026-10-06 (6a pkt 65): harness ślepego testu (`c3cedcd`: stary = `.claude` z main, nowy = z gałęzi, ta sama kopia, dossier ze skryptu wspólne, wariant ucięty przed Verify, sędzia w jednym przebiegu z neutralnymi id), suchy bieg, pilot f-b26128d (3,7 M): klucz 1 2 → 3, klucz 2 6 = 6, koszt znajdowania −16%, szum P1/P2 4 → 10 (test-coverage); decyzja: sesja 5 = 6 faz bez zmian przebiegu + sumy i CI w `wynik`. ** **P11 SESJA 5/5 ZROBIONA 2026-10-06 (6a pkt 66) — PACZKA ZAMKNIĘTA:** ślepy test 7 faz (32,6 M): klucz 2 38 → 35/44 (−6,8 pkt [−20,5; +4,3], PEŁNE 31 = 31), klucz 1 17 → 19/36, koszt znajdowania −17%, P1/P2 109 → 151 (test-coverage 30 → 80, 39 z mutantów); decyzje operatora: 6 nowych plików ról, mutanty grupowane per plik (`e9ef1d8`); sesja testu bez limitu 600 s; smoke `wf_18c9ceff-8ad` zielony (1,93 M, −13% vs R-P10; mutanty 6 → 2 findingi) = **referencja R-P11**; merge `--ff-only` do main. **P12 SESJA 1/5 ZROBIONA 2026-10-06 (6a pkt 67): podział 5 sesji (S1 coding-rules; S2 warstwa stała builderów + builder data + skille danych; S3 ui/fullstack + skille UI + D10; S4 harness + pilot; S5 druga faza + smoke + merge) zaakceptowany; coding-rules przepisane `6da298e` (operator przekazał ocenę → recenzja subagenta, decyzje w `P12-CODING-RULES.md`): reguły mechaniczne jednym blokiem z progami = ESLint, `paths:` kod+SQL, fix i /dev-pr czytają plik jawnie; 585/585; gałąź `popr/P12-buildery` NIEZMERGOWANA. **P12 SESJA 2/5 ZROBIONA 2026-10-06 (6a pkt 68):** `feature-builder-data` od zera + test szkieletu buildera, skille danych (security = reguły implementatora, protokół audytu w resources; Sentry bez krzyku, H39 jako treść; Supabase stała / referencyjna, REVOKE EXECUTE w 9 funkcjach), `nastepneKroki` do dziennika, planner serial przy migracji; recenzja subagenta 24/25 + weryfikacja; 604/604. **P12 SESJA 3/5 ZROBIONA 2026-10-06 (6a pkt 69):** `feature-builder-ui` i `-fullstack` od zera (+ `-figma` tą samą treścią), blok „Wymagania wykonania” usunięty z plannera, blok plików innych IU tej fazy + serial, D10 (`wiedza/zapobieganie.mjs`, `wycinek --zapobieganie` tylko dla plannera), skille UI: SKILL.md stała, `resources/` zgodne z coding-rules (dwie rundy wykonawców, przykłady kluczowe sprawdzone `tsc`), wyjątek typu zwracanego w coding-rules; prompt-audit w obie strony (`dane/pa-*-po-P12.*`); recenzja 18 + 47 uwag + dwie weryfikacje; 626/626. **P12 SESJA 4/5 ZROBIONA 2026-10-07 (6a pkt 70):** wybór faz skryptem (klucz D10 osiągalny przez blok IU), D10 globy hooków i klientów API, harness ślepego testu builderów (kopia na bazie buildu, execute-wf wariantu, review z main, sędzia z kodem historycznym jako kalibracją, chmod reszty testu na czas buildu), recenzja 15 uwag + dwie weryfikacje; pilot f-1de5a4c 14,4 M: remis 6/10 zapobieżonych u obu, czułość 10/10, ctx_start buildera −7%; 627/627. **P12 ZROBIONA 2026-10-07 (6a pkt 71):** D10 u7 (bramki i ścieżka błędu tylko na zapleczu, testy poza doborem); druga faza f-b8374c8 — razem 2 fazy 18 K: stary 9/8/1, nowy 8/10/0 (netto +1), P1/P2 review 20 → 17, build −3%, ctx_start −8%; decyzje po recenzji: buildery i coding-rules zostają, D10 bez dalszych zmian (osobny limit D10 → P16; D10 w dojrzałym projekcie wypierają reguły projektu); smoke `wf_47df65c4-56f` zielony (1,83 M, −5% vs R-P11, reguły eager 0) = R-P12; merge `--ff-only` do main; 629/629. Grupa III zamknięta i wypchnięta 2026-10-07; kopie smoke P11/P12 i ~/test-review usunięte. **P13 SESJA 1/2 ZROBIONA 2026-10-07 (6a pkt 72):** `.claude/scripts/plan/` — parser planu fail-closed, generator trzech plików `docs/active/` (zadania z odnośnikami do IU, bez kopii treści), walidacja planu z tabelą plików i budżetem pliku (linie jak ESLint, 300/360), bramka gotowości, CLI `plan.mjs`; test kontraktu z konsumentami; planner czyta `Plan techniczny:`; recenzja 2 P1 + 5 P2 + 13 P3 i weryfikacja (2 P2 + 4 P3) wdrożone (poza bramką E2E per scenariusz → S2); 694/694; gałąź `popr/P13-planowanie` NIEZMERGOWANA. **P13 ZROBIONA 2026-10-07 (6a pkt 73):** scalony `/dev-plan` (SKILL.md 33 KB zamiast 63,5 + 24,7 KB dev-plan + dev-docs; `references/`: szablon planu z przykładem przechodzącym `sprawdz`, kontekst designerski, przygotowanie operatora; Faza 6 = bramka E2E per scenariusz → `sprawdz` → branch → `generuj --zapisz` → commit → `gotowosc` → Workflow), dev-docs usunięty, test odwołań `/dev-*`, research przy Lekkiej przez `wycinek --bez-zawsze`, telemetria `skill.artefakty`, fixture smoke'a z generatora (gałąź kopii `feature/smoke-autopilot`); recenzja 0 P1 / 4 P2 / 8 P3 wdrożona; 714/714; smoke `wf_d085974e-8d3` zielony (zadanie z `/dev-plan` w kopii: planowanie do startu autopilota 0,19 M, 1 wiadomość operatora, `sprawdz` i bramka za pierwszym razem, bez agentów badawczych; run 1,21 M, 0 błędów schematu) = **R-P13**; merge `--ff-only` do main. **P14 SESJA 1/3 ZROBIONA 2026-10-07 (6a pkt 74):** podział 3 sesji i 4 decyzje E2E (wg rekomendacji) zaakceptowane; `.claude/scripts/e2e/` (scenariusze, księgowanie [E2E] z przyczyną SKIP, `.env.e2e` z parametrami `E2E_URL`/`E2E_START`/`E2E_HEALTH`/`E2E_START_TIMEOUT`, sprawdzenie i start/stop/stan serwera, CLI `e2e.mjs`); autopilot: precheck + env-up → jeden agent `e2e:start`, niesprawne środowisko przy [E2E] = STOP przed fazą 1 z naprawą skryptu, awaria w trakcie = scenariusze na [Manual] z powodem i reszta runu bez przeglądarki (zero STOP-ów E2E w środku runu), smoke operatora z sekcją „E2E do odegrania ręcznie”, telemetria `faza.e2e.manual` + `run.manual_razem`; H13, H61 łatami; recenzja 0 P1 / 8 P2 / 10 P3 wdrożona; 770/770; gałąź `popr/P14-e2e` NIEZMERGOWANA. **P14 SESJA 2/3 ZROBIONA 2026-10-07 (6a pkt 75):** decyzje 4× wg rekomendacji; tester od nowa (procedura w pliku roli, `e2ePrompt` = parametry + tryb, seed vs kontrakt migracji, scenariusze ze skryptu); `e2e.mjs scenariusze / mapa / weryfikacja`, Doctor i Launch bez zadania; generator `/weryfikacja-setup` (skill projektu `.claude/skills/weryfikacja/` + mapa funkcji z planów); gotowość dev-plan = decyzja bootstrapu; archiwizacja dopisuje funkcje do mapy; recenzja 0 P1 / 4 P2 / 6 P3 + weryfikacja N1–N8 wdrożone; 821/821; gałąź `popr/P14-e2e` NIEZMERGOWANA. **P14 ZROBIONA 2026-10-08 (6a pkt 76) — PACZKA ZAMKNIĘTA:** klucz klienta bazy e2e publishable albo legacy anon, poprawki po krótkiej recenzji 9628595 (0 P1 / 2 P2 / 4 P3), fixture smoke'a z [E2E] w dwóch fazach (statyczna strona w `public` aplikacji Vite), `E2E_START` w cudzysłowie; 825/825; smoke w dwóch przebiegach na kopii oferty z bazą e2e = staging oferty (zgoda operatora): (1) `wf_745c7f98-e26` STOP `start: srodowisko E2E` przed fazą 1 (0,13 M, 74 s); (2) `/weryfikacja-setup` headless w kopii (`changed`: logowanie magic link zamiast hasła) → `wf_24fe1f85-0cb` OK, 2,52 M (+38% vs R-P12 — druga faza), faza 1 `smoke-strona` PASS z dowodem (tester: `e2e.mjs scenariusze`, skill i mapa przeczytane), faza 2 po `e2e.mjs stop` strażnikiem → SKIP `srodowisko` → [Manual] z powodem, sekcja w smoke'u operatora, `faza.e2e.manual` 1, `run.manual_razem` 1, 0 STOP-ów w trakcie, mapa funkcji z oboma flow; tester 0,17 M (2 × ~0,08 M) = **R-P14**; merge `--ff-only` do main `7c8c93d`; szablon wypchnięty 2026-10-08, kopia smoke'a usunięta. NASTĘPNY KROK: §8 „P15 — OGRODNIK”** (nowa sesja — N2). Stan paczek: P0 ☑ P1 ☑ P2 ☑ P3 ☑ P4 ☑ P5 ☑ P6 ☑ P7 ☑ P8 ☑ P9 ☑ P10 ☑ P11 ☑ P12 ☑ P13 ☑ P14 ☑ P15 ☐ P16 ☐. Poprzedni zapis: jeden plan paczek do akceptacji, potem wdrażanie paczka po paczce w kolejnych sesjach |

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
   **[KOREKTA 2026-09-23, przegląd D5, przyjęta: `koszt_agentow.py` brał pierwszy (częściowy) wpis `usage` każdej odpowiedzi API — output zaniżony ~5×.
   Poprawnie: cache read 53,6%, cache write 35,5%, output 10,9%; całość 1 293 M jedn., nie 1 179 M (`dane/d5r-koszt-output.txt`). Telemetria widziała ~11%.
   Udziały etapów fazy zmieniają się ≤0,4 pp — wnioski i kolejność stoją.]**
2. **Opłata za powołanie agenta = 22% całości.** Pierwsza tura każdego agenta zapisuje do cache ~107k tokenów (system prompt 44k,
   CLAUDE.md+rules 33k, nazwy ~900 narzędzi MCP 27k, opisy ~300 skilli 10k). Faza powołuje **35 agentów** (740 tur). **[Po korekcie D5: 20% całości;
   analogicznie „40% kontekst × tury” → 36,5%, „26% czysty narzut” → 24%.]** **[KOREKTA D4 2026-09-23, przyjęta: skład liczony po ~4 zn/tok; zmierzony
   (opus, 09-08..09-17, p50 137,5k): schematy narzędzi 42k, CLAUDE.md 30k, learned-patterns 21k, coding-rules 6k, nazwy MCP 16k, skille 8,5k, prompt 6k —
   tekst polski ~2 zn/tok; haiku = 0,742 tokena opusa. Udział „start × wywołania” 54,7% / 60,9% (run 20.09); `dane/d4r-dzwignia-kontekstu.txt`.]**
3. **Stały narzut kontekstu × tury = 40% kosztu** (26% to czysty narzut bez promptu zadania). `oferty-online/CLAUDE.md` urósł
   z 3,4k do 89,7k znaków w 4 tygodnie, `learned-patterns.md` 0 → 47k — dopisuje je dev-compound. Każdy agent niesie to w każdej turze.
4. **Udziały per etap fazy (oferty-online po 06.09):** execute (planner+build+domknięcie) 28%, 6 reviewerów 25%, pętla fix 17%,
   orkiestracja+e2e-env+zakończenie 12%, sceptycy 6%, mechanika review (packager+dedup+scribe) 5%. Żaden pojedynczy reviewer > 5,4%.
5. **Builderzy/fix czytają przez Bash:** 78% ich komend to cat/sed/grep (tryb „bashFirst strict"), 37 Bash vs 2 Read na agenta;
   każda komenda = tura = ponowny odczyt 150–200k kontekstu.
6. **Skille przed autopilotem (prep, plan, docs) = 2–5% kosztu zadania.** Scalenie dev-plan+dev-docs oszczędza czas operatora
   (~1–2 h przekazań) i jedno przepisanie (zadania z dev-docs to w 22–46% niemal dosłowna kopia planu 57–137 kB), nie tokeny autopilota.
   **[KOREKTA 2026-09-23, przegląd D6, przyjęta: „2–5%” liczyło tylko pierwszą odpowiedź skilla (`koszt_skilli.py` zamyka epizod także na powrocie
   subagenta i przerwaniu; rozmowa z operatorem i subagenci poza nim). Pełny koszt: ~4–7% kosztu zadania w medianie, do ~1/5 w małych; dev-plan mediana
   2,39 M (nie 0,81), z czego subagenci researchu 18,6 M z 55,6 M; dev-docs ~0,56 M; prep+plan+docs 95,8 M zamiast 39,2 M (`dane/d6r-rewizja-audytu.txt`).
   Wniosek o scaleniu stoi.]**
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
      metodą co `skrypty/d2_budzet_instrukcji.py` [ZMIENIONE 2026-09-23 za zgodą operatora (przegląd D2): test liczy pozycje JEDNEGO oznaczonego bloku poleceń
      warstwy stałej i pada, gdy poza blokiem jest zdanie nakazowe — licznik D2 zależy od formy zapisu i nagradzałby przepisanie list na prozę] — **NIE w runie** (operator 2026-09-21: „autopilot ma się nie stopować przez kilka linii"), tylko jako TEST
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
      telemetria D3 pokazuje 4–5 zestawów ustawień (mechaniczny-haiku, orkiestracyjny-opus, reviewer, sceptyk, naprawiacz z Edit+skille) [KOREKTA 2026-09-23:
      klasy uzasadnia zestaw USTAWIEŃ, których rola potrzebuje (model, CLAUDE.md, Edit/skille, MCP) — telemetria pokazuje poziom kontekstu w trakcie pracy, nie ustawienia]. Istniejące 8 plików
      (4 reviewerów, tester E2E, 3 buildery) = wyjątki per rola. Docelowo kilkanaście plików zamiast 40. Wejście do panelu jako preferowany kierunek.
    - **L4 (test-coverage): TAK (operator 2026-09-21)** — oś test-coverage ZOSTAJE; trzy warstwy mechaniczne to dodatki z wynikiem do buildera; scalenie z correctness tylko jako opcja wariantu z warunkiem odwrotu i po pomiarze warstw 2–3. Obowiązuje POMIARY §2 nad ETAP2 §2.
    - **L10 uzupełnienie (operator 2026-09-21): reguły security nie są USUWANE, tylko WARUNKOWE po profilu stacku** (rozszerzenie 6a pkt 6). Projekt z `supabase/` → bramka advisors (chmura) przejmuje RLS/search_path/auth.users, a security dostaje polecenie „nie sprawdzaj tego, robi to advisors". Projekt bez Supabase (np. Postgres na VPS) → security zachowuje polecenia-listy o RLS/politykach, bo nie ma bramki. Profil stacku z package.json + katalogów trafia do promptu każdego reviewera (dossier), nie tylko builderów.
    - **L15: robimy w domknięciach przed panelem** (D3, 20 min) razem z D1 i D2 — na znak operatora.
    - **Telemetria: „trzeba też to przygotować"** → nowe domknięcie **D5 (~30 min):** szkic rekordu telemetrii (pola) + wskazanie, który skrypt i w którym miejscu runu go dopisuje (produktyzacja `skrypty/koszt_agentow.py`); wejście do panelu jako element obowiązkowy każdego projektu; implementacja w planie etapu 5.
    - **L5: WERSJA B (operator 2026-09-21)** — obowiązuje 6a pkt 15: CLAUDE.md (odchudzony) u builderów i reviewerów, `omitClaudeMd` tylko u agentów mechanicznych, bypass i czytanie Bashem zostają, reguły `paths:` = bonus. POMIARY §5 pkt 1 i HANDOFF §5 hipoteza 7 są NIEAKTUALNE — zapisać w pakiecie wejściowym panelu.
    - **Po D4 (operator 2026-09-21): L11 nadpisuje ETAP1 „powtórka po STOP-ie E2E = sam tester"** — STOP środowiskowy/limitowy → [MANUAL], run idzie dalej;
      zapis ETAP1 i HANDOFF §5 hipoteza 4 NIEAKTUALNE (nie ma powtórki po STOP-ie, który nie zatrzymuje runu). Wpisane jako precedens 6 w PANEL-WEJSCIE §1.
    - **L14 — hooki Stop i dwa martwe agenty: POTWIERDZONE przez operatora 2026-09-21 (wszystkie trzy punkty):** (a) `stop-build-check-enhanced.sh` (tsc po każdej odpowiedzi w sesji głównej) ZOSTAJE — działa poza autopilotem, zero tokenów; (b) `error-handling-reminder.sh` (console.log / captureError w edytowanych plikach, exit 2 = dodatkowa tura) → WYCOFAĆ, gdy bramka ESLint (`no-console` + reguła Sentry) wejdzie do domknięcia fazy; (c) `kieran-typescript-reviewer.md` i `code-simplicity-reviewer.md` to ścieżka odwrotu konsolidacji z 2026-09-03 (`dev-docs-review-wf.js:349-359`), nie przypadkowe resztki — po panelu ścieżka odwrotu traci sens; ich treść (kieran §4b async/błędy, §5 usunięcia i regresje, §7 sygnały ekstrakcji modułu; simplicity: YAGNI) posłuży jako materiał do poleceń-list osi correctness i code-quality, a pliki do USUNIĘCIA. NIE wplatać w inny proces.

19. **Decyzje operatora po lekturze PANEL-WEJSCIE-DLA-OPERATORA (2026-09-22):**
    - **Panel na Fable, nie na Opusie** („zależy nam na jakości"). **[ZMIENIONE 2026-09-23 — 6a pkt 22: panel na Opus 5.5.]** Zasada „subagenci na opus" (pamięć projektu) NIE dotyczy panelu. Warunek wykonania: panel jako
      TRZY osobne runy Workflow (projektanci → sesja główna czyta → sędziowie → sceptyk), synteza w sesji głównej; przed startem sprawdzić stan limitu Fable
      (pierwsza sesja analizy padła na limicie). Mini-run 6a pkt 16 zostaje na Opusie (sprawdza zachowanie buildera w prawdziwym pipelinie, buildery jadą na Opusie).
    - **Panel NIE buduje** — wynik panelu = koncepcja docelowego pipeline'u + kolejność wdrożenia; etap 5 = plan wdrożenia w iteracjach; implementacja faza po fazie,
      każda z metryką w telemetrii („tych zmian będzie bardzo dużo, nie możemy ich nanieść na raz"). Żaden projektant nie pisze kodu.
    - **Scalenie dev-plan + dev-docs = WYMÓG każdego projektu** (dotąd hipoteza 6 „otwarta dla panelu"). Każdy projekt projektuje scalony skill z budżetem tokenów
      i z analizą, co te skille dziś robią i gdzie przepalają kontekst (dane: HANDOFF §3 pkt 6, 6a pkt 8, `dane/skille.csv`, `dane/koszt_skilli.txt`).
    - **Audyt użycia skilli szablonu → nowe domknięcie D6 (przed panelem, ~30 min, zero agentów):** skrypt na `dane/skille.csv` (149 epizodów, 5 projektów)
      + grep po transkryptach sesji: który skill szablonu był uruchamiany, ile razy, za ile; który nigdy → lista „używane / nieużywane / kandydaci do usunięcia"
      jako fakt wejściowy panelu (§7 pakietu). Skille konta (nie szablonu) → etap higieny konta, bez zmian.
    - **E2E → MANUAL, doprecyzowanie:** warunek wstępny = środowisko E2E sprawdzone i działające PRZED startem autopilota (doctor/precheck); gdy w trakcie runu test
      nie może się wykonać, checkbox przechodzi na [MANUAL] z powodem i **trafia do smoke operatora** (dev-docs-complete), nie znika; ponowne uruchamianie
      środowiska w runie jest droższe niż test ręczny.
    - **Walidacja zmian → nowe domknięcie D5b (przed panelem, ~1 h, zero agentów):** mapa walidacji — dla każdego z wymogów §2 pakietu i każdego założenia
      z warunkiem odwrotu (§6): metryka, pole rekordu telemetrii, punkt odniesienia z etapu 0 (import `agents.csv` / `telemetria-odzyskana`), horyzont (po ilu
      fazach/zadaniach). Kontrola odwrotna: czy rekord D5 ma wszystkie pola, których mapa potrzebuje; braki dopisać do rekordu TERAZ. Wymóg dla panelu:
      **każda zmiana w projekcie ma wskazaną metrykę z rekordu.** Plik: `dane/d5b-mapa-walidacji.txt` + sekcja w PANEL-WEJSCIE §12.
    - **Kolejność dalszych kroków (uzgodniona 2026-09-22):** (1) zapis decyzji [ZROBIONE 2026-09-22] → (2) D6 audyt skilli → (3) D5b mapa walidacji → po każdym
      rozmowa z operatorem → (4) mini-run na Opusie, na znak → (5) panel w 3 runach na Fable [od 2026-09-23: na Opus 5.5, 6a pkt 22], na znak → (6) etap 5 raporty + plan wdrożenia w iteracjach
      → poza analizą: wdrożenie iteracji 1 (telemetria pierwsza), higiena konta, pomiar po 5 zadaniach.
    - **Praca w nowych sesjach:** operator czyści kontekst po każdym większym kroku; każda sesja startuje od instrukcji z §8 tego pliku.
    - **Mapa walidacji v2 (2026-09-22, AKCEPTACJA operatora):** 9 poprawek z `PROPOZYCJA-POPRAWEK-MAPY-WALIDACJI.md` przyjęte i wprowadzone. W planie etapu 5
      dwa nowe kroki PRZED pierwszą zmianą pipeline'u: kalibracja klasyfikatora uwag bota na 2–3 starych PR i zebranie B0 z 2–3 zadań po zmianie konfiguracji bota.
    - **Przegląd domknięć na Opus 5.5 (2026-09-23, `PROPOZYCJA-POPRAWEK-DOMKNIEC.md`, sekcja per domknięcie, akceptacja operatora po każdej):**
      **D1 PRZYJĘTE** — pół na pół zamiast 60/40 (trzecia para, klasa semantyczna, łańcuch 4 defektów fixa przeoczonych przez pełną rundę 2); wybór n=3 vs
      sceptyk nie wynika z podziału. Poprawione: POMIARY §4, ETAP3 §7, PANEL-WEJSCIE §2a/§4/§8, wersja operatora (część 2 pkt 9 i akapit o obalonej tezie),
      mapa walidacji (kontekst pętli fix). Obserwacja sesji dla etapu 5 (NIE decyzja): po fixie mechaniczny krok sprzątania (grep nazw zmienionych/usuniętych
      przez fix + komentarze i dokumenty je opisujące — 3 defekty „stara linia, przyczyna w fixie” i 3 rozjazdy CLAUDE.md); finding, którego naprawa wymaga
      nowej funkcjonalności (nowy plik, nowa ścieżka), nie idzie pętlą fix, tylko jako nowa IU z własnym review (łańcuch z run 2→3).
      **D2 PRZYJĘTE** (poprawki 1–4): procenty IFScale nie przenoszą się (inna jednostka), górna granica bez dubla (~500 / ~670), builder na medianie;
      **zmiana jednostki testu budżetu** (oznaczony blok poleceń — operator: „tak”); **budżet uzasadnia trafność i koszt** (reviewer ~110 zawsze obowiązujących,
      ~2/3 warunkowe), nie procent przestrzegania; **oczekiwanie wobec poleceń-list obniżone** (D1 + 1b: raczej granica uwagi niż nadmiar reguł);
      **mini-run (d) 100 vs 400 = test rozstrzygający**, czy liczba poleceń jest u nas dźwignią jakości. Poprawione: ETAP3 §7, PANEL-WEJSCIE §2 pkt 3/§4/§6/§8/§11,
      wersja operatora (część 2 pkt 3, część 8), mapa walidacji obu wersji (§2 pkt 3, założenie 1).
      **D3 PRZYJĘTE** (operator: pomiar w mini-runie, bez osobnego przebiegu): kontekst per klasa z telemetrii miesza epoki wzrostu CLAUDE.md oferty 13,8k → 87k zn
      (ctx 1. tury rósł 55k → 101k mechaniczne, 76k → 145k reviewerzy; zero runów po ścięciu do 21k [KOREKTA D5: run 20.09 miał już CLAUDE.md 17,8k na gałęzi — pierwszy punkt odniesienia, mini-run (e)
      = potwierdzenie]) → punkt odniesienia `tools:` = mini-run (e) per klasa i model;
      CLAUDE.md nie tłumaczy różnicy klas (różnica startu to głównie model: haiku ~93k vs opus ~127k); klasy uzasadnia zestaw ustawień; freshness-audit-wf poza mapą.
      Poprawione: PANEL-WEJSCIE §4/§11/§12, ETAP3 §7, mapa walidacji obu wersji, wersja operatora, `dane/d3-mapa-rol-agentow.txt`.
      **D5 PRZYJĘTE w całości** (operator 2026-09-23): skan pliku harnessu jako główny zapis (wariant A zbędny, zasada 6a pkt 19 stoi), run/faza „ostatni
      wygrywa”, `szablon.skrypt_sha`, unikalne wątki bota per PR, `agent.kontekst` z załączników transkryptu, output w modelu kosztu 10,9% (nie 2%), korekta D3
      (run 20.09 = pierwszy punkt odniesienia). Poprawione: rekord D5 (§8 + dopiski), PANEL-WEJSCIE §1 pkt 4/§2 pkt 5/§4/§8/§11/§12, wersja operatora (część 2
      pkt 1, 6, 8), mapa walidacji obu wersji, digest §0, d3-mapa, HANDOFF §3. Na listę etapu 5: sync-template zapisuje hash per plik w manifeście.
      **D6 PRZYJĘTE w całości** (operator 2026-09-23, po lekturze `PRZEGLAD-D6-DLA-OPERATORA.md`): koszt skilli przed autopilotem liczony do pierwszej
      odpowiedzi → pełny ~2,4× (dev-plan 2,39 M, subagenci researchu największą pozycją; ~4–7% kosztu zadania), rekord `skill` z nową granicą i polem
      `wiadomosci_operatora`; retencja ~30 dni; kandydaci D porzuceni (historia terminala), tryb ręczny zastąpiony autopilotem (593 → 0); dzieci
      i dev-pr przeliczone z pliku harnessu. Poprawione: wynik D6 (dopisek), PANEL-WEJSCIE §2 pkt 12/§7/§12, wersja operatora (część 2 pkt 12, część 7),
      mapa walidacji obu wersji (§2 pkt 12), rekord D5 (§8 pkt 1 + §9), digest §2, HANDOFF §3 pkt 6. Decyzje operatora o koszyku D, dev-ideate/freshness-audit
      i trybie ręcznym — nadal otwarte (fakty uporządkowane).
      **D4 PRZYJĘTE w całości** (operator 2026-09-23, po lekturze `PRZEGLAD-D4-DLA-OPERATORA.md`): dźwignia kontekstu ≈ 40–50% kosztu fazy po ścięciu
      CLAUDE.md (nie 25–35%; liczona z transkryptów, run 20.09 51,4%, epoka wcześniejsza 37,1%, sama allowlista 27–38%); dźwignie nie sumują się (roster
      i mechanika po allowliście rząd 3–7%); nowe cele ctx_start per klasa i model; porządkowe (tokenizer haiku 0,742, skład startu, L8 zależne od MCP w sesji,
      pola znakowe w `agent.kontekst`, metryka „start × wywołania”, stare zapisy wersji operatora, `cleanupPeriodDays` → §10). Poprawione: wszystkie miejsca
      z listy w §D4 „Co się zmieni po akceptacji”. **PRZEGLĄD DOMKNIĘĆ ZAKOŃCZONY** (D1–D6 przyjęte). Dalej: decyzje operatora z D6 (koszyk D, dev-ideate
      i freshness-audit, tryb ręczny — ten ostatni jako pytanie dla panelu), potem mini-run na znak — §8.

20. **Decyzje operatora po D6 (2026-09-23, po zakończeniu przeglądu domknięć):**
    - **Koszyk D WYPADA z szablonu:** code-review, code-quality, gemini, dev-docs-update, bugfix. Przy usuwaniu: README, `learnings-researcher.md:256`;
      szablon mobile — osobna decyzja (nie ruszać bez pytania).
    - **dev-ideate i freshness-audit (skill + `freshness-audit-wf.js`) WYPADAJĄ.** Role freshness-audit-wf znikają z mapy ról (D3 porządkowe 4).
    - **Tryb ręczny execute/review WYPADA** — przestaje być pytaniem dla panelu. UWAGA wdrożeniowa: workflowy `dev-docs-execute-wf` / `dev-docs-review-wf`
      ZOSTAJĄ (woła je autopilot); SKILL.md dev-docs-execute/review czyta dziś agent w runie (D6) — przed usunięciem skilli treść potrzebna agentom przenieść
      do workflowów/plików klas; opisy trzech builderów „wywoływany przez dev-docs-execute” przepiąć na workflow.
    - **`cleanupPeriodDays` = 120 dni: TAK** — wykonanie w etapie higieny konta (ustawienie konta, nie szablonu).
    - Usunięcia NIE są wykonywane w analizie — trafiają na listę zmian szablonu (PANEL-WEJSCIE §10) i do planu etapu 5. Panel projektuje bez tych elementów.

21. **Mini-run (2026-09-23) — wynik ZAAKCEPTOWANY przez operatora („Tak, możesz wpisać wyniki.”):** `MINI-RUN-WYNIK.md` + `MINI-RUN-DLA-OPERATORA.md`.
    - Przebieg: krok 0 i serie D, F w sesji 86e1644e; E1, E2, A1–A3 w osobnej sesji desktop otwartej w kopii (32225565: `wf_11b9703a-88c`, `wf_05f587d0-a37`,
      `wf_05c98a00-54e`, `wf_3f022ded-be5`, `wf_28d5e2da-917`); modele z transkryptów: claude-opus-5-5 i claude-haiku-4-5; E+D+A 5,2 M jedn.
    - Rozstrzygnięcia wg kryteriów MINI-RUN-PLAN §7: (a) DZIAŁA, (b) POTWIERDZONE (kanał `paths:` 0/3; R dotarło 3/3 `cat`-em pliku widocznego w `git status`
      — artefakt testu), (c) STOSOWANA (2/2 treści, która dotarła; A-1 bez skilla, A-2/A-3 ze SKILL.md poprzedniego runu), (d) BRAK DŹWIGNI, (e) POTWIERDZONE
      (komórki niemechaniczne E2 z korektą TOLk w `mr_kontekst.py` — learned-patterns ładowany eager mimo `git mv`; stawka d4r sprawdzona +0,9%), (f) fakty → §12.
    - Poboczne → PANEL §2a: N1 (przekazana wiadomość operatora wykonywana przez haiku; zabezpieczenie: zdanie do agentów w poleceniu startu + allowlista
      mechanicznych bez Bash/Write), N2 (bufor instrukcji/skilli sesji → nowa sesja po zmianach `.claude/`, §10), N3 (`git status` w `session_context`).
    - Kopia oferty-online i surowe wyniki w scratchpadzie sesji 86e1644e zostają do końca analizy (wyniki A i hook skopiowane do `dane/mr-surowe/`);
      usuwanie tylko za zgodą operatora.

22. **Model panelu (operator 2026-09-23, po mini-runie): „Panel będziemy robić na Opus 5.5 … uruchomimy dopiero jak dam znać”.** Zastępuje „panel na Fable”
    z 6a pkt 19. Wszyscy agenci panelu (projektanci, sędziowie, sceptyk) na Opus 5.5 z przypiętym `model: 'claude-opus-5-5'` (krok 0 mini-runu: pełny
    identyfikator przypina model, alias `opus` też daje dziś 5.5); synteza w sesji głównej na Opus 5.5. Reszta z 6a pkt 19 bez zmian: trzy osobne runy,
    panel nie buduje, żaden projektant nie pisze kodu. Sprawdzanie limitu Fable odpada. Start panelu WYŁĄCZNIE na znak operatora.

23. **PANEL DECYZYJNY zamiast panelu projektowego (operator 2026-09-23: „Podoba mi się ta wersja. Zrobimy to w ten sposób, zamiast tego panelu, który ustaliliśmy.”).**
    Powód (ocena sesji głównej przyjęta): wymogi PANEL-WEJSCIE §2 przesądzają szkielet, więc trzy pełne projekty „tanio / jakość / hybryda” różniłyby się
    w kilku miejscach, a wybór hybrydy byłby przewidywalny; na jednym modelu różnorodność jeszcze spada; sędziowie bez danych oceniliby jakość opinią
    (trzech na tym samym modelu = jedna opinia trzy razy); „zwycięzca bierze wszystko” gubi dobre rozwiązania przegranych. Nowa konstrukcja (Opus 5.5, pkt 22):
    - **Krok 0 — sesja główna, skrypty, zero agentów:** (a) lista OTWARTYCH decyzji z opcjami i danymi — reszta = stały szkielet z §2 (kandydaci z pakietu:
      kształt review — odchudzone osie + sceptyk asymetryczny / n=3 równoległe próbki + agregator / 1 reviewer z budżetem + bramki; batch sceptyków; packager → JS;
      spec tylko w fazach z kodem; test-coverage scalone jako opcja; projekt scalonego dev-plan+dev-docs; kolejność wdrożenia); (b) zestaw historyczny do oceny
      jakości: 68 realnych ucieczek (ETAP1 §3) + 195 uwag B bota z klasą (`dane/coderabbit/klasyfikacja-574.csv`); (c) skrypt kosztu projektu
      (model kosztu etapu 0 + starty klas z mini-runu (e)).
    - **Run 1 — projektanci per ARCHITEKTURA REVIEW** (największa pozycja kosztu), nie per priorytet: każdy broni jednej architektury do końca i w jej ramach
      rozstrzyga pozostałe otwarte decyzje; wynik = zapis per decyzja. Sesja główna czyta; koszt każdego projektu liczy skrypt, nie agent.
    - **Run 2 — sędzia jakości na historii:** dla każdego przypadku z zestawu i każdego projektu: złapany? czym (bramka / polecenie-lista / oś review / sceptyk) / nie.
      Zamiast trzech identycznych sędziów.
    - **Run 3 — sceptyk asymetryczny PER OTWARTA DECYZJA:** każdy zarzut z dowodem w danych albo kodzie (DISAGREE_EVIDENCE), nie ogólna krytyka zwycięzcy.
    - **Synteza w sesji głównej:** rekord per decyzja (wybór, dlaczego, metryka z mapy walidacji, warunek odwrotu) → wprost plan iteracji etapu 5.
    ~5–7 agentów. Wymogi §2, precedensy §1, założenia §6, elementy §7, rekord §12 i zabezpieczenia z mini-runu (N1, N2) obowiązują bez zmian.
    Start WYŁĄCZNIE na znak operatora; najpierw plan (część A).

24. **PROMPT-AUDIT przed panelem (operator 2026-09-23: „rozpoczniemy nową sesję między innymi od tego, aby wykorzystać ten skill … i zrobić z nim analizę”).**
    Nowa sesja zaczyna od `/claude-api prompt-audit` na maszynerii szablonu (skille, agenci, prompty w workflowach JS, reguły, CLAUDE.md, teksty hooków):
    szukanie instrukcji pisanych pod starsze modele, które na Opus 5.5 / Haiku 4.5 szkodzą (przesadny nacisk, rusztowania zastąpione funkcjami API,
    nadmierne rozpisanie metody, skamieliny, choreografia formatu). Wynik = raport + proponowany diff, BEZ nanoszenia zmian; ustalenia trafiają jako wejście
    do panelu decyzyjnego (warstwa stała promptów ról, §2 pkt 3). Operator ma poza tym tematy-inspiracje do omówienia w tej samej sesji. Kolejność: audyt →
    tematy operatora → (ewentualne dopiski 6a) → panel decyzyjny na znak. Instrukcja startowa: §8 „AKTUALNA”.

25. **Prompt-audit ZAAKCEPTOWANY W CAŁOŚCI (operator 2026-09-24: „Wszystkie uwagi, które tutaj dostaliśmy, są jak najbardziej w porządku. Dodajmy je do
    naszej dokumentacji jako kolejny obszar, który będziemy aktualizować.”).** Wynik: `PROMPT-AUDIT.md` (44 pozycje PA-01…PA-44, pewność, akcje, §4 „co
    z tego dla panelu”), `PROMPT-AUDIT-DLA-OPERATORA.md`, `dane/pa-proponowany.diff`. Konsekwencje:
    - **Nowy obszar zmian szablonu: „prompty maszynerii”** — PANEL-WEJSCIE §10 (podsekcja „Obszar: prompty”). Diff NIE jest naniesiony w analizie
      (zasada z pkt 19: wdrożenie w iteracjach etapu 5, każda z metryką). Podział: (a) niezależne od panelu, do pierwszej iteracji zmian szablonu —
      PA-03, 04, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21; (b) pliki reviewerów (PA-01, 02, 05, 06, 07) — teraz tylko, jeśli pliki klas
      ról z panelu są dalej niż jedna iteracja, inaczej ich treść wchodzi do zasad pisania plików klas; (c) PA-25 (odświeżenie kopii skilla Figmy
      z pluginu) i PA-26 (coding-rules — materiał do przepisania reguł operatora, ETAP2 tabela USUŃ/ZMIEŃ) — decyzje operatora przy wdrożeniu.
    - **Wejście do panelu (PANEL-WEJSCIE §2a):** siedem zasad pisania warstwy stałej ról (PROMPT-AUDIT §4) + otwarte decyzje do kroku 0:
      efort per klasa roli na Opus 5.5 (PA-22), liczba warstw weryfikacji (PA-29), obowiązkowy research w dev-plan przy głębokości „Lekka” (PA-30),
      opisy workflowów-dzieci w liście skilli (PA-31); skill `security` u builderów → warstwa referencyjna w postaci reguł (PA-24); learned-patterns:
      przy wdrożeniu §2 pkt 4 usunąć też krok 1.7 z plików builderów (PA-27).
    - **Telemetria:** rekord `agent` dostaje pole `effort` (harness go nie zapisuje — 3 402/3 402 wpisów bez pola), `dane/d5-telemetria-rekord.txt` §10;
      metryki obszaru w `dane/d5b-mapa-walidacji.txt` §7 i w wersji operatora mapy.
    - **Obszar aktualizowany cyklicznie:** ponowny `/claude-api prompt-audit` z tym samym Step 0 (zakres, model per rola, stałe ograniczenia) przy każdej
      zmianie modelu pipeline'u, po wdrożeniu plików klas ról z panelu i po każdej iteracji dotykającej promptów; skrypty `pa_*.py` do powtórzenia
      (inwentarz, sygnały, wywołania per rola, kontrola w obie strony). Po naniesieniu zmian w `.claude/` — nowa sesja przed autopilotem (N2).

26. **Tematy-inspiracje operatora: mattpocock/skills + wystąpienie poteto (2026-09-24, akceptacja punkt po punkcie).** Wynik: `INSPIRACJE-POCOCK-PSTACK.md`
    (v2 po transkrypcji Whisper od operatora, 38:02; pstack `12d587d`, mattpocock `c55ee46`) + `INSPIRACJE-POCOCK-PSTACK-DLA-OPERATORA.md`; skrypty `insp_inwentarz.py`,
    `insp_komentarze.py`, `insp_granice.py`, `insp_koszt_e2e.py` → `dane/insp-*.txt`. Sedno wystąpienia: zaufanie z weryfikacji na żywej aplikacji (CLI w skillu
    + mapa funkcji) i drabina egzekwowania (kod → lint → reguła/skill → review). Decyzje:
    - **PRZYJĘTE, zmiany szablonu poza panelem (PANEL-WEJSCIE §10, wdrożenie w iteracjach etapu 5 z metryką — mapa walidacji §8):**
      (a) **compound ze szczeblem** — przed zapisem reguły pole `szczebel: kod | lint | regula`; `kod`/`lint` → `propozycjeBramek[]` do operatora (obok
      `propozycjeDoReviewerow[]`), do learned-patterns tylko `regula` (przykład: X-Forwarded-For z learned-patterns oferty → reguła lint „nagłówek czytany tylko w jednym wskazanym miejscu”);
      (b) **pytanie „czy test przeszedłby, gdyby każda importowana funkcja zwracała `undefined`”** + 5 kształtów testu niefalsyfikowalnego → polecenie-lista
      test-coverage i jedna pozycja warstwy stałej builderów; część mechaniczna w regułach wtyczki vitest; (c) **wyjątek w coding-rules §2 (operator: TAK)** —
      usunąć wolno tylko ZIELONY test niefalsyfikowalny, gdy nie da się przepisać asercji na konkretną wartość; czerwonego nigdy; każde usunięcie w raporcie fazy
      (nazwa + powód); (d) **odbiór każdej bramki: przejście → podłożone naruszenie → porażka → przejście** (test w `__tests__` albo doctor); (e) **cztery zasady
      pisania z `writing-for-agents`** do zasad warstwy stałej (§2a, zasady 8–11) i checklisty prompt-auditu: cel pozytywny zamiast zakazu, kryterium ukończenia
      kroku, środowisko jako źródło prawdy, no-op rozstrzyga uruchomienie; (f) **prompty zmieniamy według wytycznych Anthropic** (skill `claude-api` prompt-audit,
      przewodnik migracji); zmiany promptów reviewerów i builderów sprawdzane przed/po na jednej historycznej fazie metodą ślepą (bez słów eval/test w zadaniu,
      sędzia z neutralnymi etykietami, ocena z transkryptu, nie z deklaracji); (g) **lint a stary kod (operator): kod poprawiamy PRZED uruchomieniem nowego
      workflow** — każda nowa reguła lint wchodzi razem z posprzątaniem starych miejsc w tej samej zmianie; pierwsze wdrożenie ESLint w projekcie = osobne
      zadanie sprzątające (oferty-online: 188 zastanych błędów, POMIARY §3).
    - **PRZYJĘTE jako WYMOGI dla panelu (PANEL-WEJSCIE §2 pkt 14–16; panel projektuje szczegóły, nie rozstrzyga „czy”):** (h) **skill weryfikacji z mapą funkcji**
      (wariant b): per projekt, generowany skillem szablonu, sekcje Launch/Doctor/Drive/Evidence/Cleanup + mapa funkcji (droga użytkownika, dowód działania,
      pliki kodu funkcji); tester czyta skill; sprawdzenie środowiska przed startem (pkt 19) = sekcja Doctor; complete dopisuje funkcje z zadania; **przejście
      regresyjne po funkcjach dotkniętych diffem (wariant c) ODŁOŻONE** z warunkiem: telemetria pokaże regresje w funkcjach nietkniętych planem (bot/Sentry).
      Koszt dziś: role E2E 4,7% kosztu runów, tester 2,5% (`dane/insp-koszt-e2e.txt`). (i) **granice warstw w ESLint, bez dependency-cruiser:** zakaz importu
      klienta Supabase w komponentach i ekranach **bez wyjątku dla auth (wariant A)** — wylogowanie przez wspólny hook, dozwolone tylko hooki/lib/provider
      sesji; `import-x/no-cycle`. oferty-online: 5/88 plików `.tsx` z importem klienta, 1 wywołanie bazy (ekran zaproszenia, `rpc`) + 5 auth → zadanie
      sprzątające (`dane/insp-granice.txt`). (j) **ogrodnik automatycznie na zamknięciu zadania** w autopilocie (po compound/compound-refresh, przed archiwizacją):
      agent mechaniczny uruchamia skrypt (wyciszenia lint/TS, `any` i wymuszone rzutowania, komentarze TODO/obejście/tymczasowo, puste `catch`) i porównuje
      z poprzednim pomiarem w telemetrii; agent oceny tylko przy wyraźnym przyroście albo co kilka zadań; sekcja „Ogród” w podsumowaniu zadania, propozycje do
      operatora, zero zmian w kodzie bez decyzji; odwrót: kilka zadań bez przyjętej propozycji → wyłączyć. Nie powtarza błędu freshness-audit (ręczny, nieużywany).
    - **OTWARTA DECYZJA do kroku 0 panelu:** (k) rozkład reguł zachowaniowych builder ↔ reviewer (Matt `retro`: standardy egzekwuje reviewer; za: builder
      ~480–490 instrukcji, mini-run (d); przeciw: ETAP1 45/68 ucieczek miało regułę, każdy finding = tura fixa); metryka: P1/P2 na fazę, tury fixa, ctx_start buildera.
    - **ODRZUCONE:** skala pewności dowodu 1–5 (ocena sesji przyjęta przez operatora: przyrost formy, główny efekt jest już w §2 pkt 7), lżejszy plan dla małych
      zadań + pole „szwy testowe”, równoległe IU w worktree, zakaz komentarzy (ogrodnik liczy komentarze-obejścia według (j)), sześć pozycji „na później”
      (katalog odrzucanych uwag bota, porażki CI, dziennik decyzji, opis PR z ryzykiem, wizard, ankieta dla klienta), drabina egzekwowania jako zasada
      przekrojowa panelu (szczebel zostaje tylko w compoundzie, (a)). Poza tym „nie bierzemy” z raportu §4 (router poteto-mode, interrogate, auto-merge,
      pętla zewnętrzna Slack/Sentry, weryfikacja formalna, skille Matta do trackera/nauki/handoffu).

27. **Plan panelu decyzyjnego ZAAKCEPTOWANY (operator 2026-09-24).** `PANEL-PLAN.md` + `PANEL-PLAN-DLA-OPERATORA.md`. Odpowiedzi: **D12 (sprzątanie po fixie
    grepem nazw + finding wymagający nowej funkcjonalności → nowa IU) WCHODZI do panelu** („Tak”, po przypomnieniu D1r: 6 defektów „stara nazwa po fixie”, łańcuch 4,
    pliki fixa ≈3× gorsze); **projektant C (1 reviewer + bramki) ZOSTAJE** („Koszty nas silniej wiążą dzisiaj niż efekt”). Wykonanie w NOWEJ sesji (kontekst sesji
    planu ~400k tokenów). Zestaw historyczny = 195 B (68 ucieczek ETAP1 to te same wątki bota; compound = kontekst), `dane/panel-zestaw-historyczny.*`.

28. **Ocena papierowa nie rozstrzyga — prawdziwy test review przed wyborem (operator 2026-09-25, po run 2).** Run 2 (sędzia na opisach mechanizmów) przecenia:
    dzisiejszemu pipeline’owi dał 32,8% (high) / 41,5% (medium) przy prawdziwym 0% (kalibracja > 15% dwukrotnie = STOP §10). Operator: „Jak to ma być koncepcja,
    to jest bez sensu. To trzeba było uruchomić na prawdziwym przebiegu” i **„nie odrzucał żadnej koncepcji, dopóki nie wykonamy prawdziwych testów”** — żaden
    z projektów A, B, C nie odpada na podstawie run 2; wynik run 2 zostaje jako informacja (które projekty mają konkretne polecenia na klasy błędów), nie podstawa
    wyboru. **Następny krok: PLAN prawdziwego testu review (replay na historycznych fazach oferty-online: dziś vs A vs B vs C, znane uwagi bota jako klucz, bramki
    uruchamiane naprawdę, koszt z transkryptów) — najpierw plan i koszt do akceptacji, bez uruchamiania agentów.** Run 3 (sceptycy) wstrzymany do decyzji po planie
    testu; do ustalenia w planie, które z D2–D12 test obejmie, a które idą z warunkiem odwrotu i pomiarem po wdrożeniu.

29. **Plan prawdziwego testu review ZAAKCEPTOWANY (operator 2026-09-25).** `TEST-REVIEW-PLAN.md` + `TEST-REVIEW-PLAN-DLA-OPERATORA.md`; liczby skryptami
    `test_review_fazy.py`, `test_review_klucz2.py`, `test_review_plan.py` → `dane/test-review-{fazy,klucz2,plan}.*`. Istota: replay etapu znajdowania na
    kopiach kodu z chwili tuż przed review historycznej fazy (historia ucięta — przyszłość niewidoczna), cztery warianty (0 = prawdziwy `dev-docs-review-wf`
    ucięty przed weryfikacją, kontrola bajtowa promptów; A/B/C = prompty złożone skryptem z brzmienia katalogów), bramki naprawdę, ślepy sędzia na dwóch kluczach:
    **klucz 1** = 104 uwagi B w 37 fazach (91 z 195 poza testem — tury PR, fixy, dopiski po autopilocie; P1 w kluczu 3 z 9), **klucz 2** = 210 potwierdzonych
    P1/P2 historycznego review tych faz (odwrotna selekcja — czy wariant nie gubi dzisiejszych trafień). Decyzje operatora: (a) plan przyjęty — w nowej sesji
    skrypty przygotowawcze bez agentów, przed pilotem złożone prompty A/B/C i koszt pilota do wglądu; (b) **moduł kontroli diffu fixa (D12) WCHODZI** (~44 M,
    „jeżeli ten koszt da nam jak najwięcej informacji … akceptuję”; 2 commity fixa w pilocie jako próba harnessu); (c) efort wariantu 0 — operator: „sesje są
    na high i medium” → **test bierze `high`** (konserwatywnie; ustawiany flagą sesji headless, nie dziedziczony z sesji głównej), potwierdzenie przy zgodzie
    na pilot; (d) **przebieg fazami, nie wariantami** (kopia + bramki → 4 warianty naraz → sędzia → sceptycy → koszt i decyzja o następnej fazie); pilot jedna
    faza naraz. Kolejność: pilot 3 faz + powtórka (26–66 + 8–22 M) → notatka → operator wybiera zakres etapu głównego (rekomendacja 75% = 21 faz, 232–605 M,
    MDD ~20 pkt). Run 3 po teście: D1, D2, D5, D12 z liczbami z testu; D3, D4, D6–D11 jak PANEL-PLAN §6 z warunkiem odwrotu.
30. **Pilot testu review ZROBIONY i przyjęty; zakres etapu głównego wybrany (operator 2026-09-26).** Notatka `TEST-REVIEW-PILOT-DLA-OPERATORA.md`,
    liczby `skrypty/test_review_pilot.py` → `dane/test-review/pilot*.json|txt` (stan w §8 „PILOT ZROBIONY”). Decyzje: (a) **zakres 50% przypadków = 13 faz**
    (pierwsze 13 z `kolejnosc` w `dane/test-review-plan.json`), **jeden przebieg (r=1)**, MDD ~24 pkt — operator świadomie: security i ogon bez wniosku;
    (b) moduł kontroli diffu fixa zostaje wg pkt 29(b); (c) jedna permutacja sędziego (zgodność p1/p2 „szeroko” 148/148); (d) **limit etapu ~300 M jedn.**
    (1,5 × szacunek po pilocie: 152 M fazy + ~48 M moduł fixa); (e) konto CLI automatyzacje@aibiz.pl, `claude auth status` przed każdym runem;
    (f) start etapu głównego dopiero na osobny znak operatora — najpierw przygotowanie bez agentów w nowej sesji.
31. **Etap główny testu review ZROBIONY; zgoda na analizę (operator 2026-09-26/27).** Start za zgodą, wyniki 5 jednostek pilota wzięte bez powtórki
    (p1 pilota = etap); 37/37 jednostek, 183,6 / 300 M, 0 twardych (§8 „ETAP GŁÓWNY ZROBIONY”, notatka `TEST-REVIEW-ETAP-DLA-OPERATORA.md`).
    Decyzje: (a) **zgoda na analizę i raport** `TEST-REVIEW-WYNIK.md` + wersja operatora — bez agentów, w **nowej sesji** (kontekst tej wyczerpany);
    (b) commit docs/reviews od razu. Operator źle odczytał klucz 2 jako „dzisiejszy pipeline łapie lepiej” → w raporcie wyniku oba klucze opisywać
    jako **zysk (klucz 1) i strata (klucz 2) względem dziś**, z wprost napisaną stronniczością każdego klucza.
32. **Analiza wyniku testu review ZAAKCEPTOWANA; decyzja D1 i D12 (operator 2026-09-27).** `TEST-REVIEW-WYNIK.md` + `TEST-REVIEW-WYNIK-DLA-OPERATORA.md`,
    liczby `skrypty/test_review_analiza.py probka|wynik` (+ moduły `_kalibracja`, `_mechanizmy`, `_tekst`) → `dane/test-review/wynik*.{json,txt}`.
    Wynik: sędzia 0/20; fazy review — klucz 1 A +9,4 [−1,8; +22,0], B 0,0, C +3,8 (żaden istotny); klucz 2 A −11,1 [−25; 0], B −12,7 [−23; 0],
    C −25,4 [−39; −14]; bilans P1/P2 A −4, B −8, C −16 (istotny); koszt znajdowania PO na fazę 0 2,63 / A 1,50 / B 1,92 / C 0,44 M; kontrola fixa
    0/30 → A/B/C 15–16/30. „+24 pkt dla A” z notatki etapu = w ¾ moduł fixa. Operator zgodził się z wnioskiem sesji głównej („Zgadzam się”):
    (a) **żaden z A/B/C nie jest lepszy od dzisiejszego review faz — obecna architektura (6 osobnych reviewerów) ZOSTAJE i jest optymalizowana**,
    A/B/C nie idą dalej jako osobne projekty (A = źródło pokręteł optymalizacji; „A + soczewka wydajności” nie jest osobnym kandydatem);
    (b) **dodatki z dowodem działania wchodzą do planu wdrożenia:** kontrola diffu fixa wg katalogu A (**D12 część 1 rozstrzygnięta testem**;
    część 2 „finding → nowa IU” niezmierzona), bramki lint/knip jako wejście review, lista przeżytych mutantów dla reviewera testów (ułożenie wejścia
    jak w C — u A/B ta sama lista nie zadziałała); (c) **koszt obecnego review obniżany po jednym pokrętle** (efort, długość poleceń, skład), każde
    z metryką i warunkiem odwrotu — test nie mówi, które pokrętło dało A −43%; (d) następny krok: wstępne wybory D2–D11 z liczbami z testu i
    przygotowanie run 3 (sceptycy) w NOWEJ sesji bez agentów; run 3 dopiero za zgodą z kosztem. D1 i D12 cz. 1 są zamknięte — sceptycy ich nie otwierają.
    **(d) ZASTĄPIONE przez pkt 33.**
33. **Run 3 (sceptycy) POMINIĘTY (operator 2026-09-27: „Zgadzam się, pomiń run 3”).** Powody (sesja główna): run 3 był kontrolą wyboru między
    projektami A/B/C, którego już nie ma; to nadal ocena „na papierze” (6a pkt 28 — papier przecenia); zostały głównie małe, odwracalne zmiany
    obecnego pipeline'u, które i tak idą z metryką i warunkiem odwrotu (pomiar po wdrożeniu, okno 5 PR względem B0). Konsekwencja: następna sesja
    (bez agentów) ustala wybory D2–D11 i D12 cz. 2 w sesji głównej — każdy z danymi (test review, panel, pomiary), metryką i warunkiem odwrotu —
    i od razu plan wdrożenia w iteracjach (etap 5); rekord per decyzja jak PANEL-PLAN §7 pkt 5 bez pól sceptyka. `skrypty/panel_run3_*` zostają
    nieuruchomione (historia). Opcja odrzucona: okrojony run 3 dla decyzji trudnych do cofnięcia.
34. **Decyzje D2–D12 i plan wdrożenia ZAAKCEPTOWANE (operator 2026-09-27: „Akceptuję.”).** `PANEL-WYNIK.md` + `PANEL-WYNIK-DLA-OPERATORA.md`; liczby
    skryptami `pokretla_kosztu.py`, `d12_nowe_pliki_fixa.py`, `tempo_pr.py`, kontrola kompletności `panel_wynik_pokrycie.py` (65/65) → `dane/`.
    Akceptacja obejmuje dokument razem z trzema rekomendacjami zadanymi operatorowi: (a) rekordy D2–D11 i D12 cz. 2 z §2 (D2 batch 4 dla P2 + P1 ×3,
    razem z sceptykiem asymetrycznym; D3 packager → skrypt BEZ mandatu; D4 spec w fazach z kodem; D5 Stryker w domknięciu, lista mutantów ułożona jak w C,
    test-coverage `medium`; D6 efort jawny — reviewerzy `high`, potem test-coverage i spec `medium`, code-quality NIE `low`; D7 cztery warstwy;
    D8a/D8b scalony dev-plan jak A, research warunkowy; D9 `disable-model-invocation` dla dzieci; D10 zapobiegalne u buildera, wykrywalne u reviewera;
    D11 plan z §4; **D12 cz. 2 NIE teraz** — 1/21 P1/P2 urodzonych w fixie leży w nowym pliku produkcyjnym, warunek powrotu ≥ 3 w oknie 5 PR);
    (b) **cofnięte trzy ustalenia z §2a / założeń §6** (PANEL-WYNIK §3): performance ZOSTAJE (zał. 2 wypada), code-quality zostaje na `high` ze swoim
    promptem, lint jako wejście (nie „zakaz zgłaszania”), security NIE skracany do ~90 linii bez ślepego testu (zał. 3 wstrzymane), test-coverage
    scalone wypada (zał. 6), PA-01/02/05/06/07 tylko po ślepym teście; (c) **allowlista `tools:` w It. 3 równolegle z kontrolą diffu fixa jako R1**
    (reviewerom zmienia się tylko zestaw narzędzi, CLAUDE.md zostaje). Plan (PANEL-WYNIK §4 + §4a): It. 1 telemetria + import (+ higiena konta
    równolegle, przed B0), It. 2 bot + dev-pr + kalibracja + B0, It. 3 kontrola diffu fixa (W1) z R1 3a–3e, It. 4 bramki ‖ mutanty (W2), It. 5 sceptyk +
    batch (W3), It. 6 fix tylko P1/P2 (W4), It. 7 listy correctness ‖ spec (W5), It. 8 wiedza u buildera / learned-patterns (W6), It. 9 warstwa stała (W7).
    Lekcja sesji: pierwsza wersja PANEL-WYNIK miała miejsce tylko dla 31 z 65 wcześniejszych ustaleń (brakowało m.in. CLAUDE.md, szczegółów
    learned-patterns, dev-pr, higieny konta, coding-rules) — operator zapytał; kontrola „źródła → dokument” musi iść po CAŁEJ historii ustaleń (6a 1–N,
    PANEL-WEJSCIE), nie po liście zadań sesji; skrypt `panel_wynik_pokrycie.py` jest wzorem. **Raporty etapu 5: bez publikacji jako strony** (operator);
    forma do wyboru (pełna / skrócona / bez raportów) — §8.
35. **Raporty etapu 5 — FORMA SKRÓCONA (operator 2026-09-27: „Wybieram opcję 2, skróconą.”), bez publikacji jako strony.** `RAPORT-DLA-OPERATORA.md`
    w pełni (prosty język: dziś / po, co zyska, czego wymaga, higiena konta i L8, trzy lekcje z ETAP2 §6, ryzyka prostymi słowami, jak czytać pierwszy
    pomiar); `RAPORT-TECHNICZNY.md` jako SPIS (decyzja per element w jednej linii + plik z dowodem, mapa plików analizy, ograniczenia L6–L18 i tezy
    PANEL-WEJSCIE §8 ze stanem po teście, ścieżki do danych i skryptów, szybkie zyski) + JEDNA nowa liczba: koszt typowego zadania po całym planie,
    liczony skryptem kosztu panelu na docelowym składzie ról. Treści nie kopiować — odsyłać do PANEL-WYNIK i plików etapów. Jedna sesja, bez agentów.
    Instrukcja: §8 „RAPORTY ETAPU 5”.
36. **Raporty etapu 5 ZAAKCEPTOWANE (operator 2026-09-28: „wszystko jest dla mnie ok, zgadzam się”) + dwie zmiany założeń.**
    `RAPORT-DLA-OPERATORA.md`, `RAPORT-TECHNICZNY.md`; nowa liczba `dane/raport-koszt-po.txt` (zadanie 52,04 → 22,37 M†, −57,0%; dźwignie nie sumują się:
    −51,2% kontekst, potem −12,0% zmiany ról; allowlista sama −40,2%, learned-patterns poza eager −18,3% po allowliście — przesłanka zamiany It. 7 ↔ It. 8).
    (a) **oferty-online = materiał do nauki, nie miejsce wdrożenia** (operator: nie będzie tam pracował, buduje nowe projekty): B0 = pierwsze 2–3 zadania
    NOWEGO projektu; zadanie sprzątające ESLint w oferty-online WYPADA; It. 3e zostaje, ale nie blokuje; tempo i „≈ 2 miesiące” nieznane dla nowych
    projektów; liczby mapy walidacji z oferty = tło, progi względem B0; historia oferty tylko do odczytu (kalibracja klasyfikatora, ślepe testy na kopiach).
    Szczegóły RAPORT-TECHNICZNY §2; dopisek w PANEL-WYNIK §4. (b) **Higiena konta = KROK 0 przed It. 1** (wcześniej „równolegle z It. 1”): B0 musi
    powstać na uporządkowanym koncie; konto dokłada ~41,9k tok always-on do KAŻDEJ sesji (posthog ~30,2k, 164 skille; `dane/konto-inwentarz-workspace-template.txt`).
    Decyzje per element podejmuje operator (nie chce globalnie m.in. frontend-design; część do skasowania) — lista w raporcie to tylko kierunek.
    **Widok GLOBALNY całego komputera** (wszystkie projekty, nie jeden) jest wymogiem kroku 0 (operator 2026-09-28). Instrukcja: §8 „KROK 0 — PORZĄDKI KONTA”.
37. **KROK 0 — porządki konta ZAKOŃCZONE (2026-09-28/29; sesje 8d1f302f, N2 9825ccd5, N3 3e95dbdd; operator 2026-09-29: „tak, visualize zostaje”).**
    `KROK0-DECYZJE.md` (decyzje per element, kopie w `~/claude-konto-kopie/2026-09-28-przed-krok0/`, komendy, wyniki N2 i N3); dane
    `dane/konto-inwentarz-globalny-{przed,po,po-n3}.{txt,json}`; skrypty `skrypty/konto_*.py`, `skrypty/krok0_*.{py,sh}`.
    (a) **Wynik** (start sesji w workspace-template, aplikacja desktop): always-on poziomu user ~46,2k → ~0,1k tok; skille 303 (248 bez opisu) → 48 (0);
    narzędzia MCP 265 z 30 serwerów → 87 z 14 (wbudowane w aplikację + konektor `visualize`); instrukcje MCP 5 100 → 1 022 zn; hooki: tylko Stop.
    B0 (It. 2) powstanie na uporządkowanym koncie.
    (b) **Wniosek N2:** aplikacja desktop omija klucze `syncClaudeAiPlugins`, `syncClaudeAiSkills`, `disableClaudeAiConnectors` w `~/.claude/settings.json`
    (działają tylko w terminalowym `claude`) — pluginy claude.ai wstrzykuje jako `<nazwa>@inline`, konektory jako jawne `mcpServers` sesji.
    Pluginy wyłącza `"<nazwa>@inline": false` w `enabledPlugins` (potwierdzone w N3), konektory — menu konektorów w sesji zakładki Code (trwale).
    Konektor `visualize` (funkcja Anthropic, 2 narzędzia, ~50 tok) wraca w każdej sesji — ZOSTAJE (operator).
    (c) **Narzędzie inwentarza:** skill `/konto` w `~/Documents/kacper_trzepiecinski_workspace/.claude/skills/konto/` (skrypty w `scripts/`,
    commit `c6e4db3c3` w repo workspace); źródło skryptów zostaje w `skrypty/` tej analizy.
    (d) **WYMÓG OPERATORA → It. 3c:** w szablonie instrukcja instalacji z WSZYSTKIMI wymaganymi pluginami, skillami i narzędziami, instalowanymi
    PER PROJEKT, nie globalnie (KROK0-DECYZJE „WYMÓG OPERATORA”: pluginy dev-browser i figma, narzędzia agent-browser, jq, git, gh, node, supabase CLI
    warunkowo, Dynamic Workflows), razem z profilem `.claude/settings.json` szablonu (KROK0-DECYZJE pkt 8: `extraKnownMarketplaces` + `enabledPlugins`
    dev-browser, figma + `disableClaudeAiConnectors`). Z (b): `disableClaudeAiConnectors` w profilu chroni tylko terminalowe `claude` — kursantom
    w aplikacji desktop NIE wyłączy konektorów ani pluginów claude.ai; instrukcja instalacji mówi to wprost i pokazuje, jak zrobić to w aplikacji
    (menu konektorów w sesji Code; pluginy: `"<nazwa>@inline": false` — decyzja kursanta). Do sprawdzenia w It. 3c na czystym koncie: czy wpisy
    projektu proponują instalację marketplace'ów i pluginów per projekt.
    (e) **Otwarte po stronie operatora:** token Airtable w workspace wyciekł w sesji 8d1f302f i w N3 był nadal ten sam (porównanie skrótem) —
    unieważnić w Airtable i wpisać nowy (`claude mcp add-json airtable … -s local` w workspace).
    Następny krok: It. 1 telemetria — §8 „IT. 1 — TELEMETRIA”.
38. **It. 1 — TELEMETRIA + IMPORT WDROŻONE (2026-09-29/30, sesja 335da867; plan zaakceptowany decyzja po decyzji; czeka na odczyt smoke).**
    `IT1-PLAN.md` (§4 decyzje, §7 wynik) + `IT1-PLAN-DLA-OPERATORA.md`. **Decyzje operatora:** O10 narzędzia jakości w repo szablonu z krokiem 0
    („To, co proponujesz, to jest gorsze podejście. Przecież możemy dodać” → „tak, O10 z krokiem 0”); O2 pełny skan zamiast importu CSV; O3 usunąć
    wszystkie trzy liczniki `budget.spent()`; O7 25–35 klas + `inna` BEZ akceptacji operatora — zamiast niej review niezależnego subagenta (wyjątek
    od „bez agentów”); O9 smoke teraz; O1, O4, O5, O6, O8 wg rekomendacji. Pytanie operatora przy O1 „czy agent Haiku zostaje?” — agent telemetrii
    (haiku) USUNIĘTY; pozostali mechaniczni haiku zostają do It. 3.
    (a) **Kod (11 commitów, 191 testów, `pnpm typecheck && pnpm test && pnpm lint` zielone):** `package.json` (pnpm, TS 7.0.2 strict/checkJs,
    ESLint 10 z procesorem workflowów, no-new-func/no-eval) + poprawki 63 znalezisk bez zmiany zachowania; `.claude/scripts/telemetria/` (17 modułów
    ≤ 210 l.: transkrypt, role, harness, agent, run, faza, git, szablon, skill, zapis, zbieranie, zbierz CLI, raport-sekcje, raport CLI); hook Stop
    `zbierz.mjs --hook` (0,1 s, exit 0, pusty stdout; pierwszy hook bez znacznika = tylko ostatnia doba); `dev-autopilot-wf.js` bez agenta telemetrii
    i bez `tokeny`/`tokenyEtapy`/`tokenyRazemK`; `dev-pr-wf.js` z `KLASY_BLEDOW` (33 klasy) i polami `klasaBledu`/`os`/`waga`/`plikiPr`/`prNumer`;
    `sync-template.sh` zapisuje `.claude/.template-hashes`; README (wiersz dev-autopilot-wf), SKILL.md sync-template.
    (b) **Akceptacje na prawdziwych danych (skrypty `it1_akceptacja_*.mjs`, wyniki `dane/it1-akceptacja-*.txt`):** koszt 2 941 agentów 1 293,2 M vs
    1 293 M (0,02%), udziały etapów = d5r §2; statusy runów sprzed D5 6/6, pliki fixa A/M 79/79; 55 runów autopilota, 33 skrypty spoza historii
    szablonu = D5; mediany skilli 2 392 / 559 / 1 401 k = D6 (n 19/18/15); raport: udziały i `ctx_start` 20.09 (89/121/125/123/135k) = D3;
    import: 19 PR, 574 uwagi, B P1/P2 = 6,7 na 100 plików = d5b; 42 unikalne `run_v0` z 73 starych wpisów.
    (c) **Dane:** `~/.claude/telemetry/pipeline.jsonl` — pełna historia maszyny (428 runów, 1 730 sesji, 4 142 agentów, 669 epizodów skilli + import)
    zapisana przed wygaśnięciem transkryptów (O2); stary `autopilot-runs.jsonl` nietknięty.
    (d) **Odstępstwa od planu (do wiadomości):** efort czytany z transkryptu (pole `effort` wpisów `assistant`), nie z etykiet; kategorie STOP
    rozszerzone o `execute`, `walidacja`, `bramka-wejscia` (dane: „inne” 4 → 0), kategoria liczona bez dopisku `stopRun` o brudnym drzewie;
    „w toku” liczone po SESJI (`background_tasks` podaje id zadania, nie `wf_`); epizody skilli zapisywane także otwarte (`otwarty: true`), bez
    epizodów żywej sesji hooka; wersja rekordu `v` (dziś 3) — zmiana logiki = nowe wersje rekordów; import PR jako typ `pr` (PR = kilka runów dev-pr);
    **korekta planu:** wzorzec `ctx_start` w kroku 6 to punkt odniesienia 20.09 (D3), a nie cele po It. 3a (8,8k/25,5k…).
    (e) **Otwarte:** kompakcja `pipeline.jsonl` (każde podbicie `v` dopisuje ~5,3 tys. rekordów; dziś 20 MB, hook 0,14 s — do rozważenia przy ~100 MB);
    skan w doctor → It. 3c (O5); push szablonu do GitHuba — decyzja operatora (projekty dostaną zmiany dopiero po push + sync-template).
    Następny krok: §8 „IT. 1 — ODCZYT (SMOKE)” w NOWEJ sesji (N2: `.claude/` zmienione).
39. **It. 1 — ODCZYT (SMOKE) ZALICZONY I ZAAKCEPTOWANY (2026-09-30, sesja 97c023aa; operator: „akceptuję, popraw wszystkie trzy wady raportu teraz”).**
    `IT1-ODCZYT.md` + `IT1-ODCZYT-DLA-OPERATORA.md`; sprawdzenia `skrypty/it1_odczyt.py wf_031f0eae-204` → `dane/it1-odczyt.txt`.
    (a) **Run:** kopia `~/Documents/Kodowanie/_smoke-it1-oferty-online` (klon lokalny, bez remote, gałąź `test/smoke-autopilot`, sync z lokalnego
    szablonu 165/165 hashy); operator puścił `/dev-autopilot-wf docs/active/smoke-autopilot` w osobnej sesji desktop (`d40cf2e0`). Run
    `wf_031f0eae-204`: OK, 1 faza, gate CZYSTE, 31 agentów, **4,78 M**, 19 min (szacunek 5–10 M / 30–45 min). Wszystkie asercje §3 IT1-PLAN i README
    smoke'a TAK (hook zapisał 30 s po końcu; 31/31 agentów; `szablon.zgodny`; effort 22/22 opus; 0 `telemetria:*`; bez `tokeny*`; `smokeStatus: plik`).
    Pełny skan: 427/427 plików harnessu z rekordem `run`, 0 NIEZNANY.
    (b) **Błąd skanu poprawiony:** `run.walidacja` = null we wszystkich runach (autopilot zwraca obiekt walidacji) → `wynikWalidacji()` w `run.mjs`,
    `WERSJA_REKORDU` 4 (+5 368 rekordów, plik 27,6 MB); na danych 22 PASS / 4 FAIL / 31 null = pliki harnessu.
    (c) **3 wady raportu poprawione (bez ponownego skanu, pola już w rekordach):** raport tylko pipeline dev-\* (`czyPipeline()`; analizy 306 M z 1 319 M
    osobnym wierszem — wcześniej fałszywy „kontekst opus 5.5 ~50k”); wątki bota bez wagi = „bez klasyfikacji” (wszystkie 178 wrześniowych);
    `KOMENDY_LOKALNE` wspólne dla skanu i raportu (regex identyczny). `it1_akceptacja_raportu.mjs` po poprawkach bez zmiany liczby. 196 testów.
    (d) **Liczby do dalszych iteracji:** kontekst startowy dev-\* opus 5.5 we wrześniu 114–136k; w smoke'u po KROKU 0 **73–84k** (40 narzędzi zamiast 685;
    haiku 52k) — to efekt konta, nie It. 3a. Uwagi bota P1/P2 na 100 plików: pierwsza liczba z pierwszego runu dev-pr po sync; do tego czasu import (6,7, d5b).
    (e) **Obserwacje do It. 3 (nie blokują):** fixture smoke'a w monorepo (`src/lib` poza bramkami) wymusza cykl fixa; commit archiwizacji dostaje
    komunikat commita feature; szablon śledzi `.claude/skills/ux-ui-guidelines/.DS_Store`; rekord, którego nowa logika skanu już nie tworzy,
    zostaje w pliku (dziś 3, filtr w raporcie) — mechanizm ogólny przy drugim przypadku (It. 3c, doctor).
    (f) **Otwarte u operatora:** push szablonu do GitHuba (projekty dostaną telemetrię v4 dopiero po push + `sync-template`); nowy token Airtable.
    Kopia `~/Documents/Kodowanie/_smoke-it1-oferty-online` USUNIĘTA 2026-09-30 za zgodą operatora (oryginał nietknięty); transkrypty sesji kopii
    zostają w `~/.claude/projects/` (źródło rekordów telemetrii).
    (g) **Kolejny etap — ustalenie z operatorem (2026-09-30):** It. 2 ma dwie części o różnej naturze. **2A (sesja w szablonie):** konfiguracja bota,
    4 zmiany dev-pr, kalibracja klasyfikatora — robota jak It. 1 (plan → akceptacja → test → kod). **2B (czas kalendarzowy u operatora):** B0 =
    pierwsze 2–3 zadania NOWEGO projektu na szablonie po 2A, bez żadnych zmian pipeline'u w tym czasie. **Wszystko od It. 3 czeka na B0**
    (B0 kosztu i jakości to punkt odniesienia każdej dalszej zmiany), więc ścieżką krytyczną jest nowy projekt operatora, nie praca w szablonie.
    Kolejność: 2A → push szablonu do GitHuba → nowy projekt z `sync-template` → 2–3 zadania (autopilot + dev-pr) → odczyt B0 → It. 3.
    Następny krok: §8 „IT. 2 — BOT, DEV-PR I B0” (nowa sesja). **UCHYLONE przez pkt 40.**
40. **ZMIANA ZAŁOŻEŃ: B0 NIE BLOKUJE — poprawiamy cały szablon teraz (operator 2026-09-30).** Dosłownie: „Po prostu chcę zgodnie z naszymi
    rzeczami, które znaliśmy, poprawić cały nasz szablon. Jak poprawię, będę mógł wchodzić w nowe projekty i budować, ale będziemy sobie mierzyć.
    Mamy do tego telemetrię, więc to już jest skończone. Po prostu przejdźmy już do poprawy.”
    **Skutki:** (1) iteracje z PANEL-WYNIK §4 (It. 2–9 + R1) i cała lista §4a wdrażane w szablonie JEDNA PO DRUGIEJ bez okien jakości i bez B0
    jako warunku; kolejność wg zależności i ryzyka, nie wg okien W1–W7. (2) Pomiar = telemetria It. 1 na nowych projektach operatora PO poprawie
    (raport.mjs --projekt); warunki odwrotu z §4 zostają jako progi do odczytu później, nie jako bramki wdrożenia. (3) Zabezpieczenie w trakcie:
    testy szablonu (typecheck/test/lint) + smoke-autopilot po każdej paczce zmian w workflowach (sprawdza mechanikę, ~5 M, ~20 min; odniesienie
    kosztu `wf_031f0eae-204`: 4,78 M, kontekst opus 73–84k). (4) Ślepe testy przed/po dla zmian promptów reviewerów/builderów (6a pkt 26 f, I5,
    warunek 7c) — do decyzji operatora w planie poprawy (rekomendacja w planie). (5) Część „B0 na nowym projekcie” (pkt 39 g) wypada jako warunek;
    pierwszy nowy projekt po poprawie = pierwszy odczyt. Następny krok: §8 „PLAN POPRAWY SZABLONU” (nowa sesja).
41. **PLAN POPRAWY SZABLONU ZAAKCEPTOWANY (operator 2026-09-30: „Akceptuję plan, decyzje 1–3 wg rekomendacji”).** `PLAN-POPRAWY.md` (technicznie: paczki,
    pliki, hunki, testy, smoke, cofnięcie, progi do odczytu, §4 wspólne pliki, §5 wypada/zrobione/odłożone) + `PLAN-POPRAWY-DLA-OPERATORA.md`.
    (a) **Kształt:** 17 paczek — I porządek i koszt P0 siatka (skrypt kopii smoke, odczyt vs referencja, `pa_hunk.py`, test odwołań), P1 porządki i usunięcia
    (+ 4 łaty faktów reviewerów: PA-03, 04, 09, 20), P2 instalacja per projekt i doctor, P3 kontekst i efort (klasy ról, allowlista, D9, N1), P4 start i koniec
    runu, P5 dev-pr i bot (+ warunek decyzji w bootstrapie); II mechanika fazy P6 bramki, P7 dossier i stan ze skryptu, P8 pętla fix (It. 3 + It. 6), P9 sceptycy;
    III P10 wiedza (przed reviewerami — zamiana It. 7 ↔ 8), P11 reviewerzy, P12 buildery i coding-rules; IV P13 scalony dev-plan, P14 E2E i skill weryfikacji,
    P15 ogrodnik, P16 zamknięcie (prompt-audit, karta odczytu). Treść plików reviewerów pisana raz w P11, builderów w P12.
    (b) **Decyzje operatora (rekomendacje §6):** D-1 ślepe testy ZOSTAJĄ jako dwa testy — reviewerzy: stare i nowe pliki na bieżącym zestawie, 7 z 13 faz
    `~/test-review`, jeden przebieg sędziego (~30–40 M, 2 sesje); buildery 1–2 fazy (~10–15 M); osobno kill rate sceptyka na archiwum przed merge'em P9.
    `~/test-review` NIE usuwać do końca P12. D-2 push po każdej zamkniętej grupie (po P5, P9, P12, P16), zawsze po zielonym smoke'u. D-3 smoke po każdej paczce
    zmieniającej workflowy (15; P7 i P14 z drugim przebiegiem), gałąź `popr/Pn-<nazwa>`, merge `--ff-only` po zielonym smoke'u.
    (c) **Kontrola:** `skrypty/plan_poprawy_pokrycie.py` (rejestr 395 pozycji: PANEL-WYNIK §2–§5, 65 pozycji PANEL-WYNIK, PA-01…44, 62 hunki, INSPIRACJE, 6a,
    IT1-ODCZYT, PANEL-WEJSCIE) → 0 braków; odbiór skryptu 7/7 podłożonych naruszeń; przegląd niezależnego subagenta — 25 uwag (1 blokująca: P7 bez kanału dossier
    i stanu), wszystkie naniesione (`dane/plan-poprawy-przeglad.txt`).
    (d) **Odstępstwa od wcześniejszych zapisów (przyjęte z planem):** 4 łaty faktów reviewerów w P1 zamiast w P11 (fałszywe findingi w smoke'ach P3–P10);
    `stan:zapis` zostaje tam, gdzie w danym miejscu nie startuje inny agent (runtime nie pisze plików; lista miejsc do HANDOFF w P7); PA-27 w P10 (razem
    z przeniesieniem learned-patterns); warunek „CLAUDE.md uzgodniony” w bootstrapie w P5, nie w P4; B0 i progi „względem B0” → pierwsze 5 PR nowego projektu.
    (e) **Decyzje przy wdrożeniu (w paczkach):** PA-25 kopia Figmy (P3, rekomendacja: plugin), coding-rules wiersz po wierszu (P12), próg i N ogrodnika (P15),
    kryterium kalibracji klasyfikatora (P5). Następny krok: §8 „P0 — SIATKA BEZPIECZEŃSTWA” (nowa sesja).
42. **P0 — SIATKA BEZPIECZEŃSTWA ZROBIONA, smoke R0 zielony, merge `--ff-only` do main `8e356f2` (2026-09-30/10-01, sesja be2426eb).** Gałąź `popr/P0-siatka`,
    9 commitów (b9f2253…8e356f2), testy szablonu 210/210, typecheck i lint zielone. Push — po grupie I (P5), decyzja D-2.
    (a) **Test spójności odwołań** `.claude/workflows/__tests__/odwolania.test.mjs`: agentType (literał + enum IU_PLAN) i `subagent_type` w skillach → plik agenta albo
    `general-purpose`; każda ścieżka `.claude/<katalog>/…` w workflowach, agentach i skillach (*.md) istnieje (wzorce `*`/`<x>`/`{x}` i `learned-patterns.md` — tworzony
    w projekcie — pomijane); `workflow('<x>')` → `meta.name`; `skills:` agentów → katalog albo plugin (`figma:`). Każde sprawdzenie ma test na podłożonym złym odwołaniu
    w katalogu tymczasowym; na prawdziwym repo 4 podłożenia czerwone, po cofnięciu zielone. P1 go użyje: workflowy odwołują się dziś do SKILL.md dev-docs-execute/review.
    (b) **Skrypt kopii** `.claude/templates/smoke-autopilot/przygotuj-kopie.sh <źródło> <kopia> [--env <plik>] [--dry-run]` (test: `bash -n`, dry-run workspace / bez,
    istniejąca kopia, kolejność bramek, `--env`): klon lokalny bez remote, bez `.env`/`supabase/.temp`, gałąź `test/smoke-autopilot`, `.claude/.backups/` w exclude,
    sync z lokalnego szablonu (commit), fixture + pakiet `packages/smoke-autopilot` (`package.json`, `tsconfig.json`, `vitest.config.ts` z `passWithNoTests`) + `pnpm install`
    (commit), **bazowe bramki** `pnpm typecheck && pnpm test` (log `.git/smoke-bramki.log`, czerwone = kod 7). Atrapy oferty: `dane/smoke-oferty-atrapy.env`
    (VITE_SUPABASE_URL, _PUBLISHABLE_KEY, VITE_OFFER_ORIGIN — bez sekretów). Celowy defekt fixture: happy path `typeof wynik === 'number'` (plan: „dokładnie trzy scenariusze”).
    (c) **`skrypty/pa_hunk.py`** `H<nn>` / `--sprawdz` → `dane/pa-hunki-lata-tresc.txt`: 62/62 pojedyncze `--check` OK na HEAD 7ad9c40; ŁATA 52, TREŚĆ 8 (§1), WYPADA 2 (H59, H60);
    paczka każdego hunka z PLAN-POPRAWY; kontrola wewnętrzna zakresów z mapą nagłówka. Wynik ważny dla tamtego HEAD — paczka powtarza `--check` przed `git apply`.
    (d) **`skrypty/smoke_odczyt.py <wf_id> [--ref]`** → `dane/smoke-P0.txt`; referencja domyślna = **R0 `wf_588f7b18-d71`**.
    (e) **Smoke:** pierwszy run `wf_75b15ba0-837` STOP w domknięciu execute (7 agentów, 4 min) — pełne `pnpm test` kopii czerwone PRZED fazą: test oferty z datą ważności
    30.09.2026 (11 testów `apps/server/src/mcp/tools/opublikuj-oferte.test.ts`) i dashboard bez `.env` (`VITE_SUPABASE_URL`; 4 testy mapy uwagi czytają `VITE_OFFER_ORIGIN`
    z `.env` bez `vi.stubEnv`). Pakiet fixture nie izoluje od tego: domknięcie uruchamia całe `pnpm test` projektu → bramki bazowe i `--env` dodane do skryptu (za zgodą),
    kopia odtworzona, w kopii commit `1a2acb0` (data w fiksturze → 2099). **R0 `wf_588f7b18-d71`: OK, 1 faza, gate CZYSTE, 29 agentów, 3,92 M (−18% vs It. 1), 13 min,
    walidacja PASS, szablon zgodny, smokeStatus plik; jedyny P2 = celowy defekt (test-coverage, sceptyk utrzymał), fix → `toBe(5)`; kontekst opus 72–84k, haiku 52k;
    efort 18× medium / 2× low.** Część różnicy vs It. 1 to brak przypadkowego cyklu monorepo (3 P2 → 1 P2, sceptycy −68%).
    (f) **Obserwacje do paczek (nie blokują):** compound zapisał solution + 39. regułę learned-patterns o dacie w fiksturze — temat z commita przygotowania kopii, spoza zadania
    (compound +45% vs It. 1) → P10 (zakres compoundu = commity runu, nie gałęzi od main); walidacja końcowa: równoległe `pnpm -r test` przerwane, dashboard dokończony osobno,
    strażnik czasu `markup-scan.test.ts` 228 ms > 200 ms pod obciążeniem (test oferty) → P6 (bramki domknięcia, klasyfikacja porażek zastanych).
    (g) **Do operatora, poza szablonem:** oryginał oferty-online jest od 2026-10-01 czerwony na main (11 testów `opublikuj-oferte`), a 4 testy dashboardu zależą od `.env`.
    Obie kopie `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P0-oferty-online` (przed i po bramkach bazowych) USUNIĘTE 2026-10-01 za zgodą operatora;
    transkrypty zostają w `~/.claude/projects/` (źródło rekordów telemetrii).
    Następny krok: §8 „P1 — PORZĄDKI I USUNIĘCIA” (nowa sesja).
43. **P1 — PORZĄDKI I USUNIĘCIA ZROBIONE, smoke zielony, merge `--ff-only` do main `5a4f593` (2026-10-01, sesja 3eb1bc37).** Gałąź `popr/P1-porzadki`,
    7 commitów (bf6ed1d…5a4f593), testy szablonu 214/214 (210 − 1 test składni usuniętego workflowu + 1 sync + 4 hook), typecheck i lint zielone.
    (a) **Wklejenie trybu ręcznego** (`bf6ed1d`): planner — wycinek `## Granice` planu technicznego → blok „Czego zadanie nie obejmuje:” w prompcie IU (builder
    zwraca `blocked`, gdy jednostka wymaga takiej pracy), szablon bloku designerskiego (SPEC > DESIGN > ux-ui, Figma `get_design_context`), agentType dla IU bez
    `Delegate to:` (enum IU_PLAN nie pozwala na inline); domknięcie — brakujący test z checkboxa `Test:` dopisywany przed commitem; scribe — kategorie
    CLI/Grep/E2E/Manual/Niejasne z sygnałami, format sekcji bookkeepingu, wpis review do `## Dziennik` (pkt 2b), P3 z bookkeepingu w licznikach.
    Kontrola wzorców prompt-auditu na DODANYCH liniach (SYGNALY z `pa_inwentarz.py`): 0 trafień, w usuniętych 4.
    (b) **Usunięcie** (`0eb0ebb`): 9 skilli + `freshness-audit-wf.js`; `odwolania.test.mjs` czerwony przy usunięciu przed wklejeniem (2 martwe ścieżki SKILL.md),
    zielony po. README (przepływ, listy, scenariusze ręczne 2–4 usunięte), `learnings-researcher.md:256`, ponad plan: martwe `/dev-docs-execute` w `dev-docs`
    (handoff ręczny), `dev-brainstorm:300`, `dev-plan:865`, komentarz `dev-docs-review-wf.js`.
    (c) **Test sync-template** (`23d1e13`): usunięty skill znika z projektu razem z katalogiem, lokalny zostaje; mutacja (bez `rm`) → czerwony. W kopii smoke
    prawdziwy sync zdjął 20 plików usuniętych skilli, lokalny `excalidraw-diagram` został. (d) `.DS_Store` z indeksu (`e334193`; wpis w `.gitignore` już był).
    (e) **Łaty** (każda z pojedynczym `--check` tuż przed `apply`, wszystkie OK): H16 H17 H20 H24 (`9cf3e78`), H26 H27 + test hooka 2/4 → 4/4 (`88ef016`;
    nagłówek hooka dopasowany do kodu), H28 H54 H55 H56 (`5a4f593`).
    (f) **Smoke `wf_8936d61f-1cb`** (`dane/smoke-P1.txt`): OK, 1 faza, gate CZYSTE, 28 agentów, 3,77 M (−4% vs R0), 13 min, walidacja PASS, szablon zgodny;
    celowy defekt złapany (P2 test-coverage `typeof`), fix 4/4; efort 17× medium / 2× low, haiku 9; ctx_start bez zmian (±1%). Brak compound-refresh: compound
    nic nie zapisał (R0 zapisał regułę o dacie z commita przygotowania kopii — tym razem nie, choć commit był). Raport scribe ma nową sekcję bookkeepingu i wpis
    w Dzienniku — wklejka działa. Kopia: kod 7 jak w P0 (11 testów `opublikuj-oferte`, data 30.09.2026) → commit w kopii `54d6730` (data → 2099; test „30 dni od
    publikacji” liczy od stałego NOW i zostaje przy 24.09.2026).
    (g) **Dwa ślady z podsumowania sesji runu — nie defekty:** `kontrolaFixa: null` w raporcie fazy jest z założenia (`dev-autopilot-wf.js:1432` — pole
    wypełnia się tylko przy turze poprawkowej po kontroli diffu; tak samo w R0); „4 agenty z pustym wynikiem” to puste listy (`findings: []` ×3, `trafienia: []`),
    żaden `null` w journalu (R0: 2 puste listy reviewerów). Obserwacja do P7/P8: `null` nie odróżnia „kontrola nic nie znalazła” od „kontrola nie ruszyła”.
    (h) **Poza P1, zostawione właścicielom:** rok 2026 na sztywno w 6 skillach (`dev-docs`, `dev-plan`, `dev-compound`, `dev-docs-complete`, `dev-compound-refresh`,
    `dev-prep` — ten ostatni H38 w P2). Kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P1-oferty-online` czeka na decyzję operatora o usunięciu.
    Następny krok: §8 „P2 — INSTALACJA PER PROJEKT I DOCTOR (sesja 1/2)” (nowa sesja).
44. **P2 sesja 1/2 — DOCTOR ZROBIONY (2026-10-01, sesja 973e2246).** Gałąź `popr/P2-doctor` (NIE zmergowana — merge `--ff-only` po sesji 2), 3 commity
    (09a3f9c, 125cb49, 2fb30f1), testy szablonu 233/233 (214 + 15 doctor + 3 sync + 1 kopia), typecheck i lint zielone.
    (a) **`.claude/scripts/doctor/doctor.sh` + `ustawienia.mjs`** (188 + 96 linii): tabela `Element | Stan | Wersja / szczegół | Instalacja`, stany OK / BRAK
    (obowiązkowe — run by się zatrzymał) / UWAGA (nie blokuje) / nie dotyczy; exit 1 przy BRAK, 2 zły argument. Obowiązkowe: git, gh + `gh auth status`, node,
    menedżer z lockfile (pnpm/yarn/bun/npm); warunkowo jq (gdy `.claude/hooks/*.sh` go woła), supabase CLI (`supabase/`), agent-browser (checkbox `[E2E]` w `docs/`;
    wystarczy `node_modules/.bin`), Dynamic Workflows. UWAGA: coolify (słowo „coolify” w CLAUDE.md / .env.example / .github/workflows — run go nie woła), docker
    (Dockerfile do głębokości 3), pluginy z `enabledPlugins` projektu (bez `@inline`) vs `~/.claude/plugins/installed_plugins.json` (zakres user albo ten projekt;
    komenda `claude plugin install <id> --scope project`, z `marketplace add <repo>`, gdy marketplace z `extraKnownMarketplaces` nieznany). Telemetria (O5):
    brak zapisu `pipeline.jsonl` z ostatniej doby (`find -mmin -1440`) → `zbierz.mjs --skan`; błąd skanu = UWAGA. Testy: 15 na katalogach-fixture z podmienionym
    PATH (atrapy + dowiązania do narzędzi systemowych) i HOME; każdy podłożony brak czerwony → przywrócenie zielone.
    (b) **Odstępstwa od planu (do wiadomości):** jq NIE jest obowiązkowy — żaden hook szablonu go nie woła (plan zakładał „jq (hooki)”); doctor czyta JSON
    node'em, więc sam jq nie potrzebuje. Dynamic Workflows: klucze `enableWorkflows` (brak = włączone) / `disableWorkflows` w settings user → projekt → local
    i zmienna `CLAUDE_CODE_DISABLE_WORKFLOWS` (ustalone z binarki Claude Code 2.1.286 — docs ich nie podają). Pluginy jako UWAGA, nie BRAK: run nie staje
    bez pluginu, a projekt bez UI nie potrzebuje figmy (do rozważenia w sesji 2 razem z profilem).
    (c) **Wołanie:** sync-template przy pierwszej instalacji (brak `.template-version`, także gdy `.claude/` skopiowano ręcznie i treść jest identyczna) →
    `--- DOCTOR` + tabela + `DOCTOR_KOD: <n>`, kod syncu bez zmian; każdy sync, który zmienił `.claude/`, kończy się linią `NOWA SESJA: …` (N2). dev-prep krok 1.3:
    BRAK → pozycja `[blokuje: faza 1]` (bramka gotowości dev-docs zatrzyma handoff), UWAGA → bez markera. Łata H38 (`date +%F`): pojedyncze `--check` OK → apply.
    Kontrola wzorców prompt-auditu na dodanych liniach .md: 0 trafień. `przygotuj-kopie.sh`: doctor kopii po commicie fixture, przed bramkami; brak = kod 8.
    (d) **Przejście na kopii** `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P2-oferty-online` (bez runu): doctor OK (supabase, agent-browser, coolify,
    docker wyliczone z projektu; 1 UWAGA: plugin dev-browser niezainstalowany — także w szablonie); podłożony PATH bez `/opt/homebrew/bin` → BRAK gh, supabase,
    exit 1; przywrócenie → exit 0. Bramki bazowe kopii: znany kod 7 (11 testów `opublikuj-oferte`, data — 6a pkt 42 g), kopia nienaprawiana (smoke w P2 = nie).
    (e) Kopie `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P1-oferty-online` i `…/_smoke-P2-oferty-online` USUNIĘTE 2026-10-01 za zgodą operatora.
    Następny krok: §8 „P2 — INSTALACJA PER PROJEKT I DOCTOR (sesja 2/2)” (nowa sesja).

45. **P2 sesja 2/2 — PAKIET ZAMKNIĘTY (2026-10-01, sesja e8cdef04).** 4 commity na `popr/P2-doctor` (1d81220, 4ec3d5c, 70f9a92, 5d28922), merge `--ff-only`
    do main `5d28922` (smoke P2 = nie, doctor przeszedł na kopii w sesji 1). Testy szablonu 235/235, typecheck i lint zielone, `actionlint` OK.
    (a) **Profil `.claude/settings.json`** wg KROK0-DECYZJE pkt 8: `extraKnownMarketplaces` dev-browser, `enabledPlugins` dev-browser + figma, `disableClaudeAiConnectors`;
    hooki i statusLine bez zmian. Marketplace `claude-plugins-official` dochodzi sam, gdy włączony jest plugin z niego (binarka 2.1.286, funkcja budująca listę
    znanych marketplace'ów) — figma nie potrzebuje wpisu. Test: doctor na prawdziwym profilu szablonu pokazuje oba pluginy z komendą per projekt.
    (b) **Decyzja operatora: pluginy w doctor zostają UWAGA** (rekomendacja przyjęta; dev-browser nie jest wołany przez żaden skill, agenta ani workflow — E2E idzie
    przez CLI agent-browser; figma tylko przy makietach). Doctor: `false` w `.claude/settings.local.json` = „nie dotyczy” (lokalny plik wygrywa jak w Claude Code) —
    na szablonie dev-browser jest wyłączony lokalnie przez operatora.
    (c) **Korekta sesji 1 (zmiana kontraktu testu, nazwana w commicie 4ec3d5c):** agent-browser tylko w `node_modules/.bin` = BRAK, nie OK. Skill `agent-browser`
    (`command -v agent-browser`) i `feature-tester-e2e` wołają gołe `agent-browser` z PATH — lokalna devDependency dawała fałszywe OK. README: agent-browser
    jedynym wyjątkiem od „per projekt” (instalacja globalna). Wariant per projekt (`pnpm exec agent-browser` w skillu i testerze) → kandydat do P14.
    (d) **README:** „Jak zacząć - 4 kroki” → „Instalacja (wszystko per projekt)” (7 kroków: `.claude/`, pluginy `--scope project` z komendami awaryjnymi,
    narzędzia, Dynamic Workflows, doctor jako sprawdzian, nowa sesja) + „Konektory i pluginy z konta claude.ai” (`disableClaudeAiConnectors` tylko w terminalowym
    `claude`; aplikacja desktop: menu konektorów sesji Code; pluginy `"<nazwa>@inline": false` w `~/.claude/settings.json` — decyzja kursanta) + „Wymagania”
    (tabela doctora). Dynamic Workflows: binarka ma `enableWorkflows` z flagą `restrictive: false` — projekt może je tylko wyłączyć, nie włączyć (README poprawione).
    (e) **Bramka CI `.github/workflows/maszyneria.yml`:** push do `main` i `popr/**` + `pull_request`; `pnpm install --frozen-lockfile` → `pnpm typecheck && pnpm test
    && pnpm lint`; akcje przypięte (checkout v7.0.1, pnpm/action-setup v6.1.0, setup-node v7.0.0), `contents: read`. **Bez `claude plugin validate --strict`
    i `claude plugin eval` — powód:** validate na repo bez `.claude-plugin/` zwraca „Validation passed” z pustą listą `contents` (na `.`, `.claude`, `.claude/skills`,
    `.claude/agents` — nic nie sprawdza); przez tymczasowy manifest pluginu sprawdza tylko frontmatter skilli (brak `description`), nieznanych pól agenta nie łapie
    (podłożone `nieznane_pole` przeszło `--strict`) — wartość za mała na drugi krok CI. `eval` wymaga zestawu `evals/` (repo nie ma) i klucza API z kosztem runów.
    CI nie był jeszcze uruchomiony na GitHubie (push = decyzja operatora); lokalnie testy zielone z pustym HOME (jak na runnerze), Linuksa nie było jak sprawdzić (brak dockera).
    (f) **Test na czystym koncie — ZROBIONY 2026-10-01 (operator; klon `~/Documents/Kodowanie/_test-P2-czyste-konto`, `CLAUDE_CONFIG_DIR=~/claude-czyste-konto-P2`,
    terminalowe `claude` 2.1.286).** Wynik: przy starcie Claude Code SAM dodał oba marketplace'y (`known_marketplaces.json`: claude-plugins-official,
    dev-browser-marketplace; dev-browser pobrany do `plugins/cache`), ale pluginów z `enabledPlugins` NIE zainstalował i NIE zaproponował —
    `installed_plugins.json` pusty, `claude -p` w tej sesji nie widzi skilla dev-browser ani pluginu figma (widzi tylko lokalny `figma-design-to-code`).
    Komendy z README działają (oba `scope: project`; `marketplace add` zbędny — „already on disk”). **Defekt znaleziony i naprawiony (commit 0730d04,
    merge do main):** `install --scope project` przepisywał `.claude/settings.json` (`enabledPlugins` i `extraKnownMarketplaces` na koniec) = brudne
    drzewo po instalacji = STOP bootstrapu autopilota; profil ma teraz tę kolejność, reinstalacja na klonie = zero diffu, test pilnuje kolejności.
    README krok 3: „marketplace'y dodają się same, pluginy nie — wymagane komendy”. Ubocznie: czyste konto w terminalu ładuje plugin claude.ai
    `cowork-plugin-management@synced` („Synced from claude.ai”) — w terminalu sufiks `@synced`, w aplikacji `@inline`; README opisuje tylko
    zweryfikowany wyłącznik aplikacji (`@inline: false`) — wyłącznik terminalowy do sprawdzenia (P16 przegląd README albo przy okazji).
    Doctor czyta pluginy z `$HOME/.claude`, nie z `CLAUDE_CONFIG_DIR`. Katalogi testowe USUNIĘTE 2026-10-01 za zgodą operatora.
    Otwarte u operatora: push szablonu do GitHuba; token Airtable.
    Następny krok: §8 „P3 — KONTEKST I EFORT AGENTÓW (sesja 1/2)”.
46. **P3 sesja 1/2 — PLIKI AGENTÓW (2026-10-01, sesja 0f24ab3a).** Gałąź `popr/P3-agenci` NIEZMERGOWANA (merge po smoke'u w sesji 2): 5 commitów
    (d34055f, ccf2bce, 04c8553, 6a8362d, 57697d8). Testy szablonu 244/244, typecheck i lint zielone. Workflowy bez zmian — żaden `agent()` jeszcze nie woła klas.
    (a) **Pięć plików klas zamiast czterech:** `klasa-mechaniczny` (haiku, `omitClaudeMd`, Read/Grep/Glob/Bash/Edit/Write — stan, precheck, env-down,
    pre-skan, commit artefaktów, zwijanie), `klasa-mechaniczny-odczyt` (haiku, `omitClaudeMd`, Read/Grep/Glob — dedup, inspekcja; N1: haiku wykonuje
    przekazaną wiadomość operatora, więc rola bez zapisu nie dostaje Bash), `klasa-orkiestracyjny` (Read/Grep/Glob/Bash/Edit/Write), `klasa-sceptyk`
    (Read/Grep/Glob/Bash — verify-fix czyta `git show`; bez Edit/Write), `klasa-naprawiacz` (+ Edit/Write + Skill). Model `inherit` poza mechanicznymi
    (zachowanie ról bez zmian; „-opus” w nazwie planu = stan sesji, nie pin). Mandat 1–2 zdania, opis „wołana przez workflowy dev-* przez agentType;
    z sesji nie używaj” (opisy trafiają do listy agentów sesji głównej).
    (b) **Role:** reviewerzy (security, performance, architecture, spec-compliance + nowe `correctness-reviewer.md`, `test-coverage-reviewer.md` — frontmatter
    + mandat, treść osi zostaje w workflowie do P11) i tester E2E: Read/Grep/Glob/Bash; buildery: + Edit/Write; opisy builderów „wywoływany przez
    dev-docs-execute-wf” (PW26). Badacze (6): Read/Grep/Glob/Bash/WebSearch/WebFetch; łaty H07, H14, H18, H25 (rok z `date +%F`), PA-35 (wzmacniacze),
    Context7 → WebFetch oficjalnej dokumentacji (Context7 nie ma w szablonie, MCP poza allowlistą). `kieran-typescript-reviewer` i `code-simplicity-reviewer`
    bez `tools:` (poza pipeline'em, usuwane w P11 — wyjątek nazwany w teście).
    (c) **Figma:** warianty `feature-builder-ui-figma.md` i `feature-builder-fullstack-figma.md` (treść = plik bazowy, test pilnuje); bazowe bez skilli Figmy
    i bez MCP. Wariant: skille + `figma:figma-use`, `figma:figma-design-to-code`; tools: + `mcp__plugin_figma_figma__` get_design_context, get_screenshot,
    get_metadata, get_variable_defs, download_assets, get_motion_context (dwa ostatnie po kontroli subagenta — get_design_context może
    do nich odesłać), use_figma. **Tester E2E bez wariantu** — porównuje zrzut z PNG makiety z dysku, Figma MCP nie woła (plan zakładał
    inaczej). H09 łatą; H08, H10–H12 jako treść: nazwa `mcp__plugin_figma_figma__get_design_context` zostaje (od P2 plugin per projekt + `disableClaudeAiConnectors`
    = nazwa stała), spójność treści wariantu z `tools:` pilnuje test; H11 „roadmap” → „zasady odczytu daje skill `figma:figma-design-to-code`”.
    (d) **Decyzje operatora 2026-10-01:** PA-25 — skill z pluginu (rekomendacja przyjęta): `.claude/skills/figma-design-to-code/` usunięty, README wiersz
    skilla i tabela skilli w `dev-plan/SKILL.md:472,474` poprawione (fakt; P13 i tak przepisuje). `figma:figma-use` (34 KB ≈ 9k tokenów, zapis DO Figmy)
    — operator: ZOSTAJE w wariancie z Figmą (rekomendacja „usunąć z obu” odrzucona); `use_figma` w `tools:` wariantu dla spójności ze skillem.
    (e) **Test `klasy-rol.test.mjs` (8 testów, każdy z podłożonym złym plikiem):** mechaniczni haiku + `omitClaudeMd`, nikt inny bez CLAUDE.md; badacze jedna
    allowlista bez Edit/Write; każdy agent pipeline'u ma `tools:` ze znanych narzędzi (wbudowane + 40 narzędzi serwera Figma MCP pluginu 2.2.120; `ideToolTitles` w `.mcp.json` ma tylko 18 —
    literówka = brak narzędzia bez błędu); MCP tylko w `-figma`, treść wariantu = bazowy, nazwy MCP z treści w `tools:`. Sesja 2 dokłada: `agentType`
    każdego `agent()` z istniejącym plikiem, tiery = tabela D6, meta dzieci z flagą D9.
    (f) **Prompt-audit (`dane/pa-po-P3.txt`, `dane/pa-sygnaly-po-P3.{txt,json}`):** dodane linie `.md` — 0 nowych trafień w nowej treści (trafienia tylko w kopiach
    treści wariantów `-figma` i w linii `model: haiku`); `pa_kontrola.py` — 10 cytatów zniknęło = PA-03/04/09/18/20 (P1) + PA-19 (P3), żaden z otwartych;
    `pa_inwentarz.py` 653 → 584 trafień. Skrypty uruchomione na kopii (piszą do `dane/`); `pa_inwentarz.py` na repo wywraca się na `.claude/hooks/__tests__`
    (katalog) — poprawka (pomija podkatalogi) najpierw na kopii, potem w repo za zgodą operatora.
    (g) **Ustalenia dla sesji 2:** frontmatter agenta obsługuje `effort:` (binarka 2.1.286, lista pól: name, description, prompt, tools, disallowedTools, model,
    effort, permissionMode, mcpServers, hooks, maxTurns, skills, initialPrompt, memory, background, omitClaudeMd, isolation) — efort klasy może iść do pliku
    zamiast TIERY; claude-code-guide (docs sub-agents): `Skill` w `tools:` = ładowanie dowolnego skilla na żądanie, bez niego agent nie ma narzędzia Skill; `skills:` tylko preładowuje treść; pierwszeństwo `effort:` pliku vs opcji `effort` w `agent()` NIEUDOKUMENTOWANE → sprawdzić w smoke'u (efort z transkryptu). **Mapa rola → klasa (subagent, 43 wywołania `agent(`, wszystkie mieszczą się w klasach poza trzema problemami):**
    klasa-mechaniczny = stop:commit-artefaktow, stan:zapis, e2e:precheck, fix:pre-skan, zwin-do-poprawy, e2e:env-down; klasa-mechaniczny-odczyt = dedup:semantyczny,
    scribe:inspekcja; klasa-sceptyk = verify, verify-batch, verify-fix, fix:kontrola; klasa-naprawiacz = fix, fix:poprawka, pr:napraw; pliki ról = review:*
    (correctness z general-purpose → correctness-reviewer, test-coverage → test-coverage-reviewer), review:e2e (+retry) → feature-tester-e2e, build:<IU>;
    klasa-orkiestracyjny = reszta (bootstrap, env-up, warmup, db-sync, walidacja, compound-refresh, planner, domknięcie, kontekst:diff, scribe, compound,
    smoke-operatora, complete, pr:start/zbierz/merge-stan/merge/compound). Problemy dla sesji 2: (1) builder: enum `agentType` w IU_PLAN
    (`dev-docs-execute-wf.js:57`) bez wariantów `-figma`, a planner (`:162`) każe wołać Figma MCP — planner/orkiestrator wybiera `-figma`, gdy zadanie ma
    `figma_screens`/`figma_spec`; treść plików bazowych zostaje (identyczna z wariantem, test), bo bez makiet reguła się nie uruchamia;
    (2) `stan:zapis:retry` (`dev-autopilot-wf.js:1116`) → klasa-orkiestracyjny, NIE mechaniczny (retry celowo na modelu głównym, komentarz `:1113`);
    (3) compound-refresh (`:1597`) wykonuje skill, który każe uruchamiać subagentów (`dev-compound-refresh/SKILL.md:326–330`) — klasa orkiestracyjna nie ma
    narzędzia Agent: decyzja w sesji 2 (zdanie w prompcie „w pipelinie piszesz zastępstwo sam” vs Agent w klasie). Badacze: nic spoza allowlisty.
    Poprawione od razu (57697d8): `download_assets`/`get_motion_context` w wariantach; Context7 w README:323 i `dev-plan/SKILL.md:167`.
    Następny krok: §8 „P3 — KONTEKST I EFORT AGENTÓW (sesja 2/2)”.
47. **P3 sesja 2/2 — WORKFLOWY I SMOKE (2026-10-01/02, sesja 86d8fb12). P3 ZROBIONA, merge `--ff-only` do main `3933432`.** Commity sesji: b7ee084, 1326613,
    1999105, 3933432 (plus 5 z sesji 1). Testy szablonu 250/250, typecheck i lint zielone.
    (a) **agentType (b7ee084):** 38 z 43 wywołań `agent()` dostało `agentType` wg mapy 6a pkt 46 (g) (5 miało już: buildery, reviewerzy, tester E2E);
    `model: 'haiku'` zniknął z opcji (model z pliku klasy); `stan:zapis:retry` → klasa-orkiestracyjny; correctness `general-purpose` → `correctness-reviewer`,
    test-coverage → `test-coverage-reviewer`. IU_PLAN: warianty `-figma` w enum, planner bierze je, gdy kontekst designerski ma niepuste `figma_spec`
    albo `figma_screens`. **Decyzje operatora 2026-10-01:** compound-refresh — zdanie w `refreshPrompt` „subagentów nie uruchamiasz, 1–2 dokumenty piszesz
    sam” (klasa bez narzędzia Agent; rekomendacja przyjęta); efort jawnie w `agent()`, nie `effort:` we frontmatterze (rekomendacja przyjęta: trzy klasy
    potrzebują różnych efortów per rola, pierwszeństwo pliku nad opcją nieudokumentowane — przez to smoke go nie sprawdzał, bo pliki efortu nie mają).
    (b) **Efort D6 (1326613):** review-wf `TIERY_DOMYSLNE = { packager low, sceptykP2 medium, sceptykP1 high, reviewer high, scribe low }` (test-coverage :904,
    tester E2E i scribe przez `zEffortem`); pozostałe workflowy `effort:` w opcjach — orkiestracyjny medium, naprawiacz i buildery high, verify-fix high,
    kontrola diffu fixa low (bez zmian; D6 jej nie wymienia), haiku bez efortu (pre-skan stracił `low`). `zEffortemAP` usunięty (martwy). Zmiana kontraktu
    `sceptycy-p2.test.mjs` nazwana w commicie.
    (c) **Testy:** `klasy-rol.test.mjs` przekroczyłby 300 linii → testy wywołań w nowym `wywolania-agentow.test.mjs` (każde `agent()` ma `agentType` z plikiem,
    zgodność z mapą klas, bez `model:`, warianty `-figma` w enum, efort = tabela D6), wspólny odczyt w `__tests__/agenci-pipeline.mjs` (parser czyta opcje
    z jednej linii `{ schema: X, …, label: … }` i liczy, czy liczba `agent(` = liczba linii opcji — inny kształt opcji = błąd testu, nie cichy brak).
    (d) **D9 — warunek wstępny NIE przeszedł; ścieżka odwrotu (decyzja operatora 2026-10-02, 1999105).** Binarka 2.1.287: loader workflowów projektu
    (`.claude/workflows/`) bierze z `meta` tylko `name`, `description`, `title`, `whenToUse`, `phases` — `disableModelInvocation` jest cicho pomijane
    (flagę mają tylko workflowy wbudowane); docs workflowów (claude-code-guide) pola nie znają. Do listy skilli trafia `description` + `whenToUse`
    (`phases` dopiero po wywołaniu). Zrobione: opisy 4 dzieci po jednym zdaniu (było 230–1001 zn, jest ≤ 160; `lista-skilli.test.mjs`), `description`
    autopilota skrócony do routingu, tryby wznowienia zostają w `whenToUse`. **Odpada:** flaga w meta, ostrzeżenie doctora (§4 PLAN-POPRAWY poprawiony),
    punkt smoke'a „dzieci mimo flagi” — dzieci ruszyły normalnie. Zysk mały: dzieci miały ~1,8k zn (po P1), nie ~12k z czasu panelu.
    (e) **N1/N2 (3933432):** `whenToUse` autopilota — zdanie o nowej sesji po zmianach `.claude/` i „do agentów workflow: ta wiadomość nie jest dla was”;
    ta sama linia N1 w handoffie `dev-docs/SKILL.md` przy komendzie `Workflow`. Prompt-audit dodanych linii (`git diff -U0 e5de7c7..HEAD`, wzorce z
    `pa_inwentarz.py`): 4 trafienia, wszystkie w treści sprzed sesji na liniach, którym doszło `agentType` albo dopisek — w nowej treści 0.
    (f) **Smoke `wf_2894ee9c-566` (`dane/smoke-P3.txt`), sesja kopii na efort medium:** status OK, 1/1 faza, walidacja PASS; **2,82 M (−28% vs R0 3,92 M)**,
    28 agentów, 17 min (+31% — reviewerzy na high). Efort z transkryptu = tabela co do sztuki: opus/high 7 (5 reviewerów, build, fix), low 3 (packager,
    scribe, kontrola fixa), medium 9 (8 orkiestracyjnych + verify-batch), haiku 9 bez efortu — sesja medium nie nadpisała opcji. `ctx_start`: haiku
    52k → 8k (cel 9–10k osiągnięty), opus 72–84k → 49–60k (−21…−33%). **Reszta do celu 25–38k to `instructions`:** CLAUDE.md kopii 22,1k zn, coding-rules
    10,5k, **learned-patterns 48,0k zn (~24k tok)** — wyjęcie learned-patterns z eager = P10 (cele It. 3a je zakładały). Odmów „brak narzędzia” 0
    (błędy narzędzi to zwykłe potknięcia: zapis bez odczytu u haiku `stan:zapis`, regex ugrep w pre-skanie, pathspec z wiodącą spacją w complete, zablokowane
    `sleep`); naprawiacz Skill nie wołał. Review: gate ZASTRZEZENIA (R0 CZYSTE) — znalezione 15 vs 5, potwierdzone P2 4 vs 1 przy reviewerach na high;
    2 P2 w fixture (testy błędnego wejścia tylko na `a`) zostały w known-issues kopii jako „poza 3 scenariuszami planu” — materiał dla P8/P11, nie defekt
    paczki. Compound nic nie zapisał (`plik: null`, faza trywialna) → **compound-refresh się nie uruchomił; zdanie o subagentach niesprawdzone w runie.**
    „Pusty wynik jednego z 28 agentów” z podsumowania sesji runu: w journalu 28/28 wyników niepustych — to compound z `plik: null`.
    (g) **Kopia:** `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P3-oferty-online` (kod 7 jak w P1 → commit w kopii `2f8acff`, data wygaśnięcia
    fikstury `opublikuj-oferte` → 2099). USUNIĘTA 2026-10-02 za zgodą operatora.
    Następny krok: §8 „P4 — START I KONIEC RUNU”.
48. **P4 — START I KONIEC RUNU (2026-10-02, jedna sesja). P4 ZROBIONA, merge `--ff-only` do main `8f5ff82`.** Commity: 5317d6f (archiwizacja),
    3e8444a (bramka wejścia), 8f5ff82 (telemetria). Testy szablonu 271/271 (+21), typecheck i lint zielone. Podział: jedna sesja (potwierdzony na starcie).
    (a) **Archiwizacja (5317d6f):** H33, H34, H49 łatami (`pa_hunk.py` → `git apply --check` OK), H48 jako treść; krok 6 nie edytuje CLAUDE.md
    ani `.claude/rules/`; nowy krok 6a — `docs/decisions/<data>-<zadanie>.md` z frontmatterem `zadanie / data / claude_md: do-uzgodnienia`, sekcje
    „Decyzje” i „Do CLAUDE.md po merge'u” (wejście dla kroku P5), linia indeksu w `docs/decisions/README.md` (plik tworzony z nagłówkiem, gdy go nie ma);
    plik powstaje zawsze, także bez decyzji. Pathspec z funkcji `pathspecArchiwum` (z `docs/decisions`, bez CLAUDE.md, `':(exclude,glob)**/*.bak'`);
    `*.bak` nie jest przenoszony — zostaje w `docs/active/<zadanie>/` i trafia do `rezultaty`. Komunikat `docs(<zadanie>): archiwum` z JS + sprawdzenie
    `git log -1 --format=%s`. Bramka PR: agent zwraca `plikiPr[]` (`git diff --name-only <merge-base z main> HEAD`), JS `bramkaRozmiaruPr` (> 150 →
    UWAGA z podziałem po dwóch pierwszych segmentach ścieżki); przy UWADZE agent `complete:uwaga-pr:*` (haiku) dopisuje sekcję do podsumowania.
    `sprawdzDecyzje` → UWAGA, gdy pliku nie ma albo pole ≠ `do-uzgodnienia`. Wynik complete-wf: `uwagi[]`, autopilot: `uwagiArchiwum`. Pole
    `aktualizacje` usunięte ze schematu (było „co dopisano do CLAUDE.md”). Skill: krok 6a, `*.bak` poza archiwum, bez „Zapytaj…” i „🎉” (PA-38).
    (b) **Bramka wejścia (3e8444a), funkcje czyste w bloku „Bramka wejscia (P4)”:** bootstrap zbiera `wejscie {zmiany (git status --porcelain
    --untracked-files=all), doctorKod, doctorWynik, kodJakPrzyTescie}`; `branch.czysty` usunięty (decyzja w JS). `decyzjaWejscia`: brudne poza
    katalogiem zadania → STOP „niezacommitowane zmiany poza katalogiem zadania: …” z komendą; doctor kod 1 → STOP „start: doctor — …”; doctor bez
    wyniku → uwaga; brudny wyłącznie katalog zadania → commit `start:commit-zadania` (haiku) i dalej. **Zielony start — interpretacja „testy na bazie
    gałęzi”:** testy (typecheck + test) na HEAD startu, nie na merge-base w worktree — drzewo jest czyste po bramce, a gałąź może już nieść poprawkę
    czerwonego testu z main (kopia smoke'a: main czerwony, gałąź z poprawką zielona — test merge-base dałby fałszywy STOP). Cache: `bazaZielona {sha,
    wynik: PASS}` w `.autopilot-state.json` (zapis od razu po PASS); trafienie, gdy od `sha` zmiany tylko w `docs/` (`git diff --quiet <sha> HEAD --
    . ':(exclude)docs'` w bootstrapie). Faza z `execute=done` → bez testów startu (kod faz testuje domknięcie). FAIL nie trafia do cache; agent null
    lub `BRAK-TESTOW` → uwaga, run idzie dalej. `fazyUkonczone` = fazy domknięte w zadaniu (OK i STOP), nowe `fazyWRunie`. Commit katalogu zadania
    wspólny dla STOP i startu (`zacommitujKatalogZadania`), stopka commita tylko drugim `-m`.
    (c) **Telemetria (8f5ff82):** `rekordRunu.fazyUkonczone` bierze wartość z wyniku, gdy jest liczbą (stare wyniki OK miały = liczba raportów → stare
    rekordy bez zmian, `WERSJA_REKORDU` bez podbicia); kategoria STOP `start` (`^start: `) dla bramki wejścia — próg „STOP-y środowiska w środku runu = 0”.
    Mapa klas w `wywolania-agentow.test.mjs`: + `start:commit-zadania`, `complete:uwaga-pr:*` → klasa-mechaniczny (nowe role, nazwane w commicie).
    (d) **Prompt-audit dodanych linii:** 2 trafienia w nowej treści (`WYLACZNIE`, `⚠️`) poprawione → 0.
    (e) **Smoke w dwóch runach (decyzja operatora: najpierw czerwona baza).** Run 1 `wf_ec07d4a4-d06` na kopii z wygasłą fiksturą: STOP „start: testy
    na starcie galezi czerwone (95a71cc): …opublikuj-oferte.test.ts…” z komendą odtworzenia i świeżego runu; 60 s, 3 agentów, 116k tok., fazy 0, czerwony
    wynik poza cache. Run 2 `wf_f330324d-8a5` po poprawce w kopii (`027aa17`): OK, 1/1 faza, walidacja PASS, **2,84 M (−27% vs R0, +1% vs P3)**, 30 agentów
    (+`start:testy` 0,10 M), 17 min; `bazaZielona {027aa17, PASS}` w stanie; `docs/decisions/2026-10-02-smoke-autopilot.md` z `claude_md: do-uzgodnienia`
    + indeks; CLAUDE.md i `.claude/rules/` nietknięte (diff 0); commit `90ce44a` z tematem `docs(smoke-autopilot): archiwum` i stopką po pustej linii;
    `uwagiArchiwum: []`. Odczyt: `dane/smoke-P4.txt` (vs R0), `dane/smoke-P4-vs-P3.txt`.
    (f) **Kopia:** `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P4-oferty-online` (kod 7 → poprawka fikstury w kopii `027aa17`: `EXPIRES_AT`
    i dwa zdania maila → 2099, linia 202 zostaje `24.09.2026` — test „30 dni od publikacji” liczy od NOW). ZOSTAJE do smoke'a P5 (decyzja operatora 2026-10-02); usunięcie po P5 tylko za zgodą.
    Następny krok: §8 „P5 — DEV-PR I BOT”.
49. **P5 SESJA 1/2 — DEV-PR I WARUNEK CLAUDE.md (2026-10-02/03). Merge `--ff-only` do main `dd3ed11`.** Commity: 274c720 (dev-pr), e415892 (bootstrap),
    dd3ed11 (prompt-audit). Testy szablonu 295/295 (+24), typecheck i lint zielone. **Decyzje operatora na starcie:** podział jak w propozycji (sesja 2 =
    generator + kalibracja); STOP przy KAŻDYM pliku decyzji na main z `do-uzgodnienia`, nie tylko ostatnim (inaczej pominięte uzgodnienie zostaje na
    zawsze); bramka CLAUDE.md = sam przyrost ≤ 2000 zn na zadanie, bez sufitu bezwzględnego; commit uzgodnienia z pushem, odrzucony push = uwaga.
    (a) **dev-pr (274c720), funkcje czyste w bloku „Decyzje dev-pr (P5)” w `dev-pr-wf.js`:** `odrzucenieUzasadnione` — nazwa dokumentu (CLAUDE.md,
    `docs/plans/`, `docs/CONCEPTS.md`, `docs/decisions/` — dopisane, bo od P4 tam idą decyzje zadań) + ≥ 20 zn poza nią, sam backtick nie wystarcza;
    `tokenTury`/`watkiTury` — `zbierz` stempluje wątki `tura-N@<sha12>`, `napraw` bez tokenu swojej tury = STOP, wątki innej tury pominięte;
    `SUFIT_TUR = 3` (tura napraw > 3 = STOP); `warunkiMerge` + `rekomendacja` (do-operatora → DECYZJA OPERATORA; wątki napraw przy turach < 3 →
    KOLEJNA TURA, po sufit → DECYZJA OPERATORA; CI / mergeable / CLEAN → NIE MERGUJ — warunek z wartością; reszta → MERGUJ; merge tylko przy MERGUJ);
    `tabelaTury` (złączenie po id z `watki[]`, decyzja naprawiony / odrzucony / nieruszony / do operatora / pominięty); `PRZYROST_CLAUDE_MD = 2000`
    + `bramkaClaudeMd`; `komendaUzgodnienia` (`node -e`, kod 3 = brak pola; ścieżka walidowana regexem przed powłoką; test uruchamia komendę na pliku).
    `zbierz` czyta też stan PR i CI (`BLOK_STANU_PR` wspólny z merge) → `rekomendacja` w wyniku każdej tury + zdanie o ostatnim komentarzu bota;
    merge bierze `turyWykonane`; compound dopisuje propozycje do `docs/reviews/propozycje-do-reviewerow.md` (`plikPropozycji`, brak przy niepustej
    liście = UWAGA w logu). **Nowy etap `claude-md`** (skill: `/dev-pr --claude-md <zadanie>`): potwierdzenie merge'u = plik decyzji zadania na gałęzi
    głównej po pull (nie stan PR z gh — działa po merge'u ręcznym i w kopii bez remote); agent orkiestracyjny wprowadza fakty z „Do CLAUDE.md po
    merge'u” bez commita (`znPrzed` z HEAD, drzewo może być brudne tylko w CLAUDE.md — ponowienie po przycięciu); JS bramka; agent mechaniczny
    `pr:claude-md-commit:*` (nowa rola w mapie klas `wywolania-agentow.test.mjs` — zmiana kontraktu nazwana w commicie) zmienia pole komendą z JS,
    commit `docs(<zadanie>): CLAUDE.md uzgodniony po merge'u`, push. Skill: tryb `--claude-md`, sufit 3 (`/dev-pr 5` = 3), token, rekomendacja
    pierwszym wierszem, tabela per tura, GOTOWY-DO-MERGE → „tak” = merge z `auto: true`. Telemetria: `run.pr.rekomendacja` z wyniku zbierz
    (placeholder zastąpiony, `WERSJA_REKORDU` bez podbicia).
    (b) **Bootstrap (e415892):** `wejscie.decyzje {glowna main|master|null, katalog, linie}` — linie z `git grep -e '^claude_md:' <glowna> --
    'docs/decisions/*.md'` 1:1; `decyzjaClaudeMd` w bloku P4 (osobna funkcja — testy `decyzjaWejscia` bez zmian): każdy plik z `do-uzgodnienia` =
    STOP `start: CLAUDE.md nieuzgodniony po merge'u — <pliki>` z komendą (switch, `/dev-pr --claude-md <zadanie>` per plik, świeży run); brak
    katalogu albo gałęzi głównej = uwaga. Kolejność: czystość i doctor → warunek CLAUDE.md → commit katalogu zadania → testy startu.
    (c) **Prompt-audit dodanych linii:** 2 trafienia (`TYLKO`, `ZAKAZ` na przeniesionej linii compoundu) poprawione → 0. Skrypt na stałe:
    `skrypty/pa_dodane.py <ref> <pliki>`.
    (d) **Smoke w kopii `_smoke-P4-oferty-online`:** main kopii ← ff-merge `test/smoke-autopilot` (plik decyzji P4 z `do-uzgodnienia` = „zmergowany
    PR”) + sync P5 (`f18d9a3`); gałąź `test/smoke-p5` z `027aa17` (świeży fixture z poprawioną datą) + `.claude` z main (`dfff8e4`). Run 1
    `wf_1c847902-82a`: STOP przed fazą 1, powód i komenda zgodne z testem (0,11 M, 2 agentów). `/dev-pr --claude-md smoke-autopilot`
    `wf_477d96d9-bd5`: OK, fakty [] (sekcja „brak”), 22 110 → 22 110 zn, commit `5843760` na main kopii, push false „brak remote” (0,10 M,
    2 agentów) — etap `claude-md` sprawdzony od początku do końca. Run 2 `wf_b96dcd26-cea`: OK, 1/1 faza, walidacja PASS, **2,85 M (+0% vs P4)**,
    30 agentów, 17 min, gate CZYSTE (review 16 → 10 po dedupie, P2 3, fix 10, regresje 0). Odczyt: `dane/smoke-P5-vs-P4.txt`, `dane/smoke-P5.txt`,
    `dane/smoke-P5-stop.txt`, `dane/smoke-P5-dev-pr-claude-md.txt`. Uwaga z sesji kopii: agent sesji sprawdził `git grep 'claude_md: do-uzgodnienia'`
    bez kotwicy i trafił zdanie z README indeksu — bramka używa `^claude_md:`, README jej nie łapie.
    (e) **Kopia:** `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P4-oferty-online` — sesja 2 jej nie potrzebuje (kalibracja czyta GitHub
    oryginału); USUNIĘTA 2026-10-03 za zgodą operatora.
    Następny krok: §8 „P5 — DEV-PR I BOT, SESJA 2/2”.
50. **P5 SESJA 2/2 — GENERATOR BOTA I KALIBRACJA (2026-10-03). PAKIET ZAMKNIĘTY. Merge `--ff-only` do main `ed613b8`.** Commity: 2e8c29e (generator),
    ed613b8 (kalibracja → waga). Testy szablonu 306/306 (+11), typecheck i lint zielone, prompt-audit dodanych linii 0. Smoke autopilota: nie (generator
    nie rusza workflowów; zmiana `zbierz` pokryta testami dev-pr i drugim runem kalibracji). **Decyzje operatora:** devDependencies `yaml` 2.9.1 + `ajv` 8.20.0
    (wersje dokładne) zamiast własnego walidatora; kalibracja PR 2, 4, 16 wg propozycji.
    (a) **Walidacja:** repo nie miało parsera YAML w Node (skill: `ruby -ryaml`, sama składnia; `ajv@6` tylko pośrednio przez eslint, bez draftu 2020-12).
    Schemat `https://coderabbit.ai/integrations/schema.v2.json` (draft 2020-12, bez `$ref`) skopiowany do `coderabbit-setup/__tests__/fixtures/` —
    test offline; odświeżenie = świadoma zmiana. Ze schematu: `tone_instructions` ≤ 250 zn., nieznane klucze zabronione tylko w korzeniu (literówka
    w `reviews.*` przechodzi). `ajv.addKeyword('enumNames')` — adnotacja edytora w schemacie. Test `generator.test.mjs` (8): baza + każdy z 5 stacków
    zgodne ze schematem (bloki ```yaml ze `stack-blocks.md` parsowane i doklejane jak w skillu), schemat łapie za długi tone i literówkę w korzeniu,
    próg 360/60 bez 300/50 w żadnej instrukcji, wyjątki w bloku głównym, ścieżka reguł kodu raz (w stałej), eksport — kolekcje wyjątkiem, seedy, tone.
    Projekty nie uruchamiają testów z `.claude/` (oferty-online: vitest z `--dir`), więc importy `yaml`/`ajv` w skopiowanym teście ich nie psują.
    (b) **Generator:** blok główny `**/*.{ts,tsx}` — „próg z reguły 1. z tolerancją 20%: plik > 360 / funkcja > 60” (bot czyta też `coding-rules.md`
    przez `code_guidelines`, więc instrukcja nadpisuje 300/50 wprost), `as const`/`satisfies`, zdanie „instrukcje węższych ścieżek SUMUJĄ się” + wyjątki
    (pliki testowe, `**/texts.ts`, rzutowania w atrapach). Blok testów bez AAA (sprzeczny z tone). Tone 211/250 zn. bez ścieżki (ścieżka zjadłaby limit
    po zmianie w P12 — „cytuj regułę projektu”). Eksport per plik: komponent-ekran, kolekcje (ikony, kafle, typ propsów) wyjątkiem — 3 bloki stacków.
    `e2e/seeds/**/*.sql` w bazie (konwencja pipeline'u, zostaje też w świeżym projekcie). Stała `CODING_RULES = .claude/rules/coding-rules.md` w SKILL.md,
    w template znacznik `{{CODING_RULES}}` (2×); `${{ github.event.* }}` w bloku Actions to legalne `{{` — test i ruby szukają samego znacznika.
    SKILL.md: sekcja „Bot bez szumu — jak dopisywać reguły” (8 zasad, L19), walidacja ruby z kontrolą znacznika i limitu tone. `templates/reviews/`
    z listy plików planu nie istnieje i nie był potrzebny.
    (c) **Kalibracja** (`dane/kalibracja-P5.txt`, `dane/kalibracja-P5/`, skrypty `skrypty/kalibracja_p5_*`): skrypt Workflow generowany z `dev-pr-wf.js`
    (prompt, `ZEBRANE`, słownik bez zmian; krok 1 z `-R <repo> <nr>` i wątkami rozwiązanymi; pliki `git show <head>:<plik>` w klonie). Referencja:
    wiersz CSV → id komentarza pozycyjnie w PR (ścieżki 1:1 dla PR 2, 4, 16; PR 9 i 10 rozjechane). Run 1 `wf_7419aeb3-b2b` (81 wątków): klasaBledu
    81%, oś 88%, waga 57% — 19/23 nie-defektów → P3 (12× `prog-rozmiaru`), 13 P2 → P3 („zarzut trafny i tani”, „już poprawione”). Poprawka:
    `KLASY_NIE_DEFEKT` + `wagaWatku` w bloku decyzji (JS ustawia 0 dla `prog-rozmiaru`, `preferencja-bota`, `teza-obalona`, `odpowiedz-bota`), krok 5
    i opis pola: waga = skutek, gdy defekt zostaje. Run 2 `wf_d529887a-7ef`: waga 75%, defekt/nie-defekt 88% (było 73%), P1/P2 vs reszta 89% (83%),
    P2 → P3 7. Koszt obu runów ~0,36 M (subagent_tokens 172k + 190k) — szacunek planu 2–4 M był 10× za wysoki. Słownik klas bez zmian (rozbieżności
    pojedyncze; 2× `tekst-ui` → `zgodnosc-prawna` przy polityce prywatności — opis słownika wspiera wybór agenta).
    (d) **Grupa 1 (P0–P5) zamknięta:** push szablonu wg D-2 (PLAN-POPRAWY §6) — decyzja operatora, nie wykonany.
51. **P6 SESJA 1/2 — SKRYPT BRAMEK (2026-10-03). Gałąź `popr/P6-bramki` NIEZMERGOWANA (merge po smoke'u sesji 2).** Commity: 1e82bc3 (diff,
    wykrycie, ESLint), 18c7356 (tsc, vitest --typecheck), a27cff0 (knip, size-limit), bcbde99 (migracje, migrations.sum), 9ec7958 (testy usunięte),
    2ce2dea (Stryker), 97c3d34 (advisors), d69f784 (CLI). Testy szablonu 354/354 (+48), typecheck i lint zielone. **Decyzje operatora:** bez nowych
    zależności szablonu w sesji 1; podział sesji wg propozycji.
    (a) **Skrypt** `.claude/scripts/bramki/` (14 modułów, największy 111 l.): `bramki.mjs --baza <commit sprzed fazy> [--projekt]` → JSON
    `{bramka: {status, sekundy, trafienia[{plik, linia, regula, opis}], powod?, ostrzezenia?, zastane?}}`, kod 1 przy porażce, 2 przy złych argumentach;
    `--dopisz-sume` dopisuje nowe migracje. Bramki po kolei: `typecheck` (tsc, pierwszy — lekcja z testu review), `eslint`, `testyTypow`, `knip`,
    `sizeLimit`, `migracje`, `migracjeSuma`, `advisors`, `testyUsuniete`, `stryker` (ostatni). Statusy: ok / porazka / brak / blad / pominieta;
    `stryker` i `testyUsuniete` informacyjne (lista bez porażki). Stan = drzewo robocze (bramki przed commitem domknięcia) z plikami nieśledzonymi.
    Narzędzie = binarka w `node_modules/.bin` projektu + plik konfiguracji (knip i size-limit także klucz w package.json); vitest bez konfiguracji.
    (b) **Zakres trafień:** ESLint — error w zmienionym pliku = porażka, warn tylko na liniach fazy = `ostrzezenia` (wejście code-quality); tsc —
    każdy błąd projektu (błąd tsconfig to też błąd pliku `tsconfig.json(…): error TS6046`); knip — problemy w plikach fazy, reszta `zastane`;
    size-limit — pozycja ponad limit, a pozycja z `size: 0` (size-limit zwraca wtedy `passed: true`!) i obiekt `{error}` = blad; niezmienność —
    M/D plików z bazy fazy w `supabase/migrations`; `migrations.sum` — format sha256sum (ręcznie `shasum -a 256 -c`), wpis raz zapisany się nie
    zmienia, brak pliku = brak; advisors — `GET /v1/projects/{ref}/advisors/{security,performance}` (sprawdzone w OpenAPI 2026-10-03), token
    `SUPABASE_ACCESS_TOKEN` tylko w nagłówku, ref z `SUPABASE_PROJECT_REF` albo `supabase/.temp/project-ref`, ERROR = porażka, WARN = ostrzeżenie;
    testy usunięte — `it(`/`test(` zniknięte z pliku testów, nazwa nieobecna w żadnym pliku testów fazy (zmiana nazwy też trafia na listę);
    Stryker — `--mutate plik:od-do` tylko z linii fazy w plikach z testem obok (`x.test.ts`), przeżyte = Survived + NoCoverage, raport
    (`jsonReporter.fileName` z konfiguracji JSON albo `reports/mutation/mutation.json`) czytany i usuwany.
    (c) **Odbiór:** prawdziwie ESLint 10 + `@eslint/js` i tsc (TypeScript 7) szablonu przez dowiązanie `node_modules`, git na repo testowym, lokalny
    serwer HTTP w miejsce Management API. knip, size-limit, Stryker, vitest — atrapy w `node_modules/.bin` fixture'u wypisujące wyjście NAGRANE raz
    prawdziwymi narzędziami z `~/test-review/_narzedzia` (knip 6.38, size-limit 14.0.1, Stryker 10, vitest 4.1.11; `__tests__/fixtures/`, bez ścieżek
    lokalnych). Kontrola na prawdziwych narzędziach (scratchpad, bez zmian w szablonie): faza czysta kod 0; faza z 6 defektami (pusty catch, martwy
    eksport, osłabiony test ze zmianą nazwy, zły test typu, edycja migracji, paczka ponad budżet) kod 1, każda bramka z właściwą regułą, drzewo
    czyste po bramkach, ~3,6 s; Stryker złapał `b - a` na linii zmienionej w fazie.
    (d) **Ustalenia dla sesji 2:** Stryker diff-scoped NIE łapie osłabionego testu niezmienionego kodu (z założenia — mutuje tylko linie fazy);
    size-limit z `@size-limit/file` mierzy `dist` — bez builda w bramce wynik jest nieaktualny (decyzja w konfiguracji: preset esbuild albo build
    przed bramką), plugin musi być w devDependencies projektu; vitest JSON nie podaje linii testu bez `includeTaskLocation: true`; `--projekt`
    w podkatalogu monorepo: `git diff` zwraca ścieżki od korzenia repo — przed użyciem na pakiecie fixture'u dodać `--relative` (test).
    (e) **Prompt-audit:** sesja nie zmieniła plików z promptem; `pa_dodane.py main <pliki skryptu>` = 4 trafienia `o5-delegacja-subagenci` na
    `spawnSync` (API Node) — fałszywe, kod nie zmieniany pod wzorzec.
52. **P6 SESJA 2/2 — KONFIGURACJE, DOMKNIĘCIE, SMOKE (2026-10-03). PAKIET ZAMKNIĘTY. Merge `--ff-only` do main `20e20b8`.** Commity: 2805649
    (build przed size-limit, linia testu typu), 034ac2a (templates/bramki), d4fd447 (podkatalog i pakiety monorepo), 4793779 (`--dopisz-sume` no-op),
    ea48c0e (domknięcie), 9458cd1 (hooki), 6c97325 (telemetria), 35db366 (doctor), e27e4df (README), 20e20b8 (fixture smoke'a). Testy szablonu 379/379 (+25), typecheck
    i lint zielone, prompt-audit dodanych linii 0 trafień. **Decyzje operatora:** zależności bramek (wersje z `~/test-review/_narzedzia`) jako pakiet
    workspace szablonu; size-limit = `@size-limit/file` + build przed bramką.
    (a) **Konfiguracje** `.claude/templates/bramki/`: `eslint.config.szablon.ts` (kopiowany jako `eslint.config.ts` — ESLint 10 szuka konfiguracji od
    katalogu pliku, pod nazwą wzorca wziąłby plik za konfigurację katalogu szablonu i wywrócił `eslint .` w projekcie bez zależności), `knip.json`,
    `.size-limit.json` (`dist/assets/*.js` 250 kB), `stryker.config.json` (jawny plugin vitest-runner — pnpm; katalog tymczasowy NIE w `node_modules`, bo
    vitest wyklucza tam testy; raport w `node_modules/.cache/stryker`), `package.json` = lista devDependencies (16 paczek z `jiti` — ESLint 10 ładuje
    config `.ts` przez jiti). Komentarz ze ścieżką `.claude/templates/bramki` = znacznik dla hooka i doctora; `.claude/**` poza ESLint i knipem.
    **TypeScript < 6.1 w projekcie** (typescript-eslint i Stryker potrzebują API JS; TS 7 go nie ma) — w szablonie `pnpm-workspace.yaml` + `packageExtensions`
    (peer `typescript` dla Strykera, inaczej `import('typescript')` trafia na TS 7 korzenia). Test prawdziwymi narzędziami (`konfiguracje.test.mjs`):
    każda reguła ESLint łapie swój defekt; cały `bramki.mjs` czysto → defekty → naprawa → czysto; układ monorepo. Złapał błąd: `vitest/expect-expect`
    bez `expectTypeOf` w `assertFunctionNames` zgłaszał każdy test typów.
    (b) **Skrypt:** size-limit odpala `npm run build` przed pomiarem (padnięty build = blad); vitest `--typecheck` NIE podaje `location` nawet
    z `--includeTaskLocation` (4.1.11) → linia z definicji testu po tytule; `git diff --relative` (projekt w podkatalogu); z korzenia bramki biegną też
    w pakietach zmienionych w fazie z własnymi narzędziami (najbliższy `package.json`), wynik scalony w ten sam kontrakt ze ścieżkami od korzenia;
    `--dopisz-sume` bez `supabase/migrations` = no-op (zmiana kontraktu testu).
    (c) **Domknięcie:** planner zwraca `baza` (`git rev-parse HEAD`), `bazaFazy` przepuszcza tylko SHA (inaczej HEAD); pkt 1a: bramki, naprawa każdej
    porażki w kodzie bez własnego lintu i `eslint-disable`, migracja przywracana z bazy, drugi przebieg, `--dopisz-sume`; pkt 1b zostaje; H51 jako treść.
    `EXECUTE_RESULT`: `bramki` (10 nazw jak w kolejce skryptu, pierwszy przebieg + `poNaprawie`), `ostrzezeniaEslint`, `mutanty`, `testyUsuniete`.
    Hooki: `error-handling-reminder.sh` wychodzi przy znaczniku w `eslint.config.*`; oba hooki Stop przy `stop_hook_active: true`; `settings.json` bez zmian.
    Telemetria: `faza.bramki` / `faza.testy_usuniete` z wyniku ostatniego `domkniecie` (10 kluczy — zmiana kontraktu testu z 8), `WERSJA_REKORDU` bez zmian.
    Doctor: wiersz „bramki domknięcia” (UWAGA z `pnpm add -D -E`, TS ≥ 6.1 = UWAGA, bez konfiguracji z szablonu — nie dotyczy).
    (d) **Smoke** `wf_4bbe1753-420` (kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P6-oferty-online`, w kopii commit `c94141c` — data → 2099; USUNIĘTA 2026-10-03 za zgodą operatora, transkrypty zostają w `~/.claude/projects/`):
    OK, gate CZYSTE, walidacja PASS. Bramki pierwszego przebiegu: eslint porażka (`no-empty`), migracje porażka, stryker 2 mutanty (`a - b` z testu `typeof`),
    po naprawie wszystkie ok; razem 6,8 s (budżet 143 s). Commit fazy: migracja przywrócona, catch zawężony do `SyntaxError` + rethrow, nowe
    `supabase/migrations.sum` (36 migracji). `faza.bramki` w rekordzie telemetrii. Koszt 3,87 M (+36% vs P5 `wf_b96dcd26-cea`): execute −12%,
    domknięcie −14% mimo bramek; przyrost w review/fix/sceptykach (23 vs 10 findingów, performance uruchomiony, `fix:poprawka` po regresji `-0`) —
    skutek większego fixture'u (`parsujLiczbe`), nie workflowu → **nowa referencja R-P6 = `wf_4bbe1753-420`**. Próba generalna przed smokiem
    (kopia w scratchpadzie, usunięta za zgodą) dała te same trafienia.
    (e) **Obserwacje do paczek:** domknięcie wpisało do `mutanty` wynik DRUGIEGO przebiegu (6 pozycji z NoCoverage gałęzi catch) i zaznaczyło to
    w odchyleniach — prompt mówi „pierwszy przebieg” tylko o polu `bramki`; dla wejścia review kod końcowy jest właściwszy → P7 (dossier) ustala to
    jawnie. „Pusty wynik 1 z 36 agentów” z podsumowania runu: journal ma 36/36 wyników; najkrótszy to `fix:pre-skan` `{"trafienia": []}` (poprawny).
    Klasyfikacja porażek zastanych (strażnik czasu `markup-scan.test.ts` 312 ms > 200 ms pod obciążeniem, w izolacji przechodzi; obs. 6a pkt 42 f)
    NIE zrobiona — bramki nie uruchamiają testów; zostaje przy walidacji/domknięciu (P8 albo P14).
53. **P7 SESJA 1/2 — DOSSIER ZE SKRYPTU (2026-10-03). Gałąź `popr/P7-dossier` NIEZMERGOWANA.** Commity: d354aaa (skrypt), ec71255 (domknięcie),
    178b6e3 (review-wf, autopilot, README). Testy szablonu 413/413 (+34), typecheck i lint zielone. Podział sesji potwierdzony z trzema doprecyzowaniami (c, d).
    (a) **Skrypt** `.claude/scripts/dossier/` (8 modułów, 19–110 l.): `dossier.mjs --sciezka --faza [--baza] [--bramki] [--projekt] [--wyjscie=/tmp]`
    zapisuje `review-diff-<zadanie>-faza-N.diff` (limit 300 KB ze znacznikiem) i `review-ctx-<zadanie>-faza-N.md`, a na stdout JSON w kształcie
    dzisiejszego `KONTEKST` (test waliduje ajv schematem wyciętym z review-wf). `czegoDotyczy` = status + liczby linii (zamiast zdania modelu);
    flagi warstw z regexów ścieżek i dodanych linii (szerokie — pomyłka w górę tania); pre-skan jak u packagera (dedup per linia); [E2E] z sekcji
    `Faza N` pliku zadań (bez `Operator:` i `[P1–3]`); `figma_screens` = ścieżka obrazu w „Designerski kontekst”; sekcja planu `Faza N` na dowolnym
    poziomie nagłówka (`## Faza 1:` smoke'a i `### Faza 1 —` dev-plan); wiersze „Śledzenie wymagań” z ID przywołanymi w fazie (lista i tabela);
    learned-patterns w całości (P10 da wycinek); profil stacku (znane paczki z wersją, `supabase/` z liczbą migracji i Edge Functions, tsconfig,
    monorepo); bloki bramek z pliku `/tmp/bramki-<zadanie>-faza-N.json`. Bez `--baza`: merge-base HEAD z origin/main → main → origin/master →
    master, inaczej HEAD (zapisane w pliku jako „zastępcza”). Kontrola na dokumentach smoke'a: sekcje czytane, pre-skan łapie celowy pusty catch.
    (b) **Domknięcie** (execute-wf): bramki `> /tmp/bramki-…json` (każdy przebieg nadpisuje → dossier ma OSTATNI przebieg — rozstrzyga 6a pkt 52 e),
    punkt 6 po commicie fazy uruchamia dossier (bez SHA z plannera — bez `--baza`, bo HEAD po commicie = pusty diff); `EXECUTE_RESULT.dossier` =
    kopia `KONTEKST` (`DOSSIER`, test zgodności `properties`/`required`). **`ostrzezeniaEslint` i `mutanty` wyszły z `EXECUTE_RESULT`** — jeden kanał
    do review przez dossier (zmiana kontraktu `domkniecie-bramki.test.mjs`); `bramki` i `testyUsuniete` zostają (telemetria).
    (c) **Review-wf:** `dossierFazy(args, zapas)` — `args.dossier` (domknięcie w tym runie) → zapasowy agent `dossier:zapas` (klasa-mechaniczny,
    haiku, bez efortu; schemat `ZAPAS_DOSSIER {kodWyjscia, dossier}`, o dossier decyduje JS po kodzie wyjścia) → brak (fail-open: pełny skład).
    Routing wycięty do funkcji czystych (`routingReviewerow`, `trybTesteraE2e`, `WARUNKI(w, plikiKodu)`) między kotwicami `// ── Dossier i routing (P7)`
    … `// ── Koniec dossier i routingu`. `kontekstPrompt` usunięty (H59, H60), H57/H58 jako treść w `mapaBlok`; `args.baza` (tylko SHA) idzie do
    zapasowego agenta. Raport: wiersz „Dossier fazy” nazywa źródło (`przebieg.dossierZrodlo` — tylko raport, NIE w `METRYKI_FAZY` stanu).
    Zmiany kontraktu: `sceptycy-p2.test.mjs:168` (bez tieru `packager`), `metryki-w-stanie.test.mjs:150` (`dossierOpis(d, zrodlo)`), mapa klas
    i efortu w `wywolania-agentow.test.mjs`. README: dwa opisy review bez context-packagera.
    (d) **Autopilot:** `dossierZExecute = exec.dossier` → `args.dossier` review. **Dossier NIE jest utrwalany w stanie** (odstępstwo od zdania
    PLAN-POPRAWY §3 P7 „autopilot zapisuje je w stanie zadania”): po STOP-ie między execute a review operator mógł zmienić kod, a plik w /tmp
    byłby nieaktualny — świeży run odtwarza dossier zapasowym agentem (1 haiku, tylko w tym przypadku).
    (e) **Otwarte dla sesji 2:** `faza.mjs:183` liczy `review_rundy` z ról `kontekst:diff` → na gałęzi = 0 do sesji 2 (P7 przewiduje liczenie
    z uruchomień review-wf); `role.mjs` mapuje prompt „Jestes context-packagerem” — dopisać rolę `dossier:zapas` (prompt zaczyna się od „Uruchom
    w korzeniu repo (Bash): `node .claude/scripts/dossier/dossier.mjs”); `faza.dossier_zn` = rozmiar pliku dossier (skrypt może zwracać `znaki`
    — wtedy pole w `KONTEKST` i kopii). **Baza dla zapasowego agenta:** po STOP-ie autopilot nie zna bazy fazy → merge-base z main (w zadaniu
    wielofazowym zakres obejmie wcześniejsze fazy) — rekomendacja: execute-wf zwraca `baza` z JS (`bazaFazy(plan)`), autopilot utrwala ją w stanie
    fazy i podaje `args.baza` (review-wf już ją przyjmuje).
    (f) **Prompt-audit** (`pa_dodane.py main` na trzech workflowach): 4 trafienia `1a-wykrzykniki` na operatorze `!!` w kodzie JS (2 w liniach
    przeniesionych do `routingReviewerow`) — fałszywe; dodane linie promptów (zapasowy agent, punkt 6 domknięcia, H57/H58) — 0.
54. **P7 SESJA 2/2 — STAN FAZY ZE SKRYPTU, SMOKE (2026-10-03/04). PAKIET ZAMKNIĘTY. Merge `--ff-only` do main `b0e961a`.** Commity: 446514f (stan
    fazy i baza), 2bbd73c (zwijanie w fixie), 3261e2f (telemetria), b0e961a (prompt-audit). Testy szablonu 431/431 (+18), typecheck i lint zielone.
    (a) **Mapa 14 miejsc `zapiszStan()`** (13 z planu + zielony start z P4), zaakceptowana przez operatora przed kodem. `trescStanu(stan)` liczy JSON,
    `oznaczStan()` po każdej zmianie, `zeStanem(polecenie)` dokleja na KOŃCU polecenia blok zapisu (Write → odczyt `JSON.parse` → `stanZapisany`;
    początek promptu bez zmian, więc `klasyfikujPoPrompcie` działa), `potwierdzStan(wynik)` → zapis zapasowy przy braku `stanZapisany === true`.
    Kto zapisuje: zielony start → `e2e:precheck`; execute done → **domknięcie** execute-wf (`args.stanPoExecute`, `stanZBaza` wstawia bazę w JS,
    punkt „ZAPIS STANU” tylko przy `completed`; execute-wf zwraca `baza`); 8 STOP-ów (scribeFail, bloker, tester E2E, pliki binarne, fix FAIL,
    verify-fix, poprawka FAIL, walidacja E2E) → `stop:commit-artefaktow` (stan w commicie STOP-u; agent pominięty/padł → zapas); review done z fixem →
    `fix:faza-N`; ostatnia faza → `walidacja-koncowa`; walidacja done z E2E → `e2e:env-down`; compound done (oznaczany PRZED refreshem) → `compound-refresh`.
    **Zostaje `stan:zapis` (odstępstwo od PANEL §5 „stan:zapis znika”):** (a) między fazami — przed execute-wf/review-wf następnej fazy;
    (b) po walidacji bez E2E (przed compound-wf); (c) po compound bez refresha (przed complete-wf); (d) zapas po niepotwierdzonym zapisie następcy.
    Powód: następnym krokiem jest pod-workflow, a blok zapisu w każdym pod-workflowie = kopia bloku + potwierdzenie przez wszystkie ścieżki zwrotu.
    Po complete-wf zapisu brak (wskrzesiłby katalog w `docs/active/`) — strażnik w teście. `ZAPIS_STANU.poprawnyJson` w `required` (jeden użytkownik).
    (b) **Zwijanie „Do poprawy”:** `blokZwinieciaDoPoprawy(sciezka, faza)` w `fixPrompt` przed commitem fixa (sekcja i nazwa raportu z JS);
    agent `zwin-do-poprawy` zniknął.
    (c) **Baza fazy (6a pkt 53 e):** `faza.baza` w `PLAN_STATE` (poza `required`), bootstrap przepisuje 1:1, review dostaje `args.baza`. Test wznowienia
    (`stan-fazy.test.mjs`): plik stanu z domknięcia → args review → polecenie zapasowego agenta z `--baza`.
    (d) **Telemetria:** skrypt dossier zwraca `ctxZnaki` (pole w `KONTEKST` i `DOSSIER`); `faza.dossier_zn` z `dossier:zapas`, inaczej z domknięcia;
    `review_rundy` = różne grupy harnessu `▸ dev-docs-review-wf…` w fazie (pole `grupa`); `role.mjs`: wchodzi `dossier:zapas` (etykieta i początek
    promptu), wychodzą `kontekst:diff` i `zwin-do-poprawy`. Zmiany kontraktu w `faza.test.mjs` nazwane w commicie. `WERSJA_REKORDU` bez zmian.
    (e) **Smoke** (kopie `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P7-oferty-online` i `_smoke-P7b-oferty-online` — USUNIĘTE 2026-10-04 za zgodą operatora, transkrypty zostają w `~/.claude/projects/`):
    baza kopii czerwona na zastanych testach oryginału → w obu kopiach commit środowiska (`5798e89`, `44b70c0`): `vi.setSystemTime(NOW)` w
    `apps/server/src/mcp/tools/opublikuj-oferte.test.ts` (`EXPIRES_AT` minęło 2026-09-30) i `TIME_LIMIT_MS` 200 → 1000 w `markup-scan.test.ts`
    (strażnik czasu pod obciążeniem `pnpm -r`, 208–271 ms; za zgodą operatora). **A `wf_17eac746-574`:** OK, CZYSTE, 3,49 M (−10% vs R-P6), 28 agentów
    (−22%), 20 min; 0 `kontekst:diff`, 0 `zwin-do-poprawy`, `stan:zapis` 1× (miejsce b); `stanZapisany=true` u precheck, domknięcia, fixa, walidacji,
    refresha; `faza.baza` w zarchiwizowanym stanie; `dossier_zn` 52 649, `review_rundy` 1; routing jak R-P6 (6 reviewerów, e2e pominięty)
    → **nowa referencja R-P7**. **B:** run `wf_56ef0a6d-2d7` zatrzymany ręcznie w trakcie review (stan na dysku: execute done, review pending,
    baza `44b70c0`), świeży run `wf_c3f62710-562`: OK, 26 agentów, 2,98 M; bez execute, `start:commit-zadania` zacommitował stan, `dossier:zapas`
    z `--baza 44b70c0…`, kod 0, dossier identyczne z domknięciem przerwanego runu (7 plików, +147 −8, 53 403 zn.); `stan:zapis` 1×. Odczyty:
    `dane/smoke-P7.txt`, `dane/smoke-P7-wznowienie.txt`.
    (f) **Obserwacja (otwarta):** lista plików dossier zawiera `docs/active/<zadanie>/.autopilot-state.json` (artefakt pipeline'u; w A i w B) —
    reviewerzy dostają zbędny plik, routing liczy go jako nie-kod. Rekomendacja: skrypt dossier pomija `.autopilot-state.json` (test na repo-fixture)
    — mała zmiana do zrobienia na starcie P8 (w instrukcji §8).
    (g) **Prompt-audit** dodanych linii (`pa_dodane.py main` na trzech workflowach i skrypcie dossier): w liniach promptów 0; trafienia w kodzie JS
    (`!!` w review-wf z sesji 1, `spawnSync` w skrypcie) fałszywe, własne `!!` zamienione na `Boolean()`.
55. **P8 SESJA 1/2 — KONTROLA FIXA WG LIST K (2026-10-04). Gałąź `popr/P8-fix` NIEZMERGOWANA.** Podział paczki i dwie decyzje zaakceptowane przez
    operatora przed kodem: sesja 1 = kontrola fixa, sesja 2 = fix tylko P1/P2 + smoke + merge; `fix:kontrola` = `klasa-sceptyk` z efortem **medium**
    (katalog A: opus medium; było low); K-6 w smoke'u **bez** celowego P1 w fixture (profil smoke'a jak R-P7), K-6 sprawdzany testem ekstrakcji.
    Commity: ae16ba9 (dossier), 0b16aba (kontrola), 92a5d5c (telemetria). Testy szablonu 441/441 (+10), typecheck i lint zielone, prompt-audit 0.
    (a) **Dossier (6a pkt 54 f):** `zmiany.mjs` wyklucza `:(exclude,glob)**/.autopilot-state.json` w `diff --name-status`, `--numstat`, diffie
    i `ls-files --others`; test na repo-fixture (śledzony i nieśledzony plik stanu).
    (b) **Kontrola fixa:** `zakresFixa(numerFazy, commity)` (H41–H43 łatą, H44–H45 treścią — hashe z `FixResult.commity`, zapas: grep po komunikacie
    fixa tej fazy); `kontrolaFixaPrompt` z listami K-1…K-7 (brzmienia z katalogu A; K-3 = L-COR-1…3 wpisane w prompt, bo listy correctness
    reviewerów dochodzą w P11; K-6 = test P1 na rodzicu najstarszego commita fixa w `git worktree --detach` z dowiązanym `node_modules`) i bramkami
    `bramki.mjs --baza <najstarszy>^` na plikach fixa (porażka = pozycja; migracje = niezmienność). Schemat `KONTROLA_FIXA`: `listy` z wymaganymi
    K-1…K-7, każda z wymaganym `sprawdzono`; K-6 zwraca `testy[{finding, test|null, czerwonyPrzedPoprawka}]`, pozycje K-6 liczy JS.
    `pozycjeKontroliFixa(kontrola)` → `doPoprawki` ze źródłem (K-1…K-7, `bramki`); jeden cykl `fix:poprawka` z zasadami per lista i zakresem.
    `fixPrompt`: „MIEJSCE ZMIAN” (K-7) i „NAPRAWA P1” od testu czerwonego (K-6). Usunięte: `PRE_SKAN_FIXA`, `preSkanFixaPrompt`, `REGRESJA_FIXA`,
    `regresjaFixaPrompt`, `POSTFIX_VERDICT`, `postFixVerifyPrompt` i STOP verify-fix → mapa zapisu stanu z pkt 54 (a) ma **13** miejsc
    `oznaczStan()` (było 14; STOP verify-fix znika). `podsumujKontroleFixa` bez zmian. README: 3 zdania o targeted verify → kontrola.
    (c) **Zmiany kontraktu (nazwane w commicie 0b16aba):** `stan-fazy.test.mjs` 14 → 13; `wywolania-agentow.test.mjs` efort `fix:kontrola` medium,
    z mapy klas wychodzą `fix:pre-skan` i `verify-fix`; `klasa-sceptyk.md` opis bez verify-fix.
    (d) **Telemetria:** `kontrolaFixa.listy` = pozycje per lista + `bramki` (z journala `fix:kontrola`), `fix.p1_z_testem` (placeholder) = P1 z testem
    czerwonym przed poprawką; wynik sprzed P8 → oba `null`, `regresje` bez zmian logiki → `WERSJA_REKORDU` bez zmian. **Odstępstwo od §4 („role,
    które znikają”):** `role.mjs` zostawia rozpoznanie `fix:pre-skan` i `verify-fix` dla starych runów — bez `fix:pre-skan` w `ROLE_Z_OGONEM`
    etykieta skleiłaby się w `fix`, a `fixFazy` czytałaby wynik pre-skanu jako commity fixa (pilnuje test D5); tylko komentarz. Odstępstwo zaakceptowane przez operatora 2026-10-04.
    (e) **Do sesji 2:** `smoke_odczyt.py` czyta „kontrola fixa: regresje” — po P8 `null`; dołożyć odczyt `kontrolaFixa.listy` i `p1_z_testem`.
    Telemetria klasy `fix:kontrola` = `orkiestracyjny` (mapa D3), agentType = `klasa-sceptyk` — rozjazd zastany od P3, bez zmian.
56. **P8 SESJA 2/2 — FIX TYLKO P1/P2, P3 W KNOWN-ISSUES (2026-10-04). P8 ZROBIONA, merge do main `e08e1f4`.** Commity: e23ac54 (fix P1/P2 + stan
    sprzed P8), 173b330 (scribe i blok limitu P3), 89f41d8 (smoke operatora), 34f4a58 (`smoke_odczyt.py`), 1bc2e9c (prompt-audit), e08e1f4 (K-7).
    Testy szablonu 456/456 (+15), typecheck i lint zielone, prompt-audit dodanych linii (`pa_dodane.py main`, trzy workflowy + skill) 0.
    (a) **Fix tylko P1/P2:** `otwartePoReview` bez P3 (odwrócenie planu B1); `FIX_RESULT` bez `p3Pominiete`; sekcja P3 w `fixPrompt` jako treść
    (H40): „lista zawiera P1 i P2; P3 z tej fazy są w known-issues”. `FINDING_OTWARTY` ZOSTAJE przy P3 — bootstrap przepisuje stary stan przez
    schemat, P3 spoza enumu zniknęłyby przed przeniesieniem. Telemetria `fix.p3Pominiete` w nowych runach `null` (stare rekordy bez zmian).
    (b) **Stan sprzed P8 z P3 w `otwarteFindingi`:** `odlozP3ZeStanu(fazy)` (czysta, nie zmienia wejścia) → agent `start:p3-known-issues`
    (`klasa-mechaniczny`, haiku; treść sekcji liczy JS) dopisuje `## P3 faza N` i commituje known-issues; stan bez P3 (faza po review bez P1/P2
    → `fix: none`) dopiero po `zapisano=true`, porażka = STOP (P3 nie giną). Przed liczeniem kolejki faz.
    (c) **P3 trwale w known-issues:** scribe (punkt 2a) zapisuje P3 typu KOD/TEST w `known-issues.md`, sekcja `## P3 faza N`, wiersz
    `- 🟡 [P3] <plik:linia> — <opis>`; dopisanie bez duplikatów, bez usuwania (powtórka review po STOP-ie nie kasuje P3 przerwanego podejścia).
    Nagłówek celowo nie zaczyna się od `## Faza` — fix ZASTĘPUJE sekcję `## Faza N` (nierozwiązane P2). „Do poprawy” = tylko P1/P2.
    (d) **Review (H52, H53, H62 jako treść):** blok limitu P3 — P3 ląduje w known-issues i opisie PR, akcyjność (jeden plik:linia + zdanie akcji)
    zostaje; `LIMIT_P3_GLOBALNY` = 15 jako sufit raportu; `wybierzNity` bez zmian zachowania (komentarz). Prompt scribe 8297 → 6973 zn. stałej
    części (−16%, test z sufitem 7000): bez archeologii audytów, zwięźlejsze formaty; bookkeeping E2E nietknięty (P14).
    (e) **Archiwizacja:** punkt 4 smoke'u (`dev-docs-complete-wf`) i krok 3 skilla `dev-docs-complete`: z „Do poprawy” otwarte [P1]/[P2],
    sekcje `## P3 faza N` pomijane. `dev-pr-wf` bez zmian — „Świadomie nienaprawione” czyta known-issues (P3 tam są) i stare P3 z „Do poprawy”.
    (f) **Zmiany kontraktu (nazwane w commitach):** `metryki-w-stanie.test.mjs:128–147` (otwartePoReview bez P3, FINDING_OTWARTY z P3),
    `findingi-po-stopie.test.mjs` (dane P3 → P2), `stan-fazy.test.mjs` `oznaczStan()` 13 → 14, `wywolania-agentow.test.mjs` mapa klas
    +`start:p3-known-issues`; `role.mjs`: rola mechaniczna. Nowe testy: `fix-p1-p2.test.mjs`, `scribe-p3.test.mjs`, prompt smoke'u w `start-koniec`.
    (g) **`smoke_odczyt.py` (6a pkt 55 e):** wiersze `kontrola fixa: listy`, `fix: P1 z testem (K-6)`; sekcja 2b z journala runu: agenci
    `fix:pre-skan`/`verify-fix`, P3 KOD/TEST u scribe'a, P3 na liście fixa (z transkryptu `agent-<id>.jsonl`), wpis `sprawdzono` per K-1…K-7 i bramki.
    (h) **Smoke** (kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P8-oferty-online`, commit środowiska `2698228` jak 6a pkt 54 e;
    USUNIĘTA 2026-10-04 za zgodą operatora, transkrypty zostają w `~/.claude/projects/`): **`wf_9317b7cf-cdf` OK, CZYSTE, 3,62 M (+4% vs R-P7), 27 agentów, 21 min** → nowa
    referencja **R-P8**. 0 `fix:pre-skan`, 0 `verify-fix`; `fix:kontrola` z wpisem dla K-1…K-7 i bramek (pozycje K-5 2, K-7 1 → `fix:poprawka`);
    0 P3 na liście fixa, 3 P3 u scribe'a → `known-issues.md` `## P3 faza 1` (2 otwarte + 1 przeniesiony przez walidację do `## Zamkniete`);
    smoke operatora bez P3 (jedno zdanie, że zostają w known-issues). Etap fix 0,579 M vs 0,581 M R-P7 (`fix:kontrola` 0,15 M vs 0,08 M — efort
    medium i listy, pokryte przez brak pre-skanu 0,06 M); próg „kontrola > 0,46 M/commit” daleko. Execute +24% i domknięcie +53% — rozrzut runu,
    P8 ich nie dotyka. Odczyt: `dane/smoke-P8.txt`.
    (i) **Defekt znaleziony w smoke'u i poprawiony (e08e1f4):** K-7 zgłosił edycję `*-zadania.md` przez fix (odznaczenie „Weryfikacja: typecheck”,
    zwinięcie „Do poprawy” — oba zleca `fixPrompt`), tura poprawek je cofnęła: w archiwum kopii `[ ]` przy typecheck i brak śladu cyklu fix.
    K-7 i „MIEJSCE ZMIAN” pomijają teraz pliki katalogu zadania (księgowość). **Decyzja operatora 2026-10-04: merge bez osobnego smoke'a,
    sprawdzi smoke P9** — oczekiwane: 0 pozycji K-7 na plikach `docs/active/<zadanie>/`, linia „Zamkniete cyklem fix” w archiwum zadań.
57. **P9 SESJA 1/2 — SCEPTYK ASYMETRYCZNY + BATCH 4 + TELEMETRIA + KILL RATE (2026-10-04). Gałąź `popr/P9-sceptycy` NIEZMERGOWANA.** Podział
    na 2 sesje i cztery rozstrzygnięcia zaakceptowane przez operatora na starcie (sesja 1 = kod, telemetria, prompt-audit, kill rate jako bramka;
    sesja 2 = smoke, merge, push). Commity: 28fa8c3 (telemetria), 10b9a68 (porcje P2), 685686f (sceptyk asymetryczny), 616f49d + 1bdd2c5 (kill rate).
    Testy szablonu 466/466 (+10), typecheck i lint zielone, prompt-audit dodanych linii (`pa_dodane.py main`, review-wf + autopilot) 0.
    (a) **Sam zarzut (rozstrzygnięcie 1):** finding ma tylko `opis` — teza = `opis` (tak jak u sceptyków B w teście review); `zarzutSceptyka(f)`
    = `[waga] plik:linia — opis`, bez `_zrodlo`, osi i typu. Wydzielenie tezy z uzasadnienia wymagałoby zmiany schematu reviewerów (P11).
    Strażnik w `sceptycy-p2.test.mjs`: wycinek verify nie odwołuje się do `f._zrodlo`/`f.typ`/`${f.opis}`, zarzut składa jedna funkcja w obu ścieżkach.
    (b) **Etykiety (rozstrzygnięcie 2):** `VERDICT`/`VERDICTS_BATCH` = {etykieta, dowod, uzasadnienie} (+indeks), bez `realny` i `severityKorekta`.
    `domknijWerdykty`: większość (> połowy głosujących: 1/1, 2/2, 2/3) DISAGREE_EVIDENCE kasuje; większość sprzeciwu bez większości dowodów
    obniża wagę o stopień (P1 → P2, P2 → P3 → known-issues przez scribe'a), adnotacja `[sceptyk: P2 → P3, …]` w opisie; pojedynczy głos nie rusza
    P1; EVIDENCE z pustym `dowod` = CONCERN (JS, nie prompt). Zero głosów = NIEZWERYFIKOWANY bez zmian. Reguła A7 dla P2 przestaje obowiązywać
    (zmiana kontraktu nazwana w commicie). E2E testera i OPERATOR poza verify — test wiringu.
    (c) **Porcje (rozstrzygnięcie 3):** `porcjujP2` zamiast `grupujPoPliku` — sort po pliku, cięcie po 4; etykieta `verify-batch:<n>:<rozmiar>`.
    (d) **Telemetria:** przebieg review `sceptyk` {agree, disagree_evidence, disagree_concern, degradacje} zamiast `severityKorekty` (review-wf,
    wiersz raportu, `METRYKI_FAZY`, `skrotPrzebiegu`) → `faza.sceptyk` (stan sprzed P9 / `null` = null); `agent.werdykty` per sceptyk;
    `werdyktySceptyka`: EVIDENCE z dowodem = obalenie (ta sama reguła co workflow), stare werdykty z `realny` bez zmian — `WERSJA_REKORDU` bez podbicia.
    `degradacje` dodane do trzech pól z planu, bo próg „degradacje > 35%” liczy findingi, nie głosy. Zmiany kontraktu: `metryki-w-stanie.test.mjs`
    (`severityKorekty` → `sceptyk`, kotwica wiersza raportu), `agent.test.mjs` (`werdykty` ma producenta). Linię scribe'a skrócono pod sufit 7000 zn. (P8).
    (e) **Kill rate (rozstrzygnięcie 4; `dane/kill-rate-p9.txt`, `dane/test-review/kill-rate-p9.json`):** `test_review_sceptycy.py p9 | przygotuj-p9 |
    uruchom-p9 | wynik-p9` — wycinek Verify z bieżącego review-wf bajt w bajt poza usuniętym `agentType` (kopie faz sprzed P3 nie mają
    `klasa-sceptyk`; wrześniowy sceptyk też był bez), kontekst z archiwum BEZ zrzutów /tmp (diff i ctx packagera już nie istnieją — sceptyk robi
    `git diff` sam). 14 faz, findingi wariantu 0 z kluczy 1 i 2 (permutacja 1): **74 (P1 12) → zabity 1 (f-46be55a F50 `handleLogout`, klucz 1 —
    ten sam, którego zabił dzisiejszy; drugi dzisiejszy zabity, `handleSubmit`, P9 utrzymał), obniżonych 0; klucz 1: 1/21 vs dziś 2/21; klucz 2:
    0/53.** Głosy AGREE 97 / EVIDENCE 1 / CONCERN 0. Koszt 3,71 M / 58 agentów = 0,050 M na finding vs dziś 0,083 (−40%). Kryterium spełnione.
    Ograniczenie: archiwum ma tylko prawdziwe findingi — przepuszczanie fałszywych niezmierzone (0 sprzeciwów na prawdziwych to też sygnał
    do pilnowania progu „obalenia < 5%” w telemetrii). Obalenie F50 oparte na kodzie biblioteki (auth-js 2.112.4 `_signOut`), sędzia uznał finding za prawdziwy.
    (f) **Przebieg kill rate:** 2 z 14 sesji uruchamiających podały args jako tekst JSON (run 19 ms, 0 agentów), ponowna próba f-1de5a4c
    dostała JSON z nadmiarowym `}` — args wklejane teraz do skryptu fazy (`~/test-review/skrypty/<et>/sceptycyP9.js`, sesja dostaje `{}`);
    próby w `~/test-review/odrzucone/`. Sesje headless z `disableAllHooks` — rekordy telemetrii nie powstały (pipeline.jsonl czysty).
58. **P9 SESJA 2/2 — ODCZYT SCEPTYKÓW, SMOKE, MERGE (2026-10-04). P9 ZROBIONA, merge `--ff-only` do main `85bfec3`.** Testy 466/466,
    typecheck i lint zielone (na gałęzi i na main po merge'u).
    (a) **`smoke_odczyt.py` (commit 85bfec3):** sekcje P9 w osobnym module `skrypty/smoke_sceptycy.py` (główny plik 233 linie): 2c — `faza.sceptyk`,
    sumy `agent.werdykty`/`obalone`/`weryfikowane` sceptyków fazy, `verify-batch` vs ⌈`przebieg.sceptycy.p2Findingi`/4⌉, agenci `verify` (P1 ×3);
    2d — etykiety per sceptyk z journala i błędy schematu (`failed` w journalu, głos bez etykiety z enumu — stare werdykty z `realny` też);
    2e — katalog kopii z `cwd` transkryptu agenta, wiersz „Sceptycy: AGREE …” i adnotacje `*(sceptyk:` w `review-faza-N.md`, linia
    „Zamkniete cyklem fix” w `docs/completed/<zadanie>/*-zadania.md`; w 2b dodatkowy wiersz K-7 na plikach `docs/active/`. Sprawdzone na R-P8
    (K-7 docs/active = 1 — defekt z pkt 56 (i); werdykty sprzed P9 = błędy schematu) i na sztucznej kopii w scratchpadzie.
    (b) **Smoke** (kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P9-oferty-online`, skrypt P0 z atrapami env → kod 7 na zastanej
    czerwonej bazie → commit środowiska `2d2ea59` jak pkt 54 (e) → typecheck i 4108 testów kopii zielone): **`wf_34ba05c9-cca` OK, CZYSTE, 3,49 M
    (−4% vs R-P8), 28 agentów, 18 min** → nowa referencja **R-P9**. Sceptycy: 5 P2 → `verify-batch:0:4` + `verify-batch:1:1` = ⌈5/4⌉ (porcja
    niezależna od pliku — w R-P8 też 2, ale po pliku); etykiety AGREE 5 / EVIDENCE 0 / CONCERN 0 / degradacje 0 zgodne w journalu,
    `faza.sceptyk`, `agent.werdykty` i wierszu raportu `review-faza-1.md`; 0 błędów schematu, 0 `failed`; etap sceptycy 0,15 M vs 0,17 M (−12%).
    `agent.obalone` = 0 przy 0 obaleniach — warunek „niezerowe przy obaleniach” w tym runie nie do sprawdzenia (mapowanie EVIDENCE → obalenie
    pokrywa `agent.test.mjs`; kill rate miał obalenie, ale bez rekordów telemetrii). **K-7 z P8:** 0 pozycji K-7 (także na `docs/active/`),
    w archiwum „Zamkniete cyklem fix: 5 pozycji — …” — poprawka e08e1f4 potwierdzona. Odczyt: `dane/smoke-P9.txt`.
    (c) **Odchyłki poza P9 (do decyzji operatora):** pierwszy run `wf_2cfdfa85-240` w tej samej sesji kopii = STOP doctora „BRAK obowiązkowych:
    gh”, drugi przeszedł (gh jest w `/opt/homebrew/bin`); `stan:zapis` 2× zamiast 1× — `e2e:precheck` (haiku) zwrócił wynik bez `stanZapisany`
    (pole spoza `required` w `E2E_PRECHECK`), zapas zadziałał (+0,03 M). Kandydat: `stanZapisany` w `required` schematów z doklejonym stanem
    (właściciel P7; wymaga smoke'a).
    (d) **Push szablonu (D-2, koniec grupy II):** wypchnięty 2026-10-04 z sesji na prośbę operatora (P8 + P9 + dokumentacja). Kopia
    `_smoke-P9-oferty-online` USUNIĘTA 2026-10-04 za zgodą operatora (transkrypty zostają w `~/.claude/projects/`).

59. **P10 SESJA 1/3 — SKRYPTY WIEDZY + `stanZapisany` W `required` (2026-10-04). Gałąź `popr/P10-wiedza` NIEZMERGOWANA.** Commity: fa10933
    (`stanZapisany`), aca82a0 (moduły wiedzy), 43ec87e (CLI). Testy 509/509 (+43), typecheck i lint zielone. Prompt-audit: sesja nie dodała linii promptów.
    (a) **Decyzje operatora (wg rekomendacji):** P10 w 3 sesjach — 1: skrypty (Node, bez workflowów), 2: podpięcie do workflowów/skilli/agentów
    + telemetria + README, 3: kopia oferty, konwersja na kopii mechanizmem szablonu, smoke, merge (smoke może wejść do sesji 2, gdy starczy miejsca).
    `stanZapisany` w `required` w P10 (właściciel P7), osobny commit — cofany niezależnie, sprawdza go smoke P10 (`stan:zapis` 1×). Konwersja:
    klasę (i korektę reguły/wzorców) proponuje JEDEN agent w trybie konwersji `dev-compound-refresh`, skrypt waliduje tym samym walidatorem co compound,
    niezgodne → lista odrzutów dla operatora. Stałe: wycinek 2000 zn, koszyk „zawsze” 5 wpisów, indeks 20 000 zn, reguła ≤ 400 zn i ≤ 2 zdania, waga
    z `severity` (critical/high → wysoka, medium → srednia, low → niska).
    (b) **`stanZapisany`:** pole w `required` sześciu schematów autopilota z `POLE_STANU` (`E2E_PRECHECK`, `FIX_RESULT`, `VALIDATION_RESULT`,
    `E2E_DOWN_RESULT`, `REFRESH_RESULT`, `COMMIT_ARTEFAKTOW`) i `EXECUTE_RESULT`; typ `boolean|null` bez zmian. Test w `stan-fazy.test.mjs`; kotwica wycinka
    w `domkniecie-bramki.test.mjs` brała dosłowną linię `required` — zmieniona kotwica, asercje bez zmian.
    (c) **`.claude/scripts/wiedza/` (7 modułów + CLI, każdy ≤ 200 linii):** `klasy.mjs` — kopia `KLASY_BLEDOW` i `KLASY_NIE_DEFEKT`, `KLASY_WIEDZY`
    = defekty bez nie-defektów i bez `inna`; `frontmatter.mjs` — odczyt/zapis podzbioru YAML solutions (skalary, cudzysłowy, listy), zapis tylko podanych
    pól; `walidacja.mjs` — pola `klasa, regula, paths, waga, szczebel, szczebel_powod, date, zrodlo, ucieczki` (globy: względne, bez `.`/`..`, każdy
    pasuje do ≥ 1 pliku `git ls-files -co`; `**` = koszyk „zawsze”); `wpisy.mjs` — wpisy z `docs/solutions/` (bez `_archived`), solution bez pól
    wiedzy = poza wiedzą, z błędnymi polami = `niepoprawne`; `indeks.mjs` — tylko szczebel `regula`, dedup po klasie + treści reguły (zostaje nowszy),
    sortowanie zawsze → waga → ucieczki → klasa → data; `wycinek.mjs` — globy po ścieżkach plików (także nowych), koszyk zawsze, dedup, limit
    z odesłaniem do indeksu; `konwersja.mjs` — kandydaci (tytuł reguły jako propozycja, źródła `Source:`, waga, data, wzorce ze ścieżek kodu cytowanych
    w solution — bez `docs/`, `.claude/`, `*.md`), zastosowanie (kształt propozycji, solution tylko ze źródeł reguły wewnątrz `docs/solutions/`, jedna
    reguła na solution, solution z polami = odrzut „konwersja powtórzona?”), archiwizacja (rename do `docs/archiwum/learned-patterns-<data>.md`
    + `learned-patterns-odrzuty-<data>.md`). CLI `wiedza.mjs sprawdz | indeks [--zapisz] | wycinek --pliki | konwersja przygotuj | konwersja zastosuj
    --propozycje [--data]`: JSON, kod 0/1/2; indeks przy bramce nie nadpisuje pliku; zastosuj archiwizuje stary plik tylko po zapisanym indeksie.
    sync-template zabiera każdy śledzony plik `.claude/**` — nowy katalog pojedzie do projektów bez zmian w skrypcie.
    (d) **Próba na oferty-online (tylko odczyt, `git status` bez zmian):** 38 reguł (50 167 zn), 38 z istniejącym solution, 0 wspólnych solution,
    tytuł mieści się jako reguła w 38 (62–228 zn), waga 27 wysoka / 11 średnia, bez kandydata wzorca 8 (nr 5, 6, 8, 15, 23, 26, 30, 32 — agent
    dobiera albo `**` w limicie 5), mediana 2 kandydatów; JSON kandydatów 64k zn (wejście agenta konwersji); odtwarzalny komendą z §7 (P10 sesja 1).
    (e) **Poza planem — do sesji 2:** numery linii w PLAN-POPRAWY §3 P10 nieaktualne (whitelista autopilota `:1887`/`:1920`, nie `:1584`/`:1614`);
    starą ścieżkę mają też warianty builderów `-figma` (P3), `dev-docs/SKILL.md:62,180`, `dev-docs-complete/SKILL.md:62,114`, `dossier/zadanie.mjs`,
    telemetria `transkrypt.mjs:134` (`learned_zn` — zostaje jako miernik: po P10 ma być 0 w `instructions`).
60. **P10 SESJA 2/3 — PODPIĘCIE WIEDZY + SMOKE (2026-10-05). Merge `--ff-only` do main `0779bf4` po zielonym smoke'u (decyzja operatora); sesja 3 dalej na `popr/P10-wiedza`.** Commity: fe84e17 (compound), ea209a3 (refresh),
    243cfc0 (wycinek: planner, dossier, reviewerzy), feb047f (odwołania), 7e7943b (telemetria), b226ed8 (README). Testy 533/533 (+24), typecheck
    i lint zielone, `pa_dodane.py main` na 16 plikach z promptem: 0 trafień.
    (a) **Compound:** skill dev-compound — sekcja „Pola wiedzy” (klasa z `KLASY_WIEDZY`, reguła ≤ 2 zdania / 400 zn, `paths`, waga z severity,
    szczebel `kod` → `lint` → `regula` z jednym zdaniem powodu, zrodlo, ucieczki; duplikat = ta sama treść reguły + ucieczki +1), `wiedza.mjs sprawdz`
    po zapisie (dwie próby, potem plik usunięty = odmowa), `indeks --zapisz` tylko dla szczebla `regula`, data z `date +%F` (H29 łatą).
    dev-compound-wf: materiał = raporty review, known-issues, Dziennik, commity `fix(` (H46, H47 jako treść, PA-14); schemat `wiedza` / `odmowa` /
    `indeks` (zapisany | bramka | bez zmian); `propozycjeBramek` liczone w JS (`propozycjeBramek()`, kopia w dev-pr-wf z testem równości) —
    zapis propozycji = samo solution (`szczebel`, `szczebel_powod`), bez nowego pliku. dev-pr-wf etap compound: `wpisy[]`, `odmowy[]`, `indeks`,
    raport skilla dev-pr z sekcją „Propozycje bramek”. Autopilot zwraca `wiedza`, `indeks`, `propozycjeBramek` zamiast statusu reguły.
    (b) **Refresh:** Faza 1.7 = `indeks --zapisz` + obsługa bramki w solutions (zawężenie `paths`, scalenie, archiwum), sekcja „Jeden wątek” zamiast
    strategii subagentów (PA-41; pomocnicze wątki tylko przy 9+ dokumentach), dokument zastępczy pisze sam z `sprawdz`, H30 łatą; tryb `--konwersja`
    (czyste drzewo → przygotuj → klasa/reguła/wzorce od wykonawcy skilla → zastosuj → commit; CLAUDE.md dla operatora). Stary plik opisany bez pełnej
    ścieżki, więc test odwołań nie potrzebuje wyjątku.
    (c) **Wycinek:** planner — `wiedza.mjs wycinek --pliki <pliki jednostki>` → blok „Wyuczone reguly projektu:” z powodem z pomiaru (H50 jako treść,
    PA-13); dossier — moduł `dossier/wiedza-blok.mjs`, sekcja „Reguly projektu — wycinek wiedzy dla plikow fazy”, pole `wiedza` w wyniku i w schematach
    KONTEKST/DOSSIER; reviewer bez dossier liczy wycinek tym samym skryptem. Zmiany kontraktu: `dossier-cli.test.mjs` (fixture z solutions),
    `dossier-review.test.mjs` (zapasowa ścieżka), `odwolania.test.mjs` (bez `TWORZONE_W_PROJEKCIE`), `start-koniec.test.mjs` (pathspec bez `.claude/`).
    (d) **Telemetria:** `faza.wiedza` {indeks_zn, claude_md_zn, wycinek_zn, wycinek_wpisy, wycinek_pominiete} z dossier fazy (źródło jak `dossier_zn`);
    `run.pr.klasy[].ma_regule` z solutions w `cwd` runu (`telemetria/wiedza.mjs`, stan w chwili zbierania — po etapie zbierz, przed compoundem PR);
    `WERSJA_REKORDU` bez zmian (oba pola miały null).
    (e) **Smoke (kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P10-oferty-online`, oferty `eb63043`):** baza kopii czerwona z dwóch
    powodów — znane testy z pkt 54 (e) (commit środowiska `ad4f38d`) i 14 plików dashboardu bez `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` /
    `VITE_OFFER_ORIGIN` (nowy HEAD czyta je przy imporcie) → `.env` kopii z atrapami (ignorowany, bez sekretów; to samo co opcja `--env` skryptu).
    **Konwersja** (sesja w kopii, `/dev-compound-refresh --konwersja`, commit `6ef2fe0`): 38/38 reguł zapisanych, 0 odrzutów, koszyk „zawsze” 0;
    pierwsza próba zatrzymana bramką indeksu (20 070 > 20 000 zn) → agent skrócił 3 reguły → 19 857 zn; stary plik `git mv` do
    `docs/archiwum/learned-patterns-2026-10-05.md` (plik odrzutów nie powstał — 0 odrzutów); 3 solutions bez pól (dwa drugie źródła reguł, jedno
    bez reguły). CLAUDE.md kopii: wiersz „Źródła prawdy” na indeks (`8c06515`, w roli operatora wg README). **Run `wf_844929f5-f35`:** OK, CZYSTE,
    2,30 M (−34% vs R-P9), 27 agentów, 21 min; review −53%, execute −44%, sceptycy −44%; ctx_start opus: builder 60 → 36k, reviewer 51 → 27k,
    orkiestracyjny 49 → 25k, sceptyk 49 → 24k, naprawiacz 59 → 34k (haiku bez zmian 7–8k); `learned_zn` 0 u 23/23 agentów z kontekstem; dossier
    6 219 zn (R-P7: 52 649); `faza.wiedza` = indeks 19 857, CLAUDE.md 22 186, wycinek 1 383 zn / 3 reguły / 0 pominiętych; planner wywołał `wycinek`,
    builder ma blok „Wyuczone reguly projektu:”; `stan:zapis` 1×; 5 P2 potwierdzonych i naprawionych, K-1…K-7 i bramki 0 (K-5 2 — opisy w docs).
    Compound: solution `runtime-errors/2026-10-05-parsowanie-liczby-…` (klasa `dopasowanie-tekstu`, szczebel `regula` z powodem, ucieczki 0, `sprawdz`
    ok, źródło = commity zadania, nie commit kopii — obserwacja z pkt 42 (f) zamknięta), **indeks = bramka** (39 wpisów, 20 256 zn), refresh skrócił
    regułę (`29ce623`), indeks dalej ponad limit → plik indeksu ma 38 wpisów; wycinek czyta solutions, więc reguła i tak dociera do builderów.
    Odczyt: `dane/smoke-P10.txt` (smoke_odczyt.py) + kontrole P10 z telemetrii i transkryptów (komendy w §7).
    (f) **Do decyzji operatora (sesja 3):** limit indeksu 20 000 zn mieści ~38 wierszy (średnio ~520 zn: reguła + wzorce + link) — oferty jest na nim
    po samej konwersji, każdy compound z regułą zatrzyma indeks. Warianty: (1) wiersz bez kolumny wzorców plików (wycinek bierze `paths`
    z frontmattera; na kopii tylko −12%, 2 364 zn — wiersz to głównie reguła), (2) wyższy limit (np. 40 000 zn ≈ 75 wierszy — indeks czyta dev-plan
    i sesja główna, nie eager), (3) bez zmian — refresh scala. Rekomendacja: (2) — limit dopasowany do projektu rozwijanego latami (zasada „limit
    dotyczy indeksu, nie wiedzy”); (1) daje za mało, a kolumna wzorców mówi czytelnikowi indeksu, kiedy reguła obowiązuje.
    Kopia `_smoke-P10-oferty-online` zostaje do decyzji operatora (usunięcie tylko za zgodą na dokładną ścieżkę).
    (g) **Decyzje operatora po smoke'u (2026-10-05, wg rekomendacji) — zakres sesji 3:**
    1. **Limit indeksu 40 000 zn** (`MAKS_INDEKS_ZN`; dziś 20 000 — oferty zmieściła się na styk tylko po przycięciu reguł przy konwersji).
    2. **Wycinek dla agentów naprawiających:** agent fixa w autopilocie (`fixPrompt`) i tura poprawek `/dev-pr` (etap `napraw`) dostają wycinek
       `wiedza.mjs wycinek --pliki <pliki, które poprawiają>`. Luka znaleziona po smoke'u: przed P10 dostawali cały plik eager, po P10 nic —
       poprawka mogła złamać regułę, którą builder znał (smoke nie wyłapał: żadna reguła nie dotyczyła poprawianego miejsca).
    3a. **Pełny indeks = widoczny sygnał:** `indeks: bramka` → zdanie w wyniku runu autopilota i raporcie `/dev-pr` „Indeks wiedzy pełny — uruchom
       `/dev-compound-refresh` (pełny przegląd)”; wąski refresh autopilota nie skraca reguł, żeby zmieścić je w limicie (w smoke'u skrócił — utrata treści).
    3b. **Lekcja `kod`/`lint` działa jak reguła do wdrożenia bramki:** dziś nie trafia ani do indeksu, ani do wycinka — do czasu decyzji operatora
       żaden agent jej nie dostaje. Zmiana: indeks i wycinek biorą `szczebel: regula` ORAZ `kod`/`lint` bez pola `bramka`; po wdrożeniu bramki
       solution dostaje pole `bramka: <gdzie wdrożona, np. eslint.config.js no-restricted-syntax>` i wypada ze spisu i wycinka (walidacja pola,
       instrukcja w skillu dev-compound i README; metryka „odsetek wdrożonych propozycji bramek” = solutions z polem `bramka` / z szczeblem kod|lint).
61. **P10 SESJA 3/3 — DECYZJE PO SMOKE'U + SMOKE (2026-10-05). PACZKA P10 ZAMKNIĘTA, merge `--ff-only` `popr/P10-wiedza` do main.** Commity: 9557d33
    (limit), e4ffd41 (wycinek fixa i /dev-pr), 85c73d0 (pełny indeks), 042bf11 (`bramka`), 166fa44 (`smoke_wiedza.py`). Testy 543/543 (+10),
    typecheck i lint zielone, `pa_dodane.py main` na 6 plikach z promptem: 0 trafień (jedno „juz nie” w pierwszej wersji linii fixa przepisane).
    (a) **Limit:** `MAKS_INDEKS_ZN` 40 000 (test: 75 reguł po ~400 zn mieści się; test przekroczenia liczy wpisy od limitu); README w dwóch miejscach.
    Skille nie podawały liczby.
    (b) **Wycinek dla naprawiających:** `fixPrompt` — blok „REGULY PROJEKTU dla poprawianych plikow, przed naprawa: `wiedza.mjs wycinek --pliki
    <pliki z pola plik findingow, bez :linia, po przecinku>`” po „MIEJSCE ZMIAN”; etap `napraw` dev-pr-wf — ten sam blok przed „1. NAPRAWA”, pliki
    watkow DO NAPRAWY + bliźniacze miejsca `napraw-szerzej`. Listę plików liczy agent (jak planner), nie JS — przy `napraw-szerzej` JS nie zna plików
    bliźniaczych. `fix:poprawka` (tura po kontroli fixa) bez bloku — decyzja (g2) wskazała `fixPrompt`; kandydat na później, gdy kontrola zacznie
    wracać z pozycjami w regułach.
    (c) **Pełny indeks:** `INDEKS_PELNY` + `uwagaIndeksu(compound, refresh)` w autopilocie (bramka z compoundu, a refresh nie zapisał indeksu) —
    pole wyniku runu i log; kopia stałej w dev-pr-wf (test równości), `uwagaIndeksu` w wyniku etapu compound i linia w raporcie skilla dev-pr.
    `REFRESH_RESULT` ma `indeks` w `required` (`zapisany | bramka | bez zmian`); `refreshPrompt`: przy bramce rozmiaru wąski refresh nie skraca,
    nie scala i nie archiwizuje pod limit, zwraca `bramka`. Skill dev-compound-refresh Faza 1.7: treści reguł nie skracasz (także pełny przegląd).
    (d) **`bramka`:** `POLE_BRAMKI` w walidacji (niepuste, tylko przy `kod`/`lint`); `czyObowiazuje(w)` w `wpisy.mjs` = `regula` albo brak `bramka` —
    jedno kryterium dla indeksu, wycinka i telemetrii `ma_regule`; `generujIndeks` zwraca `bramki: { propozycje, wdrozone }` (metryka z g3b). Compound
    (dev-compound-wf, etap compound dev-pr-wf, skill) generuje indeks po KAŻDYM zapisanym solution; „Pola bramka nie ustawiasz — dopisuje je wdrożenie
    bramki”. Zmienione testy starego zachowania (kod/lint poza indeksem: `indeks.test`, `wycinek.test`, `compound-wiedza.test`, telemetria
    `wiedza.test`) — zachowanie usunięte decyzją g3b, asercje nowego zachowania nie słabsze.
    (e) **Kopia `_smoke-P10-oferty-online` (odczyt `--projekt`):** 39 wpisów, 20 256 zn, `bledy: []` (51% limitu), `git status` bez zmian.
    (f) **Smoke (kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P10b-oferty-online`, oferty `eb63043`):** skrypt P0 z `--env` (atrapy
    z kopii P10) → kod 7 na tych samych 13 testach z 6a pkt 54 (e) → commit środowiska przeniesiony `format-patch`/`am` z kopii P10 (`a6ddca1`;
    `git fetch <ścieżka> <skrót>` nie działa — skrót to nie ref) → baza zielona. **Konwersja** (sesja w kopii, `31ca8af`): 38/38, 0 odrzutów, indeks
    zapisany za PIERWSZYM razem (20 105 zn, koszyk „zawsze” 2) — w sesji 2 przy limicie 20 000 agent skracał 3 reguły; plik odrzutów POWSTAŁ pusty
    (`archiwizuj()` pisze go zawsze — zapis w pkt 60 (e) „nie powstał” był błędny); 3 solutions bez pól jak w sesji 2. CLAUDE.md kopii: ten sam
    commit co `8c06515` (`45ed72a`). **Run `wf_5b0d08ef-0a3`:** OK, CZYSTE, 2,23 M (−3% vs `wf_844929f5-f35`), 26 agentów, 20 min; 3 P2 potwierdzone
    i naprawione, 5 P3 do known-issues; ctx_start bez zmian (builder 36k, reviewer 27k, naprawiacz 34k); `learned_zn` 0 u 22/22; `faza.wiedza` = indeks
    20 105, wycinek 1 859 zn / 4 reguły / **1 pominięta** (limit 2000 zn); planner i builder z blokiem „Wyuczone reguly projektu:”; **fix: blok
    „REGULY PROJEKTU…” w prompcie, 1 wywołanie wycinka (2 reguły „zawsze” + reguły plików pakietu)**; kontrola fixa K-3 = 1 (fix wprowadził `-0`
    przez `Number('-0')` zamiast BigInt — poprawka naprawiła, walidacja PASS); compound: solution `dopasowanie-tekstu`/`regula` (315 zn), **indeks
    zapisany** (40 wpisów, 21 116 zn), `uwagaIndeksu` puste, refresh `indeks: zapisany`, bez skracania reguł. Odczyt: `dane/smoke-P10s3.txt`.
    → **nowa referencja R-P10 = `wf_5b0d08ef-0a3`.**
    (g) **Obserwacje na później:** wycinek reviewerów w dossier trafił w limit 2000 zn przy 4 regułach (2 „zawsze” to ~800 zn) — przy P11 (reviewerzy
    na docelowym wycinku) sprawdzić, czy limit wystarcza; `fix:poprawka` bez wycinka (b). Kopie `_smoke-P10-oferty-online` i `_smoke-P10b-oferty-online`
    USUNIĘTE 2026-10-05 za zgodą operatora (transkrypty zostają w `~/.claude/projects/`).
62. **P11 SESJA 1/5 — FUNDAMENT + CORRECTNESS + SPEC (2026-10-05). Gałąź `popr/P11-reviewerzy` z main (`7b7cbcd`), NIEZMERGOWANA.**
    **Podział P11 zaakceptowany (5 sesji):** S1 test warstwy stałej + routing D4 + tiery + correctness + spec; S2 test-coverage (mutanty, „undefined”,
    5 kształtów) + code-quality (H01–H06, prompt w pliku, lint/knip jako wejście) + usunięcie kieran i code-simplicity + treść `reviewerPrompt`;
    S3 security (H19, H21–H23, PA-04, PA-39, advisors, seedy) + performance (H15, PA-03, PA-40) + komendy po profilu stacku + licznik w doctor
    i telemetrii + pełny `pa_dodane`; S4 przeróbka harnessu (kopie z `.claude` main vs gałąź, dossier `dossier.mjs --baza`, wariant = review-wf
    ucięty przed Verify, sędzia 2 warianty z neutralnymi etykietami) + suchy bieg + **pilot 1 faza × 2 warianty ≈ 5–6 M**; S5 ślepy test na 6 fazach
    (≈ 27–36 M; razem ≈ 32–42 M) + decyzje per oś + smoke vs R-P10 + merge. **Fazy ślepego testu (decyzja operatora):** b8374c8, 303ff62, 1de5a4c,
    32975a1, b26128d, 2536643 (najwięcej trafień klucza 2 osi sec/cq/perf z dopasowań wariantu 0) + **46be55a** zamiast 31491bc (correctness 3,
    test-coverage 3; jedyny P1 osi correctness gubiony przez A) — pokrycie klucza 2: sec 14/16, cq 6/8, perf 4/6, correctness 6, test-coverage 10.
    Commity: d71f65b (warstwa + correctness), 513c489 (tiery), 2d64905 (spec), a56d0f6 (D4), b4e5958 (README). Testy 553/553 (+10), typecheck
    i lint zielone, `pa_dodane.py main` na 3 plikach z promptem: 0 trafień (w 513c489 dwa fałszywe `!!r.semantyka` w kodzie JS — zniknęły w 2d64905).
    (a) **Warstwa stała:** `.claude/scripts/doctor/warstwa-stala.mjs` (`naruszeniaWarstwy`, `liczbaPolecen`, `MAKS_POLECEN` 150) — jeden blok
    `## Polecenia`, mandat ≤ 2 zdania, zdanie nakazowe poza blokiem (słownik czasowników w trybie rozkazującym + `musisz`, `należy` bez „do”,
    `nie wolno`, `pamiętaj`), daty, „jak dotąd”, „już nie”, `§N`. Test `__tests__/warstwa-stala.test.mjs`: każde sprawdzenie na podłożonym tekście
    + lista `ROLE_Z_WARSTWA` (dziś correctness, spec; każda sesja dopisuje swoje role → czerwony → przepisanie → zielony). Doctor i telemetria — S3.
    (b) **correctness-reviewer.md** od zera: L-COR-1, 2, 3, 4, 5, 8, 9, 10, 11 (warunkowe pozycje z warunkiem w nawiasie w pliku — bez doklejania
    przez JS po sygnałach, bo dossier ich nie liczy; mniej ruchomych części), kieran §4b (limit czasu wywołań, `finally` stanu ładowania), §5 (usunięcia),
    pre-skan, wagi P1/P2/P3, pomijane osie, kryterium końca. Kieran §7 (sygnały wydzielenia modułu) → code-quality w S2 (katalog A: §7 → L-CQ-2/3).
    Fokus w `REVIEWERZY` = sama nazwa osi.
    (c) **spec-compliance-reviewer.md** od zera: L-SPC-1…5 + odczyt prawdziwego wiersza z bazy E2E (z `BLOK_SEMANTYKA`), wagi z tabeli starego pliku,
    cytat źródła; spec bez `BLOK_SEMANTYKA` w prompcie (lista w pliku), `reviewerPrompt` bez parametru `semantyka`; `BLOK_SEMANTYKA` zostaje
    u test-coverage do S2. Duplikat fokusu usunięty.
    (d) **Tiery:** `TIERY_DOMYSLNE` + `spec: 'medium'`, `testCoverage: 'medium'`; test-coverage jest wpisem `REVIEWERZY` (jeden routing dla
    wszystkich osi); `wywolajOs(r)` z jedną linią opcji `agent()` na tier (test D6 czyta efort z linii). Zmiany kontraktu w testach: tabela D6
    (`wywolania-agentow.test`), tiery (`sceptycy-p2.test`), klucze aktywnych z `test-coverage` (`dossier-review.test`).
    (e) **Routing D4:** `WARUNKI` security i test-coverage `plikiKodu > 0`; spec — kod albo `PLIK_TEKSTOW_UI` (katalogi locales/i18n/translations/
    lang/messages, `.html`, `.po`) albo `DOKUMENT_PRAWNY` (regulamin, polityk, privacy, terms, legal, rodo, gdpr, cookie w nazwie pliku). Faza czysto
    dokumentacyjna = zero reviewerów (suchy bieg: sam scribe, wynik CZYSTE). README (2 miejsca) zaktualizowane.
    (f) **Znalezisko poza D4 (do decyzji w S2):** code-quality startuje w fazie BEZ kodu w każdym projekcie z `tsconfig.json`, bo flaga
    `warstwy.typowanie` (`sygnaly.mjs`) jest prawdziwa dla całego projektu, a warunek `'code-quality'` zawiera `w.typowanie`. Rekomendacja: przy
    przepisaniu code-quality w S2 warunek `plikiKodu > 0` (alternatywa `nowyModul || >= 3 || typowanie` traci sens po konsolidacji).
    (g) Obserwacja z 6a pkt 61 (g) — limit wycinka 2000 zn dla reviewerów — do sprawdzenia w smoke'u P11 (S5).
63. **P11 SESJA 2/5 — TEST-COVERAGE + CODE-QUALITY + USUNIĘCIE KIERAN I SIMPLICITY (2026-10-05). Gałąź `popr/P11-reviewerzy`, NIEZMERGOWANA.**
    Commity: cbf0966 (blok mutantów), 2f8da32 (test-coverage + `reviewerPrompt`), 5645956 (warunek code-quality), bf7eec0 (code-quality),
    295f1d2 (usunięcie kieran i code-simplicity), 0068772 (README). Testy 563/563 (+10), typecheck i lint zielone, `pa_dodane.py main` na każdym
    commicie z promptem: 0 trafień. Suchy bieg review-wf: faza z kodem → security, code-quality `high`, correctness `high`, spec i test-coverage
    `medium`; faza z samym `.md` przy `typowanie: true` → sam scribe.
    (a) **Decyzja operatora (6a pkt 62 f):** warunek code-quality = `plikiKodu > 0` (jak correctness, security, test-coverage). Rekomendacja
    przyjęta bez zmian; test routingu „faza bez kodu w projekcie z tsconfig = zero reviewerów”. Alternatywa z czterech członów znika — droga
    odwrotu do trzech reviewerów zniknęła z ich plikami (komentarz B12 nad `REVIEWERZY` przepisany: cofnięcie = plik roli z main sprzed P11).
    (b) **Blok mutantów w dossier** (`bramki-blok.mjs`) ułożony jak w C: `- M<n> plik:linia Mutator → \`zamiennik\` (Survived|NoCoverage)` + linia
    legendy (Survived = test wykonuje linię i nie wykrywa zmiany; NoCoverage = żaden test). Status i zamiennik z opisu `stryker.mjs`
    (`<status>: <zamiennik>`), `stryker.mjs` bez zmian. Testów pokrywających (`coveredBy`) w bloku nie ma: nagrany raport Strykera 10 nie ma
    `testFiles`, więc id testów nie mapują się na nazwy — reviewer wskazuje test sam (tak mierzył C).
    (c) **test-coverage-reviewer.md od zera:** mutant → test, który powinien go zabić → powód (Survived z testem = P2 TEST na linię testu,
    NoCoverage = P2 TEST na linię mutanta, oba z id mutanta; równoważny — z dowodem, bez findingu), L-TST-1 z pytaniem „undefined”, L-TST-2 jako
    5 kształtów testu niefalsyfikowalnego (z poprawką: jedno wejście, dosłowny wynik), L-TST-3…6 (atrapy, Zod vs kontrakt z `expectTypeOf`,
    gałęzie, test odmowy bramki), scenariusze planu (`Test scenarios:`, checkboxy `Test:` bez `[E2E]`), semantyka pól w fixture'ach (z
    `BLOK_SEMANTYKA`: źródło znaczenia vs fixture → P1 KOD; odczyt wiersza z bazy E2E zostaje tylko u spec), uruchamianie pojedynczego pliku
    testu, wagi, kryterium końca. L-TST-7 (lista mutantów od orkiestratora) = pozycja mutantów.
    (d) **Jedno `reviewerPrompt` dla wszystkich osi:** `testCoveragePrompt` i `BLOK_SEMANTYKA` usunięte; test-coverage idzie przez
    `reviewerPrompt(…, poprzTest, kontekst, BLOK_DLUGIE_KOMENDY)` (parametr `dodatki`). Treść: „Review fazy N zadania w folderze X. Oś: <fokus>.”
    + źródła + wagi/typy + schemat („pliki projektu zostają bez zmian”), bez tożsamości „Jesteś”. Skutek uboczny: test-coverage dostaje
    `BLOK_ZAUFANIE` jak pozostałe osie. Test `reviewer-prompt.test.mjs` (skład polecenia, re-review, brak „Jesteś”, wiring test-coverage, fokus).
    (e) **architecture-strategist.md (code-quality) od zera** — nazwa pliku bez zmian (PLAN §4: „P11 treść”; kopie `.claude` main vs gałąź
    w harnessie S4 biorą typ z własnego workflowu). H01–H06 jako TREŚĆ (plik przepisany w całości; kierunek hunków zachowany: bez przykładów,
    tożsamości, historii, drugiego formatu, zakres = diff + importy). Zachowana treść osi z dzisiejszego fokusu i pliku (PANEL-WYNIK §2 pkt 3:
    prompt code-quality zostaje): granice warstw (strona → komponent → hook → serwis → klient bazy), cykle (gdy ESLint nie ma statusu ok),
    odpowiedzialności, sygnały wydzielenia (kieran §7 + testowalność §4), surowo istniejący / pragmatycznie nowy (kieran §1–2), YAGNI i
    martwy kod (simplicity), Duplication > Complexity, typy (`any`, `as`, `!`, typ zwracany, flagi boolean, Zod na granicy), nazwy 5 s
    i konwencje, zagnieżdżenie. Dodane z katalogu A: L-CQ-1 (warn/knip → defekt / świadoma decyzja), L-CQ-2…6 (duplikaty stałych, kontrakty,
    mapowanie błędów na statusy, ciche odsiewanie, idempotencja). Efort `high` bez zmian (K3 odrzucone). Checklista async z pliku → correctness
    (S1). Fokus w `REVIEWERZY` = nazwa osi; test: oś z blokiem `## Polecenia` w pliku roli ma fokus „… wg list z pliku Twojej roli” ≤ 80 zn
    (zadziała sam w S3: przepisanie security i performance zrobi go czerwonym, dopóki ich fokus nie zostanie skrócony).
    (f) **Usunięte:** `kieran-typescript-reviewer.md`, `code-simplicity-reviewer.md`; `POZA_PIPELINE` w `klasy-rol.test` znika (każdy plik agenta
    ma `tools:`). Wykorzystanie treści w commicie 295f1d2; bez pozycji zostały porządek importów (ESLint `import-x/order`) i wzorce TS 5+ (styl).
    Compound `/dev-pr`: przykład „brak limitu czasu w kliencie HTTP” → `correctness-reviewer` (było `architecture-strategist`).
    (g) **Do sesji 3:** fokus security i performance → nazwa osi po przepisaniu plików; bloki wspólne `BLOK_ZAUFANIE` i `BLOK_LIMIT_P3`
    mają wersaliki i „NIE” (wzorce `1a`) — ich odbiorcy to wszystkie osie i sceptycy, więc idą do pełnego `pa_dodane` w S3, nie do S2.
64. **P11 SESJA 3/5 — SECURITY + PERFORMANCE + PROFIL STACKU + LICZNIK WARSTWY STAŁEJ (2026-10-05). Gałąź `popr/P11-reviewerzy`, NIEZMERGOWANA.**
    Commity: d97f97b (profil + advisors w dossier), 4217a90 (security), 58bbeca (performance), fe88a0b (doctor), c33eff2 (telemetria),
    9e1a61f (bloki wspólne), 893f252 (README). Testy 575/575 (+12), typecheck i lint zielone, `pa_dodane.py main` na 6 plikach reviewerów
    i review-wf: 0 trafień. Suchy bieg review-wf: faza z kodem → 6 osi (security, performance, code-quality, correctness `high`; spec,
    test-coverage `medium`) → dedup → verify-batch → scribe. Zakres sesji zrobiony w całości — do S4 przechodzi tylko harness (plan).
    (a) **Profil stacku dla monorepo (znalezisko):** `profil.mjs` czytał tylko `package.json` korzenia — w oferty-online korzeń ma supabase-js,
    zod, vitest, typescript, a React, Vite i Hono siedzą w `apps/dashboard` i `apps/server`, więc warunki „React w profilu” byłyby fałszywe na
    projekcie testowym. Teraz linia `Paczki apps/<pakiet>:` na każdy pakiet z `apps/*` i `packages/*` ze znanymi paczkami; `babel-plugin-react-compiler`
    w znanych paczkach (warunek PA-03). Oferty nie ma Compilera → performance zgłasza brak memoizacji tylko przy handlerze do `memo()`.
    (b) **Advisors jako wejście security:** blok bramek w dossier ma sekcję „Ostrzezenia advisors (…) — wejscie security” (WARN; ERROR
    zatrzymuje domknięcie) — wstawiona PRZED mutantami (testy mutantów kotwiczą blok na końcu). Pozycje w pliku security: (status advisors
    ok) RLS, `search_path`, `auth.users` pomija, a każde ostrzeżenie advisors przypisuje do migracji z diffu (wprowadzone w fazie = P2, bez
    migracji w diffie = projekt); (status bez ok: projekt bez Supabase, brak tokenu, błąd) lista RLS / filtr po właścicielu / `security definer`
    bez `search_path` zostaje. Warunek w nawiasie w pliku (jak S1), bez doklejania przez JS. W kopiach ślepego testu advisors ma status
    `brak` (brak tokenu) → oba warianty sprawdzają RLS listą.
    (c) **security-sentinel.md od zera** — treść dzisiejszego pliku bez skracania (11,9k zn vs 11,5k): protokół skanów, tryb atakującego
    (≥ 5 wejść na bramkę, tabela wektorów, test odmowy = TEST P1/P2), nagłówki nowego originu, koperta wejścia, autoryzacja trasy i zasobu,
    granice zaufania poza API (zapisy, gwarancje, `ON CONFLICT DO NOTHING`), XSS, sekrety, storage, upload, CSRF, OWASP poza listami.
    PA-39: jedna lista zamiast trzech checklist; wypadły pozycje niewykonalne w diffie („status zgodności per kategoria OWASP”, „zależności
    aktualne”). PA-04 zachowana (`getSession()` do autoryzacji na serwerze = finding). H19, H21–H23 jako TREŚĆ (bez przykładów, tożsamości,
    raportu „Executive Summary”, wzmacniaczy; finding = linia + ścieżka ataku + naprawa). **Dodane z katalogu A** (jak L-CQ w S2): L-SEC-1
    (gałąź domyślna bramki), 2 (dane w komunikatach/Sentry), 3 (koperta, `z.strictObject`), 4 (polecenia w dokumentach sterujących), 5 (zaufanie
    nagłówkom, `user_metadata`), 6 (parametryzacja), 7 (kolejność middleware, limiter), 8 (strażnicy w seedach, RLS warunkowo), 9 (Content-Type
    z danych), 10 (zmienne publiczne `VITE_`/`NEXT_PUBLIC_`/`EXPO_PUBLIC_`) — scalone z tematami dzisiejszego pliku, nie zamiast nich. 32 polecenia.
    **Do ślepego testu:** A stracił na security, bo L-SEC ZASTĄPIŁY treść; tu są dodane — jeśli nowy wariant straci, odwrót = minimalna forma
    (dzisiejsza treść bez dopisanych L-SEC), nie cały stary plik.
    (d) **performance-oracle.md od zera** — treść dzisiejszego pliku jako 25 poleceń: kolekcje i złożoność (10×/100× danych, O(n²) bez
    komentarza), struktury bez granicy, wczytanie w całości, N+1, niezależne żądania po kolei, kolumny/filtry/`.range()` (supabase-js w
    profilu), indeksy w migracjach, Realtime, rendery i efekty Reacta, klucze list, kontekst, anulowanie żądań, wycieki, react-query
    (`staleTime`), import w paczce klienta (size-limit pilnuje budżetu, nie miejsca importu), zasoby blokujące render, Edge Functions. PA-03
    (warunek Compilera z profilu), PA-40 (bez O(n log n), 200 ms, 5 KB), H15 jako treść. Wypadły: „cache hit rates i warming”, „monitor JS
    execution time”, „progressive enhancement” (niesprawdzalne w diffie), raport „Performance Summary”.
    (e) **Komendy per technologia po profilu stacku:** warunki w nawiasie w plikach security i performance odwołują się do profilu
    (`@supabase/supabase-js`, `react`, `babel-plugin-react-compiler`, `@tanstack/react-query`, vite/next/expo, serwer Hono/Express/Fastify);
    sekcja „Wejście” obu plików mówi, że warunek spełnia diff, profil albo status bramki. Fokus security i performance = nazwa osi —
    wszystkie 6 osi mają fokus „… wg list z pliku Twojej roli” (test z S2 zielony bez wyjątków).
    (f) **Licznik warstwy stałej:** doctor — `warstwa-rol.mjs` (wiersz TSV jak bramki): pliki `.claude/agents/*.md` z blokiem `## Polecenia`,
    suma i największy plik (szablon: 6 plików, 127 poleceń, najwięcej 32 security), naruszenie = UWAGA z plikiem, bez STOP-u; wiersz w README
    „Wymagania”. Telemetria — `agent.instrukcje_stale` ma producenta (`zrodla.mjs` → `instrukcjeStale(repo, agentType)`, ten sam licznik,
    plik z projektu runu w chwili skanu; null bez typu, pliku albo bloku); `WERSJA_REKORDU` bez zmian (stare rekordy miały tylko null).
    Raport telemetrii budżetu jeszcze nie pokazuje (d5 pkt 5: max per rola vs 150) — do karty odczytu w P16.
    (g) **Bloki wspólne wg zasad pisania:** `BLOK_ZAUFANIE`, `BLOK_LIMIT_P3`, a także `mapaBlok` i `rereviewBlok` (czyta je każdy reviewer;
    pełne `pa_inwentarz` na review-wf pokazało tam 2 stare „WYLACZNIE” poza dodanymi liniami — nie zostawione jako zastane): bez wersalików
    nacisku, z powodem; warunki bez zmian. Test w `reviewer-prompt.test` (wersaliki w 4 blokach tylko w liniach `===` i skrótach). Zmiany kontraktu:
    `scribe-p3` i `dossier-review` przypinały brzmienie wersalikami (DOKLADNIE JEDEN, NIE zwalnia, PRZYCIETY) — te same warunki małymi literami.
    Pozostałe wersaliki w review-wf (14 trafień `1a` w promptach sceptyków, e2e, scribe) należą do P9/P14 — pełny prompt-audit w P16.
65. **P11 SESJA 4/5 — HARNESS ŚLEPEGO TESTU + PILOT (2026-10-06). Gałąź `popr/P11-reviewerzy`, NIEZMERGOWANA.** Commit harnessu `c3cedcd`
    (`skrypty/test_review_p11{.py,_cli.py,.sh,_bramki.mjs}`, testy `test_review_p11_test.py` 12 + `test_review_p11_bramki.test.mjs` 2; `test_review_sesja.py`
    z krokami `p11`, `p11-sedzia-p<N>`); pnpm 575/575, typecheck i lint zielone (harness poza zakresem pnpm — testy `python3 -m unittest`, `node --test`).
    (a) **Konstrukcja:** „stary” = drzewo `.claude` z main (`d310089…`, commit `7b7cbcd`), „nowy” = drzewo `.claude` gałęzi (`e557bd9…`) — `git archive`
    do `~/test-review/p11/claude-{stary,nowy}/`, `claude.json` trzyma hashe DRZEW (commity docs/reviews ich nie zmieniają; inne drzewo = STOP).
    Wariant = `dev-docs-review-wf.js` SWOJEGO `.claude` ucięty przed `phase('Verify')`, ciało bajt w bajt w `async (args) => {…}(ARGS_TESTU)` z args
    wklejonymi (sciezka, faza, baza, `srodowiskoE2E: 'pominieto'`, dossier), jedyna różnica = `return 'pominiety'` w `trybTesteraE2e`; zwrot
    `{findings: dedup, przebieg}`. Warianty po kolei na TEJ SAMEJ kopii `~/test-review/kopie/<et>` z nakładką `.claude` (rsync `--checksum --delete`,
    skip-worktree, exclude; `rules/learned-patterns.md` i `settings.local.json` z epoki), kolejność z hasha fazy (b26128d: stary pierwszy).
    Dossier raz, `dossier.mjs --baza --bramki --wyjscie ~/test-review/p11/<et>/tmp` z `.claude` nowego — TEN SAM plik dla obu, więc stary też dostaje
    blok mutantów w formacie P11 i profil z pakietami: test mierzy pliki ról, prompt, routing i tiery, nie zmiany dossier (decyzja operatora).
    Bramki do dossier: adapter `test_review_p11_bramki.mjs` (moduły bramek z `.claude` nowego) — ESLint szablonu NAPRAWDĘ (konfiguracja w
    `_narzedzia/konfig/eslint-szablon.ts`, natywne TS w Node 22.22, bez jiti), migracje/suma/testyUsuniete/advisors (bez tokenu = brak) z modułów
    szablonu, mutanty z wrześniowego Strykera przycięte do `zakresyStrykera` (te same wersje, perTest), knip i typecheck z września. Wycinek wiedzy
    pusty u obu (kopie bez `docs/learned-patterns.md`, konwersja = agent per faza — pominięta, stan równy). Sędzia: prompt wrześniowy
    (`test_review_sedzia.prompt_sedziego`, 0/20), pula F obu wariantów z neutralnymi id, permutacja z ziarnem `p11:pula:<et>:<perm>`, mapowanie
    w `~/test-review/sedzia/<et>-p11-p<N>-mapowanie.json`. Deny sesji + katalogi P11 innych faz i `.claude` wariantów; skan P11 (modele, przeciek,
    N1, HEAD, git status, odcisk ostatniej nakładki).
    (b) **Suchy bieg (zero tokenów):** stary = 6 osi `high` (test-coverage osobnym thunkiem), nowy = spec i test-coverage `medium`; bez
    `dossier:zapas` i testera; obie nakładki `git status` czysty, agenci kopii = agenci wariantu (`diff -rq`).
    (c) **Pilot f-b26128d (zgoda operatora; 17 min, 3,7 M):** `wf_68cca3fa-8ab` (stary, 349 s), `wf_b862411b-516` (nowy, 405 s), sędzia `wf_7c15e501-a02`
    (K 13, F 60, 0,14 M); skany: STOP 0, przeciek 0. Wynik `dane/test-review/p11-wynik.{txt,json}`: klucz 1 (5 obecnych) stary 2 / nowy 3; klucz 2 (7)
    6 / 6 (nowy gubi K2 correctness — Zod odrzuca cały beacon; stary gubi K8 performance — budżet limitera na odsłonę); szum P1/P2 poza kluczem
    4 / 10 (nowy: test-coverage 6 — 13 findingów, 11 P1/P2, mutant = P2 TEST); spec nowy 1 finding vs 3; koszt znajdowania 1,84 / 1,55 M (−16%),
    na złapany klucz 0,23 / 0,17 M. Jedna faza = kierunek, nie wniosek.
    (d) **Znalezisko o szablonie:** STARY security-sentinel zrobił ręczny mutant w drzewie roboczym (`cp` do /tmp → `sed -i` w `events.ts` → vitest →
    przywrócenie) — w prawdziwym projekcie zapis w drzewie operatora i inni reviewerzy równolegle czytają zmieniony plik; nowy security tego nie robi.
    Skan liczy to jako UWAGĘ (kopia po kroku czysta).
    (e) **Decyzja operatora:** sesja 5 = pozostałe 6 faz bez zmian przebiegu harnessu, pilot wchodzi jako 7. faza; na starcie sesji 5 do `wynik`
    sumy po fazach, klucz 2 per oś (osie wariantu, które złapały) i CI bootstrapem po fazach (test → kod) — bez tego kryterium „brak istotnej straty
    per oś” jest nieczytelne. Koszt ≈ 30–36 M (wrześniowy koszt 6 faz × 0,61 z pilota) + smoke ≈ 3 M; czas ≈ 2–2,5 h.
66. **P11 SESJA 5/5 — ŚLEPY TEST 7 FAZ + DECYZJE + SMOKE (2026-10-06). PACZKA P11 ZAMKNIĘTA, merge `--ff-only` `popr/P11-reviewerzy` do main.**
    Commity: 21e0ad7 (wynik po fazach), ae491da (sesja bez limitu 600 s), 7a6f376 / 2982e83 / e88886d / ae9b834 / 80994e2 (detektor zapisu drzewa),
    e9ef1d8 (mutanty per plik), 17317aa (dane wyniku), 3314100 (odczyt smoke'a). pnpm 578/578 (+3), typecheck i lint zielone; harness
    `python3 -m unittest skrypty/test_review_p11_test.py skrypty/test_review_p11_wynik_test.py` 25 testów; `pa_dodane.py main` na pliku test-coverage: 0.
    (a) **`wynik` po fazach** (`skrypty/test_review_p11_wynik.py` + test): sumy, różnice nowy − stary z CI 95% bootstrapem po fazach (10 000 losowań,
    ziarno 20261006, metoda jak `test_review_analiza.bootstrap`), klucz 2 per oś = oś wariantu, która złapała, z rozdziałem strata realna / przeniesione
    na inną oś / zysk realny (bez rozdziału przeniesienie wyglądało jak strata osi), szum P1/P2 per oś, szum z mutantów (P1/P2 test-coverage z `M<n>`
    w opisie), koszt znajdowania razem i per oś (role `review:<oś>`), na złapany klucz, zapis w drzewie roboczym Bashem per agent. `wynik` bez argumentów =
    fazy z wyrokiem sędziego; `faza` w `.sh` liczy wynik wszystkich faz (wcześniej nadpisywał jedną). Pilot przeliczony bez agentów — liczby jak w pkt 65 (c).
    (b) **Przebieg 6 faz (zgoda operatora; ≈ 1,5 h; 32,6 M agentów + ≈ 1 M odrzuconej próby):** skany wszystkich kroków STOP 0, przeciek 0. Pierwsza
    próba nowego w f-b8374c8 `killed` po 602 s: `claude -p` kończy sesję po 600 s zadań w tle („Background tasks still running after 600s; terminating”)
    i zabija workflow — pilot (349/405 s) był poniżej progu. Naprawa: `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` w środowisku sesji testu
    (`test_review_sesja.srodowisko()`, test), wznowienie tym samym poleceniem (stary pominięty). Mutanty w 4 z 7 faz (303ff62, 1de5a4c, 2536643:
    wrześniowy Stryker padł na czerwonym teście bazowym — ten sam brak u obu); ESLint `porazka` w każdej fazie (stary kod vs ostrzejsza konfiguracja
    szablonu, ten sam blok u obu).
    (c) **Wynik (`dane/test-review/p11-wynik.txt`, sędzia p1, szeroko):** klucz 2 stary 38/44 / nowy 35/44 = −6,8 pkt [−20,5; +4,3] (PEŁNE 31 = 31);
    klucz 1 17/36 / 19/36 = +5,6 pkt [−4,5; +18,5]; koszt znajdowania 19,13 → 15,81 M (**−17,4%**), na złapany klucz 0,348 → 0,293 M; P1/P2 razem
    109 → 151. Nowy gubi 5 kluczy 2 (po jednym na oś starego: correctness — Zod odrzuca cały beacon, b26128d K2; performance — O(n) limitera, CZĘŚCIOWE,
    b8374c8 K6; security — cache bez limitu bajtów, b8374c8 K10; test-coverage — zależność od migracji, CZĘŚCIOWE, 46be55a K2; spec — strefa czasowa
    daty ważności, P1, 46be55a K12), zyskuje 2 (performance — budżet limitera, b26128d K8; correctness — połknięty błąd odczytu, 303ff62 K2).
    Per oś (klucze osi / stary / nowy / strata realna / przeniesione): code-quality 8/5/3/0/5, correctness 10/3/8/1/1, performance 10/9/6/1/3,
    security 13/9/7/1/5, spec 9/7/4/1/4 (jedyne CI całe poniżej zera: −33 pkt [−86; −6] — głównie przeniesienia), test-coverage 14/10/11/1/2.
    Koszt per oś niższy wszędzie poza code-quality (2,29 → 2,72 M, +19%, bez realnej straty). Security „cichszy”: 22 findingi vs 39 (P1/P2 11 vs 24),
    oś łapie 9 → 7, realnie −1 — nie strata rzędu A (16 → 8). Szum test-coverage: 94 findingi / 80 P1/P2 vs 53 / 30, z czego 39 z mutantów (23 pliki).
    (d) **Decyzje operatora:** wszystkie 6 nowych plików ról zostaje (security bez odwrotu do minimalnej formy z pkt 64 c — brak straty); test-coverage
    grupuje findingi z mutantów per plik: mutanty Survived jednego pliku testu = jeden P2 TEST na linię pierwszego testu, mutanty NoCoverage jednego
    pliku produkcyjnego = jeden P2 TEST na linię pierwszego z nich, z listą id i asercją dla każdego (`e9ef1d8`, test `mutanty-test-coverage.test.mjs`;
    bez ponownego ślepego testu — sprawdził smoke).
    (e) **Ręczne mutanty w drzewie roboczym (pkt 65 d):** detektor `test_review_p11.zapis_drzewa` (edycja w miejscu poza /tmp, `cp` z powrotem,
    przekierowanie do pliku projektu, `git stash`/`restore`/`checkout --`; treść cudzysłowów i heredoców, cele przez zmienną i po `cd` do scratchpadu
    pomijane — każde z tych wykluczeń z fałszywego trafienia w tej sesji, test na każde). W 7 fazach: stary security 1× (`sed -i` w `events.ts`, b26128d),
    nowy correctness 1× (plik próbny w `apps/server/dist/`, ignorowany przez gita, usunięty przez agenta, b8374c8). Nowy security robi mutanty na kopii
    w scratchpadzie (2536643). Bez zmiany plików ról — obserwacja do telemetrii P16.
    (f) **Smoke** (kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P11-oferty-online`, oferty `eb63043`): skrypt P0 z `--env` → kod 7 na
    11 testach `opublikuj-oferte.test.ts` → commit środowiska odtworzony ręcznie (`5e64d1b`: `vi.setSystemTime(NOW)` po `EXPIRES_AT`, `TIME_LIMIT_MS`
    200 → 1000 w `markup-scan.test.ts`; kopie P10 usunięte, więc bez `format-patch`), linia „Źródła prawdy” w CLAUDE.md w brzmieniu z P10 (z transkryptu,
    `96a6f50`) → baza zielona. Konwersja (sesja operatora w kopii, `7168502`): 38/38, 0 odrzutów, indeks 38 wpisów 19 427 zn, `bledy: []`.
    **Run `wf_18c9ceff-8ad`:** OK, CZYSTE, **1,93 M (−13% vs R-P10)**, 25 agentów, 15 min; etap review 0,45 → 0,39 M, fix 0,38 → 0,19 M; 6 reviewerów
    (opus high 9 → 6, medium 12 → 14 — spec i test-coverage `medium`); review: 5 findingów po dedupie, 2 P2 TEST potwierdzone (2 AGREE) i naprawione,
    3 P3 do known-issues; K-1…K-7 i bramki 0; test-coverage zgrupował 6 mutantów w 2 findingi (Survived per plik testu, NoCoverage per plik produkcyjny),
    M2 równoważny bez findingu; wycinek reviewerów 1 278 zn / 3 wpisy / 0 pominiętych (limit 2000 zn z pkt 61 g wystarczył); compound: solution
    `test-niefalsyfikowalny`/`regula`, indeks zapisany. Odczyt: `dane/smoke-P11.txt`. → **nowa referencja R-P11 = `wf_18c9ceff-8ad`.**
    (g) **Do następnych paczek:** P12 — ślepy test builderów może wziąć harness P11 (nakładka `.claude`, sesja bez limitu 600 s, detektor zapisu
    drzewa); P16 — telemetria szumu P1/P2 test-coverage po grupowaniu i zapisów reviewerów w drzewie roboczym (wzorzec z (e)). Kopia
    `_smoke-P11-oferty-online` czeka na decyzję operatora; `~/test-review/` zostaje do P12.

67. **P12 SESJA 1/5 — PODZIAŁ + CODING-RULES (2026-10-06). Gałąź `popr/P12-buildery` z main (`20c1091`), NIEZMERGOWANA.** Commit `6da298e`.
    pnpm 585/585 (+7), typecheck i lint zielone; `pa_dodane.py main` na regułach, autopilocie, dev-pr-wf i owasp: 0 (pierwsza wersja progu „do 360
    linii” dawała `1b-kadencja-limit-slow` — przepisane).
    (a) **Podział P12 (zaakceptowany: „oki, tak jak piszesz”):** S1 coding-rules + odbiorcy; S2 test warstwy stałej dla builderów (czerwony najpierw)
    + wspólny szkielet buildera (mandat, `## Polecenia`, bez drugiego formatu raportu obok `BUILD_RESULT`, samosprawdzenie na plikach IU
    `tsc --noEmit` + `vitest related --run` — D7-1, pytanie „undefined”, jawny odczyt coding-rules) + `feature-builder-data` od zera + skille
    `security` (reguły implementatora, protokół audytu poza `skills:`, PA-24), `sentry-integration` (H39, PA-17), `supabase-dev-guidelines` (stała /
    referencyjna); S3 `feature-builder-ui` i `-fullstack` (+ warianty `-figma` tą samą treścią) + `tailwind-react-guidelines`, `ux-ui-guidelines`
    + PA-44 + D10 (moduł w `.claude/scripts/wiedza/`: zdania „co robić zamiast” dla klas zapobiegalnych, dobór po plikach IU, kolejność wg liczby
    solutions klasy; rozszerzony wynik `wiedza.mjs wycinek`, jeden blok ≤ 2000 zn) + pełne `pa_*.py` w obie strony + README; S4 harness ślepego
    testu builderów (z P11: nakładka `.claude`, bez limitu 600 s, detektor zapisu drzewa; nowe: kopia na bazie fazy, wariant = execute-wf swojego
    `.claude`, potem bramki i ten sam review z main dla obu, sędzia na kluczu fazy z neutralnymi etykietami, przestrzeganie instrukcji z transkryptu;
    fazy wybrane skryptem po klasach D10 w kluczu 2) + suchy bieg + pilot 1 faza; S5 druga faza (decyzja po pilocie) + decyzje + smoke vs R-P11 + merge.
    **Koszt testu** (przeliczony, wyżej niż D-1 10–15 M): na fazę 2 × build (execute oferty mediana 3,3 M/faza we wrześniu, po allowliście ~2 M)
    + 2 × review wyniku (~2,3 M wg P11) + sędzia ~0,2 M ≈ 8–10 M; 1 faza ≈ 9 M, 2 fazy ≈ 18 M; smoke ≈ 2 M.
    (b) **Operator przekazał ocenę coding-rules** („nie mam wiedzy problemistycznej… chciałbym, żebyś ty to ocenił”) → tabela 113 wierszy
    (`P12-CODING-RULES.md`), niezależna recenzja subagenta (Opus; 22 uwagi, wszystkie przyjęte), decyzje Claude'a w sekcji „Decyzje” tego pliku.
    Najważniejsze odstępstwo od planu: test „reguły przeniesione do lintu nie występują w tekście” ZASTĄPIONY testem „progi w tekście = progi ESLint,
    jeden blok” — oferty-online nie ma ESLint z szablonu, więc usunięcie reguły z tekstu kasowałoby ją bez zastępstwa.
    (c) **Treść (`6da298e`):** bez numerów sekcji i wersalików; blok „Pilnuje ESLint i bramki domknięcia” (360/60 TS/TSX, `any`, pusty catch, `console`,
    importy, cykle, promise'y, nieużywany kod, asercje); usunięte: tabela 10 anty-patternów, quality gate, filozofia review (jest w code-quality),
    duplikaty; jeden próg wydzielania (trzecie użycie; stała i kontrakt od razu); wyjątek dla zielonego testu niefalsyfikowalnego + pytanie
    „undefined”; zakres zmian: bez luzowania bramek i wyłączeń w linii, compound pisze wiedzę wg skilla (PA-26 c); commit na prośbę operatora albo
    workflowu; async: abort albo flaga `ignore`, limit czasu bez łączenia sygnałów, `useActionState`, Compiler z wyjątkiem; bezpieczeństwo: rola
    z tabeli ról albo `app_metadata` serwera, `(select auth.uid()/auth.jwt())`, `TO <rola>`, `security definer` z `search_path` i EXECUTE, granica
    API (pełny zakres wejść, `z.strictObject`, walidator Hono z kopertą), limity OWASP API4; tsconfig `verbatimModuleSyntax` (+ `erasableSyntaxOnly`
    w nowych). Rozmiar 10,9k zn (bez zmian — usunięcia = dopisane Supabase/Hono/React).
    (d) **Ładowanie:** `paths:` `**/*.{ts,tsx,js,jsx,mjs,cjs}`, `**/*.sql` (ścieżka bez zmian → bot, sync, telemetria bez migracji); `paths:` działa
    tylko przy Read/Edit, więc odbiorcy czytają plik jawnie: fix autopilota (`fixPrompt`, zamiast „coding-rules §2”) i etap `napraw` dev-pr-wf
    (ten commit), buildery — S2/S3. **Kryterium smoke'a P12:** `rules_zn` = 0 u ról bez kodu (haiku, orkiestracja, scribe, compound), > 0 u builderów
    i fixa; ≈ 2 × rozmiar = podwójny odczyt → jedno źródło wypada. Odwrót: usunąć frontmatter.
    (e) **Odbiorcy:** owasp (`§4` → sekcja), komentarz ESLint (próg = coding-rules, pilnuje test), `testy-usuniete.mjs` (wyjątek), komentarz testu
    `metryki-w-stanie`, README (3 miejsca). `.coderabbit.yaml` i `CODING_RULES` bez zmian (ścieżka ta sama). Test `coding-rules.test.mjs`: paths,
    progi = ESLint, usunięte bloki, jeden próg, bez numerów i wersalików, odwołania w `.claude/` bez „coding-rules §N”.
    (f) **Do S2/S3 z recenzji:** bezwarunkowy zakaz `useMemo`/`useCallback` w builderach (`feature-builder-ui.md:55`, `-fullstack.md:69`) i
    `tailwind-react-guidelines/SKILL.md:42` → warunek Compilera jak w regułach; `supabase-dev-guidelines/resources/security.md:96` i `auth-patterns.md:290`
    (`security definer` w `public`) → zgodnie z regułą (`search_path`, EXECUTE). **Poza P12 (ESLint szablonu, P16):** globy `PREZENTACJA` nie
    obejmują `apps/*/src/features/<x>/*.tsx`, `no-non-null-assertion` tylko `warn`, `.catch(() => {})` przechodzi `no-empty`.

68. **P12 SESJA 2/5 — BUILDER DANYCH + SKILLE DANYCH (2026-10-06). Gałąź `popr/P12-buildery`, NIEZMERGOWANA.** Commity `c9742d3` (builder
    + test szkieletu), `0d388de` (skille), `8d175d6` (poprawki po recenzji). pnpm 604/604 (+19), typecheck i lint zielone; `pa_dodane.py main`
    na builderze, `dev-docs-execute-wf.js` i wszystkich zmienionych plikach skilli: 0 (pliki nowe przez `git add -N`, inaczej diff ich nie widzi;
    przeniesiony tekst liczy się jako dodany — „Krok N”, wersaliki, `scope` w protokole audytu i resources poprawione w miejscu).
    (a) **`feature-builder-data.md` od zera:** mandat 2 zdania, `## Wejście`, jeden blok `## Polecenia` (15 pozycji), bez `<examples>`
    i bez drugiego formatu raportu — wynik tylko w polach `BUILD_RESULT` (`id`, `status`, `pliki`, `odchylenia`, `nastepneKroki`, `pytanie`).
    Jawny Read `.claude/rules/coding-rules.md` przed pierwszą zmianą; samosprawdzenie na plikach IU: typecheck skryptem z package.json albo
    `tsc --noEmit -p <tsconfig obejmujący pliki IU>`, `vitest related --run`, ESLint, `deno check`/`deno test` dla `supabase/functions/` (D7-1);
    pytanie „undefined” odwołaniem do sekcji Testowanie (bez kopii treści); `blocked` tylko gdy zamówiona operacja nie ma „kto”; warunku polityki
    i schematu nie luzuje pod test; odstępstwo od reguły bezpieczeństwa = `blocked`; nowa migracja zamiast edycji; `supabase status`, bazy nie
    uruchamia sam, `db reset`/`test db` w tle; **brak lokalnej bazy albo Deno = wpis w `odchylenia`, nie `partial`** (autopilot STOP-uje przy
    każdym statusie ≠ `completed`, `dev-autopilot-wf.js:1588` — wykryte przy weryfikacji poprawek). Rozmiar 5,5k → 7,0k zn.
    (b) **Test szkieletu** `szkielet-buildera.test.mjs` (lista `BUILDERY_ZE_SZKIELETEM`, dziś data): odczyt reguł, samosprawdzenie, „undefined”,
    każde pole `BUILD_RESULT` (czytane z workflowu) nazwane w poleceniach, brak bloku kodu / `## Raport` / `**Status:**`, brak tokenów reguł kodu
    (`auth.uid()`, `strictObject`, `search_path`, `AbortSignal`, `eslint-disable`, `toBeDefined`, `user_metadata`, `` `any` ``); skille z `skills:`
    wszystkich builderów bez znaczników protokołu audytu; `SKILLE_BEZ_WERSALIKOW` (security, sentry, supabase) bez krzyku poza kodem;
    planner: IU z migracją = serial. `feature-builder-data` w `ROLE_Z_WARSTWA`.
    (c) **security (PA-24):** `SKILL.md` = reguły implementatora (RLS w migracji tworzącej tabelę, polityki per operacja, `with check` nie słabszy
    niż `using`, `update` + `select`, kolumny chronione `revoke update on tabela` + `grant update (kolumny)`, `security_invoker`, `format()`,
    Storage, tożsamość z tokenu, klucz sekretny z kontrolą w kodzie, tryby `auth`, fail-closed, podpis webhooka, Zod `.max()`, SSRF, XSS, testy
    odmowy) bez powtórzeń sekcji Bezpieczeństwo reguł kodu. Protokół audytu w całości → `resources/protokol-audytu.md` (wagi = P1–P3, „Kiedy”
    zawężone do audytu, nowe pozycje). Skill dalej prowadzi audyt na prośbę (`/security`).
    (d) **sentry (PA-17, H39):** H39 przechodzi `git apply --check`, wszedł jako TREŚĆ — jego zasada 2 („`console.error` + `captureError`”) przeczy
    regule bez `console.*`, zasada 1 bez wyjątku dla odmów = nadgorliwość z PA-17. Pięć zasad z powodem: nieoczekiwany błąd → Sentry, odmowa →
    `logger.info`; Edge Functions `await captureError`, `console.*` tylko w helperach `_shared/` (`logger.ts` dopisany do resources); użytkownik
    tylko przez `id` (email maskuje `beforeSend` jako siatka); kontekst bez sekretów; poziom wg skutku. `userClaims.id` zamiast `.sub` (błąd
    przykładu: `user_id: undefined`; poprawione też w `auth-security-patterns.md`).
    (e) **supabase:** `SKILL.md` = checklisty + 4 zasady z powodem + nawigacja (10,7k → 4,7k zn); klient, operacje, przegląd tematów, zmienne
    i częste błędy bez skracania → `resources/klient-i-przeglad.md`. Sprzeczności z regułami poprawione (`auth.uid()` wprost, `select('*')`,
    przykłady Edge Functions z `{ error: message }` → koperta + `captureError`). **`security definer` (6a pkt 67 f):** REVOKE/GRANT EXECUTE po
    wszystkich 9 funkcjach w resources (nie tylko 2 z listy) + `get_secret` w owasp; `PERFORM public.log_audit_event` (pusty `search_path`).
    Plik typów `database.types.ts` (konwencja Supabase, ignorowany przez knip/ESLint szablonu; ręczne typy w tailwind zostają `database.ts`).
    (f) **Workflow:** `nastepneKroki` builderów ginęły (domknięcie dostawało tylko `id/status/odchylenia`) → w raportach dla domknięcia i w
    `## Dziennik`; planner: IU z migracją albo typami bazy = serial (wspólna lokalna baza i plik typów); punkt 1b domknięcia: nieoczekiwany
    błąd → Sentry, odmowa → log bez zdarzenia.
    (g) **Wstrzykiwane builderowi danych na starcie:** plik roli + 3 SKILL.md 32,2k → 27,8k zn (−14%); do tego jawny odczyt coding-rules (~11k).
    (h) **Recenzja:** Opus general-purpose, 25 uwag, 24 przyjęte (odrzucona: sprawdzenie tokenów reguł na skillach — `auth.uid()` w przykładach
    SQL to treść), weryfikacja poprawek tym samym agentem → 3 domknięte niepełnie + 1 nowy problem (`partial` przy braku bazy), poprawione.
    (i) **Do S3:** `BUILDERY_ZE_SZKIELETEM` += ui, fullstack, oba `-figma` (ta sama treść; `klasy-rol.test` pilnuje zgodności wariantu);
    `SKILLE_BEZ_WERSALIKOW` += tailwind, ux-ui; zakaz memo w `feature-builder-ui.md:55`, `-fullstack.md:69`, `tailwind-react-guidelines/SKILL.md:42`
    → warunek Compilera (6a pkt 67 f); blok „Wymagania wykonania” w `plannerPrompt` dubluje teraz builder danych — usunąć, gdy wszystkie buildery
    mają szkielet; D10 nie dubluje „nowa migracja zamiast edycji” (jest w warstwie stałej buildera danych); fullstack bierze z buildera danych
    reguły statusu, `odchylenia`/środowiska i sekcje skilli. **Poza P12:** bramka `tsc.mjs` (`-p tsconfig.json`) przy tsconfig z samymi
    `references` sprawdza zero plików i daje `ok`; `EXECUTE_RESULT.odchylenia` nie czyta autopilot (zapis tylko w dzienniku).

69. **P12 SESJA 3/5 — BUILDERY UI/FULLSTACK + SKILLE UI + D10 (2026-10-06). Gałąź `popr/P12-buildery`, NIEZMERGOWANA.** Commity `eaf7a57`
    (buildery + test), `d688ad5` (D10), `17da963` (coding-rules, osobny revert), `37dfaad` (SKILL.md UI), `4af828a` (README), `b78186c` + `ee82cc6`
    (resources runda 1), `bf20439` (poprawki po recenzji), `66f0652` (resources runda 2), `46e743c` + `b27830a` (po weryfikacjach). pnpm 626/626 (+22),
    typecheck i lint zielone; `pa_dodane.py main` na wszystkich zmienionych plikach z promptem: 0 (trafienia tylko w stałych testu).
    (a) **Buildery:** `feature-builder-ui.md` (8,99k zn, 18 poleceń) i `-fullstack.md` (11,7k, 25 poleceń) od zera wg szkieletu buildera danych;
    warianty `-figma` = frontmatter + ta sama treść (`klasy-rol.test`). Kroki Figmy warunkowe (blok kontekstu designerskiego + narzędzie
    `get_design_context`; bez narzędzia brak pomiaru → `odchylenia`, nie `partial`). UI: dane tylko przez hook/serwis z repo albo z bloku plików
    innych IU (inaczej `blocked` — builder UI nie ma reguł warstwy danych), stany ładowania/pusty/błędu i gałąź odrzucenia operacji asynchronicznej,
    checklista dostępności skilla ux-ui, teksty dosłownie, tokeny zamiast wartości arbitralnych, memoizacja odwołaniem do Async i React + checklisty
    Memoizacja skilla (6a pkt 67 f). **PA-44: wzięte** — nazwane style do unikania (gradient fiolet–niebieski, glassmorphism, emoji jako ikony,
    hero z trzema kartami, jednakowe zaokrąglenie z cieniem, neon na ciemnym) tylko dla widoku bez SPEC.md i DESIGN.md. Fullstack = reguły danych
    jak builder danych + reguły UI, kolejność od kontraktu (Zod) do widoku. Zakres (wszystkie trzy): pliki, `[Unit]`, pole Weryfikacja bez `[E2E]`
    (pełny zestaw/budowanie zastępuje samosprawdzenie), `[E2E]`/`[Manual]` = tester i operator (seed z pola Pliki).
    (b) **Planner:** blok „Wymagania wykonania” usunięty (treść w szkielecie, test negatywny); z bloku designerskiego wypadła kolejność źródeł
    i polecenie Figmy (rozstrzyga builder), placeholder DESIGN.md „brak”; nowy blok „Pliki innych jednostek tej fazy:” + serial, gdy IU używa pliku
    tworzonego przez inny IU (recenzja P1: builder UI zwracał `blocked` na hooku z IU danych, którego nie widzi → STOP poprawnego runu).
    (c) **D10 (`.claude/scripts/wiedza/zapobieganie.mjs`):** 11 klas ze zdaniem „co robić zamiast” (dopasowanie-tekstu, bramka-czarna-lista,
    pii-i-sekrety, bramka-na-jednej-drodze, wyścig, ścieżka-błędu, wartość-graniczna, limit-czasu-i-ponowień, zaufanie-danym-klienta,
    migracja-bazy, seed-e2e); `POKRYTE` = 8 klas pokrytych warstwą stałą/regułami kodu (test: fraza stoi we wskazanych plikach). Dobór po globach
    plików IU; kolejność: liczba solutions klasy w projekcie → węższy glob przed szerszym → tabela. `wiedza.mjs wycinek --zapobieganie`: reguły
    projektu najpierw, zdania w pozostałym limicie, jeden blok ≤ 2000 zn, zdanie klasy z regułą w wycinku wypada; bez flagi wynik bez zmian (review,
    dossier, fix, /dev-pr, telemetria wycinka). Przykładowo: czysty IU UI 3 zdania (~0,85k zn), czysty SQL 5 (~1,35k), Edge Function + migracja
    + serwis 7 (~1,85k, reszta odcięta limitem).
    (d) **coding-rules (`17da963`):** wyjątek od jawnego typu zwracanego dla komponentu React i hooka zwracającego wynik hooka biblioteki — bez
    niego ~100 przykładów skilli UI było sprzecznych z regułą (ESLint szablonu jej nie sprawdza).
    (e) **Skille UI:** SKILL.md = checklisty + zasady z powodem + nawigacja (tailwind 6,6k → 5,7k; ux-ui 11,1k → 7,7k: checklista dostępności, na którą
    wskazują buildery; cel 24 px AA / 44 px `pointer-coarse`; dialog Radix albo `<dialog>`; zasada animacji transform/opacity, stan przez
    filter/cień/kolor, układ tylko przez `interpolate-size`); przewodnik czytany sekcją (grep nagłówków + offset), bo `resources/` mają 15–45k zn.
    `resources/` (21 plików, 337k → 507k zn — przykłady poprawne są dłuższe): przegląd subagenta ~200 pozycji → 5 wykonawców na rozłącznych plikach
    wg wspólnych rozstrzygnięć → recenzja pomocników (tailwind 22 uwagi, 4 P1 „nie kompiluje się”; ux-ui 25, 6 P1) → 2 wykonawców wg tabeli kanonów
    (jedna definicja, reszta importuje/linkuje: `@/lib/api` `request()`, `@/lib/errors`, `@/schemas/*-schema`, `@/services/*-service`,
    `@/hooks/use-templates`, `use-toggle-favorite`, `ErrorFallback` `UI_BOUNDARY`, `EmptyState`, `AsyncButton`, `ConfirmDialog` na AlertDialog,
    tokeny w `design-system.md`); kluczowe wzorce sprawdzone `tsc` strict na prawdziwych typach (zod 4.3, RHF 7.72, TanStack Query 5.99, TS 5.9;
    środowisko próbne w scratchpadzie z node_modules `miter/baiker`). Logger = `sentry-integration` (`logger.error('KOD', error)`).
    (f) **Warstwa stała na starcie:** builder UI rola + 2 SKILL.md 24,0k → 22,4k zn (−7%); fullstack rola + 5 SKILL.md 45,1k → ~46,7k (+4%: rola
    6,6k → 11,7k); do tego jawny odczyt coding-rules (~11k) i blok reguł + D10 ≤ 2k w prompcie IU.
    (g) **Prompt-audit w obie strony (`dane/pa-sygnaly-po-P12.{txt,json}`, `dane/pa-kontrola-po-P12.txt`):** sygnały 584 (po P3) → 403; w 10 plikach
    builderów i reviewerów 0; w skillach UI 1 (fakt o `text-wrap: balance`, nie polecenie). Raport → repo: 33 cytaty zniknęły razem z pozycjami
    zamkniętymi w P1–P12; 5 zostało — wszystkie w plikach P13/P14 (`dev-docs/SKILL.md:9,112`, `dev-plan/SKILL.md:9`, `dev-docs-review-wf.js:445,447`).
    Skrypty na kopii w scratchpadzie (`pa_kontrola_ok.py` = wariant z wypisaniem cytatów OK).
    (h) **Recenzja:** Opus general-purpose z dwoma pomocnikami; A–D, F: 18 uwag (1 P1, 6 P2, 11 P3) — przyjęte 17, odrzucona 1 (`use_figma`
    i `figma:figma-use` w `-figma`: decyzja operatora z 6a pkt 47 d); resources: 47 uwag, wszystkie P1/P2 domknięte. Weryfikacja 1: 14/17 + 30/30,
    nowe 2 P2 + 5 P3 → poprawione; weryfikacja 2: 9/9, nowe 5 P3 → poprawione. Uwaga 9 zostaje świadomie: trzy zdania D10 częściowo zbieżne ze skillem
    security (inny przedmiot: wartości generowane, wszystkie drogi do operacji, parsery poza URL).
    (i) **Poza P12:** `dev-plan/SKILL.md:478` twierdzi, że `feature-builder-ui` i `-fullstack` „zawsze mają figma skille” (od P3 tylko warianty
    `-figma`) → P13. Telemetria nie ma pola „zdania D10 w prompcie IU” — S4 czyta je z transkryptu. `resources/` UI +50% zn: koszt pojawia się tylko,
    gdy builder czyta przewodnik — do pomiaru w S4.
    (j) **Do S4:** wybór faz skryptem po klasach D10 w kluczu 2 (`ZDANIA` w `zapobieganie.mjs`) i po IU UI/fullstack; w harnessie mierzyć z transkryptu:
    odczyt coding-rules, samosprawdzenie na plikach IU, pytanie „undefined”, obecność i zastosowanie zdań D10, odczyt `resources/` sekcjami
    (znaki), statusy i `odchylenia`, użycie bloku plików innych IU; ctx_start i koszt buildera vs stary; P1/P2 review na fazę. Koszt testu (6a pkt 67 a):
    1 faza ≈ 9 M.

70. **P12 SESJA 4/5 — WYBÓR FAZ + HARNESS ŚLEPEGO TESTU BUILDERÓW + PILOT (2026-10-07). Gałąź `popr/P12-buildery`, NIEZMERGOWANA.** Commity: 3b1bef1
    i 6e0162b (wybór faz), c7598cf (D10 — globy, osobny revert), dd3a412 (harness), ed7d272, 1c4ceb0, ff5b196, a23e7c1, e43eb2c (poprawki po recenzji
    i dwóch weryfikacjach), 19e4a64 (dane pilota). pnpm 627/627 (+1), typecheck i lint zielone; harness `python3 -m unittest discover -s skrypty -p
    "test_review_p12*_test.py"` 39 testów; test P11 „stary z main” przypięty do `7b7cbcd` (main ma już reviewerów P11 — test padał).
    (a) **Wybór faz** (`skrypty/test_review_p12_fazy.py` + test → `dane/test-review/p12-fazy.{txt,json}`): kandydaci = 13 kopii `f-*`; klasa klucza 1
    ze słownika It. 1, klucza 2 — subagent na tym samym słowniku (`dane/test-review/p12-klucz2-klasy.json`, 63 pozycje, 3 o niskiej pewności).
    **Baza buildu ≠ `baza` z `test-review-fazy.json`:** tamta to commit sprzed REVIEW (w f-32975a1 obejmuje dwie fazy, w f-1de5a4c po implementacji są
    commity docs/.claude) — baza buildu = rodzic ostatniego commita `feat` w zakresie. **Klucz „osiągalny”** = IU, którego pole Pliki planu obejmuje
    plik klucza (także katalogiem), dostaje w bloku D10 (limit 2000 zn) zdanie klasy klucza. Wynik: z 34 kluczy D10 w zakresie 22 osiągalne, 6 w plikach
    spoza planu (builder dopisał plik — np. f-46be55a: migracja K2/K4 to właśnie defekt „zbędna migracja”), 6 w planie bez zdania klasy w bloku.
    f-32975a1 (pierwszy w rankingu po samym kluczu 2): 3 klucze D10 w `offer-heatmap-frame.tsx`, żaden osiągalny → odpada jako pilot.
    (b) **D10 `c7598cf`:** `KLIENT_DANYCH` += `**/use-*.ts`, `**/*-api.ts`, `**/*-service.ts` (hooki i klienci API w folderach funkcji; 3 klucze
    stały się osiągalne). Recenzja (u7): część to dopasowanie in-sample (f-5af000f K2/K7, f-303ff62 K12), glob łapie `use-x.test.ts`, a IU UI z jednym
    hookiem traci przez limit zdanie `wyscig-i-wspolbieznosc` na rzecz zdań o bramkach — **decyzja S5** (pilot potwierdza wypieranie: K11 niżej).
    (c) **Harness** (`skrypty/test_review_p12{.py,_cli.py,.sh,_transkrypt.py}`, `_sedzia_szablon.js`, `_suchy_bieg.mjs`, kroki `p12-build|review|sedzia-p<N>`
    w `test_review_sesja.py`): `.claude` stary = main (`81b7556…`), nowy = gałąź (`7bdab43…`) z `git archive` → `~/test-review/p12/claude-<w>/`.
    Kopia wariantu `~/test-review/p12-kopie/<et>/<w>` = klon APFS kopii fazy, HEAD = baza buildu na gałęzi `test-p12`, inne refy, reflog i obiekty
    usunięte (wszystkie commity baza..sha nieosiągalne — kontrola), artefakty ignorowane z przyszłości usunięte (dist, `node_modules/.vite`,
    `.vite-temp`, `.cache` — jiti trzymał skompilowany `vite.config` z 26.09), `packages/shared` zbudowany na bazie. Wariant buildu = CAŁE
    `dev-docs-execute-wf.js` swojego `.claude` w funkcji z args wklejonymi (kontrola bajtowa); review = `dev-docs-review-wf.js` z main ucięty przed
    Verify (P11) z dossier z main na bramkach z domknięcia wariantu. Sesja buildu: zapis tylko w swojej kopii, deny Read/Edit/Write na resztę testu,
    Documents i `~/.claude`; na czas SESJI chmod 000 na cały `~/test-review` poza własną kopią, `p12/<et>` i `sesje/<et>` (Bash omija deny, `../`
    nie da się wyłapać regexem — wewnątrz kopii to zwykłe importy i `cd`); zrzuty `/tmp` fazy (bramki, review-diff/ctx) i pliki `/tmp` z okna buildu
    przenoszone do `<w>-pliki`. Skan: przeciek (ścieżki deny, `~`/`$HOME`, `../<inny>`, `../<katalog testu>`, slug scratchpadu drugiego wariantu,
    `file-history`, `/tmp/review-` od korzenia ścieżki), model, N1, kopia (commity z przyszłości, HEAD z bazy, nakładka, review nie zmienia drzewa);
    werdykt w `p12/<et>/skan-<krok>-<w>.json` — wznowienie pomija krok tylko przy kodzie 0. Sędzia (Opus high, jeden przebieg): klucz fazy w zakresie
    i obecny wg sędziego P11, treść bez hashy, linii, statusów i następnych findingów; implementacje A/B/C (stary, nowy, HISTORYCZNY — permutacja
    z fazy) jako `zmiany.diff` + `pliki/`; ocena OBECNY / ZAPOBIEZONY / BRAK_ODPOWIEDNIKA per (K, implementacja); czułość = OBECNY na historycznym.
    Metryki z transkryptu: bloki promptu IU (D10 i klasy, reguły, pliki innych IU, granice, stare „Wymagania wykonania”), coding-rules (Read, Bash,
    załącznik po ścieżce), resources (Read sekcjami, znaki, Bash), samosprawdzenie (tsc, vitest related / na plikach / pełny — tylko segmenty-komendy),
    „undefined” (tylko tekst — myślenie w transkrypcie jest puste), wynik BUILD_RESULT, ctx_start i koszt (`panel_koszt_dane.sklad`), czas.
    Kolejność wariantów: `p12/<et>/kolejnosc.json` albo hash fazy (hash dawał „nowy” pierwszy w 9 z 13 faz).
    (d) **Recenzja** (Opus general-purpose): 15 uwag (3 P1: fałszywy przeciek przy każdym buildzie, wznowienie bez werdyktu skanu, regex bez ścieżek
    względnych; P2: sędzia padał na `.webp`, prompt zdradzał kod historyczny, metryki złe na realnym formacie, D10 in-sample, dziury w deny,
    reset z resztkami próby, node_modules z epoki sha) — wdrożone poza u7 (S5), u11/u15 (kolejność z pliku jest; nazwy katalogów zostają);
    weryfikacja 1: 10/15 domknięte + 2 nowe (P1 otwarte `_mirror`/`dossier`, P2 `/tmp` builda) + 5 P3 → poprawione; weryfikacja 2: 1–7 domknięte,
    nowe P2 (`p12`/`sesje` innych faz) + 2 P3 → poprawione (e43eb2c, bez trzeciej weryfikacji).
    (e) **Pilot f-1de5a4c** (szablony i grafiki, faza 6, IU-13 data, IU-14/16 fullstack-figma, IU-15 ui-figma; zgoda w instrukcji sesji): build nowy
    `wf_98e50b92-5ac`, stary `wf_05bd1408-c4d`, review `wf_0ab443e6-30d` / `wf_4c4e1a73-311`, sędzia `wf_4d68f40d-081`; skany STOP 0, przeciek 0
    (po poprawkach: trzy fałszywe przecieki harnessu, ręczna kontrola transkryptów nowy — 0 odwołań poza kopią). Build nowy szedł na harnessie
    sprzed poprawek (bez chmod), budował pierwszy, kopia stary nietknięta — recenzent: nic nie faworyzowało wariantu. Wynik (`dane/test-review/p12-wynik.txt`):
    sędzia 10 kluczy (D10 3, pokryte 4, inne 3; K6 wypadł — NIEPEWNE u P11), **czułość 10/10**, oceny sprawdzone przez recenzenta w kodzie (trafne).
    **stary i nowy O/Z/B 4/6/0 oba** (remis): D10 stary 1/2, nowy 0/3 (K8 tylko nowy — `ALLOWED_LINK_PROTOCOLS`, ruch ze zdania `bramka-czarna-lista`);
    pokryte stary 1/3, nowy 2/2 (K11 tylko stary — `includes` bez `toLowerCase`; klasa merytorycznie `dopasowanie-tekstu`, której zdanie w IU-14
    nowy UCIĄŁ limit 2000 zn). Review z main P1/P2: stary 6, nowy 5 (kod historyczny wg P11: 14). Build 4,71 → 4,65 M (−1%), ctx_start buildera
    45,1k → 41,8k (−7%), czas 35,7 / 37,0 min; review 2,40 / 2,43 M; sędzia 0,18 M; **pilot ≈ 14,4 M agentów** (szacunek 9 M był zaniżony — build
    ≈ 4,7 M na wariant, nie ~2 M). Przestrzeganie: nowy coding-rules Read 4/4 (stary — załącznik w każdym agencie, main ładuje reguły wszystkim),
    D10 w prompcie 4/4 (7 klas), granice 4/4, vitest related 4/4 (stary 0/4), pełny zestaw w builderze 2/4 (stary 4/4), resources 0 odczytów
    u obu, statusy completed 4/4 u obu, odchylenia 4/4 u obu. Warianty UI/fullstack w obu = `-figma` bez MCP (sesja `--strict-mcp-config`).
    **Wniosek:** dzisiejszy pipeline z main omija już 6 z 10 historycznych defektów tej fazy; różnicują 2 klucze — pilot nie ma siły statystycznej.
    (f) **Druga faza S5 (rekomendacja, potwierdzona przez recenzenta): f-b8374c8** (publikacja ofert, faza 2; fullstack + ui; 8 kluczy po filtrze P11;
    K6 `zaufanie-danym-klienta` P2 osiągalny bez `c7598cf`; bez zmian zależności, configu i migracji; diff 1,9k linii ≈ 14 M; faza z zestawu P11);
    kolejność `["stary","nowy"]` już w `~/test-review/p12/f-b8374c8/kolejnosc.json`. Alternatywa f-303ff62 (wszystkie trzy typy builderów, K11 P1,
    13 kluczy) — migracja w fazie, klucz K12 in-sample, ≈ 18–20 M. Odrzucone: f-5af000f (in-sample), f-2536643 (diff 7,2k).
    (g) **Do S5 (decyzje):** u7 — moja rekomendacja przed drugą fazą: z globów D10 wyłączyć `*.test.*`/`*.spec.*`; zdania `bramka-*`
    i `sciezka-bledu` tylko dla serwera, `supabase/`, SQL i serwisów (`*-service.ts`, `*-api.ts`), nie dla hooków UI — wtedy IU UI z hookiem zachowuje
    `wyscig-i-wspolbieznosc`; po zmianie powtórzyć suchy bieg `wycinki`. Kryterium merge'a P12: brak istotnej straty na kluczu (pilot: remis)
    i P1/P2 review nie wyżej; smoke vs R-P11 (`ctx_start` buildera, prompty IU z D10, 0 błędów schematu).
    **Poza P12:** zdania D10 `sciezka-bledu` i `wartosc-graniczna` są sformułowane pod warstwę danych, a te klasy w oferty siedzą też w komponentach
    `.tsx` (15 z 34 kluczy D10 przed `c7598cf` było nieosiągalnych) — osobne zdania UI to decyzja P16 (telemetria klas po PR); 6 kluczy w plikach spoza
    pola Pliki planu → kompletność pola Pliki w dev-plan (P13).

71. **P12 SESJA 5/5 — D10 u7 + DRUGA FAZA ŚLEPEGO TESTU + DECYZJE + SMOKE (2026-10-07). PACZKA P12 ZAMKNIĘTA, merge `--ff-only`
    `popr/P12-buildery` do main; grupa III zamknięta → push (D-2) czeka na operatora.** Commity: dfca1e2 (D10 u7, osobny revert), 1fe93b9 (wynik
    po fazach + drzewa `.claude` fazy), f1db8ea / 9d65540 (sekcja P12 odczytu smoke'a), 1fff725 / 8b86bab (skan: curl na pętlę lokalną), 7110880
    (dane fazy 2 + decyzje), d676e8c (smoke), d779ccd (HANDOFF). pnpm 629/629 (+2), typecheck i lint zielone; harness `python3 -m unittest discover -s skrypty -p
    "test_review_p1[12]*_test.py"` + `skrypty/test_review_skan_test.py` + `skrypty/smoke_p12_test.py`.
    (a) **D10 u7 (`dfca1e2`):** zdania `bramka-czarna-lista`, `bramka-na-jednej-drodze`, `sciezka-bledu` tylko dla `ZAPLECZE` (supabase/, serwer,
    `**/services/**`, `*-service.ts`, `*-api.ts`, SQL) — nie dla hooków UI i `lib/`; pliki `*.test.*`, `*.spec.*`, `__tests__/` nie dobierają zdań.
    Suchy bieg: pilot IU-15 (UI z hookiem) 7 zdań / 2 pominięte → 5 / 0 z `wyscig` i `dopasowanie-tekstu`; IU serwerowe bez zmian (f-b8374c8 —
    oba IU w `apps/server` — dostaje te same bloki). Zmiana kontraktu testu: hook nie dostaje już `sciezka-bledu` (przypięte w c7598cf).
    (b) **Harness:** `przygotuj` zapisuje drzewa `.claude` i commit gałęzi w `p12/<et>/claude.json` (pilot dopisany ręcznie: 7bdab43, D10 z c7598cf);
    `wynik` drukuje drzewa fazy i sumy po fazach per klucz i grupa klas (`test_review_p12_wynik.py` + test). Skan: `RE_SIEC` łapał każde `curl` —
    builder sprawdzał zbudowany serwer `curl` na 127.0.0.1 (oba warianty) → `siec()` liczy adresy z argumentów wywołania curl/wget do końca
    segmentu (adres w heredocu to nie cel), pętla lokalna nie jest siecią, `gh` zawsze; łapie też `$(curl …)` (wcześniej przepuszczał). Dwa
    PRZERWANE po skanie (kod 4), wznowienie tym samym poleceniem bez powtórki buildu.
    (c) **Faza f-b8374c8** (build stary `wf_3d686d28-e17`, nowy `wf_1d646b07-2df`, review `wf_c150873c-349` (nowy) i stary, sędzia `wf_2dd1ea8c-8d0`;
    ≈ 12 M): K 8 (D10 2, pokryte 2, inne 4), czułość 8/8; stary O/Z/B 5/2/1, nowy 4/4/0 (K5 304 bez `immutable` tylko nowy; K3 u starego brak
    odpowiednika — nie zbudował tras favicon/logo); P1/P2 review 14 (P1 1) → 12 (P1 0); build 3,18 → 2,97 M, ctx_start 27,7k → 25,0k.
    **Razem 2 fazy (18 K):** stary 9/8/1, nowy 8/10/0; D10 3/2 → 2/3, pokryte 3/3 = 3/3, inne 3/3/1 → 3/4/0; netto +1 klucz z mechanizmem (K8
    pilota, zdanie D10), reszta w szumie; P1/P2 20 → 17 („nie wyżej”); build 7,89 → 7,62 M (−3%), ctx_start 39,3k → 36,2k (−8%). Przypisanie do
    plików: fullstack K8 + / K11 −, ui K5 + K3 (IU-5 to kod serwera), data 0 → pliki niezróżnicowane, brak straty. Dane: `dane/test-review/p12-wynik.*`,
    `p12-decyzje.txt` (po recenzji), `p12-faza-f-b8374c8.log.txt`.
    (d) **Ustalenia z testu:** K6 `zaufanie-danym-klienta` — zdanie było w prompcie obu IU, defekt (`readClientKey` z XFF w `app.ts` z pola Pliki)
    został u obu = „zdanie było, defekt jest” (pierwszy punkt danych pod próg P16). Wypieranie przez limit 2000 zn jest stałe: bez wiedzy projektu
    IU serwerowy ma 9 kandydatów (≈ 2330 zn) i zawsze traci `dopasowanie-tekstu` i `wyscig` — dokładnie klasy defektów, które zostały (f-b8374c8 K2
    `nowMs` sprzed `await`, pilot K11 `includes`). W projekcie po konwersji (kopia P11, 38 reguł) reguły projektu dopasowane do IU 13–18, mieszczą
    się 4 (1783–1902 zn), **D10 dostaje 0 zdań we wszystkich 6 IU obu faz** — D10 działa w młodych projektach, test mierzył tylko ten reżim.
    Regresja n = 1: pilot, nowy builder fullstack usunął 2 działające testy (blok Z3 `offer-origin-pages.test.ts`), bramka `testyUsuniete`
    przywróciła; stary 0.
    (e) **Decyzje (rekomendacja Claude'a + recenzja Opus 9 uwag, wszystkie przyjęte, żadna nie zmienia decyzji):** wszystkie pliki builderów
    zostają (+ `-figma`); coding-rules z `paths:` zostaje, reguła o usuwaniu testów bez zmian (tekst jednoznaczny, bramka złapała); D10 po u7 bez
    dalszych zmian — odrzucone teraz: `continue` zamiast `break` (zostaje 185 zn), skrócenie zdań (zmienia zdanie K8), kolejność (dopasowanie
    do próbki); **pierwsza opcja P16: osobny limit D10** (np. 2500 zn obok 2000 na reguły; ≈ 650 tok./IU, < 2% ctx_start). Metoda P16: dobór
    D10 liczony wstecz z pola Pliki planu i `docs/solutions` na commicie fazy; próg „klasa ze zdaniem ≥ 3 B P1/P2” tylko na projektach z małą
    liczbą reguł. Poza zasięgiem testu: fixer z regułami przez `paths:` (sprawdził smoke), migracja/RLS/seed (`migracja-bazy`, `seed-e2e`
    nietestowane), `-figma` z MCP.
    (f) **Smoke** (kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P12-oferty-online`, oferty `eb63043`): skrypt P0 → kod 7 jak w P11
    → commity środowiska (`5e64d1b`), linii CLAUDE.md (`96a6f50`) i **konwersji (`7168502`) przeniesione `format-patch` z kopii P11** (P12 nie zmienia
    konwersji ani `dev-compound-refresh`; indeks 38 wpisów 19 427 zn, `bledy: []` — jak w P11) → baza zielona, doctor OK. **Run `wf_47df65c4-56f`:**
    OK, CZYSTE, **1,83 M (−5% vs R-P11)**, 25 agentów, 16 min; review 7 findingów, 2 P2 naprawione, 5 P3 do known-issues, sceptyk 1 CONCERN
    (degradacja), 0 błędów schematu; K-1…K-7 i bramki 0; `testyUsuniete` []; ctx_start: builder 36k → 31k (−14%), naprawiacz −14%, reviewer
    27k → 22k (−19%), orkiestracja opus 25k → 20k (−20%). **Kryterium 67 (d) — zielone w poprawionym brzmieniu:** reguły eager (`rules_zn`) 0 u
    wszystkich 24 ról (R-P11: 21); builder Read 1×, fix przez `paths:`, nikt podwójnie; ról bez kodu z regułami 0. `rules_zn` liczy tylko załącznik
    startowy, więc builder też ma 0 — odczyt mierzy `smoke_p12.py` z transkryptu (Read / Bash / `nested_memory`). **Blok D10 w prompcie
    buildera pusty — zgodnie z projektem:** pole Pliki IU fixture'u obejmuje migrację, 4 reguły projektu SQL zajęły 1864 zn, D10 0 (moja
    zapowiedź „fixture: 2 zdania” liczyła bez testu i migracji — błąd). Kryterium zmienione na „prompt buildera zawiera blok policzony przez
    planner” (spełnione). Odczyt: `dane/smoke-P12.txt`. → **nowa referencja R-P12 = `wf_47df65c4-56f`.**
    (g) **Do P16:** `dedup:semantyczny` (haiku) sam czytał 2 pliki kodu (7 findingów) → Read dokleił coding-rules przez `paths:` → 0,03 → 0,11 M
    (≈ 4% runu): dedup pracuje na treści findingów — bez Read kodu albo osobny wyjątek; osobny limit D10 (e); telemetria trafień `testyUsuniete`;
    limit wspólny wycinka (reguły projektu 4 z 13–18 dopasowanych — także P10). **Do P13:** kompletność pola Pliki (6 kluczy w plikach spoza planu,
    pkt 70 g; pole Pliki decyduje o bloku reguł/D10), `dev-plan/SKILL.md:478` (figma tylko w wariantach `-figma`, pkt 69 i), 5 cytatów
    prompt-auditu w `dev-docs/SKILL.md:9,112`, `dev-plan/SKILL.md:9` (pkt 69 g). Kopie `_smoke-P11-oferty-online`, `_smoke-P12-oferty-online`
    i `~/test-review/` czekają na decyzję operatora (P12 zamknięte — test-review już niepotrzebny).

72. **P13 SESJA 1/2 — SKRYPTY PLANOWANIA + TEST KONTRAKTU docs/active/ (2026-10-07). Gałąź `popr/P13-planowanie`, NIEZMERGOWANA.**
    Commity `324ffd3` (parser, generator, test kontraktu, planner), `8d58018` (walidacja, bramka, CLI), `e4b9486` (poprawki po recenzji), `e417c53` (po weryfikacji).
    pnpm 694/694 (+65), typecheck i lint zielone. Podział P13: S1 skrypty + kontrakt (ta sesja), S2 scalony SKILL.md + usunięcie dev-docs + smoke.
    (a) **`.claude/scripts/plan/`** (8 modułów, każdy ≤ 170 linii): `plan-techniczny.mjs` (frontmatter z mapą `figma_screens`, fazy, IU,
    bloki ``` pomijane, nierozpoznany nagłówek IU = problem z numerem linii), `pola-iu.mjs` (pola IU fail-closed: nieznane pogrubione pole
    kończy bieżące, pole drugi raz, lista wcięta / `*` / numerowana / kontynuacja bez wcięcia = problem; tabela plików z `\|` w komórce,
    jeden plik na wiersz), `zadanie.mjs` (generator trzech plików), `przygotowanie.mjs` (`[blokuje: …]`), `budzet-pliku.mjs`,
    `walidacja-planu.mjs`, `gotowosc.mjs`, `plan.mjs` (CLI: `linie | sprawdz | generuj [--zapisz] [--nadpisz] | gotowosc`; kody 0/1/2/3).
    (b) **Generator = cały dawny dev-docs Faza 2–3 w skrypcie, wszystkie trzy pliki** (nie tylko zadania): zadania = checkboxy z pól IU
    (`Akcja: \`plik\`` z tabeli, `Test: [Unit]`, `Test: [E2E]`, `Weryfikacja:`, sekcja `## Operator checklist faza N` z `Operator: … (IU-K)`
    i `[Manual] … (IU-K)`), bez kopii podejścia/decyzji/tekstów — planner bierze je z planu technicznego; plan zadania i kontekst wskazują
    plan techniczny zamiast przepisywać „Zakres” i „Kryteria” (dev-docs kopiował 22–46%); `## Fazy`, `## Designerski kontekst`, `## Dziennik`,
    blokery faz ≥ 2 z checklisty przygotowania w `## Blokery operatora per faza` (bez osobnego commitu jak w dev-docs Faza 5).
    Liczniki E2E z wygenerowanego tekstu grepem konsumentów + bilans (rozjazd = błąd generacji).
    (c) **Format IU (kontrakt planu dla sesji 2): tabela plików** `| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |` — linie kodu jak
    ESLint `max-lines` (bez pustych i komentarzy; `plan.mjs linie <pliki>` liczy „dziś”); > 300 po zmianie = ocenione wymiary, > 360 = błąd
    (ten sam próg co ESLint i bot — test wiąże stałą z `eslint.config.szablon.ts`), „wydziel” wymaga wiersza Stwórz; plik z wcześniejszej IU
    planu: „dziś” = jej „po”. Walidacja odrzuca też: fazy nie `### Faza N` od 1 bez luk, IU bez fazy / numeracja z luką / Delegate to spoza
    builderów, IU bez plików, `[Unit]` bez pliku testu (**kompletność pola Pliki z P12**: pole decyduje o bloku reguł/D10), `Modyfikuj` na
    plik, którego nie ma, znaczniki `[E2E]/[Manual]/[Unit]/Operator:/[P1-3]` w treści pozycji (zmieniłyby liczniki grepów), `[E2E]` bez flow
    albo flow dwa razy, seed spoza pola Pliki i repo, Weryfikacja bez komendy CLI w backtickach (scribe zostawiłby „klasyfikacja niejasna”),
    Weryfikacja `[E2E]` bez runnera `.sh` albo runner = scenariusz, pola designerskie i checklista nie istnieją, `[E2E]` bez `.env.e2e`
    i bez checklisty. Uwaga (nie błąd): migracja w opisie bez pliku w `supabase/migrations/`, origin wskazuje brakujący plik.
    (d) **Bramka gotowości** (dawna Faza 5 dev-docs): plan strukturalnie (bez reguł wobec repo — działa po fazie 1 przy wznowieniu), `[E2E]`
    vs `.env.e2e`, blokery startu (`planowanie`, `faza 1`, marker bez numeru), gałąź `feature/<zadanie>` i czyste drzewo. `--nadpisz`
    odmawia przy `.autopilot-state.json`, `review-faza-N.md`, `[x]` w zadaniach albo wpisach dziennika.
    (e) **Test kontraktu** `__tests__/kontrakt-docs-active.test.mjs`: wygenerowane pliki vs nagłówki i grepy wycięte ze źródeł workflowów
    (planner, bootstrap, db-sync, fix, walidacja końcowa, scribe, smoke operatora, archiwizacja) i dossier (`wycinkiZadania`); oczekiwania
    wpisane ręcznie, nie liczone parserem. **Planner execute-wf:** ścieżka planu technicznego z linii `Plan techniczny:` zamiast `## Zrodla`
    (dev-docs pisał `## Źródła` — grep plannera jej nie trafiał; recenzent: trafia też stary format zadań w toku). **Dossier `liczE2e`** =
    grep konsumentów (`^- \[ \]`, wcięty checkbox się nie liczy).
    (f) **Recenzja** (Opus general-purpose, 92 realne plany, 10 mutacji): 2 P1 (znacznik `[E2E]` w treści Weryfikacji/operatora dodawał linie
    do prechecku — realny plan 9c: 3 linie przy 2 scenariuszach; nagłówek IU z dopiskiem execute-wf sklejał jednostki — realne plany tracili
    do 6 z 7 IU), 5 P2 (parser nie fail-closed: adnotacje po Weryfikacji → 73 checkboxy zamiast 33; budżet surowymi liniami vs ESLint;
    plik z wcześniejszej IU; bramka czerwona po fazie 1; pusty frontmatter → wyjątek i `[object Object]`), 13 P3 — wdrożone wszystkie poza
    13 (bramka E2E per scenariusz: natywne okno, zewnętrzny system, seed spoza stanu bazowego → praca skilla w S2). Próba po poprawkach:
    92 plany, 0 wyjątków, 0 zgubionych nagłówków IU. **Weryfikacja 1** (ten sam recenzent, 18 mutacji): P1 2/2, P2 5/5 domknięte; nowe
    2 P2 + 4 P3 = fałszywe odrzucenia poprawnych planów, wszystkie wdrożone (`e417c53`): separator `---` kończy pole (49 błędów w 15 planach),
    lista komend Weryfikacji wspólna z listą CLI scribe'a review-wf (supabase, psql, curl, wc, git, node, npx, deno, bash, sh, `./x`, `*.sh`,
    `*.mjs`; test kontraktu wiąże obie; prompt scribe'a nadal ≤ 7000 zn), wcięty podpunkt scenariusza doklejany, pozycja operatora z `[Manual]`
    albo `Operator:` przechodzi, numeracja IU — błąd tylko przy powtórzeniu (luka = uwaga), pole drugi raz łączone. Po niej: 20 → 4 plany
    z problemami formatu. Raport z dowodami: `dane/recenzja-p13-s1.txt`. pnpm 694/694 (+65).
    (g) **Do sesji 2:** scalony `dev-plan/SKILL.md` prowadzi plan do formatu z (c) i kończy: `plan.mjs sprawdz` → poprawki → branch →
    `generuj --zapisz` → commit inicjalny → `gotowosc` → handoff (polecenie Workflow + zdanie N1); bramka E2E per scenariusz z dev-docs
    Faza 2 pkt 4 jako krok skilla przed `generuj` (uwaga 13); rejestr stałych = treść skilla (bez reguły skryptu); hunki H31–H37 przechodzą
    `git apply --check`, ale wchodzą jako TREŚĆ (dev-docs znika, SKILL.md pisany od nowa; H32 dotyczy kopii w kontekście — generator to
    rozwiązał); fixture smoke'a (`plan-techniczny-smoke-autopilot.md` ma `## Faza 1:`, `### IU-1:`, „Delegate to:” bez pogrubienia,
    scenariusze bez typu, Pliki listą) — przepisać na format (c) i wygenerować `docs/active/` fixture'u skryptem. `PLAN-POPRAWY.md:576`
    opisuje kontrakt jako „`## Zrodla` — planner :121–128” — nieaktualne (planner czyta `Plan techniczny:`).

73. **P13 SESJA 2/2 — SCALONY DEV-PLAN, USUNIĘCIE DEV-DOCS, FIXTURE, SMOKE (2026-10-07). PACZKA P13 ZAMKNIĘTA, merge `--ff-only`
    `popr/P13-planowanie` do main.** Commity: fbed1d9 (skill), 28638cd (dev-docs usunięty, odwołania, telemetria), be4910e (fixture smoke'a),
    8615c1a (poprawki po recenzji), d881a18 (odczyt smoke'a), commit HANDOFF. pnpm 714/714 (+20), typecheck i lint zielone, `pa_dodane.py main`
    na wszystkich zmienionych plikach z promptem: 0.
    (a) **`.claude/skills/dev-plan/SKILL.md` od nowa** (344 linie, 33 KB; było 63,5 KB dev-plan + 24,7 KB dev-docs): Fazy 0–5 jak dawny dev-plan
    (bez cytatów prompt-auditu, data z `date +%F` — H31/H35 jako treść, H32 rozwiązał generator), 1.1: indeks wiedzy czytany w całości; agenci
    badawczy zawsze w Standardowej/Głębokiej, w Lekkiej tylko przy (a) nowej zależności/usłudze/API/wersji głównej albo (b) obszarze bez wpisu:
    `wiedza.mjs wycinek --pliki <pliki IU> --bez-zawsze` pusty i `grep -rl` w `docs/solutions/` pusty; `Scope:` dla repo-research-analyst (H36);
    3.5 tabela builderów z bazowymi nazwami (warianty `-figma` wybiera planner fazy, dawne dev-plan:478 zamknięte); 3.6 tabela plików i budżet
    (300 = wymiary, 360 = ESLint, „wydziel” + Stwórz, „dziś” z `plan.mjs linie`); 3.6b rejestr stałych (IU-źródło i konsumenci piszą
    `NAZWA = wartość` — planner nie dokleja rejestru); Faza 6 z dawnego dev-docs: 6.1 bramka E2E per scenariusz (natywne okno, zewnętrzny system,
    dane spoza stanu bazowego — uwaga 13 recenzji S1), 6.2 `sprawdz`, 6.3 git (klasy a/b, `--untracked-files=all`, gałąź zakończonego zadania
    → pytanie), 6.4 `generuj --zapisz`, 6.5 commit inicjalny, 6.6 `gotowosc`, 6.7 handoff z poleceniem Workflow i zdaniem N1. `references/`:
    `szablon-planu.md` (sekcje, pola IU, przykład planu Lekkiego z 2 fazami, wydzieleniem, rejestrem, `[E2E]` z seedem), `kontekst-designerski.md`
    (kroki B–F, narzędzia Figmy bez prefiksu MCP — H37), `przygotowanie-operatora.md` (kategorie, delta wobec /dev-prep, szablon checklisty
    z frontmatterem `feature_slug`/`origin`). Sekcja planu „Granice zakresu” (planner szuka prefiksu `## Granice`). Test `skill-dev-plan.test.mjs`:
    przykład szablonu przez `sprawdz` i `generuj`, mutacje (wydziel bez Stwórz, > 360, tylda w liniach, runner bez [E2E], R-ID bez IU, -figma),
    tabela builderów = `skills:` agentów, kolejność Fazy 6, zdanie handoffu = opis autopilota.
    (b) **dev-docs usunięty;** odwołania przepięte (README: przepływ, lista skilli, scenariusze, struktura — Changelog bez zmian; dev-prep, dev-brainstorm,
    dev-compound, zroastuj-mnie, tester E2E „kontrakt `docs/active/`”, komentarze dossier/gotowości, PLAN-POPRAWY:577 → linia `Plan techniczny:`).
    Test odwołań z P0: komendy `/dev-*` w workflowach, agentach, skillach, regułach, `.md` szablonów i README → skill albo workflow (bez Changelogu);
    przed usunięciem złapał 5 plików. Workflowy dev-docs nie wołały.
    (c) **Telemetria:** `plan.mjs generuj` zwraca `rozmiary {plan_zn, zadania_zn}` i `budzet {iu_z_wymiarami, wydzielenia}`; `telemetria/planowanie.mjs`
    → `skill.artefakty` (dotąd `null`): `plan_kb, zadania_kb, iu, iu_z_wymiarami, wydzielenia, walidacja {n, odrzucone, bledy_pierwszy,
    bledy_budzetu_pierwszy}, gotowosc {n, ok_ostatnia, czerwone_ostatnia}` z wyników `plan.mjs` w transkrypcie (JSON jednoliniowy, po `| jq`,
    `--projekt` przed poleceniem). Nowe pole z nowych rekordów, `WERSJA_REKORDU` bez zmian. Pod próg P13 „bramka odrzuca > 1 z 5 planów”.
    (d) **Fixture smoke'a:** `plan-techniczny-smoke-autopilot.md` w formacie IU (frontmatter, tabela plików, `[Manual]` jako scenariusz), pliki
    `smoke-autopilot-{plan,kontekst,zadania}.md` = wynik generatora (`generuj-fixture.mjs --zapisz`; test `fixture-zadania.test.mjs`: plan po
    podstawieniu placeholderów przechodzi `sprawdz` z migracją i bez, pliki = generator, 4 × [Unit], [Manual] w sekcji operatora, bez [E2E]).
    **Zmiana kontraktu `przygotuj-kopie.sh`: gałąź kopii `feature/smoke-autopilot`** (bootstrap porównuje bieżącą gałąź z linią `Branch:` planu
    zadania, a generator pisze `feature/<zadanie>`). Fixture ma od teraz 4 testy [Unit] (było 3 — dawny plik zadań zgubił Infinity), więc smoke
    na fixture nie jest 1:1 z R-P12.
    (e) **Recenzja** (Opus general-purpose, próba: plan Standardowy napisany wg skilla przeszedł całą Fazę 6, `sprawdz` za pierwszym razem):
    0 P1, 4 P2, 8 P3 — wszystkie wdrożone (8615c1a): kolumna linii z `~` albo bez strzałki = błąd zapisu, plik kodu bez „po” = błąd (szacunek
    `~400` omijał budżet); runner `e2e/*.sh` w Weryfikacji bez `[E2E]` = błąd (zmiana kontraktu testu walidacji z S1: `./e2e/sprawdz.sh` już
    nie przechodzi); `wycinek --bez-zawsze` (koszyk „zawsze” pasował do każdego pliku → warunek (b) nigdy się nie spełniał; katalog bez
    pliku nie pasuje do globu `x/**/*.ts`); uwaga walidacji dla R-ID bez IU (lekcja z dawnego dev-docs Faza 1); `-figma` tylko ui/fullstack;
    rejestr stałych z wartością; wyjątek zasady 2 dla Weryfikacji; gałąź zakończonego zadania; telemetria `| jq`; test odwołań szerzej;
    wariant negatywny smoke'a z commitem.
    (f) **Smoke** (kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P13-oferty-online`, oferty `eb63043`): skrypt P0 z `--env` → kod 7
    na 12 testach jak w P11/P12 → commit środowiska `0477a9b` (`vi.setSystemTime(NOW);` w linii po `EXPIRES_AT` w `opublikuj-oferte.test.ts`,
    `TIME_LIMIT_MS` 200 → 1000 w `markup-scan.test.ts`), linia CLAUDE.md `90c0143` (wiersz `.claude/rules/learned-patterns.md` → `docs/learned-patterns.md`
    w brzmieniu z P10–P12), **konwersja sesją headless** `claude -p "/dev-compound-refresh --konwersja" --model claude-opus-5-5 --effort high
    --strict-mcp-config --permission-mode bypassPermissions < /dev/null` (`35c9ca4`, 0,48 M): 38/38, 0 odrzutów, indeks 38 wpisów 21 877 zn,
    `bledy: []`, koszyk „zawsze” 5 (P11: 0 — agent konwersji wybiera różnie), 3 solutions bez pól; kopia przełączona na `main` (`git checkout -B main`),
    żeby /dev-plan zrobił gałąź z main bez pytania. Operator w sesji kopii: `/dev-plan` z zadaniem „formatDuration od 60 min jako „1 h 05 min””
    → plan Lekki `2026-10-07-001-fix-czas-wizyty-z-godzinami-plan.md`, 1 faza, 1 IU (`feature-builder-ui`, tabela plików: format.ts 69 linii),
    **bez agentów badawczych** (obszar ma reguły w indeksie, brak nowych zależności), 3 decyzje nierozstrzygnięte w requeście opisane w handoffie,
    `sprawdz` 0 błędów za pierwszym razem, `gotowosc` zielona → operator „uruchom” → **run `wf_d085974e-8d3`: OK, CZYSTE, 1,21 M, 20 agentów, 9 min**;
    review 0 findingów (fix 0), walidacja PASS, smoke operatora `brak-pozycji`, 0 błędów schematu, kryterium P12 zielone. **Epizod dev-plan:**
    do wywołania Workflow 0,19 M (8 tur, 0 subagentów; rekord 0,23 M z podsumowaniem po runie), wiadomości operatora 1, artefakty: plan 7 kB,
    zadania 2 kB, 1 IU, walidacja 1× bez błędów, bramka ok za 1. razem; planner fazy dostał IU z tabelą plików (prompt IU z planu technicznego).
    Progi P13: epizod 0,19 M ≪ 2,95 M (n = 1), bramka 0/1 odrzuceń. Koszt runu nieporównywalny z R-P12 (inne zadanie, bez cyklu fix).
    Rekord `skill` dev-plan powstał dopiero po ręcznym `zbierz.mjs --skan --szybko` — hook pomija żywą sesję (`pominSesje`), to zachowanie
    z projektu. Odczyt: `dane/smoke-P13.txt` (`smoke_odczyt.py` + sekcja `smoke_p13.py`). → **R-P13 = `wf_d085974e-8d3`** (smoke z /dev-plan);
    dla smoke'ów na fixture referencją zostaje R-P12 (z zastrzeżeniem z (d)).
    (g) **Do P14:** fixture z [E2E] — test `fixture-zadania.test.mjs` przypina „bez [E2E]” (zmiana kontraktu jawnie), pliki docs/active/ przez
    `generuj-fixture.mjs --zapisz`; walidacja planu wymaga `.env.e2e` albo `operator_prep` przy [E2E]. **Do P16:** `review:correctness` w kryterium
    P12 jako „orkiestracja_z_kodem” (reviewer czyta kod i dostaje reguły przez `paths:` — klasyfikacja ról w `smoke_p12.py`, nie defekt);
    kopia `_smoke-P13-oferty-online` czeka na decyzję operatora.
74. **P14 SESJA 1/3 — MECHANIKA E2E: STOP NA STARCIE, [MANUAL] W TRAKCIE (2026-10-07). Gałąź `popr/P14-e2e` NIEZMERGOWANA.**
    Commity 604b940 (skrypt), e074fc0 (workflowy), 312faad (poprawki po recenzji), 521f343 i d5a1b6c (poprawki po dwóch
    weryfikacjach), commit HANDOFF. pnpm 782/782 (+68), typecheck
    i lint zielone, `pa_dodane.py main` na zmienionych plikach z promptem: 0.
    (a) **Podział P14 i decyzje operatora** (wszystkie wg rekomendacji): S1 mechanika obu przypadków; S2 tester od nowa + generator
    skilla weryfikacji + mapa funkcji; S3 fixture z [E2E] + smoke w dwóch przebiegach + merge. Po awarii środowiska w trakcie runu
    reszta runu bez przeglądarki (bez ponownego stawiania); pad testera 2× → [Manual] z przyczyną `tester-padl`; zapis linii
    `[E2E]` → `[Manual]` + suffix `(MANUAL — <przyczyna>: <powód>)`; limit zewnętrzny → od razu [Manual].
    (b) **`.claude/scripts/e2e/`** (6 modułów, ~750 linii, testy `ksiegowanie`, `srodowisko`, `e2e-cli`): `scenariusze.mjs` — linie
    [E2E] (jedno źródło `liczE2e` dla startu i dossier — reeksport w `dossier/dokumenty.mjs`), sekcja fazy z nagłówka dowolnego
    poziomu, `listaManual`; `ksiegowanie.mjs` — `PRZYCZYNY_SKIP` (srodowisko, limit-zewnetrzny, harness, tester-padl → manual;
    brak-seeda, scenariusz-niewykonalny → fix; nieznana → SKIP jak dotąd), werdykt per flow FAIL > SKIP > PASS, kopia w Operator
    checklist tylko dla SKIP do naprawy, `brakWpisu`, `tylkoZWpisem`; `srodowisko.mjs` — parametry `.env.e2e` (`E2E_URL`,
    `E2E_START`, `E2E_HEALTH`, `E2E_START_TIMEOUT` ≤ 540 s; domyślnie Vite 5173), baza e2e opcjonalna (`supabase/` albo
    `SUPABASE_E2E_*`), sprawdzenie (gitignore, guard tożsamości zawsze — także brak `VITE_SUPABASE_URL` w `.env.e2e` przy kluczu
    w `.env`, porównanie po origin; klucze bazy, migrations.sum, `E2E_URL`/`E2E_HEALTH`, `agent-browser doctor`); `serwer.mjs` —
    start w tle z logiem i plikiem PID `/tmp/autopilot-e2e-<projekt>.*` = JSON {pid, komenda, odcisk `.env.e2e`, czas startu
    procesu z `ps -o lstart=`}: proces „nasz” tylko przy zgodnym czasie startu (PID ponownie użyty przez system nie zostanie
    zabity); nasz z aktualną konfiguracją i odpowiedzią = `uruchomione`, ze starą konfiguracją (zmiana `.env.e2e` po STOP-ie) albo
    zawieszony — zatrzymany (SIGCONT + SIGTERM, po 5 s SIGKILL) i uruchomiony od nowa; stop, `stanSerwera` (nasz, żyje, ogon logu);
    `start.mjs` — `startE2e` → pominieto / brak-srodowiska / niepowodzenie / gotowe z gotową naprawą; CLI `e2e.mjs`: sprawdz,
    start, stop, stan, suma, ksieguj (stdin), manual, lista-manual.
    (c) **Autopilot:** precheck (haiku) + env-up (opus) → jeden agent `e2e:start` (klasa-mechaniczny, Bash 600 s, jedno wywołanie,
    kod 3 obsłużony), decyzja w JS `decyzjaSrodowiskaE2e` (STOP `start: srodowisko E2E — …` z naprawą skryptu + świeży run; null 2×
    → STOP `start: agent e2e:start…`), stan środowiska w runie gotowe / pominieto / martwe (`srodowiskoPoReview`); STOP-y blokera
    środowiska i padu testera usunięte (log), db-sync tylko z bazą e2e i po `e2e.mjs suma`, env-down = `e2e.mjs stop` przy serwerze
    `uruchomione`; fix: re-run niewykonalny nie z winy kodu → `e2e.mjs manual`, przy martwym środowisku bez odgrywania.
    (d) **Review-wf:** `przebiegi[].przyczyna` (wymagane), e2ePrompt (klasyfikacja SKIP, `curl -sS`, `e2e.mjs stan`: nasz serwer
    martwy z błędem kodu w logu = FAIL P2 „serwer aplikacji padł”, fix po naprawie uruchamia serwer `e2e.mjs start`), awaria
    środowiska = WYŁĄCZNIE przebieg SKIP `srodowisko` (findingi i FAIL nie są wejściem; sygnatury tylko nazywają klasę),
    `liczManualE2e` → `przebieg.e2eManual`, fix: `serwerE2e: martwy` → `srodowiskoE2E = 'martwe'`,
    scribe księguje linie [E2E] wyłącznie skryptem (`komendaKsiegowania`, heredoc `PRZEBIEGI_E2E`), przeglądarkowa „Weryfikacja:”
    bez markera → kopia w Operator checklist. **Complete-wf + SKILL dev-docs-complete:** źródło 4b `lista-manual` → sekcja
    „E2E do odegrania ręcznie (środowisko w trakcie runu)”. **Telemetria:** `faza.e2e.manual`, `run.manual_razem`, kategoria
    `start: srodowisko E2E` = E2E-srodowisko, rola `e2e:start` (mechaniczny). **Tester:** przyczyny SKIP, bez findingu OPERATOR
    dla środowiska, `stan`; H13 i H61 jako łaty (pełna treść testera w S2). README `e2e-env` (dwa przypadki, parametry,
    architektura) i `.env.e2e.example` z blokiem parametrów.
    (e) **Recenzja** (Opus general-purpose; księgowanie na 118 plikach zadań z dysku, start/stop na projekcie testowym, heredoc ze
    złośliwym dowodem): 0 P1, 8 P2, 10 P3 — wdrożone wszystkie P2 i 9 P3 (pominięta kosmetyka pustych linii w Operator checklist).
    Najważniejsze: awaria środowiska z pola przyczyny (curl -s milczy, curl 8 nie pasował do sygnatur), SKIP harness/limit z
    cytowanym błędem usługi zewnętrznej nie przełącza runu, FAIL z sygnaturą zostaje do fixa (serwer mógł położyć kod fazy), guard
    tożsamości bez `supabase/`, zły `E2E_URL` bez wyjątku, limit Basha agenta startu, fix przy gotowym środowisku też ma ścieżkę
    [Manual]. **Weryfikacja poprawek** (świeży agent; pierwsza przerwana razem z sesją): 6/8 P2 zamknięte, 2 częściowo, nowe N1–N5
    (521f343): po padzie serwera z winy kodu nikt go nie restartował, a stary log fałszował kolejne fazy → awaria tylko z SKIP
    `srodowisko`, FAIL = defekt kodu z restartem w fixie; guard bazy przy braku klucza w `.env.e2e`; plik PID z PID 1 / cudzym
    procesem dawał `kill(-1)` → PID z komendą i odciskiem; checkbox zawsze w heredocu; kopia Operator przy `# Faza N`. Druga
    weryfikacja 521f343: N2, N4 zamknięte; N1, N3, N5 częściowo + nowe A (fix bez udanej naprawy nie restartował serwera → FAIL
    w każdej fazie), B (zmiana `.env.e2e` zostawiała stary serwer ze starą konfiguracją, nieusuwalny), C (PID ponownie użyty przez
    proces użytkownika uznany za nasz), D (zawieszony serwer osierocony), E (`### Faza`), F (`.env.e2e.local`), G (teksty o sygnaturze,
    watcher) → d5a1b6c: tożsamość procesu po czasie startu, restart naszego serwera przy zmianie konfiguracji / zawieszeniu, fix
    zawsze startuje serwer po „serwer aplikacji padł” i zgłasza `FIX_RESULT.serwerE2e` (`martwy` → reszta runu bez przeglądarki),
    watcher z błędem kodu w logu = FAIL, guard z `.env.e2e.local`. d5a1b6c sprawdzony testami na prawdziwym serwerze (B, C, D),
    bez trzeciej weryfikacji — recenzja S2 obejmuje go krótko, A sprawdza smoke S3.
    (f) **Zmiany kontraktu testów:** stan-fazy (oznaczStan 14 → 12; następca `e2e:start`/`E2E_START`), kontrakt-docs-active (grep
    completion-gate + `liczE2e`; linie [E2E] księguje skrypt), scribe-p3, wywolania-agentow, faza.test, bloker-srodowiska (skutek
    blokera; wejście = przebiegi testera, FAIL z sygnaturą nie jest awarią), srodowisko.test (kolejność błędów; drugi start przy
    żywym PID = uruchomione; sprzątanie /tmp w afterEach).
    (g) **Do S2:** tester od nowa — `e2ePrompt` = parametry + tryb, treść w pliku roli (zachować przyczyny SKIP, `curl -sS`,
    `e2e.mjs stan`, brak findingu dla środowiska), seed vs kontrakt migracji (L-E2E-2); generator `.claude/skills/weryfikacja-setup/`
    (Launch / Doctor / Drive / Evidence / Cleanup + mapa funkcji: droga użytkownika, dowód działania, pliki kodu) z testem na fixture
    projektu; Doctor = `e2e.mjs sprawdz`, Launch = `e2e.mjs start`; tester czyta skill; complete-wf dopisuje funkcje ze scenariuszy
    [E2E] zadania do mapy; skill `agent-browser`; rozważyć `plan.mjs gotowosc` → `e2e.mjs sprawdz` zamiast samego istnienia
    `.env.e2e`. **Do S3:** fixture z [E2E] przez generator (test `fixture-zadania` zmieniony jawnie). Przebieg (1): kopia bez
    `.env.e2e` → STOP `start: srodowisko E2E` przed fazą 1 (koszt minimalny). Przebieg (2): `.env.e2e` (oferty: Vite, baza e2e albo
    tylko `E2E_URL`/`E2E_START`), serwer zatrzymany przed testerem (np. `node .claude/scripts/e2e/e2e.mjs stop` z drugiego terminala
    po domknięciu execute) → SKIP `srodowisko` → [Manual] z powodem, sekcja w smoke'u, reszta runu bez przeglądarki, run OK; odczyt
    `faza.e2e.manual`, `run.manual_razem`, 0 STOP-ów w trakcie.

75. **P14 SESJA 2/3 — TESTER OD NOWA, SKILL WERYFIKACJI I MAPA FUNKCJI (2026-10-07). Gałąź `popr/P14-e2e` NIEZMERGOWANA.**
    Commity b365e0c (tester), 1ade9c1 (Doctor/Launch bez zadania, gotowość), ff31735 (mapa), f5d9211 (generator), c6a3837
    (archiwizacja), 170afe5 (agent-browser), e3c4e21 (poprawki po recenzji), 9628595 (poprawki po weryfikacji), commit HANDOFF.
    pnpm 821/821 (+46), typecheck i lint zielone, `pa_dodane.py main` na zmienionych plikach z promptem: 0.
    (a) **Decyzje operatora** (wszystkie wg rekomendacji): skill projektu w stałym miejscu `.claude/skills/weryfikacja/` (SKILL.md +
    `mapa-funkcji.md`; szablon go nie dostarcza, więc sync-template go nie rusza); zadanie z [E2E] bez skilla = UWAGA w gotowości,
    run idzie (tester gra bez mapy); mapę dopisuje skrypt (`e2e.mjs mapa`), nie agent; bramka gotowości dev-plan = pełne
    sprawdzenie środowiska jak bootstrap.
    (b) **Tester od nowa:** `feature-tester-e2e.md` w formacie warstwy stałej (dodany do `ROLE_Z_WARSTWA`): Wejście (folder, faza,
    tryb, zapis scenariusza, skrypt, skill projektu) + jeden blok Polecenia w sekcjach Scenariusze / Seedy / Aplikacja i środowisko /
    Odegranie / Klasyfikacja i wynik / Makiety. Scenariusze z `e2e.mjs scenariusze --zadanie --faza` (to samo `czyScenariusz` co start,
    dossier i księgowanie), Drive/Evidence i wpis mapy po flow ze skilla projektu, seed vs kontrakt migracji (L-E2E-2: kolumny
    wymagane, DEFAULT, wartość nieosiągalna = P2 z `checkbox:` scenariusza), przyczyny SKIP, `curl -sS`, `e2e.mjs stan`, watcher;
    doctor agent-browser tylko w trybie `przegladarka`; w `bez-przegladarki` makiety nadal do człowieka (makieta w `visual-diff/` +
    finding OPERATOR P3). `e2ePrompt` = folder, faza, tryb, `SKILL_WERYFIKACJI` + bloki wspólne (długie komendy, limit P3, mapa,
    re-review); `BLOK_BEZ_PRZEGLADARKI` usunięty; retry z krótką notą.
    (c) **Doctor i Launch bez zadania:** `e2e.mjs sprawdz|start` bez `--zadanie` = środowisko potrzebne zawsze (`startE2e(projekt, null)`).
    **Gotowość:** `srodowiskoE2e` liczy potrzeby `potrzebyZadania` (scenariusze ORAZ makiety, jak bootstrap) i `bledySrodowiska`
    bez startu serwera; makiety bez `.env.e2e` przechodzą; `e2e.bledy`, `e2e.uwagi`, `e2e.figmaScreens`; 24 przypadki macierzy
    = decyzja `startE2e` (weryfikacja). Stałe ścieżek w `.claude/scripts/e2e/weryfikacja.mjs` (kopie w review-wf i complete-wf
    z testem równości).
    (d) **Mapa funkcji** (`mapa.mjs`): wpis `## \`<flow>\`` z polami Droga (kroki), Dowód (stan za ostatnią strzałką, bez końcowego
    „→ PASS”), Pliki (kod jednostki bez testów, seedów, e2e, migracji), Zadania; scalanie po flow (Droga/Dowód z nowszego planu,
    Pliki/Zadania sumowane, pola ręczne z podlistami per wystąpienie, linie przed pierwszym polem i luźne zostają; mapa bez zmian
    bajt w bajt, CRLF zachowany). Na 108 planach z dysku: 155 wpisów z 29 planów, 0 wyjątków.
    (e) **Generator** (`szkielet.mjs`, `e2e.mjs weryfikacja [--zapisz [--nadpisz]]`, skill `/weryfikacja-setup`): SKILL.md z sekcjami
    Launch (`e2e.mjs start`, komenda i adres z `konfiguracja`), Doctor (`sprawdz`, `stan`), Drive (trasy z kodu: `path` z `/`,
    `<Route>` także względne i po `element={…}`, obiekt trasy z element/Component/lazy, stałe `*_PATH/_ROUTE`, app router Next;
    katalogi src, app, apps, packages, pages i `<x>/src` z pakietem frontendu; bez API, `*` i plików statycznych; limit 40 z `obcieto`;
    logowanie kontem e2e, liczba data-testid), Evidence, Cleanup (`stop`, `close`), Mapa funkcji; znaczniki `<!-- UZUPEŁNIJ:`;
    linia `Przejście na żywo: niewykonane`. Mapa zasiana z planów `docs/completed/` w kolejności daty planu. Skill generatora:
    szkielet → fakty z kodu → jedno przejście na żywo (`clean | changed | blocked`) → commit; utrzymanie podglądem.
    Na kopiach: oferty 29 tras + 70 funkcji, akademia 10 tras względnych, clawl 0 (backend/CLI odfiltrowane), Expo Router nie wykrywany.
    (f) **Archiwizacja:** complete-wf krok 3a `e2e.mjs mapa --zadanie` przed `mv` (pominięto / dodane / błąd → rezultaty), pathspec
    z `MAPA_FUNKCJI`, krok 8 pomija ścieżki ignorowane (`git check-ignore -q`); skill dev-docs-complete krok 4a. Skill agent-browser
    odsyła do skilla weryfikacji projektu. README: skill, tester, „Myk E2E”.
    (g) **Recenzja** (Opus general-purpose, mutacje w worktree, generator na kopiach 4 projektów): 0 P1, 4 P2, 6 P3 — wdrożone wszystkie
    (gotowość przepuszczała makiety, które bootstrap zatrzymywał; makiety w trybie bez przeglądarki znikały; podlisty mapy odrywały się
    od pola; trasy gubiły frontend/src, ścieżki względne i ucinały ekrany po `/api`; 5 przeżytych mutacji). **Weryfikacja** (świeży
    agent): 2 P2 zamknięte, reszta częściowo + N1–N8 (N1: `<x>/src` z backendu dawał ścieżki plików jako trasy w clawl) → 9628595,
    bez trzeciej weryfikacji (krótka recenzja w S3). d5a1b6c przejrzany krótko w recenzji: bez P1/P2.
    (h) **Zmiany kontraktu testów:** e2e-manual (procedura testera z review-wf na plik roli), warstwa-stala (+ tester), e2e-cli (`start`
    bez `--zadanie` poprawne), plan-cli (atrapa agent-browser w PATH), start-koniec (archiwum dotyka jednego pliku `.claude/` — mapy),
    odwolania (`ARTEFAKTY_PROJEKTU` + strażnik, że szablon ich nie ma), szkielet (`trasyAplikacji` → `{ trasy, obcieto }`).
    (i) **Nie sprawdzone:** żywy przebieg testera z nowym plikiem roli (czyta skill? woła `e2e.mjs scenariusze`?), formatowanie
    findingu OPERATOR makiet przez scribe'a (podwójne „Operator:”?), Expo Router / trasy mobilne, `--zapisz` na prawdziwym projekcie
    i przejście na żywo `/weryfikacja-setup`.
    (j) **Do S3:** fixture z [E2E] przez generator (test `fixture-zadania` zmieniony jawnie) — tak, żeby jedna faza dała PASS testera
    (dowód, że tester czyta skill i mapę), a druga [Manual] po zatrzymanym serwerze; w kopii smoke'a `.env.e2e` + `/weryfikacja-setup`
    z przejściem na żywo przed runem; przebieg (1) kopia bez `.env.e2e` → STOP przed fazą 1; przebieg (2) jak 74 (g) + odczyt:
    tester woła `e2e.mjs scenariusze` i czyta `.claude/skills/weryfikacja/`, archiwum zawiera `mapa-funkcji.md` z flow zadania,
    `faza.e2e.manual`, `run.manual_razem`, 0 STOP-ów w trakcie, koszt testera vs R-P12; krótka recenzja 9628595; merge `--ff-only`.

76. **P14 SESJA 3/3 — FIXTURE Z [E2E], SMOKE W DWÓCH PRZEBIEGACH, MERGE (2026-10-08). PACZKA P14 ZAMKNIĘTA, merge `--ff-only`
    `popr/P14-e2e` do main (`7c8c93d`).** Commity 935617a (klucz bazy), bbeeafc (po recenzji 9628595), d5e36e0 (fixture), 7c8c93d (`E2E_START`
    w cudzysłowie), commit HANDOFF. pnpm 825/825, typecheck i lint zielone, `pa_dodane.py main` na zmienionych plikach z promptem: 0.
    (a) **Decyzje operatora:** D1 baza e2e = projekt Supabase (operator: istniejący `oferty-online-staging`, ref …krob — ten sam, na który wskazuje
    `.env` ofert, więc guard tożsamości w samych ofertach słusznie blokuje; w kopii `.env` = atrapy), zgoda na `db push` (sucha próba: „Remote database
    is up to date”) i konto testowe; D2 serwer zatrzymuje operator z drugiego terminala (strażnik `until node -e … fazy[0].review==='done' && fix ∈
    {done, none} …; do sleep 5; done; e2e.mjs stop` — stan fazy 1 trafia na dysk przed execute fazy 2, okno = całe execute fazy 2); D3 `/weryfikacja-setup`
    headless (`claude -p … --permission-mode bypassPermissions < /dev/null`).
    (b) **Klucz bazy** (znalezione `sprawdz` na ofertach przed smoke'iem): `KLUCZE_BAZY` wymagały `VITE_SUPABASE_ANON_KEY`, a oferty i skill
    supabase-dev-guidelines mają `VITE_SUPABASE_PUBLISHABLE_KEY` (anon wycofywany do końca 2026) → STOP na starcie przy kompletnym `.env.e2e`. Grupy
    zamienników; README i `.env.e2e.example` z publishable.
    (c) **Recenzja 9628595** (Opus, 11 mutacji, generator na 12 projektach, scalanie mapy na 226 planach): 0 P1, 2 P2, 4 P3. Wdrożone: zły
    `package.json` w podkatalogu wywracał generator (nowe w 9628595) → katalog pominięty ze śladem na stderr; trasa względna od parametru (`:offerId`)
    ginęła (regresja); testy na przeżyte mutanty (mieszane końce linii mapy, devDependencies, kotwice nazwy zależności). Nie wdrożone P3: adnotacja ręczna
    w polu Pliki (wiszący backtick), stałe serwera w `apps/` monorepo na liście tras (skill każe je usunąć), `docs/src`; poza commitem: powtórzone pole
    standardowe gubi drugą wartość, pusty plik mapy bez nagłówka, w Nawykometrze klucze mapy = ścieżki `.maestro/*.yaml`.
    (d) **Fixture:** IU-2 statyczna strona `{{KATALOG_STRONY}}/smoke-autopilot.html` (feature-builder-ui, treść dosłownie w planie) + `[E2E] smoke-strona`;
    faza 2 z IU-3 (linia „Faza 2: gotowe”) + `[E2E] smoke-strona-faza-2`. `przygotuj-kopie.sh`: `{{KATALOG_STRONY}}` = `public` przy najpłytszym
    `vite.config.*` (bez Vite `public/`). Zmiana kontraktu `fixture-zadania.test.mjs`: „bez [E2E]” → „dwie fazy, jeden scenariusz [E2E] w każdej”.
    W monorepo `E2E_START` samej aplikacji (`pnpm --filter @oferty/dashboard exec vite --mode e2e --port 5173 --strictPort`) — `pnpm run dev` korzenia
    uruchamia wszystkie pakiety z flagami Vite.
    (e) **Smoke** (kopia `/Users/kacper_trzepiecinski/Documents/Kodowanie/_smoke-P14-oferty-online`, oferty `eb63043`): skrypt P0 → kod 7 na 11 testach →
    commity środowiska, linii CLAUDE.md i konwersji przeniesione `format-patch` z kopii P13 → bramki zielone. **(1)** `wf_745c7f98-e26`: STOP
    `start: srodowisko E2E — zadanie ma 2 scenariuszy [E2E], a repo nie ma .env.e2e`, kategoria E2E-srodowisko, 0,13 M, 4 agentów, 74 s
    (`dane/smoke-P14-przebieg-1.txt`). **Przygotowanie (2):** `.env.e2e` ofert skopiowany bez odczytu wartości + `E2E_URL`/`E2E_START` → `sprawdz` =
    `gotowe`; `/weryfikacja-setup` headless → `41f81c2`, przejście `changed`: szkielet zakładał e-mail + hasło, panel ma tylko magic link — skill opisał
    sesję z hasła konta E2E w `localStorage` (bez tokenów w transkrypcie), oddzielił ekrany od endpointów, 70 wpisów mapy, 0 znaczników.
    **(2)** `wf_24fe1f85-0cb`: OK, 2/2 fazy, walidacja PASS, gate CZYSTE ×2, **2,52 M (+38% vs R-P12), 36 agentów, 20 min** (przyrost = druga faza
    0,49 M + E2E: start, 2 × db-sync, 2 × tester, env-down ≈ 0,4 M). Faza 1: review 6 → 3 P2 naprawione, sceptyk 3 AGREE, kontrola fixa K-1…K-7 0;
    `review:e2e` tryb przegladarka 0,09 M / 24 s — `e2e.mjs scenariusze` tak, `.claude/skills/weryfikacja/SKILL.md` i `mapa-funkcji.md` przeczytane,
    `smoke-strona` PASS z dowodem (asercja + zrzut). Faza 2: strażnik zatrzymał serwer po fazie 1; tester (przegladarka, 0,07 M) → curl pada →
    `e2e.mjs stan` (nie nasz / martwy bez błędu kodu) → SKIP `srodowisko`; zadania: `[x] … smoke-strona`, `[ ] Test: [Manual] … smoke-strona-faza-2
    (MANUAL — srodowisko: …)`; smoke operatora z sekcją „E2E do odegrania ręcznie (środowisko w trakcie runu)”; `faza.e2e` 1: pass 1, 2: skip 1 / manual 1;
    `run.manual_razem` 1, `e2eSrodowisko` martwe; reviewerzy kodu fazy 2 pominięci (diff = sam HTML, spec-compliance tak) — routing zgodny z D4;
    archiwum: `mapa-funkcji.md` z `smoke-strona` i `smoke-strona-faza-2`. 0 STOP-ów w trakcie. Odczyt: `dane/smoke-P14.txt` (`smoke_odczyt.py`
    + `smoke_p14.py`; poprawka `smoke_p12.py`: wynik Bash zaczynający się liczbą nie jest wycinkiem). → **R-P14 = `wf_24fe1f85-0cb`** (fixture z E2E).
    (f) **Ustalenia z runu:** `.env.e2e` z niezacytowanym `E2E_START` dawał przy `. .env.e2e` (db-sync) `command not found: --filter` → 7c8c93d
    (przykład i README w cudzysłowie, test parsera). **Kryterium P12 CZERWONE w tym runie: `kod_bez_regul: fix`** — naprawiacz czytał kod `cat`
    i edytował heredokiem z Pythonem (zero Read/Edit), więc reguły z `paths:` się nie dołączyły (blok „REGULY PROJEKTU dla poprawianych plikow”
    w prompcie był). Sesja operatora miała włączone bypass permissions — prompt systemowy tego trybu zachęca do pracy Bashem, a agenci go dziedziczą;
    w R-P12 kryterium zielone. Do P16 (fix i buildery: Read/Edit przed zmianą kodu albo reguły w prompcie niezależnie od `paths:`; smoke'i w trybie
    zwykłym). Inne: `e2e:env-down` uruchamia się także przy środowisku `martwe` (0,03 M, stop bez skutku); komunikat „2 scenariuszy” (odmiana);
    w ofertach dev i E2E na tym samym projekcie staging (decyzja operatora poza szablonem); skill weryfikacji ofert z przejścia na żywo: przy samym
    dashboardzie nie działają `/api/*`, MCP, CTA ani strony ofert (adaptacje A2/A6 projektu zakładają serwis Node na 3010).
    (g) **Progi P14 do odczytu:** STOP E2E w trakcie runu 0/1 (cel 0); STOP na starcie z naprawą 1/1 przy braku `.env.e2e`. Koszt testera 0,08 M
    na fazę z jednym scenariuszem (R-P12 bez testera). Kopia `_smoke-P14-oferty-online` usunięta za zgodą operatora (z logiem i PID-em w /tmp); szablon wypchnięty 2026-10-08
    (`85c05c0..4610e1b`, 31 commitów P13 s2–P14).

## 7. Uwagi techniczne, żeby nie powtarzać błędów tej sesji

- Hook `md-guard` blokuje zapis `.md` przez Bash (heredoc/python) — pliki `.md` pisz WYŁĄCZNIE narzędziem Write/Edit; dane robocze zapisuj jako `.txt`/`.json`/`.csv`.
- Skrypt Workflow to czysty JS bez template literals z backtickami wewnątrz stringów zawierających backticki — pierwszy skrypt padł na parse; używaj konkatenacji `'...' + '...'`.
- Prompt dla `claude-code-guide` nie może być długi („Prompt is too long") — ten agent ma mały limit; daj mu 1–2 pytania.
- W transkryptach agentów jedna odpowiedź API = kilka wpisów `assistant` z tym samym `message.id` i tym samym `usage` — licz raz per id (poprawione w `koszt_agentow.py` v2).
- Etykiety agentów: nowsze runy mają `description` w `agent-*.meta.json` lub `label` w `journal.jsonl`; starsze wymagają klasyfikacji po początku promptu (`klasyfikuj()` w `koszt_agentow.py`).
- Scratchpad sesji (`/private/tmp/claude-501/.../scratchpad`) znika — wszystko trwałe jest w tym katalogu.
- `docs/reviews/` w szablonie jest od 2026-09-20 śledzone przez git (commity `docs(reviews): ...`); po każdym domknięciu commit tego katalogu.
- Kompilacja z wielu źródeł (jak PANEL-WEJSCIE) ma być sprawdzona W OBIE STRONY przed oddaniem operatorowi: pakiet → źródła (czytanie obok) i źródła → pakiet
  (`skrypty/d4_kontrola_odwrotna.py`). Pierwsza wersja pakietu pisana z pamięci miała 5 błędów i całą pominiętą kategorię; operator trzykrotnie pytał o pewność.
- Przegląd domknięć 2026-09-23: heurystyki mechaniczne (git blame na linii, regex „słów nakazu”, filtr po nazwie) sprawdzaj CZYTANIEM losowej próbki —
  blame nie widzi przyczyny w fixie, regex zależy od formy zapisu; bierz WSZYSTKIE dostępne przypadki (D1 pominęło trzecią parę); przed użyciem liczby
  z telemetrii jako punktu odniesienia sprawdź epokę (CLAUDE.md oferty 13,8k → 87k → 21k zn we wrześniu). `wc -c` liczy BAJTY, `len()` w Pythonie znaki —
  przy polskich znakach różnica ~4% wyglądała jak zmiana pliku.
- Przegląd D5 2026-09-23: w transkrypcie AGENTA wpisy jednej odpowiedzi API mają różne `output_tokens` (bierz OSTATNI; sesja główna ma końcowe od razu).
  Status, wynik, skrypt i lista agentów runu leżą w `~/.claude/projects/<slug>/<sesja>/workflows/<run>.json` (także dla starych journali bez etykiet).
  Rozmiar CLAUDE.md „w chwili runu” bierz z załącznika `instructions` transkryptu, nie z gita main — run pracuje na gałęzi zadania.
- Przegląd D6 2026-09-23: epizod skilla w sesji głównej NIE kończy się na pierwszej wiadomości typu user — `<task-notification>`, „[Request interrupted”
  i wyjście komend lokalnych to też wiadomości „user”; subagentów sesji mapuj po `toolUseId` z `agent-*.meta.json`. Sesja wznowiona kopiuje wpisy do
  nowego pliku — deduplikuj po uuid. Transkrypty żyją ~30 dni od ostatniej aktywności projektu (nie 7 tyg.); dłuższą historię poleceń daje
  `~/.claude/history.jsonl` (tylko CLI, od 2025-10-05; aplikacja desktop tam nie pisze). Średnie minut z sesji głównej są bezużyteczne (sesje na noc) — mediany.
- Operator woli notatkę z wynikami przeglądu jako osobny plik `*-DLA-OPERATORA.md` (narracja, bez tabel), nie tylko wiadomość w czacie.
- Przegląd D4 2026-09-23: nie przeliczaj znaków na tokeny jedną stawką — tekst polski ~2 zn/tok, schematy narzędzi ~3,6, nazwy MCP z UUID ~1,85; haiku liczy
  ten sam tekst jako 0,742 tokena opusa. Skład startu agenta jest w transkrypcie: `prompt_snapshot.tools` (schematy), `deferred_tools_delta.addedLines`,
  `skill_listing.content`, `instructions.files` — przed pierwszym wpisem `assistant`. Pierwsza tura opusa zapisuje cały start (cache_read 0), haiku czyta
  wspólny prefiks z cache. Liczbę „% kosztu”, której nie da się odtworzyć skryptem na transkryptach, traktuj jak hipotezę (tak padło „30–40%”).
- Panel run 2 (2026-09-24): skrypt Workflow ma limit 512 KB (bajty — polskie znaki po 2); duże dane wklejaj w skrypt generowany Pythonem (nie przez `args`,
  bo `args` pisze sesja główna — ~100k tokenów wyjścia), dane wspólne raz. `git log`/`git show` agenta to odczyt, nie alarm N1. **Ocena „na papierze”
  (sędzia czyta opis mechanizmu) przecenia skuteczność — dzisiejszy pipeline 33% przy prawdziwych 0%; decyzje o jakości tylko z prawdziwego przebiegu (6a pkt 28).**
- Plan testu review (2026-09-25): `git blame` na samej linii kotwicy uwagi bota myli się, gdy zakres kończy się `}` / `});` — bierz najpóźniejszy commit
  wśród nietrywialnych linii zakresu (i drugą regułę do raportu). Gałęzie PR-ów dzielonych („część serwerowa”) widać dopiero z `git log --all --full-history`
  (merge chowa gałąź boczną); commity skasowanych gałęzi (samodzielna rejestracja) są osiągalne przez commity bota z `pr-N-review-comments.json`
  (`rev-list --children --all <commity bota>`). Wątek bota ↔ przypadek B: porównanie po normalizacji białych znaków (`tresc_bota` ma usunięte bloki `<details>`).
  Raporty `review-faza-N.md` mają pięć formatów — parser P1/P2 sprawdzaj z licznikami „Statystyki”.
- Analiza wyniku testu (2026-09-27): metryki sumujące wszystkie jednostki mieszają fazy review z kontrolą fixa (dziś 0/30) — **zawsze licz `f-*` i `x-*`
  osobno** (notatka etapu podała „A +24 pkt”, z czego ¾ to fix). `dane/test-review/koszt.json` z runu etapu nie zawierał x-05dd804 — koszt całości licz
  `test_review_wynik.koszt` na pełnej liście jednostek (analiza robi to do katalogu tymczasowego). Hook `md-guard` blokuje też heredoc, którego TREŚĆ
  zawiera „.md” (np. klucze `…/review-faza-2.md#3` w JSON) — takie pliki JSON pisz narzędziem Write. Wariant 0 zapisuje reviewera findingu w `_zrodlo`
  (kontrola fixa: `zrodlo` pre-skan/regresja/bramka-bez-testu-odmowy) — z tego wynika, czyje trafienia gubią nowe warianty.
- It. 1 (2026-09-30): repo szablonu ma teraz `tsconfig.json`, więc hook Stop szablonu `stop-build-check-enhanced.sh` uruchamia `tsc` po KAŻDEJ
  odpowiedzi w tym repo i blokuje ją przy błędach typów — `pnpm typecheck` przed końcem tury. Testy: `pnpm test` (glob `.claude/**/__tests__`),
  lint `pnpm lint` (workflowy przez procesor owijający jak runtime). Efort agenta jest w transkrypcie (pole `effort` wpisów `assistant`, 98,5%
  opus; haiku brak) — plik harnessu go nie ma. `background_tasks` w wejściu hooka Stop niesie id ZADANIA (np. `wkjkhis6s`), nie `wf_…`.
  Agent fixa zapisuje `commity[]` jako „hash opis” — do gita tylko pierwszy token. `stopRun` dokleja do KAŻDEGO powodu „UWAGA: poza katalogiem
  zadania…” — kategorię STOP-u licz z części przed dopiskiem. Rekord `agent` jest jednorazowy — zmiana logiki wyliczania wymaga podbicia
  `WERSJA_REKORDU` w `zbieranie.mjs` (inaczej stare rekordy zostaną ze starą logiką). Przegląd D5 zapisano 2026-09-23 10:07 UTC — porównania
  „sprzed D5” filtruj po tej chwili (run `wf_cf14fe26-014` z 15:57 był już po).
- Odczyt It. 1 (2026-09-30): run w projekcie roboczym = osobna sesja desktop otwarta W kopii (nie `change_directory`); kopia jako `git clone` lokalny
  + `git remote remove origin` (bez `.env`, bez `supabase/.temp`), `pnpm install`, sync `TEMPLATE_LOCAL_SRC=<szablon> PROJECT_DIR=<kopia> bash …/sync-template.sh`,
  potem commit syncu i fixture w kopii (git czysty), `.claude/.backups/` do `.git/info/exclude`. Plik harnessu runu:
  `~/.claude/projects/<slug kopii>/<sesja>/workflows/wf_*.json` — id runu da się znaleźć bez operatora. Porównując wersję rekordów w raporcie,
  sprawdzaj sumy przed/po podbiciu `v` (ostatni rekord per `klucz` wygrywa; raport po v4 = identyczny). Raport liczy pipeline po `run.workflow`
  (`dev-*` lub nieznany) — agenci analiz w tym samym pliku telemetrii mają 13 narzędzi i fałszują medianę kontekstu. Przy nowym polu w wyniku
  funkcji raportu istniejący `deepEqual` trzeba rozszerzyć — nazwij to w wyniku (zmiana kontraktu, nie osłabienie asercji).
- Plan poprawy (2026-09-30): `git apply --include=<plik>` bierze WSZYSTKIE hunki pliku — pojedynczy hunk tylko przez `skrypty/pa_hunk.py` (P0); `filterdiff`
  niezainstalowany. Diff prompt-auditu na HEAD 95e8763: `--check` OK, autopilot z przesunięciem −111 linii. Tagi w `PLAN-POPRAWY.md` muszą pasować do `RE_TAG`
  w `plan_poprawy_pokrycie.py` (tag spoza wzorca jest cicho pomijany — skończy się „BRAK” pozycji, nie błędem tagu); po każdej zmianie planu uruchom skrypt.
  Skrypt workflowu nie czyta plików: każdy nowy wynik skryptu (dossier, bramki) musi wrócić do orkiestratora polem schematu agenta, który go uruchomił (P7).
  Pisanie `.md` przez `python3 -` w Bash przeszło w tej sesji (hook md-guard nie zablokował) — mimo to `.md` domyślnie Write/Edit.
- P0 (2026-10-01): kopia do smoke'a TYLKO skryptem `przygotuj-kopie.sh` (oferty: `--env docs/reviews/2026-09-19-analiza-pipeline/dane/smoke-oferty-atrapy.env`);
  kod 7 = bazowe bramki kopii czerwone → NIE dawaj operatorowi komendy runu, napraw w kopii osobnym commitem i powtórz `(cd <kopia> && pnpm typecheck && pnpm test)`.
  Domknięcie execute uruchamia CAŁE `pnpm test` projektu — zastany czerwony test zatrzymuje run (STOP „partial”) niezależnie od fixture. Sync bierze pliki śledzone
  przez gita → zacommituj `.claude/` szablonu przed skryptem. Na macOS nie ma `timeout` w powłoce. Odczyt: `smoke_odczyt.py <wf_id>` (domyślnie vs R0 `wf_588f7b18-d71`);
  id runu = najnowszy `~/.claude/projects/*<slug kopii>*/*/workflows/wf_*.json`. Rekord `effort` agenta jest już w telemetrii (z transkryptu) — skrypt go nie liczy sam.
  Hunk z prompt-auditu: `python3 skrypty/pa_hunk.py H<nn> > /tmp/h.diff && git apply --check /tmp/h.diff && git apply /tmp/h.diff` (z katalogu repo).
- P1 (2026-10-01): „0 nowych trafień” prompt-auditu sprawdzaj na DODANYCH liniach diffu (import `SYGNALY`/`RX` z `pa_inwentarz.py`, linie `+` z `git diff -U0`,
  w `.js` bez komentarzy) — samo `pa_inwentarz.py` nadpisuje `dane/pa-sygnaly.*` i liczy całe pliki. Regex łapie m.in. `scope`, `poza zakres`, `4.5`, `w runie`,
  daty, `D1`–`D6`, `Krok N` na początku linii, wersaliki NIGDY/TYLKO/MUSI. Naprawa fikstury w kopii: zamieniaj datę WYGASANIA, nie każdą datę w pliku —
  test „30 dni od publikacji” liczy od stałego NOW. `tsc` w szablonie wymaga JSDoc `@param` w nowych testach `.mjs` (inaczej TS7006).
  Ślady „null”/„pusty wynik” z podsumowania sesji runu sprawdzaj w `subagents/workflows/<wf>/journal.jsonl` (wiersze `type: result`) i porównuj z R0.
- P2 sesja 1 (2026-10-01): test skryptu z podmienionym PATH — katalog z atrapami + dowiązania do narzędzi, których używa sam skrypt (`cat dirname find grep
  head tail tr`), node jako `process.execPath` (nie shim z `~/.local/bin`), spawn przez `/bin/bash` (ścieżka bezwzględna), HOME też fixture (ustawienia,
  pluginy, telemetria). Powłoka narzędzia Bash to zsh: `PIPESTATUS` nie działa — kod wyjścia bierz osobnym wywołaniem. Klucze Claude Code, których docs nie
  podają, ustalaj z binarki (`strings ~/.local/share/claude/versions/<wersja> | grep -o '.\{80\}<klucz>.\{80\}'`). `coolify version` wypisuje na stdout
  komunikat o aktualizacji przed wersją. Doctor nie zależy od jq (JSON czyta node). Kontrola prompt-auditu na dodanych liniach: przekaż do skryptu TYLKO
  pliki promptów (.md) — trafienia w komentarzach .sh/.mjs (np. „N2”) to konwencja komentarzy kodu, nie prompt.
- P2 sesja 2 (2026-10-01): `claude plugin validate` na katalogu bez `.claude-plugin/` przechodzi pusto (`--json` → `contents: []`) — nie traktuj „passed” jako dowodu.
  Wyszukiwanie w binarce Claude Code: `strings` całej binarki + grep z `.\{0,200\}` trwa > 2 min (timeout narzędzia) — zawężaj wzorzec do krótkiego klucza bez
  szerokich kontekstów albo pytaj claude-code-guide. Zachowanie Claude Code zależy od `.claude/settings.local.json` (gitignored globalnie u operatora) —
  sprawdzając szablon „jak u kursanta”, użyj świeżego `git clone`, nie katalogu roboczego.
- P3 sesja 1 (2026-10-01): frontmatter agenta — pola z binarki (lista `Np` przy `omitClaudeMd` w `~/.local/share/claude/versions/<wersja>`; szukaj
  krótkiego klucza w Pythonie `bytes.find`, nie `grep -a -o '.\{2500\}…'` — ten przekracza 2 min). `tools:` w pliku = lista po przecinku; nazwy MCP
  bierz z listy narzędzi serwera w sesji (ToolSearch / lista deferred), nie z `ideToolTitles` w `.mcp.json` pluginu (niepełne: brak `download_assets`).
  `pa_kontrola.py` i `pa_inwentarz.py` piszą do `dane/` — uruchamiaj na kopii skryptów w scratchpadzie (`skrypty/` + PROMPT-AUDIT*.md + `dane/pa-proponowany.diff`),
  wynik zapisuj obok bazy (`*-po-P3.*`). `pa_inwentarz.py` pomija podkatalogi `.claude/hooks/` (filtr `os.path.isfile`, poprawione 2026-10-01).
  Przy kontroli dodanych linii pomijaj linie konfiguracji frontmattera (`model: haiku` łapie wzorzec 1d-modele-przypiete). Nowe pliki agentów pojawiają się
  w liście agentów sesji głównej od razu — opis klasy mówi „z sesji nie używaj”.
- P3 sesja 2 (2026-10-02): pola `meta` workflowu, które naprawdę działają, ustalaj z binarki (funkcja walidująca meta zwraca tylko name/description/title/
  whenToUse/phases; nieznane pole NIE jest błędem — znika po cichu). Szukaj w Pythonie `re.finditer` po krótkim kluczu i drukuj okno ±600 B tylko tam,
  gdzie w oknie jest „workflow” (całość < 1 min). Efort i model agenta w smoke'u: sekcja 4 `smoke_odczyt.py` (z transkryptu); skład startu agenta =
  wpisy przed pierwszym `assistant` w `subagents/workflows/<wf>/agent-*.jsonl` (załącznik `instructions.files[]` z rozmiarami CLAUDE.md i reguł —
  u klas z `omitClaudeMd` go nie ma). Pustych wyników szukaj w `journal.jsonl` (`type: result`, pole `result`), nie w podsumowaniu sesji runu.
  Testy statyczne wywołań `agent()`: opcje w JEDNEJ linii `{ schema: X, …, label: … }` — inaczej `wywolania-agentow.test.mjs` zgłosi niezgodność liczby.
  Sesja runu smoke'a kończy podsumowaniem z pytaniem do operatora („dać zielone światło?”) — to pytanie o kopię, nie zadanie dla sesji szablonu.
- P4 (2026-10-02): kopia oferty (kod 7) — data w `apps/server/src/mcp/tools/opublikuj-oferte.test.ts` siedzi w TRZECH miejscach: `EXPIRES_AT` (:57)
  i zdanie maila (:64, :347) → 2099; cel `replace` w :202 zostaje `24.09.2026` (30 dni od stałego NOW). Funkcje czyste workflowów testowane ekstrakcją
  bloku między kotwicami (`// ── Bramka wejscia (P4)` … `// ── Koniec bramki wejscia` w autopilocie, `// ── Archiwum (P4)` … `// ── Koniec archiwum`
  w complete-wf) — nowa funkcja do testu idzie do środka bloku, kotwic nie ruszaj. Etykieta `agent()` musi być literałem (mapa klas w
  `wywolania-agentow.test.mjs`): jedna funkcja z dwiema rolami = dwa wywołania w ternary, nie `label: zmienna`. Prompt-audit dodanych linii:
  `git diff -U0 main -- <pliki>` + `RX` z `pa_inwentarz.py` (import przez `importlib`, skrypt w scratchpadzie). Run STOP w kopii kończy się w sesji
  kopii pytaniem do operatora o naprawę main — to nie zadanie dla sesji szablonu.
- P5 (2026-10-03): smoke warunku „na main” w kopii — ff-merge poprzedniej gałęzi smoke'a do main kopii, nowa gałąź z commitu fixture (`027aa17`)
  + `git checkout main -- .claude`; bez tego `docs/completed/<zadanie>` i plik decyzji z tą samą datą kolidują z nowym runem. Format `git grep <ref>`:
  `<ref>:<ścieżka>:<linia>`; kotwica `^claude_md:` obowiązkowa (README indeksu ma tę frazę w środku zdania). `node --check` na workflowie zawsze pada
  (top-level `return`) — składnię sprawdza `skladnia-workflowow.test.mjs`. Test komendy powłoki z workflowu: uruchom ją (`/bin/bash -c`) na pliku
  tymczasowym z `PATH` zaczynającym się od `dirname(process.execPath)`. Tablica z funkcji wyciętej `new Function` = `any` → JSDoc `@type` przy
  zmiennej (TS7006 w callbacku). Prompt-audit: `python3 skrypty/pa_dodane.py <ref> <pliki>` — linia przeniesiona (nowy numer kroku) liczy się
  jako dodana.
- P5 sesja 2 (2026-10-03): kalibracja promptu workflowu bez runtime'u dev-pr — wygeneruj skrypt Workflow wprost z pliku workflowu (wycinki stałych
  i literału promptu, podmiany z asercją „dokładnie 1 trafienie”), suchy przebieg z atrapą `agent` przed uruchomieniem. Wynik runu czytaj z
  `journal.jsonl` (`type: result`), nie z pliku output zadania (ucięty). Wątek PR → komentarz: `reviewThreads.nodes.comments(first:1).databaseId`
  = `id` w `bot-comments.jsonl`. W zsh `echo =====` pada (`=cmd`) — separator `echo '---'`. Regex w teście: `export` nie ma „s” (`e[kx]sport` go nie łapie).
- P6 sesja 1 (2026-10-03): narzędzia projektu bez instalacji w szablonie — `~/test-review/_narzedzia/node_modules` (ESLint-wtyczki, knip, Stryker,
  size-limit, vitest, typescript 5.9) dowiązany jako `node_modules` projektu w scratchpadzie; size-limit wymaga pluginu w devDependencies
  `package.json` projektu (inaczej tylko komunikat „Install Size Limit preset”). Shim pnpm w `node_modules/.bin` liczy ścieżki od `$0` —
  dowiązanie do niego pada; w fixture skrypt `exec <szablon>/node_modules/.bin/<narzędzie> "$@"`. macOS: `/var` → `/private/var`, raporty
  narzędzi mają różne warianty — ścieżki z raportów porównuj po `realpath` (`wzgledna()` w `bramki/diff.mjs`). Parser diffu: nagłówki `---`/`+++`
  tylko między `diff --git` a `@@` (usunięta linia „-- komentarz” wygląda jak nagłówek). `pa_dodane.py` na plikach skryptów łapie `spawnSync`
  wzorcem `o5-delegacja-subagenci` — fałszywe; audyt dotyczy linii promptów. Pliki `.md` tylko Write/Edit, także przy hurtowej podmianie.
- P6 sesja 2 (2026-10-03): narzędzia bramek są w szablonie (`.claude/templates/bramki/node_modules` po `pnpm install`) — testy konfiguracji
  dowiązują ten katalog jako `node_modules` projektu-fixture. ESLint 10: konfiguracja szukana od katalogu PLIKU (nie cwd) — każdy `eslint.config.*`
  w podkatalogu staje się konfiguracją zagnieżdżoną; szablony konfiguracji trzymaj pod inną nazwą. `eslint.config.ts` na Node 22 wymaga `jiti`.
  typescript-eslint i Stryker nie działają z TS 7 (brak API JS); pnpm: `import('typescript')` z paczki bez deklaracji wspina się do korzenia →
  `packageExtensions` w `pnpm-workspace.yaml`. Stryker w pnpm: `plugins` jawnie; `tempDirName` w `node_modules` = „No tests were executed”.
  `tsc --outDir` nie czyści starego `dist` (Vite tak) — build fixture'u najpierw usuwa `dist`. vitest `--typecheck` nie podaje `location`.
  Kopia oferty: komendy podawaj operatorowi pojedynczo i po zakończeniu skryptu — wpisana w trakcie gubi pierwszy znak (`d` zamiast `cd`).
  Pusty wynik agenta sprawdzaj w `journal.jsonl` (`type: result`) — podsumowanie sesji runu potrafi tak nazwać poprawną pustą listę.
- P7 sesja 1 (2026-10-03): `KONTEKST` (review-wf) i jego kopia `DOSSIER` (execute-wf) są porównywane z opisami pól (`deepEqual` na `properties`) —
  zmiana opisu w review-wf wymaga odświeżenia kopii (wytnij `const KONTEKST = {` … `required: […]`, usuń linie `//`, podmień nagłówek). Moduł CLI
  z kodem na górnym poziomie nie może eksportować funkcji do testów (import uruchomi CLI) — wspólną funkcję trzymaj w osobnym module (`sciezki.mjs`).
  `git init` w testach: nazwa gałęzi domyślnej zależy od konfiguracji konta — test merge-base nazywa gałąź jawnie (`git branch -M main`).
  ajv: `import { Ajv } from 'ajv'`; `ajv.validate(schema, x)` zawęża typ `x` do `unknown` — waliduj `structuredClone(x)`. Test „pole nieobecne w prompcie”
  na słowie potocznym (`mutanty`) łapie też zwykłe zdanie — zmień brzmienie promptu, nie test. ESLint `no-regex-spaces`: dwie spacje w regexie → ` {2}`.
  `pa_dodane.py` na workflowach łapie `!!` w kodzie JS wzorcem `1a-wykrzykniki` — fałszywe (audyt dotyczy linii promptów).
- P7 sesja 2 (2026-10-04): test `wywolania-agentow` liczy `agent(` i linie `{ schema: X, … label: }` — wrapper `agentZe…(` rozjechałby liczniki;
  stąd `agent(zeStanem(polecenie), { schema: … })` + `potwierdzStan(wynik)` zamiast opakowania. Wstawianie pola do schematów skryptem po
  `\n  },\n  required:` trafia w PIERWSZE takie miejsce — w `FIX_RESULT` przed `required` stoją komentarze, więc pole wpadło do `POSTFIX_VERDICT`
  (test schematu to złapał). Blok doklejany następcy na końcu polecenia z jawnym „przed zadaniem” i zdaniem, że zapis wygrywa z „nie zmieniaj plików”.
  Kopia smoke'a z oferty-online: od 2026-10-01 baza czerwona (data `EXPIRES_AT` w teście MCP minęła; strażnik czasu `markup-scan` pod `pnpm -r`) —
  w nowej kopii powtórz commit środowiska z 6a pkt 54 (e) albo przenieś go `git fetch <stara-kopia> test/smoke-autopilot && git cherry-pick FETCH_HEAD`
  (fetch po SHA z lokalnego klonu nie działa). Zatrzymanie runu do testu wznowienia: operator pisze w sesji „zatrzymaj workflow”, potem wpisuje
  slash-komendę jeszcze raz — nie „uruchom ponownie” (sesja może to wziąć za `resumeFromRunId`, a resume odtworzyłby dossier z cache).
  Identyfikatory runów kopii: `~/.claude/projects/-Users-…-Kodowanie--<kopia>/*/workflows/wf_*.json` (operator nie musi ich podawać).
- P8 sesja 1 (2026-10-04): ekstrakcja funkcji używającej stałej z workflowu (`BLOK_DLUGIE_KOMENDY`) — podaj ją jako parametr `new Function('BLOK…', kod)('')`;
  schematy odwołujące się do innych stałych wycinaj razem w kolejności definicji. Wynik `new Function` to `any`, więc callback na nim
  (`.map((p) => …)`) pada w `tsc` na TS7006 — typ parametru w JSDoc inline. `[]` w obiekcie testowym bez typu = `never[]`. Usuwając agenta z pętli,
  sprawdź liczniki w `stan-fazy.test.mjs` (`oznaczStan()`) i `wywolania-agentow.test.mjs` (mapa klas, efort). Usuwając rolę, nie wyjmuj jej
  z `ROLE_Z_OGONEM`, gdy jest prefiksem innej (`fix:` → skleja się w `fix`). Słowa z `pa_inwentarz.py` w nowych liniach promptu: TYLKO,
  WYŁĄCZNIE, MUSI, ZAKAZ, „poza zakres”, linia od „Jestes …” — prompt kontroli zaczyna się od „Kontrola commitow fixa fazy N”.
- P8 sesja 2 (2026-10-04): `new Function('x', kod)` bez wywołania ma w `tsc` typ `Function` (TS2322 przy JSDoc z sygnaturą) — fabryka
  `new Function(\`return (x) => {…}\`)()` daje `any`. Stała z szablonem na górnym poziomie workflowu (`smokePrompt` w complete-wf) wycina się
  od `const X = \`` do ostatniego zdania literału. `pa_dodane.py` liczy jako dodaną KAŻDĄ przełamaną linię — przeniesione stare „WYLACZNIE”
  wraca jako trafienie. Kontrola fixa: listy wymagające „zmian tylko w miejscu findingu” muszą wyłączać katalog zadania, bo fix sam go edytuje
  z polecenia (checkboxy, zwinięcie, known-issues) — inaczej tura poprawek cofa księgowość. Journal runu: `~/.claude/projects/*/*/subagents/
  workflows/<wf>/journal.jsonl`; polecenie agenta = wiadomość `user` w `agent-<id>.jsonl` po przekazie harnessu (pierwsza linia to przekaz).
  Kopia oferty: `vi.setSystemTime(NOW)` na górnym poziomie pliku testu działa bez `useFakeTimers` (mockuje tylko `Date`).
- P9 sesja 1 (2026-10-04): sesja headless `claude -p` przepisuje args Workflow z wiadomości — duży JSON (~10 KB) bywa podany jako tekst albo
  z błędem nawiasu; dane wklejaj do skryptu (`const wejscie = {…}`) i podawaj `args={}`. Wynik runu z `agentow: 0` i `ms` < 100 = puste wejście,
  nie werdykt. `KD.sklad()['koszt']` jest w jednostkach (÷ 1e6 = M). Stare `sceptycy0.fids.json` mapuje opis → sam F-id. Test wycinający funkcje
  z workflowu: liczniki trzymaj w jednym obiekcie (`const sceptykLiczniki = {…}` jedną linią) — wycinek `wytnij('const X', '}')` łapie go razem.
  Sufity promptów z poprzednich paczek (scribe 7000 zn.) pękają przy dopisaniu linii — skracaj treść, nie test. Heredoc z `'''…'` w Pythonie
  (literał kończący się apostrofem) nie parsuje się — dłuższe łaty pisz do pliku w scratchpadzie.
- P9 sesja 2 (2026-10-04): katalog kopii dla odczytu = `cwd` z pierwszego wpisu `agent-<id>.jsonl` (nazwa katalogu w `~/.claude/projects/` jest
  stratna: `_` → `-`). Identyfikator runu: najnowszy `wf_*.json` w `~/.claude/projects/*smoke-P<n>*/*/workflows/` — w sesji kopii bywa kilka runów
  (STOP doctora przed właściwym). Skrypty odczytu przy 300 liniach: nowe sekcje w osobnym module importowanym przez `smoke_odczyt.py`.
  Pola potwierdzenia spoza `required` (np. `stanZapisany`) haiku potrafi pominąć — wynik bez pola, nie `false`.
- P10 sesja 1 (2026-10-04): skrypty `.claude/scripts/` działają w projekcie bez zależności szablonu (`yaml`, `ajv` są tylko w devDependencies
  szablonu) — frontmatter parsuje własny `frontmatter.mjs`; globy `path.posix.matchesGlob` (Node 22, bez ostrzeżenia; `**` nie łapie plików
  z kropką). Test wycinający schemat po dosłownej linii `required: [...]` (`domkniecie-bramki.test.mjs`) pęka przy każdym nowym polu w `required` —
  zmieniaj kotwicę, nie asercje. Na repo-fixture `docs/solutions/../x.md` rozwiązuje się do `docs/x.md`, nie do korzenia (test ścieżek).
  `pa_dodane.py` nie dotyczy sesji bez linii promptów. Kandydaci konwersji z oferty: `node .claude/scripts/wiedza/wiedza.mjs konwersja przygotuj
  --projekt ../oferty-online` (sam odczyt + `git ls-files`).
- P10 sesja 2 (2026-10-05): oferty-online od `eb63043` czyta `VITE_*` przy imporcie (`requireBuildEnv`) — kopia potrzebuje `.env` z atrapami
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_OFFER_ORIGIN` (`envDir` = korzeń repo; plik ignorowany, czyste drzewo zostaje) albo
  `przygotuj-kopie.sh --env <plik atrap>`. Testy promptów na surowym źródle workflowu: backtick w szablonie to `\``, wzorzec musi go uwzględnić.
  Słowa z `pa_inwentarz.py` łatwe do przeoczenia w skillach: nagłówek od „Krok N” (choreografia), „4.5” (model przypięty), „subagent”, „scope”
  (małymi), „do N znaków/zdań”. Kontrole P10 smoke'a bez skryptu: telemetria `grep '"run":"<wf>"' ~/.claude/telemetry/pipeline.jsonl` → `faza.wiedza`,
  `agent.kontekst.learned_zn`; prompt buildera = wiadomość `user` w `agent-<id>.jsonl` (meta `build:IU-n`) z „Wyuczone reguly projektu:”;
  wynik runu (`indeks`, `wiedza`, `propozycjeBramek`) z `<sesja>/workflows/<wf>.json`.
- P10 sesja 3 (2026-10-05): kontrole P10 smoke'a robi teraz `smoke_odczyt.py` (sekcje 2f–2h z `smoke_wiedza.py`); wywołanie wycinka przez agenta
  to `tool_use` Bash z `wiedza.mjs wycinek` w `agent-<id>.jsonl`, wynik w `tool_result` (JSON z `tresc`). Commit środowiska kopii oferty przenoś
  `git -C <stara-kopia> format-patch -1 <hash> --stdout > p && git am p` (`git fetch <ścieżka> <skrót>` pada: skrót to nie ref). Test na surowym
  źródle workflowu, którego linia zawiera backtick: w wzorcu `\\\``. `WPIS_WIEDZY` w wyniku compoundu nie ma `paths` (klasa, regula, szczebel,
  szczebelPowod, plik). Kopię oferty do smoke'a P10+ trzeba przekonwertować (`/dev-compound-refresh --konwersja` w sesji kopii) i dopisać linię
  w CLAUDE.md (commit `8c06515` z `_smoke-P10-oferty-online` przez `format-patch`), zanim odpali się run.
- P11 sesja 1 (2026-10-05): `pa_dodane.py` łapie `!!` w KODZIE JS jako wykrzyknik (`1a-wykrzykniki`) — fałszywe trafienie, nie prompt; łańcuch
  `… && pa_dodane.py | tail -1 && git commit` NIE zatrzymuje się na trafieniach (skrypt kończy się kodem 0) — sprawdzaj `TRAFIEN: 0` przed commitem.
  Test D6 (`agenci-pipeline.mjs` → `effortLinii`) czyta efort z linii opcji `}, tiery.X)`; różny efort per wpis `REVIEWERZY` wymaga osobnej linii
  opcji (`wywolajOs`). Suchy bieg review-wf bez tokenów: `node skrypty/test_review_suchy_bieg.mjs .claude/workflows/dev-docs-review-wf.js
  '<args JSON z polem dossier>'` — pokazuje routing, efort każdego agenta i przejście do scribe. Heurystyka zdań nakazowych w `warstwa-stala.mjs`
  to słownik — nowe czasowniki w trybie rozkazującym, których plik używa poza blokiem, dopisz do `ROZKAZUJACE` z testem.
- P11 sesja 2 (2026-10-05): `pa_dodane.py` pomija tylko komentarze `//` — linia JSDoc ` * … (PANEL-WYNIK D5)` daje trafienie
  `2-historia-incydenty` (`D[1-6]`, `L\d`, `N\d` też); w JSDoc pisz temat zamiast identyfikatora. `node --test <katalog>` nie uruchamia testów
  z katalogu (wynik „not ok 1 - <katalog>”) — podawaj pliki albo `pnpm test`. Czerwony test na starym kodzie bez cofania pracy:
  `git stash -q -- <plik kodu>; node --test <test>; git stash pop -q`. `REVIEWERZY` w teście: `new Function(\`${wytnij('const REVIEWERZY = [',
  '\n]')}\nreturn REVIEWERZY\`)()`. Blok mutantów w dossier parsuje opis z `stryker.mjs` (`<status>: <zamiennik>`) — zmiana formatu opisu
  w bramce wymaga zmiany `bramki-blok.mjs`. Pliki `.md` w `.claude/agents/` pisz narzędziem Write (hook `md-guard`).
- P11 sesja 3 (2026-10-05): warunek „X w profilu stacku” sprawdzaj na realnym projekcie testowym przed wpisaniem do pliku roli — oferty to
  monorepo i framework siedzi w `apps/*/package.json`, nie w korzeniu (profil czytał tylko korzeń). Testy bloku mutantów kotwiczą go `$`
  na końcu dossier — nową sekcję bramek wstawiaj przed mutantami. Kotwice wycinania bloków wspólnych to linie `=== KONIEC BLOKU …`
  (`scribe-p3`, `reviewer-prompt`) — przy przepisywaniu treści zostaw znaczniki. `pa_dodane.py` łapie „kiedyś” (`2-historia`) także w cytowanym
  przykładzie nitu. Moduł CLI doctora (`warstwa-rol.mjs`) testuje się przez `doctor.sh` w `doctor.test.mjs` (wiersz tabeli), nie importem.
  Pełne `pa_inwentarz` całego pliku (nie tylko dodanych linii) przez `importlib` + pętlę po liniach bez `//` — szybki sposób, żeby zobaczyć
  stare wersaliki w blokach, które czytają reviewerzy.
- P11 sesja 4 (2026-10-06): rsync bez `--checksum` POMIJA plik o tym samym rozmiarze i czasie modyfikacji — nakładka zostawiłaby stary plik roli
  (złapał to test nakładki). Hash wariantu = drzewo `git rev-parse <ref>:.claude`, nie commit (commity docs/reviews przesuwają HEAD gałęzi).
  Konfiguracja ESLint szablonu działa poza projektem przez reeksport `eslint.config.mjs` w korzeniu kopii (na czas przebiegu) → plik `.ts`
  w `_narzedzia/konfig` (importy pluginów stamtąd, `tsconfigRootDir: process.cwd()`); Node 22.22 ładuje `.ts` natywnie. W zsh `${(f)out}`
  w cudzysłowie nie dzieli linii — filtruj `print -r -- "$out" | grep`. Przebieg fazy: `skrypty/test_review_p11.sh przygotuj|suchy|faza <et>`
  (log w `~/test-review/p11/<et>/pilot.log` — przekierowanie przy uruchomieniu w tle), wynik `python3 skrypty/test_review_p11_cli.py wynik <et…>`.
  Ręczne mutanty reviewera (`sed -i` + vitest + przywrócenie) skan pokazuje tylko jako UWAGĘ `zapis Bashem poza kopią ['cp ']` — czytaj uwagi skanu.
- P11 sesja 5 (2026-10-06): `claude -p` czeka na zadania w tle najwyżej 600 s, potem kończy sesję i zabija workflow (status `killed`, w `.err.txt`
  „Background tasks still running after 600s”) — każda sesja headless z Workflow potrzebuje `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`
  (`test_review_sesja.srodowisko()`); pilot krótszy niż 10 min tego nie pokaże. Detektor zapisu Bashem na transkryptach: najpierw usuń treść
  heredoców i cudzysłowów, potem dziel na segmenty (`grep "a\|b"` i HTML w heredocu dawały fałszywe trafienia); `-i` sprawdzaj jako osobny argument
  (`faza-6-cta-i-webhooki` w nazwie pliku); cel przez zmienną i po `cd` do scratchpadu jest poza drzewem; `git stash list` to odczyt. Kopie smoke'a
  usunięte → commit środowiska kopii oferty odtwarzasz ręcznie (pkt 66 f), brzmienie linii CLAUDE.md jest w transkryptach
  `~/.claude/projects/*smoke-P10*` (`grep -rhoa '| \`docs/learned-patterns.md\` |[^"\\]*'`). Plik testów harnessu przy 300 liniach — nowy plik testów
  na nowy moduł (`test_review_p11_wynik_test.py`). Warianty trwają 4–9 min, więc 600 s przekracza już zwykła wariancja (pierwsza próba nowego
  w f-b8374c8 > 10 min, ponowna 6,7 min).
- P12 sesja 1 (2026-10-06): `pa_dodane.py` wzorzec `1b-kadencja-limit-slow` łapie każde „do / najwyżej / max N linii” — także próg rozmiaru kodu
  w regułach; pisz „próg: N linii na plik”. Operator nie ocenia treści technicznej (reguły, prompty, listy) — mimo „decyzja operatora wiersz po
  wierszu” w instrukcji: od razu recenzja subagenta + moje decyzje + krótka mapa (pamięć `feedback_review_subagenta_zamiast_akceptacji`).
  Projekt testowy oferty-online NIE ma `eslint.config.*` ani narzędzi bramek (status `brak`) — „pilnuje ESLint” w szablonie nie znaczy „pilnuje
  w projekcie”. Telemetria `agent.kontekst.rules_zn` liczy pliki `.claude/rules/` z załączników transkryptu — miara, czy reguły weszły do kontekstu.
- P12 sesja 2 (2026-10-06): `pa_dodane.py` nie widzi plików nieśledzonych (`git diff main`) — przed kontrolą `git add -N`. Tekst przeniesiony
  do nowego pliku (protokół audytu, przegląd Supabase) liczy się jako dodany: wersaliki, „Krok N”, `scope` poprawiasz w miejscu, także w kodzie
  przykładu (usunięcie linii nie liczy się, zmiana tak). Weryfikacja poprawek tym samym recenzentem (SendMessage) jest tania (~110 s) i znalazła
  skutek, którego pierwsza runda nie widziała: nowy `partial` buildera zatrzymywałby autopilota w każdym projekcie bez lokalnej bazy. Przy zmianie
  znaczenia statusu wyniku agenta sprawdź, co z nim robi orkiestrator (`grep status` w autopilocie). zsh: `echo =====` to błąd (rozwinięcie `=`),
  separator `echo '----'`; `grep --include=*.md` bez cudzysłowu też pada.
- P12 sesja 3 (2026-10-06): równoległych wykonawców na rozłącznych plikach prowadzi plik wspólnych rozstrzygnięć z TABELĄ KANONÓW (moduł,
  miejsce definicji, API) — bez niej 5 wykonawców dało 4 ścieżki `ApiError`/`request` i 3 definicje tych samych hooków; przegląd spójności po
  rundzie zrób grepem importów (`grep -rhoE "from '@/[^']+'" | sort | uniq -c`). Raport subagenta wyciągaj z transkryptu do pliku skryptem
  (ostatni tekst asystenta > 3k zn z `tasks/<id>.output`), nie czytając go do kontekstu. Powiadomienia pomocników recenzenta trafiają do sesji
  głównej, nie do recenzenta — recenzent czeka w nieskończoność; napisz mu SendMessage, że wyniki pomocników są u Ciebie. Przykłady kodu w skillach
  sprawdzaj `tsc` na prawdziwych typach (środowisko w scratchpadzie z symlinkiem `node_modules` z projektu z zod/RHF/TanStack) — 4 wzorce
  „wyglądające dobrze” nie kompilowały się (generyczna koperta zod, `useForm<T>` przy `.default()`). Dobór D10 po samym globie `**/*.ts*` daje
  builderowi UI zdania o warstwie danych; przy wspólnym limicie szerokie zdania wypierają wąskie — kolejność przy remisie: węższy glob pierwszy.
- P12 sesja 4 (2026-10-07): `baza` w `dane/test-review-fazy.json` to commit sprzed REVIEW fazy, nie sprzed implementacji — dla buildu bierz rodzica
  ostatniego commita `feat` w zakresie (bywa w nim druga faza albo commity docs/.claude po implementacji). Dobór D10 działa po POLU PLIKI planu
  (także katalogach), nie po plikach, które builder faktycznie utworzy — „klucz osiągalny” licz po IU. Skan przecieku: każdy wzorzec ścieżki kotwicz
  od jej korzenia (`/tmp/review-` łapało `<w>-pliki/tmp/review-*`), domknięcie zwraca w wyniku własne ścieżki `/tmp` fazy (fałszywy przeciek
  przy każdym buildzie); `../..` w Bashu buildera to zwykle importy i `cd` w monorepo — izolację daje chmod 000 reszty testu na czas SESJI, nie regex
  (zbiór wyniku, `meta` i skan po otwarciu; `odrzuc` przed zamknięciem). Skan, który czyta coś z kopii historycznej, nie może iść przy chmod — lista
  commitów z przyszłości do pliku przed zamknięciem. Plik `.sh` w trakcie wykonania podmieniaj tylko przez nowy inode (`sed -i`, Edit), nie
  `open(...,'w')` (zsh czyta skrypt w trakcie). Edycje w Pythonie z heredoca, w których tekst ma `'''` i `[`/`(`, padają na składni — przy regexach
  z cudzysłowami użyj narzędzia Edit. Myślenie w transkryptach agentów jest puste (`thinking: ''` + podpis) — miary „co agent rozważał” tylko z tekstu.
  Reguła z `paths:` nie pojawia się jako osobny załącznik transkryptu; na main coding-rules (bez `paths:`) siedzi w załączniku `instructions`
  każdego agenta. Build oferty ≈ 4,7 M na wariant (z plannerem i domknięciem), nie ~2 M — 1 faza ślepego testu ≈ 14 M.
- P12 sesja 5 (2026-10-07): ślepy test na kopiach BEZ przekonwertowanej wiedzy mierzy reżim młodego projektu — zanim wyciągniesz wniosek
  o bloku w prompcie, policz `wiedza.mjs wycinek --zapobieganie --pliki <pole Pliki IU>` także w kopii po konwersji (reguły projektu idą
  pierwsze i zajmują limit). Zapowiedź „co dostanie builder” licz na PEŁNYM polu Pliki IU (z testem i migracją), nie na samym pliku źródła.
  Telemetria `rules_zn` = tylko załącznik startowy `instructions`; reguła z `paths:` to załącznik `nested_memory` z `path` (po Read/Edit pliku
  kodu, raz na agenta; po jawnym Read reguł nie dokleja się drugi raz). Skan sieci: builderzy uruchamiają zbudowany serwer i sprawdzają go
  `curl` na 127.0.0.1 — wzorzec sieci licz po argumentach wywołania. Podmiana funkcji w Pythonie przez wycięcie do `\n\n\n` zjadła definicję
  stojącą tuż za funkcją (`RE_RUN`) — po takiej edycji `git diff` przed uruchomieniem. Wyniki skryptu sklejonego z inną komendą (`…; ls`)
  parsuj `json.JSONDecoder().raw_decode`. Konwersję wiedzy do smoke'a przenosisz `format-patch` z poprzedniej kopii, gdy paczka nie zmienia
  konwersji (oszczędza sesję operatora).
- P13 sesja 1 (2026-10-07): parser planu testowany tylko na idealnym fixture przechodził 40/40 i gubił do 6 z 7 IU na realnych planach
  (execute-wf dopisuje adnotacje do nagłówków IU i pól planu technicznego) — parser markdownu sprawdzaj na WSZYSTKICH planach z dysku
  (`find ~/Documents/Kodowanie -path '*docs/plans/*-plan.md'`, 92 pliki: wyjątki, liczba nagłówków IU luźnym regexem vs sparsowane)
  i rób go fail-closed (niejednoznaczny zapis = problem z numerem linii, nie cisza). Test kontraktu nie może liczyć oczekiwań tym samym
  parserem, który testuje. Treść przepisywana do checkboxów musi być wolna od tokenów, po których konsumenci grepują (`[E2E]`, `Operator:`,
  `[P1-3]`, `[Manual]`) — jedno słowo w Weryfikacji dodaje „scenariusz” do prechecku. JSDoc: trzy backticki w opisie `@typedef` otwierają
  blok kodu i zjadają kolejne typedefy (TS2304 dla typów niżej). Python z heredoca w zsh: `${…}` w końcowym `grep` daje „bad substitution”
  po udanym skrypcie — sprawdzaj plik, nie kod wyjścia całego polecenia.
- P13 sesja 2 (2026-10-07): przepisany od nowa plik z promptem liczy się w `pa_dodane.py` cały jako dodany — wzorce łapią „subagent”
  (pisz „agent badawczy”, „narzędzie Agent z typem …”), „scope” (sekcja „Granice zakresu”), „N1”/„D1” (identyfikatory decyzji), daty,
  „do 500 znaków” (limit słów/znaków), „⚠️”, „nie wymyślaj”, „krótko”. Skill wiąż testem z jego skryptem: przykład z `references/` przez
  `sprawdzPlan` i `zadanieZPlanu` + mutacje — recenzja z próbą (plan pisany wg skilla) znalazła 4 P2 w walidacji, których przykład idealny
  nie pokazał. Glob `src/x/**/*.ts` nie dopasowuje katalogu `src/x` (posix.matchesGlob) — do wycinka podawaj ścieżki plików. Bootstrap
  autopilota porównuje gałąź z linią `Branch:` planu zadania (generator: `feature/<zadanie>`) — kopia smoke'a musi stać na tej gałęzi.
  Konwersja wiedzy w kopii bez sesji operatora: `claude -p "/dev-compound-refresh --konwersja" … < /dev/null` (pkt 73 f; sama commituje).
  Hook Stop nie zapisuje epizodów skilli żywej sesji — przed odczytem `node .claude/scripts/telemetria/zbierz.mjs --skan --szybko`.
  Sesja operatora z /dev-plan, która odpala Workflow, ma epizod dev-plan do następnego skilla (z czekaniem na run) — koszt planowania licz do
  wywołania Workflow (`smoke_p13.py`).
- P14 sesja 1 (2026-10-07): testy startujące procesy w tle sprzątaj w `test.afterEach` (padnięty test zostawiał serwery node
  i pliki w /tmp; jeden plik PID miał wartość 1 — `process.kill(-1)` zabiłby wszystkie procesy użytkownika); proces zawieszony
  (SIGSTOP) ignoruje SIGTERM do SIGCONT — zatrzymanie = SIGCONT + SIGTERM + SIGKILL po limicie. Tożsamość procesu z pliku PID
  sprawdzaj czasem startu (`ps -o lstart=`), nie samym PID-em ani konfiguracją. Przed zabiciem osieroconego procesu z testów
  sprawdź linię komend (`ps -axo pid,stat,command`). `ls` bez `-a` nie pokazuje plików z kropką — `.env.e2e.example` nadpisany bez odczytu (przywrócony
  z gita); przed Write w katalogu szablonu `ls -a` albo `git ls-files`. Decyzje „czy środowisko padło” opieraj na polach
  strukturalnych (przyczyna SKIP), nie na sygnaturach tekstu: `curl -s` wycisza błąd, a curl 8 pisze „Couldn't connect to
  server”, czego regex nie łapał. Python z heredoca z kilkoma `assert` przed zapisem: pierwszy padnięty assert = nic nie
  zapisane — przed ponowieniem `git diff --stat`. W zsh `grep --include=*.mjs` bez cudzysłowu = „no matches found”.
  `pa_inwentarz`: „w runie” = wzorzec historii (pisz „w trakcie runu”), WYŁĄCZNIE/TYLKO/MUSI wielkimi = nacisk. Proces
  `spawn(..., { detached: true, shell: true })` zabijaj grupą (`process.kill(-pid)`), inaczej shell ginie, a serwer zostaje.
  Agent w tle przerwany razem z sesją nie zostawia wyniku — weryfikację uruchom od nowa świeżym agentem z pełnym kontekstem.
- P14 sesja 2 (2026-10-07): dwie bramki tej samej decyzji (gotowość dev-plan i bootstrap) licz tą samą funkcją potrzeb
  (`potrzebyZadania`) — kopia warunku „scenariusze > 0” zgubiła makiety i bramka przepuszczała zadanie, które bootstrap
  zatrzymywał; sprawdzaj macierzą przypadków. Test martwych ścieżek łapie artefakty generowane w projekcie
  (`.claude/skills/weryfikacja/`) — wyjątek jawny + strażnik, że szablon ich nie ma; prefiks katalogu porównuj z `/` na końcu
  obu stron. `readdirSync(..., { recursive: true })` wchodzi do `node_modules` przed filtrem (8,8 tys. plików w monorepo) —
  własny walker z listą pomijanych katalogów. Trasy w realnych projektach siedzą w stałych (`path={OFFERS_PATH}`), w ścieżkach
  względnych zagnieżdżonego routera i w `frontend/src`; `<x>/src` bez pakietu frontendu (backend, CLI) daje ścieżki plików
  jako „trasy”. Regex w teście z `[^.]*` łamie się na kropce w nazwie pliku (`figma.png`) — kotwicz frazą w jednej linii.
  Test CLI wołający prawdziwe narzędzie (agent-browser doctor) — atrapa skryptu w PATH. Recenzent z mutacjami w worktree
  znalazł 5 przeżytych mutacji na 12 — przy skryptach z parserem/scalaniem dawaj recenzji polecenie mutacji. Agenci
  (`.claude/agents/*.md`) są buforowani w sesji: nowa treść roli działa dopiero w nowej sesji (smoke w S3).
- P14 sesja 3 (2026-10-08): zanim poprosisz operatora o nową infrastrukturę (projekt Supabase e2e), sprawdź, czym już dysponuje — ref-y
  z `.env*` porównuj skryptem po etykietach (A/B/C, ostatnie znaki refu), bez wypisywania wartości; operator miał projekt staging.
  `e2e.mjs sprawdz` na prawdziwym projekcie PRZED smoke'iem znalazł 2 problemy, których testy na fixture'ach nie miały (klucz publishable,
  baza e2e = dev) — próba na realnym projekcie przed każdym smoke'iem paczki E2E. Wartości `.env` ze spacjami zawsze w cudzysłowie: agenci
  wczytują plik shellem (`set -a; . .env.e2e`). Sesja operatora w trybie bypass permissions zmienia zachowanie agentów workflowu (Bash zamiast
  Read/Edit → reguły `paths:` się nie dołączają) — smoke'i porównywane z referencją uruchamiaj w tym samym trybie uprawnień. Moment awarii
  podłożonej w trakcie runu wyznaczaj stanem na dysku (`.autopilot-state.json` zapisany przed execute następnej fazy), nie logiem.

## 8. Instrukcja startowa następnej sesji (operator wkleja ją jako pierwszą wiadomość)

Stan po 2026-09-23: etapy 0–3, 4 pomiary, domknięcia D1–D6 i D5b gotowe; **przegląd domknięć na Opus 5.5 ZAKOŃCZONY** (`PROPOZYCJA-POPRAWEK-DOMKNIEC.md`):
D1–D6 PRZYJĘTE i wprowadzone (6a pkt 19). Najważniejsza zmiana z D4: dźwignia kontekstu ≈ 40–50% kosztu fazy (nie 25–35%), dźwignie nie sumują się, nowe
cele ctx_start. **Decyzje z D6 PODJĘTE 2026-09-23 (6a pkt 20):** koszyk D, dev-ideate, freshness-audit(+wf) i tryb ręczny execute/review WYPADAJĄ
(lista zmian §10, plan etapu 5); `cleanupPeriodDays` = 120 (higiena konta).
**MINI-RUN ZROBIONY i ZAAKCEPTOWANY 2026-09-23 (6a pkt 21, wiersz 3¾):** `MINI-RUN-WYNIK.md` + `MINI-RUN-DLA-OPERATORA.md`; wyniki wpisane do PANEL-WEJSCIE
(§11 = streszczenie a–f, §2a = ustalenia poboczne N1–N3), wersji operatora i mapy walidacji.
**PROMPT-AUDIT ZROBIONY i ZAAKCEPTOWANY W CAŁOŚCI 2026-09-24 (6a pkt 25, wiersz 3⅞):** `PROMPT-AUDIT.md` + `PROMPT-AUDIT-DLA-OPERATORA.md` + `dane/pa-proponowany.diff`
(nie naniesiony); prompty maszynerii = nowy obszar zmian szablonu (PANEL-WEJSCIE §10 „Obszar: prompty”, §2a zasady warstwy stałej i otwarte decyzje,
mapa walidacji §7 obu wersji, rekord D5 §10 pole `agent.effort`); ponowny prompt-audit przy każdej zmianie modelu i po wdrożeniu plików klas ról.
**TEMATY-INSPIRACJE ZROBIONE 2026-09-24 (6a pkt 26, wiersz 3⅞b):** mattpocock/skills + wystąpienie poteto (transkrypcja od operatora) → `INSPIRACJE-POCOCK-PSTACK.md`
+ wersja operatora; decyzje wpisane do PANEL-WEJSCIE (§2 pkt 14–16 nowe wymogi: mapa funkcji, granice warstw w ESLint, ogrodnik; §2a zasady 8–11, pytanie
„undefined”, otwarta decyzja builder ↔ reviewer; §10 zmiany poza panelem) i do mapy walidacji §8 obu wersji.
**PLAN PANELU DECYZYJNEGO (część A) ZAAKCEPTOWANY 2026-09-24 — następny krok: WYKONANIE w NOWEJ sesji (instrukcja „WYKONANIE PANELU” niżej):** `PANEL-PLAN.md` (12 otwartych decyzji D1–D12, D12
wchodzi (operator: „Tak”); zestaw historyczny 195 B z rubryką sędziego i kolumną kalibracyjną „dzisiejszy pipeline”; skrypt kosztu z walidacją na runie 20.09; 3 projektantów
per architektura A/B/C, sędzia w 3 porcjach, 3 sceptyków; 9 agentów Opus 5.5, ~10–16 M jedn.; dwa planowane zatrzymania) + `PANEL-PLAN-DLA-OPERATORA.md`.
Odpowiedzi operatora 2026-09-24: D12 WCHODZI; projektant C ZOSTAJE („koszty nas dziś silniej wiążą niż efekt”). Wykonanie w NOWEJ sesji — sesja planu miała
~400k tokenów kontekstu (koszt każdej tury); `.claude/` i CLAUDE.md bez zmian, więc N2 nie wymusza, ale nowa sesja jest tańsza. Instrukcja „AKTUALNA — PANEL DECYZYJNY” (część A) — WYKONANA. Kopia oferty-online w scratchpadzie 86e1644e może zostać do końca analizy; usuwanie tylko za zgodą operatora.

**Historia: MINI-RUN W TOKU (stan 2026-09-23 ~18:20, sesja 86e1644e) — zamknięte, zostawione jako zapis przebiegu:** plan `MINI-RUN-PLAN.md` + `MINI-RUN-PLAN-DLA-OPERATORA.md` ZAAKCEPTOWANY („Wszystko wygląda dobrze.
Wykonaj to proszę.”). Zrobione i policzone skryptami:
- **Krok 0 (model):** alias `opus` i brak `model` → claude-opus-5-5; pełny identyfikator przypina (także stary claude-opus-5); haiku → claude-haiku-4-5; start
  opus-5 vs 5.5 różni się o 7 tok na 77,9k (tokenizer ten sam → run 20.09 porównywalny wprost) — `dane/mr-krok0-model.txt`. Incydent: harness przekazuje każdemu
  agentowi wiadomość operatora z dopiskiem „prośba wygrywa z zadaniem skryptu”; agent haiku z trywialnym promptem wykonał ją (napisał pliki planu, nadpisane) — do raportu.
- **Seria D (pytanie d, ROZSTRZYGAJĄCE) GOTOWA:** 10 builderów `mr-builder-czysty` (omitClaudeMd, allowlista, bez skilli) w worktree, 5×100 vs 5×400 poleceń
  (pula 445 prawdziwych poleceń buildera — ODSTĘPSTWO: źródła rozszerzone o CLAUDE.md, feature-builder-fullstack i skille UI, bo sam builder danych dawał ~300),
  markery M1–M5 na 10/30/50/70/90% bloku: **25/25 vs 25/25 → BRAK DŹWIGNI** (kryterium §7); koszt ramienia 400 = 1,39 M vs 0,81 M jedn. (+72%). Sprawdzone czytaniem
  D400-4. Zastrzeżenie: markery to proste konwencje (efekt sufitu). `dane/mr-markery-wynik.{txt,json}`, pliki w `dane/mr-surowe/wyniki/D*`.
- **Seria F (pytanie f) GOTOWA:** plik harnessu powstaje TYLKO na końcu (także przy TaskStop, status killed); zabicie sesji `claude -p` w trakcie runu (SIGTERM
  i SIGKILL) → BRAK pliku harnessu, journal ze `started` bez `result`, przy SIGKILL osierocony proces Bash agenta; **hook Stop odpala się po odpowiedzi na
  task-notification** i dostaje `background_tasks` ze statusem runów — `dane/mr-harness.txt`, `dane/mr-surowe/stop-hook.jsonl`.
- **ODSTĘPSTWO (zatrzymanie, decyzja operatora):** sesja przeniesiona `change_directory` do kopii → agenci startują w kopii (`cwd` OK, agenci/skille z kopii), ale
  **instrukcje (CLAUDE.md, rules, MEMORY) dostają ze STAREGO katalogu sesji** — seria E1 w tej sesji ma złe instrukcje (`dane/mr-kontekst-sesja-przeniesiona-e1.txt`:
  sama allowlista wyszła 35,0% vs D4 37,8% — składnik narzędzi ważny, instrukcje nie). Operator wybrał: **serie E1, E2 i A1–A3 w OSOBNEJ sesji desktop otwartej
  w kopii** wg `…/scratchpad/mr/INSTRUKCJA-SESJI-W-KOPII.txt` (kopia: `dane/mr-surowe/INSTRUKCJA-SESJI-W-KOPII.txt`). **CZEKAMY na jej ostatnią wiadomość**
  (identyfikatory 5 runów: E1, E2, A1, A2, A3).
Kopia oferty-online (klon APFS, bez `.env`, bez `supabase/.temp`, bez remote, hook testowy Stop zacommitowany w kopii) i wyniki serii A leżą w scratchpadzie sesji
86e1644e: `/private/tmp/claude-501/-Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template/86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f/scratchpad/`
(`oferty-kopia/`, `mr/wyniki/A-n/`, `mr/stop-hook.jsonl`) — katalog tymczasowy: NIE restartować Maca przed skopiowaniem wyników A do `dane/mr-surowe/`.
Transkrypty sesji w kopii: `~/.claude/projects/-private-tmp-claude-501--Users-kacper-trzepiecinski-Documents-Kodowanie-workspace-template-86e1644e-2ec5-4e9a-9fbc-0ea67b5fac8f-scratchpad-oferty-kopia/<sesja>/`.
Drobne odstępstwa do wyniku: komórki E wybrane regułą mediany (reviewer z plikiem = spec-compliance-reviewer, bez pliku = test-coverage; „naprawiacz haiku” =
fix:pre-skan przez tę samą właściwość `rola()` co w d4r; mechaniczny opus niezmierzony, liczony z haiku ×1/0,759); wycinek learned-patterns w E2 = 886 zn (wpisy
nie mieszczą się w 1500); wiadomość operatora przekazana agentom serii D: „Wszystko wygląda dobrze. Wykonaj to proszę.”; pierwsze dwie próby f2 nieważne
(agent puścił sleep w tle / harness blokuje sam `sleep`) — ważne: TERM `wf_e8db4d90-026`, KILL `wf_75d849a3-0d0`.

**Instrukcja TEMATY-INSPIRACJE — WYKONANA 2026-09-24 (6a pkt 26), zostawiona jako wzór sesji na kolejne tematy operatora:**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Zadanie tej sesji: rozmowa o moich tematach-inspiracjach — podam je w następnej wiadomości. Panel decyzyjny NIE w tej sesji.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF.md §1, §2 (tabela etapów), 6a pkt 19–25, §7 (pułapki);
PANEL-WEJSCIE.md §0, §2, §2a, §10; PROMPT-AUDIT-DLA-OPERATORA.md. Decyzje z 6a obowiązują — nie pytaj o nie ponownie.
Potem potwierdź w 3–5 zdaniach, gdzie jesteśmy, i CZEKAJ na tematy.

Zasady: nic nie uruchamiaj ani nie zmieniaj w .claude/ i CLAUDE.md bez mojej zgody; subagentów tylko za zgodą (pokaż zakres i koszt);
liczby skryptem (skrypty/*.py → dane/), pliki .md tylko Write/Edit. Styl: gdzie problem → co go powoduje → co z tym robimy → co mi to da,
przy nawiązaniu do wcześniejszego tematu 2–3 zdania przypomnienia. Decyzje, które podejmę, wpisz po mojej akceptacji jako kolejne punkty
HANDOFF 6a (i do PANEL-WEJSCIE, jeśli dotyczą panelu), popraw instrukcję panelu w §8, zaktualizuj pamięć projektu, commit docs/reviews.
```

**Instrukcja PROMPT-AUDIT (6a pkt 24) — WYKONANA 2026-09-24, zostawiona jako wzór do ponownego audytu (6a pkt 25: przy każdej zmianie modelu;
przy powtórce zmień datę i porównaj z poprzednim `PROMPT-AUDIT.md`):**

```
/claude-api prompt-audit
Kontynuujemy analizę pipeline'u dev-* w workspace-template (sesja główna Opus 5.5, nowa po wyczyszczeniu kontekstu). Zadanie tej sesji: prompt-audit
maszynerii szablonu według przewodnika skilla, potem rozmowa o moich tematach. Panel decyzyjny (HANDOFF 6a pkt 23) NIE w tej sesji.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Zanim zaczniesz Step 0 przewodnika, przeczytaj: docs/reviews/2026-09-19-analiza-pipeline/HANDOFF.md §2 (wiersze 3¾ i 4), 6a pkt 15–24, §7 (pułapki);
PANEL-WEJSCIE.md §1, §2, §2a; MINI-RUN-WYNIK.md. To jest proweniencja: wiele zdań w promptach to lekarstwa na awarie udokumentowane w tej analizie
i w docs/solutions/ — takie zdanie zostaje, dopóki nie pokażesz, że awaria nie występuje na modelu docelowym.

Step 0 — ustalenia (wpisz je na górę raportu, nie pytaj):
- ZAKRES: .claude/skills/*/SKILL.md (+ pliki, które skille czytają), .claude/agents/*.md, teksty promptów w .claude/workflows/*.js (stringi przekazywane
  do agent()), .claude/rules/coding-rules.md, CLAUDE.md, .claude/templates/, komunikaty hooków z .claude/hooks/ trafiające do modelu. Poza zakresem:
  docs/, testy __tests__ (tylko sprawdź, czy diff ich nie łamie), skille do usunięcia z 6a pkt 20 (code-review, code-quality, gemini, dev-docs-update,
  bugfix, dev-ideate, freshness-audit + wf, tryb ręczny dev-docs-execute/review) — wymień je w inwentarzu jako pominięte.
- MODEL DOCELOWY: Opus 5.5 (claude-opus-5-5) dla sesji głównej, builderów, reviewerów i orkiestracji; Haiku 4.5 dla ról z model: 'haiku' —
  oceniaj każdy prompt względem modelu, na którym faktycznie jedzie. Przeczytaj shared/model-migration.md → Migrating to Claude Opus 5.5 (zmiany zachowania).
- STAŁE OGRANICZENIA: coding-rules.md to reguły operatora — tylko raport, zero hunków w diffie bez jego decyzji. Nie przepisuj imperatywów w skillach
  na łagodne rekomendacje: pamięć feedback „Skille mandatują akcje” — pasywne „zalecane X” Claude cicho pomija; atakuj nacisk (wersaliki, CRITICAL,
  powtórzenia), nie tryb rozkazujący. Mini-run (d): liczba poleceń nie jest dźwignią jakości — szukaj instrukcji, które szkodzą, nie długości.

Wykonanie: inwentarz i grepy sygnałów skryptem (skrypt do docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_*.py, wynik do dane/pa-*.txt), potem
czytanie w sesji głównej, proweniencja przez git blame. Subagentów nie uruchamiaj bez mojej zgody — jeśli skala tego wymaga, pokaż inwentarz,
podział i szacunek kosztu i zapytaj. Nie nanoś żadnych zmian w .claude/ ani CLAUDE.md.

Wynik (katalog docs/reviews/2026-09-19-analiza-pipeline/):
- PROMPT-AUDIT.md — raport wg Step 5 (lokalizacja file:line, cytat, wzorzec, dlaczego przestarzałe dla modelu docelowego, pewność, akcja), na górze
  założenia Step 0, liczby per grupa, 2–3 najważniejsze ustalenia; osobna sekcja „co z tego dla panelu decyzyjnego” (wpływ na warstwę stałą ról §2 pkt 3,
  które ustalenia są niezależne od panelu i mogą iść od razu jako zmiany szablonu §10);
- dane/pa-proponowany.diff — diff wg Step 6 (hunk = jedno ustalenie; tylko pewność wysoka/średnia), sprawdzony pod kątem testów __tests__;
- PROMPT-AUDIT-DLA-OPERATORA.md — narracja: problem → przyczyna → co proponujemy → co to daje, bez tabel i ścieżek.
Sprawdź oba dokumenty w obie strony. Oddaj mi wynik i CZEKAJ. Po akceptacji: HANDOFF (6a, §8), PANEL-WEJSCIE (§2a lub §10 — wejście panelu),
pamięć projektu, commit docs/reviews. Potem podam tematy-inspiracje.
```

**STAN WYKONANIA PANELU PO RUN 1 (sesja 6e626ae3, 2026-09-24) — wejście dla sesji „KONTYNUACJA PANELU PO RUN 1”:**
- **Krok 0 ZROBIONY.** N2: repo czyste, ostatnia zmiana w `.claude/` 2026-09-06, CLAUDE.md szablonu nie istnieje. Skrypty kosztu (PANEL-PLAN §3) w trzech plikach:
  `skrypty/panel_koszt_dane.py` (transkrypty oferty-online od 09-06 → `dane/panel-koszt-referencja.json`: 949 agentów, 14 runów, 29 wykonań faz; rola() z poprawką —
  d4r zlewał fix:pre-skan/kontrola/poprawka w „fix”; starsze transkrypty bez `prompt_snapshot` liczone kosztem), `skrypty/panel_koszt_model.py` (jednostka roli: d4r pełna
  metoda, starty klas TOLk z mini-runu, tester = start buildera, zmiana modelu przez tokenizer 0,742), `skrypty/panel_koszt_projektu.py` (projekt 0 = `dane/panel-projekt0-role.json`,
  walidacja, projekty; przyjmuje też `dane/panel-run1-projekty.json` — konwersja pól `wywolania`+`per` z runu 1) → `dane/panel-koszt.{txt,json}`. Częstości warunków z 26 faz
  unikalnych 7 zadań: kod 0,96, testy 0,96, UI 0,58, migracja 0,27, [E2E] 0,50, zadanie z E2E 0,86; 3,71 fazy/zadanie, IU 2,69, findingi 26,7 na fazę.
- **Walidacja:** suma faz runu 20.09 projekt 0 = 32,86 M vs 31,60 M (**+4,0% — OK**); pojedyncze fazy −10,8% / +15,8% / +16,0% (średni koszt roli) — kryterium ±5%
  zinterpretowane jako suma faz, **operator jeszcze nie potwierdził tej interpretacji** (zgłoszone w notatce po run 1); dźwignia: kontrola mechaniki (Δ komórek mini-runu na 85 agentach)
  47,8% vs 47,7% OK; na startach agentów z transkryptu 51,8% (d4r 51,4%), projekt 0 w fazach 50,5% — różnica = start w kopii mini-runu ~5% niższy. Kontrola poza próbą:
  run 23.09 `wf_cf14fe26-014` (Opus 5.5) −9%, epoka 09-08..09-17 (duże fazy) **−39% → liczby bezwzględne projektów to dolna granica**, porównania względne.
- **RUN 1 ZROBIONY:** `wf_43f84562-c04`, skrypt `skrypty/panel-run1.js`, wynik `dane/panel-run1-projekty.json` (klucze A/B/C), 5,15 M jedn., 3/3 `claude-opus-5-5`,
  zero narzędzi zapisu (`dane/panel-modele.txt`; alarm B był fałszywy — `>0` w kodzie Pythona, regex poprawiony), 3/3 kompletne (`dane/panel-kompletnosc.txt`, bez tury naprawy).
  Koszt zadania vs projekt 0 po zmianie kontekstu: **A −15,2%, B +3,1%, C −26,6%** (vs dziś −59% / −50% / −64%); agentów na fazę A 20,5, B 23,8, C 13,7 (dziś 28,4).
  Katalogi: A 92, B 84, C 69 pozycji. Zbieżność: D3, D5, D8a, D8b, D9, D12; rozbieżność: D2 (A grupa po pliku, B/C batch 4; P1: A/B 3 sceptyków, C 1), D4, D6, D11.
  Konflikty ze szkieletem zgłoszone przez projektantów (do syntezy): A usuwa verify-fix; B dedup → agregator + dwie próbki fix:kontrola; C bez agenta dedup, db-sync tylko przy migracji.
- **Pułapki tej sesji:** `from panel_koszt_model import` zostawia `skrypty/__pycache__/` — usuwaj po uruchomieniu; skrypt Workflow zapisuje się w katalogu sesji pod slugiem
  bieżącego cwd — kopię daj do `skrypty/panel-run{2,3}.js`; `panel_modele.py <run…>` szuka runów we wszystkich sesjach workspace-template (podaj na końcu wszystkie runy panelu naraz).
- **Nic nie jest zacommitowane** (nowe pliki w `dane/` i `skrypty/`, zmiany w HANDOFF) — commit docs/reviews dopiero po akceptacji wyniku panelu.

**STAN PO RUN 2 (sesja 1bd5477f, 2026-09-24/25) — TWARDE ZATRZYMANIE §10 (kalibracja) → DECYZJA OPERATORA 6a pkt 28: żadna koncepcja nie odpada przed
prawdziwym testem; następny krok = PLAN prawdziwego testu review (instrukcja „PLAN TESTU REVIEW” niżej); run 3 wstrzymany:**
- **Operator potwierdził** kryterium walidacji kosztu jako sumę faz runu 20.09 (+4,0% OK); pojedyncze fazy tylko do raportu.
- **Katalog projektu 0:** `dane/panel-katalog-projekt0.json` — 60 mechanizmów z obecnych `.claude/` (review-wf, autopilot-wf, execute-wf, pliki reviewerów i builderów,
  skille wstrzykiwane, coding-rules); learned-patterns jako jedna pozycja bez treści (treść zależy od epoki); oferty-online nie ma konfiguracji ESLint.
- **Run 2:** skrypt generowany `skrypty/panel_run2_przygotuj.py` + `panel_run2_szablon.js` → `skrypty/panel-run2.js` (dane wklejone w skrypt jako stała zamiast
  `args` — ta sama funkcja, bez ~100k tokenów wyjścia sesji głównej; limit skryptu 512 KB wymusił katalogi raz + neutralne klucze). **Odstępstwo:** 4 porcje zamiast 3
  (S1 correctness 77 → S1a 39 + S1b 38), permutacja pełna 4×4; `klasy_docelowe` usunięte z katalogów (deklaracja autora, nie brzmienie), id neutralne `<etykieta><nr>`;
  mapowanie `dane/panel-run2-mapowanie.json` (w scratchpadzie do końca runu). Medium `wf_13ccd655-c60` 1,98 M → kalibracja **41,5%** (> 15%), próbka 10: 6/10 to ogólna
  procedura correctness R0-COR jako LISTA niska → łagodność potwierdzona → eskalacja high `wf_5d575d67-507` 2,34 M → **32,8% — ponownie > 15% = STOP §10.**
  Model 8/8 claude-opus-5-5, zero zapisu (`panel_modele.py` — regex git poprawiony: git log/show to odczyt), zero odczytów docs/reviews przez sędziego.
- **Wyniki (high, B+L szeroko; `dane/panel-pokrycie.txt`, medium w `*-medium.*`):** wszystkie 0 32,8% / A 70,8% / B 63,6% / C 57,9%; P1/P2 39,4 / 79,5 / 73,5 / 68,9%;
  ogon 40,7 / 51,9 / 37,0 / 25,9%. **Wariant ścisły** (LISTA niska = MANDAT; §7 pliku): wszystkie 0 **3,1%** / A 45,1 / B 40,0 / C 28,2% (medium: 8,7 / 54,9 / 47,7 / 38,5%) —
  kolumna 0 pod progiem w obu efortach; ranking A > B > C stały we wszystkich czterech wariantach. Stabilność medium vs high: zgodność B+L 87–91%.
  Kolumna 0: LISTA z R0-COR 37 i R0-SEC1 (tryb atakującego) 20 — dzisiejsze listy „obejmują” przypadki, które mimo to uciekły → pokrycie ≠ złapanie.
- **Przygotowane, NIEuruchomione:** `skrypty/panel_pokrycie.py` (wariant jako argv), `skrypty/panel_run3_szablon.js` + `panel_run3_przygotuj.py` (wejście: `dane/panel-run3-wejscie.json`
  z wstępnymi wyborami — jeszcze nie napisane). Pułapka: `panel_pokrycie.py` bez argumentu nadpisuje `panel-pokrycie.{txt,json}` wynikiem high.

**STAN PO PLANIE TESTU REVIEW (sesja 2026-09-25) — PLAN ZAAKCEPTOWANY (6a pkt 29); następny krok = „PRZYGOTOWANIE TESTU REVIEW” niżej:**
- Pliki: `TEST-REVIEW-PLAN.md` (§2 wybór faz i klucze, §3 kopie, §4 warianty, §5 bramki i sędzia, §6 sceptycy, §7 koszt, §8 D2–D12, §11 zatrzymania, §12 przebieg
  i lista skryptów do napisania), wersja operatora; dane `dane/test-review-{fazy,klucz2,plan}.{json,txt}`; skrypty `skrypty/test_review_{fazy,klucz2,plan}.py`
  (kolejność uruchamiania: fazy → klucz2 → plan; `test_review_plan.py` importuje `panel_koszt_model` i sam sprząta `__pycache__`).
- Zero agentów, zero zmian w `.claude/`, CLAUDE.md i oferty-online. Pilot: fazy b26128d, 2634b67, f3ee433 + powtórka b26128d + 2 commity fixa (moduł §2.6).
- Commit docs/reviews zrobiony w tej sesji (obejmuje też dane i skrypty panelu z run 1 i run 2).

**STAN PRZYGOTOWANIA TESTU REVIEW (sesja 83cd0aa0, 2026-09-25) — PRZYGOTOWANIE ZROBIONE, PILOT CZEKA NA ZGODĘ OPERATORA (nic niezacommitowane):**
- Notatka `TEST-REVIEW-PRZYGOTOWANIE-DLA-OPERATORA.md`; prompty do wglądu `dane/test-review/prompty-<et>.txt` i `prompty-wariant0.txt`; mapowanie warunków
  `dane/test-review-warunki.json`; koszt pilota `dane/test-review/koszt-pilota.txt` (środek 93 / górna 149 / limit 224 M jedn.); przegląd klucza 2 `dane/test-review/klucz2-przeglad.json`.
- Skrypty (kolejność): `test_review_kopia.sh` (stan / narzedzia / kopia) → `test_review_bramki.py` → `test_review_wariant0.py` (kontrola bajtowa, 27 różnic
  dozwolonych, 18/18 wycinków) + `test_review_warianty.py` (moduł `test_review_dossier.py`, szablon `test_review_wariant_szablon.js`) → `test_review_sedzia.py klucze|pula`
  (szablon `_sedzia_szablon.js`) → `test_review_sesja.py start|zbierz` (claude -p, deny, budżet) → `test_review_sceptycy.py wariant0|przygotuj` (szablon
  `_sceptycy_szablon.js`) → `test_review_skan.py` → `test_review_wynik.py koszt|limit|metryki`; całość `test_review_uruchom.sh proba|pilot|faza`; suchy bieg
  `test_review_suchy_bieg.mjs` (atrapa agent(), zero modeli).
- Poza repo: `~/test-review/` (lustro, kopie f-b26128d, f-2634b67, f-f3ee433, f-b26128d-r2, x-411a434, x-05dd804; narzędzia; skrypty per faza; klucze sędziego;
  pełne prompty). Pułapki: ESLint typowany PRZED buildem shared = fałszywe no-unsafe-* (naprawione: typecheck przed ESLint); knip --production liczy tylko wpisy
  z „!”; size-limit wymaga package.json w katalogu uruchomienia.
- **PRÓBA HARNESSU ZROBIONA (za zgodą operatora, 2026-09-25):** (a) workflow z 1 agentem haiku — `RUN wf_756aaf23-38e completed`, plik runu i transkrypt agenta
  (claude-haiku-4-5) na dysku; (b) deny z --settings działa — Read pliku z Documents: „File is in a directory that is denied by your permission settings”;
  (c) workflow z 5 agentami haiku po kolei — sesja `claude -p` trwała 48 s i zwróciła `completed` z kompletem wyników → **-p czeka na koniec Workflow w tle**.
  Koszt próby ≈ 1,05 USD (3 sesje). Poprawka po próbie: stdin `claude -p` z /dev/null (ostrzeżenie „no stdin data received in 3s”).
- **PILOT ZROBIONY (2026-09-25, sesja fb33cacc, konto CLI automatyzacje@aibiz.pl):** 6/6 faz (3 fazy + powtórka b26128d + 2 commity fixa), końcowe skany 0 twardych,
  0 ról null / 194, stan po BEZ ZMIAN. Koszt 43,7 M jedn. (+5,7 M odrzuconej próby) vs środek 93,4. Liczby: `skrypty/test_review_pilot.py probka|wynik` →
  `dane/test-review/pilot-{zgodnosc,stabilnosc,koszt,szczelnosc,kalibracja}.json`, `pilot.txt`, `pilot-kalibracja-{probka,oceny}.json`; metryki `metryki.txt`.
  Kalibracja 0/20 (próg 15%), granica PEŁNE/CZĘŚCIOWE miękka (3/10 w szarej strefie) → porównania na „szeroko”; zgodność p1/p2 szeroko 148/148 → w etapie
  głównym 1 permutacja. Etap główny po pilocie (proporcja wariantów 0,43 × szacunek „dziś” + narzut 1,87 M/fazę): 50% ~152 M, 75% ~250 M, pełny ~427 M.
  Notatka `TEST-REVIEW-PILOT-DLA-OPERATORA.md` — **przyjęta 2026-09-26: zakres 50% (13 faz), r=1, moduł fixa zostaje, limit ~300 M (6a pkt 30)**;
  następny krok = przygotowanie etapu głównego bez agentów w nowej sesji (tryb „etap” w `test_review_uruchom.sh`, LIMITY w `test_review_wynik.py`,
  kopie + bramki 13 faz i commitów fixa, suchy bieg), start na osobny znak operatora.
- **Zmiany mechanizmu w pilocie (wszystkie przetestowane):** skan zatrzymuje wyłącznie wg definicji §11 (skutek: HEAD/`git status`/odcisk nakładki `.claude/`
  kopii; przeciek = odczyt miejsc zakazanych, 1 faza wypada, >1 = STOP; N1 = wykonanie wiadomości startowej) — reszta to UWAGI; wzorzec kopii innej fazy kończy
  nazwę katalogu (`f-b26128d` ≠ `f-b26128d-r2`); `test_review_sesja.py gotowy|odrzuc` — krok zrobiony = run completed + sesja bez błędu + zero `<synthetic>`,
  niedokończona próba → `~/test-review/odrzucone/` (koszt liczony); wznowienie = to samo polecenie (znaczniki `wyniki/<et>/_faza-ok`); null liczony per rola
  (harness ponawia agentów, którzy utknęli — „stalled … retrying”); metryki: „brak sceptyków” w fazach fix. Pułapki: CLI `claude` ma własne logowanie
  (sprawdzaj `claude auth status` przed runem — pilot padł raz na limicie tygodniowym innego konta); `<synthetic>` = błąd API wpisany przez harness.

**STAN PRZYGOTOWANIA ETAPU GŁÓWNEGO (sesja c1385269, 2026-09-26) — PRZYGOTOWANIE ZROBIONE BEZ AGENTÓW, START CZEKA NA ZNAK OPERATORA (nic niezacommitowane):**
- Jednostki: `skrypty/test_review_etap.py lista` → `dane/test-review/etap.{json,txt}`: 13 faz (pierwsze z `kolejnosc`) + 24 commity fixa (`fix_modul`, w tym 4 commity
  „kontrola diffu naprawczego”) = 37; **5 z pilota** (f-b26128d, f-2634b67, f-f3ee433, x-411a434, x-05dd804 — znacznik `_faza-ok`, wynik p1 wchodzi do etapu, nie
  powtarzane), **32 nowe** (10 faz, 22 fixa). Kolejność: najpierw fazy, potem fixy. Klucz 1: 89 (nowe 74), klucz 2: 66 (nowe 52).
- Koszt (`test_review_etap.py koszt` → `dane/test-review/etap-koszt.txt`, metoda z pilota): nowe jednostki środek 171 / górna 221 M; licznik limitu z jednostkami
  pilota 39 M → na końcu środek 211 / górna 260 M vs **limit 300 M** (`test_review_wynik.LIMITY['50%']`, stare 551/907/1549 usunięte).
- `test_review_uruchom.sh etap przygotuj` ZROBIONE (kopie ~/test-review/kopie/*, bramki `dane/test-review/bramki-*`, skrypty wariantów, klucze sędziego — 0 błędów;
  bramki nieuruchomione wyłącznie 3 „z definicji” jak w pilocie); `etap suchy` ZROBIONE (atrapa agent(): 128 skryptów wariantów wykonane, deny 149–150 wpisów,
  licznik limitu 39,18 / 300 M, null 0 / 143). `claude auth status` = automatyzacje@aibiz.pl (max). Refy oferty-online bez zmian od 25.09.
- Poprawki mechanizmu: (a) `test_review_warianty.py` — numer fazy także z tematu „kontrola diffu naprawczego fazy N”; (b) `test_review_sedzia.py` — pozycja klucza 2
  bez linii (1de5a4c260#4, plik .webp) nie gubi już ścieżki; (c) `test_review_uruchom.sh` — następny krok nie startuje na niepełnym wejściu (`krok_kompletny`: warianty,
  sędzia, sceptycy muszą być `gotowy`, inaczej STOP i wznowienie tym samym poleceniem; w pilocie sędzia mógł ruszyć na puli bez wariantu po limicie konta);
  (d) `test_review_kopia.sh stan przed-etap|po-etap` (stan „przed” zapisywany na starcie etapu); (e) `test_review_wynik.py metryki --etap` → `metryki-etap.txt`
  (tylko p1, klucz 2 bez „po weryfikacji”, bo sceptycy na kluczu 2 tylko w pilocie wg planu §6).
- Przegląd klucza 2 (10 nowych faz, `dane/test-review/klucz2-etap.txt`): wykluczone 2 pozycje (67f5f2cdf6#4 duplikat, 2536643737#6 nie-finding) →
  `dane/test-review/klucz2-przeglad.json`. Kotwica nieodnaleziona: 9d40529592 klucz2 #1 (linia 417 poza plikiem w stanie fazy), 1de5a4c260 klucz2 #4 (.webp).
- **Do wiadomości operatora:** raport `review-faza-N.md` jest w stanie commitu fixa tylko w 2 z 24 commitów (scribe commituje go po fixie; tak samo w pilocie) —
  kontrola fixa we wszystkich wariantach pracuje na samym diffie, jak dzisiejsza `fix:kontrola` (dostaje tylko numer fazy i ścieżkę), a zdanie w promptach A/B/C
  „Findingi … raport review-faza-N.md” wskazuje zwykle plik nieobecny. Zostawione jak w pilocie (porównywalność).
- Start (po znaku operatora): `zsh skrypty/test_review_uruchom.sh etap` w TLE, log `~/test-review/sesje/etap.log`; wznowienie = to samo polecenie. Nadzór po każdej
  jednostce: `dane/test-review/skan-<et>.txt`, `dane/test-review/koszt.txt`. Czas: jednostki po kolei, ~8–10 h; limit okna 5-godzinnego konta (~130 M) wypadnie
  zapewne raz — skrypt stanie na STOP „niedokończony”, wznowić po odnowieniu okna. Nie commitować w trakcie runu (stan „po” porównuje HEAD workspace-template).
- **ETAP GŁÓWNY ZROBIONY (2026-09-26, 15:35–18:50, start za zgodą operatora; wyniki pilota wzięte bez powtórki):** 37/37 jednostek `_faza-ok`, 0 wypadłych,
  0 przerwań, 0 ról null / 593, końcowe skany 0 twardych, kopie bez zmian, `stan po-etap` = BEZ ZMIAN. Licznik 183,6 / 300 M (z koszt.json: pilot 37,1,
  10 faz 95,4 vs 123,6 szacunku, 22 fixy 51,1 vs 47,7 → nowe 146,5 vs 171). Notatka `TEST-REVIEW-ETAP-DLA-OPERATORA.md`. Uwagi skanu 126: 95 zapisów Bashem do /tmp/scratchpadu,
  30 × haiku z narzędziami, 1 Write packagera zablokowany deny; wariant 0 (reviewer test-coverage, f-2536643) tworzył w kopii tymczasowe testy `zz-*.test.ts`
  i je usuwał — kopia czysta. Surowe metryki `dane/test-review/metryki-etap.txt` (p1, klucz 2 bez weryfikacji): klucz 1 szeroko 0 30% / A 54% / B 49% / C 51%;
  klucz 2 szeroko 0 84% / A 73% / B 71% / C 59% — bez kalibracji sędziego etapu, bez CI i przekrojów. Następny krok (zgoda jest, 6a pkt 31): analiza wyniku →
  `TEST-REVIEW-WYNIK.md` + wersja operatora w NOWEJ sesji wg instrukcji „ANALIZA WYNIKU TESTU REVIEW” niżej. Commit docs/reviews zrobiony 2026-09-27.
- **ANALIZA WYNIKU ZROBIONA I ZAAKCEPTOWANA (sesja d1754119, 2026-09-27, bez agentów; 6a pkt 32):** `TEST-REVIEW-WYNIK.md` (§0 skrót, §4 wynik główny z CI,
  §6 moduł fixa, §7 bramki i Stryker, §11 lista strat klucza 2, §12 D1–D12) + `TEST-REVIEW-WYNIK-DLA-OPERATORA.md` (wniosek na górze). Skrypt
  `skrypty/test_review_analiza.py probka|wynik` + moduły `test_review_analiza_{kalibracja,mechanizmy,tekst}.py` → `dane/test-review/wynik.txt` i `wynik-*.json`
  (wynik deterministyczny); wejście z lektury: `wynik-kalibracja-oceny.json`, `wynik-klucz2-opisy.json`. Decyzja: obecna architektura review zostaje
  + 3 dodatki (kontrola diffu fixa wg A, bramki lint/knip, lista mutantów dla reviewera testów) + obniżanie kosztu po jednym pokrętle; A/B/C nie idą
  dalej. **Run 3 POMINIĘTY (6a pkt 33).** Następny krok: „DECYZJE I PLAN WDROŻENIA” niżej.
- **DECYZJE I PLAN WDROŻENIA ZROBIONE I ZAAKCEPTOWANE (2026-09-27, bez agentów; 6a pkt 34):** `PANEL-WYNIK.md` (§0 skrót, §1 pokrętła kosztu K1–K13,
  §2 rekordy D1–D12, §3 cofnięte ustalenia, §4 plan w iteracjach, §4a pełna lista 65 ustaleń → iteracja, §5 docelowy pipeline, §6 ograniczenia,
  §7 kontrola) + `PANEL-WYNIK-DLA-OPERATORA.md`. **Następny krok: raporty etapu 5 w FORMIE SKRÓCONEJ (6a pkt 35)** wg instrukcji „RAPORTY ETAPU 5”
  niżej; bez publikacji jako strony. Potem wdrożenie It. 1 w osobnej sesji, z planem do akceptacji przed pierwszą edycją `.claude/`.
- **RAPORTY ETAPU 5 ZROBIONE I ZAAKCEPTOWANE (2026-09-28; 6a pkt 36):** oferty-online = materiał do nauki; higiena konta = KROK 0 przed It. 1.
  **Następny krok: „KROK 0 — PORZĄDKI KONTA” niżej** (nowa sesja). Po nim It. 1 (telemetria) z planem do akceptacji przed pierwszą edycją `.claude/`.
- **KROK 0 ZROBIONY I ZAAKCEPTOWANY (2026-09-29; 6a pkt 37, wiersz K0):** konto uporządkowane (48 skilli, 87 narzędzi MCP na starcie), skill `/konto`
  w workspace, wymóg instalacji per projekt → It. 3c. Otwarte u operatora: nowy token Airtable. **Następny krok: „IT. 1 — TELEMETRIA” niżej** (nowa sesja).
- **IT. 1 WDROŻONE (2026-09-29/30; 6a pkt 38, wiersz It.1):** telemetria bez agentów działa na całej historii maszyny (akceptacje zaliczone),
  hook Stop 0,1 s, agent telemetrii usunięty, słownik klas w dev-pr, hashe w sync-template, import historii. **Następny krok: „IT. 1 — ODCZYT
  (SMOKE)” niżej** (nowa sesja — N2). Otwarte u operatora: nowy token Airtable; push szablonu do GitHuba (decyzja).
- **IT. 1 ODCZYTANE I ZAAKCEPTOWANE (2026-09-30; 6a pkt 39, wiersz It.1):** smoke `wf_031f0eae-204` OK (4,78 M), wszystkie asercje TAK, pełny skan
  427/427; poprawiony skan (`run.walidacja`, v4) i 3 wady raportu (tylko dev-\*, „bez klasyfikacji”, komendy lokalne). **Następny krok: „IT. 2 — BOT,
  DEV-PR I B0” niżej** (nowa sesja; część 2A w szablonie, B0 = 2B na nowym projekcie operatora — 6a pkt 39 g). Kopia smoke usunięta.
  Otwarte u operatora: push szablonu do GitHuba (po 2A); wybór nowego projektu na B0; token Airtable.
- **ZMIANA ZAŁOŻEŃ (2026-09-30; 6a pkt 40):** B0 nie blokuje — cały szablon poprawiamy teraz wg ustaleń analizy, pomiar telemetrią na nowych
  projektach po poprawie. **Następny krok: „PLAN POPRAWY SZABLONU” niżej** (nowa sesja). Instrukcja „IT. 2 — BOT, DEV-PR I B0” UCHYLONA
  (jej zakres 2A wchodzi do planu poprawy jako jedna z paczek). Otwarte u operatora: push szablonu do GitHuba (po poprawie); token Airtable.

- **PLAN POPRAWY ZAAKCEPTOWANY (2026-09-30; 6a pkt 41):** 17 paczek, decyzje 1–3 wg rekomendacji. **Następny krok: „P0 — SIATKA BEZPIECZEŃSTWA” niżej**
  (nowa sesja). Każda kolejna paczka: instrukcja dopisywana tutaj na końcu poprzedniej sesji (wzór: instrukcja P0). Otwarte u operatora: token Airtable.
- **P0 ZROBIONA (2026-10-01; 6a pkt 42):** test odwołań, skrypt kopii z bramkami bazowymi, `pa_hunk.py`, `smoke_odczyt.py`; smoke R0 `wf_588f7b18-d71` zielony
  (3,92 M, 29 agentów, 13 min), merge do main. **Następny krok: „P1 — PORZĄDKI I USUNIĘCIA” niżej** (nowa sesja — N2). Kopia smoke usunięta. Otwarte u operatora: oryginał oferty-online czerwony na main od 2026-10-01 (6a pkt 42 g); token Airtable.
- **P1 ZROBIONA (2026-10-01; 6a pkt 43):** tryb ręczny wklejony do promptów, 9 skilli + freshness-audit-wf usunięte, test usunięć w sync-template, `.DS_Store`,
  10 łat prompt-auditu; smoke `wf_8936d61f-1cb` zielony (3,77 M, −4% vs R0), merge do main `5a4f593`. **Następny krok: „P2 — INSTALACJA PER PROJEKT I DOCTOR
  (sesja 1/2)” niżej** (nowa sesja — N2). Otwarte u operatora: zgoda na usunięcie kopii `_smoke-P1-oferty-online`; oryginał oferty-online czerwony na main
  (6a pkt 42 g); token Airtable.

- **P2 SESJA 1/2 ZROBIONA (2026-10-01; 6a pkt 44):** `doctor.sh` (lista z projektu, 15 testów na fixture z podmienionym PATH), wołanie w sync-template
  (pierwsza instalacja) + komunikat N2, dev-prep krok 1.3 + łata H38, doctor w skrypcie kopii (kod 8); przejście na kopii oferty-online: doctor OK.
  Gałąź `popr/P2-doctor` NIEZMERGOWANA. **Następny krok: „P2 — INSTALACJA PER PROJEKT I DOCTOR (sesja 2/2)” niżej** (nowa sesja — N2). Kopie P1 i P2
  usunięte za zgodą. Otwarte u operatora: oryginał oferty-online czerwony na main (6a pkt 42 g); token Airtable.
- **P2 ZROBIONA (2026-10-01; 6a pkt 45):** profil pluginów per projekt, doctor (`settings.local.json`, agent-browser z PATH), README „Instalacja” i „Wymagania”,
  CI `maszyneria.yml` (sam pnpm); merge do main `5d28922`. **Następny krok: „P3 — KONTEKST I EFORT AGENTÓW (sesja 1/2)” niżej** (nowa sesja — N2).
  Test na czystym koncie zrobiony (6a pkt 45 f — pluginy nie instalują się same; kolejność kluczy poprawiona, 0730d04). Figma zainstalowana w szablonie per projekt 2026-10-01 (2.2.120, scope project; drzewo czyste, doctor 0 uwag; narzędzia `mcp__plugin_figma_figma__*` widoczne w sesji). Otwarte u operatora:
  decyzja PA-25 przy P3; oryginał oferty-online czerwony na main (6a pkt 42 g); push szablonu; token Airtable.

- **P3 SESJA 1/2 ZROBIONA (2026-10-01; 6a pkt 46):** pięć plików klas (mechaniczny, mechaniczny-odczyt, orkiestracyjny, sceptyk, naprawiacz),
  `tools:` w plikach ról i 6 badaczach, `correctness-reviewer.md` + `test-coverage-reviewer.md`, warianty `feature-builder-{ui,fullstack}-figma.md`, PA-25
  (skill `figma:figma-design-to-code` z pluginu, lokalna kopia usunięta), test `klasy-rol.test.mjs`; 5 commitów na `popr/P3-agenci` (NIEZMERGOWANA).
  Workflowy bez zmian. **Następny krok: „P3 — KONTEKST I EFORT AGENTÓW (sesja 2/2)” niżej** (nowa sesja — N2). Otwarte u operatora: push szablonu;
  token Airtable.
- **P3 ZROBIONA (2026-10-02; 6a pkt 47):** `agentType` w każdym `agent()`, efort jawny wg D6, D9 ścieżką odwrotu (flaga `disableModelInvocation` nie działa
  w workflowach projektu → krótkie opisy dzieci), N1/N2; smoke `wf_2894ee9c-566` zielony (2,82 M, −28% vs R0), merge do main `3933432`.
  **Następny krok: „P4 — START I KONIEC RUNU” niżej** (nowa sesja — N2). Kopia `_smoke-P3-oferty-online` usunięta za zgodą. Otwarte u operatora:
  oryginał oferty-online czerwony na main (6a pkt 42 g); push szablonu; token Airtable.
- **P4 ZROBIONA (2026-10-02; 6a pkt 48):** bramka wejścia autopilota (czystość z commitem katalogu zadania, doctor, zielony start na HEAD z cache
  `bazaZielona`), archiwizacja bez CLAUDE.md z `docs/decisions/<data>-<zadanie>.md` (`claude_md: do-uzgodnienia`) i indeksem, bramka PR ≤ 150 (UWAGA),
  `fazyUkonczone` po stanie zadania, kategoria STOP `start` w telemetrii; smoke: STOP na czerwonej bazie `wf_ec07d4a4-d06`, potem `wf_f330324d-8a5`
  zielony (2,84 M), merge do main `8f5ff82`. **Następny krok: „P5 — DEV-PR I BOT” niżej** (nowa sesja — N2). Kopia `_smoke-P4-oferty-online` ma plik
  decyzji z `do-uzgodnienia` (materiał smoke'a P5) — ZOSTAJE do P5 (decyzja operatora 2026-10-02), potem usuwanie tylko za zgodą. Otwarte u operatora: oryginał oferty-online czerwony na main
  (wygasła fikstura `opublikuj-oferte`, propozycja: `vi.useFakeTimers()` w oryginale — osobna sesja); push szablonu; token Airtable.
- **P5 SESJA 1/2 ZROBIONA (2026-10-03; 6a pkt 49):** dev-pr (token tury, guard odrzuceń z `docs/decisions/`, rekomendacja w JS w każdej turze,
  tabela tury, sufit 3, propozycje do `docs/reviews/propozycje-do-reviewerow.md`, etap `claude-md` z bramką przyrostu 2000 zn i pushem), STOP
  bootstrapu przy każdym nieuzgodnionym pliku decyzji na main; smoke STOP → `/dev-pr --claude-md` → PASS (2,85 M), merge do main `dd3ed11`.
  Kopia `_smoke-P4-oferty-online` usunięta za zgodą.
- **P5 ZROBIONA (2026-10-03; 6a pkt 50):** generator `.coderabbit.yaml` bez szumu (próg 360/60, wyjątki testy/`texts.ts` w bloku głównym, `as const`/`satisfies`,
  rzutowania w atrapach, eksport tylko ekrany, tone bez AAA/docstringów/DRY, seedy E2E jako granica zaufania, stała `CODING_RULES`), test schematem CodeRabbit;
  kalibracja `zbierz` (2 runy, ~0,36 M) → `wagaWatku` w JS + opis wagi = skutek; merge do main `ed613b8`. **Grupa 1 zamknięta — push szablonu (D-2) czeka
  na decyzję operatora. Następny krok: „P6 — SKRYPT BRAMEK DOMKNIĘCIA, SESJA 1” niżej** (nowa sesja — N2). Otwarte u operatora: push szablonu (koniec
  grupy 1); oryginał oferty-online czerwony na main; token Airtable.
- **P6 SESJA 1/2 ZROBIONA (2026-10-03; 6a pkt 51):** `.claude/scripts/bramki/` — CLI `bramki.mjs --baza` z wynikiem JSON, 10 bramek (tsc, ESLint
  error/warn, vitest --typecheck, knip, size-limit, niezmienność migracji, migrations.sum, advisors, testy usunięte, Stryker diff-scoped), odbiór każdej
  testem porażki, bez nowych zależności szablonu; 354/354 testów. Gałąź `popr/P6-bramki` NIEZMERGOWANA. **Następny krok: „P6 — SKRYPT BRAMEK
  DOMKNIĘCIA, SESJA 2” niżej** (nowa sesja — N2). Otwarte u operatora: push szablonu; oryginał oferty-online czerwony na main; token Airtable.
- **P6 ZROBIONA (2026-10-03; 6a pkt 52):** konfiguracje `.claude/templates/bramki/` (ESLint 10 jako `eslint.config.szablon.ts`, knip, size-limit z buildem,
  Stryker; lista devDependencies = pakiet workspace szablonu, TS 5.9.3), domknięcie fazy uruchamia `bramki.mjs` z bazą od plannera i oddaje `bramki`,
  `ostrzezeniaEslint`, `mutanty`, `testyUsuniete` w `EXECUTE_RESULT`; hook error-handling warunkowy, `stop_hook_active`; `faza.bramki`/`testy_usuniete`;
  doctor; README „Bramki domknięcia”; bramki w pakietach monorepo. Smoke `wf_4bbe1753-420` zielony = nowa referencja R-P6 (3,87 M; większy fixture).
  Merge do main `20e20b8`. **Następny krok: „P7 — DOSSIER I STAN FAZY ZE SKRYPTU, SESJA 1” niżej** (nowa sesja — N2). Otwarte u operatora: push szablonu;
  oryginał oferty-online czerwony na main; token Airtable. Kopia smoke'a P6 usunięta 2026-10-03 za zgodą operatora.
- **P7 SESJA 1/2 ZROBIONA (2026-10-03; 6a pkt 53):** `.claude/scripts/dossier/` (CLI z wynikiem JSON w kształcie `KONTEKST`, diff i dossier w /tmp,
  bloki z ostatniego przebiegu bramek), domknięcie zwraca `dossier` w `EXECUTE_RESULT` (bez `ostrzezeniaEslint`/`mutanty`), review-wf liczy routing
  z `args.dossier` albo zapasowego agenta `dossier:zapas`, `kontekst:diff` i `kontekstPrompt` (H59, H60) zniknęły; 413/413 testów. Gałąź `popr/P7-dossier`
  NIEZMERGOWANA. **Następny krok: „P7 — DOSSIER I STAN FAZY ZE SKRYPTU, SESJA 2” niżej** (nowa sesja — N2).
- **P7 ZROBIONA (2026-10-04; 6a pkt 54):** stan fazy w JS z zapisem u agenta, który i tak startuje (`stan:zapis` tylko przed pod-workflowem i jako
  zapas — lista w pkt 54 a), zwijanie „Do poprawy” w fixie, baza fazy w stanie → `args.baza` review, telemetria `dossier_zn` / `review_rundy` / role;
  431/431 testów. Smoke A `wf_17eac746-574` = nowa referencja R-P7 (3,49 M), wznowienie `wf_56ef0a6d-2d7` → `wf_c3f62710-562` zielone. Merge do main
  `b0e961a`. **Następny krok: „P8 — PĘTLA FIX, SESJA 1” niżej** (nowa sesja — N2). Szablon wypchnięty 2026-10-04 (`origin/main` = `7d7508f`).
  Otwarte u operatora: oryginał oferty-online czerwony na main (data w teście MCP, strażnik czasu); token Airtable. Kopie smoke'a P7 usunięte 2026-10-04 za zgodą operatora.
- **P8 SESJA 1/2 ZROBIONA (2026-10-04; 6a pkt 55):** dossier bez `.autopilot-state.json`; `fix:kontrola` wg list K-1…K-7 + bramki P6 na plikach
  fixa (sceptyk, efort medium), zakres z hashy commitów fixa; `fix:pre-skan` i `verify-fix` usunięte; telemetria `kontrolaFixa.listy`,
  `fix.p1_z_testem`; 441/441 testów. Gałąź `popr/P8-fix` NIEZMERGOWANA. **Następny krok: „P8 — PĘTLA FIX, SESJA 2” niżej** (nowa sesja — N2).
- **P8 ZROBIONA (2026-10-04; 6a pkt 56):** fix naprawia tylko P1/P2; P3 trwale w known-issues (`## P3 faza N`, scribe; stan sprzed P8 → agent
  `start:p3-known-issues`); blok limitu P3 i scribe pod nową semantykę (prompt scribe −16%); smoke operatora bez P3; `smoke_odczyt.py` z listami K.
  Smoke `wf_9317b7cf-cdf` zielony = nowa referencja **R-P8** (3,62 M, etap fix 0,58 M). Poprawka K-7 (katalog zadania = księgowość) po smoke'u,
  zmergowana bez osobnego smoke'a — sprawdza ją smoke P9. 456/456 testów, merge do main `e08e1f4`. **Następny krok: „P9 — SCEPTYCY, SESJA 1” niżej**
  (nowa sesja — N2). Po P9 zamyka się grupa II → push szablonu (D-2). Kopia `_smoke-P8-oferty-online` usunięta 2026-10-04 za zgodą operatora.
- **P9 SESJA 1/2 ZROBIONA (2026-10-04; 6a pkt 57):** sceptyk asymetryczny (sam zarzut, AGREE / DISAGREE_EVIDENCE / DISAGREE_CONCERN, P1 ×3 z kasacją
  2/3 dowodów, CONCERN obniża wagę), P2 w porcjach po 4, `faza.sceptyk` + `agent.werdykty`; 466/466 testów, prompt-audit 0. Kill rate na archiwum:
  zabity 1/21 na kluczu 1 (dziś 2/21), 0/53 na kluczu 2, 0 obniżonych, −40% kosztu na finding → kryterium spełnione. Gałąź `popr/P9-sceptycy`
  NIEZMERGOWANA. **Następny krok: „P9 — SCEPTYCY, SESJA 2” niżej** (nowa sesja — N2).
- **P9 ZROBIONA (2026-10-04; 6a pkt 58):** `smoke_odczyt.py` + `smoke_sceptycy.py` (sceptycy, K-7 na `docs/active/`, raport i archiwum kopii);
  smoke `wf_34ba05c9-cca` zielony = nowa referencja **R-P9** (3,49 M; sceptycy 0,15 M, verify-batch 2 = ⌈5/4⌉, 0 błędów schematu; K-7 z P8
  potwierdzona). Merge do main `85bfec3`. Grupa II zamknięta, szablon wypchnięty 2026-10-04. **Następny krok: „P10 — WIEDZA PROJEKTU,
  SESJA 1” niżej** (nowa sesja — N2). Kopia `_smoke-P9-oferty-online` usunięta za zgodą operatora. Otwarte u operatora: `stanZapisany` poza
  `required` (pkt 58 c); oryginał oferty-online czerwony na main; token Airtable.

- **P10 SESJA 1/3 ZROBIONA (2026-10-04; 6a pkt 59):** `stanZapisany` w `required` (fa10933); `.claude/scripts/wiedza/` — walidacja pól wiedzy,
  indeks z bramką, wycinek, konwersja, CLI `wiedza.mjs`; 509/509 testów. Próba na oferty: 38/38 reguł z solution, 8 bez kandydata wzorca. Gałąź
  `popr/P10-wiedza` NIEZMERGOWANA. **Następny krok: „P10 — WIEDZA PROJEKTU, SESJA 2” niżej** (nowa sesja — N2).
- **P10 SESJA 2/3 ZROBIONA (2026-10-05; 6a pkt 60):** compound z polami wiedzy i szczeblem, refresh z indeksem i `--konwersja`, wycinek w IU
  i dossier, odwołania przepięte, `faza.wiedza` + `ma_regule`, README; 533/533 testów. Smoke w tej sesji: konwersja 38/38, run `wf_844929f5-f35`
  zielony (2,30 M, −34% vs R-P9) = kandydat na referencję **R-P10**; compound trafił w bramkę indeksu (20 256 > 20 000 zn). Merge do main `0779bf4`.
  Decyzje po smoke'u: 6a pkt 60 (g). **Następny krok: „P10 — WIEDZA PROJEKTU, SESJA 3” niżej** (nowa sesja — N2). Kopia
  `_smoke-P10-oferty-online` czeka na decyzję operatora.

- **P10 ZROBIONA (2026-10-05; 6a pkt 61):** limit indeksu 40 000 zn, wycinek dla fixa i tury /dev-pr, `uwagaIndeksu` przy pełnym indeksie, wąski
  refresh bez porządkowania pod limit, `kod`/`lint` bez `bramka` w indeksie i wycinku, `smoke_wiedza.py`; 543/543 testów. Smoke `wf_5b0d08ef-0a3`
  zielony (2,23 M; fix wywołał wycinek; indeks zapisany, 40 wpisów) = nowa referencja **R-P10**. Merge `--ff-only` do main. **Następny krok:
  „P11 — REVIEWERZY, SESJA 1” niżej** (nowa sesja — N2). Kopie `_smoke-P10-oferty-online` i `_smoke-P10b-oferty-online` usunięte za zgodą operatora.

- **P11 SESJA 1/5 ZROBIONA (2026-10-05; 6a pkt 62):** podział P11 na 5 sesji i fazy ślepego testu (6 + 46be55a) zaakceptowane; test warstwy
  stałej (`warstwa-stala.mjs` + test), correctness i spec od zera, tiery `medium` spec/test-coverage, test-coverage w `REVIEWERZY`, routing D4;
  553/553 testów, prompt-audit 0; gałąź `popr/P11-reviewerzy` NIEZMERGOWANA. Znalezisko (6a pkt 62 f): code-quality w fazie bez kodu przy
  `tsconfig.json` — decyzja w S2. **Następny krok: „P11 — REVIEWERZY, SESJA 2”** (wykonana — 6a pkt 63).

- **P11 SESJA 2/5 ZROBIONA (2026-10-05; 6a pkt 63):** warunek code-quality `plikiKodu > 0` (decyzja operatora); blok mutantów w dossier
  ułożony jak w C (id, mutator → zamiennik, status); test-coverage i code-quality od zera; jedno `reviewerPrompt` (bez `testCoveragePrompt`
  i `BLOK_SEMANTYKA`); kieran i code-simplicity usunięte; 563/563 testów, prompt-audit 0; gałąź `popr/P11-reviewerzy` NIEZMERGOWANA.
  **Następny krok: „P11 — REVIEWERZY, SESJA 3”** (wykonana — 6a pkt 64).

- **P11 SESJA 3/5 ZROBIONA (2026-10-05; 6a pkt 64):** security i performance od zera (security: treść bez skracania + L-SEC 1–10 scalone,
  RLS warunkowo po statusie advisors, strażnicy w seedach; performance: PA-03 z warunkiem React Compilera z profilu, PA-40); profil stacku
  z pakietami workspace'u (oferty = monorepo); ostrzeżenia advisors w dossier; fokus = nazwa osi dla 6 osi; doctor „warstwa stała ról”
  (6 plików, 127 poleceń) i `agent.instrukcje_stale`; `BLOK_ZAUFANIE`, `BLOK_LIMIT_P3`, `mapaBlok`, `rereviewBlok` bez wersalików nacisku;
  575/575 testów, prompt-audit 0; gałąź `popr/P11-reviewerzy` NIEZMERGOWANA. **Następny krok: „P11 — REVIEWERZY, SESJA 4”** (wykonana — 6a pkt 65).

- **P11 SESJA 4/5 ZROBIONA (2026-10-06; 6a pkt 65):** harness ślepego testu `c3cedcd` (`skrypty/test_review_p11*`: stary = drzewo `.claude` z main,
  nowy = z gałęzi, warianty po kolei na tej samej kopii z nakładką `.claude`, wspólne dossier `dossier.mjs --baza --bramki`, wariant ucięty przed
  Verify, sędzia wrześniowy w jednym przebiegu z neutralnymi id i permutacją); pilot f-b26128d 3,7 M — klucz 1 2 → 3, klucz 2 6 = 6, koszt znajdowania
  −16%, szum P1/P2 4 → 10 (test-coverage). Decyzja operatora: sesja 5 = 6 faz bez zmian przebiegu + sumy i CI w `wynik`.
  **Następny krok: „P11 — REVIEWERZY, SESJA 5”** (wykonana — 6a pkt 66).

- **P11 ZROBIONA (2026-10-06; 6a pkt 66):** ślepy test 7 faz (32,6 M): klucz 2 38 → 35/44 (−6,8 pkt [−20,5; +4,3]), klucz 1 17 → 19/36, koszt
  znajdowania −17%; decyzje operatora: 6 nowych plików ról, mutanty test-coverage grupowane per plik; smoke `wf_18c9ceff-8ad` zielony (1,93 M, −13%
  vs R-P10) = nowa referencja **R-P11**. Merge `--ff-only` do main. **Następny krok: „P12 — BUILDERY I REGUŁY KODU, SESJA 1” niżej** (nowa
  sesja — N2). Kopia `_smoke-P11-oferty-online` czeka na decyzję operatora; `~/test-review/` zostaje do P12.
- **P12 SESJA 1/5 ZROBIONA (2026-10-06; 6a pkt 67):** podział 5 sesji zaakceptowany; coding-rules przepisane `6da298e` (ocena przekazana
  Claude'owi, recenzja subagenta, decyzje w `P12-CODING-RULES.md`), `paths:` kod+SQL, fix i /dev-pr czytają plik jawnie; 585/585; gałąź
  `popr/P12-buildery` NIEZMERGOWANA. **Następny krok: „P12 — BUILDERY I REGUŁY KODU, SESJA 2” niżej** (nowa sesja — N2).
- **P12 SESJA 2/5 ZROBIONA (2026-10-06; 6a pkt 68):** `feature-builder-data` od zera (15 poleceń, wynik tylko w `BUILD_RESULT`), test szkieletu
  buildera, skille danych (security = reguły implementatora + protokół w resources, Sentry bez krzyku — H39 jako treść, Supabase stała /
  referencyjna, REVOKE EXECUTE w 9 funkcjach), `nastepneKroki` do dziennika, planner serial przy migracji; recenzja subagenta 24/25; 604/604.
  **Następny krok: „P12 — BUILDERY I REGUŁY KODU, SESJA 3” niżej** (wykonana — 6a pkt 69).
- **P12 SESJA 3/5 ZROBIONA (2026-10-06; 6a pkt 69):** `feature-builder-ui`/`-fullstack` od zera (+ `-figma`), planner bez „Wymagań wykonania”, z blokiem
  plików innych IU i serialem; D10 `wycinek --zapobieganie` (11 klas, kolejność po solutions i szerokości globu); skille UI: SKILL.md stała,
  `resources/` zgodne z coding-rules i spójne (tabela kanonów, `tsc`); wyjątek typu zwracanego w coding-rules; prompt-audit w obie strony; recenzja
  + dwie weryfikacje; 626/626. **Następny krok: „P12 — BUILDERY I REGUŁY KODU, SESJA 4” niżej** (wykonana — 6a pkt 70).
- **P12 SESJA 4/5 ZROBIONA (2026-10-07; 6a pkt 70):** wybór faz skryptem (klucz D10 „osiągalny” przez blok IU; baza buildu = rodzic commita feat),
  D10 globy hooków i klientów API (`c7598cf`), harness ślepego testu builderów (kopia na bazie buildu, execute-wf wariantu, review z main, sędzia
  obecności defektu z kodem historycznym jako kalibracją, chmod reszty testu na czas buildu, werdykt skanu przy wznowieniu, metryki z transkryptu),
  recenzja 15 uwag + dwie weryfikacje; pilot f-1de5a4c (14,4 M): remis 6/10 zapobieżonych u obu, czułość 10/10, ctx_start buildera −7%, P1/P2 6 → 5;
  627/627. **Następny krok: „P12 — BUILDERY I REGUŁY KODU, SESJA 5” niżej** (wykonana — 6a pkt 71).
- **P12 ZROBIONA (2026-10-07; 6a pkt 71):** D10 u7 `dfca1e2`; druga faza f-b8374c8 → 2 fazy razem: nowy 10/18 zapobieżonych vs 8/18 (netto +1
  z mechanizmem), P1/P2 review 20 → 17, build −3%, ctx_start buildera −8%; decyzje po recenzji subagenta: buildery, coding-rules i D10 zostają
  (osobny limit D10 → P16); smoke `wf_47df65c4-56f` zielony (1,83 M, −5% vs R-P11, reguły eager 0, ctx_start buildera −14%) = nowa referencja
  **R-P12**. Merge `--ff-only` do main. **Grupa III zamknięta — push szablonu (D-2) czeka na decyzję operatora. Następny krok: „P13 — PLANOWANIE,
  SESJA 1” niżej** (nowa sesja — N2). Szablon wypchnięty 2026-10-07; kopie `_smoke-P11-oferty-online`, `_smoke-P12-oferty-online` i `~/test-review/`
  usunięte za zgodą operatora (surowe wyniki ślepego testu P12 w `dane/test-review/p12-surowe/`; transkrypty runów zostają w `~/.claude/projects/`).

- **P13 ZROBIONA (2026-10-07; 6a pkt 72–73):** scalony `/dev-plan` z Fazą 6 (sprawdz → branch → generuj → commit → gotowosc → Workflow),
  dev-docs usunięty, research przy Lekkiej warunkowy (`wycinek --bez-zawsze`), telemetria `skill.artefakty`, fixture smoke'a z generatora;
  recenzja 4 P2 + 8 P3 wdrożona; 714/714; smoke `wf_d085974e-8d3` zielony (planowanie 0,19 M, 1 wiadomość operatora, run 1,21 M) = **R-P13**.
  Merge `--ff-only` do main. **Następny krok: „P14 — E2E I SKILL WERYFIKACJI, SESJA 1” niżej** (nowa sesja — N2).
- **P14 SESJA 1/3 ZROBIONA (2026-10-07; 6a pkt 74):** `.claude/scripts/e2e/` (parametry `.env.e2e`, sprawdzenie, serwer z PID-em
  i odciskiem, księgowanie [E2E] z przyczyną SKIP, CLI `e2e.mjs`); autopilot: jeden agent `e2e:start`, STOP na starcie z naprawą,
  awaria w trakcie → [Manual] i reszta runu bez przeglądarki; smoke operatora i telemetria `e2e.manual`; recenzja (8 P2) + weryfikacja
  (N1–N5) wdrożone; 775/775; gałąź `popr/P14-e2e` NIEZMERGOWANA.
- **P14 SESJA 2/3 ZROBIONA (2026-10-07; 6a pkt 75):** tester od nowa (plik roli = jedno źródło, seed vs migracja), `e2e.mjs scenariusze /
  mapa / weryfikacja`, generator `/weryfikacja-setup` z mapą funkcji, gotowość = decyzja bootstrapu, archiwizacja dopisuje mapę;
  recenzja (4 P2, 6 P3) + weryfikacja (N1–N8) wdrożone; 821/821; gałąź `popr/P14-e2e` NIEZMERGOWANA.
- **P14 ZROBIONA (2026-10-08; 6a pkt 74–76):** klucz publishable, poprawki po recenzji 9628595, fixture z [E2E] w dwóch fazach; smoke: STOP
  na starcie `wf_745c7f98-e26` (0,13 M) + run `wf_24fe1f85-0cb` OK (2,52 M; PASS fazy 1 z dowodem, [Manual] fazy 2 po zatrzymanym serwerze,
  0 STOP-ów w trakcie, mapa funkcji z flow zadania) = **R-P14**; 825/825; merge `--ff-only` do main `7c8c93d`. **Następny krok: „P15 — OGRODNIK”
  niżej** (nowa sesja — N2).

**P15 — OGRODNIK (AKTUALNA — nowa sesja; operator wkleja jako pierwszą wiadomość; zdanie „Do agentów…” zostaw — N1):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P15 — ogrodnik (PLAN-POPRAWY.md §3 P15), sesja 1/1.
P0–P14 zrobione i zmergowane (HANDOFF 6a pkt 42–76). Referencje smoke'a: R-P12 wf_47df65c4-56f (fixture bez E2E, 1,83 M), R-P14 wf_24fe1f85-0cb
(fixture z E2E w dwóch fazach, 2,52 M) — fixture smoke'a ma od P14 dwie fazy i [E2E], więc porównanie kosztu z R-P14.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady, smoke) i §3 P15 (zakres, testy, smoke, progi) oraz §4 (wspólne
pliki); HANDOFF 6a pkt 76 (smoke P14: środowisko kopii, strażnik, (f) ustalenia — bypass permissions a reguły paths:), §7 (P14 sesja 3).
Kod: .claude/workflows/dev-autopilot-wf.js (krok po compound-refresh, przed archiwizacją), .claude/workflows/dev-docs-complete-wf.js
(podsumowanie zadania), .claude/scripts/telemetria/zbieranie.mjs (rekord `ogrod` — dziś null), .claude/scripts/bramki/ (wzór modułu
z CLI i testami porażki), .claude/templates/smoke-autopilot/README.md (dwa przebiegi E2E, środowisko kopii).

Zakres (pokaż mi na starcie krótką mapę i decyzje z rekomendacją — m.in. próg przyrostu i N dla agenta oceny; treść techniczną oceniasz sam
z recenzją subagenta):
1. .claude/scripts/ogrod/: pomiar całego projektu (wyciszenia lint/TS, any i wymuszone rzutowania, komentarze TODO / obejście / tymczasowo,
   puste catch) z porównaniem do poprzedniego rekordu telemetrii; funkcja progu decyzji o agencie oceny; testy na fixture ze znanymi liczbami
   i na realnych projektach z ~/Documents/Kodowanie (tylko odczyt, zero wyjątków).
2. Autopilot: agent mechaniczny (bez Edit) uruchamia skrypt po compound-refresh, przed archiwizacją; agent oceny tylko przy przyroście albo co N zadań.
3. Sekcja „Ogród” w podsumowaniu zadania z propozycjami do operatora (reguła lint teraz z posprzątaniem / zadanie sprzątające / zostawić);
   telemetria `ogrod`.
4. Smoke (PLAN-POPRAWY P15): kopia oferty skryptem P0 jak w 6a pkt 76 (e) — .env.e2e oferty + E2E_START samego dashboardu, /weryfikacja-setup headless,
   strażnik zatrzymania serwera; sesja operatora BEZ bypass permissions (6a pkt 76 f); odczyt skryptem vs R-P14: 1 agent pomiaru, sekcja „Ogród”,
   0 zmian w kodzie od ogrodnika, kryterium P12 (reguły paths: u fixa).
5. Merge --ff-only popr/P15-ogrodnik do main po zielonym smoke'u.
Gałąź popr/P15-ogrodnik z main; każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit; prompt-audit pa_dodane.py main
na zmienionych plikach z promptem (git add -N przed kontrolą) = 0.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P16), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P14 — E2E I SKILL WERYFIKACJI, SESJA 3 (WYKONANA 2026-10-08 — 6a pkt 76; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P14 — E2E i skill weryfikacji (PLAN-POPRAWY.md §3 P14), sesja 3/3.
Sesje 1–2 zrobione na gałęzi popr/P14-e2e (HANDOFF 6a pkt 74–75): S1 mechanika E2E (.claude/scripts/e2e/, STOP na starcie, [Manual] w trakcie,
smoke operatora, telemetria e2e.manual); S2 tester od nowa (procedura w pliku roli, e2ePrompt = parametry + tryb, seed vs kontrakt migracji),
e2e.mjs scenariusze / mapa / weryfikacja, generator /weryfikacja-setup (skill projektu .claude/skills/weryfikacja/ + mapa funkcji), bramka
gotowości dev-plan = decyzja bootstrapu, archiwizacja dopisuje funkcje do mapy. Referencje: R-P12 wf_47df65c4-56f (fixture), R-P13 wf_d085974e-8d3.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (smoke) i §3 P14 (Smoke, Progi, Cofnięcie); HANDOFF 6a pkt 74 (g)
„Do S3” i 75 (i) „Nie sprawdzone”, (j) „Do S3”; §7 (P14 sesja 1–2). Kod: .claude/templates/smoke-autopilot/ (generuj-fixture.mjs, plan techniczny
fixture'u, fixture-zadania.test.mjs, przygotuj-kopie.sh, README), .claude/templates/e2e-env/, .claude/scripts/e2e/e2e.mjs (nagłówek = użycie),
.claude/skills/weryfikacja-setup/SKILL.md, .claude/agents/feature-tester-e2e.md.

Zakres S3 (pokaż mi na starcie krótką mapę i decyzje z rekomendacją; treść techniczną oceniasz sam z recenzją subagenta):
1. Krótka recenzja subagenta commita 9628595 (poprawki N1–N8 bez trzeciej weryfikacji).
2. Fixture z [E2E] przez generator: scenariusze [E2E] w planie technicznym fixture'u tak, żeby jedna faza dała PASS testera (dowód, że tester
   czyta skill weryfikacji i mapę), a druga [Manual] po zatrzymanym serwerze; generuj-fixture.mjs --zapisz; test fixture-zadania zmieniony jawnie.
3. Smoke w dwóch przebiegach (operator w osobnej sesji desktop otwartej w kopii): (1) kopia bez .env.e2e → STOP `start: srodowisko E2E` przed
   fazą 1 z naprawą; (2) kopia z .env.e2e (oferty: Vite; baza e2e albo tylko E2E_URL/E2E_START) i skillem z /weryfikacja-setup (przejście na żywo
   w kopii) → run; przed review fazy z [Manual] serwer zatrzymany z drugiego terminala (`node .claude/scripts/e2e/e2e.mjs stop`) → SKIP srodowisko
   → [Manual] z powodem, sekcja w smoke'u operatora, reszta runu bez przeglądarki, run OK. Odczyt skryptem vs R-P12: tester woła e2e.mjs scenariusze
   i czyta .claude/skills/weryfikacja/, PASS z dowodem, archiwum zawiera mapa-funkcji.md z flow zadania, faza.e2e.manual, run.manual_razem,
   0 STOP-ów w trakcie, koszt testera.
4. Merge --ff-only popr/P14-e2e do main po zielonym smoke'u.
Każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit; prompt-audit pa_dodane.py main na zmienionych plikach z promptem
(git add -N przed kontrolą) = 0.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P15), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P14 — E2E I SKILL WERYFIKACJI, SESJA 2 (WYKONANA 2026-10-07 — 6a pkt 75; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P14 — E2E i skill weryfikacji (PLAN-POPRAWY.md §3 P14), sesja 2/3.
Sesja 1 zrobiona na gałęzi popr/P14-e2e (HANDOFF 6a pkt 74): skrypt .claude/scripts/e2e/ (parametry .env.e2e, sprawdzenie i start/stop/stan
serwera, księgowanie [E2E] z przyczyną SKIP, CLI e2e.mjs), STOP na starcie vs [Manual] w trakcie w autopilocie i review-wf, smoke operatora,
telemetria e2e.manual. Referencje smoke'a: R-P12 wf_47df65c4-56f (fixture), R-P13 wf_d085974e-8d3 (/dev-plan).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 i §3 P14 (skill weryfikacji, tester, testy) oraz §4; PANEL-WEJSCIE.md
§2 pkt 6 i pkt 14 (skill weryfikacji: Launch / Doctor / Drive / Evidence / Cleanup + mapa funkcji, przejście regresyjne odłożone); HANDOFF 6a
pkt 74 (szczególnie (g) „Do S2”), §7 (P14 sesja 1). Kod: .claude/scripts/e2e/, .claude/agents/feature-tester-e2e.md, e2ePrompt i BLOK_BEZ_PRZEGLADARKI
w .claude/workflows/dev-docs-review-wf.js, dev-docs-complete-wf.js (smoke, archiwizacja), .claude/skills/agent-browser/,
.claude/skills/dev-docs-complete/SKILL.md, .claude/scripts/plan/gotowosc.mjs.

Zakres S2: tester od nowa (jedno źródło promptu — treść w pliku roli, e2ePrompt tylko parametry i tryb; seed vs kontrakt migracji L-E2E-2;
zachować przyczyny SKIP, curl -sS, e2e.mjs stan), generator skilla weryfikacji per projekt (.claude/skills/weryfikacja-setup/, test na fixture
projektu: sekcje obecne, Doctor = e2e.mjs sprawdz, Launch = e2e.mjs start), tester czyta skill, archiwizacja dopisuje funkcje ze scenariuszy [E2E]
zadania do mapy. Recenzja subagenta w S2 obejmuje też krótko d5a1b6c (tożsamość procesu serwera, restart po padzie — bez trzeciej
weryfikacji w S1). Pokaż mi na starcie krótką mapę S2 (test najpierw) i decyzje z rekomendacją; treść techniczną oceniasz sam z recenzją subagenta.
Każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit; prompt-audit pa_dodane.py main na zmienionych plikach z promptem
(git add -N przed kontrolą) = 0. Smoke dopiero w S3.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja sesji 3), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P14 — E2E I SKILL WERYFIKACJI, SESJA 1 (WYKONANA 2026-10-07 — 6a pkt 74; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P14 — E2E i skill weryfikacji (PLAN-POPRAWY.md §3 P14), sesja 1.
P0–P13 zrobione i zmergowane (HANDOFF 6a pkt 42–73); referencja smoke'a na fixture R-P12 = wf_47df65c4-56f (1,83 M), smoke z /dev-plan R-P13 = wf_d085974e-8d3.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 i §3 P14 (zakres, testy, smoke w dwóch przebiegach, progi) oraz §4 (wspólne
pliki); PANEL-WEJSCIE.md §2 pkt 6 (dwa przypadki E2E: STOP na starcie vs [MANUAL] w trakcie); HANDOFF 6a pkt 73 (format [E2E] w planie i walidacja,
fixture smoke'a z generatora, gałąź feature/smoke-autopilot, (g) „Do P14”), §7 (P13 sesja 2). Kod: .claude/workflows/dev-autopilot-wf.js (bramka setupu,
precheck, env-up, db-sync, env-down), dev-docs-review-wf.js (e2ePrompt, bookkeeping [E2E]), dev-docs-complete-wf.js (smoke operatora),
.claude/agents/feature-tester-e2e.md, .claude/templates/e2e-env/, .claude/skills/agent-browser/, .claude/scripts/telemetria/faza.mjs (faza.e2e.manual = null),
.claude/templates/smoke-autopilot/ (generuj-fixture.mjs, fixture-zadania.test.mjs).

Zaproponuj mi na starcie podział P14 na sesje (plan: 2–3) i krótką mapę: co w sesji 1 (test najpierw), czego nie ruszamy. Treść techniczną
oceniasz sam z recenzją subagenta, nie ja; mnie pokazujesz mapę i decyzje z rekomendacją.
Gałąź popr/P14-e2e z main; każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit; prompt-audit pa_dodane.py main na zmienionych
plikach z promptem (git add -N przed kontrolą) = 0. Hunki H13, H61 jako treść albo łata wg PLAN-POPRAWY §1.
Smoke na końcu paczki (dwa przebiegi z PLAN-POPRAWY P14): fixture z [E2E] przez generator (plan techniczny fixture'u → generuj-fixture.mjs --zapisz;
test fixture-zadania zmieniony jawnie), kopia oferty skryptem P0 (commit środowiska, linia CLAUDE.md i konwersja wiedzy jak 6a pkt 73 f i §7).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej sesji), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P13 — PLANOWANIE (SCALONY DEV-PLAN), SESJA 2 (WYKONANA 2026-10-07 — 6a pkt 73; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P13 — planowanie, scalony dev-plan (PLAN-POPRAWY.md §3 P13), sesja 2/2.
Sesja 1 zrobiona na gałęzi popr/P13-planowanie (HANDOFF 6a pkt 72): skrypty .claude/scripts/plan/ (parser planu fail-closed, generator
docs/active/, walidacja planu z tabelą plików i budżetem pliku, bramka gotowości, CLI plan.mjs) + test kontraktu docs/active/ z konsumentami.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 72 (całość, zwłaszcza (c) format IU i (g) „Do sesji 2”), 71 (g);
§7 (P13 sesja 1); PLAN-POPRAWY.md §3 P13 (research warunkowy, smoke, progi). Kod: .claude/scripts/plan/plan.mjs (nagłówek = użycie),
.claude/scripts/plan/__tests__/fixtures/plan-techniczny.md (wzorzec formatu IU), .claude/skills/dev-plan/SKILL.md, .claude/skills/dev-docs/SKILL.md,
.claude/templates/smoke-autopilot/.

Zakres sesji 2 (pokaż mi krótką mapę na starcie, potem rób — treść techniczną oceniasz sam z recenzją subagenta, nie ja):
1. Scalony .claude/skills/dev-plan/SKILL.md (+ references/, jeśli odchudza warstwę stałą): plan → fazy → IU w formacie z 6a pkt 72 (c)
   (tabela plików: „dziś” z `plan.mjs linie`, wymiary przy > 300, „wydziel” + wiersz Stwórz, > 360 = próg ESLint), rejestr stałych,
   scenariusze; bramka E2E per scenariusz z dev-docs Faza 2 pkt 4 (natywne okno, zewnętrzny system, seed spoza stanu bazowego) przed
   generowaniem; na końcu: `plan.mjs sprawdz` → poprawki planu → branch feature/<zadanie> → `plan.mjs generuj --zapisz` → commit
   inicjalny → `plan.mjs gotowosc` → handoff na autopilota z gotowym poleceniem Workflow i zdaniem N1 (z dev-docs Faza 5 i formatu wyjścia).
   Treść H31, H32, H35, H37 (rok → `date +%F`; Figma bez pełnych nazw MCP), H36 (`Scope:` dla repo-research-analyst); dev-plan:478 — figma
   skille tylko w wariantach -figma (planner wybiera wariant po kontekście designerskim, plan pisze bazowe nazwy); bez cytatów prompt-auditu.
   Research warunkowy przy „Lekka” (D8b): subagenci tylko przy nowej zależności/usłudze/API/wersji głównej albo katalogach IU bez wpisu
   w indeksie wiedzy i docs/solutions/; „Standardowa”/„Głęboka” bez zmian. dev-plan czyta indeks wiedzy w całości (P10).
2. Usunięcie .claude/skills/dev-docs/ i przepięcie odwołań (README, dev-prep, dev-brainstorm, workflowy, agenci, dev-docs-complete, test
   odwołań z P0, PLAN-POPRAWY:576 w opisie kontraktu); prompt-audit `pa_dodane.py main` na zmienionych plikach (git add -N przed kontrolą) = 0.
3. Fixture smoke'a: plan-techniczny-smoke-autopilot.md w formacie z 6a pkt 72 (c), pliki docs/active/ fixture'u wygenerowane plan.mjs
   (README smoke'a, przygotuj-kopie.sh); test, że fixture = wynik generatora.
4. Smoke (PLAN-POPRAWY P13): kopia oferty skryptem P0 (konwersja wiedzy format-patch z kopii P12 — kopie usunięte, odtwórz wg 6a pkt 71 f
   i §7), w kopii nowe małe zadanie przez /dev-plan zamiast fixture'u, potem /dev-autopilot-wf na wyniku (~7–9 M); odczyt skryptem vs R-P12
   (koszt epizodu dev-plan, wiadomości operatora, bramka gotowości, planner znalazł plan i IU, 0 błędów schematu).
5. Merge --ff-only popr/P13-planowanie do main po zielonym smoke'u.
Każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P14), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P13 — PLANOWANIE (SCALONY DEV-PLAN), SESJA 1 (WYKONANA 2026-10-07 — 6a pkt 72; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P13 — planowanie, scalony dev-plan (PLAN-POPRAWY.md §3 P13), sesja 1.
P0–P12 zrobione i zmergowane (HANDOFF 6a pkt 42–71); referencja smoke'a R-P12 = wf_47df65c4-56f (1,83 M). Grupa IV: P13 → P14 → P15 → P16.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 i §3 P13 (zakres, kontrakt docs/active/, testy, smoke, progi);
HANDOFF 6a pkt 71 (g) „Do P13”, 70 (g) (pole Pliki planu decyduje o bloku reguł/D10 buildera), 69 (g) i (i); §7 (P12 sesja 3–5).
Kod: .claude/skills/dev-plan/ i .claude/skills/dev-docs/ (SKILL.md + references), .claude/workflows/dev-docs-execute-wf.js (planner — konsument
*-plan.md i *-kontekst.md), dev-autopilot-wf.js (bootstrap — parsuje md przy pierwszym runie), .claude/templates/smoke-autopilot/.

Zaproponuj mi na starcie podział P13 na sesje (plan: 2) i krótką mapę: co w sesji 1 (test kontraktu docs/active/ najpierw — czerwony
na brak generatora; skrypty .claude/scripts/plan/: generator *-zadania.md i bramka gotowości), co w sesji 2 (scalony SKILL.md, usunięcie
dev-docs, odwołania, research warunkowy, smoke). Potem rób — treść techniczną oceniasz sam z recenzją subagenta, nie ja.
Do wzięcia z P12: kompletność pola Pliki w IU (plik testu, migracja, katalogi), dev-plan/SKILL.md:478 (figma tylko w wariantach -figma),
cytaty prompt-auditu w dev-docs/SKILL.md:9,112 i dev-plan/SKILL.md:9; hunki H31 H32 H35 H36 H37 (pa_hunk.py, jako łata albo treść wg §1).
Gałąź popr/P13-planowanie z main; każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej sesji), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P12 — BUILDERY I REGUŁY KODU, SESJA 5 (WYKONANA 2026-10-07 — 6a pkt 71; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P12 — buildery i reguły kodu (PLAN-POPRAWY.md §3 P12), sesja 5/5.
Sesje 1–4 zrobione na gałęzi popr/P12-buildery (HANDOFF 6a pkt 67–70): coding-rules, buildery data/ui/fullstack + skille, D10, harness ślepego
testu builderów + pilot f-1de5a4c (remis: oba warianty zapobiegły 6 z 10 historycznych defektów; czułość sędziego 10/10).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 70 (całość, zwłaszcza (e)–(g)), 66 (f) smoke P11 jako wzór, 67 (d)
kryterium smoke'a P12; §7 (P12 sesja 1–4); PLAN-POPRAWY.md §3 P12 (progi do odczytu, smoke, cofnięcie); dane/test-review/p12-wynik.txt
i p12-fazy.txt. Kod: skrypty/test_review_p12*.py i .sh (przebieg: przygotuj | suchy | faza), .claude/scripts/wiedza/zapobieganie.mjs.

Zakres sesji 5 (pokaż mi krótką mapę na starcie, potem rób — treść techniczną oceniasz sam z recenzją subagenta, nie ja):
1. Decyzja D10 z 6a pkt 70 (g) (uwaga u7 recenzji): testy poza globami, zdania bramka-*/sciezka-bledu bez hooków UI — test → kod → suchy bieg
   `wycinki` na f-b8374c8 i f-1de5a4c; osobny commit (osobny revert). Pilot liczony na c7598cf — odnotuj w wyniku.
2. Druga faza ślepego testu: f-b8374c8 (kolejność stary → nowy z ~/test-review/p12/f-b8374c8/kolejnosc.json; ≈ 14 M, ~1,5 h). Po zmianie .claude
   przenieś ~/test-review/p12/claude-* i claude.json do ~/test-review/odrzucone/ (claude.json pinuje drzewa), potem przygotuj → suchy → faza;
   wynik obu faz; odczyt per klucz i grupa klas (D10 / pokryte / inne), przestrzeganie, koszt, ctx_start.
3. Decyzje po teście: pliki builderów zostają albo odwrót per plik, D10 — moja rekomendacja z uzasadnieniem, recenzja subagenta.
4. Smoke vs R-P11 (wzór 6a pkt 66 f: kopia oferty, konwersja wiedzy w sesji kopii, linia CLAUDE.md) — kryterium 67 (d): rules_zn 0 u ról bez kodu,
   > 0 u builderów i fixa, prompty IU z blokiem D10, ctx_start buildera, 0 błędów schematu; ≈ 2 M.
5. Merge --ff-only popr/P12-buildery do main po zielonym smoke'u (grupa III zamknięta → push wg D-2 czeka na mnie).
Każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P13), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P12 — BUILDERY I REGUŁY KODU, SESJA 4 (WYKONANA 2026-10-07 — 6a pkt 70; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P12 — buildery i reguły kodu (PLAN-POPRAWY.md §3 P12), sesja 4/5.
Sesje 1–3 zrobione na gałęzi popr/P12-buildery (HANDOFF 6a pkt 67–69): coding-rules, buildery data/ui/fullstack od zera + test szkieletu,
skille danych i UI, D10 (wiedza.mjs wycinek --zapobieganie).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 69 (całość, zwłaszcza (j) do S4), 67 (a) zakres S4 i koszt testu,
65–66 (harness ślepego testu reviewerów — wzór); §7 (P11 sesja 4–5, P12 sesja 1–3); PLAN-POPRAWY.md §3 P12 (ślepy test builderów, progi do
odczytu) i §6 D-1; skrypty/test_review_p11* i ich testy. Kod: .claude/workflows/dev-docs-execute-wf.js (planner, promptIU, BUILD_RESULT,
domknięcie), .claude/agents/feature-builder-*.md, .claude/scripts/wiedza/zapobieganie.mjs, .claude/scripts/{bramki,dossier}/.

Zakres sesji 4 (pokaż mi krótką mapę na starcie, potem rób — treść techniczną oceniasz sam z recenzją subagenta, nie ja):
1. Wybór faz skryptem: fazy oferty-online z kluczem 2 w klasach D10 (ZDANIA w zapobieganie.mjs) i z IU UI/fullstack; ranking, 2 kandydatów
   do pilota z uzasadnieniem.
2. Harness ślepego testu builderów (wzór P11: nakładka .claude z rsync --checksum, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0, detektor zapisu
   drzewa): kopia na bazie fazy, wariant = execute-wf ze swojego .claude (stary = main, nowy = gałąź), potem bramki i TEN SAM review z main dla
   obu wyników, sędzia na kluczu fazy z neutralnymi etykietami w jednym przebiegu, przestrzeganie instrukcji z transkryptu (lista w 6a pkt 69 j);
   metryki: P1/P2 review na fazę, klucz 1/2, ctx_start i koszt buildera, czas. Testy harnessu (czerwony najpierw).
3. Suchy bieg (kopia, nakładka, prompty, wynik — bez agentów) i pilot 1 faza (~9 M); decyzja o drugiej fazie dla S5 z rekomendacją.
4. Recenzja subagenta harnessu i wyniku pilota → poprawki → weryfikacja tym samym agentem.
Każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja sesji 5), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P12 — BUILDERY I REGUŁY KODU, SESJA 3 (WYKONANA 2026-10-06 — 6a pkt 69; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P12 — buildery i reguły kodu (PLAN-POPRAWY.md §3 P12), sesja 3/5.
Sesje 1–2 zrobione na gałęzi popr/P12-buildery (HANDOFF 6a pkt 67, 68): coding-rules, feature-builder-data od zera + test szkieletu, skille danych.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 68 (całość, zwłaszcza (i) do S3), 67 (a) zakres S3, (f); §7 (P12 sesja 1–2);
PLAN-POPRAWY.md §1 i §3 P12 (D10, PA-44, pa_*.py w obie strony); PROMPT-AUDIT.md §4 (zasady 1–7), PA-44; INSPIRACJE-POCOCK-PSTACK.md A1, A4;
ETAP1B-ROZSTRZYGNIECIE.md §3 („dossier klas ucieczek”). Kod: .claude/agents/feature-builder-data.md (wzór szkieletu), feature-builder-{ui,fullstack}
i warianty -figma, .claude/skills/{tailwind-react-guidelines,ux-ui-guidelines}/, .claude/workflows/__tests__/{szkielet-buildera,warstwa-stala,
klasy-rol,wycinek-wiedzy}.test.mjs, .claude/scripts/wiedza/ (wiedza.mjs wycinek), plannerPrompt i promptIU w .claude/workflows/dev-docs-execute-wf.js.

Zakres sesji 3 (pokaż mi krótką mapę na starcie, potem rób — treść techniczną oceniasz sam z recenzją subagenta, nie ja):
1. BUILDERY_ZE_SZKIELETEM i ROLE_Z_WARSTWA += feature-builder-ui, -fullstack, oba -figma (czerwony najpierw); SKILLE_BEZ_WERSALIKOW += tailwind, ux-ui.
2. feature-builder-ui i -fullstack od zera wg szkieletu buildera danych (warianty -figma tą samą treścią + kroki Figmy); memo tylko z warunkiem
   Compilera (6a pkt 67 f); PA-44 (lista stylów do unikania dla UI bez makiety) — decyzja przy pisaniu; blok „Wymagania wykonania” w plannerze
   usunąć, gdy wszystkie buildery mają szkielet.
3. Skille UI: tailwind-react-guidelines i ux-ui-guidelines — podział stała / referencyjna bez skracania, bez krzyku, zgodność z coding-rules.
4. D10: moduł w .claude/scripts/wiedza/ — zdania „co robić zamiast” dla klas zapobiegalnych, dobór po plikach IU, kolejność wg liczby solutions
   klasy; rozszerzony wynik wiedza.mjs wycinek, jeden blok ≤ 2000 zn razem z wycinkiem P10; bez dublowania warstwy stałej builderów.
5. Pełne pa_*.py w obie strony na plikach builderów i reviewerów + README.
6. Recenzja subagenta (zgodność z coding-rules i skillami, duplikaty, sprzeczności, co orkiestrator robi z wynikiem) → poprawki → weryfikacja
   poprawek tym samym agentem.
Każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit; pa_dodane.py main <pliki z promptem> = 0 (nowe pliki: git add -N).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja sesji 4), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P12 — BUILDERY I REGUŁY KODU, SESJA 2 (WYKONANA 2026-10-06 — 6a pkt 68; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P12 — buildery i reguły kodu (PLAN-POPRAWY.md §3 P12), sesja 2/5.
Sesja 1 zrobiona na gałęzi popr/P12-buildery (HANDOFF 6a pkt 67): podział 5 sesji, coding-rules przepisane (6da298e, paths: + jawny odczyt).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 67 (podział, zakres S2, (f) do S2), 62 (a) (warstwa stała), §7 (P11 sesja 1–3,
P12 sesja 1); PLAN-POPRAWY.md §1 i §3 P12; PROMPT-AUDIT.md §4 (zasady 1–7), PA-17, PA-24; INSPIRACJE-POCOCK-PSTACK.md A1, A4 (zasady 8–11);
P12-CODING-RULES.md (sekcja „Decyzje”). Kod: .claude/agents/feature-builder-data.md (i pozostałe buildery — wspólny szkielet), .claude/rules/coding-rules.md,
.claude/skills/{security,sentry-integration,supabase-dev-guidelines}/, BUILD_RESULT i promptIU w .claude/workflows/dev-docs-execute-wf.js,
.claude/workflows/__tests__/{warstwa-stala,klasy-rol}.test.mjs, .claude/scripts/doctor/warstwa-stala.mjs; wzór: .claude/agents/correctness-reviewer.md.

Zakres sesji 2 (pokaż mi krótką mapę na starcie, potem rób — treść techniczną oceniasz sam z recenzją subagenta, nie ja):
1. ROLE_Z_WARSTWA + feature-builder-data (czerwony najpierw).
2. feature-builder-data od zera wg zasad 1–11: mandat, jeden blok ## Polecenia (< 150), bez drugiego formatu raportu obok BUILD_RESULT,
   samosprawdzenie na plikach IU (tsc --noEmit, vitest related --run; pełny zestaw w domknięciu — D7-1), pytanie „undefined”, przed pierwszą zmianą
   odczyt .claude/rules/coding-rules.md (kryterium smoke'a z 6a pkt 67 d), bez powtarzania treści reguł kodu.
3. Skille danych: security → reguły implementatora (RLS, walidacja, sekrety), protokół audytu poza skills: (PA-24); sentry-integration — pięć zasad
   normalnym zdaniem z powodem (H39: skrypty/pa_hunk.py H39 → git apply --check; inaczej jako treść); supabase-dev-guidelines — podział stała /
   referencyjna bez skracania + security definer zgodnie z regułami (6a pkt 67 f). Test, że skill wstrzykiwany builderom nie ma protokołu audytu.
4. Recenzja subagenta nowego pliku buildera i skilli (zgodność z coding-rules, brak duplikatów i sprzeczności) → poprawki.
Każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit; pa_dodane.py main <pliki z promptem> = 0 (sprawdzaj TRAFIEN: 0).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja sesji 3), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P12 — BUILDERY I REGUŁY KODU, SESJA 1 (WYKONANA 2026-10-06 — 6a pkt 67; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P12 — buildery i reguły kodu (PLAN-POPRAWY.md §3 P12), sesja 1.
P11 zrobiona i zmergowana (HANDOFF 6a pkt 66). Referencja smoke'a R-P11 = wf_18c9ceff-8ad (1,93 M; 25 agentów; etap execute 0,33 M).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P12 (zakres, pozycje, hunki, testy, smoke, progi), §4 (wiersze
plików P12), §6 D-1 (ślepy test builderów: 1–2 fazy, ~10–15 M); PROMPT-AUDIT.md §4 (zasady 1–7) i INSPIRACJE-POCOCK-PSTACK.md A4 (zasady 8–11);
ETAP2-ROZSTRZYGNIECIE.md (coding-rules: USUŃ / ZMIEŃ / DODAJ / PRZENIEŚ-DO-LINTERA); HANDOFF 6a pkt 62 (a) (warstwa stała), 66 (g) i §7
(P11 sesja 1–5). Kod: .claude/agents/feature-builder-{data,ui,fullstack}.md i warianty -figma (ui, fullstack), .claude/rules/coding-rules.md, skille buildera
(security, sentry-integration, supabase-dev-guidelines, tailwind-react-guidelines, ux-ui-guidelines), promptIU w
.claude/workflows/dev-docs-execute-wf.js, .claude/scripts/wiedza/, .claude/workflows/__tests__/warstwa-stala.test.mjs;
harness ślepego testu P11: skrypty/test_review_p11*, test_review_sesja.py, ~/test-review/ (tylko ls).

Zaproponuj mi na starcie podział P12 na sesje (plan: 2–3 + 1 — które pliki builderów i skille w której sesji, kiedy D10 i warstwa
referencyjna w promptIU, kiedy coding-rules wiersz po wierszu ze mną, kiedy harness i ślepy test builderów przed merge'em, koszt testu
wg D-1, smoke) — pokaż przed zmianą kodu. coding-rules.md to reguły operatora: każdy wiersz zmieniam dopiero po mojej decyzji.
Gałąź popr/P12-buildery z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku.
Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień)
+ test warstwy stałej (ROLE_Z_WARSTWA rozszerzone o buildery — czerwony najpierw).
Smoke (na końcu paczki, po ślepym teście): kopia oferty skryptem z P0 (`--env` z atrapami, commit środowiska jak 6a pkt 66 f, konwersja wiedzy
i linia w CLAUDE.md jak w 6a pkt 61 f), odczyt smoke_odczyt.py <wf> --ref wf_18c9ceff-8ad; daj mi komendy pojedynczo, z instrukcją,
gdzie je wkleić (nowa sesja desktop w katalogu kopii).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P11 — REVIEWERZY, SESJA 5 (WYKONANA 2026-10-06 — 6a pkt 66; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P11 — reviewerzy (PLAN-POPRAWY.md §3 P11), sesja 5/5.
Sesje 1–4 zrobione na gałęzi popr/P11-reviewerzy (HANDOFF 6a pkt 62–65): sześć plików reviewerów od zera, routing D4, tiery, harness
ślepego testu (c3cedcd) i pilot f-b26128d (3,7 M; dane/test-review/p11-wynik.*).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 65 (konstrukcja, pilot, decyzja e), 64 (c) (security: odwrót = minimalna
forma), 62 (fazy) i §7 (P0, P11 sesja 1–4); PLAN-POPRAWY.md §3 P11 (kryterium ślepego testu); TEST-REVIEW-WYNIK.md §2–§4 (klucze, CI bootstrapem).
Skrypty: skrypty/test_review_p11.py, test_review_p11_cli.py, test_review_p11.sh, test_review_p11_bramki.mjs (+ testy), test_review_sesja.py,
smoke_odczyt.py; ~/test-review/p11/ (claude-{stary,nowy}, f-b26128d).

Zakres sesji 5:
1. wynik: sumy po fazach, klucz 2 per oś (osie wariantu, które złapały), klucz 1 i 2 z CI bootstrapem po fazach (ziarno stałe), szum P1/P2
   per oś, koszt znajdowania i na złapany klucz — test → kod (test_review_p11_test.py), pilot f-b26128d przeliczony nową wersją bez agentów.
2. Pozostałe 6 faz: f-b8374c8, f-303ff62, f-1de5a4c, f-32975a1, f-2536643, f-46be55a — `przygotuj` i `suchy` dla wszystkich (zero agentów),
   potem pokaż mi zakres i koszt (≈ 30–36 M) i uruchom `faza` po kolei dopiero po mojej zgodzie.
3. Odczyt i decyzje per oś (kryterium: brak istotnej straty na kluczu 2 per oś, koszt znajdowania nie wyższy niż stary; odwrót = plik roli
   z main, dla security minimalna forma) + szum test-coverage (mutant = P2 TEST) i ręczne mutanty starego security w drzewie roboczym (6a pkt 65 d).
4. Smoke vs R-P10 (wf_5b0d08ef-0a3): świeża kopia oferty skryptem z P0, konwersja wiedzy i linia w CLAUDE.md jak w P10, run w nowej sesji,
   smoke_odczyt.py <wf> --ref wf_5b0d08ef-0a3; daj mi komendy pojedynczo.
5. Merge --ff-only popr/P11-reviewerzy do main po zielonym smoke'u i decyzjach; nowa referencja R-P11.
Test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku (szablon); skrypty harnessu commitowane z docs/reviews.
Kopie usuwam tylko za zgodą na dokładną ścieżkę; ~/test-review/ zostaje do P12.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej sesji), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P11 — REVIEWERZY, SESJA 4 (WYKONANA 2026-10-06 — 6a pkt 65; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P11 — reviewerzy (PLAN-POPRAWY.md §3 P11), sesja 4/5.
Sesje 1–3 zrobione na gałęzi popr/P11-reviewerzy (HANDOFF 6a pkt 62, 63, 64): sześć plików reviewerów od zera, routing D4, tiery,
jedno reviewerPrompt, profil stacku z pakietami workspace'u, advisors w dossier, licznik warstwy stałej w doctor i telemetrii.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 62 (podział, fazy ślepego testu, budżet), 64 (c) i (b) (security:
odwrót = minimalna forma; advisors w kopiach = brak) i §7 (P0, P11 sesja 1–3); PLAN-POPRAWY.md §3 P11 (ślepy test: kryterium, sędzia
w jednym przebiegu z neutralnymi etykietami) i §6 decyzja 1; TEST-REVIEW-PLAN.md §3–§5, §12; TEST-REVIEW-WYNIK.md (koszt, sędzia 0/20,
klucze 1 i 2, f-* i x-* osobno). Skrypty: skrypty/test_review_kopia.sh, test_review_uruchom.sh, test_review_dossier.py,
test_review_warianty.py, test_review_wariant_szablon.js, test_review_sedzia.py, test_review_sedzia_szablon.js, test_review_wynik.py,
test_review_suchy_bieg.mjs; dane/test-review-fazy.json; ~/test-review/ (kopie, _narzedzia, sedzia).
Kod: .claude/workflows/dev-docs-review-wf.js (routing, reviewerPrompt, wywolajOs — wariant kończy się przed Verify),
.claude/scripts/dossier/dossier.mjs (--baza, --bramki, --projekt, --wyjscie).

Zakres sesji 4: przeróbka harnessu pod ślepy test P11 — dwa warianty na tej samej kopii fazy: „stary” = .claude z main (pliki reviewerów
sprzed P11) i „nowy” = .claude z gałęzi; każdy dostaje dossier ze skryptu `dossier.mjs --baza` (ten sam plik dla obu), wariant = review-wf
ucięty przed Verify (findingi po dedupie), sędzia ocenia oba warianty w jednym przebiegu z neutralnymi etykietami i permutacją; skrypty
harnessu poza .claude (skrypty/test_review_*), testy tam, gdzie to logika (wycinanie workflowu, etykiety, permutacja). Potem suchy bieg
obu wariantów bez tokenów i pilot: 1 faza × 2 warianty + sędzia (≈ 5–6 M) — zaproponuj fazę pilota z listy siedmiu (6a pkt 62) i pokaż
mi zakres i koszt PRZED uruchomieniem agentów; uruchamiam dopiero po mojej zgodzie. Po pilocie: odczyt (findingi per oś, trafienia klucza
1 i 2, koszt znajdowania) i decyzja, czy sesja 5 idzie na 7 faz bez zmian harnessu.
Test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku (szablon); skrypty harnessu commitowane z docs/reviews.
Bez merge'a (merge po ślepym teście i smoke'u w sesji 5).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja sesji 5), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P11 — REVIEWERZY, SESJA 3 (WYKONANA 2026-10-05 — 6a pkt 64; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P11 — reviewerzy (PLAN-POPRAWY.md §3 P11), sesja 3/5.
Sesje 1–2 zrobione na gałęzi popr/P11-reviewerzy (HANDOFF 6a pkt 62, 63): warstwa stała, correctness, spec, test-coverage i code-quality
od zera, jedno reviewerPrompt, routing D4 + code-quality w fazie z kodem, kieran i code-simplicity usunięte.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 62 (podział), 63 (g) i §7 (dwa ostatnie punkty);
PLAN-POPRAWY.md §3 P11 (security, performance, komendy-listy po profilu stacku, licznik warstwy stałej w doctor i telemetrii) i §1 (telemetria);
PANEL-WYNIK.md §2 pkt 1–2 (performance zostaje, security bez skracania do ślepego testu); PROMPT-AUDIT.md §4 i PA-03, PA-04, PA-39, PA-40;
katalog A w dane/panel-run1-projekty.json (L-SEC 1–10, sklad_review; listy performance katalog nie ma); hunki H15, H19, H21–H23 (skrypty/pa_hunk.py).
Kod: .claude/agents/security-sentinel.md, performance-oracle.md; REVIEWERZY, BLOK_ZAUFANIE, BLOK_LIMIT_P3 w .claude/workflows/dev-docs-review-wf.js;
.claude/scripts/dossier/profil.mjs i bramki-blok.mjs (advisors); .claude/scripts/doctor/; .claude/scripts/telemetria/faza.mjs;
.claude/workflows/__tests__/warstwa-stala.test.mjs, reviewer-prompt.test.mjs.

Zakres sesji 3: security (H19, H21–H23 łatą albo treścią wg PLAN §1, zachowana poprawka PA-04 z P1, PA-39 bez zachodzących checklist,
bez skracania list; warunkowo: advisors ze statusem ok w dossier → RLS / search_path / auth.users sprawdził advisors, inaczej listy RLS
zostają; strażnicy w seedach), performance (H15, PA-03 memoizacja przy React Compilerze, PA-40 bez niesprawdzalnych progów),
komendy-listy per technologia po profilu stacku z dossier, fokus security i performance → nazwa osi (test fokusu z sesji 2 zrobi się
czerwony sam), licznik warstwy stałej w doctor (instalacja) i liczba instrukcji warstwy stałej w telemetrii (bez STOP-ów), BLOK_ZAUFANIE
i BLOK_LIMIT_P3 wg zasad pisania, pełny pa_dodane na wszystkich plikach reviewerów i review-wf. Każda rola: dopisz do ROLE_Z_WARSTWA
(czerwony) → plik od zera → zielony. Gdy zabraknie miejsca — powiedz, co przechodzi do sesji 4 (harness).
Test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku. Prompt-audit dodanych linii:
python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (sprawdź „TRAFIEN: 0” przed commitem).
Bez merge'a (merge po ślepym teście i smoke'u w sesji 5).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja sesji 4), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P11 — REVIEWERZY, SESJA 2 (WYKONANA 2026-10-05 — 6a pkt 63; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P11 — reviewerzy (PLAN-POPRAWY.md §3 P11), sesja 2/5.
Sesja 1 zrobiona na gałęzi popr/P11-reviewerzy (HANDOFF 6a pkt 62): test warstwy stałej, correctness i spec od zera, tiery medium, routing D4.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 62 (podział, decyzje, znalezisko f) i §7 (ostatni punkt);
PLAN-POPRAWY.md §3 P11 (test-coverage, code-quality, kieran, reviewerPrompt); PROMPT-AUDIT.md §4 i INSPIRACJE-POCOCK-PSTACK.md A1, A4;
katalog A w dane/panel-run1-projekty.json (L-TST, L-CQ, sklad_review, elementy[0]); hunki H01–H06 (skrypty/pa_hunk.py).
Kod: .claude/agents/test-coverage-reviewer.md, architecture-strategist.md, kieran-typescript-reviewer.md, code-simplicity-reviewer.md;
testCoveragePrompt, reviewerPrompt, BLOK_SEMANTYKA, REVIEWERZY i WARUNKI w .claude/workflows/dev-docs-review-wf.js; blok mutantów w dossier
(.claude/scripts/dossier/bramki-blok.mjs); .claude/workflows/__tests__/warstwa-stala.test.mjs.

Zakres sesji 2: test-coverage (blok mutantów z dossier ułożony jak w C: mutant → test, który powinien go zabić → powód, że nie zabija; pytanie
„undefined”; 5 kształtów testu niefalsyfikowalnego), code-quality (H01–H06 łatą albo treścią wg PLAN §1, prompt osi w pliku zamiast fokusu,
efort high, ostrzeżenia lint i knip z dossier jako wejście, kieran §7 → code-quality), usunięcie kieran-typescript-reviewer.md
i code-simplicity-reviewer.md po wykorzystaniu treści, treść reviewerPrompt; decyzja o warunku code-quality (6a pkt 62 f) — pokaż mi
rekomendację przed zmianą. Każda rola: dopisz do ROLE_Z_WARSTWA (czerwony) → plik od zera → zielony.
Test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku. Prompt-audit dodanych linii:
python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (sprawdź „TRAFIEN: 0” przed commitem).
Bez merge'a (merge po ślepym teście i smoke'u w sesji 5).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja sesji 3), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P11 — REVIEWERZY, SESJA 1 (WYKONANA 2026-10-05 — 6a pkt 62; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P11 — reviewerzy (PLAN-POPRAWY.md §3 P11), sesja 1.
P10 zrobiona i zmergowana (HANDOFF 6a pkt 61). Referencja smoke'a R-P10 = wf_5b0d08ef-0a3 (2,23 M; 26 agentów; etap review 0,45 M).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P11 (zakres, pozycje, hunki, testy, smoke, progi), §4 (wiersze plików P11),
§6 D-1 (ślepy test); PROMPT-AUDIT.md §4 (zasady 1–7) i INSPIRACJE-POCOCK-PSTACK.md A4 (zasady 8–11); HANDOFF 6a pkt 61 (g) i §7 (ostatni punkt).
Kod: .claude/agents/ (6 plików reviewerów + kieran-typescript-reviewer.md, code-simplicity-reviewer.md), REVIEWERZY i reviewerPrompt
w .claude/workflows/dev-docs-review-wf.js, .claude/scripts/doctor/; harness ślepego testu: skrypty/test_review_*, ~/test-review/ (tylko ls).

Zaproponuj mi na starcie podział P11 na sesje (plan: 3 + 2 — które pliki reviewerów w której sesji, kiedy test warstwy stałej i routing D4,
kiedy przeróbka harnessu i ślepy test przed merge'em, koszt testu wg D-1, który smoke) — pokaż przed zmianą kodu.
Gałąź popr/P11-reviewerzy z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku.
Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień);
od P11 także test warstwy stałej (PLAN §3 P11).
Smoke (na końcu paczki, po ślepym teście): kopia oferty skryptem z P0 (`--env` z atrapami, commit środowiska z 6a pkt 54 e, konwersja wiedzy
i linia w CLAUDE.md jak w 6a pkt 61 f), odczyt smoke_odczyt.py <wf> --ref wf_5b0d08ef-0a3; daj mi komendy pojedynczo.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P10 — WIEDZA PROJEKTU, SESJA 3 (WYKONANA 2026-10-05 — 6a pkt 61; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P10 — wiedza projektu (PLAN-POPRAWY.md §3 P10), sesja 3/3.
P10 sesje 1–2 zrobione (HANDOFF 6a pkt 59, 60); smoke sesji 2 zielony: wf_844929f5-f35 (2,30 M, −34% vs R-P9), stan zmergowany do main (0779bf4).
Decyzje po smoke'u: 6a pkt 60 (g). Pracuj dalej na gałęzi popr/P10-wiedza (startuje z main).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 60 (e, f, g) i §7 (ostatni punkt); dane/smoke-P10.txt.
Kod: .claude/scripts/wiedza/ (indeks.mjs, wycinek.mjs, walidacja.mjs, wpisy.mjs), fixPrompt w dev-autopilot-wf.js, etap napraw w dev-pr-wf.js,
refreshPrompt w dev-autopilot-wf.js, skill dev-compound (sekcja „Pola wiedzy”).

Do zrobienia (test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku), wg 6a pkt 60 (g):
1. Limit indeksu 40 000 zn; README i skille, jeśli podają limit.
2. Wycinek dla agenta fixa (autopilot) i tury poprawek /dev-pr — po plikach, które poprawiają.
3a. indeks=bramka → zdanie „Indeks wiedzy pełny — uruchom /dev-compound-refresh (pełny przegląd)” w wyniku autopilota i raporcie /dev-pr;
    wąski refresh nie skraca reguł pod limit.
3b. Indeks i wycinek biorą szczebel regula oraz kod/lint bez pola `bramka`; pole `bramka` (walidacja), instrukcja w skillu dev-compound i README.
4. Sprawdź na kopii _smoke-P10-oferty-online (--projekt, sam odczyt): indeks z 39 wpisami mieści się w limicie. Kopię zostawiamy.
5. smoke_odczyt.py: sekcja P10 w osobnym module (learned_zn, faza.wiedza, blok „Wyuczone reguly projektu:” w prompcie buildera i fixa,
   wynik compoundu: wiedza/indeks/propozycjeBramek).
Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień).
6. Smoke (zmienia się prompt fixa i dobór wycinka): świeża kopia oferty skryptem z P0 (`.env` z atrapami VITE_* — §7, commit środowiska
   z 6a pkt 54 e), konwersja `/dev-compound-refresh --konwersja` i linia w CLAUDE.md kopii, run w nowej sesji; odczyt smoke_odczyt.py <wf>
   --ref wf_844929f5-f35; daj mi komendy pojedynczo. Gdy zabraknie miejsca — smoke i merge w sesji 4.
7. Merge --ff-only popr/P10-wiedza do main po zielonym smoke'u; nowa referencja R-P10 = run z punktu 6.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P11), pamięć projektu, commit docs/reviews; instrukcję następnej sesji wklej mi w czacie.
Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P10 — WIEDZA PROJEKTU, SESJA 2 (WYKONANA 2026-10-05 — 6a pkt 60; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P10 — wiedza projektu (PLAN-POPRAWY.md §3 P10), sesja 2/3.
P10 sesja 1 zrobiona (HANDOFF 6a pkt 59): .claude/scripts/wiedza/ (sprawdz, indeks, wycinek, konwersja — CLI wiedza.mjs) + stanZapisany w required;
gałąź popr/P10-wiedza niezmergowana — pracuj na niej. Referencja smoke'a R-P9 = wf_34ba05c9-cca (3,49 M; 28 agentów).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P10 (zakres, hunki H29 H30 H46 H47 H50, PA-13 PA-14 PA-27 PA-41), §4 (wiersze P10);
HANDOFF 6a pkt 59 (decyzje a, poza planem e) i §7 (ostatni punkt). Kod: .claude/scripts/wiedza/wiedza.mjs (nagłówek), odwołania do
.claude/rules/learned-patterns.md (grep po .claude i README.md), etap compound w dev-pr-wf.js, dev-compound-wf.js, skille dev-compound i dev-compound-refresh.

Do zrobienia (test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. Compound (skill dev-compound, dev-compound-wf.js z H46/H47, etap compound dev-pr-wf.js): pola wiedzy we frontmatterze, `szczebel` z powodem,
   `wiedza.mjs sprawdz` przed commitem (odmowa = brak zapisu), kod/lint → propozycjeBramek[] obok propozycjeDoReviewerow[], do indeksu tylko regula
   (`wiedza.mjs indeks --zapisz`); H29 w skillu.
2. dev-compound-refresh: generuje indeks (H30), strategia subagentów zawężona (PA-41), tryb konwersji (przygotuj → jeden agent dopisuje klasę
   i poprawia regułę/wzorce → zastosuj; odrzuty dla operatora).
3. Planner (H50 jako treść, PA-13): `wiedza.mjs wycinek --pliki <pliki IU>` w prompt IU zamiast całego pliku; dossier: blok wycinka po plikach fazy
   zamiast całego learned-patterns; reviewerzy w dev-docs-review-wf.js bez starej ścieżki.
4. Przepięcie reszty odwołań (lista w 6a pkt 59 e + PLAN §3 P10): whitelista i dodatkowePathspec autopilota, pathspec complete-wf, dev-pr/SKILL.md,
   krok 1.7 w pięciu builderach (z -figma), dev-docs i dev-docs-complete SKILL; odwolania.test.mjs bez wyjątku dla starej ścieżki.
5. Telemetria faza.wiedza {indeks_zn, claude_md_zn, wycinek_*} i run.pr.klasy[].ma_regule (producent + test); README (jedna linia w CLAUDE.md projektu,
   instrukcja konwersji, cofnięcie).
Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień w liniach promptów).
Jeśli zostanie miejsce — smoke w tej sesji (jak sesja 3); inaczej po sesji HANDOFF → instrukcja sesji 3.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P10 — WIEDZA PROJEKTU, SESJA 1 (WYKONANA 2026-10-04 — 6a pkt 59; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P10 — wiedza projektu (PLAN-POPRAWY.md §3 P10), sesja 1.
P9 zrobiona i zmergowana (HANDOFF 6a pkt 58), grupa II zamknięta. Referencja smoke'a R-P9 = wf_34ba05c9-cca (3,49 M; 28 agentów).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P10, §4 (wiersze plików P10); HANDOFF 6a pkt 58 (c) i §7 (dwa ostatnie punkty);
PANEL-WEJSCIE.md §2 (learned-patterns: 3 poziomy + 8 zabezpieczeń). Kod: odwołania do .claude/rules/learned-patterns.md (grep), KLASY_BLEDOW w dev-pr-wf.js,
dev-compound-wf.js, planner w dev-docs-execute-wf.js, .claude/scripts/dossier/, faza.mjs (placeholder wiedza).

Zaproponuj mi na starcie podział P10 na sesje (2–3: pozycje, pliki, kiedy konwersja na kopii, który smoke) i decyzję o `stanZapisany` w `required`
(pkt 58 c: w P10 czy osobno) — pokaż przed zmianą kodu. Gałąź popr/P10-wiedza z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku.
Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień w liniach promptów).
Smoke (w sesji z workflowami, na końcu paczki): kopia oferty skryptem z P0 (+ commit środowiska kopii z 6a pkt 54 e), odczyt smoke_odczyt.py <wf> --ref wf_34ba05c9-cca;
daj mi komendy pojedynczo. Oczekiwane wg PLAN-POPRAWY §3 P10 „Smoke”.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P9 — SCEPTYCY, SESJA 2 (WYKONANA 2026-10-04 — 6a pkt 58; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P9 — sceptycy (PLAN-POPRAWY.md §3 P9), sesja 2/2.
P9 sesja 1 zrobiona (HANDOFF 6a pkt 57): sceptyk asymetryczny + porcje P2 po 4 + faza.sceptyk; kill rate na archiwum zielony (1/21 vs dziś 2/21,
0/53 na kluczu 2); gałąź popr/P9-sceptycy niezmergowana — pracuj na niej. Referencja smoke'a R-P8 = wf_9317b7cf-cdf (3,62 M; sceptycy 0,17 M, verify-batch 2×).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P9 (smoke, progi); HANDOFF 6a pkt 56 (i), 57 i §7 (ostatni punkt).
Kod: skrypty/smoke_odczyt.py; verify w .claude/workflows/dev-docs-review-wf.js (zarzutSceptyka, domknijWerdykty, porcjujP2); faza.mjs (sceptykFazy).

Do zrobienia (test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. smoke_odczyt.py: faza.sceptyk (etykiety, degradacje), agent.werdykty/obalone sceptyków, verify-batch vs ⌈P2/4⌉, pozycje K-7 na plikach
   docs/active/<zadanie>/ (z wyniku fix:kontrola).
2. Smoke (w sesji z workflowami): kopia oferty skryptem z P0 (+ commit środowiska kopii z 6a pkt 54 e), odczyt smoke_odczyt.py <wf> --ref wf_9317b7cf-cdf;
   daj mi komendy pojedynczo. Oczekiwane: verify-batch ≤ ⌈P2/4⌉, etykiety w wyniku i w raporcie review, agent.obalone niezerowe przy obaleniach,
   0 błędów schematu, koszt etapu sceptycy ≤ R-P8; oraz poprawka K-7 z P8: 0 pozycji K-7 na plikach docs/active/<zadanie>/, linia „Zamkniete cyklem fix”
   w archiwum zadań kopii.
3. Merge --ff-only popr/P9-sceptycy do main po zielonym smoke'u; potem push szablonu (koniec grupy II, D-2) — komendę daj mi.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P10), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P9 — SCEPTYCY, SESJA 1 (WYKONANA 2026-10-04 — 6a pkt 57; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P9 — sceptycy (PLAN-POPRAWY.md §3 P9), sesja 1.
P8 zrobiona i zmergowana (HANDOFF 6a pkt 56). Referencja smoke'a R-P8 = wf_9317b7cf-cdf (3,62 M; etap sceptycy 0,17 M, verify-batch 2×).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P9, §4 (wiersz dev-docs-review-wf.js); HANDOFF 6a pkt 56 (zwłaszcza (i))
i §7 (dwa ostatnie punkty). Kod: verify w .claude/workflows/dev-docs-review-wf.js (VERDICT, VERDICTS_BATCH, grupy P2, konsensus P1, severityKorekta),
__tests__/sceptycy-p2.test.mjs, .claude/scripts/telemetria/agent.mjs (werdyktySceptyka) i faza.mjs, skrypty/test_review_sceptycy.py.

Zaproponuj mi na starcie podział P9 na sesje (1 albo 2: pozycje, pliki, kiedy kill rate, który smoke) i pokaż go przed zmianą kodu.
Pracuj na gałęzi popr/P9-sceptycy z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku.
1. Sceptyk asymetryczny: sam zarzut bez uzasadnienia autora; etykiety AGREE / DISAGREE_EVIDENCE (linia albo test) / DISAGREE_CONCERN (obniża wagę,
   nie kasuje); P2 batch po 4 niezależnie od pliku; P1 ×3 z kasacją przy 2/3; E2E i OPERATOR dalej poza verify (strażnik: prompt bez uzasadnienia autora).
2. Telemetria: faza.sceptyk.{agree, disagree_evidence, disagree_concern}; werdyktySceptyka mapuje etykiety (EVIDENCE = obalenie, CONCERN = degradacja)
   — test czerwony najpierw, inaczej agent.weryfikowane/obalone wyjdą 0.
3. Kill rate PRZED merge'em na archiwum ~/test-review (findingi wariantu 0 z kluczami 1 i 2; dziś 2 prawdziwe B z 21 zabite): pokaż mi zakres
   i koszt (~2–4 M, tylko agenci sceptycy) przed uruchomieniem. Nowy sceptyk kasuje więcej prawdziwych niż dzisiejszy → nie merge'ujemy.
4. Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień w liniach promptów).
Smoke (w sesji z workflowami): kopia oferty skryptem z P0 (+ commit środowiska kopii z 6a pkt 54 e), odczyt smoke_odczyt.py <wf> --ref wf_9317b7cf-cdf;
daj mi komendy pojedynczo. Oczekiwane: verify-batch ≤ ⌈P2/4⌉, etykiety w wyniku, agent.obalone niezerowe przy obaleniach, 0 błędów schematu;
oraz sprawdzenie poprawki K-7 z P8: 0 pozycji K-7 na plikach docs/active/<zadanie>/, linia „Zamkniete cyklem fix” w archiwum zadań.
Merge --ff-only popr/P9-sceptycy do main po zielonym smoke'u i kill rate; potem push szablonu (koniec grupy II, D-2) — komendę daj mi.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P8 — PĘTLA FIX, SESJA 2 (WYKONANA 2026-10-04 — 6a pkt 56; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P8 — pętla fix (PLAN-POPRAWY.md §3 P8), sesja 2/2.
P8 sesja 1 zrobiona (HANDOFF 6a pkt 55): fix:kontrola wg list K-1…K-7 + bramki na plikach fixa, pre-skan i verify-fix usunięte, dossier bez
.autopilot-state.json; gałąź popr/P8-fix niezmergowana — pracuj na niej. Referencja smoke'a R-P7 = wf_17eac746-574 (etap fix 0,58 M).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P8 (punkt „Fix tylko P1/P2”, blok review, smoke); HANDOFF 6a pkt 55
(zwłaszcza (e)) i §7 (ostatni punkt). Kod: otwartePoReview, FINDING_OTWARTY, FIX_RESULT.p3Pominiete, sekcja P3 w fixPrompt i bootstrap stanu
w .claude/workflows/dev-autopilot-wf.js; BLOK_LIMIT_P3, LIMIT_P3_GLOBALNY i scribePrompt w dev-docs-review-wf.js; punkt 4 promptu smoke'a
w dev-docs-complete-wf.js (~:131, w planie :67); testy metryki-w-stanie.test.mjs:128–147, findingi-po-stopie.test.mjs, wybor-nitow.test.mjs.

Do zrobienia (test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. Fix tylko P1/P2: otwartePoReview bez P3 (zmiana kontraktu metryki-w-stanie.test.mjs:128–147 nazwana w commicie), FIX_RESULT bez p3Pominiete,
   sekcja P3 w fixPrompt jako treść (H40); stan sprzed P8 z P3 w otwarteFindingi przy wznowieniu → known-issues, nie do fixa.
2. P3 trwale w known-issues (pisze scribe — faza z samymi P3 nie ma agenta fixa), żeby wznowienie ich nie zgubiło.
3. Review: blok limitu P3 (H52, H53) i scribe (H62) jako treść pod nową semantykę (LIMIT_P3_GLOBALNY zostaje jako sufit raportu); krótszy prompt scribe.
4. Archiwizacja: smoke operatora bierze otwarte P1/P2, P3 zostają w known-issues.
5. smoke_odczyt.py: odczyt kontrolaFixa.listy i fix.p1_z_testem (6a pkt 55 e).
6. Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień w liniach promptów).
Smoke (w sesji z workflowami): kopia oferty skryptem z P0 (+ commit środowiska kopii z 6a pkt 54 e), odczyt smoke_odczyt.py <wf> --ref wf_17eac746-574;
daj mi komendy pojedynczo. Oczekiwane: 0 fix:pre-skan, 0 verify-fix, fix:kontrola z wpisem sprawdzono dla K-1…K-7 i bramek, P3 w known-issues
(nie w fixie), koszt etapu fix ≤ R-P7. Merge --ff-only popr/P8-fix do main po zielonym smoke'u.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P9), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P8 — PĘTLA FIX, SESJA 1 (WYKONANA 2026-10-04 — 6a pkt 55; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P8 — pętla fix (PLAN-POPRAWY.md §3 P8), sesja 1/2.
P7 zrobiona (HANDOFF 6a pkt 54, merge b0e961a): stan fazy w JS z zapisem u następcy, zwijanie „Do poprawy” w fixPrompt, baza fazy w stanie,
referencja smoke'a R-P7 = wf_17eac746-574.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P8, §4 (wiersze dev-autopilot-wf.js, dev-docs-review-wf.js,
dev-docs-complete-wf.js, role.mjs); HANDOFF 6a pkt 54 (zwłaszcza (a) — miejsca zapisu stanu w pętli fix — i (f)) i §7 (ostatni punkt);
katalog A: dane/panel-run1-projekty.json (projekt A, listy K-1…K-7). Kod: fixPrompt, preSkanFixaPrompt, regresjaFixaPrompt, verify-fix,
podsumujKontroleFixa i pętla fix w .claude/workflows/dev-autopilot-wf.js; otwartePoReview (metryki-w-stanie.test.mjs:128–147);
blok limitu P3 i scribePrompt w dev-docs-review-wf.js; dev-docs-complete-wf.js:67.

Zaproponuj mi na starcie podział P8 na 2 sesje (pozycje, pliki, który smoke) i pokaż go przed zmianą kodu. Na start (mała pozycja z P7, 6a pkt 54 f):
skrypt dossier pomija docs/active/<zadanie>/.autopilot-state.json na liście plików i w diffie — test na repo-fixture, osobny commit.
Pracuj na gałęzi popr/P8-fix z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku.
Zmiany kontraktu testów (otwartePoReview, kontrola fixa) nazwane w commicie. Zapis stanu w pętli fix zostaje wg mapy z 6a pkt 54 (a).
Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień w liniach promptów).
Smoke (w sesji z workflowami): kopia oferty skryptem z P0 (+ commit środowiska kopii z 6a pkt 54 e), odczyt smoke_odczyt.py <wf> --ref wf_17eac746-574;
daj mi komendy pojedynczo. Merge --ff-only popr/P8-fix do main po zielonym smoke'u ostatniej sesji paczki.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej sesji), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P7 — DOSSIER I STAN FAZY ZE SKRYPTU, SESJA 2 (WYKONANA 2026-10-04 — 6a pkt 54; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P7 — dossier i stan fazy ze skryptu (PLAN-POPRAWY.md §3 P7), sesja 2/2.
P7 sesja 1 zrobiona (HANDOFF 6a pkt 53): .claude/scripts/dossier/, domknięcie zwraca dossier w EXECUTE_RESULT, review-wf liczy routing z args.dossier
albo zapasowego agenta dossier:zapas, kontekst:diff zniknął; gałąź popr/P7-dossier niezmergowana — pracuj na niej.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P7 (stan fazy, telemetria, smoke), §4 (wiersze dev-autopilot-wf.js,
faza.mjs, role.mjs); HANDOFF 6a pkt 53 (zwłaszcza (d) i (e)) i §7 (ostatni punkt). Kod: zapiszStan(), zapiszStanPrompt, ZAPIS_STANU, 13 wywołań
zapiszStan() i zwin-do-poprawy w .claude/workflows/dev-autopilot-wf.js; .claude/scripts/telemetria/faza.mjs (review_rundy, placeholder dossier_zn)
i role.mjs; mapa klas w .claude/workflows/__tests__/wywolania-agentow.test.mjs.

Do zrobienia (test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. Mapa 13 miejsc zapiszStan(): które przejmuje agent, który w tym miejscu i tak startuje (JSON policzony w JS + dokładne polecenie zapisu), które
   zostają przy stan:zapis (lista miejsc do HANDOFF — odstępstwo od PANEL §5). Pokaż mi mapę przed zmianą kodu. Funkcja stanu fazy w JS — test ekstrakcją.
2. zwin-do-poprawy → sekcję „Do poprawy” pisze agent, który i tak edytuje plik zadania (scribe / fix), z danych JS.
3. Baza fazy po STOP-ie (6a pkt 53 e) — rekomendacja: execute-wf zwraca baza z JS, autopilot utrwala ją w stanie fazy i podaje args.baza review;
   test wznowienia po STOP-ie między execute a review (stan → zapasowy agent z bazą fazy).
4. Telemetria: faza.dossier_zn, review_rundy z liczby uruchomień review-wf, role (wychodzą kontekst:diff, zwin-do-poprawy i stan:zapis tam, gdzie znika;
   wchodzi dossier:zapas) + testy.
5. Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień w liniach promptów).
Smoke: kopia oferty skryptem z P0 + drugi przebieg ze STOP-em po execute (mechanizm podłożenia zaproponuj na starcie — pełny run archiwizuje zadanie)
→ świeży run → review dostaje dossier od zapasowego agenta; daj mi komendy pojedynczo. Oczekiwane: 0 agentów kontekst:diff i zwin-do-poprawy,
stan:zapis tylko w miejscach z listy, faza.dossier_zn > 0, routing reviewerów jak R-P6 (wf_4bbe1753-420).
Merge --ff-only popr/P7-dossier do main po zielonym smoke'u.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P8), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P7 — DOSSIER I STAN FAZY ZE SKRYPTU, SESJA 1 (WYKONANA 2026-10-03 — 6a pkt 53; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P7 — dossier i stan fazy ze skryptu (PLAN-POPRAWY.md §3 P7), sesja 1/2.
P6 zrobiona (HANDOFF 6a pkt 51–52): bramki domknięcia; EXECUTE_RESULT niesie bramki, ostrzezeniaEslint, mutanty, testyUsuniete; merge do main 20e20b8; referencja smoke'a R-P6 wf_4bbe1753-420.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P7, §4 (wiersze dev-autopilot-wf.js, dev-docs-review-wf.js,
dev-docs-execute-wf.js, faza.mjs, role.mjs, sceptycy-p2.test.mjs, metryki-w-stanie.test.mjs, dossier); HANDOFF 6a pkt 52 (zwłaszcza (e)) i §7 (ostatni punkt).
Kod: kontekstPrompt / KONTEKST / WARUNKI / reviewerPrompt w .claude/workflows/dev-docs-review-wf.js, domknięcie i EXECUTE_RESULT w dev-docs-execute-wf.js,
wywołania zapiszStan() i zwin-do-poprawy w dev-autopilot-wf.js, .claude/scripts/bramki/bramki.mjs (nagłówek = kontrakt wyniku); hunki H57–H60.

Podział (propozycja — potwierdź albo zmień na starcie): sesja 1 = .claude/scripts/dossier/ (diff fazy do pliku, lista plików, sygnały diffu, liczba [E2E],
figma_screens, sekcja planu fazy, profil stacku, bloki z bramek: ostrzeżenia lint, knip, mutanty z OSTATNIEGO przebiegu — 6a pkt 52 e) z testami na repo-fixture,
krok dossier w domknięciu + pole dossier w EXECUTE_RESULT, review-wf liczy WARUNKI z dossier (args) z zapasowym agentem mechanicznym, kontekst:diff znika;
sesja 2 = stan fazy w JS (13 miejsc zapiszStan, lista miejsc zostających przy stan:zapis), zwin-do-poprawy, telemetria dossier_zn / review_rundy / role, smoke.

Do zrobienia w tej sesji (gałąź popr/P7-dossier z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. Testy najpierw: skrypt dossier na repo-fixture (sekcje, flagi warstw, profil z supabase/ i bez), zgodność pola dossier z dzisiejszym schematem KONTEKST,
   routing z args i z zapasowego agenta (ekstrakcja funkcji), zmiany kontraktu w sceptycy-p2.test.mjs:168 i metryki-w-stanie.test.mjs:150 nazwane w commicie.
2. Skrypt .claude/scripts/dossier/ (moduły ≤ 300 l.), domknięcie, review-wf; H57, H58 jako treść; H59, H60 wypadają z kontekstPrompt.
3. Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień).
Smoke: w sesji 2 (po stanie fazy) — kopia oferty skryptem z P0 + drugi przebieg ze STOP-em po execute; daj mi komendy pojedynczo.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja sesji 2), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P6 — SKRYPT BRAMEK DOMKNIĘCIA, SESJA 2 (WYKONANA 2026-10-03 — 6a pkt 52; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P6 — skrypt bramek domknięcia (PLAN-POPRAWY.md §3 P6), sesja 2/2.
P6 sesja 1 zrobiona (HANDOFF 6a pkt 51): .claude/scripts/bramki/ (CLI bramki.mjs --baza → JSON, 10 bramek, odbiór testami), gałąź popr/P6-bramki niezmergowana — pracuj na niej.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1, §3 P6, §4 (wiersze dev-docs-execute-wf.js, hooki, settings.json, faza.mjs,
doctor, README, smoke-autopilot); ETAP2-ROZSTRZYGNIECIE.md §2 (code-quality, correctness, test-coverage, domknięcie); HANDOFF 6a pkt 51 (zwłaszcza (d))
i §7 (ostatni punkt). Kod: .claude/scripts/bramki/bramki.mjs (nagłówek = kontrakt wyniku), domknięcie w .claude/workflows/dev-docs-execute-wf.js
(domknieciePrompt, EXECUTE_RESULT, skąd baza fazy), .claude/hooks/error-handling-reminder.sh i stop-build-check-enhanced.sh, .claude/settings.json,
.claude/scripts/telemetria/faza.mjs (placeholder bramki / testy_usuniete), .claude/scripts/doctor/, .claude/templates/smoke-autopilot/; hunk H51.

Do zrobienia (test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. .claude/templates/bramki/: eslint.config.ts (ESLint 10 flat; recommendedTypeChecked error, strictTypeChecked warn; max-lines 360/60 ze skip*;
   import-x/order, import-x/no-cycle; zakaz importu klienta Supabase w komponentach i ekranach bez wyjątku dla auth; no-empty, no-floating-promises,
   no-console; react-hooks v6+ z regułami kompilatora; wtyczka vitest na słabe asercje), knip.json, .size-limit.json (pokaż mi wybór: preset esbuild
   bez builda albo build przed bramką), stryker.config.json (jsonReporter.fileName w katalogu ignorowanym); vitest includeTaskLocation.
   Test konfiguracji prawdziwymi narzędziami = zależności szablonu — najpierw pokaż listę i wersje (te z ~/test-review/_narzedzia), czekaj na zgodę.
2. Domknięcie fazy: domknieciePrompt uruchamia bramki.mjs z bazą fazy, naprawia porażki (nie gra lintera), ostrzeżenia ESLint i przeżyte mutanty
   przekazuje w EXECUTE_RESULT, uzasadnia testy usunięte, po naprawie --dopisz-sume; pkt 1b zostaje; krok 3 bez archeologii (H51).
3. Hook error-handling-reminder kończy się od razu przy eslint.config.* z szablonu; stop_hook_active w obu hookach Stop; settings.json.
4. Telemetria: producent faza.bramki.* i faza.testy_usuniete + test; doctor: devDependencies bramek; README: bramki i instalacja.
5. Fixture smoke'a: konfiguracje z templates/bramki + devDependencies + defekt mechaniczny (edycja istniejącej migracji, pusty catch); jeśli bramki
   biegną na pakiecie w monorepo — --projekt w podkatalogu wymaga git diff --relative (6a pkt 51 d), z testem.
6. Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki z promptem> (0 trafień).
Smoke: kopia oferty skryptem z P0 z fixture'em z konfiguracjami i defektem — daj mi wszystkie komendy; oczekiwane: ESLint łapie pusty catch,
niezmienność łapie edycję migracji, Stryker zwraca mutanty, domknięcie naprawia wskazane, faza.bramki w rekordzie, bramki razem ≤ 143 s.
Merge --ff-only popr/P6-bramki do main po zielonym smoke'u.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P7), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P6 — SKRYPT BRAMEK DOMKNIĘCIA, SESJA 1 (WYKONANA 2026-10-03 — 6a pkt 51; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P6 — skrypt bramek domknięcia (PLAN-POPRAWY.md §3 P6), sesja 1.
P5 zrobiona (HANDOFF 6a pkt 49–50): dev-pr, generator bota z progiem 360/60 (ten sam próg ma dostać max-lines ESLint w P6), kalibracja zbierz, merge do main ed613b8.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne), §3 P6, §4 (wiersze dev-docs-execute-wf.js, hooki,
settings.json, faza.mjs, doctor, README, smoke-autopilot); ETAP2-ROZSTRZYGNIECIE.md §2; HANDOFF 6a pkt 50 i §7 (ostatni punkt).
Kod: domknięcie w .claude/workflows/dev-docs-execute-wf.js (domknieciePrompt, EXECUTE_RESULT), .claude/hooks/error-handling-reminder.sh
i stop-build-check-enhanced.sh, .claude/settings.json, .claude/scripts/telemetria/faza.mjs (placeholder bramki / testy_usuniete),
.claude/scripts/doctor/, .claude/templates/smoke-autopilot/; hunk H51 (skrypty/pa_hunk.py H51).

Podział (propozycja — potwierdź albo zmień na starcie): sesja 1 = .claude/scripts/bramki/ (wykrycie narzędzi, ESLint error/warn, knip, size-limit,
tsc, vitest --typecheck, migrations.sum, niezmienność migracji, advisors, testy usunięte, zakresy Strykera jako funkcja czysta) z odbiorem każdej
bramki testem porażki; sesja 2 = .claude/templates/bramki/ (eslint.config.ts z max-lines 360/60, knip, size-limit, stryker), domknięcie fazy
uruchamia skrypt, hook warunkowo, telemetria faza.bramki / faza.testy_usuniete, fixture smoke'a z defektem mechanicznym, smoke.

Do zrobienia w tej sesji (gałąź popr/P6-bramki z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. Testy bramek (najpierw czerwone): każda bramka na fixture — przejście → naruszenie → porażka z konkretną regułą → przejście; niezmienność migracji
   na repo testowym z commitami; zakresy Strykera z git diff -U0 (funkcja czysta); wykrycie usuniętych testów. Narzędzia projektu (ESLint-wtyczki,
   knip, Stryker…) jako zależności szablonu tylko za moją zgodą — najpierw pokaż, co da się sprawdzić na fixture bez nich.
2. Skrypt .claude/scripts/bramki/ (moduły ≤ 300 l.), wynik JSON {bramka: {status, sekundy, trafienia}}, brak narzędzia = status brak.
3. Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki> (0 trafień).
Smoke: w sesji, która zmienia domknięcie fazy (sesja 2) — kopia oferty skryptem z P0 z fixture'em z konfiguracjami i defektem mechanicznym; daj mi
wszystkie komendy. Merge --ff-only popr/P6-bramki do main po zielonym smoke'u.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P5 — DEV-PR I BOT, SESJA 2/2 (WYKONANA 2026-10-03 — 6a pkt 50; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P5 sesja 2/2 — generator bota i kalibracja pr:zbierz (PLAN-POPRAWY.md §3 P5).
P5 sesja 1 zrobiona (HANDOFF 6a pkt 49): dev-pr (token tury, guard, rekomendacja, tabela tury, etap claude-md), warunek CLAUDE.md w bootstrapie, merge do main dd3ed11.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne), §3 P5 (generator, coderabbit-setup, stała coding-rules,
kalibracja, testy generatora), §4 (wiersz coderabbit-setup); ETAP1B-ROZSTRZYGNIECIE.md §1–§2; HANDOFF 6a pkt 49 i §7 (ostatni punkt).
Kod: .claude/skills/coderabbit-setup/ (SKILL.md, templates/coderabbit-base.yaml, templates/reviews/, reference/stack-blocks.md); .coderabbit.yaml
oryginału oferty-online (tylko odczyt — linie przywołane w ETAP1B §2); etap zbierz w .claude/workflows/dev-pr-wf.js (prompt, schemat ZEBRANE, KLASY_BLEDOW).

Do zrobienia (gałąź popr/P5-bot z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. Test generatora (najpierw czerwony): walidacja YAML schematem CodeRabbit (sprawdź, czym repo parsuje YAML i skąd wziąć schemat — nowa zależność
   tylko za moją zgodą), wyjątek testowy i texts.ts w bloku głównym, próg 360/60.
2. Generator: 8 zmian ETAP1B §2 + e2e/seeds/*.sql jako granica zaufania; ścieżka coding-rules w jednej stałej (P12 ją zmieni); coderabbit-setup
   SKILL.md — jak konfigurować bota bez szumu (L19).
3. Prompt-audit dodanych linii: python3 docs/reviews/2026-09-19-analiza-pipeline/skrypty/pa_dodane.py main <pliki> (0 trafień).
4. Kalibracja (odczyt, bez zapisu w GitHubie): prompt etapu zbierz na 2–3 starych PR oferty-online vs dane/coderabbit/klasyfikacja-574.csv.
   Zanim cokolwiek uruchomisz, pokaż mi wybór PR-ów, sposób uruchomienia (zbierz czyta PR bieżącej gałęzi — potrzebny numer PR i repo) i koszt
   (~2–4 M). Niezgodność → poprawka opisu klas albo schematu zbierz (z testem w dev-pr.test.mjs).
Smoke autopilota: nie (generator nie rusza workflowów; gdy zmienisz zbierz — testy dev-pr). Merge --ff-only popr/P5-bot do main po zielonych testach i kalibracji.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P6), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P5 — DEV-PR I BOT (SESJA 1/2 WYKONANA 2026-10-03 — 6a pkt 49; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P5 — dev-pr i bot (PLAN-POPRAWY.md §3 P5).
P4 zrobiona (HANDOFF 6a pkt 48): bramka wejścia autopilota, docs/decisions/ z polem claude_md: do-uzgodnienia, merge do main 8f5ff82.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne), §3 P5, §4 (wiersze dev-autopilot-wf.js, dev-pr-wf.js,
dev-pr/SKILL.md, coderabbit-setup, start-koniec.test.mjs); ETAP1B-ROZSTRZYGNIECIE.md §2 (8 zmian generatora) i §4 (dev-pr); HANDOFF 6a pkt 48 i §7 (ostatni punkt).
Kod: .claude/workflows/dev-pr-wf.js (zbierz, napraw, merge, :278 guard, compound — tylko zapis propozycji), .claude/skills/dev-pr/SKILL.md,
.claude/skills/coderabbit-setup/ (SKILL.md, templates/coderabbit-base.yaml, templates/reviews/, reference/stack-blocks.md),
bramka wejścia w .claude/workflows/dev-autopilot-wf.js (blok „Bramka wejscia (P4)”, decyzjaWejscia) i .claude/workflows/__tests__/start-koniec.test.mjs.

Podział (propozycja — potwierdź albo zmień na starcie): sesja 1 = dev-pr (4 zmiany, krok CLAUDE.md po merge'u z polem claude_md: uzgodniono)
+ warunek decyzji w bootstrapie + smoke bootstrapu; sesja 2 = generator bota (8 zmian, stała ścieżki coding-rules, walidacja YAML) + kalibracja pr:zbierz.

Do zrobienia (gałąź popr/P5-dev-pr z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. dev-pr.test.mjs (najpierw czerwony): guard uzasadnień (odrzuca sam backtick, przyjmuje dokument + ≥ 20 zn), token tury, rekomendacja dla czterech
   stanów (MERGUJ / NIE MERGUJ — warunek / KOLEJNA TURA / DECYZJA OPERATORA), złączenie raportu po id z watki[], bramka rozmiaru CLAUDE.md, zmiana pola
   claude_md; start-koniec.test.mjs: do-uzgodnienia → STOP z komendą, uzgodniono → dalej, brak docs/decisions/ → ostrzeżenie (funkcja w bloku P4).
2. dev-pr: zbierz w każdej turze, napraw odrzuca wątki bez tokenu tury (JS); guard :278; rekomendacja w JS jako pierwszy wiersz raportu; raport
   = tabela per tura, propozycje do docs/reviews/propozycje-do-reviewerow.md; sufit 3 tur. Krok „uzgodnij CLAUDE.md” po POTWIERDZONYM merge'u:
   wejście = plik docs/decisions/ zadania (sekcja „Do CLAUDE.md po merge'u”), bramka rozmiaru CLAUDE.md w JS, na końcu claude_md: uzgodniono.
3. Bootstrap autopilota na main: ostatni zmergowany plik docs/decisions/ z claude_md: do-uzgodnienia → STOP „uzgodnij CLAUDE.md” z komendą.
4. Generator: 8 zmian ETAP1B §2 + e2e/seeds/*.sql jako granica zaufania; coderabbit-setup — opis konfiguracji bez szumu; stała ścieżki coding-rules.
5. Kontrola prompt-auditu na dodanych liniach (0 nowych trafień). Smoke: kopia _smoke-P4-oferty-online (plik decyzji do-uzgodnienia) albo nowa kopia
   skryptem z P0 — oczekiwany STOP z komendą, po zmianie pola PASS; daj mi wszystkie komendy. Kalibracja: pr:zbierz na 2–3 starych PR oferty-online
   (odczyt) vs dane/coderabbit/klasyfikacja-574.csv — pokaż koszt (~2–4 M) przed startem.
Po zielonym smoke'u merge --ff-only popr/P5-dev-pr do main.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja następnej), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P4 — START I KONIEC RUNU (WYKONANA 2026-10-02 — 6a pkt 48; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P4 — start i koniec runu (PLAN-POPRAWY.md §3 P4).
P3 zrobiona (HANDOFF 6a pkt 46, 47): klasy ról, agentType i efort jawny w każdym agent(), D9 ścieżką odwrotu; merge do main 3933432.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne), §3 P4 i P5 (kontrakt docs/decisions/ z polem claude_md),
§4 (wiersze dev-autopilot-wf.js, dev-docs-complete-wf.js, start-koniec.test.mjs, doctor); HANDOFF 6a pkt 47 i §7 (trzy ostatnie punkty);
dane/pa-hunki-lata-tresc.txt (H33, H34, H48, H49).
Kod: bootstrap i STOP w .claude/workflows/dev-autopilot-wf.js (bootstrapPrompt, bramka brancha i czystości, commit artefaktów przy STOP, fazyUkonczone),
.claude/workflows/dev-docs-complete-wf.js (:160 i commit archiwizacji), .claude/skills/dev-docs-complete/SKILL.md (:115), .claude/scripts/doctor/.

Podział (propozycja — potwierdź albo zmień na starcie): jedna sesja; gdy bootstrap okaże się duży — sesja 1 = archiwizacja i decyzje, sesja 2 = bootstrap + smoke.

Do zrobienia (gałąź popr/P4-start-koniec z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. start-koniec.test.mjs (najpierw czerwony): decyzja bootstrapu (STOP / dalej) dla doctor FAIL, czerwony main, zielony main z cache po SHA bazy,
   brudny tylko katalog zadania vs brudne poza nim; fazyUkonczone; stopka STOP z pustą linią; pathspec archiwizacji bez CLAUDE.md i *.bak,
   komunikat docs(<zadanie>): archiwum; plik decyzji z polem claude_md: do-uzgodnienia. Logika decyzji = funkcje czyste (wzór kontrola-fixa.test.mjs).
2. Archiwizacja bez edycji CLAUDE.md i .claude/rules/ (H33, H34, H49 łatą przez pa_hunk.py, H48 jako treść); bez „Zapytaj…” i „🎉” (PA-38);
   decyzje z Dziennika → docs/decisions/<data>-<zadanie>.md + linia indeksu docs/decisions/README.md; bramka PR ≤ 150 plików (UWAGA, nie STOP).
3. Bootstrap: doctor, zielony main (wynik ze SHA bazy w stanie zadania), czystość — brudny wyłącznie katalog zadania = commit i dalej; STOP z gotową komendą.
4. Kontrola prompt-auditu na dodanych liniach (0 nowych trafień). Smoke: kopia oferty-online skryptem z P0, daj mi wszystkie komendy (cd do kopii,
   claude --effort medium, /dev-autopilot-wf docs/active/smoke-autopilot); odczyt smoke_odczyt.py vs R0 i --ref wf_2894ee9c-566 (P3)
   (oczekiwania: PLAN P4 „Smoke” — bootstrap PASS, plik w docs/decisions/ z claude_md: do-uzgodnienia, CLAUDE.md nietknięty, commit docs(smoke-autopilot): archiwum).
Po zielonym smoke'u merge --ff-only popr/P4-start-koniec do main.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P5), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P3 — KONTEKST I EFORT AGENTÓW, sesja 2/2 (WYKONANA 2026-10-02 — 6a pkt 47; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P3 — kontekst i efort agentów (PLAN-POPRAWY.md §3 P3), sesja 2 z 2.
Sesja 1 zrobiona (HANDOFF 6a pkt 46): pliki klas ról, tools: w plikach ról i badaczy, warianty builderów -figma, PA-25; gałąź popr/P3-agenci niezmergowana.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne), §3 P3 (efort, D9, N1/N2, Smoke, Cofnięcie), §4 (wiersze
dev-*-wf.js, sceptycy-p2.test.mjs, doctor, dev-docs/SKILL.md); HANDOFF 6a pkt 46 (mapa rola → klasa i problemy 1–3 w (g)) i §7 (trzy ostatnie punkty);
PANEL-WYNIK.md §2 D6 (tabela efortu) i §4 It. 3a (cele ctx_start).
Kod: .claude/agents/klasa-*.md, wywołania agent() we wszystkich .claude/workflows/*-wf.js, IU_PLAN i planner (dev-docs-execute-wf.js:57, :162),
TIERY_DOMYSLNE i :904 (dev-docs-review-wf.js), meta 6 workflowów, .claude/workflows/__tests__/klasy-rol.test.mjs, sceptycy-p2.test.mjs, .claude/scripts/doctor/.

Do zrobienia (dalej na gałęzi popr/P3-agenci; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. klasy-rol.test.mjs (najpierw czerwony): każde agent() ma agentType z istniejącym plikiem; tiery = tabela D6; meta dzieci z flagą D9.
2. agentType w każdym agent() wg mapy 6a pkt 46 (g); model: 'haiku' z wywołań do pliku klasy; stan:zapis:retry → klasa-orkiestracyjny;
   warianty -figma w enum IU_PLAN, wybór przy figma_screens/figma_spec; compound-refresh bez narzędzia Agent — decyzja do mnie z rekomendacją.
3. Efort jawny (D6): TIERY_DOMYSLNE, wywołanie test-coverage :904 (agentType + zEffortem), sceptycy-p2.test.mjs:157 jako jawna zmiana kontraktu;
   efort klas we frontmatterze (effort:) czy w TIERY — rekomendacja; pierwszeństwo pliku vs opcji agent() nieudokumentowane → sprawdzić w smoke'u.
4. D9: najpierw warunek wstępny (claude-code-guide jedno pytanie + próbny run, że workflow() uruchamia dziecko z disable-model-invocation; które pola
   meta trafiają do listy skilli), potem flaga w 4 dzieciach osobnym commitem, skrócony description dev-autopilot-wf, ostrzeżenie doctora, gdy flaga zniknie.
5. N1: zdanie do agentów w whenToUse dev-autopilot-wf i w handoffie dev-docs/SKILL.md:171; N2: zdanie o nowej sesji po zmianach .claude/.
6. Kontrola prompt-auditu na dodanych liniach (0 nowych trafień). Smoke: kopia oferty-online skryptem z P0, daj mi komendę; odczyt smoke_odczyt.py vs R0
   (oczekiwania: PLAN P3 „Smoke” — ctx_start per klasa, efort i model z transkryptu, 0 odmów „brak narzędzia”, w tym Skill u naprawiacza, dzieci mimo flagi D9).
Po zielonym smoke'u merge --ff-only popr/P3-agenci do main.
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P4), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P3 — KONTEKST I EFORT AGENTÓW, sesja 1/2 (WYKONANA 2026-10-01 — 6a pkt 46; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P3 — kontekst i efort agentów (PLAN-POPRAWY.md §3 P3), sesja 1 z 2.
P2 zrobiona (HANDOFF 6a pkt 44, 45): doctor, profil pluginów per projekt (figma, dev-browser), README Instalacja/Wymagania, CI maszyneria.yml; merge do main 5d28922.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne), §3 P3, §4 (wiersze dev-*-wf.js, sceptycy-p2.test.mjs, pliki
reviewerów i builderów, doctor); HANDOFF 6a pkt 45 i §7 (trzy ostatnie punkty); POMIARY-ROZSTRZYGNIECIE.md (1) (allowlista tools:, omitClaudeMd);
PANEL-WYNIK.md §4 It. 3a (cele ctx_start); dane/pa-hunki-lata-tresc.txt (H07–H12, H14, H18, H25).
Kod: .claude/agents/ (16 plików), wywołania agent() we wszystkich .claude/workflows/*-wf.js, TIERY_DOMYSLNE (dev-docs-review-wf.js), .claude/scripts/doctor/.

Podział P3 na sesje (propozycja — potwierdź albo zmień na starcie): sesja 1 = pliki agentów (bez zmian w workflowach), sesja 2 = workflowy (agentType w każdym
agent(), efort/TIERY, D9 z warunkiem wstępnym, N1/N2, ostrzeżenie doctora o fladze D9) + smoke.

Do zrobienia w sesji 1 (gałąź popr/P3-agenci z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. klasy-rol.test.mjs (najpierw czerwony) w części plików: każdy plik agenta pipeline'u ma tools:; mcp__ tylko w wariantach z Figmą; mechaniczni mają omitClaudeMd.
2. 4 pliki klas (mechaniczny-haiku, orkiestracyjny-opus, sceptyk, naprawiacz) + correctness-reviewer.md i test-coverage-reviewer.md (mandat 1–2 zdania).
3. tools: w 8 plikach ról i 6 badaczach (bez Edit/Write; łaty H07, H14, H18, H25; PA-35); buildery UI/fullstack: H08–H12, nazwy narzędzi Figma z instalacji
   pluginu (figma 2.2.120 zainstalowana w szablonie per projekt 2026-10-01), wariant pliku z Figmą.
4. PA-25 — decyzja do mnie z rekomendacją (plan: figma:figma-design-to-code z pluginu, lokalna kopia i zdanie README out).
5. Kontrola prompt-auditu na dodanych liniach .md (0 nowych trafień) i skrypty pa_*.py dla plików klas ról w obie strony (PLAN-POPRAWY §1).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P3 sesja 2/2), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P2 — INSTALACJA PER PROJEKT I DOCTOR, sesja 2/2 (WYKONANA 2026-10-01 — 6a pkt 45; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P2 — instalacja per projekt i doctor (PLAN-POPRAWY.md §3 P2), sesja 2 z 2.
Sesja 1 zrobiona (HANDOFF 6a pkt 44): doctor.sh + wołanie w sync-template, dev-prep i skrypcie kopii; gałąź popr/P2-doctor niezmergowana.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne), §3 P2, §4 (wiersze settings.json, README, doctor);
HANDOFF 6a pkt 37 (d), 44 i §7 (trzy ostatnie punkty: P0, P1, P2 sesja 1); KROK0-DECYZJE.md „WYMÓG OPERATORA” i pkt 8 (profil settings.json).
Kod: .claude/settings.json, .claude/scripts/doctor/ (doctor.sh, ustawienia.mjs, testy), README.md („Jak zacząć”, Dynamic Workflows), package.json.

Do zrobienia w sesji 2 (dalej na gałęzi popr/P2-doctor; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. Profil .claude/settings.json wg KROK0-DECYZJE pkt 8 (extraKnownMarketplaces dev-browser, enabledPlugins dev-browser + figma, disableClaudeAiConnectors;
   hooki i statusLine bez zmian) — doctor na szablonie pokaże oba pluginy. Decyzja do mnie z rekomendacją: pluginy w doctor zostają UWAGA czy BRAK (6a pkt 44 b).
2. README: „Instalacja” (per projekt: pluginy --scope project, narzędzia, Dynamic Workflows, doctor jako sprawdzian) i „Wymagania” (wynik doctor);
   wprost: disableClaudeAiConnectors działa tylko w terminalowym claude, w aplikacji desktop konektory wyłącza menu konektorów sesji Code,
   pluginy claude.ai "<nazwa>@inline": false (decyzja kursanta).
3. Bramka CI .github/workflows/maszyneria.yml: pnpm typecheck && pnpm test && pnpm lint; najpierw sprawdź, czy claude plugin validate --strict
   i claude plugin eval działają na repo, które nie jest pluginem — jeśli nie, zostaje sam pnpm, a brak zapisz w HANDOFF z powodem.
4. Mój krok: test na czystym koncie, czy wpisy projektu proponują instalację marketplace'ów i pluginów per projekt — daj mi gotową instrukcję w czacie.
Potem merge --ff-only popr/P2-doctor do main (smoke P2 = nie; doctor przeszedł na kopii w sesji 1).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja P3), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P2 — INSTALACJA PER PROJEKT I DOCTOR, sesja 1/2 (WYKONANA 2026-10-01 — 6a pkt 44; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P2 — instalacja per projekt i doctor (PLAN-POPRAWY.md §3 P2), sesja 1 z 2.
P0 i P1 zrobione (HANDOFF 6a pkt 42, 43). P1: 9 skilli usunięte, tryb ręczny w promptach, smoke wf_8936d61f-1cb zielony.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne), §3 P2, §4 (wiersze settings.json, README,
sync-template.test.mjs, dev-prep, doctor); HANDOFF 6a pkt 37 (d), 38 (e2), 43 i §7 (dwa ostatnie punkty: P0, P1); KROK0-DECYZJE.md pkt 8 (profil settings.json);
dane/pa-hunki-lata-tresc.txt (H38). Kod: .claude/settings.json, .claude/skills/sync-template/ (skrypt, SKILL.md, testy), .claude/skills/dev-prep/SKILL.md,
.claude/scripts/telemetria/ (zbierz.mjs --skan), README.md, package.json.

Do zrobienia w sesji 1 (gałąź popr/P2-doctor z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. .claude/scripts/doctor/doctor.sh + __tests__: lista narzędzi wyliczana z projektu (git, gh + auth, node + menedżer z lockfile, jq, supabase CLI przy supabase/,
   agent-browser przy checkboxach [E2E], coolify przy konfiguracji Coolify, docker przy Dockerfile), pluginy projektu, Dynamic Workflows, świeżość telemetrii;
   tabela brak / wersja + komenda instalacji; exit ≠ 0 przy braku obowiązkowego. Testy na katalogach-fixture z podmienionym PATH — najpierw czerwony na
   podłożonym braku, potem zielony.
2. Wywołanie doctor w sync-template (pierwsza instalacja) + komunikat końcowy N2 („po zmianie .claude/ otwórz nową sesję przed autopilotem”) z testem;
   dev-prep: krok doctor + łata H38 (pa_hunk.py, pojedyncze git apply --check przed).
3. Doctor w skrypcie kopii z P0 (przygotuj-kopie.sh) — przejście na kopii oferty-online (bez runu autopilota; smoke w P2 = nie).
Sesja 2 (instrukcja dopisana na końcu sesji 1): profil settings.json, README „Instalacja”/„Wymagania”, bramka CI, test na czystym koncie (mój krok).
Po sesji: HANDOFF (§2, 6a, §8 → instrukcja sesji 2), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P1 — PORZĄDKI I USUNIĘCIA (WYKONANA 2026-10-01 — 6a pkt 43; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P1 — porządki i usunięcia (PLAN-POPRAWY.md §3 P1).
P0 zrobiona (HANDOFF 6a pkt 42): test odwołań, skrypt kopii z bramkami bazowymi, pa_hunk.py, smoke_odczyt.py, referencja R0 wf_588f7b18-d71.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne), §3 P1, §4 (wspólne pliki: wiersze dev-docs-execute-wf.js,
dev-docs-review-wf.js, pliki reviewerów); HANDOFF 6a pkt 42 i §7 (ostatni punkt: P0); dane/pa-hunki-lata-tresc.txt; PROMPT-AUDIT.md §0 pkt 1 (lista wzorców).
Kod: .claude/skills/ (9 do usunięcia), .claude/workflows/dev-docs-execute-wf.js (:118 planner, :179 domknięcie), dev-docs-review-wf.js (:698 scribe),
.claude/hooks/error-handling-reminder.sh, .claude/skills/sync-template/scripts/, README.md.

Do zrobienia (gałąź popr/P1-porzadki z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. Wklejenie do promptów sekcji SKILL.md trybu ręcznego czytanych w runie (execute :118 sekcje 2.5, 3, 3a; :179 sekcja 4.5; review :698 sekcje 4, 4.5, 4.7),
   przepuszczone przez listę wzorców prompt-auditu (skrypty/pa_inwentarz.py — 0 nowych trafień); potem usunięcie 9 skilli i freshness-audit-wf.js
   (odwolania.test.mjs czerwony po usunięciu przed wklejeniem, zielony po), README i learnings-researcher.md:256.
2. Test w sync-template.test.mjs: usunięty w szablonie skill znika z projektu.
3. .DS_Store z indeksu gita + .gitignore.
4. Łaty pa_hunk.py (pojedyncze git apply --check przed każdą): H16 H17 H20 H24 (fakty reviewerów), H26 H27 (hook — najpierw test na pliku z withSupabase),
   H28, H54 H55 H56.
5. Smoke: kopia skryptem (bash .claude/templates/smoke-autopilot/przygotuj-kopie.sh ~/Documents/Kodowanie/oferty-online <kopia>
   --env docs/reviews/2026-09-19-analiza-pipeline/dane/smoke-oferty-atrapy.env); kod 7 = napraw zastane w kopii osobnym commitem; podaj mi dokładną ścieżkę,
   ja uruchamiam /dev-autopilot-wf w osobnej sesji desktop w kopii na efort medium, Ty odczytujesz smoke_odczyt.py → dane/smoke-P1.txt (oczekiwane R0 ±10%).
   Zielony → merge --ff-only do main.
6. Po paczce: HANDOFF (§2 stan paczek, 6a, §8 → instrukcja P2), pamięć projektu, commit docs/reviews. Kopie usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**P0 — SIATKA BEZPIECZEŃSTWA (WYKONANA 2026-10-01 — 6a pkt 42; zostawiona jako wzór):**

```
Wdrażamy plan poprawy szablonu workspace-template. Nowa sesja, Opus 5.5. Paczka P0 — siatka bezpieczeństwa (PLAN-POPRAWY.md §3 P0).
Plan zaakceptowany (HANDOFF 6a pkt 41), decyzje: ślepe testy jako dwa testy, push po każdej grupie, smoke po każdej paczce zmieniającej workflowy.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): PLAN-POPRAWY.md §1 (zasady wspólne) i §3 P0; HANDOFF 6a pkt 39 (a), 41 i §7 (trzy ostatnie
punkty: kopia do smoke'a, odczyt It. 1, plan poprawy); IT1-ODCZYT.md §1–§2 i §6; skrypty/it1_odczyt.py. Kod: .claude/templates/smoke-autopilot/,
.claude/workflows/__tests__/, .claude/workflows/*.js (agentType, workflow(), ścieżki skills/rules), .claude/agents/.

Do zrobienia (gałąź popr/P0-siatka z main; test → kod → pnpm typecheck → pnpm test → pnpm lint → commit, krok po kroku):
1. Test spójności odwołań .claude/workflows/__tests__/odwolania.test.mjs (agentType → plik albo lista wbudowanych, enum IU_PLAN, ścieżki
   .claude/skills/*/SKILL.md i .claude/rules/*, workflow('<x>'), skills: agentów) — najpierw porażka na podłożonym złym odwołaniu, potem zielony.
2. Skrypt kopii .claude/templates/smoke-autopilot/przygotuj-kopie.sh (HANDOFF §7) + --dry-run w teście; fixture jako osobny pakiet workspace kopii
   z celowym testem niefalsyfikowalnym; README smoke'a.
3. skrypty/pa_hunk.py H<nn> (pojedynczy hunk z dane/pa-proponowany.diff) + sprawdzenie 62 hunków pojedynczym --check → lista łata / treść (dane/).
4. skrypty/smoke_odczyt.py <wf_id> — porównanie z referencją (koszt, agenci per rola, model i efort z transkryptu, ctx_start per klasa, status, gate).
5. Smoke R0: przygotuj kopię oferty-online (podaj mi dokładną ścieżkę), ja uruchamiam /dev-autopilot-wf w osobnej sesji desktop w kopii na efort medium,
   Ty odczytujesz skryptem → dane/smoke-P0.txt. Zielony → merge --ff-only do main.
6. Po paczce: HANDOFF (§2 stan paczek, 6a, §8 → instrukcja P1), pamięć projektu, commit docs/reviews. Kopię usuwam tylko za zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**PLAN POPRAWY SZABLONU (ZROBIONA 2026-09-30 — plan zaakceptowany, 6a pkt 41; zostawiona dla historii):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja, Opus 5.5.
It. 1 (telemetria) zakończona (HANDOFF 6a pkt 39). ZMIANA ZAŁOŻEŃ (6a pkt 40): B0 nie blokuje — poprawiamy cały szablon teraz wg wszystkiego,
co ustaliliśmy w analizie; mierzymy potem telemetrią na nowych projektach. Zadanie tej sesji: JEDEN PLAN POPRAWY całego szablonu do mojej
akceptacji. Dopiero po akceptacji wdrażanie — paczka po paczce, w kolejnych sesjach. W tej sesji BEZ edycji .claude/ i CLAUDE.md.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 20, 25, 26, 34, 36, 38–40 i §7; PANEL-WYNIK §4 (cała tabela z 3a–3e i R1),
§4a (pełna lista uzgodnionych zmian → iteracja), §5 (docelowy pipeline); PROMPT-AUDIT.md + dane/pa-proponowany.diff (zaakceptowany, NIE naniesiony);
INSPIRACJE-POCOCK-PSTACK.md (decyzje 6a pkt 26); IT1-ODCZYT.md §5–6. Kod: .claude/ (workflows, agents, skills dev-*, rules, hooks, templates).

Do zrobienia:
1. PLAN-POPRAWY.md + PLAN-POPRAWY-DLA-OPERATORA.md: KAŻDA uzgodniona zmiana (PANEL-WYNIK §4 i §4a, diff prompt-audit, inspiracje, obserwacje
   IT1-ODCZYT §6) przypisana do jednej paczki; paczki ułożone wg zależności i ryzyka (np. co dotyka tych samych plików — raz, w jednej paczce;
   diff prompt-audit uzgodniony ze zmianami plików reviewerów/builderów z It. 7c/9, żeby nie pisać ich dwa razy). Per paczka: pliki, testy
   (test → kod → pnpm typecheck → pnpm test → pnpm lint → commit), smoke-autopilot po paczce zmieniającej workflowy (odniesienie
   wf_031f0eae-204: 4,78 M, kontekst opus 73–84k), sposób cofnięcia, próg z PANEL-WYNIK §4 do późniejszego odczytu telemetrią, szacunek sesji.
2. Kompletność sprawdź SKRYPTEM względem całej historii ustaleń (lista źródeł wyżej → każda pozycja ma paczkę albo jawne „wypada” z powodem),
   w obie strony (plan → źródła i źródła → plan); wynik do dane/. Potem jeden niezależny subagent przegląda plan (kompletność, kolejność,
   konflikty plików); mnie jedno zdanie o wyniku.
3. Decyzje do mnie, każda z rekomendacją pierwszą: czy zostają ślepe testy przed/po dla zmian promptów reviewerów/builderów (6a pkt 26 f, 7c);
   kiedy push szablonu do GitHuba; czy smoke po każdej paczce czy po grupie.
4. Oddaj plan i CZEKAJ na akceptację. Po niej: HANDOFF (§2, 6a, §8 → instrukcja pierwszej paczki), pamięć projektu, commit docs/reviews.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**IT. 2 — BOT, DEV-PR I B0 (UCHYLONA 2026-09-30 przez 6a pkt 40 — zakres 2A wchodzi do planu poprawy; zostawiona dla historii):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja, Opus 5.5.
It. 1 (telemetria) ODCZYTANA I ZAAKCEPTOWANA (HANDOFF 6a pkt 39). Zadanie tej sesji: It. 2A w szablonie — konfiguracja bota, 4 zmiany dev-pr,
kalibracja klasyfikatora — oraz plan części 2B (B0 na moim nowym projekcie; 6a pkt 39 g: wszystko od It. 3 czeka na B0).
NAJPIERW PLAN do mojej akceptacji, dopiero po niej pierwsza edycja .claude/. BEZ agentów i BEZ zmian w CLAUDE.md.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 36 (a), 38, 39 (zwłaszcza g) i §7 (dwa ostatnie punkty); PANEL-WYNIK §4 (dopisek
2026-09-28 i wiersz It. 2) i §4a C; ETAP1B-ROZSTRZYGNIECIE.md; IT1-ODCZYT.md §4–6. Kod dziś: .claude/skills/dev-pr/SKILL.md,
.claude/workflows/dev-pr-wf.js (KLASY_BLEDOW, etapy start/zbierz/napraw/merge/compound), .claude/skills/coderabbit-setup/ (SKILL.md, templates/,
reference/stack-blocks.md), .claude/scripts/telemetria/ (run.pr, raport §4 „uwagi bota”).

Do zrobienia:
1. Plan It. 2 → IT2-PLAN.md + IT2-PLAN-DLA-OPERATORA.md. Elementy (PANEL-WYNIK §4a C): generator coderabbit-base.yaml + opis w skillu, jak
   konfigurować bota bez szumu; 8 zmian .coderabbit.yaml; e2e/seeds/*.sql jako granica zaufania w instrukcjach bota; dev-pr — 4 zmiany bez
   nowych agentów: (1) zbierz obowiązkowy w każdej turze, napraw odrzuca wątki bez niego, (2) guard uzasadnień (nazwa dokumentu + 20 zn, bez
   alternatywy z backtickiem), (3) rekomendacja liczona w JS (MERGUJ / NIE MERGUJ / KOLEJNA TURA / DECYZJA OPERATORA) jako pierwszy wiersz raportu,
   (4) raport = tabela per tura złączona po id z watki[] + propozycjeDoReviewerow commitowane w compoundzie; sufit 3 tur, tryb interaktywny zostaje;
   metryka run.pr.{klasy[], rekomendacja}, liczba tur na PR (sprawdź, czy skan It. 1 ją czyta — jeśli nie: krok test → kod w telemetrii).
   Każdy krok: test → kod → pnpm typecheck → pnpm test → pnpm lint → commit; warunek odwrotu i sposób cofnięcia per krok.
2. Kalibracja klasyfikatora: 2–3 stare PR-y oferty-online (tylko odczyt, historia/kopie) — klasy z pr:zbierz vs klasyfikacja 1b
   (dane/coderabbit/klasyfikacja-574.csv); niezgodność → poprawka schematu pr:zbierz PRZED B0 (warunek odwrotu PANEL-WYNIK §4).
3. Plan 2B — B0 (6a pkt 36 a, 39 g): pierwsze 2–3 zadania NOWEGO projektu, bez zmian pipeline'u od syncu do końca B0 — w planie: co B0 mierzy
   (jakość per oś i typ kodu, pliki fixa / reszta, uwagi bota P1/P2 na 100 plików; koszt per rola z efortem — wszystko z raport.mjs
   --projekt), jak projekt dostaje szablon (rekomendacja: push do GitHuba po 2A + sync-template; decyzja moja), które zadania się liczą
   (autopilot + dev-pr do merge'a), kiedy B0 jest zamknięte i jaka instrukcja sesji odczytu B0. Zapytaj mnie, który projekt i kiedy startuje.
   Zadanie sprzątające ESLint w oferty-online WYPADA.
4. Oddaj plan i CZEKAJ na akceptację (decyzje z rekomendacją pierwszą). Po wdrożeniu 2A: smoke dev-pr nie istnieje — w planie napisz, jak
   sprawdzisz 4 zmiany dev-pr bez prawdziwego PR-a (testy JS bramek + ewentualnie PR na kopii) i czy odczyt 2A zostaje na pierwszy PR z B0.
   Na końcu: HANDOFF (§2, 6a, §8 → instrukcja startu B0 dla sesji w nowym projekcie), pamięć projektu, commit docs/reviews.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**IT. 1 — ODCZYT (SMOKE) (WYKONANY 2026-09-30 — zostawiony dla historii; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja, Opus 5.5.
It. 1 (telemetria) WDROŻONA (HANDOFF 6a pkt 38). Zadanie tej sesji: ODCZYT It. 1 — jeden run smoke-autopilot i sprawdzenie telemetrii.
BEZ zmian w .claude/ i CLAUDE.md, chyba że odczyt wykaże błąd skanu — wtedy poprawka test → kod w .claude/scripts/telemetria/ i znów nowa sesja.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 38 i §7 (ostatni punkt); IT1-PLAN.md §3 i §7;
.claude/templates/smoke-autopilot/README.md; MINI-RUN-WYNIK.md (ODSTĘPSTWO: sesja przeniesiona change_directory ma instrukcje ze starego katalogu).

Do zrobienia:
1. Przygotuj projekt roboczy (oryginał nietknięty): lokalny klon oferty-online do katalogu roboczego poza repo szablonu, gałąź
   test/smoke-autopilot, pnpm install; sync-template z TEMPLATE_LOCAL_SRC=<workspace-template> (sprawdź, że powstał .claude/.template-hashes);
   fixture smoke wg README (docs/active/smoke-autopilot/, docs/plans/); git czysty. Szacunek kosztu runu: ~5–10 M jedn., 30–40 agentów,
   30–45 min (najtańszy prawdziwy run z 1 fazą: 8,6 M). Podaj mi ścieżkę i gotową instrukcję dla sesji w kopii.
2. JA otwieram osobną sesję desktop W TEJ KOPII i puszczam /dev-autopilot-wf docs/active/smoke-autopilot; wracam z identyfikatorem runu.
3. Sprawdź (bez żadnej komendy z mojej strony po runie — zapis robi hook): w ~/.claude/telemetry/pipeline.jsonl rekord run ze statusem
   = plik harnessu, rekordy faza i agent dla każdego agenta z workflowProgress, szablon.zgodny = true, effort u agentów opus, 0 agentów
   telemetria:* w pliku harnessu, wynik runu bez pól tokeny/tokenyEtapy; asercje smoke'a z README (smokeStatus, plik w docs/operator/).
4. node .claude/scripts/telemetria/zbierz.mjs --skan (każdy plik harnessu ma rekord run, 0 NIEZNANY) i raport.mjs za wrzesień
   → docs/reviews/telemetria/ — pokaż mi skrót (koszt per etap, kontekst per klasa, STOP-y, skille).
5. Wynik odczytu → IT1-ODCZYT.md + IT1-ODCZYT-DLA-OPERATORA.md; oddaj i CZEKAJ na akceptację. Po niej: HANDOFF (§2, 6a, §8 → instrukcja
   It. 2 — bot, dev-pr i B0), pamięć projektu, commit docs/reviews; sprzątanie kopii tylko za moją zgodą na dokładną ścieżkę.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**IT. 1 — TELEMETRIA (WYKONANA 2026-09-29/30 — zostawiona dla historii; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja, Opus 5.5.
KROK 0 (porządki konta) ZAKOŃCZONY (HANDOFF 6a pkt 37). Zadanie tej sesji: It. 1 — telemetria + import. NAJPIERW PLAN do mojej akceptacji,
dopiero po niej pierwsza edycja .claude/. BEZ agentów i BEZ zmian w CLAUDE.md.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 34, 36, 37; PANEL-WYNIK §4 (wiersz It. 1) i §4a (C: zamknięty słownik klas,
test telemetrii); PANEL-WEJSCIE §2 pkt 5 i §12 + dane/d5-telemetria-rekord.txt; RAPORT-TECHNICZNY (wiersz „Telemetria”). Kod dziś:
.claude/workflows/dev-autopilot-wf.js, dev-docs-review-wf.js (agent telemetrii, tokenyRazemK), __tests__/metryki-w-stanie.test.mjs,
__tests__/telemetria-i-kontrola-fixa.test.mjs.

Do zrobienia:
1. Plan It. 1 → IT1-PLAN.md + IT1-PLAN-DLA-OPERATORA.md. Elementy (PANEL-WYNIK §4 It. 1): zbierz.mjs (skan pliku harnessu, hook Stop jako
   wyzwalacz, skan w doctor) i raport.mjs; agent telemetrii i tokenyRazemK znikają; efort w etykietach agentów → agent.effort; pr:zbierz
   z klasą/osią/wagą → run.pr (zamknięty słownik klas); faza.fix.pliki[] ze statusem A/M (D12); sync-template zapisuje hash per plik
   (run.szablon.skrypt_sha); import agents.csv (przeliczony), odzyskanej telemetrii, skille.csv, klasyfikacja-574.csv.
   Per element: pliki .claude/, które się zmieniają; test (najpierw test, potem kod — coding-rules §2); jak sprawdzę, że działa
   (odczyt It. 1: 1 run → każdy run ma rekord z prawdziwym statusem, 0 agentów telemetrii); jak cofnąć.
2. Sprawdź w kodzie (grep), co już istnieje, żeby nie dublować; otwarte decyzje wypisz z opcjami i rekomendacją.
3. Oddaj plan i CZEKAJ na akceptację. Po niej: edycje .claude/ po jednej zmianie (test → kod → typecheck, test, lint), potem nowa sesja
   przed pierwszym autopilotem (N2), HANDOFF (§2, 6a, §8), pamięć projektu, commit.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**KROK 0 — PORZĄDKI KONTA (WYKONANA 2026-09-28/29 — zostawiona dla historii; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja, Opus 5.5.
Zadanie: KROK 0 — porządki na moim koncie Claude Code na CAŁYM KOMPUTERZE (wszystkie projekty): pluginy, MCP, skille, agenci, hooki,
konektory i pluginy z claude.ai. Cel: poziom user (globalny) zawiera tylko to, czego używam wszędzie; reszta w projektach albo usunięta.
BEZ agentów, BEZ zmian w .claude/ szablonu i w CLAUDE.md. Komendy zmieniające konto uruchamiam JA.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF 6a pkt 36, RAPORT-DLA-OPERATORA.md cz. 4, RAPORT-TECHNICZNY.md §2a,
dane/konto-inwentarz-workspace-template.txt, skrypty/konto_inwentarz.py (docstring + reguły poziomów z dokumentacji Claude Code).

Do zrobienia:
1. Dopisz do skrypty/konto_inwentarz.py tryb --globalnie (tylko odczyt, nazwy bez wartości):
   (a) poziom user — każdy plugin, MCP, skill, agent, hook, statusLine, pluginy/skille z claude.ai (aktywne konto);
   (b) mapa wszystkich projektów z ~/.claude.json i installed_plugins.json: co każdy projekt włącza/wyłącza na poziomie project/local
       (enabledPlugins, .mcp.json, MCP local, disabledMcpServers, własne skille/agenci/hooki), katalogi nieistniejące osobno;
   (c) użycie każdego elementu w CAŁYM komputerze: z transkryptów 30 dni (ile razy, w których projektach, ostatnio) + dłuższa historia
       komend z ~/.claude/history.jsonl (0 w 30 dniach ≠ nigdy);
   (d) koszt always-on każdego pluginu (claude plugin details) i suma na sesję.
   Wynik: dane/konto-inwentarz-globalny-przed.txt. Pokaż mi skrót: co zaśmieca kontekst najbardziej.
2. Przejdź ze mną przez inwentarz po kategoriach (pluginy user → pluginy claude.ai → MCP user → skille user → agenci user → hooki user
   → konektory claude.ai → wpisy w projektach). Przy każdym elemencie dane (użycie, projekty, koszt), a ja decyduję:
   GLOBALNIE / TYLKO W PROJEKTACH: <lista> / USUŃ. Nie proponuj za mnie gotowej listy — daj dane i pytaj po jednej kategorii.
3. Decyzje zapisuj w KROK0-DECYZJE.md (element, poziom dziś, decyzja, komendy, jak przywrócić).
4. Przed jakąkolwiek zmianą: kopia ~/.claude/settings.json, ~/.claude.json, ~/.claude/plugins/installed_plugins.json i list skilli/agentów
   do katalogu kopii poza repo (podaj ścieżki). Nic nie kasuj bez mojego potwierdzenia dokładnej ścieżki.
5. Wypisz komendy per decyzja (claude plugin disable/uninstall/install --scope, claude mcp remove/add --scope, wpisy enabledPlugins/
   disableClaudeAiConnectors/skillOverrides w settings) — uruchamiam je ja; pluginy/konektory z claude.ai: co zmienić na claude.ai.
6. Po moich zmianach: nowa sesja (N2), inwentarz --globalnie ponownie → dane/konto-inwentarz-globalny-po.txt i różnica przed/po
   (tokeny always-on na sesję, liczba skilli, MCP, hooki).
7. Ustal ze mną, gdzie ma żyć narzędzie inwentarza (rekomendacja: skill na moim koncie, np. /konto).
8. Propozycja (bez edycji) profilu .claude/settings.json szablonu dla nowych projektów (It. 3c).

Oddaj i CZEKAJ na akceptację. Po akceptacji: HANDOFF (§2, 6a, §8 → instrukcja startowa It. 1 — telemetria, z planem do akceptacji
przed pierwszą edycją .claude/), pamięć projektu, commit docs/reviews.
Styl: krótko; problem → przyczyna → co robimy → co mi to da; wniosek na początku.
```

**RAPORTY ETAPU 5 (WYKONANA 2026-09-27/28 — zostawiona dla historii; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Decyzje i plan wdrożenia ZAAKCEPTOWANE (HANDOFF 6a pkt 34). Zadanie tej sesji: dwa raporty etapu 5 w FORMIE SKRÓCONEJ (6a pkt 35) —
BEZ agentów, BEZ zmian w .claude/, BEZ publikacji jako strony.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF.md §1, §2, §3, 6a pkt 32–35, §7; PANEL-WYNIK.md (całość) i wersję
operatora; PANEL-WEJSCIE.md §8 (tezy na jednym filarze) i §9 (ograniczenia L6–L18, trzy zdania z ETAP2 §6); TEST-REVIEW-WYNIK-DLA-OPERATORA.md;
dane/panel-koszt.txt i docstringi skrypty/panel_koszt_{dane,model,projektu}.py. Pozostałe pliki etapów czytaj tylko po to, żeby wskazać dowód.
Decyzje z 6a obowiązują — nie pytaj o nie ponownie.

Do zrobienia:
1. Koszt „po” skryptem (jedyna nowa liczba): tabela ról docelowego pipeline'u (PANEL-WYNIK §5 i §4) jako dane/panel-projekt-docelowy.json
   w formacie projektu dla skrypty/panel_koszt_projektu.py → dane/raport-koszt-po.{txt,json}: faza i zadanie dziś vs po całym planie, udziały etapów,
   osobno wkład allowlisty / kontekstu i pokręteł review (dźwignie nie sumują się — liczy model per rola, nie dodawanie procentów); przy każdej liczbie
   zastrzeżenie z panel-koszt.txt §3 (małe fazy runu 20.09 zaniżają duże — liczby bezwzględne to dolna granica, porównanie względne).
   PUŁAPKI: panel_koszt_projektu.py ZAWSZE zapisuje do dane/panel-koszt.{txt,json} — przekieruj wyjście do raport-koszt-po (flaga albo mały wrapper)
   i sprawdź `git diff dane/panel-koszt.*` = pusty; model nie liczy efortu wprost (wariant ±20% pracy) — pokrętła efortu i list z testu
   (dane/pokretla-kosztu.json) wprowadzaj jako mnożnik pracy roli z odesłaniem do liczby z testu, nie jako nowe założenie.
2. RAPORT-DLA-OPERATORA.md — w pełni, prostym językiem, wniosek na górze: dziś / po w 5–8 punktach; co zyskam (koszt, czas, jakość) z liczbami;
   czego to wymaga ode mnie (decyzje, zadanie sprzątające ESLint w oferty-online, 2–3 zadania na B0, nowe sesje po zmianach .claude/); higiena konta
   i L8 (jak radzić sobie z dużą liczbą MCP i skilli — allowlista); trzy lekcje z ETAP2 §6; co może się nie udać (tezy §8 i ograniczenia prostymi słowami);
   jak za miesiąc czytać pierwszy pomiar (które liczby, gdzie, kiedy cofamy zmianę). Na koniec mapa „gdzie jesteśmy / co dalej / czego ode mnie chcesz”.
3. RAPORT-TECHNICZNY.md — SPIS, nie opowieść: decyzja per element pipeline'u (roster, sceptycy, fix, bramki, wiedza, kontekst, skille, telemetria,
   E2E, dev-pr, bot, usunięcia) w jednej linii + plik z dowodem; mapa plików analizy (co leży gdzie, który plik jest aktualny, które zapisy są
   nieaktualne — np. HANDOFF §4, §5, ETAP1 performance ZASTĄP); ograniczenia L6–L18 i tezy §8 ze stanem po teście review; ścieżki do danych i skryptów;
   szybkie zyski (co najtańsze w It. 3c); odesłania do PANEL-WYNIK zamiast kopiowania.
4. Kontrola w obie strony: raporty → źródła (każda liczba w pliku danych) i źródła → raporty skryptem wg wzoru skrypty/panel_wynik_pokrycie.py
   (6a pkt 1–35, PANEL-WEJSCIE §8–§9, PANEL-WYNIK §1–§6) — wynik dane/raporty-pokrycie.txt, braki dopisać przed oddaniem.
Oddaj i CZEKAJ na akceptację.

Zasady: nic nie zmieniaj w .claude/, CLAUDE.md ani oferty-online; zero agentów i sesji headless; liczby skryptem; pliki .md tylko Write/Edit
(JSON zawierający „.md” też przez Write — md-guard); __pycache__ usuwaj. Styl: problem → przyczyna → co robimy → co mi to da; wniosek na początku.
Po akceptacji: HANDOFF (§2 wiersz 5, 6a, §8 → instrukcja startowa wdrożenia iteracji 1 z planem do akceptacji przed pierwszą edycją .claude/),
pamięć projektu, commit docs/reviews.
```

**DECYZJE I PLAN WDROŻENIA (WYKONANA 2026-09-27 — zostawiona dla historii; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Test review ZROBIONY i przeanalizowany (HANDOFF 6a pkt 32), run 3 (sceptycy) POMINIĘTY (6a pkt 33). Zadanie tej sesji: decyzje dla pozostałych
otwartych punktów i plan wdrożenia zmian w obecnym pipeline'ie — BEZ agentów i BEZ zmian w .claude/.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF.md 6a pkt 19–33, §7; TEST-REVIEW-WYNIK.md (całość) i wersję operatora;
PANEL-PLAN.md §1 (tabela D1–D12) i §7 pkt 5 (rekord per decyzja); PANEL-WEJSCIE.md §2, §2a, §10, §12; MAPA-WALIDACJI-DLA-OPERATORA.md;
dane/panel-koszt.txt; katalog projektu A w dane/panel-run1-projekty.json (źródło pokręteł optymalizacji); dane/pa-proponowany.diff (prompt-audit).
Decyzje z 6a obowiązują — nie pytaj o nie ponownie. D1 i D12 cz. 1 są ZAMKNIĘTE (6a pkt 32).

Do zrobienia:
1. lista pokręteł kosztu obecnego review (efort per rola, długość i kształt poleceń, warunki uruchamiania reviewerów, dossier) — każde z liczbą
   z testu review lub z danych panelu, przypisane do decyzji D3/D6/D10 albo jako nowa pozycja z uzasadnieniem; liczby skryptem (skrypty/*.py → dane/);
2. rekord per otwarta decyzja (D2–D11, D12 cz. 2) wg PANEL-PLAN §7 pkt 5 bez pól sceptyka: wybór, odrzucone opcje i dlaczego, dane, metryka
   (wpis mapy walidacji, baseline, horyzont — okno 5 PR względem B0), warunek odwrotu, pewność; tam, gdzie test review coś mierzył (D2, D5), jego liczby;
3. plan wdrożenia w iteracjach (etap 5): kolejność zgodna z przesądzeniami D11 (iteracja 1 = telemetria + import), potem najpewniejszy zysk
   (kontrola diffu fixa wg A), bramki lint/knip, mutanty dla reviewera testów, pokrętła kosztu po jednym; każda iteracja = para (zmiana, wpis mapy);
4. PANEL-WYNIK.md (rekordy, docelowy pipeline jako całość, iteracje, ograniczenia) + PANEL-WYNIK-DLA-OPERATORA.md (prosty język, wniosek na górze).
Sprawdź oba dokumenty w obie strony. Oddaj i CZEKAJ na akceptację.

Zasady: nic nie zmieniaj w .claude/, CLAUDE.md ani oferty-online; zero agentów i sesji headless; liczby skryptem; pliki .md tylko Write/Edit
(JSON zawierający „.md” też przez Write — md-guard); __pycache__ usuwaj. Styl: problem → przyczyna → co robimy → co mi to da; wniosek na początku,
na koniec mapa „gdzie jesteśmy / co dalej / czego ode mnie chcesz”. Jeśli kontekst zbliży się do ~400k, zatrzymaj się, zaktualizuj stan
w HANDOFF §8 i daj mi instrukcję kontynuacji. Po akceptacji: HANDOFF (6a, §8), pamięć projektu, commit docs/reviews.
```

**ANALIZA WYNIKU TESTU REVIEW (WYKONANA 2026-09-27 — zostawiona dla historii; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Etap główny testu review ZROBIONY (HANDOFF 6a pkt 31, §8 „ETAP GŁÓWNY ZROBIONY”). Moja zgoda: analiza wyniku i raport — BEZ agentów.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF.md 6a pkt 29–31, §7, §8 akapity „STAN PRZYGOTOWANIA ETAPU GŁÓWNEGO”
(z „ETAP GŁÓWNY ZROBIONY”); TEST-REVIEW-PLAN.md §5.2–§5.3, §6, §8, §9, §11; TEST-REVIEW-PILOT-DLA-OPERATORA.md; TEST-REVIEW-ETAP-DLA-OPERATORA.md;
dane/test-review/metryki-etap.txt, etap.txt, etap-koszt.txt, koszt.txt; docstringi skryptów test_review_{wynik,pilot,etap}.py.
Decyzje z 6a obowiązują — nie pytaj o nie ponownie.

Do zrobienia (skrypt skrypty/test_review_analiza.py → dane/test-review/wynik-*.json|txt; liczby tylko skryptem):
1. kalibracja sędziego etapu: próbka 20 decyzji (10 PEŁNE/CZĘŚCIOWE, 10 BRAK przy findingach w tym samym pliku) z nowych jednostek, ziarno stałe,
   czytasz na kopiach i w ~/test-review/sedzia/*-p1-mapowanie.json; próg 15% (plan §5.2);
2. różnice A/B/C vs 0 sparowane po przypadku, osobno klucz 1 (zysk) i klucz 2 (strata), CI bootstrapem po fazach; „szeroko” jako miara główna;
3. przekroje: P1/P2, ogon, wrzesień, oś, rodzina; moduł fixa (x-*) osobno; wkład bramek; szum (POZA KLUCZEM na fazę i na 100 linii, P1/P2);
   złapane po weryfikacji (sceptycy, tylko klucz 1); koszt na fazę i na złapaną uwagę B (metodą panel_koszt_model, kolumna „po zmianie kontekstu”);
4. klucz 2 — lista trafień, które każdy wariant GUBI względem 0, z wagą (P1/P2) i jednym zdaniem, czego dotyczą;
5. wnioski dla D2–D12 wg planu §8 (co test rozstrzyga, co idzie z warunkiem odwrotu).
Wynik: TEST-REVIEW-WYNIK.md + TEST-REVIEW-WYNIK-DLA-OPERATORA.md (prosty język; oba klucze opisane jako zysk i strata względem dziś,
ze stronniczością każdego klucza wprost — 6a pkt 31). Sprawdź oba dokumenty w obie strony. Oddaj i CZEKAJ na akceptację.

Zasady: nic nie zmieniaj w .claude/, CLAUDE.md ani oferty-online; zero agentów i sesji headless; liczby skryptem (skrypty/*.py → dane/);
pliki .md tylko Write/Edit; __pycache__ usuwaj. Styl: problem → przyczyna → co robimy → co mi to da; na koniec mapa „gdzie jesteśmy / co dalej /
czego ode mnie chcesz”. Jeśli kontekst zbliży się do ~400k, zatrzymaj się, zaktualizuj stan w HANDOFF §8 i daj mi instrukcję kontynuacji.
Po akceptacji: HANDOFF (6a, §8), pamięć projektu, commit docs/reviews.
```

**PILOT TESTU REVIEW (ZROBIONE 2026-09-25 — zostawione dla historii; nowa sesja na nowym koncie; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja (nowe konto), sesja główna na Opus 5.5.
Przygotowanie testu review ZROBIONE w poprzedniej sesji (HANDOFF §8 „STAN PRZYGOTOWANIA TESTU REVIEW”). Zadanie tej sesji: próba harnessu,
a po jej powodzeniu PILOT testu review — uruchamiany skryptem, nie dev-autopilotem.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Moja zgoda (wklejenie tej wiadomości = zgoda): (1) próba harnessu i pilot wg TEST-REVIEW-PLAN §12 pkt 2 — 3 fazy + powtórka b26128d + 2 commity
fixa; (2) efort wariantu 0 = high; (3) twardy limit pilota 224 M jedn. (środek 93, górna 149 — dane/test-review/koszt-pilota.txt). Na etap
główny zgody NIE ma.

Przeczytaj najpierw (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF.md §8 akapit „STAN PRZYGOTOWANIA TESTU REVIEW”, §7 (pułapki),
6a pkt 28–29; TEST-REVIEW-PRZYGOTOWANIE-DLA-OPERATORA.md; TEST-REVIEW-PLAN.md §5, §6, §10–§12; nagłówki (docstringi) skryptów
skrypty/test_review_*.py i test_review_uruchom.sh. Decyzje z 6a obowiązują — nie pytaj o nie ponownie. Nie przepisuj skryptów bez potrzeby.

Kolejność:
1. Próba harnessu PRZESZŁA w poprzedniej sesji (HANDOFF §8: -p czeka na Workflow, deny działa). Na nowym koncie powtórz ją raz jako sprawdzenie
   konta: skrypty/test_review_uruchom.sh proba (~1 min, ~0,7 USD). Warunek przejścia: RUN <id> completed z wynikiem {"ok":1,…} i ODMOWA
   odczytu pliku z Documents. Jeśli nie przejdzie — zatrzymaj się, zdiagnozuj i opisz mi problem; pilota wtedy nie uruchamiaj.
2. Pilot: skrypty/test_review_uruchom.sh pilot uruchom w TLE (Bash run_in_background, log do ~/test-review/sesje/pilot.log) i nadzoruj:
   po każdej fazie przeczytaj dane/test-review/skan-<et>.txt i dane/test-review/koszt.txt. Twarde zatrzymania §11 (model, przeciek, zapis, N1,
   limit kosztu, >10% agentów null, kontrola bajtowa) — skrypt przerywa sam; ty wtedy nie wznawiaj, tylko raportuj. Czas ~3–4 h.
3. Po pilocie: skrypty/test_review_kopia.sh stan po (dowód „bez zmian”; różnica z moich commitów w oferty-online to nie alarm — sprawdź autora),
   skrypty/test_review_wynik.py metryki (wszystkie etykiety), kalibracja sędziego: przeczytaj 20 decyzji (10 PEŁNE/CZĘŚCIOWE, 10 BRAK przy
   findingach w tym samym pliku) na kopii i w ~/test-review/sedzia/*-mapowanie.json; zgodność sędziego p1 vs p2; stabilność b26128d vs r2.
4. Wynik: dane/test-review/pilot-*.json + notatka TEST-REVIEW-PILOT-DLA-OPERATORA.md (koszt zmierzony vs szacunek, kalibracja, szczelność,
   stabilność, pierwsze liczby złapań — bez wniosków o jakości, MDD pilota ~50 pkt) i ZATRZYMAJ SIĘ na moją decyzję o zakresie etapu głównego.

Zasady: nic nie zmieniaj w .claude/, CLAUDE.md ani w oferty-online; liczby skryptem (skrypty/*.py → dane/); pliki .md tylko Write/Edit;
__pycache__ usuwaj. Styl: problem → przyczyna → co robimy → co mi to da. Jeśli kontekst zbliży się do ~400k, zatrzymaj się, zaktualizuj stan
w HANDOFF §8 i daj mi instrukcję kontynuacji w czacie. Po mojej akceptacji notatki: HANDOFF (6a, §8), pamięć projektu, commit docs/reviews.
```

**PRZYGOTOWANIE TESTU REVIEW (ZROBIONE 2026-09-25 w sesji 83cd0aa0 — zostawione dla historii; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Plan prawdziwego testu review ZAAKCEPTOWANY (HANDOFF 6a pkt 29). Zadanie tej sesji: skrypty przygotowawcze testu i przygotowanie pilota — BEZ uruchamiania agentów.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF.md 6a pkt 28–29, §7 (pułapki, w tym „Plan testu review”), §8 akapit
„STAN PO PLANIE TESTU REVIEW”; TEST-REVIEW-PLAN.md w całości; dane/test-review-fazy.txt, dane/test-review-klucz2.txt, dane/test-review-plan.txt;
dane/panel-run1-projekty.json (architektura, katalog[], role_koszt[], warstwa_stala[] A/B/C); .claude/workflows/dev-docs-review-wf.js (tylko odczyt);
POMIARY-ROZSTRZYGNIECIE.md §3 (pułapki bramek); skill workflow-authoring. Decyzje z 6a obowiązują — nie pytaj o nie ponownie.

Do zrobienia (TEST-REVIEW-PLAN §12 pkt 1): test_review_kopia.sh (lustro poza oferty-online, klon ucięty na fazie, overlay .claude/ szablonu, learned-patterns
i CLAUDE.md z epoki, skip-worktree, instalacja, zapis stanu „przed”), test_review_bramki.py (konfiguracje ESLint z katalogów A/B/C, knip, size-limit, Stryker,
migracje), test_review_warianty.py (wariant 0 ucięty przed Verify z kontrolą bajtową; A/B/C z brzmienia katalogów + dane/test-review-warunki.json),
test_review_sedzia.py (pula i klucze z neutralnymi id, permutacja), test_review_uruchom.sh (przebieg fazami, sesje headless claude -p --model claude-opus-5-5,
--strict-mcp-config, efort wariantu 0 high, limit kosztu po każdej fazie), test_review_skan.py (modele, przeciek, zapisy), test_review_wynik.py (metryki, koszt
metodą panel_koszt_model). Moduł kontroli diffu fixa (§2.6) wchodzi. Kopie pilota (3 fazy + 2 commity fixa) przygotuj i sprawdź bramki na nich naprawdę (to nie są agenci).
Wynik: złożone prompty A/B/C i wariantu 0 do mojego wglądu (plik .txt w dane/test-review/ + krótka notatka TEST-REVIEW-PRZYGOTOWANIE-DLA-OPERATORA.md) oraz koszt
pilota z limitem. CZEKAJ na moją zgodę na pilot.

Zasady: nic nie zmieniaj w .claude/, CLAUDE.md ani w oferty-online (kopie i lustro poza repo, poza Documents/Kodowanie); subagentów i sesji headless nie uruchamiaj
bez mojej zgody; liczby skryptem (skrypty/*.py → dane/); pliki .md tylko Write/Edit. Styl: problem → przyczyna → co robimy → co mi to da. Jeśli kontekst zbliży
się do ~400k, zatrzymaj się, zaktualizuj stan w HANDOFF §8 i daj mi instrukcję kontynuacji w czacie. Po akceptacji: HANDOFF (6a, §8), pamięć projektu, commit docs/reviews.
```

**PLAN TESTU REVIEW (ZROBIONE 2026-09-25 — zostawione dla historii; nowa sesja, 6a pkt 28; operator dostał tę instrukcję w czacie; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Panel decyzyjny W TOKU: run 1 (projekty A/B/C) i run 2 (sędzia na papierze) zrobione. Run 2 zatrzymał się na kalibracji: ocena papierowa
przecenia (dzisiejszy pipeline 33% zamiast prawdziwych 0%). Moja decyzja (HANDOFF 6a pkt 28): żadnej koncepcji nie odrzucamy przed prawdziwym
testem. Zadanie tej sesji: PLAN prawdziwego testu review — tylko plan i koszt, bez uruchamiania agentów.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw (docs/reviews/2026-09-19-analiza-pipeline/): HANDOFF.md §8 akapity „STAN WYKONANIA PANELU PO RUN 1” i „STAN PO RUN 2”,
6a pkt 27–28, §7 (pułapki); PANEL-PLAN.md §2 (rubryka i „czego run 2 nie zmierzy”), §3, §8, §10, §11; PANEL-WEJSCIE.md §1, §2 pkt 7–11, §2a, §6, §12;
POMIARY-ROZSTRZYGNIECIE.md §4 (powtórka review odtwarza ~50% findingów) i §5 pkt 4 (run kontrolny); dane/panel-koszt.txt, dane/panel-pokrycie.txt;
dane/panel-run1-projekty.json (architektura, katalog[], role_koszt[] projektów A/B/C) i dane/panel-katalog-projekt0.json; skill workflow-authoring.
Decyzje z 6a obowiązują — nie pytaj o nie ponownie.

Cel testu: na prawdziwym kodzie oferty-online sprawdzić, ile znanych uwag bota (zestaw 195 B, dane/panel-zestaw-historyczny.jsonl) znajduje review
dzisiejszego pipeline'u oraz review projektów A, B i C — wszystkie cztery warianty (żaden nie odpada) — i ile to kosztuje.
Plan ma rozstrzygnąć, z liczbami ze skryptów:
- wybór faz: które historyczne fazy oferty-online (gałęzie zadań, commity faz) zawierają przypadki B; stan kodu PRZED review/fixem tej fazy; pokrycie
  osi, P1/P2, ogona i września; ile faz daje sensowny wynik przy losowości review (~50% powtarzalności) — powtórki czy więcej faz;
- odtworzenie kodu: kopia/worktree poza repo, oferty-online i .claude/ bez żadnych zmian;
- reviewerzy: dzisiejszy = obecne prompty z .claude/ bez zmian; A/B/C = prompty testowe złożone z brzmienia katalogów (nie pliki w .claude/),
  z tym samym modelem i efortem co w projekcie; bramki (ESLint z regułami projektów, knip, Stryker, migrations.sum) uruchamiane naprawdę na kodzie fazy;
- klucz: dopasowanie findingów do znanych uwag bota (plik, linia, klasa) przez ślepego sędziego dopasowania; osobno fałszywe alarmy (findingi spoza klucza);
- koszt: z transkryptów tą samą metodą co panel_koszt_model.py, plus szacunek całego testu przed startem i twardy limit;
- które z decyzji D2–D12 ten sam test może zmierzyć, a które zostają z warunkiem odwrotu do pomiaru po wdrożeniu (run 3 sceptyków wstrzymany do tej decyzji);
- czego test nie zmierzy, ryzyka, twarde zatrzymania.
Wynik: TEST-REVIEW-PLAN.md + TEST-REVIEW-PLAN-DLA-OPERATORA.md (prosty język, bez tabel i ścieżek), sprawdzone w obie strony. Oddaj i CZEKAJ na akceptację.

Zasady: nic nie zmieniaj w .claude/, CLAUDE.md ani w oferty-online; subagentów nie uruchamiaj bez mojej zgody (pokaż zakres i koszt); liczby skryptem
(skrypty/*.py → dane/); pliki .md tylko Write/Edit. Styl: problem → przyczyna → co robimy → co mi to da. Jeśli kontekst zbliży się do ~400k,
zatrzymaj się, zaktualizuj stan w HANDOFF §8 i daj mi instrukcję kontynuacji w czacie. Po akceptacji: HANDOFF (6a, §8), pamięć projektu, commit docs/reviews.
```

**KONTYNUACJA PANELU PO RUN 1 (nowa sesja; zdanie „Do agentów…” zostaw — N1):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Panel decyzyjny W TOKU: krok 0 i run 1 zrobione w poprzedniej sesji, notatkę po run 1 przeczytałem — daję „dalej”.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw: docs/reviews/2026-09-19-analiza-pipeline/HANDOFF.md §8 akapit „STAN WYKONANIA PANELU PO RUN 1” (to jest stan — nie powtarzaj kroku 0 ani run 1),
PANEL-PLAN.md w całości, HANDOFF §7 (pułapki); PANEL-WEJSCIE.md §1, §2, §2a, §6, §7, §12; dane/panel-koszt.txt, dane/panel-kompletnosc.txt; skrypty/panel-run1.js
(wzór promptu i schematu, format katalog[]); skill workflow-authoring przed pisaniem skryptów runów. Decyzje z 6a obowiązują — nie pytaj o nie ponownie.
Kryterium walidacji kosztu (±5%) przyjmuję jako sumę faz runu 20.09 — pojedyncze fazy tylko do raportu.
Kolejność: katalog projektu 0 (dzisiejszy pipeline, ta sama szczegółowość i format katalog[] co w run 1, z obecnych promptów osi, plików reviewerów, bramek i workflowów
.claude/ — tylko odczyt; zapis dane/panel-katalog-projekt0.json) → run 2 (sędzia wg PANEL-PLAN §5: 3 porcje, katalogi P/Q/R/S z permutacją, przypadki
z dane/panel-zestaw-historyczny.jsonl przez args, effort medium, model claude-opus-5-5) → panel_modele.py + panel_pokrycie.py (kalibracja kolumną projektu 0, próg 15% z §10)
→ wstępne wybory per decyzja → run 3 (sceptycy wg §6) → synteza (PANEL-WYNIK.md + PANEL-WYNIK-DLA-OPERATORA.md) i CZEKASZ na akceptację.
Twarde zatrzymania: PANEL-PLAN §10. Jeśli kontekst sesji zbliży się do ~400k, zatrzymaj się po zakończonym runie, zaktualizuj ten akapit stanu w HANDOFF §8 i daj mi instrukcję
kontynuacji. Pliki .md tylko Write/Edit; liczby skryptem; kontrola w obie strony; po akceptacji: HANDOFF (wiersz 4, 6a, §8), PANEL-WEJSCIE, mapa walidacji,
pamięć projektu, commit docs/reviews.
```

**WYKONANIE PANELU (WYKONANE do run 1 w sesji 6e626ae3 — zostawione jako zapis; kontynuacja wyżej):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Plan panelu decyzyjnego ZAAKCEPTOWANY — daję znak na WYKONANIE wg PANEL-PLAN.md. D12: wchodzi (operator 2026-09-24). Projektant C: zostaje (operator 2026-09-24).
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw: docs/reviews/2026-09-19-analiza-pipeline/PANEL-PLAN.md w całości, HANDOFF.md §2 (wiersz 4), 6a pkt 22–26, §7 (pułapki);
PANEL-WEJSCIE.md §1, §2, §2a, §6, §7, §12; skill workflow-authoring przed pisaniem skryptów runów. Decyzje z 6a obowiązują — nie pytaj o nie ponownie.
Kolejność: krok 0 po znaku (panel_koszt_projektu.py z walidacją na runie 20.09 ±5%, częstości warunków, sprawdzenie git status/mtime .claude) → run 1 →
notatka dla mnie i CZEKASZ na „dalej” → katalog projektu 0 → run 2 → wstępne wybory → run 3 → synteza (PANEL-WYNIK.md + wersja dla operatora) i CZEKASZ na akceptację.
Twarde zatrzymania: PANEL-PLAN §10. Po każdym runie panel_modele.py (model z transkryptów). Pliki .md tylko Write/Edit; liczby skryptem; kontrola w obie strony;
po akceptacji: HANDOFF (wiersz 4, 6a, §8), PANEL-WEJSCIE, mapa walidacji, pamięć projektu, commit docs/reviews.
```

**AKTUALNA — PANEL DECYZYJNY — część A WYKONANA 2026-09-24 (plan w PANEL-PLAN.md); zostawiona jako zapis (wklej jako pierwszą wiadomość, gdy dajesz znak; zdanie „Do agentów…” zostaw — mini-run N1; prompt-audit zrobiony
2026-09-24 (6a pkt 25); tematy-inspiracje zrobione 2026-09-24 (6a pkt 26) — instrukcja już je uwzględnia):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Mini-run ZROBIONY i zaakceptowany (HANDOFF 6a pkt 21), prompt-audit ZROBIONY i zaakceptowany (6a pkt 25), tematy-inspiracje ZROBIONE (6a pkt 26). Daję znak na PANEL DECYZYJNY etapu 4 (6a pkt 23) — najpierw PLAN (część A), wykonanie dopiero po moim drugim znaku.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw, w całości:
1. docs/reviews/2026-09-19-analiza-pipeline/HANDOFF.md — sekcja 2 (wiersze 3¾, 3⅞, 3⅞b i 4), sekcja 3, 6a pkt 15–26 (i ewentualne dalsze), sekcja 7 (pułapki)
2. docs/reviews/2026-09-19-analiza-pipeline/PANEL-WEJSCIE.md w całości — jedyny plik „co obowiązuje” dla panelu (§0 skład i kto co czyta, §1 precedensy,
   §2 wymogi, §2a z ustaleniami mini-runu, §6 założenia z odwrotem, §7 elementy nietknięte, §11 wynik mini-runu, §12 rekord i mapa walidacji)
3. docs/reviews/2026-09-19-analiza-pipeline/MINI-RUN-WYNIK.md oraz PROMPT-AUDIT.md §1 i §4 (zasady pisania warstwy stałej ról i otwarte decyzje —
   streszczone też w PANEL-WEJSCIE §2a; każdy prompt panelu piszesz według tych zasad) oraz INSPIRACJE-POCOCK-PSTACK.md §1 i §3 (B1, B2, B6, B7) —
   tło wymogów §2 pkt 14–16 (mapa funkcji, granice warstw, ogrodnik) i otwartej decyzji builder ↔ reviewer
4. docs/reviews/2026-09-19-analiza-pipeline/ETAP1-ROZSTRZYGNIECIE.md §3 (68 ucieczek) i dane/coderabbit/klasyfikacja-574.csv (uwagi B z klasą) — zestaw historyczny
5. skill workflow-authoring (API skryptu, pułapki) — przed pisaniem skryptu panelu
Decyzje operatora są w HANDOFF 6a (od pkt 1 do ostatniego) — nie pytaj o nie ponownie.

CZĘŚĆ A — PLAN PANELU DECYZYJNEGO (bez uruchamiania czegokolwiek, co kosztuje), w pliku PANEL-PLAN.md + narracja PANEL-PLAN-DLA-OPERATORA.md:
- KROK 0 (sesja główna, skrypty, zero agentów) — przygotuj i pokaż w planie: (a) listę OTWARTYCH decyzji z opcjami i danymi (kandydaci w 6a pkt 23
  i z prompt-auditu w 6a pkt 25: efort per klasa roli, warstwy weryfikacji, research w dev-plan, opisy workflowów-dzieci; z inspiracji w 6a pkt 26:
  rozkład reguł zachowaniowych builder ↔ reviewer; wymogi §2 pkt 14–16 są przesądzone — panel projektuje ich kształt, nie „czy”;
  sprawdź w PANEL-WEJSCIE, czy któraś nie jest już przesądzona wymogiem §2, i czy czegoś nie brakuje); stały szkielet = wymogi §2; (b) zestaw historyczny
  (68 ucieczek + uwagi B z klasą; format jednego przypadku, jak sędzia rozpozna „złapane i czym”); (c) skrypt kosztu projektu (model kosztu etapu 0 + starty
  klas z mini-runu (e)) — co liczy, na jakim wejściu od projektanta;
- RUN 1: projektanci per architektura review (ile i jakie architektury — uzasadnij z danych), każdy broni swojej i rozstrzyga pozostałe otwarte decyzje;
  schemat wyniku = zapis per decyzja + spełnienie wymogów §2 + założenia §6 z odwrotem + elementy §7 + rekord §12; co dostaje (pliki), czego NIE (werdykty workflow-A);
- RUN 2: sędzia jakości na zestawie historycznym (schemat: przypadek × projekt → złapany / czym / nie); RUN 3: sceptyk asymetryczny per otwarta decyzja,
  zarzut tylko z dowodem; synteza w sesji głównej → rekord per decyzja (wybór, dlaczego, metryka z mapy walidacji, warunek odwrotu);
- model: każdy agent z przypiętym `model: 'claude-opus-5-5'` (6a pkt 22; krok 0 mini-runu: pełny identyfikator przypina; bez osobnego agenta sprawdzającego),
  model każdego agenta odczytany z transkryptu po runie; effort per rola — uzasadnij;
- zabezpieczenia z mini-runu: N1 (każdy prompt: „to jest twoje jedyne zadanie”; moja wiadomość ze znakiem ma zdanie do agentów), N2 (panel startuje z nowej sesji);
- szacunek kosztu i czasu, punkty zatrzymania, co jest poza zakresem (panel nie pisze kodu).
Wracasz z planem i CZEKASZ NA ZNAK. Zasady: pliki .md tylko Write/Edit, wersja operatora narracją (problem → przyczyna → co robimy → co to daje),
sprawdzenie w obie strony, HANDOFF §8 na koniec, commit docs/reviews po akceptacji.
```

**Poprzednia instrukcja (część C mini-runu — WYKONANA 2026-09-23):**

```
Kontynuujemy mini-run analizy pipeline'u dev-* w workspace-template (sesja główna Opus 5.5, nowa po wyczyszczeniu kontekstu).
Przeczytaj HANDOFF.md §8 akapit „MINI-RUN W TOKU” oraz MINI-RUN-PLAN.md w całości (§7 = kryteria zapisane przed startem), potem dane/mr-markery-wynik.txt,
dane/mr-harness.txt, dane/mr-kontekst-sesja-przeniesiona-e1.txt. Nie uruchamiaj żadnych agentów.

Wklejam ostatnią wiadomość z sesji w kopii (serie E1, E2, A1–A3): <WKLEJ TUTAJ>

Zrób, w tej kolejności, wszystko skryptami (skrypty/mr_*.py), bez agentów:
1. Skopiuj scratchpad/mr/wyniki/A-* i scratchpad/mr/stop-hook.jsonl do dane/mr-surowe/ (ścieżki w HANDOFF §8).
2. python3 skrypty/mr_kontekst.py <katalog runu E1> <katalog runu E2>  (katalogi: <projekt kopii>/<sesja w kopii>/subagents/workflows/<wf_…>)
   — sprawdź najpierw w transkryptach, że instrukcje agentów to CLAUDE.md i learned-patterns KOPII (nie workspace-template) i model claude-opus-5-5 / haiku.
3. python3 skrypty/mr_ocena.py  (oceni też A-1..A-3: markery M1–M5 = pytanie a, R = b, S = c, dotarcie R/S do kontekstu, czym builder czytał migracje).
4. python3 skrypty/mr_harness.py  (dołoży runy i wpisy hooka z sesji w kopii).
5. Rozstrzygnij (a)–(f) wg kryteriów MINI-RUN-PLAN §7 i napisz MINI-RUN-WYNIK.md (per pytanie: wynik, dowód, co zmienia w pakiecie) + MINI-RUN-DLA-OPERATORA.md
   (narracja: problem → przyczyna → co robimy → co to daje; bez tabel i ścieżek). Sprawdź oba pliki w obie strony, łącznie z przeliczeniem progów.
6. Oddaj mi wynik i CZEKAJ na akceptację. Dopiero po niej: zmiany w PANEL-WEJSCIE §11/§12, §1 pkt 4, mapie walidacji; HANDOFF (wiersz 3½, 6a, §8 → panel na Fable
   na znak), pamięć projektu, commit docs/reviews. Kopia w scratchpadzie może zostać do końca analizy (usuwanie tylko za moją zgodą).
Zasady jak w poprzedniej instrukcji niżej (pliki .md tylko Write/Edit, styl, obie strony, HANDOFF §8 na koniec).
```

Poprzednia instrukcja (część A i B do „MINI-RUN W TOKU”):

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Przegląd domknięć ZAKOŃCZONY (D1–D6 przyjęte), decyzje z D6 PODJĘTE (HANDOFF 6a pkt 20). Nie wracaj do nich.
Dziś: MINI-RUN przed panelem — najpierw PLAN (część A), potem po moim znaku WYKONANIE (część B) i WYNIK (część C).

Przeczytaj najpierw, w całości:
1. docs/reviews/2026-09-19-analiza-pipeline/HANDOFF.md — sekcja 2 (wiersz 3½), sekcja 3, 6a pkt 9, 15–20, sekcja 7 (pułapki)
2. docs/reviews/2026-09-19-analiza-pipeline/PANEL-WEJSCIE.md — §1 pkt 4, §2 pkt 1–4, §11 (mini-run: pytania a–f), §12 (cele ctx_start, pola rekordu)
3. docs/reviews/2026-09-19-analiza-pipeline/POMIARY-ROZSTRZYGNIECIE.md §1 + dane/pomiar1-reguly-subagenci/ + skrypty/pomiar1_reguly_run*.sh —
   metoda markerów (wzorzec), repo testowe w repo-testowe.tgz
4. docs/reviews/2026-09-19-analiza-pipeline/PRZEGLAD-D4-DLA-OPERATORA.md + dane/d4r-dzwignia-kontekstu.txt + skrypty/d4r_dzwignia_kontekstu.py —
   co (e) ma potwierdzić i jak liczyć składniki startu z transkryptu
5. docs/reviews/2026-09-19-analiza-pipeline/dane/d5r-wykonalnosc-rekordu.txt §2 i §10 — plik harnessu i hook Stop (do pytania f)
Decyzje operatora są w HANDOFF 6a pkt 1–20 — nie pytaj o nie ponownie.

CO MINI-RUN MA ROZSTRZYGNĄĆ (PANEL-WEJSCIE §11):
(a) reguła-marker wklejona przez orkiestrator do promptu delegacji — czy builder ją STOSUJE w kodzie;
(b) ta sama reguła przez `paths:` — kontrola (builder czyta Bashem, więc spodziewane: nie działa);
(c) marker w SKILL.md wstrzykniętym przez `skills:` — czy treść skilla jest stosowana, czy tylko zajmuje kontekst;
(d) ROZSTRZYGAJĄCE: ten sam marker w prompcie ~100 vs ~400 instrukcji — czy liczba poleceń jest u nas dźwignią jakości (kilka powtórzeń na wariant,
    podaj, ile i dlaczego tyle wystarczy);
(e) kontekst startowy per klasa roli i per model na obecnym stanie oferty-online (po ścięciu CLAUDE.md), dziś i z allowlistą `tools:`/`omitClaudeMd` —
    potwierdzenie dźwigni ≈ 40–50% i celów z D4 (mechaniczne ~9–10k, reviewer ~29k, builder ~38k); składniki liczyć metodą d4r; zapisać środowisko sesji
    (aplikacja desktop czy CLI, liczba narzędzi MCP), bo od niego zależy część allowlisty;
(f) czy plik harnessu `workflows/<run>.json` powstaje dopiero po końcu runu, co zostaje po zabiciu sesji, czy hook Stop odpala się po task-notification.

MODEL: sesja główna Opus 5.5. Agenci mini-runu na Opusie (6a pkt 19). UWAGA: wszystkie dotychczasowe runy pipeline'u (w tym punkt odniesienia z 20.09)
szły na claude-opus-5; alias „opus” w Workflow może dziś wskazywać Opus 5.5. W planie: najpierw jeden tani agent sprawdzający, jaki model faktycznie
dostaje `model: 'opus'`, i czy da się przypiąć konkretny model. Mini-run ma iść na TYM modelu, na którym będzie jechał pipeline po wdrożeniu;
jeśli to nie opus-5, odczyt (e) porównywać per model, a run 20.09 traktować jako punkt odniesienia innego modelu (tokenizer może się różnić — D4).
Model każdego agenta zapisz w wyniku.

CZĘŚĆ A — PLAN (bez uruchamiania czegokolwiek, co kosztuje): repo testowe (kopia/rozszerzenie pomiaru 1 albo kopia oferty-online tylko do odczytu —
uzasadnij), zadanie buildera, markery (losowe ciągi), warianty i liczba powtórzeń, jak przygotować prompt ~100 i ~400 instrukcji, jak sprawdzić
stosowanie markera skryptem (grep w kodzie), agenci (liczba, model, agentType, pliki agentów testowych z `tools:`/`omitClaudeMd`/`skills:`), szacunek
kosztu i czasu, kryteria rozstrzygnięcia każdego pytania ZAPISANE PRZED uruchomieniem, co jest poza zakresem. Plan w pliku MINI-RUN-PLAN.md + narracja dla mnie
MINI-RUN-PLAN-DLA-OPERATORA.md. Wracasz z planem i CZEKASZ NA ZNAK.

CZĘŚĆ B — WYKONANIE (dopiero po moim znaku): dokładnie wg planu; nie zmieniaj repo szablonu ani projektów (tylko repo testowe w scratchpadzie / kopie);
wyniki odtwarzaj z transkryptów i journala skryptem (skrypty/mr_*.py → dane/mr-*.{txt,json}), nie z pamięci; jeśli coś pójdzie inaczej niż w planie —
zatrzymaj się i powiedz.

CZĘŚĆ C — WYNIK: MINI-RUN-WYNIK.md (per pytanie: wynik, dowód, co to zmienia w pakiecie) + MINI-RUN-DLA-OPERATORA.md (narracja); zmiany w pakiecie
(PANEL-WEJSCIE §11/§12, §1 pkt 4, mapa walidacji) dopiero po mojej akceptacji; potem HANDOFF (wiersz 3½, 6a, §8 → następny krok: panel na Fable na znak),
pamięć projektu, commit docs/reviews.

ZASADY (nie do negocjacji):
- Agenci TYLKO w części B, tylko ci z planu, na Opusie (sprawdzenie modelu jak wyżej); analiza i wnioski w sesji głównej, skryptami. Żadnych agentów
  analizujących. Odczyt z GitHuba tylko przez gh w trybie odczytu.
- Pliki .md WYŁĄCZNIE przez Write/Edit — żadnych zamian w .md skryptem ani sed. Dane robocze jako .txt/.json.
- Każdy plik, który mi oddajesz, sprawdź W OBIE STRONY przed oddaniem, łącznie z przeliczeniem progów i sum.
- Styl: gdzie problem → co go powoduje → co z tym robimy → co mi to da. Prosto, bez tabel i ścieżek w wiadomościach do mnie.
- Jak odpowiadasz na temat z wcześniejszej rozmowy, zacznij od 2–3 zdań przypomnienia kontekstu.
- Na koniec sesji zaktualizuj HANDOFF §8 do stanu po sesji.

Wykonanie mini-runu dopiero na mój znak, po planie i rozmowie. Panel — osobno, na kolejny znak.
```

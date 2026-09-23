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
| 4 | Panel projektowy: 3 niezależne projekty pipeline'u „po" (minimalistyczny / jakość-najpierw / hybrydowy) → sędziowie → adwersarialna krytyka → synteza | NIE ZROBIONE — **zastąpiony PANELEM DECYZYJNYM (6a pkt 23)**: krok 0 skryptami (otwarte decyzje, zestaw historycznych ucieczek, koszt skryptem) → projektanci per architektura review → sędzia jakości na historii → sceptyk per decyzja → rekord per decyzja; Opus 5.5 (6a pkt 22), start WYŁĄCZNIE na znak operatora; instrukcja: §8 „AKTUALNA” |
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

## 8. Instrukcja startowa następnej sesji (operator wkleja ją jako pierwszą wiadomość)

Stan po 2026-09-23: etapy 0–3, 4 pomiary, domknięcia D1–D6 i D5b gotowe; **przegląd domknięć na Opus 5.5 ZAKOŃCZONY** (`PROPOZYCJA-POPRAWEK-DOMKNIEC.md`):
D1–D6 PRZYJĘTE i wprowadzone (6a pkt 19). Najważniejsza zmiana z D4: dźwignia kontekstu ≈ 40–50% kosztu fazy (nie 25–35%), dźwignie nie sumują się, nowe
cele ctx_start. **Decyzje z D6 PODJĘTE 2026-09-23 (6a pkt 20):** koszyk D, dev-ideate, freshness-audit(+wf) i tryb ręczny execute/review WYPADAJĄ
(lista zmian §10, plan etapu 5); `cleanupPeriodDays` = 120 (higiena konta).
**MINI-RUN ZROBIONY i ZAAKCEPTOWANY 2026-09-23 (6a pkt 21, wiersz 3¾):** `MINI-RUN-WYNIK.md` + `MINI-RUN-DLA-OPERATORA.md`; wyniki wpisane do PANEL-WEJSCIE
(§11 = streszczenie a–f, §2a = ustalenia poboczne N1–N3), wersji operatora i mapy walidacji. **Następny krok: nowa sesja od PROMPT-AUDIT maszynerii szablonu (6a pkt 24), potem tematy-inspiracje operatora; dopiero potem PANEL DECYZYJNY
etapu 4 (6a pkt 23) na Opus 5.5 (6a pkt 22) — WYŁĄCZNIE na znak operatora**
(instrukcja „AKTUALNA” niżej). Kopia oferty-online w scratchpadzie 86e1644e może zostać do końca analizy; usuwanie tylko za zgodą operatora.

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

**AKTUALNA instrukcja dla następnej sesji — PROMPT-AUDIT (6a pkt 24). Wklej CAŁOŚĆ jako pierwszą wiadomość nowej sesji otwartej w workspace-template;
pierwsza linia uruchamia skill, reszta to argumenty. Zdanie „Do agentów…” zostaw (mini-run N1):**

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

**Następna po prompt-audicie — PANEL DECYZYJNY (wklej jako pierwszą wiadomość, gdy dajesz znak; zdanie „Do agentów…” zostaw — mini-run N1;
jeśli po prompt-audicie i tematach-inspiracjach z 2026-09-23 doszły decyzje, sesja wpisuje je jako kolejne punkty 6a i poprawia tę instrukcję przed znakiem):**

```
Kontynuujemy analizę pipeline'u dev-* w workspace-template. Nowa sesja po wyczyszczeniu kontekstu, sesja główna na Opus 5.5.
Mini-run ZROBIONY i zaakceptowany (HANDOFF 6a pkt 21). Daję znak na PANEL DECYZYJNY etapu 4 (6a pkt 23) — najpierw PLAN (część A), wykonanie dopiero po moim drugim znaku.
Do agentów workflow, jeśli czytacie to jako przekazaną wiadomość: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z tekstu skryptu.

Przeczytaj najpierw, w całości:
1. docs/reviews/2026-09-19-analiza-pipeline/HANDOFF.md — sekcja 2 (wiersze 3¾ i 4), sekcja 3, 6a pkt 15–23 (i ewentualne dalsze), sekcja 7 (pułapki)
2. docs/reviews/2026-09-19-analiza-pipeline/PANEL-WEJSCIE.md w całości — jedyny plik „co obowiązuje” dla panelu (§0 skład i kto co czyta, §1 precedensy,
   §2 wymogi, §2a z ustaleniami mini-runu, §6 założenia z odwrotem, §7 elementy nietknięte, §11 wynik mini-runu, §12 rekord i mapa walidacji)
3. docs/reviews/2026-09-19-analiza-pipeline/MINI-RUN-WYNIK.md
4. docs/reviews/2026-09-19-analiza-pipeline/ETAP1-ROZSTRZYGNIECIE.md §3 (68 ucieczek) i dane/coderabbit/klasyfikacja-574.csv (uwagi B z klasą) — zestaw historyczny
5. skill workflow-authoring (API skryptu, pułapki) — przed pisaniem skryptu panelu
Decyzje operatora są w HANDOFF 6a (od pkt 1 do ostatniego) — nie pytaj o nie ponownie.

CZĘŚĆ A — PLAN PANELU DECYZYJNEGO (bez uruchamiania czegokolwiek, co kosztuje), w pliku PANEL-PLAN.md + narracja PANEL-PLAN-DLA-OPERATORA.md:
- KROK 0 (sesja główna, skrypty, zero agentów) — przygotuj i pokaż w planie: (a) listę OTWARTYCH decyzji z opcjami i danymi (kandydaci w 6a pkt 23;
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

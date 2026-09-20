# Etap 1 — rozstrzygnięcie 11 sporów (werdykt analityka kontra kontra sceptyka) + ucieczki do bota

**Data:** 2026-09-20. **Kto rozstrzyga:** sesja główna (Fable 5.1) na podstawie wyników 18 subagentów (Opus) z runu `wf_7181673d-ef5`.
**Źródła:** `dane/workflow-B-etap1-wyniki.json` (pełne werdykty + kontry + ucieczki), `dane/etap1-spory/*.txt` (to samo per element, czytelne),
`dane/workflow-A-wyniki-czesciowe.json` (6 werdyktów z poprzedniej sesji), `dane/dane-digest.md` (liczby v2).

## 0. Ustalenia przekrojowe (ważniejsze niż pojedyncze werdykty)

1. **Wszystkie 6 werdyktów z poprzedniej sesji (workflow A) było liczone na wycofanych danych v1.** Każda liczba bezwzględna
   (M jednostek, tury/agent, koszt/agent) jest w nich zawyżona ~2–2,5×. Procenty udziału zwykle się bronią, bo licznik i mianownik są
   zawyżone tak samo. **Nie cytować żadnej kwoty z workflow-A bez przeliczenia** z `agents.csv` / digestu v2. Pięciu nowych analityków
   (ten run) liczyło na v2, ale w czterech z pięciu sceptyk znalazł zgadnięte mnożniki lub fałszywe tezy nośne.
2. **Pole `obalone_n` w `findingi-per-os/*.json` jest zerowe we wszystkich 10 osiach** — to artefakt ekstrakcji, nie fakt o osi.
   Źródłem prawdy o obaleniach jest `przezywalnosc_osi2.txt` (globalnie 12% obalonych; per oś 0–5%) i telemetria (19,2% na 96 fazach).
   Każdy argument „0 obalonych = najlepsza jakość" wykreślić.
3. **Sceptycy „obalili" 11/11 werdyktów, ale etykieta przetrwała w 9/11.** Obalone były uzasadnienia i arytmetyka, nie kierunek.
   Zmiany etykiet: performance ZOSTAW-ODCHUDZ → **ZASTAP**; spec-compliance ZOSTAW-ODCHUDZ → **ZOSTAW**; code-quality ZASTAP → **ZOSTAW-ODCHUDZ**.
4. **Zweryfikowane oszczędności z odchudzania pojedynczych elementów są małe: łącznie ~8–10% kosztu fazy.** Największe pojedyncze
   dźwignie z tego etapu to ~2% każda (patrz §2). To potwierdza hipotezę 1 z handoffu: prawdziwa dźwignia (30–40%) leży w kontekście
   startowym agentów, nie w rosterze. Twardy dowód z kontry dossier: reviewerzy w oferty-online **przed 03.09: 398k/agent, 13 tur;
   po 06.09: 938k/agent, 28 tur** — kontekst per agent p50 141k → 246k. Wzrost kontekstu zjadł wielokrotność wszystkiego, co da się
   wyciąć w rosterze.
5. **Review nie zbiega** (potwierdzone ponownie): correctness znalazł swój „sztandarowy" P1 w `analytics.ts:301` dopiero przy DRUGIM
   pełnym przejściu tej samej fazy 4 (9b). Powtórka fazy po STOP-ie E2E = pełny skład 7 reviewerów + verify + scribe + fix.
6. **Reguły bez mechanicznego wejścia nie działają** (analiza ucieczek, §3): z 68 realnych defektów znalezionych przez bota po naszym
   review **45 miało i właściciela, i regułę** w prompcie lub learned-patterns — i mimo to przeszły. Dokładanie reguł do CLAUDE.md
   podnosi koszt każdej tury każdego agenta (37k tokenów) i nie podnosi wykrywalności.

## 1. Tabela rozstrzygnięć

| element | analityk | sceptyk | **rozstrzygnięcie** | zweryfikowana oszczędność / faza | miara skutku (do pomiaru po 5 fazach) |
|---|---|---|---|---|---|
| security | ZOSTAW-ODCHUDZ | obalony (v1, fence) | **ZOSTAW-ODCHUDZ (tylko prompt)** | ~0 tokenów (prompt 191→~90 linii) + warunek `plikiKodu>0` (wycina wywołania w fazach bez kodu) | P1/P2 klasy security od bota po review (dziś 7+6 w dwóch klasach ucieczek) |
| correctness | ZOSTAW-ODCHUDZ | obalony (v1, tury zmyślone) | **ZOSTAW-ODCHUDZ + własny plik agenta** | −0,33 M (tury 29,6→~20) ≈ −1,5% | liczba P1/P2 klasy „cykl życia/dwie drogi" od bota (dziś 20 = największa klasa) |
| spec-compliance | ZOSTAW-ODCHUDZ | obalony (v1, 3 z 5 zmian kasują findingi) | **ZOSTAW** (jedna korekta redakcyjna) | 0 | bez zmian; otwarte pytanie do etapu 4: 27% wyjścia to pliki .md poza miarą jakości (bot ma `!docs/**`) |
| performance | ZOSTAW-ODCHUDZ | obalony → ZASTAP | **ZASTAP** (size-limit w CI + Supabase advisors + 5-liniowa checklista perf w correctness) | −0,47 M (oś 1,5–2,2%) − ~0,5% indukowane (57% P3) ≈ **−2,5%** | P1/P2 klasy perf od bota; jeśli >1 na 5 faz → przywrócić oś warunkowo na tierze low |
| e2e | ZOSTAW-ODCHUDZ | obalony (rek. 1 już wdrożona 02.09) | **ZOSTAW-ODCHUDZ (harness → env-up, jedno źródło promptu, parametry z .env.e2e)** | ~0,3 M bezpośrednio; pośrednio: powtórka po STOP-ie E2E = sam tester (polityka orkiestratora) | liczba STOP-ów E2E z przyczyn zewnętrznych (limit mailera) → 0; koszt powtórek |
| code-quality | ZASTAP | obalony (8/9 P2 realne) | **ZOSTAW-ODCHUDZ + lint mechaniczny** (ESLint flat + knip w domknięciu; styl/progi zakazane w prompcie, fokus na kontrakty/mapowanie błędów/ciche odsiewanie/idempotencję) | −0,3–0,5 M (mniej P3 w fixie; 73% wyjścia to P3) | liczba P3 stylu tej osi → ~0; P2 zachowaniowe bez zmian |
| test-coverage | ZOSTAW-ODCHUDZ | obalony (zmiana b bez dźwigni) | **ZOSTAW-ODCHUDZ (kryterium falsyfikowalności zamiast „test istnieje + ma asercję")** + naprawić brak `zEffortem`/`agentType` | ~0 tokenów (zmiana jakościowa) | wpisy testing-issues po bocie (dziś 17 z 68 = klasa „test niefalsyfikowalny") |
| verify-sceptycy | ZOSTAW-ODCHUDZ (usuń ścieżkę P2) | obalony (zamiennik 48× słabszy) | **ZOSTAW; hipoteza do pomiaru: batch 4 findingów per sceptyk niezależnie od pliku** | dziś 0; hipoteza: 105→~30 agentów/23 fazy = −0,4 M ≈ −2% (sama opłata za powołanie) | odsetek obalonych i degradacji P2→P3 przy batchowaniu vs dziś (10,9% / 23%) |
| pętla fix | ZOSTAW-ODCHUDZ (scal kontrolę+poprawkę) | obalony (3 realne regresje złapane) | **ZOSTAW-ODCHUDZ: NIE scalać kontroli z poprawką; pre-skan → ESLint; zwiń → do stan:zapis** | −0,4 (pre-skan) −0,5 (zwiń) ≈ **−1%** | `regresje[]` z kontroli nadal niepuste w ~25% faz (dziś 3/12) |
| orkiestracja / stan / telemetria | ZOSTAW-ODCHUDZ (−2,85 pp) | obalony (scalenie przenosi pracę) | **ZOSTAW-ODCHUDZ: treść stanu (już policzona w JS) doklejana do promptu agenta-następcy zamiast osobnego agenta haiku; precheck → env-up; telemetria zostaje z gałęzią STOP; domknięcie bez zmian (pkt 1b NIE jest duplikatem)** | 80 powołań stan:zapis = 9,6 M/23 fazy ≈ −0,42 M ≈ **−2%**; precheck −0,25 pp; telemetria −0,28 pp | 0 utraconych zapisów stanu; telemetria przy STOP nadal pisana |
| dossier / dedup / scribe | ZOSTAW-ODCHUDZ (tnij scribe'a) | obalony (podział na 2 agentów = koszt ujemny) | **dedup ZOSTAW; scribe: niższy tier + krótszy prompt (nie dzielić); packager: OTWARTE — bilans ujemny (18,7 M kosztu vs 9,5 M routingu), a jedyny pomiar pokazuje, że reviewerzy po dossier czytają 2× więcej Bashem** | scribe −0,1–0,2 M; packager: do decyzji w etapie 4 | tury Bash reviewerów przed/po zmianie mandatu dossier |

**Suma zweryfikowanych oszczędności:** ~8–10% kosztu fazy (≈2 M z 21,8 M). Do tego dwie hipotezy niezmierzone (batch sceptyków, Read zamiast Bash u builderów).

## 2. Uzasadnienia rozstrzygnięć (tylko tam, gdzie odchodzę od analityka lub sceptyka)

**performance → ZASTAP.** Przyjmuję kontrę w całości: w 45 potwierdzonych są 3 P1 i żaden nie jest wydajnościowy (correctness, security,
OPERATOR); w domenie zostają 4 P2, z czego 2 to pomiar bundle'a (reguła D12 pękła dwa razy = agent nie zapobiega, tylko raportuje);
57% wyjścia to P3; „useEffect cleanup" jest dublem z correctness; koszt osi 1,5–2,2% fazy plus indukowany. Bot znalazł po nas klasę perf
(sufit 200 w ścieżce sprzątania), której oś nie złapała. Zamiennik: `size-limit` jako bramka w domknięciu fazy (dziś 0 trafień w .claude/),
`get_advisors(performance)` Supabase dla FK bez indeksu, 5 linii w fokusie correctness (N+1, `for update` na hot path, `Promise.all` po
kolekcji, `.limit()` bez `count`, pętla z fetchem). Warunek odwrotu: >1 P1/P2 klasy perf od bota na 5 faz.

**code-quality → ZOSTAW-ODCHUDZ, nie ZASTAP.** Sceptyk otworzył 9 P2 z próbki: 8 to realne defekty zachowania (rozjechany kontrakt
`AccountLimitKind` w dwóch modułach, XSS przez Content-Type, fetch bez timeoutu, błędy serwera mapowane na 400, nieidempotentny SQL).
Linter/knip złapie 5–8 z 45. Ale 73% wyjścia to P3 stylu, z regeneracją (ten sam martwy wpis 3× w próbce), i każdy P3 kosztuje turę fixa.
Decyzja: mechanika (ESLint flat config: no-explicit-any, no-non-null-assertion, max-lines 300, max-lines-per-function 50, import/order; knip)
w domknięciu fazy — coding-rules §6 tego wymaga, a dziś rolę lintera gra agent Opus. Prompt osi: zakaz zgłaszania czegokolwiek, co łapie lint;
fokus wyłącznie na klasy zachowaniowe. Progi rozmiaru oddać botowi przez `.coderabbit.yaml` (operator odrzucił je hurtowo 2×).

**spec-compliance → ZOSTAW.** Trzy z pięciu proponowanych cięć kasują realne findingi (filtr TEST w JS wyrzuciłby defekt migracji;
„bookkeeping do JS" wyrzuciłby P2 o brakującej zmiennej runtime) lub naruszają udokumentowaną intencję kodu (BLOK_SEMANTYKA). Realna
oszczędność całego pakietu: 0,25–0,3 M na fazie 21,8 M = poniżej rozrzutu między runami. Jedyna korekta: martwe odwołania do `architecture`/
`typescript` w `spec-compliance-reviewer.md:49` i duplikat fokusu w REVIEWERZY:368. Do etapu 4 zostaje pytanie, czy oś nie powinna być
ograniczona do faz z kodem (dziś 27% wyjścia to .md, których bot nie ocenia, więc nie wchodzą do miary jakości).

**verify-sceptycy → ZOSTAW (plus hipoteza).** Analityk chciał zastąpić sceptyka P2 furtką w fixie „nie naprawiaj fałszywych". Zmierzona
skuteczność takiej furtki: 0,4% (2 na 493 naprawione) wobec 19,2% u sceptyków; odrzucony przez fixa P2 nie znika, tylko ląduje w
known-issues i zbija gate na ZASTRZEŻENIA; a coding-rules §4/§5 (anty-pattern „finding dismissal") jedzie w kontekście tego samego agenta.
Naprawa na podstawie fałszywego findingu produkuje P1/P2 bota (udokumentowane: „regresje wprowadziła nasza własna naprawa"). Jedyna realna
wada: grupowanie po pliku nie grupuje (80% grup jednoelementowych, 1,27 findingu/grupę, `MAKS_W_GRUPIE_P2 = 4` martwa). Hipoteza do zmierzenia
w etapie 4: batch 4 findingów per sceptyk niezależnie od pliku (105 → ~30 agentów na 23 fazy).

**pętla fix → nie scalać kontroli z poprawką.** Analityk twierdził „14/14 `regresje: []`". Policzone: 3 trafienia na 12 widocznych wpisów
(25%), każde to zmiana zachowania wprowadzona przez commit fixa (dołożony `AbortSignal.any`, nowe pole `redirectPath` w odpowiedzi API =
zmiana kontraktu), niewidoczna dla typechecku, testów i reviewerów (commit fixa nikt inny nie ogląda). Niezależność wykrywacza od naprawiacza
jest jedynym zabezpieczeniem przed anty-patternem #2/#7. Pre-skan (haiku, grep) ma 2 produkcyjne trafienia w 15 fazach → to praca ESLint.

**orkiestracja → stan w prompcie następcy.** Kluczowa obserwacja sceptyka: treść pliku stanu jest w całości policzona w JS
(`dev-autopilot-wf.js:1199-1205`) i po każdym `stan:zapis` natychmiast startuje kolejny agent z Bashem. Doklejenie stringu stanu do promptu
tego następcy zachowuje wszystkie 3 punkty zapisu w fazie i kasuje 80 powołań haiku (cache write 7,7 M tokenów × 1,25 = 9,6 M jednostek).
Telemetria musi zachować gałąź STOP (`stopRun()` pisze ją osobno; 4 z 13 runów kończy się STOP-em). Domknięcie fazy: pkt 1b (audyt
error-handlingu przed commitem) nie jest duplikatem — zastępuje hook sesyjny, który nie widzi commitów workflow; 0 findingów tej klasy
w 450 próbkach reviewerów dowodzi, że filtr działa. Precheck: 7 wywołań = 0,93 M, jeden odsiew oszczędził 254k → bilans ujemny, scalić z env-up.

**dossier → otwarte.** Analityk chciał odchudzać scribe'a, a jedyny element z ujemnym bilansem to packager: 18,7 M kosztu, 9,5 M zysku
z routingu (19 pominiętych testerów E2E), a routing poza E2E nie wycina prawie niczego (warunek code-quality tautologiczny). Jedyny pomiar
„przed/po dossier" idzie w złą stronę: Bash reviewerów p50 10,5 → 23, Read bez zmian (2). Efekt jest zmieszany z nowym rosterem i rozrostem
CLAUDE.md, więc nie da się go przypisać — ale teza „dossier zastępuje czytanie" nie ma żadnego dowodu. Decyzja należy do projektu „po":
albo dossier dostaje mandat („reviewer zaczyna od dossier, nie robi `git diff`") i pomiar, albo wypada, a routing E2E liczy JS z grepa checkboxów.

## 3. Ucieczki do bota — co przechodzi przez nasz review (80 uwag z 19 compoundów, 6 PR-ów)

| klasa | n | realne? | właściciel | dlaczego przeszło | ruch |
|---|---|---|---|---|---|
| cykl życia i współbieżność UI (flaga stopu po await, bramka na jednej z dwóch dróg, pętla ponowień bez sufitu, updater nieczysty w StrictMode) | 20 | tak | correctness (od 03.09), częściowo performance | **poza zakresem promptu** — nikt nie ma „wszystkich dróg do operacji" | 2 polecenia w prompcie correctness: „wypisz wszystkie drogi do każdej operacji z bramką i pokaż bramkę na każdej"; „sygnał stopu po await = numer generacji, nie flaga" |
| progi rozmiaru 300/50 linii | 20 | konwencja | nikt (code-simplicity nie jest już uruchamiany) | właściciel usunięty 03.09 | oddać botowi (`.coderabbit.yaml` path_instructions) — operator odrzucił hurtowo 2× |
| test niefalsyfikowalny (asercja/atrapa/schemat luźniejszy od kontraktu) | 17 | tak | test-coverage | **w zakresie, przeoczone** — kryterium „test istnieje + ma asercję" | kryterium falsyfikowalności w prompcie (patrz test-coverage) |
| preferencje bota (Act/Assert, docstring, teza obalona pomiarem) | 11 | nie | nikt i słusznie | — | zostawić botowi |
| spójność dwóch systemów (kolejność zapisów, limit cudzej usługi, head-of-line blocking) | 9 | tak | correctness + performance | wymaga kontekstu całego repo | częściowo poza zasięgiem review diffu; do etapu 2 (research) |
| bramka opisana czarną listą z gałęzią domyślną = sukces (`alg:none`, `/api` bez `/`, strażnik seeda) | 7 | tak | security | w zakresie, przeoczone (tryb atakującego od 03.09) | polecenie z listą: „dla każdej bramki wypisz, co przepuszcza domyślna gałąź" |
| granica try/catch i ładunek wyjątku (PII w message pod captureException) | 6 | tak | security + correctness | w zakresie, przeoczone | `grep -rn 'Error(error.message'` jako obowiązkowe wejście |
| tekst dla użytkownika (głos produktu, obietnica czynności, której nie ma) | 5 | tak | spec-compliance krok 5 | w zakresie, przeoczone | `grep` literałów z „Ty" vs docs/design.md |
| lustrzana duplikacja w testach (trzecia kopia luźniejsza) | 3 | tak | code-quality | w zakresie, przeoczone | knip / grep duplikatów regexów |
| wada w dokumencie sterującym (CLAUDE.md z poleceniem wypisującym sekrety do transkryptu; dwa „jedyne źródła" tej samej stałej) | 2 | tak, najdłuższy promień | **nikt** — .claude/ i CLAUDE.md są tylko źródłem kontekstu, nigdy przedmiotem review | poza zakresem | 1 zdanie w security: „jeśli diff dotyka CLAUDE.md/.claude, sprawdź każde polecenie powłoki: co wyląduje w transkrypcie" |
| rozmiar PR (222 pliki → bot odmówił recenzji) | 1 | proces | dev-pr / complete | poza zakresem | limit ~150 plików na PR jako bramka w dev-docs-complete |

**Wniosek:** 68 realnych defektów, **tylko 23 poza zakresem jakiegokolwiek reviewera**. 45 przeszło mimo właściciela i reguły. Nie dodawać
reviewera (+3–5% fazy) ani reguł (+koszt każdej tury). Zamienić 5–6 najczęściej wracających reguł na **polecenia produkujące listę** w prompcie
właściciela osi, z obowiązkiem wpisania wyniku do raportu także gdy lista jest pusta. Koszt: 0 agentów, kilkaset tokenów promptu; potencjał:
~45 z 68 ucieczek.

## 4. Co z tego idzie do etapów 2–4

- **Do researchu (etap 2):** (a) czy istnieje natywny mechanizm ograniczenia kontekstu startowego subagenta (tools allowlist, wyłączenie MCP,
  CLAUDE.md warunkowe) — to dźwignia 30–40%, wielokrotnie większa niż cały etap 1; (b) mutation testing / falsyfikowalność testów jako
  narzędzie (Stryker) zamiast promptu; (c) size-limit + knip + ESLint flat config jako standardowa bramka; (d) czy „review nie zbiega"
  to znana własność LLM-review i jak inni to gaszą (jedna runda + bot, nie powtórki).
- **Do krytyka (etap 3):** luki: brak rozbicia P3 na typy per faza (nie wiadomo, ile z 138 P3 fixa to realne defekty); brak pomiaru
  Read-vs-Bash; brak pomiaru „dossier zastępuje czytanie"; brak per-osiowej atrybucji obaleń.
- **Do panelu projektowego (etap 4), twarde wejścia:** roster 6 → 5 (performance ZASTAP); code-quality z lintem; stan w prompcie następcy;
  precheck w env-up; pre-skan → ESLint; zwiń → stan:zapis; nie scalać kontroli z poprawką; powtórka po STOP-ie E2E = sam tester;
  polecenia-listy zamiast reguł; progi rozmiaru → bot; PR ≤150 plików. Otwarte: packager/dossier, batch sceptyków, ograniczenie spec do faz z kodem.
